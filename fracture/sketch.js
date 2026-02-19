// THE FRACTURE
// A luminous sphere representing the interconnected world.
// At low Edge Scores, it's whole and serene — a single glowing orb.
// As risk rises, fracture lines appear, the sphere cracks apart,
// domain-colored light bleeds through the cracks.
// At CRITICAL, the sphere shatters into fragments drifting apart.
// The fragility ratio controls how connected the fragments remain.
// Think: a planet breaking apart in slow motion.

let nerve;
let phase = 0;
let sphereRadius;
let fragments = [];
let numFragments = 120;
let crackLines = [];
let numCracks = 40;
let orbParticles = [];
let ambientParticles = [];
let currentFracture = 0; // 0 = whole, 1 = shattered

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  nerve = new NerveData();
  nerve.fetchLive();
  
  sphereRadius = min(width, height) * 0.25;
  
  // Generate sphere fragments (Voronoi-like tessellation via random points on sphere)
  for (let i = 0; i < numFragments; i++) {
    // Distribute points on sphere surface using golden spiral
    let theta = acos(1 - 2 * (i + 0.5) / numFragments);
    let phi = PI * (1 + sqrt(5)) * i;
    
    let baseX = sin(theta) * cos(phi);
    let baseY = sin(theta) * sin(phi);
    let baseZ = cos(theta);
    
    // Assign to nearest domain based on position
    let domainIdx = floor(map(atan2(baseY, baseX) + PI, 0, TWO_PI, 0, 5)) % 5;
    
    fragments.push({
      baseX, baseY, baseZ,
      x: 0, y: 0,
      driftX: baseX * random(0.5, 2),
      driftY: baseY * random(0.5, 2),
      driftZ: baseZ * random(0.5, 2),
      size: random(8, 25),
      domain: domainIdx,
      rotPhase: random(TWO_PI),
      rotSpeed: random(-0.01, 0.01),
      brightness: random(0.5, 1),
      crackDelay: random(0.2, 0.8) // when this fragment starts separating
    });
  }
  
  // Generate crack lines
  for (let i = 0; i < numCracks; i++) {
    let startAngle = random(TWO_PI);
    let startR = random(0.3, 0.95);
    let points = [];
    let angle = startAngle;
    let r = startR;
    
    for (let j = 0; j < random(4, 12); j++) {
      points.push({
        angle: angle,
        r: r,
        wobble: random(-0.05, 0.05)
      });
      angle += random(-0.3, 0.3);
      r += random(-0.1, 0.15);
      r = constrain(r, 0.1, 1.1);
    }
    
    crackLines.push({
      points,
      threshold: random(0.15, 0.7), // edge score at which this crack appears
      width: random(0.5, 2.5),
      glow: random(0.3, 1),
      domain: floor(random(5))
    });
  }
  
  // Ambient floating particles
  for (let i = 0; i < 200; i++) {
    ambientParticles.push({
      x: random(-width, width * 2),
      y: random(-height, height * 2),
      vx: random(-0.3, 0.3),
      vy: random(-0.3, 0.3),
      size: random(0.5, 2),
      alpha: random(20, 60),
      phase: random(TWO_PI)
    });
  }
}

function draw() {
  nerve.update();
  let colors = nerve.getRegimeColors();
  phase += 0.008;
  
  // Fracture amount tracks edge score
  currentFracture = lerp(currentFracture, nerve.edgeScore, 0.015);
  
  // Background
  background(colors.bg[0], colors.bg[1], colors.bg[2]);
  
  // Draw ambient particles
  drawAmbientParticles(colors);
  
  push();
  translate(width / 2, height / 2);
  
  // Draw outer glow
  drawOrbGlow(colors);
  
  // Draw crack lines
  drawCrackLines(colors);
  
  // Draw sphere fragments
  drawFragments(colors);
  
  // Draw inner core
  drawCore(colors);
  
  // Draw connecting threads (fragility)
  drawFragilityThreads(colors);
  
  pop();
  
  // Draw score
  drawScoreDisplay(colors);
  
  // Draw domain ring
  drawDomainRing(colors);
  
  document.getElementById('sim-badge').className = nerve.simMode ? 'active' : '';
}

function drawOrbGlow(colors) {
  let pulse = sin(phase * 2) * 0.1 + 0.9;
  let glowR = sphereRadius * (1.5 + currentFracture * 0.8) * pulse;
  
  for (let r = glowR; r > 0; r -= 3) {
    let t = r / glowR;
    let alpha = (1 - t) * (8 + currentFracture * 5);
    noStroke();
    fill(colors.primary[0], colors.primary[1], colors.primary[2], alpha);
    ellipse(0, 0, r * 2, r * 2);
  }
}

