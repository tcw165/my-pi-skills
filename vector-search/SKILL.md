---
name: vector-search
description: End-to-end vector search workflow. Generate embeddings from text via Ollama and query similar vectors in Qdrant. Complete semantic search pipeline from prompt to results.
---

# Vector Search

Semantic search pipeline: generate embeddings from text queries using Ollama, then search similar vectors in Qdrant.

## Prerequisites

- **Ollama** on `http://localhost:11434`
- **Qdrant** on `http://localhost:6333`
- **Node.js** (for `qdrant-cli`)

```bash
cd {baseDir} && docker-compose up -d ollama qdrant
```

## Setup

Run once before first use:

```bash
cd {baseDir}/vector-search/scripts
npm install
```

## `qdrant-cli` — scriptable search

`scripts/qdrant-cli` is an executable that wraps `npx tsx qdrant-cli.ts`. It handles embedding generation and Qdrant querying in one command, with stdout output designed for piping.

```bash
cd {baseDir}/vector-search/scripts

# Basic search
./qdrant-cli --search "FSA eligible pharmacy items"

# Different collection or result count
./qdrant-cli --search "DCFSA childcare" --collection forma_help_center --limit 20

# Save to file
./qdrant-cli --search "FSA DCFSA eligibility rules" > /tmp/rules.txt

# Pipe directly into another script
./qdrant-cli --search "FSA DCFSA eligibility" | npx tsx ../../fsa-dcfsa-claims-automation/scripts/score-transactions.ts --dry-run
```

Flags:
- `--search <query>` (required) — search query text
- `--collection <name>` (default: `forma_help_center`)
- `--limit <n>` (default: 10)

Env vars:
- `OLLAMA_URL` (default: `http://localhost:11434`)
- `QDRANT_URL` (default: `http://localhost:6333`)

---

## Manual Steps

1. **Create unique session ID** - Generates a nanosecond-based session identifier for this search workflow, ensuring isolated temp files for concurrent operations.

```bash
SESSION_ID=$(date +%s%N)
echo "Session ID: $SESSION_ID"
```

2. **Generate embedding** - Converts your search query into a 768-dimensional vector using Ollama's nomic-embed-text model. Saves to a session-specific file.

```bash
EMBEDDING_FILE="/tmp/query_embedding_${SESSION_ID}.json"
curl -s -X POST http://localhost:11434/api/embeddings \
  -H "Content-Type: application/json" \
  -d '{"model": "nomic-embed-text", "prompt": "Your search query here"}' \
  | jq '.embedding' > $EMBEDDING_FILE
```

Replace `"Your search query here"` with your actual search query. Output is a JSON array of 768 floats in `$EMBEDDING_FILE`.

3. **Create search request** - Prepares the Qdrant search body JSON with your embedding vector and search parameters (limit=10 results, include payloads).

```bash
SEARCH_BODY="/tmp/search_body_${SESSION_ID}.json"
jq -n --slurpfile vector $EMBEDDING_FILE \
  '{vector: $vector[0], limit: 10, with_payload: true}' > $SEARCH_BODY
```

Customize by changing `limit: 10` for different result counts, or adding `score_threshold: 0.5` to filter by minimum similarity.

4. **Search Qdrant collection** - Queries the forma_help_center collection using your embedding vector, returns top 10 most similar documents sorted by relevance score.

```bash
curl -s -X POST http://localhost:6333/collections/forma_help_center/points/search \
  -H "Content-Type: application/json" \
  -d @$SEARCH_BODY | jq '.result'
```

Returns array of results with `id`, `score` (0-1 similarity), and `payload` (metadata).

## Batch Search Multiple Queries

Search multiple queries in separate sessions:

```bash
#!/bin/bash

QUERIES=(
  "FSA eligible pharmacy items"
  "DCFSA childcare services"
  "medical deductible"
)

for query in "${QUERIES[@]}"; do
  # Step 1: Create session
  SESSION_ID=$(date +%s%N)
  EMBEDDING_FILE="/tmp/query_embedding_${SESSION_ID}.json"
  SEARCH_BODY="/tmp/search_body_${SESSION_ID}.json"
  
  echo "=== [$SESSION_ID] Searching: $query ==="
  
  # Step 2: Generate embedding
  curl -s -X POST http://localhost:11434/api/embeddings \
    -H "Content-Type: application/json" \
    -d "{\"model\": \"nomic-embed-text\", \"prompt\": \"$query\"}" \
    | jq '.embedding' > $EMBEDDING_FILE
  
  # Step 3: Create search request
  jq -n --slurpfile v $EMBEDDING_FILE \
    '{vector: $v[0], limit: 3, with_payload: true}' > $SEARCH_BODY
  
  # Step 4: Search
  curl -s -X POST "http://localhost:6333/collections/forma_help_center/points/search" \
    -H "Content-Type: application/json" \
    -d @$SEARCH_BODY | jq '.result[0] | "\(.score * 100 | round)% - \(.payload.article_title)"'
done
```

## Troubleshooting

**Connection refused on Ollama:**
```bash
cd {baseDir} && docker-compose ps ollama
docker-compose up -d ollama
```

**Collection not found on Qdrant:**
```bash
curl -s http://localhost:6333/collections | jq '.result.collections[].name'
```

**Vector dimension mismatch:**
```bash
# Check embedding size (should be 768 for nomic-embed-text)
curl -s -X POST http://localhost:11434/api/embeddings \
  -H "Content-Type: application/json" \
  -d '{"model": "nomic-embed-text", "prompt": "test"}' \
  | jq '.embedding | length'
```

## Related Skills

- **vector-ingest** - Create collections and add vectors
