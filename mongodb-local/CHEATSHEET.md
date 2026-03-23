# MongoDB Local - Quick Cheatsheet

## Connection

```bash
# Verify running
docker-compose ps | grep mongodb

# Check status
pi invoke mongodb-local operation:ping
```

**Default Credentials:**
- Host: `localhost:27017`
- User: `admin`
- Password: `password`
- Database: `fsa_claims_db`

---

## CREATE

| Operation | Command |
|-----------|---------|
| Insert one | `operation:insert` |
| Insert many | `operation:insertMany` |

**Example:**
```bash
pi invoke mongodb-local operation:insert \
  database:fsa_claims_db collection:transactions \
  document:'{"merchant":"CVS","amount":50}'
```

---

## READ

| Operation | Command |
|-----------|---------|
| Find all | `operation:find` |
| Find one | `operation:findOne` |
| Count | `operation:count` |
| Distinct | `operation:distinct` |
| Aggregate | `operation:aggregate` |

**Examples:**
```bash
# Find all
pi invoke mongodb-local operation:find \
  database:fsa_claims_db collection:transactions

# Find with filter
pi invoke mongodb-local operation:find \
  database:fsa_claims_db collection:transactions \
  filter:'{"month":"2026-03"}'

# Count
pi invoke mongodb-local operation:count \
  database:fsa_claims_db collection:transactions \
  filter:'{"eligible":true}'

# Aggregate
pi invoke mongodb-local operation:aggregate \
  database:fsa_claims_db collection:transactions \
  pipeline:'[{"$match":{"eligible":true}},{"$group":{"_id":"$benefitAccount","total":{"$sum":"$amount"}}}]'
```

---

## UPDATE

| Operation | Command |
|-----------|---------|
| Update one | `operation:updateOne` |
| Update many | `operation:updateMany` |
| Replace | `operation:replaceOne` |

**Examples:**
```bash
# Set field
pi invoke mongodb-local operation:updateOne \
  database:fsa_claims_db collection:transactions \
  filter:'{"_id":"..."}' \
  update:'{"$set":{"eligible":true}}'

# Increment field
pi invoke mongodb-local operation:updateOne \
  database:fsa_claims_db collection:transactions \
  filter:'{"_id":"..."}' \
  update:'{"$inc":{"confidence":0.1}}'

# Push to array
pi invoke mongodb-local operation:updateOne \
  database:fsa_claims_db collection:statements \
  filter:'{"month":"2026-03"}' \
  update:'{"$push":{"transactions":{"amount":50}}}'
```

---

## DELETE

| Operation | Command |
|-----------|---------|
| Delete one | `operation:deleteOne` |
| Delete many | `operation:deleteMany` |
| Drop collection | `operation:dropCollection` |
| Drop database | `operation:dropDatabase` |

**Examples:**
```bash
# Delete one
pi invoke mongodb-local operation:deleteOne \
  database:fsa_claims_db collection:merchants \
  filter:'{"name":"INVALID"}'

# Delete many
pi invoke mongodb-local operation:deleteMany \
  database:fsa_claims_db collection:transactions \
  filter:'{"month":"2026-02"}'

# Drop collection
pi invoke mongodb-local operation:dropCollection \
  database:fsa_claims_db collection:temp
```

---

## Filter Operators

```bash
# Equality
{"field": value}

# Comparison
{"field": {"$gt": 100}}      # >
{"field": {"$gte": 100}}     # >=
{"field": {"$lt": 50}}       # <
{"field": {"$lte": 50}}      # <=
{"field": {"$ne": 0}}        # !=

# IN / NIN
{"field": {"$in": [a, b]}}
{"field": {"$nin": [a, b]}}

# AND / OR
{"$and": [{a: 1}, {b: 2}]}
{"$or": [{a: 1}, {b: 2}]}

# Exists
{"field": {"$exists": true}}

# Regex
{"field": {"$regex": "pattern"}}
```

---

## Query Options

```bash
# Sort
sort:'{"field":1}'        # Ascending
sort:'{"field":-1}'       # Descending

# Limit
limit:10

# Skip (pagination)
skip:20

# Project (select fields)
projection:'{"field":1}'           # Include
projection:'{"field":1,"_id":0}'   # Exclude _id
```

