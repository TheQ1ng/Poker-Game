#!/bin/bash

# 德州扑克游戏 - 服务器端一键部署脚本
# 如果服务器上已有代码，在服务器上直接运行此脚本即可完成部署

set -e

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

APP_PORT="8086"
PROJECT_DIR="/home/theq1ng/poker"

echo -e "${GREEN}=== 德州扑克服务器端部署脚本 ===${NC}"

# 检查 Node.js
check_nodejs() {
    echo -e "${YELLOW}[1/5] 检查 Node.js 环境...${NC}"
    
    if ! command -v node &> /dev/null; then
        echo -e "${YELLOW}安装 Node.js 18...${NC}"
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
    
    echo -e "${GREEN}✓ Node.js $(node -v) 已安装${NC}"
}

# 安装 PM2
install_pm2() {
    echo -e "${YELLOW}[2/5] 检查 PM2...${NC}"
    
    if ! command -v pm2 &> /dev/null; then
        echo -e "${YELLOW}安装 PM2...${NC}"
        sudo npm install -g pm2
    fi
    
    # 设置开机自启
    pm2 startup 2>/dev/null || true
    
    echo -e "${GREEN}✓ PM2 已安装${NC}"
}

# 拉取代码（如果使用 Git）
update_code() {
    echo -e "${YELLOW}[3/5] 更新代码...${NC}"
    
    if [ -d "$PROJECT_DIR/.git" ]; then
        cd $PROJECT_DIR
        git pull origin main 2>/dev/null || git pull origin master 2>/dev/null || echo "无法拉取代码，请手动更新"
    else
        echo -e "${YELLOW}未找到 Git 仓库，请手动上传代码到 $PROJECT_DIR${NC}"
    fi
    
    echo -e "${GREEN}✓ 代码更新完成${NC}"
}

# 安装依赖并构建
build_project() {
    echo -e "${YELLOW}[4/5] 安装依赖并构建...${NC}"
    
    cd $PROJECT_DIR
    
    # 安装依赖
    npm install --production
    
    # 构建
    npm run build
    
    echo -e "${GREEN}✓ 构建完成${NC}"
}

# 启动服务
start_service() {
    echo -e "${YELLOW}[5/5] 启动服务...${NC}"
    
    cd $PROJECT_DIR
    
    # 停止旧服务
    pm2 stop poker 2>/dev/null || true
    pm2 delete poker 2>/dev/null || true
    
    # 启动新服务
    pm2 start npm --name "poker" -- start
    
    # 保存状态
    pm2 save
    
    # 查看状态
    pm2 status
    
    echo -e "${GREEN}✓ 服务启动完成${NC}"
}

# 配置防火墙
setup_firewall() {
    echo -e "${YELLOW}配置防火墙...${NC}"
    sudo ufw allow $APP_PORT/tcp 2>/dev/null || true
    sudo ufw reload 2>/dev/null || true
    echo -e "${GREEN}✓ 防火墙配置完成${NC}"
}

# 主流程
main() {
    check_nodejs
    install_pm2
    update_code
    build_project
    start_service
    setup_firewall
    
    echo ""
    echo -e "${GREEN}======================================${NC}"
    echo -e "${GREEN}  部署完成!${NC}"
    echo -e "${GREEN}======================================${NC}"
    echo ""
    echo "访问地址: http://你的服务器IP:$APP_PORT"
    echo ""
    echo "常用命令:"
    echo "  查看日志: pm2 logs poker"
    echo "  重启服务: pm2 restart poker"
    echo "  查看状态: pm2 status"
}

main "$@"

