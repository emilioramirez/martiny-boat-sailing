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
  objectiveKey: "map.buoy1.objective"  // i18n key — resolved via t()
}
```

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
  ├── Settings panel
  └── Back to Menu  [t('pause.menu')]
```

State transitions do not lose world state (map, boat position, wind) unless the player explicitly returns to the menu.

---

## 8. Visual Asset Specification

All assets use only programmatic drawing — no external image files. Every asset is described by its visual properties; the specific drawing API used belongs in Part 2.

| Asset | Shape & dimensions | Colors | Behavior |
|---|---|---|---|
| **Boat hull** | Elongated pointed polygon, ~60×18px. Bow is the narrow pointed end. | Cream/white fill, dark grey outline | Rotates with boat heading |
| **Mast** | Filled circle, ~5px radius | Dark grey | Fixed at hull center |
| **Boom** | Line from mast, ~28px long | Dark grey | Rotates with sail trim angle; always to the downwind side |
| **Sail** | Filled triangle: mast tip → boom tip → mast base | Semi-transparent white, alpha 0.6 | Follows boom; flaps slightly when luffing |
| **Wake trail** | Series of line segments behind the boat | White, alpha fades from 0.6 to 0 over 2 seconds | Dashed, updates each frame |
| **Buoy** | Circle, ~14px radius | Orange fill, white stroke | Number label centered in bold; pulses slightly on rounding |
| **Island** | Irregular closed polygon | Sandy/tan at edges, green interior (two-layer polygon) | Static world object |
| **Dock** | Rectangle with alternating light/dark stripes | Tan/brown; target zone in dashed green | Static; target zone highlights when boat is close |
| **Water background** | Fills entire world | Very dark navy blue with subtle gradient | Small animated wave lines; wind arrows tiled over it |
| **Wind arrows (water)** | Small chevron arrows tiled across the water | Low opacity (0.2), white/light blue | Point in wind direction; update only when wind changes |
| **No-go zone arc** | Semi-transparent arc at the bow, ±40° spread | Red, alpha 0.3 | Rotates with boat; togglable |
| **Mainsheet Controller rope** | Taut: ~100×6px tall thin line with braided cross-hatch. Eased: ~30×18px short wavy segment. Morphs between states. | Rope: warm brown/tan. Background panel: dark, alpha 0.5, rounded corners. | Cleat handle (circle, ~12px) at bottom; drags to control trim |
| **Helm Controller wheel** | Circle ~80px diameter, 6 spokes, grab handle (~10px circle) on rim. Adjacent mini-boat silhouette (~50×16px) with rudder line at stern. | Wheel: dark wood tone, gold accents. Panel: same as rope controller. | Wheel rotates on drag; rudder line on mini-boat rotates to match; PORT/STBD labels highlight |
| **Wind vector arrow** | Arrow from boat center, direction = where wind comes FROM. Length proportional to wind speed (8px per knot, max 120px). Arrowhead at tip. Small speed label beside arrow tip. | Sky blue / light blue. | Rotates with live wind direction; length scales with wind speed. Togglable. |
| **Heading vector (crujía)** | Line from hull center forward along boat heading angle. Fixed length ~80px. Arrowhead at tip. | Bright white / cyan. | Rotates with boat heading. Togglable. |
| **Velocity vector** | Arrow from hull center in actual movement direction (heading + leeway). Length proportional to boat speed (10px per knot). Arrowhead at tip. | Bright green. | May diverge from heading vector when leeway is present — the gap between the two is educationally significant. Togglable. |
| **Inertia / Displacement indicator** | Small floating panel near the boat: two stacked horizontal bars — "Target" (dashed, white) and "Current" (solid, green). Bars represent speed. Gap between them shows how much inertia is delaying the response. Text label below: displacement value and class name. | Panel: dark semi-transparent. Bars: green (current) and white dashed (target). Label text: dim white. | Bars update every frame. Gap closes as boat accelerates/decelerates toward target. Togglable. |
| **Indicators button** | Small square icon button in the HUD corner. Shows a vector/eye icon. | Semi-transparent dark background, white icon. | Opens/closes the IndicatorsPanel floating window. |

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
├── ObjectiveTracker       Checks completion conditions for the active map
│     update(boatState, map) → { complete: bool, message: string }
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
InputManager → SailingPhysics.update() → boatState → render + HUD + ObjectiveTracker + IndicatorsPanel
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

### Indicator state persistence

The on/off state of each indicator is saved to persistent storage under key `sailsim_indicators` as `{ windVector: bool, heading: bool, velocity: bool, inertia: bool }`. Restored on load.

---

## 13. Audio

All sounds should be synthesized procedurally or embedded inline — no external audio files.

| Sound | Trigger | Character |
|---|---|---|
| Water ambience | Always | Low looping ocean background |
| Sail luff | AWA < 40° | Flapping fabric sound, intensity proportional to speed |
| Tack / jibe | On `justTacked` or `justJibed` event | Short whoosh |
| Dock success | On objective complete | Pleasant chime |

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
| Assets | Programmatically drawn via Phaser Graphics API | No external image files — single file delivery |
| Scaling | `Phaser.Scale.FIT`, base 800×600 | Works on all screen sizes |
| Touch input | Phaser built-in pointer events | Unified mouse + touch |
| Persistence | `localStorage` | Controller positions, language preference |

---

## 14. Rendering & Assets — Phaser Implementation

Use **`Phaser.GameObjects.Graphics`** to draw all assets described in Section 8. No external textures.

| Asset | Phaser drawing approach |
|---|---|
| **Boat hull** | `graphics.fillStyle(...).fillPoints(polygon, true)` with a pointed array of vertices |
| **Mast** | `graphics.fillCircle(x, y, 5)` |
| **Boom** | `graphics.lineBetween(mx, my, bx, by)` — rotate the Graphics object with `setAngle()` |
| **Sail** | `graphics.fillTriangle(...)`, `graphics.setAlpha(0.6)` |
| **Wake trail** | Array of recent positions; draw with `graphics.strokePoints()`, decreasing alpha per segment |
| **Buoy** | `graphics.strokeCircle()` + `this.add.text()` for label |
| **Island** | `graphics.fillPoints(polygon)` with two passes (sandy outer, green inner) |
| **Dock** | `graphics.fillRect()` repeated for stripes; dashed rectangle via short `lineBetween` segments |
| **Water** | `graphics.fillRect(0, 0, worldW, worldH)` in dark navy; wave lines as thin `lineBetween` calls updated each frame |
| **Wind arrows** | Generate once on a `RenderTexture` via `graphics.fillTriangle()`; update only when wind changes |
| **No-go zone arc** | `graphics.slice(x, y, r, startAngle, endAngle)` in red with `setAlpha(0.3)`; child of boat |
| **Rope controller** | `graphics.strokeLineShape()` for taut state; `graphics.strokePoints(curvedPath)` for eased state |
| **Helm controller** | `graphics.strokeCircle()` for wheel rim, `graphics.lineBetween()` for spokes, `graphics.fillCircle()` for grab handle |

All interactive widget Graphics objects live in a fixed camera (not the world camera) so they don't scroll with the map.

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
