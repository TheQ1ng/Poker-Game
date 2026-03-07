import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// 数据库文件路径 - 使用项目根目录的绝对路径
const dbPath = path.join(process.cwd(), "data/poker.db");

// 确保 data 目录存在
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 创建数据库连接
const db = new Database(dbPath);
const DAILY_BUYIN_LIMIT = 5;
const BEIJING_UTC_OFFSET_HOURS = 8;
const DAILY_RESET_HOUR_BEIJING = 12;

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
      uuid TEXT DEFAULT '',
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
      uuid TEXT NOT NULL,
      profit INTEGER NOT NULL,
      final_hand TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 玩家记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS player_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_record_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      uuid TEXT NOT NULL,
      nickname TEXT NOT NULL,
      chips INTEGER NOT NULL,
      buy_in INTEGER NOT NULL,
      profit INTEGER NOT NULL,
      FOREIGN KEY (game_record_id) REFERENCES game_records(id)
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

  // 检查并添加 uuid 列（兼容旧数据库）
  try {
    const tableInfo = db.prepare("PRAGMA table_info(users)").all() as Array<{name: string}>;
    const hasUuidColumn = tableInfo.some(col => col.name === 'uuid');
    if (!hasUuidColumn) {
      console.log("检测到旧数据库，添加 uuid 列...");
      db.exec("ALTER TABLE users ADD COLUMN uuid TEXT DEFAULT ''");
      console.log("uuid 列添加成功");
    }
  } catch (e) {
    console.error("迁移 uuid 列失败:", e);
  }

  // 检查并添加每日买入限制相关列（兼容旧数据库）
  try {
    const tableInfo = db.prepare("PRAGMA table_info(users)").all() as Array<{name: string}>;
    const hasDailyUsedColumn = tableInfo.some(col => col.name === "daily_buyin_used");
    if (!hasDailyUsedColumn) {
      console.log("检测到旧数据库，添加 daily_buyin_used 列...");
      db.exec("ALTER TABLE users ADD COLUMN daily_buyin_used INTEGER DEFAULT 0");
      console.log("daily_buyin_used 列添加成功");
    }
    const hasDailyDayKeyColumn = tableInfo.some(col => col.name === "daily_buyin_day_key");
    if (!hasDailyDayKeyColumn) {
      console.log("检测到旧数据库，添加 daily_buyin_day_key 列...");
      db.exec("ALTER TABLE users ADD COLUMN daily_buyin_day_key TEXT DEFAULT ''");
      console.log("daily_buyin_day_key 列添加成功");
    }
  } catch (e) {
    console.error("迁移每日买入限制列失败:", e);
  }

  // 检查并添加 game_records 表的 uuid 列（兼容旧数据库）
  try {
    const tableInfo = db.prepare("PRAGMA table_info(game_records)").all() as Array<{name: string}>;
    const hasUuidColumn = tableInfo.some(col => col.name === 'uuid');
    if (!hasUuidColumn) {
      console.log("检测到旧数据库，添加 game_records.uuid 列...");
      db.exec("ALTER TABLE game_records ADD COLUMN uuid TEXT DEFAULT ''");
      console.log("game_records.uuid 列添加成功");
    }
  } catch (e) {
    console.error("迁移 game_records.uuid 列失败:", e);
  }

  // 检查并添加 player_records 表的 uuid 列（兼容旧数据库）
  try {
    const tableInfo = db.prepare("PRAGMA table_info(player_records)").all() as Array<{name: string}>;
    const hasUuidColumn = tableInfo.some(col => col.name === 'uuid');
    if (!hasUuidColumn) {
      console.log("检测到旧数据库，添加 player_records.uuid 列...");
      db.exec("ALTER TABLE player_records ADD COLUMN uuid TEXT DEFAULT ''");
      console.log("player_records.uuid 列添加成功");
    }
  } catch (e) {
    console.error("迁移 player_records.uuid 列失败:", e);
  }

  // 房间战况日志表
  db.exec(`
    CREATE TABLE IF NOT EXISTS room_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id TEXT NOT NULL,
      log TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建索引加速查询
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_room_logs_room_id ON room_logs(room_id)
  `);

  console.log("数据库初始化完成");
}

