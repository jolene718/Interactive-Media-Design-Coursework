// Shared curve geometry for wire drawing, hit testing, and flow particles.
const WireGeometry = (function() {
  function getControlPoints(from, to) {
    var dx = to.x - from.x;
    var dy = to.y - from.y;
    var horizontalPull = Math.max(42, Math.min(150, Math.abs(dx) * 0.55));
    var verticalPull = Math.max(18, Math.min(90, Math.abs(dy) * 0.25));
    var direction = dx >= 0 ? 1 : -1;

    return {
      cp1: {
        x: from.x + horizontalPull * direction,
        y: from.y + verticalPull * Math.sign(dy || 1)
      },
      cp2: {
        x: to.x - horizontalPull * direction,
        y: to.y - verticalPull * Math.sign(dy || 1)
      }
    };
  }

  function pointOnBezier(from, cp1, cp2, to, t) {
    var mt = 1 - t;
    return {
      x: mt * mt * mt * from.x + 3 * mt * mt * t * cp1.x + 3 * mt * t * t * cp2.x + t * t * t * to.x,
      y: mt * mt * mt * from.y + 3 * mt * mt * t * cp1.y + 3 * mt * t * t * cp2.y + t * t * t * to.y
    };
  }

  function sampleBezier(from, to, segments) {
    var controls = getControlPoints(from, to);
    var count = segments || 24;
    var points = [];
    for (var i = 0; i <= count; i++) {
      points.push(pointOnBezier(from, controls.cp1, controls.cp2, to, i / count));
    }
    return points;
  }

  function distanceToSegment(point, a, b) {
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    var lenSq = dx * dx + dy * dy;
    if (lenSq === 0) {
      return Math.hypot(point.x - a.x, point.y - a.y);
    }

    var t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lenSq));
    var projX = a.x + t * dx;
    var projY = a.y + t * dy;
    return Math.hypot(point.x - projX, point.y - projY);
  }

  function distanceToBezier(point, from, to) {
    var points = sampleBezier(from, to, 28);
    var min = Infinity;
    for (var i = 0; i < points.length - 1; i++) {
      min = Math.min(min, distanceToSegment(point, points[i], points[i + 1]));
    }
    return min;
  }

  function drawBezier(ctx, from, to) {
    var controls = getControlPoints(from, to);
    ctx.moveTo(from.x, from.y);
    ctx.bezierCurveTo(controls.cp1.x, controls.cp1.y, controls.cp2.x, controls.cp2.y, to.x, to.y);
  }

  return {
    getControlPoints: getControlPoints,
    pointOnBezier: pointOnBezier,
    sampleBezier: sampleBezier,
    distanceToBezier: distanceToBezier,
    drawBezier: drawBezier
  };
})();
