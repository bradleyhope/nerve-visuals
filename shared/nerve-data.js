// Shared Nerve Data Module
// Handles live API fetching and simulation mode with robust error handling

class NerveData {
  constructor() {
    this.API_URL = 'https://nerve-engine.onrender.com/current';
    this.edgeScore = 0.1;
    this.fragility = 0.0;
    this.momentum = 0.0;
    this.regime = 'CALM';
    this.domains = {
      'Markets': { score: 0.01 },
      'Climate': { score: 0.01 },
      'Information': { score: 0.01 },
      'Social/Conflict': { score: 0.01 },
      'Supply Chain': { score: 0.5 }
    };
    this.lastUpdate = null;
    this.simMode = true; // Start in sim mode by default to avoid blocking on API
    this.apiAvailable = false; // Track if API is working
    this.simLevel = 0;
    this.simLevels = [
      { edge: 0.08, regime: 'CALM', fragility: 0.05, domains: { Markets: 0.05, Climate: 0.03, Information: 0.04, 'Social/Conflict': 0.02, 'Supply Chain': 0.1 } },
      { edge: 0.22, regime: 'CALM', fragility: 0.15, domains: { Markets: 0.18, Climate: 0.08, Information: 0.15, 'Social/Conflict': 0.12, 'Supply Chain': 0.25 } },
      { edge: 0.38, regime: 'ELEVATED', fragility: 0.35, domains: { Markets: 0.35, Climate: 0.15, Information: 0.32, 'Social/Conflict': 0.28, 'Supply Chain': 0.45 } },
      { edge: 0.52, regime: 'ELEVATED', fragility: 0.50, domains: { Markets: 0.55, Climate: 0.25, Information: 0.48, 'Social/Conflict': 0.42, 'Supply Chain': 0.55 } },
      { edge: 0.65, regime: 'STRESSED', fragility: 0.65, domains: { Markets: 0.72, Climate: 0.38, Information: 0.62, 'Social/Conflict': 0.58, 'Supply Chain': 0.68 } },
      { edge: 0.78, regime: 'STRESSED', fragility: 0.78, domains: { Markets: 0.82, Climate: 0.55, Information: 0.75, 'Social/Conflict': 0.72, 'Supply Chain': 0.78 } },
      { edge: 0.88, regime: 'CRITICAL', fragility: 0.88, domains: { Markets: 0.92, Climate: 0.72, Information: 0.88, 'Social/Conflict': 0.85, 'Supply Chain': 0.9 } },
      { edge: 0.96, regime: 'CRITICAL', fragility: 0.95, domains: { Markets: 0.98, Climate: 0.88, Information: 0.95, 'Social/Conflict': 0.94, 'Supply Chain': 0.97 } }
    ];
    this.targetEdge = this.edgeScore;
    this.targetDomains = { ...this.domains };
    this.lerpSpeed = 0.02;
    this.fetchInterval = 60000; // 1 minute
    this.lastFetch = 0;
    this.fetchTimeout = 8000; // 8 second timeout for API requests
    
    // Try to fetch API in background on initialization
    this.tryInitialFetch();
  }

  async tryInitialFetch() {
    // Silently try to fetch API data in the background
    // If it works, switch to live mode automatically
    try {
      const data = await this.fetchLive();
      if (data && data.edge_score !== undefined) {
        this.apiAvailable = true;
        this.simMode = false; // Switch to live mode if API is working
        console.log('Nerve API connected successfully');
      }
    } catch (e) {
      // Silently stay in simulation mode
      console.log('Starting in simulation mode (API unavailable)');
    }
  }

  async fetchLive() {
    try {
      // Create an AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.fetchTimeout);
      
      const resp = await fetch(this.API_URL, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });
      
      clearTimeout(timeoutId);
      
      // Check if response is OK
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }
      
