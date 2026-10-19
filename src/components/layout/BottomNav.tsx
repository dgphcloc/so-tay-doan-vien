import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { canAccessRoute } from '../../utils/permissions';
import {
  LayoutDashboard,
  FileCheck2,
  CheckSquare,
  Building2,
  Menu,
  X,
  Award,
  BellRing,
  Users,
  UserCheck,
  BarChart3,
  Sliders,
  ShieldCheck,
  History,
  Shield,
  Upload,
  Newspaper,
  UserCircle,
  BookOpen,
} from 'lucide-react';

export const BottomNav: React.FC = () => {
  const { currentRole, pendingCount } = useApp();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const navigate = useNavigate();

  const isStaff = currentRole === 'staff';
  const isSecretaryOrMember = currentRole === 'unit_secretary' || currentRole === 'member';

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center justify-center py-2 px-1 text-[11px] font-medium transition-colors relative ${
      isActive ? 'text-[#1F5FBF] font-bold' : 'text-slate-500 hover:text-slate-900'
    }`;

  const moreItems = [
    { to: '/nop-ca-nhan', label: 'Nộp cá nhân', icon: Upload, roleAllowed: currentRole === 'unit_secretary' && canAccessRoute(currentRole, '/nop-ca-nhan') },
    { to: '/bang-tin', label: 'Bảng tin', icon: Newspaper, roleAllowed: canAccessRoute(currentRole, '/bang-tin') },
    { to: '/ho-so', label: 'Hồ sơ của tôi', icon: UserCircle, roleAllowed: canAccessRoute(currentRole, '/ho-so') },
    { to: '/so-tay', label: 'Sổ tay', icon: BookOpen, roleAllowed: canAccessRoute(currentRole, '/so-tay') },
    { to: '/tieu-chi', label: 'Tiêu chí', icon: Award, roleAllowed: canAccessRoute(currentRole, '/tieu-chi') },
    { to: '/doan-vien', label: 'Đoàn viên', icon: Users, roleAllowed: canAccessRoute(currentRole, '/doan-vien') },
    { to: '/ban-chap-hanh', label: 'Ban chấp hành', icon: UserCheck, roleAllowed: canAccessRoute(currentRole, '/ban-chap-hanh') },
    { to: '/bao-cao', label: 'Báo cáo', icon: BarChart3, roleAllowed: canAccessRoute(currentRole, '/bao-cao') },
    { to: '/nhac-nho', label: 'Nhắc nhở', icon: BellRing, roleAllowed: canAccessRoute(currentRole, '/nhac-nho') },
    { to: '/cau-hinh', label: 'Cấu hình', icon: Sliders, roleAllowed: canAccessRoute(currentRole, '/cau-hinh') },
    { to: '/tai-khoan', label: 'Tài khoản & quyền', icon: ShieldCheck, roleAllowed: currentRole === 'super_admin' },
    { to: '/nhat-ky', label: 'Nhật ký', icon: History, roleAllowed: currentRole === 'super_admin' },
  ];

  return (
    <>
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-lg safe-area-bottom">
        <div className="grid grid-cols-5 items-center text-center h-15">
          <NavLink to="/" end className={navItemClass}>
            <LayoutDashboard className="w-5 h-5 mb-0.5" />
            <span>Tổng quan</span>
          </NavLink>

          {isSecretaryOrMember ? (
            <NavLink to={currentRole === 'member' ? '/nop-ca-nhan' : '/nop-minh-chung'} className={navItemClass}>
              <Upload className="w-5 h-5 mb-0.5" />
              <span>{currentRole === 'member' ? 'Nộp cá nhân' : 'Nộp minh chứng'}</span>
            </NavLink>
          ) : !isStaff ? (
            <NavLink to="/duyet" className={navItemClass}>
              <div className="relative">
                <FileCheck2 className="w-5 h-5 mb-0.5" />
                {pendingCount > 0 && (
                  <span className="absolute -top-1 -right-2 px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-red-500 text-white">
                    {pendingCount}
                  </span>
                )}
              </div>
              <span>Chờ duyệt</span>
            </NavLink>
          ) : (
            <NavLink to="/tieu-chi" className={navItemClass}>
              <Award className="w-5 h-5 mb-0.5" />
              <span>Tiêu chí</span>
            </NavLink>
          )}

          {canAccessRoute(currentRole, '/nhiem-vu') && (
            <NavLink to="/nhiem-vu" className={navItemClass}>
              <CheckSquare className="w-5 h-5 mb-0.5" />
              <span>Nhiệm vụ</span>
            </NavLink>
          )}

          <NavLink to="/chi-doan" className={navItemClass}>
            <Building2 className="w-5 h-5 mb-0.5" />
            <span>Chi đoàn</span>
          </NavLink>

          <button
            type="button"
            onClick={() => setShowMoreMenu(true)}
            className="flex flex-col items-center justify-center py-2 px-1 text-[11px] font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
          >
            <Menu className="w-5 h-5 mb-0.5" />
            <span>Thêm</span>
          </button>
        </div>
      </nav>

      {/* Sliding Bottom Sheet for 'Thêm' */}
      {showMoreMenu && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full bg-white rounded-t-2xl p-5 shadow-2xl max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom duration-200"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-800">Tất cả chức năng</span>
                <span className="text-[10px] bg-blue-100 text-[#1F5FBF] px-2 py-0.5 rounded font-semibold capitalize">
                  {currentRole}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowMoreMenu(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 py-4">
              {moreItems
                .filter(item => item.roleAllowed)
                .map(item => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.to}
                      type="button"
                      onClick={() => {
                        setShowMoreMenu(false);
                        navigate(item.to);
                      }}
                      className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-[#1F5FBF] text-xs font-semibold text-left transition-colors cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-lg bg-white shadow-2xs flex items-center justify-center text-slate-600 shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
