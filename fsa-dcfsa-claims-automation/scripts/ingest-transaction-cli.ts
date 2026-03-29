#!/usr/bin/env tsx
/**
 * ingest-transaction-cli.ts
 *
 * CLI for inserting, upserting, and deleting CreditCardTransaction documents.
 *
 * Usage:
 *   npx tsx ingest-transaction-cli.ts --insert-transaction '<json>'
 *   npx tsx ingest-transaction-cli.ts --upsert-transaction '<json>'
 *   npx tsx ingest-transaction-cli.ts --delete-transaction <id>
 *   npx tsx ingest-transaction-cli.ts --drop-table
 *
 * --insert-transaction
 *   JSON matching NewTransactionInput (all core fields required, eligibility
 *   fields are set to null automatically).
 *   Example:
 *     '{"date":"2025-02-14","merchant":"WALGREENS","amount":12.5,
 *       "description":"Pharmacy","category":"pharmacy","issuer":"Chase",
 *       "card_last_four":"4242","imported_at":"2025-02-15T10:00:00Z",
 *       "source_file":"/tmp/stmt.pdf"}'
 *
 * --upsert-transaction
 *   JSON with a required "id" field plus any subset of transaction fields.
 *   Updates the matching document with the provided fields ($set).
 *   If no document with that id exists, inserts one (MongoDB upsert).
 *   "id" is mapped to MongoDB's internal "_id" field automatically.
 *   Example (partial update):
 *     '{"id":"507f1f77bcf86cd799439011","merchant":"WALGREENS #2"}'
 *
 * --delete-transaction <id>
 *   Deletes the document with the given MongoDB ObjectId string.
 *
 * --drop-table
 *   Drops the entire credit_card_statements collection. Irreversible.
 *
 * --setup-db
 *   Creates the credit_card_statements collection with JSON Schema validation
 *   and all required indexes. Safe to re-run (idempotent).
 *
 * --transaction-schema
 *   Prints the full JSON Schema for CreditCardTransaction and exits.
 *   No database connection required.
 *
 * --query-transaction <json>
 *   Query transactions. All fields optional and combinable.
 *   Run --query-schema to see available fields.
 *   Example:
 *     '{"date_from":"2025-02-01","date_to":"2025-02-28","eligible_fsa":true}'
 *
 * --import-file <path>
 *   Import a JSON array of transactions from a file. Each element must match
 *   NewTransactionInput. Duplicates are skipped; a summary is printed on exit.
 *   Example:
 *     npx tsx ingest-transaction-cli.ts --import-file /tmp/transactions-2026-02.json
 *
 * --query-schema
 *   Prints available query parameters for --query-transaction and exits.
 *   No database connection required.
 */

import { Command } from "commander";
import { MongoClient } from "mongodb";
import { stringify as toYaml } from "yaml";
import chalk from "chalk";
import { readFileSync } from "fs";
import { MONGO_URI, DB_NAME, COLLECTION_NAME } from "./consts.js";
import {
  insertTransaction,
  insertTransactions,
  upsertTransaction,
  deleteTransaction,
  dropCollectionIfExists,
  queryTransactions,
  COLLECTION_OPTIONS,
  QUERY_SCHEMA,
  type TransactionQuery,
} from "./ingest-transaction-core.js";

// ---------------------------------------------------------------------------
// Logging helpers
// ---------------------------------------------------------------------------

