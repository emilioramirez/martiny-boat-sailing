// ── THEME ─────────────────────────────────────────────────────────────────────
// Single source of truth for all UI colors.
//
// Hex numbers  (0xRRGGBB) → pass to graphics.fillStyle() / graphics.lineStyle()
// CSS strings  ('#rrggbb') → pass to text({ color }) / text.setColor()
//
// World colors (water, hull, islands, wake…) live in CONSTANTS.COLORS.

const THEME = {

  // ── Panel chrome ────────────────────────────────────────────────────────────
  panelBg:        0x1a1a2e,   // control-widget panels (0.55 α)
  panelBgDark:    0x0c1624,   // pause panel           (0.97 α)
  panelBgDeep:    0x08121e,   // notifications/tutorial (0.88–0.96 α)
  panelBorder:    0x3a3a5e,   // control-widget borders
  panelBorderAlt: 0x2a4a6e,   // pause panel / tutorial / mini-map borders
  trackBg:        0x080810,   // dark inset track (rope track)

  // ── Text hierarchy ───────────────────────────────────────────────────────────
  textPrimary:    '#ffffff',
  textAccent:     '#44ddff',  // cyan — active tabs, HUD values, close-hauled state
  textBright:     '#ccddff',  // slightly dimmer cyan — trim status label
  textSoft:       '#aaccdd',  // objective text, notification body
  textSub:        '#99aabb',  // layout labels, secondary buttons
  textLabel:      '#8899aa',  // gauge labels, PORT/STBD
  textDim:        '#667788',  // inactive toggles, minor labels
  textMuted:      '#556677',  // skip button, very dim UI

  // ── Gold accent ──────────────────────────────────────────────────────────────
  gold:           0xC9A84C,   // handles, highlighted borders (graphics)
  goldStr:        '#c8a050',  // menu separator, credits, lang toggle (CSS text)
  goldBright:     '#ffcc44',  // active buttons, broad-reach state

  // ── Notification / alert severity ────────────────────────────────────────────
  notifDanger:    0xff4444,
  notifWarn:      0xffcc44,
  notifOk:        0x44ff88,
  notifInfo:      0x6688aa,

  // ── Point-of-sail label colors ────────────────────────────────────────────────
  posIrons:       '#ff5555',
  posCloseHauled: '#44ddff',  // reuses textAccent
  posCloseReach:  '#44ff99',
  posBeamReach:   '#aaff44',
  posBroadReach:  '#ffcc44',  // reuses goldBright
  posRunning:     '#ff8844',

  // ── Failure / collision state ────────────────────────────────────────────────
  failureBg:      0x1a0000,
  failureBorder:  0xcc2222,
  failureText:    '#ff4444',

  // ── Outcome colors ───────────────────────────────────────────────────────────
  completionText: '#44ffaa',  // completion banner title + toggle ON state
  restartText:    '#ff8866',  // restart button (failure + pause panel)

  // ── Button backgrounds ────────────────────────────────────────────────────────
  btnBg:          '#1a2a3a',
  btnBgDark:      '#0d1a2a',

  // ── Menu wood buttons ────────────────────────────────────────────────────────
  woodNormal:     0xd4a96e,
  woodHover:      0xe8bf78,
  woodBorder:     0x7a4010,
  woodText:       '#1a2a5c',
};
