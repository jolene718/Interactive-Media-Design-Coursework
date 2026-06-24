// Cross-page onboarding guide for the first demo flow
const OnboardingGuide = (function() {
  'use strict';

  var ACTIVE_KEY = 'ch_onboarding_active';
  var COMPLETE_KEY = 'ch_onboarding_complete';
  var STEP_KEY = 'ch_onboarding_step';
  var currentPage = '';
  var currentStepIndex = 0;
  var steps = [];
  var overlay;
  var highlight;
  var card;

  function init(page) {
    currentPage = page;

    if (page === 'home') {
      clearStaleSkipState();
      start([
        {
          target: '#tryDemoLink',
          title: 'Try the first mission',
          text: 'Use Try Demo to open Level 1-1 without creating an account. This is the fastest way to learn the basic circuit flow.',
          button: 'Try Demo',
          action: function() {
            localStorage.setItem(ACTIVE_KEY, 'true');
            localStorage.setItem(STEP_KEY, 'mission');
            var demoLink = document.getElementById('tryDemoLink');
            if (demoLink) demoLink.click();
          }
        }
      ]);
      return;
    }

    if (localStorage.getItem(ACTIVE_KEY) !== 'true') return;

    if (page === 'mission') {
      start(getMissionSteps());
    } else if (page === 'workbench') {
      if (localStorage.getItem(STEP_KEY) === 'sparky') return;
      start(getWorkbenchSteps(), function() {
        localStorage.setItem(STEP_KEY, 'workbench');
      });
    }
  }

  function shouldDelayWorkbenchTutorial(levelId) {
    return levelId === '1-1' && localStorage.getItem(ACTIVE_KEY) === 'true' && localStorage.getItem(STEP_KEY) !== 'sparky';
  }

  function getMissionSteps() {
    return [
      {
        target: '.cutscene',
        title: 'Mission scene',
        text: 'This picture shows the story location and who needs help. For Level 1-1, the night light is not working.'
      },
      {
        target: '.dialogue-box',
        title: 'Story message',
        text: 'Read this dialogue to understand the problem. It gives the reason for the circuit task.'
      },
      {
        target: '.objectives-card .objective-col:nth-child(1)',
        title: 'Goal',
        text: 'The Goal tells you exactly what the circuit must do. Here, you need to build a complete loop that lights the bulb.'
      },
      {
        target: '.objectives-card .objective-col:nth-child(2)',
        title: 'Available parts',
        text: 'This box lists the parts you can use in the workbench, such as the battery, bulb, and unlimited wires.'
      },
      {
        target: '.objectives-card .objective-col:nth-child(3)',
        title: '3-star target',
        text: 'This box explains the challenge for earning three stars: finish quickly and avoid using hints.'
      },
      {
        target: '#startBtn',
        title: 'Start building',
        text: 'Click Start Building to enter the workbench and assemble the circuit.',
        button: 'Start Building',
        action: function() {
          localStorage.setItem(STEP_KEY, 'workbench');
          var startBtn = document.getElementById('startBtn');
          if (startBtn) startBtn.click();
        }
      }
    ];
  }

  function getWorkbenchSteps() {
    return [
      {
        target: '.panel-left',
        title: 'Components panel',
        text: 'The left panel contains the parts for this level. Drag the Bulb from here onto the workbench board.'
      },
      {
        target: '#stageGrid',
        title: 'Workbench board',
        text: 'Drop components on this board. Click the small ports on parts to connect wires between them.'
      },
      {
        target: '#powerBtn',
        title: 'Power On',
        text: 'After the battery, bulb, and wires make a complete loop, click Power On to test the circuit.',
        button: 'Follow Sparky',
        action: function() {
          localStorage.setItem(STEP_KEY, 'sparky');
          finishWorkbenchIntro();
        }
      }
    ];
  }

  function start(nextSteps, beforeFirstRender) {
    steps = nextSteps || [];
    currentStepIndex = 0;
    if (beforeFirstRender) beforeFirstRender();
    if (!steps.length) return;
    ensureElements();
    render();
  }

  function ensureElements() {
    if (overlay) return;

    overlay = document.createElement('div');
    overlay.className = 'onboarding-overlay';

    highlight = document.createElement('div');
    highlight.className = 'onboarding-highlight';

    card = document.createElement('div');
    card.className = 'onboarding-card';

    document.body.appendChild(overlay);
    document.body.appendChild(highlight);
    document.body.appendChild(card);

    window.addEventListener('resize', positionGuide);
    window.addEventListener('scroll', positionGuide, true);
  }

  function render() {
    var step = steps[currentStepIndex];
    if (!step) {
      completePage();
      return;
    }

    overlay.classList.remove('hidden');
    highlight.classList.remove('hidden');
    card.classList.remove('hidden');

    var progress = currentStepIndex + 1 + ' / ' + steps.length;
    card.innerHTML = [
      '<div class="onboarding-progress pixel-label">' + progress + '</div>',
      '<h3 class="onboarding-title">' + step.title + '</h3>',
      '<p class="onboarding-text">' + step.text + '</p>',
      '<div class="onboarding-actions">',
      '<button type="button" class="onboarding-skip">Skip guide</button>',
      '<button type="button" class="onboarding-next">' + (step.button || 'Next') + '</button>',
      '</div>'
    ].join('');

    card.querySelector('.onboarding-skip').addEventListener('click', skip);
    card.querySelector('.onboarding-next').addEventListener('click', function() {
      if (step.action) {
        step.action();
      } else {
        currentStepIndex++;
        render();
      }
    });

    scrollTargetIntoView(step);
    positionGuide();
    setTimeout(positionGuide, 60);
  }

  function positionGuide() {
    if (!card || card.classList.contains('hidden')) return;

    var step = steps[currentStepIndex];
    var target = step && step.target ? document.querySelector(step.target) : null;
    var rect = target ? target.getBoundingClientRect() : getCenterRect();
    var padding = 8;
    var left = Math.max(8, rect.left - padding);
    var top = Math.max(8, rect.top - padding);
    var width = Math.min(window.innerWidth - left - 8, rect.width + padding * 2);
    var height = Math.min(window.innerHeight - top - 8, rect.height + padding * 2);

    highlight.style.left = left + 'px';
    highlight.style.top = top + 'px';
    highlight.style.width = width + 'px';
    highlight.style.height = height + 'px';

    var cardWidth = Math.min(360, window.innerWidth - 32);
    card.style.width = cardWidth + 'px';

    var cardHeight = card.offsetHeight || 180;
    var cardTop = rect.bottom + 16;
    if (cardTop + cardHeight > window.innerHeight - 16) {
      cardTop = rect.top - cardHeight - 16;
    }
    cardTop = Math.max(16, Math.min(cardTop, window.innerHeight - cardHeight - 16));

    var cardLeft = rect.left;
    if (cardLeft + cardWidth > window.innerWidth - 16) {
      cardLeft = window.innerWidth - cardWidth - 16;
    }
    if (cardLeft < 16) cardLeft = 16;

    card.style.left = cardLeft + 'px';
    card.style.top = cardTop + 'px';
  }

  function scrollTargetIntoView(step) {
    var target = step && step.target ? document.querySelector(step.target) : null;
    if (!target) return;
    var rect = target.getBoundingClientRect();
    var outsideViewport = rect.top < 80 || rect.bottom > window.innerHeight - 80;
    if (outsideViewport && target.scrollIntoView) {
      target.scrollIntoView({ block: 'center', inline: 'center', behavior: 'auto' });
    }
  }

  function getCenterRect() {
    return {
      left: window.innerWidth / 2 - 120,
      top: window.innerHeight / 2 - 80,
      width: 240,
      height: 160,
      bottom: window.innerHeight / 2 + 80
    };
  }

  function completePage() {
    hide();
    if (currentPage === 'workbench') {
      finishWorkbenchIntro();
    }
  }

  function finishWorkbenchIntro() {
    hide();
    document.dispatchEvent(new CustomEvent('onboarding:workbench-ready'));
  }

  function skip() {
    localStorage.removeItem(ACTIVE_KEY);
    localStorage.removeItem(STEP_KEY);
    hide();
    if (currentPage === 'workbench') {
      document.dispatchEvent(new CustomEvent('onboarding:workbench-ready'));
    }
  }

  function hide() {
    if (overlay) overlay.classList.add('hidden');
    if (highlight) highlight.classList.add('hidden');
    if (card) card.classList.add('hidden');
  }

  function clearStaleSkipState() {
    if (localStorage.getItem(COMPLETE_KEY) === 'true') {
      localStorage.removeItem(COMPLETE_KEY);
    }
  }

  return {
    init: init,
    shouldDelayWorkbenchTutorial: shouldDelayWorkbenchTutorial,
    markComplete: function() {
      localStorage.setItem(COMPLETE_KEY, 'true');
      localStorage.removeItem(ACTIVE_KEY);
      localStorage.removeItem(STEP_KEY);
    }
  };
})();

window.OnboardingGuide = OnboardingGuide;
