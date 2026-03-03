import User, { Token } from "./User";
import Room, { RoomID } from "./Room";
import { PokerWebSocket, publishLog2all, send2all, send2user, publish2all } from "../api/ws";
import { getUser, saveUser, getUserProfile, updateUserProfile, initDatabase } from "./database";
import { v4 as uuidv4 } from "uuid";

type UserMap = {
  [token: string]: User;
};
type RoomMap = {
  [roomid: string]: Room;
};

// 初始化数据库
initDatabase();

export const userMap: UserMap = {};

export const roomMap: RoomMap = {};

function rand4str(): string {
  let id = `${Math.floor(Math.random() * 10000)}`;
  while (id.length < 4) {
    id = `0${id}`;
  }
  id = id.replace(/4/g, "8");
  return id;
}

function genRoomID(): string {
  let id = rand4str();
  while (roomMap[id]) {
    id = rand4str();
  }
  return id;
}

export function createUser(token: Token, name: string, avatar: string): User {
  if (!token || !name) {
    throw "should have token & name";
  }
  // 如果用户已经存在，返回现有的用户对象
  if (userMap[token]) {
    // 更新用户信息
    userMap[token].name = name;
    userMap[token].avatar = avatar;
    return userMap[token];
  }
  // 创建新用户
  const user = new User(token, name, avatar);
  userMap[token] = user;
  return user;
}

// 获取所有房间列表
export function getAllRooms(): Array<{
  id: string;
  smallBlind: number;
  playerCount: number;
  maxPlayers: number;
  ownerName: string;
  isShortDeck: boolean;
  isOmaha: boolean;
}> {
  return Object.values(roomMap).map((room) => ({
    id: room.id,
    smallBlind: room.smallBlind,
    playerCount: room.users.length,
    maxPlayers: 12, // 房间最大人数上限 12 人
    ownerName:
      room.users.length > 0
        ? userMap[room.users[0]]?.name || "未知"
        : "未知",
    isShortDeck: !!room.isShortDeck,
    isOmaha: !!room.isOmaha,
  }));
}

export function createRoom(
  token: Token,
  sb: number,
  buyIn: number,
  reBuyLimit: number = 1,
  isShortDeck: boolean = false,
  isOmaha: boolean = false
): Room {
  const user = userMap[token];
  const room = new Room(genRoomID(), sb, buyIn, reBuyLimit, isShortDeck, isOmaha);
  roomMap[room.id] = room;
  userEnterRoom(token, room.id);
  user.isRoomOwner = true;
  user.isReady = true;
  // console.log(31, userMap);
  return room;
}

export function userEnterRoom(token: Token, roomid: RoomID) {
  const room = roomMap[roomid];
  if (!room) {
    throw `房间${roomid}不存在`;
  }
  
  // 从数据库加载用户资料（如果有）
  const username = userMap[token].name;
  const userProfile = getUserProfile(username);
  if (userProfile) {
    userMap[token].nickname = userProfile.nickname || "";
    userMap[token].avatar = userProfile.avatar || "";
  }
  
  if (room.addUser(token)) {
    userMap[token].setRoom(roomid);
  }

  // 为了保证前端拿到最新头像信息，在加入房间约 1 秒后再广播一次房间状态
  // 这样刚被分配默认头像的玩家，其自己和其他玩家都会看到更新后的头像
  setTimeout(() => {
    try {
      publish2all(roomid);
    } catch {
      // ignore
    }
  }, 1000);
}

export function userLeaveRoom(token: Token) {
  const roomid = userMap[token].roomid;
  const room = roomMap[roomid];
  if (
    room && room.isGaming &&
    !userMap[token].isFolded &&
    userMap[token].isInCurrentGame &&
    room.game && !room.game.isSettling
  ) {
    throw `请结束本局后再离开`;
  }
  if (room) {
    room.removeUser(token);
  }
  send2user(token, {
    leave: true,
  });
}

