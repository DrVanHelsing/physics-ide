# Design System: "Dark Glassmorphic Panel" Theme

## What This Style Is Called

This design pattern is a **Dark Glassmorphic UI** (also called **"Dark Mode Glass Panel"** or **"Frosted Dark Overlay"**). It draws from several modern UI trends:

- **Glassmorphism** — translucent panels with `backdrop-filter: blur()` on overlays
- **GitHub Dark / Primer Dark** — the specific color palette (`#0d1117`, `#58a6ff`, `#e6edf3`, `#8b949e`) is heavily inspired by GitHub's dark theme
- **Card-based layout** — content organized into subtle bordered cards on a near-black surface
- **Keycap / hardware skeuomorphism** — keyboard key caps rendered with `box-shadow` to look 3D-physical

The overall mood is: **professional, dark, low-contrast, blue-accent, developer-tool-like**.

---

## 1. Color Palette (CSS Custom Properties)

```css
:root {
  /* ── Backgrounds ─────────────────────────── */
  --bg-dark:   #0d1117;                       /* Deepest background (near-black blue) */
  --bg-panel:  rgba(13, 17, 23, 0.94);        /* Panel background — 94% opaque over blur */
  --bg-card:   rgba(255, 255, 255, 0.04);     /* Card surface — barely visible white lift */

  /* ── Accent ──────────────────────────────── */
  --accent:     #58a6ff;                       /* Primary accent — GitHub-blue */
  --accent-dim: rgba(88, 166, 255, 0.15);     /* Faint accent for backgrounds/badges */

  /* ── Text hierarchy ──────────────────────── */
  --text-1: #e6edf3;   /* Primary text — headings, labels (high contrast) */
  --text-2: #8b949e;   /* Secondary text — descriptions, body copy */
  --text-3: #484f58;   /* Tertiary text — muted captions, dividers, placeholders */

  /* ── Borders ─────────────────────────────── */
  --border: rgba(240, 246, 252, 0.1);         /* Subtle white border at 10% */

  /* ── Semantic colors ─────────────────────── */
  --success: #3fb950;
  --warning: #d29922;
  --danger:  #f85149;

  /* ── Shape & Typography ──────────────────── */
  --radius: 8px;
  --font: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --mono: 'JetBrains Mono', 'Cascadia Code', monospace;
}
```

**Key Principle:** All surfaces use **extremely low-opacity white** (`rgba(255,255,255, 0.02–0.06)`) layered on a near-black base. This creates depth without harsh contrast.

---

## 2. The Overlay (Backdrop)

The full-screen dimming + blur layer behind the modal:

```css
.overlay {
  position: fixed;
  inset: 0;
  z-index: 9000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.60);       /* 60% black dim */
  backdrop-filter: blur(6px);             /* Frosted glass effect */
  animation: fadeIn 0.18s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
```

**Why it works:** The `backdrop-filter: blur(6px)` creates the "glassmorphism" feel — content behind the modal becomes a soft, out-of-focus wash. The 60% black ensures readability without being opaque.

---

## 3. The Modal Container

```css
.modal {
  display: flex;
  flex-direction: column;
  width: min(900px, 92vw);               /* Responsive: never wider than viewport */
  max-height: min(680px, 88vh);          /* Never taller than viewport */
  background: var(--bg-panel);           /* rgba(13, 17, 23, 0.94) */
  border: 1px solid var(--border);       /* rgba(240, 246, 252, 0.1) */
  border-radius: 14px;                   /* Softer than typical 8px */
  box-shadow: 0 24px 80px rgba(0,0,0,0.55);  /* Deep, diffused shadow */
  overflow: hidden;
  animation: slideUp 0.22s ease-out;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(18px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0)   scale(1); }
}
```

**Signature traits:**
- **14px border-radius** — rounder than most UIs, feels modern/soft
- **Massive box-shadow** (80px spread) — creates a "floating" effect
- **Entry animation** — slides up 18px + scales from 97% → gives a spring-like "pop in"
- **near-opaque dark panel** — 94% opacity lets just a hint of background through

---

## 4. Header Bar

```css
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 24px 14px;
  border-bottom: 1px solid var(--border);
}

.title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 17px;
  font-weight: 700;
  color: var(--text-1);      /* #e6edf3 */
  letter-spacing: -0.01em;   /* Slight tightening — modern feel */
}

/* Close button */
.close-btn {
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  border: none; border-radius: 8px;
  background: rgba(255,255,255,0.05);
  color: var(--text-3);
  font-size: 16px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.close-btn:hover {
  background: rgba(255, 80, 80, 0.18);  /* Red glow on hover */
  color: #f66;
}
```

**Pattern:** Icon (SVG, accent-colored) + bold title text, with a subtle close button that turns red on hover.

---

## 5. Tab Navigation

