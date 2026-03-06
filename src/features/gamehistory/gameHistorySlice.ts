import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "../../app/store";

export interface GameHistoryState {
  roomid: string;
  logs: string[];
}

const STORAGE_KEY = "gameHistoryByRoom";

function readStore(): Record<string, string[]> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeStore(roomid: string, logs: string[]) {
  if (!roomid) return;
  const all = readStore();
  all[roomid] = logs;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

const initialState: GameHistoryState = {
  roomid: "",
  logs: [],
};

export const gameHistory = createSlice({
  name: "gamehistory",
  initialState,
  reducers: {
    setHistoryRoom(state, action: PayloadAction<string>) {
      const roomid = action.payload || "";
      if (state.roomid === roomid) return;
      state.roomid = roomid;
      if (!roomid) {
        state.logs = [];
        return;
      }
      const all = readStore();
      state.logs = Array.isArray(all[roomid]) ? all[roomid] : [];
    },
    addLogs(state, action: PayloadAction<string[]>) {
      if (!action.payload || action.payload.length === 0) return;
      state.logs = [...state.logs, ...action.payload];
      writeStore(state.roomid, state.logs);
    },
    replaceLogs(state, action: PayloadAction<string[]>) {
      state.logs = action.payload || [];
      writeStore(state.roomid, state.logs);
    },
    clearLogs(state) {
      state.logs = [];
      writeStore(state.roomid, state.logs);
    },
  },
});

export const { setHistoryRoom, addLogs, replaceLogs, clearLogs } = gameHistory.actions;
export const selectGameHistory = (state: RootState) => state.gamehistory.logs;
export default gameHistory.reducer;
