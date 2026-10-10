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
import { CommandManager, ContactsStore, FIXED_SITES, routeCommand } from './commands.js';

// ==========================================================================
// DOM Element References
// ==========================================================================

// Header & Navigation
const assistantModeBadge = document.getElementById('assistant-mode-badge');
const assistantModeText = document.getElementById('assistant-mode-text');
const assistantModeDot = document.getElementById('assistant-mode-dot');
const langButtons = document.querySelectorAll('.lang-switcher .lang-btn');
const soundToggleBtn = document.getElementById('sound-toggle-btn');
const contactsToggleBtn = document.getElementById('contacts-toggle-btn');
const settingsToggleBtn = document.getElementById('settings-toggle-btn');

// Contacts Directory Modal Elements (Requirement 5)
const contactsModal = document.getElementById('contacts-modal');
const contactsCloseBtn = document.getElementById('contacts-close-btn');
const contactEditId = document.getElementById('contact-edit-id');
const contactNameInput = document.getElementById('contact-name-input');
const contactNicknameInput = document.getElementById('contact-nickname-input');
const contactNumberInput = document.getElementById('contact-number-input');
const contactSaveBtn = document.getElementById('contact-save-btn');
const contactCancelEditBtn = document.getElementById('contact-cancel-edit-btn');
const contactFormTitle = document.getElementById('contact-form-title');
const contactsListItems = document.getElementById('contacts-list-items');
const contactsCountBadge = document.getElementById('contacts-count-badge');

// Action Cards: Pop-up Blocked Card & WhatsApp Confirm Card (Requirements 4 & 6)
const popupBlockedCard = document.getElementById('popup-blocked-card');
const popupBlockedLink = document.getElementById('popup-blocked-link');
const popupBlockedBtnText = document.getElementById('popup-blocked-btn-text');
const popupCloseBtn = document.getElementById('popup-close-btn');

const whatsappConfirmCard = document.getElementById('whatsapp-confirm-card');
const waConfirmName = document.getElementById('wa-confirm-name');
const waConfirmText = document.getElementById('wa-confirm-text');
const waSendBtn = document.getElementById('wa-send-btn');
const waCancelBtn = document.getElementById('wa-cancel-btn');
const waConfirmCloseBtn = document.getElementById('wa-confirm-close-btn');

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

// Voice Controls in Settings Modal
const settingsVoiceEngineGroup = document.getElementById('settings-voice-engine-group');
const settingsVoiceEngineSelect = document.getElementById('settings-voice-engine-select');
const settingsOpenAiVoiceGroup = document.getElementById('settings-openai-voice-group');
const settingsOpenAiVoiceSelect = document.getElementById('settings-openai-voice-select');
const settingsBrowserVoiceGroup = document.getElementById('settings-browser-voice-group');
const settingsVoicePickerSelect = document.getElementById('settings-voice-picker-select');
const voiceLangCodeBadge = document.getElementById('voice-lang-code');
const testVoiceBtn = document.getElementById('test-voice-btn');
const settingsSpeedSlider = document.getElementById('settings-speed-slider');
const speedDisplay = document.getElementById('speed-display');
const settingsPitchSlider = document.getElementById('settings-pitch-slider');
const pitchDisplay = document.getElementById('pitch-display');
const settingsVolumeSlider = document.getElementById('settings-volume-slider');
const volumeDisplay = document.getElementById('volume-display');
const settingsMuteBtn = document.getElementById('settings-mute-btn');
const settingsMuteIcon = document.getElementById('settings-mute-icon');
const settingsMuteText = document.getElementById('settings-mute-text');


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

