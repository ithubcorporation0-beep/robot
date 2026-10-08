// Persistent Memory & Task Manager (localStorage only, zero external servers)
// Supports:
// 1. Last 50 conversation messages + User name persistence
// 2. Startup greeting by name in selected language
// 3. Notes system ("remember that ...", "what do you remember", "forget everything" with confirmation)
// 4. Task management ("add task ...", "done task <n>", "list tasks")
// 5. English and Urdu commands support

const STORAGE_KEYS = {
  USER_NAME: 'puppet_agent_user_name',
  NOTES: 'puppet_agent_notes',
  TASKS: 'puppet_agent_tasks',
  MESSAGES: 'puppet_agent_messages_history'
};

// Safe storage wrapper for browsers and test environments
class SafeStorage {
  constructor() {
    this.memoryFallback = new Map();
  }

  get isAvailable() {
    return typeof localStorage !== 'undefined';
  }

  getItem(key) {
    if (this.isAvailable) {
      try {
        return localStorage.getItem(key);
      } catch (_) {
        return this.memoryFallback.get(key) || null;
      }
    }
    return this.memoryFallback.get(key) || null;
  }

  setItem(key, value) {
    if (this.isAvailable) {
      try {
        localStorage.setItem(key, value);
        return;
      } catch (_) {
        this.memoryFallback.set(key, value);
        return;
      }
    }
    this.memoryFallback.set(key, value);
  }

  removeItem(key) {
    if (this.isAvailable) {
      try {
        localStorage.removeItem(key);
      } catch (_) {}
    }
    this.memoryFallback.delete(key);
  }

  clear() {
    if (this.isAvailable) {
      try {
        localStorage.removeItem(STORAGE_KEYS.USER_NAME);
        localStorage.removeItem(STORAGE_KEYS.NOTES);
        localStorage.removeItem(STORAGE_KEYS.TASKS);
        localStorage.removeItem(STORAGE_KEYS.MESSAGES);
      } catch (_) {}
    }
    this.memoryFallback.clear();
  }
}

export const safeStorage = new SafeStorage();

export class MemoryManager {
  constructor(options = {}) {
    this.terminal = options.terminal;
    this.robotVoice = options.robotVoice;
    this.assistant = options.assistant;
    this.onNotesChange = options.onNotesChange || (() => {});
    this.onTasksChange = options.onTasksChange || (() => {});

    // State for confirmation flow ("forget everything" -> "Are you sure?" -> "yes")
    this.awaitingForgetConfirmation = false;
  }

  // --- 1. USER NAME ---
  getUserName() {
    return safeStorage.getItem(STORAGE_KEYS.USER_NAME) || '';
  }

  setUserName(name) {
    const cleaned = (name || '').trim();
    if (!cleaned) return '';
    safeStorage.setItem(STORAGE_KEYS.USER_NAME, cleaned);
    return cleaned;
  }

  clearUserName() {
    safeStorage.removeItem(STORAGE_KEYS.USER_NAME);
  }

  getStartupGreeting(lang = 'en') {
    const name = this.getUserName();
    if (!name) return null;

    if (lang === 'ur') {
      return `خوش آمدید ${name}! کٹھ پتلی ایجنٹ حاضر ہے۔`;
    } else if (lang === 'ps') {
      return `ښه راغلاست ${name}! پتلی ایجنټ آنلاین دی.`;
    }
    return `Welcome back, ${name}. Puppet agent standing by.`;
  }

