#!/usr/bin/env tsx
/**
 * score-transactions.ts
 *
 * Batch-score unscored FSA/DCFSA transactions from MongoDB using `pi` as a
 * one-shot scoring subprocess per transaction.
 *
 * Usage:
 *   # Pipe rules from Qdrant skill
 *   qdrant-cli --search "FSA DCFSA eligibility" | npx tsx score-transactions.ts
 *
 *   # Use a saved rules file
 *   npx tsx score-transactions.ts --rules-file /tmp/fsa-rules.txt
 *
 *   # Scope by date
 *   npx tsx score-transactions.ts --rules-file /tmp/fsa-rules.txt \
 *     --date-from 2026-02-01 --date-to 2026-02-28
 *
 *   # Dry run (compute but don't write to DB)
 *   npx tsx score-transactions.ts --rules-file /tmp/fsa-rules.txt --dry-run
 *
 *   # Force re-score already-scored transactions
 *   npx tsx score-transactions.ts --rules-file /tmp/fsa-rules.txt --rescore
 *
 * Note: queryTransactions caps at 100 results. Acceptable for monthly
 * statement volumes. Run per-month date ranges for larger datasets.
 */

import { Command } from "commander";
import { MongoClient } from "mongodb";
import { stringify as toYaml } from "yaml";
import chalk from "chalk";
import { spawn } from "child_process";
import { readFileSync } from "fs";
import { MONGO_URI, DB_NAME } from "./consts.js";
import {
  queryTransactions,
  upsertTransaction,
  type TransactionQuery,
} from "./ingest-transaction-core.js";

// ---------------------------------------------------------------------------
// Logging helpers (stderr only — keeps stdout clean for YAML piping)
// ---------------------------------------------------------------------------

function info(msg: string) {
  console.error(chalk.cyan(" [info]"), msg);
}
function ok(msg: string) {
  console.error(chalk.green("   [ok]"), msg);
}
function warn(msg: string) {
  console.error(chalk.yellow(" [warn]"), msg);
}
function err(msg: string) {
  console.error(chalk.red("[error]"), msg);
}

// ---------------------------------------------------------------------------
// Rules reading
// ---------------------------------------------------------------------------

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (chunk) => chunks.push(chunk));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    process.stdin.on("error", reject);
  });
}

