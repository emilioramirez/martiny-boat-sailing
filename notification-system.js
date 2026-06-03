// ── NotificationSystem ────────────────────────────────────────────────────────
// Pill banner queue with priority colors, fade in/hold/fade out state machine.
// Contextual sailing triggers + idle tips after 30s of silence.

class NotificationSystem {
  constructor(scene, uiGroup) {
    this.scene    = scene;
    this.isEnabled = true;

    // ── Banner container (UI space, centered top) ────────────────────────────
    const W = scene.scale.width;
    this.container = scene.add.container(W / 2, 52).setDepth(40).setAlpha(0);
    uiGroup.add(this.container);

    // Pill bg graphics + text
    this._bg   = scene.add.graphics();
    this._text = scene.add.text(0, 0, '', {
      fontSize: '13px', fontFamily: 'Arial', fontStyle: 'bold',
      color: '#ffffff', stroke: '#000000', strokeThickness: 1,
    }).setOrigin(0.5, 0.5);
    this.container.add(this._bg);
    this.container.add(this._text);

    // ── State machine ────────────────────────────────────────────────────────
    this._state    = 'idle'; // 'in' | 'hold' | 'out' | 'idle'
    this._elapsed  = 0;
    this._holdTime = 0;
    this._queue    = []; // [{ msgKey, priority }]

    // ── Trigger cooldowns (seconds remaining) ────────────────────────────────
    this._cd = {
      trim_close:    0,
      trim_perfect:  0,
      luffing_tip:   0,
      irons_tip:     0,
      tack_success:  0,
      jibe_success:  0,
      approach_dock: 0,
      running_warn:  0,
    };

    // ── Sustained-condition accumulators ────────────────────────────────────
    this._trimCloseSustained = 0; // seconds trim_close condition held
    this._prevTrimStatus     = null;

    // ── Idle tip state ────────────────────────────────────────────────────────
    this._silentFor  = 0; // seconds since last notification
    this._tipIdx     = 0;
    this._tipKeys    = [
      'tip.indicators', 'tip.displacement', 'tip.wind_dir',
      'tip.maps', 'tip.trim_guide', 'tip.tutorial_replay', 'tip.minimap',
    ];
    this._tipCooldown = 0; // seconds until next tip allowed
  }

  // ── Public: called every frame ──────────────────────────────────────────────
  update(ctx, dt) {
    if (!this.isEnabled) return;

    this._tickCooldowns(dt);
    this._evaluateTriggers(ctx, dt);
    this._tickStateMachine(dt);
  }

  // ── Push a message ──────────────────────────────────────────────────────────
  push(msgKey, priority) {
    // Keep queue short; drop lowest-priority items if full
    if (this._queue.length >= 3) {
      const lowestIdx = this._findLowestPriorityIdx();
      if (this._priorityRank(priority) > this._priorityRank(this._queue[lowestIdx].priority)) {
        this._queue.splice(lowestIdx, 1);
      } else {
        return; // new message is lower priority, discard
      }
    }
    this._queue.push({ msgKey, priority });
    this._silentFor   = 0;
    this._tipCooldown = 20; // hold off idle tips after a real message
  }

