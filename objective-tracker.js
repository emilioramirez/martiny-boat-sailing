// ── ObjectiveTracker ──────────────────────────────────────────────────────────
// Pure logic — no Phaser dependency.
// Tracks buoy rounding (in order) and docking / start-zone completion.
//
// Call init(map) on scene create and reset() on restart.
// Call update(boatPos, boatSpeed, boatHeading) every frame.

class ObjectiveTracker {
  constructor() {
    this._map             = null;
    this.nextBuoyIndex    = 0;
    this.complete         = false;
    this._wasInDetection  = false;  // entered current buoy's detection circle
  }

  init(map) {
    this._map            = map;
    this.nextBuoyIndex   = 0;
    this.complete        = false;
    this._wasInDetection = false;
  }

  reset() {
    this.nextBuoyIndex   = 0;
    this.complete        = false;
    this._wasInDetection = false;
  }

  // Returns { buoyRounded, roundedBuoyIndex, complete, docked }
  update(boatPos, boatSpeed, boatHeading) {
    if (this.complete) return _noEvent();

    const map   = this._map;
    const buoys = map.buoys;

    // ── Dock map (no buoys) ───────────────────────────────────────────────────
    if (buoys.length === 0 && map.docks.length > 0) {
      return this._checkDock(boatPos, boatSpeed, boatHeading);
    }

    // ── Buoy rounding ─────────────────────────────────────────────────────────
    if (this.nextBuoyIndex < buoys.length) {
      const buoy = buoys[this.nextBuoyIndex];
      const dist = Math.hypot(boatPos.x - buoy.x, boatPos.y - buoy.y);

      if (dist <= CONSTANTS.BUOY_DETECTION_RADIUS) {
        this._wasInDetection = true;
      } else if (this._wasInDetection) {
        // Exited the detection circle → rounded
        this._wasInDetection = false;
        const idx = this.nextBuoyIndex;
        this.nextBuoyIndex++;
        return { buoyRounded: true, roundedBuoyIndex: idx, complete: false, docked: false };
      }
      return _noEvent();
    }

    // ── All buoys done → check start zone ─────────────────────────────────────
    return this._checkStartZone(boatPos);
  }

  _checkStartZone(boatPos) {
    const zone = this._map.startZone;
    if (!zone) return _noEvent();
    const inZone = boatPos.x >= zone.x && boatPos.x <= zone.x + zone.width &&
                   boatPos.y >= zone.y && boatPos.y <= zone.y + zone.height;
    if (inZone) {
      this.complete = true;
      return { buoyRounded: false, roundedBuoyIndex: -1, complete: true, docked: false };
    }
    return _noEvent();
  }

  _checkDock(boatPos, boatSpeed, boatHeading) {
    const dock = this._map.docks[0];
    if (!dock) return _noEvent();

    const inBounds = boatPos.x >= dock.x && boatPos.x <= dock.x + dock.width &&
                     boatPos.y >= dock.y && boatPos.y <= dock.y + dock.height;
    if (!inBounds) return _noEvent();

    const speedOk  = boatSpeed <= CONSTANTS.DOCK_SUCCESS_SPEED;
    const rawDiff  = ((boatHeading - dock.heading) % 360 + 360) % 360;
    const headDiff = rawDiff > 180 ? 360 - rawDiff : rawDiff;
    const headingOk = headDiff <= CONSTANTS.DOCK_SUCCESS_HEADING_TOLERANCE;

    if (speedOk && headingOk) {
      this.complete = true;
      return { buoyRounded: false, roundedBuoyIndex: -1, complete: true, docked: true };
    }
    return _noEvent();
  }
}

function _noEvent() {
  return { buoyRounded: false, roundedBuoyIndex: -1, complete: false, docked: false };
}
