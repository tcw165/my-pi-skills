---
name: ollama-local
description: Interact with local Ollama server running in Docker. Includes embeddings generation, model management, and testing utilities for vector database integration.
---

# Local Ollama Server

A skill for interacting with a local Ollama server running in Docker. This skill supports embeddings generation, model management, testing, and integration with vector databases like Qdrant.

## Server Configuration

### Docker Compose Setup
The Ollama server is configured in `/Users/boyw165/Projects/my-pi-extension/docker-compose.yml`

**Key Details:**
- **Container**: `ollama`
- **Image**: `ollama/ollama:latest`
- **Port**: `11434` (exposed on localhost)
- **Base URL**: `http://localhost:11434`
- **Volume**: `ollama_data:/root/.ollama` (persistent model storage)
- **Network**: `vector-db` (shared with Qdrant and other services)
- **Host**: `0.0.0.0:11434`

### Starting/Stopping the Server

```bash
# Start the Ollama container (from docker-compose directory)
docker-compose up -d ollama

# Stop the Ollama container
docker-compose down ollama

# View Ollama logs
docker-compose logs -f ollama

# Verify Ollama is running
curl http://localhost:11434/api/tags
```

## API Endpoints

### 1. List Available Models

```bash
# Get list of all available models
curl http://localhost:11434/api/tags

# Response example:
# {
#   "models": [
#     {
#       "name": "mistral:latest",
#       "modified_at": "2024-01-15T10:30:00Z",
#       "size": 4000000000,
#       "digest": "abc123..."
#     }
#   ]
# }
```

### 2. Generate Embeddings

```bash
# Generate embeddings for text
curl -X POST http://localhost:11434/api/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nomic-embed-text",
    "prompt": "The quick brown fox jumps over the lazy dog"
  }'

# Response example:
# {
#   "embedding": [0.123, 0.456, 0.789, ...]
# }
```

### 3. Generate Text

```bash
# Generate text completion
curl -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "mistral:latest",
    "prompt": "Why is the sky blue?",
    "stream": false
  }'

# Response example:
# {
#   "model": "mistral:latest",
#   "created_at": "2024-01-15T10:30:00Z",
#   "response": "The sky appears blue because...",
#   "done": true,
#   "context": [...]
# }
```

### 4. Pull Models

```bash
# Download a model from registry
curl -X POST http://localhost:11434/api/pull \
  -H "Content-Type: application/json" \
  -d '{
    "name": "nomic-embed-text:latest",
    "stream": false
  }'
```

## Recommended Models

### For Embeddings
- **nomic-embed-text** - High quality, efficient embeddings (768 dims)
  - Size: ~350MB
  - Recommended for vector search
  - Command: `ollama pull nomic-embed-text`

- **mxbai-embed-large** - Large embeddings model (1024 dims)
  - Size: ~670MB
  - Better accuracy, higher compute cost
  - Command: `ollama pull mxbai-embed-large`

### For Text Generation
- **mistral** - Fast, capable model
  - Size: ~4GB
  - Command: `ollama pull mistral`

- **neural-chat** - Conversational model
  - Size: ~4.1GB
  - Command: `ollama pull neural-chat`

- **dolphin-mixtral** - Multi-expert model
  - Size: ~26GB (larger, requires more VRAM)
  - Command: `ollama pull dolphin-mixtral`

## Testing the Local Ollama Embedding Script

This section covers testing your local Ollama embeddings implementation.

### Prerequisites

Before testing, ensure:
1. Docker containers are running: `docker-compose up -d`
2. Ollama server is accessible: `curl http://localhost:11434/api/tags`
3. At least one embedding model is pulled: `ollama pull nomic-embed-text`
4. Node.js is installed (for running embedding scripts)

### Basic Health Check

```bash
# Test Ollama connectivity
curl -s http://localhost:11434/api/tags | jq .

# Expected output should show available models
```

### Test Embedding Generation

```bash
# Test simple embedding request
curl -X POST http://localhost:11434/api/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nomic-embed-text",
    "prompt": "Hello world"
  }' | jq .

# Verify you get back an embedding array
```

### Node.js Embedding Script Test

Create a test script to verify embeddings work correctly:

**File: `test-embedding.js`**

