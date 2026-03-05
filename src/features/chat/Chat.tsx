import { useState, useRef, useEffect } from 'react';
import { ws_sendMessage } from '../../app/websocket';
import { useAppSelector } from '../../app/hooks';
import { selectChatMessages } from './chatSlice';
import { selectSelf } from '../room/roomSlice';
import './Chat.css';

export function Chat() {
  const [message, setMessage] = useState('');
  const messages = useAppSelector(selectChatMessages);
  const self = useAppSelector(selectSelf);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!message.trim()) return;
    ws_sendMessage(message);
    setMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 生成用户头像的函数
  const getAvatar = (sender: string) => {
    // 使用默认头像，实际项目中可以根据用户ID或昵称生成不同的头像
    return '/static/media/playerIcon.5107c9a15f5bfd37478c.png';
  };

  return (
    <div className="chat-container">
      <div
        ref={scrollRef}
        className="chat-messages"
        style={{ overflowY: 'auto' }}
      >
        {messages.length === 0 ? (
          <div className="chat-empty">暂无消息</div>
        ) : (
          messages.map((msg: { sender: string; content: string; timestamp: number }, idx: number) => {
            const isSelf = msg.sender === self?.name || msg.sender === self?.nickname;
            return (
              <div key={idx} className={`chat-message ${isSelf ? 'chat-message-self' : 'chat-message-other'}`}>
                {!isSelf ? (
                  <>
                    <div className="chat-avatar">
                      <img src={getAvatar(msg.sender)} alt={msg.sender} />
                    </div>
                    <div className="chat-message-content-wrapper">
                      <div className="chat-message-nickname">{msg.sender}</div>
                      <div className="chat-message-bubble chat-message-bubble-other">
                        {msg.content}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="chat-message-content-wrapper">
                      <div className="chat-message-nickname">{msg.sender}</div>
                      <div className="chat-message-bubble chat-message-bubble-self">
                        {msg.content}
                      </div>
                    </div>
                    <div className="chat-avatar">
                      <img src={getAvatar(msg.sender)} alt={msg.sender} />
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
      <div className="chat-input-area">
        <input
          placeholder="按回车键发送消息"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button type="button" onClick={handleSend}>&gt;</button>
      </div>
    </div>
  );
}
