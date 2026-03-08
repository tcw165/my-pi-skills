---
name: qdrant-local
description: Interact with local Qdrant vector database. Includes collection management, point operations, semantic search, and testing utilities for vector storage and retrieval.
---

# Local Qdrant Vector Database

A skill for interacting with a local Qdrant vector database server. Supports collection management, semantic search, point operations, and vector database testing.

## Server Configuration

### Docker Compose Setup
The Qdrant server is configured in `/Users/boyw165/Projects/my-pi-extension/docker-compose.yml`

**Key Details:**
- **Container**: `qdrant`
- **Image**: `qdrant/qdrant:latest`
- **Port**: `6333` (REST API, exposed on localhost)
- **Port**: `6334` (gRPC, exposed on localhost)
- **Base URL**: `http://localhost:6333`
- **Volume**: `qdrant_data:/qdrant/storage` (persistent data storage)
- **Network**: `vector-db` (shared with Ollama and other services)
- **API Key**: Configured via `QDRANT_API_KEY` environment variable

### Starting/Stopping the Server

```bash
# Start the Qdrant container (from docker-compose directory)
docker-compose up -d qdrant

# Stop the Qdrant container
docker-compose down qdrant

# View Qdrant logs
docker-compose logs -f qdrant

# Verify Qdrant is running
curl http://localhost:6333/health
```

## API Endpoints

### 1. Server Health Check

```bash
# Check if Qdrant is running
curl http://localhost:6333/health

# Response example:
# {
#   "title": "qdrant-server",
#   "version": "1.7.0"
# }
```

### 2. List Collections

```bash
# Get list of all collections
curl http://localhost:6333/collections

# Response example:
# {
#   "result": {
#     "collections": [
#       {
#         "name": "forma_help_center",
#         "vectors_count": 5,
#         "points_count": 5
#       }
#     ]
#   },
#   "status": "ok"
# }
```

### 3. Create Collection

```bash
# Create a new collection with 768-dimensional vectors
curl -X PUT http://localhost:6333/collections/my_collection \
  -H "Content-Type: application/json" \
  -d '{
    "vectors": {
      "size": 768,
      "distance": "Cosine"
    }
  }'

# Response example:
# {
#   "result": true,
#   "status": "ok"
# }
```

### 4. Get Collection Info

```bash
# Get detailed information about a collection
curl http://localhost:6333/collections/forma_help_center

# Response example:
# {
#   "result": {
#     "status": "green",
#     "optimizer_status": "ok",
#     "points_count": 5,
#     "vectors_count": 5,
#     "segments_count": 2,
#     "config": {
#       "params": {
#         "vectors": {
#           "size": 768,
#           "distance": "Cosine"
#         },
#         "shard_number": 1
#       }
#     }
#   },
#   "status": "ok"
# }
```

### 5. Upsert Points

```bash
# Add or update points in a collection
curl -X PUT http://localhost:6333/collections/forma_help_center/points?wait=true \
  -H "Content-Type: application/json" \
  -d '{
    "points": [
      {
        "id": 0,
        "vector": [0.1, 0.2, 0.3, ...],
        "payload": {
          "title": "Example Document",
          "text": "Document content",
          "metadata": "additional info"
        }
      }
    ]
  }'
```

### 6. Search (Semantic Search)

```bash
# Search for similar vectors
curl -X POST http://localhost:6333/collections/forma_help_center/points/search \
  -H "Content-Type: application/json" \
  -d '{
    "vector": [0.1, 0.2, 0.3, ...],
    "limit": 5,
    "with_payload": true,
    "with_vectors": false
  }'

# Response example:
# {
#   "result": [
#     {
#       "id": 0,
#       "score": 0.95,
#       "payload": {
#         "title": "Example Document",
#         "text": "Document content"
#       }
#     }
#   ],
#   "status": "ok"
# }
```

### 7. Delete Collection

```bash
# Delete a collection
curl -X DELETE http://localhost:6333/collections/my_collection

# Response example:
# {
#   "result": true,
#   "status": "ok"
# }
```

### 8. Delete Points

```bash
# Delete specific points from a collection
curl -X POST http://localhost:6333/collections/forma_help_center/points/delete \
  -H "Content-Type: application/json" \
  -d '{
    "points_selector": {
      "ids": [0, 1, 2]
    }
  }'
```

## Distance Metrics

Qdrant supports several distance metrics:

| Metric | Description | Use Case |
|--------|-------------|----------|
| **Cosine** | Measures angle between vectors | Most common for embeddings |
| **Euclidean** | L2 distance | General purpose similarity |
| **Manhattan** | L1 distance | Fast approximate similarity |
| **Dot** | Dot product | For normalized vectors |

## Vector Sizes and Models

Common embedding dimensions:

