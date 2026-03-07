import User, { Token } from "./User";
import Room, { RoomID, RoomRedPacket } from "./Room";
import { PokerWebSocket, publishLog2all, send2all, send2user, publish2all } from "../api/ws";
import {
  getUser,
  saveUser,
  getUserProfile,
  updateUserProfile,
  initDatabase,
  getRoomLogs,
  getDailyBuyInState,
} from "./database";
import { v4 as uuidv4 } from "uuid";
import {
  applyTableStackToRecord,
  applyTotalDelta,
  getProfitCapTotal,
  getRecordProfit,
  getTotalChips,
  normalizeChipsRecord,
  SETTLE_PROFIT_CAP,
} from "./chips";
const RED_PACKET_WAIT_MS = 5000;
const RED_PACKET_RESULT_MS = 3000;
const RED_PACKET_FLOW_MS = RED_PACKET_WAIT_MS + RED_PACKET_RESULT_MS;

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

export function createUser(token: Token, name: string, avatar: string, uuid: string = ""): User {
  if (!token || !name) {
    throw "should have token & name";
  }
  const dailyState = getDailyBuyInState(name);
  // 如果用户已经存在，返回现有的用户对象
  if (userMap[token]) {
    // 更新用户信息
    userMap[token].name = name;
    userMap[token].avatar = avatar;
    userMap[token].uuid = uuid;
    userMap[token].dailyBuyInDayKey = dailyState.dayKey;
    userMap[token].dailyBuyInUsed = dailyState.used;
    userMap[token].dailyBuyInRemaining = dailyState.remaining;
    return userMap[token];
  }
  // 创建新用户
  const user = new User(token, name, avatar, uuid);
  user.dailyBuyInDayKey = dailyState.dayKey;
  user.dailyBuyInUsed = dailyState.used;
  user.dailyBuyInRemaining = dailyState.remaining;
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
  redPacketThresholdMultiple: number;
  redPacketMaxPercent: number;
}> {
  return Object.values(roomMap).map((room) => ({
    id: room.id,
    smallBlind: room.smallBlind,
    playerCount: room.users.length,
    maxPlayers: 12, // 房间最大人数上限 12 人
    ownerName:
      room.users.length > 0
        ? (() => {
          const ownerToken = room.users.find((t) => userMap[t]?.isRoomOwner);
          return ownerToken ? userMap[ownerToken]?.name || "未知" : "未知";
        })()
        : "未知",
    isShortDeck: !!room.isShortDeck,
    isOmaha: !!room.isOmaha,
    redPacketThresholdMultiple: room.redPacketThresholdMultiple,
    redPacketMaxPercent: room.redPacketMaxPercent,
  }));
}

export function createRoom(
  token: Token,
  sb: number,
  buyIn: number,
  reBuyLimit: number = 1,
  isShortDeck: boolean = false,
  isOmaha: boolean = false,
  redPacketThresholdMultiple: number = 1,
  redPacketMaxPercent: number = 30,
  supportEnabled: boolean = true,
  supportMinPot: number = 600,
  supportMaxPercent: number = 5
): Room {
  const user = userMap[token];
  const room = new Room(
    genRoomID(),
    sb,
    buyIn,
    reBuyLimit,
    isShortDeck,
    isOmaha,
    redPacketThresholdMultiple,
    redPacketMaxPercent,
    supportEnabled,
    supportMinPot,
    supportMaxPercent
  );
  roomMap[room.id] = room;
  userEnterRoom(token, room.id);
  user.isRoomOwner = true;
  user.isReady = true;
  // console.log(31, userMap);
  return room;
}

function calcUserProfit(room: Room, token: Token): { profit: number; recordBuyIn: number } {
  const user = userMap[token];
  const record = room.chipsRecords.find((cr) => cr.id === user.chipsRecordID);
  if (!record) {
    throw "积分记录不存在";
  }
  normalizeChipsRecord(record);
  return { profit: getRecordProfit(record), recordBuyIn: record.buyIn };
}

