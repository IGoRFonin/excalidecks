/**
 * Demo presentation — exercises all components including edge cases
 * for text wrapping, nCards grid layout, and dynamic heights.
 *
 * Usage:
 *   node skills/excalidraw-presentation/demo.cjs
 *
 * Requires the server running:
 *   node dist/index.js --canvas-only
 */

const { ExcalidrawPresentation } = require("./excalidraw_presentation.cjs");

(async () => {
  const p = new ExcalidrawPresentation();
  let y = 0;

  // ═══════════════════════════════════════════════════════════
  // SLIDE 1: Title + 2 cards (basic)
  // ═══════════════════════════════════════════════════════════
  let slide1H = 800;
  p.slideBackground("s1-bg", y, slide1H);

  let yPos = y + 30;
  yPos = p.titleBanner(
    "s1-header",
    yPos,
    "DEMO ПРЕЗЕНТАЦИЯ",
    "Пример canvas-презентации",
    "purple",
    "🎯",
    [
      ["ДЕМО", "blue"],
      ["5 мин", "green"],
    ]
  );

  yPos = p.sectionHeader(
    "s1-section",
    yPos,
    "ЧТО ТЫ УВИДИШЬ В ЭТОЙ ДЕМО",
    "blue"
  );

  yPos = p.twoCards(
    "s1-cards",
    yPos,
    "📦 Компоненты",
    "Готовые визуальные блоки:\n• Заголовки и баннеры\n• Карточки контента\n• Сравнения\n• Подсказки",
    "🎨 Стилизация",
    "Профессиональный дизайн:\n• 9 цветовых тем\n• Тени и глубина\n• Типографика\n• Скетч-стиль",
    "orange",
    "purple",
    "LEGO",
    "ДИЗАЙН",
    220
  );

  yPos = p.tipBox(
    "s1-tip",
    yPos,
    "Это всё генерируется Node.js-скриптом автоматически!"
  );

  slide1H = yPos - y + 30;

  // ═══════════════════════════════════════════════════════════
  // SLIDE 2: Comparison + content
  // ═══════════════════════════════════════════════════════════
  y = yPos + p.GAP_BETWEEN_SLIDES;
  const slide2Start = y;
  p.slideBackground("s2-bg", y, 100);

  yPos = y + 30;
  yPos = p.blockNumber(
    "s2-block",
    yPos,
    1,
    "СРАВНЕНИЕ ПОДХОДОВ",
    "3 мин",
    "blue"
  );

  yPos += 20;
  yPos = p.sectionHeader(
    "s2-section",
    yPos,
    "🔧 РУЧНОЙ КОД vs ВАЙБКОДИНГ",
    "green"
  );

  yPos = p.comparison(
    "s2-compare",
    yPos,
    "РУЧНОЙ КОД",
    [
      "Часы на бойлерплейт",
      "Забытые edge cases",
      "Устаревшие паттерны",
    ],
    "ВАЙБКОДИНГ",
    [
      "Фокус на логике",
      "AI покрывает edge cases",
      "Актуальные best practices",
    ]
  );

  yPos = p.tipBox(
    "s2-tip",
    yPos,
    "Вайбкодинг — это не замена программиста.\nЭто усилитель возможностей.",
    "🧠"
  );

  yPos = p.separatorLine("s2-sep", yPos, "#be4bdb");

  yPos += 10;
  yPos = p.bulletList(
    "s2-list",
    p.CONTENT_X + 60,
    yPos,
    [
      "Используй AI как ассистента, а не замену",
      "Понимай что генерируется — не копируй слепо",
      "Строй свою библиотеку промптов и скилов",
    ],
    "#495057",
    16,
    "purple"
  );

  p.progressDots("s2-dots", p.CONTENT_X + 350, yPos, 5, 2);
  yPos += 30;

  const slide2H = yPos - slide2Start + 30;

  // ═══════════════════════════════════════════════════════════
  // SLIDE 3: Edge cases — 4 cards (2x2 grid)
  // ═══════════════════════════════════════════════════════════
  y = yPos + p.GAP_BETWEEN_SLIDES;
  const slide3Start = y;
  p.slideBackground("s3-bg", y, 100);

  yPos = y + 30;
  yPos = p.sectionHeader(
    "s3-section",
    yPos,
    "📦 4 КАРТОЧКИ — СЕТКА 2x2",
    "orange"
  );

  yPos = p.nCards("s3-grid", yPos, [
    {
      title: "Карточка с длинным заголовком который не влезает в одну строку",
      body: "Тело карточки с достаточно длинным текстом, который тоже должен переноситься на следующую строку автоматически.",
      color: "blue",
      tag: "WRAP",
    },
    {
      title: "Короткий",
      body: "Минимум текста.",
      color: "green",
      tag: "OK",
    },
    {
      title: "📊 Третья карточка",
      body: "Средний текст с эмодзи и несколькими пунктами:\n• Пункт один\n• Пункт два\n• Пункт три",
      color: "purple",
    },
    {
      title: "🔥 Четвёртая",
      body: "Проверка что все 4 карточки рендерятся сеткой 2x2, а не в одну строку шириной ~210px каждая.",
      color: "orange",
      tag: "GRID",
    },
  ]);

  const slide3H = yPos - slide3Start + 30;

  // ═══════════════════════════════════════════════════════════
  // SLIDE 4: Edge cases — 3 cards (2+1), 5 cards (2+2+1)
  // ═══════════════════════════════════════════════════════════
  y = yPos + p.GAP_BETWEEN_SLIDES;
  const slide4Start = y;
  p.slideBackground("s4-bg", y, 100);

  yPos = y + 30;
  yPos = p.sectionHeader("s4-section", yPos, "📦 3 КАРТОЧКИ — 2+1", "cyan");

  yPos = p.nCards("s4-three", yPos, [
    {
      title: "Первая",
      body: "В первом ряду две карточки одинаковой ширины.",
      color: "blue",
    },
    {
      title: "Вторая",
      body: "Вторая карточка в первом ряду.",
      color: "green",
    },
    {
      title: "Третья (одна в ряду)",
      body: "Эта карточка одна в последнем ряду. Она НЕ должна растягиваться на всю ширину — та же ширина ~440px.",
      color: "red",
    },
  ]);

  yPos += 20;
  yPos = p.sectionHeader("s4-section2", yPos, "📦 5 КАРТОЧЕК — 2+2+1", "violet");

  yPos = p.nCards("s4-five", yPos, [
    { title: "1️⃣ Раз", body: "Первый ряд, левая.", color: "blue" },
    { title: "2️⃣ Два", body: "Первый ряд, правая.", color: "green" },
    { title: "3️⃣ Три", body: "Второй ряд, левая.", color: "orange" },
    { title: "4️⃣ Четыре", body: "Второй ряд, правая.", color: "purple" },
    { title: "5️⃣ Пять (одна)", body: "Третий ряд, одна карточка.", color: "red" },
  ]);

  const slide4H = yPos - slide4Start + 30;

  // ═══════════════════════════════════════════════════════════
  // SLIDE 5: Edge cases — comparison with long text
  // ═══════════════════════════════════════════════════════════
  y = yPos + p.GAP_BETWEEN_SLIDES;
  const slide5Start = y;
  p.slideBackground("s5-bg", y, 100);

  yPos = y + 30;
  yPos = p.sectionHeader(
    "s5-section",
    yPos,
    "⚖️ СРАВНЕНИЕ С ДЛИННЫМ ТЕКСТОМ В ПУНКТАХ",
    "red"
  );

  yPos = p.comparison(
    "s5-compare",
    yPos,
    "ПРОБЛЕМЫ СТАРОГО ПОДХОДА",
    [
      "Текст пунктов сравнения вылезал за границы карточки потому что не было переноса по словам",
      "Фиксированный шаг i*35 приводил к наложению длинных строк друг на друга",
      "Высота карточки считалась только по количеству пунктов, а не по реальной высоте текста",
    ],
    "ИСПРАВЛЕНИЯ",
    [
      "Каждый пункт оборачивается через _wrapText() до расчёта позиции Y",
      "Динамическое накопление Y позиций вместо фиксированного множителя",
      "Auto-height на основе Math.max обоих столбцов — карточки всегда одной высоты",
      "Короткий пункт",
    ]
  );

  yPos = p.tipBox(
    "s5-tip",
    yPos,
    "Это очень длинный текст в tipBox, который специально сделан таким длинным чтобы проверить что перенос текста работает корректно и текст не вылезает за правую границу блока подсказки. Если вы видите этот текст целиком внутри жёлтой рамки — значит wrapping работает!",
    "✅",
    "green"
  );

  const slide5H = yPos - slide5Start + 30;

  // ═══════════════════════════════════════════════════════════
  // SLIDE 6: Edge cases — long headers
  // ═══════════════════════════════════════════════════════════
  y = yPos + p.GAP_BETWEEN_SLIDES;
  const slide6Start = y;
  p.slideBackground("s6-bg", y, 100);

  yPos = y + 30;
  yPos = p.titleBanner(
    "s6-header",
    yPos,
    "ОЧЕНЬ ДЛИННЫЙ ЗАГОЛОВОК БАННЕРА КОТОРЫЙ ДОЛЖЕН ПЕРЕНОСИТЬСЯ",
    "И подзаголовок тоже не короткий",
    "blue",
    "📏"
  );

  yPos = p.sectionHeader(
    "s6-section",
    yPos,
    "🔤 ЭТОТ ЗАГОЛОВОК СЕКЦИИ СПЕЦИАЛЬНО СДЕЛАН ОЧЕНЬ ДЛИННЫМ ЧТОБЫ ПРОВЕРИТЬ WRAPPING",
    "purple"
  );

  yPos = p.contentCard(
    "s6-card",
    p.CONTENT_X,
    yPos,
    p.CONTENT_WIDTH,
    100,
    "Карточка с очень длинным заголовком который точно не поместится в одну строку при стандартной ширине контента",
    "А вот тело карточки ещё длиннее. Здесь может быть целый абзац текста, который описывает какую-то сложную концепцию или инструкцию. Важно чтобы весь этот текст оставался внутри карточки и не вылезал за её границы. Auto-grow должен увеличить высоту карточки автоматически.",
    "cyan",
    "EDGE CASE",
    true
  );

  const slide6H = yPos - slide6Start + 30;

  // ═══════════════════════════════════════════════════════════
  // SLIDE 7: Closing
  // ═══════════════════════════════════════════════════════════
  y = yPos + p.GAP_BETWEEN_SLIDES;
  const slide7Start = y;
  p.slideBackground("s7-bg", y, 100);

  yPos = y + 30;
  yPos = p.titleBanner(
    "s7-header",
    yPos,
    "СПАСИБО!",
    "Подписывайся на канал",
    "green",
    "🔥",
    [["КОНЕЦ", "red"]]
  );

  yPos = p.tipBox(
    "s7-cta",
    yPos,
    "Ставь лайк, подписывайся, жми колокольчик! 🔔",
    "🚀",
    "cyan"
  );

  const slide7H = yPos - slide7Start + 30;

  // ── Fix slide background heights ────────────────────────────
  const slideHeights = {
    "s1-bg": slide1H,
    "s2-bg": slide2H,
    "s3-bg": slide3H,
    "s4-bg": slide4H,
    "s5-bg": slide5H,
    "s6-bg": slide6H,
    "s7-bg": slide7H,
  };
  for (const el of p.elements) {
    if (slideHeights[el.id] !== undefined) {
      el.height = slideHeights[el.id];
    }
  }

  // ── Push to live server ─────────────────────────────────────
  await p.push();
})();
