import { Card } from "../../ApiType";
import { useAppSelector } from "../../app/hooks";
import { selectGameHistory } from "./gameHistorySlice";
import { useEffect, useMemo, useRef, useState } from "react";
import "./GameHistory.css";

export function card2html(cards: Card[]): string {
  return cards
    .map((card) => {
      const n = card.num;
      const s = card.suit;
      const ret =
        (n === 14 ? "A" : n === 13 ? "K" : n === 12 ? "Q" : n === 11 ? "J" : n === 10 ? "T" : `${n}`) +
        (s === "c" ? "♣︎" : s === "d" ? "♦︎" : s === "h" ? "♥︎" : s === "s" ? "♠︎" : "");
      if (s === "h") return `<span style="color: #ae2f11">${ret}</span>`;
      if (s === "d") return `<span style="color: #1976d2">${ret}</span>`;
      if (s === "c") return `<span style="color: #2e7d32">${ret}</span>`;
      return ret;
    })
    .join("");
}

function prettifyHtml(log: string) {
  let s = log.replace(/(\d+)(c|d|h|s)/g, (_: string, num: string, s: string) => {
    const n = parseInt(num, 10);
    return card2html([{ num: n, suit: s }]);
  });
  if (/^(Flop|Turn|River|PreFlop|===)/.test(log.trim())) {
    s = `<strong>${s}</strong>`;
  }
  return s;
}

function parseCompactCards(raw: string): Card[] {
  const cards: Card[] = [];
  const regex = /(\d+)(c|d|h|s)/g;
  let match: RegExpExecArray | null = regex.exec(raw);
  while (match) {
    cards.push({ num: Number(match[1]), suit: match[2] as Card["suit"] });
    match = regex.exec(raw);
  }
  return cards;
}

function cardNumLabel(num: number): string {
  if (num === 14) return "A";
  if (num === 13) return "K";
  if (num === 12) return "Q";
  if (num === 11) return "J";
  if (num === 10) return "T";
  return String(num);
}

function suitLabel(suit: Card["suit"]): string {
  if (suit === "h") return "♥";
  if (suit === "d") return "♦";
  if (suit === "c") return "♣";
  return "♠";
}

function actionLabel(action: string): string {
  if (action === "AllIn") return "全下";
  if (action === "Raise") return "加注";
  if (action === "Call") return "跟注";
  if (action === "Bet") return "下注";
  if (action === "Fold") return "弃牌";
  if (action === "Check") return "过牌";
  return action;
}

function PokerStyledCard({ card }: { card: Card }) {
  const isRed = card.suit === "h" || card.suit === "d";
  return (
    <span className={`gh-poker-card ${isRed ? "gh-poker-card-red" : "gh-poker-card-black"}`}>
      <span className="gh-poker-card-rank">{cardNumLabel(card.num)}</span>
      <span className="gh-poker-card-suit">{suitLabel(card.suit)}</span>
    </span>
  );
}

type ParsedLogLine =
  | {
      kind: "street";
      phase: string;
      cards: Card[];
    }
  | {
      kind: "action";
      player: string;
      action: "AllIn" | "Raise" | "Call" | "Bet" | "Fold" | "Check";
      amount?: number;
    }
  | {
      kind: "settle";
      player: string;
      holeCards: Card[];
      bestCards: Card[];
      handType?: string;
      result: "win" | "lose";
      amount: number;
      support?: {
        base: number;
        net: number;
        recv: number;
        pay: number;
        inv: number;
        back: number;
        total: number;
      };
    }
  | {
      kind: "seeHand";
      requester: string;
      target: string;
      chips: number;
    }
  | {
      kind: "showHand";
      player: string;
      cards: Card[];
    }
  | {
      kind: "chat";
      player: string;
      text: string;
    }
  | {
      kind: "warning";
      html: string;
    }
  | {
      kind: "plain";
      html: string;
    };

