import {
  Avatar,
  Button,
  Popover,
  Tooltip,
  Switch,
  Input,
} from "antd";
import { SendOutlined, SmileOutlined } from "@ant-design/icons";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useAppSelector, useAppDispatch } from "../../app/hooks";
import {
  ws_overtime,
  ws_userBet,
  ws_userFold,
  ws_userRebuy,
  ws_sendMessage,
} from "../../app/websocket";
import { CountDown } from "./CountDown";
import { Poker } from "./Poker";
import { RollingNumber } from "../../components/RollingNumber";
import { BigBlind, Dealer, SmallBlind } from "./Symbol";
import { selectGame, selectRoom, selectSelf, selectRoomChatBubbles, clearRoomChatBubble } from "./roomSlice";
import { selectChipsRecord } from "../chipsrecord/chipsRecordSlice";

// 预设快捷消息
const quickMessages = [
  "窝腰烟牌",
  "gay窝擦屁鞋",
  "666",
  "快点啊，我等到花都谢了",
  "对A无脑冲",
  "我中顺了",
  "我中花了",
  "福禄浩死打不打的过同花"
];

// 表情列表
const emojis = [
  "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣",
  "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰",
  "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜",
  "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳", "😏"
];



// 牌型等级，用于判断是否需要高亮
const handTypeRanks: { [key: string]: number } = {
  "高牌": 1,
  "一对": 2,
  "两对": 3,
  "三条": 4,
  "顺子": 5,
  "同花": 6,
  "葫芦": 7,
  "四条": 8,
  "同花顺": 9,
  "皇家同花顺": 10
};

// 语音播报牌型
function speakHandType(handType: string) {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(`Winner! ${handType}`);
    utterance.lang = 'zh-CN';
    utterance.volume = 1;
    utterance.rate = 1;
    utterance.pitch = 1;
    speechSynthesis.speak(utterance);
  }
}

const hintsound = require("../../assets/hint.wav");
const dealcardsound = require("../../assets/dealcard.wav");

// 头像图片映射
const avatarImages: { [key: string]: string } = {
  "playerIcon.png": require("../../assets/playerIcon.png"),
  "playerIcon (1).png": require("../../assets/playerIcon (1).png"),
  "playerIcon (2).png": require("../../assets/playerIcon (2).png"),
  "playerIcon (3).png": require("../../assets/playerIcon (3).png"),
  "playerIcon (4).png": require("../../assets/playerIcon (4).png"),
  "playerIcon (5).png": require("../../assets/playerIcon (5).png"),
  "playerIcon (6).png": require("../../assets/playerIcon (6).png"),
  "playerIcon (7).png": require("../../assets/playerIcon (7).png"),
  "playerIcon (8).png": require("../../assets/playerIcon (8).png"),
};

/** 聚宝盆金币数量：盈利≤100 为 14 枚，≥1000 为 50 枚，中间线性；动画同速率循环 */
function coinCountFromProfits(profits: number): number {
  if (profits <= 100) return 14;
  if (profits >= 1000) return 50;
  return Math.round(14 + (50 - 14) * (profits - 100) / (1000 - 100));
}

