import { RobotScene } from './robot.js';
import { RobotVoice } from './voice.js';
import {
  VoiceAssistant,
  getApiKeys,
  getSavedPuppetKeys,
  savePuppetKeys,
  clearPuppetKeys,
  testApiKey,
  AI_MODELS_CONFIG,
  getSavedSystemPrompt,
  saveSystemPrompt,
  resetSystemPrompt,
  DEFAULT_SYSTEM_PROMPT
} from './assistant.js';
import { MemoryManager } from './memory.js';

// ==========================================================================
// DOM Element References
// ==========================================================================

// Header & Navigation
const assistantModeBadge = document.getElementById('assistant-mode-badge');
const assistantModeText = document.getElementById('assistant-mode-text');
const assistantModeDot = document.getElementById('assistant-mode-dot');
const langButtons = document.querySelectorAll('.lang-switcher .lang-btn');
const soundToggleBtn = document.getElementById('sound-toggle-btn');
const settingsToggleBtn = document.getElementById('settings-toggle-btn');

// Avatar Center Stage
const robotContainer = document.getElementById('robot-container');
const avatarStatusBadge = document.getElementById('avatar-status-badge');
const avatarStatusText = document.getElementById('avatar-status-text');

// Voice Controls & Captions
const assistantMicBtn = document.getElementById('assistant-mic-btn');
const conversationToggleBtn = document.getElementById('conversation-toggle-btn');
const conversationToggleText = document.getElementById('conversation-toggle-text');
const liveCaptionBox = document.getElementById('live-caption-box');
const captionLabel = document.getElementById('caption-label');
const liveCaptionText = document.getElementById('live-caption-text');

// Chat History Panel
const chatHistoryCard = document.getElementById('chat-history-card');
const chatToggleHeader = document.getElementById('chat-toggle-header');
const chatCountTag = document.getElementById('chat-count-tag');
const clearChatBtn = document.getElementById('clear-chat-btn');
const chatMessagesList = document.getElementById('chat-messages-list');
const chatEmptyHint = document.getElementById('chat-empty-hint');

// Settings Modal Elements
const settingsModal = document.getElementById('settings-modal');
const settingsCloseBtn = document.getElementById('settings-close-btn');
const firstLaunchBanner = document.getElementById('first-launch-banner');
const settingsProviderSelect = document.getElementById('settings-provider-select');
const settingsSystemPrompt = document.getElementById('settings-system-prompt');
const resetSystemPromptBtn = document.getElementById('reset-system-prompt-btn');
const settingsSaveBtn = document.getElementById('settings-save-btn');
const settingsClearAllBtn = document.getElementById('settings-clear-all-btn');
const settingsMemoryCount = document.getElementById('settings-memory-count');
const settingsClearMemoryBtn = document.getElementById('settings-clear-memory-btn');

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

// ==========================================================================
// 1. Initialize 3D Robot Avatar Scene (4 states: READY, LISTENING, THINKING, SPEAKING)
// ==========================================================================
let robot = null;
if (robotContainer) {
  robot = new RobotScene(robotContainer);
  function renderLoop() {
    requestAnimationFrame(renderLoop);
    if (robot) {
      robot.animate();
    }
  }
  renderLoop();
}

function updateAvatarStateUI(state) {
  const cleanState = (state || 'READY').toUpperCase();

  // 1. Update 3D avatar
  if (robot) {
    robot.setState(cleanState);
  }

  // 2. Update status badge under robot
  if (avatarStatusBadge && avatarStatusText) {
    avatarStatusBadge.className = 'avatar-status-badge ' + cleanState.toLowerCase();
    avatarStatusText.textContent = cleanState;
  }

  // 3. Update mic button glowing pulse
  if (assistantMicBtn) {
    if (cleanState === 'LISTENING') {
      assistantMicBtn.classList.add('listening', 'active');
    } else {
      assistantMicBtn.classList.remove('listening', 'active');
    }
  }

  // 4. Update caption box state
  if (liveCaptionBox && captionLabel) {
    liveCaptionBox.className = 'live-caption-box ' + cleanState.toLowerCase();
    if (assistant && (assistant.currentLang === 'ur' || assistant.currentLang === 'ps')) {
      liveCaptionBox.classList.add('rtl-text');
    }
    captionLabel.textContent = cleanState;
  }
}

