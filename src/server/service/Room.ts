import { v4 as uuidv4 } from "uuid";
import "colors";
import { Token } from "./User";

import { roomMap, userMap } from ".";
import {
  parse,
  PlayerInfo,
  pokerTypeName,
  prettify,
  randomHands,
  rank,
  settle,
  bestOmahaHand,
} from "../utils/game-engine";
import { logGame } from "../tests/utils";
import { publish2all, publishLog2all, send2user, send2all } from "../api/ws";
import { Card } from "../../ApiType";

export type RoomID = string;
export enum GameRound {
  PreFlop = 0,
  Flop = 1,
  Turn = 2,
  River = 3,
}

function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}

type FnType = () => void;

function delayTry(fn: FnType, delay: number): ReturnType<typeof setTimeout> {
  return setTimeout(() => {
    try {
      fn();
    } catch (e) {
      console.log("delay try error", fn.toString());
    }
  }, delay);
}

export class Game {
  roomid: RoomID = "";
  smallBlind: number = 0;
  reBuyLimit: number = 1;
  bigBlindUser: Token = "";
  cards: Card[] = [];
  boardCards: Card[] = [];
  cardIndex: number = 0;
  round: GameRound = GameRound.PreFlop;
  sortedUsers: Token[] = [];
  actingUserTimer = setTimeout(() => { }, 0);
  isSettling: boolean = true;
  nextGameTime: number = 0;
  roundLeader: Token = ""; // the max bet
  raiseUser: string = "";
  raiseBet: number = 0; // bet of the raise
  raiseBetDiff: number = 0; //  valid rasize count
  settleAfterRound: boolean = false; // 结算后解散房间
  /** 是否短牌（仅 6～A，共 36 张，A6789 最小顺子） */
  isShortDeck: boolean = false;
  /** 是否奥马哈（4 张手牌，必须用 2 张手牌 + 3 张公牌组成 5 张） */
  isOmaha: boolean = false;

  multiSettleStart: boolean = false;
  multiSettleRound: GameRound = GameRound.PreFlop;
  multiSettleConfirm: boolean = false;
  multiSettleTimes: number = 1; // settle times
  multiSettleIndex: number = 0;
  multiSettleTimer = setTimeout(() => { }, 0);



  constructor(
    roomid: RoomID,
    token: Token,
    smallBlind: number,
    reBuyLimit: number,
    isShortDeck: boolean = false,
    isOmaha: boolean = false
  ) {
    this.roomid = roomid;
    this.bigBlindUser = token;
    this.smallBlind = smallBlind;
    this.reBuyLimit = reBuyLimit;
    this.isShortDeck = isShortDeck;
    this.isOmaha = isOmaha;
  }