| Model | Dimensions | Size | Provider |
|-------|-----------|------|----------|
| nomic-embed-text | 768 | 350MB | Ollama |
| mxbai-embed-large | 1024 | 670MB | Ollama |
| OpenAI Ada | 1536 | - | OpenAI |
| BERT Base | 768 | - | HuggingFace |

## Testing Qdrant Operations

### Prerequisites

Before testing, ensure:
1. Docker containers are running: `docker-compose up -d`
2. Qdrant is accessible: `curl http://localhost:6333/health`
3. Node.js is installed

### Basic Health Check

```bash
# Test Qdrant connectivity
curl -s http://localhost:6333/health | jq .

# Expected output should show server info
```

### Test Collection Creation

```bash
# Create test collection
curl -X PUT http://localhost:6333/collections/test_collection \
  -H "Content-Type: application/json" \
  -d '{"vectors": {"size": 768, "distance": "Cosine"}}'

# Verify it was created
curl -s http://localhost:6333/collections | jq .
```

### Node.js Collection Management Script

Create a test script for collection operations:

**File: `test-collections.js`**

```javascript
const http = require('http');

const QDRANT_HOST = 'localhost';
const QDRANT_PORT = 6333;

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    
    const options = {
      hostname: QDRANT_HOST,
      port: QDRANT_PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (payload) {
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response);
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function listCollections() {
  try {
    const result = await makeRequest('GET', '/collections');
    return result.result.collections;
  } catch (error) {
    throw new Error(`Failed to list collections: ${error.message}`);
  }
}

async function createCollection(name, vectorSize = 768) {
  try {
    const result = await makeRequest('PUT', `/collections/${name}`, {
      vectors: {
        size: vectorSize,
        distance: 'Cosine'
      }
    });
    return result;
  } catch (error) {
    throw new Error(`Failed to create collection: ${error.message}`);
  }
}

async function getCollectionInfo(name) {
  try {
    const result = await makeRequest('GET', `/collections/${name}`);
    return result.result;
  } catch (error) {
    throw new Error(`Failed to get collection info: ${error.message}`);
  }
}

async function deleteCollection(name) {
  try {
    const result = await makeRequest('DELETE', `/collections/${name}`);
    return result;
  } catch (error) {
    throw new Error(`Failed to delete collection: ${error.message}`);
  }
}

async function runTests() {
  console.log('🧪 Testing Qdrant Collection Management\n');

  try {
    // List existing collections
    console.log('📋 Listing collections...');
    const collections = await listCollections();
    console.log(`   Found ${collections.length} collection(s)`);
    collections.forEach(col => {
      console.log(`   - ${col.name} (${col.points_count} points)`);
    });
    console.log('');

    // Create test collection
    console.log('✏️  Creating test collection...');
    const createResult = await createCollection('test_vectors', 768);
    console.log(`   ✅ Created: test_vectors`);
    console.log('');

    // Get collection info
    console.log('📊 Getting collection info...');
    const info = await getCollectionInfo('test_vectors');
    console.log(`   Status: ${info.status}`);
    console.log(`   Vector size: ${info.config.params.vectors.size}`);
    console.log(`   Distance: ${info.config.params.vectors.distance}`);
    console.log(`   Points: ${info.points_count}`);
    console.log('');

    // Delete test collection
    console.log('🗑️  Deleting test collection...');
    await deleteCollection('test_vectors');
    console.log('   ✅ Deleted: test_vectors');
    console.log('');

    console.log('✨ All tests passed!');
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

runTests();
```

### Running Collection Tests

```bash
# Run collection management test
node test-collections.js

# Expected output:
# 🧪 Testing Qdrant Collection Management
# 
# 📋 Listing collections...
#    Found 1 collection(s)
#    - forma_help_center (5 points)
# 
# ✏️  Creating test collection...
#    ✅ Created: test_vectors
# ...
```

### Node.js Point Operations Script

Create a test script for point operations:

**File: `test-points.js`**

