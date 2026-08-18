/**
 * App.js — provider shell + router
 *
 * The IDE stays exactly what it was at "/" (IDELayout inside the original
 * provider stack). Auth, profile and admin screens are sibling routes.
 */
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider }      from "./contexts/ThemeContext";
import { SimulationProvider } from "./contexts/SimulationContext";
import { ProjectProvider }    from "./contexts/ProjectContext";
import { DebugProvider }      from "./contexts/DebugContext";
import { TraceProvider }      from "./contexts/TraceContext";
import ErrorBoundary          from "./components/common/ErrorBoundary";
import IDELayout              from "./components/layout/IDELayout";
import SignUpPage             from "./components/auth/SignUpPage";
import SignInPage             from "./components/auth/SignInPage";
import CheckEmailPage         from "./components/auth/CheckEmailPage";
import ConfirmPage            from "./components/auth/ConfirmPage";
import ForgotPage             from "./components/auth/ForgotPage";
import ResetPage              from "./components/auth/ResetPage";
import ProfilePage            from "./components/auth/ProfilePage";
import AdminConsole           from "./components/admin/AdminConsole";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <SimulationProvider>
            <ProjectProvider>
              <DebugProvider>
                <TraceProvider>
                  <ErrorBoundary>
                    <Routes>
                      <Route path="/" element={<IDELayout />} />
                      <Route path="/auth/signup" element={<SignUpPage />} />
                      <Route path="/auth/signin" element={<SignInPage />} />
                      <Route path="/auth/check-email" element={<CheckEmailPage />} />
                      <Route path="/auth/confirm" element={<ConfirmPage />} />
                      <Route path="/auth/forgot" element={<ForgotPage />} />
                      <Route path="/auth/reset" element={<ResetPage />} />
                      <Route path="/profile" element={<ProfilePage />} />
                      <Route path="/admin" element={<AdminConsole />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </ErrorBoundary>
                </TraceProvider>
              </DebugProvider>
            </ProjectProvider>
          </SimulationProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
