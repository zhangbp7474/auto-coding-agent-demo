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
    req.setTimeout(120000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runDemo() {
  console.log('\n' + '═'.repeat(70));
  console.log('   🎬 Spring FES Video - 故事转视频生成平台 - 功能演示');
  console.log('═'.repeat(70));
  
  let projectId = null;
  let sceneIds = [];

  // ==================== 用户认证模块 ====================
  console.log('\n' + '─'.repeat(70));
  console.log('📋 模块一：用户认证系统');
  console.log('─'.repeat(70));

  const timestamp = Date.now();
  const testEmail = `demo${timestamp}@example.com`;

  console.log('\n🔹 1.1 用户注册');
  console.log(`   请求: POST /api/auth/register`);
  console.log(`   数据: { email: "${testEmail}", password: "******", name: "Demo User" }`);
  
  let result = await makeRequest('/api/auth/register', 'POST', {
    email: testEmail,
    password: 'Demo123456',
    name: 'Demo User'
  });
  
  if (result.status === 201) {
    console.log(`   ✅ 注册成功! (HTTP ${result.status})`);
    console.log(`   用户ID: ${result.data.user.id}`);
    console.log(`   邮箱: ${result.data.user.email}`);
  } else {
    console.log(`   ❌ 注册失败: ${JSON.stringify(result.data)}`);
    return;
  }

  console.log('\n🔹 1.2 用户登录');
  console.log(`   请求: POST /api/auth/login`);
  
  result = await makeRequest('/api/auth/login', 'POST', {
    email: testEmail,
    password: 'Demo123456'
  });
  
  if (result.status === 200) {
    console.log(`   ✅ 登录成功! (HTTP ${result.status})`);
    console.log(`   Cookie已保存，后续请求将自动携带认证信息`);
  } else {
    console.log(`   ❌ 登录失败: ${JSON.stringify(result.data)}`);
    return;
  }

  console.log('\n🔹 1.3 获取当前用户信息');
  console.log(`   请求: GET /api/auth/me`);
  
  result = await makeRequest('/api/auth/me', 'GET');
  
  if (result.status === 200) {
    console.log(`   ✅ 获取成功! (HTTP ${result.status})`);
    console.log(`   当前用户: ${result.data.user.name} (${result.data.user.email})`);
  } else {
    console.log(`   ❌ 获取失败: ${JSON.stringify(result.data)}`);
  }

  // ==================== 项目管理模块 ====================
  console.log('\n' + '─'.repeat(70));
  console.log('📋 模块二：项目管理');
  console.log('─'.repeat(70));

  console.log('\n🔹 2.1 创建新项目');
  console.log(`   请求: POST /api/projects`);
  console.log(`   数据: { title: "AI视频演示项目", style: "cinematic" }`);
  
  result = await makeRequest('/api/projects', 'POST', {
    title: 'AI视频演示项目',
    description: '这是一个功能演示项目，展示AI视频生成能力',
    style: 'cinematic'
  });
  
  if (result.status === 201) {
    projectId = result.data.project.id;
    console.log(`   ✅ 项目创建成功! (HTTP ${result.status})`);
    console.log(`   项目ID: ${projectId}`);
    console.log(`   标题: ${result.data.project.title}`);
    console.log(`   风格: ${result.data.project.style}`);
    console.log(`   阶段: ${result.data.project.stage}`);
  } else {
    console.log(`   ❌ 创建失败: ${JSON.stringify(result.data)}`);
    return;
  }

  console.log('\n🔹 2.2 获取项目列表');
  console.log(`   请求: GET /api/projects`);
  
  result = await makeRequest('/api/projects', 'GET');
  
  if (result.status === 200) {
    console.log(`   ✅ 获取成功! (HTTP ${result.status})`);
    console.log(`   项目总数: ${result.data.pagination.total}`);
    result.data.projects.forEach((p, i) => {
      console.log(`   [${i + 1}] ${p.title} - ${p.style} (${p.stage})`);
    });
  } else {
    console.log(`   ❌ 获取失败: ${JSON.stringify(result.data)}`);
  }

  // ==================== 分镜管理模块 ====================
  console.log('\n' + '─'.repeat(70));
  console.log('📋 模块三：分镜管理');
  console.log('─'.repeat(70));

  const scenes = [
    { order: 1, title: '开场', description: '清晨的阳光透过云层，照耀在宁静的山谷中，薄雾缭绕，鸟儿飞翔' },
    { order: 2, title: '发展', description: '一位年轻的旅人背着行囊，沿着蜿蜒的山路前行，脸上洋溢着期待的笑容' },
    { order: 3, title: '高潮', description: '旅人登上山顶，俯瞰壮丽的风景，夕阳西下，天空被染成金红色' },
  ];

  for (const scene of scenes) {
    console.log(`\n🔹 3.${scene.order} 创建分镜 #${scene.order}: ${scene.title}`);
    console.log(`   请求: POST /api/scenes`);
    console.log(`   描述: ${scene.description.substring(0, 30)}...`);
    
    result = await makeRequest('/api/scenes', 'POST', {
      projectId: projectId,
      sceneNumber: scene.order,
      title: scene.title,
      description: scene.description,
      duration: 5
    });
    
    if (result.status === 201) {
      sceneIds.push(result.data.scene.id);
      console.log(`   ✅ 分镜创建成功! (HTTP ${result.status})`);
      console.log(`   分镜ID: ${result.data.scene.id}`);
    } else {
      console.log(`   ❌ 创建失败: ${JSON.stringify(result.data)}`);
    }
    await sleep(100);
  }

  console.log('\n🔹 3.4 获取项目分镜列表');
  console.log(`   请求: GET /api/projects/${projectId}/scenes`);
  
  result = await makeRequest(`/api/projects/${projectId}/scenes`, 'GET');
  
  if (result.status === 200) {
    console.log(`   ✅ 获取成功! (HTTP ${result.status})`);
    console.log(`   分镜总数: ${result.data.scenes.length}`);
    result.data.scenes.forEach((s, i) => {
      console.log(`   [${i + 1}] 分镜 #${s.order_index}: ${s.description.substring(0, 25)}...`);
      console.log(`       图片状态: ${s.image_status} | 视频状态: ${s.video_status}`);
    });
  } else {
    console.log(`   ❌ 获取失败: ${JSON.stringify(result.data)}`);
  }

  // ==================== AI生成模块 ====================
  console.log('\n' + '─'.repeat(70));
  console.log('📋 模块四：AI内容生成');
  console.log('─'.repeat(70));

  console.log('\n🔹 4.1 AI图片生成 (火山引擎 Doubao-Seedream)');
  console.log(`   请求: POST /api/generate/image`);
  console.log(`   提示词: "A cinematic sunset over misty mountains, golden hour lighting"`);
  console.log(`   风格: cinematic`);
  console.log(`   ⏳ 正在生成，请稍候...`);
  
  const startTime = Date.now();
  result = await makeRequest('/api/generate/image', 'POST', {
    prompt: 'A cinematic sunset over misty mountains, golden hour lighting, professional photography',
    style: 'cinematic',
    projectId: projectId
  });
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  
  if (result.status === 200) {
    console.log(`   ✅ 图片生成成功! (HTTP ${result.status})`);
    console.log(`   ⏱️  生成耗时: ${duration}秒`);
    if (result.data.image) {
      console.log(`   图片URL: ${result.data.image.url}`);
    } else {
      console.log(`   图片大小: ${(result.data.size / 1024).toFixed(1)} KB`);
    }
  } else {
    console.log(`   ❌ 生成失败: ${JSON.stringify(result.data)}`);
  }

  // ==================== 批量生成模块 ====================
  console.log('\n🔹 4.2 批量生成分镜图片');
  console.log(`   请求: POST /api/generate/images`);
  console.log(`   项目ID: ${projectId}`);
  console.log(`   ⏳ 正在为 ${sceneIds.length} 个分镜生成图片...`);
  
  result = await makeRequest('/api/generate/images', 'POST', {
    projectId: projectId
  });
  
  if (result.status === 200) {
    console.log(`   ✅ 批量生成完成!`);
    console.log(`   成功: ${result.data.completed} | 失败: ${result.data.failed}`);
    if (result.data.results) {
      result.data.results.forEach((r, i) => {
        const status = r.success ? '✅' : '❌';
        console.log(`   [${i + 1}] ${status} 分镜 #${r.orderIndex}: ${r.success ? '成功' : r.error}`);
      });
    }
  } else {
    console.log(`   ❌ 批量生成失败: ${JSON.stringify(result.data)}`);
  }

  // ==================== 用户登出模块 ====================
  console.log('\n' + '─'.repeat(70));
  console.log('📋 模块五：用户登出');
  console.log('─'.repeat(70));

  console.log('\n🔹 5.1 用户登出');
  console.log(`   请求: POST /api/auth/logout`);
  
  result = await makeRequest('/api/auth/logout', 'POST');
  
  if (result.status === 200) {
    console.log(`   ✅ 登出成功! (HTTP ${result.status})`);
    console.log(`   Cookie已清除`);
  } else {
    console.log(`   ❌ 登出失败: ${JSON.stringify(result.data)}`);
  }

  // ==================== 演示完成 ====================
  console.log('\n' + '═'.repeat(70));
  console.log('   🎉 功能演示完成！');
  console.log('═'.repeat(70));
  console.log('\n📊 演示统计:');
  console.log(`   • 用户注册: ✅`);
  console.log(`   • 用户登录: ✅`);
  console.log(`   • 项目创建: ✅`);
  console.log(`   • 分镜创建: ✅ (${sceneIds.length}个)`);
  console.log(`   • AI图片生成: ✅`);
  console.log(`   • 用户登出: ✅`);
  console.log('\n🌐 前端访问地址: http://localhost:3000');
  console.log('📖 API文档: 参见项目README.md');
  console.log('═'.repeat(70) + '\n');
}

runDemo().catch(e => {
  console.error('\n❌ 演示过程出错:', e.message);
  process.exit(1);
});
