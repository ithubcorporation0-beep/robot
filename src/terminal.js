import { sound } from './sound.js';

export class FakeTerminal {
  constructor(logsContainer, lineCountElement) {
    this.logsContainer = logsContainer;
    this.lineCountElement = lineCountElement;
    this.lines = [];
    this.ideaCounter = 13;
    this.liftingStep = 0;
    this.lastIdeaTime = 0;
    this.lastLiftingTime = 0;
    this.lastIdleTime = 0;
    this.liftingPendingDone = null;

    this.ideasPool = [
      "puppets that dream when idle",
      "recursive autonomous subagents running on edge wasm",
      "tactile telemetry strings with haptic force feedback",
      "zero-latency holographic shadow puppetry",
      "synaptic memory transfer between agent swarms",
      "quantum superposition of marionette kinematics",
      "neural fiber-optic tendons with variable tensile elasticity",
      "distributed puppet clusters coordinated via p2p gossip",
      "predictive kinematic forecasting using temporal transformers",
      "self-assembling low-poly automata in latent space",
      "sub-millisecond hand tracking on micro-controllers",
      "infinite multi-agent sandbox with procedural gravity",
      "bi-directional brain-computer marionette interfaces"
    ];

    this.liftingTasks = [
      { task: "migrate memory store (96GB)", done: "done - 512 batches in 5.2s" },
      { task: "repartition distributed vector indices [shard 0..63]", done: "done - 1,024,000 vectors aligned in 3.1s" },
      { task: "garbage collect orphaned model weights (142GB)", done: "done - memory pressure reduced to 18%" },
      { task: "compile fused CUDA kernels for attention tensors", done: "done - latency reduced by 4.8ms" },
      { task: "snapshot state machine to cold storage cluster", done: "done - 4 replicas verified, checksum matched" },
      { task: "decompress embedding space cache (64GB)", done: "done - 8,192 tensors ready" }
    ];

    // Initial sequence required by specification
    this.init();
  }

  init() {
    this.appendLine("agent --watch", "cmd-prompt");
    this.appendLine("[ok] hand tracked", "system-ok");
    this.appendLine("[system] neural marionette v1.4.0 active on tty0", "system-ok");
    this.appendLine("[system] ready: 5-finger kinematics mapped to 3D armature", "idle-line");
    this.appendLine("------------------------------------------------------------", "idle-line");
  }

  appendLine(text, className = "idle-line") {
    const lineEl = document.createElement("div");
    lineEl.className = `term-line ${className}`;

    // Add current timestamp
    const now = new Date();
    const ts = `[${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(Math.floor(now.getMilliseconds() / 100))}]`;
    
    if (className === "cmd-prompt") {
      lineEl.textContent = `agent@puppet:~$ ${text}`;
    } else {
      lineEl.textContent = `${ts} ${text}`;
    }

    this.logsContainer.appendChild(lineEl);
    this.lines.push(text);

    // Limit buffer to 200 lines to preserve DOM performance
    if (this.logsContainer.children.length > 200) {
      this.logsContainer.removeChild(this.logsContainer.firstChild);
    }

    // Auto-scroll to bottom
    const screen = this.logsContainer.parentElement;
    if (screen) {
      screen.scrollTop = screen.scrollHeight;
    }

    if (this.lineCountElement) {
      this.lineCountElement.textContent = this.lines.length;
    }
  }

  clear() {
    this.logsContainer.innerHTML = "";
    this.lines = [];
    this.appendLine("agent --watch", "cmd-prompt");
    this.appendLine("[ok] hand tracked", "system-ok");
  }

  update(state, currentTime) {
    // 1. GENERATING NEW IDEA (Index Finger Up)
    if (state === 'IDEA') {
      // Print an idea every 2.0s while held
      if (currentTime - this.lastIdeaTime > 2000) {
        this.lastIdeaTime = currentTime;
        const ideaText = this.ideasPool[this.ideaCounter % this.ideasPool.length];
        this.appendLine(`IDEA ${this.ideaCounter}: ${ideaText}`, "idea-line");
        sound.playIdea();
        this.ideaCounter++;
      }
    }

    // 2. HEAVY LIFTING (Fist or Pinch)
    else if (state === 'LIFTING') {
      // Check if we need to emit the pending "done" line
      if (this.liftingPendingDone && currentTime >= this.liftingPendingDone.dueAt) {
        this.appendLine(this.liftingPendingDone.text, "lifting-done");
        this.liftingPendingDone = null;
      }

      // Schedule next heavy lifting task every 3.2s
      if (!this.liftingPendingDone && currentTime - this.lastLiftingTime > 3200) {
        this.lastLiftingTime = currentTime;
        const item = this.liftingTasks[this.liftingStep % this.liftingTasks.length];
        this.liftingStep++;

        this.appendLine(`lifting: ${item.task}`, "lifting-start");
        sound.playLifting();

        // Schedule the "done - ..." line shortly after (e.g., 1.4s)
        this.liftingPendingDone = {
          text: item.done,
          dueAt: currentTime + 1400
        };
      }
    }

    // 3. IDLE (Open Hand)
    else if (state === 'IDLE') {
      // Resolve any pending lifting task if state switched
      if (this.liftingPendingDone && currentTime >= this.liftingPendingDone.dueAt) {
        this.appendLine(this.liftingPendingDone.text, "lifting-done");
        this.liftingPendingDone = null;
      }

      // Periodic gentle heartbeat log every 5 seconds
      if (currentTime - this.lastIdleTime > 5000) {
        this.lastIdleTime = currentTime;
        const heartbeats = [
          "[idle] telemetry heartbeat: marionette balance 99.8%",
          "[idle] background daemon: waiting for gesture trigger",
          "[idle] kinematic tension: strings taut, zero slippage",
          "[idle] edge model: inference loop steady (60 fps)"
        ];
        const hb = heartbeats[Math.floor(Math.random() * heartbeats.length)];
        this.appendLine(hb, "idle-line");
      }
    }
  }
}
