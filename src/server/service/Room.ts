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
import {
  applyTableStackToRecord,
  applyTotalDelta,
  getTotalChips,
  normalizeChipsRecord,
} from "./chips";

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
  reBuyLimit: number = 500;
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
  /** all-in 自动补牌流程中，是否已先亮过在场玩家手牌 */
  allInRunoutHandsRevealed: boolean = false;
  /** 结算倒计时阶段：已手动翻开的未发公共牌（按 0~4 的公共牌位置记录） */
  revealedFutureBoardCards: (Card | null)[] = new Array(5).fill(null);
  /** 允许查看未翻公牌的起始时间（ms） */
  settleBoardRevealAvailableAt: number = 0;



  constructor(
    roomid: RoomID,
    token: Token,
    smallBlind: number,
    reBuyLimit: number = 500,
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
    roomMap[this.roomid].supportPhaseDoneThisHand = false;
    roomMap[this.roomid].supportPhaseContext = "beforeSettle";
    if (!this.initUsers()) return;
    const deckSize = this.isShortDeck ? 36 : 52;
    this.cards = randomHands(deckSize, this.isShortDeck);
    this.cardIndex = 0;
    this.boardCards = [];
    this.isSettling = false;
    this.nextGameTime = 0;
    this.settleBoardRevealAvailableAt = 0;
    this.round = GameRound.PreFlop;
    this.roundLeader = "";
    this.raiseUser = "";

    this.multiSettleStart = false;
    this.multiSettleRound = GameRound.PreFlop;
    this.multiSettleConfirm = false;
    this.multiSettleTimes = 1;
    this.multiSettleIndex = 0;
    this.allInRunoutHandsRevealed = false;
    this.revealedFutureBoardCards = new Array(5).fill(null);
    this.settleBoardRevealAvailableAt = 0;
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
    roomMap[this.roomid].autoFallbackToLongDeckIfNeeded();
    // 配置切换在下一局生效：这里在新一局开始前同步房间配置。
    this.isShortDeck = !!roomMap[this.roomid].isShortDeck;
    this.isOmaha = !!roomMap[this.roomid].isOmaha;
    if (this.nextGameTime && Date.now() < this.nextGameTime - 50) {
      throw "下一局倒计时未结束，不能发牌";
    }
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
      user.revealedHandsMask = [];
      user.settleTimes = 0;
      user.addTimeUsed = 0;
      user.overtimeFeePaid = 0;
    });
    let balance = 0;
    roomMap[this.roomid].chipsRecords.forEach(cr => {
      normalizeChipsRecord(cr);
      balance += cr.buyIn - getTotalChips(cr);
    });
      console.log(`balance: ${balance}`);
    if (balance !== 0) {
      roomMap[this.roomid].chipsRecords.forEach((cr) => {
        console.warn(
          `[balance-check] room=${this.roomid} record=${cr.id} name=${cr.nickname || cr.name
          } buyIn=${cr.buyIn} chips=${cr.chips} total=${getTotalChips(cr)}`
        );
      });
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
    const availableStack = Math.floor(user.stack - preRoundBets - (user.overtimeFeePaid || 0));
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

    const delta = chips - user.bets[this.round];
    this.recordHandAction(token, chips == availableStack ? "allin" : chips == preBets ? (delta === 0 ? "check" : "call") : chips > preBets ? (preBets == 0 ? "bet" : "raise") : "call", chips, delta, preBets);

    let log = `${user.nickname || user.name} `;
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
    this.recordHandAction(token, "fold", user.bets[this.round], 0, this.maxPreBet());
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
        total: subTotal(user.totalBets + (user.overtimeFeePaid || 0)),
        profits: 0,
        fold: user.isFolded,
        cards,
      };
    });

    // console.log(JSON.stringify(players, null, 2));
    const ps = settle(players, 1, this.isShortDeck);

    // 每个玩家本局从底池中实际赢到的筹码总额（不扣除自己下注）
    const potWinMap: { [id: string]: number } = {};
    ps.forEach((p) => {
      potWinMap[p.id] = p.profits || 0;
    });

    // just log
    ps.forEach((p) => {
      const user = userMap[p.id];
      const total = subTotal(user.totalBets + (user.overtimeFeePaid || 0));
      console.log(
        `${user.name} ${prettify(user.hands)} Stage: ${p.stage} Max: ${prettify(
          p.maxCards!
        )}  total: ${total} ${p.fold ? "Fold" : "Alive"} Profits: ${p.profits
        } Stack:${user.stack} => ${user.stack + p.profits! - total}`
      );
    });
    // end log

    const roomForSupport = roomMap[this.roomid];
    const crs = roomForSupport.chipsRecords;
    const settlementRows = ps.map((p) => {
      const user = userMap[p.id];
      const totalWithFees = user.totalBets + (user.overtimeFeePaid || 0);
      return {
        token: p.id,
        shouldShowHand:
          this.round === GameRound.River &&
          availableUsers.length > 1 &&
          (!user.isFolded || user.isAllIn),
        maxCards: p.maxCards || [],
        isWinner: !!p.isWinner,
        profitDelta: (p.profits || 0) - subTotal(totalWithFees),
      };
    });

    // 先下发亮牌所需信息；筹码/积分延后到 winner 阶段再更新，避免过早“剧透”。
    settlementRows.forEach((row) => {
      const user = userMap[row.token];
      user.shouldShowHand = row.shouldShowHand;
      user.maxCards = row.maxCards;
      user.isWinner = row.isWinner;
    });

    let settlementApplied = false;
    const applySettlement = () => {
      if (settlementApplied) return;
      settlementApplied = true;

      const logs: string[] = [];
      const baseProfitByToken: { [token: string]: number } = {};
      const supportNetByToken: { [token: string]: number } = {};
      const targetSupportReceived: { [token: string]: number } = {};
      const targetSupportReturned: { [token: string]: number } = {};
      const supporterSupportInvested: { [token: string]: number } = {};
      const supporterSupportReturned: { [token: string]: number } = {};
      settlementRows.forEach((row) => {
        const user = userMap[row.token];
        baseProfitByToken[row.token] = row.profitDelta;
        supportNetByToken[row.token] = 0;
        targetSupportReceived[row.token] = 0;
        targetSupportReturned[row.token] = 0;
        supporterSupportInvested[row.token] = 0;
        supporterSupportReturned[row.token] = 0;
        user.bets = [0, 0, 0, 0];
        user.stack += row.profitDelta;
        user.actionName = "";
        user.overtimeFeePaid = 0;
        if (user.stack < this.smallBlind * 2) {
          user.isReady = false;
        }
      });

      // 处理支持盈利分成：返还公式 = floor(本局赢得筹码数 * 支持金额 / 目标本局总下注)
      // 当目标盈利时，返还值天然包含支持本金 + 按占比分成。
      if (roomForSupport.supportRecords.length > 0) {
        const supportLogs: string[] = [];

        roomForSupport.supportRecords.forEach((record) => {
          const targetUser = userMap[record.targetToken];
          const supporterUser = userMap[record.supporterToken];
          if (!targetUser || !supporterUser) return;
          if (supportNetByToken[targetUser.token] === undefined) {
            supportNetByToken[targetUser.token] = 0;
          }
          if (supportNetByToken[supporterUser.token] === undefined) {
            supportNetByToken[supporterUser.token] = 0;
          }

          const potWin = potWinMap[record.targetToken] || 0; // 本局赢得筹码数（含自己的下注）
          // 支持阶段已实时转移筹码：支持者 -amount，被支持者 +amount。
          supportNetByToken[targetUser.token] += record.amount;
          supportNetByToken[supporterUser.token] -= record.amount;
          targetSupportReceived[targetUser.token] =
            (targetSupportReceived[targetUser.token] || 0) + record.amount;
          supporterSupportInvested[supporterUser.token] =
            (supporterSupportInvested[supporterUser.token] || 0) + record.amount;

          if (!targetUser.isWinner || potWin <= 0) {
            return;
          }

          const denominator = Math.max(1, record.targetTotalBet);
          const grossReturn = Math.floor((potWin * record.amount) / denominator);
          const payout = Math.max(0, Math.min(grossReturn, targetUser.stack));
          if (payout <= 0) {
            return;
          }

          // 从目标扣除返还额（本金+分成），返给支持者
          targetUser.stack -= payout;
          supporterUser.stack += payout;
          supportNetByToken[targetUser.token] -= payout;
          supportNetByToken[supporterUser.token] += payout;
          targetSupportReturned[targetUser.token] =
            (targetSupportReturned[targetUser.token] || 0) + payout;
          supporterSupportReturned[supporterUser.token] =
            (supporterSupportReturned[supporterUser.token] || 0) + payout;

          const principal = Math.min(record.amount, payout);
          const share = Math.max(0, payout - principal);
          supportLogs.push(
            `${supporterUser.nickname || supporterUser.name} 支持 ${targetUser.nickname || targetUser.name} 返还 ${payout} 🌟（本金${principal} + 分成${share}）`
          );
        });

        if (supportLogs.length > 0) {
          publishLog2all(this.roomid, ["🤝 支持分成:", ...supportLogs]);
        }

        // 清空支持记录，避免重复处理
        roomForSupport.supportRecords = [];
      }

      settlementRows.forEach((row) => {
        const user = userMap[row.token];
        const base = baseProfitByToken[row.token] || 0;
        const supportNet = supportNetByToken[row.token] || 0;
        const total = base + supportNet;
        user.profits = total;

        const received = targetSupportReceived[row.token] || 0;
        const returned = targetSupportReturned[row.token] || 0;
        const invested = supporterSupportInvested[row.token] || 0;
        const supporterReturned = supporterSupportReturned[row.token] || 0;
        const supportInvolved =
          received > 0 || returned > 0 || invested > 0 || supporterReturned > 0;
        let profitText = `${total >= 0 ? "win💰" : "lose"} ${total}`;
        if (supportInvolved) {
          // 标准化支持字段，便于前端做结构化 UI 渲染（卡片+指标），避免纯文字堆叠。
          profitText += ` | 支持{base=${base},net=${supportNet},recv=${received},pay=${returned},inv=${invested},back=${supporterReturned},total=${total}}`;
        }
        logs.push(
          `${user.nickname || user.name} ${user.shouldShowHand
            ? `【${user.hands
              .map((c) => `${c.num}${c.suit}`)
              .join("")}】${row.maxCards
                ?.map((c) => `${c.num}${c.suit}`)
                .join("")} ${user.handsType} `
            : ""
          }${profitText}`
        );
      });

      // 所有结算逻辑（含支持分成）完成后，再统一同步积分榜。
      // 不能依赖 this.sortedUsers：结算动画期间玩家可离开房间，sortedUsers 会被移除，
      // 但本手牌的结算结果仍必须落到 chipsRecords，否则会触发“账不平”。
      settlementRows.forEach((row) => {
        const u = userMap[row.token];
        if (!u) {
          console.warn(`[settle] user not found while syncing record, token=${row.token}`);
          return;
        }
        const cr = crs.find((item) => item.id === u.chipsRecordID);
        if (!cr) {
          console.warn(
            `[settle] chips record missing while syncing, token=${row.token}, recordId=${u.chipsRecordID}`
          );
          return;
        }
        applyTableStackToRecord(cr, u.stack);
        u.stack = cr.chips;
      });

      publishLog2all(this.roomid, logs);

      // just log
      this.sortedUsers.forEach((t) => {
        const user = userMap[t];
        console.log(`${user.token}, Stack: ${user.stack}`);
      });
      // end log
      publish2all(this.roomid);

    };

    if (++this.multiSettleIndex < this.multiSettleTimes) {
      applySettlement();
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

    const roomForSettle = roomMap[this.roomid];
    const hasPendingSeeHand = roomForSettle.pendingSeeHandRequests && roomForSettle.pendingSeeHandRequests.length > 0;
    const showdownCount = this.sortedUsers.filter((t) => userMap[t].shouldShowHand).length;
    const chipApplyDelayMs = showdownCount > 0 ? Math.ceil(showdownCount * 5000) : 0;
    // 前端分阶段展示：每玩家 2*2.5s（两张+五张）+ 胜者阶段 3.5s；胜者动画播完后倒计时再开下一局
    const settleAnimationMs = Math.ceil(showdownCount * 5000 + 3500);
    // 展示胜者后固定 7 秒；有人申请看牌时 12 秒
    const countdownAfterWinnerMs = hasPendingSeeHand ? 12000 : 7000;
    const delay = settleAnimationMs + countdownAfterWinnerMs;
    this.nextGameTime = Date.now() + delay;
    this.settleBoardRevealAvailableAt =
      showdownCount > 0 ? Date.now() + settleAnimationMs : Date.now();
    publish2all(this.roomid);

    if (chipApplyDelayMs > 0) {
      delayTry(() => {
        applySettlement();
      }, chipApplyDelayMs);
    } else {
      applySettlement();
    }
    
    if (this.settleAfterRound) {
      // 结算后解散房间
      delayTry(() => {
        // 导入settleAndDissolveRoom函数
        const { settleAndDissolveRoom } = require(".");
        settleAndDissolveRoom(this.roomid);
      }, delay);
    }
  }

  /**
   * 进入支持阶段或直接进入结算
   * 检查条件：
   * 1. 支持功能是否开启
   * 2. 总奖池是否大于阈值
   * 3. 是否有弃牌玩家可以参与
   * 4. 是否有未弃牌玩家可以被支持
   */
  enterSupportPhaseOrSettle(): void {
    if (this.tryStartSupportPhase("beforeSettle")) {
      return;
    }
    this.settle();
  }

  private tryStartSupportPhase(
    phaseContext: "beforeRunout" | "beforeSettle"
  ): boolean {
    const room = roomMap[this.roomid];
    if (!room.supportEnabled || room.isSupportPhase || room.supportPhaseDoneThisHand) {
      return false;
    }

    // 计算总奖池
    const totalPot = this.sortedUsers.reduce(
      (sum, t) => sum + userMap[t].bets.reduce((a, b) => a + b, 0),
      0
    );

    // 检查奖池是否达到阈值
    if (totalPot < room.supportMinPot) {
      return false;
    }

    // 找出所有弃牌且有余额的玩家（可以支持别人）
    const potentialSupporters = this.sortedUsers.filter(
      (t) =>
        userMap[t].isFolded &&
        userMap[t].isInCurrentGame &&
        userMap[t].stack > 0
    );

    // 找出所有未弃牌且参与游戏的玩家（可以被支持）
    const supportableTargets = this.sortedUsers.filter(
      (t) =>
        !userMap[t].isFolded &&
        userMap[t].isInCurrentGame &&
        userMap[t].bets.reduce((a, b) => a + b, 0) > 0
    );

    // 没有支持者或没有目标，直接结算
    if (potentialSupporters.length === 0 || supportableTargets.length === 0) {
      return false;
    }

    // 进入支持阶段
    room.isSupportPhase = true;
    room.supportPhaseContext = phaseContext;
    room.supportPhaseDoneThisHand = true;
    room.pendingSupportRequests = [];
    room.supportRecords = [];

    // 计算每个目标的信息
    const targetInfo = supportableTargets.map((t) => {
      const user = userMap[t];
      const totalBet = user.bets.reduce((a, b) => a + b, 0);
      const maxSupport = Math.floor(totalBet * room.supportMaxPercent / 100);
      return {
        token: t,
        id: user.chipsRecordID,
        name: user.nickname || user.name,
        totalBet,
        maxSupport: Math.max(1, maxSupport),
      };
    });

    // 通知所有潜在支持者进入支持阶段
    potentialSupporters.forEach((t) => {
      const supporter = userMap[t];
      send2user(t, {
        type: "supportPhase",
        time: 15,
        targets: targetInfo.filter((ti) => ti.maxSupport > 0),
        myStack: supporter.stack,
      });
    });

    // 15秒后结束支持阶段，进入结算
    room.supportPhaseTimer = delayTry(() => {
      this.endSupportPhase();
    }, 15000);

    // 广播支持阶段开始（给所有人，包括非弃牌玩家）
    send2all(this.roomid, {
      type: "supportPhaseStarted",
      duration: 15,
      supportersCount: potentialSupporters.length,
      targetsCount: supportableTargets.length,
    });
    return true;
  }

  /**
   * 结束支持阶段，处理所有已接受的请求，进入结算
   */
  endSupportPhase(): void {
    const room = roomMap[this.roomid];
    if (!room.isSupportPhase) return;
    const supportSummaryDurationMs = 3000;

    // 清理定时器
    clearTimeout(room.supportPhaseTimer);

    // 自动拒绝所有未处理的请求
    room.pendingSupportRequests.forEach((req) => {
      const targetUser = userMap[req.targetToken];
      send2user(req.supporterToken, {
        type: "supportRejected",
        targetId: targetUser.chipsRecordID,
        targetName: targetUser.nickname || targetUser.name,
        requestId: req.requestId,
        reason: "超时未响应",
      });
    });

    room.pendingSupportRequests = [];
    // 清空所有客户端上的待处理支持请求弹窗
    send2all(this.roomid, { supportRequests: [] });
    room.isSupportPhase = false;

    // 广播支持阶段结束
    send2all(this.roomid, {
      type: "supportPhaseEnded",
      acceptedCount: room.supportRecords.length,
    });

    const totalPot = this.sortedUsers.reduce(
      (sum, t) => sum + userMap[t].bets.reduce((a, b) => a + b, 0),
      0
    );
    const summaryMap: {
      [targetToken: string]: {
        targetId: string;
        targetName: string;
        targetTotalBet: number;
        totalSupport: number;
        estimatedTargetNetIfWin: number;
        supporters: {
          supporterId: string;
          supporterName: string;
          amount: number;
          estimatedReturnIfWin: number;
          estimatedProfitIfWin: number;
        }[];
      };
    } = {};

    room.supportRecords.forEach((record) => {
      const target = userMap[record.targetToken];
      const supporter = userMap[record.supporterToken];
      if (!target || !supporter) return;
      const denominator = Math.max(1, record.targetTotalBet);
      const estimatedReturnIfWin = Math.floor((totalPot * record.amount) / denominator);
      const estimatedProfitIfWin = estimatedReturnIfWin - record.amount;
      if (!summaryMap[record.targetToken]) {
        summaryMap[record.targetToken] = {
          targetId: target.chipsRecordID,
          targetName: target.nickname || target.name,
          targetTotalBet: record.targetTotalBet,
          totalSupport: 0,
          estimatedTargetNetIfWin: 0,
          supporters: [],
        };
      }
      summaryMap[record.targetToken].totalSupport += record.amount;
      summaryMap[record.targetToken].estimatedTargetNetIfWin +=
        record.amount - estimatedReturnIfWin;
      summaryMap[record.targetToken].supporters.push({
        supporterId: supporter.chipsRecordID,
        supporterName: supporter.nickname || supporter.name,
        amount: record.amount,
        estimatedReturnIfWin,
        estimatedProfitIfWin,
      });
    });

    send2all(this.roomid, {
      type: "supportSummary",
      duration: Math.floor(supportSummaryDurationMs / 1000),
      details: Object.values(summaryMap),
    });

    const shouldResumeRunout =
      room.supportPhaseContext === "beforeRunout" && this.round < GameRound.River;
    room.supportPhaseContext = "beforeSettle";

    if (shouldResumeRunout) {
      delayTry(() => {
        this.nextRound();
      }, supportSummaryDurationMs);
      return;
    }

    // 进入正常结算
    delayTry(() => {
      this.settle();
    }, supportSummaryDurationMs);
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
        user.revealedHandsMask = new Array(holeCount).fill(false);
        this.cardIndex += holeCount;
        user.isFolded = false;
      }
    });
    this.calcUserRank();
  }
  getFutureBoardSlots(): Array<{ boardIndex: number; card: Card }> {
    if (this.boardCards.length >= 5) return [];
    const future: Array<{ boardIndex: number; card: Card }> = [];
    let index = this.cardIndex || 0;
    let round = this.round;
    let boardIndex = this.boardCards.length;
    while (round < GameRound.River && boardIndex < 5) {
      index += 1; // burn
      if (round === GameRound.PreFlop) {
        const flop = this.cards.slice(index, index + 3);
        flop.forEach((card, offset) => {
          if (card && boardIndex + offset < 5) {
            future.push({ boardIndex: boardIndex + offset, card });
          }
        });
        index += 3;
        boardIndex += 3;
      } else {
        const card = this.cards[index];
        if (card && boardIndex < 5) {
          future.push({ boardIndex, card });
        }
        index += 1;
        boardIndex += 1;
      }
      round += 1;
    }
    return future;
  }
  getDisplayedBoardCards(): (Card | null)[] {
    const cards: (Card | null)[] = [...this.boardCards];
    while (cards.length < 5) {
      cards.push(null);
    }
    this.getFutureBoardSlots().forEach(({ boardIndex }) => {
      const revealed = this.revealedFutureBoardCards[boardIndex];
      if (revealed) {
        cards[boardIndex] = revealed;
      }
    });
    return cards.slice(0, 5);
  }
  revealFutureBoardCard(boardIndex: number): Card | null {
    if (!Number.isInteger(boardIndex) || boardIndex < 0 || boardIndex > 4) {
      throw "无效的公共牌位置";
    }
    if (!this.isSettling) {
      throw "仅可在本局结算阶段查看未翻公牌";
    }
    if (Date.now() < this.settleBoardRevealAvailableAt) {
      throw "请在下一局倒计时阶段再查看未翻公牌";
    }
    if (this.nextGameTime && Date.now() >= this.nextGameTime) {
      throw "请在下一局倒计时阶段再查看未翻公牌";
    }
    if (this.boardCards[boardIndex]) {
      return this.boardCards[boardIndex];
    }
    if (this.revealedFutureBoardCards[boardIndex]) {
      return this.revealedFutureBoardCards[boardIndex];
    }
    const target = this.getFutureBoardSlots().find((slot) => slot.boardIndex === boardIndex);
    if (!target?.card) {
      throw "该位置没有未翻公牌";
    }
    this.revealedFutureBoardCards[boardIndex] = target.card;
    return target.card;
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
      console.log("already river turn, goto enter support phase or settle");
      this.enterSupportPhaseOrSettle();
      return;
    }

    const activeUsers = this.sortedUsers.filter(
      (t) => !userMap[t].isFolded && !userMap[t].isAllIn
    );
    const aliveUsers = this.sortedUsers.filter(
      (t) => !userMap[t].isFolded && userMap[t].isInCurrentGame
    );

    console.log("nextRound", activeUsers);

    // only one or zero user need act
    if (activeUsers.length <= 1) {
      // all-in 场景：支持阶段要早于亮手牌，避免支持者看到手牌后再做决定。
      if (aliveUsers.length > 1 && this.round < GameRound.River) {
        if (this.tryStartSupportPhase("beforeRunout")) {
          return;
        }
      }

      // 支持阶段结束后（或无需支持），先亮牌，再补公共牌。
      if (aliveUsers.length > 1 && !this.allInRunoutHandsRevealed) {
        aliveUsers.forEach((t) => {
          userMap[t].shouldShowHand = true;
        });
        this.allInRunoutHandsRevealed = true;
        publish2all(this.roomid);
        delayTry(() => {
          this.nextRound();
        }, 800);
        return;
      }

      console.log("only one or zero active user, auto deal next round");
      // all-in 自动补牌流程：支持阶段 -> 亮手牌 -> 补公共牌 -> River 比牌结算。
    }

    // 默认只发一次
    this.multiSettleTimes = 1;
    this.multiSettleConfirm = true;

    this.round += 1;
    this.sortedUsers.forEach((t) => {
      userMap[t].addTimeUsed = 0;
    });
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
      // 所有人 all-in 或只剩一人继续时，自动发完公共牌；
      // 将每一轮公共牌（3 + 1 + 1）的间隔从 1 秒加长到 3 秒
      delayTry(() => {
        this.nextRound();
      }, 3000);
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
  /** 当前行动玩家使用 +45s，每轮最多 3 次 */
  extendActionTime(token: Token): boolean {
    const user = userMap[token];
    if (!user.isActing) return false;
    const room = roomMap[this.roomid];
    const overtimeCost = Math.max(0, Math.floor(Number(room?.overtimeCost) || 0));
    if (user.addTimeUsed >= 3) return false;
    const preRoundBets = sum([...user.bets].slice(0, this.round));
    const availableStack = Math.floor(user.stack - preRoundBets - (user.overtimeFeePaid || 0));
    if (overtimeCost > 0 && availableStack < overtimeCost) return false;
    user.addTimeUsed += 1;
    user.overtimeFeePaid += overtimeCost;
    if (overtimeCost > 0) {
      publishLog2all(this.roomid, [
        `${user.nickname || user.name} 支付 ${overtimeCost} 欢乐豆加时45s`,
      ]);
    }
    const extra = 45000;
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
  private recordHandAction(
    _token: Token,
    _action: string,
    _chips: number,
    _putIn: number,
    _preBets: number
  ) {}
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
  chips: number; // table chips
  buyIn: number; // total buy in
};