function syncUserStackFromRecord(user: User, record: { chips: number }) {
  const invested = user.bets.reduce((a, b) => a + b, 0);
  user.stack = Math.max(invested, record.chips + invested);
}

function addToUserRecordTotal(
  room: Room,
  user: User,
  delta: number,
  options?: { preferOverflowOnNegative?: boolean }
): { totalAfter: number } {
  const record = room.chipsRecords.find((cr) => cr.id === user.chipsRecordID);
  if (!record) throw "积分记录不存在";
  normalizeChipsRecord(record);
  const totalAfter = applyTotalDelta(record, delta, options);
  syncUserStackFromRecord(user, record);
  return { totalAfter };
}

function splitLuckyAmount(totalAmount: number, count: number, allowZero = false): number[] {
  if (count <= 0) return [];
  if (totalAmount <= 0) return new Array(count).fill(0);
  if (count === 1) return [totalAmount];

  // 普通拼手气红包：每人至少 1；系统红包可允许 0（总额可能小于人数）。
  if (!allowZero) {
    if (totalAmount < count) {
      return [];
    }
    const cuts = new Set<number>();
    while (cuts.size < count - 1) {
      cuts.add(Math.floor(Math.random() * (totalAmount - 1)) + 1);
    }
    const sorted = [0, ...Array.from(cuts).sort((a, b) => a - b), totalAmount];
    const ret: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      ret.push(sorted[i] - sorted[i - 1]);
    }
    return ret;
  }

  const cuts = new Array(count - 1)
    .fill(0)
    .map(() => Math.floor(Math.random() * (totalAmount + 1)));
  const sorted = [0, ...cuts.sort((a, b) => a - b), totalAmount];
  const ret: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    ret.push(sorted[i] - sorted[i - 1]);
  }
  return ret;
}

function startLuckyRedPacket(
  room: Room,
  senderToken: Token,
  senderName: string,
  totalAmount: number,
  recipients: Token[],
  splits: number[],
  logText: string
) {
  const now = Date.now();
  const pausedNextGameRemainMs =
    room.game?.nextGameTime && room.game.nextGameTime > now
      ? room.game.nextGameTime - now
      : 0;
  if (pausedNextGameRemainMs > 0 && room.game) {
    room.game.nextGameTime += RED_PACKET_FLOW_MS;
  }

  const packet: RoomRedPacket = {
    id: uuidv4(),
    status: "waiting",
    senderToken,
    senderName,
    totalAmount,
    pausedNextGameRemainMs,
    recipients: recipients.map((t, idx) => ({
      token: t,
      amount: Math.max(0, Math.floor(splits[idx] || 0)),
      opened: false,
      openedAt: 0,
      autoOpened: false,
    })),
    openDeadline: now + RED_PACKET_WAIT_MS,
    resultDeadline: 0,
    luckiestToken: "",
  };
  room.activeRedPacket = packet;
  clearTimeout(room.redPacketOpenTimer);
  clearTimeout(room.redPacketResultTimer);
  room.redPacketOpenTimer = setTimeout(() => {
    const r = roomMap[room.id];
    if (!r || !r.activeRedPacket || r.activeRedPacket.id !== packet.id) return;
    settleWaitingRedPacket(r, true);
  }, RED_PACKET_WAIT_MS);

  publishLog2all(room.id, [logText]);
  publish2all(room.id);
}

function clearRoomRedPacket(room: Room) {
  clearTimeout(room.redPacketOpenTimer);
  clearTimeout(room.redPacketResultTimer);
  room.activeRedPacket = null;
}

function toResultPhase(room: Room, packet: RoomRedPacket) {
  packet.status = "result";
  packet.resultDeadline = Date.now() + RED_PACKET_RESULT_MS;
  let luckiest = packet.recipients[0];
  packet.recipients.forEach((r) => {
    if (r.amount > luckiest.amount) {
      luckiest = r;
    }
  });
  packet.luckiestToken = luckiest?.token || "";
  clearTimeout(room.redPacketOpenTimer);
  clearTimeout(room.redPacketResultTimer);
  room.redPacketResultTimer = setTimeout(() => {
    const r = roomMap[room.id];
    if (!r || !r.activeRedPacket || r.activeRedPacket.id !== packet.id) return;
    clearRoomRedPacket(r);
    publish2all(r.id);
  }, RED_PACKET_RESULT_MS);
}

