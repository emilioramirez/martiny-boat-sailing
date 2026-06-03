// ── IndicatorsPanel ───────────────────────────────────────────────────────────
// Floating toggle panel + world-space vector overlays + mini-map.
// All state persisted to localStorage under 'sailsim_indicators'.

class IndicatorsPanel {
  constructor(scene, worldGroup, uiGroup, map) {
    this.scene = scene;
    this._map  = map;
    this._s    = { windVector: false, heading: false, velocity: true, inertia: true, minimap: true };
    this._load();

    // World-space Graphics (vector arrows + inertia bars — scroll with camera)
    this.overlayGfx = scene.add.graphics();
    worldGroup.add(this.overlayGfx);

    // World-space text for inertia labels
    const ts = { fontSize: '9px', fontFamily: 'Arial', color: '#aaccdd',
                 stroke: '#000000', strokeThickness: 2 };
    this._iTgtLbl = scene.add.text(0, 0, '', ts).setVisible(false);
    this._iCurLbl = scene.add.text(0, 0, '', ts).setVisible(false);
    worldGroup.add(this._iTgtLbl);
    worldGroup.add(this._iCurLbl);

    // UI-space mini-map (fixed overlay)
    this.mmGfx = scene.add.graphics().setDepth(22);
    uiGroup.add(this.mmGfx);

    // Panel + toggle button (UI space)
    this._buildPanel();
    this._buildToggleBtn();
    uiGroup.add(this.panel);
    uiGroup.add(this.toggleBtn);

    // Velocity direction tracking (from position delta)
    this._prevPos = null;
    this._velDir  = 0; // degrees, heading convention
  }

  setMap(map) { this._map = map; }

  // Called every frame from GameScene.update()
  update(boatPos, boatHeading, boatSpeed, windDir, windSpeed, targetSpeed, objectiveTracker) {
    const bx = boatPos.x, by = boatPos.y;

    // Derive actual movement direction from position delta
    if (this._prevPos) {
      const dx = bx - this._prevPos.x, dy = by - this._prevPos.y;
      if (Math.hypot(dx, dy) > 0.3) {
        this._velDir = (Phaser.Math.RadToDeg(Math.atan2(dy, dx)) + 90 + 360) % 360;
      }
    }
    this._prevPos = { x: bx, y: by };

    const g = this.overlayGfx;
    g.clear();

    const s = this._s;
    if (s.windVector) this._windVec(g, bx, by, windDir, windSpeed);
    if (s.heading)    this._headingVec(g, bx, by, boatHeading);
    if (s.velocity)   this._velocityVec(g, bx, by, this._velDir, boatSpeed);
    if (s.inertia)    this._inertiaPanel(g, bx, by, boatSpeed, targetSpeed);
    if (!s.inertia) { this._iTgtLbl.setVisible(false); this._iCurLbl.setVisible(false); }

    this.mmGfx.clear();
    if (s.minimap && this._map) this._minimap(bx, by, boatHeading, objectiveTracker);
  }

  // ── Vector helpers ──────────────────────────────────────────────────────────

  // Draws a line + arrowhead from (bx,by) to (tx,ty) in the given color/alpha
  _arrow(g, color, alpha, bx, by, tx, ty) {
    const dx = tx - bx, dy = ty - by;
    const len = Math.hypot(dx, dy);
    if (len < 4) return;
    const nx = dx / len, ny = dy / len;
    const pa = Math.atan2(dy, dx) + Math.PI / 2;
    g.lineStyle(2, color, alpha);
    g.lineBetween(bx, by, tx, ty);
    g.fillStyle(color, alpha);
    g.fillTriangle(
      tx, ty,
      tx - nx * 9 + Math.cos(pa) * 4, ty - ny * 9 + Math.sin(pa) * 4,
      tx - nx * 9 - Math.cos(pa) * 4, ty - ny * 9 - Math.sin(pa) * 4,
    );
  }

  _windVec(g, bx, by, windDir, windSpeed) {
    const len = Math.min(windSpeed * 8, 120);
    const rad = Phaser.Math.DegToRad(windDir - 90); // toward wind source
    this._arrow(g, 0x99ccff, 0.9, bx, by, bx + Math.cos(rad) * len, by + Math.sin(rad) * len);
  }

  _headingVec(g, bx, by, heading) {
    const rad = Phaser.Math.DegToRad(heading - 90);
    this._arrow(g, 0xffffff, 0.8, bx, by, bx + Math.cos(rad) * 80, by + Math.sin(rad) * 80);
  }

