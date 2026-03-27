const { exec } = require('child_process');
const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs');

const SOURCE_DIR = path.join(__dirname, '..', 'src');
const OUTPUT_FILE = path.join(__dirname, '..', '.dev-live-markers.json');

class LiveSyncServer {
  constructor() {
    this.modifications = [];
    this.debounceTimer = null;
  }

  start() {
    console.log('🔄 启动开发环境同步服务...');

    this.watcher = chokidar.watch([
      path.join(SOURCE_DIR, '**/*.{tsx,jsx,ts,js}'),
      '!' + path.join(SOURCE_DIR, '**/*.d.ts')
    ], {
      ignored: /(^|[\/\\])\../,
      persistent: true,
      ignoreInitial: true
    });

    this.watcher
      .on('add', filePath => this.handleFileChange('add', filePath))
      .on('change', filePath => this.handleFileChange('change', filePath))
      .on('unlink', filePath => this.handleFileChange('unlink', filePath));

    console.log('✅ 同步服务已启动 - 等待文件变更...');
  }

  handleFileChange(event, filePath) {
    const relativePath = path.relative(process.cwd(), filePath);
    console.log(`📝 ${event}: ${relativePath}`);

    this.modifications.push({
      event,
      filePath: relativePath,
      timestamp: Date.now()
    });

    this.saveMarkers();
  }

  saveMarkers() {
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify({
      lastUpdate: Date.now(),
      modifications: this.modifications.slice(-50)
    }, null, 2));
  }

  getFileInfo(filePath) {
    try {
      const fullPath = path.join(process.cwd(), filePath);
      const content = fs.readFileSync(fullPath, 'utf-8');
      return {
        path: filePath,
        content,
        lines: content.split('\n').length
      };
    } catch (error) {
      return null;
    }
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
    }
  }
}

if (require.main === module) {
  const server = new LiveSyncServer();
  server.start();

  process.on('SIGINT', () => {
    console.log('\n🛑 关闭同步服务...');
    server.stop();
    process.exit();
  });
}

module.exports = LiveSyncServer;
