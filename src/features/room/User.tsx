import { Avatar, Popover, Tooltip, Button, Popconfirm } from "antd";
import { ApiOutlined, CoffeeOutlined, UserDeleteOutlined, CloseOutlined } from "@ant-design/icons";
import { shallowEqual, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { CountDown } from "./CountDown";
import { Poker } from "./Poker";
import { AllIn, BigBlind, Dealer, SmallBlind } from "./Symbol";
import { card2html } from "../gamehistory/GameHistory";
import { soundManager } from "../../utils/soundManager";
import { BeautifulPokerCard } from "../../components/BeautifulPokerCard";
import { useEffect } from "react";
import { selectSelf } from "./roomSlice";
import { ws_kickUser } from "../../app/websocket";

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

// 获取所有头像键值
const avatarKeys = Object.keys(avatarImages);

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

export function User({ id }: { id: string }) {
  const user = useSelector((state: RootState) => {
    const users = state.room.room?.users;
    if (!users) return null;
    const index = users.findIndex((u) => u.id == id);
    return users[index];
  }, shallowEqual);
  const self = useSelector(selectSelf, shallowEqual);
  const isSelf = self?.id === id;
  const name = user?.name || "";
  const nickname = user?.nickname || name;
  const avatar = user?.avatar || "";
  const stack = user?.stack || 0;
  const bet = user?.bet || 0;
  const isActing = user?.isActing || false;
  const actionEndTime = user?.actionEndTime || Date.now();
  const showHands = user?.hands && (user?.hands[0] || user?.hands[1]);
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

  // 处理牌型语音播报
  useEffect(() => {
    if (user?.shouldShowHand && user?.handsType) {
      // 语音播报牌型
      if ('speechSynthesis' in window) {
        const speech = new SpeechSynthesisUtterance(user.handsType);
        speech.lang = 'zh-CN';
        window.speechSynthesis.speak(speech);
      }
    }
  }, [user?.shouldShowHand, user?.handsType]);
  return (
    <div className={`user flex-column flex-center ${user?.isFoled ? "folded" : ""}`}>
      <div
        className={`userinfo flex-column flex-center ${!inGame ? "fold" : ""}`}
        style={{
          opacity: user ? (user.isOffline || !user.isReady || user.isFoled) ? 0.5 : 1 : 0.5,
          transition: 'opacity 0.3s ease'
        }}
      >
        <Popover
          content={
            <div style={{ padding: '10px' }}>
              <strong style={{ color: '#FF6F00' }}>+$${user?.profits}</strong>
            </div>
          }
          trigger="click"
          visible={user?.isWinner && user?.profits >= 0}
          style={{ zIndex: 1000 }}
        >
        <div className="avatar-container" style={{ transform: isSelf ? 'scale(1)' : 'scale(0.8)', position: 'relative' }}>
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
          // 为机器人分配随机头像
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
        {/* 弃牌蒙层 */}
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
        {/* 赢家头像高亮 */}
        {user?.isWinner && (
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
        {/* 牌型显示 */}
        {user?.shouldShowHand && user?.handsType && (
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
        </div>
        </Popover>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>
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
                  icon={<UserDeleteOutlined />}
                  style={{ marginLeft: 5 }}
                />
              </Tooltip>
            </Popconfirm>
          )}
        </div>
        <div className="stack">
          <span className="coins">$</span>
          {stack}
        </div>
      </div>
      {isActing ? (
        <CountDown
          time={Math.floor((actionEndTime - Date.now()) / 1000)}
          now={Date.now()}
        />
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
        {user?.actionName && user.actionName.toLowerCase() !== 'allin' && (
          <span className={`user-action-indicator ${user.actionName.toLowerCase()}`}>
            {user.actionName}
          </span>
        )}
        {/* 持久化显示弃牌标签 */}
        {user?.isFoled && !user?.actionName && (
          <span className="user-action-indicator fold">
            弃牌
          </span>
        )}
        {bet > 0 ? (
          <span>
            <span className="coins">$</span>
            {bet}
          </span>
        ) : (
          <div>&nbsp;</div>
        )}
      </div>
      {showHands ? (
        <div className="card-box ">
          <div 
            className="handstype" 
            style={{ 
              ...(user?.handsType && handTypeRanks[user.handsType] >= 4 ? { 
                color: '#ffd700',
                textShadow: '0 0 15px rgba(255, 215, 0, 0.8)',
                animation: 'handTypeGlow 1.5s ease-in-out infinite alternate'
              } : { 
                color: 'white',
                textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
              })
            }}
          >
            {user?.handsType}
          </div>
          {user?.hands.map((card, i) => (
            <Poker
              card={card}
              key={`${card ? `${card.num}${card.suit}` : i}`}
              isSelected={true}
              showHand={user?.shouldShowHand}
            />
          ))}
        </div>
      ) : null}

      <div className="status">
        {user?.isOffline ? (
          <Tooltip title="掉线">
            <ApiOutlined />
          </Tooltip>
        ) : !user?.isReady ? (
          <Tooltip title="挂起">
            <CoffeeOutlined />
          </Tooltip>
        ) : user?.isFoled ? (
          <Tooltip title="弃牌">
            <CloseOutlined />
          </Tooltip>
        ) : null}
      </div>
      {position != "" ? <div className="position">{posComp}</div> : null}
      <div className="allin">{user?.isAllIn ? <AllIn /> : null}</div>
    </div>
  );
}
