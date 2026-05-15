# Sailing Simulator — Game Build Prompt

> **Target**: Build a complete, self-contained single HTML file. No build step, no bundler.
> **Purpose**: An interactive educational game to learn how to sail a sailboat.
> **Audience**: Beginners learning real sailing fundamentals through play.

---

## 1. Game Overview

A top-down 2D sailing simulator. The player controls a single-mast sailboat by managing two things only: the **rudder** (where the boat points) and the **mainsail trim** (how the sail is angled to the wind). The wind is a constant environmental force. The boat moves realistically based on the relationship between wind direction, sail trim, and boat heading.

There is no score or time pressure by default. It is a sandbox learning tool with optional structured exercises per map (buoy rounding, docking). The physics model must be simplified but accurate enough that real sailing intuitions transfer — getting the sail wrong should genuinely slow you down.

---

## 2. Player Experience

### What the player sees

- **Aerial top-down view**. The camera follows the boat, always centered on screen.
- The boat is rendered from above: an elongated hull with a visible **mast** (dot at center) and a **boom** (line from mast) that rotates in real time to show current sail position.
- **Water** fills the background with a subtle animated texture or repeating tile pattern.
- **Wind arrows** tiled across the water surface show the wind direction at a glance (like grass bending in wind).
- The boat leaves a **wake trail** behind it — a fading dashed white line.
- Islands and buoys exist in world space and move as the camera follows the boat.
- A **red arc** in front of the bow (optional, togglable) shows the no-go zone — the angular range where the boat can't sail into the wind.

### HUD (always visible, non-intrusive)

| Element | Position | Description |
|---|---|---|
| Wind indicator | Top-right | Compass-style arrow pointing where wind comes FROM, with speed in knots |
| Boat speed | Top-left | Current speed in knots (e.g. "6.2 kts") |
| Heading | Top-left | Current bow heading in degrees (0–360°) |
| Sail trim status | On the Mainsheet Controller widget | Text label integrated into the rope controller (see Section 3) |
| Rudder angle | On the Helm Controller widget | Shown on the mini-boat silhouette beside the helm wheel (see Section 3) |
| Objective | Bottom-left | Current map objective text (e.g. "Round buoy #1 and return") |

---

## 3. Controls

All controls work on **desktop (mouse/trackpad)** and **mobile (touch)**. There are two dedicated on-screen controller widgets — the **Mainsheet Controller** and the **Helm Controller** — each draggable by the user and repositionable anywhere on screen (see Section 6). Keyboard arrows are a nice-to-have bonus but not required.

### Mainsheet Controller (sail trim)

The mainsheet controller is a **rope widget** that visually represents the tension state of the mainsheet line. The shape of the rope itself communicates how the sail is set:

- **Long and thin rope** → sheet is taut → sail trimmed in (cazada). Rendered as a tall, narrow, taut line with subtle braided cross-hatch marks.
- **Short and wide rope** → sheet is slack → sail eased out (filada). Rendered as a shorter, thicker segment with 2–3 gentle waves along its length to show slack.
- The rope morphs continuously and fluidly between these two shapes as the user interacts.

**Interaction:**
- A draggable **cleat handle** (small filled circle, 12px radius) sits at the bottom end of the rope.
- **Desktop**: Click and drag the handle. Drag upward / inward = trim in (rope stretches long and thin). Drag downward / outward = ease (rope shortens and thickens).
- **Mobile**: Same — touch and drag the handle.
- The boom on the world boat sprite rotates in real time to match the current trim state.
- The total interactive drag range maps linearly to sail trim angle 0°–85°.

**Text label** displayed directly below or beside the rope widget, updated every frame:

| Trim state | Label | Label color |
|---|---|---|
| Fully eased | `EASED` | Grey |
| Intermediate (easing) | `EASING…` | Yellow |
| Near-optimal trim | `TRIMMED` | Green |
| Over-trimmed (stalled) | `STALLED` | Orange |
| No-go zone / luffing | `LUFFING` | Red |

Widget dimensions: taut state ≈ 100px tall × 6px wide. Eased state ≈ 30px tall × 18px wide. Both states on a semi-transparent dark rounded-rect background panel (alpha 0.5) so the rope is legible over water.

### Helm Controller (rudder / steering)

The helm controller is a **mini helm wheel** that the user rotates to steer, rendered next to a **miniature top-down boat silhouette** so the player can always see the rudder effect.

