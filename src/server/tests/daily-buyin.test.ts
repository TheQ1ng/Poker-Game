import { assert } from "chai";
import {
  createRoom,
  createUser,
  roomMap,
  userEnterRoom,
  userMap,
  userReBuy,
} from "../service";

function clean() {
  Object.keys(userMap).forEach((k) => delete userMap[k]);
  Object.keys(roomMap).forEach((k) => delete roomMap[k]);
}

describe("Daily buy-in limit", () => {
  beforeEach(clean);

  it("最多5次买入且第5次少1筹码", () => {
    const ownerToken = "daily-owner";
    const peerToken = "daily-peer";
    createUser(ownerToken, "daily-owner", "/avatar");
    createUser(peerToken, "daily-peer", "/avatar");

    const room = createRoom(ownerToken, 1, 400);
    userEnterRoom(peerToken, room.id);

    const owner = userMap[ownerToken];
    const ownerRecord = room.chipsRecords.find((cr) => cr.id === owner.chipsRecordID);
    if (!ownerRecord) throw new Error("owner chips record not found");

    // 第1次（初始买入）：400
    assert.equal(ownerRecord.buyIn, 400);
    assert.equal(owner.dailyBuyInUsed, 1);
    assert.equal(owner.dailyBuyInRemaining, 4);

    // 第2~5次重买：400、400、400、399
    for (let i = 0; i < 4; i += 1) {
      owner.stack = 0;
      userReBuy(ownerToken);
    }

    assert.equal(ownerRecord.buyIn, 1999);
    assert.equal(owner.dailyBuyInUsed, 5);
    assert.equal(owner.dailyBuyInRemaining, 0);

    owner.stack = 0;
    assert.throws(() => userReBuy(ownerToken), "洗洗睡吧");
  });
});

