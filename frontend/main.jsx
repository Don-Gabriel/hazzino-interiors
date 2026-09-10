import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";
import "./workspace.css";
import { registerModelTools } from "./webmcp.js";
import { initKernel } from "../shared/solid-kernel.js";
import wasmUrl from "manifold-3d/manifold.wasm?url";
import { latestRecovery } from "./recovery.js";
import { useEditor } from "./store.js";
initKernel({ locateFile: () => wasmUrl }).catch((error) =>
  console.error("Solid engine:", error.message),
);
async function start() {
  const project = await latestRecovery();
  if (project) useEditor.setState({ project });
  registerModelTools();
  createRoot(document.getElementById("root")).render(<App />);
}
start();
