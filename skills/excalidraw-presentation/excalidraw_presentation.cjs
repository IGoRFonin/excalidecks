/**
 * Excalidraw Canvas Presentation Generator
 *
 * Generates vertical-scroll canvas presentations in .excalidraw format
 * matching the style of Igor's vibecoding presentation.
 */

const fs = require("fs");

// ─── Color Palette ──────────────────────────────────────────────
const COLORS = {
  blue: {
    bg: "#e7f5ff",
    stroke: "#1971c2",
    fill: "#228be6",
    accent: "#339af0",
    light: "#d0ebff",
  },
  green: {
    bg: "#ebfbee",
    stroke: "#2f9e44",
    fill: "#40c057",
    accent: "#51cf66",
    light: "#d3f9d8",
  },
  orange: {
    bg: "#fff4e6",
    stroke: "#e67700",
    fill: "#ffd43b",
    accent: "#ff922b",
    light: "#fff9db",
  },
  yellow: {
    bg: "#fff9db",
    stroke: "#f59f00",
    fill: "#ffd43b",
    accent: "#fcc419",
    light: "#fff3bf",
  },
  red: {
    bg: "#fff5f5",
    stroke: "#c92a2a",
    fill: "#fa5252",
    accent: "#ff6b6b",
    light: "#ffe3e3",
  },
  purple: {
    bg: "#f8f0fc",
    stroke: "#9c36b5",
    fill: "#be4bdb",
    accent: "#9c36b5",
    light: "#f3d9fa",
  },
  violet: {
    bg: "#f3f0ff",
    stroke: "#5f3dc4",
    fill: "#7950f2",
    accent: "#6741d9",
    light: "#e5dbff",
  },
  cyan: {
    bg: "#e3fafc",
    stroke: "#0b7285",
    fill: "#15aabf",
    accent: "#22b8cf",
    light: "#c5f6fa",
  },
  neutral: {
    bg: "#f8f9fa",
    stroke: "#ced4da",
    fill: "#495057",
    accent: "#868e96",
    light: "#e9ecef",
  },
};

// ─── Base element factory ───────────────────────────────────────
class ExcalidrawPresentation {
  static SLIDE_WIDTH = 977;
  static SLIDE_X = 15;
  static CONTENT_X = 42;
  static CONTENT_WIDTH = 900;
  static CARD_LEFT_X = 42;
  static CARD_LEFT_W = 430;
  static CARD_RIGHT_X = 492;
  static CARD_RIGHT_W = 450;
  static GAP_BETWEEN_SLIDES = 120;

  // Instance accessors for convenience (so `this.SLIDE_X` works)
  get SLIDE_WIDTH() {
    return ExcalidrawPresentation.SLIDE_WIDTH;
  }
  get SLIDE_X() {
    return ExcalidrawPresentation.SLIDE_X;
  }
  get CONTENT_X() {
    return ExcalidrawPresentation.CONTENT_X;
  }
  get CONTENT_WIDTH() {
    return ExcalidrawPresentation.CONTENT_WIDTH;
  }
  get CARD_LEFT_X() {
    return ExcalidrawPresentation.CARD_LEFT_X;
  }
  get CARD_LEFT_W() {
    return ExcalidrawPresentation.CARD_LEFT_W;
  }
  get CARD_RIGHT_X() {
    return ExcalidrawPresentation.CARD_RIGHT_X;
  }
  get CARD_RIGHT_W() {
    return ExcalidrawPresentation.CARD_RIGHT_W;
  }
  get GAP_BETWEEN_SLIDES() {
    return ExcalidrawPresentation.GAP_BETWEEN_SLIDES;
  }

  constructor() {
    this.elements = [];
    this._seed = Math.floor(Math.random() * 900000) + 100000;
    this._currentY = 0;
    this.slides = [];
  }

  _nextSeed() {
    this._seed += 1;
    return this._seed;
  }

