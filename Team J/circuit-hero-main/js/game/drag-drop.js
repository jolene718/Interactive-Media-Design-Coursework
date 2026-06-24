// Drag and drop system
const DragDrop = (function() {
  let isDragging = false;
  let dragType = null;
  let ghostEl = null;
  let currentMoveComp = null;
  let dragStartPos = null;
  let didMove = false;
  let levelConfig = null;

  function init() {
    var params = new URLSearchParams(window.location.search);
    var levelId = params.get('level') || '1-1';
    levelConfig = typeof LevelConfig !== 'undefined' ? LevelConfig.get(levelId) : null;
    // Panel item drag start
    document.querySelectorAll('.component-item[draggable="true"]').forEach(item => {
      item.addEventListener('mousedown', onPanelDragStart);
      item.addEventListener('touchstart', onPanelDragStart, { passive: false });
    });

    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
    document.addEventListener('touchmove', onDragMove, { passive: false });
    document.addEventListener('touchend', onDragEnd);
  }

  function onPanelDragStart(e) {
    if (e.target.closest('.component-item.locked')) return;
    e.preventDefault();

    const item = e.target.closest('.component-item');
    dragType = item.dataset.type;
    if (!dragType) return;

    const def = Components.getDef(dragType);
    if (!def) return;

    if (hasReachedLimit(dragType)) return;

    isDragging = true;
    const pos = getEventPos(e);

    ghostEl = document.createElement('div');
    ghostEl.className = 'drag-ghost';
    ghostEl.innerHTML = def.render();
    ghostEl.style.width = def.pixelWidth + 'px';
    ghostEl.style.height = def.pixelHeight + 'px';
    ghostEl.style.left = (pos.x - def.pixelWidth / 2) + 'px';
    ghostEl.style.top = (pos.y - def.pixelHeight / 2) + 'px';
    ghostEl.style.opacity = '0.7';
    document.body.appendChild(ghostEl);

    item.classList.add('dragging');
  }

  function startMove(comp, e) {
    currentMoveComp = comp;
    isDragging = true;
    dragType = comp.type;
    didMove = false;
    dragStartPos = getEventPos(e);

    const pos = getEventPos(e);
    ghostEl = document.createElement('div');
    ghostEl.className = 'drag-ghost';
    ghostEl.innerHTML = comp.def.render();
    ghostEl.style.width = comp.def.pixelWidth + 'px';
    ghostEl.style.height = comp.def.pixelHeight + 'px';
    ghostEl.style.left = (pos.x - comp.def.pixelWidth / 2) + 'px';
    ghostEl.style.top = (pos.y - comp.def.pixelHeight / 2) + 'px';
    ghostEl.style.opacity = '0.7';
    document.body.appendChild(ghostEl);

    if (comp.element) comp.element.style.opacity = '0.3';
  }

  function onDragMove(e) {
    if (!isDragging || !ghostEl) return;
    e.preventDefault();
    const pos = getEventPos(e);

    // Track if we actually moved (for click vs drag detection)
    if (dragStartPos) {
      const dx = pos.x - dragStartPos.x;
      const dy = pos.y - dragStartPos.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        didMove = true;
      }
    }

    const def = Components.getDef(dragType);
    if (def) {
      ghostEl.style.left = (pos.x - def.pixelWidth / 2) + 'px';
      ghostEl.style.top = (pos.y - def.pixelHeight / 2) + 'px';
    }
  }

  function onDragEnd(e) {
    if (!isDragging) return;
    isDragging = false;

    // If we didn't actually move and it's a switch, treat as toggle click
    if (!didMove && currentMoveComp && currentMoveComp.type === 'switch') {
      Components.toggleSwitch(currentMoveComp.uid);
      if (currentMoveComp.element) currentMoveComp.element.style.opacity = '1';
      if (ghostEl) { ghostEl.remove(); ghostEl = null; }
      document.querySelectorAll('.component-item.dragging').forEach(function(i) { i.classList.remove('dragging'); });
      dragType = null;
      currentMoveComp = null;
      dragStartPos = null;
      return;
    }

    const pos = getEventPos(e);
    const stageGrid = document.getElementById('stageGrid');
    const rect = stageGrid.getBoundingClientRect();

    if (pos.x >= rect.left && pos.x <= rect.right && pos.y >= rect.top && pos.y <= rect.bottom) {
      const localX = pos.x - rect.left;
      const localY = pos.y - rect.top;
      const gridPos = Grid.snapToGrid(localX, localY);

      if (currentMoveComp) {
        // Moving existing component
        const oldCol = currentMoveComp.col;
        const oldRow = currentMoveComp.row;
        currentMoveComp.col = gridPos.col;
        currentMoveComp.row = gridPos.row;
        Components.updatePosition(currentMoveComp);
        if (currentMoveComp.element) currentMoveComp.element.style.opacity = '1';
        UndoRedo.push({
          type: 'move',
          uid: currentMoveComp.uid,
          fromCol: oldCol, fromRow: oldRow,
          toCol: gridPos.col, toRow: gridPos.row
        });
        // Update wires connected to this component
        Wiring.updateWiresForComponent(currentMoveComp.uid);
        currentMoveComp = null;
      } else {
        // Placing new component
        const comp = Components.create(dragType, gridPos.col, gridPos.row);
        if (comp) {
          Components.renderToDOM(comp);
          setupComponentDrag(comp);
          UndoRedo.push({ type: 'place', uid: comp.uid, compType: dragType, col: gridPos.col, row: gridPos.row });

          // Emit event for tutorial
          document.dispatchEvent(new CustomEvent('circuit:component-placed', {
            detail: { type: dragType, uid: comp.uid }
          }));

          updateStatus();
        }
      }
    } else if (currentMoveComp) {
      // Dropped outside stage — remove
      if (currentMoveComp.element) currentMoveComp.element.style.opacity = '1';
      currentMoveComp = null;
    }

    if (ghostEl) { ghostEl.remove(); ghostEl = null; }
    document.querySelectorAll('.component-item.dragging').forEach(i => i.classList.remove('dragging'));
    dragType = null;
    dragStartPos = null;
    currentMoveComp = null;
  }

  function setupComponentDrag(comp) {
    if (!comp.element) return;
    comp.element.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('port')) return; // Don't drag from port
      e.preventDefault();
      startMove(comp, e);
    });
  }

  function hasReachedLimit(type) {
    if (!levelConfig || !levelConfig.workbench || !levelConfig.workbench.partsPanel) {
      return Components.getByType(type).length > 0;
    }

    var part = levelConfig.workbench.partsPanel[type];
    if (!part || part.count === Infinity) return false;
    return Components.getByType(type).length >= part.count;
  }

  function getEventPos(e) {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    if (e.changedTouches && e.changedTouches.length > 0) {
      return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }

  function updateStatus() {
    const wires = Wiring.getAll();
    const comps = Components.getAll();
    const statusText = document.getElementById('statusText');
    const statusDot = document.getElementById('statusDot');

    if (comps.length < 2) {
      statusText.textContent = 'Drag components from the parts panel onto the board.';
    } else if (wires.length < 2) {
      statusText.textContent = 'Circuit open — wire up both terminals to complete the loop.';
    } else {
      // Check if there's a switch that's open
      const switches = Components.getByType('switch');
      const openSwitch = switches.find(function(s) { return !s.switchClosed; });
      if (openSwitch) {
        statusText.textContent = 'Switch is open — click it to close, then power on!';
      } else {
        statusText.textContent = 'Ready to test — click Power On!';
      }
      statusDot.classList.add('connected');
    }
  }

  return { init, setupComponentDrag, updateStatus };
})();
