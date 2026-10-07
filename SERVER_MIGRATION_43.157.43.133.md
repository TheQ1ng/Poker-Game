# 迁移到 43.157.43.133

本文档用于把现有服务器 `124.221.170.150` 上的项目迁移到 `43.157.43.133`。

迁移内容包括：

- 项目源代码和构建配置
- `data/` 下的 SQLite 数据库
- 生产构建和依赖
- PM2 服务配置
- `1999` 主服务和 `1000` 令牌页

迁移期间源服务器会短暂停止服务，确保 SQLite 数据库复制一致。源服务器完成复制后会重新启动。

## 1. 填写连接信息

在本机终端执行，先修改下面的变量。目标服务器的密钥名称为 `lhkp-ffwkuryn`。

你提供的 `ssh-rsa ...` 是公钥。下面的 `TARGET_KEY` 必须指向本机保存的对应私钥文件，例如 `~/.ssh/lhkp-ffwkuryn`。只有公钥不能完成 SSH 登录。

源服务器使用部署文件里的密码登录，执行前将该密码填入 `SOURCE_PASSWORD`，不要把密码提交到 Git。

```bash
export SOURCE_HOST="124.221.170.150"
export SOURCE_USER="ubuntu"
export SOURCE_SSH_PORT="22"
export SOURCE_PASSWORD="填写 start-server.sh 中的源服务器密码"

export TARGET_HOST="43.157.43.133"
export TARGET_USER="ubuntu"
export TARGET_SSH_PORT="22"
export TARGET_KEY="$HOME/.ssh/lhkp-ffwkuryn"

export SOURCE_PROJECT="/home/ubuntu/poker"
export TARGET_PROJECT="/home/ubuntu/poker"
```

如果源服务器或目标服务器的 SSH 用户、端口不同，只修改上面的变量。

源服务器密码登录需要本机安装 `sshpass`。macOS 可以使用 `brew install hudochenkov/sshpass/sshpass`，Ubuntu/Debian 可以使用 `sudo apt-get install -y sshpass`。

检查私钥权限：

```bash
chmod 600 "$TARGET_KEY"
```

## 2. 检查 SSH 连接

```bash
SSHPASS="$SOURCE_PASSWORD" sshpass -e ssh -p "$SOURCE_SSH_PORT" \
  "$SOURCE_USER@$SOURCE_HOST" "hostname && test -d '$SOURCE_PROJECT'"

ssh -i "$TARGET_KEY" -p "$TARGET_SSH_PORT" \
  "$TARGET_USER@$TARGET_HOST" "hostname && echo SSH_OK"
```

两条命令都成功后继续。

## 3. 创建本地临时副本

```bash
export MIGRATION_DIR="$(mktemp -d -t poker-migration.XXXXXX)"
echo "$MIGRATION_DIR"
```

## 4. 停止源服务并复制项目

下面命令会停止源服务器的两个 PM2 服务，然后复制代码和数据库。`node_modules/`、`.git/`、日志和旧构建目录会在目标机重新生成。

```bash
SSHPASS="$SOURCE_PASSWORD" sshpass -e ssh -p "$SOURCE_SSH_PORT" \
  "$SOURCE_USER@$SOURCE_HOST" \
  "pm2 stop poker poker-token 2>/dev/null || true"

SSHPASS="$SOURCE_PASSWORD" sshpass -e ssh -p "$SOURCE_SSH_PORT" \
  "$SOURCE_USER@$SOURCE_HOST" \
  "tar -C '$SOURCE_PROJECT' --exclude='node_modules' --exclude='.git' --exclude='*.log' --exclude='.DS_Store' --exclude='build' --exclude='dist' -czf - ." \
  | tar -C "$MIGRATION_DIR" -xzf -
```

## 5. 恢复源服务器服务

复制完成后立即恢复源服务器，减少停机时间：

```bash
SSHPASS="$SOURCE_PASSWORD" sshpass -e ssh -p "$SOURCE_SSH_PORT" \
  "$SOURCE_USER@$SOURCE_HOST" \
  "pm2 restart poker 2>/dev/null || true; pm2 restart poker-token 2>/dev/null || true; pm2 save"
```

