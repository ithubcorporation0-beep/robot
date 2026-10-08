// Voice Assistant Engine: Mode A (Built-in) and Mode B (Gemini AI)
// Echo protection, SpeechRecognition single-shot listening, multi-language support (EN, UR, PS), and state coordination.

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
    this.robotVoice = options.robotVoice;

    // Detect Vite environment variable VITE_AI_KEY
    this.apiKey = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_AI_KEY)
      ? String(import.meta.env.VITE_AI_KEY).trim()
      : '';

    this.isAiMode = Boolean(this.apiKey && this.apiKey.length > 5);

    // Multi-Language Persistence: Load saved language or default to 'en'
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

    this.initRecognition();
  }

  // Dynamic jokes getter for compatibility with unit tests and consumers
  get jokes() {
    return this.jokesPool[this.currentLang] || this.jokesPool.en;
  }

  getModeLabel() {
    return this.isAiMode ? "MODE: AI" : "MODE: BUILT-IN";
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

  startListening() {
    // Echo protection: never listen while speaking
    if (this.isSpeaking) {
      return;
    }
    if (!this.isSupported) {
      this.onError('microphone unavailable');
      return;
    }
    if (this.isListening) {
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
    if (this.isListening && this.recognition) {
      try {
        this.recognition.stop();
      } catch (_) {}
    }
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

    // 3. Generate answer (Mode B or Mode A)
    let answer = '';
    if (this.isAiMode) {
      try {
        answer = await this.queryGeminiAI(question);
      } catch (err) {
        const errorMsg = err.message || 'API request failed';
        this.onError(`ai error: ${errorMsg}`);
        // Fallback to Mode A
        answer = this.getBuiltInAnswer(question);
      }
    } else {
      answer = this.getBuiltInAnswer(question);
    }

    // Update conversation memory: keep last 6 messages
    this.conversationHistory.push({ role: 'user', parts: [{ text: question }] });
    this.conversationHistory.push({ role: 'model', parts: [{ text: answer }] });
    if (this.conversationHistory.length > 6) {
      this.conversationHistory = this.conversationHistory.slice(-6);
    }

    // 4. Answering: speak out loud, HEAVY LIFTING for 1s, then IDLE
    this.speakAnswer(answer);
  }

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

    // 4. Tell me a joke (8 short jokes per language, picked randomly)
    const isJoke = text.includes("joke") || text.includes("funny") ||
      /(لطیفہ سناؤ|کوئی لطیفہ|لطیفہ|مزاحیہ|ټوکه ووایه|یوه ټوکه|ټوکه|خندونکې)/i.test(text);

    if (isJoke) {
      const jokesList = this.jokesPool[lang] || this.jokesPool.en;
      return jokesList[Math.floor(Math.random() * jokesList.length)];
    }

    // 5. Who made you
    const isCreator = text.includes("who made you") || text.includes("who created you") ||
      /(کس نے بنایا|کس نے تخلیق کیا|چا جوړ کړې|چا جوړ کړی)/i.test(text);

    if (isCreator) {
      if (lang === 'ur') {
        return "مجھے ڈیپ مائنڈ انجینئرنگ ٹیم نے بطور مصنوعی ذہانت مارونیٹ تخلیق کیا ہے۔";
      } else if (lang === 'ps') {
        return "زه د ډیپ مائنډ انجینرۍ ټیم لخوا د مصنوعي ذہانت پتلی په توګه جوړ شوی یم.";
      } else {
        return "I was created as an agentic AI marionette by the DeepMind engineering team.";
      }
    }

    // 6. What can you do
    const isCapabilities = text.includes("what can you do") || text.includes("your capabilities") ||
      /(کیا کر سکتے ہو|تم کیا کرتے ہو|څه کولی شې|ستا وړتیاوې)/i.test(text);

    if (isCapabilities) {
      if (lang === 'ur') {
        return "میں تھری ڈی میں آپ کے اشاروں کی نقل کر سکتا ہوں، نیورل کام انجام دے سکتا ہوں، اور آواز کے جواب دے سکتا ہوں۔";
      } else if (lang === 'ps') {
        return "زه کولی شم په 3D کې ستاسو د لاس اشارو تقلید وکړم او ستاسو پوښتنو ته ځواب ووایم.";
      } else {
        return "I can mirror your hand gestures in 3D, simulate neural workloads, and answer your voice questions.";
      }
    }

    // 7. Thank you
    const isThankYou = text.includes("thank you") || text.includes("thanks") ||
      /(شکریہ|بہت شکریہ|مننه|ډېره مننه)/i.test(text);

    if (isThankYou) {
      if (lang === 'ur') {
        return "آپ کا بہت شکریہ! میں آپ کے اگلے سوال کے لیے تیار ہوں۔";
      } else if (lang === 'ps') {
        return "ډېره مننه! زه ستاسو بلې پوښتنې ته ولاړ یم.";
      } else {
        return "You are very welcome! Standing by for your next question.";
      }
    }

    // 8. How are you
    const isHowAreYou = text.includes("how are you") ||
      /(کیسے ہو|کیا حال ہے|کیسا ہے|څنګه یاست|څنګه یې|روغ جوړ)/i.test(text);

    if (isHowAreYou) {
      if (lang === 'ur') {
        return "تمام نیورل سرووز بہترین طریقے سے کام کر رہے ہیں۔ پوچھنے کا شکریہ!";
      } else if (lang === 'ps') {
        return "ټول سیسټمونه په پوره موثریت سره کار کوي. د پوښتنې لپاره مننه!";
      } else {
        return "All neural servos and telemetry strings are operating at peak efficiency. Thank you for asking!";
      }
    }

    // 9. Fallback (Anything else)
    if (lang === 'ur') {
      return "میں فی الحال صرف بنیادی سوالات کے جواب دے سکتا ہوں۔ مکمل جوابات کے لیے اے پی آئی کی شامل کریں۔";
    } else if (lang === 'ps') {
      return "زه دا مهال یوازې بنسټیزو پوښتنو ته ځواب ویلی شم. د بشپړو ځوابونو لپاره د API کیلي ورزیاته کړئ.";
    } else {
      return "I can only answer basic questions right now. Add an API key to unlock full answers.";
    }
  }

  async queryGeminiAI(question) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`;

    let systemPrompt = "You are Puppet Agent, a friendly robot voice assistant. Answer ONLY in English, in 1 to 2 short spoken sentences. No markdown, no lists, no emojis.";
    if (this.currentLang === 'ur') {
      systemPrompt = "You are Puppet Agent, a friendly robot voice assistant. Reply ONLY in Urdu, in 1 to 2 short spoken sentences, using proper script (Urdu in Arabic script / نستعلیق / عربی رسم الخط). Do NOT use Roman Urdu or English. No markdown, no lists, no emojis.";
    } else if (this.currentLang === 'ps') {
      systemPrompt = "You are Puppet Agent, a friendly robot voice assistant. Reply ONLY in Pashto, in 1 to 2 short spoken sentences, using proper script (Pashto in Arabic script / پښتو ليکدود). Do NOT use Latin/Roman Pashto or English. No markdown, no lists, no emojis.";
    }

    const payload = {
      systemInstruction: {
        parts: [
          {
            text: systemPrompt
          }
        ]
      },
      contents: [
        ...this.conversationHistory,
        {
          role: 'user',
          parts: [{ text: question }]
        }
      ]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const msg = errBody.error?.message || `HTTP ${response.status} ${response.statusText}`;
      throw new Error(msg);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidate) {
      throw new Error("No response generated by model");
    }

    // Strip markdown or emojis
    return candidate.replace(/[*_#`~]/g, '').trim();
  }

  speakAnswer(answer) {
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

    // Browser speech synthesis (calm voice, pitch 0.8, rate 1.0)
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}

      const voices = window.speechSynthesis.getVoices ? window.speechSynthesis.getVoices() : [];
      const matchingVoices = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith(langCode));

      if (matchingVoices.length === 0) {
        // If no voice exists for that language, still show the answer text in the terminal and print "[warn] no <language> voice installed".
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

      // Pick best matching voice
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

      // Fallback timeout in case onend never triggers in browser
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
    } else {
      this.onError(`no ${langName} voice installed`);
      speechFinished = true;
      checkFinished();
    }
  }
}
