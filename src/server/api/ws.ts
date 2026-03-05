import { Context } from "koa";
import * as ws from "ws";
import * as jwt from "jsonwebtoken";
import { secret } from "../config";
import {
  pauseGame,
  roomMap,
  startGame,
  userBet,
  userEnterRoom,
  userFold,
  userHangup,
  userLeaveRoom,
  userMap,
  userOverTime,
  userReady,
  userReBuy,
  userSetSettleTimes,
  userShowHands,
  userWatch,
  userSendMessage,
  addBotToRoom,
  kickUser,
  settleGame,
  userRequestSeeHand,
  userRespondSeeHand,
  userExtendActionTime,
  userSendRedPacket,
  userOpenRedPacket,
} from "../service";
import { Token } from "../service/User";
import Room, { Game, RoomID } from "../service/Room";
import {
  ActionType,
  SimpleChipsRecord,
  SimpleGame,
  SimpleRoom,
  SimpleRoomChipsRecords,
  SimpleSelf,
  SimpleUser,
} from "../../ApiType";
import { getUser } from "../service/database";

export interface PokerWebSocket extends ws {
  name?: string;
  token?: string;
}

export interface ActionBase {
  action: ActionType;
  [x: string]: any;
}

function send2client(ws: PokerWebSocket, data: any) {
  ws.send(JSON.stringify(data));
}

function sendError(ws: PokerWebSocket, error: string) {
  send2client(ws, {
    code: -1,
    error,
  });
}

export function send2user(token: Token, data: any) {
  const self = getSimpleSelf(token);
  data = Object.assign({}, data, { self });
  userMap[token].wss.forEach((ws) => {
    send2client(ws, data);
  });
}

export function send2all(roomid: RoomID, data: any) {
  roomMap[roomid].users.forEach((t) => send2user(t, data));
}

// eslint-disable-next-line import/no-anonymous-default-export
export default async (ctx: Context) => {
  const token = ctx.request.header["sec-websocket-protocol"]?.toString() || "";
  let websocket: PokerWebSocket | null = null;
  try {
    const user = jwt.verify(token.toString(), secret).toString().split("@")[0];
    
    // 检查用户是否存在于数据库中
    const dbUser = getUser(user);
    if (!dbUser) {
      ctx.websocket.send("user not found in database");
      ctx.websocket.close();
      return;
    }
    
    websocket = ctx.websocket;
    websocket.name = user;
    websocket.token = token;
    userMap[token].addWebsocket(websocket);
    console.log("client connect", token, user);
  } catch (e) {
    ctx.websocket.send("invalid token");
    ctx.websocket.close();
  }

  if (!websocket) {
    return;
  }

  websocket.on("message", (msg: string) => {
    try {
      let data: ActionBase | null = null;
      try {
        data = JSON.parse(msg);
      } catch (e) {
        send2client(websocket!, {
          code: -1,
          error: e,
        });
      }
      if (!data) {
        return;
      }
      handle(websocket!, data);
    } catch (e) {
      console.log("server catch error", e);
      sendError(websocket!, `${e}`);
    }
  });
  ctx.websocket.on("close", () => {
    console.log("client closed");
    const user = userMap[token];
    if (user) {
      user.removeWebSocket(websocket!);
      if (user.roomid) {
        publish2all(user.roomid);
      }
    }

    websocket = null;
  });
};