  _isEmoji(char) {
    const cp = char.codePointAt(0);
    // Common emoji ranges: Misc Symbols, Dingbats, Emoticons, Transport, Supplemental, etc.
    return (
      (cp >= 0x1f300 && cp <= 0x1faff) ||
      (cp >= 0x2600 && cp <= 0x27bf) ||
      (cp >= 0xfe00 && cp <= 0xfe0f) ||
      (cp >= 0x2300 && cp <= 0x23ff)
    );
  }

  _textWidth(text, fontSize, fontFamily = 6) {
    const lines = text.split("\n");
    // Font width multipliers (measured from browser canvas.measureText):
    // fontFamily 5 (Excalifont): hand-drawn, widest -> 0.85
    // fontFamily 6 (Nunito): normal sans-serif -> 0.62
    // fontFamily 7 (Lilita One): bold display -> 0.65
    // fontFamily 8 (Comic Shanns): code/mono -> 0.68
    // Emoji: exactly 1.0x fontSize (confirmed via browser measurement)
    const mult =
      fontFamily === 5
        ? 0.85
        : fontFamily === 8
        ? 0.68
        : fontFamily === 7
        ? 0.65
        : 0.62;

    const lineWidths = lines.map((l) => {
      let w = 0;
      for (const ch of l) {
        w += this._isEmoji(ch) ? 0 : fontSize * mult;
      }
      return w;
    });

    return Math.max(...lineWidths);
  }

  _textHeight(text, fontSize) {
    const lines = text.split("\n");
    // All lines use lineHeight 1.25 (Excalidraw applies lineHeight uniformly)
    return lines.length * fontSize * 1.25;
  }

  // ── Centering helpers ───────────────────────────────────────

  centerTextInRect(text, fontSize, rectX, rectY, rectW, rectH, family = 6) {
    const tw = this._textWidth(text, fontSize, family);
    const th = this._textHeight(text, fontSize);
    return [rectX + (rectW - tw) / 2, rectY + (rectH - th) / 2];
  }

  centerTextInCircle(text, fontSize, circleX, circleY, diameter, family = 6) {
    const tw = this._textWidth(text, fontSize, family);
    const th = this._textHeight(text, fontSize);
    return [circleX + (diameter - tw) / 2, circleY + (diameter - th) / 2];
  }

  // ── Primitives ──────────────────────────────────────────────

  rect(
    id,
    x,
    y,
    w,
    h,
    fill = "#f8f9fa",
    stroke = "#ced4da",
    strokeWidth = 2,
    roundness = 3,
    opacity = 100
  ) {
    const el = {
      id,
      type: "rectangle",
      x,
      y,
      width: w,
      height: h,
      angle: 0,
      strokeColor: stroke,
      backgroundColor: fill,
      fillStyle: "solid",
      strokeWidth,
      strokeStyle: "solid",
      roughness: 1,
      opacity,
      groupIds: [],
      frameId: null,
      roundness: roundness ? { type: roundness } : null,
      isDeleted: false,
      boundElements: [],
      locked: false,
      seed: this._nextSeed(),
      version: 1,
      versionNonce: 1,
    };
    this.elements.push(el);
    return el;
  }

  text(
    id,
    x,
    y,
    text,
    size = 16,
    family = 6,
    color = "#1e1e1e",
    align = "left"
  ) {
    const w = this._textWidth(text, size, family);
    const h = this._textHeight(text, size);
    const el = {
      id,
      type: "text",
      x,
      y,
      width: w,
      height: h,
      text,
      fontSize: size,
      fontFamily: family,
      textAlign: align,
      verticalAlign: "top",
      strokeColor: color,
      backgroundColor: "transparent",
      fillStyle: "solid",
      roughness: 1,
      isDeleted: false,
      strokeWidth: 2,
      strokeStyle: "solid",
      opacity: 100,
      angle: 0,
      groupIds: [],
      frameId: null,
      roundness: null,
      boundElements: [],
      locked: false,
      containerId: null,
      originalText: text,
      autoResize: true,
      lineHeight: 1.25,
      seed: this._nextSeed(),
      version: 1,
      versionNonce: 1,
    };
    this.elements.push(el);
    return el;
  }

