// =============================================================================
// models.unit.test.ts — Pure/data tests for models (no MongoDB required)
// =============================================================================

import { describe, it, expect } from "vitest";
import { CreditCardTransaction, type NewTransactionInput } from "./models.js";

const INPUT: NewTransactionInput = {
  date: "2025-02-14",
  merchant: "WALGREENS",
  amount: 12,
  description: "Pharmacy purchase",
  category: "pharmacy",
  issuer: "Chase",
  card_last_four: "4242",
  imported_at: new Date("2025-02-15T10:00:00Z"),
  source_file: "/tmp/statement.pdf",
};

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

describe("CreditCardTransaction constructor", () => {
  it("sets all core fields from input", () => {
    const t = new CreditCardTransaction(INPUT);
    expect(t.date).toBe(INPUT.date);
    expect(t.merchant).toBe(INPUT.merchant);
    expect(t.amount).toBe(INPUT.amount);
    expect(t.description).toBe(INPUT.description);
    expect(t.category).toBe(INPUT.category);
    expect(t.issuer).toBe(INPUT.issuer);
    expect(t.card_last_four).toBe(INPUT.card_last_four);
    expect(t.imported_at).toBe(INPUT.imported_at);
    expect(t.source_file).toBe(INPUT.source_file);
  });

  it("defaults all eligibility fields to null", () => {
    const t = new CreditCardTransaction(INPUT);
    expect(t.eligibility_reason).toBeNull();
    expect(t.eligible_fsa).toBeNull();
    expect(t.eligible_dcfsa).toBeNull();
    expect(t.eligible_fsa_confidence).toBeNull();
    expect(t.eligible_dcfsa_confidence).toBeNull();
    expect(t.eligibility_scored_at).toBeNull();
  });

  it("two instances constructed from the same input are independent", () => {
    const a = new CreditCardTransaction(INPUT);
    const b = new CreditCardTransaction(INPUT);
    a.eligible_fsa = true;
    expect(b.eligible_fsa).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Static DB methods — existence checks
// ---------------------------------------------------------------------------

describe("CreditCardTransaction static methods", () => {
  it.each(["collection", "insert", "find", "findUnscored", "updateEligibility"])(
    "%s is defined as a function",
    (method) => {
      expect(typeof (CreditCardTransaction as unknown as Record<string, unknown>)[method]).toBe(
        "function",
      );
    },
  );
});
