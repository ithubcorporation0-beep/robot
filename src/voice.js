// Browser Built-in Voice System (SpeechSynthesis & WebkitSpeechRecognition)
// Zero external APIs used.

export class RobotVoice {
  constructor() {
    this.enabled = false; // Starts OFF until user clicks speaker button
    this.speech = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.voices = [];
    this.isIdeaSpeaking = false;
    this.isSpeaking = false;

    if (this.speech) {
      this.loadVoices();
      if (typeof window.speechSynthesis.onvoiceschanged !== 'undefined') {
        window.speechSynthesis.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  loadVoices() {
    if (!this.speech) return;
    this.voices = this.speech.getVoices() || [];
  }

  getRoboticEnglishVoice() {
    if (!this.voices || this.voices.length === 0) {
      this.loadVoices();
    }
    if (!this.voices || this.voices.length === 0) return null;

    const english = this.voices.filter(v => v.lang && v.lang.toLowerCase().startsWith('en'));
    // Pick calm/robotic English voice if available
    const preferred = english.find(v => 
      v.name.includes('Google US English') ||
      v.name.includes('David') ||
      v.name.includes('Alex') ||
      v.name.includes('Natural') ||
      v.name.includes('English')
    );
    return preferred || english[0] || this.voices[0] || null;
  }

  speak(text, onEnd) {
    if (!this.enabled || !this.speech) return;

    // Never let lines pile up: cancel current speech before speaking new one
    try {
      this.speech.cancel();
    } catch (_) {}

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;  // Specification: rate 1.0
    utterance.pitch = 0.8; // Specification: pitch 0.8 (calm, slightly robotic)

    const voice = this.getRoboticEnglishVoice();
    if (voice) {
      utterance.voice = voice;
    }

    this.isSpeaking = true;

    utterance.onend = () => {
      this.isSpeaking = false;
      if (onEnd) onEnd();
    };
    utterance.onerror = () => {
      this.isSpeaking = false;
      if (onEnd) onEnd();
    };

    try {
      this.speech.speak(utterance);
    } catch (err) {
      this.isSpeaking = false;
      console.warn('Speech synthesis error:', err);
    }
  }

  speakStateChange(state) {
    if (!this.enabled) return;

    if (state === 'IDLE') {
      this.isIdeaSpeaking = false;
      this.speak("Standing by.");
    } else if (state === 'IDEA') {
      this.isIdeaSpeaking = true;
      this.speak("Generating new idea.");
    } else if (state === 'LIFTING') {
      this.isIdeaSpeaking = false;
      this.speak("Heavy lifting.");
    }
  }

  speakIdeaText(ideaText) {
    if (!this.enabled) return;
    // Clean prefix if present (e.g. "IDEA 14: ...")
    const cleaned = ideaText.replace(/^IDEA\s*\d*:\s*/i, '').trim();
    this.speak(cleaned);
  }

  speakLiftingDone() {
    if (!this.enabled) return;
    this.speak("Done.");
  }

  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) {
      this.isSpeaking = false;
      if (this.speech) {
        try {
          this.speech.cancel();
        } catch (_) {}
      }
    }
    return this.enabled;
  }
}

import { checkWakeWord } from './delegation.js';

export class VoiceCommander {
  constructor(options = {}) {
    this.onCommand = options.onCommand || (() => {});
    this.onSpeechHeard = options.onSpeechHeard || (() => {});
    this.onStatusChange = options.onStatusChange || (() => {});
    this.onUnsupported = options.onUnsupported || (() => {});
    this.onQuery = options.onQuery || (() => {});
    this.isSpeakingChecker = options.isSpeakingChecker || (() => false);

    this.isSupported = typeof window !== 'undefined' && (
      'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
    );

    this.recognition = null;
    this.isActive = false;
    this.wakeWordEnabled = false; // Off by default as required
    this.isPausedForSpeech = false;
    this.restartTimer = null;
  }

