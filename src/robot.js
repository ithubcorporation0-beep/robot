import * as THREE from 'three';

// Base poses for each state
const BASE_POSES = {
  IDLE: {
    torsoY: 1.05,
    torsoRotX: 0,
    torsoRotY: 0,
    torsoRotZ: 0,
    headRotX: 0,
    headRotY: 0,
    headRotZ: 0,
    leftArmRotX: 0.08,
    leftArmRotY: 0,
    leftArmRotZ: 0.16,
    leftElbowRotX: 0.22,
    leftElbowRotY: 0,
    leftElbowRotZ: 0,
    rightArmRotX: 0.08,
    rightArmRotY: 0,
    rightArmRotZ: -0.16,
    rightElbowRotX: 0.22,
    rightElbowRotY: 0,
    rightElbowRotZ: 0,
    leftLegRotX: 0,
    rightLegRotX: 0,
    leftKneeRotX: 0,
    rightKneeRotX: 0,
  },
  IDEA: {
    torsoY: 1.05,
    torsoRotX: -0.02,
    torsoRotY: 0.06,
    torsoRotZ: -0.03,
    headRotX: -0.06,
    headRotY: 0.18,
    headRotZ: -0.28,
    leftArmRotX: 0.10,
    leftArmRotY: 0.02,
    leftArmRotZ: 0.18,
    leftElbowRotX: 0.25,
    leftElbowRotY: 0,
    leftElbowRotZ: 0,
    // Right arm brings hand directly to chin
    rightArmRotX: -2.51,
    rightArmRotY: 0.57,
    rightArmRotZ: -0.10,
    rightElbowRotX: 2.09,
    rightElbowRotY: 0.20,
    rightElbowRotZ: -1.20,
    leftLegRotX: 0.02,
    rightLegRotX: -0.02,
    leftKneeRotX: 0.04,
    rightKneeRotX: 0.04,
  },
  LIFTING: {
    torsoY: 0.98,
    torsoRotX: -0.16, // Body leans back slightly
    torsoRotY: 0,
    torsoRotZ: 0,
    headRotX: -0.26, // Head looking up at overhead weight
    headRotY: 0,
    headRotZ: 0,
    // Both arms raised overhead
    leftArmRotX: -2.65,
    leftArmRotY: 0.12,
    leftArmRotZ: 0.35,
    leftElbowRotX: 0.55,
    leftElbowRotY: 0,
    leftElbowRotZ: 0,
    rightArmRotX: -2.65,
    rightArmRotY: -0.12,
    rightArmRotZ: -0.35,
    rightElbowRotX: 0.55,
    rightElbowRotY: 0,
    rightElbowRotZ: 0,
    leftLegRotX: -0.16,
    rightLegRotX: -0.16,
    leftKneeRotX: 0.32,
    rightKneeRotX: 0.32,
  }
};

const STATE_COLORS = {
  IDLE: new THREE.Color(0x00e5ff),
  IDEA: new THREE.Color(0xffd600),
  LIFTING: new THREE.Color(0xff2244)
};

