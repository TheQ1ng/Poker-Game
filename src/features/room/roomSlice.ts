import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  SimpleGame,
  SimpleRoom,
  SimpleSelf,
  SimpleUser,
  SimpleUserHands,
  Card,
} from "../../ApiType";
import { RootState } from "../../app/store";

export interface SeeHandRequestPayload {
  requestId: string;
  fromUserId: string;
  fromName: string;
  chips: number;
}

export interface RevealedHandPayload {
  targetUserId: string;
  hands: Card[];
  handsType: string;
  maxCards: Card[];
}

export interface RoomState {
  room: SimpleRoom | null;
  game: SimpleGame | null;
  self: SimpleSelf | null;
  selectSettleTimes: boolean;
  /** 客户端与服务器时间差（ms），用于倒计时同步：serverNow ≈ Date.now() + serverTimeOffset */
  serverTimeOffset: number;
  /** 有人请求看我的手牌（仅我作为被请求者时），支持多人同时申请 */
  pendingSeeHandRequests: SeeHandRequestPayload[];
  /** 我花欢乐豆后对方同意，仅我可见的手牌 */
  revealedHandsForMe: Record<string, RevealedHandPayload>;
  /** 房间内玩家头顶气泡：userId -> { text, at }，用于聊天展示 */
  roomChatBubbles: Record<string, { text: string; at: number }>;
}

const initialState: RoomState = {
  room: null,
  game: null,
  self: null,
  selectSettleTimes: false,
  serverTimeOffset: 0,
  pendingSeeHandRequests: [],
  revealedHandsForMe: {},
  roomChatBubbles: {},
};

export const roomSlice = createSlice({
  name: "room",
  initialState,
  reducers: {
    setRoom(state, action: PayloadAction<SimpleRoom>) {
      state.room = action.payload;
    },
    setGame(state, action: PayloadAction<SimpleGame>) {
      state.game = action.payload;
    },
    setSelf(state, action: PayloadAction<SimpleSelf>) {
      state.self = action.payload;
    },
    setUser(state, action: PayloadAction<SimpleUser>) {
      const room = state.room;
      const user = action.payload;
      if (room) {
        room.users.forEach((u, i) => {
          if (u.id === user.id) {
            room.users[i] = user;
          }
        });
      }
    },
    setHands(state, action: PayloadAction<SimpleUserHands>) {
      const room = state.room;
      const { id, hands } = action.payload;
      const user = room?.users.find((u) => u.id == id);
      if (user) {
        const maxLen = Math.max(user.hands?.length || 0, hands?.length || 0);
        if (!user.hands || user.hands.length !== maxLen) {
          const nextHands = new Array(maxLen).fill(null);
          (user.hands || []).forEach((card, idx) => {
            nextHands[idx] = card;
          });
          user.hands = nextHands;
        }
        hands.forEach((card, idx) => {
          if (card) {
            user.hands[idx] = card;
          }
        });
        if (maxLen === 0) {
          user.hands = [];
        }
      }
    },
    setSelectSettleTimes(state, action: PayloadAction<boolean>) {
      state.selectSettleTimes = action.payload;
    },
    setServerTimeOffset(state, action: PayloadAction<number>) {
      state.serverTimeOffset = action.payload;
    },
    setSeeHandRequests(state, action: PayloadAction<SeeHandRequestPayload[]>) {
      state.pendingSeeHandRequests = action.payload;
    },
    setRevealedHandForMe(state, action: PayloadAction<RevealedHandPayload>) {
      const { targetUserId } = action.payload;
      state.revealedHandsForMe[targetUserId] = action.payload;
    },
    clearSeeHandRequest(state) {
      state.pendingSeeHandRequests = [];
    },
    clearRevealedHandsForMe(state) {
      state.revealedHandsForMe = {};
    },
    setRoomChatBubble(state, action: PayloadAction<{ userId: string; text: string }>) {
      const { userId, text } = action.payload;
      state.roomChatBubbles[userId] = { text, at: Date.now() };
    },
    clearRoomChatBubble(state, action: PayloadAction<string>) {
      delete state.roomChatBubbles[action.payload];
    },
  },
  extraReducers: (builder) => {},
});

export const {
  setRoom,
  setGame,
  setSelf,
  setUser,
  setHands,
  setSelectSettleTimes,
  setServerTimeOffset,
  setSeeHandRequests,
  setRevealedHandForMe,
  clearSeeHandRequest,
  clearRevealedHandsForMe,
  setRoomChatBubble,
  clearRoomChatBubble,
} = roomSlice.actions;
export const selectRoomID = (state: RootState) => state.room.room?.roomid;
export const selectServerTimeOffset = (state: RootState) => state.room.serverTimeOffset;
export const selectUsers = (state: RootState) => {
  const { room, self } = state.room;
  if (!room || !self) return [];
  const ids = room.users.filter((u) => !u.isSpectator).map((u) => u.id) || [];
  const selfIndex = ids.indexOf(self.id);
  return [...[...ids].splice(selfIndex + 1), ...[...ids].splice(0, selfIndex)];
};
export const selectSpectators = (state: RootState) => {
  const { room, self } = state.room;
  if (!room || !self) return [];
  return room.users.filter((u) => u.isSpectator);
};
export const selectRoom = (state: RootState) => {
  return state.room.room;
};
export const selectGame = (state: RootState) => {
  return state.room.game;
};
export const selectSelf = (state: RootState) => {
  const { room, self } = state.room;
  if (!room || !self) {
    return null;
  }
  const owner = room.users[room.users.findIndex((u) => u.id == self.id)];
  return Object.assign({}, owner, self);
};
export const getSelectSettleStatus = (state: RootState) => {
  return state.room.selectSettleTimes;
};

export const selectPendingSeeHandRequests = (state: RootState) =>
  state.room.pendingSeeHandRequests;

export const selectRevealedHandsForMe = (state: RootState) =>
  state.room.revealedHandsForMe;

export const selectRoomChatBubbles = (state: RootState) =>
  state.room.roomChatBubbles;

export default roomSlice.reducer;
