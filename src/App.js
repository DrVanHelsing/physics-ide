/**
 * App.js — slim provider shell
 *
 * Composes all React context providers in the correct nesting order and
 * renders the single IDELayout component inside an error boundary.
 * All business logic lives in contexts, hooks, and IDELayout.
 */
import React from "react";
import { ThemeProvider }      from "./contexts/ThemeContext";
import { SimulationProvider } from "./contexts/SimulationContext";
import { ProjectProvider }    from "./contexts/ProjectContext";
import { DebugProvider }      from "./contexts/DebugContext";
import { TraceProvider }      from "./contexts/TraceContext";
import ErrorBoundary          from "./components/common/ErrorBoundary";
import IDELayout              from "./components/layout/IDELayout";

function App() {
  return (
    <ThemeProvider>
      <SimulationProvider>
        <ProjectProvider>
          <DebugProvider>
            <TraceProvider>
              <ErrorBoundary>
                <IDELayout />
              </ErrorBoundary>
            </TraceProvider>
          </DebugProvider>
        </ProjectProvider>
      </SimulationProvider>
    </ThemeProvider>
  );
}

export default App;
