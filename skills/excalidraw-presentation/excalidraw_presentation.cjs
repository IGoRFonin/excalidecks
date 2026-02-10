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

  _isCyrillic(char) {
    const cp = char.codePointAt(0);
    return (cp >= 0x0400 && cp <= 0x04FF);
  }

  _textWidth(text, fontSize, fontFamily = 6) {
    const lines = text.split("\n");
    // Font width multipliers (measured from browser canvas.measureText):
    // fontFamily 5 (Excalifont): hand-drawn, widest -> 0.85
    // fontFamily 6 (Nunito): normal sans-serif -> 0.62 (latin), 0.72 (cyrillic)
    // fontFamily 7 (Lilita One): bold display -> 0.65 (latin), 0.75 (cyrillic)
    // fontFamily 8 (Comic Shanns): code/mono -> 0.68
    // Emoji: exactly 1.0x fontSize (confirmed via browser measurement)
    // Cyrillic letters are ~15-18% wider on average (fewer narrow chars like i/l/t)
    const mult =
      fontFamily === 5
        ? 0.85
        : fontFamily === 8
        ? 0.68
        : fontFamily === 7
        ? 0.65
        : 0.62;
    const cyrMult =
      fontFamily === 6
        ? 0.72
        : fontFamily === 7
        ? 0.75
        : mult;

    const lineWidths = lines.map((l) => {
      let w = 0;
      for (const ch of l) {
        if (this._isEmoji(ch)) continue;
        w += fontSize * (this._isCyrillic(ch) ? cyrMult : mult);
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

  _wrapText(text, maxWidth, fontSize, fontFamily = 6) {
    const inputLines = text.split("\n");
    const result = [];
    for (const line of inputLines) {
      const words = line.split(" ");
      if (words.length === 0) {
        result.push("");
        continue;
      }
      let current = words[0];
      for (let i = 1; i < words.length; i++) {
        const test = current + " " + words[i];
        if (this._textWidth(test, fontSize, fontFamily) <= maxWidth) {
          current = test;
        } else {
          result.push(current);
          current = words[i];
        }
      }
      result.push(current);
    }
    return result.join("\n");
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
    let bannerH = 90;
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

    // Title (Excalifont hand-drawn font, wrapped)
    const bannerTitleMaxW = bannerW - 95 - 20;
    title = this._wrapText(title, bannerTitleMaxW, 36, 5);
    const titleH = this._textHeight(title, 36);
    this.text(`${id}-title`, x + 95, y + 15, title, 36, 5, "#ffffff");

    // Subtitle (dynamic Y based on title height)
    const subtitleY = y + titleH + 10;
    if (subtitle) {
      this.text(
        `${id}-subtitle`,
        x + 95,
        subtitleY,
        subtitle,
        20,
        6,
        c.light || "#f3d9fa"
      );
    }

    // Update banner height if title/subtitle overflow
    const subtitleH = subtitle ? this._textHeight(subtitle, 20) : 0;
    bannerH = Math.max(90, titleH + 10 + (subtitle ? subtitleH + 10 : 15));
    const bannerBg = this.elements.find((el) => el.id === `${id}-bg`);
    if (bannerBg) bannerBg.height = bannerH;

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
    const sectionMaxW = this.CONTENT_WIDTH - 80;
    title = this._wrapText(title, sectionMaxW, 35, 7);
    this.text(
      `${id}-text`,
      this.CONTENT_X + 40,
      y + 14,
      title,
      35,
      7,
      "#ffffff"
    );
    const sectionH = Math.max(70, this._textHeight(title, 35) + 28);
    // Update bg rect height if it grew
    const sectionBg = this.elements.find((el) => el.id === `${id}-bg`);
    if (sectionBg) sectionBg.height = sectionH;
    return y + sectionH + 20;
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

    // Title (wrapped)
    const availableW = w - 40;
    const wrappedTitle = this._wrapText(title, availableW, 21, 6);
    const titleEl = this.text(`${id}-title`, x + 20, y + 50, wrappedTitle, 21, 6, "#1e1e1e");

    // Body text (wrapped)
    const bodyY = y + 50 + titleEl.height + 10;
    const wrappedBody = this._wrapText(body, availableW, 16, 6);
    const bodyEl = this.text(
      `${id}-body-text`,
      x + 20,
      bodyY,
      wrappedBody,
      16,
      6,
      "#495057"
    );

    // Auto-grow card height if body text overflows
    const minH = (bodyY - y) + bodyEl.height + 20;
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
    const available = this.CONTENT_WIDTH - 2 * padding;
    const maxPerRow = 2;
    const cols = Math.min(cards.length, maxPerRow);
    const cardW = (available - (cols - 1) * gap) / cols;
    const startX = this.CONTENT_X + padding;

    let bottomY = y;
    for (let i = 0; i < cards.length; i++) {
      const row = Math.floor(i / maxPerRow);
      const col = i % maxPerRow;
      const card = cards[i];
      const x = startX + col * (cardW + gap);
      const rowY = row === 0 ? y : bottomY;
      const cardBottom = this.contentCard(
        `${id}-card-${i}`,
        x,
        rowY,
        cardW,
        height,
        card.title || "",
        card.body || "",
        card.color || "orange",
        card.tag || null,
        true
      );
      if (col === maxPerRow - 1 || i === cards.length - 1) {
        // End of row — find max bottom across this row's cards
        const rowStart = row * maxPerRow;
        let rowBottom = rowY;
        for (let j = rowStart; j <= i; j++) {
          const el = this.elements.find((e) => e.id === `${id}-card-${j}-body`);
          if (el) rowBottom = Math.max(rowBottom, el.y + el.height + 20);
        }
        bottomY = rowBottom;
      }
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
    const negAvailW = this.CARD_LEFT_W - 40;
    const posAvailW = this.CARD_RIGHT_W - 40;

    // Wrap items and compute dynamic heights per column
    let negY = y + 50;
    const negWrapped = [];
    for (let i = 0; i < negativeItems.length; i++) {
      const wrapped = this._wrapText(`\u274C ${negativeItems[i]}`, negAvailW, 16, 6);
      negWrapped.push({ text: wrapped, y: negY });
      negY += this._textHeight(wrapped, 16) + 10;
    }
    const negTotalH = negY - y + 10;

    let posY = y + 50;
    const posWrapped = [];
    for (let i = 0; i < positiveItems.length; i++) {
      const wrapped = this._wrapText(`\u2705 ${positiveItems[i]}`, posAvailW, 16, 6);
      posWrapped.push({ text: wrapped, y: posY });
      posY += this._textHeight(wrapped, 16) + 10;
    }
    const posTotalH = posY - y + 10;

    if (height === null) {
      height = Math.max(negTotalH, posTotalH);
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
    for (let i = 0; i < negWrapped.length; i++) {
      this.text(
        `${id}-neg-item-${i}`,
        this.CARD_LEFT_X + 20,
        negWrapped[i].y,
        negWrapped[i].text,
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
    for (let i = 0; i < posWrapped.length; i++) {
      this.text(
        `${id}-pos-item-${i}`,
        this.CARD_RIGHT_X + 20,
        posWrapped[i].y,
        posWrapped[i].text,
        16,
        6,
        "#495057"
      );
    }

    return y + height + 20;
  }

  tipBox(id, y, text, emoji = "\uD83D\uDCA1", color = "yellow") {
    const c = COLORS[color];
    const tipTextMaxW = this.CONTENT_WIDTH - 55 - 15;
    text = this._wrapText(text, tipTextMaxW, 17, 6);
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
