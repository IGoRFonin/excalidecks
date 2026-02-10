---
name: excalidraw-presentation
description: "Create beautiful vertical-scroll canvas presentations on a live Excalidraw canvas. Use when user requests: create presentation, make slides, canvas presentation, excalidraw presentation, visual slides."
allowed-tools: Bash(node *)
---

# Excalidraw Canvas Presentation Skill

Create beautiful vertical-scroll canvas presentations on a **live Excalidraw canvas** — the user sees elements appear in real-time in the browser.

## When to Use

Trigger on ANY of these:
- User requests: "create presentation", "make slides", "canvas presentation"
- User mentions: "excalidraw presentation", "visual slides", "canvas deck"
- Architecture/education documentation with visual slide layout

## CRITICAL: Server & Environment Setup

Before creating a presentation, you MUST ensure the Excalidecks server is running.

### Step 0: Ensure server is running (with version check)

Run the ensure-server script. It checks health, builds if needed, starts the server, and handles version upgrades — all in one `node` call:

```bash
node "$(find ~/.claude -name ensure-server.cjs -path '*/excalidraw-presentation/*' 2>/dev/null | head -1)"
```

## How It Works

1. Start the server (Step 0)
2. Write presentation code to `~/.excalidecks/presentation.js` using the **Write** tool
3. Run `node ~/.excalidecks/presentation.js` to push elements to the live server
4. User sees the presentation at http://localhost:41520

## Implementation

### Two-step generation: Write + Run

**Step A**: Use the **Write** tool to create `~/.excalidecks/presentation.js`:

```js
// ~/.excalidecks/presentation.js
const { ExcalidrawPresentation } = require(
  require('child_process').execSync(
    "find ~/.claude -name excalidraw_presentation.cjs -path '*/excalidraw-presentation/*' 2>/dev/null | head -1"
  ).toString().trim()
);

const p = new ExcalidrawPresentation();
let y = 0;

// ... build presentation ...

p.push();  // sends to http://localhost:41520 and clears previous elements
```

**Step B**: Run it:

```bash
node ~/.excalidecks/presentation.js
```

This approach keeps bash commands simple (`node <path>`) so they match `Bash(node *)` and require no user confirmation.

## CRITICAL: Element Generation Rules

### Every element MUST have ALL these properties:
```json
{
  "id": "unique-descriptive-id",
  "type": "rectangle",
  "x": 0, "y": 0, "width": 100, "height": 100,
  "angle": 0, "strokeColor": "#1971c2",
  "backgroundColor": "#e7f5ff", "fillStyle": "solid",
  "strokeWidth": 2, "strokeStyle": "solid",
  "roughness": 1, "opacity": 100,
  "groupIds": [], "frameId": null,
  "roundness": { "type": 3 },
  "isDeleted": false, "boundElements": [],
  "locked": false, "seed": 12345,
  "version": 1, "versionNonce": 1
}
```

### Text elements require extra properties:
```json
{
  "type": "text",
  "text": "Your text here", "fontSize": 36,
  "fontFamily": 6, "textAlign": "left", "verticalAlign": "top",
  "containerId": null, "originalText": "Your text here",
  "autoResize": true, "lineHeight": 1.25
}
```

### CRITICAL: Generate unique `seed` for EVERY element
Use random integers. Each element must have a different seed.

## Presentation Layout System

### Canvas dimensions
- **Slide width**: ~960px (content area within padding)
- **Slide X origin**: ~15-60px from left
- **Vertical stacking**: Slides arranged top-to-bottom with ~120px gaps
- **Typical slide height**: 2000-6000px depending on content

### Slide background pattern
Each slide has a large rounded rectangle as background:
```
Background: fill=#f8f9fa, stroke=#ced4da, strokeWidth=2, roundness={type:3}
Width: ~977px, Height: varies by content
```

### Shadow effect (gives depth to cards)
Place a light semi-transparent rectangle BEHIND the main card, offset +6px right and +6px down:
```
Shadow:  x=cardX+6, y=cardY+6, same size, fill=#adb5bd, stroke=transparent, opacity=40
Card:    x=cardX,   y=cardY,   fill=<card-color>, stroke=<card-stroke>
```
IMPORTANT: Shadow element must come BEFORE the card element in the elements array.

## Visual Component Library

### 1. Title Header Block
```
[Purple banner rect: w=726, h=90, fill=#be4bdb, stroke=#9c36b5]
  [Circle inside: w=60, h=60, fill=#9c36b5, stroke=#862e9c] — icon/number
  [Title text: fontSize=36, fontFamily=5 (Excalifont), color=#ffffff]
  [Subtitle text: fontSize=20, fontFamily=6 (Nunito), color=#f3d9fa]
[Badge rects on right: w=130, h=35, fill=<color>] — metadata tags
```

### 2. Section Header
```
[Rect: w=900, h=70, fill=#339af0, stroke=#1971c2]
  [Text: fontSize=35, fontFamily=7 (Lilita One), color=#ffffff, textAlign=center]
```

### 3. Content Card (2-column layout)
```
Left card:  x=42,  w=430, fill=#fff4e6, stroke=#e67700
Right card: x=492, w=450, fill=#f8f0fc, stroke=#9c36b5
Each card has:
  [Header strip: same width, h=36, fill=<darker-color>]
  [Tag badge: w=135, h=27, fill=<accent>, with label text]
  [Content text: fontSize=16-18, fontFamily=6 (Nunito)]
```

### 4. Comparison Block (Before/After)
```
Left column (negative): fill=#fff5f5, stroke=#fa5252
Right column (positive): fill=#ebfbee, stroke=#40c057
Labels in small rects at top
Bullet items with fontSize=17
```