export type RoomRedPacketDetail = {
  token: Token;
  amount: number;
  opened: boolean;
  openedAt: number;
  autoOpened: boolean;
};

export type RoomRedPacket = {
  id: string;
  status: "waiting" | "result";
  senderToken: Token;
  senderName: string;
  totalAmount: number;
  pausedNextGameRemainMs: number;
  recipients: RoomRedPacketDetail[];
  openDeadline: number;
  resultDeadline: number;
  luckiestToken: Token;
};

class Room {
  id: RoomID = ""; // string
  users: Token[] = [];
  isGaming: boolean = false;
  smallBlind: number = 0;
  buyIn: number = 0;
  reBuyLimit: number = 500;
  overtimeCost: number = 0;
  /** 是否短牌（仅 6～A 共 36 张） */
  isShortDeck: boolean = false;
  /** 是否奥马哈（4 张手牌，必须 2+3 组成 5 张） */
  isOmaha: boolean = false;
  /** 红包门槛：盈利达到初始买入多少倍才可发红包 */
  redPacketThresholdMultiple: number = 1;
  /** 红包额度上限：最多可发盈利筹码的百分比（1~100） */
  redPacketMaxPercent: number = 30;
  /** 是否开启支持功能 */
  supportEnabled: boolean = false;
  /** 支持功能最小奖池阈值 */
  supportMinPot: number = 600;
  /** 支持金额上限（目标玩家下注额的百分比） */
  supportMaxPercent: number = 5;
  game: Game = new Game("", "", 0, 500, false, false);
  chipsRecords: ChipsRecord[] = [];
  /** 结算阶段：多人可同时请求看同一人的手牌，等待被请求者逐条同意/拒绝 */
  pendingSeeHandRequests: {
    requestId: string;
    requesterToken: Token;
    targetToken: Token;
    chips: number;
  }[] = [];
  /** 当前红包状态（最多同时存在一个） */
  activeRedPacket: RoomRedPacket | null = null;
  redPacketOpenTimer: ReturnType<typeof setTimeout> = setTimeout(() => {}, 0);
  redPacketResultTimer: ReturnType<typeof setTimeout> = setTimeout(() => {}, 0);
  /** 支持阶段：弃牌玩家可以支持尚未弃牌的玩家 */
  isSupportPhase: boolean = false;
  /** 支持阶段触发时机：beforeRunout(补牌前) / beforeSettle(结算前) */
  supportPhaseContext: "beforeRunout" | "beforeSettle" = "beforeSettle";
  /** 当前手牌是否已触发过支持阶段（避免同一手重复触发） */
  supportPhaseDoneThisHand: boolean = false;
  /** 支持请求列表 */
  pendingSupportRequests: {
    requestId: string;
    supporterToken: Token;
    targetToken: Token;
    amount: number;
  }[] = [];
  /** 已确认的支持记录 */
  supportRecords: {
    supporterToken: Token;
    targetToken: Token;
    amount: number;
    /** 目标玩家本局总下注（用于结算时按占比分成） */
    targetTotalBet: number;
  }[] = [];
  supportPhaseTimer: ReturnType<typeof setTimeout> = setTimeout(() => {}, 0);
  /** 存储用户临时token与用户名、昵称的对应关系，用于玩家退出房间后的数据修复 */
  userInfoMap: {
    [token: string]: {
      name: string;
      nickname: string;
    }
  } = {};

