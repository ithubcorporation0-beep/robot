import { RobotScene } from './robot.js';
import { FakeTerminal } from './terminal.js';
import { StringsRenderer } from './strings.js';
import { HandTracker } from './handTracker.js';
import { sound } from './sound.js';
import { RobotVoice, VoiceCommander } from './voice.js';
import {
  VoiceAssistant,
  getApiKeys,
  getSavedPuppetKeys,
  savePuppetKeys,
  clearPuppetKeys,
  testApiKey,
  AI_MODELS_CONFIG
} from './assistant.js';
import { DelegationManager, detectDelegationType, checkWakeWord } from './delegation.js';
import { MemoryManager } from './memory.js';

// DOM Element references
const robotContainer = document.getElementById('three-container');
const stringsCanvas = document.getElementById('strings-canvas');
const terminalLogs = document.getElementById('terminal-logs');
const termLineCount = document.getElementById('term-line-count');
const statusBadge = document.getElementById('robot-status-badge');
const statusTextLabel = document.getElementById('status-text-label');
const gestureLabel = document.getElementById('gesture-detected-label');
const fpsLabel = document.getElementById('hud-fps-label');
const webcamVideo = document.getElementById('webcam-video');
const webcamOverlay = document.getElementById('webcam-overlay');
const camPromptOverlay = document.getElementById('cam-prompt-overlay');
const camStatusChip = document.getElementById('cam-status-chip');
const cameraToggleBtn = document.getElementById('camera-toggle-btn');
const camActivateDirectBtn = document.getElementById('cam-activate-direct-btn');
const simToggleBtn = document.getElementById('sim-toggle-btn');
const simDrawer = document.getElementById('sim-drawer');
const soundToggleBtn = document.getElementById('sound-toggle-btn');
const clearTermBtn = document.getElementById('clear-term-btn');
const simButtons = document.querySelectorAll('.sim-btn');
const gestureDebugBox = document.getElementById('gesture-debug-box');
const debugGestureVal = document.getElementById('debug-gesture-val');
const debugIndicatorDot = document.getElementById('debug-indicator-dot');
const reelToggleBtn = document.getElementById('reel-toggle-btn');
const fullscreenToggleBtn = document.getElementById('fullscreen-toggle-btn');
const appContainer = document.getElementById('app');
const voiceCmdBtn = document.getElementById('voice-cmd-btn');
const voiceCmdText = document.getElementById('voice-cmd-text');
const voiceHeardLabel = document.getElementById('voice-heard-label');

// Voice Assistant DOM elements
const assistantMicBtn = document.getElementById('assistant-mic-btn');
const assistantStatusBox = document.getElementById('assistant-status-box');
const assistantStatusLabel = document.getElementById('assistant-status-label');
const assistantTranscriptLabel = document.getElementById('assistant-transcript-label');
const assistantModeText = document.getElementById('assistant-mode-text');
const assistantModeDot = document.getElementById('assistant-mode-dot');
const hudAssistantModeText = document.getElementById('hud-assistant-mode-text');
const hudAssistantModeDot = document.getElementById('hud-assistant-mode-dot');

// Persistent Memory & Task Manager DOM Elements
const memoryNotesCount = document.getElementById('memory-notes-count');
const clearMemoryBtn = document.getElementById('clear-memory-btn');
const tasksCountPill = document.getElementById('tasks-count-pill');
const taskReadAllBtn = document.getElementById('task-read-all-btn');
const taskClearAllBtn = document.getElementById('task-clear-all-btn');
const taskQuickInput = document.getElementById('task-quick-input');
const taskQuickAddBtn = document.getElementById('task-quick-add-btn');
const tasksListContainer = document.getElementById('tasks-list-container');

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function updateNotesBadge(count) {
  if (memoryNotesCount) {
    memoryNotesCount.textContent = count;
  }
}

function renderTasksUI(tasks = []) {
  if (tasksCountPill) {
    tasksCountPill.textContent = tasks.length;
  }
  if (!tasksListContainer) return;

  if (tasks.length === 0) {
    tasksListContainer.innerHTML = `<div class="tasks-empty-state">No tasks yet. Say "add task ..." or use input above.</div>`;
    return;
  }

  const html = tasks.map(t => `
    <div class="task-item-card ${t.completed ? 'completed' : ''}" data-task-id="${escapeHtml(t.id)}">
      <input type="checkbox" class="task-item-checkbox" ${t.completed ? 'checked' : ''} data-task-id="${escapeHtml(t.id)}" title="Toggle done" />
      <span class="task-item-num">#${t.number}</span>
      <span class="task-item-text">${escapeHtml(t.text)}</span>
      <button class="task-item-del-btn" data-task-id="${escapeHtml(t.id)}" title="Delete task">✕</button>
    </div>
  `).join('');

  tasksListContainer.innerHTML = html;
}

function toggleDebugLabel() {
  if (gestureDebugBox) {
    gestureDebugBox.classList.toggle('hidden');
  }
}

if (gestureDebugBox) {
  gestureDebugBox.addEventListener('click', toggleDebugLabel);
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.warn('Fullscreen error:', err);
    });
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
}

function toggleReelMode() {
  if (appContainer) {
    appContainer.classList.toggle('reel-mode');
  }
}

if (fullscreenToggleBtn) {
  fullscreenToggleBtn.addEventListener('click', toggleFullscreen);
}

if (reelToggleBtn) {
  reelToggleBtn.addEventListener('click', toggleReelMode);
}

// Hide mouse cursor after 2 seconds of no movement
let mouseIdleTimer = null;
function handleUserActivity() {
  document.body.classList.remove('hide-cursor');
  clearTimeout(mouseIdleTimer);
  mouseIdleTimer = setTimeout(() => {
    document.body.classList.add('hide-cursor');
  }, 2000);
}
window.addEventListener('mousemove', handleUserActivity);
window.addEventListener('mousedown', handleUserActivity);
window.addEventListener('keydown', handleUserActivity);
handleUserActivity();

// Initialize Core Subsystems
const robotVoice = new RobotVoice();
const robot = new RobotScene(robotContainer);
const terminal = new FakeTerminal(terminalLogs, termLineCount, {
  onIdea: (ideaText) => {
    robotVoice.speakIdeaText(ideaText);
  },
  onLiftingDone: () => {
    robotVoice.speakLiftingDone();
  }
});
const strings = new StringsRenderer(stringsCanvas);

let currentState = 'IDLE';

function setCameraUI(isActive) {
  if (camPromptOverlay) {
    if (isActive) {
      camPromptOverlay.classList.add('hidden');
      camPromptOverlay.style.display = 'none';
    } else {
      camPromptOverlay.classList.remove('hidden');
      camPromptOverlay.style.display = 'flex';
    }
  }
  if (isActive) {
    cameraToggleBtn.innerHTML = `<span class="btn-icon">⏹</span><span class="btn-text">STOP CAMERA</span>`;
    if (camStatusChip) {
      camStatusChip.innerHTML = `<span class="chip-dot glow-green"></span>WEBCAM ACTIVE`;
    }
  } else {
    cameraToggleBtn.innerHTML = `<span class="btn-icon">📷</span><span class="btn-text">START CAMERA</span>`;
    if (camStatusChip) {
      camStatusChip.innerHTML = `<span class="chip-dot glow-orange"></span>SIMULATOR ACTIVE`;
    }
  }
}

