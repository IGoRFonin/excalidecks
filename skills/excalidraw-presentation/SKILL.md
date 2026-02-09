---
name: excalidraw-presentation
description: "Create beautiful vertical-scroll canvas presentations in .excalidraw format. Use when user requests: create presentation, make slides, canvas presentation, excalidraw presentation, visual slides."
---

# Excalidraw Canvas Presentation Skill

Create beautiful vertical-scroll canvas presentations in `.excalidraw` format — similar to Miro/FigJam boards but for educational/YouTube content.

## When to Use

Trigger on ANY of these:
- User requests: "create presentation", "make slides", "canvas presentation"
- User mentions: "excalidraw presentation", "visual slides", "canvas deck"
- Architecture/education documentation with visual slide layout

## CRITICAL: Server & Environment Setup

Before creating a presentation, you MUST ensure the Excalidecks server is running and locate the plugin directory.

### Step 0: Find the plugin directory and ensure server is running

Run this bash snippet FIRST, before any presentation generation:

```bash
# Find excalidecks plugin directory (works for both local .claude/skills and marketplace installs)
EXCALIDECKS_DIR=$(dirname "$(find ~/.claude -name excalidraw_presentation.py -path '*/excalidraw-presentation/*' 2>/dev/null | head -1)")
if [ -z "$EXCALIDECKS_DIR" ]; then
  EXCALIDECKS_DIR=$(find . -name excalidraw_presentation.py -path '*/excalidraw-presentation/*' 2>/dev/null | head -1 | xargs dirname)
fi
echo "EXCALIDECKS_DIR=$EXCALIDECKS_DIR"

# Project root is 3 levels up from .claude/skills/excalidraw-presentation/
PROJECT_DIR=$(cd "$EXCALIDECKS_DIR/../../.." 2>/dev/null && pwd)
echo "PROJECT_DIR=$PROJECT_DIR"

# Check if server is already running
if curl -s http://localhost:41520/health >/dev/null 2>&1; then
  echo "Server already running"
else
  # Try to start from existing dist
  if [ -f "$PROJECT_DIR/dist/index.js" ]; then
    echo "Starting server from existing build..."
    nohup node "$PROJECT_DIR/dist/index.js" --canvas-only > /dev/null 2>&1 &
  else
    # Full build: install deps, build, clean up
    echo "Building excalidecks (first run)..."
    cd "$PROJECT_DIR"
    npm ci --silent 2>&1
    npm run build --silent 2>&1
    rm -rf node_modules
    echo "Build complete, starting server..."
    nohup node dist/index.js --canvas-only > /dev/null 2>&1 &
    cd - > /dev/null
  fi

  # Wait for server to be ready (max 10s)
  for i in $(seq 1 10); do
    if curl -s http://localhost:41520/health >/dev/null 2>&1; then
      echo "Server started successfully"
      break
    fi
    sleep 1
  done
fi
```

Save `EXCALIDECKS_DIR` — you will use it for the Python import path in the next step.

## Output Format

Generate a valid `.excalidraw` JSON file. The format is plain JSON — no libraries needed.

## File Structure

```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "https://excalidraw.com",
  "elements": [ /* all elements here */ ],
  "appState": {
    "viewBackgroundColor": "#f8f9fa",
    "gridSize": 20,
    "gridStep": 5,
    "gridModeEnabled": false
  },
  "files": {}
}
```

## CRITICAL: Element Generation Rules

### Every element MUST have ALL these properties:
```json
{
  "id": "unique-descriptive-id",
  "type": "rectangle",
  "x": 0,
  "y": 0,
  "width": 100,
  "height": 100,
  "angle": 0,
  "strokeColor": "#1971c2",
  "backgroundColor": "#e7f5ff",
  "fillStyle": "solid",
  "strokeWidth": 2,
  "strokeStyle": "solid",
  "roughness": 1,
  "opacity": 100,
  "groupIds": [],
  "frameId": null,
  "roundness": { "type": 3 },
  "isDeleted": false,
  "boundElements": [],
  "locked": false,
  "seed": 12345,
  "version": 1,
  "versionNonce": 1
}
```

