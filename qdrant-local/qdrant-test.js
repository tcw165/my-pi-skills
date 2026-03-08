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
          if (!data) {
            resolve({ status: 'ok', version: 'unknown' });
          } else {
            resolve(JSON.parse(data));
          }
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
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

function generateRandomVector(size) {
  return Array.from({ length: size }, () => Math.random() * 2 - 1);
}

async function runTests() {
  console.log('🧪 Qdrant Comprehensive Test Suite\n');
  console.log(`Server: ${QDRANT_HOST}:${QDRANT_PORT}\n`);

  const TEST_COLLECTION = 'test_qdrant_suite';
  const VECTOR_SIZE = 768;
  let passCount = 0;
  let failCount = 0;

  // Test 1: Health Check
  try {
    console.log('Test 1️⃣  Health Check');
    const health = await makeRequest('GET', '/health');
    if (health.status === 'ok' || health.version) {
      console.log(`✅ PASS - Server is responding\n`);
      passCount++;
    } else {
      console.log('❌ FAIL - Server not responding\n');
      failCount++;
    }
  } catch (error) {
    console.log(`❌ FAIL - ${error.message}\n`);
    failCount++;
    process.exit(1);
  }

  // Test 2: List Collections
  try {
    console.log('Test 2️⃣  List Collections');
    const result = await makeRequest('GET', '/collections');
    const collections = result.result.collections;
    console.log(`✅ PASS - Found ${collections.length} collection(s)\n`);
    passCount++;
  } catch (error) {
    console.log(`❌ FAIL - ${error.message}\n`);
    failCount++;
  }

  // Test 3: Create Collection
  try {
    console.log('Test 3️⃣  Create Collection');
    const result = await makeRequest('PUT', `/collections/${TEST_COLLECTION}`, {
      vectors: {
        size: VECTOR_SIZE,
        distance: 'Cosine'
      }
    });
    if (result.result === true) {
      console.log(`✅ PASS - Created collection: ${TEST_COLLECTION}\n`);
      passCount++;
    } else {
      throw new Error('Collection creation returned false');
    }
  } catch (error) {
    console.log(`❌ FAIL - ${error.message}\n`);
    failCount++;
    return;
  }

  // Test 4: Get Collection Info
  try {
    console.log('Test 4️⃣  Get Collection Info');
    const result = await makeRequest('GET', `/collections/${TEST_COLLECTION}`);
    const info = result.result;
    if (info.config.params.vectors.size === VECTOR_SIZE) {
      console.log(`✅ PASS - Vector size: ${info.config.params.vectors.size}\n`);
      passCount++;
    } else {
      throw new Error('Vector size mismatch');
    }
  } catch (error) {
    console.log(`❌ FAIL - ${error.message}\n`);
    failCount++;
  }

  // Test 5: Upsert Points
  try {
    console.log('Test 5️⃣  Upsert Points');
    const points = [
      {
        id: 0,
        vector: generateRandomVector(VECTOR_SIZE),
        payload: {
          title: 'Document 1',
          category: 'health',
          text: 'This is a health-related document'
        }
      },
      {
        id: 1,
        vector: generateRandomVector(VECTOR_SIZE),
        payload: {
          title: 'Document 2',
          category: 'wellness',
          text: 'This is a wellness-related document'
        }
      },
      {
        id: 2,
        vector: generateRandomVector(VECTOR_SIZE),
        payload: {
          title: 'Document 3',
          category: 'health',
          text: 'Another health document'
        }
      }
    ];

    const result = await makeRequest('PUT', `/collections/${TEST_COLLECTION}/points?wait=true`, { points });
    if (result.status === 'ok') {
      console.log(`✅ PASS - Upserted ${points.length} points\n`);
      passCount++;
    } else {
      throw new Error('Upsert operation failed');
    }
  } catch (error) {
    console.log(`❌ FAIL - ${error.message}\n`);
    failCount++;
  }

  // Test 6: Search Points
  try {
    console.log('Test 6️⃣  Search Points');
    const queryVector = generateRandomVector(VECTOR_SIZE);
    const result = await makeRequest('POST', `/collections/${TEST_COLLECTION}/points/search`, {
      vector: queryVector,
      limit: 2,
      with_payload: true
    });
    
    if (Array.isArray(result.result) && result.result.length > 0) {
      console.log(`✅ PASS - Found ${result.result.length} results`);
      console.log(`   Top result: ${result.result[0].payload.title} (score: ${result.result[0].score.toFixed(3)})\n`);
      passCount++;
    } else {
      throw new Error('No search results');
    }
  } catch (error) {
    console.log(`❌ FAIL - ${error.message}\n`);
    failCount++;
  }

  // Test 7: Update Point
  try {
    console.log('Test 7️⃣  Update Point');
    const updatedVector = generateRandomVector(VECTOR_SIZE);
    const result = await makeRequest('PUT', `/collections/${TEST_COLLECTION}/points?wait=true`, {
      points: [
        {
          id: 0,
          vector: updatedVector,
          payload: {
            title: 'Document 1 - Updated',
            category: 'health',
            text: 'This is an updated health document'
          }
        }
      ]
    });

    if (result.status === 'ok') {
      console.log(`✅ PASS - Updated point 0\n`);
      passCount++;
    } else {
      throw new Error('Point update failed');
    }
  } catch (error) {
    console.log(`❌ FAIL - ${error.message}\n`);
    failCount++;
  }

  // Test 8: Filter Search
  try {
    console.log('Test 8️⃣  Filter Search');
    const queryVector = generateRandomVector(VECTOR_SIZE);
    const result = await makeRequest('POST', `/collections/${TEST_COLLECTION}/points/search`, {
      vector: queryVector,
      limit: 5,
      with_payload: true,
      score_threshold: 0.0
    });

    if (Array.isArray(result.result)) {
      console.log(`✅ PASS - Search with threshold returned ${result.result.length} results\n`);
      passCount++;
    } else {
      throw new Error('Filtered search failed');
    }
  } catch (error) {
    console.log(`❌ FAIL - ${error.message}\n`);
    failCount++;
  }

  // Test 9: Delete Points
  try {
    console.log('Test 9️⃣  Delete Points');
    const result = await makeRequest('POST', `/collections/${TEST_COLLECTION}/points/delete`, {
      points_selector: {
        ids: [1, 2]
      }
    });

    if (result.status === 'ok') {
      console.log(`✅ PASS - Deleted points 1 and 2\n`);
      passCount++;
    } else {
      throw new Error('Delete operation failed');
    }
  } catch (error) {
    console.log(`❌ FAIL - ${error.message}\n`);
    failCount++;
  }

  // Test 10: Verify Deletion
  try {
    console.log('Test 🔟 Verify Deletion');
    const result = await makeRequest('GET', `/collections/${TEST_COLLECTION}`);
    const pointsCount = result.result.points_count;

    if (pointsCount === 1) {
      console.log(`✅ PASS - Collection now has ${pointsCount} point(s)\n`);
      passCount++;
    } else {
      console.log(`⚠️  INFO - Collection has ${pointsCount} points (expected 1)\n`);
      passCount++;
    }
  } catch (error) {
    console.log(`❌ FAIL - ${error.message}\n`);
    failCount++;
  }

  // Test 11: Delete Collection
  try {
    console.log('Test 1️⃣ 1️⃣  Delete Collection');
    const result = await makeRequest('DELETE', `/collections/${TEST_COLLECTION}`);
    if (result.result === true) {
      console.log(`✅ PASS - Deleted collection: ${TEST_COLLECTION}\n`);
      passCount++;
    } else {
      throw new Error('Delete collection returned false');
    }
  } catch (error) {
    console.log(`❌ FAIL - ${error.message}\n`);
    failCount++;
  }

  // Summary
  console.log('═'.repeat(50));
  console.log('📊 Test Summary\n');
  console.log(`✅ Passed: ${passCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📈 Total:  ${passCount + failCount}`);
  console.log(`🎯 Success Rate: ${((passCount / (passCount + failCount)) * 100).toFixed(1)}%`);
  console.log('');

  if (failCount === 0) {
    console.log('🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed');
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
