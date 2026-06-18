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
  reBuyLimit: number,
  isShortDeck: boolean,
  isOmaha: boolean,
  redPacketThresholdMultiple: number,
  redPacketMaxPercent: number,
  supportEnabled: boolean = false,
  supportMinPot: number = 600,
  supportMaxPercent: number = 5,
  overtimeCost: number = 0
): Promise<ApiRsp> {
  const rsp = await fetch("/createroom", {
    method: "POST",
    body: JSON.stringify({
      sb,
      buyin,
      reBuyLimit,
      isShortDeck,
      isOmaha,
      redPacketThresholdMultiple,
      redPacketMaxPercent,
      supportEnabled,
      supportMinPot,
      supportMaxPercent,
      overtimeCost,
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
  playerCount: number;
  maxPlayers: number;
  smallBlind: number;
  ownerName?: string;
  isShortDeck?: boolean;
  isOmaha?: boolean;
}

export async function fetchRooms(): Promise<{ rooms: RoomInfo[] }> {
  const rsp = await fetch("/rooms", {
    method: "GET",
    headers: {
      authorization: localStorage["token"],
    },
  });
  return await rsp.json();
}

export interface ProfileData {
  nickname: string;
  avatar: string;
}

export async function fetchProfile(): Promise<ApiRsp & { data?: ProfileData }> {
  const rsp = await fetch("/profile", {
    method: "GET",
    headers: {
      authorization: localStorage["token"],
    },
  });
  return await rsp.json();
}

export async function updateProfile(nickname: string, avatar: string): Promise<ApiRsp> {
  const rsp = await fetch("/updateprofile", {
    method: "POST",
    body: JSON.stringify({
      nickname,
      avatar,
    }),
    headers: {
      authorization: localStorage["token"],
      "Content-Type": "application/json",
    },
  });
  return await rsp.json();
}
