# Sailing Simulator — Game Build Prompt

> **Goal**: Build an interactive educational game to learn how to sail a sailboat.
> **Audience**: Beginners learning real sailing fundamentals through play.
>
> This prompt is split into two parts:
> - **Part 1 — Game Design & Logic**: engine-agnostic. Defines *what* the game is, *how* it behaves, and *what* the player sees. Valid for any platform (web, Godot, Unity, etc.).
> - **Part 2 — Implementation: Web / Phaser**: web-specific. Defines *how* to build it using Phaser on a single HTML file. **Replace this entire part** when targeting a different engine or platform — Part 1 stays untouched.

---

# PART 1 — Game Design & Logic

> These sections are engine-agnostic. Do not reference any specific engine API here.
> All code snippets in Part 1 are written in pseudocode or plain JavaScript as a notation
> convenience — adapt to the target language as needed.

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
- A **red arc** in front of the bow (togglable) shows the no-go zone — the angular range where the boat can't sail into the wind. The arc is only visible when the boat is actually inside the no-go zone (|AWA| < `NO_GO_ZONE_DEG`); it hides automatically when sailing clear of it.

### HUD (always visible, non-intrusive)

| Element | Position | Description |
|---|---|---|
| Wind indicator | Top-right | Compass-style arrow pointing where wind comes FROM, with speed in knots |
| Boat speed | Top-left | Current speed in knots (e.g. "6.2 kts") |
| Heading | Top-left | Current bow heading in degrees (0–360°) |
| Sail trim status | On the Mainsheet Controller widget | Text label integrated into the rope controller (see Section 3) |
| Rudder angle | On the Helm Controller widget | Shown on the mini-boat silhouette beside the helm wheel (see Section 3) |
| Objective | Bottom-center | Current map objective text resolved via `t(map.objectiveKey)`. Font 11px, word-wrapped to 500px, centered origin `(0.5, 1)`. |
| Elapsed timer | Top-left, below heading | Stopwatch counting up from game start. Format: `1:23.4` when ≥ 1 min, `45.2s` when under 1 min. Pauses with the game, stops on success/failure, resets on restart. Shown muted (textLabel color) to stay unobtrusive. |
| Notification panel | Top-center | Contextual tips and coaching messages; toggleable; see Section 14 |
| Off-screen objective arrow | Screen edge | Small arrow on the nearest screen edge pointing toward the next buoy when it is outside the viewport; disappears when the buoy is visible |
| Mini-map | Configurable corner | Small world overview showing boat, buoys, islands; toggleable from the Indicators Panel |

All HUD strings come from the `TRANSLATIONS` object via `t()` — see Section 10.

---

## 3. Controls

All controls work on **desktop (mouse/trackpad)** and **mobile (touch)**. There are two dedicated on-screen controller widgets — the **Mainsheet Controller** and the **Helm Controller** — each draggable by the user and repositionable anywhere on screen (see Section 6). Keyboard arrows are a nice-to-have bonus but not required.

### Mainsheet Controller (sail trim)

The mainsheet controller is a **rope widget** that visually represents the tension state of the mainsheet line. The shape of the rope itself communicates how the sail is set:

- **Long and thin rope** → sheet is taut → sail trimmed in (cazada). Rendered as a tall, narrow, taut line with subtle braided cross-hatch marks.
- **Short and wide rope** → sheet is slack → sail eased out (filada). Rendered as a shorter, thicker segment with 2–3 gentle waves along its length to show slack.
- The rope morphs continuously and fluidly between these two shapes as the user interacts.

**Interaction:**
- A draggable **cleat handle** (small filled circle) sits at the bottom end of the rope.
- **Desktop**: Click and drag the handle. Drag upward / inward = trim in (rope stretches long and thin). Drag downward / outward = ease (rope shortens and thickens).
- **Mobile**: Same — touch and drag the handle.
- The boom on the world boat sprite rotates in real time to match the current trim state.
- The total interactive drag range maps linearly to sail trim angle 0°–85°.

**Text label** displayed directly below or beside the rope widget, updated every frame via `t('trim.' + trimStatus)` — note the `'trim.'` prefix is prepended by the widget, not by the physics module (which returns raw keys like `'luffing'`, `'trimmed'`):

| Trim state | i18n key | ES | EN |
|---|---|---|---|
| Fully eased | `trim.eased` | FILADA | EASED |
| Intermediate | `trim.easing` | FILANDO… | EASING… |
| Near-optimal | `trim.trimmed` | CAZADA | TRIMMED |
| Over-trimmed | `trim.stalled` | PARADA | STALLED |
| No-go zone | `trim.luffing` | FLAMEA | LUFFING |

Widget dimensions: taut state ≈ 100px tall × 6px wide. Eased state ≈ 30px tall × 18px wide.

### Haptic feedback (mobile)

On supported devices, trigger `navigator.vibrate()` for physical events. This API is a no-op on desktop — safe to call unconditionally.

| Event | Pattern |
|---|---|
| Tack or jibe | `vibrate(40)` — short tap |
| Island collision | `vibrate([80, 40, 80])` — double thud |
| Buoy rounded | `vibrate(25)` — brief confirm |
| Objective complete | `vibrate([30, 20, 30, 20, 60])` — celebratory pattern |

### Multi-touch (mobile)

Both controllers must be simultaneously operable. Each controller claims its own pointer ID the moment a touch begins on it. `InputManager` tracks up to 2 active pointer IDs independently — one per controller. A touch on the mainsheet does not interfere with a touch on the helm, and vice versa. Prevent default browser gestures (pinch-zoom, scroll) on the canvas element to avoid conflicts.

### Helm Controller (rudder / steering)

The helm controller is a **tiller (caña)** widget. The user drags it horizontally to steer — exactly like a real tiller. It sits above a **miniature top-down boat silhouette** at the stern so the player sees the tiller extending into the cockpit.

**Interaction:**
- **Horizontal drag**: drag right → tiller goes right → boat turns **port** (left). Drag left → boat turns **starboard**. This is the real-world tiller inversion (`return -helmAngle / 90` from the controller).
- Maximum tiller deflection: ±90° maps to ±60° visual sweep from straight-up.
- **Desktop**: tiller holds its position when released.
- **Mobile**: tiller springs back to center when released (spring rate 3.0×/s). Detected via `scene.sys.game.device.os.desktop`.
- Sensitivity: 1.4° per pixel of horizontal drag.

**Visual composition of the widget:**

```
  ◄ BABOR      ESTRIBOR ►
      ┌──────────────┐
      │    CAÑA      │  ←── panel title label (i18n key 'helm.label')
      │  ╱ tiller ╲  │  ←── tiller shaft from stern pivot, extends upward
      │    [pivot]   │  ←── pivot cap at stern (y=+41 in local coords)
      │  [mini boat] │  ←── 13×4px hull silhouette (3.33:1 ratio matching real boat)
      └──────────────┘
```

- **Tiller shaft**: line from stern pivot (0, +41) extending upward. Sweep ±60° from straight-up (-90°) as helm angle changes. Grab handle: gold circle at tip (radius 8px).
- **Range arc**: faint arc showing the full tiller sweep range.
- **Panel title**: `t('helm.label')` centered at top of panel (10px bold, muted color).
- **Port/starboard labels** (`helm.port` / `helm.starboard`) flank the panel, the active-side highlights white when helm is deflected > 5°.
- **Mini-boat silhouette**: elongated polygon matching real boat proportions (hull length 13px, half-width 4px = 3.33:1 ratio). Bow at top, stern at bottom where the pivot is.
- All on a semi-transparent rounded-rect background panel (130×150px).

**Physics**: `update(dt)` returns `-helmAngle / 90` — negative because tiller direction is opposite to boat turn direction.

---

## 4. Sailing Physics Model

This is the core of the game. Implement as a standalone module/class (`SailingPhysics`) with no dependency on any game engine — pure math that takes a state object and returns a new state object.

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
| 0–15° | **In irons / no-go zone** | — | 0.0 (no thrust) |
| 15–60° | **Close-hauled** (ceñida) | 10° | 0.70 |
| 60–90° | **Close reach** | 25° | 0.85 |
| 90–120° | **Beam reach** (través) | 45° | 1.00 |
| 120–150° | **Broad reach** | 68° | 0.95 |
| 150–180° | **Running** (empopada) | 82° | 0.75 |

### Speed calculation (per frame)

```js
const optimalTrim = getOptimalTrim(AWA);
const trimError = Math.abs(sailTrimAngle - optimalTrim);
const trimEfficiency = Math.max(0, 1 - trimError / 45);  // 1 = perfect, 0 = 45°+ off
const pointFactor = getSpeedFactor(AWA);
const targetSpeed = windSpeed * pointFactor * trimEfficiency;
boatSpeed = lerp(boatSpeed, targetSpeed, ACCEL * delta);  // frame-rate independent
```

### No-go zone behavior

- If AWA < `NO_GO_ZONE_DEG` (15°), `pointFactor = 0`. The boat decelerates due to drag: multiply speed by `Math.pow(BOAT_DRAG, 60 * delta)` each frame (BOAT_DRAG = 0.999 → ~94%/s retained — very gentle, allowing time to escape).
- The sail luffs visually: boom flaps slightly, trim label shows `trim.luffing`.
- The boat does NOT stop instantly — it coasts slowly to a halt, retaining enough speed for the rudder to work.

### Leeway (lateral drift)

Apply a small drift force perpendicular to the boat heading when sailing upwind. Magnitude: `windSpeed * 0.015` units/s sideways, reduced to 0 when running downwind.

### Tacking (bow through wind)

When AWA crosses 0° (bow passes through the wind), the boom automatically swings to the opposite side. Apply a 30% speed penalty for 1 second to simulate lost momentum.

### Jibing (stern through wind)

When AWA crosses 180° (stern passes through the wind), the boom swings to the other side abruptly. Apply a 20% speed penalty for 0.5 seconds.

### Stuck in irons

Stuck in irons occurs when the boat enters the no-go zone too slowly to complete a tack and sits bow-to-wind, barely moving, with near-useless steering. One of the most important situations a beginner must learn to avoid and escape.

**Entry condition**: AWA < `NO_GO_ZONE_DEG × 2` (30° when zone is 15°) AND boatSpeed < 1.0 kts, persisting for > 2 seconds continuously.

**Effects while in irons**:
- Rudder effectiveness drops to 20% of normal (no water flow over rudder = poor steering).
- Boom hangs slack at centreline. Sail luffs fully.
- Boat continues to decelerate passively under drag.

**Escape**: ease the mainsheet fully and apply maximum rudder to one side — this backs the sail and pushes the bow off the wind. Once AWA > `NO_GO_ZONE_DEG` and boatSpeed > 0.5 kts, normal sailing resumes. A 3-second cooldown prevents immediately re-entering irons.

**Physics output**: `SailingPhysics` returns `isInIrons: boolean` using the 2-second persistence condition (not just instantaneous AWA < 30°).

**Visual**: label `t('irons.label')` appears near the boat in red. The no-go zone arc pulses slowly while in this state.

### Collision failure system

Any collision with a buoy, island, or dock at speed triggers an immediate **mission failure**. The game pauses and a failure panel appears over the scene.

**Failure conditions** (checked every frame in `update()`, only when `!isFailed && !completionShown`):

| Collision type | Condition | i18n reason key |
|---|---|---|
| **Buoy** | Distance from boat center to any not-yet-rounded buoy center < `BOAT_HULL_WIDTH/2 + 14` (~23px) | `fail.hit_buoy` |
| **Island** | Boat center inside any island polygon (ray-casting `_pointInPolygon`) | `fail.hit_island` |
| **Dock crash** | Boat inside dock bounding rect AND speed > `DOCK_SUCCESS_SPEED × 2` (>2 kts) | `fail.hit_dock` |

Island polygons are precomputed in `create()` as `this._islandPolygons` (array of `{x,y}` point arrays) from `map.islands[].points`.

**`_triggerFailure(type)`**:
- Sets `isFailed = true`, `isPaused = true`
- Disables `inputManager.enabled`, hides `pauseBtn` and any open `pausePanel`
- Sets `_failReasonTxt` to `t(reasonKey)` and `_failObjectiveTxt` to objective reminder
- Shows `brokenGraphics` overlay on the boat container
- Shows `failurePanel` container
- Calls `navigator.vibrate([60, 30, 60])`
- Stops the timer: `_timerRunning = false`

**Failure panel** (`_buildFailurePanel()`):
- Phaser Container, depth 62, centered on screen, `setVisible(false)` initially
- Dim overlay: `fillStyle(0x000000, 0.36)` — semi-transparent so the boat wreck is visible behind
- Panel bg: `fillStyle(0x1a0000, 0.48)`, red border `0xcc2222`, rounded rect 420×260px
- Title: `t('fail.title')` in red `#ff4444`, 26px bold
- Reason text: specific collision message, `#ffaaaa`, 15px, word-wrapped
- Objective reminder: `t('fail.objective_was') + ': ' + t(map.objectiveKey)`, `#aaccdd`, 12px
- Time + wind line: `⏱ MM:SS.d  💨 X kts · Y°`, 14px, muted color (shown by `_triggerFailure` after stopping timer)
- Single button: `t('fail.restart')` → calls `_restartMap()`
- Added to `uiGroup` so it renders through the UI camera

**Broken boat overlay** (`brokenGraphics`):
- Graphics object drawn once in `_buildBoat()`, added to boat container (rotates with the hull)
- Red hull overlay (`#cc2222`, alpha 0.75) same polygon as main hull
- Three white crack lines across the hull
- `setVisible(false)` initially; shown by `_triggerFailure()`, hidden by `_restartMap()`

**`_restartMap()` additions**: resets `isFailed = false`, `failurePanel.setVisible(false)`, `brokenGraphics.setVisible(false)`.

**World boundary**:
- Boat position is clamped to the `worldSize` rectangle — it cannot leave the map.
- Within 150px of any edge: a dark vignette fades in on that screen side as a warning.
- At the boundary itself: `boatSpeed *= 0.6` per frame until the boat steers away.
- The camera does not scroll beyond world bounds.

### Boat displacement

Displacement is the boat's weight (tonnes of water displaced). It controls how quickly the boat responds to changes in sail trim or conditions — a heavier boat accelerates and decelerates more slowly.

| Displacement class | Value | Lerp factor multiplier | Feel |
|---|---|---|---|
| Light (Ligero) | 0.8 t | ×1.8 | Snappy, quick to respond |
| Medium (Medio) | 2.0 t | ×1.0 | Balanced (default) |
| Heavy (Pesado) | 5.0 t | ×0.45 | Sluggish, high inertia |

The `lerpFactor` passed to the speed calculation becomes:
```js
const lerpFactor = CONSTANTS.BASE_ACCEL * displacementMultiplier * delta;
boatSpeed = lerp(boatSpeed, targetSpeed, lerpFactor);
```

This means after a tack, a heavy boat takes noticeably longer to rebuild speed — which the Visual Indicators Panel can make visible (see Section 12).

### SailingPhysics interface

```js
// Input
{
  boatHeading: number,        // degrees
  boatSpeed: number,          // knots
  boatPosition: {x, y},
  windDirection: number,      // degrees
  windSpeed: number,          // knots
  sailTrimAngle: number,      // 0–85°
  rudderAngle: number,        // -45° to +45°
  displacement: number,       // tonnes — affects inertia lerp factor
  delta: number,              // seconds since last frame
}

// Output
{
  boatHeading: number,
  boatSpeed: number,
  boatPosition: {x, y},
  AWA: number,
  trimStatus: 'luffing' | 'easing' | 'trimmed' | 'stalled' | 'eased',
  isInIrons: boolean,
  justTacked: boolean,
  justJibed: boolean,
  targetSpeed: number,   // max achievable speed given current wind, point of sail, trim
}
```

---

## 5. Maps

Maps are pure data objects in a `MAPS` array. The game scene reads the selected map and builds the world from it — no map-specific logic inside the scene code itself.

### Map data structure

```js
{
  id: "string",
  nameKey: "map.buoy1.name",           // i18n key — resolved via t()
  worldSize: { width: 3000, height: 3000 },
  startPosition: { x: 0, y: 0 },
  startHeading: 0,                      // degrees, 0 = North
  wind: { direction: 180, speed: 12 }, // default wind for this map
  islands: [
    { points: [[x,y], [x,y], ...], color: '#6B8E23' }
  ],
  docks: [
    { x, y, width, height, heading, labelKey: "map.dock.label" }  // i18n key
  ],
  buoys: [
    { id: 1, x: 0, y: 0, color: '#FF6600' }
  ],
  objectiveKey: "map.buoy1.objective", // i18n key — resolved via t()
  startZone: { x, y, width: 120, height: 40, heading: 0 }
  // startZone: the finish gate. Two posts (port=red, starboard=green) with a dashed line between.
  // Objective completes when boatPosition is inside this rectangle after all buoys are rounded.
}
```

### Buoy rounding detection

A buoy is "rounded" when:
1. The boat comes within `BUOY_DETECTION_RADIUS` (84px = 6 × buoy visual radius) of the buoy centre — entering the detection circle.
2. The boat then exits the detection circle again.

The detection zone is visualised as a **dashed circle** drawn around each pending buoy: 10 alternating segments (every other one skipped), warm gold `#ffcc66`, alpha pulsing between 0.25 and 0.85 at 1.4 s period (Sine.easeInOut). The dashed circle disappears when the buoy is rounded.