// Initialize Voice Command Manager (Commands are checked BEFORE the AI)
const commandManager = new CommandManager({
  assistant,
  onSpeak: (text) => {
    assistant.currentAnsweringProvider = 'builtin';
    assistant.speakAnswer(text);
  },
  onAddChatMessage: (role, text, provider) => {
    appendChatMessage(role, text, provider);
  },
  onOpenContactsModal: (prefillName) => {
    openContactsModal(prefillName);
  },
  onShowPopupBlocked: (url, displayName) => {
    if (popupBlockedCard && popupBlockedLink && popupBlockedBtnText) {
      popupBlockedLink.href = url;
      popupBlockedBtnText.textContent = `Click to open ${displayName}`;
      popupBlockedCard.classList.remove('hidden');
    }
  },
  onHidePopupBlocked: () => {
    if (popupBlockedCard) popupBlockedCard.classList.add('hidden');
  },
  onShowWhatsAppConfirm: (contact, text) => {
    if (whatsappConfirmCard && waConfirmName && waConfirmText) {
      waConfirmName.textContent = `${contact.name} (${contact.number})`;
      waConfirmText.textContent = `"${text}"`;
      whatsappConfirmCard.classList.remove('hidden');
    }
  },
  onHideWhatsAppConfirm: () => {
    if (whatsappConfirmCard) whatsappConfirmCard.classList.add('hidden');
  },
  onClearChat: () => {
    if (clearChatBtn) clearChatBtn.click();
  },
  onStop: () => {
    stopEverything();
  }
});

// Intercept voice commands & memory in assistant pipeline
const originalProcessQuestion = assistant.processQuestion.bind(assistant);
assistant.processQuestion = async function (question) {
  if (!question || !question.trim()) return;
  const cleanQ = question.trim();

  // 1. Voice commands are checked BEFORE the AI
  const cmdAction = routeCommand(cleanQ, this.currentLang, commandManager.pendingWhatsApp);
  if (cmdAction) {
    this.onUserQuestion(cleanQ);
    await commandManager.handleVoiceCommand(cleanQ, this.currentLang);
    return;
  }

  // 2. Check if this is a memory command (e.g., "remember that ...", "what do you remember", "forget everything")
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

  // 3. Otherwise, invoke AI multi-provider question pipeline
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

  // Refresh voice picker options for selected language
  populateBrowserVoicePicker();
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
// 5. Speaker On/Off Button (Starts OFF) & Modal Mute Button Sync
// ==========================================================================
function updateSpeakerUI(isEnabled) {
  if (soundToggleBtn) {
    soundToggleBtn.classList.toggle('active', isEnabled);
    soundToggleBtn.title = isEnabled ? 'Voice output: ON (Click to mute)' : 'Voice output: OFF (Click to enable)';
    const icon = soundToggleBtn.querySelector('.btn-icon');
    if (icon) {
      icon.textContent = isEnabled ? '🔊' : '🔇';
    }
  }

  if (settingsMuteBtn) {
    settingsMuteBtn.classList.toggle('is-muted', !isEnabled);
    if (settingsMuteIcon) settingsMuteIcon.textContent = isEnabled ? '🔊' : '🔇';
    if (settingsMuteText) settingsMuteText.textContent = isEnabled ? 'UNMUTED' : 'MUTED';
    settingsMuteBtn.title = isEnabled ? 'Click to mute audio' : 'Click to unmute audio';
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

if (settingsMuteBtn) {
  settingsMuteBtn.addEventListener('click', () => {
    const isEnabled = robotVoice.toggle();
    assistant.setVoiceEnabled(isEnabled);
    updateSpeakerUI(isEnabled);
  });
}


// ==========================================================================
// 6. Large Round Mic Button & Space Key Interaction
// ==========================================================================
// Stop everything immediately: cancels speech, stops listening, resets avatar and captions
function stopEverything() {
  clearConversationSilenceTimer();
  if (commandManager) {
    commandManager.cancelWhatsApp();
  }
  if (popupBlockedCard) {
    popupBlockedCard.classList.add('hidden');
  }
  if (assistant) {
    assistant.stopSpeaking();
    assistant.stopListening();
  }
  updateAvatarStateUI('READY');
  if (captionLabel) captionLabel.textContent = 'READY';
  if (liveCaptionText) {
    const defaultHint = (assistant.currentLang === 'ur')
      ? 'اردو، پشتو، یا انگریزی میں بات کریں...'
      : ((assistant.currentLang === 'ps')
        ? 'په پښتو، اردو، یا انګریزي کې خبرې وکړئ...'
        : 'Stopped. Press SPACE to talk.');
    liveCaptionText.textContent = defaultHint;
  }
}

function toggleMicListening() {
  ensureMicAudioAnalyser();

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
        ensureMicAudioAnalyser();
        assistant.startListening();
        startConversationSilenceTimer();
      }
    } else {
      clearConversationSilenceTimer();
    }
  });
}

// Hold or press SPACE to speak / interrupt; ESC to stop immediately
let isSpacePressed = false;

