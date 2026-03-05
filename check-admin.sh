#!/bin/bash

# 检查并更新 admin 用户的 admin 字段
sshpass -p '6*5z}%CAh^8D{4Ev' ssh -t -o StrictHostKeyChecking=no ubuntu@111.229.164.165 << 'EOF'
echo "=== 检查 admin 用户状态 ==="
sqlite3 ~/poker/data/poker.db "SELECT * FROM users WHERE username = 'admin';"
echo "\n=== 更新 admin 用户为管理员 ==="
sqlite3 ~/poker/data/poker.db "UPDATE users SET admin = 1 WHERE username = 'admin';"
echo "\n=== 更新后的状态 ==="
sqlite3 ~/poker/data/poker.db "SELECT * FROM users WHERE username = 'admin';"
echo "\n=== 所有用户列表 ==="
sqlite3 ~/poker/data/poker.db "SELECT username, admin FROM users;"
EOF