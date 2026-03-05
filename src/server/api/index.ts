import Router from "@koa/router";
import * as jwt from "jsonwebtoken";
import { secret } from "../config";
import { createRoom, roomMap, userEnterRoom, userMap, getAllRooms, createUser } from "../service";
import { getUserProfile, updateUserProfile, saveUser, getUser, isNicknameExists } from "../service/database";
import db from "../service/database";
import User from "../service/User";

const router = new Router();
export default router;

router.get("/root", (ctx) => {
  ctx.body = "api root";
});

router.get("/json", (ctx) => {
  ctx.data = {
    name: "maxwin",
  };
});

// router.get("/debug", (ctx) => {
//   ctx.data = {
//     users: userMap,
//     rooms: roomMap,
//   };
// });

// 获取所有房间列表
router.get("/rooms", (ctx) => {
  ctx.body = {
    rooms: getAllRooms()
  };
});

router.post("/register", (ctx) => {
  console.log('[DEBUG] Register API called, body:', ctx.request.body);
  const { name, password, avatar } = ctx.request.body;
  if (name === null || name === "") {
    throw new Error(`register name is empty`);
  }
  if (name.indexOf("@") !== -1) {
    throw new Error(`用户名不能有特殊字符`);
  }
  if (password === null || password === "") {
    throw new Error(`password is empty`);
  }

  // 从数据库检查用户名是否已存在
  const existingUser = getUser(name);
  if (existingUser) {
    // 用户已存在，验证密码
    if (existingUser.password !== password) {
      throw new Error(`密码错误`);
    }
    // 如果数据库里还没有头像，为其随机分配一个默认头像并持久化
    let finalAvatar = existingUser.avatar;
    if (!finalAvatar) {
      const defaultAvatars = [
        "playerIcon.png",
        "playerIcon (1).png",
        "playerIcon (2).png",
        "playerIcon (3).png",
        "playerIcon (4).png",
        "playerIcon (5).png",
        "playerIcon (6).png",
        "playerIcon (7).png",
        "playerIcon (8).png",
      ];
      const randomIndex = Math.floor(Math.random() * defaultAvatars.length);
      finalAvatar = defaultAvatars[randomIndex];
      updateUserProfile(name, existingUser.nickname || "", finalAvatar);
    }

    // 密码正确，生成token返回
    const token = jwt.sign(name + "@" + password, secret);
    const isAdminValue = existingUser.admin === 1;
    if (!userMap[token]) {
      const user = createUser(token, name, finalAvatar);
      user.nickname = existingUser.nickname;
      user.isAdmin = isAdminValue;
    } else {
      // 更新现有用户的信息，包括 isAdmin
      userMap[token].name = name;
      userMap[token].avatar = finalAvatar;
      userMap[token].nickname = existingUser.nickname;
      userMap[token].isAdmin = isAdminValue;
    }
    ctx.data = { token, isAdmin: isAdminValue };
    console.log('[DEBUG] Existing user login success, token:', token?.substring(0, 10) + '...', 'isAdmin:', isAdminValue);
  } else {
    // 用户不存在，创建新用户并保存到数据库
    let finalAvatar = avatar || "";
    if (!finalAvatar) {
      const defaultAvatars = [
        "playerIcon.png",
        "playerIcon (1).png",
        "playerIcon (2).png",
        "playerIcon (3).png",
        "playerIcon (4).png",
        "playerIcon (5).png",
        "playerIcon (6).png",
        "playerIcon (7).png",
        "playerIcon (8).png",
      ];
      const randomIndex = Math.floor(Math.random() * defaultAvatars.length);
      finalAvatar = defaultAvatars[randomIndex];
    }
    saveUser(name, password, "", finalAvatar, 0);
    const token = jwt.sign(name + "@" + password, secret);
    const user = createUser(token, name, finalAvatar);
    user.isAdmin = false;
    ctx.data = { token, isAdmin: false };
    console.log('[DEBUG] New user register success, token:', token?.substring(0, 10) + '...');
  }
});

