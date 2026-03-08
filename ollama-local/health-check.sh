#!/bin/bash

# Ollama Health Check Script
# Verifies that the local Ollama server is running and accessible

set -e

echo "🏥 Ollama Health Check"
echo "====================="
echo ""

OLLAMA_HOST="localhost"
OLLAMA_PORT="11434"
OLLAMA_URL="http://${OLLAMA_HOST}:${OLLAMA_PORT}"

# Check if server is reachable
echo "1️⃣  Checking connectivity to ${OLLAMA_URL}..."
if curl -s "${OLLAMA_URL}/api/tags" > /dev/null 2>&1; then
  echo "✅ Server is reachable"
else
  echo "❌ Server is not reachable"
  echo "   Try: docker-compose up -d ollama"
  exit 1
fi

echo ""
echo "2️⃣  Checking available models..."
MODELS=$(curl -s "${OLLAMA_URL}/api/tags" | jq -r '.models[].name' 2>/dev/null || echo "")

if [ -z "$MODELS" ]; then
  echo "⚠️  No models available"
  echo "   Pull a model: docker exec ollama ollama pull nomic-embed-text"
else
  echo "✅ Models found:"
  echo "$MODELS" | sed 's/^/   - /'
fi

echo ""
echo "3️⃣  Testing embedding generation..."

TEST_RESPONSE=$(curl -s -X POST "${OLLAMA_URL}/api/embeddings" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nomic-embed-text",
    "prompt": "test"
  }' 2>/dev/null || echo '{}')

if echo "$TEST_RESPONSE" | jq -e '.embedding' > /dev/null 2>/dev/null; then
  EMBEDDING_SIZE=$(echo "$TEST_RESPONSE" | jq '.embedding | length')
  echo "✅ Embedding generation works (${EMBEDDING_SIZE} dimensions)"
else
  echo "⚠️  Embedding test failed"
  echo "   Response: $(echo "$TEST_RESPONSE" | head -c 100)"
fi

echo ""
echo "4️⃣  Checking Docker container status..."
if docker ps --filter "name=ollama" --format "{{.Names}}" | grep -q ollama; then
  echo "✅ Docker container 'ollama' is running"
  docker stats ollama --no-stream --format "table {{.Container}}\t{{.MemUsage}}\t{{.CPUPerc}}" 2>/dev/null | tail -1 | xargs echo "   Stats:"
else
  echo "❌ Docker container 'ollama' is not running"
  echo "   Try: docker-compose up -d ollama"
  exit 1
fi

echo ""
echo "✨ Health check complete!"
