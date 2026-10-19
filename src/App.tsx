import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AuthGate } from './components/auth/AuthGate';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { ReviewPage } from './pages/ReviewPage';
import { SubmitPage } from './pages/SubmitPage';
import { FeedPage } from './pages/FeedPage';
import { MemberSubmitPage } from './pages/MemberSubmitPage';
import { MyProfilePage } from './pages/MyProfilePage';
import { JournalPage } from './pages/JournalPage';
import { TasksPage } from './pages/TasksPage';
import { CriteriaPage } from './pages/CriteriaPage';
import { UnitsPage } from './pages/UnitsPage';
import { MembersPage } from './pages/MembersPage';
import { CommitteePage } from './pages/CommitteePage';
import { ReportsPage } from './pages/ReportsPage';
import { RemindersPage } from './pages/RemindersPage';
import { SettingsPage } from './pages/SettingsPage';
import { AccountsPage } from './pages/AccountsPage';
import { AuditLogsPage } from './pages/AuditLogsPage';

export default function App() {
  return (
    <AuthGate>
      <AppProvider>
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
              <Route path="bch" element={<Navigate to="/ban-chap-hanh" replace />} />
              <Route path="bao-cao" element={<ReportsPage />} />
              <Route path="cau-hinh" element={<SettingsPage />} />
              <Route path="tai-khoan" element={<AccountsPage />} />
              <Route path="nhat-ky" element={<AuditLogsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </HashRouter>
      </AppProvider>
    </AuthGate>
  );
}
