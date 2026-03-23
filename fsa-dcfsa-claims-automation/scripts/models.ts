// =============================================================================
// models.ts — ORM models for FSA/DCFSA claims
// =============================================================================

import {
  type Db,
  type Collection,
  type Filter,
  type UpdateResult,
  type WithId,
  ObjectId,
  Double,
} from "mongodb";
import { COLLECTION_NAME } from "./consts.js";

// ---------------------------------------------------------------------------
// Input / update shapes
// ---------------------------------------------------------------------------

/** Core fields required when creating a new transaction. Eligibility fields
 *  are omitted — the class sets them to null automatically on construction. */
export type NewTransactionInput = {
  date: string;
  merchant: string;
  amount: number;
  description: string;
  category: string;
  issuer: string;
  card_last_four: string;
  imported_at: Date;
  source_file: string;
};

/** Fields written by the eligibility-scoring step (Step 3). */
export type EligibilityUpdate = {
  eligibility_reason: string;
  eligible_fsa: boolean;
  eligible_dcfsa: boolean;
  eligible_fsa_confidence: number;
  eligible_dcfsa_confidence: number;
  eligibility_scored_at: Date;
};

// ---------------------------------------------------------------------------
// CreditCardTransaction
// ---------------------------------------------------------------------------

export class CreditCardTransaction {
  // -- Core fields -----------------------------------------------------------
  date: string;
  merchant: string;
  /** Stored as BSON double in MongoDB. insert() handles the coercion. */
  amount: number;
  description: string;
  category: string;
  issuer: string;
  card_last_four: string;
  imported_at: Date;
  source_file: string;

  // -- Eligibility fields (null until Step 3 scores them) --------------------
  eligibility_reason: string | null = null;
  eligible_fsa: boolean | null = null;
  eligible_dcfsa: boolean | null = null;
  eligible_fsa_confidence: number | null = null;
  eligible_dcfsa_confidence: number | null = null;
  eligibility_scored_at: Date | null = null;

  constructor(data: NewTransactionInput) {
    this.date = data.date;
    this.merchant = data.merchant;
    this.amount = data.amount;
    this.description = data.description;
    this.category = data.category;
    this.issuer = data.issuer;
    this.card_last_four = data.card_last_four;
    this.imported_at = data.imported_at;
    this.source_file = data.source_file;
  }

  // -- Static DB methods -----------------------------------------------------

  static collection(db: Db): Collection<CreditCardTransaction> {
    return db.collection<CreditCardTransaction>(COLLECTION_NAME);
  }

  /**
   * Inserts a new transaction. Wraps `amount` in BSON Double so the collection
   * schema (bsonType: "double") accepts plain JS integers like 12.
   */
  static async insert(db: Db, data: NewTransactionInput): Promise<WithId<CreditCardTransaction>> {
    const doc = new CreditCardTransaction(data);
    const bsonDoc = { ...doc, amount: new Double(doc.amount) };
    const result = await this.collection(db).insertOne(
      bsonDoc as unknown as CreditCardTransaction,
    );
    // MongoDB stores this field as BSON `Double`, but our app model uses `number`.
    // Return the app-level shape so the function signature stays accurate.
    return { ...doc, _id: result.insertedId } as WithId<CreditCardTransaction>;
  }

  /** Returns all transactions matching `filter` (default: all). */
  static async find(
    db: Db,
    filter: Filter<CreditCardTransaction> = {},
  ): Promise<WithId<CreditCardTransaction>[]> {
    return this.collection(db).find(filter).toArray();
  }

  /** Returns transactions that have not yet been scored for eligibility. */
  static async findUnscored(db: Db): Promise<WithId<CreditCardTransaction>[]> {
    return this.collection(db).find({ eligible_fsa: null }).toArray();
  }

  /** Writes eligibility scores onto an existing document. */
  static async updateEligibility(
    db: Db,
    id: ObjectId,
    fields: EligibilityUpdate,
  ): Promise<UpdateResult> {
    return this.collection(db).updateOne({ _id: id }, { $set: fields });
  }
}
