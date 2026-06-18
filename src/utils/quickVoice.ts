export interface QuickVoiceMessage {
  text: string;
  sound: string;
}

export const QUICK_VOICE_MESSAGES: QuickVoiceMessage[] = [
  { text: "棒棒棒棒！", sound: "bangbangbangbang.WAV" },
  { text: "难道他真的是赋能哥", sound: "funeng.WAV" },
  { text: "哈哈哈哈哈哈", sound: "hahahhahahaha.WAV" },
  { text: "颗秒！", sound: "kemiao.WAV" },
  { text: "17张牌你能秒我！", sound: "17zhangpai.WAV" },
  { text: "给我擦皮鞋！", sound: "capixie.WAV" },
  { text: "慢波！", sound: "manbo.WAV" },
  { text: "牌没有问题！", sound: "meiyouwenti.WAV" },
  { text: "我要验牌！", sound: "yanpai.WAV" },
];

export const QUICK_VOICE_SOUND_MAP: Record<string, string> = Object.fromEntries(
  QUICK_VOICE_MESSAGES.map((item) => [item.text, item.sound])
);

export const QUICK_VOICE_SOUND_FILES = Array.from(
  new Set(QUICK_VOICE_MESSAGES.map((item) => item.sound))
);

export function getQuickVoiceSoundFile(message: string): string | undefined {
  return QUICK_VOICE_SOUND_MAP[message];
}
