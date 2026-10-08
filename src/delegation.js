// Specialized Agent Squad & Delegation Manager for Jarvis Puppet Agent
// Agents: CODER (💻), RESEARCHER (🔍), DESIGNER (🎨), SCHEDULER (📅)
// Supports keyword detection, voice announcements, animated progress tracks,
// scripted terminal progress logs, AI role prompting, demo fallback, and echo protection.

export const AGENT_SQUAD_CONFIG = {
  coder: {
    id: 'coder',
    name: 'CODER',
    spokenName: 'Coder',
    icon: '💻',
    color: '#00e5ff',
    glowColor: 'rgba(0, 229, 255, 0.4)',
    keywords: [
      'code', 'build', 'fix', 'coding', 'compile', 'script', 'debug',
      'program', 'function', 'refactor', 'develop', 'bug', 'software',
      'backend', 'frontend', 'developer', 'کوڈ', 'کوڈنگ', 'فکس', 'جوړول'
    ],
    rolePrompt: 'You are the Coder agent in the Jarvis multi-agent squad. Provide a concise, expert 1-2 sentence spoken summary of the technical code solution or fix. No markdown, no emojis.',
    scriptedLogs: [
      '[coder] parsing abstract syntax tree (AST)...',
      '[coder] analyzing dependencies and runtime bottlenecks...',
      '[coder] compiling modules with strict optimizations...',
      '[coder] test suite passed: zero warnings, 100% coverage.'
    ],
    demoResults: {
      en: 'Compiled the code pipeline successfully. All modules built with zero errors.',
      ur: 'کوڈ پائپ لائن کامیابی سے مرتب ہو گئی ہے۔ تمام ماڈیولز بغیر کسی ایرر کے تیار ہیں۔',
      ps: 'د کوډ پایپ لاین په بریالیتوب سره بشپړ شو. ټول ماډلونه پرته له کومې تېروتنې جوړ شول.'
    }
  },
  researcher: {
    id: 'researcher',
    name: 'RESEARCHER',
    spokenName: 'Researcher',
    icon: '🔍',
    color: '#a855f7',
    glowColor: 'rgba(168, 85, 247, 0.4)',
    keywords: [
      'search', 'find', 'explain', 'research', 'analyze', 'lookup',
      'what is', 'who is', 'why is', 'history', 'science', 'facts',
      'study', 'investigate', 'تحقیق', 'تلاش', 'وضاحت', 'لټون', 'تشریح'
    ],
    rolePrompt: 'You are the Researcher agent in the Jarvis multi-agent squad. Provide a concise, insightful 1-2 sentence spoken summary of the research finding or explanation. No markdown, no emojis.',
    scriptedLogs: [
      '[researcher] indexing global scientific and technical knowledge graph...',
      '[researcher] cross-referencing empirical evidence across peer-reviewed sources...',
      '[researcher] filtering noise and extracting core findings...',
      '[researcher] synthesis complete with high statistical confidence.'
    ],
    demoResults: {
      en: 'Research synthesis complete. Primary findings indicate high reliability and optimal metrics.',
      ur: 'تحقیق کا تجزیہ مکمل ہو گیا۔ نتائج اعلیٰ معیار اور درست ڈیٹا ظاہر کرتے ہیں۔',
      ps: 'د څیړنې تحلیل بشپړ شو. موندنې د لوړ کیفیت او دقیقو ارقامو ښکارندويي کوي.'
    }
  },
  designer: {
    id: 'designer',
    name: 'DESIGNER',
    spokenName: 'Designer',
    icon: '🎨',
    color: '#ec4899',
    glowColor: 'rgba(236, 72, 153, 0.4)',
    keywords: [
      'logo', 'design', 'poster', 'ui', 'ux', 'art', 'graphic', 'color',
      'theme', 'layout', 'mockup', 'visual', 'sketch', 'banner', 'palette',
      'ڈیزائن', 'لوگو', 'پوسٹر', 'انځور', 'ډیزاین'
    ],
    rolePrompt: 'You are the Designer agent in the Jarvis multi-agent squad. Provide a concise, creative 1-2 sentence spoken summary of the design concept, visual aesthetics, or layout. No markdown, no emojis.',
    scriptedLogs: [
      '[designer] computing WCAG contrast ratios and cybernetic palette...',
      '[designer] constructing harmonic vector grid and golden-ratio curves...',
      '[designer] rendering SVG paths and micro-interaction states...',
      '[designer] design composition exported with high-DPI glass styling.'
    ],
    demoResults: {
      en: 'Design layout generated with dark glassmorphism and balanced orange accents.',
      ur: 'ڈیزائن جدید ڈارک گلاس اور متوازن نارنجی رنگوں کے ساتھ کامیابی سے تیار ہے۔',
      ps: 'ډیزاین د عصري ډارک سټایل او نارنجي رنګونو سره په بریالیتوب چمتو شو.'
    }
  },
  scheduler: {
    id: 'scheduler',
    name: 'SCHEDULER',
    spokenName: 'Scheduler',
    icon: '📅',
    color: '#ff7b00',
    glowColor: 'rgba(255, 123, 0, 0.4)',
    keywords: [
      'remind', 'schedule', 'task', 'calendar', 'alarm', 'timer', 'meeting',
      'event', 'deadline', 'todo', 'appointment', 'agenda', 'cron',
      'شیڈول', 'یاد', 'ٹاسک', 'وخت', 'پلان'
    ],
    rolePrompt: 'You are the Scheduler agent in the Jarvis multi-agent squad. Provide a concise, efficient 1-2 sentence spoken summary confirming the scheduled task, time, and reminders. No markdown, no emojis.',
    scriptedLogs: [
      '[scheduler] parsing natural language chronological entities...',
      '[scheduler] verifying calendar slot availability matrix...',
      '[scheduler] synchronizing local cron alarms and background notifications...',
      '[scheduler] task timeline confirmed and registered.'
    ],
    demoResults: {
      en: 'Task has been registered on your calendar timeline with alert triggers enabled.',
      ur: 'آپ کے کیلنڈر پر کام کامیابی کے ساتھ شیڈول ہو گیا ہے اور الرٹس فعال ہیں۔',
      ps: 'ستاسو په تقویم کې دنده ثبت شوه او د خبرتیا تنظیمات فعال شول.'
    }
  }
};

