/**
 * StartMenu — Phase B.5 goal-first redesign.
 *
 * Layout:
 *   - Sidebar: branding + quick actions (Open File, Documentation).
 *   - Main area:
 *       * Continue — saved-project list pulled from useProject.
 *       * Create New — three goal cards (Physics, Data Science, Hybrid).
 *       * Templates — existing physics templates surfaced under the
 *         Physics goal; DS / Hybrid template slots are placeholders that
 *         Phase C fills.
 *   - Wizard: when a goal card is clicked, a panel collects the project
 *     spec (title, start path, editor default, beginner toggle, plus the
 *     model-first/data-first choice for hybrid).
 *
 * The new flow speaks the manifest spec directly via `onCreate(spec)` and
 * `onOpenProject(id)`. Template selections still translate through the
 * existing physics template / examples lookup so we don't lose the
 * projectile / spring / orbit / pendulum content.
 */

import React, { useMemo, useRef, useState } from "react";
import { EXAMPLES } from "../utils/precodedExamples";
import { BLOCK_TEMPLATES, DS_TEMPLATES, HYBRID_TOPICS } from "../utils/blockTemplates";
import { DEFAULT_PYTHON_CODE } from "../constants";
import AccountChip from "./auth/AccountChip";
import {
  RocketIcon,
  AtomIcon,
  GlobeIcon,
  BlocksIcon,
  CodeIcon,
  SpringIcon,
  HelpIcon,
  PlusIcon,
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

/* ── Map a wizard spec to a manifest spec + content ──────── */

function buildManifestSpec({ goal, title, startPath, templateId, editor, hybridEntry }) {
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

/* ── Format relative time for the project list ───────────── */

function relativeTime(ms) {
  if (!ms) return "";
  const delta = Date.now() - ms;
  if (delta < 60_000) return "just now";
  if (delta < 3_600_000) return `${Math.round(delta / 60_000)} min ago`;
  if (delta < 86_400_000) return `${Math.round(delta / 3_600_000)} h ago`;
  return new Date(ms).toLocaleDateString();
}

/* ── Component ───────────────────────────────────────────── */

export default function StartMenu({
  projectList = [],
  onOpenProject,
  onDeleteProject,
  onCreate,
  onImport,
  onHelp,
}) {
  const importRef = useRef(null);
  const [wizardGoal, setWizardGoal] = useState(null); // null | 'physics' | 'datascience' | 'hybrid'
  const [wizardTitle, setWizardTitle] = useState("");
  const [wizardStartPath, setWizardStartPath] = useState("blank"); // 'blank' | 'template'
  const [wizardTemplateId, setWizardTemplateId] = useState(null);
  const [wizardEditor, setWizardEditor] = useState("blocks");
  const [wizardHybridEntry, setWizardHybridEntry] = useState("model");

  const openWizard = (goalId) => {
    setWizardGoal(goalId);
    setWizardTitle("");
    setWizardStartPath("blank");
    setWizardTemplateId(null);
    setWizardEditor(goalId === "datascience" ? "blocks" : "blocks");
    setWizardHybridEntry("model");
  };
  const closeWizard = () => setWizardGoal(null);

  const handleCreate = () => {
    const spec = buildManifestSpec({
      goal: wizardGoal,
      title: wizardTitle,
      startPath: wizardStartPath,
      templateId: wizardTemplateId,
      editor: wizardEditor,
      hybridEntry: wizardHybridEntry,
    });
    onCreate?.(spec);
    closeWizard();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    onImport?.(file);
  };

  const wizardGoalDef = useMemo(
    () => GOALS.find((g) => g.id === wizardGoal) || null,
    [wizardGoal],
  );

  const templatesForGoal = useMemo(() => {
    if (wizardGoal === "datascience") {
      return DS_TEMPLATES.filter((t) => t.goal === "datascience").map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        kind: "blocks",
      }));
    }
    if (wizardGoal === "hybrid") {
      // Topic cards: each couples a sim with its matching analysis. Picking one
      // also auto-sets the model/data-first entry (see WizardPanel).
      return HYBRID_TOPICS.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        kind: "blocks",
        defaultEntry: t.defaultEntry,
      }));
    }
    // Physics
    const codeTemplates = EXAMPLES.map((ex) => ({
      id: ex.id,
      title: ex.title,
      description: ex.description,
      kind: "code",
    }));
    const blockTemplates = BLOCK_TEMPLATES.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      kind: "blocks",
    }));
    return [...codeTemplates, ...blockTemplates];
  }, [wizardGoal]);

  return (
    <div className="start-menu-overlay">
      {/* VS Code title bar */}
      <div className="start-titlebar">
        <span className="start-titlebar-text">
          <strong>Physics IDE</strong> — Welcome
        </span>
      </div>

      <div className="start-menu">
        {/* ── Sidebar ── */}
        <aside className="start-sidebar">
          <div className="start-sidebar-header">
            <div className="start-sidebar-logo">
              <div className="start-sidebar-logo-icon">
                <AtomIcon size={18} />
              </div>
              <div>
                <h1 className="start-sidebar-title">Physics IDE</h1>
                <p className="start-sidebar-sub">Modelling + Data</p>
              </div>
            </div>
            <span className="start-sidebar-version">v1.0 • VPython 3.2</span>
          </div>

          <nav className="start-actions">
            <p className="start-actions-label">Quick Actions</p>
            {onHelp && (
              <button className="start-action-btn" onClick={onHelp}>
                <HelpIcon size={16} /> Documentation
              </button>
            )}
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
            <AccountChip />
          </nav>
        </aside>

        {/* ── Main Content ── */}
        <main className="start-content">
          {wizardGoal ? (
            <WizardPanel
              goalDef={wizardGoalDef}
              templates={templatesForGoal}
              title={wizardTitle}
              setTitle={setWizardTitle}
              startPath={wizardStartPath}
              setStartPath={setWizardStartPath}
              templateId={wizardTemplateId}
              setTemplateId={setWizardTemplateId}
              editor={wizardEditor}
              setEditor={setWizardEditor}
              hybridEntry={wizardHybridEntry}
              setHybridEntry={setWizardHybridEntry}
              onCancel={closeWizard}
              onCreate={handleCreate}
            />
          ) : (
            <>
              <div className="start-welcome">
                <h2>Welcome</h2>
                <p>Pick up where you left off, or start a new project.</p>
              </div>

              {/* Continue */}
              {projectList.length > 0 && (
                <>
                  <p className="start-section-label">Continue</p>
                  <div className="start-project-list">
                    {projectList.map((p) => (
                      <ProjectRow
                        key={p.id}
                        project={p}
                        onOpen={() => onOpenProject?.(p.id)}
                        onDelete={() => onDeleteProject?.(p.id)}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* Create New */}
              <p className="start-section-label">Create New</p>
              <div className="start-grid">
                {GOALS.map((g) => {
                  const Icon = g.icon;
                  return (
                    <button
                      key={g.id}
                      className="start-card start-card--goal"
                      style={{ "--card-accent": g.accent }}
                      onClick={() => openWizard(g.id)}
                    >
                      <div className="start-card-icon">
                        <Icon size={22} />
                      </div>
                      <div className="start-card-body">
                        <span className="start-card-badge start-card-badge--code">{GOAL_BADGE[g.id] || g.id}</span>
                        <h3 className="start-card-title">{g.label}</h3>
                        <p className="start-card-desc">{g.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

/* ── Subcomponents ───────────────────────────────────────── */

function ProjectRow({ project, onOpen, onDelete }) {
  const Icon = project.goal === "datascience" ? TableIcon : project.goal === "hybrid" ? GlobeIcon : AtomIcon;
  return (
    <div className="start-project-row">
      <button className="start-project-open" onClick={onOpen}>
        <span className="start-project-icon"><Icon size={16} /></span>
        <span className="start-project-meta">
          <span className="start-project-title">{project.title}</span>
          <span className="start-project-sub">
            {project.goal} · {relativeTime(project.updatedAt)}
          </span>
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

function WizardPanel({
  goalDef,
  templates,
  title,
  setTitle,
  startPath,
  setStartPath,
  templateId,
  setTemplateId,
  editor,
  setEditor,
  hybridEntry,
  setHybridEntry,
  onCancel,
  onCreate,
}) {
  if (!goalDef) return null;
  const Icon = goalDef.icon;
  const canSubmit = startPath !== "template" || Boolean(templateId);

  return (
    <div className="start-wizard" style={{ "--card-accent": goalDef.accent }}>
      <div className="start-wizard-header">
        <div className="start-wizard-title">
          <span className="start-wizard-icon"><Icon size={18} /></span>
          <strong>New {goalDef.label} project</strong>
        </div>
        <button className="start-wizard-cancel" onClick={onCancel} aria-label="Cancel">
          <XIcon size={14} />
        </button>
      </div>

      <div className="start-wizard-body">
        <label className="start-wizard-field">
          <span>Project title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`Untitled ${goalDef.label.toLowerCase()} project`}
          />
        </label>

        <fieldset className="start-wizard-field">
          <legend>Start path</legend>
          <div className="start-wizard-radios">
            <RadioCard
              checked={startPath === "blank"}
              onChange={() => {
                setStartPath("blank");
                setTemplateId(null);
              }}
              label="Blank"
              hint="An empty project."
            />
            <RadioCard
              checked={startPath === "template"}
              onChange={() => setStartPath("template")}
              label="Template"
              hint={
                templates.length > 0
                  ? `${templates.length} template${templates.length === 1 ? "" : "s"} available.`
                  : "No templates available for this goal yet."
              }
              disabled={templates.length === 0}
            />
          </div>
        </fieldset>

        {startPath === "template" && templates.length > 0 && (
          <div className="start-wizard-templates">
            {templates.map((tpl) => {
              const TplIcon = CARD_ICONS[tpl.id] || (tpl.kind === "blocks" ? BlocksIcon : CodeIcon);
              return (
                <button
                  key={tpl.id}
                  type="button"
                  className={`start-wizard-template${templateId === tpl.id ? " start-wizard-template--active" : ""}`}
                  onClick={() => {
                    setTemplateId(tpl.id);
                    // Hybrid topic cards carry a default entry — picking one
                    // auto-sets the model/data-first radio below.
                    if (tpl.defaultEntry) setHybridEntry(tpl.defaultEntry);
                  }}
                >
                  <span className="start-wizard-template-icon"><TplIcon size={14} /></span>
                  <span className="start-wizard-template-meta">
                    <strong>{tpl.title}</strong>
                    <span>
                      {tpl.defaultEntry
                        ? tpl.description
                        : `${tpl.kind === "code" ? "Code" : "Blocks"} · ${tpl.description}`}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {goalDef.id === "hybrid" && (
          <fieldset className="start-wizard-field">
            <legend>Hybrid entry</legend>
            <div className="start-wizard-radios">
              <RadioCard
                checked={hybridEntry === "model"}
                onChange={() => setHybridEntry("model")}
                label="Model-first"
                hint="Run a simulation, then analyse what it produces."
              />
              <RadioCard
                checked={hybridEntry === "data"}
                onChange={() => setHybridEntry("data")}
                label="Data-first"
                hint="Start from a dataset, build a model to match."
              />
            </div>
          </fieldset>
        )}

        <fieldset className="start-wizard-field">
          <legend>Editor default</legend>
          <div className="start-wizard-radios">
            <RadioCard
              checked={editor === "blocks"}
              onChange={() => setEditor("blocks")}
              label="Blocks"
              hint="Drag-and-drop visual editor."
              Icon={BlocksIcon}
            />
            <RadioCard
              checked={editor === "code"}
              onChange={() => setEditor("code")}
              label="Code"
              hint="Plain Python editor."
              Icon={CodeIcon}
            />
          </div>
        </fieldset>

      </div>

      <div className="start-wizard-footer">
        <button className="start-wizard-secondary" onClick={onCancel}>Cancel</button>
        <button
          className="start-wizard-primary"
          onClick={onCreate}
          disabled={!canSubmit}
        >
          <PlusIcon size={14} /> Create project
        </button>
      </div>
    </div>
  );
}

function RadioCard({ checked, onChange, label, hint, Icon, disabled }) {
  return (
    <label className={`start-wizard-radio${checked ? " start-wizard-radio--active" : ""}${disabled ? " start-wizard-radio--disabled" : ""}`}>
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      <span className="start-wizard-radio-body">
        <span className="start-wizard-radio-label">
          {Icon && <Icon size={12} />}
          {label}
        </span>
        {hint && <span className="start-wizard-radio-hint">{hint}</span>}
      </span>
    </label>
  );
}