**Interaction:**
- The wheel has a visible **grab handle** on its rim (small filled circle). The user drags this handle in a circular arc.
- **Desktop + Mobile**: Drag the handle clockwise = starboard (turn right); counter-clockwise = port (turn left).
- Maximum wheel rotation: ±90° from center, mapping to ±45° rudder angle on the actual boat.
- When released, the wheel gradually springs back to center, which gradually centers the rudder (does not snap).

**Visual composition of the widget:**

```
  ◄ PORT        STBD ►
      ┌──────────────┐
      │    [wheel]   │  ←── 80px diameter helm wheel
      │              │        with 6 spokes + rim handle
      │  [mini boat] │  ←── 50×18px top-down hull silhouette
      │    rudder ╱  │        rudder line at stern rotates live
      └──────────────┘
```

1. Circular wheel outline (~80px diameter), 6 evenly-spaced spokes from center to rim, grab handle on rim.
2. Adjacent: small top-down boat silhouette. A **rudder line** at the stern rotates to match current helm angle — this is the key visual feedback showing whether you are steering to port or starboard.
3. Port/starboard labels flank the widget. The active-side label highlights (bold, bright white) when the helm is deflected.
4. All on a semi-transparent rounded-rect background panel.

---

## 4. Sailing Physics Model

This is the core of the game. Implement a custom, simplified but realistic vector-based model. **Do not use Phaser Arcade Physics or Matter.js for this** — implement it as a standalone `SailingPhysics` class.

### Key definitions

| Term | Definition |
|---|---|
| **Wind direction** | Where wind is coming FROM, in degrees (0° = from North, blowing South) |
| **Boat heading** | Direction the bow points, in degrees |
| **AWA (Apparent Wind Angle)** | Angle between boat heading and wind direction. 0° = wind dead ahead, 180° = wind dead behind |
| **Sail trim angle** | Boom angle relative to the boat centerline. 0° = fully in, 85° = fully out |

### Points of sail

| AWA range | Point of sail | Optimal trim | Speed factor |
|---|---|---|---|
| 0–40° | **In irons / no-go zone** | — | 0.0 (no thrust) |
| 40–60° | **Close-hauled** (ceñida) | 10° | 0.70 |
| 60–90° | **Close reach** | 25° | 0.85 |
| 90–120° | **Beam reach** (través) | 45° | 1.00 |
| 120–150° | **Broad reach** | 68° | 0.95 |
| 150–180° | **Running** (empopada) | 82° | 0.75 |

### Speed calculation (per frame)

```js
const optimalTrim = getOptimalTrim(AWA);           // from table above
const trimError = Math.abs(sailTrimAngle - optimalTrim);
const trimEfficiency = Math.max(0, 1 - trimError / 45);  // 1 = perfect, 0 = 45°+ off
const pointFactor = getSpeedFactor(AWA);           // from table above
const targetSpeed = windSpeed * pointFactor * trimEfficiency;
boatSpeed = lerp(boatSpeed, targetSpeed, 0.02 * deltaSeconds * 60);
```

### No-go zone behavior

- If AWA < 40°, `pointFactor = 0`. The boat decelerates due to drag (multiply speed by 0.97 per frame).
- The sail luffs visually: the boom flaps slightly, trim status turns red.
- The boat does NOT stop instantly — it coasts to a halt.

### Leeway (lateral drift)

Apply a small drift force perpendicular to the boat heading when sailing upwind. This simulates the boat being pushed sideways by wind. Magnitude: `windSpeed * 0.015` knots sideways, reduced to 0 when running downwind.

### Tacking (bow through wind)

When the boat heading passes through the wind direction (AWA crosses 0°), the boom automatically swings to the opposite side. Apply a brief 30% speed penalty for 1 second to simulate the boat losing momentum through the tack.

### Jibing (stern through wind)

When running and AWA crosses 180°, the boom swings to the other side abruptly. Apply a 20% speed penalty for 0.5 seconds.

---

## 5. Maps

Maps are pure data objects in a `MAPS` array. The `GameScene` reads the selected map and builds the world from it — no map-specific logic inside the scene code.

### Map data structure

```js
{
  id: "string",
  name: "Display Name",
  worldSize: { width: 3000, height: 3000 },   // canvas pixels
  startPosition: { x: 0, y: 0 },
  startHeading: 0,                              // degrees, 0 = North
  wind: { direction: 180, speed: 12 },         // default wind for this map
  islands: [
    { points: [[x,y], [x,y], ...], color: 0x6B8E23 }  // polygon
  ],
  docks: [
    { x, y, width, height, heading, label: "Marina" }
  ],
  buoys: [
    { id: 1, x: 0, y: 0, color: 0xFF6600 }
  ],
  objective: "Round all buoys in order and return to start."
}
```

