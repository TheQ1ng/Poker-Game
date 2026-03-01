#!/bin/bash

# 欢乐积分王训练系统 - 关闭云端服务器脚本

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

# SSH 命令前缀
SSH_CMD="sshpass -p $SERVER_PASSWORD ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP"

echo -e "${GREEN}=== 欢乐积分王训练系统 - 关闭云端服务器 ===${NC}"

echo -e "${YELLOW}[1/2] 连接服务器...${NC}"

# 停止并删除 PM2 进程
echo -e "${YELLOW}[2/2] 停止服务...${NC}"
$SSH_CMD "pm2 stop poker 2>/dev/null || true && pm2 delete poker 2>/dev/null || true"

echo -e "${GREEN}✓ 服务器已成功关闭${NC}"
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  操作完成！${NC}"
echo -e "${GREEN}======================================${NC}"
