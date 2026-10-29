# 运行环境迁移清单：Mac → Windows 11（node）

| 项目 | 内容 |
| --- | --- |
| 目的 | 正式运行改到 Windows 11 电脑（Tailscale 名称 `node`）；这台 Mac 只做开发 |
| 数据库 | 正式库 `sunshine_homi_integration_20261012`（MySQL 8.4，Docker，端口 127.0.0.1:3307） |
| 服务 | API 3100、管理端 5174（`corepack pnpm dev`）；公网访问 Tailscale Funnel |
| 原则 | 一次性搬迁，不做双向同步；任何时刻只允许一台电脑同步 POS；备份与 `.env` 只走 Tailscale 文件传输或 U 盘，不走邮箱、聊天、网盘 |

## 第 0 步：Windows 提前安装（可在营业时间做）

1. 安装 Git for Windows（默认选项）。
2. 安装 Node.js 24（LTS 安装包，勾选“自动安装必要工具”可不选）。
3. 安装 Docker Desktop，按提示启用 WSL 2，安装后重启电脑，打开 Docker Desktop 确认左下角为 Running。
4. Tailscale 已安装并登录 skylarfeng11 账号，确认已连接。
5. 电源设置：设置 → 系统 → 电源 → “插入电源时，经过以下时间后使设备进入睡眠状态”选“从不”；笔记本合盖动作选“不采取任何操作”。
6. 打开 PowerShell，逐条确认版本（每条都应输出版本号）：

```
git --version
```
```
node -v
```
```
docker --version
```

7. 启用 pnpm：

```
corepack enable
```

## 第 1 步：Windows 拉取代码（可提前做）

```
cd $HOME\Documents
```
```
git clone git@github.com:fengduanzhuang1124/newSunShinestore.git
```

如提示没有 SSH 权限，改用：

```
git clone https://github.com/fengduanzhuang1124/newSunShinestore.git
```

```
cd newSunShinestore
```
```
git checkout codex/inventory-foundation
```
```
cd inventory-system
```
```
corepack pnpm install
```
```
corepack pnpm --filter @sunshine/database build
```

## 第 2 步：切换当天，Mac 停服务并备份（开发端协助）

选择不营业的时间。

1. 在 Mac 运行 `pnpm dev` 的终端按 Ctrl + C 停止服务（停止后 POS 不再同步，期间的销售会在 Windows 启动后自动补同步）。
2. 开发端备份正式库，记录核对数字：总库存、商品数、流水条数、最后一笔 POS 订单时间。
3. 开发端生成发送命令，把以下文件发到 `node`：
   - 数据库备份 `sunshine_homi_integration_20261012_cutover_<时间>.sql`
   - `inventory-system/.env`
   - `inventory-system/apps/admin-web/.cert` 中的 `dev-cert.pem`、`dev-key.pem`

## 第 3 步：Windows 接收文件

Tailscale 收到的文件在“下载”文件夹（如右下角 Tailscale 提示，按提示接收）。把文件放到对应位置：

