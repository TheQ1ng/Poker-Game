import { message } from "antd";
import { ActionType } from "../ApiType";
import { setChipsRecord } from "../features/chipsrecord/chipsRecordSlice";
import { clearCreateRoomID } from "../features/createroom/createRoomSlice";
import { addLogs, replaceLogs, setHistoryRoom } from "../features/gamehistory/gameHistorySlice";
import { addMessage, setChatRoom } from "../features/chat/chatSlice";
import { roominfo } from "../features/home/homeAPI";
import { clearRoomID } from "../features/home/homeSlice";
import { getQuickVoiceSoundFile } from "../utils/quickVoice";
import { soundManager } from "../utils/soundManager";
import {
  setGame,
  setHands,
  setRoom,
  setSelectSettleTimes,
  setSelf,
  setUser,
  setSeeHandRequests,
  setRevealedHandForMe,
  clearSeeHandRequest,
  clearRevealedHandsForMe,
  setServerTimeOffset,
  setRoomChatBubble,
  setSupportRequests,
  setSupportPhase,
  clearSupportRequest,
  clearSupportPhase,
  setSupportedTargetId,
  clearSupportedTargetId,
  setSupportSummary,
  clearSupportSummary,
} from "../features/room/roomSlice";
import { AppThunk } from "./store";

