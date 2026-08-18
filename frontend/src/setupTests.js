/**
 * Jest setup — CRA wires this file automatically (it lives alongside
 * `src/index.js`). Polyfills here run before each test suite.
 *
 * Why this exists: Arquero pulls in `@uwdata/flechette`, which uses
 * `TextDecoder` / `TextEncoder` at module load. jsdom in CRA's Jest
 * configuration does not expose them globally, so we patch them in
 * from Node's `util` module.
 */
import { TextDecoder, TextEncoder } from "util";

if (typeof globalThis.TextDecoder === "undefined") {
  globalThis.TextDecoder = TextDecoder;
}
if (typeof globalThis.TextEncoder === "undefined") {
  globalThis.TextEncoder = TextEncoder;
}
