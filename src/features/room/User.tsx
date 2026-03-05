/* eslint-disable react-hooks/rules-of-hooks */
import { Tooltip, Button, Popconfirm, InputNumber, Popover, Input } from "antd";
import { ApiOutlined, CoffeeOutlined, CloseOutlined, EyeOutlined, CheckOutlined } from "@ant-design/icons";
import { shallowEqual, useSelector, useDispatch } from "react-redux";
import { RootState } from "../../app/store";
import { Poker } from "./Poker";
import { RollingNumber } from "../../components/RollingNumber";
import { AllIn, BigBlind, Dealer, SmallBlind } from "./Symbol";
import { card2html } from "../gamehistory/GameHistory";
import { soundManager } from "../../utils/soundManager";
import { BeautifulPokerCard } from "../../components/BeautifulPokerCard";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { selectSelf, selectGame, selectRoom, selectPendingSeeHandRequests, selectRevealedHandsForMe, selectRoomChatBubbles } from "./roomSlice";
import { selectChipsRecord } from "../chipsrecord/chipsRecordSlice";
import { ws_kickUser, ws_requestSeeHand, ws_sendMessage } from "../../app/websocket";
import { clearRoomChatBubble } from "./roomSlice";

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

const actionNameToClass: { [key: string]: string } = {
  "冲": "allin",
  "跟": "call",
  "下": "bet",
  "加": "raise",
  "放弃": "fold",
};

// 获取所有头像键值
const avatarKeys = Object.keys(avatarImages);

// 靴子图标（踢出房间）- 使用与顶部控制按钮统一的线性风格 SVG
function BootIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block" }}
    >
      <path
        d="M7 4h5a2 2 0 0 1 2 2v6.5c0 .9.36 1.76 1 2.4L18 18H7V4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M7 18h12.2a.8.8 0 0 1 .78 1.01L19.5 21.5a1.6 1.6 0 0 1-1.53 1.18H7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11 7.5h1.7A1.8 1.8 0 0 1 14.5 9.3V13"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M8.5 6.2H11M8.5 8.4H11M8.5 10.6H11"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 聚宝盆金币数量：盈利≤100 为 14 枚，≥1000 为 50 枚，中间线性；动画同速率循环 */
function coinCountFromProfits(profits: number): number {
  if (profits <= 100) return 14;
  if (profits >= 1000) return 50;
  return Math.round(14 + (50 - 14) * (profits - 100) / (1000 - 100));
}

// 为机器人生成随机头像
function getRandomAvatarForBot(userId: string): string {
  // 使用用户ID作为种子，确保同一机器人始终使用相同的头像
  let seed = 0;
  for (let i = 0; i < userId.length; i++) {
    seed += userId.charCodeAt(i);
  }
  const randomIndex = seed % avatarKeys.length;
  return avatarKeys[randomIndex];
}

