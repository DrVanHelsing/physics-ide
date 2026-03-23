/**
 * dialogService.js
 *
 * A lightweight bridge between Blockly's dialog callbacks and the
 * custom React VariableDialog component. BlocklyWorkspace registers
 * Blockly.dialog handlers that call into this service; VariableDialog
 * registers itself here on mount so it receives those calls.
 */

let _service = null;

/** Called by VariableDialog on mount to register its handler. */
export function registerDialogService(service) {
  _service = service;
}

/** Called by BlocklyWorkspace to show a prompt dialog. Returns a Promise.
 *  options.validator(value) → bool  — inline validation
 *  options.validatorMsg      → string - message shown on failure
 */
export function prompt(msg, defaultVal, options = {}) {
  if (_service) return _service.prompt(msg, defaultVal ?? "", options);
  return Promise.resolve(window.prompt(msg, defaultVal ?? ""));
}

/** Called by BlocklyWorkspace to show an alert dialog. Returns a Promise. */
export function alert(msg) {
  if (_service) return _service.alert(msg);
  return Promise.resolve(void window.alert(msg));
}

/** Called by BlocklyWorkspace to show a confirm dialog. Returns a Promise<boolean>. */
export function confirm(msg) {
  if (_service) return _service.confirm(msg);
  return Promise.resolve(window.confirm(msg));
}

/** Prompt for a filename with inline validation. Returns sanitised string or null if cancelled. */
export async function promptFileName(message, defaultName) {
  const raw = await prompt(
    message,
    defaultName ?? "",
    {
      validator: (v) => v.trim().length > 0,
      validatorMsg: "File name cannot be empty. Please enter a name.",
    }
  );
  if (raw === null) return null;
  // Strip characters that are invalid in filesystem names
  // eslint-disable-next-line no-control-regex
  const sanitized = raw.trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, "").trim();
  return sanitized || null;
}
