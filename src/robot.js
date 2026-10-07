import * as THREE from 'three';

export class RobotScene {
  constructor(containerElement) {
    this.container = containerElement;
    this.state = 'IDLE'; // 'IDLE' | 'IDEA' | 'LIFTING'
    this.clock = new THREE.Clock();

    // Scene & Camera
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

    // Pedestal & Floor
    this.buildPlatform();

    // Animation Targets & Current Poses for smooth lerping
    this.pose = {
      // Breathing & Body
      torsoY: 1.4,
      torsoRotX: 0,
      torsoRotY: 0,
      torsoRotZ: 0,
      // Head
      headRotX: 0,
      headRotY: 0,
      headRotZ: 0,
      // Left Arm
      leftArmRotX: 0,
      leftArmRotY: 0,
      leftArmRotZ: 0.15,
      leftElbowRotX: 0.25,
      // Right Arm
      rightArmRotX: 0,
      rightArmRotY: 0,
      rightArmRotZ: -0.15,
      rightElbowRotX: 0.25,
      // Legs
      leftLegRotX: 0,
      rightLegRotX: 0,
      squatY: 0
    };

    this.currentPose = { ...this.pose };

    // Responsive Resize Listener
    this.onResize = this.onResize.bind(this);
    window.addEventListener('resize', this.onResize);
  }

  setupLighting() {
    // Ambient soft blue fill - strong enough so robot is clearly visible
    const ambientLight = new THREE.AmbientLight(0x405570, 2.8);
    this.scene.add(ambientLight);

    // Key Light (warm white directional with soft shadow)
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(3, 5, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.0005;
    this.scene.add(keyLight);

    // Front fill light
    const fillLight = new THREE.DirectionalLight(0x88bbff, 1.8);
    fillLight.position.set(0, 1.2, 4);
    this.scene.add(fillLight);

    // Cyan Rim Light from behind
    const rimLight = new THREE.DirectionalLight(0x00e5ff, 4.0);
    rimLight.position.set(-3, 3, -3);
    this.scene.add(rimLight);

    // Orange accent point light from underneath
    const accentLight = new THREE.PointLight(0xff7700, 3.0, 7);
    accentLight.position.set(0, 0.3, 1.5);
    this.scene.add(accentLight);
  }

  setupMaterials() {
    // Cyber armor body - brighter slate blue with metallic highlights
    this.matBody = new THREE.MeshStandardMaterial({
      color: 0x334460,
      metalness: 0.75,
      roughness: 0.35,
      flatShading: true
    });

    // Dark joints & accents
    this.matJoints = new THREE.MeshStandardMaterial({
      color: 0x1e2838,
      metalness: 0.9,
      roughness: 0.25
    });

    // Metallic trim / plates
    this.matPlates = new THREE.MeshStandardMaterial({
      color: 0x4f6588,
      metalness: 0.7,
      roughness: 0.35,
      flatShading: true
    });

    // Emissive Visor & Core
    this.matGlow = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x00e5ff,
      emissiveIntensity: 2.5,
      roughness: 0.1
    });

