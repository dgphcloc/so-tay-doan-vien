import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  CheckCircle2,
  ChevronRight,
  Sliders,
  Layers,
  Building2,
  Users,
  UserCheck,
  ShieldCheck,
  Award,
  ArrowRight,
} from 'lucide-react';

export const SetupWizardPage: React.FC = () => {
  const {
    yearlySettings,
    unitTypes,
    units,
    members,
    unitCommittees,
    profiles,
    criteriaSets,
    subCriteria,
    currentRole,
  } = useApp();

  const navigate = useNavigate();
  const isAdmin = currentRole === 'super_admin' || currentRole === 'admin';

  const wizardSteps = useMemo(() => [
    {
      id: 1,
      title: 'Bước 1: Cấu hình thông tin xã & đoàn phí',
      desc: 'Cài đặt năm công tác hiện tại, tài khoản ngân hàng tập trung nhận đoàn phí và chỉ tiêu phát triển đoàn viên mới.',
      icon: Sliders,
      done: yearlySettings.year > 0,
      link: '/cau-hinh',
      actionText: 'Vào cấu hình hệ thống',
      statusText: yearlySettings.year > 0 ? `Năm công tác: ${yearlySettings.year}` : 'Chưa thiết lập năm',
    },
    {
      id: 2,
      title: 'Bước 2: Danh mục Loại chi đoàn',
      desc: 'Kiểm tra và chuẩn hóa các loại chi đoàn (Dân cư, Trường học, Y tế, Lực lượng vũ trang...). Có thể nhập thêm từ Excel.',
      icon: Layers,
      done: unitTypes.length > 0,
      link: '/cau-hinh',
      actionText: 'Xem danh mục loại',
      statusText: `${unitTypes.length} loại chi đoàn đang có`,
    },
    {
      id: 3,
      title: 'Bước 3: Khởi tạo danh sách các Chi đoàn',
      desc: 'Thêm mới từng chi đoàn hoặc tải file Excel mẫu về điền rồi nhập hàng loạt tất cả các ấp, trường học, đơn vị trực thuộc.',
      icon: Building2,
      done: units.length > 0,
      link: '/chi-doan',
      actionText: 'Quản lý Chi đoàn',
      statusText: units.length > 0 ? `Đã có ${units.length} Chi đoàn cơ sở` : 'Chưa có chi đoàn nào',
    },
    {
      id: 4,
      title: 'Bước 4: Nhập danh sách Đoàn viên',
      desc: 'Tải file mẫu Excel chuẩn có dropdown, điền hồ sơ và nạp danh sách đoàn viên. Hệ thống tự động phân về đúng chi đoàn.',
      icon: Users,
      done: members.length > 0,
      link: '/doan-vien',
      actionText: 'Quản lý Đoàn viên',
      statusText: members.length > 0 ? `Đã có ${members.length} Đoàn viên trong CSDL` : 'Chưa có đoàn viên',
    },
    {
      id: 5,
      title: 'Bước 5: Kiện toàn Ban Chấp hành',
      desc: 'Bổ nhiệm Bí thư, Phó Bí thư Đoàn xã và Bí thư các Chi đoàn trực thuộc từ danh sách đoàn viên đã nhập.',
      icon: UserCheck,
      done: unitCommittees.length > 0,
      link: '/ban-chap-hanh',
      actionText: 'Quản lý Ban chấp hành',
      statusText: unitCommittees.length > 0 ? `Đã bổ nhiệm ${unitCommittees.length} nhân sự BCH` : 'Chưa kiện toàn BCH',
    },
    {
      id: 6,
      title: 'Bước 6: Phân quyền tài khoản Bí thư Chi đoàn',
      desc: 'Gán vai trò Bí thư Chi đoàn (unit_secretary) cho tài khoản đăng nhập của các Bí thư để họ tự quản lý cơ sở.',
      icon: ShieldCheck,
      done: profiles.some(p => p.role_id === 'unit_secretary'),
      link: '/tai-khoan',
      actionText: 'Phân quyền tài khoản',
      statusText: profiles.filter(p => p.role_id === 'unit_secretary').length > 0
        ? `Đã phân quyền ${profiles.filter(p => p.role_id === 'unit_secretary').length} Bí thư chi đoàn`
        : 'Chưa gán quyền Bí thư chi đoàn',
    },
    {
      id: 7,
      title: 'Bước 7: Nhập Bộ tiêu chí thi đua năm',
      desc: 'Nhập bộ tiêu chí đánh giá chất lượng hoạt động Đoàn cơ sở (thang điểm 100) từ file Excel do Huyện/Tỉnh giao.',
      icon: Award,
      done: criteriaSets.length > 0 && subCriteria.length > 0,
      link: '/tieu-chi',
      actionText: 'Quản lý Bộ tiêu chí',
      statusText: criteriaSets.length > 0 && subCriteria.length > 0
        ? `Bộ tiêu chí đã sẵn sàng (${subCriteria.length} tiêu chí con)`
        : 'Chưa có bộ tiêu chí',
    },
  ], [yearlySettings, unitTypes, units, members, unitCommittees, profiles, criteriaSets, subCriteria]);

  const completedCount = useMemo(() => wizardSteps.filter(s => s.done).length, [wizardSteps]);
  const progressPercent = Math.round((completedCount / 7) * 100);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1F5FBF] to-blue-700 rounded-2xl p-6 text-white shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-bold backdrop-blur-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Quy trình Onboarding Bàn giao
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              7 Bước Thiết lập Hệ thống Ban đầu
            </h1>
            <p className="text-xs md:text-sm text-blue-100 max-w-2xl">
              Hướng dẫn toàn diện theo đúng thứ tự ràng buộc dữ liệu. Hoàn thành tuần tự 7 bước dưới đây để hệ thống sẵn sàng vận hành chính thức tại đơn vị của bạn.
            </p>
          </div>

          <div className="text-right shrink-0 bg-white/10 p-4 rounded-xl backdrop-blur-xs border border-white/20">
            <div className="text-3xl font-extrabold">{completedCount}/7</div>
            <p className="text-xs text-blue-100 font-medium mt-0.5">Bước hoàn thành</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-5 space-y-1.5">
          <div className="flex justify-between text-xs font-semibold text-blue-100">
            <span>Tiến độ thiết lập</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="w-full bg-black/20 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-amber-300 h-2.5 rounded-full transition-all duration-500 shadow-xs"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Danh sách 7 bước chi tiết */}
      <div className="space-y-3">
        {wizardSteps.map(step => {
          const Icon = step.icon;
          return (
            <div
              key={step.id}
              className={`p-5 rounded-2xl border transition-all ${
                step.done
                  ? 'bg-white border-emerald-200/90 shadow-2xs'
                  : 'bg-white border-slate-200 shadow-2xs hover:border-[#1F5FBF]'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      step.done
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-blue-50 text-[#1F5FBF]'
                    }`}
                  >
                    {step.done ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm md:text-base font-bold text-slate-900">
                        {step.title}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          step.done
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {step.done ? '✓ Đã hoàn thành' : 'Chưa hoàn tất'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                      {step.desc}
                    </p>
                    <p className="text-[11px] font-semibold text-slate-500 pt-0.5">
                      Hiện trạng: <span className={step.done ? 'text-emerald-700' : 'text-amber-700'}>{step.statusText}</span>
                    </p>
                  </div>
                </div>

                <div className="shrink-0 sm:self-center pl-14 sm:pl-0">
                  <button
                    type="button"
                    title={`Đi tới: ${step.title}`}
                    onClick={() => navigate(step.link)}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                      step.done
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        : 'bg-[#1F5FBF] hover:bg-[#154690] text-white'
                    }`}
                  >
                    {step.actionText} <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
