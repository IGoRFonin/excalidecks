"""
Excalidraw Canvas Presentation Generator

Generates vertical-scroll canvas presentations in .excalidraw format
matching the style of Igor's vibecoding presentation.
"""

import json
import random
import math


# ─── Color Palette ──────────────────────────────────────────────
COLORS = {
    "blue":    {"bg": "#e7f5ff", "stroke": "#1971c2", "fill": "#228be6", "accent": "#339af0", "light": "#d0ebff"},
    "green":   {"bg": "#ebfbee", "stroke": "#2f9e44", "fill": "#40c057", "accent": "#51cf66", "light": "#d3f9d8"},
    "orange":  {"bg": "#fff4e6", "stroke": "#e67700", "fill": "#ffd43b", "accent": "#ff922b", "light": "#fff9db"},
    "yellow":  {"bg": "#fff9db", "stroke": "#f59f00", "fill": "#ffd43b", "accent": "#fcc419", "light": "#fff3bf"},
    "red":     {"bg": "#fff5f5", "stroke": "#c92a2a", "fill": "#fa5252", "accent": "#ff6b6b", "light": "#ffe3e3"},
    "purple":  {"bg": "#f8f0fc", "stroke": "#9c36b5", "fill": "#be4bdb", "accent": "#9c36b5", "light": "#f3d9fa"},
    "violet":  {"bg": "#f3f0ff", "stroke": "#5f3dc4", "fill": "#7950f2", "accent": "#6741d9", "light": "#e5dbff"},
    "cyan":    {"bg": "#e3fafc", "stroke": "#0b7285", "fill": "#15aabf", "accent": "#22b8cf", "light": "#c5f6fa"},
    "neutral": {"bg": "#f8f9fa", "stroke": "#ced4da", "fill": "#495057", "accent": "#868e96", "light": "#e9ecef"},
}

