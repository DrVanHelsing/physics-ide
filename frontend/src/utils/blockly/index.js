/**
 * src/utils/blockly/index.js
 *
 * Public API for the Blockly utilities sub-package.
 * Import from this barrel to keep import paths clean.
 *
 * @example
 *   import { defineCustomBlocksAndGenerator, BLOCK_CATALOGUE } from '../utils/blockly';
 */
export { traceRegistry, clearTraceRegistry }           from './traceRegistry';
export {
  customConstantsRegistry,
  defineCustomBlocksAndGenerator,
  BLOCK_CATALOGUE,
  generatePythonFromWorkspace,
}                                                       from './blocklyGenerator';
