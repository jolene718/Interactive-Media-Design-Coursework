// Workbench main controller
(function() {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var levelId = params.get('level') || '1-1';
  var config = LevelConfig.get(levelId);
  var isSandbox = config && config.mode === 'sandbox';
  var timerInterval = null;
  var startTime = Date.now();
  var powered = false;
  var levelComplete = false;
  var restoredDesign = false;
  var notificationTimeout = null;
  var SAVED_DESIGNS_KEY = 'circuitHeroSandboxDesigns';
  var SHARE_DESIGN_PARAM = 'design';

  function init() {
    // Initialize all subsystems
    Grid.init();
    Wiring.init();
    ParticleSystem.init();
    Feedback.init();

    // Set header level info from config
    if (config) {
      var badge = document.getElementById('levelIdBadge');
      if (badge) badge.textContent = config.id;
      var nameEl = document.getElementById('levelNameText');
      if (nameEl) nameEl.textContent = config.title;

      // Setup parts panel based on config
      setupPartsPanel();

      // Set back button link
      var backBtn = document.getElementById('backBtn');
      if (backBtn) {
        backBtn.href = isSandbox ? 'story-map.html' : 'mission-briefing.html?chapter=' + config.chapter + '&level=' + config.id;
      }
    }

    if (isSandbox) {
      setupSandboxUI();
      restoreSandboxDesign();
    }

    // Delay DragDrop init to ensure components are in DOM
    setTimeout(function() {
      DragDrop.init();
    }, 100);

    // Pre-place components from config only when no saved/shared sandbox design is restored
    if (config && config.workbench.prePlace && !restoredDesign) {
      var stageGrid = document.getElementById('stageGrid');
      setTimeout(function() {
        var cols = Grid.getCols();
        var rows = Grid.getRows();
        config.workbench.prePlace.forEach(function(item) {
          var comp = Components.create(item.type, Math.floor(cols * item.colRatio), Math.floor(rows * item.rowRatio));
          if (comp) {
            Components.renderToDOM(comp);
            DragDrop.setupComponentDrag(comp);
          }
        });
      }, 200);
    }

    // Start tutorial
    setTimeout(function() {
      if (isSandbox) return;
      if (window.OnboardingGuide && OnboardingGuide.shouldDelayWorkbenchTutorial(levelId)) return;
      Tutorial.init(levelId);
    }, 600);

    document.addEventListener('onboarding:workbench-ready', function() {
      if (!isSandbox) Tutorial.init(levelId);
    }, { once: true });

    if (window.OnboardingGuide) {
      setTimeout(function() {
        OnboardingGuide.init('workbench');
      }, 700);
    }

    // Timer
    if (isSandbox) {
      var display = document.getElementById('timerDisplay');
      if (display) display.textContent = 'LAB';
    } else {
      startTimer();
    }

    // Power button
    document.getElementById('powerBtn').addEventListener('click', onPowerOn);

    // Keyboard shortcuts
    document.addEventListener('keydown', onKeyDown);

    // Tool buttons
    document.getElementById('undoBtn').addEventListener('click', function() { UndoRedo.undo(); });
    document.getElementById('redoBtn').addEventListener('click', function() { UndoRedo.redo(); });
    document.getElementById('deleteBtn').addEventListener('click', onDelete);
    document.getElementById('clearBtn').addEventListener('click', onClear);

    // Hint button
    document.getElementById('hintBtn').addEventListener('click', onHint);

    // Sandbox save/share controls
    var saveDesignBtn = document.getElementById('saveDesignBtn');
    if (saveDesignBtn) saveDesignBtn.addEventListener('click', function() {
      saveDesign();
      updateLoadButtonState();
    });
    var shareLinkBtn = document.getElementById('shareLinkBtn');
    if (shareLinkBtn) shareLinkBtn.addEventListener('click', shareDesign);
    var loadDesignBtn = document.getElementById('loadDesignBtn');
    if (loadDesignBtn) loadDesignBtn.addEventListener('click', function() {
      showLoadDesignModal();
    });

    // Help close
    document.getElementById('helpClose').addEventListener('click', function() {
      document.getElementById('stageInstruction').style.display = 'none';
    });

    // Window resize
    window.addEventListener('resize', function() {
      Grid.resize();
      Wiring.resize();
      ParticleSystem.resize();
    });
  }

  function setupPartsPanel() {
    if (!config || !config.workbench.partsPanel) return;
    var parts = config.workbench.partsPanel;
    Object.keys(parts).forEach(function(type) {
      var item = document.querySelector('.component-item[data-type="' + type + '"]');
      if (!item) return;
      var partConfig = parts[type];
      if (partConfig.locked) {
        item.classList.add('locked');
        item.setAttribute('draggable', 'false');
      } else {
        item.classList.remove('locked');
        item.setAttribute('draggable', 'true');
        var countEl = item.querySelector('.comp-count');
        if (countEl) {
          countEl.textContent = partConfig.count === Infinity ? '∞' : 'x' + partConfig.count;
        }
        var lockEl = item.querySelector('.comp-lock');
        if (lockEl) lockEl.remove();
        if (type === 'switch') {
          unlockSwitchItem(item);
          if (levelId === '2-1') {
            var nameEl = item.querySelector('.comp-name');
            if (nameEl) {
              nameEl.innerHTML = 'Switch <span style="color:#27AE60;font-size:10px;font-weight:700;">NEW!</span>';
            }
          }
        }
      }
    });
  }

  function unlockSwitchItem(item) {
    var nameEl = item.querySelector('.comp-name');
    if (nameEl) nameEl.style.opacity = '1';
    var iconSvg = item.querySelectorAll('svg [opacity]');
    iconSvg.forEach(function(el) { el.setAttribute('opacity', '1'); });
  }

  function setupSandboxUI() {
    var badge = document.getElementById('levelIdBadge');
    if (badge) badge.textContent = 'LAB';
    var hintBtn = document.getElementById('hintBtn');
    if (hintBtn) hintBtn.style.display = 'none';
    var starDisplay = document.getElementById('starDisplay');
    if (starDisplay) starDisplay.style.display = 'none';
    var statusText = document.getElementById('statusText');
    if (statusText) statusText.textContent = 'Sandbox mode — build freely and power any complete circuit.';
    var bottomRight = document.querySelector('.bottom-right .hint-text');
    if (bottomRight) bottomRight.textContent = 'No stars, no timer — just experiment.';

    var saveDesignBtn = document.getElementById('saveDesignBtn');
    if (saveDesignBtn) saveDesignBtn.style.display = '';
    var shareLinkBtn = document.getElementById('shareLinkBtn');
    if (shareLinkBtn) shareLinkBtn.style.display = '';
    updateLoadButtonState();
  }

  function updateLoadButtonState() {
    var loadDesignBtn = document.getElementById('loadDesignBtn');
    if (!loadDesignBtn) return;
    loadDesignBtn.style.display = isSandbox ? '' : 'none';
  }

  function getAllSavedDesigns() {
    try {
      var raw = window.localStorage.getItem(SAVED_DESIGNS_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function saveSandboxDesignWithName(name) {
    if (!isSandbox) return false;
    if (!name || name.trim().length === 0) return false;
    var designState = getSandboxDesignState();
    var designs = getAllSavedDesigns();
    var newDesign = {
      id: 'design_' + Date.now(),
      name: name.trim(),
      timestamp: Date.now(),
      state: designState
    };
    designs.push(newDesign);
    try {
      window.localStorage.setItem(SAVED_DESIGNS_KEY, JSON.stringify(designs));
      updateLoadButtonState();
      return true;
    } catch (err) {
      return false;
    }
  }

  function deleteSandboxDesign(id) {
    var designs = getAllSavedDesigns();
    var idx = designs.findIndex(function(d) { return d.id === id; });
    if (idx >= 0) {
      designs.splice(idx, 1);
      try {
        window.localStorage.setItem(SAVED_DESIGNS_KEY, JSON.stringify(designs));
        updateLoadButtonState();
        return true;
      } catch (err) {
        return false;
      }
    }
    return false;
  }

  function showLoadDesignModal() {
    if (!isSandbox) return;
    var designs = getAllSavedDesigns();
    if (designs.length === 0) {
      showNotification('No saved designs yet.');
      return;
    }

    var modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = '9999';
    modal.innerHTML = '<div class="modal-card" style="width:400px;max-height:60vh;overflow-y:auto;">' +
      '<div class="modal-header" style="padding:20px;border-bottom:1px solid #ccc;">' +
      '<h2 style="margin:0;font-size:18px;">Saved Designs</h2>' +
      '</div>' +
      '<div class="modal-body" style="padding:15px;" id="designsList"></div>' +
      '<div class="modal-footer" style="padding:15px;border-top:1px solid #ccc;text-align:right;">' +
      '<button class="btn btn-secondary" style="cursor:pointer;">Close</button>' +
      '</div>' +
      '</div>';

    var designsList = modal.querySelector('#designsList');
    designs.forEach(function(design, idx) {
      var item = document.createElement('div');
      item.style.cssText = 'margin-bottom:12px;padding:12px;background:#f5f5f5;border-radius:4px;border-left:3px solid #FF8C42;';
      var date = new Date(design.timestamp);
      var dateStr = date.toLocaleString();
      item.innerHTML = '<div style="font-weight:700;margin-bottom:4px;">' + design.name + '</div>' +
        '<div style="font-size:12px;color:#666;margin-bottom:8px;">' + dateStr + '</div>' +
        '<button class="load-design-btn" data-id="' + design.id + '" style="cursor:pointer;margin-right:8px;padding:6px 12px;background:#27AE60;color:white;border:none;border-radius:3px;">Load</button>' +
        '<button class="delete-design-btn" data-id="' + design.id + '" style="cursor:pointer;padding:6px 12px;background:#E74C3C;color:white;border:none;border-radius:3px;">Delete</button>';
      designsList.appendChild(item);
    });

    document.body.appendChild(modal);

    modal.querySelector('.btn-secondary').addEventListener('click', function() {
      modal.remove();
    });

    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        modal.remove();
      }
      if (e.target.classList.contains('load-design-btn')) {
        var id = e.target.getAttribute('data-id');
        var designs = getAllSavedDesigns();
        var design = designs.find(function(d) { return d.id === id; });
        if (design && design.state) {
          loadSandboxDesignState(design.state, 'Design "' + design.name + '" loaded!');
          modal.remove();
        }
      }
      if (e.target.classList.contains('delete-design-btn')) {
        var id = e.target.getAttribute('data-id');
        if (confirm('Delete this design?')) {
          if (deleteSandboxDesign(id)) {
            showNotification('Design deleted.');
            modal.remove();
            showLoadDesignModal();
          }
        }
      }
    });
  }

  function loadSavedDesign() {
    if (!isSandbox) return false;
    var designs = getAllSavedDesigns();
    if (designs.length === 0) {
      showNotification('No saved design found.');
      return false;
    }
    var lastDesign = designs[designs.length - 1];
    if (loadSandboxDesignState(lastDesign.state, 'Latest design loaded!')) {
      return true;
    }
    showNotification('Failed to load saved design.');
    return false;
  }

  function showNotification(message, duration) {
    if (notificationTimeout) {
      clearTimeout(notificationTimeout);
      notificationTimeout = null;
    }
    var statusText = document.getElementById('statusText');
    if (!statusText) return;
    var original = statusText.textContent;
    statusText.textContent = message;
    notificationTimeout = setTimeout(function() {
      statusText.textContent = original;
      notificationTimeout = null;
    }, duration || 2500);
  }

  function getSandboxDesignState() {
    return {
      timestamp: Date.now(),
      components: Components.getAll().map(function(comp) {
        return {
          uid: comp.uid,
          type: comp.type,
          col: comp.col,
          row: comp.row,
          switchClosed: comp.type === 'switch' ? !!comp.switchClosed : undefined
        };
      }),
      wires: Wiring.getAll().map(function(wire) {
        return {
          id: wire.id,
          fromUid: wire.fromUid,
          fromPortId: wire.fromPortId,
          toUid: wire.toUid,
          toPortId: wire.toPortId
        };
      })
    };
  }

  function loadSandboxDesignState(state, message) {
    if (!state || !Array.isArray(state.components)) return false;
    Components.clearAll();
    Wiring.clearAll();
    ParticleSystem.stop();
    Feedback.hideSparky();

    state.components.forEach(function(item) {
      var comp = Components.create(item.type, item.col, item.row, {
        uid: item.uid,
        switchClosed: item.switchClosed
      });
      if (comp) {
        Components.renderToDOM(comp);
        DragDrop.setupComponentDrag(comp);
        if (comp.type === 'switch') {
          Components.setSwitchState(comp.uid, !!item.switchClosed);
        }
      }
    });

    if (Array.isArray(state.wires)) {
      state.wires.forEach(function(wire) {
        if (wire.fromUid && wire.toUid && wire.fromPortId && wire.toPortId) {
          Wiring.createWire(wire.fromUid, wire.fromPortId, wire.toUid, wire.toPortId, wire.id);
        }
      });
    }

    Wiring.drawAll();
    DragDrop.updateStatus();
    restoredDesign = true;
    if (message) showNotification(message);
    return true;
  }

  function getDesignFromLocalStorage() {
    try {
      var raw = window.localStorage.getItem(SAVED_DESIGNS_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed[parsed.length - 1].state || null;
      }
      return null;
    } catch (err) {
      return null;
    }
  }

  function getDesignFromShareUrl() {
    var params = new URLSearchParams(window.location.search);
    var encoded = params.get(SHARE_DESIGN_PARAM);
    if (!encoded) return null;
    try {
      var decoded = decodeURIComponent(atob(encoded));
      return JSON.parse(decoded);
    } catch (err) {
      return null;
    }
  }

  function restoreSandboxDesign() {
    if (!isSandbox) return;
    var sharedDesign = getDesignFromShareUrl();
    if (sharedDesign && loadSandboxDesignState(sharedDesign, 'Shared design loaded!')) {
      return;
    }
    var designs = getAllSavedDesigns();
    if (designs.length > 0) {
      var lastDesign = designs[designs.length - 1];
      if (lastDesign.state) {
        loadSandboxDesignState(lastDesign.state, 'Design "' + lastDesign.name + '" restored.');
      }
    }
  }

  function saveDesign() {
    if (!isSandbox) return;
    var name = prompt('Give this design a name:');
    if (name === null) return;
    if (saveSandboxDesignWithName(name)) {
      showNotification('Design "' + name + '" saved!');
    } else {
      showNotification('Save failed.');
    }
  }

  function shareDesign() {
    if (!isSandbox) return;
    var design = getSandboxDesignState();
    var payload = JSON.stringify(design);
    var encoded = btoa(encodeURIComponent(payload));
    var shareUrl = window.location.origin + window.location.pathname + '?level=sandbox&' + SHARE_DESIGN_PARAM + '=' + encodeURIComponent(encoded);
    
    var modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = '9999';
    modal.innerHTML = '<div class="modal-card" style="width:500px;max-width:90vw;">' +
      '<div class="modal-header" style="padding:20px;border-bottom:1px solid #ccc;">' +
      '<h2 style="margin:0;font-size:18px;">Share Your Design</h2>' +
      '</div>' +
      '<div class="modal-body" style="padding:20px;">' +
      '<p style="margin:0 0 12px 0;font-size:14px;color:#666;">Copy this link to share your design with others:</p>' +
      '<textarea readonly style="width:100%;height:80px;padding:10px;font-family:monospace;font-size:12px;border:1px solid #ddd;border-radius:4px;box-sizing:border-box;" id="shareUrlInput"></textarea>' +
      '</div>' +
      '<div class="modal-footer" style="padding:15px;border-top:1px solid #ccc;text-align:right;display:flex;gap:10px;justify-content:flex-end;">' +
      '<button class="btn btn-secondary" style="cursor:pointer;padding:8px 16px;">Close</button>' +
      '<button class="btn btn-cta" id="copyBtn" style="cursor:pointer;padding:8px 16px;">Copy Link</button>' +
      '</div>' +
      '</div>';
    
    var textarea = modal.querySelector('#shareUrlInput');
    textarea.value = shareUrl;
    
    var copyBtn = modal.querySelector('#copyBtn');
    var closeBtn = modal.querySelector('.btn-secondary');
    
    copyBtn.addEventListener('click', function() {
      textarea.select();
      try {
        if (document.execCommand('copy')) {
          showNotification('Link copied to clipboard!');
          copyBtn.textContent = 'Copied!';
          setTimeout(function() {
            copyBtn.textContent = 'Copy Link';
          }, 1500);
        } else {
          showNotification('Copy failed, please copy manually.');
        }
      } catch (err) {
        showNotification('Copy failed, please copy manually.');
      }
    });
    
    closeBtn.addEventListener('click', function() {
      modal.remove();
    });
    
    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        modal.remove();
      }
    });
    
    document.body.appendChild(modal);
  }

  function startTimer() {
    var stored = ProgressStore.getLevelStart(levelId);
    if (stored) {
      startTime = stored;
    } else {
      ProgressStore.startLevelAttempt(levelId, startTime);
    }

    var display = document.getElementById('timerDisplay');
    timerInterval = setInterval(function() {
      var elapsed = Math.floor((Date.now() - startTime) / 1000);
      var min = String(Math.floor(elapsed / 60)).padStart(2, '0');
      var sec = String(elapsed % 60).padStart(2, '0');
      display.textContent = min + ':' + sec;
    }, 1000);
  }

  function getElapsed() {
    return Math.floor((Date.now() - startTime) / 1000);
  }

  function onPowerOn() {
    if (levelComplete) return;
    powered = !powered;

    // Notify tutorial system (advances step 5 if active)
    if (!isSandbox) Tutorial.onPowerClick();

    if (powered) {
      var result = CircuitEngine.evaluate(config);

      if (result.status === 'closed') {
        if (isSandbox) {
          onSandboxPowered(result);
          return;
        }
        levelComplete = true;
        clearInterval(timerInterval);
        Feedback.hideSparky();
        var elapsed = getElapsed();
        Feedback.showSuccess(result, elapsed);
      } else if (result.status === 'open') {
        Feedback.showError(result);
        setTimeout(function() {
          powered = false;
          document.getElementById('powerBtn').classList.remove('powered');
        }, 1500);
      } else if (result.status === 'short') {
        Feedback.showError(result);
        setTimeout(function() {
          powered = false;
          document.getElementById('powerBtn').classList.remove('powered');
        }, 1500);
      } else {
        Feedback.showSparky(result.message, 'OK');
        powered = false;
      }

      if (powered || levelComplete) {
        document.getElementById('powerBtn').classList.add('powered');
      }
    } else {
      document.getElementById('powerBtn').classList.remove('powered');
      ParticleSystem.stop();
      Components.getByType('bulb').forEach(function(b) { Components.setBulbLit(b.uid, false); });
    }
  }

  function onSandboxPowered(result) {
    ParticleSystem.startFlow(result);
    var litBulbs = result.bulbs || [result.bulb];
    litBulbs.forEach(function(bulb) {
      if (bulb) Components.setBulbLit(bulb.uid, true);
    });
    document.getElementById('powerBtn').classList.add('powered');
    var statusDot = document.getElementById('statusDot');
    var statusText = document.getElementById('statusText');
    if (statusDot) statusDot.classList.add('connected');
    if (statusText) statusText.textContent = 'Sandbox circuit powered. Change the wiring or press Power On again to stop.';
  }

  function onKeyDown(e) {
    if (e.code === 'Space') {
      e.preventDefault();
      onPowerOn();
    } else if (e.ctrlKey && e.code === 'KeyZ') {
      e.preventDefault();
      UndoRedo.undo();
    } else if (e.ctrlKey && e.code === 'KeyY') {
      e.preventDefault();
      UndoRedo.redo();
    } else if (e.code === 'Delete' || e.code === 'Backspace') {
      onDelete();
    } else if (e.code === 'Escape') {
      Wiring.cancelDraw();
    }
  }

  function onDelete() {
    // If a wire is selected, delete it
    var allWires = Wiring.getAll();
    var selectedId = Wiring.getSelectedWireId ? Wiring.getSelectedWireId() : null;
    if (selectedId) {
      Wiring.removeWire(selectedId);
      return;
    }
    // Otherwise delete last wire
    if (allWires.length > 0) {
      Wiring.removeWire(allWires[allWires.length - 1].id);
    }
  }

  function onClear() {
    if (!confirm('Clear all components and wires?')) return;
    Components.clearAll();
    Wiring.clearAll();
    ParticleSystem.stop();
    UndoRedo.clear();
    Feedback.hideSparky();
    powered = false;
    document.getElementById('powerBtn').classList.remove('powered');

    // Re-place components from config
    if (config && config.workbench.prePlace) {
      var cols = Grid.getCols();
      var rows = Grid.getRows();
      config.workbench.prePlace.forEach(function(item) {
        var comp = Components.create(item.type, Math.floor(cols * item.colRatio), Math.floor(rows * item.rowRatio));
        if (comp) {
          Components.renderToDOM(comp);
          DragDrop.setupComponentDrag(comp);
        }
      });
    }

    DragDrop.updateStatus();
  }

  function onHint() {
    if (isSandbox) return;
    ProgressStore.markHintUsed(levelId);
    var hintText;
    if (levelId === '2-1') {
      var switches = Components.getByType('switch');
      if (switches.length === 0) {
        hintText = 'Drag the Switch from the parts panel onto the board, then wire it into the circuit in series!';
      } else {
        var sw = switches[0];
        if (!sw.switchClosed) {
          hintText = 'The switch is open! Click it on the board to close it, then power on.';
        } else {
          hintText = 'Make sure wires connect: Battery(+) → Switch → Bulb → Battery(-). Every port needs a wire!';
        }
      }
    } else {
      hintText = 'Make sure current flows from the battery (+), through the bulb, and back to (-). Each port needs a wire connected!';
    }
    Feedback.showSparky(hintText, 'Got it!');
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
