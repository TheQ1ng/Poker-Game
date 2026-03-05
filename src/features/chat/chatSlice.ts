import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface ChatMessage {
  sender: string;
  content: string;
  timestamp: number;
}

interface ChatState {
  messages: ChatMessage[];
}

const initialState: ChatState = {
  messages: [],
};

export const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    addMessage: (state, action: PayloadAction<ChatMessage>) => {
      state.messages.push(action.payload);
      // 只保留最近100条消息
      if (state.messages.length > 100) {
        state.messages.shift();
      }
    },
    clearMessages: (state) => {
      state.messages = [];
    },
  },
});

export const { addMessage, clearMessages } = chatSlice.actions;
export const selectChatMessages = (state: any) => state.chat.messages;
export default chatSlice.reducer;