  // --- 2. NOTES SYSTEM ---
  getNotes() {
    try {
      const raw = safeStorage.getItem(STORAGE_KEYS.NOTES);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  saveNotes(notes) {
    try {
      safeStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
    } catch (_) {}
    this.onNotesChange(notes);
  }

  addNote(text) {
    const cleaned = (text || '').trim();
    if (!cleaned) return null;

    const notes = this.getNotes();
    const newNote = {
      id: 'note_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      text: cleaned,
      timestamp: Date.now()
    };
    notes.push(newNote);
    this.saveNotes(notes);
    return newNote;
  }

  clearNotes() {
    this.saveNotes([]);
  }

  // --- 3. TASK LIST SYSTEM ---
  getTasks() {
    try {
      const raw = safeStorage.getItem(STORAGE_KEYS.TASKS);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  saveTasks(tasks) {
    try {
      safeStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    } catch (_) {}
    this.onTasksChange(tasks);
  }

  addTask(text) {
    const cleaned = (text || '').trim();
    if (!cleaned) return null;

    const tasks = this.getTasks();
    const nextNumber = tasks.length > 0 ? Math.max(...tasks.map(t => t.number || 0)) + 1 : 1;
    const newTask = {
      id: 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      number: nextNumber,
      text: cleaned,
      completed: false,
      timestamp: Date.now()
    };
    tasks.push(newTask);
    this.saveTasks(tasks);
    return newTask;
  }

  completeTask(numberOrId) {
    const tasks = this.getTasks();
    let found = null;

    for (const t of tasks) {
      if (t.number === Number(numberOrId) || t.id === String(numberOrId)) {
        t.completed = true;
        found = t;
        break;
      }
    }

    if (found) {
      this.saveTasks(tasks);
    }
    return found;
  }

  toggleTask(id) {
    const tasks = this.getTasks();
    const task = tasks.find(t => t.id === id);
    if (task) {
      task.completed = !task.completed;
      this.saveTasks(tasks);
    }
    return task;
  }

  deleteTask(id) {
    const tasks = this.getTasks().filter(t => t.id !== id);
    // Re-index numbers
    tasks.forEach((t, idx) => {
      t.number = idx + 1;
    });
    this.saveTasks(tasks);
    return tasks;
  }

  clearTasks() {
    this.saveTasks([]);
  }

  // --- 4. CONVERSATION MESSAGES (MAX 50) ---
  getConversationMessages() {
    try {
      const raw = safeStorage.getItem(STORAGE_KEYS.MESSAGES);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  addConversationMessage(role, text) {
    const cleaned = (text || '').trim();
    if (!cleaned) return;

    let messages = this.getConversationMessages();
    messages.push({
      role,
      text: cleaned,
      timestamp: Date.now()
    });

    // Save only last 50 conversation messages
    if (messages.length > 50) {
      messages = messages.slice(-50);
    }

    try {
      safeStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages));
    } catch (_) {}
  }

  clearConversationMessages() {
    safeStorage.removeItem(STORAGE_KEYS.MESSAGES);
  }

  // --- 5. CLEAR EVERYTHING ---
  clearEverything() {
    this.clearUserName();
    this.clearNotes();
    this.clearTasks();
    this.clearConversationMessages();
    this.awaitingForgetConfirmation = false;
  }

  // --- 6. COMMAND PARSER & EXECUTOR ---
  parseCommand(input) {
    if (!input || typeof input !== 'string') return null;
    const cleanInput = input.trim().replace(/[.,!?:;۔؟]+$/, '').trim();
    if (!cleanInput) return null;
    const text = cleanInput;
    const lower = cleanInput.toLowerCase();

    // 1. Check for Pending Confirmation ("forget everything" -> "Are you sure?" -> "yes")
    if (this.awaitingForgetConfirmation) {
      const isYes = /^(?:yes|yeah|yep|sure|ok|confirm|ہاں|جی ہاں|بلکل)$/i.test(lower);
      const isNo = /^(?:no|nope|cancel|stop|نہیں|منسوخ)$/i.test(lower);

      if (isYes) {
        return { type: 'CONFIRM_FORGET_YES' };
      }
      return { type: 'CONFIRM_FORGET_NO' };
    }

    // 2. Name command: "my name is <name>" / Urdu: "میرا نام <name> ہے"
    const enNameMatch = text.match(/^(?:my name is|call me)\s+([a-zA-Z0-9_\-\s]+)$/i);
    if (enNameMatch && enNameMatch[1]) {
      return { type: 'SET_NAME', name: enNameMatch[1].trim() };
    }

    // Urdu: میرا نام احمد ہے / میرا نام ہے احمد
    const urNameMatch = text.match(/(?:میرا نام\s*(?:ہے)?\s*)([\u0600-\u06FFa-zA-Z\s]+?)(?:\s*ہے)?$/);
    if (urNameMatch && urNameMatch[1] && text.includes('میرا نام')) {
      return { type: 'SET_NAME', name: urNameMatch[1].trim() };
    }

    // 3. Forget everything: "forget everything" / Urdu: "سب کچھ بھول جاؤ" / "سب بھول جاؤ"
    if (
      lower === 'forget everything' ||
      lower === 'clear memory' ||
      lower === 'forget all' ||
      text.includes('سب کچھ بھول جاؤ') ||
      text.includes('سب بھول جاؤ') ||
      text.includes('میموری صاف کرو')
    ) {
      return { type: 'FORGET_EVERYTHING' };
    }

    // 4. Remember that: "remember that <text>" / Urdu: "یاد رکھو کہ <text>" / "یاد رکھو <text>"
    const enRememberMatch = text.match(/^remember\s+(?:that\s+)?(.+)$/i);
    if (enRememberMatch && enRememberMatch[1]) {
      return { type: 'ADD_NOTE', text: enRememberMatch[1].trim() };
    }

    const urRememberMatch = text.match(/^(?:یاد رکھو کہ|یاد رکھو)\s+(.+)$/i);
    if (urRememberMatch && urRememberMatch[1]) {
      return { type: 'ADD_NOTE', text: urRememberMatch[1].trim() };
    }

    // 5. What do you remember: "what do you remember" / Urdu: "آپ کو کیا یاد ہے" / "کیا یاد ہے"
    if (
      lower.includes('what do you remember') ||
      lower === 'what do you know' ||
      lower === 'read notes' ||
      lower === 'list notes' ||
      text.includes('آپ کو کیا یاد ہے') ||
      text.includes('کیا یاد ہے') ||
      text.includes('نوٹس پڑھو')
    ) {
      return { type: 'GET_NOTES' };
    }

    // 6. Add task: "add task <text>" / Urdu: "ٹاسک شامل کرو <text>" / "نیا کام <text>"
    const enAddTaskMatch = text.match(/^(?:add task|new task|create task)\s+(.+)$/i);
    if (enAddTaskMatch && enAddTaskMatch[1]) {
      return { type: 'ADD_TASK', text: enAddTaskMatch[1].trim() };
    }

    const urAddTaskMatch = text.match(/^(?:ٹاسک شامل کرو|نیا کام|نیا ٹاسک)\s+(.+)$/i);
    if (urAddTaskMatch && urAddTaskMatch[1]) {
      return { type: 'ADD_TASK', text: urAddTaskMatch[1].trim() };
    }

    // 7. Done task: "done task <number>" / Urdu: "ٹاسک مکمل <number>" / "ٹاسک ہو گیا <number>"
    const enDoneTaskMatch = text.match(/^(?:done task|complete task|finish task|mark task)\s+(\d+)$/i);
    if (enDoneTaskMatch && enDoneTaskMatch[1]) {
      return { type: 'DONE_TASK', number: parseInt(enDoneTaskMatch[1], 10) };
    }

    // Urdu digits conversion if needed (۱, ۲, ۳...)
    const urDoneTaskMatch = text.match(/(?:ٹاسک مکمل|ٹاسک ہو گیا|مکمل ٹاسک)\s*([0-9۰-۹]+)/i);
    if (urDoneTaskMatch && urDoneTaskMatch[1]) {
      const numStr = urDoneTaskMatch[1].replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
      return { type: 'DONE_TASK', number: parseInt(numStr, 10) };
    }

    // 8. List tasks: "list tasks" / Urdu: "ٹاسک دکھاؤ" / "کاموں کی فہرست"
    if (
      lower === 'list tasks' ||
      lower === 'show tasks' ||
      lower === 'what are my tasks' ||
      lower === 'read tasks' ||
      text.includes('ٹاسک دکھاؤ') ||
      text.includes('کاموں کی فہرست') ||
      text.includes('فہرست دکھاؤ')
    ) {
      return { type: 'LIST_TASKS' };
    }

    return null;
  }

  /**
   * Executes a parsed command and returns speech response + terminal logs
   */
  async executeCommand(cmd, lang = 'en') {
    if (!cmd) return null;

    // A. SET NAME
    if (cmd.type === 'SET_NAME') {
      const savedName = this.setUserName(cmd.name);
      let speech = `Nice to meet you, ${savedName}. I will remember your name.`;
      if (lang === 'ur') {
        speech = `آپ سے مل کر خوشی ہوئی، ${savedName}۔ میں آپ کا نام یاد رکھوں گا۔`;
      } else if (lang === 'ps') {
        speech = `ستاسو سره په لیدو خوښ شوم، ${savedName}۔ زه به ستاسو نوم په یاد لرم.`;
      }
      return {
        speech,
        terminal: `[memory] user name saved: "${savedName}"`,
        terminalType: 'ok-line'
      };
    }

    // B. FORGET EVERYTHING (Confirmation Trigger)
    if (cmd.type === 'FORGET_EVERYTHING') {
      this.awaitingForgetConfirmation = true;
      let speech = "Are you sure?";
      if (lang === 'ur') speech = "کیا آپ کو یقین ہے؟";
      else if (lang === 'ps') speech = "ایا تاسو باوري یاست؟";

      return {
        speech,
        terminal: `[memory] Are you sure? Type or say 'yes' to clear all memory.`,
        terminalType: 'warn-line'
      };
    }

    // C. CONFIRM FORGET: YES
    if (cmd.type === 'CONFIRM_FORGET_YES') {
      this.clearEverything();
      let speech = "Memory cleared. I have forgotten everything.";
      if (lang === 'ur') speech = "تمام میموری صاف کر دی گئی ہے۔ میں سب کچھ بھول گیا ہوں۔";
      else if (lang === 'ps') speech = "ټوله حافظه پاکه شوه. زه هرڅه هیر کړم.";

      return {
        speech,
        terminal: `[ok] memory wiped: notes, user name, and conversation history cleared.`,
        terminalType: 'ok-line'
      };
    }

    // D. CONFIRM FORGET: NO
    if (cmd.type === 'CONFIRM_FORGET_NO') {
      this.awaitingForgetConfirmation = false;
      let speech = "Memory clear canceled. Everything is kept.";
      if (lang === 'ur') speech = "منسوخ کر دیا گیا۔ میموری برقرار ہے۔";
      else if (lang === 'ps') speech = "لغوه شوه. حافظه پاتې شوه.";

      return {
        speech,
        terminal: `[memory] memory wipe canceled.`,
        terminalType: 'warn-line'
      };
    }

    // E. ADD NOTE ("remember that ...")
    if (cmd.type === 'ADD_NOTE') {
      const note = this.addNote(cmd.text);
      let speech = `I will remember that: ${cmd.text}`;
      if (lang === 'ur') speech = `میں نے یہ یاد رکھ لیا ہے: ${cmd.text}`;
      else if (lang === 'ps') speech = `ما دا په یاد وساتل: ${cmd.text}`;

      return {
        speech,
        terminal: `[memory] saved note: "${cmd.text}"`,
        terminalType: 'ok-line'
      };
    }

    // F. GET NOTES ("what do you remember")
    if (cmd.type === 'GET_NOTES') {
      const notes = this.getNotes();
      if (notes.length === 0) {
        let speech = "I don't have any notes stored in memory.";
        if (lang === 'ur') speech = "میرے پاس کوئی نوٹس محفوظ نہیں ہیں۔";
        else if (lang === 'ps') speech = "زما په حافظه کې هیڅ یادښت نشته.";

        return {
          speech,
          terminal: `[memory] 0 notes stored in memory.`,
          terminalType: 'warn-line'
        };
      }

      const noteTexts = notes.map((n, i) => `Note ${i + 1}: ${n.text}`).join('. ');
      let speech = `Here is what I remember: ${noteTexts}`;
      if (lang === 'ur') {
        speech = `مجھے یہ یاد ہے: ` + notes.map((n, i) => `نوٹ ${i + 1}: ${n.text}`).join('۔ ');
      } else if (lang === 'ps') {
        speech = `زه دا په یاد لرم: ` + notes.map((n, i) => `یادښت ${i + 1}: ${n.text}`).join('۔ ');
      }

      const logLines = [`[memory] Total notes in memory: ${notes.length}`];
      notes.forEach((n, i) => {
        logLines.push(`  ${i + 1}. ${n.text}`);
      });

      return {
        speech,
        terminal: logLines.join('\n'),
        terminalType: 'ok-line'
      };
    }

    // G. ADD TASK ("add task ...")
    if (cmd.type === 'ADD_TASK') {
      const task = this.addTask(cmd.text);
      let speech = `Added task: ${cmd.text}`;
      if (lang === 'ur') speech = `ٹاسک شامل کر دیا گیا: ${cmd.text}`;
      else if (lang === 'ps') speech = `دنده ورزیاته شوه: ${cmd.text}`;

      return {
        speech,
        terminal: `[task] added task #${task.number}: "${cmd.text}"`,
        terminalType: 'ok-line'
      };
    }

    // H. DONE TASK ("done task <n>")
    if (cmd.type === 'DONE_TASK') {
      const task = this.completeTask(cmd.number);
      if (!task) {
        let speech = `Task number ${cmd.number} not found.`;
        if (lang === 'ur') speech = `ٹاسک نمبر ${cmd.number} نہیں ملا۔`;
        else if (lang === 'ps') speech = `دندې شمیره ${cmd.number} ونه موندل شوه.`;

        return {
          speech,
          terminal: `[warn] task #${cmd.number} does not exist.`,
          terminalType: 'warn-line'
        };
      }

      let speech = `Task ${task.number} marked as done.`;
      if (lang === 'ur') speech = `ٹاسک ${task.number} مکمل ہو گیا۔`;
      else if (lang === 'ps') speech = `دنده ${task.number} بشپړه شوه.`;

      return {
        speech,
        terminal: `[task] task #${task.number} marked completed: "${task.text}"`,
        terminalType: 'ok-line'
      };
    }

    // I. LIST TASKS ("list tasks")
    if (cmd.type === 'LIST_TASKS') {
      const tasks = this.getTasks();
      if (tasks.length === 0) {
        let speech = "Your task list is empty.";
        if (lang === 'ur') speech = "آپ کی ٹاسک لسٹ خالی ہے۔";
        else if (lang === 'ps') speech = "ستاسو د دندو لیست خالي دی.";

        return {
          speech,
          terminal: `[task] no active tasks found.`,
          terminalType: 'warn-line'
        };
      }

      const pending = tasks.filter(t => !t.completed).length;
      let speech = `You have ${tasks.length} tasks, ${pending} pending.`;
      if (lang === 'ur') speech = `آپ کے پاس ${tasks.length} ٹاسک ہیں، ${pending} باقی ہیں۔`;
      else if (lang === 'ps') speech = `تاسو ${tasks.length} دندې لرئ، ${pending} پاتې دي.`;

      const logLines = [`[task] Task List (${tasks.length} total, ${pending} pending):`];
      tasks.forEach(t => {
        const mark = t.completed ? '[✓]' : '[ ]';
        logLines.push(`  ${mark} #${t.number}: ${t.text}`);
      });

      return {
        speech,
        terminal: logLines.join('\n'),
        terminalType: 'ok-line'
      };
    }

    return null;
  }
}
