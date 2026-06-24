// Profile page controller
(function() {
  'use strict';

  function starText(stars) {
    return stars.map(function(filled) {
      return filled ? '★' : '☆';
    }).join('');
  }

  function renderProgress(rows) {
    var list = document.getElementById('progressList');
    list.innerHTML = '';

    rows.forEach(function(row) {
      var el = document.createElement('div');
      el.className = 'progress-row';
      el.innerHTML =
        '<div class="progress-title">Ch.' + row.chapter + ' ' + row.title + '</div>' +
        '<div class="progress-stars">' + starText(row.stars) + '</div>' +
        '<div class="progress-status">' + row.status + '</div>';
      list.appendChild(el);
    });
  }

  function renderBadges(badges) {
    var grid = document.getElementById('badgeGrid');
    grid.innerHTML = '';

    badges.forEach(function(badge) {
      var el = document.createElement('div');
      el.className = 'badge-item' + (badge.unlocked ? '' : ' locked');
      el.innerHTML =
        '<div class="badge-icon"><img src="' + badge.icon + '" alt="" width="32" height="32"></div>' +
        '<div class="badge-name ' + (badge.unlocked ? '' : 'badge-locked') + '">' +
          (badge.unlocked ? badge.name : 'Locked') +
        '</div>';
      grid.appendChild(el);
    });
  }

  function renderComponents(components) {
    var container = document.getElementById('componentEncyclopedia');
    container.innerHTML = '';

    components.forEach(function(component) {
      var el = document.createElement('div');
      el.className = 'encyclopedia-card';
      el.innerHTML =
        '<div class="badge-icon"><img src="' + component.icon + '" alt="" width="30" height="30"></div>' +
        '<div><h3>' + component.name + '</h3><p>' + component.description + '</p></div>';
      container.appendChild(el);
    });
  }

  function render(model) {
    document.getElementById('profileName').textContent = model.username;
    document.getElementById('profileTitle').textContent = model.title;
    document.getElementById('chapterCount').textContent = model.completedCount + ' / ' + model.totalChapters;
    renderProgress(model.progressRows);
    renderBadges(model.badges);
    renderComponents(model.components);
  }

  function setupModal() {
    var modal = document.getElementById('encyclopediaModal');
    document.getElementById('encyclopediaBtn').addEventListener('click', function() {
      modal.classList.remove('hidden');
    });
    document.getElementById('encyclopediaClose').addEventListener('click', function() {
      modal.classList.add('hidden');
    });
    modal.addEventListener('click', function(e) {
      if (e.target === modal) modal.classList.add('hidden');
    });
  }

  function setupTabs() {
    document.querySelectorAll('.tab-item[data-target]').forEach(function(tab) {
      tab.addEventListener('click', function() {
        window.location.href = tab.dataset.target;
      });
    });
  }

  function init() {
    setupModal();
    setupTabs();
    ProgressStore.loadRemoteProgress().then(function(progress) {
      var model = ProfileModel.create({
        username: localStorage.getItem('ch_username') || 'Guest',
        progress: progress
      });
      render(model);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