// Initialize Hand Tracker
const tracker = new HandTracker({
  video: webcamVideo,
  overlayCanvas: webcamOverlay,
  onCameraStart: () => {
    setCameraUI(true);
  },
  onCameraStop: () => {
    setCameraUI(false);
  },
  onGestureChange: (state, label) => {
    setState(state, label);
  },
  onHandLost: () => {
    setState('IDLE', 'OPEN HAND');
    terminal.appendLine('[warn] hand lost', 'warn-line');
  },
  onTrackingUpdate: (info) => {
    if (info.handDetected) {
      if (camStatusChip) {
        camStatusChip.innerHTML = `<span class="chip-dot glow-green"></span>HAND TRACKED`;
      }
      if (debugGestureVal) {
        debugGestureVal.textContent = info.detectedLabel || tracker.detectedGestureLabel;
      }
      if (debugIndicatorDot) {
        debugIndicatorDot.classList.remove('searching');
      }
    } else {
      if (camStatusChip && tracker.isCameraActive) {
        camStatusChip.innerHTML = `<span class="chip-dot glow-orange"></span>SEARCHING HAND...`;
      }
      if (debugGestureVal) {
        debugGestureVal.textContent = 'NO HAND DETECTED';
      }
      if (debugIndicatorDot) {
        debugIndicatorDot.classList.add('searching');
      }
    }
  }
});

// State Management
function setState(newState, gestureName, options = {}) {
  const silentVoice = options.silentVoice || false;
  if (currentState === newState && gestureName) {
    if (gestureLabel) gestureLabel.textContent = `GESTURE: ${gestureName}`;
    return;
  }

  currentState = newState;
  robot.setState(newState);
  sound.playStateChange();
  if (!silentVoice) {
    robotVoice.speakStateChange(newState);
  }

  // Update Status Badge & HUD
  statusBadge.setAttribute('data-state', newState);

  if (newState === 'IDLE') {
    statusTextLabel.textContent = 'IDLE : STANDING STILL';
    if (gestureLabel) gestureLabel.textContent = gestureName ? `GESTURE: ${gestureName}` : 'GESTURE: OPEN HAND';
  } else if (newState === 'IDEA') {
    statusTextLabel.textContent = 'THINKING : GENERATING NEW IDEA';
    if (gestureLabel) gestureLabel.textContent = gestureName ? `GESTURE: ${gestureName}` : 'GESTURE: ONE INDEX FINGER UP';
  } else if (newState === 'LIFTING') {
    statusTextLabel.textContent = 'WARNING : HEAVY LIFTING';
    if (gestureLabel) gestureLabel.textContent = gestureName ? `GESTURE: ${gestureName}` : 'GESTURE: CLOSED FIST / PINCH';
  }

  // Sync Simulator UI buttons
  simButtons.forEach(btn => {
    const btnGesture = btn.getAttribute('data-gesture');
    const isMatch = (newState === 'IDLE' && btnGesture === 'OPEN_HAND') ||
                    (newState === 'IDEA' && btnGesture === 'INDEX_UP') ||
                    (newState === 'LIFTING' && btnGesture === 'FIST');
    btn.classList.toggle('active', isMatch);
  });
}

// Initialize Persistent Memory & Task Manager (localStorage only)
const memory = new MemoryManager({
  terminal,
  robotVoice,
  onNotesChange: (notes) => {
    updateNotesBadge(notes.length);
  },
  onTasksChange: (tasks) => {
    renderTasksUI(tasks);
  }
});

// Initialize Voice Assistant Engine (Mode A Built-in / Mode B AI)
const assistant = new VoiceAssistant({
  robotVoice,
  onStateChange: (state, label, options) => {
    setState(state, label, options);
  },
  onUserQuestion: (question) => {
    terminal.appendLine(`[user] ${question}`, 'user-line');
    memory.addConversationMessage('user', question);
  },
  onAgentAnswer: (answer) => {
    terminal.appendLine(`[agent] ${answer}`, 'agent-line');
    memory.addConversationMessage('model', answer);
  },
  onError: (errMessage) => {
    terminal.appendLine(`[warn] ${errMessage}`, 'warn-line');
  },
  onProviderBadgeUpdate: (badgeText, isAi) => {
    updateModeBadges(badgeText, isAi);
  },
  onStatus: ({ status, transcript }) => {
    const waveformContainer = document.getElementById('voice-waveform-container');
    const waveformStatusText = document.getElementById('waveform-status-text');

    if (status === 'LISTENING...') {
      if (waveformContainer) {
        waveformContainer.classList.add('listening');
        waveformContainer.classList.remove('speaking');
      }
      if (waveformStatusText) {
        waveformStatusText.textContent = 'AUDIO INPUT // LISTENING...';
      }
      if (assistantStatusBox) {
        assistantStatusBox.classList.remove('hidden');
      }
      if (assistantStatusLabel) {
        assistantStatusLabel.textContent = 'LISTENING...';
        assistantStatusLabel.className = 'assistant-status-label listening';
      }
      if (assistantTranscriptLabel) {
        assistantTranscriptLabel.textContent = transcript || 'Speak your question...';
      }
      if (assistantMicBtn) {
        assistantMicBtn.classList.add('listening', 'active');
        assistantMicBtn.classList.remove('thinking');
      }
    } else if (status === 'THINKING...') {
      if (waveformContainer) {
        waveformContainer.classList.remove('listening', 'speaking');
      }
      if (waveformStatusText) {
        waveformStatusText.textContent = 'NEURAL COPROCESSOR // THINKING';
      }
      if (assistantStatusBox) {
        assistantStatusBox.classList.remove('hidden');
      }
      if (assistantStatusLabel) {
        assistantStatusLabel.textContent = 'THINKING...';
        assistantStatusLabel.className = 'assistant-status-label thinking';
      }
      if (assistantTranscriptLabel) {
        assistantTranscriptLabel.textContent = transcript ? `"${transcript}"` : '';
      }
      if (assistantMicBtn) {
        assistantMicBtn.classList.remove('listening');
        assistantMicBtn.classList.add('thinking');
      }
    } else if (status === 'ANSWERING...') {
      if (waveformContainer) {
        waveformContainer.classList.add('speaking');
        waveformContainer.classList.remove('listening');
      }
      if (waveformStatusText) {
        waveformStatusText.textContent = 'VOICE SYNTHESIS // ACTIVE';
      }
      if (assistantStatusBox) {
        assistantStatusBox.classList.remove('hidden');
      }
      if (assistantStatusLabel) {
        assistantStatusLabel.textContent = 'ANSWERING...';
        assistantStatusLabel.className = 'assistant-status-label';
      }
      if (assistantTranscriptLabel) {
        assistantTranscriptLabel.textContent = transcript || '';
      }
      if (assistantMicBtn) {
        assistantMicBtn.classList.remove('listening', 'thinking', 'active');
      }
    } else {
      // IDLE
      if (waveformContainer) {
        waveformContainer.classList.remove('listening', 'speaking');
      }
      if (waveformStatusText) {
        waveformStatusText.textContent = 'AUDIO SPECTRUM // STANDBY';
      }
      if (assistantStatusBox) {
        assistantStatusBox.classList.add('hidden');
      }
      if (assistantTranscriptLabel) {
        assistantTranscriptLabel.textContent = '';
      }
      if (assistantMicBtn) {
        assistantMicBtn.classList.remove('listening', 'thinking', 'active');
      }
    }
  }
});

function updateModeBadges(forcedBadgeText, forcedIsAi) {
  const modeText = forcedBadgeText || assistant.getBadgeText();
  const isAi = (forcedIsAi !== undefined) ? forcedIsAi : assistant.isAiMode;
  if (assistantModeText) assistantModeText.textContent = modeText;
  if (hudAssistantModeText) hudAssistantModeText.textContent = modeText;
  if (assistantModeDot) {
    assistantModeDot.className = isAi ? 'chip-dot glow-green' : 'chip-dot glow-cyan';
  }
  if (hudAssistantModeDot) {
    hudAssistantModeDot.className = isAi ? 'chip-dot glow-green' : 'chip-dot glow-cyan';
  }
}
updateModeBadges();

memory.assistant = assistant;

// Sync initial UI state from localStorage
updateNotesBadge(memory.getNotes().length);
renderTasksUI(memory.getTasks());