// ==========================================================================
// 2. Initialize Voice Assistant & Memory Manager
// ==========================================================================
const robotVoice = new RobotVoice(); // starts OFF (muted)
let totalChatMessages = 0;

// Conversation Mode State: Off by default, hands-free talk loop with 20s silence timeout
let isConversationMode = false;
let conversationSilenceTimer = null;

function clearConversationSilenceTimer() {
  if (conversationSilenceTimer) {
    clearTimeout(conversationSilenceTimer);
    conversationSilenceTimer = null;
  }
}

function startConversationSilenceTimer() {
  clearConversationSilenceTimer();
  conversationSilenceTimer = setTimeout(() => {
    // Stop automatically after 20 seconds of silence and show "Tap the mic to continue"
    clearConversationSilenceTimer();
    assistant.stopListening();
    updateAvatarStateUI('READY');
    if (captionLabel) captionLabel.textContent = 'READY';
    if (liveCaptionText) {
      liveCaptionText.textContent = 'Tap the mic to continue';
    }
  }, 20000);
}

const assistant = new VoiceAssistant({
  onStatus: (info) => {
    if (info.status === 'LISTENING...' && info.transcript) {
      clearConversationSilenceTimer();
    }
    if (liveCaptionText) {
      if (info.transcript) {
        liveCaptionText.textContent = info.transcript;
      } else if (info.status === 'READY') {
        const defaultHint = (assistant.currentLang === 'ur')
          ? 'اردو، پشتو، یا انگریزی میں بات کریں...'
          : ((assistant.currentLang === 'ps')
            ? 'په پښتو، اردو، یا انګریزي کې خبرې وکړئ...'
            : 'Click the mic or hold SPACE and speak...');
        liveCaptionText.textContent = defaultHint;
      }
    }
  },
  onStateChange: (robotState) => {
    updateAvatarStateUI(robotState);
  },
  onUserQuestion: (question) => {
    clearConversationSilenceTimer();
    appendChatMessage('user', question);
  },
  onAgentAnswer: (answer) => {
    if (liveCaptionText) {
      liveCaptionText.textContent = answer;
    }
    const provider = assistant.currentAnsweringProvider || (assistant.isAiMode ? 'ai' : 'builtin');
    appendChatMessage('assistant', answer, provider);
  },
  onSpeechEnd: () => {
    // 1. Conversation mode: when ON, after assistant finishes speaking, automatically start listening again
    if (isConversationMode) {
      setTimeout(() => {
        if (isConversationMode && !assistant.isSpeaking && !assistant.isListening) {
          assistant.startListening();
          startConversationSilenceTimer();
        }
      }, 350);
    }
  },
  onSilence: () => {
    if (isConversationMode && conversationSilenceTimer) {
      // In conversation mode within the 20s window, continue listening
      if (!assistant.isSpeaking && !assistant.isListening) {
        try {
          assistant.startListening();
        } catch (_) {}
      }
    } else {
      // 4. Silence handling: if no speech is heard after clicking mic, show "I did not hear anything" and stop
      clearConversationSilenceTimer();
      updateAvatarStateUI('READY');
      if (captionLabel) captionLabel.textContent = 'READY';
      if (liveCaptionText) {
        liveCaptionText.textContent = 'I did not hear anything';
      }
    }
  },
  onProviderBadgeUpdate: (badgeText, isAiActive) => {
    updateModeBadge(badgeText, isAiActive);
  },
  onError: (errMsg) => {
    console.warn('[Assistant Error]', errMsg);
    if (liveCaptionText) {
      liveCaptionText.textContent = errMsg;
    }
  }
});

// Initialize Memory Manager (notes and tasks in localStorage)
const memory = new MemoryManager({
  assistant,
  onNotesChange: (notes) => {
    updateMemoryStats(notes.length);
  }
});

function updateMemoryStats(count) {
  if (settingsMemoryCount) {
    settingsMemoryCount.textContent = `${count} Note${count === 1 ? '' : 's'}`;
  }
}
updateMemoryStats(memory.getNotes().length);

