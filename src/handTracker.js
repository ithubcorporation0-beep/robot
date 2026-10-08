import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

export class HandTracker {
  constructor(options) {
    this.video = options.video;
    this.overlayCanvas = options.overlayCanvas;
    this.ctx = this.overlayCanvas.getContext('2d');
    this.onGestureChange = options.onGestureChange || (() => {});
    this.onTrackingUpdate = options.onTrackingUpdate || (() => {});
    this.onCameraStart = options.onCameraStart || (() => {});
    this.onCameraStop = options.onCameraStop || (() => {});
    this.onHandLost = options.onHandLost || (() => {});

    // Ensure <video> attributes are explicitly assigned for browser autoplay compatibility
    this.video.autoplay = true;
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.setAttribute('autoplay', '');
    this.video.setAttribute('muted', '');
    this.video.setAttribute('playsinline', '');

    // Listen to native playing event
    this.video.addEventListener('playing', () => {
      this.isCameraActive = true;
      this.simulatedMode = false;
      this.onCameraStart();
    });

    this.landmarker = null;
    this.isRunning = false;
    this.isCameraActive = false;
    this.simulatedMode = true; // Active until camera stream starts
    this.simulatedGesture = 'OPEN_HAND'; // 'OPEN_HAND' | 'INDEX_UP' | 'FIST' | 'NO_HAND'
    this.currentGesture = 'OPEN_HAND'; // 'OPEN_HAND' | 'INDEX_UP' | 'FIST'
    this.lastVideoTime = -1;

    // Debounce state (~300ms hold required before state changes)
    this.pendingGesture = null;
    this.pendingGestureStartTime = 0;
    this.holdDurationThreshold = 300; // 300 ms hold required
    this.detectedGesture = 'OPEN_HAND';

    // Hand detection loss tracking (1s timeout)
    this.lastHandDetectedTime = performance.now();
    this.handLostTriggered = false;

    // Light moving average filter for smoothing fingertip positions (4 samples ~60ms)
    this.fingertipHistory = [[], [], [], [], []];
    this.movingAverageWindow = 4;

    // Fingertip landmark indices per specification: 4 (Thumb), 8 (Index), 12 (Middle), 16 (Ring), 20 (Pinky)
    this.fingertipIndices = [4, 8, 12, 16, 20];
    this.fingertipsScreen = [];

    this.resizeOverlay();
    this.onResize = this.onResize.bind(this);
    window.addEventListener('resize', this.onResize);
  }

  get detectedGestureLabel() {
    if (!this.lastHandDetectedTime || this.handLostTriggered || this.detectedGesture === 'NONE' || this.detectedGesture === 'NO_HAND') {
      return 'NO HAND DETECTED';
    }
    switch (this.detectedGesture) {
      case 'INDEX_UP':
        return 'ONE INDEX FINGER UP';
      case 'FIST':
        return 'CLOSED FIST / PINCH';
      case 'OPEN_HAND':
        return 'OPEN HAND';
      default:
        return this.detectedGesture || 'OPEN HAND';
    }
  }

  smoothFingertips(rawFingertips) {
    if (!rawFingertips || rawFingertips.length === 0) {
      this.clearFingertipHistory();
      return [];
    }

    return rawFingertips.map((pt, i) => {
      if (!this.fingertipHistory[i]) {
        this.fingertipHistory[i] = [];
      }
      const hist = this.fingertipHistory[i];
      hist.push({ x: pt.x, y: pt.y });
      if (hist.length > this.movingAverageWindow) {
        hist.shift();
      }

      let sumX = 0;
      let sumY = 0;
      for (let j = 0; j < hist.length; j++) {
        sumX += hist[j].x;
        sumY += hist[j].y;
      }

      return {
        x: sumX / hist.length,
        y: sumY / hist.length,
        landmarkIndex: pt.landmarkIndex
      };
    });
  }

  clearFingertipHistory() {
    this.fingertipHistory = [[], [], [], [], []];
  }

  getVideoRect() {
    if (this.video && typeof this.video.getBoundingClientRect === 'function') {
      const rect = this.video.getBoundingClientRect();
      if (rect.width > 20 && rect.height > 20) {
        return rect;
      }
    }
    // Invisible camera fallback: anchor to standard corner region
    const boxW = 240;
    const boxH = 180;
    const isReel = typeof document !== 'undefined' && document.getElementById('app')?.classList.contains('reel-mode');
    const screenW = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const screenH = typeof window !== 'undefined' ? window.innerHeight : 720;
    const left = isReel ? screenW - boxW - 20 : screenW - boxW - 24;
    const top = isReel ? 90 : screenH - boxH - 24;
    return {
      left,
      top,
      width: boxW,
      height: boxH
    };
  }