      // Check content type before parsing
      const contentType = resp.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Expected JSON, got ${contentType}`);
      }
      
      // Get response text first to handle parse errors gracefully
      const text = await resp.text();
      
      // Try to parse JSON
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        throw new Error(`JSON parse failed: ${parseError.message}`);
      }
      
      // Validate data structure
      if (typeof data.edge_score !== 'number' || !data.regime) {
        throw new Error('Invalid data structure from API');
      }
      
      // Update values if not in simulation mode
      if (!this.simMode) {
        this.targetEdge = data.edge_score;
        this.fragility = data.fragility_ratio || 0.0;
        this.momentum = data.momentum || 0.0;
        this.regime = data.regime;
        this.lastUpdate = data.timestamp;
        
        // Update domain scores safely
        if (data.domain_scores && typeof data.domain_scores === 'object') {
          for (let d in data.domain_scores) {
            if (this.domains[d] && typeof data.domain_scores[d].score === 'number') {
              this.targetDomains[d] = { score: data.domain_scores[d].score };
            }
          }
        }
      }
      
      this.apiAvailable = true;
      return data;
      
    } catch (e) {
      // Handle all errors gracefully
      if (e.name === 'AbortError') {
        console.warn('Nerve API request timed out');
      } else {
        console.warn('Nerve API fetch failed:', e.message);
      }
      
      this.apiAvailable = false;
      
      // If we're not in sim mode and API fails, switch to sim mode silently
      if (!this.simMode) {
        console.log('Switching to simulation mode due to API failure');
        this.simMode = true;
      }
      
      return null;
    }
  }

  setSimLevel(level) {
    this.simLevel = level % this.simLevels.length;
    const sim = this.simLevels[this.simLevel];
    this.simMode = true;
    this.targetEdge = sim.edge;
    this.regime = sim.regime;
    this.fragility = sim.fragility;
    for (let d in sim.domains) {
      if (this.targetDomains[d]) {
        this.targetDomains[d] = { score: sim.domains[d] };
      }
    }
  }

  toggleSimMode() {
    if (this.apiAvailable) {
      this.simMode = !this.simMode;
      if (!this.simMode) {
        this.fetchLive();
      }
    } else {
      // If API is not available, stay in sim mode
      console.log('API not available, staying in simulation mode');
    }
  }

  nextSimLevel() {
    this.setSimLevel(this.simLevel + 1);
  }

  update() {
    // Smooth interpolation toward target values
    this.edgeScore = lerp(this.edgeScore, this.targetEdge, this.lerpSpeed);
    for (let d in this.domains) {
      if (this.targetDomains[d]) {
        this.domains[d].score = lerp(this.domains[d].score, this.targetDomains[d].score, this.lerpSpeed);
      }
    }

    // Periodic fetch (only if not in sim mode)
    if (!this.simMode && millis() - this.lastFetch > this.fetchInterval) {
      this.lastFetch = millis();
      this.fetchLive();
    }
  }

  getRegimeColors() {
    switch (this.regime) {
      case 'CALM':
        return {
          bg: [8, 12, 24],
          primary: [60, 130, 200],
          secondary: [40, 90, 160],
          accent: [100, 180, 255],
          glow: [80, 160, 240, 30]
        };
      case 'ELEVATED':
        return {
          bg: [18, 14, 8],
          primary: [220, 160, 50],
          secondary: [180, 120, 30],
          accent: [255, 200, 80],
          glow: [240, 180, 60, 30]
        };
      case 'STRESSED':
        return {
          bg: [20, 8, 8],
          primary: [200, 50, 40],
          secondary: [160, 30, 25],
          accent: [255, 80, 60],
          glow: [240, 60, 40, 30]
        };
      case 'CRITICAL':
        return {
          bg: [12, 4, 4],
          primary: [255, 30, 10],
          secondary: [200, 10, 5],
          accent: [255, 100, 20],
          glow: [255, 40, 10, 40]
        };
      default:
        return {
          bg: [8, 12, 24],
          primary: [60, 130, 200],
          secondary: [40, 90, 160],
          accent: [100, 180, 255],
          glow: [80, 160, 240, 30]
        };
    }
  }

  getDomainColor(domain) {
    const colors = {
      'Markets': [65, 185, 255],
      'Climate': [50, 220, 130],
      'Information': [200, 140, 255],
      'Social/Conflict': [255, 120, 80],
      'Supply Chain': [255, 210, 60]
    };
    return colors[domain] || [180, 180, 180];
  }

  getDomainNames() {
    return Object.keys(this.domains);
  }
}
