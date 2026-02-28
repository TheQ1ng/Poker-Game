import User, { Token } from "./User";
import Room, { RoomID } from "./Room";
import { PokerWebSocket, publishLog2all, send2all, send2user } from "../api/ws";
import { getUser, saveUser, getUserProfile, initDatabase } from "./database";

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
  const user = new User(token, name, avatar);
  userMap[token] = user;
  return user;
}

// 获取所有房间列表
export function getAllRooms(): Array<{id: string, smallBlind: number, playerCount: number, maxPlayers: number, ownerName: string}> {
  return Object.values(roomMap).map(room => ({
    id: room.id,
    smallBlind: room.smallBlind,
    playerCount: room.users.length,
    maxPlayers: 9, // 假设最大玩家数
    ownerName: room.users.length > 0 ? userMap[room.users[0]]?.name || '未知' : '未知'
  }));
}

export function createRoom(
  token: Token,
  sb: number,
  buyIn: number,
  reBuyLimit: number = 1
): Room {
  const user = userMap[token];
  const room = new Room(genRoomID(), sb, buyIn, reBuyLimit);
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
  // 从数据库获取用户资料
  const userProfile = getUserProfile(username);
  if (userProfile) {
    userMap[token].nickname = userProfile.nickname || "";
    userMap[token].avatar = userProfile.avatar || "";
  }
  
  if (room.addUser(token)) {
    userMap[token].setRoom(roomid);
  }
}

export function userLeaveRoom(token: Token) {
  const roomid = userMap[token].roomid;
  const room = roomMap[roomid];
  if (
    room.isGaming &&
    !userMap[token].isFolded &&
    userMap[token].isInCurrentGame &&
    !room.game.isSettling
  ) {
    throw `请结束本局后再离开`;
  }
  room.removeUser(token);
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
    publishLog2all(roomid, [`${user.name}亮牌${card}`]);
  }
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
  const roomid = userMap[token].roomid;
  publishLog2all(roomid, [`<strong>${userMap[token].name}</strong>: 
      ${message
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
        
        // 清除原有的自动弃牌计时器
        clearTimeout(game.actingUserTimer);
        
        if (availableStack > 0 && totalBet > bet) {
          // 跟注
          game.bet(actingUser, totalBet);
          console.log(`机器人 ${self.name} 跟注 ${totalBet - bet}`);
        } else if (preBet === bet) {
          // 过牌
          game.bet(actingUser, bet);
          console.log(`机器人 ${self.name} 过牌`);
        } else {
          // 弃牌
          game.fold(actingUser);
          console.log(`机器人 ${self.name} 弃牌`);
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