function drawFragments(colors) {
  let domains = nerve.getDomainNames();
  
  for (let frag of fragments) {
    // Calculate fragment position
    // At fracture=0, all fragments sit on the sphere surface
    // At fracture=1, they drift outward
    let fractureAmount = max(0, (currentFracture - frag.crackDelay) / (1 - frag.crackDelay));
    fractureAmount = constrain(fractureAmount, 0, 1);
    fractureAmount = easeOutCubic(fractureAmount);
    
    // Rotation
    let rotAngle = phase * 0.3 + frag.rotPhase;
    let bx = frag.baseX * cos(rotAngle) - frag.baseZ * sin(rotAngle);
    let bz = frag.baseX * sin(rotAngle) + frag.baseZ * cos(rotAngle);
    let by = frag.baseY;
    
    // Z-depth for pseudo-3D
    let zDepth = bz * 0.5 + 0.5; // 0 = back, 1 = front
    
    // Base position on sphere
    let baseR = sphereRadius;
    let x = bx * baseR;
    let y = by * baseR;
    
    // Drift outward when fracturing
    let driftMagnitude = fractureAmount * sphereRadius * 1.5;
    x += frag.driftX * driftMagnitude;
    y += frag.driftY * driftMagnitude;
    
    // Trembling
    let tremble = nerve.edgeScore * 3;
    x += sin(phase * 5 + frag.rotPhase) * tremble;
    y += cos(phase * 5 + frag.rotPhase * 1.3) * tremble;
    
    // Size and alpha based on z-depth
    let depthScale = map(zDepth, 0, 1, 0.6, 1.2);
    let size = frag.size * depthScale * (1 + fractureAmount * 0.3);
    
    // Color
    let domainColor = nerve.getDomainColor(domains[frag.domain]);
    let domainScore = nerve.domains[domains[frag.domain]].score;
    
    // Mix domain color with regime color based on fracture
    let r = lerp(colors.primary[0], domainColor[0], fractureAmount * 0.7);
    let g = lerp(colors.primary[1], domainColor[1], fractureAmount * 0.7);
    let b = lerp(colors.primary[2], domainColor[2], fractureAmount * 0.7);
    
    let alpha = map(zDepth, 0, 1, 40, 180) * frag.brightness;
    
    // Fragment glow
    noStroke();
    let glowSize = size * (1.5 + domainScore * 0.5);
    fill(r, g, b, alpha * 0.15);
    ellipse(x, y, glowSize, glowSize);
    
    // Fragment body
    fill(r, g, b, alpha);
    
    // Draw as irregular polygon
    push();
    translate(x, y);
    rotate(frag.rotPhase + phase * frag.rotSpeed);
    beginShape();
    let sides = 5 + floor(frag.size / 5);
    for (let a = 0; a < TWO_PI; a += TWO_PI / sides) {
      let pr = size * 0.5 * (0.7 + 0.3 * noise(frag.rotPhase + a));
      vertex(cos(a) * pr, sin(a) * pr);
    }
    endShape(CLOSE);
    pop();
    
    // Bright edge on front-facing fragments
    if (zDepth > 0.7) {
      noFill();
      stroke(255, 255, 255, (zDepth - 0.7) * 60 * frag.brightness);
      strokeWeight(0.5);
      push();
      translate(x, y);
      rotate(frag.rotPhase + phase * frag.rotSpeed);
      beginShape();
      for (let a = 0; a < TWO_PI; a += TWO_PI / sides) {
        let pr = size * 0.5 * (0.7 + 0.3 * noise(frag.rotPhase + a));
        vertex(cos(a) * pr, sin(a) * pr);
      }
      endShape(CLOSE);
      pop();
    }
    
    // Emit particles from separating fragments
    if (fractureAmount > 0.1 && random() < fractureAmount * 0.05) {
      orbParticles.push({
        x: x, y: y,
        vx: frag.driftX * random(0.5, 1.5),
        vy: frag.driftY * random(0.5, 1.5),
        life: 1,
        decay: random(0.005, 0.02),
        size: random(1, 3),
        color: [r, g, b]
      });
    }
  }
  
  // Draw and update orb particles
  for (let i = orbParticles.length - 1; i >= 0; i--) {
    let p = orbParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.99;
    p.vy *= 0.99;
    p.life -= p.decay;
    
    if (p.life <= 0) {
      orbParticles.splice(i, 1);
      continue;
    }
    
    noStroke();
    fill(p.color[0], p.color[1], p.color[2], p.life * 80);
    ellipse(p.x, p.y, p.size * p.life, p.size * p.life);
  }
  
  if (orbParticles.length > 500) orbParticles.splice(0, orbParticles.length - 500);
}