function parseSupportMetrics(raw?: string) {
  if (!raw) return undefined;
  const ret = {
    base: 0,
    net: 0,
    recv: 0,
    pay: 0,
    inv: 0,
    back: 0,
    total: 0,
  };
  const pairs = raw.split(",").map((item) => item.trim());
  pairs.forEach((pair) => {
    const [k, v] = pair.split("=");
    if (!k || v == null) return;
    const n = Number(v);
    if (!Number.isFinite(n)) return;
    if (k === "base") ret.base = n;
    if (k === "net") ret.net = n;
    if (k === "recv") ret.recv = n;
    if (k === "pay") ret.pay = n;
    if (k === "inv") ret.inv = n;
    if (k === "back") ret.back = n;
    if (k === "total") ret.total = n;
  });
  return ret;
}

function signedValueByTrend(trend: string, raw: string): number {
  const n = Math.abs(Number(raw));
  if (!Number.isFinite(n)) return 0;
  return trend === "输" ? -n : n;
}

function parseLegacySupportDetails(raw?: string) {
  const ret = {
    recv: 0,
    pay: 0,
    inv: 0,
    back: 0,
  };
  if (!raw) return ret;
  raw
    .split(/[，,]/)
    .map((token) => token.trim())
    .forEach((token) => {
      const recvMatch = token.match(/^收到支持\s*(-?\d+)$/);
      if (recvMatch) {
        ret.recv = Math.abs(Number(recvMatch[1])) || 0;
        return;
      }
      const invMatch = token.match(/^投入\s*(-?\d+)$/);
      if (invMatch) {
        ret.inv = Math.abs(Number(invMatch[1])) || 0;
        return;
      }
      const backMatch = token.match(/^返还\s*(-?\d+)$/);
      if (backMatch) {
        ret.back = Math.abs(Number(backMatch[1])) || 0;
      }
    });
  return ret;
}

function isSettleLineText(text: string): boolean {
  return (
    text.includes("win💰") ||
    (text.includes("lose") && !text.includes("Fold")) ||
    /原[赢输]\s*-?\d+.*总[赢输]\s*-?\d+/.test(text)
  );
}

