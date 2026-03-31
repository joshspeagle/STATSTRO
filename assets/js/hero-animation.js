/**
 * MCMC Sampler Hero Animation
 * Simulates a Metropolis-Hastings sampler exploring a 2D posterior,
 * visualized as a celestial cartography map with contour lines.
 * The cursor creates a gravitational well that biases sampling.
 */
(function () {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let width, height;
  let animationId;
  let samples = [];
  let chain = [];
  let contourData = null;
  let gridResolution = 80;
  let time = 0;

  // Design tokens
  const COLORS = {
    navy: '#0B1D3A',
    gold: '#D4A843',
    teal: '#2A9D8F',
    cream: '#F5F0E8',
    gridLine: 'rgba(245, 240, 232, 0.04)',
  };

  // Target distribution: 5 modes arranged like a scattered constellation
  // (wide spatial spread, no unfortunate alignments)
  const modes = [
    { x: 0.20, y: 0.30, sx: 0.06, sy: 0.05, w: 0.30, rho:  0.2  },  // upper-left
    { x: 0.75, y: 0.25, sx: 0.07, sy: 0.05, w: 0.25, rho: -0.1  },  // upper-right
    { x: 0.45, y: 0.55, sx: 0.08, sy: 0.06, w: 0.20, rho:  0.0  },  // center
    { x: 0.15, y: 0.75, sx: 0.05, sy: 0.07, w: 0.15, rho: -0.3  },  // lower-left
    { x: 0.80, y: 0.70, sx: 0.06, sy: 0.08, w: 0.20, rho:  0.15 },  // lower-right
  ];

  // Cursor state (normalized 0-1 coordinates, null when off-canvas)
  let cursorX = null;
  let cursorY = null;
  const cursorWeight = 0.15;  // how strongly the cursor attracts
  const cursorSD = 0.08;      // spread of the cursor's influence

  // Background stars
  let stars = [];

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    stars = [];
    for (let i = 0; i < 150; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.5 + 0.3,
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        twinkleOffset: Math.random() * Math.PI * 2,
      });
    }

    computeContourGrid();
  }

  function gaussianPDF(x, y, mode) {
    const dx = (x - mode.x) / mode.sx;
    const dy = (y - mode.y) / mode.sy;
    const rho = mode.rho;
    const z = (dx * dx - 2 * rho * dx * dy + dy * dy) / (1 - rho * rho);
    return mode.w * Math.exp(-0.5 * z);
  }

  // Static density (without cursor) for contour grid
  function baseDensity(x, y) {
    let p = 0;
    for (const mode of modes) {
      p += gaussianPDF(x, y, mode);
    }
    return p;
  }

  // Full density including cursor attraction
  function targetDensity(x, y) {
    let p = baseDensity(x, y);
    if (cursorX !== null && cursorY !== null) {
      const dx = (x - cursorX) / cursorSD;
      const dy = (y - cursorY) / cursorSD;
      p += cursorWeight * Math.exp(-0.5 * (dx * dx + dy * dy));
    }
    return p;
  }

  function computeContourGrid() {
    const grid = [];
    let maxVal = 0;
    for (let i = 0; i < gridResolution; i++) {
      grid[i] = [];
      for (let j = 0; j < gridResolution; j++) {
        const x = i / (gridResolution - 1);
        const y = j / (gridResolution - 1);
        const val = baseDensity(x, y);
        grid[i][j] = val;
        if (val > maxVal) maxVal = val;
      }
    }
    contourData = { grid, maxVal };
  }

  // MCMC sampler state
  let mcmcX = 0.5;
  let mcmcY = 0.5;
  const proposalSD = 0.03;
  let samplesPerFrame = 3;
  const maxSamples = 2000;
  const maxChainVisible = 80;

  function mcmcStep() {
    const propX = mcmcX + (Math.random() - 0.5) * 2 * proposalSD;
    const propY = mcmcY + (Math.random() - 0.5) * 2 * proposalSD;

    if (propX < 0 || propX > 1 || propY < 0 || propY > 1) return;

    const currentP = targetDensity(mcmcX, mcmcY);
    const proposedP = targetDensity(propX, propY);
    const alpha = Math.min(1, proposedP / (currentP + 1e-10));

    if (Math.random() < alpha) {
      mcmcX = propX;
      mcmcY = propY;
    }

    const sample = { x: mcmcX, y: mcmcY, age: 0 };
    samples.push(sample);
    chain.push({ x: mcmcX, y: mcmcY });

    if (samples.length > maxSamples) {
      samples.shift();
    }
    if (chain.length > maxChainVisible) {
      chain.shift();
    }
  }

  function drawGrid() {
    ctx.strokeStyle = COLORS.gridLine;
    ctx.lineWidth = 0.5;

    const spacing = Math.max(width, height) / 20;
    for (let x = 0; x < width; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  function drawStars() {
    for (const star of stars) {
      const twinkle = 0.5 + 0.5 * Math.sin(time * star.twinkleSpeed + star.twinkleOffset);
      const alpha = 0.2 + 0.6 * twinkle;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(245, 240, 232, ${alpha})`;
      ctx.fill();
    }
  }

  function drawContours() {
    if (!contourData) return;

    const { grid, maxVal } = contourData;
    const levels = [0.08, 0.15, 0.25, 0.4, 0.6];
    const alphas = [0.06, 0.08, 0.10, 0.13, 0.18];

    const contourFade = Math.min(1, samples.length / 300);

    for (let l = 0; l < levels.length; l++) {
      const threshold = levels[l] * maxVal;
      const alpha = alphas[l] * contourFade;
      if (alpha < 0.01) continue;

      ctx.fillStyle = `rgba(42, 157, 143, ${alpha})`;

      const cellW = width / (gridResolution - 1);
      const cellH = height / (gridResolution - 1);

      for (let i = 0; i < gridResolution - 1; i++) {
        for (let j = 0; j < gridResolution - 1; j++) {
          if (grid[i][j] > threshold) {
            ctx.fillRect(i * cellW, j * cellH, cellW + 1, cellH + 1);
          }
        }
      }
    }

    // Contour lines
    if (contourFade > 0.3) {
      const lineAlpha = (contourFade - 0.3) * 1.4;
      const lineLevels = [0.15, 0.35, 0.55];
      for (const level of lineLevels) {
        const threshold = level * maxVal;
        ctx.strokeStyle = `rgba(212, 168, 67, ${0.15 * lineAlpha})`;
        ctx.lineWidth = 1;

        const cellW = width / (gridResolution - 1);
        const cellH = height / (gridResolution - 1);

        for (let i = 0; i < gridResolution - 1; i++) {
          for (let j = 0; j < gridResolution - 1; j++) {
            const v00 = grid[i][j] > threshold;
            const v10 = grid[i + 1][j] > threshold;
            const v01 = grid[i][j + 1] > threshold;
            const v11 = grid[i + 1][j + 1] > threshold;

            const sum = (v00 ? 1 : 0) + (v10 ? 1 : 0) + (v01 ? 1 : 0) + (v11 ? 1 : 0);
            if (sum > 0 && sum < 4) {
              const cx = (i + 0.5) * cellW;
              const cy = (j + 0.5) * cellH;
              ctx.beginPath();
              ctx.arc(cx, cy, 1, 0, Math.PI * 2);
              ctx.stroke();
            }
          }
        }
      }
    }
  }

  // Draw a subtle glow at cursor position
  function drawCursorAttractor() {
    if (cursorX === null || cursorY === null) return;

    const cx = cursorX * width;
    const cy = cursorY * height;
    const radius = cursorSD * Math.max(width, height);

    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, 'rgba(212, 168, 67, 0.08)');
    gradient.addColorStop(0.5, 'rgba(212, 168, 67, 0.03)');
    gradient.addColorStop(1, 'rgba(212, 168, 67, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawChain() {
    if (chain.length < 2) return;

    const chainFade = Math.min(1, samples.length / 100);
    ctx.strokeStyle = `rgba(212, 168, 67, ${0.2 * chainFade})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(chain[0].x * width, chain[0].y * height);
    for (let i = 1; i < chain.length; i++) {
      ctx.lineTo(chain[i].x * width, chain[i].y * height);
    }
    ctx.stroke();
  }

  function drawSamples() {
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      s.age++;

      const recentFraction = i / samples.length;
      const isRecent = i > samples.length - 20;

      if (isRecent) {
        const glow = 1 - (samples.length - i) / 20;
        ctx.beginPath();
        ctx.arc(s.x * width, s.y * height, 3 + glow * 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(212, 168, 67, ${0.6 * glow + 0.1})`;
        ctx.fill();
      } else {
        const alpha = 0.05 + 0.15 * recentFraction;
        ctx.beginPath();
        ctx.arc(s.x * width, s.y * height, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(42, 157, 143, ${alpha})`;
        ctx.fill();
      }
    }
  }

  // Constellation lines connecting modes
  function drawConstellationLines() {
    if (samples.length < 200) return;

    const fade = Math.min(1, (samples.length - 200) / 400);
    const modeCenters = modes.map(m => ({ x: m.x * width, y: m.y * height }));

    ctx.strokeStyle = `rgba(212, 168, 67, ${0.12 * fade})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 8]);

    // Connect in a constellation pattern (not all-to-all)
    const connections = [[0, 2], [2, 1], [2, 3], [2, 4], [0, 3], [1, 4]];
    for (const [a, b] of connections) {
      ctx.beginPath();
      ctx.moveTo(modeCenters[a].x, modeCenters[a].y);
      ctx.lineTo(modeCenters[b].x, modeCenters[b].y);
      ctx.stroke();
    }

    ctx.setLineDash([]);
  }

  function draw() {
    time++;

    // Background
    ctx.fillStyle = COLORS.navy;
    ctx.fillRect(0, 0, width, height);

    // Layers
    drawGrid();
    drawStars();
    drawContours();
    drawCursorAttractor();
    drawConstellationLines();
    drawChain();
    drawSamples();

    // Run MCMC steps
    for (let i = 0; i < samplesPerFrame; i++) {
      mcmcStep();
    }

    if (samples.length > 800) {
      samplesPerFrame = 1;
    }

    animationId = requestAnimationFrame(draw);
  }

  // Mouse/touch tracking
  function updateCursor(e) {
    const rect = canvas.getBoundingClientRect();
    cursorX = (e.clientX - rect.left) / rect.width;
    cursorY = (e.clientY - rect.top) / rect.height;
  }

  canvas.addEventListener('mousemove', updateCursor);
  canvas.addEventListener('mouseleave', () => {
    cursorX = null;
    cursorY = null;
  });
  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
      updateCursor(e.touches[0]);
    }
  }, { passive: true });
  canvas.addEventListener('touchend', () => {
    cursorX = null;
    cursorY = null;
  });

  // Pause when not visible
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          if (!animationId) animationId = requestAnimationFrame(draw);
        } else {
          if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
          }
        }
      }
    },
    { threshold: 0.1 }
  );

  // Initialize
  resize();
  observer.observe(canvas);
  window.addEventListener('resize', resize);
})();