```css
.tabs {
  display: flex;
  gap: 2px;
  padding: 0 24px;
  border-bottom: 1px solid var(--border);
  background: rgba(255,255,255,0.015);   /* Hair-thin tinted bar */
}

.tab {
  padding: 12px 18px;
  border: none;
  background: none;
  color: rgba(255,255,255,0.7);          /* Muted white */
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s;
  white-space: nowrap;
}

.tab:hover { color: #fff; }

.tab.active {
  color: var(--accent);                  /* #58a6ff */
  border-bottom-color: var(--accent);    /* Blue underline indicator */
}
```

**Pattern:** Underline-style tabs. Inactive = muted white, active = accent blue with a 2px bottom border. The tab strip itself has a micro-tinted background.

---

## 6. Content Cards (The Core Reusable Component)

This is the most important repeatable pattern — used for control cards, tool cards, tip cards, panel cards:

```css
.card {
  display: flex;
  align-items: flex-start;        /* or center, depending on content */
  gap: 16px;
  padding: 16px 18px;
  border-radius: 10px;
  background: rgba(255,255,255, 0.025);   /* ~2.5% white — barely there */
  border: 1px solid rgba(255,255,255, 0.06);  /* 6% white border */
  transition: background 0.15s, border-color 0.15s;
}
.card:hover {
  background: rgba(255,255,255, 0.04);    /* Lifts to 4% on hover */
  border-color: rgba(255,255,255, 0.1);   /* Border brightens */
}
```

**Card label:**
```css
.card-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
  margin-bottom: 4px;
}
```

**Card description:**
```css
.card-desc {
  font-size: 12.5px;
  color: var(--text-2);
  line-height: 1.55;
}
```

---

## 7. Icon Badges (Tool Icon Containers)

```css
.icon-badge {
  flex-shrink: 0;
  width: 40px; height: 40px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(88, 166, 255, 0.08);   /* Accent-tinted bg */
  border: 1px solid rgba(88, 166, 255, 0.15);
  border-radius: 10px;
  color: var(--accent);
}
.icon-badge svg { width: 22px; height: 22px; }
```

---

## 8. Keyboard Key Caps (Skeuomorphic)

```css
.key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  padding: 0 8px;
  border-radius: 6px;
  background: rgba(255,255,255, 0.06);
  border: 1px solid rgba(255,255,255, 0.12);
  box-shadow: 0 2px 0 rgba(0,0,0,0.3);     /* Bottom shadow = 3D "pressed" look */
  color: var(--text-2);
  font-family: var(--mono);    /* Monospace for that terminal feel */
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}
.key.wide { min-width: 56px; }
```

---

## 9. "Field Equivalent" Callout Block

A left-bordered aside for supplementary information:

```css
.callout {
  margin-top: 6px;
  padding: 8px 12px;
  border-radius: 6px;
  background: rgba(88, 166, 255, 0.04);      /* Faint accent tint */
  border-left: 3px solid rgba(88, 166, 255, 0.25);  /* Accent left bar */
  font-size: 12px;
  color: var(--text-3);
  line-height: 1.5;
}

.callout-tag {
  display: block;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(88, 166, 255, 0.55);
  margin-bottom: 2px;
}
```

---

## 10. Section Dividers / Category Headers

```css
.section-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-2);
  margin-bottom: 12px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border);
}

.category-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-3);
  padding: 12px 0 4px;
}
```

---

## 11. Numbered Badges (Tip Numbers)

```css
.number-badge {
  flex-shrink: 0;
  width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%;
  background: rgba(88, 166, 255, 0.1);
  color: var(--accent);
  font-size: 13px;
  font-weight: 700;
  font-family: var(--mono);
}
```

---

## 12. Scrollbar Styling

```css
.scrollable::-webkit-scrollbar { width: 6px; }
.scrollable::-webkit-scrollbar-track { background: transparent; }
.scrollable::-webkit-scrollbar-thumb {
  background: rgba(255,255,255, 0.1);
  border-radius: 3px;
}
```

---

## 13. Animation Patterns

| Animation | Duration | Easing | Effect |
|-----------|----------|--------|--------|
| Overlay fade-in | 0.18s | ease-out | `opacity: 0 → 1` |
| Modal slide-up | 0.22s | ease-out | `translateY(18px) scale(0.97) → none` |
| Tab content crossfade | 0.2s | ease-out | `opacity: 0, translateY(6px) → none` |
| Hover transitions | 0.15s | default | `background`, `color`, `border-color` |

---

## 14. Typography Scale

| Role | Size | Weight | Color | Font |
|------|------|--------|-------|------|
| Modal title | 17px | 700 | `--text-1` | `--font` (Inter) |
| Card/label heading | 14px | 600 | `--text-1` | `--font` |
| Tab label | 13px | 500 | white @ 70% | `--font` |
| Body/description | 12.5px | 400 | `--text-2` | `--font` |
| Callout body | 12px | 400 | `--text-3` | `--font` |
| Category header | 11px | 700 | `--text-3` | `--font` |
| Tag/micro label | 10px | 700 | accent @ 55% | `--font` |
| Key cap | 12px | 600 | `--text-2` | `--mono` (JetBrains Mono) |

