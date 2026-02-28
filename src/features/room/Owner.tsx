import {
  Avatar,
  Button,
  Slider,
  InputNumber,
  Tooltip,
  Popover,
  Checkbox,
  Switch,
} from "antd";
import { useEffect, useRef, useState } from "react";
import { useAppSelector } from "../../app/hooks";
import {
  ws_overtime,
  ws_userBet,
  ws_userFold,
  ws_userRebuy,
} from "../../app/websocket";
import { CountDown } from "./CountDown";
import { Poker } from "./Poker";
import { BigBlind, Dealer, SmallBlind } from "./Symbol";
import { selectGame, selectRoom, selectSelf } from "./roomSlice";
import { card2html } from "../gamehistory/GameHistory";

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

export function Owner({ zoom }: { zoom: number }) {
  const hintSoundRef = useRef<HTMLAudioElement>(null);
  const dealCardSoundRef = useRef<HTMLAudioElement>(null);

  const self = useAppSelector(selectSelf);
  const game = useAppSelector(selectGame);
  const room = useAppSelector(selectRoom);

  const selfAsUser = room?.users.find((u) => u.id == self?.id);

  const preBet = game?.preBet || 0;
  const raiseBet = game?.raiseBet || 0;
  const raiseBetDiff = game?.raiseBetDiff || 0;
  const pots = game?.pots || 0;
  const bb = game?.bb || 0;
  const reBuyLimit = game?.reBuyLimit || 1;
  const isSettling = game?.isSettling || false;

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

  const [raise, setRaise] = useState(0);
  const [now, setNow] = useState(0);
  const [autoCheck, setAutoCheck] = useState(false);

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
    setRaise(0);
    setAutoCheck(false);
  }, [game?.boardCards.length, game?.isSettling]);

  useEffect(() => {
    if (dealCardSoundRef.current && room?.isGaming) {
      const audio: HTMLAudioElement = dealCardSoundRef.current;
      audio.play();
    }
  }, [game?.boardCards.length, room?.isGaming]);

  // 当玩家获胜时，播报牌型
  useEffect(() => {
    if (self?.isWinner && self?.handsType) {
      speakHandType(self.handsType);
    }
  }, [self?.isWinner, self?.handsType]);

  return (
    <div className="flex-row flex-center" style={{ height: "100%" }}>
      <audio src={hintsound} autoPlay={false} ref={hintSoundRef} />
      <audio src={dealcardsound} autoPlay={false} ref={dealCardSoundRef} />
      <div className="flex3 flex flex-center">
        <div className={`owner ${!inGame ? "fold" : ""}`}>
          <Popover
            content={
              <div>
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
                  <div dangerouslySetInnerHTML={{
                    __html: `${card2html(self?.maxCards || [])} <strong style="color: #FF6F00">+$${(self?.profits || 0).toLocaleString()}</strong>`
                  }} />
                )}
              </div>
            }
            trigger="click"
            visible={self?.isWinner && self.profits >= 0}
          >
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
              <Avatar style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
                fontSize: "20px",
                color: "white",
              }}>{name.length > 0 ? name[0] : ""}</Avatar>
            )}
          </Popover>
          <div style={{ color: 'white', textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>{nickname}</div>
          <div className="stack" style={{
            background: "linear-gradient(135deg, #ffd700 0%, #ff8c00 100%)",
            borderRadius: "20px",
            padding: "2px 10px",
            fontSize: "12px",
            fontWeight: "bold",
            color: "#333",
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          }}>
            <span className="coins">$</span>
            {stack}
          </div>
          {stack + bet < reBuyLimit * bb &&
          (game?.isSettling || !self?.isInCurrentGame || self.isFoled) ? (
            <Button type="primary" onClick={() => ws_userRebuy()}>
              再次买入
            </Button>
          ) : null}
          {position != "" ? (
            <div className="position">
              {position == "SB" ? (
                <SmallBlind />
              ) : position == "BB" ? (
                <BigBlind />
              ) : position == "D" ? (
                <Dealer />
              ) : null}
            </div>
          ) : null}
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
              <span className="coins">$</span>
              {bet}
            </span>
          )}
        </div>
        <div className="flex1 flex-row flex-center">
          <Poker
            card={self?.hands[0] || null}
            index={0}
            showHand={isSettling && !selfAsUser?.hands[0]}
            isSelected={!isSettling || (self?.hands[0] && self?.maxCards ? self.maxCards.includes(self.hands[0]) : false)}
          />
          <Poker
            card={self?.hands[1] || null}
            index={1}
            showHand={isSettling && !selfAsUser?.hands[1]}
            isSelected={!isSettling || (self?.hands[1] && self?.maxCards ? self.maxCards.includes(self.hands[1]) : false)}
          />
          <div 
            style={{ 
              fontWeight: 'bold', 
              marginLeft: '10px',
              ...(self?.handsType && handTypeRanks[self.handsType] >= 4 ? { 
                color: '#ffd700',
                textShadow: '0 0 15px rgba(255, 215, 0, 0.8)',
                animation: 'handTypeGlow 1.5s ease-in-out infinite alternate'
              } : { color: 'white' })
            }}
          >
            {self?.handsType}
          </div>
        </div>
        <div className="flex flex-row flex-center">
          {isActing ? (
            <Tooltip title={`点击加时，需支付其他玩家各$${overtimeCost}`}>
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
            自动过牌或弃牌
          </div>
        ) : null}
        {isActing ? (
          <>
            <div className="flex1 flex flex-row flex-center main-btn">
              <Button type="primary" size="large" onClick={ws_userFold}>
                弃牌
              </Button>
              {canCheck ? (
                <Button
                  type="primary"
                  size="large"
                  onClick={() => ws_userBet(bet)}
                >
                  过牌
                </Button>
              ) : null}
              {canCall ? (
                <Button
                  type="primary"
                  size="large"
                  onClick={() => ws_userBet(chips2call + bet)}
                >
                  跟注 ${chips2call}
                </Button>
              ) : null}
              {shouldAllIn ? (
                <Button
                  type="primary"
                  size="large"
                  danger
                  onClick={() => ws_userBet(chips2call + bet)}
                >
                  AllIn ${chips2call}
                </Button>
              ) : canRaise ? (
                onlyRaiseAllIn ? (
                  <Button
                    type="primary"
                    size="large"
                    danger
                    onClick={() => ws_userBet(minRaise + bet)}
                  >
                    AllIn ${minRaise}
                  </Button>
                ) : (
                  <Button
                    type="primary"
                    size="large"
                    disabled={raise < minRaise}
                    onClick={() => ws_userBet(raise + bet)}
                  >
                    加注 ${raise}
                  </Button>
                )
              ) : null}
            </div>
            {canRaise ? (
              <div className="flex1 flex flex-row flex-center">
                {useBB ? (
                  <>
                    <Button onClick={() => setRaise(bb * 2)}>2BB</Button>
                    <Button onClick={() => setRaise(Math.floor(bb * 2.5))}>
                      2.5BB
                    </Button>
                    <Button onClick={() => setRaise(bb * 3)}>3BB</Button>
                    <Button onClick={() => setRaise(bb * 4)}>4BB</Button>
                  </>
                ) : (
                  <>
                    {has1_3 ? (
                      <Button onClick={() => setRaise(Math.ceil(pots / 3))}>
                        1/3
                      </Button>
                    ) : null}
                    {has1_2 ? (
                      <Button onClick={() => setRaise(Math.ceil(pots / 2))}>
                        1/2
                      </Button>
                    ) : null}
                    {has2_3 ? (
                      <Button
                        onClick={() => setRaise(Math.ceil((pots * 2) / 3))}
                      >
                        2/3
                      </Button>
                    ) : null}
                    {has3_4 ? (
                      <Button
                        onClick={() => setRaise(Math.ceil((pots * 3) / 4))}
                      >
                        3/4
                      </Button>
                    ) : null}
                    {has1_1 ? (
                      <Button onClick={() => setRaise(Math.ceil(pots))}>
                        1Pots
                      </Button>
                    ) : null}
                  </>
                )}
                <InputNumber
                  min={minRaise}
                  max={maxRaise}
                  value={raise}
                  onChange={(v) => setRaise(v!)}
                />
              </div>
            ) : null}

            <div className="flex1 flex flex-row flex-center">
              <span className="coins">$</span>
              <Slider
                min={minRaise}
                max={maxRaise}
                onChange={setRaise}
                style={{ width: 200 }}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
