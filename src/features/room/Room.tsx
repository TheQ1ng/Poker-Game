/* eslint-disable react-hooks/rules-of-hooks */
import { Button, Popconfirm, Tooltip, Modal, message, InputNumber, Progress, Select } from "antd";
import { Card as PokerCard } from "../../ApiType";
import {
  LoginOutlined,
  CoffeeOutlined,
  CaretRightOutlined,
  CheckOutlined,
  PauseOutlined,
  EyeOutlined,
  UserOutlined,
  SoundOutlined,
  AudioMutedOutlined,
  HistoryOutlined,
  InfoCircleOutlined,
  DollarOutlined,
  CloseOutlined,
  MessageOutlined,
  DeleteOutlined,
  SaveOutlined,
  SwapOutlined,
  BugOutlined,
} from "@ant-design/icons";
import { useEffect, useRef, useState, useMemo } from "react";
import { User } from "./User";
import { Owner } from "./Owner";
import { Chat } from "../chat/Chat";
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
  selectPendingSeeHandRequests,
  selectPendingSupportRequests,
  selectSupportPhase,
  clearSupportPhase,
  selectSupportSummary,
  clearSupportSummary,
} from "./roomSlice";
import {
  ws_pauseGame,
  ws_settleTimes,
  ws_startGame,
  ws_userHangup,
  ws_userLeave,
  ws_userWatch,
  ws_settleGame,
  ws_extendActionTime,
  ws_respondSeeHand,
  ws_sendRedPacket,
  ws_openRedPacket,
  ws_requestSupport,
  ws_respondSupport,
  ws_setShortDeck,
  ws_transferRoomOwner,
  ws_repairRoomBalance,
} from "../../app/websocket";
import { Poker } from "./Poker";
import { CountDown } from "./CountDown";
import { ChipsRecord } from "../chipsrecord/ChipsRecord";
import GameHistory from "../gamehistory/GameHistory";
import { Spectators } from "./Spectators";
import { soundManager } from "../../utils/soundManager";
import { selectChipsRecord } from "../chipsrecord/chipsRecordSlice";

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
  const [redPacketSendVisible, setRedPacketSendVisible] = useState(false);
  const [redPacketAmount, setRedPacketAmount] = useState<number>(0);
  const [supportAmounts, setSupportAmounts] = useState<Record<string, number>>({});
  const [supportPhaseRemain, setSupportPhaseRemain] = useState(0);
  const [supportSummaryRemain, setSupportSummaryRemain] = useState(0);
  const [transferOwnerVisible, setTransferOwnerVisible] = useState(false);
  const [transferOwnerTarget, setTransferOwnerTarget] = useState<string>("");

  const roomid = useAppSelector(selectRoomID);
  const users = useAppSelector(selectUsers);
  const room = useAppSelector(selectRoom);
  const self = useAppSelector(selectSelf);
  const chipsRecordState = useAppSelector(selectChipsRecord);
  const serverTimeOffset = useAppSelector(selectServerTimeOffset);
  const game = useAppSelector(selectGame);
  const selectSettleStatus = useAppSelector(getSelectSettleStatus);
  const pendingSeeHandRequests = useAppSelector(selectPendingSeeHandRequests);
  const pendingSupportRequests = useAppSelector(selectPendingSupportRequests);
  const supportPhase = useAppSelector(selectSupportPhase);
  const supportSummary = useAppSelector(selectSupportSummary);
  const isSettling = game?.isSettling || false;
  // 使用服务端时间偏移来计算下一局开始的剩余秒数，避免不同客户端本地时间差异
  const serverNowForNextGame = Date.now() + serverTimeOffset;
  const nextGameTime = Math.floor(
    ((game?.nextGameTime || serverNowForNextGame) - serverNowForNextGame) / 1000
  );
  const cards: PokerCard[] = [...(game?.boardCards || [])];
  const chipsRecords =
    room?.roomid && chipsRecordState?.roomid === room.roomid
      ? chipsRecordState.chipsRecords
      : [];
  const roomBalanceDiff = useMemo(
    () =>
      chipsRecords.reduce((sum, cr) => {
        const total = (Number(cr.chips) || 0) + (Number(cr.overflow) || 0);
        return sum + (Number(cr.buyIn) || 0) - total;
      }, 0),
    [chipsRecords]
  );
  const selfRecord = self?.id ? chipsRecords.find((cr) => cr.id === self.id) : undefined;
  const selfTotalChips = selfRecord
    ? (Number(selfRecord.chips) || 0) + (Number(selfRecord.overflow) || 0)
    : 0;
  const selfProfit = selfTotalChips - (selfRecord?.buyIn || 0);
  const redPacketThresholdMultiple = room?.redPacketConfig?.thresholdMultiple ?? 1;
  const redPacketMaxPercent = room?.redPacketConfig?.maxPercent ?? 30;
  const underwaterUsers = (room?.users || []).filter((u) => {
    if (u.isSpectator) return false;
    if (u.id === self?.id) return false;
    const cr = chipsRecords.find((item) => item.id === u.id);
    return !!cr && ((Number(cr.chips) || 0) + (Number(cr.overflow) || 0) < cr.buyIn);
  });
  const underwaterCount = underwaterUsers.length;
  const minRedPacketAmount = underwaterCount;
  const maxRedPacketAmount = Math.max(
    0,
    Math.min(
      Math.floor((Math.max(0, selfProfit) * redPacketMaxPercent) / 100),
      Math.floor(selfTotalChips)
    )
  );
  const senderThresholdProfit = Math.floor((selfRecord?.buyIn || 0) * redPacketThresholdMultiple);
  const activeRedPacket = room?.redPacket || null;
  const isShortDeckConfigured = !!room?.isShortDeck;
  const seatedPlayerCount = (room?.users || []).filter((u) => !u.isSpectator).length;
  const canEnableShortDeck = !room?.isOmaha && seatedPlayerCount < 7;
  const shortDeckToggleDisabled = !isShortDeckConfigured && !canEnableShortDeck;
  const transferOwnerCandidates = (room?.users || []).filter((u) => u.id !== self?.id);
  const canSendRedPacket =
    !!self &&
    !!selfRecord &&
    !self.isSpectator &&
    !activeRedPacket &&
    (game?.isSettling ?? false) &&
    underwaterCount > 0 &&
    selfProfit >= senderThresholdProfit &&
    maxRedPacketAmount >= minRedPacketAmount;

  const showdownPlayers = useMemo(() => {
    const list = room?.users?.filter((u) => u.shouldShowHand) || [];
    const order = (p: string) => (p === "SB" ? 0 : p === "BB" ? 1 : p === "D" ? 3 : 2);
    return [...list].sort((a, b) => order(a.position || "") - order(b.position || ""));
  }, [room?.users]);
  const showdownOrder = useMemo(() => showdownPlayers.map((u) => u.id), [showdownPlayers]);
  const totalShowdown = showdownPlayers.length;
  const [settleRevealStep, setSettleRevealStep] = useState(0);
  const settleAnimatingRef = useRef(false);
  const [countdownLocked, setCountdownLocked] = useState(false);
  /** 读条等待阶段（胜者展示结束后的 7/12 秒）：用于 SB/BB/D 滑动到下一家；若无人摊牌（全员弃牌决出胜负），直接进入倒计时 */
  const rawIsSettlingCountdown =
    isSettling && (totalShowdown === 0 || settleRevealStep > 2 * totalShowdown);
  const isSettlingCountdown = isSettling && (rawIsSettlingCountdown || countdownLocked);
  useEffect(() => {
    if (!isSettling) {
      setCountdownLocked(false);
      return;
    }
    if (rawIsSettlingCountdown && !countdownLocked) {
      setCountdownLocked(true);
    }
  }, [isSettling, rawIsSettlingCountdown, countdownLocked]);
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
  const isRedPacketSender = !!activeRedPacket && self?.id === activeRedPacket.senderUserId;
  const isRedPacketRecipient =
    !!activeRedPacket && !!self?.id && activeRedPacket.recipientUserIds.includes(self.id);
  const isRedPacketOpenedByMe =
    !!activeRedPacket && !!self?.id && activeRedPacket.openedUserIds.includes(self.id);
  const redPacketWaitMs =
    activeRedPacket?.status === "waiting"
      ? Math.max(0, activeRedPacket.openDeadline - serverNow)
      : 0;
  const redPacketWaitPercent =
    activeRedPacket?.status === "waiting"
      ? Math.max(0, Math.min(100, (redPacketWaitMs / 5000) * 100))
      : 0;
  const redPacketResultMs =
    activeRedPacket?.status === "result"
      ? Math.max(0, activeRedPacket.resultDeadline - serverNow)
      : 0;
  const redPacketResultPercent =
    activeRedPacket?.status === "result"
      ? Math.max(0, Math.min(100, (redPacketResultMs / 3000) * 100))
      : 0;
  const redPacketDetails = (activeRedPacket?.details || [])
    .slice()
    .sort((a, b) => b.amount - a.amount);
  const redPacketPauseActive =
    !!activeRedPacket &&
    isSettlingCountdown &&
    (activeRedPacket.pausedNextGameRemainMs || 0) > 0;
  const pausedNextGameSeconds = redPacketPauseActive
    ? Math.max(0, Math.ceil((activeRedPacket?.pausedNextGameRemainMs || 0) / 1000))
    : 0;

  // 结算阶段：胜者动画结束后的倒计时（用于右上角圆形读条）
  const [settleCountdownTotal, setSettleCountdownTotal] = useState<number | null>(null);
  useEffect(() => {
    if (isSettlingCountdown) {
      if (settleCountdownTotal == null && nextGameTime > 0) {
        setSettleCountdownTotal(nextGameTime);
      }
    } else if (settleCountdownTotal != null) {
      setSettleCountdownTotal(null);
    }
  }, [isSettlingCountdown, nextGameTime, settleCountdownTotal]);
  const settleCountdownLeft = isSettlingCountdown ? Math.max(0, nextGameTime) : 0;
  const settleCountdownTotalSec =
    settleCountdownTotal != null && settleCountdownTotal > 0
      ? settleCountdownTotal
      : settleCountdownLeft > 0
      ? settleCountdownLeft
      : 1;

  // 行动阶段：为了刷新右上角行动倒计时，每秒触发一次重渲染
  useEffect(() => {
    if (!actingUserId || isSettling) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [actingUserId, isSettling]);

  // 结算阶段：为了刷新下一局倒计时圆环，每秒触发一次重渲染
  useEffect(() => {
    if (!isSettling || !game?.nextGameTime) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [isSettling, game?.nextGameTime]);

  useEffect(() => {
    if (!activeRedPacket) return;
    const t = setInterval(() => setTick((n) => n + 1), 200);
    return () => clearInterval(t);
  }, [activeRedPacket?.id, activeRedPacket?.status, activeRedPacket?.openDeadline, activeRedPacket?.resultDeadline]);

  useEffect(() => {
    if (!supportPhase?.isActive) {
      setSupportAmounts({});
      setSupportPhaseRemain(0);
      return;
    }
    const initial = Math.max(0, supportPhase.time || 15);
    setSupportPhaseRemain(initial);
    setSupportAmounts((prev) => {
      const next: Record<string, number> = {};
      supportPhase.targets.forEach((target) => {
        const max = Math.max(0, Math.min(target.maxSupport, supportPhase.myStack));
        if (max <= 0) {
          next[target.id] = 0;
          return;
        }
        const before = prev[target.id];
        next[target.id] = Number.isFinite(before)
          ? Math.max(1, Math.min(max, Number(before)))
          : max;
      });
      return next;
    });
    const startAt = Date.now();
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startAt) / 1000);
      setSupportPhaseRemain(Math.max(0, initial - elapsed));
    }, 200);
    return () => clearInterval(timer);
  }, [supportPhase?.isActive, supportPhase?.time, supportPhase?.myStack, supportPhase?.targets]);

  useEffect(() => {
    if (!supportSummary?.isVisible) {
      setSupportSummaryRemain(0);
      return;
    }
    const duration = Math.max(1, supportSummary.duration || 3);
    setSupportSummaryRemain(duration);
    const startAt = Date.now();
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startAt) / 1000);
      const remain = Math.max(0, duration - elapsed);
      setSupportSummaryRemain(remain);
      if (remain <= 0) {
        dispatch(clearSupportSummary());
      }
    }, 200);
    return () => clearInterval(timer);
  }, [dispatch, supportSummary?.isVisible, supportSummary?.duration]);

  useEffect(() => {
    if (!redPacketSendVisible) return;
    setRedPacketAmount((prev) => {
      if (minRedPacketAmount <= 0) return prev;
      if (prev < minRedPacketAmount || prev > maxRedPacketAmount) {
        return minRedPacketAmount;
      }
      return prev;
    });
  }, [redPacketSendVisible, minRedPacketAmount, maxRedPacketAmount]);

  useEffect(() => {
    if (activeRedPacket && redPacketSendVisible) {
      setRedPacketSendVisible(false);
    }
  }, [activeRedPacket, redPacketSendVisible]);

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

  function handleClearCache() {
    try {
      const token = localStorage.getItem("token");
      const isAdmin = localStorage.getItem("isAdmin");
      const name = localStorage.getItem("name");
      localStorage.clear();
      if (token) {
        localStorage.setItem("token", token);
      }
      if (isAdmin) {
        localStorage.setItem("isAdmin", isAdmin);
      }
      if (name) {
        localStorage.setItem("name", name);
      }
      if ("caches" in window) {
        caches.keys().then((cacheNames) => {
          cacheNames.forEach((cacheName) => {
            caches.delete(cacheName);
          });
        });
      }
      message.success("缓存和本地存储已清除");
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      message.error("清除缓存失败");
      console.error("清除缓存失败:", error);
    }
  }

  async function handleSaveChipsRecord() {
    try {
      const chipsRecordData = chipsRecords.map((record) => {
        const totalChips = (Number(record.chips) || 0) + (Number(record.overflow) || 0);
        return {
          id: record.id,
          username: record.name,
          nickname: record.nickname || record.name,
          chips: totalChips,
          overflow: Number(record.overflow) || 0,
          buyIn: record.buyIn,
          profit: totalChips - record.buyIn,
        };
      });
      const response = await fetch("/admin/save-chips-record", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: localStorage.getItem("token") || "",
        },
        body: JSON.stringify({
          roomId: roomid,
          chipsRecords: chipsRecordData,
        }),
      });

      const data = await response.json();
      if (data.code === 0) {
        message.success("积分榜保存成功");
      } else {
        message.error(data.error || "保存失败");
      }
    } catch (error) {
      message.error("保存积分榜失败");
      console.error("保存积分榜失败:", error);
    }
  }

  return (
    <div
      ref={centerRef}
      style={{
        display: "flex",
        flexDirection: "row",
        flex: 1,
        overflow: "hidden",
        height: "100vh",
        width: "100vw",
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
            <Button
              type={activeTab === 'chat' ? 'primary' : 'default'}
              onClick={() => setActiveTab('chat')}
              icon={<MessageOutlined />}
              style={{
                flex: 1,
                background: activeTab === 'chat' ? "linear-gradient(135deg, #2d5a3d 0%, #1a3d28 100%)" : "rgba(255,255,255,0.1)",
                border: "2px solid rgba(201, 162, 39, 0.5)",
                color: "#fff",
              }}
            >
              聊天
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
            {activeTab === 'chat' && (
              <div style={{ height: "100%", overflow: "auto" }}>
                <Chat />
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
          background: "linear-gradient(145deg, #1a3d28 0%, #0f2518 100%)",
          borderRadius: "60px",
          border: "15px solid #4a2c17",
          boxShadow: "inset 0 0 80px rgba(0,0,0,0.5), 0 10px 30px rgba(0,0,0,0.5)",
        }}
      >
        <Spectators />
        {/* 结算阶段：有人申请看我的手牌时，在被请求者屏幕中央弹出对话框 */}
        {isSettling && self && pendingSeeHandRequests && pendingSeeHandRequests.length > 0 && (
          <div className="see-hand-center-dialog-wrapper">
            {pendingSeeHandRequests.map((req, index) => (
              <div
                key={req.requestId}
                className="see-hand-center-dialog"
                style={{
                  transform: `translate(-50%, -50%) translateY(${-index * 8}px)`,
                }}
              >
                <div className="see-hand-center-dialog-title">看牌请求</div>
                <div className="see-hand-center-dialog-body">
                  <div className="see-hand-center-dialog-text">
                    <strong>{req.fromName}</strong> 申请支付{" "}
                    <span className="see-hand-center-dialog-chips">{req.chips}</span> 欢乐豆查看你的底牌
                  </div>
                  <div className="see-hand-center-dialog-actions">
                    <Button
                      type="primary"
                      size="small"
                      icon={<CheckOutlined />}
                      onClick={() => ws_respondSeeHand(req.requestId, true)}
                      style={{ marginRight: 8 }}
                    >
                      同意
                    </Button>
                    <Button
                      size="small"
                      icon={<CloseOutlined />}
                      onClick={() => ws_respondSeeHand(req.requestId, false)}
                    >
                      拒绝
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {/* 支持阶段：有人申请支持我时，在被支持者屏幕中央弹出对话框 */}
        {self && pendingSupportRequests && pendingSupportRequests.length > 0 && (
          <div className="see-hand-center-dialog-wrapper">
            {pendingSupportRequests.map((req, index) => (
              <div
                key={req.requestId}
                className="see-hand-center-dialog"
                style={{
                  transform: `translate(-50%, -50%) translateY(${-index * 8}px)`,
                }}
              >
                <div className="see-hand-center-dialog-title">🤝 支持请求</div>
                <div className="see-hand-center-dialog-body">
                  <div className="see-hand-center-dialog-text">
                    <strong>{req.fromName}</strong> 请求支持您 <span className="see-hand-center-dialog-chips">{req.amount}</span> 🌟
                    <br />
                    <small>如果您获胜，需分给对方盈利的一部分作为回报</small>
                  </div>
                  <div className="see-hand-center-dialog-actions">
                    <Button
                      type="primary"
                      size="small"
                      icon={<CheckOutlined />}
                      onClick={() => ws_respondSupport(req.requestId, true)}
                      style={{ marginRight: 8 }}
                    >
                      接受
                    </Button>
                    <Button
                      size="small"
                      icon={<CloseOutlined />}
                      onClick={() => ws_respondSupport(req.requestId, false)}
                    >
                      拒绝
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {/* 支持阶段：弃牌玩家选择支持目标 */}
        {supportPhase?.isActive && self?.isFoled && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
          >
            <div
              style={{
                background: "linear-gradient(145deg, #1a3d28 0%, #0f2518 100%)",
                padding: "24px",
                borderRadius: "16px",
                border: "2px solid rgba(201, 162, 39, 0.5)",
                maxWidth: "400px",
                width: "90%",
                boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ color: "#ffd700", marginTop: 0, textAlign: "center", flex: 1 }}>
                  🤝 支持阶段
                </h3>
                {/* 右上角关闭按钮，只是关闭本地弹窗显示 */}
                <Button
                  type="text"
                  size="small"
                  icon={<CloseOutlined />}
                  style={{ color: "#fff" }}
                  onClick={() => {
                    dispatch(clearSupportPhase());
                  }}
                />
              </div>
              {/* 倒计时进度条 */}
              <div style={{ marginBottom: 12 }}>
                <div
                  style={{
                    height: 6,
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.15)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.max(0, Math.min(100, (supportPhaseRemain / 15) * 100))}%`,
                      height: "100%",
                      background: "linear-gradient(90deg, #ffd700, #ff8c00)",
                      transition: "width 0.3s linear",
                    }}
                  />
                </div>
                <div style={{ color: "#fff", fontSize: 12, marginTop: 4, textAlign: "right" }}>
                  剩余 {supportPhaseRemain}s
                </div>
              </div>
              <p style={{ color: "white", textAlign: "center", marginBottom: "16px" }}>
                选择一位玩家并输入支持金额
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {supportPhase.targets.map((target) => {
                  const maxForTarget = Math.max(
                    0,
                    Math.min(target.maxSupport, supportPhase.myStack)
                  );
                  const amount = Math.max(
                    0,
                    Math.min(maxForTarget, supportAmounts[target.id] ?? maxForTarget)
                  );
                  const ratio =
                    target.totalBet > 0
                      ? ((amount / target.totalBet) * 100).toFixed(2)
                      : "0.00";
                  return (
                    <div
                      key={target.id}
                      style={{
                        background: "rgba(255, 255, 255, 0.1)",
                        padding: "12px",
                        borderRadius: "8px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ color: "#ffd700", fontWeight: "bold" }}>{target.name}</div>
                        <div style={{ color: "#aaa", fontSize: "12px", marginBottom: 4 }}>
                          下注: {target.totalBet} | 最多支持: {target.maxSupport}
                        </div>
                        <div style={{ color: "#82f7b3", fontSize: 12, marginBottom: 6 }}>
                          当前占比 {ratio}%（返还公式：赢得筹码 × 占比）
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ color: "#ccc", fontSize: 12 }}>支持金额</span>
                          <InputNumber
                            min={1}
                            max={Math.max(1, maxForTarget)}
                            value={amount > 0 ? amount : undefined}
                            style={{ width: 100 }}
                            size="small"
                            controls={false}
                            disabled={maxForTarget <= 0}
                            onChange={(v) => {
                              const next = Number(v || 0);
                              setSupportAmounts((prev) => ({
                                ...prev,
                                [target.id]:
                                  maxForTarget <= 0
                                    ? 0
                                    : Math.max(1, Math.min(maxForTarget, next)),
                              }));
                            }}
                          />
                          <span style={{ color: "#ffd700", fontSize: 12 }}>🌟 (你当前 {supportPhase.myStack})</span>
                        </div>
                      </div>
                      <div>
                        <Button
                          type="primary"
                          size="small"
                          onClick={() => {
                            if (maxForTarget <= 0) {
                              message.warning("可支持金额不足");
                              return;
                            }
                            const finalAmount = Math.max(1, Math.min(maxForTarget, amount));
                            ws_requestSupport(target.id, finalAmount);
                          }}
                          disabled={supportPhase.myStack <= 0 || maxForTarget <= 0}
                        >
                          支持
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        {supportSummary?.isVisible && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1001,
            }}
          >
            <div
              style={{
                background: "linear-gradient(145deg, #2c1f06 0%, #120d03 100%)",
                padding: "20px 22px",
                borderRadius: "14px",
                border: "2px solid rgba(255, 199, 84, 0.55)",
                maxWidth: "560px",
                width: "92%",
                boxShadow: "0 10px 28px rgba(0,0,0,0.5)",
              }}
            >
              <div style={{ color: "#ffd67e", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
                📋 支持详情（预计）
              </div>
              <div style={{ color: "rgba(255,255,255,0.72)", fontSize: 12, marginBottom: 10 }}>
                预计值按“若被支持者最终获胜”测算，3秒后自动进入下一阶段
              </div>
              <div
                style={{
                  height: 5,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.14)",
                  overflow: "hidden",
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    width: `${Math.max(0, Math.min(100, (supportSummaryRemain / Math.max(1, supportSummary.duration || 3)) * 100))}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #ffda76, #ffa640)",
                    transition: "width 0.25s linear",
                  }}
                />
              </div>
              <div style={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
                {supportSummary.details.length === 0 ? (
                  <div style={{ color: "rgba(255,255,255,0.85)", textAlign: "center", padding: "10px 0" }}>
                    本轮暂无有效支持
                  </div>
                ) : (
                  supportSummary.details.map((item: any) => (
                    <div
                      key={item.targetId}
                      style={{
                        background: "rgba(255,255,255,0.08)",
                        border: "1px solid rgba(255,255,255,0.14)",
                        borderRadius: 10,
                        padding: "10px 12px",
                      }}
                    >
                      <div style={{ color: "#ffe39d", fontWeight: 700, marginBottom: 6 }}>
                        被支持者：{item.targetName}（共支持 {item.totalSupport}）
                      </div>
                      <div style={{ color: "rgba(255,255,255,0.78)", fontSize: 12, marginBottom: 6 }}>
                        其下注 {item.targetTotalBet}，若最终获胜，支持环节预计净{item.estimatedTargetNetIfWin >= 0 ? "赚" : "输"}{Math.abs(item.estimatedTargetNetIfWin)}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {(item.supporters || []).map((s: any) => (
                          <div key={s.supporterId} style={{ color: "rgba(255,255,255,0.92)", fontSize: 12 }}>
                            {s.supporterName} 支持 {s.amount}，预计返还 {s.estimatedReturnIfWin}，预计净{s.estimatedProfitIfWin >= 0 ? "赚" : "输"}{Math.abs(s.estimatedProfitIfWin)}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
        {/* 右上角：行动倒计时 / 结算后倒计时（圆圈引线燃烧样式） */}
        {redPacketPauseActive ? (
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
                background: "linear-gradient(145deg, #3a1010 0%, #1d0a0a 100%)",
                border: "3px solid rgba(255, 172, 74, 0.75)",
                boxShadow: "0 0 20px rgba(255, 143, 31, 0.42), inset 0 0 15px rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              <span
                style={{
                  position: "relative",
                  zIndex: 1,
                  fontSize: 24,
                  filter: "drop-shadow(0 0 5px rgba(255, 223, 173, 0.6))",
                }}
              >
                🧧
              </span>
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#ffe6c4",
                textShadow: "0 0 6px rgba(0, 0, 0, 0.6)",
                padding: "2px 8px",
                borderRadius: 12,
                background: "rgba(0, 0, 0, 0.55)",
                border: "1px solid rgba(255, 172, 74, 0.6)",
              }}
            >
              红包进行中，倒计时暂停（剩 {pausedNextGameSeconds}s）
            </div>
          </div>
        ) : isSettlingCountdown ? (
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
                border: "3px solid rgba(0, 191, 255, 0.7)",
                boxShadow: "0 0 20px rgba(0, 191, 255, 0.5), inset 0 0 15px rgba(0,0,0,0.5)",
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
                  stroke="rgba(40, 60, 80, 0.7)"
                  strokeWidth={4}
                />
                <circle
                  cx={26}
                  cy={26}
                  r={22}
                  fill="none"
                  stroke="url(#settleCountdownGradient)"
                  strokeWidth={4}
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 22}
                  strokeDashoffset={
                    2 * Math.PI * 22 * (1 - settleCountdownLeft / settleCountdownTotalSec)
                  }
                />
                <defs>
                  <linearGradient id="settleCountdownGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#00c3ff" />
                    <stop offset="100%" stopColor="#1affd5" />
                  </linearGradient>
                </defs>
              </svg>
              <span
                style={{
                  position: "relative",
                  zIndex: 1,
                  fontSize: 18,
                  fontWeight: "bold",
                  color: settleCountdownLeft <= 5 ? "#ff6b6b" : "#1affd5",
                  textShadow: "0 0 8px rgba(0, 255, 255, 0.7)",
                }}
              >
                {settleCountdownLeft}
              </span>
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#e0f7ff",
                textShadow: "0 0 6px rgba(0, 0, 0, 0.6)",
                padding: "2px 8px",
                borderRadius: 12,
                background: "rgba(0, 0, 0, 0.55)",
                border: "1px solid rgba(0, 191, 255, 0.5)",
              }}
            >
              下一局倒计时
            </div>
          </div>
        ) : (
          !isSettling &&
          actingUserId && (
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
                    strokeDashoffset={
                      2 * Math.PI * 22 * (1 - actionTimeLeft / actionTotalSeconds)
                    }
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
          )
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
          <div className="roominfo flex-row flex-center" style={{ color: 'white', gap: '8px' }}>
            {/* 房间号显示 */}
            <span style={{
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#ffd700',
              textShadow: '0 0 8px rgba(255, 215, 0, 0.5)',
              marginRight: '4px',
            }}>房间: {roomid}</span>
            <Tooltip title={soundEnabled ? "关闭音效" : "开启音效"}>
                  <Button
                    className="room-action-btn"
                    icon={soundEnabled ? <SoundOutlined /> : <AudioMutedOutlined />}
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
                    onClick={ws_pauseGame}
                  />
                </Tooltip>
              ) : (
                <Tooltip title="开始游戏">
                  <Button
                    className="room-action-btn"
                    type="primary"
                    icon={<CaretRightOutlined />}
                    onClick={ws_startGame}
                  />
                </Tooltip>
              )
            ) : null}
            {/* 结算按钮 - 仅房主可见 */}
            {self?.isRoomOwner && roomid && (
              <Tooltip title="盈利封顶到1999并发放溢出红包（欢乐豆封顶1000，超出计入溢出）">
                <Button
                  className="room-action-btn"
                  type="primary"
                  icon={<DollarOutlined />}
                  onClick={ws_settleGame}
                />
              </Tooltip>
            )}
            {/* 保存积分榜按钮 - 仅房主可见 */}
            {self?.isRoomOwner && roomid && (
              <Tooltip title="保存当前积分榜到数据库">
                <Button
                  className="room-action-btn"
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSaveChipsRecord}
                />
              </Tooltip>
            )}
            {self?.isRoomOwner && roomid && (
              <Popconfirm
                title={
                  roomBalanceDiff === 0
                    ? "当前账目已平，无需修复"
                    : `检测到差异 ${roomBalanceDiff}，是否自动修复并记录日志？`
                }
                okText="立即修复"
                cancelText="取消"
                onConfirm={ws_repairRoomBalance}
                disabled={roomBalanceDiff === 0}
              >
                <Tooltip
                  title={
                    roomBalanceDiff === 0
                      ? "账目已平"
                      : `账不平差异 ${roomBalanceDiff}，点击修复`
                  }
                >
                  <Button
                    className="room-action-btn"
                    danger={roomBalanceDiff !== 0}
                    icon={<BugOutlined />}
                    disabled={roomBalanceDiff === 0}
                  />
                </Tooltip>
              </Popconfirm>
            )}
            {self?.isRoomOwner && roomid && !room?.isOmaha && (
              <Tooltip
                title={
                  isShortDeckConfigured
                    ? "切回长牌（下一局生效）"
                    : canEnableShortDeck
                      ? "切换短牌（下一局生效）"
                      : "人数达到7人时不可切换短牌"
                }
              >
                <Button
                  className="room-action-btn"
                  type={isShortDeckConfigured ? "primary" : "default"}
                  onClick={() => ws_setShortDeck(!isShortDeckConfigured)}
                  disabled={shortDeckToggleDisabled}
                >
                  {isShortDeckConfigured ? "短牌" : "长牌"}
                </Button>
              </Tooltip>
            )}
            {self?.isRoomOwner && roomid && transferOwnerCandidates.length > 0 && (
              <Tooltip title="转移房主给房间内玩家">
                <Button
                  className="room-action-btn"
                  icon={<SwapOutlined />}
                  onClick={() => {
                    const defaultTarget = transferOwnerCandidates[0]?.id || "";
                    setTransferOwnerTarget(defaultTarget);
                    setTransferOwnerVisible(true);
                  }}
                />
              </Tooltip>
            )}
            {canSendRedPacket && (
              <Tooltip
                title={`发拼手气红包（范围 ${minRedPacketAmount}~${maxRedPacketAmount}，上限为盈利 ${redPacketMaxPercent}%）`}
              >
                <Button
                  className="room-action-btn redpacket-send-btn"
                  onClick={() => {
                    setRedPacketAmount(minRedPacketAmount);
                    setRedPacketSendVisible(true);
                  }}
                >
                  🧧
                </Button>
              </Tooltip>
            )}
            {!self?.isSpectator && self?.isReady && (
              <Tooltip title="暂时不参与游戏">
                <Button
                  className="room-action-btn"
                  icon={<CoffeeOutlined />}
                  onClick={ws_userHangup}
                />
              </Tooltip>
            )}
            {/* 观战 / 落座切换：非观战时显示眼睛，观战时显示座位 */}
            {self?.isSpectator ? (
              <Tooltip title="参与游戏（落座）">
                <Button
                  className="room-action-btn"
                  type="primary"
                  icon={<UserOutlined />}
                  onClick={() => ws_userWatch(false)}
                />
              </Tooltip>
            ) : (
              !self?.isReady && (
                <Tooltip title="进入观战模式">
                  <Button
                    className="room-action-btn"
                    icon={<EyeOutlined />}
                    onClick={() => ws_userWatch(true)}
                  />
                </Tooltip>
              )
            )}

            <Tooltip title="清除缓存和本地存储">
              <Button
                className="room-action-btn"
                icon={<DeleteOutlined />}
                onClick={handleClearCache}
              />
            </Tooltip>
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
                <div style={{ width: 100 }}>{/* 结算倒计时读条改为右上角圆形动画，这里留空 */}</div>
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

      {/* 发红包弹窗 */}
      <Modal
        title={<span style={{ color: "#f7d777" }}>👑 转移房主</span>}
        visible={transferOwnerVisible}
        onCancel={() => setTransferOwnerVisible(false)}
        onOk={() => {
          if (!transferOwnerTarget) {
            message.warning("请选择一名玩家");
            return;
          }
          ws_transferRoomOwner(transferOwnerTarget);
          setTransferOwnerVisible(false);
        }}
        okText="确认移交"
        cancelText="取消"
      >
        <div style={{ color: "rgba(255,255,255,0.8)", marginBottom: 10 }}>
          选择房间内一名玩家，房主身份将立即生效。
        </div>
        <Select
          style={{ width: "100%" }}
          value={transferOwnerTarget || undefined}
          onChange={(v) => setTransferOwnerTarget(v)}
          placeholder="请选择目标玩家"
          options={transferOwnerCandidates.map((u) => ({
            value: u.id,
            label: `${u.nickname || u.name}${u.isSpectator ? "（观战）" : ""}`,
          }))}
        />
      </Modal>

      <Modal
        title={<span style={{ color: "#f7d777" }}>🧧 发送拼手气红包</span>}
        visible={redPacketSendVisible}
        onCancel={() => setRedPacketSendVisible(false)}
        onOk={() => {
          if (redPacketAmount < minRedPacketAmount || redPacketAmount > maxRedPacketAmount) {
            message.error(`红包金额需在 ${minRedPacketAmount} ~ ${maxRedPacketAmount} 之间`);
            return;
          }
          ws_sendRedPacket(Math.floor(redPacketAmount));
          setRedPacketSendVisible(false);
        }}
        okText="发送红包"
        cancelText="取消"
        className="redpacket-modal"
      >
        <div className="redpacket-send-desc">
          <div>水上门槛：盈利达到初始筹码 x{redPacketThresholdMultiple}</div>
          <div>可抢人数：{underwaterCount}（当前所有水下玩家）</div>
          <div>红包范围：{minRedPacketAmount} ~ {maxRedPacketAmount}</div>
        </div>
        <div className="redpacket-send-input-row">
          <span>红包金额</span>
          <InputNumber
            min={minRedPacketAmount}
            max={maxRedPacketAmount}
            value={redPacketAmount}
            onChange={(v) => setRedPacketAmount(Number(v || minRedPacketAmount))}
            className="redpacket-amount-input"
          />
          <span>筹码</span>
        </div>
      </Modal>

      {/* 抢红包弹窗（仅水下玩家可见） */}
      <Modal
        visible={!!activeRedPacket && activeRedPacket.status === "waiting" && isRedPacketRecipient}
        footer={null}
        closable={false}
        maskClosable={false}
        className="redpacket-modal"
        centered
      >
        <div className="redpacket-cover">
          <div className="redpacket-cover-icon">🧧</div>
          <div className="redpacket-cover-title">{activeRedPacket?.senderName} 发来拼手气红包</div>
          <div className="redpacket-cover-amount">总额 {activeRedPacket?.totalAmount || 0} 筹码</div>
          {isRedPacketOpenedByMe ? (
            <div className="redpacket-cover-opened">你已打开红包，等待揭晓...</div>
          ) : (
            <Button
              type="primary"
              className="redpacket-open-btn"
              onClick={ws_openRedPacket}
            >
              抢红包
            </Button>
          )}
          <div className="redpacket-progress-label">
            {Math.max(0, Math.ceil(redPacketWaitMs / 1000))}s 后自动开奖
          </div>
          <Progress
            percent={redPacketWaitPercent}
            showInfo={false}
            strokeColor={{ "0%": "#f7d777", "100%": "#d46b08" }}
            trailColor="rgba(255,255,255,0.15)"
          />
        </div>
      </Modal>

      {/* 红包结果弹窗（发送者 + 领取者可见） */}
      <Modal
        visible={
          !!activeRedPacket &&
          activeRedPacket.status === "result" &&
          (isRedPacketSender || isRedPacketOpenedByMe)
        }
        footer={null}
        closable={false}
        maskClosable={false}
        className="redpacket-modal"
        centered
      >
        <div className="redpacket-result">
          <div className="redpacket-result-title">🎉 拼手气红包结果</div>
          <div className="redpacket-result-subtitle">
            {activeRedPacket?.senderName} 发出 {activeRedPacket?.totalAmount || 0} 筹码
          </div>
          <div className="redpacket-result-list">
            {redPacketDetails.map((item) => (
              <div key={item.userId} className="redpacket-result-row">
                <span className="redpacket-result-name">
                  {item.name}
                  {activeRedPacket?.luckiestUserId === item.userId ? " 👑手气王" : ""}
                </span>
                <span className="redpacket-result-amount">
                  +{item.amount}
                  {item.autoOpened ? "（自动）" : ""}
                </span>
              </div>
            ))}
          </div>
          <Progress
            percent={redPacketResultPercent}
            showInfo={false}
            strokeColor={{ "0%": "#f7d777", "100%": "#ffec99" }}
            trailColor="rgba(255,255,255,0.18)"
          />
        </div>
      </Modal>

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