  start() {
    if (!this.initUsers()) return;
    const deckSize = this.isShortDeck ? 36 : 52;
    this.cards = randomHands(deckSize, this.isShortDeck);
    this.cardIndex = 0;
    this.boardCards = [];
    this.isSettling = false;
    this.round = GameRound.PreFlop;
    this.roundLeader = "";
    this.raiseUser = "";

    this.multiSettleStart = false;
    this.multiSettleRound = GameRound.PreFlop;
    this.multiSettleConfirm = false;
    this.multiSettleTimes = 1;
    this.multiSettleIndex = 0;
    clearTimeout(this.multiSettleTimer);

    this.sortedUsers = this.sortUsersBySmallBlind();
    if (this.sortedUsers.length < 2) {
      console.log("not enough users");
      return;
    }
    console.log(new Array(10).fill("==").join(""));
    console.log("START:", this.sortedUsers);
    console.log(prettify(this.cards));
    publishLog2all(this.roomid, ["====游戏开始===="]);

    this.dealCards2User();
    this.doPreBet();
    publish2all(this.roomid);
    logGame(this);
  }
  nextGame() {
    if (!roomMap[this.roomid].isGaming) return;
    const tokens = roomMap[this.roomid].users;
    const currentBBIndex = tokens.findIndex((t) => t == this.bigBlindUser);
    for (let i = 0; i < tokens.length - 1; ++i) {
      const bbToken = tokens[(currentBBIndex + i + 1) % tokens.length];
      const user = userMap[bbToken];
      if (user.isReady && user.stack >= this.smallBlind * 2) {
        this.bigBlindUser = bbToken;
        this.start();
        // 新一局开始：清空看牌申请并通知所有客户端，避免过期弹窗残留
        const room = roomMap[this.roomid];
        room.pendingSeeHandRequests = [];
        send2all(this.roomid, { seeHandRequests: [] });
        return;
      }
    }
    // not enough users, pause game
    this.initUsers();
    console.log("cannot find big blind");
    this.isSettling = true;
    roomMap[this.roomid].pauseGameInteral();
  }
  initUsers() {
    roomMap[this.roomid].users.forEach((t) => {
      const user = userMap[t];
      user.isActing = false;
      user.isAllIn = false;
      user.isFolded = false;
      user.needAction = false;
      user.shouldShowHand = false;
      user.isInCurrentGame = false;
      user.isWinner = false;
      user.positon = "";
      user.bets = [0, 0, 0, 0];
      user.totalBets = 0;
      user.maxCards = [];
      user.profits = 0;
      user.settleTimes = 0;
      user.addTimeUsed = 0;
    });
    let balance = 0;
    roomMap[this.roomid].chipsRecords.forEach(cr => {
      balance += cr.buyIn - cr.chips;
    });
    console.log(`balance: ${balance}`);
    if (balance !== 0) {
      publishLog2all(this.roomid, [`<strong style="color: red;">⚠️注意，帐不平，差异${balance}。游戏无法继续，请核算，并将日志保留。</strong>`]);
      return false;
    }
    return true;
  }
  sortUsersBySmallBlind(): Token[] {
    let tokens = roomMap[this.roomid].users.filter(
      (t) =>
        !userMap[t].isOffline &&
        userMap[t].isReady &&
        userMap[t].stack >= this.smallBlind * 2
    );
    if (tokens.length < 2) {
      console.log(`only ${tokens} user left, pause game`);
      this.isSettling = true;
      roomMap[this.roomid].pauseGameInteral();
      return [];
    }
    const smallBlindIndex =
      (tokens.findIndex((t) => t === this.bigBlindUser) + (tokens.length - 1)) %
      tokens.length;
    return [
      ...tokens.slice(smallBlindIndex),
      ...tokens.slice(0, smallBlindIndex),
    ];
  }
  removeUser(token: Token) {
    this.sortedUsers = this.sortedUsers.filter((t) => t !== token);
  }
  doPreBet() {
    const sb = userMap[this.sortedUsers[0]];
    const bb = userMap[this.sortedUsers[1]];
    sb.bets[0] = sb.totalBets = roomMap[this.roomid].smallBlind;
    bb.bets[0] = bb.totalBets = roomMap[this.roomid].smallBlind * 2;
    if (bb.stack == bb.bets[0]) {
      bb.isAllIn = true;
    }
    sb.positon = "SB";
    bb.positon = "BB";
    this.raiseBet = bb.bets[0];
    this.raiseBetDiff = bb.bets[0]; // 1,2 -> 4. bet diff should >= bb.
    if (this.sortedUsers.length > 2) {
      userMap[this.sortedUsers[this.sortedUsers.length - 1]].positon = "D";
    }
    this.sortedUsers.forEach((t) => {
      userMap[t].needAction = true;
      userMap[t].isInCurrentGame = true;
    });
    this.nextActUser(bb.token);
  }
  maxPreBet() {
    return Math.max(
      ...this.sortedUsers.map((t) => userMap[t].bets[this.round])
    );
  }
  bet(token: Token, chips: number) {
    const user = userMap[token];
    if (!user.isActing) {
      console.error("BET: not action", user.name);
      throw "not your action now";
    }
    const preRoundBets = sum([...user.bets].slice(0, this.round));
    const availableStack = Math.floor(user.stack - preRoundBets);
    // console.log(`round ${this.round}:`, user.token, user.stack, availableStack);
    if (chips > availableStack) {
      console.error("BET:", user.name, chips, "not enough", userMap[token]);
      throw "not enough chips";
    }
    // 全下时强制按 availableStack 计算，确保加🌟为剩余欢乐豆的全部，避免剩一块
    if (chips >= availableStack - 1 && availableStack > 0) {
      chips = availableStack;
    }
    const preBets = this.maxPreBet();
    if (chips < preBets && chips < availableStack) {
      throw "chips should be large than the previous bet user";
    }
    // raise
    if (chips > preBets) {
      // all in
      if (chips < this.raiseBet + this.raiseBetDiff) {
        if (chips < availableStack) {
          throw "raise should greater than " + this.raiseBetDiff;
        }
      } else {
        // valid raise
        this.raiseUser = user.chipsRecordID;
        this.raiseBetDiff = chips - this.raiseBet;
        this.raiseBet = chips;
      }
      // user raise, other users need react
      this.sortedUsers
        .filter((t) => !userMap[t].isAllIn && !userMap[t].isFolded)
        .forEach((t) => t != token && (userMap[t].needAction = true));
      this.roundLeader = token;
    }
    // bet
    console.log(
      `USER ${chips == availableStack ? "AllIn" : chips == preBets ? "Call" : "NBet"
        }:`.green,
      user.name,
      prettify(user.hands),
      chips
    );

    let log = `${user.nickname || user.name} `;
    const delta = chips - user.bets[this.round];
    if (chips == availableStack) {
      log += `AllIn $${chips}`;
      user.actionName = "冲";
    } else {
      if (delta == 0) {
        log += `Check`;
        user.actionName = "跟";
      } else {
        if (chips > preBets) {
          if (preBets == 0) {
            log += `Bet $${chips}`;
            user.actionName = "下";
          } else {
            log += `Raise to $${chips}`;
            user.actionName = "加";
          }
        } else {
          log += `Call $${chips}`;
          user.actionName = "跟";
        }
      }
    }
    publishLog2all(this.roomid, [log]);

    user.bets[this.round] = chips;
    user.totalBets = sum(user.bets);
    this.setActed(token);

    if (chips == availableStack) {
      user.isAllIn = true;
    }
    this.nextActUser(token);
    return true;
  }
  fold(token: Token) {
    const user = userMap[token];
    if (!user.isActing) {
      console.error("FOLD: not action", user.name);
      throw "not your action now";
    }
    console.log(`USER Fold: ${user.name}`.green, prettify(user.hands));
    publishLog2all(this.roomid, [`${user.nickname || user.name} Fold`]);
    user.isFolded = true;
    user.actionName = "放弃";
    this.setActed(token);
    if (!this.decreaseActiveUserToSettle()) {
      this.nextActUser(token);
    }
  }
  decreaseActiveUserToSettle(): boolean {
    const tokens = this.sortedUsers.filter((t) => !userMap[t].isFolded);
    // only 1 user not fold
    if (tokens.length == 1) {
      delayTry(() => {
        this.settle();
      }, 2000);
      return true;
    }
    return false;
  }
  settle() {
    console.log("SETTLE NOW");
    logGame(this);

    const subTotal = (total: number) => {
      const chips = Math.floor(total / this.multiSettleTimes);
      if (this.multiSettleIndex < this.multiSettleTimes - 1) {
        return chips;
      } else {
        return total - (this.multiSettleTimes - 1) * chips;
      }
    };

    const availableUsers = this.sortedUsers
      .filter((t) => !userMap[t].isFolded)
      .map((t) => userMap[t]);

    const players: PlayerInfo[] = this.sortedUsers.map((t) => {
      const user = userMap[t];
      let cards: Card[];
      if (this.isOmaha && user.hands.length >= 4 && this.boardCards.length >= 3) {
        const best = bestOmahaHand(user.hands, this.boardCards, this.isShortDeck);
        cards = best.cards;
      } else {
        cards = [...user.hands, ...this.boardCards];
      }
      return {
        id: user.token,
        total: subTotal(user.totalBets),
        profits: 0,
        fold: user.isFolded,
        cards,
      };
    });

    // console.log(JSON.stringify(players, null, 2));
    const ps = settle(players, 1, this.isShortDeck);

    // just log
    ps.forEach((p) => {
      const user = userMap[p.id];
      const total = subTotal(user.totalBets);
      console.log(
        `${user.name} ${prettify(user.hands)} Stage: ${p.stage} Max: ${prettify(
          p.maxCards!
        )}  total: ${total} ${p.fold ? "Fold" : "Alive"} Profits: ${p.profits
        } Stack:${user.stack} => ${user.stack + p.profits! - total}`
      );
    });
    // end log

    const crs = roomMap[this.roomid].chipsRecords;
    const logs: string[] = [];

    const leaderIndex = this.sortedUsers.findIndex(
      (t) => t === this.roundLeader
    );
    const actionOrder = [
      ...this.sortedUsers.slice(leaderIndex),
      ...this.sortedUsers.slice(0, leaderIndex),
    ];
    const winnerMap: { [x: string]: boolean } = {};
    ps.forEach((p) => {
      if (p.isWinner) {
        winnerMap[p.id] = true;
      }
    });
    let lastWinnerIndex = 0;
    actionOrder.forEach((t, i) => {
      if (winnerMap[t]) {
        lastWinnerIndex = i;
      }
    });

    ps.forEach((p) => {
      const user = userMap[p.id];
      const profits = p.profits! - subTotal(user.totalBets);
      user.bets = [0, 0, 0, 0];
      user.stack += profits;
      user.profits = profits;
      user.isWinner = p.isWinner || false;
      user.maxCards = p.maxCards || [];
      user.actionName = "";
      const index = actionOrder.findIndex((t) => t === p.id);
      user.shouldShowHand =
        this.round === GameRound.River &&
        availableUsers.length > 1 &&
        (!user.isFolded || user.isAllIn);

      let profitText = "";
      if (profits !== 0) {
        profitText = `${profits >= 0 ? "win💰" : "lose"} ${profits}`;
      }
      logs.push(
        `${user.nickname || user.name} ${user.shouldShowHand
          ? `【${user.hands
            .map((c) => `${c.num}${c.suit}`)
            .join("")}】${p.maxCards
              ?.map((c) => `${c.num}${c.suit}`)
              .join("")} ${user.handsType} `
          : ""
        }${profitText}`
      );
      if (user.stack < this.smallBlind * 2) {
        user.isReady = false;
      }
      crs.find((cr) => cr.id === user.chipsRecordID)!.chips = user.stack;
    });

    publishLog2all(this.roomid, logs);

    // just log
    this.sortedUsers.forEach((t) => {
      const user = userMap[t];
      console.log(`${user.token}, Stack: ${user.stack}`);
    });
    // end log

    if (++this.multiSettleIndex < this.multiSettleTimes) {
      publishLog2all(this.roomid, [`第${this.multiSettleIndex + 1}轮`]);
      // new one
      this.round = this.multiSettleRound;
      switch (this.round) {
        case GameRound.PreFlop:
          this.boardCards = [];
          break;
        case GameRound.Flop:
          this.boardCards = this.boardCards.slice(0, 3);
          break;
        case GameRound.Turn:
          this.boardCards = this.boardCards.slice(0, 4);
          break;
      }

      publish2all(this.roomid);
      delayTry(() => {
        this.nextRound();
      }, 3000);
      return;
    }

    this.isSettling = true;

    const room = roomMap[this.roomid];
    const hasPendingSeeHand = room.pendingSeeHandRequests && room.pendingSeeHandRequests.length > 0;
    const showdownCount = this.sortedUsers.filter((t) => userMap[t].shouldShowHand).length;
    // 前端分阶段展示：每玩家 2*2.5s（两张+五张）+ 胜者阶段 3.5s；胜者动画播完后倒计时再开下一局
    const settleAnimationMs = Math.ceil(showdownCount * 5000 + 3500);
    // 展示胜者后固定 3 秒；有人申请看牌时 8 秒（比原来各减 5 秒）
    const countdownAfterWinnerMs = hasPendingSeeHand ? 8000 : 3000;
    const delay = settleAnimationMs + countdownAfterWinnerMs;
    this.nextGameTime = Date.now() + delay;
    publish2all(this.roomid);
    
    if (this.settleAfterRound) {
      // 结算后解散房间
      delayTry(() => {
        // 导入settleAndDissolveRoom函数
        const { settleAndDissolveRoom } = require(".");
        settleAndDissolveRoom(this.roomid);
      }, delay);
    } else {
      delayTry(() => {
        this.nextGame();
      }, delay);
    }
  }


