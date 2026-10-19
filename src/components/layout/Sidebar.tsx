import React from 'react';
import { NavLink } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import {
  LayoutDashboard,
  FileCheck2,
  CheckSquare,
  Award,
  BellRing,
  Building2,
  Users,
  UserCheck,
  BarChart3,
  Sliders,
  ShieldCheck,
  History,
  Upload,
  Newspaper,
  UserCircle,
  Camera,
  BookOpen,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { currentRole, pendingCount, units, totalMembers } = useApp();

  // Kiểm tra hiển thị từng menu item theo quyền
  const canSee = (menuKey: string) => {
    if (currentRole === 'super_admin') return true;

    if (currentRole === 'admin') {
      if (menuKey === 'accounts' || menuKey === 'logs') return false;
      return true;
    }

    if (currentRole === 'staff') {
      // staff chỉ xem: Tổng quan, Nhiệm vụ, Tiêu chí, Chi đoàn, Đoàn viên, Ban chấp hành, Báo cáo
      const staffAllowed = ['overview', 'tasks', 'criteria', 'units', 'members', 'committee', 'reports', 'journal'];
      return staffAllowed.includes(menuKey);
    }

    if (currentRole === 'unit_secretary') {
      // Bí thư chi đoàn: Nộp minh chứng, Bảng tin, Nhiệm vụ (của chi đoàn mình), Chi đoàn của mình
      const allowed = ['overview', 'submit', 'personal', 'feed', 'review', 'profile', 'journal', 'tasks', 'units'];
      return allowed.includes(menuKey);
    }

    if (currentRole === 'member') {
      const allowed = ['overview', 'personal', 'feed', 'profile', 'journal'];
      return allowed.includes(menuKey);
    }

    return false;
  };

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center justify-between px-3 py-2 text-xs md:text-sm font-medium rounded-xl transition-all ${
      isActive
        ? 'bg-[#1F5FBF] text-white shadow-xs font-semibold'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/90'
    }`;

  return (
    <aside className="hidden lg:flex flex-col w-64 shrink-0 bg-white border-r border-slate-200/90 min-h-[calc(100vh-4rem)] p-4 select-none">
      <div className="space-y-6">
        {/* Tổng quan (đầu) */}
        <div>
          <NavLink to="/" end className={navItemClass}>
            <div className="flex items-center gap-2.5">
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span>Tổng quan</span>
            </div>
          </NavLink>
        </div>

        {/* Nhóm: Công việc */}
        {(canSee('submit') || canSee('personal') || canSee('feed') || canSee('review') || canSee('tasks') || canSee('criteria') || canSee('reminders')) && (
          <div className="space-y-1">
            <p className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Công việc</p>

            {canSee('submit') && (
              <NavLink to="/nop-minh-chung" className={navItemClass}>
                <div className="flex items-center gap-2.5">
                  <Upload className="w-4 h-4 shrink-0" />
                  <span>Nộp minh chứng</span>
                </div>
              </NavLink>
            )}

            {canSee('personal') && (
              <NavLink to="/nop-ca-nhan" className={navItemClass}>
                <div className="flex items-center gap-2.5">
                  <Camera className="w-4 h-4 shrink-0" />
                  <span>Nộp cá nhân</span>
                </div>
              </NavLink>
            )}

            {canSee('feed') && (
              <NavLink to="/bang-tin" className={navItemClass}>
                <div className="flex items-center gap-2.5">
                  <Newspaper className="w-4 h-4 shrink-0" />
                  <span>Bảng tin</span>
                </div>
              </NavLink>
            )}

            {canSee('review') && (
              <NavLink to="/duyet" className={navItemClass}>
                <div className="flex items-center gap-2.5">
                  <FileCheck2 className="w-4 h-4 shrink-0" />
                  <span>Chờ duyệt</span>
                </div>
                {pendingCount > 0 && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-red-500 text-white shadow-xs animate-pulse">
                    {pendingCount}
                  </span>
                )}
              </NavLink>
            )}

            {canSee('tasks') && (
              <NavLink to="/nhiem-vu" className={navItemClass}>
                <div className="flex items-center gap-2.5">
                  <CheckSquare className="w-4 h-4 shrink-0" />
                  <span>Nhiệm vụ</span>
                </div>
              </NavLink>
            )}

            {canSee('criteria') && (
              <NavLink to="/tieu-chi" className={navItemClass}>
                <div className="flex items-center gap-2.5">
                  <Award className="w-4 h-4 shrink-0" />
                  <span>Tiêu chí</span>
                </div>
              </NavLink>
            )}

            {canSee('reminders') && (
              <NavLink to="/nhac-nho" className={navItemClass}>
                <div className="flex items-center gap-2.5">
                  <BellRing className="w-4 h-4 shrink-0" />
                  <span>Nhắc nhở</span>
                </div>
              </NavLink>
            )}
          </div>
        )}

        {/* Nhóm: Tổ chức */}
        {(canSee('units') || canSee('members') || canSee('committee')) && (
          <div className="space-y-1">
            <p className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tổ chức</p>

            {canSee('units') && (
              <NavLink to="/chi-doan" className={navItemClass}>
                <div className="flex items-center gap-2.5">
                  <Building2 className="w-4 h-4 shrink-0" />
                  <span>Chi đoàn</span>
                </div>
              </NavLink>
            )}

            {canSee('members') && (
              <NavLink to="/doan-vien" className={navItemClass}>
                <div className="flex items-center gap-2.5">
                  <Users className="w-4 h-4 shrink-0" />
                  <span>Đoàn viên</span>
                </div>
              </NavLink>
            )}

            {canSee('committee') && (
              <NavLink to="/ban-chap-hanh" className={navItemClass}>
                <div className="flex items-center gap-2.5">
                  <UserCheck className="w-4 h-4 shrink-0" />
                  <span>Ban chấp hành</span>
                </div>
              </NavLink>
            )}
          </div>
        )}

        {/* Nhóm: Báo cáo */}
        {canSee('reports') && (
          <div className="space-y-1">
            <p className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Báo cáo</p>
            <NavLink to="/bao-cao" className={navItemClass}>
              <div className="flex items-center gap-2.5">
                <BarChart3 className="w-4 h-4 shrink-0" />
                <span>Báo cáo</span>
              </div>
            </NavLink>
          </div>
        )}

        {/* Nhóm: Hệ thống */}
        {(canSee('settings') || canSee('accounts') || canSee('logs')) && (
          <div className="space-y-1">
            <p className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Hệ thống</p>

            {canSee('settings') && (
              <NavLink to="/cau-hinh" className={navItemClass}>
                <div className="flex items-center gap-2.5">
                  <Sliders className="w-4 h-4 shrink-0" />
                  <span>Cấu hình</span>
                </div>
              </NavLink>
            )}

            {canSee('accounts') && (
              <NavLink to="/tai-khoan" className={navItemClass}>
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Tài khoản & quyền</span>
                </div>
              </NavLink>
            )}

            {canSee('logs') && (
              <NavLink to="/nhat-ky" className={navItemClass}>
                <div className="flex items-center gap-2.5">
                  <History className="w-4 h-4 shrink-0" />
                  <span>Nhật ký</span>
                </div>
              </NavLink>
            )}
          </div>
        )}

        {/* Hồ sơ của tôi + Sổ tay */}
        {canSee('profile') && (
          <div className="space-y-1">
            <NavLink to="/ho-so" className={navItemClass}>
              <div className="flex items-center gap-2.5">
                <UserCircle className="w-4 h-4 shrink-0" />
                <span>Hồ sơ của tôi</span>
              </div>
            </NavLink>
            {canSee('journal') && (
              <NavLink to="/so-tay" className={navItemClass}>
                <div className="flex items-center gap-2.5">
                  <BookOpen className="w-4 h-4 shrink-0" />
                  <span>Sổ tay</span>
                </div>
              </NavLink>
            )}
          </div>
        )}
      </div>

      {/* Footer Info Box */}
      <div className="mt-auto pt-6 border-t border-slate-100">
        <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-slate-600">
          <div className="flex items-center gap-1.5 font-bold text-[#1F5FBF]">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Hệ thống cấp Xã
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Xã Hòa Bình, tỉnh Cà Mau</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{units.length} Chi đoàn • {totalMembers} Đoàn viên</p>
        </div>
      </div>
    </aside>
  );
};
