import React, { useState, useMemo, useEffect } from 'react';
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
  Search,
  Eye,
  Loader2,
} from 'lucide-react';
import { Unit, Member, UnitTypeId } from '../types';
import { formatDateTimeVN, formatDateVN, getRelativeDate } from '../mock/data';
import { removeVietnameseTones } from '../utils/vietnamese';

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
    syncWarnings,
    sendManualReminder,
    listAllNotifications,
    getUnitById,
    getTaskById,
    showToast,
    listScheduledNotifications,
    createScheduledNotification,
    deleteScheduledNotification,
  } = useApp();

  // Mở trang là tự sinh cảnh báo quá hạn / sắp hết hạn (nếu có cảnh báo mới)
  useEffect(() => {
    (async () => {
      const res = await syncWarnings();
      if (res.created > 0) {
        showToast({ title: `Đã cập nhật ${res.created} cảnh báo mới`, type: 'info' });
      }
    })();
    /* eslint-disable-next-line */
  }, []);

  // Active top tab: "Danh sách nhắc nhở" | "Cần nhắc hôm nay"
  const [activeTab, setActiveTab] = useState<'all' | 'due_today' | 'open_warnings'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'pending' | 'cancelled'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'task' | 'criteria' | 'system'>('all');

  // Lịch sử lời nhắc lấy THẬT từ Database
  const [reminderList, setReminderList] = useState<CustomReminderItem[]>([]);

  // Tải thông báo và lịch hẹn thật từ DB
  useEffect(() => {
    (async () => {
      try {
        const [notifs, scheduled] = await Promise.all([
          listAllNotifications(100),
          listScheduledNotifications(),
        ]);
        const mappedSent: CustomReminderItem[] = notifs.map(n => {
          const recMember = members.find(m => String(m.id) === String(n.recipient_id));
          const recUnit = recMember ? getUnitById(recMember.unit_id) : null;
          return {
            id: n.id,
            type: n.task_id ? 'task_deadline' : 'custom',
            typeLabel: n.type === 'system' ? 'Hệ thống' : 'Nhắc nhở',
            recipientType: 'member',
            recipientName: recMember ? recMember.full_name : `Đoàn viên #${n.recipient_id}`,
            recipientSubtext: recUnit ? recUnit.name : undefined,
            content: n.title ? `${n.title}: ${n.body}` : n.body,
            sendTime: n.created_at,
            status: 'sent',
            level: n.level,
          };
        });

        const mappedSched: CustomReminderItem[] = scheduled.filter(s => !s.is_sent).map(s => {
          const targetMember = s.recipient_type === 'member' && s.target_id ? members.find(m => String(m.id) === String(s.target_id)) : null;
          const targetUnit = s.recipient_type === 'unit' && s.target_id ? getUnitById(String(s.target_id)) : null;
          return {
            id: s.id,
            type: 'custom',
            typeLabel: 'Lịch hẹn gửi',
            recipientType: s.recipient_type === 'all' ? 'unit' : s.recipient_type,
            recipientName: s.recipient_type === 'all' ? 'Toàn bộ đoàn viên' : targetMember ? targetMember.full_name : targetUnit ? targetUnit.name : 'Chi đoàn/Đoàn viên',
            recipientSubtext: 'Hẹn giờ tự động',
            content: `${s.title}: ${s.content}`,
            sendTime: s.scheduled_at,
            status: 'pending',
            level: s.level,
            isScheduled: true,
          };
        });

        setReminderList([...mappedSched, ...mappedSent]);
      } catch (e) {
        console.error('Không tải được lịch sử thông báo:', e);
      }
    })();
  }, [members, units, listAllNotifications, listScheduledNotifications, getUnitById]);

  // Số đoàn viên đang hoạt động thực tế của từng chi đoàn
  const activeMemberCountByUnit = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of members) {
      if (!m.is_active) continue;
      map.set(m.unit_id, (map.get(m.unit_id) || 0) + 1);
    }
    return map;
  }, [members]);

  // Modal "Tạo nhắc nhở tùy biến"
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formRecipientKind, setFormRecipientKind] = useState<'unit' | 'member'>('unit');
  const [formSelectedUnitId, setFormSelectedUnitId] = useState<string>(units[0]?.id || '');
  const [formSelectedMemberId, setFormSelectedMemberId] = useState<string>(members[0]?.id || '');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);
  const [selectedReminderDetail, setSelectedReminderDetail] = useState<CustomReminderItem | null>(null);
  const [isSendingAll, setIsSendingAll] = useState(false);
  const [isSendingCustom, setIsSendingCustom] = useState(false);
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
    if (isSendingAll) return;
    if (dueTodayReminders.length === 0) {
      showToast({
        title: 'Không có thông báo cần gửi',
        description: 'Tất cả các chi đoàn đã hoàn thành hoặc chưa chạm mốc hạn nhắc việc.',
        type: 'info',
      });
      return;
    }

    setIsSendingAll(true);
    try {
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
    } finally {
      setIsSendingAll(false);
    }
  };

  // Lọc danh sách đoàn viên tìm kiếm theo tên, số điện thoại, chi đoàn
  const filteredCandidates = useMemo(() => {
    if (!memberSearchQuery.trim()) return members.slice(0, 50);
    const q = removeVietnameseTones(memberSearchQuery.toLowerCase());
    return members.filter(m => {
      const uName = getUnitById(m.unit_id)?.name || '';
      const text = removeVietnameseTones(`${m.full_name} ${m.phone} ${uName}`.toLowerCase());
      return text.includes(q);
    }).slice(0, 50);
  }, [members, memberSearchQuery, getUnitById]);

  // Hành động Tạo nhắc nhở tùy biến
  const handleCreateCustomReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSendingCustom) return;
    if (!formContent.trim()) {
      showToast({ title: 'Vui lòng nhập nội dung nhắc nhở', type: 'error' });
      return;
    }

    setIsSendingCustom(true);
    try {
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

      // Gửi thật ngay hoặc lưu lịch hẹn vào Database
      try {
        if (!isSched) {
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
        } else {
          // Lưu lịch hẹn vào CSDL
          await createScheduledNotification({
            title: formTitle.trim() || 'Nhắc nhở từ Đoàn xã',
            content: formContent.trim(),
            level: formLevel,
            recipientType: formRecipientKind,
            targetId: formRecipientKind === 'unit' ? formSelectedUnitId : formSelectedMemberId,
            scheduledAt: new Date(sendTime).toISOString(),
          });
        }
      } catch (err) {
        showToast({ title: 'Không thực hiện được', description: err instanceof Error ? err.message : '', type: 'error' });
        return;
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
    } finally {
      setIsSendingCustom(false);
    }
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
          <button title="Tạo nhắc nhở tùy biến"
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
            <button title="Gửi nhắc tới bí thư chi đoàn đã chọn"
              type="button"
              onClick={handleSendAllToday}
              disabled={dueTodayReminders.length === 0 || isSendingAll}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all shadow-xs ${
                dueTodayReminders.length === 0 || isSendingAll
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-700 text-white cursor-pointer animate-pulse'
              }`}
            >
              {isSendingAll ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {isSendingAll
                ? 'Đang gửi…'
                : `Gửi tất cả hôm nay (${totalDueTodayRecipients} Chi đoàn)`}
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
              <button title="Tất cả"
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  statusFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tất cả
              </button>
              <button title="Đã gửi"
                type="button"
                onClick={() => setStatusFilter('sent')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  statusFilter === 'sent' ? 'bg-white text-emerald-700 shadow-2xs font-bold' : 'text-slate-600'
                }`}
              >
                Đã gửi
              </button>
              <button title="Đang chờ"
                type="button"
                onClick={() => setStatusFilter('pending')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  statusFilter === 'pending' ? 'bg-white text-amber-700 shadow-2xs font-bold' : 'text-slate-600'
                }`}
              >
                Đang chờ
              </button>
              <button title="Đã hủy"
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
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedReminderDetail(item)}
                          className="px-2 py-1 text-xs font-semibold text-[#1F5FBF] hover:bg-blue-50 rounded-md transition-colors flex items-center gap-1"
                          title="Xem chi tiết nội dung"
                        >
                          <Eye className="w-3.5 h-3.5" /> Xem
                        </button>
                        {item.status === 'pending' && (
                          <button title="Hủy lịch"
                            type="button"
                            onClick={() => handleCancelReminder(item.id)}
                            className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            Hủy lịch
                          </button>
                        )}
                      </div>
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
              <button title="Đóng"
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
                  <button title="Chi đoàn cơ sở"
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
                  <button title="Cá nhân (Đoàn viên)"
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
                        {u.name} ({activeMemberCountByUnit.get(u.id) || 0} đoàn viên)
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-1.5 relative">
                  <label className="font-bold text-slate-700 block">Chọn Đoàn viên cụ thể:</label>

                  {/* Thanh tìm kiếm đoàn viên */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={memberSearchQuery}
                      onChange={e => {
                        setMemberSearchQuery(e.target.value);
                        setIsMemberDropdownOpen(true);
                      }}
                      onFocus={() => setIsMemberDropdownOpen(true)}
                      placeholder="Gõ tên, SĐT hoặc chi đoàn để tìm kiếm..."
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#1F5FBF]"
                    />
                  </div>

                  {/* Dropdown danh sách kết quả */}
                  <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-slate-100 bg-white">
                    {filteredCandidates.length === 0 ? (
                      <p className="p-3 text-center text-slate-400 text-[11px]">Không tìm thấy đoàn viên phù hợp</p>
                    ) : (
                      filteredCandidates.map(m => {
                        const isSelected = formSelectedMemberId === m.id;
                        return (
                          <div
                            key={m.id}
                            onClick={() => {
                              setFormSelectedMemberId(m.id);
                              setMemberSearchQuery(`${m.full_name} (${getUnitById(m.unit_id)?.name})`);
                              setIsMemberDropdownOpen(false);
                            }}
                            className={`p-2.5 hover:bg-blue-50 cursor-pointer flex items-center justify-between transition-colors ${
                              isSelected ? 'bg-blue-50/70 border-l-2 border-[#1F5FBF]' : ''
                            }`}
                          >
                            <div className="min-w-0">
                              <p className={`font-semibold ${isSelected ? 'text-[#1F5FBF]' : 'text-slate-800'}`}>
                                {m.full_name}
                              </p>
                              <p className="text-[10px] text-slate-500">
                                {m.phone ? `${m.phone} • ` : ''}{getUnitById(m.unit_id)?.name || 'Chi đoàn'}
                              </p>
                            </div>
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-[#1F5FBF] shrink-0" />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Đã chọn: <b className="text-slate-700">{members.find(m => m.id === formSelectedMemberId)?.full_name || 'Chưa chọn'}</b>
                  </p>
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
                  <button title="Vàng (Bình thường)"
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
                  <button title="Cam (Quan trọng)"
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
                  <button title="Đỏ (Khẩn cấp)"
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
                <button title="Hủy"
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Hủy
                </button>
                <button title="Đang xử lý"
                  type="submit"
                  disabled={isSendingCustom}
                  className="inline-flex items-center gap-1.5 px-5 py-2 font-bold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded-lg cursor-pointer shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSendingCustom && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSendingCustom
                    ? 'Đang gửi…'
                    : formSendMode === 'schedule'
                    ? 'Lên lịch gửi'
                    : 'Gửi thông báo ngay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: XEM CHI TIẾT THÔNG BÁO LỜI NHẮC */}
      {selectedReminderDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl border border-slate-200 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span
                  className={`w-3 h-3 rounded-full ${
                    selectedReminderDetail.level === 'red'
                      ? 'bg-red-500 ring-4 ring-red-100'
                      : selectedReminderDetail.level === 'orange'
                      ? 'bg-orange-500 ring-4 ring-orange-100'
                      : 'bg-amber-500 ring-4 ring-amber-100'
                  }`}
                />
                <h3 className="text-sm font-bold text-slate-900">Chi tiết lời nhắc / thông báo</h3>
              </div>
              <button title="Đóng"
                type="button"
                onClick={() => setSelectedReminderDetail(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-medium">Đối tượng nhận:</span>
                  <span className="font-bold text-slate-900">{selectedReminderDetail.recipientName}</span>
                </div>
                {selectedReminderDetail.recipientSubtext && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-medium">Đơn vị:</span>
                    <span className="text-slate-600">{selectedReminderDetail.recipientSubtext}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60">
                  <span className="text-slate-400 font-medium">Thời điểm gửi:</span>
                  <span className="font-mono text-slate-700">{formatDateTimeVN(selectedReminderDetail.sendTime)}</span>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold text-slate-700 block mb-1">Nội dung chi tiết:</span>
                <div className="p-3.5 bg-blue-50/40 border border-blue-200/80 rounded-xl text-slate-800 leading-relaxed whitespace-pre-wrap font-medium">
                  {selectedReminderDetail.content}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button title="Đóng"
                type="button"
                onClick={() => setSelectedReminderDetail(null)}
                className="px-4 py-2 font-bold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded-lg shadow-xs"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
