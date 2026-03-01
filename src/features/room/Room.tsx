import { Button, Input, message, Popconfirm, Tooltip, Modal, Tabs } from "antd";
import { Card as PokerCard } from "../../ApiType";
import {
  LoginOutlined,
  CopyOutlined,
  CoffeeOutlined,
  CaretRightOutlined,
  CheckOutlined,
  PauseOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  SoundOutlined,
  AudioMutedOutlined,
  HistoryOutlined,
  BarChartOutlined,
  UserAddOutlined,
  InfoCircleOutlined,
  DollarOutlined,
} from "@ant-design/icons";
import { useEffect, useRef, useState, useMemo } from "react";
import { User } from "./User";
import { Owner } from "./Owner";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import {
  selectSelf,
  selectRoomID,
  selectUsers,
  selectGame,
  selectRoom,
  getSelectSettleStatus,
  setSelectSettleTimes,
  selectServerTimeOffset,
} from "./roomSlice";
import {
  ws_pauseGame,
  ws_settleTimes,
  ws_startGame,
  ws_userHangup,
  ws_userLeave,
  ws_userReady,
  ws_userWatch,
  ws_addBot,
  ws_kickUser,
  ws_settleGame,
  ws_extendActionTime,
} from "../../app/websocket";
import { Poker } from "./Poker";
import { CountDown } from "./CountDown";
import { ChipsRecord } from "../chipsrecord/ChipsRecord";
import GameHistory from "../gamehistory/GameHistory";
import { Spectators } from "./Spectators";
import { soundManager } from "../../utils/soundManager";