// Intercept memory commands in assistant pipeline
const originalProcessQuestion = assistant.processQuestion.bind(assistant);
assistant.processQuestion = async function (question) {
  if (!question || !question.trim()) return;
  const cleanQ = question.trim();

  // Check if this is a memory command (e.g., "remember that ...", "what do you remember", "forget everything")
  const memCmd = memory.parseCommand(cleanQ);
  if (memCmd) {
    this.onUserQuestion(cleanQ);
    this.onStatus({ status: 'THINKING...', transcript: cleanQ });
    this.onStateChange('THINKING', 'THINKING');

    const result = await memory.executeCommand(memCmd, this.currentLang);
    if (result && result.speech) {
      this.currentAnsweringProvider = 'builtin';
      this.speakAnswer(result.speech);
    } else {
      this.onStateChange('READY', 'READY');
      this.onStatus({ status: 'READY', transcript: '' });
    }
    return;
  }

  // Otherwise, invoke AI multi-provider question pipeline
  return originalProcessQuestion(cleanQ);
};

// ==========================================================================
// 3. Provider Badge & Mode Indicators
// ==========================================================================
function updateModeBadge(badgeText, isAiActive) {
  const text = badgeText || assistant.getBadgeText();
  const active = typeof isAiActive === 'boolean' ? isAiActive : assistant.isAiMode;

  if (assistantModeText) {
    assistantModeText.textContent = text;
  }
  if (assistantModeBadge) {
    assistantModeBadge.classList.toggle('ai-active', active);
  }
  if (assistantModeDot) {
    assistantModeDot.style.background = active ? 'var(--accent-orange)' : '#64748b';
  }
}
updateModeBadge();

// ==========================================================================
// 4. Language Switcher (English, Urdu, Pashto with RTL support)
// ==========================================================================
function setLanguage(lang) {
  if (!['en', 'ur', 'ps'].includes(lang)) return;
  assistant.setLanguage(lang);

  // Update button active state
  langButtons.forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
  });

  // RTL adjustment on caption box
  if (liveCaptionBox) {
    if (lang === 'ur' || lang === 'ps') {
      liveCaptionBox.classList.add('rtl-text');
    } else {
      liveCaptionBox.classList.remove('rtl-text');
    }
  }

  // Update default caption hint
  if (liveCaptionText && (!assistant.isListening && !assistant.isSpeaking)) {
    const hint = (lang === 'ur')
      ? 'اردو، پشتو، یا انگریزی میں بات کریں...'
      : ((lang === 'ps')
        ? 'په پښتو، اردو، یا انګریزي کې خبرې وکړئ...'
        : 'Click the mic or hold SPACE and speak...');
    liveCaptionText.textContent = hint;
  }
}

langButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const lang = btn.getAttribute('data-lang');
    setLanguage(lang);
  });
});

// Initialize with assistant's saved language
setLanguage(assistant.currentLang || 'en');

// ==========================================================================
// 5. Speaker On/Off Button (Starts OFF)
// ==========================================================================
function updateSpeakerUI(isEnabled) {
  if (!soundToggleBtn) return;
  soundToggleBtn.classList.toggle('active', isEnabled);
  soundToggleBtn.title = isEnabled ? 'Voice output: ON (Click to mute)' : 'Voice output: OFF (Click to enable)';
  const icon = soundToggleBtn.querySelector('.btn-icon');
  if (icon) {
    icon.textContent = isEnabled ? '🔊' : '🔇';
  }
}

if (soundToggleBtn) {
  soundToggleBtn.addEventListener('click', () => {
    const isEnabled = robotVoice.toggle();
    assistant.setVoiceEnabled(isEnabled);
    updateSpeakerUI(isEnabled);
  });
  updateSpeakerUI(robotVoice.enabled);
}

// ==========================================================================
// 6. Large Round Mic Button & Space Key Interaction
// ==========================================================================
function toggleMicListening() {
  if (assistant.isSpeaking) {
    // 2. Interrupt: if click mic while assistant is speaking, stop speech immediately and start listening
    clearConversationSilenceTimer();
    assistant.interruptAndListen();
    if (isConversationMode) {
      startConversationSilenceTimer();
    }
    return;
  }

  if (assistant.isListening) {
    clearConversationSilenceTimer();
    assistant.stopListening();
  } else {
    clearConversationSilenceTimer();
    assistant.startListening();
    if (isConversationMode) {
      startConversationSilenceTimer();
    }
  }
}

