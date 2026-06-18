import { assert } from "chai";
import {
  createRoom,
  createUser,
  roomMap,
  userEnterRoom,
  userMap,
  userReBuy,
  userRepay,
  userSendRedPacket,
} from "../service";
import Room from "../service/Room";
import { getTotalChips, normalizeChipsRecord } from "../service/chips";

function clean() {
  Object.keys(userMap).forEach((k) => delete userMap[k]);
  Object.keys(roomMap).forEach((k) => delete roomMap[k]);
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

function flushTimers(timers: QueuedTimer[]) {
  while (timers.length > 0) {
    timers.sort((a, b) => a.delay - b.delay);
    const timer = timers.shift();
    if (timer) {
      timer.cb();
    }
  }
}

function setPlayerState(
  room: Room,
  token: string,
  cfg: { stack: number; buyIn: number; bet: number }
) {
  const user = userMap[token];
  const record = room.chipsRecords.find((cr) => cr.id === user.chipsRecordID);
  if (!record) {
    throw new Error(`missing record for ${token}`);
  }
  record.chips = cfg.stack;
  record.buyIn = cfg.buyIn;
  normalizeChipsRecord(record);
  user.stack = cfg.stack;
  user.bets = [cfg.bet, 0, 0, 0];
  user.totalBets = cfg.bet;
  user.isInCurrentGame = true;
  user.isFolded = false;
  user.isReady = true;
}

function setOffTableState(
  room: Room,
  token: string,
  cfg: { stack: number; buyIn: number }
) {
  const user = userMap[token];
  const record = room.chipsRecords.find((cr) => cr.id === user.chipsRecordID);
  if (!record) {
    throw new Error(`missing record for ${token}`);
  }
  record.chips = cfg.stack;
  record.buyIn = cfg.buyIn;
  normalizeChipsRecord(record);
  user.stack = cfg.stack;
  user.bets = [0, 0, 0, 0];
  user.totalBets = 0;
  user.isInCurrentGame = false;
  user.isFolded = false;
  user.isReady = false;
}

function getRoomBalance(room: Room) {
  return room.chipsRecords.reduce(
    (sum, cr) => sum + Number(cr.buyIn || 0) - getTotalChips(cr),
    0
  );
}

function assertStacksSynced(room: Room) {
  room.chipsRecords.forEach((cr) => {
    const user = userMap[cr.token];
    assert.isOk(user, `missing user for record ${cr.id}`);
    assert.equal(getTotalChips(cr), user.stack);
  });
}

describe("settle account sync", () => {
  beforeEach(clean);

  it("keeps record and user stack aligned when rebuy is clicked immediately after the window opens", () => {
    createUser("owner", "owner", "/avatar");
    createUser("p2", "p2", "/avatar");
    createUser("p3", "p3", "/avatar");

    const room = createRoom("owner", 1, 2000, 500, false, false, 0, 50);

    runWithMockedTimeouts((timers) => {
      userEnterRoom("p2", room.id);
      userEnterRoom("p3", room.id);

      room.game.isSettling = true;
      room.game.settleBoardRevealAvailableAt = 0;
      room.game.nextGameTime = Date.now() + 60_000;
      setPlayerState(room, "owner", { stack: 6200, buyIn: 6000, bet: 0 });
      setPlayerState(room, "p2", { stack: 1500, buyIn: 4000, bet: 0 });
      setPlayerState(room, "p3", { stack: 7001, buyIn: 4701, bet: 0 });
      userMap["p3"].isSpectator = true;

      assert.isTrue(room.canReBuy("p2"));
      assert.isFalse(room.canRepay("p2"));

      userSendRedPacket("owner", 40);
      userReBuy("p2");
      assertStacksSynced(room);
      flushTimers(timers);
    });

    assert.equal(getRoomBalance(room), 0);
    assertStacksSynced(room);
  });

  it("keeps record and user stack aligned when repay is clicked immediately after the window opens", () => {
    createUser("owner", "owner", "/avatar");
    createUser("p2", "p2", "/avatar");
    createUser("p3", "p3", "/avatar");

    const room = createRoom("owner", 1, 2000, 500, false, false, 0, 50);

    runWithMockedTimeouts((timers) => {
      userEnterRoom("p2", room.id);
      userEnterRoom("p3", room.id);

      room.game.isSettling = true;
      room.game.settleBoardRevealAvailableAt = 0;
      room.game.nextGameTime = Date.now() + 60_000;
      setPlayerState(room, "owner", { stack: 4000, buyIn: 6000, bet: 0 });
      setPlayerState(room, "p2", { stack: 6000, buyIn: 4000, bet: 0 });
      setPlayerState(room, "p3", { stack: 7001, buyIn: 7001, bet: 0 });
      userMap["p3"].isSpectator = true;

      assert.isTrue(room.canRepay("p2"));

      userRepay("p2");
      assertStacksSynced(room);
      flushTimers(timers);
    });

    assert.equal(getRoomBalance(room), 0);
    assertStacksSynced(room);
  });

  it("allows off-table players to rebuy outside countdown when the threshold is met", () => {
    createUser("owner", "owner", "/avatar");
    createUser("p2", "p2", "/avatar");
    createUser("p3", "p3", "/avatar");

    const room = createRoom("owner", 1, 2000, 500, false, false, 0, 50);

    runWithMockedTimeouts((timers) => {
      userEnterRoom("p2", room.id);
      userEnterRoom("p3", room.id);

      room.game.isSettling = false;
      setPlayerState(room, "owner", { stack: 3000, buyIn: 4000, bet: 0 });
      setOffTableState(room, "p2", { stack: 5000, buyIn: 4000 });
      setOffTableState(room, "p3", { stack: 7001, buyIn: 7001 });
      userMap["p3"].isSpectator = true;

      assert.isTrue(room.canReBuy("p2"));
      userReBuy("p2");

      assert.equal(userMap["p2"].stack, 7000);
      assert.equal(room.chipsRecords.find((cr) => cr.id === userMap["p2"].chipsRecordID)?.buyIn, 6000);
      assert.isTrue(userMap["p2"].isReady);
      assertStacksSynced(room);
      flushTimers(timers);
    });

    assert.equal(getRoomBalance(room), 0);
    assertStacksSynced(room);
  });

  it("rejects repay outside countdown for seated players", () => {
    createUser("owner", "owner", "/avatar");
    createUser("p2", "p2", "/avatar");
    createUser("p3", "p3", "/avatar");

    const room = createRoom("owner", 1, 2000, 500, false, false, 0, 50);

    runWithMockedTimeouts((timers) => {
      userEnterRoom("p2", room.id);
      userEnterRoom("p3", room.id);

      room.game.isSettling = false;
      setPlayerState(room, "owner", { stack: 2000, buyIn: 4000, bet: 0 });
      setPlayerState(room, "p2", { stack: 6000, buyIn: 4000, bet: 0 });
      setPlayerState(room, "p3", { stack: 7001, buyIn: 7001, bet: 0 });
      userMap["p3"].isSpectator = true;

      assert.isFalse(room.canRepay("p2"));
      assert.throws(() => userRepay("p2"), "仅在下一局倒计时阶段可还贷");

      assert.equal(userMap["p2"].stack, 6000);
      assert.equal(room.chipsRecords.find((cr) => cr.id === userMap["p2"].chipsRecordID)?.buyIn, 4000);
      assertStacksSynced(room);
      flushTimers(timers);
    });

    assert.equal(getRoomBalance(room), 0);
    assertStacksSynced(room);
  });

  it("keeps balance synced across off-table rebuy/repay, seated repay, and countdown rebuy", () => {
    createUser("owner", "owner", "/avatar");
    createUser("p2", "p2", "/avatar");
    createUser("p3", "p3", "/avatar");
    createUser("p4", "p4", "/avatar");

    const room = createRoom("owner", 1, 2000, 500, false, false, 0, 50);

    runWithMockedTimeouts((timers) => {
      userEnterRoom("p2", room.id);
      userEnterRoom("p3", room.id);
      userEnterRoom("p4", room.id);

      room.game.isSettling = false;
      setOffTableState(room, "owner", { stack: 6000, buyIn: 10000 });
      setOffTableState(room, "p2", { stack: 6000, buyIn: 4000 });
      setOffTableState(room, "p3", { stack: 4000, buyIn: 4000 });
      setOffTableState(room, "p4", { stack: 6000, buyIn: 4000 });

      assert.equal(getRoomBalance(room), 0);

      assert.isTrue(room.canRepay("p2"));
      userRepay("p2");
      assert.equal(getRoomBalance(room), 0);
      assertStacksSynced(room);

      assert.isTrue(room.canReBuy("p3"));
      userReBuy("p3");
      assert.equal(getRoomBalance(room), 0);
      assertStacksSynced(room);

      assert.isTrue(room.canRepay("p4"));
      userRepay("p4");
      assert.equal(getRoomBalance(room), 0);
      assertStacksSynced(room);

      room.game.isSettling = true;
      room.game.settleBoardRevealAvailableAt = 0;
      room.game.nextGameTime = Date.now() + 60_000;

      assert.isTrue(room.canReBuy("p4"));
      userReBuy("p4");
      assert.equal(getRoomBalance(room), 0);
      assertStacksSynced(room);
      flushTimers(timers);
    });

    assert.equal(getRoomBalance(room), 0);
    assertStacksSynced(room);
  });
});
