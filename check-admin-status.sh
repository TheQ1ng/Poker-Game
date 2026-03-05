#!/bin/bash

# 检查并修复 admin 用户的 admin 字段
echo "=== 检查 admin 用户状态 ==="

# 执行 SQL 命令
sqlite3 ~/poker/data/poker.db "SELECT * FROM users WHERE username = 'admin';"
sqlite3 ~/poker/data/poker.db "UPDATE users SET admin = 1 WHERE username = 'admin';"
sqlite3 ~/poker/data/poker.db "SELECT * FROM users WHERE username = 'admin';"
sqlite3 ~/poker/data/poker.db "SELECT username, admin FROM users;"

echo "=== 操作完成 ==="
