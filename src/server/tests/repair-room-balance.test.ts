import { assert } from "chai";
import { createRoom, createUser, repairRoomBalance, roomMap, userEnterRoom, userMap } from "../service";
import { getTotalChips, normalizeChipsRecord } from "../service/chips";

function clean() {
  Object.keys(userMap).forEach((k) => delete userMap[k]);
  Object.keys(roomMap).forEach((k) => delete roomMap[k]);
}

describe("repairRoomBalance", () => {
  beforeEach(clean);

  it("should fix imbalance for a player who already left the room", () => {
    createUser("owner", "owner", "/avatar");
    createUser("p2", "p2", "/avatar");
    createUser("p3", "p3", "/avatar");
    const room = createRoom("owner", 1, 500);
    userEnterRoom("p2", room.id);
    userEnterRoom("p3", room.id);

    const p3RecordId = userMap["p3"].chipsRecordID;
    room.removeUser("p3");

    const p3Record = room.chipsRecords.find((cr) => cr.id === p3RecordId);
    assert.isOk(p3Record);
    p3Record!.chips = 540; // 伪造账不平：多了 40
    normalizeChipsRecord(p3Record!);

    const balanceBefore = room.chipsRecords.reduce(
      (sum, cr) => sum + Number(cr.buyIn || 0) - getTotalChips(cr),
      0
    );
    assert.equal(balanceBefore, -40);

    repairRoomBalance("owner");

    const balanceAfter = room.chipsRecords.reduce(
      (sum, cr) => sum + Number(cr.buyIn || 0) - getTotalChips(cr),
      0
    );
    assert.equal(balanceAfter, 0);
    assert.equal(getTotalChips(p3Record!), 500);
  });
});

