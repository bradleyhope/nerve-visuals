// THE PULSE
// The Edge Score as a heartbeat / seismograph.
// A continuous line that breathes with the rhythm of global risk.
// Calm periods: slow, steady pulses. Stress: rapid, erratic.
// The line splits into domain-colored threads that converge and diverge.

let nerve;
let history = [];
let domainHistories = {};
let maxHistory = 800;
let phase = 0;
let beatPhase = 0;
let lastBeat = 0;
let beatInterval = 2000; // ms between beats
let scanX = 0;
let trailBuffer;
let afterglowParticles = [];

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  nerve = new NerveData();
  nerve.fetchLive();
  
  trailBuffer = createGraphics(width, height);
  trailBuffer.background(0, 0);
  
  // Initialize domain histories
  let domains = nerve.getDomainNames();
  for (let d of domains) {
    domainHistories[d] = [];
  }
  
  // Pre-fill history
  for (let i = 0; i < maxHistory; i++) {
    history.push(0.1);
    for (let d of domains) {
      domainHistories[d].push(0.01);
    }
  }
}

function draw() {
  nerve.update();
  
  let colors = nerve.getRegimeColors();
  phase += 0.01;
  
  // Beat timing — faster at higher edge scores
  beatInterval = map(nerve.edgeScore, 0, 1, 3000, 400);
  let timeSinceBeat = millis() - lastBeat;
  if (timeSinceBeat > beatInterval) {
    lastBeat = millis();
    beatPhase = 1.0;
  }
  beatPhase *= 0.92;
  
  // Generate heartbeat waveform value
  let beatValue = generateHeartbeat(timeSinceBeat / beatInterval, nerve.edgeScore);
  
  // Push to history
  history.push(nerve.edgeScore + beatValue * nerve.edgeScore * 0.5);
  if (history.length > maxHistory) history.shift();
  
  let domains = nerve.getDomainNames();
  for (let d of domains) {
    let domainBeat = beatValue * nerve.domains[d].score * 0.4;
    let noise_val = noise(phase * 2 + domains.indexOf(d) * 100) * 0.05;
    domainHistories[d].push(nerve.domains[d].score + domainBeat + noise_val);
    if (domainHistories[d].length > maxHistory) domainHistories[d].shift();
  }
  
  // Background with subtle fade
  background(colors.bg[0], colors.bg[1], colors.bg[2]);
  
  // Draw scan line effect
  drawScanLine(colors);
  
  // Draw grid
  drawGrid(colors);
  
  // Draw domain threads (behind main line)
  drawDomainThreads(colors);
  
  // Draw main pulse line
  drawMainPulse(colors);
  
  // Draw afterglow particles
  drawAfterglowParticles(colors);
  
  // Draw score display
  drawScoreDisplay(colors);
  
  // Draw domain legend
  drawDomainLegend(colors);
  
  // Sim badge
  document.getElementById('sim-badge').className = nerve.simMode ? 'active' : '';
}

function generateHeartbeat(t, intensity) {
  // t is 0-1 within beat cycle
  // Creates a realistic heartbeat waveform (QRS complex)
  t = t % 1;
  
  let val = 0;
  
  // P wave (small bump)
  val += 0.15 * exp(-pow((t - 0.1) * 20, 2));
  
  // QRS complex (sharp spike)
  val -= 0.2 * exp(-pow((t - 0.25) * 30, 2));
  val += 1.0 * exp(-pow((t - 0.3) * 25, 2));
  val -= 0.3 * exp(-pow((t - 0.35) * 30, 2));
  
  // T wave (recovery bump)
  val += 0.25 * exp(-pow((t - 0.55) * 12, 2));
  
  // Add noise proportional to intensity
  val += (noise(t * 50 + phase * 10) - 0.5) * intensity * 0.3;
  
  return val;
}

function drawScanLine(colors) {
  // Vertical scan line that sweeps across
  scanX = (scanX + map(nerve.edgeScore, 0, 1, 0.3, 1.5)) % width;
  
  for (let w = 60; w > 0; w -= 2) {
    let alpha = map(w, 0, 60, 8, 0);
    stroke(colors.accent[0], colors.accent[1], colors.accent[2], alpha);
    strokeWeight(1);
    line(scanX - w, 0, scanX - w, height);
  }
}

function drawGrid(colors) {
  // Horizontal grid lines
  stroke(colors.primary[0], colors.primary[1], colors.primary[2], 8);
  strokeWeight(0.5);
  
  let gridSpacing = height / 10;
  for (let y = gridSpacing; y < height; y += gridSpacing) {
    line(0, y, width, y);
  }
  
  // Threshold lines
  let thresholds = [
    { val: 0.25, label: 'ELEVATED', alpha: 15 },
    { val: 0.50, label: 'STRESSED', alpha: 20 },
    { val: 0.75, label: 'CRITICAL', alpha: 25 }
  ];
  
  for (let th of thresholds) {
    let y = map(th.val, 0, 1.5, height * 0.85, height * 0.1);
    stroke(colors.primary[0], colors.primary[1], colors.primary[2], th.alpha);
    strokeWeight(0.5);
    drawingContext.setLineDash([4, 8]);
    line(0, y, width, y);
    drawingContext.setLineDash([]);
    
    // Label
    noStroke();
    fill(colors.primary[0], colors.primary[1], colors.primary[2], th.alpha);
    textSize(8);
    textAlign(RIGHT, BOTTOM);
    text(th.label, width - 15, y - 3);
  }
}

