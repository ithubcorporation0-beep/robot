// Voice Command System for Puppet Agent
// Commands are evaluated BEFORE the AI.
// Safety rules:
// - Only fixed allowed URLs, wa.me, search, tel:, mailto: links.
// - Contact data is stored strictly in localStorage ('puppet_contacts') on this machine.
// - Never claims WhatsApp messages are sent automatically; user confirms and presses Send in WhatsApp.

// ==========================================================================
// 1. Fixed Allowed Websites (Strictly Whitelisted)
// ==========================================================================
export const FIXED_SITES = {
  whatsapp: { name: 'WhatsApp', url: 'https://web.whatsapp.com' },
  youtube: { name: 'YouTube', url: 'https://www.youtube.com' },
  google: { name: 'Google', url: 'https://www.google.com' },
  gmail: { name: 'Gmail', url: 'https://mail.google.com' },
  facebook: { name: 'Facebook', url: 'https://www.facebook.com' },
  instagram: { name: 'Instagram', url: 'https://www.instagram.com' },
  github: { name: 'GitHub', url: 'https://www.github.com' },
  chatgpt: { name: 'ChatGPT', url: 'https://chatgpt.com' },
  maps: { name: 'Google Maps', url: 'https://maps.google.com' },
  linkedin: { name: 'LinkedIn', url: 'https://www.linkedin.com' },
  fiverr: { name: 'Fiverr', url: 'https://www.fiverr.com' },
  x: { name: 'X', url: 'https://x.com' },
  twitter: { name: 'X', url: 'https://x.com' }
};

// Aliases for multilingual site resolution (Urdu, Pashto, English)
const SITE_ALIASES = {
  'whatsapp': 'whatsapp',
  'واٹس ایپ': 'whatsapp',
  'واٹسایپ': 'whatsapp',
  'واټس اپ': 'whatsapp',
  'واتساپ': 'whatsapp',

  'youtube': 'youtube',
  'یوٹیوب': 'youtube',
  'یوټیوب': 'youtube',

  'google': 'google',
  'گوگل': 'google',
  'ګوګل': 'google',

  'gmail': 'gmail',
  'جی میل': 'gmail',
  'جیمیل': 'gmail',

  'facebook': 'facebook',
  'فیس بک': 'facebook',
  'فیسبوک': 'facebook',

  'instagram': 'instagram',
  'انسٹاگرام': 'instagram',
  'انسټاګرام': 'instagram',
  'انسٹا': 'instagram',

  'github': 'github',
  'گٹ ہب': 'github',
  'ګیټ هب': 'github',

  'chatgpt': 'chatgpt',
  'چیٹ جی پی ٹی': 'chatgpt',
  'چیټ جي پي ټي': 'chatgpt',

  'maps': 'maps',
  'google maps': 'maps',
  'میپس': 'maps',
  'گوگل میپس': 'maps',
  'نقشہ': 'maps',

  'linkedin': 'linkedin',
  'لنکڈ ان': 'linkedin',
  'لینکډ ان': 'linkedin',

  'fiverr': 'fiverr',
  'فائیور': 'fiverr',
  'فایور': 'fiverr',

  'x': 'x',
  'twitter': 'x',
  'ٹوئٹر': 'x',
  'ایکس': 'x'
};

// ==========================================================================
// 2. Contacts Storage (localStorage 'puppet_contacts')
// ==========================================================================
const CONTACTS_STORAGE_KEY = 'puppet_contacts';

export class ContactsStore {
  static sanitizeNumber(rawNumber) {
    if (!rawNumber) return '';
    // Digits only, no plus, no leading zeros
    return String(rawNumber).replace(/\D/g, '').replace(/^0+/, '');
  }