if (assistantMicBtn) {
  assistantMicBtn.addEventListener('click', toggleMicListening);
}

// Conversation Mode Toggle Button (off by default)
if (conversationToggleBtn) {
  conversationToggleBtn.addEventListener('click', () => {
    isConversationMode = !isConversationMode;
    conversationToggleBtn.classList.toggle('active', isConversationMode);
    if (conversationToggleText) {
      conversationToggleText.textContent = isConversationMode ? 'CONVERSATION: ON' : 'CONVERSATION: OFF';
    }
    if (isConversationMode) {
      if (!assistant.isSpeaking && !assistant.isListening) {
        assistant.startListening();
        startConversationSilenceTimer();
      }
    } else {
      clearConversationSilenceTimer();
    }
  });
}

// Hold or press SPACE to speak / interrupt
let isSpacePressed = false;

window.addEventListener('keydown', (e) => {
  // If user is typing in an input or textarea or modal is open, ignore space shortcut
  const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
  if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
    return;
  }

  if (e.code === 'Space' && !isSpacePressed && !e.repeat) {
    isSpacePressed = true;
    e.preventDefault();
    if (assistant.isSpeaking) {
      // 2. Interrupt: if press SPACE while assistant is speaking, stop speech immediately and start listening
      clearConversationSilenceTimer();
      assistant.interruptAndListen();
      if (isConversationMode) {
        startConversationSilenceTimer();
      }
    } else if (!assistant.isListening) {
      clearConversationSilenceTimer();
      assistant.startListening();
      if (isConversationMode) {
        startConversationSilenceTimer();
      }
    }
  }

  // Quick shortcut 's' / 'S' to open settings modal
  if ((e.key === 's' || e.key === 'S') && !isSpacePressed) {
    if (settingsModal && settingsModal.classList.contains('hidden')) {
      e.preventDefault();
      openSettingsModal();
    }
  }
});

window.addEventListener('keyup', (e) => {
  const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
  if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
    return;
  }

  if (e.code === 'Space' && isSpacePressed) {
    isSpacePressed = false;
    e.preventDefault();
    // Only stop listening on release if conversation mode is OFF
    if (!isConversationMode && assistant.isListening) {
      assistant.stopListening();
    }
  }
});

