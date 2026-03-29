---
name: fsa-dcfsa-claims-automation
description: "Automate the monthly FSA/DCFSA claim workflow: ingest credit card bills, cross-reference eligibility docs, and identify eligible items for submission to Forma."
---

# FSA/DCFSA Claims Automation Skill

Automate the monthly FSA/DCFSA claim workflow: ingest credit card bills, cross-reference eligibility docs, and identify eligible items for submission to Forma.

## Overview

This skill uses three local services to enable a repeatable monthly workflow:
1. **Ingest** credit card statements (PDF → TXT → MongoDB)
2. **Fetch & score** — query Qdrant eligibility rules and pipe into transaction scoring

## Prerequisites

Ensure these services are running:
- **MongoDB**
- **Qdrant**
- **pdftotext** (PDF-to-text converter)

```bash
cd {baseDir} && docker-compose up -d mongodb qdrant ollama
```

## Install pdftotext

**macOS:**
```bash
brew install poppler
```

**Linux:**
```bash
apt-get install poppler-utils
```

## Setup

Run once before first use:

```bash
cd {baseDir}/fsa-dcfsa-claims-automation/scripts
npm install
```

⚠️ **Important:** No new scripts should be created in the `scripts/` folder during the workflow. Use only the existing CLI tools: `ingest-transaction-cli.ts` and `score-transactions.ts`. All workflow steps must use these existing scripts and tools.

---

## Workflow Steps

### Step 1: Ingest Credit Card Bills

Convert PDF credit card statements to text and load transactions into MongoDB.

**Input:** Credit card statement PDFs

**Note:** Credit card statements are typically issued after the 18th of the month. When requesting "this month's" statement, you're usually referring to the previous calendar month's transactions. For example:
- In March, you'd ingest February's statement
- The statement covers transactions from early February through early March

**Process:**

#### 1a. Prepare files
1. Ensure ingestion folder exists at `~/Downloads/FSA_DCFSA_Bills/YYYY-MM/` (create if missing)
2. Prompt user to place all credit card bill PDFs in the folder
3. Wait for user confirmation that files are ready
4. Convert each PDF to text using the PDF-to-text skill

#### 1b. Extract transactions to a JSON file

Parse the raw text and extract **all** transactions into a JSON array. Save it to a temporary file (e.g. `/tmp/transactions-YYYY-MM.json`) **before** touching the database. Do not store transactions directly — this file is the source of truth for the import.

Each element must follow this schema (omit eligibility fields — the CLI sets them to `null`):

```json
[
  {
    "date": "YYYY-MM-DD",
    "merchant": "NORMALIZED UPPERCASE NAME",
    "amount": 12.34,
    "description": "Human-readable description of the charge",
    "category": "medical | pharmacy | food | retail | transport | entertainment | other",
    "issuer": "Chase | Amex | Citi | ...",
    "card_last_four": "1234",
    "source_file": "/absolute/path/to/statement.pdf"
  }
]
```

Rules for extraction:
- `merchant` — uppercase, strip noise (e.g. `"SQ *PHARMACY"` → `"PHARMACY"`)
- `amount` — positive for charges, negative for credits/refunds
- `category` — assign the broadest accurate category from the list above
- Include every transaction line, including refunds and credits

Show the user the extracted JSON for review and ask for confirmation before proceeding to 1c.

#### 1c. Store transactions via the ingestion CLI

⚠️ **Do not insert transactions any other way.** Always use `ingest-transaction-cli.ts`.

After user confirms the extracted JSON, loop over the array and insert each transaction:

```bash
cd {baseDir}/fsa-dcfsa-claims-automation/scripts

# Insert each transaction from the JSON file one by one
jq -c '.[]' /tmp/transactions-YYYY-MM.json | while IFS= read -r tx; do
  npx tsx ingest-transaction-cli.ts --insert-transaction "$tx"
done
```

To correct a previously inserted transaction, use `--upsert-transaction` with its `id`:
```bash
npx tsx ingest-transaction-cli.ts --upsert-transaction '{"id":"<id>","amount":99.99}'
```

To inspect the full schema at any time:
```bash
npx tsx ingest-transaction-cli.ts --transaction-schema
```

**Output:** Transactions stored in MongoDB (one document per transaction), ready for eligibility scanning

---

### Step 2: Fetch Eligibility Rules and Score Transactions

Query Qdrant for FSA/DCFSA eligibility rules and pipe them directly into `score-transactions.ts`.

**Input:** Qdrant eligibility collections + transactions from MongoDB

```bash
cd {baseDir}/fsa-dcfsa-claims-automation/scripts

# Pipe eligibility rules from Qdrant directly into scoring (strongly recommended)
{baseDir}/vector-search/scripts/qdrant-cli --search "FSA DCFSA eligibility" \
  | npx tsx score-transactions.ts --date-from 2026-02-01 --date-to 2026-02-28

# Or save rules to a file first, then score
{baseDir}/vector-search/scripts/qdrant-cli --search "FSA DCFSA eligible items and categories" --limit 20 \
  > /tmp/fsa-rules.txt
npx tsx score-transactions.ts \
  --rules-file /tmp/fsa-rules.txt \
  --date-from 2026-02-01 --date-to 2026-02-28

# Dry run (compute scores but don't write to MongoDB)
npx tsx score-transactions.ts --rules-file /tmp/fsa-rules.txt --rescore --dry-run

# Force re-score already-scored transactions
npx tsx score-transactions.ts --rules-file /tmp/fsa-rules.txt --rescore
```

`qdrant-cli` lives in the **vector-search** skill (`vector-search/scripts/qdrant-cli`).
Override service URLs via env vars if needed:
- `OLLAMA_URL` (default: `http://localhost:11434`)
- `QDRANT_URL` (default: `http://localhost:6333`)

Run `npx tsx score-transactions.ts --help` for the full list of options.

To verify results after scoring:
```bash
npx tsx ingest-transaction-cli.ts --query-transaction '{"date_from":"2026-02-01","eligible_fsa":true}'
```

**Output:** Updated transactions in MongoDB with populated eligibility fields, YAML summary to stdout

---

## Monthly Workflow

1. Organize credit card statements in monthly folder
2. Run Step 1: Ingest statements
3. Run Step 2: Fetch eligibility rules and score transactions
4. Review manual items
5. Submit claims via Forma

---

## Related Skills

- **mongodb-local** - Query and manage MongoDB
- **qdrant-local** - Manage Qdrant vector database
- **forma-help-center** - Populate Qdrant with eligibility data
- **forma-website-browsing** - Submit claims to Forma