export function startGame(token: Token) {
  const user = userMap[token];
  if (!user || !user.roomid) {
    throw "not in any room";
  }
  const roomid = userMap[token].roomid;
  return roomMap[roomid].startGame(token);
}

export function pauseGame(token: Token) {
  const roomid = userMap[token].roomid;
  return roomMap[roomid].pauseGame(token);
}

export function userReady(token: Token) {
  const user = userMap[token];
  if (!user.roomid) {
    throw "not in any room";
  }
  user.setReady(true);
}

function isInRoom(token: Token, roomid: RoomID): boolean {
  const user = userMap[token];
  const room = roomMap[roomid];
  return user && room && user.roomid == room.id;
}

// game round action
export function userBet(token: Token, chips: number) {
  const roomid = userMap[token].roomid;

  if (!isInRoom(token, roomid)) {
    throw "invalid room";
  }
  return roomMap[roomid].game.bet(token, chips);
}

export function userFold(token: Token) {
  const roomid = userMap[token].roomid;

  if (!isInRoom(token, roomid)) {
    throw "invalid room";
  }
  return roomMap[roomid].game.fold(token);
}

export function userExtendActionTime(token: Token) {
  const roomid = userMap[token].roomid;
  if (!isInRoom(token, roomid)) {
    throw "invalid room";
  }
  const ok = roomMap[roomid].game.extendActionTime(token);
  if (!ok) {
    throw "无法加时（非行动者或本手牌已用满 3 次）";
  }
  publish2all(roomid);
}

export function userReBuy(token: Token) {
  const roomid = userMap[token].roomid;

  if (!isInRoom(token, roomid)) {
    throw "invalid room";
  }
  return roomMap[roomid].reBuy(token);
}

export function userHangup(token: Token) {
  userMap[token].isReady = false;
}

export function userOverTime(token: Token) {
  const user = userMap[token];
  if (!user) {
    throw `not your action`;
  }
  const roomid = user.roomid;
  const game = roomMap[roomid].game;
  game.buyOverTimeCard(token);
  game.setActingUser(token, 60000);
}

export function userWatch(token: Token, watch: boolean) {
  if (!watch) {
    userMap[token].isSpectator = false;
  } else {
    const roomid = userMap[token].roomid;

    if (!isInRoom(token, roomid)) {
      throw "invalid room";
    }
    const room = roomMap[roomid];
    if (
      room.isGaming &&
      !userMap[token].isFolded &&
      userMap[token].isInCurrentGame &&
      !room.game.isSettling
    ) {
      throw `请结束本局后再观战`;
    }
    userMap[token].isSpectator = true;
  }
}

export function userShowHands(token: Token, index: number) {
  const user = userMap[token];
  const roomid = user.roomid;
  const game = roomMap[roomid].game;

  if (!isInRoom(token, roomid)) {
    throw "invalid room";
  }

  if (!game.isSettling) {
    return;
  }

  if (index == 0 || index == 1) {
    const hands: any[] = [null, null];
    let card = "";
    if (index == 0) {
      hands[0] = user.hands[0];
      card = `${hands[0].num}${hands[0].suit}`;
    }
    if (index == 1) {
      hands[1] = user.hands[1];
      card = `${hands[1].num}${hands[1].suit}`;
    }
    send2all(roomid, {
      hands: {
        id: user.chipsRecordID,
        hands,
      },
    });
    const displayName = user.nickname || user.name;
    publishLog2all(roomid, [`${displayName}亮牌${card}`]);
  }
}

