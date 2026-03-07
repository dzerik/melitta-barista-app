# Melitta Barista App

Standalone PWA for controlling Melitta Barista Smart coffee machines via Home Assistant WebSocket API.

## Screenshots

| Recipe Grid | Freestyle Builder |
|:-----------:|:-----------------:|
| ![Recipe Grid](images/img_1.png) | ![Freestyle Builder](images/img.png) |

## Features

- **Recipe Grid** — 24 drink profiles with schematic glass cup SVG icons showing drink layers, reflections, and animated steam
- **Recipe Details** — select a recipe card to view its full composition (ingredients, portions, intensity, temperature) on a blurred overlay
- **Freestyle Builder** — create custom drinks with a dynamic glass visualization that fills with ingredients in real-time
- **Profile Support** — switch between user profiles with customized recipe parameters
- **Machine States** — premium fullscreen displays for offline, cleaning, descaling, and action-required states
- **Settings** — machine configuration: water hardness, energy saving, auto-off, brew temperature
- **PWA** — installable as a standalone app on any device

## Requirements

- [Melitta Barista Smart HA Integration](https://github.com/dzerik/melitta-barista-ha) v0.8.0+
- Home Assistant with a long-lived access token
- Melitta Barista T Smart or Barista TS Smart

## Getting Started

```bash
npm install
npm run dev
```

Open the app, enter your Home Assistant URL and long-lived access token. The app will auto-discover the Melitta machine from HA entities.

### Build for production

```bash
npm run build
```

The `dist/` folder can be served as a static site or installed as a PWA.

## Tech Stack

- React 19 + TypeScript 5.9
- Vite 7 + Tailwind CSS 4
- home-assistant-js-websocket
- vite-plugin-pwa

## License

MIT
