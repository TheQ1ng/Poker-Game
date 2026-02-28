import React, { useEffect, useState, lazy, Suspense } from "react";
import { PageHeader, Button, Avatar, Dropdown, Menu } from "antd";
import { DownOutlined } from "@ant-design/icons";

import { useAppSelector, useAppDispatch } from "../../app/hooks";
import {
  selectToken,
  logout,
  selectRoomID,
  loadRoomInfoAsync,
} from "./homeSlice";
import { connect2server } from "../../app/websocket";
import Loading from "../../components/Loading";

// 懒加载组件
const Register = lazy(() => import("../register/Register"));
const Room = lazy(() => import("../room/Room"));
const CreateRoom = lazy(() => import("../createroom/CreateRoom"));

function Home() {
  const dispatch = useAppDispatch();
  const token = useAppSelector(selectToken);
  const roomid = useAppSelector(selectRoomID);

  useEffect(() => {
    if (token) {
      dispatch(loadRoomInfoAsync());
    }
  }, [token]);

  useEffect(() => {
    if (roomid) {
      dispatch(connect2server(roomid));
      console.log("got room", roomid);
    }
  }, [roomid]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100vw",
        height: "100vh",
      }}
    >
      <Suspense fallback={<Loading />}>
        {!token ? <Register /> : roomid ? <Room></Room> : <CreateRoom />}
      </Suspense>
    </div>
  );
}

export default Home;
