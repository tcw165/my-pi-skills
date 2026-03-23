/** MongoDB connection URI. Override via MONGO_URI env var to supply credentials. */
export const MONGO_URI = process.env.MONGO_URI ?? "mongodb://admin:password@localhost:27017";

/** Database name for FSA/DCFSA claims data. */
export const DB_NAME = "fsa_claims_db";

/** Collection that stores one document per credit-card transaction. */
export const COLLECTION_NAME = "credit_card_statements";