/** 结算阶段：请求花欢乐豆看某人的手牌，对方同意后扣申请者欢乐豆、给展示者欢乐豆并仅对申请者展示手牌 */
export function userRequestSeeHand(token: Token, targetUserId: string, chips: number) {
  const user = userMap[token];
  const roomid = user.roomid;
  const room = roomMap[roomid];
  const game = room.game;

  if (!isInRoom(token, roomid)) {
    throw "invalid room";
  }
  if (!game.isSettling) {
    throw "仅在本局结算阶段可请求看牌";
  }
  if (chips < 1) {
    throw "欢乐豆数量至少为 1";
  }
  const requesterStack = user.stack - user.bets.reduce((a, b) => a + b, 0);
  if (requesterStack < chips) {
    throw "欢乐豆不足";
  }
  const targetToken = room.users.find((t) => userMap[t].chipsRecordID === targetUserId) as Token | undefined;
  if (!targetToken) {
    throw "对方不在房间";
  }
  const targetUser = userMap[targetToken];
  if (targetUser.shouldShowHand) {
    throw "对方已亮牌，无需请求";
  }
  // 即使目标用户已放弃，也允许申请看牌
  if (targetUser.hands.length < 2) {
    throw "对方没有手牌可看";
  }
  const alreadyRequested = room.pendingSeeHandRequests.some(
    (r) => r.requesterToken === token && r.targetToken === targetToken
  );
  if (alreadyRequested) {
    throw "你已向对方发起过看牌请求，请等待对方处理";
  }

  const requestId = uuidv4();
  room.pendingSeeHandRequests.push({
    requestId,
    requesterToken: token,
    targetToken,
    chips,
  });
  const fromName = user.nickname || user.name;
  const listForTarget = room.pendingSeeHandRequests
    .filter((r) => r.targetToken === targetToken)
    .map((r) => ({
      requestId: r.requestId,
      fromUserId: userMap[r.requesterToken].chipsRecordID,
      fromName: userMap[r.requesterToken].nickname || userMap[r.requesterToken].name,
      chips: r.chips,
    }));
  send2user(targetToken, { seeHandRequests: listForTarget });
}

/** 结算阶段：被请求者同意或拒绝展示手牌（可逐条处理多人请求） */
export function userRespondSeeHand(token: Token, requestId: string, accept: boolean) {
  const user = userMap[token];
  const roomid = user.roomid;
  const room = roomMap[roomid];

  if (!isInRoom(token, roomid)) {
    throw "invalid room";
  }
  const idx = room.pendingSeeHandRequests.findIndex(
    (r) => r.targetToken === token && r.requestId === requestId
  );
  if (idx === -1) {
    throw "无效或已过期的看牌请求";
  }
  const pending = room.pendingSeeHandRequests[idx];
  room.pendingSeeHandRequests.splice(idx, 1);

  if (!accept) {
    send2user(pending.requesterToken, { seeHandDeclined: true });
    sendSeeHandRequestsToTarget(room, token);
    return;
  }

  const requester = userMap[pending.requesterToken];
  const targetUser = userMap[pending.targetToken];
  const chips = pending.chips;

  const requesterStack = requester.stack - requester.bets.reduce((a, b) => a + b, 0);
  if (requesterStack < chips) {
    send2user(pending.requesterToken, { seeHandDeclined: true });
    sendSeeHandRequestsToTarget(room, token);
    return;
  }

  requester.stack -= chips;
  targetUser.stack += chips;
  room.chipsRecords.forEach((cr) => {
    if (cr.id === requester.chipsRecordID) {
      cr.chips = requester.stack;
    }
    if (cr.id === targetUser.chipsRecordID) {
      cr.chips = targetUser.stack;
    }
  });

  send2user(pending.requesterToken, {
    revealedHand: {
      targetUserId: targetUser.chipsRecordID,
      hands: targetUser.hands,
      handsType: targetUser.handsType,
      maxCards: targetUser.maxCards || [],
    },
  });
  publishLog2all(roomid, [
    `${requester.nickname || requester.name} 支付 $${chips} 查看了 ${targetUser.nickname || targetUser.name} 的手牌`,
  ]);
  // 看牌成功后，为当前牌局增加少量缓冲时间，便于申请者查看手牌
  if (room.game && room.game.isSettling && room.game.nextGameTime > 0) {
    room.game.nextGameTime += 2000;
  }
  publish2all(roomid);
  sendSeeHandRequestsToTarget(room, token);
}

