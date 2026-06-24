// Home page JavaScript
(function() {
  'use strict';

  // Animate particles with varying speeds
  document.querySelectorAll('.particle').forEach(p => {
    const duration = 2 + Math.random() * 2;
    p.style.animationDuration = duration + 's';
  });

  // Feature cards entrance animation
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.feature-card').forEach((card, i) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    card.style.transition = `opacity 0.5s ease ${i * 0.1}s, transform 0.5s ease ${i * 0.1}s`;
    observer.observe(card);
  });

  // Check if user is logged in and update nav
  const username = localStorage.getItem('ch_username');
  if (username) {
    const actions = document.querySelector('.header-actions');
    if (actions) {
      actions.innerHTML = `
        <span style="font-size:14px;color:var(--color-text-secondary)">Hi, ${username}</span>
        <a href="story-map.html" class="btn btn-primary btn-sm">Play</a>
      `;
    }
  }
})();
