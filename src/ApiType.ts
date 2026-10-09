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
export const MAX_ROOM_PLAYERS = 9;
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
  displayBoardCards: (Card | null)[];
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
  /** 本轮已使用 +45s 次数（0～3） */
  addTimeUsed?: number;
}

export interface SimpleRoomSupportConfig {
  enabled: boolean;
  minPot: number;
  maxPercent: number;
}

export interface SimpleRoom {
  roomid: RoomID;
  smallBlind: number;
  buyIn: number;
  reBuyLimit: number;
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
  /** 支持功能配置 */
  supportConfig?: SimpleRoomSupportConfig;
  /** 加时费用（每次 +45s 需要支付的欢乐豆） */
  overtimeCost: number;
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
  /** 桌上欢乐豆（封顶 1000） */
  chips: number;
  buyIn: number;
}

export interface SimpleRoomChipsRecords {
  roomid: string;
  chipsRecords: SimpleChipsRecord[];
}

export interface OwnerPlayerState {
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
  actionStartTime?: number;
  actionName: string;
  hands: Card[];
  maxCards: Card[];
  profits: number;
  position: string;
  shouldShowHand: boolean;
  stack: number;
  bet: number;
  addTimeUsed?: number;
}

export interface OwnerRoomState {
  roomid: RoomID;
  buyIn: number;
  reBuyLimit: number;
  smallBlind: number;
  isGaming: boolean;
  isShortDeck?: boolean;
  isOmaha?: boolean;
  gameRound: number;
  nextGameTime: number;
  pots: number;
  acting: string;
  preBet: number;
  bb: number;
  raiseUser: string;
  raiseBet: number;
  raiseBetDiff: number;
  userCount: number;
  boardCards: Card[];
  futureBoardCards: Card[];
  users: OwnerPlayerState[];
}

export interface OwnerSnapshot {
  serverTime: number;
  rooms: OwnerRoomState[];
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
  REPAY = "REPAY",
  LEAVE = "LEAVE",
  SHOW_HANDS = "SHOW_HANDS",
  REVEAL_BOARD_CARD = "REVEAL_BOARD_CARD",
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
  REQUEST_SUPPORT = "REQUEST_SUPPORT",
  RESPOND_SUPPORT = "RESPOND_SUPPORT",
  SET_SHORT_DECK = "SET_SHORT_DECK",
  TRANSFER_ROOM_OWNER = "TRANSFER_ROOM_OWNER",
  REPAIR_ROOM_BALANCE = "REPAIR_ROOM_BALANCE",
}