function settleWaitingRedPacket(room: Room, autoOpenRemaining: boolean) {
  const packet = room.activeRedPacket;
  if (!packet || packet.status !== "waiting") return;

  if (autoOpenRemaining) {
    packet.recipients.forEach((entry) => {
      if (entry.opened) return;
      const receiver = userMap[entry.token];
      if (!receiver) return;
      entry.opened = true;
      entry.openedAt = Date.now();
      entry.autoOpened = true;
      addToUserRecordTotal(room, receiver, entry.amount);
    });
  }

  if (!autoOpenRemaining) {
    publish2all(room.id);
    return;
  }

  toResultPhase(room, packet);
  publishLog2all(room.id, [
    `🧧 ${packet.senderName} 发出拼手气红包，共 ${packet.totalAmount} 筹码，手气王已诞生`,
  ]);
  publish2all(room.id);
}

export function userSendRedPacket(token: Token, amount: number) {
  const user = userMap[token];
  if (!user || !user.roomid) {
    throw "not in any room";
  }
  const room = roomMap[user.roomid];
  if (!room) {
    throw "room not exists";
  }
  if (!room.game || !room.game.isSettling) {
    throw "仅在结算阶段可发红包";
  }
  if (room.activeRedPacket) {
    throw "当前已有红包，请稍后再发";
  }

  const senderProfitInfo = calcUserProfit(room, token);
  const thresholdProfit = senderProfitInfo.recordBuyIn * room.redPacketThresholdMultiple;
  if (senderProfitInfo.profit < thresholdProfit) {
    throw `未达到发红包门槛（需盈利 ${thresholdProfit}）`;
  }

  const underwaterTokens = room.users.filter((t) => {
    if (t === token) return false;
    const candidate = userMap[t];
    if (!candidate || candidate.isSpectator) return false;
    const p = calcUserProfit(room, t).profit;
    return p < 0;
  });
  if (underwaterTokens.length === 0) {
    throw "当前没有水下玩家可抢红包";
  }

  const minAmount = underwaterTokens.length;
  const maxAmount = Math.floor(
    (senderProfitInfo.profit * room.redPacketMaxPercent) / 100
  );
  if (maxAmount < minAmount) {
    throw "当前盈利不足以按配置发红包，请稍后再试";
  }
  if (!Number.isInteger(amount) || amount < minAmount || amount > maxAmount) {
    throw `红包金额范围为 ${minAmount} ~ ${maxAmount}`;
  }
  const senderRecord = room.chipsRecords.find((cr) => cr.id === user.chipsRecordID);
  if (!senderRecord) throw "积分记录不存在";
  normalizeChipsRecord(senderRecord);
  if (getTotalChips(senderRecord) < amount) {
    throw "筹码不足，无法发红包";
  }

  addToUserRecordTotal(room, user, -amount, { preferOverflowOnNegative: true });

  const splits = splitLuckyAmount(amount, underwaterTokens.length, false);
  const senderName = user.nickname || user.name;
  startLuckyRedPacket(
    room,
    token,
    senderName,
    amount,
    underwaterTokens,
    splits,
    `🧧 ${senderName} 发了一个拼手气红包（${amount} 筹码）`
  );
}