function drawCrackLines(colors) {
  let domains = nerve.getDomainNames();
  
  for (let crack of crackLines) {
    if (currentFracture < crack.threshold * 0.5) continue;
    
    let visibility = map(currentFracture, crack.threshold * 0.5, crack.threshold, 0, 1);
    visibility = constrain(visibility, 0, 1);
    
    let domainColor = nerve.getDomainColor(domains[crack.domain]);
    
    noFill();
    
    // Glow
    stroke(domainColor[0], domainColor[1], domainColor[2], visibility * 15 * crack.glow);
    strokeWeight(crack.width * 4);
    beginShape();
    for (let pt of crack.points) {
      let r = pt.r * sphereRadius;
      let wobble = sin(phase * 3 + pt.angle * 5) * pt.wobble * sphereRadius;
      let x = cos(pt.angle + phase * 0.3) * (r + wobble);
      let y = sin(pt.angle + phase * 0.3) * (r + wobble);
      vertex(x, y);
    }
    endShape();
    
    // Main crack line
    stroke(domainColor[0], domainColor[1], domainColor[2], visibility * 80 * crack.glow);
    strokeWeight(crack.width);
    beginShape();
    for (let pt of crack.points) {
      let r = pt.r * sphereRadius;
      let wobble = sin(phase * 3 + pt.angle * 5) * pt.wobble * sphereRadius;
      let x = cos(pt.angle + phase * 0.3) * (r + wobble);
      let y = sin(pt.angle + phase * 0.3) * (r + wobble);
      vertex(x, y);
    }
    endShape();
    
    // Bright core
    stroke(255, 255, 255, visibility * 30 * crack.glow);
    strokeWeight(crack.width * 0.3);
    beginShape();
    for (let pt of crack.points) {
      let r = pt.r * sphereRadius;
      let wobble = sin(phase * 3 + pt.angle * 5) * pt.wobble * sphereRadius;
      let x = cos(pt.angle + phase * 0.3) * (r + wobble);
      let y = sin(pt.angle + phase * 0.3) * (r + wobble);
      vertex(x, y);
    }
    endShape();
  }
}

function drawCore(colors) {
  // Inner core — visible through cracks
  let coreSize = sphereRadius * 0.3;
  let pulse = sin(phase * 3) * 0.15 + 0.85;
  
  // Core glow — intensifies with edge score
  let coreIntensity = 0.3 + currentFracture * 0.7;
  
  for (let r = coreSize * 2; r > 0; r -= 2) {
    let t = r / (coreSize * 2);
    let alpha = (1 - t) * 15 * coreIntensity * pulse;
    noStroke();
    
    // Core color shifts from cool to hot
    let cr = lerp(colors.primary[0], 255, currentFracture * 0.5);
    let cg = lerp(colors.primary[1], 100, currentFracture * 0.3);
    let cb = lerp(colors.primary[2], 30, currentFracture * 0.5);
    
    fill(cr, cg, cb, alpha);
    ellipse(0, 0, r, r);
  }
  
  // Core bright center
  noStroke();
  fill(255, 255, 255, 30 * coreIntensity * pulse);
  ellipse(0, 0, coreSize * 0.3, coreSize * 0.3);
}

