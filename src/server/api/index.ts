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
    if (!userMap[token]) {
      const user = createUser(token, name, finalAvatar);
      user.nickname = existingUser.nickname;
      user.isAdmin = existingUser.admin === 1;
    }
    ctx.data = { token, isAdmin: existingUser.admin === 1 };
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
  const { sb, buyin, reBuyLimit, isShortDeck, isOmaha } = ctx.request.body;
  const room = createRoom(token, sb, buyin, reBuyLimit, !!isShortDeck, !!isOmaha);
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
  
  // 为每条记录添加nickname字段
  const recordsWithNickname = records.map((record: any) => {
    // 从数据库获取用户信息
    const userProfile = getUserProfile(record.username);
    return {
      ...record,
      nickname: userProfile?.nickname || record.username
    };
  });
  
  ctx.data = recordsWithNickname;
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