let ws: WebSocket;
function send2server(data: any) {
  ws.send(JSON.stringify(data));
}
export const connect2server =
  (roomid: string): AppThunk =>
    (dispatch, getState) => {
      if (!!ws) {
        send2server({ action: ActionType.ENTER_GAME, roomid });
        return;
      }

      const browserPort = window.location.port;
      const backendPort = process.env.REACT_APP_BACKEND_PORT || (browserPort === "3000" || browserPort === "" ? "1999" : browserPort);
      const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
      const url = `${wsProtocol}://${window.location.hostname}:${backendPort}`;
      const token = localStorage["token"];

      ws = new WebSocket(url, token);

      let hideMessage: () => void = () => { };
      let connectTimer: ReturnType<typeof setTimeout>;
      let retrys = 0;

      function doConnect() {
        clearTimeout(connectTimer);
        if (++retrys < 10) {
          connectTimer = setTimeout(doConnect, 3000);
        }
        ws = new WebSocket(url, token);
      }

      ws.onopen = () => {
        console.log("36, connected");
        clearTimeout(connectTimer);
        send2server({ action: ActionType.ENTER_GAME, roomid });
        hideMessage();
      };
      ws.onmessage = (msg: MessageEvent) => {
        try {
          const data = JSON.parse(msg.data);
          if (data.code == -1) {
            message.error(data.error);
            // 看牌请求已过期或无效时清空弹窗，避免点确认/拒绝后弹窗不消失
            if (typeof data.error === "string" && (data.error.includes("过期") || data.error.includes("无效"))) {
              dispatch(clearSeeHandRequest());
            }
          }
          if (data.room) {
            dispatch(setHistoryRoom(data.room.roomid || ""));
            dispatch(setChatRoom(data.room.roomid || ""));
            dispatch(setRoom(data.room));
          }
          if (data.game) {
            dispatch(setGame(data.game));
            if (!data.game.isSettling) {
              dispatch(clearRevealedHandsForMe());
              dispatch(clearSeeHandRequest());
              // 新一局开始时，清除上一局的支持状态
              dispatch(clearSupportPhase());
              dispatch(clearSupportedTargetId());
            }
          }
          if (data.serverTime != null) {
            dispatch(setServerTimeOffset(data.serverTime - Date.now()));
          }
          if (data.self) {
            dispatch(setSelf(data.self));
          }
          if (data.user) {
            dispatch(setUser(data.user));
          }
          if (data.hands) {
            dispatch(setHands(data.hands));
          }
          if (data.chips) {
            dispatch(setChipsRecord(data.chips));
          }
          if (data.leave) {
            dispatch(clearRoomID(""));
            dispatch(clearCreateRoomID(""));
            dispatch(clearRevealedHandsForMe());
            dispatch(clearSeeHandRequest());
            dispatch(setHistoryRoom(""));
            dispatch(setChatRoom(""));
            if (data.message) {
              message.error(data.message);
            }
          }
          if (data.logs) {
            if (data.roomid) {
              dispatch(setHistoryRoom(data.roomid));
            }
            if (data.logsSnapshot) {
              dispatch(replaceLogs(data.logs));
            } else {
              dispatch(addLogs(data.logs));
            }
          }
          if (data.selectSettleTimes === 1) {
            dispatch(setSelectSettleTimes(true));
          }
          if (data.selectSettleTimes === 0) {
            dispatch(setSelectSettleTimes(false));
          }
          
          // 处理用户被踢事件
          if (data.type === "game" && data.action === "userKicked") {
            // 可以在这里添加通知，告知其他用户有用户被踢
            message.info(`有用户被移出房间`);
            // 房间状态会通过publish2all自动更新
          }

          if (data.seeHandRequests) {
            // 仅在被请求者端维护待处理看牌请求列表，由房间中心弹框统一展示
            dispatch(setSeeHandRequests(data.seeHandRequests));
          }
          if (data.revealedHand) {
            dispatch(setRevealedHandForMe(data.revealedHand));
          }
          if (data.seeHandDeclined) {
            message.info("对方拒绝了看牌请求");
          }
          // 支持功能消息处理
          if (data.supportRequests) {
            dispatch(setSupportRequests(data.supportRequests));
          }
          if (data.type === "supportPhase") {
            dispatch(clearSupportSummary());
            dispatch(setSupportPhase({
              isActive: true,
              time: data.time || 15,
              targets: data.targets || [],
              myStack: data.myStack || 0,
            }));
          }
          if (data.supportDeclined) {
            const name = data.targetName || "对方";
            // 区分余额不足等特殊原因
            if (data.reason && String(data.reason).includes("余额不足")) {
              message.info(`${name} 因余额不足，无法接受你的支持`);
            } else {
              message.info(`${name} 拒绝了你的支持`);
            }
            dispatch(clearSupportRequest());
          }
          if (data.supportAccepted) {
            const name = data.targetName || "对方";
            if (data.autoFirst) {
              message.success(`你第一个支持了 ${name}（${data.amount} 🌟）`);
            } else {
              message.success(`${name} 同意了你的支持（支持金额 ${data.amount} 🌟）`);
            }
            // 记录当前我支持的目标玩家ID，并关闭支持弹窗
            if (data.targetId) {
              dispatch(setSupportedTargetId(data.targetId));
            }
            dispatch(clearSupportRequest());
            dispatch(clearSupportPhase());
          }
          if (data.supportConfirmed) {
            const supporterName = data.supporterName || "有人";
            if (data.autoFirst) {
              message.success(`${supporterName} 第一个支持你（${data.amount} 🌟）`);
            } else {
              message.info(`${supporterName} 支持了你（${data.amount} 🌟）`);
            }
          }
          if (data.type === "supportRejected") {
            const name = data.targetName || "对方";
            // 超时未响应视为忽略
            message.info(`${name} 忽略了你的支持`);
            dispatch(clearSupportRequest());
          }
          if (data.type === "supportPhaseEnded") {
            dispatch(clearSupportPhase());
          }
          if (data.type === "supportSummary") {
            dispatch(setSupportSummary({
              isVisible: true,
              duration: Math.max(1, Number(data.duration) || 3),
              details: Array.isArray(data.details) ? data.details : [],
            }));
          }
          if (data.roomChat) {
            const message = data.roomChat.message;
            const soundFile = getQuickVoiceSoundFile(message);
            if (soundFile) {
              // 快捷语音走独立的预加载队列，避免被聊天写入/渲染阻塞
              soundManager.playQuickVoice(soundFile);
            } else if ('speechSynthesis' in window) {
              // 非快捷消息，使用语音朗读
              const isEmojiOnly = /^\p{Extended_Pictographic}+$/u.test(message);
              if (!isEmojiOnly) {
                const utterance = new SpeechSynthesisUtterance(message);
                utterance.lang = 'zh-CN';
                utterance.volume = 1;
                utterance.rate = 1;
                utterance.pitch = 1;
                speechSynthesis.speak(utterance);
              }
            }

            dispatch(setRoomChatBubble({ userId: data.roomChat.userId, text: data.roomChat.message }));
            // 添加到聊天消息列表
            dispatch(addMessage({
              sender: data.roomChat.nickname || data.roomChat.userId,
              content: data.roomChat.message,
              timestamp: Date.now()
            }));
          }

          console.log(data);
        } catch (e) {
          console.log(msg.data);
          console.error(e);
        }
      };
      ws.onclose = ws.onerror = () => {
        if (hideMessage) {
          hideMessage();
        }
        hideMessage = message.loading(
          "网络链接不稳定，自动重试中。或者刷新页面。",
          0
        );
        setTimeout(doConnect, 1000);
      };
    };

