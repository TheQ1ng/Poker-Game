import { message } from "antd";
import { ActionType } from "../ApiType";
import { setChipsRecord } from "../features/chipsrecord/chipsRecordSlice";
import { clearCreateRoomID } from "../features/createroom/createRoomSlice";
import { addLogs } from "../features/gamehistory/gameHistorySlice";
import { roominfo } from "../features/home/homeAPI";
import { clearRoomID } from "../features/home/homeSlice";
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
} from "../features/room/roomSlice";
import { AppThunk } from "./store";

// 快捷消息到音效的映射
const messageToSoundMap: { [key: string]: string } = {
  "棒棒棒棒！": "bangbangbangbang.WAV",
  "难道他真的是赋能哥": "funeng.WAV",
  "哈哈哈哈哈哈": "hahahhahahaha.WAV",
  "颗秒！": "kemiao.WAV",
  "17张牌你能秒我！": "17zhangpai.WAV",
  "给我擦皮鞋！": "capixie.WAV",
  "慢波！": "manbo.WAV",
  "牌没有问题！": "meiyouwenti.WAV",
  "我要验牌！": "yanpai.WAV"
};

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

      const url =
        window.location.port == "8086"
          ? `ws://${window.location.host}`
          : `ws://${window.location.host.replace(window.location.port, "8086")}`;
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
            dispatch(setRoom(data.room));
          }
          if (data.game) {
            dispatch(setGame(data.game));
            if (!data.game.isSettling) {
              dispatch(clearRevealedHandsForMe());
              dispatch(clearSeeHandRequest());
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
            if (data.message) {
              message.error(data.message);
            }
          }
          if (data.logs) {
            dispatch(addLogs(data.logs));
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
          if (data.roomChat) {
            dispatch(setRoomChatBubble({ userId: data.roomChat.userId, text: data.roomChat.message }));
            const message = data.roomChat.message;
            // 检查是否为快捷消息（有对应的音效）
            const soundFile = messageToSoundMap[message];
            if (soundFile) {
              // 播放快捷消息对应的音效
              const audio = new Audio(`/sounds/${soundFile}`);
              audio.play().catch(err => console.warn('Failed to play sound:', err));
            } else {
              // 非快捷消息，使用语音朗读
              if ('speechSynthesis' in window) {
                // 检查是否为表情消息（只包含表情符号）
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
            }
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

export function ws_userShowHands(index: number) {
  send2server({
    action: ActionType.SHOW_HANDS,
    index,
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

export function ws_settleGame() {
  send2server({
    action: ActionType.SETTLE_GAME,
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
