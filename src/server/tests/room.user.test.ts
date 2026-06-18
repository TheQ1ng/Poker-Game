import { assert } from "chai";
import {
  createRoom,
  createUser,
  roomMap,
  startGame,
  userBet,
  userEnterRoom,
  userFold,
  userMap,
  userReady,
  userReBuy,
  userRevealBoardCard,
  userRepay,
  userExtendActionTime,
} from "../service";
import Room, { Game, GameRound } from "../service/Room";
import User, { Token } from "../service/User";
import { logGame } from "./utils";

function clean() {
  Object.keys(userMap).forEach((k) => delete userMap[k]);
  Object.keys(roomMap).forEach((k) => delete roomMap[k]);
}

function runWithMockedTimeouts(run: (timers: Array<{ cb: Function; delay: number }>) => void) {
  const rawSetTimeout = global.setTimeout;
  const rawClearTimeout = global.clearTimeout;
  const queued: Array<{ cb: Function; delay: number }> = [];
  (global as any).setTimeout = ((cb: Function, delay: number = 0) => {
    queued.push({ cb, delay: Number(delay) || 0 });
    return queued.length as any;
  }) as unknown as typeof setTimeout;
  (global as any).clearTimeout = (() => undefined) as unknown as typeof clearTimeout;
  try {
    run(queued);
  } finally {
    global.setTimeout = rawSetTimeout;
    global.clearTimeout = rawClearTimeout;
  }
}

function createGameWithUsers(n: number, buyIn = 200, reBuyLimit = 500): [Room, Game, User[]] {
  const ts = new Array(n).fill(0).map((_, i) => `token-${i}`);
  ts.forEach((t) => {
    createUser(t, t.toUpperCase(), "/pig");
  });
  const room = createRoom(ts[0], 1, buyIn, reBuyLimit);
  runWithMockedTimeouts((timers) => {
    ts.forEach((t) => {
      userEnterRoom(t, room.id);
      userReady(t);
    });
    startGame(ts[0]);
  });
  const game = room.game;
  const users = game.sortedUsers.map((t) => userMap[t]);
  return [room, game, users];
}

function runAndFlushEarliestTimers(run: (timers: Array<{ cb: Function; delay: number }>) => void) {
  runWithMockedTimeouts((timers) => {
    run(timers);
    if (timers.length > 0) {
      const earliest = Math.min(...timers.map((t) => t.delay));
      timers
        .filter((t) => t.delay === earliest)
        .forEach((t) => t.cb());
    }
  });
}

function getChipsRecoud(room: Room, token: Token) {
  return room.chipsRecords[
    room.chipsRecords.findIndex((cr) => cr.id == userMap[token].chipsRecordID)
  ];
}

function setVisibleChips(room: Room, token: Token, chips: number) {
  const user = userMap[token];
  const record = getChipsRecoud(room, token);
  record.chips = chips;
  user.stack = chips;
  user.bets = [0, 0, 0, 0];
}

function openRebuyWindow(game: Game, windowMs = 60_000) {
  game.isSettling = true;
  game.settleBoardRevealAvailableAt = 0;
  game.nextGameTime = Date.now() + windowMs;
}

function testCase_bbFold(): [Room, Game, User[]] {
  const [room, game, users] = createGameWithUsers(2);
  runAndFlushEarliestTimers(() => {
    const [sb, bb] = users.map((u) => u.token);
    userBet(sb, 4);
    userFold(bb);
  });
  return [room, game, users];
}

function testCase_sb199_bb200_sbFold(): [Room, Game, User[]] {
  const [room, game, users] = createGameWithUsers(2);
  runAndFlushEarliestTimers(() => {
    const [sb, bb] = users.map((u) => u.token);
    userBet(sb, 199);
    userBet(bb, 200);
  });
  return [room, game, users];
}

