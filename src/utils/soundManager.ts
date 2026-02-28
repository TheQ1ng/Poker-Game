// 扑克游戏音效管理器
// 使用 Web Audio API 生成各种游戏音效

type SoundType = 
  | 'deal'        // 发牌
  | 'flip'        // 翻牌
  | 'chipStack'   // 筹码堆叠
  | 'chipBet'     // 下注
  | 'allin'       // 全下
  | 'fold'        // 弃牌
  | 'check'       // 让牌
  | 'call'        // 跟注
  | 'raise'       // 加注
  | 'win'         // 获胜
  | 'lose'        // 失败
  | 'showdown'    // 摊牌
  | 'gameStart'   // 游戏开始
  | 'tick'        // 倒计时
  | 'button'      // 按钮点击
  | 'hover';      // 悬停

class SoundManager {
  private audioContext: AudioContext | null = null;
  private sounds: Map<SoundType, AudioBuffer> = new Map();
  private enabled: boolean = true;
  private masterVolume: number = 0.5;
  
  constructor() {
    this.initAudioContext();
  }
  
  private initAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API not supported');
    }
  }
  
  // 初始化所有音效
  async init() {
    if (!this.audioContext) {
      this.initAudioContext();
    }
    
    // 生成各种音效
    await Promise.all([
      this.generateDealSound(),
      this.generateFlipSound(),
      this.generateChipStackSound(),
      this.generateChipBetSound(),
      this.generateAllinSound(),
      this.generateFoldSound(),
      this.generateCheckSound(),
      this.generateCallSound(),
      this.generateRaiseSound(),
      this.generateWinSound(),
      this.generateLoseSound(),
      this.generateShowdownSound(),
      this.generateGameStartSound(),
      this.generateTickSound(),
      this.generateButtonSound(),
      this.generateHoverSound(),
    ]);
  }
  
  // 生成发牌音效 - 短促的"嗖"声
  private async generateDealSound() {
    if (!this.audioContext) return;
    
    const duration = 0.15;
    const sampleRate = this.audioContext.sampleRate;
    const buffer = this.audioContext.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 30);
      const frequency = 800 - t * 2000;
      data[i] = Math.sin(2 * Math.PI * frequency * t) * envelope * 0.3;
      data[i] += (Math.random() * 2 - 1) * envelope * 0.1;
    }
    
    this.sounds.set('deal', buffer);
  }
  
  // 生成翻牌音效 - 清脆的"啪"声
  private async generateFlipSound() {
    if (!this.audioContext) return;
    
    const duration = 0.2;
    const sampleRate = this.audioContext.sampleRate;
    const buffer = this.audioContext.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 20);
      // 混合多个频率产生清脆的声音
      data[i] = Math.sin(2 * Math.PI * 2000 * t) * envelope * 0.4;
      data[i] += Math.sin(2 * Math.PI * 4000 * t) * envelope * 0.3;
      data[i] += Math.sin(2 * Math.PI * 6000 * t) * envelope * 0.2;
      data[i] += (Math.random() * 2 - 1) * envelope * 0.15;
    }
    
    this.sounds.set('flip', buffer);
  }
  
  // 生成筹码堆叠音效 - 低沉的"咚咚"声
  private async generateChipStackSound() {
    if (!this.audioContext) return;
    
    const duration = 0.3;
    const sampleRate = this.audioContext.sampleRate;
    const buffer = this.audioContext.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 15);
      // 低频共振
      data[i] = Math.sin(2 * Math.PI * 200 * t) * envelope * 0.5;
      data[i] += Math.sin(2 * Math.PI * 400 * t) * envelope * 0.3;
      data[i] += (Math.random() * 2 - 1) * envelope * 0.1;
    }
    
    this.sounds.set('chipStack', buffer);
  }
  
  // 生成下注音效
  private async generateChipBetSound() {
    if (!this.audioContext) return;
    
    const duration = 0.25;
    const sampleRate = this.audioContext.sampleRate;
    const buffer = this.audioContext.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 12);
      // 两种频率混合
      data[i] = Math.sin(2 * Math.PI * 300 * t) * envelope * 0.4;
      data[i] += Math.sin(2 * Math.PI * 500 * t) * envelope * 0.3;
    }
    
    this.sounds.set('chipBet', buffer);
  }
  
  // 生成全下音效 - 激动人心的声音
  private async generateAllinSound() {
    if (!this.audioContext) return;
    
    const duration = 0.8;
    const sampleRate = this.audioContext.sampleRate;
    const buffer = this.audioContext.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      // 上升音调
      const frequency = 300 + t * 600;
      const envelope = t < 0.1 ? t * 10 : Math.exp(-(t - 0.1) * 3);
      data[i] = Math.sin(2 * Math.PI * frequency * t) * envelope * 0.5;
      data[i] += Math.sin(2 * Math.PI * frequency * 2 * t) * envelope * 0.2;
      data[i] += (Math.random() * 2 - 1) * envelope * 0.1;
    }
    
    this.sounds.set('allin', buffer);
  }
  
  // 生成弃牌音效
  private async generateFoldSound() {
    if (!this.audioContext) return;
    
    const duration = 0.3;
    const sampleRate = this.audioContext.sampleRate;
    const buffer = this.audioContext.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 10);
      // 下降音调
      const frequency = 600 - t * 1000;
      data[i] = Math.sin(2 * Math.PI * frequency * t) * envelope * 0.3;
      data[i] += (Math.random() * 2 - 1) * envelope * 0.15;
    }
    
    this.sounds.set('fold', buffer);
  }
  
  // 生成让牌音效
  private async generateCheckSound() {
    if (!this.audioContext) return;
    
    const duration = 0.2;
    const sampleRate = this.audioContext.sampleRate;
    const buffer = this.audioContext.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 15);
      data[i] = Math.sin(2 * Math.PI * 600 * t) * envelope * 0.3;
      data[i] += Math.sin(2 * Math.PI * 800 * t) * envelope * 0.2;
    }
    
    this.sounds.set('check', buffer);
  }
  
  // 生成跟注音效
  private async generateCallSound() {
    if (!this.audioContext) return;
    
    const duration = 0.25;
    const sampleRate = this.audioContext.sampleRate;
    const buffer = this.audioContext.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 12);
      data[i] = Math.sin(2 * Math.PI * 500 * t) * envelope * 0.4;
      data[i] += Math.sin(2 * Math.PI * 700 * t) * envelope * 0.3;
    }
    
    this.sounds.set('call', buffer);
  }
  
  // 生成加注音效
  private async generateRaiseSound() {
    if (!this.audioContext) return;
    
    const duration = 0.4;
    const sampleRate = this.audioContext.sampleRate;
    const buffer = this.audioContext.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 8);
      // 上升音调更明显
      const frequency = 400 + t * 800;
      data[i] = Math.sin(2 * Math.PI * frequency * t) * envelope * 0.4;
      data[i] += Math.sin(2 * Math.PI * frequency * 2 * t) * envelope * 0.2;
    }
    
    this.sounds.set('raise', buffer);
  }
  
  // 生成获胜音效
  private async generateWinSound() {
    if (!this.audioContext) return;
    
    const duration = 1.0;
    const sampleRate = this.audioContext.sampleRate;
    const buffer = this.audioContext.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);
    
    // 胜利的音阶
    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      const noteIndex = Math.min(Math.floor(t / 0.25), notes.length - 1);
      const noteStart = noteIndex * 0.25;
      const localT = t - noteStart;
      const envelope = localT < 0.05 ? localT * 20 : Math.exp(-localT * 3);
      
      data[i] = Math.sin(2 * Math.PI * notes[noteIndex] * t) * envelope * 0.3;
    }
    
    this.sounds.set('win', buffer);
  }
  
  // 生成失败音效
  private async generateLoseSound() {
    if (!this.audioContext) return;
    
    const duration = 0.8;
    const sampleRate = this.audioContext.sampleRate;
    const buffer = this.audioContext.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);
    
    // 下降的音调
    const notes = [392, 349, 311, 262]; // G4, F4, Eb4, C4
    
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      const noteIndex = Math.min(Math.floor(t / 0.2), notes.length - 1);
      const noteStart = noteIndex * 0.2;
      const localT = t - noteStart;
      const envelope = localT < 0.05 ? localT * 20 : Math.exp(-localT * 4);
      
      data[i] = Math.sin(2 * Math.PI * notes[noteIndex] * t) * envelope * 0.3;
    }
    
    this.sounds.set('lose', buffer);
  }
  
  // 生成摊牌音效
  private async generateShowdownSound() {
    if (!this.audioContext) return;
    
    const duration = 0.6;
    const sampleRate = this.audioContext.sampleRate;
    const buffer = this.audioContext.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      // 缓慢上升然后下降
      const frequency = 400 + Math.sin(t * 10) * 200;
      const envelope = Math.exp(-t * 3);
      data[i] = Math.sin(2 * Math.PI * frequency * t) * envelope * 0.3;
      data[i] += Math.sin(2 * Math.PI * frequency * 1.5 * t) * envelope * 0.15;
    }
    
    this.sounds.set('showdown', buffer);
  }
  
  // 生成游戏开始音效
  private async generateGameStartSound() {
    if (!this.audioContext) return;
    
    const duration = 0.5;
    const sampleRate = this.audioContext.sampleRate;
    const buffer = this.audioContext.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 5);
      data[i] = Math.sin(2 * Math.PI * 440 * t) * envelope * 0.3;
      data[i] += Math.sin(2 * Math.PI * 554 * t) * envelope * 0.25; // C#5
      data[i] += Math.sin(2 * Math.PI * 659 * t) * envelope * 0.2; // E5
    }
    
    this.sounds.set('gameStart', buffer);
  }
  
  // 生成倒计时音效
  private async generateTickSound() {
    if (!this.audioContext) return;
    
    const duration = 0.1;
    const sampleRate = this.audioContext.sampleRate;
    const buffer = this.audioContext.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 50);
      data[i] = Math.sin(2 * Math.PI * 1000 * t) * envelope * 0.3;
    }
    
    this.sounds.set('tick', buffer);
  }
  
  // 生成按钮点击音效
  private async generateButtonSound() {
    if (!this.audioContext) return;
    
    const duration = 0.08;
    const sampleRate = this.audioContext.sampleRate;
    const buffer = this.audioContext.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 80);
      data[i] = Math.sin(2 * Math.PI * 800 * t) * envelope * 0.2;
      data[i] += (Math.random() * 2 - 1) * envelope * 0.1;
    }
    
    this.sounds.set('button', buffer);
  }
  
  // 生成悬停音效 - 很轻的声音
  private async generateHoverSound() {
    if (!this.audioContext) return;
    
    const duration = 0.05;
    const sampleRate = this.audioContext.sampleRate;
    const buffer = this.audioContext.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 100);
      data[i] = Math.sin(2 * Math.PI * 600 * t) * envelope * 0.1;
    }
    
    this.sounds.set('hover', buffer);
  }
  
  // 播放音效
  play(type: SoundType, volume?: number) {
    if (!this.enabled || !this.audioContext) return;
    
    const buffer = this.sounds.get(type);
    if (!buffer) return;
    
    // 恢复 AudioContext（如果被暂停）
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    
    const source = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();
    
    source.buffer = buffer;
    gainNode.gain.value = volume !== undefined ? volume : this.masterVolume;
    
    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    source.start(0);
  }
  
  // 便捷方法
  playDeal() { this.play('deal'); }
  playFlip() { this.play('flip'); }
  playChipStack() { this.play('chipStack'); }
  playChipBet() { this.play('chipBet'); }
  playAllin() { this.play('allin', 0.7); }
  playFold() { this.play('fold', 0.5); }
  playCheck() { this.play('check'); }
  playCall() { this.play('call'); }
  playRaise() { this.play('raise', 0.6); }
  playWin() { this.play('win', 0.6); }
  playLose() { this.play('lose', 0.5); }
  playShowdown() { this.play('showdown'); }
  playGameStart() { this.play('gameStart'); }
  playTick() { this.play('tick', 0.3); }
  playButton() { this.play('button', 0.4); }
  playHover() { this.play('hover', 0.2); }
  
  // 设置音效开关
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }
  
  // 设置音量
  setVolume(volume: number) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
  }
  
  // 获取当前音量
  getVolume(): number {
    return this.masterVolume;
  }
  
  // 获取音效开关状态
  isEnabled(): boolean {
    return this.enabled;
  }
}

// 导出单例
export const soundManager = new SoundManager();

// 导出类型
export type { SoundType };

