---
name: fsa-dcfsa-claims-automation
description: "Automate the monthly FSA/DCFSA claim workflow: ingest credit card bills, cross-reference eligibility docs, and identify eligible items for submission to Forma."
---

# FSA/DCFSA Claims Automation Skill

Automate the monthly FSA/DCFSA claim workflow: ingest credit card bills, cross-reference eligibility docs, and identify eligible items for submission to Forma.

## Overview

This skill uses three local services to enable a repeatable monthly workflow:
1. **Ingest** credit card statements (PDF → TXT → MongoDB)
2. **Reference** FSA/DCFSA eligibility rules from Qdrant vector store
3. **Scan** transaction items and flag eligible claims

## Prerequisites

Ensure these services are running:
- **MongoDB**
- **Qdrant**
- **pdftotext** (PDF-to-text converter)

See your `docker-compose.yml` for service configuration and `docker ps` to verify they're running.

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

### Step 2: Read FSA/DCFSA Eligibility Rules from Qdrant

Retrieve FSA/DCFSA eligibility knowledge from Qdrant vector database.

**Input:** Qdrant collections with eligibility documentation

**Process:**
1. Connect to Qdrant
2. Query eligibility collections:
   - FSA-eligible items and categories
   - DCFSA-eligible items and categories
   - Ineligible patterns and rules
3. Build searchable index of eligibility rules
4. Cache locally for quick reference

**Output:** Eligibility rules indexed and cached

---

### Step 3: Scan MongoDB Transactions and Identify Eligible Items

Cross-reference transactions against eligibility rules and score them.

**Input:** Transactions from MongoDB + eligibility rules from Qdrant

**Process:**
1. **Load transactions from MongoDB:** Query transactions for the target month using the CLI:

   ```bash
   cd {baseDir}/fsa-dcfsa-claims-automation/scripts
   npx tsx ingest-transaction-cli.ts --query-transaction '{"date_from":"2025-02-01","date_to":"2025-02-28"}'
   ```

   To see all available query parameters:
   ```bash
   npx tsx ingest-transaction-cli.ts --query-schema
   ```

2. **Load eligibility rules from Qdrant:** Query Qdrant collections for FSA, DCFSA, and ineligible eligibility patterns and rules
3. For each transaction:
   - Extract key terms (merchant name, description, category)
   - Match against FSA eligibility rules → compute `eligible_fsa_confidence` score
   - Match against DCFSA eligibility rules → compute `eligible_dcfsa_confidence` score
   - Determine final eligibility status and set `eligible_fsa` and `eligible_dcfsa` booleans
   - Set `eligibility_reason` (human-readable summary)
4. **Update MongoDB with eligibility results** using `--upsert-transaction` for each transaction:
   ```bash
   npx tsx ingest-transaction-cli.ts --upsert-transaction \
     '{"id":"<id>","eligible_fsa":true,"eligible_dcfsa":false,"eligible_fsa_confidence":0.95,"eligible_dcfsa_confidence":0.1,"eligibility_reason":"Pharmacy purchase","eligibility_scored_at":"2025-03-01T00:00:00Z"}'
   ```
5. Generate eligibility report (summary of results by category and status)

**Output:** Updated transactions in MongoDB with populated eligibility fields, summary report

---

## Monthly Workflow

1. Organize credit card statements in monthly folder
2. Run Step 1: Ingest statements
3. Run Step 2: Load eligibility rules (once per month or as needed)
4. Run Step 3: Scan and score transactions
5. Review manual items
6. Submit claims via Forma

---

## Related Skills

- **mongodb-local** - Query and manage MongoDB
- **qdrant-local** - Manage Qdrant vector database
- **forma-help-center** - Populate Qdrant with eligibility data
- **forma-website-browsing** - Submit claims to Forma