  static getContacts() {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(CONTACTS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {}
    return [];
  }

  static saveContacts(contacts) {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(contacts));
    } catch (_) {}
  }

  static addContact({ name, nickname = '', number }) {
    const contacts = this.getContacts();
    const cleanNumber = this.sanitizeNumber(number);
    const cleanName = (name || '').trim();
    const cleanNickname = (nickname || '').trim();

    if (!cleanName || !cleanNumber) {
      throw new Error('Name and valid phone number are required.');
    }

    const newContact = {
      id: 'c_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      name: cleanName,
      nickname: cleanNickname,
      number: cleanNumber,
      updatedAt: Date.now()
    };

    contacts.push(newContact);
    this.saveContacts(contacts);
    return newContact;
  }

  static updateContact(id, { name, nickname = '', number }) {
    const contacts = this.getContacts();
    const idx = contacts.findIndex(c => c.id === id);
    if (idx === -1) return null;

    const cleanNumber = this.sanitizeNumber(number);
    const cleanName = (name || '').trim();
    const cleanNickname = (nickname || '').trim();

    if (!cleanName || !cleanNumber) {
      throw new Error('Name and valid phone number are required.');
    }

    contacts[idx] = {
      ...contacts[idx],
      name: cleanName,
      nickname: cleanNickname,
      number: cleanNumber,
      updatedAt: Date.now()
    };

    this.saveContacts(contacts);
    return contacts[idx];
  }

  static deleteContact(id) {
    let contacts = this.getContacts();
    contacts = contacts.filter(c => c.id !== id);
    this.saveContacts(contacts);
  }

  // Fuzzy, case-insensitive match on Name and Nickname
  static findContact(target) {
    if (!target) return null;
    const cleanTarget = target.trim().toLowerCase();
    const contacts = this.getContacts();
    if (contacts.length === 0) return null;

    // 1. Exact match on name or nickname
    for (const c of contacts) {
      const name = (c.name || '').toLowerCase();
      const nick = (c.nickname || '').toLowerCase();
      if (name === cleanTarget || nick === cleanTarget) {
        return c;
      }
    }

    // 2. Substring match
    for (const c of contacts) {
      const name = (c.name || '').toLowerCase();
      const nick = (c.nickname || '').toLowerCase();
      if (name && (name.includes(cleanTarget) || cleanTarget.includes(name))) {
        return c;
      }
      if (nick && (nick.includes(cleanTarget) || cleanTarget.includes(nick))) {
        return c;
      }
    }

    // 3. Word token boundary match
    const targetWords = cleanTarget.split(/\s+/);
    for (const c of contacts) {
      const name = (c.name || '').toLowerCase();
      const nick = (c.nickname || '').toLowerCase();
      for (const w of targetWords) {
        if (w.length >= 2 && (name === w || nick === w)) {
          return c;
        }
      }
    }

    return null;
  }
}

