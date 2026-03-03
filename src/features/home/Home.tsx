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
const Admin = lazy(() => import("../admin/Admin"));

function Home() {
  const dispatch = useAppDispatch();
  const token = useAppSelector(selectToken);
  const roomid = useAppSelector(selectRoomID);
  // 直接从localStorage获取isAdmin值，确保初始渲染时就有正确的值
  const [isAdmin, setIsAdmin] = useState(() => {
    const adminStatus = localStorage.getItem("isAdmin");
    return adminStatus === "true";
  });
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    // 检查是否是管理员
    const checkAdminStatus = () => {
      const adminStatus = localStorage.getItem("isAdmin");
      setIsAdmin(adminStatus === "true");
    };

    // 初始检查
    checkAdminStatus();

    // 监听localStorage变化
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "isAdmin") {
        checkAdminStatus();
      }
    };

    // 监听路径变化
    const handlePathChange = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("popstate", handlePathChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("popstate", handlePathChange);
    };
  }, []);

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

  // 处理管理界面路由
  if (currentPath === "/admin" && token && isAdmin) {
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
          <Admin />
        </Suspense>
      </div>
    );
  }

  // 非管理员访问 /admin 路径时重定向到首页
  if (currentPath === "/admin" && (!token || !isAdmin)) {
    window.location.href = "/";
    return null;
  }

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