function Room() {
  const dispatch = useAppDispatch();
  const centerRef = useRef(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('history');
  const [, setTick] = useState(0);
  const [disclaimerModalVisible, setDisclaimerModalVisible] = useState(false);
  const roomid = useAppSelector(selectRoomID);
  const users = useAppSelector(selectUsers) || [];
  const room = useAppSelector(selectRoom);
  const self = useAppSelector(selectSelf);
  const serverTimeOffset = useAppSelector(selectServerTimeOffset);
  const game = useAppSelector(selectGame);
  const selectSettleStatus = useAppSelector(getSelectSettleStatus);
  const isSettling = game?.isSettling || false;
  const nextGameTime = Math.floor(
    ((game?.nextGameTime || Date.now()) - Date.now()) / 1000
  );
  const cards: PokerCard[] = [...(game?.boardCards || [])];

  const showdownPlayers = useMemo(() => {
    const list = room?.users?.filter((u) => u.shouldShowHand) || [];
    const order = (p: string) => (p === "SB" ? 0 : p === "BB" ? 1 : p === "D" ? 3 : 2);
    return [...list].sort((a, b) => order(a.position || "") - order(b.position || ""));
  }, [room?.users]);
  const showdownOrder = useMemo(() => showdownPlayers.map((u) => u.id), [showdownPlayers]);
  const totalShowdown = showdownPlayers.length;
  const [settleRevealStep, setSettleRevealStep] = useState(0);
  const settleAnimatingRef = useRef(false);
  /** 读条等待阶段（胜者展示结束后的 8/13 秒）：用于 SB/BB/D 滑动到下一家 */
  const isSettlingCountdown = isSettling && totalShowdown > 0 && settleRevealStep > 2 * totalShowdown;
  const nextPositionUserIds = useMemo(() => {
    if (!isSettlingCountdown || !room?.users?.length) return { SB: null, BB: null, D: null };
    const orderedIds = users as string[];
    const n = orderedIds.length;
    if (n === 0) return { SB: null, BB: null, D: null };
    const getNext = (role: "SB" | "BB" | "D"): string | null => {
      const current = room.users.find((u) => u.position === role);
      if (!current) return null;
      const idx = orderedIds.indexOf(current.id);
      if (idx === -1) return null;
      return orderedIds[(idx + 1) % n];
    };
    return { SB: getNext("SB"), BB: getNext("BB"), D: getNext("D") };
  }, [isSettlingCountdown, room?.users, users]);
  useEffect(() => {
    if (!isSettling) {
      settleAnimatingRef.current = false;
      setSettleRevealStep(0);
      return;
    }
    if (totalShowdown === 0) return;
    if (settleAnimatingRef.current) return; // 结算动画进行中，不因 room 更新而重启
    settleAnimatingRef.current = true;
    setSettleRevealStep(0);
    const n = totalShowdown;
    const maxStep = 2 * n + 1;
    const HOLE_AND_MAX5_MS = 2500;  // 每玩家：两张牌 2.5s，五张牌 2.5s
    const WINNER_PHASE_MS = 3500;   // 选出胜者 3.5s
    let timeoutId: ReturnType<typeof setTimeout>;
    const scheduleNext = (s: number) => {
      if (s >= maxStep) return;
      const delay = s === 2 * n ? WINNER_PHASE_MS : HOLE_AND_MAX5_MS;
      timeoutId = setTimeout(() => {
        const next = s + 1;
        setSettleRevealStep(next);
        if (next < maxStep) scheduleNext(next);
      }, delay);
    };
    scheduleNext(0);
    return () => clearTimeout(timeoutId);
  }, [isSettling, totalShowdown]);
  const prevSettleStepRef = useRef(-1);
  useEffect(() => {
    if (!isSettling || totalShowdown === 0) return;
    const step = settleRevealStep;
    const prev = prevSettleStepRef.current;
    prevSettleStepRef.current = step;
    if (step === 2 * totalShowdown && prev < 2 * totalShowdown) {
      const winner = room?.users?.find((u) => u.isWinner);
      if (winner?.handsType && "speechSynthesis" in window) {
        const u = new SpeechSynthesisUtterance("Winner! " + winner.handsType);
        u.lang = "zh-CN";
        window.speechSynthesis.speak(u);
      }
      return;
    }
    if (step > 0 && step % 2 === 1) {
      const playerIndex = (step - 1) / 2;
      const u = showdownPlayers[playerIndex];
      if (u?.handsType && "speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(u.handsType);
        utterance.lang = "zh-CN";
        window.speechSynthesis.speak(utterance);
      }
    }
  }, [isSettling, totalShowdown, settleRevealStep, showdownPlayers, room?.users]);

  const actingUserId = game?.acting;
  const actingUser = room?.users?.find((u) => u.id === actingUserId);
  const serverNow = Date.now() + serverTimeOffset;
  const actionTimeLeft = actingUser
    ? Math.max(0, Math.floor(((actingUser.actionEndTime || 0) - serverNow) / 1000))
    : 0;
  const actionStart = actingUser?.actionStartTime ?? (actingUser?.actionEndTime ?? 0) - 30000;
  const actionTotalSeconds = actingUser
    ? Math.max(1, Math.floor(((actingUser.actionEndTime || 0) - actionStart) / 1000))
    : 30;
  const isMyTurnToAct = !!actingUserId && self?.id === actingUserId;
  const addTimeRemaining = isMyTurnToAct ? Math.max(0, 3 - (self?.addTimeUsed ?? 0)) : 0;

  useEffect(() => {
    if (!actingUserId || isSettling) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [actingUserId, isSettling]);

  function setSettleTimes(times: number) {
    ws_settleTimes(times);
    dispatch(setSelectSettleTimes(false));
  }

  useEffect(() => {
    function handleResize() {
      const minWidth = 1200;
      const minHeight = 600;
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      // 移动端使用不同的计算方式
      if (width < 768) {
        // 手机端：自适应缩放
        setZoom(Math.min(width / 400, height / 300, 1));
      } else if (width < 1024) {
        // iPad
        setZoom(Math.min(width / 900, height / 600, 1));
      } else {
        // 桌面端
        setZoom(Math.min(width / minWidth, height / minHeight));
      }
    }
    window.addEventListener("resize", handleResize);
    handleResize();
  }, []);

  return (
    <div
      ref={centerRef}
      style={{
        display: "flex",
        flexDirection: "row",
        flex: 1,
        overflow: "hidden",
        height: "100vh",
        padding: "10px",
      }}
    >
      {/* 左侧边栏 */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: sidebarVisible ? 600 : 0,
          backgroundColor: "#1a1a1a",
          borderRight: "2px solid rgba(201, 162, 39, 0.5)",
          boxShadow: "0 0 20px rgba(0,0,0,0.5)",
          transition: "width 0.3s ease-in-out",
          zIndex: 99,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: 20, height: "100%", display: "flex", flexDirection: "column" }}>
          <h2 style={{ color: "#fff", marginBottom: 20 }}>游戏信息</h2>
          
          {/* 切换按钮 */}
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <Button
              type={activeTab === 'history' ? 'primary' : 'default'}
              onClick={() => setActiveTab('history')}
              icon={<HistoryOutlined />}
              style={{
                flex: 1,
                background: activeTab === 'history' ? "linear-gradient(135deg, #2d5a3d 0%, #1a3d28 100%)" : "rgba(255,255,255,0.1)",
                border: "2px solid rgba(201, 162, 39, 0.5)",
                color: "#fff",
              }}
            >
              战况
            </Button>
            <Button
              type={activeTab === 'chips' ? 'primary' : 'default'}
              onClick={() => setActiveTab('chips')}
              icon={<DollarOutlined />}
              style={{
                flex: 1,
                background: activeTab === 'chips' ? "linear-gradient(135deg, #2d5a3d 0%, #1a3d28 100%)" : "rgba(255,255,255,0.1)",
                border: "2px solid rgba(201, 162, 39, 0.5)",
                color: "#fff",
              }}
            >
              积分
            </Button>
          </div>
          
          {/* 内容区域 */}
          <div style={{ flex: 1, overflow: "hidden" }}>
            {activeTab === 'history' && (
              <div style={{ height: "100%", overflow: "auto" }}>
                <GameHistory />
              </div>
            )}
            {activeTab === 'chips' && (
              <div style={{ height: "100%", overflow: "auto" }}>
                <ChipsRecord />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 左上角信息按钮 */}
      <Button
        type="primary"
        icon={<InfoCircleOutlined />}
        onClick={() => setSidebarVisible(!sidebarVisible)}
        className="sidebar-btn"
        style={{
          position: "absolute",
          left: sidebarVisible ? 610 : 10,
          top: "10px",
          zIndex: 100,
          borderRadius: "30px",
          boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
          background: "linear-gradient(135deg, #2d5a3d 0%, #1a3d28 100%)",
          border: "2px solid rgba(201, 162, 39, 0.5)",
          transition: "left 0.3s ease-in-out",
        }}
      >
      </Button>

      {/* 免责声明按钮 */}
      <Button
        type="default"
        icon={<InfoCircleOutlined />}
        onClick={() => setDisclaimerModalVisible(true)}
        style={{
          position: "absolute",
          right: "10px",
          top: "10px",
          zIndex: 100,
          borderRadius: "30px",
          boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
          background: "linear-gradient(135deg, #2d5a3d 0%, #1a3d28 100%)",
          border: "2px solid rgba(201, 162, 39, 0.5)",
          color: "#fff",
        }}
      >
      </Button>

      {/* 牌桌区域 */}
      <div
        className="card"
        style={{
          flex: 1,
          position: "relative",
          margin: "0 auto",
          maxWidth: "1400px",
          background: "linear-gradient(145deg, #1a3d28 0%, #0f2518 100%)",
          borderRadius: "60px",
          border: "15px solid #4a2c17",
          boxShadow: "inset 0 0 80px rgba(0,0,0,0.5), 0 10px 30px rgba(0,0,0,0.5)",
        }}
      >
        <Spectators />
        {/* 右上角：行动倒计时（圆圈引线燃烧样式）+ 当前玩家 +30s 按钮 */}
        {!isSettling && actingUserId && (
          <div
            style={{
              position: "absolute",
              top: 14,
              right: 14,
              zIndex: 50,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
            }}
          >
            <div
              className="action-countdown-circle"
              style={{
                width: 58,
                height: 58,
                borderRadius: "50%",
                background: "linear-gradient(145deg, #1a252f 0%, #0d1117 100%)",
                border: "3px solid rgba(255, 140, 0, 0.6)",
                boxShadow: "0 0 20px rgba(255, 140, 0, 0.4), inset 0 0 15px rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              <svg
                width={52}
                height={52}
                style={{ position: "absolute", transform: "rotate(-90deg)" }}
                viewBox="0 0 52 52"
              >
                <circle
                  cx={26}
                  cy={26}
                  r={22}
                  fill="none"
                  stroke="rgba(80, 60, 40, 0.5)"
                  strokeWidth={4}
                />
                <circle
                  cx={26}
                  cy={26}
                  r={22}
                  fill="none"
                  stroke="url(#actionCountdownGradient)"
                  strokeWidth={4}
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 22}
                  strokeDashoffset={2 * Math.PI * 22 * (1 - actionTimeLeft / actionTotalSeconds)}
                />
                <defs>
                  <linearGradient id="actionCountdownGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ff8c00" />
                    <stop offset="100%" stopColor="#ff4500" />
                  </linearGradient>
                </defs>
              </svg>
              <span
                style={{
                  position: "relative",
                  zIndex: 1,
                  fontSize: 18,
                  fontWeight: "bold",
                  color: actionTimeLeft <= 5 ? "#ff6b6b" : "#ffd700",
                  textShadow: "0 0 8px rgba(255, 215, 0, 0.6)",
                }}
              >
                {actionTimeLeft}
              </span>
            </div>
            {isMyTurnToAct && addTimeRemaining > 0 && (
              <Button
                type="primary"
                size="small"
                onClick={ws_extendActionTime}
                style={{
                  fontSize: 12,
                  height: 28,
                  paddingLeft: 10,
                  paddingRight: 10,
                  background: "linear-gradient(135deg, #2d5a3d 0%, #1a3d28 100%)",
                  border: "1px solid rgba(201, 162, 39, 0.5)",
                }}
              >
                +30s ({addTimeRemaining})
              </Button>
            )}
          </div>
        )}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
            width: `${100/zoom}%`,
            height: `${100/zoom}%`,
          }}
        >
          <div className="roominfo flex-row flex-center" style={{ color: 'white' }}>
            <Input className="room-id-input" style={{ width: 90 }} value={roomid} readOnly />
            <Tooltip title="复制房间ID">
              <Button
                className="room-action-btn"
                icon={<CopyOutlined />}
                style={{ marginRight: 10 }}
                onClick={() => {
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(roomid || "");
                    message.success("复制成功");
                  } else {
                    message.error("无法获取剪切板权限，请手动复制");
                  }
                }}
              />
            </Tooltip>
            <Tooltip title={soundEnabled ? "关闭音效" : "开启音效"}>
                  <Button
                    className="room-action-btn"
                    icon={soundEnabled ? <SoundOutlined /> : <AudioMutedOutlined />}
                    style={{ marginRight: 10 }}
                    onClick={async () => {
                      // 确保音效管理器已经初始化
                      await soundManager.init().catch(err => console.warn('Sound init failed:', err));
                      
                      const newState = !soundEnabled;
                      setSoundEnabled(newState);
                      soundManager.setEnabled(newState);
                      if (newState) {
                        soundManager.playButton();
                      }
                    }}
                  />
                </Tooltip>
            {self?.isRoomOwner ? (
              room?.isGaming ? (
                <Tooltip title="下一场暂停游戏">
                  <Button
                    className="room-action-btn"
                    icon={<PauseOutlined />}
                    style={{ marginRight: 10 }}
                    onClick={ws_pauseGame}
                  />
                </Tooltip>
              ) : (
                <Tooltip title="开始游戏">
                  <Button
                    className="room-action-btn"
                    type="primary"
                    icon={<CaretRightOutlined />}
                    style={{ marginRight: 10 }}
                    onClick={ws_startGame}
                  />
                </Tooltip>
              )
            ) : null}
            {/* 结算按钮 - 仅房主可见 */}
            {self?.isRoomOwner && roomid && (
              <Tooltip title="结算游戏">
                <Button
                  className="room-action-btn"
                  type="primary"
                  icon={<DollarOutlined />}
                  onClick={ws_settleGame}
                />
              </Tooltip>
            )}
            {!self?.isSpectator ? (
              self?.isReady ? (
                <Tooltip title="暂时不参与游戏">
                  <Button
                    className="room-action-btn"
                    icon={<CoffeeOutlined />}
                    style={{ marginRight: 10 }}
                    onClick={ws_userHangup}
                  />
                </Tooltip>
              ) : (
                <Tooltip title="准备">
                  <Button
                    className="room-action-btn"
                    type="primary"
                    icon={<CheckOutlined />}
                    style={{ marginRight: 10 }}
                    onClick={ws_userReady}
                  />
                </Tooltip>
              )
            ) : null}
            {!self?.isReady ? (
              !self?.isSpectator ? (
                <Tooltip title="进入观战模式">
                  <Button
                    className="room-action-btn"
                    icon={<EyeOutlined />}
                    style={{ marginRight: 10 }}
                    onClick={() => ws_userWatch(true)}
                  />
                </Tooltip>
              ) : (
                <Tooltip title="参与游戏">
                  <Button
                    className="room-action-btn"
                    type="primary"
                    icon={<EyeInvisibleOutlined />}
                    style={{ marginRight: 10 }}
                    onClick={() => ws_userWatch(false)}
                  />
                </Tooltip>
              )
            ) : null}

            <Popconfirm
              title="如果在游戏中，将会自动放弃。确认离开？"
              okText="确定离开"
              cancelText="留下"
              onConfirm={() => ws_userLeave()}
              onCancel={() => setShowConfirm(false)}
              visible={showConfirm}
            >
              <Tooltip title="退出房间">
                <Button
                  className="room-action-btn"
                  icon={<LoginOutlined />}
                  onClick={() => {
                    setShowConfirm(true);
                  }}
                />
              </Tooltip>
            </Popconfirm>
          </div>
          {/* 玩家布局：围着桌子的三个面坐一圈，根据人数动态分配 */}
          <div className="flex1 flex-row">
            {/* 左侧玩家（1个） */}
            <div className="flex1 flex-column flex-center" style={{ maxWidth: '150px' }}>
              {users.length > 0 && (
                <User
                  id={`${users[0]}`}
                  key={users[0]}
                  settleRevealStep={settleRevealStep}
                  showdownOrder={showdownOrder}
                  totalShowdown={totalShowdown}
                  isActingUser={actingUserId === users[0]}
                  isSettlingCountdown={isSettlingCountdown}
                  nextPositionUserIds={nextPositionUserIds}
                />
              )}
            </div>
            
            {/* 中间区域：牌桌中心和上方玩家 */}
            <div className="flex3 flex-column">
              {/* 上方玩家（对面，数量比两边多） */}
              <div className="flex1 flex-row" style={{ justifyContent: 'space-around', padding: '0 20px' }}>
                {users.slice(1, users.length - 1).map((id) => (
                  <User
                    id={`${id}`}
                    key={id}
                    settleRevealStep={settleRevealStep}
                    showdownOrder={showdownOrder}
                    totalShowdown={totalShowdown}
                    isActingUser={actingUserId === id}
                    isSettlingCountdown={isSettlingCountdown}
                    nextPositionUserIds={nextPositionUserIds}
                  />
                ))}
              </div>
              
              {/* 牌桌中心 */}
              <div className="flex2 flex-column flex-center">
                <div style={{ width: 100 }}>
                  {isSettling ? (
                    <CountDown time={nextGameTime} total={13} />
                  ) : (
                    <div>&nbsp;</div>
                  )}
                </div>
                <div className="boards flex-row flex-center">
                  {[...cards, null, null, null, null, null]
                    .splice(0, 5)
                    .map((card, i) => {
                      let isSelected = true;
                      return (
                        <Poker
                          card={card}
                          key={`${card ? `${card.num}${card.suit}` : i}`}
                          isSelected={isSelected}
                          animation={card ? "deal" : "none"}
                        />
                      );
                    })}
                </div>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  width: "100%",
                  maxWidth: "400px",
                  marginBottom: "20px",
                }}>
                  {/* 左侧总积分区域 */}
                  <div className="pots" style={{
                    background: "linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.2) 100%)",
                    borderRadius: "20px",
                    padding: "10px 20px",
                    border: "2px solid rgba(255, 215, 0, 0.3)",
                  }}>
                    <span style={{
                      fontSize: "12px",
                      color: "rgba(255, 255, 255, 0.7)",
                      textTransform: "uppercase",
                      letterSpacing: "2px",
                      marginRight: "10px",
                    }}>总积分</span>
                    <span style={{
                      fontSize: "24px",
                      fontWeight: "bold",
                      color: "#ffd700",
                      textShadow: "0 0 10px rgba(255, 215, 0, 0.5)",
                    }}>🌟{game?.pots || 0}</span>
                  </div>
                  
                  {/* 右侧免责声明内容 */}
                  <div style={{
                    textAlign: "right",
                    maxWidth: "150px",
                    fontSize: "10px",
                    color: "#fff",
                    lineHeight: 1.4,
                  }}>
                    <p>健康游戏，适度娱乐</p>
                    <p>本项目仅供朋友间训练</p>
                    <p>请勿用于商业用途</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* 右侧玩家（1个） */}
            <div className="flex1 flex-column flex-center" style={{ maxWidth: '150px' }}>
              {users.length > 1 && (
                <User
                  id={`${users[users.length - 1]}`}
                  key={users[users.length - 1]}
                  settleRevealStep={settleRevealStep}
                  showdownOrder={showdownOrder}
                  totalShowdown={totalShowdown}
                  isActingUser={actingUserId === users[users.length - 1]}
                  isSettlingCountdown={isSettlingCountdown}
                  nextPositionUserIds={nextPositionUserIds}
                />
              )}
            </div>
          </div>
          {selectSettleStatus ? (
            <div style={{ margin: "auto", padding: "20px 0" }}>
              <div>
                请选择发牌次数
                <span style={{ width: 100 }}>
                  <CountDown time={30} total={30} />
                </span>
              </div>
              <div>
                <Button
                  type="primary"
                  style={{ marginRight: 10 }}
                  onClick={() => setSettleTimes(1)}
                >
                  发一次
                </Button>
                <Button
                  type="primary"
                  style={{ marginRight: 10 }}
                  onClick={() => setSettleTimes(2)}
                >
                  发两次
                </Button>
                <Button
                  type="primary"
                  style={{ marginRight: 10 }}
                  onClick={() => setSettleTimes(3)}
                >
                  发三次
                </Button>
                <Button
                  type="primary"
                  style={{ marginRight: 10 }}
                  onClick={() => setSettleTimes(4)}
                >
                  发四次
                </Button>
              </div>
            </div>
          ) : null}
          <div className="flex1">
            <Owner
              zoom={zoom}
              settleRevealStep={settleRevealStep}
              showdownOrder={showdownOrder}
              totalShowdown={totalShowdown}
              isSettlingCountdown={isSettlingCountdown}
              nextPositionUserIds={nextPositionUserIds}
            />
          </div>
        </div>
      </div>

      {/* 免责声明Modal */}
      <Modal
        title={<span style={{ color: "#c9a227" }}>免责声明</span>}
        visible={disclaimerModalVisible}
        onCancel={() => setDisclaimerModalVisible(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setDisclaimerModalVisible(false)}>
            我知道了
          </Button>
        ]}
        style={{
          borderRadius: "10px",
          backgroundColor: "#1a1a1a",
          color: "#fff",
        }}
        bodyStyle={{
          backgroundColor: "#1a1a1a",
          color: "#fff",
        }}
      >
        <div style={{ lineHeight: 1.6 }}>
          <p>健康游戏，适度娱乐</p>
          <p>本项目仅供朋友间训练提高思考能力，请勿用于任何商业用途</p>
          <p>游戏中的积分仅用于训练目的，不代表真实货币价值</p>
          <p>请合理安排游戏时间，避免过度沉迷</p>
          <p>本游戏不含任何赌博元素，请勿将游戏内容与实际赌博行为联系</p>
          <p>如有任何问题或建议，请联系开发者</p>
        </div>
      </Modal>
    </div>
  );
}

export default Room;
