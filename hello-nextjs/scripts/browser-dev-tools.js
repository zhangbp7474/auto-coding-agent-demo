(function() {
  'use strict';

  const DEV_SYNC_CONFIG = {
    enabled: true,
    apiEndpoint: '/api/dev-sync',
    debounceMs: 500,
    consoleOutput: true
  };

  const isProduction = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production';

  class BrowserDevSync {
    constructor(config) {
      this.config = { ...DEV_SYNC_CONFIG, ...config };
      this.modifications = [];
      this.pendingSync = null;
      this.elementCounter = 0;
      this.componentRegistry = new Map();
      this.pathFinderEndpoint = '/api/dev-sync/find-path';

      if (this.config.enabled && !isProduction) {
        this.init();
      }
    }

    init() {
      this.injectStyles();
      this.setupMutationObserver();
      this.setupKeyboardShortcuts();
      this.registerComponents();
      this.log('🚀 浏览器开发同步已启动');
      this.log('💡 按 Ctrl+Alt+P 打开同步面板');
      this.log('💡 按 Ctrl+Alt+W 进入标记模式');
      this.log('💡 按 Ctrl+Alt+Z 查找当前元素对应的源文件');
    }

    async findSourcePath(element) {
      this.log('🔍 正在查找源文件路径...');

      const elementData = {
        text: element.textContent?.trim().substring(0, 100),
        className: element.className,
        id: element.id,
        tagName: element.tagName,
        placeholder: element.getAttribute('placeholder'),
        href: element.getAttribute('href'),
        src: element.getAttribute('src')
      };

      try {
        const response = await fetch(this.pathFinderEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(elementData)
        });

        const data = await response.json();

        if (data.success && data.suggestedPath) {
          this.log(`✅ 建议路径: ${data.suggestedPath}`);
          this.showPathFinderModal(element, data);
          return data.suggestedPath;
        } else {
          this.log('⚠️ 未找到匹配的源文件');
          this.showManualPathInput(element);
          return null;
        }
      } catch (error) {
        this.log(`❌ 查找失败: ${error.message}`);
        this.showManualPathInput(element);
        return null;
      }
    }

    showPathFinderModal(element, data) {
      const modal = document.createElement('div');
      modal.className = 'dev-sync-panel';
      modal.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:500px;z-index:1000001;';

      const matchesHTML = data.matches.slice(0, 5).map((match, index) => `
        <div class="dev-sync-item" onclick="window.browserDevSync?.selectPath(${index})">
          <strong>${match.filePath}:${match.lineNumber}</strong><br>
          <small>匹配度: ${match.confidence}% | 类型: ${match.matchType}</small><br>
          <code style="color:#aaa;font-size:11px;">${match.matchedContent}</code>
        </div>
      `).join('');

      modal.innerHTML = `
        <div class="dev-sync-header">
          <h3>🔍 查找源文件</h3>
          <button class="dev-sync-close" onclick="this.closest('.dev-sync-panel').remove()">×</button>
        </div>
        <div class="dev-sync-content">
          <div class="dev-sync-item" style="border-left-color:#2196F3;">
            <strong>推荐路径:</strong><br>
            <code style="color:#4CAF50;font-size:14px;">${data.suggestedPath}</code><br><br>
            <button class="dev-sync-btn sync" onclick="window.browserDevSync?.confirmPath('${data.suggestedPath}')">使用此路径</button>
            <button class="dev-sync-btn" onclick="window.browserDevSync?.showManualPathInput(window.browserDevSync?.currentElement)">手动输入</button>
          </div>
          ${data.matches.length > 0 ? `
          <div style="margin-top:12px;">
            <strong>其他匹配 (${data.totalMatches}个):</strong>
            ${matchesHTML}
          </div>
          ` : '<p style="color:#888;">未找到其他匹配</p>'}
          <div style="margin-top:12px;">
            <button class="dev-sync-btn" onclick="window.browserDevSync?.showProjectStructure()">查看项目结构</button>
          </div>
        </div>
      `;

      modal.dataset.matches = JSON.stringify(data.matches);
      modal.dataset.suggestedPath = data.suggestedPath;
      document.body.appendChild(modal);
    }

    showManualPathInput(element) {
      this.currentElement = element;
      const modal = document.createElement('div');
      modal.className = 'dev-sync-panel';
      modal.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:500px;z-index:1000001;';

      modal.innerHTML = `
        <div class="dev-sync-header">
          <h3>📁 输入源文件路径</h3>
          <button class="dev-sync-close" onclick="this.closest('.dev-sync-panel').remove()">×</button>
        </div>
        <div class="dev-sync-content">
          <p style="color:#888;margin-bottom:12px;">
            输入源文件路径（如: src/app/page.tsx）<br>
            <small>常用路径参考：</small>
          </p>
          <ul style="color:#888;font-size:12px;margin-left:20px;margin-bottom:12px;">
            <li>src/app/page.tsx - 首页</li>
            <li>src/components/**/*.tsx - 组件</li>
            <li>src/app/login/page.tsx - 登录页</li>
            <li>src/app/register/page.tsx - 注册页</li>
          </ul>
          <input type="text" id="manual-path-input" placeholder="src/app/page.tsx"
            style="width:100%;padding:8px;border:1px solid #3e3e3e;background:#252526;color:#d4d4d4;border-radius:4px;box-sizing:border-box;">
          <div style="margin-top:12px;">
            <button class="dev-sync-btn sync" onclick="window.browserDevSync?.confirmManualPath()">确认路径</button>
            <button class="dev-sync-btn" onclick="window.browserDevSync?.showProjectStructure()">查看项目结构</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const input = document.getElementById('manual-path-input');
      if (input) {
        input.focus();
        input.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            this.confirmManualPath();
          }
        });
      }
    }

    showProjectStructure() {
      fetch('/api/dev-sync/find-path?action=structure')
        .then(response => response.json())
        .then(data => {
          const modal = document.createElement('div');
          modal.className = 'dev-sync-panel';
          modal.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:600px;max-height:70vh;z-index:1000001;';

          const structureHTML = Object.entries(data.structure)
            .map(([category, files]) => `
              <div style="margin-bottom:16px;">
                <strong style="color:#4CAF50;text-transform:uppercase;">${category}:</strong>
                <ul style="margin:8px 0;padding-left:20px;color:#888;font-size:12px;">
                  ${files.slice(0, 10).map(f => `<li>${f}</li>`).join('')}
                </ul>
              </div>
            `).join('');

          modal.innerHTML = `
            <div class="dev-sync-header">
              <h3>📂 项目结构</h3>
              <button class="dev-sync-close" onclick="this.closest('.dev-sync-panel').remove()">×</button>
            </div>
            <div class="dev-sync-content" style="max-height:500px;overflow-y:auto;">
              ${structureHTML}
            </div>
          `;

          document.body.appendChild(modal);
        })
        .catch(error => {
          this.log(`❌ 获取项目结构失败: ${error.message}`);
        });
    }

    confirmPath(path) {
      if (this.currentElement && path) {
        const devId = `element-${++this.elementCounter}`;
        this.currentElement.setAttribute('data-dev-id', devId);
        this.currentElement.setAttribute('data-dev-path', path);

        this.componentRegistry.set(devId, {
          path: path,
          element: this.serializeElement(this.currentElement),
          markedAt: Date.now()
        });

        this.log(`✅ 元素已标记: ${devId} -> ${path}`);
        this.showNotification(`元素已标记: ${path}`);
      }

      document.querySelectorAll('.dev-sync-panel').forEach(p => p.remove());
    }

    confirmManualPath() {
      const input = document.getElementById('manual-path-input');
      if (input && input.value.trim()) {
        this.confirmPath(input.value.trim());
      } else {
        this.log('⚠️ 请输入有效的文件路径');
      }
    }

    async searchElementSource() {
      const selection = window.getSelection();
      let targetElement = null;

      if (selection && selection.rangeCount > 0) {
        targetElement = selection.getRangeAt(0).startContainer.parentElement;
      }

      if (!targetElement) {
        targetElement = document.activeElement;
      }

      if (!targetElement || targetElement === document.body) {
        this.log('⚠️ 请先选择一个元素');
        return;
      }

      this.currentElement = targetElement;
      await this.findSourcePath(targetElement);
    }

    injectStyles() {
      const style = document.createElement('style');
      style.id = 'dev-sync-styles';
      style.textContent = `
        .dev-sync-panel {
          position: fixed;
          top: 10px;
          right: 10px;
          width: 400px;
          max-height: 600px;
          background: #1e1e1e;
          border: 2px solid #4CAF50;
          border-radius: 8px;
          color: #d4d4d4;
          font-family: 'Segoe UI', sans-serif;
          font-size: 13px;
          z-index: 999999;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
          overflow: hidden;
        }
        .dev-sync-header {
          background: #2d2d2d;
          padding: 12px 16px;
          border-bottom: 1px solid #3e3e3e;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: move;
        }
        .dev-sync-header h3 {
          margin: 0;
          color: #4CAF50;
          font-size: 14px;
        }
        .dev-sync-content {
          max-height: 500px;
          overflow-y: auto;
          padding: 12px;
        }
        .dev-sync-close {
          background: #f44336;
          border: none;
          color: white;
          width: 24px;
          height: 24px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
        }
        .dev-sync-item {
          background: #252526;
          margin: 8px 0;
          padding: 10px;
          border-radius: 4px;
          border-left: 3px solid #4CAF50;
        }
        .dev-sync-item.modified {
          border-left-color: #FF9800;
        }
        .dev-sync-item.synced {
          border-left-color: #2196F3;
        }
        .dev-sync-btn {
          background: #4CAF50;
          border: none;
          color: white;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          margin: 8px 4px;
          font-size: 12px;
        }
        .dev-sync-btn:hover {
          background: #45a049;
        }
        .dev-sync-btn.sync {
          background: #2196F3;
        }
        .dev-sync-btn.sync:hover {
          background: #1976D2;
        }
        .dev-sync-btn.clear {
          background: #f44336;
        }
        .dev-sync-marker-mode .dev-sync-panel {
          border-color: #FF9800;
          box-shadow: 0 0 20px rgba(255, 152, 0, 0.5);
        }
        .dev-sync-highlight {
          outline: 2px dashed #FF9800 !important;
          outline-offset: 2px !important;
          background: rgba(255, 152, 0, 0.1) !important;
        }
        .dev-sync-element-info {
          position: absolute;
          background: #333;
          color: white;
          padding: 8px 12px;
          border-radius: 4px;
          font-size: 12px;
          pointer-events: none;
          z-index: 1000000;
          max-width: 300px;
        }
      `;
      document.head.appendChild(style);
    }

    setupMutationObserver() {
      this.observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' || mutation.type === 'childList') {
            this.handleMutation(mutation);
          }
        });
      });

      this.observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-dev-id', 'data-dev-path', 'class', 'style', 'value', 'src', 'href', 'alt', 'title', 'placeholder']
      });
    }

    handleMutation(mutation) {
      const element = mutation.target;
      if (element.classList.contains('dev-sync-panel') ||
          element.classList.contains('dev-sync-marker-mode')) {
        return;
      }

      const devId = element.getAttribute('data-dev-id');
      const devPath = element.getAttribute('data-dev-path');

      if (devId || devPath) {
        this.queueSync({
          type: mutation.type,
          devId,
          devPath,
          element: this.serializeElement(element),
          timestamp: Date.now()
        });
      }
    }

    serializeElement(element) {
      return {
        tagName: element.tagName,
        id: element.id,
        className: element.className,
        textContent: element.textContent?.substring(0, 200),
        value: element.value,
        innerHTML: element.innerHTML?.substring(0, 500),
        attributes: this.getRelevantAttributes(element),
        rect: element.getBoundingClientRect()
      };
    }

    getRelevantAttributes(element) {
      const attrs = {};
      const relevantAttrs = ['data-dev-id', 'data-dev-path', 'class', 'src', 'href', 'alt', 'title', 'placeholder', 'value'];

      relevantAttrs.forEach(attr => {
        if (element.hasAttribute(attr)) {
          attrs[attr] = element.getAttribute(attr);
        }
      });

      return attrs;
    }

    queueSync(modification) {
      this.modifications.push(modification);

      if (this.pendingSync) {
        clearTimeout(this.pendingSync);
      }

      this.pendingSync = setTimeout(() => {
        this.flushSync();
      }, this.config.debounceMs);
    }

    flushSync() {
      if (this.modifications.length === 0) return;

      const batch = [...this.modifications];
      this.modifications = [];

      this.log(`📤 同步 ${batch.length} 个修改到源码...`);

      fetch(this.config.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          modifications: batch,
          url: window.location.href,
          timestamp: Date.now()
        })
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          this.log('✅ 源码已更新，页面将自动刷新');
          this.showNotification(`${data.modified} 个文件已更新`);
        } else {
          this.log(`❌ 同步失败: ${data.error}`);
        }
      })
      .catch(error => {
        this.log(`❌ 同步错误: ${error.message}`);
      });
    }

    setupKeyboardShortcuts() {
      document.addEventListener('keydown', (e) => {
        // Ctrl+Alt+P 打开同步面板
        if (e.ctrlKey && e.altKey && e.key === 'P') {
          e.preventDefault();
          this.togglePanel();
        }
        // Ctrl+Alt+W 进入标记模式
        if (e.ctrlKey && e.altKey && e.key === 'W') {
          e.preventDefault();
          this.toggleMarkerMode();
        }
        // Ctrl+Alt+Z 查找源文件路径
        if (e.ctrlKey && e.altKey && e.key === 'Z') {
          e.preventDefault();
          this.searchElementSource();
        }
      });
    }

    togglePanel() {
      let panel = document.getElementById('dev-sync-panel');

      if (panel) {
        panel.remove();
      } else {
        this.createPanel();
      }
    }

    createPanel() {
      const panel = document.createElement('div');
      panel.id = 'dev-sync-panel';
      panel.className = 'dev-sync-panel';
      panel.innerHTML = `
        <div class="dev-sync-header">
          <h3>🔄 开发同步面板</h3>
          <button class="dev-sync-close" onclick="document.getElementById('dev-sync-panel').remove()">×</button>
        </div>
        <div class="dev-sync-content">
          <div class="dev-sync-item">
            <strong>状态:</strong> <span id="dev-sync-status">活跃</span>
          </div>
          <div class="dev-sync-item">
            <strong>待同步:</strong> <span id="dev-sync-pending">0</span> 个修改
          </div>
          <button class="dev-sync-btn sync" onclick="window.browserDevSync?.flushSync()">立即同步</button>
          <button class="dev-sync-btn clear" onclick="window.browserDevSync?.clearModifications()">清空</button>
        </div>
      `;

      document.body.appendChild(panel);
      this.updatePanelStats();
    }

    updatePanelStats() {
      const statusEl = document.getElementById('dev-sync-status');
      const pendingEl = document.getElementById('dev-sync-pending');

      if (statusEl) statusEl.textContent = this.config.enabled ? '活跃' : '已禁用';
      if (pendingEl) pendingEl.textContent = this.modifications.length;
    }

    toggleMarkerMode() {
      document.body.classList.toggle('dev-sync-marker-mode');

      if (document.body.classList.contains('dev-sync-marker-mode')) {
        this.log('🔍 进入标记模式 - 点击元素标记');
        document.addEventListener('click', this.handleMarkerClick, true);
      } else {
        this.log('🔍 退出标记模式');
        document.removeEventListener('click', this.handleMarkerClick, true);
      }
    }

    handleMarkerClick = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const element = e.target;
      const devId = `element-${++this.elementCounter}`;
      const filePath = prompt('输入对应的源文件路径（如: src/app/page.tsx）:', 'src/app/page.tsx');

      if (filePath) {
        element.setAttribute('data-dev-id', devId);
        element.setAttribute('data-dev-path', filePath);
        element.classList.add('dev-sync-highlight');

        this.componentRegistry.set(devId, {
          path: filePath,
          element: this.serializeElement(element),
          markedAt: Date.now()
        });

        this.log(`✅ 已标记元素: ${devId} -> ${filePath}`);
        this.showNotification(`元素已标记: ${devId}`);
      }
    }

    registerComponents() {
      const components = document.querySelectorAll('[data-dev-id], [data-dev-path]');

      components.forEach(el => {
        const devId = el.getAttribute('data-dev-id');
        const devPath = el.getAttribute('data-dev-path');

        if (devId && devPath) {
          this.componentRegistry.set(devId, {
            path: devPath,
            element: this.serializeElement(el)
          });
        }
      });

      window.browserDevSync = this;
    }

    clearModifications() {
      this.modifications = [];
      this.updatePanelStats();
      this.log('🗑️ 已清空待同步列表');
    }

    showNotification(message) {
      const notification = document.createElement('div');
      notification.className = 'dev-sync-element-info';
      notification.textContent = message;
      notification.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#4CAF50;';
      document.body.appendChild(notification);

      setTimeout(() => {
        notification.remove();
      }, 2000);
    }

    log(message) {
      if (this.config.consoleOutput) {
        console.log(`%c[DevSync] ${message}`, 'color: #4CAF50; font-weight: bold;');
      }
    }

    destroy() {
      if (this.observer) {
        this.observer.disconnect();
      }
      if (this.pendingSync) {
        clearTimeout(this.pendingSync);
      }
      const styles = document.getElementById('dev-sync-styles');
      const panel = document.getElementById('dev-sync-panel');
      if (styles) styles.remove();
      if (panel) panel.remove();
    }
  }

  if (typeof window !== 'undefined') {
    window.BrowserDevSync = BrowserDevSync;

    const initDevSync = () => {
      if (!window.browserDevSync) {
        window.browserDevSync = new BrowserDevSync();
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initDevSync);
    } else {
      initDevSync();
    }
  }
})();