  // ── Trigger evaluation ──────────────────────────────────────────────────────
  _evaluateTriggers(ctx, dt) {
    const {
      boatSpeed, absAWA, trimStatus, trimError,
      isInIrons, justTacked, justJibed, windSpeed,
      mapData, boatPos,
    } = ctx;

    // notif.tack_success — one-shot per tack
    if (justTacked && this._cd.tack_success <= 0) {
      this.push('notif.tack_success', 'success');
      this._cd.tack_success = 5;
    }

    // notif.jibe_success — one-shot per jibe
    if (justJibed && this._cd.jibe_success <= 0) {
      this.push('notif.jibe_success', 'success');
      this._cd.jibe_success = 5;
    }

    // notif.trim_perfect — transition into 'trimmed'
    if (trimStatus === 'trimmed' && this._prevTrimStatus !== 'trimmed' && this._cd.trim_perfect <= 0) {
      this.push('notif.trim_perfect', 'success');
      this._cd.trim_perfect = 10;
    }
    this._prevTrimStatus = trimStatus;

    // notif.trim_close — sustained 2s while easing/stalled close to optimal
    const trimCloseCondition = (trimStatus === 'easing' || trimStatus === 'stalled') && trimError < 15;
    if (trimCloseCondition && this._cd.trim_close <= 0) {
      this._trimCloseSustained += dt;
      if (this._trimCloseSustained >= 2) {
        this.push('notif.trim_close', 'info');
        this._cd.trim_close = 15;
        this._trimCloseSustained = 0;
      }
    } else {
      this._trimCloseSustained = 0;
    }

    // notif.luffing_tip
    if (absAWA < CONSTANTS.NO_GO_ZONE_DEG && this._cd.luffing_tip <= 0) {
      this.push('notif.luffing_tip', 'info');
      this._cd.luffing_tip = 60;
    }

    // notif.irons_tip — after already 3s in irons
    if (isInIrons && this._cd.irons_tip <= 0) {
      this.push('notif.irons_tip', 'urgent');
      this._cd.irons_tip = 20;
    }

    // notif.approach_dock — map 4, close to dock, moving fast
    if (mapData && mapData.docks && mapData.docks.length > 0 && this._cd.approach_dock <= 0) {
      const dock = mapData.docks[0];
      const dockCx = dock.x + dock.width  / 2;
      const dockCy = dock.y + dock.height / 2;
      const dist   = Math.hypot(boatPos.x - dockCx, boatPos.y - dockCy);
      if (dist < 200 && boatSpeed > 2) {
        this.push('notif.approach_dock', 'warning');
        this._cd.approach_dock = 8;
      }
    }

    // notif.running_warn — running in heavy air
    if (absAWA > 160 && windSpeed > 15 && this._cd.running_warn <= 0) {
      this.push('notif.running_warn', 'warning');
      this._cd.running_warn = 30;
    }

    // ── Idle tips ─────────────────────────────────────────────────────────────
    if (this._state === 'idle' && this._queue.length === 0) {
      this._silentFor += dt;
    }
    if (this._silentFor >= 30 && this._tipCooldown <= 0) {
      this.push(this._tipKeys[this._tipIdx % this._tipKeys.length], 'info');
      this._tipIdx++;
      this._tipCooldown = 6;
      this._silentFor   = 0;
    }
  }

  // ── State machine ──────────────────────────────────────────────────────────
  _tickStateMachine(dt) {
    if (this._state === 'idle') {
      if (this._queue.length > 0) this._dequeue();
      return;
    }

    this._elapsed += dt;
    const FADE = 0.3;

    if (this._state === 'in') {
      const a = Math.min(this._elapsed / FADE, 1);
      this.container.setAlpha(a);
      if (this._elapsed >= FADE) { this._state = 'hold'; this._elapsed = 0; }

    } else if (this._state === 'hold') {
      this.container.setAlpha(1);
      if (this._elapsed >= this._holdTime) { this._state = 'out'; this._elapsed = 0; }

    } else if (this._state === 'out') {
      const a = Math.max(1 - this._elapsed / FADE, 0);
      this.container.setAlpha(a);
      if (this._elapsed >= FADE) {
        this.container.setAlpha(0);
        this._state = 'idle';
        // Immediately dequeue next if available
        if (this._queue.length > 0) this._dequeue();
      }
    }
  }

  // ── Dequeue and display next message ──────────────────────────────────────
  _dequeue() {
    const { msgKey, priority } = this._queue.shift();
    const msg = t(msgKey);

    // Measure text width → pill dimensions
    const pad = 20, pillH = 30;
    this._text.setText(msg);
    const pillW = this._text.width + pad * 2;

    // Border color by priority
    const borderCol = {
      urgent:  0xff4444,
      warning: 0xffcc44,
      success: 0x44ff88,
      info:    0x6688aa,
    }[priority] ?? 0x6688aa;

    // Draw pill
    const g = this._bg;
    g.clear();
    g.fillStyle(0x08121e, 0.88);
    g.fillRoundedRect(-pillW / 2, -pillH / 2, pillW, pillH, 8);
    g.lineStyle(1.5, borderCol, 0.9);
    g.strokeRoundedRect(-pillW / 2, -pillH / 2, pillW, pillH, 8);

    // Hold time by priority
    this._holdTime = { urgent: 5, warning: 4, info: 4, success: 2 }[priority] ?? 3;
    // One-shot events get shorter hold
    if (msgKey === 'notif.tack_success' || msgKey === 'notif.jibe_success') this._holdTime = 1.5;

    this._state   = 'in';
    this._elapsed = 0;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _tickCooldowns(dt) {
    for (const k of Object.keys(this._cd)) {
      if (this._cd[k] > 0) this._cd[k] = Math.max(0, this._cd[k] - dt);
    }
    if (this._tipCooldown > 0) this._tipCooldown = Math.max(0, this._tipCooldown - dt);
  }

  _priorityRank(p) {
    return { info: 0, success: 1, warning: 2, urgent: 3 }[p] ?? 0;
  }

  _findLowestPriorityIdx() {
    let idx = 0, minR = 999;
    for (let i = 0; i < this._queue.length; i++) {
      const r = this._priorityRank(this._queue[i].priority);
      if (r < minR) { minR = r; idx = i; }
    }
    return idx;
  }
}
