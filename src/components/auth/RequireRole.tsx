import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { canAccessRoute, homeForRole } from '../../utils/permissions';

/**
 * Hàng rào thật cho đường dẫn: vai trò không đủ quyền thì chuyển hướng.
 * Ẩn/hiện menu chỉ là lớp phụ; đây mới là chỗ chặn thật khi gõ URL trực tiếp.
 */
export const RequireRole: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentRole } = useApp();
  const location = useLocation();

  if (!canAccessRoute(currentRole, location.pathname)) {
    const home = homeForRole(currentRole);
    // Tránh vòng lặp nếu chính trang chủ cũng không cho phép
    if (location.pathname === home) return <>{children}</>;
    return <Navigate to={home} replace />;
  }
  return <>{children}</>;
};
