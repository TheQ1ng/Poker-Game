#!/bin/bash

# 修复 admin 用户的 admin 字段
echo "=== 修复 admin 用户状态 ==="

# 创建并执行 SQL 脚本
cat > fix_admin.sql << 'EOF'
UPDATE users SET admin = 1 WHERE username = 'admin';
SELECT * FROM users WHERE username = 'admin';
SELECT username, admin FROM users;
EOF

# 执行 SQL 脚本
sqlite3 ~/poker/data/poker.db < fix_admin.sql

# 清理临时文件
rm fix_admin.sql

echo "=== 修复完成 ==="
