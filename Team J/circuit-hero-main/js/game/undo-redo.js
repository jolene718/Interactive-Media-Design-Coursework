// Undo/Redo system
const UndoRedo = (function() {
  let undoStack = [];
  let redoStack = [];

  function push(action) {
    undoStack.push(action);
    redoStack = [];
  }

  function undo() {
    if (undoStack.length === 0) return;
    const action = undoStack.pop();

    if (action.type === 'place') {
      Components.remove(action.uid);
      Wiring.drawAll();
      DragDrop.updateStatus();
    } else if (action.type === 'wire') {
      Wiring.removeWire(action.wireId);
    } else if (action.type === 'move') {
      const comp = Components.getByUid(action.uid);
      if (comp) {
        comp.col = action.fromCol;
        comp.row = action.fromRow;
        Components.updatePosition(comp);
        Wiring.updateWiresForComponent(comp.uid);
      }
    }

    redoStack.push(action);
  }

  function redo() {
    if (redoStack.length === 0) return;
    const action = redoStack.pop();

    if (action.type === 'place') {
      const comp = Components.create(action.compType, action.col, action.row);
      if (comp) {
        Components.renderToDOM(comp);
        DragDrop.setupComponentDrag(comp);
        DragDrop.updateStatus();
      }
    } else if (action.type === 'wire') {
      if (action.wire) {
        const wire = Wiring.createWire(
          action.wire.fromUid,
          action.wire.fromPortId,
          action.wire.toUid,
          action.wire.toPortId
        );
        if (wire) {
          action.wireId = wire.id;
          action.wire = Object.assign({}, wire);
        }
      }
    } else if (action.type === 'move') {
      const comp = Components.getByUid(action.uid);
      if (comp) {
        comp.col = action.toCol;
        comp.row = action.toRow;
        Components.updatePosition(comp);
        Wiring.updateWiresForComponent(comp.uid);
      }
    }

    undoStack.push(action);
  }

  function clear() {
    undoStack = [];
    redoStack = [];
  }

  return { push, undo, redo, clear };
})();
