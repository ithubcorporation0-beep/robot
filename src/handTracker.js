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
    this.simulatedGesture = 'OPEN_HAND'; // 'OPEN_HAND' | 'INDEX_UP' | 'FIST'
    this.currentGesture = 'OPEN_HAND'; // 'OPEN_HAND' | 'INDEX_UP' | 'FIST'
    this.lastVideoTime = -1;
    this.gestureDebounceCounter = 0;
    this.pendingGesture = null;

    // Fingertip landmark indices per specification: 4 (Thumb), 8 (Index), 12 (Middle), 16 (Ring), 20 (Pinky)
    this.fingertipIndices = [4, 8, 12, 16, 20];
    this.fingertipsScreen = [];

    this.resizeOverlay();
    this.onResize = this.onResize.bind(this);
    window.addEventListener('resize', this.onResize);
  }

  resizeOverlay() {
    const rect = this.video.getBoundingClientRect();
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
    this.processDetectedGesture(gesture);
  }

  update(timestamp) {
    this.resizeOverlay();
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

    if (this.isCameraActive && this.landmarker && this.video.readyState >= 2) {
      if (this.video.currentTime !== this.lastVideoTime) {
        this.lastVideoTime = this.video.currentTime;
        const results = this.landmarker.detectForVideo(this.video, timestamp);

        if (results && results.landmarks && results.landmarks.length > 0) {
          const landmarks = results.landmarks[0];
          this.processLandmarks(landmarks);
          this.drawCameraOverlay(landmarks);
          return;
        }
      }
    }

    // Fallback: When camera has no hand or in simulator mode
    if (this.simulatedMode) {
      this.generateSimulatedHand(timestamp);
    } else {
      // Camera active but no hand in frame
      this.fingertipsScreen = [];
      this.onTrackingUpdate({ handDetected: false, fingertips: [] });
    }
  }

  processLandmarks(landmarks) {
    const videoRect = this.video.getBoundingClientRect();

    // 1. Compute Screen Coordinates for the 5 Fingertips (Mirrored)
    // Mirrored display: X = 1.0 - landmark.x
    this.fingertipsScreen = this.fingertipIndices.map(idx => {
      const lm = landmarks[idx];
      return {
        x: videoRect.left + (1.0 - lm.x) * videoRect.width,
        y: videoRect.top + lm.y * videoRect.height,
        landmarkIndex: idx
      };
    });

    // 2. Classify Gesture according to Rules:
    // - Open hand (all fingers extended) = IDLE
    // - One index finger up = GENERATING NEW IDEA
    // - Closed fist or pinch = HEAVY LIFTING
    const gesture = this.classifyGesture(landmarks);
    this.debounceGesture(gesture);

    this.onTrackingUpdate({
      handDetected: true,
      fingertips: this.fingertipsScreen,
      rawLandmarks: landmarks,
      gesture: this.currentGesture
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
    if (pinchDist < 0.08) {
      return 'FIST'; // Pinch triggers HEAVY LIFTING
    }

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

  debounceGesture(newGesture) {
    if (newGesture === this.currentGesture) {
      this.pendingGesture = null;
      this.gestureDebounceCounter = 0;
      return;
    }

    if (newGesture === this.pendingGesture) {
      this.gestureDebounceCounter++;
      if (this.gestureDebounceCounter >= 3) { // 3 consecutive frames
        this.currentGesture = newGesture;
        this.processDetectedGesture(newGesture);
      }
    } else {
      this.pendingGesture = newGesture;
      this.gestureDebounceCounter = 1;
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

    // Draw the White Dots on the 5 Fingertips (4, 8, 12, 16, 20) per specification
    this.fingertipIndices.forEach((idx, i) => {
      const lm = landmarks[idx];
      const x = (1.0 - lm.x) * w;
      const y = lm.y * h;

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
    const videoRect = this.video.getBoundingClientRect();
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

    // Map to screen coordinates and draw white dots
    this.fingertipsScreen = offsets.map((pt, i) => {
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

    ctx.restore();

    this.onTrackingUpdate({
      handDetected: true,
      fingertips: this.fingertipsScreen,
      gesture: this.simulatedGesture
    });
  }

  destroy() {
    this.stopCamera();
    window.removeEventListener('resize', this.onResize);
  }
}