```javascript
const http = require('http');

const QDRANT_HOST = 'localhost';
const QDRANT_PORT = 6333;

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    
    const options = {
      hostname: QDRANT_HOST,
      port: QDRANT_PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (payload) {
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function upsertPoints(collection, points) {
  try {
    const result = await makeRequest('PUT', `/collections/${collection}/points?wait=true`, { points });
    return result;
  } catch (error) {
    throw new Error(`Failed to upsert points: ${error.message}`);
  }
}

async function searchPoints(collection, vector, limit = 5) {
  try {
    const result = await makeRequest('POST', `/collections/${collection}/points/search`, {
      vector: vector,
      limit: limit,
      with_payload: true
    });
    return result.result;
  } catch (error) {
    throw new Error(`Failed to search points: ${error.message}`);
  }
}

async function deletePoints(collection, ids) {
  try {
    const result = await makeRequest('POST', `/collections/${collection}/points/delete`, {
      points_selector: { ids: ids }
    });
    return result;
  } catch (error) {
    throw new Error(`Failed to delete points: ${error.message}`);
  }
}

function generateRandomVector(size) {
  return Array.from({ length: size }, () => Math.random());
}

async function runTests() {
  console.log('🧪 Testing Qdrant Point Operations\n');

  const COLLECTION = 'test_points';
  const VECTOR_SIZE = 768;

  try {
    // Create test collection
    console.log('✏️  Creating test collection...');
    await makeRequest('PUT', `/collections/${COLLECTION}`, {
      vectors: {
        size: VECTOR_SIZE,
        distance: 'Cosine'
      }
    });
    console.log('   ✅ Collection created\n');

    // Upsert test points
    console.log('📝 Upserting test points...');
    const points = [
      {
        id: 0,
        vector: generateRandomVector(VECTOR_SIZE),
        payload: {
          title: 'Document 1',
          category: 'health',
          text: 'This is a health-related document'
        }
      },
      {
        id: 1,
        vector: generateRandomVector(VECTOR_SIZE),
        payload: {
          title: 'Document 2',
          category: 'wellness',
          text: 'This is a wellness-related document'
        }
      },
      {
        id: 2,
        vector: generateRandomVector(VECTOR_SIZE),
        payload: {
          title: 'Document 3',
          category: 'health',
          text: 'Another health document'
        }
      }
    ];

    await upsertPoints(COLLECTION, points);
    console.log(`   ✅ Upserted ${points.length} points\n`);

    // Search for similar points
    console.log('🔍 Searching for similar points...');
    const queryVector = points[0].vector;
    const searchResults = await searchPoints(COLLECTION, queryVector, 3);
    console.log(`   Found ${searchResults.length} results:`);
    searchResults.forEach((result, idx) => {
      console.log(`   [${idx + 1}] Score: ${result.score.toFixed(4)}, Title: ${result.payload.title}`);
    });
    console.log('');

    // Delete specific points
    console.log('🗑️  Deleting points [1, 2]...');
    await deletePoints(COLLECTION, [1, 2]);
    console.log('   ✅ Points deleted\n');

    // Cleanup
    console.log('🧹 Cleaning up test collection...');
    await makeRequest('DELETE', `/collections/${COLLECTION}`);
    console.log('   ✅ Test collection deleted\n');

    console.log('✨ All point operation tests passed!');
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

runTests();
```

### Running Point Operation Tests

```bash
# Run point operations test
node test-points.js

# Expected output:
# 🧪 Testing Qdrant Point Operations
# 
# ✏️  Creating test collection...
#    ✅ Collection created
# 
# 📝 Upserting test points...
#    ✅ Upserted 3 points
# ...
```

### Node.js Semantic Search Script

Create a comprehensive search test:

**File: `test-semantic-search.js`**

```javascript
const http = require('http');

const QDRANT_HOST = 'localhost';
const QDRANT_PORT = 6333;

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    
    const options = {
      hostname: QDRANT_HOST,
      port: QDRANT_PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (payload) {
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function searchPoints(collection, vector, limit = 5) {
  try {
    const result = await makeRequest('POST', `/collections/${collection}/points/search`, {
      vector: vector,
      limit: limit,
      with_payload: true
    });
    return result.result;
  } catch (error) {
    throw new Error(`Failed to search: ${error.message}`);
  }
}

async function runTests() {
  console.log('🔍 Semantic Search Test\n');

  const COLLECTION = 'forma_help_center';

  try {
    // Simulate embedding from Ollama
    const queryEmbedding = Array.from({ length: 768 }, () => Math.random() * 2 - 1);

    console.log(`📚 Searching in collection: ${COLLECTION}`);
    console.log(`🔎 Query vector dimensions: ${queryEmbedding.length}\n`);

    const results = await searchPoints(COLLECTION, queryEmbedding, 5);

    console.log(`Results found: ${results.length}\n`);

    results.forEach((result, idx) => {
      console.log(`[${idx + 1}] Similarity Score: ${(result.score * 100).toFixed(2)}%`);
      console.log(`    Article: ${result.payload.article_title}`);
      console.log(`    Chunk: ${result.payload.chunk_index + 1}/${result.payload.total_chunks}`);
      console.log(`    Preview: ${result.payload.chunk_text.substring(0, 80)}...`);
      console.log('');
    });

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

runTests();
```

## Payload Management

Qdrant stores metadata in payloads. Best practices:

