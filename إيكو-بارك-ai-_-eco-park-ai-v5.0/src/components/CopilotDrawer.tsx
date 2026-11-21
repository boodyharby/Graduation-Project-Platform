import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bot,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Radio,
  Send,
  ShieldAlert,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { CopilotMessage, Language, NavTab, VehicleType } from '../types/parking';
import { t } from '../data/i18n';
import {
  playCallConnectTone,
  playCallEndTone,
  speakCopilotReply,
  stopCopilotSpeech,
} from '../utils/ecoEngine';

interface CopilotDrawerProps {
  lang: Language;
  isOpen: boolean;
  onClose: () => void;
  contextSummary: Record<string, unknown>;
  onExecuteAction: (action: string, payload?: string) => void;
}

const VOICE_OPTIONS = [
  { id: 'Zephyr', labelAr: 'زيفير (مصري ودود)', labelEn: 'Zephyr (Warm)' },
  { id: 'Kore', labelAr: 'كوري (واضح وعملي)', labelEn: 'Kore (Pro)' },
  { id: 'Puck', labelAr: 'باك (سريع وحيوي)', labelEn: 'Puck (Bright)' },
  { id: 'Charon', labelAr: 'شارون (عميق للتحكم)', labelEn: 'Charon (Deep)' },
];

function formatCallDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function float32ToPcm16Base64(float32: Float32Array): string {
  const buffer = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function pcm16Base64ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const view = new DataView(bytes.buffer);
  const samples = Math.floor(bytes.byteLength / 2);
  const float32 = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    float32[i] = view.getInt16(i * 2, true) / 32768;
  }
  return float32;
}

function buildLiveEgyptBriefing(ctx: Record<string, unknown>, lang: Language): string {
  const bess = Number(ctx.bessCharge ?? 85);
  const solar = Number(ctx.solarKw ?? 0);
  const occ = Number(ctx.occupancyPct ?? 0);
  const avail = Number(ctx.availableSpots ?? 10);
  const avgTemp = Number(ctx.avgTempC ?? 27);
  const eco = Boolean(ctx.ecoConservation);
  const smoke = Boolean(ctx.smokeAlert);

  if (lang === 'en') {
    if (smoke) {
      return `Safety alert active in Eco-Park Egypt! BESS is at ${bess}%, open bays ${avail}. Follow the green evacuation laser corridor.`;
    }
    return `Eco-Park Egypt live update: ${avail} bays open (${occ}% occupied), BESS reserve at ${bess}%, solar generating ${solar} kilowatts, and lot temp ${avgTemp}°C.`;
  }

  if (smoke) {
    return `تنبيه سلامة طارئ في إيكو-بارك مصر! تم رصد دخان، بطارية BESS على ${bess}% وعندنا ${avail} مكان فاضي. اتبع المسار الضوئي الأخضر للخروج الآمن.`;
  }
  if (bess < 25) {
    return `خد بالك يا فندم، بطارية BESS نزلت لـ ${bess}% ومحتاجين ${eco ? 'نستمر على وضع التوفير' : 'نشغل وضع توفير الطاقة Eco دلوقتي'}. حالياً فيه ${avail} مكان فاضي والطاقة الشمسية ${solar} كيلوواط.`;
  }
  return `متابعة حية من إيكو-بارك مصر: الإشغال دلوقتي ${occ}% وعندنا ${avail} مكان فاضي، بطارية BESS على ${bess}%، والشمس مديانا ${solar} كيلوواط، ومتوسط الحرارة ${avgTemp} درجة.`;
}

type SpeechRecResultAlternative = { transcript: string };
type SpeechRecResult = { isFinal?: boolean; 0: SpeechRecResultAlternative };
type SpeechRecEvent = { resultIndex?: number; results: ArrayLike<SpeechRecResult> };
type SpeechRecInstance = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous?: boolean;
  onresult: (event: SpeechRecEvent) => void;
  onerror: (event?: { error?: string }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
};