### 5. Tip/Insight Box
```
[Emoji circle or icon]
[Light background rect: fill=#fff9db, stroke=#f59f00]
[Text: fontSize=17-18]
```

## Color Palette

### Theme colors (fill -> stroke pairs):
| Purpose | Background | Stroke | Dark fill |
|---------|-----------|--------|-----------|
| Blue/Info | #e7f5ff | #1971c2 | #228be6 |
| Green/Success | #ebfbee | #2f9e44 | #40c057 |
| Orange/Warning | #fff4e6 | #e67700 | #ffd43b |
| Yellow | #fff9db | #f59f00 | #ffd43b |
| Red/Error | #fff5f5 | #c92a2a | #fa5252 |
| Purple | #f8f0fc | #9c36b5 | #be4bdb |
| Violet | #f3f0ff | #5f3dc4 | #7950f2 |
| Cyan | #e3fafc | #0b7285 | #15aabf |
| Neutral card | #f8f9fa | #ced4da | #495057 |

### Text colors:
- On dark backgrounds: `#ffffff` or `#f3d9fa`
- On light backgrounds: `#1e1e1e` or `#495057`
- Muted text: `#868e96`

## Typography

| Role | fontSize | fontFamily | Notes |
|------|----------|------------|-------|
| Slide title | 36-42 | 5 (Excalifont) | Hand-drawn feel |
| Section header | 28-35 | 7 (Lilita One) | Bold display |
| Block title | 24 | 6 (Nunito) | Dark on light |
| Body text | 16-18 | 6 (Nunito) | Main content |
| Labels/tags | 12-14 | 6 (Nunito) | Inside badges |
| Code/mono | 14-16 | 8 (Comic Shanns) | Technical terms |

**NEVER use deprecated fonts:** 1 = Virgil (OLD), 3 = Cascadia (OLD)

## CRITICAL: Design Discipline Rules

### Rule 1: NO unauthorized decorations
**NEVER** add visual elements not in the source material.

### Rule 2: Layout math BEFORE rendering
**ALWAYS** verify children fit inside parent:
```
availableWidth = containerWidth - 2 * padding
cardWidth = (availableWidth - (nCards - 1) * gap) / nCards
```

### Rule 3: Palette consistency
Choose 2-3 theme colors for the entire presentation. Never use neutral gray for content headers.

### Rule 4: Mathematical centering ONLY
Use `p.centerTextInRect()` and `p.centerTextInCircle()`, never magic numbers.

## Available Helper Methods

**Layout components:**
- `slideBackground(id, y, height)` — slide bg rect
- `titleBanner(id, y, title, subtitle, color, iconText, badges)` — header banner
- `sectionHeader(id, y, title, color)` — full-width section bar
- `blockNumber(id, y, number, label, duration, color)` — numbered block indicator

**Cards:**
- `nCards(id, y, cards, height, gap, padding)` — N side-by-side cards with auto widths
- `twoCards(id, y, ...)` — convenience for 2 cards
- `contentCard(id, x, y, w, h, title, body, color, tag, withShadow)` — single card

**Content blocks:**
- `comparison(id, y, negativeTitle, negativeItems, positiveTitle, positiveItems)` — before/after
- `tipBox(id, y, text, emoji, color)` — highlighted tip box
- `bulletList(id, x, y, items, color, fontSize, bulletColor)` — bulleted list
- `progressDots(id, x, y, total, active, color)` — diamond dot row
- `separatorLine(id, y, color)` — horizontal separator

**Centering helpers:**
- `centerTextInRect(text, fontSize, rectX, rectY, rectW, rectH, family)`
- `centerTextInCircle(text, fontSize, circleX, circleY, diameter, family)`

**Primitives:**
- `rect()`, `text()`, `circle()`, `line()`, `diamond()`, `shadow()`

**Output:**
- `push(url="http://localhost:41520", clear=true)` — push to live server (async, default: clears canvas first)
- `save(path)` — save to .excalidraw file (fallback)

## Usage Example

Write this to `~/.excalidecks/presentation.js` using the **Write** tool:

```js
const { ExcalidrawPresentation } = require(
  require('child_process').execSync(
    "find ~/.claude -name excalidraw_presentation.cjs -path '*/excalidraw-presentation/*' 2>/dev/null | head -1"
  ).toString().trim()
);

const p = new ExcalidrawPresentation();
let y = 0;

// Slide 1 - Title
let slide1H = 800;
p.slideBackground("s1-bg", y, slide1H);
let yPos = y + 30;
yPos = p.titleBanner("s1-header", yPos,
  "MY PRESENTATION",
  "Subtitle here",
  "purple", "🎯",
  [["TOPIC", "blue"], ["30 min", "green"]]);
yPos = p.sectionHeader("s1-section", yPos,
  "KEY POINTS", "blue");
yPos = p.twoCards("s1-cards", yPos,
  "First point",
  "Description of first point",
  "Second point",
  "Description of second point",
  "orange", "purple",
  "LEGO", "DESIGN");

// Fix slide height
for (const el of p.elements) {
  if (el.id === "s1-bg") el.height = yPos - y + 30;
}

p.push();  // live preview at http://localhost:41520
```

Then run:

```bash
node ~/.excalidecks/presentation.js
```

## Key Design Principles

1. **roughness: 1** — hand-drawn Excalidraw feel
2. **fillStyle: "solid"** — no hatching
3. **roundness: {type: 3}** for rectangles
4. **Consistent spacing**: 50px between related items, 100px between sections
5. **2-column layout** for comparisons
6. **Color-code by theme**
7. **Soft shadows** on key cards
8. **Vertical scroll** — slides stack top-to-bottom
