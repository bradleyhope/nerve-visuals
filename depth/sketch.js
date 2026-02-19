// THE DEPTH
// Edge Score controls depth/darkness. Low scores = calm surface.
// As risk rises, descend into deeper, darker, more turbulent waters.
// Flow fields + particle systems represent domain interactions.

let nerve;
let particles = [];
let maxParticles = 2000;
let flowField;
let cols, rows;
let cellSize = 20;
let phase = 0;
let depthY = 0;
let targetDepthY = 0;
let surfaceWaves = [];
let causticPhase = 0;
let domainCurrents = [];

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  colorMode(RGB);
  nerve = new NerveData();
  nerve.fetchLive();
  
  cols = ceil(width / cellSize) + 1;
  rows = ceil(height / cellSize) + 1;
  flowField = new Array(cols * rows);
  
  // Initialize particles
  for (let i = 0; i < maxParticles; i++) {
    particles.push(createParticle());
  }
  
  // Initialize surface waves
  for (let i = 0; i < 5; i++) {
    surfaceWaves.push({
      amplitude: random(10, 40),
      frequency: random(0.005, 0.02),
      speed: random(0.01, 0.03),
      phase: random(TWO_PI)
    });
  }
  
  // Domain currents — each domain creates a current in the flow field
  let domains = nerve.getDomainNames();
  for (let i = 0; i < domains.length; i++) {
    domainCurrents.push({
      x: random(width * 0.2, width * 0.8),
      y: random(height * 0.3, height * 0.8),
      radius: random(100, 250),
      strength: 0,
      angle: random(TWO_PI),
      rotSpeed: random(-0.005, 0.005)
    });
  }
}

function createParticle() {
  return {
    x: random(width),
    y: random(height),
    prevX: 0,
    prevY: 0,
    speed: random(0.5, 2),
    life: random(0.5, 1),
    decay: random(0.0005, 0.002),
    size: random(1, 3),
    domain: floor(random(5)),
    depth: random(0, 1) // how deep this particle is
  };
}

function draw() {
  nerve.update();
  let colors = nerve.getRegimeColors();
  phase += 0.008;
  causticPhase += 0.02;
  
  // Target depth based on edge score
  targetDepthY = nerve.edgeScore;
  depthY = lerp(depthY, targetDepthY, 0.01);
  
  // Background — gradient from surface to deep
  drawOceanBackground(colors);
  
  // Update flow field
  updateFlowField();
  
  // Draw caustic light patterns (surface)
  if (depthY < 0.5) {
    drawCaustics(colors);
  }
  
  // Draw and update particles
  updateAndDrawParticles(colors);
  
  // Draw surface waves
  drawSurface(colors);
  
  // Draw depth indicator
  drawDepthIndicator(colors);
  
  // Draw score
  drawScoreDisplay(colors);
  
  // Draw domain indicators
  drawDomainIndicators(colors);
  
  // Pressure/darkness vignette
  drawVignette(colors);
  
  document.getElementById('sim-badge').className = nerve.simMode ? 'active' : '';
}

function drawOceanBackground(colors) {
  // Multi-layered gradient
  let surfaceColor, midColor, deepColor, abyssColor;
  
  switch (nerve.regime) {
    case 'CALM':
      surfaceColor = [8, 25, 50];
      midColor = [5, 15, 40];
      deepColor = [3, 8, 25];
      abyssColor = [1, 3, 10];
      break;
    case 'ELEVATED':
      surfaceColor = [20, 20, 35];
      midColor = [15, 12, 28];
      deepColor = [10, 6, 18];
      abyssColor = [4, 2, 8];
      break;
    case 'STRESSED':
      surfaceColor = [25, 10, 15];
      midColor = [18, 5, 10];
      deepColor = [12, 3, 6];
      abyssColor = [5, 1, 2];
      break;
    case 'CRITICAL':
      surfaceColor = [20, 5, 5];
      midColor = [15, 3, 3];
      deepColor = [8, 1, 1];
      abyssColor = [3, 0, 0];
      break;
    default:
      surfaceColor = [8, 25, 50];
      midColor = [5, 15, 40];
      deepColor = [3, 8, 25];
      abyssColor = [1, 3, 10];
  }
  
  // Interpolate based on depth
  noStroke();
  for (let y = 0; y < height; y += 4) {
    let t = y / height;
    // Shift gradient based on depth
    t = constrain(t + depthY * 0.5, 0, 1);
    
    let r, g, b;
    if (t < 0.33) {
      let lt = t / 0.33;
      r = lerp(surfaceColor[0], midColor[0], lt);
      g = lerp(surfaceColor[1], midColor[1], lt);
      b = lerp(surfaceColor[2], midColor[2], lt);
    } else if (t < 0.66) {
      let lt = (t - 0.33) / 0.33;
      r = lerp(midColor[0], deepColor[0], lt);
      g = lerp(midColor[1], deepColor[1], lt);
      b = lerp(midColor[2], deepColor[2], lt);
    } else {
      let lt = (t - 0.66) / 0.34;
      r = lerp(deepColor[0], abyssColor[0], lt);
      g = lerp(deepColor[1], abyssColor[1], lt);
      b = lerp(deepColor[2], abyssColor[2], lt);
    }
    
    fill(r, g, b);
    rect(0, y, width, 5);
  }
}

