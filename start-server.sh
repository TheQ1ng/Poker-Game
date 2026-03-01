#!/bin/bash

# 欢乐积分王训练系统 - 开启云端服务器脚本

set -e

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 服务器配置
SERVER_IP="111.229.164.165"
SERVER_PASSWORD="6*5z}%CAh^8D{4Ev"
SERVER_USER="ubuntu"
APP_PORT="8086"

# SSH 命令前缀
SSH_CMD="sshpass -p $SERVER_PASSWORD ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP"

echo -e "${GREEN}=== 欢乐积分王训练系统 - 开启云端服务器 ===${NC}"

echo -e "${YELLOW}[1/3] 连接服务器...${NC}"

# 启动 PM2 服务
echo -e "${YELLOW}[2/3] 启动服务...${NC}"
$SSH_CMD "cd /home/ubuntu/poker && pm2 start npm --name \"poker\" -- start"

# 保存 PM2 状态
echo -e "${YELLOW}[3/3] 保存状态...${NC}"
$SSH_CMD "pm2 save"

echo -e "${GREEN}✓ 服务器已成功启动${NC}"
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  游戏地址: http://$SERVER_IP:$APP_PORT${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo "常用命令:"
echo "  查看日志: pm2 logs poker"
echo "  重启服务: pm2 restart poker"
echo "  停止服务: pm2 stop poker"