```json
{
  "id": 0,
  "vector": [...],
  "payload": {
    "source": "forma_help_center",
    "article_id": "dcfsa-123",
    "article_title": "DCFSA Eligible Services",
    "article_url": "https://...",
    "chunk_index": 0,
    "chunk_text": "Full text of chunk",
    "metadata": {
      "created_at": "2026-03-08T...",
      "updated_at": "2026-03-08T...",
      "category": "eligibility"
    }
  }
}
```

## Common Workflows

### Workflow 1: Check Server Status

```bash
# Verify Qdrant is operational
curl -s http://localhost:6333/health | jq .

# List all collections
curl -s http://localhost:6333/collections | jq '.result.collections'

# Get detailed stats
curl -s http://localhost:6333/collections | jq '.result.collections[] | {name, points_count}'
```

### Workflow 2: Create and Populate Collection

```bash
# 1. Create collection
curl -X PUT http://localhost:6333/collections/my_docs \
  -H "Content-Type: application/json" \
  -d '{"vectors": {"size": 768, "distance": "Cosine"}}'

# 2. Verify creation
curl -s http://localhost:6333/collections/my_docs | jq '.result | {points_count, status}'

# 3. Add points programmatically
node upsert-points.js
```

### Workflow 3: Semantic Search

```bash
# 1. Generate embedding for query (via Ollama)
# embedding = generateEmbedding("What is DCFSA?")

# 2. Search Qdrant
curl -X POST http://localhost:6333/collections/forma_help_center/points/search \
  -H "Content-Type: application/json" \
  -d '{
    "vector": [0.1, 0.2, ...],
    "limit": 5,
    "with_payload": true
  }'
```

## Performance Benchmarks

### Search Latency (nomic-embed-text 768-dim vectors)

| Collection Size | Latency (avg) | Memory Usage |
|---|---|---|
| 10 points | ~1-2ms | ~50MB |
| 100 points | ~2-3ms | ~100MB |
| 1,000 points | ~5-10ms | ~300MB |
| 10,000 points | ~20-50ms | ~1GB |

### Storage Size

| Metric | Size |
|--------|------|
| 1 vector (768-dim, float32) | ~3KB |
| 1 point with payload | ~4-5KB |
| 1,000 points | ~4-5MB |

## Troubleshooting

### Issue: Connection Refused (6333)

**Symptom**: `Error: connect ECONNREFUSED 127.0.0.1:6333`

**Solutions**:
1. Verify Docker containers are running: `docker-compose ps`
2. Check Qdrant logs: `docker-compose logs qdrant`
3. Verify port is correct: `netstat -an | grep 6333`
4. Restart Qdrant: `docker-compose restart qdrant`

### Issue: Collection Not Found

**Symptom**: `Error: Not found`

**Solutions**:
1. List available collections: `curl http://localhost:6333/collections`
2. Create collection if missing: Use create collection API
3. Check collection name spelling

### Issue: Vector Dimension Mismatch

**Symptom**: `Error: Invalid vector dimension`

**Solutions**:
1. Verify embedding model output size
2. Check collection vector config: `curl http://localhost:6333/collections/my_collection`
3. Recreate collection with correct dimensions if needed

### Issue: High Search Latency

**Symptom**: Search requests taking > 100ms

**Solutions**:
1. Check system resources: `docker stats qdrant`
2. Reduce vector dimensions if possible
3. Optimize payload size (store only necessary metadata)
4. Check Qdrant version for performance improvements

## Integration with Ollama

Combine Ollama embeddings with Qdrant storage:

```bash
# 1. Generate embedding with Ollama
curl -X POST http://localhost:11434/api/embeddings \
  -H "Content-Type: application/json" \
  -d '{"model": "nomic-embed-text", "prompt": "text to embed"}' \
  | jq '.embedding' > embedding.json

# 2. Store in Qdrant with embedding
curl -X PUT http://localhost:6333/collections/my_docs/points?wait=true \
  -H "Content-Type: application/json" \
  -d @points.json
```

## Quick Start

```bash
# 1. Start Docker containers
docker-compose up -d qdrant

# 2. Wait for Qdrant to be ready
sleep 3
curl http://localhost:6333/health

# 3. Create a test collection
curl -X PUT http://localhost:6333/collections/test \
  -H "Content-Type: application/json" \
  -d '{"vectors": {"size": 768, "distance": "Cosine"}}'

# 4. Verify collection was created
curl -s http://localhost:6333/collections | jq .

# 5. Run test script
node test-collections.js

# 6. Check results
echo "✅ Qdrant is ready!"
```

## Next Steps

1. **Test connectivity**: Run `curl http://localhost:6333/health`
2. **Create collections**: Use collection management scripts
3. **Populate with data**: Run upsert operations
4. **Test search**: Run semantic search tests
5. **Monitor performance**: Check logs and metrics
6. **Integrate with Ollama**: Combine embeddings and vector search

---
