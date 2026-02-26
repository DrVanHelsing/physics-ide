import React, { useState } from "react";
import { EXAMPLES } from "../utils/precodedExamples";
import { BLOCK_TEMPLATES } from "../utils/blockTemplates";
import {
  RocketIcon,
  AtomIcon,
  GlobeIcon,
  PlusIcon,
  BlocksIcon,
  CodeIcon,
  SpringIcon,
  HelpIcon,
} from "./Icons";

const CARD_ICONS = {
  projectile:       RocketIcon,
  spring:           SpringIcon,
  orbits:           GlobeIcon,
  blocks_projectile: BlocksIcon,
  blocks_spring:    SpringIcon,
  blocks_orbits:    BlocksIcon,
};

const ACCENT_COLORS = {
  projectile:       "var(--accent-red)",
  spring:           "var(--peach)",
  orbits:           "var(--accent-blue)",
  blocks_projectile: "var(--accent-blue)",
  blocks_spring:    "var(--peach)",
  blocks_orbits:    "var(--accent)",
};

const FILTERS = [
  { key: "all",    label: "All",             Icon: AtomIcon },
  { key: "code",   label: "Code Examples",   Icon: CodeIcon },
  { key: "blocks", label: "Block Templates", Icon: BlocksIcon },
];

export default function StartMenu({ onSelect, onHelp }) {
  const [filter, setFilter] = useState("all");  // default: show everything

  const showCode   = filter === "all" || filter === "code";
  const showBlocks = filter === "all" || filter === "blocks";

  return (
    <div className="start-menu-overlay">
      <div className="start-menu">
        {/* Header */}
        <div className="start-header">
          <div className="start-logo">
            <AtomIcon size={36} />
          </div>
          <h1 className="start-title">Physics IDE</h1>
          <p className="start-subtitle">
            Build, simulate, and explore physics with blocks and code
          </p>
          {onHelp && (
            <button className="start-help-btn" onClick={onHelp}>
              <HelpIcon size={13} /> Documentation &amp; Help
            </button>
          )}
        </div>

        {/* Filter bar */}
        <div className="start-filter-bar">
          {FILTERS.map(({ key, label, Icon }) => (
            <button
              key={key}
              className={`start-filter-btn${filter === key ? " start-filter-btn--active" : ""}`}
              onClick={() => setFilter(key)}
            >
              {Icon && <Icon size={13} />}
              {label}
            </button>
          ))}
        </div>

        {/* Cards grid */}
        <div className="start-grid">
          {showCode && EXAMPLES.map((ex) => {
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
                  <Icon size={28} />
                </div>
                <div className="start-card-body">
                  <span className="start-card-badge start-card-badge--code">Code</span>
                  <h3 className="start-card-title">{ex.title}</h3>
                  <p className="start-card-sub">{ex.subtitle}</p>
                  <p className="start-card-desc">{ex.description}</p>
                </div>
              </button>
            );
          })}

          {showBlocks && BLOCK_TEMPLATES.map((tpl) => {
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
                  <Icon size={28} />
                </div>
                <div className="start-card-body">
                  <span className="start-card-badge start-card-badge--blocks">Blocks</span>
                  <h3 className="start-card-title">{tpl.title}</h3>
                  <p className="start-card-sub">{tpl.subtitle}</p>
                  <p className="start-card-desc">{tpl.description}</p>
                </div>
              </button>
            );
          })}

          {/* Blank project card — always visible */}
          <button
            className="start-card start-card--blank"
            style={{ "--card-accent": "var(--accent)" }}
            onClick={() => onSelect({ type: "blank" })}
          >
            <div className="start-card-icon">
              <PlusIcon size={28} />
            </div>
            <div className="start-card-body">
              <h3 className="start-card-title">Blank Project</h3>
              <p className="start-card-sub">Start from scratch</p>
              <p className="start-card-desc">
                Open an empty workspace and build your own physics simulation
                using blocks or code.
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
