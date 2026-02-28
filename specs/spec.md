# AI视频项目重构规格说明

## 项目概述

将现有的AI视频生成项目从macOS开发环境迁移至Windows + Trae IDE开发环境，并进行以下核心改造：
1. 环境迁移与Windows适配
2. AI模型统一集成火山引擎Seed系列
3. 数据库从Supabase云服务迁移至本地PostgreSQL

## 一、环境迁移与Windows适配

### 1.1 目录结构规范
- 保持现有Next.js项目结构不变
- 确保所有文件路径使用跨平台兼容方式
- 路径分隔符统一使用`path.join()`或`path.sep`

### 1.2 配置文件调整
- 创建统一的配置文件`config.yaml`或`config.json`，集中管理：
  - 火山引擎API配置（文本、图像、视频模型）
  - PostgreSQL数据库连接配置
  - 应用运行时配置

### 1.3 脚本文件适配
- 将`init.sh`转换为Windows兼容的`init.ps1`或跨平台的Node.js脚本
- 更新`run-automation.sh`为跨平台兼容版本

### 1.4 依赖项检查
- 确保所有npm依赖在Windows上正常运行
- 检查并修复可能的平台特定依赖问题

## 二、AI模型集成改造

### 2.1 当前模型配置
| 功能 | 当前模型 | API提供商 |
|------|----------|-----------|
| 文本理解（故事→分镜） | GLM-4.7 | 智谱AI |
| 图像生成 | Seedream 4.5 | 火山引擎 |
| 视频生成 | Seedance 1.5 pro | 火山引擎 |

### 2.2 目标模型配置（火山引擎Seed系列）
| 功能 | 目标模型 | API端点 |
|------|----------|---------|
| 文本理解 | Doubao-Seed-1.6 | 火山引擎 |
| 图像生成 | Doubao-Seedream-4-5 | 火山引擎 |
| 视频生成 | Doubao-Seedance-1-5-pro | 火山引擎 |

### 2.3 改造要点

#### 2.3.1 文本模型替换
- 移除智谱AI GLM模型调用
- 集成火山引擎Doubao文本模型API
- 更新`src/lib/ai/zhipu.ts`为`src/lib/ai/volc-text.ts`
- 保持现有prompt模板和响应解析逻辑

#### 2.3.2 图像模型优化
- 当前已使用火山引擎Seedream，保持不变
- 优化API调用参数配置
- 从配置文件读取模型参数

#### 2.3.3 视频模型优化
- 当前已使用火山引擎Seedance，保持不变
- 优化API调用参数配置
- 从配置文件读取模型参数

### 2.4 配置文件结构
```yaml
# config.yaml
volc_engine:
  api_key: ${VOLC_API_KEY}
  text:
    model: "doubao-seed-1.6"
    endpoint: "https://ark.cn-beijing.volces.com/api/v3/chat/completions"
    temperature: 0.7
    max_tokens: 4096
  image:
    model: "doubao-seedream-4-5-251128"
    endpoint: "https://ark.cn-beijing.volces.com/api/v3/images/generations"
    default_size: "2K"
    watermark: false
  video:
    model: "doubao-seedance-1-5-pro-251215"
    endpoint: "https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks"
    default_duration: 5
    watermark: false

database:
  host: "localhost"
  port: 5432
  name: "ai_video_db"
  user: "postgres"
  password: ${DB_PASSWORD}
  pool_size: 10

app:
  storage_path: "./storage"
  max_file_size_mb: 100
```

## 三、数据库迁移

### 3.1 当前数据库架构
- **提供商**: Supabase (云服务)
- **数据库**: PostgreSQL
- **认证**: Supabase Auth
- **存储**: Supabase Storage

### 3.2 目标数据库架构
- **提供商**: 本地部署
- **数据库**: PostgreSQL 15+
- **认证**: 自定义JWT认证（基于本地用户表）
- **存储**: 本地文件系统存储

### 3.3 数据模型迁移
保持现有表结构不变：
- `projects` - 项目表
- `scenes` - 分镜表
- `images` - 图片表
- `videos` - 视频表
- 新增 `users` - 用户表（替代Supabase Auth）

### 3.4 认证系统重构
- 移除Supabase Auth依赖
- 实现基于JWT的本地认证系统
- 密码使用bcrypt加密存储
- Session管理使用HTTP-only Cookie

### 3.5 文件存储重构
- 移除Supabase Storage依赖
- 实现本地文件系统存储
- 文件按用户ID和项目ID组织目录结构
- 提供文件访问API端点

