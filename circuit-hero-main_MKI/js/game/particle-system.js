// Current flow particle animation
const ParticleSystem = (function() {
  let canvas, ctx;
  let particles = [];
  let animating = false;
  let animFrame = null;
  let wirePath = [];
  let speed = 80; // px per second

  function init() {
    canvas = document.getElementById('particleCanvas');
    ctx = canvas.getContext('2d');
  }

  function resize() {
    const container = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = container.clientWidth * dpr;
    canvas.height = container.clientHeight * dpr;
    canvas.style.width = container.clientWidth + 'px';
    canvas.style.height = container.clientHeight + 'px';
    ctx.scale(dpr, dpr);
  }

  function startFlow(result) {
    if (!result || !result.bulb || !result.battery) return;
    resize();

    wirePath = buildPath(result);
    particles = [];
    animating = true;

    // Spawn particles along the path
    for (let i = 0; i < 20; i++) {
      particles.push({
        progress: i / 20,
        size: 6 + Math.random() * 3,
        alpha: 0.6 + Math.random() * 0.4
      });
    }

    lastTime = performance.now();
    animate();
  }

  function buildPath(result) {
    var points = [];
    if (!result.path) return points;

    for (var i = 0; i < result.path.length; i++) {
      var parts = result.path[i].split('.');
      var uid = parts[0];
      var portId = parts[1];
      var pos = Wiring.getPortPosition(uid, portId);
      if (pos) {
        if (points.length > 0) {
          var prev = points[points.length - 1];
          points.push({ x: (prev.x + pos.x) / 2, y: prev.y });
          points.push({ x: (prev.x + pos.x) / 2, y: pos.y });
        }
        points.push(pos);
      }
    }
    return points;
  }

  let lastTime = 0;

  function animate() {
    if (!animating) return;

    const now = performance.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    if (wirePath.length < 2) return;

    // Calculate total path length
    let totalLen = 0;
    for (let i = 1; i < wirePath.length; i++) {
      const dx = wirePath[i].x - wirePath[i - 1].x;
      const dy = wirePath[i].y - wirePath[i - 1].y;
      totalLen += Math.sqrt(dx * dx + dy * dy);
    }

    particles.forEach(p => {
      p.progress += (speed * dt) / totalLen;
      if (p.progress > 1) p.progress -= 1;

      const pos = getPointOnPath(p.progress);
      if (!pos) return;

      // Draw particle
      ctx.save();
      ctx.globalAlpha = p.alpha;

      // Glow
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, p.size / 2, 0, Math.PI * 2);
      ctx.fill();

      // Bright center
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, p.size / 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });

    animFrame = requestAnimationFrame(animate);
  }

  function getPointOnPath(progress) {
    if (wirePath.length < 2) return null;

    let totalLen = 0;
    const segLens = [];
    for (let i = 1; i < wirePath.length; i++) {
      const dx = wirePath[i].x - wirePath[i - 1].x;
      const dy = wirePath[i].y - wirePath[i - 1].y;
      const len = Math.sqrt(dx * dx + dy * dy);
      segLens.push(len);
      totalLen += len;
    }

    let targetLen = progress * totalLen;
    for (let i = 0; i < segLens.length; i++) {
      if (targetLen <= segLens[i]) {
        const t = targetLen / Math.max(segLens[i], 0.01);
        return {
          x: wirePath[i].x + (wirePath[i + 1].x - wirePath[i].x) * t,
          y: wirePath[i].y + (wirePath[i + 1].y - wirePath[i].y) * t
        };
      }
      targetLen -= segLens[i];
    }

    return wirePath[wirePath.length - 1];
  }

  function stop() {
    animating = false;
    if (animFrame) cancelAnimationFrame(animFrame);
    particles = [];
    if (ctx) ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  }

  return { init, resize, startFlow, stop };
})();