---

## 15. Layout Grid Patterns

```css
/* Responsive auto-fill grid for cards */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 14px;
}

/* Vertical stack for sequential items */
.card-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
```

---

## 16. Complete Minimal Starter Template

Here's a standalone HTML file you can use as a boilerplate to recreate this entire design system for a new project:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dark Glass UI</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>
:root {
  --bg-dark:   #0d1117;
  --bg-panel:  rgba(13, 17, 23, 0.94);
  --bg-card:   rgba(255, 255, 255, 0.04);
  --accent:    #58a6ff;
  --accent-dim: rgba(88, 166, 255, 0.15);
  --text-1:    #e6edf3;
  --text-2:    #8b949e;
  --text-3:    #484f58;
  --border:    rgba(240, 246, 252, 0.1);
  --success:   #3fb950;
  --warning:   #d29922;
  --danger:    #f85149;
  --radius:    8px;
  --font:      'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --mono:      'JetBrains Mono', 'Cascadia Code', monospace;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font);
  background: var(--bg-dark);
  color: var(--text-1);
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── Overlay ──────────────────── */
.overlay {
  position: fixed; inset: 0; z-index: 9000;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.60);
  backdrop-filter: blur(6px);
  animation: fadeIn 0.18s ease-out;
}
@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }

/* ── Modal ────────────────────── */
.modal {
  display: flex; flex-direction: column;
  width: min(900px, 92vw);
  max-height: min(680px, 88vh);
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: 0 24px 80px rgba(0,0,0,0.55);
  overflow: hidden;
  animation: slideUp 0.22s ease-out;
}
@keyframes slideUp {
  from { opacity: 0; transform: translateY(18px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

/* ── Header ───────────────────── */
.header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 24px 14px;
  border-bottom: 1px solid var(--border);
}
.title {
  display: flex; align-items: center; gap: 10px;
  font-size: 17px; font-weight: 700; color: var(--text-1);
  letter-spacing: -0.01em;
}
.close-btn {
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  border: none; border-radius: 8px;
  background: rgba(255,255,255,0.05); color: var(--text-3);
  font-size: 16px; cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.close-btn:hover { background: rgba(255,80,80,0.18); color: #f66; }

/* ── Tabs ─────────────────────── */
.tabs {
  display: flex; gap: 2px; padding: 0 24px;
  border-bottom: 1px solid var(--border);
  background: rgba(255,255,255,0.015);
}
.tab {
  padding: 12px 18px; border: none; background: none;
  color: rgba(255,255,255,0.7); font-size: 13px; font-weight: 500;
  cursor: pointer; border-bottom: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s; white-space: nowrap;
}
.tab:hover { color: #fff; }
.tab.active { color: var(--accent); border-bottom-color: var(--accent); }

/* ── Content ──────────────────── */
.content {
  flex: 1; overflow-y: auto; padding: 20px 24px 28px;
}
.content::-webkit-scrollbar { width: 6px; }
.content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }

/* ── Cards ────────────────────── */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 14px;
}
.card {
  display: flex; align-items: flex-start; gap: 16px;
  padding: 16px 18px; border-radius: 10px;
  background: rgba(255,255,255,0.025);
  border: 1px solid rgba(255,255,255,0.06);
  transition: background 0.15s, border-color 0.15s;
}
.card:hover {
  background: rgba(255,255,255,0.04);
  border-color: rgba(255,255,255,0.1);
}
.card-label { font-size: 14px; font-weight: 600; color: var(--text-1); margin-bottom: 4px; }
.card-desc  { font-size: 12.5px; color: var(--text-2); line-height: 1.55; }

/* ── Icon Badge ───────────────── */
.icon-badge {
  flex-shrink: 0; width: 40px; height: 40px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(88,166,255,0.08);
  border: 1px solid rgba(88,166,255,0.15);
  border-radius: 10px; color: var(--accent);
}

/* ── Key Cap ──────────────────── */
.key {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 28px; height: 28px; padding: 0 8px;
  border-radius: 6px; background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  box-shadow: 0 2px 0 rgba(0,0,0,0.3);
  color: var(--text-2); font-family: var(--mono);
  font-size: 12px; font-weight: 600; line-height: 1;
}

/* ── Callout ──────────────────── */
.callout {
  margin-top: 6px; padding: 8px 12px; border-radius: 6px;
  background: rgba(88,166,255,0.04);
  border-left: 3px solid rgba(88,166,255,0.25);
  font-size: 12px; color: var(--text-3); line-height: 1.5;
}
.callout-tag {
  display: block; font-size: 10px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.05em;
  color: rgba(88,166,255,0.55); margin-bottom: 2px;
}

/* ── Category / Section ───────── */
.section-title {
  font-size: 13px; font-weight: 700; color: var(--text-2);
  margin-bottom: 12px; padding-bottom: 6px;
  border-bottom: 1px solid var(--border);
}
.category-label {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--text-3); padding: 12px 0 4px;
}

/* ── Number Badge ─────────────── */
.number-badge {
  flex-shrink: 0; width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%; background: rgba(88,166,255,0.1);
  color: var(--accent); font-size: 13px; font-weight: 700;
  font-family: var(--mono);
}
</style>
</head>
<body>

<div class="overlay">
  <div class="modal">
    <div class="header">
      <div class="title">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
             stroke="#58a6ff" stroke-width="2" stroke-linecap="round"
             stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        Page Title
      </div>
      <button class="close-btn">&#x2715;</button>
    </div>

    <div class="tabs">
      <button class="tab active">Tab One</button>
      <button class="tab">Tab Two</button>
      <button class="tab">Tab Three</button>
    </div>

    <div class="content">
      <div class="card-grid">
        <div class="card">
          <div class="icon-badge">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 2v4m0 12v4m-10-10h4m12 0h4"/>
            </svg>
          </div>
          <div>
            <div class="card-label">Feature Name <span class="key">F</span></div>
            <div class="card-desc">Description of this feature goes here with enough
              detail to be helpful but not overwhelming.</div>
            <div class="callout">
              <span class="callout-tag">Note</span>
              Additional context or tip about this feature.
            </div>
          </div>
        </div>

        <div class="card">
          <div class="number-badge">2</div>
          <div>
            <div class="card-label">Another Item</div>
            <div class="card-desc">Secondary card demonstrating the number badge
              variant instead of the icon badge.</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

</body>
</html>
```

---

## 17. Glassmorphism & Transparency — Complete Guide

This is the signature visual effect of the design system. The term is **"Glassmorphism"** (coined ~2020, popularized by Apple's macOS Big Sur and Microsoft's Fluent Design "Acrylic" material). Here's exactly how it works and how to apply it.

### What Creates the Glass Effect

Glass is built from **4 layered CSS properties** working together:

```
 ┌─────────────────────────────────────────────┐
 │  1. Semi-transparent background             │  rgba(13,17,23, 0.85–0.94)
 │  2. backdrop-filter: blur()                 │  Blurs whatever is BEHIND the element
 │  3. Subtle border                           │  rgba(240,246,252, 0.1)
 │  4. Deep box-shadow                         │  Creates lift/floating effect
 └─────────────────────────────────────────────┘
```

Without ANY one of these, the effect breaks down:
- No blur → just a tinted box
- No transparency → opaque, no glass feel
- No border → edges disappear into the background
- No shadow → doesn't look like it's floating

### The 3 Glass Tiers Used in This System

#### Tier 1: Heavy Glass (Slide-out Panels, Popups)
Used for **persistent panels** that sit over a 3D scene or live content. Maximum blur, high opacity.

```css
.glass-panel {
  background: rgba(13, 17, 23, 0.94);       /* 94% opaque — very dark, slight see-through */
  backdrop-filter: blur(24px);               /* Heavy blur — content behind is unreadable */
  -webkit-backdrop-filter: blur(24px);       /* Safari support (REQUIRED) */
  border: 1px solid rgba(240, 246, 252, 0.1);
  border-radius: 12px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
}
```

**Used for:** Side panels, rock info popups, floating controls. The 24px blur and 94% opacity mean you can barely see background content — it's mostly a dark panel with just enough translucency to feel connected to the scene.

**Real example from the codebase (side panel):**
```css
#panel {
  position: fixed;
  left: var(--sidebar-w);
  top: 0;
  bottom: var(--statusbar-h);
  width: 340px;
  background: var(--bg-panel);             /* rgba(13, 17, 23, 0.94) */
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-right: 1px solid var(--border);
  transform: translateX(-340px);           /* Hidden by default */
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 150;
  overflow-y: auto;
}
#panel.open { transform: translateX(0); }  /* Slide in */
```

**Real example (floating popup):**
```css
#rock-popup {
  position: fixed;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  background: var(--bg-panel);             /* rgba(13, 17, 23, 0.94) */
  backdrop-filter: blur(24px);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  width: 360px;
  z-index: 300;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
}
```

#### Tier 2: Medium Glass (Modal Overlays)
Used for **full-screen overlays** that dim and blur the entire background. Lower blur, lower opacity.

```css
.glass-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.60);          /* 60% black — dims everything */
  backdrop-filter: blur(6px);                /* Light blur — you can vaguely see shapes */
  z-index: 9000;
}

