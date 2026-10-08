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
    this.onDelegate = options.onDelegate || null;
    this.onProviderBadgeUpdate = options.onProviderBadgeUpdate || (() => {});
    this.robotVoice = options.robotVoice;

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

    // Conversation Memory: last 6 messages
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
      } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed' || event.error === 'audio-capture') {
        this.onError('microphone unavailable');
      }
      this.onStatus({ status: 'IDLE', transcript: '' });
    };

    this.recognition.onend = () => {
      this.isListening = false;
      const question = this.activeTranscript.trim();
      if (question.length > 0) {
        this.processQuestion(question);
      } else {
        this.onStatus({ status: 'IDLE', transcript: '' });
      }
    };
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
      };

      this.mediaRecorder.onerror = (e) => {
        console.warn('MediaRecorder error:', e);
        this.stopHqRecording();
      };

      this.mediaRecorder.start();
    } catch (err) {
      console.warn('Microphone permission error:', err);
      this.onError('microphone unavailable');
      this.onStatus({ status: 'IDLE', transcript: '' });
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
          this.onStatus({ status: 'IDLE', transcript: '' });
          return;
        }

        const mime = this.mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(this.audioChunks, { type: mime });
        this.audioChunks = [];

        if (blob.size < 400) {
          this.onStatus({ status: 'IDLE', transcript: '' });
          return;
        }

        const transcript = await this.transcribeWithGroq(blob);
        if (transcript && transcript.trim().length > 0) {
          this.processQuestion(transcript.trim());
        } else {
          this.onStatus({ status: 'IDLE', transcript: '' });
        }
      } catch (err) {
        console.warn('Groq Whisper transcription error:', err);
        this.onError(`groq whisper failed: ${err.message || 'transcription error'}`);
        this.onStatus({ status: 'IDLE', transcript: '' });
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

  async processQuestion(question) {
    // 1. Log question to terminal: [user] <my question>
    this.onUserQuestion(question);

    // Check if onDelegate handles this command (e.g. delegation to Coder, Researcher, etc.)
    if (this.onDelegate && this.onDelegate(question)) {
      return;
    }

    // 2. Switch robot to thinking ("generating new idea") pose & show THINKING...
    this.onStatus({ status: 'THINKING...', transcript: question });
    this.onStateChange('IDEA', 'ASSISTANT: THINKING');

    // 3. Generate answer using fallback chain: Groq -> Gemini -> OpenAI -> Built-in
    let answer = '';
    const keys = getApiKeys();
    const providersToTry = this.getProviderOrder();
    let succeeded = false;

    let systemPrompt = "You are Puppet Agent, a friendly robot voice assistant. Answer ONLY in English, in 1 to 2 short spoken sentences. No markdown, no lists, no emojis.";
    if (this.currentLang === 'ur') {
      systemPrompt = "You are Puppet Agent, a friendly robot voice assistant. Reply ONLY in Urdu, in 1 to 2 short spoken sentences, using proper script (Urdu in Arabic script / نستعلیق / عربی رسم الخط). Do NOT use Roman Urdu or English. No markdown, no lists, no emojis.";
    } else if (this.currentLang === 'ps') {
      systemPrompt = "You are Puppet Agent, a friendly robot voice assistant. Reply ONLY in Pashto, in 1 to 2 short spoken sentences, using proper script (Pashto in Arabic script / پښتو ليکدود). Do NOT use Latin/Roman Pashto or English. No markdown, no lists, no emojis.";
    }

    for (const provider of providersToTry) {
      const key = keys[provider];
      if (!key) {
        this.onError(`${provider} failed: missing VITE_${provider.toUpperCase()}_KEY`);
        continue;
      }

      try {
        if (provider === 'groq') {
          answer = await this.queryGroq(question, systemPrompt, key);
        } else if (provider === 'gemini') {
          answer = await this.queryGemini(question, systemPrompt, key);
        } else if (provider === 'openai') {
          answer = await this.queryOpenAI(question, systemPrompt, key);
        }

        if (answer && answer.length > 0) {
          this.currentAnsweringProvider = provider;
          this.onProviderBadgeUpdate(this.getBadgeText(provider), true);
          succeeded = true;
          break;
        }
      } catch (err) {
        const shortMsg = err.message || 'request error';
        this.onError(`${provider} failed: ${shortMsg}`);
      }
    }

    // Fallback to Mode A built-in answers if all providers failed
    if (!succeeded) {
      this.currentAnsweringProvider = null;
      this.onProviderBadgeUpdate(this.getBadgeText(null), false);
      answer = this.getBuiltInAnswer(question);
    }

    // Update conversation memory: keep last 6 messages
    this.conversationHistory.push({ role: 'user', text: question });
    this.conversationHistory.push({ role: 'model', text: answer });
    if (this.conversationHistory.length > 6) {
      this.conversationHistory = this.conversationHistory.slice(-6);
    }

    // 4. Answering: speak out loud, HEAVY LIFTING for 1s, then IDLE
    this.speakAnswer(answer);
  }

  // Groq Chat Completions API (Llama 3.3 70B)
  async queryGroq(question, systemPrompt, key) {
    const messages = [{ role: 'system', content: systemPrompt }];
    this.conversationHistory.forEach(item => {
      messages.push({
        role: item.role === 'model' ? 'assistant' : 'user',
        content: item.text || item.parts?.[0]?.text || ''
      });
    });
    messages.push({ role: 'user', content: question });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(AI_MODELS_CONFIG.groq.chatEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: AI_MODELS_CONFIG.groq.chatModel,
        messages,
        max_completion_tokens: 150,
        temperature: 0.7
      }),
      signal: controller.signal
    }).finally(() => clearTimeout(timer));

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('empty response');
    return text.replace(/[*_#`~]/g, '').trim();
  }

  // Google Gemini GenerateContent API (Gemini 2.5 Flash)
  async queryGemini(question, systemPrompt, key) {
    const contents = [];
    this.conversationHistory.forEach(item => {
      contents.push({
        role: item.role === 'model' ? 'model' : 'user',
        parts: [{ text: item.text || item.parts?.[0]?.text || '' }]
      });
    });
    contents.push({ role: 'user', parts: [{ text: question }] });

    const payload = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { maxOutputTokens: 150, temperature: 0.7 }
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(AI_MODELS_CONFIG.gemini.chatEndpoint(key), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    }).finally(() => clearTimeout(timer));

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidate) throw new Error('empty response');
    return candidate.replace(/[*_#`~]/g, '').trim();
  }

  // OpenAI Chat Completions API (GPT-4o Mini)
  async queryOpenAI(question, systemPrompt, key) {
    const messages = [{ role: 'system', content: systemPrompt }];
    this.conversationHistory.forEach(item => {
      messages.push({
        role: item.role === 'model' ? 'assistant' : 'user',
        content: item.text || item.parts?.[0]?.text || ''
      });
    });
    messages.push({ role: 'user', content: question });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(AI_MODELS_CONFIG.openai.chatEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: AI_MODELS_CONFIG.openai.chatModel,
        messages,
        max_tokens: 150,
        temperature: 0.7
      }),
      signal: controller.signal
    }).finally(() => clearTimeout(timer));

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('empty response');
    return text.replace(/[*_#`~]/g, '').trim();
  }

  // Multi-provider query helper for specialized agents and external consumers
  async queryAiMultiProvider({ prompt, systemPrompt }) {
    const keys = getApiKeys();
    const providersToTry = this.getProviderOrder();

    for (const provider of providersToTry) {
      const key = keys[provider];
      if (!key) continue;

      try {
        if (provider === 'groq') {
          return await this.queryGroq(prompt, systemPrompt, key);
        } else if (provider === 'gemini') {
          return await this.queryGemini(prompt, systemPrompt, key);
        } else if (provider === 'openai') {
          return await this.queryOpenAI(prompt, systemPrompt, key);
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
        return "میں اشاروں پر عمل کر سکتا ہوں، آواز میں بات کر سکتا ہوں، نوٹس اور ٹاسک یاد رکھ سکتا ہوں۔";
      } else if (lang === 'ps') {
        return "زه په اشارو حرکت کوم، خبرې کوم، او ستاسو دندې او یادښتونه ساتم.";
      } else {
        return "I can respond to hand gestures, answer voice questions, store notes in memory, and manage your tasks.";
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

  // Voice Output Execution
  async speakAnswer(answer) {
    this.isSpeaking = true;
    this.stopListening();
    this.onStatus({ status: 'ANSWERING...', transcript: answer });

    // Print "[agent] <answer>" in terminal (green with typewriter effect)
    this.onAgentAnswer(answer);

    // While it speaks, switch to HEAVY LIFTING for 1 second, then IDLE when finished
    this.onStateChange('LIFTING', 'ASSISTANT: ANSWERING', { silentVoice: true });

    let speechFinished = false;
    let oneSecondElapsed = false;

    const checkFinished = () => {
      if (speechFinished && oneSecondElapsed) {
        this.isSpeaking = false;
        this.onStateChange('IDLE', 'OPEN HAND', { silentVoice: true });
        this.onStatus({ status: 'IDLE', transcript: '' });
      }
    };

    setTimeout(() => {
      oneSecondElapsed = true;
      checkFinished();
    }, 1000);

    const langConfig = LANG_CONFIG[this.currentLang] || LANG_CONFIG.en;
    const langCode = langConfig.code;
    const langName = langConfig.name;

    // Check browser voices
    const voices = (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.getVoices)
      ? window.speechSynthesis.getVoices()
      : [];
    const matchingVoices = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith(langCode));

    // 3. For English, keep the browser voice as specified
    if (langCode === 'en' || matchingVoices.length > 0) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch (_) {}

        if (matchingVoices.length === 0) {
          this.onError(`no ${langName} voice installed`);
          speechFinished = true;
          checkFinished();
          return;
        }

        const SpeechUtterance = (typeof window !== 'undefined' && window.SpeechSynthesisUtterance) ||
          (typeof SpeechSynthesisUtterance !== 'undefined' ? SpeechSynthesisUtterance : class {});
        const utterance = new SpeechUtterance(answer);
        utterance.rate = 1.0;
        utterance.pitch = 0.8;
        utterance.lang = langConfig.recLang;

        if (langCode === 'en') {
          const preferred = matchingVoices.find(v =>
            v.name.includes('Google US English') ||
            v.name.includes('David') ||
            v.name.includes('Alex') ||
            v.name.includes('Natural') ||
            v.name.includes('English')
          );
          utterance.voice = preferred || matchingVoices[0];
        } else {
          utterance.voice = matchingVoices[0];
        }

        utterance.onend = () => {
          speechFinished = true;
          checkFinished();
        };
        utterance.onerror = (e) => {
          console.warn('SpeechSynthesis error:', e);
          speechFinished = true;
          checkFinished();
        };

        const maxDuration = Math.max(2500, answer.length * 100);
        setTimeout(() => {
          if (!speechFinished) {
            speechFinished = true;
            checkFinished();
          }
        }, maxDuration);

        try {
          window.speechSynthesis.speak(utterance);
        } catch (err) {
          console.warn('SpeechSynthesis speak error:', err);
          speechFinished = true;
          checkFinished();
        }
        return;
      }
    }

    // 3. For Urdu and Pashto with NO matching browser voice installed:
    // If VITE_OPENAI_KEY exists, use OpenAI TTS and play the returned audio
    const keys = getApiKeys();
    if (keys.openai) {
      const played = await this.speakWithOpenAITTS(answer, keys.openai, () => {
        speechFinished = true;
        checkFinished();
      });
      if (played) {
        return;
      }
    }

    // Fallback: no voice installed and no OpenAI key
    this.onError(`no ${langName} voice installed`);
    speechFinished = true;
    checkFinished();
  }

  // OpenAI TTS API (tts-1) for Urdu and Pashto audio playback
  async speakWithOpenAITTS(answer, openAiKey, onFinish) {
    try {
      const response = await fetch(AI_MODELS_CONFIG.openai.ttsEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: AI_MODELS_CONFIG.openai.ttsModel,
          input: answer,
          voice: AI_MODELS_CONFIG.openai.ttsVoice
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      const cleanup = () => {
        URL.revokeObjectURL(audioUrl);
        this.activeAudio = null;
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
}
