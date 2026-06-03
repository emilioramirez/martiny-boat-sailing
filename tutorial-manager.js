// ── TutorialManager ────────────────────────────────────────────────────────────
// First-run coach mark sequence. Shows a dim overlay with a spotlight cutout
// around each highlighted element and a tooltip with Continue / Skip buttons.
// Game physics keep running; input is blocked via inputManager.enabled = false.

class TutorialManager {
  constructor(scene, uiGroup) {
    this.scene    = scene;
    this.isActive = false;
    this._step    = 0;

    const W = scene.scale.width;
    const H = scene.scale.height;
    this._W = W;
    this._H = H;

    // Container at depth 60 — above pause panel (50), below failure panel (62)
    this._c = scene.add.container(0, 0).setDepth(60).setVisible(false);
    uiGroup.add(this._c);

    // Overlay: 4 dark rects forming a spotlight cutout, redrawn each step
    this._overlayGfx = scene.add.graphics();
    this._c.add(this._overlayGfx);

    // Tooltip bg (Graphics redrawn each step)
    this._tooltipBg = scene.add.graphics();

    // Instruction text
    this._tooltipTxt = scene.add.text(0, 0, '', {
      fontSize: '14px', fontFamily: 'Arial', color: '#ddeeff',
      wordWrap: { width: 268 }, align: 'center',
    }).setOrigin(0.5, 0);

    // Continue button
    this._nextBtn = scene.add.text(0, 0, '', {
      fontSize: '14px', fontFamily: 'Arial', color: '#44ddff',
      backgroundColor: '#1a2a3a', padding: { x: 22, y: 9 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    this._nextBtn.on('pointerdown', () => this._advance());

    // Skip button (hidden on last step)
    this._skipBtn = scene.add.text(0, 0, t('tutorial.skip'), {
      fontSize: '12px', fontFamily: 'Arial', color: '#556677',
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    this._skipBtn.on('pointerdown', () => this._finish());

    this._c.add(this._tooltipBg);
    this._c.add(this._tooltipTxt);
    this._c.add(this._nextBtn);
    this._c.add(this._skipBtn);
  }

  // ── Public API ───────────────────────────────────────────────────────────

  start(fromReplay = false) {
    if (!fromReplay) {
      try { if (localStorage.getItem('sailsim_tutorial_done') === 'true') return; } catch(e) {}
    }
    this._step = 0;
    this.isActive = true;
    this.scene.isPaused = true;
    if (this.scene.audio) this.scene.audio.suspend();
    this._c.setVisible(true);
    this._showStep(0);
  }

  replay() { this.start(true); }

  // ── Steps ────────────────────────────────────────────────────────────────

  _steps() {
    const W = this._W, H = this._H;
    const sc = this.scene;
    return [
      {
        key: 'tutorial.wind',
        // Wind indicator: text top-right + compass circle centered at (W-44, 54)
        hl: { x: W - 186, y: 4, w: 182, h: 88 },
      },
      {
        key: 'tutorial.mainsheet',
        hl: sc.mainsheet
          ? this._ctrlHl(sc.mainsheet.container, 70, 160)
          : null,
      },
      {
        key: 'tutorial.helm',
        hl: sc.helm
          ? this._ctrlHl(sc.helm.container, 130, 150)
          : null,
      },
      {
        key: 'tutorial.no_go',
        // No-go arc is on the boat, which is always at screen center
        hl: { x: W / 2 - 88, y: H / 2 - 88, w: 176, h: 176 },
      },
      {
        key: 'tutorial.start',
        hl: null,  // farewell — full dim, centered tooltip, no spotlight
      },
    ];
  }

  // Build a highlight rect from a controller container's position + panel size
  _ctrlHl(container, panelW, panelH) {
    const m = 14;
    return {
      x: container.x - panelW / 2 - m,
      y: container.y - panelH / 2 - m,
      w: panelW + m * 2,
      h: panelH + m * 2,
    };
  }

  // ── Navigation ───────────────────────────────────────────────────────────

  _advance() {
    this._step++;
    if (this._step >= this._steps().length) { this._finish(); return; }
    this._showStep(this._step);
  }

  _finish() {
    try { localStorage.setItem('sailsim_tutorial_done', 'true'); } catch(e) {}
    this.isActive = false;
    this._c.setVisible(false);
    this.scene.isPaused = false;
    if (this.scene.audio) this.scene.audio.resume();
  }

  // ── Rendering ────────────────────────────────────────────────────────────

  _showStep(n) {
    const steps  = this._steps();
    const step   = steps[n];
    const W = this._W, H = this._H;
    const isLast = n === steps.length - 1;
    const hl     = step.hl;

    // Overlay — 4 dark rects framing the spotlight, or full dim on last step
    const g = this._overlayGfx;
    g.clear();
    g.fillStyle(0x000000, 0.72);
    if (hl) {
      if (hl.y > 0)            g.fillRect(0,          0,          W,               hl.y);
      if (hl.y + hl.h < H)    g.fillRect(0,          hl.y + hl.h, W,              H - hl.y - hl.h);
      if (hl.x > 0)           g.fillRect(0,          hl.y,        hl.x,            hl.h);
      if (hl.x + hl.w < W)   g.fillRect(hl.x + hl.w, hl.y,      W - hl.x - hl.w, hl.h);
      // Spotlight border glow
      g.lineStyle(2, 0x44eeff, 0.88);
      g.strokeRoundedRect(hl.x - 4, hl.y - 4, hl.w + 8, hl.h + 8, 8);
    } else {
      g.fillRect(0, 0, W, H);
    }

    // Measure tooltip content to compute height before drawing bg
    const TW  = 300;
    const PAD = 16;

    this._nextBtn.setText(t('tutorial.next'));
    this._tooltipTxt.setText(t(step.key));

    const txtH  = this._tooltipTxt.height;
    const btnH  = this._nextBtn.height;      // actual rendered height
    const skipH = isLast ? 0 : (this._skipBtn.height + 8);
    const tipH  = PAD + txtH + 12 + btnH + (isLast ? 0 : skipH + 6) + PAD;

    // Tooltip position: below hl if room, otherwise above; centered if no hl
    let tipX, tipY;
    if (!hl) {
      tipX = W / 2 - TW / 2;
      tipY = H / 2 - tipH / 2;
    } else {
      tipX = Phaser.Math.Clamp(hl.x + hl.w / 2 - TW / 2, 8, W - TW - 8);
      const belowY = hl.y + hl.h + 18;
      const aboveY = hl.y - tipH - 18;
      tipY = (belowY + tipH < H - 8) ? belowY : aboveY;
    }

    // Tooltip background
    const tb = this._tooltipBg;
    tb.clear();
    tb.fillStyle(0x08121e, 0.96);
    tb.fillRoundedRect(tipX, tipY, TW, tipH, 10);
    tb.lineStyle(1.5, 0x2a4a6e, 1);
    tb.strokeRoundedRect(tipX, tipY, TW, tipH, 10);

    // Position text + buttons inside tooltip
    const cx = tipX + TW / 2;
    this._tooltipTxt.setPosition(cx, tipY + PAD);
    this._nextBtn.setPosition(cx, tipY + PAD + txtH + 12);

    this._skipBtn.setVisible(!isLast);
    if (!isLast) {
      this._skipBtn.setPosition(cx, tipY + PAD + txtH + 12 + btnH + 6);
    }
  }
}