  dealCards2User() {
    const holeCount = this.isOmaha ? 4 : 2;
    this.sortedUsers.forEach((t) => {
      const user = userMap[t];
      if (user.isReady) {
        user.hands = parse(
          this.cards.slice(this.cardIndex, this.cardIndex + holeCount),
          false
        );
        this.cardIndex += holeCount;
        user.isFolded = false;
      }
    });
    this.calcUserRank();
  }
  nextActUser(current: Token): void {
    const currentIndex = this.sortedUsers.findIndex((t) => t == current);
    for (let i = 0; i < this.sortedUsers.length - 1; ++i) {
      let t =
        this.sortedUsers[(currentIndex + 1 + i) % this.sortedUsers.length];
      const user = userMap[t];
      if (!user.isFolded && !user.isAllIn && user.needAction) {
        this.setActingUser(t);
        return;
      }
    }
    delayTry(() => {
      this.nextRound();
    }, 1000);
  }
  nextRound(): void {
    if (this.round === GameRound.River) {
      console.log("already river turn, goto settle");
      this.settle();
      return;
    }

    const activeUsers = this.sortedUsers.filter(
      (t) => !userMap[t].isFolded && !userMap[t].isAllIn
    );

    console.log("nextRound", activeUsers);

    // only one or zero user need act
    if (activeUsers.length <= 1) {
      // avaiable user show all show hand
      this.sortedUsers.forEach((t) => {
        const user = userMap[t];
        if (user.isInCurrentGame && !user.isFolded) {
          user.shouldShowHand = true;
        }
      });

      const settleUsers = this.sortedUsers.filter((t) => {
        const user = userMap[t];
        return (
          !user.isFolded && user.isInCurrentGame && user.bets[this.round] > 0
        );
      });

      console.log("multi settle users:", settleUsers);

      // decide
      if (!this.multiSettleStart) {
        // multiple settle users
        publish2all(this.roomid);

        settleUsers.forEach((t) => {
          send2user(t, {
            selectSettleTimes: 1,
          });
        });

        this.multiSettleTimer = delayTry(() => {
          settleUsers.forEach((t) => {
            this.userSetSettleTimes(t, 4);
            send2user(t, {
              selectSettleTimes: 0,
            });
          });
        }, 30000);

        const log =
          "玩家" +
          settleUsers.map((t) => userMap[t].nickname || userMap[t].name).join(", ") +
          "决定发牌次数";
        publishLog2all(this.roomid, [log]);

        this.multiSettleStart = true;
        this.multiSettleRound = this.round;
        this.multiSettleIndex = 0;
        return;
      } else if (!this.multiSettleConfirm) {
        // check all settle users selected
        let settleTimes = Number.MAX_VALUE;
        settleUsers.forEach(
          (t) => (settleTimes = Math.min(settleTimes, userMap[t].settleTimes))
        );
        console.log("times", settleTimes);
        if (settleTimes === 0) {
          // wait for other user
          return;
        } else {
          this.multiSettleTimes = settleTimes;
          this.multiSettleConfirm = true;
          publishLog2all(this.roomid, [`发${settleTimes}次`]);
        }
      }
    }

    this.round += 1;
    this.roundLeader = "";
    this.sortedUsers.forEach((t) => (userMap[t].actionName = ""));
    this.raiseUser = "";
    this.raiseBet = 0;
    this.raiseBetDiff = this.smallBlind * 2;
    const r = this.round;
    const roundName =
      r === GameRound.PreFlop
        ? "PreFlop"
        : r === GameRound.Flop
          ? "Flop"
          : r === GameRound.Turn
            ? "Turn"
            : r === GameRound.River
              ? "River"
              : "Invalid";

    let log = `${roundName}: `;
    // deal cards
    this.cardIndex += 1; // skip one
    if (this.round === GameRound.Flop) {
      for (let i = 0; i < 3; ++i) {
        const card = this.cards[this.cardIndex];
        this.boardCards.push(card);
        console.log("deal card", prettify([card]));
        log += `${card.num}${card.suit}`;
        this.cardIndex += 1;
      }
    } else {
      const card = this.cards[this.cardIndex];
      this.boardCards.push(card);
      console.log("deal card", prettify([card]));
      this.cardIndex += 1;
      log += `${card.num}${card.suit}`;
    }

    this.calcUserRank();

    publishLog2all(this.roomid, [log]);

    if (activeUsers.length <= 1) {
      delayTry(() => {
        this.nextRound();
      }, 1000);
    } else {
      activeUsers.forEach((t) => (userMap[t].needAction = true));
      const token = activeUsers[0];
      this.roundLeader = token;
      this.setActingUser(token);
    }
    publish2all(this.roomid);
  }
  setActingUser(token: Token, delay = 30000) {
    const user = userMap[token];
    user.isActing = true;
    const now = Date.now();
    user.actionStartTime = now;
    user.actionEndTime = now + delay; // 30 s
    console.log("setActingUser", user.name);
    clearTimeout(this.actingUserTimer);
    this.actingUserTimer = delayTry(() => {
      this.fold(token); // auto fold
      publish2all(this.roomid);
    }, delay);
  }
  /** 当前行动玩家使用 +30s，每手牌最多 3 次 */
  extendActionTime(token: Token): boolean {
    const user = userMap[token];
    if (!user.isActing) return false;
    if (user.addTimeUsed >= 3) return false;
    user.addTimeUsed += 1;
    const extra = 30000;
    user.actionEndTime += extra;
    const remaining = user.actionEndTime - Date.now();
    if (remaining <= 0) return true;
    clearTimeout(this.actingUserTimer);
    this.actingUserTimer = delayTry(() => {
      this.fold(token);
      publish2all(this.roomid);
    }, remaining);
    return true;
  }
  userSetSettleTimes(token: Token, times: number) {
    if (!this.multiSettleStart || userMap[token].settleTimes > 0 || times < 1) {
      return;
    }
    userMap[token].settleTimes = times;
    this.nextRound();
  }
  buyOverTimeCard(token: Token) {
    const pots = sum(this.sortedUsers.map((t) => sum(userMap[t].bets)));
    const user = userMap[token];
    const preRoundBets = sum([...user.bets].slice(0, this.round));
    const availableStack = user.stack - preRoundBets;
    const count = this.sortedUsers.length;
    if (availableStack <= count) {
      return;
    }
    const cost = Math.ceil(
      Math.min(
        this.smallBlind * 2,
        Math.max(1, pots / 4 / count),
        availableStack / count
      )
    );
    this.sortedUsers.forEach((t) => (userMap[t].stack += cost));
    user.stack -= count * cost;
    publish2all(this.roomid);
  }
  setActed(token: Token) {
    userMap[token].isActing = false;
    userMap[token].needAction = false;
    clearTimeout(this.actingUserTimer);
  }
  calcUserRank() {
    this.sortedUsers.forEach((t) => {
      const user = userMap[t];
      if (this.isOmaha && user.hands.length >= 4 && this.boardCards.length >= 3) {
        const best = bestOmahaHand(user.hands, this.boardCards, this.isShortDeck);
        user.handsType = pokerTypeName(best.type);
      } else {
        const cards = [...user.hands, ...this.boardCards];
        const cardsRank = rank(cards, this.isShortDeck);
        user.handsType = pokerTypeName(cardsRank.type);
      }
    });
  }
}

