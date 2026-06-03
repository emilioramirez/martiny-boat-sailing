const MAPS = [
  // ── Map 1 — Single Buoy ─────────────────────────────────────────────────
  {
    id: 'buoy1',
    nameKey: 'map.buoy1.name',
    objectiveKey: 'map.buoy1.objective',
    worldSize: { width: 3000, height: 3000 },
    startPosition: { x: 1500, y: 2200 },
    startHeading: 0,
    wind: { direction: 90, speed: 8 },
    islands: [],
    docks: [],
    buoys: [
      { id: 1, x: 1500, y: 700, color: 0xff6600 },
    ],
    startZone: { x: 1440, y: 2300, width: 120, height: 40, heading: 90 },
  },

  // ── Map 2 — Two Buoys ────────────────────────────────────────────────────
  {
    id: 'buoy2',
    nameKey: 'map.buoy2.name',
    objectiveKey: 'map.buoy2.objective',
    worldSize: { width: 3000, height: 3000 },
    startPosition: { x: 1500, y: 1500 },
    startHeading: 0,
    wind: { direction: 90, speed: 8 },
    islands: [],
    docks: [],
    buoys: [
      { id: 1, x: 1500, y:  600, color: 0xff6600 },
      { id: 2, x: 1500, y: 2400, color: 0xff6600 },
    ],
    startZone: { x: 1440, y: 1540, width: 120, height: 40, heading: 90 },
  },

  // ── Map 3 — Olympic Triangle ─────────────────────────────────────────────
  {
    id: 'triangle',
    nameKey: 'map.triangle.name',
    objectiveKey: 'map.triangle.objective',
    worldSize: { width: 3000, height: 3000 },
    startPosition: { x: 1500, y: 2400 },
    startHeading: 0,
    wind: { direction: 90, speed: 8 },
    islands: [],
    docks: [],
    buoys: [
      { id: 1, x: 1500, y:  550, color: 0xff6600 }, // windward
      { id: 2, x: 2100, y: 1200, color: 0xff6600 }, // reach mark
      { id: 3, x: 1500, y: 2000, color: 0xff6600 }, // leeward
    ],
    startZone: { x: 1440, y: 2450, width: 120, height: 40, heading: 90 },
  },

  // ── Map 4 — Island with Dock ─────────────────────────────────────────────
  {
    id: 'dock',
    nameKey: 'map.dock.name',
    objectiveKey: 'map.dock.objective',
    worldSize: { width: 3000, height: 3000 },
    startPosition: { x: 400, y: 2600 },
    startHeading: 0,
    wind: { direction: 90, speed: 10 },
    islands: [
      {
        // Large irregular island in the center
        points: [
          [1100, 900], [1350, 800], [1600, 820], [1800, 900],
          [1950, 1050], [2000, 1300], [1950, 1550], [1800, 1700],
          [1600, 1780], [1350, 1760], [1150, 1650], [1020, 1450],
          [980,  1200], [1020, 1020],
        ],
        color: 0x6b8e23,
      },
    ],
    docks: [
      {
        x: 950, y: 1280, width: 80, height: 30, heading: 270,
        labelKey: 'map.dock.label',
      },
    ],
    buoys: [],
    startZone: { x: 340, y: 2650, width: 120, height: 40, heading: 90 },
  },
];