function sendSeeHandRequestsToTarget(room: Room, targetToken: Token) {
  const list = room.pendingSeeHandRequests
    .filter((r) => r.targetToken === targetToken)
    .map((r) => ({
      requestId: r.requestId,
      fromUserId: userMap[r.requesterToken].chipsRecordID,
      fromName: userMap[r.requesterToken].nickname || userMap[r.requesterToken].name,
      chips: r.chips,
    }));
  send2user(targetToken, { seeHandRequests: list });
}

export function userSetSettleTimes(token: Token, times: number) {
  const user = userMap[token];
  const roomid = user.roomid;
  const game = roomMap[roomid].game;
  if (!isInRoom(token, roomid)) {
    throw "invalid room";
  }
  game.userSetSettleTimes(token, times);
}

export function userSendMessage(token: Token, message: string) {
  const user = userMap[token];
  const roomid = user.roomid;
  const trimmed = (message || "").trim().slice(0, 50);
  if (!trimmed) return;
  const payload = {
    roomChat: {
      userId: user.chipsRecordID,
      nickname: user.nickname || user.name,
      message: trimmed,
    },
  };
  send2all(roomid, payload);
  const displayName = user.nickname || user.name;
  publishLog2all(roomid, [`<strong>${displayName}</strong>: ${trimmed
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/ /g, "&nbsp;")
  }`]);
}

// ========================================
// 机器人功能
// ========================================

// 机器人用户名列表
const botNames = [
  "幸运星", "扑克侠", "牌神", "好运来", "牌王", 
  "赢大奖", "小赌神", "大赢家", "牌手", "梭哈王",
  "德州王", "手气好", "福将", "赌圣", "牌皇"
];

// 机器人映射
const botMap: { [token: string]: { name: string; roomid: string } } = {};