function drawFragilityThreads(colors) {
  // Threads connecting fragments — represent coupling/fragility
  // More visible when fragility is high and fragments are separating
  
  if (currentFracture < 0.1 || nerve.fragility < 0.05) return;
  
  let threadAlpha = nerve.fragility * 40 * currentFracture;
  
  // Connect nearby fragments
  for (let i = 0; i < fragments.length; i += 3) {
    for (let j = i + 1; j < fragments.length; j += 5) {
      let fi = fragments[i];
      let fj = fragments[j];
      
      if (fi.domain === fj.domain) continue; // Only cross-domain threads
      
      let fractI = max(0, (currentFracture - fi.crackDelay) / (1 - fi.crackDelay));
      let fractJ = max(0, (currentFracture - fj.crackDelay) / (1 - fj.crackDelay));
      fractI = constrain(easeOutCubic(fractI), 0, 1);
      fractJ = constrain(easeOutCubic(fractJ), 0, 1);
      
      let rotAngle = phase * 0.3;
      
      let x1 = (fi.baseX * cos(rotAngle) - fi.baseZ * sin(rotAngle)) * sphereRadius + fi.driftX * fractI * sphereRadius * 1.5;
      let y1 = fi.baseY * sphereRadius + fi.driftY * fractI * sphereRadius * 1.5;
      let x2 = (fj.baseX * cos(rotAngle) - fj.baseZ * sin(rotAngle)) * sphereRadius + fj.driftX * fractJ * sphereRadius * 1.5;
      let y2 = fj.baseY * sphereRadius + fj.driftY * fractJ * sphereRadius * 1.5;
      
      let dist = sqrt((x2-x1)*(x2-x1) + (y2-y1)*(y2-y1));
      if (dist > sphereRadius * 1.5) continue;
      
      let distFade = map(dist, 0, sphereRadius * 1.5, 1, 0);
      
      stroke(colors.accent[0], colors.accent[1], colors.accent[2], threadAlpha * distFade * 0.3);
      strokeWeight(0.5);
      line(x1, y1, x2, y2);
    }
  }
}

function drawAmbientParticles(colors) {
  for (let p of ambientParticles) {
    p.x += p.vx + sin(phase + p.phase) * 0.1;
    p.y += p.vy + cos(phase * 0.7 + p.phase) * 0.1;
    
    // Wrap
    if (p.x < -50) p.x = width + 50;
    if (p.x > width + 50) p.x = -50;
    if (p.y < -50) p.y = height + 50;
    if (p.y > height + 50) p.y = -50;
    
    let twinkle = sin(phase * 3 + p.phase) * 0.3 + 0.7;
    noStroke();
    fill(colors.primary[0] + 40, colors.primary[1] + 40, colors.primary[2] + 40, p.alpha * twinkle);
    ellipse(p.x, p.y, p.size, p.size);
  }
}

function drawScoreDisplay(colors) {
  let scoreStr = nf(nerve.edgeScore, 1, 3);
  let pulse = sin(phase * 3) * 0.08 + 0.92;
  
  push();
  textFont('Courier New');
  textAlign(CENTER, CENTER);
  
  // Score below sphere
  textSize(52);
  fill(colors.accent[0], colors.accent[1], colors.accent[2], 160 * pulse);
  text(scoreStr, width/2, height/2 + sphereRadius * 1.6);
  
  textSize(10);
  fill(colors.primary[0], colors.primary[1], colors.primary[2], 40);
  text('EDGE SCORE', width/2, height/2 + sphereRadius * 1.6 + 35);
  
  // Regime above sphere
  textSize(12);
  fill(colors.primary[0], colors.primary[1], colors.primary[2], 45);
  text(nerve.regime, width/2, height/2 - sphereRadius * 1.55);
  
  textSize(8);
  fill(colors.secondary[0], colors.secondary[1], colors.secondary[2], 25);
  text('FRAGILITY ' + nf(nerve.fragility, 1, 2), width/2, height/2 - sphereRadius * 1.55 + 18);
  
  pop();
}

function drawDomainRing(colors) {
  // Small domain indicators in a ring around the sphere
  let domains = nerve.getDomainNames();
  let ringR = sphereRadius * 1.25;
  
  push();
  translate(width/2, height/2);
  textFont('Courier New');
  textSize(7);
  textAlign(CENTER, CENTER);
  
  for (let i = 0; i < domains.length; i++) {
    let angle = map(i, 0, domains.length, -PI * 0.7, PI * 0.7) - HALF_PI;
    let x = cos(angle) * ringR;
    let y = sin(angle) * ringR;
    let dc = nerve.getDomainColor(domains[i]);
    let score = nerve.domains[domains[i]].score;
    
    // Dot
    let dotSize = 3 + score * 6;
    let pulse = sin(phase * 2 + i) * 0.2 + 0.8;
    noStroke();
    fill(dc[0], dc[1], dc[2], (40 + score * 100) * pulse);
    ellipse(x, y, dotSize, dotSize);
    
    // Label
    fill(dc[0], dc[1], dc[2], 25 + score * 30);
    let labelR = ringR + 15;
    let lx = cos(angle) * labelR;
    let ly = sin(angle) * labelR;
    
    push();
    translate(lx, ly);
    let shortName = domains[i].substring(0, 3).toUpperCase();
    text(shortName, 0, 0);
    pop();
  }
  
  pop();
}

function easeOutCubic(t) {
  return 1 - pow(1 - t, 3);
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
  sphereRadius = min(width, height) * 0.25;
}
