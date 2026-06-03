// ── SailingPhysics ────────────────────────────────────────────────────────────
// Pure math module. Zero Phaser dependency — testable in any browser console.
//
// Input / output shape: see PART 1 §4 of the design prompt.
//
// Units:
//   speeds    → knots
//   positions → world pixels  (conversion: CONSTANTS.KTS_TO_PX px per knot-second)
//   angles    → degrees       (heading: 0=north, CW; AWA: signed, +=starboard tack)

class SailingPhysics {
  constructor() {
    this._prevSignedAWA = null;
    this._ironsTimer    = 0;  // seconds AWA<30° && speed<1kts
    this._ironsCooldown = 0;  // 3-second cooldown after escaping irons
  }

  // ── Public helpers ──────────────────────────────────────────────────────────

  // Signed AWA: -180..+180  (positive = wind on starboard side)
  getSignedAWA(heading, windDir) {
    let awa = ((heading - windDir) % 360 + 360) % 360;
    if (awa > 180) awa -= 360;
    return awa;
  }

  // Absolute AWA for point-of-sail lookups (0–180)
  getAWA(heading, windDir) {
    return Math.abs(this.getSignedAWA(heading, windDir));
  }

  // Optimal boom angle for a given absolute AWA
  getOptimalTrim(absAWA) {
    if (absAWA <  CONSTANTS.NO_GO_ZONE_DEG) return 0;
    if (absAWA <  60) return 10;
    if (absAWA <  90) return 25;
    if (absAWA < 120) return 45;
    if (absAWA < 150) return 68;
    return 82;
  }

  // Speed factor (0–1) for a given absolute AWA
  getSpeedFactor(absAWA) {
    if (absAWA <  CONSTANTS.NO_GO_ZONE_DEG) return 0;
    if (absAWA <  60) return 0.70;
    if (absAWA <  90) return 0.85;
    if (absAWA < 120) return 1.00;
    if (absAWA < 150) return 0.95;
    return 0.75;
  }

  // Trim status key for current AWA + trim angle
  getTrimStatus(absAWA, trimAngle) {
    if (absAWA < CONSTANTS.NO_GO_ZONE_DEG) return 'luffing';
    const optimal = this.getOptimalTrim(absAWA);
    const error   = trimAngle - optimal;
    if (error < -8)           return 'stalled'; // over-trimmed (boom too far in)
    if (Math.abs(error) <= 8) return 'trimmed';
    if (trimAngle > 70)       return 'eased';
    return 'easing';
  }

  // ── Main update ─────────────────────────────────────────────────────────────