- `.env` → `Documents\newSunShinestore\inventory-system\.env`
- `dev-cert.pem`、`dev-key.pem` → `Documents\newSunShinestore\inventory-system\apps\admin-web\.cert\`（没有 `.cert` 文件夹就新建）
- 备份 `.sql` 先留在“下载”文件夹

## 第 4 步：Windows 启动数据库并恢复数据

以下命令都在 `Documents\newSunShinestore\inventory-system` 下执行。数据库 root 密码是 `docker-compose.yml` 中的本机开发值，数据库只监听本机 127.0.0.1，外部无法连接。

1. 启动 MySQL（第一次会下载镜像，约几分钟）：

```
docker compose up -d mysql
```

2. 等约 30 秒，确认状态为 healthy：

```
docker compose ps
```

3. 建正式库并授权（`<备份文件名>` 换成实际文件名，下同）：

```
docker compose exec mysql mysql -uroot -plocal_root_development_only -e "CREATE DATABASE IF NOT EXISTS sunshine_homi_integration_20261012 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; GRANT ALL ON sunshine_homi_integration_20261012.* TO 'sunshine'@'%'; FLUSH PRIVILEGES;"
```

4. 把备份拷进数据库容器（不经过 PowerShell 管道，避免编码问题）：

```
docker compose cp $HOME\Downloads\<备份文件名> mysql:/tmp/backup.sql
```

5. 恢复：

```
docker compose exec mysql sh -c "mysql -uroot -plocal_root_development_only --default-character-set=utf8mb4 sunshine_homi_integration_20261012 < /tmp/backup.sql"
```

6. 确认数据库结构为最新（应提示 No pending migrations 或全部已应用）：

```
cd packages\database
```
```
corepack pnpm exec prisma migrate deploy
```
```
corepack pnpm build
```
```
cd ..\..
```

## 第 5 步：Windows 核对数据（必须与第 2 步记录一致）

```
docker compose exec mysql mysql -uroot -plocal_root_development_only sunshine_homi_integration_20261012 -e "SELECT (SELECT SUM(quantity) FROM inventory_balances) AS stock, (SELECT SUM(quantity_delta) FROM stock_movements) AS net, (SELECT COUNT(*) FROM stock_movements) AS movements, (SELECT COUNT(*) FROM products WHERE status='ACTIVE') AS products, (SELECT MAX(ordered_at) FROM pos_orders) AS last_order;"
```

把输出发给开发端核对。stock 与 net 必须相等，且各项与 Mac 备份时完全一致；不一致不要继续，按“回滚”处理。

## 第 6 步：Windows 启动服务并开启公网访问

1. 启动（保持这个 PowerShell 窗口开着，不要关）：

```
corepack pnpm dev
```

2. 看到 API 与管理端启动后，在本机浏览器打开 `https://localhost:5174` 登录，确认首页库存数字与第 5 步一致。
3. 另开一个 PowerShell 窗口，开启公网访问：

```
tailscale funnel --bg --https=443 https+insecure://localhost:5174
```

   如提示 Funnel 未启用，按提示打开 Tailscale 网页后台为 `node` 开启 Funnel 后重试。
4. 新的公网地址为 `https://node.tail10ff0a.ts.net/`（以 `tailscale funnel status` 显示为准），发给开发端从外网测试，通过后再发给同事。
5. 约 5 分钟后确认 POS 已自动同步（经营管理 → 数据中心 → POS 最近成功同步时间更新），停机期间的销售会被补上。

## 第 7 步：Mac 改为开发

1. Mac 关闭原公网访问（开发端提供命令），避免同事打开旧系统。
2. Mac 的 `.env` 改为连接开发库（`sunshine_count_rehearsal_20261024` 或新复制的开发库），并设置 `POS_REALTIME_SYNC_MINUTES=0`，确保开发时不同步 POS、不扣正式库存。
3. 以后需要最新数据做开发：从 Windows 备份，经 Tailscale 发回 Mac，恢复到开发库。

## 回滚

Windows 核对不一致或服务无法启动时：Windows 停止服务（Ctrl + C）并关闭公网访问 `tailscale funnel --https=443 off`；Mac 重新执行 `corepack pnpm dev` 并开启原公网访问。Mac 的数据库在迁移过程中没有被修改，可直接继续使用。

## 记录

| 时间 | 步骤 | 结果 | 操作人 |
| --- | --- | --- | --- |
| 2026-10-27 14:43 | 第 2 步 | Mac 服务已停；代码已推送（运行分支 9b0f012、开发分支 2208100）；备份 `sunshine_homi_integration_20261012_cutover_20261027_1443.sql`（11,850,102 字节，SHA-256 `f3a86f20…c32e`）已发 node。核对：stock 35777、net 35777、movements 7180、products 3727、last_order 2026-10-26 23:24:36（UTC）、orders 7691、最后迁移 2026-10-25 07:06:48 | 开发 |
| 2026-10-27 | 第 5 步 | Windows 恢复后核对 stock 35777、net 35777、movements 7180、products 3727、last_order 2026-10-26 23:24:36，与第 2 步完全一致 | 甲方 / 开发 |
| 2026-10-27 | 第 7 步 | Mac 关闭 Funnel（macmacbook-pro 地址停用）；新建开发库 `sunshine_dev_20261027`（由切换备份恢复，核对一致）；两个工作区 `.env` 改连开发库并设 `POS_REALTIME_SYNC_MINUTES=0`，原文件保留为 `.env.before-cutover-20261027` | 开发 |
| | | | |
