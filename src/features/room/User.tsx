import { Avatar, Popover, Tooltip } from "antd";
import { ApiOutlined, CoffeeOutlined } from "@ant-design/icons";
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
  return (
    <div className="user flex-column flex-center">
      <div
        className={`userinfo flex-column flex-center ${!inGame ? "fold" : ""}`}
      >
        <Popover
          content={
            <div style={{ padding: '10px' }}>
              <strong style={{ color: '#FF6F00' }}>+$${user?.profits}</strong>
            </div>
          }
          trigger="click"
          visible={user?.isWinner && user?.profits >= 0}
        >
        <div className={`avatar-container ${user?.isAllIn ? 'allinFire' : ''}`} style={{ transform: isSelf ? 'scale(1)' : 'scale(0.8)' }}>
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
        </div>
        </Popover>
        <div style={{ color: 'white', textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>{nickname}</div>
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
        {user?.actionName && (
          <span className={`user-action-indicator ${user.actionName.toLowerCase()}`}>
            {user.actionName}
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
              textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
              ...(user?.handsType && handTypeRanks[user.handsType] >= 4 ? { 
                color: '#ffd700',
                textShadow: '0 0 15px rgba(255, 215, 0, 0.8)',
                animation: 'handTypeGlow 1.5s ease-in-out infinite alternate'
              } : { color: 'white' })
            }}
          >
            {user?.handsType}
          </div>
          {user?.hands.map((card, i) => (
            <Poker
              card={card}
              key={`${card ? `${card.num}${card.suit}` : i}`}
              isSelected={!isSettling || (card && user?.maxCards ? user.maxCards.includes(card) : false)}
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
        ) : null}
      </div>
      {position != "" ? <div className="position">{posComp}</div> : null}
      <div className="allin">{user?.isAllIn ? <AllIn /> : null}</div>
    </div>
  );
}
