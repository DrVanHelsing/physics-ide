import { generatePythonFromWorkspace } from "./blocklyGenerator";

function downloadFile(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function exportPython(mode, pythonCode, workspace) {
  const content = mode === "text" ? pythonCode : generatePythonFromWorkspace(workspace);
  downloadFile(content, "model.py", "text/x-python;charset=utf-8");
}

export function exportBlocks(workspace) {
  if (!workspace || !window.Blockly) {
    window.alert("No Blockly workspace to export.");
    return;
  }
  const xmlDom = window.Blockly.Xml.workspaceToDom(workspace);
  const xmlText = window.Blockly.Xml.domToText(xmlDom);
  downloadFile(xmlText, "workspace.xml", "application/xml;charset=utf-8");
}
