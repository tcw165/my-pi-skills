# Qdrant Local Skill

Interactive scripts for managing local Qdrant vector database.

## Quick Start

```bash
# Check server health
./qdrant-health.js

# List all collections
./qdrant-collections.js list

# Create a new collection
./qdrant-collections.js create my_docs 768 Cosine

# Get collection info
./qdrant-collections.js info forma_help_center

# Run comprehensive tests
./qdrant-test.js
```

## Scripts

### qdrant-health.js
Check server status and list collections with their statistics.

```bash
./qdrant-health.js
```

**Output:**
- Server health status
- Available collections and point counts
- Total statistics

### qdrant-collections.js
Manage collections (create, list, info, delete).

```bash
# List all collections
./qdrant-collections.js list

# Get collection info
./qdrant-collections.js info <name>

# Create collection
./qdrant-collections.js create <name> [vector_size] [distance]

# Delete collection
./qdrant-collections.js delete <name>
```

**Examples:**
```bash
./qdrant-collections.js list
./qdrant-collections.js info forma_help_center
./qdrant-collections.js create my_docs 768 Cosine
./qdrant-collections.js delete test_collection
```

### qdrant-search.js
Perform semantic search in a collection.

```bash
./qdrant-search.js <collection> <vector> [limit] [threshold]
```

**Arguments:**
- `collection`: Collection name
- `vector`: Vector as JSON array or path to JSON file
- `limit`: Max results (default: 5)
- `threshold`: Min similarity score (default: none)

**Examples:**
```bash
# Search with raw vector
./qdrant-search.js forma_help_center "[0.1,0.2,0.3,...,0.768]" 5

# Search from file
./qdrant-search.js forma_help_center embedding.json 10

# Search with threshold
./qdrant-search.js forma_help_center embedding.json 5 0.7
```

**Output:**
- Match count
- For each result: score, ID, article info, chunk preview

### qdrant-upsert.js
Add or update points in a collection.

```bash
./qdrant-upsert.js <collection> <points>
```

**Arguments:**
- `collection`: Collection name
- `points`: Points as JSON array or path to JSON file

**Point Format:**
```json
[
  {
    "id": 0,
    "vector": [0.1, 0.2, ..., 0.768],
    "payload": {
      "title": "Document title",
      "text": "Document content",
      "metadata": "optional fields"
    }
  }
]
```

**Examples:**
```bash
./qdrant-upsert.js forma_help_center points.json
./qdrant-upsert.js my_docs "[{\"id\": 0, \"vector\": [...], \"payload\": {...}}]"
```

### qdrant-test.js
Run comprehensive test suite for Qdrant operations.

```bash
./qdrant-test.js
```

**Tests:**
1. Health check
2. List collections
3. Create collection
4. Get collection info
5. Upsert points
6. Search points
7. Update point
8. Filter search
9. Delete points
10. Verify deletion
11. Delete collection

**Output:**
- Individual test results
- Success/failure counts
- Success rate percentage

## Environment Variables

Set custom Qdrant server details:

```bash
export QDRANT_HOST=localhost
export QDRANT_PORT=6333
```

Default values are `localhost:6333`.

## Common Workflows

### Workflow 1: Check System Health

```bash
./qdrant-health.js
```

Verifies server is running and shows collection statistics.

### Workflow 2: Create and Populate Collection

```bash
# Create collection
./qdrant-collections.js create my_docs 768 Cosine

# Add points
./qdrant-upsert.js my_docs points.json

# Verify
./qdrant-collections.js info my_docs
```

### Workflow 3: Semantic Search

```bash
# Generate embedding with Ollama
curl -X POST http://localhost:11434/api/embeddings \
  -H "Content-Type: application/json" \
  -d '{"model": "nomic-embed-text", "prompt": "search query"}' \
  | jq '.embedding' > embedding.json

# Search Qdrant
./qdrant-search.js forma_help_center embedding.json 5
```

### Workflow 4: Run Validation Tests

```bash
./qdrant-test.js
```

Comprehensive testing of all operations.

## Troubleshooting

### "Connection refused"
- Verify Qdrant is running: `docker-compose ps`
- Check port: `netstat -an | grep 6333`
- Restart: `docker-compose restart qdrant`

### "Collection not found"
- List collections: `./qdrant-collections.js list`
- Create if needed: `./qdrant-collections.js create my_collection`

### "Vector dimension mismatch"
- Check collection vector size: `./qdrant-collections.js info my_collection`
- Ensure embedding model output matches (nomic-embed-text = 768)

## Integration with Ollama

Generate embeddings and store in Qdrant:

```bash
# 1. Generate embedding
curl -X POST http://localhost:11434/api/embeddings \
  -H "Content-Type: application/json" \
  -d '{"model": "nomic-embed-text", "prompt": "text"}' \
  | jq '.embedding' > emb.json

# 2. Create points file
cat > points.json << 'EOF'
[{
  "id": 0,
  "vector": [0.1, 0.2, ..., 0.768],
  "payload": {
    "text": "Your text here",
    "source": "help_center"
  }
}]
EOF

# 3. Upsert to Qdrant
./qdrant-upsert.js my_collection points.json

# 4. Search
./qdrant-search.js my_collection emb.json 5
```

## API Reference

For low-level API calls, see the SKILL.md documentation:

- List collections: `GET /collections`
- Create collection: `PUT /collections/{name}`
- Get collection info: `GET /collections/{name}`
- Upsert points: `PUT /collections/{name}/points?wait=true`
- Search: `POST /collections/{name}/points/search`
- Delete points: `POST /collections/{name}/points/delete`
- Delete collection: `DELETE /collections/{name}`

## Performance Tips

- Keep payloads minimal (only store necessary metadata)
- Use batch upserts for multiple points
- Enable indexing for large collections
- Monitor memory with `docker stats qdrant`

---

**Server Configuration**: `/Users/boyw165/Projects/my-pi-extension/docker-compose.yml`

**Full Documentation**: See SKILL.md in this directory
