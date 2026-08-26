import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import RulesPicker from "../RulesPicker";
import { mountComponent, byText, click } from "../../../test/renderHelpers";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../utils/api/client";
import { BUILT_IN_RULE_SETS } from "@physics-ide/shared";

/* Same idiom as assignmentEditor.test.js: stub react-query's three hooks
   rather than mounting a real QueryClientProvider. useMutation's stub
   actually drives the mutationFn (through the mocked `api`) so the "Save
   as…" POST body and its onSuccess (invalidateQueries) are real, not
   hand-waved. */
vi.mock("../../../utils/api/client", () => ({ api: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(),
}));

const invalidateQueries = vi.fn();

function typeInput(input, value) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** Find the <label>-wrapped <input> (radio or checkbox) whose visible text
 *  exactly matches — the radios (built-ins, saved sets, Custom…) and the
 *  switches are both rendered as a <label> wrapping its <input>. */
function inputFor(container, text) {
  const label = [...container.querySelectorAll("label")].find(
    (l) => l.textContent.replace(/\s+/g, " ").trim() === text,
  );
  return label ? label.querySelector("input") : null;
}

let mounted = null;

beforeEach(() => {
  useQuery.mockImplementation(() => ({ data: { ruleSets: [] }, error: null, isLoading: false }));
  useQueryClient.mockReturnValue({ invalidateQueries });
  useMutation.mockImplementation((opts) => ({
    mutate: (vars) => {
      Promise.resolve()
        .then(() => opts.mutationFn(vars))
        .then((data) => opts.onSuccess && opts.onSuccess(data, vars))
        .catch((err) => opts.onError && opts.onError(err));
    },
    isPending: false,
  }));
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.clearAllMocks();
});

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function render(props) {
  mounted = mountComponent(<RulesPicker {...props} />);
  return mounted.container;
}

describe("RulesPicker — built-in presets", () => {
  test("selecting Standard classwork emits BUILT_IN_RULE_SETS.standard_classwork", () => {
    const onChange = vi.fn();
    const container = render({ value: BUILT_IN_RULE_SETS.open_practice, onChange });

    click(inputFor(container, "Standard classwork"));

    expect(onChange).toHaveBeenCalledWith(BUILT_IN_RULE_SETS.standard_classwork);
  });
});

describe("RulesPicker — Custom…", () => {
  test('"Custom…" reveals six labelled switches seeded from the current value; flipping exportAndCopy emits the changed object', () => {
    const onChange = vi.fn();
    const value = BUILT_IN_RULE_SETS.standard_classwork;
    const container = render({ value, onChange });

    // Not revealed until Custom… is selected.
    expect(container.querySelector(".rules-switches")).toBeNull();

    click(inputFor(container, "Custom…"));

    const editorsSelect = container.querySelector(".rules-switches select");
    expect(editorsSelect).not.toBeNull();
    expect(editorsSelect.value).toBe(value.editors);

    // Seeded from the current value — standard_classwork's importFiles is off.
    const importSwitch = inputFor(container, "Import");
    expect(importSwitch.type).toBe("checkbox");
    expect(importSwitch.checked).toBe(false);

    const exportSwitch = inputFor(container, "Export & copy");
    expect(exportSwitch.checked).toBe(false);
    click(exportSwitch);

    expect(onChange).toHaveBeenCalledWith({ ...value, exportAndCopy: true });
  });
});

describe("RulesPicker — saved sets", () => {
  test("saved sets from the query render as options; choosing one emits its rules", () => {
    const savedRules = {
      editors: "code",
      debug: false,
      importFiles: true,
      exportAndCopy: true,
      advancedBlocks: false,
      templates: true,
    };
    useQuery.mockImplementation(() => ({
      data: { ruleSets: [{ id: "rs1", name: "Gr11 practicals", rules: savedRules }] },
      error: null,
      isLoading: false,
    }));
    const onChange = vi.fn();
    const container = render({ value: BUILT_IN_RULE_SETS.open_practice, onChange });

    const radio = inputFor(container, "Gr11 practicals");
    expect(radio).not.toBeNull();
    expect(radio.type).toBe("radio");

    click(radio);

    expect(onChange).toHaveBeenCalledWith(savedRules);
  });

  test("a saved set's delete control is a real, outlined btn--danger and posts DELETE, invalidating the rule-sets query", async () => {
    api.mockResolvedValueOnce(undefined);
    useQuery.mockImplementation(() => ({
      data: { ruleSets: [{ id: "rs1", name: "Gr11 practicals", rules: BUILT_IN_RULE_SETS.open_practice }] },
      error: null,
      isLoading: false,
    }));
    const container = render({ value: BUILT_IN_RULE_SETS.open_practice, onChange: vi.fn() });

    const deleteBtn = byText(container, "Delete");
    expect(deleteBtn).not.toBeNull();
    expect(deleteBtn.classList.contains("btn--danger")).toBe(true);
    // Never a filled destructive button — btn--danger alone (no btn--primary).
    expect(deleteBtn.classList.contains("btn--primary")).toBe(false);

    click(deleteBtn);
    await flush();

    expect(api).toHaveBeenCalledWith("/api/rule-sets/rs1", { method: "DELETE" });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["rule-sets"] });
  });
});

describe("RulesPicker — Save as…", () => {
  test('"Save as…" posts {name, rules} and invalidates the rule-sets query', async () => {
    const customValue = {
      editors: "code",
      debug: true,
      importFiles: true,
      exportAndCopy: false,
      advancedBlocks: true,
      templates: false,
    };
    api.mockResolvedValueOnce({ ruleSet: { id: "rs2", name: "Gr11 practicals", rules: customValue } });
    const container = render({ value: customValue, onChange: vi.fn() });

    // customValue matches none of the built-ins, so Custom… is already open.
    const nameInput = container.querySelector('input[placeholder="Name this rule set…"]');
    expect(nameInput).not.toBeNull();
    typeInput(nameInput, "Gr11 practicals");

    click(byText(container, "Save as…"));
    await flush();

    expect(api).toHaveBeenCalledWith("/api/rule-sets", {
      method: "POST",
      body: { name: "Gr11 practicals", rules: customValue },
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["rule-sets"] });
  });
});

describe("RulesPicker — switch labels", () => {
  test("the six switch labels are the spec's words, and each is a real checkbox except Editors (a three-way select)", () => {
    const container = render({ value: BUILT_IN_RULE_SETS.open_practice, onChange: vi.fn() });
    click(inputFor(container, "Custom…"));

    // Own text only — a <label> wrapping a <select> otherwise picks up
    // every (hidden) <option>'s text too via .textContent.
    const labels = [...container.querySelectorAll(".rules-switches label")].map((l) =>
      [...l.childNodes]
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    );
    expect(labels).toEqual([
      "Editors",
      "Debugging",
      "Import",
      "Export & copy",
      "Advanced blocks",
      "Templates",
    ]);

    const editorsSelect = container.querySelector(".rules-switches select");
    expect([...editorsSelect.options].map((o) => o.value)).toEqual(["blocks", "code", "both"]);

    ["Debugging", "Import", "Export & copy", "Advanced blocks", "Templates"].forEach((text) => {
      const input = inputFor(container, text);
      expect(input).not.toBeNull();
      expect(input.tagName).toBe("INPUT");
      expect(input.type).toBe("checkbox");
    });
  });
});