function updateFlowField() {
  let domains = nerve.getDomainNames();
  let noiseScale = 0.003 + nerve.edgeScore * 0.008;
  let turbulence = nerve.edgeScore * 2;
  
  // Update domain currents
  for (let i = 0; i < domainCurrents.length; i++) {
    let dc = domainCurrents[i];
    dc.strength = lerp(dc.strength, nerve.domains[domains[i]].score, 0.02);
    dc.angle += dc.rotSpeed;
    // Drift position slowly
    dc.x += sin(phase + i) * 0.3;
    dc.y += cos(phase * 0.7 + i) * 0.2;
    // Wrap
    dc.x = ((dc.x % width) + width) % width;
    dc.y = ((dc.y % height) + height) % height;
  }
  
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let idx = x + y * cols;
      let px = x * cellSize;
      let py = y * cellSize;
      
      // Base flow from Perlin noise
      let angle = noise(px * noiseScale, py * noiseScale, phase) * TWO_PI * (2 + turbulence);
      
      // Add domain current influences
      for (let dc of domainCurrents) {
        let dx = px - dc.x;
        let dy = py - dc.y;
        let dist = sqrt(dx * dx + dy * dy);
        if (dist < dc.radius) {
          let influence = (1 - dist / dc.radius) * dc.strength;
          // Rotational current
          let currentAngle = atan2(dy, dx) + HALF_PI + dc.angle;
          angle = lerp(angle, currentAngle, influence * 0.5);
        }
      }
      
      // Mouse influence
      let mx = mouseX - px;
      let my = mouseY - py;
      let md = sqrt(mx * mx + my * my);
      if (md < 150) {
        let mouseAngle = atan2(my, mx) + PI;
        let mouseInfluence = (1 - md / 150) * 0.3;
        angle = lerp(angle, mouseAngle, mouseInfluence);
      }
      
      flowField[idx] = angle;
    }
  }
}

function updateAndDrawParticles(colors) {
  let domains = nerve.getDomainNames();
  
  for (let i = 0; i < particles.length; i++) {
    let p = particles[i];
    
    // Get flow field angle
    let col = floor(p.x / cellSize);
    let row = floor(p.y / cellSize);
    col = constrain(col, 0, cols - 1);
    row = constrain(row, 0, rows - 1);
    let angle = flowField[col + row * cols] || 0;
    
    // Apply flow
    let speed = p.speed * (0.5 + nerve.edgeScore * 2);
    p.prevX = p.x;
    p.prevY = p.y;
    p.x += cos(angle) * speed;
    p.y += sin(angle) * speed;
    
    // Slight downward drift (gravity/sinking)
    p.y += depthY * 0.5;
    
    p.life -= p.decay;
    
    // Wrap or respawn
    if (p.x < 0 || p.x > width || p.y < 0 || p.y > height || p.life <= 0) {
      Object.assign(p, createParticle());
    }
    
    // Draw
    let domainColor = nerve.getDomainColor(domains[p.domain]);
    let depthFade = map(p.depth, 0, 1, 1, 0.3);
    let alpha = p.life * 80 * depthFade;
    
    // Bioluminescence effect — particles glow more in deeper/more stressed conditions
    let bioLum = nerve.edgeScore * 0.5 * depthFade;
    
    stroke(
      domainColor[0] + bioLum * 50,
      domainColor[1] + bioLum * 30,
      domainColor[2] + bioLum * 50,
      alpha
    );
    strokeWeight(p.size * (0.5 + bioLum));
    line(p.prevX, p.prevY, p.x, p.y);
    
    // Occasional bright flash (bioluminescence)
    if (random() < 0.001 * nerve.edgeScore) {
      noStroke();
      fill(domainColor[0], domainColor[1], domainColor[2], 60);
      ellipse(p.x, p.y, 8 + random(8), 8 + random(8));
    }
  }
}

function drawCaustics(colors) {
  let intensity = map(depthY, 0, 0.5, 0.8, 0);
  intensity = constrain(intensity, 0, 1);
  
  noFill();
  for (let i = 0; i < 15; i++) {
    let x = noise(i * 10, causticPhase * 0.3) * width;
    let y = noise(i * 10 + 100, causticPhase * 0.3) * height * 0.5;
    let size = noise(i * 10 + 200, causticPhase * 0.5) * 200 + 50;
    
    let alpha = intensity * 8;
    stroke(colors.accent[0], colors.accent[1], colors.accent[2], alpha);
    strokeWeight(1);
    
    beginShape();
    for (let a = 0; a < TWO_PI; a += 0.3) {
      let r = size * (0.5 + 0.5 * noise(i * 5 + cos(a) * 2, sin(a) * 2, causticPhase * 0.5));
      vertex(x + cos(a) * r, y + sin(a) * r);
    }
    endShape(CLOSE);
  }
}

