# FSA/DCFSA Automation — TODO

Priority key: **P0** = foundation, do first. **P1** = streamlines existing manual work. **P2** = ambitious / depends on P0+P1.

---

## P0 — Foundation

Everything else builds on these. Cheap to add, removes the highest-risk gaps.

### P0.1 `claim_cases` collection — first-class lifecycle entity *(headline)*

The single biggest gap: there's no answer to "does a claim case exist for this expense? Is it pending? Is it completed?" Today eligibility lives as fields on transactions, but a *claim case* is a different entity with its own lifecycle — it's submitted to Forma, decided by Forma, and reimbursed independently of the transaction that birthed it.

**Why a separate collection (not just fields on transactions)**:
- One case can bundle multiple transactions (e.g. an itemized pharmacy receipt with several lines).
- Re-scoring transactions must not mutate the case state — a `submitted` case stays submitted regardless of what the scorer says next time.
- Forma is the source of truth for `received` / `reimbursed` / `rejected`. The case mirrors Forma; transactions stay local.
- "What's pending?" / "What's done?" become one-line queries against `claim_cases.status` instead of reasoning about flags scattered across transactions.

**Schema**:
```
claim_cases:
  case_id              # stable hash of {account_type, date, amount, merchant} — survives re-ingestion
  account_type         # "FSA" | "DCFSA"
  status               # candidate | submitted | received | reimbursed | rejected | needs_info | withdrawn
  transaction_ids      # [ObjectId, ...] — 1..N transactions covered by this case
  amount_total
  date_first / date_last
  forma_claim_id       # null until submitted/observed in Forma
  receipt_image_paths  # [path, ...] (populated by P1.1)
  created_at
  submitted_at         # set when state → submitted
  decided_at           # set when state → received/rejected
  reimbursed_at        # set when state → reimbursed
  rejection_reason     # set when state → rejected/needs_info
  notes
```

**State machine**:
```
candidate ──submit──▶ submitted ──Forma decides──▶ received ──pay──▶ reimbursed
    │                     │                         │
    │                     │                         └──reject──▶ rejected
    │                     └──info_request──▶ needs_info ──resubmit──▶ submitted
    └──ignore──▶ withdrawn
```

**Evidence sources for each state transition** (important — no single source is authoritative):

| Transition           | Signal                                                                |
|----------------------|-----------------------------------------------------------------------|
| `→ candidate`        | local scorer flagged transaction eligible (P1.2 confidence ≥ 0.6)     |
| `→ submitted`        | P2.1 auto-submit OR pulled from Forma `Pending` list (P0.3)           |
| `→ received`         | Forma claims page shows `Approved` (P0.3)                             |
| `→ reimbursed`       | **bank deposit detected (P2.4 Plaid)** OR **Forma reimbursement email (P2.4 Gmail)** OR Forma claims page shows `Paid` (P0.3, may lag) |
| `→ rejected` / `needs_info` | Forma page status (P0.3) OR Forma email (P2.4)                 |

The `reimbursed` transition is multi-source by design: Forma's web UI often lags the actual ACH deposit by 1–3 days, so the bank/email signals usually fire first. Record `reimbursed_via: "bank_deposit" | "forma_email" | "forma_page"` on the case for audit.

**Action items**:
- [ ] New `claim_cases` collection with the schema above (JSON-Schema validated, like `credit_card_statements`)
- [ ] Indexes: `(status)`, `(account_type, status)`, `(forma_claim_id)`, `(case_id)` unique
- [ ] `claim-case-cli.ts` with subcommands:
  - `--create-from-transaction <txid>` — promote a `scored:eligible` transaction to a `candidate` case
  - `--bulk-create-candidates --date-from --date-to` — create cases for every eligible transaction in range that doesn't already have one
  - `--update-status <case_id> <new_status> [--rejection-reason …]` — drive transitions with validation
  - `--query '{status: "pending"}'` (`pending` = `submitted | needs_info`)
  - `--summary` — counts by status, by month, by account_type
- [ ] Replace the `claim_status` field idea on transactions with a back-reference: `case_id` (nullable) on each transaction
- [ ] `ingest-transaction-cli.ts --status` should now roll up per-month stats by joining transactions ↔ claim_cases (e.g. "2026-02 Robinhood 4551: 9 scored eligible · 7 candidate · 2 submitted · 0 reimbursed")

### P0.2 Statements + card registry (supporting infrastructure)

Needed so P0.1 can answer "what statements are missing?" and "what cases haven't been created yet?"

- [ ] New `statements` collection: `{issuer, card_last_four, period_start, period_end, source_pdf_path, source_pdf_sha256, ingested_at, transaction_count}`
- [ ] New `card_registry` collection: `{card_last_four, issuer, expected_statement_day, fsa_relevant}` — drives "what's expected this month"
- [ ] Hash PDFs on ingest (sha256) — refuse re-import of an already-ingested statement under a different filename
- [ ] Fix the dedup bug found in the DB: `CVS/PHARMACY` ↔ `CVS PHARMACY` slipped past dedup because `merchant` was in the dedup key verbatim. Either normalize merchant on insert (collapse `/`, `*`, `#`, repeated whitespace) or move to a softer dedup key (`{date, amount, card_last_four, amount}`)

### P0.3 Pull Forma claims history (drives `claim_cases.status`)

Without this, the case state machine is one-sided — we know what we *intend* to submit, but never learn what Forma actually received or paid. Risk: double-submitting cases that already settled.

