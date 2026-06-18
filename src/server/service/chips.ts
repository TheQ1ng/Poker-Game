type ChipsRecordLike = {
  chips: number;
  buyIn: number;
};

function toInt(value: number | string | undefined | null): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.floor(n);
}

export function getTotalChips(record: ChipsRecordLike): number {
  return Math.max(0, toInt(record.chips));
}

export function setTotalChips(record: ChipsRecordLike, total: number): number {
  const normalized = Math.max(0, toInt(total));
  record.chips = normalized;
  return normalized;
}

export function normalizeChipsRecord(record: ChipsRecordLike): number {
  record.chips = Math.max(0, toInt(record.chips));
  return record.chips;
}

export function applyTotalDelta(
  record: ChipsRecordLike,
  delta: number
): number {
  record.chips = Math.max(0, Math.floor(getTotalChips(record) + (Number(delta) || 0)));
  return record.chips;
}

export function applyTableStackToRecord(
  record: ChipsRecordLike,
  tableStack: number
): number {
  record.chips = Math.max(0, toInt(tableStack));
  return record.chips;
}

export function getRecordProfit(record: ChipsRecordLike): number {
  return getTotalChips(record) - Math.max(0, toInt(record.buyIn));
}