function handle(ws: PokerWebSocket, data: ActionBase) {
  const token = ws.token!;
  console.log("handle", token, data);
  switch (data.action) {
    case ActionType.ENTER_GAME:
      userEnterRoom(token, data.roomid);
      break;
    case ActionType.START_GAME:
      startGame(token);
      break;
    case ActionType.PAUSE_GAME:
      pauseGame(token);
      break;
    case ActionType.BET:
      userBet(token, data.chips);
      break;
    case ActionType.FOLD:
      userFold(token);
      break;
    case ActionType.HANGUP:
      userHangup(token);
      break;
    case ActionType.LEAVE:
      userLeaveRoom(token);
      break;
    case ActionType.READY:
      userReady(token);
      break;
    case ActionType.REBUY:
      userReBuy(token);
      break;
    case ActionType.OVERTIME:
      userOverTime(token);
      break;
    case ActionType.WATCH:
      userWatch(token, data.watch);
      break;
    case ActionType.SHOW_HANDS:
      userShowHands(token);
      break;
    case ActionType.SET_SETTLE_TIMES:
      userSetSettleTimes(token, data.times);
      break;
    case ActionType.SEND_MESSAGE:
      userSendMessage(token, data.message);
      break;
    case ActionType.ADD_BOT:
      addBotToRoom(data.roomid);
      break;
    case ActionType.KICK_USER:
      kickUser(token, data.userId);
      break;
    case ActionType.SETTLE_GAME:
      settleGame(token);
      break;
    case ActionType.REQUEST_SEE_HAND:
      userRequestSeeHand(token, data.targetUserId, data.chips);
      return;
    case ActionType.RESPOND_SEE_HAND:
      userRespondSeeHand(token, data.requestId, data.accept);
      return;
    case ActionType.EXTEND_ACTION_TIME:
      userExtendActionTime(token);
      return;
    case ActionType.SEND_RED_PACKET:
      userSendRedPacket(token, Number(data.amount));
      return;
    case ActionType.OPEN_RED_PACKET:
      userOpenRedPacket(token);
      return;
  }
  if (data.action !== ActionType.LEAVE) {
    publish(token, data, ws);
  }
}

function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

function getSimpleRoom(room: Room): SimpleRoom {
  const redPacket = room.activeRedPacket
    ? {
        id: room.activeRedPacket.id,
        status: room.activeRedPacket.status,
        senderUserId: userMap[room.activeRedPacket.senderToken]?.chipsRecordID || "",
        senderName: room.activeRedPacket.senderName,
        totalAmount: room.activeRedPacket.totalAmount,
        pausedNextGameRemainMs: room.activeRedPacket.pausedNextGameRemainMs,
        recipientUserIds: room.activeRedPacket.recipients.map(
          (r) => userMap[r.token]?.chipsRecordID || ""
        ),
        openedUserIds: room.activeRedPacket.recipients
          .filter((r) => r.opened)
          .map((r) => userMap[r.token]?.chipsRecordID || ""),
        openDeadline: room.activeRedPacket.openDeadline,
        resultDeadline: room.activeRedPacket.resultDeadline,
        luckiestUserId: room.activeRedPacket.luckiestToken
          ? userMap[room.activeRedPacket.luckiestToken]?.chipsRecordID || ""
          : "",
        details:
          room.activeRedPacket.status === "result"
            ? room.activeRedPacket.recipients.map((r) => ({
                userId: userMap[r.token]?.chipsRecordID || "",
                name: userMap[r.token]?.nickname || userMap[r.token]?.name || "",
                amount: r.amount,
                autoOpened: !!r.autoOpened,
              }))
            : undefined,
      }
    : null;
  return {
    roomid: room.id,
    isGaming: room.isGaming,
    users: room.users.map((t) => getSimpleUser(t)),
    isShortDeck: !!room.isShortDeck,
    isOmaha: !!room.isOmaha,
    redPacketConfig: {
      thresholdMultiple: room.redPacketThresholdMultiple,
      maxPercent: room.redPacketMaxPercent,
    },
    redPacket,
  };
}

function getSimpleChipsRecords(room: Room): SimpleRoomChipsRecords {
  return {
    roomid: room.id,
    chipsRecords: room.chipsRecords.map((cr) => ({
      id: cr.id,
      name: cr.name,
      nickname: cr.nickname,
      chips: cr.chips,
      buyIn: cr.buyIn,
    })),
  };
}

function getSimpleGame(game: Game): SimpleGame {
  if (!game) {
    return {
      boardCards: [],
      pots: 0,
      acting: "",
      preBet: 0,
      bb: 0,
      reBuyLimit: 1,
      isSettling: false,
      nextGameTime: 0,
      raiseUser: "",
      raiseBet: 0,
      raiseBetDiff: 0,
      userCount: 0,
      isShortDeck: false,
      isOmaha: false,
    };
  }
  const actingUser =
    game.sortedUsers.filter((t) => userMap[t].isActing)[0] || null;
  const preBet = Math.max(
    ...game.sortedUsers.map((t) => userMap[t].bets[game.round])
  );
  return {
    boardCards: game.boardCards,
    pots: sum(game.sortedUsers.map((t) => sum(userMap[t].bets))),
    acting: actingUser ? userMap[actingUser].chipsRecordID : "",
    preBet,
    bb: game.smallBlind * 2,
    reBuyLimit: game.reBuyLimit,
    isSettling: game.isSettling,
    nextGameTime: game.nextGameTime,
    raiseUser: game.raiseUser,
    raiseBet: game.raiseBet,
    raiseBetDiff: game.raiseBetDiff,
    userCount: game.sortedUsers.length,
    isShortDeck: !!game.isShortDeck,
    isOmaha: !!game.isOmaha,
  };
}