  circle(id, x, y, size, fill, stroke) {
    const el = {
      id,
      type: "ellipse",
      x,
      y,
      width: size,
      height: size,
      backgroundColor: fill,
      strokeColor: stroke,
      strokeWidth: 2,
      fillStyle: "solid",
      roughness: 1,
      isDeleted: false,
      strokeStyle: "solid",
      opacity: 100,
      angle: 0,
      groupIds: [],
      frameId: null,
      roundness: null,
      boundElements: [],
      locked: false,
      seed: this._nextSeed(),
      version: 1,
      versionNonce: 1,
    };
    this.elements.push(el);
    return el;
  }

  line(id, x, y, length, color = "#ced4da", width = 2) {
    const el = {
      id,
      type: "line",
      x,
      y,
      width: length,
      height: 0,
      strokeColor: color,
      strokeWidth: width,
      fillStyle: "solid",
      roughness: 1,
      isDeleted: false,
      strokeStyle: "solid",
      opacity: 100,
      angle: 0,
      groupIds: [],
      frameId: null,
      roundness: { type: 2 },
      boundElements: [],
      locked: false,
      points: [
        [0, 0],
        [length, 0],
      ],
      startBinding: null,
      endBinding: null,
      startArrowhead: null,
      endArrowhead: null,
      seed: this._nextSeed(),
      version: 1,
      versionNonce: 1,
      backgroundColor: "transparent",
    };
    this.elements.push(el);
    return el;
  }

  diamond(id, x, y, size = 12, fill = "#ffd43b", stroke = "#f59f00") {
    const el = {
      id,
      type: "diamond",
      x,
      y,
      width: size,
      height: size,
      backgroundColor: fill,
      strokeColor: stroke,
      strokeWidth: 2,
      fillStyle: "solid",
      roughness: 1,
      isDeleted: false,
      strokeStyle: "solid",
      opacity: 100,
      angle: 0,
      groupIds: [],
      frameId: null,
      roundness: null,
      boundElements: [],
      locked: false,
      seed: this._nextSeed(),
      version: 1,
      versionNonce: 1,
    };
    this.elements.push(el);
    return el;
  }

  // ── Shadow ──────────────────────────────────────────────────

  shadow(id, x, y, w, h) {
    return this.rect(
      `${id}-shadow`,
      x + 6,
      y + 6,
      w,
      h,
      "#adb5bd",
      "transparent",
      2,
      3,
      40
    );
  }

  // ── Compound Components ─────────────────────────────────────

  slideBackground(id, y, height) {
    this.slides.push({ y, h: height });
    return this.rect(
      id,
      this.SLIDE_X,
      y,
      this.SLIDE_WIDTH,
      height,
      "#f8f9fa",
      "#ced4da"
    );
  }

  titleBanner(
    id,
    y,
    title,
    subtitle = null,
    color = "purple",
    iconText = null,
    badges = null
  ) {
    const c = COLORS[color];
    const bannerH = 90;
    const x = this.CONTENT_X;

    // Banner background
    const bannerW = 750;
    this.rect(`${id}-bg`, x, y, bannerW, bannerH, c.fill, c.stroke);

    // Icon circle with centered text
    const circleSize = 60;
    const circleX = x + 20;
    const circleY = y + 15;
    this.circle(`${id}-icon`, circleX, circleY, circleSize, c.accent, c.stroke);
    if (iconText) {
      const iconFont = 26;
      const [ix, iy] = this.centerTextInCircle(
        iconText,
        iconFont,
        circleX,
        circleY,
        circleSize
      );
      this.text(
        `${id}-icon-text`,
        ix,
        iy,
        iconText,
        iconFont,
        6,
        "#ffffff",
        "center"
      );
    }

    // Title (Excalifont hand-drawn font)
    this.text(`${id}-title`, x + 95, y + 15, title, 36, 5, "#ffffff");

    // Subtitle
    if (subtitle) {
      this.text(
        `${id}-subtitle`,
        x + 95,
        y + 55,
        subtitle,
        20,
        6,
        c.light || "#f3d9fa"
      );
    }

    // Badges on the right
    if (badges) {
      const badgeX = 810;
      const badgeW = 130;
      for (let i = 0; i < badges.length; i++) {
        const [label, badgeColor] = badges[i];
        const bc = COLORS[badgeColor];
        const by = y + 10 + i * 40;
        this.rect(
          `${id}-badge-${i}`,
          badgeX,
          by,
          badgeW,
          35,
          bc.fill,
          bc.stroke
        );
        const [lx, ly] = this.centerTextInRect(
          label,
          16,
          badgeX,
          by,
          badgeW,
          35
        );
        this.text(`${id}-badge-text-${i}`, lx, ly, label, 16, 6, "#ffffff");
      }
    }

    return y + bannerH + 20;
  }

