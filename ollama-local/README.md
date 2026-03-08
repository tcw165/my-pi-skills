# Ollama Local Skill

A comprehensive skill for interacting with the local Ollama server running in Docker. This includes API documentation, embedding generation, and testing utilities.

## Files in This Skill

### Documentation
- **`SKILL.md`** - Complete skill documentation including:
  - Server configuration and Docker setup
  - API endpoints and usage examples
  - Recommended models
  - Troubleshooting guide
  - Integration with Qdrant vector database

### Test Scripts

#### 1. Health Check
```bash
bash health-check.sh
```
Verifies:
- Server connectivity
- Available models
- Embedding generation capability
- Docker container status
- Resource usage

#### 2. Basic Embedding Test
```bash
node test-embedding.js
```
Tests embedding generation on sample texts:
- "Hello world"
- "The quick brown fox jumps over the lazy dog"
- "Machine learning and artificial intelligence..."
- "What is the meaning of life?"

Output shows:
- Embedding dimension count
- First 5 values of each embedding
- Success/failure status

#### 3. Semantic Similarity Test
```bash
node test-embedding-similarity.js
```
Tests that embeddings capture semantic meaning:
- Compares related animals: "cat" vs "dog"
- Compares synonyms: "car" vs "automobile"
- Compares sentiment: "happy" vs "joyful"
- Compares domains: "python code" vs "javascript code"

Output shows:
- Cosine similarity percentage
- Whether similarity is high or low

#### 4. Batch Processing Test
```bash
node test-embedding-batch.js
```
Tests batch embedding generation on 8 documents.

Output shows:
- Progress through batch processing
- Total documents processed
- Total time taken
- Average time per document

## Quick Start

### 1. Prerequisites
Ensure Docker containers are running:
```bash
cd /Users/boyw165/Projects/my-pi-extension
docker-compose up -d ollama
```

### 2. Run Health Check
```bash
bash health-check.sh
```

### 3. Pull Embedding Model (if not already pulled)
```bash
docker exec ollama ollama pull nomic-embed-text
```

### 4. Run Tests
```bash
# Basic test
node test-embedding.js

# Similarity test
node test-embedding-similarity.js

# Batch test
node test-embedding-batch.js
```

## Server Configuration

**From `/Users/boyw165/Projects/my-pi-extension/docker-compose.yml`:**

| Setting | Value |
|---------|-------|
| Container Name | ollama |
| Image | ollama/ollama:latest |
| Port | 11434 |
| Base URL | http://localhost:11434 |
| Volume | ollama_data:/root/.ollama |
| Network | vector-db |

## API Endpoints

### List Models
```bash
curl http://localhost:11434/api/tags
```

### Generate Embeddings
```bash
curl -X POST http://localhost:11434/api/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nomic-embed-text",
    "prompt": "Your text here"
  }'
```

### Generate Text
```bash
curl -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "mistral",
    "prompt": "Your prompt here",
    "stream": false
  }'
```

## Recommended Models

### For Embeddings
- **nomic-embed-text** (350MB) - Recommended for most use cases
  - 768 dimensions
  - Good balance of speed and quality
  
- **mxbai-embed-large** (670MB) - For higher accuracy needs
  - 1024 dimensions
  - Slower but more accurate

### For Text Generation
- **mistral** (4GB) - Fast and capable
- **neural-chat** (4.1GB) - Conversational
- **dolphin-mixtral** (26GB) - Multi-expert (requires more VRAM)

## Performance Benchmarks

| Operation | Time |
|-----------|------|
| Single embedding | ~250-500ms |
| Batch of 5 documents | ~1.2-2.5s |
| Model load (first run) | ~1s |

## Troubleshooting

### Server not responding
```bash
# Verify container is running
docker-compose ps

# Check logs
docker-compose logs ollama

# Restart container
docker-compose restart ollama
```

### Model not found
```bash
# List available models
curl http://localhost:11434/api/tags

# Pull missing model
docker exec ollama ollama pull nomic-embed-text
```

### Performance issues
```bash
# Check resource usage
docker stats ollama

# View container logs
docker-compose logs -f ollama
```

## Integration Example

```javascript
// Example: Generate embedding and store in Qdrant
const http = require('http');

async function generateEmbedding(text) {
  // See test-embedding.js for full implementation
}

// Use the embedding with Qdrant
const embedding = await generateEmbedding(document);

// Store in vector database
await qdrantClient.upsert('documents', {
  points: [{
    id: docId,
    vector: embedding,
    payload: { text: document }
  }]
});
```

## Additional Resources

- [Ollama Documentation](https://ollama.ai)
- [Ollama GitHub](https://github.com/jmorganca/ollama)
- [Nomic Embed Text](https://ollama.ai/library/nomic-embed-text)
- [Qdrant Vector Database](https://qdrant.tech)

## Next Steps

1. **Run tests** to verify everything works
2. **Integrate with Qdrant** for vector storage
3. **Build semantic search** using embeddings
4. **Monitor performance** with docker stats

---

For complete documentation, see `SKILL.md`.