  update(s) {
    const delta     = s.delta;
    const signedAWA = this.getSignedAWA(s.boatHeading, s.windDirection);
    const absAWA    = Math.abs(signedAWA);

    // ── Tack / jibe detection ─────────────────────────────────────────────────
    // Both events are a sign change of signedAWA. Distinguish by |AWA| magnitude:
    //   tack:  bow through wind   → AWA near 0°   → absSum small
    //   jibe:  stern through wind → AWA near 180° → absSum large
    let justTacked = false;
    let justJibed  = false;

    if (this._prevSignedAWA !== null) {
      const prev = this._prevSignedAWA;
      const curr = signedAWA;
      if ((prev > 0 && curr < 0) || (prev < 0 && curr > 0)) {
        const absSum = Math.abs(prev) + Math.abs(curr);
        if (absSum < CONSTANTS.NO_GO_ZONE_DEG * 2.5) {
          justTacked = true;
        } else if (absSum > 300) {
          justJibed = true;
        }
      }
    }
    this._prevSignedAWA = signedAWA;

    // ── Displacement → lerp multiplier ────────────────────────────────────────
    let dispMult;
    if      (s.displacement <= 0.9) dispMult = CONSTANTS.DISPLACEMENT.light.lerpMultiplier;
    else if (s.displacement <= 2.5) dispMult = CONSTANTS.DISPLACEMENT.medium.lerpMultiplier;
    else                            dispMult = CONSTANTS.DISPLACEMENT.heavy.lerpMultiplier;

    // ── Target speed ──────────────────────────────────────────────────────────
    const optimalTrim    = this.getOptimalTrim(absAWA);
    const trimError      = Math.abs(s.sailTrimAngle - optimalTrim);
    const trimEfficiency = Math.max(0, 1 - trimError / 45);
    const pointFactor    = this.getSpeedFactor(absAWA);
    const targetSpeed    = s.windSpeed * pointFactor * trimEfficiency;

    // ── Lerp current speed toward target ──────────────────────────────────────
    const lerpFactor = CONSTANTS.BASE_ACCEL * dispMult * delta;
    let newSpeed = s.boatSpeed + (targetSpeed - s.boatSpeed) * Math.min(lerpFactor, 1);

    // No-go zone: additional drag on top of the lerp-toward-zero
    if (absAWA < CONSTANTS.NO_GO_ZONE_DEG) {
      newSpeed *= Math.pow(CONSTANTS.BOAT_DRAG, 60 * delta);
    }
    newSpeed = Math.max(0, newSpeed);

    // ── Tack / jibe: immediate speed penalty ──────────────────────────────────
    // Applied AFTER lerp so it isn't smoothed away in the same frame.
    if (justTacked) newSpeed *= CONSTANTS.TACK_PENALTY_FACTOR;
    if (justJibed)  newSpeed *= CONSTANTS.JIBE_PENALTY_FACTOR;

    // ── Stuck in irons ────────────────────────────────────────────────────────
    // Entry: AWA < 30° AND speed < 1 kt persisting > 2 s
    const ironsCondition = absAWA < CONSTANTS.NO_GO_ZONE_DEG * 2 && newSpeed < 1.0;
    if (ironsCondition && this._ironsCooldown <= 0) {
      this._ironsTimer += delta;
    } else {
      this._ironsTimer = 0;
    }
    if (this._ironsCooldown > 0) {
      this._ironsCooldown = Math.max(0, this._ironsCooldown - delta);
    }
    const isInIrons = this._ironsTimer >= 2.0;

    // Escape: AWA > no-go zone and speed > 0.5 kt while in irons → reset + cooldown
    if (isInIrons && (absAWA >= CONSTANTS.NO_GO_ZONE_DEG || newSpeed >= 0.5)) {
      this._ironsTimer    = 0;
      this._ironsCooldown = 3.0;
    }

    // ── Heading update via rudder ──────────────────────────────────────────────
    // Max turn: 60 °/s at full rudder (45°) and ≥ 6 kts. Scales with speed.
    const MAX_TURN_RATE = 60;
    const speedNorm     = Math.min(newSpeed / 6, 1.5);
    const rudderEffect  = isInIrons ? 0.2 : 1.0;
    const dHeading      = (s.rudderAngle / CONSTANTS.MAX_RUDDER_ANGLE)
                        * MAX_TURN_RATE * speedNorm * rudderEffect * delta;
    const newHeading    = ((s.boatHeading + dHeading) % 360 + 360) % 360;

    // ── Position update ───────────────────────────────────────────────────────
    const KTS_TO_PX = CONSTANTS.KTS_TO_PX;

    // Forward movement (heading → movement direction)
    // heading 0=north (up). Phaser convention: 0=east → offset -90°
    const fwdRad = (newHeading - 90) * Math.PI / 180;
    let   dx     = Math.cos(fwdRad) * newSpeed * KTS_TO_PX * delta;
    let   dy     = Math.sin(fwdRad) * newSpeed * KTS_TO_PX * delta;

    // Leeway: lateral drift perpendicular to heading, away from wind.
    // Max when close-hauled (absAWA ≈ 45°), zero when running (absAWA ≈ 180°).
    const leewayFactor = Math.max(0, 1 - absAWA / 90);
    const leewaySpeed  = s.windSpeed * 0.015 * leewayFactor; // knots
    // Perpendicular to heading in screen coords = (cos h, sin h)
    // Direction: leeward side = away from wind → sign of signedAWA
    const leewaySign = signedAWA >= 0 ? 1 : -1;
    const hRad       = newHeading * Math.PI / 180;
    dx += Math.cos(hRad) * leewaySpeed * leewaySign * KTS_TO_PX * delta;
    dy += Math.sin(hRad) * leewaySpeed * leewaySign * KTS_TO_PX * delta;

    const newPos = { x: s.boatPosition.x + dx, y: s.boatPosition.y + dy };

    // ── Trim status ───────────────────────────────────────────────────────────
    const trimStatus = this.getTrimStatus(absAWA, s.sailTrimAngle);

    return {
      boatHeading:  newHeading,
      boatSpeed:    newSpeed,
      boatPosition: newPos,
      AWA:          signedAWA,
      trimStatus,
      trimError,
      isInIrons,
      justTacked,
      justJibed,
      targetSpeed,
    };
  }
}