# ─── Base element factory ───────────────────────────────────────
class ExcalidrawPresentation:
    SLIDE_WIDTH = 977
    SLIDE_X = 15
    CONTENT_X = 42
    CONTENT_WIDTH = 900
    CARD_LEFT_X = 42
    CARD_LEFT_W = 430
    CARD_RIGHT_X = 492
    CARD_RIGHT_W = 450
    GAP_BETWEEN_SLIDES = 120

    def __init__(self):
        self.elements = []
        self._seed = random.randint(100000, 999999)
        self._current_y = 0  # auto-tracking Y position
        self.slides = []  # track slide positions

    def _next_seed(self):
        self._seed += 1
        return self._seed

    def _text_width(self, text, font_size, font_family=6):
        lines = text.split('\n')
        max_len = max(len(line) for line in lines)
        # Font width multipliers (measured from Excalidraw rendering of Cyrillic):
        # fontFamily 5 (Excalifont): hand-drawn, widest → 0.85
        # fontFamily 6 (Nunito): normal sans-serif → 0.62
        # fontFamily 7 (Lilita One): bold display → 0.65
        # fontFamily 8 (Comic Shanns): code/mono → 0.68
        if font_family == 5:  # Excalifont (hand-drawn) — widest font
            return max_len * font_size * 0.85
        elif font_family == 8:  # Comic Shanns (code/mono)
            return max_len * font_size * 0.68
        elif font_family == 7:  # Lilita One (display/heading)
            return max_len * font_size * 0.65
        elif font_family == 6:  # Nunito (normal)
            return max_len * font_size * 0.62
        else:  # fallback
            return max_len * font_size * 0.62

    def _text_height(self, text, font_size):
        lines = text.split('\n')
        return len(lines) * font_size * 1.25

    # ── Centering helpers ───────────────────────────────────────

    def center_text_in_rect(self, text, font_size, rect_x, rect_y, rect_w, rect_h, family=6):
        """Calculate (x, y) to center text inside a rectangle."""
        tw = self._text_width(text, font_size, family)
        th = self._text_height(text, font_size)
        return (rect_x + (rect_w - tw) / 2, rect_y + (rect_h - th) / 2)

    def center_text_in_circle(self, text, font_size, circle_x, circle_y, diameter, family=6):
        """Calculate (x, y) to center text inside a circle/ellipse."""
        tw = self._text_width(text, font_size, family)
        th = self._text_height(text, font_size)
        return (circle_x + (diameter - tw) / 2, circle_y + (diameter - th) / 2)

    # ── Primitives ──────────────────────────────────────────────

    def rect(self, id, x, y, w, h, fill="#f8f9fa", stroke="#ced4da",
             stroke_width=2, roundness=3, opacity=100):
        el = {
            "id": id, "type": "rectangle",
            "x": x, "y": y, "width": w, "height": h,
            "angle": 0, "strokeColor": stroke,
            "backgroundColor": fill, "fillStyle": "solid",
            "strokeWidth": stroke_width, "strokeStyle": "solid",
            "roughness": 1, "opacity": opacity,
            "groupIds": [], "frameId": None,
            "roundness": {"type": roundness} if roundness else None,
            "isDeleted": False, "boundElements": [],
            "locked": False, "seed": self._next_seed(),
            "version": 1, "versionNonce": 1
        }
        self.elements.append(el)
        return el

    def text(self, id, x, y, text, size=16, family=6, color="#1e1e1e",
             align="left"):
        w = self._text_width(text, size, family)
        h = self._text_height(text, size)
        el = {
            "id": id, "type": "text",
            "x": x, "y": y, "width": w, "height": h,
            "text": text, "fontSize": size,
            "fontFamily": family, "textAlign": align,
            "verticalAlign": "top",
            "strokeColor": color, "backgroundColor": "transparent",
            "fillStyle": "solid", "roughness": 1,
            "isDeleted": False, "strokeWidth": 2,
            "strokeStyle": "solid", "opacity": 100,
            "angle": 0, "groupIds": [], "frameId": None,
            "roundness": None, "boundElements": [],
            "locked": False, "containerId": None,
            "originalText": text, "autoResize": True,
            "lineHeight": 1.25, "seed": self._next_seed(),
            "version": 1, "versionNonce": 1
        }
        self.elements.append(el)
        return el

    def circle(self, id, x, y, size, fill, stroke):
        el = {
            "id": id, "type": "ellipse",
            "x": x, "y": y, "width": size, "height": size,
            "backgroundColor": fill, "strokeColor": stroke,
            "strokeWidth": 2, "fillStyle": "solid",
            "roughness": 1, "isDeleted": False,
            "strokeStyle": "solid", "opacity": 100,
            "angle": 0, "groupIds": [], "frameId": None,
            "roundness": None, "boundElements": [],
            "locked": False, "seed": self._next_seed(),
            "version": 1, "versionNonce": 1
        }
        self.elements.append(el)
        return el

    def line(self, id, x, y, length, color="#ced4da", width=2):
        el = {
            "id": id, "type": "line",
            "x": x, "y": y, "width": length, "height": 0,
            "strokeColor": color, "strokeWidth": width,
            "fillStyle": "solid", "roughness": 1,
            "isDeleted": False, "strokeStyle": "solid",
            "opacity": 100, "angle": 0,
            "groupIds": [], "frameId": None,
            "roundness": {"type": 2},
            "boundElements": [], "locked": False,
            "points": [[0, 0], [length, 0]],
            "startBinding": None, "endBinding": None,
            "startArrowhead": None, "endArrowhead": None,
            "seed": self._next_seed(),
            "version": 1, "versionNonce": 1,
            "backgroundColor": "transparent"
        }
        self.elements.append(el)
        return el

    def diamond(self, id, x, y, size=12, fill="#ffd43b", stroke="#f59f00"):
        el = {
            "id": id, "type": "diamond",
            "x": x, "y": y, "width": size, "height": size,
            "backgroundColor": fill, "strokeColor": stroke,
            "strokeWidth": 2, "fillStyle": "solid",
            "roughness": 1, "isDeleted": False,
            "strokeStyle": "solid", "opacity": 100,
            "angle": 0, "groupIds": [], "frameId": None,
            "roundness": None, "boundElements": [],
            "locked": False, "seed": self._next_seed(),
            "version": 1, "versionNonce": 1
        }
        self.elements.append(el)
        return el

    # ── Shadow ──────────────────────────────────────────────────

    def shadow(self, id, x, y, w, h):
        """Soft shadow rect behind the main element (+6px offset)"""
        return self.rect(f"{id}-shadow", x + 6, y + 6, w, h,
                         fill="#adb5bd", stroke="transparent", opacity=40)

    # ── Compound Components ─────────────────────────────────────

    def slide_background(self, id, y, height):
        """Full slide background rectangle"""
        self.slides.append({"y": y, "h": height})
        return self.rect(id, self.SLIDE_X, y, self.SLIDE_WIDTH, height,
                         "#f8f9fa", "#ced4da")

    def title_banner(self, id, y, title, subtitle=None, color="purple",
                     icon_text=None, badges=None):
        """
        Colored banner with circle icon + title + optional subtitle and badges.
        Returns bottom Y position.
        """
        c = COLORS[color]
        banner_h = 90
        x = self.CONTENT_X  # Align with all other content blocks

        # Banner background (leave room for badges on the right)
        banner_w = 750
        self.rect(f"{id}-bg", x, y, banner_w, banner_h, c["fill"], c["stroke"])

        # Icon circle with centered text
        circle_size = 60
        circle_x = x + 20
        circle_y = y + 15
        self.circle(f"{id}-icon", circle_x, circle_y, circle_size, c["accent"], c["stroke"])
        if icon_text:
            icon_font = 26
            ix, iy = self.center_text_in_circle(icon_text, icon_font, circle_x, circle_y, circle_size)
            self.text(f"{id}-icon-text", ix, iy, icon_text,
                      size=icon_font, family=6, color="#ffffff", align="center")

        # Title (Excalifont hand-drawn font)
        self.text(f"{id}-title", x + 95, y + 15, title,
                  size=36, family=5, color="#ffffff")

        # Subtitle
        if subtitle:
            self.text(f"{id}-subtitle", x + 95, y + 55, subtitle,
                      size=20, family=6, color=c.get("light", "#f3d9fa"))

        # Badges on the right
        if badges:
            badge_x = 810
            badge_w = 130
            for i, (label, badge_color) in enumerate(badges):
                bc = COLORS[badge_color]
                by = y + 10 + i * 40
                self.rect(f"{id}-badge-{i}", badge_x, by, badge_w, 35,
                          bc["fill"], bc["stroke"])
                # Center label text in badge
                label_w = len(label) * 16 * 0.62
                lx = badge_x + (badge_w - label_w) / 2
                ly = by + (35 - 16 * 1.25) / 2
                self.text(f"{id}-badge-text-{i}", lx, ly,
                          label, size=16, family=6, color="#ffffff")

        return y + banner_h + 20

    def section_header(self, id, y, title, color="blue"):
        """Full-width colored section header bar. Returns bottom Y."""
        c = COLORS[color]
        self.rect(f"{id}-bg", self.CONTENT_X, y, self.CONTENT_WIDTH, 70,
                  c["accent"], c["stroke"])
        self.text(f"{id}-text", self.CONTENT_X + 40, y + 14, title,
                  size=35, family=7, color="#ffffff")
        return y + 70 + 20

    def block_number(self, id, y, number, label, duration=None, color="blue"):
        """Block number indicator with circle + label. Returns bottom Y."""
        c = COLORS[color]
        x = self.CONTENT_X + 47

        circle_size = 50
        self.circle(f"{id}-circle", x, y, circle_size, c["fill"], c["stroke"])
        num_str = str(number)
        num_font = 23
        nx, ny = self.center_text_in_circle(num_str, num_font, x, y, circle_size)
        self.text(f"{id}-num", nx, ny, num_str,
                  size=num_font, family=6, color="#ffffff")
        self.text(f"{id}-label", x + 60, y + 10, label,
                  size=16, family=6, color="#495057")
        if duration:
            self.text(f"{id}-dur", 836, y + 15, duration,
                      size=12, family=6, color="#868e96")

        return y + 60

    def content_card(self, id, x, y, w, h, title, body, color="orange",
                     tag=None, with_shadow=False):
        """
        Content card with optional header strip and tag.
        Returns bottom Y.
        """
        c = COLORS[color]

        if with_shadow:
            self.shadow(id, x, y, w, h)

        # Card body
        self.rect(f"{id}-body", x, y, w, h, c["bg"], c["stroke"])

        # Header strip
        self.rect(f"{id}-header", x, y, w, 36, c["fill"], c["stroke"])

        # Tag badge (centered text)
        if tag:
            tag_font = 14
            tag_text_w = len(tag) * tag_font * 0.62
            tag_w = max(tag_text_w + 24, 80)
            tag_x = x + w - tag_w - 15
            self.rect(f"{id}-tag-bg", tag_x, y + 5, tag_w, 27,
                      c["accent"], c["stroke"])
            # Center text horizontally in badge
            text_x = tag_x + (tag_w - tag_text_w) / 2
            text_y = y + 5 + (27 - tag_font * 1.25) / 2
            self.text(f"{id}-tag-text", text_x, text_y, tag,
                      size=tag_font, family=6, color="#ffffff", align="center")

        # Title
        self.text(f"{id}-title", x + 20, y + 50, title,
                  size=21, family=6, color="#1e1e1e")

        # Body text
        self.text(f"{id}-body-text", x + 20, y + 82, body,
                  size=16, family=6, color="#495057")

        return y + h + 20

    def n_cards(self, id, y, cards, height=200, gap=20, padding=0):
        """
        N side-by-side content cards with automatic width calculation.

        cards: list of dicts, each with keys:
            title, body, color (default "orange"), tag (default None)

        Automatically calculates card widths to fit within CONTENT_WIDTH.
        Returns bottom Y.
        """
        n = len(cards)
        available = self.CONTENT_WIDTH - 2 * padding
        card_w = (available - (n - 1) * gap) / n
        start_x = self.CONTENT_X + padding

        bottom_y = y
        for i, card in enumerate(cards):
            x = start_x + i * (card_w + gap)
            card_bottom = self.content_card(
                f"{id}-card-{i}", x, y, card_w, height,
                card.get("title", ""), card.get("body", ""),
                card.get("color", "orange"), card.get("tag"),
                with_shadow=True)
            bottom_y = max(bottom_y, card_bottom)
        return bottom_y

    def two_cards(self, id, y, left_title, left_body, right_title, right_body,
                  left_color="orange", right_color="purple",
                  left_tag=None, right_tag=None, height=200):
        """Two side-by-side content cards. Returns bottom Y."""
        return self.n_cards(id, y, [
            {"title": left_title, "body": left_body, "color": left_color, "tag": left_tag},
            {"title": right_title, "body": right_body, "color": right_color, "tag": right_tag},
        ], height=height)

    def comparison(self, id, y, negative_title, negative_items,
                   positive_title, positive_items, height=None):
        """
        Before/After comparison block.
        Items are lists of strings.
        Returns bottom Y.
        """
        items_count = max(len(negative_items), len(positive_items))
        if height is None:
            height = 50 + items_count * 35 + 20

        # Negative side
        self.shadow(f"{id}-neg", self.CARD_LEFT_X, y, self.CARD_LEFT_W, height)
        self.rect(f"{id}-neg-body", self.CARD_LEFT_X, y,
                  self.CARD_LEFT_W, height, "#fff5f5", "#fa5252")
        self.rect(f"{id}-neg-header", self.CARD_LEFT_X, y,
                  self.CARD_LEFT_W, 36, "#fa5252", "#e03131")
        self.text(f"{id}-neg-title", self.CARD_LEFT_X + 15, y + 8,
                  negative_title, size=15, family=6, color="#ffffff")
        for i, item in enumerate(negative_items):
            self.text(f"{id}-neg-item-{i}", self.CARD_LEFT_X + 20,
                      y + 50 + i * 35, f"❌ {item}", size=16, family=6,
                      color="#495057")

        # Positive side
        self.shadow(f"{id}-pos", self.CARD_RIGHT_X, y, self.CARD_RIGHT_W, height)
        self.rect(f"{id}-pos-body", self.CARD_RIGHT_X, y,
                  self.CARD_RIGHT_W, height, "#ebfbee", "#40c057")
        self.rect(f"{id}-pos-header", self.CARD_RIGHT_X, y,
                  self.CARD_RIGHT_W, 36, "#40c057", "#2f9e44")
        self.text(f"{id}-pos-title", self.CARD_RIGHT_X + 15, y + 8,
                  positive_title, size=15, family=6, color="#ffffff")
        for i, item in enumerate(positive_items):
            self.text(f"{id}-pos-item-{i}", self.CARD_RIGHT_X + 20,
                      y + 50 + i * 35, f"✅ {item}", size=16, family=6,
                      color="#495057")

        return y + height + 20

    def tip_box(self, id, y, text, emoji="💡", color="yellow"):
        """Highlighted tip/insight box. Returns bottom Y."""
        c = COLORS[color]
        text_h = self._text_height(text, 17)
        box_h = max(text_h + 30, 60)

        self.rect(f"{id}-bg", self.CONTENT_X, y, self.CONTENT_WIDTH, box_h,
                  c["bg"], c["stroke"])
        # Emoji needs ~fontSize width to render fully
        emoji_size = 28
        self.text(f"{id}-emoji", self.CONTENT_X + 15, y + 12, emoji,
                  size=emoji_size, family=6, color="#1e1e1e")
        # Push text right to leave room for emoji
        self.text(f"{id}-text", self.CONTENT_X + 15 + emoji_size + 12, y + 15,
                  text, size=17, family=6, color="#495057")

        return y + box_h + 20

    def bullet_list(self, id, x, y, items, color="#495057", font_size=16,
                    bullet_color="blue"):
        """List of text items with colored circle bullets. Returns bottom Y."""
        c = COLORS[bullet_color]
        current_y = y
        for i, item in enumerate(items):
            self.circle(f"{id}-bullet-{i}", x, current_y + 4, 10,
                        c["fill"], c["stroke"])
            self.text(f"{id}-item-{i}", x + 20, current_y, item,
                      size=font_size, family=6, color=color)
            current_y += self._text_height(item, font_size) + 8
        return current_y + 10

    def progress_dots(self, id, x, y, total, active=0, color="yellow"):
        """Row of small diamond dots. Returns bottom Y."""
        c = COLORS[color]
        for i in range(total):
            fill = c["fill"] if i < active else c["bg"]
            self.diamond(f"{id}-dot-{i}", x + i * 18, y, 12, fill, c["stroke"])
        return y + 20

    def separator_line(self, id, y, color="#ced4da"):
        """Horizontal separator line across content area."""
        self.line(id, self.CONTENT_X + 50, y, self.CONTENT_WIDTH - 100, color)
        return y + 20

    # ── Export ──────────────────────────────────────────────────

    def to_json(self):
        return {
            "type": "excalidraw",
            "version": 2,
            "source": "https://excalidraw.com",
            "elements": self.elements,
            "appState": {
                "viewBackgroundColor": "#f8f9fa",
                "gridSize": 20,
                "gridStep": 5,
                "gridModeEnabled": False
            },
            "files": {}
        }

    def save(self, path):
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(self.to_json(), f, ensure_ascii=False, indent=2)
        print(f"✅ Saved to {path}")
        print(f"   {len(self.elements)} elements, {len(self.slides)} slides")
        print(f"   Open at https://excalidraw.com (drag & drop)")


