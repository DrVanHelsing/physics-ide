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

/** Called by BlocklyWorkspace to show a prompt dialog. Returns a Promise. */
export function prompt(msg, defaultVal) {
  if (_service) return _service.prompt(msg, defaultVal ?? "");
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
