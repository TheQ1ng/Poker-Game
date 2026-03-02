#!/bin/bash

# 欢乐积分王训练系统游戏 - 一键部署脚本
# 使用方法: ./deploy.sh <服务器IP> <服务器密码(可选)>

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

# 检查本地环境
check_local() {
    echo -e "${YELLOW}[1/6] 检查本地环境...${NC}"
    
    if [ ! -d "node_modules" ]; then
        echo -e "${RED}错误: 请在项目根目录运行此脚本${NC}"
        exit 1
    fi
    
    if [ ! -d "build" ]; then
        echo -e "${YELLOW}构建生产版本...${NC}"
        npm run build
    fi
    
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
    
    # SSH 命令前缀
    if [ ! -z "$SERVER_PASSWORD" ]; then
        SSH_CMD="sshpass -p $SERVER_PASSWORD ssh -o StrictHostKeyChecking=no"
    else
        SSH_CMD="ssh -o StrictHostKeyChecking=no"
    fi
    
    # 检查 Node.js
    if ! $SSH_CMD $SERVER_USER@$SERVER_IP "command -v node &> /dev/null"; then
        echo -e "${YELLOW}安装 Node.js 18...${NC}"
        $SSH_CMD $SERVER_USER@$SERVER_IP "curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs"
    fi
    
    # 检查 PM2
    if ! $SSH_CMD $SERVER_USER@$SERVER_IP "command -v pm2 &> /dev/null"; then
        echo -e "${YELLOW}安装 PM2...${NC}"
        $SSH_CMD $SERVER_USER@$SERVER_IP "sudo npm install -g pm2"
    fi
    
    echo -e "${GREEN}✓ 服务器环境检查完成${NC}"
}

# 上传项目
upload_project() {
    echo -e "${YELLOW}[3/6] 上传项目到服务器...${NC}"
    
    # 创建远程目录
    $SSH_CMD $SERVER_USER@$SERVER_IP "mkdir -p $REMOTE_DIR"
    
    # 同步文件（排除 node_modules, build, .git, 数据库文件）
    if [ ! -z "$SERVER_PASSWORD" ]; then
        rsync -avz --progress -e "sshpass -p $SERVER_PASSWORD ssh -o StrictHostKeyChecking=no" \
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
        rsync -avz --progress -e "ssh -o StrictHostKeyChecking=no" \
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
    
    $SSH_CMD $SERVER_USER@$SERVER_IP << 'ENDSSH'
        cd /home/ubuntu/poker
        
        # 安装依赖
        echo "安装依赖..."
        npm install --production
        
        # 构建服务器项目
        echo "构建服务器项目..."
        npm run build:server
        
        # 重启 PM2
        echo "重启服务..."
        pm2 stop poker 2>/dev/null || true
        pm2 delete poker 2>/dev/null || true
        pm2 start npm --name "poker" -- start
        
        # 保存 PM2 状态
        pm2 save
        
        echo "部署完成!"
ENDSSH
    
    echo -e "${GREEN}✓ 服务器部署完成${NC}"
}

# 配置防火墙
config_firewall() {
    echo -e "${YELLOW}[5/6] 配置防火墙...${NC}"
    
    $SSH_CMD $SERVER_USER@$SERVER_IP "sudo ufw allow $APP_PORT/tcp && sudo ufw reload" 2>/dev/null || true
    
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
    
    check_local
    check_server
    upload_project
    deploy_server
    config_firewall
    show_result
}

main "$@"

