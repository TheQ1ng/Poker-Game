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

export interface SupportRequestPayload {
  requestId: string;
  fromUserId: string;
  fromName: string;
  amount: number;
}

export interface SupportTargetInfo {
  id: string;
  name: string;
  totalBet: number;
  maxSupport: number;
}

export interface SupportPhasePayload {
  isActive: boolean;
  time: number;
  targets: SupportTargetInfo[];
  myStack: number;
}

export interface SupportSummarySupporter {
  supporterId: string;
  supporterName: string;
  amount: number;
  estimatedReturnIfWin: number;
  estimatedProfitIfWin: number;
}

export interface SupportSummaryItem {
  targetId: string;
  targetName: string;
  targetTotalBet: number;
  totalSupport: number;
  estimatedTargetNetIfWin: number;
  supporters: SupportSummarySupporter[];
}

export interface SupportSummaryPayload {
  isVisible: boolean;
  duration: number;
  details: SupportSummaryItem[];
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
  /** 有人请求支持我（仅我作为被支持者时） */
  pendingSupportRequests: SupportRequestPayload[];
  /** 支持阶段状态（仅弃牌玩家可见） */
  supportPhase: SupportPhasePayload | null;
  /** 我当前支持的目标玩家ID（chipsRecordID），用于在其头像旁显示小红旗 */
  supportedTargetId: string | null;
  /** 支持阶段结束后展示 3s 的支持详情弹窗 */
  supportSummary: SupportSummaryPayload | null;
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
  pendingSupportRequests: [],
  supportPhase: null,
  supportedTargetId: null,
  supportSummary: null,
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
    setSupportRequests(state, action: PayloadAction<SupportRequestPayload[]>) {
      state.pendingSupportRequests = action.payload;
    },
    setSupportPhase(state, action: PayloadAction<SupportPhasePayload | null>) {
      state.supportPhase = action.payload;
    },
    clearSupportRequest(state) {
      state.pendingSupportRequests = [];
    },
    clearSupportPhase(state) {
      state.supportPhase = null;
    },
    setSupportedTargetId(state, action: PayloadAction<string | null>) {
      state.supportedTargetId = action.payload;
    },
    clearSupportedTargetId(state) {
      state.supportedTargetId = null;
    },
    setSupportSummary(state, action: PayloadAction<SupportSummaryPayload | null>) {
      state.supportSummary = action.payload;
    },
    clearSupportSummary(state) {
      state.supportSummary = null;
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
  setSupportRequests,
  setSupportPhase,
  clearSupportRequest,
  clearSupportPhase,
  setSupportedTargetId,
  clearSupportedTargetId,
  setSupportSummary,
  clearSupportSummary,
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

export const selectPendingSupportRequests = (state: RootState) =>
  state.room.pendingSupportRequests;

export const selectSupportPhase = (state: RootState) =>
  state.room.supportPhase;

export const selectSupportedTargetId = (state: RootState) =>
  state.room.supportedTargetId;

export const selectSupportSummary = (state: RootState) =>
  state.room.supportSummary;

export default roomSlice.reducer;
