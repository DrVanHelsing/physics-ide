# Code-mode breakpoints — design

**Date:** 2026-08-23
**Status:** approved, ready for an implementation plan
**Supersedes:** the deletion note at `frontend/src/components/CodeEditor.js:8-16`, which recorded the dead gutter and said wiring code-mode breakpoints properly "is new design work, not a loose end". This is that work.

---

## 1. Why this is smaller than it looks

The Plan-4 close-out described the remaining work as "two chains, not a prop: populate `breakableIds` in text mode, and teach `breakableIdsFromRegistry()` about the instrumentor's `codeTraceEntries`." That framing is nearly right but overstates the depth, and one of the two names does not exist (`breakableIdsFromRegistry()` is not a function in this tree; `breakableIds()` in `utils/blockly/traceRegistry.js` is).

**The runtime is already complete and already correct for code mode.** Verified against source:

| Link | Where | State |
|---|---|---|
| Python instrumented with per-site probes | `utils/runner/instrumentor.js` | works, and is a **pure function** |
| Each site gets a stable id | `instrumentor.js:188-189` — `blockId = \`line_${lineNum}\`` | works |
| Compiled JS gains a pause check keyed on that id | `utils/runner/glowRunner.js:471-497` — `bid = entry.blockId` | works |
| Breakpoint set seeded **before** `eval` | `glowRunner.js:424-428` | works |
| Pause acknowledged back to the UI | `__phpause` with `b: bid` | works |
| Code-mode runs actually go through the instrumentor | `glowRunner.js:610` (`traceRegistry.length === 0`) | works |

`glowRunner`'s injection reads `window.__physide_breakpoints.has('line_16')`. Nothing has ever put `line_16` into that set, because nothing computes it. That is the entire gap.

**Crucially, `lineNum = i + 1`** (`instrumentor.js:187`, over `pythonSource.split('\n')`) — **1-based, identical to Monaco's line numbering.** The id ↔ editor-line mapping is the identity function. No offset table, no source map.

---

## 2. Scope

### In scope

Project types whose Python buffer is **editable**:

| `projectType` | blocks | code | code editable? | breakpoints live on |
|---|---|---|---|---|
| `code_blank` | locked out (`lockedMode="blocks"`) | only mode | **yes** | **lines** |
| `code_template` | read-only mirror | editable | **yes** | **lines** |
| `custom` | authoring mode | "Code View Only", `readOnly` | no | blocks |
| `block_template` | authoring mode | read-only mirror | no | blocks |

Derived from `IDELayout.js:419-423` and `factory.js` / `schema.js:18`.

### Out of scope

- **Widening the instrumentor.** Only assignment sites are probed; `sphere(...)`, `rate(60)`, `while`, `if` are deliberately skipped (`instrumentor.js` `SKIP_CONSTRUCTORS` / `BUILTINS`). Widening it would change generated Python for block projects too, which depend on this module. The affordance in §4.2 makes the limit visible instead.
- **Block-mode behaviour.** Unchanged in every respect.
- **The read-only code view** on `custom` / `block_template`. No gutter there.
- Conditional breakpoints, hit counts, logpoints.

### The id spaces cannot collide

`breakpoints` is a single flat `Set` in `DebugContext`. Block ids are Blockly UUIDs; code ids are `line_N`. They never coexist as *authored* sources in one project: where the code buffer is editable, blocks are either locked out or a read-only mirror, and `ReadOnlyBlockly`'s debug role was deleted in Plan 4. **One shared `Set` stays correct and needs no partitioning.** This is a fact to preserve, not an invariant to enforce — §7 records the test that pins it.

---

## 3. Decisions taken

| Decision | Choice | Rationale |
|---|---|---|
| Which lines can hold a breakpoint | Only traceable (assignment) sites, **shown** in the gutter | No instrumentor change; mirrors the block editor, which already draws a hollow marker on breakable blocks in debug mode |
| A breakpoint whose line stops being traceable | **Kept, greyed, does not fire** | VS Code's "unverified breakpoint". Commenting a line out to test something must not silently lose the student's place; un-commenting restores it |
| Breakpoint identity across edits | **Monaco decorations with sticky ranges**; `line_N` derived at run time from where decorations actually sit | Line numbers are positional — inserting a line above would otherwise silently repoint every breakpoint below it |
| When breakable lines are computed | Debounced (~300 ms), **only while debug mode is on** | Matches the block editor exactly, where breakable markers render only in debug mode. Avoids instrumenting on every keystroke |
| Scope | `code_blank` + `code_template` only | The only types with an editable buffer |