function drawDomainThreads(colors) {
  let domains = nerve.getDomainNames();
  let visibleHistory = min(history.length, floor(width / 1.5));
  let startIdx = history.length - visibleHistory;
  
  for (let di = 0; di < domains.length; di++) {
    let d = domains[di];
    let domainColor = nerve.getDomainColor(d);
    let domainData = domainHistories[d];
    let domainScore = nerve.domains[d].score;
    
    // Thread alpha based on how active the domain is
    let baseAlpha = map(domainScore, 0, 1, 10, 60);
    
    noFill();
    beginShape();
    for (let i = 0; i < visibleHistory; i++) {
      let x = map(i, 0, visibleHistory, 0, width);
      let val = domainData[startIdx + i] || 0;
      let y = map(val, 0, 1.5, height * 0.85, height * 0.1);
      
      // Spread threads vertically based on domain index
      let spread = map(nerve.fragility, 0, 1, 15, 3);
      y += (di - 2) * spread;
      
      let fadeIn = map(i, 0, 50, 0, 1);
      fadeIn = constrain(fadeIn, 0, 1);
      
      stroke(domainColor[0], domainColor[1], domainColor[2], baseAlpha * fadeIn);
      strokeWeight(1 + domainScore);
      vertex(x, y);
    }
    endShape();
  }
}

function drawMainPulse(colors) {
  let visibleHistory = min(history.length, floor(width / 1.5));
  let startIdx = history.length - visibleHistory;
  
  // Glow layer
  for (let w = 3; w >= 0; w--) {
    noFill();
    beginShape();
    for (let i = 0; i < visibleHistory; i++) {
      let x = map(i, 0, visibleHistory, 0, width);
      let val = history[startIdx + i] || 0;
      let y = map(val, 0, 1.5, height * 0.85, height * 0.1);
      
      let fadeIn = map(i, 0, 30, 0, 1);
      fadeIn = constrain(fadeIn, 0, 1);
      let recency = map(i, 0, visibleHistory, 0.3, 1);
      
      let alpha = w === 0 ? 200 * fadeIn * recency : (20 - w * 5) * fadeIn * recency;
      let weight = w === 0 ? 2 : w * 4;
      
      stroke(colors.accent[0], colors.accent[1], colors.accent[2], alpha);
      strokeWeight(weight);
      vertex(x, y);
    }
    endShape();
  }
  
  // Leading edge particle burst
  let lastVal = history[history.length - 1] || 0;
  let lastY = map(lastVal, 0, 1.5, height * 0.85, height * 0.1);
  
  // Bright dot at leading edge
  let dotPulse = sin(phase * 8) * 3 + 8;
  noStroke();
  fill(colors.accent[0], colors.accent[1], colors.accent[2], 200);
  ellipse(width, lastY, dotPulse, dotPulse);
  fill(255, 255, 255, 120);
  ellipse(width, lastY, dotPulse * 0.4, dotPulse * 0.4);
  
  // Spawn afterglow particles on beats
  if (beatPhase > 0.5) {
    for (let i = 0; i < 3; i++) {
      afterglowParticles.push({
        x: width + random(-5, 5),
        y: lastY + random(-10, 10),
        vx: random(-2, -0.5),
        vy: random(-2, 2),
        life: 1,
        decay: random(0.01, 0.03),
        size: random(1, 4),
        color: [...colors.accent]
      });
    }
  }
}

function drawAfterglowParticles(colors) {
  for (let i = afterglowParticles.length - 1; i >= 0; i--) {
    let p = afterglowParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy *= 0.98;
    p.life -= p.decay;
    
    if (p.life <= 0) {
      afterglowParticles.splice(i, 1);
      continue;
    }
    
    noStroke();
    fill(p.color[0], p.color[1], p.color[2], p.life * 100);
    ellipse(p.x, p.y, p.size * p.life, p.size * p.life);
  }
  
  if (afterglowParticles.length > 300) {
    afterglowParticles.splice(0, afterglowParticles.length - 300);
  }
}

function drawScoreDisplay(colors) {
  let scoreStr = nf(nerve.edgeScore, 1, 3);
  let pulse = sin(phase * 4) * 0.1 + 0.9;
  
  push();
  // Score in top left
  textFont('Courier New');
  textAlign(LEFT, TOP);
  
  // Large score
  textSize(64);
  fill(colors.accent[0], colors.accent[1], colors.accent[2], 180 * pulse);
  text(scoreStr, 30, 25);
  
  // Label
  textSize(10);
  fill(colors.primary[0], colors.primary[1], colors.primary[2], 40);
  text('EDGE SCORE', 34, 92);
  
  // Regime
  textSize(12);
  fill(colors.primary[0], colors.primary[1], colors.primary[2], 50);
  text(nerve.regime, 34, 110);
  
  // BPM-like display (beats per minute based on interval)
  let bpm = floor(60000 / beatInterval);
  textSize(9);
  fill(colors.secondary[0], colors.secondary[1], colors.secondary[2], 35);
  text(bpm + ' BPM', 34, 130);
  
  pop();
}

function drawDomainLegend(colors) {
  let domains = nerve.getDomainNames();
  let startY = height - 30;
  let spacing = width / (domains.length + 1);
  
  push();
  textFont('Courier New');
  textAlign(CENTER, CENTER);
  textSize(8);
  
  for (let i = 0; i < domains.length; i++) {
    let d = domains[i];
    let dc = nerve.getDomainColor(d);
    let x = spacing * (i + 1);
    let score = nerve.domains[d].score;
    
    // Dot
    noStroke();
    fill(dc[0], dc[1], dc[2], 60 + score * 140);
    ellipse(x - 30, startY, 4 + score * 4, 4 + score * 4);
    
    // Label
    fill(dc[0], dc[1], dc[2], 30 + score * 40);
    let label = d.length > 10 ? d.substring(0, 8) + '..' : d;
    text(label + ' ' + nf(score, 1, 2), x + 10, startY);
  }
  
  pop();
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
  trailBuffer = createGraphics(width, height);
}
