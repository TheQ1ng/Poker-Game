import { ApiRsp } from "../../ApiType";

export function loadToken() {
  return localStorage["token"];
}

export async function roominfo(): Promise<ApiRsp> {
  const rsp = await fetch("/currentroom", {
    method: "GET",
    headers: {
      authorization: localStorage["token"],
    },
  });
  return await rsp.json();
}

export async function createroom(
  sb: number,
  buyin: number,
  reBuyLimit: number
): Promise<ApiRsp> {
  const rsp = await fetch("/createroom", {
    method: "POST",
    body: JSON.stringify({
      sb,
      buyin,
      reBuyLimit,
    }),
    headers: {
      authorization: localStorage["token"],
      "Content-Type": "application/json",
    },
  });
  return await rsp.json();
}

export async function joinroom(roomid: string): Promise<ApiRsp> {
  const rsp = await fetch("/joinroom", {
    method: "POST",
    body: JSON.stringify({
      roomid,
    }),
    headers: {
      authorization: localStorage["token"],
      "Content-Type": "application/json",
    },
  });
  return await rsp.json();
}

export interface RoomInfo {
  id: string;
  smallBlind: number;
  playerCount: number;
  maxPlayers: number;
  ownerName: string;
}

export async function fetchRooms(): Promise<{ rooms: RoomInfo[] }> {
  const rsp = await fetch("/rooms", {
    method: "GET",
  });
  return await rsp.json();
}

export interface UserProfile {
  code: number;
  data: {
    name: string;
    nickname: string;
    avatar: string;
  };
}

export async function fetchProfile(): Promise<UserProfile> {
  const rsp = await fetch("/profile", {
    method: "GET",
    headers: {
      Authorization: localStorage.getItem("token") || "",
    },
  });
  return await rsp.json();
}

export async function updateProfile(nickname: string, avatar: string): Promise<UserProfile> {
  const rsp = await fetch("/updateprofile", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: localStorage.getItem("token") || "",
    },
    body: JSON.stringify({ nickname, avatar }),
  });
  return await rsp.json();
}
