---
name: mongodb-local
description: Perform CRUD operations (Create, Read, Update, Delete) on local MongoDB running in Docker.
---

# MongoDB Local Skill

Perform CRUD operations (Create, Read, Update, Delete) on local MongoDB running on localhost:27017.

## Overview

This skill provides examples for interacting with MongoDB running on your local machine at `localhost:27017`.

### Connection Details

```
mongodb://admin:password@localhost:27017/fsa_claims_db?authSource=admin
```

Check your `docker-compose.yml` for the current credentials and port.

### Prerequisites

#### 1. Install MongoDB Shell (mongosh)

**macOS (Homebrew):**
```bash
brew install mongosh
```

**Linux:**
```bash
# Using official MongoDB repository
curl -fsSL https://pgp.mongodb.com/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] http://repo.mongodb.org/apt/debian bookworm/mongodb-org/7.0 main" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongosh
```

**Windows:**
```bash
# Using Chocolatey
choco install mongodb-shell

# Or download from: https://www.mongodb.com/try/download/shell
```

**Verify installation:**
```bash
mongosh --version
```

#### 2. Optional: Install MongoDB Database Tools (for import/export)

**macOS:**
```bash
brew install mongodb-database-tools
```

**Linux:**
```bash
sudo apt-get install -y mongodb-database-tools
```

**Windows:**
```bash
choco install mongodb-database-tools
```

#### 3. Ensure MongoDB Container is Running

```bash
# Check status
docker-compose ps | grep mongodb

# Start if not running
cd {baseDir} && docker-compose up -d mongodb

# View logs
docker logs -f mongodb
```

---

## Quick Start

### Access MongoDB Shell

```bash
# Interactive shell with authentication
mongosh --host localhost --port 27017 --username admin --password password --authenticationDatabase admin

# Or using connection string
mongosh "mongodb://admin:password@localhost:27017/fsa_claims_db?authSource=admin"
```

### Inside mongosh, use these commands:

```javascript
// Switch database
use fsa_claims_db

// Show all databases
show databases

// Show all collections
show collections
```

---

## CRUD Operations

### 1. CREATE - Insert Documents

#### Insert Single Document (via mongosh)

```bash
mongosh "mongodb://admin:password@localhost:27017/fsa_claims_db?authSource=admin" --eval '
db.credit_card_statements.insertOne({
  month: "2026-03",
  issuer: "Chase",
  cardLastFour: "1234",
  transactions: []
})
'
```

#### Insert Single Document (Interactive)

```bash
mongosh "mongodb://admin:password@localhost:27017/fsa_claims_db?authSource=admin"
```

Then inside mongosh:

```javascript
db.credit_card_statements.insertOne({
  month: "2026-03",
  issuer: "Chase",
  cardLastFour: "1234",
  transactions: []
})
```

**Output:**
```json
{
  "acknowledged": true,
  "insertedId": ObjectId("507f1f77bcf86cd799439011")
}
```

#### Insert Multiple Documents

```bash
mongosh "mongodb://admin:password@localhost:27017/fsa_claims_db?authSource=admin" --eval '
db.merchants.insertMany([
  {
    name: "CVS PHARMACY",
    fsa: true,
    dcfsa: false,
    category: "pharmacy"
  },
  {
    name: "WALGREENS",
    fsa: true,
    dcfsa: false,
    category: "pharmacy"
  },
  {
    name: "WHOLE FOODS",
    fsa: false,
    dcfsa: false,
    category: "groceries"
  }
])
'
```

Or interactively:

```javascript
db.merchants.insertMany([
  { name: "CVS PHARMACY", fsa: true, dcfsa: false, category: "pharmacy" },
  { name: "WALGREENS", fsa: true, dcfsa: false, category: "pharmacy" },
  { name: "WHOLE FOODS", fsa: false, dcfsa: false, category: "groceries" }
])
```

---

### 2. READ - Query Documents

#### Find All Documents

```bash
mongosh "mongodb://admin:password@localhost:27017/fsa_claims_db?authSource=admin" --eval '
db.credit_card_statements.find().pretty()
'
```

#### Find with Filter

```bash
mongosh "mongodb://admin:password@localhost:27017/fsa_claims_db?authSource=admin" --eval '
db.credit_card_statements.find({ month: "2026-03" }).pretty()
'
```

#### Find Single Document

```bash
mongosh "mongodb://admin:password@localhost:27017/fsa_claims_db?authSource=admin" --eval '
db.credit_card_statements.findOne({ issuer: "Chase" })
'
```

