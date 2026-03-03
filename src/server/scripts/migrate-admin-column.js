const Database = require('better-sqlite3');
const path = require('path');

// 数据库文件路径
const dbPath = path.join(__dirname, '../../../data/poker.db');

// 创建数据库连接
const db = new Database(dbPath);

// 迁移脚本：添加 admin 列
function migrateAdminColumn() {
  try {
    // 检查 users 表是否存在
    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
    ).get();

    if (!tableExists) {
      console.error('Users table does not exist. Please run database initialization first.');
      return;
    }

    // 检查 admin 字段是否存在
    const adminFieldExists = db.prepare(
      "PRAGMA table_info(users)"
    ).all().some(column => column.name === 'admin');

    if (adminFieldExists) {
      console.log('Admin column already exists.');
      return;
    }

    // 添加 admin 列
    db.prepare(
      "ALTER TABLE users ADD COLUMN admin INTEGER DEFAULT 0"
    ).run();

    console.log('Admin column added successfully!');

    // 检查是否已有 admin 账户
    const existingAdmin = db.prepare(
      "SELECT * FROM users WHERE username = 'admin'"
    ).get();

    if (!existingAdmin) {
      // 创建 admin 账户
      const stmt = db.prepare(`
        INSERT INTO users (username, password, nickname, avatar, admin, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);

      stmt.run('admin', 'admin123', '管理员', 'playerIcon.png', 1);
      console.log('Admin account created successfully!');
      console.log('Username: admin');
      console.log('Password: admin123');
    } else {
      // 更新现有 admin 账户的 admin 字段
      db.prepare(
        "UPDATE users SET admin = 1 WHERE username = 'admin'"
      ).run();
      console.log('Admin account updated successfully!');
    }

  } catch (error) {
    console.error('Error migrating admin column:', error);
  } finally {
    db.close();
  }
}

// 运行迁移
migrateAdminColumn();
