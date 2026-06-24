// Mission Briefing page JavaScript
(function() {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var levelId = params.get('level') || '1-1';
  var config = LevelConfig.get(levelId);

  if (!config) {
    window.location.href = 'story-map.html';
    return;
  }

  // Set page title
  document.title = config.id + ' ' + config.title + ' — Circuit Hero';

  // Set header level info
  var levelIdEl = document.getElementById('levelId');
  if (levelIdEl) levelIdEl.textContent = 'LEVEL ' + config.id.toUpperCase();
  var levelTitleEl = document.getElementById('levelTitle');
  if (levelTitleEl) levelTitleEl.textContent = config.title;

  // Set cutscene badge
  var badgeEl = document.getElementById('cutsceneBadge');
  if (badgeEl) badgeEl.textContent = config.briefing.cutsceneBadge;

  // Set dialogue speaker
  var speakerEl = document.getElementById('dialogueSpeaker');
  if (speakerEl) speakerEl.textContent = config.briefing.dialogueSpeaker;

  // Set goal text
  var goalEl = document.getElementById('goalText');
  if (goalEl) goalEl.innerHTML = '<strong>' + config.briefing.goalText + '</strong>';

  // Set available parts pills
  var pillsEl = document.getElementById('componentPills');
  if (pillsEl) {
    pillsEl.innerHTML = config.briefing.availableParts.map(function(p) {
      return '<span class="comp-pill">' + p + '</span>';
    }).join('');
  }

  // Set tip text
  var tipEl = document.getElementById('tipText');
  if (tipEl) tipEl.textContent = config.briefing.tipText;

  // Typewriter effect for dialogue
  var dialogueEl = document.getElementById('dialogueText');
  var fullText = config.briefing.dialogueText;
  var charIndex = 0;

  function typeWriter() {
    if (charIndex < fullText.length) {
      dialogueEl.textContent = fullText.substring(0, charIndex + 1);
      dialogueEl.classList.add('typing-cursor');
      charIndex++;
      setTimeout(typeWriter, 40);
    } else {
      dialogueEl.classList.remove('typing-cursor');
    }
  }

  setTimeout(typeWriter, 800);

  // Skip dialogue with spacebar
  document.addEventListener('keydown', function(e) {
    if (e.code === 'Space') {
      e.preventDefault();
      if (charIndex < fullText.length) {
        charIndex = fullText.length;
        dialogueEl.textContent = fullText;
        dialogueEl.classList.remove('typing-cursor');
      }
    }
  });

  // Start button
  var startBtn = document.getElementById('startBtn');
  startBtn.href = 'workbench.html?level=' + levelId;
  startBtn.addEventListener('click', function(e) {
    e.preventDefault();
    localStorage.setItem('ch_level_start', Date.now().toString());
    window.location.href = 'workbench.html?level=' + levelId;
  });
})();
