// Multi-Provider AI Assistant Engine
// Supports: Groq (Llama 3.3 70B & Whisper), Google Gemini (Gemini 2.5 Flash), OpenAI (GPT-4o Mini & TTS-1)
// Never hardcodes keys: reads exclusively from import.meta.env (VITE_GROQ_KEY, VITE_GEMINI_KEY, VITE_OPENAI_KEY)

// 1. Unified Models Configuration (Current official model names)
export const AI_MODELS_CONFIG = {
  groq: {
    name: 'Groq',
    badge: 'AI: GROQ',
    chatModel: 'llama-3.3-70b-versatile',
    transcriptionModel: 'whisper-large-v3',
    chatEndpoint: 'https://api.groq.com/openai/v1/chat/completions',
    transcriptionEndpoint: 'https://api.groq.com/openai/v1/audio/transcriptions'
  },
  gemini: {
    name: 'Gemini',
    badge: 'AI: GEMINI',
    chatModel: 'gemini-2.5-flash',
    chatEndpoint: (key) => `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`
  },
  openai: {
    name: 'OpenAI',
    badge: 'AI: OPENAI',
    chatModel: 'gpt-4o-mini',
    ttsModel: 'tts-1',
    ttsVoice: 'alloy',
    chatEndpoint: 'https://api.openai.com/v1/chat/completions',
    ttsEndpoint: 'https://api.openai.com/v1/audio/speech'
  }
};

// Safe API key storage helpers (stores keys in localStorage under 'puppet_keys')
export function getSavedPuppetKeys() {
  if (typeof localStorage === 'undefined') return { groq: '', gemini: '', openai: '' };
  try {
    const raw = localStorage.getItem('puppet_keys');
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        groq: String(parsed.groq || '').trim(),
        gemini: String(parsed.gemini || '').trim(),
        openai: String(parsed.openai || '').trim()
      };
    }
  } catch (_) {}
  return { groq: '', gemini: '', openai: '' };
}

export function savePuppetKeys(keys = {}) {
  if (typeof localStorage === 'undefined') return;
  const payload = {
    groq: String(keys.groq || '').trim(),
    gemini: String(keys.gemini || '').trim(),
    openai: String(keys.openai || '').trim()
  };
  localStorage.setItem('puppet_keys', JSON.stringify(payload));
}

export function clearPuppetKeys() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem('puppet_keys');
}

// 2. Personality / System Prompt Configuration
export const DEFAULT_SYSTEM_PROMPT = "You are Puppet Agent, a friendly voice assistant. Answer in 1 to 3 short spoken sentences. No markdown, no lists, no emojis. Reply in the language the user is speaking. If you do not know something, say so.";

export function getSavedSystemPrompt() {
  if (typeof localStorage === 'undefined') return DEFAULT_SYSTEM_PROMPT;
  try {
    const saved = localStorage.getItem('puppet_agent_system_prompt');
    if (saved && saved.trim()) return saved.trim();
  } catch (_) {}
  return DEFAULT_SYSTEM_PROMPT;
}

export function saveSystemPrompt(prompt) {
  if (typeof localStorage === 'undefined') return;
  const clean = (prompt && prompt.trim()) ? prompt.trim() : DEFAULT_SYSTEM_PROMPT;
  try {
    localStorage.setItem('puppet_agent_system_prompt', clean);
  } catch (_) {}
}

export function resetSystemPrompt() {
  if (typeof localStorage === 'undefined') return DEFAULT_SYSTEM_PROMPT;
  try {
    localStorage.setItem('puppet_agent_system_prompt', DEFAULT_SYSTEM_PROMPT);
  } catch (_) {}
  return DEFAULT_SYSTEM_PROMPT;
}

// 3. Voice Controls Configuration (Speed, Pitch, Volume, Engine, OpenAI voices)
export const OPENAI_TTS_VOICES = [
  'alloy',
  'ash',
  'coral',
  'echo',
  'fable',
  'onyx',
  'nova',
  'sage',
  'shimmer'
];

export function getSavedVoiceControls() {
  if (typeof localStorage === 'undefined') {
    return {
      speed: 1.0,
      pitch: 1.0,
      volume: 1.0,
      voiceURI: '',
      engine: 'browser',
      openAiVoice: 'alloy'
    };
  }
  try {
    const rawSpeed = localStorage.getItem('puppet_voice_speed');
    const rawPitch = localStorage.getItem('puppet_voice_pitch');
    const rawVolume = localStorage.getItem('puppet_voice_volume');
    const rawVoiceURI = localStorage.getItem('puppet_voice_uri');
    const rawEngine = localStorage.getItem('puppet_voice_engine');
    const rawOpenAiVoice = localStorage.getItem('puppet_openai_voice');

    return {
      speed: rawSpeed !== null ? Math.min(1.3, Math.max(0.7, parseFloat(rawSpeed) || 1.0)) : 1.0,
      pitch: rawPitch !== null ? Math.min(1.4, Math.max(0.6, parseFloat(rawPitch) || 1.0)) : 1.0,
      volume: rawVolume !== null ? Math.min(1.0, Math.max(0.0, parseFloat(rawVolume) || 0.0)) : 1.0,
      voiceURI: rawVoiceURI || '',
      engine: rawEngine === 'openai' ? 'openai' : 'browser',
      openAiVoice: OPENAI_TTS_VOICES.includes(rawOpenAiVoice) ? rawOpenAiVoice : 'alloy'
    };
  } catch (_) {
    return {
      speed: 1.0,
      pitch: 1.0,
      volume: 1.0,
      voiceURI: '',
      engine: 'browser',
      openAiVoice: 'alloy'
    };
  }
}

export function saveVoiceControls(controls = {}) {
  if (typeof localStorage === 'undefined') return;
  try {
    if (controls.speed !== undefined) localStorage.setItem('puppet_voice_speed', String(controls.speed));
    if (controls.pitch !== undefined) localStorage.setItem('puppet_voice_pitch', String(controls.pitch));
    if (controls.volume !== undefined) localStorage.setItem('puppet_voice_volume', String(controls.volume));
    if (controls.voiceURI !== undefined) localStorage.setItem('puppet_voice_uri', String(controls.voiceURI));
    if (controls.engine !== undefined) localStorage.setItem('puppet_voice_engine', String(controls.engine));
    if (controls.openAiVoice !== undefined) localStorage.setItem('puppet_openai_voice', String(controls.openAiVoice));
  } catch (_) {}
}


