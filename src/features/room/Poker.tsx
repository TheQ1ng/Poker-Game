import { Button } from "antd";
import QueueAnim from "rc-queue-anim";
import { useEffect, useState } from "react";
import { Card as PokerCard } from "../../ApiType";
import { ws_userShowHands } from "../../app/websocket";
import { BeautifulPokerCard, CardBackSVG } from "../../components/BeautifulPokerCard";
import { soundManager } from "../../utils/soundManager";

// 转换旧格式到新格式
function convertToCardProps(card: PokerCard | null): { suit?: 's' | 'h' | 'd' | 'c'; num?: number } {
  if (!card) return {};
  return {
    suit: card.suit as 's' | 'h' | 'd' | 'c',
    num: card.num === 0 ? 1 : card.num // 0 可能是 A
  };
}

export function Poker({
  card,
  index = 0,
  showHand = false,
  animation = "none",
  isSelected = true,
}: {
  card: PokerCard | null;
  index?: number;
  showHand?: boolean;
  animation?: "deal" | "flip" | "none";
  isSelected?: boolean;
}) {
  const [isFlipped, setIsFlipped] = useState(false);
  const cardProps = convertToCardProps(card);
  
  useEffect(() => {
    if (card) {
      // 播放发牌音效
      soundManager.playDeal();
    }
  }, [card]);

  // 当显示手牌时触发翻牌动画
  useEffect(() => {
    if (showHand && card) {
      soundManager.playFlip();
      setIsFlipped(true);
    }
  }, [showHand, card]);

  return (
    <div className={`poker-card-wrapper ${!isSelected ? 'card-not-selected' : ''}`} style={{ margin: "0 4px" }}>
      <BeautifulPokerCard
        suit={cardProps.suit}
        num={cardProps.num as any}
        size="medium"
        showBack={!card}
        animation={showHand && card ? "flip" : animation}
        className={!card ? "poker-card-back" : ""}
      />
      {card && showHand ? (
        <Button
          type="primary"
          size="small"
          onClick={() => {
            soundManager.playButton();
            ws_userShowHands(index);
          }}
          style={{ 
            position: "absolute", 
            bottom: "-25px", 
            left: "50%", 
            transform: "translateX(-50%)",
            fontSize: "10px",
            padding: "0 8px",
            height: "20px",
          }}
        >
          亮牌
        </Button>
      ) : null}
    </div>
  );
}