### 3.6 RLS策略迁移
- 移除Supabase RLS依赖
- 在应用层实现数据访问控制
- 所有数据库查询添加用户ID过滤

## 四、代码改造详细方案

### 4.1 需要修改的文件

#### 数据库层
| 文件 | 改造内容 |
|------|----------|
| `src/lib/supabase/client.ts` | 重写为PostgreSQL客户端 |
| `src/lib/supabase/server.ts` | 重写为PostgreSQL服务端客户端 |
| `src/lib/supabase/middleware.ts` | 重写为JWT认证中间件 |
| `src/lib/db/*.ts` | 更新数据库查询逻辑 |
| `src/types/database.ts` | 添加users表类型定义 |

#### AI服务层
| 文件 | 改造内容 |
|------|----------|
| `src/lib/ai/zhipu.ts` | 重写为火山引擎文本模型API |
| `src/lib/ai/volc-image.ts` | 优化配置读取方式 |
| `src/lib/ai/volc-video.ts` | 优化配置读取方式 |

#### API路由
| 文件 | 改造内容 |
|------|----------|
| `src/app/api/storage/signed-urls/route.ts` | 重写为本地文件服务 |
| 所有API路由 | 更新认证逻辑 |

#### 认证组件
| 文件 | 改造内容 |
|------|----------|
| `src/components/auth/LoginForm.tsx` | 更新登录逻辑 |
| `src/components/auth/RegisterForm.tsx` | 更新注册逻辑 |
| `src/components/auth/LogoutButton.tsx` | 更新登出逻辑 |

#### 中间件
| 文件 | 改造内容 |
|------|----------|
| `src/middleware.ts` | 更新认证中间件逻辑 |

### 4.2 需要新增的文件

| 文件 | 用途 |
|------|------|
| `config.yaml` | 统一配置文件 |
| `src/lib/config.ts` | 配置文件读取工具 |
| `src/lib/db/client.ts` | PostgreSQL客户端 |
| `src/lib/db/users.ts` | 用户数据访问层 |
| `src/lib/auth/jwt.ts` | JWT工具函数 |
| `src/lib/auth/password.ts` | 密码加密工具 |
| `src/lib/storage/local.ts` | 本地文件存储服务 |
| `src/app/api/auth/login/route.ts` | 登录API |
| `src/app/api/auth/register/route.ts` | 注册API |
| `src/app/api/auth/logout/route.ts` | 登出API |
| `src/app/api/files/[...path]/route.ts` | 文件访问API |
| `migrations/001_local_schema.sql` | 本地PostgreSQL迁移脚本 |

### 4.3 需要删除的依赖

```json
{
  "dependencies": {
    "@supabase/ssr": "移除",
    "@supabase/supabase-js": "移除"
  }
}
```

### 4.4 需要新增的依赖

```json
{
  "dependencies": {
    "pg": "^8.11.0",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "js-yaml": "^4.1.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/pg": "^8.10.0",
    "@types/bcryptjs": "^2.4.6",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/uuid": "^9.0.8"
  }
}
```

## 五、环境配置说明

### 5.1 系统要求
- Windows 10/11
- Node.js 18+
- PostgreSQL 15+
- npm 或 yarn

### 5.2 环境变量
```env
# 火山引擎配置
VOLC_API_KEY=your_volc_api_key

# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ai_video_db
DB_USER=postgres
DB_PASSWORD=your_password

# JWT配置
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d

# 应用配置
STORAGE_PATH=./storage
```

### 5.3 安装步骤
1. 安装PostgreSQL数据库
2. 创建数据库
3. 运行迁移脚本
4. 安装npm依赖
5. 配置环境变量
6. 启动开发服务器

## 六、测试计划

### 6.1 功能测试
- 用户注册/登录/登出
- 项目创建/编辑/删除
- 分镜生成/确认/重新生成
- 图片生成/确认/重新生成
- 视频生成/确认/重新生成
- 文件上传/下载/访问

### 6.2 兼容性测试
- Windows 10/11 运行测试
- 跨浏览器测试（Chrome, Edge, Firefox）
- 不同分辨率响应式测试

### 6.3 性能测试
- 并发用户测试
- 大文件上传测试
- 长时间运行稳定性测试

## 七、交付物

1. 完整改造后的源代码
2. 配置文件模板
3. 数据库迁移脚本
4. 环境配置说明文档
5. 运行测试报告