  _velocityVec(g, bx, by, velDir, speed) {
    const len = Math.min(speed * 10, 100);
    if (len < 3) return;
    const rad = Phaser.Math.DegToRad(velDir - 90);
    this._arrow(g, 0x44ff88, 0.85, bx, by, bx + Math.cos(rad) * len, by + Math.sin(rad) * len);
  }

  _inertiaPanel(g, bx, by, speed, targetSpeed) {
    const px  = bx + 36, py = by - 50;
    const barW = 80;
    const ratio = targetSpeed > 0 ? speed / targetSpeed : 0;
    const fill  = Math.min(ratio, 1) * barW;
    const over  = ratio > 1; // actual > target — coasting on inertia

    // Background panel
    g.fillStyle(0x0a1628, 0.42);
    g.fillRoundedRect(px, py, barW + 16, 36, 5);

    // Bar track (dark — represents target = 100%)
    g.fillStyle(0x1a2e44, 0.50);
    g.fillRoundedRect(px + 8, py + 18, barW, 10, 3);

    // Bar fill — green when building up, amber when coasting above target
    if (fill > 0) {
      g.fillStyle(over ? 0xffaa22 : 0x44ff88, 0.45);
      g.fillRoundedRect(px + 8, py + 18, fill, 10, 3);
    }

    // Speed label: "4.2 / 8.0 kts"
    this._iTgtLbl.setVisible(false);
    this._iCurLbl.setPosition(px + 8, py + 5)
      .setText(`${speed.toFixed(1)} / ${targetSpeed.toFixed(1)} kts`)
      .setVisible(true);
  }

  // ── Mini-map ────────────────────────────────────────────────────────────────

  _minimap(bx, by, heading, objectiveTracker) {
    const map  = this._map;
    const mm   = 120;
    const mx   = 10, my = this.scene.scale.height / 2 - mm / 2; // center-left
    const scl  = mm / map.worldSize.width;
    const g    = this.mmGfx;

    // Background
    g.fillStyle(0x071020, 0.88);
    g.fillRoundedRect(mx - 2, my - 2, mm + 4, mm + 4, 6);
    g.lineStyle(1, 0x2a3a5e, 1);
    g.strokeRoundedRect(mx - 2, my - 2, mm + 4, mm + 4, 6);

    // Islands
    g.fillStyle(0x2a4a2a, 1);
    for (const isl of (map.islands || [])) {
      const pts = isl.points.map(p => ({ x: mx + p[0] * scl, y: my + p[1] * scl }));
      if (pts.length > 2) g.fillPoints(pts, true);
    }

    // Start zone — dashed line between posts
    if (map.startZone) {
      const sz = map.startZone;
      g.lineStyle(1, 0xffffff, 0.7);
      g.lineBetween(
        mx + sz.x * scl,              my + (sz.y + sz.height / 2) * scl,
        mx + (sz.x + sz.width) * scl, my + (sz.y + sz.height / 2) * scl,
      );
    }

    // Dock
    if (map.docks && map.docks.length > 0) {
      const d = map.docks[0];
      g.fillStyle(0x8a6a44, 1);
      g.fillRect(mx + d.x * scl, my + d.y * scl,
        Math.max(d.width * scl, 3), Math.max(d.height * scl, 3));
    }

    // Buoys (grey = done, orange = pending, bright = next target)
    const nextIdx = objectiveTracker ? objectiveTracker.nextBuoyIndex : 0;
    for (let i = 0; i < (map.buoys || []).length; i++) {
      const b   = map.buoys[i];
      const bxx = mx + b.x * scl, byy = my + b.y * scl;
      const col = i < nextIdx ? 0x555555 : (i === nextIdx ? 0xff8800 : 0xff6600);
      g.fillStyle(col, 1);
      g.fillCircle(bxx, byy, i === nextIdx ? 3.5 : 2.5);
    }

    // Boat dot + heading arrow
    const bmx = mx + bx * scl, bmy = my + by * scl;
    g.fillStyle(0xffffff, 1);
    g.fillCircle(bmx, bmy, 3);
    const hRad = Phaser.Math.DegToRad(heading - 90);
    g.lineStyle(1.5, 0xffffff, 1);
    g.lineBetween(bmx, bmy, bmx + Math.cos(hRad) * 7, bmy + Math.sin(hRad) * 7);
  }

