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

export interface SimpleRoomRedPacketConfig {
  thresholdMultiple: number;
  maxPercent: number;
}

export interface SimpleRoomRedPacketDetail {
  userId: string;
  name: string;
  amount: number;
  autoOpened: boolean;
}

export interface SimpleRoomRedPacket {
  id: string;
  status: "waiting" | "result";
  senderUserId: string;
  senderName: string;
  totalAmount: number;
  /** 红包触发时，下一局倒计时剩余毫秒（用于前端显示“暂停”） */
  pausedNextGameRemainMs: number;
  recipientUserIds: string[];
  openedUserIds: string[];
  openDeadline: number;
  resultDeadline: number;
  luckiestUserId?: string;
  details?: SimpleRoomRedPacketDetail[];
}

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
  /** 是否短牌（仅 6～A 共 36 张） */
  isShortDeck?: boolean;
  /** 是否奥马哈（4 张手牌，必须 2+3 组成 5 张） */
  isOmaha?: boolean;
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
  /** 是否短牌 */
  isShortDeck?: boolean;
  /** 是否奥马哈 */
  isOmaha?: boolean;
  /** 红包配置：水上门槛倍数 + 最大发包比例 */
  redPacketConfig?: SimpleRoomRedPacketConfig;
  /** 当前红包状态 */
  redPacket?: SimpleRoomRedPacket | null;
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
  SEND_RED_PACKET = "SEND_RED_PACKET",
  OPEN_RED_PACKET = "OPEN_RED_PACKET",
}
