import { assert } from "chai";
import {
  createRoom,
  createUser,
  roomMap,
  settleGame,
  userEnterRoom,
  userMap,
} from "../service";

function clean() {
  Object.keys(userMap).forEach((k) => delete userMap[k]);
  Object.keys(roomMap).forEach((k) => delete roomMap[k]);
}

describe("Settle button overflow red packet", () => {
  beforeEach(clean);

  it("按盈利封顶1999回收超额，并维持桌上欢乐豆封顶1000", () => {
    const owner = "cap-owner";
    const u2 = "cap-u2";
    const u3 = "cap-u3";
    createUser(owner, "cap-owner", "/avatar");
    createUser(u2, "cap-u2", "/avatar");
    createUser(u3, "cap-u3", "/avatar");

    const room = createRoom(owner, 1, 1000);
    userEnterRoom(u2, room.id);
    userEnterRoom(u3, room.id);

    const ownerRec = room.chipsRecords.find((cr) => cr.token === owner)!;
    const u2Rec = room.chipsRecords.find((cr) => cr.token === u2)!;
    const u3Rec = room.chipsRecords.find((cr) => cr.token === u3)!;

    ownerRec.chips = 3600;
    ownerRec.overflow = 0;
    ownerRec.buyIn = 1000;
    userMap[owner].stack = 3600;

    u2Rec.chips = 900;
    u2Rec.overflow = 0;
    u2Rec.buyIn = 2000; // 水下玩家（可抢红包）
    userMap[u2].stack = 900;

    u3Rec.chips = 3400;
    u3Rec.overflow = 0;
    u3Rec.buyIn = 1000;
    userMap[u3].stack = 3400;

    settleGame(owner);

    assert.equal(ownerRec.chips, 1000);
    assert.equal(ownerRec.overflow, 1999);
    assert.equal(u3Rec.chips, 1000);
    assert.equal(u3Rec.overflow, 1999);
    assert.equal(userMap[owner].stack, 1000);
    assert.equal(userMap[u3].stack, 1000);

    const packet = room.activeRedPacket;
    assert.isNotNull(packet);
    assert.equal(packet!.totalAmount, 1002);
    assert.equal(packet!.recipients.length, 1);
    assert.equal(packet!.recipients[0].token, u2);
    assert.equal(packet!.recipients[0].amount, 1002);
  });
});
