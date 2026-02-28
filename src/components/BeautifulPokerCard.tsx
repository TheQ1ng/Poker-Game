// 真实扑克牌SVG组件
import React from 'react';

// 扑克牌花色和数字
export type CardSuit = 's' | 'h' | 'd' | 'c';
export type CardNum = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

interface PokerCardProps {
  suit?: CardSuit;
  num?: CardNum;
  size?: 'small' | 'medium' | 'large';
  showBack?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  animation?: 'flip' | 'deal' | 'none';
  isSelected?: boolean; // 是否被选中
}

const suitSymbols: Record<CardSuit, string> = {
  s: '♠',  // 黑桃
  h: '♥',  // 红心
  d: '♦',  // 方块
  c: '♣',  // 梅花
};

const suitColors: Record<CardSuit, string> = {
  s: '#1a1a1a',  // 黑色
  h: '#e74c3c',  // 红色
  d: '#1976d2',  // 蓝色
  c: '#2e7d32',  // 绿色
};

const numDisplay: Record<CardNum, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
  11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};

// 获取牌面图案位置 - 已简化，只保留角落
function getPatternPositions(cardNum: CardNum, suit: CardSuit): { x: number; y: number }[] {
  return [];
}

export const BeautifulPokerCard: React.FC<PokerCardProps> = ({
  suit,
  num,
  size = 'medium',
  showBack = false,
  className = '',
  style = {},
  onClick,
  animation = 'none',
  isSelected = true,
}) => {
  const sizeMap = {
    small: { width: 50, height: 70, fontSize: 12 },
    medium: { width: 70, height: 98, fontSize: 16 },
    large: { width: 90, height: 126, fontSize: 20 },
  };
  
  const { width, height, fontSize } = sizeMap[size];
  const cardNum = num as CardNum;
  const cardSuit = suit as CardSuit;
  
  // 卡牌背面的花纹
  const renderCardBack = () => (
    <svg width={width} height={height} viewBox="0 0 50 70" style={style} className={className}>
      {/* 卡片背景 */}
      <rect x="1" y="1" width="48" height="68" rx="4" ry="4" fill="#1a472a" stroke="#c9a227" strokeWidth="2"/>
      {/* 装饰花纹 */}
      <rect x="3" y="3" width="44" height="64" rx="2" ry="2" fill="none" stroke="#c9a227" strokeWidth="0.5" opacity="0.6"/>
      {/* 中心花纹 */}
      <circle cx="25" cy="35" r="15" fill="none" stroke="#c9a227" strokeWidth="0.5" opacity="0.6"/>
      <rect x="18" y="28" width="14" height="14" fill="none" stroke="#c9a227" strokeWidth="0.5" opacity="0.6" transform="rotate(45 25 35)"/>
      {/* 角落花纹 */}
      <path d="M 8 8 L 12 8 L 12 9 L 9 9 L 9 12 L 8 12 Z" fill="#c9a227" opacity="0.4"/>
      <path d="M 42 8 L 38 8 L 38 9 L 41 9 L 41 12 L 42 12 Z" fill="#c9a227" opacity="0.4"/>
      <path d="M 8 62 L 12 62 L 12 61 L 9 61 L 9 58 L 8 58 Z" fill="#c9a227" opacity="0.4"/>
      <path d="M 42 62 L 38 62 L 38 61 L 41 61 L 41 58 L 42 58 Z" fill="#c9a227" opacity="0.4"/>
    </svg>
  );
  
  // 如果显示背面
  if (showBack) {
    return (
      <div 
        className={`beautiful-poker-card ${animation !== 'none' ? `animation-${animation}` : ''}`}
        onClick={onClick}
        style={{
          width,
          height,
          cursor: onClick ? 'pointer' : 'default',
          ...style,
        }}
      >
        {renderCardBack()}
      </div>
    );
  }
  
  // 如果没有牌
  if (!suit || !num) {
    return (
      <div 
        className="beautiful-poker-card empty"
        onClick={onClick}
        style={{
          width,
          height,
          border: '2px dashed rgba(255,255,255,0.3)',
          borderRadius: '6px',
          background: 'rgba(0,0,0,0.1)',
          cursor: onClick ? 'pointer' : 'default',
          ...style,
        }}
      />
    );
  }
  
  const color = suitColors[cardSuit];
  const symbol = suitSymbols[cardSuit];
  const displayNum = numDisplay[cardNum];
  
  const animationStyle = animation === 'flip' ? {
    animation: 'cardFlip 1s ease-in-out',
  } : animation === 'deal' ? {
    animation: 'dealCard 0.5s ease-out',
  } : {};
  
  // 未选中的卡片样式
  const unselectedStyle = !isSelected ? {
    opacity: 0.4,
    filter: 'grayscale(0.8)',
  } : {};

  return (
    <div 
      className={`beautiful-poker-card ${animation !== 'none' ? `animation-${animation}` : ''}`}
      onClick={onClick}
      style={{
        width,
        height,
        cursor: onClick ? 'pointer' : 'default',
        perspective: '1000px',
        ...animationStyle,
        ...unselectedStyle,
        ...style,
      }}
    >
      <svg width={width} height={height} viewBox="0 0 50 70" style={{ display: 'block' }}>
        {/* 卡片背景 - 白色带阴影 */}
        <defs>
          <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="1" dy="2" stdDeviation="2" floodOpacity="0.3"/>
          </filter>
          <linearGradient id="cardBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff"/>
            <stop offset="100%" stopColor="#f5f5f5"/>
          </linearGradient>
        </defs>
        
        <rect x="1" y="1" width="48" height="68" rx="4" ry="4" fill="url(#cardBg)" filter="url(#cardShadow)"/>
        
        {/* 左右上角数字和花色 */}
        <text x="4" y="12" fill={color} fontSize={fontSize * 0.75} fontWeight="bold" fontFamily="Arial">{displayNum}</text>
        <text x="4" y="22" fill={color} fontSize={fontSize * 0.9} fontFamily="Arial">{symbol}</text>
        
        {/* 右下角数字和花色（旋转180度） */}
        <g transform="rotate(180 25 35)">
          <text x="4" y="12" fill={color} fontSize={fontSize * 0.75} fontWeight="bold" fontFamily="Arial">{displayNum}</text>
          <text x="4" y="22" fill={color} fontSize={fontSize * 0.9} fontFamily="Arial">{symbol}</text>
        </g>
        
        {/* 中间花色图案 - 已移除 */}
      </svg>
    </div>
  );
};

// 导出卡牌背面的SVG（单独使用）
export const CardBackSVG: React.FC<{ width?: number; height?: number }> = ({ width = 70, height = 98 }) => {
  return (
    <svg width={width} height={height} viewBox="0 0 50 70">
      <rect x="1" y="1" width="48" height="68" rx="4" ry="4" fill="#1a472a" stroke="#c9a227" strokeWidth="2"/>
      <rect x="3" y="3" width="44" height="64" rx="2" ry="2" fill="none" stroke="#c9a227" strokeWidth="0.5" opacity="0.6"/>
      <circle cx="25" cy="35" r="15" fill="none" stroke="#c9a227" strokeWidth="0.5" opacity="0.6"/>
      <rect x="18" y="28" width="14" height="14" fill="none" stroke="#c9a227" strokeWidth="0.5" opacity="0.6" transform="rotate(45 25 35)"/>
    </svg>
  );
};

export default BeautifulPokerCard;