  init() {
    if (!this.isSupported) {
      this.onUnsupported();
      return false;
    }

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRec();
    this.recognition.continuous = true;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      this.onStatusChange(true);
    };

    this.recognition.onresult = (event) => {
      // 5. Echo protection: ignore listening while robot speaks
      if (this.isPausedForSpeech || (this.isSpeakingChecker && this.isSpeakingChecker())) {
        return;
      }

      const results = event.results;
      const lastResult = results[results.length - 1];
      if (lastResult && lastResult[0]) {
        const rawTranscript = lastResult[0].transcript.trim();

        // 4. Wake word detection: when continuous listening is on and wake word is enabled,
        // only react to commands that start with "hey puppet" (also accept "ہے پپٹ")
        const wakeCheck = checkWakeWord(rawTranscript, this.wakeWordEnabled);
        if (!wakeCheck.hasWakeWord) {
          // Ignored because wake word was not present
          return;
        }

        const effectiveCommand = (wakeCheck.command || '').trim();
        this.onSpeechHeard(rawTranscript);

        if (!effectiveCommand) return;

        // Check if command is a state change (idle / idea / lift)
        const matchedState = this.parseCommand(effectiveCommand.toLowerCase());
        if (!matchedState) {
          // Pass command to delegation / assistant query handler
          this.onQuery(effectiveCommand, rawTranscript);
        }
      }
    };

    this.recognition.onerror = (event) => {
      console.warn('SpeechRecognition error:', event.error);
      if (event.error === 'not-allowed') {
        this.isActive = false;
        this.onStatusChange(false);
      }
    };

    this.recognition.onend = () => {
      // Auto-restart if it stops while active
      if (this.isActive) {
        clearTimeout(this.restartTimer);
        this.restartTimer = setTimeout(() => {
          if (this.isActive) {
            try {
              this.recognition.start();
            } catch (_) {}
          }
        }, 200);
      } else {
        this.onStatusChange(false);
      }
    };

    return true;
  }

  parseCommand(text) {
    // Commands: "idle" or "stop" = IDLE; "idea" or "think" = generating new idea; "lift" or "work" = HEAVY LIFTING
    let state = null;
    let word = null;

    if (text.includes('idle') || text.includes('stop')) {
      state = 'IDLE';
      word = text.includes('stop') ? 'stop' : 'idle';
    } else if (text.includes('idea') || text.includes('think')) {
      state = 'IDEA';
      word = text.includes('think') ? 'think' : 'idea';
    } else if (text.includes('lift') || text.includes('work')) {
      state = 'LIFTING';
      word = text.includes('work') ? 'work' : 'lift';
    }

    if (state && word) {
      this.onCommand(state, word);
      return true;
    }
    return false;
  }

  setWakeWord(enabled) {
    this.wakeWordEnabled = Boolean(enabled);
    return this.wakeWordEnabled;
  }

  toggleWakeWord() {
    this.wakeWordEnabled = !this.wakeWordEnabled;
    return this.wakeWordEnabled;
  }

  pauseForSpeech() {
    this.isPausedForSpeech = true;
  }

  resumeAfterSpeech() {
    this.isPausedForSpeech = false;
  }

  toggle() {
    if (!this.isSupported) {
      this.onUnsupported();
      return false;
    }
    if (!this.recognition) {
      this.init();
    }

    if (this.isActive) {
      this.stop();
    } else {
      this.start();
    }
    return this.isActive;
  }

  start() {
    if (!this.isSupported) {
      this.onUnsupported();
      return;
    }
    if (!this.recognition) this.init();
    this.isActive = true;
    try {
      this.recognition.start();
    } catch (_) {}
    this.onStatusChange(true);
  }

  stop() {
    this.isActive = false;
    clearTimeout(this.restartTimer);
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (_) {}
    }
    this.onStatusChange(false);
  }
}
