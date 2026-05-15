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
- A **red arc** in front of the bow (optional, togglable) shows the no-go zone — the angular range where the boat can't sail into the wind.

### HUD (always visible, non-intrusive)

| Element | Position | Description |
|---|---|---|
| Wind indicator | Top-right | Compass-style arrow pointing where wind comes FROM, with speed in knots |
| Boat speed | Top-left | Current speed in knots (e.g. "6.2 kts") |
| Heading | Top-left | Current bow heading in degrees (0–360°) |
| Sail trim status | On the Mainsheet Controller widget | Text label integrated into the rope controller (see Section 3) |
| Rudder angle | On the Helm Controller widget | Shown on the mini-boat silhouette beside the helm wheel (see Section 3) |
| Objective | Bottom-left | Current map objective text (resolved via i18n key) |
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

**Text label** displayed directly below or beside the rope widget, updated every frame via `t()`:

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

The helm controller is a **mini helm wheel** that the user rotates to steer, rendered next to a **miniature top-down boat silhouette** so the player can always see the rudder effect.

**Interaction:**
- The wheel has a visible **grab handle** on its rim. The user drags this handle in a circular arc.
- **Desktop + Mobile**: Drag clockwise = starboard (turn right); counter-clockwise = port (turn left).
- Maximum wheel rotation: ±90° from center, mapping to ±45° rudder angle on the actual boat.
- When released, the wheel gradually springs back to center, which gradually centers the rudder (does not snap).

**Visual composition of the widget:**

```
  ◄ PORT        STBD ►
      ┌──────────────┐
      │    [wheel]   │  ←── 80px diameter helm wheel
      │              │        with 6 spokes + rim grab handle
      │  [mini boat] │  ←── 50×18px top-down hull silhouette
      │    rudder ╱  │        rudder line at stern rotates live
      └──────────────┘
```

- Circular wheel with 6 evenly-spaced spokes and a grab handle on the rim.
- Adjacent: small top-down boat silhouette. A **rudder line** at the stern rotates to match current helm angle.
- Port/starboard labels (i18n keys `helm.port` / `helm.starboard`) flank the widget. The active-side label highlights when the helm is deflected.
- All on a semi-transparent rounded-rect background panel.

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
| 0–40° | **In irons / no-go zone** | — | 0.0 (no thrust) |
| 40–60° | **Close-hauled** (ceñida) | 10° | 0.70 |
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

- If AWA < 40°, `pointFactor = 0`. The boat decelerates due to drag (e.g. multiply speed by 0.97 per frame).
- The sail luffs visually: boom flaps slightly, trim label shows `trim.luffing`.
- The boat does NOT stop instantly — it coasts to a halt.

### Leeway (lateral drift)

Apply a small drift force perpendicular to the boat heading when sailing upwind. Magnitude: `windSpeed * 0.015` units/s sideways, reduced to 0 when running downwind.

### Tacking (bow through wind)

When AWA crosses 0° (bow passes through the wind), the boom automatically swings to the opposite side. Apply a 30% speed penalty for 1 second to simulate lost momentum.

### Jibing (stern through wind)

When AWA crosses 180° (stern passes through the wind), the boom swings to the other side abruptly. Apply a 20% speed penalty for 0.5 seconds.

### Stuck in irons

Stuck in irons occurs when the boat enters the no-go zone too slowly to complete a tack and sits bow-to-wind, barely moving, with near-useless steering. One of the most important situations a beginner must learn to avoid and escape.

**Entry condition**: AWA < 30° AND boatSpeed < 1.0 kts, persisting for > 2 seconds continuously.

**Effects while in irons**:
- Rudder effectiveness drops to 20% of normal (no water flow over rudder = poor steering).
- Boom hangs slack at centreline. Sail luffs fully.
- Boat continues to decelerate passively under drag.

**Escape**: ease the mainsheet fully and apply maximum rudder to one side — this backs the sail and pushes the bow off the wind. Once AWA > 40° and boatSpeed > 0.5 kts, normal sailing resumes. A 3-second cooldown prevents immediately re-entering irons.

