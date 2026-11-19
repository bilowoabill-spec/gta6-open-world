// Solara Bay — configuration: world layout, palette, tuning, story.
// Everything here is original: our own city, names, characters and missions.
export const GAME_TITLE = 'SOLARA BAY';
export const GAME_SUBTITLE = 'An open-world crime story';

// World geometry (pixels). The city is a road grid; south edge is the beach.
export const WORLD = {
  size: 3200,
  roadGap: 320,      // distance between road centerlines
  roadWidth: 72,     // drivable road width
  firstRoad: 160,    // first road centerline
  beachY: 3020,      // sand starts here
  waterY: 3130,      // water starts here
};

// Sun-soaked palette for the city.
export const COLORS = {
  grass: '#7fae5a',
  grassDark: '#74a354',
  road: '#3c3f46',
  roadEdge: '#2f3238',
  lane: '#e8d44d',
  sidewalk: '#b9b3a4',
  sand: '#e6d199',
  water: '#2f7fb8',
  waterDeep: '#256b9e',
  park: '#5d9b4a',
  buildingRoof: ['#c96f4a', '#4a7a9e', '#8a6ba8', '#b89a55', '#5d8a6b', '#a8545e', '#6b7f9e'],
  buildingWall: '#e8e2d4',
  bank: '#d8c27a',
  safehouse: '#5da85d',
  carPlayer: '#e23b3b',
  carPolice: '#20242c',
  cop: '#1f3a93',
  thug: '#7a2e2e',
  ped: ['#e8b88a', '#c98d5f', '#8a5a3b', '#f0c8a0'],
  playerShirt: '#ffcf3f',
};

export const PLAYER = {
  radius: 13,
  walkSpeed: 210,
  sprintSpeed: 320,
  health: 100,
  pistolDamage: 34,
  pistolRange: 520,
  fireInterval: 0.22,
  bulletSpeed: 950,
};

export const CAR = {
  length: 46,
  width: 22,
  accel: 420,
  brake: 700,
  reverseAccel: 260,
  maxSpeed: 520,
  maxReverse: 160,
  turnRate: 2.6,
  drag: 0.6,
  health: 100,
};

export const POLICE = {
  maxStars: 5,
  decayDelay: 15,      // seconds without crime before wanted starts to fall
  decayInterval: 10,   // seconds per star lost while hidden
  arrestTime: 1.2,     // seconds a cop must touch the player to bust them
  copSpeed: 235,
  copCarSpeed: 560,
  spawnDistance: 700,
};

// Money
export const START_MONEY = 50;

// Mission story. Jax Marlowe, a wheelman for hire, works for Mama Rosa,
// a fixer who runs jobs out of a diner in Solara Bay.
export const MISSIONS = [
  {
    id: 'm1',
    title: 'Mission 1 — The Wheelman',
    story: "Mama Rosa needs a driver. Pick up her client at the blue marker and get him across town — no questions, no cops.",
    reward: 200,
    steps: [
      { type: 'driveTo', x: 840, y: 1160, radius: 70, label: 'Drive to the pickup point' },
      { type: 'driveTo', x: 2440, y: 2120, radius: 70, label: 'Drop the client at the marina' },
    ],
  },
  {
    id: 'm2',
    title: 'Mission 2 — Package Run',
    story: "Three packages, three corners of the bay. Grab them all and bring them to the drop-off. Word is someone else wants them too.",
    reward: 350,
    steps: [
      { type: 'collect', points: [{ x: 840, y: 840 }, { x: 2760, y: 840 }, { x: 1160, y: 2440 }], radius: 55, label: 'Collect the packages (0/3)' },
      { type: 'goto', x: 1800, y: 1800, radius: 70, label: 'Deliver the packages to the drop-off' },
    ],
  },
  {
    id: 'm3',
    title: 'Mission 3 — Heat',
    story: "The cops made your plates. Lose them — get to the safehouse and lay low until the heat dies down.",
    reward: 300,
    steps: [
      { type: 'heat', wanted: 3, x: 520, y: 520, radius: 90, label: 'Reach the safehouse and lay low' },
    ],
  },
  {
    id: 'm4',
    title: 'Mission 4 — The Big Score',
    story: "The Solara Bank. In, out, gone before the sirens close in. This one sets you up for life — if you make it to the safehouse.",
    reward: 1000,
    steps: [
      { type: 'goto', x: 1480, y: 1480, radius: 80, label: 'Get to the Solara Bank' },
      { type: 'hold', x: 1480, y: 1480, radius: 90, duration: 6, label: 'Crack the vault — stay inside!' },
      { type: 'escape', x: 520, y: 520, radius: 90, wanted: 4, label: 'Escape to the safehouse!' },
    ],
  },
];

export const SAFEHOUSE = { x: 520, y: 520 };
export const BANK = { x: 1480, y: 1480 };
export const PLAYER_SPAWN = { x: 560, y: 620 };

// Car models (original names, colors, handling tweaks).
export const CAR_MODELS = [
  { name: 'Comet', color: '#d83a3a', top: 520, accel: 430 },
  { name: 'Marlin', color: '#3a7bd8', top: 470, accel: 400 },
  { name: 'Sunbeam', color: '#e8c832', top: 500, accel: 420 },
  { name: 'Tortoise', color: '#5da85d', top: 430, accel: 380 },
  { name: 'Nightowl', color: '#8a5fc0', top: 490, accel: 410 },
  { name: 'Sandman', color: '#e8e8e8', top: 460, accel: 390 },
];