function drawSurface(colors) {
  // Animated surface line at top
  let surfaceY = map(depthY, 0, 1, height * 0.08, -height * 0.3);
  
  noFill();
  stroke(colors.accent[0], colors.accent[1], colors.accent[2], 30);
  strokeWeight(1.5);
  
  beginShape();
  for (let x = 0; x <= width; x += 3) {
    let y = surfaceY;
    for (let wave of surfaceWaves) {
      y += sin(x * wave.frequency + phase * wave.speed * 60 + wave.phase) * wave.amplitude * (1 + nerve.edgeScore * 0.5);
    }
    vertex(x, y);
  }
  endShape();
  
  // Second surface line (reflection)
  stroke(colors.accent[0], colors.accent[1], colors.accent[2], 15);
  beginShape();
  for (let x = 0; x <= width; x += 3) {
    let y = surfaceY + 8;
    for (let wave of surfaceWaves) {
      y += sin(x * wave.frequency * 1.1 + phase * wave.speed * 60 + wave.phase + 0.5) * wave.amplitude * 0.7;
    }
    vertex(x, y);
  }
  endShape();
}

function drawDepthIndicator(colors) {
  // Vertical depth gauge on right side
  let gaugeX = width - 30;
  let gaugeTop = height * 0.15;
  let gaugeBottom = height * 0.85;
  let gaugeHeight = gaugeBottom - gaugeTop;
  
  // Track line
  stroke(colors.primary[0], colors.primary[1], colors.primary[2], 15);
  strokeWeight(1);
  line(gaugeX, gaugeTop, gaugeX, gaugeBottom);
  
  // Depth marker
  let markerY = map(depthY, 0, 1, gaugeTop, gaugeBottom);
  let pulse = sin(phase * 3) * 2;
  
  noStroke();
  fill(colors.accent[0], colors.accent[1], colors.accent[2], 100);
  ellipse(gaugeX, markerY, 6 + pulse, 6 + pulse);
  
  // Depth labels
  textFont('Courier New');
  textSize(7);
  textAlign(RIGHT, CENTER);
  fill(colors.primary[0], colors.primary[1], colors.primary[2], 25);
  text('SURFACE', gaugeX - 10, gaugeTop);
  text('ABYSS', gaugeX - 10, gaugeBottom);
  
  // Pressure reading
  let pressure = nf(depthY * 1000, 1, 0);
  textSize(8);
  fill(colors.accent[0], colors.accent[1], colors.accent[2], 40);
  text(pressure + ' ATM', gaugeX - 10, markerY);
}

function drawScoreDisplay(colors) {
  let scoreStr = nf(nerve.edgeScore, 1, 3);
  let pulse = sin(phase * 3) * 0.1 + 0.9;
  
  // Depth affects text visibility
  let textAlpha = map(depthY, 0, 1, 180, 80);
  
  push();
  textFont('Courier New');
  textAlign(LEFT, TOP);
  
  textSize(56);
  fill(colors.accent[0], colors.accent[1], colors.accent[2], textAlpha * pulse);
  text(scoreStr, 30, 25);
  
  textSize(10);
  fill(colors.primary[0], colors.primary[1], colors.primary[2], textAlpha * 0.25);
  text('EDGE SCORE', 34, 84);
  
  textSize(11);
  fill(colors.primary[0], colors.primary[1], colors.primary[2], textAlpha * 0.3);
  text(nerve.regime, 34, 100);
  
  textSize(8);
  fill(colors.secondary[0], colors.secondary[1], colors.secondary[2], textAlpha * 0.2);
  text('FRAGILITY ' + nf(nerve.fragility, 1, 2), 34, 118);
  
  pop();
}

function drawDomainIndicators(colors) {
  let domains = nerve.getDomainNames();
  
  push();
  textFont('Courier New');
  textSize(8);
  textAlign(LEFT, CENTER);
  
  for (let i = 0; i < domains.length; i++) {
    let d = domains[i];
    let dc = nerve.getDomainColor(d);
    let score = nerve.domains[d].score;
    let y = height - 80 + i * 14;
    
    // Bar
    let barWidth = score * 60;
    noStroke();
    fill(dc[0], dc[1], dc[2], 30 + score * 50);
    rect(30, y - 2, barWidth, 4, 2);
    
    // Label
    fill(dc[0], dc[1], dc[2], 25 + score * 35);
    text(d, 100, y);
  }
  
  pop();
}

function drawVignette(colors) {
  // Pressure vignette — darkens edges as depth increases
  let vignetteStrength = 50 + depthY * 150;
  
  noFill();
  for (let r = max(width, height); r > max(width, height) * 0.3; r -= 4) {
    let alpha = map(r, max(width, height) * 0.3, max(width, height), 0, vignetteStrength / 255 * 20);
    stroke(0, 0, 0, alpha);
    strokeWeight(5);
    ellipse(width/2, height/2, r, r * 0.8);
  }
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
  cols = ceil(width / cellSize) + 1;
  rows = ceil(height / cellSize) + 1;
  flowField = new Array(cols * rows);
}
