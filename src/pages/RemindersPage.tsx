import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  BellRing,
  AlertTriangle,
  AlertCircle,
  Clock,
  CheckCircle2,
  Send,
  Users,
  Building2,
  Calendar,
  Plus,
  X,
  Filter,
  Check,
  Ban,
  RotateCcw,
  UserCheck,
  ChevronRight,
  Info,
} from 'lucide-react';
import { Unit, Member, UnitTypeId } from '../types';
import { formatDateTimeVN, formatDateVN, getRelativeDate } from '../mock/data';

interface CustomReminderItem {
  id: string;
  type: 'task_deadline' | 'criteria_deadline' | 'system_alert' | 'custom';
  typeLabel: string;
  recipientType: 'unit' | 'member';
  recipientName: string;
  recipientSubtext?: string;
  content: string;
  sendTime: string;
  status: 'sent' | 'pending' | 'cancelled';
  level: 'yellow' | 'orange' | 'red';
  isScheduled?: boolean;
}

export const RemindersPage: React.FC = () => {
  const {
    warnings,
    units,
    members,
    tasks,
    taskUnits,
    taskResults,
    resolveWarning,
    sendManualReminder,
    getUnitById,
    getTaskById,
    showToast,
  } = useApp();

  // Active top tab: "Danh sách nhắc nhở" | "Cần nhắc hôm nay"
  const [activeTab, setActiveTab] = useState<'all' | 'due_today' | 'open_warnings'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'pending' | 'cancelled'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'task' | 'criteria' | 'system'>('all');

  // Custom reminders state
  const [reminderList, setReminderList] = useState<CustomReminderItem[]>([
    {
      id: 'rem_1',
      type: 'task_deadline',
      typeLabel: 'Hạn nhiệm vụ',
      recipientType: 'unit',
      recipientName: 'Chi đoàn Ấp 1, Chi đoàn Ấp 2, Chi đoàn Ấp 3',
      recipientSubtext: 'Bí thư các Chi đoàn',
      content: 'Đôn đốc nộp báo cáo Chiến dịch Tình nguyện Mùa hè xanh (còn 3 ngày nữa đến hạn chót).',
      sendTime: getRelativeDate(0, -4),
      status: 'sent',
      level: 'orange',
    },
    {
      id: 'rem_2',
      type: 'criteria_deadline',
      typeLabel: 'Hạn tiêu chí',
      recipientType: 'unit',
      recipientName: 'Toàn bộ 31 Chi đoàn',
      recipientSubtext: 'Bí thư Chi đoàn cơ sở',
      content: 'Nhắc nhở cập nhật minh chứng tiêu chí Quản lý đoàn viên & sổ Đoàn điện tử (còn 7 ngày).',
      sendTime: getRelativeDate(-1, -2),
      status: 'sent',
      level: 'yellow',
    },
    {
      id: 'rem_3',
      type: 'system_alert',
      typeLabel: 'Cảnh báo hệ thống',
      recipientType: 'unit',
      recipientName: 'Chi đoàn Trường THCS Hòa Bình',
      recipientSubtext: 'Bí thư Chi đoàn',
      content: 'Cảnh báo: Lệch số liệu đoàn viên khai báo (32) so với thực tế cập nhật trong hệ thống (28).',
      sendTime: getRelativeDate(0, -1),
      status: 'sent',
      level: 'red',
    },
    {
      id: 'rem_4',
      type: 'task_deadline',
      typeLabel: 'Hạn nhiệm vụ',
      recipientType: 'unit',
      recipientName: 'Chi đoàn Dân quân cơ động',
      recipientSubtext: 'Đ/c Lê Hoàng Nam',
      content: 'Hẹn giờ tự động: Nhắc nộp danh sách đoàn viên tham gia Hội thao Quốc phòng trước 17h00 ngày mai.',
      sendTime: getRelativeDate(1, 8),
      status: 'pending',
      level: 'orange',
      isScheduled: true,
    },
    {
      id: 'rem_5',
      type: 'criteria_deadline',
      typeLabel: 'Hạn tiêu chí',
      recipientType: 'member',
      recipientName: 'Đ/c Phạm Văn Minh (Ấp 3)',
      recipientSubtext: 'Bí thư Chi đoàn',
      content: 'Nhắc hoàn thiện hồ sơ sinh hoạt Chi đoàn chuyên đề tháng 10.',
      sendTime: getRelativeDate(-2, 0),
      status: 'cancelled',
      level: 'yellow',
    },
  ]);

  // Modal "Tạo nhắc nhở tùy biến"
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formRecipientKind, setFormRecipientKind] = useState<'unit' | 'member'>('unit');
  const [formSelectedUnitId, setFormSelectedUnitId] = useState<string>(units[0]?.id || '');
  const [formSelectedMemberId, setFormSelectedMemberId] = useState<string>(members[0]?.id || '');
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formLevel, setFormLevel] = useState<'yellow' | 'orange' | 'red'>('orange');
  const [formSendMode, setFormSendMode] = useState<'now' | 'schedule'>('now');
  const [formScheduleDate, setFormScheduleDate] = useState(getRelativeDate(1).split('T')[0]);
  const [formScheduleTime, setFormScheduleTime] = useState('08:00');

  // Danh sách tự động sinh "Cần nhắc hôm nay" từ các mốc 7, 3, 1 ngày
  const dueTodayReminders = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      kind: 'task' | 'criteria';
      kindLabel: string;
      dueDate: string;
      daysRemaining: number;
      urgency: 'yellow' | 'orange' | 'red';
      urgencyLabel: string;
      unsubmittedUnits: Unit[];
    }> = [];

    const now = new Date().getTime();

    // 1. Quét nhiệm vụ
    tasks.filter(t => t.status === 'published').forEach(task => {
      const dueTime = new Date(task.due_date).getTime();
      const diffDays = Math.ceil((dueTime - now) / (1000 * 60 * 60 * 24));

      // Lọc các mốc 7, 3, 1 hoặc <= 0
      if (diffDays <= 7) {
        const assignedUnitIds = taskUnits.filter(tu => tu.task_id === task.id).map(tu => tu.unit_id);
        const submittedUnitIds = taskResults
          .filter(tr => tr.task_id === task.id && (tr.status === 'pending' || tr.status === 'approved'))
          .map(tr => tr.unit_id);

        const unsubmitted = units.filter(
          u => assignedUnitIds.includes(u.id) && !submittedUnitIds.includes(u.id) && u.is_active
        );

        if (unsubmitted.length > 0) {
          let urgency: 'yellow' | 'orange' | 'red' = 'yellow';
          let urgencyLabel = 'Còn 4–7 ngày';
          if (diffDays <= 0) {
            urgency = 'red';
            urgencyLabel = `Đã trễ ${Math.abs(diffDays) || 1} ngày`;
          } else if (diffDays <= 1) {
            urgency = 'red';
            urgencyLabel = 'Còn ≤1 ngày';
          } else if (diffDays <= 3) {
            urgency = 'orange';
            urgencyLabel = 'Còn 2–3 ngày';
          }

          list.push({
            id: `task_${task.id}`,
            title: task.title,
            kind: 'task',
            kindLabel: 'Nhiệm vụ',
            dueDate: task.due_date,
            daysRemaining: diffDays,
            urgency,
            urgencyLabel,
            unsubmittedUnits: unsubmitted,
          });
        }
      }
    });

    return list;
  }, [tasks, taskUnits, taskResults, units]);

  // Tổng số chi đoàn cần nhắc hôm nay
  const totalDueTodayRecipients = useMemo(() => {
    const unitSet = new Set<string>();
    dueTodayReminders.forEach(item => {
      item.unsubmittedUnits.forEach(u => unitSet.add(u.id));
    });
    return unitSet.size;
  }, [dueTodayReminders]);

  // Hành động "Gửi tất cả hôm nay"
  const handleSendAllToday = async () => {
    if (dueTodayReminders.length === 0) {
      showToast({
        title: 'Không có thông báo cần gửi',
        description: 'Tất cả các chi đoàn đã hoàn thành hoặc chưa chạm mốc hạn nhắc việc.',
        type: 'info',
      });
      return;
    }

    // Gửi thật tới bí thư của từng nhóm chi đoàn chưa nộp
    let totalSent = 0;
    const newItems: CustomReminderItem[] = [];
    for (let index = 0; index < dueTodayReminders.length; index++) {
      const d = dueTodayReminders[index];
      const unitIds = d.unsubmittedUnits.map(u => u.id);
      if (unitIds.length === 0) continue;
      try {
        const res = await sendManualReminder({
          recipientType: 'units',
          unitIds,
          title: d.kind === 'task' ? `Đôn đốc nhiệm vụ: ${d.title}` : `Đôn đốc tiêu chí: ${d.title}`,
          content: `Đôn đốc khẩn: "${d.title}" - Hạn chót ${formatDateVN(d.dueDate)} (${d.urgencyLabel}). Vui lòng nộp minh chứng ngay.`,
          level: d.urgency,
        });
        totalSent += res.count;
      } catch (e) {
        showToast({ title: 'Không gửi được nhắc nhở', description: e instanceof Error ? e.message : '', type: 'error' });
        continue;
      }
      newItems.push({
        id: `bulk_today_${Date.now()}_${index}`,
        type: d.kind === 'task' ? 'task_deadline' : 'criteria_deadline',
        typeLabel: d.kind === 'task' ? 'Hạn nhiệm vụ' : 'Hạn tiêu chí',
        recipientType: 'unit',
        recipientName: `${d.unsubmittedUnits.length} Chi đoàn chưa nộp (${d.unsubmittedUnits.slice(0, 3).map(u => u.name).join(', ')}${d.unsubmittedUnits.length > 3 ? '...' : ''})`,
        recipientSubtext: `Mốc: ${d.urgencyLabel}`,
        content: `Đôn đốc khẩn: "${d.title}" - Hạn chót ${formatDateVN(d.dueDate)} (${d.urgencyLabel}). Vui lòng nộp minh chứng ngay.`,
        sendTime: new Date().toISOString(),
        status: 'sent',
        level: d.urgency,
      });
    }

    setReminderList(prev => [...newItems, ...prev]);

    showToast({
      title: 'Đã gửi thông báo hàng loạt',
      description: `Đã gửi tới bí thư của ${totalSent} chi đoàn.`,
      type: 'success',
    });
  };

  // Hành động Tạo nhắc nhở tùy biến
  const handleCreateCustomReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formContent.trim()) {
      showToast({ title: 'Vui lòng nhập nội dung nhắc nhở', type: 'error' });
      return;
    }

    let recipientName = '';
    let recipientSub = '';

    if (formRecipientKind === 'unit') {
      const u = units.find(item => item.id === formSelectedUnitId);
      recipientName = u ? u.name : 'Chi đoàn cơ sở';
      recipientSub = 'Bí thư Chi đoàn';
    } else {
      const m = members.find(item => item.id === formSelectedMemberId);
      recipientName = m ? m.full_name : 'Đoàn viên';
      recipientSub = m ? `Chi đoàn: ${getUnitById(m.unit_id)?.name || 'Cơ sở'}` : 'Đoàn viên';
    }

    const isSched = formSendMode === 'schedule';
    const sendTime = isSched
      ? `${formScheduleDate}T${formScheduleTime}:00`
      : new Date().toISOString();

    // Gửi thật (chỉ khi gửi ngay; hẹn lịch chưa hỗ trợ tự động gửi)
    if (!isSched) {
      try {
        if (formRecipientKind === 'unit') {
          await sendManualReminder({
            recipientType: 'unit', unitId: formSelectedUnitId,
            title: formTitle.trim() || 'Nhắc nhở từ Đoàn xã',
            content: formContent.trim(), level: formLevel,
          });
        } else {
          await sendManualReminder({
            recipientType: 'member', memberId: formSelectedMemberId,
            title: formTitle.trim() || 'Nhắc nhở từ Đoàn xã',
            content: formContent.trim(), level: formLevel,
          });
        }
      } catch (err) {
        showToast({ title: 'Không gửi được', description: err instanceof Error ? err.message : '', type: 'error' });
        return;
      }
    }

    const newItem: CustomReminderItem = {
      id: `custom_${Date.now()}`,
      type: 'custom',
      typeLabel: formTitle ? formTitle.trim() : 'Nhắc nhở tuỳ biến',
      recipientType: formRecipientKind,
      recipientName,
      recipientSubtext: recipientSub,
      content: formContent.trim(),
      sendTime,
      status: isSched ? 'pending' : 'sent',
      level: formLevel,
      isScheduled: isSched,
    };

    setReminderList(prev => [newItem, ...prev]);
    setIsCreateModalOpen(false);
    setFormTitle('');
    setFormContent('');

    showToast({
      title: isSched ? 'Đã lên lịch nhắc nhở' : 'Đã gửi thông báo nhắc nhở',
      description: isSched
        ? `Lưu lịch gửi ${formScheduleTime} ngày ${formatDateVN(formScheduleDate)} (tự động gửi sẽ bổ sung sau).`
        : `Đã gửi trực tiếp tới ${recipientName}.`,
      type: 'success',
    });
  };

  // Hủy lời nhắc đang chờ
  const handleCancelReminder = (id: string) => {
    setReminderList(prev =>
      prev.map(item => (item.id === id ? { ...item, status: 'cancelled' } : item))
    );
    showToast({
      title: 'Đã hủy lời nhắc',
      description: 'Lịch gửi thông báo đã được hủy bỏ an toàn.',
      type: 'info',
    });
  };

  // Filtered Reminders List
  const filteredReminders = useMemo(() => {
    return reminderList.filter(item => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (typeFilter === 'task' && item.type !== 'task_deadline') return false;
      if (typeFilter === 'criteria' && item.type !== 'criteria_deadline') return false;
      if (typeFilter === 'system' && item.type !== 'system_alert') return false;
      return true;
    });
  }, [reminderList, statusFilter, typeFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <BellRing className="w-6 h-6 text-[#1F5FBF]" />
            Trung tâm Nhắc nhở & Cảnh báo Tiến độ
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            Tự động theo dõi các mốc 7, 3, 1 ngày, gửi thông báo đôn đốc hàng loạt hoặc lên lịch gửi tùy biến
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded-lg shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Tạo nhắc nhở tùy biến
          </button>
        </div>
      </div>

      {/* KHỐI TỰ ĐỘNG SINH: CẦN NHẮC HÔM NAY (MỐC 7, 3, 1 NGÀY) */}
      <div className="bg-linear-to-r from-blue-50/90 via-sky-50/70 to-indigo-50/70 rounded-xl border border-blue-200/80 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              <h2 className="text-sm md:text-base font-bold text-slate-900 flex items-center gap-2">
                Hệ thống đề xuất: Cần nhắc hôm nay
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#1F5FBF] text-white">
                  {dueTodayReminders.length} nội dung
                </span>
              </h2>
            </div>
            <p className="text-xs text-slate-600">
              Tự động tính từ các mốc <strong>7 ngày, 3 ngày, 1 ngày</strong> và quá hạn của nhiệm vụ, tiêu chí chưa nộp.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSendAllToday}
              disabled={dueTodayReminders.length === 0}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer ${
                dueTodayReminders.length === 0
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
              }`}
            >
              <Send className="w-4 h-4" />
              Gửi tất cả hôm nay ({totalDueTodayRecipients} Chi đoàn)
            </button>
          </div>
        </div>

        {dueTodayReminders.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
            {dueTodayReminders.map(item => (
              <div
                key={item.id}
                className="bg-white rounded-lg border border-slate-200/90 p-3.5 shadow-2xs space-y-2 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-[#1F5FBF]">
                      {item.kindLabel}
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        item.urgency === 'red'
                          ? 'bg-red-100 text-red-700 border border-red-200'
                          : item.urgency === 'orange'
                          ? 'bg-orange-100 text-orange-700 border border-orange-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {item.urgencyLabel}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-900 mt-2 line-clamp-2" title={item.title}>
                    {item.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Hạn chót: <strong>{formatDateVN(item.dueDate)}</strong>
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                  <span>Chưa nộp: <strong className="text-red-600 font-bold">{item.unsubmittedUnits.length} chi đoàn</strong></span>
                  <span className="text-[11px] text-slate-400">
                    Bí thư cơ sở
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 bg-white/80 rounded-lg text-center text-xs text-slate-600 border border-slate-200">
            Tuyệt vời! Không có chi đoàn nào vi phạm hoặc nằm trong các mốc báo động 7, 3, 1 ngày cần nhắc hôm nay.
          </div>
        )}
      </div>

      {/* DANH SÁCH LỜI NHẮC ĐÃ TẠO / LÊN LỊCH */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm md:text-base font-bold text-slate-900">
              Nhật ký & Danh sách Lời nhắc ({filteredReminders.length})
            </h3>
            <p className="text-xs text-slate-500">
              Theo dõi toàn bộ lịch sử thông báo nhắc nhở, hẹn giờ và trạng thái tiếp nhận
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Bộ lọc trạng thái */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  statusFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('sent')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  statusFilter === 'sent' ? 'bg-white text-emerald-700 shadow-2xs font-bold' : 'text-slate-600'
                }`}
              >
                Đã gửi
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('pending')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  statusFilter === 'pending' ? 'bg-white text-amber-700 shadow-2xs font-bold' : 'text-slate-600'
                }`}
              >
                Đang chờ
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('cancelled')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  statusFilter === 'cancelled' ? 'bg-white text-slate-500 shadow-2xs font-bold' : 'text-slate-600'
                }`}
              >
                Đã hủy
              </button>
            </div>

            {/* Bộ lọc loại */}
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as any)}
              className="p-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 font-medium"
            >
              <option value="all">Mọi loại nhắc</option>
              <option value="task">Hạn nhiệm vụ</option>
              <option value="criteria">Hạn tiêu chí</option>
              <option value="system">Cảnh báo hệ thống</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 uppercase font-bold border-b border-slate-200">
              <tr>
                <th className="p-3">Loại nhắc</th>
                <th className="p-3">Đối tượng nhận</th>
                <th className="p-3">Nội dung</th>
                <th className="p-3 whitespace-nowrap">Thời điểm gửi</th>
                <th className="p-3 text-center">Trạng thái</th>
                <th className="p-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReminders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    Không tìm thấy lời nhắc nào phù hợp bộ lọc.
                  </td>
                </tr>
              ) : (
                filteredReminders.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                          item.level === 'red'
                            ? 'bg-red-100 text-red-700'
                            : item.level === 'orange'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.typeLabel}
                      </span>
                    </td>

                    <td className="p-3 font-semibold text-slate-900 max-w-xs">
                      <div>{item.recipientName}</div>
                      {item.recipientSubtext && (
                        <div className="text-[10px] text-slate-400 font-normal">{item.recipientSubtext}</div>
                      )}
                    </td>

                    <td className="p-3 text-slate-600 max-w-md">
                      <p className="line-clamp-2" title={item.content}>
                        {item.content}
                      </p>
                    </td>

                    <td className="p-3 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                      {formatDateTimeVN(item.sendTime)}
                      {item.isScheduled && (
                        <span className="block text-[10px] text-amber-600 font-sans font-bold">
                          (Lên lịch hẹn giờ)
                        </span>
                      )}
                    </td>

                    <td className="p-3 text-center whitespace-nowrap">
                      {item.status === 'sent' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                          <Check className="w-3 h-3" /> Đã gửi
                        </span>
                      ) : item.status === 'pending' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[11px]">
                          <Clock className="w-3 h-3" /> Đang chờ
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold text-[11px]">
                          <Ban className="w-3 h-3" /> Đã hủy
                        </span>
                      )}
                    </td>

                    <td className="p-3 text-right whitespace-nowrap">
                      {item.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => handleCancelReminder(item.id)}
                          className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        >
                          Hủy lịch
                        </button>
                      )}
                      {item.status === 'sent' && (
                        <span className="text-slate-400 text-xs">Đã ghi nhận</span>
                      )}
                      {item.status === 'cancelled' && (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: TẠO NHẮC NHỞ TÙY BIẾN */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-5 space-y-4 shadow-xl text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Send className="w-4 h-4 text-[#1F5FBF]" />
                Tạo Nhắc nhở Tùy biến
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomReminder} className="space-y-4">
              {/* Chọn đối tượng: Chi đoàn hoặc Cá nhân */}
              <div>
                <label className="font-bold text-slate-800 block mb-1.5">Đối tượng nhận thông báo:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormRecipientKind('unit')}
                    className={`p-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      formRecipientKind === 'unit'
                        ? 'bg-blue-50 border-[#1F5FBF] text-[#1F5FBF]'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Building2 className="w-4 h-4" /> Chi đoàn cơ sở
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormRecipientKind('member')}
                    className={`p-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      formRecipientKind === 'member'
                        ? 'bg-blue-50 border-[#1F5FBF] text-[#1F5FBF]'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Users className="w-4 h-4" /> Cá nhân (Đoàn viên)
                  </button>
                </div>
              </div>

              {/* Danh sách chọn cụ thể */}
              {formRecipientKind === 'unit' ? (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Chọn Chi đoàn:</label>
                  <select
                    value={formSelectedUnitId}
                    onChange={e => setFormSelectedUnitId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900"
                  >
                    {units.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.union_member_count} đoàn viên)
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Chọn Đoàn viên cụ thể:</label>
                  <select
                    value={formSelectedMemberId}
                    onChange={e => setFormSelectedMemberId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900"
                  >
                    {members.slice(0, 50).map(m => (
                      <option key={m.id} value={m.id}>
                        {m.full_name} – {m.phone} ({getUnitById(m.unit_id)?.name})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Tiêu đề & Nội dung */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Tiêu đề nhắc nhở (tùy chọn):</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="Ví dụ: Đôn đốc nộp bài thi tìm hiểu Nghị quyết..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#1F5FBF]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Nội dung thông báo (*):</label>
                <textarea
                  rows={3}
                  value={formContent}
                  onChange={e => setFormContent(e.target.value)}
                  placeholder="Nhập nội dung thông điệp gửi đến đối tượng..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#1F5FBF] resize-none"
                />
              </div>

              {/* Mức độ cảnh báo */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Mức độ cảnh báo:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormLevel('yellow')}
                    className={`p-2 rounded-lg border text-xs font-bold text-center cursor-pointer ${
                      formLevel === 'yellow'
                        ? 'bg-amber-100 border-amber-400 text-amber-800'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    Vàng (Bình thường)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormLevel('orange')}
                    className={`p-2 rounded-lg border text-xs font-bold text-center cursor-pointer ${
                      formLevel === 'orange'
                        ? 'bg-orange-100 border-orange-400 text-orange-800'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    Cam (Quan trọng)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormLevel('red')}
                    className={`p-2 rounded-lg border text-xs font-bold text-center cursor-pointer ${
                      formLevel === 'red'
                        ? 'bg-red-100 border-red-400 text-red-800'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    Đỏ (Khẩn cấp)
                  </button>
                </div>
              </div>

              {/* Chế độ gửi: Gửi ngay vs Hẹn giờ */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <label className="font-bold text-slate-800 block">Thời điểm gửi:</label>
                <div className="flex items-center gap-4">
                  <label className="inline-flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="radio"
                      name="sendMode"
                      checked={formSendMode === 'now'}
                      onChange={() => setFormSendMode('now')}
                      className="text-[#1F5FBF]"
                    />
                    Gửi ngay bây giờ
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="radio"
                      name="sendMode"
                      checked={formSendMode === 'schedule'}
                      onChange={() => setFormSendMode('schedule')}
                      className="text-[#1F5FBF]"
                    />
                    Hẹn giờ gửi
                  </label>
                </div>

                {formSendMode === 'schedule' && (
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-1">Ngày gửi:</label>
                      <input
                        type="date"
                        value={formScheduleDate}
                        onChange={e => setFormScheduleDate(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-1">Giờ gửi:</label>
                      <input
                        type="time"
                        value={formScheduleTime}
                        onChange={e => setFormScheduleTime(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded-lg cursor-pointer shadow-xs"
                >
                  {formSendMode === 'schedule' ? 'Lên lịch gửi' : 'Gửi thông báo ngay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
