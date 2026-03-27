---
name: vector-ingest
description: Vector database ingestion and management. Create Qdrant collections, upsert points with embeddings, manage payloads, and handle data lifecycle (update, delete, index).
---

# Vector Ingest

Manage vector collections in Qdrant: create collections, add/update vectors with embeddings, manage metadata payloads, and delete data.

## Prerequisites

- **Qdrant** on `http://localhost:6333`
- **Ollama** on `http://localhost:11434` (for generating embeddings)
```bash
cd {baseDir} && docker-compose up -d qdrant ollama
```

## Create Collection

1. **Create basic collection** - Creates a new Qdrant collection with 768-dimensional vectors using Cosine distance metric.

```bash
curl -X PUT http://localhost:6333/collections/my_collection \
  -H "Content-Type: application/json" \
  -d '{
    "vectors": {
      "size": 768,
      "distance": "Cosine"
    }
  }' | jq .
```

Customize by changing `size` for different embedding dimensions (384 for all-minilm, 1024 for mxbai-embed-large) or `distance` for different metrics (Euclidean, Manhattan, Dot).

2. **Verify collection created** - Lists all collections and their metadata.

```bash
curl -s http://localhost:6333/collections | jq '.result.collections'
```

3. **Get collection info** - Returns detailed stats for a specific collection.

```bash
curl -s http://localhost:6333/collections/my_collection | jq '
  .result | 
  {status, points_count, vectors_count, vector_size: .config.params.vectors.size}
'
```

## Upsert Points

1. **Generate embedding** - Creates a vector embedding using Ollama.

```bash
TEXT="Your document text here"
curl -s -X POST http://localhost:11434/api/embeddings \
  -H "Content-Type: application/json" \
  -d "{\"model\": \"nomic-embed-text\", \"prompt\": \"$TEXT\"}" \
  | jq '.embedding' > /tmp/embedding.json
```

2. **Prepare point with metadata** - Creates a point JSON with embedding and payload.

```bash
jq -n \
  --slurpfile vector /tmp/embedding.json \
  '{
    points: [
      {
        id: 1,
        vector: $vector[0],
        payload: {
          title: "Document Title",
          category: "medical",
          source_url: "https://example.com",
          created_at: "2026-03-22T00:00:00Z"
        }
      }
    ]
  }' > /tmp/point.json
```

Include any metadata you need for filtering/display in the `payload` object.

3. **Upsert point to collection** - Adds or updates the point in the collection.

```bash
curl -X PUT http://localhost:6333/collections/my_collection/points?wait=true \
  -H "Content-Type: application/json" \
  -d @/tmp/point.json | jq .
```

4. **Batch upsert multiple points** - Insert many points in one request for better performance.

```bash
#!/bin/bash

# Generate embeddings for multiple documents
DOCS=("doc1 text" "doc2 text" "doc3 text")
EMBEDDINGS=()

for i in "${!DOCS[@]}"; do
  curl -s -X POST http://localhost:11434/api/embeddings \
    -H "Content-Type: application/json" \
    -d "{\"model\": \"nomic-embed-text\", \"prompt\": \"${DOCS[$i]}\"}" \
    | jq '.embedding' > /tmp/embed_$i.json
done

# Create batch upsert JSON
jq -n \
  --slurpfile e0 /tmp/embed_0.json \
  --slurpfile e1 /tmp/embed_1.json \
  --slurpfile e2 /tmp/embed_2.json \
  '{
    points: [
      {id: 1, vector: $e0[0], payload: {title: "Doc 1", category: "medical"}},
      {id: 2, vector: $e1[0], payload: {title: "Doc 2", category: "pharmacy"}},
      {id: 3, vector: $e2[0], payload: {title: "Doc 3", category: "childcare"}}
    ]
  }' > /tmp/batch_points.json

curl -X PUT http://localhost:6333/collections/my_collection/points?wait=true \
  -H "Content-Type: application/json" \
  -d @/tmp/batch_points.json | jq .
```

Batch operations are 10x-100x faster than individual upserts.

## Query Points

1. **Get specific point by ID** - Retrieves a single point and its metadata.

```bash
curl -s -X POST http://localhost:6333/collections/my_collection/points/1 \
  -H "Content-Type: application/json" | jq '.result'
```

2. **Get multiple points by IDs** - Retrieves several points at once.

```bash
curl -s -X POST http://localhost:6333/collections/my_collection/points \
  -H "Content-Type: application/json" \
  -d '{"ids": [1, 2, 3], "with_payload": true, "with_vectors": false}' \
  | jq '.result'
```

3. **List points with pagination** - Scrolls through collection points.