/**
 * Detects whether a command matches one of the 4 specialized agents.
 * Returns the agent key ('coder', 'researcher', 'designer', 'scheduler') or null.
 */
export function detectDelegationType(text) {
  if (!text || typeof text !== 'string') return null;
  const normalized = text.toLowerCase().trim();

  // Check Coder keywords first
  for (const kw of AGENT_SQUAD_CONFIG.coder.keywords) {
    if (matchWordBoundary(normalized, kw)) return 'coder';
  }

  // Check Researcher keywords
  for (const kw of AGENT_SQUAD_CONFIG.researcher.keywords) {
    if (matchWordBoundary(normalized, kw)) return 'researcher';
  }

  // Check Designer keywords
  for (const kw of AGENT_SQUAD_CONFIG.designer.keywords) {
    if (matchWordBoundary(normalized, kw)) return 'designer';
  }

  // Check Scheduler keywords
  for (const kw of AGENT_SQUAD_CONFIG.scheduler.keywords) {
    if (matchWordBoundary(normalized, kw)) return 'scheduler';
  }

  return null;
}

/**
 * Helper to match word or phrase boundaries safely
 */
function matchWordBoundary(text, keyword) {
  if (keyword.includes(' ')) {
    return text.includes(keyword);
  }
  // For non-latin script (Urdu / Pashto / Arabic), regex \b may not delimit Arabic letters properly
  if (/[\u0600-\u06FF]/.test(keyword)) {
    return text.includes(keyword);
  }
  const regex = new RegExp(`(^|[^a-z0-9])${keyword}([^a-z0-9]|$)`, 'i');
  return regex.test(text);
}

/**
 * Parses and strips wake words if enabled.
 * Accepts: "hey puppet", "hey, puppet", "ہے پپٹ", etc.
 */
