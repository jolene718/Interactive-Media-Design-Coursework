// Wire drawing and connection system
const Wiring = (function() {
  let wires = [];
  let nextId = 1;
  let drawing = false;
  let fromPort = null;
  let tempLine = null;
  let canvas, ctx;
  let flashWires = []; // Wires being animated
  let selectedWireId = null;

  function init() {
    canvas = document.getElementById('wireCanvas');
    ctx = canvas.getContext('2d');

    resize();
    window.addEventListener('resize', resize);

    document.getElementById('componentsLayer').addEventListener('mousedown', onPortClick);
    document.addEventListener('mousemove', onDrawMove);
    document.addEventListener('mouseup', onDrawEnd);

    // Click on wire canvas to select/delete wires
    canvas.addEventListener('click', onCanvasClick);
  }

  function resize() {
    const container = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = container.clientWidth * dpr;
    canvas.height = container.clientHeight * dpr;
    canvas.style.width = container.clientWidth + 'px';
    canvas.style.height = container.clientHeight + 'px';
    ctx.scale(dpr, dpr);
    drawAll();
  }

  function onPortClick(e) {
    const portEl = e.target.closest('.port');
    if (!portEl) return;
    e.preventDefault();
    e.stopPropagation();

    const uid = portEl.dataset.uid;
    const portId = portEl.dataset.portId;

    if (!drawing) {
      // Start drawing
      fromPort = { uid, portId, element: portEl };
      drawing = true;
      portEl.classList.add('drawing-from');

      // Show all other ports as potential targets
      showTargetPorts(uid, portId);
    } else {
      if (uid === fromPort.uid && portId === fromPort.portId) {
        cancelDraw();
        return;
      }

      // Check if this port is already connected to the from port
      const exists = wires.find(w =>
        (w.fromUid === fromPort.uid && w.fromPortId === fromPort.portId && w.toUid === uid && w.toPortId === portId) ||
        (w.fromUid === uid && w.fromPortId === portId && w.toUid === fromPort.uid && w.toPortId === fromPort.portId)
      );
      if (exists) {
        cancelDraw();
        return;
      }

      // Complete the wire
      const wire = createWire(fromPort.uid, fromPort.portId, uid, portId);
      if (wire) {
        UndoRedo.push({ type: 'wire', wireId: wire.id });
        document.dispatchEvent(new CustomEvent('circuit:wire-connected', {
          detail: { wire }
        }));
        DragDrop.updateStatus();

        // Flash animation on new wire
        flashWire(wire.id);
      }
      cancelDraw();
    }
  }

  function showTargetPorts(fromUid, fromPortId) {
    // Highlight all ports that are valid targets
    document.querySelectorAll('.placed-component .port').forEach(function(p) {
      if (p.dataset.uid === fromUid && p.dataset.portId === fromPortId) return;
      p.classList.add('wire-target');
    });
  }

  function hideTargetPorts() {
    document.querySelectorAll('.port.wire-target').forEach(function(p) {
      p.classList.remove('wire-target');
    });
  }

  function onDrawMove(e) {
    if (!drawing || !fromPort) return;
    const stageGrid = document.getElementById('stageGrid');
    const rect = stageGrid.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;

    drawAll();

    // Draw temporary wire with dashed style
    const fromPos = getPortPosition(fromPort.uid, fromPort.portId);
    if (fromPos) {
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = '#FF8C42';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([10, 6]);
      ctx.globalAlpha = 0.85;
      drawLPath(ctx, fromPos.x, fromPos.y, localX, localY);
      ctx.stroke();

      // Draw a small circle at the mouse position as a "cursor"
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(localX, localY, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#FF8C42';
      ctx.globalAlpha = 0.6;
      ctx.fill();
      ctx.restore();
    }

    // Highlight port under cursor
    const portEl = e.target.closest ? e.target.closest('.port') : null;
    document.querySelectorAll('.port.hover-target').forEach(function(p) { p.classList.remove('hover-target'); });
    if (portEl && portEl.dataset.uid !== fromPort.uid || (portEl && portEl.dataset.portId !== fromPort.portId)) {
      if (portEl.classList.contains('wire-target')) {
        portEl.classList.add('hover-target');
      }
    }
  }

  function onDrawEnd(e) {
    if (drawing && !e.target.closest('.port')) {
      // Don't cancel on mouseup during drawing — only cancel on Escape or clicking same port
      // This allows the user to click and release without accidentally canceling
    }
  }

  function cancelDraw() {
    drawing = false;
    fromPort = null;
    document.querySelectorAll('.port.drawing-from').forEach(function(p) { p.classList.remove('drawing-from'); });
    hideTargetPorts();
    document.querySelectorAll('.port.hover-target').forEach(function(p) { p.classList.remove('hover-target'); });
    drawAll();
  }

  function getPortPosition(uid, portId) {
    const comp = Components.getByUid(uid);
    if (!comp) return null;
    const port = comp.def.ports.find(function(p) { return p.id === portId; });
    if (!port) return null;

    const pos = Grid.gridToPixel(comp.col, comp.row);
    return {
      x: pos.x - comp.def.pixelWidth / 2 + port.offsetX,
      y: pos.y - comp.def.pixelHeight / 2 + port.offsetY
    };
  }

  function createWire(fromUid, fromPortId, toUid, toPortId) {
    const exists = wires.find(function(w) {
      return (w.fromUid === fromUid && w.fromPortId === fromPortId && w.toUid === toUid && w.toPortId === toPortId) ||
             (w.fromUid === toUid && w.fromPortId === toPortId && w.toUid === fromUid && w.toPortId === fromPortId);
    });
    if (exists) return null;

    var id = 'wire_' + nextId++;
    var wire = { id: id, fromUid: fromUid, fromPortId: fromPortId, toUid: toUid, toPortId: toPortId };
    wires.push(wire);
    updatePortStates();
    drawAll();
    return wire;
  }

  function removeWire(wireId) {
    var idx = wires.findIndex(function(w) { return w.id === wireId; });
    if (idx >= 0) {
      wires.splice(idx, 1);
      selectedWireId = null;
      updatePortStates();
      drawAll();
      DragDrop.updateStatus();
    }
  }

  function flashWire(wireId) {
    flashWires.push({ id: wireId, startTime: Date.now(), duration: 600 });
    animateFlash();
  }

  function animateFlash() {
    if (flashWires.length === 0) return;
    var now = Date.now();
    flashWires = flashWires.filter(function(fw) { return now - fw.startTime < fw.duration; });
    drawAll();
    if (flashWires.length > 0) {
      requestAnimationFrame(animateFlash);
    }
  }

  function onCanvasClick(e) {
    if (drawing) return;
    var stageGrid = document.getElementById('stageGrid');
    var rect = stageGrid.getBoundingClientRect();
    var localX = e.clientX - rect.left;
    var localY = e.clientY - rect.top;

    // Check if click is near any wire
    var clicked = findWireNear(localX, localY);
    if (clicked) {
      if (selectedWireId === clicked.id) {
        // Double-click same wire → delete
        removeWire(clicked.id);
      } else {
        selectedWireId = clicked.id;
        drawAll();
      }
    } else {
      selectedWireId = null;
      drawAll();
    }
  }

  function findWireNear(x, y) {
    var threshold = 10;
    for (var i = wires.length - 1; i >= 0; i--) {
      var wire = wires[i];
      var from = getPortPosition(wire.fromUid, wire.fromPortId);
      var to = getPortPosition(wire.toUid, wire.toPortId);
      if (!from || !to) continue;

      var midX = (from.x + to.x) / 2;
      // L-path has 3 segments: horizontal, vertical, horizontal
      var points = [
        from,
        { x: midX, y: from.y },
        { x: midX, y: to.y },
        to
      ];

      for (var j = 0; j < points.length - 1; j++) {
        if (distToSegment(x, y, points[j].x, points[j].y, points[j + 1].x, points[j + 1].y) < threshold) {
          return wire;
        }
      }
    }
    return null;
  }

  function distToSegment(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1;
    var dy = y2 - y1;
    var lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
    var t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    var projX = x1 + t * dx;
    var projY = y1 + t * dy;
    return Math.sqrt((px - projX) * (px - projX) + (py - projY) * (py - projY));
  }

  function updatePortStates() {
    // Mark ports as connected
    document.querySelectorAll('.port').forEach(function(p) {
      p.classList.remove('port-connected');
    });
    wires.forEach(function(wire) {
      markPortConnected(wire.fromUid, wire.fromPortId);
      markPortConnected(wire.toUid, wire.toPortId);
    });
  }

  function markPortConnected(uid, portId) {
    var comp = Components.getByUid(uid);
    if (!comp || !comp.element) return;
    var ports = comp.element.querySelectorAll('.port');
    ports.forEach(function(p) {
      if (p.dataset.uid === uid && p.dataset.portId === portId) {
        p.classList.add('port-connected');
      }
    });
  }

  function drawAll() {
    var w = canvas.clientWidth;
    var h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    var now = Date.now();

    wires.forEach(function(wire) {
      var from = getPortPosition(wire.fromUid, wire.fromPortId);
      var to = getPortPosition(wire.toUid, wire.toPortId);
      if (!from || !to) return;

      var isSelected = wire.id === selectedWireId;
      var flash = flashWires.find(function(fw) { return fw.id === wire.id; });
      var flashProgress = flash ? (now - flash.startTime) / flash.duration : 0;

      ctx.save();
      ctx.beginPath();

      // Wire color
      if (isSelected) {
        ctx.strokeStyle = '#E74C3C';
        ctx.lineWidth = 5;
      } else if (flash && flashProgress < 1) {
        // Flash animation: bright gold → normal
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 5;
        ctx.globalAlpha = 1 - flashProgress * 0.5;
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 12 * (1 - flashProgress);
      } else {
        ctx.strokeStyle = '#7A6B5A';
        ctx.lineWidth = 4;
      }

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      drawLPath(ctx, from.x, from.y, to.x, to.y);
      ctx.stroke();

      // Draw small dots at endpoints
      if (!isSelected && !(flash && flashProgress < 1)) {
        ctx.beginPath();
        ctx.fillStyle = '#7A6B5A';
        ctx.arc(from.x, from.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(to.x, to.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    });
  }

  function drawLPath(ctx, x1, y1, x2, y2) {
    var midX = (x1 + x2) / 2;
    ctx.moveTo(x1, y1);
    ctx.lineTo(midX, y1);
    ctx.lineTo(midX, y2);
    ctx.lineTo(x2, y2);
  }

  function updateWiresForComponent(uid) {
    updatePortStates();
    drawAll();
  }

  function getAll() { return wires; }

  function clearAll() {
    wires = [];
    selectedWireId = null;
    flashWires = [];
    updatePortStates();
    drawAll();
  }

  function getPortConnections(uid, portId) {
    return wires.filter(function(w) {
      return (w.fromUid === uid && w.fromPortId === portId) ||
             (w.toUid === uid && w.toPortId === portId);
    });
  }

  return { init, createWire, removeWire, getAll, clearAll, drawAll, updateWiresForComponent, getPortPosition, getPortConnections, cancelDraw };
})();
