# AI视频项目重构任务清单

## 阶段一：环境准备与配置

### 1.1 项目配置文件
- [ ] 创建统一配置文件 `config.yaml`
- [ ] 创建配置读取工具 `src/lib/config.ts`
- [ ] 更新 `.env.local.example` 模板

### 1.2 依赖管理
- [ ] 移除Supabase相关依赖
- [ ] 添加PostgreSQL、JWT、bcrypt等新依赖
- [ ] 更新 `package.json`
- [ ] 执行 `npm install` 安装依赖

### 1.3 脚本适配
- [ ] 创建Windows兼容的初始化脚本 `init.ps1`
- [ ] 创建跨平台的数据库迁移脚本

## 阶段二：数据库迁移

### 2.1 PostgreSQL设置
- [ ] 创建本地数据库迁移脚本 `migrations/001_local_schema.sql`
- [ ] 创建用户表（替代Supabase Auth）
- [ ] 迁移现有表结构（projects, scenes, images, videos）
- [ ] 创建必要的索引

### 2.2 数据库客户端
- [ ] 创建PostgreSQL连接池 `src/lib/db/client.ts`
- [ ] 创建用户数据访问层 `src/lib/db/users.ts`
- [ ] 更新现有数据访问层文件
  - [ ] `src/lib/db/projects.ts`
  - [ ] `src/lib/db/scenes.ts`
  - [ ] `src/lib/db/media.ts`
  - [ ] `src/lib/db/projects-list.ts`

### 2.3 类型定义更新
- [ ] 更新 `src/types/database.ts`
- [ ] 添加用户相关类型定义

## 阶段三：认证系统重构

### 3.1 JWT认证工具
- [ ] 创建JWT工具函数 `src/lib/auth/jwt.ts`
- [ ] 创建密码加密工具 `src/lib/auth/password.ts`

### 3.2 认证API
- [ ] 创建登录API `src/app/api/auth/login/route.ts`
- [ ] 创建注册API `src/app/api/auth/register/route.ts`
- [ ] 创建登出API `src/app/api/auth/logout/route.ts`

### 3.3 认证中间件
- [ ] 重写 `src/lib/supabase/middleware.ts` 为JWT认证中间件
- [ ] 更新 `src/middleware.ts`

### 3.4 认证客户端
- [ ] 重写 `src/lib/supabase/client.ts` 为认证客户端
- [ ] 重写 `src/lib/supabase/server.ts` 为服务端认证客户端

### 3.5 认证组件更新
- [ ] 更新 `src/components/auth/LoginForm.tsx`
- [ ] 更新 `src/components/auth/RegisterForm.tsx`
- [ ] 更新 `src/components/auth/LogoutButton.tsx`

## 阶段四：AI模型集成改造

### 4.1 文本模型替换
- [ ] 创建火山引擎文本模型API `src/lib/ai/volc-text.ts`
- [ ] 删除智谱AI相关代码 `src/lib/ai/zhipu.ts`
- [ ] 更新分镜生成API `src/app/api/generate/scenes/route.ts`
- [ ] 更新分镜重新生成API `src/app/api/generate/scenes/regenerate/route.ts`

### 4.2 图像模型优化
- [ ] 更新 `src/lib/ai/volc-image.ts` 使用配置文件
- [ ] 更新图像生成API

### 4.3 视频模型优化
- [ ] 更新 `src/lib/ai/volc-video.ts` 使用配置文件
- [ ] 更新视频生成API

### 4.4 AI类型定义
- [ ] 更新 `src/types/ai.ts`

## 阶段五：文件存储重构

### 5.1 本地存储服务
- [ ] 创建本地文件存储服务 `src/lib/storage/local.ts`
- [ ] 创建文件访问API `src/app/api/files/[...path]/route.ts`

### 5.2 存储相关API更新
- [ ] 删除 `src/app/api/storage/signed-urls/route.ts`
- [ ] 更新图片存储逻辑
- [ ] 更新视频存储逻辑

### 5.3 Hook更新
- [ ] 更新 `src/hooks/useSignedUrls.ts`

## 阶段六：API路由更新

### 6.1 项目API
- [ ] 更新 `src/app/api/projects/route.ts`
- [ ] 更新 `src/app/api/projects/[id]/route.ts`

### 6.2 分镜API
- [ ] 更新 `src/app/api/scenes/[id]/route.ts`
- [ ] 更新 `src/app/api/scenes/[id]/confirm-description/route.ts`
- [ ] 更新 `src/app/api/scenes/[id]/confirm-image/route.ts`
- [ ] 更新 `src/app/api/scenes/[id]/confirm-video/route.ts`
- [ ] 更新 `src/app/api/scenes/confirm-all-descriptions/route.ts`
- [ ] 更新 `src/app/api/scenes/confirm-all-images/route.ts`
- [ ] 更新 `src/app/api/scenes/confirm-all-videos/route.ts`

### 6.3 生成API
- [ ] 更新 `src/app/api/generate/scenes/route.ts`
- [ ] 更新 `src/app/api/generate/scenes/regenerate/route.ts`
- [ ] 更新 `src/app/api/generate/image/[sceneId]/route.ts`
- [ ] 更新 `src/app/api/generate/images/route.ts`
- [ ] 更新 `src/app/api/generate/video/scene/[sceneId]/route.ts`
- [ ] 更新 `src/app/api/generate/video/task/[taskId]/route.ts`
- [ ] 更新 `src/app/api/generate/videos/route.ts`

## 阶段七：页面组件更新

### 7.1 认证页面
- [ ] 更新 `src/app/login/page.tsx`
- [ ] 更新 `src/app/register/page.tsx`

### 7.2 主要页面
- [ ] 更新 `src/app/page.tsx`
- [ ] 更新 `src/app/create/page.tsx`
- [ ] 更新 `src/app/projects/page.tsx`
- [ ] 更新 `src/app/projects/[id]/page.tsx`

### 7.3 组件更新
- [ ] 更新 `src/components/providers/Providers.tsx`
- [ ] 更新 `src/components/layout/Header.tsx`

## 阶段八：测试与验证

### 8.1 构建测试
- [ ] 运行 `npm run lint` 检查代码规范
- [ ] 运行 `npm run build` 检查构建

### 8.2 功能测试
- [ ] 测试用户注册功能
- [ ] 测试用户登录功能
- [ ] 测试用户登出功能
- [ ] 测试项目创建功能
- [ ] 测试分镜生成功能
- [ ] 测试图片生成功能
- [ ] 测试视频生成功能

### 8.3 兼容性测试
- [ ] Windows环境运行测试
- [ ] 浏览器兼容性测试

## 阶段九：文档与交付

### 9.1 文档编写
- [ ] 更新 `README.md`
- [ ] 更新 `architecture.md`
- [ ] 创建环境配置说明文档

### 9.2 代码提交
- [ ] 阶段性提交代码到远程仓库
- [ ] 最终代码提交

### 9.3 测试报告
- [ ] 生成功能测试报告
- [ ] 生成性能测试报告
- [ ] 生成兼容性测试报告