```bash
curl -s -X POST http://localhost:6333/collections/my_collection/points/scroll \
  -H "Content-Type: application/json" \
  -d '{"limit": 10, "with_payload": true, "with_vectors": false}' \
  | jq '.result'
```

4. **Query points by filter** - Finds points matching a filter condition.

```bash
curl -s -X POST http://localhost:6333/collections/my_collection/points/search \
  -H "Content-Type: application/json" \
  -d '{
    "filter": {
      "must": [{"key": "category", "match": {"value": "pharmacy"}}]
    },
    "limit": 10,
    "with_payload": true
  }' | jq '.result'
```

## Update Points

1. **Update payload only** - Modifies metadata without changing the vector.

```bash
curl -X PATCH http://localhost:6333/collections/my_collection/points \
  -H "Content-Type: application/json" \
  -d '{
    "points": [
      {
        "id": 1,
        "payload": {
          "category": "pharmacy",
          "verified": true,
          "updated_at": "2026-03-22T12:00:00Z"
        }
      }
    ]
  }' | jq .
```

2. **Replace entire point** - Updates both vector and payload.

```bash
# Generate new embedding
curl -s -X POST http://localhost:11434/api/embeddings \
  -H "Content-Type: application/json" \
  -d '{"model": "nomic-embed-text", "prompt": "updated content"}' \
  | jq '.embedding' > /tmp/new_embedding.json

# Replace point
jq -n \
  --slurpfile vector /tmp/new_embedding.json \
  '{
    points: [
      {
        id: 1,
        vector: $vector[0],
        payload: {title: "Updated", updated_at: "2026-03-22T12:00:00Z"}
      }
    ]
  }' > /tmp/updated_point.json

curl -X PUT http://localhost:6333/collections/my_collection/points?wait=true \
  -H "Content-Type: application/json" \
  -d @/tmp/updated_point.json | jq .
```

## Delete Points

1. **Delete single point by ID** - Removes a point from the collection.

```bash
curl -X POST http://localhost:6333/collections/my_collection/points/delete \
  -H "Content-Type: application/json" \
  -d '{"points_selector": {"ids": [1]}}' | jq .
```

2. **Delete multiple points** - Removes several points at once.

```bash
curl -X POST http://localhost:6333/collections/my_collection/points/delete \
  -H "Content-Type: application/json" \
  -d '{"points_selector": {"ids": [1, 2, 3, 4, 5]}}' | jq .
```

3. **Delete by filter** - Removes all points matching a condition.

```bash
curl -X POST http://localhost:6333/collections/my_collection/points/delete \
  -H "Content-Type: application/json" \
  -d '{
    "points_selector": {
      "filter": {
        "must": [{"key": "category", "match": {"value": "old_data"}}]
      }
    }
  }' | jq .
```

4. **Delete entire collection** - Removes the collection and all its points.

```bash
curl -X DELETE http://localhost:6333/collections/my_collection | jq .
```

## Create Indexes

1. **Create payload index** - Adds an index to a field for faster filtering.

```bash
curl -X PUT http://localhost:6333/collections/my_collection/index \
  -H "Content-Type: application/json" \
  -d '{"field_name": "category", "field_schema": "Keyword"}' | jq .
```

Index frequently-filtered fields like `category`, `source`, `document_type` for performance improvement.

2. **List collection indexes** - Shows all indexes on the collection.

```bash
curl -s http://localhost:6333/collections/my_collection | jq '.result.indexes'
```

## Payload Best Practices

Store only necessary metadata in payloads:

```json
{
  "title": "Essential for display",
  "category": "For filtering",
  "source_url": "For reference",
  "created_at": "For tracking",
  "verified": true
}
```

Use consistent field names:
- ✅ `created_at`, `updated_at`, `source_url`
- ✅ `article_id`, `transaction_id`, `product_id`
- ✅ `category`, `subcategory`, `tags`

## Troubleshooting

**Collection already exists:**
```bash
curl -s http://localhost:6333/collections/my_collection | jq '.status'
# Delete and recreate if needed
curl -X DELETE http://localhost:6333/collections/my_collection
```

**Vector dimension mismatch:**
```bash
# Check expected dimensions
curl -s http://localhost:6333/collections/my_collection \
  | jq '.result.config.params.vectors.size'

# Verify embedding size (should match)
curl -s -X POST http://localhost:11434/api/embeddings \
  -H "Content-Type: application/json" \
  -d '{"model": "nomic-embed-text", "prompt": "test"}' \
  | jq '.embedding | length'
```

**Slow upsert performance:**
Use batch upsert (Step 4) instead of individual points. Much faster for large datasets.

## Related Skills

- **vector-search** - Search and query vectors using embeddings
