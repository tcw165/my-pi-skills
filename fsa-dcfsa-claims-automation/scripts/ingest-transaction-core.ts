import { type Db, type CreateCollectionOptions, type WithId, ObjectId, Double } from "mongodb";
import { CreditCardTransaction, type NewTransactionInput } from "./models.js";
import { COLLECTION_NAME } from "./consts.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IndexSpec {
  key: Record<string, 1 | -1>;
  name: string;
  unique?: boolean;
  sparse?: boolean;
}

export interface EnsureCollectionResult {
  action: "created" | "updated";
}

export interface EnsureIndexesResult {
  indexNames: string[];
}

// ---------------------------------------------------------------------------
// JSON Schema validator for the collection
// ---------------------------------------------------------------------------

export const COLLECTION_OPTIONS: CreateCollectionOptions = {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      title: "CreditCardTransaction",
      required: [
        "date",
        "merchant",
        "amount",
        "description",
        "category",
        "issuer",
        "card_last_four",
        "imported_at",
        "source_file",
        // Eligibility fields are required but nullable.
        "eligibility_reason",
        "eligible_fsa",
        "eligible_dcfsa",
        "eligible_fsa_confidence",
        "eligible_dcfsa_confidence",
        "eligibility_scored_at",
      ],
      properties: {
        // Core fields
        date: {
          bsonType: "string",
          description: "Transaction date in YYYY-MM-DD format",
          pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        },
        merchant: {
          bsonType: "string",
          description: "Normalised merchant name (UPPERCASE)",
        },
        amount: {
          bsonType: "double",
          description: "Positive = charge, negative = credit/refund",
        },
        description: {
          bsonType: "string",
          description: "Human-readable transaction description",
        },
        category: {
          bsonType: "string",
          description: "Broad transaction category (medical, pharmacy, food, …)",
        },
        issuer: {
          bsonType: "string",
          description: "Credit card issuer name",
        },
        card_last_four: {
          bsonType: "string",
          description: "Last 4 digits of the card",
          pattern: "^\\d{4}$",
        },
        imported_at: {
          bsonType: "date",
          description: "ISO timestamp when the document was inserted",
        },
        source_file: {
          bsonType: "string",
          description: "Absolute path to the source PDF",
        },
        // Eligibility fields (nullable)
        eligibility_reason: {
          bsonType: ["string", "null"],
          description: "Explanation of the eligibility determination",
        },
        eligible_fsa: {
          bsonType: ["bool", "null"],
          description: "FSA reimbursement eligibility flag",
        },
        eligible_dcfsa: {
          bsonType: ["bool", "null"],
          description: "DCFSA reimbursement eligibility flag",
        },
        eligible_fsa_confidence: {
          bsonType: ["double", "null"],
          minimum: 0,
          maximum: 1,
          description: "Confidence score for FSA eligibility (0.0 – 1.0)",
        },
        eligible_dcfsa_confidence: {
          bsonType: ["double", "null"],
          minimum: 0,
          maximum: 1,
          description: "Confidence score for DCFSA eligibility (0.0 – 1.0)",
        },
        eligibility_scored_at: {
          bsonType: ["date", "null"],
          description: "Timestamp when eligibility was last scored",
        },
      },
      additionalProperties: true, // allow _id and future fields
    },
  },
  validationLevel: "strict",
  validationAction: "error",
};

// ---------------------------------------------------------------------------
// Index definitions
// ---------------------------------------------------------------------------

export const INDEXES: IndexSpec[] = [
  // Fastest way to query by ingestion date (used in Step 3 month filter)
  { key: { imported_at: -1 }, name: "imported_at_desc" },
  // Useful for looking up all transactions from a given card
  { key: { card_last_four: 1 }, name: "card_last_four" },
  // Useful for filtering by date range on statement date
  { key: { date: -1 }, name: "date_desc" },
  // Useful for eligibility scanning queries
  { key: { eligible_fsa: 1 }, name: "eligible_fsa", sparse: true },
  { key: { eligible_dcfsa: 1 }, name: "eligible_dcfsa", sparse: true },
  // Composite: month-range eligibility query (Step 3 main query pattern)
  { key: { imported_at: -1, eligible_fsa: 1 }, name: "imported_at_eligible_fsa" },
];

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if value matches the YYYY-MM-DD date pattern enforced by the
 * collection schema. Note: this is a format check only — it does not validate
 * whether the month/day values are in range.
 */