export function checkWakeWord(text, wakeWordEnabled = false) {
  if (!text || typeof text !== 'string') {
    return { hasWakeWord: false, command: '' };
  }

  const raw = text.trim();
  if (!wakeWordEnabled) {
    return { hasWakeWord: true, command: raw };
  }

  // English wake words: "hey puppet", "hey, puppet", "hey puppet,"
  const enRegex = /^(?:hey|hay|hi|a)[,.]?\s+puppet[,.]?\s*/i;
  // Urdu wake words: ہے پپٹ / ہیلو پپٹ / سلام پپٹ
  const urRegex = /^(?:ہے|ہیلو|سلام)[,.]?\s*پپٹ[،.]?\s*/i;

  if (enRegex.test(raw)) {
    return {
      hasWakeWord: true,
      command: raw.replace(enRegex, '').trim()
    };
  }

  if (urRegex.test(raw)) {
    return {
      hasWakeWord: true,
      command: raw.replace(urRegex, '').trim()
    };
  }

  return {
    hasWakeWord: false,
    command: raw
  };
}

/**
 * DelegationManager orchestrates the 4 specialized agent cards,
 * robot state transitions, progress animations, terminal telemetry logs,
 * AI role-prompt inference, and voice output.
 */
export class DelegationManager {
  constructor(options = {}) {
    this.terminal = options.terminal;
    this.robotVoice = options.robotVoice;
    this.assistant = options.assistant;
    this.onStateChange = options.onStateChange || (() => {});
    this.onCardUpdate = options.onCardUpdate || (() => {});

    this.isDelegating = false;
    this.activeAgentKey = null;
    this.progressInterval = null;
    this.logTimeouts = [];

    // Agent status registry: 'IDLE' | 'WORKING' | 'DONE'
    this.agentStates = {
      coder: { status: 'IDLE', progress: 0 },
      researcher: { status: 'IDLE', progress: 0 },
      designer: { status: 'IDLE', progress: 0 },
      scheduler: { status: 'IDLE', progress: 0 }
    };
  }

  /**
   * Updates state of an agent card and fires callback
   */
  setAgentState(agentKey, status, progress = 0) {
    if (!this.agentStates[agentKey]) return;
    this.agentStates[agentKey] = { status, progress };
    this.onCardUpdate(agentKey, status, progress);
  }

  /**
   * Resets all agent cards to IDLE
   */
  resetAllCards() {
    Object.keys(this.agentStates).forEach(key => {
      this.setAgentState(key, 'IDLE', 0);
    });
  }

