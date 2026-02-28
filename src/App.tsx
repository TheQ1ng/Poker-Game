import React, { useEffect, useState, Suspense, lazy } from 'react';
import './App.css';
import './styles/poker-styles.css';
import './styles/responsive.css';
import { soundManager } from './utils/soundManager';
import { SyncOutlined } from '@ant-design/icons';
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
