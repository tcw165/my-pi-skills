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
