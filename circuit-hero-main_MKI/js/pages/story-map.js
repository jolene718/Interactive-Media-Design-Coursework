// Story Map page JavaScript
(function() {
  'use strict';

  // Show user greeting
  const username = localStorage.getItem('ch_username');
  const greeting = document.getElementById('userGreeting');
  if (greeting && username) {
    greeting.textContent = 'Hi, ' + username + '!';
  }

  // Chapter node click handlers
  document.querySelectorAll('.chapter-node').forEach(node => {
    node.addEventListener('click', () => {
      const chapter = node.dataset.chapter;

      if (node.classList.contains('locked')) {
        showTip('Complete the previous chapter to unlock this one!');
        return;
      }

      if (node.classList.contains('completed') || node.classList.contains('current') || node.classList.contains('unlocked')) {
        window.location.href = 'mission-briefing.html?chapter=' + chapter + '&level=' + chapter + '-1';
      }
    });
  });

  function showTip(text) {
    const tip = document.querySelector('.map-tip-content');
    tip.textContent = text;
    tip.parentElement.style.opacity = '1';
    setTimeout(() => {
      tip.textContent = 'Click a chapter to start your adventure! Completed chapters glow gold.';
    }, 3000);
  }

  // Animate path gold fill
  setTimeout(() => {
    const goldPath = document.getElementById('mapPathGold');
    if (goldPath) {
      goldPath.style.transition = 'stroke-dashoffset 1.5s ease';
      goldPath.style.strokeDashoffset = '0';
    }
  }, 500);
})();