```javascript
const http = require('http');

// Configuration
const OLLAMA_HOST = 'localhost';
const OLLAMA_PORT = 11434;
const MODEL = 'nomic-embed-text';

async function generateEmbedding(text) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: MODEL,
      prompt: text
    });

    const options = {
      hostname: OLLAMA_HOST,
      port: OLLAMA_PORT,
      path: '/api/embeddings',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

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
    req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing Ollama Embedding Script\n');
  console.log(`Server: http://${OLLAMA_HOST}:${OLLAMA_PORT}`);
  console.log(`Model: ${MODEL}\n`);

  const testCases = [
    'Hello world',
    'The quick brown fox jumps over the lazy dog',
    'Machine learning and artificial intelligence are transforming the world',
    'What is the meaning of life?'
  ];

  for (const testText of testCases) {
    try {
      console.log(`📝 Testing: "${testText}"`);
      const result = await generateEmbedding(testText);
      
      if (result.embedding && Array.isArray(result.embedding)) {
        console.log(`✅ Success! Generated embedding with ${result.embedding.length} dimensions`);
        console.log(`   First 5 values: ${result.embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}`);
      } else {
        console.log(`❌ Failed: No embedding in response`);
        console.log(`   Response: ${JSON.stringify(result).slice(0, 200)}`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    console.log('');
  }
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
```

### Running the Test Script

```bash
# Run the embedding test
node test-embedding.js

# Expected output:
# 🧪 Testing Ollama Embedding Script
# 
# Server: http://localhost:11434
# Model: nomic-embed-text
# 
# 📝 Testing: "Hello world"
# ✅ Success! Generated embedding with 768 dimensions
#    First 5 values: 0.1234, -0.5678, 0.9012, -0.3456, 0.7890
# ...
```

### Test Embedding Similarity

Create a test to verify embeddings maintain semantic similarity:

**File: `test-embedding-similarity.js`**

```javascript
const http = require('http');

const OLLAMA_HOST = 'localhost';
const OLLAMA_PORT = 11434;
const MODEL = 'nomic-embed-text';

async function generateEmbedding(text) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: MODEL,
      prompt: text
    });

    const options = {
      hostname: OLLAMA_HOST,
      port: OLLAMA_PORT,
      path: '/api/embeddings',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve(JSON.parse(data).embedding);
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

async function runTests() {
  console.log('🔍 Testing Embedding Similarity\n');

  const pairs = [
    {
      similar: ['cat', 'dog'],
      description: 'Related animals'
    },
    {
      similar: ['car', 'automobile'],
      description: 'Synonyms'
    },
    {
      similar: ['happy', 'joyful'],
      description: 'Sentiment synonyms'
    },
    {
      similar: ['python code', 'javascript code'],
      description: 'Similar concepts, different domains'
    }
  ];

  for (const pair of pairs) {
    try {
      console.log(`📊 Testing: ${pair.description}`);
      const [text1, text2] = pair.similar;
      
      const emb1 = await generateEmbedding(text1);
      const emb2 = await generateEmbedding(text2);
      
      const similarity = cosineSimilarity(emb1, emb2);
      console.log(`   "${text1}" vs "${text2}"`);
      console.log(`   Cosine similarity: ${(similarity * 100).toFixed(2)}%`);
      console.log(`   ${similarity > 0.5 ? '✅ High similarity' : '⚠️  Low similarity'}\n`);
    } catch (error) {
      console.log(`❌ Error: ${error.message}\n`);
    }
  }
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
```

### Running Similarity Test

```bash
# Run the similarity test
node test-embedding-similarity.js

# Expected output:
# 🔍 Testing Embedding Similarity
# 
# 📊 Testing: Related animals
#    "cat" vs "dog"
#    Cosine similarity: 75.43%
#    ✅ High similarity
# ...
```

### Batch Testing

For testing large document collections:

**File: `test-embedding-batch.js`**

```javascript
const fs = require('fs');
const http = require('http');

const OLLAMA_HOST = 'localhost';
const OLLAMA_PORT = 11434;
const MODEL = 'nomic-embed-text';

async function generateEmbedding(text) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: MODEL,
      prompt: text
    });

    const options = {
      hostname: OLLAMA_HOST,
      port: OLLAMA_PORT,
      path: '/api/embeddings',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve(JSON.parse(data).embedding);
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function batchEmbed(documents, batchSize = 5) {
  const results = [];
  const startTime = Date.now();

  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);
    const batchPromises = batch.map(doc => generateEmbedding(doc));
    
    try {
      const embeddings = await Promise.all(batchPromises);
      results.push(...embeddings);
      console.log(`✅ Processed ${Math.min(i + batchSize, documents.length)}/${documents.length} documents`);
    } catch (error) {
      console.error(`❌ Batch error: ${error.message}`);
      throw error;
    }
  }

  const duration = (Date.now() - startTime) / 1000;
  console.log(`\n📊 Batch Stats:`);
  console.log(`   Total documents: ${documents.length}`);
  console.log(`   Total time: ${duration.toFixed(2)}s`);
  console.log(`   Avg time per document: ${(duration / documents.length * 1000).toFixed(2)}ms`);

  return results;
}

async function runBatchTest() {
  console.log('📦 Testing Batch Embeddings\n');

  const testDocuments = [
    'The sun rises in the east',
    'Machine learning is transforming AI',
    'Embeddings capture semantic meaning',
    'Vector databases store embeddings efficiently',
    'Similarity search finds related documents',
    'Neural networks learn representations',
    'Transformers revolutionized NLP',
    'Attention mechanisms improve performance'
  ];

  try {
    const embeddings = await batchEmbed(testDocuments, 3);
    console.log(`\n✨ Successfully generated ${embeddings.length} embeddings`);
  } catch (error) {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
  }
}