// 获取用户信息
export function getUser(username: string): { password: string; nickname: string; avatar: string; admin: number; uuid: string } | undefined {
  const stmt = db.prepare(
    "SELECT password, nickname, avatar, admin, uuid, daily_buyin_used, daily_buyin_day_key FROM users WHERE username = ?"
  );
  const row = stmt.get(username) as
    | {
        password: string;
        nickname: string;
        avatar: string;
        admin: number;
        uuid: string;
        daily_buyin_used?: number;
        daily_buyin_day_key?: string;
      }
    | undefined;
  return row;
}

// 创建或更新用户
export function saveUser(username: string, password: string, nickname: string = "", avatar: string = "", admin: number = 0, uuid: string = "") {
  const stmt = db.prepare(`
    INSERT INTO users (username, password, nickname, avatar, admin, uuid, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(username) DO UPDATE SET
      password = excluded.password,
      nickname = excluded.nickname,
      avatar = excluded.avatar,
      admin = excluded.admin,
      uuid = excluded.uuid,
      updated_at = CURRENT_TIMESTAMP
  `);
  stmt.run(username, password, nickname, avatar, admin, uuid);
}

// 更新用户资料
export function updateUserProfile(username: string, nickname: string, avatar: string, admin: number = 0, uuid: string = "") {
  const stmt = db.prepare(`
    UPDATE users SET nickname = ?, avatar = ?, admin = ?, uuid = ?, updated_at = CURRENT_TIMESTAMP
    WHERE username = ?
  `);
  stmt.run(nickname, avatar, admin, uuid, username);
}

// 获取用户资料
export function getUserProfile(username: string): { nickname: string; avatar: string; admin: number; uuid: string } | undefined {
  const stmt = db.prepare("SELECT nickname, avatar, admin, uuid FROM users WHERE username = ?");
  return stmt.get(username) as { nickname: string; avatar: string; admin: number; uuid: string } | undefined;
}

// 检查昵称是否已存在
export function isNicknameExists(nickname: string, excludeUsername: string = ""): boolean {
  console.log('isNicknameExists:', { nickname, excludeUsername });
  const stmt = db.prepare("SELECT COUNT(*)  as count FROM users WHERE nickname = ? AND username != ?");
  const result = stmt.get(nickname, excludeUsername) as { count: number };
  console.log('查询结果:', result);
  return result.count > 0;
}