### Text elements require extra properties:
```json
{
  "id": "text-unique-id",
  "type": "text",
  "x": 0,
  "y": 0,
  "width": 300,
  "height": 45,
  "text": "Your text here",
  "fontSize": 36,
  "fontFamily": 6,
  "textAlign": "left",
  "verticalAlign": "top",
  "strokeColor": "#1e1e1e",
  "backgroundColor": "transparent",
  "fillStyle": "solid",
  "roughness": 1,
  "isDeleted": false,
  "strokeWidth": 2,
  "strokeStyle": "solid",
  "opacity": 100,
  "angle": 0,
  "groupIds": [],
  "frameId": null,
  "roundness": null,
  "boundElements": [],
  "locked": false,
  "containerId": null,
  "originalText": "Your text here",
  "autoResize": true,
  "lineHeight": 1.25,
  "seed": 12346,
  "version": 1,
  "versionNonce": 1
}
```

### Ellipse elements (for decorative circles):
```json
{
  "id": "circle-unique-id",
  "type": "ellipse",
  "x": 0,
  "y": 0,
  "width": 60,
  "height": 60,
  "backgroundColor": "#9c36b5",
  "strokeColor": "#862e9c",
  "strokeWidth": 2,
  "fillStyle": "solid",
  "roughness": 1,
  "isDeleted": false,
  "strokeStyle": "solid",
  "opacity": 100,
  "angle": 0,
  "groupIds": [],
  "frameId": null,
  "roundness": null,
  "boundElements": [],
  "locked": false,
  "seed": 12347,
  "version": 1,
  "versionNonce": 1
}
```

### Line elements (for separators/underlines):
```json
{
  "id": "line-unique-id",
  "type": "line",
  "x": 100,
  "y": 500,
  "width": 200,
  "height": 0,
  "strokeColor": "#be4bdb",
  "strokeWidth": 2,
  "fillStyle": "solid",
  "roughness": 1,
  "isDeleted": false,
  "strokeStyle": "solid",
  "opacity": 100,
  "angle": 0,
  "groupIds": [],
  "frameId": null,
  "roundness": { "type": 2 },
  "boundElements": [],
  "locked": false,
  "points": [[0, 0], [200, 0]],
  "startBinding": null,
  "endBinding": null,
  "startArrowhead": null,
  "endArrowhead": null,
  "seed": 12348,
  "version": 1,
  "versionNonce": 1
}
```

### Diamond elements (for decorative dots):
```json
{
  "id": "dot-unique-id",
  "type": "diamond",
  "x": 100,
  "y": 100,
  "width": 12,
  "height": 12,
  "backgroundColor": "#ffd43b",
  "strokeColor": "#f59f00",
  "strokeWidth": 2,
  "fillStyle": "solid",
  "roughness": 1,
  "isDeleted": false,
  "strokeStyle": "solid",
  "opacity": 100,
  "angle": 0,
  "groupIds": [],
  "frameId": null,
  "roundness": null,
  "boundElements": [],
  "locked": false,
  "seed": 12349,
  "version": 1,
  "versionNonce": 1
}
```

## CRITICAL: Generate unique `seed` for EVERY element
Use random integers. Each element must have a different seed. This is required for proper rendering.

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
IMPORTANT: Shadow element must come BEFORE the card element in the elements array (renders behind).

## Visual Component Library

### 1. Title Header Block
A colored banner with icon circle + title text + subtitle:
```
[Purple banner rect: w=726, h=90, fill=#be4bdb, stroke=#9c36b5]
  [Circle inside: w=60, h=60, fill=#9c36b5, stroke=#862e9c] — icon/number
  [Title text: fontSize=36, fontFamily=5 (Excalifont), color=#ffffff]
  [Subtitle text: fontSize=20, fontFamily=6 (Nunito), color=#f3d9fa]
[Badge rects on right: w=130, h=35, fill=<color>] — metadata tags
```

### 2. Section Header
Full-width colored bar:
```
[Rect: w=900, h=70, fill=#339af0, stroke=#1971c2]
  [Text: fontSize=35, fontFamily=7 (Lilita One), color=#ffffff, textAlign=center]
```

