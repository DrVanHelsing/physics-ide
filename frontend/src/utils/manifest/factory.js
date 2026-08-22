/**
 * Manifest factory.
 *
 * Produces a fresh, valid Manifest v2. Used by:
 *   - StartMenu when the user creates a new project (Phase B.5).
 *   - The v1 -> v2 migration (Phase B.2) as the empty shell into which legacy
 *     state is mapped.
 */

import { SCHEMA_VERSION, GOALS, EDITOR_MODES, PROJECT_TYPES } from "./schema";

const DS_STARTER_XML = `<xml xmlns="https://developers.google.com/blockly/xml">
  <variables>
    <variable id="ds-starter-df">df</variable>
  </variables>
  <block type="ds_start_block" x="40" y="40">
    <field name="TITLE">My Analysis</field>
    <statement name="BODY">
      <block type="ds_load_builtin_block">
        <field name="VAR" id="ds-starter-df">df</field>
        <field name="ID">penguins</field>
        <next>
          <block type="ds_show_table_block">
            <field name="VAR" id="ds-starter-df">df</field>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>`;

/* A blank physics project opens on the frame every simulation needs, so the
   first thing a student sees is a place to put blocks rather than an empty
   grid and a trashcan. Mirrors DS_STARTER_XML above. */
const PHYSICS_STARTER_XML = `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="sim_start_block" x="40" y="40">
    <field name="TITLE">My Simulation</field>
    <next>
      <block type="sim_end_block">
        <field name="MSG">Simulation complete.</field>
      </block>
    </next>
  </block>
</xml>`;

function generateId(prefix = "p") {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  // Fallback for older environments / Node before 19.
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

export function createManifest({
  id,
  title,
  goal = "physics",
  projectType = "custom",
  preferredEditor = "blocks",
  workspaceXml = "",
  python = "",
  hybridPairing = null,
} = {}) {
  if (!GOALS.includes(goal)) {
    throw new Error(`createManifest: invalid goal '${goal}'`);
  }
  if (!EDITOR_MODES.includes(preferredEditor)) {
    throw new Error(`createManifest: invalid preferredEditor '${preferredEditor}'`);
  }
  if (!PROJECT_TYPES.includes(projectType)) {
    throw new Error(`createManifest: invalid projectType '${projectType}'`);
  }

  const now = Date.now();
  const safeTitle =
    typeof title === "string" && title.length > 0
      ? title
      : defaultTitle(goal);

  const isCodeFirst = projectType === "code_blank" || preferredEditor === "code";
  let defaultXml = workspaceXml || "";
  if (!workspaceXml && !isCodeFirst) {
    defaultXml = goal === "datascience" || goal === "hybrid" ? DS_STARTER_XML : PHYSICS_STARTER_XML;
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    id: id || generateId(),
    title: safeTitle,
    goal,
    projectType,
    preferredEditor,
    createdAt: now,
    updatedAt: now,
    workspace: { xml: defaultXml },
    source: { python: python || "" },
    datasets: [],
    runs: [],
    chartSpecs: [],
    notes: [],
    checkpointState: {},
    // Optional sim⇄analysis coupling for hybrid projects (see HYBRID_TOPICS).
    // Absent/null on non-hybrid projects; the schema guard treats null as valid.
    ...(hybridPairing ? { hybridPairing } : {}),
  };
}

function defaultTitle(goal) {
  switch (goal) {
    case "datascience":
      return "Untitled data project";
    case "hybrid":
      return "Untitled hybrid project";
    default:
      return "Untitled simulation";
  }
}
