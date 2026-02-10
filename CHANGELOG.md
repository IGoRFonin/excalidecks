# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.1.2] - 2026-02-10

### Added
- `_wrapText(text, maxWidth, fontSize, fontFamily)` method in `ExcalidrawPresentation` for word-wrapping text to fit within a given pixel width
- Text wrapping in `contentCard()` for title and body text with dynamic body Y positioning
- Text wrapping in `tipBox()` before height calculation
- Text wrapping in `comparison()` items with dynamic Y accumulation and auto-height
- Text wrapping in `sectionHeader()` and `titleBanner()` for long headers

### Fixed
- Increased Express JSON body size limit from 100KB to 20MB to support large scene loads and batch operations
- `_textWidth()` now uses higher width multipliers for Cyrillic characters (0.72 for Nunito, 0.75 for Lilita One) to prevent text clipping in cards, tipBox, comparison, and other components
- `nCards()` now limits to max 2 cards per row (grid layout) instead of cramming all cards into one row, preventing text overflow in narrow cards
- `contentCard()` body Y position is now dynamic based on wrapped title height
- `comparison()` uses dynamic Y positioning instead of fixed `i * 35` spacing, preventing text overlap
- `comparison()` auto-calculates height from both columns instead of only item count
- `sectionHeader()` background rect auto-grows for wrapped text
