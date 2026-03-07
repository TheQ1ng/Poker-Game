import React, { useEffect, useState, Suspense, lazy } from 'react';
import './App.css';
import './styles/poker-styles.css';
import './styles/responsive.css';
import { soundManager } from './utils/soundManager';
import { SyncOutlined } from '@ant-design/icons';
import { message } from 'antd';
import Loading from './components/Loading';

// 懒加载组件
const Home = lazy(() => import('./features/home/Home'));

// 竖屏提示组件
function RotateDeviceOverlay() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      // 检查是否为移动设备且是竖屏
      const isMobile = window.innerWidth <= 768;
      const isPortrait = window.innerHeight > window.innerWidth;
      setIsVisible(isMobile && isPortrait);
    };

    // 初始检查
    checkOrientation();

    // 监听窗口大小变化
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div className="rotate-device-overlay">
      <SyncOutlined className="rotate-icon" />
      <div className="rotate-text">📱 请横屏使用</div>
      <div className="rotate-hint">旋转您的设备以获得最佳游戏体验</div>
    </div>
  );
}

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
      <RotateDeviceOverlay />
      <Suspense fallback={<Loading />}>
        <Home/>
      </Suspense>
    </div>
  );
}

export default App;