#### Find with Projection (Select Specific Fields)

```bash
mongosh "mongodb://admin:password@localhost:27017/fsa_claims_db?authSource=admin" --eval '
db.credit_card_statements.find(
  { month: "2026-03" },
  { month: 1, issuer: 1, transactions: 1, _id: 0 }
).pretty()
'
```

#### Find with Sorting and Limiting

```bash
mongosh "mongodb://admin:password@localhost:27017/fsa_claims_db?authSource=admin" --eval '
db.credit_card_statements.find()
  .sort({ month: -1 })
  .limit(10)
  .pretty()
'
```

#### Find with Complex Queries

```bash
# Find transactions with amount > 100
mongosh "mongodb://admin:password@localhost:27017/fsa_claims_db?authSource=admin" --eval '
db.transactions.find({ amount: { $gt: 100 } }).pretty()
'

# Find FSA-eligible items
mongosh "mongodb://admin:password@localhost:27017/fsa_claims_db?authSource=admin" --eval '
db.transactions.find({
  eligible: true,
  benefitAccount: "FSA"
}).pretty()
'

# Find items requiring manual review
mongosh "mongodb://admin:password@localhost:27017/fsa_claims_db?authSource=admin" --eval '
db.transactions.find({ requiresManualReview: true }).pretty()
'
```

#### Count Documents

```bash
mongosh "mongodb://admin:password@localhost:27017/fsa_claims_db?authSource=admin" --eval '
db.credit_card_statements.countDocuments({ month: "2026-03" })
'
```

**Output:**
```
3
```

---

### 3. UPDATE - Modify Documents

#### Update Single Document

```bash
mongosh "mongodb://admin:password@localhost:27017/fsa_claims_db?authSource=admin" --eval '
db.credit_card_statements.updateOne(
  { _id: ObjectId("507f1f77bcf86cd799439011") },
  { $set: { processed: true, processedAt: new Date("2026-03-21T10:30:00Z") } }
)
'
```

#### Update Multiple Documents

```bash
mongosh "mongodb://admin:password@localhost:27017/fsa_claims_db?authSource=admin" --eval '
db.transactions.updateMany(
  { month: "2026-03", eligible: null },
  { $set: { eligibilityStatus: "pending" } }
)
'
```

#### Increment a Field

```bash
mongosh "mongodb://admin:password@localhost:27017/fsa_claims_db?authSource=admin" --eval '
db.transactions.updateOne(
  { _id: ObjectId("507f1f77bcf86cd799439011") },
  { $inc: { confidence: 0.1 } }
)
'
```

#### Add Item to Array

```bash
mongosh "mongodb://admin:password@localhost:27017/fsa_claims_db?authSource=admin" --eval '
db.credit_card_statements.updateOne(
  { month: "2026-03", issuer: "Chase" },
  { $push: { transactions: { date: "2026-03-21", merchant: "CVS", amount: 50 } } }
)
'
```

#### Replace Entire Document

```bash
mongosh "mongodb://admin:password@localhost:27017/fsa_claims_db?authSource=admin" --eval '
db.merchants.replaceOne(
  { name: "CVS PHARMACY" },
  { name: "CVS PHARMACY", fsa: true, dcfsa: false, category: "pharmacy", confidence: 0.95 }
)
'
```

---

### 4. DELETE - Remove Documents

#### Delete Single Document

```bash
mongosh "mongodb://admin:password@localhost:27017/fsa_claims_db?authSource=admin" --eval '
db.merchants.deleteOne({ name: "INVALID_MERCHANT" })
'
```

#### Delete Multiple Documents

```bash
mongosh "mongodb://admin:password@localhost:27017/fsa_claims_db?authSource=admin" --eval '
db.transactions.deleteMany({ month: "2026-02", processed: false })
'
```

#### Delete All Documents in Collection

```bash
mongosh "mongodb://admin:password@localhost:27017/fsa_claims_db?authSource=admin" --eval '
db.temp_data.deleteMany({})
'
```

---

## Advanced Operations

### Aggregation Pipeline

```bash
# Total eligible amount by benefit account
mongosh "mongodb://admin:password@localhost:27017/fsa_claims_db?authSource=admin" --eval '
db.transactions.aggregate([
  { $match: { month: "2026-03", eligible: true } },
  { $group: { 
    _id: "$benefitAccount", 
    total: { $sum: "$amount" }, 
    count: { $sum: 1 } 
  } },
  { $sort: { total: -1 } }
]).pretty()
'
```

### Distinct Values

