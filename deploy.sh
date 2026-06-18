#!/bin/bash

# 欢乐积分王训练系统游戏 - 一键部署脚本
# 使用方法: ./deploy.sh <111.229.164.165> <6*5z}%CAh^8D{4Ev>

set -e

# 配置
PROJECT_NAME="poker"
SERVER_USER="ubuntu"
SERVER_PORT="22"
APP_PORT="8086"
REMOTE_DIR="/home/$SERVER_USER/$PROJECT_NAME"

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== 欢乐积分王训练系统游戏部署脚本 ===${NC}"

build_ssh_cmd() {
    printf 'ssh -p %q -o StrictHostKeyChecking=no' "$SERVER_PORT"
}

run_ssh() {
    local cmd="$1"
    local ssh_args=(-p "$SERVER_PORT" -o StrictHostKeyChecking=no)
    if [ -n "$SERVER_PASSWORD" ]; then
        sshpass -p "$SERVER_PASSWORD" ssh "${ssh_args[@]}" "$SERVER_USER@$SERVER_IP" "$cmd"
    else
        ssh "${ssh_args[@]}" "$SERVER_USER@$SERVER_IP" "$cmd"
    fi
}

remote_exec() {
    local ssh_args=(-p "$SERVER_PORT" -o StrictHostKeyChecking=no)
    if [ -n "$SERVER_PASSWORD" ]; then
        sshpass -p "$SERVER_PASSWORD" ssh "${ssh_args[@]}" "$SERVER_USER@$SERVER_IP" "$@"
    else
        ssh "${ssh_args[@]}" "$SERVER_USER@$SERVER_IP" "$@"
    fi
}

# 检查本地环境
check_local() {
    echo -e "${YELLOW}[1/6] 检查本地环境...${NC}"
    
    if [ ! -d "node_modules" ]; then
        echo -e "${RED}错误: 请在项目根目录运行此脚本${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}构建生产版本（前端+服务端）...${NC}"
    npm run build
    
    echo -e "${GREEN}✓ 本地检查完成${NC}"
}

# 检查服务器环境
check_server() {
    echo -e "${YELLOW}[2/6] 检查服务器环境...${NC}"
    
    # 检查并安装 sshpass
    if ! command -v sshpass &> /dev/null; then
        echo -e "${YELLOW}安装 sshpass...${NC}"
        if [ "$(uname)" = "Darwin" ]; then
            brew install sshpass
        else
            sudo apt install -y sshpass
        fi
    fi
    
    # 检查 Node.js
    if ! run_ssh "command -v node &> /dev/null"; then
        echo -e "${YELLOW}安装 Node.js 18...${NC}"
        run_ssh "curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs"
    fi
    
    # 检查 PM2
    if ! run_ssh "command -v pm2 &> /dev/null"; then
        echo -e "${YELLOW}安装 PM2...${NC}"
        run_ssh "sudo npm install -g pm2"
    fi
    
    echo -e "${GREEN}✓ 服务器环境检查完成${NC}"
}

# 上传项目
upload_project() {
    echo -e "${YELLOW}[3/6] 上传项目到服务器...${NC}"
    
    # 创建远程目录
    run_ssh "mkdir -p $REMOTE_DIR"
    
    # 同步文件（排除 node_modules, build, .git, 数据库文件）
    local rsync_rsh
    rsync_rsh="$(build_ssh_cmd)"

    if [ -n "$SERVER_PASSWORD" ]; then
        sshpass -p "$SERVER_PASSWORD" rsync -avz --progress -e "$rsync_rsh" \
            --rsync-path="mkdir -p $REMOTE_DIR && rsync" \
            --exclude 'node_modules' \
            --exclude '.git' \
            --exclude '.gitignore' \
            --exclude '*.log' \
            --exclude '.DS_Store' \
            --exclude 'data/' \
            --exclude 'dist/data/' \
            --exclude '*.db' \
            --exclude '*.db-journal' \
            ./ $SERVER_USER@$SERVER_IP:$REMOTE_DIR/
    else
        rsync -avz --progress -e "$rsync_rsh" \
            --rsync-path="mkdir -p $REMOTE_DIR && rsync" \
            --exclude 'node_modules' \
            --exclude '.git' \
            --exclude '.gitignore' \
            --exclude '*.log' \
            --exclude '.DS_Store' \
            --exclude 'data/' \
            --exclude 'dist/data/' \
            --exclude '*.db' \
            --exclude '*.db-journal' \
            ./ $SERVER_USER@$SERVER_IP:$REMOTE_DIR/
    fi
    
    echo -e "${GREEN}✓ 项目上传完成${NC}"
}

