/**
 * App.js — provider shell + router
 *
 * The IDE stays exactly what it was at "/" (IDELayout inside the original
 * provider stack). Auth, profile and admin screens are sibling routes.
 */
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SyncProvider           from "./sync/SyncProvider";
import { ThemeProvider }      from "./contexts/ThemeContext";
import { SimulationProvider } from "./contexts/SimulationContext";
import { ProjectProvider }    from "./contexts/ProjectContext";
import { DebugProvider }      from "./contexts/DebugContext";
import { TraceProvider }      from "./contexts/TraceContext";
import ErrorBoundary          from "./components/common/ErrorBoundary";
import IDELayout              from "./components/layout/IDELayout";
import WelcomeGate            from "./welcome/WelcomeGate";
import WelcomePage            from "./welcome/WelcomePage";
import AboutPage              from "./welcome/AboutPage";
import ContactPage            from "./welcome/ContactPage";
import TeachersPage           from "./welcome/TeachersPage";
import SignUpPage             from "./components/auth/SignUpPage";
import SignInPage             from "./components/auth/SignInPage";
import CheckEmailPage         from "./components/auth/CheckEmailPage";
import ConfirmPage            from "./components/auth/ConfirmPage";
import ForgotPage             from "./components/auth/ForgotPage";
import ResetPage              from "./components/auth/ResetPage";
import ProfilePage            from "./components/auth/ProfilePage";
import AdminConsole           from "./components/admin/AdminConsole";
import ClassesHome            from "./components/classes/ClassesHome";
import AssignmentsTab         from "./components/assignments/AssignmentsTab";
import AssignmentPage         from "./components/assignments/AssignmentPage";
import AssignmentEditorPage   from "./components/assignments/AssignmentEditorPage";
import InboxPage              from "./components/assignments/InboxPage";
import GuidesTab              from "./components/assignments/GuidesTab";
import GuidePage              from "./components/assignments/GuidePage";
import GradebookTab           from "./components/assignments/GradebookTab";
import HistoryPage            from "./components/assignments/HistoryPage";
import PeopleTab              from "./components/classes/PeopleTab";
import SettingsTab            from "./components/classes/SettingsTab";
import JoinClassPage          from "./components/classes/JoinClassPage";
import InviteLandingPage      from "./components/classes/InviteLandingPage";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SyncProvider>
          <ThemeProvider>
            <SimulationProvider>
              <ProjectProvider>
                <DebugProvider>
                  <TraceProvider>
                    <ErrorBoundary>
                      <Routes>
                        <Route path="/" element={<WelcomeGate><IDELayout /></WelcomeGate>} />
                        <Route path="/welcome" element={<WelcomePage />} />
                        <Route path="/about" element={<AboutPage />} />
                        <Route path="/contact" element={<ContactPage />} />
                        <Route path="/teachers" element={<TeachersPage />} />
                        <Route path="/auth/signup" element={<SignUpPage />} />
                        <Route path="/auth/signin" element={<SignInPage />} />
                        <Route path="/auth/check-email" element={<CheckEmailPage />} />
                        <Route path="/auth/confirm" element={<ConfirmPage />} />
                        <Route path="/auth/forgot" element={<ForgotPage />} />
                        <Route path="/auth/reset" element={<ResetPage />} />
                        <Route path="/profile" element={<ProfilePage />} />
                        {/* Task 20: the History screen (D§6) — a signed-in user's own
                            project checkpoints, restore wired to the sync engine. */}
                        <Route path="/history/:projectId" element={<HistoryPage />} />
                        <Route path="/admin" element={<AdminConsole />} />
                        <Route path="/classes" element={<ClassesHome />} />
                        <Route path="/classes/:id" element={<AssignmentsTab />} />
                        <Route path="/classes/:id/assignments/new" element={<AssignmentEditorPage />} />
                        <Route path="/classes/:id/assignments/:aid/edit" element={<AssignmentEditorPage />} />
                        <Route path="/classes/:id/assignments/:aid" element={<AssignmentPage />} />
                        <Route path="/classes/:id/assignments/:aid/inbox" element={<InboxPage />} />
                        <Route path="/classes/:id/guides" element={<GuidesTab />} />
                        <Route path="/classes/:id/guides/new" element={<GuidePage mode="edit" />} />
                        <Route path="/classes/:id/guides/:gid" element={<GuidePage mode="read" />} />
                        <Route path="/classes/:id/guides/:gid/edit" element={<GuidePage mode="edit" />} />
                        <Route path="/classes/:id/gradebook" element={<GradebookTab />} />
                        <Route path="/classes/:id/people" element={<PeopleTab />} />
                        <Route path="/classes/:id/settings" element={<SettingsTab />} />
                        <Route path="/join" element={<JoinClassPage />} />
                        <Route path="/join/invite" element={<InviteLandingPage />} />
                        <Route path="/join/:code" element={<JoinClassPage />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </ErrorBoundary>
                  </TraceProvider>
                </DebugProvider>
              </ProjectProvider>
            </SimulationProvider>
          </ThemeProvider>
        </SyncProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
