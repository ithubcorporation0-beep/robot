import { sound } from './sound.js';

export class FakeTerminal {
  constructor(logsContainer, lineCountElement, options = {}) {
    this.logsContainer = logsContainer;
    this.lineCountElement = lineCountElement;
    this.onIdea = options.onIdea || (() => {});
    this.onLiftingDone = options.onLiftingDone || (() => {});
    this.lines = [];
    this.ideaCounter = 13;
    this.liftingStep = 0;
    this.idleIndex = 0;
    this.lastIdeaTime = 0;
    this.lastLiftingTime = 0;
    this.lastIdleTime = 0;
    this.lastState = 'IDLE';
    this.liftingPendingDone = null;

    // Typewriter Queue & Animation State
    this.typewriterQueue = [];
    this.isTyping = false;
    this.currentLineEl = null;
    this.currentCursorEl = null;

    // 12 Believable, High-Impact Architecture Ideas (IDEA state)
    this.ideasPool = [
      "recursive autonomous subagents running on edge wasm",
      "tactile telemetry strings with haptic force feedback",
      "zero-latency holographic shadow puppetry",
      "synaptic memory transfer between agent swarms",
      "predictive kinematic forecasting using temporal transformers",
      "bi-directional brain-computer marionette interfaces",
      "self-assembling low-poly automata in latent space",
      "neural fiber-optic tendons with variable tensile elasticity",
      "automated test synthesis via symbolic execution traces",
      "multi-turn tree-of-thought exploration with heuristic pruning",
      "continuous self-healing refactoring pipeline for ASTs",
      "zero-shot cross-modal gesture synthesis from speech tokens"
    ];

    // 10 Believable Heavy-Lifting Backend Tasks (LIFTING state)
    this.liftingTasks = [
      { task: "migrate memory store (96GB)", done: "done - 512 batches in 5.2s" },
      { task: "repartition distributed vector indices [shard 0..63]", done: "done - 1,024,000 vectors aligned in 3.1s" },
      { task: "garbage collect orphaned model weights (142GB)", done: "done - memory pressure reduced to 18%" },
      { task: "compile fused CUDA kernels for attention tensors", done: "done - latency reduced by 4.8ms" },
      { task: "snapshot state machine to cold storage cluster", done: "done - 4 replicas verified, checksum matched" },
      { task: "decompress embedding space cache (64GB)", done: "done - 8,192 tensors ready" },
      { task: "rebuild AST dependency graph for 240,000 source files", done: "done - cross-references resolved in 2.9s" },
      { task: "quantize diffusion backbone weights to FP8", done: "done - inference throughput increased 2.4x" },
      { task: "synchronize neural weights across 8 worker GPUs", done: "done - gradient sync complete in 180ms" },
      { task: "prune dead paths in Monte Carlo execution tree", done: "done - 45,000 subgraphs optimized" }
    ];

    // 12 Believable Heartbeat & System Logs (IDLE state)
    this.idleLinesPool = [
      "[idle] telemetry heartbeat: marionette balance 99.8%",
      "[idle] background daemon: waiting for gesture trigger",
      "[idle] kinematic tension: 5-finger tendons taut, zero slippage",
      "[idle] edge model: inference loop steady at 60 fps (latency: 1.2ms)",
      "[idle] context memory: 128k working tokens cached in VRAM",
      "[idle] git watcher: clean working tree on branch main",
      "[idle] ast index: 14,290 nodes mapped in syntax graph",
      "[idle] neural marionette: idle breath oscillations calibrated",
      "[idle] ready: listening for next user instruction",
      "[idle] garbage collector: heap stable at 42.1MB / 512MB",
      "[idle] security scanner: 0 vulnerabilities found in dependency graph",
      "[idle] agent supervisor: health checks nominal on all workers"
    ];

    // Initial sequence
    this.init();
  }

