// Success feedback and error handling
const Feedback = (function() {
  var sparkyBubble, sparkyText, sparkyContinue;
  var typewriterTimer = null;

  function init() {
    sparkyBubble = document.getElementById('sparkyBubble');
    sparkyText = document.getElementById('sparkyText');
    sparkyContinue = document.getElementById('sparkyContinue');
  }

  function showSparky(text, buttonText, callback) {
    if (typewriterTimer) {
      clearTimeout(typewriterTimer);
      typewriterTimer = null;
    }
    sparkyText.textContent = '';
    sparkyBubble.classList.remove('hidden');
    sparkyContinue.textContent = buttonText || 'I got it!';
    sparkyContinue.onclick = function() {
      if (callback) callback();
    };

    // Typewriter effect
    var i = 0;
    function type() {
      if (i < text.length) {
        sparkyText.textContent += text[i];
        i++;
        typewriterTimer = setTimeout(type, 30);
      } else {
        typewriterTimer = null;
      }
    }
    type();
  }

  function hideSparky() {
    sparkyBubble.classList.add('hidden');
  }

  function showSuccess(result, elapsed) {
    hideSparky();
    ParticleSystem.startFlow(result);

    // Light up the bulb
    var litBulbs = result.bulbs || [result.bulb];
    litBulbs.forEach(function(bulb) {
      if (bulb) Components.setBulbLit(bulb.uid, true);
    });

    // Calculate stars
    // Get level config for dynamic content
    var urlParams = new URLSearchParams(window.location.search);
    var levelId = urlParams.get('level') || '1-1';
    var config = LevelConfig.get(levelId);
    var targetTime = config ? config.briefing.threeStarTime : 120;
    var usedHint = ProgressStore.hasUsedHint(levelId);
    var stars = ProgressStore.calculateStars({
      elapsed: elapsed,
      usedHint: usedHint,
      targetTime: targetTime
    });

    ProgressStore.completeLevel(levelId, {
      stars: stars,
      elapsed: elapsed,
      usedHint: usedHint
    });
    if (levelId === '1-1' && window.OnboardingGuide && OnboardingGuide.markComplete) {
      OnboardingGuide.markComplete();
    }
    ProgressStore.syncLevelToRemote(levelId, {
      stars: stars,
      elapsed: elapsed,
      usedHint: usedHint
    });

    // Show success modal after a delay
    setTimeout(function() {
      var modal = document.getElementById('successModal');
      modal.classList.remove('hidden');

      // Render stars
      var starsContainer = document.getElementById('resultStars');
      starsContainer.innerHTML = '';
      for (var i = 0; i < 3; i++) {
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'star ' + (i < stars ? 'star-filled' : 'star-empty'));
        svg.setAttribute('viewBox', '0 0 18 18');
        svg.style.width = '32px';
        svg.style.height = '32px';
        svg.innerHTML = '<path d="M9 1l2.2 4.5 4.8.7-3.5 3.4.8 4.9L9 12.2 4.7 14.5l.8-4.9L2 6.2l4.8-.7z" fill="currentColor"/>';
        if (i < stars) {
          svg.style.animationDelay = (i * 0.2) + 's';
        }
        starsContainer.appendChild(svg);
      }

      // Dialogue from config
      var dialogue = document.getElementById('successDialogue');
      dialogue.textContent = config ? config.success.dialogue : 'Great job! Circuit complete!';

      // Knowledge card from config
      var knowledgeTitle = document.getElementById('knowledgeTitle');
      if (knowledgeTitle && config) {
        knowledgeTitle.innerHTML = '<img src="assets/icons/logo-lightning.svg" alt="" width="16" height="16"> ' + config.success.knowledgeTitle;
      }

      var knowledgeList = document.getElementById('knowledgeList');
      if (knowledgeList && config) {
        knowledgeList.innerHTML = config.success.knowledgeItems.map(function(item) {
          return '<li>' + item + '</li>';
        }).join('');
      }

      var knowledgeMotto = document.getElementById('knowledgeMotto');
      if (knowledgeMotto && config) {
        knowledgeMotto.textContent = config.success.knowledgeMotto;
      }
    }, 2000);
  }

  function showError(result) {
    var statusText = document.getElementById('statusText');
    var statusDot = document.getElementById('statusDot');
    statusDot.classList.remove('connected');
    statusDot.style.background = 'var(--color-danger)';
    var detail = getErrorDetail(result);

    if (result.status === 'open') {
      statusText.textContent = detail.statusText;
      showSparky(detail.message, detail.buttonText);
    } else if (result.status === 'short') {
      statusText.textContent = detail.statusText;
      document.querySelector('.stage').classList.add('shake');
      setTimeout(function() { document.querySelector('.stage').classList.remove('shake'); }, 300);
      showSparky(detail.message, detail.buttonText);
    }

    hideSparkyAfterDelay();
  }

  function getErrorDetail(result) {
    var details = {
      'missing-switch': {
        statusText: 'Switch required! Add the switch to the circuit path.',
        message: 'This mission is about controlling a circuit with a switch. Put the switch in the loop, close it, then power on again.',
        buttonText: 'Got it!'
      },
      'switch-open': {
        statusText: 'Open circuit! The switch is open.',
        message: 'The switch is open — current can\'t pass through! Click the switch to close it, then try again.',
        buttonText: 'Got it!'
      },
      'parallel-connections': {
        statusText: 'Circuit error! Check the parallel branches.',
        message: 'This level needs a parallel circuit. Each bulb should have its own branch between the battery (+) and (-) terminals.',
        buttonText: 'Let me try again!'
      },
      'house-master-switch': {
        statusText: 'Circuit error! Add a master switch.',
        message: 'The house circuit needs one master switch that can turn off every light. Put it before the room branches.',
        buttonText: 'Let me try again!'
      },
      'house-switch-logic': {
        statusText: 'Circuit error! Check the switch logic.',
        message: 'The master switch should control everything, and each living-room switch should control only one living-room branch.',
        buttonText: 'Let me try again!'
      },
      'house-hallway-wiring': {
        statusText: 'Circuit error! Check the hallway bulb.',
        message: 'The hallway bulb should be shared by the active living-room circuit, not controlled like a separate room branch.',
        buttonText: 'Let me try again!'
      },
      'house-room-switch-wiring': {
        statusText: 'Circuit error! Check the room switches.',
        message: 'Each living-room switch should control a different living-room bulb branch.',
        buttonText: 'Let me try again!'
      },
      'theater-master-switch': {
        statusText: 'Circuit error! Add a theater master switch.',
        message: 'The theater needs one master switch before all stage and audience lights so everything can turn off together.',
        buttonText: 'Let me try again!'
      },
      'theater-switch-logic': {
        statusText: 'Circuit error! Check the theater switch logic.',
        message: 'The master switch should control every light, while the two audience switches should control the audience branches only.',
        buttonText: 'Let me try again!'
      },
      'theater-stage-wiring': {
        statusText: 'Circuit error! Check the stage lights.',
        message: 'The three stage lights should stay on as one group when the master switch is closed.',
        buttonText: 'Let me try again!'
      },
      'theater-audience-wiring': {
        statusText: 'Circuit error! Check the audience branches.',
        message: 'Each audience switch should control a different audience light branch.',
        buttonText: 'Let me try again!'
      },
      'theater-stage-series': {
        statusText: 'Circuit error! Stage lights must be series.',
        message: 'Wire the three stage spotlights in one series path so current passes through them one after another.',
        buttonText: 'Let me try again!'
      },
      'short-circuit': {
        statusText: 'Short circuit! Too much current!',
        message: 'Danger! Current rushes straight from (+) to (-) without going through the bulb — that\'s a short circuit! It\'s like a road with no traffic light!',
        buttonText: 'I\'ll fix it!'
      }
    };

    if (result && details[result.reason]) return details[result.reason];

    if (result && result.status === 'short') return details['short-circuit'];

    var openSwitches = Components.getByType('switch').filter(function(s) { return !s.switchClosed; });
    if (openSwitches.length > 0) return details['switch-open'];

    return {
      statusText: result && result.message ? result.message : 'Open circuit! Current stopped midway.',
      message: result && result.message && result.message.indexOf('Circuit error') === 0
        ? result.message + ' Check that every required part is in the correct path.'
        : 'Current ran halfway and stopped! Connect all ports to complete the loop.',
      buttonText: 'Let me try again!'
    };
  }

  function hideSparkyAfterDelay() {
    // Sparky stays until user clicks
  }

  return { init, showSparky, hideSparky, showSuccess, showError };
})();
