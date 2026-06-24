// Story Map page JavaScript
(function() {
  'use strict';

  // Show user greeting
  const username = localStorage.getItem('ch_username');
  const greeting = document.getElementById('userGreeting');
  if (greeting && username) {
    greeting.textContent = 'Hi, ' + username + '!';
  }

  function renderStars(container, count) {
    if (!container) return;
    container.innerHTML = '';
    for (var i = 0; i < 3; i++) {
      var star = document.createElement('span');
      star.className = i < count ? 'star-filled' : 'star-empty';
      star.textContent = '★';
      container.appendChild(star);
    }
  }

  function applyProgress(progress) {
    var levels = progress && progress.levels ? progress.levels : {};
    document.querySelectorAll('.chapter-node').forEach(function(node) {
      var chapter = node.dataset.chapter;
      var chapterNum = Number(chapter);
      var levelId = chapter + '-1'; // 每个章节的首个关卡ID（如1-1、2-1）
      var levelProgress = levels[levelId];
      var stars = levelProgress && levelProgress.completed ? levelProgress.stars : 0;
      var available = LevelConfig.has(levelId);

      // 重置所有状态类
      node.classList.remove('completed', 'current', 'unlocked', 'locked');

      // 核心解锁规则
      if (!available) {
        // 关卡配置不存在 → 锁定
        node.classList.add('locked');
      } else if (levelProgress && levelProgress.completed) {
        // 当前章节已通关 → 标记为completed
        node.classList.add('completed');
      } else {
        // 判断是否解锁：章节1默认解锁；章节N>1 需前一章（N-1）的首个关卡已通关
        var isUnlocked = false;
        if (chapterNum === 1) {
          // 章节1默认解锁（初始为current）
          isUnlocked = true;
        } else {
          // 章节N>1：检查前一章（N-1）的首个关卡是否已通关
          var prevChapterLevelId = (chapterNum - 1) + '-1';
          var prevChapterProgress = levels[prevChapterLevelId];
          isUnlocked = prevChapterProgress && prevChapterProgress.completed;
        }

        if (isUnlocked) {
          // 解锁但未通关：章节1标记为current，其他章节标记为unlocked
          node.classList.add(chapterNum === 1 ? 'current' : 'unlocked');
        } else {
          // 未解锁 → 锁定
          node.classList.add('locked');
        }
      }

      // 渲染星星（锁定状态强制显示0颗亮星，即3颗暗星）
      var finalStars = node.classList.contains('locked') ? 0 : stars;
      renderStars(node.querySelector('.node-stars'), finalStars);
    });
  }

  ProgressStore.loadRemoteProgress().then(applyProgress);

  document.querySelectorAll('.tab-item[data-target]').forEach(function(tab) {
    tab.addEventListener('click', function() {
      window.location.href = tab.dataset.target;
    });
  });

  // Chapter node click handlers
  document.querySelectorAll('.chapter-node').forEach(node => {
    node.addEventListener('click', () => {
      const chapter = node.dataset.chapter;

      if (node.classList.contains('locked')) {
        showTip('Complete the previous chapter to unlock this one!');
        return;
      }

      if (node.classList.contains('completed') || node.classList.contains('current') || node.classList.contains('unlocked')) {
        var levelId = chapter + '-1';
        if (!LevelConfig.has(levelId)) {
          showTip('This chapter is coming soon.');
          return;
        }
        window.location.href = 'mission-briefing.html?chapter=' + chapter + '&level=' + levelId;
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
