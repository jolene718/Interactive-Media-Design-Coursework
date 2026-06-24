// Success feedback and error handling
const Feedback = (function() {
  var sparkyBubble, sparkyText, sparkyContinue;

  function init() {
    sparkyBubble = document.getElementById('sparkyBubble');
    sparkyText = document.getElementById('sparkyText');
    sparkyContinue = document.getElementById('sparkyContinue');
  }

  function showSparky(text, buttonText, callback) {
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
        setTimeout(type, 30);
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
    Components.setBulbLit(result.bulb.uid, true);

    // Calculate stars
    var stars = 1;
    var usedHint = localStorage.getItem('ch_used_hint') === 'true';
    if (!usedHint) stars = 2;
    if (!usedHint && elapsed <= 120) stars = 3;

    // Get level config for dynamic content
    var urlParams = new URLSearchParams(window.location.search);
    var levelId = urlParams.get('level') || '1-1';
    var config = LevelConfig.get(levelId);

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

    if (result.status === 'open') {
      // Check if an open switch caused the open circuit
      var openSwitches = Components.getByType('switch').filter(function(s) { return !s.switchClosed; });
      if (openSwitches.length > 0) {
        statusText.textContent = 'Open circuit! The switch is open.';
        showSparky(
          'The switch is open — current can\'t pass through! Click the switch to close it, then try again.',
          'Got it!'
        );
      } else {
        statusText.textContent = 'Open circuit! Current stopped midway.';
        showSparky(
          'Current ran halfway and stopped! Like walking to a broken bridge — can\'t cross! Connect all ports to complete the loop.',
          'Let me try again!'
        );
      }
    } else if (result.status === 'short') {
      statusText.textContent = 'Short circuit! Too much current!';
      document.querySelector('.stage').classList.add('shake');
      setTimeout(function() { document.querySelector('.stage').classList.remove('shake'); }, 300);
      showSparky(
        'Danger! Current rushes straight from (+) to (-) without going through the bulb — that\'s a short circuit! It\'s like a road with no traffic light!',
        'I\'ll fix it!'
      );
    }

    hideSparkyAfterDelay();
  }

  function hideSparkyAfterDelay() {
    // Sparky stays until user clicks
  }

  return { init, showSparky, hideSparky, showSuccess, showError };
})();
