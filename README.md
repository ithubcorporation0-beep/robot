# 🤖 PUPPET-AGENT // AI Voice Assistant

> **Interactive 3D Robot AI Voice Assistant** — A real-time, multilingual conversational avatar powered by Three.js and a multi-provider fallback AI engine (Groq, Google Gemini, OpenAI, & built-in offline intelligence).

![puppet-agent banner](https://img.shields.io/badge/Vite-Vanilla%20JS-646CFF?style=flat&logo=vite)
![Three.js](https://img.shields.io/badge/Three.js-WebGL-000000?style=flat&logo=three.js)
![Multi-Provider AI](https://img.shields.io/badge/AI-Groq%20%7C%20Gemini%20%7C%20OpenAI-ff6b00?style=flat)

---

## 🌟 Key Features

* **3D Low-Poly Robot Avatar (Three.js)**:
  * Procedural low-poly robot assembled with smooth studio lighting, ground pedestal, and dynamic emissive shaders.
  * **4 Distinct Avatar States**:
    * 🔵 **READY**: Gentle idling, rhythmic breathing, and soft cyan visor glow.
    * 💠 **LISTENING**: Attentive stance with vibrant cyan illumination and mic pulse.
    * 🟠 **THINKING**: Quizzical head tilt with pulsing orange visor during inference.
    * ⚡ **SPEAKING**: Expressive head nods with animated speech-reactive visor flickers.
* **Multilingual Voice Assistant**:
  * Native spoken interaction in **English**, **Urdu (اردو)**, and **Pashto (پښتو)** with full right-to-left (RTL) typography.
  * Real-time live caption box displaying transcribed speech and assistant answers.
* **Hands-Free Conversation Mode**:
  * Optional loop mode automatically resumes listening after the assistant finishes speaking.
  * Built-in 20-second silence timer with automatic standby.
  * Instant speech barge-in/interruption by tapping the mic or pressing `Space`.
* **Multi-Provider AI Engine with Automatic Fallback**:
  * **Groq** (`llama-3.3-70b-versatile` & Whisper `whisper-large-v3`): Ultra-fast primary response engine.
  * **Google Gemini** (`gemini-2.5-flash`): High-context multimodal intelligence.
  * **OpenAI** (`gpt-4o-mini` & `tts-1`): Reliable secondary fallback and audio synthesis.
  * **Built-in Offline Engine**: Scripted responsive answers when offline or without API keys.
* **Persistent Memory & Tasks (`MemoryManager`)**:
  * Natural language memory commands ("Remember that...", "What do you remember?", "Forget everything").
  * Retains user profile, names, and customized notes locally in the browser (`localStorage`).
* **Settings & API Keys Management (`⚙️`)**:
  * Dedicated HUD settings modal (shortcut `S`).
  * Direct key testing (`TEST` button with live ping status) and storage persistence in browser `localStorage`.
  * Custom system prompt editor with one-click `RESET` to defaults.

---

## 🚀 Quick Start

### 1. Prerequisites
* [Node.js](https://nodejs.org/) (v18+)
* Modern browser with Web Speech API support (Chrome, Edge, Safari)

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/ithubcorporation0-beep/robot.git
cd robot

# Install dependencies
npm install
```

### 3. Run Development Server
```bash
npm run dev
```
Open **[http://localhost:5173/](http://localhost:5173/)** in your browser.

### 4. Optional: Configure API Keys in `.env`
You can provide keys via `.env` or enter them directly inside the in-app **Settings (`⚙️`)** panel:
```env
# Groq: Llama 3.3 70B & Whisper Large v3
VITE_GROQ_KEY="your-groq-api-key"

# Google Gemini: Gemini 2.5 Flash
VITE_GEMINI_KEY="your-gemini-api-key"

# OpenAI: GPT-4o Mini & TTS-1
VITE_OPENAI_KEY="your-openai-api-key"
```

> [!WARNING]
> **SECURITY NOTICE: LOCAL USE ONLY**
> Keys saved in `.env` or entered into the settings modal are used client-side for direct API calls.
> Keep this application local and never deploy publicly with private credentials.

---

## 🎮 Controls & Shortcuts

| Action | Shortcut / Control |
|---|---|
| **Speak to Robot** | Click large 🎙️ button or **Hold `Space`** |
| **Interrupt Assistant** | Click 🎙️ or tap `Space` while robot is speaking |
| **Open Settings & API Keys** | Click ⚙️ button (top right) or press **`S`** |
| **Close Settings** | Press **`Escape`** or click ✕ |
| **Toggle Voice Output** | Click speaker icon 🔊 / 🔇 (top right) |
| **Switch Language** | Click `EN`, `اردو`, or `پښتو` buttons |
| **Toggle Conversation Mode** | Click `CONVERSATION: ON/OFF` button |
| **Clear Conversation** | Click `CLEAR` in conversation history panel |

---

## 📁 Project Architecture

```
├── index.html          # Main application structure & settings modal
├── package.json        # Dependencies (Three.js, Vite)
├── src/
│   ├── main.js         # Core application coordinator & DOM events
│   ├── robot.js        # Three.js 3D robot avatar & kinematics
│   ├── assistant.js    # Multi-provider voice assistant & LLM streaming
│   ├── voice.js        # SpeechSynthesis & audio utterance management
│   ├── memory.js       # Local persistent memory & task manager
│   └── style.css       # Cybernetic dark theme stylesheet
```
