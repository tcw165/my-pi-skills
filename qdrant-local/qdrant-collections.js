#!/usr/bin/env node

const http = require('http');

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
      timeout: 5000
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

async function listCollections() {
  const result = await makeRequest('GET', '/collections');
  return result.result.collections;
}

async function getCollectionInfo(name) {
  const result = await makeRequest('GET', `/collections/${name}`);
  return result.result;
}

async function createCollection(name, vectorSize = 768, distance = 'Cosine') {
  const result = await makeRequest('PUT', `/collections/${name}`, {
    vectors: {
      size: vectorSize,
      distance: distance
    }
  });
  return result;
}

async function deleteCollection(name) {
  const result = await makeRequest('DELETE', `/collections/${name}`);
  return result;
}

async function main() {
  const command = process.argv[2];
  const args = process.argv.slice(3);

  try {
    if (!command || command === 'list') {
      // List all collections
      console.log('📦 Collections\n');
      const collections = await listCollections();
      
      if (collections.length === 0) {
        console.log('(No collections found)');
      } else {
        for (const col of collections) {
          try {
            const info = await getCollectionInfo(col.name);
            console.log(`Name: ${col.name}`);
            console.log(`  Points: ${info.points_count}`);
            console.log(`  Status: ${info.status}`);
            console.log('');
          } catch (e) {
            console.log(`Name: ${col.name}`);
            console.log(`  (Error fetching info)`);
            console.log('');
          }
        }
      }

    } else if (command === 'info' && args[0]) {
      // Get collection info
      const name = args[0];
      console.log(`📊 Collection: ${name}\n`);
      const info = await getCollectionInfo(name);
      
      console.log(`Status: ${info.status}`);
      console.log(`Optimizer: ${info.optimizer_status}`);
      console.log(`Points: ${info.points_count}`);
      console.log(`Vectors: ${info.vectors_count}`);
      console.log(`Segments: ${info.segments_count}`);
      console.log('');
      console.log('Vector Config:');
      console.log(`  Size: ${info.config.params.vectors.size}`);
      console.log(`  Distance: ${info.config.params.vectors.distance}`);

    } else if (command === 'create' && args[0]) {
      // Create collection
      const name = args[0];
      const vectorSize = args[1] ? parseInt(args[1]) : 768;
      const distance = args[2] || 'Cosine';
      
      console.log(`✏️  Creating collection: ${name}`);
      console.log(`   Vector size: ${vectorSize}`);
      console.log(`   Distance: ${distance}`);
      
      const result = await createCollection(name, vectorSize, distance);
      
      if (result.result) {
        console.log('✅ Collection created successfully');
      } else {
        console.log('❌ Failed to create collection');
      }

    } else if (command === 'delete' && args[0]) {
      // Delete collection
      const name = args[0];
      
      console.log(`🗑️  Deleting collection: ${name}`);
      const result = await deleteCollection(name);
      
      if (result.result) {
        console.log('✅ Collection deleted successfully');
      } else {
        console.log('❌ Failed to delete collection');
      }

    } else {
      // Show usage
      console.log('Usage: qdrant-collections.js [command] [args]\n');
      console.log('Commands:');
      console.log('  list                          List all collections');
      console.log('  info <name>                   Get collection info');
      console.log('  create <name> [size] [dist]   Create collection');
      console.log('  delete <name>                 Delete collection\n');
      console.log('Examples:');
      console.log('  qdrant-collections.js list');
      console.log('  qdrant-collections.js info forma_help_center');
      console.log('  qdrant-collections.js create my_docs 768 Cosine');
      console.log('  qdrant-collections.js delete my_docs');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
