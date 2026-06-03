// ── LayoutManager ─────────────────────────────────────────────────────────────
// Persists controller slot positions (3-column × 2-row grid) to localStorage.
// Provides pixel coordinates for each named slot in the 800×600 game space.

class LayoutManager {
  static KEY = 'sailsim_layout';

  // Pixel centers per controller per slot
  static SLOTS = {
    TL: { helm: { x: 155, y: 100 }, ms: { x: 50,  y: 95  } },
    TR: { helm: { x: 725, y: 100 }, ms: { x: 670, y: 95  } },
    CL: { helm: { x: 155, y: 300 }, ms: { x: 50,  y: 300 } },
    CR: { helm: { x: 725, y: 300 }, ms: { x: 670, y: 300 } },
    BL: { helm: { x: 155, y: 500 }, ms: { x: 50,  y: 505 } },
    BR: { helm: { x: 725, y: 500 }, ms: { x: 670, y: 505 } },
  };

  constructor() {
    try {
      const d       = JSON.parse(localStorage.getItem(LayoutManager.KEY) || '{}');
      this.helmSlot = d.helmSlot ?? 'BL';
      this.msSlot   = d.msSlot   ?? 'BR';
    } catch (_) {
      this.helmSlot = 'BL';
      this.msSlot   = 'BR';
    }
  }

  save() {
    try {
      localStorage.setItem(LayoutManager.KEY,
        JSON.stringify({ helmSlot: this.helmSlot, msSlot: this.msSlot }));
    } catch (_) {}
  }

  helmPos() { return LayoutManager.SLOTS[this.helmSlot].helm; }
  msPos()   { return LayoutManager.SLOTS[this.msSlot].ms;   }

  setHelm(slot) {
    this.helmSlot = slot;
    this.save();
  }

  setMainsheet(slot) {
    this.msSlot = slot;
    this.save();
  }

  applyToControllers(helm, mainsheet) {
    const h = this.helmPos();
    const m = this.msPos();
    helm.setPosition(h.x, h.y);
    mainsheet.setPosition(m.x, m.y);
  }
}
