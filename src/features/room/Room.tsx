/* eslint-disable react-hooks/rules-of-hooks */
import { Button, Popconfirm, Tooltip, Modal, message, InputNumber, Progress, Select, Dropdown, Menu, Input } from "antd";
import html2canvas from "html2canvas";
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
  DownOutlined,
  LogoutOutlined,
  UserAddOutlined,
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
  ws_extendActionTime,
  ws_respondSeeHand,
  ws_sendRedPacket,
  ws_openRedPacket,
  ws_requestSupport,
  ws_respondSupport,
  ws_setShortDeck,
  ws_transferRoomOwner,
  ws_repairRoomBalance,
  ws_revealBoardCard,
  ws_addBot,
  ws_kickUser,
} from "../../app/websocket";
import { Poker } from "./Poker";
import { CountDown } from "./CountDown";
import { ChipsRecord } from "../chipsrecord/ChipsRecord";
import GameHistory from "../gamehistory/GameHistory";
import { Spectators } from "./Spectators";
import { soundManager } from "../../utils/soundManager";
import { selectChipsRecord } from "../chipsrecord/chipsRecordSlice";
import { logout } from "../home/homeSlice";
import { fetchProfile, updateProfile } from "../home/homeAPI";
import { MAX_ROOM_PLAYERS } from "../../ApiType";

const avatarOptions = [
  { filename: "playerIcon.png", img: require("../../assets/playerIcon.png") },
  { filename: "playerIcon (1).png", img: require("../../assets/playerIcon (1).png") },
  { filename: "playerIcon (2).png", img: require("../../assets/playerIcon (2).png") },
  { filename: "playerIcon (3).png", img: require("../../assets/playerIcon (3).png") },
  { filename: "playerIcon (4).png", img: require("../../assets/playerIcon (4).png") },
  { filename: "playerIcon (5).png", img: require("../../assets/playerIcon (5).png") },
  { filename: "playerIcon (6).png", img: require("../../assets/playerIcon (6).png") },
  { filename: "playerIcon (7).png", img: require("../../assets/playerIcon (7).png") },
  { filename: "playerIcon (8).png", img: require("../../assets/playerIcon (8).png") },
];

