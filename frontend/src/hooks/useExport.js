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
import { captureRuntimeCanvas } from "../utils/runner/glowRunner";
import { isUniformImageData } from "../utils/image";

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

  /* ── Export screenshot of 3D viewport ─────────────────────
     Captured from the runtime canvas (glowRunner.captureRuntimeCanvas), then
     VERIFIED: a WebGL read-back can succeed and still be a blank buffer, and
     reporting success on an empty PNG is worse than reporting failure. */
  const handleExportScreenshot = useCallback(async () => {
    const dataUrl = await captureRuntimeCanvas();
    if (!dataUrl) {
      setStatus({
        text: "Nothing to capture — press Run first, then take the screenshot while it is running.",
        type: "error",
      });
      return;
    }
    const name = await getExportName();
    if (!name) return;
    setStatus({ text: "Capturing screenshot...", type: "" });
    try {
      const ok = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          try {
            const probe = document.createElement("canvas");
            probe.width = 32;
            probe.height = 32;
            const ctx = probe.getContext("2d");
            ctx.drawImage(img, 0, 0, 32, 32);
            resolve(!isUniformImageData(ctx.getImageData(0, 0, 32, 32).data));
          } catch {
            resolve(false);
          }
        };
        img.onerror = () => resolve(false);
        img.src = dataUrl;
      });
      if (!ok) {
        setStatus({
          text: "Screenshot came out blank — the 3D engine did not keep the last frame. Try again while the simulation is running.",
          type: "error",
        });
        return;
      }
      const link = document.createElement("a");
      link.download = `${name}.png`;
      link.href = dataUrl;
      link.click();
      setStatus({ text: `Screenshot saved as ${name}.png`, type: "success" });
    } catch (err) {
      console.error(err);
      setStatus({ text: "Screenshot failed", type: "error" });
    }
  }, [getExportName, setStatus]);

  return {
    getExportName,
    handleExportPy,
    handleExportBlocks,
    handleExportBlocksPdf,
    handleExportCodePdf,
    handleCopyCode,
    handleExportScreenshot,
  };
}
