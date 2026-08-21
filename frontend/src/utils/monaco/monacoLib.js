/**
 * Bundled Monaco 0.45.0 — the exact version the CDN served, so behavior is
 * unchanged. edcore.main = the editor with all editing features and NO
 * language services; python's monarch grammar is the only language.
 * This module must only ever be reached through dynamic import() — it is
 * the code-mode chunk, not initial-load code.
 */
import * as monaco from "monaco-editor/esm/vs/editor/edcore.main.js";
import "monaco-editor/esm/vs/basic-languages/python/python.contribution";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";

self.MonacoEnvironment = { getWorker: () => new EditorWorker() };

export default monaco;
