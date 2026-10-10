import * as THREE from 'three';

// 4 Simple Avatar States
// READY (slow breathing, soft cyan visor)
// LISTENING (visor glows cyan, attentive stance)
// THINKING (visor pulses orange, subtle tilt)
// SPEAKING (visor flashes with speech, rhythmic head nod)

const STATE_VISOR_COLORS = {
  READY: new THREE.Color(0x00e5ff),
  LISTENING: new THREE.Color(0x00ffff),
  THINKING: new THREE.Color(0xff7b00),
  SPEAKING: new THREE.Color(0x00e5ff)
};

export class RobotScene {
  constructor(containerElement) {
    this.container = containerElement;
    this.state = 'READY'; // 'READY' | 'LISTENING' | 'THINKING' | 'SPEAKING'
    this.clock = new THREE.Clock();

    const initialWidth = Math.max(this.container.clientWidth || 0, 320);
    const initialHeight = Math.max(this.container.clientHeight || 0, 320);

    // Three.js Scene & Camera centered for avatar presentation
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(36, initialWidth / initialHeight, 0.1, 50);
    this.camera.position.set(0, 1.45, 5.8);
    this.camera.lookAt(0, 1.25, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(initialWidth, initialHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.setupLighting();
    this.setupMaterials();
    this.buildRobot();
    this.buildPlatform();

    this.currentColor = STATE_VISOR_COLORS.READY.clone();
    this.targetColor = STATE_VISOR_COLORS.READY.clone();
    this.currentEmissive = 2.2;

    this.onResize = this.onResize.bind(this);
    window.addEventListener('resize', this.onResize);
  }

  setupLighting() {
    // Soft ambient light
    const ambientLight = new THREE.AmbientLight(0x1a2233, 2.0);
    this.scene.add(ambientLight);

    // Key Light
    const keyLight = new THREE.DirectionalLight(0xf1f5f9, 2.8);
    keyLight.position.set(2.5, 4.5, 3.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.0005;
    this.scene.add(keyLight);

    // Soft Fill Light
    const fillLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
    fillLight.position.set(-2.5, 2.0, 3.0);
    this.scene.add(fillLight);

    // Orange Rim/Accent Light from rear
    const rimLight = new THREE.DirectionalLight(0xff7b00, 3.5);
    rimLight.position.set(-3, 3, -3);
    this.scene.add(rimLight);

    const kickLight = new THREE.DirectionalLight(0xff9922, 2.2);
    kickLight.position.set(3, 2, -2.5);
    this.scene.add(kickLight);
  }

  setupMaterials() {
    // Dark titanium alloy body
    this.matBody = new THREE.MeshStandardMaterial({
      color: 0x181c24,
      metalness: 0.88,
      roughness: 0.28
    });

    // Dark joints
    this.matJoints = new THREE.MeshStandardMaterial({
      color: 0x101318,
      metalness: 0.95,
      roughness: 0.18
    });

    // Gunmetal armor plates
    this.matPlates = new THREE.MeshStandardMaterial({
      color: 0x242a36,
      metalness: 0.82,
      roughness: 0.32
    });

    // Glowing Visor Strip
    this.matVisor = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x00e5ff,
      emissiveIntensity: 2.5,
      roughness: 0.08,
      metalness: 0.1
    });

    // Visor Glow Light
    this.visorLight = new THREE.PointLight(0x00e5ff, 1.5, 2.5);
    this.visorLight.position.set(0, 0.05, 0.4);

    // Chest Core Reactor
    this.matCore = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x00e5ff,
      emissiveIntensity: 3.0,
      roughness: 0.1,
      metalness: 0.2
    });

