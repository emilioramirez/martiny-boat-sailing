// ── HelmController ─────────────────────────────────────────────────────────────
// Tiller widget. Horizontal drag moves the tiller left/right.
// Springs back to center on release. Max ±90° maps to ±60° visual tiller sweep.

// No-op kept for compatibility with GameScene.preload()
function loadHelmTexture(scene) {}

// ── Controller class ──────────────────────────────────────────────────────────

class HelmController {
  // Panel: 130px wide × 150px tall, anchored at center (cx, cy)
  static PANEL_W     = 130;
  static PANEL_H     = 150;
  static SPRING_RATE = 3.0;   // helm angle decays at 3×/s when released
  static SENSITIVITY = 1.4;   // px of horizontal drag per degree of helm

  constructor(scene, cx, cy) {
    this.scene       = scene;
    this.helmAngle   = 0;   // degrees, -90 to +90
    this._isDragging = false;
    this._prevX      = null;
    this._isDesktop  = scene.sys.game.device.os.desktop;
    this._cx = cx;
    this._cy = cy;
    this._build(cx, cy);
  }

  _build(cx, cy) {
    const W = HelmController.PANEL_W;
    const H = HelmController.PANEL_H;
    this.container = this.scene.add.container(cx, cy);

    // Background panel
    const bg = this.scene.add.graphics();
    bg.fillStyle(THEME.panelBg, 0.55);
    bg.fillRoundedRect(-W / 2, -H / 2, W, H, 10);
    bg.lineStyle(1, THEME.panelBorder, 0.8);
    bg.strokeRoundedRect(-W / 2, -H / 2, W, H, 10);

    // Panel title
    const titleLbl = this.scene.add.text(0, -H / 2 + 12, t('helm.label'), {
      fontSize: '10px', fontFamily: 'Arial', fontStyle: 'bold', color: THEME.textDim,
    }).setOrigin(0.5, 0.5);

    // PORT / STBD labels — at mid-panel, flanking the tiller arc
    this.portLabel = this.scene.add.text(-W / 2 + 8, -8, t('helm.port'), {
      fontSize: '10px', fontFamily: 'Arial', fontStyle: 'bold', color: THEME.textLabel,
    }).setOrigin(0, 0.5);
    this.stbdLabel = this.scene.add.text(W / 2 - 8, -8, t('helm.starboard'), {
      fontSize: '10px', fontFamily: 'Arial', fontStyle: 'bold', color: THEME.textLabel,
    }).setOrigin(1, 0.5);

    // Mini-boat silhouette (fixed, drawn once) — in the lower half of the panel
    this.boatGfx = this.scene.add.graphics();
    this._drawMiniBoat();

    // Tiller graphic (redrawn every frame)
    this.tillerGfx = this.scene.add.graphics();

    this.container.add([bg, titleLbl, this.portLabel, this.stbdLabel,
                        this.boatGfx, this.tillerGfx]);
    this._updateVisuals();
  }

  _drawMiniBoat() {
    const g = this.boatGfx;
    g.clear();
    // Same proportions as the real hull (BOAT_HULL_LENGTH:60 / BOAT_HULL_WIDTH:18 = 3.33:1)
    // Centered at (0, +28): bow at top (y=+15), stern at bottom (y=+41) — pivot stays at 41
    const bx = 0, by = 28;
    const hl = 13, hw = 4;   // hw/hl = 0.31, matching real boat ratio
    const pts = [
      { x: bx,      y: by - hl },
      { x: bx + hw, y: by - hl * 0.3 },
      { x: bx + hw, y: by + hl * 0.7 },
      { x: bx,      y: by + hl },
      { x: bx - hw, y: by + hl * 0.7 },
      { x: bx - hw, y: by - hl * 0.3 },
    ];
    g.fillStyle(0xf5f0e0, 1);
    g.fillPoints(pts, true);
    g.lineStyle(1, 0x888888, 0.6);
    g.strokePoints(pts, true);
  }

  _updateVisuals() {
    const g = this.tillerGfx;
    g.clear();

    // Pivot at stern (0, +41). Tiller extends UPWARD into the cockpit (toward bow).
    // helmAngle ±90 → sweep ±60° from straight-up (-90°).
    // Drag right → helmAngle > 0 → tiller handle goes right → boat turns port.
    const pivotX = 0, pivotY = 41;
    const sweep  = this.helmAngle * (60 / 90);
    const rad    = Phaser.Math.DegToRad(-90 + sweep);
    const len    = 55;
    const tipX   = pivotX + Math.cos(rad) * len;
    const tipY   = pivotY + Math.sin(rad) * len;

    // Faint arc showing range of motion
    g.lineStyle(1, 0x334455, 0.5);
    g.beginPath();
    g.arc(pivotX, pivotY, len, Phaser.Math.DegToRad(-150), Phaser.Math.DegToRad(-30));
    g.strokePath();

    // Tiller shaft
    g.lineStyle(5, 0x3D2B1F, 1);
    g.lineBetween(pivotX, pivotY, tipX, tipY);

    // Pivot cap
    g.fillStyle(0x222222, 1);
    g.fillCircle(pivotX, pivotY, 5);

    // Grab handle
    g.fillStyle(THEME.gold, 1);
    g.fillCircle(tipX, tipY, 8);
    g.lineStyle(1.5, 0x8B5E0A, 1);
    g.strokeCircle(tipX, tipY, 8);

    // Highlight PORT/STBD
    const dim = THEME.textLabel, bright = THEME.textPrimary;
    if (this.helmAngle < -5) {
      this.portLabel.setColor(bright);
      this.stbdLabel.setColor(dim);
    } else if (this.helmAngle > 5) {
      this.portLabel.setColor(dim);
      this.stbdLabel.setColor(bright);
    } else {
      this.portLabel.setColor(dim);
      this.stbdLabel.setColor(dim);
    }
  }

  // Called every frame from GameScene.update(). Returns rudderAxis [-1,+1].
  // On desktop the tiller holds its position; on mobile it springs back to center.
  update(dt) {
    if (!this._isDesktop && !this._isDragging && Math.abs(this.helmAngle) > 0.2) {
      this.helmAngle -= this.helmAngle * HelmController.SPRING_RATE * dt;
      if (Math.abs(this.helmAngle) <= 0.2) this.helmAngle = 0;
      this._updateVisuals();
    }
    return -this.helmAngle / 90;
  }

  hitTest(sx, sy) {
    const W = HelmController.PANEL_W + 20;
    const H = HelmController.PANEL_H + 20;
    return Math.abs(sx - this._cx) <= W / 2 && Math.abs(sy - this._cy) <= H / 2;
  }

  onDown(ptr) {
    this._isDragging = true;
    this._prevX      = ptr.x;
  }

  onMove(ptr) {
    if (this._prevX === null) {
      this._prevX = ptr.x;
      return this.helmAngle / 90;
    }
    const dx = ptr.x - this._prevX;
    this.helmAngle = Phaser.Math.Clamp(
      this.helmAngle + dx * HelmController.SENSITIVITY,
      -90, 90,
    );
    this._prevX = ptr.x;
    this._updateVisuals();
    return -this.helmAngle / 90;
  }

  onUp() {
    this._isDragging = false;
    this._prevX      = null;
  }

  setPosition(cx, cy) {
    this._cx = cx;
    this._cy = cy;
    this.container.setPosition(cx, cy);
  }
}
