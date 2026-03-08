#!/usr/bin/env node

const http = require('http');
const fs = require('fs');

const QDRANT_HOST = process.env.QDRANT_HOST || 'localhost';
const QDRANT_PORT = process.env.QDRANT_PORT || 6333;

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
      },
      timeout: 10000
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
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    if (payload) req.write(payload);
    req.end();
  });
}

async function searchPoints(collection, vector, limit = 5, scoreThreshold = null) {
  const body = {
    vector: vector,
    limit: limit,
    with_payload: true
  };
  
  if (scoreThreshold !== null) {
    body.score_threshold = scoreThreshold;
  }

  const result = await makeRequest('POST', `/collections/${collection}/points/search`, body);
  return result.result;
}

function parseVectorInput(input) {
  if (input.startsWith('[')) {
    // Try parsing as JSON array
    try {
      return JSON.parse(input);
    } catch (e) {
      throw new Error('Invalid vector format');
    }
  }
  
  if (fs.existsSync(input)) {
    // Try reading from file
    try {
      const data = JSON.parse(fs.readFileSync(input, 'utf8'));
      if (Array.isArray(data)) {
        return data;
      }
      if (data.embedding && Array.isArray(data.embedding)) {
        return data.embedding;
      }
      throw new Error('File does not contain a valid vector');
    } catch (e) {
      throw new Error(`Failed to read vector from file: ${e.message}`);
    }
  }

  throw new Error('Invalid vector input. Provide a JSON array or file path');
}

async function main() {
  const collection = process.argv[2];
  const vectorInput = process.argv[3];
  const limit = process.argv[4] ? parseInt(process.argv[4]) : 5;
  const threshold = process.argv[5] ? parseFloat(process.argv[5]) : null;

  try {
    if (!collection || !vectorInput) {
      console.log('Usage: qdrant-search.js <collection> <vector> [limit] [threshold]\n');
      console.log('Arguments:');
      console.log('  collection   Collection name');
      console.log('  vector       Vector as JSON array or file path');
      console.log('  limit        Max results (default: 5)');
      console.log('  threshold    Min similarity score (default: none)\n');
      console.log('Examples:');
      console.log('  qdrant-search.js forma_help_center "[0.1,0.2,0.3,...]"');
      console.log('  qdrant-search.js forma_help_center embedding.json 10');
      console.log('  qdrant-search.js forma_help_center embedding.json 5 0.7');
      process.exit(1);
    }

    // Parse vector
    console.log(`🔍 Searching collection: ${collection}`);
    const vector = parseVectorInput(vectorInput);
    console.log(`   Vector dimensions: ${vector.length}`);
    console.log(`   Max results: ${limit}`);
    if (threshold !== null) console.log(`   Min score: ${threshold}`);
    console.log('');

    // Perform search
    console.log('⏳ Searching...');
    const results = await searchPoints(collection, vector, limit, threshold);
    
    console.log(`✅ Found ${results.length} results\n`);

    if (results.length === 0) {
      console.log('(No results found)');
    } else {
      results.forEach((result, idx) => {
        console.log(`[${idx + 1}] Score: ${(result.score * 100).toFixed(2)}%`);
        console.log(`    ID: ${result.id}`);
        
        const payload = result.payload;
        if (payload.article_title) {
          console.log(`    Article: ${payload.article_title}`);
        }
        if (payload.chunk_index !== undefined && payload.total_chunks) {
          console.log(`    Chunk: ${payload.chunk_index + 1}/${payload.total_chunks}`);
        }
        if (payload.chunk_text) {
          const preview = payload.chunk_text.substring(0, 100).replace(/\n/g, ' ');
          console.log(`    Preview: ${preview}...`);
        }
        if (payload.category) {
          console.log(`    Category: ${payload.category}`);
        }
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