export function ws_startGame() {
  send2server({
    action: ActionType.START_GAME,
  });
}

export function ws_pauseGame() {
  send2server({
    action: ActionType.PAUSE_GAME,
  });
}

export function ws_userReady() {
  send2server({
    action: ActionType.READY,
  });
}

export function ws_userHangup() {
  send2server({
    action: ActionType.HANGUP,
  });
}

export function ws_userFold() {
  send2server({
    action: ActionType.FOLD,
  });
}

export function ws_userBet(chips: number) {
  send2server({
    action: ActionType.BET,
    chips,
  });
}

export function ws_userRebuy() {
  send2server({
    action: ActionType.REBUY,
  });
}

export function ws_userRepay() {
  send2server({
    action: ActionType.REPAY,
  });
}

export function ws_userLeave() {
  send2server({
    action: ActionType.LEAVE,
  });
}

export function ws_overtime() {
  send2server({
    action: ActionType.OVERTIME,
  });
}

export function ws_userShowHands() {
  send2server({
    action: ActionType.SHOW_HANDS,
  });
}

export function ws_revealBoardCard(boardIndex: number) {
  send2server({
    action: ActionType.REVEAL_BOARD_CARD,
    boardIndex,
  });
}

export function ws_userWatch(watch: boolean) {
  send2server({
    action: ActionType.WATCH,
    watch,
  });
}

export function ws_settleTimes(times: number) {
  send2server({
    action: ActionType.SET_SETTLE_TIMES,
    times,
  });
}

export function ws_sendMessage(message: string) {
  send2server({
    action: ActionType.SEND_MESSAGE,
    message,
  });
}

export function ws_addBot(roomid: string) {
  send2server({
    action: ActionType.ADD_BOT,
    roomid,
  });
}

export function ws_kickUser(userId: string) {
  send2server({
    action: ActionType.KICK_USER,
    userId,
  });
}

export function ws_requestSeeHand(targetUserId: string, chips: number) {
  send2server({
    action: ActionType.REQUEST_SEE_HAND,
    targetUserId,
    chips,
  });
}

export function ws_respondSeeHand(requestId: string, accept: boolean) {
  send2server({
    action: ActionType.RESPOND_SEE_HAND,
    requestId,
    accept,
  });
}

export function ws_extendActionTime() {
  send2server({
    action: ActionType.EXTEND_ACTION_TIME,
  });
}

export function ws_sendRedPacket(amount: number) {
  send2server({
    action: ActionType.SEND_RED_PACKET,
    amount,
  });
}

export function ws_openRedPacket() {
  send2server({
    action: ActionType.OPEN_RED_PACKET,
  });
}

export function ws_requestSupport(targetUserId: string, amount: number) {
  send2server({
    action: ActionType.REQUEST_SUPPORT,
    targetUserId,
    amount,
  });
}

export function ws_respondSupport(requestId: string, accept: boolean) {
  send2server({
    action: ActionType.RESPOND_SUPPORT,
    requestId,
    accept,
  });
}

export function ws_setShortDeck(enable: boolean) {
  send2server({
    action: ActionType.SET_SHORT_DECK,
    enable,
  });
}

export function ws_transferRoomOwner(targetUserId: string) {
  send2server({
    action: ActionType.TRANSFER_ROOM_OWNER,
    targetUserId,
  });
}

export function ws_repairRoomBalance() {
  send2server({
    action: ActionType.REPAIR_ROOM_BALANCE,
  });
}
