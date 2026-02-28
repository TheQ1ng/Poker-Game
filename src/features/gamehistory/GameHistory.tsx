import { Card } from "../../ApiType";
import { useAppSelector } from "../../app/hooks";
import { selectGameHistory } from "./gameHistorySlice";
import { useMemo, useRef, useState } from "react";
import { ws_sendMessage } from "../../app/websocket";
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

    const isSettle = t.includes("win💰") || (t.includes("lose") && !t.includes("Fold"));
    const isSeeHand = /支付.*查看了.*手牌/.test(t);
    if (isSettle || isSeeHand) {
      pushCurrent();
      const settleLines: string[] = [line];
      i++;
      while (i < logs.length) {
        const next = logs[i].trim();
        const nextSettle = next.includes("win💰") || (next.includes("lose") && !next.includes("Fold"));
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
  const html = prettifyHtml(line);
  const isBold = /^(Flop|Turn|River|PreFlop|===)/.test(line.trim());
  return (
    <div
      className={`game-history-line ${isBold ? "game-history-line-head" : ""}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default function GameHistory() {
  const [message, setMessage] = useState("");
  const logs = useAppSelector(selectGameHistory);
  const scrollRef = useRef<HTMLDivElement>(null);

  const blocks = useMemo(() => groupLogsByFlow(logs), [logs]);
  const reversedBlocks = useMemo(() => [...blocks].reverse(), [blocks]);

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

  const handleSend = () => {
    if (!message.trim()) return;
    ws_sendMessage(message);
    setMessage("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSend();
  };

  return (
    <div className="game-history-container">
      <div
        ref={scrollRef}
        className="game-history-scroll"
        onWheel={handleWheel}
        style={{ overflowY: "auto" }}
      >
        {reversedBlocks.length === 0 ? (
          <div className="game-history-empty">暂无战况</div>
        ) : (
          reversedBlocks.map((block, idx) => (
            <div key={idx} className={`game-history-block game-history-block-${block.type}`}>
              {block.title && (
                <div className="game-history-block-title">{block.title}</div>
              )}
              <div className="game-history-block-lines">
                {block.lines.map((line, i) => (
                  <BlockRow key={i} line={line} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
      <div className="game-history-chat">
        <input
          placeholder="CMD/Ctrl+Enter 发送"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button type="button" onClick={handleSend}>&gt;</button>
      </div>
    </div>
  );
}
