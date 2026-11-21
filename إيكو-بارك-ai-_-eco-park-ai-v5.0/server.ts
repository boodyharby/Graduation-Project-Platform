import express from 'express';
import http from 'http';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, LiveServerMessage, Modality, ThinkingLevel, Type } from '@google/genai';
import { WebSocket, WebSocketServer } from 'ws';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function resolveApiKey(): string {
  const candidates = [
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_API_KEY,
    process.env.GOOGLE_GENAI_API_KEY,
    process.env.AI_STUDIO_API_KEY,
    process.env.API_KEY,
  ];
  for (const raw of candidates) {
    if (!raw) continue;
    const cleaned = raw.trim().replace(/^['"]|['"]$/g, '');
    if (cleaned && cleaned !== 'MY_GEMINI_API_KEY' && cleaned.length > 10) {
      return cleaned;
    }
  }
  return '';
}

function getGeminiClient() {
  const apiKey = resolveApiKey();
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function cleanJsonString(raw: string): string {
  return raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

const ttsCache = new Map<string, { audioBase64: string; mimeType: string }>();

function cacheTtsResult(key: string, value: { audioBase64: string; mimeType: string }) {
  if (ttsCache.size >= 40) {
    const oldestKey = ttsCache.keys().next().value;
    if (oldestKey) ttsCache.delete(oldestKey);
  }
  ttsCache.set(key, value);
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object') {
    const maybe = err as { message?: unknown; reason?: unknown; error?: { message?: unknown } };
    if (typeof maybe.message === 'string' && maybe.message) return maybe.message;
    if (typeof maybe.reason === 'string' && maybe.reason) return maybe.reason;
    if (typeof maybe.error?.message === 'string' && maybe.error.message) return maybe.error.message;
  }
  return String(err || 'Unknown error');
}

function buildTelemetryFallbackReply(
  message: string,
  lang: 'ar' | 'en',
  ctx: Record<string, unknown>
): { reply: string; action: string; actionPayload?: string; mode: 'telemetry-assist' } {
  const q = message.toLowerCase();
  const bess = Number(ctx.bessCharge ?? 100);
  const solar = Number(ctx.solarKw ?? 0);
  const occ = Number(ctx.occupancyPct ?? 0);
  const avail = Number(ctx.availableSpots ?? 10);
  const co2 = Number(ctx.totalCo2Kg ?? 0);
  const avgTemp = Number(ctx.avgTempC ?? 27);

  if (q.includes('vip') || q.includes('حجز') || q.includes('احجز') || q.includes('في آي بي')) {
    return {
      reply:
        lang === 'ar'
          ? 'تحت أمرك يا فندم! جهزتلك حالاً حجز VIP في الصف الأول مع أولوية الشحن السريع وإصدار التذكرة الذهبية.'
          : 'Got it! Prepared an Executive VIP bay in the front row with priority fast charging.',
      action: 'book_vip',
      mode: 'telemetry-assist',
    };
  }
  if (q.includes('روبوت') && (q.includes('شحن') || q.includes('كهرب') || q.includes('عربية'))) {
    return {
      reply:
        lang === 'ar'
          ? 'تمام، ببعتلك دلوقتي روبوت الشحن المتنقل بقدرة 45 كيلوواط عشان يشحن العربية في مكانها.'
          : 'Dispatching EcoCharge Bot X1 mobile 45kW fast charger to the bay right now.',
      action: 'dispatch_charging_robot',
      mode: 'telemetry-assist',
    };
  }
  if (q.includes('اخلاء') || q.includes('إخلاء') || q.includes('ليزر') || q.includes('حريق') || q.includes('evac') || q.includes('safety')) {
    return {
      reply:
        lang === 'ar'
          ? 'شغلت روبوت الإخلاء والسلامة حالاً ومعاه الليزر الأخضر والنداء الصوتي لتأمين الخروج.'
          : 'SafeGuard Evac-Bot is active now with the green laser corridor and voice evacuation guidance.',
      action: 'trigger_evacuation_robot',
      mode: 'telemetry-assist',
    };
  }
  if (q.includes('ترشيد') || q.includes('توفير') || q.includes('conservation') || q.includes('eco')) {
    return {
      reply:
        lang === 'ar'
          ? `تمام يا فندم، شغلتلك وضع توفير الطاقة دلوقتي عشان نحافظ على بطاريات BESS اللي عند ${bess}% ونأمن الأحمال.`
          : `Eco-Conservation Mode is active now to protect BESS (${bess}%) and stabilize site loads.`,
      action: 'activate_eco_conservation',
      mode: 'telemetry-assist',
    };
  }
  if (q.includes('18') || q.includes('20') || q.includes('إنذار') || q.includes('bess')) {
    return {
      reply:
        lang === 'ar'
          ? 'عملتلك تجربة إنذار انخفاض بطارية BESS لـ 18% مع التنبيه الصوتي عشان تطمن على جاهزية النظام.'
          : 'Simulated BESS drop to 18% and triggered safety alarms.',
      action: 'simulate_bess_low',
      mode: 'telemetry-assist',
    };
  }
  if (q.includes('موقف') || q.includes('مكان جديد') || q.includes('أضف') || q.includes('زود') || q.includes('add bay')) {
    return {
      reply:
        lang === 'ar'
          ? 'زودتلك موقف ذكي جديد أوتوماتيك وظهر حالاً في الخريطة والمحاكي الثنائي والثلاثي الأبعاد.'
          : 'Added a new smart bay dynamically across 2D and 3D simulators.',
      action: 'add_bay',
      mode: 'telemetry-assist',
    };
  }
  if (q.includes('3d') || q.includes('كهربائية') || q.includes('سيارة') || q.includes('عربية') || q.includes('launch')) {
    return {
      reply:
        lang === 'ar'
          ? 'دخّلت عربية كهرباء في المحاكي ثلاثي الأبعاد ووجهتها للمسار الأخضر المظلل بالطاقة الشمسية.'
          : 'Dispatched an EV into the 3D simulator along the shaded green route.',
      action: 'launch_car',
      actionPayload: 'ELECTRIC',
      mode: 'telemetry-assist',
    };
  }

  return {
    reply:
      lang === 'ar'
        ? `الوضع دلوقتي في إيكو-بارك مصر مستقر: نسبة الإشغال ${occ}% وعندنا ${avail} مكان فاضي، بطارية BESS شغالة على ${bess}%، والطاقة الشمسية بتولد ${solar} كيلوواط. متوسط الحرارة في الجراج ${avgTemp} درجة، ووفرنا لحد دلوقتي ${co2} كجم كربون. أنصحك في الجو ده توجه العربيات الكهرباء تحت المظلات الشمسية عشان نبرد البطاريات ونزود التوفير.`
        : `Eco-Park Egypt live status: occupancy ${occ}% (${avail} open bays), BESS at ${bess}%, solar output ${solar} kW, mean temp ${avgTemp}°C, and ${co2} kg CO2 avoided. Route EVs under solar canopies to keep battery temps down.`,
    action: 'none',
    mode: 'telemetry-assist',
  };
}

async function generateWithRetryAndFallback(
  ai: GoogleGenAI,
  buildParams: (model: string) => Parameters<GoogleGenAI['models']['generateContent']>[0],
  preferredModels: string[] = ['gemini-3.1-flash-lite', 'gemini-4-hydrogen']
) {
  let lastErr: unknown;

  for (let i = 0; i < preferredModels.length; i++) {
    try {
      return await ai.models.generateContent(buildParams(preferredModels[i]));
    } catch (err) {
      lastErr = err;
      const msg = extractErrorMessage(err);
      const isRetryable =
        msg.includes('503') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('429') ||
        msg.includes('404') ||
        msg.includes('NOT_FOUND');
      if (!isRetryable) break;
      await new Promise((r) => setTimeout(r, 120));
    }
  }
  throw lastErr;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '12mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'eco-park-ai-v5', timestamp: new Date().toISOString() });
  });

  app.get('/api/gemini/status', (_req, res) => {
    const ready = Boolean(resolveApiKey());
    res.json({
      ready,
      mode: ready ? 'gemini' : 'telemetry-assist',
      copilotModel: 'gemini-3.1-flash-lite',
      fallbackModel: 'gemini-4-hydrogen',
      ttsModel: 'gemini-3.8-flash-lite-tts',
      liveModel: 'gemini-3.8-live',
    });
  });

  app.get('/api/maps/config', (_req, res) => {
    const apiKey = (
      process.env.VITE_GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      ''
    ).trim();
    res.json({ apiKey });
  });

  app.post('/api/copilot', async (req, res) => {
    const { message, lang = 'ar', context, history = [], callMode = false } = req.body ?? {};
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.json(buildTelemetryFallbackReply(message, lang === 'en' ? 'en' : 'ar', context ?? {}));
      return;
    }

    try {
      const systemInstruction = `You are the Eco-Park AI Egypt Master Copilot (مساعد إيكو-بارك مصر الذكي), an expert smart-parking, clean-energy microgrid, BESS storage, V2G, EV charging robotics, heat-island mitigation, and green mobility operations engineer operating in **Egypt (مصر)** — aligned with Egypt Vision 2030, Cairo/New Administrative Capital/Alexandria/Kafr El-Sheikh smart parking infrastructure, hot Egyptian summer thermal care, and savings in Egyptian Pounds (EGP / جنيه مصري).
CRITICAL VOICE & STYLE RULES:
- ${lang === 'ar' ? 'Always speak naturally, warmly, and concisely in **Egyptian Arabic (العامية المصرية المحترمة الواضحة)** — e.g. "أهلاً بيك يا فندم"، "أيوه معاك"، "دلوقتي"، "العربية الكهرباء"، "الموقف الفاضي"، "تحت أمرك". Do NOT use Gulf/Saudi phrasing or stiff classical Arabic.' : 'Speak warmly, naturally, and concisely in English with Egypt smart-mobility context.'}
- ${callMode ? 'LIVE PHONE CALL MODE: You are in a real-time back-and-forth phone call! Answer in 1 to 2 short, lively conversational sentences (under 30 words) like talking on the phone, then naturally invite the caller to respond or confirm ("تحب أعملك كده؟" / "معاك، قولي تحب نعمل إيه تاني؟").' : 'Keep replies crisp (2 to 3 natural spoken sentences max) so TTS speaks fast and feels conversational.'}
- NEVER use markdown symbols (*, #, -, bullets) so text sounds natural when spoken aloud.
- Reference live telemetry numbers directly when relevant (BESS %, solar kW, avg/peak °C, CO2 kg saved, open bays).
You can trigger a live UI action when requested:
- "none": informational/advisory reply
- "navigate": switch tab ("dashboard" | "parking" | "livemap" | "reservations" | "robots" | "billing" | "forecast" | "operations" | "energy" | "wallet" | "sim2d" | "sim3d" | "reports" | "search" | "maintenance" | "audio" | "users" | "settings" | "data_hygiene" | "help" | "language")
- "activate_eco_conservation": enable Eco-Conservation Mode
- "simulate_bess_low": simulate BESS drop to 18%
- "restore_bess": restore BESS to 85%
- "launch_car": launch simulated vehicle ("ELECTRIC" | "HYBRID" | "GASOLINE" | "DIESEL")
- "add_bay": add a new smart parking bay in 2D & 3D
- "trigger_smoke_alert": trigger smoke/fire alert
- "clear_smoke_alert": clear smoke/fire alert
- "dispatch_charging_robot": send 45kW mobile EV charging robot
- "trigger_evacuation_robot": dispatch SafeGuard evacuation robot with green laser corridor
- "book_vip": create instant VIP Gold reservation in front bay
- "run_emergency_drill": open Operations Hub drill
- "set_lighting_3d": switch 3D lighting ("sunny" | "sunset" | "night")

Live telemetry snapshot (Egypt site): ${JSON.stringify(context ?? {})}`;

      const safeHistory = Array.isArray(history)
        ? history
            .slice(-6)
            .filter(
              (m): m is { role: 'user' | 'assistant'; text: string } =>
                Boolean(m && typeof m.text === 'string' && (m.role === 'user' || m.role === 'assistant'))
            )
            .map((m) => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.text }],
            }))
        : [];

      const response = await generateWithRetryAndFallback(ai, (model) => ({
        model,
        contents: [...safeHistory, { role: 'user', parts: [{ text: message }] }],
        config: {
          systemInstruction,
          ...(model === 'gemini-4-hydrogen'
            ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
            : {}),
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: {
                type: Type.STRING,
                description:
                  'Concise, warm spoken Egyptian Arabic (or English) reply without markdown.',
              },
              action: {
                type: Type.STRING,
                description:
                  'One of: none, navigate, activate_eco_conservation, simulate_bess_low, restore_bess, launch_car, add_bay, trigger_smoke_alert, clear_smoke_alert, dispatch_charging_robot, trigger_evacuation_robot, book_vip, run_emergency_drill, set_lighting_3d',
              },
              actionPayload: {
                type: Type.STRING,
                description: 'Optional parameter for the action (e.g. tab name, fuel type, or lighting mode).',
              },
            },
            required: ['reply', 'action'],
          },
        },
      }));

      const raw = cleanJsonString(response.text ?? '{}');
      let parsed: { reply: string; action: string; actionPayload?: string; mode?: string };
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = { reply: raw || 'تمام يا فندم، الطلب اتنفذ.', action: 'none' };
      }

      res.json({ ...parsed, mode: 'gemini' });
    } catch (error) {
      const errMsg = extractErrorMessage(error);
      console.warn('Copilot Gemini fallback engaged:', errMsg);
      const fallback = buildTelemetryFallbackReply(
        message,
        lang === 'en' ? 'en' : 'ar',
        context ?? {}
      );
      res.json({
        ...fallback,
        warning: errMsg.includes('PERMISSION_DENIED') || errMsg.includes('403') ? errMsg : undefined,
      });
    }
  });

  app.post('/api/tts', async (req, res) => {
    try {
      const { text, lang = 'ar', voiceName = 'Kore', styleHint } = req.body ?? {};
      if (!text || typeof text !== 'string') {
        res.status(400).json({ error: 'Text is required for TTS' });
        return;
      }

      const apiKey = resolveApiKey();
      if (!apiKey) {
        res.json({ fallbackBrowserSpeech: true });
        return;
      }

      const trimmedText = text.trim().slice(0, 650);
      const selectedVoice = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'].includes(voiceName)
        ? voiceName
        : 'Zephyr';

      const stylePrompt =
        typeof styleHint === 'string' && styleHint.trim()
          ? styleHint.trim()
          : lang === 'ar'
            ? 'Warm, friendly, fluent Egyptian Arabic (Masri dialect) smart-city operations engineer speaking naturally and clearly'
            : 'Warm, clear, fluent smart-city environmental engineer';

      const cacheKey = `${selectedVoice}|${lang}|${stylePrompt.slice(0, 40)}|${trimmedText}`;
      const cached = ttsCache.get(cacheKey);
      if (cached) {
        res.json(cached);
        return;
      }

      const ttsAi = new GoogleGenAI({
        apiKey,
        apiVersion: 'v1alpha',
        httpOptions: {
          headers: { 'User-Agent': 'aistudio-build' },
        },
      });

      const ttsPromise = ttsAi.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: trimmedText,
                speechMetadata: {
                  style: stylePrompt,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: selectedVoice },
            },
          },
        },
      });

      const timeoutPromise = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), 4000)
      );
      const response = await Promise.race([ttsPromise, timeoutPromise]);

      if (response) {
        const part = response.candidates?.[0]?.content?.parts?.[0];
        const base64Audio = part?.inlineData?.data;
        const mimeType = part?.inlineData?.mimeType || 'audio/wav';
        if (base64Audio) {
          const payload = { audioBase64: base64Audio, mimeType };
          cacheTtsResult(cacheKey, payload);
          res.json(payload);
          return;
        }
      }

      // Clean fast signal for client ar-EG Web Speech fallback
      res.json({ fallbackBrowserSpeech: true });
    } catch (error) {
      console.warn('Gemini TTS fallback:', extractErrorMessage(error));
      res.json({ fallbackBrowserSpeech: true });
    }
  });

  app.post('/api/anpr', async (req, res) => {
    try {
      const { imageBase64, mimeType = 'image/jpeg', lang = 'ar' } = req.body ?? {};
      if (!imageBase64 || typeof imageBase64 !== 'string') {
        res.status(400).json({ error: 'imageBase64 is required' });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error:
            lang === 'ar'
              ? 'مفتاح Gemini API غير مهيأ لتحليل الصور.'
              : 'GEMINI_API_KEY is not configured for vision analysis.',
        });
        return;
      }

      const cleanedBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

      const response = await generateWithRetryAndFallback(ai, (model) => ({
        model,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: cleanedBase64,
              },
            },
            {
              text: `Analyze this vehicle/license plate image for a Saudi/Arab smart parking ANPR camera system.
Extract or infer realistically:
- plateNumber (e.g. "أ ب ج 4821" or visible plate characters; if unreadable provide a realistic detected code)
- vehicleType: must be strictly one of "ELECTRIC", "HYBRID", "GASOLINE", "DIESEL" (look for EV badges/green plates/no grille, hybrid badges, SUV/sedan/truck cues)
- vehicleModel: brief vehicle make/model description
- color: vehicle color
- confidence: number between 85 and 99
Respond in JSON.`,
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              plateNumber: { type: Type.STRING },
              vehicleType: {
                type: Type.STRING,
                enum: ['ELECTRIC', 'HYBRID', 'GASOLINE', 'DIESEL'],
              },
              vehicleModel: { type: Type.STRING },
              color: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
            },
            required: ['plateNumber', 'vehicleType', 'vehicleModel', 'color', 'confidence'],
          },
        },
      }));

      const raw = cleanJsonString(response.text ?? '{}');
      const parsed = JSON.parse(raw);
      res.json(parsed);
    } catch (error) {
      console.error('ANPR Vision API error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to analyze ANPR image',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const httpServer = http.createServer(app);
  const liveWss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    const urlPath = (req.url || '').split('?')[0];
    if (urlPath === '/api/live') {
      liveWss.handleUpgrade(req, socket, head, (ws) => {
        liveWss.emit('connection', ws, req);
      });
    }
  });

  liveWss.on('connection', (clientWs: WebSocket) => {
    let session: Awaited<ReturnType<GoogleGenAI['live']['connect']>> | null = null;
    let isConnecting = false;
    let closed = false;

    const sendJson = (payload: Record<string, unknown>) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(payload));
      }
    };

    clientWs.on('message', async (rawData) => {
      try {
        const msg = JSON.parse(rawData.toString()) as {
          type?: string;
          lang?: 'ar' | 'en';
          voiceName?: string;
          context?: Record<string, unknown>;
          audio?: string;
          text?: string;
        };

        if (msg.type === 'setup') {
          if (session || isConnecting) return;
          isConnecting = true;
          const ai = getGeminiClient();
          const lang = msg.lang === 'en' ? 'en' : 'ar';
          if (!ai) {
            isConnecting = false;
            sendJson({
              type: 'error',
              message:
                lang === 'ar'
                  ? 'مفتاح Gemini API غير مهيأ لتشغيل المحادثة الصوتية الفورية.'
                  : 'GEMINI_API_KEY is not configured for Live Voice conversations.',
            });
            return;
          }

          const selectedVoice = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'].includes(
            String(msg.voiceName || '')
          )
            ? String(msg.voiceName)
            : 'Zephyr';

          const systemInstruction = `You are the Eco-Park AI Egypt Real-Time Phone Copilot (مساعد إيكو-بارك مصر على المكالمة).
You are on a LIVE TWO-WAY VOICE PHONE CALL with a driver or operations manager in Egypt (مصر).
${lang === 'ar' ? 'Speak warmly, briskly, and naturally in Egyptian Arabic (اللهجة المصرية الودودة — زي مكالمة تليفون حقيقية، مثلاً: "ألو أهلاً بيك يا فندم، معاك مساعد إيكو-بارك!").' : 'Speak warmly, briskly, and naturally in English like a real phone operator.'}
Keep every spoken turn short (1 to 2 crisp sentences), helpful, and interactive so the caller can talk back and forth easily without waiting. Never give long monologues.
Help with open parking bays, BESS battery reserve, solar power, EV charging robots, heat alerts, and emergency safety in Egypt.
Live telemetry snapshot: ${JSON.stringify(msg.context ?? {})}`;

          try {
            const connectLive = async (client: GoogleGenAI) =>
              client.live.connect({
                model: 'gemini-3.8-live',
                config: {
                  responseModalities: [Modality.AUDIO],
                  speechConfig: {
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: selectedVoice },
                    },
                  },
                  inputAudioTranscription: {},
                  outputAudioTranscription: {},
                  systemInstruction,
                },
                callbacks: {
                  onmessage: (message: LiveServerMessage) => {
                    if (closed) return;
                    const content = message.serverContent;
                    if (content?.inputTranscription?.text) {
                      sendJson({ type: 'inputTranscript', text: content.inputTranscription.text });
                    }
                    if (content?.outputTranscription?.text) {
                      sendJson({ type: 'outputTranscript', text: content.outputTranscription.text });
                    }
                    for (const part of content?.modelTurn?.parts ?? []) {
                      if (part.inlineData?.data) {
                        sendJson({ type: 'audio', audio: part.inlineData.data });
                      }
                    }
                    if (content?.interrupted) {
                      sendJson({ type: 'interrupted' });
                    }
                    if (content?.turnComplete) {
                      sendJson({ type: 'turnComplete' });
                    }
                  },
                  onerror: (err) => {
                    const reason = extractErrorMessage(err);
                    console.warn('Live API onerror:', reason);
                    sendJson({
                      type: 'error',
                      message: reason || 'Live session error',
                    });
                  },
                  onclose: (ev) => {
                    const reason = extractErrorMessage(ev);
                    if (!closed) {
                      sendJson({ type: 'closed', message: reason || undefined });
                    }
                  },
                },
              });

            let liveSession: Awaited<ReturnType<GoogleGenAI['live']['connect']>>;
            try {
              const apiKey = resolveApiKey();
              const alphaAi = new GoogleGenAI({
                apiKey,
                apiVersion: 'v1alpha',
                httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
              });
              liveSession = await connectLive(alphaAi);
            } catch {
              liveSession = await connectLive(ai);
            }

            if (closed) {
              liveSession.close();
              return;
            }
            session = liveSession;
            isConnecting = false;
            sendJson({ type: 'ready' });
          } catch (err) {
            isConnecting = false;
            const reason = extractErrorMessage(err);
            console.warn('Live API connect failed:', reason);
            sendJson({
              type: 'error',
              message: reason || 'Failed to connect to gemini-3.8-live',
            });
          }
          return;
        }

        if (msg.type === 'audio' && msg.audio && session) {
          session.sendRealtimeInput({
            audio: { data: msg.audio, mimeType: 'audio/pcm;rate=16000' },
          });
          return;
        }

        if (msg.type === 'text' && msg.text && session) {
          session.sendRealtimeInput({ text: msg.text });
        }
      } catch (err) {
        sendJson({
          type: 'error',
          message: err instanceof Error ? err.message : 'Malformed Live API message',
        });
      }
    });

    clientWs.on('close', () => {
      closed = true;
      if (session) {
        try {
          session.close();
        } catch {
          // ignore close errors
        }
        session = null;
      }
    });
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Eco-Park AI v5.0 server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
