export class StringsRenderer {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.resize();

    this.onResize = this.onResize.bind(this);
    window.addEventListener('resize', this.onResize);
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  onResize() {
    this.resize();
  }

  render(fingertipPositions, robotJoints, state, time) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (!fingertipPositions || fingertipPositions.length === 0 || !robotJoints) {
      return;
    }

    // Mapping of 5 fingertips to robot joints:
    // 0 (Landmark 4: Thumb)     -> Left Hand (Viewer's left)
    // 1 (Landmark 8: Index)     -> Head
    // 2 (Landmark 12: Middle)   -> Chest
    // 3 (Landmark 16: Ring)     -> Right Hand (Viewer's right)
    // 4 (Landmark 20: Pinky)    -> Feet
    const stringPairs = [
      { finger: fingertipPositions[0], joint: robotJoints.leftHand, label: 'L-HAND' },
      { finger: fingertipPositions[1], joint: robotJoints.head, label: 'HEAD' },
      { finger: fingertipPositions[2], joint: robotJoints.chest, label: 'CHEST' },
      { finger: fingertipPositions[3], joint: robotJoints.rightHand, label: 'R-HAND' },
      { finger: fingertipPositions[4], joint: robotJoints.feet, label: 'FEET' }
    ];

    // Physics parameters according to state
    let baseSagMultiplier = 0.12;
    let baseSagOffset = 45;
    let tensionTremor = 0;

    if (state === 'IDEA') {
      baseSagMultiplier = 0.09;
      baseSagOffset = 35;
    } else if (state === 'LIFTING') {
      // Very taut strings under high load with strain vibration
      baseSagMultiplier = 0.035;
      baseSagOffset = 12;
      tensionTremor = (Math.random() - 0.5) * 5;
    }

    ctx.save();

    stringPairs.forEach((pair, index) => {
      if (!pair.finger || !pair.joint) return;

      const fx = pair.finger.x;
      const fy = pair.finger.y;
      const rx = pair.joint.x;
      const ry = pair.joint.y;

      // Calculate Quadratic Bezier Control Point with realistic gravitational sag
      const midX = (fx + rx) / 2;
      const midY = (fy + ry) / 2;
      const spanX = Math.abs(fx - rx);

      // Subtle dynamic harmonic oscillation
      const oscillation = Math.sin(time * 3.5 + index * 1.2) * (state === 'LIFTING' ? 1.5 : 4.0);
      const sag = spanX * baseSagMultiplier + baseSagOffset + oscillation + tensionTremor;

      const ctrlX = midX;
      const ctrlY = Math.max(fy, ry) < midY + sag ? midY + sag : Math.max(fy, ry) + sag * 0.4;

      // ---- Pass 1: Outer glowing neon bloom ----
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.quadraticCurveTo(ctrlX, ctrlY, rx, ry);
      ctx.lineWidth = state === 'LIFTING' ? 9 : 6.5;
      ctx.strokeStyle = state === 'LIFTING' ? 'rgba(255, 60, 40, 0.28)' : 'rgba(255, 110, 0, 0.24)';
      ctx.shadowColor = state === 'LIFTING' ? '#ff3311' : '#ff7700';
      ctx.shadowBlur = state === 'LIFTING' ? 24 : 16;
      ctx.stroke();

      // ---- Pass 2: Vibrant mid-orange string core ----
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.quadraticCurveTo(ctrlX, ctrlY, rx, ry);
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = state === 'LIFTING' ? 'rgba(255, 100, 60, 0.85)' : 'rgba(255, 150, 30, 0.85)';
      ctx.shadowColor = '#ff9900';
      ctx.shadowBlur = 8;
      ctx.stroke();

      // ---- Pass 3: Center bright white-hot filament ----
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.quadraticCurveTo(ctrlX, ctrlY, rx, ry);
      ctx.lineWidth = 1.0;
      ctx.strokeStyle = 'rgba(255, 245, 220, 0.95)';
      ctx.shadowBlur = 0;
      ctx.stroke();

      // ---- Energy Pulse Traveling along the String ----
      // Pulse parameter t in [0, 1]
      const speed = state === 'LIFTING' ? 1.8 : 0.8;
      const pulseT = ((time * speed + index * 0.22) % 1.0);
      
      // Quadratic Bezier formula: B(t) = (1-t)^2 P0 + 2(1-t)t P1 + t^2 P2
      const t = pulseT;
      const mt = 1 - t;
      const pulseX = mt * mt * fx + 2 * mt * t * ctrlX + t * t * rx;
      const pulseY = mt * mt * fy + 2 * mt * t * ctrlY + t * t * ry;

      ctx.beginPath();
      ctx.arc(pulseX, pulseY, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffaa00';
      ctx.shadowBlur = 12;
      ctx.fill();

      // ---- Attachment Dot on Robot Joint ----
      ctx.beginPath();
      ctx.arc(rx, ry, 4.0, 0, Math.PI * 2);
      ctx.fillStyle = '#ff7700';
      ctx.shadowColor = '#ff7700';
      ctx.shadowBlur = 10;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(rx, ry, 2.0, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 0;
      ctx.fill();
    });

    // ---- Draw White Dots on Fingertips (Landmarks 4, 8, 12, 16, 20) ----
    fingertipPositions.forEach((pt, i) => {
      if (!pt) return;

      // Outer glowing halo
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 119, 0, 0.25)';
      ctx.shadowColor = '#ff7700';
      ctx.shadowBlur = 12;
      ctx.fill();

      // Solid bright white dot
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 8;
      ctx.fill();

      // Fine outer stroke
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 5.5, 0, Math.PI * 2);
      ctx.strokeStyle = '#ff9900';
      ctx.lineWidth = 1.2;
      ctx.shadowBlur = 0;
      ctx.stroke();
    });

    ctx.restore();
  }

  destroy() {
    window.removeEventListener('resize', this.onResize);
  }
}