- [ ] New script `forma-claims-fetch.ts` — scrapes `https://client.joinforma.com/claims` via `browser-eval.js` (auth via existing browser profile)
- [ ] For each Forma claim row: match `{date ±2 days, amount exact, merchant fuzzy}` to a local `claim_cases` row by `case_id`
  - Match found → reconcile status: `submitted → received → reimbursed` etc.
  - No match → create a new `claim_cases` row in `submitted`/`received`/`reimbursed` state with `forma_claim_id` set and `transaction_ids` empty (we'll back-fill if/when the matching transaction is ingested)
- [ ] Run as **step 0** of the monthly workflow, before scoring

---

## P1 — Streamline claim generation

### P1.1 Receipt image generation
Forma's claim form requires an image showing the transaction line. Currently 100% manual.

- [ ] Add `pdftoppm` step (poppler — already installed) to render each statement page → PNG
- [ ] Use `pdftotext -bbox-layout` to get word-level bboxes
- [ ] For each transaction in a `candidate` case: locate its line by matching date+merchant+amount tokens, crop + annotate with red rectangle
- [ ] Save to `~/Downloads/FSA_DCFSA_Bills/YYYY-MM/receipts/<case_id>.png`
- [ ] Stamp `receipt_image_paths` on the case

### P1.2 Scoring determinism + `needs_review` band
`pi` is non-deterministic; borderline confidences flip categories between runs. Real evidence: BEAR VALLEY $1,697 (3/08) is currently scored `eligible_fsa: true` with confidence ≥ 0.5, but the reason text says "only if medical purpose" — exactly the borderline that should be human-reviewed, not auto-promoted.

- [ ] Cache scores keyed by `sha256(rules_text || tx_signature)` — re-runs become free + stable
- [ ] Stamp `rules_hash` on every scored tx
- [ ] When `0.4 < confidence < 0.6` → tag the transaction `needs_review` and **do not** auto-create a `claim_case` for it. Surface in `claim-case-cli.ts --summary` as a separate bucket.
- [ ] When current `rules_hash` differs from stored, flag scores as stale (queryable but surfaced)

### P1.3 Ingest-cli accepts stdin
*(carry-over from old TODO — still open)*

- [ ] `ingest-transaction-cli.ts` auto-detects non-TTY stdin for `--import-file` (or new `--import-stdin`)
- [ ] Update `SKILL.md` to recommend piping pattern → reduces output tokens for in-flight script writing

### P1.4 Test data isolation
The DB currently mixes real and test rows (`/tmp/test-statement.pdf`, `/tmp/march-statement.pdf`, old `.pi/agent/skills/...` paths). The only DCFSA result in the entire DB is from a test fixture.

- [ ] Add `is_test: bool` field on transactions (default `false`); set `true` for any `source_file` under `/tmp/` or known test paths
- [ ] Default queries (`--query-transaction`, `claim-case-cli`) exclude `is_test: true` unless `--include-test` is passed
- [ ] One-time cleanup script to backfill `is_test` on existing rows or hard-delete obvious test data

---

## P2 — Submission automation + missing channels

### P2.1 Forma auto-submit (depends on P0.1, P0.3, P1.1)
Last manual step. Safe to attempt only after `claim_cases` + Forma sync + receipt generation exist.

- [ ] New TS script `forma-submit.ts` — drives a single `claim_cases` row from `candidate` → `submitted`, attaches its `receipt_image_paths`, captures the returned `forma_claim_id`
- [ ] Uses authenticated browser profile (no creds enter the process)
- [ ] Strict TS + lint rule blocking `console.log` / serialization of cookie or session
- [ ] `--dry-run` mode screenshots each step instead of clicking submit
- [ ] If a password is ever needed: read via `security find-generic-password -s forma -w` only — never env, never file

### P2.2 DCFSA non-card ingestion path
DCFSA is paid by check / ACH / Venmo — invisible to credit-card-only ingestion today. Confirmed by current DB state: zero real DCFSA cases.

- [ ] Add `source` field to transactions: `card | venmo | ach | check | other`
- [ ] Manual `--insert-transaction` flow + screenshot attachment for Venmo/Zelle (the screenshot becomes the `receipt_image_paths` for the case)
- [ ] (stretch) Plaid integration for ACH from primary bank

### P2.3 Rules freshness loop
Forma updates eligibility rules; Qdrant drifts silently.

- [ ] Scheduled refresh of Qdrant from Forma help center (uses `forma-help-center` skill)
- [ ] Tie into `rules_hash` from P1.2 so stale scores surface automatically after a refresh

### P2.4 Reimbursement detection — bank deposits + Forma emails
P0.3 only sees Forma's web UI, which lags the actual reimbursement by days. The authoritative signals are the ACH deposit on the bank side and the email Forma sends when a claim pays out. This closes the case lifecycle (`received → reimbursed`) without waiting for the web UI to catch up.

**Bank deposit detection (Plaid)**:
- [ ] Plaid integration to pull deposits from the linked reimbursement bank account
- [ ] Match deposits to open `received` cases by `{amount exact, date ±5 days, payer description contains "FORMA" or "EVIVE"}`
- [ ] On match: transition case → `reimbursed`, set `reimbursed_at`, `reimbursed_via: "bank_deposit"`, store the bank-side transaction id

**Email notification (Gmail)**:
- [ ] Gmail integration (Gmail MCP is already available) — search `from:noreply@joinforma.com` or `subject:"reimbursement"`
- [ ] Parse claim-paid emails for `{forma_claim_id, amount, paid_at}` and reconcile against open cases by `forma_claim_id`
- [ ] On match: transition case → `reimbursed`, `reimbursed_via: "forma_email"`
- [ ] Also catch `denied` / `more info needed` emails → drive `→ rejected` / `→ needs_info` states

**Conflict resolution**: if multiple signals fire (email + deposit + page), use first-arriving as the transition trigger and stamp all observed sources for audit.