    // Antenna & Accents
    this.matAntenna = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x00e5ff,
      emissiveIntensity: 2.0
    });
  }

  buildRobot() {
    this.robotGroup = new THREE.Group();
    this.scene.add(this.robotGroup);

    // 1. Torso Base
    this.torsoGroup = new THREE.Group();
    this.torsoGroup.position.set(0, 1.05, 0);
    this.robotGroup.add(this.torsoGroup);

    const chestGeo = new THREE.BoxGeometry(0.52, 0.44, 0.32);
    const chestMesh = new THREE.Mesh(chestGeo, this.matBody);
    chestMesh.castShadow = true;
    chestMesh.receiveShadow = true;
    this.torsoGroup.add(chestMesh);

    // Front Chest Armor Plate
    const plateGeo = new THREE.BoxGeometry(0.44, 0.36, 0.04);
    const plateMesh = new THREE.Mesh(plateGeo, this.matPlates);
    plateMesh.position.set(0, 0, 0.17);
    this.torsoGroup.add(plateMesh);

    // Glowing Core Reactor (Diamond/Circle)
    const coreGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.04, 16);
    coreGeo.rotateX(Math.PI / 2);
    const coreMesh = new THREE.Mesh(coreGeo, this.matCore);
    coreMesh.position.set(0, 0.04, 0.19);
    this.torsoGroup.add(coreMesh);

    // Neck
    const neckGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.12, 16);
    const neckMesh = new THREE.Mesh(neckGeo, this.matJoints);
    neckMesh.position.set(0, 0.26, 0);
    this.torsoGroup.add(neckMesh);

    // 2. Head Group
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.38, 0);
    this.torsoGroup.add(this.headGroup);

    const headGeo = new THREE.BoxGeometry(0.38, 0.32, 0.34);
    const headMesh = new THREE.Mesh(headGeo, this.matBody);
    headMesh.castShadow = true;
    this.headGroup.add(headMesh);

    // Visor Mask Bar
    const visorGeo = new THREE.BoxGeometry(0.32, 0.09, 0.04);
    const visorMesh = new THREE.Mesh(visorGeo, this.matVisor);
    visorMesh.position.set(0, 0.02, 0.18);
    this.headGroup.add(visorMesh);
    this.headGroup.add(this.visorLight);

    // Ears / Side sensors
    const earGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.05, 12);
    earGeo.rotateZ(Math.PI / 2);
    const leftEar = new THREE.Mesh(earGeo, this.matPlates);
    leftEar.position.set(0.21, 0.02, 0);
    const rightEar = new THREE.Mesh(earGeo, this.matPlates);
    rightEar.position.set(-0.21, 0.02, 0);
    this.headGroup.add(leftEar, rightEar);

    // Antenna on top
    const antennaStemGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.16, 8);
    const antennaStem = new THREE.Mesh(antennaStemGeo, this.matJoints);
    antennaStem.position.set(0, 0.23, 0);
    this.headGroup.add(antennaStem);

    const antennaTipGeo = new THREE.SphereGeometry(0.038, 12, 12);
    this.antennaTip = new THREE.Mesh(antennaTipGeo, this.matAntenna);
    this.antennaTip.position.set(0, 0.32, 0);
    this.headGroup.add(this.antennaTip);

    // 3. Arms (Calmly resting at sides)
    this.buildArms();

    // 4. Pelvis & Legs
    this.buildLegs();
  }

  buildArms() {
    // Left Shoulder Joint
    this.leftArmGroup = new THREE.Group();
    this.leftArmGroup.position.set(0.33, 0.14, 0);
    this.leftArmGroup.rotation.set(0.05, 0, -0.15);
    this.torsoGroup.add(this.leftArmGroup);

    const shoulderJointGeo = new THREE.SphereGeometry(0.07, 16, 16);
    const lShoulder = new THREE.Mesh(shoulderJointGeo, this.matJoints);
    this.leftArmGroup.add(lShoulder);

    // Upper Arm
    const uArmGeo = new THREE.CylinderGeometry(0.055, 0.05, 0.26, 12);
    const lUArm = new THREE.Mesh(uArmGeo, this.matBody);
    lUArm.position.set(0, -0.15, 0);
    this.leftArmGroup.add(lUArm);

    // Left Forearm Group
    this.leftForearmGroup = new THREE.Group();
    this.leftForearmGroup.position.set(0, -0.28, 0);
    this.leftForearmGroup.rotation.set(0.2, 0, 0);
    this.leftArmGroup.add(this.leftForearmGroup);

    const elbowGeo = new THREE.SphereGeometry(0.055, 14, 14);
    const lElbow = new THREE.Mesh(elbowGeo, this.matJoints);
    this.leftForearmGroup.add(lElbow);

    const fArmGeo = new THREE.CylinderGeometry(0.048, 0.042, 0.24, 12);
    const lFArm = new THREE.Mesh(fArmGeo, this.matPlates);
    lFArm.position.set(0, -0.13, 0);
    this.leftForearmGroup.add(lFArm);

    // Hand
    const handGeo = new THREE.BoxGeometry(0.065, 0.075, 0.045);
    const lHand = new THREE.Mesh(handGeo, this.matJoints);
    lHand.position.set(0, -0.27, 0);
    this.leftForearmGroup.add(lHand);

    // Right Shoulder Joint
    this.rightArmGroup = new THREE.Group();
    this.rightArmGroup.position.set(-0.33, 0.14, 0);
    this.rightArmGroup.rotation.set(0.05, 0, 0.15);
    this.torsoGroup.add(this.rightArmGroup);

    const rShoulder = new THREE.Mesh(shoulderJointGeo, this.matJoints);
    this.rightArmGroup.add(rShoulder);

    // Upper Arm
    const rUArm = new THREE.Mesh(uArmGeo, this.matBody);
    rUArm.position.set(0, -0.15, 0);
    this.rightArmGroup.add(rUArm);

    // Right Forearm Group
    this.rightForearmGroup = new THREE.Group();
    this.rightForearmGroup.position.set(0, -0.28, 0);
    this.rightForearmGroup.rotation.set(0.2, 0, 0);
    this.rightArmGroup.add(this.rightForearmGroup);

    const rElbow = new THREE.Mesh(elbowGeo, this.matJoints);
    this.rightForearmGroup.add(rElbow);

    const rFArm = new THREE.Mesh(fArmGeo, this.matPlates);
    rFArm.position.set(0, -0.13, 0);
    this.rightForearmGroup.add(rFArm);

    // Hand
    const rHand = new THREE.Mesh(handGeo, this.matJoints);
    rHand.position.set(0, -0.27, 0);
    this.rightForearmGroup.add(rHand);
  }

  buildLegs() {
    // Pelvis
    const pelvisGeo = new THREE.BoxGeometry(0.38, 0.12, 0.26);
    const pelvisMesh = new THREE.Mesh(pelvisGeo, this.matPlates);
    pelvisMesh.position.set(0, -0.26, 0);
    this.torsoGroup.add(pelvisMesh);

    // Left Leg
    const legGeo = new THREE.CylinderGeometry(0.065, 0.055, 0.54, 12);
    const lLeg = new THREE.Mesh(legGeo, this.matBody);
    lLeg.position.set(0.14, -0.58, 0);
    this.torsoGroup.add(lLeg);

    // Foot
    const footGeo = new THREE.BoxGeometry(0.11, 0.07, 0.18);
    const lFoot = new THREE.Mesh(footGeo, this.matJoints);
    lFoot.position.set(0.14, -0.88, 0.03);
    this.torsoGroup.add(lFoot);

    // Right Leg
    const rLeg = new THREE.Mesh(legGeo, this.matBody);
    rLeg.position.set(-0.14, -0.58, 0);
    this.torsoGroup.add(rLeg);

    const rFoot = new THREE.Mesh(footGeo, this.matJoints);
    rFoot.position.set(-0.14, -0.88, 0.03);
    this.torsoGroup.add(rFoot);
  }

  buildPlatform() {
    // Sleek cybernetic floor pedestal
    const pedestalGeo = new THREE.CylinderGeometry(1.1, 1.25, 0.08, 32);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x0c111a,
      roughness: 0.6,
      metalness: 0.7
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.set(0, 0.08, 0);
    pedestal.receiveShadow = true;
    this.scene.add(pedestal);

    // Glowing orange rim ring around pedestal
    const ringGeo = new THREE.TorusGeometry(1.15, 0.015, 8, 48);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xff7b00,
      emissive: 0xff7b00,
      emissiveIntensity: 2.0
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(0, 0.12, 0);
    this.scene.add(ring);
  }

  setState(newState) {
    if (!['READY', 'LISTENING', 'THINKING', 'SPEAKING'].includes(newState)) {
      newState = 'READY';
    }
    this.state = newState;
    this.targetColor = STATE_VISOR_COLORS[newState] || STATE_VISOR_COLORS.READY;
  }

  update(delta) {
    const time = this.clock.getElapsedTime();

    // Color transition interpolation
    this.currentColor.lerp(this.targetColor, Math.min(1, delta * 8));
    this.matVisor.color.copy(this.currentColor);
    this.matVisor.emissive.copy(this.currentColor);
    this.visorLight.color.copy(this.currentColor);

    // Dynamic animation and visor emissive modulations per state
    if (this.state === 'READY') {
      // 1. READY: Slow calm breathing
      const breath = Math.sin(time * 1.8);
      this.torsoGroup.position.y = 1.05 + breath * 0.018;
      this.headGroup.rotation.x = breath * 0.012;
      this.headGroup.rotation.y = 0;
      this.headGroup.rotation.z = 0;
      this.currentEmissive = 2.2 + breath * 0.4;
      this.matCore.emissiveIntensity = 2.2 + breath * 0.3;
    } else if (this.state === 'LISTENING') {
      // 2. LISTENING: Visor glows bright cyan, head attentive
      const pulse = Math.sin(time * 4.0) * 0.4;
      this.torsoGroup.position.y = 1.05 + Math.sin(time * 2.2) * 0.01;
      this.headGroup.rotation.x = 0.04; // Attentive tilt
      this.headGroup.rotation.y = Math.sin(time * 1.5) * 0.04;
      this.headGroup.rotation.z = 0;
      this.currentEmissive = 3.6 + pulse;
      this.matCore.emissiveIntensity = 3.2;
    } else if (this.state === 'THINKING') {
      // 3. THINKING: Visor pulses orange, head tilts inquisitively
      const orangePulse = Math.sin(time * 6.0) * 1.0;
      this.torsoGroup.position.y = 1.05 + Math.sin(time * 3.0) * 0.012;
      this.headGroup.rotation.x = -0.04;
      this.headGroup.rotation.y = 0.08;
      this.headGroup.rotation.z = -0.12; // Pensive head tilt
      this.currentEmissive = 3.0 + orangePulse;
      this.matCore.emissiveIntensity = 2.8 + orangePulse * 0.4;
    } else if (this.state === 'SPEAKING') {
      // 4. SPEAKING: Visor flashes in time with speech, head nods slightly rhythmically
      const speechFlash = (Math.sin(time * 14.0) * 0.5 + 0.5) * 1.6;
      const headNod = Math.sin(time * 9.0) * 0.055;
      this.torsoGroup.position.y = 1.05 + Math.sin(time * 4.5) * 0.015;
      this.headGroup.rotation.x = headNod;
      this.headGroup.rotation.y = Math.cos(time * 4.0) * 0.03;
      this.headGroup.rotation.z = 0;
      this.currentEmissive = 2.4 + speechFlash;
      this.matCore.emissiveIntensity = 2.5 + speechFlash * 0.5;
    }

    this.matVisor.emissiveIntensity = this.currentEmissive;
    this.visorLight.intensity = this.currentEmissive * 0.65;
    if (this.antennaTip) {
      this.antennaTip.material.emissive.copy(this.currentColor);
      this.antennaTip.material.emissiveIntensity = this.currentEmissive * 0.75;
    }

    // Render Scene
    this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const w = Math.max(this.container.clientWidth || 0, 300);
    const h = Math.max(this.container.clientHeight || 0, 300);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  destroy() {
    window.removeEventListener('resize', this.onResize);
    if (this.renderer && this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
