// Level configuration data
const LevelConfig = (function() {
  var LEVELS = {
    '1-1': {
      id: '1-1',
      chapter: 1,
      title: 'First Light',
      briefing: {
        cutsceneBadge: 'CH.01 . SCENE 01 . NIGHT',
        dialogueSpeaker: 'LUNA . NIGHT LIGHT OWNER',
        dialogueText: "My night light stopped working! Can you help me fix it? Mochi is scared of the dark...",
        goalText: 'Build a complete circuit to light up the bulb.',
        availableParts: ['Battery x1', 'Bulb x1', 'Wire (unlimited)'],
        tipText: 'Sparky will guide you through the first level step by step. Press SPACE to skip dialogue.',
        threeStarTime: 120
      },
      workbench: {
        prePlace: [
          { type: 'battery', colRatio: 0.3, rowRatio: 0.5 }
        ],
        partsPanel: {
          battery: { count: 1, locked: false },
          bulb: { count: 1, locked: false },
          wire: { count: Infinity, locked: false },
          switch: { count: 0, locked: true }
        }
      },
      tutorialMode: 'full',
      success: {
        dialogue: "Great job! Mochi isn't scared anymore! Luna says thank you!",
        knowledgeTitle: 'Knowledge: Closed Circuit',
        knowledgeItems: [
          'Current flows from battery (+) terminal',
          'Passes through a load (like a bulb)',
          'Returns to battery (-) terminal',
          'This complete path is a "closed circuit"',
          'The circuit must be closed for current to flow'
        ],
        knowledgeMotto: 'Remember: electricity needs a complete loop!'
      }
    },
    '2-1': {
      id: '2-1',
      chapter: 2,
      title: 'Light Switch',
      briefing: {
        cutsceneBadge: 'CH.02 . SCENE 01 . HALLWAY',
        dialogueSpeaker: 'LUNA . HALLWAY LIGHT',
        dialogueText: "I can't turn the hallway light off! It stays on all day. Can you add a switch so I can control it?",
        goalText: 'Add a switch to the circuit. Close the switch, then power on to light the bulb.',
        availableParts: ['Battery x1', 'Bulb x1', 'Switch x1 (NEW!)', 'Wire (unlimited)'],
        tipText: 'Drag the Switch onto the board. Click a placed switch to toggle it open/closed!',
        threeStarTime: 120
      },
      workbench: {
        prePlace: [
          { type: 'battery', colRatio: 0.2, rowRatio: 0.5 },
          { type: 'bulb', colRatio: 0.65, rowRatio: 0.5 }
        ],
        partsPanel: {
          battery: { count: 1, locked: false },
          bulb: { count: 1, locked: false },
          wire: { count: Infinity, locked: false },
          switch: { count: 1, locked: false }
        }
      },
      tutorialMode: 'hints',
      success: {
        dialogue: "Now you can control the light! Flip the switch on and off. Luna loves it!",
        knowledgeTitle: 'Knowledge: Switches',
        knowledgeItems: [
          'A switch acts like a "gate" in the circuit',
          'Switch open = circuit broken, current stops',
          'Switch closed = circuit complete, current flows',
          'Switches must be in series with the load',
          'Most real circuits have switches for safety and control'
        ],
        knowledgeMotto: 'Think of a switch like a faucet for electricity!'
      }
    }
  };

  function get(levelId) {
    return LEVELS[levelId] || null;
  }

  return { get: get };
})();