.glass-modal {
  background: var(--bg-panel);               /* rgba(13, 17, 23, 0.94) */
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.55);  /* HUGE shadow for dramatic float */
}
```

**Key difference from Tier 1:** The blur is on the **overlay backdrop**, not the modal itself. The modal is just a solid-ish dark panel floating on top of a blurred/dimmed scene.

#### Tier 3: Micro Glass (Small HUD Elements)
Used for **small floating badges** and indicators that sit directly over the 3D scene.

```css
.glass-badge {
  background: rgba(13, 17, 23, 0.85);       /* 85% — slightly more see-through */
  padding: 2px 10px;
  border-radius: 10px;
  font-family: var(--mono);
  font-size: 12px;
  color: var(--text-2);
}
```

**Used for:** Compass bearing labels, scale bar labels, small status indicators. No blur here — just transparency. These are too small for blur to be noticeable.

### How to Apply Glass to ANY Element

**Step-by-step recipe:**

```css
.my-glass-element {
  /* Step 1: Semi-transparent dark background */
  background: rgba(13, 17, 23, 0.94);

  /* Step 2: Blur content behind — BOTH prefixes needed */
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);

  /* Step 3: Subtle light border (makes the edge visible) */
  border: 1px solid rgba(240, 246, 252, 0.1);

  /* Step 4: Shadow for depth */
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);

  /* Step 5: Rounded corners (mandatory for modern glass) */
  border-radius: 12px;
}
```

### Blur Value Guide

| Blur Amount | Visibility | Use Case |
|-------------|-----------|----------|
| `blur(4px)` | Background is slightly soft | Subtle overlay hints |
| `blur(6px)` | Shapes visible, details gone | Full-screen modal backdrops |
| `blur(12px)` | Only color patches visible | Medium panels |
| `blur(24px)` | Almost nothing visible | Persistent side panels, popups |
| `blur(40px+)` | Fully frosted | Not used here, but for heavier effects |

### Opacity Guide

| Opacity | Effect | Used For |
|---------|--------|----------|
| `0.60` on black | Dims background moderately | Modal overlay backdrop |
| `0.85` on dark | Mostly opaque, hint of scene | Small HUD badges |
| `0.94` on dark | Nearly opaque, micro-transparency | Panels, modals, popups |
| `0.025` on white | Barely perceptible lift | Cards ON TOP of glass panels |
| `0.04` on white | Subtle lift (hover state) | Card hover states |
| `0.06` on white | Visible surface | Buttons, key caps, interactive items |

### Layered Depth Stack

The glass effect relies on **stacking multiple transparency layers**:

```
 Background (3D scene, image, or --bg-dark)
   └─ Overlay: rgba(0,0,0,0.60) + blur(6px)         ← dims everything
       └─ Modal: rgba(13,17,23,0.94)                  ← dark panel
           └─ Card: rgba(255,255,255,0.025)            ← barely-white lift
               └─ Badge: rgba(88,166,255,0.08)         ← accent-tinted
