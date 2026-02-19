// THE MIDNIGHT CLOCK
// A single hand moves from 6 o'clock (noon/safe) clockwise toward 12 o'clock (midnight/crisis).
// The hand trembles, pulses, breathes with the data.
// Domain threads braid into the hand. Visual style shifts with regime.

let nerve;
let clockRadius;
let particles = [];
let handAngle = 0;
let targetAngle = 0;
let breathPhase = 0;
let tickMarks = [];
let crackLines = [];
let prevColors = null;
let colorLerp = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  nerve = new NerveData();
  nerve.fetchLive();
  
  clockRadius = min(width, height) * 0.32;
  
  // Generate tick marks (60 minute marks around the full circle)
  for (let i = 0; i < 60; i++) {
    let angle = map(i, 0, 60, 0, TWO_PI) - HALF_PI; // start from 12 o'clock
    let isMajor = i % 5 === 0;
    tickMarks.push({ angle, isMajor, wobble: random(0.001, 0.003), idx: i });
  }
  
  // Generate crack lines for CRITICAL regime
  for (let i = 0; i < 40; i++) {
    let a = random(TWO_PI);
    let r = random(clockRadius * 0.2, clockRadius * 1.3);
    let pts = [];
    let x = cos(a) * r;
    let y = sin(a) * r;
    for (let j = 0; j < random(3, 10); j++) {
      pts.push({ x: x + random(-15, 15), y: y + random(-15, 15) });
      x += random(-25, 25);
      y += random(-25, 25);
    }
    crackLines.push({ pts, alpha: random(0.2, 0.9), threshold: random(0.7, 0.9) });
  }
}

function draw() {
  nerve.update();
  
  let colors = nerve.getRegimeColors();
  breathPhase += 0.012;
  
  // Hand angle: 0.0 edge score = 6 o'clock (bottom, HALF_PI)
  //             1.0 edge score = 12 o'clock (top, -HALF_PI or 3*HALF_PI)
  // Moving clockwise from 6 o'clock through 9, 12
  // In p5 angles: 6 o'clock = HALF_PI, going clockwise means increasing angle
  // 6 o'clock (HALF_PI) → 9 o'clock (PI) → 12 o'clock (PI + HALF_PI or -HALF_PI)
  targetAngle = HALF_PI + nerve.edgeScore * PI; // sweeps 180° clockwise from 6 to 12
  handAngle = lerp(handAngle, targetAngle, 0.012);
  
  // Background with regime color
  background(colors.bg[0], colors.bg[1], colors.bg[2]);
  
  push();
  translate(width / 2, height / 2);
  
  // Ambient radial glow
  drawAmbientGlow(colors);
  
  // Draw crack lines in CRITICAL
  if (nerve.regime === 'CRITICAL' || nerve.edgeScore > 0.75) {
    drawCracks(colors);
  }
  
  // Draw the clock face ring and ticks
  drawClockFace(colors);
  
  // Draw hour markers
  drawHourMarkers(colors);
  
  // Draw domain threads braiding into hand
  drawDomainThreads(colors);
  
  // Draw the main hand
  drawHand(colors);
  
  // Draw center hub
  drawCenterHub(colors);
  
  // Draw midnight danger marker
  drawMidnightMarker(colors);
  
  pop();
  
  // Draw edge score
  drawScoreText(colors);
  
  // Draw regime label
  drawRegimeLabel(colors);
  
  // Update particles
  updateParticles(colors);
  
  // Sim badge
  document.getElementById('sim-badge').className = nerve.simMode ? 'active' : '';
}

function drawAmbientGlow(colors) {
  let pulseAmt = sin(breathPhase) * 0.12 + 0.88;
  let glowSize = clockRadius * (2.0 + nerve.edgeScore * 1.0) * pulseAmt;
  
  for (let r = glowSize; r > 0; r -= 5) {
    let t = r / glowSize;
    let alpha = (1 - t) * (6 + nerve.edgeScore * 10);
    noStroke();
    fill(colors.primary[0], colors.primary[1], colors.primary[2], alpha);
    ellipse(0, 0, r, r);
  }
}

