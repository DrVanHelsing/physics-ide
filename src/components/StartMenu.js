import React, { useState } from "react";
import { EXAMPLES } from "../utils/precodedExamples";
import { BLOCK_TEMPLATES } from "../utils/blockTemplates";
import {
  RocketIcon,
  AtomIcon,
  GlobeIcon,
  BlocksIcon,
  CodeIcon,
  SpringIcon,
  HelpIcon,
  FileCodeIcon,
  FileBlocksIcon,
  PlusIcon,
} from "./Icons";

const CARD_ICONS = {
  projectile:        RocketIcon,
  spring:            SpringIcon,
  orbits:            GlobeIcon,
  blocks_projectile: BlocksIcon,
  blocks_spring:     SpringIcon,
  blocks_orbits:     BlocksIcon,
  code_blank:        FileCodeIcon,
  blocks_blank:      FileBlocksIcon,
};

const ACCENT_COLORS = {
  projectile:        "var(--accent-blue)",
  spring:            "var(--peach)",
  orbits:            "var(--accent-blue)",
  blocks_projectile: "var(--mauve)",
  blocks_spring:     "var(--peach)",
  blocks_orbits:     "var(--mauve)",
  code_blank:        "var(--accent-blue)",
  blocks_blank:      "var(--mauve)",
};

const FILTERS = [
  { key: "all",    label: "All",             Icon: null },
  { key: "code",   label: "Code Examples",   Icon: CodeIcon },
  { key: "blocks", label: "Block Templates", Icon: BlocksIcon },
];

export default function StartMenu({ onSelect, onHelp }) {
  const [filter, setFilter] = useState("all");

  const showCode   = filter === "all" || filter === "code";
  const showBlocks = filter === "all" || filter === "blocks";

  return (
    <div className="start-menu-overlay">
      {/* VS Code title bar */}
      <div className="start-titlebar">
        <span className="start-titlebar-text"><strong>Physics IDE</strong> — Welcome</span>
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
                <p className="start-sidebar-sub">Simulation Environment</p>
              </div>
            </div>
            <span className="start-sidebar-version">v1.0 • VPython 3.2</span>
          </div>

          <nav className="start-actions">
            <p className="start-actions-label">Quick Actions</p>
            <button className="start-action-btn" onClick={() => onSelect({ type: "code_blank" })}>
              <FileCodeIcon size={16} /> New Code File
            </button>
            <button className="start-action-btn" onClick={() => onSelect({ type: "blocks_blank" })}>
              <FileBlocksIcon size={16} /> New Block Project
            </button>
            {onHelp && (
              <button className="start-action-btn" onClick={onHelp}>
                <HelpIcon size={16} /> Documentation
              </button>
            )}
          </nav>
        </aside>

        {/* ── Main Content ── */}
        <main className="start-content">
          <div className="start-welcome">
            <h2>Welcome</h2>
            <p>Choose a template to get started, or create a blank project.</p>
          </div>

          {/* Filter bar (VS Code tabs style) */}
          <div className="start-filter-bar">
            {FILTERS.map(({ key, label, Icon }) => (
              <button
                key={key}
                className={`start-filter-btn${filter === key ? " start-filter-btn--active" : ""}`}
                onClick={() => setFilter(key)}
              >
                {Icon && <Icon size={12} />}
                {label}
              </button>
            ))}
          </div>

          {/* Code Examples */}
          {showCode && (
            <>
              <p className="start-section-label">Code Examples</p>
              <div className="start-grid">
                {EXAMPLES.map((ex) => {
                  const Icon = CARD_ICONS[ex.id] || RocketIcon;
                  const accent = ACCENT_COLORS[ex.id] || "var(--accent)";
                  return (
                    <button
                      key={ex.id}
                      className="start-card"
                      style={{ "--card-accent": accent }}
                      onClick={() => onSelect({ type: "code", code: ex.code, id: ex.id })}
                    >
                      <div className="start-card-icon">
                        <Icon size={20} />
                      </div>
                      <div className="start-card-body">
                        <span className="start-card-badge start-card-badge--code">Code</span>
                        <h3 className="start-card-title">{ex.title}</h3>
                        <p className="start-card-desc">{ex.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Block Templates */}
          {showBlocks && (
            <>
              <p className="start-section-label">Block Templates</p>
              <div className="start-grid">
                {BLOCK_TEMPLATES.map((tpl) => {
                  const Icon = CARD_ICONS[tpl.id] || BlocksIcon;
                  const accent = ACCENT_COLORS[tpl.id] || "var(--accent)";
                  return (
                    <button
                      key={tpl.id}
                      className="start-card"
                      style={{ "--card-accent": accent }}
                      onClick={() => onSelect({ type: "blocks", xml: tpl.xml, id: tpl.id })}
                    >
                      <div className="start-card-icon">
                        <Icon size={20} />
                      </div>
                      <div className="start-card-body">
                        <span className="start-card-badge start-card-badge--blocks">Blocks</span>
                        <h3 className="start-card-title">{tpl.title}</h3>
                        <p className="start-card-desc">{tpl.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Blank project cards */}
          {(showCode || showBlocks) && (
            <>
              <p className="start-section-label">New Blank Project</p>
              <div className="start-grid">
                {showCode && (
                  <button
                    className="start-card start-card--blank"
                    style={{ "--card-accent": "var(--accent-blue)" }}
                    onClick={() => onSelect({ type: "code_blank" })}
                  >
                    <div className="start-card-icon">
                      <PlusIcon size={20} />
                    </div>
                    <div className="start-card-body">
                      <span className="start-card-badge start-card-badge--code">Code</span>
                      <h3 className="start-card-title">Blank Code</h3>
                      <p className="start-card-desc">
                        Empty VPython editor with read-only blocks preview.
                      </p>
                    </div>
                  </button>
                )}
                {showBlocks && (
                  <button
                    className="start-card start-card--blank"
                    style={{ "--card-accent": "var(--mauve)" }}
                    onClick={() => onSelect({ type: "blocks_blank" })}
                  >
                    <div className="start-card-icon">
                      <PlusIcon size={20} />
                    </div>
                    <div className="start-card-body">
                      <span className="start-card-badge start-card-badge--blocks">Blocks</span>
                      <h3 className="start-card-title">Blank Blocks</h3>
                      <p className="start-card-desc">
                        Empty block canvas with read-only code preview.
                      </p>
                    </div>
                  </button>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