  init() {
    this.appendLine("agent --watch", "cmd-prompt");
    this.appendLine("[ok] hand tracked", "ok-line");
    this.appendLine("[ok] neural marionette v1.4.0 active on tty0", "ok-line");
    this.appendLine("[ok] 5-finger kinematics mapped to 3D armature", "ok-line");
    this.appendLine("------------------------------------------------------------", "idle-line");
  }

  // Color Classifier helper:
  // [ok] -> green (.ok-line)
  // [warn] -> yellow (.warn-line)
  // lifting / done - -> orange (.lifting-line)
  // IDEA -> cyan (.idea-line)
  classifyLine(text, explicitClass) {
    if (explicitClass === 'cmd-prompt') return 'cmd-prompt';
    if (explicitClass === 'warn-line') return 'warn-line';

    const lower = text.toLowerCase();
    if (text.includes('[ok]')) return 'ok-line';
    if (text.includes('[warn]')) return 'warn-line';
    if (text.includes('[user]')) return 'user-line';
    if (text.includes('[agent]')) return 'agent-line';
    if (lower.includes('lifting') || lower.startsWith('done -') || lower.includes('[lifting]')) {
      return 'lifting-line';
    }
    if (text.includes('IDEA') || lower.includes('[idea]')) return 'idea-line';
    if (lower.includes('[idle]')) return 'idle-line';

    return explicitClass || 'idle-line';
  }

  appendLine(text, className = "idle-line") {
    const finalClass = this.classifyLine(text, className);
    this.lines.push(text);

    if (this.lineCountElement) {
      this.lineCountElement.textContent = this.lines.length;
    }

    // Format full text with timestamp or prompt
    const now = new Date();
    const ts = `[${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(Math.floor(now.getMilliseconds() / 100))}]`;

    const fullText = (finalClass === "cmd-prompt") ? `agent@puppet:~$ ${text}` : `${ts} ${text}`;

    // Detect if text contains Urdu/Pashto/Arabic script (RTL)
    const isRtl = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);

    // Queue for typewriter animation
    this.typewriterQueue.push({
      fullText,
      className: finalClass,
      isRtl
    });