export function User({
  id,
  settleRevealStep = 0,
  showdownOrder = [],
  totalShowdown = 0,
  isActingUser = false,
  isSettlingCountdown = false,
  nextPositionUserIds = { SB: null, BB: null, D: null },
}: {
  id: string;
  settleRevealStep?: number;
  showdownOrder?: string[];
  totalShowdown?: number;
  isActingUser?: boolean;
  isSettlingCountdown?: boolean;
  nextPositionUserIds?: { SB: string | null; BB: string | null; D: string | null };
}) {
  const user = useSelector((state: RootState) => {
    const users = state.room.room?.users;
    if (!users) return null;
    const index = users.findIndex((u) => u.id == id);
    return users[index];
  }, shallowEqual);
  const self = useSelector(selectSelf, shallowEqual);
  const room = useSelector(selectRoom, shallowEqual);
  const chipsRecordState = useSelector(selectChipsRecord, shallowEqual);
  const game = useSelector(selectGame, shallowEqual);
  const pendingSeeHandRequests = useSelector(selectPendingSeeHandRequests, shallowEqual);
  const revealedHandsForMe = useSelector(selectRevealedHandsForMe, shallowEqual);
  const roomChatBubbles = useSelector(selectRoomChatBubbles, shallowEqual);
  const isSelf = self?.id === id;
  const dispatch = useDispatch();
  useEffect(() => {
    if (!roomChatBubbles[id]) return;
    const t = setTimeout(() => dispatch(clearRoomChatBubble(id)), 5000);
    return () => clearTimeout(t);
  }, [id, roomChatBubbles[id]?.at, dispatch]);
  const [seeHandChips, setSeeHandChips] = useState<number>(game?.bb ? game.bb * 5 : 10);
  
  // 当大哥值变化时，更新看牌欢乐豆为 5 个大哥
  useEffect(() => {
    if (game?.bb) {
      setSeeHandChips(game.bb * 5);
    }
  }, [game?.bb]);
  const [seeHandPopOpen, setSeeHandPopOpen] = useState<Record<string, boolean>>({});
  const name = user?.name || "";
  const nickname = user?.nickname || name;
  const avatar = user?.avatar || "";
  const stack = user?.stack || 0;
  const bet = user?.bet || 0;
  const isActing = user?.isActing || false;
  const actionEndTime = user?.actionEndTime || Date.now();
  const revealedForMe = revealedHandsForMe[id];
  const showHands = !!user?.hands?.some((card) => !!card);
  const displayHands = user?.shouldShowHand ? user : revealedForMe;
  const showHandsArea = showHands || (revealedForMe && revealedForMe.hands?.length);
  const handsToShow = user?.shouldShowHand ? user?.hands : revealedForMe?.hands;
  const handsTypeToShow = user?.shouldShowHand ? user?.handsType : revealedForMe?.handsType;
  const shouldShowCards = user?.shouldShowHand || !!revealedForMe;
  const position = user?.position;
  const posComp =
    position == "SB" ? (
      <SmallBlind />
    ) : position == "BB" ? (
      <BigBlind />
    ) : position == "D" ? (
      <Dealer />
    ) : null;
  const inGame = user?.isInCurrentGame && !user?.isFoled;
  const isSettling = useSelector((state: RootState) => state.room.game?.isSettling || false, shallowEqual);

  const myShowdownIndex = totalShowdown > 0 ? showdownOrder.indexOf(id) : -1;
  const showHolePhase = isSettling && totalShowdown > 0 && myShowdownIndex >= 0 && settleRevealStep === myShowdownIndex * 2;
  const showMax5Phase = isSettling && totalShowdown > 0 && myShowdownIndex >= 0 && settleRevealStep >= myShowdownIndex * 2 + 1 && settleRevealStep < 2 * totalShowdown;
  const winnerPhase = isSettling && totalShowdown > 0 && settleRevealStep === 2 * totalShowdown;
  const settleDone = isSettling && totalShowdown > 0 && settleRevealStep > 2 * totalShowdown;
  const showAsWinner = (winnerPhase || settleDone) && !!user?.isWinner;
  const hideCardsInSettle = isSettling && totalShowdown > 0 && myShowdownIndex >= 0 && !showHolePhase && !showMax5Phase && !showAsWinner;
  const usePhasedSettle = isSettling && totalShowdown > 0;
  const isOmahaGame = !!(room?.isOmaha || game?.isOmaha);

  const chipsRecord = room?.roomid && chipsRecordState?.roomid === room.roomid
    ? chipsRecordState.chipsRecords.find((r) => r.id === id)
    : undefined;
  const netProfit = chipsRecord != null ? chipsRecord.chips - chipsRecord.buyIn : undefined;
  const stackBarStyle =
    netProfit === undefined
      ? { background: "linear-gradient(135deg, #ffd700 0%, #ff8c00 100%)" as const }
      : netProfit > 0
        ? { background: "linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)" as const }
        : netProfit < 0
          ? { background: "linear-gradient(135deg, #27ae60 0%, #1e8449 100%)" as const }
          : { background: "linear-gradient(135deg, #ffd700 0%, #ff8c00 100%)" as const };

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

  // All in时播放音效
  useEffect(() => {
    if (user?.isAllIn) {
      soundManager.play('allin');
    }
  }, [user?.isAllIn]);

  // 处理牌型语音播报（非分阶段结算时，避免与 Room 的结算语音重复）
  useEffect(() => {
    if (!user?.shouldShowHand || !user?.handsType) return;
    const isPhased = totalShowdown > 0;
    if (isPhased) return;
    if ("speechSynthesis" in window) {
      const speech = new SpeechSynthesisUtterance(user.handsType);
      speech.lang = "zh-CN";
      window.speechSynthesis.speak(speech);
    }
  }, [user?.shouldShowHand, user?.handsType, totalShowdown]);

  useEffect(() => {
    if (game?.bb != null && seeHandChips > (self?.stack ?? 0)) {
      setSeeHandChips(Math.min(10, Math.max(1, self?.stack ?? 1)));
    }
  }, [game?.bb, self?.stack]);

  // 新一局开始后关闭所有看牌相关弹窗，避免干扰
  useEffect(() => {
    if (!isSettling) setSeeHandPopOpen({});
  }, [isSettling]);

  return (
    <div className={`user flex-column flex-center ${user?.isFoled ? "folded" : ""}`}>
      {/* 当前行动玩家面前：行动中标识 */}
      {isActingUser && !isSettling && (
        <div style={{
          fontSize: 12,
          fontWeight: 'bold',
          color: '#ffd700',
          textShadow: '0 0 8px rgba(255,215,0,0.8)',
          marginBottom: 4,
          padding: '2px 10px',
          borderRadius: 10,
          background: 'rgba(0,0,0,0.6)',
          border: '1px solid rgba(255,215,0,0.5)',
        }}>
          行动中
        </div>
      )}
      <div
        className={`userinfo flex-column flex-center ${!inGame ? "fold" : ""}`}
        style={{
          opacity: user ? (user.isOffline || !user.isReady || user.isFoled) ? 0.5 : 1 : 0.5,
          transition: 'opacity 0.3s ease'
        }}
      >
        <div style={{ position: 'relative', display: 'inline-block', overflow: 'visible' }}>
        {/* 状态指示器 - 头像左上角 */}
        <div style={{ position: 'absolute', top: -4, left: -4, display: 'flex', gap: '2px', zIndex: 10 }}>
          {/* 断线 - 最高优先级，只要有就只显示它 */}
          {user?.isOffline ? (
            <div style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: '#ff4757',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(255, 71, 87, 0.5)',
              border: '2px solid #fff',
            }}>
              <ApiOutlined style={{ fontSize: '14px', color: 'white' }} />
            </div>
          ) : (
            <>
              {/* 正在游戏中 - 显示游戏手柄 */}
              {user?.isInCurrentGame && !user?.isFoled && (
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(102, 126, 234, 0.6)',
                  border: '2px solid #fff',
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ display: 'block' }}>
                    <path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" fill="white"/>
                  </svg>
                </div>
              )}
              {/* 不在游戏中但已准备 - 显示勾 */}
              {!user?.isInCurrentGame && user?.isReady && !user?.isFoled && (
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(76, 175, 80, 0.6)',
                  border: '2px solid #fff',
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ display: 'block' }}>
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="white"/>
                  </svg>
                </div>
              )}
              {/* 挂起（暂时不参与）- 不在游戏中时显示，或在游戏中但点了暂时不参与时与手柄并列 */}
              {(!user?.isInCurrentGame && !user?.isReady) || (user?.isInCurrentGame && !user?.isReady && !user?.isFoled) ? (
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: '#ffa502',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(255, 165, 2, 0.5)',
                  border: '2px solid #fff',
                }}>
                  <CoffeeOutlined style={{ fontSize: '14px', color: 'white' }} />
                </div>
              ) : null}
            </>
          )}
        </div>
        <div className="avatar-container" style={{ transform: 'scale(0.8)', position: 'relative' }}>
        {avatar && avatarImages[avatar] ? (
          <img 
            src={avatarImages[avatar]} 
            alt="头像" 
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              borderRadius: "50%",
            }}
          />
        ) : (
          <img 
            src={avatarImages[getRandomAvatarForBot(id)]} 
            alt="机器人头像" 
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              borderRadius: "50%",
            }}
          />
        )}
        {/* 放弃蒙层 */}
        {user?.isFoled && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundColor: 'rgba(128, 128, 128, 0.6)',
            pointerEvents: 'none',
          }} />
        )}
        {/* 全押蒙层 */}
        {user?.isAllIn && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 0, 0, 0.5)',
            pointerEvents: 'none',
          }} />
        )}
        {/* 赢家头像高亮 - 分阶段结算时等展示完后再显示 */}
        {user?.isWinner && (!usePhasedSettle || settleDone) && (
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
        {/* 牌型显示（非分阶段时在头像下显示） */}
        {user?.shouldShowHand && user?.handsType && !usePhasedSettle && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginTop: '5px',
            padding: '4px 12px',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            borderRadius: '15px',
            color: '#ffd700',
            fontSize: '12px',
            fontWeight: 'bold',
            textShadow: '0 0 10px rgba(255, 215, 0, 0.8)',
            animation: 'handTypeGlow 1.5s ease-in-out infinite alternate',
            whiteSpace: 'nowrap',
            zIndex: 10,
          }}>
            {user.handsType}
          </div>
        )}
        {/* 赢家：金币飞向头像 - 分阶段结算时等展示完后再触发 */}
        {user?.isWinner && user?.profits != null && user.profits >= 0 && (!usePhasedSettle || settleDone) && (() => {
          const coinCount = coinCountFromProfits(user.profits);
          const flyDuration = 1.1;
          const delayStep = flyDuration / coinCount;
          return (
          <div className="winner-coins-fly" style={{
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
        {/* 聊天气泡：头顶显示最近一条消息，5 秒后自动消失 */}
        {roomChatBubbles[id] && (
          <div className="room-chat-bubble" style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            bottom: '100%',
            marginBottom: 6,
          }}>
            <div className="room-chat-bubble-inner">
              {roomChatBubbles[id].text}
            </div>
            <div className="room-chat-bubble-tail" />
          </div>
        )}
        </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'white', textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>
          {/* 结算阶段：眼睛按钮贴昵称左侧，只在结算阶段可申请 */}
          {!isSelf && isSettling && !user?.shouldShowHand && user?.hasCards && user?.isInCurrentGame && self && (
            <Popover
              visible={!!seeHandPopOpen[id]}
              onVisibleChange={(open: boolean) => setSeeHandPopOpen((prev) => ({ ...prev, [id]: open }))}
              trigger="click"
              placement="top"
              getPopupContainer={() => document.body}
              zIndex={10050}
              content={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                  <InputNumber
                    min={1}
                    max={Math.max(1, self.stack ?? 0)}
                    value={seeHandChips}
                    onChange={(v) => setSeeHandChips(v ?? 1)}
                    style={{ width: 80 }}
                    size="small"
                  />
                  <Button
                    type="primary"
                    size="small"
                    icon={<CheckOutlined />}
                    onClick={() => {
                      ws_requestSeeHand(id, seeHandChips);
                      setSeeHandPopOpen((prev) => ({ ...prev, [id]: false }));
                    }}
                    disabled={(self.stack ?? 0) < seeHandChips}
                  />
                </div>
              }
            >
              <Tooltip title="申请看牌">
                <Button
                  type="primary"
                  size="small"
                  icon={<EyeOutlined />}
                  style={{ background: '#1890ff', borderColor: '#1890ff', flexShrink: 0 }}
                />
              </Tooltip>
            </Popover>
          )}
          {nickname}
          {self?.isRoomOwner && !isSelf && (
            <Popconfirm
              title="确认踢出该玩家吗？"
              onConfirm={() => ws_kickUser(id)}
              okText="确定"
              cancelText="取消"
            >
              <Tooltip title="踢出房间">
                <Button
                  size="small"
                  icon={<BootIcon />}
                  style={{
                    flexShrink: 0,
                    padding: 0,
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: "#1c2833",
                    border: "1px solid #00b894",
                    color: "#00b894",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                />
              </Tooltip>
            </Popconfirm>
          )}
        </div>
        <div className="stack" style={{
          ...stackBarStyle,
          borderRadius: "20px",
          padding: "2px 10px",
          fontSize: "12px",
          fontWeight: "bold",
          color: "#333",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        }}>
          <span className="coins">🌟</span>
          <RollingNumber value={stack} style={{ fontSize: "inherit", fontWeight: "inherit" }} />
        </div>
      </div>
      {isActing ? (
        <div>&nbsp;</div>
      ) : (
        <div>&nbsp;</div>
      )}

      <div className="bet" style={{ color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
        {/* 暂时隐藏mini-cards */}
        {/* {user?.isInCurrentGame && (
          <div className={`mini-cards ${user?.isFoled ? 'fold-animation' : ''}`} style={{ position: 'relative', transform: 'none', margin: 0 }}>
            <BeautifulPokerCard 
              size="small" 
              showBack={true} 
              style={{ position: 'relative', left: '0', marginRight: '2px' }} 
            />
            <BeautifulPokerCard 
              size="small" 
              showBack={true} 
              style={{ position: 'relative', left: '0' }} 
            />
          </div>
        )} */}
        {user?.actionName && actionNameToClass[user.actionName] !== 'allin' && (
          <span className={`user-action-indicator ${actionNameToClass[user.actionName] || ''}`}>
            {user.actionName}
          </span>
        )}
        {/* 持久化显示放弃标签 */}
        {user?.isFoled && !user?.actionName && (
          <span className="user-action-indicator fold">
            放弃
          </span>
        )}
        {bet > 0 ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            <span className="coins">🌟</span>
            <RollingNumber value={bet} style={{ fontSize: 'inherit', fontWeight: 'bold' }} />
          </span>
        ) : (
          <div>&nbsp;</div>
        )}
      </div>
      {usePhasedSettle ? (
        (showHolePhase || showMax5Phase || showAsWinner) ? (
          <div className={`card-box card-box-stacked ${showHolePhase ? (isOmahaGame ? "card-box-stacked-omaha4" : "card-box-stacked-2") : ""} ${(showMax5Phase || showAsWinner) ? "card-box-stacked-5" : ""} ${showAsWinner ? "settle-winner-cards" : ""}`}>
            {(showMax5Phase || showAsWinner) && (
              <div
                className={`handstype ${showAsWinner ? "settle-winner-type" : ""}`}
                style={{
                  ...(handTypeRanks[handsTypeToShow || ""] >= 4 ? { color: "#ffd700", textShadow: "0 0 15px rgba(255, 215, 0, 0.8)", animation: "handTypeGlow 1.5s ease-in-out infinite alternate" } : { color: "white", textShadow: "1px 1px 2px rgba(0,0,0,0.8)" }),
                }}
              >
                {handsTypeToShow}
              </div>
            )}
            {(showHolePhase ? (handsToShow || []) : (user?.maxCards || []).slice(0, 5)).map((card, i) => (
              <Poker
                card={card}
                key={card ? `${card.num}${card.suit}-${i}` : i}
                index={i}
                isSelected={true}
                showHand={!!card}
                size="small"
                showShowHandButton={false}
              />
            ))}
          </div>
        ) : null
      ) : showHandsArea ? (
        <div className={`card-box card-box-stacked ${isOmahaGame ? "card-box-stacked-omaha4" : ""}`}>
          {(isOmahaGame ? (handsToShow || []).slice(0, 4) : (handsToShow || [])).map((card, i) => (
            <Poker
              card={card}
              key={`${card ? `${card.num}${card.suit}` : i}`}
              index={i}
              isSelected={false}
              showHand={shouldShowCards}
              size="small"
              showShowHandButton={i === 0 && isSelf && !user?.isAllIn && !revealedForMe}
            />
          ))}
          <div
            className="handstype"
            style={{
              ...(handsTypeToShow && handTypeRanks[handsTypeToShow] >= 4 ? {
                color: '#ffd700',
                textShadow: '0 0 15px rgba(255, 215, 0, 0.8)',
                animation: 'handTypeGlow 1.5s ease-in-out infinite alternate'
              } : {
                color: 'white',
                textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
              })
            }}
          >
            {handsTypeToShow}
          </div>
        </div>
      ) : null}

      <div className="status">
        {user?.isOffline ? (
          <Tooltip title="掉线">
            <div style={{
              background: "#ff4757",
              color: "white",
              borderRadius: "50%",
              width: "24px",
              height: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 8px rgba(255, 71, 87, 0.5)",
            }}>
              <ApiOutlined style={{ fontSize: "14px" }} />
            </div>
          </Tooltip>
        ) : null}
      </div>
      {(() => {
        if (isSettlingCountdown) {
          const el: ReactNode[] = [];
          (["SB", "BB", "D"] as const).forEach((role) => {
            const isCurrent = position === role && nextPositionUserIds[role] !== id;
            const isNext = nextPositionUserIds[role] === id;
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
        return position != "" ? <div className="position">{posComp}</div> : null;
      })()}
      <div className="allin">{user?.isAllIn ? <AllIn /> : null}</div>
    </div>
  );
}
