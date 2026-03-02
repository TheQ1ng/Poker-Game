import {
  Input,
  InputNumber,
  Button,
  Card,
  Dropdown,
  Menu,
  Modal,
} from "antd";
import Tabs from "antd/lib/tabs";
import { DownOutlined, PlusOutlined, KeyOutlined, HistoryOutlined, LogoutOutlined, SearchOutlined, UserOutlined } from "@ant-design/icons";
import { useEffect, useState, useRef } from "react";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import {
  createRoomAsync,
  joinRoomAsync,
  fetchRoomsAsync,
  selectStatus,
} from "./createRoomSlice";
import { logout } from "../home/homeSlice";
import { RoomInfo, updateProfile, fetchProfile } from "../home/homeAPI";
import { RecentGameRecords } from "./RecentGameRecords";
import "./CreateRoom.css";

const style = { padding: "8px 0" };

// 九宫格数字键盘组件 - 输入4位自动加入
function NumberPad({ onComplete }: { onComplete: (value: string) => void }) {
  const [value, setValue] = useState("");
  const timeoutRef = useRef<NodeJS.Timeout>();

  const handlePress = (num: number) => {
    if (value.length < 4) {
      const newValue = value + num;
      setValue(newValue);
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // 输入4位自动提交
      if (newValue.length === 4) {
        timeoutRef.current = setTimeout(() => {
          onComplete(newValue);
        }, 300);
      }
    }
  };

  const handleDelete = () => {
    setValue(value.slice(0, -1));
  };

  const handleClear = () => {
    setValue("");
  };

  const numbers = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
    ["C", 0, "⌫"],
  ];

  return (
    <div className="number-pad-container">
      <div className="number-display">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`digit-box ${value[i] ? "filled" : ""}`}
          >
            {value[i]}
          </div>
        ))}
      </div>
      
      <div className="number-pad">
        {numbers.map((row, rowIndex) => (
          <div key={rowIndex} className="number-row">
            {row.map((num) => (
              <button
                key={num}
                className={`number-key ${num === "C" || num === "⌫" ? "function-key" : ""}`}
                onClick={() => {
                  if (num === "C") {
                    handleClear();
                  } else if (num === "⌫") {
                    handleDelete();
                  } else {
                    handlePress(num as number);
                  }
                }}
              >
                {num}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function CreateRoom() {
  const dispatch = useAppDispatch();

  const [smallBlind, setSmallBlind] = useState(1);
  const [buyIn, setBuyIn] = useState(200);
  const [reBuyLimit, setReBuyLimit] = useState(10);
  const [isShortDeck, setIsShortDeck] = useState(false);
  const [isOmaha, setIsOmaha] = useState(false);
  const [roomid, setRoomID] = useState("");
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [profileNickname, setProfileNickname] = useState("");
  const [profileAvatar, setProfileAvatar] = useState("");
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [activeTab, setActiveTab] = useState("create");
  const status = useAppSelector(selectStatus);

  // 切换标签时获取房间列表
  useEffect(() => {
    if (activeTab === "find") {
      dispatch(fetchRoomsAsync()).then((action) => {
        if (fetchRoomsAsync.fulfilled.match(action)) {
          setRooms(action.payload.rooms);
        }
      });
    }
  }, [activeTab, dispatch]);

  useEffect(() => {
    setBuyIn(smallBlind * 200);
  }, [smallBlind]);

  // 页面加载时获取用户资料
  useEffect(() => {
    fetchProfile().then((profile) => {
      localStorage.setItem("avatar", profile.data?.avatar || "");
      localStorage.setItem("nickname", profile.data?.nickname || "");
      localStorage.setItem("avatar", profile.data?.avatar || "");
    }).catch(() => {});
  }, []);

  const handleJoinRoom = (id: string) => {
    setRoomID(id);
    dispatch(joinRoomAsync(id));
  };

  // 打开个人资料弹窗
  const handleOpenProfile = async () => {
    try {
      const profile = await fetchProfile();
      const nickname = profile.data?.nickname || "";
      const avatar = profile.data?.avatar || "";
      // 优先使用服务器返回的值，否则使用 localStorage 备选
      localStorage.setItem("avatar", avatar);
      setProfileAvatar(avatar || localStorage.getItem("avatar") || "");
      setProfileNickname(nickname || localStorage.getItem("nickname") || "");
      // 保存到 localStorage 供游戏房间使用
      localStorage.setItem("nickname", nickname);
      localStorage.setItem("avatar", avatar);
      setProfileModalVisible(true);
    } catch {
      setProfileNickname(localStorage.getItem("nickname") || "");
      setProfileAvatar(localStorage.getItem("avatar") || "");
    }
  };
  // 保存个人资料
  const handleSaveProfile = async () => {
    try {
      await updateProfile(profileNickname, profileAvatar);
      // 保存到 localStorage 供其他地方使用
      localStorage.setItem("nickname", profileNickname);
  // 玩家头像选项 - 使用静态导入
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

      localStorage.setItem("avatar", profileAvatar);
      setProfileModalVisible(false);
    } catch (error) {
      console.error("保存资料失败", error);
    }
  };

  // 玩家头像选项 - 使用静态导入
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

  // 下拉菜单包含游戏记录和注销
  const userMenu = (
    <Menu className="user-menu">
      <Menu.Item key="profile" onClick={handleOpenProfile}>
        <UserOutlined /> 个人资料
      </Menu.Item>
      <Menu.Item key="history" onClick={() => setHistoryModalVisible(true)}>
        <HistoryOutlined /> 最近游戏记录
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item key="logout" danger>
        <a onClick={() => dispatch(logout())}>
          <LogoutOutlined /> 注销
        </a>
      </Menu.Item>
    </Menu>
  );

  return (
    <div className="poker-home-container">
      {/* 顶部用户信息栏 */}
      <div className="poker-home-header">
        <div className="poker-table-logo">🌟 欢乐积分王</div>
        <Dropdown
          overlay={userMenu}
          trigger={['click']}
        >
          <a className="user-dropdown">
            <span className="username">{localStorage["name"]}</span>
            <DownOutlined />
          </a>
        </Dropdown>
      </div>

      {/* 主内容区 - 扑克牌桌面风格 */}
      <div className="poker-home-content">
        <div className="poker-table-surface">
          <Tabs 
            activeKey={activeTab}
            onChange={setActiveTab}
            centered 
            className="poker-tabs"
          >
            <Tabs.TabPane tab={<span><PlusOutlined /> 创建</span>} key="create">
              <Card className="home-card create-room-card">
                <div className="poker-form-group">
                  <span className="label">小弟</span>
                  <InputNumber
                    min={1}
                    value={smallBlind}
                    onChange={(v) => setSmallBlind(v!)}
                    className="poker-input blind-input"
                  />
                  <span className="divider">/</span>
                  <span className="label">大哥</span>
                  <InputNumber
                    disabled={true}
                    min={1}
                    value={smallBlind * 2}
                    className="poker-input blind-input"
                  />
                </div>
                <div className="poker-form-group">
                  <span className="label">初始</span>
                  <InputNumber
                    min={1}
                    value={buyIn}
                    onChange={(v) => setBuyIn(v!)}
                    className="poker-input buyin-input"
                  />
                </div>
                <div className="poker-form-group">
                  <span className="label">低于</span>
                  <InputNumber
                    min={1}
                    value={reBuyLimit}
                    onChange={(v) => setReBuyLimit(v!)}
                    className="poker-input rebuy-input"
                  />
                  <span className="label-text">大哥允许重买</span>
                </div>
                <div className="poker-form-group">
                  <label style={{ display: "flex", alignItems: "center", cursor: "pointer", margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={isShortDeck}
                      onChange={(e) => {
                        const v = e.target.checked;
                        setIsShortDeck(v);
                        if (v) setIsOmaha(false);
                      }}
                      style={{ marginRight: 6 }}
                    />
                    <span className="label-text">短</span>
                  </label>
                </div>
                <div className="poker-form-group">
                  <label style={{ display: "flex", alignItems: "center", cursor: "pointer", margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={isOmaha}
                      onChange={(e) => {
                        const v = e.target.checked;
                        setIsOmaha(v);
                        if (v) setIsShortDeck(false);
                      }}
                      style={{ marginRight: 6 }}
                    />
                    <span className="label-text">2+3</span>
                  </label>
                </div>
                <div className="poker-form-group">
                  <Button
                    type="primary"
                    size="large"
                    block
                    onClick={() =>
                      dispatch(
                        createRoomAsync({
                          sb: smallBlind,
                          buyIn,
                          reBuyLimit,
                          isShortDeck,
                          isOmaha,
                        })
                      )
                    }
                    loading={status.createRoomStatus === "loading"}
                    className="poker-btn create-btn"
                  >
                    🎰 创建房间
                  </Button>
                </div>
              </Card>
            </Tabs.TabPane>

            <Tabs.TabPane tab={<span><KeyOutlined /> 加入</span>} key="join">
              <Card className="home-card join-room-card">
                <div className="poker-form-group">
                  <span className="numpad-hint">请输入4位房间号，输入后自动加入</span>
                  <NumberPad onComplete={handleJoinRoom} />
                </div>
              </Card>
            </Tabs.TabPane>

            <Tabs.TabPane tab={<span><SearchOutlined /> 寻找</span>} key="find">
              <Card className="home-card find-room-card">
                {rooms.length === 0 ? (
                  <div className="no-rooms">
                    <p>暂无房间</p>
                    <p>请创建新房间开始游戏</p>
                  </div>
                ) : (
                  <div className="room-list">
                    {rooms.map((room) => (
                      <div key={room.id} className="room-item">
                        <div className="room-info">
                          <span className="room-id">房间号: {room.id}</span>
                          <span className="room-blind">积分: {room.smallBlind}/{room.smallBlind * 2}</span>
                          <span className="room-players">
                            玩家: {room.playerCount}/{room.maxPlayers}
                          </span>
                          <span className="room-owner">房主: {room.ownerName}</span>
                        </div>
                        <Button
                          type="primary"
                          size="small"
                          className="join-room-btn"
                          disabled={room.playerCount >= room.maxPlayers}
                          onClick={() => handleJoinRoom(room.id)}
                        >
                          加入
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </Tabs.TabPane>
          </Tabs>
        </div>
      </div>

      {/* 游戏记录弹窗 */}
      <Modal
        title={<span className="modal-title">🎲 最近游戏记录</span>}
        visible={historyModalVisible}
        onCancel={() => setHistoryModalVisible(false)}
        footer={null}
        width={600}
        className="history-modal"
        centered
      >
        <RecentGameRecords />
      </Modal>

      {/* 个人资料弹窗 */}
      <Modal
        title={<span className="modal-title">👤 个人资料</span>}
        visible={profileModalVisible}
        onCancel={() => setProfileModalVisible(false)}
        footer={null}
        width={450}
        className="profile-modal"
        centered
      >
        <div className="profile-form">
          <div className="profile-field">
            <label>用户名</label>
            <Input disabled value={localStorage["name"]} />
          </div>
          <div className="profile-field">
            <label>玩家昵称</label>
            <Input 
              placeholder="请输入昵称，不填则显示用户名" 
              value={profileNickname}
              onChange={(e) => setProfileNickname(e.target.value)}
              maxLength={20}
            />
          </div>
          <div className="profile-field">
            <label>选择头像</label>
            <div className="avatar-grid">
              {avatarOptions.map((avatar, index) => (
                <div
                  key={index}
                  className={`avatar-option ${profileAvatar === avatar.filename ? "selected" : ""}`}
                  onClick={() => setProfileAvatar(avatar.filename)}
                >
                  <img src={avatar.img} alt={`头像${index + 1}`} />
                </div>
              ))}
            </div>
          </div>
          <div className="profile-actions">
            <Button onClick={() => setProfileModalVisible(false)}>
              取消
            </Button>
            <Button type="primary" onClick={handleSaveProfile}>
              保存
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default CreateRoom;
