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
1. Ensure ingestion folder exists at `~/Downloads/FSA_DCFSA_Bills/YYYY-MM/` (create if missing)
2. Prompt user to place all credit card bill PDFs in the folder
3. Wait for user confirmation that files are ready
4. Convert each PDF to text using the PDF-to-text skill
5. Extract transaction data from text (date, merchant, amount, description)
6. Normalize merchant names and assign transaction categories
7. Store each transaction in MongoDB using the ingestion CLI:

   ```bash
   cd {baseDir}/fsa-dcfsa-claims-automation/scripts
   npx tsx ingest-transaction-cli.ts --insert-transaction '<json>'
   ```

   To see the full field schema before inserting, run:
   ```bash
   npx tsx ingest-transaction-cli.ts --transaction-schema
   ```

   Eligibility fields (`eligible_fsa`, `eligible_dcfsa`, etc.) are set to `null` automatically and populated in Step 3.

   To correct a previously inserted transaction, use `--upsert-transaction` with the document's `id`:
   ```bash
   npx tsx ingest-transaction-cli.ts --upsert-transaction '{"id":"<id>","amount":99.99}'
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

`score-transactions.ts`:
- Fetches unscored transactions from MongoDB (skips already-scored unless `--rescore`)
- Spawns a `pi` subprocess in RPC mode as the scoring engine
- Writes `eligible_fsa`, `eligible_dcfsa`, confidence scores, and `eligibility_reason` back to MongoDB
- Prints progress to stderr; outputs a YAML summary report to stdout

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
