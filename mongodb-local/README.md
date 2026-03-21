# MongoDB Local Skill

Quick reference for CRUD operations on local MongoDB instance.

## Quick Start

### 1. Verify MongoDB is Running

```bash
docker-compose ps | grep mongodb

# If not running:
cd /Users/boyw165/Projects/my-pi-extension
docker-compose up -d mongodb
```

### 2. Check Connection

```bash
pi invoke mongodb-local operation:ping
```

Expected output:
```json
{
  "status": "connected",
  "host": "localhost",
  "port": 27017
}
```

---

## CRUD Operations at a Glance

### CREATE (Insert)

```bash
# Single document
pi invoke mongodb-local \
  operation:insert \
  database:fsa_claims_db \
  collection:transactions \
  document:'{"date":"2026-03-21","merchant":"CVS","amount":50}'

# Multiple documents
pi invoke mongodb-local \
  operation:insertMany \
  database:fsa_claims_db \
  collection:merchants \
  documents:'[{"name":"CVS","eligible":true}]'
```

### READ (Query)

```bash
# Find all documents
pi invoke mongodb-local \
  operation:find \
  database:fsa_claims_db \
  collection:transactions

# Find with filter
pi invoke mongodb-local \
  operation:find \
  database:fsa_claims_db \
  collection:transactions \
  filter:'{"month":"2026-03"}'

# Find single document
pi invoke mongodb-local \
  operation:findOne \
  database:fsa_claims_db \
  collection:transactions \
  filter:'{"merchant":"CVS"}'

# Count documents
pi invoke mongodb-local \
  operation:count \
  database:fsa_claims_db \
  collection:transactions \
  filter:'{"eligible":true}'
```

### UPDATE (Modify)

```bash
# Update single document
pi invoke mongodb-local \
  operation:updateOne \
  database:fsa_claims_db \
  collection:transactions \
  filter:'{"merchant":"CVS"}' \
  update:'{"$set":{"eligible":true,"confidence":0.95}}'

# Update multiple documents
pi invoke mongodb-local \
  operation:updateMany \
  database:fsa_claims_db \
  collection:transactions \
  filter:'{"month":"2026-03"}' \
  update:'{"$set":{"processed":true}}'

# Increment a field
pi invoke mongodb-local \
  operation:updateOne \
  database:fsa_claims_db \
  collection:transactions \
  filter:'{"_id":"..."}' \
  update:'{"$inc":{"confidence":0.1}}'

# Add to array
pi invoke mongodb-local \
  operation:updateOne \
  database:fsa_claims_db \
  collection:statements \
  filter:'{"month":"2026-03"}' \
  update:'{"$push":{"transactions":{"date":"2026-03-21","amount":50}}}'
```

### DELETE (Remove)

```bash
# Delete single document
pi invoke mongodb-local \
  operation:deleteOne \
  database:fsa_claims_db \
  collection:merchants \
  filter:'{"name":"INVALID"}'

# Delete multiple documents
pi invoke mongodb-local \
  operation:deleteMany \
  database:fsa_claims_db \
  collection:transactions \
  filter:'{"eligible":false}'

# Delete all (empty collection)
pi invoke mongodb-local \
  operation:deleteMany \
  database:fsa_claims_db \
  collection:temp \
  filter:'{}'
```

---

## Common Filters

```bash
# Equality
filter:'{"month":"2026-03"}'

# Comparison
filter:'{"amount":{"$gt":100}}'         # Greater than
filter:'{"amount":{"$gte":100}}'        # Greater than or equal
filter:'{"amount":{"$lt":50}}'          # Less than
filter:'{"amount":{"$lte":50}}'         # Less than or equal
filter:'{"amount":{"$ne":0}}'           # Not equal

# IN / NOT IN
filter:'{"status":{"$in":["FSA","DCFSA"]}}'
filter:'{"month":{"$nin":["2026-01","2026-02"]}}'

# AND / OR
filter:'{"$and":[{"month":"2026-03"},{"eligible":true}]}'
filter:'{"$or":[{"benefitAccount":"FSA"},{"benefitAccount":"DCFSA"}]}'

# Exists
filter:'{"receiptPath":{"$exists":true}}'

# Text search (regex)
filter:'{"merchant":{"$regex":"CVS|WALGREENS"}}'
```

---

## Query Options

```bash
# Sort results
sort:'{"month":1}'           # Ascending
sort:'{"amount":-1}'         # Descending
sort:'{"month":1,"amount":-1}'  # Multiple fields

# Limit results
limit:10

# Skip results (pagination)
skip:20

# Select specific fields
projection:'{"month":1,"amount":1,"_id":0}'

# Find one (returns single document)
operation:findOne
```

---

## Aggregation Pipeline

Perform complex multi-stage operations:

```bash
# Total by category
pi invoke mongodb-local \
  operation:aggregate \
  database:fsa_claims_db \
  collection:transactions \
  pipeline:'[
    {"$match":{"month":"2026-03","eligible":true}},
    {"$group":{"_id":"$benefitAccount","total":{"$sum":"$amount"}}},
    {"$sort":{"total":-1}}
  ]'
```

Common pipeline stages:
- `$match` - Filter documents
- `$group` - Group and aggregate
- `$sort` - Sort results
- `$limit` - Limit results
- `$skip` - Skip documents
- `$project` - Select/compute fields
- `$unwind` - Unwind arrays
- `$lookup` - Join with other collections