function parseLogLine(line: string): ParsedLogLine {
  const trimmed = line.trim();
  const phaseMap: Record<string, string> = {
    PreFlop: "翻前",
    Flop: "翻牌",
    Turn: "转牌",
    River: "河牌",
  };

  const streetMatch = trimmed.match(/^(PreFlop|Flop|Turn|River):\s*([0-9cdhs]+)/);
  if (streetMatch) {
    const phase = phaseMap[streetMatch[1]] || streetMatch[1];
    return {
      kind: "street",
      phase,
      cards: parseCompactCards(streetMatch[2]),
    };
  }

  const actionMatch = trimmed.match(
    /^(.+?)\s+(AllIn|Raise to|Call|Bet|Fold|Check)(?:\s+\$?(-?\d+))?$/
  );
  if (actionMatch) {
    const rawAction = actionMatch[2];
    const action =
      rawAction === "Raise to"
        ? "Raise"
        : (rawAction as "AllIn" | "Call" | "Bet" | "Fold" | "Check");
    return {
      kind: "action",
      player: actionMatch[1],
      action,
      amount: actionMatch[3] ? Number(actionMatch[3]) : undefined,
    };
  }

  const settleMatch = trimmed.match(
    /^(.+?)\s+(?:【([0-9cdhs]+)】([0-9cdhs]+)(?:\s+(.+?))?\s+)?(win💰|lose)\s+(-?\d+)(?:\s+\|\s+支持\{([^}]+)\})?$/
  );
  if (settleMatch) {
    const support = parseSupportMetrics(settleMatch[7]);
    return {
      kind: "settle",
      player: settleMatch[1],
      holeCards: settleMatch[2] ? parseCompactCards(settleMatch[2]) : [],
      bestCards: settleMatch[3] ? parseCompactCards(settleMatch[3]) : [],
      handType: settleMatch[4],
      result: settleMatch[5] === "win💰" ? "win" : "lose",
      amount: Number(settleMatch[6]),
      support,
    };
  }

  const legacySettleMatch = trimmed.match(
    /^(.+?)\s+(?:【([0-9cdhs]+)】([0-9cdhs]+)(?:\s+(.+?))?\s+)?原(赢|输)\s*(-?\d+)(?:[，,]\s*支持环节(赢|输|返还)\s*(-?\d+)(?:（([^）]+)）)?)?[，,]\s*总(赢|输)\s*(-?\d+)$/
  );
  if (legacySettleMatch) {
    const base = signedValueByTrend(legacySettleMatch[5], legacySettleMatch[6]);
    const total = signedValueByTrend(legacySettleMatch[10], legacySettleMatch[11]);
    const supportAction = legacySettleMatch[7];
    const supportValueRaw = legacySettleMatch[8];
    const supportDetails = parseLegacySupportDetails(legacySettleMatch[9]);
    let support;
    if (supportAction && supportValueRaw != null) {
      const abs = Math.abs(Number(supportValueRaw)) || 0;
      const net = supportAction === "输" ? -abs : supportAction === "返还" ? -abs : abs;
      support = {
        base,
        net,
        recv: supportDetails.recv,
        pay: supportAction === "返还" ? abs : 0,
        inv: supportDetails.inv,
        back: supportDetails.back,
        total,
      };
    }
    return {
      kind: "settle",
      player: legacySettleMatch[1],
      holeCards: legacySettleMatch[2] ? parseCompactCards(legacySettleMatch[2]) : [],
      bestCards: legacySettleMatch[3] ? parseCompactCards(legacySettleMatch[3]) : [],
      handType: legacySettleMatch[4],
      result: legacySettleMatch[10] === "赢" ? "win" : "lose",
      amount: total,
      support,
    };
  }

  const seeHandMatch = trimmed.match(
    /^(.+?)\s+支付\s+\$?(-?\d+)\s+查看了\s+(.+?)\s+的手牌$/
  );
  if (seeHandMatch) {
    return {
      kind: "seeHand",
      requester: seeHandMatch[1],
      chips: Number(seeHandMatch[2]),
      target: seeHandMatch[3],
    };
  }

  const showHandMatch = trimmed.match(/^(.+?)亮牌【([0-9cdhs]+)】$/);
  if (showHandMatch) {
    return {
      kind: "showHand",
      player: showHandMatch[1],
      cards: parseCompactCards(showHandMatch[2]),
    };
  }

  const chatMatch = trimmed.match(/^<strong[^>]*>(.*?)<\/strong>:\s*(.*)$/);
  if (chatMatch) {
    return {
      kind: "chat",
      player: chatMatch[1],
      text: chatMatch[2],
    };
  }

  if (trimmed.includes("⚠️")) {
    return { kind: "warning", html: prettifyHtml(line) };
  }

  return { kind: "plain", html: prettifyHtml(line) };
}

function isKeyEventLine(line: string): boolean {
  const parsed = parseLogLine(line);
  if (
    parsed.kind === "settle" ||
    parsed.kind === "seeHand" ||
    parsed.kind === "showHand" ||
    parsed.kind === "warning"
  ) {
    return true;
  }
  if (parsed.kind === "action") {
    return parsed.action === "AllIn" || parsed.action === "Raise";
  }
  return false;
}

type BlockType = "start" | "street" | "action" | "settle" | "meta";

interface LogBlock {
  type: BlockType;
  title?: string;
  lines: string[];
}

