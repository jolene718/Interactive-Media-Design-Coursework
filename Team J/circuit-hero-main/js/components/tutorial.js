// Sparky tutorial engine
const Tutorial = (function() {
  var currentStep = -1;
  var active = false;
  var steps = [];
  var waitingForEvent = false;

  function init(levelId) {
    if (levelId === '1-1') {
      initFullTutorial();
    } else if (levelId === '2-1') {
      initHintsMode();
    }
  }

  function initFullTutorial() {
    active = true;

    steps = [
      {
        text: 'Hi! I\'m Sparky, your helper! To fix the night light, we need current to flow from the battery, through the bulb, and back — that\'s a closed circuit!',
        trigger: 'click',
        highlight: null
      },
      {
        text: 'First, drag the Bulb from the parts panel onto the workbench!',
        trigger: 'component-placed',
        filter: function(d) { return d.type === 'bulb'; },
        highlight: 'bulbPanelItem'
      },
      {
        text: 'Great! Now click the battery\'s red (+) port, then click one of the bulb\'s ports to connect them with a wire.',
        trigger: 'wire-connected',
        highlight: null,
        afterHighlight: 'pos'
      },
      {
        text: 'Nice! Now connect the bulb\'s other port back to the battery\'s black (-) port to complete the loop.',
        trigger: 'wire-connected',
        highlight: null,
        afterHighlight: 'neg'
      },
      {
        text: 'The circuit looks complete! Click the Power On button to test it!',
        trigger: 'click-power',
        highlight: 'powerBtn'
      }
    ];

    // Listen to circuit events
    document.addEventListener('circuit:component-placed', onEvent);
    document.addEventListener('circuit:wire-connected', onEvent);

    // Start first step after a delay to let everything render
    setTimeout(function() { advance(); }, 800);
  }

  function initHintsMode() {
    active = true;
    setTimeout(function() {
      Feedback.showSparky(
        'New part: the Switch! Drag it onto the board. Click a placed switch to toggle it open or closed. Wire it into the circuit, close it, and power on!',
        'Got it!'
      );
    }, 800);
  }

  function advance() {
    if (!active) return;
    currentStep++;

    if (currentStep >= steps.length) {
      Feedback.hideSparky();
      return;
    }

    var step = steps[currentStep];
    waitingForEvent = (step.trigger !== 'click' && step.trigger !== 'click-power');

    // Apply highlights
    clearHighlights();
    if (step.highlight) {
      var el = document.getElementById(step.highlight);
      if (el) el.classList.add('highlight');
    }

    // Highlight ports for wire steps
    if (step.afterHighlight === 'pos') {
      highlightBatteryPort('pos');
    } else if (step.afterHighlight === 'neg') {
      highlightBatteryPort('neg');
    }
    if (step.highlight === 'powerBtn') {
      var btn = document.getElementById('powerBtn');
      if (btn) btn.classList.add('highlight');
    }

    // Show the right button text
    var btnText = step.trigger === 'click' ? 'I got it!' : 'OK';
    var callback = function() {
      if (step.trigger === 'click') {
        advance();
      }
    };

    Feedback.showSparky(step.text, btnText, callback);
  }

  function onEvent(e) {
    if (!active || currentStep < 0 || currentStep >= steps.length) return;
    var step = steps[currentStep];
    if (e.type === 'circuit:' + step.trigger) {
      if (step.filter && !step.filter(e.detail)) return;
      clearHighlights();
      advance();
    }
  }

  function highlightBatteryPort(portId) {
    var batteries = Components.getByType('battery');
    if (batteries.length === 0) return;
    var battery = batteries[0];
    if (!battery.element) return;
    var ports = battery.element.querySelectorAll('.port');
    ports.forEach(function(p) {
      if (p.dataset.portId === portId) {
        p.classList.add('highlight');
      }
    });
  }

  function clearHighlights() {
    document.querySelectorAll('.highlight').forEach(function(el) { el.classList.remove('highlight'); });
  }

  function onPowerClick() {
    if (!active || currentStep < 0 || currentStep >= steps.length) return;
    var step = steps[currentStep];
    if (step.trigger === 'click-power') {
      clearHighlights();
      advance();
    }
  }

  function isActive() { return active; }

  return { init, advance, isActive, onPowerClick };
})();
