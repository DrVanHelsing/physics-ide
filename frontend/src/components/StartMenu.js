/**
 * StartMenu — Plan 10 deep IA rework (user-ordered "recommended option").
 *
 * One column, three moves a visitor can make, zero intermediate screens:
 *   - Header: branding left, the quick actions (Open File, Help, account)
 *     right — the 280px sidebar they used to live in is gone.
 *   - Continue — saved-project list, unchanged.
 *   - Start something new — the three goal cards CREATE INSTANTLY (a blank
 *     project of that goal; the wizard is deleted), followed by every
 *     template the product has, grouped Physics / Data science / Hybrid.
 *
 * Nothing the wizard could do is lost, it just stopped being a form:
 *   - a title      → projects are named in the IDE (click the title);
 *   - blank+code   → the Physics card's "Start in code instead" subaction;
 *   - DS/Hybrid templates → surfaced on the landing (the wizard's Template
 *     radio was the ONLY path to them before);
 *   - hybrid model/data entry → each topic card creates with its own
 *     default entry and carries a one-click "start from the other half"
 *     subaction.
 *
 * The flow still speaks the manifest spec directly via `onCreate(spec)` and
 * `onOpenProject(id)`; buildManifestSpec is unchanged and stays the single
 * translation point (the welcome page's pending-template seed also routes
 * through it).
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { EXAMPLES } from "../utils/precodedExamples";
import { BLOCK_TEMPLATES, DS_TEMPLATES, HYBRID_TOPICS } from "../utils/blockTemplates";
import { DEFAULT_PYTHON_CODE } from "../constants";
import { relativeTime } from "../utils/relativeTime";
import { listShareAttribution } from "../utils/storage/shareMeta";
import { refreshShareAttributions, attributionSentence } from "../utils/sharing/attribution";
import HeaderAccount from "./auth/HeaderAccount";
import {
  RocketIcon,
  AtomIcon,
  GlobeIcon,
  BlocksIcon,
  CodeIcon,
  SpringIcon,
  HelpIcon,
  UploadIcon,
  TableIcon,
  XIcon,
} from "./Icons";

/* ── Goal definitions ────────────────────────────────────── */

const GOALS = [
  {
    id: "physics",
    label: "Physics Modelling",
    description: "Build VPython simulations with blocks or code.",
    icon: AtomIcon,
    accent: "var(--accent-green)",
  },
  {
    id: "datascience",
    label: "Data Science",
    description: "Explore datasets, compute stats, build charts.",
    icon: TableIcon,
    accent: "var(--accent-blue)",
  },
  {
    id: "hybrid",
    label: "Hybrid",
    description: "Run simulations, then analyse the data they produce.",
    icon: GlobeIcon,
    accent: "var(--mauve)",
  },
];

const GOAL_BADGE = {
  physics: "Physics",
  datascience: "Data Science",
  hybrid: "Hybrid",
};

const GOAL_TOKEN = {
  physics: "--cat-objects",
  datascience: "--cat-data-science",
  hybrid: "--cat-values",
};

const CARD_ICONS = {
  projectile: RocketIcon,
  spring: SpringIcon,
  orbits: GlobeIcon,
  pendulum: AtomIcon,
  blocks_projectile: BlocksIcon,
  blocks_spring: SpringIcon,
  blocks_orbits: BlocksIcon,
  blocks_pendulum: AtomIcon,
};

/* ── Map a creation spec to a manifest spec + content ────── */

