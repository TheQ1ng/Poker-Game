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
import { useEffect, useRef, useState } from "react";
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
  const roomid = useAppSelector(selectRoomID);
  const users = useAppSelector(selectUsers) || [];
  const room = useAppSelector(selectRoom);
  const self = useAppSelector(selectSelf);
  const game = useAppSelector(selectGame);
  const selectSettleStatus = useAppSelector(getSelectSettleStatus);
  const isSettling = game?.isSettling || false;
  const nextGameTime = Math.floor(
    ((game?.nextGameTime || Date.now()) - Date.now()) / 1000
  );
  const cards: PokerCard[] = [...(game?.boardCards || [])];

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
          width: sidebarVisible ? 500 : 0,
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
          <Tabs activeKey={activeTab} onChange={setActiveTab} tabPosition="left" style={{ flex: 1 }}>
              <Tabs.TabPane tab={<span style={{ color: activeTab === 'history' ? '#d4af37' : '#fff' }}><HistoryOutlined /> 战况</span>} key="history">
                <div style={{ height: "100%", padding: 10, overflow: "auto" }}>
                  <GameHistory />
                </div>
              </Tabs.TabPane>
              <Tabs.TabPane tab={<span style={{ color: activeTab === 'chips' ? '#d4af37' : '#fff' }}><DollarOutlined /> 积分</span>} key="chips">
                <div style={{ height: "100%", padding: 10, overflow: "auto" }}>
                  <ChipsRecord />
                </div>
              </Tabs.TabPane>
          </Tabs>
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
          left: sidebarVisible ? 510 : 10,
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
                onClick={() => {
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
            {/* 添加机器人按钮 - 仅房主可见 */}
            {self?.isRoomOwner && roomid && (
              <Tooltip title="添加机器人">
                <Button
                  className="room-action-btn"
                  icon={<UserAddOutlined />}
                  onClick={() => ws_addBot(roomid)}
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
              title="如果在游戏中，将会自动弃牌。确认离开？"
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
                <User id={`${users[0]}`} key={users[0]} />
              )}
            </div>
            
            {/* 中间区域：牌桌中心和上方玩家 */}
            <div className="flex3 flex-column">
              {/* 上方玩家（对面，数量比两边多） */}
              <div className="flex1 flex-row" style={{ justifyContent: 'space-around', padding: '0 20px' }}>
                {users.slice(1, users.length - 1).map((id) => (
                  <User id={`${id}`} key={id} />
                ))}
              </div>
              
              {/* 牌桌中心 */}
              <div className="flex2 flex-column flex-center">
                <div style={{ width: 100 }}>
                  {isSettling ? (
                    <CountDown time={nextGameTime} total={10} />
                  ) : (
                    <div>&nbsp;</div>
                  )}
                </div>
                <div className="boards flex-row flex-center">
                  {[...cards, null, null, null, null, null]
                    .splice(0, 5)
                    .map((card, i) => (
                      <Poker
                        card={card}
                        key={`${card ? `${card.num}${card.suit}` : i}`}
                        isSelected={true}
                        animation={card ? "deal" : "none"}
                      />
                    ))}
                </div>
                <div className="pots" style={{
                  background: "linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.2) 100%)",
                  borderRadius: "20px",
                  padding: "10px 20px",
                  border: "2px solid rgba(255, 215, 0, 0.3)",
                  marginBottom: "20px",
                }}>
                  <span style={{
                    fontSize: "12px",
                    color: "rgba(255, 255, 255, 0.7)",
                    textTransform: "uppercase",
                    letterSpacing: "2px",
                    marginRight: "10px",
                  }}>底池</span>
                  <span style={{
                    fontSize: "24px",
                    fontWeight: "bold",
                    color: "#ffd700",
                    textShadow: "0 0 10px rgba(255, 215, 0, 0.5)",
                  }}>${game?.pots || 0}</span>
                </div>
              </div>
            </div>
            
            {/* 右侧玩家（1个） */}
            <div className="flex1 flex-column flex-center" style={{ maxWidth: '150px' }}>
              {users.length > 1 && (
                <User id={`${users[users.length - 1]}`} key={users[users.length - 1]} />
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
            <Owner zoom={zoom} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Room;
