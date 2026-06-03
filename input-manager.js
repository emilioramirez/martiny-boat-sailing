// ── InputManager ──────────────────────────────────────────────────────────────
// Single source of truth for rudder and sail-trim control state.
// Claims one pointer ID per controller on touch/click; routes moves accordingly.
// Reads: MainsheetController, HelmController.
// Exposes: rudderAxis [-1,+1], sailTrimTarget [0°,85°].

class InputManager {
  constructor(scene, mainsheet, helm) {
    this.scene          = scene;
    this.mainsheet      = mainsheet;
    this.helm           = helm;

    this.mainsheetPtr   = null;   // claimed pointer ID
    this.helmPtr        = null;

    this.sailTrimTarget = 42.5;   // degrees 0–85, start mid-range
    this.rudderAxis     = 0;      // -1 … +1
    this.enabled        = true;   // false while pause panel is open

    scene.input.on('pointerdown', this._onDown, this);
    scene.input.on('pointermove', this._onMove, this);
    scene.input.on('pointerup',   this._onUp,   this);
  }

  _onDown(ptr) {
    if (!this.enabled) return;
    if (this.mainsheetPtr === null && this.mainsheet.hitTest(ptr.x, ptr.y)) {
      this.mainsheetPtr = ptr.id;
      this.mainsheet.onDown(ptr);
    } else if (this.helmPtr === null && this.helm.hitTest(ptr.x, ptr.y)) {
      this.helmPtr = ptr.id;
      this.helm.onDown(ptr);
    }
  }

  _onMove(ptr) {
    if (ptr.id === this.mainsheetPtr) {
      this.sailTrimTarget = this.mainsheet.onMove(ptr);
    }
    if (ptr.id === this.helmPtr) {
      this.rudderAxis = this.helm.onMove(ptr);
    }
  }

  _onUp(ptr) {
    if (ptr.id === this.mainsheetPtr) { this.mainsheetPtr = null; this.mainsheet.onUp(); }
    if (ptr.id === this.helmPtr)      { this.helmPtr      = null; this.helm.onUp();      }
  }

  destroy() {
    this.scene.input.off('pointerdown', this._onDown, this);
    this.scene.input.off('pointermove', this._onMove, this);
    this.scene.input.off('pointerup',   this._onUp,   this);
  }
}
