import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "../../app/store";

export interface ChatMessage {
  sender: string;
  content: string;
  timestamp: number;
}

interface ChatState {
  roomid: string;
  messages: ChatMessage[];
}

const STORAGE_KEY = "chatByRoom";

function readStore(): Record<string, ChatMessage[]> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeStore(roomid: string, messages: ChatMessage[]) {
  if (!roomid) return;
  const all = readStore();
  all[roomid] = messages;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

const initialState: ChatState = {
  roomid: "",
  messages: [],
};

export const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    setChatRoom(state, action: PayloadAction<string>) {
      const roomid = action.payload || "";
      if (state.roomid === roomid) return;
      state.roomid = roomid;
      if (!roomid) {
        state.messages = [];
        return;
      }
      const all = readStore();
      state.messages = Array.isArray(all[roomid]) ? all[roomid] : [];
    },
    addMessage: (state, action: PayloadAction<ChatMessage>) => {
      state.messages.push(action.payload);
      writeStore(state.roomid, state.messages);
    },
    clearMessages: (state) => {
      state.messages = [];
      writeStore(state.roomid, state.messages);
    },
  },
});

export const { setChatRoom, addMessage, clearMessages } = chatSlice.actions;
export const selectChatMessages = (state: RootState) => state.chat.messages;
export default chatSlice.reducer;
