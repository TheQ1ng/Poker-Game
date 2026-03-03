import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// 数据库文件路径
const dbPath = path.join(__dirname, "../../../data/poker.db");

// 确保 data 目录存在
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 创建数据库连接
const db = new Database(dbPath);

// 初始化数据库表
export function initDatabase() {
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

  // 检查并添加 admin 列（兼容旧数据库）
  try {
    const tableInfo = db.prepare("PRAGMA table_info(users)").all() as Array<{name: string}>;
    const hasAdminColumn = tableInfo.some(col => col.name === 'admin');
    if (!hasAdminColumn) {
      console.log("检测到旧数据库，添加 admin 列...");
      db.exec("ALTER TABLE users ADD COLUMN admin INTEGER DEFAULT 0");
      console.log("admin 列添加成功");
    }
  } catch (e) {
    console.error("迁移 admin 列失败:", e);
  }

  console.log("数据库初始化完成");
}

// 获取用户信息
export function getUser(username: string): { password: string; nickname: string; avatar: string; admin: number } | undefined {
  const stmt = db.prepare("SELECT password, nickname, avatar, admin FROM users WHERE username = ?");
  const row = stmt.get(username) as { password: string; nickname: string; avatar: string; admin: number } | undefined;
  return row;
}

// 创建或更新用户
export function saveUser(username: string, password: string, nickname: string = "", avatar: string = "", admin: number = 0) {
  const stmt = db.prepare(`
    INSERT INTO users (username, password, nickname, avatar, admin, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(username) DO UPDATE SET
      password = excluded.password,
      nickname = excluded.nickname,
      avatar = excluded.avatar,
      admin = excluded.admin,
      updated_at = CURRENT_TIMESTAMP
  `);
  stmt.run(username, password, nickname, avatar, admin);
}

// 更新用户资料
export function updateUserProfile(username: string, nickname: string, avatar: string, admin: number = 0) {
  const stmt = db.prepare(`
    UPDATE users SET nickname = ?, avatar = ?, admin = ?, updated_at = CURRENT_TIMESTAMP
    WHERE username = ?
  `);
  stmt.run(nickname, avatar, admin, username);
}

// 获取用户资料
export function getUserProfile(username: string): { nickname: string; avatar: string; admin: number } | undefined {
  const stmt = db.prepare("SELECT nickname, avatar, admin FROM users WHERE username = ?");
  return stmt.get(username) as { nickname: string; avatar: string; admin: number } | undefined;
}

// 检查昵称是否已存在
export function isNicknameExists(nickname: string, excludeUsername: string = ""): boolean {
  console.log('isNicknameExists:', { nickname, excludeUsername });
  const stmt = db.prepare("SELECT COUNT(*) as count FROM users WHERE nickname = ? AND username != ?");
  const result = stmt.get(nickname, excludeUsername) as { count: number };
  console.log('查询结果:', result);
  return result.count > 0;
}

// 保存游戏记录
export function saveGameRecord(roomId: string, username: string, profit: number, finalHand: string) {
  const stmt = db.prepare(`
    INSERT INTO game_records (room_id, username, profit, final_hand)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(roomId, username, profit, finalHand);
}

// 获取用户的游戏记录
export function getUserGameRecords(username: string, limit: number = 20) {
  const stmt = db.prepare(`
    SELECT room_id, profit, final_hand, created_at
    FROM game_records
    WHERE username = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);
  return stmt.all(username, limit);
}

// 获取所有游戏记录
export function getAllGameRecords(limit: number = 50) {
  const stmt = db.prepare(`
    SELECT room_id, username, profit, final_hand, created_at
    FROM game_records
    ORDER BY created_at DESC
    LIMIT ?
  `);
  return stmt.all(limit);
}

export default db;