export function Owner({
  zoom,
  settleRevealStep = 0,
  showdownOrder = [],
  totalShowdown = 0,
  isSettlingCountdown = false,
  nextPositionUserIds = { SB: null, BB: null, D: null },
}: {
  zoom: number;
  settleRevealStep?: number;
  showdownOrder?: string[];
  totalShowdown?: number;
  isSettlingCountdown?: boolean;
  nextPositionUserIds?: { SB: string | null; BB: string | null; D: string | null };
}) {
  const hintSoundRef = useRef<HTMLAudioElement>(null);
  const dealCardSoundRef = useRef<HTMLAudioElement>(null);

  const self = useAppSelector(selectSelf);
  const game = useAppSelector(selectGame);
  const room = useAppSelector(selectRoom);
  const chipsRecordState = useAppSelector(selectChipsRecord);
  const roomChatBubbles = useAppSelector(selectRoomChatBubbles);
  const [chatInput, setChatInput] = useState("");
  const [quickChatVisible, setQuickChatVisible] = useState(false);
  const [emojiVisible, setEmojiVisible] = useState(false);
  const dispatch = useAppDispatch();
  useEffect(() => {
    if (!self?.id || !roomChatBubbles[self.id]) return;
    const t = setTimeout(() => dispatch(clearRoomChatBubble(self.id)), 5000);
    return () => clearTimeout(t);
  }, [self?.id, roomChatBubbles[self?.id || ""]?.at, dispatch]);

  const selfAsUser = room?.users.find((u) => u.id == self?.id);

  const chipsRecordSelf =
    room?.roomid && chipsRecordState?.roomid === room.roomid && self?.id
      ? chipsRecordState.chipsRecords.find((r) => r.id === self.id)
      : undefined;
  const netProfitSelf = chipsRecordSelf != null ? chipsRecordSelf.chips - chipsRecordSelf.buyIn : undefined;
  const stackBarStyleSelf =
    netProfitSelf === undefined
      ? { background: "linear-gradient(135deg, #ffd700 0%, #ff8c00 100%)" as const }
      : netProfitSelf > 0
        ? { background: "linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)" as const }
        : netProfitSelf < 0
          ? { background: "linear-gradient(135deg, #27ae60 0%, #1e8449 100%)" as const }
          : { background: "linear-gradient(135deg, #ffd700 0%, #ff8c00 100%)" as const };

  const preBet = game?.preBet || 0;
  const raiseBet = game?.raiseBet || 0;
  const raiseBetDiff = game?.raiseBetDiff || 0;
  const pots = game?.pots || 0;
  const bb = game?.bb || 0;
  const reBuyLimit = game?.reBuyLimit || 1;
  const isSettling = game?.isSettling || false;

  const myShowdownIndex = totalShowdown > 0 && self?.id ? showdownOrder.indexOf(self.id) : -1;
  const showHolePhase = isSettling && totalShowdown > 0 && myShowdownIndex >= 0 && settleRevealStep === myShowdownIndex * 2;
  const showMax5Phase = isSettling && totalShowdown > 0 && myShowdownIndex >= 0 && settleRevealStep >= myShowdownIndex * 2 + 1 && settleRevealStep < 2 * totalShowdown;
  const winnerPhase = isSettling && totalShowdown > 0 && settleRevealStep === 2 * totalShowdown;
  const settleDone = isSettling && totalShowdown > 0 && settleRevealStep > 2 * totalShowdown;
  const showAsWinner = (winnerPhase || settleDone) && !!self?.isWinner;
  const usePhasedSettle = isSettling && totalShowdown > 0;
  const showPhasedCards = usePhasedSettle && (showHolePhase || showMax5Phase || showAsWinner);

  const name = self?.name || "";
  // 获取昵称，如果没有则使用用户名
  const nickname = localStorage.getItem("nickname") || name;
  // 获取头像
  const avatar = localStorage.getItem("avatar") || "";
  const stack = self?.stack || 0;
  const bet = self?.bet || 0;
  const isActing = self?.isActing || false;
  const isWaiting =
    !self?.isActing &&
    !self?.isAllIn &&
    !self?.isFoled &&
    self?.isInCurrentGame;
  const leftTime = (self?.actionEndTime || Date.now()) - Date.now();
  const position = self?.position;
  // const isAllIn = self?.isAllIn || false;

  const canCheck = bet == preBet;
  const canCall = preBet > bet && stack + bet > preBet;
  const canRaise = game?.raiseUser != self?.id;
  const shouldAllIn = stack + bet <= preBet;
  const onlyRaiseAllIn = stack + bet <= raiseBet + raiseBetDiff;
  const minRaise = Math.min(stack, Math.max(bb, raiseBet + raiseBetDiff - bet));
  const maxRaise = stack;
  const has1_3 = stack >= pots / 3 && pots / 3 >= minRaise;
  const has1_2 = stack >= pots / 2 && pots / 2 >= minRaise;
  const has2_3 = stack >= (pots * 2) / 3 && (pots * 2) / 3 >= minRaise;
  const has3_4 = stack >= (pots * 3) / 4 && (pots * 3) / 4 >= minRaise;
  const has1_1 = stack >= pots && pots >= minRaise;
  const useBB = stack > 4 * bb && pots < 4 * bb;

  const chips2call = Math.min(stack, preBet - bet);

  const inGame = self?.isInCurrentGame && self?.isReady && !self?.isFoled;
  const overtimeCost = Math.min(
    bb,
    Math.max(1, pots / 4 / (game?.userCount || 1)),
    stack / (game?.userCount || 1)
  );

  const [calcInput, setCalcInput] = useState("");
  const [calcVisible, setCalcVisible] = useState(false);
  const [now, setNow] = useState(0);
  const [autoCheck, setAutoCheck] = useState(false);

  const stackRef = useRef(0);
  stackRef.current = self?.stack ?? 0;

  const raise = Math.min(maxRaise, Math.max(0, parseInt(calcInput, 10) || 0));
  const isOmahaGame = !!(game?.isOmaha || room?.isOmaha);

  const phasedHoleCards = isOmahaGame
    ? [
        self?.hands?.[0] ?? null,
        self?.hands?.[1] ?? null,
        self?.hands?.[2] ?? null,
        self?.hands?.[3] ?? null,
      ]
    : [self?.hands?.[0] ?? null, self?.hands?.[1] ?? null];

  useEffect(() => {
    if (hintSoundRef.current && isActing) {
      const audio: HTMLAudioElement = hintSoundRef.current;
      try {
        audio.play();
      } catch (ignore) {}
    }

    if (autoCheck && isActing) {
      if (canCheck) {
        ws_userBet(bet);
      } else {
        ws_userFold();
      }
    }
  }, [isActing]);

  useEffect(() => {
    setCalcInput("");
    setCalcVisible(false);
    setAutoCheck(false);
  }, [game?.boardCards.length, game?.isSettling]);

  useEffect(() => {
    if (dealCardSoundRef.current && room?.isGaming) {
      const audio: HTMLAudioElement = dealCardSoundRef.current;
      audio.play();
    }
  }, [game?.boardCards.length, room?.isGaming]);

  // 当玩家获胜时，播报牌型（分阶段结算时由 Room 统一播报 Winner + 牌型，此处不重复）
  useEffect(() => {
    if (self?.isWinner && self?.handsType && totalShowdown === 0) {
      speakHandType(self.handsType);
    }
  }, [self?.isWinner, self?.handsType, totalShowdown]);

  const btnStyle = {
    width: '100%',
    height: '100%',
    minWidth: 0,
    padding: 0,
    fontSize: 16,
    fontWeight: 'bold' as const,
    background: 'linear-gradient(180deg, #2d5a3d 0%, #1a3d28 100%)',
    border: '1px solid rgba(201, 162, 39, 0.4)',
    color: '#ffd700',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
  const btnStyleDel = {
    ...btnStyle,
    color: 'rgba(255,255,255,0.9)',
    background: 'linear-gradient(180deg, #3d2d1a 0%, #2d2010 100%)',
  };
  const btnStyleConfirm = {
    ...btnStyle,
    background: 'linear-gradient(180deg, #1e5c3e 0%, #164d30 100%)',
    color: '#b8e6c8',
  };

  return (
    <div className="owner-seat flex-row flex-center" style={{ height: "100%" }}>
      <audio src={hintsound} autoPlay={false} ref={hintSoundRef} />
      <audio src={dealcardsound} autoPlay={false} ref={dealCardSoundRef} />
      <div className="flex3 flex flex-center" style={{ position: 'relative' }}>
        {isActing && !isSettling && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: 6,
            fontSize: 12,
            fontWeight: 'bold',
            color: '#ffd700',
            textShadow: '0 0 8px rgba(255,215,0,0.8)',
            padding: '2px 10px',
            borderRadius: 10,
            background: 'rgba(0,0,0,0.6)',
            border: '1px solid rgba(255,215,0,0.5)',
          }}>
            行动中
          </div>
        )}
        <div className={`owner ${!inGame ? "fold" : ""}`}>
          <div style={{ position: 'relative', display: 'inline-block', width: 64, height: 64, overflow: 'visible' }}>
            {/* 赢家时与其他人一致：头像周围发光；分阶段结算时等展示完后再显示 */}
            {self?.isWinner && (!usePhasedSettle || settleDone) && (
              <div style={{
                position: 'absolute',
                top: -5,
                left: -5,
                right: -5,
                bottom: -5,
                borderRadius: '50%',
                border: '3px solid #ffd700',
                boxShadow: '0 0 20px rgba(255, 215, 0, 0.8)',
                animation: 'winnerGlow 2s ease-in-out infinite alternate',
                pointerEvents: 'none',
              }} />
            )}
            {/* 金币飞向头像聚宝盆效果 - 分阶段结算时等展示完后再触发 */}
            {self?.isWinner && self?.profits != null && self.profits >= 0 && (!usePhasedSettle || settleDone) && (() => {
              const coinCount = coinCountFromProfits(self.profits);
              const flyDuration = 1.1;
              const delayStep = flyDuration / coinCount;
              return (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: 0,
                height: 0,
                pointerEvents: 'none',
                zIndex: 4,
              }}>
                {Array.from({ length: coinCount }).map((_, i) => {
                  const angle = (i / coinCount) * 2 * Math.PI;
                  const r = 52;
                  const x = Math.cos(angle) * r;
                  const y = Math.sin(angle) * r;
                  return (
                    <span
                      key={i}
                      className="coin-fly"
                      style={{
                        ['--start-x' as string]: `${x}px`,
                        ['--start-y' as string]: `${y}px`,
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #ffd700 0%, #b8860b 100%)',
                        boxShadow: '0 0 6px rgba(255,215,0,0.8)',
                        fontSize: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#333',
                        fontWeight: 'bold',
                        animation: `coinsFlyToCenter ${flyDuration}s ease-in infinite`,
                        animationDelay: `${i * delayStep}s`,
                      }}
                    >
                      $
                    </span>
                  );
                })}
              </div>
              );
            })()}
            {avatar && avatarImages[avatar] ? (
              <img 
                src={avatarImages[avatar]} 
                alt="头像" 
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  borderRadius: "50%",
                  position: 'relative',
                  zIndex: 1,
                  display: 'block',
                }}
              />
            ) : (
              <Avatar style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
                fontSize: "20px",
                color: "white",
                position: 'relative',
                zIndex: 1,
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>{name.length > 0 ? name[0] : ""}</Avatar>
            )}
            {/* 自己头顶聊天气泡 */}
            {self?.id && roomChatBubbles[self.id] && (
              <div className="room-chat-bubble" style={{
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
                bottom: '100%',
                marginBottom: 6,
              }}>
                <div className="room-chat-bubble-inner">
                  {roomChatBubbles[self.id].text}
                </div>
                <div className="room-chat-bubble-tail" />
              </div>
            )}
          </div>
          <div style={{ color: 'white', textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>{nickname}</div>
          <div className="stack" style={{
            ...stackBarStyleSelf,
            borderRadius: "20px",
            padding: "2px 10px",
            fontSize: "12px",
            fontWeight: "bold",
            color: "#333",
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          }}>
            <span className="coins">🌟</span>
            <RollingNumber value={stack} style={{ fontSize: "12px", fontWeight: "bold" }} />
          </div>
          {stack + bet < reBuyLimit * bb &&
          (game?.isSettling || !self?.isInCurrentGame || self.isFoled) ? (
            <Button type="primary" onClick={() => ws_userRebuy()}>
              东山再起
            </Button>
          ) : null}
          {(() => {
            if (isSettlingCountdown && self?.id) {
              const el: ReactNode[] = [];
              (["SB", "BB", "D"] as const).forEach((role) => {
                const isCurrent = position === role && nextPositionUserIds[role] !== self.id;
                const isNext = nextPositionUserIds[role] === self.id;
                if (isCurrent)
                  el.push(
                    <div key={`out-${role}`} className="position position-badge-slide-out">
                      {role === "SB" ? <SmallBlind /> : role === "BB" ? <BigBlind /> : <Dealer />}
                    </div>
                  );
                if (isNext)
                  el.push(
                    <div key={`in-${role}`} className="position position-badge-slide-in">
                      {role === "SB" ? <SmallBlind /> : role === "BB" ? <BigBlind /> : <Dealer />}
                    </div>
                  );
              });
              return el.length > 0 ? el : null;
            }
            return position != "" ? (
              <div className="position">
                {position == "SB" ? (
                  <SmallBlind />
                ) : position == "BB" ? (
                  <BigBlind />
                ) : position == "D" ? (
                  <Dealer />
                ) : null}
              </div>
            ) : null;
          })()}
          {/* 聊天输入：最多 15 字 */}
          <div className="owner-chat-input-wrap" style={{ display: 'flex', alignItems: 'center' }}>
            <Popover
              content={
                <div style={{ padding: '12px', width: '600px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '10px' }}>
                    {emojis.map((emoji, index) => (
                      <div
                        key={index}
                        style={{
                          fontSize: '16px',
                          textAlign: 'center',
                          cursor: 'pointer',
                          padding: '4px',
                          borderRadius: '8px',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#e0e0e0';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                        onClick={() => {
                          ws_sendMessage(emoji);
                          setEmojiVisible(false);
                        }}
                      >
                        {emoji}
                      </div>
                    ))}
                  </div>
                </div>
              }
              trigger="click"
              visible={emojiVisible}
              onVisibleChange={setEmojiVisible}
              placement="bottom"
              overlayStyle={{
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                border: 'none',
                padding: 0
              }}
            >
              <Button
                size="small"
                icon={<SmileOutlined />}
                style={{
                  borderRadius: '50%',
                  width: 20,
                  height: 20,
                  background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  boxShadow: '0 1px 4px rgba(255, 152, 0, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 6,
                  transition: 'all 0.3s ease'
                }}
              />
            </Popover>
            <Popover
              content={
                <div style={{ padding: '8px', width: '160px' }}>
                  {quickMessages.map((message, index) => (
                    <div
                      key={index}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        marginBottom: '4px',
                        backgroundColor: '#f0f0f0',
                        textAlign: 'center',
                        fontSize: '12px',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#e0e0e0';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#f0f0f0';
                      }}
                      onClick={() => {
                        ws_sendMessage(message);
                        setQuickChatVisible(false);
                      }}
                    >
                      {message}
                    </div>
                  ))}
                </div>
              }
              trigger="click"
              visible={quickChatVisible}
              onVisibleChange={setQuickChatVisible}
              placement="bottom"
              overlayStyle={{
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                border: 'none',
                padding: 0
              }}
            >
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value.slice(0, 50))}
                placeholder="说点什么..."
                maxLength={50}
                size="small"
                onPressEnter={() => {
                  const t = chatInput.trim();
                  if (t) { 
                    ws_sendMessage(t); 
                    setChatInput(""); 
                  }
                }}
                onClick={() => setQuickChatVisible(true)}
                style={{ width: 180, borderRadius: 14 }}
              />
            </Popover>
            <Button
              type="primary"
              size="small"
              icon={<SendOutlined />}
              onClick={() => {
                const t = chatInput.trim();
                if (t) { 
                  ws_sendMessage(t); 
                  setChatInput(""); 
                }
              }}
              style={{
                borderRadius: '50%',
                width: 20,
                height: 20,
                background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
                border: '1px solid rgba(255,255,255,0.3)',
                boxShadow: '0 1px 4px rgba(76, 175, 80, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: 6,
                transition: 'all 0.3s ease'
              }}
              className="chat-send-btn"
            />
          </div>
        </div>
      </div>
      <div className="flex3 flex flex-column" style={{ height: "100%" }}>
        <div className="bet" style={{ color: 'white', fontWeight: 'bold' }}>
          {self?.actionName}
          {bet == 0 ? null : (
            <span style={{
              background: "linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%)",
              borderRadius: "20px",
              padding: "2px 8px",
              marginLeft: "8px",
            }}>
              <span className="coins">🌟</span>
              <RollingNumber value={bet} style={{ fontWeight: "bold" }} />
            </span>
          )}
        </div>
        <div className="flex1 flex-row flex-center">
          {showPhasedCards ? (
            <div
              className={`card-box card-box-stacked ${
                showHolePhase
                  ? isOmahaGame
                    ? "card-box-stacked-omaha4"
                    : "card-box-stacked-2"
                  : ""
              } ${showMax5Phase || showAsWinner ? "card-box-stacked-5" : ""} ${
                showAsWinner ? "settle-winner-cards" : ""
              }`}
            >
              {(showMax5Phase || showAsWinner) && (
                <div
                  className={`handstype ${showAsWinner ? "settle-winner-type" : ""}`}
                  style={{
                    ...(self?.handsType && handTypeRanks[self.handsType] >= 4 ? { color: "#ffd700", textShadow: "0 0 15px rgba(255, 215, 0, 0.8)", animation: "handTypeGlow 1.5s ease-in-out infinite alternate" } : { color: "white", textShadow: "1px 1px 2px rgba(0,0,0,0.8)" }),
                  }}
                >
                  {self?.handsType}
                </div>
              )}
              {(showHolePhase ? phasedHoleCards : (self?.maxCards || []).slice(0, 5)).map((card, i) => (
                <Poker
                  card={card}
                  key={card ? `${card.num}${card.suit}-${i}` : i}
                  index={i}
                  showHand={!!card}
                  isSelected={true}
                  size="medium"
                  showShowHandButton={false}
                />
              ))}
            </div>
          ) : (
            <>
              {isOmahaGame ? (
                <div style={{ display: "flex", alignItems: "center" }}>
                  {[0, 1, 2, 3].map((i) => (
                    <Poker
                      key={i}
                      card={self?.hands[i] || null}
                      index={i}
                      showHand={isSettling && !selfAsUser?.hands?.[i]}
                      isSelected={false}
                      size="medium"
                      showShowHandButton={!selfAsUser?.isAllIn}
                    />
                  ))}
                  <div
                    style={{
                      fontWeight: "bold",
                      marginLeft: "10px",
                      ...(self?.handsType && handTypeRanks[self.handsType] >= 4
                        ? {
                            color: "#ffd700",
                            textShadow: "0 0 15px rgba(255, 215, 0, 0.8)",
                            animation:
                              "handTypeGlow 1.5s ease-in-out infinite alternate",
                          }
                        : { color: "white" }),
                    }}
                  >
                    {self?.handsType}
                  </div>
                </div>
              ) : (
                <>
                  <Poker
                    card={self?.hands[0] || null}
                    index={0}
                    showHand={isSettling && !selfAsUser?.hands[0]}
                    isSelected={false}
                    size="medium"
                    showShowHandButton={!selfAsUser?.isAllIn}
                  />
                  <Poker
                    card={self?.hands[1] || null}
                    index={1}
                    showHand={isSettling && !selfAsUser?.hands[1]}
                    isSelected={false}
                    size="medium"
                    showShowHandButton={!selfAsUser?.isAllIn}
                  />
                  <div
                    style={{
                      fontWeight: "bold",
                      marginLeft: "10px",
                      ...(self?.handsType &&
                      handTypeRanks[self.handsType] >= 4
                        ? {
                            color: "#ffd700",
                            textShadow:
                              "0 0 15px rgba(255, 215, 0, 0.8)",
                            animation:
                              "handTypeGlow 1.5s ease-in-out infinite alternate",
                          }
                        : { color: "white" }),
                    }}
                  >
                    {self?.handsType}
                  </div>
                </>
              )}
            </>
          )}
        </div>
        <div className="flex flex-row flex-center">
          {isActing ? (
            <Tooltip title={`点击加时，需支付其他玩家各🌟${overtimeCost}`}>
              <Button
                type="text"
                style={{ width: 300 }}
                onClick={() => {
                  ws_overtime();
                  setNow(now + 1);
                }}
              >
                <CountDown time={Math.floor(leftTime / 1000)} now={now} />
              </Button>
            </Tooltip>
          ) : (
            <div>&nbsp;</div>
          )}
        </div>
      </div>
      <div className="flex4 flex flex-colomn user-actions" style={{
        transform: `scale(${ zoom < 1 ? 0.8/zoom : 1})`,
        zoom: `${zoom < 1 ? 1/zoom : 1}`,
        flex: zoom < 1 ? 12 : 4,
        transformOrigin: "bottom left",
        userSelect: "none",
      }}>
        {isWaiting ? (
          <div style={{ color: 'white' }}>
            <Switch
              checked={autoCheck}
              onChange={() => setAutoCheck(!autoCheck)}
              style={{ marginRight: '8px' }}
            />
            自动过或放弃
          </div>
        ) : null}
        {isActing ? (
          <>
            <div className="flex1 flex flex-row flex-center main-btn">
              <Button type="primary" size="large" onClick={ws_userFold}>
                放弃
              </Button>
              {canCheck ? (
                <Button
                  type="primary"
                  size="large"
                  onClick={() => ws_userBet(bet)}
                >
                  过
                </Button>
              ) : null}
              {canCall ? (
                <Button
                  type="primary"
                  size="large"
                  onClick={() => ws_userBet(chips2call + bet)}
                >
                  跟🌟 ${chips2call}
                </Button>
              ) : null}
              {shouldAllIn ? (
                <Button
                  type="primary"
                  size="large"
                  danger
                  onClick={() => ws_userBet(chips2call + bet)}
                >
                  全跟 ${chips2call}
                </Button>
              ) : canRaise ? (
                onlyRaiseAllIn ? (
                  <Button
                    type="primary"
                    size="large"
                    danger
                    onClick={() => ws_userBet(minRaise + bet)}
                  >
                    全跟 ${minRaise}
                  </Button>
                ) : (
                  <Popover
                    content={
                      <div className="raise-calc-popover" style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 48px)',
                        gridTemplateRows: 'auto repeat(3, 48px) 40px 40px 44px',
                        gap: 6,
                        width: 222,
                        background: 'linear-gradient(145deg, #1a3d28 0%, #0f2518 100%)',
                        padding: 12,
                        borderRadius: 12,
                        border: '2px solid rgba(201, 162, 39, 0.5)',
                        boxShadow: '0 6px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,215,0,0.08)',
                      }}>
                        <div style={{
                          gridColumn: '1 / -1',
                          textAlign: 'right',
                          padding: '10px 12px',
                          marginBottom: 4,
                          background: 'rgba(0,0,0,0.5)',
                          borderRadius: 8,
                          color: '#ffd700',
                          fontSize: 20,
                          fontWeight: 'bold',
                          minHeight: 38,
                          border: '1px solid rgba(255, 215, 0, 0.25)',
                        }}>
                          ${calcInput || '0'}
                        </div>
                        {[1, 2, 3].map((n) => (
                          <Button
                            key={n}
                            type="primary"
                            size="small"
                            onClick={() => setCalcInput((s) => s + String(n))}
                            style={btnStyle}
                          >
                            {n}
                          </Button>
                        ))}
                        <Button type="default" size="small" onClick={() => setCalcInput((s) => s.slice(0, -1))} style={btnStyleDel}>
                          删除
                        </Button>
                        {[4, 5, 6].map((n) => (
                          <Button key={n} type="primary" size="small" onClick={() => setCalcInput((s) => s + String(n))} style={btnStyle}>
                            {n}
                          </Button>
                        ))}
                        <Button type="primary" size="small" onClick={() => setCalcInput((s) => s + "0")} style={btnStyle}>
                          0
                        </Button>
                        {[7, 8, 9].map((n) => (
                          <Button key={n} type="primary" size="small" onClick={() => setCalcInput((s) => s + String(n))} style={btnStyle}>
                            {n}
                          </Button>
                        ))}
                        <Button
                          type="primary"
                          size="small"
                          disabled={raise < minRaise}
                          onClick={() => { ws_userBet(raise + bet); setCalcVisible(false); }}
                          style={btnStyleConfirm}
                        >
                          确认
                        </Button>
                        {/* 基于底池大小的快捷下注按钮：33%、50%、67%、100%（一底池） */}
                        {[
                          { label: "33%", factor: 1 / 3 },
                          { label: "50%", factor: 1 / 2 },
                          { label: "67%", factor: 2 / 3 },
                          { label: "100%", factor: 1 },
                        ].map((opt) => (
                          <Button
                            key={opt.label}
                            type="primary"
                            size="small"
                            onClick={() => {
                              const pot = pots || 0;
                              if (pot <= 0) return;
                              // 期望加注额 = 底池 * 百分比（33/50/67/100）
                              const raw = Math.floor(pot * opt.factor);
                              if (raw <= 0) return;
                              // 不超过自己剩余筹码
                              const available = Math.floor(stackRef.current || 0);
                              const potBasedRaise = Math.max(1, Math.min(available, raw));
                              setCalcInput(String(potBasedRaise));
                            }}
                            style={{
                              ...btnStyle,
                              background: 'linear-gradient(180deg, #123a5c 0%, #0b2236 100%)',
                              border: '1px solid rgba(120, 180, 255, 0.7)',
                              color: '#e0f3ff',
                              fontSize: 12,
                            }}
                          >
                            {opt.label}
                          </Button>
                        ))}
                        <Button
                          type="primary"
                          size="middle"
                          danger
                          onClick={() => {
                            // 计算本手牌剩余所有可用筹码：前端的 stack 已经是「未入池剩余筹码」
                            const allInAmount = Math.floor(stackRef.current || 0);
                            if (allInAmount > 0) {
                              setCalcInput(String(allInAmount));
                            }
                          }}
                          style={{
                            gridColumn: '1 / -1',
                            height: 44,
                            fontWeight: 'bold',
                            fontSize: 15,
                            letterSpacing: 2,
                            background: 'linear-gradient(180deg, #ff4444 0%, #cc0000 50%, #990000 100%)',
                            border: '2px solid rgba(255, 200, 200, 0.8)',
                            boxShadow: '0 0 20px rgba(255, 50, 50, 0.6), inset 0 1px 0 rgba(255,255,255,0.3)',
                            animation: 'allin-glow 1.5s ease-in-out infinite alternate',
                          }}
                        >
                          💥 全跟 🌟{Math.floor(stack)}
                        </Button>
                      </div>
                    }
                    title={<span style={{ color: '#d4af37', fontSize: 13 }}>加🌟 · 最小 ${minRaise} 最大 ${maxRaise}</span>}
                    trigger="click"
                    visible={calcVisible}
                    onVisibleChange={setCalcVisible}
                    placement="top"
                    overlayInnerStyle={{ background: 'transparent', padding: 0 }}
                  >
                    <Button
                      type="primary"
                      size="large"
                      onClick={() => setCalcVisible(true)}
                    >
                      加🌟
                    </Button>
                  </Popover>
                )
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
