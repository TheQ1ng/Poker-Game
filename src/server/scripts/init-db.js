const Database = require('better-sqlite3');
const path = require('path');

// 数据库文件路径
const dbPath = path.join(__dirname, '../../../data/poker.db');

// 确保 data 目录存在
const dataDir = path.dirname(dbPath);
const fs = require('fs');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 创建数据库连接
const db = new Database(dbPath);

// 初始化数据库表
function initDatabase() {
  try {
    // 用户表
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        password TEXT DEFAULT '',
        nickname TEXT DEFAULT '',
        avatar TEXT DEFAULT '',
        admin INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 游戏记录表
    db.exec(`
      CREATE TABLE IF NOT EXISTS game_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id TEXT NOT NULL,
        username TEXT NOT NULL,
        profit INTEGER NOT NULL,
        final_hand TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('数据库初始化完成');
  } catch (error) {
    console.error('数据库初始化错误:', error);
  } finally {
    db.close();
  }
}

// 运行初始化
initDatabase();