function drawClockFace(colors) {
  // Outer ring
  noFill();
  let ringPulse = sin(breathPhase * 0.5) * 5 + 40;
  stroke(colors.primary[0], colors.primary[1], colors.primary[2], ringPulse);
  strokeWeight(1.5);
  ellipse(0, 0, clockRadius * 2, clockRadius * 2);
  
  // Faint second ring
  stroke(colors.secondary[0], colors.secondary[1], colors.secondary[2], ringPulse * 0.3);
  strokeWeight(0.5);
  ellipse(0, 0, clockRadius * 2.06, clockRadius * 2.06);
  
  // Tick marks
  for (let tick of tickMarks) {
    let wobble = sin(breathPhase * 2 + tick.angle * 3) * tick.wobble * nerve.edgeScore * 25;
    let innerR = tick.isMajor ? clockRadius * 0.87 : clockRadius * 0.93;
    let outerR = clockRadius * 0.98;
    
    let a = tick.angle + wobble;
    let x1 = cos(a) * innerR;
    let y1 = sin(a) * innerR;
    let x2 = cos(a) * outerR;
    let y2 = sin(a) * outerR;
    
    let tickAlpha = tick.isMajor ? 70 : 30;
    
    // Brighten ticks near the hand
    let angleDist = abs(angleDifference(a, handAngle));
    if (angleDist < 0.4) {
      tickAlpha += map(angleDist, 0, 0.4, 100, 0);
    }
    
    // Ticks in the "danger zone" (near midnight) glow red
    let midnightDist = abs(angleDifference(tick.angle, -HALF_PI));
    if (midnightDist < 0.6 && nerve.edgeScore > 0.5) {
      let dangerMix = (1 - midnightDist / 0.6) * (nerve.edgeScore - 0.5) * 2;
      stroke(
        lerp(colors.primary[0], 255, dangerMix * 0.5),
        lerp(colors.primary[1], 40, dangerMix * 0.5),
        lerp(colors.primary[2], 20, dangerMix * 0.5),
        tickAlpha
      );
    } else {
      stroke(colors.primary[0], colors.primary[1], colors.primary[2], tickAlpha);
    }
    
    strokeWeight(tick.isMajor ? 2 : 0.8);
    line(x1, y1, x2, y2);
  }
}

function drawHourMarkers(colors) {
  textAlign(CENTER, CENTER);
  textFont('Courier New');
  textSize(13);
  noStroke();
  
  let labelR = clockRadius * 1.12;
  
  // XII at top (midnight) — always prominent
  let midnightAlpha = 60 + nerve.edgeScore * 60;
  fill(colors.primary[0], colors.primary[1], colors.primary[2], midnightAlpha);
  text('XII', cos(-HALF_PI) * labelR, sin(-HALF_PI) * labelR);
  
  // VI at bottom (noon/safe) — subtle
  fill(colors.primary[0], colors.primary[1], colors.primary[2], 25);
  text('VI', cos(HALF_PI) * labelR, sin(HALF_PI) * labelR);
  
  // III and IX
  fill(colors.primary[0], colors.primary[1], colors.primary[2], 18);
  text('III', cos(0) * labelR, sin(0) * labelR);
  text('IX', cos(PI) * labelR, sin(PI) * labelR);
}

function drawDomainThreads(colors) {
  let domains = nerve.getDomainNames();
  
  for (let i = 0; i < domains.length; i++) {
    let domain = domains[i];
    let domainScore = nerve.domains[domain].score;
    let domainColor = nerve.getDomainColor(domain);
    
    // Each domain thread spirals from the center outward along the hand direction
    // with slight angular offset
    let offset = map(i, 0, domains.length, -0.12, 0.12);
    let threadAngle = handAngle + offset;
    let threadLength = clockRadius * 0.7 * (0.2 + domainScore * 0.8);
    
    noFill();
    beginShape();
    for (let t = 0; t < 1; t += 0.015) {
      let r = threadLength * t;
      let waveAmp = (5 + domainScore * 18) * (1 - t * 0.7);
      let wobble = sin(breathPhase * 3 + t * 12 + i * 2.5) * waveAmp;
      wobble += cos(breathPhase * 5 + t * 8 + i * 1.7) * waveAmp * 0.3;
      
      let x = cos(threadAngle) * r + cos(threadAngle + HALF_PI) * wobble;
      let y = sin(threadAngle) * r + sin(threadAngle + HALF_PI) * wobble;
      
      let alpha = map(t, 0, 1, 3, 50) * domainScore;
      stroke(domainColor[0], domainColor[1], domainColor[2], alpha);
      strokeWeight(0.8 + domainScore * 2.5 * (1 - t * 0.6));
      vertex(x, y);
    }
    endShape();
    
    // Spawn particles along active threads
    if (random() < domainScore * 0.25) {
      let t = random(0.15, 0.85);
      let r = threadLength * t;
      let wobble = sin(breathPhase * 3 + t * 12 + i * 2.5) * (5 + domainScore * 18) * (1 - t * 0.7);
      particles.push({
        x: width/2 + cos(threadAngle) * r + cos(threadAngle + HALF_PI) * wobble,
        y: height/2 + sin(threadAngle) * r + sin(threadAngle + HALF_PI) * wobble,
        vx: random(-0.5, 0.5),
        vy: random(-0.5, 0.5),
        life: 1,
        decay: random(0.008, 0.025),
        size: random(1, 3.5),
        color: domainColor
      });
    }
  }
}