## 6. 初始化目标服务器

目标服务器需要 Ubuntu/Debian、Node.js 20、PM2、编译依赖和低端口绑定工具：

```bash
ssh -i "$TARGET_KEY" -p "$TARGET_SSH_PORT" \
  "$TARGET_USER@$TARGET_HOST" <<'REMOTE_SETUP'
set -eu

sudo apt-get update
sudo apt-get install -y ca-certificates curl rsync build-essential python3 libcap2-bin

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm install -g pm2
fi

sudo setcap 'cap_net_bind_service=+ep' "$(readlink -f "$(which node)")"
REMOTE_SETUP
```

## 7. 上传到目标服务器

目标目录如果已存在，会先改名为带时间戳的备份目录：

```bash
ssh -i "$TARGET_KEY" -p "$TARGET_SSH_PORT" \
  "$TARGET_USER@$TARGET_HOST" \
  "if [ -d '$TARGET_PROJECT' ]; then mv '$TARGET_PROJECT' '${TARGET_PROJECT}.backup.$(date +%Y%m%d%H%M%S)'; fi; mkdir -p '$TARGET_PROJECT'"

rsync -az --delete --info=progress2 \
  -e "ssh -i $TARGET_KEY -p $TARGET_SSH_PORT -o StrictHostKeyChecking=no" \
  "$MIGRATION_DIR/" \
  "$TARGET_USER@$TARGET_HOST:$TARGET_PROJECT/"
```

## 8. 安装依赖、构建并启动

```bash
ssh -i "$TARGET_KEY" -p "$TARGET_SSH_PORT" \
  "$TARGET_USER@$TARGET_HOST" <<'REMOTE_DEPLOY'
set -eu
cd /home/ubuntu/poker

if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

npm run build

pm2 stop poker poker-token 2>/dev/null || true
pm2 delete poker poker-token 2>/dev/null || true

PORT=1999 pm2 start npm --name poker --cwd /home/ubuntu/poker -- start
PORT=1000 pm2 start npm --name poker-token --cwd /home/ubuntu/poker -- run start:redirect
pm2 save

sudo ufw allow 22/tcp
sudo ufw allow 1999/tcp
sudo ufw allow 1000/tcp
sudo ufw --force enable
sudo ufw reload
REMOTE_DEPLOY
```

## 9. 验证目标服务

```bash
ssh -i "$TARGET_KEY" -p "$TARGET_SSH_PORT" \
  "$TARGET_USER@$TARGET_HOST" \
  "pm2 status; ss -lntp | grep -E ':1999|:1000'"

curl -I --max-time 10 "http://$TARGET_HOST:1999"
curl -I --max-time 10 "http://$TARGET_HOST:1000"
```

预期结果：

- `poker` 和 `poker-token` 状态为 `online`
- `1999` 返回 `200 OK`
- `1000` 返回 `200 OK`
- 登录、房间和数据库数据与源服务器一致

## 10. 清理本机临时文件

确认目标服务正常后执行：

```bash
rm -rf "$MIGRATION_DIR"
unset SOURCE_PASSWORD TARGET_KEY MIGRATION_DIR
```

## 回滚目标服务器

如果目标服务验证失败，可以先停止目标服务，再把目标目录删除并恢复迁移前自动生成的备份目录：

```bash
ssh -i "$TARGET_KEY" -p "$TARGET_SSH_PORT" \
  "$TARGET_USER@$TARGET_HOST" <<'REMOTE_ROLLBACK'
set -eu
pm2 stop poker poker-token 2>/dev/null || true
pm2 delete poker poker-token 2>/dev/null || true
cd /home/ubuntu
LATEST_BACKUP="$(find . -maxdepth 1 -type d -name 'poker.backup.*' -printf '%T@ %p\n' | sort -nr | head -n 1 | cut -d' ' -f2-)"
if [ -n "$LATEST_BACKUP" ]; then
  rm -rf poker
  mv "$LATEST_BACKUP" poker
fi
REMOTE_ROLLBACK
```