function groupLogsByFlow(logs: string[]): LogBlock[] {
  const blocks: LogBlock[] = [];
  let current: LogBlock | null = null;
  let seenStreet = false;
  const push = (b: LogBlock) => {
    if (b.lines.length > 0) blocks.push(b);
  };
  const pushCurrent = () => {
    if (current && current.lines.length > 0) {
      if (current.type === "action" && !seenStreet) current.title = "翻前";
      blocks.push(current);
      current = null;
    }
  };

  for (let i = 0; i < logs.length; i++) {
    const line = logs[i];
    const t = line.trim();

    if (t === "====游戏开始====") {
      pushCurrent();
      current = { type: "start", title: "游戏开始", lines: [line] };
      push(current);
      current = null;
      continue;
    }

    const streetMatch = t.match(/^(PreFlop|Flop|Turn|River):\s*(.*)/);
    if (streetMatch) {
      seenStreet = true;
      pushCurrent();
      const phase = streetMatch[1];
      const phaseNames: Record<string, string> = {
        PreFlop: "翻前",
        Flop: "翻牌",
        Turn: "转牌",
        River: "河牌",
      };
      current = { type: "street", title: phaseNames[phase] || phase, lines: [line] };
      continue;
    }

    if (/^第\d+轮$/.test(t) || /^发\d+次$/.test(t) || /玩家.*决定/.test(t)) {
      pushCurrent();
      const metaLines: string[] = [line];
      i++;
      while (i < logs.length) {
        const next = logs[i].trim();
        if (/^第\d+轮$/.test(next) || /^发\d+次$/.test(next) || /玩家.*决定/.test(next)) {
          metaLines.push(logs[i]);
          i++;
        } else {
          i--;
          break;
        }
      }
      push({ type: "meta", title: "发牌设置", lines: metaLines });
      continue;
    }

    const isSettle = isSettleLineText(t);
    const isSeeHand = /支付.*查看了.*手牌/.test(t);
    if (isSettle || isSeeHand) {
      pushCurrent();
      const settleLines: string[] = [line];
      i++;
      while (i < logs.length) {
        const next = logs[i].trim();
        const nextSettle = isSettleLineText(next);
        const nextSeeHand = /支付.*查看了.*手牌/.test(next);
        if (nextSettle || nextSeeHand) {
          settleLines.push(logs[i]);
          i++;
        } else {
          i--;
          break;
        }
      }
      push({ type: "settle", title: "结算", lines: settleLines });
      continue;
    }

    if (t.startsWith("<strong") || t.includes("⚠️")) {
      pushCurrent();
      push({ type: "meta", lines: [line] });
      continue;
    }

    if (current && current.type === "street") {
      current.lines.push(line);
    } else if (current && current.type === "action") {
      current.lines.push(line);
    } else {
      pushCurrent();
      current = { type: "action", lines: [line] };
    }
  }
  pushCurrent();

  return blocks;
}

