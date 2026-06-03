const CONSTANTS = {
  // World
  WORLD_WIDTH: 3000,
  WORLD_HEIGHT: 3000,

  // Boat
  BOAT_HULL_LENGTH: 60,
  BOAT_HULL_WIDTH: 18,
  MAST_RADIUS: 5,
  BOOM_LENGTH: 28,

  // Movement (Phase 1 — direct control, no physics)
  TURN_SPEED_DEG: 120,   // degrees per second when arrow key held
  MOVE_SPEED: 150,       // pixels per second at full throttle

  // Camera
  CAMERA_LERP: 0.08,

  // Water dashes
  WATER_DASH_TIERS: {
    calm:   { minWind:  0, maxWind: 10, count: 20, length:  8, alpha: 0.07, driftSpeed: 0.3 },
    choppy: { minWind: 10, maxWind: 18, count: 45, length: 13, alpha: 0.15, driftSpeed: 0.8 },
    rough:  { minWind: 18, maxWind: 99, count: 80, length: 18, alpha: 0.25, driftSpeed: 1.5 },
  },

  // Physics (used in later phases)
  NO_GO_ZONE_DEG: 15,
  MAX_RUDDER_ANGLE: 45,
  BOAT_DRAG: 0.999,   // per-frame drag in no-go zone; 0.999^60 ≈ 0.94/s — very gentle
  ACCEL: 0.25,
  BASE_ACCEL: 0.25,  // lerp rate; lower = more inertia everywhere
  TACK_PENALTY_FACTOR: 0.7,
  TACK_PENALTY_DURATION_MS: 1000,
  JIBE_PENALTY_FACTOR: 0.8,
  JIBE_PENALTY_DURATION_MS: 500,
  SHALLOW_SPEED_LIMIT: 1.5,
  DOCK_SUCCESS_SPEED: 1.0,
  DOCK_SUCCESS_HEADING_TOLERANCE: 20,
  BUOY_DETECTION_RADIUS: 84,  // 6 × buoy visual radius (14px)

  // Displacement classes
  DISPLACEMENT: {
    light:  { value: 0.8, lerpMultiplier: 1.8 },
    medium: { value: 2.0, lerpMultiplier: 1.0 },
    heavy:  { value: 5.0, lerpMultiplier: 0.45 },
  },

  // Colors
  COLORS: {
    waterBase: 0x0a1628,
    waterRough: 0x0e1a2e,
    waterDash: 0xc8e8ff,
    hullFill: 0xf5f0e0,
    hullStroke: 0x333333,
    mastFill: 0x333333,
    boomStroke: 0x333333,
    sailFill: 0xffffff,
    buoyFill: 0xff6600,
    buoyStroke: 0xffffff,
    islandSand: 0xd4b896,
    islandGreen: 0x6b8e23,
    noGoZone: 0xff2222,
    wakeColor: 0xddeeff,
    windArrow: 0x99ccff,
  },

  // Physics scale
  KTS_TO_PX: 25,   // 1 knot = 25 px/s in world space

  // UI
  WORLD_EDGE_WARNING_DIST: 150,
  WIND_ARROW_GRID_SPACING: 150,
};