```bash
# Find all unique merchants
mongosh "mongodb://admin:password@localhost:27017/fsa_claims_db?authSource=admin" --eval '
db.transactions.distinct("merchant")
'
```

### Create Index

```bash
mongosh "mongodb://admin:password@localhost:27017/fsa_claims_db?authSource=admin" --eval '
db.transactions.createIndex({ month: 1, eligible: 1 })
'
```

---

## Database Management

### List Databases

```bash
mongosh "mongodb://admin:password@localhost:27017?authSource=admin" --eval '
show databases
'
```

Or use admin command:

```bash
mongosh "mongodb://admin:password@localhost:27017/admin?authSource=admin" --eval '
db.adminCommand({ listDatabases: 1 })
'
```

### List Collections

```bash
mongosh "mongodb://admin:password@localhost:27017/fsa_claims_db?authSource=admin" --eval '
show collections
'
```

Or:

```bash
mongosh "mongodb://admin:password@localhost:27017/fsa_claims_db?authSource=admin" --eval '
db.getCollectionNames()
'
```

### Drop Collection

```bash
mongosh "mongodb://admin:password@localhost:27017/fsa_claims_db?authSource=admin" --eval '
db.temp_data.drop()
'
```

### Drop Database

```bash
mongosh "mongodb://admin:password@localhost:27017/fsa_claims_db?authSource=admin" --eval '
db.dropDatabase()
'
```

---

## Connection Management

### Check Connection Status

```bash
mongosh "mongodb://admin:password@localhost:27017?authSource=admin" --eval '
db.adminCommand({ ping: 1 })
'
```

### Get Server Info

```bash
mongosh "mongodb://admin:password@localhost:27017/admin?authSource=admin" --eval '
db.serverStatus()
'
```

---

## Import/Export Data

### Export Collection to JSON

```bash
mongoexport \
  --host localhost:27017 \
  --username admin \
  --password password \
  --authenticationDatabase admin \
  --db fsa_claims_db \
  --collection transactions \
  --out transactions-2026-03.json
```

### Import from JSON

```bash
mongoimport \
  --host localhost:27017 \
  --username admin \
  --password password \
  --authenticationDatabase admin \
  --db fsa_claims_db \
  --collection transactions \
  --file transactions-2026-03.json \
  --jsonArray
```

### Export Collection to CSV

```bash
mongoexport \
  --host localhost:27017 \
  --username admin \
  --password password \
  --authenticationDatabase admin \
  --db fsa_claims_db \
  --collection transactions \
  --type=csv \
  --fields "date,merchant,amount,eligible" \
  --out transactions.csv
```

---

## Query Syntax Reference

### Basic Filters

```javascript
// Equality
{ field: value }

// Greater than / Less than
{ amount: { $gt: 100 } }        // Greater than
{ amount: { $gte: 100 } }       // Greater than or equal
{ amount: { $lt: 50 } }         // Less than
{ amount: { $lte: 50 } }        // Less than or equal
{ amount: { $ne: 0 } }          // Not equal

// IN / NIN
{ status: { $in: ["FSA", "DCFSA"] } }
{ month: { $nin: ["2026-01", "2026-02"] } }

// AND / OR
{ $and: [{ month: "2026-03" }, { eligible: true }] }
{ $or: [{ benefitAccount: "FSA" }, { benefitAccount: "DCFSA" }] }

// Text search (if text index exists)
{ $text: { $search: "prescription" } }

// Regex
{ merchant: { $regex: "CVS|WALGREENS" } }
{ merchant: { $regex: "^CVS" } }        // Starts with
```

### Projection (Field Selection)

```javascript
// Include specific fields
{ month: 1, issuer: 1 }
{ month: 1, issuer: 1, _id: 0 }      // Exclude _id

// Exclude specific fields
{ password: 0, secret: 0 }
```

### Sorting

```javascript
// Sort ascending
.sort({ month: 1 })

// Sort descending
.sort({ amount: -1 })

// Multiple fields
.sort({ month: 1, amount: -1 })
```

---

## Real-World Examples

### Example 1: FSA Claims Summary

```bash
mongosh "mongodb://admin:password@localhost:27017/fsa_claims_db?authSource=admin" --eval '
db.transactions.aggregate([
  { $match: { eligible: true, benefitAccount: "FSA" } },
  { $group: {
    _id: "$month",
    totalAmount: { $sum: "$amount" },
    itemCount: { $sum: 1 },
    avgAmount: { $avg: "$amount" }
  } },
  { $sort: { _id: 1 } }
]).pretty()
'
```