router.get("/currentroom", (ctx) => {
  const token = ctx.header.authorization;
  if (!token) throw "need login";
  if (!userMap[token]) {
    createUser(token, ctx.user, "");
  }
  ctx.data = userMap[token].roomid || null;
});

router.post("/createroom", (ctx) => {
  const token = ctx.header.authorization;
  if (!token) throw "need login";
  if (!userMap[token]) {
    createUser(token, ctx.user, "");
  }
  const {
    sb,
    buyin,
    reBuyLimit,
    isShortDeck,
    isOmaha,
    redPacketThresholdMultiple,
    redPacketMaxPercent,
  } = ctx.request.body;
  const room = createRoom(
    token,
    sb,
    buyin,
    reBuyLimit,
    !!isShortDeck,
    !!isOmaha,
    Number(redPacketThresholdMultiple ?? 1),
    Number(redPacketMaxPercent ?? 30)
  );
  ctx.data = room.id;
});

router.post("/joinroom", (ctx) => {
  const token = ctx.header.authorization;
  if (!token) throw "need login";
  if (!userMap[token]) {
    createUser(token, ctx.user, "");
  }
  const { roomid } = ctx.request.body;
  userEnterRoom(token, roomid);
  ctx.data = roomid;
});

// 更新用户资料
router.post("/updateprofile", (ctx) => {
  const token = ctx.header.authorization;
  if (!token) throw "need login";
  if (!userMap[token]) {
    createUser(token, ctx.user, "");
  }
  const { nickname, avatar } = ctx.request.body;
  const username = userMap[token].name;
  
  // 更新数据库中的用户资料
  if (nickname !== undefined) {
    // 检查昵称是否已被其他用户使用
    console.log('检查昵称是否已存在:', { nickname, username });
    const exists = isNicknameExists(nickname, username);
    console.log('昵称是否已存在:', exists);
    if (nickname && exists) {
      throw "昵称已被使用，请选择其他昵称";
    }
    userMap[token].nickname = nickname;
  }
  if (avatar !== undefined) {
    userMap[token].avatar = avatar;
  }
  if (avatar !== undefined) {
    userMap[token].avatar = avatar;
  }
  updateUserProfile(username, userMap[token].nickname, userMap[token].avatar);
  
  ctx.data = { nickname: userMap[token].nickname, avatar: userMap[token].avatar };
});

// 获取用户资料
router.get("/profile", (ctx) => {
  const token = ctx.header.authorization;
  if (!token) throw "need login";
  if (!userMap[token]) {
    createUser(token, ctx.user, "");
  }
  
  // 从数据库加载最新资料
  const username = userMap[token].name;
  const userProfile = getUserProfile(username);
  console.log("getUserProfile:", username, userProfile);
  if (userProfile) {
    userMap[token].nickname = userProfile.nickname || "";
    userMap[token].avatar = userProfile.avatar || "";
    userMap[token].isAdmin = userProfile.admin === 1;
  }

  // 如果用户资料里依然没有头像（例如老数据），在登录态下兜底分配一个默认头像并持久化
  if (!userMap[token].avatar) {
    const defaultAvatars = [
      "playerIcon.png",
      "playerIcon (1).png",
      "playerIcon (2).png",
      "playerIcon (3).png",
      "playerIcon (4).png",
      "playerIcon (5).png",
      "playerIcon (6).png",
      "playerIcon (7).png",
      "playerIcon (8).png",
    ];
    const randomIndex = Math.floor(Math.random() * defaultAvatars.length);
    const randomAvatar = defaultAvatars[randomIndex];
    userMap[token].avatar = randomAvatar;
    updateUserProfile(username, userMap[token].nickname || "", randomAvatar, userMap[token].isAdmin ? 1 : 0);
  }

  ctx.data = {
    name: userMap[token].name,
    nickname: userMap[token].nickname,
    avatar: userMap[token].avatar,
    isAdmin: userMap[token].isAdmin,
  };
});