---

## 4. Architecture

Four units, each independently testable.

### 4.1 `useCodeBreakables` — a new hook

**Does:** derives the set of currently-traceable line numbers from the editor buffer.
**Interface:** `useCodeBreakables({ pythonCode, enabled })` → nothing returned; writes through `setBreakableIds` from `DebugContext`.
**Depends on:** `instrumentPythonForDebug` (pure), `DebugContext`.

```
enabled = debugMode && mode === "text" && CODE_BP_TYPES.has(projectType)
```

`CODE_BP_TYPES` is a new two-member constant (`code_blank`, `code_template`) — see §2. It is a constant rather than a negation of the read-only flags so that adding a project type is a deliberate act, not an accident of how `isCustom`/`isReadOnlyView` happen to combine.

On a debounced change it calls `instrumentPythonForDebug(pythonCode)`, maps `entries` → `new Set(entries.map(e => e.blockId))`, and sets it. Watch entries (`scope: "watch"`, id `watch_N`) are **excluded** — they are synthesized probes with no line in the buffer.

`enabled === false` clears the set, so leaving debug mode or switching to a block project cannot leave stale ids behind.

Because `instrumentPythonForDebug` is pure and already exported, this hook is the whole of "chain one".

### 4.2 The gutter — `CodeEditor.js`

Enable `glyphMargin: true` in the `monaco.editor.create` options (`CodeEditor.js:47-58`), and render four decoration states:

**Use the names that were deleted, not new ones.** `styles/workspace.css:311-315` carries a comment naming exactly what was removed and why:

> The Monaco glyph-margin debug decorations that used to live here (`.dbg-glyph-bp` / `.dbg-glyph-breakable` / `.dbg-glyph-executing`, plus the `.dbg-executing-line` row highlight) are gone with the code-mode breakpoint gutter that was their only consumer.

| State | Class | Appearance |
|---|---|---|
| breakable, not set | `.dbg-glyph-breakable` | hollow ring, dim |
| set and will fire | `.dbg-glyph-bp` | solid, `--red` |
| set but not currently traceable | `.dbg-glyph-unverified` (new — the greying rule did not exist before) | hollow, `--text-muted` |
| paused on this line | `.dbg-glyph-executing` + `.dbg-executing-line` | row highlight |

Styling goes in **`styles/workspace.css`**, beside the live `.bp-available` / `.block-executing` block rules at `:299-311` — those are the sibling treatments and the file the deleted rules came from. (`styles/debug.css` exists but owns the debug *drawer*, not markers.)

**That comment block must be replaced, not left in place.** It currently asserts these decorations are gone and that "Breakpoints are a block-editor feature" — both untrue once this ships. A stale comment that contradicts the code is worse than none.

Colours come from the **reserved red band**, which already covers breakpoints — no new colour is introduced. Both themes from tokens; no `prefers-color-scheme`.

`onMouseDown` on the glyph margin toggles the line. The whole gutter renders only when the hook is `enabled`, so a non-debug session looks exactly as it does today.

### 4.3 Decoration-backed identity

Monaco decorations track edits natively via `stickiness`. The decoration collection is the source of truth for *where* a breakpoint is; `line_N` ids are derived from decoration positions at the moment of a run, not stored.

This is what makes §3's greying rule work: a decoration whose current line is absent from `breakableIds` renders `unverified` and is **filtered out of the set handed to `glowRunner`**, so it cannot fire while it cannot fire — and comes back by itself when the line becomes traceable again.

### 4.4 Executing-line highlight

`__phpause` already posts `b: 'line_16'`. While paused in code mode, decorate that line with `.dbg-executing-line`.

Note this class **no longer exists** — it was deleted with the gutter and survives only as a name in the comment at `styles/workspace.css:311-315`. It must be re-added, not reused. Block mode's equivalent, `.block-executing` (`workspace.css:304-311`), is live and is the treatment to match.

---

## 5. The one contract change

`DebugContext.toggleBreakpoint` (`contexts/DebugContext.js:64-73`) currently refuses to **store** an id that is not in `breakableIds`:

```js
if (next.has(blockId)) next.delete(blockId);
else if (breakableIds.has(blockId)) next.add(blockId);   // ← storage gate
```

That gate cannot coexist with the greying rule, which requires *keeping* an id that has left the breakable set.

