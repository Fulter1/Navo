# Architecture

## Runtime strategy
To avoid breaking the existing app, the current production runtime is preserved in:

`app/runtime/navo-runtime.js`

New systems are placed around it:
- `app/core`: boot systems like performance guardrails.
- `app/services`: storage and external services.
- `app/ai`: local smart engine and future real AI bridge.
- `app/focus`: focus-room-specific systems.
- `app/dashboard`: dashboard models and future components.

## CSS strategy
The old large CSS file was split into:
- `styles/base/tokens-base.css`
- `styles/components/app-shell.css`
- `styles/pages/landing.css`
- `styles/components/intelligence-focus.css`
- `styles/motion/reduced-motion.css`
- `styles/layouts/responsive-fixes.css`

All are imported by `styles/main.css`.