function BlockRow({ line }: { line: string }) {
  const parsed = parseLogLine(line);
  const valueText = (n: number) => `${n >= 0 ? "+" : "-"}${Math.abs(n)}`;
  const trendClass = (n: number) => (n > 0 ? "gh-support-pos" : n < 0 ? "gh-support-neg" : "gh-support-zero");
  if (parsed.kind === "street") {
    return (
      <div className="game-history-line game-history-line-street">
        <span className="gh-pill gh-pill-street">{parsed.phase}</span>
        <div className="gh-poker-cards">
          {parsed.cards.map((card, idx) => (
            <PokerStyledCard key={`${card.num}-${card.suit}-${idx}`} card={card} />
          ))}
        </div>
      </div>
    );
  }

  if (parsed.kind === "action") {
    return (
      <div className="game-history-line game-history-line-action">
        <span className={`gh-pill gh-pill-action gh-pill-action-${parsed.action.toLowerCase()}`}>
          {actionLabel(parsed.action)}
        </span>
        <span className="gh-player">{parsed.player}</span>
        {parsed.amount !== undefined && (
          <span className="gh-amount">${parsed.amount}</span>
        )}
      </div>
    );
  }

  if (parsed.kind === "settle") {
    const settleAmount = Math.abs(parsed.amount);
    return (
      <div className="game-history-line game-history-line-settle">
        <div className="gh-settle-main">
          <span className="gh-player">{parsed.player}</span>
          <span className={`gh-pill ${parsed.result === "win" ? "gh-pill-win" : "gh-pill-lose"}`}>
            {parsed.result === "win" ? `赢 +${settleAmount}` : `输 -${settleAmount}`}
          </span>
        </div>
        {(parsed.holeCards.length > 0 || parsed.bestCards.length > 0) && (
          <div className="gh-settle-sections">
            {parsed.holeCards.length > 0 && (
              <div className="gh-settle-section">
                <span className="gh-settle-label">手牌</span>
                <div className="gh-poker-cards">
                  {parsed.holeCards.map((card, idx) => (
                    <PokerStyledCard key={`h-${card.num}-${card.suit}-${idx}`} card={card} />
                  ))}
                </div>
              </div>
            )}
            {parsed.bestCards.length > 0 && (
              <div className="gh-settle-section">
                <span className="gh-settle-label">最终牌</span>
                <div className="gh-poker-cards">
                  {parsed.bestCards.map((card, idx) => (
                    <PokerStyledCard key={`b-${card.num}-${card.suit}-${idx}`} card={card} />
                  ))}
                </div>
              </div>
            )}
            {parsed.handType && <span className="gh-handtype">{parsed.handType}</span>}
          </div>
        )}
        {parsed.support && (
          <div className="gh-support-panel">
            <div className="gh-support-metrics">
              <span className={`gh-support-chip ${trendClass(parsed.support.base)}`}>
                原局 {valueText(parsed.support.base)}
              </span>
              <span className={`gh-support-chip ${trendClass(parsed.support.net)}`}>
                支持 {valueText(parsed.support.net)}
              </span>
              <span className={`gh-support-chip gh-support-total ${trendClass(parsed.support.total)}`}>
                总计 {valueText(parsed.support.total)}
              </span>
            </div>
            <div className="gh-support-details">
              {parsed.support.recv > 0 && (
                <span className="gh-support-detail">收到支持 +{parsed.support.recv}</span>
              )}
              {parsed.support.pay > 0 && (
                <span className="gh-support-detail">返还支持 -{parsed.support.pay}</span>
              )}
              {parsed.support.inv > 0 && (
                <span className="gh-support-detail">投入支持 -{parsed.support.inv}</span>
              )}
              {parsed.support.back > 0 && (
                <span className="gh-support-detail">返还到账 +{parsed.support.back}</span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (parsed.kind === "seeHand") {
    return (
      <div className="game-history-line game-history-line-seehand">
        <span className="gh-pill gh-pill-meta">看牌</span>
        <span className="gh-player">{parsed.requester}</span>
        <span className="gh-text">支付</span>
        <span className="gh-amount">${parsed.chips}</span>
        <span className="gh-text">查看了</span>
        <span className="gh-player">{parsed.target}</span>
      </div>
    );
  }

  if (parsed.kind === "showHand") {
    return (
      <div className="game-history-line game-history-line-seehand">
        <span className="gh-pill gh-pill-meta">亮牌</span>
        <span className="gh-player">{parsed.player}</span>
        <div className="gh-poker-cards">
          {parsed.cards.map((card, idx) => (
            <PokerStyledCard key={`show-${card.num}-${card.suit}-${idx}`} card={card} />
          ))}
        </div>
      </div>
    );
  }

  // 战况不显示玩家聊天内容
  if (parsed.kind === "chat") {
    return null;
  }

  if (parsed.kind === "warning") {
    return (
      <div
        className="game-history-line game-history-line-warning"
        dangerouslySetInnerHTML={{ __html: parsed.html }}
      />
    );
  }

  return (
    <div
      className="game-history-line"
      dangerouslySetInnerHTML={{ __html: parsed.html }}
    />
  );
}

export default function GameHistory() {
  const logs = useAppSelector(selectGameHistory);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expandedGames, setExpandedGames] = useState<Set<number>>(new Set());
  const [showKeyEventsOnly, setShowKeyEventsOnly] = useState(false);

  // 按游戏局数分组
  const games = useMemo(() => {
    const gameGroups: { id: number; blocks: LogBlock[] }[] = [];
    let currentGameLogs: string[] = [];
    
    logs.forEach((log) => {
      if (log.trim() === "====游戏开始====") {
        if (currentGameLogs.length > 0) {
          const blocks = groupLogsByFlow(currentGameLogs);
          gameGroups.push({ id: gameGroups.length, blocks });
        }
        currentGameLogs = [log];
      } else if (currentGameLogs.length > 0) {
        currentGameLogs.push(log);
      }
    });
    
    if (currentGameLogs.length > 0) {
      const blocks = groupLogsByFlow(currentGameLogs);
      gameGroups.push({ id: gameGroups.length, blocks });
    }

    return gameGroups.reverse().map((game) => ({
      ...game,
      blocks: [...game.blocks]
        .reverse()
        .map((block) => ({ ...block, lines: [...block.lines].reverse() })),
    }));
  }, [logs]);

  const displayGames = useMemo(() => {
    if (!showKeyEventsOnly) {
      return games;
    }
    return games
      .map((game) => ({
        ...game,
        blocks: game.blocks
          .map((block) => ({
            ...block,
            lines: block.lines.filter(isKeyEventLine),
          }))
          .filter((block) => block.lines.length > 0),
      }))
      .filter((game) => game.blocks.length > 0);
  }, [games, showKeyEventsOnly]);

  useEffect(() => {
    if (displayGames.length === 0) {
      if (expandedGames.size !== 0) {
        setExpandedGames(new Set());
      }
      return;
    }
    const hasVisibleExpanded = [...expandedGames].some((id) =>
      displayGames.some((g) => g.id === id)
    );
    if (!hasVisibleExpanded) {
      setExpandedGames(new Set([displayGames[0].id]));
    }
  }, [displayGames, expandedGames]);

  const toggleGame = (gameId: number) => {
    const newExpanded = new Set(expandedGames);
    if (newExpanded.has(gameId)) {
      newExpanded.delete(gameId);
    } else {
      newExpanded.add(gameId);
    }
    setExpandedGames(newExpanded);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const canScrollUp = scrollTop > 0;
    const canScrollDown = scrollTop < scrollHeight - clientHeight - 1;
    if ((e.deltaY < 0 && canScrollUp) || (e.deltaY > 0 && canScrollDown)) {
      e.preventDefault();
      el.scrollTop += e.deltaY;
    }
  };

  return (
    <div className="game-history-container">
      <div className="game-history-toolbar">
        <button
          type="button"
          className={`game-history-key-toggle ${showKeyEventsOnly ? "active" : ""}`}
          onClick={() => setShowKeyEventsOnly((v) => !v)}
        >
          {showKeyEventsOnly ? "显示全部事件" : "只看关键事件"}
        </button>
      </div>
      <div
        ref={scrollRef}
        className="game-history-scroll"
        onWheel={handleWheel}
        style={{ overflowY: "auto" }}
      >
        {displayGames.length === 0 ? (
          <div className="game-history-empty">
            {showKeyEventsOnly ? "暂无关键事件" : "暂无战况"}
          </div>
        ) : (
          displayGames.map((game, gameIdx) => (
            <div key={game.id} className="game-history-game">
              <div 
                className="game-history-game-header"
                onClick={() => toggleGame(game.id)}
              >
                <span className="game-history-game-title">第 {displayGames.length - gameIdx} 局</span>
                <span className={`game-history-game-toggle ${expandedGames.has(game.id) ? 'expanded' : ''}`}>
                  {expandedGames.has(game.id) ? '▼' : '▶'}
                </span>
              </div>
              {expandedGames.has(game.id) && (
                <div className="game-history-game-content">
                  {game.blocks.map((block, blockIdx) => (
                    <div key={blockIdx} className={`game-history-block game-history-block-${block.type}`}>
                      {block.title && (
                        <div className="game-history-block-title">{block.title}</div>
                      )}
                      <div className="game-history-block-lines">
                        {block.lines.map((line, lineIdx) => (
                          <BlockRow key={lineIdx} line={line} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