Buoys must be rounded **in numeric order** (buoy #1 before #2, etc.). The `ObjectiveTracker` keeps a `nextBuoyIndex` counter that increments on each valid rounding. After all buoys are rounded, the boat must enter the `startZone` to complete the objective.

On rounding: buoy flashes bright yellow for 0.5 s; the dashed detection circle hides; the buoy turns grey (alpha 0.4); a brief text `t('objective.buoy_rounded')` floats up 35 px and fades over 1 s. A ping sound plays and the device vibrates 25 ms (mobile).

### Map 1 — Single Buoy

- Open water. One orange buoy directly to the north of the start.
- Default wind: from North (direction 0°, blowing south), 12 kts.
- The player must tack upwind to reach the buoy, round it, and run back.
- **Learning goal**: experience the no-go zone, practice tacking, understand that you can't sail straight into the wind.

### Map 2 — Two Buoys

- Two buoys: one upwind (north), one downwind (south).
- The player sails a simple beat/run course.
- **Learning goal**: contrast upwind sailing (trimmed in, tacking) vs. downwind sailing (eased out, jibing).

### Map 3 — Triangle (Olympic Course)

- Three buoys forming a triangle: one windward mark (north), one reach mark (northeast), one leeward mark (south).
- Classic racing course: windward leg → reach leg → downwind leg.
- **Learning goal**: experience all points of sail in sequence.

### Map 4 — Island with Dock

- A large island with irregular coastline in the center of the map.
- One dock on the island's leeward side (marked with a visible target zone).
- Shallow reef areas around the island (visually marked; boat speed limited to 1.5 kts in shallow water).
- **Docking succeeds** when the boat overlaps the dock zone at speed < 1 knot, with heading within ±20° of the dock's required approach heading.
- **Learning goal**: controlled slow-speed maneuvering, wind-aware approach angles.

---

## 6. World Configuration

A settings panel accessible from the main menu and from the in-game pause menu.

| Setting | Control | Range / Options | Default |
|---|---|---|---|
| Wind direction | 360° dial | 0–359° | 180° |
| Wind speed | Slider | 5–25 kts | 12 kts |
| Wind variability | Toggle | Off / On (±10° drift) | Off |
| Boat displacement | Selector | Light (0.8 t) / Medium (2.0 t) / Heavy (5.0 t) | Medium |
| Show sail trim guide | Toggle | On / Off | On |
| Show no-go zone arc | Toggle | On / Off | On |
| Show wind arrows on water | Toggle | On / Off | On |
| Show notifications | Toggle | On / Off | On |
| Language | Button group | `ES` / `EN` | `ES` (Spanish) |
| Map | Button group | All map IDs | Map 1 |

The settings panel is accessed via the **pause button** (⏸, top-center) and uses **four tabs**: **Game** (`settings.tab_game`), **Sound** (`settings.tab_sound`), **Layout** (`settings.tab_layout`), and **Indicators** (`indicators.button_label`).

- **Game tab**: wind direction/speed, boat displacement, language.
- **Sound tab**: volume controls for each audio category.
- **Layout tab**: controller slot buttons (6-position grid per controller). This tab replaces the former inline layout section in the Game tab.
- **Indicators tab**: the 5 vector/overlay toggles (see Section 12). This tab replaces the former floating HUD button.

The panel has three always-visible bottom buttons: **Reiniciar** (red), **Continuar** (center, blue), **← Menú** (grey). The Resume button lives at the bottom, not the top.

The Sound tab contains volume controls for each audio category:

| Volume setting | i18n key | Default |
|---|---|---|
| Master volume | `settings.vol_master` | 75% |
| Water ambience | `settings.vol_water` | 100% |
| Sail / garruchos | `settings.vol_luff` | 100% |
| Effects (tack, jibe, ping, collision, completion) | `settings.vol_effects` | 100% |

Each volume row uses `< X% >` buttons (5% per step, range 0%–150%). Values persist to localStorage under key `sailsim_audio`.

When **wind variability** is on, wind direction oscillates ±10° over ~20-second cycles using a sine wave with slight random noise.

### Controller Layout

Both on-screen controllers can be repositioned. The Settings panel includes a dedicated **"Controller Layout"** subsection.

| Setting | Control | Options | Default |
|---|---|---|---|
| Mainsheet Controller position | 3×2 button grid | Top-left / Top-right / Center-left / Center-right / Bottom-left / Bottom-right | Bottom-right |
| Helm Controller position | 3×2 button grid | Same options | Bottom-left |
| Controller opacity | Slider | 40%–100% | 85% |

**Free-drag mode**: a "Customize Layout" button enters a repositioning mode where the user can freely drag each controller anywhere on screen. Sailing is paused during this mode. Exiting saves positions.

Controller positions persist to storage (key `sailsim_layout`) as `{ mainsheet: {x, y}, helm: {x, y} }`. Restored on load; defaults used if absent. The two controllers must never overlap — if they would, snap the second to the nearest non-overlapping position.

---

## 7. Scenes & Navigation Flow

```
MainMenu
  ├── Map selector (card grid, names from t(map.nameKey))
  ├── Settings panel (gear icon)
  └── "Start Sailing" [t('menu.start')] → GameScene

GameScene
  ├── World: water, islands, buoys, docks
  ├── Player boat (physics driven)
  ├── HUD overlay
  ├── Mainsheet Controller widget
  ├── Helm Controller widget
  ├── Indicators button (eye/vector icon) → IndicatorsPanel (floating overlay)
  ├── Pause button → PauseScene (overlay)
  └── Objective complete → completion banner + back-to-menu button

PauseScene (overlay on GameScene — world stays rendered behind)
  ├── Resume  [t('pause.resume')]
  ├── Restart [t('pause.restart')]  → ConfirmDialog [t('confirm.restart_msg')]
  │                                    Yes → reset + resume | No → back to PauseScene
  ├── Settings panel
  └── Back to Menu  [t('pause.menu')]  → ConfirmDialog [t('confirm.exit_msg')]
                                          Yes → MainMenu | No → back to PauseScene

ConfirmDialog (lightweight modal over PauseScene)
  ├── Message text  [dynamic i18n key]
  ├── Confirm  [t('confirm.yes')]
  └── Cancel   [t('confirm.no')]
```

State transitions do not lose world state (map, boat position, wind) unless the player explicitly returns to the menu.

### Tutorial (first run)

Shown the first time a player starts any map (checked via `sailsim_tutorial_done` in storage). A sequence of **coach marks**: a dim full-screen overlay with one element highlighted and a tooltip. The game world is visible but input is blocked until the user taps "Continue" / `t('tutorial.next')`.

| Step | Highlighted element | Key | Text |
|---|---|---|---|
| 1 | Wind HUD indicator | `tutorial.wind` | Shows where the wind comes from |
| 2 | Mainsheet Controller rope | `tutorial.mainsheet` | Pull to trim, ease to release |
| 3 | Helm Controller wheel | `tutorial.helm` | Turn to steer |
| 4 | No-go zone arc on boat | `tutorial.no_go` | Cannot sail directly into the wind |
| 5 | Dismiss | `tutorial.start` | Farewell / good luck message |

After step 5: set `sailsim_tutorial_done = true` in storage. A "View tutorial" button (`t('tutorial.replay')`) in Settings replays it at any time. A "Skip" (`t('tutorial.skip')`) option is available from step 1.

---

## 8. Visual Asset Specification

Assets fall into two categories depending on complexity:

- **World objects** (boat, buoys, water, islands, dock, vectors, overlays): simple geometric shapes well-suited to programmatic drawing in any engine. No external files needed.
- **Controller widgets** (Mainsheet rope and Helm wheel): too complex for clean programmatic drawing — the rope must morph fluidly between shapes and the wheel needs fine detail. These should be implemented as **embedded SVG or base64-encoded sprites** in all engines. The specific embedding technique belongs in Part 2, but the asset design intent is described below for both.

Every asset's visual properties are engine-agnostic; the drawing technique belongs in Part 2.

| Asset | Shape & dimensions | Colors | Behavior |
|---|---|---|---|
| **Boat hull** | Elongated pointed polygon, ~60×18px. Bow is the narrow pointed end. | Cream/white fill, dark grey outline | Rotates with boat heading |
| **Mast** | Filled circle, ~5px radius | Dark grey | Fixed at hull center |
| **Boom** | Line from mast, ~28px long | Dark grey | Points aft along the centerline when trim=0°; sweeps toward the leeward side as trim increases. AWA > 0 (port tack) → boom to starboard; AWA < 0 (starboard tack) → boom to port. |
| **Sail** | 4-vertex polygon: mast (0,0) → sail head (always ~3px toward bow — 15% of full mast height — so head stays near mast in all states) → belly point (midpoint of leech offset toward leeward) → boom clew. Belly depth = `BL × 0.5 × sin(trimAngle)`. trim=0° → flat sail; trim=85° → maximum belly. **Luffing**: head oscillates laterally (flutter) with amplitude ±4px at 18-cycle rate; sail alpha drops to 0.28. **Easing/eased**: gentle flutter ±1.5px. | Semi-transparent white, alpha 0.55 (0.28 when luffing) | Belly grows as sail is eased, shrinks as trimmed in. Flutter animation communicates luffing state clearly. Head remains near mast in all states — this is the permanent visual design choice. |
| **Wake trail (V-wake)** | Two diverging arms from the stern forming a V-shape. Each arm is built from the last ~1.5 s of boat positions, offset laterally from the path. The offset at each stored point grows with age and speed: `offset = (age / 1.5) × maxSpread × (boatSpeed / 15)`. At full speed (~15 kts) the spread reaches ~35 px to each side at the tail. Below 0.5 kts no wake is drawn. Each stored point must record the boat heading at that moment. The perpendicular direction (sideways offset) is `(cos heading, sin heading)` in screen coords — **not** `(-sin, cos)`, which pushes points along the direction of travel instead of sideways. | White / very light blue. Alpha at each point: `1 - (age / 1.5)` — fully opaque at stern, transparent at tail. | Length is naturally speed-dependent: fast boat = positions spread far apart = long wide V. Slow boat = positions close together = short narrow trace. Gives immediate visual sense of speed. |
| **Buoy** | Circle, ~14px radius. Detection zone: dashed circle at 84px radius (6×), gold `#ffcc66`, alpha-pulsing. | Orange fill, white stroke (pending); grey fill on rounding | Number label centered in bold; detection circle disappears and buoy greys out on rounding |
| **Island** | Irregular closed polygon | Sandy/tan at edges, green interior (two-layer polygon) | Static world object |
| **Dock** | Rectangle with alternating light/dark stripes | Tan/brown; target zone in dashed green | Static; target zone highlights when boat is close |
| **Water background** | Fills entire world. Base layer: solid fill. Over it: a layer of short animated dashes drifting in the wind direction, density and intensity driven by wind speed (see wind-reactive water table below). | Base: dark navy blue. Dash color: light blue/white at varying alpha. Stronger wind makes the water subtly darker. | Dashes tile seamlessly and wrap at world edges. Wind speed changes re-parameterize the animation in real time. |
| **Wind arrows (water)** | Small chevron arrows tiled across the water | Low opacity (0.2), white/light blue | Point in wind direction; update only when wind changes |
| **No-go zone arc** | Semi-transparent arc at the bow, ±`NO_GO_ZONE_DEG` spread (±15° = 30° total) | Red, alpha 0.3 | Rotates with boat; togglable |
| **Mainsheet Controller rope** ⚑ | Two SVG states: **taut** (tall ~100×6px straight rope, visible braid cross-hatch pattern) and **eased** (short ~30×18px with 3 sine-wave undulations). The engine lerps between them using `opacity` or `scaleY`/`scaleX` tweens on two overlapping SVG elements, or by morphing SVG path `d` attributes. Cleat handle is a separate small circle element at the bottom. Background panel: rounded rect, dark, alpha 0.5. | Rope: warm brown/tan `#8B6343`. Braid marks: dark `#5C3D1E`. Panel: `#1a1a2e`, alpha 0.5. | Cleat handle drags to control trim. The morph between taut/eased states should feel fluid and continuous, not a swap between two states. |
| **Helm Controller wheel** ⚑ | One SVG: circular wheel (~80px diameter) with 6 spokes and a circular grab handle on the rim, plus an adjacent top-down boat silhouette (~50×16px) with a short rudder line at the stern. The entire wheel SVG rotates as a unit. The rudder line within the silhouette sub-element rotates independently. Background panel: same as rope controller. | Wheel rim and spokes: dark wood `#3D2B1F`. Grab handle: gold `#C9A84C`. Silhouette: cream `#F5F0E0`. Rudder line: dark `#333`. Panel: same as rope. | The SVG root element rotates with helm angle. The rudder sub-element counter-rotates by `helmAngle × 0.5` to show rudder deflection on the mini-boat. PORT/STBD text labels are HTML elements outside the SVG, positioned flanking the panel. |

> ⚑ **Controller widgets** — use embedded SVG or base64 PNG (see Part 2 for engine-specific embedding). Do not attempt to reproduce these with programmatic drawing — the morphing rope and fine wheel detail will produce inferior results.
| **Wind vector arrow** | Arrow from boat center, direction = where wind comes FROM. Length proportional to wind speed (8px per knot, max 120px). Arrowhead at tip. Small speed label beside arrow tip. | Sky blue / light blue. | Rotates with live wind direction; length scales with wind speed. Togglable. |
| **Heading vector (crujía)** | Line from hull center forward along boat heading angle. Fixed length ~80px. Arrowhead at tip. | Bright white / cyan. | Rotates with boat heading. Togglable. |
| **Velocity vector** | Arrow from hull center in actual movement direction (heading + leeway). Length proportional to boat speed (10px per knot). Arrowhead at tip. | Bright green. | May diverge from heading vector when leeway is present — the gap between the two is educationally significant. Togglable. |
| **Inertia indicator** | Small semi-transparent panel near the boat (world space, +36px right, -50px up). Label: "current / target kts". Single bar: dark track = 100% (target), colored fill = current/target ratio. Green fill when current < target (accelerating); amber fill when current > target (coasting on inertia). All alpha ~50% so the world shows through. | Panel bg: `0x0a1628` alpha 0.42. Track: `0x1a2e44` alpha 0.50. Fill: green `0x44ff88` or amber `0xffaa22`, alpha 0.45. | Redrawn every frame on worldGroup overlayGfx. `targetSpeed` comes from `SailingPhysics.update()` return. Togglable (default ON). |
| **Indicators button** | Small square icon button in the HUD corner. Shows a vector/eye icon. | Semi-transparent dark background, white icon. | Opens/closes the IndicatorsPanel floating window. |
| **Start/finish zone** | Two small cylindrical posts (port = red cylinder, starboard = green cylinder, ~12px diameter × 20px tall) with a dashed white line between them spanning the zone width. | Port post: red. Starboard post: green. Dashed line: white, alpha 0.7. | Static world object. When the boat passes through the line after rounding all buoys, the zone flashes briefly and the completion banner fires. |
| **Buoy rounding flash** | Yellow overlay circle (r=16px) fades from alpha 1→0 over 0.5 s via tween, then buoy redraws grey. `t('objective.buoy_rounded')` text rises 35px and fades over 1 s. Detection zone circle is hidden. | Flash: bright yellow. Text: `#ffff44`. Buoy after: grey fill, grey stroke 0.5 alpha. | Triggered once per rounding; buoy stays grey on restart until `_rebuildBuoyVisuals()` is called. |
| **Stuck-in-irons overlay** | Text label `t('irons.label')` rendered in bold red above the boat in world space. The no-go zone arc strokes slowly between full opacity and 40% opacity (pulse rate ~1 Hz). | Label: red. Arc pulse: red, 0.4–1.0 alpha. | Appears and pulses while `isInIrons` is true; disappears immediately on escape. |
| **World edge vignette** | Dark gradient overlay on the screen edge closest to the world boundary. Width: ~100px. | Very dark navy/black, alpha up to 0.4. | Fades in as boat approaches within 150px of world edge; fades out as boat moves away. |
| **Wind shift cue** | The wind direction arrow in the HUD briefly scales up to 1.3× and pulses once when the wind direction changes by more than 5° (only when wind variability is ON). | Arrow: same sky blue as normal, brief bright flash. | Single pulse animation, ~0.4 s duration. Does not repeat until the next shift event. |
| **Tutorial coach mark** | Full-screen dim overlay (alpha 0.6) with a "cut-out" hole revealing the highlighted element. Rounded tooltip box with text and a "Continue" / "Skip" button. | Overlay: dark, alpha 0.6. Tooltip: dark background, white text, rounded corners. Cutout: transparent circle or rounded rect matching the highlighted element. | Input blocked on everything except the Continue/Skip buttons. |
| **Point-of-sail label** | Short text rendered near the boat in world space, just above the no-go zone arc. Shows current point of sail name. Color-coded by category. | Close-hauled: blue. Reach: green. Running: orange. In irons: red. | Toggleable learning aid. Updates continuously as AWA changes. |
| **Sail trim glow — good** | A warm golden halo around the sail, triggered when trim status transitions into `trimmed`. Fades in over 0.2 s and out over 0.8 s (one-shot, not looping). | Warm gold / amber, alpha peaks at 0.5. Applied as additive blend or outer glow on the sail shape. | Fires once per transition into trimmed state. Reinforces correct trimming as a positive reward. |
| **Sail trim glow — luffing** | A cool blue-white shimmer on the sail while `trimStatus === 'luffing'`. Implemented as a rapid opacity oscillation (5–8 Hz) on a blue-tinted overlay of the sail shape. | Icy blue-white, alpha oscillates 0.0–0.35. | Active continuously while luffing; stops immediately when AWA > `NO_GO_ZONE_DEG` (15°). Reinforces the negative state without being distracting. |
| **Objective arrow** | Filled triangle drawn in world space, 105px from the boat centre, pointing toward the next objective (next buoy → start zone → dock). Tip-to-base 20px long, 16px wide base. Bounces ±5% of 105px (≈5px) along the direction vector at ~6 cycles/s to suggest movement. Alpha pulses 0.55–0.90 at ~4 cycles/s. Hidden when `objectiveTracker.complete` is true or distance to target < 20px. | Cyan `0x44eeff` fill + white outline alpha 0.6. | Drawn every frame via `_updateObjectiveArrow(time)` on a dedicated world-layer Graphics. Automatically switches target as buoys are rounded. |
| **Mini-map** | 120×120px overlay fixed at center-left (`x=10`, `y = scale.height/2 - 60`). Islands: dark green filled polygons. Buoys: dots (grey = rounded, orange = pending, bright orange = next). Dock: small tan rect. Boat: 3px white dot + 7px heading arrow. Start zone: short white line. Background: dark semi-transparent rounded rect, depth 22, in uiGroup. | Islands: `0x2a4a2a`. Buoys: grey/orange/bright. Boat: white. Start zone: white alpha 0.7. | Redrawn every frame on mmGfx (uiGroup). Toggleable from Indicators Panel (default ON). |
| **Notification panel** | Pill-shaped banner, ~280px wide × ~40px tall, at top-center of screen. Left border color indicates priority. Text centered. Fades in (0.3 s), stays, fades out (0.3 s). Max 1 visible at a time; queue of up to 3. | Urgent: red border. Warning: yellow. Success: green. Info: blue-grey. Background: dark semi-transparent. | Togglable from Settings. See Notification & Coaching System section for full message catalog. |

### Wind-reactive water — parameter tiers

The water dash animation has three tiers, selected by current wind speed. Transitions between tiers are smooth (lerp parameters over ~1 second when wind speed crosses a threshold).

| Tier | Wind speed | Dash count (per screen) | Dash length | Amplitude | Drift speed | Dash alpha | Water base |
|---|---|---|---|---|---|---|---|
| **Calm** | < 10 kts | 20 | 8 px | 2 px | 0.3 | 0.07 | Dark navy |
| **Choppy** | 10–18 kts | 45 | 13 px | 5 px | 0.8 | 0.15 | Navy, slightly darker |
| **Rough** | > 18 kts | 80 | 18 px | 9 px | 1.5 | 0.25 | Dark grey-blue |

- **Dash count**: number of dashes visible on screen at any time, spread across the world in a grid with random offsets.
- **Amplitude**: dashes are not straight — they follow a short sine-wave path, amplitude = max pixel deviation from a straight line.
- **Drift speed**: dashes move in the wind direction at this multiplier × `windSpeed` px/s. At rest they wrap around to the other side of the screen.
- At the **Rough** tier, add a second layer of slightly larger dashes at 45° offset to the first, giving the appearance of crossed chop.
- The dash grid is defined in world space (not screen space), so it scrolls correctly as the camera follows the boat.

### V-wake — speed reference

| Boat speed | Wake character |
|---|---|
| < 0.5 kts | No wake |
| 0.5–3 kts | Very short, barely visible narrow trace |
| 3–8 kts | Clear V, moderate spread, ~15–20 px wide at tail |
| 8–15 kts | Prominent V, ~30–35 px wide at tail, clearly animated |

### Responsive layout — portrait vs landscape

The game detects orientation on load and on resize, and adjusts controller default positions accordingly. The canvas always fills the viewport.

| Orientation | Mainsheet default | Helm default | HUD |
|---|---|---|---|
| **Landscape** (width > height) | Bottom-right corner | Bottom-left corner | Top strip |
| **Portrait** (height > width) | Center-right, lower third | Center-left, lower third | Top strip |

On **very small portrait screens** (width < 400px): the Indicators Panel is limited to 280px wide and gains vertical scroll if its content overflows. Controller widgets scale down to 80% of their normal size to avoid overlapping the game world.

The layout re-evaluates whenever the window is resized or orientation changes. User-customized positions (from the Layout Manager) override these defaults and are preserved per orientation separately: storage key `sailsim_layout_landscape` and `sailsim_layout_portrait`.

---

## 9. Logical Architecture

The game is organized into the following logical units. Each is independent and has a single clear responsibility. Engine-specific implementations of these belong in Part 2.

```
Game
│
├── CONSTANTS              All tuning values in one place — no magic numbers elsewhere
├── TRANSLATIONS           All user-visible strings (see Section 10)
├── MAPS                   Array of map data objects (see Section 5)
│
├── SailingPhysics         Pure math module — no engine dependency
│     update(state, delta) → newState
│     getAWA(heading, windDir) → degrees
│     getTrimStatus(awa, trimAngle) → trim status key
│
├── InputManager           Single source of truth for control state
│     rudderAxis           number, -1 (full port) to +1 (full starboard)
│     sailTrimTarget       number, 0° (trimmed) to 85° (eased)
│     Reads from: MainsheetController, HelmController, keyboard (optional)
│     Multi-touch: tracks up to 2 pointer IDs independently, one per controller.
│     Each controller claims a pointer ID on touch-start; releases it on touch-end.
│
├── MainsheetController    Renders the rope widget; writes to InputManager
│     draw(trimAngle)
│     onDrag(delta)
│     setPosition(x, y)
│
├── HelmController         Renders the helm wheel widget; writes to InputManager
│     draw(rudderAngle)
│     onDrag(dx, dy)
│     setPosition(x, y)
│
├── LayoutManager          Persists controller positions to storage
│     save()   load()   enterCustomizeMode()   exitCustomizeMode()
│
├── WorldBuilder           Reads a map data object and instantiates world objects
│     build(map) → { islands, buoys, docks, water }
│
├── CollisionSystem        Island and world boundary collision each frame
│     check(boatState, islands, worldSize) → { collision: bool, pushVector, speedMultiplier }
│
├── ObjectiveTracker       Checks completion conditions for the active map
│     nextBuoyIndex        which buoy must be rounded next
│     init(map)            called on scene create
│     update(boatPos, boatSpeed, boatHeading) → { buoyRounded, roundedBuoyIndex, complete, docked }
│     reset()              called by Restart — resets nextBuoyIndex + wasInDetection
│
├── TutorialManager        First-run coach mark sequence
│     start()   next()   skip()   isComplete() → bool
│
├── NotificationSystem     Contextual coaching messages and idle tips
│     push(key, priority, duration)   queues a message
│     update(boatState, gameState)    checks triggers each frame, pushes when conditions met
│     render()                        draws the current notification pill
│     isEnabled: bool                 from settings toggle
│
├── MiniMap                Small world overview overlay
│     render(boatState, map, camera)  redraws each frame when visible
│     isEnabled: bool                 from IndicatorsPanel toggle
│     cornerPosition: string          from LayoutManager
│
├── IndicatorsPanel        Floating toggle window; renders physics vectors onto the world
│     open()  close()  toggle()
│     indicators: {
│       windVector:    { enabled: bool, draw(boatState, windState) }
│       headingVector: { enabled: bool, draw(boatState) }
│       velocityVector:{ enabled: bool, draw(boatState) }
│       inertiaBar:    { enabled: bool, draw(boatState) }
│     }
│     Each draw() function receives current boat/wind state and renders directly
│     into the world-space overlay layer each frame (only when enabled).
│
└── Scenes / Screens
      MainMenu
      GameScreen     ← owns game loop: reads InputManager → SailingPhysics → render
      PauseScreen
```

Data flows in one direction per frame:
```
InputManager → SailingPhysics.update() → boatState → render + HUD + ObjectiveTracker
                                                     → IndicatorsPanel + MiniMap
                                                     → NotificationSystem.update()
```

---

## 10. Internationalization (i18n)

All text visible to the player must come from the centralized `TRANSLATIONS` object. No string is ever hardcoded in widget draw functions or screen logic — always call `t(key)`.

### Language setup

- Default language: **Spanish** (`'es'`).
- Bundled languages: Spanish (`'es'`) and English (`'en'`).
- Selected language saved to persistent storage under key `sailsim_lang` and restored on load.
- Switching language applies immediately — all active text elements refresh without a full restart.

### t() function

```js
let currentLang = storage.get('sailsim_lang') || 'es';

function t(key) {
  return TRANSLATIONS[currentLang]?.[key]
      ?? TRANSLATIONS['en'][key]
      ?? key;                   // fallback: show the key itself, never crash
}

function setLanguage(lang) {
  currentLang = lang;
  storage.set('sailsim_lang', lang);
  events.emit('lang-changed'); // all screens listen and refresh their text elements
}
```

### TRANSLATIONS object — complete key list

```js
const TRANSLATIONS = {
  es: {
    // HUD
    'hud.speed':               'Velocidad',
    'hud.heading':             'Rumbo',
    'hud.wind_speed':          'Viento',
    'hud.wind_from':           'De',

    // Mainsheet controller states
    'trim.eased':              'FILADA',
    'trim.easing':             'FILANDO…',
    'trim.trimmed':            'CAZADA',
    'trim.stalled':            'PARADA',
    'trim.luffing':            'FLAMEA',
    'trim.label_ease':         'FILAR',   // gauge label on controller widget (action)
    'trim.label_trim':         'CAZAR',   // gauge label on controller widget (action)

    // Helm controller
    'helm.label':              'CAÑA',    // panel title
    'helm.port':               'BABOR',
    'helm.starboard':          'ESTRIBOR',

    // Map names
    'map.buoy1.name':          'Una Boya',
    'map.buoy2.name':          'Dos Boyas',
    'map.triangle.name':       'Triángulo Olímpico',
    'map.dock.name':           'Muelle',
    'map.dock.label':          'Marina',

    // Map objectives
    'map.buoy1.objective':     'Rodea la boya #1 y regresa al punto de partida.',
    'map.buoy2.objective':     'Navega entre las boyas #1 y #2 alternando ceñida y empopada.',
    'map.triangle.objective':  'Recorrido olímpico: boya #1 → #2 → #3 → largada.',
    'map.dock.objective':      'Atraca en el muelle con velocidad menor a 1 nudo.',

    // Main menu
    'menu.title':              'Simulador de Vela',
    'menu.start':              'Salir a Navegar',
    'menu.settings':           'Configuración',
    'menu.select_map':         'Elige un mapa',

    // Settings panel
    'settings.title':          'Configuración',
    'settings.wind_dir':       'Dirección del viento',
    'settings.wind_speed':     'Velocidad del viento',
    'settings.wind_var':       'Variabilidad del viento',
    'settings.trim_guide':     'Mostrar guía de escota',
    'settings.no_go_arc':      'Mostrar zona muerta',
    'settings.wind_arrows':    'Flechas de viento en el agua',
    'settings.language':       'Idioma',
    'settings.layout':         'Disposición de controles',
    'settings.customize':      'Personalizar disposición',
    'settings.opacity':        'Opacidad de controles',

    // Pause
    'pause.title':             'Pausa',
    'pause.resume':            'Continuar',
    'pause.menu':              'Volver al menú',

    // Objective completion
    'complete.title':          '¡Completado!',
    'complete.back':           'Volver al menú',

    // Learning aids
    'aid.no_go':               'Zona muerta',
    'aid.trim_guide':          'Guía de escota',
    'aid.awa_label':           'AV Aparente',

    // Layout customize mode
    'layout.mode_banner':      'Arrastrá los controles a donde te quede más cómodo',
    'layout.done':             'Listo',

    // Confirm dialogs
    'confirm.yes':             'Sí',
    'confirm.no':              'Cancelar',
    'confirm.restart_msg':     '¿Reiniciar desde el principio?',
    'confirm.exit_msg':        '¿Salir al menú? Se perderá el progreso.',

    // Notifications — contextual
    'notif.trim_close':        'Casi en punto — ajustá un poco más',
    'notif.trim_perfect':      '¡Vela en punto!',
    'notif.luffing_tip':       'La vela flamea — girá para salir de la zona muerta',
    'notif.irons_tip':         'En hierros: filá la escota y da el timón a un lado',
    'notif.tack_success':      'Virada',
    'notif.jibe_success':      'Virada por popa',
    'notif.approach_dock':     'Reducí velocidad para atracar',
    'notif.running_warn':      'Cuidado — riesgo de virada involuntaria',

    // Notifications — idle tips (rotated when nothing else fires)
    'tip.indicators':          '¿Sabías? Activá Indicadores para ver los vectores físicos del barco',
    'tip.displacement':        '¿Sabías? Cambiá el desplazamiento en Configuración para practicar con distintas inercias',
    'tip.wind_dir':            '¿Sabías? Podés cambiar la dirección del viento para practicar distintas ceñidas',
    'tip.maps':                '¿Sabías? Hay 4 mapas — probá el Muelle para practicar atraco',
    'tip.trim_guide':          '¿Sabías? Activá la Guía de Escota para ver la posición ideal de la botabara',
    'tip.tutorial_replay':     '¿Sabías? Podés repetir el tutorial desde Configuración',
    'tip.minimap':             '¿Sabías? Activá el minimapa en Indicadores para ver el recorrido completo',

    // Mini-map
    'indicators.minimap':      'Minimapa',

    // Notifications settings
    'settings.notifications':  'Mostrar notificaciones',

    // Settings panel tabs
    'settings.tab_game':       'Juego',
    'settings.tab_sound':      'Sonido',
    'settings.tab_layout':     'Controles',

    // Volume controls
    'settings.vol_master':     'Volumen general',
    'settings.vol_water':      'Agua',
    'settings.vol_luff':       'Vela (garruchos)',
    'settings.vol_effects':    'Efectos',

    // Layout panel row labels
    'layout.helm_row':         'Timón',
    'layout.ms_row':           'Escota',

    // Stuck in irons
    'irons.label':             'PROA AL VIENTO',

    // Points of sail (for label aid)
    'pos.in_irons':            'Proa al Viento',
    'pos.close_hauled':        'Ceñida',
    'pos.close_reach':         'Descuartelar',
    'pos.beam_reach':          'Través',
    'pos.broad_reach':         'Largo',
    'pos.running':             'Empopada',

    // Pause
    'pause.restart':           'Reiniciar',

    // Objective / buoy events
    'objective.buoy_rounded':  '¡Boya!',
    'objective.return_start':  'Regresá a la largada',

    // Failure
    'fail.title':              'MISIÓN FALLIDA',
    'fail.restart':            'Reiniciar misión',
    'fail.hit_buoy':           'Chocaste con una boya',
    'fail.hit_island':         'Encallaste en una isla',
    'fail.hit_dock':           'Llegaste al muelle demasiado rápido',
    'fail.objective_was':      'Objetivo',

    // Tutorial
    'tutorial.wind':           'Esta flecha muestra de dónde viene el viento.',
    'tutorial.mainsheet':      'Cazá el cabo para tensar la vela. Filalo para soltarla.',
    'tutorial.helm':           'Mové la caña de lado a lado para maniobrar el barco. Caña a babor → barco a estribor, y viceversa.',
    'tutorial.no_go':          'No podés navegar directo contra el viento. Apuntá a un lado.',
    'tutorial.start':          '¡Buen viento!',
    'tutorial.next':           'Continuar',
    'tutorial.skip':           'Saltear',
    'tutorial.replay':         'Ver tutorial',

    // Visual Indicators Panel
    'indicators.button_label': 'Indicadores',
    'indicators.panel_title':  'Indicadores Visuales',
    'indicators.wind_vector':  'Vector de viento',
    'indicators.heading':      'Dirección de crujía',
    'indicators.velocity':     'Vector de velocidad',
    'indicators.inertia':      'Inercia del barco',
    'indicators.displacement': 'Desplazamiento',
    'indicators.disp_light':   'Ligero',
    'indicators.disp_medium':  'Medio',
    'indicators.disp_heavy':   'Pesado',
    'indicators.target_speed': 'Vel. objetivo',
    'indicators.current_speed':'Vel. actual',
  },

  en: {
    // HUD
    'hud.speed':               'Speed',
    'hud.heading':             'Heading',
    'hud.wind_speed':          'Wind',
    'hud.wind_from':           'From',

    // Mainsheet controller states
    'trim.eased':              'EASED',
    'trim.easing':             'EASING…',
    'trim.trimmed':            'TRIMMED',
    'trim.stalled':            'STALLED',
    'trim.luffing':            'LUFFING',
    'trim.label_ease':         'EASE',    // gauge label on controller widget (action)
    'trim.label_trim':         'TRIM',    // gauge label on controller widget (action)

    // Helm controller
    'helm.label':              'TILLER',  // panel title
    'helm.port':               'PORT',
    'helm.starboard':          'STBD',

    // Map names
    'map.buoy1.name':          'Single Buoy',
    'map.buoy2.name':          'Two Buoys',
    'map.triangle.name':       'Olympic Triangle',
    'map.dock.name':           'Island Marina',
    'map.dock.label':          'Marina',

    // Map objectives
    'map.buoy1.objective':     'Round buoy #1 and return to the start.',
    'map.buoy2.objective':     'Sail between buoys #1 and #2, alternating upwind and downwind legs.',
    'map.triangle.objective':  'Olympic course: buoy #1 → #2 → #3 → start.',
    'map.dock.objective':      'Dock at the marina at less than 1 knot.',

    // Main menu
    'menu.title':              'Sailing Simulator',
    'menu.start':              'Start Sailing',
    'menu.settings':           'Settings',
    'menu.select_map':         'Select a map',

    // Settings panel
    'settings.title':          'Settings',
    'settings.wind_dir':       'Wind direction',
    'settings.wind_speed':     'Wind speed',
    'settings.wind_var':       'Wind variability',
    'settings.trim_guide':     'Show trim guide',
    'settings.no_go_arc':      'Show no-go zone',
    'settings.wind_arrows':    'Wind arrows on water',
    'settings.language':       'Language',
    'settings.layout':         'Controller layout',
    'settings.customize':      'Customize layout',
    'settings.opacity':        'Controller opacity',

    // Pause
    'pause.title':             'Paused',
    'pause.resume':            'Resume',
    'pause.menu':              'Back to Menu',

    // Objective completion
    'complete.title':          'Completed!',
    'complete.back':           'Back to Menu',

    // Learning aids
    'aid.no_go':               'No-go zone',
    'aid.trim_guide':          'Trim guide',
    'aid.awa_label':           'App. Wind',

    // Layout customize mode
    'layout.mode_banner':      'Drag the controllers to wherever feels comfortable',
    'layout.done':             'Done',

    // Confirm dialogs
    'confirm.yes':             'Yes',
    'confirm.no':              'Cancel',
    'confirm.restart_msg':     'Restart from the beginning?',
    'confirm.exit_msg':        'Exit to menu? Current progress will be lost.',

    // Notifications — contextual
    'notif.trim_close':        'Almost there — trim a little more',
    'notif.trim_perfect':      'Perfect trim!',
    'notif.luffing_tip':       'Sail is luffing — turn away from the wind',
    'notif.irons_tip':         'In irons: ease sail and apply helm to one side',
    'notif.tack_success':      'Tacked',
    'notif.jibe_success':      'Jibed',
    'notif.approach_dock':     'Reduce speed to dock',
    'notif.running_warn':      'Caution — accidental jibe risk',

    // Notifications — idle tips
    'tip.indicators':          'Did you know? Enable Indicators to see the boat\'s physics vectors',
    'tip.displacement':        'Did you know? Change displacement in Settings to practice with different inertia',
    'tip.wind_dir':            'Did you know? You can change wind direction to practice different tacks',
    'tip.maps':                'Did you know? There are 4 maps — try the Marina map to practice docking',
    'tip.trim_guide':          'Did you know? Enable Trim Guide to see the ideal boom position',
    'tip.tutorial_replay':     'Did you know? You can replay the tutorial from Settings',
    'tip.minimap':             'Did you know? Enable the mini-map in Indicators to see the full course',

    // Mini-map
    'indicators.minimap':      'Mini-map',

    // Notifications settings
    'settings.notifications':  'Show notifications',

    // Settings panel tabs
    'settings.tab_game':       'Game',
    'settings.tab_sound':      'Sound',
    'settings.tab_layout':     'Controls',

    // Volume controls
    'settings.vol_master':     'Master volume',
    'settings.vol_water':      'Water',
    'settings.vol_luff':       'Sail (hanks)',
    'settings.vol_effects':    'Effects',

    // Layout panel row labels
    'layout.helm_row':         'Helm',
    'layout.ms_row':           'Sail',

    // Stuck in irons
    'irons.label':             'IN IRONS',

    // Points of sail (for label aid)
    'pos.in_irons':            'In Irons',
    'pos.close_hauled':        'Close-hauled',
    'pos.close_reach':         'Close Reach',
    'pos.beam_reach':          'Beam Reach',
    'pos.broad_reach':         'Broad Reach',
    'pos.running':             'Running',

    // Pause
    'pause.restart':           'Restart',

    // Objective / buoy events
    'objective.buoy_rounded':  'Buoy!',
    'objective.return_start':  'Return to start',

    // Failure
    'fail.title':              'MISSION FAILED',
    'fail.restart':            'Restart mission',
    'fail.hit_buoy':           'You crashed into a buoy',
    'fail.hit_island':         'You ran aground on an island',
    'fail.hit_dock':           'You crashed into the dock too fast',
    'fail.objective_was':      'Objective',

    // Tutorial
    'tutorial.wind':           'This arrow shows where the wind is coming from.',
    'tutorial.mainsheet':      'Pull the rope to trim your sail. Ease it to release.',
    'tutorial.helm':           'Move the tiller side to side to steer the boat. Tiller to port → boat turns starboard, and vice versa.',
    'tutorial.no_go':          'You cannot sail directly into the wind. Aim to one side.',
    'tutorial.start':          'Good luck. Set sail!',
    'tutorial.next':           'Continue',
    'tutorial.skip':           'Skip',
    'tutorial.replay':         'View tutorial',

    // Visual Indicators Panel
    'indicators.button_label': 'Indicators',
    'indicators.panel_title':  'Visual Indicators',
    'indicators.wind_vector':  'Wind vector',
    'indicators.heading':      'Heading vector (keel line)',
    'indicators.velocity':     'Velocity vector',
    'indicators.inertia':      'Boat inertia',
    'indicators.displacement': 'Displacement',
    'indicators.disp_light':   'Light',
    'indicators.disp_medium':  'Medium',
    'indicators.disp_heavy':   'Heavy',
    'indicators.target_speed': 'Target speed',
    'indicators.current_speed':'Current speed',
  },
};
```

### Adding a new language

Add a new top-level key (e.g. `'pt'`) with all the same keys. Add that code to the Language selector in Settings. No other code changes needed.

### Rules

- Every string visible to the player MUST have an entry in both `'es'` and `'en'` blocks.
- Map `nameKey` and `objectiveKey` fields are i18n keys resolved at render time via `t()`.
- `TRANSLATIONS` is defined before any screen/scene code so `t()` is available globally from the first frame.

---

## 11. Learning Aids (Toggleable)

Visual overlays to help beginners understand what's happening. All togglable via Settings.

| Aid | i18n key | What it shows |
|---|---|---|
| **No-go zone arc** | `aid.no_go` | Red arc in front of the bow, ±`NO_GO_ZONE_DEG` (±15° = 30° total) — the range where sailing is impossible |
| **Sail trim guide** | `aid.trim_guide` | Ghost boom line showing the *optimal* trim angle for the current AWA (dashed) |
| **Wind arrows on water** | — | Low-opacity directional arrows across the water background |
| **AWA readout** | `aid.awa_label` | Small number near the boat showing current Apparent Wind Angle in degrees |
| **Point-of-sail label** | `pos.*` keys | Text near the boat showing the current point of sail (e.g. "Ceñida", "Través"). Color-coded: close-hauled = blue, reach = green, running = orange, in irons = red. Updates continuously as AWA changes. |

When the trim guide is on, render a dashed boom line at the optimal angle alongside the actual boom. The player learns to match the solid boom to the dashed guide.

---

## 12. Visual Indicators Panel

The Indicators Panel is the **4th tab** of the pause panel (`t('indicators.button_label')`). It does **not** have a separate floating HUD button — all access is through the pause menu. The game must be paused to toggle indicators, but the overlays remain visible while playing once enabled.

### Tab UI (inside pause panel)

```
┌─────────────────────────────────┐
│  🔵  Vector de viento     [OFF] │
│                                 │
│  ⬜  Dirección de crujía  [OFF] │
│                                 │
│  🟢  Vector de velocidad   [ON] │
│                                 │
│  🟡  Inercia del barco     [ON] │
│                                 │
│  🗺  Minimapa              [ON] │
└─────────────────────────────────┘
```

- Each row: colored dot (radius 6px), label (from `t()`, 13px), ON/OFF toggle button (13px, padding {x:12,y:8}), right-aligned.
- 5 rows distributed equitably across the content area (~50px step).
- `buildTabContent(container)` method is called from `_buildPausePanel()` and adds rows to the tab group container.
- No standalone floating panel or HUD toggle button.

### Indicators

#### 1. Wind Vector (`indicators.wind_vector`) — default OFF

- **What it shows**: where the wind is coming FROM, and how strong it is.
- **Visual**: arrow drawn from the boat center in world space. Direction points toward the wind source (`rad = DegToRad(windDir - 90)`). Length scales with wind speed: `length = windSpeed * 8px` (capped at 120px). Arrowhead at the tip.
- **Color**: sky blue `0x99ccff`.
- **Updates**: every frame (rotates with live wind; length changes if speed changes).

#### 2. Heading Vector / Crujía (`indicators.heading`) — default OFF

- **What it shows**: the exact direction the boat's bow (keel line) is pointing.
- **Visual**: arrow from the hull center forward along boat heading. Fixed length 80px. Arrowhead at tip.
- **Color**: white `0xffffff`.
- **Educational value**: when leeway is present, this line diverges from the velocity vector — the player can see the boat is slipping sideways relative to where the bow points.

#### 3. Velocity Vector (`indicators.velocity`) — default ON

- **What it shows**: the boat's actual direction of movement (heading + leeway drift). Derived from the position delta each frame (`Math.atan2(dy, dx)` converted to heading convention).
- **Visual**: arrow from the hull center. Direction = actual movement direction. Length = `boatSpeed * 10px` (capped at 100px). Arrowhead at tip.
- **Color**: bright green `0x44ff88`.
- **Educational value**: when both heading and velocity vectors are enabled simultaneously, the leeway angle gap between the two arrows is clearly visible.

#### 4. Inertia Indicator (`indicators.inertia`) — default ON

- **What it shows**: how quickly the boat is reaching its maximum possible speed for the current conditions (wind, point of sail, trim).
- **Visual**: small semi-transparent panel anchored near the boat in world space (offset `+36px` right, `-50px` up from boat center):
  ```
  ┌──────────────────────────────┐
  │  4.2 / 8.0 kts               │  ← "current / target kts"
  │  ████████████░░░░░░░░░░░░░░  │  ← single bar, fill = current/target %
  └──────────────────────────────┘
  ```
  - **Label**: `"current / target kts"` — actual speed / maximum achievable speed.
  - **Bar track** (dark): represents 100% = target speed.
  - **Bar fill** (color): `current / target` ratio × bar width.
    - **Green** `0x44ff88`: current < target — boat is still accelerating.
    - **Amber** `0xffaa22`: current > target — boat is decelerating from inertia (e.g. after entering a slower point of sail or the no-go zone).
  - All alphas at ~50%: panel bg `0.42`, track `0.50`, fill `0.45`.
- **Updates**: every frame. `targetSpeed` is exposed by `SailingPhysics.update()` return value.

#### 5. Mini-map (`indicators.minimap`) — default ON

- **What it shows**: a scaled-down top view of the entire world so the player can orient themselves without scrolling.
- **Visual**: 120×120px overlay, **center-left** of screen (`x=10`, `y = scale.height/2 - 60`). Dark semi-transparent background. Islands as dark filled polygons. Buoys as dots (grey = rounded, orange = pending, bright = next target). Dock as small tan rect. Boat as a 3px white dot with a 7px heading arrow. Start zone as a short white line.
- **Scale**: `scl = 120 / worldSize.width` (e.g. 3000px world → 1:25).
- **Updates**: redrawn every frame via `mmGfx` (UI camera layer, depth 22).

### Indicator state persistence

The on/off state of each indicator is saved to persistent storage under key `sailsim_indicators` as `{ windVector: bool, heading: bool, velocity: bool, inertia: bool, minimap: bool }`. Restored on load.

---

## 13. Notification & Coaching System

A reserved screen area (top-center by default) that displays contextual coaching messages and, when nothing is happening, idle tips about simulator features. Toggleable from Settings (`settings.notifications`). Default: ON.

### Visual design

A pill-shaped banner (~280px wide × 40px tall). Left-border color indicates priority. Text is centered. Transition: fade in 0.3 s → hold → fade out 0.3 s. Maximum 1 notification visible at a time. A queue of up to 3 messages processes in order; lower-priority messages are dropped if the queue is full. No notification blocks game input.

| Priority | Border color | Example use |
|---|---|---|
| `urgent` | Red | Stuck in irons for 3 s |
| `warning` | Yellow | Approaching dock too fast |
| `success` | Green | Perfect trim, tack confirmed |
| `info` | Blue-grey | Idle feature tips |

### Contextual messages (game-state triggers)

These fire in response to specific game events. Each key has a cooldown to avoid repetition.

| Key | Trigger condition | Priority | Duration | Cooldown |
|---|---|---|---|---|
| `notif.trim_close` | `trimError < 10°` and not yet `trimmed`, sustained 2 s | `info` | 3 s | 15 s |
| `notif.trim_perfect` | Transition into `trimmed` status | `success` | 2 s | 10 s |
| `notif.luffing_tip` | AWA < `NO_GO_ZONE_DEG` for first time in session | `info` | 4 s | 60 s |
| `notif.irons_tip` | `isInIrons` for > 3 s | `urgent` | 5 s | 20 s |
| `notif.tack_success` | `justTacked` event | `success` | 1.5 s | 5 s |
| `notif.jibe_success` | `justJibed` event | `success` | 1.5 s | 5 s |
| `notif.approach_dock` | Map 4 only: boat within 200px of dock and `boatSpeed > 2 kts` | `warning` | 4 s | 8 s |
| `notif.running_warn` | AWA > 160° and `windSpeed > 15 kts` | `warning` | 4 s | 30 s |

### Idle tips (no specific trigger)

When no contextual message has fired in the last 30 seconds, cycle through the idle tips pool in order. Each idle tip shows for 6 seconds. The pool is:

```
tip.indicators, tip.displacement, tip.wind_dir, tip.maps,
tip.trim_guide, tip.tutorial_replay, tip.minimap
```

Once all tips have been shown, the cycle repeats. Tips are `info` priority and are dropped if a contextual message fires while one is showing.

### NotificationSystem logic

```js
// Called every frame
NotificationSystem.update(boatState, gameState) {
  if (!isEnabled) return;
  checkContextualTriggers(boatState, gameState);  // push if conditions met + cooldown ok
  if (timeSinceLastMessage > 30s) pushNextIdleTip();
  renderCurrentNotification(delta);               // handle fade in/out, queue advancement
}
```

Notification state (current message, queue, tip index, cooldowns) is not persisted — it resets each session.

---

## 14. Audio

All sounds are synthesized procedurally using the **Web Audio API** — no external audio files.

### Sound catalog

| Sound | Trigger | Character |
|---|---|---|
| Water ambience | Continuous while sailing; gain proportional to `boatSpeed` | Two-layer filtered noise: LPF 90 Hz (hull rumble) + BPF 380 Hz (water burble). Each layer modulated by three sine LFOs at irrational-ratio frequencies (e.g. 0.37/0.61/1.19 Hz) so the pattern never repeats |
| Sail luff / garruchos | `trimStatus === 'luffing'` | Discrete scheduled metallic transients simulating garruchos (sail slides) rattling on the mast track. Three overlapping BPF noise bursts per flap (1800/3200/5000 Hz), fast attack + exponential decay. Flap rate proportional to how deep in the no-go zone × wind speed (`flapFactor = windFactor × (0.5 + depthFactor)`, range 0.25–1.4) |
| Tack | On `justTacked` | Short bandpass noise burst (1100 Hz) + descending sine tone (300→110 Hz) |
| Jibe | On `justJibed` | Lower bandpass noise burst (550 Hz) + deeper sine tone (160→45 Hz) |
| Buoy ping | On `buoyRounded` | Two sine partials (880 Hz + 1320 Hz), slow decay ~1.2 s |
| Collision | On `_triggerFailure` | Low sine thud (95→22 Hz) + lowpass noise burst (280 Hz) |
| Objective complete | On `_showCompletion` | Ascending C5–E5–G5 chord sequence (523/659/784 Hz), ~1.5 s total |

### Pause and resume

Audio is suspended when the game pauses and resumed when it unpauses:

| Event | Audio action |
|---|---|
| Game paused (`_togglePause`, failure panel shown) | `audio.suspend()` — stops all AudioContext processing |
| Game resumed (`_togglePause`, `_restartMap`) | `audio.resume()` — AudioContext continues from where it left off |
| Completion banner shown | `playCompletion()` then `suspend()` after 1.8 s (allows the chime to finish) |
| Failure | `playCollision()` then `suspend()` after 0.6 s |

### Autoplay policy

`AudioContext` is **not created on construction**. `SailingAudio` is instantiated early in `create()` so panels can call `getVol()` (which reads localStorage only). The AudioContext is created on the **first user gesture** (`pointerdown` or `keydown`). This satisfies browser autoplay policies without deferring the volume UI.

---

# PART 2 — Implementation: Web / Phaser

> This part is platform-specific. To build for a different target, **replace all sections
> below** with the equivalent for your engine (e.g. "Implementation: Godot 4",
> "Implementation: Unity WebGL") and leave Part 1 completely unchanged.
>
> Current target: **Multi-file web app using Phaser (verify current stable version at phaser.io)**, loaded by a single `index.html`. Files are generated and tested independently; concatenated into one file for release if needed.

---

## 13. Technical Stack

| Decision | Choice | Reason |
|---|---|---|
| Delivery | `index.html` loads multiple `.js` files in order | Each file is generated and tested independently; concatenated for release if needed |
| Game library | **Phaser** (latest stable — verify at phaser.io) via CDN | Scene management, WebGL, input, tweens, time, cameras |
| Physics | Custom `SailingPhysics` class (see Section 4) | Sailing math is domain-specific; **do NOT use Phaser Arcade Physics or Matter.js** |
| Rendering | Phaser WebGL (Canvas fallback) | Phaser default |
| World assets | `Phaser.GameObjects.Graphics` (programmatic drawing) | Simple geometry, no external files |
| Controller widgets | SVG template literals in their `.js` files → base64 → `this.textures.addBase64()` | Rope morph and wheel detail require SVG quality; avoids external files |
| All game UI | **100% Phaser GameObjects** — zero HTML DOM for any panel, button, or overlay | HTML DOM over canvas causes unresolvable pointer-event conflicts; see Rule 1 in Section 16 |
| Scaling | `Phaser.Scale.FIT` + `autoCenter: Phaser.Scale.CENTER_BOTH`, base 800×600 | Works on all screen sizes |
| Touch | Phaser pointer events; multi-touch via `input: { activePointers: 3 }` in game config | Must explicitly declare pointer count or Phaser only tracks 1 |
| Audio | Standalone `window.AudioContext` created on first user gesture in `SailingAudio.start()` | Procedural synthesis; no external files; completely independent of Phaser's sound system |
| Persistence | `localStorage` | Controller positions, language, indicator states |

---

## 14. File Structure & Load Order

```
project/
├── index.html                  ← loads Phaser CDN + all JS files; creates Phaser.Game
├── theme.js                    ← THEME object — 33 semantic UI color tokens (loaded first, before constants.js)
├── constants.js                ← CONSTANTS object
├── translations.js             ← TRANSLATIONS + t() + setLanguage()
├── maps.js                     ← MAPS array
├── sailing-physics.js          ← SailingPhysics class — NO Phaser dependency
├── audio.js                    ← AudioManager (Web Audio synthesis)
├── input-manager.js            ← InputManager (Phaser pointer events → rudderAxis, sailTrimTarget)
├── mainsheet-controller.js     ← MainsheetController (Phaser Container widget)
├── helm-controller.js          ← HelmController (Phaser Container widget + wheel math)
├── layout-manager.js           ← LayoutManager (localStorage)
├── objective-tracker.js        ← ObjectiveTracker
├── notification-system.js      ← NotificationSystem
├── tutorial-manager.js         ← TutorialManager
├── indicators-panel.js         ← IndicatorsPanel + MiniMap
├── menu-scene.js               ← MenuScene  (Phaser.Scene)
├── game-scene.js               ← GameScene  (Phaser.Scene)
└── pause-scene.js              ← PauseScene (Phaser.Scene)
```

`index.html` structure — the only HTML needed:

```html
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0a0a1a; overflow: hidden; }
    canvas { display: block; }
  </style>
</head>
<body>
  <!-- Verify and use the current stable Phaser CDN URL from phaser.io -->
  <script src="https://cdn.phaser.io/releases/x.x.x/phaser.min.js"></script>
  <!-- Load in dependency order -->
  <script src="theme.js"></script>
  <script src="constants.js"></script>
  <script src="translations.js"></script>
  <script src="maps.js"></script>
  <script src="sailing-physics.js"></script>
  <script src="audio.js"></script>
  <script src="input-manager.js"></script>
  <script src="mainsheet-controller.js"></script>
  <script src="helm-controller.js"></script>
  <script src="layout-manager.js"></script>
  <script src="objective-tracker.js"></script>
  <script src="notification-system.js"></script>
  <script src="tutorial-manager.js"></script>
  <script src="indicators-panel.js"></script>
  <script src="menu-scene.js"></script>
  <script src="game-scene.js"></script>
  <script src="pause-scene.js"></script>
  <script>
    new Phaser.Game({
      type: Phaser.AUTO,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 800,
        height: 600,
      },
      backgroundColor: '#0a0a1a',
      scene: [MenuScene, GameScene, PauseScene],
      input: { activePointers: 3 },  // REQUIRED for multi-touch
    });
  </script>
</body>
</html>
```

Each `.js` file is independently readable and testable. `sailing-physics.js` has zero Phaser dependency and can be verified in a browser console before the game scene exists. Controller files can be loaded in a minimal Phaser harness before the full game is built.

---

## 14b. Color Theme System (`theme.js`)

All UI colors live in a single `THEME` object defined in `theme.js`, loaded before any other game script. This is the single source of truth for the visual palette — never use raw color literals in UI code.

### Why two formats?

Phaser has two color APIs that require different types:
- **Graphics** (`fillStyle`, `lineStyle`) take **hex integers**: `0xRRGGBB`
- **Text** (`scene.add.text`, `{ color: ... }`) take **CSS strings**: `'#rrggbb'`

`THEME` stores both variants where a color is used in both contexts (e.g., `gold: 0xC9A84C` and `goldStr: '#c8a050'`). Never pass a `0x` integer to a text `color` option, and never pass a `'#'` string to `fillStyle`.

### What goes in THEME vs CONSTANTS.COLORS

- **`THEME`** — UI chrome: panels, text, buttons, notifications, widgets, labels, result panels.
- **`CONSTANTS.COLORS`** — world/game colors: water, hull, islands, buoys. These are rendering constants, not UI palette entries.

### Token reference

```js
const THEME = {
  // Panel chrome (backgrounds, borders, tracks)
  panelBg:        0x1a1a2e,   // control widget panels (α 0.55)
  panelBgDark:    0x0c1624,   // pause panel (α 0.97)
  panelBgDeep:    0x08121e,   // notifications / tutorial / mini-map bg
  panelBorder:    0x3a3a5e,   // control widget borders
  panelBorderAlt: 0x2a4a6e,   // pause / tutorial / mini-map borders
  trackBg:        0x080810,   // dark inset track (rope widget)

  // Text hierarchy
  textPrimary:    '#ffffff',
  textAccent:     '#44ddff',  // highlighted values, active tabs
  textBright:     '#ccddff',  // secondary bright labels
  textSoft:       '#aaccdd',  // world-space labels (inertia, tutorial body)
  textSub:        '#99aabb',
  textLabel:      '#8899aa',  // dim label text, helm PORT/STBD idle, HUD timer
  textDim:        '#667788',  // widget titles, toggle OFF state
  textMuted:      '#556677',  // tutorial step counter, metadata

  // Gold (wind config, active-displacement, special)
  gold:           0xC9A84C,   // hex integer for graphics
  goldStr:        '#c8a050',  // CSS string for text
  goldBright:     '#ffcc44',  // active wind-config button text

  // Notification severity
  notifDanger:    0xff4444,
  notifWarn:      0xffcc44,
  notifOk:        0x44ff88,
  notifInfo:      0x6688aa,

  // Point-of-sail label colors
  posIrons:       '#ff5555',
  posCloseHauled: '#44ddff',
  posCloseReach:  '#44ff99',
  posBeamReach:   '#aaff44',
  posBroadReach:  '#ffcc44',
  posRunning:     '#ff8844',

  // Failure panel
  failureBg:      0x1a0000,
  failureBorder:  0xcc2222,
  failureText:    '#ff4444',

  // Outcome panels
  completionText: '#44ffaa',  // success title, toggle ON state
  restartText:    '#ff8866',  // restart button text

  // Buttons
  btnBg:          '#1a2a3a',
  btnBgDark:      '#0d1a2a',

  // Menu wood buttons (MenuScene)
  woodNormal:     0xd4a96e,
  woodHover:      0xe8bf78,
  woodBorder:     0x7a4010,
  woodText:       '#1a2a5c',
};
```

---

## 15. Build Phases

Build and verify strictly in order. **Do not proceed to the next phase until all checks pass.**

### Phase 1 — World Foundation

**Files**: `constants.js`, `translations.js`, `maps.js`, `game-scene.js` (skeleton only), `index.html`

**Deliverable**: Boat visible on screen. Arrow keys move the boat (direct heading/speed, no physics yet). Camera follows the boat. Water background renders. World boundary clamps the camera.

**Verification**:
- [ ] Canvas fills the full viewport with no white border or scroll bars
- [ ] Boat shape is visible and rotates with heading
- [ ] Arrow keys move the boat; camera follows smoothly
- [ ] Camera does not scroll past world edges in any direction

---

### Phase 2 — Sailing Physics

**File**: `sailing-physics.js`

**Deliverable**: `SailingPhysics` class, `update()` method. **Zero Phaser dependency** — testable in any browser console.

**Verification** (paste into browser console after loading the file):
```js
const p = new SailingPhysics();
const base = { boatHeading: 90, boatSpeed: 0, windDirection: 0, windSpeed: 12,
               sailTrimAngle: 45, rudderAngle: 0, displacement: 2.0,
               delta: 0.016, boatPosition: {x:0, y:0} };

const beam = p.update(base);
console.assert(beam.AWA === 90, 'AWA should be 90 on beam reach');
console.assert(beam.boatSpeed > 0, 'boat should accelerate on beam reach');

const irons = p.update({ ...base, boatHeading: 0, boatSpeed: 5 });
console.assert(irons.boatSpeed < 5, 'boat should decelerate in no-go zone');

// Tack detection: bring AWA from just-positive to just-negative
const preTack = p.update({ ...base, boatHeading: 2, boatSpeed: 5 });
const postTack = p.update({ ...base, boatHeading: 358, boatSpeed: 5 });
console.assert(postTack.justTacked === true, 'justTacked must fire on wind crossing');
```
- [ ] Beam reach accelerates; no-go zone decelerates
- [ ] `justTacked` fires exactly once when heading crosses through the wind
- [ ] `trimStatus` returns correct value for each AWA range

---

### Phase 3 — Controls

**Files**: `input-manager.js`, `mainsheet-controller.js`, `helm-controller.js`

**Deliverable**: Both widgets rendered. Helm wheel responds to circular drag. Mainsheet morphs between taut and eased. Both operable simultaneously with two fingers.

**Verification**:
- [ ] Dragging the wheel **clockwise** increases helm angle; counter-clockwise decreases it (not inverted, not linear)
- [ ] Releasing the wheel, it springs back toward center gradually
- [ ] Mainsheet handle drag changes trim smoothly from fully eased to fully trimmed
- [ ] Two simultaneous touches on separate controllers do not interfere with each other
- [ ] No jitter when the drag angle crosses the 0°/360° wrap

---

### Phase 4 — HUD & Settings Panel

**Files**: HUD elements in `game-scene.js`, settings panel (as overlay scene or container), `layout-manager.js`

**Deliverable**: HUD shows speed, heading, wind. Settings panel opens, all controls respond, panel closes. **Every element is a Phaser GameObject — zero HTML**.

**Verification**:
- [ ] Settings panel opens on button tap and closes on the close button
- [ ] All sliders, toggles, and button groups in the panel respond to pointer input
- [ ] HUD values (speed, heading, wind) update every frame while sailing
- [ ] No pointer conflict: tapping a panel button works even directly above the canvas

---

### Phase 5 — Maps & Objectives

**Files**: `objective-tracker.js`, full `game-scene.js`

**Deliverable**: All 4 maps load from the map selector. Buoys round in order. Map 4 docking works. Completion banner fires.

**Verification**:
- [ ] Switching maps in settings reloads the world correctly with no leftover objects
- [ ] Buoy ordering is enforced — rounding #2 before #1 has no effect
- [ ] Docking at wrong speed or heading shows no completion
- [ ] Correct docking fires the completion banner
- [ ] Restarting resets boat position, objective tracker, and wake trail

---

### Phase 6 — Polish

**Files**: `audio.js`, `notification-system.js`, `tutorial-manager.js`, `indicators-panel.js`

**Deliverable**: Sound on events, notification pill, tutorial coach marks, indicators panel with all 5 toggles, V-wake, wind-reactive water dashes.

**Verification**:
- [ ] Sound plays on tack, jibe, buoy rounded — zero console errors
- [ ] Water ambience scales with boat speed (silent at rest, audible at 3+ kts)
- [ ] Sail luff sound (metallic garrucho transients) fires when in no-go zone; rate increases deeper in zone and with stronger wind
- [ ] Audio suspends when game pauses and resumes when game resumes
- [ ] Sound tab in settings panel shows four volume controls; adjusting master changes overall volume immediately
- [ ] Volume values persist across page reloads
- [ ] Tutorial fires on first launch; Skip works from step 1; Settings replay works
- [ ] Indicators panel opens/closes without pausing the game; each toggle shows/hides its overlay
- [ ] V-wake absent below 0.5 kts; clear wide V at 8+ kts
- [ ] Water dashes visibly change tier when wind speed crosses 10 kts and 18 kts thresholds

---

## 16. Phaser Best Practices — Critical Rules

These are **hard rules**. Violating them causes bugs that are difficult to diagnose because they don't throw errors — they silently produce wrong behavior.

---

### RULE 1 — Zero HTML DOM for game UI

Every button, panel, text label, toggle, slider, overlay, and widget must be a Phaser GameObject. Never create `<div>`, `<button>`, or any HTML element for in-game UI.

```js
// WRONG — HTML element over canvas receives no pointer events
const btn = document.createElement('button');
btn.textContent = 'Cerrar';
document.body.appendChild(btn);

// CORRECT — Phaser Text with interactive hit area
const closeBtn = this.add.text(x, y, t('settings.close'), style)
  .setInteractive({ useHandCursor: true })
  .on('pointerdown', () => panel.setVisible(false));
```

**Why**: The Phaser canvas captures all pointer events at the browser level. HTML elements rendered on top of it receive no mouse or touch input. This is the root cause of "buttons that don't respond" and "settings panel that can't be closed."

Use **Phaser Containers** to group related elements into reusable panels:

```js
// Settings panel as a Phaser Container — all parts move and show/hide together
function createSettingsPanel(scene) {
  const container = scene.add.container(240, 80);

  const bg = scene.add.graphics()
    .fillStyle(0x1a1a2e, 0.92)
    .fillRoundedRect(0, 0, 320, 460, 12);

  const title = scene.add.text(16, 16, t('settings.title'), STYLE.panelTitle);

  const closeBtn = scene.add.text(290, 16, '✕', STYLE.closeBtn)
    .setInteractive({ useHandCursor: true })
    .on('pointerdown', () => container.setVisible(false));

  container.add([bg, title, closeBtn]);
  container.setScrollFactor(0);   // stays fixed on screen
  container.setVisible(false);
  return container;
}
```

---

### RULE 2 — Multi-touch requires explicit declaration

Phaser tracks exactly 1 pointer by default. A second touch cancels the first — both controllers cannot be used simultaneously without this.

```js
// In Phaser.Game config (index.html):
input: { activePointers: 3 }
```

In `InputManager`, each controller claims its own pointer ID:

```js
this.mainsheetPointerId = null;
this.helmPointerId      = null;

this.input.on('pointerdown', (pointer) => {
  if (mainsheetZone.contains(pointer.x, pointer.y) && this.mainsheetPointerId === null)
    this.mainsheetPointerId = pointer.id;
  else if (helmZone.contains(pointer.x, pointer.y) && this.helmPointerId === null)
    this.helmPointerId = pointer.id;
});

this.input.on('pointermove', (pointer) => {
  if (pointer.id === this.mainsheetPointerId) this._updateMainsheet(pointer);
  if (pointer.id === this.helmPointerId)      this._updateHelm(pointer);
});

this.input.on('pointerup', (pointer) => {
  if (pointer.id === this.mainsheetPointerId) this.mainsheetPointerId = null;
  if (pointer.id === this.helmPointerId)      this.helmPointerId      = null;
});
```

---

### RULE 3 — Helm wheel uses angular delta, not linear delta

Mapping `pointer.deltaX` to rudder angle produces tiller behavior, not wheel behavior — the rudder turns the same direction the pointer moves laterally, instead of rotating with the wheel.

The correct approach is to compute the angle of the pointer **around the wheel center** and measure how that angle changes between frames:

```js
// HelmController — called from pointermove only when helmPointerId matches
_updateHelm(pointer) {
  const dx = pointer.x - this.wheelCenterX;
  const dy = pointer.y - this.wheelCenterY;
  const currentAngle = Math.atan2(dy, dx);

  if (this.prevPointerAngle === null) {
    // First move after pointerdown — initialize without applying delta
    this.prevPointerAngle = currentAngle;
    return;
  }

  let delta = currentAngle - this.prevPointerAngle;
  // Normalize to [-PI, PI] to handle the 0/2PI crossing without a jump
  if (delta >  Math.PI) delta -= 2 * Math.PI;
  if (delta < -Math.PI) delta += 2 * Math.PI;

  this.helmAngle = Phaser.Math.Clamp(
    this.helmAngle + Phaser.Math.RadToDeg(delta),
    -90, 90
  );
  this.prevPointerAngle = currentAngle;
}

// Reset prevPointerAngle on pointerup so next drag starts clean
onPointerUp() {
  this.prevPointerAngle = null;
}
```

---

### RULE 4 — Use a dedicated UI camera, not `setScrollFactor(0)` on individual objects

Setting `setScrollFactor(0)` on dozens of HUD objects individually creates maintenance burden and subtle rendering order bugs. Instead, use a dedicated UI camera that never scrolls:

```js
// GameScene.create()

// Main camera: follows the boat in world space
this.cameras.main.startFollow(this.boatContainer, true, 0.08, 0.08);
this.cameras.main.setBounds(0, 0, map.worldSize.width, map.worldSize.height);

// UI camera: fixed, sees only UI objects
this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height);
this.uiCamera.ignore(this.worldGroup);    // don't render world through UI camera
this.cameras.main.ignore(this.uiGroup);  // don't render UI through main camera

// Add objects to the right group at creation time:
this.worldGroup.add(waterGraphics);
this.worldGroup.add(boatContainer);
this.uiGroup.add(hudContainer);
this.uiGroup.add(helmWidget);
this.uiGroup.add(mainsheetWidget);
```

---

### RULE 5 — Never use `setTimeout` / `setInterval` / `requestAnimationFrame`

These calls survive scene changes and cause ghost callbacks when scenes are restarted. Use Phaser's time system:

```js
// WRONG
setTimeout(() => this.buoyFlash(), 500);

// CORRECT
this.time.delayedCall(500, () => this.buoyFlash(), [], this);

// Repeating events:
this.time.addEvent({
  delay: 200,
  callback: this.tickNotifications,
  callbackScope: this,
  loop: true,
});
```

---

### RULE 6 — Never use `document.addEventListener` for game input

Document-level listeners fire even when the scene is paused, stopped, or destroyed.

```js
// WRONG
document.addEventListener('keydown', handler);

// CORRECT — keyboard
this.cursors = this.input.keyboard.createCursorKeys();
// Then in update(): if (this.cursors.left.isDown) { ... }

// CORRECT — named key
this.input.keyboard.on('keydown-SPACE', handler, this);
```

---

### RULE 7 — Use Tweens for visual animations; do not lerp visual properties in `update()`

Physics state values (`boatSpeed`, `helmAngle`, `sailTrimTarget`) must still be updated in `update()` — that's correct. But visual-only properties (alpha, scale, position of UI elements) should use Tweens so they are self-managing and frame-rate independent:

```js
// WRONG — manual lerp in update() every frame for a one-shot visual effect
this.buoy.alpha = lerp(this.buoy.alpha, 1, 0.1 * delta);

// CORRECT — Tween, fired once, cleans up itself
this.tweens.add({
  targets: buoy,
  fillColor: { from: 0xFFFF00, to: 0xFF6600 }, // yellow flash → orange
  duration: 500,
  ease: 'Sine.easeOut',
});

// Looping pulse (no-go zone arc while in irons):
this.tweens.add({
  targets: noGoArc,
  alpha: { from: 1.0, to: 0.4 },
  duration: 500,
  yoyo: true,
  repeat: -1,
});
```

---

### RULE 8 — Scene launch and transition patterns

```js
// Overlay (PauseScene over GameScene — GameScene stays rendered):
this.scene.launch('PauseScene', { parentKey: 'GameScene' });
this.scene.pause('GameScene');

// Return from overlay:
this.scene.resume('GameScene');
this.scene.stop('PauseScene');

// Full transition (replaces current scene):
this.scene.start('GameScene', { map: selectedMap });

// Cross-scene reference from an overlay:
const gameScene = this.scene.get('GameScene');
gameScene.restartMap();
```

---

### RULE 9 — Suppress browser default touch gestures on the canvas

Without this, pinch-zoom and page scroll activate on mobile, hijacking the drag controls.

```js
// In GameScene.create():
this.game.canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
this.game.canvas.addEventListener('touchmove',  (e) => e.preventDefault(), { passive: false });

// Also suppress right-click context menu on desktop:
this.input.mouse.disableContextMenu();
```

And in `index.html` `<head>`:
```html
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
```

---

### RULE 10 — Clean up listeners in scene shutdown

```js
// In every scene that sets up listeners:
this.events.on('shutdown', () => {
  this.input.off('pointerdown');
  this.input.off('pointermove');
  this.input.off('pointerup');
  this.input.keyboard.off('keydown-SPACE');
  if (this.audioManager) this.audioManager.stopAll();
}, this);
```

---

### Additional Phaser patterns

**Containers for interactive panels** — group a background graphic, labels, and buttons so they move, show, hide, and depth-sort as a unit:

```js
const panel = this.add.container(x, y);
const bg    = this.add.graphics().fillStyle(0x1a1a2e, 0.9).fillRoundedRect(0, 0, w, h, 10);
const label = this.add.text(12, 12, t('key'), STYLE.body);
panel.add([bg, label]);
panel.setScrollFactor(0);
panel.setDepth(10);
```

**Viewport-aware drawing for water effects and wind arrows** (do NOT use a world-sized RenderTexture):

A `RenderTexture` spanning the full `worldSize` (e.g. 3000×3000) can exceed WebGL max texture limits and silently render only a fraction of its content. Instead, draw water dashes and wind arrows each frame using a regular `Graphics` object, computing only the cells visible within the current camera viewport:

```js
// Each frame in update():
_drawWaterEffects(time) {
  const cam   = this.cameras.main;
  const vx    = cam.scrollX,  vy = cam.scrollY;
  const vw    = cam.width  / (cam.zoom || 1);
  const vh    = cam.height / (cam.zoom || 1);
  const margin = spacing * 2;

  // Snap grid origin to world coords — pattern stays stable as camera moves
  const gx0 = Math.floor((vx - margin) / spacing) * spacing;
  const gy0 = Math.floor((vy - margin) / spacing) * spacing;

  g.clear();
  for (let gx = gx0; gx < vx + vw + margin; gx += spacing) {
    for (let gy = gy0; gy < vy + vh + margin; gy += spacing) {
      // draw dash or arrow at (gx, gy) in world space
    }
  }
}
```

Animate drift with a time-based offset modulo spacing so dashes scroll smoothly:
```js
const driftDist = (time * 0.001 * driftSpeed * windSpeed) % spacing;
const driftX = Math.cos(windRad) * driftDist;
const driftY = Math.sin(windRad) * driftDist;
```

**Pointer hit areas for controller widgets must be at least 48×48px:**

```js
// Use a named hitArea geometry, not the default bounding box
wheelImage.setInteractive(
  new Phaser.Geom.Circle(0, 0, 50),   // 100px diameter — generous touch target
  Phaser.Geom.Circle.Contains
);
```

**Resume AudioContext on first user interaction** (browsers suspend audio until a gesture):

```js
this.input.once('pointerdown', () => {
  if (this.sound.context.state === 'suspended')
    this.sound.context.resume();
}, this);
```

---

## 17. Audio — Web Audio Synthesis (`SailingAudio`)

Use the **Web Audio API** directly — **do not use Phaser's sound system or create Phaser sound objects**. A standalone `window.AudioContext` is created manually on the first user gesture. No second AudioContext is needed since Phaser's sound system is not used for game audio.

### Signal chain

```
noise buffer (2s, looped)
  ├── LPF 90 Hz → AM gain ← multiLFO([0.37, 0.61, 1.19] Hz)  } waterGain → catWaterGain
  └── BPF 380 Hz → AM gain ← multiLFO([1.43, 2.31, 3.67] Hz) }

luffGain (fades in/out 0→1 each frame)
  └── _flapBurst nodes (scheduled transients) → catLuffGain

one-shot nodes → catEffectsGain

catWaterGain ─┐
catLuffGain  ─┼→ masterGain → destination
catEffectsGain┘
```

### `SailingAudio` class interface

```js
class SailingAudio {
  constructor()          // reads volume defaults from localStorage — safe before AudioContext
  start()                // creates AudioContext on first user gesture; idempotent
  suspend()              // pauses AudioContext (game pause / failure / completion)
  resume()               // resumes AudioContext (game resume / restart)

  update({ boatSpeed, trimStatus, windSpeed, absAWA })
    // Called every frame:
    // - waterGain.value = max(0, boatSpeed - 0.3) * 0.009
    // - luffGain fades to 1.0 if trimStatus === 'luffing', else fades to 0
    // - while luffing: schedules _flapBurst transients with 120ms lookahead
    //   flapRate = flapFactor / 0.10s where flapFactor ∈ [0.25, 1.4]
    //   flapFactor = windFactor × (0.5 + depthFactor)
    //   depthFactor = max(0, 1 − absAWA / NO_GO_ZONE_DEG)  → 1 at head-to-wind, 0 at edge
    //   windFactor  = min(windSpeed, 25) / 15

  playTack()             // bandpass noise (1100 Hz) + sine tone (300→110 Hz, 0.24 s)
  playJibe()             // bandpass noise (550 Hz) + sine tone (160→45 Hz, 0.35 s)
  playBuoyPing()         // two sine partials: 880 Hz + 1320 Hz, slow decay ~1.3 s
  playCollision()        // low sine thud (95→22 Hz) + lowpass noise (280 Hz)
  playCompletion()       // ascending C5–E5–G5 (523/659/784 Hz), three notes × 0.14 s apart

  setVol(cat, pct)       // cat: 'master' | 'water' | 'luff' | 'effects'; pct 0–1.5
  getVol(cat) → number   // reads _volDefaults — works before AudioContext is created
}
```

### Volume persistence

Volumes are stored in `localStorage` under `sailsim_audio` as `{ master, water, luff, effects }` (all floats 0–1.5). Defaults: `master=0.75`, others=`1.0`. `_loadVolumeDefaults()` is called in the constructor so `getVol()` returns correct values before the AudioContext is created — this allows the Sound settings tab to display accurate percentages immediately.

### Luff transient scheduling

Each "flap" is three overlapping `BufferSourceNode` bursts through bandpass filters:

```
_flapBurst(when, vol*0.6, 1800 Hz, Q=2.5, attack=4ms, decay=55ms) // slide knock
_flapBurst(when+3ms, vol*1.0, 3200 Hz, Q=3.5, attack=2ms, decay=35ms) // metallic ring
_flapBurst(when+1ms, vol*0.7, 5000 Hz, Q=2.8, attack=1ms, decay=18ms) // high click
```

The lookahead window is 120ms. If `_nextFlapTime` falls behind `currentTime`, it resets to `currentTime`. Jitter is 55–145% of the base interval to prevent audible periodicity.

### Aperiodic modulation via irrational LFO ratios

Water layers use LFOs at frequencies whose pairwise ratios are irrational (e.g. 0.37/0.61 ≈ 0.607, not reducible to a simple fraction). This means the combined LFO pattern never repeats — the result sounds organic rather than mechanical.

### create() ordering constraint

`new SailingAudio()` must be called **before** `_buildPausePanel()` (or any panel that calls `audio.getVol()`). The constructor is safe to call at any time — it only reads localStorage. AudioContext creation is deferred to `start()`.

```js
// Correct order in GameScene.create():
this.audio = new SailingAudio();
this.input.once('pointerdown', () => this.audio.start(), this);
this.input.keyboard.once('keydown', () => this.audio.start(), this);
this._buildHUD();
this._buildPausePanel(); // safe — audio exists, getVol() works
```

---

## 18. Rendering & Assets — Phaser Implementation

World assets use **`Phaser.GameObjects.Graphics`**. Controller widgets use **SVG → base64 textures** via `this.textures.addBase64()`. Never attempt to replicate the rope morph or the wheel spokes with the Graphics API.

### World assets — Phaser Graphics API

All Graphics objects belong to named groups (see Rule 4). Each dynamic object clears and redraws each frame on its own Graphics instance — do **not** share a single Graphics object between multiple world elements.

| Asset | Phaser drawing approach |
|---|---|
| **Boat hull** | `graphics.fillStyle(...).fillPoints(polygon, true)` — pointed vertex array |
| **Mast** | `graphics.fillCircle(x, y, 5)` |
| **Boom** | Separate `Graphics` child of the boat Container. Redrawn every frame via `_updateBoom(trimAngle, signedAWA)` — **never use `setAngle()`**. Boom tip in container space (bow=−Y, stern=+Y): `boomSide = AWA ≥ 0 ? 1 : −1` (port tack → starboard); `boomTipX = boomSide × BL × sin(trimRad)`; `boomTipY = BL × cos(trimRad)`. |
| **Sail** | Redrawn in `_updateBoom(trimAngle, signedAWA, trimStatus)`. `g.fillPoints([mast, head, bellyPoint, clew], true)`. Head vertex always at `headY = sailHeadY * 0.15` (stays near mast in all states — permanent visual design choice). Belly point = midpoint of leech offset toward leeward by `BL × 0.5 × sin(trimRad)`. Flutter: `headX = sin(time * 0.018) * boomSide * (luffing ? 4 : easing ? 1.5 : 0)`. Alpha 0.55 normal, 0.28 when luffing. Leeward perpendicular unit: `perpX = boomSide × boomTipY / BL`, `perpY = −boomSide × boomTipX / BL`. Boom line drawn on top. |
| **Wake (V-wake)** | Rolling `{x, y, age, heading, speed}` array — store heading and speed at recording time. Per frame: `graphics.clear()` → for each point compute `spread = (age/1.5)*35*(speed/15)`, perpendicular direction `(cos heading, sin heading)` (NOT `-sin/cos`), draw two lines (port/stbd) with per-point alpha = `1 - age/1.5`. |
| **Buoy** | `graphics.strokeCircle()` + `this.add.text()` label; flash via `this.tweens.add()` |
| **Island** | `graphics.fillPoints(polygon)` with two passes: sandy outer, green inner |
| **Dock** | `graphics.fillRect()` for stripes; dashed outline via short `lineBetween` segments |
| **Water base** | `graphics.fillRect(0, 0, worldW, worldH)` — color component tweened with `this.tweens.addCounter()` as wind speed changes tiers |
| **Water dashes** | Pool of `{x, y, angle, phase}` objects. Each frame: advance `x/y` by wind drift × delta; wrap at world bounds; draw each as 3–4 sine-offset points via `strokePoints`. Re-parameterize count/length/alpha on tier change by tweening pool properties in place — **never recreate the pool**. |
| **Wind arrows** | Viewport-aware `Graphics` — draw only the cells visible in the current camera viewport each frame (see viewport-aware pattern in Section 16). Do NOT use a world-sized `RenderTexture`. |
| **No-go zone arc** | `graphics.slice(x, y, r, startAngle, endAngle)` in red, alpha 0.3. Child of boat Container. Pulsing tween while in irons. |
| **Vector overlays** | Dedicated overlay Graphics above the world layer. `clear()` + redraw each frame only when IndicatorsPanel is open. |

### Controller widgets — SVG → base64

Define SVGs as template literals in their respective `.js` files. Load into Phaser **before** GameScene starts (in a preload step or via a BootScene).

```js
// In mainsheet-controller.js — loaded in preload() of BootScene or MenuScene
const ROPE_TAUT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 110">
  <!-- tall thin rope with diagonal braid cross-hatch marks -->
  <!-- cleat circle at bottom -->
</svg>`;

const ROPE_EASED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 55">
  <!-- short thick rope with 3 sine-wave undulations -->
  <!-- same cleat circle at bottom -->
</svg>`;

// Convert to data URI and load as Phaser texture
function loadRopeTextures(scene) {
  const toURI = svg => 'data:image/svg+xml;base64,' + btoa(svg);
  scene.textures.addBase64('rope-taut',  toURI(ROPE_TAUT_SVG));
  scene.textures.addBase64('rope-eased', toURI(ROPE_EASED_SVG));
}
```

At runtime: render both images at the same position in the Container. Cross-fade alpha to produce the morph:

```js
// In MainsheetController.update(trimAngle):
const t = trimAngle / 85;  // 0 = taut, 1 = eased
this.tautImage.setAlpha(1 - t);
this.easedImage.setAlpha(t);
```

**Helm Controller — one SVG, rudder line drawn separately:**

```js
const HELM_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 140">
  <!-- wheel: outer rim circle, 6 evenly-spaced spokes, grab handle on rim -->
  <!-- mini boat silhouette below wheel (no rudder line here) -->
</svg>`;
```

Load as a single texture. Rotate the entire `this.add.image('helm-wheel')` object for helm angle. Draw the rudder line separately each frame with a thin Graphics overlay at the silhouette's stern, rotated by `helmAngle * 0.5`.

---

## 19. Code Architecture — Phaser

```
index.html           loads CDN + all .js files in order (see Section 14)
                     creates Phaser.Game with { activePointers: 3, scene: [MenuScene, GameScene, UIScene] }
                     UIScene: active:true persistent scene — renders fullscreen toggle button (⛶) at
                       x = scale.width/2 + 35, y = 8, origin (0.5,0), depth 200, hitArea Rectangle(-22,-8,44,44).
                       Hides on enterfullscreen, shows on leavefullscreen.
                       Runs over every scene without interrupting them.
                     Pause button (⏸): in GameScene HUD, x = scale.width/2 - 35, y = 10, hitArea Rectangle(-22,-8,44,44).
                       Both buttons are 70px apart (center-to-center), each with 44×44px tap area (26px gap).

constants.js         CONSTANTS — all tuning values; no dependencies
translations.js      TRANSLATIONS + t() + setLanguage(); no dependencies
maps.js              MAPS array; no dependencies
sailing-physics.js   SailingPhysics — zero Phaser dependency; pure math

audio.js             SailingAudio — standalone Web Audio API synthesis; no Phaser dependency
                     Constructor reads localStorage for volume defaults (safe before AudioContext).
                     start(): creates AudioContext on first user gesture; builds water/luff graph.
                     update({boatSpeed, trimStatus, windSpeed, absAWA}): drives water gain + luff scheduling.
                     suspend()/resume(): wrap AudioContext.suspend/resume for pause/resume.
                     setVol(cat, pct)/getVol(cat): volume control + localStorage persistence ('sailsim_audio').
                     MUST be instantiated before any panel that calls getVol() — see Section 17.

input-manager.js     InputManager — registered in GameScene.create()
                     Listens: this.scene.input.on('pointerdown/move/up')
                     Exposes: rudderAxis [-1,+1], sailTrimTarget [0°,85°]

mainsheet-controller.js
  Phaser Container: panel bg + EASE/TRIM gauge labels (t('trim.label_ease')/t('trim.label_trim')) on left side
    + dark track rect on right side + taut SVG image + eased SVG image + draggable handle circle
  Drag DOWN = cazar (trim in, trimAngle→0). Drag UP = filar (ease out, trimAngle→85).
    delta = -(dy/DRAG_RANGE)*85; trimAngle clamped [0,85].
  Cross-fade taut/eased alpha: taut=1-t, eased=t where t=trimAngle/85.
  Handle y: bottomY - (trimAngle/85)*(bottomY-topY) — moves up as sail is eased.

helm-controller.js
  Phaser Container: panel bg + 'CAÑA' title label (t('helm.label')) + port/stbd Text labels
    + mini-boat silhouette (Graphics, 13×4px hull, 3.33:1 ratio) + tiller Graphics (redrawn each frame)
  Drag: horizontal deltaX → helmAngle (clamped ±90°) → physics return -helmAngle/90 (real tiller inversion)
  Visual: tiller pivot at (0,+41) stern, sweeps ±60° from straight-up (-90°+sweep)
  Desktop: helm holds position on release. Mobile: spring-back 3.0×/s (scene.sys.game.device.os.desktop check)

layout-manager.js    reads/writes localStorage; called by both controllers on drag-end and on load
objective-tracker.js
  Pure logic — no Phaser dependency.
  init(map): stores map reference, resets state.
  update(boatPos, boatSpeed, boatHeading): entry+exit detection for buoys (enter circle, then leave = rounded).
    Returns { buoyRounded, roundedBuoyIndex, complete, docked }.
  Dock detection: boat inside dock rect + speed ≤ DOCK_SUCCESS_SPEED + heading within ±20°.
  reset(): called by _restartMap() — zeroes nextBuoyIndex and wasInDetection.
notification-system.js
  Phaser Container (pill banner) at top-center of UI layer
  update(boatState, gameState, delta) — checks triggers, manages queue, drives fade Tween

tutorial-manager.js
  Phaser Container (full-screen dim overlay + cutout highlight + tooltip Container)
  Uses this.time.delayedCall() for step transitions, not setTimeout

indicators-panel.js  (IndicatorsPanel class)
  Constructor: receives scene, worldGroup, uiGroup, map.
    overlayGfx: Graphics in worldGroup — vectors + inertia bar, redrawn each frame.
    mmGfx: Graphics in uiGroup (depth 22) — mini-map, redrawn each frame.
    _iTgtLbl, _iCurLbl: Text objects in worldGroup for inertia label.
    panel: Container in uiGroup (depth 30, right-center) — 5 toggle rows with colored dots.
    toggleBtn: Text in uiGroup (center-right, x=W-10, y=H/2, origin (1,0.5)) — opens/closes panel.
  update(boatPos, heading, speed, windDir, windSpeed, targetSpeed, objectiveTracker):
    Computes velocity direction from position delta each frame.
    Draws active overlays on overlayGfx (clear each frame).
    Draws mini-map on mmGfx when enabled.
  State persisted to localStorage 'sailsim_indicators'.
  Defaults: windVector=false, heading=false, velocity=true, inertia=true, minimap=true.

menu-scene.js (MenuScene)
  All UI: Containers, Text, Graphics — zero HTML
  Map selector: card grid of interactive Containers
  Settings panel: Container (hidden by default, shown on gear button tap)

game-scene.js (GameScene extends Phaser.Scene)
  preload(): load SVG textures via addBase64
  create():
    → this.audio = new SailingAudio()        ← FIRST: safe before AudioContext; needed by panels
    → register audio.start() on first pointerdown / keydown
    → build world from map data (WorldBuilder pattern)
    → set up worldGroup + uiGroup + cameras
    → _buildHUD(), _buildPausePanel()        ← panels can now call audio.getVol() safely
    → instantiate InputManager, controllers, ObjectiveTracker, NotificationSystem, etc.
  update(time, delta):
    inputManager.flush()
    → if _timerRunning: _timerMs += delta; hudTimer.setText(_formatTime(_timerMs))
    → newState = sailingPhysics.update(boatState, delta)
    → move boat Container (x/y/angle)
    → redraw dynamic Graphics (wake, boom, water dashes)
    → _updateObjectiveArrow(time)    ← world-space cyan arrow pointing to next objective
    → hud.update(newState)
    → obj = objectiveTracker.update(boatPos, boatSpeed, boatHeading)
         if obj.buoyRounded → _flashBuoy(obj.roundedBuoyIndex) + audio.playBuoyPing() + vibrate(25)
         if obj.complete    → _showCompletion()
    → notificationSystem.update(newState, delta)
    → audio.update({ boatSpeed, trimStatus, windSpeed, absAWA })
    → if newState.justTacked → audio.playTack()
    → if newState.justJibed  → audio.playJibe()
    → indicatorsPanel.render(newState)
    boatState = newState

  _togglePause(): flips isPaused; if pausing → audio.suspend(); if resuming → audio.resume()

  _buildCompletionBanner(): Phaser Container depth 60 — dim overlay + "¡Completado!" + elapsed time (22px) + wind config (💨 X kts · Y°, 12px) + Restart + Menu btns
  _showCompletion(): stops timer (_timerRunning=false); updates time/wind text objects; makes banner visible; audio.playCompletion(); isPaused=true; audio.suspend() after 1.8s
  _flashBuoy(i): yellow tween overlay → redraw grey → hide detection circle → float text
  _rebuildBuoyVisuals(): restores all buoys to original color + shows detection circles (called by _restartMap)
  _restartMap(): resets boat state + physics + objectiveTracker + buoy visuals + failure state; resets _timerMs=0, _timerRunning=true, hudTimer text; audio.resume(); returns to play state
  _formatTime(ms): tenths-of-second precision. Returns '1:23.4' when ≥ 1 min, '45.2s' when under 1 min.

  _buildPausePanel(): four-tab container
    Game tab: wind dir/speed (< value > buttons), displacement radio buttons, language (ES/EN), tutorial replay
    Sound tab: four volume rows (master/water/luff/effects) with < X% > buttons; _refreshVolRows() updates display
    Layout tab: 6-slot position grid for helm and mainsheet (arrow-icon buttons, ↖↗←→↙↘)
    Indicators tab: 5 toggle rows built by indicatorsPanel.buildTabContent(container)
    Bottom (always visible): Reiniciar | Continuar | ← Menú — three buttons on one row at y=200
    _setTab(name): shows/hides sub-containers, highlights active tab button
    _refreshVolRows(): reads audio.getVol(cat) for each category — guarded (no-op if audio not ready)
    indicatorsPanel MUST be constructed before _buildPausePanel() — its buildTabContent() is called inside

  _buildFailurePanel(): Phaser Container depth 62 — dark red panel (420×260px), dim overlay alpha 0.36 (semi-transparent
    so wreck is visible), reason text, objective reminder, single "Reiniciar misión" button.
    Panel bg alpha 0.48 so the scene is visible behind it.
  _triggerFailure(type): sets isFailed=true, isPaused=true; audio.playCollision(); audio.suspend() after 0.6s; disables input; shows brokenGraphics; shows failurePanel
  _pointInPolygon(px, py, polygon): ray-casting algorithm for island collision detection

  In _buildBoat(): adds brokenGraphics (red hull overlay + 3 crack lines, setVisible(false)) to boat container

  In update() — collision checks before objective tracking:
    Buoy: dist(boat, buoy) < BOAT_HULL_WIDTH/2 + 14 for any non-rounded buoy → _triggerFailure('buoy')
    Island: _pointInPolygon(boatPos, islandPoly) → _triggerFailure('island')
    Dock: boat in dock bounds AND speed > DOCK_SUCCESS_SPEED*2 → _triggerFailure('dock')

pause-scene.js (PauseScene extends Phaser.Scene)
  Launched as overlay — GameScene stays rendered behind
  Semi-transparent dim bg Graphics + menu Container
  Confirm dialogs: lightweight Containers within PauseScene (not new scenes)
```

Data flow per frame:
```
InputManager → SailingPhysics.update() → boatState → render + HUD
                                                     → collision checks (buoy/island/dock) → _triggerFailure()
                                                     → ObjectiveTracker + _updateObjectiveArrow()
                                                     → IndicatorsPanel + MiniMap
                                                     → NotificationSystem.update()
                                                     → SailingAudio.update()    ← water + luff synthesis
                                                     → SailingAudio.playTack/playJibe on justTacked/justJibed
```

---

## 20. Completion Criteria

### Part 1 — Design & Logic (engine-agnostic)

- [ ] All 4 maps are defined as data objects and are fully playable.
- [ ] Sailing physics produce realistic behavior: no-go zone blocks progress, beam reach is fastest, running is slower than reaching.
- [ ] Tacking and jibing fire correctly (boom swings, speed penalty applies, `justTacked`/`justJibed` flags fire once).
- [ ] Mainsheet Controller rope morphs correctly: long-thin when trimmed, short-wide when eased.
- [ ] Trim status label shows the correct i18n key for all 5 states.
- [ ] Helm Controller wheel rotates on drag; rudder line on mini-boat silhouette moves in sync.
- [ ] PORT/STBD labels highlight correctly when helm is deflected.
- [ ] Both controllers can be repositioned via the 3×2 grid and via free-drag Customize Layout mode.
- [ ] Controller positions persist to storage and are restored on reload.
- [ ] Docking on Map 4 detects success correctly (speed + heading tolerance).
- [ ] No-go zone arc and sail trim guide toggle correctly.
- [ ] Visual Indicators button opens and closes the floating panel without pausing the game.
- [ ] Wind vector arrow rotates with live wind direction and scales correctly with wind speed.
- [ ] Heading vector (crujía) points along the bow heading and diverges from the velocity vector when leeway is present.
- [ ] Velocity vector length is proportional to boat speed and points in the actual movement direction.
- [ ] When both heading and velocity vectors are active simultaneously, the leeway angle gap is clearly visible.
- [ ] Inertia indicator shows target speed bar and current speed bar; the gap is visually large after a tack and closes gradually.
- [ ] Inertia gap closes noticeably faster with Light displacement than with Heavy displacement.
- [ ] V-wake is not drawn below 0.5 kts. At 3+ kts it forms a clear diverging V. At 8+ kts the V is wide and prominent.
- [ ] Wake length and width scale naturally with speed (long/wide at speed, short/narrow when slow).
- [ ] Water dashes transition smoothly between Calm / Choppy / Rough tiers as wind speed changes.
- [ ] At Rough tier (>18 kts), water is visually noticeably more agitated than at Calm tier (<10 kts).
- [ ] Both controllers respond simultaneously to independent touches (multi-touch).
- [ ] Browser default gestures (pinch-zoom, scroll) are suppressed on the canvas.
- [ ] When the boat runs aground on an island, it slows sharply and the hull flashes red. It cannot pass through islands.
- [ ] Tangential sliding along island edges works; only perpendicular velocity is cancelled.
- [ ] A dark vignette appears on the screen edge when the boat is within 150px of the world boundary.
- [ ] The boat cannot leave the world boundary rectangle.
- [ ] Buoys must be rounded in numeric order. Rounding out-of-order has no effect.
- [ ] Each pending buoy shows a dashed detection circle (84px, gold, pulsing). Circle hides on rounding.
- [ ] On rounding, the buoy flashes yellow, turns grey, a brief text floats up, device vibrates 25 ms.
- [ ] After rounding all buoys, entering the start zone triggers the completion banner.
- [ ] Objective arrow (cyan triangle) points from boat toward next target at all times; bounces gently; disappears when complete.
- [ ] The start zone is rendered as two coloured posts with a dashed line between them.
- [ ] Stuck-in-irons state is entered after 2 continuous seconds of AWA < `NO_GO_ZONE_DEG × 2` (30°) and speed < 1 kts.
- [ ] While in irons: rudder effectiveness is 20%, no-go arc pulses, label is visible.
- [ ] Escaping irons by easing and applying helm restores normal sailing.
- [ ] Pause menu has a Restart button that resets position, wake, and objective without exiting.
- [ ] Tutorial coach mark sequence fires on first game launch.
- [ ] Tutorial can be skipped from step 1 and replayed from Settings.
- [ ] Each tutorial step correctly highlights its target element and blocks other input.
- [ ] Point-of-sail label updates correctly across all AWA ranges and is colour-coded.
- [ ] Wind shift cue pulses the HUD wind arrow when wind variability causes a shift > 5°.
- [ ] In landscape orientation, controllers default to bottom corners. In portrait, they default to center-sides.
- [ ] On screens narrower than 400px, the Indicators Panel is scrollable and controllers scale to 80%.
- [ ] Haptic feedback fires on tack, jibe, collision, buoy rounding, and objective complete with correct patterns.
- [ ] Restart and Back to Menu both show a confirm dialog before executing. Cancelling returns to the pause menu.
- [ ] Sail trim glow (gold) appears on transition into trimmed state and fades out in ~0.8 s.
- [ ] Sail luffing shimmer (blue-white) oscillates continuously while AWA < `NO_GO_ZONE_DEG` and stops immediately on exit.
- [ ] Objective arrow (world-space, 105px from boat, cyan, bouncing) always points to next target; switches automatically as objectives are completed.
- [ ] Mini-map toggle in Indicators Panel shows/hides the mini-map overlay. Boat, buoys, and islands are correctly scaled.
- [ ] Mini-map buoy dots reflect rounding state (grey = done, orange = pending, bright = next).
- [ ] Notification panel shows contextual messages with correct priority colors and durations.
- [ ] Contextual triggers fire at the right conditions (trim_close, irons_tip, approach_dock, etc.) and respect cooldowns.
- [ ] When no contextual message fires for 30 s, idle tips cycle through the full pool.
- [ ] Notifications can be toggled off from Settings; no messages appear when disabled.
- [ ] Sail fill sound plays once on transition from luffing/stalled to trimmed.
- [ ] Indicator on/off states persist to storage and are restored on reload.
- [ ] Boat displacement setting in World Configuration changes how quickly the boat accelerates/decelerates.
- [ ] All user-visible strings come from `TRANSLATIONS` via `t()` — no hardcoded text anywhere.
- [ ] The game launches in Spanish by default.
- [ ] Switching to English refreshes all on-screen text immediately.
- [ ] Language preference persists to storage and is restored on reload.
- [ ] Both `'es'` and `'en'` translation blocks are complete — no missing keys.
- [ ] Colliding with a not-yet-rounded buoy (within ~23px) triggers mission failure.
- [ ] Colliding with an island (boat center inside polygon) triggers mission failure.
- [ ] Entering a dock at speed > 2× DOCK_SUCCESS_SPEED triggers failure (crash), not success.
- [ ] Failure panel shows the specific reason (`fail.hit_buoy`, `fail.hit_island`, `fail.hit_dock`) and the objective reminder.
- [ ] Failure panel background is semi-transparent (alpha ~0.48) so the broken boat is visible behind it.
- [ ] Broken boat overlay (red hull + crack lines) appears on the boat container when failure is triggered.
- [ ] "Reiniciar misión" button resets all state: boat position, physics, tracker, buoy visuals, broken overlay, failure panel.
- [ ] Objective text (bottom HUD) is centered at the bottom of the screen, not left-aligned.

### Part 2 — Web / Phaser Implementation

- [ ] Code is split across the files listed in Section 14; `index.html` loads them in dependency order.
- [ ] Zero HTML DOM elements used for any game panel, button, overlay, or widget.
- [ ] `Phaser.Game` config declares `input: { activePointers: 3 }`.
- [ ] Both controllers respond simultaneously to independent touches.
- [ ] Helm drag uses `Math.atan2` angular delta — not `deltaX` or `deltaY`.
- [ ] A dedicated UI camera is used for all HUD/widget objects.
- [ ] All timed callbacks use `this.time.delayedCall()` or `this.time.addEvent()` — zero `setTimeout`.
- [ ] All input uses Phaser events (`this.input.on(...)`) — zero `document.addEventListener`.
- [ ] All animations use `this.tweens.add()` — no manual lerp of visual properties in `update()`.
- [ ] Wind arrows are drawn with a viewport-aware `Graphics` (only visible grid cells per frame); no world-sized `RenderTexture` is used.
- [ ] `SailingAudio` uses a standalone `window.AudioContext` created in `start()`, not Phaser's sound system.
- [ ] `SailingAudio` constructor is called before any panel that needs volume values (`getVol()` reads localStorage, no AudioContext needed).
- [ ] Audio `start()` is called only on first user gesture (pointerdown or keydown).
- [ ] Audio suspends on pause/failure and resumes on game resume/restart.
- [ ] Sound settings tab shows four volume rows (master, water, luff, effects) with `< X% >` controls; values persist to `sailsim_audio` in localStorage.
- [ ] Scene shutdown cleans up all listeners.
- [ ] The game scales correctly to any screen size on both desktop and mobile.
- [ ] The game runs at 60 fps on a modern mobile browser.
- [ ] Settings panel changes wind direction, speed, and variability in real time.

World assets use **`Phaser.GameObjects.Graphics`** (programmatic drawing). Controller widgets use **inline SVG converted to base64 textures** — do not attempt to replicate them with the Graphics API.

### World assets — Phaser Graphics API

| Asset | Phaser drawing approach |
|---|---|
| **Boat hull** | `graphics.fillStyle(...).fillPoints(polygon, true)` with a pointed array of vertices |
| **Mast** | `graphics.fillCircle(x, y, 5)` |
| **Boom** | Separate `Graphics` child of the boat Container. Redrawn every frame via `_updateBoom(trimAngle, signedAWA)` — **never use `setAngle()`**. Boom tip in container space (bow=−Y, stern=+Y): `boomSide = AWA ≥ 0 ? 1 : −1`; `boomTipX = boomSide × BL × sin(trimRad)`; `boomTipY = BL × cos(trimRad)`. |
| **Sail** | Redrawn in `_updateBoom(trimAngle, signedAWA, trimStatus)`. `g.fillPoints([mast, head, bellyPoint, clew], true)`. Head vertex always at `headY = sailHeadY * 0.15` (stays near mast in all states — permanent visual design choice). Belly point = midpoint of leech offset toward leeward by `BL × 0.5 × sin(trimRad)`. Flutter: `headX = sin(time * 0.018) * boomSide * (luffing ? 4 : easing ? 1.5 : 0)`. Alpha 0.55 normal, 0.28 when luffing. Leeward perpendicular unit: `perpX = boomSide × boomTipY / BL`, `perpY = −boomSide × boomTipX / BL`. Boom line drawn on top. |
| **Buoy** | `graphics.strokeCircle()` + `this.add.text()` for label |
| **Island** | `graphics.fillPoints(polygon)` with two passes (sandy outer, green inner) |
| **Dock** | `graphics.fillRect()` repeated for stripes; dashed rectangle via short `lineBetween` segments |
| **Water base** | `graphics.fillRect(0, 0, worldW, worldH)` in dark navy; color tweened toward grey-blue as wind speed increases |
| **Water dashes (wind-reactive)** | Pool of plain objects `{x, y, angle, phase}`. Each frame: advance position by `driftSpeed * windDir * delta`; wrap at world bounds. Draw each as a short `strokePoints` of 3–4 sine-offset points. Re-parameterize count/length/alpha on tier change by tweening properties in place — do NOT recreate the pool. |
| **Wake (V-wake)** | Rolling array of `{x, y, age, heading, speed}` — record heading and speed per point. Push stern position each frame; remove entries where `age > 1.5s`. Per draw: `spread = (age/1.5)*35*(speed/15)`, perpendicular offset = `(cos heading, sin heading)` × spread (NOT `-sin/cos`). Draw two `strokePoints` paths (port/stbd) with per-point alpha. `graphics.clear()` + full redraw each frame (~60 points, negligible cost). |
| **Wind arrows** | Viewport-aware `Graphics` — compute only visible grid cells each frame using camera scroll position (see Section 16). Do NOT use a world-sized `RenderTexture`. |
| **No-go zone arc** | `graphics.slice(x, y, r, startAngle, endAngle)` in red with `setAlpha(0.3)`; child of boat container. |
| **Vector overlays** (indicators) | `graphics.lineBetween()` + `graphics.fillTriangle()` for arrowheads; redrawn each frame on a dedicated overlay Graphics object above the world layer. |

### Controller widgets — inline SVG → base64 textures

Define both SVGs as template literals inside the `<script>` block. Convert to base64 and load into Phaser as textures via `this.textures.addBase64(key, dataURI)` before the GameScene starts. Render with `this.add.image()` or `this.add.sprite()`.

**Mainsheet Controller — two SVG states:**

```js
// Taut state SVG (rope is long and thin, ~100×40px viewBox)
const ROPE_TAUT_SVG = `<svg xmlns="..." viewBox="0 0 40 110">
  <!-- vertical rope body with diagonal cross-hatch braid marks -->
  <!-- cleat handle circle at bottom -->
</svg>`;

// Eased state SVG (rope is short and wavy, ~40×50px viewBox)
const ROPE_EASED_SVG = `<svg xmlns="..." viewBox="0 0 40 55">
  <!-- short thick rope with 3 sine-wave undulations -->
  <!-- same cleat handle at bottom -->
</svg>`;
```

At runtime: display both images stacked at the same position. Tween `tautImage.alpha` from 1→0 and `easedImage.alpha` from 0→1 as `sailTrimTarget` moves from 0° to 85°. This cross-fade produces the morph effect without SVG path animation.

**Helm Controller — one SVG, two moving parts:**

```js
const HELM_SVG = `<svg xmlns="..." viewBox="0 0 120 140">
  <!-- wheel group: rim circle, 6 spokes, grab handle on rim -->
  <!-- mini-boat silhouette group below the wheel -->
  <!-- rudder line within the silhouette group -->
</svg>`;
```

Load as a single texture. Rotate the entire `this.add.image(helmTexture)` object to reflect helm angle. For the rudder line on the mini-boat: overlay a separate thin `Graphics` line drawn each frame at the silhouette's stern position, rotated by `helmAngle * 0.5`. This avoids needing two separate SVG layers.

**Both widgets** live on a UI layer with `setScrollFactor(0)` so they never scroll with the world camera. The background panel (rounded rect, dark semi-transparent) is drawn with Graphics behind each widget image.

---

## 15. Code Architecture — Phaser

Organize the single HTML file into clearly labeled sections with comment headers:

```
index.html
│
├── <style>
│     Full-screen canvas, no margins, dark background during load
│
├── <script src="https://cdn.phaser.io/...phaser.min.js">
│     Use the current stable Phaser CDN URL from phaser.io
│
└── <script>  (game code, organized top-to-bottom)
    │
    ├── CONSTANTS            Tuning values — no magic numbers elsewhere
    ├── TRANSLATIONS         i18n strings + t() + setLanguage() (Section 10)
    ├── MAPS                 Map data objects array (Section 5)
    │
    ├── SailingPhysics       Class — pure math (Section 4 interface)
    ├── InputManager         Class — reads Phaser pointer events, exposes rudderAxis + sailTrimTarget
    ├── MainsheetController  Class — Phaser Graphics widget (Section 3)
    ├── HelmController       Class — Phaser Graphics widget (Section 3)
    ├── LayoutManager        Class — reads/writes localStorage for controller positions
    ├── ObjectiveTracker     Class — checks buoy rounding and docking completion
    │
    ├── MenuScene            Phaser.Scene
    ├── GameScene            Phaser.Scene
    │     create(): reads this.scene.settings.data.map, builds world via WorldBuilder
    │     update(time, delta): InputManager → SailingPhysics → move boat → draw HUD
    │
    ├── PauseScene           Phaser.Scene (launched as overlay, GameScene stays active)
    │
    └── new Phaser.Game({ ... })
```

Camera setup: `gameScene.cameras.main.startFollow(boatSprite, true, 0.1, 0.1)` (lerp follow). Controller widgets use a separate fixed camera via `setScrollFactor(0)` or a dedicated UI camera.

---

## 16. Code Best Practices — Phaser

- **Constants object**: all tunable numbers in one `CONSTANTS` block.
  ```js
  const CONSTANTS = {
    NO_GO_ZONE_DEG: 15,       // ±15° = 30° total no-go zone
    MAX_RUDDER_ANGLE: 45,
    BOAT_DRAG: 0.999,          // 0.999^60 ≈ 94%/s — very gentle, allows escape from no-go zone
    BASE_ACCEL: 0.25,          // lerp rate; low = high inertia everywhere
    TACK_PENALTY_FACTOR: 0.7,
    TACK_PENALTY_DURATION_MS: 1000,
    SHALLOW_SPEED_LIMIT: 1.5,
    DOCK_SUCCESS_SPEED: 1.0,
    DOCK_SUCCESS_HEADING_TOLERANCE: 20,
    BUOY_DETECTION_RADIUS: 84,  // 6 × buoy visual radius (14px)
  };
  ```

- **Frame-rate independent**: all physics multiplied by `delta` (in seconds).
  ```js
  boatSpeed = lerp(boatSpeed, targetSpeed, CONSTANTS.ACCEL * delta);
  ```

- **Stateful button highlight — pointerout must restore active color**: When a button group uses a refresh function to color the active item (e.g. displacement, layout slot), the generic `_addBtn` pointerout handler must be overridden to call `_refreshXxxBtns()` rather than restoring the hardcoded base color. Otherwise mousing over any button erases the gold highlight from the active one.
  ```js
  const btn = this._addBtn(container, x, y, label, onClick, opts);
  btn.off('pointerout');
  btn.on('pointerout', () => this._refreshDispBtns());  // restore active state
  ```

- **No map-specific code in scenes**: `GameScene.create()` receives `this.scene.settings.data.map` and delegates entirely to `WorldBuilder.build(map)`.

- **Input abstraction**: `InputManager` is the only place Phaser pointer events are read. Everything else reads `inputManager.rudderAxis` and `inputManager.sailTrimTarget`.

- **Collision**: use `Phaser.Geom.Polygon.Contains()` for island/dock detection — not physics bodies.

- **Mobile tap targets**: all interactive controls must have a minimum hit area of 48×48px.

- **Wind arrows**: drawn each frame with a viewport-aware `Graphics` (only visible grid cells). Do NOT use a world-sized `RenderTexture` — it can exceed WebGL max texture limits and render only partially.

- **i18n in Phaser**: store a reference to every `Phaser.GameObjects.Text` that displays translated content. On `events.emit('lang-changed')`, call `.setText(t(key))` on each one.

- Keep each class under ~120 lines. Extract if larger.

---

## 17. Completion Criteria

### Part 1 — Design & Logic (engine-agnostic)

- [ ] All 4 maps are defined as data objects and are fully playable.
- [ ] Sailing physics produce realistic behavior: no-go zone blocks progress, beam reach is fastest, running is slower than reaching.
- [ ] Tacking and jibing fire correctly (boom swings, speed penalty applies, `justTacked`/`justJibed` flags fire once).
- [ ] Mainsheet Controller rope morphs correctly: long-thin when trimmed, short-wide when eased.
- [ ] Trim status label shows the correct i18n key for all 5 states.
- [ ] Helm Controller wheel rotates on drag; rudder line on mini-boat silhouette moves in sync.
- [ ] PORT/STBD labels highlight correctly when helm is deflected.
- [ ] Both controllers can be repositioned via the 3×2 grid and via free-drag Customize Layout mode.
- [ ] Controller positions persist to storage and are restored on reload.
- [ ] Docking on Map 4 detects success correctly (speed + heading tolerance).
- [ ] No-go zone arc and sail trim guide toggle correctly.
- [ ] Visual Indicators button opens and closes the floating panel without pausing the game.
- [ ] Wind vector arrow rotates with live wind direction and scales correctly with wind speed.
- [ ] Heading vector (crujía) points along the bow heading and diverges from the velocity vector when leeway is present.
- [ ] Velocity vector length is proportional to boat speed and points in the actual movement direction.
- [ ] When both heading and velocity vectors are active simultaneously, the leeway angle gap is clearly visible.
- [ ] Inertia indicator shows target speed bar and current speed bar; the gap is visually large after a tack and closes gradually.
- [ ] Inertia gap closes noticeably faster with Light displacement than with Heavy displacement.
- [ ] V-wake is not drawn below 0.5 kts. At 3+ kts it forms a clear diverging V. At 8+ kts the V is wide and prominent.
- [ ] Wake length and width scale naturally with speed (long/wide at speed, short/narrow when slow).
- [ ] Water dashes transition smoothly between Calm / Choppy / Rough tiers as wind speed changes.
- [ ] At Rough tier (>18 kts), water is visually noticeably more agitated than at Calm tier (<10 kts).
- [ ] Both controllers respond simultaneously to independent touches (multi-touch).
- [ ] Browser default gestures (pinch-zoom, scroll) are suppressed on the canvas.
- [ ] When the boat runs aground on an island, it slows sharply and the hull flashes red. It cannot pass through islands.
- [ ] Tangential sliding along island edges works; only perpendicular velocity is cancelled.
- [ ] A dark vignette appears on the screen edge when the boat is within 150px of the world boundary.
- [ ] The boat cannot leave the world boundary rectangle.
- [ ] Buoys must be rounded in numeric order. Rounding out-of-order has no effect.
- [ ] Each pending buoy shows a dashed detection circle (84px, gold, pulsing). Circle hides on rounding.
- [ ] On rounding, the buoy flashes yellow, turns grey, a brief text floats up, device vibrates 25 ms.
- [ ] After rounding all buoys, entering the start zone triggers the completion banner.
- [ ] Objective arrow (cyan triangle) points from boat toward next target at all times; bounces gently; disappears when complete.
- [ ] The start zone is rendered as two coloured posts with a dashed line between them.
- [ ] Stuck-in-irons state is entered after 2 continuous seconds of AWA < `NO_GO_ZONE_DEG × 2` (30°) and speed < 1 kts.
- [ ] While in irons: rudder effectiveness is 20%, no-go arc pulses, label is visible.
- [ ] Escaping irons by easing and applying helm restores normal sailing.
- [ ] Pause menu has a Restart button that resets position, wake, and objective without exiting.
- [ ] Tutorial coach mark sequence fires on first game launch.
- [ ] Tutorial can be skipped from step 1 and replayed from Settings.
- [ ] Each tutorial step correctly highlights its target element and blocks other input.
- [ ] Point-of-sail label updates correctly across all AWA ranges and is colour-coded.
- [ ] Wind shift cue pulses the HUD wind arrow when wind variability causes a shift > 5°.
- [ ] In landscape orientation, controllers default to bottom corners. In portrait, they default to center-sides.
- [ ] On screens narrower than 400px, the Indicators Panel is scrollable and controllers scale to 80%.
- [ ] Haptic feedback fires on tack, jibe, collision, buoy rounding, and objective complete with correct patterns.
- [ ] Restart and Back to Menu both show a confirm dialog before executing. Cancelling returns to the pause menu.
- [ ] Sail trim glow (gold) appears on transition into trimmed state and fades out in ~0.8 s.
- [ ] Sail luffing shimmer (blue-white) oscillates continuously while AWA < `NO_GO_ZONE_DEG` and stops immediately on exit.
- [ ] Objective arrow (world-space, 105px from boat, cyan, bouncing) always points to next target; switches automatically as objectives are completed.
- [ ] Mini-map toggle in Indicators Panel shows/hides the mini-map overlay. Boat, buoys, and islands are correctly scaled.
- [ ] Mini-map buoy dots reflect rounding state (grey = done, orange = pending, bright = next).
- [ ] Notification panel shows contextual messages with correct priority colors and durations.
- [ ] Contextual triggers fire at the right conditions (trim_close, irons_tip, approach_dock, etc.) and respect cooldowns.
- [ ] When no contextual message fires for 30 s, idle tips cycle through the full pool.
- [ ] Notifications can be toggled off from Settings; no messages appear when disabled.
- [ ] Sail fill sound plays once on transition from luffing/stalled to trimmed.
- [ ] Indicator on/off states persist to storage and are restored on reload.
- [ ] Boat displacement setting in World Configuration changes how quickly the boat accelerates/decelerates.
- [ ] All user-visible strings come from `TRANSLATIONS` via `t()` — no hardcoded text anywhere.
- [ ] The game launches in Spanish by default.
- [ ] Switching to English refreshes all on-screen text immediately.
- [ ] Language preference persists to storage and is restored on reload.
- [ ] Both `'es'` and `'en'` translation blocks are complete — no missing keys.
- [ ] Colliding with a not-yet-rounded buoy (within ~23px) triggers mission failure.
- [ ] Colliding with an island (boat center inside polygon) triggers mission failure.
- [ ] Entering a dock at speed > 2× DOCK_SUCCESS_SPEED triggers failure (crash), not success.
- [ ] Failure panel shows the specific reason (`fail.hit_buoy`, `fail.hit_island`, `fail.hit_dock`) and the objective reminder.
- [ ] Failure panel background is semi-transparent (alpha ~0.48) so the broken boat is visible behind it.
- [ ] Broken boat overlay (red hull + crack lines) appears on the boat container when failure is triggered.
- [ ] "Reiniciar misión" button resets all state: boat position, physics, tracker, buoy visuals, broken overlay, failure panel.
- [ ] Objective text (bottom HUD) is centered at the bottom of the screen, not left-aligned.

### Part 2 — Web / Phaser Implementation

- [ ] Everything is contained in a single `index.html` file.
- [ ] Both controllers work on mouse and touch.
- [ ] The game scales correctly to any screen size (desktop and mobile).
- [ ] Wind arrows are drawn on a RenderTexture and not redrawn every frame.
- [ ] The game runs at 60fps on a modern mobile browser.
- [ ] Settings panel changes wind direction, speed, and variability in real time.