function ok(msg: string) {
  console.log(chalk.green("  [ok]"), msg);
}
function warn(msg: string) {
  console.log(chalk.yellow("[warn]"), msg);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

if (require.main === module) {
  const program = new Command()
    .name("ingest-transaction-cli")
    .description("Insert, upsert, or delete a CreditCardTransaction in MongoDB.")
    .option(
      "--insert-transaction <json>",
      "Insert a new transaction (JSON matching NewTransactionInput)",
    )
    .option(
      "--upsert-transaction <json>",
      'Upsert a transaction (JSON with required "id" + partial fields)',
    )
    .option("--delete-transaction <id>", "Delete a transaction by MongoDB ObjectId")
    .option("--drop-table", "Drop the entire credit_card_statements collection")
    .option("--transaction-schema", "Print the CreditCardTransaction JSON Schema and exit")
    .option("--query-transaction <json>", "Query transactions (see --query-schema for fields)")
    .option("--import-file <path>", "Import a JSON array of transactions from a file")
    .option("--query-schema", "Print available query parameters for --query-transaction and exit");

  program.parse(process.argv);
  const opts = program.opts<{
    insertTransaction?: string;
    importFile?: string;
    upsertTransaction?: string;
    deleteTransaction?: string;
    dropTable?: boolean;
    setupDb?: boolean;
    transactionSchema?: boolean;
    queryTransaction?: string;
    querySchema?: boolean;
  }>();

  // Schema flags need no DB connection — handle and exit immediately.
  if (opts.transactionSchema) {
    console.log(toYaml(COLLECTION_OPTIONS.validator!.$jsonSchema));
    process.exit(0);
  }
  if (opts.querySchema) {
    console.log(toYaml(QUERY_SCHEMA.$jsonSchema));
    process.exit(0);
  }

  const provided = [
    opts.insertTransaction,
    opts.importFile,
    opts.upsertTransaction,
    opts.deleteTransaction,
    opts.dropTable,
    opts.setupDb,
    opts.queryTransaction,
  ].filter(Boolean);

  if (provided.length !== 1) {
    program.help();
  }

  async function main() {
    const client = new MongoClient(MONGO_URI);

    try {
      await client.connect();
      const db = client.db(DB_NAME);

      // -- insert --------------------------------------------------------------
      if (opts.insertTransaction !== undefined) {
        const { doc, inserted } = await insertTransaction(db, JSON.parse(opts.insertTransaction));
        if (inserted) {
          ok(`Inserted: ${doc._id.toString()}`);
        } else {
          warn(`Duplicate skipped: ${doc._id.toString()}`);
        }
      }

      // -- import-file ---------------------------------------------------------
      if (opts.importFile !== undefined) {
        const raw = JSON.parse(readFileSync(opts.importFile, "utf-8")) as unknown;
        if (!Array.isArray(raw)) {
          console.error(chalk.red("[error]"), "--import-file expects a JSON array");
          process.exit(1);
        }
        const { inserted, skipped, errors } = await insertTransactions(db, raw as Record<string, unknown>[]);
        ok(`Imported: ${inserted} inserted, ${skipped} duplicate(s) skipped`);
        if (errors.length > 0) {
          for (const { index, message } of errors) {
            console.error(chalk.red("[error]"), `  [${index}] ${message}`);
          }
          process.exit(1);
        }
      }

      // -- upsert --------------------------------------------------------------
      if (opts.upsertTransaction !== undefined) {
        const raw = JSON.parse(opts.upsertTransaction) as Record<string, unknown>;
        const { id, ...fields } = raw;

        if (id === undefined) {
          console.error(chalk.red("[error]"), '--upsert-transaction requires an "id" field');
          process.exit(1);
        }

        const result = await upsertTransaction(db, id as string, fields);
        if (result.upsertedId) {
          ok(`Upserted (new): ${result.upsertedId}`);
        } else {
          ok(`Updated: ${id as string}  (${result.modifiedCount} field(s) changed)`);
        }
      }

      // -- delete --------------------------------------------------------------
      if (opts.deleteTransaction !== undefined) {
        const deleted = await deleteTransaction(db, opts.deleteTransaction);
        if (deleted) {
          ok(`Deleted: ${opts.deleteTransaction}`);
        } else {
          warn(`No document found with id: ${opts.deleteTransaction}`);
        }
      }

      // -- query-transaction ---------------------------------------------------
      if (opts.queryTransaction !== undefined) {
        const query = JSON.parse(opts.queryTransaction) as TransactionQuery;
        const results = await queryTransactions(db, query);
        if (results.length === 0) {
          warn("No transactions matched the query.");
        } else {
          const plain = results.map((doc) => ({
            id: doc._id.toString(),
            date: doc.date,
            merchant: doc.merchant,
            amount: doc.amount,
            description: doc.description,
            category: doc.category,
            issuer: doc.issuer,
            card_last_four: doc.card_last_four,
            imported_at: doc.imported_at.toISOString(),
            source_file: doc.source_file,
            eligible_fsa: doc.eligible_fsa,
            eligible_dcfsa: doc.eligible_dcfsa,
            eligible_fsa_confidence: doc.eligible_fsa_confidence,
            eligible_dcfsa_confidence: doc.eligible_dcfsa_confidence,
            eligibility_reason: doc.eligibility_reason,
            eligibility_scored_at: doc.eligibility_scored_at?.toISOString() ?? null,
          }));
          process.stdout.write(toYaml(plain));
        }
      }

      // -- drop-table ----------------------------------------------------------
      if (opts.dropTable) {
        const dropped = await dropCollectionIfExists(db, COLLECTION_NAME);
        if (dropped) {
          ok(`Dropped collection: ${COLLECTION_NAME}`);
        } else {
          warn(`Collection ${COLLECTION_NAME} does not exist — nothing to drop`);
        }
      }
    } finally {
      await client.close();
    }
  }

  main().catch((err) => {
    console.error(chalk.red("[error]"), err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
