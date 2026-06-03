// ── MainsheetController ────────────────────────────────────────────────────────
// Rope widget for sail trim. Two SVG states crossfade as trim changes.
// Drag DOWN = trim in (0°). Drag UP = ease out (85°).
// Call loadRopeTextures(scene) in GameScene.preload() before this is constructed.

// ── SVG definitions ───────────────────────────────────────────────────────────

const ROPE_TAUT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 100">
  <rect x="17" y="5" width="6" height="76" fill="#8B6343" rx="3"/>
  <line x1="14" y1="18" x2="26" y2="28" stroke="#5C3D1E" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="14" y1="33" x2="26" y2="43" stroke="#5C3D1E" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="14" y1="48" x2="26" y2="58" stroke="#5C3D1E" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="14" y1="63" x2="26" y2="73" stroke="#5C3D1E" stroke-width="1.5" stroke-linecap="round"/>
</svg>`;

const ROPE_EASED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 100">
  <path d="M20,18 Q32,30 20,42 Q8,54 20,66 Q32,78 20,86"
        stroke="#8B6343" stroke-width="10" fill="none"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

// Call in GameScene.preload()
function loadRopeTextures(scene) {
  const toURI = svg => 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
  scene.load.image('rope-taut',  toURI(ROPE_TAUT_SVG));
  scene.load.image('rope-eased', toURI(ROPE_EASED_SVG));
}

// ── Controller class ──────────────────────────────────────────────────────────

class MainsheetController {
  // Panel: 70px wide × 160px tall, anchored at center (cx, cy)
  static PANEL_W      = 70;
  static PANEL_H      = 160;
  static DRAG_RANGE   = 80;   // px for full 0°–85° sweep

  constructor(scene, cx, cy) {
    this.scene           = scene;
    this.trimAngle       = 42.5;  // degrees 0–85
    this._dragStartY     = null;
    this._trimAtDragStart = 42.5;

    this._cx = cx;
    this._cy = cy;
    this._build(cx, cy);
  }

  _build(cx, cy) {
    const W = MainsheetController.PANEL_W;
    const H = MainsheetController.PANEL_H;
    this.container = this.scene.add.container(cx, cy);

    // Background panel
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.55);
    bg.fillRoundedRect(-W / 2, -H / 2, W, H, 10);
    bg.lineStyle(1, 0x3a3a5e, 0.8);
    bg.strokeRoundedRect(-W / 2, -H / 2, W, H, 10);

    // Rope images (stacked, crossfaded)
    // Rope area: from y=-H/2+8 to about y=+10, rendered at 40×100 px
    this.tautImg  = this.scene.add.image(0, -28, 'rope-taut').setOrigin(0.5, 0.5);
    this.easedImg = this.scene.add.image(0, -28, 'rope-eased').setOrigin(0.5, 0.5);

    // Cleat handle (moves up/down with trim)
    this.handle = this.scene.add.graphics();
    this._drawHandle();

    // Trim label below rope
    this.label = this.scene.add.text(0, H / 2 - 20, '', {
      fontSize: '11px', fontFamily: 'Arial', fontStyle: 'bold',
      color: '#ccddff', align: 'center',
    }).setOrigin(0.5, 0.5);

    this.container.add([bg, this.tautImg, this.easedImg, this.handle, this.label]);
    this._updateVisuals();
  }

  _drawHandle() {
    const g = this.handle;
    g.clear();
    const hy = this._handleY();
    g.fillStyle(0x8B6343, 1);
    g.fillCircle(0, hy, 11);
    g.lineStyle(2, 0xC9A84C, 1);
    g.strokeCircle(0, hy, 11);
    // Grip lines
    g.lineStyle(1.5, 0x5C3D1E, 0.8);
    g.lineBetween(-6, hy - 3, 6, hy - 3);
    g.lineBetween(-6, hy,     6, hy);
    g.lineBetween(-6, hy + 3, 6, hy + 3);
  }

  _handleY() {
    // trim=0 (cazada) → handle near bottom; trim=85 (filada) → handle near top
    const topY    = -68;
    const bottomY =  12;
    return bottomY - (this.trimAngle / 85) * (bottomY - topY);
  }

  _updateVisuals() {
    const t = this.trimAngle / 85;
    this.tautImg.setAlpha(1 - t);
    this.easedImg.setAlpha(t);
    this._drawHandle();
  }

  updateLabel(trimStatus) {
    this.label.setText(t('trim.' + trimStatus));
  }

  hitTest(sx, sy) {
    const W = MainsheetController.PANEL_W + 20;  // generous touch target
    const H = MainsheetController.PANEL_H + 20;
    return Math.abs(sx - this._cx) <= W / 2 && Math.abs(sy - this._cy) <= H / 2;
  }

  onDown(ptr) {
    this._dragStartY     = ptr.y;
    this._trimAtDragStart = this.trimAngle;
  }

  onMove(ptr) {
    const dy    = ptr.y - this._dragStartY;
    const delta = -(dy / MainsheetController.DRAG_RANGE) * 85;
    this.trimAngle = Phaser.Math.Clamp(this._trimAtDragStart + delta, 0, 85);
    this._updateVisuals();
    return this.trimAngle;
  }

  onUp() {
    this._dragStartY = null;
  }

  setPosition(cx, cy) {
    this._cx = cx;
    this._cy = cy;
    this.container.setPosition(cx, cy);
  }
}