runBatchTest();
```

### Running Batch Test

```bash
# Run the batch test
node test-embedding-batch.js

# Expected output:
# 📦 Testing Batch Embeddings
# 
# ✅ Processed 3/8 documents
# ✅ Processed 6/8 documents
# ✅ Processed 8/8 documents
# 
# 📊 Batch Stats:
#    Total documents: 8
#    Total time: 2.34s
#    Avg time per document: 292.50ms
```

## Troubleshooting

### Issue: Connection Refused (11434)

**Symptom**: `Error: connect ECONNREFUSED 127.0.0.1:11434`

**Solutions**:
1. Verify Docker containers are running: `docker-compose ps`
2. Check Ollama logs: `docker-compose logs ollama`
3. Verify port is correct: `netstat -an | grep 11434`
4. Restart Ollama: `docker-compose restart ollama`

### Issue: Model Not Found

**Symptom**: `Error: model not found`

**Solutions**:
1. Pull the model: `docker exec ollama ollama pull nomic-embed-text`
2. List available models: `curl http://localhost:11434/api/tags`
3. Check disk space for model storage

### Issue: Slow Embedding Generation

**Symptoms**: Embedding requests taking > 1 second

**Solutions**:
1. Check system resources: `docker stats ollama`
2. Verify no other heavy processes
3. Consider smaller model: Use `nomic-embed-text` over `mxbai-embed-large`
4. Ensure GPU acceleration is enabled if available

### Issue: Out of Memory Errors

**Symptom**: Container crashes or OOM errors in logs

**Solutions**:
1. Check available RAM: `docker stats`
2. Use lighter models (smaller size)
3. Reduce batch size for embeddings
4. Increase Docker memory limit in docker-compose.yml:
   ```yaml
   ollama:
     ...
     mem_limit: 8g
   ```

## Integration with Qdrant Vector Database

Once embeddings are generated, store them in Qdrant:

```javascript
// Example: Store embedding in Qdrant
const embedding = await generateEmbedding(document);

// Add to Qdrant collection
const client = new QdrantClient({
  host: 'localhost',
  port: 6333
});

await client.upsert('documents', {
  points: [{
    id: docId,
    vector: embedding,
    payload: {
      text: document,
      created_at: new Date()
    }
  }]
});
```

## Common Workflows

### Workflow 1: Test Single Embedding

```bash
# 1. Verify server is running
curl http://localhost:11434/api/tags

# 2. Test embedding
curl -X POST http://localhost:11434/api/embeddings \
  -H "Content-Type: application/json" \
  -d '{"model": "nomic-embed-text", "prompt": "test"}'

# 3. Verify response contains "embedding" array
```

### Workflow 2: Batch Process Documents

```bash
# 1. Prepare documents in file
cat > documents.txt << EOF
Document 1 content
Document 2 content
Document 3 content
EOF

# 2. Run batch embedding script
node test-embedding-batch.js

# 3. Store results in vector database
```

### Workflow 3: Semantic Search

```bash
# 1. Generate embedding for query
curl -X POST http://localhost:11434/api/embeddings \
  -H "Content-Type: application/json" \
  -d '{"model": "nomic-embed-text", "prompt": "search query"}'

# 2. Use embedding to search Qdrant
# (See Qdrant documentation for search API)
```

## Performance Benchmarks

### Embedding Generation Times (nomic-embed-text)

| Text Length | Time | Model Load Time |
|---|---|---|
| Short (< 20 tokens) | ~250ms | ~1s (first run) |
| Medium (20-100 tokens) | ~300ms | - |
| Long (> 100 tokens) | ~400-500ms | - |

### Memory Usage

| Model | Size | RAM | VRAM |
|---|---|---|---|
| nomic-embed-text | 350MB | ~600MB | ~400MB (if CUDA) |
| mxbai-embed-large | 670MB | ~1GB | ~800MB (if CUDA) |
| mistral | 4GB | ~6GB | ~4GB (if CUDA) |

## Next Steps

1. **Test connectivity**: Run `curl http://localhost:11434/api/tags`
2. **Pull embedding model**: `docker exec ollama ollama pull nomic-embed-text`
3. **Run test script**: `node test-embedding.js`
4. **Monitor performance**: Check logs and resource usage
5. **Integrate with Qdrant**: Store embeddings in vector database
6. **Build search**: Implement semantic search functionality

---

## Quick Start

```bash
# 1. Start Docker containers
docker-compose up -d ollama

# 2. Wait for Ollama to be ready
sleep 5
curl http://localhost:11434/api/tags

# 3. Pull embedding model
docker exec ollama ollama pull nomic-embed-text

# 4. Create test script
cat > test-embedding.js << 'EOF'
# ... (use test-embedding.js code above)
EOF

# 5. Run test
node test-embedding.js

# 6. Check results
echo "✅ All tests completed!"
```