```

Each layer adds a tiny amount of white or color on top of the dark base, creating depth without brightness.

### Critical Browser Compatibility Notes

```css
/* ALWAYS include both prefixed and unprefixed */
backdrop-filter: blur(24px);
-webkit-backdrop-filter: blur(24px);   /* Safari, older Chrome */
```

**Fallback for unsupported browsers:**
```css
@supports not (backdrop-filter: blur(1px)) {
  .glass-panel {
    background: rgba(13, 17, 23, 0.98);  /* More opaque fallback */
  }
}
```

### Complete Copy-Paste Glass Component

```html
<!-- Glass panel that can be used as a sidebar, popup, or card container -->
<div style="
  position: fixed;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 400px;
  padding: 24px;
  background: rgba(13, 17, 23, 0.94);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(240, 246, 252, 0.1);
  border-radius: 12px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  color: #e6edf3;
  font-family: 'Inter', sans-serif;
">
  <h2 style="font-size: 17px; font-weight: 700; margin-bottom: 16px;">
    Glass Panel
  </h2>
  <p style="font-size: 13px; color: #8b949e; line-height: 1.55;">
    This panel uses backdrop-filter blur to create a frosted glass effect
    over whatever content sits behind it.
  </p>
</div>
```

### Transition & Animation for Glass Elements

Glass panels should always animate **in** (never just appear):

```css
/* Slide-in panel (from the side) */
.glass-slide {
  transform: translateX(-100%);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.glass-slide.open {
  transform: translateX(0);
}

/* Pop-in modal (from center) */
@keyframes glassPopIn {
  from { opacity: 0; transform: translateY(18px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0)   scale(1); }
}
.glass-modal {
  animation: glassPopIn 0.22s ease-out;
}

/* Fade-in overlay */
@keyframes glassFadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.glass-overlay {
  animation: glassFadeIn 0.18s ease-out;
}
```

---

## 18. Light & Dark Mode — Adapting the Glass System

The original design system is dark-only. This section shows how to **restructure it into a dual-theme system** that works in both light and dark mode while preserving the glassmorphism effect.

### The Core Idea

Glassmorphism works in both modes, but the **colours invert**:

| Property | Dark Mode | Light Mode |
|----------|-----------|------------|
| Base background | Near-black (`#0d1117`) | Near-white (`#f6f8fa`) |
| Panel glass | Black @ 94% opacity | White @ 80% opacity |
| Card surface | White @ 2.5% | Black @ 3% |
| Card border | White @ 6% | Black @ 6% |
| Blur backdrop | Dark content blurs dark | Light content blurs light |
| Text primary | Light text (`#e6edf3`) | Dark text (`#1f2328`) |
| Text secondary | Mid-grey (`#8b949e`) | Mid-grey (`#656d76`) |
| Shadows | Black-heavy, high opacity | Black-light, lower opacity |
| Accent | Works in both — `#58a6ff` (dark) / `#0969da` (light) |

### Step 1: Define Theme Variables with `data-theme`

Use a `data-theme` attribute on `<html>` rather than media queries — this lets users **toggle manually** AND you can still respect system preference as a default.

```css
/* ── Dark theme (default) ─────────────────────── */
:root,
[data-theme="dark"] {
  --bg-dark:     #0d1117;
  --bg-panel:    rgba(13, 17, 23, 0.94);
  --bg-card:     rgba(255, 255, 255, 0.04);
  --accent:      #58a6ff;
  --accent-dim:  rgba(88, 166, 255, 0.15);
  --accent-solid: #58a6ff;
  --text-1:      #e6edf3;
  --text-2:      #8b949e;
  --text-3:      #484f58;
  --border:      rgba(240, 246, 252, 0.1);
  --success:     #3fb950;
  --warning:     #d29922;
  --danger:      #f85149;

  /* Glass-specific tokens */
  --glass-bg:           rgba(13, 17, 23, 0.94);
  --glass-blur:         24px;
  --glass-border:       rgba(240, 246, 252, 0.1);
  --glass-shadow:       0 16px 48px rgba(0, 0, 0, 0.5);
  --glass-shadow-heavy: 0 24px 80px rgba(0, 0, 0, 0.55);
  --overlay-bg:         rgba(0, 0, 0, 0.60);
  --overlay-blur:       6px;

  /* Card layering */
  --card-bg:            rgba(255, 255, 255, 0.025);
  --card-bg-hover:      rgba(255, 255, 255, 0.04);
  --card-border:        rgba(255, 255, 255, 0.06);
  --card-border-hover:  rgba(255, 255, 255, 0.1);

  /* Interactive elements */
  --btn-bg:             rgba(255, 255, 255, 0.05);
  --btn-bg-hover:       rgba(255, 255, 255, 0.06);
  --key-bg:             rgba(255, 255, 255, 0.06);
  --key-border:         rgba(255, 255, 255, 0.12);
  --key-shadow:         0 2px 0 rgba(0, 0, 0, 0.3);

  /* Accent-tinted elements */
  --accent-bg:          rgba(88, 166, 255, 0.08);
  --accent-border:      rgba(88, 166, 255, 0.15);
  --accent-callout-bg:  rgba(88, 166, 255, 0.04);
  --accent-callout-bar: rgba(88, 166, 255, 0.25);

  color-scheme: dark;
}

/* ── Light theme ──────────────────────────────── */
[data-theme="light"] {
  --bg-dark:     #f6f8fa;
  --bg-panel:    rgba(255, 255, 255, 0.80);
  --bg-card:     rgba(0, 0, 0, 0.02);
  --accent:      #0969da;
  --accent-dim:  rgba(9, 105, 218, 0.12);
  --accent-solid: #0969da;
  --text-1:      #1f2328;
  --text-2:      #656d76;
  --text-3:      #8b949e;
  --border:      rgba(31, 35, 40, 0.15);
  --success:     #1a7f37;
  --warning:     #9a6700;
  --danger:      #cf222e;

  /* Glass-specific tokens */
  --glass-bg:           rgba(255, 255, 255, 0.80);
  --glass-blur:         20px;
  --glass-border:       rgba(31, 35, 40, 0.15);
  --glass-shadow:       0 8px 32px rgba(0, 0, 0, 0.12);
  --glass-shadow-heavy: 0 16px 64px rgba(0, 0, 0, 0.15);
  --overlay-bg:         rgba(255, 255, 255, 0.50);
  --overlay-blur:       8px;

  /* Card layering */
  --card-bg:            rgba(0, 0, 0, 0.02);
  --card-bg-hover:      rgba(0, 0, 0, 0.04);
  --card-border:        rgba(31, 35, 40, 0.08);
  --card-border-hover:  rgba(31, 35, 40, 0.15);

  /* Interactive elements */
  --btn-bg:             rgba(0, 0, 0, 0.04);
  --btn-bg-hover:       rgba(0, 0, 0, 0.06);
  --key-bg:             rgba(0, 0, 0, 0.04);
  --key-border:         rgba(31, 35, 40, 0.15);
  --key-shadow:         0 2px 0 rgba(0, 0, 0, 0.08);

  /* Accent-tinted elements */
  --accent-bg:          rgba(9, 105, 218, 0.06);
  --accent-border:      rgba(9, 105, 218, 0.2);
  --accent-callout-bg:  rgba(9, 105, 218, 0.04);
  --accent-callout-bar: rgba(9, 105, 218, 0.3);

  color-scheme: light;
}
```

### Step 2: Respect System Preference as Default

```css
/* Auto-detect OS preference when no data-theme is set */
@media (prefers-color-scheme: light) {
  :root:not([data-theme]) {
    /* paste all light theme values here */
    --bg-dark:     #f6f8fa;
    --bg-panel:    rgba(255, 255, 255, 0.80);
    --glass-bg:    rgba(255, 255, 255, 0.80);
    /* ... all other light tokens ... */
    color-scheme: light;
  }
}
```

This means: use OS preference by default, but `data-theme` attribute always wins.

### Step 3: JavaScript Theme Toggle

```js
// ── Theme manager ────────────────────────────────
function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function getTheme() {
  return localStorage.getItem('theme') || 'system';
}

function applyTheme(choice) {
  // choice: 'light' | 'dark' | 'system'
  localStorage.setItem('theme', choice);

  if (choice === 'system') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', choice);
  }
}

// React hook version
function useTheme() {
  const [theme, setTheme] = useState(getTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Listen for OS changes when in system mode
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => { if (getTheme() === 'system') applyTheme('system'); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return { theme, setTheme };
}
```

### Step 4: Update Components to Use Theme Tokens

Replace all hardcoded `rgba()` values with CSS variables. Before → After:

```css
/* ❌ BEFORE — hardcoded dark-only */
.card {
  background: rgba(255,255,255, 0.025);
  border: 1px solid rgba(255,255,255, 0.06);
}

/* ✅ AFTER — theme-aware */
.card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
}
.card:hover {
  background: var(--card-bg-hover);
  border-color: var(--card-border-hover);
}
```

**Full component mapping:**

```css
/* Glass panel */
.glass-panel {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow);
  border-radius: 12px;
}

/* Overlay */
.overlay {
  background: var(--overlay-bg);
  backdrop-filter: blur(var(--overlay-blur));
}

/* Modal */
.modal {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow-heavy);
  border-radius: 14px;
}

/* Tabs */
.tab {
  color: var(--text-2);
  border-bottom: 2px solid transparent;
}
.tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

/* Card */
.card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
}
.card:hover {
  background: var(--card-bg-hover);
  border-color: var(--card-border-hover);
}

/* Key cap */
.key {
  background: var(--key-bg);
  border: 1px solid var(--key-border);
  box-shadow: var(--key-shadow);
  color: var(--text-2);
  font-family: var(--mono);
}

/* Icon badge */
.icon-badge {
  background: var(--accent-bg);
  border: 1px solid var(--accent-border);
  color: var(--accent);
}

/* Callout */
.callout {
  background: var(--accent-callout-bg);
  border-left: 3px solid var(--accent-callout-bar);
}

/* Close button */
.close-btn {
  background: var(--btn-bg);
  color: var(--text-3);
}
.close-btn:hover {
  background: rgba(255, 80, 80, 0.18);  /* Red hover stays the same in both modes */
  color: #f66;
}
```

### Step 5: Theme Toggle Button Component

```jsx
function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const options = ['light', 'dark', 'system'];
  const icons = { light: '☀️', dark: '🌙', system: '💻' };
  const next = options[(options.indexOf(theme) + 1) % options.length];

  return (
    <button
      className="close-btn"  /* reuses existing button style */
      onClick={() => setTheme(next)}
      title={`Switch to ${next} mode`}
    >
      {icons[theme]}
    </button>
  );
}
```

### Light Mode Glass — Key Differences Explained

| Dark Mode | Light Mode | Why |
|-----------|------------|-----|
| Panel: black @ 94% | Panel: white @ 80% | Light panels need MORE transparency (80%) to feel glassy — at 94% white it looks like a plain white box |
| Overlay: black @ 60% | Overlay: white @ 50% | Light overlays dim with white fog instead of black fog |
| Blur: 24px | Blur: 20px | Light backgrounds need slightly less blur since colours are already muted |
| Shadow: heavy black | Shadow: light black | Shadows in light mode should be subtle — heavy shadows look wrong on white |
| Card: white @ 2.5% | Card: black @ 2% | Cards use the OPPOSITE tint of the base — white shimmer on dark, dark tint on light |
| Borders: white @ 6% | Borders: black @ 8% | Dark borders need slightly higher opacity to be visible on light backgrounds |
| Accent: `#58a6ff` | Accent: `#0969da` | Blue shifts darker for light mode — matches GitHub's Primer light palette |

### Visual Comparison

```
 DARK MODE                              LIGHT MODE
 ┌───────────────────────┐              ┌───────────────────────┐
 │ ██████████████████████ │ #0d1117     │ ░░░░░░░░░░░░░░░░░░░░░ │ #f6f8fa
 │ ┌───────────────────┐ │             │ ┌───────────────────┐ │
 │ │ rgba(13,17,23,.94) │ │ panel      │ │ rgba(255,255,255,.80)│ panel
 │ │ ┌───────────────┐ │ │             │ │ ┌───────────────┐ │ │
 │ │ │ rgba(W, 0.025)│ │ │ card       │ │ │ rgba(B, 0.02) │ │ │ card
 │ │ └───────────────┘ │ │             │ │ └───────────────┘ │ │
 │ └───────────────────┘ │             │ └───────────────────┘ │
 └───────────────────────┘              └───────────────────────┘
  White lifts on dark base               Dark tints on light base
```

### Step 6: Smooth Theme Transition

Add a CSS transition so switching themes isn't jarring:

```css
:root {
  /* Transition all colours smoothly when theme changes */
  transition: background-color 0.3s ease,
              color 0.3s ease;
}

/* Apply transition to major glass elements */
.glass-panel,
.modal,
.card,
.overlay,
.tabs,
.header {
  transition: background 0.3s ease,
              border-color 0.3s ease,
              box-shadow 0.3s ease,
              color 0.3s ease;
}
```

**Warning:** Don't put `transition: all` on the body — this causes `backdrop-filter` to animate, which is janky. Only transition `background`, `color`, `border-color`, and `box-shadow`.

### Complete Light Mode Starter (Copy-Paste HTML)

```html
<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Light Glass UI</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>
  [data-theme="light"] {
    --bg-dark: #f6f8fa;
    --glass-bg: rgba(255,255,255,0.80);
    --glass-border: rgba(31,35,40,0.15);
    --glass-shadow: 0 8px 32px rgba(0,0,0,0.12);
    --card-bg: rgba(0,0,0,0.02);
    --card-border: rgba(31,35,40,0.08);
    --accent: #0969da;
    --text-1: #1f2328;
    --text-2: #656d76;
    --text-3: #8b949e;
    --border: rgba(31,35,40,0.15);
    --font: 'Inter', -apple-system, sans-serif;
    --mono: 'JetBrains Mono', monospace;
    color-scheme: light;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: var(--font);
    background: var(--bg-dark);
    color: var(--text-1);
    min-height: 100vh;
    display: flex; align-items: center; justify-content: center;
    /* Gradient background to show glass effect */
    background: linear-gradient(135deg, #dbeafe 0%, #f6f8fa 40%, #fef3c7 100%);
  }
  .modal {
    display: flex; flex-direction: column;
    width: min(900px, 92vw); max-height: min(680px, 88vh);
    background: var(--glass-bg);
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    border: 1px solid var(--glass-border);
    border-radius: 14px;
    box-shadow: var(--glass-shadow);
    overflow: hidden;
  }
  .header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 24px 14px; border-bottom: 1px solid var(--border);
  }
  .title { font-size: 17px; font-weight: 700; color: var(--text-1); }
  .content { padding: 20px 24px 28px; }
  .card {
    display: flex; gap: 16px; padding: 16px 18px;
    border-radius: 10px;
    background: var(--card-bg);
    border: 1px solid var(--card-border);
  }
  .card-label { font-size: 14px; font-weight: 600; color: var(--text-1); margin-bottom: 4px; }
  .card-desc { font-size: 12.5px; color: var(--text-2); line-height: 1.55; }
</style>
</head>
<body>
  <div class="modal">
    <div class="header"><div class="title">Light Glass Panel</div></div>
    <div class="content">
      <div class="card">
        <div>
          <div class="card-label">Light Mode Glass</div>
          <div class="card-desc">
            White at 80% opacity over a blurred gradient background.
            The same glass structure, just with inverted tint values.
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
```

---

## 19. Summary of Design Tokens

| Token | Purpose | Value |
|-------|---------|-------|
| Page background | `--bg-dark` | `#0d1117` |
| Panel/modal/sidebar surface | `--bg-panel` | `rgba(13,17,23,0.94)` |
| Card lift | - | `rgba(255,255,255, 0.025)` base, `0.04` hover |
| Card border | - | `rgba(255,255,255, 0.06)` base, `0.1` hover |
| Border lines | `--border` | `rgba(240,246,252, 0.1)` |
| Accent color | `--accent` | `#58a6ff` |
| Accent backgrounds | - | `rgba(88,166,255, 0.08)` |
| Overlay dimming | - | `rgba(0,0,0,0.60)` + `backdrop-filter: blur(6px)` |
| Modal shadow | - | `0 24px 80px rgba(0,0,0,0.55)` |
| Modal radius | - | `14px` |
| Card radius | - | `10px` |
| Button/key radius | - | `6–8px` |
| Primary font | `--font` | Inter |
| Mono font | `--mono` | JetBrains Mono |

The design identity comes from the **extreme subtlety of the white-on-dark layering** — cards are only 2.5% white over a 94%-opaque dark panel, with 6% white borders. This creates a depth hierarchy that feels sophisticated without being loud. Combined with the blue accent (`#58a6ff`), monospace keycaps, and smooth micro-animations, it produces a **developer-tool / scientific-instrument aesthetic**.