export const CopilotDrawer: React.FC<CopilotDrawerProps> = ({
  lang,
  isOpen,
  onClose,
  contextSummary,
  onExecuteAction,
}) => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [continuousVoice, setContinuousVoice] = useState(false);
  const [preferInstantVoice, setPreferInstantVoice] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceName, setVoiceName] = useState('Zephyr');
  const [listening, setListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [micDenied, setMicDenied] = useState(false);
  const [micNotice, setMicNotice] = useState('');
  const [geminiReady, setGeminiReady] = useState<boolean | null>(null);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);

  // Interactive Phone Call UI state (works smoothly via Live API or Turn-Taking Egyptian Call Engine)
  const [inCall, setInCall] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const [callSpeakerMuted, setCallSpeakerMuted] = useState(false);

  const recognitionRef = useRef<SpeechRecInstance | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const hasGreetedOnOpenRef = useRef(false);

  // Sync refs so async callbacks never capture stale closures
  const contextRef = useRef(contextSummary);
  contextRef.current = contextSummary;
  const langRef = useRef(lang);
  langRef.current = lang;
  const autoSpeakRef = useRef(autoSpeak);
  autoSpeakRef.current = autoSpeak;
  const continuousVoiceRef = useRef(continuousVoice);
  continuousVoiceRef.current = continuousVoice;
  const preferInstantRef = useRef(preferInstantVoice);
  preferInstantRef.current = preferInstantVoice;
  const voiceNameRef = useRef(voiceName);
  voiceNameRef.current = voiceName;
  const loadingRef = useRef(loading);
  loadingRef.current = loading;
  const micDeniedRef = useRef(micDenied);
  micDeniedRef.current = micDenied;
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;
  const isSpeakingRef = useRef(isSpeaking);
  isSpeakingRef.current = isSpeaking;
  const inCallRef = useRef(inCall);
  inCallRef.current = inCall;
  const listeningRef = useRef(listening);
  listeningRef.current = listening;
  const callSpeakerMutedRef = useRef(callSpeakerMuted);
  callSpeakerMutedRef.current = callSpeakerMuted;

  // Real-Time Gemini Live API (gemini-3.8-live) refs & UI state
  const [liveStatus, setLiveStatus] = useState<
    'idle' | 'connecting' | 'connected' | 'listen_only' | 'smart_call' | 'error'
  >('idle');
  const [liveError, setLiveError] = useState<string>('');
  const [liveMicMuted, setLiveMicMuted] = useState<boolean>(false);
  const liveWsRef = useRef<WebSocket | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const liveMicMutedRef = useRef<boolean>(false);
  liveMicMutedRef.current = liveMicMuted;
  const liveStatusRef = useRef(liveStatus);
  liveStatusRef.current = liveStatus;
  const outputTranscriptBufRef = useRef<string>('');
  const inputTranscriptBufRef = useRef<string>('');

  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: t(
        lang,
        'أهلاً بيك يا فندم في إيكو-بارك مصر! اضغط «مكالمة صوتية» عشان نتكلم سوا ذهاب وعودة زي التليفون بالمصري، أو اسألني كتابة وهرد عليك بالصوت فوراً.',
        'Welcome to Eco-Park Egypt! Tap "Voice Call" for a natural back-and-forth phone conversation, or send any question for instant voice replies.'
      ),
      timestamp: lang === 'ar' ? 'دلوقتي' : 'Now',
    },
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, interimTranscript]);

  // Live ticking phone call timer
  useEffect(() => {
    if (!inCall) {
      setCallSeconds(0);
      return;
    }
    const timer = window.setInterval(() => {
      setCallSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [inCall]);

  const stopLivePlayback = useCallback(() => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch {
        // ignore stopped nodes
      }
    });
    activeSourcesRef.current = [];
    if (outputCtxRef.current) {
      nextStartTimeRef.current = outputCtxRef.current.currentTime;
    } else {
      nextStartTimeRef.current = 0;
    }
  }, []);

  const stopSpeechRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setListening(false);
    setInterimTranscript('');
  }, []);

  const stopLiveAudioChannels = useCallback(() => {
    stopLivePlayback();
    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch {
        // ignore
      }
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
    if (inputCtxRef.current) {
      inputCtxRef.current.close().catch(() => {});
      inputCtxRef.current = null;
    }
    if (outputCtxRef.current) {
      outputCtxRef.current.close().catch(() => {});
      outputCtxRef.current = null;
    }
    if (liveWsRef.current) {
      try {
        liveWsRef.current.close();
      } catch {
        // ignore
      }
      liveWsRef.current = null;
    }
    outputTranscriptBufRef.current = '';
    inputTranscriptBufRef.current = '';
  }, [stopLivePlayback]);

  const endPhoneCall = useCallback(
    (playHangup = true) => {
      const elapsed = callSeconds;
      stopCopilotSpeech();
      stopLiveAudioChannels();
      stopSpeechRecognition();
      setIsSpeaking(false);
      setLiveMicMuted(false);
      setCallSpeakerMuted(false);
      setLiveStatus('idle');
      if (inCallRef.current && playHangup) {
        playCallEndTone();
        if (elapsed > 0) {
          setMessages((prev) => [
            ...prev,
            {
              id: `call-end-${Date.now()}`,
              role: 'assistant',
              text:
                langRef.current === 'ar'
                  ? `تم إنهاء المكالمة (${formatCallDuration(elapsed)}) — شرفتنا في إيكو-بارك مصر!`
                  : `Call ended (${formatCallDuration(elapsed)}) — happy to help anytime!`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
        }
      }
      setInCall(false);
    },
    [callSeconds, stopLiveAudioChannels, stopSpeechRecognition]
  );

  const playLivePcmChunk = useCallback((base64Audio: string) => {
    if (callSpeakerMutedRef.current) return;
    const outCtx = outputCtxRef.current;
    if (!outCtx) return;
    if (outCtx.state === 'suspended') {
      outCtx.resume().catch(() => {});
    }
    const samples = pcm16Base64ToFloat32(base64Audio);
    if (samples.length === 0) return;

    const buffer = outCtx.createBuffer(1, samples.length, 24000);
    buffer.getChannelData(0).set(samples);

    const source = outCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(outCtx.destination);

    const startAt = Math.max(outCtx.currentTime, nextStartTimeRef.current);
    source.start(startAt);
    nextStartTimeRef.current = startAt + buffer.duration;

    setIsSpeaking(true);
    activeSourcesRef.current.push(source);
    source.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
      if (activeSourcesRef.current.length === 0) {
        setIsSpeaking(false);
      }
    };
  }, []);

  const startSpeechRecognitionRef = useRef<(silentRestart?: boolean) => void>(() => {});

  const speakText = useCallback((text: string, forceInstant?: boolean) => {
    if (!text.trim() || callSpeakerMutedRef.current) {
      setIsSpeaking(false);
      return;
    }
    speakCopilotReply(
      text,
      langRef.current,
      voiceNameRef.current,
      (speakingNow) => {
        setIsSpeaking(speakingNow);
        // Phone Call Turn-Taking: when assistant finishes speaking inside a call (or continuous mode), automatically open mic!
        const shouldAutoListen =
          !speakingNow &&
          isOpenRef.current &&
          (inCallRef.current || continuousVoiceRef.current) &&
          !micDeniedRef.current &&
          !liveMicMutedRef.current &&
          !loadingRef.current &&
          liveStatusRef.current !== 'connected';

        if (shouldAutoListen) {
          window.setTimeout(() => {
            if (
              isOpenRef.current &&
              (inCallRef.current || continuousVoiceRef.current) &&
              !micDeniedRef.current &&
              !liveMicMutedRef.current &&
              !isSpeakingRef.current &&
              !loadingRef.current
            ) {
              startSpeechRecognitionRef.current(true);
            }
          }, 260);
        }
      },
      inCallRef.current && langRef.current === 'ar'
        ? 'Warm, smiling, natural Egyptian Arabic phone call partner speaking briskly and conversationally'
        : undefined,
      forceInstant ?? preferInstantRef.current
    );
  }, []);

  const sendPrompt = useCallback(
    async (promptText: string) => {
      const trimmed = promptText.trim();
      if (!trimmed || loadingRef.current) return;

      stopCopilotSpeech();
      setIsSpeaking(false);
      setInterimTranscript('');

      // If Gemini Live duplex/listen-only WebSocket is connected, forward user utterance/text into stream
      if (
        (liveStatusRef.current === 'connected' || liveStatusRef.current === 'listen_only') &&
        liveWsRef.current?.readyState === WebSocket.OPEN
      ) {
        liveWsRef.current.send(JSON.stringify({ type: 'text', text: trimmed }));
        setMessages((prev) => [
          ...prev,
          {
            id: `live-txt-${Date.now()}`,
            role: 'user',
            text: trimmed,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        setInput('');
        return;
      }

      const historySnapshot = messages
        .filter((m) => m.id !== 'welcome' && !m.id.startsWith('call-end-'))
        .slice(-6)
        .map((m) => ({ role: m.role, text: m.text }));

      const userMsg: CopilotMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        text: trimmed,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setLoading(true);
      const t0 = performance.now();

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 11000);

      try {
        const res = await fetch('/api/copilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            message: trimmed,
            lang: langRef.current,
            context: contextRef.current,
            history: historySnapshot,
            callMode: inCallRef.current,
          }),
        });
        window.clearTimeout(timeoutId);
        const data = await res.json();
        setLastLatencyMs(Math.round(performance.now() - t0));

        if (!res.ok) {
          throw new Error(data.error || 'Copilot request failed');
        }

        if (data.action && data.action !== 'none') {
          onExecuteAction(data.action, data.actionPayload);
        }

        const replyText =
          data.reply || t(langRef.current, 'تمام يا فندم، الطلب اتنفذ.', 'Done!');
        const botMsg: CopilotMessage = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: replyText,
          actionTaken:
            data.action && data.action !== 'none'
              ? `${data.action}${data.actionPayload ? ` (${data.actionPayload})` : ''}`
              : undefined,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, botMsg]);

        if (autoSpeakRef.current || inCallRef.current || continuousVoiceRef.current) {
          speakText(replyText);
        }
      } catch (err) {
        window.clearTimeout(timeoutId);
        const fallbackLocal = buildLiveEgyptBriefing(contextRef.current, langRef.current);
        const msgText =
          err instanceof Error && err.name === 'AbortError'
            ? t(
                langRef.current,
                `الاتصال اتأخر ثانية، بس ده الموقف دلوقتي: ${fallbackLocal}`,
                `Slight delay — live status: ${fallbackLocal}`
              )
            : fallbackLocal;
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: 'assistant',
            text: msgText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        if (autoSpeakRef.current || inCallRef.current || continuousVoiceRef.current) {
          speakText(msgText, true);
        }
      } finally {
        setLoading(false);
      }
    },
    [messages, onExecuteAction, speakText]
  );

  const startSpeechRecognition = useCallback(
    (silentRestart = false) => {
      if (recognitionRef.current && listeningRef.current) {
        if (!silentRestart) {
          stopSpeechRecognition();
        }
        return;
      }

      const SpeechRec =
        (window as unknown as { SpeechRecognition?: new () => unknown }).SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;

      if (!SpeechRec) {
        if (!silentRestart) {
          setMicNotice(
            t(
              langRef.current,
              'المتصفح مش بيدعم المايك هنا؛ اكتب ردك تحت وهيرد عليك في المكالمة بالصوت.',
              'Browser speech recognition is unavailable; type below and Copilot will speak back.'
            )
          );
        }
        return;
      }

      try {
        const rec = new SpeechRec() as SpeechRecInstance;
        rec.lang = langRef.current === 'ar' ? 'ar-EG' : 'en-US';
        rec.interimResults = true;
        rec.maxAlternatives = 1;
        rec.onresult = (event) => {
          let finalText = '';
          let interim = '';
          for (let i = event.resultIndex || 0; i < event.results.length; i++) {
            const res = event.results[i];
            const transcript = res?.[0]?.transcript || '';
            if (res?.isFinal) {
              finalText += transcript + ' ';
            } else {
              interim += transcript;
            }
          }
          setInterimTranscript(interim.trim());
          if (finalText.trim()) {
            setListening(false);
            setInterimTranscript('');
            setMicDenied(false);
            setMicNotice('');
            recognitionRef.current = null;
            sendPrompt(finalText.trim());
          }
        };
        rec.onerror = (ev) => {
          setListening(false);
          setInterimTranscript('');
          recognitionRef.current = null;
          const errCode = ev?.error || '';
          if (errCode === 'not-allowed' || errCode === 'service-not-allowed') {
            setMicDenied(true);
            setMicNotice(
              t(
                langRef.current,
                'تم رفض إذن المايكروفون (Permission denied). اسمح بالمايك من شريط العنوان أو استخدم الردود السريعة والكتابة جوه المكالمة وهيرد عليك بالصوت فوراً!',
                'Microphone permission denied. Allow mic in browser address bar, or use quick/typed replies during the call!'
              )
            );
          } else if (errCode === 'audio-capture') {
            setMicDenied(true);
            setMicNotice(
              t(
                langRef.current,
                'مفيش مايكروفون متصل حالياً. تقدر تكتب ردك وهيرد عليك بالصوت.',
                'No microphone detected. Type your reply to continue by voice.'
              )
            );
          } else if (
            (errCode === 'no-speech' || errCode === 'aborted') &&
            (inCallRef.current || continuousVoiceRef.current) &&
            isOpenRef.current &&
            !isSpeakingRef.current &&
            !loadingRef.current &&
            !liveMicMutedRef.current
          ) {
            window.setTimeout(() => {
              if (
                (inCallRef.current || continuousVoiceRef.current) &&
                isOpenRef.current &&
                !isSpeakingRef.current &&
                !loadingRef.current &&
                !micDeniedRef.current &&
                !liveMicMutedRef.current
              ) {
                startSpeechRecognitionRef.current(true);
              }
            }, 350);
          }
        };
        rec.onend = () => {
          setListening(false);
          recognitionRef.current = null;
          if (
            (inCallRef.current || continuousVoiceRef.current) &&
            isOpenRef.current &&
            !isSpeakingRef.current &&
            !loadingRef.current &&
            !micDeniedRef.current &&
            !liveMicMutedRef.current &&
            liveStatusRef.current !== 'connected'
          ) {
            window.setTimeout(() => {
              if (
                (inCallRef.current || continuousVoiceRef.current) &&
                isOpenRef.current &&
                !isSpeakingRef.current &&
                !loadingRef.current &&
                !micDeniedRef.current &&
                !liveMicMutedRef.current &&
                !listeningRef.current
              ) {
                startSpeechRecognitionRef.current(true);
              }
            }, 400);
          }
        };
        recognitionRef.current = rec;
        setListening(true);
        rec.start();
      } catch (err) {
        setListening(false);
        const msg = err instanceof Error ? err.message : '';
        if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('allowed')) {
          setMicDenied(true);
        }
      }
    },
    [sendPrompt, stopSpeechRecognition]
  );

  startSpeechRecognitionRef.current = startSpeechRecognition;

  // Barge-in helper: tap during assistant speech to interrupt and immediately speak back like a real phone call!
  const interruptAndReplyNow = () => {
    stopCopilotSpeech();
    stopLivePlayback();
    setIsSpeaking(false);
    if (liveMicMuted) setLiveMicMuted(false);
    if (!micDenied && liveStatus !== 'connected') {
      startSpeechRecognition(true);
    }
  };

  // Start Smart Phone Call (prefers SpeechRecognition two-way turn-taking for UI actions + ar-EG, OR Live API duplex)
  const startPhoneCall = async (useDirectLiveAudio = false) => {
    if (inCall) {
      endPhoneCall(true);
      return;
    }

    stopCopilotSpeech();
    stopLiveAudioChannels();
    stopSpeechRecognition();
    playCallConnectTone();

    setLiveError('');
    setMicNotice('');
    setInCall(true);
    setAutoSpeak(true);
    setCallSpeakerMuted(false);
    setLiveMicMuted(false);

    // Check mic availability cleanly (never crash on Permission denied)
    let stream: MediaStream | null = null;
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;
        setMicDenied(false);
      } else {
        setMicDenied(true);
      }
    } catch (micErr) {
      setMicDenied(true);
      const raw = micErr instanceof Error ? micErr.message : '';
      const isPerm =
        raw.toLowerCase().includes('permission') ||
        raw.toLowerCase().includes('denied') ||
        (micErr instanceof DOMException && micErr.name === 'NotAllowedError');
      setMicNotice(
        isPerm
          ? t(
              lang,
              'المتصفح حظر إذن المايكروفون (Permission denied). تقدر تكلم المساعد بالردود السريعة أو الكتابة جوه المكالمة وهيرد عليك بصوت حي فوراً!',
              'Microphone Permission denied by browser. Use quick taps or type in-call and Copilot replies by voice right away!'
            )
          : t(
              lang,
              'المايك غير متاح دلوقتي؛ كمل كتابة جوه المكالمة وهسمعك الرد على طول.',
              'Mic unavailable right now; type in-call for instant spoken answers.'
            )
      );
    }

    // Option 1: Direct Full-Duplex Gemini Live WebSocket Call (when explicitly launched OR when SpeechRecognition unavailable + mic granted)
    const SpeechRecAvailable = Boolean(
      (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
        .SpeechRecognition ||
        (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
          .webkitSpeechRecognition
    );

    if (useDirectLiveAudio || (!SpeechRecAvailable && stream)) {
      setLiveStatus('connecting');
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const outputCtx = new AudioCtx({ sampleRate: 24000 });
        if (outputCtx.state === 'suspended') {
          await outputCtx.resume().catch(() => {});
        }
        outputCtxRef.current = outputCtx;
        nextStartTimeRef.current = outputCtx.currentTime;

        let inputCtx: AudioContext | null = null;
        if (stream) {
          inputCtx = new AudioCtx({ sampleRate: 16000 });
          inputCtxRef.current = inputCtx;
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${protocol}//${window.location.host}/api/live`);
        liveWsRef.current = ws;

        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              type: 'setup',
              lang,
              voiceName,
              context: contextRef.current,
            })
          );
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data as string) as {
              type?: string;
              audio?: string;
              text?: string;
              message?: string;
            };

            if (msg.type === 'ready') {
              if (stream && inputCtx) {
                setLiveStatus('connected');
                const source = inputCtx.createMediaStreamSource(stream);
                const processor = inputCtx.createScriptProcessor(4096, 1, 1);
                processorRef.current = processor;
                source.connect(processor);
                processor.connect(inputCtx.destination);

                processor.onaudioprocess = (e) => {
                  if (
                    liveMicMutedRef.current ||
                    !liveWsRef.current ||
                    liveWsRef.current.readyState !== WebSocket.OPEN
                  ) {
                    return;
                  }
                  const pcmBase64 = float32ToPcm16Base64(e.inputBuffer.getChannelData(0));
                  liveWsRef.current.send(JSON.stringify({ type: 'audio', audio: pcmBase64 }));
                };
              } else {
                setLiveStatus('listen_only');
              }

              // Immediately answer the call warmly like picking up a phone
              ws.send(
                JSON.stringify({
                  type: 'text',
                  text:
                    lang === 'ar'
                      ? 'رد على المكالمة بترحيب مصري مختصر ودود زي التليفون واسألني تحب أساعدك في إيه.'
                      : 'Answer the call warmly in 1 short sentence and ask how you can help.',
                })
              );
              return;
            }

            if (msg.type === 'audio' && msg.audio) {
              playLivePcmChunk(msg.audio);
              return;
            }

            if (msg.type === 'interrupted') {
              stopLivePlayback();
              setIsSpeaking(false);
              return;
            }

            if (msg.type === 'inputTranscript' && msg.text) {
              inputTranscriptBufRef.current += msg.text;
              setInterimTranscript(inputTranscriptBufRef.current);
              return;
            }

            if (msg.type === 'outputTranscript' && msg.text) {
              outputTranscriptBufRef.current += msg.text;
              return;
            }

            if (msg.type === 'turnComplete') {
              const nowTs = new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });
              const userSaid = inputTranscriptBufRef.current.trim();
              const botSaid = outputTranscriptBufRef.current.trim();
              inputTranscriptBufRef.current = '';
              outputTranscriptBufRef.current = '';
              setInterimTranscript('');

              if (userSaid || botSaid) {
                setMessages((prev) => {
                  const next = [...prev];
                  if (userSaid) {
                    next.push({
                      id: `live-u-${Date.now()}-1`,
                      role: 'user',
                      text: userSaid,
                      timestamp: nowTs,
                    });
                  }
                  if (botSaid) {
                    next.push({
                      id: `live-a-${Date.now()}-2`,
                      role: 'assistant',
                      text: botSaid,
                      actionTaken: 'Live Call (gemini-3.8-live)',
                      timestamp: nowTs,
                    });
                  }
                  return next;
                });
              }
              return;
            }

            if (msg.type === 'error') {
              // Fall back seamlessly into Smart Turn-Taking Call Mode inside the same active call!
              stopLiveAudioChannels();
              setLiveStatus('smart_call');
              const opener =
                langRef.current === 'ar'
                  ? 'ألو أهلاً بيك يا فندم! حولتك على خط المكالمة الذكي السريع — اتكلم معايا وأنا سامعك وهنفذلك كل طلباتك فوراً!'
                  : 'Hello! Switched to Smart Turn-Taking Call mode — go ahead and speak anytime!';
              setMessages((prev) => [
                ...prev,
                {
                  id: `call-open-${Date.now()}`,
                  role: 'assistant',
                  text: opener,
                  actionTaken: 'Smart Two-Way Call',
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                },
              ]);
              speakText(opener, true);
              return;
            }

            if (msg.type === 'closed' && inCallRef.current && liveStatusRef.current === 'connected') {
              // If Live WebSocket times out mid-call, keep user's call alive seamlessly!
              stopLiveAudioChannels();
              setLiveStatus('smart_call');
              if (!micDeniedRef.current) {
                startSpeechRecognitionRef.current(true);
              }
            }
          } catch {
            // ignore malformed frames
          }
        };

        ws.onerror = () => {
          stopLiveAudioChannels();
          setLiveStatus('smart_call');
          const opener =
            langRef.current === 'ar'
              ? 'ألو، أهلاً بيك يا فندم في إيكو-بارك مصر! سامعك كويس دلوقتي، قولي تحب تسأل عن إيه؟'
              : 'Hello! Eco-Park Egypt Call Assistant here — what can I help you with?';
          speakText(opener, true);
        };
        return;
      } catch {
        stopLiveAudioChannels();
      }
    }

    // Option 2 (Default for crisp UI control + Egyptian Turn-Taking): Smart Phone Call Loop
    // Uses `ar-EG` SpeechRecognition with live interim words + fast Gemini 3.1 Flash-Lite + continuous turn-taking!
    if (stream) {
      // Release raw MediaStream cleanly so SpeechRecognition holds exclusive browser mic cleanly
      stream.getTracks().forEach((tTrack) => tTrack.stop());
      micStreamRef.current = null;
    }
    setLiveStatus('smart_call');

    const phoneGreeting =
      lang === 'ar'
        ? `ألو، أهلاً بيك يا فندم في إيكو-بارك مصر! أنا معاك على الخط دلوقتي — قولي عايز تسأل عن إيه في المواقف أو الطاقة؟`
        : `Hello! Eco-Park Egypt operator here. How can I help you with parking or energy right now?`;

    setMessages((prev) => [
      ...prev,
      {
        id: `call-greet-${Date.now()}`,
        role: 'assistant',
        text: phoneGreeting,
        actionTaken: lang === 'ar' ? 'مكالمة تفاعلية · مصر' : 'Interactive Phone Call',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    // Speaks greeting -> then automatically opens user's mic right when finished!
    speakText(phoneGreeting);
  };

  // Auto-speak live briefing when drawer opens (only once when opening outside an active call)
  useEffect(() => {
    if (!isOpen) {
      hasGreetedOnOpenRef.current = false;
      endPhoneCall(false);
      return;
    }

    fetch('/api/gemini/status')
      .then((r) => r.json())
      .then((d: { ready?: boolean }) => setGeminiReady(Boolean(d.ready)))
      .catch(() => setGeminiReady(false));

    if (!hasGreetedOnOpenRef.current && (autoSpeakRef.current || continuousVoiceRef.current)) {
      hasGreetedOnOpenRef.current = true;
      const timer = window.setTimeout(() => {
        if (inCallRef.current) return;
        const openingBrief =
          langRef.current === 'ar'
            ? `أهلاً بيك يا فندم في إيكو-بارك مصر! ${buildLiveEgyptBriefing(contextRef.current, 'ar')} تحب نعمل مكالمة ولا تكتبلي هنا؟`
            : `Welcome to Eco-Park Egypt! ${buildLiveEgyptBriefing(contextRef.current, 'en')}`;
        speakText(openingBrief, true);
      }, 240);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen, speakText, endPhoneCall]);

  // Passive Voice Telemetry Monitor (ONLY runs when continuousVoice is ON and NOT in an active phone call!)
  useEffect(() => {
    if (!isOpen || !continuousVoice || !autoSpeak || inCall) return;

    const intervalId = window.setInterval(() => {
      if (
        !isOpenRef.current ||
        !continuousVoiceRef.current ||
        !autoSpeakRef.current ||
        inCallRef.current ||
        isSpeakingRef.current ||
        loadingRef.current ||
        listeningRef.current
      ) {
        return;
      }
      const updateText = buildLiveEgyptBriefing(contextRef.current, langRef.current);
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.text === updateText) return prev;
        return [
          ...prev.slice(-18),
          {
            id: `pulse-${Date.now()}`,
            role: 'assistant',
            text: updateText,
            actionTaken: langRef.current === 'ar' ? 'نشرة صوتية مستمرة · مصر' : 'Live Voice Monitor · Egypt',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ];
      });
      speakText(updateText, preferInstantRef.current);
    }, 24000);

    return () => window.clearInterval(intervalId);
  }, [isOpen, continuousVoice, autoSpeak, inCall, speakText]);

  useEffect(() => {
    return () => {
      stopCopilotSpeech();
      stopLiveAudioChannels();
      stopSpeechRecognition();
    };
  }, [stopLiveAudioChannels, stopSpeechRecognition]);

  if (!isOpen) return null;

  const quickPrompts =
    lang === 'ar'
      ? [
          'إيه أخبار المواقف والطاقة دلوقتي؟',
          'احجزلي مكان VIP فوري',
          'ابعت روبوت الشحن للعربية',
          'شغّل وضع توفير الطاقة Eco',
          'شغّل روبوت الإخلاء والليزر الأخضر',
        ]
      : [
          'What is live Eco-Park status now?',
          'Book me an instant VIP bay',
          'Dispatch EV charging robot',
          'Enable Eco-Conservation Mode',
          'Activate evacuation robot & laser path',
        ];

  return (
    <div className="fixed inset-y-0 end-0 z-50 flex w-full max-w-md flex-col border-s border-white/15 bg-[#0A1724] shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
              inCall ? 'bg-emerald-500 text-slate-950 animate-pulse' : 'bg-emerald-500/20 text-emerald-400'
            }`}
          >
            {inCall ? <PhoneCall className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">
                {t(lang, 'مساعد إيكو-بارك مصر الذكي', 'Eco-Park Egypt AI Copilot')}
              </h3>
              {geminiReady !== null && (
                <span
                  className={`text-[10px] font-mono font-semibold ${
                    geminiReady ? 'text-emerald-400' : 'text-cyan-400'
                  }`}
                >
                  {geminiReady
                    ? lastLatencyMs !== null
                      ? `Gemini · ${lastLatencyMs}ms`
                      : 'Gemini · Fast'
                    : t(lang, 'محلي سريع', 'Telemetry AI')}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              {inCall
                ? t(lang, 'مكالمة تفاعلية جارية بالمصري', 'Live Two-Way Phone Call Active')
                : t(lang, 'لهجة مصرية · مكالمة تفاعلية وأوامر فورية', 'Egyptian Arabic · Two-Way Call & Commands')}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Primary Call & Continuous Voice Bar */}
      <div className="border-b border-white/10 bg-[#0B1927] px-4 py-2.5 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => startPhoneCall(false)}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition shadow-md ${
              inCall
                ? 'bg-red-500 text-white hover:bg-red-400'
                : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
            }`}
          >
            {inCall ? (
              <>
                <PhoneOff className="h-4 w-4" />
                {t(lang, `إنهاء المكالمة (${formatCallDuration(callSeconds)})`, `Hang Up (${formatCallDuration(callSeconds)})`)}
              </>
            ) : (
              <>
                <PhoneCall className="h-4 w-4" />
                {t(lang, 'مكالمة صوتية (ارد عليه ويرد عليا)', 'Start Two-Way Phone Call')}
              </>
            )}
          </button>

          {!inCall && (
            <button
              type="button"
              onClick={() => startPhoneCall(true)}
              title={t(lang, 'اتصال صوتي مباشر عبر Gemini Live 3.8', 'Direct duplex Gemini Live 3.8 audio')}
              className="flex items-center gap-1 rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-2.5 py-2 text-[11px] font-bold text-cyan-200 hover:bg-cyan-500/25"
            >
              <Radio className="h-3.5 w-3.5" />
              {t(lang, 'بث Live 3.8', 'Live 3.8')}
            </button>
          )}
        </div>

        {/* Active Interactive Phone Call HUD */}
        {inCall && (
          <div className="rounded-xl border border-emerald-400/35 bg-[#08131E] p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    isSpeaking
                      ? 'bg-cyan-400 animate-ping'
                      : listening || liveStatus === 'connected'
                        ? 'bg-emerald-400 animate-pulse'
                        : loading
                          ? 'bg-amber-400 animate-pulse'
                          : 'bg-slate-400'
                  }`}
                />
                <span className="text-xs font-bold text-white">
                  {isSpeaking
                    ? t(lang, 'المساعد بيرد عليك دلوقتي...', 'Assistant is speaking...')
                    : loading
                      ? t(lang, 'بيحضرلك الرد...', 'Thinking...')
                      : listening || liveStatus === 'connected'
                        ? t(lang, 'دورك — اتكلم وأنا سامعك!', 'Your turn — speak naturally!')
                        : micDenied
                          ? t(lang, 'مكالمة شغالة (اكتب أو اضغط رد سريع)', 'Call active (tap quick reply or type)')
                          : t(lang, 'جاهز على الخط...', 'On the line...')}
                </span>
              </div>
              <span className="font-mono text-xs font-bold text-emerald-400 tabular-nums">
                {formatCallDuration(callSeconds)}
              </span>
            </div>

            {/* Live Equalizer / Speech Waveform Visualizer */}
            <div className="flex items-center justify-center gap-1.5 h-8 rounded-lg bg-[#0D1E2E] px-3">
              {[0.4, 0.75, 1, 0.65, 0.9, 0.5, 0.85, 0.6, 0.95, 0.45].map((h, idx) => {
                const active = isSpeaking || listening || liveStatus === 'connected';
                return (
                  <span
                    key={idx}
                    style={{
                      height: active ? `${Math.round(h * 22) + 4}px` : '4px',
                      animationDelay: `${idx * 70}ms`,
                    }}
                    className={`w-1.5 rounded-full transition-all duration-150 ${
                      isSpeaking
                        ? 'bg-cyan-400 animate-pulse'
                        : listening || liveStatus === 'connected'
                          ? 'bg-emerald-400 animate-pulse'
                          : 'bg-slate-600'
                    }`}
                  />
                );
              })}
            </div>

            {/* Real-time interim captions while the user talks */}
            {interimTranscript && (
              <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-200">
                <span className="font-semibold text-emerald-400 me-1">
                  {t(lang, 'بتقول:', 'Hearing:')}
                </span>
                {interimTranscript}
              </div>
            )}

            {/* Real Phone Call Action Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {isSpeaking ? (
                <button
                  type="button"
                  onClick={interruptAndReplyNow}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-cyan-400 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-cyan-300"
                >
                  <Mic className="h-3.5 w-3.5" />
                  {t(lang, 'قاطعه ورد عليه دلوقتي', 'Interrupt & Reply')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (liveStatus === 'connected') {
                      setLiveMicMuted((m) => !m);
                    } else if (listening) {
                      setLiveMicMuted(true);
                      stopSpeechRecognition();
                    } else {
                      setLiveMicMuted(false);
                      startSpeechRecognition(false);
                    }
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                    liveMicMuted
                      ? 'border-amber-400/50 bg-amber-500/15 text-amber-200'
                      : listening || liveStatus === 'connected'
                        ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-300'
                        : 'border-white/15 bg-[#12263A] text-slate-200 hover:border-emerald-400/50'
                  }`}
                >
                  {liveMicMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                  {liveMicMuted
                    ? t(lang, 'إلغاء كتم المايك', 'Unmute Mic')
                    : listening || liveStatus === 'connected'
                      ? t(lang, 'المايك شغال (اضغط للكتم)', 'Mic Live (Mute)')
                      : t(lang, 'اتكلم دلوقتي', 'Speak Now')}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  const next = !callSpeakerMuted;
                  setCallSpeakerMuted(next);
                  if (next) {
                    stopCopilotSpeech();
                    stopLivePlayback();
                    setIsSpeaking(false);
                  }
                }}
                className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                  callSpeakerMuted
                    ? 'border-red-400/50 bg-red-500/15 text-red-200'
                    : 'border-white/15 bg-[#12263A] text-slate-200'
                }`}
              >
                {callSpeakerMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                {callSpeakerMuted ? t(lang, 'السماعة صامتة', 'Speaker OFF') : t(lang, 'سماعة', 'Speaker')}
              </button>
            </div>
          </div>
        )}

        {(micNotice || liveError) && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-200">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
            <div className="flex-1 leading-relaxed">{micNotice || liveError}</div>
          </div>
        )}
      </div>

      {/* Voice Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#0D1E2E] px-4 py-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              const next = !autoSpeak;
              setAutoSpeak(next);
              if (!next) {
                setContinuousVoice(false);
                stopCopilotSpeech();
                setIsSpeaking(false);
              }
            }}
            className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${
              autoSpeak
                ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-300'
                : 'border-white/10 bg-[#12263A] text-slate-400'
            }`}
          >
            {autoSpeak ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            {autoSpeak ? t(lang, 'نطق تلقائي', 'Voice ON') : t(lang, 'صامت', 'Muted')}
          </button>

          {!inCall && (
            <button
              type="button"
              onClick={() => {
                const next = !continuousVoice;
                setContinuousVoice(next);
                if (next) {
                  setAutoSpeak(true);
                  speakText(buildLiveEgyptBriefing(contextRef.current, lang), true);
                } else {
                  stopCopilotSpeech();
                  setIsSpeaking(false);
                }
              }}
              className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${
                continuousVoice
                  ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-300'
                  : 'border-white/10 bg-[#12263A] text-slate-300 hover:border-emerald-400/40'
              }`}
            >
              <Radio className="h-3 w-3" />
              {continuousVoice ? t(lang, 'نشرة متواصلة', 'Live Feed ON') : t(lang, 'صوت مستمر', 'Continuous')}
            </button>
          )}

          <button
            type="button"
            onClick={() => setPreferInstantVoice((v) => !v)}
            title={t(lang, 'التبديل بين النطق الفوري 0ms وصوت Gemini', 'Toggle instant speech vs Gemini neural TTS')}
            className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${
              preferInstantVoice
                ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-200'
                : 'border-white/10 bg-[#12263A] text-slate-300'
            }`}
          >
            <Zap className="h-3 w-3" />
            {preferInstantVoice ? t(lang, 'نطق 0ms', '0ms Voice') : t(lang, 'صوت Gemini', 'Gemini Voice')}
          </button>

          {isSpeaking && (
            <button
              type="button"
              onClick={() => {
                stopCopilotSpeech();
                stopLivePlayback();
                setIsSpeaking(false);
              }}
              className="flex items-center gap-1 rounded-lg border border-red-400/40 bg-red-500/15 px-2 py-1 text-[11px] font-semibold text-red-300"
            >
              <Square className="h-3 w-3" />
              {t(lang, 'إيقاف', 'Stop')}
            </button>
          )}
        </div>

        <select
          value={voiceName}
          onChange={(e) => setVoiceName(e.target.value)}
          aria-label="Gemini Voice"
          className="rounded-lg border border-white/10 bg-[#08121D] px-2 py-1 text-[11px] text-slate-200 outline-none"
        >
          {VOICE_OPTIONS.map((v) => (
            <option key={v.id} value={v.id}>
              {lang === 'ar' ? v.labelAr : v.labelEn}
            </option>
          ))}
        </select>
      </div>

      {/* Quick Prompts */}
      <div className="flex flex-wrap gap-1.5 border-b border-white/10 bg-[#0B1927] p-3">
        {quickPrompts.map((qp) => (
          <button
            key={qp}
            onClick={() => sendPrompt(qp)}
            disabled={loading}
            className="rounded-lg border border-white/10 bg-[#12263A] px-2.5 py-1 text-[11px] text-slate-200 hover:border-emerald-400/50 hover:text-emerald-300 disabled:opacity-50"
          >
            {qp}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[88%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-emerald-500 font-medium text-slate-950'
                  : 'border border-white/10 bg-[#122436] text-slate-100'
              }`}
            >
              <div>{m.text}</div>
              {m.role === 'assistant' && (
                <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/10 pt-1.5">
                  {m.actionTaken ? (
                    <div className="flex items-center gap-1 font-mono text-[10px] text-emerald-400">
                      <Sparkles className="h-3 w-3" />
                      <span>{m.actionTaken}</span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-400">
                      {t(lang, 'صوت إيكو-بارك مصر', 'Eco-Park Egypt Voice')}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => speakText(m.text)}
                    className="flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-cyan-300 hover:bg-cyan-500/20"
                  >
                    <Volume2 className="h-3 w-3" />
                    {t(lang, 'اسمع', 'Speak')}
                  </button>
                </div>
              )}
            </div>
            <span className="mt-1 font-mono text-[10px] text-slate-500">{m.timestamp}</span>
          </div>
        ))}
        {loading && (
          <div className="rounded-xl border border-white/10 bg-[#122436] px-4 py-2.5 text-xs text-emerald-400">
            {t(lang, 'ثواني يا فندم، بيرد عليك بالصوت...', 'Preparing fast voice reply...')}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendPrompt(input);
        }}
        className="flex items-center gap-2 border-t border-white/10 bg-[#0D1E2E] p-3"
      >
        <button
          type="button"
          onClick={() => startSpeechRecognition(false)}
          disabled={loading || liveStatus === 'connected'}
          title={t(lang, 'اتكلم بالمايك بالمصري', 'Speak with microphone')}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition ${
            listening
              ? 'border-red-400 bg-red-500/20 text-red-300 animate-pulse'
              : micDenied
                ? 'border-amber-400/40 bg-amber-500/10 text-amber-300'
                : 'border-white/10 bg-[#08121D] text-cyan-400 hover:border-cyan-400/50 disabled:opacity-40'
          }`}
        >
          {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            inCall
              ? t(lang, 'اتكلم أو اكتب ردك جوه المكالمة...', 'Speak or type your reply in call...')
              : listening
                ? t(lang, 'سامعك دلوقتي، اتكلم بالمصري...', 'Listening now...')
                : t(lang, 'اكتب سؤالك أو أمرك بالمصري...', 'Ask in Egyptian Arabic or English...')
          }
          className="flex-1 rounded-xl border border-white/10 bg-[#08121D] px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-400"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
};

export type CopilotActionDispatch = {
  action: string;
  payload?: string;
  onNavigate: (tab: NavTab) => void;
  onLaunchCar: (type: VehicleType) => void;
};
