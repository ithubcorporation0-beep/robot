import { RobotScene } from './robot.js';
import { FakeTerminal } from './terminal.js';
import { StringsRenderer } from './strings.js';
import { HandTracker } from './handTracker.js';
import { sound } from './sound.js';

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

// Initialize Core Subsystems
const robot = new RobotScene(robotContainer);
const terminal = new FakeTerminal(terminalLogs, termLineCount);
const strings = new StringsRenderer(stringsCanvas);

let currentState = 'IDLE';

function setCameraUI(isActive) {
  if (isActive) {
    camPromptOverlay.classList.add('hidden');
    camPromptOverlay.style.display = 'none';
    cameraToggleBtn.innerHTML = `<span class="btn-icon">⏹</span><span class="btn-text">STOP CAMERA</span>`;
    if (camStatusChip) {
      camStatusChip.innerHTML = `<span class="chip-dot glow-green"></span>WEBCAM ACTIVE`;
    }
  } else {
    camPromptOverlay.classList.remove('hidden');
    camPromptOverlay.style.display = 'flex';
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
  onTrackingUpdate: (info) => {
    if (info.handDetected) {
      if (camStatusChip) {
        camStatusChip.innerHTML = `<span class="chip-dot glow-green"></span>HAND TRACKED`;
      }
    } else {
      if (camStatusChip && tracker.isCameraActive) {
        camStatusChip.innerHTML = `<span class="chip-dot glow-orange"></span>SEARCHING HAND...`;
      }
    }
  }
});

// State Management
function setState(newState, gestureName) {
  if (currentState === newState && gestureName) {
    if (gestureLabel) gestureLabel.textContent = `GESTURE: ${gestureName}`;
    return;
  }

  currentState = newState;
  robot.setState(newState);
  sound.playStateChange();

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

// Camera Activation Flow
async function toggleCamera() {
  if (tracker.isCameraActive) {
    tracker.stopCamera();
    setCameraUI(false);
  } else {
    try {
      cameraToggleBtn.innerHTML = `<span class="btn-icon">⏳</span><span class="btn-text">STARTING...</span>`;
      camPromptOverlay.classList.add('hidden');
      camPromptOverlay.style.display = 'none';
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
camActivateDirectBtn.addEventListener('click', toggleCamera);

// Simulator Drawer & Buttons
simToggleBtn.addEventListener('click', () => {
  simDrawer.classList.toggle('hidden');
});

simButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const gesture = btn.getAttribute('data-gesture');
    tracker.setSimulatedGesture(gesture);
  });
});

// Sound Toggle
soundToggleBtn.addEventListener('click', () => {
  const isEnabled = sound.toggle();
  soundToggleBtn.innerHTML = `<span class="btn-icon">${isEnabled ? '🔊' : '🔇'}</span>`;
  soundToggleBtn.title = isEnabled ? 'Sound enabled' : 'Sound muted';
});

// Clear Terminal
clearTermBtn.addEventListener('click', () => {
  terminal.clear();
});

// Keyboard Shortcuts: 1, 2, 3 for Instant Gesture Testing
window.addEventListener('keydown', (e) => {
  if (e.key === '1') {
    tracker.setSimulatedGesture('OPEN_HAND');
  } else if (e.key === '2') {
    tracker.setSimulatedGesture('INDEX_UP');
  } else if (e.key === '3') {
    tracker.setSimulatedGesture('FIST');
  } else if (e.key === 'c' || e.key === 'C') {
    toggleCamera();
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

  // 1. Update Hand Tracking (runs detection if camera active, or simulated hand)
  tracker.update(currentTime);
  if (tracker.isCameraActive && camPromptOverlay.style.display !== 'none') {
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