const STATE_EMISSIVE = {
  IDLE: 3.2,
  IDEA: 4.0,
  LIFTING: 4.5
};

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export class RobotScene {
  constructor(containerElement) {
    this.container = containerElement;
    this.state = 'IDLE'; // 'IDLE' | 'IDEA' | 'LIFTING'
    this.clock = new THREE.Clock();

    // Scene & Camera with safe initial dimensions
    const initialWidth = Math.max(this.container.clientWidth || 0, 400);
    const initialHeight = Math.max(this.container.clientHeight || 0, 400);
    this.lastW = initialWidth;
    this.lastH = initialHeight;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      40,
      initialWidth / initialHeight,
      0.1,
      100
    );
    this.camera.position.set(0, 1.65, 7.8);
    this.camera.lookAt(0, 1.55, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(initialWidth, initialHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // Lighting
    this.setupLighting();

    // Materials
    this.setupMaterials();

    // Robot Hierarchy & Mesh Construction
    this.anchors = {};
    this.buildRobot();

    // Pedestal & Floor with Soft Shadow
    this.buildPlatform();

    // Lightbulb above head for IDEA state
    this.buildLightbulb();

    // Particle system for sparks in LIFTING state
    this.buildSparks();

    // Transition & Animation state (0.4s smooth easing transitions)
    this.transitionDuration = 0.4;
    this.transitionElapsed = 0.4; // starts fully settled in IDLE
    this.fromBasePose = { ...BASE_POSES.IDLE };
    this.currentBasePose = { ...BASE_POSES.IDLE };
    this.finalPose = { ...BASE_POSES.IDLE };

    this.stateWeights = { IDLE: 1, IDEA: 0, LIFTING: 0 };
    this.fromWeights = { IDLE: 1, IDEA: 0, LIFTING: 0 };

    this.currentColor = STATE_COLORS.IDLE.clone();
    this.fromColor = STATE_COLORS.IDLE.clone();
    this.targetColor = STATE_COLORS.IDLE.clone();
    this.fromEmissive = STATE_EMISSIVE.IDLE;
    this.currentEmissive = STATE_EMISSIVE.IDLE;

    this.tempHandVec = new THREE.Vector3();

    // Responsive Resize Listener
    this.onResize = this.onResize.bind(this);
    window.addEventListener('resize', this.onResize);
  }

  setupLighting() {
    // Ambient soft fill - dark moody neutral so dark metal stays rich
    const ambientLight = new THREE.AmbientLight(0x1a202c, 1.8);
    this.scene.add(ambientLight);

    // Key Light (cool-neutral directional light with crisp specular & soft shadow)
    const keyLight = new THREE.DirectionalLight(0xf2f6ff, 2.4);
    keyLight.position.set(3, 5, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 15;
    keyLight.shadow.camera.left = -2.5;
    keyLight.shadow.camera.right = 2.5;
    keyLight.shadow.camera.top = 2.5;
    keyLight.shadow.camera.bottom = -2.5;
    keyLight.shadow.radius = 3;
    this.scene.add(keyLight);

    // Front fill light
    const fillLight = new THREE.DirectionalLight(0x405570, 1.1);
    fillLight.position.set(0, 1.2, 4);
    this.scene.add(fillLight);

    // Subtle Orange Rim Light from behind-left (matches strings)
    const orangeRimLight = new THREE.DirectionalLight(0xff6a00, 4.5);
    orangeRimLight.position.set(-3.5, 3.2, -3.2);
    this.scene.add(orangeRimLight);

    // Secondary Warm Orange Kick Light from behind-right (silhouette highlight)
    const orangeKickLight = new THREE.DirectionalLight(0xff8811, 2.6);
    orangeKickLight.position.set(3.5, 2.2, -3.0);
    this.scene.add(orangeKickLight);

    // Subtle Orange Accent point light from underneath
    const accentLight = new THREE.PointLight(0xff6600, 2.2, 6);
    accentLight.position.set(0, 0.35, 1.4);
    this.scene.add(accentLight);
  }

  setupMaterials() {
    // Dark metallic body - sleek titanium/tungsten alloy with smooth sheen
    this.matBody = new THREE.MeshStandardMaterial({
      color: 0x1b1e24,
      metalness: 0.88,
      roughness: 0.28
    });

    // Dark polished metallic joints (spheres at shoulders, elbows, hips, knees)
    this.matJoints = new THREE.MeshStandardMaterial({
      color: 0x111317,
      metalness: 0.96,
      roughness: 0.16
    });

    // Dark gunmetal armor plates & trim
    this.matPlates = new THREE.MeshStandardMaterial({
      color: 0x272c35,
      metalness: 0.82,
      roughness: 0.32
    });

    // Joint trim rings / collars
    this.matJointTrim = new THREE.MeshStandardMaterial({
      color: 0x323742,
      metalness: 0.9,
      roughness: 0.22
    });

    // Glowing Visor Strip (dynamic state glow)
    this.matVisor = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x00e5ff,
      emissiveIntensity: 3.2,
      roughness: 0.08,
      metalness: 0.1
    });

    // Dark Visor Recessed Frame
    this.matVisorFrame = new THREE.MeshStandardMaterial({
      color: 0x0a0c10,
      metalness: 0.92,
      roughness: 0.45
    });

    // Bright Orange Anchor Points (where strings attach)
    this.matAnchor = new THREE.MeshStandardMaterial({
      color: 0xff6600,
      emissive: 0xff7700,
      emissiveIntensity: 3.8,
      roughness: 0.1,
      metalness: 0.2
    });

    // Anchor mounting collar
    this.matAnchorCollar = new THREE.MeshStandardMaterial({
      color: 0x24272c,
      metalness: 0.92,
      roughness: 0.25
    });

    // Antenna tip
    this.matAntenna = new THREE.MeshStandardMaterial({
      color: 0xff8800,
      emissive: 0xff7700,
      emissiveIntensity: 2.8,
      roughness: 0.15
    });
  }

  // Helper to create small bright orange anchor points with mounting collar
  createAnchorFixture(parent, localPos, name) {
    const anchorGroup = new THREE.Group();
    anchorGroup.position.copy(localPos);
    parent.add(anchorGroup);

    // Dark metallic mounting ring/collar
    const collarGeo = new THREE.CylinderGeometry(0.048, 0.056, 0.024, 16);
    const collar = new THREE.Mesh(collarGeo, this.matAnchorCollar);
    anchorGroup.add(collar);

    // Bright glowing orange anchor bead
    const beadGeo = new THREE.SphereGeometry(0.042, 14, 14);
    const bead = new THREE.Mesh(beadGeo, this.matAnchor);
    bead.position.y = 0.015;
    anchorGroup.add(bead);

    // Inner bright white-orange core
    const coreGeo = new THREE.SphereGeometry(0.02, 10, 10);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffeedd });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.y = 0.02;
    anchorGroup.add(core);

    // Object3D anchor target for string alignment
    const anchorObj = new THREE.Object3D();
    anchorObj.position.y = 0.035;
    anchorGroup.add(anchorObj);

    if (name) {
      this.anchors[name] = anchorObj;
    }

    return anchorObj;
  }

  buildRobot() {
    this.robotRoot = new THREE.Group();
    this.scene.add(this.robotRoot);

    // ==========================================
    // 1. Pelvis / Hips (Rounded base)
    // ==========================================
    this.pelvis = new THREE.Group();
    this.pelvis.position.y = 1.05;
    this.robotRoot.add(this.pelvis);

    // Rounded central pelvis hub
    const pelvisGeo = new THREE.CapsuleGeometry(0.24, 0.38, 16, 20);
    pelvisGeo.rotateZ(Math.PI / 2);
    const pelvisMesh = new THREE.Mesh(pelvisGeo, this.matBody);
    pelvisMesh.castShadow = true;
    this.pelvis.add(pelvisMesh);

    // Pelvis front guard plate
    const pelvisPlateGeo = new THREE.CylinderGeometry(0.22, 0.24, 0.22, 16, 1, false, -Math.PI * 0.4, Math.PI * 0.8);
    const pelvisPlate = new THREE.Mesh(pelvisPlateGeo, this.matPlates);
    pelvisPlate.position.set(0, 0, 0.12);
    this.pelvis.add(pelvisPlate);

    // ==========================================
    // 2. Torso (Rounded Torso & Abdomen)
    // ==========================================
    this.torsoGroup = new THREE.Group();
    this.torsoGroup.position.set(0, 0.16, 0);
    this.pelvis.add(this.torsoGroup);

    // Lower & Mid abdomen: Segmented rounded tech rings
    const lowerAbGeo = new THREE.CylinderGeometry(0.33, 0.35, 0.14, 24);
    const lowerAb = new THREE.Mesh(lowerAbGeo, this.matJoints);
    lowerAb.position.y = 0.12;
    this.torsoGroup.add(lowerAb);

    const midAbGeo = new THREE.CylinderGeometry(0.36, 0.34, 0.14, 24);
    const midAb = new THREE.Mesh(midAbGeo, this.matPlates);
    midAb.position.y = 0.26;
    this.torsoGroup.add(midAb);

    // Main Chest Body: Smooth rounded capsule shape
    const chestGeo = new THREE.CapsuleGeometry(0.44, 0.36, 20, 24);
    this.chest = new THREE.Mesh(chestGeo, this.matBody);
    this.chest.position.set(0, 0.65, 0);
    this.chest.scale.set(1.12, 1.0, 0.88); // Athletic rounded chest proportion
    this.chest.castShadow = true;
    this.torsoGroup.add(this.chest);

    // Front Chest Armor Shell (Sleek curved breastplate)
    const chestPlateGeo = new THREE.CylinderGeometry(0.44, 0.40, 0.42, 24, 1, false, -Math.PI * 0.36, Math.PI * 0.72);
    const chestPlate = new THREE.Mesh(chestPlateGeo, this.matPlates);
    chestPlate.position.set(0, 0.66, 0.08);
    this.torsoGroup.add(chestPlate);

    // Glowing Chest Core housing
    const coreRingGeo = new THREE.TorusGeometry(0.16, 0.035, 12, 24);
    const coreRing = new THREE.Mesh(coreRingGeo, this.matJointTrim);
    coreRing.position.set(0, 0.66, 0.40);
    this.torsoGroup.add(coreRing);

    // Glowing Chest Core Disc
    const coreDiscGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.04, 20);
    coreDiscGeo.rotateX(Math.PI / 2);
    this.chestCore = new THREE.Mesh(coreDiscGeo, this.matVisor);
    this.chestCore.position.set(0, 0.66, 0.41);
    this.torsoGroup.add(this.chestCore);

    // Bright Orange Anchor Point on Chest (String landmark 12: Middle Finger)
    const chestAnchorTarget = this.createAnchorFixture(
      this.torsoGroup,
      new THREE.Vector3(0, 0.66, 0.45),
      'chest'
    );
    // Orient collar forward
    chestAnchorTarget.parent.rotation.x = Math.PI / 2;

    // ==========================================
    // 3. Neck & Head with Glowing Visor Strip
    // ==========================================
    // Articulated neck cylinder with dark joint texture
    const neckGeo = new THREE.CylinderGeometry(0.15, 0.17, 0.22, 16);
    const neck = new THREE.Mesh(neckGeo, this.matJoints);
    neck.position.set(0, 1.15, 0);
    this.torsoGroup.add(neck);

    const neckRingGeo = new THREE.TorusGeometry(0.16, 0.025, 8, 20);
    neckRingGeo.rotateX(Math.PI / 2);
    const neckRing = new THREE.Mesh(neckRingGeo, this.matJointTrim);
    neckRing.position.set(0, 1.15, 0);
    this.torsoGroup.add(neckRing);

    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 1.35, 0);
    this.torsoGroup.add(this.headGroup);

    // Sleek rounded helmet/head cranium
    const headGeo = new THREE.SphereGeometry(0.36, 28, 24);
    this.headMesh = new THREE.Mesh(headGeo, this.matBody);
    this.headMesh.position.y = 0.32;
    this.headMesh.scale.set(0.96, 1.05, 1.0); // Aerodynamic rounded helmet
    this.headMesh.castShadow = true;
    this.headGroup.add(this.headMesh);

    // Helmet Jaw / Chin bevel guard
    const chinGeo = new THREE.CylinderGeometry(0.24, 0.18, 0.16, 16, 1, false, -Math.PI * 0.35, Math.PI * 0.7);
    const chinMesh = new THREE.Mesh(chinGeo, this.matPlates);
    chinMesh.position.set(0, 0.15, 0.16);
    this.headGroup.add(chinMesh);

    // Visor recessed housing / dark frame
    const visorFrameGeo = new THREE.CylinderGeometry(0.368, 0.368, 0.14, 32, 1, false, -Math.PI * 0.38, Math.PI * 0.76);
    const visorFrame = new THREE.Mesh(visorFrameGeo, this.matVisorFrame);
    visorFrame.position.set(0, 0.34, 0.01);
    this.headGroup.add(visorFrame);

    // Glowing Visor Strip (Curved horizontal glowing band wrapping face)
    const visorStripGeo = new THREE.CylinderGeometry(0.375, 0.375, 0.075, 32, 1, false, -Math.PI * 0.34, Math.PI * 0.68);
    this.visor = new THREE.Mesh(visorStripGeo, this.matVisor);
    this.visor.position.set(0, 0.34, 0.015);
    this.headGroup.add(this.visor);

    // Ear Receptor Pods on sides
    const earGeo = new THREE.CylinderGeometry(0.10, 0.10, 0.08, 16);
    earGeo.rotateZ(Math.PI / 2);
    const leftEar = new THREE.Mesh(earGeo, this.matJointTrim);
    leftEar.position.set(-0.36, 0.32, 0);
    const rightEar = new THREE.Mesh(earGeo, this.matJointTrim);
    rightEar.position.set(0.36, 0.32, 0);
    this.headGroup.add(leftEar, rightEar);

    // Antenna on crown
    const antennaStemGeo = new THREE.CylinderGeometry(0.025, 0.035, 0.32, 8);
    const antennaStem = new THREE.Mesh(antennaStemGeo, this.matJoints);
    antennaStem.position.set(0, 0.78, 0);
    this.headGroup.add(antennaStem);

    const antennaTipGeo = new THREE.SphereGeometry(0.065, 12, 12);
    this.antennaTip = new THREE.Mesh(antennaTipGeo, this.matAntenna);
    this.antennaTip.position.set(0, 0.96, 0);
    this.headGroup.add(this.antennaTip);

    // Bright Orange Anchor Point on Head (String landmark 8: Index Finger)
    this.createAnchorFixture(
      this.headGroup,
      new THREE.Vector3(0, 0.74, 0),
      'head'
    );

    // ==========================================
    // 4. Arms with Visible Joints (Shoulders & Elbows)
    // ==========================================
    const shoulderBallGeo = new THREE.SphereGeometry(0.155, 20, 20);
    const elbowBallGeo = new THREE.SphereGeometry(0.125, 20, 20);
    const collarTrimGeo = new THREE.TorusGeometry(0.14, 0.024, 8, 20);
    collarTrimGeo.rotateX(Math.PI / 2);

    // ---- Left Arm ----
    // Left Shoulder Pivot
    this.leftShoulder = new THREE.Group();
    this.leftShoulder.position.set(-0.65, 0.96, 0);
    this.torsoGroup.add(this.leftShoulder);

    // Visible Left Shoulder Joint Sphere
    const leftShoulderBall = new THREE.Mesh(shoulderBallGeo, this.matJoints);
    leftShoulderBall.castShadow = true;
    this.leftShoulder.add(leftShoulderBall);
    const leftShoulderTrim = new THREE.Mesh(collarTrimGeo, this.matJointTrim);
    this.leftShoulder.add(leftShoulderTrim);

    // Left Upper Arm (Sculpted rounded capsule)
    const upperArmGeo = new THREE.CapsuleGeometry(0.115, 0.32, 14, 16);
    const leftUpperArm = new THREE.Mesh(upperArmGeo, this.matBody);
    leftUpperArm.position.set(0, -0.30, 0);
    leftUpperArm.castShadow = true;
    this.leftShoulder.add(leftUpperArm);

    // Left Elbow Pivot
    this.leftElbow = new THREE.Group();
    this.leftElbow.position.set(0, -0.58, 0);
    this.leftShoulder.add(this.leftElbow);

    // Visible Left Elbow Joint Sphere
    const leftElbowBall = new THREE.Mesh(elbowBallGeo, this.matJoints);
    leftElbowBall.castShadow = true;
    this.leftElbow.add(leftElbowBall);

    // Left Forearm (Sculpted rounded capsule with armor plate)
    const forearmGeo = new THREE.CapsuleGeometry(0.105, 0.28, 14, 16);
    const leftForearm = new THREE.Mesh(forearmGeo, this.matPlates);
    leftForearm.position.set(0, -0.27, 0);
    leftForearm.castShadow = true;
    this.leftElbow.add(leftForearm);

    // Left Hand (Rounded robotic hand module)
    const handGeo = new THREE.CapsuleGeometry(0.09, 0.12, 12, 14);
    const leftHand = new THREE.Mesh(handGeo, this.matJoints);
    leftHand.position.set(0, -0.52, 0);
    leftHand.castShadow = true;
    this.leftElbow.add(leftHand);

    // Bright Orange Anchor Point on Left Hand (String landmark 4: Thumb)
    this.createAnchorFixture(
      this.leftElbow,
      new THREE.Vector3(0, -0.58, 0.05),
      'leftHand'
    );

    // ---- Right Arm ----
    // Right Shoulder Pivot
    this.rightShoulder = new THREE.Group();
    this.rightShoulder.position.set(0.65, 0.96, 0);
    this.torsoGroup.add(this.rightShoulder);

    // Visible Right Shoulder Joint Sphere
    const rightShoulderBall = new THREE.Mesh(shoulderBallGeo, this.matJoints);
    rightShoulderBall.castShadow = true;
    this.rightShoulder.add(rightShoulderBall);
    const rightShoulderTrim = new THREE.Mesh(collarTrimGeo, this.matJointTrim);
    this.rightShoulder.add(rightShoulderTrim);

    // Right Upper Arm
    const rightUpperArm = new THREE.Mesh(upperArmGeo, this.matBody);
    rightUpperArm.position.set(0, -0.30, 0);
    rightUpperArm.castShadow = true;
    this.rightShoulder.add(rightUpperArm);

    // Right Elbow Pivot
    this.rightElbow = new THREE.Group();
    this.rightElbow.position.set(0, -0.58, 0);
    this.rightShoulder.add(this.rightElbow);

    // Visible Right Elbow Joint Sphere
    const rightElbowBall = new THREE.Mesh(elbowBallGeo, this.matJoints);
    rightElbowBall.castShadow = true;
    this.rightElbow.add(rightElbowBall);

    // Right Forearm
    const rightForearm = new THREE.Mesh(forearmGeo, this.matPlates);
    rightForearm.position.set(0, -0.27, 0);
    rightForearm.castShadow = true;
    this.rightElbow.add(rightForearm);

    // Right Hand
    const rightHand = new THREE.Mesh(handGeo, this.matJoints);
    rightHand.position.set(0, -0.52, 0);
    rightHand.castShadow = true;
    this.rightElbow.add(rightHand);

    // Bright Orange Anchor Point on Right Hand (String landmark 16: Ring Finger)
    this.createAnchorFixture(
      this.rightElbow,
      new THREE.Vector3(0, -0.58, 0.05),
      'rightHand'
    );

    // ==========================================
    // 5. Legs with Visible Joints (Hips & Knees)
    // ==========================================
    const hipBallGeo = new THREE.SphereGeometry(0.145, 20, 20);
    const kneeBallGeo = new THREE.SphereGeometry(0.125, 20, 20);
    const thighGeo = new THREE.CapsuleGeometry(0.13, 0.32, 14, 16);
    const shinGeo = new THREE.CapsuleGeometry(0.115, 0.30, 14, 16);

    // ---- Left Leg ----
    this.leftHip = new THREE.Group();
    this.leftHip.position.set(-0.28, -0.15, 0);
    this.pelvis.add(this.leftHip);

    // Visible Left Hip Joint Sphere
    const leftHipBall = new THREE.Mesh(hipBallGeo, this.matJoints);
    leftHipBall.castShadow = true;
    this.leftHip.add(leftHipBall);

    // Left Thigh
    const leftThigh = new THREE.Mesh(thighGeo, this.matBody);
    leftThigh.position.set(0, -0.31, 0);
    leftThigh.castShadow = true;
    this.leftHip.add(leftThigh);

    // Left Knee Pivot
    this.leftKnee = new THREE.Group();
    this.leftKnee.position.set(0, -0.60, 0);
    this.leftHip.add(this.leftKnee);

    // Visible Left Knee Joint Sphere
    const leftKneeBall = new THREE.Mesh(kneeBallGeo, this.matJoints);
    leftKneeBall.castShadow = true;
    this.leftKnee.add(leftKneeBall);

    // Left Shin
    const leftShin = new THREE.Mesh(shinGeo, this.matPlates);
    leftShin.position.set(0, -0.28, 0);
    leftShin.castShadow = true;
    this.leftKnee.add(leftShin);

    // Left Foot (Rounded cybernetic boot)
    const footGeo = new THREE.CapsuleGeometry(0.10, 0.22, 10, 14);
    footGeo.rotateX(Math.PI / 2);
    const leftFoot = new THREE.Mesh(footGeo, this.matJoints);
    leftFoot.position.set(0, -0.56, 0.08);
    leftFoot.castShadow = true;
    this.leftKnee.add(leftFoot);

    // ---- Right Leg ----
    this.rightHip = new THREE.Group();
    this.rightHip.position.set(0.28, -0.15, 0);
    this.pelvis.add(this.rightHip);

    // Visible Right Hip Joint Sphere
    const rightHipBall = new THREE.Mesh(hipBallGeo, this.matJoints);
    rightHipBall.castShadow = true;
    this.rightHip.add(rightHipBall);

    // Right Thigh
    const rightThigh = new THREE.Mesh(thighGeo, this.matBody);
    rightThigh.position.set(0, -0.31, 0);
    rightThigh.castShadow = true;
    this.rightHip.add(rightThigh);

    // Right Knee Pivot
    this.rightKnee = new THREE.Group();
    this.rightKnee.position.set(0, -0.60, 0);
    this.rightHip.add(this.rightKnee);

    // Visible Right Knee Joint Sphere
    const rightKneeBall = new THREE.Mesh(kneeBallGeo, this.matJoints);
    rightKneeBall.castShadow = true;
    this.rightKnee.add(rightKneeBall);

    // Right Shin
    const rightShin = new THREE.Mesh(shinGeo, this.matPlates);
    rightShin.position.set(0, -0.28, 0);
    rightShin.castShadow = true;
    this.rightKnee.add(rightShin);

    // Right Foot
    const rightFoot = new THREE.Mesh(footGeo, this.matJoints);
    rightFoot.position.set(0, -0.56, 0.08);
    rightFoot.castShadow = true;
    this.rightKnee.add(rightFoot);

    // Bright Orange Anchor Point for Feet (String landmark 20: Pinky Finger)
    // Cross-link bar connecting feet anchor
    const feetBridgeGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.44, 8);
    feetBridgeGeo.rotateZ(Math.PI / 2);
    const feetBridge = new THREE.Mesh(feetBridgeGeo, this.matJointTrim);
    feetBridge.position.set(0, -0.02, 0.12);
    this.robotRoot.add(feetBridge);

    this.createAnchorFixture(
      this.robotRoot,
      new THREE.Vector3(0, -0.01, 0.12),
      'feet'
    );
  }

  buildPlatform() {
    // Pedestal Cylinder
    const platformGeo = new THREE.CylinderGeometry(1.6, 1.8, 0.15, 32);
    const platformMat = new THREE.MeshStandardMaterial({
      color: 0x0c0f16,
      roughness: 0.7,
      metalness: 0.6
    });
    const platform = new THREE.Mesh(platformGeo, platformMat);
    platform.position.y = -0.08;
    platform.receiveShadow = true;
    this.scene.add(platform);

    // Inner Glowing Neon Ring on Platform
    const ringGeo = new THREE.RingGeometry(1.4, 1.48, 48);
    ringGeo.rotateX(-Math.PI / 2);
    this.ringMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeo, this.ringMat);
    ring.position.y = 0.005;
    this.scene.add(ring);

    // Outer Subtle Orange Accent Ring
    const outerRingGeo = new THREE.RingGeometry(1.7, 1.74, 48);
    outerRingGeo.rotateX(-Math.PI / 2);
    const outerRingMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      side: THREE.DoubleSide
    });
    const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
    outerRing.position.y = 0.005;
    this.scene.add(outerRing);

    // ==========================================
    // Soft Shadow Under the Robot
    // ==========================================
    // Procedural soft radial gradient shadow texture
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const sCtx = shadowCanvas.getContext('2d');
    const grad = sCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
    grad.addColorStop(0.35, 'rgba(0, 0, 0, 0.55)');
    grad.addColorStop(0.7, 'rgba(0, 0, 0, 0.22)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, 0, 128, 128);

    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const softShadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });

    // Dedicated soft ground contact shadow
    const shadowGeo = new THREE.PlaneGeometry(1.65, 1.65);
    this.softShadow = new THREE.Mesh(shadowGeo, softShadowMat);
    this.softShadow.rotation.x = -Math.PI / 2;
    this.softShadow.position.y = 0.008;
    this.scene.add(this.softShadow);
  }

  buildLightbulb() {
    this.lightbulbGroup = new THREE.Group();
    // Hover directly above antenna tip on the head
    this.lightbulbGroup.position.set(0, 1.25, 0);
    this.lightbulbGroup.scale.set(0, 0, 0);
    this.lightbulbGroup.visible = false;
    this.headGroup.add(this.lightbulbGroup);

    // Glowing bulb glass (bright yellow/amber bloom)
    this.bulbMat = new THREE.MeshStandardMaterial({
      color: 0xfff066,
      emissive: 0xffd000,
      emissiveIntensity: 3.5,
      roughness: 0.12,
      metalness: 0.08,
      transparent: true,
      opacity: 0.94
    });

    // Bulb upper dome
    const bulbHeadGeo = new THREE.SphereGeometry(0.12, 24, 20);
    const bulbHead = new THREE.Mesh(bulbHeadGeo, this.bulbMat);
    bulbHead.position.y = 0.14;
    this.lightbulbGroup.add(bulbHead);

    // Bulb tapered neck
    const bulbNeckGeo = new THREE.CylinderGeometry(0.115, 0.055, 0.10, 20);
    const bulbNeck = new THREE.Mesh(bulbNeckGeo, this.bulbMat);
    bulbNeck.position.y = 0.06;
    this.lightbulbGroup.add(bulbNeck);

    // Internal glowing filament
    const filamentGeo = new THREE.TorusGeometry(0.042, 0.008, 8, 20, Math.PI * 1.3);
    const filamentMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const filament = new THREE.Mesh(filamentGeo, filamentMat);
    filament.position.set(0, 0.13, 0);
    filament.rotation.z = Math.PI * 0.35;
    this.lightbulbGroup.add(filament);

    // Screw socket base
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x828892,
      metalness: 0.92,
      roughness: 0.28
    });
    const socketGeo = new THREE.CylinderGeometry(0.054, 0.050, 0.07, 18);
    const socket = new THREE.Mesh(socketGeo, baseMat);
    socket.position.y = -0.01;
    this.lightbulbGroup.add(socket);

    // Thread rings on socket
    const threadGeo = new THREE.TorusGeometry(0.055, 0.006, 8, 20);
    threadGeo.rotateX(Math.PI / 2);
    const thread1 = new THREE.Mesh(threadGeo, baseMat);
    thread1.position.y = 0.005;
    const thread2 = new THREE.Mesh(threadGeo, baseMat);
    thread2.position.y = -0.02;
    this.lightbulbGroup.add(thread1, thread2);

    // Bottom contact pin
    const contactGeo = new THREE.CylinderGeometry(0.022, 0.01, 0.018, 12);
    const contactMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    const contact = new THREE.Mesh(contactGeo, contactMat);
    contact.position.y = -0.048;
    this.lightbulbGroup.add(contact);

    // Radiating glow rays / spark accents around the bulb
    this.bulbRays = [];
    this.rayMat = new THREE.MeshBasicMaterial({ color: 0xffdf33, transparent: true, opacity: 0.85 });
    const rayAngles = [
      Math.PI * 0.1,
      Math.PI * 0.35,
      Math.PI * 0.65,
      Math.PI * 0.9,
      -Math.PI * 0.2,
      -Math.PI * 0.8
    ];
    rayAngles.forEach(ang => {
      const rayGeo = new THREE.CapsuleGeometry(0.012, 0.05, 6, 8);
      const ray = new THREE.Mesh(rayGeo, this.rayMat);
      const rad = 0.22;
      ray.position.set(Math.cos(ang) * rad, 0.14 + Math.sin(ang) * rad * 0.7, 0);
      ray.rotation.z = ang - Math.PI / 2;
      this.lightbulbGroup.add(ray);
      this.bulbRays.push(ray);
    });

    // Warm PointLight
    this.bulbLight = new THREE.PointLight(0xffd700, 0, 3.5);
    this.bulbLight.position.set(0, 0.14, 0);
    this.lightbulbGroup.add(this.bulbLight);
  }

  buildSparks() {
    this.maxSparks = 70;
    this.sparkData = [];

    this.sparksGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.maxSparks * 3);
    const colors = new Float32Array(this.maxSparks * 3);
    const sizes = new Float32Array(this.maxSparks);

    // Initialize all sparks offscreen
    for (let i = 0; i < this.maxSparks; i++) {
      positions[i * 3 + 1] = -100;
      this.sparkData.push({
        active: false,
        x: 0, y: -100, z: 0,
        vx: 0, vy: 0, vz: 0,
        life: 0, maxLife: 0.35,
        r: 1, g: 0.5, b: 0.1,
        baseSize: 0.16
      });
    }

    this.sparksGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.sparksGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.sparksGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Procedural smooth glowing spark particle texture
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.25, 'rgba(255, 200, 60, 0.95)');
    grad.addColorStop(0.6, 'rgba(255, 90, 0, 0.6)');
    grad.addColorStop(1, 'rgba(255, 40, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);

    this.sparksMat = new THREE.PointsMaterial({
      size: 0.22,
      map: texture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true
    });

    this.sparksMesh = new THREE.Points(this.sparksGeo, this.sparksMat);
    this.scene.add(this.sparksMesh);
    this.sparkSpawnTimer = 0;
  }

  updateSparks(delta, liftWeight) {
    if (liftWeight > 0.08 && this.anchors.leftHand && this.anchors.rightHand) {
      this.sparkSpawnTimer += delta;
      const interval = THREE.MathUtils.lerp(0.06, 0.024, liftWeight);
      while (this.sparkSpawnTimer >= interval) {
        this.sparkSpawnTimer -= interval;

        // Spawn a spark from left hand and right hand
        this.spawnSpark(this.anchors.leftHand, true);
        this.spawnSpark(this.anchors.rightHand, false);
      }
    }

    const positions = this.sparksGeo.attributes.position.array;
    const colors = this.sparksGeo.attributes.color.array;
    const sizes = this.sparksGeo.attributes.size.array;

    for (let i = 0; i < this.maxSparks; i++) {
      const sp = this.sparkData[i];
      if (!sp.active) continue;

      sp.life += delta;
      if (sp.life >= sp.maxLife) {
        sp.active = false;
        positions[i * 3 + 1] = -100;
        sizes[i] = 0;
        continue;
      }

      // Physics: gravity + drag + velocity integration
      sp.vy -= 4.8 * delta;
      sp.vx *= (1 - 0.7 * delta);
      sp.vz *= (1 - 0.7 * delta);
      sp.x += sp.vx * delta;
      sp.y += sp.vy * delta;
      sp.z += sp.vz * delta;

      positions[i * 3] = sp.x;
      positions[i * 3 + 1] = sp.y;
      positions[i * 3 + 2] = sp.z;

      const progress = sp.life / sp.maxLife;
      const fade = Math.max(0, 1 - progress);
      sizes[i] = sp.baseSize * fade;
      colors[i * 3] = sp.r * fade;
      colors[i * 3 + 1] = sp.g * fade;
      colors[i * 3 + 2] = sp.b * fade;
    }

    this.sparksGeo.attributes.position.needsUpdate = true;
    this.sparksGeo.attributes.color.needsUpdate = true;
    this.sparksGeo.attributes.size.needsUpdate = true;
  }

  spawnSpark(handAnchor, isLeft) {
    const sp = this.sparkData.find(s => !s.active);
    if (!sp) return;

    handAnchor.getWorldPosition(this.tempHandVec);
    sp.active = true;
    sp.x = this.tempHandVec.x + (Math.random() - 0.5) * 0.1;
    sp.y = this.tempHandVec.y + (Math.random() - 0.5) * 0.1;
    sp.z = this.tempHandVec.z + (Math.random() - 0.5) * 0.1;

    // Burst outwards and up, then fall
    sp.vx = (Math.random() - 0.5) * 1.6 + (isLeft ? -0.35 : 0.35);
    sp.vy = Math.random() * 2.0 + 0.6;
    sp.vz = (Math.random() - 0.5) * 1.4 + 0.25;

    sp.life = 0;
    sp.maxLife = 0.28 + Math.random() * 0.28;
    sp.r = 1.0;
    sp.g = 0.45 + Math.random() * 0.45;
    sp.b = Math.random() * 0.12;
    sp.baseSize = 0.14 + Math.random() * 0.08;
  }

  setState(newState) {
    if (this.state === newState) return;
    this.prevState = this.state;
    this.state = newState;

    // Snapshot current base pose and weights as transition start point
    this.fromBasePose = { ...this.currentBasePose };
    this.fromWeights = { ...this.stateWeights };
    this.fromColor.copy(this.currentColor);
    this.targetColor.copy(STATE_COLORS[newState] || STATE_COLORS.IDLE);
    this.fromEmissive = this.currentEmissive;

    this.transitionElapsed = 0;
    this.transitionDuration = 0.4; // 0.4 seconds per transition
  }

  update(delta) {
    const time = this.clock.getElapsedTime();
    const dt = Math.min(delta, 0.1);

    // 1. Advance transition timer and compute smooth cubic easing
    this.transitionElapsed += dt;
    const rawT = Math.min(1, this.transitionElapsed / this.transitionDuration);
    const easeT = easeInOutCubic(rawT);

    // 2. Interpolate base pose from fromBasePose to targetBasePose
    const targetBase = BASE_POSES[this.state] || BASE_POSES.IDLE;
    for (const key in targetBase) {
      const fromVal = this.fromBasePose[key] !== undefined ? this.fromBasePose[key] : targetBase[key];
      this.currentBasePose[key] = THREE.MathUtils.lerp(fromVal, targetBase[key], easeT);
    }

    // 3. Smoothly interpolate state weights (used for continuous dynamics)
    const targetWeights = {
      IDLE: this.state === 'IDLE' ? 1 : 0,
      IDEA: this.state === 'IDEA' ? 1 : 0,
      LIFTING: this.state === 'LIFTING' ? 1 : 0,
    };
    for (const s of ['IDLE', 'IDEA', 'LIFTING']) {
      this.stateWeights[s] = THREE.MathUtils.lerp(this.fromWeights[s] || 0, targetWeights[s], easeT);
    }

    // Smoothly interpolate emissive glow & visor color
    this.currentColor.lerpColors(this.fromColor, this.targetColor, easeT);
    this.currentEmissive = THREE.MathUtils.lerp(
      this.fromEmissive,
      STATE_EMISSIVE[this.state] || STATE_EMISSIVE.IDLE,
      easeT
    );
    this.matVisor.color.copy(this.currentColor);
    this.matVisor.emissive.copy(this.currentColor);
    this.matVisor.emissiveIntensity = this.currentEmissive;
    if (this.ringMat) this.ringMat.color.copy(this.currentColor);

    const wIdle = this.stateWeights.IDLE;
    const wIdea = this.stateWeights.IDEA;
    const wLift = this.stateWeights.LIFTING;

    // 4. Procedural continuous dynamics layered on top of currentBasePose
    // Copy base values
    for (const key in this.currentBasePose) {
      this.finalPose[key] = this.currentBasePose[key];
    }

    // --- IDLE Dynamics: slow breathing, tiny head sway, arms hanging loosely ---
    if (wIdle > 0.001) {
      // Slow rhythmic breathing (period ~3.9s)
      const breath = Math.sin(time * 1.6);
      this.finalPose.torsoY += breath * 0.032 * wIdle;
      this.finalPose.torsoRotX += breath * 0.018 * wIdle;

      // Tiny head sway in counter-motion
      this.finalPose.headRotY += Math.sin(time * 0.85) * 0.045 * wIdle;
      this.finalPose.headRotZ += Math.cos(time * 0.65) * 0.025 * wIdle;
      this.finalPose.headRotX += -breath * 0.02 * wIdle;

      // Arms hanging loosely, subtle sway with respiration
      this.finalPose.leftArmRotX += breath * 0.025 * wIdle;
      this.finalPose.rightArmRotX += breath * 0.025 * wIdle;
      this.finalPose.leftArmRotZ += breath * 0.015 * wIdle;
      this.finalPose.rightArmRotZ -= breath * 0.015 * wIdle;
    }

    // --- IDEA Dynamics: head tilts, one hand to chin, pulsing lightbulb ---
    if (wIdea > 0.001) {
      // Gentle contemplative micro-motion
      this.finalPose.headRotZ += Math.sin(time * 1.8) * 0.02 * wIdea;
      this.finalPose.headRotX += Math.cos(time * 1.4) * 0.012 * wIdea;
      this.finalPose.torsoRotY += Math.sin(time * 1.1) * 0.01 * wIdea;

      // Small glowing lightbulb pulsing above the head
      const bulbPulse = Math.sin(time * 5.2);
      this.lightbulbGroup.visible = true;
      const bScale = wIdea * (1.0 + bulbPulse * 0.08);
      this.lightbulbGroup.scale.set(bScale, bScale, bScale);
      this.lightbulbGroup.position.y = 1.25 + Math.sin(time * 3.2) * 0.025;
      this.bulbMat.emissiveIntensity = 3.2 + bulbPulse * 1.4;
      this.bulbLight.intensity = wIdea * (1.8 + bulbPulse * 0.8);
      this.rayMat.opacity = Math.max(0, wIdea * (0.8 + bulbPulse * 0.2));
      for (let r = 0; r < this.bulbRays.length; r++) {
        this.bulbRays[r].scale.setScalar(1.0 + bulbPulse * 0.12);
      }

      if (this.antennaTip) {
        this.antennaTip.scale.setScalar(1.0 + Math.max(0, bulbPulse) * 0.2 * wIdea);
      }
    } else {
      if (this.lightbulbGroup && this.lightbulbGroup.visible) {
        this.lightbulbGroup.visible = false;
        this.lightbulbGroup.scale.set(0, 0, 0);
      }
    }

    // --- HEAVY LIFTING Dynamics: both arms raised, body leans back, robot vibrates, orange sparks ---
    let vibeX = 0, vibeY = 0, vibeZ = 0;
    if (wLift > 0.001) {
      // Whole robot mechanical vibration under heavy strain
      const vibeAmt = wLift * 0.008;
      vibeX = (Math.sin(time * 52) + Math.cos(time * 68) * 0.6) * vibeAmt;
      vibeY = Math.sin(time * 60) * (vibeAmt * 0.5);
      vibeZ = Math.cos(time * 46) * (vibeAmt * 0.7);

      // Strain tremors on torso and arms
      this.finalPose.torsoRotX += (Math.sin(time * 44) + (Math.random() - 0.5) * 0.4) * 0.016 * wLift;
      this.finalPose.leftArmRotX += (Math.cos(time * 50) + (Math.random() - 0.5) * 0.4) * 0.02 * wLift;
      this.finalPose.rightArmRotX += (Math.sin(time * 54) + (Math.random() - 0.5) * 0.4) * 0.02 * wLift;
      this.finalPose.leftArmRotZ += Math.sin(time * 42) * 0.015 * wLift;
      this.finalPose.rightArmRotZ -= Math.sin(time * 42) * 0.015 * wLift;
    }
    this.robotRoot.position.set(vibeX, vibeY, vibeZ);

    // 5. Update Sparks Particle System
    this.updateSparks(dt, wLift);

    // 6. Apply transforms to Three.js Robot hierarchy
    this.pelvis.position.y = this.finalPose.torsoY;
    this.torsoGroup.rotation.x = this.finalPose.torsoRotX;
    this.torsoGroup.rotation.y = this.finalPose.torsoRotY;
    this.torsoGroup.rotation.z = this.finalPose.torsoRotZ;

    this.headGroup.rotation.x = this.finalPose.headRotX;
    this.headGroup.rotation.y = this.finalPose.headRotY;
    this.headGroup.rotation.z = this.finalPose.headRotZ;

    this.leftShoulder.rotation.x = this.finalPose.leftArmRotX;
    this.leftShoulder.rotation.y = this.finalPose.leftArmRotY;
    this.leftShoulder.rotation.z = this.finalPose.leftArmRotZ;
    this.leftElbow.rotation.x = this.finalPose.leftElbowRotX;
    this.leftElbow.rotation.y = this.finalPose.leftElbowRotY;
    this.leftElbow.rotation.z = this.finalPose.leftElbowRotZ;

    this.rightShoulder.rotation.x = this.finalPose.rightArmRotX;
    this.rightShoulder.rotation.y = this.finalPose.rightArmRotY;
    this.rightShoulder.rotation.z = this.finalPose.rightArmRotZ;
    this.rightElbow.rotation.x = this.finalPose.rightElbowRotX;
    this.rightElbow.rotation.y = this.finalPose.rightElbowRotY;
    this.rightElbow.rotation.z = this.finalPose.rightElbowRotZ;

    this.leftHip.rotation.x = this.finalPose.leftLegRotX;
    this.leftKnee.rotation.x = this.finalPose.leftKneeRotX;
    this.rightHip.rotation.x = this.finalPose.rightLegRotX;
    this.rightKnee.rotation.x = this.finalPose.rightKneeRotX;

    // Dynamically modulate the soft shadow breathing and scale with pose
    if (this.softShadow) {
      const heightDelta = this.finalPose.torsoY - 1.05;
      const shadowScale = 1.0 - heightDelta * 0.45;
      this.softShadow.scale.set(shadowScale, shadowScale, 1.0);
      if (this.softShadow.material) {
        this.softShadow.material.opacity = Math.min(1.0, Math.max(0.5, 0.9 - heightDelta * 0.8));
      }
    }

    // Guarantee renderer dimensions always match container exactly
    const curW = this.container.clientWidth;
    const curH = this.container.clientHeight;
    if (curW > 0 && curH > 0 && (this.lastW !== curW || this.lastH !== curH)) {
      this.lastW = curW;
      this.lastH = curH;
      this.camera.aspect = curW / curH;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(curW, curH);
    }

    // Render Scene
    this.renderer.render(this.scene, this.camera);
  }

  getJointScreenPositions() {
    const rect = this.container.getBoundingClientRect();
    const result = {};

    const projectToScreen = (obj) => {
      const v = new THREE.Vector3();
      obj.getWorldPosition(v);
      v.project(this.camera);

      // NDC coordinates [-1, 1] to screen pixel coordinates
      const x = rect.left + (v.x * 0.5 + 0.5) * rect.width;
      const y = rect.top + (-v.y * 0.5 + 0.5) * rect.height;
      return { x, y };
    };

    if (this.anchors.head) result.head = projectToScreen(this.anchors.head);
    if (this.anchors.chest) result.chest = projectToScreen(this.anchors.chest);
    if (this.anchors.leftHand) result.leftHand = projectToScreen(this.anchors.leftHand);
    if (this.anchors.rightHand) result.rightHand = projectToScreen(this.anchors.rightHand);
    if (this.anchors.feet) result.feet = projectToScreen(this.anchors.feet);

    return result;
  }

  onResize() {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  destroy() {
    window.removeEventListener('resize', this.onResize);
    if (this.sparksGeo) this.sparksGeo.dispose();
    if (this.sparksMat) {
      if (this.sparksMat.map) this.sparksMat.map.dispose();
      this.sparksMat.dispose();
    }
    if (this.bulbMat) this.bulbMat.dispose();
    if (this.rayMat) this.rayMat.dispose();
    this.renderer.dispose();
  }
}
