import { assert } from "chai";
import { createRoom, createUser, roomMap, userEnterRoom, userMap } from "../service";
import Room, { Game, GameRound } from "../service/Room";
import { parse } from "../utils/game-engine";

function clean() {
  Object.keys(userMap).forEach((k) => delete userMap[k]);
  Object.keys(roomMap).forEach((k) => delete roomMap[k]);
}

function createManualGame(tokens: string[], buyIn = 1000): { room: Room; game: Game } {
  tokens.forEach((t, i) => createUser(t, `user-${i + 1}`, "/avatar"));
  const room = createRoom(tokens[0], 1, buyIn, 1, false, false, 1, 30, true, 100, 50);
  tokens.slice(1).forEach((t) => userEnterRoom(t, room.id));

  room.isGaming = false;
  room.game = new Game(room.id, tokens[0], room.smallBlind, room.reBuyLimit, false, false);
  room.game.sortedUsers = [...tokens];
  room.game.round = GameRound.River;
  room.game.boardCards = [];
  room.supportRecords = [];

  return { room, game: room.game };
}

function setPlayer(
  token: string,
  cfg: { stack: number; bet: number; fold: boolean; cards: string[]; allIn?: boolean }
) {
  const user = userMap[token];
  user.stack = cfg.stack;
  user.bets = [cfg.bet, 0, 0, 0];
  user.totalBets = cfg.bet;
  user.isFolded = cfg.fold;
  user.isAllIn = !!cfg.allIn;
  user.isInCurrentGame = true;
  user.hands = parse(cfg.cards, false);
}

function acceptSupport(room: Room, supporterToken: string, targetToken: string, amount: number) {
  userMap[supporterToken].stack -= amount;
  userMap[targetToken].stack += amount;
  room.supportRecords.push({
    supporterToken,
    targetToken,
    amount,
    targetTotalBet: userMap[targetToken].bets.reduce((a, b) => a + b, 0),
  });
}

function sumStacks(tokens: string[]): number {
  return tokens.reduce((sum, t) => sum + userMap[t].stack, 0);
}

function getChipsRecord(room: Room, token: string) {
  const id = userMap[token].chipsRecordID;
  const rec = room.chipsRecords.find((cr) => cr.id === id);
  if (!rec) {
    throw new Error(`chips record not found for ${token}`);
  }
  return rec;
}

function settleWithoutTimers(game: Game) {
  const rawSetTimeout = global.setTimeout;
  const rawClearTimeout = global.clearTimeout;
  (global as any).setTimeout = (() => ({}) as any) as unknown as typeof setTimeout;
  (global as any).clearTimeout = (() => undefined) as unknown as typeof clearTimeout;
  try {
    game.settle();
  } finally {
    global.setTimeout = rawSetTimeout;
    global.clearTimeout = rawClearTimeout;
  }
}

describe("Support settlement simulation", () => {
  beforeEach(clean);

  it("3人比牌 + 1名支持者：分成后总筹码保持一致", () => {
    const tokens = ["T", "A", "B", "S"];
    const { room, game } = createManualGame(tokens, 1000);
    game.boardCards = parse(["14h", "13h", "12h", "2c", "3d"], false);

    setPlayer("T", { stack: 1000, bet: 300, fold: false, cards: ["11h", "10h"] });
    setPlayer("A", { stack: 1000, bet: 300, fold: false, cards: ["14s", "14d"] });
    setPlayer("B", { stack: 1000, bet: 300, fold: false, cards: ["2d", "2s"] });
    setPlayer("S", { stack: 1000, bet: 100, fold: true, cards: ["9c", "8c"] });

    acceptSupport(room, "S", "T", 20);
    const totalBefore = sumStacks(tokens);

    settleWithoutTimers(game);

    // payout = floor(1000 * 20 / 300) = 66
    assert.equal(userMap["T"].stack, 1654);
    assert.equal(userMap["S"].stack, 946);
    assert.equal(userMap["A"].stack, 700);
    assert.equal(userMap["B"].stack, 700);
    assert.equal(sumStacks(tokens), totalBefore);

    tokens.forEach((t) => {
      assert.equal(getChipsRecord(room, t).chips, userMap[t].stack);
    });
  });

  it("all-in(钱多钱少)场景：按比例分成，且不会出现负筹码", () => {
    const tokens = ["T", "A", "B", "S"];
    const { room, game } = createManualGame(tokens, 1000);
    game.boardCards = parse(["2c", "7d", "9h", "11s", "13c"], false);

    setPlayer("T", { stack: 120, bet: 120, fold: false, cards: ["14h", "14d"], allIn: true });
    setPlayer("A", { stack: 400, bet: 300, fold: false, cards: ["13d", "12d"] });
    setPlayer("B", { stack: 500, bet: 300, fold: false, cards: ["11d", "10d"] });
    setPlayer("S", { stack: 300, bet: 100, fold: true, cards: ["4c", "5c"] });

    acceptSupport(room, "S", "T", 20);
    const totalBefore = sumStacks(tokens);

    settleWithoutTimers(game);

    // T 为短码 all-in 胜主池后仍可分成给支持者，且不出现负数
    assert.isAtLeast(userMap["T"].stack, 0);
    assert.isAtLeast(userMap["A"].stack, 0);
    assert.isAtLeast(userMap["B"].stack, 0);
    assert.isAtLeast(userMap["S"].stack, 0);
    assert.equal(sumStacks(tokens), totalBefore);

    tokens.forEach((t) => {
      assert.equal(getChipsRecord(room, t).chips, userMap[t].stack);
    });
  });

  it("多支持者按比例分成出现小数时向下取整，不会导致总筹码对不上", () => {
    const tokens = ["T", "A", "B", "S1", "S2"];
    const { room, game } = createManualGame(tokens, 1000);
    game.boardCards = parse(["14c", "13c", "12c", "2h", "3d"], false);

    setPlayer("T", { stack: 1000, bet: 333, fold: false, cards: ["11c", "10c"] });
    setPlayer("A", { stack: 1000, bet: 333, fold: false, cards: ["14d", "14h"] });
    setPlayer("B", { stack: 1000, bet: 333, fold: false, cards: ["13d", "13h"] });
    setPlayer("S1", { stack: 1000, bet: 101, fold: true, cards: ["4s", "5s"] });
    setPlayer("S2", { stack: 1000, bet: 100, fold: true, cards: ["6s", "7s"] });

    acceptSupport(room, "S1", "T", 17);
    acceptSupport(room, "S2", "T", 19);
    const totalBefore = sumStacks(tokens);

    settleWithoutTimers(game);

    // payout1 = floor(1200 * 17 / 333) = 61
    // payout2 = floor(1200 * 19 / 333) = 68
    assert.equal(userMap["S1"].stack, 943);
    assert.equal(userMap["S2"].stack, 949);
    assert.equal(userMap["T"].stack, 1774);
    assert.equal(sumStacks(tokens), totalBefore);

    tokens.forEach((t) => {
      assert.equal(getChipsRecord(room, t).chips, userMap[t].stack);
    });
  });
});
