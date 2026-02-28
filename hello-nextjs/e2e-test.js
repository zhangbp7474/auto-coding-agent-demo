const http = require('http');

const BASE_URL = 'http://localhost:3000';

let cookies = {};

function makeRequest(path, method, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const cookieString = Object.entries(cookies)
      .map(([key, value]) => `${key}=${value}`)
      .join('; ');
    if (cookieString) {
      options.headers['Cookie'] = cookieString;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const setCookie = res.headers['set-cookie'];
        if (setCookie) {
          setCookie.forEach(cookie => {
            const match = cookie.match(/^([^=]+)=([^;]+)/);
            if (match) {
              cookies[match[1]] = match[2];
            }
          });
        }
        
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('E2E Testing - Auto Coding Agent Demo');
  console.log('='.repeat(60));
  
  let testResults = [];
  let projectId = null;
  let sceneId = null;

  console.log('\n[TEST 1] Health Check - GET /api/health');
  try {
    const result = await makeRequest('/api/health', 'GET');
    const passed = result.status === 200 || result.status === 404;
    console.log(`Status: ${result.status}`);
    testResults.push({ name: 'Health Check', passed, status: result.status });
  } catch (e) {
    console.log(`Error: ${e.message}`);
    testResults.push({ name: 'Health Check', passed: false, error: e.message });
  }

  console.log('\n[TEST 2] User Registration - POST /api/auth/register');
  const timestamp = Date.now();
  const testEmail = `test${timestamp}@example.com`;
  try {
    const result = await makeRequest('/api/auth/register', 'POST', {
      email: testEmail,
      password: 'Test123456',
      name: 'Test User'
    });
    console.log(`Status: ${result.status}`);
    console.log(`Response:`, JSON.stringify(result.data, null, 2));
    
    if (result.status === 201 || result.status === 200) {
      testResults.push({ name: 'User Registration', passed: true, status: result.status });
    } else {
      testResults.push({ name: 'User Registration', passed: false, status: result.status, error: result.data });
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
    testResults.push({ name: 'User Registration', passed: false, error: e.message });
  }

  console.log('\n[TEST 3] User Login - POST /api/auth/login');
  try {
    const result = await makeRequest('/api/auth/login', 'POST', {
      email: testEmail,
      password: 'Test123456'
    });
    console.log(`Status: ${result.status}`);
    console.log(`Response:`, JSON.stringify(result.data, null, 2));
    
    if (result.status === 200) {
      testResults.push({ name: 'User Login', passed: true, status: result.status });
    } else {
      testResults.push({ name: 'User Login', passed: false, status: result.status, error: result.data });
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
    testResults.push({ name: 'User Login', passed: false, error: e.message });
  }

  console.log('\n[TEST 4] Get Current User - GET /api/auth/me');
  try {
    const result = await makeRequest('/api/auth/me', 'GET');
    console.log(`Status: ${result.status}`);
    console.log(`Response:`, JSON.stringify(result.data, null, 2));
    testResults.push({ name: 'Get Current User', passed: result.status === 200, status: result.status });
  } catch (e) {
    console.log(`Error: ${e.message}`);
    testResults.push({ name: 'Get Current User', passed: false, error: e.message });
  }

  console.log('\n[TEST 5] Create Project - POST /api/projects');
  try {
    const result = await makeRequest('/api/projects', 'POST', {
      title: 'Test Project',
      description: 'E2E Test Project',
      style: 'cinematic'
    });
    console.log(`Status: ${result.status}`);
    console.log(`Response:`, JSON.stringify(result.data, null, 2));
    
    if (result.status === 201 || result.status === 200) {
      projectId = result.data.project?.id || result.data.data?.id || result.data.id;
      testResults.push({ name: 'Create Project', passed: true, status: result.status });
    } else {
      testResults.push({ name: 'Create Project', passed: false, status: result.status, error: result.data });
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
    testResults.push({ name: 'Create Project', passed: false, error: e.message });
  }

  console.log('\n[TEST 6] List Projects - GET /api/projects');
  try {
    const result = await makeRequest('/api/projects', 'GET');
    console.log(`Status: ${result.status}`);
    console.log(`Response:`, JSON.stringify(result.data, null, 2));
    testResults.push({ name: 'List Projects', passed: result.status === 200, status: result.status });
  } catch (e) {
    console.log(`Error: ${e.message}`);
    testResults.push({ name: 'List Projects', passed: false, error: e.message });
  }

  if (projectId) {
    console.log('\n[TEST 7] Create Scene - POST /api/scenes');
    try {
      const result = await makeRequest('/api/scenes', 'POST', {
        projectId: projectId,
        sceneNumber: 1,
        title: 'Opening Scene',
        description: 'A beautiful sunrise over the mountains',
        duration: 5
      });
      console.log(`Status: ${result.status}`);
      console.log(`Response:`, JSON.stringify(result.data, null, 2));
      
      if (result.status === 201 || result.status === 200) {
        sceneId = result.data.scene?.id || result.data.data?.id || result.data.id;
        testResults.push({ name: 'Create Scene', passed: true, status: result.status });
      } else {
        testResults.push({ name: 'Create Scene', passed: false, status: result.status, error: result.data });
      }
    } catch (e) {
      console.log(`Error: ${e.message}`);
      testResults.push({ name: 'Create Scene', passed: false, error: e.message });
    }
  } else {
    console.log('\n[TEST 7] SKIPPED - No project ID');
    testResults.push({ name: 'Create Scene', passed: false, error: 'No project ID' });
  }

  if (projectId) {
    console.log('\n[TEST 8] List Scenes - GET /api/projects/' + projectId + '/scenes');
    try {
      const result = await makeRequest(`/api/projects/${projectId}/scenes`, 'GET');
      console.log(`Status: ${result.status}`);
      console.log(`Response:`, JSON.stringify(result.data, null, 2));
      testResults.push({ name: 'List Scenes', passed: result.status === 200, status: result.status });
    } catch (e) {
      console.log(`Error: ${e.message}`);
      testResults.push({ name: 'List Scenes', passed: false, error: e.message });
    }
  } else {
    console.log('\n[TEST 8] SKIPPED - No project ID');
    testResults.push({ name: 'List Scenes', passed: false, error: 'No project ID' });
  }

  console.log('\n[TEST 9] Generate Image - POST /api/generate/image');
  console.log('(This may take up to 60 seconds...)');
  try {
    const result = await makeRequest('/api/generate/image', 'POST', {
      prompt: 'A beautiful sunset over mountains',
      style: 'cinematic',
      projectId: projectId
    });
    console.log(`Status: ${result.status}`);
    console.log(`Response:`, JSON.stringify(result.data, null, 2));
    testResults.push({ 
      name: 'Generate Image', 
      passed: result.status === 200 || result.status === 201, 
      status: result.status 
    });
  } catch (e) {
    console.log(`Error: ${e.message}`);
    testResults.push({ name: 'Generate Image', passed: false, error: e.message });
  }

  console.log('\n[TEST 10] User Logout - POST /api/auth/logout');
  try {
    const result = await makeRequest('/api/auth/logout', 'POST');
    console.log(`Status: ${result.status}`);
    console.log(`Response:`, JSON.stringify(result.data, null, 2));
    testResults.push({ name: 'User Logout', passed: result.status === 200, status: result.status });
  } catch (e) {
    console.log(`Error: ${e.message}`);
    testResults.push({ name: 'User Logout', passed: false, error: e.message });
  }

  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  
  const passed = testResults.filter(t => t.passed).length;
  const failed = testResults.filter(t => !t.passed).length;
  
  testResults.forEach(t => {
    const status = t.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} - ${t.name}${t.status ? ` (HTTP ${t.status})` : ''}`);
    if (!t.passed && t.error) {
      console.log(`      Error: ${typeof t.error === 'object' ? JSON.stringify(t.error) : t.error}`);
    }
  });
  
  console.log('\n' + '-'.repeat(60));
  console.log(`Total: ${testResults.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / testResults.length) * 100).toFixed(1)}%`);
  console.log('='.repeat(60));
  
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(e => {
  console.error('Test runner error:', e);
  process.exit(1);
});