  constructor(
    id: string,
    sb: number,
    buyIn: number,
    reBuyLimit: number = 500,
    isShortDeck: boolean = false,
    isOmaha: boolean = false,
    redPacketThresholdMultiple: number = 1,
    redPacketMaxPercent: number = 30,
    supportEnabled: boolean = false,
    supportMinPot: number = 600,
    supportMaxPercent: number = 5,
    overtimeCost: number = 0
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
    this.redPacketThresholdMultiple = Math.max(0, Number(redPacketThresholdMultiple) || 0);
    this.redPacketMaxPercent = Math.min(100, Math.max(1, Number(redPacketMaxPercent) || 30));
    this.supportEnabled = !!supportEnabled;
    this.supportMinPot = Math.max(100, Number(supportMinPot) || 600);
    this.supportMaxPercent = Math.min(50, Math.max(1, Number(supportMaxPercent) || 5));
    this.overtimeCost = Math.max(0, Math.floor(Number(overtimeCost) || 0));
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
    this.autoFallbackToLongDeckIfNeeded();
    this.isGaming = true;
    this.pendingSeeHandRequests = [];
    this.pendingSupportRequests = [];
    this.supportRecords = [];
    this.isSupportPhase = false;
    this.supportPhaseContext = "beforeSettle";
    this.supportPhaseDoneThisHand = false;
    clearTimeout(this.supportPhaseTimer);
    send2all(this.id, { seeHandRequests: [], supportRequests: [] });

    // already in a live hand
    if (this.game && this.game.roomid === this.id && !this.game.isSettling) {
      return true;
    }

    // settled hand: only allow manual redeal after countdown really ends
    if (this.game && this.game.roomid === this.id && this.game.isSettling) {
      this.game.nextGame();
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

  autoFallbackToLongDeckIfNeeded(): boolean {
    if (!this.isShortDeck) return false;
    const seatedCount = this.users.filter((t) => {
      const u = userMap[t];
      return !!u && !u.isSpectator;
    }).length;
    if (seatedCount <= 6) return false;
    this.isShortDeck = false;
    publishLog2all(this.id, [
      `🎛️ 在座人数已达 ${seatedCount} 人，系统自动切回长牌（下一局生效）`,
    ]);
    publish2all(this.id);
    return true;
  }

  addUser(token: Token): boolean {
    if (this.users.findIndex((t) => t == token) == -1) {
      this.users.push(token);

      // 存储用户UUID、用户名和昵称的对应关系
      this.userInfoMap[token] = {
        name: userMap[token].name,
        nickname: userMap[token].nickname || userMap[token].name
      };

      // 检查是否已有相同用户名的记录（积分榜中的记录）
      const existingRecord = this.chipsRecords.find(cr => cr.name === userMap[token].name);
      
      if (existingRecord) {
        normalizeChipsRecord(existingRecord);
        // 继承已有记录并更新token
        userMap[token].chipsRecordID = existingRecord.id;
        userMap[token].stack = existingRecord.chips;
        // 更新现有记录的token和nickname为新值
        existingRecord.token = token;
        existingRecord.nickname = userMap[token].nickname || userMap[token].name;
        console.log(`User ${userMap[token].name} joined with existing chips from leaderboard: ${existingRecord.chips}`);
      } else {
        const initialChips = Math.max(1, this.buyIn);
        // 创建新记录
        const id = uuidv4();
        userMap[token].chipsRecordID = id;
        userMap[token].stack = initialChips;

        const chipsRecord = {
          id,
          token,
          name: userMap[token].name,
          nickname: userMap[token].nickname || userMap[token].name,
          chips: 0,
          buyIn: initialChips,
        };
        applyTotalDelta(chipsRecord, initialChips);
        userMap[token].stack = chipsRecord.chips;
        this.chipsRecords.push(chipsRecord);
        console.log(
          `User ${userMap[token].name} joined with initial chips: ${initialChips} (table=${chipsRecord.chips})`
        );
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
        clearTimeout(this.redPacketOpenTimer);
        clearTimeout(this.redPacketResultTimer);
        this.activeRedPacket = null;
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
    const record = this.chipsRecords.find((cr) => cr.id == user.chipsRecordID);
    if (!record) {
      throw "积分记录不存在";
    }
    normalizeChipsRecord(record);
    if (user.isInCurrentGame && !this.isReBuyWindowOpen()) {
      throw "仅在下一局倒计时阶段可东山再起";
    }
    if (!this.canReBuy(token)) {
      throw "欢乐豆未达到东山再起条件";
    }
    const rebuyChips = Math.max(1, this.buyIn);
    record.buyIn += rebuyChips;
    applyTableStackToRecord(record, record.chips + rebuyChips);
    user.stack = record.chips;
    user.isReady = true;
  }

  repay(token: Token) {
    const user = userMap[token];
    const record = this.chipsRecords.find((cr) => cr.id == user.chipsRecordID);
    if (!record) {
      throw "积分记录不存在";
    }
    normalizeChipsRecord(record);
    const repayChips = Math.max(1, this.buyIn);
    const loanCount = Math.floor(Math.max(0, record.buyIn) / repayChips) - 1;
    if (loanCount <= 0) {
      throw "当前没有可还的贷款";
    }
    if (user.isInCurrentGame && !this.isReBuyWindowOpen()) {
      throw "仅在下一局倒计时阶段可还贷";
    }
    if (record.chips < repayChips) {
      throw "筹码不足，无法还贷";
    }
    record.buyIn -= repayChips;
    applyTableStackToRecord(record, record.chips - repayChips);
    user.stack = record.chips;
    user.isReady = true;
  }

  private getTableStack(token: Token): number {
    const user = userMap[token];
    if (!user) return 0;
    return Math.max(0, Math.floor(Number(user.stack) || 0));
  }

  private getTableMaxStack(): number {
    return this.users.reduce((max, token) => {
      const user = userMap[token];
      if (!user) return max;
      return Math.max(max, this.getTableStack(token));
    }, 0);
  }

  private getReBuyStackGap(): number {
    return Math.max(1, this.smallBlind * 2 * 100 - 1);
  }

  private isReBuyWindowOpen(): boolean {
    if (!this.game || !this.game.isSettling) {
      return false;
    }
    const now = Date.now();
    return now >= this.game.settleBoardRevealAvailableAt && now < this.game.nextGameTime;
  }

  canReBuy(token: Token): boolean {
    const user = userMap[token];
    if (!user) return false;
    if (user.isInCurrentGame && !this.isReBuyWindowOpen()) return false;
    const currentChips = this.getTableStack(token);
    const maxVisibleStack = this.getTableMaxStack();
    return currentChips <= maxVisibleStack - this.getReBuyStackGap();
  }

  canRepay(token: Token): boolean {
    const user = userMap[token];
    if (!user) return false;
    const record = this.chipsRecords.find((cr) => cr.id == user.chipsRecordID);
    if (!record) return false;
    normalizeChipsRecord(record);
    const repayChips = Math.max(1, this.buyIn);
    const loanCount = Math.floor(Math.max(0, record.buyIn) / repayChips) - 1;
    if (user.isInCurrentGame && !this.isReBuyWindowOpen()) {
      return false;
    }
    return loanCount > 0 && record.chips >= repayChips;
  }

  getReBuyThreshold(): number {
    return this.getTableMaxStack() - this.getReBuyStackGap();
  }
}

export default Room;