// 管理员接口：获取所有用户
router.get("/admin/users", (ctx) => {
  const token = ctx.header.authorization;
  if (!token) throw "need login";
  if (!userMap[token] || !userMap[token].isAdmin) throw "not admin";
  
  // 从数据库获取所有用户
  const stmt = db.prepare("SELECT username, nickname, avatar, admin, created_at FROM users");
  const users = stmt.all();
  ctx.data = users;
});

// 管理员接口：获取所有游戏记录
router.get("/admin/game-records", (ctx) => {
  const token = ctx.header.authorization;
  if (!token) throw "need login";
  if (!userMap[token] || !userMap[token].isAdmin) throw "not admin";
  
  // 从数据库获取所有游戏记录
  const stmt = db.prepare("SELECT * FROM game_records ORDER BY created_at DESC");
  const records = stmt.all();
  
  ctx.data = records;
});

// 管理员接口：更新用户信息
router.post("/admin/user/update", (ctx) => {
  const token = ctx.header.authorization;
  if (!token) throw "need login";
  if (!userMap[token] || !userMap[token].isAdmin) throw "not admin";
  
  const { username, nickname, avatar, admin } = ctx.request.body;
  if (!username) throw "username is required";
  
  // 更新用户信息
  const stmt = db.prepare(`
    UPDATE users SET nickname = ?, avatar = ?, admin = ?, updated_at = CURRENT_TIMESTAMP
    WHERE username = ?
  `);
  stmt.run(nickname, avatar, admin, username);
  ctx.data = { success: true };
});

// 管理员接口：删除用户
router.post("/admin/user/delete", (ctx) => {
  const token = ctx.header.authorization;
  if (!token) throw "need login";
  if (!userMap[token] || !userMap[token].isAdmin) throw "not admin";
  
  const { username } = ctx.request.body;
  if (!username || username === "admin") throw "invalid username";
  
  // 删除用户
  const stmt = db.prepare("DELETE FROM users WHERE username = ?");
  stmt.run(username);
  ctx.data = { success: true };
});

// 管理员接口：获取房间列表
router.get("/admin/rooms", (ctx) => {
  const token = ctx.header.authorization;
  if (!token) throw "need login";
  if (!userMap[token] || !userMap[token].isAdmin) throw "not admin";
  
  // 从roomMap中获取房间信息
  const rooms = Object.values(roomMap).map(room => {
    return {
      id: room.id,
      sb: room.smallBlind,
      buyin: room.buyIn,
      reBuyLimit: room.reBuyLimit,
      isShortDeck: room.isShortDeck,
      isOmaha: room.isOmaha,
      players: room.users.map(token => {
        const user = userMap[token];
        return {
          name: user.name,
          nickname: user.nickname,
          avatar: user.avatar,
          stack: user.stack,
          isOwner: user.isRoomOwner,
          isReady: user.isReady
        };
      }),
      isActive: room?.isGaming || false
    };
  });
  
  ctx.data = rooms;
});

// 管理员接口：解散房间
router.post("/admin/room/dissolve", (ctx) => {
  const token = ctx.header.authorization;
  if (!token) throw "need login";
  if (!userMap[token] || !userMap[token].isAdmin) throw "not admin";
  
  const { roomId } = ctx.request.body;
  if (!roomId) throw "roomId is required";
  
  const room = roomMap[roomId];
  if (!room) throw "room not found";
  
  // 解散房间，将所有用户移出房间
  room.users.forEach(token => {
    const user = userMap[token];
    user.leaveRoom();
  });
  
  // 从roomMap中删除房间
  delete roomMap[roomId];
  
  ctx.data = { success: true };
});