### Example 2: Find Manual Review Items

```bash
mongosh "mongodb://admin:password@localhost:27017/fsa_claims_db?authSource=admin" --eval '
db.transactions.find(
  { requiresManualReview: true },
  { date: 1, merchant: 1, amount: 1, description: 1, confidence: 1 }
).sort({ confidence: 1 }).limit(20).pretty()
'
```

### Example 3: Update Month Status

```bash
mongosh "mongodb://admin:password@localhost:27017/fsa_claims_db?authSource=admin" --eval '
db.credit_card_statements.updateMany(
  { month: "2026-03" },
  { $set: { 
    status: "processed", 
    processedAt: new Date("2026-03-21T10:30:00Z"), 
    processedBy: "system" 
  } }
)
'
```

### Example 4: Archive Old Transactions

```bash
mongosh "mongodb://admin:password@localhost:27017/fsa_claims_db?authSource=admin" --eval '
db.transactions.deleteMany({ date: { $lt: ISODate("2025-12-21") } })
'
```

### Example 5: Backup Collection to JSON

```bash
mongoexport \
  --host localhost:27017 \
  --username admin \
  --password password \
  --authenticationDatabase admin \
  --db fsa_claims_db \
  --collection transactions \
  --out ~/backups/transactions-2026-03.json
```

---

## Environment Variables

You can set these to avoid repeating connection details:

```bash
export MONGO_HOST=localhost
export MONGO_PORT=27017
export MONGO_USER=admin
export MONGO_PASSWORD=password
export MONGO_AUTH_DB=admin
export MONGO_DEFAULT_DATABASE=fsa_claims_db
```

Then create an alias for convenience:

```bash
alias mongosh_fsa='mongosh "mongodb://${MONGO_USER}:${MONGO_PASSWORD}@${MONGO_HOST}:${MONGO_PORT}/${MONGO_DEFAULT_DATABASE}"'

# Usage
mongosh_fsa --eval 'db.merchants.find().pretty()'
```

---

## Error Handling

### Common Errors & Solutions

**Error: connect ECONNREFUSED 127.0.0.1:27017**
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```
Solution: Start MongoDB container
```bash
cd {baseDir} && docker-compose up -d mongodb
```

**Error: Authentication failed**
```
Error: authentication failed
```
Solution: Check credentials and authenticationDatabase
```bash
docker-compose logs mongodb | grep -i auth
```

**Error: Invalid connection string**
```
Error: Invalid connection string
```
Solution: Ensure connection string format is correct
```bash
# Correct format
mongodb://username:password@host:port/database
```

---

## Performance Tips

1. **Create Indexes** for frequently queried fields:
   ```bash
   mongosh "mongodb://admin:password@localhost:27017/fsa_claims_db?authSource=admin" --eval '
   db.transactions.createIndex({ month: 1, eligible: 1 })
   '
   ```

2. **Use Projection** to reduce data transfer:
   ```bash
   db.transactions.find(
     { month: "2026-03" },
     { merchant: 1, amount: 1 }
   )
   ```

3. **Limit Results** for large result sets:
   ```javascript
   db.transactions.find().limit(100)
   ```

4. **Use Aggregation** for complex queries:
   ```javascript
   db.transactions.aggregate([...])  // More efficient
   ```

5. **Batch Operations** for bulk writes:
   ```javascript
   db.transactions.insertMany([...])  // Faster than multiple inserts
   ```

---

## Docker Integration

### Run commands in MongoDB container

```bash
# Interactive shell via docker
docker exec -it mongodb mongosh --username admin --password password

# Execute single command
docker exec mongodb mongosh --username admin --password password --authenticationDatabase admin --eval 'db.adminCommand({ping:1})'
```

### View MongoDB logs

```bash
docker logs mongodb

# Follow logs in real time
docker logs -f mongodb

# Filter logs
docker logs mongodb | grep -i error
```

---

## Related Skills

- **qdrant-local**: Vector database for semantic search
- **ollama-local**: Embeddings generation
- **fsa-dcfsa-claims-automation**: Uses this skill for data storage
- **forma-help-center**: Populates MongoDB with eligibility data

---

## Additional Resources

- [MongoDB Shell (mongosh) Documentation](https://www.mongodb.com/docs/mongodb-shell/)
- [MongoDB Query Language](https://www.mongodb.com/docs/manual/reference/method/)
- [MongoDB Aggregation Pipeline](https://www.mongodb.com/docs/manual/aggregation/)
- [MongoDB Indexing](https://www.mongodb.com/docs/manual/indexes/)