---

## Database Operations

```bash
# List all databases
pi invoke mongodb-local operation:listDatabases

# List collections in database
pi invoke mongodb-local \
  operation:listCollections \
  database:fsa_claims_db

# Drop collection
pi invoke mongodb-local \
  operation:dropCollection \
  database:fsa_claims_db \
  collection:temp_data

# Drop database
pi invoke mongodb-local \
  operation:dropDatabase \
  database:temp_db
```

---

## Real-World Examples

### Monthly FSA Summary

```bash
# Total eligible amount by benefit account
pi invoke mongodb-local \
  operation:aggregate \
  database:fsa_claims_db \
  collection:transactions \
  pipeline:'[
    {"$match":{"month":"2026-03","eligible":true}},
    {"$group":{
      "_id":"$benefitAccount",
      "totalAmount":{"$sum":"$amount"},
      "itemCount":{"$sum":1}
    }},
    {"$sort":{"totalAmount":-1}}
  ]'
```

### Find Items Needing Manual Review

```bash
pi invoke mongodb-local \
  operation:find \
  database:fsa_claims_db \
  collection:transactions \
  filter:'{"requiresManualReview":true}' \
  projection:'{"date":1,"merchant":1,"amount":1,"confidence":1}' \
  sort:'{"confidence":1}'
```

### Update Processing Status

```bash
pi invoke mongodb-local \
  operation:updateMany \
  database:fsa_claims_db \
  collection:credit_card_statements \
  filter:'{"month":"2026-03"}' \
  update:'{"$set":{"status":"processed","processedAt":new Date()}}'
```

### Find Eligible Items by Category

```bash
pi invoke mongodb-local \
  operation:find \
  database:fsa_claims_db \
  collection:transactions \
  filter:'{"eligible":true,"benefitAccount":"FSA"}' \
  sort:'{"category":1,"amount":-1}'
```

### Count by Status

```bash
pi invoke mongodb-local \
  operation:find \
  database:fsa_claims_db \
  collection:transactions \
  filter:'{"month":"2026-03"}' \
  distinct:true
```

---

## Connection Info

From `docker-compose.yml`:

| Setting | Value |
|---------|-------|
| Host | localhost |
| Port | 27017 |
| Username | admin |
| Password | password |
| Default Database | fsa_claims_db |
| Container Name | mongodb |
| Network | vector-db |

---

## Direct MongoDB Access

Connect directly using mongosh:

```bash
# Open MongoDB shell
docker exec -it mongodb mongosh -u admin -p password

# Inside mongosh:
use fsa_claims_db

# Find all transactions
db.transactions.find()

# Find with filter
db.transactions.find({month: "2026-03", eligible: true})

# Count
db.transactions.countDocuments({month: "2026-03"})

# Update
db.transactions.updateMany(
  {month: "2026-03"},
  {$set: {reviewed: true}}
)

# Aggregation
db.transactions.aggregate([
  {$match: {month: "2026-03", eligible: true}},
  {$group: {_id: "$benefitAccount", total: {$sum: "$amount"}}}
])

# Exit
exit
```

---

## Troubleshooting

### MongoDB Not Running
```bash
docker-compose up -d mongodb
```

### Connection Refused
```bash
# Check logs
docker logs mongodb

# Restart container
docker-compose restart mongodb
```

### Authentication Failed
```bash
# Verify credentials in docker-compose.yml
cat /Users/boyw165/Projects/my-pi-extension/docker-compose.yml | grep -A5 "mongodb:"

# Connect with correct credentials
docker exec -it mongodb mongosh -u admin -p password
```

### Database Not Found
MongoDB creates databases on first write, or list existing:
```bash
pi invoke mongodb-local operation:listDatabases
```

### Performance Issues
```bash
# Check MongoDB stats
docker exec -it mongodb mongosh -u admin -p password
use admin
db.stats()
db.fsa_claims_db.stats()
```

---

## Data Types

MongoDB supports:
- String: `"text"`
- Number: `123` or `45.67`
- Boolean: `true` or `false`
- Date: `"2026-03-21T10:30:00Z"` (ISO 8601)
- Null: `null`
- Array: `[1, 2, 3]`
- Object: `{field: value}`
- ObjectId: `ObjectId("...")`

---

## Tips & Best Practices

1. **Always backup important data**
   ```bash
   docker exec mongodb mongodump --username admin --password password --out /backup
   ```

2. **Use indexes for frequently queried fields**
   ```bash
   pi invoke mongodb-local \
     operation:createIndex \
     database:fsa_claims_db \
     collection:transactions \
     index:'{"month":1,"eligible":1}'
   ```

3. **Validate JSON filters** before using
   ```bash
   echo '{"month":"2026-03"}' | jq .
   ```

4. **Use projection** to reduce data transfer
   ```bash
   projection:'{"month":1,"amount":1}'
   ```

5. **Batch operations** for bulk changes
   ```bash
   operation:insertMany   # Instead of multiple insertOne
   operation:updateMany   # Instead of multiple updateOne
   ```

---

## Reference

For detailed documentation, see `SKILL.md`

For usage with FSA/DCFSA claims, see `fsa-dcfsa-claims-automation` skill
