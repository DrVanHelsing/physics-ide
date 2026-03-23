# Physics IDE — Technical Architecture & Institutional Integration Guide

> **Version:** 1.0 · **Date:** March 2026  
> **Project:** Physics IDE — Browser-Based 3D Physics Simulation Environment  
> **Institution target:** University of the Western Cape (UWC) — iKamva (Sakai LMS)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technical Architecture](#2-technical-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Full Source File Tree](#4-full-source-file-tree)
5. [Build System & Deployment](#5-build-system--deployment)
6. [Security Considerations](#6-security-considerations)
7. [Sustainability Assessment](#7-sustainability-assessment)
8. [UWC iKamva / Sakai Integration](#8-uwc-ikamva--sakai-integration)
9. [What Needs to Change for Full Sakai Compatibility](#9-what-needs-to-change-for-full-sakai-compatibility)
10. [Data Privacy & POPIA Compliance](#10-data-privacy--popia-compliance)
11. [Accessibility & Inclusivity](#11-accessibility--inclusivity)
12. [Recommended Next Steps](#12-recommended-next-steps)

---

## 1. Project Overview

Physics IDE is a **browser-based, zero-install 3D physics simulation environment** designed for undergraduate physics and engineering education. It allows students to construct, run, and debug physically accurate 3D simulations entirely in the browser — no local Python or VPython installation required.

### 1.1 Core Capabilities

| Capability | Description |
|---|---|
| **Block-based editor** | Drag-and-drop visual programming via Google Blockly v11. Generates VPython code automatically. |
| **Code editor** | Monaco Editor (VS Code engine) for direct VPython/Python authoring with syntax highlighting. |
| **3D simulation engine** | GlowScript/VPython 3.2 running inside a sandboxed iframe — full WebGL 3D rendering. |
| **Debug mode** | Step-through execution, breakpoints, execution highlight, pause/resume, variable trace recording. |
| **Live trace table** | Real-time variable monitoring with sparklines, delta, min/max, rolling 60-point history, CSV export. |
| **Export suite** | Export to `.py`, `.xml` (Blockly workspace), PDF (blocks + code), screenshot, clipboard copy. |
| **Precoded examples** | Three complete physics simulations: Projectile Motion, Spring-Mass Oscillator, Electric Field. |
| **Auto-save** | Workspace persistently auto-saved to `localStorage` every 2 seconds. |
| **Theme** | VS Code-inspired dark/light theme toggle with `localStorage` persistence. |

### 1.2 Intended Users

- **Students**: Build simulations from blocks without writing code; transition to code mode as confidence grows.
- **Educators**: Assign template simulations; students modify parameters and observe physical outcomes.
- **Junior developers**: Extend the block library (VPython blocks defined in `blocklyGenerator.js`).

---

## 2. Technical Architecture

### 2.1 Architectural Pattern

Physics IDE uses a **React Context + Custom Hooks** layered architecture. State is owned exclusively by context providers; UI components and hooks consume it. There is no Redux, no external state library, and no backend.

```
┌─────────────────────────────────────────────────────────┐
│                        App.js                           │
│  ThemeProvider > SimulationProvider > DebugProvider >   │
│  TraceProvider > ErrorBoundary > IDELayout              │
└─────────────────────────────────────────────────────────┘
                           │
                    IDELayout.js
                    (orchestrator)
          ┌────────────────┼────────────────┐
     useSimulation    useDebug          useExport
     useTrace         useSplitPane      useLocalStorage
          │
  ┌───────┼───────────────────────┐
  │       │                       │
Toolbar  BlocklyWorkspace      GlowCanvas
          │                    (iframe host)
       CodeEditor             TraceTable
          │
       DebugMode
```

### 2.2 Context Layer (State Management)

| Context | File | Purpose |
|---|---|---|
| `ThemeContext` | `src/contexts/ThemeContext.js` | VS Code theme toggle, `localStorage` persistence, `data-theme` on `<html>` |
| `SimulationContext` | `src/contexts/SimulationContext.js` | Core IDE state: mode, running status, editor content, auto-save, zoom, viewport, beginnerMode |
| `DebugContext` | `src/contexts/DebugContext.js` | Debug mode flag, breakpoints (Set + ref), `executingBlockId` |
| `TraceContext` | `src/contexts/TraceContext.js` | traceData Map, recording state, rolling 60-point history, delta/min/max per variable |

### 2.3 Hook Layer (Business Logic)

| Hook | File | Responsibility |
|---|---|---|
| `useSimulation` | `src/hooks/useSimulation.js` | Run/stop/reset, mode change, zoom, workspace callbacks, start-menu selection, import, clear |
| `useDebug` | `src/hooks/useDebug.js` | Enter/exit debug mode, pause/resume/step, breakpoint management |
| `useTrace` | `src/hooks/useTrace.js` | Wires `window.__physide_trace_cb`, debounced postMessage listener, recording controls |
| `useExport` | `src/hooks/useExport.js` | Export handlers: `.py`, `.xml`, PDF (blocks + code), screenshot, clipboard copy |
| `useSplitPane` | `src/hooks/useSplitPane.js` | Drag-to-resize divider (15–85% clamp), Blockly resize on layout change |
| `useLocalStorage` | `src/hooks/useLocalStorage.js` | Generic `localStorage`-backed `useState` |

### 2.4 Component Layer (Rendering)

| Component | File | Role |
|---|---|---|
| `IDELayout` | `src/components/layout/IDELayout.js` | Main render orchestrator — calls all hooks, renders start menu / debug / IDE shell |
| `Toolbar` | `src/components/Toolbar.js` | Top navigation bar with run/stop/export/debug/theme controls |
| `BlocklyWorkspace` | `src/components/BlocklyWorkspace.js` | Blockly editor host, toolbox XML, block search bar, dark/light theme injection |
| `CodeEditor` | `src/components/CodeEditor.js` | Monaco Editor integration with VPython syntax |
| `GlowCanvas` | `src/components/GlowCanvas.js` | Sandboxed `<iframe>` viewport for GlowScript/VPython runtime |
| `DebugMode` | `src/components/DebugMode.js` | Full-screen debug overlay: pause/step/breakpoints/execute-highlight/recording |
| `TraceTable` | `src/components/TraceTable.js` | Live variable trace table — sparklines, pin, delta, CSV export, search |
| `StartMenu` | `src/components/StartMenu.js` | Template card grid with filtering (blocks / code / all) |
| `ModeToggle` | `src/components/ModeToggle.js` | Blocks ↔ Code mode switch with confirmation when workspace has content |
| `HelpPage` | `src/components/HelpPage.js` | Full-screen searchable documentation page |
| `ErrorBoundary` | `src/components/common/ErrorBoundary.js` | React error boundary to gracefully catch render errors |
| `VariableDialog` | `src/components/VariableDialog.js` | Custom modal replacing browser `prompt`/`alert`/`confirm` |

### 2.5 Utility Layer

| Module | File | Purpose |
|---|---|---|
| Block definitions | `src/utils/blockly/blocklyGenerator.js` | All custom VPython block definitions + Python code generators (~1,600 LOC) |
| Trace registry | `src/utils/blockly/traceRegistry.js` | Mutable array populated during code generation; consumed by glowRunner |
| GlowScript runner | `src/utils/runner/glowRunner.js` | iframe runtime: run/stop/pause/resume/step/setBreakpoints |
| Code instrumentor | `src/utils/runner/instrumentor.js` | Transforms raw Python → debug-instrumented Python (entry points for each line) |
| PDF export | `src/utils/export/pdfExport.js` | Block diagram and code PDF generation via jsPDF + html2canvas |
| File export | `src/utils/export/exportUtils.js` | Save `.py` and `.xml` files via browser download |
| Dialog service | `src/utils/export/dialogService.js` | `registerDialogService`, `prompt`, `alert`, `confirm`, `promptFileName` |
| Syntax highlighter | `src/utils/export/syntaxHighlighter.js` | Token-based Python syntax highlighter for PDF export |
| Storage | `src/utils/storage.js` | Wrapper around `localStorage` with JSON serialization |
| Block templates | `src/utils/blockTemplates.js` | Pre-built Blockly workspace XML for starter templates |
| Precoded examples | `src/utils/precodedExamples.js` | Three complete VPython simulation code strings |
| Constants | `src/constants/index.js` | App-wide configuration constants |

### 2.6 How the Simulation Executes

1. User presses **Run**. `useSimulation` calls `runPython(code, traceRegistry)`.
2. `glowRunner.js` injects the VPython code into a sandboxed `<iframe>` pointing to `glowscript.org`.
3. GlowScript compiles and executes the VPython in the iframe using WebGL.
4. If debug mode is active, `instrumentor.js` transforms the code first — each line gets a `__physide_trace_cb(lineNo, {vars})` call injected, and the runner intercepts these via `window.__physide_trace_cb`.
5. The trace callback either records variable data into `TraceContext` or pauses execution at a breakpoint.

---

## 3. Technology Stack

### 3.1 Runtime Dependencies

| Library | Version | Source | Purpose |
|---|---|---|---|
| React | 18.3.1 | npm | UI framework |
| React DOM | 18.3.1 | npm | DOM renderer |
| jsPDF | 4.1.0 | npm | PDF generation |
| html2canvas | 1.4.1 | npm | Screenshot / canvas capture for PDF |
| Google Blockly | v11 | CDN (unpkg) | Visual block programming editor |
| Monaco Editor | 0.45.0 | CDN (unpkg) | Code editor (VS Code engine) |
| GlowScript / VPython | 3.2 | CDN (glowscript.org) | 3D physics simulation runtime |

### 3.2 Build Tools

| Tool | Version | Purpose |
|---|---|---|
| Create React App (react-scripts) | 5.0.1 | Build toolchain, dev server, bundler (webpack 5) |
| Node.js | ≥ 18 (tested 20.19.2) | Build-time JavaScript runtime |
| Vercel CLI | 50.32.5 | Optional deployment tooling |

### 3.3 CDN Dependency Risk

The three CDN-loaded libraries (Blockly, Monaco, GlowScript) are fetched at **browser load time** from external servers. This has implications:

- **Availability**: If any CDN is unreachable (network issues, institutional firewall), the IDE degrades or fails to load.
- **Versioning**: CDN URLs are pinned to specific versions in `public/index.html`, mitigating unexpected breaking changes.
- **Firewall**: University networks may block `unpkg.com` or `glowscript.org`. See §8 for mitigation.

### 3.4 Browser Requirements

| Requirement | Minimum |
|---|---|
| Browser | Chrome 90+, Firefox 88+, Edge 90+, Safari 15+ |
| WebGL | Required (for VPython 3D rendering) |
| JavaScript | ES2020+ |
| `localStorage` | Required (auto-save + theme preference) |
| Internet | Required at runtime (CDN dependencies) |

---

## 4. Full Source File Tree

```
src/
├── App.js                              Slim Context provider shell (~30 LOC)
├── index.js                            React root entry point
├── styles.css                          Global CSS (~800 LOC)
│
├── constants/
│   └── index.js                        App-wide constants (zoom, split, trace, autosave)
│
├── contexts/
│   ├── index.js                        Barrel re-export
│   ├── ThemeContext.js                 VS Code dark/light theme
│   ├── SimulationContext.js            Core IDE state (mode, run, editor, auto-save)
│   ├── DebugContext.js                 Debug mode, breakpoints, executing block ID
│   └── TraceContext.js                 Variable trace data, recording, rolling history
│
├── hooks/
│   ├── useLocalStorage.js              Generic localStorage-backed useState
│   ├── useTrace.js                      postMessage/trace callback wiring
│   ├── useDebug.js                     Debug enter/exit/step/breakpoints
│   ├── useSimulation.js                Run/stop/reset/mode/import/zoom
│   ├── useExport.js                    Export to py/xml/PDF/screenshot
│   └── useSplitPane.js                 Drag-to-resize split panel
│
├── components/
│   ├── layout/
│   │   └── IDELayout.js                Main render orchestrator
│   ├── common/
│   │   └── ErrorBoundary.js            React error boundary
│   ├── Toolbar.js                       Top toolbar (run/stop/export/debug/help)
│   ├── BlocklyWorkspace.js             Blockly editor + search bar + toolbox
│   ├── CodeEditor.js                   Monaco code editor
│   ├── GlowCanvas.js                   Sandboxed VPython iframe viewport
│   ├── DebugMode.js                    Full-screen debug overlay
│   ├── TraceTable.js                   Live variable trace table
│   ├── StartMenu.js                    Template/example selection screen
│   ├── ModeToggle.js                   Blocks ↔ Code mode switch
│   ├── HelpPage.js                     Full-screen searchable documentation
│   ├── Icons.js                        SVG icon components
│   └── VariableDialog.js               Custom modal (prompt/alert/confirm)
│
└── utils/
    ├── storage.js                      localStorage JSON wrapper
    ├── blockTemplates.js               Blockly workspace XML templates
    ├── precodedExamples.js             Three complete VPython examples
    ├── blockly/
    │   ├── index.js                    Barrel
    │   ├── blocklyGenerator.js         Block definitions + Python generators (~1,600 LOC)
    │   └── traceRegistry.js            Mutable trace registry
    ├── runner/
    │   ├── index.js                    Barrel
    │   ├── glowRunner.js               iframe runtime management
    │   └── instrumentor.js             Python debug instrumentation
    └── export/
        ├── index.js                    Barrel
        ├── dialogService.js            Custom dialog registration
        ├── exportUtils.js              .py / .xml file save
        ├── pdfExport.js                jsPDF + html2canvas PDF generation
        └── syntaxHighlighter.js        Token-based Python syntax highlighter
```

---

## 5. Build System & Deployment

### 5.1 Local Development

```bash
# Clone / navigate to project directory
cd "Physics IDE"

# Install npm dependencies
npm install

# Start development server (hot-reload on http://localhost:3000)
npm start

# Production build (outputs to build/)
npm run build
```

### 5.2 Vercel Deployment

The project is configured for **Vercel** (the `vercel` CLI package is a listed dependency). Deployment is a single command:

```bash
# Deploy to Vercel (requires Vercel account + CLI login)
npx vercel --prod
```

Vercel auto-detects Create React App projects. The build output (`build/`) is served as a static site. A custom domain can be assigned from the Vercel dashboard.

#### Current Build Stats (production)
| Metric | Value |
|---|---|
| Main JS bundle (gzip) | ~249 kB |
| CSS bundle (gzip) | ~9 kB |
| Build time | ~60 seconds |
| CDN-loaded libraries | Blockly v11, Monaco 0.45, GlowScript 3.2 |

### 5.3 vercel.json — Required Configuration

For Sakai/iframe embedding and correct security headers, create a `vercel.json` in the project root:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://www.glowscript.org https://cdnjs.cloudflare.com; frame-src 'self' https://www.glowscript.org; connect-src 'self' https://www.glowscript.org; style-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: blob:; font-src 'self' data: https://unpkg.com;"
        },
        {
          "key": "X-Frame-Options",
          "value": "ALLOWALL"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        }
      ]
    }
  ]
}
```

> **Note:** `X-Frame-Options: ALLOWALL` is required for Sakai to embed the IDE in an iframe. If a more restrictive policy is needed, replace with `ALLOW-FROM https://ikamva.uwc.ac.za` (though `ALLOW-FROM` is deprecated; use a `frame-ancestors` CSP directive instead for modern browser support).

---

## 6. Security Considerations

### 6.1 Threat Model

Physics IDE is a **student-facing educational tool** with no user accounts, no server-side state, and no sensitive data processing. The primary security surfaces are:

| Surface | Risk | Mitigation |
|---|---|---|
| VPython code execution | Students run arbitrary Python in the iframe | Sandboxed iframe (`sandbox` attribute); GlowScript runs in its own origin |
| localStorage | Simulation workspace saved locally | No sensitive data stored; data is purely educational content |
| CDN dependencies | Supply-chain risk (CDN compromise) | Version-pinned CDN URLs; Subresource Integrity (SRI) hashes can be added |
| Iframe embedding in Sakai | Clickjacking potential | `frame-ancestors` CSP header restricts who can embed |
| Cross-origin postMessage | Trace data from iframe | Origin validation in trace message listener |

### 6.2 iframe Sandbox Isolation

The GlowCanvas component renders VPython in a sandboxed `<iframe>` pointing to `glowscript.org`. The iframe prevents:
- Access to the parent `window` (different origin)
- Access to cookies or `localStorage` of the parent
- Network requests to arbitrary endpoints (GlowScript's own CSP applies within the iframe)

### 6.3 Subresource Integrity (SRI) — Recommended

To harden CDN dependency loading, add `integrity` and `crossorigin` attributes to CDN script tags in `public/index.html`:

```html
<script
  src="https://unpkg.com/blockly@11/blockly_compressed.js"
  integrity="sha384-[HASH]"
  crossorigin="anonymous"
></script>
```

SRI hashes can be generated at [srihash.org](https://www.srihash.org/).

### 6.4 HTTPS

Vercel enforces HTTPS automatically on all deployments. HTTPS is **mandatory** for:
- Secure `localStorage` in some browser configurations
- GlowScript CDN (served over HTTPS)
- Sakai LTI 1.3 launch requests (must be HTTPS)

### 6.5 No Authentication & No Server

Physics IDE has **no login system**. This is intentional:
- Student work is saved only to their own browser `localStorage`, not a server.
- No student data leaves the browser (except the GlowScript iframe, which only receives VPython code).
- If student work persistence across sessions/devices is needed, a backend or Sakai-integrated save mechanism must be added (see §9).

---

## 7. Sustainability Assessment

### 7.1 Dependency Longevity

| Dependency | Longevity Outlook | Notes |
|---|---|---|
| React 18 | High | Meta-backed; major releases have long support windows. React 19 is backwards compatible. |
| Google Blockly v11 | High | Google-maintained, active development, used in Scratch-style tools worldwide. |
| Monaco Editor | High | Microsoft-backed (VS Code engine), actively maintained. |
| GlowScript / VPython 3.2 | Medium | Maintained by the VPython open-source community; not a commercial entity. Pinned at 3.2. |
| jsPDF | Medium–High | Active open-source project, widely used. |
| Create React App | Low–Medium | CRA is in maintenance mode (no new features). Migration to Vite is recommended long-term. |
| Vercel (hosting) | High | Commercial hosting platform with a generous free tier; alternative: Netlify, GitHub Pages. |

### 7.2 Maintenance Burden

- **No backend** = no server maintenance, no database to manage, no runtime infrastructure costs.
- **CDN-hosted libraries** = no need to bundle Blockly or Monaco into the npm build (keeps bundle size down), but introduces a runtime CDN dependency.
- **CSS architecture** = all styles in a single `styles.css` (~800 LOC). This works for the current scale but should be migrated to CSS Modules or Tailwind as the component count grows.
- **Block library extensibility** = adding new VPython blocks requires editing `blocklyGenerator.js`, which is self-contained and well-commented.

### 7.3 Recommended Migration Path (Future)

| Current | Recommended Migration | When |
|---|---|---|
| Create React App | Vite + React | When CRA falls further behind; Vite is ~10× faster for development |
| CDN script tags | Self-hosted or npm bundles | If CDN reliability is a concern for institutional deployment |
| Single `styles.css` | CSS Modules per component | When number of components > ~25 |
| No auth / localStorage only | Backend (e.g., Supabase or Sakai REST API) for persistent save | If cross-device student work persistence is required |

### 7.4 Cost Model

| Service | Cost |
|---|---|
| Vercel free tier | $0 — covers a low-traffic educational deployment |
| Vercel Pro | ~$20/month per team — recommended for production/institutional use |
| CDN libraries | $0 (unpkg, glowscript.org are free) |
| Development | Internal development cost only (no licensing fees) |

---

## 8. UWC iKamva / Sakai Integration

### 8.1 UWC's Learning Management System

The **University of the Western Cape (UWC)** operates **iKamva** as its institutional LMS. iKamva is the UWC-branded instance of **Sakai** (open-source LMS), accessible at:

> **https://ikamva.uwc.ac.za/portal**

Sakai supports two primary methods for embedding external web tools:

| Method | Description | Complexity |
|---|---|---|
| **Web Content Tool** | Embeds an external URL in an `<iframe>` within a Sakai site lesson | Low |
| **LTI 1.1 (Basic LTI)** | Launches an external tool with user context (user ID, course ID, role) passed via signed POST | Medium |
| **LTI 1.3 (Advantage)** | Modern OAuth 2.0-based LTI with deep linking, grading writeback, and NRPS | High |

Physics IDE, as a **stateless SPA**, is best suited for **Web Content Tool** embedding (lowest friction) with a pathway to LTI 1.3 for richer integration.

### 8.2 Web Content Tool Embedding

The simplest integration: an instructor adds a Sakai **Web Content** tool to their course site with the Physics IDE URL.

**Steps for an instructor:**
1. Navigate to the Sakai course site.
2. Select `Site Info` → `Manage Tools` → enable **Web Content**.
3. Add a new Web Content item; paste the Physics IDE URL (e.g., `https://physics-ide.vercel.app`).
4. Students access the tool directly from the course navigation menu.

**Technical requirements for this to work:**
- The Physics IDE server must send `X-Frame-Options: ALLOWALL` or a matching `Content-Security-Policy: frame-ancestors https://ikamva.uwc.ac.za` header (see `vercel.json` in §5.3).
- Physics IDE must be served over HTTPS (✓ Vercel handles this).
- CDN sources (`unpkg.com`, `glowscript.org`) must be reachable from student networks.

### 8.3 LTI 1.3 Integration Path

For richer integration (grade passback, user identification, institutional SSO), Physics IDE would need an LTI 1.3 implementation:

| Component | Required Work |
|---|---|
| LTI launch endpoint | Backend service to receive `id_token` from Sakai; validate JWT; return redirect to Physics IDE with user context |
| Platform registration | Register Physics IDE as an LTI tool in Sakai's External Tools admin panel |
| Deep linking (optional) | Allow instructors to pre-configure specific simulation templates from within Sakai |
| Grade passback (optional) | Return a completion/score to Sakai's gradebook via Assignment & Grades Service |

Since Physics IDE currently has **no backend**, LTI 1.3 would require a lightweight server (e.g., a Vercel serverless function or Node.js service) to handle the OIDC launch flow.

> **Recommended approach for 2025/2026:** Start with Web Content Tool embedding (zero development effort). Plan LTI 1.3 for a subsequent semester if grade integration or user tracking is needed.

### 8.4 Firewall & Network Considerations

Institutional networks sometimes block external CDN domains. The following domains must be reachable from student browsers for Physics IDE to function:

| Domain | Purpose | Port |
|---|---|---|
| `unpkg.com` | Google Blockly v11 + Monaco Editor CDN | 443 (HTTPS) |
| `www.glowscript.org` | VPython 3.2 simulation runtime | 443 (HTTPS) |
| `physics-ide.vercel.app` (or custom domain) | Physics IDE app itself | 443 (HTTPS) |

**Action required:** Liaise with UWC ICT to confirm these domains are not blocked on campus networks and eduroam. If they are blocked, self-hosting the CDN assets (see §9.3) is the resolution.

### 8.5 Sakai / iKamva Version Alignment

Sakai's active community releases major versions annually. Sakai 25 (2025) introduced LTI 1.3 Advantage improvements. iKamva's current version is not publicly documented, but UWC typically runs a version supported by the Sakai Foundation. LTI 1.1 is supported in all Sakai versions from 2.9 onwards; LTI 1.3 from Sakai 20 onwards.

---

## 9. What Needs to Change for Full Sakai Compatibility

### 9.1 Immediate (Zero Backend, Web Content Tool)

These changes are **already implemented or trivial** to implement:

- [x] Physics IDE is deployed on Vercel (HTTPS)
- [ ] **Add `vercel.json`** with `X-Frame-Options: ALLOWALL` and appropriate CSP headers
- [ ] **Test embedding** in a Sakai sandbox/dev instance of iKamva
- [ ] **Confirm CDN accessibility** from UWC campus/eduroam networks

### 9.2 Short-Term (Enhanced Integration)

| Change | Effort | Benefit |
|---|---|---|
| Custom domain (e.g., `physics.uwc.ac.za`) | Low (Vercel dashboard) | Branded, stable URL for Sakai link |
| SRI hashes on CDN scripts | Low (1–2 hours) | Hardens supply-chain security |
| Offline-first / self-hosted CDN assets | Medium (1–3 days) | Eliminates CDN dependency, works on restricted networks |
| `localStorage` → exportable session files | Low | Students can download/upload their workspace manually |

### 9.3 Medium-Term (LTI 1.3 Integration)

| Component | Effort | Notes |
|---|---|---|
| LTI 1.3 launch handler (serverless function) | Medium (2–5 days) | Validates `id_token` from Sakai; passes `user_id`, `course_id`, `role` to the SPA via URL params or cookie |
| Per-user workspace persistence | Medium (1 week) | Requires a key-value store; Supabase (free tier) or UWC-hosted database |
| Grade passback | High (1–2 weeks) | Requires Sakai Assignment & Grades Service integration; only relevant if Physics IDE is formally assessed |
| Institutional SSO (SAML/OAuth) | High | Handled at LTI layer; no change to React SPA |

### 9.4 Accessibility Compliance

UWC's institutional policies and Sakai's own commitment require WCAG 2.1 AA accessibility. Current status:

| Area | Status | Action Needed |
|---|---|---|
| Keyboard navigation | Partial | Toolbar buttons are keyboard-accessible; Blockly drag interactions are mouse-only |
| Screen reader support | Minimal | ARIA labels added to toolbar; DebugMode and TraceTable need `aria-live` regions |
| Color contrast | Pass (dark mode); needs audit (light mode) | Run WCAG contrast checker on light theme |
| Mobile / touch | Not optimised | Blockly and split-pane work best on desktop; mobile layout needs a dedicated view |

---

## 10. Data Privacy & POPIA Compliance

Physics IDE stores **no personal data** on any server. All user-generated content (simulation code, workspace XML) is stored exclusively in the student's own browser `localStorage`. As such:

- **POPIA (South Africa's Protection of Personal Information Act)** compliance is inherently met for the current version — no personal information is collected, processed, or stored by the application.
- If LTI integration is added and user IDs are handled, a **POPIA impact assessment** and **data processing agreement** with the LTI backend provider would be required.
- UWC's existing Sakai data processing agreements cover student interaction data within iKamva; Physics IDE data (the student's simulation code) does not flow into Sakai unless grade passback is implemented.

---

## 11. Accessibility & Inclusivity

### 11.1 Dual Editing Modes

The block editor (Blockly) is specifically designed for learners who are not comfortable with syntax — it eliminates syntax errors entirely. The code editor (Monaco) provides a direct Python authoring path for more advanced students. This dual-mode design aligns with **Universal Design for Learning (UDL)** principles:

- **Multiple means of representation**: 3D visual simulation + code + block diagram.
- **Multiple means of action and expression**: drag blocks OR type code OR use a precoded example.
- **Multiple means of engagement**: difficulty levels (beginner mode reduces block count), debug mode for deep exploration.

### 11.2 Beginner Mode

Blockly **Beginner Mode** reduces the toolbox to essential physics blocks only (Starter, Objects, Motion, Control). This is toggled via the toolbar and is specifically designed for first-year students or those new to programming.

### 11.3 South African Context

UWC has a diverse, multilingual student body. Physics IDE is currently English-only. For enhanced inclusivity:
- Consider adding Afrikaans and isiXhosa translations for UI labels (React's `i18n` libraries support this).
- Ensure the tool works well on lower-bandwidth connections (CDN assets = ~3 MB first load; self-hosting could improve this).

---

## 12. Recommended Next Steps

### Immediate Priority (Before Semester Integration)

1. **Create `vercel.json`** with iframe-allow and CSP headers (1–2 hours).
2. **Test in iKamva sandbox** — contact UWC ICT for a test Sakai instance or test with a local Sakai Docker image.
3. **Confirm CDN domains are whitelisted** on UWC campus networks.
4. **Add `vercel.json` custom domain** (e.g., `physics.uwc.ac.za`) for a stable, branded URL.

### Before Formal Classroom Use

5. **Run WCAG contrast audit** on light theme.
6. **Add ARIA labels** to trace table and debug mode controls.
7. **Write an educator guide** (see companion PDF documentation).
8. **Test on low-end hardware** (Chromebooks, older laptops) — the 249 kB JS bundle should perform well, but WebGL on old GPUs can be slow.

### Future Semester (Enhancement)

9. **LTI 1.3 serverless endpoint** for grade integration.
10. **Per-user cloud save** (Supabase free tier recommended).
11. **SRI hashes** added to CDN scripts.
12. **Vite migration** if CRA build times become problematic.

---

*This document was generated for the Physics IDE project. Last updated: March 2026.*
