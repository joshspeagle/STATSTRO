/**
 * Parallel-Tempered MCMC Hero Animation
 * Three chains at different temperatures explore a curved 2D posterior
 * with banana-shaped modes, visualized as celestial cartography.
 * The cursor creates a gravitational well that biases sampling.
 */
(function () {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let width, height;
  let animationId;
  let contourData = null;
  let gridResolution = 80;
  let time = 0;

  // Design tokens
  const COLORS = {
    navy: '#0B1D3A',
    gold: '#D4A843',
    teal: '#2A9D8F',
    cream: '#F5F0E8',
    coral: '#C45B3E',
    gridLine: 'rgba(245, 240, 232, 0.04)',
  };

  // Target distribution: 3 banana-shaped modes (closer together for mode crossing)
  const modes = [
    { x: 0.30, y: 0.38, sx: 0.10, sy: 0.08, w: 0.40, curve: 3.0, angle: 0.3 },
    { x: 0.66, y: 0.30, sx: 0.09, sy: 0.10, w: 0.35, curve: -2.5, angle: -0.2 },
    { x: 0.48, y: 0.70, sx: 0.11, sy: 0.08, w: 0.25, curve: 2.0, angle: -0.5 },
  ];

  // Cursor state (normalized 0-1 coordinates, null when off-canvas)
  let cursorX = null;
  let cursorY = null;
  const cursorWeight = 0.40;
  const cursorSD = 0.14;

  // Background stars
  let stars = [];

  // Parallel tempering: 3 chains at different temperatures
  const temperatures = [1, 3, 10];
  const chainColors = [COLORS.gold, COLORS.teal, COLORS.coral];
  const baseProposalSD = 0.03;
  const maxSamplesPerChain = 800;
  const maxTraceLength = 60;
  let samplesPerFrame = 1;
  let totalSamples = 0;

  // Swap visualization
  let recentSwaps = [];

  let chains = temperatures.map((T, i) => ({
    x: 0.3 + 0.18 * i,
    y: 0.35 + 0.18 * i,
    T,
    samples: [],
    trace: [],
    proposalSD: baseProposalSD * Math.sqrt(T),
  }));

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

  // Banana-shaped Gaussian PDF: applies rotation then curves y-axis quadratically in x
  function bananaPDF(x, y, mode) {
    const dx = x - mode.x;
    const dy = y - mode.y;

    // Rotate into mode's local frame
    const cos = Math.cos(mode.angle);
    const sin = Math.sin(mode.angle);
    const rx = cos * dx + sin * dy;
    const ry = -sin * dx + cos * dy;

    // Banana transform: bend y based on x^2
    const ry2 = ry - mode.curve * rx * rx;

    const zx = rx / mode.sx;
    const zy = ry2 / mode.sy;
    return mode.w * Math.exp(-0.5 * (zx * zx + zy * zy));
  }

  // Static density (without cursor) for contour grid
  function baseDensity(x, y) {
    let p = 0;
    for (const mode of modes) {
      p += bananaPDF(x, y, mode);
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

  // Metropolis-Hastings step for a single tempered chain
  function mcmcStep(chain) {
    const sd = chain.proposalSD;
    const propX = chain.x + (Math.random() - 0.5) * 2 * sd;
    const propY = chain.y + (Math.random() - 0.5) * 2 * sd;

    if (propX < 0 || propX > 1 || propY < 0 || propY > 1) return;

    const beta = 1 / chain.T;
    const currentP = targetDensity(chain.x, chain.y);
    const proposedP = targetDensity(propX, propY);
    const logAlpha = beta * (Math.log(proposedP + 1e-30) - Math.log(currentP + 1e-30));

    if (Math.log(Math.random()) < logAlpha) {
      chain.x = propX;
      chain.y = propY;
    }

    chain.samples.push({ x: chain.x, y: chain.y, age: 0 });
    chain.trace.push({ x: chain.x, y: chain.y });

    if (chain.samples.length > maxSamplesPerChain) {
      chain.samples.shift();
    }
    if (chain.trace.length > maxTraceLength) {
      chain.trace.shift();
    }
  }

  // Parallel tempering swap between two adjacent chains
  function attemptSwap(i, j) {
    const c1 = chains[i], c2 = chains[j];
    const beta1 = 1 / c1.T, beta2 = 1 / c2.T;
    const logP1 = Math.log(targetDensity(c1.x, c1.y) + 1e-30);
    const logP2 = Math.log(targetDensity(c2.x, c2.y) + 1e-30);
    const logAlpha = (beta1 - beta2) * (logP2 - logP1);

    if (Math.log(Math.random()) < logAlpha) {
      // Swap positions
      const tmpX = c1.x, tmpY = c1.y;
      c1.x = c2.x; c1.y = c2.y;
      c2.x = tmpX; c2.y = tmpY;

      recentSwaps.push({
        x1: c1.x, y1: c1.y,
        x2: c2.x, y2: c2.y,
        age: 0,
        color1: chainColors[i],
        color2: chainColors[j],
      });
      return true;
    }
    return false;
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

    const contourFade = Math.min(1, totalSamples / 300);

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

  // Draw a glow at cursor position
  function drawCursorAttractor() {
    if (cursorX === null || cursorY === null) return;

    const cx = cursorX * width;
    const cy = cursorY * height;
    const radius = cursorSD * Math.max(width, height);

    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, 'rgba(212, 168, 67, 0.15)');
    gradient.addColorStop(0.4, 'rgba(212, 168, 67, 0.06)');
    gradient.addColorStop(1, 'rgba(212, 168, 67, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Constellation lines connecting the 3 modes (triangle)
  function drawConstellationLines() {
    if (totalSamples < 200) return;

    const fade = Math.min(1, (totalSamples - 200) / 400);
    const modeCenters = modes.map(m => ({ x: m.x * width, y: m.y * height }));

    ctx.strokeStyle = `rgba(212, 168, 67, ${0.12 * fade})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 8]);

    const connections = [[0, 1], [1, 2], [2, 0]];
    for (const [a, b] of connections) {
      ctx.beginPath();
      ctx.moveTo(modeCenters[a].x, modeCenters[a].y);
      ctx.lineTo(modeCenters[b].x, modeCenters[b].y);
      ctx.stroke();
    }

    ctx.setLineDash([]);
  }

  // Draw a chain's trace (recent path)
  function drawChainTrace(chain, color, chainIdx) {
    if (chain.trace.length < 2) return;

    const traceFade = Math.min(1, totalSamples / 100);
    const lineWidth = chainIdx === 0 ? 1.5 : chainIdx === 1 ? 1.2 : 1.0;
    const baseAlpha = chainIdx === 0 ? 0.35 : chainIdx === 1 ? 0.30 : 0.25;

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.globalAlpha = baseAlpha * traceFade;
    ctx.beginPath();
    ctx.moveTo(chain.trace[0].x * width, chain.trace[0].y * height);
    for (let i = 1; i < chain.trace.length; i++) {
      ctx.lineTo(chain.trace[i].x * width, chain.trace[i].y * height);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Draw a chain's current position as a bright walker dot
  function drawChainWalker(chain, color, chainIdx) {
    const rgb = hexToRgb(color);
    const cx = chain.x * width;
    const cy = chain.y * height;
    const radius = chainIdx === 0 ? 5 : chainIdx === 1 ? 4 : 3.5;

    // Outer glow
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 3);
    gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`);
    gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 3, 0, Math.PI * 2);
    ctx.fill();

    // Solid dot
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.9)`;
    ctx.fill();

    // Bright center
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, 0.6)`;
    ctx.fill();
  }

  // Draw a chain's samples
  function drawChainSamples(chain, color, chainIdx) {
    const rgb = hexToRgb(color);

    for (let i = 0; i < chain.samples.length; i++) {
      const s = chain.samples[i];
      s.age++;

      const recentFraction = i / chain.samples.length;
      const radius = chainIdx === 0 ? 1.8 : chainIdx === 1 ? 1.5 : 1.2;
      const alphaScale = chainIdx === 0 ? 1.0 : chainIdx === 1 ? 0.7 : 0.5;
      const alpha = (0.06 + 0.20 * recentFraction) * alphaScale;

      ctx.beginPath();
      ctx.arc(s.x * width, s.y * height, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
      ctx.fill();
    }
  }

  // Draw swap events: colored arcs showing the two chains that swapped
  function drawSwaps() {
    for (const swap of recentSwaps) {
      const progress = swap.age / 40;
      const alpha = 0.6 * (1 - progress);
      if (alpha < 0.01) continue;

      const x1 = swap.x1 * width, y1 = swap.y1 * height;
      const x2 = swap.x2 * width, y2 = swap.y2 * height;
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const dx = x2 - x1, dy = y2 - y1;

      // Curved control point
      const cpX = midX - dy * 0.3;
      const cpY = midY + dx * 0.3;

      // Draw arc in first chain's color
      ctx.strokeStyle = swap.color1;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 2 * (1 - progress * 0.5);
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(cpX, cpY, x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Flare at each endpoint in its chain color
      const flareR = 6 * (1 - progress);
      const rgb1 = hexToRgb(swap.color1);
      const rgb2 = hexToRgb(swap.color2);

      ctx.fillStyle = `rgba(${rgb1.r}, ${rgb1.g}, ${rgb1.b}, ${alpha * 0.7})`;
      ctx.beginPath();
      ctx.arc(x1, y1, flareR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(${rgb2.r}, ${rgb2.g}, ${rgb2.b}, ${alpha * 0.7})`;
      ctx.beginPath();
      ctx.arc(x2, y2, flareR, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;
    }
  }

  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
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
    drawSwaps();

    // Draw each chain (hot first so cold draws on top)
    for (let ci = chains.length - 1; ci >= 0; ci--) {
      drawChainSamples(chains[ci], chainColors[ci], ci);
    }
    for (let ci = chains.length - 1; ci >= 0; ci--) {
      drawChainTrace(chains[ci], chainColors[ci], ci);
      drawChainWalker(chains[ci], chainColors[ci], ci);
    }

    // Run MCMC steps for all chains
    for (let s = 0; s < samplesPerFrame; s++) {
      for (const chain of chains) {
        mcmcStep(chain);
      }
      totalSamples++;
    }

    // Attempt temperature swaps every 15 steps
    if (totalSamples % 15 === 0) {
      // Randomly pick adjacent pair
      if (Math.random() < 0.5) {
        attemptSwap(0, 1);
      } else {
        attemptSwap(1, 2);
      }
    }

    // Age and prune swap visuals
    recentSwaps = recentSwaps.filter(s => { s.age++; return s.age < 40; });

    // Slow down after initial burst
    if (totalSamples > 600) {
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