// 1. Startup greeting: If name was saved, greet user in selected language
const startupGreeting = memory.getStartupGreeting(assistant.currentLang);
if (startupGreeting) {
  setTimeout(() => {
    terminal.appendLine(`[agent] ${startupGreeting}`, 'agent-line');
    if (robotVoice && robotVoice.enabled) {
      robotVoice.speak(startupGreeting);
    }
  }, 400);
}

if (!assistant.isSupported) {
  terminal.appendLine('[warn] microphone unavailable', 'warn-line');
}

// 1. Specialized Agent Squad DOM Elements & Delegation Manager
const agentCards = {
  coder: {
    card: document.getElementById('agent-card-coder'),
    status: document.getElementById('agent-status-coder'),
    progress: document.getElementById('agent-prog-coder')
  },
  researcher: {
    card: document.getElementById('agent-card-researcher'),
    status: document.getElementById('agent-status-researcher'),
    progress: document.getElementById('agent-prog-researcher')
  },
  designer: {
    card: document.getElementById('agent-card-designer'),
    status: document.getElementById('agent-status-designer'),
    progress: document.getElementById('agent-prog-designer')
  },
  scheduler: {
    card: document.getElementById('agent-card-scheduler'),
    status: document.getElementById('agent-status-scheduler'),
    progress: document.getElementById('agent-prog-scheduler')
  }
};

const delegation = new DelegationManager({
  terminal,
  robotVoice,
  assistant,
  onStateChange: (state, label, options) => {
    setState(state, label, options);
  },
  onCardUpdate: (agentKey, status, progress) => {
    const el = agentCards[agentKey];
    if (!el) return;
    if (el.status) {
      el.status.textContent = status;
      el.status.className = `agent-card-status status-${status.toLowerCase()}`;
    }
    if (el.progress) {
      el.progress.style.width = `${progress}%`;
    }
    if (el.card) {
      el.card.classList.toggle('working', status === 'WORKING');
    }
  }
});

// Memory command execution helper
async function handleMemoryCommand(cmd, rawQuery) {
  const result = await memory.executeCommand(cmd, assistant.currentLang);
  if (!result) return;

  if (result.terminal) {
    terminal.appendLine(result.terminal, result.terminalType || 'ok-line');
  }

  if (result.speech) {
    assistant.speakAnswer(result.speech);
  }
}

// Hook memory & delegation into voice assistant question processing
assistant.onDelegate = (query) => {
  // 1. Check persistent memory & task commands
  const memCmd = memory.parseCommand(query);
  if (memCmd) {
    handleMemoryCommand(memCmd, query);
    return true;
  }

  // 2. Check delegation squad commands (Coder, Researcher, Designer, Scheduler)
  const agentType = detectDelegationType(query);
  if (agentType) {
    delegation.delegate(agentType, query);
    return true;
  }

  return false;
};

// Allow clicking cards to directly test delegation for that agent
Object.keys(agentCards).forEach(key => {
  const item = agentCards[key];
  if (item && item.card) {
    item.card.addEventListener('click', () => {
      const samplePrompts = {
        coder: 'build a high-performance parser in typescript',
        researcher: 'search recent breakthroughs in artificial intelligence',
        designer: 'design a modern holographic dashboard layout',
        scheduler: 'schedule a team sync meeting tomorrow'
      };
      const query = samplePrompts[key];
      terminal.appendLine(`[user] ${query}`, 'user-line');
      delegation.delegate(key, query);
    });
  }
});

// Continuous Voice Commander & Wake Word Support
const wakewordToggleBtn = document.getElementById('wakeword-toggle-btn');
const wakewordToggleText = document.getElementById('wakeword-toggle-text');

const voiceCommander = new VoiceCommander({
  onCommand: (state, word) => {
    setState(state, `VOICE COMMAND: ${word.toUpperCase()}`);
    terminal.appendLine(`[voice] command recognized: "${word}" -> state: ${state}`, 'ok-line');
  },
  onSpeechHeard: (transcript) => {
    if (voiceHeardLabel) {
      voiceHeardLabel.classList.remove('hidden');
      voiceHeardLabel.innerHTML = `<span class="chip-dot glow-cyan"></span>HEARD: "${transcript.slice(0, 24)}"`;
    }
  },
  onQuery: (command) => {
    const memCmd = memory.parseCommand(command);
    if (memCmd) {
      terminal.appendLine(`[user] ${command}`, 'user-line');
      memory.addConversationMessage('user', command);
      handleMemoryCommand(memCmd, command);
      return;
    }

    const agentType = detectDelegationType(command);
    if (agentType) {
      terminal.appendLine(`[user] ${command}`, 'user-line');
      memory.addConversationMessage('user', command);
      delegation.delegate(agentType, command);
      return;
    }

    assistant.processQuestion(command);
  },
  onStatusChange: (isActive) => {
    if (voiceCmdBtn && voiceCmdText) {
      voiceCmdBtn.classList.toggle('active', isActive);
      voiceCmdText.textContent = isActive ? 'VOICE: ON' : 'VOICE: OFF';
    }
    if (isActive) {
      terminal.appendLine('[ok] continuous voice listening activated', 'ok-line');
    } else {
      terminal.appendLine('[ok] continuous voice listening stopped', 'ok-line');
      if (voiceHeardLabel) voiceHeardLabel.classList.add('hidden');
    }
  },
  onUnsupported: () => {
    terminal.appendLine('[warn] Web Speech API not supported in this browser', 'warn-line');
  },
  isSpeakingChecker: () => (assistant && assistant.isSpeaking) || (robotVoice && robotVoice.isSpeaking)
});

if (voiceCmdBtn) {
  voiceCmdBtn.addEventListener('click', () => {
    voiceCommander.toggle();
  });
}

// 4. Wake Word Toggle Button: "WAKE WORD: ON/OFF", off by default
if (wakewordToggleBtn) {
  wakewordToggleBtn.addEventListener('click', () => {
    const isEnabled = voiceCommander.toggleWakeWord();
    wakewordToggleBtn.classList.toggle('active', isEnabled);
    if (wakewordToggleText) {
      wakewordToggleText.textContent = isEnabled ? 'WAKE WORD: ON' : 'WAKE WORD: OFF';
    }
    terminal.appendLine(
      isEnabled ? '[ok] wake word required: ON ("hey puppet" / "ہے پپٹ")' : '[ok] wake word required: OFF',
      'ok-line'
    );
  });
}

// Interactive Terminal Command Input (Text Commands)
const terminalCmdInput = document.getElementById('terminal-cmd-input');
if (terminalCmdInput) {
  terminalCmdInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const rawText = terminalCmdInput.value.trim();
      if (!rawText) return;
      terminalCmdInput.value = '';

      // Check if command contains wake word (strip if present)
      const wakeCheck = checkWakeWord(rawText, voiceCommander.wakeWordEnabled);
      const effectiveText = wakeCheck.hasWakeWord ? wakeCheck.command : rawText;

      const memCmd = memory.parseCommand(effectiveText);
      if (memCmd) {
        terminal.appendLine(`[user] ${rawText}`, 'user-line');
        memory.addConversationMessage('user', rawText);
        handleMemoryCommand(memCmd, effectiveText);
        return;
      }

      const agentType = detectDelegationType(effectiveText);
      if (agentType) {
        terminal.appendLine(`[user] ${rawText}`, 'user-line');
        memory.addConversationMessage('user', rawText);
        delegation.delegate(agentType, effectiveText);
        return;
      }

      assistant.processQuestion(effectiveText);
    }
  });
}