function drawHand(colors) {
  // Trembling increases with edge score
  let trembleAmt = nerve.edgeScore * 0.025;
  let tremble = sin(breathPhase * 7) * trembleAmt 
              + cos(breathPhase * 11) * trembleAmt * 0.6
              + sin(breathPhase * 17) * trembleAmt * 0.3;
  let currentAngle = handAngle + tremble;
  
  let handLength = clockRadius * 0.82;
  let tipX = cos(currentAngle) * handLength;
  let tipY = sin(currentAngle) * handLength;
  
  // Wide glow behind hand
  let glowPulse = sin(breathPhase * 2) * 0.25 + 0.75;
  for (let w = 24; w > 0; w -= 1.5) {
    stroke(colors.accent[0], colors.accent[1], colors.accent[2], (2.5 * glowPulse));
    strokeWeight(w);
    line(0, 0, tipX, tipY);
  }
  
  // Main hand line
  stroke(colors.accent[0], colors.accent[1], colors.accent[2], 220);
  strokeWeight(2.5);
  line(0, 0, tipX, tipY);
  
  // Bright white core line
  stroke(255, 255, 255, 60);
  strokeWeight(1);
  line(0, 0, tipX, tipY);
  
  // Tip glow
  let tipGlow = sin(breathPhase * 4) * 3 + 7;
  noStroke();
  for (let r = tipGlow * 3; r > 0; r -= 2) {
    fill(colors.accent[0], colors.accent[1], colors.accent[2], map(r, 0, tipGlow * 3, 40, 0));
    ellipse(tipX, tipY, r, r);
  }
  fill(255, 255, 255, 100);
  ellipse(tipX, tipY, tipGlow * 0.4, tipGlow * 0.4);
  
  // Counter-balance tail
  let tailLength = clockRadius * 0.12;
  let tailX = cos(currentAngle + PI) * tailLength;
  let tailY = sin(currentAngle + PI) * tailLength;
  stroke(colors.accent[0], colors.accent[1], colors.accent[2], 80);
  strokeWeight(2.5);
  line(0, 0, tailX, tailY);
}

function drawCenterHub(colors) {
  let pulse = sin(breathPhase * 2) * 2 + 9;
  
  // Outer glow
  for (let r = 35; r > 0; r -= 1.5) {
    noStroke();
    fill(colors.accent[0], colors.accent[1], colors.accent[2], map(r, 0, 35, 20, 0));
    ellipse(0, 0, r, r);
  }
  
  // Hub
  fill(colors.accent[0], colors.accent[1], colors.accent[2], 200);
  noStroke();
  ellipse(0, 0, pulse, pulse);
  
  // White core
  fill(255, 255, 255, 180);
  ellipse(0, 0, pulse * 0.35, pulse * 0.35);
}

function drawMidnightMarker(colors) {
  // Midnight marker at 12 o'clock (top)
  let markerAngle = -HALF_PI;
  let mInner = clockRadius * 0.98;
  let mOuter = clockRadius * 1.08;
  
  let mx1 = cos(markerAngle) * mInner;
  let my1 = sin(markerAngle) * mInner;
  let mx2 = cos(markerAngle) * mOuter;
  let my2 = sin(markerAngle) * mOuter;
  
  // Proximity of hand to midnight
  let proximity = 1 - abs(angleDifference(handAngle, markerAngle)) / PI;
  proximity = constrain(proximity, 0, 1);
  proximity = pow(proximity, 2);
  
  let pulse = sin(breathPhase * 3) * 0.3 + 0.7;
  
  // Danger glow
  let glowAlpha = proximity * 50 * pulse;
  for (let r = 50; r > 0; r -= 3) {
    noStroke();
    fill(255, 40, 20, glowAlpha * (1 - r/50));
    ellipse(mx2, my2, r, r);
  }
  
  // Marker line
  stroke(255, 40, 20, 50 + proximity * 180);
  strokeWeight(3);
  line(mx1, my1, mx2, my2);
  
  // Small flanking lines
  for (let offset of [-0.05, 0.05]) {
    let a = markerAngle + offset;
    let x1 = cos(a) * (mInner + 2);
    let y1 = sin(a) * (mInner + 2);
    let x2 = cos(a) * (mOuter - 3);
    let y2 = sin(a) * (mOuter - 3);
    stroke(255, 40, 20, 30 + proximity * 80);
    strokeWeight(1);
    line(x1, y1, x2, y2);
  }
}