### Map 1 — Single Buoy

- Open water. One orange buoy directly to the north of the start.
- Default wind: from North (180° — blowing south), 12 kts.
- The player must tack upwind to reach the buoy, round it, and run back.
- **Learning goal**: experience the no-go zone, practice tacking, understand that you can't sail straight into the wind.

### Map 2 — Two Buoys

- Two buoys: one upwind (north), one downwind (south).
- The player sails a simple beat/run course.
- **Learning goal**: contrast upwind sailing (trimmed in, tacking) vs. downwind sailing (eased out, jibing).

### Map 3 — Triangle (Olympic Course)

- Three buoys forming a triangle: one windward mark (north), one reach mark (northeast), one leeward mark (south).
- Classic racing course: windward leg → reach leg → downwind leg.
- **Learning goal**: experience all points of sail in sequence in one exercise.

### Map 4 — Island with Dock

- A large island with irregular coastline in the center of the map.
- One dock on the island's leeward side (marked with a visible target zone rectangle).
- Shallow reef areas around the island (visually marked, the boat can enter but speed is limited to 1.5 kts in shallow water).
- **Docking succeeds** when the boat overlaps the dock zone at speed < 1 knot, with heading within ±20° of the dock's required approach heading.
- **Learning goal**: controlled slow-speed maneuvering, wind-aware approach angles, patience.

---

## 6. World Configuration Panel

Accessible from the main menu and from the in-game pause menu (gear icon).

| Setting | Control | Range | Default |
|---|---|---|---|
| Wind direction | 360° dial | 0–359° | 180° |
| Wind speed | Slider | 5–25 kts | 12 kts |
| Wind variability | Toggle | Off / Shifts ±10° slowly | Off |
| Show sail trim guide | Toggle | On / Off | On |
| Show no-go zone arc | Toggle | On / Off | On |
| Show wind arrows on water | Toggle | On / Off | On |
| Map | Button group | All map IDs | Map 1 |

When **wind variability** is on, wind direction oscillates ±10° over ~20 second cycles using a sine wave with slight random noise — simulating real wind shifts without being chaotic.

### Controller Layout

Both on-screen controllers can be repositioned. The Settings panel includes a dedicated **"Controller Layout"** subsection.

| Setting | Control | Options | Default |
|---|---|---|---|
| Mainsheet Controller position | 3×2 button grid | Top-left / Top-right / Center-left / Center-right / Bottom-left / Bottom-right | Bottom-right |
| Helm Controller position | 3×2 button grid | Top-left / Top-right / Center-left / Center-right / Bottom-left / Bottom-right | Bottom-left |
| Controller opacity | Slider | 40%–100% | 85% |

**Free-drag mode**: a **"Customize Layout"** button enters a special repositioning mode. Both controllers display a move-cursor handle. The user can freely drag each controller to any position on screen. Exiting the mode saves positions. While in this mode, sailing is paused.

Controller positions persist across sessions, saved to `localStorage` under the key `sailsim_layout` as `{ mainsheet: { x, y }, helm: { x, y } }`. On game load, saved positions are restored; if none exist, defaults are used.

The two controllers must never overlap: if the user tries to place them in the same region, the second one snaps to the nearest non-overlapping position.

---

## 7. Scenes & Navigation Flow

```
MenuScene
  ├── Map selector (card grid)
  ├── Settings panel (gear icon)
  └── "Start Sailing" button → GameScene

GameScene
  ├── World: water, islands, buoys, docks
  ├── Player boat
  ├── HUD
  ├── Pause button → PauseScene (overlay)
  └── Objective complete → completion banner + "Back to Menu" button

PauseScene (overlay on GameScene)
  ├── Resume
  ├── Settings (same panel as MenuScene)
  └── Back to Menu
```

---

## 8. Technical Stack

| Decision | Choice | Reason |
|---|---|---|
| Delivery | Single `index.html` file | Self-contained, no build step |
| Game library | **Phaser 3** via CDN | Mature, canvas/WebGL, scene management, input, camera |
| Physics | Custom `SailingPhysics` class | Sailing math is domain-specific; generic physics engines don't model it |
| Rendering | Phaser WebGL (Canvas fallback) | Phaser default |
| Assets | Programmatically drawn via Phaser Graphics API | No external image files needed |
| Scaling | `Phaser.Scale.FIT`, base 800×600 | Works on all screen sizes |
| Touch input | Phaser built-in pointer events | Unified mouse + touch |

