import { createAsyncThunk, createSlice, ThunkDispatch } from '@reduxjs/toolkit';
import { message } from 'antd';
import { ApiRsp } from '../../ApiType';
import { RootState, AppThunk } from '../../app/store';

import { registerApi } from './registerAPI';
import { fetchProfile } from '../home/homeAPI';

export interface RegisterState {
  error: string;
  status: 'idle' | 'loading' | 'failed';
}

const initialState: RegisterState = {
  error: '',
  status: 'idle'
};

export const registerAsync = createAsyncThunk(
  'register/api',
  async ({
    account,
    dispatch
  }: {
    account: { name: string; password: string };
    dispatch: ThunkDispatch<any, any, any>;
  }) => {
    const rsp = await registerApi(account);
    if (rsp.code == 0) {
      localStorage['name'] = account.name;
      // 保存 token 和 isAdmin 信息
      localStorage.setItem("token", rsp.data.token);
      localStorage.setItem("isAdmin", rsp.data.isAdmin.toString());
      
      // 登录成功后获取用户资料并保存到 localStorage
      try {
        const profile = await fetchProfile();
        localStorage.setItem("nickname", profile.data?.nickname || "");
        localStorage.setItem("avatar", profile.data?.avatar || "");
        localStorage.setItem("isAdmin", profile.data?.isAdmin.toString());
        
        // 根据 isAdmin 字段跳转到不同界面
        if (profile.data?.isAdmin) {
          window.location.href = "/admin";
        } else {
          window.location.href = "/";
        }
      } catch (e) {
        console.error("Failed to fetch profile after login:", e);
        // 出错时根据登录返回的 isAdmin 字段跳转
        if (rsp.data.isAdmin) {
          window.location.href = "/admin";
        } else {
          window.location.href = "/";
        }
      }
    } else {
      message.error(rsp.error);
    }
    return rsp;
  }
);

export const registerSlice = createSlice({
  name: 'register',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(registerAsync.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(registerAsync.fulfilled, (state, action) => {
        state.status = 'idle';
        const rsp: ApiRsp = action.payload;
        if (rsp.code == -1) {
          state.error = rsp.error;
        }
      });
  }
});

export const getTokenFromSever =
  (rsp: ApiRsp): AppThunk =>
  (dispatch, getState) => {
    if (rsp.code == 0) {
      // 保存 token 和 isAdmin 信息
      localStorage.setItem("token", rsp.data.token);
      localStorage.setItem("isAdmin", rsp.data.isAdmin.toString());
    }
  };

export const selectError = (state: RootState) => state.register.error;

export default registerSlice.reducer;