  sectionHeader(id, y, title, color = "blue") {
    const c = COLORS[color];
    this.rect(
      `${id}-bg`,
      this.CONTENT_X,
      y,
      this.CONTENT_WIDTH,
      70,
      c.accent,
      c.stroke
    );
    this.text(
      `${id}-text`,
      this.CONTENT_X + 40,
      y + 14,
      title,
      35,
      7,
      "#ffffff"
    );
    return y + 70 + 20;
  }

  blockNumber(id, y, number, label, duration = null, color = "blue") {
    const c = COLORS[color];
    const x = this.CONTENT_X + 47;

    const circleSize = 50;
    this.circle(`${id}-circle`, x, y, circleSize, c.fill, c.stroke);
    const numStr = String(number);
    const numFont = 23;
    const [nx, ny] = this.centerTextInCircle(numStr, numFont, x, y, circleSize);
    this.text(`${id}-num`, nx, ny, numStr, numFont, 6, "#ffffff");
    this.text(`${id}-label`, x + 60, y + 10, label, 16, 6, "#495057");
    if (duration) {
      this.text(`${id}-dur`, 836, y + 15, duration, 12, 6, "#868e96");
    }

    return y + 60;
  }

  contentCard(
    id,
    x,
    y,
    w,
    h,
    title,
    body,
    color = "orange",
    tag = null,
    withShadow = false
  ) {
    const c = COLORS[color];

    if (withShadow) {
      this.shadow(id, x, y, w, h);
    }

    // Card body
    this.rect(`${id}-body`, x, y, w, h, c.bg, c.stroke);

    // Header strip
    this.rect(`${id}-header`, x, y, w, 36, c.fill, c.stroke);

    // Tag badge (centered text)
    if (tag) {
      console.log("tag", tag);
      const tagFont = 14;
      const tagTextW = this._textWidth(tag, tagFont);
      const tagW = Math.max(tagTextW + 24, 80);
      const tagX = x + w - tagW - 15;
      this.rect(`${id}-tag-bg`, tagX, y + 5, tagW, 27, c.accent, c.stroke);
      const [textX, textY] = this.centerTextInRect(
        tag,
        tagFont,
        tagX,
        y + 5,
        tagW,
        27
      );
      this.text(
        `${id}-tag-text`,
        textX,
        textY,
        tag,
        tagFont,
        6,
        "#ffffff"
      );
    }

    // Title
    this.text(`${id}-title`, x + 20, y + 50, title, 21, 6, "#1e1e1e");

    // Body text
    const bodyEl = this.text(
      `${id}-body-text`,
      x + 20,
      y + 82,
      body,
      16,
      6,
      "#495057"
    );

    // Auto-grow card height if body text overflows
    const minH = 82 + bodyEl.height + 20;
    if (h < minH) {
      const cardBody = this.elements.find((el) => el.id === `${id}-body`);
      if (cardBody) cardBody.height = minH;
      // Also grow shadow if present
      const shadowEl = this.elements.find((el) => el.id === `${id}-shadow`);
      if (shadowEl) shadowEl.height = minH;
      h = minH;
    }

    return y + h + 20;
  }