**Change:** "can it fire" moves from a **storage gate** to a **render/run-time query**.

- `toggleBreakpoint` stores what the student asked for.
- Rendering consults `breakableIds` to choose `set` vs `unverified`.
- The run path filters the set through `breakableIds` before handing it to `glowRunner`.

**Two invariants are preserved, and must be asserted:**
1. Removal stays unconditional — an old project's stale breakpoints can always be cleared.
2. A breakpoint that cannot fire is never sent to the runtime; today's guarantee ("a breakpoint can never be set where it cannot fire") becomes "a breakpoint never *fires* where it cannot fire", which is the property that actually mattered.

**Block mode is affected by this change** — it shares `toggleBreakpoint`. Today the block UI relies on the storage gate to refuse a breakpoint on a non-breakable block. After the change it must refuse at the call site (`BlocklyWorkspace.js`'s context-menu entry is already `disabled with a reason` on non-breakable blocks, so the affordance already exists) or accept-and-grey like code mode. **The plan must make this explicit and test block mode's behaviour either way** — this is the one place the feature can regress something that currently works.

---

## 6. Data flow

```
edit buffer
   └─(debounced, debug mode on)→ instrumentPythonForDebug(source)
          └→ entries[].blockId  ──→ breakableIds : Set<"line_N">
                                          │
student clicks gutter line 16             │
   └→ toggleBreakpoint("line_16") → breakpoints : Set   (stores unconditionally)
                                          │
                      render: line ∈ breakableIds ? set : unverified
                                          │
Run ──→ breakpoints ∩ breakableIds ──→ glowRunner.setBreakpoints
                                          └→ window.__physide_breakpoints
                                                └→ injected check: has('line_16') → pause
                                                      └→ __phpause {b:'line_16'} → highlight line 16
```

---

## 7. Testing

**Unit (no browser):**
- `instrumentPythonForDebug` → breakable-line derivation, against real VPython fixtures: an assignment, a skipped constructor, a `setup` constant, a loop assignment, a watch entry (excluded).
- The 1-based mapping — a fixture asserting `blockId` for a known line equals that line's Monaco number.
- `toggleBreakpoint` after the §5 change: stores a non-breakable id, removal unconditional, run-path filter drops it.
- Block mode's non-breakable refusal still holds (§5's regression risk).
- `enabled === false` clears `breakableIds`.

**e2e (Puppeteer, `frontend/scripts/e2e-test.mjs`):**
One case that sets a gutter breakpoint in a `code_blank` project, runs, and asserts the simulation **actually halts** and the pause chip reports an iteration.

This case is mandatory. This entire feature exists because a surface shipped that had never been checked end-to-end, and the e2e suite's own note then recorded a real product defect as "a harness limitation, not a product defect" (corrected in `d10a67b`). A unit test cannot prove a breakpoint stops a running simulation.

---

## 8. Files

**New:** `frontend/src/hooks/useCodeBreakables.js` · its test · `frontend/src/components/__tests__/CodeEditorGutter.test.js`

**Modified:** `components/CodeEditor.js` (glyph margin, decorations, click) · `contexts/DebugContext.js` (§5) · `components/layout/IDELayout.js` (mount the hook, pass run-path filter) · `styles/workspace.css` (four marker classes + replacing the stale deleted-decorations comment at `:311-315`) · `scripts/e2e-test.mjs` (the case in §7) · `components/BlocklyWorkspace.js` **only if** §5 requires a call-site refusal

**Untouched:** `utils/runner/instrumentor.js`, `utils/runner/glowRunner.js`, `utils/blockly/traceRegistry.js`. If the plan finds itself editing any of these, the design was wrong — stop and revisit.

**No new dependencies. No backend change. No manifest/schema change.**

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| §5's contract change regresses block mode | Explicit tests both sides; call-site refusal already exists as a `disabled with a reason` menu entry |
| Instrumenting on every keystroke costs | Debounced and debug-mode-gated; the function is pure and already runs per-run today |
| A student expects to break on `rate(60)` | Gutter markers make the limit visible before the click (§3) |
| Decoration/line drift on rapid edits | Ids derived at run time from live decoration positions, never stored |
| `watch_N` ids leaking into the gutter | Excluded explicitly in §4.1, with a test |

---

## 10. Estimate

5–7 tasks: the hook; the contract change plus block-mode regression tests; the gutter and decorations; the executing-line highlight; the e2e case; wrap-up.