---

## Aggregation Pipeline

```bash
pi invoke mongodb-local operation:aggregate \
  database:fsa_claims_db collection:transactions \
  pipeline:'[
    {"$match": {"month":"2026-03"}},           # Filter
    {"$group": {"_id":"$category","sum":{"$sum":"$amount"}}},  # Group
    {"$sort": {"sum":-1}}                      # Sort
  ]'
```

**Common Stages:**
- `$match` - Filter documents
- `$group` - Group & aggregate
- `$sort` - Sort
- `$limit` - Limit count
- `$skip` - Skip documents
- `$project` - Select fields
- `$unwind` - Unwind arrays

---

## Database Management

```bash
# List databases
pi invoke mongodb-local operation:listDatabases

# List collections
pi invoke mongodb-local operation:listCollections \
  database:fsa_claims_db

# Database stats
pi invoke mongodb-local operation:stats \
  database:fsa_claims_db

# Collection stats
pi invoke mongodb-local operation:stats \
  database:fsa_claims_db collection:transactions
```

---

## Update Operators

```bash
{"$set": {"field": value}}              # Set field
{"$unset": {"field": 1}}                # Remove field
{"$inc": {"field": 1}}                  # Increment
{"$dec": {"field": 1}}                  # Decrement
{"$push": {"array": value}}             # Add to array
{"$pull": {"array": value}}             # Remove from array
{"$addToSet": {"array": value}}         # Add unique to array
{"$pop": {"array": 1}}                  # Remove last from array
{"$rename": {"old": "new"}}             # Rename field
```

---

## Real-World Patterns

### Monthly Summary
```bash
pi invoke mongodb-local operation:aggregate \
  database:fsa_claims_db collection:transactions \
  pipeline:'[
    {"$match":{"month":"2026-03","eligible":true}},
    {"$group":{"_id":"$benefitAccount","total":{"$sum":"$amount"},"count":{"$sum":1}}}
  ]'
```

### Items Needing Review
```bash
pi invoke mongodb-local operation:find \
  database:fsa_claims_db collection:transactions \
  filter:'{"requiresManualReview":true}' \
  projection:'{"date":1,"merchant":1,"amount":1,"confidence":1}' \
  sort:'{"confidence":1}' \
  limit:20
```

### Mark as Processed
```bash
pi invoke mongodb-local operation:updateMany \
  database:fsa_claims_db collection:statements \
  filter:'{"month":"2026-03"}' \
  update:'{"$set":{"status":"processed","processedAt":"2026-03-21T10:00:00Z"}}'
```

### Export for Review
```bash
pi invoke mongodb-local operation:find \
  database:fsa_claims_db collection:transactions \
  filter:'{"month":"2026-03"}' \
  export:csv output:~/claims-2026-03.csv
```

---

## Direct MongoDB Access

```bash
# Open shell
docker exec -it mongodb mongosh -u admin -p password

# Inside mongosh
use fsa_claims_db
db.transactions.find()
db.transactions.find({month: "2026-03"})
db.transactions.countDocuments({eligible: true})
db.transactions.updateOne({_id: ObjectId("...")}, {$set: {eligible: true}})
db.transactions.deleteOne({_id: ObjectId("...")})
db.stats()
exit
```

---

## Common Issues

| Issue | Solution |
|-------|----------|
| Connection refused | `docker-compose up -d mongodb` |
| Auth failed | Check credentials in `docker-compose.yml` |
| Database not found | Create by inserting a document |
| Invalid JSON | Validate with `jq`: `echo '{}' \| jq .` |
| Slow query | Create index or use aggregation |
| Out of memory | Increase Docker memory limit |

---

## Tips

✅ **DO:**
- Batch insert/update for large datasets
- Use projection to reduce data transfer
- Create indexes for frequently queried fields
- Validate JSON filters before using
- Backup important data

❌ **DON'T:**
- Query huge result sets without limit
- Store large files in MongoDB
- Update without filter (accidental changes)
- Hardcode credentials (use env vars)
- Skip backups

---

## Reference

- Full docs: `SKILL.md`
- Quick start: `README.md`
- Related: `fsa-dcfsa-claims-automation` skill
- MongoDB docs: https://docs.mongodb.com/