// 保存游戏记录
export function saveGameRecord(roomId: string, username: string, uuid: string, profit: number, finalHand: string) {
  const stmt = db.prepare(`
    INSERT INTO game_records (room_id, username, uuid, profit, final_hand)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(roomId, username, uuid, profit, finalHand);
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

// 保存房间战况日志
export function saveRoomLog(roomId: string, log: string) {
  const stmt = db.prepare(`
    INSERT INTO room_logs (room_id, log)
    VALUES (?, ?)
  `);
  stmt.run(roomId, log);
}

// 批量保存房间战况日志
export function saveRoomLogs(roomId: string, logs: string[]) {
  const insert = db.prepare(`
    INSERT INTO room_logs (room_id, log)
    VALUES (?, ?)
  `);
  const insertMany = db.transaction((logsToInsert: string[]) => {
    for (const log of logsToInsert) {
      insert.run(roomId, log);
    }
  });
  insertMany(logs);
}

// 获取房间的所有战况日志（按时间顺序）
export function getRoomLogs(roomId: string): string[] {
  const stmt = db.prepare(`
    SELECT log
    FROM room_logs
    WHERE room_id = ?
    ORDER BY created_at ASC
  `);
  const rows = stmt.all(roomId) as Array<{log: string}>;
  return rows.map(row => row.log);
}

// 清理房间的旧日志（保留最近500条）
export function cleanupOldRoomLogs(roomId: string, keepCount: number = 500) {
  const countStmt = db.prepare(`
    SELECT COUNT(*) as count FROM room_logs WHERE room_id = ?
  `);
  const { count } = countStmt.get(roomId) as { count: number };
  
  if (count > keepCount) {
    const deleteStmt = db.prepare(`
      DELETE FROM room_logs
      WHERE id IN (
        SELECT id FROM room_logs
        WHERE room_id = ?
        ORDER BY created_at ASC
        LIMIT ?
      )
    `);
    deleteStmt.run(roomId, count - keepCount);
  }
}

// 通过uuid获取用户信息
export function getUserByUuid(uuid: string): { username: string; nickname: string; avatar: string; admin: number } | undefined {
  const stmt = db.prepare("SELECT username, nickname, avatar, admin FROM users WHERE uuid = ?");
  return stmt.get(uuid) as { username: string; nickname: string; avatar: string; admin: number } | undefined;
}

function pad2(v: number): string {
  return v < 10 ? `0${v}` : `${v}`;
}

// 以北京时间 12:00 为自然日分界：12:00~次日11:59 视作同一天
export function getDailyBuyInDayKey(nowMs: number = Date.now()): string {
  const shiftedMs =
    nowMs +
    BEIJING_UTC_OFFSET_HOURS * 3600 * 1000 -
    DAILY_RESET_HOUR_BEIJING * 3600 * 1000;
  const d = new Date(shiftedMs);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return `${y}-${pad2(m)}-${pad2(day)}`;
}

export function getDailyBuyInState(username: string): {
  persisted: boolean;
  dayKey: string;
  used: number;
  remaining: number;
} {
  const row = db
    .prepare("SELECT daily_buyin_used, daily_buyin_day_key FROM users WHERE username = ?")
    .get(username) as { daily_buyin_used?: number; daily_buyin_day_key?: string } | undefined;
  const dayKey = getDailyBuyInDayKey();
  if (!row) {
    return {
      persisted: false,
      dayKey,
      used: 0,
      remaining: DAILY_BUYIN_LIMIT,
    };
  }
  let used = Math.max(0, Math.floor(Number(row.daily_buyin_used) || 0));
  if ((row.daily_buyin_day_key || "") !== dayKey) {
    used = 0;
    db.prepare(
      "UPDATE users SET daily_buyin_used = 0, daily_buyin_day_key = ?, updated_at = CURRENT_TIMESTAMP WHERE username = ?"
    ).run(dayKey, username);
  }
  return {
    persisted: true,
    dayKey,
    used,
    remaining: Math.max(0, DAILY_BUYIN_LIMIT - used),
  };
}

export function consumeDailyBuyInAttempt(username: string): {
  persisted: boolean;
  dayKey: string;
  used: number;
  remaining: number;
  isFifth: boolean;
} {
  const state = getDailyBuyInState(username);
  if (!state.persisted) {
    return {
      ...state,
      isFifth: false,
    };
  }
  if (state.used >= DAILY_BUYIN_LIMIT) {
    throw `今日买入次数已用完（上限 ${DAILY_BUYIN_LIMIT} 次）`;
  }
  const used = state.used + 1;
  db.prepare(
    "UPDATE users SET daily_buyin_used = ?, daily_buyin_day_key = ?, updated_at = CURRENT_TIMESTAMP WHERE username = ?"
  ).run(used, state.dayKey, username);
  return {
    persisted: true,
    dayKey: state.dayKey,
    used,
    remaining: Math.max(0, DAILY_BUYIN_LIMIT - used),
    isFifth: used === DAILY_BUYIN_LIMIT,
  };
}

export default db;
