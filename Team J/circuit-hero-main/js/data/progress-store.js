// Local progress state for the static prototype.
const ProgressStore = (function() {
  var PROGRESS_KEY = 'ch_progress';
  var START_PREFIX = 'ch_level_start:';
  var HINT_PREFIX = 'ch_used_hint:';

  function getStorage(storage) {
    if (storage) return storage;
    return window.localStorage;
  }

  function readJson(key, fallback, storage) {
    var raw = getStorage(storage).getItem(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function writeJson(key, value, storage) {
    getStorage(storage).setItem(key, JSON.stringify(value));
  }

  function setProgress(progress, storage) {
    var normalized = progress || { levels: {} };
    if (!normalized.levels) normalized.levels = {};
    writeJson(PROGRESS_KEY, normalized, storage);
    return normalized;
  }

  function getProgress(storage) {
    var progress = readJson(PROGRESS_KEY, { levels: {} }, storage);
    if (!progress.levels) progress.levels = {};
    return progress;
  }

  function getLevelProgress(levelId, storage) {
    return getProgress(storage).levels[levelId] || null;
  }

  function completeLevel(levelId, result, storage) {
    var progress = getProgress(storage);
    var current = progress.levels[levelId] || {};
    var currentStars = current.stars || 0;
    var currentBestTime = typeof current.bestTime === 'number' ? current.bestTime : null;
    var elapsed = typeof result.elapsed === 'number' ? result.elapsed : null;

    progress.levels[levelId] = {
      completed: true,
      stars: Math.max(currentStars, result.stars || 1),
      bestTime: currentBestTime === null ? elapsed : Math.min(currentBestTime, elapsed),
      usedHint: !!result.usedHint
    };

    writeJson(PROGRESS_KEY, progress, storage);
    return progress.levels[levelId];
  }

  async function loadRemoteProgress(storage) {
    if (typeof ApiClient === 'undefined') return getProgress(storage);
    try {
      var remote = await ApiClient.getProgress();
      return setProgress(remote, storage);
    } catch (e) {
      return getProgress(storage);
    }
  }

  function syncLevelToRemote(levelId, result) {
    if (typeof ApiClient === 'undefined') return;
    ApiClient.saveProgress({
      levelId: levelId,
      stars: result.stars,
      elapsed: result.elapsed,
      usedHint: result.usedHint
    }).then(function() {
      return loadRemoteProgress();
    }).catch(function() {
      // Keep the local attempt; the next login/session can sync later.
    });
  }

  function calculateStars(result) {
    if (result.usedHint) return 1;
    if (result.elapsed <= result.targetTime) return 3;
    return 2;
  }

  function markLevelStarted(levelId, timestamp, storage) {
    getStorage(storage).setItem(START_PREFIX + levelId, String(timestamp));
  }

  function startLevelAttempt(levelId, timestamp, storage) {
    var store = getStorage(storage);
    store.setItem(START_PREFIX + levelId, String(timestamp));
    store.removeItem(HINT_PREFIX + levelId);
  }

  function getLevelStart(levelId, storage) {
    var raw = getStorage(storage).getItem(START_PREFIX + levelId);
    if (!raw) return null;
    var parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function markHintUsed(levelId, storage) {
    getStorage(storage).setItem(HINT_PREFIX + levelId, 'true');
  }

  function hasUsedHint(levelId, storage) {
    return getStorage(storage).getItem(HINT_PREFIX + levelId) === 'true';
  }

  return {
    getProgress: getProgress,
    setProgress: setProgress,
    getLevelProgress: getLevelProgress,
    completeLevel: completeLevel,
    loadRemoteProgress: loadRemoteProgress,
    syncLevelToRemote: syncLevelToRemote,
    calculateStars: calculateStars,
    markLevelStarted: markLevelStarted,
    startLevelAttempt: startLevelAttempt,
    getLevelStart: getLevelStart,
    markHintUsed: markHintUsed,
    hasUsedHint: hasUsedHint
  };
})();
