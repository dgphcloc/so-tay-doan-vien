import React from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider } from "./context/AppContext";
import { AuthGate } from "./components/auth/AuthGate";
import { AppLayout } from "./components/layout/AppLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { ReviewPage } from "./pages/ReviewPage";
import { SubmitPage } from "./pages/SubmitPage";
import { FeedPage } from "./pages/FeedPage";
import { MemberSubmitPage } from "./pages/MemberSubmitPage";
import { MyProfilePage } from "./pages/MyProfilePage";
import { JournalPage } from "./pages/JournalPage";
import { TasksPage } from "./pages/TasksPage";
import { CriteriaPage } from "./pages/CriteriaPage";
import { UnitsPage } from "./pages/UnitsPage";
import { MembersPage } from "./pages/MembersPage";
import { CommitteePage } from "./pages/CommitteePage";
import { ReportsPage } from "./pages/ReportsPage";
import { RemindersPage } from "./pages/RemindersPage";
import { SettingsPage } from "./pages/SettingsPage";
import { AccountsPage } from "./pages/AccountsPage";
import { AuditLogsPage } from "./pages/AuditLogsPage";
import { EvaluationPage } from "./pages/EvaluationPage";
import { UnionFeePage } from "./pages/UnionFeePage";
import { SetupWizardPage } from "./pages/SetupWizardPage";
import { ConfirmProvider } from "./components/common/ConfirmDialog";
import { UnitReportPage } from "./pages/UnitReportPage";
import { QrGeneratorPage } from "./pages/QrGeneratorPage";
export default function App() {
  return (
    <AuthGate>
      <AppProvider>
        <ConfirmProvider>
          <HashRouter>
            <Routes>
              <Route path="/" element={<AppLayout />}>
                <Route index element={<DashboardPage />} />
                <Route path="duyet" element={<ReviewPage />} />
                <Route path="nop-minh-chung" element={<SubmitPage />} />
                <Route path="nop-ca-nhan" element={<MemberSubmitPage />} />
                <Route path="bang-tin" element={<FeedPage />} />
                <Route path="ho-so" element={<MyProfilePage />} />
                <Route path="so-tay" element={<JournalPage />} />
                <Route path="nhiem-vu" element={<TasksPage />} />
                <Route path="tieu-chi" element={<CriteriaPage />} />
                <Route path="nhac-nho" element={<RemindersPage />} />
                <Route path="chi-doan" element={<UnitsPage />} />
                <Route path="doan-vien" element={<MembersPage />} />
                <Route path="ban-chap-hanh" element={<CommitteePage />} />
                <Route
                  path="bch"
                  element={<Navigate to="/ban-chap-hanh" replace />}
                />
                <Route path="bao-cao" element={<ReportsPage />} />
                <Route path="cau-hinh" element={<SettingsPage />} />
                <Route path="tai-khoan" element={<AccountsPage />} />
                <Route path="nhat-ky" element={<AuditLogsPage />} />
                <Route path="danh-gia" element={<EvaluationPage />} />
                <Route path="doan-phi" element={<UnionFeePage />} />
                <Route path="thiet-lap" element={<SetupWizardPage />} />
                <Route path="bao-cao-chi-doan" element={<UnitReportPage />} />
                <Route path="tao-qr" element={<QrGeneratorPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </HashRouter>
        </ConfirmProvider>
      </AppProvider>
    </AuthGate>
  );
}
