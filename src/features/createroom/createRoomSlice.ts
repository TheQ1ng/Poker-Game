import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { message } from "antd";
import { ApiRsp } from "../../ApiType";
import { RootState } from "../../app/store";
import { createroom, joinroom, fetchRooms, RoomInfo } from "../home/homeAPI";

type Status = "idle" | "loading" | "failed";

export interface CreateRoomState {
  createRoomStatus: Status;
  joinRoomStatus: Status;
  roomid: string;
  rooms: RoomInfo[];
  fetchRoomsStatus: Status;
}

const initialState: CreateRoomState = {
  roomid: "",
  createRoomStatus: "idle",
  joinRoomStatus: "idle",
  rooms: [],
  fetchRoomsStatus: "idle",
};

export const createRoomAsync = createAsyncThunk(
  "home/createroom",
  async ({
    sb,
    buyIn,
    reBuyLimit,
  }: {
    sb: number;
    buyIn: number;
    reBuyLimit: number;
  }) => {
    return await createroom(sb, buyIn, reBuyLimit);
  }
);

export const joinRoomAsync = createAsyncThunk(
  "home/joinroom",
  async (roomid: string) => {
    return await joinroom(roomid);
  }
);

export const fetchRoomsAsync = createAsyncThunk(
  "home/fetchrooms",
  async () => {
    return await fetchRooms();
  }
);

export const createRoomSlice = createSlice({
  name: "createroom",
  initialState,
  reducers: {
    clearCreateRoomID: (state, action: PayloadAction<any>) => {
      state.roomid = "";
    },
  },
  extraReducers: (builder) => {
    builder

      .addCase(createRoomAsync.pending, (state) => {
        state.createRoomStatus = "loading";
      })
      .addCase(createRoomAsync.fulfilled, (state, action) => {
        state.createRoomStatus = "idle";
        const rsp: ApiRsp = action.payload;
        if (rsp.code == 0) {
          state.roomid = rsp.data;
        } else {
          message.error(rsp.error);
        }
      })
      .addCase(createRoomAsync.rejected, (state, action) => {
        state.createRoomStatus = "idle";
        const err = action.error?.message || "";
        if (err.includes("fetch") || err.includes("Failed") || err.includes("Network")) {
          message.error("无法连接服务器，请确认后端已启动（端口 8086）");
        } else {
          message.error("创建房间失败：" + (action.error?.message || "未知错误"));
        }
      })
      .addCase(joinRoomAsync.pending, (state) => {
        state.joinRoomStatus = "loading";
      })
      .addCase(joinRoomAsync.fulfilled, (state, action) => {
        state.joinRoomStatus = "idle";
        const rsp: ApiRsp = action.payload;
        if (rsp.code == 0) {
          state.roomid = rsp.data;
        } else {
          message.error(rsp.error);
        }
      })
      .addCase(joinRoomAsync.rejected, (state, action) => {
        state.joinRoomStatus = "idle";
        const err = action.error?.message || "";
        if (err.includes("fetch") || err.includes("Failed") || err.includes("Network")) {
          message.error("无法连接服务器，请确认后端已启动（端口 8086）");
        } else {
          message.error("加入房间失败：" + (action.error?.message || "未知错误"));
        }
      })
      .addCase(fetchRoomsAsync.pending, (state) => {
        state.fetchRoomsStatus = "loading";
      })
      .addCase(fetchRoomsAsync.fulfilled, (state, action) => {
        state.fetchRoomsStatus = "idle";
        state.rooms = action.payload.rooms;
      })
      .addCase(fetchRoomsAsync.rejected, (state) => {
        state.fetchRoomsStatus = "failed";
      });
  },
});

export const { clearCreateRoomID } = createRoomSlice.actions;

export const selectStatus = (state: RootState) => ({
  createRoomStatus: state.createroom.createRoomStatus,
  joinRoomStatus: state.createroom.joinRoomStatus,
});

export default createRoomSlice.reducer;
