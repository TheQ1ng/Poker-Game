import React, { useEffect, useState } from "react";

import { useAppSelector, useAppDispatch } from "../../app/hooks";
import {
  selectToken,
  selectRoomID,
  loadRoomInfoAsync,
} from "./homeSlice";
import { connect2server } from "../../app/websocket";
import MarkitLanding from "./MarkitLanding";
import Register from "../register/Register";
import Room from "../room/Room";
import CreateRoom from "../createroom/CreateRoom";
import Admin from "../admin/Admin";

function normalizePath(pathname: string) {
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed || "/";
}

function Home() {
  const dispatch = useAppDispatch();
  const token = useAppSelector(selectToken);
  const roomid = useAppSelector(selectRoomID);
  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem("isAdmin") === "true");
  const [currentPath, setCurrentPath] = useState(() => normalizePath(window.location.pathname));

  const navigate = (path: string, replace = false) => {
    const nextPath = normalizePath(path);
    if (replace) {
      window.history.replaceState({}, "", nextPath);
    } else {
      window.history.pushState({}, "", nextPath);
    }
    setCurrentPath(nextPath);
  };

  useEffect(() => {
    const syncAdminState = () => {
      setIsAdmin(localStorage.getItem("isAdmin") === "true");
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "isAdmin") {
        syncAdminState();
      }
    };

    const handlePathChange = () => {
      setCurrentPath(normalizePath(window.location.pathname));
    };

    syncAdminState();
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
  }, [token, dispatch]);

  useEffect(() => {
    if (roomid) {
      dispatch(connect2server(roomid));
    }
  }, [roomid, dispatch]);

  const isAdminPath = currentPath === "/admin";
  const isLoginPath = currentPath === "/login";

  if (isAdminPath && token && isAdmin) {
    return (
      <div style={{ display: "flex", flexDirection: "column", width: "100vw", height: "100vh" }}>
        <Admin />
      </div>
    );
  }

  if (isAdminPath && (!token || !isAdmin)) {
    window.location.replace("/");
    return null;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100vw", height: "100vh" }}>
      {!token ? (
        isLoginPath ? (
          <Register onBackClick={() => navigate("/", true)} />
        ) : (
          <MarkitLanding onLoginClick={() => navigate("/login")} />
        )
      ) : roomid ? (
        <Room />
      ) : (
        <CreateRoom />
      )}
    </div>
  );
}

export default Home;