---

## 9. Sprites & Visual Assets

**Draw everything with Phaser's Graphics API** — no external image files. The game must be self-contained in one HTML file.

| Asset | Drawing instructions |
|---|---|
| **Boat hull** | Pointed polygon (~60×18px), cream/white fill, dark outline. Bow is the narrow end. |
| **Mast** | Filled circle, 5px radius, dark grey, at hull center |
| **Boom** | Line from mast, 28px long, dark grey, rotates with trim angle |
| **Sail** | Filled triangle from mast tip → boom tip → mast base. Semi-transparent white (alpha 0.6). |
| **Wake trail** | Fading line segments behind the boat. White, alpha decreases with age, dashed style. |
| **Buoy** | Circle 14px radius, orange fill, white stroke, number label centered in bold. |
| **Island** | Filled irregular polygon. Tan/sandy fill near edges, green fill interior (two-layer polygon). |
| **Dock** | Rectangle with alternating light/dark stripes. Target approach zone as dashed rectangle. |
| **Water** | Tiled rectangle fill with very subtle dark-blue gradient. Animated small wave lines. |
| **Wind arrows** | Small chevron arrows tiled across the water layer, pointing in wind direction, low opacity (0.2). |
| **No-go zone arc** | Red semi-transparent arc on the boat, centered at bow, ±40° spread. Alpha 0.3. |
| **Mainsheet Controller (rope)** | Rope drawn with Graphics. Taut state: tall thin vertical line (~100×6px) with diagonal cross-hatch marks simulating braid texture. Eased state: short wide segment (~30×18px) with 2–3 sine-wave curves along its length indicating slack. Cleat handle: filled circle 12px radius at the bottom. Text label below (font: monospace bold 12px). Background: semi-transparent dark rounded rect (alpha 0.5, corner radius 10px). The rope shape lerps smoothly between taut and eased states as trim changes. |
| **Helm Controller (wheel)** | Wheel: circle outline ~80px diameter, 6 evenly-spaced spoke lines from center to rim, small filled circle 10px on the rim as the grab handle (highlighted in yellow when active). Spokes: thin lines, dark grey. Mini-boat silhouette: filled elongated pointed polygon (~50×16px) drawn immediately below or beside the wheel inside the same panel. Rudder: short line (14px) at the stern end of the silhouette that rotates proportionally to the helm angle. PORT / STBD labels: small caps text flanking the wheel, active side brightens when helm is deflected. Background: same semi-transparent rounded rect as the Mainsheet Controller. |

---

## 10. Code Architecture

Organize the single HTML file into clearly labeled sections with comment headers:

```
index.html
│
├── <style>
│     Full-screen canvas, no margins, dark background during load
│
├── <script src="phaser CDN">
│
└── <script>   (game code, organized top-to-bottom)
    │
    ├── CONSTANTS          Object with all tuning values (no magic numbers elsewhere)
    ├── MAPS               Array of map data objects (see Section 5)
    ├── SailingPhysics     Class — pure math, no Phaser dependency
    │     methods: update(state, input, delta) → newState
    │               getAWA(heading, windDir)
    │               getTrimStatus(awa, trimAngle) → 'luffing'|'trimmed'|'stalled'
    │
    ├── InputManager       Class — normalizes mouse + touch into unified input state
    │     properties: rudderAxis (-1 to 1), sailTrimTarget (0–85°)
    │
    ├── MainsheetController  Class — renders and handles the rope widget
    │     draw(graphics, trimAngle)   redraws rope shape each frame
    │     onDrag(dy)                  updates sailTrimTarget via InputManager
    │     setPosition(x, y)           repositions the widget on screen
    │
    ├── HelmController       Class — renders and handles the helm wheel widget
    │     draw(graphics, rudderAngle) redraws wheel + mini-boat each frame
    │     onDrag(dx, dy)              updates rudderAxis via InputManager
    │     setPosition(x, y)           repositions the widget on screen
    │
    ├── LayoutManager        Class — persists controller positions to localStorage
    │     save()  load()  enterCustomizeMode()  exitCustomizeMode()
    │
    ├── MenuScene          Phaser Scene
    ├── GameScene          Phaser Scene
    │     — builds world from map data object passed via scene.start()
    │     — owns boat state, calls SailingPhysics.update() each frame
    │     — draws HUD via Phaser GameObjects.Text + Graphics
    │
    ├── PauseScene         Phaser Scene (overlay)
    │
    └── Phaser.Game config + game instantiation
```

