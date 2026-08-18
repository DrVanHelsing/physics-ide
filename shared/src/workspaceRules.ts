import { z } from "zod";

/** Which tools an assignment's workspace offers — spec §5.4. */
export const WorkspaceRulesSchema = z.object({
  editors: z.enum(["blocks", "code", "both"]),
  debug: z.boolean(),
  importFiles: z.boolean(),
  exportAndCopy: z.boolean(),
  advancedBlocks: z.boolean(),
  templates: z.boolean(),
});

export type WorkspaceRules = z.infer<typeof WorkspaceRulesSchema>;

export const BUILT_IN_RULE_SETS: Record<
  "open_practice" | "standard_classwork" | "locked_assessment",
  WorkspaceRules
> = {
  open_practice: {
    editors: "both",
    debug: true,
    importFiles: true,
    exportAndCopy: true,
    advancedBlocks: true,
    templates: true,
  },
  standard_classwork: {
    editors: "both",
    debug: true,
    importFiles: false,
    exportAndCopy: false,
    advancedBlocks: true,
    templates: false,
  },
  locked_assessment: {
    editors: "both",
    debug: false,
    importFiles: false,
    exportAndCopy: false,
    advancedBlocks: false,
    templates: false,
  },
};