// 4. Clear Memory Button (Header Action)
if (clearMemoryBtn) {
  clearMemoryBtn.addEventListener('click', () => {
    const isConfirmed = window.confirm('Are you sure you want to clear all memory, notes, tasks, and conversation history?');
    if (isConfirmed) {
      memory.clearEverything();
      terminal.appendLine('[ok] memory wiped: notes, user name, and conversation history cleared.', 'ok-line');
      const speech = assistant.currentLang === 'ur'
        ? 'تمام میموری صاف کر دی گئی ہے۔ میں سب کچھ بھول گیا ہوں۔'
        : (assistant.currentLang === 'ps' ? 'ټوله حافظه پاکه شوه. زه هرڅه هیر کړم.' : 'Memory cleared. I have forgotten everything.');
      assistant.speakAnswer(speech);
    }
  });
}

// 3. Task List Panel Interactions
function handleQuickAddTask() {
  if (!taskQuickInput) return;
  const val = taskQuickInput.value.trim();
  if (!val) return;
  taskQuickInput.value = '';

  const task = memory.addTask(val);
  terminal.appendLine(`[task] added task #${task.number}: "${task.text}"`, 'ok-line');
  const speech = assistant.currentLang === 'ur'
    ? `ٹاسک شامل کر دیا گیا: ${task.text}`
    : (assistant.currentLang === 'ps' ? `دنده ورزیاته شوه: ${task.text}` : `Added task: ${task.text}`);
  assistant.speakAnswer(speech);
}

if (taskQuickAddBtn) {
  taskQuickAddBtn.addEventListener('click', handleQuickAddTask);
}

if (taskQuickInput) {
  taskQuickInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleQuickAddTask();
    }
  });
}

// Read All Tasks Button
if (taskReadAllBtn) {
  taskReadAllBtn.addEventListener('click', async () => {
    const result = await memory.executeCommand({ type: 'LIST_TASKS' }, assistant.currentLang);
    if (result) {
      if (result.terminal) {
        terminal.appendLine(result.terminal, result.terminalType || 'ok-line');
      }
      if (result.speech) {
        assistant.speakAnswer(result.speech);
      }
    }
  });
}

// Clear All Tasks Button
if (taskClearAllBtn) {
  taskClearAllBtn.addEventListener('click', () => {
    const tasks = memory.getTasks();
    if (tasks.length === 0) return;
    if (window.confirm('Clear all tasks?')) {
      memory.clearTasks();
      terminal.appendLine('[task] all tasks cleared.', 'warn-line');
    }
  });
}

// Task items interactive toggle and delete
if (tasksListContainer) {
  tasksListContainer.addEventListener('click', (e) => {
    const target = e.target;
    const card = target.closest('.task-item-card');
    if (!card) return;
    const taskId = card.getAttribute('data-task-id');
    if (!taskId) return;

    if (target.classList.contains('task-item-checkbox') || target.type === 'checkbox') {
      const task = memory.toggleTask(taskId);
      if (task) {
        const mark = task.completed ? 'completed' : 'pending';
        terminal.appendLine(`[task] task #${task.number} marked ${mark}: "${task.text}"`, task.completed ? 'ok-line' : 'warn-line');
      }
    } else if (target.classList.contains('task-item-del-btn')) {
      memory.deleteTask(taskId);
      terminal.appendLine(`[task] task removed from list.`, 'warn-line');
    }
  });
}

// Mic button click interaction
if (assistantMicBtn) {
  assistantMicBtn.addEventListener('click', () => {
    if (assistant.isSpeaking) return;
    if (assistant.isListening) {
      assistant.stopListening();
    } else {
      if (voiceCommander && voiceCommander.isActive) {
        voiceCommander.stop();
      }
      assistant.startListening();
    }
  });
}

// Multi-Language Switcher (EN, Urdu, Pashto) & Top Bar Language Display
const langBtns = document.querySelectorAll('.assistant-lang-switcher .lang-btn');
const topLangVal = document.getElementById('top-lang-val');

function updateTopLanguageBadge(currentLang) {
  if (!topLangVal) return;
  if (currentLang === 'ur') {
    topLangVal.textContent = 'اردو (UR)';
  } else if (currentLang === 'ps') {
    topLangVal.textContent = 'پښتو (PS)';
  } else {
    topLangVal.textContent = 'EN';
  }
}

function updateLangUI(currentLang) {
  langBtns.forEach(btn => {
    const btnLang = btn.getAttribute('data-lang');
    btn.classList.toggle('active', btnLang === currentLang);
  });
  updateTopLanguageBadge(currentLang);
}

langBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const lang = btn.getAttribute('data-lang');
    if (lang) {
      assistant.setLanguage(lang);
      updateLangUI(assistant.currentLang);
    }
  });
});

// Sync initial UI from persisted assistant language
updateLangUI(assistant.currentLang);

// 1-8. API KEYS Modal Panel & Provider Settings Controller
const settingsToggleBtn = document.getElementById('settings-toggle-btn');
const settingsModal = document.getElementById('settings-modal');
const settingsCloseBtn = document.getElementById('settings-close-btn');
const settingsSaveBtn = document.getElementById('settings-save-btn');
const settingsClearAllBtn = document.getElementById('settings-clear-all-btn');
const settingsProviderSelect = document.getElementById('settings-provider-select');
const firstLaunchBanner = document.getElementById('first-launch-banner');

const hqListeningToggleBtn = document.getElementById('hq-listening-toggle-btn');
const hqListeningText = document.getElementById('hq-listening-text');
const micHqTogglePill = document.getElementById('mic-hq-toggle-pill');

const keyInputs = {
  groq: document.getElementById('key-input-groq'),
  gemini: document.getElementById('key-input-gemini'),
  openai: document.getElementById('key-input-openai')
};

const keyVisBtns = {
  groq: document.getElementById('toggle-vis-groq'),
  gemini: document.getElementById('toggle-vis-gemini'),
  openai: document.getElementById('toggle-vis-openai')
};

const keyTestBtns = {
  groq: document.getElementById('test-btn-groq'),
  gemini: document.getElementById('test-btn-gemini'),
  openai: document.getElementById('test-btn-openai')
};

const keyStatusDots = {
  groq: document.getElementById('status-dot-groq'),
  gemini: document.getElementById('status-dot-gemini'),
  openai: document.getElementById('status-dot-openai')
};

const keyStatusMsgs = {
  groq: document.getElementById('status-msg-groq'),
  gemini: document.getElementById('status-msg-gemini'),
  openai: document.getElementById('status-msg-openai')
};

// Update status dot and message for an API key field
function setFieldStatus(provider, state, msg) {
  const dot = keyStatusDots[provider];
  const msgEl = keyStatusMsgs[provider];
  if (!dot || !msgEl) return;

  dot.className = 'status-dot';
  msgEl.className = 'status-msg';

  if (state === 'green') {
    dot.classList.add('dot-green');
    msgEl.classList.add('tested-ok');
    msgEl.textContent = msg || 'Tested OK';
  } else if (state === 'red') {
    dot.classList.add('dot-red');
    msgEl.classList.add('failed');
    msgEl.textContent = msg || 'Failed';
  } else {
    // grey
    dot.classList.add('dot-grey');
    msgEl.textContent = msg || 'Empty';
  }
}

// Populate the inputs from localStorage ('puppet_keys') or fallback
function populateKeysForm() {
  const saved = getSavedPuppetKeys();
  const activeKeys = getApiKeys();

  ['groq', 'gemini', 'openai'].forEach(p => {
    const input = keyInputs[p];
    if (input) {
      const val = saved[p] || activeKeys[p] || '';
      input.value = val;
      if (!val) {
        setFieldStatus(p, 'grey', 'Empty');
      } else {
        setFieldStatus(p, 'grey', 'Configured');
      }
    }
  });

  if (settingsProviderSelect) {
    settingsProviderSelect.value = assistant.preferredProvider || 'auto';
  }
}

