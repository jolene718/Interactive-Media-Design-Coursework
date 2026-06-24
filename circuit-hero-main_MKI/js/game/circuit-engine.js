// Circuit simulation engine
const CircuitEngine = (function() {

  function evaluate() {
    const components = Components.getAll();
    const wires = Wiring.getAll();

    if (components.length < 2) return { status: 'incomplete', message: 'Place all components first.' };
    if (wires.length < 2) return { status: 'incomplete', message: 'Connect wires between ports.' };

    // Find battery and bulb
    const batteries = components.filter(c => c.type === 'battery');
    const bulbs = components.filter(c => c.type === 'bulb');

    if (batteries.length === 0) return { status: 'incomplete', message: 'Need a battery.' };
    if (bulbs.length === 0) return { status: 'incomplete', message: 'Need a bulb.' };

    const battery = batteries[0];
    const bulb = bulbs[0];

    // Check for short circuit: battery pos directly connected to battery neg
    const posPort = battery.def.ports.find(p => p.id === 'pos');
    const negPort = battery.def.ports.find(p => p.id === 'neg');

    const posWires = Wiring.getPortConnections(battery.uid, 'pos');
    const negWires = Wiring.getPortConnections(battery.uid, 'neg');

    // Check if battery pos connects to battery neg directly (no load)
    for (const pw of posWires) {
      for (const nw of negWires) {
        const pwOtherUid = pw.fromUid === battery.uid ? pw.toUid : pw.fromUid;
        const nwOtherUid = nw.fromUid === battery.uid ? nw.toUid : nw.fromUid;
        const pwOtherPort = pw.fromUid === battery.uid ? pw.toPortId : pw.fromPortId;
        const nwOtherPort = nw.fromUid === battery.uid ? nw.toPortId : nw.fromPortId;

        // If both connect to same component and same port, it's a short
        if (pwOtherUid === nwOtherUid && pwOtherPort === nwOtherPort && pwOtherUid === battery.uid) {
          return { status: 'short', message: 'Short circuit! Current bypasses the load!' };
        }
      }
    }

    // Build adjacency for path finding
    // Each port is a node, wires are edges
    const visited = new Set();
    const path = [];

    // BFS from battery positive
    const startKey = battery.uid + '.pos';
    const targetKey = battery.uid + '.neg';
    const queue = [{ key: startKey, path: [startKey] }];
    visited.add(startKey);

    while (queue.length > 0) {
      const current = queue.shift();

      if (current.key === targetKey) {
        // Found a path! Now check if it goes through a load (bulb)
        const goesThroughBulb = current.path.some(k => k.startsWith(bulb.uid));
        if (goesThroughBulb) {
          return {
            status: 'closed',
            message: 'Circuit complete!',
            path: current.path,
            battery: battery,
            bulb: bulb
          };
        } else {
          return { status: 'short', message: 'Short circuit! Current goes directly back without powering the bulb.' };
        }
      }

      const [uid, portId] = current.key.split('.');

      // Get internal connections (within same component)
      // Skip for battery — it's the source, not a pass-through
      const comp = Components.getByUid(uid);
      if (comp && comp.type !== 'battery') {
        // Open switch blocks current flow
        if (comp.type === 'switch' && !comp.switchClosed) {
          // Switch is open — no internal connection
        } else {
          comp.def.ports.forEach(p => {
            const pKey = uid + '.' + p.id;
            if (!visited.has(pKey)) {
              visited.add(pKey);
              queue.push({ key: pKey, path: [...current.path, pKey] });
            }
          });
        }
      }

      // Get wire connections
      const portWires = Wiring.getPortConnections(uid, portId);
      portWires.forEach(w => {
        const otherUid = w.fromUid === uid && w.fromPortId === portId ? w.toUid : w.fromUid;
        const otherPort = w.fromUid === uid && w.fromPortId === portId ? w.toPortId : w.fromPortId;
        const otherKey = otherUid + '.' + otherPort;
        if (!visited.has(otherKey)) {
          visited.add(otherKey);
          queue.push({ key: otherKey, path: [...current.path, otherKey] });
        }
      });
    }

    // No path found — open circuit
    // Check if an open switch is the cause
    const openSwitches = components.filter(function(c) { return c.type === 'switch' && !c.switchClosed; });
    if (openSwitches.length > 0) {
      return { status: 'open', message: 'Open circuit! The switch is open — click it to close, then try again.' };
    }
    return { status: 'open', message: 'Open circuit! Current has no complete path from (+) to (-).' };
  }

  return { evaluate };
})();