function Room() {
  const dispatch = useAppDispatch();
  const centerRef = useRef(null);
  const chipsRecordImageRef = useRef<HTMLDivElement>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('history');
  const [, setTick] = useState(0);
  const [disclaimerModalVisible, setDisclaimerModalVisible] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [profileNickname, setProfileNickname] = useState("");
  const [profileAvatar, setProfileAvatar] = useState("");
  const [redPacketSendVisible, setRedPacketSendVisible] = useState(false);
  const [redPacketAmount, setRedPacketAmount] = useState<number>(0);
  const [supportAmounts, setSupportAmounts] = useState<Record<string, number>>({});
  const [supportPhaseRemain, setSupportPhaseRemain] = useState(0);
  const [supportSummaryRemain, setSupportSummaryRemain] = useState(0);
  const [overtimeConfirmVisible, setOvertimeConfirmVisible] = useState(false);
  const [transferOwnerVisible, setTransferOwnerVisible] = useState(false);
  const [transferOwnerTarget, setTransferOwnerTarget] = useState<string>("");
  const [kickUserVisible, setKickUserVisible] = useState(false);
  const [kickUserTarget, setKickUserTarget] = useState<string>("");
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === "undefined" ? 1200 : window.innerWidth,
    height: typeof window === "undefined" ? 800 : window.innerHeight,
  }));

  const roomid = useAppSelector(selectRoomID);
  const users = useAppSelector(selectUsers);
  const seatUsers: (string | undefined)[] = Array(MAX_ROOM_PLAYERS - 1).fill(undefined);
  users.forEach((id, index) => {
    const seatIndex = Math.round((index * seatUsers.length) / users.length);
    seatUsers[seatIndex] = id;
  });
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
  const settleCountdownRemainMs = Math.max(
    0,
    (game?.nextGameTime || 0) - serverNowForNextGame
  );
  const isSettleCountdownActive = isSettling && settleCountdownRemainMs > 0;
  const isWaitingForOwnerStart = isSettling && !isSettleCountdownActive;
  const cards = useMemo<PokerCard[]>(() => [...(game?.boardCards || [])], [game?.boardCards]);
  const displayBoardCards = useMemo<(PokerCard | null)[]>(() => {
    const nextDisplayCards = game?.displayBoardCards || [];
    if (Array.isArray(nextDisplayCards) && nextDisplayCards.length > 0) {
      return [...nextDisplayCards, null, null, null, null, null].slice(0, 5);
    }
    return [...cards, null, null, null, null, null].slice(0, 5);
  }, [cards, game?.displayBoardCards]);
  const chipsRecords = useMemo(
    () =>
      room?.roomid && chipsRecordState?.roomid === room.roomid
        ? chipsRecordState.chipsRecords
        : [],
    [room?.roomid, chipsRecordState?.roomid, chipsRecordState?.chipsRecords]
  );
  const roomBalanceDiff = useMemo(
    () =>
      chipsRecords.reduce((sum, cr) => {
        const total = Number(cr.chips) || 0;
        return sum + (Number(cr.buyIn) || 0) - total;
      }, 0),
    [chipsRecords]
  );
  const selfRecord = self?.id ? chipsRecords.find((cr) => cr.id === self.id) : undefined;
  const selfTotalChips = selfRecord ? (Number(selfRecord.chips) || 0) : 0;
  const selfProfit = selfTotalChips - (selfRecord?.buyIn || 0);
  const redPacketThresholdMultiple = room?.redPacketConfig?.thresholdMultiple ?? 1;
  const redPacketMaxPercent = room?.redPacketConfig?.maxPercent ?? 30;
  const underwaterUsers = (room?.users || []).filter((u) => {
    if (u.isSpectator) return false;
    if (u.id === self?.id) return false;
    const cr = chipsRecords.find((item) => item.id === u.id);
    return !!cr && ((Number(cr.chips) || 0) < cr.buyIn);
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
  const kickUserCandidates = (room?.users || []).filter((u) => u.id !== self?.id);
  const isMobile = viewport.width <= 768;
  const isPortraitMobile = isMobile && viewport.height > viewport.width;
  const sidebarPanelWidth = isMobile
    ? Math.max(280, Math.min(360, Math.floor(viewport.width * 0.88)))
    : 600;
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
  const revealableBoardStartIndex = cards.length;
  const canRevealHiddenBoardCards = isSettleCountdownActive && revealableBoardStartIndex < 5;
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
    if (!isSettleCountdownActive || !room?.users?.length) return { SB: null, BB: null, D: null };
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
  }, [isSettleCountdownActive, room?.users, users]);
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
  const overtimeCost = Math.max(0, Number(room?.overtimeCost) || 0);
  const currentChips = Math.max(0, Number(self?.stack) || 0);
  const canExtendActionTime =
    !!isMyTurnToAct && !isSettling && actionTimeLeft > 0 && addTimeRemaining > 0 && currentChips >= overtimeCost;
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
  const settleCountdownLeft = isSettleCountdownActive
    ? Math.max(0, Math.ceil(settleCountdownRemainMs / 1000))
    : 0;
  useEffect(() => {
    if (isSettleCountdownActive) {
      if (settleCountdownTotal == null && settleCountdownLeft > 0) {
        setSettleCountdownTotal(settleCountdownLeft);
      }
    } else if (settleCountdownTotal != null) {
      setSettleCountdownTotal(null);
    }
  }, [isSettleCountdownActive, settleCountdownLeft, settleCountdownTotal]);
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

  useEffect(() => {
    if (overtimeConfirmVisible && !canExtendActionTime) {
      setOvertimeConfirmVisible(false);
    }
  }, [overtimeConfirmVisible, canExtendActionTime]);

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
      setViewport({ width, height });
      
      // 移动端使用不同的计算方式
      if (width < 768) {
        const isMobilePortraitNow = height > width;
        const targetWidth = isMobilePortraitNow ? 480 : 420;
        const targetHeight = isMobilePortraitNow ? 760 : 320;
        setZoom(Math.min(width / targetWidth, height / targetHeight, 1));
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

  async function handleOpenProfile() {
    try {
      const profile = await fetchProfile();
      const nickname = profile.data?.nickname || "";
      const avatar = profile.data?.avatar || "";
      setProfileNickname(nickname || localStorage.getItem("nickname") || "");
      setProfileAvatar(avatar || localStorage.getItem("avatar") || "");
      localStorage.setItem("nickname", nickname);
      localStorage.setItem("avatar", avatar);
    } catch (error) {
      setProfileNickname(localStorage.getItem("nickname") || "");
      setProfileAvatar(localStorage.getItem("avatar") || "");
      message.error(error instanceof Error ? error.message : "读取个人资料失败");
    }
    setProfileModalVisible(true);
  }

  async function handleSaveProfile() {
    try {
      await updateProfile(profileNickname, profileAvatar);
      localStorage.setItem("nickname", profileNickname);
      localStorage.setItem("avatar", profileAvatar);
      setProfileModalVisible(false);
      message.success("个人资料保存成功");
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleSaveChipsRecord() {
    const imageClipboard = navigator.clipboard as (Clipboard & {
      write?: (items: object[]) => Promise<void>;
    }) | undefined;
    const ClipboardItemConstructor = (window as Window & {
      ClipboardItem?: new (items: Record<string, Promise<Blob>>) => object;
    }).ClipboardItem;
    const clipboardWriter = imageClipboard?.write?.bind(imageClipboard);
    const clipboardSupported =
      window.isSecureContext &&
      !!clipboardWriter &&
      typeof ClipboardItemConstructor === "function";
    let clipboardWrite: Promise<void> | null = null;
    let resolveImage: ((blob: Blob) => void) | undefined;
    let rejectImage: ((error: Error) => void) | undefined;

    if (clipboardWriter && ClipboardItemConstructor && chipsRecordImageRef.current) {
      const imageBlob = new Promise<Blob>((resolve, reject) => {
        resolveImage = resolve;
        rejectImage = reject;
      });
      try {
        clipboardWrite = clipboardWriter([
          new ClipboardItemConstructor({ "image/png": imageBlob }),
        ]);
      } catch (error) {
        clipboardWrite = Promise.reject(error);
      }

      html2canvas(chipsRecordImageRef.current, {
        backgroundColor: "#103522",
        scale: 2,
        logging: false,
      })
        .then(
          (canvas) =>
            new Promise<Blob>((resolve, reject) => {
              canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error("积分榜图片生成失败"));
              }, "image/png");
            })
        )
        .then((blob) => resolveImage?.(blob))
        .catch((error: unknown) =>
          rejectImage?.(error instanceof Error ? error : new Error(String(error)))
        );
    }

    try {
      const chipsRecordData = chipsRecords.map((record) => {
        const totalChips = Number(record.chips) || 0;
        return {
          id: record.id,
          username: record.name,
          nickname: record.nickname || record.name,
          chips: totalChips,
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
        if (!clipboardSupported || !clipboardWrite) {
          message.warning("积分榜已保存，但当前浏览器不支持复制图片到剪贴板");
          return;
        }
        try {
          await clipboardWrite;
          message.success("积分榜已保存，图片已复制，可直接粘贴发送");
        } catch (error) {
          console.error("复制积分榜图片失败:", error);
          message.warning("积分榜已保存，但复制图片失败，请检查浏览器剪贴板权限");
        }
      } else {
        message.error(data.error || "保存失败");
      }
    } catch (error) {
      message.error("保存积分榜失败");
      console.error("保存积分榜失败:", error);
    }
  }

  const roomOwnerActions = self?.isRoomOwner ? (
    <div className="room-owner-actions">
      {room?.isGaming ? (
        <Tooltip title="下一场暂停游戏">
          <Button className="room-action-btn" icon={<PauseOutlined />} onClick={ws_pauseGame} />
        </Tooltip>
      ) : (
        <Tooltip title="开始游戏">
          <Button className="room-action-btn" type="primary" icon={<CaretRightOutlined />} onClick={ws_startGame} />
        </Tooltip>
      )}
      {roomid && (
        <Tooltip title="保存当前积分榜到数据库">
          <Button className="room-action-btn" type="primary" icon={<SaveOutlined />} onClick={handleSaveChipsRecord} />
        </Tooltip>
      )}
      {roomid && (
        <Tooltip title={(room?.users.length || 0) >= MAX_ROOM_PLAYERS ? "房间已满" : "添加布局测试机器人"}>
          <Button
            className={`room-action-btn ${(room?.users.length || 0) >= MAX_ROOM_PLAYERS ? "room-action-btn-disabled" : ""}`}
            icon={<UserAddOutlined />}
            aria-disabled={(room?.users.length || 0) >= MAX_ROOM_PLAYERS}
            onClick={() => {
              if ((room?.users.length || 0) >= MAX_ROOM_PLAYERS) return;
              ws_addBot(roomid);
            }}
          />
        </Tooltip>
      )}
      {kickUserCandidates.length > 0 && (
        <Tooltip title="踢出房间玩家">
          <Button
            className="room-action-btn"
            icon={<DeleteOutlined />}
            onClick={() => {
              setKickUserTarget(kickUserCandidates[0].id);
              setKickUserVisible(true);
            }}
          />
        </Tooltip>
      )}
      {roomid && (
        <Popconfirm
          title={roomBalanceDiff === 0 ? "当前账目已平，无需修复" : `检测到差异 ${roomBalanceDiff}，是否自动修复并记录日志？`}
          okText="立即修复"
          cancelText="取消"
          onConfirm={ws_repairRoomBalance}
          disabled={roomBalanceDiff === 0}
        >
          <Tooltip title={roomBalanceDiff === 0 ? "账目已平" : `账不平差异 ${roomBalanceDiff}，点击修复`}>
            <Button
              className={`room-action-btn room-balance-btn ${roomBalanceDiff !== 0 ? "room-balance-btn-unbalanced" : "room-balance-btn-balanced"}`}
              icon={<BugOutlined />}
            />
          </Tooltip>
        </Popconfirm>
      )}
      {roomid && !room?.isOmaha && (
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
            className={`room-action-btn room-deck-toggle ${shortDeckToggleDisabled ? "room-action-btn-disabled" : ""}`}
            type={isShortDeckConfigured ? "primary" : "default"}
            aria-disabled={shortDeckToggleDisabled}
            onClick={() => {
              if (shortDeckToggleDisabled) return;
              ws_setShortDeck(!isShortDeckConfigured);
            }}
          >
            {isShortDeckConfigured ? "短牌" : "长牌"}
          </Button>
        </Tooltip>
      )}
      {roomid && transferOwnerCandidates.length > 0 && (
        <Tooltip title="转移房主给房间内玩家">
          <Button
            className="room-action-btn"
            icon={<SwapOutlined />}
            onClick={() => {
              setTransferOwnerTarget(transferOwnerCandidates[0]?.id || "");
              setTransferOwnerVisible(true);
            }}
          />
        </Tooltip>
      )}
    </div>
  ) : null;

  const roomTopActions = (
    <div className="room-top-actions flex-row" style={{ color: "white", gap: 8 }}>
      <span className="room-id-chip">房间: {roomid}</span>
      <Tooltip title={soundEnabled ? "关闭音效" : "开启音效"}>
        <Button
          className="room-action-btn"
          icon={soundEnabled ? <SoundOutlined /> : <AudioMutedOutlined />}
          onClick={async () => {
            await soundManager.init().catch((err) => console.warn("Sound init failed:", err));
            const newState = !soundEnabled;
            setSoundEnabled(newState);
            soundManager.setEnabled(newState);
            if (newState) soundManager.playButton();
          }}
        />
      </Tooltip>
      {canSendRedPacket && (
        <Tooltip title={`发拼手气红包（范围 ${minRedPacketAmount}~${maxRedPacketAmount}，上限为盈利 ${redPacketMaxPercent}%）`}>
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
          <Button className="room-action-btn" icon={<CoffeeOutlined />} onClick={ws_userHangup} />
        </Tooltip>
      )}
      {self?.isSpectator ? (
        <Tooltip title="参与游戏（落座）">
          <Button className="room-action-btn" type="primary" icon={<UserOutlined />} onClick={() => ws_userWatch(false)} />
        </Tooltip>
      ) : (
        !self?.isReady && (
          <Tooltip title="进入观战模式">
            <Button className="room-action-btn" icon={<EyeOutlined />} onClick={() => ws_userWatch(true)} />
          </Tooltip>
        )
      )}
      <Tooltip title="免责声明">
        <Button
          className="room-action-btn"
          icon={<InfoCircleOutlined />}
          onClick={() => setDisclaimerModalVisible(true)}
        />
      </Tooltip>
      <Popconfirm
        title="如果在游戏中，将会自动放弃。确认离开？"
        okText="确定离开"
        cancelText="留下"
        onConfirm={ws_userLeave}
        onCancel={() => setShowConfirm(false)}
        visible={showConfirm}
      >
        <Tooltip title="退出房间">
          <Button className="room-action-btn" icon={<LoginOutlined />} onClick={() => setShowConfirm(true)} />
        </Tooltip>
      </Popconfirm>
    </div>
  );

  const accountMenu = (
    <Menu className="user-menu room-account-menu">
      <Menu.Item key="profile" onClick={handleOpenProfile}>
        <UserOutlined /> 个人资料
      </Menu.Item>
      <Menu.Item key="clearCache" onClick={handleClearCache}>
        <DeleteOutlined /> 清除缓存
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item key="logout" danger onClick={() => dispatch(logout())}>
        <LogoutOutlined /> 注销
      </Menu.Item>
    </Menu>
  );

  return (
    <div
      className="room-root"
      ref={centerRef}
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        overflow: "hidden",
        height: "100dvh",
        width: "100vw",
        padding: 0,
      }}
    >
      <header className="room-site-header">
        <div className="room-site-brand">🌟 欢乐积分王</div>
        <div className="room-header-controls">
          {roomTopActions}
          {roomOwnerActions}
        </div>
        <Dropdown overlay={accountMenu} trigger={["click"]} placement="bottomRight">
          <button className="room-site-account" type="button">
            <span className="room-site-account-name">
              {localStorage.getItem("nickname") || self?.nickname || self?.name || localStorage.getItem("name")}
            </span>
            <DownOutlined />
          </button>
        </Dropdown>
      </header>
      {/* 左侧边栏 */}
      <div
        className="room-sidebar"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: sidebarVisible ? sidebarPanelWidth : 0,
          backgroundColor: "#1a1a1a",
          borderRight: "2px solid rgba(201, 162, 39, 0.5)",
          boxShadow: "0 0 20px rgba(0,0,0,0.5)",
          transition: "width 0.3s ease-in-out",
          zIndex: 99,
          overflow: "hidden",
        }}
      >
        <div className="room-sidebar-content" style={{ padding: isMobile ? 12 : 20, height: "100%", display: "flex", flexDirection: "column" }}>
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
        className="sidebar-btn room-sidebar-toggle"
        style={{
          position: "absolute",
          left: sidebarVisible ? sidebarPanelWidth + 10 : 10,
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

      {/* 牌桌区域 */}
      <div
        className="card room-main-card"
        style={{
          flex: 1,
          position: "relative",
          margin: "0 auto",
          background: "radial-gradient(ellipse at center, #1b4a30 0%, #123b26 65%, #0d2a1b 100%)",
          borderRadius: 0,
          border: 0,
          boxShadow: "inset 0 0 80px rgba(0,0,0,0.28)",
        }}
      >
        <div ref={chipsRecordImageRef} className="chips-record-image-capture" aria-hidden="true">
          <div className="chips-record-image-title">房间积分榜</div>
          <table>
            <thead>
              <tr>
                <th>玩家</th>
                <th>欢乐豆</th>
                <th>初始</th>
                <th>积分</th>
              </tr>
            </thead>
            <tbody>
              {chipsRecords.map((record) => {
                const chips = Number(record.chips) || 0;
                const profit = chips - record.buyIn;
                return (
                  <tr key={record.id}>
                    <td>{record.nickname || record.name}</td>
                    <td>{chips}</td>
                    <td>{record.buyIn}</td>
                    <td className={profit >= 0 ? "positive" : "negative"}>
                      {profit > 0 ? "+" : ""}{profit}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
        ) : isSettleCountdownActive ? (
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
        ) : isWaitingForOwnerStart ? (
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
                background: "linear-gradient(145deg, #102018 0%, #08120d 100%)",
                border: "3px solid rgba(255, 215, 0, 0.65)",
                boxShadow: "0 0 20px rgba(255, 215, 0, 0.28), inset 0 0 15px rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              <CaretRightOutlined style={{ color: "#ffd700", fontSize: 24 }} />
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#fff3bf",
                textShadow: "0 0 6px rgba(0, 0, 0, 0.6)",
                padding: "2px 8px",
                borderRadius: 12,
                background: "rgba(0, 0, 0, 0.55)",
                border: "1px solid rgba(255, 215, 0, 0.45)",
              }}
            >
              等待房主发牌
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
              {canExtendActionTime && (
                <Button
                  type="primary"
                  size="small"
                  onClick={() => setOvertimeConfirmVisible(true)}
                  style={{
                    fontSize: 12,
                    height: 28,
                    paddingLeft: 10,
                    paddingRight: 10,
                    background: "linear-gradient(135deg, #2d5a3d 0%, #1a3d28 100%)",
                    border: "1px solid rgba(201, 162, 39, 0.5)",
                  }}
                >
                  +45s ({addTimeRemaining})
                </Button>
              )}
            </div>
          )
        )}
        <div
          className="room-stage"
          style={{
            display: "flex",
            flexDirection: "column",
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
            width: `${100/zoom}%`,
            height: `${100/zoom}%`,
          }}
        >
          {/* 玩家布局：根据人数均匀分布到固定座位，避免少人数时挤在一侧 */}
          <div className="room-seats-layout flex1 flex-row">
            {/* 左侧玩家（1个） */}
            <div className="room-seat-side flex1 flex-column flex-center" style={{ maxWidth: isPortraitMobile ? '86px' : isMobile ? '110px' : '150px' }}>
              {seatUsers[0] && (
                <User
                  id={seatUsers[0]}
                  key={seatUsers[0]}
                  settleRevealStep={settleRevealStep}
                  showdownOrder={showdownOrder}
                  totalShowdown={totalShowdown}
                  isActingUser={actingUserId === seatUsers[0]}
                  isSettlingCountdown={isSettlingCountdown}
                  isSettleCountdownActive={isSettleCountdownActive}
                  nextPositionUserIds={nextPositionUserIds}
                />
              )}
            </div>
            
            {/* 中间区域：牌桌中心和上方玩家 */}
            <div className="room-table-center flex3 flex-column">
              {/* 固定五个上方座位，玩家数量变化时不挤动其他座位 */}
              <div className="room-top-seats flex1 flex-row">
                {Array.from({ length: 5 }, (_, index) => {
                  const id = seatUsers[index + 1];
                  return (
                    <div className="room-seat-slot" key={`seat-${index + 1}`}>
                      {id ? (
                        <User
                          id={`${id}`}
                          key={id}
                          settleRevealStep={settleRevealStep}
                          showdownOrder={showdownOrder}
                          totalShowdown={totalShowdown}
                          isActingUser={actingUserId === id}
                          isSettlingCountdown={isSettlingCountdown}
                          isSettleCountdownActive={isSettleCountdownActive}
                          nextPositionUserIds={nextPositionUserIds}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
              
              {/* 牌桌中心 */}
              <div className="room-center-area flex2 flex-column flex-center">
                <div className="room-center-content">
                  <div className="boards flex-row flex-center">
                    {displayBoardCards.map((card, i) => {
                      const isRevealSlot =
                        canRevealHiddenBoardCards && i >= revealableBoardStartIndex;
                      return (
                        <div
                          key={`${card ? `${card.num}${card.suit}` : "hidden"}-${i}`}
                          className={`board-card-slot ${isRevealSlot ? "board-card-slot-reveal" : ""}`}
                        >
                          <Poker
                            card={card}
                            isSelected={true}
                            animation={card ? (i >= revealableBoardStartIndex ? "flip" : "deal") : "none"}
                            showShowHandButton={false}
                          />
                          {isRevealSlot && !card ? (
                            <Button
                              type="primary"
                              size="small"
                              className="board-card-reveal-btn"
                              onClick={() => {
                                soundManager.playButton();
                                ws_revealBoardCard(i);
                              }}
                              style={{
                                position: "absolute",
                                left: "50%",
                                top: "50%",
                                transform: "translate(-50%, -50%)",
                                zIndex: 3,
                                whiteSpace: "nowrap",
                                padding: "0 8px",
                                borderRadius: 12,
                                fontSize: 12,
                                background: "linear-gradient(135deg, #2d5a3d 0%, #1a3d28 100%)",
                                border: "1px solid rgba(201, 162, 39, 0.7)",
                                boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
                              }}
                            >
                              查看
                            </Button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  <div className="room-pot-row">
                    <div className="pots">
                      <span>总积分</span>
                      <strong>🌟{game?.pots || 0}</strong>
                    </div>
                    <div className="room-center-disclaimer">
                      <p>健康游戏，适度娱乐</p>
                      <p>本项目仅供朋友间训练</p>
                      <p>请勿用于商业用途</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* 右侧上下两个固定座位 */}
            <div className="room-seat-side room-seat-side-right flex1 flex-column flex-center" style={{ maxWidth: isPortraitMobile ? '86px' : isMobile ? '110px' : '150px' }}>
              {[seatUsers[6], seatUsers[7]].map((id) => id ? (
                <User
                  id={`${id}`}
                  key={id}
                  settleRevealStep={settleRevealStep}
                  showdownOrder={showdownOrder}
                  totalShowdown={totalShowdown}
                  isActingUser={actingUserId === id}
                  isSettlingCountdown={isSettlingCountdown}
                  isSettleCountdownActive={isSettleCountdownActive}
                  nextPositionUserIds={nextPositionUserIds}
                />
              ) : null)}
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
          <div className="room-owner-area flex1">
            <Owner
              zoom={zoom}
              settleRevealStep={settleRevealStep}
              showdownOrder={showdownOrder}
              totalShowdown={totalShowdown}
              isSettlingCountdown={isSettlingCountdown}
              isSettleCountdownActive={isSettleCountdownActive}
              settleCountdownLeft={settleCountdownLeft}
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
        title={<span style={{ color: "#f7d777" }}>踢出房间玩家</span>}
        visible={kickUserVisible}
        onCancel={() => setKickUserVisible(false)}
        onOk={() => {
          if (!kickUserTarget) {
            message.warning("请选择要踢出的玩家");
            return;
          }
          ws_kickUser(kickUserTarget);
          setKickUserVisible(false);
        }}
        okText="确认踢出"
        cancelText="取消"
      >
        <div style={{ color: "rgba(255,255,255,0.8)", marginBottom: 10 }}>
          选择一名玩家并确认踢出房间。
        </div>
        <Select
          showSearch
          optionFilterProp="label"
          style={{ width: "100%" }}
          value={kickUserTarget || undefined}
          onChange={(id) => setKickUserTarget(id)}
          placeholder="请选择玩家"
          options={kickUserCandidates.map((u) => ({
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

      <Modal
        title={<span style={{ color: "#ffd700" }}>👤 个人资料</span>}
        visible={profileModalVisible}
        onCancel={() => setProfileModalVisible(false)}
        footer={null}
        width={450}
        centered
        className="room-profile-modal"
      >
        <div className="room-profile-form">
          <label>
            用户名
            <Input disabled value={localStorage.getItem("name") || ""} />
          </label>
          <label>
            玩家昵称
            <Input
              placeholder="请输入昵称，不填则显示用户名"
              value={profileNickname}
              onChange={(event) => setProfileNickname(event.target.value)}
              maxLength={20}
            />
          </label>
          <div>
            <div className="room-profile-label">选择头像</div>
            <div className="room-profile-avatars">
              {avatarOptions.map((avatar) => (
                <button
                  key={avatar.filename}
                  type="button"
                  className={profileAvatar === avatar.filename ? "selected" : ""}
                  onClick={() => setProfileAvatar(avatar.filename)}
                  aria-label={`选择头像 ${avatar.filename}`}
                >
                  <img src={avatar.img} alt="" />
                </button>
              ))}
            </div>
          </div>
          <div className="room-profile-actions">
            <Button onClick={() => setProfileModalVisible(false)}>取消</Button>
            <Button type="primary" onClick={handleSaveProfile}>保存</Button>
          </div>
        </div>
      </Modal>

      <style>{`
        .overtime-confirm-modal .ant-modal-content {
          background: linear-gradient(180deg, #1d3d2b 0%, #102017 100%);
          color: #fff;
          border: 1px solid rgba(255, 215, 0, 0.18);
        }
        .overtime-confirm-modal .ant-modal-header,
        .overtime-confirm-modal .ant-modal-footer {
          background: transparent;
          border-color: rgba(255, 255, 255, 0.12);
        }
        .overtime-confirm-modal .ant-modal-body {
          background: transparent;
          color: #fff;
        }
        .overtime-confirm-modal .ant-modal-title {
          color: #fff;
        }
      `}</style>

      <Modal
        visible={overtimeConfirmVisible}
        title={<span style={{ color: "#fff" }}>确认加时</span>}
        onOk={() => {
          setOvertimeConfirmVisible(false);
          ws_extendActionTime();
        }}
        onCancel={() => setOvertimeConfirmVisible(false)}
        okText="确认"
        cancelText="取消"
        okButtonProps={{
          style: { background: "#2d5a3d", borderColor: "#2d5a3d", color: "#fff" },
        }}
        cancelButtonProps={{
          style: {
            background: "rgba(255,255,255,0.08)",
            borderColor: "rgba(255,255,255,0.18)",
            color: "#fff",
          },
        }}
        centered
        destroyOnClose
        maskClosable={false}
        className="overtime-confirm-modal"
        style={{ top: 220 }}
        bodyStyle={{
          background: "linear-gradient(180deg, #1d3d2b 0%, #102017 100%)",
          color: "#fff",
        }}
      >
        <div style={{ color: "#fff", lineHeight: 1.7 }}>
          确认支付 {overtimeCost} 欢乐豆加时45s吗
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
          <p>
            源码：{" "}
            <a
              href="https://github.com/TheQ1ng/Poker-Game"
              target="_blank"
              rel="noreferrer"
              style={{ color: "#69b1ff" }}
            >
              GitHub Poker-Game
            </a>
          </p>
        </div>
      </Modal>
    </div>
  );
}

export default Room;
