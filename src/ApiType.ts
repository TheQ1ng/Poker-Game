export interface ApiRspSuccess {
  code: 0;
  data: any;
}
export interface ApiRspError {
  code: -1;
  error: string;
}

export type ApiRsp = ApiRspSuccess | ApiRspError;

export type RoomID = string;
export type Token = string;
export type Card = {
  num: number;
  suit: string;
};

export interface SimpleGame {
  boardCards: Card[];
  pots: number;
  acting: string; // user's uuid in room, not token
  raiseUser: string;
  raiseBet: number; //
  raiseBetDiff: number; // valid rasize count
  preBet: number;
  bb: number;
  reBuyLimit: number;
  isSettling: boolean;
  nextGameTime: number;
  userCount: number;
}

export interface SimpleUser {
  id: string;
  name: string;
  nickname: string;
  avatar: string;
  hasCards: boolean;
  isRoomOwner: boolean;
  isOffline: boolean;
  isReady: boolean;
  isFoled: boolean;
  isAllIn: boolean;
  isActing: boolean;
  isWinner: boolean;
  isInCurrentGame: boolean;
  isSpectator: boolean;
  actionEndTime: number;
  /** 当前行动轮开始时间（ms），用于前端圆圈总时长；加时时不改，故总时长会变长 */
  actionStartTime?: number;
  actionName: string;
  hands: (Card | null)[];
  handsType: string;
  maxCards: Card[];
  profits: number;
  position: string;
  shouldShowHand: boolean;

  stack: number;
  bet: number;
  /** 本手牌已使用 +30s 次数（0～3） */
  addTimeUsed?: number;
}

export interface SimpleRoom {
  roomid: RoomID;
  isGaming: boolean;
  users: SimpleUser[];
}

export interface SimpleSelf {
  id: string;
  hands: Card[];
  handsType: string;
}

export interface SimpleUserHands extends SimpleSelf { }

export interface SimpleChipsRecord {
  id: string;
  name: string;
  nickname: string;
  chips: number;
  buyIn: number;
}

export interface SimpleRoomChipsRecords {
  roomid: string;
  chipsRecords: SimpleChipsRecord[];
}

export enum ActionType {
  ENTER_GAME = "ENTER_GAME",
  START_GAME = "START_GAME",
  PAUSE_GAME = "PAUSE_GAME",
  READY = "READY",
  HANGUP = "HANGUP",
  BET = "BET",
  FOLD = "FOLD",
  OVERTIME = "OVERTIME",
  REBUY = "REBUY",
  LEAVE = "LEAVE",
  SHOW_HANDS = "SHOW_HANDS",
  WATCH = "WATCH",
  SET_SETTLE_TIMES = "SET_SETTLE_TIMES",
  SEND_MESSAGE = "SEND_MESSAGE",
  ADD_BOT = "ADD_BOT",
  KICK_USER = "KICK_USER",
  SETTLE_GAME = "SETTLE_GAME",
  REQUEST_SEE_HAND = "REQUEST_SEE_HAND",
  RESPOND_SEE_HAND = "RESPOND_SEE_HAND",
  EXTEND_ACTION_TIME = "EXTEND_ACTION_TIME",
}
