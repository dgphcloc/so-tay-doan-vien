import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { ToastContainer } from '../common/ToastContainer';
import { RequireRole } from '../auth/RequireRole';

export const AppLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-800">
      <Navbar />
      <div className="flex-1 flex max-w-[1720px] w-full mx-auto">
        <Sidebar />
        <main className="flex-1 min-w-0 p-3 sm:p-5 md:p-6 lg:p-8 pb-24 lg:pb-10">
          <RequireRole>
            <Outlet />
          </RequireRole>
        </main>
      </div>
      <BottomNav />
      <ToastContainer />
    </div>
  );
};
