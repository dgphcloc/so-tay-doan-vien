import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase, dataSource } from '../../data';
import { RoleId } from '../../types';
import {
  Bell,
  Search,
  Calendar,
  Shield,
  UserCheck,
  Check,
  ChevronDown,
  Layers,
  Flag,
  FileCheck2,
  ExternalLink,
  LogOut,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export const Navbar: React.FC = () => {
  const {
    currentRole,
    setCurrentRole,
    currentUser,
    currentMember,
    selectedYear,
    setSelectedYear,
    globalSearch,
    setGlobalSearch,
    notifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    pendingCount,
    showToast,
    units,
  } = useApp();

  // Tên vai trò tiếng Việt để hiển thị
  const ROLE_LABEL: Record<RoleId, string> = {
    super_admin: 'Quản trị viên tối cao',
    admin: 'Bí thư Đoàn xã',
    staff: 'Cán bộ Đoàn xã',
    unit_secretary: 'Bí thư Chi đoàn',
    member: 'Đoàn viên',
  };
  // Tên hiển thị: ưu tiên hồ sơ đoàn viên gắn tài khoản, sau đó email, cuối cùng là "Người dùng"
  const displayName = currentMember?.full_name ?? currentUser?.email ?? 'Người dùng';
  const roleLabel = ROLE_LABEL[currentRole] ?? 'Người dùng';
  const avatarUrl = currentMember?.avatar_url || `https://i.pravatar.cc/80?u=${currentUser?.profileId ?? 'guest'}`;
  // Bí thư chi đoàn / đoàn viên: hiện thêm đang thuộc chi đoàn nào
  const myUnitName = currentMember
    ? (units.find(u => u.id === currentMember.unit_id)?.name ?? '')
    : '';
  const showUnitLine = (currentRole === 'unit_secretary' || currentRole === 'member') && !!myUnitName;

  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const roleRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (roleRef.current && !roleRef.current.contains(e.target as Node)) {
        setShowRoleMenu(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const rolesConfig: Array<{ id: RoleId; label: string; desc: string }> = [
    { id: 'super_admin', label: 'Quản trị viên tối cao (Super Admin)', desc: 'Thấy toàn bộ 11 chức năng hệ thống' },
    { id: 'admin', label: 'Quản trị viên Đoàn xã (Admin)', desc: 'Ẩn: Tài khoản & quyền, Nhật ký' },
    { id: 'staff', label: 'Cán bộ theo dõi (Staff)', desc: 'Chỉ đọc 6 mục, ẩn Chờ duyệt/Cấu hình, che 6 số giữa SĐT' },
  ];

  const handleSelectRole = (newRole: RoleId) => {
    setCurrentRole(newRole);
    setShowRoleMenu(false);
    showToast({
      title: 'Đã chuyển góc nhìn quyền',
      description: `Đang xem với quyền: ${rolesConfig.find(r => r.id === newRole)?.label}`,
      type: 'info',
    });
  };

  return (
    <header className="sticky top-0 z-40 w-full h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-2xs">
      <div className="h-full px-3 md:px-6 flex items-center justify-between gap-3">
        {/* Logo & App Name */}
        <div className="flex items-center gap-3 shrink-0">
          <Link to="/" className="flex items-center gap-2.5 text-slate-800 hover:opacity-90 transition-opacity">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-[#1F5FBF] to-[#2563eb] text-white flex items-center justify-center shadow-xs">
              <Flag className="w-5 h-5 text-white fill-white/20" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base tracking-tight text-slate-900 leading-none">
                  Sổ tay Đoàn viên
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-sm bg-blue-100 text-[#1F5FBF]">
                  Quản trị
                </span>
              </div>
              <span className="text-xs text-slate-500 font-medium">Đoàn Thanh niên xã Hòa Bình</span>
            </div>
          </Link>
        </div>

        {/* Ô tìm kiếm toàn cục đã bỏ: mỗi trang có ô tìm riêng.
            Chừa khoảng trống để nhóm bên phải vẫn dạt phải. */}
        <div className="hidden sm:block flex-1" />

        {/* Right Action Group */}
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          {/* Quyền Demo Switcher — chỉ hiện ở chế độ mock (chưa đăng nhập thật) */}
          {!currentUser && (
          <div className="relative" ref={roleRef}>
            <button
              type="button"
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs md:text-sm font-medium bg-blue-50/80 hover:bg-blue-100 text-[#1F5FBF] border border-blue-200/80 rounded-lg transition-colors cursor-pointer"
              title="Chuyển quyền để xem mô phỏng phân quyền menu"
            >
              <Shield className="w-3.5 h-3.5 text-[#1F5FBF]" />
              <span className="hidden xl:inline">Xem với quyền:</span>
              <span className="font-semibold capitalize">
                {currentRole === 'super_admin' ? 'Super Admin' : currentRole === 'admin' ? 'Admin' : 'Staff'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[#1F5FBF]" />
            </button>

            {showRoleMenu && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-lg border border-slate-200 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Mô phỏng phân quyền</p>
                  <p className="text-xs text-slate-500 mt-0.5">Chọn vai trò để kiểm tra hiển thị menu</p>
                </div>
                <div className="py-1">
                  {rolesConfig.map(r => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => handleSelectRole(r.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs flex flex-col gap-0.5 transition-colors cursor-pointer ${
                        currentRole === r.id ? 'bg-blue-50 text-[#1F5FBF] font-semibold' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{r.label}</span>
                        {currentRole === r.id && <Check className="w-4 h-4 text-[#1F5FBF]" />}
                      </div>
                      <span className="text-[11px] text-slate-400 font-normal">{r.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          )}

          {/* Notification Bell */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              aria-label="Thông báo"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 p-0 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">Thông báo hệ thống</span>
                    {unreadCount > 0 && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                        {unreadCount} mới
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllNotificationsAsRead}
                      className="text-xs text-[#1F5FBF] hover:underline cursor-pointer font-medium"
                    >
                      Đã đọc tất cả
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">Không có thông báo nào</div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        onClick={() => {
                          markNotificationAsRead(n.id);
                          if (n.type === 'review_request') {
                            setShowNotifications(false);
                            navigate('/duyet');
                          }
                        }}
                        className={`p-3 hover:bg-slate-50 transition-colors cursor-pointer flex gap-3 ${
                          !n.is_read ? 'bg-blue-50/40' : ''
                        }`}
                      >
                        <div className="shrink-0 mt-0.5">
                          {n.level === 'red' ? (
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block ring-2 ring-red-100" />
                          ) : n.level === 'orange' ? (
                            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block ring-2 ring-orange-100" />
                          ) : (
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block ring-2 ring-blue-100" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs ${!n.is_read ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                            {n.title}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 leading-snug line-clamp-2">{n.body}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {pendingCount > 0 && currentRole !== 'staff' && (
                  <div className="p-2.5 bg-blue-50/80 border-t border-blue-100 text-center">
                    <Link
                      to="/duyet"
                      onClick={() => setShowNotifications(false)}
                      className="text-xs font-semibold text-[#1F5FBF] hover:underline inline-flex items-center gap-1.5"
                    >
                      <FileCheck2 className="w-3.5 h-3.5" />
                      Đi đến trang Chờ duyệt ({pendingCount} mục)
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User Profile */}
          <div className="relative" ref={userRef}>
            <button
              type="button"
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <img
                src={avatarUrl}
                alt="Avatar"
                className="w-8 h-8 rounded-full border border-blue-200 object-cover"
              />
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-bold text-slate-800 leading-tight">{displayName}</span>
                <span className="text-[11px] text-slate-500 truncate max-w-[10rem]">
                  {showUnitLine ? myUnitName : roleLabel}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="p-2 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-900">{displayName}</p>
                  {currentUser?.email && (
                    <p className="text-[11px] text-slate-500 truncate">{currentUser.email}</p>
                  )}
                  {showUnitLine && (
                    <p className="text-[11px] text-slate-600 font-semibold truncate">{myUnitName}</p>
                  )}
                  <p className="text-[11px] text-slate-500">Đoàn TNCS Hồ Chí Minh xã Hòa Bình</p>
                  <span className="inline-block mt-1 text-[10px] font-semibold bg-blue-100 text-[#1F5FBF] px-1.5 py-0.5 rounded">
                    {roleLabel} • Đang trực tuyến
                  </span>
                </div>
                <div className="py-1">
                  <Link
                    to="/ban-chap-hanh"
                    onClick={() => setShowUserMenu(false)}
                    className="block px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-md"
                  >
                    Xem hồ sơ BCH Đoàn xã
                  </Link>
                  <Link
                    to="/cau-hinh"
                    onClick={() => setShowUserMenu(false)}
                    className="block px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-md"
                  >
                    Thiết lập hệ thống
                  </Link>
                </div>
                {dataSource === 'supabase' && supabase && (
                  <div className="pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => supabase?.auth.signOut()}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-md"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Đăng xuất
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
