import React from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "./ThemeContext";
import App from "./App";
import "./styles.css";

const container = document.getElementById("root");
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