// ==========================================================================
// 3. Voice Command Router
// ==========================================================================
export function routeCommand(spokenText, lang = 'en', pendingWhatsApp = null) {
  if (!spokenText || !spokenText.trim()) return null;
  const raw = spokenText.trim();
  const lower = raw.toLowerCase();

  // --------------------------------------------------------------------------
  // A. Pending Confirmation Check (WhatsApp confirmation flow)
  // --------------------------------------------------------------------------
  if (pendingWhatsApp) {
    const isAffirmative = /^(yes|yeah|sure|yep|send|confirm|ok|okay|send it|please send|ہاں|جی ہاں|بھیج دو|سینڈ کرو|صحیح|هو|او|هو واستوه|واستوه)$/i.test(lower);
    if (isAffirmative) {
      return { type: 'confirm_whatsapp' };
    }
    const isNegative = /^(no|nope|cancel|don't|stop|nevermind|نہیں|کینسل|رہنے دو|نہ بھیجو|نه|مه واستوه)$/i.test(lower);
    if (isNegative) {
      return { type: 'cancel_whatsapp' };
    }
  }

  // --------------------------------------------------------------------------
  // B. Stop Command
  // --------------------------------------------------------------------------
  if (/^(stop|cancel|quiet|shut up|be quiet|روکو|بند کرو|چپ|ودریږه|بند کړه)$/i.test(lower)) {
    return { type: 'stop' };
  }

  // --------------------------------------------------------------------------
  // C. Clear Chat Command
  // --------------------------------------------------------------------------
  if (/^(clear chat|clear history|delete chat|clear conversation|delete history|چیٹ صاف کرو|ہسٹری ختم کرو|چیٹ ڈیلیٹ کرو|چیٹ خالی کرو|چیټ پاک کړه|تاریخچه پاکه کړه)$/i.test(lower)) {
    return { type: 'clear_chat' };
  }

  // --------------------------------------------------------------------------
  // D. What Time Is It Command
  // --------------------------------------------------------------------------
  if (/^(what time is it|what is the time|what's the time|tell me the time|current time|^time$|وقت کیا ہے|کتنے بجے ہیں|ٹائم کیا ہے|کیا وقت ہوا ہے|څو بجې دي|وخت څه دی|وخت څو دی)$/i.test(lower)) {
    return { type: 'time' };
  }

  // --------------------------------------------------------------------------
  // E. WhatsApp Message Command
  // --------------------------------------------------------------------------
  // English:
  // "send message to <name> saying <text>"
  // "send a message to <name> saying <text>"
  // "whatsapp <name> <text>"
  // "message <name> <text>"
  let waMatch = lower.match(/^send (?:a )?(?:whatsapp )?message to ([a-z0-9_\s]+?) saying (.+)$/i);
  if (!waMatch) {
    waMatch = lower.match(/^send whatsapp to ([a-z0-9_\s]+?) saying (.+)$/i);
  }
  if (!waMatch) {
    waMatch = lower.match(/^whatsapp ([a-z0-9_]+)\s+(.+)$/i);
  }
  if (!waMatch) {
    waMatch = lower.match(/^message ([a-z0-9_]+)\s+(.+)$/i);
  }

  // Urdu equivalents:
  // "<name> کو میسج بھیجو <text>"
  // "<name> کو واٹس ایپ کرو <text>"
  let waUrduMatch = raw.match(/^(.+?)\s+کو\s+(?:میسج|واٹس ایپ|واٹسایپ|پیغام)\s+(?:بھیجو|کرو)\s*(.*)$/);
  if (waUrduMatch) {
    const contactName = waUrduMatch[1].trim();
    const msgText = (waUrduMatch[2] || '').trim();
    if (contactName && msgText) {
      return { type: 'whatsapp_message', name: contactName, text: msgText };
    }
  }

  // Pashto equivalents:
  // "<name> ته میسج واستوه <text>"
  let waPashtoMatch = raw.match(/^(.+?)\s+ته\s+(?:میسج|واټس اپ|پیغام)\s+(?:واستوه|ولېږه|کړه)\s*(.*)$/);
  if (waPashtoMatch) {
    const contactName = waPashtoMatch[1].trim();
    const msgText = (waPashtoMatch[2] || '').trim();
    if (contactName && msgText) {
      return { type: 'whatsapp_message', name: contactName, text: msgText };
    }
  }

  if (waMatch) {
    const contactName = waMatch[1].trim();
    const msgText = waMatch[2].trim();
    if (contactName && msgText) {
      return { type: 'whatsapp_message', name: contactName, text: msgText };
    }
  }

  // --------------------------------------------------------------------------
  // F. Call <name> Command (opens tel:<number>)
  // --------------------------------------------------------------------------
  // English: "call <name>", "make a call to <name>"
  const callMatch = lower.match(/^(?:call|make a call to)\s+([a-z0-9_\s]+)$/i);
  if (callMatch) {
    return { type: 'call', name: callMatch[1].trim() };
  }
  // Urdu: "<name> کو کال کرو"
  const callUrduMatch = raw.match(/^(.+?)\s+کو\s+کال\s+کرو$/);
  if (callUrduMatch) {
    return { type: 'call', name: callUrduMatch[1].trim() };
  }
  // Pashto: "<name> ته زنګ ووهه"
  const callPashtoMatch = raw.match(/^(.+?)\s+ته\s+زنګ\s+ووهه$/);
  if (callPashtoMatch) {
    return { type: 'call', name: callPashtoMatch[1].trim() };
  }

  // --------------------------------------------------------------------------
  // G. Email <text> Command (opens mailto:)
  // --------------------------------------------------------------------------
  // English: "email <text>", "send email <text>"
  const emailMatch = lower.match(/^(?:email|send email)\s+(.+)$/i);
  if (emailMatch) {
    return { type: 'email', text: emailMatch[1].trim() };
  }
  // Urdu: "ای میل بھیجو <text>", "میل بھیجو <text>"
  const emailUrduMatch = raw.match(/^(?:ای میل|میل)\s+(?:بھیجو|کرو)\s*(.+)$/);
  if (emailUrduMatch) {
    return { type: 'email', text: emailUrduMatch[1].trim() };
  }

  // --------------------------------------------------------------------------
  // H. Search Command
  // --------------------------------------------------------------------------
  // "search <text> on google"
  const searchGoogleMatch = lower.match(/^search\s+(.+?)\s+on\s+google$/i);
  if (searchGoogleMatch) {
    return { type: 'search', engine: 'google', query: searchGoogleMatch[1].trim() };
  }
  // "search <text> on youtube"
  const searchYoutubeMatch = lower.match(/^search\s+(.+?)\s+on\s+youtube$/i);
  if (searchYoutubeMatch) {
    return { type: 'search', engine: 'youtube', query: searchYoutubeMatch[1].trim() };
  }
  // "search <text>" (with no site uses Google)
  const searchGeneralMatch = lower.match(/^search\s+(.+)$/i);
  if (searchGeneralMatch) {
    return { type: 'search', engine: 'google', query: searchGeneralMatch[1].trim() };
  }

  // Urdu Search:
  // "گوگل پر سرچ کرو <text>" / "گوگل پر تلاش کرو <text>"
  const urduGoogleSearch = raw.match(/^گوگل\s+پر\s+(?:سرچ|تلاش)\s+کرو\s+(.+)$/);
  if (urduGoogleSearch) {
    return { type: 'search', engine: 'google', query: urduGoogleSearch[1].trim() };
  }
  // "یوٹیوب پر سرچ کرو <text>" / "یوٹیوب پر تلاش کرو <text>"
  const urduYoutubeSearch = raw.match(/^یوٹیوب\s+پر\s+(?:سرچ|تلاش)\s+کرو\s+(.+)$/);
  if (urduYoutubeSearch) {
    return { type: 'search', engine: 'youtube', query: urduYoutubeSearch[1].trim() };
  }
  // "سرچ کرو <text>" / "تلاش کرو <text>"
  const urduGeneralSearch = raw.match(/^(?:سرچ|تلاش)\s+کرو\s+(.+)$/);
  if (urduGeneralSearch) {
    return { type: 'search', engine: 'google', query: urduGeneralSearch[1].trim() };
  }

  // Pashto Search:
  // "په ګوګل کې ولټوه <text>"
  const pashtoGoogleSearch = raw.match(/^په\s+ګوګل\s+کې\s+ولټوه\s+(.+)$/);
  if (pashtoGoogleSearch) {
    return { type: 'search', engine: 'google', query: pashtoGoogleSearch[1].trim() };
  }
  // "په یوټیوب کې وپلټه <text>"
  const pashtoYoutubeSearch = raw.match(/^په\s+یوټیوب\s+کې\s+(?:وپلټه|ولټوه)\s+(.+)$/);
  if (pashtoYoutubeSearch) {
    return { type: 'search', engine: 'youtube', query: pashtoYoutubeSearch[1].trim() };
  }
  // "ولټوه <text>" / "وپلټه <text>"
  const pashtoGeneralSearch = raw.match(/^(?:ولټوه|وپلټه)\s+(.+)$/);
  if (pashtoGeneralSearch) {
    return { type: 'search', engine: 'google', query: pashtoGeneralSearch[1].trim() };
  }

  // --------------------------------------------------------------------------
  // I. Open Websites Command (ONLY Whitelisted Fixed Sites)
  // --------------------------------------------------------------------------
  // English: "open <name>", "launch <name>", "go to <name>"
  const openMatch = lower.match(/^(?:open|launch|go to)\s+([a-z0-9_\s]+)$/i);
  if (openMatch) {
    const rawTarget = openMatch[1].trim();
    const siteKey = SITE_ALIASES[rawTarget] || rawTarget;
    if (FIXED_SITES[siteKey]) {
      return {
        type: 'open_site',
        siteKey,
        siteName: FIXED_SITES[siteKey].name,
        url: FIXED_SITES[siteKey].url
      };
    }
  }

  // Urdu: "<name> کھولو" or "کھولو <name>"
  let urduSiteMatch = raw.match(/^(.+?)\s+کھولو$/);
  if (!urduSiteMatch) {
    urduSiteMatch = raw.match(/^کھولو\s+(.+)$/);
  }
  if (urduSiteMatch) {
    const rawTarget = urduSiteMatch[1].trim();
    const siteKey = SITE_ALIASES[rawTarget] || SITE_ALIASES[rawTarget.toLowerCase()];
    if (siteKey && FIXED_SITES[siteKey]) {
      return {
        type: 'open_site',
        siteKey,
        siteName: FIXED_SITES[siteKey].name,
        url: FIXED_SITES[siteKey].url
      };
    }
  }

  // Pashto: "<name> پرانیزه" or "<name> خلاص کړه"
  let pashtoSiteMatch = raw.match(/^(.+?)\s+(?:پرانیزه|خلاص کړه)$/);
  if (pashtoSiteMatch) {
    const rawTarget = pashtoSiteMatch[1].trim();
    const siteKey = SITE_ALIASES[rawTarget] || SITE_ALIASES[rawTarget.toLowerCase()];
    if (siteKey && FIXED_SITES[siteKey]) {
      return {
        type: 'open_site',
        siteKey,
        siteName: FIXED_SITES[siteKey].name,
        url: FIXED_SITES[siteKey].url
      };
    }
  }

  // No voice command matched -> returns null so the question goes to AI as normal
  return null;
}

// ==========================================================================
// 4. Command Manager
// ==========================================================================
export class CommandManager {
  constructor(options = {}) {
    this.assistant = options.assistant;
    this.onSpeak = options.onSpeak || (() => {});
    this.onAddChatMessage = options.onAddChatMessage || (() => {});
    this.onOpenContactsModal = options.onOpenContactsModal || (() => {});
    this.onShowPopupBlocked = options.onShowPopupBlocked || (() => {});
    this.onHidePopupBlocked = options.onHidePopupBlocked || (() => {});
    this.onShowWhatsAppConfirm = options.onShowWhatsAppConfirm || (() => {});
    this.onHideWhatsAppConfirm = options.onHideWhatsAppConfirm || (() => {});
    this.onClearChat = options.onClearChat || (() => {});
    this.onStop = options.onStop || (() => {});

    this.pendingWhatsApp = null;
  }

  // Safe window opener with pop-up blocking detection
  safeOpenUrl(url, displayName) {
    let win = null;
    try {
      win = window.open(url, '_blank');
    } catch (_) {
      win = null;
    }

    // Always log clickable line in chat history (Req 8)
    this.onAddChatMessage('assistant', `Opened: <a href="${url}" target="_blank" rel="noopener noreferrer" class="chat-opened-link">${displayName}</a>`, 'builtin');

    // Pop-up blocked detection (Req 6)
    if (!win || win.closed || typeof win.closed === 'undefined') {
      this.onShowPopupBlocked(url, displayName);
      return false;
    } else {
      this.onHidePopupBlocked();
      return true;
    }
  }

  // Execute confirmed WhatsApp sending
  executeConfirmWhatsApp() {
    if (!this.pendingWhatsApp) return;
    const { contact, text } = this.pendingWhatsApp;
    this.pendingWhatsApp = null;
    this.onHideWhatsAppConfirm();

    const waUrl = `https://wa.me/${contact.number}?text=${encodeURIComponent(text)}`;
    this.onSpeak('WhatsApp is ready. Press send.');
    this.safeOpenUrl(waUrl, `WhatsApp (${contact.name})`);
  }

  // Cancel pending WhatsApp message
  cancelWhatsApp() {
    if (!this.pendingWhatsApp) return;
    this.pendingWhatsApp = null;
    this.onHideWhatsAppConfirm();
    this.onSpeak('Message cancelled.');
  }

  // Main voice command evaluator
  async handleVoiceCommand(spokenText, currentLang = 'en') {
    const action = routeCommand(spokenText, currentLang, this.pendingWhatsApp);
    if (!action) {
      return false; // Not a command; pass to AI
    }

    // Handle the command action
    switch (action.type) {
      case 'confirm_whatsapp': {
        this.executeConfirmWhatsApp();
        return true;
      }

      case 'cancel_whatsapp': {
        this.cancelWhatsApp();
        return true;
      }

      case 'stop': {
        this.onStop();
        return true;
      }

      case 'clear_chat': {
        this.onClearChat();
        this.onSpeak('Chat history cleared.');
        return true;
      }

      case 'time': {
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const reply = `The time is ${timeStr}.`;
        this.onAddChatMessage('assistant', reply, 'builtin');
        this.onSpeak(reply);
        return true;
      }

      case 'open_site': {
        const { siteName, url } = action;
        const speech = `Opening ${siteName}.`;
        this.onSpeak(speech);
        this.safeOpenUrl(url, siteName);
        return true;
      }

      case 'search': {
        const { engine, query } = action;
        let searchUrl = '';
        let engineName = 'Google';
        if (engine === 'youtube') {
          engineName = 'YouTube';
          searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
        } else {
          engineName = 'Google';
          searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        }
        const speech = `Searching ${query} on ${engineName}.`;
        this.onSpeak(speech);
        this.safeOpenUrl(searchUrl, `${engineName} Search: "${query}"`);
        return true;
      }

      case 'whatsapp_message': {
        const { name, text } = action;
        const contact = ContactsStore.findContact(name);

        if (!contact) {
          // Contact not found -> prompt user to add in Contacts and open modal
          const notFoundSpeech = `I do not have a number for ${name}. Add it in Contacts.`;
          this.onAddChatMessage('assistant', notFoundSpeech, 'builtin');
          this.onSpeak(notFoundSpeech);
          this.onOpenContactsModal(name);
          return true;
        }

        // Contact found -> prompt confirmation and show confirm card
        this.pendingWhatsApp = { contact, text };
        const confirmSpeech = `Send to ${contact.name}: ${text}. Say yes to confirm.`;
        this.onAddChatMessage('assistant', confirmSpeech, 'builtin');
        this.onSpeak(confirmSpeech);
        this.onShowWhatsAppConfirm(contact, text);
        return true;
      }

      case 'call': {
        const { name } = action;
        const contact = ContactsStore.findContact(name);

        if (!contact) {
          const notFoundSpeech = `I do not have a number for ${name}. Add it in Contacts.`;
          this.onAddChatMessage('assistant', notFoundSpeech, 'builtin');
          this.onSpeak(notFoundSpeech);
          this.onOpenContactsModal(name);
          return true;
        }

        const callUrl = `tel:${contact.number}`;
        const speech = `Calling ${contact.name}.`;
        this.onSpeak(speech);
        this.safeOpenUrl(callUrl, `Call (${contact.name})`);
        return true;
      }

      case 'email': {
        const { text } = action;
        const mailUrl = `mailto:?body=${encodeURIComponent(text)}`;
        const speech = 'Opening email.';
        this.onSpeak(speech);
        this.safeOpenUrl(mailUrl, 'Email Draft');
        return true;
      }

      default:
        return false;
    }
  }
}
