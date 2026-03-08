#!/usr/bin/env node

const http = require('http');

const QDRANT_HOST = process.env.QDRANT_HOST || 'localhost';
const QDRANT_PORT = process.env.QDRANT_PORT || 6333;

function makeRequest(method, path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: QDRANT_HOST,
      port: QDRANT_PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ raw: data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

async function checkHealth() {
  console.log('🏥 Qdrant Health Check\n');
  console.log(`Server: ${QDRANT_HOST}:${QDRANT_PORT}`);
  console.log('');

  try {
    // Check health
    console.log('📡 Checking server health...');
    const health = await makeRequest('GET', '/health');
    console.log('✅ Server is running');
    console.log(`   Title: ${health.title}`);
    console.log(`   Version: ${health.version}`);
    console.log('');

    // List collections
    console.log('📦 Collections:');
    const collections = await makeRequest('GET', '/collections');
    const cols = collections.result.collections;
    
    if (cols.length === 0) {
      console.log('   (No collections)');
    } else {
      for (const col of cols) {
        try {
          const info = await makeRequest('GET', `/collections/${col.name}`);
          console.log(`   - ${col.name}`);
          console.log(`     Points: ${info.result.points_count}`);
          console.log(`     Status: ${info.result.status}`);
        } catch (e) {
          console.log(`   - ${col.name} (error fetching info)`);
        }
      }
    }
    console.log('');

    // Get stats
    console.log('📊 Statistics:');
    let totalPoints = 0;
    for (const col of cols) {
      try {
        const info = await makeRequest('GET', `/collections/${col.name}`);
        totalPoints += info.result.points_count;
      } catch (e) {
        // Skip on error
      }
    }
    console.log(`   Total collections: ${cols.length}`);
    console.log(`   Total points: ${totalPoints}`);
    console.log('');

    console.log('✨ All systems operational!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Health check failed:');
    console.error(`   ${error.message}`);
    process.exit(1);
  }
}

checkHealth();