window.addEventListener('keydown', (e) => {
  // ESC = stop (Requirement 4: SPACE = talk, ESC = stop)
  if (e.key === 'Escape') {
    if (settingsModal && !settingsModal.classList.contains('hidden')) {
      closeSettingsModal();
    }
    if (contactsModal && !contactsModal.classList.contains('hidden')) {
      closeContactsModal();
    }
    stopEverything();
    return;
  }

  // If user is typing in an input or textarea or modal is open, ignore space shortcut
  const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
  if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
    return;
  }

  if (e.code === 'Space' && !isSpacePressed && !e.repeat) {
    isSpacePressed = true;
    e.preventDefault();
    ensureMicAudioAnalyser();
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

  // Safely render opened links without escaping <a> tags
  const bubbleHtml = (text && typeof text === 'string' && text.startsWith('Opened: <a'))
    ? text
    : escapeHtml(text);

  msgDiv.innerHTML = `
    <div class="msg-meta-row">
      <span class="msg-author-tag">${authorTag}</span>
      ${providerLabel}
    </div>
    <div class="msg-bubble">${bubbleHtml}</div>
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

  // Populate Voice Controls
  populateBrowserVoicePicker();
  updateVoiceEngineVisibility();

  if (settingsVoiceEngineSelect) {
    settingsVoiceEngineSelect.value = assistant.voiceEngine || 'browser';
  }
  if (settingsOpenAiVoiceSelect) {
    settingsOpenAiVoiceSelect.value = assistant.openAiVoice || 'alloy';
  }
  if (settingsVoicePickerSelect && assistant.selectedVoiceURI) {
    settingsVoicePickerSelect.value = assistant.selectedVoiceURI;
  }
  if (settingsSpeedSlider) {
    settingsSpeedSlider.value = assistant.voiceRate;
    if (speedDisplay) speedDisplay.textContent = `${parseFloat(assistant.voiceRate).toFixed(2)}x`;
  }
  if (settingsPitchSlider) {
    settingsPitchSlider.value = assistant.voicePitch;
    if (pitchDisplay) pitchDisplay.textContent = `${parseFloat(assistant.voicePitch).toFixed(2)}`;
  }
  if (settingsVolumeSlider) {
    settingsVolumeSlider.value = assistant.voiceVolume;
    if (volumeDisplay) volumeDisplay.textContent = `${Math.round(parseFloat(assistant.voiceVolume) * 100)}%`;
  }
  updateSpeakerUI(assistant.voiceEnabled);

  updateMemoryStats(memory.getNotes().length);
}

// ==========================================================================
// Voice Controls Logic (Voice Picker, Sliders, Engine, Mute)
// ==========================================================================
function populateBrowserVoicePicker() {
  if (!settingsVoicePickerSelect) return;
  const voices = (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.getVoices)
    ? window.speechSynthesis.getVoices()
    : [];

  const lang = assistant ? (assistant.currentLang || 'en') : 'en';
  if (voiceLangCodeBadge) {
    voiceLangCodeBadge.textContent = lang.toUpperCase();
  }

  const langCode = lang.toLowerCase();
  const filtered = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith(langCode));

  const currentSelection = (assistant && assistant.selectedVoiceURI) || settingsVoicePickerSelect.value || '';
  settingsVoicePickerSelect.innerHTML = '';

  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = filtered.length > 0
    ? `Default (${lang.toUpperCase()})`
    : `Default browser voice`;
  settingsVoicePickerSelect.appendChild(defaultOption);

  if (filtered.length > 0) {
    filtered.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.voiceURI || v.name;
      opt.textContent = `${v.name} (${v.lang})`;
      if (currentSelection && (currentSelection === v.voiceURI || currentSelection === v.name)) {
        opt.selected = true;
      }
      settingsVoicePickerSelect.appendChild(opt);
    });
  } else {
    const optGroup = document.createElement('optgroup');
    optGroup.label = `Available voices (${voices.length} found)`;
    voices.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.voiceURI || v.name;
      opt.textContent = `${v.name} (${v.lang})`;
      if (currentSelection && (currentSelection === v.voiceURI || currentSelection === v.name)) {
        opt.selected = true;
      }
      optGroup.appendChild(opt);
    });
    settingsVoicePickerSelect.appendChild(optGroup);
  }
}

function updateVoiceEngineVisibility() {
  const keys = getApiKeys();
  const inputVal = keyInputs.openai ? keyInputs.openai.value.trim() : '';
  const hasOpenAiKey = Boolean(keys.openai || inputVal);

  if (settingsVoiceEngineGroup) {
    settingsVoiceEngineGroup.classList.toggle('hidden', !hasOpenAiKey);
  }

  const engine = settingsVoiceEngineSelect ? settingsVoiceEngineSelect.value : (assistant.voiceEngine || 'browser');
  if (settingsOpenAiVoiceGroup) {
    settingsOpenAiVoiceGroup.classList.toggle('hidden', !hasOpenAiKey || engine !== 'openai');
  }
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  if (typeof window.speechSynthesis.onvoiceschanged !== 'undefined') {
    window.speechSynthesis.onvoiceschanged = () => {
      populateBrowserVoicePicker();
    };
  }
}

// Voice Engine selection change
if (settingsVoiceEngineSelect) {
  settingsVoiceEngineSelect.addEventListener('change', () => {
    const engine = settingsVoiceEngineSelect.value;
    assistant.setVoiceControls({ engine });
    updateVoiceEngineVisibility();
  });
}

// OpenAI Voice selection change
if (settingsOpenAiVoiceSelect) {
  settingsOpenAiVoiceSelect.addEventListener('change', () => {
    const openAiVoice = settingsOpenAiVoiceSelect.value;
    assistant.setVoiceControls({ openAiVoice });
  });
}

// Browser Voice picker selection change
if (settingsVoicePickerSelect) {
  settingsVoicePickerSelect.addEventListener('change', () => {
    const voiceURI = settingsVoicePickerSelect.value;
    assistant.setVoiceControls({ voiceURI });
    robotVoice.setVoiceParams({ selectedVoiceURI: voiceURI });
  });
}

// Speed slider (0.7 to 1.3)
if (settingsSpeedSlider) {
  settingsSpeedSlider.addEventListener('input', () => {
    const val = parseFloat(settingsSpeedSlider.value);
    if (speedDisplay) speedDisplay.textContent = `${val.toFixed(2)}x`;
    assistant.setVoiceControls({ speed: val });
    robotVoice.setVoiceParams({ rate: val });
  });
}

// Pitch slider (0.6 to 1.4)
if (settingsPitchSlider) {
  settingsPitchSlider.addEventListener('input', () => {
    const val = parseFloat(settingsPitchSlider.value);
    if (pitchDisplay) pitchDisplay.textContent = `${val.toFixed(2)}`;
    assistant.setVoiceControls({ pitch: val });
    robotVoice.setVoiceParams({ pitch: val });
  });
}

// Volume slider (0.0 to 1.0)
if (settingsVolumeSlider) {
  settingsVolumeSlider.addEventListener('input', () => {
    const val = parseFloat(settingsVolumeSlider.value);
    if (volumeDisplay) volumeDisplay.textContent = `${Math.round(val * 100)}%`;
    assistant.setVoiceControls({ volume: val });
    robotVoice.setVoiceParams({ volume: val });
  });
}

// TEST VOICE button
if (testVoiceBtn) {
  testVoiceBtn.addEventListener('click', async () => {
    const prevText = testVoiceBtn.textContent;
    testVoiceBtn.disabled = true;
    testVoiceBtn.textContent = 'PLAYING...';

    // Temporarily ensure voice output is active for the test
    const wasMuted = !assistant.voiceEnabled;
    if (wasMuted) {
      assistant.setVoiceEnabled(true);
      robotVoice.enabled = true;
    }

    try {
      await assistant.testVoice(null, () => {
        testVoiceBtn.disabled = false;
        testVoiceBtn.textContent = prevText;
        if (wasMuted) {
          assistant.setVoiceEnabled(false);
          robotVoice.enabled = false;
          updateSpeakerUI(false);
        }
      });
    } catch (err) {
      console.warn('Test voice error:', err);
      testVoiceBtn.disabled = false;
      testVoiceBtn.textContent = prevText;
      if (wasMuted) {
        assistant.setVoiceEnabled(false);
        robotVoice.enabled = false;
        updateSpeakerUI(false);
      }
    }
  });
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
      if (p === 'openai') {
        updateVoiceEngineVisibility();
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
        if (p === 'openai') {
          updateVoiceEngineVisibility();
        }
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

// SAVE button: saves keys and voice controls to localStorage
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

    // Save Voice Controls
    assistant.setVoiceControls({
      speed: settingsSpeedSlider ? parseFloat(settingsSpeedSlider.value) : assistant.voiceRate,
      pitch: settingsPitchSlider ? parseFloat(settingsPitchSlider.value) : assistant.voicePitch,
      volume: settingsVolumeSlider ? parseFloat(settingsVolumeSlider.value) : assistant.voiceVolume,
      voiceURI: settingsVoicePickerSelect ? settingsVoicePickerSelect.value : assistant.selectedVoiceURI,
      engine: settingsVoiceEngineSelect ? settingsVoiceEngineSelect.value : assistant.voiceEngine,
      openAiVoice: settingsOpenAiVoiceSelect ? settingsOpenAiVoiceSelect.value : assistant.openAiVoice
    });

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
// 8B. Contacts Directory Modal & Action Cards (Requirements 4, 5 & 6)
// ==========================================================================

function openContactsModal(prefillName = '') {
  if (!contactsModal) return;
  contactsModal.classList.remove('hidden');
  resetContactForm();
  if (prefillName && contactNameInput) {
    contactNameInput.value = prefillName;
    if (contactNumberInput) contactNumberInput.focus();
  }
  renderContactsList();
}

function closeContactsModal() {
  if (!contactsModal) return;
  contactsModal.classList.add('hidden');
  resetContactForm();
}

function resetContactForm() {
  if (contactEditId) contactEditId.value = '';
  if (contactNameInput) contactNameInput.value = '';
  if (contactNicknameInput) contactNicknameInput.value = '';
  if (contactNumberInput) contactNumberInput.value = '';
  if (contactFormTitle) contactFormTitle.textContent = 'ADD NEW CONTACT';
  if (contactSaveBtn) contactSaveBtn.textContent = 'ADD CONTACT';
  if (contactCancelEditBtn) contactCancelEditBtn.classList.add('hidden');
}

function renderContactsList() {
  if (!contactsListItems) return;
  const contacts = ContactsStore.getContacts();

  if (contactsCountBadge) {
    contactsCountBadge.textContent = String(contacts.length);
  }

  if (contacts.length === 0) {
    contactsListItems.innerHTML = '<div class="contacts-empty-hint">No contacts yet. Add contacts here to enable WhatsApp voice messaging.</div>';
    return;
  }

  contactsListItems.innerHTML = '';
  contacts.forEach(c => {
    const row = document.createElement('div');
    row.className = 'contact-row-card';

    const nicknameBadge = c.nickname
      ? `<span class="contact-nickname-tag">${escapeHtml(c.nickname)}</span>`
      : '';

    row.innerHTML = `
      <div class="contact-info-col">
        <div class="contact-name-row">
          <span class="contact-item-name">${escapeHtml(c.name)}</span>
          ${nicknameBadge}
        </div>
        <span class="contact-item-number">+${escapeHtml(c.number)}</span>
      </div>
      <div class="contact-actions-col">
        <button type="button" class="contact-action-btn edit-btn" data-id="${c.id}" title="Edit contact">✏️</button>
        <button type="button" class="contact-action-btn del-btn" data-id="${c.id}" title="Delete contact">🗑️</button>
      </div>
    `;

    // Wire edit button
    const editBtn = row.querySelector('.edit-btn');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        if (contactEditId) contactEditId.value = c.id;
        if (contactNameInput) contactNameInput.value = c.name;
        if (contactNicknameInput) contactNicknameInput.value = c.nickname || '';
        if (contactNumberInput) contactNumberInput.value = c.number;
        if (contactFormTitle) contactFormTitle.textContent = 'EDIT CONTACT';
        if (contactSaveBtn) contactSaveBtn.textContent = 'UPDATE CONTACT';
        if (contactCancelEditBtn) contactCancelEditBtn.classList.remove('hidden');
        if (contactNameInput) contactNameInput.focus();
      });
    }

    // Wire delete button
    const delBtn = row.querySelector('.del-btn');
    if (delBtn) {
      delBtn.addEventListener('click', () => {
        if (window.confirm(`Delete contact "${c.name}"?`)) {
          ContactsStore.deleteContact(c.id);
          renderContactsList();
        }
      });
    }

    contactsListItems.appendChild(row);
  });
}

// Contacts modal open / close
if (contactsToggleBtn) {
  contactsToggleBtn.addEventListener('click', () => openContactsModal());
}

if (contactsCloseBtn) {
  contactsCloseBtn.addEventListener('click', closeContactsModal);
}

if (contactsModal) {
  contactsModal.addEventListener('click', (e) => {
    if (e.target === contactsModal) {
      closeContactsModal();
    }
  });
}

if (contactCancelEditBtn) {
  contactCancelEditBtn.addEventListener('click', resetContactForm);
}

// Auto-clean digits for phone number
if (contactNumberInput) {
  contactNumberInput.addEventListener('input', () => {
    contactNumberInput.value = ContactsStore.sanitizeNumber(contactNumberInput.value);
  });
}

// Save contact (ADD or EDIT)
if (contactSaveBtn) {
  contactSaveBtn.addEventListener('click', () => {
    const editId = contactEditId ? contactEditId.value.trim() : '';
    const name = contactNameInput ? contactNameInput.value.trim() : '';
    const nickname = contactNicknameInput ? contactNicknameInput.value.trim() : '';
    const number = contactNumberInput ? ContactsStore.sanitizeNumber(contactNumberInput.value) : '';

    if (!name) {
      alert('Please enter a contact name.');
      if (contactNameInput) contactNameInput.focus();
      return;
    }
    if (!number || number.length < 5) {
      alert('Please enter a valid phone number (digits only with country code, no + or leading zeros. Example: 923001234567).');
      if (contactNumberInput) contactNumberInput.focus();
      return;
    }

    if (editId) {
      ContactsStore.updateContact(editId, { name, nickname, number });
    } else {
      ContactsStore.addContact({ name, nickname, number });
    }

    resetContactForm();
    renderContactsList();
  });
}

// Action Cards: Pop-up Blocked Card Close Button
if (popupCloseBtn) {
  popupCloseBtn.addEventListener('click', () => {
    if (popupBlockedCard) popupBlockedCard.classList.add('hidden');
  });
}

// Action Cards: WhatsApp Confirmation Card Buttons
if (waSendBtn) {
  waSendBtn.addEventListener('click', () => {
    commandManager.executeConfirmWhatsApp();
  });
}

if (waCancelBtn) {
  waCancelBtn.addEventListener('click', () => {
    commandManager.cancelWhatsApp();
  });
}

if (waConfirmCloseBtn) {
  waConfirmCloseBtn.addEventListener('click', () => {
    commandManager.cancelWhatsApp();
  });
}

// Initial render of contacts list
renderContactsList();

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

// ==========================================================================
// 10. Ambient Background Canvas & Mic Waveform Audio Visualizer
// ==========================================================================

// Web Audio API context & analyser for real-time microphone volume visualization
let micAudioCtx = null;
let micAnalyser = null;
let micDataArray = null;

async function ensureMicAudioAnalyser() {
  if (micAnalyser) return;
  try {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    micAudioCtx = new AudioContextClass();
    if (micAudioCtx.state === 'suspended') {
      await micAudioCtx.resume();
    }
    const source = micAudioCtx.createMediaStreamSource(stream);
    micAnalyser = micAudioCtx.createAnalyser();
    micAnalyser.fftSize = 64;
    micAnalyser.smoothingTimeConstant = 0.75;
    micDataArray = new Uint8Array(micAnalyser.frequencyBinCount);
  } catch (_) {
    // Handled gracefully if microphone access is pending or restricted
  }
}

// 1. Mic Waveform Canvas Visualizer (Circular Audio Waveform around mic button)
function initMicWaveformVisualizer() {
  const canvas = document.getElementById('mic-waveform-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;
  const cx = width / 2;
  const cy = height / 2;
  const baseRadius = 45;

  let phase = 0;
  let smoothVolume = 0;
  let lastTime = performance.now();

  function drawWaveform(time) {
    requestAnimationFrame(drawWaveform);
    const dt = (time - lastTime) * 0.001;
    lastTime = time;
    phase += dt * 3.2;

    ctx.clearRect(0, 0, width, height);

    const isListening = Boolean(assistant && assistant.isListening);
    const isSpeaking = Boolean(assistant && assistant.isSpeaking);
    const isThinking = Boolean(avatarStatusBadge && avatarStatusBadge.classList.contains('thinking'));

    // Compute volume envelope
    let targetVolume = 0.04;

    if (isListening) {
      if (micAnalyser && micDataArray) {
        micAnalyser.getByteFrequencyData(micDataArray);
        let sum = 0;
        const count = Math.min(32, micDataArray.length);
        for (let i = 0; i < count; i++) {
          sum += micDataArray[i];
        }
        const micAvg = sum / count / 255;
        targetVolume = Math.min(1.0, 0.15 + micAvg * 2.2);
      } else {
        targetVolume = 0.25 + Math.sin(time * 0.008) * 0.14;
      }
    } else if (isSpeaking) {
      // Natural speech cadence envelope
      const vocalRhythm = Math.sin(time * 0.009) * 0.35 +
                          Math.sin(time * 0.019 + 1.2) * 0.25 +
                          Math.sin(time * 0.037 + 2.5) * 0.18;
      targetVolume = Math.min(1.0, Math.max(0.2, 0.45 + vocalRhythm * 0.45));
    } else if (isThinking) {
      targetVolume = 0.18 + Math.sin(time * 0.006) * 0.1;
    } else {
      targetVolume = 0.04 + Math.sin(time * 0.002) * 0.02;
    }

    // Smooth volume response
    smoothVolume += (targetVolume - smoothVolume) * (isListening || isSpeaking ? 0.35 : 0.1);

    // Color definitions
    let strokeColor = 'rgba(0, 229, 255, 0.4)';
    let glowColor = 'rgba(0, 229, 255, 0.3)';
    let tipColor = 'rgba(128, 243, 255, 0.9)';

    if (isSpeaking) {
      strokeColor = 'rgba(255, 107, 0, 0.75)';
      glowColor = 'rgba(255, 107, 0, 0.6)';
      tipColor = 'rgba(255, 210, 70, 0.95)';
    } else if (isListening) {
      strokeColor = 'rgba(0, 229, 255, 0.85)';
      glowColor = 'rgba(0, 229, 255, 0.7)';
      tipColor = 'rgba(200, 255, 255, 1.0)';
    } else if (isThinking) {
      strokeColor = 'rgba(255, 165, 0, 0.5)';
      glowColor = 'rgba(255, 107, 0, 0.4)';
      tipColor = 'rgba(255, 200, 100, 0.8)';
    }

    // Draw Radial Frequency Waveform Bars
    const totalBars = 36;
    for (let i = 0; i < totalBars; i++) {
      const angle = (i / totalBars) * Math.PI * 2;

      let freqFactor = 1.0;
      if (isListening && micDataArray && micDataArray.length > 0) {
        const binIdx = Math.floor((i / totalBars) * Math.min(24, micDataArray.length));
        freqFactor = (micDataArray[binIdx] || 50) / 255;
      } else if (isSpeaking) {
        freqFactor = 0.5 + Math.sin(i * 0.8 + time * 0.012) * 0.3 + Math.cos(i * 1.5 - time * 0.008) * 0.2;
      } else {
        freqFactor = 0.5 + Math.sin(i * 0.4 + time * 0.003) * 0.2;
      }

      const barLen = Math.max(3, smoothVolume * 44 * Math.max(0.2, freqFactor));
      const rInner = baseRadius;
      const rOuter = baseRadius + barLen;

      const x1 = cx + Math.cos(angle) * rInner;
      const y1 = cy + Math.sin(angle) * rInner;
      const x2 = cx + Math.cos(angle) * rOuter;
      const y2 = cy + Math.sin(angle) * rOuter;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineWidth = (isListening || isSpeaking) ? 2.5 : 1.5;
      ctx.lineCap = 'round';
      ctx.strokeStyle = strokeColor;
      if (isListening || isSpeaking) {
        ctx.shadowBlur = 8;
        ctx.shadowColor = glowColor;
      }
      ctx.stroke();

      if (isListening || isSpeaking) {
        ctx.beginPath();
        ctx.arc(x2, y2, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = tipColor;
        ctx.fill();
      }
      ctx.restore();
    }

    // Draw Smooth Organic Outer Waveform Loop
    ctx.save();
    ctx.beginPath();
    const splinePoints = 48;
    for (let i = 0; i <= splinePoints; i++) {
      const angle = (i / splinePoints) * Math.PI * 2;
      const waveMod = Math.sin(angle * 6 + phase) * 0.3 + Math.cos(angle * 4 - phase * 0.8) * 0.2;
      const r = baseRadius + Math.max(2, smoothVolume * 38 * (1 + waveMod));
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.closePath();
    ctx.lineWidth = (isListening || isSpeaking) ? 2.0 : 1.0;
    ctx.strokeStyle = strokeColor;
    if (isListening || isSpeaking) {
      ctx.shadowBlur = 12;
      ctx.shadowColor = glowColor;
    }
    ctx.stroke();
    ctx.restore();

    // Expanding ripple on speech/audio activity
    if ((isListening || isSpeaking) && smoothVolume > 0.28) {
      const rippleR = baseRadius + 14 + ((time * 0.055) % 36);
      const rippleAlpha = Math.max(0, 1 - (rippleR - baseRadius) / 50) * 0.4;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, rippleR, 0, Math.PI * 2);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = isSpeaking
        ? `rgba(255, 107, 0, ${rippleAlpha})`
        : `rgba(0, 229, 255, ${rippleAlpha})`;
      ctx.stroke();
      ctx.restore();
    }
  }

  requestAnimationFrame(drawWaveform);
}

// 2. Subtle Animated Ambient Background (Slow moving low-brightness gradients & particles)
function initAmbientBackground() {
  const canvas = document.getElementById('ambient-bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let width = 0;
  let height = 0;

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  const particleCount = 42;
  const particles = [];
  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.25,
      vy: -0.18 - Math.random() * 0.25,
      radius: Math.random() * 1.8 + 0.8,
      alpha: Math.random() * 0.22 + 0.08,
      swaySpeed: Math.random() * 0.002 + 0.001,
      swayOffset: Math.random() * Math.PI * 2,
      isOrange: Math.random() > 0.75
    });
  }

  const startTime = performance.now();

  function drawAmbient(time) {
    requestAnimationFrame(drawAmbient);
    const elapsed = time - startTime;

    ctx.clearRect(0, 0, width, height);

    // Subtle moving soft cosmic radial gradients (low brightness)
    const orb1X = width * 0.25 + Math.sin(elapsed * 0.00032) * width * 0.18;
    const orb1Y = height * 0.35 + Math.cos(elapsed * 0.00042) * height * 0.14;
    const grad1 = ctx.createRadialGradient(orb1X, orb1Y, 0, orb1X, orb1Y, Math.max(width, height) * 0.45);
    grad1.addColorStop(0, 'rgba(0, 229, 255, 0.065)');
    grad1.addColorStop(0.5, 'rgba(10, 35, 60, 0.035)');
    grad1.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad1;
    ctx.fillRect(0, 0, width, height);

    const orb2X = width * 0.75 + Math.cos(elapsed * 0.00028) * width * 0.16;
    const orb2Y = height * 0.65 + Math.sin(elapsed * 0.00038) * height * 0.16;
    const grad2 = ctx.createRadialGradient(orb2X, orb2Y, 0, orb2X, orb2Y, Math.max(width, height) * 0.42);
    grad2.addColorStop(0, 'rgba(255, 107, 0, 0.045)');
    grad2.addColorStop(0.5, 'rgba(40, 20, 10, 0.02)');
    grad2.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad2;
    ctx.fillRect(0, 0, width, height);

    // Drifting particles with low brightness
    for (let i = 0; i < particleCount; i++) {
      const p = particles[i];
      p.y += p.vy;
      p.x += p.vx + Math.sin(elapsed * p.swaySpeed + p.swayOffset) * 0.2;

      if (p.y < -10) {
        p.y = height + 10;
        p.x = Math.random() * width;
      }
      if (p.x < -10) p.x = width + 10;
      if (p.x > width + 10) p.x = -10;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.isOrange
        ? `rgba(255, 120, 40, ${p.alpha})`
        : `rgba(0, 229, 255, ${p.alpha})`;
      ctx.fill();

      // Delicate subtle links between nearby particles
      for (let j = i + 1; j < particleCount; j++) {
        const p2 = particles[j];
        const dx = p.x - p2.x;
        const dy = p.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 80) {
          const lineAlpha = (1 - dist / 80) * 0.05;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(0, 229, 255, ${lineAlpha})`;
          ctx.lineWidth = 0.7;
          ctx.stroke();
        }
      }
    }
  }

  requestAnimationFrame(drawAmbient);
}

// Initialize Visualizers
initAmbientBackground();
initMicWaveformVisualizer();