    // Antenna tip
    this.matAntenna = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xff8800,
      emissiveIntensity: 2.2
    });
  }

  buildRobot() {
    this.robotRoot = new THREE.Group();
    this.scene.add(this.robotRoot);

    // ---- Pelvis / Hips ----
    const pelvisGeo = new THREE.BoxGeometry(0.85, 0.3, 0.55);
    this.pelvis = new THREE.Mesh(pelvisGeo, this.matBody);
    this.pelvis.castShadow = true;
    this.pelvis.position.y = 1.05;
    this.robotRoot.add(this.pelvis);

    // ---- Torso (Child of Pelvis) ----
    this.torsoGroup = new THREE.Group();
    this.torsoGroup.position.set(0, 0.15, 0);
    this.pelvis.add(this.torsoGroup);

    // Main Chest Box
    const chestGeo = new THREE.BoxGeometry(1.05, 1.1, 0.7);
    this.chest = new THREE.Mesh(chestGeo, this.matBody);
    this.chest.position.y = 0.65;
    this.chest.castShadow = true;
    this.torsoGroup.add(this.chest);

    // Front Chest Armor Plate
    const plateGeo = new THREE.BoxGeometry(0.85, 0.8, 0.12);
    const chestPlate = new THREE.Mesh(plateGeo, this.matPlates);
    chestPlate.position.set(0, 0.65, 0.36);
    this.torsoGroup.add(chestPlate);

    // Glowing Chest Core (Middle Finger Anchor)
    const coreGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.16, 12);
    coreGeo.rotateX(Math.PI / 2);
    this.chestCore = new THREE.Mesh(coreGeo, this.matGlow);
    this.chestCore.position.set(0, 0.65, 0.4);
    this.torsoGroup.add(this.chestCore);

    // Chest Joint Anchor for String (Index landmark 12)
    this.chestAnchor = new THREE.Object3D();
    this.chestAnchor.position.set(0, 0.65, 0.45);
    this.torsoGroup.add(this.chestAnchor);
    this.anchors.chest = this.chestAnchor;

    // ---- Neck & Head ----
    const neckGeo = new THREE.CylinderGeometry(0.16, 0.18, 0.2, 8);
    const neck = new THREE.Mesh(neckGeo, this.matJoints);
    neck.position.set(0, 1.25, 0);
    this.torsoGroup.add(neck);

    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 1.45, 0);
    this.torsoGroup.add(this.headGroup);

    // Low-poly Head Box
    const headGeo = new THREE.BoxGeometry(0.72, 0.68, 0.72);
    this.headMesh = new THREE.Mesh(headGeo, this.matBody);
    this.headMesh.position.y = 0.34;
    this.headMesh.castShadow = true;
    this.headGroup.add(this.headMesh);

    // Glowing Visor
    const visorGeo = new THREE.BoxGeometry(0.56, 0.2, 0.12);
    this.visor = new THREE.Mesh(visorGeo, this.matGlow);
    this.visor.position.set(0, 0.34, 0.38);
    this.headGroup.add(this.visor);

    // Ears / Side bolts
    const earGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.1, 8);
    earGeo.rotateZ(Math.PI / 2);
    const leftEar = new THREE.Mesh(earGeo, this.matJoints);
    leftEar.position.set(-0.4, 0.34, 0);
    const rightEar = new THREE.Mesh(earGeo, this.matJoints);
    rightEar.position.set(0.4, 0.34, 0);
    this.headGroup.add(leftEar, rightEar);

    // Antenna on top of head
    const antennaStemGeo = new THREE.CylinderGeometry(0.03, 0.04, 0.4, 6);
    const antennaStem = new THREE.Mesh(antennaStemGeo, this.matJoints);
    antennaStem.position.set(0, 0.85, 0);
    this.headGroup.add(antennaStem);

    const antennaTipGeo = new THREE.SphereGeometry(0.08, 10, 10);
    this.antennaTip = new THREE.Mesh(antennaTipGeo, this.matAntenna);
    this.antennaTip.position.set(0, 1.08, 0);
    this.headGroup.add(this.antennaTip);

    // Head Anchor for String (Index landmark 8)
    this.headAnchor = new THREE.Object3D();
    this.headAnchor.position.set(0, 1.15, 0);
    this.headGroup.add(this.headAnchor);
    this.anchors.head = this.headAnchor;

    // ---- Left Arm (Viewer's Left, Model's Right or Left) ----
    // Left Shoulder Pivot
    this.leftShoulder = new THREE.Group();
    this.leftShoulder.position.set(-0.68, 1.05, 0);
    this.torsoGroup.add(this.leftShoulder);

    const shoulderBallGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const leftShoulderBall = new THREE.Mesh(shoulderBallGeo, this.matJoints);
    this.leftShoulder.add(leftShoulderBall);

    // Left Upper Arm
    const upperArmGeo = new THREE.BoxGeometry(0.24, 0.55, 0.24);
    const leftUpperArm = new THREE.Mesh(upperArmGeo, this.matBody);
    leftUpperArm.position.set(0, -0.32, 0);
    leftUpperArm.castShadow = true;
    this.leftShoulder.add(leftUpperArm);

    // Left Elbow Pivot
    this.leftElbow = new THREE.Group();
    this.leftElbow.position.set(0, -0.62, 0);
    this.leftShoulder.add(this.leftElbow);

    const elbowBallGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const leftElbowBall = new THREE.Mesh(elbowBallGeo, this.matJoints);
    this.leftElbow.add(leftElbowBall);

    // Left Forearm
    const forearmGeo = new THREE.BoxGeometry(0.22, 0.5, 0.22);
    const leftForearm = new THREE.Mesh(forearmGeo, this.matPlates);
    leftForearm.position.set(0, -0.3, 0);
    leftForearm.castShadow = true;
    this.leftElbow.add(leftForearm);

    // Left Hand (Thumb Anchor)
    const handGeo = new THREE.BoxGeometry(0.2, 0.22, 0.16);
    const leftHand = new THREE.Mesh(handGeo, this.matJoints);
    leftHand.position.set(0, -0.6, 0);
    this.leftElbow.add(leftHand);

    this.leftHandAnchor = new THREE.Object3D();
    this.leftHandAnchor.position.set(0, -0.72, 0);
    this.leftElbow.add(this.leftHandAnchor);
    this.anchors.leftHand = this.leftHandAnchor;

    // ---- Right Arm ----
    // Right Shoulder Pivot
    this.rightShoulder = new THREE.Group();
    this.rightShoulder.position.set(0.68, 1.05, 0);
    this.torsoGroup.add(this.rightShoulder);

    const rightShoulderBall = new THREE.Mesh(shoulderBallGeo, this.matJoints);
    this.rightShoulder.add(rightShoulderBall);

    // Right Upper Arm
    const rightUpperArm = new THREE.Mesh(upperArmGeo, this.matBody);
    rightUpperArm.position.set(0, -0.32, 0);
    rightUpperArm.castShadow = true;
    this.rightShoulder.add(rightUpperArm);

    // Right Elbow Pivot
    this.rightElbow = new THREE.Group();
    this.rightElbow.position.set(0, -0.62, 0);
    this.rightShoulder.add(this.rightElbow);

    const rightElbowBall = new THREE.Mesh(elbowBallGeo, this.matJoints);
    this.rightElbow.add(rightElbowBall);

    // Right Forearm
    const rightForearm = new THREE.Mesh(forearmGeo, this.matPlates);
    rightForearm.position.set(0, -0.3, 0);
    rightForearm.castShadow = true;
    this.rightElbow.add(rightForearm);

    // Right Hand (Ring Finger Anchor)
    const rightHand = new THREE.Mesh(handGeo, this.matJoints);
    rightHand.position.set(0, -0.6, 0);
    this.rightElbow.add(rightHand);

    this.rightHandAnchor = new THREE.Object3D();
    this.rightHandAnchor.position.set(0, -0.72, 0);
    this.rightElbow.add(this.rightHandAnchor);
    this.anchors.rightHand = this.rightHandAnchor;

    // ---- Left Leg ----
    this.leftHip = new THREE.Group();
    this.leftHip.position.set(-0.28, -0.15, 0);
    this.pelvis.add(this.leftHip);

    const hipBallGeo = new THREE.SphereGeometry(0.14, 8, 8);
    this.leftHip.add(new THREE.Mesh(hipBallGeo, this.matJoints));

    const thighGeo = new THREE.BoxGeometry(0.24, 0.55, 0.25);
    const leftThigh = new THREE.Mesh(thighGeo, this.matBody);
    leftThigh.position.set(0, -0.32, 0);
    leftThigh.castShadow = true;
    this.leftHip.add(leftThigh);

    this.leftKnee = new THREE.Group();
    this.leftKnee.position.set(0, -0.62, 0);
    this.leftHip.add(this.leftKnee);

    const kneeBallGeo = new THREE.SphereGeometry(0.12, 8, 8);
    this.leftKnee.add(new THREE.Mesh(kneeBallGeo, this.matJoints));

    const shinGeo = new THREE.BoxGeometry(0.22, 0.5, 0.24);
    const leftShin = new THREE.Mesh(shinGeo, this.matPlates);
    leftShin.position.set(0, -0.3, 0);
    leftShin.castShadow = true;
    this.leftKnee.add(leftShin);

    const footGeo = new THREE.BoxGeometry(0.26, 0.16, 0.44);
    const leftFoot = new THREE.Mesh(footGeo, this.matJoints);
    leftFoot.position.set(0, -0.58, 0.08);
    this.leftKnee.add(leftFoot);

    // ---- Right Leg ----
    this.rightHip = new THREE.Group();
    this.rightHip.position.set(0.28, -0.15, 0);
    this.pelvis.add(this.rightHip);

    this.rightHip.add(new THREE.Mesh(hipBallGeo, this.matJoints));

    const rightThigh = new THREE.Mesh(thighGeo, this.matBody);
    rightThigh.position.set(0, -0.32, 0);
    rightThigh.castShadow = true;
    this.rightHip.add(rightThigh);

    this.rightKnee = new THREE.Group();
    this.rightKnee.position.set(0, -0.62, 0);
    this.rightHip.add(this.rightKnee);

    this.rightKnee.add(new THREE.Mesh(kneeBallGeo, this.matJoints));

    const rightShin = new THREE.Mesh(shinGeo, this.matPlates);
    rightShin.position.set(0, -0.3, 0);
    rightShin.castShadow = true;
    this.rightKnee.add(rightShin);

    const rightFoot = new THREE.Mesh(footGeo, this.matJoints);
    rightFoot.position.set(0, -0.58, 0.08);
    this.rightKnee.add(rightFoot);

    // Feet Anchor for String (Pinky landmark 20)
    this.feetAnchor = new THREE.Object3D();
    this.feetAnchor.position.set(0, -0.05, 0.1);
    this.robotRoot.add(this.feetAnchor);
    this.anchors.feet = this.feetAnchor;
  }

  buildPlatform() {
    // Pedestal Cylinder
    const platformGeo = new THREE.CylinderGeometry(1.6, 1.8, 0.15, 24);
    const platformMat = new THREE.MeshStandardMaterial({
      color: 0x0a101a,
      roughness: 0.8,
      metalness: 0.5
    });
    const platform = new THREE.Mesh(platformGeo, platformMat);
    platform.position.y = -0.08;
    platform.receiveShadow = true;
    this.scene.add(platform);

    // Glowing Neon Ring on Platform
    const ringGeo = new THREE.RingGeometry(1.4, 1.48, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.005;
    this.scene.add(ring);

    // Subtle Outer Grid Ring
    const outerRingGeo = new THREE.RingGeometry(1.7, 1.74, 32);
    outerRingGeo.rotateX(-Math.PI / 2);
    const outerRingMat = new THREE.MeshBasicMaterial({
      color: 0xff7700,
      side: THREE.DoubleSide
    });
    const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
    outerRing.position.y = 0.005;
    this.scene.add(outerRing);
  }

  setState(newState) {
    if (this.state === newState) return;
    this.state = newState;

    // Update emissive color based on state
    if (newState === 'IDLE') {
      this.matGlow.color.setHex(0x00e5ff);
      this.matGlow.emissive.setHex(0x00e5ff);
      this.matGlow.emissiveIntensity = 2.0;
    } else if (newState === 'IDEA') {
      this.matGlow.color.setHex(0xffd600);
      this.matGlow.emissive.setHex(0xffd600);
      this.matGlow.emissiveIntensity = 3.2;
    } else if (newState === 'LIFTING') {
      this.matGlow.color.setHex(0xff2244);
      this.matGlow.emissive.setHex(0xff2244);
      this.matGlow.emissiveIntensity = 3.8;
    }
  }

  update(delta) {
    const time = this.clock.getElapsedTime();

    // 1. Calculate Target Pose based on State
    if (this.state === 'IDLE') {
      // Slow, rhythmic, organic breathing
      const breath = Math.sin(time * 1.6);
      this.pose.torsoY = 1.05 + breath * 0.04;
      this.pose.torsoRotX = breath * 0.02;
      this.pose.torsoRotY = Math.sin(time * 0.7) * 0.04;
      this.pose.torsoRotZ = 0;

      // Relaxed upright head
      this.pose.headRotX = -breath * 0.03;
      this.pose.headRotY = Math.sin(time * 0.9) * 0.05;
      this.pose.headRotZ = 0;

      // Natural arms at side
      this.pose.leftArmRotX = 0.1 + breath * 0.04;
      this.pose.leftArmRotY = 0;
      this.pose.leftArmRotZ = 0.18 + breath * 0.02;
      this.pose.leftElbowRotX = 0.25;

      this.pose.rightArmRotX = 0.1 + breath * 0.04;
      this.pose.rightArmRotY = 0;
      this.pose.rightArmRotZ = -0.18 - breath * 0.02;
      this.pose.rightElbowRotX = 0.25;

      this.pose.squatY = 0;
    } else if (this.state === 'IDEA') {
      // Head tilts curiously to the side, one arm raised pensively
      const pulse = Math.sin(time * 3.5);
      this.pose.torsoY = 1.05 + pulse * 0.02;
      this.pose.torsoRotX = -0.05;
      this.pose.torsoRotY = -0.15;
      this.pose.torsoRotZ = 0.05;

      // Head tilted quizzically
      this.pose.headRotX = -0.1;
      this.pose.headRotY = -0.35 + Math.sin(time * 1.5) * 0.08;
      this.pose.headRotZ = 0.42; // pronounced tilt

      // Left arm gesturing upward in thought / inspiration
      this.pose.leftArmRotX = -1.25 + Math.sin(time * 2.0) * 0.1;
      this.pose.leftArmRotY = 0.3;
      this.pose.leftArmRotZ = 0.4;
      this.pose.leftElbowRotX = 1.1;

      // Right arm rests relaxed
      this.pose.rightArmRotX = 0.15;
      this.pose.rightArmRotY = 0;
      this.pose.rightArmRotZ = -0.22;
      this.pose.rightElbowRotX = 0.35;

      this.pose.squatY = 0;

      // Pulse antenna
      this.antennaTip.scale.setScalar(1.0 + Math.max(0, pulse) * 0.3);
    } else if (this.state === 'LIFTING') {
      // HEAVY LIFTING: Arms raised overhead, knees bent into squat, body shakes with strain!
      const strainShake = (Math.random() - 0.5) * 0.045;
      const strainTremor = Math.sin(time * 28) * 0.035;

      this.pose.torsoY = 0.96 + strainShake + strainTremor * 0.5; // lower in squat
      this.pose.torsoRotX = 0.12 + strainShake;
      this.pose.torsoRotY = strainTremor * 0.3;
      this.pose.torsoRotZ = strainShake * 0.4;

      // Head pulled down and back under weight
      this.pose.headRotX = 0.25 + strainShake;
      this.pose.headRotY = strainTremor * 0.2;
      this.pose.headRotZ = strainShake * 0.5;

      // Both arms raised high overhead in heavy lifting pose
      this.pose.leftArmRotX = -2.3 + strainShake;
      this.pose.leftArmRotY = 0.2;
      this.pose.leftArmRotZ = 0.55 + strainTremor;
      this.pose.leftElbowRotX = 1.35 + strainShake;

      this.pose.rightArmRotX = -2.3 + strainShake;
      this.pose.rightArmRotY = -0.2;
      this.pose.rightArmRotZ = -0.55 - strainTremor;
      this.pose.rightElbowRotX = 1.35 + strainShake;

      this.pose.squatY = -0.09;
    }

    // 2. Smooth Lerp (Easing) towards Target Pose
    const lerpRate = this.state === 'LIFTING' ? 0.15 : 0.08;

    this.currentPose.torsoY += (this.pose.torsoY - this.currentPose.torsoY) * lerpRate;
    this.currentPose.torsoRotX += (this.pose.torsoRotX - this.currentPose.torsoRotX) * lerpRate;
    this.currentPose.torsoRotY += (this.pose.torsoRotY - this.currentPose.torsoRotY) * lerpRate;
    this.currentPose.torsoRotZ += (this.pose.torsoRotZ - this.currentPose.torsoRotZ) * lerpRate;

    this.currentPose.headRotX += (this.pose.headRotX - this.currentPose.headRotX) * lerpRate;
    this.currentPose.headRotY += (this.pose.headRotY - this.currentPose.headRotY) * lerpRate;
    this.currentPose.headRotZ += (this.pose.headRotZ - this.currentPose.headRotZ) * lerpRate;

    this.currentPose.leftArmRotX += (this.pose.leftArmRotX - this.currentPose.leftArmRotX) * lerpRate;
    this.currentPose.leftArmRotY += (this.pose.leftArmRotY - this.currentPose.leftArmRotY) * lerpRate;
    this.currentPose.leftArmRotZ += (this.pose.leftArmRotZ - this.currentPose.leftArmRotZ) * lerpRate;
    this.currentPose.leftElbowRotX += (this.pose.leftElbowRotX - this.currentPose.leftElbowRotX) * lerpRate;

    this.currentPose.rightArmRotX += (this.pose.rightArmRotX - this.currentPose.rightArmRotX) * lerpRate;
    this.currentPose.rightArmRotY += (this.pose.rightArmRotY - this.currentPose.rightArmRotY) * lerpRate;
    this.currentPose.rightArmRotZ += (this.pose.rightArmRotZ - this.currentPose.rightArmRotZ) * lerpRate;
    this.currentPose.rightElbowRotX += (this.pose.rightElbowRotX - this.currentPose.rightElbowRotX) * lerpRate;

    // 3. Apply to Three.js Object Transforms
    this.pelvis.position.y = this.currentPose.torsoY;
    this.torsoGroup.rotation.x = this.currentPose.torsoRotX;
    this.torsoGroup.rotation.y = this.currentPose.torsoRotY;
    this.torsoGroup.rotation.z = this.currentPose.torsoRotZ;

    this.headGroup.rotation.x = this.currentPose.headRotX;
    this.headGroup.rotation.y = this.currentPose.headRotY;
    this.headGroup.rotation.z = this.currentPose.headRotZ;

    this.leftShoulder.rotation.x = this.currentPose.leftArmRotX;
    this.leftShoulder.rotation.y = this.currentPose.leftArmRotY;
    this.leftShoulder.rotation.z = this.currentPose.leftArmRotZ;
    this.leftElbow.rotation.x = this.currentPose.leftElbowRotX;

    this.rightShoulder.rotation.x = this.currentPose.rightArmRotX;
    this.rightShoulder.rotation.y = this.currentPose.rightArmRotY;
    this.rightShoulder.rotation.z = this.currentPose.rightArmRotZ;
    this.rightElbow.rotation.x = this.currentPose.rightElbowRotX;

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
    this.renderer.dispose();
  }
}
