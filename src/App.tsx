import React, { useEffect } from 'react';
import './App.css';
import './styles/poker-styles.css';
import './styles/responsive.css';
import { soundManager } from './utils/soundManager';
import { message } from 'antd';
import Home from './features/home/Home';

function App() {
  useEffect(() => {
    // 尝试在用户交互后初始化音效管理器并恢复AudioContext
    const initAndResumeAudio = () => {
      // 初始化音效管理器
      soundManager.init().catch(err => console.warn('Sound init failed:', err));
      
      // 播放一个轻声音效来激活AudioContext
      if (soundManager.isEnabled()) {
        soundManager.playButton();
      }
    };
    
    document.addEventListener('click', initAndResumeAudio, { once: true });
    document.addEventListener('keydown', initAndResumeAudio, { once: true });
    
    return () => {
      document.removeEventListener('click', initAndResumeAudio);
      document.removeEventListener('keydown', initAndResumeAudio);
    };
  }, []);

  useEffect(() => {
    let currentVersion = "";
    let isRefreshing = false;
    const checkVersion = async () => {
      if (isRefreshing) return;
      try {
        const rsp = await fetch("/version.json", { cache: "no-store" });
        if (!rsp.ok) return;
        const data = await rsp.json();
        const nextVersion = String(data?.version || "");
        if (!nextVersion) return;
        if (!currentVersion) {
          currentVersion = nextVersion;
          return;
        }
        if (nextVersion !== currentVersion) {
          isRefreshing = true;
          message.info("检测到新版本，正在自动更新…");
          setTimeout(() => window.location.reload(), 800);
        }
      } catch (e) {
        // 忽略轮询异常，避免影响游戏主流程
      }
    };

    checkVersion();
    const timer = setInterval(checkVersion, 60 * 1000);
    const onVisible = () => {
      if (!document.hidden) {
        checkVersion();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return (
    <div className="App">
      <Home />
    </div>
  );
}

export default App;
