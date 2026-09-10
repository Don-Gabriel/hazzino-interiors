import { useEditor } from "./store.js";
import { entity, validateProject, bom } from "../shared/model.js";
export function registerModelTools() {
  const context = globalThis.document?.modelContext;
  if (!context?.registerTool) return () => {};
  const lifecycle = new AbortController();
  const register = (tool) => {
    try {
      Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal }),
      ).catch((e) => console.warn("Model tool registration:", e.message));
    } catch (e) {
      console.warn(e.message);
    }
  };
  register({
    name: "read_design",
    description:
      "Read the active local design, selected IDs, dimensions in millimetres, and current material quantities.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: () => {
      const s = useEditor.getState();
      return {
        project: s.project,
        selection: s.selection,
        quantities: bom(s.project),
      };
    },
  });
  register({
    name: "create_boards",
    description:
      "Create one or more individually editable rectangular boards in the active design. Dimensions and centre positions are in millimetres.",
    inputSchema: {
      type: "object",
      properties: {
        boards: {
          type: "array",
          minItems: 1,
          maxItems: 100,
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              size: {
                type: "array",
                items: { type: "number" },
                minItems: 3,
                maxItems: 3,
              },
              position: {
                type: "array",
                items: { type: "number" },
                minItems: 3,
                maxItems: 3,
              },
            },
            required: ["name", "size", "position"],
            additionalProperties: false,
          },
        },
      },
      required: ["boards"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: (input) => {
      if (
        !Array.isArray(input?.boards) ||
        !input.boards.length ||
        input.boards.length > 100
      )
        throw Error("Expected 1–100 boards");
      const objects = input.boards.map((b) =>
        entity({ name: b.name, size: b.size, position: b.position }),
      );
      const s = useEditor.getState();
      validateProject({
        ...s.project,
        objects: [...s.project.objects, ...objects],
      });
      s.add(objects, "Create boards");
      return { ids: objects.map((o) => o.id), count: objects.length };
    },
  });
  register({
    name: "save_design",
    description: "Save the active design to the connected workspace storage.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async () => {
      const s = useEditor.getState();
      if (!(await s.save())) throw Error(useEditor.getState().status);
      return { id: s.project.id, saved: true };
    },
  });
  return () => lifecycle.abort();
}
