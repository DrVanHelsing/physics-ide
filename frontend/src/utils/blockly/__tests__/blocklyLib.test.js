import { describe, test, expect } from "vitest";
import Blockly from "../blocklyLib";

describe("blocklyLib", () => {
  test("is the pinned bundled namespace, fully assembled", () => {
    expect(Blockly.VERSION).toBe("11.2.2");
    expect(typeof Blockly.inject).toBe("function");
    // Python generator attached under the legacy global's name
    expect(typeof Blockly.Python.workspaceToCode).toBe("function");
    // locale installed (blockly/msg/en side-effect)
    expect(Blockly.Msg.DUPLICATE_BLOCK).toBeTruthy();
    // standard blocks registered (blockly/blocks side-effect)
    expect(Blockly.Blocks.controls_if).toBeTruthy();
    // the renderer the app injects with
    expect(Blockly.registry.hasItem(Blockly.registry.Type.RENDERER, "zelos")).toBe(true);
  });
});
