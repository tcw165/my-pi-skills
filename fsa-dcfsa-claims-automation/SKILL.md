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
7. Store in MongoDB: database `fsa_claims_db`, collection `credit_card_statements`
   - Each document represents a single transaction
   - Schema with types:
     - `date` (string): Transaction date in YYYY-MM-DD format
     - `merchant` (string): Normalized merchant name (uppercase)
     - `amount` (number): Transaction amount (positive for charges, negative for credits)
     - `description` (string): Human-readable transaction description
     - `category` (string): Transaction category (e.g., food, medical, pharmacy, gas, etc.)
     - `issuer` (string): Credit card issuer name
     - `card_last_four` (string): Last 4 digits of card number
     - `imported_at` (Date): ISO timestamp when transaction was imported
     - `source_file` (string): Absolute path to source PDF file
   - Create index on `imported_at` field for faster queries

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
1. Load all transactions for the month
2. Load cached eligibility rules
3. For each transaction:
   - Extract key terms (merchant name, description)
   - Match against FSA eligibility rules → score
   - Match against DCFSA eligibility rules → score
   - Match against ineligible patterns → score
   - Determine final eligibility status
4. Update MongoDB with eligibility results and confidence scores
5. Identify transactions requiring manual review
6. Generate eligibility report

**Output:** Updated transactions with eligibility status, manual review list, summary report

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