function getSimpleUser(token: Token): SimpleUser {
  const user = userMap[token];
  const room = roomMap[user.roomid];
  const hiddenHands = user.hands.map(() => null);
  const publicHands = user.shouldShowHand
    ? user.hands
    : hiddenHands.map((card, idx) =>
      user.revealedHandsMask && user.revealedHandsMask[idx] ? user.hands[idx] : card
    );
  return {
    id: user.chipsRecordID,
    name: user.name,
    nickname: user.nickname,
    avatar: user.avatar,
    hasCards: user.hands.length > 0,
    isRoomOwner: user.isRoomOwner,
    isOffline: user.isOffline,
    isReady: user.isReady,
    isFoled: user.isFolded,
    isAllIn: user.isAllIn,
    isActing: user.isActing,
    isWinner: user.isWinner,
    isInCurrentGame: user.isInCurrentGame,
    isSpectator: user.isSpectator,
    actionEndTime: user.actionEndTime,
    actionStartTime: user.actionStartTime ?? user.actionEndTime - 30000,
    actionName: user.actionName,
    hands: publicHands,
    maxCards: user.shouldShowHand ? user.maxCards : [],
    profits: user.profits,
    position: user.positon,
    handsType: user.shouldShowHand ? user.handsType : "",
    shouldShowHand: user.shouldShowHand,

    stack: user.stack - sum(user.bets),
    bet: room.game ? user.bets[room.game.round] : 0,
    addTimeUsed: user.addTimeUsed ?? 0,
  };
}

function getSimpleSelf(token: Token): SimpleSelf {
  const user = userMap[token];
  return {
    id: user.chipsRecordID,
    hands: user.hands,
    handsType: user.handsType,
  };
}

export function publish(token: Token, data: ActionBase, ws: PokerWebSocket) {
  const user = userMap[token];
  const action = data.action;
  if (!user) {
    return sendError(ws, "user not exists");
  }
  const room = roomMap[user.roomid];
  if (!room) {
    return sendError(ws, "not in room");
  }

  const simpleGame = getSimpleGame(room.game);
  const simpleRoom = getSimpleRoom(room);
  const simpleUser = getSimpleUser(token);

  switch (action) {
    case ActionType.ENTER_GAME:
    case ActionType.START_GAME:
    case ActionType.BET:
    case ActionType.FOLD:
    case ActionType.OVERTIME:
    case ActionType.REBUY:
    case ActionType.WATCH:
      send2all(room.id, {
        game: simpleGame,
        room: simpleRoom,
        serverTime: Date.now(),
      });
      break;
    case ActionType.READY:
    case ActionType.HANGUP:
      send2all(room.id, {
        user: simpleUser,
      });
      break;
    case ActionType.LEAVE:
      send2all(room.id, {
        game: simpleGame,
        serverTime: Date.now(),
      });
      break;
    case ActionType.PAUSE_GAME:
      send2all(room.id, {
        room: simpleRoom,
        serverTime: Date.now(),
      });
      break;
  }
}

export function publish2all(roomid: RoomID) {
  const room = roomMap[roomid];
  // 房间可能已在结算或解散流程中被删除，此时无需再广播
  if (!room) {
    return;
  }
  const simpleGame = getSimpleGame(room.game);
  const simpleRoom = getSimpleRoom(room);
  send2all(room.id, {
    game: simpleGame,
    room: simpleRoom,
    chips: getSimpleChipsRecords(room),
    serverTime: Date.now(),
  });
}

export function publishLog2all(roomid: RoomID, logs: string[]) {
  send2all(roomid, {
    logs,
  });
}