---

## 11. Code Best Practices

- **Constants object**: all tunable numbers live in one `CONSTANTS` block at the top.
  ```js
  const CONSTANTS = {
    NO_GO_ZONE_DEG: 40,
    MAX_RUDDER_ANGLE: 45,
    BOAT_DRAG: 0.97,
    TACK_PENALTY_FACTOR: 0.7,
    TACK_PENALTY_DURATION_MS: 1000,
    SHALLOW_SPEED_LIMIT: 1.5,
    DOCK_SUCCESS_SPEED: 1.0,
    DOCK_SUCCESS_HEADING_TOLERANCE: 20,
    // ...
  };
  ```

- **Frame-rate independent**: all physics uses `delta` (seconds). Always multiply velocity changes by `delta`.
  ```js
  // correct
  boatSpeed = lerp(boatSpeed, targetSpeed, CONSTANTS.ACCEL * delta);
  ```

- **No map-specific code in scenes**: `GameScene.create()` receives `this.scene.settings.data.map` and builds everything from it.

- **Input abstraction**: `InputManager` is the only place that reads pointer/touch events. The rest of the code reads from `input.rudderAxis` and `input.sailTrimTarget`.

- **Camera**: `this.cameras.main.startFollow(boatSprite, true, 0.1, 0.1)` — lerp following, not snap.

- **Collision with islands**: use `Phaser.Geom.Polygon.Contains()` — not physics bodies.

- **Mobile ergonomics**: all interactive controls (slider, rudder zones) must have a minimum tap target of 48×48px. The sail trim slider should be tall enough to use with a thumb.

- **Performance**: wind arrows are a single static Graphics object drawn once and updated only when wind direction changes — not redrawn every frame.

- Keep related logic co-located. If a section exceeds ~120 lines, extract it into a named class or function block.

---

## 12. Learning Aids (Toggleable)

These are visual overlays to help beginners understand what's happening. All togglable via Settings.

| Aid | What it shows |
|---|---|
| **No-go zone arc** | Red arc in front of bow showing the wind angle range where sailing is impossible |
| **Sail trim guide** | Ghost position of where the boom *should* be for optimal trim (thin dashed line) |
| **Wind arrows on water** | Low-opacity directional arrows across the water background |
| **AWA readout** | Small number near the boat showing current Apparent Wind Angle in degrees (for advanced learners) |

When `showSailTrimGuide` is true, render a dashed boom line at the optimal trim angle alongside the actual boom. This teaches the player to match their trim to the guide.

---

## 13. Audio (Optional Enhancement)

If audio is implemented, use the Web Audio API directly (no external library needed).

| Sound | Trigger | Description |
|---|---|---|
| Water ambience | Always | Low looping ocean sound |
| Sail luff | AWA < 40° | Flapping fabric sound |
| Tack/jibe | On event | Short whoosh sound |
| Dock success | On objective complete | Pleasant chime |

All sounds synthesized procedurally via `AudioContext.createOscillator()` or loaded as short Base64 encoded data URIs embedded in the HTML.

---

## 14. Completion Criteria

The game is considered complete when:

- [ ] All 4 maps load and are playable.
- [ ] Mainsheet Controller rope widget responds to drag: long-thin when trimmed, short-wide when eased. Text label updates correctly for all 5 states.
- [ ] Helm Controller wheel rotates on drag. Mini-boat silhouette rudder moves in sync. PORT/STBD labels highlight correctly.
- [ ] Both controllers work on mouse and touch.
- [ ] Both controllers can be repositioned via the 3×2 grid in settings and via free-drag Customize Layout mode.
- [ ] Controller positions persist in localStorage across page reloads.
- [ ] The sailing physics model produces realistic behavior: you can't sail into the wind, beam reach is fastest, running is slower than reaching.
- [ ] Tacking and jibing work correctly (boom swings, speed penalty applies).
- [ ] The no-go zone arc and sail trim guide are visible and toggle correctly.
- [ ] Docking on Map 4 detects success correctly.
- [ ] The settings panel changes wind and toggles learning aids.
- [ ] The game runs smoothly on a modern mobile browser (60fps target).
- [ ] Everything is contained in a single `index.html` file.