export function userOpenRedPacket(token: Token) {
  const user = userMap[token];
  if (!user || !user.roomid) {
    throw "not in any room";
  }
  const room = roomMap[user.roomid];
  if (!room || !room.activeRedPacket) {
    throw "当前没有可抢红包";
  }
  const packet = room.activeRedPacket;
  if (packet.status !== "waiting") {
    throw "红包已结束";
  }

  const entry = packet.recipients.find((r) => r.token === token);
  if (!entry) {
    throw "你不在本次红包领取名单中";
  }
  if (entry.opened) {
    return;
  }
  entry.opened = true;
  entry.openedAt = Date.now();
  entry.autoOpened = false;
  addToUserRecordTotal(room, user, entry.amount);

  settleWaitingRedPacket(room, false);
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

  // 从数据库加载该房间的战况历史日志并发送给用户
  try {
    const historyLogs = getRoomLogs(roomid);
    if (historyLogs.length > 0) {
      send2user(token, { roomid, logs: historyLogs, logsSnapshot: true });
    }
  } catch (e) {
    console.error("加载房间历史日志失败:", e);
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

export function userSetShortDeck(token: Token, enable: boolean) {
  const user = userMap[token];
  if (!user || !user.roomid) {
    throw "not in any room";
  }
  const room = roomMap[user.roomid];
  if (!room) {
    throw "房间不存在";
  }
  if (!user.isRoomOwner) {
    throw "只有房主可以切换长短牌";
  }
  if (room.isOmaha) {
    throw "奥马哈模式下不可切换短牌";
  }
  const nextEnable = !!enable;
  if (nextEnable) {
    const seatedCount = room.users.filter((t) => {
      const u = userMap[t];
      return !!u && !u.isSpectator;
    }).length;
    if (seatedCount >= 7) {
      throw "人数达到 7 人及以上时不可切换短牌";
    }
  }
  if (room.isShortDeck === nextEnable) {
    return;
  }
  room.isShortDeck = nextEnable;
  publishLog2all(room.id, [
    `🎛️ 房主已切换为${nextEnable ? "短牌" : "长牌"}模式（下一局生效）`,
  ]);
  publish2all(room.id);
}

export function transferRoomOwner(token: Token, targetUserId: string) {
  const user = userMap[token];
  if (!user || !user.roomid) {
    throw "not in any room";
  }
  if (!user.isRoomOwner) {
    throw "只有房主可以转移房主身份";
  }
  const room = roomMap[user.roomid];
  if (!room) {
    throw "房间不存在";
  }
  const targetToken = room.users.find((t) => userMap[t]?.chipsRecordID === targetUserId);
  if (!targetToken) {
    throw "目标玩家不在房间内";
  }
  if (targetToken === token) {
    throw "不能转移给自己";
  }
  const targetUser = userMap[targetToken];
  if (!targetUser) {
    throw "目标玩家不存在";
  }
  user.isRoomOwner = false;
  targetUser.isRoomOwner = true;
  publishLog2all(room.id, [
    `👑 房主已由 ${user.nickname || user.name} 移交给 ${targetUser.nickname || targetUser.name}`,
  ]);
  publish2all(room.id);
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

export function userShowHands(token: Token) {
  const user = userMap[token];
  const roomid = user.roomid;
  const room = roomMap[roomid];
  const game = room.game;

  if (!isInRoom(token, roomid)) {
    throw "invalid room";
  }

  if (!game.isSettling) {
    return;
  }

  if (!Array.isArray(user.hands) || user.hands.length === 0) {
    return;
  }

  // 已经亮牌则无需重复处理
  if (user.shouldShowHand) {
    return;
  }

  user.shouldShowHand = true;
  user.revealedHandsMask = new Array(user.hands.length).fill(true);

  // 主动亮牌后，自动拒绝所有指向自己的看牌请求（功能并存但不再需要继续处理）
  if (room.pendingSeeHandRequests.length > 0) {
    const autoDeclined = room.pendingSeeHandRequests.filter(
      (req) => req.targetToken === token
    );
    if (autoDeclined.length > 0) {
      room.pendingSeeHandRequests = room.pendingSeeHandRequests.filter(
        (req) => req.targetToken !== token
      );
      autoDeclined.forEach((req) => {
        send2user(req.requesterToken, {
          seeHandDeclined: true,
        });
      });
      // 清空被请求者端待处理弹窗
      sendSeeHandRequestsToTarget(room, token);
    }
  }

  const displayName = user.nickname || user.name;
  const cardsText = user.hands.map((c) => `${c.num}${c.suit}`).join("");
  publishLog2all(roomid, [`${displayName}亮牌【${cardsText}】`]);
  publish2all(roomid);
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
      applyTableStackToRecord(cr, requester.stack);
      syncUserStackFromRecord(requester, cr);
    }
    if (cr.id === targetUser.chipsRecordID) {
      applyTableStackToRecord(cr, targetUser.stack);
      syncUserStackFromRecord(targetUser, cr);
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

type PendingSupportRequest = {
  requestId: string;
  supporterToken: Token;
  targetToken: Token;
  amount: number;
};

function acceptSupportRequest(
  room: Room,
  pending: PendingSupportRequest,
  options?: { autoFirst?: boolean }
) {
  const roomid = room.id;
  const supporter = userMap[pending.supporterToken];
  const targetUser = userMap[pending.targetToken];
  const amount = pending.amount;
  if (!supporter || !targetUser) {
    throw "玩家状态异常";
  }
  if (!supporter.isFolded || !supporter.isInCurrentGame) {
    send2user(pending.supporterToken, {
      supportDeclined: true,
      targetId: targetUser.chipsRecordID,
      targetName: targetUser.nickname || targetUser.name,
      requestId: pending.requestId,
      reason: "支持者状态已变化",
    });
    sendSupportRequestsToTarget(room, pending.targetToken);
    return;
  }
  if (targetUser.isFolded || !targetUser.isInCurrentGame) {
    send2user(pending.supporterToken, {
      supportDeclined: true,
      targetId: targetUser.chipsRecordID,
      targetName: targetUser.nickname || targetUser.name,
      requestId: pending.requestId,
      reason: "目标玩家状态已变化",
    });
    sendSupportRequestsToTarget(room, pending.targetToken);
    return;
  }

  const supporterStack = supporter.stack - supporter.bets.reduce((a, b) => a + b, 0);
  if (supporterStack < amount) {
    send2user(pending.supporterToken, {
      supportDeclined: true,
      targetId: targetUser.chipsRecordID,
      targetName: targetUser.nickname || targetUser.name,
      requestId: pending.requestId,
      reason: "支持者余额不足",
    });
    sendSupportRequestsToTarget(room, pending.targetToken);
    return;
  }

  supporter.stack -= amount;
  targetUser.stack += amount;

  const targetTotalBet = targetUser.bets.reduce((a, b) => a + b, 0);
  if (targetTotalBet <= 0) {
    send2user(pending.supporterToken, {
      supportDeclined: true,
      targetId: targetUser.chipsRecordID,
      targetName: targetUser.nickname || targetUser.name,
      requestId: pending.requestId,
      reason: "目标下注信息异常",
    });
    supporter.stack += amount;
    targetUser.stack -= amount;
    sendSupportRequestsToTarget(room, pending.targetToken);
    return;
  }
  const sharePercent = amount / targetTotalBet;

  room.supportRecords.push({
    supporterToken: pending.supporterToken,
    targetToken: pending.targetToken,
    amount,
    targetTotalBet,
  });

  const autoFirst = !!options?.autoFirst;
  send2user(pending.supporterToken, {
    supportAccepted: true,
    targetId: targetUser.chipsRecordID,
    targetName: targetUser.nickname || targetUser.name,
    amount,
    sharePercent: Math.round(sharePercent * 10000) / 100,
    autoFirst,
  });

  send2user(pending.targetToken, {
    supportConfirmed: true,
    supporterId: supporter.chipsRecordID,
    supporterName: supporter.nickname || supporter.name,
    amount,
    newStack: targetUser.stack,
    autoFirst,
  });

  publishLog2all(roomid, [
    autoFirst
      ? `${supporter.nickname || supporter.name} 第一个支持 ${targetUser.nickname || targetUser.name} ${amount} 🌟（免同意）`
      : `${supporter.nickname || supporter.name} 支持 ${targetUser.nickname || targetUser.name} ${amount} 🌟`,
  ]);
  sendSupportRequestsToTarget(room, pending.targetToken);
}

/**
 * 弃牌玩家申请支持目标玩家
 * @param token 申请者（支持者）token
 * @param targetId 目标玩家ID（chipsRecordID）
 * @param amount 支持金额
 */
export function userRequestSupport(token: Token, targetId: string, amount: number) {
  const user = userMap[token];
  const roomid = user.roomid;
  const room = roomMap[roomid];

  if (!isInRoom(token, roomid)) {
    throw "invalid room";
  }

  // 检查是否处于支持阶段
  if (!room.isSupportPhase) {
    throw "当前不在支持阶段";
  }

  // 验证支持者已弃牌且有余额
  if (!user.isFolded || user.stack <= 0) {
    throw "只有弃牌玩家可以支持";
  }

  // 验证目标玩家
  const target = room.users.find((t) =>
    userMap[t].chipsRecordID === targetId &&
    !userMap[t].isFolded &&
    userMap[t].isInCurrentGame
  );
  if (!target) {
    throw "无效的目标玩家";
  }
  const targetUser = userMap[target];

  // 计算目标当前总下注额
  const targetTotalBet = targetUser.bets.reduce((a, b) => a + b, 0);
  if (targetTotalBet <= 0) {
    throw "该玩家当前不可被支持";
  }
  const maxSupport = Math.floor(targetTotalBet * room.supportMaxPercent / 100);
  if (maxSupport < 1) {
    throw "当前支持上限过低，暂不可支持";
  }

  // 验证金额
  if (amount <= 0 || amount > maxSupport) {
    throw `支持金额必须在 1-${maxSupport} 之间`;
  }
  if (amount > user.stack) {
    throw "余额不足";
  }

  // 检查是否已经申请/支持过该目标
  const alreadyRequested = room.pendingSupportRequests.some(
    (r) => r.supporterToken === token && r.targetToken === target
  );
  const alreadySupported = room.supportRecords.some(
    (r) => r.supporterToken === token && r.targetToken === target
  );
  if (alreadyRequested || alreadySupported) {
    throw "你已经申请过支持该玩家";
  }

  // 生成请求ID
  const requestId = uuidv4();
  const pending: PendingSupportRequest = {
    requestId,
    supporterToken: token,
    targetToken: target,
    amount,
  };

  // 每个被支持者的第一个支持自动通过（无需目标玩家同意）
  const hasTargetSupportOrPending =
    room.supportRecords.some((r) => r.targetToken === target) ||
    room.pendingSupportRequests.some((r) => r.targetToken === target);
  if (!hasTargetSupportOrPending) {
    acceptSupportRequest(room, pending, { autoFirst: true });
    return;
  }

  // 记录待处理请求
  room.pendingSupportRequests.push(pending);

  // 通知目标玩家有新请求（类似看牌请求格式）
  send2user(target, {
    supportRequests: room.pendingSupportRequests
      .filter((r) => r.targetToken === target)
      .map((r) => ({
        requestId: r.requestId,
        fromUserId: userMap[r.supporterToken].chipsRecordID,
        fromName: userMap[r.supporterToken].nickname || userMap[r.supporterToken].name,
        amount: r.amount,
      })),
  });

  // 广播有新的支持申请（仅数量）
  send2all(roomid, {
    supportRequestCount: room.pendingSupportRequests.length,
  });
}

/**
 * 目标玩家响应支持申请
 * @param token 目标玩家token
 * @param requestId 请求ID
 * @param accept 是否接受
 */
export function userRespondSupport(token: Token, requestId: string, accept: boolean) {
  const user = userMap[token];
  const roomid = user.roomid;
  const room = roomMap[roomid];

  if (!isInRoom(token, roomid)) {
    throw "invalid room";
  }
  if (!room.isSupportPhase) {
    throw "当前不在支持阶段";
  }

  // 查找请求
  const idx = room.pendingSupportRequests.findIndex(
    (r) => r.targetToken === token && r.requestId === requestId
  );
  if (idx === -1) {
    throw "无效或已过期的支持请求";
  }

  const pending = room.pendingSupportRequests[idx];
  room.pendingSupportRequests.splice(idx, 1);

  if (!accept) {
    // 拒绝：通知支持者
    send2user(pending.supporterToken, {
      supportDeclined: true,
      targetId: user.chipsRecordID,
      targetName: user.nickname || user.name,
      requestId,
    });
    // 更新目标玩家的待处理列表
    sendSupportRequestsToTarget(room, token);
    return;
  }

  // 接受：执行资金流转
  acceptSupportRequest(room, pending, { autoFirst: false });
}

function sendSupportRequestsToTarget(room: Room, targetToken: Token) {
  const list = room.pendingSupportRequests
    .filter((r) => r.targetToken === targetToken)
    .map((r) => ({
      requestId: r.requestId,
      fromUserId: userMap[r.supporterToken].chipsRecordID,
      fromName: userMap[r.supporterToken].nickname || userMap[r.supporterToken].name,
      amount: r.amount,
    }));
  send2user(targetToken, { supportRequests: list });
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

  if (room.activeRedPacket) {
    throw "当前已有红包流程，请等待结束后再操作";
  }

  // 避免手牌进行中改分导致账不一致
  if (room.isGaming && room.game && !room.game.isSettling) {
    throw "请在本局结算阶段或暂停后使用该功能";
  }

  const overflowRecords = room.chipsRecords
    .map((cr) => {
      normalizeChipsRecord(cr);
      const total = getTotalChips(cr);
      const capTotal = getProfitCapTotal(cr);
      return {
        record: cr,
        overflow: Math.max(0, total - capTotal),
        capTotal,
      };
    })
    .filter((x) => x.overflow > 0);

  if (overflowRecords.length === 0) {
    throw `当前没有玩家积分超过 ${SETTLE_PROFIT_CAP}`;
  }

  const underwaterTokens = room.users.filter((t) => {
    const u = userMap[t];
    if (!u || u.isSpectator) return false;
    const rec = room.chipsRecords.find((cr) => cr.id === u.chipsRecordID);
    if (!rec) return false;
    normalizeChipsRecord(rec);
    return getRecordProfit(rec) < 0;
  });
  if (underwaterTokens.length === 0) {
    throw "当前没有水下玩家可抢红包";
  }

  const totalOverflow = overflowRecords.reduce((sum, x) => sum + x.overflow, 0);
  if (totalOverflow <= 0) {
    throw "没有可分发的溢出筹码";
  }

  overflowRecords.forEach(({ record, capTotal }) => {
    applyTotalDelta(record, capTotal - getTotalChips(record), {
      preferOverflowOnNegative: true,
    });
    const holder = userMap[record.token];
    if (holder && holder.chipsRecordID === record.id) {
      syncUserStackFromRecord(holder, record);
    }
  });

  // 同步在场玩家堆栈，保证前后端积分榜一致（离场玩家下次入场时会继承 chipsRecord）
  room.users.forEach((t) => {
    const u = userMap[t];
    if (!u) return;
    const rec = room.chipsRecords.find((cr) => cr.id === u.chipsRecordID);
    if (rec) {
      normalizeChipsRecord(rec);
      syncUserStackFromRecord(u, rec);
    }
  });

  const splits = splitLuckyAmount(totalOverflow, underwaterTokens.length, true);
  startLuckyRedPacket(
    room,
    token,
    `${user.nickname || user.name}（积分结算）`,
    totalOverflow,
    underwaterTokens,
    splits,
    `🧧 积分结算已封顶盈利 ${SETTLE_PROFIT_CAP}，共回收溢出 ${totalOverflow} 筹码并发出拼手气红包`
  );
}

// 结算并解散房间
function settleAndDissolveRoom(roomid: RoomID) {
  const room = roomMap[roomid];
  if (!room) return;
  clearTimeout(room.redPacketOpenTimer);
  clearTimeout(room.redPacketResultTimer);
  room.activeRedPacket = null;
  
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
