# Minimal Solitaire (Klondike)

A minimal, static Klondike (solitaire) implementation using plain HTML, CSS and JavaScript.

Preview: a small preview image is included under `assets/` (see `assets/preview.png` if present).

## Features

- Classic Klondike rules (click-to-move)
- Stock/waste, 7 tableau piles, 4 foundations
- Responsive, lightweight, works in a modern browser

## Requirements

- A modern web browser (Chrome, Firefox, Edge)
- Optional: Python 3 to serve files locally (recommended to avoid `file://` quirks)

## Run locally (recommended)

Open a terminal in the project folder and run:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

Alternatively, you can open `index.html` directly, but serving via HTTP avoids some local-file navigation quirks.

## Project structure

- `index.html` — main page
- `style.css` — styles
- `script.js` — game logic and rendering
- `assets/` — card images and preview images

## Controls / How to play

- Click the stock (top-left) to draw to the waste
- Click a card to select it, then click a valid target pile to move
- Foundations (top-right) collect same-suit ascending cards
- Empty tableau piles accept a King (or a moved King stack)

## Notes

- The game is intentionally minimal and implemented without any frameworks.
- If card images are missing, the app falls back to a built-in `back.svg`.

## License

This repository is provided as-is for personal use. Add or replace with your preferred license when publishing.

## Credits

- Card assets and preview images: included in `assets/` (check file names there)
- Built with help from GitHub Copilot (GPT-5 mini) — used to speed up implementation and iteration.

Enjoy!