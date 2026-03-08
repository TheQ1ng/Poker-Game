import { assert } from "chai";
import { createRoom, createUser, roomMap, userEnterRoom, userMap } from "../service";
import Room, { Game, GameRound } from "../service/Room";
import { getTotalChips } from "../service/chips";
import { parse } from "../utils/game-engine";

function clean() {
  Object.keys(userMap).forEach((k) => delete userMap[k]);
  Object.keys(roomMap).forEach((k) => delete roomMap[k]);
}

function createManualGame(tokens: string[], buyIn = 500): { room: Room; game: Game } {
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

type QueuedTimer = {
  cb: Function;
  delay: number;
};

function runWithMockedTimeouts(run: (timers: QueuedTimer[]) => void) {
  const rawSetTimeout = global.setTimeout;
  const rawClearTimeout = global.clearTimeout;
  const queued: QueuedTimer[] = [];
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

describe("Settle balance when player leaves during settling", () => {
  beforeEach(clean);

  it("should keep room balance at 0 even if folded player leaves before delayed applySettlement", () => {
    const tokens = ["A", "B", "C"];
    const { room, game } = createManualGame(tokens, 500);
    game.boardCards = parse(["2c", "7d", "9h", "11s", "13c"], false);

    setPlayer("A", { stack: 500, bet: 100, fold: false, cards: ["14h", "14d"] });
    setPlayer("B", { stack: 500, bet: 100, fold: false, cards: ["3h", "4d"] });
    setPlayer("C", { stack: 500, bet: 40, fold: true, cards: ["5h", "6d"] });

    runWithMockedTimeouts((timers) => {
      game.settle();

      // 模拟结算动画期间玩家离开房间（sortedUsers 被移除）
      room.removeUser("C");

      // 执行最早的定时任务（即 delayed applySettlement）
      const earliest = Math.min(...timers.map((t) => t.delay));
      timers
        .filter((t) => t.delay === earliest)
        .forEach((t) => t.cb());
    });

    const cRecordId = userMap["C"].chipsRecordID;
    const cRecord = room.chipsRecords.find((cr) => cr.id === cRecordId);
    assert.isOk(cRecord);
    assert.equal(getTotalChips(cRecord!), 460);

    const balance = room.chipsRecords.reduce(
      (sum, cr) => sum + Number(cr.buyIn || 0) - getTotalChips(cr),
      0
    );
    assert.equal(balance, 0);
  });
});