export function buildManifestSpec({ goal, title, startPath, templateId, editor, hybridEntry }) {
  const preferredEditor = editor === "code" ? "code" : "blocks";
  const trimmedTitle = (title || "").trim();

  const spec = {
    goal,
    preferredEditor,
    title: trimmedTitle || undefined,
  };

  // ── Hybrid topic: a single selection couples the simulation template with
  //    its matching analysis. The model/data-first entry decides which one the
  //    project opens in; the pairing is persisted so the IDE can offer the
  //    other half later ("Analyse this run →"). ───────────────────────────
  if (goal === "hybrid" && startPath === "template" && templateId) {
    const topic = HYBRID_TOPICS.find((t) => t.id === templateId);
    if (topic) {
      const simTpl = BLOCK_TEMPLATES.find((t) => t.id === topic.simTemplateId);
      const analysisTpl = DS_TEMPLATES.find((t) => t.id === topic.analysisTemplateId);
      const entry = hybridEntry === "data" ? "data" : "model";
      spec.projectType = "block_template";
      spec.preferredEditor = "blocks";
      spec.workspaceXml =
        entry === "data" ? (analysisTpl?.xml || "") : (simTpl?.xml || "");
      // Model-first opens the sim, so pair its Python code template too.
      const pairedCodeId = topic.simTemplateId.replace(/^blocks_/, "");
      const pairedCode = EXAMPLES.find((e) => e.id === pairedCodeId);
      spec.python = entry === "data" ? "" : (pairedCode?.code || DEFAULT_PYTHON_CODE);
      spec.hybridPairing = {
        simId: topic.simTemplateId,
        analysisId: topic.analysisTemplateId,
      };
      return spec;
    }
  }

  if (startPath === "blank") {
    spec.projectType = preferredEditor === "code" ? "code_blank" : "custom";
    spec.workspaceXml = "";
    spec.python = DEFAULT_PYTHON_CODE;
  } else if (startPath === "template" && templateId) {
    const codeTpl = EXAMPLES.find((e) => e.id === templateId);
    const blocksTpl = BLOCK_TEMPLATES.find((t) => t.id === templateId);
    const dsTpl = DS_TEMPLATES.find((t) => t.id === templateId);
    if (dsTpl) {
      spec.projectType = "block_template";
      spec.workspaceXml = dsTpl.xml || "";
      spec.python = "";
      spec.preferredEditor = "blocks";
    } else if (codeTpl) {
      spec.projectType = "code_template";
      spec.python = codeTpl.code || DEFAULT_PYTHON_CODE;
      const paired = BLOCK_TEMPLATES.find((t) => t.id === `blocks_${codeTpl.id}`);
      spec.workspaceXml = paired ? paired.xml : "";
      spec.preferredEditor = "code";
    } else if (blocksTpl) {
      spec.projectType = "block_template";
      spec.workspaceXml = blocksTpl.xml || "";
      const pairedId = blocksTpl.id.replace(/^blocks_/, "");
      const pairedCode = EXAMPLES.find((e) => e.id === pairedId);
      spec.python = pairedCode?.code || DEFAULT_PYTHON_CODE;
      spec.preferredEditor = "blocks";
    } else {
      spec.projectType = "custom";
    }
  } else {
    spec.projectType = "custom";
  }

  if (goal === "hybrid" && hybridEntry === "data") {
    spec.preferredEditor = preferredEditor; // user choice still wins
  }

  return spec;
}

/**
 * resolvePendingTemplateSpec — turns a template id pending from a welcome-
 * page tile (welcome/pendingTemplate.js) into a manifest spec, via the SAME
 * buildManifestSpec the template cards call — never a forked copy of its
 * lookup logic.
 *
 * Returns null for any id that is not a real template. That check has to
 * happen HERE, before buildManifestSpec runs: an unmatched templateId falls
 * through buildManifestSpec's own template branch to `projectType: "custom"`
 * (a blank project), which would silently create *something* instead of
 * doing nothing — and "unknown id → today's behaviour" means nothing.
 *
 * Goal is read off the template's own record where one exists — DS_TEMPLATES
 * entries carry "datascience" or "hybrid" — since a wrong goal changes which
 * pane the IDE renders (DataPanel vs. the 3D viewport) for the project this
 * creates. BLOCK_TEMPLATES and EXAMPLES are always physics templates.
 */
export function resolvePendingTemplateSpec(id) {
  const dsTpl = DS_TEMPLATES.find((t) => t.id === id);
  if (dsTpl) {
    return buildManifestSpec({
      goal: dsTpl.goal === "hybrid" ? "hybrid" : "datascience",
      title: "",
      startPath: "template",
      templateId: id,
      editor: "blocks",
    });
  }
  const codeTpl = EXAMPLES.find((e) => e.id === id);
  if (codeTpl) {
    return buildManifestSpec({
      goal: "physics",
      title: "",
      startPath: "template",
      templateId: id,
      editor: "code",
    });
  }
  const blocksTpl = BLOCK_TEMPLATES.find((t) => t.id === id);
  if (blocksTpl) {
    return buildManifestSpec({
      goal: "physics",
      title: "",
      startPath: "template",
      templateId: id,
      editor: "blocks",
    });
  }
  return null;
}

/* ── Component ───────────────────────────────────────────── */