# 服务器端部署
deploy_server() {
    echo -e "${YELLOW}[4/6] 服务器端部署...${NC}"
    
    remote_exec bash -s <<'ENDSSH'
        cd /home/ubuntu/poker
        sudo rm -rf /opt/poker/solver /home/ubuntu/poker/solver-cli
        
        # 安装运行时依赖（部署包内已包含本地构建好的 dist）
        echo "安装运行时依赖..."
        if [ -f package-lock.json ]; then
            npm ci --omit=dev
        else
            npm install --omit=dev
        fi

        # 校验构建产物是否存在，避免空部署
        if [ ! -f dist/src/server/app-server.js ]; then
            echo "错误: 未找到 dist/src/server/app-server.js，请先在本地执行 npm run build"
            exit 1
        fi
        
        # 重启 PM2
        echo "重启服务..."
        pm2 stop poker 2>/dev/null || true
        pm2 delete poker 2>/dev/null || true
        pm2 start npm --name "poker" --cwd /home/ubuntu/poker -- start
        
        # 保存 PM2 状态
        pm2 save
        
        echo "部署完成!"
ENDSSH
    
    echo -e "${GREEN}✓ 服务器部署完成${NC}"
}

# 配置防火墙
config_firewall() {
    echo -e "${YELLOW}[5/6] 配置防火墙...${NC}"
    
    run_ssh "sudo ufw allow 22/tcp" 2>/dev/null || true
    run_ssh "sudo ufw allow $APP_PORT/tcp" 2>/dev/null || true
    run_ssh "sudo ufw --force enable" 2>/dev/null || true
    run_ssh "sudo ufw reload" 2>/dev/null || true
    
    echo -e "${GREEN}✓ 防火墙配置完成${NC}"
}

# 显示结果
show_result() {
    echo -e "${YELLOW}[6/6] 部署完成!${NC}"
    echo ""
    echo -e "${GREEN}======================================${NC}"
    echo -e "${GREEN}  游戏地址: http://$SERVER_IP:$APP_PORT${NC}"
    echo -e "${GREEN}======================================${NC}"
    echo ""
    echo "常用命令:"
    echo "  查看日志: pm2 logs poker"
    echo "  重启服务: pm2 restart poker"
    echo "  停止服务: pm2 stop poker"
}

# 主流程
main() {
    SERVER_IP=$1
    SERVER_PASSWORD=$2
    
    if [ -z "$SERVER_IP" ]; then
        echo "用法: ./deploy.sh <服务器IP> [服务器密码] [SSH端口]"
        echo ""
        echo "示例:"
        echo "  ./deploy.sh 123.45.67.89"
        echo "  ./deploy.sh 123.45.67.89 password123"
        echo "  ./deploy.sh 123.45.67.89 password123 22"
        exit 1
    fi
    
    if [ ! -z "$3" ]; then
        SERVER_PORT=$3
    fi

    if [ -n "$SERVER_PASSWORD" ]; then
        export SSHPASS="$SERVER_PASSWORD"
    fi
    
    check_local
    check_server
    upload_project
    deploy_server
    config_firewall
    show_result
}

main "$@"