function drawCracks(colors) {
  let intensity = map(nerve.edgeScore, 0.75, 1, 0, 1);
  intensity = constrain(intensity, 0, 1);
  
  for (let crack of crackLines) {
    let crackVis = map(nerve.edgeScore, crack.threshold, crack.threshold + 0.1, 0, 1);
    crackVis = constrain(crackVis, 0, 1);
    if (crackVis <= 0) continue;
    
    // Flickering
    if (random() > crackVis * crack.alpha * 0.8 + 0.2) continue;
    
    stroke(255, 50, 15, 25 * crackVis * crack.alpha);
    strokeWeight(random(0.5, 2.5));
    noFill();
    beginShape();
    for (let pt of crack.pts) {
      let jitter = crackVis * 3;
      vertex(pt.x + random(-jitter, jitter), pt.y + random(-jitter, jitter));
    }
    endShape();
    
    // Ember particles
    if (random() < 0.03 * crackVis) {
      let pt = random(crack.pts);
      particles.push({
        x: width/2 + pt.x,
        y: height/2 + pt.y,
        vx: random(-0.8, 0.8),
        vy: random(-1.5, -0.3),
        life: 1,
        decay: random(0.01, 0.04),
        size: random(1, 3),
        color: [255, random(50, 160), 15]
      });
    }
  }
}

function drawScoreText(colors) {
  let scoreStr = nf(nerve.edgeScore, 1, 3);
  let pulse = sin(breathPhase * 2) * 0.06 + 0.94;
  
  push();
  textAlign(CENTER, CENTER);
  textFont('Courier New');
  
  // Score below center
  textSize(44);
  fill(colors.accent[0], colors.accent[1], colors.accent[2], 170 * pulse);
  text(scoreStr, width/2, height/2 + clockRadius * 0.42);
  
  // Label
  textSize(9);
  fill(colors.primary[0], colors.primary[1], colors.primary[2], 40);
  text('EDGE SCORE', width/2, height/2 + clockRadius * 0.42 + 28);
  
  pop();
}

function drawRegimeLabel(colors) {
  push();
  textAlign(CENTER, CENTER);
  textFont('Courier New');
  textSize(11);
  
  let labelAlpha = 35 + sin(breathPhase) * 12;
  fill(colors.primary[0], colors.primary[1], colors.primary[2], labelAlpha);
  text(nerve.regime, width/2, height/2 - clockRadius * 0.35);
  
  textSize(8);
  fill(colors.secondary[0], colors.secondary[1], colors.secondary[2], 25);
  text('FRAGILITY ' + nf(nerve.fragility, 1, 2), width/2, height/2 - clockRadius * 0.35 + 16);
  
  pop();
}

function updateParticles(colors) {
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= p.decay;
    
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    
    noStroke();
    fill(p.color[0], p.color[1], p.color[2], p.life * 100);
    ellipse(p.x, p.y, p.size * p.life, p.size * p.life);
  }
  
  if (particles.length > 600) {
    particles.splice(0, particles.length - 600);
  }
}

// Utility: shortest angular difference
function angleDifference(a, b) {
  let diff = ((b - a + PI) % TWO_PI) - PI;
  if (diff < -PI) diff += TWO_PI;
  return diff;
}

function mousePressed() {
  nerve.simMode = true;
  nerve.nextSimLevel();
  document.getElementById('sim-badge').className = 'active';
}

function keyPressed() {
  if (key === ' ') {
    nerve.toggleSimMode();
    if (!nerve.simMode) {
      document.getElementById('sim-badge').className = '';
    }
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  clockRadius = min(width, height) * 0.32;
}
