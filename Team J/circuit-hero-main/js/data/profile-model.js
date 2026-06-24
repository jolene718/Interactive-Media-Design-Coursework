// Builds display data for the profile page from local or remote progress.
const ProfileModel = (function() {
  var CHAPTERS = [
    { chapter: 1, levelId: '1-1', title: 'Basic Circuits' },
    { chapter: 2, levelId: '2-1', title: 'Switches' },
    { chapter: 3, levelId: '3-1', title: 'Series Circuits' },
    { chapter: 4, levelId: '4-1', title: 'Parallel Circuits' },
    { chapter: 5, levelId: '5-1', title: 'Mixed Circuits' },
    { chapter: 6, levelId: '6-1', title: 'Final Challenge' }
  ];

  var COMPONENTS = [
    {
      id: 'battery',
      name: 'Battery',
      icon: 'assets/icons/battery.svg',
      description: 'The power source. Current starts at (+) and returns to (-).'
    },
    {
      id: 'bulb',
      name: 'Bulb',
      icon: 'assets/icons/bulb.svg',
      description: 'A load that lights up when current passes through it.'
    },
    {
      id: 'wire',
      name: 'Wire',
      icon: 'assets/icons/wire.svg',
      description: 'Connects ports and gives current a path to follow.'
    },
    {
      id: 'switch',
      name: 'Switch',
      icon: 'assets/icons/switch.svg',
      description: 'Opens or closes the circuit like a gate for electricity.'
    }
  ];

  function stars(count) {
    return [0, 1, 2].map(function(index) {
      return index < count;
    });
  }

  function hasCompleted(levels, levelId) {
    return !!(levels[levelId] && levels[levelId].completed);
  }

  function create(options) {
    var progress = options.progress || { levels: {} };
    var levels = progress.levels || {};
    var username = options.username || 'Guest';
    var completedCount = Object.keys(levels).filter(function(levelId) {
      return levels[levelId] && levels[levelId].completed;
    }).length;

    var progressRows = CHAPTERS.map(function(chapter, index) {
      var rowProgress = levels[chapter.levelId];
      var available = typeof LevelConfig !== 'undefined' ? LevelConfig.has(chapter.levelId) : index < 4;
      var previousComplete = index === 0 || hasCompleted(levels, CHAPTERS[index - 1].levelId);
      var status = 'Locked';

      if (rowProgress && rowProgress.completed) {
        status = 'Done';
      } else if (available && previousComplete) {
        status = 'In Progress';
      }

      return {
        chapter: chapter.chapter,
        levelId: chapter.levelId,
        title: chapter.title,
        status: status,
        stars: stars(rowProgress && rowProgress.completed ? rowProgress.stars || 0 : 0),
        bestTime: rowProgress && rowProgress.bestTime ? rowProgress.bestTime : null
      };
    });

    var allConfiguredComplete = ['1-1', '2-1', '3-1', '4-1'].every(function(levelId) {
      return hasCompleted(levels, levelId);
    });
    var allConfiguredThreeStar = ['1-1', '2-1', '3-1', '4-1'].every(function(levelId) {
      return levels[levelId] && levels[levelId].completed && levels[levelId].stars === 3;
    });
    var anyFast = Object.keys(levels).some(function(levelId) {
      return levels[levelId] && levels[levelId].completed && levels[levelId].bestTime && levels[levelId].bestTime <= 120;
    });

    return {
      username: username,
      title: completedCount >= 4 ? 'Circuit Hero' : 'Apprentice Electrician',
      completedCount: completedCount,
      totalChapters: CHAPTERS.length,
      progressRows: progressRows,
      badges: [
        { id: 'firstCircuit', name: 'First Circuit', icon: 'assets/icons/logo-lightning.svg', unlocked: completedCount >= 1 },
        { id: 'bugFixer', name: 'Bug Fixer', icon: 'assets/icons/help.svg', unlocked: hasCompleted(levels, '2-1') },
        { id: 'speedRun', name: 'Speed Run', icon: 'assets/icons/star.svg', unlocked: anyFast },
        { id: 'seriesBuilder', name: 'Series Builder', icon: 'assets/icons/wire.svg', unlocked: hasCompleted(levels, '3-1') },
        { id: 'branchMaster', name: 'Branch Master', icon: 'assets/icons/switch.svg', unlocked: hasCompleted(levels, '4-1') },
        { id: 'allStar', name: 'All-Star Chapter', icon: 'assets/icons/star.svg', unlocked: allConfiguredComplete && allConfiguredThreeStar }
      ],
      components: COMPONENTS
    };
  }

  return { create: create };
})();