// Wire show/hide eye toggle buttons
['groq', 'gemini', 'openai'].forEach(p => {
  const btn = keyVisBtns[p];
  const input = keyInputs[p];
  if (btn && input) {
    btn.addEventListener('click', () => {
      const isPass = input.type === 'password';
      input.type = isPass ? 'text' : 'password';
      btn.textContent = isPass ? '🙈' : '👁️';
    });
  }

  if (input) {
    input.addEventListener('input', () => {
      if (!input.value.trim()) {
        setFieldStatus(p, 'grey', 'Empty');
      } else {
        setFieldStatus(p, 'grey', 'Untested');
      }
    });
  }
});

// Wire TEST buttons next to each field
['groq', 'gemini', 'openai'].forEach(p => {
  const btn = keyTestBtns[p];
  const input = keyInputs[p];
  if (btn && input) {
    btn.addEventListener('click', async () => {
      const val = input.value.trim();
      if (!val) {
        setFieldStatus(p, 'grey', 'Empty');
        return;
      }
      const prevText = btn.textContent;
      btn.disabled = true;
      btn.textContent = '...';
      try {
        const result = await testApiKey(p, val);
        if (result.ok) {
          setFieldStatus(p, 'green', result.message || 'Tested OK');
        } else {
          setFieldStatus(p, 'red', result.message || 'Failed');
        }
      } catch (err) {
        setFieldStatus(p, 'red', 'Network error');
      } finally {
        btn.disabled = false;
        btn.textContent = prevText;
      }
    });
  }
});

// Sync HQ Listening UI state
function updateHqUi(isHq) {
  if (hqListeningToggleBtn) {
    hqListeningToggleBtn.classList.toggle('active', Boolean(isHq));
  }
  if (hqListeningText) {
    hqListeningText.textContent = isHq ? 'HQ MIC: ON' : 'HQ MIC: OFF';
  }
  if (micHqTogglePill) {
    micHqTogglePill.classList.toggle('active', Boolean(isHq));
  }
}

function toggleHqListening() {
  const keys = getApiKeys();
  const nextState = !assistant.isHqListening;
  if (nextState && !keys.groq) {
    terminal.appendLine('[warn] VITE_GROQ_KEY required for HQ Listening (Whisper)', 'warn-line');
  }
  assistant.setHqListening(nextState);
  updateHqUi(assistant.isHqListening);
  terminal.appendLine(
    assistant.isHqListening ? '[ok] HQ Listening enabled (Groq Whisper Large v3)' : '[ok] HQ Listening disabled (Web Speech API)',
    'ok-line'
  );
}

// 3. SAVE button: saves keys to localStorage under 'puppet_keys', never prints keys in terminal
if (settingsSaveBtn) {
  settingsSaveBtn.addEventListener('click', () => {
    const keysToSave = {
      groq: keyInputs.groq ? keyInputs.groq.value.trim() : '',
      gemini: keyInputs.gemini ? keyInputs.gemini.value.trim() : '',
      openai: keyInputs.openai ? keyInputs.openai.value.trim() : ''
    };
    savePuppetKeys(keysToSave);

    if (settingsProviderSelect) {
      assistant.setPreferredProvider(settingsProviderSelect.value);
    }

    terminal.appendLine('[ok] keys saved', 'ok-line');

    // 6. Update badge right after saving keys, without reloading the page
    updateModeBadges();

    if (settingsModal) {
      settingsModal.classList.add('hidden');
    }
  });
}

// 3. CLEAR ALL button: removes all keys after a confirmation prompt
if (settingsClearAllBtn) {
  settingsClearAllBtn.addEventListener('click', () => {
    if (window.confirm('Clear all stored API keys?')) {
      clearPuppetKeys();
      ['groq', 'gemini', 'openai'].forEach(p => {
        if (keyInputs[p]) keyInputs[p].value = '';
        setFieldStatus(p, 'grey', 'Empty');
      });
      updateModeBadges();
      terminal.appendLine('[ok] keys cleared', 'ok-line');
    }
  });
}

// Tabs Navigation in Settings Modal
const settingsTabBtns = document.querySelectorAll('.settings-tab-btn');
const settingsTabPanes = document.querySelectorAll('.settings-tab-pane');

settingsTabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.getAttribute('data-tab');
    settingsTabBtns.forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    settingsTabPanes.forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    const pane = document.getElementById(targetId);
    if (pane) pane.classList.add('active');
  });
});

// Sync current application state into Settings modal controls
function populateSettingsState() {
  // 1. Voice Language buttons
  const lang = assistant.currentLang || 'en';
  ['en', 'ur', 'ps'].forEach(l => {
    const btn = document.getElementById(`settings-lang-${l}`);
    if (btn) btn.classList.toggle('active', l === lang);
  });

  // 2. Sound Output toggle
  const soundBtn = document.getElementById('settings-toggle-sound');
  if (soundBtn) {
    const isSound = Boolean(robotVoice && robotVoice.enabled);
    soundBtn.textContent = isSound ? 'SOUND: ON' : 'SOUND: OFF';
    soundBtn.classList.toggle('active', isSound);
  }

  // 3. HQ Mic toggle
  const hqBtn = document.getElementById('settings-toggle-hq');
  if (hqBtn) {
    const isHq = Boolean(assistant && assistant.isHqListening);
    hqBtn.textContent = isHq ? 'HQ MIC: ON' : 'HQ MIC: OFF';
    hqBtn.classList.toggle('active', isHq);
  }

  // 4. Continuous Voice toggle
  const voiceCmdBtnSettings = document.getElementById('settings-toggle-voicecmd');
  if (voiceCmdBtnSettings) {
    const isVoice = Boolean(voiceCommander && voiceCommander.isActive);
    voiceCmdBtnSettings.textContent = isVoice ? 'VOICE: ON' : 'VOICE: OFF';
    voiceCmdBtnSettings.classList.toggle('active', isVoice);
  }

  // 5. Wake Word toggle
  const wakewordBtnSettings = document.getElementById('settings-toggle-wakeword');
  if (wakewordBtnSettings) {
    const isWake = Boolean(voiceCommander && voiceCommander.wakeWordEnabled);
    wakewordBtnSettings.textContent = isWake ? 'WAKE WORD: ON' : 'WAKE WORD: OFF';
    wakewordBtnSettings.classList.toggle('active', isWake);
  }

  // 6. Camera toggle
  const camBtn = document.getElementById('settings-toggle-camera');
  if (camBtn) {
    const isCam = Boolean(tracker && tracker.isCameraActive);
    camBtn.textContent = isCam ? 'STOP CAMERA' : 'START CAMERA';
    camBtn.classList.toggle('active', isCam);
  }

  // 7. Simulator toggle
  const simBtn = document.getElementById('settings-toggle-sim');
  if (simBtn) {
    const isSimOpen = Boolean(simDrawer && !simDrawer.classList.contains('hidden'));
    simBtn.textContent = isSimOpen ? 'DRAWER: OPEN' : 'SIMULATOR';
    simBtn.classList.toggle('active', isSimOpen);
  }

  // 8. Reel toggle
  const reelBtn = document.getElementById('settings-toggle-reel');
  if (reelBtn) {
    const isReel = Boolean(appContainer && appContainer.classList.contains('reel-mode'));
    reelBtn.textContent = isReel ? 'REEL: ACTIVE' : '9:16 REEL';
    reelBtn.classList.toggle('active', isReel);
  }

  // 9. Fullscreen toggle
  const fullBtn = document.getElementById('settings-toggle-fullscreen');
  if (fullBtn) {
    const isFull = Boolean(document.fullscreenElement);
    fullBtn.textContent = isFull ? 'EXIT FULLSCREEN' : 'FULLSCREEN';
    fullBtn.classList.toggle('active', isFull);
  }

  // 10. Memory stats
  const notesCountEl = document.getElementById('settings-memory-notes-count');
  if (notesCountEl) notesCountEl.textContent = String(memory.getNotes().length);

  const tasksCountEl = document.getElementById('settings-memory-tasks-count');
  if (tasksCountEl) tasksCountEl.textContent = String(memory.getTasks().length);
}

