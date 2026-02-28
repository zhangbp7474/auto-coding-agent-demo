# AI视频项目重构检查清单

## 一、环境准备检查

### 1.1 配置文件
- [ ] `config.yaml` 文件已创建
- [ ] 配置文件包含火山引擎API配置
- [ ] 配置文件包含数据库配置
- [ ] 配置文件包含应用配置
- [ ] `src/lib/config.ts` 配置读取工具已创建
- [ ] `.env.local.example` 已更新

### 1.2 依赖管理
- [ ] Supabase依赖已移除
- [ ] pg依赖已添加
- [ ] bcryptjs依赖已添加
- [ ] jsonwebtoken依赖已添加
- [ ] js-yaml依赖已添加
- [ ] uuid依赖已添加
- [ ] 类型定义依赖已添加
- [ ] `npm install` 执行成功

### 1.3 脚本文件
- [ ] `init.ps1` Windows初始化脚本已创建
- [ ] 数据库迁移脚本已创建

## 二、数据库迁移检查

### 2.1 数据库结构
- [ ] `migrations/001_local_schema.sql` 已创建
- [ ] users表已创建
- [ ] projects表已创建
- [ ] scenes表已创建
- [ ] images表已创建
- [ ] videos表已创建
- [ ] 索引已创建
- [ ] 外键约束已设置

### 2.2 数据库客户端
- [ ] `src/lib/db/client.ts` 已创建
- [ ] PostgreSQL连接池配置正确
- [ ] `src/lib/db/users.ts` 已创建
- [ ] 用户CRUD操作实现正确

### 2.3 数据访问层
- [ ] `src/lib/db/projects.ts` 已更新
- [ ] `src/lib/db/scenes.ts` 已更新
- [ ] `src/lib/db/media.ts` 已更新
- [ ] `src/lib/db/projects-list.ts` 已更新

### 2.4 类型定义
- [ ] `src/types/database.ts` 已更新
- [ ] User类型已定义
- [ ] 所有表类型正确

## 三、认证系统检查

### 3.1 JWT工具
- [ ] `src/lib/auth/jwt.ts` 已创建
- [ ] JWT签名功能正常
- [ ] JWT验证功能正常
- [ ] `src/lib/auth/password.ts` 已创建
- [ ] 密码加密功能正常
- [ ] 密码验证功能正常

### 3.2 认证API
- [ ] `src/app/api/auth/login/route.ts` 已创建
- [ ] 登录API返回正确响应
- [ ] `src/app/api/auth/register/route.ts` 已创建
- [ ] 注册API返回正确响应
- [ ] `src/app/api/auth/logout/route.ts` 已创建
- [ ] 登出API返回正确响应

### 3.3 认证中间件
- [ ] `src/lib/supabase/` 目录已重命名或删除
- [ ] 新认证中间件已创建
- [ ] `src/middleware.ts` 已更新
- [ ] 受保护路由正确配置

### 3.4 认证组件
- [ ] `src/components/auth/LoginForm.tsx` 已更新
- [ ] 登录表单提交正常
- [ ] `src/components/auth/RegisterForm.tsx` 已更新
- [ ] 注册表单提交正常
- [ ] `src/components/auth/LogoutButton.tsx` 已更新
- [ ] 登出按钮功能正常

## 四、AI模型集成检查

### 4.1 文本模型
- [ ] `src/lib/ai/volc-text.ts` 已创建
- [ ] 火山引擎文本API调用正确
- [ ] `src/lib/ai/zhipu.ts` 已删除
- [ ] 分镜生成功能正常
- [ ] 分镜重新生成功能正常

### 4.2 图像模型
- [ ] `src/lib/ai/volc-image.ts` 已更新
- [ ] 使用配置文件读取参数
- [ ] 图像生成功能正常

### 4.3 视频模型
- [ ] `src/lib/ai/volc-video.ts` 已更新
- [ ] 使用配置文件读取参数
- [ ] 视频生成功能正常
- [ ] 视频状态查询功能正常

