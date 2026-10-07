import crypto from "crypto";
import fs from "fs";
import path from "path";

const TOKEN_LENGTH = 5;
const TOKEN_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const ROTATE_INTERVAL_MS = 12 * 60 * 60 * 1000;
const TOKEN_VALID_MS = ROTATE_INTERVAL_MS * 2;
const TOKEN_TIME_ZONE = "Europe/London";

const londonDateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TOKEN_TIME_ZONE,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const TOKEN_FILE = path.join(process.cwd(), "data", "register-token.json");

type RegisterTokenEntry = {
  token: string;
  issuedAt: number;
};

type RegisterTokenState = {
  current: RegisterTokenEntry;
  previous: RegisterTokenEntry | null;
};

type LondonDateTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export type RegisterTokenSnapshot = RegisterTokenState & {
  nextRotateAt: number;
  expiresAt: number;
};

function getLondonDateTime(timestamp: number): LondonDateTime {
  const parts = londonDateTimeFormatter.formatToParts(new Date(timestamp));
  const values: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = Number(part.value);
    }
  }

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function shiftLondonDate(date: LondonDateTime, days: number): LondonDateTime {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    ...date,
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function getLondonBoundary(date: LondonDateTime, hour: 3 | 15): number {
  // Convert a London wall-clock boundary to an epoch while respecting GMT/BST.
  const localAsUtc = Date.UTC(date.year, date.month - 1, date.day, hour, 0, 0, 0);
  const formattedAtCandidate = getLondonDateTime(localAsUtc);
  const londonAsUtc = Date.UTC(
    formattedAtCandidate.year,
    formattedAtCandidate.month - 1,
    formattedAtCandidate.day,
    formattedAtCandidate.hour,
    formattedAtCandidate.minute,
    formattedAtCandidate.second
  );
  const offsetMs = londonAsUtc - localAsUtc;
  return localAsUtc - offsetMs;
}

function getTokenSchedule(now: number): {
  currentStart: number;
  previousStart: number;
  nextStart: number;
} {
  const today = getLondonDateTime(now);
  const today3 = getLondonBoundary(today, 3);
  const today15 = getLondonBoundary(today, 15);

  if (now < today3) {
    const yesterday = shiftLondonDate(today, -1);
    return {
      currentStart: getLondonBoundary(yesterday, 15),
      previousStart: getLondonBoundary(yesterday, 3),
      nextStart: today3,
    };
  }

  if (now < today15) {
    return {
      currentStart: today3,
      previousStart: getLondonBoundary(shiftLondonDate(today, -1), 15),
      nextStart: today15,
    };
  }

  const tomorrow = shiftLondonDate(today, 1);
  return {
    currentStart: today15,
    previousStart: today3,
    nextStart: getLondonBoundary(tomorrow, 3),
  };
}

function normalizeToken(value: unknown): RegisterTokenEntry | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const token = String((value as { token?: unknown }).token ?? "").trim().toUpperCase();
  const issuedAt = Number((value as { issuedAt?: unknown }).issuedAt ?? 0);
  if (!/^[A-Z0-9]{5}$/.test(token) || !Number.isFinite(issuedAt) || issuedAt <= 0) {
    return null;
  }

  return {
    token,
    issuedAt: Math.floor(issuedAt),
  };
}

function readStateFromDisk(): RegisterTokenState | null {
  try {
    if (!fs.existsSync(TOKEN_FILE)) {
      return null;
    }

    const raw = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8")) as unknown;
    if (!raw || typeof raw !== "object") {
      return null;
    }

    const current = normalizeToken((raw as { current?: unknown }).current);
    if (!current) {
      return null;
    }

    const previous = normalizeToken((raw as { previous?: unknown }).previous);
    return {
      current,
      previous,
    };
  } catch {
    return null;
  }
}

function writeStateToDisk(state: RegisterTokenState) {
  fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true });
  const tmpFile = `${TOKEN_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2));
  fs.renameSync(tmpFile, TOKEN_FILE);
}

function randomToken(exclude = new Set<string>()): string {
  for (;;) {
    let token = "";
    for (let i = 0; i < TOKEN_LENGTH; i += 1) {
      const idx = crypto.randomInt(0, TOKEN_CHARSET.length);
      token += TOKEN_CHARSET[idx];
    }
    if (!exclude.has(token)) {
      return token;
    }
  }
}

function createFreshState(currentStart: number, previous: RegisterTokenEntry | null = null): RegisterTokenState {
  const exclude = new Set<string>();
  if (previous?.token) {
    exclude.add(previous.token);
  }

  return {
    current: {
      token: randomToken(exclude),
      issuedAt: currentStart,
    },
    previous,
  };
}

function normalizeState(state: RegisterTokenState, now: number): RegisterTokenState {
  const schedule = getTokenSchedule(now);
  const isCurrentSlot = state.current.issuedAt === schedule.currentStart;

  if (!isCurrentSlot) {
    const previous =
      state.current.issuedAt === schedule.previousStart
        ? state.current
        : null;
    return createFreshState(schedule.currentStart, previous);
  }

  const previous =
    state.previous?.issuedAt === schedule.previousStart &&
    Math.max(0, now - state.previous.issuedAt) < TOKEN_VALID_MS
      ? state.previous
      : null;

  return { current: state.current, previous };
}

export function syncRegisterTokenState(now = Date.now()): RegisterTokenSnapshot {
  const existing = readStateFromDisk();
  const schedule = getTokenSchedule(now);
  const initial = existing ?? createFreshState(schedule.currentStart);
  const nextState = normalizeState(initial, now);

  if (JSON.stringify(initial) !== JSON.stringify(nextState)) {
    writeStateToDisk(nextState);
  } else if (!existing) {
    writeStateToDisk(nextState);
  }

  return {
    ...nextState,
    nextRotateAt: schedule.nextStart,
    expiresAt: nextState.current.issuedAt + TOKEN_VALID_MS,
  };
}

export function getRegisterTokenSnapshot(now = Date.now()): RegisterTokenSnapshot {
  return syncRegisterTokenState(now);
}

export function isRegisterCodeValid(code: string, now = Date.now()): boolean {
  const token = String(code ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{5}$/.test(token)) {
    return false;
  }

  const state = syncRegisterTokenState(now);

  const candidates = [state.current, state.previous].filter(
    (entry): entry is RegisterTokenEntry => !!entry && Math.max(0, now - entry.issuedAt) < TOKEN_VALID_MS
  );
  return candidates.some((entry) => entry.token === token);
}