export default function StartMenu({
  projectList = [],
  loaded = true,
  onOpenProject,
  onDeleteProject,
  onCreate,
  onImport,
  onHelp,
}) {
  const importRef = useRef(null);
  const [attributions, setAttributions] = useState({});

  /* Offline-correct first paint (design D§7): seed from the sidecar
     immediately, then resolve live names when online. Keyed on
     [projectList] only — never on `attributions` itself, or the refresh's
     own setAttributions call would re-trigger the effect. */
  useEffect(() => {
    let dead = false;
    listShareAttribution().then((local) => {
      if (!dead) setAttributions(local);
    });
    refreshShareAttributions().then((merged) => {
      if (!dead) setAttributions(merged);
    });
    return () => {
      dead = true;
    };
  }, [projectList]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    onImport?.(file);
  };

  /* A goal card IS the create button now: a blank project of that goal,
     blocks editor. The Physics card's subaction covers blank-in-code. */
  const createBlank = (goalId, editor = "blocks") => {
    onCreate?.(
      buildManifestSpec({
        goal: goalId,
        title: "",
        startPath: "blank",
        editor,
      }),
    );
  };

  const openTemplate = (tpl) => {
    onCreate?.(
      buildManifestSpec({
        goal: tpl.goal,
        title: "",
        startPath: "template",
        templateId: tpl.id,
        editor: tpl.kind === "code" ? "code" : "blocks",
        hybridEntry: tpl.entry,
      }),
    );
  };

  /* Every template the product has, on the landing — the wizard's Template
     radio was the only path to the DS and hybrid ones before. Hybrid-goal
     DS_TEMPLATES entries are the analysis HALVES of topics; they enter a
     project via a topic card (or "Analyse this run →"), not their own card. */
  const physicsTemplates = useMemo(
    () => [
      ...BLOCK_TEMPLATES.map((t) => ({ id: t.id, title: t.title, description: t.description, kind: "blocks", goal: "physics" })),
      ...EXAMPLES.map((e) => ({ id: e.id, title: e.title, description: e.description, kind: "code", goal: "physics" })),
    ],
    [],
  );
  const dsTemplates = useMemo(
    () =>
      DS_TEMPLATES.filter((t) => t.goal === "datascience").map((t) => ({
        id: t.id, title: t.title, description: t.description, kind: "blocks", goal: "datascience",
      })),
    [],
  );
  const hybridTopics = useMemo(
    () =>
      HYBRID_TOPICS.map((t) => ({
        id: t.id, title: t.title, description: t.description, kind: "blocks", goal: "hybrid",
        entry: t.defaultEntry,
        altEntry: t.defaultEntry === "data" ? "model" : "data",
      })),
    [],
  );

  return (
    <div className="start-menu-overlay">
      <div className="start-menu">
        {/* ── Header: brand left, quick actions right (the old sidebar,
              flattened into one row) ── */}
        <header className="start-header">
          <div className="start-header-brand">
            <div className="start-sidebar-logo-icon">
              <AtomIcon size={18} />
            </div>
            <div>
              <h1 className="start-sidebar-title">Physics IDE</h1>
              <p className="start-sidebar-sub">Modelling + Data</p>
            </div>
            <span className="start-sidebar-version">v1.0 • VPython 3.2</span>
          </div>
          <div className="start-header-actions">
            <input
              ref={importRef}
              type="file"
              accept=".py,.xml,.json,.physide.json"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
            <button
              className="start-action-btn"
              onClick={() => importRef.current?.click()}
              title="Open a .py, .xml, or .physide.json project file"
            >
              <UploadIcon size={16} /> Open File…
            </button>
            {onHelp && (
              <button className="start-action-btn" onClick={onHelp}>
                <HelpIcon size={16} /> Help
              </button>
            )}
            <HeaderAccount />
          </div>
        </header>

        {/* ── Main Content ── */}
        <main className="start-content">
          {/* Continue */}
          <h2 className="start-section-label">Continue</h2>
          {!loaded ? null : projectList.length > 0 ? (
            <div className="start-project-list">
              {projectList.map((p, i) => (
                <ProjectRow
                  key={p.id}
                  project={p}
                  mostRecent={i === 0}
                  attribution={attributions[p.id]}
                  onOpen={() => onOpenProject?.(p.id)}
                  onDelete={() => onDeleteProject?.(p.id, p.title)}
                />
              ))}
            </div>
          ) : (
            <p className="start-empty">
              Nothing saved yet. Pick a goal below to start from scratch, or open a template —
              your work is saved on this computer automatically.
            </p>
          )}

          {/* Start something new: the goal cards create instantly, and every
              template lives right below them — one section, no wizard. */}
          <h2 className="start-section-label">Start something new</h2>
          <div className="start-grid">
            {GOALS.map((g) => {
              const Icon = g.icon;
              return (
                <GoalCard
                  key={g.id}
                  goal={g}
                  icon={<Icon size={22} />}
                  onCreate={() => createBlank(g.id)}
                  alt={
                    g.id === "physics" || g.id === "hybrid"
                      ? { label: "Start in code instead", onClick: () => createBlank(g.id, "code") }
                      : null
                  }
                />
              );
            })}
          </div>

          <h3 className="start-section-sublabel">Physics templates</h3>
          <div className="start-grid start-grid--templates">
            {physicsTemplates.map((tpl) => (
              <TemplateCard key={tpl.id} tpl={tpl} onOpen={() => openTemplate(tpl)} />
            ))}
          </div>

          {dsTemplates.length > 0 && (
            <>
              <h3 className="start-section-sublabel">Data science templates</h3>
              <div className="start-grid start-grid--templates">
                {dsTemplates.map((tpl) => (
                  <TemplateCard key={tpl.id} tpl={tpl} onOpen={() => openTemplate(tpl)} />
                ))}
              </div>
            </>
          )}

          {hybridTopics.length > 0 && (
            <>
              <h3 className="start-section-sublabel">Hybrid topics — a simulation paired with its analysis</h3>
              <div className="start-grid start-grid--templates">
                {hybridTopics.map((tpl) => (
                  <TemplateCard
                    key={tpl.id}
                    tpl={tpl}
                    onOpen={() => openTemplate(tpl)}
                    alt={{
                      label: tpl.altEntry === "data" ? "Start from the data instead" : "Start from the model instead",
                      onClick: () => openTemplate({ ...tpl, entry: tpl.altEntry }),
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

/* ── Subcomponents ───────────────────────────────────────── */

function ProjectRow({ project, attribution, onOpen, onDelete, mostRecent = false }) {
  const Icon = project.goal === "datascience" ? TableIcon : project.goal === "hybrid" ? GlobeIcon : AtomIcon;
  return (
    <div className={`start-project-row${mostRecent ? " start-project-row--recent" : ""}`}>
      <button className="start-project-open" onClick={onOpen}>
        <span className="start-project-icon"><Icon size={16} /></span>
        <span className="start-project-meta">
          <span className="start-project-title">{project.title}</span>
          <span className="start-project-sub">
            {project.goal} · {relativeTime(project.updatedAt)}
            {/* The one the front door would have auto-opened (Plan 10 R4 /
                the Stage A review's M5): the CHOICE is the menu's, but the
                most recent row says which project that choice was about. */}
            {mostRecent ? " · last opened" : ""}
          </span>
          {attribution ? (
            <span className="start-project-attrib">{attributionSentence(attribution.sharerName)}</span>
          ) : null}
        </span>
      </button>
      <button
        className="start-project-delete"
        onClick={onDelete}
        title="Delete this project"
        aria-label="Delete project"
      >
        <XIcon size={12} />
      </button>
    </div>
  );
}
export { ProjectRow }; // test seam only

/* A goal card: the whole card is the create button; an optional subaction
   sits beneath the copy (a nested control, so the card itself is a div). */
function GoalCard({ goal, icon, onCreate, alt }) {
  return (
    <div className="start-card start-card--goal" style={{ "--card-accent": goal.accent }}>
      <button
        type="button"
        className="start-card-main"
        onClick={onCreate}
        aria-label={`Create a blank ${goal.label} project`}
        title={`Create a blank ${goal.label.toLowerCase()} project`}
      >
        <div className="start-card-icon">{icon}</div>
        <div className="start-card-body">
          <span
            className="start-card-badge"
            style={{
              background: `var(${GOAL_TOKEN[goal.id] || "--cat-advanced"})`,
              color: "#FFFFFF",
            }}
          >
            {GOAL_BADGE[goal.id] || goal.id}
          </span>
          <h3 className="start-card-title">{goal.label}</h3>
          <p className="start-card-desc">{goal.description}</p>
        </div>
      </button>
      {alt && (
        <button type="button" className="start-card-alt" onClick={alt.onClick}>
          {alt.label}
        </button>
      )}
    </div>
  );
}

function TemplateCard({ tpl, onOpen, alt }) {
  const Icon =
    CARD_ICONS[tpl.id] ||
    (tpl.goal === "datascience" ? TableIcon : tpl.goal === "hybrid" ? GlobeIcon : tpl.kind === "code" ? CodeIcon : BlocksIcon);
  return (
    <div className="start-card start-card--template">
      <button
        type="button"
        className="start-card-main"
        onClick={onOpen}
        aria-label={`Open the ${tpl.title} template`}
      >
        <div className="start-card-icon"><Icon size={20} /></div>
        <div className="start-card-body">
          <span className={`start-card-badge start-card-badge--${tpl.kind}`}>
            {tpl.kind === "code" ? "Code" : "Blocks"}
          </span>
          <h3 className="start-card-title">{tpl.title}</h3>
          <p className="start-card-desc">{tpl.description}</p>
        </div>
      </button>
      {alt && (
        <button type="button" className="start-card-alt" onClick={alt.onClick}>
          {alt.label}
        </button>
      )}
    </div>
  );
}
