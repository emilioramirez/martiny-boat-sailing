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
  // Panel: 95px wide × 185px tall, anchored at center (cx, cy)
  static PANEL_W    = 95;
  static PANEL_H    = 185;
  static DRAG_RANGE = 80;   // px for full trim sweep

  // Rope track bounds (local coords)
  static TRACK_TOP = -84;
  static TRACK_BOT =  54;

  constructor(scene, cx, cy) {
    this.scene            = scene;
    this.trimAngle        = 42.5;  // degrees 0–85
    this._dragStartY      = null;
    this._trimAtDragStart = 42.5;

    this._cx = cx;
    this._cy = cy;
    this._build(cx, cy);
  }

  _build(cx, cy) {
    const W  = MainsheetController.PANEL_W;
    const H  = MainsheetController.PANEL_H;
    const TT = MainsheetController.TRACK_TOP;
    const TB = MainsheetController.TRACK_BOT;
    this.container = this.scene.add.container(cx, cy);

    // ── Outer panel ────────────────────────────────────────────────────────────
    const bg = this.scene.add.graphics();
    bg.fillStyle(THEME.panelBg, 0.55);
    bg.fillRoundedRect(-W / 2, -H / 2, W, H, 10);
    bg.lineStyle(1, THEME.panelBorder, 0.8);
    bg.strokeRoundedRect(-W / 2, -H / 2, W, H, 10);

    // ── Rope track — dark inset, right half of panel ───────────────────────────
    const trackW = 44;
    const trackX = 16;  // center of track (shifted right to make room for labels)
    bg.fillStyle(THEME.trackBg, 0.95);
    bg.fillRoundedRect(trackX - trackW / 2, TT, trackW, TB - TT, 6);
    bg.lineStyle(1, THEME.panelBorder, 1);
    bg.strokeRoundedRect(trackX - trackW / 2, TT, trackW, TB - TT, 6);

    // ── Gauge labels — left side, aligned to track top/bottom ─────────────────
    const labelX   = -44;
    const tickEndX = trackX - trackW / 2 - 3;

    const deco = this.scene.add.graphics();
    deco.lineStyle(1, THEME.panelBorderAlt, 0.8);
    deco.lineBetween(labelX + 14, TT + 8, tickEndX, TT + 8);
    deco.lineBetween(labelX + 14, TB - 8, tickEndX, TB - 8);

    const filarLbl = this.scene.add.text(labelX, TT + 8, t('trim.label_ease'), {
      fontSize: '8px', fontFamily: 'Arial', fontStyle: 'bold', color: THEME.textDim,
    }).setOrigin(0, 0.5);

    const cazarLbl = this.scene.add.text(labelX, TB - 8, t('trim.label_trim'), {
      fontSize: '8px', fontFamily: 'Arial', fontStyle: 'bold', color: THEME.textDim,
    }).setOrigin(0, 0.5);

    // ── Rope images (stacked, crossfaded) ─────────────────────────────────────
    const ropeY = (TT + TB) / 2;
    const ropeH = TB - TT - 8;
    this.tautImg  = this.scene.add.image(trackX, ropeY, 'rope-taut')
      .setOrigin(0.5, 0.5).setDisplaySize(trackW - 8, ropeH);
    this.easedImg = this.scene.add.image(trackX, ropeY, 'rope-eased')
      .setOrigin(0.5, 0.5).setDisplaySize(trackW - 8, ropeH);

    // ── Handle (moves up/down with trim) ──────────────────────────────────────
    this.handle = this.scene.add.graphics();
    this._drawHandle();

    // ── Trim status label below track ─────────────────────────────────────────
    this.label = this.scene.add.text(trackX, H / 2 - 22, '', {
      fontSize: '11px', fontFamily: 'Arial', fontStyle: 'bold',
      color: THEME.textBright, align: 'center',
    }).setOrigin(0.5, 0.5);

    this.container.add([bg, deco, filarLbl, cazarLbl,
                        this.tautImg, this.easedImg, this.handle, this.label]);
    this._updateVisuals();
  }

  _drawHandle() {
    const g  = this.handle;
    g.clear();
    const hy = this._handleY();
    const hx = 16;  // matches trackX
    g.fillStyle(0x8B6343, 1);
    g.fillCircle(hx, hy, 11);
    g.lineStyle(2, THEME.gold, 1);
    g.strokeCircle(hx, hy, 11);
    g.lineStyle(1.5, 0x5C3D1E, 0.8);
    g.lineBetween(hx - 6, hy - 3, hx + 6, hy - 3);
    g.lineBetween(hx - 6, hy,     hx + 6, hy);
    g.lineBetween(hx - 6, hy + 3, hx + 6, hy + 3);
  }

  _handleY() {
    // trim=0 (cazada) → handle near bottom; trim=85 (filada) → handle near top
    const TT = MainsheetController.TRACK_TOP;
    const TB = MainsheetController.TRACK_BOT;
    const topY    = TT + 8;
    const bottomY = TB - 8;
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
    const W = MainsheetController.PANEL_W + 20;
    const H = MainsheetController.PANEL_H + 20;
    return Math.abs(sx - this._cx) <= W / 2 && Math.abs(sy - this._cy) <= H / 2;
  }

  onDown(ptr) {
    this._dragStartY      = ptr.y;
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
