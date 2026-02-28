import React, { useState, useEffect } from 'react';
import './Loading.css';

const Loading: React.FC = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) {
          clearInterval(interval);
          return prev;
        }
        return prev + Math.random() * 10;
      });
    }, 200);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="loading-container">
      <div className="loading-content">
        <div className="loading-title">德州扑克</div>
        <div className="loading-subtitle">正在加载游戏资源...</div>
        <div className="loading-progress-container">
          <div 
            className="loading-progress-bar" 
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <div className="loading-progress-text">{Math.round(progress)}%</div>
      </div>
    </div>
  );
};

export default Loading;