type ChipsRecord = {
  id: string; // random and unique
  token: Token; // user
  name: string;
  nickname: string; // user nickname
  chips: number; // total chips
  buyIn: number; // total buy in
};

class Room {
  id: RoomID = ""; // string
  users: Token[] = [];
  isGaming: boolean = false;
  smallBlind: number = 0;
  buyIn: number = 0;
  reBuyLimit: number = 1;
  /** 是否短牌（仅 6～A 共 36 张） */
  isShortDeck: boolean = false;
  /** 是否奥马哈（4 张手牌，必须 2+3 组成 5 张） */
  isOmaha: boolean = false;
  game: Game = new Game("", "", 0, 1, false, false);
  chipsRecords: ChipsRecord[] = [];
  /** 结算阶段：多人可同时请求看同一人的手牌，等待被请求者逐条同意/拒绝 */
  pendingSeeHandRequests: {
    requestId: string;
    requesterToken: Token;
    targetToken: Token;
    chips: number;
  }[] = [];

  constructor(
    id: string,
    sb: number,
    buyIn: number,
    reBuyLimit: number = 1,
    isShortDeck: boolean = false,
    isOmaha: boolean = false
  ) {
    if (sb === 0 || buyIn === 0) {
      throw `small blind(${sb}) and buy in(${buyIn})] should not be 0`;
    }
    // new room
    this.id = id;
    this.smallBlind = sb;
    this.buyIn = buyIn;
    this.reBuyLimit = Math.max(1, reBuyLimit);
    this.isShortDeck = !!isShortDeck;
    this.isOmaha = !!isOmaha;
    if (this.isShortDeck && this.isOmaha) {
      throw new Error("短牌与奥马哈不能同时开启");
    }
    this.isGaming = false;
  }