export function isValidTransactionDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

// ---------------------------------------------------------------------------
// Async DB operations (accept an injected Db handle — no client management)
// ---------------------------------------------------------------------------

/**
 * Creates the collection with JSON Schema validation if it does not exist, or
 * updates the validator in place if it already exists (idempotent).
 */
async function ensureCollection(
  db: Db,
  collectionName: string,
  options: CreateCollectionOptions,
): Promise<EnsureCollectionResult> {
  const existing = await db.listCollections({ name: collectionName }).toArray();

  if (existing.length === 0) {
    await db.createCollection(collectionName, options);
    return { action: "created" };
  }

  // Collection already exists — update validator without dropping data.
  await db.command({
    collMod: collectionName,
    validator: options.validator,
    validationLevel: options.validationLevel,
    validationAction: options.validationAction,
  });
  return { action: "updated" };
}

/**
 * Creates all indexes defined in `indexes`. MongoDB's createIndex is idempotent
 * for the same spec, so this is safe to call multiple times.
 */
async function ensureIndexes(
  db: Db,
  collectionName: string,
  indexes: IndexSpec[],
): Promise<EnsureIndexesResult> {
  const col = db.collection(collectionName);
  const indexNames: string[] = [];

  for (const idx of indexes) {
    const { key, name, ...rest } = idx;
    await col.createIndex(key, { name, ...rest });
    indexNames.push(name);
  }

  return { indexNames };
}

async function setupDb(db: Db): Promise<void> {
  await ensureCollection(db, COLLECTION_NAME, COLLECTION_OPTIONS);
  await ensureIndexes(db, COLLECTION_NAME, INDEXES);
}

/**
 * Drops the collection if it exists.
 * @returns true if the collection existed and was dropped, false otherwise.
 */
export async function dropCollectionIfExists(
  db: Db,
  collectionName: string,
): Promise<boolean> {
  const existing = await db.listCollections({ name: collectionName }).toArray();
  if (existing.length === 0) return false;

  await db.collection(collectionName).drop();
  return true;
}

// ---------------------------------------------------------------------------
// Transaction CRUD operations
// ---------------------------------------------------------------------------

/** Coerces ISO date strings to Date objects for known date fields. */
function coerceDates(obj: Record<string, unknown>): void {
  for (const field of ["imported_at", "eligibility_scored_at"]) {
    if (typeof obj[field] === "string") {
      obj[field] = new Date(obj[field] as string);
    }
  }
}

/** Wraps amount in BSON Double so the schema (bsonType: "double") accepts plain integers. */
function coerceAmount(obj: Record<string, unknown>): void {
  if (typeof obj.amount === "number") {
    obj.amount = new Double(obj.amount);
  }
}

export async function insertTransaction(
  db: Db,
  raw: Record<string, unknown>,
): Promise<WithId<CreditCardTransaction>> {
  await setupDb(db);
  coerceDates(raw);
  return CreditCardTransaction.insert(db, raw as NewTransactionInput);
}

export interface UpsertTransactionResult {
  upsertedId: string | null;
  modifiedCount: number;
}

export async function upsertTransaction(
  db: Db,
  id: string,
  fields: Record<string, unknown>,
): Promise<UpsertTransactionResult> {
  await setupDb(db);
  coerceDates(fields);
  coerceAmount(fields);
  const result = await CreditCardTransaction.collection(db).updateOne(
    { _id: new ObjectId(id) },
    { $set: fields },
    { upsert: true },
  );
  return {
    upsertedId: result.upsertedId?.toString() ?? null,
    modifiedCount: result.modifiedCount,
  };
}

/**
 * Deletes the transaction with the given id.
 * @returns true if a document was deleted, false if no match was found.
 */
export async function deleteTransaction(db: Db, id: string): Promise<boolean> {
  const result = await CreditCardTransaction
    .collection(db)
    .deleteOne({
      _id: new ObjectId(id as string),
    });
  return result.deletedCount > 0;
}
