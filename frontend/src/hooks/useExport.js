/**
 * useExport
 *
 * Provides all file-export and clipboard-copy handlers.
 * Consumes SimulationContext for pythonCode / workspaceRef / mode / status.
 */
import { useCallback } from "react";
import { exportPython, exportBlocks } from "../utils/export/exportUtils";
import { exportBlocksPdf, exportCodePdf } from "../utils/export/pdfExport";
import * as dialogService from "../utils/export/dialogService";
import { generatePythonFromWorkspace } from "../utils/blockly/blocklyGenerator";
import { useSimulationContext } from "../contexts/SimulationContext";

export function useExport() {
  const {
    mode,
    pythonCode,
    workspaceRef,
    setStatus,
  } = useSimulationContext();

  /* ── Prompt-or-derive a safe filename ─────────────────── */
  const getExportName = useCallback(async () => {
    // 1. Try sim_start_block TITLE in the live workspace
    if (workspaceRef.current) {
      try {
        const blocks = workspaceRef.current.getAllBlocks(false);
        const startBlock = blocks.find((b) => b.type === "sim_start_block");
        if (startBlock) {
          const title = startBlock.getFieldValue("TITLE");
          if (title && title.trim() && title.trim() !== "My Simulation") {
            // eslint-disable-next-line no-control-regex
            return title.trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, "").replace(/\s+/g, "_");
          }
        }
      } catch { /* no usable title on this block/build — fall through to the next strategy */ }
    }
    // 2. Try parsing from pythonCode header comment
    const codeMatch = pythonCode.match(/# === Simulation Start:\s*(.+?)\s*===/);
    if (codeMatch && codeMatch[1] && codeMatch[1] !== "My Simulation") {
      // eslint-disable-next-line no-control-regex
      return codeMatch[1].trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, "").replace(/\s+/g, "_");
    }
    // 3. Ask the user
    return dialogService.promptFileName("Name this file:", "simulation");
  }, [pythonCode, workspaceRef]);

  /* ── Generate Python (blocks mode) ────────────────────── */
  const syncFromBlocks = useCallback(() => {
    if (!workspaceRef.current) return pythonCode;
    const generated = generatePythonFromWorkspace(workspaceRef.current);
    return generated || pythonCode;
  }, [pythonCode, workspaceRef]);

  /* ── Export .py ────────────────────────────────────────── */
  const handleExportPy = useCallback(async () => {
    const name = await getExportName();
    if (!name) return;
    exportPython(mode, pythonCode, workspaceRef.current, name);
    setStatus({ text: `Exported ${name}.py`, type: "success" });
  }, [mode, pythonCode, workspaceRef, getExportName, setStatus]);

  /* ── Export .xml ───────────────────────────────────────── */
  const handleExportBlocks = useCallback(async () => {
    const name = await getExportName();
    if (!name) return;
    exportBlocks(workspaceRef.current, name);
    setStatus({ text: `Exported ${name}.xml`, type: "success" });
  }, [workspaceRef, getExportName, setStatus]);

  /* ── Export blocks PDF ─────────────────────────────────── */
  const handleExportBlocksPdf = useCallback(async () => {
    const name = await getExportName();
    if (!name) return;
    setStatus({ text: "Generating blocks PDF...", type: "" });
    try {
      await exportBlocksPdf(workspaceRef.current, name);
      setStatus({ text: `Blocks PDF saved as ${name}.pdf`, type: "success" });
    } catch (err) {
      console.error(err);
      setStatus({ text: err.message || "PDF export failed", type: "error" });
    }
  }, [workspaceRef, getExportName, setStatus]);

  /* ── Export code PDF ───────────────────────────────────── */
  const handleExportCodePdf = useCallback(async () => {
    const name = await getExportName();
    if (!name) return;
    const code = mode === "text" ? pythonCode : syncFromBlocks();
    setStatus({ text: "Generating code PDF...", type: "" });
    try {
      await exportCodePdf(code, name);
      setStatus({ text: `Code PDF saved as ${name}.pdf`, type: "success" });
    } catch (err) {
      console.error(err);
      setStatus({ text: err.message || "PDF export failed", type: "error" });
    }
  }, [mode, pythonCode, syncFromBlocks, getExportName, setStatus]);

  /* ── Copy code to clipboard ────────────────────────────── */
  const handleCopyCode = useCallback(() => {
    const code = mode === "text" ? pythonCode : syncFromBlocks();
    navigator.clipboard.writeText(code).then(
      ()  => setStatus({ text: "Code copied to clipboard", type: "success" }),
      ()  => setStatus({ text: "Failed to copy", type: "error" }),
    );
  }, [mode, pythonCode, syncFromBlocks, setStatus]);

  /* "Screenshot Viewport" left the File menu (Plan 10 Stage C, audit
     win 7): the on-canvas camera (ViewportControls) is the one screenshot
     path. The old menu handler and its capture pipeline were deleted whole
     with it. */

  return {
    getExportName,
    handleExportPy,
    handleExportBlocks,
    handleExportBlocksPdf,
    handleExportCodePdf,
    handleCopyCode,
  };
}
