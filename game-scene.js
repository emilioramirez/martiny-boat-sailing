// ── GameScene — Phase 1 skeleton ─────────────────────────────────────────────
// Boat visible, arrow-key movement, camera follows, water background, world bounds.
// Physics, controls widgets, HUD panels and objectives come in later phases.

class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  // ── init ───────────────────────────────────────────────────────────────────
  init(data) {
    this.mapData        = data.map || MAPS[0];
    this._forceTutorial = data.forceTutorial || false;
  }

  // ── preload ────────────────────────────────────────────────────────────────
  preload() {
    loadRopeTextures(this);
    loadHelmTexture(this);
  }

  // ── create ─────────────────────────────────────────────────────────────────
  create() {
    const map = this.mapData;
    const W   = map.worldSize.width;
    const H   = map.worldSize.height;

    // Suppress mobile browser gestures on the canvas
    this.game.canvas.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
    this.game.canvas.addEventListener('touchmove',  e => e.preventDefault(), { passive: false });
    this.input.mouse.disableContextMenu();

    // ── Phaser groups so the UI camera can ignore world and vice versa ──────
    this.worldGroup = this.add.group();
    this.uiGroup    = this.add.group();

    // ── Water background + animated effects ─────────────────────────────────
    this._buildWater(W, H, map.wind.direction);

    // ── Islands ─────────────────────────────────────────────────────────────
    this._buildIslands(map.islands);

    // ── Buoys ────────────────────────────────────────────────────────────────
    this._buildBuoys(map.buoys);

    // ── Start zone ───────────────────────────────────────────────────────────
    this._buildStartZone(map.startZone);

    // ── Docks ────────────────────────────────────────────────────────────────
    this._buildDocks(map.docks);

    // ── Wake Graphics (dynamic, redrawn each frame) ─────────────────────────
    this.wakeGraphics = this.add.graphics();
    this.worldGroup.add(this.wakeGraphics);
    this.wakePoints = []; // [{x, y, age}]

    // ── Objective arrow (redrawn each frame) ─────────────────────────────────
    this.objectiveArrow = this.add.graphics();
    this.worldGroup.add(this.objectiveArrow);

    // ── Boat container ───────────────────────────────────────────────────────
    this.boatContainer = this._buildBoat();
    this.boatContainer.setPosition(map.startPosition.x, map.startPosition.y);

    // ── Boat state (Phase 3 — physics driven) ───────────────────────────────
    this.boatHeading  = map.startHeading;   // degrees, 0 = north (up)
    this.boatSpeed    = 0;                  // knots
    this.boatPosition = { x: map.startPosition.x, y: map.startPosition.y };
    this.displacement = CONSTANTS.DISPLACEMENT.medium.value;

    // ── Physics ───────────────────────────────────────────────────────────────
    this.physics = new SailingPhysics();

    // ── Objective tracker ─────────────────────────────────────────────────────
    this.objectiveTracker = new ObjectiveTracker();
    this.objectiveTracker.init(map);
    this._completionShown = false;
    this.isFailed         = false;

    // Precompute island polygons for collision (point-in-polygon checks)
    this._islandPolygons = (map.islands || []).map(isl =>
      isl.points.map(p => ({ x: p[0], y: p[1] }))
    );

    // ── Keyboard ─────────────────────────────────────────────────────────────
    this.cursors = this.input.keyboard.createCursorKeys();

    // ── State for Phase 4 ────────────────────────────────────────────────────
    this.layoutManager = new LayoutManager();
    this._baseWindDir  = map.wind.direction;
    this.isPaused      = false;

    // ── Controller widgets — positions from LayoutManager ────────────────────
    const msPos = this.layoutManager.msPos();
    const hPos  = this.layoutManager.helmPos();
    this.mainsheet    = new MainsheetController(this, msPos.x, msPos.y);
    this.helm         = new HelmController(this, hPos.x, hPos.y);
    this.inputManager = new InputManager(this, this.mainsheet, this.helm);

    // ── Camera setup — main camera follows boat in world space ─────────────
    this.cameras.main.setBounds(0, 0, W, H);
    this.cameras.main.startFollow(this.boatContainer, true, CONSTANTS.CAMERA_LERP, CONSTANTS.CAMERA_LERP);

    // ── Audio object (no AudioContext yet — just loads volume prefs from localStorage)
    this.audio = new SailingAudio();
    this.input.once('pointerdown', () => this.audio.start(), this);
    this.input.keyboard.once('keydown',   () => this.audio.start(), this);

    // ── Indicators panel (built first — pause panel references it) ───────────
    this.indicatorsPanel = new IndicatorsPanel(this, this.worldGroup, this.uiGroup, map);

    // ── HUD + pause panel — built before cameras ignore so group membership is set
    this._buildHUD();
    this._buildPausePanel();
    this._buildCompletionBanner();
    this._buildFailurePanel();

    // ── Notification system ───────────────────────────────────────────────────
    this.notifSystem = new NotificationSystem(this, this.uiGroup);

    // ── Tutorial (first-run coach marks) ─────────────────────────────────────
    this.tutorial = new TutorialManager(this, this.uiGroup);

    // Add UI containers to uiGroup so main camera ignores them
    this.uiGroup.add(this.mainsheet.container);
    this.uiGroup.add(this.helm.container);
    this.uiGroup.add(this.pausePanel);
    this.uiGroup.add(this.completionBanner);
    this.uiGroup.add(this.failurePanel);

    // UI camera: fixed overlay, sees only uiGroup.
    // Must be set up AFTER all objects are added to their groups.
    this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.uiCamera.ignore(this.worldGroup);
    this.cameras.main.ignore(this.uiGroup);

    // Start tutorial: forced from menu button, or auto on first launch
    if (this._forceTutorial) {
      this.tutorial.replay();
    } else {
      this.tutorial.start();
    }

    // Clean up listeners on scene shutdown
    this.events.on('shutdown', () => {
      if (this.inputManager) this.inputManager.destroy();
    }, this);
  }

  // ── update ─────────────────────────────────────────────────────────────────
  update(time, delta) {
    if (this.isPaused) return;
    const dt = delta / 1000; // seconds

    // ── Timer ─────────────────────────────────────────────────────────────────
    if (this._timerRunning) {
      this._timerMs += delta;
      this.hudTimer.setText(this._formatTime(this._timerMs));
    }

    // ── Keyboard input ────────────────────────────────────────────────────────
    // Left/Right: direct rudder override; Up/Down: trim adjustment
    let rudderAxisOverride = null;
    if (this.cursors.left.isDown)  rudderAxisOverride = -1;
    if (this.cursors.right.isDown) rudderAxisOverride =  1;
    if (this.cursors.up.isDown) {
      this.inputManager.sailTrimTarget = Math.max(0,  this.inputManager.sailTrimTarget - 60 * dt);
      this.mainsheet.trimAngle = this.inputManager.sailTrimTarget;
      this.mainsheet._updateVisuals();
    }
    if (this.cursors.down.isDown) {
      this.inputManager.sailTrimTarget = Math.min(85, this.inputManager.sailTrimTarget + 60 * dt);
      this.mainsheet.trimAngle = this.inputManager.sailTrimTarget;
      this.mainsheet._updateVisuals();
    }

    // ── Helm spring-back + axis ───────────────────────────────────────────────
    const helmAxis  = this.helm.update(dt);
    const rudderAxis = rudderAxisOverride !== null ? rudderAxisOverride : helmAxis;

    // ── Physics step ──────────────────────────────────────────────────────────
    const result = this.physics.update({
      boatHeading:   this.boatHeading,
      boatSpeed:     this.boatSpeed,
      boatPosition:  this.boatPosition,
      windDirection: this.mapData.wind.direction,
      windSpeed:     this.mapData.wind.speed,
      sailTrimAngle: this.inputManager.sailTrimTarget,
      rudderAngle:   rudderAxis * CONSTANTS.MAX_RUDDER_ANGLE,
      displacement:  this.displacement,
      delta:         dt,
    });

    this.boatHeading  = result.boatHeading;
    this.boatSpeed    = result.boatSpeed;
    this.boatPosition = result.boatPosition;

    // Clamp to world bounds
    const map = this.mapData;
    const hw  = CONSTANTS.BOAT_HULL_WIDTH / 2;
    this.boatPosition.x = Phaser.Math.Clamp(this.boatPosition.x, hw, map.worldSize.width  - hw);
    this.boatPosition.y = Phaser.Math.Clamp(this.boatPosition.y, hw, map.worldSize.height - hw);

    // ── Move boat container ──────────────────────────────────────────────────
    this.boatContainer.setPosition(this.boatPosition.x, this.boatPosition.y);
    this.boatContainer.setAngle(this.boatHeading);

    // ── Boom + sail redraw ────────────────────────────────────────────────────
    this._updateBoom(this.inputManager.sailTrimTarget, result.AWA, result.trimStatus);

    // ── Mainsheet label ───────────────────────────────────────────────────────
    this.mainsheet.updateLabel(result.trimStatus);

    // ── Water effects (dashes + wind arrows, viewport-aware) ─────────────────
    this._drawWaterEffects(time);

    // ── Wake trail ────────────────────────────────────────────────────────────
    this._updateWake(dt);

    // ── HUD text ─────────────────────────────────────────────────────────────
    this.hudSpeed.setText(`${t('hud.speed')}: ${result.boatSpeed.toFixed(1)} kts`);
    this.hudHeading.setText(`${t('hud.heading')}: ${Math.round(this.boatHeading)}°`);

    // Point-of-sail label
    const absAWA = Math.abs(result.AWA);
    const sail   = this._getPointOfSail(absAWA);
    this.hudPos.setText(t(sail.key));
    this.hudPos.setColor(sail.color);

    // In-irons warning + no-go arc
    this.hudIrons.setVisible(result.isInIrons);
    this.noGoArcGraphics.setVisible(absAWA < CONSTANTS.NO_GO_ZONE_DEG);

    // Wind compass arrow
    this._drawWindArrow(this.mapData.wind.direction);

    // Objective arrow
    this._updateObjectiveArrow(time);

    // ── Visual indicators ─────────────────────────────────────────────────────
    this.indicatorsPanel.update(
      this.boatPosition,
      this.boatHeading,
      this.boatSpeed,
      this.mapData.wind.direction,
      this.mapData.wind.speed,
      result.targetSpeed,
      this.objectiveTracker,
    );

    // ── Audio ─────────────────────────────────────────────────────────────────
    this.audio.update({
      boatSpeed:  result.boatSpeed,
      trimStatus: result.trimStatus,
      windSpeed:  this.mapData.wind.speed,
      absAWA,
    });
    if (result.justTacked) this.audio.playTack();
    if (result.justJibed)  this.audio.playJibe();

    // ── Notifications ─────────────────────────────────────────────────────────
    this.notifSystem.update({
      boatPos:   this.boatPosition,
      boatSpeed: this.boatSpeed,
      absAWA,
      trimStatus: result.trimStatus,
      trimError:  result.trimError,
      isInIrons:  result.isInIrons,
      justTacked: result.justTacked,
      justJibed:  result.justJibed,
      windSpeed:  this.mapData.wind.speed,
      mapData:    this.mapData,
    }, dt);

    // ── Collision detection ───────────────────────────────────────────────────
    if (!this.isFailed && !this._completionShown) {
      const bx = this.boatPosition.x;
      const by = this.boatPosition.y;
      const collisionR = CONSTANTS.BOAT_HULL_WIDTH / 2 + 14; // hull half-width + buoy radius

      // Buoy collision — only check buoys not yet rounded
      for (let bi = this.objectiveTracker.nextBuoyIndex; bi < (this.buoyObjects || []).length; bi++) {
        const bo = this.buoyObjects[bi];
        if (Math.hypot(bx - bo.buoy.x, by - bo.buoy.y) < collisionR) {
          this._triggerFailure('buoy');
          break;
        }
      }

      // Island collision
      if (!this.isFailed) {
        for (const poly of this._islandPolygons) {
          if (this._pointInPolygon(bx, by, poly)) {
            this._triggerFailure('island');
            break;
          }
        }
      }

      // Dock collision — hitting the structure always fails; success zone checked by objective tracker
      if (!this.isFailed && this.mapData.docks && this.mapData.docks.length > 0) {
        const dock = this.mapData.docks[0];
        const ds   = dock.structure ?? dock;
        const hitStructure = bx >= ds.x && bx <= ds.x + ds.width &&
                             by >= ds.y && by <= ds.y + ds.height;
        if (hitStructure) this._triggerFailure('dock');
      }
    }

    // ── Objective tracking ────────────────────────────────────────────────────
    const obj = this.objectiveTracker.update(this.boatPosition, this.boatSpeed, this.boatHeading);
    if (obj.buoyRounded) {
      this._flashBuoy(obj.roundedBuoyIndex);
      this.audio.playBuoyPing();
      if (navigator.vibrate) navigator.vibrate(25);
    }
    if (obj.complete && !this._completionShown) {
      this._completionShown = true;
      this._showCompletion();
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  _buildWater(W, H, windDir) {
    // Solid base — one big rect, perfectly fine for Phaser
    const bg = this.add.graphics();
    bg.fillStyle(CONSTANTS.COLORS.waterBase, 1);
    bg.fillRect(0, 0, W, H);
    this.worldGroup.add(bg);

    // Single Graphics for animated water dashes + wind arrows.
    // Redrawn every frame but only draws what's inside the current viewport.
    this.waterEffectGraphics = this.add.graphics();
    this.worldGroup.add(this.waterEffectGraphics);

    this._windArrowDir = windDir;
  }

  // Called every frame from update(time, …).
  // Draws water dashes and wind arrows only for the visible world region,
  // using a world-aligned grid so the pattern stays stable as the camera moves.
  _drawWaterEffects(time) {
    const g   = this.waterEffectGraphics;
    const cam = this.cameras.main;

    // Visible world rectangle (in world coords)
    const vx = cam.scrollX;
    const vy = cam.scrollY;
    const vw = cam.width  / (cam.zoom || 1);
    const vh = cam.height / (cam.zoom || 1);

    // Wind direction → movement vector (0 = from north → blows south)
    const windRad = Phaser.Math.DegToRad(this._windArrowDir - 90);
    const wdx     = Math.cos(windRad); // unit x
    const wdy     = Math.sin(windRad); // unit y

    g.clear();

    // ── Water dashes ─────────────────────────────────────────────────────────
    // Dense grid (spacing 45 px). Each cell has one short dash.
    // A time-based drift offset (mod spacing) animates them drifting downwind.
    const tier      = CONSTANTS.WATER_DASH_TIERS.calm;
    const dSpacing  = 45;
    const driftDist = (time * 0.001 * tier.driftSpeed * this.mapData.wind.speed) % dSpacing;
    const driftX    = wdx * driftDist;
    const driftY    = wdy * driftDist;
    const margin    = dSpacing * 2;

    // Snap grid origin to world coords so dashes don't shift when camera moves
    const dgx0 = Math.floor((vx - margin) / dSpacing) * dSpacing;
    const dgy0 = Math.floor((vy - margin) / dSpacing) * dSpacing;

    g.lineStyle(1.5, CONSTANTS.COLORS.waterDash, tier.alpha);

    for (let gx = dgx0; gx < vx + vw + margin; gx += dSpacing) {
      for (let gy = dgy0; gy < vy + vh + margin; gy += dSpacing) {
        // Deterministic per-cell jitter so dashes aren't perfectly aligned
        const jx = (Math.abs(gx * 17 + gy * 29) % 20) - 10;
        const jy = (Math.abs(gx * 23 + gy * 11) % 20) - 10;
        const wx = gx + jx + driftX;
        const wy = gy + jy + driftY;
        g.lineBetween(wx, wy, wx + wdx * tier.length, wy + wdy * tier.length);
      }
    }

    // ── Wind arrows ───────────────────────────────────────────────────────────
    // Sparser grid (spacing 150 px). Chevron arrows showing wind direction.
    const aSpacing = CONSTANTS.WIND_ARROW_GRID_SPACING;
    const aMargin  = aSpacing;
    const agx0 = Math.floor((vx - aMargin) / aSpacing) * aSpacing + aSpacing / 2;
    const agy0 = Math.floor((vy - aMargin) / aSpacing) * aSpacing + aSpacing / 2;

    g.lineStyle(1, CONSTANTS.COLORS.windArrow, 0.20);

    for (let gx = agx0; gx < vx + vw + aMargin; gx += aSpacing) {
      for (let gy = agy0; gy < vy + vh + aMargin; gy += aSpacing) {
        const len  = 18;
        const ex   = gx + wdx * len;
        const ey   = gy + wdy * len;
        g.lineBetween(gx, gy, ex, ey);
        // Arrowhead — two short lines at 135° from tip
        const hLen = 5;
        g.lineBetween(ex, ey, ex + Math.cos(windRad + Math.PI * 0.75) * hLen, ey + Math.sin(windRad + Math.PI * 0.75) * hLen);
        g.lineBetween(ex, ey, ex + Math.cos(windRad - Math.PI * 0.75) * hLen, ey + Math.sin(windRad - Math.PI * 0.75) * hLen);
      }
    }
  }

  _buildIslands(islands) {
    if (!islands || islands.length === 0) return;
    const g = this.add.graphics();
    for (const island of islands) {
      // Sandy outer layer (slightly expanded)
      g.fillStyle(CONSTANTS.COLORS.islandSand, 1);
      g.fillPoints(island.points.map(p => ({ x: p[0], y: p[1] })), true);
      // Green inner layer (slightly contracted — approximate by drawing same polygon smaller)
      g.fillStyle(CONSTANTS.COLORS.islandGreen, 1);
      const cx = island.points.reduce((s, p) => s + p[0], 0) / island.points.length;
      const cy = island.points.reduce((s, p) => s + p[1], 0) / island.points.length;
      const inner = island.points.map(p => ({
        x: cx + (p[0] - cx) * 0.88,
        y: cy + (p[1] - cy) * 0.88,
      }));
      g.fillPoints(inner, true);
    }
    this.worldGroup.add(g);
  }

  _buildBuoys(buoys) {
    this.buoyObjects = [];
    if (!buoys || buoys.length === 0) return;
    for (const buoy of buoys) {
      // Detection zone — dashed circle, drawn before buoy so it's underneath
      const dc = this._makeBuoyDetectionCircle(buoy.x, buoy.y);

      const g = this.add.graphics();
      g.fillStyle(buoy.color, 1);
      g.fillCircle(buoy.x, buoy.y, 14);
      g.lineStyle(2, CONSTANTS.COLORS.buoyStroke, 1);
      g.strokeCircle(buoy.x, buoy.y, 14);
      this.worldGroup.add(g);

      const label = this.add.text(buoy.x, buoy.y, String(buoy.id), {
        fontSize: '12px', fontFamily: 'Arial', fontStyle: 'bold',
        color: '#ffffff',
      }).setOrigin(0.5, 0.5);
      this.worldGroup.add(label);

      this.buoyObjects.push({ g, label, buoy, dc });
    }
  }

  _makeBuoyDetectionCircle(bx, by) {
    const r    = CONSTANTS.BUOY_DETECTION_RADIUS;
    const dc   = this.add.graphics();
    const segs = 20;   // total segments; every other one is drawn = dashed effect

    dc.lineStyle(1.5, 0xffcc66, 0.65);
    for (let i = 0; i < segs; i++) {
      if (i % 2 !== 0) continue;  // skip odd → dash gap
      const a1 = (i       / segs) * Math.PI * 2;
      const a2 = ((i + 0.8) / segs) * Math.PI * 2;  // 0.8 of segment = dash length
      const pts = [];
      for (let s = 0; s <= 5; s++) {
        const a = a1 + (a2 - a1) * s / 5;
        pts.push({ x: bx + Math.cos(a) * r, y: by + Math.sin(a) * r });
      }
      dc.strokePoints(pts);
    }
    this.worldGroup.add(dc);

    // Gentle alpha pulse
    this.tweens.add({
      targets:  dc,
      alpha:    { from: 0.25, to: 0.85 },
      duration: 1400,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });
    return dc;
  }

  _rebuildBuoyVisuals() {
    for (const bo of (this.buoyObjects || [])) {
      bo.g.clear();
      bo.g.fillStyle(bo.buoy.color, 1);
      bo.g.fillCircle(bo.buoy.x, bo.buoy.y, 14);
      bo.g.lineStyle(2, CONSTANTS.COLORS.buoyStroke, 1);
      bo.g.strokeCircle(bo.buoy.x, bo.buoy.y, 14);
      bo.label.setAlpha(1);
      bo.dc.setVisible(true);
    }
  }

  _flashBuoy(index) {
    const bo   = this.buoyObjects[index];
    const buoy = bo.buoy;

    // Yellow flash overlay — fades out then buoy turns grey
    const flash = this.add.graphics();
    this.worldGroup.add(flash);
    flash.fillStyle(0xffff00, 1);
    flash.fillCircle(buoy.x, buoy.y, 16);
    this.tweens.add({
      targets: flash,
      alpha: { from: 1, to: 0 },
      duration: 500,
      onComplete: () => {
        flash.destroy();
        bo.g.clear();
        bo.g.fillStyle(0x777777, 1);
        bo.g.fillCircle(buoy.x, buoy.y, 14);
        bo.g.lineStyle(2, 0x999999, 0.5);
        bo.g.strokeCircle(buoy.x, buoy.y, 14);
        bo.label.setAlpha(0.4);
        bo.dc.setVisible(false);  // ocultar zona de detección
      },
    });

    // "¡Boya!" text floats up and fades
    const txt = this.add.text(buoy.x, buoy.y - 22, t('objective.buoy_rounded'), {
      fontSize: '14px', fontFamily: 'Arial', fontStyle: 'bold',
      color: '#ffff44', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);
    this.worldGroup.add(txt);
    this.tweens.add({
      targets: txt,
      y: txt.y - 35,
      alpha: { from: 1, to: 0 },
      duration: 1000,
      onComplete: () => txt.destroy(),
    });
  }

  _buildStartZone(zone) {
    if (!zone) return;
    const g = this.add.graphics();
    const cx = zone.x + zone.width / 2;
    const cy = zone.y + zone.height / 2;
    // Port post (red) and starboard post (green)
    g.fillStyle(0xff2222, 1);
    g.fillCircle(zone.x, cy, 6);
    g.fillStyle(0x22cc44, 1);
    g.fillCircle(zone.x + zone.width, cy, 6);
    // Dashed line between posts
    g.lineStyle(1.5, 0xffffff, 0.7);
    const dashLen = 8;
    const gap     = 6;
    for (let dx = 0; dx < zone.width; dx += dashLen + gap) {
      g.lineBetween(zone.x + dx, cy, zone.x + Math.min(dx + dashLen, zone.width), cy);
    }
    this.worldGroup.add(g);
  }

  _buildDocks(docks) {
    if (!docks || docks.length === 0) return;
    for (const dock of docks) {
      const g = this.add.graphics();
      // Striped dock body — uses structure coords if defined, else dock coords
      const ds = dock.structure ?? dock;
      const stripeW = 12;
      for (let i = 0; i < ds.width; i += stripeW * 2) {
        g.fillStyle(0xc8a87a, 1);
        g.fillRect(ds.x + i, ds.y, Math.min(stripeW, ds.width - i), ds.height);
        g.fillStyle(0x9b7a52, 1);
        g.fillRect(ds.x + i + stripeW, ds.y, Math.min(stripeW, ds.width - i - stripeW), ds.height);
      }
      // Success zone outline (in water, where the ghost boat sits)
      g.lineStyle(1.5, 0x44ee44, 0.8);
      g.strokeRect(dock.x, dock.y, dock.width, dock.height);
      this.worldGroup.add(g);

      // Ghost boat — ideal docking position and heading
      const hw = CONSTANTS.BOAT_HULL_WIDTH / 2;
      const hl = CONSTANTS.BOAT_HULL_LENGTH / 2;
      const ghost = this.add.graphics();
      ghost.fillStyle(0x44ffcc, 0.20);
      ghost.lineStyle(1.5, 0x44ffcc, 0.65);
      const pts = [
        { x: 0,   y: -hl },
        { x: hw,  y: -hl * 0.3 },
        { x: hw,  y:  hl * 0.7 },
        { x: 0,   y:  hl },
        { x: -hw, y:  hl * 0.7 },
        { x: -hw, y: -hl * 0.3 },
      ];
      ghost.fillPoints(pts, true);
      ghost.strokePoints(pts, true);
      // Bow marker
      ghost.fillStyle(0x44ffcc, 0.55);
      ghost.fillTriangle(-5, -hl + 8, 5, -hl + 8, 0, -hl - 2);

      const ghostContainer = this.add.container(
        dock.x + dock.width  / 2,
        dock.y + dock.height / 2,
        [ghost],
      );
      ghostContainer.setAngle(dock.heading);
      this.worldGroup.add(ghostContainer);
    }
  }

  _buildBoat() {
    const container = this.add.container(0, 0);
    this.worldGroup.add(container);

    const g = this.add.graphics();

    // Hull — elongated pointed polygon, bow at top (negative y)
    const hw = CONSTANTS.BOAT_HULL_WIDTH / 2;
    const hl = CONSTANTS.BOAT_HULL_LENGTH / 2;
    g.fillStyle(CONSTANTS.COLORS.hullFill, 1);
    g.lineStyle(1.5, CONSTANTS.COLORS.hullStroke, 1);
    g.fillPoints([
      { x: 0,   y: -hl },      // bow
      { x: hw,  y: -hl * 0.3 },
      { x: hw,  y:  hl * 0.7 },
      { x: 0,   y:  hl },      // stern
      { x: -hw, y:  hl * 0.7 },
      { x: -hw, y: -hl * 0.3 },
    ], true);
    g.strokePoints([
      { x: 0,   y: -hl },
      { x: hw,  y: -hl * 0.3 },
      { x: hw,  y:  hl * 0.7 },
      { x: 0,   y:  hl },
      { x: -hw, y:  hl * 0.7 },
      { x: -hw, y: -hl * 0.3 },
    ], true);

    // Mast
    g.fillStyle(CONSTANTS.COLORS.mastFill, 1);
    g.fillCircle(0, 0, CONSTANTS.MAST_RADIUS);

    // ── No-go zone arc — separate object, shown only when in irons ──────────────
    const noGoGfx  = this.add.graphics();
    const arcR     = 50;
    const arcStart = Phaser.Math.DegToRad(-90 - CONSTANTS.NO_GO_ZONE_DEG);
    const arcEnd   = Phaser.Math.DegToRad(-90 + CONSTANTS.NO_GO_ZONE_DEG);
    noGoGfx.lineStyle(0);
    noGoGfx.fillStyle(CONSTANTS.COLORS.noGoZone, 0.28);
    noGoGfx.slice(0, -hl * 0.1, arcR, arcStart, arcEnd, false);
    noGoGfx.fillPath();
    noGoGfx.setVisible(false);

    // ── Boom + sail — starts empty, redrawn each frame by _updateBoom() ────────
    const boom = this.add.graphics();

    // ── Broken boat overlay — shown on collision failure ──────────────────────
    const broken = this.add.graphics();
    broken.fillStyle(THEME.failureBorder, 0.75);
    broken.fillPoints([
      { x: 0,   y: -hl },
      { x: hw,  y: -hl * 0.3 },
      { x: hw,  y:  hl * 0.7 },
      { x: 0,   y:  hl },
      { x: -hw, y:  hl * 0.7 },
      { x: -hw, y: -hl * 0.3 },
    ], true);
    // Crack lines
    broken.lineStyle(2, 0xffffff, 0.9);
    broken.lineBetween(-hw * 0.6, -hl * 0.5, hw * 0.5,  hl * 0.4);
    broken.lineBetween( hw * 0.4, -hl * 0.4, -hw * 0.3, hl * 0.3);
    broken.lineBetween(-hw * 0.2, -hl * 0.1,  hw * 0.2,  hl * 0.6);
    broken.setVisible(false);

    container.add(g);
    container.add(noGoGfx);
    container.add(boom);
    container.add(broken);
    this.boatGraphics   = g;
    this.noGoArcGraphics = noGoGfx;
    this.boomGraphics   = boom;
    this.brokenGraphics = broken;
    return container;
  }

  _updateWake(dt) {
    const g    = this.wakeGraphics;
    const maxAge = 1.5;

    // Push current stern position
    if (this.boatSpeed > 0.5) { // 0.5 kts threshold
      const rad  = Phaser.Math.DegToRad(this.boatHeading - 90);
      const hl   = CONSTANTS.BOAT_HULL_LENGTH / 2;
      this.wakePoints.push({
        x:       this.boatPosition.x - Math.cos(rad) * hl,
        y:       this.boatPosition.y - Math.sin(rad) * hl,
        age:     0,
        heading: this.boatHeading, // store heading so the V stays correct on turns
        speed:   this.boatSpeed,
      });
    }

    // Age and prune
    for (const p of this.wakePoints) p.age += dt;
    this.wakePoints = this.wakePoints.filter(p => p.age < maxAge);

    g.clear();
    if (this.wakePoints.length < 2) return;

    const maxSpread = 35;

    // Draw port (-1) and starboard (+1) wake arms
    for (const side of [-1, 1]) {
      const pts = [];
      for (const p of this.wakePoints) {
        const ageFraction = p.age / maxAge;
        const spread      = ageFraction * maxSpread * Math.min(p.speed / 8, 1); // p.speed already in knots

        // Perpendicular to the boat's heading AT THE TIME this point was recorded.
        // heading=0 → north (up). Perpendicular is east/west.
        // In screen coords (y-down), visually-CW 90° of forward = (-fy, fx).
        // forward = (sin h, -cos h); perp-right = (cos h, sin h).
        const hRad = Phaser.Math.DegToRad(p.heading);
        const perpX = Math.cos(hRad) * spread * side;
        const perpY = Math.sin(hRad) * spread * side;
        pts.push({ x: p.x + perpX, y: p.y + perpY });
      }
      for (let i = 0; i < pts.length - 1; i++) {
        const alpha = 1 - this.wakePoints[i].age / maxAge;
        g.lineStyle(1.5, CONSTANTS.COLORS.wakeColor, alpha * 0.6);
        g.lineBetween(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
      }
    }
  }

  // Redraws boom + sail each frame in the boat container's local space.
  // Container: bow = -Y, stern = +Y, starboard = +X, port = -X.
  // AWA > 0 → wind from PORT → PORT TACK → boom on STARBOARD (+X side).
  // AWA < 0 → wind from STARBOARD → STARBOARD TACK → boom on PORT (-X side).
  //
  // Sail: polígono de 4 vértices con panza que escala con sin(trimAngle).
  //   v1 mástil, v2 tope proyectado a proa, v3 panza (sotavento), v4 puño de escota.
  //   trim=0 → vela plana (panza cero). trim=85 → panza máxima.
  _updateBoom(trimAngle, signedAWA, trimStatus) {
    const g        = this.boomGraphics;
    const BL       = CONSTANTS.BOOM_LENGTH;
    const boomSide = signedAWA >= 0 ? 1 : -1;   // +1 = estribor, -1 = babor
    const trimRad  = Phaser.Math.DegToRad(trimAngle);

    // Puño de escota en espacio del contenedor
    const boomTipX  = boomSide * BL * Math.sin(trimRad);
    const boomTipY  = BL * Math.cos(trimRad);
    const sailHeadY = -CONSTANTS.BOAT_HULL_LENGTH * 0.35; // hacia proa (-Y)

    // Perpendicular al boom apuntando a sotavento (vector unidad)
    const perpX = boomSide * boomTipY / BL;
    const perpY = -boomSide * boomTipX / BL;

    // Profundidad de panza: máxima cuando la vela está filada
    const bellyDepth = BL * 0.5 * Math.sin(trimRad);

    // ── Estado visual de la vela ──────────────────────────────────────────────
    const isLuffing = trimStatus === 'luffing';
    const isEasing  = trimStatus === 'easing' || trimStatus === 'eased';
    const now       = this.time.now;

    // Flutter: oscilación del grátil (borde de entrada) en flameo o vela filada
    const flutterAmp = isLuffing ? 4.0 : isEasing ? 1.5 : 0;
    const flutter    = flutterAmp * Math.sin(now * 0.018) * boomSide;

    // Cabeza de la vela: siempre cerca del mástil
    const headX = flutter;
    const headY = sailHeadY * 0.15;

    // Punto de panza con la nueva posición de cabeza y desplazamiento de flutter
    const bellyX = boomTipX * 0.5 + perpX * bellyDepth + flutter * 0.4;
    const bellyY = (headY + boomTipY) * 0.5 + perpY * bellyDepth;

    g.clear();

    // Vela (relleno)
    g.fillStyle(0xffffff, isLuffing ? 0.28 : 0.55);
    g.fillPoints([
      { x: 0,        y: 0        },  // mástil
      { x: headX,    y: headY    }, // tope (colapsa hacia mástil al flamear)
      { x: bellyX,   y: bellyY   }, // panza
      { x: boomTipX, y: boomTipY }, // puño de escota
    ], true);

    // Botabara encima del relleno
    g.lineStyle(2, CONSTANTS.COLORS.boomStroke, 1);
    g.lineBetween(0, 0, boomTipX, boomTipY);
  }

  // ── Pause / settings panel ─────────────────────────────────────────────────

  _buildPausePanel() {
    const W = this.scale.width, H = this.scale.height;
    this.pausePanel = this.add.container(W / 2, H / 2).setDepth(50).setVisible(false);
    const c  = this.pausePanel;
    const PW = 500;
    const lx = -PW / 2 + 22;

    // Helpers: add centered or left-aligned text to a group (or c if null)
    const addTo = (grp, o) => { (grp || c).add(o); };
    const txt = (grp, x, y, str, style) => {
      const o = this.add.text(x, y, str, style).setOrigin(0.5, 0.5);
      addTo(grp, o); return o;
    };
    const ltxt = (grp, x, y, str, style) => {
      const o = this.add.text(x, y, str, style).setOrigin(0, 0.5);
      addTo(grp, o); return o;
    };
    const sep = (grp, y) => {
      const g = this.add.graphics();
      g.lineStyle(1, THEME.panelBorderAlt, 1);
      g.lineBetween(-PW / 2 + 12, y, PW / 2 - 12, y);
      addTo(grp, g);
    };

    // ── Dim + background ────────────────────────────────────────────────────
    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.55);
    dim.fillRect(-W / 2, -H / 2, W, H);
    c.add(dim);

    const bg = this.add.graphics();
    bg.fillStyle(THEME.panelBgDark, 0.97);
    bg.fillRoundedRect(-PW / 2, -225, PW, 450, 14);
    bg.lineStyle(1, THEME.panelBorderAlt, 1);
    bg.strokeRoundedRect(-PW / 2, -225, PW, 450, 14);
    c.add(bg);

    // ── Title ──────────────────────────────────────────────────────────────
    txt(null, 0, -190, t('pause.title'), {
      fontSize: '20px', fontFamily: 'Arial', fontStyle: 'bold', color: THEME.textPrimary,
    });

    // ── Tab bar ────────────────────────────────────────────────────────────
    const makeTab = (label, name, x) => {
      const btn = this.add.text(x, -155, label, {
        fontSize: '12px', fontFamily: 'Arial', color: THEME.textAccent,
        backgroundColor: THEME.btnBg, padding: { x: 20, y: 7 },
      }).setOrigin(0.5, 0.5).setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => this._setTab(name));
      c.add(btn);
      return btn;
    };
    this._tabGameBtn    = makeTab(t('settings.tab_game'),       'game',      -165);
    this._tabSoundBtn   = makeTab(t('settings.tab_sound'),      'sound',      -55);
    this._tabLayoutBtn  = makeTab(t('settings.tab_layout'),     'layout',      55);
    this._tabIndBtn     = makeTab(t('indicators.button_label'), 'indicators', 165);
    sep(null, -130);

    // ── Tab content groups ──────────────────────────────────────────────────
    this._settingsGroup   = this.add.container(0, 0);
    this._soundGroup      = this.add.container(0, 0);
    this._layoutGroup     = this.add.container(0, 0);
    this._indicatorsGroup = this.add.container(0, 0);
    c.add(this._settingsGroup);
    c.add(this._soundGroup);
    c.add(this._layoutGroup);
    c.add(this._indicatorsGroup);
    this.indicatorsPanel.buildTabContent(this._indicatorsGroup);
    const sg = this._settingsGroup;
    const vg = this._soundGroup;

    // ══ SETTINGS TAB ═══════════════════════════════════════════════════════

    // Wind direction
    ltxt(sg, lx, -82, t('settings.wind_dir') + ':', {
      fontSize: '12px', fontFamily: 'Arial', color: THEME.textLabel,
    });
    this._addBtn(sg, 50, -82, '<', () => {
      this._baseWindDir = (this._baseWindDir - 15 + 360) % 360;
      this.mapData.wind.direction = this._baseWindDir;
      this._windDirTxt.setText(Math.round(this._baseWindDir) + '°');
      this._refreshWindHUD();
    }, { padding: { x: 14, y: 9 } });
    this._windDirTxt = txt(sg, 108, -82, Math.round(this._baseWindDir) + '°', {
      fontSize: '13px', fontFamily: 'Arial', color: THEME.textPrimary,
    });
    this._addBtn(sg, 165, -82, '>', () => {
      this._baseWindDir = (this._baseWindDir + 15 + 360) % 360;
      this.mapData.wind.direction = this._baseWindDir;
      this._windDirTxt.setText(Math.round(this._baseWindDir) + '°');
      this._refreshWindHUD();
    }, { padding: { x: 14, y: 9 } });

    // Wind speed
    ltxt(sg, lx, -40, t('settings.wind_speed') + ':', {
      fontSize: '12px', fontFamily: 'Arial', color: THEME.textLabel,
    });
    this._addBtn(sg, 50, -40, '<', () => {
      this.mapData.wind.speed = Math.max(5, this.mapData.wind.speed - 1);
      this._windSpdTxt.setText(this.mapData.wind.speed + ' kts');
      this._refreshWindHUD();
    }, { padding: { x: 14, y: 9 } });
    this._windSpdTxt = txt(sg, 108, -40, this.mapData.wind.speed + ' kts', {
      fontSize: '13px', fontFamily: 'Arial', color: THEME.textPrimary,
    });
    this._addBtn(sg, 165, -40, '>', () => {
      this.mapData.wind.speed = Math.min(25, this.mapData.wind.speed + 1);
      this._windSpdTxt.setText(this.mapData.wind.speed + ' kts');
      this._refreshWindHUD();
    }, { padding: { x: 14, y: 9 } });

    // Displacement
    sep(sg, -8);
    ltxt(sg, lx, 12, t('indicators.displacement') + ':', {
      fontSize: '12px', fontFamily: 'Arial', color: THEME.textLabel,
    });
    this._dispBtns = {};
    [
      { k: 'light',  lk: 'indicators.disp_light',  v: 0.8 },
      { k: 'medium', lk: 'indicators.disp_medium', v: 2.0 },
      { k: 'heavy',  lk: 'indicators.disp_heavy',  v: 5.0 },
    ].forEach((opt, i) => {
      const btn = this._addBtn(sg, 48 + i * 82, 38, t(opt.lk), () => {
        this.displacement = opt.v;
        this._refreshDispBtns();
      }, { fontSize: '13px', padding: { x: 12, y: 8 } });
      btn.off('pointerout');
      btn.on('pointerout', () => this._refreshDispBtns());
      this._dispBtns[opt.k] = btn;
    });
    this._refreshDispBtns();

    // Language
    sep(sg, 65);
    ltxt(sg, lx, 88, t('settings.language') + ':', {
      fontSize: '12px', fontFamily: 'Arial', color: THEME.textLabel,
    });
    this._addBtn(sg, 50, 88, 'ES', () => { setLanguage('es'); this.scene.restart(); }, { padding: { x: 14, y: 9 } });
    this._addBtn(sg, 100, 88, 'EN', () => { setLanguage('en'); this.scene.restart(); }, { padding: { x: 14, y: 9 } });

    // Tutorial replay
    sep(sg, 118);
    this._addBtn(sg, 0, 148, t('tutorial.replay'), () => {
      this._togglePause();
      this.tutorial.replay();
    }, { fontSize: '13px', color: THEME.textSub, padding: { x: 18, y: 11 } });

    // ══ LAYOUT TAB ═════════════════════════════════════════════════════════
    const lg = this._layoutGroup;
    const SLOT_ICONS = { TL: '↖', TR: '↗', CL: '←', CR: '→', BL: '↙', BR: '↘' };
    const SLOTS  = Object.keys(SLOT_ICONS);
    const slotBx = [-88, -52, -16, 20, 56, 92];

    ltxt(lg, lx, -20, t('layout.helm_row') + ':', {
      fontSize: '12px', fontFamily: 'Arial', color: THEME.textSub,
    });
    this._helmSlotBtns = {};
    SLOTS.forEach((s, i) => {
      const btn = this._addBtn(lg, slotBx[i] - 50, -20, SLOT_ICONS[s], () => {
        this.layoutManager.setHelm(s);
        this.layoutManager.applyToControllers(this.helm, this.mainsheet);
        this._refreshSlotBtns();
      }, { fontSize: '14px', padding: { x: 10, y: 7 } });
      btn.off('pointerout');
      btn.on('pointerout', () => this._refreshSlotBtns());
      this._helmSlotBtns[s] = btn;
    });

    ltxt(lg, lx, 42, t('layout.ms_row') + ':', {
      fontSize: '12px', fontFamily: 'Arial', color: THEME.textSub,
    });
    this._msSlotBtns = {};
    SLOTS.forEach((s, i) => {
      const btn = this._addBtn(lg, slotBx[i] - 50, 42, SLOT_ICONS[s], () => {
        this.layoutManager.setMainsheet(s);
        this.layoutManager.applyToControllers(this.helm, this.mainsheet);
        this._refreshSlotBtns();
      }, { fontSize: '14px', padding: { x: 10, y: 7 } });
      btn.off('pointerout');
      btn.on('pointerout', () => this._refreshSlotBtns());
      this._msSlotBtns[s] = btn;
    });
    this._refreshSlotBtns();

    // ══ SOUND TAB ══════════════════════════════════════════════════════════

    const VOL_CATS = [
      { cat: 'master',  lk: 'settings.vol_master'  },
      { cat: 'water',   lk: 'settings.vol_water'   },
      { cat: 'luff',    lk: 'settings.vol_luff'    },
      { cat: 'effects', lk: 'settings.vol_effects' },
    ];
    this._volTxts = {};
    VOL_CATS.forEach(({ cat, lk }, i) => {
      const ry = -75 + i * 55;
      ltxt(vg, lx, ry, t(lk) + ':', {
        fontSize: '12px', fontFamily: 'Arial', color: THEME.textLabel,
      });
      this._addBtn(vg, 40, ry, '<', () => {
        this.audio.setVol(cat, this.audio.getVol(cat) - 0.05);
        this._refreshVolRows();
      }, { padding: { x: 14, y: 9 } });
      this._volTxts[cat] = txt(vg, 108, ry, '', {
        fontSize: '13px', fontFamily: 'Arial', color: THEME.textPrimary,
      });
      this._addBtn(vg, 175, ry, '>', () => {
        this.audio.setVol(cat, this.audio.getVol(cat) + 0.05);
        this._refreshVolRows();
      }, { padding: { x: 14, y: 9 } });
    });
    this._refreshVolRows();

    // ══ BOTTOM (always visible) ════════════════════════════════════════════
    sep(null, 178);
    this._addBtn(c, -155, 200, t('pause.restart'), () => this._restartMap(), {
      fontSize: '14px', color: THEME.restartText, padding: { x: 14, y: 10 },
    });
    this._addBtn(c, 0, 200, t('pause.resume'), () => this._togglePause(), {
      fontSize: '14px', color: THEME.textAccent, bg: THEME.btnBgDark, padding: { x: 14, y: 10 },
    });
    this._addBtn(c, 155, 200, '← ' + t('pause.menu'), () => {
      this.scene.start('MenuScene');
    }, { fontSize: '14px', color: THEME.textSoft, padding: { x: 14, y: 10 } });

    this._setTab('game');
  }

  // Shared button factory used by pause panel and HUD
  _addBtn(container, x, y, label, onClick, opts = {}) {
    const color = opts.color ?? THEME.textAccent;
    const btn   = this.add.text(x, y, label, {
      fontSize:        opts.fontSize ?? '14px',
      fontFamily:      'Arial',
      color,
      backgroundColor: opts.bg ?? THEME.btnBgDark,
      padding:         opts.padding ?? { x: 9, y: 6 },
    }).setOrigin(opts.ox ?? 0.5, opts.oy ?? 0.5)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerover',  () => btn.setColor(THEME.textPrimary));
    btn.on('pointerout',   () => btn.setColor(color));
    btn.on('pointerdown',  onClick);
    if (container) container.add(btn);
    return btn;
  }

  _togglePause() {
    this.isPaused = !this.isPaused;
    this.pausePanel.setVisible(this.isPaused);
    this.inputManager.enabled = !this.isPaused;
    this.pauseBtn.setVisible(!this.isPaused);
    if (this.isPaused) this.audio.suspend(); else this.audio.resume();
  }

  _setTab(name) {
    this._settingsGroup.setVisible(name === 'game');
    this._soundGroup.setVisible(name === 'sound');
    this._layoutGroup.setVisible(name === 'layout');
    this._indicatorsGroup.setVisible(name === 'indicators');
    const activeCol = THEME.textAccent, inactiveCol = THEME.textDim;
    const activeBg  = THEME.btnBg,     inactiveBg  = THEME.btnBgDark;
    for (const [btn, tab] of [
      [this._tabGameBtn,   'game'],
      [this._tabSoundBtn,  'sound'],
      [this._tabLayoutBtn, 'layout'],
      [this._tabIndBtn,    'indicators'],
    ]) {
      btn.setColor(name === tab ? activeCol : inactiveCol)
         .setBackgroundColor(name === tab ? activeBg : inactiveBg);
    }
  }

  _refreshVolRows() {
    if (!this._volTxts || !this.audio) return;
    for (const [cat, textObj] of Object.entries(this._volTxts)) {
      textObj.setText(Math.round(this.audio.getVol(cat) * 100) + '%');
    }
  }

  _restartMap() {
    const map = this.mapData;
    this.boatHeading  = map.startHeading;
    this.boatSpeed    = 0;
    this.boatPosition = { x: map.startPosition.x, y: map.startPosition.y };
    this.boatContainer.setPosition(map.startPosition.x, map.startPosition.y);
    this.boatContainer.setAngle(map.startHeading);
    this.wakePoints = [];
    this.physics    = new SailingPhysics();

    this._timerMs      = 0;
    this._timerRunning = true;
    this.hudTimer.setText('0.0s');

    this.objectiveTracker.reset();
    this._completionShown = false;
    this.isFailed         = false;
    this.completionBanner.setVisible(false);
    this.failurePanel.setVisible(false);
    this.brokenGraphics.setVisible(false);
    this._rebuildBuoyVisuals();

    // Reset notification state
    this.notifSystem._state    = 'idle';
    this.notifSystem._queue    = [];
    this.notifSystem._elapsed  = 0;
    this.notifSystem._silentFor = 0;
    this.notifSystem.container.setAlpha(0);

    // Always return to playing state
    this.isPaused = false;
    this.pausePanel.setVisible(false);
    this.pauseBtn.setVisible(true);
    this.inputManager.enabled = true;
    this.audio.resume();
  }

  _formatTime(ms) {
    const tenths = Math.floor(ms / 100);
    const min    = Math.floor(tenths / 600);
    const sec    = Math.floor((tenths % 600) / 10);
    const dec    = tenths % 10;
    return min > 0
      ? `${min}:${String(sec).padStart(2, '0')}.${dec}`
      : `${sec}.${dec}s`;
  }

  _getPointOfSail(absAWA) {
    if (absAWA < CONSTANTS.NO_GO_ZONE_DEG) return { key: 'pos.in_irons', color: THEME.posIrons };
    if (absAWA < 60)  return { key: 'pos.close_hauled', color: THEME.posCloseHauled };
    if (absAWA < 90)  return { key: 'pos.close_reach',  color: THEME.posCloseReach  };
    if (absAWA < 120) return { key: 'pos.beam_reach',   color: THEME.posBeamReach   };
    if (absAWA < 150) return { key: 'pos.broad_reach',  color: THEME.posBroadReach  };
    return               { key: 'pos.running',          color: THEME.posRunning      };
  }

  _updateObjectiveArrow(time) {
    const g = this.objectiveArrow;
    g.clear();
    if (this.objectiveTracker.complete) return;

    const map   = this.mapData;
    const buoys = map.buoys;
    let targetX, targetY;

    if (buoys.length === 0 && map.docks.length > 0) {
      // Mapa de atraque → apuntar al muelle
      const dock = map.docks[0];
      targetX = dock.x + dock.width  / 2;
      targetY = dock.y + dock.height / 2;
    } else if (this.objectiveTracker.nextBuoyIndex < buoys.length) {
      // Próxima boya
      const buoy = buoys[this.objectiveTracker.nextBuoyIndex];
      targetX = buoy.x;
      targetY = buoy.y;
    } else {
      // Todas las boyas rodeadas → apuntar a la zona de largada
      const zone = map.startZone;
      if (!zone) return;
      targetX = zone.x + zone.width  / 2;
      targetY = zone.y + zone.height / 2;
    }

    const bx   = this.boatPosition.x;
    const by   = this.boatPosition.y;
    const dx   = targetX - bx;
    const dy   = targetY - by;
    const dist = Math.hypot(dx, dy);
    if (dist < 20) return;  // ya estamos encima, no dibujar

    const nx = dx / dist;
    const ny = dy / dist;
    // Perpendicular (apunta a la izquierda de la dirección)
    const px = -ny;
    const py =  nx;

    // Posición del tip: 105 px del barco + bounce ±5% para simular movimiento
    const R      = 105;
    const bounce = Math.sin(time * 0.006) * R * 0.05;
    const tipX   = bx + nx * (R + bounce);
    const tipY   = by + ny * (R + bounce);
    // Triángulo: 20 px de largo, 8 px de semiancho (más puntiagudo)
    const bLen = 20, bHalf = 8;
    const bCX  = tipX - nx * bLen;
    const bCY  = tipY - ny * bLen;

    // Alpha pulsante suave
    const alpha = 0.55 + 0.35 * Math.sin(time * 0.004);

    g.fillStyle(0x44eeff, alpha);
    g.fillTriangle(
      tipX,                tipY,                // vértice → tip
      bCX + px * bHalf,   bCY + py * bHalf,    // base izquierda
      bCX - px * bHalf,   bCY - py * bHalf,    // base derecha
    );

    // Contorno fino para que se vea sobre el agua clara
    g.lineStyle(1.2, 0xffffff, alpha * 0.6);
    g.strokeTriangle(
      tipX,                tipY,
      bCX + px * bHalf,   bCY + py * bHalf,
      bCX - px * bHalf,   bCY - py * bHalf,
    );
  }

  _drawWindArrow(windDir) {
    const g  = this.windArrowGfx;
    const cx = this.scale.width - 44;
    const cy = 54;
    const r  = 26;

    g.clear();
    g.fillStyle(0x0a1628, 0.78);
    g.fillCircle(cx, cy, r + 2);
    g.lineStyle(1, THEME.panelBorderAlt, 1);
    g.strokeCircle(cx, cy, r + 2);

    const a  = Phaser.Math.DegToRad(windDir - 90);
    const tx = cx + Math.cos(a) * r * 0.80;
    const ty = cy + Math.sin(a) * r * 0.80;
    const bx = cx - Math.cos(a) * r * 0.48;
    const by = cy - Math.sin(a) * r * 0.48;
    const pa = a + Math.PI / 2;

    g.lineStyle(2.5, 0xff7744, 1);
    g.lineBetween(bx, by, tx, ty);
    g.fillStyle(0xff7744, 1);
    g.fillTriangle(tx, ty,
      bx + Math.cos(pa) * 6, by + Math.sin(pa) * 6,
      bx - Math.cos(pa) * 6, by - Math.sin(pa) * 6);
  }

  _windHUDString() {
    return `${t('hud.wind_speed')}: ${this.mapData.wind.speed} kts  ${t('hud.wind_from')}: ${Math.round(this.mapData.wind.direction)}°`;
  }

  _refreshWindHUD() {
    this.hudWind.setText(this._windHUDString());
  }

  _refreshDispBtns() {
    const classes = CONSTANTS.DISPLACEMENT;
    [['light', classes.light.value], ['medium', classes.medium.value], ['heavy', classes.heavy.value]]
      .forEach(([k, v]) => {
        this._dispBtns[k]?.setColor(Math.abs(this.displacement - v) < 0.1 ? THEME.goldBright : THEME.textAccent);
      });
  }

  _refreshSlotBtns() {
    const active = THEME.goldBright, idle = THEME.textAccent;
    ['TL', 'TR', 'CL', 'CR', 'BL', 'BR'].forEach(s => {
      this._helmSlotBtns[s]?.setColor(s === this.layoutManager.helmSlot ? active : idle);
      this._msSlotBtns[s]?.setColor(s === this.layoutManager.msSlot     ? active : idle);
    });
  }

  // ── Failure panel ──────────────────────────────────────────────────────────

  _buildFailurePanel() {
    const W = this.scale.width, H = this.scale.height;
    this.failurePanel = this.add.container(W / 2, H / 2).setDepth(62).setVisible(false);
    const c  = this.failurePanel;
    const PW = 420, PH = 260;

    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.36);
    dim.fillRect(-W / 2, -H / 2, W, H);
    c.add(dim);

    const bg = this.add.graphics();
    bg.fillStyle(THEME.failureBg, 0.48);
    bg.fillRoundedRect(-PW / 2, -PH / 2, PW, PH, 14);
    bg.lineStyle(2, THEME.failureBorder, 1);
    bg.strokeRoundedRect(-PW / 2, -PH / 2, PW, PH, 14);
    c.add(bg);

    const title = this.add.text(0, -PH / 2 + 40, t('fail.title'), {
      fontSize: '26px', fontFamily: 'Arial', fontStyle: 'bold',
      color: THEME.failureText, stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);
    c.add(title);

    this._failReasonTxt = this.add.text(0, -PH / 2 + 86, '', {
      fontSize: '15px', fontFamily: 'Arial', color: '#ffaaaa',
      stroke: '#000000', strokeThickness: 2,
      wordWrap: { width: PW - 48 },
    }).setOrigin(0.5);
    c.add(this._failReasonTxt);

    this._failObjectiveTxt = this.add.text(0, -PH / 2 + 118, '', {
      fontSize: '12px', fontFamily: 'Arial', color: THEME.textSoft,
      stroke: '#000000', strokeThickness: 2,
      wordWrap: { width: PW - 48 },
    }).setOrigin(0.5);
    c.add(this._failObjectiveTxt);

    this._failTimeTxt = this.add.text(0, -PH / 2 + 150, '', {
      fontSize: '14px', fontFamily: 'Arial', color: THEME.textLabel,
    }).setOrigin(0.5);
    c.add(this._failTimeTxt);

    this._addBtn(c, 0, PH / 2 - 38, t('fail.restart'), () => this._restartMap(), {
      fontSize: '16px', color: THEME.restartText,
    });
  }

  _triggerFailure(type) {
    if (this.isFailed || this._completionShown) return;
    this.isFailed = true;
    this.isPaused = true;
    this.inputManager.enabled = false;
    this.pauseBtn.setVisible(false);
    this.pausePanel.setVisible(false);

    const reasonKey = type === 'island' ? 'fail.hit_island'
                    : type === 'dock'   ? 'fail.hit_dock'
                    :                     'fail.hit_buoy';

    this._failReasonTxt.setText(t(reasonKey));
    this._failObjectiveTxt.setText(t('fail.objective_was') + ': ' + t(this.mapData.objectiveKey));

    this._timerRunning = false;
    this._failTimeTxt.setText(`⏱ ${this._formatTime(this._timerMs)}  💨 ${this.mapData.wind.speed} kts · ${Math.round(this.mapData.wind.direction)}°`);
    this.brokenGraphics.setVisible(true);
    this.failurePanel.setVisible(true);

    this.audio.playCollision();
    this.time.delayedCall(600, () => this.audio.suspend());
    if (navigator.vibrate) navigator.vibrate([60, 30, 60]);
  }

  _pointInPolygon(px, py, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }

  // ── Completion banner ──────────────────────────────────────────────────────

  _buildCompletionBanner() {
    const W = this.scale.width, H = this.scale.height;
    this.completionBanner = this.add.container(W / 2, H / 2).setDepth(60).setVisible(false);
    const c  = this.completionBanner;
    const PW = 360, PH = 200;

    // Dim overlay
    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.70);
    dim.fillRect(-W / 2, -H / 2, W, H);
    c.add(dim);

    // Panel
    const bg = this.add.graphics();
    bg.fillStyle(THEME.panelBgDark, 0.97);
    bg.fillRoundedRect(-PW / 2, -PH / 2, PW, PH, 14);
    bg.lineStyle(1, THEME.panelBorderAlt, 1);
    bg.strokeRoundedRect(-PW / 2, -PH / 2, PW, PH, 14);
    c.add(bg);

    const title = this.add.text(0, -PH / 2 + 40, t('complete.title'), {
      fontSize: '30px', fontFamily: 'Arial', fontStyle: 'bold',
      color: THEME.completionText, stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);
    c.add(title);

    this._completionTimeTxt = this.add.text(0, -PH / 2 + 90, '', {
      fontSize: '22px', fontFamily: 'Arial', fontStyle: 'bold',
      color: THEME.textPrimary, stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5);
    c.add(this._completionTimeTxt);

    const windInfo = this.add.text(0, -PH / 2 + 120, '', {
      fontSize: '12px', fontFamily: 'Arial', color: THEME.textLabel,
    }).setOrigin(0.5);
    windInfo.setText(`💨 ${this.mapData.wind.speed} kts · ${Math.round(this.mapData.wind.direction)}°`);
    c.add(windInfo);

    this._addBtn(c, -70, PH / 2 - 38, t('pause.restart'), () => this._restartMap(), {
      fontSize: '15px', color: THEME.textAccent,
    });
    this._addBtn(c, 85, PH / 2 - 38, '← ' + t('pause.menu'), () => {
      this.scene.start('MenuScene');
    }, { fontSize: '15px', color: THEME.textSoft });
  }

  _showCompletion() {
    this._timerRunning = false;
    this._completionTimeTxt.setText(`⏱ ${this._formatTime(this._timerMs)}`);
    this.completionBanner.setVisible(true);
    this.audio.playCompletion();
    this.isPaused = true;
    this.time.delayedCall(1800, () => this.audio.suspend());
    this.pausePanel.setVisible(false);
    this.pauseBtn.setVisible(false);
    this.inputManager.enabled = false;
  }

  // ── HUD ────────────────────────────────────────────────────────────────────

  _buildHUD() {
    const style = {
      fontSize: '14px', fontFamily: 'Arial',
      color: THEME.textPrimary, stroke: '#000000', strokeThickness: 3,
    };

    this.hudSpeed   = this.add.text(12, 12, '', style).setScrollFactor(0).setDepth(20);
    this.hudHeading = this.add.text(12, 32, '', style).setScrollFactor(0).setDepth(20);
    this.hudPos     = this.add.text(12, 52, '', {
      ...style, fontSize: '12px',
    }).setScrollFactor(0).setDepth(20);

    // Wind speed text (top-right, above compass)
    const windStyle = { fontSize: '12px', fontFamily: 'Arial', color: '#99ddff', stroke: '#000000', strokeThickness: 2 };
    this.hudWind = this.add.text(
      this.scale.width - 10, 10,
      this._windHUDString(),
      windStyle,
    ).setOrigin(1, 0).setScrollFactor(0).setDepth(20);

    // Wind compass arrow Graphics (redrawn each frame)
    this.windArrowGfx = this.add.graphics().setDepth(20);

    // In-irons warning (center, hidden by default)
    this.hudIrons = this.add.text(
      this.scale.width / 2, this.scale.height / 2 - 40,
      t('irons.label'),
      { fontSize: '18px', fontFamily: 'Arial', fontStyle: 'bold',
        color: THEME.failureText, stroke: '#000000', strokeThickness: 4,
        backgroundColor: '#1a0000', padding: { x: 12, y: 6 } },
    ).setOrigin(0.5).setScrollFactor(0).setDepth(25).setVisible(false);

    // Pause button (top-center)
    this.pauseBtn = this.add.text(this.scale.width / 2 - 35, 10, '⏸', {
      fontSize: '22px', fontFamily: 'Arial', color: '#888888',
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(20)
      .setInteractive({
        hitArea: new Phaser.Geom.Rectangle(-22, -8, 44, 44),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true,
      });
    this.pauseBtn.on('pointerover',  () => this.pauseBtn.setColor(THEME.textPrimary));
    this.pauseBtn.on('pointerout',   () => this.pauseBtn.setColor('#888888'));
    this.pauseBtn.on('pointerdown',  () => this._togglePause());

    // Objective text (bottom-left)
    this.hudObjective = this.add.text(this.scale.width / 2, this.scale.height - 10, t(this.mapData.objectiveKey), {
      fontSize: '11px', fontFamily: 'Arial', color: THEME.textSoft,
      stroke: '#000000', strokeThickness: 2,
      wordWrap: { width: 500 },
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(20);

    // Timer (top-left, below pos)
    this.hudTimer = this.add.text(12, 72, '0.0s', {
      fontSize: '13px', fontFamily: 'Arial',
      color: THEME.textLabel, stroke: '#000000', strokeThickness: 2,
    }).setScrollFactor(0).setDepth(20);

    this._timerMs      = 0;
    this._timerRunning = true;

    this.uiGroup.add(this.hudSpeed);
    this.uiGroup.add(this.hudHeading);
    this.uiGroup.add(this.hudPos);
    this.uiGroup.add(this.hudTimer);
    this.uiGroup.add(this.hudWind);
    this.uiGroup.add(this.windArrowGfx);
    this.uiGroup.add(this.hudIrons);
    this.uiGroup.add(this.pauseBtn);
    this.uiGroup.add(this.hudObjective);
  }
}