// ==========================================================================
// 7. Chat History Panel (Scrollable, "You" vs "Assistant", RTL, CLEAR)
// ==========================================================================
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function appendChatMessage(role, text, provider) {
  if (!chatMessagesList) return;
  if (chatEmptyHint) {
    chatEmptyHint.style.display = 'none';
  }

  totalChatMessages += 1;
  if (chatCountTag) {
    chatCountTag.textContent = String(totalChatMessages);
  }

  const isUser = role === 'user';
  const isRtl = assistant.currentLang === 'ur' || assistant.currentLang === 'ps';

  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-message ${isUser ? 'user-msg' : 'assistant-msg'} ${isRtl ? 'rtl-lang' : ''}`;

  let providerLabel = '';
  if (!isUser) {
    if (provider === 'groq') providerLabel = '<span class="msg-provider-tag">Groq</span>';
    else if (provider === 'gemini') providerLabel = '<span class="msg-provider-tag">Gemini</span>';
    else if (provider === 'openai') providerLabel = '<span class="msg-provider-tag">OpenAI</span>';
    else providerLabel = '<span class="msg-provider-tag">Built-in</span>';
  }

  const authorTag = isUser ? 'You' : 'Assistant';

  msgDiv.innerHTML = `
    <div class="msg-meta-row">
      <span class="msg-author-tag">${authorTag}</span>
      ${providerLabel}
    </div>
    <div class="msg-bubble">${escapeHtml(text)}</div>
  `;

  chatMessagesList.appendChild(msgDiv);

  // Auto-scroll chat history content
  const chatContent = document.getElementById('chat-history-content');
  if (chatContent) {
    chatContent.scrollTop = chatContent.scrollHeight;
  }
}

// Collapsible toggle
if (chatToggleHeader && chatHistoryCard) {
  chatToggleHeader.addEventListener('click', () => {
    chatHistoryCard.classList.toggle('collapsed');
  });
}

// CLEAR conversation button
if (clearChatBtn) {
  clearChatBtn.addEventListener('click', () => {
    if (!chatMessagesList) return;
    chatMessagesList.innerHTML = '<div class="chat-empty-hint" id="chat-empty-hint">No messages yet. Ask a question to begin.</div>';
    totalChatMessages = 0;
    if (chatCountTag) {
      chatCountTag.textContent = '0';
    }
    assistant.clearConversationHistory();
  });
}

// ==========================================================================
// 8. API Keys & Settings Modal
// ==========================================================================
function openSettingsModal() {
  if (!settingsModal) return;
  populateKeysForm();
  settingsModal.classList.remove('hidden');

  // Check if first launch banner is needed
  const keys = getApiKeys();
  const hasAnyKey = Boolean(keys.groq || keys.gemini || keys.openai);
  if (firstLaunchBanner) {
    firstLaunchBanner.classList.toggle('hidden', hasAnyKey);
  }
}

function closeSettingsModal() {
  if (!settingsModal) return;
  settingsModal.classList.add('hidden');
}

function setFieldStatus(provider, state, msg) {
  const dot = keyStatusDots[provider];
  const msgEl = keyStatusMsgs[provider];
  if (!dot || !msgEl) return;

  dot.className = 'status-dot';
  if (state === 'green') {
    dot.classList.add('dot-green');
  } else if (state === 'red') {
    dot.classList.add('dot-red');
  } else {
    dot.classList.add('dot-grey');
  }
  msgEl.textContent = msg || (state === 'green' ? 'Tested OK' : (state === 'red' ? 'Failed' : 'Empty'));
}

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
  if (settingsSystemPrompt) {
    settingsSystemPrompt.value = assistant.getSystemPrompt();
  }
  updateMemoryStats(memory.getNotes().length);
}

// Wire settings open & close buttons
if (settingsToggleBtn) {
  settingsToggleBtn.addEventListener('click', openSettingsModal);
}
if (settingsCloseBtn) {
  settingsCloseBtn.addEventListener('click', closeSettingsModal);
}

// Close on backdrop click
if (settingsModal) {
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      closeSettingsModal();
    }
  });
}

// Close on ESC key
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && settingsModal && !settingsModal.classList.contains('hidden')) {
    closeSettingsModal();
  }
});

// Show/hide eye buttons for passwords
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

// TEST buttons next to each key field
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

// Reset System Prompt button
if (resetSystemPromptBtn) {
  resetSystemPromptBtn.addEventListener('click', () => {
    const defaultPrompt = resetSystemPrompt();
    if (settingsSystemPrompt) {
      settingsSystemPrompt.value = defaultPrompt;
    }
  });
}

// SAVE button: saves keys to localStorage under 'puppet_keys'
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

    if (settingsSystemPrompt) {
      saveSystemPrompt(settingsSystemPrompt.value);
    }

    updateModeBadge();
    closeSettingsModal();
  });
}

// CLEAR ALL button: clears keys from storage after prompt
if (settingsClearAllBtn) {
  settingsClearAllBtn.addEventListener('click', () => {
    if (window.confirm('Clear all stored API keys?')) {
      clearPuppetKeys();
      ['groq', 'gemini', 'openai'].forEach(p => {
        if (keyInputs[p]) keyInputs[p].value = '';
        setFieldStatus(p, 'grey', 'Empty');
      });
      updateModeBadge();
    }
  });
}

// CLEAR MEMORY button in modal
if (settingsClearMemoryBtn) {
  settingsClearMemoryBtn.addEventListener('click', () => {
    if (window.confirm('Clear all stored memory and notes?')) {
      memory.clearEverything();
      updateMemoryStats(0);
    }
  });
}

// ==========================================================================
// 9. Startup Greeting (if user name is saved in memory)
// ==========================================================================
window.addEventListener('DOMContentLoaded', () => {
  const greeting = memory.getStartupGreeting(assistant.currentLang);
  if (greeting) {
    setTimeout(() => {
      if (liveCaptionText) {
        liveCaptionText.textContent = greeting;
      }
      appendChatMessage('assistant', greeting, 'builtin');
      if (robotVoice.enabled) {
        assistant.speakAnswer(greeting);
      }
    }, 400);
  }
});
