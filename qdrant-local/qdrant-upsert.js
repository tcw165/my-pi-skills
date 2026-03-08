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

async function upsertPoints(collection, points) {
  const result = await makeRequest('PUT', `/collections/${collection}/points?wait=true`, { points });
  return result;
}

function parsePointsInput(input) {
  if (fs.existsSync(input)) {
    // Try reading from file
    try {
      const data = JSON.parse(fs.readFileSync(input, 'utf8'));
      if (Array.isArray(data)) {
        return data;
      }
      throw new Error('File does not contain an array of points');
    } catch (e) {
      throw new Error(`Failed to read points from file: ${e.message}`);
    }
  }

  // Try parsing as JSON array
  try {
    const data = JSON.parse(input);
    if (Array.isArray(data)) {
      return data;
    }
    throw new Error('Input is not an array of points');
  } catch (e) {
    throw new Error(`Failed to parse points: ${e.message}`);
  }
}

async function main() {
  const collection = process.argv[2];
  const pointsInput = process.argv[3];

  try {
    if (!collection || !pointsInput) {
      console.log('Usage: qdrant-upsert.js <collection> <points>\n');
      console.log('Arguments:');
      console.log('  collection   Collection name');
      console.log('  points       Points as JSON array or file path\n');
      console.log('Point format:');
      console.log('[');
      console.log('  {');
      console.log('    "id": 0,');
      console.log('    "vector": [0.1, 0.2, ...],');
      console.log('    "payload": {');
      console.log('      "title": "Document title",');
      console.log('      "text": "Document content"');
      console.log('    }');
      console.log('  }');
      console.log(']\n');
      console.log('Examples:');
      console.log('  qdrant-upsert.js forma_help_center points.json');
      console.log('  qdrant-upsert.js my_docs "[{...}]"');
      process.exit(1);
    }

    // Parse points
    console.log(`📝 Upserting to collection: ${collection}`);
    const points = parsePointsInput(pointsInput);
    console.log(`   Points to upsert: ${points.length}`);
    console.log('');

    // Validate points
    console.log('✓ Validating points...');
    let validCount = 0;
    let errorCount = 0;

    for (const point of points) {
      if (!point.id && point.id !== 0) {
        console.log(`  ⚠️  Point missing id`);
        errorCount++;
        continue;
      }
      if (!point.vector || !Array.isArray(point.vector)) {
        console.log(`  ⚠️  Point ${point.id} missing valid vector`);
        errorCount++;
        continue;
      }
      validCount++;
    }

    console.log(`   Valid: ${validCount}, Invalid: ${errorCount}`);
    
    if (errorCount > 0) {
      throw new Error(`${errorCount} invalid points`);
    }
    console.log('');

    // Upsert points
    console.log('⏳ Upserting points...');
    const result = await makeRequest('PUT', `/collections/${collection}/points?wait=true`, { points });
    
    if (result.status === 'ok') {
      console.log('✅ Successfully upserted');
      console.log(`   Time: ${result.time}`);
    } else {
      console.log('❌ Upsert failed');
      console.log(`   Status: ${result.status}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
