// Circuit simulation engine
const CircuitEngine = (function() {

  function evaluate(levelConfig) {
    const components = Components.getAll();
    const wires = Wiring.getAll();
    const goal = levelConfig && levelConfig.circuitGoal ? levelConfig.circuitGoal : { type: 'closed', requiredBulbs: 1 };
    const requiredBulbs = goal.requiredBulbs || 1;
    const requiredSwitches = goal.requiredSwitches || 0;

    if (goal.type === 'houseWiring') {
      return evaluateHouseWiring(levelConfig);
    }

    if (goal.type === 'theaterWiring') {
      return evaluateTheaterWiring(levelConfig);
    }

    const batteries = components.filter(c => c.type === 'battery');
    const bulbs = components.filter(c => c.type === 'bulb');
    const switches = components.filter(c => c.type === 'switch');

    if (components.length === 0) {
      return { status: 'incomplete', reason: 'missing-components', message: 'Missing components.' };
    }
    if (batteries.length === 0) {
      return { status: 'incomplete', reason: 'missing-battery', message: 'Missing battery.' };
    }
    if (bulbs.length < requiredBulbs) {
      return {
        status: 'incomplete',
        reason: requiredBulbs === 1 ? 'missing-bulb' : 'missing-bulbs',
        message: requiredBulbs === 1 ? 'Missing bulb.' : 'Missing bulbs. Need ' + requiredBulbs + ' bulbs.'
      };
    }
    if (switches.length < requiredSwitches) {
      return {
        status: 'incomplete',
        reason: requiredSwitches === 1 ? 'missing-switch' : 'missing-switches',
        message: requiredSwitches === 1 ? 'Missing switch. This level needs 1 switch.' : 'Missing switches. Need ' + requiredSwitches + ' switches.'
      };
    }
    if (wires.length < 2) {
      return { status: 'incomplete', reason: 'missing-wires', message: 'Missing wires.' };
    }

    const battery = batteries[0];

    const posWires = Wiring.getPortConnections(battery.uid, 'pos');
    const negWires = Wiring.getPortConnections(battery.uid, 'neg');

    for (const pw of posWires) {
      for (const nw of negWires) {
        const pwOtherUid = pw.fromUid === battery.uid ? pw.toUid : pw.fromUid;
        const nwOtherUid = nw.fromUid === battery.uid ? nw.toUid : nw.fromUid;
        const pwOtherPort = pw.fromUid === battery.uid ? pw.toPortId : pw.fromPortId;
        const nwOtherPort = nw.fromUid === battery.uid ? nw.toPortId : nw.fromPortId;

        if (pwOtherUid === nwOtherUid && pwOtherPort === nwOtherPort && pwOtherUid === battery.uid) {
          return { status: 'short', reason: 'short-circuit', message: 'Circuit error: Short circuit detected.' };
        }
      }
    }

    if (goal.type === 'parallel') {
      var parallelResult = evaluateParallelGoal(battery, bulbs, requiredBulbs);
      if (parallelResult.status === 'closed') return parallelResult;
      return parallelResult;
    }

    const startKey = battery.uid + '.pos';
    const targetKey = battery.uid + '.neg';
    const visited = new Set();
    const queue = [{ key: startKey, path: [startKey] }];
    visited.add(startKey);

    while (queue.length > 0) {
      const current = queue.shift();

      if (current.key === targetKey) {
        const bulbsInPath = bulbs.filter(function(bulb) {
          return current.path.some(function(k) { return k.startsWith(bulb.uid + '.'); });
        });
        if (bulbsInPath.length >= requiredBulbs) {
          const switchesInPath = components.filter(function(component) {
            return component.type === 'switch' && current.path.some(function(k) {
              return k.startsWith(component.uid + '.');
            });
          });
          if (switchesInPath.length < requiredSwitches) {
            return {
              status: 'open',
              reason: 'missing-switch',
              message: 'Missing switch in circuit.'
            };
          }
          return {
            status: 'closed',
            message: 'Circuit complete!',
            path: current.path,
            battery: battery,
            bulb: bulbsInPath[0],
            bulbs: bulbsInPath
          };
        } else {
          return { status: 'short', reason: 'short-circuit', message: 'Circuit error: Short circuit detected.' };
        }
      }

      const [uid, portId] = current.key.split('.');
      const comp = Components.getByUid(uid);

      if (comp && comp.type !== 'battery') {
        if (comp.type === 'switch' && !comp.switchClosed) {
          // Switch open
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

    const openSwitches = components.filter(function(c) { return c.type === 'switch' && !c.switchClosed; });
    if (openSwitches.length > 0) {
      return { status: 'open', reason: 'switch-open', message: 'Switch is open. Click to close it.' };
    }
    return { status: 'open', reason: 'open-circuit', message: 'Circuit error: No complete path.' };
  }

  function getGraph(options) {
    var skipBulbInternal = options && options.skipBulbInternal;
    var components = Components.getAll();
    var wires = Wiring.getAll();
    var graph = {};

    function addNode(key) {
      if (!graph[key]) graph[key] = [];
    }

    function addEdge(a, b) {
      addNode(a);
      addNode(b);
      graph[a].push(b);
      graph[b].push(a);
    }

    components.forEach(function(comp) {
      comp.def.ports.forEach(function(port) {
        addNode(comp.uid + '.' + port.id);
      });

      if (comp.type !== 'battery' && !(skipBulbInternal && comp.type === 'bulb')) {
        if (comp.type !== 'switch' || comp.switchClosed) {
          for (var i = 0; i < comp.def.ports.length - 1; i++) {
            addEdge(comp.uid + '.' + comp.def.ports[i].id, comp.uid + '.' + comp.def.ports[i + 1].id);
          }
        }
      }
    });

    wires.forEach(function(wire) {
      addEdge(wire.fromUid + '.' + wire.fromPortId, wire.toUid + '.' + wire.toPortId);
    });

    return graph;
  }

  function canReach(graph, start, target) {
    var queue = [start];
    var visited = new Set([start]);
    while (queue.length > 0) {
      var current = queue.shift();
      if (current === target) return true;
      (graph[current] || []).forEach(function(next) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      });
    }
    return false;
  }

  function evaluateParallelGoal(battery, bulbs, requiredBulbs) {
    var graph = getGraph({ skipBulbInternal: true });
    var posKey = battery.uid + '.pos';
    var negKey = battery.uid + '.neg';
    var validBulbs = bulbs.filter(function(bulb) {
      var left = bulb.uid + '.left';
      var right = bulb.uid + '.right';
      return (canReach(graph, posKey, left) && canReach(graph, negKey, right)) ||
        (canReach(graph, posKey, right) && canReach(graph, negKey, left));
    });

    if (validBulbs.length >= requiredBulbs) {
      return {
        status: 'closed',
        message: 'Parallel circuit complete!',
        path: [posKey, validBulbs[0].uid + '.left', validBulbs[0].uid + '.right', negKey],
        battery: battery,
        bulb: validBulbs[0],
        bulbs: validBulbs
      };
    }

    return { status: 'open', reason: 'parallel-connections', message: 'Circuit error: Check parallel connections.' };
  }

  function isBulbLit(bulb, graph, posKey, negKey) {
    const left = bulb.uid + '.left';
    const right = bulb.uid + '.right';
    return (canReach(graph, posKey, left) && canReach(graph, negKey, right)) ||
           (canReach(graph, posKey, right) && canReach(graph, negKey, left));
  }

  function getSwitchSnapshot(switches) {
    const snapshot = {};
    switches.forEach(sw => {
      snapshot[sw.uid] = sw.switchClosed;
    });
    return snapshot;
  }

  function restoreSwitchSnapshot(switches, snapshot) {
    switches.forEach(sw => {
      if (snapshot[sw.uid] !== undefined) {
        sw.switchClosed = snapshot[sw.uid];
      }
    });
  }

  function setAllSwitchesClosed(switches, closed) {
    switches.forEach(sw => {
      sw.switchClosed = closed !== undefined ? closed : true;
    });
  }

  function buildStateGraph(components, wires, options) {
    const skipBulbUid = options && options.skipBulbUid;
    const graph = new Map();

    function addEdge(a, b) {
      if (!graph.has(a)) graph.set(a, []);
      if (!graph.has(b)) graph.set(b, []);
      graph.get(a).push(b);
      graph.get(b).push(a);
    }

    wires.forEach(function(wire) {
      addEdge(wire.fromUid + '.' + wire.fromPortId, wire.toUid + '.' + wire.toPortId);
    });

    components.forEach(function(comp) {
      if (comp.type === 'battery') return;
      if (comp.type === 'bulb' && comp.uid === skipBulbUid) return;
      if (comp.type === 'switch' && !comp.switchClosed) return;
      if (comp.def.ports.length >= 2) {
        addEdge(comp.uid + '.' + comp.def.ports[0].id, comp.uid + '.' + comp.def.ports[1].id);
      }
    });

    return graph;
  }

  function canReachInStateGraph(graph, start, target) {
    if (!graph.has(start) || !graph.has(target)) return false;
    const visited = new Set([start]);
    const queue = [start];
    while (queue.length > 0) {
      const current = queue.shift();
      if (current === target) return true;
      const neighbors = graph.get(current) || [];
      for (const next of neighbors) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
    return false;
  }

  function isBulbLitInStateGraph(bulb, graph, posKey, negKey) {
    const left = bulb.uid + '.left';
    const right = bulb.uid + '.right';
    return (canReachInStateGraph(graph, posKey, left) && canReachInStateGraph(graph, negKey, right)) ||
      (canReachInStateGraph(graph, posKey, right) && canReachInStateGraph(graph, negKey, left));
  }

  function saveSwitchState(switches) {
    const state = {};
    switches.forEach(function(sw) {
      state[sw.uid] = sw.switchClosed;
    });
    return state;
  }

  function restoreSwitchState(switches, state) {
    switches.forEach(function(sw) {
      if (state[sw.uid] !== undefined) {
        sw.switchClosed = state[sw.uid];
      }
    });
  }

  function withSwitchStates(switches, states, callback) {
    switches.forEach(function(sw) {
      if (states[sw.uid] !== undefined) {
        sw.switchClosed = states[sw.uid];
      }
    });
    return callback();
  }

  function getLitBulbs(components, wires, bulbs, battery) {
    const posKey = battery.uid + '.pos';
    const negKey = battery.uid + '.neg';
    return bulbs.filter(function(bulb) {
      const graph = buildStateGraph(components, wires, { skipBulbUid: bulb.uid });
      return isBulbLitInStateGraph(bulb, graph, posKey, negKey);
    });
  }

  function sameBulbSet(a, b) {
    if (a.length !== b.length) return false;
    const ids = new Set(a.map(function(bulb) { return bulb.uid; }));
    return b.every(function(bulb) { return ids.has(bulb.uid); });
  }

  function isSubsetBulbSet(subset, superset) {
    const ids = new Set(superset.map(function(bulb) { return bulb.uid; }));
    return subset.every(function(bulb) { return ids.has(bulb.uid); });
  }

  function firstPathBetween(graph, start, target) {
    if (!graph[start] || !graph[target]) return null;
    const visited = new Set([start]);
    const queue = [{ key: start, path: [start] }];
    while (queue.length > 0) {
      const current = queue.shift();
      if (current.key === target) return current.path;
      (graph[current.key] || []).forEach(function(next) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push({ key: next, path: current.path.concat(next) });
        }
      });
    }
    return null;
  }

  function firstPathContaining(graph, start, target, requiredUid, avoidUids) {
    avoidUids = avoidUids || [];
    if (!graph[start] || !graph[target]) return null;
    const visited = new Set();
    const queue = [{ key: start, path: [start], hasRequired: start.startsWith(requiredUid + '.') }];
    while (queue.length > 0) {
      const current = queue.shift();
      const visitedKey = current.key + '|' + (current.hasRequired ? '1' : '0');
      if (visited.has(visitedKey)) continue;
      visited.add(visitedKey);

      if (current.key === target && current.hasRequired) return current.path;
      (graph[current.key] || []).forEach(function(next) {
        if (!next.startsWith(requiredUid + '.') && avoidUids.some(function(uid) { return next.startsWith(uid + '.'); })) {
          return;
        }
        queue.push({
          key: next,
          path: current.path.concat(next),
          hasRequired: current.hasRequired || next.startsWith(requiredUid + '.')
        });
      });
    }
    return null;
  }

  function buildWireOnlyGraph(wires) {
    const graph = {};
    function addEdge(a, b) {
      if (!graph[a]) graph[a] = [];
      if (!graph[b]) graph[b] = [];
      graph[a].push(b);
      graph[b].push(a);
    }
    wires.forEach(function(wire) {
      addEdge(wire.fromUid + '.' + wire.fromPortId, wire.toUid + '.' + wire.toPortId);
    });
    return graph;
  }

  function buildAnimationPathForBulb(components, wires, battery, bulb) {
    const graph = buildStateGraph(components, wires, { skipBulbUid: bulb.uid });
    const posKey = battery.uid + '.pos';
    const negKey = battery.uid + '.neg';
    const leftKey = bulb.uid + '.left';
    const rightKey = bulb.uid + '.right';
    const leftToPos = canReachInStateGraph(graph, posKey, leftKey);
    const rightToNeg = canReachInStateGraph(graph, negKey, rightKey);
    const rightToPos = canReachInStateGraph(graph, posKey, rightKey);
    const leftToNeg = canReachInStateGraph(graph, negKey, leftKey);

    const fullGraph = getGraph({ skipBulbInternal: false });

    if (leftToPos && rightToNeg) {
      const pathToBulb = firstPathBetween(fullGraph, posKey, leftKey);
      const pathFromBulb = firstPathBetween(fullGraph, rightKey, negKey);
      return mergeWirePaths(pathToBulb, pathFromBulb);
    }
    if (rightToPos && leftToNeg) {
      const pathToBulb = firstPathBetween(fullGraph, posKey, rightKey);
      const pathFromBulb = firstPathBetween(fullGraph, leftKey, negKey);
      return mergeWirePaths(pathToBulb, pathFromBulb);
    }
    return null;
  }

  function mergeWirePaths(beforeBulb, afterBulb) {
    if (!beforeBulb || !afterBulb) return null;
    return beforeBulb.concat(afterBulb);
  }

  function evaluateHouseWiring(levelConfig) {
    const components = Components.getAll();
    const wires = Wiring.getAll();
    const batteries = components.filter(c => c.type === 'battery');
    const bulbs = components.filter(c => c.type === 'bulb');
    const switches = components.filter(c => c.type === 'switch');

    if (batteries.length === 0) return { status: 'incomplete', reason: 'missing-battery', message: 'Missing battery.' };
    if (bulbs.length < 3) return { status: 'incomplete', reason: 'missing-bulbs', message: 'Missing bulbs. Need 3 bulbs.' };
    if (bulbs.length > 3) return { status: 'incomplete', reason: 'too-many-bulbs', message: 'Too many bulbs. Use exactly 3 bulbs.' };
    if (switches.length < 3) return { status: 'incomplete', reason: 'missing-switches', message: 'Missing switches. Need 3 switches.' };
    if (switches.length > 3) return { status: 'incomplete', reason: 'too-many-switches', message: 'Too many switches. Use exactly 3 switches.' };
    if (wires.length < 2) return { status: 'incomplete', reason: 'missing-wires', message: 'Missing wires.' };

    const battery = batteries[0];
    const originalState = saveSwitchState(switches);
    let masterSwitch = null;

    for (const testSwitch of switches) {
      const states = {};
      switches.forEach(function(sw) { states[sw.uid] = sw !== testSwitch; });
      const lit = withSwitchStates(switches, states, function() {
        return getLitBulbs(components, wires, bulbs, battery);
      });
      if (lit.length === 0) {
        masterSwitch = testSwitch;
        break;
      }
    }

    if (!masterSwitch) {
      restoreSwitchState(switches, originalState);
      return { status: 'open', reason: 'house-master-switch', message: 'Circuit error: Missing master switch.' };
    }

    const livingRoomSwitches = switches.filter(s => s !== masterSwitch);
    const switchA = livingRoomSwitches[0];
    const switchB = livingRoomSwitches[1];

    const bothOn = withSwitchStates(switches, {
      [masterSwitch.uid]: true,
      [switchA.uid]: true,
      [switchB.uid]: true
    }, function() { return getLitBulbs(components, wires, bulbs, battery); });
    const onlyA = withSwitchStates(switches, {
      [masterSwitch.uid]: true,
      [switchA.uid]: true,
      [switchB.uid]: false
    }, function() { return getLitBulbs(components, wires, bulbs, battery); });
    const onlyB = withSwitchStates(switches, {
      [masterSwitch.uid]: true,
      [switchA.uid]: false,
      [switchB.uid]: true
    }, function() { return getLitBulbs(components, wires, bulbs, battery); });
    const masterOff = withSwitchStates(switches, {
      [masterSwitch.uid]: false,
      [switchA.uid]: true,
      [switchB.uid]: true
    }, function() { return getLitBulbs(components, wires, bulbs, battery); });

    restoreSwitchState(switches, originalState);

    if (bothOn.length !== 3 || onlyA.length !== 2 || onlyB.length !== 2 || masterOff.length !== 0) {
      return { status: 'open', reason: 'house-switch-logic', message: 'Circuit error: Check switch logic.' };
    }

    const hallwayCandidates = onlyA.filter(function(bulb) {
      return onlyB.some(function(other) { return other.uid === bulb.uid; });
    });
    if (hallwayCandidates.length !== 1) {
      return { status: 'open', reason: 'house-hallway-wiring', message: 'Circuit error: Check hallway bulb wiring.' };
    }

    const hallwayBulb = hallwayCandidates[0];
    const livingA = onlyA.find(function(bulb) { return bulb.uid !== hallwayBulb.uid; });
    const livingB = onlyB.find(function(bulb) { return bulb.uid !== hallwayBulb.uid; });
    if (!livingA || !livingB || livingA.uid === livingB.uid) {
      return { status: 'open', reason: 'house-room-switch-wiring', message: 'Circuit error: Check room switch wiring.' };
    }

    const graph = getGraph();
    const batteryPos = battery.uid + '.pos';
    const batteryNeg = battery.uid + '.neg';
    const path = firstPathBetween(graph, batteryPos, batteryNeg);
    const pathA = buildAnimationPathForBulb(components, wires, battery, livingA) ||
      firstPathContaining(graph, batteryPos, batteryNeg, livingA.uid, [livingB.uid]);
    const pathB = buildAnimationPathForBulb(components, wires, battery, livingB) ||
      firstPathContaining(graph, batteryPos, batteryNeg, livingB.uid, [livingA.uid]);
    return {
      status: 'closed',
      message: 'House wiring complete!',
      path: path || [batteryPos, livingA.uid + '.left', livingA.uid + '.right', hallwayBulb.uid + '.left', hallwayBulb.uid + '.right', batteryNeg],
      paths: [pathA, pathB].filter(Boolean),
      battery: battery,
      bulb: livingA,
      bulbs: [livingA, livingB, hallwayBulb],
      details: {
        masterSwitch: masterSwitch.uid,
        livingRoomSwitches: livingRoomSwitches.map(function(sw) { return sw.uid; }),
        livingRoomBulbs: [livingA.uid, livingB.uid],
        hallwayBulb: hallwayBulb.uid
      }
    };
  }

  function evaluateTheaterWiring(levelConfig) {
    const components = Components.getAll();
    const wires = Wiring.getAll();
    const batteries = components.filter(c => c.type === 'battery');
    const bulbs = components.filter(c => c.type === 'bulb');
    const switches = components.filter(c => c.type === 'switch');

    if (batteries.length === 0) return { status: 'incomplete', reason: 'missing-battery', message: 'Missing battery.' };
    if (bulbs.length < 5) return { status: 'incomplete', reason: 'missing-bulbs', message: 'Missing bulbs. Need 5 bulbs.' };
    if (bulbs.length > 5) return { status: 'incomplete', reason: 'too-many-bulbs', message: 'Too many bulbs. Use exactly 5 bulbs.' };
    if (switches.length < 3) return { status: 'incomplete', reason: 'missing-switches', message: 'Missing switches. Need 3 switches.' };
    if (switches.length > 3) return { status: 'incomplete', reason: 'too-many-switches', message: 'Too many switches. Use exactly 3 switches.' };
    if (wires.length < 2) return { status: 'incomplete', reason: 'missing-wires', message: 'Missing wires.' };

    const battery = batteries[0];
    const originalState = saveSwitchState(switches);
    let masterSwitch = null;

    for (const testSwitch of switches) {
      const states = {};
      switches.forEach(function(sw) { states[sw.uid] = sw !== testSwitch; });
      const lit = withSwitchStates(switches, states, function() {
        return getLitBulbs(components, wires, bulbs, battery);
      });
      if (lit.length === 0) {
        masterSwitch = testSwitch;
        break;
      }
    }

    if (!masterSwitch) {
      restoreSwitchState(switches, originalState);
      return { status: 'open', reason: 'theater-master-switch', message: 'Circuit error: Missing master switch.' };
    }

    const branchSwitches = switches.filter(function(sw) { return sw !== masterSwitch; });
    const switchA = branchSwitches[0];
    const switchB = branchSwitches[1];

    const bothOn = withSwitchStates(switches, {
      [masterSwitch.uid]: true,
      [switchA.uid]: true,
      [switchB.uid]: true
    }, function() { return getLitBulbs(components, wires, bulbs, battery); });
    const onlyA = withSwitchStates(switches, {
      [masterSwitch.uid]: true,
      [switchA.uid]: true,
      [switchB.uid]: false
    }, function() { return getLitBulbs(components, wires, bulbs, battery); });
    const onlyB = withSwitchStates(switches, {
      [masterSwitch.uid]: true,
      [switchA.uid]: false,
      [switchB.uid]: true
    }, function() { return getLitBulbs(components, wires, bulbs, battery); });
    const audienceOff = withSwitchStates(switches, {
      [masterSwitch.uid]: true,
      [switchA.uid]: false,
      [switchB.uid]: false
    }, function() { return getLitBulbs(components, wires, bulbs, battery); });
    const masterOff = withSwitchStates(switches, {
      [masterSwitch.uid]: false,
      [switchA.uid]: true,
      [switchB.uid]: true
    }, function() { return getLitBulbs(components, wires, bulbs, battery); });

    restoreSwitchState(switches, originalState);

    if (bothOn.length !== 5 || onlyA.length !== 4 || onlyB.length !== 4 || audienceOff.length !== 3 || masterOff.length !== 0) {
      return { status: 'open', reason: 'theater-switch-logic', message: 'Circuit error: Check switch logic.' };
    }

    if (!isSubsetBulbSet(audienceOff, onlyA) || !isSubsetBulbSet(audienceOff, onlyB) || !isSubsetBulbSet(audienceOff, bothOn)) {
      return { status: 'open', reason: 'theater-stage-wiring', message: 'Circuit error: Check stage lights wiring.' };
    }

    const stageBulbs = audienceOff;
    const audienceA = onlyA.find(function(bulb) {
      return !stageBulbs.some(function(stageBulb) { return stageBulb.uid === bulb.uid; });
    });
    const audienceB = onlyB.find(function(bulb) {
      return !stageBulbs.some(function(stageBulb) { return stageBulb.uid === bulb.uid; });
    });

    if (!audienceA || !audienceB || audienceA.uid === audienceB.uid) {
      return { status: 'open', reason: 'theater-audience-wiring', message: 'Circuit error: Check audience switch wiring.' };
    }

    const batteryPos = battery.uid + '.pos';
    const batteryNeg = battery.uid + '.neg';
    const stagePath = withSwitchStates(switches, {
      [masterSwitch.uid]: true,
      [switchA.uid]: false,
      [switchB.uid]: false
    }, function() {
      return firstPathBetween(getGraph(), batteryPos, batteryNeg);
    });

    const pathA = withSwitchStates(switches, {
      [masterSwitch.uid]: true,
      [switchA.uid]: true,
      [switchB.uid]: false
    }, function() {
      return buildAnimationPathForBulb(components, wires, battery, audienceA) ||
        firstPathContaining(getGraph(), batteryPos, batteryNeg, audienceA.uid, [audienceB.uid]);
    });

    const pathB = withSwitchStates(switches, {
      [masterSwitch.uid]: true,
      [switchA.uid]: false,
      [switchB.uid]: true
    }, function() {
      return buildAnimationPathForBulb(components, wires, battery, audienceB) ||
        firstPathContaining(getGraph(), batteryPos, batteryNeg, audienceB.uid, [audienceA.uid]);
    });

    restoreSwitchState(switches, originalState);

    const pathStageCount = stagePath ? stageBulbs.filter(function(bulb) {
      return stagePath.some(function(node) { return node.startsWith(bulb.uid + '.'); });
    }).length : 0;

    if (pathStageCount < 3) {
      return { status: 'open', reason: 'theater-stage-series', message: 'Circuit error: Stage lights must be in series.' };
    }

    return {
      status: 'closed',
      message: 'Theater wiring complete!',
      path: stagePath || [batteryPos].concat(stageBulbs.map(function(bulb) { return bulb.uid + '.left'; })).concat([batteryNeg]),
      paths: [stagePath, pathA, pathB].filter(Boolean),
      battery: battery,
      bulb: stageBulbs[0],
      bulbs: stageBulbs.concat([audienceA, audienceB]),
      details: {
        masterSwitch: masterSwitch.uid,
        stageBulbs: stageBulbs.map(function(bulb) { return bulb.uid; }),
        audienceSwitches: branchSwitches.map(function(sw) { return sw.uid; }),
        audienceBulbs: [audienceA.uid, audienceB.uid]
      }
    };
  }

  return { 
    evaluate,
    evaluateHouseWiring,
    evaluateTheaterWiring,
    getGraph,
    canReach,
    isBulbLit
  };
})();
