// Browser Built-in Voice System (SpeechSynthesis)
// Zero external APIs used for default speech output.

export class RobotVoice {
  constructor() {
    this.enabled = false; // Starts OFF until user clicks speaker button
    this.speech = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.voices = [];
    this.isSpeaking = false;
    this.rate = 1.0;
    this.pitch = 1.0;
    this.volume = 1.0;
    this.selectedVoiceURI = '';

    if (this.speech) {
      this.loadVoices();
      if (typeof window.speechSynthesis.onvoiceschanged !== 'undefined') {
        window.speechSynthesis.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  setVoiceParams(params = {}) {
    if (typeof params.rate === 'number') this.rate = params.rate;
    if (typeof params.pitch === 'number') this.pitch = params.pitch;
    if (typeof params.volume === 'number') this.volume = params.volume;
    if (typeof params.selectedVoiceURI === 'string') this.selectedVoiceURI = params.selectedVoiceURI;
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
    const preferred = english.find(v =>
      v.name.includes('Google US English') ||
      v.name.includes('David') ||
      v.name.includes('Alex') ||
      v.name.includes('Natural') ||
      v.name.includes('English')
    );
    return preferred || english[0] || this.voices[0] || null;
  }

  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled && this.speech) {
      try {
        this.speech.cancel();
      } catch (_) {}
      this.isSpeaking = false;
    }
    return this.enabled;
  }

  speak(text, onEnd) {
    if (!this.enabled || !this.speech) {
      if (onEnd) onEnd();
      return;
    }

    try {
      this.speech.cancel();
    } catch (_) {}

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = this.rate || 1.0;
    utterance.pitch = this.pitch || 1.0;
    utterance.volume = this.volume !== undefined ? this.volume : 1.0;

    let voice = null;
    if (this.selectedVoiceURI && this.voices && this.voices.length > 0) {
      voice = this.voices.find(v => v.voiceURI === this.selectedVoiceURI || v.name === this.selectedVoiceURI);
    }
    if (!voice) {
      voice = this.getRoboticEnglishVoice();
    }
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
      if (onEnd) onEnd();
    }
  }

  cancel() {
    if (this.speech) {
      try {
        this.speech.cancel();
      } catch (_) {}
    }
    this.isSpeaking = false;
  }
}