  /**
   * Delegates a task to the specified agent.
   */
  async delegate(agentKey, command) {
    const config = AGENT_SQUAD_CONFIG[agentKey];
    if (!config) return false;

    if (this.isDelegating) {
      console.warn('Delegation already in progress, queuing or ignoring.');
      return false;
    }

    this.isDelegating = true;
    this.activeAgentKey = agentKey;

    // Reset other cards to IDLE
    Object.keys(this.agentStates).forEach(key => {
      if (key !== agentKey) {
        this.setAgentState(key, 'IDLE', 0);
      }
    });

    const lang = (this.assistant && this.assistant.currentLang) || 'en';

    // 1. Robot says: "Delegating to <agent>."
    let announcement = `Delegating to ${config.spokenName}.`;
    if (lang === 'ur') {
      announcement = `${config.spokenName} کو کام سونپ رہا ہوں۔`;
    } else if (lang === 'ps') {
      announcement = `${config.spokenName} ته کار سپارل کیږي.`;
    }

    // Echo protection: pause listening while robot speaks announcement
    if (this.assistant) {
      this.assistant.stopListening();
      this.assistant.isSpeaking = true;
    }

    // Announce delegation via speech
    if (this.robotVoice && this.robotVoice.enabled) {
      this.robotVoice.speak(announcement, () => {
        // Announcement finished
      });
    }

    // 2. Switch card to WORKING with animated progress bar
    this.setAgentState(agentKey, 'WORKING', 5);

    // 3. Robot goes to HEAVY LIFTING
    this.onStateChange('LIFTING', `DELEGATED: ${config.name}`, { silentVoice: true });

    // 4. Print scripted lines in the terminal (every 800-900ms)
    this.clearPendingLogs();
    const duration = 4000; // 4 seconds total working duration
    const logs = config.scriptedLogs;

    logs.forEach((logText, idx) => {
      const delay = 600 + idx * 850;
      if (delay < duration - 200) {
        const t = setTimeout(() => {
          if (this.terminal) {
            this.terminal.appendLine(logText, 'lifting-line');
          }
        }, delay);
        this.logTimeouts.push(t);
      }
    });

    // 5. Progress bar animation step (0% to 100% over duration)
    const startTime = performance.now();
    this.progressInterval = setInterval(() => {
      const elapsed = performance.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      this.setAgentState(agentKey, 'WORKING', pct);
      if (pct >= 100) {
        clearInterval(this.progressInterval);
        this.progressInterval = null;
      }
    }, 80);

    // 6. Generate result: AI key if exists, otherwise scripted fallback + [warn] demo result
    let result = '';
    let isAiGenerated = false;

    const hasAiKey = Boolean(this.assistant && (this.assistant.hasAnyAiKey || this.assistant.isAiMode));
    if (hasAiKey) {
      try {
        result = await this.queryAiRole(config, command, lang);
        isAiGenerated = true;
      } catch (err) {
        console.warn('Delegated AI role query error:', err);
        // Fallback to scripted result
        result = config.demoResults[lang] || config.demoResults.en;
      }
    } else {
      // Scripted result fallback
      result = config.demoResults[lang] || config.demoResults.en;
    }

    // Ensure working animation finishes before transitioning to DONE
    const remainingTime = Math.max(0, duration - (performance.now() - startTime));
    await new Promise(resolve => setTimeout(resolve, remainingTime));

    // 7. Card switches to DONE (100% progress)
    this.setAgentState(agentKey, 'DONE', 100);

    // 8. Terminal output:
    // If not AI generated, print [warn] demo result as specified
    if (!isAiGenerated && this.terminal) {
      this.terminal.appendLine('[warn] demo result', 'warn-line');
    }

    if (this.terminal) {
      const lineClass = agentKey === 'coder' ? 'agent-line' :
                        agentKey === 'researcher' ? 'idea-line' :
                        agentKey === 'designer' ? 'agent-line' : 'ok-line';
      this.terminal.appendLine(`[${agentKey}] ${result}`, lineClass);
    }

    // 9. Robot reads the short result out loud
    // Echo protection active while reading result
    if (this.assistant) {
      this.assistant.isSpeaking = true;
      this.assistant.speakAnswer(result);
    } else if (this.robotVoice && this.robotVoice.enabled) {
      this.robotVoice.speak(result, () => {
        this.onStateChange('IDLE', 'OPEN HAND', { silentVoice: true });
        this.isDelegating = false;
        this.activeAgentKey = null;
      });
    } else {
      // If voice not enabled, return to IDLE after 1.5s
      setTimeout(() => {
        this.onStateChange('IDLE', 'OPEN HAND', { silentVoice: true });
        this.isDelegating = false;
        this.activeAgentKey = null;
      }, 1500);
    }

    // Reset delegating flag after speech finishes or safety timeout
    setTimeout(() => {
      this.isDelegating = false;
      this.activeAgentKey = null;
    }, 7000);

    return true;
  }

  /**
   * Queries AI with the agent's role prompt across available providers
   */
  async queryAiRole(config, userQuery, lang) {
    let roleSystem = config.rolePrompt;
    if (lang === 'ur') {
      roleSystem += ' Reply ONLY in Urdu, in 1 to 2 short spoken sentences, using proper Arabic script. No markdown, no emojis.';
    } else if (lang === 'ps') {
      roleSystem += ' Reply ONLY in Pashto, in 1 to 2 short spoken sentences, using proper Arabic script. No markdown, no emojis.';
    }

    if (this.assistant && typeof this.assistant.queryAiMultiProvider === 'function') {
      return await this.assistant.queryAiMultiProvider({
        prompt: userQuery || `Execute task for ${config.name}`,
        systemPrompt: roleSystem
      });
    }

    throw new Error('No AI assistant provider available');
  }

  clearPendingLogs() {
    this.logTimeouts.forEach(t => clearTimeout(t));
    this.logTimeouts = [];
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }
}