### 3. Content Card (2-column layout)
Two cards side by side with headers:
```
Left card:  x=42,  w=430, fill=#fff4e6, stroke=#e67700
Right card: x=492, w=450, fill=#f8f0fc, stroke=#9c36b5
Each card has:
  [Header strip: same width, h=36, fill=<darker-color>]
  [Tag badge: w=135, h=27, fill=<accent>, with label text]
  [Content text: fontSize=16-18, fontFamily=6 (Nunito)]
```

### 4. Comparison Block (Before/After, With/Without)
```
Left column (negative): fill=#fff5f5, stroke=#fa5252
Right column (positive): fill=#ebfbee, stroke=#40c057
Labels in small rects at top: "БЕЗ..." / "С..."
Bullet items with fontSize=17
```

### 5. Tip/Insight Box
```
[Emoji circle or icon]
[Light background rect: fill=#fff9db, stroke=#f59f00]
[Text: fontSize=17-18]
```

### 6. Block Number Indicator
```
[Circle: w=50, h=50, fill=<theme-color>]
  [Number text: fontSize=23, color=#ffffff]
[Label: "БЛОК 1", fontSize=16]
[Duration: "12-15 мин", fontSize=12]
```

### 7. Progress/Status Dots
Row of small diamonds:
```
[Diamond: w=12, h=12, fill=#ffd43b, stroke=#f59f00] × N
Spacing: 16px apart
```

## Color Palette

### Theme colors (fill → stroke pairs):
| Purpose | Background | Stroke | Dark fill |
|---------|-----------|--------|-----------|
| Blue/Info | #e7f5ff | #1971c2 | #228be6 |
| Blue accent | #d0ebff | #1971c2 | #339af0 |
| Green/Success | #ebfbee | #2f9e44 | #40c057 |
| Green light | #d3f9d8 | #2f9e44 | #51cf66 |
| Orange/Warning | #fff4e6 | #e67700 | #ffd43b |
| Yellow | #fff9db | #f59f00 | #ffd43b |
| Red/Error | #fff5f5 | #c92a2a | #fa5252 |
| Purple | #f8f0fc | #9c36b5 | #be4bdb |
| Violet | #f3f0ff | #5f3dc4 | #7950f2 |
| Neutral card | #f8f9fa | #ced4da | #495057 |
| Cyan | #e3fafc | #0b7285 | #15aabf |

### Text colors:
- On dark backgrounds: `#ffffff` or `#f3d9fa` (light purple for subtitles)
- On light backgrounds: `#1e1e1e` or `#495057`
- Muted text: `#868e96`

## Typography

| Role | fontSize | fontFamily | Notes |
|------|----------|------------|-------|
| Slide title | 36-42 | 5 (Excalifont) | Hand-drawn feel, white on dark bg |
| Section header | 28-35 | 7 (Lilita One) | Bold display, white on colored banner |
| Block title | 24 | 6 (Nunito) | Dark on light |
| Body text | 16-18 | 6 (Nunito) | Main content, paragraphs |
| Labels/tags | 12-14 | 6 (Nunito) | Inside small badge rects |
| Code/mono | 14-16 | 8 (Comic Shanns) | Technical terms, code snippets |

**fontFamily values:**
- 5 = Excalifont (hand-drawn) — use for main titles only
- 6 = Nunito (normal sans-serif) — use for body text, paragraphs, labels
- 7 = Lilita One (bold display) — use for section headers
- 8 = Comic Shanns (code/mono) — use for code and technical text

**NEVER use deprecated fonts:**
- 1 = Virgil (OLD) — replaced by Excalifont (5)
- 3 = Cascadia (OLD) — replaced by Nunito (6) / Comic Shanns (8)

## CRITICAL: Design Discipline Rules

### Rule 1: NO unauthorized decorations
**NEVER** add visual elements that are not in the source material:
- No "decorative" bars, badges, or shapes added "for beauty"
- No extra labels like "Проверено на практике" unless explicitly in the source
- If the source has a clean header — keep it clean. Do NOT add colored bars above/below it
- Every visual element must serve a purpose that traces back to the source content