if __name__ == "__main__":
    # ── Demo: Generate a sample presentation ────────────────────
    p = ExcalidrawPresentation()
    y = 0

    # ═══════════════════════════════════════════════════════════
    # SLIDE 1: Title
    # ═══════════════════════════════════════════════════════════
    slide1_h = 800
    p.slide_background("s1-bg", y, slide1_h)

    y_pos = y + 30
    y_pos = p.title_banner("s1-header", y_pos,
        title="DEMO ПРЕЗЕНТАЦИЯ",
        subtitle="Пример canvas-презентации",
        color="purple",
        icon_text="🎯",
        badges=[("ДЕМО", "blue"), ("5 мин", "green")]
    )

    y_pos = p.section_header("s1-section", y_pos,
        "ЧТО ТЫ УВИДИШЬ В ЭТОЙ ДЕМО", color="blue")

    y_pos = p.two_cards("s1-cards", y_pos,
        left_title="📦 Компоненты",
        left_body="Готовые визуальные блоки:\n• Заголовки и баннеры\n• Карточки контента\n• Сравнения\n• Подсказки",
        right_title="🎨 Стилизация",
        right_body="Профессиональный дизайн:\n• 9 цветовых тем\n• Тени и глубина\n• Типографика\n• Скетч-стиль",
        left_color="orange", right_color="purple",
        left_tag="LEGO", right_tag="ДИЗАЙН",
        height=220
    )

    y_pos = p.tip_box("s1-tip", y_pos,
        "Это всё генерируется Python-скриптом автоматически!")

    slide1_h = y_pos - y + 30

    # ═══════════════════════════════════════════════════════════
    # SLIDE 2: Content
    # ═══════════════════════════════════════════════════════════
    y = y_pos + p.GAP_BETWEEN_SLIDES
    slide2_start = y
    p.slide_background("s2-bg", y, 100)  # placeholder, resize later

    y_pos = y + 30
    y_pos = p.block_number("s2-block", y_pos, 1,
        "СРАВНЕНИЕ ПОДХОДОВ", duration="3 мин", color="blue")

    y_pos += 20
    y_pos = p.section_header("s2-section", y_pos,
        "🔧 РУЧНОЙ КОД vs ВАЙБКОДИНГ", color="green")

    y_pos = p.comparison("s2-compare", y_pos,
        negative_title="РУЧНОЙ КОД",
        negative_items=[
            "Часы на бойлерплейт",
            "Забытые edge cases",
            "Устаревшие паттерны",
        ],
        positive_title="ВАЙБКОДИНГ",
        positive_items=[
            "Фокус на логике",
            "AI покрывает edge cases",
            "Актуальные best practices",
        ]
    )

    y_pos = p.tip_box("s2-tip", y_pos,
        "Вайбкодинг — это не замена программиста.\nЭто усилитель возможностей.", emoji="🧠")

    y_pos = p.separator_line("s2-sep", y_pos, color="#be4bdb")

    y_pos += 10
    y_pos = p.bullet_list("s2-list", p.CONTENT_X + 60, y_pos, [
        "Используй AI как ассистента, а не замену",
        "Понимай что генерируется — не копируй слепо",
        "Строй свою библиотеку промптов и скиллов",
    ], bullet_color="purple")

    p.progress_dots("s2-dots", p.CONTENT_X + 350, y_pos, 5, 2)
    y_pos += 30

    slide2_h = y_pos - slide2_start + 30

    # ═══════════════════════════════════════════════════════════
    # SLIDE 3: Closing
    # ═══════════════════════════════════════════════════════════
    y = y_pos + p.GAP_BETWEEN_SLIDES
    slide3_start = y
    slide3_h = 400
    p.slide_background("s3-bg", y, slide3_h)

    y_pos = y + 30
    y_pos = p.title_banner("s3-header", y_pos,
        title="СПАСИБО!",
        subtitle="Подписывайся на канал",
        color="green",
        icon_text="🔥",
        badges=[("КОНЕЦ", "red")]
    )

    y_pos = p.tip_box("s3-cta", y_pos,
        "Ставь лайк, подписывайся, жми колокольчик! 🔔", emoji="🚀", color="cyan")

    slide3_h = y_pos - slide3_start + 30

    # ── Fix slide background heights ────────────────────────────
    # Find and update slide backgrounds with correct heights
    for el in p.elements:
        if el["id"] == "s1-bg":
            el["height"] = slide1_h
        elif el["id"] == "s2-bg":
            el["height"] = slide2_h
        elif el["id"] == "s3-bg":
            el["height"] = slide3_h

    # ── Save ────────────────────────────────────────────────────
    p.save("demo-presentation.excalidraw")