### 4.4 类型定义
- [ ] `src/types/ai.ts` 已更新

## 五、文件存储检查

### 5.1 本地存储
- [ ] `src/lib/storage/local.ts` 已创建
- [ ] 文件保存功能正常
- [ ] 文件读取功能正常
- [ ] 文件删除功能正常

### 5.2 文件API
- [ ] `src/app/api/files/[...path]/route.ts` 已创建
- [ ] 文件访问API正常
- [ ] `src/app/api/storage/signed-urls/route.ts` 已删除

### 5.3 Hook更新
- [ ] `src/hooks/useSignedUrls.ts` 已更新或删除

## 六、API路由检查

### 6.1 项目API
- [ ] GET /api/projects 正常
- [ ] POST /api/projects 正常
- [ ] GET /api/projects/:id 正常
- [ ] PATCH /api/projects/:id 正常
- [ ] DELETE /api/projects/:id 正常

### 6.2 分镜API
- [ ] GET /api/scenes/:id 正常
- [ ] PATCH /api/scenes/:id 正常
- [ ] POST /api/scenes/:id/confirm-description 正常
- [ ] POST /api/scenes/:id/confirm-image 正常
- [ ] POST /api/scenes/:id/confirm-video 正常
- [ ] POST /api/scenes/confirm-all-descriptions 正常
- [ ] POST /api/scenes/confirm-all-images 正常
- [ ] POST /api/scenes/confirm-all-videos 正常

### 6.3 生成API
- [ ] POST /api/generate/scenes 正常
- [ ] POST /api/generate/scenes/regenerate 正常
- [ ] POST /api/generate/image/:sceneId 正常
- [ ] POST /api/generate/images 正常
- [ ] POST /api/generate/video/scene/:sceneId 正常
- [ ] GET /api/generate/video/task/:taskId 正常
- [ ] POST /api/generate/videos 正常

## 七、页面功能检查

### 7.1 认证页面
- [ ] /login 页面正常显示
- [ ] /register 页面正常显示
- [ ] 登录后正确跳转
- [ ] 注册后正确跳转

### 7.2 主要页面
- [ ] / 首页正常显示
- [ ] /create 创建项目页面正常
- [ ] /projects 项目列表页面正常
- [ ] /projects/:id 项目详情页面正常

### 7.3 组件功能
- [ ] Header组件正常显示用户信息
- [ ] 登出功能正常
- [ ] 项目创建表单正常
- [ ] 分镜列表显示正常
- [ ] 图片列表显示正常
- [ ] 视频列表显示正常

## 八、构建与运行检查

### 8.1 代码规范
- [ ] `npm run lint` 无错误
- [ ] TypeScript类型检查通过

### 8.2 构建
- [ ] `npm run build` 成功
- [ ] 无构建警告或错误

### 8.3 运行
- [ ] `npm run dev` 成功启动
- [ ] 开发服务器正常运行
- [ ] 页面可正常访问

## 九、文档检查

### 9.1 文档更新
- [ ] `README.md` 已更新
- [ ] `architecture.md` 已更新
- [ ] 环境配置说明已创建

### 9.2 Git提交
- [ ] 代码已提交到远程仓库
- [ ] 提交信息清晰

## 十、测试报告检查

### 10.1 功能测试
- [ ] 用户注册测试通过
- [ ] 用户登录测试通过
- [ ] 用户登出测试通过
- [ ] 项目创建测试通过
- [ ] 分镜生成测试通过
- [ ] 图片生成测试通过
- [ ] 视频生成测试通过

### 10.2 兼容性测试
- [ ] Windows环境测试通过
- [ ] Chrome浏览器测试通过
- [ ] Edge浏览器测试通过

### 10.3 性能测试
- [ ] 页面加载速度正常
- [ ] API响应速度正常