async function readRules(filePath?: string): Promise<string> {
  if (filePath) {
    return readFileSync(filePath, "utf-8");
  }
  if (!process.stdin.isTTY) {
    return readStdin();
  }
  err("No rules source. Use --rules-file or pipe via stdin.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Pi one-shot subprocess
// ---------------------------------------------------------------------------

const ELIGIBILITY_THRESHOLD = 0.5;

/** Raw output from pi — only confidence scores, no booleans. */
interface EligibilityScore {
  fsa_confidence: number;
  dcfsa_confidence: number;
  eligibility_reason: string;
}

/**
 * Spawn a single `pi` process to score one transaction.
 * Uses --thinking off --no-tools --no-extensions --no-prompt-template so the
 * output is plain text with no tool calls or chain-of-thought noise.
 */
function scoreWithPi(rules: string, txData: object): Promise<string> {
  return new Promise((resolve, reject) => {
    const systemPrompt =
      `You are an FSA/DCFSA eligibility scorer.\n\n` +
      `Eligibility rules:\n${rules}\n\n` +
      `Score the transaction provided by the user. ` +
      `Respond ONLY with a JSON object — no markdown fences, no explanation outside the JSON:\n` +
      `{\n` +
      `  "fsa_confidence": number (0.0–1.0, probability the transaction is FSA-eligible),\n` +
      `  "dcfsa_confidence": number (0.0–1.0, probability the transaction is DCFSA-eligible),\n` +
      `  "eligibility_reason": string (1–2 sentences)\n` +
      `}`;

    const printArg = JSON.stringify(txData, null, 2);

    const proc = spawn(
      "pi",
      [
        "--thinking",
        "off",
        "--no-tools",
        "--no-extensions",
        "--no-prompt-template",
        "--system-prompt",
        systemPrompt,
        "--print",
        printArg,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`pi exited ${code}: ${stderr.trim()}`));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Score parsing
// ---------------------------------------------------------------------------

function parseScore(raw: string): EligibilityScore {
  // Strip markdown code fences if present
  const cleaned = raw.replace(/^```(?:json)?\n?|\n?```$/g, "").trim();
  return JSON.parse(cleaned) as EligibilityScore;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

if (require.main === module) {
  const program = new Command()
    .name("score-transactions")
    .description(
      "Batch-score FSA/DCFSA transactions from MongoDB using pi one-shot subprocesses.",
    )
    .option(
      "--rules-file <path>",
      "Read eligibility rules from file (alternative to stdin)",
    )
    .option(
      "--date-from <YYYY-MM-DD>",
      "Filter transactions by date (inclusive)",
    )
    .option("--date-to <YYYY-MM-DD>", "Filter transactions by date (inclusive)")
    .option(
      "--rescore",
      "Re-score already-scored transactions (default: skip)",
      false,
    )
    .option("--dry-run", "Compute scores but do not write to MongoDB", false)
    .option("--concurrency <n>", "Max parallel pi subprocesses", "20");

  program.parse(process.argv);
  const opts = program.opts<{
    rulesFile?: string;
    dateFrom?: string;
    dateTo?: string;
    rescore: boolean;
    dryRun: boolean;
    concurrency: string;
  }>();

  async function main() {
    // -- Read rules ----------------------------------------------------------
    info("Reading eligibility rules…");
    const rulesText = await readRules(opts.rulesFile);
    if (!rulesText.trim()) {
      err("Rules text is empty.");
      process.exit(1);
    }
    info(`Rules loaded (${rulesText.length} chars)`);
    const concurrency = Math.max(1, parseInt(opts.concurrency, 10) || 10);
    const startTime = Date.now();
    info(`Concurrency: ${concurrency}`);

    // -- Connect to MongoDB --------------------------------------------------
    const dbClient = new MongoClient(MONGO_URI);

    const summary = {
      total: 0,
      scored: 0,
      fsa_eligible: 0,
      dcfsa_eligible: 0,
      dry_run: opts.dryRun,
      errors: [] as Array<{ id: string; merchant: string; message: string }>,
    };

    try {
      await dbClient.connect();
      const db = dbClient.db(DB_NAME);

      // -- Fetch transactions ------------------------------------------------
      const query: TransactionQuery = {};
      if (opts.dateFrom) query.date_from = opts.dateFrom;
      if (opts.dateTo) query.date_to = opts.dateTo;
      query.limit = 100;

      const allDocs = await queryTransactions(db, query);

      // Filter: skip already-scored unless --rescore
      const toScore = opts.rescore
        ? allDocs
        : allDocs.filter(
            (d) => d.eligible_fsa === null || d.eligible_fsa === undefined,
          );

      summary.total = allDocs.length;
      info(
        `Found ${allDocs.length} transaction(s); will score ${toScore.length}` +
          (opts.rescore ? " (--rescore)" : " (skipping already scored)"),
      );

      if (toScore.length === 0) {
        warn("Nothing to score. Use --rescore to re-score existing results.");
      }

      // -- Score transactions with bounded concurrency ----------------------
      async function scoreOne(doc: (typeof toScore)[number]) {
        const id = doc._id.toString();
        const txData = {
          date: doc.date,
          merchant: doc.merchant,
          amount: doc.amount,
          description: doc.description,
          category: doc.category,
        };

        try {
          const raw = await scoreWithPi(rulesText, txData);
          const score = parseScore(raw);

          const eligible_fsa = score.fsa_confidence >= ELIGIBILITY_THRESHOLD;
          const eligible_dcfsa =
            score.dcfsa_confidence >= ELIGIBILITY_THRESHOLD;

          info(
            `${doc.merchant.padEnd(30)} FSA=${String(eligible_fsa).padEnd(5)} ` +
              `DCFSA=${String(eligible_dcfsa).padEnd(5)} ` +
              `(${(score.fsa_confidence * 100).toFixed(0)}% / ` +
              `${(score.dcfsa_confidence * 100).toFixed(0)}%)`,
          );

          if (!opts.dryRun) {
            await upsertTransaction(db, id, {
              eligible_fsa,
              eligible_dcfsa,
              fsa_confidence: score.fsa_confidence,
              dcfsa_confidence: score.dcfsa_confidence,
              eligibility_reason: score.eligibility_reason,
              eligibility_scored_at: new Date().toISOString(),
            });
          }

          summary.scored++;
          if (eligible_fsa) summary.fsa_eligible++;
          if (eligible_dcfsa) summary.dcfsa_eligible++;
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          err(`Failed to score ${id} (${doc.merchant}): ${message}`);
          summary.errors.push({ id, merchant: doc.merchant, message });
        }
      }

      // Run up to `concurrency` tasks at a time
      const queue = [...toScore];
      async function worker() {
        while (queue.length > 0) {
          const doc = queue.shift()!;
          await scoreOne(doc);
        }
      }
      await Promise.all(Array.from({ length: concurrency }, worker));
    } finally {
      await dbClient.close();
    }

    const elapsedMs = Date.now() - startTime;
    const elapsedSec = (elapsedMs / 1000).toFixed(1);
    info(`Done in ${elapsedSec}s (${summary.scored} scored, concurrency=${concurrency})`);

    // -- Output YAML summary to stdout ---------------------------------------
    process.stdout.write(toYaml({ ...summary, elapsed_ms: elapsedMs }));

    if (summary.errors.length > 0) {
      process.exit(1);
    }
  }

  main().catch((e) => {
    err(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}