// Safe API key reader: reads from localStorage ('puppet_keys') FIRST, import.meta.env (.env) as fallback
export function getApiKeys() {
  const local = getSavedPuppetKeys();
  const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};
  return {
    groq: local.groq || String(env.VITE_GROQ_KEY || '').trim(),
    gemini: local.gemini || String(env.VITE_GEMINI_KEY || env.VITE_AI_KEY || '').trim(),
    openai: local.openai || String(env.VITE_OPENAI_KEY || '').trim()
  };
}

// Tiny test request helper for each provider (returns { ok: boolean, message: string })
export async function testApiKey(provider, key) {
  const cleanKey = String(key || '').trim();
  if (!cleanKey) {
    return { ok: false, message: 'Empty key' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    if (provider === 'groq') {
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${cleanKey}` },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        return { ok: true, message: 'Tested OK' };
      }
      if (res.status === 401) {
        return { ok: false, message: 'Invalid key' };
      }
      return { ok: false, message: `HTTP ${res.status}` };
    }

    if (provider === 'gemini') {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`, {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        return { ok: true, message: 'Tested OK' };
      }
      if (res.status === 400 || res.status === 403 || res.status === 401) {
        return { ok: false, message: 'Invalid key' };
      }
      return { ok: false, message: `HTTP ${res.status}` };
    }

    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${cleanKey}` },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        return { ok: true, message: 'Tested OK' };
      }
      if (res.status === 401) {
        return { ok: false, message: 'Invalid key' };
      }
      return { ok: false, message: `HTTP ${res.status}` };
    }

    clearTimeout(timeoutId);
    return { ok: false, message: 'Unknown provider' };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return { ok: false, message: 'Timeout' };
    }
    return { ok: false, message: 'Network error' };
  }
}

export const LANG_CONFIG = {
  en: {
    code: 'en',
    name: 'English',
    recLang: 'en-US',
    voicePrefix: 'en',
    label: 'EN'
  },
  ur: {
    code: 'ur',
    name: 'Urdu',
    recLang: 'ur-PK',
    voicePrefix: 'ur',
    label: 'اردو'
  },
  ps: {
    code: 'ps',
    name: 'Pashto',
    recLang: 'ps-AF',
    voicePrefix: 'ps',
    label: 'پښتو'
  }
};

export class VoiceAssistant {
  constructor(options = {}) {
    this.onStateChange = options.onStateChange || (() => {});
    this.onUserQuestion = options.onUserQuestion || (() => {});
    this.onAgentAnswer = options.onAgentAnswer || (() => {});
    this.onError = options.onError || (() => {});
    this.onStatus = options.onStatus || (() => {});
    this.onSpeechEnd = options.onSpeechEnd || (() => {});
    this.onProviderBadgeUpdate = options.onProviderBadgeUpdate || (() => {});
    this.robotVoice = options.robotVoice;
    this.onSilenceCallback = options.onSilence || null;

    // Sentence speech queue for early speaking & streaming
    this.speechQueue = [];
    this.isSpeakingQueueItem = false;
    this.isStreamComplete = true;
    this.currentAnsweringFullText = '';
    this.sentenceBuffer = '';
    this.streamAbortController = null;
    this.currentSentenceTimer = null;

    // Preferred provider saved in localStorage (stores ONLY provider name, never keys)
    const savedProvider = (typeof localStorage !== 'undefined' && localStorage.getItem('puppet_agent_preferred_provider')) || 'auto';
    this.preferredProvider = ['auto', 'groq', 'gemini', 'openai'].includes(savedProvider) ? savedProvider : 'auto';

    // HQ Listening option (Groq Whisper)
    this.isHqListening = (typeof localStorage !== 'undefined' && localStorage.getItem('puppet_agent_hq_listening') === 'true');

    // Currently answering provider (null if built-in)
    this.currentAnsweringProvider = null;

    // Multi-Language Persistence
    const savedLang = (typeof localStorage !== 'undefined' && localStorage.getItem('puppet_agent_lang')) || 'en';
    this.currentLang = LANG_CONFIG[savedLang] ? savedLang : 'en';

    // Conversation Memory: last 8 messages
    this.conversationHistory = [];

    // Mode A: Random Jokes Pools (8 short jokes per language)
    this.jokesPool = {
      en: [
        "Why do robots never panic? Because they have nerves of steel.",
        "There are 10 types of people in the world: those who understand binary, and those who do not.",
        "Why was the JavaScript developer sad? Because they didn't know how to null their feelings.",
        "Why did the robot go on a diet? It had too many bytes.",
        "Why do programmers prefer dark mode? Because light attracts bugs.",
        "How does a robot sneeze? A-choo-b-a-c-c-a!",
        "What is an algorithm? A word used by programmers when they do not want to explain what they did.",
        "Why was the robot tired after work? It had a hard drive."
      ],
      ur: [
        "روبوٹ کبھی گھبراتے کیوں نہیں؟ کیونکہ ان کے اعصاب فولاد کے بنے ہوتے ہیں۔",
        "دنیا میں صرف دو قسم کے لوگ ہیں: وہ جو بائنری سمجھتے ہیں، اور وہ جو نہیں سمجھتے۔",
        "جاوا اسکرپٹ کا ڈویلپر اداس کیوں تھا؟ کیونکہ وہ اپنے جذبات کو نل کرنا نہیں جانتا تھا۔",
        "روبوٹ نے ڈائٹ کیوں شروع کی؟ کیونکہ اس کے بائٹس بہت زیادہ ہو گئے تھے۔",
        "پروگرامر ڈارک موڈ کیوں پسند کرتے ہیں؟ کیونکہ روشنی سے بگز آ جاتے ہیں۔",
        "روبوٹ کو چھینک کیسے آتی ہے؟ آ-چو-ب-ا-ک-ا!",
        "الگورتھم کیا ہے؟ وہ لفظ جو پروگرامر تب استعمال کرتے ہیں جب وہ اپنی منطق سمجھانا نہیں چاہتے۔",
        "روبوٹ کام کے بعد تھک کیوں گیا؟ کیونکہ اس کے پاس ہارڈ ڈرائیو تھی۔"
      ],
      ps: [
        "روبوټونه ولې هیڅکله نه وېرېږي؟ ځکه چې د فولادو اعصاب لري.",
        "په نړۍ کې دوه ډوله خلک دي: هغه چې باینري پوهیږي، او هغه چې نه پوهیږي.",
        "د جاوا سکرپټ پروګرامر ولې خفه و؟ ځکه چې نه پوهېده خپل احساسات څنګه نل کړي.",
        "روبوټ ولې پرهیز پیل کړ؟ ځکه چې بایتونه یې ډېر شوي وو.",
        "پروګرامران ولې تور موډ خوښوي؟ ځکه چې رڼا بګونه راجلبوي.",
        "روبوټ څنګه پرنجی کوي؟ آ-چو-ب-ا-ک-ا!",
        "الګوریتم څه شی دی؟ هغه کلمه چې پروګرامران یې کاروي کله چې نه غواړي خپله تېروتنه تشریح کړي.",
        "روبوټ له کار وروسته ولې ستړی و؟ ځکه چې هارډ ډرایو یې درلود."
      ]
    };

    // Single-shot speech recognition instance
    this.recognition = null;
    this.isListening = false;
    this.isSpeaking = false;
    this.activeTranscript = '';
    this.isSupported = typeof window !== 'undefined' && (
      'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
    );

    // MediaRecorder state for HQ Listening
    this.mediaRecorder = null;
    this.mediaStream = null;
    this.audioChunks = [];
    this.activeAudio = null;
    this.voiceEnabled = false; // Starts OFF (muted) until speaker button is clicked

    // Voice Controls (Speed, Pitch, Volume, Engine, Selected Voices)
    const savedVoice = getSavedVoiceControls();
    this.voiceRate = savedVoice.speed;
    this.voicePitch = savedVoice.pitch;
    this.voiceVolume = savedVoice.volume;
    this.selectedVoiceURI = savedVoice.voiceURI;
    this.voiceEngine = savedVoice.engine;
    this.openAiVoice = savedVoice.openAiVoice;

    this.initRecognition();

  }

  // Dynamic jokes getter for compatibility with unit tests and consumers
  get jokes() {
    return this.jokesPool[this.currentLang] || this.jokesPool.en;
  }

  get hasAnyAiKey() {
    const keys = getApiKeys();
    return Boolean(keys.groq || keys.gemini || keys.openai);
  }

  get isAiMode() {
    return this.hasAnyAiKey;
  }

  // Backward compatibility getter
  get apiKey() {
    const keys = getApiKeys();
    return keys.gemini || keys.groq || keys.openai || '';
  }

  /**
   * Returns badge label: "AI: GROQ", "AI: GEMINI", "AI: OPENAI", or "MODE: BUILT-IN"
   */
  getBadgeText(provider = this.currentAnsweringProvider) {
    if (provider === 'groq') return AI_MODELS_CONFIG.groq.badge;
    if (provider === 'gemini') return AI_MODELS_CONFIG.gemini.badge;
    if (provider === 'openai') return AI_MODELS_CONFIG.openai.badge;
    if (provider === 'builtin' || provider === 'built-in') return "MODE: BUILT-IN";

    // If explicit null was passed, user wanted fallback built-in badge
    if (provider === null) {
      return "MODE: BUILT-IN";
    }

    if (this.hasAnyAiKey) {
      const preferred = this.preferredProvider;
      const keys = getApiKeys();
      if (preferred && preferred !== 'auto' && keys[preferred]) {
        return AI_MODELS_CONFIG[preferred].badge;
      }
      if (keys.groq) return AI_MODELS_CONFIG.groq.badge;
      if (keys.gemini) return AI_MODELS_CONFIG.gemini.badge;
      if (keys.openai) return AI_MODELS_CONFIG.openai.badge;
    }

    return "MODE: BUILT-IN";
  }

  getModeLabel() {
    return this.getBadgeText();
  }

  setPreferredProvider(provider) {
    const allowed = ['auto', 'groq', 'gemini', 'openai'];
    const val = allowed.includes(provider) ? provider : 'auto';
    this.preferredProvider = val;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('puppet_agent_preferred_provider', val);
      } catch (_) {}
    }
    this.onProviderBadgeUpdate(this.getBadgeText(), this.isAiMode);
  }

  setHqListening(enabled) {
    this.isHqListening = Boolean(enabled);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('puppet_agent_hq_listening', String(this.isHqListening));
      } catch (_) {}
    }
  }

  setLanguage(lang) {
    if (!LANG_CONFIG[lang]) return;
    this.currentLang = lang;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('puppet_agent_lang', lang);
      } catch (_) {}
    }
    if (this.recognition) {
      this.recognition.lang = LANG_CONFIG[lang].recLang;
    }
  }

  initRecognition() {
    if (!this.isSupported) {
      setTimeout(() => this.onError('microphone unavailable'), 100);
      return;
    }
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRec();
    this.recognition.continuous = false; // One question at a time
    this.recognition.interimResults = true;
    this.recognition.lang = (LANG_CONFIG[this.currentLang] || LANG_CONFIG.en).recLang;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.activeTranscript = '';
      this.onStatus({ status: 'LISTENING...', transcript: '' });
      this.onStateChange('LISTENING', 'LISTENING');
    };

    this.recognition.onresult = (event) => {
      let interim = '';
      for (let i = 0; i < event.results.length; i++) {
        interim += event.results[i][0].transcript;
      }
      this.activeTranscript = interim.trim();
      this.onStatus({ status: 'LISTENING...', transcript: this.activeTranscript });
    };

    this.recognition.onerror = (event) => {
      console.warn('VoiceAssistant SpeechRecognition error:', event.error);
      this.isListening = false;
      if (event.error === 'language-not-supported') {
        const langName = LANG_CONFIG[this.currentLang]?.name || 'Language';
        this.onError(`${langName} listening not supported, use English`);
        if (this.recognition) {
          this.recognition.lang = 'en-US';
        }
        this.onStatus({ status: 'READY', transcript: '' });
        this.onStateChange('READY', 'READY');
      } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed' || event.error === 'audio-capture') {
        const blockedMsg = "Microphone is blocked. Please allow microphone access in your browser settings (click the lock icon in the address bar).";
        this.onError(blockedMsg);
        this.onStatus({ status: 'READY', transcript: blockedMsg });
        this.onStateChange('READY', 'READY');
      } else if (event.error === 'no-speech') {
        this.onSilence();
      } else {
        this.onStatus({ status: 'READY', transcript: '' });
        this.onStateChange('READY', 'READY');
      }
    };

    this.recognition.onend = () => {
      const wasListening = this.isListening;
      this.isListening = false;
      const question = this.activeTranscript.trim();
      if (question.length > 0) {
        this.processQuestion(question);
      } else if (wasListening) {
        this.onSilence();
      } else {
        this.onStatus({ status: 'READY', transcript: '' });
        this.onStateChange('READY', 'READY');
      }
    };
  }

  onSilence() {
    this.isListening = false;
    if (this.onSilenceCallback) {
      this.onSilenceCallback();
      return;
    }
    this.onStatus({ status: 'READY', transcript: 'I did not hear anything' });
    this.onStateChange('READY', 'READY');
  }

  getSystemPrompt() {
    return getSavedSystemPrompt();
  }

  setSystemPrompt(prompt) {
    saveSystemPrompt(prompt);
  }

  // Determine provider execution order: Groq first (fastest), then Gemini, then OpenAI
  getProviderOrder() {
    const standardOrder = ['groq', 'gemini', 'openai'];
    if (this.preferredProvider && this.preferredProvider !== 'auto' && standardOrder.includes(this.preferredProvider)) {
      return [this.preferredProvider, ...standardOrder.filter(p => p !== this.preferredProvider)];
    }
    return standardOrder;
  }

  async startListening() {
    // Echo protection: never listen while speaking
    if (this.isSpeaking) {
      return;
    }
    if (this.isListening) {
      return;
    }

    const keys = getApiKeys();
    // 4. HQ Listening via Groq Whisper if enabled and key exists
    if (this.isHqListening && keys.groq) {
      await this.startHqRecording();
      return;
    }

    // Standard webkitSpeechRecognition
    if (!this.isSupported) {
      this.onError('microphone unavailable');
      return;
    }

    if (this.recognition) {
      this.recognition.lang = (LANG_CONFIG[this.currentLang] || LANG_CONFIG.en).recLang;
    }

    try {
      this.recognition.start();
    } catch (err) {
      console.warn('Speech recognition start error:', err);
      if (err && String(err).toLowerCase().includes('language')) {
        const langName = LANG_CONFIG[this.currentLang]?.name || 'Language';
        this.onError(`${langName} listening not supported, use English`);
        if (this.recognition) {
          this.recognition.lang = 'en-US';
        }
      }
    }
  }

  stopListening() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.stopHqRecording();
      return;
    }

    if (this.isListening && this.recognition) {
      try {
        this.recognition.stop();
      } catch (_) {}
    }
  }

  // HQ Audio Recording via MediaRecorder
  async startHqRecording() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.onError('microphone recording not supported');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaStream = stream;
      this.audioChunks = [];

      const mimeType = (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/webm'))
        ? 'audio/webm'
        : '';
      this.mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.audioChunks.push(e.data);
        }
      };

      this.mediaRecorder.onstart = () => {
        this.isListening = true;
        this.onStatus({ status: 'LISTENING...', transcript: 'HQ Audio Recording (Groq Whisper)...' });
        this.onStateChange('LISTENING', 'LISTENING');
      };

      this.mediaRecorder.onerror = (e) => {
        console.warn('MediaRecorder error:', e);
        this.stopHqRecording();
      };

      this.mediaRecorder.start();
    } catch (err) {
      console.warn('Microphone permission error:', err);
      this.onError('microphone unavailable');
      this.onStatus({ status: 'READY', transcript: '' });
      this.onStateChange('READY', 'READY');
    }
  }

  stopHqRecording() {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') return;
    this.isListening = false;
    this.onStatus({ status: 'THINKING...', transcript: 'Transcribing with Whisper...' });

    this.mediaRecorder.onstop = async () => {
      try {
        if (this.mediaStream) {
          this.mediaStream.getTracks().forEach(t => t.stop());
          this.mediaStream = null;
        }

        if (this.audioChunks.length === 0) {
          this.onStatus({ status: 'READY', transcript: '' });
          this.onStateChange('READY', 'READY');
          return;
        }

        const mime = this.mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(this.audioChunks, { type: mime });
        this.audioChunks = [];

        if (blob.size < 400) {
          this.onStatus({ status: 'READY', transcript: '' });
          this.onStateChange('READY', 'READY');
          return;
        }

        const transcript = await this.transcribeWithGroq(blob);
        if (transcript && transcript.trim().length > 0) {
          this.processQuestion(transcript.trim());
        } else {
          this.onStatus({ status: 'READY', transcript: '' });
          this.onStateChange('READY', 'READY');
        }
      } catch (err) {
        console.warn('Groq Whisper transcription error:', err);
        this.onError(`groq whisper failed: ${err.message || 'transcription error'}`);
        this.onStatus({ status: 'READY', transcript: '' });
        this.onStateChange('READY', 'READY');
      }
    };

    try {
      this.mediaRecorder.stop();
    } catch (_) {}
  }

  // Transcribe audio using Groq Whisper Large v3
  async transcribeWithGroq(audioBlob) {
    const keys = getApiKeys();
    if (!keys.groq) {
      throw new Error('missing VITE_GROQ_KEY');
    }

    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', AI_MODELS_CONFIG.groq.transcriptionModel);
    formData.append('language', this.currentLang);
    formData.append('response_format', 'json');

    const response = await fetch(AI_MODELS_CONFIG.groq.transcriptionEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${keys.groq}`
      },
      body: formData
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.text || '';
  }

  // Stop speaking and clear all queued sentences & active streams
  stopSpeaking() {
    if (this.streamAbortController) {
      try { this.streamAbortController.abort(); } catch (_) {}
      this.streamAbortController = null;
    }
    if (this.currentSentenceTimer) {
      clearTimeout(this.currentSentenceTimer);
      this.currentSentenceTimer = null;
    }
    this.speechQueue = [];
    this.sentenceBuffer = '';
    this.isSpeakingQueueItem = false;
    this.isStreamComplete = true;
    this.isSpeaking = false;

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch (_) {}
    }
    if (this.activeAudio) {
      try {
        this.activeAudio.pause();
        this.activeAudio.currentTime = 0;
      } catch (_) {}
      this.activeAudio = null;
    }
  }

  // Interrupt active speech and immediately begin listening
  interruptAndListen() {
    this.stopSpeaking();
    this.startListening();
  }

  // Sentence queue management for streaming speech
  enqueueSentence(sentence) {
    const clean = (sentence || '').replace(/[*_#`~]/g, '').trim();
    if (!clean) return;
    this.speechQueue.push(clean);
    this.processSpeechQueue();
  }

  processSpeechQueue() {
    if (this.isSpeakingQueueItem) {
      return;
    }

    if (this.speechQueue.length === 0) {
      if (this.isStreamComplete && !this.isSpeakingQueueItem) {
        this.finishSpeaking();
      }
      return;
    }

    this.isSpeakingQueueItem = true;
    this.isSpeaking = true;
    this.onStateChange('SPEAKING', 'SPEAKING');

    const sentence = this.speechQueue.shift();
    this.playSingleSentence(sentence, () => {
      this.isSpeakingQueueItem = false;
      this.processSpeechQueue();
    });
  }

  finishSpeaking() {
    this.isSpeaking = false;
    this.isSpeakingQueueItem = false;
    this.onStateChange('READY', 'READY');
    this.onStatus({ status: 'READY', transcript: '' });
    if (this.onSpeechEnd) {
      this.onSpeechEnd(this.currentAnsweringFullText);
    }
  }

  handleStreamChunk(delta) {
    if (!delta) return;
    this.currentAnsweringFullText += delta;
    this.sentenceBuffer = (this.sentenceBuffer || '') + delta;

    // Show real-time streaming answer in live caption box
    this.onStatus({ status: 'ANSWERING...', transcript: this.currentAnsweringFullText });

    // Look for complete sentence boundaries in buffer
    let match;
    while ((match = this.sentenceBuffer.match(/([.!?۔؟]+(?:\s+|$|\n))/))) {
      const endIdx = match.index + match[0].length;
      const sentence = this.sentenceBuffer.slice(0, endIdx).replace(/[*_#`~]/g, '').trim();
      this.sentenceBuffer = this.sentenceBuffer.slice(endIdx);
      if (sentence.length > 0) {
        this.enqueueSentence(sentence);
      }
    }
  }

  markStreamComplete() {
    this.isStreamComplete = true;
    if (this.sentenceBuffer && this.sentenceBuffer.trim().length > 0) {
      const remaining = this.sentenceBuffer.replace(/[*_#`~]/g, '').trim();
      this.sentenceBuffer = '';
      if (remaining.length > 0) {
        this.enqueueSentence(remaining);
      }
    }
    if (this.speechQueue.length === 0 && !this.isSpeakingQueueItem) {
      this.finishSpeaking();
    }
  }

  // Parse server-sent events (SSE) stream for Groq, Gemini, and OpenAI
  async readSseStream(response, onChunk, signal) {
    if (!response.body) {
      throw new Error('ReadableStream not supported');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let accumulated = '';

    while (true) {
      if (signal && signal.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;
        if (trimmed.startsWith('data: ')) {
          const dataStr = trimmed.slice(6).trim();
          if (dataStr === '[DONE]') continue;
          try {
            const json = JSON.parse(dataStr);
            const delta = json.choices?.[0]?.delta?.content || json.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (delta) {
              accumulated += delta;
              if (onChunk) onChunk(delta);
            }
          } catch (_) {}
        }
      }
    }

    return accumulated.replace(/[*_#`~]/g, '').trim();
  }

  async processQuestion(question) {
    if (!question || !question.trim()) return;
    const cleanQ = question.trim();

    // 1. Log question
    this.onUserQuestion(cleanQ);

    // Stop any existing speaking or queue
    this.stopSpeaking();

    // 2. Switch robot to THINKING
    this.onStatus({ status: 'THINKING...', transcript: cleanQ });
    this.onStateChange('THINKING', 'THINKING');

    // 3. Prepare system prompt and history
    let systemPrompt = this.getSystemPrompt();
    if (this.currentLang === 'ur') {
      systemPrompt += "\nReply in Urdu using proper Urdu/Arabic script (نستعلیق / اردو رسم الخط).";
    } else if (this.currentLang === 'ps') {
      systemPrompt += "\nReply in Pashto using proper Pashto script (پښتو ليکدود).";
    }

    const keys = getApiKeys();
    const providersToTry = this.getProviderOrder();
    let succeeded = false;

    // Reset streaming state
    this.streamAbortController = new AbortController();
    const signal = this.streamAbortController.signal;
    this.speechQueue = [];
    this.sentenceBuffer = '';
    this.isSpeakingQueueItem = false;
    this.isStreamComplete = false;
    this.currentAnsweringFullText = '';

    for (const provider of providersToTry) {
      const key = keys[provider];
      if (!key) {
        this.onError(`${provider} failed: missing VITE_${provider.toUpperCase()}_KEY`);
        continue;
      }

      try {
        let fullAnswer = '';
        if (provider === 'groq') {
          fullAnswer = await this.streamGroq(cleanQ, systemPrompt, key, signal);
        } else if (provider === 'gemini') {
          fullAnswer = await this.streamGemini(cleanQ, systemPrompt, key, signal);
        } else if (provider === 'openai') {
          fullAnswer = await this.streamOpenAI(cleanQ, systemPrompt, key, signal);
        }

        if (fullAnswer && fullAnswer.trim().length > 0) {
          this.currentAnsweringProvider = provider;
          this.onProviderBadgeUpdate(this.getBadgeText(provider), true);
          succeeded = true;
          this.onAgentAnswer(fullAnswer.trim());
          this.markStreamComplete();
          break;
        }
      } catch (err) {
        if (signal.aborted) {
          return; // Interrupted by user
        }
        const shortMsg = err.message || 'request error';
        this.onError(`${provider} failed: ${shortMsg}`);
      }
    }

    // Fallback to built-in answers if all providers failed
    if (!succeeded) {
      if (signal.aborted) return;
      this.currentAnsweringProvider = null;
      this.onProviderBadgeUpdate(this.getBadgeText(null), false);
      const builtIn = this.getBuiltInAnswer(cleanQ);
      this.currentAnsweringFullText = builtIn;
      this.onAgentAnswer(builtIn);
      this.enqueueSentence(builtIn);
      this.markStreamComplete();
    }

    // Update conversation memory: keep last 8 messages
    if (this.currentAnsweringFullText) {
      this.conversationHistory.push({ role: 'user', text: cleanQ });
      this.conversationHistory.push({ role: 'model', text: this.currentAnsweringFullText });
      if (this.conversationHistory.length > 8) {
        this.conversationHistory = this.conversationHistory.slice(-8);
      }
    }
  }

  // Stream Groq Chat Completions API (Llama 3.3 70B)
  async streamGroq(question, systemPrompt, key, signal) {
    const messages = [{ role: 'system', content: systemPrompt }];
    this.conversationHistory.slice(-8).forEach(item => {
      messages.push({
        role: item.role === 'model' ? 'assistant' : 'user',
        content: item.text || item.parts?.[0]?.text || ''
      });
    });
    messages.push({ role: 'user', content: question });

    const response = await fetch(AI_MODELS_CONFIG.groq.chatEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: AI_MODELS_CONFIG.groq.chatModel,
        messages,
        max_completion_tokens: 180,
        temperature: 0.7,
        stream: true
      }),
      signal
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    this.sentenceBuffer = '';
    return await this.readSseStream(response, (delta) => {
      this.handleStreamChunk(delta);
    }, signal);
  }

  // Stream Google Gemini GenerateContent API (Gemini 2.5 Flash)
  async streamGemini(question, systemPrompt, key, signal) {
    const contents = [];
    this.conversationHistory.slice(-8).forEach(item => {
      contents.push({
        role: item.role === 'model' ? 'model' : 'user',
        parts: [{ text: item.text || item.parts?.[0]?.text || '' }]
      });
    });
    contents.push({ role: 'user', parts: [{ text: question }] });

    const payload = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { maxOutputTokens: 180, temperature: 0.7 }
    };

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${key}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    this.sentenceBuffer = '';
    return await this.readSseStream(response, (delta) => {
      this.handleStreamChunk(delta);
    }, signal);
  }

  // Stream OpenAI Chat Completions API (GPT-4o Mini)
  async streamOpenAI(question, systemPrompt, key, signal) {
    const messages = [{ role: 'system', content: systemPrompt }];
    this.conversationHistory.slice(-8).forEach(item => {
      messages.push({
        role: item.role === 'model' ? 'assistant' : 'user',
        content: item.text || item.parts?.[0]?.text || ''
      });
    });
    messages.push({ role: 'user', content: question });

    const response = await fetch(AI_MODELS_CONFIG.openai.chatEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: AI_MODELS_CONFIG.openai.chatModel,
        messages,
        max_tokens: 180,
        temperature: 0.7,
        stream: true
      }),
      signal
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    this.sentenceBuffer = '';
    return await this.readSseStream(response, (delta) => {
      this.handleStreamChunk(delta);
    }, signal);
  }

  // Non-streaming compatibility helpers
  async queryGroq(question, systemPrompt, key) {
    return this.streamGroq(question, systemPrompt, key, null);
  }

  async queryGemini(question, systemPrompt, key) {
    return this.streamGemini(question, systemPrompt, key, null);
  }

  async queryOpenAI(question, systemPrompt, key) {
    return this.streamOpenAI(question, systemPrompt, key, null);
  }

  // Multi-provider query helper for external consumers
  async queryAiMultiProvider({ prompt, systemPrompt }) {
    const keys = getApiKeys();
    const providersToTry = this.getProviderOrder();

    for (const provider of providersToTry) {
      const key = keys[provider];
      if (!key) continue;

      try {
        if (provider === 'groq') {
          return await this.streamGroq(prompt, systemPrompt, key, null);
        } else if (provider === 'gemini') {
          return await this.streamGemini(prompt, systemPrompt, key, null);
        } else if (provider === 'openai') {
          return await this.streamOpenAI(prompt, systemPrompt, key, null);
        }
      } catch (err) {
        this.onError(`${provider} failed: ${err.message || 'request error'}`);
      }
    }
    throw new Error('All AI providers unavailable');
  }

  // Built-in responses fallback (Mode A)
  getBuiltInAnswer(q) {
    const text = (q || '').trim().toLowerCase();
    const lang = this.currentLang;

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    // 1. Greetings
    const isGreeting = /^(hi|hello|hey|greetings|good morning|good afternoon|good evening)\b/i.test(text) ||
      /(سلام|ہیلو|آداب|صبح بخیر|شام بخیر|السلام علیکم|اسلام علیکم|ښه راغلاست|ستړي مه شئ|سهار پخیر|ماښام پخیر)/i.test(text);

    if (isGreeting) {
      if (lang === 'ur') {
        return "سلام! میں کٹھ پتلی ایجنٹ ہوں، آپ کی مدد کے لیے حاضر ہوں۔";
      } else if (lang === 'ps') {
        return "سلام! زه د پتلی ایجنټ یم، ستاسو مرستې ته چمتو یم.";
      } else {
        return "Hello! I am Puppet Agent, ready to assist you.";
      }
    }

    // 2. What is your name
    const isName = text.includes("your name") || text.includes("who are you") ||
      /(آپ کا نام|تمہارا نام|نام کیا ہے|نام کیا|تم کون ہو|آپ کون ہیں|ستاسو نوم|ستا نوم|نوم دې څه|ته څوک یې|څوک یې)/i.test(text);

    if (isName) {
      if (lang === 'ur') {
        return "میرا نام کٹھ پتلی ایجنٹ ہے۔";
      } else if (lang === 'ps') {
        return "زما نوم د پتلی ایجنټ دی.";
      } else {
        return "My name is Puppet Agent.";
      }
    }

    // 3. What time is it
    const isTime = text.includes("time is it") || text.includes("current time") || text.includes("what time") ||
      /(کیا وقت ہوا ہے|کیا وقت ہے|وقت کیا ہے|کتنے بجے ہیں|وقت بتاؤ|ٹائم کیا|څو بجې دي|څو بجې شوې|وخت څه دی|ساعت څو دی|وخت)/i.test(text);

    if (isTime) {
      if (lang === 'ur') {
        return `اس وقت ${timeStr} ہوئے ہیں۔`;
      } else if (lang === 'ps') {
        return `اوس وخت ${timeStr} دی.`;
      } else {
        return `The current time is ${timeStr}.`;
      }
    }

    // 4. What is today's date
    const isDate = text.includes("today's date") || text.includes("what is the date") || text.includes("what date") ||
      /(آج کی تاریخ|تاریخ کیا ہے|آج کیا تاریخ ہے|نن څه نېټه ده|نن نېټه)/i.test(text);

    if (isDate) {
      const dateStr = now.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
      if (lang === 'ur') {
        return `آج کی تاریخ ${dateStr} ہے۔`;
      } else if (lang === 'ps') {
        return `نن نېټه ${dateStr} ده.`;
      } else {
        return `Today is ${dateStr}.`;
      }
    }

    // 5. Tell me a joke
    const isJoke = text.includes("joke") || text.includes("funny") ||
      /(لطیفہ سناؤ|کوئی لطیفہ|لطیفہ|مزاحیہ|ټوکه ووایه|یوه ټوکه|ټوکه|خندونکې)/i.test(text);

    if (isJoke) {
      const jokesList = this.jokesPool[lang] || this.jokesPool.en;
      return jokesList[Math.floor(Math.random() * jokesList.length)];
    }

    // 6. What can you do
    const isHelp = text.includes("what can you do") || text.includes("help") || text.includes("capabilities") ||
      /(کیا کر سکتے ہو|مدد|آپ کیا کرتے ہیں|څه کولی شې|مرسته)/i.test(text);

    if (isHelp) {
      if (lang === 'ur') {
        return "میں آواز میں بات کر سکتا ہوں، سوالات کے جواب دے سکتا ہوں، اور نوٹس اور ٹاسک یاد رکھ سکتا ہوں۔";
      } else if (lang === 'ps') {
        return "زه په غږ خبرې کوم، پوښتنو ته ځواب وایم، او ستاسو دندې او یادښتونه ساتم.";
      } else {
        return "I can answer voice questions, store notes in memory, and manage your tasks.";
      }
    }

    // 7. Fallback response
    if (lang === 'ur') {
      return "میں فی الحال صرف بنیادی سوالات کے جواب دے سکتا ہوں۔ مکمل جوابات کے لیے اے پی آئی کی شامل کریں۔";
    } else if (lang === 'ps') {
      return "زه دا مهال یوازې بنسټیزو پوښتنو ته ځواب ویلی شم. د بشپړو ځوابونو لپاره د API کیلي ورزیاته کړئ.";
    } else {
      return "I can only answer basic questions right now. Add an API key to unlock full answers.";
    }
  }

  setVoiceEnabled(enabled) {
    this.voiceEnabled = Boolean(enabled);
    if (!this.voiceEnabled) {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        try { window.speechSynthesis.cancel(); } catch (_) {}
      }
      if (this.activeAudio) {
        try { this.activeAudio.pause(); } catch (_) {}
        this.activeAudio = null;
      }
    }
  }

  // Single sentence audio playback with speech synthesis or OpenAI TTS
  async playSingleSentence(sentence, onEnd) {
    const clean = (sentence || '').replace(/[*_#`~]/g, '').trim();
    if (!clean) {
      if (onEnd) onEnd();
      return;
    }

    let finished = false;
    const finishOnce = () => {
      if (finished) return;
      finished = true;
      if (this.currentSentenceTimer) {
        clearTimeout(this.currentSentenceTimer);
        this.currentSentenceTimer = null;
      }
      if (onEnd) onEnd();
    };

    // If speaker is muted/disabled, simulate mouth/speaking animation briefly then proceed
    if (!this.voiceEnabled) {
      const duration = Math.min(1200, Math.max(300, clean.length * 40));
      this.currentSentenceTimer = setTimeout(finishOnce, duration);
      return;
    }

    const keys = getApiKeys();
    const useOpenAiEngine = (this.voiceEngine === 'openai' && keys.openai);

    // 1. If OpenAI Voice engine is selected and key exists, use OpenAI TTS
    if (useOpenAiEngine) {
      const played = await this.speakWithOpenAITTS(clean, keys.openai, () => {
        finishOnce();
      });
      if (played) return;
    }

    const langConfig = LANG_CONFIG[this.currentLang] || LANG_CONFIG.en;
    const langCode = langConfig.code;
    const langName = langConfig.name;

    // Check browser voices
    const voices = (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.getVoices)
      ? window.speechSynthesis.getVoices()
      : [];
    const matchingVoices = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith(langCode));

    // 2. English or any language with matching browser voice
    if (langCode === 'en' || matchingVoices.length > 0) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const SpeechUtterance = window.SpeechSynthesisUtterance || (typeof SpeechSynthesisUtterance !== 'undefined' ? SpeechSynthesisUtterance : null);
        if (SpeechUtterance) {
          const utterance = new SpeechUtterance(clean);
          utterance.rate = this.voiceRate || 1.0;
          utterance.pitch = this.voicePitch || 1.0;
          utterance.volume = this.voiceVolume !== undefined ? this.voiceVolume : 1.0;
          utterance.lang = langConfig.recLang;

          let chosenVoice = null;
          if (this.selectedVoiceURI) {
            chosenVoice = voices.find(v => v.voiceURI === this.selectedVoiceURI || v.name === this.selectedVoiceURI);
          }

          if (!chosenVoice) {
            if (langCode === 'en') {
              chosenVoice = matchingVoices.find(v =>
                v.name.includes('Google US English') ||
                v.name.includes('David') ||
                v.name.includes('Alex') ||
                v.name.includes('Natural') ||
                v.name.includes('English')
              );
            }
            if (!chosenVoice) chosenVoice = matchingVoices[0];
          }

          if (chosenVoice) {
            utterance.voice = chosenVoice;
          }

          utterance.onend = () => {
            finishOnce();
          };
          utterance.onerror = (e) => {
            console.warn('SpeechSynthesis sentence error:', e);
            finishOnce();
          };

          const maxDuration = Math.max(2500, clean.length * 120);
          this.currentSentenceTimer = setTimeout(finishOnce, maxDuration);

          try {
            window.speechSynthesis.speak(utterance);
            return;
          } catch (err) {
            console.warn('SpeechSynthesis speak error:', err);
            finishOnce();
            return;
          }
        }
      }
    }

    // 3. For Urdu and Pashto with NO matching browser voice installed:
    // If VITE_OPENAI_KEY exists, use OpenAI TTS and play the returned audio
    if (keys.openai) {
      const played = await this.speakWithOpenAITTS(clean, keys.openai, () => {
        finishOnce();
      });
      if (played) {
        return;
      }
    }

    // Fallback: no voice installed and no OpenAI key
    this.onError(`no ${langName} voice installed`);
    finishOnce();
  }

  // Voice Output Execution: splits answer into sentences and enqueues to sentence queue
  speakAnswer(answer) {
    if (!answer || !answer.trim()) return;
    const clean = answer.trim();
    this.stopSpeaking();
    this.isStreamComplete = false;
    this.currentAnsweringFullText = clean;
    this.onStatus({ status: 'ANSWERING...', transcript: clean });
    this.onAgentAnswer(clean);

    // Split answer into sentences and enqueue
    const sentences = clean.match(/[^.!?۔؟]+(?:[.!?۔؟]+|$)/g) || [clean];
    for (const s of sentences) {
      if (s.trim()) {
        this.enqueueSentence(s.trim());
      }
    }
    this.markStreamComplete();
  }

  clearConversationHistory() {
    this.conversationHistory = [];
  }

  // OpenAI TTS API (tts-1) for OpenAI audio playback
  async speakWithOpenAITTS(answer, openAiKey, onFinish) {
    try {
      const voiceToUse = this.openAiVoice || AI_MODELS_CONFIG.openai.ttsVoice || 'alloy';
      const response = await fetch(AI_MODELS_CONFIG.openai.ttsEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: AI_MODELS_CONFIG.openai.ttsModel,
          input: answer,
          voice: voiceToUse
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.volume = this.voiceVolume !== undefined ? this.voiceVolume : 1.0;

      const cleanup = () => {
        URL.revokeObjectURL(audioUrl);
        if (this.activeAudio === audio) {
          this.activeAudio = null;
        }
        if (onFinish) onFinish();
      };

      audio.onended = () => {
        cleanup();
      };
      audio.onerror = (e) => {
        console.warn('OpenAI TTS audio error:', e);
        cleanup();
      };

      this.activeAudio = audio;
      await audio.play();
      return true;
    } catch (err) {
      console.warn('OpenAI TTS error:', err);
      this.onError(`openai tts failed: ${err.message || 'audio synthesis error'}`);
      return false;
    }
  }

  setVoiceControls(controls = {}) {
    if (typeof controls.speed === 'number') this.voiceRate = controls.speed;
    if (typeof controls.pitch === 'number') this.voicePitch = controls.pitch;
    if (typeof controls.volume === 'number') this.voiceVolume = controls.volume;
    if (typeof controls.voiceURI === 'string') this.selectedVoiceURI = controls.voiceURI;
    if (typeof controls.engine === 'string') this.voiceEngine = controls.engine;
    if (typeof controls.openAiVoice === 'string') this.openAiVoice = controls.openAiVoice;
    saveVoiceControls(controls);
  }

  async testVoice(sampleText, onEnd) {
    const defaultSentence = (this.currentLang === 'ur')
      ? "سلام! یہ آواز کی جانچ کے لیے ایک نمونہ جملہ ہے۔"
      : ((this.currentLang === 'ps')
        ? "سلام! دا د غږ آزموینې لپاره یوه نمونه جمله ده."
        : "Hello! This is a sample sentence to test the voice.");
    const text = (sampleText && sampleText.trim()) ? sampleText.trim() : defaultSentence;

    const keys = getApiKeys();
    const useOpenAi = (this.voiceEngine === 'openai' && keys.openai);

    if (useOpenAi) {
      const ok = await this.speakWithOpenAITTS(text, keys.openai, onEnd);
      if (!ok && onEnd) onEnd();
      return;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (_) {}
      const SpeechUtterance = window.SpeechSynthesisUtterance || (typeof SpeechSynthesisUtterance !== 'undefined' ? SpeechSynthesisUtterance : null);
      if (!SpeechUtterance) {
        if (onEnd) onEnd();
        return;
      }
      const utterance = new SpeechUtterance(text);
      utterance.rate = this.voiceRate || 1.0;
      utterance.pitch = this.voicePitch || 1.0;
      utterance.volume = this.voiceVolume !== undefined ? this.voiceVolume : 1.0;

      const langConfig = LANG_CONFIG[this.currentLang] || LANG_CONFIG.en;
      utterance.lang = langConfig.recLang;

      const voices = window.speechSynthesis.getVoices() || [];
      let chosenVoice = null;
      if (this.selectedVoiceURI) {
        chosenVoice = voices.find(v => v.voiceURI === this.selectedVoiceURI || v.name === this.selectedVoiceURI);
      }
      if (!chosenVoice) {
        const matching = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith(langConfig.code));
        chosenVoice = matching[0] || voices[0];
      }
      if (chosenVoice) utterance.voice = chosenVoice;

      utterance.onend = () => { if (onEnd) onEnd(); };
      utterance.onerror = () => { if (onEnd) onEnd(); };
      window.speechSynthesis.speak(utterance);
    } else {
      if (onEnd) onEnd();
    }
  }
}

