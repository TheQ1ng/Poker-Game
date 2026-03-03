const Database = require('better-sqlite3');
const path = require('path');

// 数据库文件路径
const dbPath = path.join(__dirname, '../../../data/poker.db');

// 创建数据库连接
const db = new Database(dbPath);

// 初始化管理员账户
function initAdmin() {
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

    if (!adminFieldExists) {
      console.error('Admin field does not exist. Please run database migration first.');
      return;
    }

    // 检查是否已有 admin 账户
    const existingAdmin = db.prepare(
      "SELECT * FROM users WHERE username = 'admin'"
    ).get();

    if (existingAdmin) {
      console.log('Admin account already exists.');
      return;
    }

    // 创建 admin 账户
    const stmt = db.prepare(`
      INSERT INTO users (username, password, nickname, avatar, admin, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    stmt.run('admin', 'admin123', '管理员', 'playerIcon.png', 1);
    console.log('Admin account created successfully!');
    console.log('Username: admin');
    console.log('Password: admin123');
  } catch (error) {
    console.error('Error creating admin account:', error);
  } finally {
    db.close();
  }
}

// 运行初始化
initAdmin();