**Physics output**: `SailingPhysics` returns `isInIrons: boolean` using the 2-second persistence condition (not just instantaneous AWA < 30°).

**Visual**: label `t('irons.label')` appears near the boat in red. The no-go zone arc pulses slowly while in this state.

### Island and boundary collision

**Island collision**:
- Each frame, check `boatPosition` against all island polygons.
- On intersection: find nearest point on the island boundary. Push the boat to just outside that point (offset by half hull width). Apply `boatSpeed *= 0.15`.
- Only the perpendicular velocity component is cancelled — tangential sliding along the edge is allowed.
- Visual: boat hull flashes red for 0.3 s on contact.

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
1. The boat comes within `BUOY_DETECTION_RADIUS` (30px) of the buoy centre — entering the detection circle.
2. The boat then exits the detection circle (distance > 30px again).

Buoys must be rounded **in numeric order** (buoy #1 before #2, etc.). The `ObjectiveTracker` keeps a `nextBuoyIndex` counter that increments on each valid rounding. After all buoys are rounded, the boat must enter the `startZone` to complete the objective.

On rounding: buoy flashes bright yellow for 0.5 s; a short "ping" sound plays; a brief text `t('objective.buoy_rounded')` appears near the buoy and fades out over 1 second.

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
| **Boom** | Line from mast, ~28px long | Dark grey | Rotates with sail trim angle; always to the downwind side |
| **Sail** | Filled triangle: mast tip → boom tip → mast base | Semi-transparent white, alpha 0.6 | Follows boom; flaps slightly when luffing |
| **Wake trail (V-wake)** | Two diverging arms from the stern forming a V-shape. Each arm is built from the last ~1.5 s of boat positions, offset laterally from the path. The offset at each stored point grows with age and speed: `offset = (age / 1.5) × maxSpread × (boatSpeed / 15)`. At full speed (~15 kts) the spread reaches ~35 px to each side at the tail. Below 0.5 kts no wake is drawn. | White / very light blue. Alpha at each point: `1 - (age / 1.5)` — fully opaque at stern, transparent at tail. | Length is naturally speed-dependent: fast boat = positions spread far apart = long wide V. Slow boat = positions close together = short narrow trace. Gives immediate visual sense of speed. |
| **Buoy** | Circle, ~14px radius | Orange fill, white stroke | Number label centered in bold; pulses slightly on rounding |
| **Island** | Irregular closed polygon | Sandy/tan at edges, green interior (two-layer polygon) | Static world object |
| **Dock** | Rectangle with alternating light/dark stripes | Tan/brown; target zone in dashed green | Static; target zone highlights when boat is close |
| **Water background** | Fills entire world. Base layer: solid fill. Over it: a layer of short animated dashes drifting in the wind direction, density and intensity driven by wind speed (see wind-reactive water table below). | Base: dark navy blue. Dash color: light blue/white at varying alpha. Stronger wind makes the water subtly darker. | Dashes tile seamlessly and wrap at world edges. Wind speed changes re-parameterize the animation in real time. |
| **Wind arrows (water)** | Small chevron arrows tiled across the water | Low opacity (0.2), white/light blue | Point in wind direction; update only when wind changes |
| **No-go zone arc** | Semi-transparent arc at the bow, ±40° spread | Red, alpha 0.3 | Rotates with boat; togglable |
| **Mainsheet Controller rope** ⚑ | Two SVG states: **taut** (tall ~100×6px straight rope, visible braid cross-hatch pattern) and **eased** (short ~30×18px with 3 sine-wave undulations). The engine lerps between them using `opacity` or `scaleY`/`scaleX` tweens on two overlapping SVG elements, or by morphing SVG path `d` attributes. Cleat handle is a separate small circle element at the bottom. Background panel: rounded rect, dark, alpha 0.5. | Rope: warm brown/tan `#8B6343`. Braid marks: dark `#5C3D1E`. Panel: `#1a1a2e`, alpha 0.5. | Cleat handle drags to control trim. The morph between taut/eased states should feel fluid and continuous, not a swap between two states. |
| **Helm Controller wheel** ⚑ | One SVG: circular wheel (~80px diameter) with 6 spokes and a circular grab handle on the rim, plus an adjacent top-down boat silhouette (~50×16px) with a short rudder line at the stern. The entire wheel SVG rotates as a unit. The rudder line within the silhouette sub-element rotates independently. Background panel: same as rope controller. | Wheel rim and spokes: dark wood `#3D2B1F`. Grab handle: gold `#C9A84C`. Silhouette: cream `#F5F0E0`. Rudder line: dark `#333`. Panel: same as rope. | The SVG root element rotates with helm angle. The rudder sub-element counter-rotates by `helmAngle × 0.5` to show rudder deflection on the mini-boat. PORT/STBD text labels are HTML elements outside the SVG, positioned flanking the panel. |

> ⚑ **Controller widgets** — use embedded SVG or base64 PNG (see Part 2 for engine-specific embedding). Do not attempt to reproduce these with programmatic drawing — the morphing rope and fine wheel detail will produce inferior results.
| **Wind vector arrow** | Arrow from boat center, direction = where wind comes FROM. Length proportional to wind speed (8px per knot, max 120px). Arrowhead at tip. Small speed label beside arrow tip. | Sky blue / light blue. | Rotates with live wind direction; length scales with wind speed. Togglable. |
| **Heading vector (crujía)** | Line from hull center forward along boat heading angle. Fixed length ~80px. Arrowhead at tip. | Bright white / cyan. | Rotates with boat heading. Togglable. |
| **Velocity vector** | Arrow from hull center in actual movement direction (heading + leeway). Length proportional to boat speed (10px per knot). Arrowhead at tip. | Bright green. | May diverge from heading vector when leeway is present — the gap between the two is educationally significant. Togglable. |
| **Inertia / Displacement indicator** | Small floating panel near the boat: two stacked horizontal bars — "Target" (dashed, white) and "Current" (solid, green). Bars represent speed. Gap between them shows how much inertia is delaying the response. Text label below: displacement value and class name. | Panel: dark semi-transparent. Bars: green (current) and white dashed (target). Label text: dim white. | Bars update every frame. Gap closes as boat accelerates/decelerates toward target. Togglable. |
| **Indicators button** | Small square icon button in the HUD corner. Shows a vector/eye icon. | Semi-transparent dark background, white icon. | Opens/closes the IndicatorsPanel floating window. |
| **Start/finish zone** | Two small cylindrical posts (port = red cylinder, starboard = green cylinder, ~12px diameter × 20px tall) with a dashed white line between them spanning the zone width. | Port post: red. Starboard post: green. Dashed line: white, alpha 0.7. | Static world object. When the boat passes through the line after rounding all buoys, the zone flashes briefly and the completion banner fires. |
| **Buoy rounding flash** | The buoy's fill colour rapidly transitions to bright yellow and back to orange over 0.5 s (single flash). A brief `t('objective.buoy_rounded')` text fades in at the buoy position and rises slightly over 1 s. | Flash: bright yellow → orange. Text: white, fades to transparent. | Triggered once per rounding event. Does not re-trigger if the boat circles the buoy again. |
| **Stuck-in-irons overlay** | Text label `t('irons.label')` rendered in bold red above the boat in world space. The no-go zone arc strokes slowly between full opacity and 40% opacity (pulse rate ~1 Hz). | Label: red. Arc pulse: red, 0.4–1.0 alpha. | Appears and pulses while `isInIrons` is true; disappears immediately on escape. |
| **World edge vignette** | Dark gradient overlay on the screen edge closest to the world boundary. Width: ~100px. | Very dark navy/black, alpha up to 0.4. | Fades in as boat approaches within 150px of world edge; fades out as boat moves away. |
| **Wind shift cue** | The wind direction arrow in the HUD briefly scales up to 1.3× and pulses once when the wind direction changes by more than 5° (only when wind variability is ON). | Arrow: same sky blue as normal, brief bright flash. | Single pulse animation, ~0.4 s duration. Does not repeat until the next shift event. |
| **Tutorial coach mark** | Full-screen dim overlay (alpha 0.6) with a "cut-out" hole revealing the highlighted element. Rounded tooltip box with text and a "Continue" / "Skip" button. | Overlay: dark, alpha 0.6. Tooltip: dark background, white text, rounded corners. Cutout: transparent circle or rounded rect matching the highlighted element. | Input blocked on everything except the Continue/Skip buttons. |
| **Point-of-sail label** | Short text rendered near the boat in world space, just above the no-go zone arc. Shows current point of sail name. Color-coded by category. | Close-hauled: blue. Reach: green. Running: orange. In irons: red. | Toggleable learning aid. Updates continuously as AWA changes. |
| **Sail trim glow — good** | A warm golden halo around the sail, triggered when trim status transitions into `trimmed`. Fades in over 0.2 s and out over 0.8 s (one-shot, not looping). | Warm gold / amber, alpha peaks at 0.5. Applied as additive blend or outer glow on the sail shape. | Fires once per transition into trimmed state. Reinforces correct trimming as a positive reward. |
| **Sail trim glow — luffing** | A cool blue-white shimmer on the sail while `trimStatus === 'luffing'`. Implemented as a rapid opacity oscillation (5–8 Hz) on a blue-tinted overlay of the sail shape. | Icy blue-white, alpha oscillates 0.0–0.35. | Active continuously while luffing; stops immediately when AWA > 40°. Reinforces the negative state without being distracting. |
| **Off-screen objective arrow** | A small filled triangle (arrow) ~18px, positioned on the screen edge in the direction of the next buoy. Shown only when the buoy is outside the visible viewport. Rotates to always point at the buoy. | Orange, matching buoy color. Alpha 0.85. | Updates every frame. Disappears when the buoy enters the viewport. Shows distance label in small text beside it (e.g. "340 m"). |
| **Mini-map** | Small ~120×120px overlay in a configurable corner. Shows: world boundary as a thin rectangle, islands as dark filled polygons (scaled), all buoys as 4px dots (grey = done, orange = pending, bright = next), boat as a 5px bright dot with a tiny heading arrow, start zone as a short line. No dock or text labels. Background: dark semi-transparent rounded rect. | Islands: dark grey. Buoys: grey/orange. Boat: bright white. Start zone: dashed white line. | Updates every frame. Corner is configurable (same 3×2 grid as controllers). Toggleable from Indicators Panel. |
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
│     update(boatState, map) → { buoyRounded: bool, complete: bool }
│     reset()              called by Restart action in PauseScene
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

    // Helm controller
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
    'notif.tack_success':      'Tacada',
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

    // Stuck in irons
    'irons.label':             'EN HIERROS',

    // Points of sail (for label aid)
    'pos.in_irons':            'En Hierros',
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

    // Tutorial
    'tutorial.wind':           'Esta flecha muestra de dónde viene el viento.',
    'tutorial.mainsheet':      'Cazá el cabo para tensar la vela. Filalo para soltarla.',
    'tutorial.helm':           'Girá la rueda para maniobrar el barco.',
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

    // Helm controller
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

    // Tutorial
    'tutorial.wind':           'This arrow shows where the wind is coming from.',
    'tutorial.mainsheet':      'Pull the rope to trim your sail. Ease it to release.',
    'tutorial.helm':           'Turn the wheel to steer the boat.',
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
| **No-go zone arc** | `aid.no_go` | Red arc in front of the bow, ±40° — the range where sailing is impossible |
| **Sail trim guide** | `aid.trim_guide` | Ghost boom line showing the *optimal* trim angle for the current AWA (dashed) |
| **Wind arrows on water** | — | Low-opacity directional arrows across the water background |
| **AWA readout** | `aid.awa_label` | Small number near the boat showing current Apparent Wind Angle in degrees |
| **Point-of-sail label** | `pos.*` keys | Text near the boat showing the current point of sail (e.g. "Ceñida", "Través"). Color-coded: close-hauled = blue, reach = green, running = orange, in irons = red. Updates continuously as AWA changes. |

When the trim guide is on, render a dashed boom line at the optimal angle alongside the actual boom. The player learns to match the solid boom to the dashed guide.

---

## 12. Visual Indicators Panel

A button in the HUD (vector/eye icon, label from `t('indicators.button_label')`) opens a **floating panel** overlaid on the game world. The panel does not pause the game — it stays open while sailing. Clicking the button again (or tapping the X) closes it.

### Panel UI

```
┌─────────────────────────────────┐
│  Indicadores Visuales        ✕  │
├─────────────────────────────────┤
│  🔵  Vector de viento      [ON] │
│  ⬜  Dirección de crujía  [OFF] │
│  🟢  Vector de velocidad  [OFF] │
│  🟡  Inercia del barco    [OFF] │
│  🗺  Minimapa             [OFF] │
└─────────────────────────────────┘
```

- Each row: colored icon matching the indicator's color, label (from `t()`), toggle switch.
- Panel position: fixed to a corner of the screen (does not scroll with the world). Suggested default: top-right, below the wind HUD element.
- Panel background: semi-transparent dark, rounded corners, same visual language as the controller widgets.

### Indicators

#### 1. Wind Vector (`indicators.wind_vector`) — default ON

- **What it shows**: where the wind is coming FROM, and how strong it is.
- **Visual**: arrow drawn from the boat center. Direction points into the wind source. Length scales with wind speed: `length = windSpeed * 8px` (capped at 120px). Arrowhead at the tip. Speed label beside the tip (e.g. "12 kts").
- **Color**: sky blue.
- **Updates**: every frame (rotates with live wind; length changes if speed changes).

#### 2. Heading Vector / Crujía (`indicators.heading`) — default OFF

- **What it shows**: the exact direction the boat's bow (keel line) is pointing.
- **Visual**: line from the hull center forward along the heading angle. Fixed length ~80px. Arrowhead at the bow end.
- **Color**: bright white / cyan.
- **Educational value**: when leeway is present, this line diverges from the velocity vector — the player can see the boat is slipping sideways relative to where the bow points.

#### 3. Velocity Vector (`indicators.velocity`) — default OFF

- **What it shows**: the boat's actual direction and speed of movement over water (heading + leeway drift combined).
- **Visual**: arrow from the hull center. Direction = actual movement direction. Length proportional to boat speed: `length = boatSpeed * 10px` (capped at 100px). Arrowhead at tip. Speed value label beside tip (e.g. "5.2 kts").
- **Color**: bright green.
- **Educational value**: when both heading and velocity vectors are enabled simultaneously, the player can clearly see the **leeway angle** — the gap between the two arrows caused by the boat being pushed sideways by wind and water resistance.

#### 4. Inertia / Displacement Indicator (`indicators.inertia`) — default OFF

- **What it shows**: how the boat's weight (displacement) is affecting its response to changes — the gap between where the boat IS in speed and where it is TRYING to get to.
- **Visual**: a small floating panel anchored near the boat (world space, moves with boat):
  ```
  ┌──────────────────────┐
  │  Desplazamiento: 2 t │  ← configured displacement + class name
  │  Obj  ╌╌╌╌╌╌╌╌╌╌╌╌╌ │  ← target speed (dashed bar, white)
  │  Act  ████████░░░░░  │  ← current speed (solid bar, green)
  └──────────────────────┘
  ```
  - **Top line**: displacement value and class (`t('indicators.disp_medium')`, "2.0 t").
  - **"Obj" bar** (target speed): dashed, white — where the boat speed is heading given current trim and conditions.
  - **"Act" bar** (actual speed): solid green — current speed right now.
  - The gap between the two bars is the visual representation of inertia. Right after a tack, the gap is large and closes slowly — for a heavy boat, this is very visible.
  - Bar width: 80px total, each unit = maxSpeed/80 px.
- **Color**: panel dark translucent; "Obj" bar white dashed; "Act" bar green.
- **Updates**: every frame.

#### 5. Mini-map (`indicators.minimap`) — default OFF

- **What it shows**: a scaled-down top view of the entire world — boat position, heading, buoys, and island outlines — so the player can orient themselves without scrolling.
- **Visual**: 120×120px overlay in a configurable corner. Dark semi-transparent background. Islands as dark filled polygons. Buoys as 4px dots (grey = already rounded, orange = pending, bright orange = next target). Boat as a 5px white dot with a tiny 8px heading arrow. Start zone as a short dashed white line.
- **Scale**: `worldSize → 120px` (e.g., 3000px world = 1:25 scale). Scale factor computed on map load.
- **Corner position**: configurable via the same 3×2 grid in Controller Layout settings. Default: top-left. Stored in `sailsim_layout` alongside controller positions.
- **Updates**: redrawn every frame (fast — only a few dozen primitives at 1:25 scale).

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
| `notif.luffing_tip` | AWA < 40° for first time in session | `info` | 4 s | 60 s |
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

All sounds should be synthesized procedurally or embedded inline — no external audio files.

| Sound | Trigger | Character |
|---|---|---|
| Water ambience | Always | Low looping ocean background |
| Sail luff | AWA < 40° | Flapping fabric sound, intensity proportional to speed |
| Sail fill | On transition `luffing/stalled → trimmed` | Soft "whomp" of canvas filling with wind — one-shot, not looping |
| Tack / jibe | On `justTacked` or `justJibed` event | Short whoosh |
| Buoy rounded | On `buoyRounded` event | Short bright ping |
| Island collision | On grounding | Dull thud |
| Dock success / objective complete | On `complete` event | Pleasant chime |

---

# PART 2 — Implementation: Web / Phaser

> This part is platform-specific. To build for a different target, **replace all sections
> below** with the equivalent for your engine (e.g. "Implementation: Godot 4",
> "Implementation: Unity WebGL") and leave Part 1 completely unchanged.
>
> Current target: **Single HTML file, Phaser (verify current stable version at phaser.io)**.

---

## 13. Technical Stack

| Decision | Choice | Reason |
|---|---|---|
| Delivery | Single `index.html` file | Self-contained, no build step |
| Game library | **Phaser** (latest stable — verify at phaser.io) loaded via CDN | Mature, canvas/WebGL, scene management, input, camera |
| Physics | Custom `SailingPhysics` class (see Section 4) | Sailing math is domain-specific; do NOT use Phaser Arcade Physics or Matter.js |
| Rendering | Phaser WebGL (Canvas fallback) | Phaser default |
| World assets | Programmatically drawn via Phaser Graphics API | Simple geometry — no external files needed |
| Controller widgets | Inline SVG embedded in the HTML + loaded as Phaser textures via base64 | Rope morph and wheel detail require SVG quality; avoids external files |
| Scaling | `Phaser.Scale.FIT`, base 800×600 | Works on all screen sizes |
| Touch input | Phaser built-in pointer events | Unified mouse + touch |
| Persistence | `localStorage` | Controller positions, language preference |

---

## 14. Rendering & Assets — Phaser Implementation

World assets use **`Phaser.GameObjects.Graphics`** (programmatic drawing). Controller widgets use **inline SVG converted to base64 textures** — do not attempt to replicate them with the Graphics API.

### World assets — Phaser Graphics API

| Asset | Phaser drawing approach |
|---|---|
| **Boat hull** | `graphics.fillStyle(...).fillPoints(polygon, true)` with a pointed array of vertices |
| **Mast** | `graphics.fillCircle(x, y, 5)` |
| **Boom** | `graphics.lineBetween(mx, my, bx, by)` — rotate the Graphics object with `setAngle()` |
| **Sail** | `graphics.fillTriangle(...)`, `graphics.setAlpha(0.6)` |
| **Buoy** | `graphics.strokeCircle()` + `this.add.text()` for label |
| **Island** | `graphics.fillPoints(polygon)` with two passes (sandy outer, green inner) |
| **Dock** | `graphics.fillRect()` repeated for stripes; dashed rectangle via short `lineBetween` segments |
| **Water base** | `graphics.fillRect(0, 0, worldW, worldH)` in dark navy; color tweened toward grey-blue as wind speed increases |
| **Water dashes (wind-reactive)** | Pool of plain objects `{x, y, angle, phase}`. Each frame: advance position by `driftSpeed * windDir * delta`; wrap at world bounds. Draw each as a short `strokePoints` of 3–4 sine-offset points. Re-parameterize count/length/alpha on tier change by tweening properties in place — do NOT recreate the pool. |
| **Wake (V-wake)** | Rolling array of `{x, y, age}`. Push current position each frame; remove entries where `age > 1.5s`. Per draw: compute lateral offset `(age/1.5) * 35 * (speed/15)`, draw two `strokePoints` paths (port + starboard) with per-point alpha. `graphics.clear()` + full redraw each frame (~60 points, negligible cost). |
| **Wind arrows** | Generate once on a `RenderTexture` via `graphics.fillTriangle()`; invalidate and redraw only when wind direction changes. |
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
    NO_GO_ZONE_DEG: 40,
    MAX_RUDDER_ANGLE: 45,
    BOAT_DRAG: 0.97,
    TACK_PENALTY_FACTOR: 0.7,
    TACK_PENALTY_DURATION_MS: 1000,
    SHALLOW_SPEED_LIMIT: 1.5,
    DOCK_SUCCESS_SPEED: 1.0,
    DOCK_SUCCESS_HEADING_TOLERANCE: 20,
  };
  ```

- **Frame-rate independent**: all physics multiplied by `delta` (in seconds).
  ```js
  boatSpeed = lerp(boatSpeed, targetSpeed, CONSTANTS.ACCEL * delta);
  ```

- **No map-specific code in scenes**: `GameScene.create()` receives `this.scene.settings.data.map` and delegates entirely to `WorldBuilder.build(map)`.

- **Input abstraction**: `InputManager` is the only place Phaser pointer events are read. Everything else reads `inputManager.rudderAxis` and `inputManager.sailTrimTarget`.

- **Collision**: use `Phaser.Geom.Polygon.Contains()` for island/dock detection — not physics bodies.

- **Mobile tap targets**: all interactive controls must have a minimum hit area of 48×48px.

- **Wind arrows**: drawn once onto a `RenderTexture`; invalidated and redrawn only when wind direction changes — not every frame.

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
- [ ] On rounding, the buoy flashes yellow, a ping plays, and a brief text appears and fades.
- [ ] After rounding all buoys, entering the start zone triggers the completion banner.
- [ ] The start zone is rendered as two coloured posts with a dashed line between them.
- [ ] Stuck-in-irons state is entered after 2 continuous seconds of AWA < 30° and speed < 1 kts.
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
- [ ] Sail luffing shimmer (blue-white) oscillates continuously while AWA < 40° and stops immediately when AWA > 40°.
- [ ] Off-screen objective arrow appears on the screen edge when the next buoy is outside the viewport; disappears when it enters.
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

### Part 2 — Web / Phaser Implementation

- [ ] Everything is contained in a single `index.html` file.
- [ ] Both controllers work on mouse and touch.
- [ ] The game scales correctly to any screen size (desktop and mobile).
- [ ] Wind arrows are drawn on a RenderTexture and not redrawn every frame.
- [ ] The game runs at 60fps on a modern mobile browser.
- [ ] Settings panel changes wind direction, speed, and variability in real time.
