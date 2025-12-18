# Navigation Site

基于 Cloudflare Workers + D1 数据库的网址导航站，支持多用户、分类管理、主题切换。

## 功能特性

- 多用户支持：每个用户独立管理自己的分类和链接
- 超级管理员：user_id=1 为超级管理员，可管理所有用户
- 用户管理：新增/删除/禁用用户、重置密码
- 分类管理：创建/编辑/删除分类，支持排序
- 链接管理：创建/编辑/删除链接，支持自定义图标
- 主题切换：支持亮色/暗色主题，跟随系统或手动切换
- 搜索功能：实时搜索链接名称和URL
- 响应式设计：适配桌面端和移动端

## 技术栈

- **后端**: Cloudflare Workers (JavaScript)
- **数据库**: Cloudflare D1 (SQLite)
- **前端**: 纯 HTML/CSS/JavaScript
- **认证**: JWT (Web Crypto API)

## 项目结构

```
nav/
├── wrangler.toml              # Workers 配置
├── package.json               # 项目依赖
├── db.sql                     # 数据库初始化脚本
├── src/
│   ├── index.js               # Worker 入口，路由分发
│   ├── auth.js                # JWT 认证逻辑
│   ├── api/
│   │   ├── public.js          # 公开 API
│   │   ├── admin.js           # 管理 API
│   │   └── auth.js            # 登录 API
│   └── utils/
│       ├── response.js        # 统一响应格式
│       └── crypto.js          # 密码加密
├── public/
│   ├── index.html             # 导航页
│   ├── admin.html             # 管理页
│   ├── login.html             # 登录页
│   ├── favicon.svg            # 网站图标
│   ├── default_logo_icon.svg  # 默认链接图标
│   ├── css/
│   │   ├── style.css          # 导航页样式
│   │   └── admin.css          # 管理页样式
│   └── js/
│       ├── app.js             # 导航页逻辑
│       ├── admin.js           # 管理页逻辑
│       └── login.js           # 登录逻辑
└── README.md
```

## 部署步骤

### 前置要求

- Node.js 18+
- Cloudflare 账号
- Wrangler CLI

### 命令行部署

#### 1. 安装依赖

```bash
npm install
```

#### 2. 登录 Cloudflare

```bash
npx wrangler login
```

#### 3. 创建 D1 数据库

```bash
npx wrangler d1 create nav-db
```

执行后会输出数据库 ID，将其更新到 `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "nav-db"
database_id = "你的数据库ID"
```

#### 4. 初始化数据库

```bash
# 远程数据库
npx wrangler d1 execute nav-db --remote --file=db.sql

# 或本地数据库（用于开发）
npx wrangler d1 execute nav-db --local --file=db.sql
```

#### 5. 配置 JWT 密钥

在 Cloudflare Dashboard 或使用 wrangler 设置环境变量：

```bash
npx wrangler secret put JWT_SECRET
# 输入一个随机字符串作为密钥
```

#### 6. 本地开发

```bash
npx wrangler dev
```

访问 http://localhost:8787

#### 7. 部署到 Cloudflare

```bash
npx wrangler deploy
```

## 默认账号

- 用户名: `admin`
- 密码: `admin123`

**重要**: 部署后请立即修改默认密码！

## API 说明

### 公开 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/links | 获取当前用户的链接（需登录） |
| GET | /api/categories | 获取当前用户的分类（需登录） |

### 认证 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/login | 用户登录 |
| GET | /api/auth/check | 验证 Token |

### 管理 API（需认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/categories | 获取分类列表 |
| POST | /api/admin/categories | 创建分类 |
| PUT | /api/admin/categories/:id | 更新分类 |
| DELETE | /api/admin/categories/:id | 删除分类 |
| GET | /api/admin/links | 获取链接列表 |
| POST | /api/admin/links | 创建链接 |
| PUT | /api/admin/links/:id | 更新链接 |
| DELETE | /api/admin/links/:id | 删除链接 |
| PUT | /api/admin/password | 修改密码 |

### 用户管理 API（仅超级管理员）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/users | 获取用户列表 |
| POST | /api/admin/users | 创建用户 |
| PUT | /api/admin/users/:id | 更新用户（状态/密码） |
| DELETE | /api/admin/users/:id | 删除用户 |



## 用户权限

| 功能 | 超级管理员(id=1) | 普通用户 |
|------|-----------------|---------|
| 查看用户列表 | Y | N |
| 新增用户 | Y | N |
| 禁用/启用用户 | Y | N |
| 重置用户密码 | Y | N |
| 删除用户 | Y | N |
| 修改自己密码 | Y | Y |
| 管理自己的分类/链接 | Y | Y |

## License

MIT
