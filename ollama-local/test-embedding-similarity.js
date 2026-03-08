#!/usr/bin/env node

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
        try {
          const response = JSON.parse(data);
          resolve(response.embedding);
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

function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    throw new Error('Vectors must have equal length');
  }
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
