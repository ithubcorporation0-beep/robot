# 🤖 puppet-agent

> **Neural Marionette Interface** — A real-time 3D low-poly robot puppet controlled via webcam hand tracking with glowing cybernetic marionette strings.

![puppet-agent banner](https://img.shields.io/badge/Vite-Vanilla%20JS-646CFF?style=flat&logo=vite)
![Three.js](https://img.shields.io/badge/Three.js-WebGL-000000?style=flat&logo=three.js)
![MediaPipe](https://img.shields.io/badge/MediaPipe-Tasks%20Vision-00e5ff?style=flat)

---

## 🌟 Features

* **3D Low-Poly Robot Viewport (Three.js)**:
  * Procedural low-poly robot assembled purely from boxes, cylinders, and spheres without any external 3D model files.
  * Emissive neon visor, core reactor, and animated antenna with 5-point studio lighting and ground cyber pedestal.
  * Smooth kinematics easing (`lerp`) across idle breathing, thinking head-tilt, and heavy lifting strain postures.
* **Optical Hand Tracking (@mediapipe/tasks-vision)**:
  * Mirrored webcam optical preview in the lower-right corner.
  * Tracks 21 hand landmarks and renders white glowing dots on the **5 fingertips** (Thumb `4`, Index `8`, Middle `12`, Ring `16`, Pinky `20`).
* **Glowing Cybernetic Strings**:
  * Full-screen transparent canvas overlay with glowing orange quadratic bezier curves.
  * Realistic gravitational sag and tension vibration during heavy strain.
  * Animated energy pulses traveling down each string from fingertip to robot joint.
* **Gesture-to-State Rules**:
  * ✋ **Open Hand** (all 5 fingers extended) ➔ **IDLE**: Robot stands still with slow rhythmic breathing.
  * ☝️ **One Index Finger Up** ➔ **GENERATING NEW IDEA**: Robot head tilts quizzically, antenna pulses, and creative idea logs stream in the terminal.
  * ✊ **Closed Fist or Pinch** ➔ **HEAVY LIFTING**: Robot arms raise overhead in a squat and visibly shake/tremor under physical strain.
* **Fake Monospace Terminal**:
  * Green monospace CRT terminal (`agent --watch`) streaming real-time telemetry and state-driven events.

---

## 🚀 Quick Start

### 1. Prerequisites
* [Node.js](https://nodejs.org/) (v18+)

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

### 4. Configure AI Engine (Multi-Provider Fallback)
Create a `.env` file in the project root:
```env
# Groq: Llama 3.3 70B & Whisper Large v3 (HQ Listening)
VITE_GROQ_KEY="your-groq-api-key"

# Google Gemini: Gemini 2.5 Flash
VITE_GEMINI_KEY="your-gemini-api-key"

# OpenAI: GPT-4o Mini & TTS-1 (Urdu & Pashto Voice Output)
VITE_OPENAI_KEY="your-openai-api-key"
```

> [!WARNING]
> **SECURITY NOTICE: LOCAL USE ONLY**
> Keys in `VITE_` variables are embedded into the client-side JavaScript bundle during the build process and are visible to anyone accessing the site.
> Therefore, **this build is for local use only**. Never host or deploy this build publicly with production or confidential API keys.

---

## 🧠 Multi-Provider AI Architecture

* **Chat Answers Fallback Order**:
  1. **Groq** (`llama-3.3-70b-versatile`): Lightning-fast initial responder.
  2. **Google Gemini** (`gemini-2.5-flash`): High-context multimodal intelligence.
  3. **OpenAI** (`gpt-4o-mini`): Reliable secondary fallback.
  4. **Built-in Offline Engine**: Scripted responsive answers when offline or without API keys.
* **Dynamic Provider Badges**: Live indicator displays `AI: GROQ`, `AI: GEMINI`, `AI: OPENAI`, or `MODE: BUILT-IN`.
* **Voice Output**: Uses native browser speech synthesis for English. When Urdu or Pashto browser voices are unavailable, seamlessly synthesizes audio via OpenAI `tts-1` (`alloy`) if `VITE_OPENAI_KEY` is present.
* **HQ Listening**: Optional high-fidelity voice recording via `MediaRecorder` transcribed through Groq Whisper `whisper-large-v3` with language matching.
* **API Keys Settings Modal (`⚙️`)**: Interactive HUD panel to configure, test, and manage Groq, Google AI Studio (Gemini), and OpenAI keys directly from the browser (stored locally under `puppet_keys`), select the preferred chat provider, and toggle HQ Listening.

---

## 🎮 Controls

* **Webcam Mode**: Click **"START CAMERA"** in the top bar and allow camera permissions.
* **Keyboard Shortcuts**:
  * `Space` (Hold) : Speak to Puppet Agent
  * `1` : Simulate Open Hand (IDLE)
  * `2` : Simulate Index Finger Up (GENERATING NEW IDEA)
  * `3` : Simulate Closed Fist / Pinch (HEAVY LIFTING)
  * `C` : Toggle Camera On / Off
  * `F` : Toggle Fullscreen
  * `R` : Toggle 9:16 Vertical Reel Mode
  * `V` : Toggle Continuous Voice Recognition