### Rule 2: Layout math BEFORE rendering
**ALWAYS** verify that children fit inside their parent container:
```
available_width = container_width - 2 * padding
card_width = (available_width - (n_cards - 1) * gap) / n_cards
```
Use `p.n_cards()` method for 3+ cards — it handles padding and gaps automatically.
NEVER hardcode card widths without checking: `n * card_w + (n-1) * gap + 2 * padding <= container_w`

### Rule 3: Palette consistency
**NEVER** use neutral gray (#495057) as a default "because nothing else came to mind":
- At the start of generation, choose 2-3 theme colors for the entire presentation
- All section headers, cards, accents must use colors from this chosen palette
- If the source material has a dominant color scheme (warm/cool), follow it
- "neutral" color is ONLY for slide backgrounds, never for content headers

### Rule 4: Mathematical centering ONLY
**NEVER** use magic numbers for positioning text inside shapes:
- Use `p.center_text_in_rect(text, font_size, rect_x, rect_y, rect_w, rect_h)` helper
- For emoji in circles: `p.center_text_in_circle(emoji, font_size, cx, cy, diameter)`
- For badge text: calculate with formula, never eyeball with +8, +10 offsets

## Slide Construction Workflow

### Step 1: Plan slide content
Determine what goes on each slide, how many slides total.

### Step 2: Calculate Y positions
```
slide1_y = 0
slide1_height = calculate_based_on_content
slide2_y = slide1_y + slide1_height + 120
...
```

### Step 3: Build each slide bottom-up (render order)
1. Shadow rectangles (if using shadow effect)
2. Slide background rectangle
3. Colored header/banner rectangles
4. Content card rectangles
5. Tag/badge small rectangles
6. Decorative elements (circles, diamonds, lines)
7. Text elements (on top of everything)

### Step 4: Assign unique IDs
Use descriptive prefixes: `slide1-bg`, `slide1-title`, `slide1-card-left`, `slide1-text-body-1`

## Example: Minimal 2-Slide Presentation

A presentation with title slide + content slide would have:
- **Slide 1** (y=0): Background rect + title banner + subtitle + metadata badges
- **Slide 2** (y=slide1_height+120): Background rect + section header + 2 content cards (comparison) + tip box

## Implementation Notes

### CRITICAL: Do NOT create intermediate Python files
The helper library is bundled with the plugin at the `EXCALIDECKS_DIR` path found in Step 0.

**DO NOT** create a separate `.py` script file. Instead, run Python inline via Bash heredoc, using the `EXCALIDECKS_DIR` found earlier:

```bash
python3 << 'PYEOF'
import sys, subprocess
# Find the plugin directory dynamically
import glob
paths = glob.glob('/Users/*/.claude/**/excalidraw_presentation.py', recursive=True)
if not paths:
    paths = glob.glob('.claude/**/excalidraw_presentation.py', recursive=True)
skill_dir = __import__('os').path.dirname(paths[0])
sys.path.insert(0, skill_dir)
from excalidraw_presentation import ExcalidrawPresentation

p = ExcalidrawPresentation()

# ... build presentation using p.title_banner(), p.section_header(), etc. ...

p.save("output.excalidraw")
PYEOF
```

This avoids creating temporary files — only the final `.excalidraw` output is written.

### Available methods in ExcalidrawPresentation:

**Layout components:**
- `slide_background(id, y, height)` — slide bg rect
- `title_banner(id, y, title, subtitle, color, icon_text, badges)` — header banner
- `section_header(id, y, title, color)` — full-width section bar
- `block_number(id, y, number, label, duration, color)` — numbered block indicator

**Cards:**
- `n_cards(id, y, cards, height, gap, padding)` — N side-by-side cards with auto-calculated widths. `cards` is a list of dicts: `[{"title": ..., "body": ..., "color": ..., "tag": ...}]`
- `two_cards(id, y, ...)` — convenience wrapper for 2 cards (uses `n_cards` internally)
- `content_card(id, x, y, w, h, title, body, color, tag, with_shadow)` — single card

**Content blocks:**
- `comparison(id, y, negative_title, negative_items, positive_title, positive_items)` — before/after
- `tip_box(id, y, text, emoji, color)` — highlighted tip box
- `bullet_list(id, x, y, items, color, font_size, bullet_color)` — bulleted list
- `progress_dots(id, x, y, total, active, color)` — diamond dot row
- `separator_line(id, y, color)` — horizontal separator

**Centering helpers (use these, NEVER magic numbers):**
- `center_text_in_rect(text, font_size, rect_x, rect_y, rect_w, rect_h, family)` — returns `(x, y)` for centered text
- `center_text_in_circle(text, font_size, circle_x, circle_y, diameter, family)` — returns `(x, y)` for centered text

**Primitives:**
- `rect()`, `text()`, `circle()`, `line()`, `diamond()`, `shadow()`

### Text size calculations:
- fontFamily 5 (Excalifont): `len(text) * fontSize * 0.85`
- fontFamily 6 (Nunito): `len(text) * fontSize * 0.62`
- fontFamily 7 (Lilita One): `len(text) * fontSize * 0.65`
- fontFamily 8 (Comic Shanns): `len(text) * fontSize * 0.68`
- Height: `ceil(text_lines) * fontSize * lineHeight`

### Usage example (via heredoc):
```bash
python3 << 'PYEOF'
import sys, os, glob
paths = glob.glob(os.path.expanduser('~/.claude/**/excalidraw_presentation.py'), recursive=True)
if not paths:
    paths = glob.glob('.claude/**/excalidraw_presentation.py', recursive=True)
sys.path.insert(0, os.path.dirname(paths[0]))
from excalidraw_presentation import ExcalidrawPresentation

p = ExcalidrawPresentation()
y = 0

# Slide 1 - Title
slide1_h = 800
p.slide_background("s1-bg", y, slide1_h)
y_pos = y + 30
y_pos = p.title_banner("s1-header", y_pos,
    title="МОЯ ПРЕЗЕНТАЦИЯ",
    subtitle="Подзаголовок здесь",
    color="purple", icon_text="🎯",
    badges=[("ТЕМА 1", "blue"), ("30 мин", "green")])
y_pos = p.section_header("s1-section", y_pos,
    "ОСНОВНЫЕ ТЕЗИСЫ", color="blue")
y_pos = p.two_cards("s1-cards", y_pos,
    left_title="Первый пункт",
    left_body="Описание первого пункта\nс деталями",
    right_title="Второй пункт",
    right_body="Описание второго пункта\nс деталями",
    left_color="orange", right_color="purple",
    left_tag="LEGO", right_tag="ДИЗАЙН")
# Fix slide height
for el in p.elements:
    if el["id"] == "s1-bg":
        el["height"] = y_pos - y + 30
p.save("presentation.excalidraw")
PYEOF
```

## Key Design Principles

1. **roughness: 1** everywhere — gives the hand-drawn Excalidraw feel
2. **fillStyle: "solid"** always — no hatching or cross-hatch
3. **roundness: {type: 3}** for rectangles — smooth rounded corners
4. **Consistent spacing**: 50px between related items, 100px between sections
5. **2-column layout** for comparisons, side-by-side cards
6. **Color-code by theme**: each topic gets a consistent color pair
7. **Soft shadows** on key cards — `fill=#adb5bd, opacity=40, offset +6px`
8. **Emoji as icons** in text
9. **Badge labels** for metadata (duration, block number, category)
10. **Vertical scroll** — not horizontal. Slides stack top-to-bottom.

## CRITICAL: Centering text in shapes

To center text inside a circle/rectangle:
```python
# Circle: center = (circle_x + size/2, circle_y + size/2)
# Text position:
text_x = circle_x + (circle_size - text_width) / 2
text_y = circle_y + (circle_size - text_height) / 2
```
To center text in a badge/rect:
```python
text_x = rect_x + (rect_width - text_width) / 2
text_y = rect_y + (rect_height - text_height) / 2
```

## CRITICAL: Emoji rendering

Emojis render wider than their character count suggests. When placing emoji next to text:
- Give emoji at least `fontSize` pixels of horizontal space
- Push adjacent text right by `emoji_fontSize + 12px` gap
