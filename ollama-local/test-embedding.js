#!/usr/bin/env node

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