// Wire Settings modal controls for Voice, Vision, and Memory
['en', 'ur', 'ps'].forEach(l => {
  const btn = document.getElementById(`settings-lang-${l}`);
  if (btn) {
    btn.addEventListener('click', () => {
      assistant.setLanguage(l);
      updateLangUI(l);
      populateSettingsState();
      terminal.appendLine(`[ok] assistant language changed to: ${l.toUpperCase()}`, 'ok-line');
    });
  }
});

const settingsToggleSound = document.getElementById('settings-toggle-sound');
if (settingsToggleSound) {
  settingsToggleSound.addEventListener('click', () => {
    const isEnabled = robotVoice.toggle();
    sound.enabled = isEnabled;
    soundToggleBtn.innerHTML = `<span class="btn-icon">${isEnabled ? '🔊' : '🔇'}</span>`;
    soundToggleBtn.title = isEnabled ? 'Voice output: ON' : 'Voice output: OFF (Click to enable)';
    populateSettingsState();
    terminal.appendLine(`[ok] voice sound output: ${isEnabled ? 'ON' : 'OFF'}`, 'ok-line');
  });
}

const settingsToggleHq = document.getElementById('settings-toggle-hq');
if (settingsToggleHq) {
  settingsToggleHq.addEventListener('click', () => {
    toggleHqListening();
    populateSettingsState();
  });
}

const settingsToggleVoiceCmd = document.getElementById('settings-toggle-voicecmd');
if (settingsToggleVoiceCmd) {
  settingsToggleVoiceCmd.addEventListener('click', () => {
    voiceCommander.toggle();
    populateSettingsState();
  });
}

const settingsToggleWakeWord = document.getElementById('settings-toggle-wakeword');
if (settingsToggleWakeWord) {
  settingsToggleWakeWord.addEventListener('click', () => {
    const isEnabled = voiceCommander.toggleWakeWord();
    if (wakewordToggleBtn) wakewordToggleBtn.classList.toggle('active', isEnabled);
    if (wakewordToggleText) wakewordToggleText.textContent = isEnabled ? 'WAKE WORD: ON' : 'WAKE WORD: OFF';
    populateSettingsState();
    terminal.appendLine(
      isEnabled ? '[ok] wake word required: ON ("hey puppet" / "ہے پپٹ")' : '[ok] wake word required: OFF',
      'ok-line'
    );
  });
}

const settingsToggleCam = document.getElementById('settings-toggle-camera');
if (settingsToggleCam) {
  settingsToggleCam.addEventListener('click', async () => {
    await toggleCamera();
    populateSettingsState();
  });
}

const settingsToggleSim = document.getElementById('settings-toggle-sim');
if (settingsToggleSim) {
  settingsToggleSim.addEventListener('click', () => {
    if (simDrawer) simDrawer.classList.toggle('hidden');
    populateSettingsState();
  });
}

const settingsToggleReel = document.getElementById('settings-toggle-reel');
if (settingsToggleReel) {
  settingsToggleReel.addEventListener('click', () => {
    toggleReelMode();
    populateSettingsState();
  });
}

const settingsToggleFullscreen = document.getElementById('settings-toggle-fullscreen');
if (settingsToggleFullscreen) {
  settingsToggleFullscreen.addEventListener('click', () => {
    toggleFullscreen();
    setTimeout(populateSettingsState, 150);
  });
}

const settingsClearMemoryBtn = document.getElementById('settings-clear-memory-btn');
if (settingsClearMemoryBtn) {
  settingsClearMemoryBtn.addEventListener('click', () => {
    if (window.confirm('Are you sure you want to clear all memory, notes, and conversation history?')) {
      memory.clearEverything();
      populateSettingsState();
      terminal.appendLine('[ok] memory wiped: notes, user name, and conversation history cleared.', 'ok-line');
    }
  });
}

const settingsClearTasksBtn = document.getElementById('settings-clear-tasks-btn');
if (settingsClearTasksBtn) {
  settingsClearTasksBtn.addEventListener('click', () => {
    if (window.confirm('Clear all tasks from the checklist?')) {
      memory.clearTasks();
      populateSettingsState();
      terminal.appendLine('[task] all tasks cleared.', 'warn-line');
    }
  });
}

// Open modal via settings button
if (settingsToggleBtn && settingsModal) {
  settingsToggleBtn.addEventListener('click', () => {
    if (firstLaunchBanner) {
      firstLaunchBanner.classList.add('hidden');
    }
    populateKeysForm();
    populateSettingsState();
    settingsModal.classList.remove('hidden');
  });
}

// Close modal via X button
if (settingsCloseBtn && settingsModal) {
  settingsCloseBtn.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
  });
}

// Close modal via outside click
if (settingsModal) {
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      settingsModal.classList.add('hidden');
    }
  });
}

// Close modal via ESC key
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && settingsModal && !settingsModal.classList.contains('hidden')) {
    settingsModal.classList.add('hidden');
  }
});

// Keyboard shortcut: Press S to toggle Settings Modal (when not typing in an input)
window.addEventListener('keydown', (e) => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) {
    return;
  }
  if (e.key === 's' || e.key === 'S') {
    e.preventDefault();
    if (settingsModal.classList.contains('hidden')) {
      if (firstLaunchBanner) firstLaunchBanner.classList.add('hidden');
      populateKeysForm();
      populateSettingsState();
      settingsModal.classList.remove('hidden');
    } else {
      settingsModal.classList.add('hidden');
    }
  }
});

// Preferred Provider change listener
if (settingsProviderSelect) {
  settingsProviderSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    assistant.setPreferredProvider(val);
    updateModeBadges();
  });
}

// Header & Mic Dock HQ toggle buttons
if (hqListeningToggleBtn) {
  hqListeningToggleBtn.addEventListener('click', toggleHqListening);
}
if (micHqTogglePill) {
  micHqTogglePill.addEventListener('click', toggleHqListening);
}
updateHqUi(assistant.isHqListening);

// 8. First launch: if no keys exist, open the panel automatically once
const initialKeys = getApiKeys();
const hasAnyKeys = Boolean(initialKeys.groq || initialKeys.gemini || initialKeys.openai);
const hasSeenFirstLaunch = typeof localStorage !== 'undefined' && localStorage.getItem('puppet_keys_first_launch_seen');

if (!hasAnyKeys && !hasSeenFirstLaunch) {
  if (firstLaunchBanner) {
    firstLaunchBanner.classList.remove('hidden');
  }
  populateKeysForm();
  if (settingsModal) {
    settingsModal.classList.remove('hidden');
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('puppet_keys_first_launch_seen', 'true');
  }
}

// Live Clock with Date (Top Bar)
const liveClockTime = document.getElementById('live-clock-time');
const liveClockDate = document.getElementById('live-clock-date');