  resizeOverlay() {
    const rect = this.getVideoRect();
    if (rect.width && rect.height) {
      this.overlayCanvas.width = rect.width;
      this.overlayCanvas.height = rect.height;
    }
  }

  onResize() {
    this.resizeOverlay();
  }

  async initMediaPipe() {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      const modelPath = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

      try {
        this.landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: modelPath,
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          numHands: 1
        });
      } catch (gpuErr) {
        console.warn('GPU delegate failed, falling back to CPU delegate', gpuErr);
        this.landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: modelPath,
            delegate: 'CPU'
          },
          runningMode: 'VIDEO',
          numHands: 1
        });
      }

      console.log('[MediaPipe] HandLandmarker initialized successfully');
      return true;
    } catch (error) {
      console.error('[MediaPipe] Initialization error:', error);
      return false;
    }
  }

  async startCamera() {
    try {
      if (!this.landmarker) {
        const ok = await this.initMediaPipe();
        if (!ok) {
          throw new Error('Failed to load MediaPipe model');
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      });

      this.video.srcObject = stream;
      try {
        await this.video.play();
      } catch (playErr) {
        console.warn('Initial video.play() warning:', playErr);
      }

      this.isCameraActive = true;
      this.simulatedMode = false;
      this.resizeOverlay();
      this.onCameraStart();

      return true;
    } catch (err) {
      console.error('Camera access error:', err);
      this.isCameraActive = false;
      this.simulatedMode = true;
      this.onCameraStop();
      throw err;
    }
  }

  stopCamera() {
    if (this.video.srcObject) {
      const tracks = this.video.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      this.video.srcObject = null;
    }
    this.isCameraActive = false;
    this.simulatedMode = true;
    this.onCameraStop();
  }

  setSimulatedGesture(gesture) {
    this.simulatedGesture = gesture;
    const now = performance.now();
    if (gesture === 'NO_HAND') {
      this.detectedGesture = 'NONE';
      this.fingertipsScreen = [];
      this.clearFingertipHistory();
      this.lastHandDetectedTime = now;
      this.handLostTriggered = false;
    } else {
      this.lastHandDetectedTime = now;
      this.handLostTriggered = false;
      this.debounceGesture(gesture, now);
    }
  }

  checkHandLostTimeout(now) {
    const elapsed = now - this.lastHandDetectedTime;
    if (elapsed >= 1000 && !this.handLostTriggered) {
      this.handLostTriggered = true;
      this.currentGesture = 'OPEN_HAND';
      this.pendingGesture = null;
      this.pendingGestureStartTime = 0;
      this.detectedGesture = 'NONE';
      this.onGestureChange('IDLE', 'OPEN HAND');
      if (this.onHandLost) this.onHandLost();
    }
  }

  update(timestamp) {
    const now = typeof timestamp === 'number' && timestamp > 0 ? timestamp : performance.now();
    this.resizeOverlay();
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

    if (this.isCameraActive && this.landmarker && this.video.readyState >= 2) {
      if (this.video.currentTime !== this.lastVideoTime) {
        this.lastVideoTime = this.video.currentTime;
        const results = this.landmarker.detectForVideo(this.video, now);

        if (results && results.landmarks && results.landmarks.length > 0) {
          const landmarks = results.landmarks[0];
          this.lastHandDetectedTime = now;
          this.handLostTriggered = false;
          this.processLandmarks(landmarks, now);
          this.drawCameraOverlay(landmarks);
          return;
        }
      }
    }

    // Fallback: When camera has no hand or in simulator mode
    if (this.simulatedMode) {
      if (this.simulatedGesture === 'NO_HAND') {
        this.fingertipsScreen = [];
        this.clearFingertipHistory();
        this.detectedGesture = 'NONE';
        this.checkHandLostTimeout(now);
        this.onTrackingUpdate({
          handDetected: false,
          fingertips: [],
          gesture: 'NONE',
          detectedLabel: 'NO HAND DETECTED'
        });
      } else {
        this.lastHandDetectedTime = now;
        this.handLostTriggered = false;
        this.generateSimulatedHand(now);
      }
    } else {
      // Camera active but no hand in frame
      this.fingertipsScreen = [];
      this.clearFingertipHistory();
      this.detectedGesture = 'NONE';
      this.checkHandLostTimeout(now);
      this.onTrackingUpdate({
        handDetected: false,
        fingertips: [],
        gesture: 'NONE',
        detectedLabel: 'NO HAND DETECTED'
      });
    }
  }

  processLandmarks(landmarks, timestamp) {
    const videoRect = this.getVideoRect();

    // 1. Compute Raw Screen Coordinates for the 5 Fingertips (Mirrored)
    // Mirrored display: X = 1.0 - landmark.x
    const rawFingertips = this.fingertipIndices.map(idx => {
      const lm = landmarks[idx];
      return {
        x: videoRect.left + (1.0 - lm.x) * videoRect.width,
        y: videoRect.top + lm.y * videoRect.height,
        landmarkIndex: idx
      };
    });

    // Smooth fingertip positions with a light moving average across frames
    this.fingertipsScreen = this.smoothFingertips(rawFingertips);

    // 2. Classify Gesture and require continuous ~300ms hold before state change
    const gesture = this.classifyGesture(landmarks);
    this.debounceGesture(gesture, timestamp);

    this.onTrackingUpdate({
      handDetected: true,
      fingertips: this.fingertipsScreen,
      rawLandmarks: landmarks,
      gesture: this.currentGesture,
      detectedGesture: this.detectedGesture,
      detectedLabel: this.detectedGestureLabel
    });
  }

  classifyGesture(lm) {
    const dist = (p1, p2) => {
      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;
      const dz = (p1.z || 0) - (p2.z || 0);
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    };

    const wrist = lm[0];

    // Check Pinch between Thumb Tip (4) and Index Tip (8)
    const pinchDist = dist(lm[4], lm[8]);

    // Check extension for fingers 1..4 (Index, Middle, Ring, Pinky)
    // A finger is extended if tip is further from wrist than PIP joint
    const isIndexExtended = dist(lm[8], wrist) > dist(lm[6], wrist) * 1.15;
    const isMiddleExtended = dist(lm[12], wrist) > dist(lm[10], wrist) * 1.15;
    const isRingExtended = dist(lm[16], wrist) > dist(lm[14], wrist) * 1.15;
    const isPinkyExtended = dist(lm[20], wrist) > dist(lm[18], wrist) * 1.15;

    // Check Closed Fist: All 4 main fingers folded
    if (!isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
      return 'FIST'; // Closed fist triggers HEAVY LIFTING
    }

    // Check Pinch between Thumb and Index while other fingers folded
    if (pinchDist < 0.08 && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
      return 'FIST'; // Pinch triggers HEAVY LIFTING
    }

    // Check One Index Finger Up: Only index extended, others folded
    if (isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
      return 'INDEX_UP'; // One index finger up triggers GENERATING NEW IDEA
    }

    // Check Open Hand: All fingers extended
    if (isIndexExtended && isMiddleExtended && isRingExtended && isPinkyExtended) {
      return 'OPEN_HAND'; // Open hand triggers IDLE
    }

    // Fallback: if mostly open, IDLE
    if (isMiddleExtended && isRingExtended) {
      return 'OPEN_HAND';
    }

    return 'OPEN_HAND';
  }

  debounceGesture(rawGesture, timestamp) {
    const now = typeof timestamp === 'number' && timestamp > 0 ? timestamp : performance.now();
    this.detectedGesture = rawGesture;

    // If candidate gesture is already the committed gesture, reset pending hold timer
    if (rawGesture === this.currentGesture) {
      this.pendingGesture = null;
      this.pendingGestureStartTime = 0;
      return;
    }

    // If new candidate gesture was detected, start continuous hold timer
    if (rawGesture !== this.pendingGesture) {
      this.pendingGesture = rawGesture;
      this.pendingGestureStartTime = now;
    } else {
      // Gesture held continuously
      const heldTime = now - this.pendingGestureStartTime;
      if (heldTime >= this.holdDurationThreshold) { // 300 ms hold required
        this.currentGesture = rawGesture;
        this.pendingGesture = null;
        this.pendingGestureStartTime = 0;
        this.processDetectedGesture(rawGesture);
      }
    }
  }

  processDetectedGesture(gesture) {
    let state = 'IDLE';
    let label = 'OPEN HAND';

    if (gesture === 'INDEX_UP') {
      state = 'IDEA';
      label = 'ONE INDEX FINGER UP';
    } else if (gesture === 'FIST') {
      state = 'LIFTING';
      label = 'CLOSED FIST / PINCH';
    }

    this.onGestureChange(state, label);
  }

  drawCameraOverlay(landmarks) {
    const ctx = this.ctx;
    const w = this.overlayCanvas.width;
    const h = this.overlayCanvas.height;
    const videoRect = this.video.getBoundingClientRect();

    // Draw subtle skeleton connections
    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
      [0, 5], [5, 6], [6, 7], [7, 8],       // Index
      [0, 9], [9, 10], [10, 11], [11, 12],  // Middle
      [0, 13], [13, 14], [14, 15], [15, 16],// Ring
      [0, 17], [17, 18], [18, 19], [19, 20],// Pinky
      [5, 9], [9, 13], [13, 17]             // Palm base
    ];

    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.35)';

    connections.forEach(([i, j]) => {
      const p1 = landmarks[i];
      const p2 = landmarks[j];
      ctx.beginPath();
      ctx.moveTo((1.0 - p1.x) * w, p1.y * h);
      ctx.lineTo((1.0 - p2.x) * w, p2.y * h);
      ctx.stroke();
    });

    // Draw the White Dots on the 5 Fingertips using smoothed positions
    this.fingertipIndices.forEach((idx, i) => {
      let x, y;
      if (this.fingertipsScreen && this.fingertipsScreen[i]) {
        x = this.fingertipsScreen[i].x - videoRect.left;
        y = this.fingertipsScreen[i].y - videoRect.top;
      } else {
        const lm = landmarks[idx];
        x = (1.0 - lm.x) * w;
        y = lm.y * h;
      }

      // Outer glowing ring
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 119, 0, 0.4)';
      ctx.fill();

      // Bright white fingertip dot
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 8;
      ctx.fill();

      // Fine border
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.strokeStyle = '#ff7700';
      ctx.lineWidth = 1.2;
      ctx.shadowBlur = 0;
      ctx.stroke();
    });

    ctx.restore();
  }

  generateSimulatedHand(timestamp) {
    const ctx = this.ctx;
    const w = this.overlayCanvas.width || 250;
    const h = this.overlayCanvas.height || 180;
    const videoRect = this.getVideoRect();
    const time = timestamp / 1000;

    // Center base of simulated palm in corner box
    const cx = w * 0.5 + Math.sin(time * 1.5) * 6;
    const cy = h * 0.65 + Math.cos(time * 1.2) * 5;

    // Define simulated 5 fingertip offsets based on active simulated gesture
    let offsets = [];

    if (this.simulatedGesture === 'OPEN_HAND') {
      // 5 extended fingers
      offsets = [
        { dx: -45, dy: -25 }, // Thumb
        { dx: -22, dy: -58 }, // Index
        { dx: 0,   dy: -65 }, // Middle
        { dx: 22,  dy: -56 }, // Ring
        { dx: 42,  dy: -35 }  // Pinky
      ];
    } else if (this.simulatedGesture === 'INDEX_UP') {
      // Only Index extended high, others folded
      offsets = [
        { dx: -18, dy: -8 },  // Thumb folded
        { dx: -10, dy: -70 }, // Index extended high
        { dx: 8,   dy: -12 }, // Middle folded
        { dx: 22,  dy: -10 }, // Ring folded
        { dx: 34,  dy: -6 }   // Pinky folded
      ];
    } else if (this.simulatedGesture === 'FIST') {
      // Closed fist / pinch
      offsets = [
        { dx: -12, dy: -18 }, // Thumb tucked
        { dx: -8,  dy: -20 }, // Index tucked (pinch proximity)
        { dx: 6,   dy: -18 }, // Middle curled
        { dx: 18,  dy: -16 }, // Ring curled
        { dx: 26,  dy: -12 }  // Pinky curled
      ];
    }

    // Draw simulated palm lines on corner canvas
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';

    offsets.forEach(pt => {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + pt.dx, cy + pt.dy);
      ctx.stroke();
    });

    // Draw palm center
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 229, 255, 0.3)';
    ctx.fill();

    // Raw fingertip positions
    const rawFingertips = offsets.map((pt, i) => {
      const tipX = cx + pt.dx;
      const tipY = cy + pt.dy;

      // Draw white dots on corner canvas
      ctx.beginPath();
      ctx.arc(tipX, tipY, 7, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 119, 0, 0.35)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(tipX, tipY, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 8;
      ctx.fill();

      return {
        x: videoRect.left + tipX,
        y: videoRect.top + tipY,
        landmarkIndex: this.fingertipIndices[i]
      };
    });

    // Smooth fingertip positions with moving average
    this.fingertipsScreen = this.smoothFingertips(rawFingertips);

    // Apply debounce with hold time
    this.debounceGesture(this.simulatedGesture, timestamp);

    ctx.restore();

    this.onTrackingUpdate({
      handDetected: true,
      fingertips: this.fingertipsScreen,
      gesture: this.currentGesture,
      detectedGesture: this.detectedGesture,
      detectedLabel: this.detectedGestureLabel
    });
  }

  destroy() {
    this.stopCamera();
    window.removeEventListener('resize', this.onResize);
  }
}
