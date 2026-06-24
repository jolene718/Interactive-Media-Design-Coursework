// Current flow particle animation
const ParticleSystem = (function() {
  let canvas, ctx;
  let particles = [];
  let animating = false;
  let animFrame = null;
  let wirePath = [];
  let wirePaths = [];
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

    wirePath = [];
    wirePaths = buildPaths(result);
    particles = [];
    animating = true;

    if (wirePaths.length === 0) return;

    const pathLengths = wirePaths.map(getPathLength);
    const totalLength = pathLengths.reduce((sum, len) => sum + len, 0);
    const totalParticles = 24;
    const targetDensity = totalParticles / Math.max(totalLength, 1);

    wirePaths.forEach(function(path, pathIndex) {
      const pathLength = pathLengths[pathIndex];
      const particlesForPath = Math.max(3, Math.round(pathLength * targetDensity));

      for (let i = 0; i < particlesForPath; i++) {
        particles.push({
          pathIndex: pathIndex,
          progress: (i / particlesForPath + pathIndex * 0.07) % 1,
          size: 6 + Math.random() * 3,
          alpha: 0.55 + Math.random() * 0.35
        });
      }
    });

    lastTime = performance.now();
    animate();
  }

  function buildPaths(result) {
    var sourcePaths = result && result.paths && result.paths.length ? result.paths : [result.path];
    return sourcePaths.reduce(function(paths, sourcePath) {
      return paths.concat(buildWireSegments(sourcePath));
    }, []);
  }

  function buildWireSegments(path) {
    var segments = [];
    var current = [];
    if (!path) return segments;
    var wires = Wiring.getAll ? Wiring.getAll() : [];

    function flushCurrent() {
      if (current.length >= 2) segments.push(current);
      current = [];
    }

    function samePoint(a, b) {
      return a && b && Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;
    }

    for (var i = 0; i < path.length - 1; i++) {
      var from = parsePathNode(path[i]);
      var to = parsePathNode(path[i + 1]);
      if (!from || !to || !hasWireBetween(wires, from, to)) {
        flushCurrent();
        continue;
      }

      var fromPos = Wiring.getPortPosition(from.uid, from.portId);
      var toPos = Wiring.getPortPosition(to.uid, to.portId);
      if (!fromPos || !toPos) {
        flushCurrent();
        continue;
      }

      var curve = WireGeometry.sampleBezier(fromPos, toPos, 32);
      if (current.length === 0) {
        current = current.concat(curve);
      } else if (samePoint(current[current.length - 1], fromPos)) {
        current = current.concat(curve.slice(1));
      } else {
        flushCurrent();
        current = current.concat(curve);
      }
    }

    flushCurrent();
    return segments;
  }

  function parsePathNode(node) {
    if (!node) return null;
    var index = node.indexOf('.');
    if (index === -1) return null;
    return {
      uid: node.slice(0, index),
      portId: node.slice(index + 1)
    };
  }

  function hasWireBetween(wires, a, b) {
    return wires.some(function(wire) {
      return (wire.fromUid === a.uid && wire.fromPortId === a.portId && wire.toUid === b.uid && wire.toPortId === b.portId) ||
        (wire.fromUid === b.uid && wire.fromPortId === b.portId && wire.toUid === a.uid && wire.toPortId === a.portId);
    });
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

    if (wirePaths.length === 0) return;

    particles.forEach(p => {
      var path = wirePaths[p.pathIndex] || wirePath;
      var totalLen = getPathLength(path);
      if (totalLen <= 0) return;
      p.progress += (speed * dt) / totalLen;
      if (p.progress > 1) p.progress -= 1;

      const pos = getPointOnPath(path, p.progress);
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

  function getPathLength(path) {
    let totalLen = 0;
    for (let i = 1; i < path.length; i++) {
      const dx = path[i].x - path[i - 1].x;
      const dy = path[i].y - path[i - 1].y;
      totalLen += Math.sqrt(dx * dx + dy * dy);
    }
    return totalLen;
  }

  function getPointOnPath(path, progress) {
    if (path.length < 2) return null;

    let totalLen = 0;
    const segLens = [];
    for (let i = 1; i < path.length; i++) {
      const dx = path[i].x - path[i - 1].x;
      const dy = path[i].y - path[i - 1].y;
      const len = Math.sqrt(dx * dx + dy * dy);
      segLens.push(len);
      totalLen += len;
    }

    let targetLen = progress * totalLen;
    for (let i = 0; i < segLens.length; i++) {
      if (targetLen <= segLens[i]) {
        const t = targetLen / Math.max(segLens[i], 0.01);
        return {
          x: path[i].x + (path[i + 1].x - path[i].x) * t,
          y: path[i].y + (path[i + 1].y - path[i].y) * t
        };
      }
      targetLen -= segLens[i];
    }

    return path[path.length - 1];
  }

  function stop() {
    animating = false;
    if (animFrame) cancelAnimationFrame(animFrame);
    particles = [];
    wirePaths = [];
    if (ctx) ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  }

  return { init, resize, startFlow, stop, buildPaths };
})();
