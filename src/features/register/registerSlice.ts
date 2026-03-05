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
    console.log('[DEBUG] Thunk started, account:', account);
    const rsp = await registerApi(account);
    console.log('[DEBUG] Response received in thunk:', rsp);
    if (rsp.code == 0) {
      console.log('[DEBUG] Success branch entered, token:', (rsp as any)?.data?.token, 'isAdmin:', rsp.data.isAdmin);
      localStorage['name'] = account.name;
      // 保存 token 和 isAdmin 信息
      localStorage.setItem("token", rsp.data.token);
      localStorage.setItem("isAdmin", rsp.data.isAdmin.toString());
      
      // 立即跳转到相应页面，不等待 fetchProfile
      if (rsp.data.isAdmin) {
        console.log('[DEBUG] Admin login detected, redirecting to /admin');
        window.location.href = "/admin";
      } else {
        console.log('[DEBUG] Regular user login detected, redirecting to /');
        window.location.href = "/";
      }
      
      // 登录成功后获取用户资料并保存到 localStorage（后台执行）
      try {
        const profile = await fetchProfile();
        localStorage.setItem("nickname", profile.data?.nickname || "");
        localStorage.setItem("avatar", profile.data?.avatar || "");
        localStorage.setItem("isAdmin", profile.data?.isAdmin.toString());
        console.log('[DEBUG] Profile fetched successfully:', profile.data);
      } catch (e) {
        console.error("Failed to fetch profile after login:", e);
      }
    } else {
      console.log('[DEBUG] Error branch entered:', rsp);
      message.error((rsp as any)?.error || '未知错误');
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
