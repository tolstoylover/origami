# Paper Tide 🌊

> Fold. Release. Drift.

A meditative browser-based experience where you fold paper creatures and release them into a miniature papercraft sea. Everything in the world is made of paper — the sea, the sky, the sun, even the rain.

## Features

- **Paper Folding**: Guided patterns for boat, plane, crane, fish, and frog
- **3D Paper Rendering**: Canvas 2D with custom perspective projection and paper-craft shading
- **Living Diorama**: Watch your creations come alive in a layered papercraft world
- **Creature Behaviors**: Boats drift, cranes soar, fish swim, frogs hop, planes glide
- **Weather System**: Rain, wind, snow, fog, and starfall
- **Procedural Audio**: All sounds generated with Web Audio API
- **Progressive Unlocks**: Master patterns to unlock new ones
- **Easter Eggs**: Hidden surprises throughout the experience

## Controls

| Action | Desktop | Mobile |
|--------|---------|--------|
| Fold | Click & drag | Touch & drag |
| Rotate view | Shift + drag | Two-finger rotate |
| Zoom | Scroll wheel | Pinch |
| Select pattern | Click card | Tap card |
| Release creature | Click "Release" | Tap "Release" |
| Weather | Click buttons / 1-4 keys | Tap buttons |
| Undo | Ctrl+Z | Undo button |
| Pause | Esc / P | — |

## Running Locally

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Production build
npm run build
```

Or simply open `dist/index.html` in a browser after building.

## Architecture

- **React + Vite + Tailwind** for UI shell
- **Canvas 2D** for all game rendering (paper, diorama, creatures)
- **Web Audio API** for procedural sound generation
- **localStorage** for persistence

## Patterns

1. **Paper Plane** ✈️ — 5 steps, quick and satisfying
2. **Paper Boat** ⛵ — 8 steps, classic hat-to-boat fold
3. **Paper Crane** 🕊️ — 10 steps, unlocks after boat
4. **Paper Fish** 🐟 — 6 steps, unlocks after boat
5. **Paper Frog** 🐸 — 8 steps, unlocks after crane

## Easter Eggs

- 🌞 Click the sun 5 times for a surprise
- ☕ The coffee ring stain on the desk...
- 🐋 A mysterious shape beneath the paper sea at dusk
- ✨ Fold 25 cranes to summon the Golden Crane

## Tunable Constants

Found at the top of `src/game/types.ts`:

- `MAX_CREATURES`: 30
- `MAX_FACES`: 64
- `FOLD_SNAP_THRESHOLD`: 0.85
- `WAVE_SPEED`: 0.3
- `PARALLAX_STRENGTH`: 0.15
- `SHADOW_SOFTNESS`: 4

## Browser Support

- Modern browsers with Canvas 2D and Web Audio API support
- Responsive design for desktop and mobile
- `prefers-reduced-motion` support
- Keyboard accessible

## License

MIT