    if (!this.isTyping) {
      this.processTypewriterQueue();
    }
  }

  processTypewriterQueue() {
    if (this.typewriterQueue.length === 0) {
      this.isTyping = false;
      return;
    }

    this.isTyping = true;
    const item = this.typewriterQueue.shift();

    // Create line container in DOM
    const lineEl = document.createElement("div");
    lineEl.className = `term-line ${item.className}${item.isRtl ? ' rtl-line' : ''}`;
    if (item.isRtl) {
      lineEl.setAttribute('dir', 'rtl');
    }

    const textSpan = document.createElement("span");
    textSpan.className = "term-text";
    lineEl.appendChild(textSpan);

    const cursorSpan = document.createElement("span");
    cursorSpan.className = "term-typewriter-cursor";
    cursorSpan.textContent = "▌";
    lineEl.appendChild(cursorSpan);

    this.logsContainer.appendChild(lineEl);

    // Limit buffer to 200 lines to preserve DOM performance
    while (this.logsContainer.children.length > 200) {
      this.logsContainer.removeChild(this.logsContainer.firstChild);
    }

    this.autoScroll();

    // Typewriter speed: accelerate when queue is building up
    const queueLen = this.typewriterQueue.length;
    const charDelay = queueLen > 4 ? 3 : queueLen > 1 ? 8 : 14;

    let charIndex = 0;
    const textToType = item.fullText;

    const typeNextChar = () => {
      // Chunk typing if backlog is large to prevent latency lag
      const charsPerTick = queueLen > 5 ? 4 : queueLen > 2 ? 2 : 1;
      const nextSlice = textToType.slice(charIndex, charIndex + charsPerTick);
      charIndex += charsPerTick;

      textSpan.textContent += nextSlice;
      this.autoScroll();

      if (charIndex < textToType.length) {
        setTimeout(typeNextChar, charDelay);
      } else {
        // Line completed: remove inline cursor and start next line
        if (cursorSpan.parentNode) {
          cursorSpan.remove();
        }
        this.autoScroll();
        const nextDelay = queueLen > 2 ? 20 : 60;
        setTimeout(() => this.processTypewriterQueue(), nextDelay);
      }
    };

    typeNextChar();
  }

  autoScroll() {
    const screen = this.logsContainer.parentElement;
    if (screen) {
      screen.scrollTop = screen.scrollHeight;
    }
  }

  clear() {
    this.typewriterQueue = [];
    this.isTyping = false;
    this.logsContainer.innerHTML = "";
    this.lines = [];
    this.appendLine("agent --watch", "cmd-prompt");
    this.appendLine("[ok] terminal buffer reset", "ok-line");
    this.appendLine("[ok] live telemetry streaming re-engaged", "ok-line");
  }

  update(state, currentTime) {
    // 0. State Transition Log Triggers
    if (state !== this.lastState) {
      if (state === 'IDEA') {
        this.appendLine("[ok] state transition -> GENERATING NEW IDEA (index finger up)", "ok-line");
      } else if (state === 'LIFTING') {
        this.appendLine("lifting: state transition -> HEAVY LIFTING (fist / pinch)", "lifting-line");
      } else if (state === 'IDLE') {
        this.appendLine("[ok] state transition -> IDLE (open hand)", "ok-line");
      }
      this.lastState = state;
    }

    // 1. GENERATING NEW IDEA (Index Finger Up)
    if (state === 'IDEA') {
      // Print an idea every 2.0s while held
      if (currentTime - this.lastIdeaTime > 2000) {
        this.lastIdeaTime = currentTime;
        const ideaText = this.ideasPool[this.ideaCounter % this.ideasPool.length];
        this.appendLine(`IDEA ${this.ideaCounter}: ${ideaText}`, "idea-line");
        sound.playIdea();
        if (this.onIdea) this.onIdea(ideaText);
        this.ideaCounter++;
      }
    }

    // 2. HEAVY LIFTING (Fist or Pinch)
    else if (state === 'LIFTING') {
      // Check if we need to emit the pending "done" line
      if (this.liftingPendingDone && currentTime >= this.liftingPendingDone.dueAt) {
        this.appendLine(this.liftingPendingDone.text, "lifting-line");
        if (this.onLiftingDone) this.onLiftingDone();
        this.liftingPendingDone = null;
      }

      // Schedule next heavy lifting task every 3.0s
      if (!this.liftingPendingDone && currentTime - this.lastLiftingTime > 3000) {
        this.lastLiftingTime = currentTime;
        const item = this.liftingTasks[this.liftingStep % this.liftingTasks.length];
        this.liftingStep++;

        this.appendLine(`lifting: ${item.task}`, "lifting-line");
        sound.playLifting();

        // Schedule the "done - ..." line shortly after (e.g., 1.2s)
        this.liftingPendingDone = {
          text: item.done,
          dueAt: currentTime + 1200
        };
      }
    }

    // 3. IDLE (Open Hand)
    else if (state === 'IDLE') {
      // Resolve any pending lifting task if state switched
      if (this.liftingPendingDone && currentTime >= this.liftingPendingDone.dueAt) {
        this.appendLine(this.liftingPendingDone.text, "lifting-line");
        if (this.onLiftingDone) this.onLiftingDone();
        this.liftingPendingDone = null;
      }

      // Periodic gentle heartbeat log every 3.5 seconds
      if (currentTime - this.lastIdleTime > 3500) {
        this.lastIdleTime = currentTime;
        const hb = this.idleLinesPool[this.idleIndex % this.idleLinesPool.length];
        this.idleIndex++;
        this.appendLine(hb, "idle-line");
      }
    }
  }
}
