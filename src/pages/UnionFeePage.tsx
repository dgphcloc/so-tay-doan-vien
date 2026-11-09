import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { Avatar } from '../components/common/Avatar';
import { useConfirm } from '../components/common/ConfirmDialog';
import {
  CreditCard,
  QrCode,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  Download,
  Upload,
  Send,
  Loader2,
  RefreshCw,
  Sliders,
  DollarSign,
  Building2,
  UserCheck,
  Search,
  Check,
  X,
  Copy,
  ExternalLink,
  ShieldCheck,
  Info,
} from 'lucide-react';
import {
  DbUnionFeeSettings,
  DbUnionFeePayment,
  DbUnitFeeDistribution,
  DbMember,
  FeePaymentMethod,
} from '../data/types';
import {
  generateVietQrUrl,
  buildFeeTransferContent,
  generatePayOsOrderCode,
  POPULAR_BANKS,
} from '../utils/vietQr';
import { exportUnionFeeWorkbook } from '../utils/unionFeeExcel';
import { removeVietnameseTones } from '../utils/vietnamese';
import { formatDateVN } from '../mock/data';

type TabKey = 'my_fee' | 'unit_review' | 'distributions' | 'settings';

export const UnionFeePage: React.FC = () => {
  const {
    currentRole,
    currentMember,
    members,
    units,
    selectedYear,
    showToast,
    getUnionFeeSettings,
    updateUnionFeeSettings,
    listUnionFeePayments,
    createUnionFeePayment,
    reviewUnionFeePayment,
    confirmPayOsPayment,
    createPayOsPaymentLink,
    checkPayOsPaymentStatus,
    updateMemberFeeStatus,
    listUnitFeeDistributions,
    generateUnitFeeDistributions,
    markFeeDistributionRefunded,
    sendUnionFeeReminder,
  } = useApp();

  const { prompt: promptDialog } = useConfirm();

  const isAdmin = currentRole === 'super_admin' || currentRole === 'admin';
  const isSecretary = currentRole === 'unit_secretary';
  const isMember = currentRole === 'member';

  const [activeTab, setActiveTab] = useState<TabKey>(
    isMember ? 'my_fee' : isSecretary ? 'unit_review' : 'distributions'
  );

  const [settings, setSettings] = useState<DbUnionFeeSettings | null>(null);
  const [payments, setPayments] = useState<DbUnionFeePayment[]>([]);
  const [distributions, setDistributions] = useState<DbUnitFeeDistribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  // Bộ lọc cho danh sách
  const [searchMember, setSearchMember] = useState('');
  const [selectedUnitFilter, setSelectedUnitFilter] = useState('all');

  // Modal nộp đoàn phí (VietQR)
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payTargetMember, setPayTargetMember] = useState<DbMember | null>(null);
  const [selectedMonthsToPay, setSelectedMonthsToPay] = useState<number[]>([]);
  const [payOrderCode, setPayOrderCode] = useState<number>(0);
  const [copiedText, setCopiedText] = useState(false);

  // Modal thu tiền mặt (Bí thư CĐ)
  const [cashModalMember, setCashModalMember] = useState<DbMember | null>(null);
  const [cashSelectedMonths, setCashSelectedMonths] = useState<number[]>([]);

  // Modal xét miễn (hộ nghèo) & chuyển sinh hoạt
  const [exemptModalMember, setExemptModalMember] = useState<DbMember | null>(null);
  const [exemptMonths, setExemptMonths] = useState<number[]>([]);
  const [transferOutMonth, setTransferOutMonth] = useState<number | null>(null);

  // Load data
  const loadData = useCallback(async () => {
    try {
      const [st, pm, dist] = await Promise.all([
        getUnionFeeSettings(),
        listUnionFeePayments({ year: selectedYear }),
        listUnitFeeDistributions(selectedYear),
      ]);
      setSettings(st);
      setPayments(pm);
      setDistributions(dist);
    } catch (err) {
      showToast({
        title: 'Không thể tải dữ liệu đoàn phí',
        description: err instanceof Error ? err.message : '',
        type: 'error',
      });
    }
  }, [getUnionFeeSettings, listUnionFeePayments, listUnitFeeDistributions, selectedYear, showToast]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadData();
      setLoading(false);
    })();
  }, [loadData]);

  const memberById = useMemo(() => new Map(members.map(m => [m.id, m])), [members]);
  const unitById = useMemo(() => new Map(units.map(u => [u.id, u])), [units]);
  const myUnitId = currentMember?.unit_id || '';

  const activeMember = currentMember || members[0] || null;

  // Bản đồ các tháng đã đóng theo từng đoàn viên: memberId -> Set<tháng>
  const paidMonthsByMember = useMemo(() => {
    const map = new Map<string, Set<number>>();
    for (const p of payments) {
      if (p.year === selectedYear && p.status === 'approved') {
        const set = map.get(p.member_id) || new Set<number>();
        for (const m of p.months) set.add(m);
        map.set(p.member_id, set);
      }
    }
    return map;
  }, [payments, selectedYear]);

  // Các tháng đang chờ duyệt: memberId -> Set<tháng>
  const pendingMonthsByMember = useMemo(() => {
    const map = new Map<string, Set<number>>();
    for (const p of payments) {
      if (p.year === selectedYear && p.status === 'pending') {
        const set = map.get(p.member_id) || new Set<number>();
        for (const m of p.months) set.add(m);
        map.set(p.member_id, set);
      }
    }
    return map;
  }, [payments, selectedYear]);

  // Hàm tính trạng thái 1 tháng của 1 đoàn viên
  const getMonthStatus = useCallback((member: DbMember, month: number) => {
    const joinedYear = member.joined_date ? Number(member.joined_date.slice(0, 4)) : 0;
    const joinedMonth = member.joined_date ? Number(member.joined_date.slice(5, 7)) : 0;
    const transferOut = member.transferred_out_month;

    if (joinedYear === selectedYear && month < joinedMonth) {
      return { code: 'not_joined', label: 'Chưa vào Đoàn', color: 'bg-slate-100 text-slate-400' };
    }
    if (transferOut && month >= transferOut) {
      return { code: 'transferred', label: 'Đã chuyển đi', color: 'bg-slate-200 text-slate-500' };
    }
    if (member.exempt_months?.includes(month)) {
      return { code: 'exempt', label: 'Được xét miễn', color: 'bg-blue-100 text-blue-700 font-bold border-blue-200' };
    }
    const paidSet = paidMonthsByMember.get(member.id);
    if (paidSet?.has(month)) {
      return { code: 'paid', label: 'Đã đóng', color: 'bg-emerald-100 text-emerald-800 font-bold border-emerald-200' };
    }
    const pendingSet = pendingMonthsByMember.get(member.id);
    if (pendingSet?.has(month)) {
      return { code: 'pending', label: 'Chờ duyệt', color: 'bg-amber-100 text-amber-800 font-semibold border-amber-200 animate-pulse' };
    }

    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    if (selectedYear < currentYear || (selectedYear === currentYear && month <= currentMonth)) {
      return { code: 'unpaid', label: 'Còn nợ', color: 'bg-rose-100 text-rose-700 font-bold border-rose-200' };
    }
    return { code: 'future', label: 'Chưa đến hạn', color: 'bg-slate-50 text-slate-400' };
  }, [selectedYear, paidMonthsByMember, pendingMonthsByMember]);

  // Danh sách đoàn viên của chi đoàn (đối với bí thư CĐ) hoặc toàn xã (với admin)
  const scopedMembers = useMemo(() => {
    let list = members.filter(m => m.is_active);
    if (isSecretary) {
      list = list.filter(m => m.unit_id === myUnitId);
    } else if (isAdmin && selectedUnitFilter !== 'all') {
      list = list.filter(m => m.unit_id === selectedUnitFilter);
    }
    if (searchMember.trim()) {
      const q = removeVietnameseTones(searchMember.trim().toLowerCase());
      list = list.filter(m => removeVietnameseTones(m.full_name.toLowerCase()).includes(q));
    }
    return list;
  }, [members, isSecretary, myUnitId, isAdmin, selectedUnitFilter, searchMember]);

  // Mở modal VietQR
  const handleOpenPayModal = (targetMember: DbMember) => {
    setPayTargetMember(targetMember);
    const orderCode = generatePayOsOrderCode();
    setPayOrderCode(orderCode);

    // Mặc định chọn các tháng còn nợ
    const unpaidMonths: number[] = [];
    for (let m = 1; m <= 12; m++) {
      const st = getMonthStatus(targetMember, m);
      if (st.code === 'unpaid') unpaidMonths.push(m);
    }
    // Nếu không nợ tháng nào, mặc định gợi ý tháng hiện tại
    if (unpaidMonths.length === 0) {
      const curM = new Date().getMonth() + 1;
      const st = getMonthStatus(targetMember, curM);
      if (st.code !== 'paid' && st.code !== 'exempt') unpaidMonths.push(curM);
    }
    setSelectedMonthsToPay(unpaidMonths);
    setIsPayModalOpen(true);
  };

  // Tính số tiền theo các tháng được chọn
  const payAmount = useMemo(() => {
    if (!payTargetMember || !settings) return 0;
    const rate = payTargetMember.has_salary ? settings.fee_has_salary : settings.fee_non_salary;
    return selectedMonthsToPay.length * rate;
  }, [payTargetMember, settings, selectedMonthsToPay]);

  // Cú pháp chuyển khoản
  const transferContent = useMemo(() => {
    if (!payTargetMember) return '';
    return buildFeeTransferContent(payTargetMember.id, payTargetMember.full_name, selectedMonthsToPay, selectedYear);
  }, [payTargetMember, selectedMonthsToPay, selectedYear]);

  // Link ảnh VietQR dự phòng (khi payOS chưa cấu hình / lỗi)
  const fallbackQrUrl = useMemo(() => {
    if (!settings || payAmount <= 0) return '';
    return generateVietQrUrl({
      bankCode: settings.bank_code,
      accountNumber: settings.account_number,
      accountHolder: settings.account_holder,
      amount: payAmount,
      content: transferContent,
      template: 'compact2',
    });
  }, [settings, payAmount, transferContent]);

  // Đơn payOS được tạo khi mở modal hoặc khi đổi số tháng
  const [payosOrder, setPayosOrder] = useState<{
    paymentLinkId?: string;
    checkoutUrl?: string;
    qrCode?: string;
    bin?: string;
    accountNumber?: string;
    accountName?: string;
    status?: string;
    error?: string;
  } | null>(null);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  // Gọi payOS tạo đơn khi: mở modal, đổi số tiền, đổi nội dung
  // QUAN TRỌNG: mỗi lần tạo đơn phải dùng orderCode MỚI, nếu trùng payOS sẽ từ chối
  useEffect(() => {
    if (!isPayModalOpen || !payTargetMember || payAmount <= 0) {
      setPayosOrder(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const newOrderCode = generatePayOsOrderCode();
      setPayOrderCode(newOrderCode);
      setIsCreatingOrder(true);
      try {
        const res = await createPayOsPaymentLink({
          orderCode: newOrderCode,
          amount: payAmount,
          description: transferContent,
          buyerName: payTargetMember.full_name,
          buyerPhone: payTargetMember.phone || undefined,
          expiresInMinutes: 30,
        });
        if (cancelled) return;
        if (res.success && res.qrCode) {
          setPayosOrder({
            paymentLinkId: res.paymentLinkId,
            checkoutUrl: res.checkoutUrl,
            qrCode: res.qrCode,
            bin: res.bin,
            accountNumber: res.accountNumber,
            accountName: res.accountName,
            status: res.status,
          });

          // Tạo sẵn bản ghi thanh toán (pending) để webhook payOS có thể gạch nợ tự động.
          // Nếu đã có bản ghi pending cũ cùng năm của đoàn viên này thì xoá trước cho sạch.
          try {
            const oldPending = (await listUnionFeePayments({
              memberId: payTargetMember.id,
              year: selectedYear,
              status: 'pending',
            })).filter(p => p.payment_method === 'payos');
            for (const old of oldPending) {
              await reviewUnionFeePayment({ paymentId: old.id, status: 'rejected', note: 'Tạo đơn mới, huỷ đơn cũ' });
            }
            await createUnionFeePayment({
              memberId: payTargetMember.id,
              unitId: payTargetMember.unit_id,
              year: selectedYear,
              months: selectedMonthsToPay,
              amount: payAmount,
              paymentMethod: 'payos',
              orderCode: newOrderCode,
              note: `Cú pháp: ${transferContent}`,
            });
          } catch {
            /* Không chặn luồng hiển thị QR nếu tạo bản ghi lỗi */
          }
        } else {
          setPayosOrder({ error: res.message || 'Không tạo được đơn payOS' });
        }
      } catch (err) {
        if (!cancelled) setPayosOrder({ error: err instanceof Error ? err.message : 'Lỗi không xác định' });
      } finally {
        if (!cancelled) setIsCreatingOrder(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isPayModalOpen, payTargetMember?.id, payAmount, transferContent, createPayOsPaymentLink, selectedYear, selectedMonthsToPay, listUnionFeePayments, reviewUnionFeePayment, createUnionFeePayment]);

  // Ảnh QR hiển thị: ưu tiên payOS, nếu chưa có thì dùng ảnh VietQR dự phòng
  const qrImageUrl = useMemo(() => {
    if (payosOrder?.qrCode && payosOrder.bin) {
      // payOS trả về chuỗi QR thô → render qua dịch vụ ảnh VietQR của payOS
      return `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(payosOrder.qrCode)}`;
    }
    return fallbackQrUrl;
  }, [payosOrder, fallbackQrUrl]);

  // Kiểm tra trạng thái với payOS và gạch nợ nếu đã thanh toán
  const handleCheckPayOsStatus = async () => {
    if (isCheckingStatus) return;
    setIsCheckingStatus(true);
    try {
      const res = await checkPayOsPaymentStatus(payOrderCode);
      if (!res.success) {
        showToast({ title: 'Không kiểm tra được', description: res.message, type: 'error' });
        return;
      }
      if (res.status === 'PAID') {
        const confirm = await confirmPayOsPayment(payOrderCode, payAmount);
        if (confirm.success) {
          showToast({
            title: 'Thanh toán thành công!',
            description: `Đã ghi nhận ${payAmount.toLocaleString('vi-VN')}đ đoàn phí.`,
            type: 'success',
          });
          setIsPayModalOpen(false);
          await loadData();
        } else {
          showToast({ title: 'Đã nhận tiền nhưng ghi nhận lỗi', description: confirm.message, type: 'error' });
        }
      } else if (res.status === 'PENDING') {
        showToast({
          title: 'Chưa nhận được tiền',
          description: 'Hệ thống chưa thấy giao dịch. Vui lòng chờ 1-2 phút rồi thử lại.',
          type: 'info',
        });
      } else {
        showToast({
          title: `Đơn đã ${res.status?.toLowerCase()}`,
          description: 'Vui lòng tạo đơn mới nếu muốn thanh toán lại.',
          type: 'error',
        });
      }
    } catch (err) {
      showToast({ title: 'Có lỗi xảy ra', description: err instanceof Error ? err.message : '', type: 'error' });
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // TỰ ĐỘNG DÒ TRẠNG THÁI: khi modal đang mở & đã có đơn payOS, cứ 3 giây hỏi payOS 1 lần.
  // Khi thấy PAID → gạch nợ, đóng modal, nạp lại dữ liệu để các tháng chuyển xanh ngay.
  useEffect(() => {
    if (!isPayModalOpen || !payosOrder?.qrCode || payAmount <= 0) return;

    let stopped = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      if (stopped) return;
      try {
        const res = await checkPayOsPaymentStatus(payOrderCode);
        if (stopped || !res.success) return;

        if (res.status === 'PAID') {
          stopped = true;
          if (timer) clearInterval(timer);
          const confirm = await confirmPayOsPayment(payOrderCode, payAmount);
          if (confirm.success) {
            showToast({
              title: 'Thanh toán thành công!',
              description: `Đã ghi nhận ${payAmount.toLocaleString('vi-VN')}đ đoàn phí.`,
              type: 'success',
            });
          }
          setIsPayModalOpen(false);
          setPayosOrder(null);
          setSelectedMonthsToPay([]);
          await loadData();
        }
      } catch {
        /* im lặng, thử lại nhịp sau */
      }
    };

    timer = setInterval(poll, 3000);
    // Dò ngay lập tức 1 lần (trường hợp tiền đã về trước khi mở modal)
    setTimeout(poll, 1500);

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
    };
  }, [isPayModalOpen, payosOrder?.qrCode, payOrderCode, payAmount, checkPayOsPaymentStatus, confirmPayOsPayment, showToast, loadData]);

  // Xác nhận đã nộp (Đoàn viên bấm — đánh dấu đã chuyển, chờ bí thư/ payOS gạch nợ)
  const handleConfirmSent = async () => {
    if (!payTargetMember || selectedMonthsToPay.length === 0) return;
    setBusy('confirm_sent');
    try {
      // Nếu đã có đơn payOS thành công thì chỉ cần đóng modal + báo thành công luôn
      if (payosOrder?.qrCode) {
        const check = await checkPayOsPaymentStatus(payOrderCode);
        if (check.success && check.status === 'PAID') {
          const confirm = await confirmPayOsPayment(payOrderCode, payAmount);
          if (confirm.success) {
            showToast({
              title: 'Thanh toán thành công!',
              description: `Đã ghi nhận ${payAmount.toLocaleString('vi-VN')}đ đoàn phí.`,
              type: 'success',
            });
          }
          setIsPayModalOpen(false);
          setPayosOrder(null);
          setSelectedMonthsToPay([]);
          await loadData();
          return;
        }
      }

      // Chưa có đơn payOS (dự phòng): tạo yêu cầu chờ duyệt như cũ
      const res = await createUnionFeePayment({
        memberId: payTargetMember.id,
        unitId: payTargetMember.unit_id,
        year: selectedYear,
        months: selectedMonthsToPay,
        amount: payAmount,
        paymentMethod: 'payos',
        orderCode: payOrderCode,
        note: `Cú pháp: ${transferContent}`,
      });
      if (res.success) {
        showToast({
          title: 'Đã ghi nhận',
          description: 'Hệ thống đang chờ xác nhận thanh toán từ payOS.',
          type: 'success',
        });
        setIsPayModalOpen(false);
        setPayosOrder(null);
        setSelectedMonthsToPay([]);
        await loadData();
      } else {
        showToast({ title: 'Không thể tạo yêu cầu', description: res.message, type: 'error' });
      }
    } finally {
      setBusy(null);
    }
  };

  // Duyệt thanh toán chuyển khoản
  const handleReviewPayment = async (paymentId: string, status: 'approved' | 'rejected') => {
    setBusy(`review_${paymentId}`);
    try {
      const res = await reviewUnionFeePayment({ paymentId, status });
      if (res.success) {
        showToast({
          title: status === 'approved' ? 'Đã duyệt thanh toán đoàn phí' : 'Đã từ chối yêu cầu',
          type: 'success',
        });
        await loadData();
      } else {
        showToast({ title: 'Có lỗi xảy ra', description: res.message, type: 'error' });
      }
    } finally {
      setBusy(null);
    }
  };

  // Thu tiền mặt (Bí thư CĐ)
  const handleConfirmCashPayment = async () => {
    if (!cashModalMember || cashSelectedMonths.length === 0 || !settings) return;
    setBusy('cash_pay');
    try {
      const rate = cashModalMember.has_salary ? settings.fee_has_salary : settings.fee_non_salary;
      const amount = cashSelectedMonths.length * rate;

      const res = await createUnionFeePayment({
        memberId: cashModalMember.id,
        unitId: cashModalMember.unit_id,
        year: selectedYear,
        months: cashSelectedMonths,
        amount,
        paymentMethod: 'cash',
        note: 'Bí thư chi đoàn thu trực tiếp tiền mặt',
      });
      if (res.success) {
        showToast({
          title: `Đã thu tiền mặt (${amount.toLocaleString('vi-VN')}đ)`,
          description: `Đoàn viên: ${cashModalMember.full_name}`,
          type: 'success',
        });
        setCashModalMember(null);
        await loadData();
      } else {
        showToast({ title: 'Có lỗi xảy ra', description: res.message, type: 'error' });
      }
    } finally {
      setBusy(null);
    }
  };

  // Lưu xét miễn & chuyển sinh hoạt
  const handleSaveExemptStatus = async () => {
    if (!exemptModalMember) return;
    setBusy('save_exempt');
    try {
      const res = await updateMemberFeeStatus({
        memberId: exemptModalMember.id,
        exemptMonths,
        transferredOutMonth: transferOutMonth,
      });
      if (res.success) {
        showToast({ title: 'Cập nhật thành công', type: 'success' });
        setExemptModalMember(null);
        await loadData();
      } else {
        showToast({ title: 'Có lỗi xảy ra', description: res.message, type: 'error' });
      }
    } finally {
      setBusy(null);
    }
  };

  // Xuất file Excel
  const handleExportExcel = async (unitName?: string, unitId?: string) => {
    try {
      let exportMembers = members.filter(m => m.is_active);
      if (unitId) exportMembers = exportMembers.filter(m => m.unit_id === unitId);
      await exportUnionFeeWorkbook({
        year: selectedYear,
        unitName,
        members: exportMembers,
        units,
        payments,
      });
      showToast({ title: 'Đã xuất file Excel Sổ theo dõi đoàn phí', type: 'success' });
    } catch (err) {
      showToast({ title: 'Không thể xuất file Excel', description: err instanceof Error ? err.message : '', type: 'error' });
    }
  };

  // Gửi nhắc nhở nợ phí
  const handleSendReminder = async (recipientType: 'member' | 'unit' | 'all_unpaid', memberId?: string, unitId?: string) => {
    setBusy('send_remind');
    try {
      const res = await sendUnionFeeReminder({
        recipientType,
        memberId,
        unitId,
        year: selectedYear,
      });
      if (res.success) {
        showToast({
          title: `Đã gửi ${res.count} thông báo nhắc nộp đoàn phí`,
          type: 'success',
        });
      } else {
        showToast({ title: 'Có lỗi khi gửi nhắc nhở', description: res.message, type: 'error' });
      }
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500 text-sm">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Đang tải thông tin Đoàn phí…
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-16">
      {/* Tiêu đề trang */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[#1F5FBF]" />
            Thu, nộp & Quản lý Đoàn phí
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Theo Hướng dẫn 39-HD/TWĐTN-BKT · Mức thu 2.000đ (không lương), 5.000đ (có lương) · Tích hợp VietQR Napas 247 & payOS.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button title="Xuất Sổ Đoàn phí (Excel)"
            type="button"
            onClick={() => handleExportExcel(isSecretary ? unitById.get(myUnitId)?.name : undefined, isSecretary ? myUnitId : undefined)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-[#1F5FBF]" /> Xuất Sổ Đoàn phí (Excel)
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button title="Đoàn phí"
          type="button"
          onClick={() => setActiveTab('my_fee')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'my_fee' ? 'bg-white shadow-xs text-[#1F5FBF]' : 'text-slate-600'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5 inline mr-1" />
          {isMember ? 'Đoàn phí của tôi' : 'Đóng đoàn phí cá nhân'}
        </button>

        {!isMember && (
          <button title="Xác nhận đoàn viên"
            type="button"
            onClick={() => setActiveTab('unit_review')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'unit_review' ? 'bg-white shadow-xs text-[#1F5FBF]' : 'text-slate-600'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 inline mr-1" />
            {isSecretary ? 'Chi đoàn của tôi' : 'Theo dõi & Duyệt thu'}
          </button>
        )}

        {isAdmin && (
          <button title="Trích nộp 2/3 - 1/3 (Toàn xã)"
            type="button"
            onClick={() => setActiveTab('distributions')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'distributions' ? 'bg-white shadow-xs text-[#1F5FBF]' : 'text-slate-600'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 inline mr-1" />
            Trích nộp 2/3 - 1/3 (Toàn xã)
          </button>
        )}

        {isAdmin && (
          <button title="Cấu hình Ngân hàng & payOS"
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'settings' ? 'bg-white shadow-xs text-[#1F5FBF]' : 'text-slate-600'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 inline mr-1" />
            Cấu hình Ngân hàng & payOS
          </button>
        )}
      </div>

      {/* ================= TAB 1: ĐOÀN PHÍ CÁ NHÂN ================= */}
      {activeTab === 'my_fee' && activeMember && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                {activeMember.avatar_url && (
                  <Avatar src={activeMember.avatar_url} name={activeMember.full_name} seed={activeMember.id} size={48} />
                )}
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{activeMember.full_name}</h3>
                  <p className="text-xs text-slate-500">
                    Chi đoàn: {unitById.get(activeMember.unit_id)?.name} · Đối tượng:{' '}
                    <strong className="text-slate-700">
                      {activeMember.has_salary ? 'Có hưởng lương (5.000đ/tháng)' : 'Không hưởng lương (2.000đ/tháng)'}
                    </strong>
                  </p>
                </div>
              </div>

              <button title="Quét VietQR nộp đoàn phí"
                type="button"
                onClick={() => handleOpenPayModal(activeMember)}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded-xl shadow-xs"
              >
                <QrCode className="w-4 h-4" /> Quét VietQR nộp đoàn phí
              </button>
            </div>

            {/* Ma trận 12 tháng của tôi */}
            <div>
              <p className="text-xs font-bold text-slate-800 mb-2">Tiến độ nộp đoàn phí năm {selectedYear}:</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => {
                  const st = getMonthStatus(activeMember, m);
                  return (
                    <div
                      key={m}
                      className={`p-2.5 rounded-xl border text-center flex flex-col justify-between ${st.color}`}
                    >
                      <span className="text-xs font-bold">Tháng {m}</span>
                      <span className="text-[10px] mt-1 line-clamp-1">{st.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Chú giải trạng thái */}
            <div className="flex flex-wrap items-center gap-4 pt-2 text-[11px] text-slate-500 border-t border-slate-100">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Đã nộp</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Xét miễn hộ nghèo</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Đang chờ duyệt</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Còn nợ</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span> Chưa tới hạn / Chưa vào Đoàn</span>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: THEO DÕI & DUYỆT THU (BÍ THƯ CHI ĐOÀN) ================= */}
      {activeTab === 'unit_review' && !isMember && (
        <div className="space-y-4">
          {/* Thanh công cụ lọc & Nhắc nhở */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchMember}
                  onChange={e => setSearchMember(e.target.value)}
                  placeholder="Tìm kiếm đoàn viên theo tên…"
                  className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                />
              </div>

              {isAdmin && (
                <select
                  value={selectedUnitFilter}
                  onChange={e => setSelectedUnitFilter(e.target.value)}
                  className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                >
                  <option value="all">Tất cả chi đoàn</option>
                  {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button title="Nhắc nợ đoàn phí hôm nay"
                type="button"
                disabled={busy === 'send_remind'}
                onClick={() => handleSendReminder(isSecretary ? 'unit' : 'all_unpaid', undefined, isSecretary ? myUnitId : undefined)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-2xs disabled:opacity-60"
              >
                {busy === 'send_remind' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Nhắc nợ đoàn phí hôm nay
              </button>
            </div>
          </div>

          {/* Hàng đợi các khoản chờ duyệt */}
          {payments.filter(p => p.status === 'pending' && (!isSecretary || p.unit_id === myUnitId)).length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
              <h3 className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-600" />
                Khoản chuyển khoản chờ xác nhận ({payments.filter(p => p.status === 'pending' && (!isSecretary || p.unit_id === myUnitId)).length})
              </h3>
              <div className="divide-y divide-amber-200/60 text-xs">
                {payments.filter(p => p.status === 'pending' && (!isSecretary || p.unit_id === myUnitId)).map(p => {
                  const m = memberById.get(p.member_id);
                  return (
                    <div key={p.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-slate-800">{m?.full_name}</span> ({unitById.get(p.unit_id)?.name})
                        <span className="text-slate-500 ml-2">
                          Số tiền: <strong className="text-emerald-700">{p.amount.toLocaleString('vi-VN')}đ</strong> · Các tháng: T{p.months.join(', T')}
                        </span>
                        {p.note && <p className="text-[11px] text-slate-500 mt-0.5">{p.note}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button title="Duyệt"
                          type="button"
                          disabled={busy === `review_${p.id}`}
                          onClick={() => handleReviewPayment(p.id, 'approved')}
                          className="px-3 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" /> Duyệt
                        </button>
                        <button title="Từ chối"
                          type="button"
                          disabled={busy === `review_${p.id}`}
                          onClick={() => handleReviewPayment(p.id, 'rejected')}
                          className="px-3 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg"
                        >
                          Từ chối
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bảng theo dõi 12 tháng toàn bộ đoàn viên */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="text-left px-3 py-2.5 font-bold">Họ và tên</th>
                    <th className="text-left px-3 py-2.5 font-bold">Chi đoàn</th>
                    <th className="text-center px-2 py-2.5 font-bold">Mức/tháng</th>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                      <th key={m} className="text-center px-1.5 py-2.5 font-bold">T{m}</th>
                    ))}
                    <th className="text-center px-3 py-2.5 font-bold">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scopedMembers.map(m => {
                    const rate = m.has_salary ? 5000 : 2000;
                    return (
                      <tr key={m.id} className="hover:bg-slate-50/70">
                        <td className="px-3 py-2">
                          <span className="font-bold text-slate-800">{m.full_name}</span>
                          {m.exempt_months && m.exempt_months.length > 0 && (
                            <span className="ml-1 text-[10px] text-blue-600 font-semibold">(Miễn {m.exempt_months.length}T)</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-600">{unitById.get(m.unit_id)?.name}</td>
                        <td className="px-2 py-2 text-center text-slate-700 font-mono">
                          {rate.toLocaleString('vi-VN')}đ
                        </td>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => {
                          const st = getMonthStatus(m, month);
                          return (
                            <td key={month} className="px-1 py-2 text-center">
                              <span
                                className={`inline-block w-5 h-5 leading-5 rounded text-[10px] font-bold ${
                                  st.code === 'paid'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : st.code === 'exempt'
                                    ? 'bg-blue-100 text-blue-800'
                                    : st.code === 'unpaid'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'text-slate-300'
                                }`}
                                title={`Tháng ${month}: ${st.label}`}
                              >
                                {st.code === 'paid' ? '✓' : st.code === 'exempt' ? 'M' : st.code === 'unpaid' ? '!' : '-'}
                              </span>
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setCashModalMember(m);
                                const unpaid: number[] = [];
                                for (let i = 1; i <= 12; i++) {
                                  if (getMonthStatus(m, i).code === 'unpaid') unpaid.push(i);
                                }
                                setCashSelectedMonths(unpaid.length ? unpaid : [new Date().getMonth() + 1]);
                              }}
                              className="px-2 py-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded shadow-2xs"
                              title="Thu tiền mặt trực tiếp"
                            >
                              Thu tiền mặt
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setExemptModalMember(m);
                                setExemptMonths(m.exempt_months || []);
                                setTransferOutMonth(m.transferred_out_month || null);
                              }}
                              className="px-2 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded"
                              title="Xét miễn khó khăn / chuyển sinh hoạt"
                            >
                              Sửa diện
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 3: TRÍCH NỘP 2/3 - 1/3 (TOÀN XÃ) ================= */}
      {activeTab === 'distributions' && isAdmin && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-600">
              Quy tắc Hướng dẫn 39: <strong>Chi đoàn giữ lại 2/3</strong> kinh phí để chi hoạt động;{' '}
              <strong>Đoàn xã giữ lại 1/3</strong> để trích nộp cấp trên và khen thưởng.
            </p>
            <button title="Tính toán & Tổng hợp lại"
              type="button"
              disabled={busy === 'gen_dist'}
              onClick={async () => {
                setBusy('gen_dist');
                try {
                  const res = await generateUnitFeeDistributions(selectedYear);
                  if (res.success) {
                    showToast({ title: 'Đã tổng hợp lại số liệu trích nộp', type: 'success' });
                    await loadData();
                  }
                } finally {
                  setBusy(null);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded-lg shadow-2xs disabled:opacity-60"
            >
              {busy === 'gen_dist' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Tính toán & Tổng hợp lại
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="text-left px-3 py-2.5 font-bold">Chi đoàn</th>
                  <th className="text-right px-3 py-2.5 font-bold">Tổng thu (100%)</th>
                  <th className="text-right px-3 py-2.5 font-bold text-emerald-800">Chi đoàn giữ (2/3)</th>
                  <th className="text-right px-3 py-2.5 font-bold text-blue-800">Xã giữ lại (1/3)</th>
                  <th className="text-center px-3 py-2.5 font-bold">Trạng thái hoàn trả 2/3</th>
                  <th className="text-center px-3 py-2.5 font-bold">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {distributions.map(d => {
                  const u = unitById.get(d.unit_id);
                  return (
                    <tr key={d.id} className="hover:bg-slate-50/70">
                      <td className="px-3 py-2.5 font-bold text-slate-800">{u?.name || 'Chi đoàn'}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-800">
                        {d.total_collected.toLocaleString('vi-VN')}đ
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-700">
                        {d.unit_share.toLocaleString('vi-VN')}đ
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-blue-700">
                        {d.commune_share.toLocaleString('vi-VN')}đ
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {d.is_refunded ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> Đã hoàn trả 2/3 ({formatDateVN(d.refunded_at || '')})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                            <Clock className="w-3 h-3" /> Chưa hoàn trả
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {!d.is_refunded && d.unit_share > 0 && (
                          <button title="Đánh dấu đã hoàn tiền"
                            type="button"
                            onClick={async () => {
                              const receipt = await promptDialog({
                                title: 'Hoàn trả 2/3 kinh phí cho Chi đoàn',
                                message: 'Nhập số phiếu chi / biên lai để lưu vào sổ quỹ.',
                                placeholder: 'VD: PC-2026-015',
                                required: true,
                                confirmText: 'Xác nhận đã hoàn tiền',
                                variant: 'warning',
                              });
                              if (receipt === null) return;
                              const res = await markFeeDistributionRefunded({
                                distributionId: d.id,
                                receiptNo: receipt,
                              });
                              if (res.success) {
                                showToast({ title: 'Đã đánh dấu hoàn trả 2/3 thành công', type: 'success' });
                                await loadData();
                              }
                            }}
                            className="px-2.5 py-1 text-[11px] font-bold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded shadow-2xs"
                          >
                            Đánh dấu đã hoàn tiền
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 4: CẤU HÌNH NGÂN HÀNG & PAYOS ================= */}
      {activeTab === 'settings' && isAdmin && settings && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-5 max-w-2xl shadow-2xs">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#1F5FBF]" />
              Tài khoản nhận đoàn phí tập trung của Đoàn xã
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Mọi mã VietQR tạo cho đoàn viên sẽ chuyển trực tiếp về tài khoản này.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Ngân hàng</label>
              <select
                value={settings.bank_code}
                onChange={e => {
                  const b = POPULAR_BANKS.find(x => x.code === e.target.value);
                  setSettings(prev => prev ? { ...prev, bank_code: e.target.value, bank_name: b?.shortName || prev.bank_name } : null);
                }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold"
              >
                {POPULAR_BANKS.map(b => (
                  <option key={b.code} value={b.code}>{b.shortName} ({b.fullName})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Số tài khoản</label>
              <input
                value={settings.account_number}
                onChange={e => setSettings(prev => prev ? { ...prev, account_number: e.target.value } : null)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Tên chủ tài khoản (In hoa không dấu)</label>
              <input
                value={settings.account_holder}
                onChange={e => setSettings(prev => prev ? { ...prev, account_holder: e.target.value.toUpperCase() } : null)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Ngày quét gửi nhắc nợ hàng tháng</label>
              <input
                type="number"
                min={1}
                max={28}
                value={settings.auto_remind_day}
                onChange={e => setSettings(prev => prev ? { ...prev, auto_remind_day: Number(e.target.value) } : null)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-3">
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Tích hợp Cổng thanh toán payOS (Gạch nợ tự động 24/7)
            </h4>

            <div className="space-y-2 text-xs">
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Client ID</label>
                <input
                  value={settings.payos_client_id}
                  onChange={e => setSettings(prev => prev ? { ...prev, payos_client_id: e.target.value } : null)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-500 block mb-1">API Key</label>
                <input
                  type="password"
                  value={settings.payos_api_key}
                  onChange={e => setSettings(prev => prev ? { ...prev, payos_api_key: e.target.value } : null)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Checksum Key</label>
                <input
                  type="password"
                  value={settings.payos_checksum_key}
                  onChange={e => setSettings(prev => prev ? { ...prev, payos_checksum_key: e.target.value } : null)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-[11px]"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button title="Lưu cấu hình"
              type="button"
              disabled={busy === 'save_settings'}
              onClick={async () => {
                setBusy('save_settings');
                try {
                  const res = await updateUnionFeeSettings(settings);
                  if (res.success) {
                    showToast({ title: 'Đã lưu cấu hình tài khoản & payOS', type: 'success' });
                  } else {
                    showToast({ title: 'Không thể lưu', description: res.message, type: 'error' });
                  }
                } finally {
                  setBusy(null);
                }
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded-lg shadow-xs disabled:opacity-60"
            >
              {busy === 'save_settings' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Lưu cấu hình
            </button>
          </div>
        </div>
      )}

      {/* ================= MODAL: QUÉT VIETQR NAPAS ================= */}
      {isPayModalOpen && payTargetMember && settings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Quét mã VietQR nộp đoàn phí</h3>
                <p className="text-xs text-slate-500">{payTargetMember.full_name} · Năm {selectedYear}</p>
              </div>
              <button title="Đóng" type="button" onClick={() => setIsPayModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chọn các tháng cần nộp */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1.5">
                Chọn các tháng nộp ({selectedMonthsToPay.length} tháng):
              </label>
              <div className="grid grid-cols-4 gap-1.5 text-xs">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => {
                  const st = getMonthStatus(payTargetMember, m);
                  const isChecked = selectedMonthsToPay.includes(m);
                  const isPaidOrExempt = st.code === 'paid' || st.code === 'exempt' || st.code === 'not_joined';
                  return (
                    <button title="Tháng"
                      key={m}
                      type="button"
                      disabled={isPaidOrExempt}
                      onClick={() => {
                        setSelectedMonthsToPay(prev =>
                          prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
                        );
                      }}
                      className={`py-1.5 px-1 rounded-lg border text-center font-semibold transition-all ${
                        isPaidOrExempt
                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                          : isChecked
                          ? 'bg-[#1F5FBF] text-white border-[#1F5FBF]'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      Tháng {m}
                      {st.code === 'paid' && ' ✓'}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Ảnh mã QR Napas 247 */}
            {payAmount > 0 ? (
              <div className="flex flex-col items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                {isCreatingOrder ? (
                  <div className="h-56 flex flex-col items-center justify-center text-xs text-slate-500 gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-[#1F5FBF]" />
                    Đang tạo đơn payOS…
                  </div>
                ) : (
                  <>
                    <img src={qrImageUrl} alt="VietQR" className="w-56 h-auto rounded-lg shadow-sm border border-white" />

                    {/* Nhãn nguồn đơn */}
                    {payosOrder?.qrCode ? (
                      <span className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        <ShieldCheck className="w-3 h-3" /> Đơn payOS đã tạo (mã #{payOrderCode})
                      </span>
                    ) : payosOrder?.error ? (
                      <span className="mt-2 text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                        ⚠️ {payosOrder.error} — đang dùng VietQR dự phòng
                      </span>
                    ) : null}
                  </>
                )}

                <p className="text-sm font-bold text-emerald-700 mt-2">
                  Số tiền: {payAmount.toLocaleString('vi-VN')} đ
                </p>
                {payosOrder?.accountNumber && (
                  <p className="text-[10px] text-slate-500">
                    {payosOrder.accountName} · {payosOrder.accountNumber}
                  </p>
                )}
                <div className="mt-2 w-full p-2 bg-white rounded border border-slate-200 text-left text-[11px] flex items-center justify-between">
                  <div className="truncate mr-2">
                    <span className="text-slate-400 block text-[10px]">Cú pháp chuyển khoản:</span>
                    <span className="font-mono font-bold text-slate-800">{transferContent}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(transferContent);
                      setCopiedText(true);
                      setTimeout(() => setCopiedText(false), 2000);
                    }}
                    className="p-1 text-slate-500 hover:text-slate-700 shrink-0"
                    title="Sao chép cú pháp"
                  >
                    {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {payosOrder?.checkoutUrl && (
                  <a
                    href={payosOrder.checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#1F5FBF] hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" /> Mở trang thanh toán payOS
                  </a>
                )}
              </div>
            ) : (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-center text-xs text-amber-800">
                Vui lòng chọn ít nhất một tháng cần đóng phí.
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-100">
              <button title="Kiểm tra đã thanh toán"
                type="button"
                disabled={payAmount <= 0 || isCheckingStatus || !payosOrder?.qrCode}
                onClick={handleCheckPayOsStatus}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg disabled:opacity-50"
              >
                {isCheckingStatus ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Kiểm tra đã thanh toán
              </button>
              <button title="Đóng"
                type="button"
                onClick={() => setIsPayModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Đóng
              </button>
              <button title="Xác nhận đã chuyển tiền"
                type="button"
                disabled={payAmount <= 0 || busy === 'confirm_sent'}
                onClick={handleConfirmSent}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded-lg disabled:opacity-60"
              >
                {busy === 'confirm_sent' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Xác nhận đã chuyển tiền
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: THU TIỀN MẶT (BÍ THƯ) ================= */}
      {cashModalMember && settings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-3 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Xác nhận thu tiền mặt trực tiếp</h3>
                <p className="text-xs text-slate-500">{cashModalMember.full_name} · Năm {selectedYear}</p>
              </div>
              <button title="Đóng" type="button" onClick={() => setCashModalMember(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p className="text-[11px] text-slate-600">Chọn các tháng đã thu tiền mặt của đoàn viên:</p>
              <div className="grid grid-cols-4 gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => {
                  const isChecked = cashSelectedMonths.includes(m);
                  return (
                    <button title="Tháng"
                      key={m}
                      type="button"
                      onClick={() => {
                        setCashSelectedMonths(prev =>
                          prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
                        );
                      }}
                      className={`py-1.5 rounded-lg border text-center font-semibold ${
                        isChecked ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-slate-300'
                      }`}
                    >
                      Tháng {m}
                    </button>
                  );
                })}
              </div>

              <div className="p-3 bg-emerald-50 rounded-lg text-emerald-900 text-xs">
                Tổng tiền mặt thu được:{' '}
                <strong className="text-sm">
                  {(
                    cashSelectedMonths.length *
                    (cashModalMember.has_salary ? settings.fee_has_salary : settings.fee_non_salary)
                  ).toLocaleString('vi-VN')}
                  đ
                </strong>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button title="Hủy"
                type="button"
                onClick={() => setCashModalMember(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Hủy
              </button>
              <button title="Xác nhận đã thu đủ"
                type="button"
                disabled={cashSelectedMonths.length === 0 || busy === 'cash_pay'}
                onClick={handleConfirmCashPayment}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-60"
              >
                {busy === 'cash_pay' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Xác nhận đã thu đủ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: XÉT MIỄN & CHUYỂN SINH HOẠT ================= */}
      {exemptModalMember && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-3 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Sửa diện đoàn phí & Chuyển sinh hoạt</h3>
                <p className="text-xs text-slate-500">{exemptModalMember.full_name}</p>
              </div>
              <button title="Đóng" type="button" onClick={() => setExemptModalMember(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Xét miễn tối đa 6 tháng */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Xét miễn hoàn cảnh khó khăn / hộ nghèo (tối đa 6 tháng/năm theo Hướng dẫn 39):
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => {
                    const isChecked = exemptMonths.includes(m);
                    return (
                      <button title="Tháng"
                        key={m}
                        type="button"
                        onClick={() => {
                          if (isChecked) {
                            setExemptMonths(prev => prev.filter(x => x !== m));
                          } else {
                            if (exemptMonths.length >= 6) {
                              showToast({ title: 'Quy định chỉ được xét miễn tối đa 6 tháng trong năm', type: 'error' });
                              return;
                            }
                            setExemptMonths(prev => [...prev, m]);
                          }
                        }}
                        className={`py-1.5 rounded-lg border text-center font-semibold ${
                          isChecked ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-300'
                        }`}
                      >
                        Tháng {m}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Chuyển sinh hoạt Đoàn */}
              <div className="pt-2 border-t border-slate-100">
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Chuyển sinh hoạt Đoàn đi nơi khác:
                </label>
                <select
                  value={transferOutMonth || ''}
                  onChange={e => setTransferOutMonth(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                >
                  <option value="">Vẫn sinh hoạt bình thường cả năm</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                    <option key={m} value={m}>Chuyển sinh hoạt từ Tháng {m} (không tính nợ từ tháng này)</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button title="Hủy"
                type="button"
                onClick={() => setExemptModalMember(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Hủy
              </button>
              <button title="Lưu thay đổi"
                type="button"
                disabled={busy === 'save_exempt'}
                onClick={handleSaveExemptStatus}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded-lg disabled:opacity-60"
              >
                {busy === 'save_exempt' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