// 添加机器人到房间
export function addBotToRoom(roomid: RoomID): string {
  const room = roomMap[roomid];
  if (!room) {
    throw `房间${roomid}不存在`;
  }
  
  // 生成唯一的机器人token
  const botToken = `bot_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const botName = botNames[Math.floor(Math.random() * botNames.length)];
  
  // 创建机器人用户
  const botUser = new User(botToken, botName, "");
  botUser.setRoom(roomid);
  botUser.stack = room.buyIn;
  botUser.isReady = true;
  botUser.isBot = true;
  userMap[botToken] = botUser;
  
  // 添加到房间
  room.addUser(botToken);
  
  // 记录机器人信息
  botMap[botToken] = { name: botName, roomid };
  
  console.log(`机器人 ${botName} 加入房间 ${roomid}`);
  
  // 通知所有玩家
  send2all(roomid, {
    type: "game",
    action: "botJoined",
    botName: botName,
  });
  
  return botToken;
}

// 移除机器人
export function removeBotFromRoom(token: Token) {
  if (!botMap[token]) return;
  
  const { roomid } = botMap[token];
  const room = roomMap[roomid];
  if (room) {
    room.removeUser(token);
    send2all(roomid, {
      type: "game",
      action: "botLeft",
    });
  }
  
  delete botMap[token];
  delete userMap[token];
}

// 机器人自动行动 (无脑call)
let botTimer: NodeJS.Timeout | null = null;

export function startBotActions() {
  if (botTimer) return;
  
  botTimer = setInterval(() => {
    // 检查每个房间的当前行动玩家
    for (const roomid in roomMap) {
      const room = roomMap[roomid];
      if (!room.isGaming || !room.game) continue;
      
      const game = room.game;
      
      // 找到当前需要行动的用户
      const actingUser = room.users.find(t => userMap[t]?.isActing && userMap[t]?.isBot);
      
      if (actingUser) {
        // 机器人行动 - 无脑call
        const self = userMap[actingUser];
        const bet = self.totalBets || 0;
        const preBet = game.maxPreBet();
        const availableStack = self.stack - bet;
        const totalBet = Math.min(self.stack, preBet);
        
        // 清除原有的自动放弃计时器
        clearTimeout(game.actingUserTimer);
        
        if (availableStack > 0 && totalBet > bet) {
          // 跟🌟
          game.bet(actingUser, totalBet);
          console.log(`机器人 ${self.name} 跟🌟 ${totalBet - bet}`);
        } else if (preBet === bet) {
          // 过
          game.bet(actingUser, bet);
          console.log(`机器人 ${self.name} 过`);
        } else {
          // 放弃
          game.fold(actingUser);
          console.log(`机器人 ${self.name} 放弃`);
        }
        
        // 广播游戏状态
        send2all(roomid, {
          type: "game",
        });
      }
    }
  }, 1000); // 每秒检查一次
}

export function stopBotActions() {
  if (botTimer) {
    clearInterval(botTimer);
    botTimer = null;
  }
}

// 启动机器人服务
startBotActions();

// 踢人功能
export function kickUser(token: Token, userId: string) {
  const user = userMap[token];
  if (!user || !user.isRoomOwner) {
    throw "只有房主可以踢人";
  }
  
  const roomid = user.roomid;
  const room = roomMap[roomid];
  if (!room) {
    throw "房间不存在";
  }
  
  // 找到要踢的用户的token
  let targetToken: Token | null = null;
  for (const t in userMap) {
    if (userMap[t].chipsRecordID === userId) {
      targetToken = t;
      break;
    }
  }
  
  if (!targetToken) {
    throw "用户不存在";
  }

  const targetUser = userMap[targetToken];

  // 如果该玩家正在本局游戏中行动，先让他自动弃牌，再踢出，避免轮次卡死
  if (
    room.isGaming &&
    room.game &&
    !room.game.isSettling &&
    targetUser &&
    targetUser.isInCurrentGame &&
    !targetUser.isFolded
  ) {
    try {
      room.game.fold(targetToken);
    } catch (e) {
      // 出错也不影响后续踢出逻辑，避免房间卡死
      console.error("kickUser auto fold failed", e);
    }
  }

  // 从房间中移除用户（包括非本局玩家或已弃牌玩家）
  room.removeUser(targetToken);
  
  // 通知被踢的用户
  send2user(targetToken, {
    leave: true,
    message: "你已被房主移出房间",
  });
  
  // 通知所有用户
  send2all(roomid, {
    type: "game",
    action: "userKicked",
    userId: userId,
  });
  
  // 发布房间状态更新，确保所有玩家看到最新状态
  publish2all(roomid);
}

// 结算游戏功能
export function settleGame(token: Token) {
  const user = userMap[token];
  if (!user || !user.isRoomOwner) {
    throw "只有房主可以结算游戏";
  }
  
  const roomid = user.roomid;
  const room = roomMap[roomid];
  if (!room) {
    throw "房间不存在";
  }
  
  // 如果游戏正在进行中，标记为结算后解散
  if (room.isGaming && room.game) {
    room.game.settleAfterRound = true;
    send2all(roomid, {
      type: "game",
      action: "settleRequested",
    });
  } else {
    // 直接结算并解散房间
    settleAndDissolveRoom(roomid);
  }
}

// 结算并解散房间
function settleAndDissolveRoom(roomid: RoomID) {
  const room = roomMap[roomid];
  if (!room) return;
  
  // 保存积分历史记录
  const chipsRecords = room.chipsRecords;
  
  // 通知所有用户结算结果
  send2all(roomid, {
    type: "game",
    action: "gameSettled",
    chipsRecords: chipsRecords,
  });
  
  // 移除房间
  delete roomMap[roomid];
  
  // 通知所有用户房间已解散
  room.users.forEach(token => {
    send2user(token, {
      leave: true,
    });
  });
}
