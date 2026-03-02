import Router from "@koa/router";
import * as jwt from "jsonwebtoken";
import { secret } from "../config";
import { createRoom, roomMap, userEnterRoom, userMap, getAllRooms, createUser } from "../service";
import { getUserProfile, updateUserProfile, saveUser, getUser } from "../service/database";
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
    }
    ctx.data = token;
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
    saveUser(name, password, "", finalAvatar);
    const token = jwt.sign(name + "@" + password, secret);
    createUser(token, name, finalAvatar);
    ctx.data = token;
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
    updateUserProfile(username, userMap[token].nickname || "", randomAvatar);
  }

  ctx.data = {
    name: userMap[token].name,
    nickname: userMap[token].nickname,
    avatar: userMap[token].avatar,
  };
});