// 保存积分榜接口（房主和管理员都可以）
router.post("/admin/save-chips-record", (ctx) => {
  const token = ctx.header.authorization;
  if (!token) throw "need login";
  if (!userMap[token]) throw "user not found";
  
  const { roomId, chipsRecords } = ctx.request.body;
  if (!roomId || !chipsRecords || !Array.isArray(chipsRecords)) throw "invalid request";
  
  // 检查用户是否是房主或管理员
  const user = userMap[token];
  const room = roomMap[roomId];
  if (!room) throw "room not found";
  
  // 验证用户是否是房主或管理员
  if (!user.isAdmin && !room.users.some(u => u === token && userMap[u]?.isRoomOwner)) {
    throw "only room owner or admin can save chips record";
  }
  
  try {
    // 开始事务
    db.exec('BEGIN TRANSACTION');
    
    // 插入游戏记录
    const gameRecordStmt = db.prepare(`
      INSERT INTO game_records (room_id, username, profit, created_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `);
    const gameRecordResult = gameRecordStmt.run(roomId, user.name, 0);
    const gameRecordId = gameRecordResult.lastInsertRowid;
    
    // 插入玩家记录
    const playerRecordStmt = db.prepare(`
      INSERT INTO player_records (game_record_id, username, nickname, chips, buy_in, profit)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    chipsRecords.forEach(record => {
      playerRecordStmt.run(
        gameRecordId,
        record.username,
        record.nickname,
        record.chips,
        record.buyIn,
        record.profit
      );
    });
    
    // 提交事务
    db.exec('COMMIT');
    
    ctx.data = { success: true, gameRecordId };
  } catch (error) {
    // 回滚事务
    db.exec('ROLLBACK');
    throw error;
  }
});

// 管理员接口：获取游戏记录的玩家记录
router.get("/admin/game-record/:id/players", (ctx) => {
  const token = ctx.header.authorization;
  if (!token) throw "need login";
  if (!userMap[token] || !userMap[token].isAdmin) throw "not admin";
  
  const gameRecordId = ctx.params.id;
  if (!gameRecordId) throw "game record id is required";
  
  // 查询玩家记录
  const stmt = db.prepare(`
    SELECT * FROM player_records 
    WHERE game_record_id = ? 
    ORDER BY profit DESC
  `);
  const playerRecords = stmt.all(gameRecordId);
  
  ctx.data = playerRecords;
});

// 管理员接口：获取汇总积分榜
router.post("/admin/summary-scoreboard", (ctx) => {
  const token = ctx.header.authorization;
  if (!token) throw "need login";
  if (!userMap[token] || !userMap[token].isAdmin) throw "not admin";
  
  const { roomIds } = ctx.request.body;
  if (!roomIds || !Array.isArray(roomIds)) throw "invalid request";
  
  // 查询指定房间的所有游戏记录
  const gameRecordStmt = db.prepare(`
    SELECT id FROM game_records 
    WHERE room_id IN (${roomIds.map(() => '?').join(',')})
  `);
  const gameRecords = gameRecordStmt.all(...roomIds);
  const gameRecordIds = gameRecords.map((record: any) => record.id);
  
  if (gameRecordIds.length === 0) {
    ctx.data = [];
    return;
  }
  
  // 查询这些游戏记录的所有玩家记录
  const playerRecordStmt = db.prepare(`
    SELECT * FROM player_records 
    WHERE game_record_id IN (${gameRecordIds.map(() => '?').join(',')})
  `);
  const playerRecords = playerRecordStmt.all(...gameRecordIds);
  
  // 汇总数据
  const summaryMap = new Map<string, any>();
  playerRecords.forEach((record: any) => {
    if (!summaryMap.has(record.username)) {
      summaryMap.set(record.username, {
        username: record.username,
        nicknames: [],
        totalProfit: 0,
        gameCount: 0,
      });
    }
    const user = summaryMap.get(record.username);
    user.nicknames.push(record.nickname);
    user.totalProfit += record.profit;
    user.gameCount += 1;
  });
  
  // 转换为数组并按总积分排序
  const summaryStats = Array.from(summaryMap.values());
  summaryStats.sort((a, b) => b.totalProfit - a.totalProfit);
  
  ctx.data = summaryStats;
});
