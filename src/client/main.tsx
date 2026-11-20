// SPDX-License-Identifier: AGPL-3.0-or-later
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/themes.css";

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