function updateLiveClock() {
  const now = new Date();
  const timeStr = [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ].join(':');

  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const dateStr = `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;

  if (liveClockTime) liveClockTime.textContent = timeStr;
  if (liveClockDate) liveClockDate.textContent = dateStr;
}
updateLiveClock();
setInterval(updateLiveClock, 1000);

// Left Panel: "WORLD MONITOR" (Sample Data, 6 headlines rotating every 8s)
const SAMPLE_HEADLINES = [
  { tag: 'TECH', title: 'Neural quantum coprocessors demonstrate sub-millisecond AST compilation', time: '1m ago' },
  { tag: 'WORLD', title: 'Global satellite mesh network reaches 99.999% orbital synchronicity', time: '3m ago' },
  { tag: 'SCIENCE', title: 'Autonomous synthetic biology swarm completes ribosome folding benchmark', time: '6m ago' },
  { tag: 'TECH', title: 'Edge WebAssembly kernels replace traditional container runtimes in production', time: '9m ago' },
  { tag: 'SCIENCE', title: 'Deep space neutrino array registers anomalous gamma-ray correlation', time: '12m ago' },
  { tag: 'WORLD', title: 'Smart grid autonomous load balancer mitigates continental peak surge', time: '15m ago' },
  { tag: 'TECH', title: 'Zero-knowledge cryptographic handshake standard adopted by agent swarms', time: '18m ago' },
  { tag: 'SCIENCE', title: 'Cryogenic qubit coherence surpasses 12-minute operational threshold', time: '21m ago' },
  { tag: 'WORLD', title: 'Automated maritime routing corridors go live across Indo-Pacific', time: '24m ago' },
  { tag: 'TECH', title: 'Self-assembling graphene transistors clock 420 GHz in laboratory trials', time: '27m ago' },
  { tag: 'SCIENCE', title: 'Magnetic fusion plasma confinement stabilized with temporal transformer', time: '30m ago' },
  { tag: 'TECH', title: 'Multi-modal latent stream protocol accepted by web standards consortium', time: '33m ago' },
  { tag: 'WORLD', title: 'Geothermal energy storage megaproject delivers 50 GWh base capacity', time: '36m ago' },
  { tag: 'SCIENCE', title: 'High-temperature superconductor synthesized in ambient atmospheric rig', time: '39m ago' },
  { tag: 'TECH', title: 'Distributed graph database executes billion-edge traversal in 4.2ms', time: '42m ago' },
  { tag: 'WORLD', title: 'Global seismological sensor grid models mantle convection in real time', time: '45m ago' },
  { tag: 'TECH', title: 'Autonomous code refactoring agents eliminate 94% of legacy memory leaks', time: '48m ago' },
  { tag: 'SCIENCE', title: 'Nanophotonic optical switch reduces silicon interconnect latency to 0.1ps', time: '51m ago' },
  { tag: 'WORLD', title: 'Automated atmospheric carbon capture array exceeds milestone quotas', time: '54m ago' },
  { tag: 'TECH', title: 'Neuromorphic sensory chip models dynamic human proprioception in 3D', time: '58m ago' }
];

const worldHeadlinesList = document.getElementById('world-headlines-list');
let headlinePoolIndex = 6;

function createHeadlineElement(item, isNew = false) {
  const li = document.createElement('li');
  li.className = `headline-item${isNew ? ' new-rotation' : ''}`;
  const tagClass = item.tag === 'TECH' ? 'tag-tech' : item.tag === 'WORLD' ? 'tag-world' : 'tag-science';
  li.innerHTML = `
    <div class="headline-meta">
      <span class="headline-tag ${tagClass}">${item.tag}</span>
      <span class="headline-time">${item.time}</span>
    </div>
    <div class="headline-title">${item.title}</div>
  `;
  return li;
}

if (worldHeadlinesList) {
  worldHeadlinesList.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    worldHeadlinesList.appendChild(createHeadlineElement(SAMPLE_HEADLINES[i], false));
  }

  // Rotate one new headline every 8 seconds
  setInterval(() => {
    const nextItem = SAMPLE_HEADLINES[headlinePoolIndex % SAMPLE_HEADLINES.length];
    headlinePoolIndex++;

    const newLi = createHeadlineElement(nextItem, true);
    worldHeadlinesList.insertBefore(newLi, worldHeadlinesList.firstChild);

    while (worldHeadlinesList.children.length > 6) {
      worldHeadlinesList.removeChild(worldHeadlinesList.lastChild);
    }

    setTimeout(() => {
      newLi.classList.remove('new-rotation');
    }, 1200);
  }, 8000);
}

// Right Panel: "SYSTEM STATUS" (Fake meters CPU, mem, net changing slowly)
const meterCpuVal = document.getElementById('meter-cpu-val');
const meterCpuBar = document.getElementById('meter-cpu-bar');
const meterCpuTemp = document.getElementById('meter-cpu-temp');

const meterMemVal = document.getElementById('meter-mem-val');
const meterMemBar = document.getElementById('meter-mem-bar');
const meterMemPct = document.getElementById('meter-mem-pct');

const meterNetVal = document.getElementById('meter-net-val');
const meterNetBar = document.getElementById('meter-net-bar');
const meterNetDetail = document.getElementById('meter-net-detail');

let cpuPercent = 38;
let memGb = 5.8;
let netSpeed = 482;

function updateSystemMeters() {
  const cpuDelta = (Math.random() - 0.48) * 8;
  cpuPercent = Math.min(68, Math.max(28, Math.round(cpuPercent + cpuDelta)));
  const temp = Math.round(41 + (cpuPercent / 100) * 16);
  if (meterCpuVal) meterCpuVal.textContent = `${cpuPercent}%`;
  if (meterCpuBar) meterCpuBar.style.width = `${cpuPercent}%`;
  if (meterCpuTemp) meterCpuTemp.textContent = `${temp}°C`;

  const memDelta = (Math.random() - 0.49) * 0.2;
  memGb = Math.min(6.8, Math.max(5.1, Number((memGb + memDelta).toFixed(1))));
  const memPct = ((memGb / 16) * 100).toFixed(1);
  if (meterMemVal) meterMemVal.textContent = `${memGb} GB / 16 GB`;
  if (meterMemBar) meterMemBar.style.width = `${memPct}%`;
  if (meterMemPct) meterMemPct.textContent = `${memPct}%`;

  const netDelta = (Math.random() - 0.5) * 70;
  netSpeed = Math.min(920, Math.max(240, Math.round(netSpeed + netDelta)));
  const upK = Math.round(netSpeed * 0.32);
  const downK = Math.round(netSpeed * 0.68);
  const netBarPct = Math.round((netSpeed / 1000) * 100);
  if (meterNetVal) meterNetVal.textContent = `${netSpeed} KB/s`;
  if (meterNetBar) meterNetBar.style.width = `${netBarPct}%`;
  if (meterNetDetail) meterNetDetail.textContent = `▲ ${upK}K ▼ ${downK}K`;
}
updateSystemMeters();
setInterval(updateSystemMeters, 2800);

// Collapsible Panels (Left, Right, Bottom Dock)
const panelWorld = document.getElementById('panel-world-monitor');
const toggleWorldBtn = document.getElementById('toggle-world-monitor');
if (toggleWorldBtn && panelWorld) {
  toggleWorldBtn.addEventListener('click', () => {
    panelWorld.classList.toggle('collapsed');
    window.dispatchEvent(new Event('resize'));
  });
}

const panelStatus = document.getElementById('panel-system-status');
const toggleStatusBtn = document.getElementById('toggle-system-status');
if (toggleStatusBtn && panelStatus) {
  toggleStatusBtn.addEventListener('click', () => {
    panelStatus.classList.toggle('collapsed');
    window.dispatchEvent(new Event('resize'));
  });
}

const cockpitDock = document.getElementById('cockpit-dock');
const toggleDockBtn = document.getElementById('toggle-dock-collapse');
if (toggleDockBtn && cockpitDock) {
  toggleDockBtn.addEventListener('click', () => {
    cockpitDock.classList.toggle('collapsed');
    window.dispatchEvent(new Event('resize'));
  });
}

// Voice Waveform Bars Initialization
const waveformBarsContainer = document.getElementById('waveform-bars');
const waveformBars = [];
if (waveformBarsContainer) {
  waveformBarsContainer.innerHTML = '';
  for (let i = 0; i < 28; i++) {
    const bar = document.createElement('div');
    bar.className = 'waveform-bar';
    waveformBarsContainer.appendChild(bar);
    waveformBars.push(bar);
  }
}

function updateWaveformVisualizer(currentTime) {
  if (!waveformBars.length) return;
  const isListening = (assistant && assistant.isListening) || (voiceCommander && voiceCommander.isActive);
  const isSpeaking = (assistant && assistant.isSpeaking) || (robotVoice && robotVoice.isSpeaking);

  const container = document.getElementById('voice-waveform-container');
  const statusText = document.getElementById('waveform-status-text');

  if (isListening) {
    if (container) {
      container.classList.add('listening');
      container.classList.remove('speaking');
    }
    if (statusText && statusText.textContent !== 'AUDIO INPUT // LISTENING...') {
      statusText.textContent = 'AUDIO INPUT // LISTENING...';
    }
    waveformBars.forEach((bar, idx) => {
      const wave = Math.sin(currentTime * 0.015 + idx * 0.45) * 0.5 + 0.5;
      const noise = (Math.sin(currentTime * 0.03 + idx * 1.2) * 0.5 + 0.5) * 0.4;
      const h = Math.round(6 + (wave + noise) * 22);
      bar.style.height = `${h}px`;
    });
  } else if (isSpeaking) {
    if (container) {
      container.classList.add('speaking');
      container.classList.remove('listening');
    }
    if (statusText && statusText.textContent !== 'VOICE SYNTHESIS // ACTIVE') {
      statusText.textContent = 'VOICE SYNTHESIS // ACTIVE';
    }
    waveformBars.forEach((bar, idx) => {
      const wave = Math.cos(currentTime * 0.02 + idx * 0.35) * 0.5 + 0.5;
      const jitter = Math.sin(currentTime * 0.05 + idx * 2.1) * 0.35;
      const h = Math.round(7 + Math.max(0, wave + jitter) * 23);
      bar.style.height = `${h}px`;
    });
  } else {
    if (container && (container.classList.contains('listening') || container.classList.contains('speaking'))) {
      container.classList.remove('listening', 'speaking');
    }
    if (statusText && statusText.textContent !== 'AUDIO SPECTRUM // STANDBY') {
      statusText.textContent = 'AUDIO SPECTRUM // STANDBY';
    }
    waveformBars.forEach((bar, idx) => {
      const resting = Math.sin(currentTime * 0.002 + idx * 0.25) * 1.5 + 4;
      bar.style.height = `${Math.round(resting)}px`;
    });
  }
}

// Camera Activation Flow
async function toggleCamera() {
  if (tracker.isCameraActive) {
    tracker.stopCamera();
    setCameraUI(false);
  } else {
    try {
      cameraToggleBtn.innerHTML = `<span class="btn-icon">⏳</span><span class="btn-text">STARTING...</span>`;
      if (camPromptOverlay) {
        camPromptOverlay.classList.add('hidden');
        camPromptOverlay.style.display = 'none';
      }
      await tracker.startCamera();
      setCameraUI(true);
    } catch (err) {
      console.warn('Camera startup warning:', err);
      if (tracker.isCameraActive || (tracker.video.srcObject && !tracker.video.paused)) {
        setCameraUI(true);
      } else {
        alert('Could not access camera: ' + (err.message || 'Permission denied or no webcam found. Simulator mode will remain active.'));
        setCameraUI(false);
      }
    }
  }
}

cameraToggleBtn.addEventListener('click', toggleCamera);
if (camActivateDirectBtn) {
  camActivateDirectBtn.addEventListener('click', toggleCamera);
}

// Simulator Drawer & Buttons
if (simToggleBtn) {
  simToggleBtn.addEventListener('click', () => {
    if (simDrawer) simDrawer.classList.toggle('hidden');
  });
}

const simCloseBtn = document.getElementById('sim-close-btn');
if (simCloseBtn) {
  simCloseBtn.addEventListener('click', () => {
    if (simDrawer) simDrawer.classList.add('hidden');
  });
}

simButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const gesture = btn.getAttribute('data-gesture');
    tracker.setSimulatedGesture(gesture);
  });
});

// Sound & Voice Output Toggle (starts OFF until user clicks it)
sound.enabled = false;
soundToggleBtn.innerHTML = `<span class="btn-icon">🔇</span>`;
soundToggleBtn.title = 'Voice output: OFF (Click to enable)';

soundToggleBtn.addEventListener('click', () => {
  const isEnabled = robotVoice.toggle();
  sound.enabled = isEnabled;
  soundToggleBtn.innerHTML = `<span class="btn-icon">${isEnabled ? '🔊' : '🔇'}</span>`;
  soundToggleBtn.title = isEnabled ? 'Voice output: ON' : 'Voice output: OFF (Click to enable)';
  if (isEnabled) {
    const greeting = memory.getStartupGreeting(assistant.currentLang);
    if (greeting && !soundToggleBtn._hasGreeted) {
      soundToggleBtn._hasGreeted = true;
      robotVoice.speak(greeting);
    }
  }
});

// Clear Terminal
if (clearTermBtn) {
  clearTermBtn.addEventListener('click', () => {
    terminal.clear();
  });
}

// Keyboard Shortcuts: SPACE for Voice Assistant, 1, 2, 3 for Instant Gesture Testing, 0 for No Hand, D for Debug, C for Cam, V for Voice
window.addEventListener('keydown', (e) => {
  // Ignore space if focused inside text inputs
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
    return;
  }

  // Hold SPACE to speak
  if (e.code === 'Space' || e.key === ' ') {
    e.preventDefault();
    if (!e.repeat) {
      if (!assistant.isSpeaking && !assistant.isListening) {
        if (voiceCommander && voiceCommander.isActive) {
          voiceCommander.stop();
        }
        assistant.startListening();
      }
    }
    return;
  }

  if (e.key === '1') {
    tracker.setSimulatedGesture('OPEN_HAND');
  } else if (e.key === '2') {
    tracker.setSimulatedGesture('INDEX_UP');
  } else if (e.key === '3') {
    tracker.setSimulatedGesture('FIST');
  } else if (e.key === '0') {
    tracker.setSimulatedGesture('NO_HAND');
  } else if (e.key === 'c' || e.key === 'C') {
    toggleCamera();
  } else if (e.key === 'd' || e.key === 'D') {
    toggleDebugLabel();
  } else if (e.key === 'f' || e.key === 'F') {
    toggleFullscreen();
  } else if (e.key === 'r' || e.key === 'R') {
    toggleReelMode();
  } else if (e.key === 'v' || e.key === 'V') {
    voiceCommander.toggle();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
    return;
  }

  if (e.code === 'Space' || e.key === ' ') {
    e.preventDefault();
    if (assistant.isListening) {
      assistant.stopListening();
    }
  }
});

// Main Animation & Render Loop
let lastTime = performance.now();
let frameCount = 0;
let lastFpsUpdate = performance.now();

function animate(currentTime) {
  requestAnimationFrame(animate);

  const delta = (currentTime - lastTime) / 1000;
  lastTime = currentTime;

  // FPS Counter
  frameCount++;
  if (currentTime - lastFpsUpdate >= 1000) {
    const fps = Math.round((frameCount * 1000) / (currentTime - lastFpsUpdate));
    if (fpsLabel) {
      fpsLabel.textContent = `${fps} FPS // LERP 0.08`;
    }
    frameCount = 0;
    lastFpsUpdate = currentTime;
  }

  // Waveform Spectrum Visualizer
  updateWaveformVisualizer(currentTime);

  // 1. Update Hand Tracking (runs detection if camera active, or simulated hand)
  tracker.update(currentTime);
  if (tracker.isCameraActive && camPromptOverlay && camPromptOverlay.style.display !== 'none') {
    setCameraUI(true);
  }

  // 2. Update Three.js Robot Poses & Render 3D Scene
  robot.update(delta);

  // 3. Update Fake Terminal Logs
  terminal.update(currentState, currentTime);

  // 4. Project Robot 3D Joints to 2D Screen Space
  const robotJoints = robot.getJointScreenPositions();

  // 5. Render Glowing Marionette Strings from Fingertips to Robot Joints
  const fingertips = tracker.fingertipsScreen;
  strings.render(fingertips, robotJoints, currentState, currentTime / 1000);
}

requestAnimationFrame(animate);
