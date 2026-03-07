export const TABLE_CHIPS_CAP = 1000;
export const SETTLE_PROFIT_CAP = 1999;

type ChipsRecordLike = {
  chips: number;
  overflow?: number;
  buyIn: number;
};

function toInt(value: number | string | undefined | null): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.floor(n);
}

export function getOverflow(record: ChipsRecordLike): number {
  return Math.max(0, toInt(record.overflow));
}

export function getTotalChips(record: ChipsRecordLike): number {
  return Math.max(0, toInt(record.chips) + getOverflow(record));
}

export function setTotalChips(record: ChipsRecordLike, total: number): number {
  const normalized = Math.max(0, toInt(total));
  normalizeChipsRecord(record);
  if (normalized <= record.chips) {
    record.chips = normalized;
    record.overflow = 0;
    return normalized;
  }
  // Keep table chips unchanged to avoid using overflow for auto-refill.
  record.overflow = normalized - record.chips;
  return normalized;
}

export function normalizeChipsRecord(record: ChipsRecordLike): number {
  const rawChips = Math.max(0, toInt(record.chips));
  const rawOverflow = Math.max(0, toInt(record.overflow));
  if (rawChips > TABLE_CHIPS_CAP) {
    record.chips = TABLE_CHIPS_CAP;
    record.overflow = rawOverflow + (rawChips - TABLE_CHIPS_CAP);
  } else {
    record.chips = rawChips;
    record.overflow = rawOverflow;
  }
  return record.chips + getOverflow(record);
}

export function applyTotalDelta(
  record: ChipsRecordLike,
  delta: number,
  options?: { preferOverflowOnNegative?: boolean }
): number {
  normalizeChipsRecord(record);
  let remain = Math.floor(Number(delta) || 0);
  if (remain === 0) {
    return getTotalChips(record);
  }
  if (remain > 0) {
    const roomForTable = Math.max(0, TABLE_CHIPS_CAP - record.chips);
    const toTable = Math.min(roomForTable, remain);
    record.chips += toTable;
    remain -= toTable;
    record.overflow = getOverflow(record) + remain;
    return getTotalChips(record);
  }

  const preferOverflowOnNegative = !!options?.preferOverflowOnNegative;
  let need = -remain;
  if (preferOverflowOnNegative) {
    const overflow = getOverflow(record);
    const fromOverflow = Math.min(overflow, need);
    record.overflow = overflow - fromOverflow;
    need -= fromOverflow;
    if (need > 0) {
      record.chips = Math.max(0, record.chips - need);
    }
    return getTotalChips(record);
  }
  // 默认负向变动只影响桌上欢乐豆，不动溢出。
  record.chips = Math.max(0, record.chips - need);
  return getTotalChips(record);
}

export function applyTableStackToRecord(
  record: ChipsRecordLike,
  tableStack: number
): number {
  normalizeChipsRecord(record);
  const nextTable = Math.max(0, toInt(tableStack));
  if (nextTable <= TABLE_CHIPS_CAP) {
    record.chips = nextTable;
    return getTotalChips(record);
  }
  record.chips = TABLE_CHIPS_CAP;
  record.overflow = getOverflow(record) + (nextTable - TABLE_CHIPS_CAP);
  return getTotalChips(record);
}

export function getRecordProfit(record: ChipsRecordLike): number {
  return getTotalChips(record) - Math.max(0, toInt(record.buyIn));
}

export function getProfitCapTotal(record: ChipsRecordLike): number {
  return Math.max(0, Math.max(0, toInt(record.buyIn)) + SETTLE_PROFIT_CAP);
}