describe("Game Test", () => {
  describe("sb raise 4, bb fold.", () => {
    beforeEach(clean);

    it("sb 200 -> 202", () => {
      const [room, game, users] = testCase_bbFold();
      const [sb, bb] = users.map((u) => u.token);
      const sbCr = getChipsRecoud(room, sb);
      assert.equal(sbCr.buyIn, 200);
      assert.equal(sbCr.chips, 202);
    });
    it("bb 200 -> 198", () => {
      const [room, game, users] = testCase_bbFold();
      const [sb, bb] = users.map((u) => u.token);
      const bbCr = getChipsRecoud(room, bb);
      assert.equal(bbCr.buyIn, 200);
      assert.equal(bbCr.chips, 198);
    });
    it("game should be new, in round preflop", () => {
      const [room, game, users] = testCase_bbFold();
      assert.equal(game.round, GameRound.PreFlop);
    });
  });
  describe("re buy in", () => {
    beforeEach(clean);
    it("can rebuy", () => {
      const [room, game, users] = testCase_bbFold();
      const [sb, bb] = users.map((u) => u.token);
      setVisibleChips(room, sb, 5000);
      setVisibleChips(room, bb, 7001);
      userReBuy(sb);
      assert.equal(userMap[sb].stack, 5200);
      const sbCr = getChipsRecoud(room, sb);
      assert.equal(sbCr.chips, 5200);
      assert.equal(sbCr.buyIn, 400);
    });

    it("cannot rebuy", () => {
      const [room, game, users] = testCase_bbFold();
      const [sb, bb] = users.map((u) => u.token);
      setVisibleChips(room, sb, 7000);
      setVisibleChips(room, bb, 7001);
      assert.throws(() => userReBuy(sb), "欢乐豆未达到东山再起条件");
    });

    it("can repay after rebuy", () => {
      const [room, game, users] = testCase_bbFold();
      const [sb, bb] = users.map((u) => u.token);
      setVisibleChips(room, sb, 5000);
      setVisibleChips(room, bb, 7001);
      userReBuy(sb);
      userRepay(sb);
      assert.equal(userMap[sb].stack, 5000);
      const sbCr = getChipsRecoud(room, sb);
      assert.equal(sbCr.chips, 5000);
      assert.equal(sbCr.buyIn, 200);
    });

    it("cannot repay without loan", () => {
      const [room, game, users] = testCase_bbFold();
      const [sb, bb] = users.map((u) => u.token);
      assert.throws(() => userRepay(sb), "当前没有可还的贷款");
    });

    it("cannot rebuy before countdown opens", () => {
      const [room, game, users] = createGameWithUsers(2);
      const [sb, bb] = users.map((u) => u.token);
      openRebuyWindow(game, 60_000);
      game.settleBoardRevealAvailableAt = Date.now() + 60_000;
      setVisibleChips(room, sb, 5000);
      setVisibleChips(room, bb, 7001);

      assert.throws(() => userReBuy(sb), "仅在下一局倒计时阶段可东山再起");
    });

    it("counts spectators when checking the rebuy threshold", () => {
      const [room, game, users] = createGameWithUsers(3);
      const active = users[0].token;
      const spectator = users[2].token;
      openRebuyWindow(game);
      setVisibleChips(room, active, 7000);
      setVisibleChips(room, spectator, 9000);
      userMap[spectator].isSpectator = true;

      assert.isTrue(room.canReBuy(active));
      userReBuy(active);
      assert.equal(userMap[active].stack, 7200);
    });

    it("resets +45s usage on each betting round", () => {
      const [room, game, users] = createGameWithUsers(2);
      const acting = game.sortedUsers[0];
      userExtendActionTime(acting);
      userExtendActionTime(acting);
      userExtendActionTime(acting);
      assert.throws(() => userExtendActionTime(acting), "无法加时");

      runWithMockedTimeouts(() => {
        game.nextRound();
      });

      assert.equal(game.round, GameRound.Flop);
      game.sortedUsers.forEach((token) => {
        assert.equal(userMap[token].addTimeUsed, 0);
      });
    });

    it("re buy and continue game", () => {
      const [room, game, users] = testCase_bbFold();
      const [sb, bb] = users;
      setVisibleChips(room, sb.token, 5000);
      setVisibleChips(room, bb.token, 7001);
      getChipsRecoud(room, sb.token).buyIn = 5000;
      getChipsRecoud(room, bb.token).buyIn = 7001;
      userReBuy(sb.token);
      startGame(sb.isRoomOwner ? sb.token : bb.token);
      assert.equal(room.isGaming, true);
      logGame(game);
    });
  });
  describe("reveal hidden board cards in settle countdown", () => {
    beforeEach(clean);

    it("can reveal the unrevealed board card for everyone", () => {
      const [room, game, users] = createGameWithUsers(2);
      const viewer = users[0].token;
      game.isSettling = true;
      game.round = GameRound.PreFlop;
      game.boardCards = [];
      game.settleBoardRevealAvailableAt = 0;

      const expected = game.getFutureBoardSlots().find((slot) => slot.boardIndex === 0)?.card;
      userRevealBoardCard(viewer, 0);

      assert.deepEqual(game.getDisplayedBoardCards()[0], expected);
    });

    it("cannot reveal before countdown stage starts", () => {
      const [room, game, users] = createGameWithUsers(2);
      const viewer = users[0].token;
      game.isSettling = true;
      game.round = GameRound.PreFlop;
      game.boardCards = [];
      game.settleBoardRevealAvailableAt = Date.now() + 60_000;

      assert.throws(() => userRevealBoardCard(viewer, 0), "请在下一局倒计时阶段再查看未翻公牌");
    });
  });
});