  // ── Panel UI ────────────────────────────────────────────────────────────────

  _buildPanel() {
    const W = this.scene.scale.width, H = this.scene.scale.height;
    const PW = 240, PH = 210;

    this.panel = this.scene.add.container(W - PW - 8, H / 2 - PH / 2).setDepth(30).setVisible(false);
    const c = this.panel;

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0c1624, 0.96);
    bg.fillRoundedRect(0, 0, PW, PH, 10);
    bg.lineStyle(1, 0x2a4a6e, 1);
    bg.strokeRoundedRect(0, 0, PW, PH, 10);
    c.add(bg);

    c.add(this.scene.add.text(PW / 2, 12, t('indicators.panel_title'), {
      fontSize: '12px', fontFamily: 'Arial', fontStyle: 'bold', color: '#aaccdd',
    }).setOrigin(0.5, 0));

    const close = this.scene.add.text(PW - 10, 10, '✕', {
      fontSize: '13px', fontFamily: 'Arial', color: '#667788',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    close.on('pointerover', () => close.setColor('#ffffff'));
    close.on('pointerout',  () => close.setColor('#667788'));
    close.on('pointerdown', () => this.panel.setVisible(false));
    c.add(close);

    const rows = [
      { key: 'windVector', labelKey: 'indicators.wind_vector',  col: 0x99ccff },
      { key: 'heading',    labelKey: 'indicators.heading',       col: 0xdddddd },
      { key: 'velocity',   labelKey: 'indicators.velocity',      col: 0x44ff88 },
      { key: 'inertia',    labelKey: 'indicators.inertia',       col: 0xffcc44 },
      { key: 'minimap',    labelKey: 'indicators.minimap',       col: 0x88aadd },
    ];

    this._toggleBtns = {};
    rows.forEach((row, i) => {
      const ry = 36 + i * 33;

      const dot = this.scene.add.graphics();
      dot.fillStyle(row.col, 0.9);
      dot.fillCircle(14, ry + 8, 5);
      c.add(dot);

      c.add(this.scene.add.text(28, ry + 1, t(row.labelKey), {
        fontSize: '12px', fontFamily: 'Arial', color: '#bbccdd',
      }));

      const btn = this.scene.add.text(PW - 10, ry + 3, 'OFF', {
        fontSize: '11px', fontFamily: 'Arial', color: '#667788',
        backgroundColor: '#0d1a2a', padding: { x: 6, y: 3 },
      }).setOrigin(1, 0).setInteractive({ useHandCursor: true });

      btn.on('pointerdown', () => {
        this._s[row.key] = !this._s[row.key];
        this._refreshToggles();
        this._save();
        if (!this._s.inertia) {
          this._iTgtLbl.setVisible(false);
          this._iCurLbl.setVisible(false);
        }
        if (!this._s.minimap) this.mmGfx.clear();
      });

      c.add(btn);
      this._toggleBtns[row.key] = btn;
    });

    this._refreshToggles();
  }

  _buildToggleBtn() {
    const W = this.scene.scale.width, H = this.scene.scale.height;
    this.toggleBtn = this.scene.add.text(W - 10, H / 2, t('indicators.button_label'), {
      fontSize: '11px', fontFamily: 'Arial', color: '#88bbdd',
      backgroundColor: '#0d1a2a', padding: { x: 6, y: 3 },
    }).setOrigin(1, 0.5).setDepth(25).setInteractive({ useHandCursor: true });

    this.toggleBtn.on('pointerover', () => this.toggleBtn.setColor('#ffffff'));
    this.toggleBtn.on('pointerout',  () => this.toggleBtn.setColor('#88bbdd'));
    this.toggleBtn.on('pointerdown', () => this.panel.setVisible(!this.panel.visible));
  }

  _refreshToggles() {
    for (const [key, btn] of Object.entries(this._toggleBtns)) {
      const on = this._s[key];
      btn.setText(on ? 'ON' : 'OFF');
      btn.setColor(on ? '#44ffaa' : '#667788');
    }
  }

  _save() {
    try { localStorage.setItem('sailsim_indicators', JSON.stringify(this._s)); } catch (e) {}
  }

  _load() {
    try {
      const d = JSON.parse(localStorage.getItem('sailsim_indicators') || 'null');
      if (d) Object.assign(this._s, d);
    } catch (e) {}
  }
}