  nCards(id, y, cards, height = 200, gap = 20, padding = 0) {
    const n = cards.length;
    const available = this.CONTENT_WIDTH - 2 * padding;
    const cardW = (available - (n - 1) * gap) / n;
    const startX = this.CONTENT_X + padding;

    let bottomY = y;
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const x = startX + i * (cardW + gap);
      const cardBottom = this.contentCard(
        `${id}-card-${i}`,
        x,
        y,
        cardW,
        height,
        card.title || "",
        card.body || "",
        card.color || "orange",
        card.tag || null,
        true
      );
      bottomY = Math.max(bottomY, cardBottom);
    }
    return bottomY;
  }

  twoCards(
    id,
    y,
    leftTitle,
    leftBody,
    rightTitle,
    rightBody,
    leftColor = "orange",
    rightColor = "purple",
    leftTag = null,
    rightTag = null,
    height = 200
  ) {
    return this.nCards(
      id,
      y,
      [
        { title: leftTitle, body: leftBody, color: leftColor, tag: leftTag },
        {
          title: rightTitle,
          body: rightBody,
          color: rightColor,
          tag: rightTag,
        },
      ],
      height
    );
  }

  comparison(
    id,
    y,
    negativeTitle,
    negativeItems,
    positiveTitle,
    positiveItems,
    height = null
  ) {
    const itemsCount = Math.max(negativeItems.length, positiveItems.length);
    if (height === null) {
      height = 50 + itemsCount * 35 + 20;
    }

    // Negative side
    this.shadow(`${id}-neg`, this.CARD_LEFT_X, y, this.CARD_LEFT_W, height);
    this.rect(
      `${id}-neg-body`,
      this.CARD_LEFT_X,
      y,
      this.CARD_LEFT_W,
      height,
      "#fff5f5",
      "#fa5252"
    );
    this.rect(
      `${id}-neg-header`,
      this.CARD_LEFT_X,
      y,
      this.CARD_LEFT_W,
      36,
      "#fa5252",
      "#e03131"
    );
    this.text(
      `${id}-neg-title`,
      this.CARD_LEFT_X + 15,
      y + 8,
      negativeTitle,
      15,
      6,
      "#ffffff"
    );
    for (let i = 0; i < negativeItems.length; i++) {
      this.text(
        `${id}-neg-item-${i}`,
        this.CARD_LEFT_X + 20,
        y + 50 + i * 35,
        `\u274C ${negativeItems[i]}`,
        16,
        6,
        "#495057"
      );
    }

    // Positive side
    this.shadow(`${id}-pos`, this.CARD_RIGHT_X, y, this.CARD_RIGHT_W, height);
    this.rect(
      `${id}-pos-body`,
      this.CARD_RIGHT_X,
      y,
      this.CARD_RIGHT_W,
      height,
      "#ebfbee",
      "#40c057"
    );
    this.rect(
      `${id}-pos-header`,
      this.CARD_RIGHT_X,
      y,
      this.CARD_RIGHT_W,
      36,
      "#40c057",
      "#2f9e44"
    );
    this.text(
      `${id}-pos-title`,
      this.CARD_RIGHT_X + 15,
      y + 8,
      positiveTitle,
      15,
      6,
      "#ffffff"
    );
    for (let i = 0; i < positiveItems.length; i++) {
      this.text(
        `${id}-pos-item-${i}`,
        this.CARD_RIGHT_X + 20,
        y + 50 + i * 35,
        `\u2705 ${positiveItems[i]}`,
        16,
        6,
        "#495057"
      );
    }

    return y + height + 20;
  }

  tipBox(id, y, text, emoji = "\uD83D\uDCA1", color = "yellow") {
    const c = COLORS[color];
    const textH = this._textHeight(text, 17);
    const boxH = Math.max(textH + 30, 60);

    this.rect(
      `${id}-bg`,
      this.CONTENT_X,
      y,
      this.CONTENT_WIDTH,
      boxH,
      c.bg,
      c.stroke
    );
    const emojiSize = 28;
    this.text(
      `${id}-emoji`,
      this.CONTENT_X + 15,
      y + 12,
      emoji,
      emojiSize,
      6,
      "#1e1e1e"
    );
    this.text(
      `${id}-text`,
      this.CONTENT_X + 15 + emojiSize + 12,
      y + 15,
      text,
      17,
      6,
      "#495057"
    );

    return y + boxH + 20;
  }

  bulletList(
    id,
    x,
    y,
    items,
    color = "#495057",
    fontSize = 16,
    bulletColor = "blue"
  ) {
    const c = COLORS[bulletColor];
    let currentY = y;
    for (let i = 0; i < items.length; i++) {
      this.circle(`${id}-bullet-${i}`, x, currentY + 4, 10, c.fill, c.stroke);
      this.text(
        `${id}-item-${i}`,
        x + 20,
        currentY,
        items[i],
        fontSize,
        6,
        color
      );
      currentY += this._textHeight(items[i], fontSize) + 8;
    }
    return currentY + 10;
  }

  progressDots(id, x, y, total, active = 0, color = "yellow") {
    const c = COLORS[color];
    for (let i = 0; i < total; i++) {
      const fill = i < active ? c.fill : c.bg;
      this.diamond(`${id}-dot-${i}`, x + i * 18, y, 12, fill, c.stroke);
    }
    return y + 20;
  }

  separatorLine(id, y, color = "#ced4da") {
    this.line(id, this.CONTENT_X + 50, y, this.CONTENT_WIDTH - 100, color);
    return y + 20;
  }

  // ── Export ──────────────────────────────────────────────────

  toJSON() {
    return {
      type: "excalidraw",
      version: 2,
      source: "https://excalidraw.com",
      elements: this.elements,
      appState: {
        viewBackgroundColor: "#f8f9fa",
        gridSize: 20,
        gridStep: 5,
        gridModeEnabled: false,
      },
      files: {},
    };
  }

  save(path) {
    fs.writeFileSync(path, JSON.stringify(this.toJSON(), null, 2), "utf-8");
    console.log(`Saved to ${path}`);
    console.log(
      `   ${this.elements.length} elements, ${this.slides.length} slides`
    );
  }

  async push(url = "http://localhost:41520", clear = true) {
    const base = url.replace(/\/+$/, "");

    // Clear existing elements
    if (clear) {
      try {
        await fetch(`${base}/api/elements`, { method: "DELETE" });
      } catch (e) {
        console.log(`ERROR: Cannot connect to server at ${base}`);
        console.log(`   Start it with: node dist/index.js --canvas-only`);
        process.exit(1);
      }
    }

    // Batch create all elements
    try {
      const resp = await fetch(`${base}/api/elements/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ elements: this.elements }),
      });
      if (!resp.ok) {
        const body = await resp.text();
        console.log(`ERROR: Server returned ${resp.status}: ${body}`);
        process.exit(1);
      }
      const result = await resp.json();
      console.log(
        `Pushed ${result.count || this.elements.length} elements to ${base}`
      );
      console.log(`   Open: ${base}`);
    } catch (e) {
      console.log(`ERROR: Failed to push elements: ${e.message}`);
      process.exit(1);
    }
  }
}

module.exports = { ExcalidrawPresentation, COLORS };

// ── Demo ──────────────────────────────────────────────────────
if (require.main === module) {
  (async () => {
    const p = new ExcalidrawPresentation();
    let y = 0;

    // ═══════════════════════════════════════════════════════════
    // SLIDE 1: Title
    // ═══════════════════════════════════════════════════════════
    let slide1H = 800;
    p.slideBackground("s1-bg", y, slide1H);

    let yPos = y + 30;
    yPos = p.titleBanner(
      "s1-header",
      yPos,
      "DEMO \u041F\u0420\u0415\u0417\u0415\u041D\u0422\u0410\u0426\u0418\u042F",
      "\u041F\u0440\u0438\u043C\u0435\u0440 canvas-\u043F\u0440\u0435\u0437\u0435\u043D\u0442\u0430\u0446\u0438\u0438",
      "purple",
      "\uD83C\uDFAF",
      [
        ["\u0414\u0415\u041C\u041E", "blue"],
        ["5 \u043C\u0438\u043D", "green"],
      ]
    );

    yPos = p.sectionHeader(
      "s1-section",
      yPos,
      "\u0427\u0422\u041E \u0422\u042B \u0423\u0412\u0418\u0414\u0418\u0428\u042C \u0412 \u042D\u0422\u041E\u0419 \u0414\u0415\u041C\u041E",
      "blue"
    );

    yPos = p.twoCards(
      "s1-cards",
      yPos,
      "\uD83D\uDCE6 \u041A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u044B",
      "\u0413\u043E\u0442\u043E\u0432\u044B\u0435 \u0432\u0438\u0437\u0443\u0430\u043B\u044C\u043D\u044B\u0435 \u0431\u043B\u043E\u043A\u0438:\n\u2022 \u0417\u0430\u0433\u043E\u043B\u043E\u0432\u043A\u0438 \u0438 \u0431\u0430\u043D\u043D\u0435\u0440\u044B\n\u2022 \u041A\u0430\u0440\u0442\u043E\u0447\u043A\u0438 \u043A\u043E\u043D\u0442\u0435\u043D\u0442\u0430\n\u2022 \u0421\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u044F\n\u2022 \u041F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0438",
      "\uD83C\uDFA8 \u0421\u0442\u0438\u043B\u0438\u0437\u0430\u0446\u0438\u044F",
      "\u041F\u0440\u043E\u0444\u0435\u0441\u0441\u0438\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0439 \u0434\u0438\u0437\u0430\u0439\u043D:\n\u2022 9 \u0446\u0432\u0435\u0442\u043E\u0432\u044B\u0445 \u0442\u0435\u043C\n\u2022 \u0422\u0435\u043D\u0438 \u0438 \u0433\u043B\u0443\u0431\u0438\u043D\u0430\n\u2022 \u0422\u0438\u043F\u043E\u0433\u0440\u0430\u0444\u0438\u043A\u0430\n\u2022 \u0421\u043A\u0435\u0442\u0447-\u0441\u0442\u0438\u043B\u044C",
      "orange",
      "purple",
      "LEGO",
      "\u0414\u0418\u0417\u0410\u0419\u041D",
      220
    );

    yPos = p.tipBox(
      "s1-tip",
      yPos,
      "\u042D\u0442\u043E \u0432\u0441\u0451 \u0433\u0435\u043D\u0435\u0440\u0438\u0440\u0443\u0435\u0442\u0441\u044F Node.js-\u0441\u043A\u0440\u0438\u043F\u0442\u043E\u043C \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438!"
    );

    slide1H = yPos - y + 30;

    // ═══════════════════════════════════════════════════════════
    // SLIDE 2: Content
    // ═══════════════════════════════════════════════════════════
    y = yPos + p.GAP_BETWEEN_SLIDES;
    const slide2Start = y;
    p.slideBackground("s2-bg", y, 100);

    yPos = y + 30;
    yPos = p.blockNumber(
      "s2-block",
      yPos,
      1,
      "\u0421\u0420\u0410\u0412\u041D\u0415\u041D\u0418\u0415 \u041F\u041E\u0414\u0425\u041E\u0414\u041E\u0412",
      "3 \u043C\u0438\u043D",
      "blue"
    );

    yPos += 20;
    yPos = p.sectionHeader(
      "s2-section",
      yPos,
      "\uD83D\uDD27 \u0420\u0423\u0427\u041D\u041E\u0419 \u041A\u041E\u0414 vs \u0412\u0410\u0419\u0411\u041A\u041E\u0414\u0418\u041D\u0413",
      "green"
    );

    yPos = p.comparison(
      "s2-compare",
      yPos,
      "\u0420\u0423\u0427\u041D\u041E\u0419 \u041A\u041E\u0414",
      [
        "\u0427\u0430\u0441\u044B \u043D\u0430 \u0431\u043E\u0439\u043B\u0435\u0440\u043F\u043B\u0435\u0439\u0442",
        "\u0417\u0430\u0431\u044B\u0442\u044B\u0435 edge cases",
        "\u0423\u0441\u0442\u0430\u0440\u0435\u0432\u0448\u0438\u0435 \u043F\u0430\u0442\u0442\u0435\u0440\u043D\u044B",
      ],
      "\u0412\u0410\u0419\u0411\u041A\u041E\u0414\u0418\u041D\u0413",
      [
        "\u0424\u043E\u043A\u0443\u0441 \u043D\u0430 \u043B\u043E\u0433\u0438\u043A\u0435",
        "AI \u043F\u043E\u043A\u0440\u044B\u0432\u0430\u0435\u0442 edge cases",
        "\u0410\u043A\u0442\u0443\u0430\u043B\u044C\u043D\u044B\u0435 best practices",
      ]
    );

    yPos = p.tipBox(
      "s2-tip",
      yPos,
      "\u0412\u0430\u0439\u0431\u043A\u043E\u0434\u0438\u043D\u0433 \u2014 \u044D\u0442\u043E \u043D\u0435 \u0437\u0430\u043C\u0435\u043D\u0430 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0438\u0441\u0442\u0430.\n\u042D\u0442\u043E \u0443\u0441\u0438\u043B\u0438\u0442\u0435\u043B\u044C \u0432\u043E\u0437\u043C\u043E\u0436\u043D\u043E\u0441\u0442\u0435\u0439.",
      "\uD83E\uDDE0"
    );

    yPos = p.separatorLine("s2-sep", yPos, "#be4bdb");

    yPos += 10;
    yPos = p.bulletList(
      "s2-list",
      p.CONTENT_X + 60,
      yPos,
      [
        "\u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 AI \u043A\u0430\u043A \u0430\u0441\u0441\u0438\u0441\u0442\u0435\u043D\u0442\u0430, \u0430 \u043D\u0435 \u0437\u0430\u043C\u0435\u043D\u0443",
        "\u041F\u043E\u043D\u0438\u043C\u0430\u0439 \u0447\u0442\u043E \u0433\u0435\u043D\u0435\u0440\u0438\u0440\u0443\u0435\u0442\u0441\u044F \u2014 \u043D\u0435 \u043A\u043E\u043F\u0438\u0440\u0443\u0439 \u0441\u043B\u0435\u043F\u043E",
        "\u0421\u0442\u0440\u043E\u0439 \u0441\u0432\u043E\u044E \u0431\u0438\u0431\u043B\u0438\u043E\u0442\u0435\u043A\u0443 \u043F\u0440\u043E\u043C\u043F\u0442\u043E\u0432 \u0438 \u0441\u043A\u0438\u043B\u043E\u0432",
      ],
      "#495057",
      16,
      "purple"
    );

    p.progressDots("s2-dots", p.CONTENT_X + 350, yPos, 5, 2);
    yPos += 30;

    const slide2H = yPos - slide2Start + 30;

    // ═══════════════════════════════════════════════════════════
    // SLIDE 3: Closing
    // ═══════════════════════════════════════════════════════════
    y = yPos + p.GAP_BETWEEN_SLIDES;
    const slide3Start = y;
    let slide3H = 400;
    p.slideBackground("s3-bg", y, slide3H);

    yPos = y + 30;
    yPos = p.titleBanner(
      "s3-header",
      yPos,
      "\u0421\u041F\u0410\u0421\u0418\u0411\u041E!",
      "\u041F\u043E\u0434\u043F\u0438\u0441\u044B\u0432\u0430\u0439\u0441\u044F \u043D\u0430 \u043A\u0430\u043D\u0430\u043B",
      "green",
      "\uD83D\uDD25",
      [["\u041A\u041E\u041D\u0415\u0426", "red"]]
    );

    yPos = p.tipBox(
      "s3-cta",
      yPos,
      "\u0421\u0442\u0430\u0432\u044C \u043B\u0430\u0439\u043A, \u043F\u043E\u0434\u043F\u0438\u0441\u044B\u0432\u0430\u0439\u0441\u044F, \u0436\u043C\u0438 \u043A\u043E\u043B\u043E\u043A\u043E\u043B\u044C\u0447\u0438\u043A! \uD83D\uDD14",
      "\uD83D\uDE80",
      "cyan"
    );

    slide3H = yPos - slide3Start + 30;

    // ── Fix slide background heights ────────────────────────────
    for (const el of p.elements) {
      if (el.id === "s1-bg") el.height = slide1H;
      else if (el.id === "s2-bg") el.height = slide2H;
      else if (el.id === "s3-bg") el.height = slide3H;
    }

    // ── Push to live server ─────────────────────────────────────
    await p.push();
  })();
}