  startGame(token: Token) {
    const isOwner = this.users.some(
      (t) => userMap[t].isRoomOwner && t == token
    );
    if (!isOwner) {
      throw "not room owner";
    }
    const readyUsers = this.users.filter((t) => userMap[t].isReady);
    if (readyUsers.length < 2) {
      throw "至少需要两名玩家准备";
    }
    this.isGaming = true;
    this.pendingSeeHandRequests = [];
    send2all(this.id, { seeHandRequests: [] });

    // already in game
    if (this.game && !this.game.isSettling) {
      return true;
    }

    this.game = new Game(
      this.id,
      readyUsers.sort((_) => Math.random() - 0.5)[0],
      this.smallBlind,
      this.reBuyLimit,
      this.isShortDeck,
      this.isOmaha
    );
    this.game.start();
    return true;
  }

  pauseGame(token: Token) {
    const isOwner = this.users.some(
      (t) => userMap[t].isRoomOwner && t == token
    );
    if (!isOwner) {
      throw "not room owner";
    }
    console.log("owner pause game");
    this.pauseGameInteral();
  }

  pauseGameInteral() {
    this.isGaming = false;
    console.log("GAME PAUSE");
    publish2all(this.id);
  }

  addUser(token: Token): boolean {
    if (this.users.findIndex((t) => t == token) == -1) {
      this.users.push(token);

      // 检查是否已有相同用户名的记录（积分榜中的记录）
      const existingRecord = this.chipsRecords.find(cr => cr.name === userMap[token].name);
      
      if (existingRecord) {
        // 继承已有记录并更新token
        userMap[token].chipsRecordID = existingRecord.id;
        userMap[token].stack = existingRecord.chips;
        // 更新现有记录的token和nickname为新值
        existingRecord.token = token;
        existingRecord.nickname = userMap[token].nickname || userMap[token].name;
        console.log(`User ${userMap[token].name} joined with existing chips from leaderboard: ${existingRecord.chips}`);
      } else {
        // 创建新记录
        const id = uuidv4();
        userMap[token].chipsRecordID = id;
        userMap[token].stack = this.buyIn;

        const chipsRecord = {
          id,
          token,
          name: userMap[token].name,
          nickname: userMap[token].nickname || userMap[token].name,
          chips: this.buyIn,
          buyIn: this.buyIn,
        };
        this.chipsRecords.push(chipsRecord);
        console.log(`User ${userMap[token].name} joined with initial chips: ${this.buyIn}`);
      }
      return true;
    }
    return false;
  }

  removeUser(token: Token) {
    this.users = this.users.filter((t) => t != token);
    if (userMap[token].isRoomOwner) {
      // trans owner to next user, user should be ready
      userMap[token].isRoomOwner = false;
      const index = this.users.findIndex((t) => userMap[t].isInRoom);
      if (index == -1) {
        // none user inRoom, remove game
        delete roomMap[this.id];
        this.users.forEach((t) => userMap[t].leaveRoom());
        this.users = [];
      } else {
        userMap[this.users[index]].isRoomOwner = true;
      }
    }
    this.game.removeUser(token);
    userMap[token].leaveRoom();
  }

  reBuy(token: Token) {
    const user = userMap[token];
    // console.log("rebuy", user);
    if (user.stack > this.reBuyLimit * this.smallBlind * 2) {
      throw "cannot rebuy now";
    }
    user.stack += this.buyIn;
    this.chipsRecords.forEach((cr) => {
      if (cr.id == user.chipsRecordID) {
        cr.buyIn += this.buyIn;
        cr.chips += this.buyIn;
      }
    });
    // 重新初始后自动设置为准备状态
    user.isReady = true;
  }
}

export default Room;
