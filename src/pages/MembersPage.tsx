import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Avatar } from '../components/common/Avatar';
import { useConfirm } from '../components/common/ConfirmDialog';
import {
  Users,
  Search,
  Filter,
  Plus,
  Download,
  Upload,
  Eye,
  EyeOff,
  ChevronRight,
  X,
  UserCheck,
  Building2,
  Calendar,
  Phone,
  Shield,
  Award,
  AlertTriangle,
  AlertCircle,
  FileSpreadsheet,
  CheckCircle2,
  Save,
  Trash2,
  Edit2,
  ExternalLink,
  Loader2,
  Check,
  PowerOff,
  Power,
} from 'lucide-react';
import { Member, Gender, CurrentPosition, PoliticalTheoryLevel } from '../types';
import { formatDateVN } from '../mock/data';
import { removeVietnameseTones, calculateAge, isMemberMatured } from '../utils/vietnamese';
import { exportExcel } from '../utils/exportExcel';
import { downloadMemberTemplate } from '../utils/memberTemplate';
import { supabase } from '../data';
import type { ParseResult, ParsedMemberRow } from '../utils/membersImport';
import type { PartyTargetStatus } from '../types';

export const MembersPage: React.FC = () => {
  const {
    members,
    units,
    profiles,
    unitCommittees,
    taskRegistrations,
    tasks,
    yearlySettings,
    ethnicities,
    currentRole,
    currentMember,
    createMember,
    updateMember,
    deleteMember,
    setMemberActive,
    bulkImportMembers,
    createUnit,
    getUnitById,
    getTaskById,
    showToast,
    reviewMemberRegistration,
    toggleMemberNewlyAdmitted,
    addCommitteeMember,
  } = useApp();

  const { confirm } = useConfirm();

  const isSecretary = currentRole === 'unit_secretary';
  const isAdmin = currentRole === 'super_admin' || currentRole === 'admin';
  const myUnitId = currentMember?.unit_id || '';

  // Modal từ chối đoàn viên tự đăng ký
  const [rejectingMember, setRejectingMember] = useState<Member | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isReviewingReg, setIsReviewingReg] = useState(false);

  // Modal Bổ nhiệm vào Ban Chấp hành
  const [appointMember, setAppointMember] = useState<Member | null>(null);
  const [appointPosition, setAppointPosition] = useState<'secretary' | 'deputy_secretary' | 'committee_member'>('committee_member');
  const [appointIsStanding, setAppointIsStanding] = useState(false);
  const [appointTermStart, setAppointTermStart] = useState(new Date().toISOString().slice(0, 10));
  // Cấp bộ được bổ nhiệm: 'unit' = chi đoàn của đoàn viên; 'commune' = BCH Đoàn xã
  const [appointScope, setAppointScope] = useState<'unit' | 'commune'>('unit');
  const [appointError, setAppointError] = useState('');
  const [isAppointing, setIsAppointing] = useState(false);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('all');
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');
  const [positionFilter, setPositionFilter] = useState<'all' | 'secretary' | 'deputy_secretary' | 'member'>('all');
  const [partyFilter, setPartyFilter] = useState<'all' | 'party' | 'elite' | 'non_party'>('all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [maturedFilter, setMaturedFilter] = useState<'all' | 'matured' | 'unmatured'>('all');
  const [ageMin, setAgeMin] = useState<string>('');
  const [ageMax, setAgeMax] = useState<string>('');

  // Phân trang danh sách đoàn viên
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedUnit, genderFilter, positionFilter, partyFilter, activeFilter, maturedFilter, ageMin, ageMax]);

  // Unmasked phone numbers toggle (id set)
  const [unmaskedPhoneIds, setUnmaskedPhoneIds] = useState<Set<string>>(new Set());

  // Selected Member for Profile Drawer
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  // Add / Edit Member Modal
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

  // Form State
  const [formFullName, setFormFullName] = useState('');
  const [formBirthDate, setFormBirthDate] = useState('2002-05-15');
  const [formGender, setFormGender] = useState<Gender>('male');
  const [formPhone, setFormPhone] = useState('0912345678');
  const [formJoinedDate, setFormJoinedDate] = useState('2018-03-26');
  const [formUnitId, setFormUnitId] = useState(units[0]?.id || '');
  const [formPosition, setFormPosition] = useState<CurrentPosition>('member');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [formEducation, setFormEducation] = useState('12/12');
  const [formSpecialization, setFormSpecialization] = useState('Nông nghiệp sạch');
  const [formTheory, setFormTheory] = useState<PoliticalTheoryLevel>('other');
  const [formReligion, setFormReligion] = useState('Không');
  const [formIsParty, setFormIsParty] = useState(false);
  const [formIsElite, setFormIsElite] = useState(false);
  const [formEliteDate, setFormEliteDate] = useState('');
  const [formPartyStatus, setFormPartyStatus] = useState<PartyTargetStatus>('none');
  const [formEthnicityId, setFormEthnicityId] = useState('kinh');
  const [formJob, setFormJob] = useState('Lao động tự do');

  // Excel Import Wizard 4 Steps
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importStep, setImportStep] = useState<1 | 2 | 3 | 4>(1);
  const [importResult, setImportResult] = useState<ParseResult | null>(null);
  const parsedRows: ParsedMemberRow[] = importResult?.rows || [];
  const [selectedRowNums, setSelectedRowNums] = useState<Set<number>>(new Set());
  const [previewPage, setPreviewPage] = useState(1);
  const PREVIEW_PAGE_SIZE = 15;
  const [importFileName, setImportFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  const isStaff = currentRole === 'staff';

  // Đọc file Excel đoàn viên -> parsedRows
  const handleImportFile = async (file: File) => {
    try {
      const { parseMembersWorkbook } = await import('../utils/membersImport');
      const buf = await file.arrayBuffer();
      const result = await parseMembersWorkbook(buf, units, members);
      setImportResult(result);
      // Mặc định chọn tất cả dòng hợp lệ (không lỗi, không trùng)
      const validNums = new Set(result.rows.filter(r => r.isValid && !r.isDuplicate).map(r => r.rowNum));
      setSelectedRowNums(validNums);
      setPreviewPage(1);
      setImportFileName(file.name);
      setImportStep(3);
    } catch (e) {
      showToast({ title: 'Không đọc được file', description: e instanceof Error ? e.message : '', type: 'error' });
    }
  };

  // Toggle phone reveal
  const togglePhoneReveal = (id: string) => {
    if (isStaff) {
      showToast({ title: 'Quyền Staff bị giới hạn', description: 'Cán bộ theo dõi không có quyền xem đầy đủ số điện thoại.', type: 'info' });
      return;
    }
    setUnmaskedPhoneIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Email lấy từ profiles (chỉ có khi RPC list_profiles_admin chạy được).
  // Chỉ admin thấy; staff và các vai trò khác không thấy email.
  const canSeeEmail = currentRole === 'super_admin' || currentRole === 'admin';
  const getMemberEmail = (memberId: string): string => {
    if (!canSeeEmail) return '';
    return profiles.find(p => p.member_id === memberId)?.email ?? '';
  };

  // Danh sách hồ sơ tự đăng ký đang chờ Bí thư chi đoàn hoặc Admin duyệt
  const pendingMembers = useMemo(() => {
    return members.filter(m => {
      if (m.approval_status !== 'pending') return false;
      if (isSecretary && m.unit_id !== myUnitId) return false;
      return true;
    });
  }, [members, isSecretary, myUnitId]);

  // Mask Phone helper
  const getDisplayPhone = (id: string, phone: string) => {
    if (isStaff) {
      return phone.length >= 7 ? phone.substring(0, 3) + '******' + phone.substring(phone.length - 2) : phone;
    }
    if (unmaskedPhoneIds.has(id)) {
      return phone;
    }
    return phone.length >= 7 ? phone.substring(0, 3) + '***' + phone.substring(phone.length - 3) : phone;
  };

  // Filter Members (Search KHÔNG DẤU)
  const filteredMembers = useMemo(() => {
    const searchNoTone = removeVietnameseTones(search);

    return members.filter(m => {
      if (selectedUnit !== 'all' && m.unit_id !== selectedUnit) return false;
      if (genderFilter !== 'all' && m.gender !== genderFilter) return false;
      if (positionFilter !== 'all' && m.current_position !== positionFilter) return false;
      if (partyFilter === 'party' && !m.is_party_member) return false;
      if (partyFilter === 'elite' && !m.is_elite_member) return false;
      if (partyFilter === 'non_party' && m.is_party_member) return false;
      if (activeFilter === 'active' && !m.is_active) return false;
      if (activeFilter === 'inactive' && m.is_active) return false;

      const age = calculateAge(m.birth_date);
      const isMatured = isMemberMatured(m.birth_date, yearlySettings.matured_age);

      if (maturedFilter === 'matured' && !isMatured) return false;
      if (maturedFilter === 'unmatured' && isMatured) return false;

      if (ageMin && age < Number(ageMin)) return false;
      if (ageMax && age > Number(ageMax)) return false;

      if (searchNoTone) {
        const nameNoTone = removeVietnameseTones(m.full_name);
        const code = m.central_member_code.toLowerCase();
        const phone = m.phone;
        if (!nameNoTone.includes(searchNoTone) && !code.includes(searchNoTone) && !phone.includes(searchNoTone)) {
          return false;
        }
      }

      return true;
    });
  }, [
    members,
    selectedUnit,
    genderFilter,
    positionFilter,
    partyFilter,
    activeFilter,
    maturedFilter,
    ageMin,
    ageMax,
    search,
    yearlySettings,
  ]);

  // Open Add modal
  const handleOpenAddModal = () => {
    setEditingMemberId(null);
    setFormFullName('');
    setFormBirthDate('2003-05-15');
    setFormGender('male');
    setFormPhone('091' + Math.floor(1000000 + Math.random() * 9000000));
    setFormJoinedDate('2018-03-26');
    setFormUnitId(units[0]?.id || '');
    setFormPosition('member');
    setFormIsActive(true);
    setFormEducation('12/12');
    setFormSpecialization('Trồng trọt công nghệ cao');
    setFormTheory('other');
    setFormReligion('Không');
    setFormIsParty(false);
    setFormIsElite(false);
    setFormEliteDate('');
    setFormPartyStatus('none');
    setFormEthnicityId('kinh');
    setFormJob('Lao động tự do');
    setIsMemberModalOpen(true);
  };

  // Open Edit modal
  const handleOpenEditModal = (member: Member) => {
    setEditingMemberId(member.id);
    setFormFullName(member.full_name);
    setFormBirthDate(member.birth_date);
    setFormGender(member.gender);
    setFormPhone(member.phone);
    setFormJoinedDate(member.joined_date);
    setFormUnitId(member.unit_id);
    setFormPosition(member.current_position);
    setFormIsActive(member.is_active);
    setFormEducation(member.education_grade);
    setFormSpecialization(member.specialization || '');
    setFormTheory(member.political_theory_level);
    setFormReligion(member.religion);
    setFormIsParty(member.is_party_member);
    setFormIsElite(!!member.is_elite_member);
    setFormEliteDate(member.elite_date || '');
    setFormPartyStatus(member.party_target_status || (member.is_party_member ? 'admitted' : 'none'));
    setFormEthnicityId(member.ethnicity_id);
    setFormJob(member.current_job);
    setIsMemberModalOpen(true);
  };

  // Submit Add / Edit
  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFullName.trim()) {
      showToast({ title: 'Vui lòng nhập họ và tên', type: 'error' });
      return;
    }

    // Ràng buộc: mỗi chi đoàn chỉ được có 1 Bí thư đang giữ chức
    if (formPosition === 'secretary') {
      const existingSecretary = members.find(
        m => m.unit_id === formUnitId
          && m.current_position === 'secretary'
          && m.is_active
          && m.id !== editingMemberId
      );
      if (existingSecretary) {
        showToast({
          title: 'Chi đoàn đã có Bí thư',
          description: `${existingSecretary.full_name} đang là Bí thư ${getUnitById(formUnitId)?.name || 'chi đoàn này'}. Hãy đổi chức vụ người đó trước khi bổ nhiệm Bí thư mới.`,
          type: 'error',
        });
        return;
      }
    }

    if (editingMemberId) {
      await updateMember(editingMemberId, {
        full_name: formFullName.trim(),
        birth_date: formBirthDate,
        gender: formGender,
        phone: formPhone,
        joined_date: formJoinedDate,
        unit_id: formUnitId,
        current_position: formPosition,
        is_active: formIsActive,
        education_grade: formEducation,
        specialization: formSpecialization,
        political_theory_level: formTheory,
        religion: formReligion,
        is_party_member: formIsParty,
        is_elite_member: formIsElite || formIsParty,
        elite_date: formIsElite ? formEliteDate : undefined,
        party_target_status: formIsParty ? 'admitted' : formPartyStatus,
        ethnicity_id: formEthnicityId,
        current_job: formJob,
      });
      setIsMemberModalOpen(false);
    } else {
      const res = await createMember({
        full_name: formFullName.trim(),
        birth_date: formBirthDate,
        gender: formGender,
        phone: formPhone,
        joined_date: formJoinedDate,
        unit_id: formUnitId,
        current_position: formPosition,
        education_grade: formEducation,
        specialization: formSpecialization,
        political_theory_level: formTheory,
        is_active: true,
        religion: formReligion,
        is_party_member: formIsParty,
        is_elite_member: formIsElite || formIsParty,
        elite_date: formIsElite ? formEliteDate : undefined,
        party_target_status: formIsParty ? 'admitted' : formPartyStatus,
        ethnicity_id: formEthnicityId,
        avatar_url: '',
        current_job: formJob,
        central_member_code: `DNVN-2026-${Math.floor(10000 + Math.random() * 90000)}`,
      });

      if (res.success) {
        setIsMemberModalOpen(false);
      }
    }
  };

  // Export Excel
  const handleExportExcel = async () => {
    const rows = filteredMembers.map(m => ({
      full_name: m.full_name,
      code: m.central_member_code || '',
      birth: formatDateVN(m.birth_date),
      age: calculateAge(m.birth_date),
      matured: isMemberMatured(m.birth_date, yearlySettings.matured_age) ? 'Đã trưởng thành' : '',
      unit: getUnitById(m.unit_id)?.name ?? '',
      position: m.current_position === 'secretary' ? 'Bí thư' : m.current_position === 'deputy_secretary' ? 'Phó bí thư' : 'Đoàn viên',
      phone: getDisplayPhone(m.id, m.phone),
      email: getMemberEmail(m.id),
      party: m.is_party_member ? 'Đảng viên' : '',
      elite: m.is_elite_member ? 'Ưu tú' : '',
      status: m.is_active ? 'Hoạt động' : 'Ngừng hoạt động',
    }));
    await exportExcel({
      fileName: `Danh_sach_doan_vien_${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheetName: 'Đoàn viên',
      title: 'DANH SÁCH ĐOÀN VIÊN',
      columns: [
        { header: 'Họ và tên', key: 'full_name', width: 24 },
        { header: 'Mã ĐV TW', key: 'code', width: 14 },
        { header: 'Ngày sinh', key: 'birth', width: 12 },
        { header: 'Tuổi', key: 'age', width: 7 },
        { header: 'Trưởng thành', key: 'matured', width: 14 },
        { header: 'Chi đoàn', key: 'unit', width: 24 },
        { header: 'Chức vụ', key: 'position', width: 12 },
        { header: 'Số điện thoại', key: 'phone', width: 14 },
        ...(canSeeEmail ? [{ header: 'Email', key: 'email', width: 26 }] : []),
        { header: 'Đảng viên', key: 'party', width: 11 },
        { header: 'ĐV Ưu tú', key: 'elite', width: 12 },
        { header: 'Trạng thái', key: 'status', width: 16 },
      ],
      rows,
    });
    showToast({
      title: 'Đã xuất file Excel',
      description: `${filteredMembers.length} đoàn viên theo bộ lọc hiện tại.`,
      type: 'success',
    });
  };

  // Confirm Import
  const handleConfirmImport = async () => {
    if (!importResult) return;
    // Lọc theo các dòng được tích chọn VÀ hợp lệ
    const rowsToImport = importResult.rows.filter(r => selectedRowNums.has(r.rowNum) && r.isValid);
    if (rowsToImport.length === 0) {
      showToast({ title: 'Vui lòng chọn ít nhất một đoàn viên hợp lệ để nhập', type: 'error' });
      return;
    }

    setImporting(true);
    try {
      // 1. Tự động tạo Chi đoàn mới nếu có
      if (supabase && importResult.newUnitsToCreate.length > 0) {
        for (const newUnitName of importResult.newUnitsToCreate) {
          const { data: existU } = await supabase.from('units').select('id').ilike('name', newUnitName).maybeSingle();
          if (!existU) {
            await createUnit({
              name: newUnitName,
              unit_type_id: 'other',
              note: 'Tạo tự động từ file Excel',
            });
          }
        }
      }

      // Lấy danh sách chi đoàn mới nhất trực tiếp từ DB
      const unitMap = new Map<string, string>();
      if (supabase) {
        const { data: latestUnits } = await supabase.from('units').select('id, name');
        (latestUnits ?? []).forEach(u => unitMap.set(String(u.name).toLowerCase().trim(), String(u.id)));
      } else {
        units.forEach(u => unitMap.set(u.name.toLowerCase().trim(), u.id));
      }

      // Map dân tộc
      const ethMap = new Map<string, string>();
      ethnicities.forEach(e => ethMap.set(e.name.toLowerCase().trim(), e.id));
      const defaultEthId = ethnicities[0]?.id || '1';

      // 2. Chuyển đổi dữ liệu chuẩn (đặc biệt education_grade phải là số smallint 1..12)
      const newMembersToImport = rowsToImport.map(r => {
        const uKey = (r.unit_name || '').toLowerCase().trim();
        const assignedUnitId = unitMap.get(uKey) || units[0]?.id || '1';
        const eKey = (r.ethnicity_name || 'Kinh').toLowerCase().trim();
        const assignedEthId = ethMap.get(eKey) || defaultEthId;

        // Chuẩn hóa education_grade thành số nguyên từ 1 đến 12 (DB smallint)
        let gradeNum = 12;
        const matchDigits = String(r.education_grade || '').match(/^(\d{1,2})/);
        if (matchDigits) {
          const parsed = parseInt(matchDigits[1], 10);
          if (parsed >= 1 && parsed <= 12) gradeNum = parsed;
        }

        return {
          full_name: r.full_name,
          birth_date: r.birth_date,
          gender: r.gender,
          phone: r.phone,
          joined_date: r.joined_date || `${new Date().getFullYear()}-03-26`,
          unit_id: assignedUnitId,
          current_position: r.current_position,
          education_grade: gradeNum as unknown as string,
          specialization: r.specialization || undefined,
          political_theory_level: r.political_theory_level,
          is_active: true,
          religion: r.religion || 'Không',
          is_party_member: r.is_party_member,
          is_elite_member: r.is_elite_member || r.is_party_member,
          party_target_status: r.is_party_member ? ('admitted' as PartyTargetStatus) : r.is_elite_member ? ('elite' as PartyTargetStatus) : ('none' as PartyTargetStatus),
          ethnicity_id: assignedEthId,
          avatar_url: '',
          current_job: r.specialization || 'Lao động tự do',
          central_member_code: '',
          note: r.note || undefined,
        };
      });

      const count = await bulkImportMembers(newMembersToImport as any);
      showToast({
        title: `Đã nhập thành công ${count} đoàn viên vào hệ thống`,
        description: importResult.newUnitsToCreate.length > 0
          ? `Đã đồng bộ vào ${importResult.newUnitsToCreate.length} chi đoàn mới.`
          : undefined,
        type: 'success',
      });
      setIsImportModalOpen(false);
      setImportStep(1);
      setImportResult(null);
      setSelectedRowNums(new Set());
      setImportFileName('');
    } catch (err) {
      showToast({
        title: 'Có lỗi khi nhập dữ liệu',
        description: err instanceof Error ? err.message : 'Lỗi không xác định',
        type: 'error',
      });
    } finally {
      setImporting(false);
    }
  };

  // Selected Member Details
  const linkedProfile = selectedMember ? profiles.find(p => p.member_id === selectedMember.id) : null;
  const memberCommittees = selectedMember ? unitCommittees.filter(c => c.member_id === selectedMember.id) : [];
  const memberRegistrations = selectedMember
    ? taskRegistrations
        .filter(tr => tr.member_id === selectedMember.id)
        .map(reg => ({ reg, task: getTaskById(reg.task_id) }))
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-[#1F5FBF]" />
            Quản trị Hồ sơ Đoàn viên ({members.length} Đoàn viên)
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            Tìm kiếm không dấu, kiểm tra độ tuổi trưởng thành ({yearlySettings.matured_age} tuổi) và đồng bộ số liệu
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button title="Xuất Excel ()"
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-500" /> Xuất Excel ({filteredMembers.length})
          </button>

          <button title="Nhập từ Excel"
            type="button"
            onClick={() => {
              setImportStep(1);
              setIsImportModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#1F5FBF] bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4" /> Nhập từ Excel
          </button>

          <button title="Thêm đoàn viên"
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded-lg shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Thêm đoàn viên
          </button>
        </div>
      </div>

      {/* BANNER: ĐOÀN VIÊN MỚI TỰ ĐĂNG KÝ GOOGLE CHỜ BÍ THƯ DUYỆT */}
      {pendingMembers.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs md:text-sm font-bold text-amber-900 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              Đoàn viên mới đăng ký tài khoản cần xác nhận ({pendingMembers.length})
            </h3>
            <span className="text-[11px] text-amber-700 font-semibold">
              Bí thư chi đoàn kiểm tra xem đúng đoàn viên của chi đoàn mình không
            </span>
          </div>

          <div className="divide-y divide-amber-200/60 bg-white rounded-xl border border-amber-200/80 overflow-hidden text-xs">
            {pendingMembers.map(pm => (
              <div key={pm.id} className="p-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {pm.avatar_url && (
                    <Avatar src={pm.avatar_url} name={pm.full_name} seed={pm.id} size={32} />
                  )}
                  <div>
                    <span className="font-bold text-slate-900">{pm.full_name}</span>
                    <span className="text-slate-500 ml-2">
                      Ngày sinh: {formatDateVN(pm.birth_date)} · Chi đoàn: <strong>{getUnitById(pm.unit_id)?.name}</strong> · SĐT: {pm.phone || '—'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button title="Xác nhận đoàn viên mình"
                    type="button"
                    disabled={isReviewingReg}
                    onClick={async () => {
                      setIsReviewingReg(true);
                      try {
                        const res = await reviewMemberRegistration({ memberId: pm.id, action: 'approve' });
                        if (res.success) {
                          showToast({ title: 'Đã xác nhận đoàn viên vào chi đoàn chính thức', type: 'success' });
                        }
                      } finally {
                        setIsReviewingReg(false);
                      }
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs"
                  >
                    <Check className="w-3.5 h-3.5" /> Xác nhận đoàn viên mình
                  </button>

                  <button title="Từ chối / Xóa"
                    type="button"
                    disabled={isReviewingReg}
                    onClick={() => {
                      setRejectingMember(pm);
                      setRejectReason('');
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg"
                  >
                    <X className="w-3.5 h-3.5" /> Từ chối / Xóa
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Box */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Ô tìm kiếm KHÔNG DẤU */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm theo tên KHÔNG DẤU (vd: nguyen van hung), CCCD, SĐT..."
              className="w-full pl-9 pr-4 py-2 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1F5FBF] focus:bg-white"
            />
          </div>

          {/* Chi đoàn */}
          <select
            value={selectedUnit}
            onChange={e => setSelectedUnit(e.target.value)}
            className="w-full md:w-52 p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700"
          >
            <option value="all">Tất cả chi đoàn</option>
            {units.map(u => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>

        {/* Chip và Sub-filters */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          {/* Giới tính */}
          <select
            value={genderFilter}
            onChange={e => setGenderFilter(e.target.value as any)}
            className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700"
          >
            <option value="all">Giới tính: Tất cả</option>
            <option value="male">Nam</option>
            <option value="female">Nữ</option>
          </select>

          {/* Chức vụ */}
          <select
            value={positionFilter}
            onChange={e => setPositionFilter(e.target.value as any)}
            className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700"
          >
            <option value="all">Chức vụ: Tất cả</option>
            <option value="secretary">Bí thư Chi đoàn</option>
            <option value="deputy_secretary">Phó Bí thư</option>
            <option value="member">Đoàn viên</option>
          </select>

          {/* Đảng viên */}
          <select
            value={partyFilter}
            onChange={e => setPartyFilter(e.target.value as any)}
            className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700"
          >
            <option value="all">Đảng viên: Tất cả</option>
            <option value="party">Đã vào Đảng</option>
            <option value="non_party">Chưa vào Đảng</option>
          </select>

          {/* Đã trưởng thành (tính tự động từ birth_date và matured_age) */}
          <select
            value={maturedFilter}
            onChange={e => setMaturedFilter(e.target.value as any)}
            className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700"
          >
            <option value="all">Độ tuổi trưởng thành</option>
            <option value="matured">Đã trưởng thành (≥{yearlySettings.matured_age} tuổi)</option>
            <option value="unmatured">Đang trong độ tuổi Đoàn (&lt;{yearlySettings.matured_age})</option>
          </select>

          {/* Khoảng tuổi */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
            <span className="text-slate-400">Tuổi từ:</span>
            <input
              type="number"
              value={ageMin}
              onChange={e => setAgeMin(e.target.value)}
              placeholder="16"
              className="w-10 bg-transparent text-center font-bold"
            />
            <span className="text-slate-400">-</span>
            <input
              type="number"
              value={ageMax}
              onChange={e => setAgeMax(e.target.value)}
              placeholder="35"
              className="w-10 bg-transparent text-center font-bold"
            />
          </div>
        </div>
      </div>

      {/* Bảng Đoàn viên */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 uppercase font-bold border-b border-slate-200">
              <tr>
                <th className="p-3.5">Họ và tên</th>
                <th className="p-3.5">Ngày sinh (Tuổi)</th>
                <th className="p-3.5">Chi đoàn</th>
                <th className="p-3.5">Chức vụ</th>
                <th className="p-3.5">Số điện thoại</th>
                <th className="p-3.5 text-center">Đảng viên</th>
                <th className="p-3.5 text-center">Trạng thái</th>
                <th className="p-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    Không tìm thấy đoàn viên nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                filteredMembers
                  .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                  .map(member => {
                  const unit = getUnitById(member.unit_id);
                  const age = calculateAge(member.birth_date);
                  const isMatured = isMemberMatured(member.birth_date, yearlySettings.matured_age);

                  return (
                    <tr
                      key={member.id}
                      onClick={() => setSelectedMember(member)}
                      className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                    >
                      <td className="p-3.5 font-bold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <Avatar src={member.avatar_url} name={member.full_name} seed={member.id} size={28} />
                          <div>
                            <span className="hover:text-[#1F5FBF] transition-colors">{member.full_name}</span>
                            {member.is_elite_member && (
                              <span className="ml-1.5 inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300" title="Đoàn viên ưu tú">
                                ★ Ưu tú
                              </span>
                            )}
                            {member.is_newly_admitted && (
                              <span className="ml-1.5 inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300" title="Đoàn viên mới kết nạp trong năm">
                                Mới kết nạp
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400 block font-mono">
                              {member.central_member_code}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        <span className="text-slate-800">{formatDateVN(member.birth_date)}</span>
                        <span
                          className={`ml-1.5 px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            isMatured ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {age} tuổi {isMatured && '• Trưởng thành'}
                        </span>
                      </td>

                      <td className="p-3.5 whitespace-nowrap font-medium text-slate-700">{unit?.name}</td>

                      <td className="p-3.5 whitespace-nowrap">
                        {member.current_position === 'secretary' ? (
                          <span className="font-bold text-[#1F5FBF]">Bí thư Chi đoàn</span>
                        ) : member.current_position === 'deputy_secretary' ? (
                          <span className="font-semibold text-blue-700">Phó Bí thư</span>
                        ) : (
                          <span className="text-slate-500">Đoàn viên</span>
                        )}
                      </td>

                      <td
                        className="p-3.5 whitespace-nowrap font-mono text-slate-700"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1.5">
                          <span>{getDisplayPhone(member.id, member.phone)}</span>
                          {!isStaff && (
                            <button
                              type="button"
                              onClick={() => togglePhoneReveal(member.id)}
                              className="text-slate-400 hover:text-slate-700 p-0.5"
                              title="Ẩn / Hiện số điện thoại đầy đủ"
                            >
                              {unmaskedPhoneIds.has(member.id) ? (
                                <EyeOff className="w-3.5 h-3.5" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="p-3.5 text-center whitespace-nowrap">
                        {member.is_party_member ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                            Đảng viên
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      <td className="p-3.5 text-center whitespace-nowrap">
                        {member.is_active ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            Hoạt động
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-400">
                            Chuyển sinh hoạt
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(member)}
                            className="p-1.5 text-slate-500 hover:text-[#1F5FBF] hover:bg-slate-100 rounded-lg cursor-pointer"
                            title="Sửa hồ sơ"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const willDeactivate = member.is_active;
                              const ok = await confirm({
                                title: willDeactivate
                                  ? `Ngừng hoạt động "${member.full_name}"?`
                                  : `Kích hoạt lại "${member.full_name}"?`,
                                message: willDeactivate
                                  ? 'Hồ sơ và toàn bộ lịch sử (điểm thi đua, minh chứng, đoàn phí) vẫn được giữ nguyên.'
                                  : 'Đoàn viên sẽ xuất hiện lại trong danh sách đang hoạt động.',
                                details: willDeactivate
                                  ? 'Đoàn viên sẽ bị ẩn khỏi danh sách mặc định nhưng vẫn tính vào báo cáo năm.'
                                  : undefined,
                                variant: willDeactivate ? 'warning' : 'success',
                                confirmText: willDeactivate ? 'Ngừng hoạt động' : 'Kích hoạt lại',
                              });
                              if (!ok) return;
                              try {
                                const res = await setMemberActive(member.id, !willDeactivate);
                                if (res.success) {
                                  showToast({
                                    title: willDeactivate
                                      ? `Đã ngừng hoạt động ${member.full_name}`
                                      : `Đã kích hoạt lại ${member.full_name}`,
                                    type: 'success',
                                  });
                                } else {
                                  showToast({ title: 'Không đổi được trạng thái', description: res.message, type: 'error' });
                                }
                              } catch (err) {
                                showToast({
                                  title: 'Không đổi được trạng thái',
                                  description: err instanceof Error ? err.message : 'Lỗi không xác định',
                                  type: 'error',
                                });
                              }
                            }}
                            className={`p-1.5 rounded-lg cursor-pointer ${
                              member.is_active
                                ? 'text-slate-500 hover:text-amber-600 hover:bg-amber-50'
                                : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                            }`}
                            title={member.is_active ? 'Ngừng hoạt động (giữ lịch sử)' : 'Kích hoạt lại'}
                          >
                            {member.is_active ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            type="button"
                            onClick={async () => {
                              const ok = await confirm({
                                title: `Xóa hẳn "${member.full_name}"?`,
                                message: 'Thao tác này KHÔNG THỂ HOÀN TÁC.',
                                details: 'Khuyến nghị: nếu đoàn viên đã có dữ liệu (nhiệm vụ, bài nộp, đoàn phí), hãy dùng "Ngừng hoạt động" để giữ lại lịch sử thay vì xóa.',
                                variant: 'danger',
                                confirmText: 'Xóa vĩnh viễn',
                              });
                              if (!ok) return;
                              try {
                                const res = await deleteMember(member.id);
                                if (res.success) {
                                  showToast({ title: `Đã xóa đoàn viên ${member.full_name}`, type: 'success' });
                                } else {
                                  showToast({
                                    title: 'Không thể xóa đoàn viên',
                                    description: res.message || 'Không rõ nguyên nhân.',
                                    type: 'error',
                                  });
                                }
                              } catch (err) {
                                showToast({
                                  title: 'Không thể xóa đoàn viên',
                                  description: err instanceof Error ? err.message : 'Lỗi không xác định',
                                  type: 'error',
                                });
                              }
                            }}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                            title="Xóa đoàn viên"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Thanh Phân Trang Danh Sách Đoàn Viên */}
        {filteredMembers.length > 0 && (
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-600">
              <span>Hiển thị</span>
              <select
                value={pageSize}
                onChange={e => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="p-1 bg-white border border-slate-300 rounded font-semibold text-slate-800"
              >
                <option value={20}>20</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>
                đoàn viên / trang (<b>{Math.min((currentPage - 1) * pageSize + 1, filteredMembers.length)}</b> -{' '}
                <b>{Math.min(currentPage * pageSize, filteredMembers.length)}</b> trong tổng <b>{filteredMembers.length}</b>)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(1)}
                className="px-2 py-1 bg-white border border-slate-300 rounded font-medium text-slate-600 disabled:opacity-40 hover:bg-slate-50"
                title="Trang đầu"
              >
                &laquo;
              </button>
              <button title="&lsaquo; Trước"
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded font-medium text-slate-600 disabled:opacity-40 hover:bg-slate-50"
              >
                &lsaquo; Trước
              </button>

              <span className="px-2 font-bold text-[#1F5FBF]">
                Trang {currentPage} / {Math.max(1, Math.ceil(filteredMembers.length / pageSize))}
              </span>

              <button title="Sau &rsaquo;"
                type="button"
                disabled={currentPage >= Math.ceil(filteredMembers.length / pageSize)}
                onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredMembers.length / pageSize), p + 1))}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded font-medium text-slate-600 disabled:opacity-40 hover:bg-slate-50"
              >
                Sau &rsaquo;
              </button>
              <button
                type="button"
                disabled={currentPage >= Math.ceil(filteredMembers.length / pageSize)}
                onClick={() => setCurrentPage(Math.ceil(filteredMembers.length / pageSize))}
                className="px-2 py-1 bg-white border border-slate-300 rounded font-medium text-slate-600 disabled:opacity-40 hover:bg-slate-50"
                title="Trang cuối"
              >
                &raquo;
              </button>
            </div>
          </div>
        )}
      </div>

      {/* HỒ SƠ ĐOÀN VIÊN CHI TIẾT (DRAWER TRƯỢT TỪ PHẢI) */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-xl h-full bg-white shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-start justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <Avatar
                  src={selectedMember.avatar_url}
                  name={selectedMember.full_name}
                  seed={selectedMember.id}
                  size={48}
                  className="ring-2 ring-blue-400 shadow-xs"
                />
                <div>
                  <h2 className="text-base font-bold text-slate-900">{selectedMember.full_name}</h2>
                  <p className="text-xs text-[#1F5FBF] font-semibold">
                    {getUnitById(selectedMember.unit_id)?.name} •{' '}
                    {selectedMember.current_position === 'secretary'
                      ? 'Bí thư Chi đoàn'
                      : selectedMember.current_position === 'deputy_secretary'
                      ? 'Phó Bí thư'
                      : 'Đoàn viên'}
                  </p>
                </div>
              </div>

              <button title="Đóng"
                type="button"
                onClick={() => setSelectedMember(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nội dung hồ sơ chia 6 nhóm */}
            <div className="flex-1 overflow-y-auto p-5 text-xs space-y-4">
              {/* Nhóm 1: Thông tin cá nhân */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-[#1F5FBF]">
                  1. Thông tin cá nhân
                </h4>
                <div className="grid grid-cols-2 gap-2 text-slate-700">
                  <div>
                    <span className="text-slate-400 block">Ngày sinh:</span>
                    <span className="font-semibold">{formatDateVN(selectedMember.birth_date)} ({calculateAge(selectedMember.birth_date)} tuổi)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Giới tính:</span>
                    <span className="font-semibold capitalize">{selectedMember.gender === 'male' ? 'Nam' : 'Nữ'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Số điện thoại:</span>
                    <span className="font-mono font-bold text-[#1F5FBF]">{getDisplayPhone(selectedMember.id, selectedMember.phone)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Mã đoàn viên TW:</span>
                    <span className="font-mono font-semibold">{selectedMember.central_member_code}</span>
                  </div>
                  {!isStaff && (
                    <>
                      <div>
                        <span className="text-slate-400 block">Dân tộc:</span>
                        <span className="font-semibold capitalize">{selectedMember.ethnicity_id}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Tôn giáo:</span>
                        <span className="font-semibold">{selectedMember.religion}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Nhóm 2: Đoàn - Đảng */}
              <div className="p-4 bg-blue-50/40 rounded-xl border border-blue-100 space-y-2.5">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-[#1F5FBF]">
                  2. Công tác Đoàn – Đảng
                </h4>
                <div className="grid grid-cols-2 gap-2 text-slate-700">
                  <div>
                    <span className="text-slate-400 block">Ngày vào Đoàn:</span>
                    <span className="font-semibold">{formatDateVN(selectedMember.joined_date)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Đảng viên:</span>
                    <span className="font-bold">{selectedMember.is_party_member ? 'Đảng viên chính thức' : 'Chưa vào Đảng'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Đoàn viên ưu tú:</span>
                    <span className="font-bold text-amber-700">
                      {selectedMember.is_elite_member ? (
                        <>★ Đã công nhận {selectedMember.elite_date ? `(${formatDateVN(selectedMember.elite_date)})` : ''}</>
                      ) : (
                        'Chưa'
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Tình trạng tuổi đoàn:</span>
                    <span className="font-semibold">
                      {isMemberMatured(selectedMember.birth_date, yearlySettings.matured_age)
                        ? `Đã trưởng thành đoàn (≥${yearlySettings.matured_age} tuổi)`
                        : 'Trong độ tuổi đoàn'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Quy hoạch chức danh:</span>
                    <span className="font-semibold">{selectedMember.planned_position || 'Chưa quy hoạch'}</span>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-blue-100 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 block text-xs">Đoàn viên mới kết nạp trong năm:</span>
                      <span className="text-[11px] text-slate-500">Tính vào chỉ tiêu phát triển đoàn viên mới của Chi đoàn</span>
                    </div>
                    <button
                      type="button"
                      title="Đánh dấu / bỏ đánh dấu đoàn viên mới kết nạp trong năm (tính vào chỉ tiêu phát triển Đảng/Đoàn)"
                      onClick={async () => {
                        const newVal = !selectedMember.is_newly_admitted;
                        const res = await toggleMemberNewlyAdmitted(selectedMember.id, newVal);
                        if (res.success) {
                          setSelectedMember(prev => prev ? { ...prev, is_newly_admitted: newVal } : null);
                          showToast({
                            title: newVal ? 'Đã đánh dấu đoàn viên mới kết nạp' : 'Đã bỏ đánh dấu mới kết nạp',
                            type: 'success',
                          });
                        }
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        selectedMember.is_newly_admitted
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {selectedMember.is_newly_admitted ? '✓ Đang tính mới kết nạp' : '+ Đánh dấu mới kết nạp'}
                    </button>
                  </div>
                </div>

                {/* Bổ nhiệm vào Ban Chấp hành */}
                {(() => {
                  const currentCommittee = unitCommittees.find(
                    c => String(c.member_id) === String(selectedMember.id) && !c.term_end
                  );
                  return (
                    <div className="pt-2 border-t border-blue-100 flex items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-slate-800 block text-xs">Ban Chấp hành:</span>
                        <span className="text-[11px] text-slate-500">
                          {currentCommittee
                            ? currentCommittee.position === 'secretary'
                              ? 'Đang là Bí thư'
                              : currentCommittee.position === 'deputy_secretary'
                              ? 'Đang là Phó Bí thư'
                              : currentCommittee.is_standing
                              ? 'Đang là Ủy viên Thường vụ'
                              : 'Đang là Ủy viên BCH'
                            : 'Chưa tham gia Ban Chấp hành'}
                        </span>
                      </div>
                      <button title="Bổ nhiệm vào BCH"
                        type="button"
                        onClick={() => {
                          setAppointMember(selectedMember);
                          setAppointPosition(
                            currentCommittee?.position === 'secretary' ? 'secretary'
                            : currentCommittee?.position === 'deputy_secretary' ? 'deputy_secretary'
                            : 'committee_member'
                          );
                          setAppointIsStanding(currentCommittee?.is_standing ?? false);
                          setAppointTermStart(new Date().toISOString().slice(0, 10));
                          setAppointScope('unit');
                          setAppointError('');
                        }}
                        className="px-3 py-1 rounded-lg text-xs font-bold bg-blue-50 text-[#1F5FBF] border border-blue-200 hover:bg-blue-100"
                      >
                        Bổ nhiệm vào BCH
                      </button>
                    </div>
                  );
                })()}
              </div>

              {/* Nhóm 3: Học vấn - Chuyên môn */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-[#1F5FBF]">
                  3. Học vấn – Chuyên môn
                </h4>
                <div className="grid grid-cols-2 gap-2 text-slate-700">
                  <div>
                    <span className="text-slate-400 block">Trình độ học vấn:</span>
                    <span className="font-semibold">{selectedMember.education_grade}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Nghề nghiệp hiện tại:</span>
                    <span className="font-semibold">{selectedMember.current_job}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Chuyên môn đào tạo:</span>
                    <span className="font-semibold">{selectedMember.specialization || 'Chưa qua đào tạo nghề'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Trình độ LLCT:</span>
                    <span className="font-semibold capitalize">{selectedMember.political_theory_level}</span>
                  </div>
                </div>
              </div>

              {/* Nhóm 4: Tài khoản liên kết */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-[#1F5FBF]">
                  4. Tài khoản hệ thống
                </h4>
                {linkedProfile ? (
                  <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <div>
                      <p className="font-bold text-emerald-900">Đã liên kết tài khoản cán bộ</p>
                      <p className="text-[11px] text-emerald-700">{linkedProfile.email}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-200 text-emerald-800 uppercase">
                      {linkedProfile.role_id}
                    </span>
                  </div>
                ) : (
                  <div className="p-2.5 bg-slate-100 rounded-lg text-slate-500 italic">
                    Chưa liên kết tài khoản quản trị (tài khoản thường).
                  </div>
                )}
              </div>

              {/* Nhóm 5: Lịch sử chức vụ (từ unit_committees) */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-[#1F5FBF]">
                  5. Lịch sử chức danh Ban Chấp hành
                </h4>
                {memberCommittees.length === 0 ? (
                  <p className="text-slate-400 italic">Chưa từng tham gia Ban chấp hành.</p>
                ) : (
                  <div className="space-y-1.5">
                    {memberCommittees.map(comm => (
                      <div key={comm.id} className="p-2 bg-white rounded-lg border border-slate-200 flex justify-between">
                        <div>
                          <span className="font-bold text-slate-800 capitalize">
                            {comm.position === 'secretary' ? 'Bí thư' : comm.position === 'deputy_secretary' ? 'Phó Bí thư' : 'Ủy viên'}
                          </span>
                          <span className="text-[11px] text-slate-400 ml-2">({comm.unit_id ? getUnitById(comm.unit_id)?.name : 'BCH Đoàn xã'})</span>
                        </div>
                        <span className="text-slate-500 font-mono">
                          {comm.term_start} → {comm.term_end || 'Hiện tại'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Nhóm 6: Tham gia nhiệm vụ (từ task_registrations) */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-[#1F5FBF]">
                  6. Đăng ký tham gia nhiệm vụ
                </h4>
                {memberRegistrations.length === 0 ? (
                  <p className="text-slate-400 italic">Chưa có lịch sử đăng ký tham gia chiến dịch.</p>
                ) : (
                  <div className="space-y-1.5">
                    {memberRegistrations.map(({ reg, task }) => (
                      <div key={reg.id} className="p-2 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                        <span className="font-medium text-slate-800 truncate">{task?.title}</span>
                        {reg.is_joining ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 shrink-0">
                            Tham gia
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 shrink-0">
                            Từ chối
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL THÊM / SỬA ĐOÀN VIÊN */}
      {isMemberModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editingMemberId ? 'Chỉnh sửa Hồ sơ Đoàn viên' : 'Thêm mới Đoàn viên'}
              </h3>
              <button title="Đóng"
                type="button"
                onClick={() => setIsMemberModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMember} className="flex-1 overflow-y-auto p-5 text-xs space-y-3.5">
              <div>
                <label className="font-bold text-slate-800 block mb-1">Họ và tên (*):</label>
                <input
                  type="text"
                  value={formFullName}
                  onChange={e => setFormFullName(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-semibold focus:outline-none focus:border-[#1F5FBF]"
                  placeholder="Ví dụ: Nguyễn Văn An"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-800 block mb-1">Ngày sinh (*):</label>
                  <input
                    type="date"
                    value={formBirthDate}
                    onChange={e => setFormBirthDate(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1F5FBF]"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1">Giới tính:</label>
                  <select
                    value={formGender}
                    onChange={e => setFormGender(e.target.value as any)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-medium"
                  >
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-800 block mb-1">
                    Số điện thoại (*) (9-11 số):
                  </label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono focus:outline-none focus:border-[#1F5FBF]"
                    placeholder="0912345678"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1">
                    Ngày vào Đoàn (*):
                  </label>
                  <input
                    type="date"
                    value={formJoinedDate}
                    onChange={e => setFormJoinedDate(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1F5FBF]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-800 block mb-1">Thuộc Chi đoàn (*):</label>
                  <select
                    value={formUnitId}
                    onChange={e => setFormUnitId(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-medium"
                  >
                    {units.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1">Chức vụ Đoàn:</label>
                  <select
                    value={formPosition}
                    onChange={e => setFormPosition(e.target.value as any)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-medium text-[#1F5FBF]"
                  >
                    <option value="member">Đoàn viên</option>
                    <option value="deputy_secretary">Phó Bí thư Chi đoàn</option>
                    <option value="secretary">Bí thư Chi đoàn</option>
                  </select>
                </div>

                {editingMemberId && (
                  <div>
                    <label className="font-bold text-slate-800 block mb-1">Trạng thái sinh hoạt:</label>
                    <select
                      value={formIsActive ? 'active' : 'inactive'}
                      onChange={e => setFormIsActive(e.target.value === 'active')}
                      className={`w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-medium ${
                        formIsActive ? 'text-emerald-700' : 'text-slate-500'
                      }`}
                    >
                      <option value="active">Đang hoạt động</option>
                      <option value="inactive">Ngừng hoạt động / Chuyển sinh hoạt</option>
                    </select>
                    {!formIsActive && (
                      <p className="text-[10px] text-amber-700 mt-1">
                        Hồ sơ và lịch sử vẫn được giữ nguyên, chỉ ẩn khỏi danh sách mặc định.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-800 block mb-1">Nghề nghiệp:</label>
                  <input
                    type="text"
                    value={formJob}
                    onChange={e => setFormJob(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1">Trình độ học vấn:</label>
                  <input
                    type="text"
                    value={formEducation}
                    onChange={e => setFormEducation(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="space-y-2 p-3 bg-amber-50/50 rounded-lg border border-amber-200">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-900">
                    <input
                      type="checkbox"
                      checked={formIsElite}
                      onChange={e => {
                        setFormIsElite(e.target.checked);
                        if (e.target.checked && formPartyStatus === 'none') setFormPartyStatus('elite');
                      }}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span>Công nhận là Đoàn viên ưu tú</span>
                  </label>

                  {formIsElite && (
                    <input
                      type="date"
                      value={formEliteDate}
                      onChange={e => setFormEliteDate(e.target.value)}
                      className="p-1 text-xs bg-white border border-amber-300 rounded"
                      title="Ngày công nhận đoàn viên ưu tú"
                    />
                  )}
                </div>

                {formIsElite && (
                  <div>
                    <label className="text-[11px] font-bold text-amber-900 block mb-1">Giai đoạn phát triển Đảng:</label>
                    <select
                      value={formPartyStatus}
                      onChange={e => setFormPartyStatus(e.target.value as PartyTargetStatus)}
                      className="w-full p-1.5 bg-white border border-amber-300 rounded text-xs text-amber-900"
                    >
                      <option value="elite">Đoàn viên ưu tú (Mới công nhận)</option>
                      <option value="trained_class">Đã học lớp Bồi dưỡng nhận thức về Đảng (Cảm tình Đảng)</option>
                      <option value="introduced">Đã giới thiệu sang Chi bộ Đảng xem xét kết nạp</option>
                      <option value="admitted">Đã kết nạp Đảng</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 p-3 bg-red-50/50 rounded-lg border border-red-100">
                <input
                  type="checkbox"
                  id="chkParty"
                  checked={formIsParty}
                  onChange={e => {
                    setFormIsParty(e.target.checked);
                    if (e.target.checked) {
                      setFormIsElite(true);
                      setFormPartyStatus('admitted');
                    }
                  }}
                  className="rounded text-red-600 focus:ring-red-500"
                />
                <label htmlFor="chkParty" className="font-bold text-red-800 cursor-pointer">
                  Đã kết nạp Đảng viên Đảng Cộng sản Việt Nam
                </label>
              </div>

              <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 pt-3">
                <button title="Hủy"
                  type="button"
                  onClick={() => setIsMemberModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  title="Lưu thông tin hồ sơ đoàn viên"
                  className="px-5 py-2 font-bold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded-lg shadow-xs"
                >
                  {editingMemberId ? 'Cập nhật' : 'Thêm mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NHẬP TỪ EXCEL 4 BƯỚC */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Nhập danh sách Đoàn viên từ Excel</h3>
                <p className="text-xs text-slate-500">Bước {importStep}/4</p>
              </div>
              <button title="Đóng"
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Steps indicator */}
            <div className="grid grid-cols-4 bg-slate-100 text-center text-xs font-semibold border-b border-slate-200">
              <div className={`py-2 border-b-2 ${importStep >= 1 ? 'border-[#1F5FBF] text-[#1F5FBF] bg-white' : 'text-slate-400'}`}>
                1. Tải file mẫu
              </div>
              <div className={`py-2 border-b-2 ${importStep >= 2 ? 'border-[#1F5FBF] text-[#1F5FBF] bg-white' : 'text-slate-400'}`}>
                2. Ghép cột
              </div>
              <div className={`py-2 border-b-2 ${importStep >= 3 ? 'border-[#1F5FBF] text-[#1F5FBF] bg-white' : 'text-slate-400'}`}>
                3. Xem trước
              </div>
              <div className={`py-2 border-b-2 ${importStep >= 4 ? 'border-[#1F5FBF] text-[#1F5FBF] bg-white' : 'text-slate-400'}`}>
                4. Xác nhận
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 text-xs space-y-4">
              {importStep === 1 && (
                <div className="text-center space-y-4 py-6">
                  <FileSpreadsheet className="w-12 h-12 text-emerald-600 mx-auto" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Chọn file Excel danh sách đoàn viên</h4>
                    <p className="text-slate-500 max-w-md mx-auto mt-1">
                      Hệ thống tự động nhận diện file mẫu chuẩn hoặc file hành chính thực tế (hỗ trợ cả header gộp, cột năm sinh, tự nhận diện chi đoàn mới và chức vụ BTCĐ/phó BTCĐ).
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                    <button title="Tải file Excel mẫu chuẩn (.xlsx)"
                      type="button"
                      onClick={() => downloadMemberTemplate(units)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs"
                    >
                      <Download className="w-4 h-4 text-[#1F5FBF]" /> Tải file Excel mẫu chuẩn (.xlsx)
                    </button>

                    <input
                      ref={importFileRef}
                      type="file"
                      accept=".xlsx"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) handleImportFile(f);
                        e.target.value = '';
                      }}
                    />
                    <button title="Chọn file Excel tải lên"
                      type="button"
                      onClick={() => importFileRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 font-bold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded-lg cursor-pointer shadow-xs"
                    >
                      <Upload className="w-4 h-4" /> Chọn file Excel tải lên
                    </button>
                  </div>
                </div>
              )}

              {importStep === 2 && (
                <div className="space-y-4">
                  <div className="p-6 border-2 border-dashed border-blue-300 bg-blue-50/40 rounded-xl text-center space-y-2">
                    <Upload className="w-8 h-8 text-[#1F5FBF] mx-auto" />
                    <p className="font-bold text-slate-800">Đã đọc: {importFileName} ({parsedRows.length} dòng)</p>
                    <p className="text-slate-500">Hệ thống đã tự động nhận diện các cột.</p>
                  </div>
                </div>
              )}

              {importStep === 3 && importResult && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between pb-2 border-b border-slate-100 gap-2">
                    <span className="font-bold text-slate-900 text-xs">
                      Kết quả đối soát ({importResult.totalRows} dòng):{' '}
                      <span className="text-emerald-700 font-bold">{importResult.validCount} hợp lệ</span>,{' '}
                      <span className="text-amber-700 font-bold">{importResult.duplicateCount} trùng</span>,{' '}
                      <span className="text-rose-700 font-bold">{importResult.invalidCount} lỗi</span>
                    </span>
                  </div>

                  {importResult.newUnitsToCreate.length > 0 && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 space-y-1">
                      <p className="font-bold flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-[#1F5FBF]" />
                        Phát hiện {importResult.newUnitsToCreate.length} Chi đoàn mới (chưa có trong hệ thống):
                      </p>
                      <p className="text-[11px] text-blue-800">
                        {importResult.newUnitsToCreate.join(', ')}
                      </p>
                      <p className="text-[10px] text-blue-600 font-semibold italic">
                        → Hệ thống sẽ TỰ ĐỘNG TẠO MỚI các chi đoàn này khi bạn bấm xác nhận ở bước tiếp theo!
                      </p>
                    </div>
                  )}

                  {/* Thanh thao tác nhanh Checkbox & Thống kê chọn */}
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 select-none">
                        <input
                          type="checkbox"
                          checked={importResult.validCount > 0 && selectedRowNums.size === importResult.validCount}
                          onChange={e => {
                            if (e.target.checked) {
                              const validNums = new Set(importResult.rows.filter(r => r.isValid && !r.isDuplicate).map(r => r.rowNum));
                              setSelectedRowNums(validNums);
                            } else {
                              setSelectedRowNums(new Set());
                            }
                          }}
                          className="w-4 h-4 rounded text-[#1F5FBF] focus:ring-[#1F5FBF]"
                        />
                        <span>Chọn tất cả hợp lệ ({selectedRowNums.size}/{importResult.validCount})</span>
                      </label>

                      <button title="Bỏ chọn"
                        type="button"
                        onClick={() => setSelectedRowNums(new Set())}
                        className="text-slate-500 hover:text-slate-700 underline text-[11px]"
                      >
                        Bỏ chọn
                      </button>
                    </div>

                    {/* Phân trang */}
                    {Math.ceil(parsedRows.length / PREVIEW_PAGE_SIZE) > 1 && (
                      <div className="flex items-center gap-1.5 ml-auto">
                        <button title="&lt; Trước"
                          type="button"
                          disabled={previewPage <= 1}
                          onClick={() => setPreviewPage(p => Math.max(1, p - 1))}
                          className="px-2 py-1 bg-white border border-slate-300 rounded text-slate-600 disabled:opacity-40"
                        >
                          &lt; Trước
                        </button>
                        <span className="font-semibold text-slate-700 px-1 text-[11px]">
                          {previewPage} / {Math.ceil(parsedRows.length / PREVIEW_PAGE_SIZE)}
                        </span>
                        <button title="Sau &gt;"
                          type="button"
                          disabled={previewPage >= Math.ceil(parsedRows.length / PREVIEW_PAGE_SIZE)}
                          onClick={() => setPreviewPage(p => Math.min(Math.ceil(parsedRows.length / PREVIEW_PAGE_SIZE), p + 1))}
                          className="px-2 py-1 bg-white border border-slate-300 rounded text-slate-600 disabled:opacity-40"
                        >
                          Sau &gt;
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Danh sách dòng (được phân trang) */}
                  <div className="space-y-1.5">
                    {parsedRows
                      .slice((previewPage - 1) * PREVIEW_PAGE_SIZE, previewPage * PREVIEW_PAGE_SIZE)
                      .map(row => {
                        const isChecked = selectedRowNums.has(row.rowNum);
                        return (
                          <div
                            key={row.rowNum}
                            onClick={() => {
                              if (!row.isValid) return;
                              setSelectedRowNums(prev => {
                                const next = new Set(prev);
                                if (next.has(row.rowNum)) next.delete(row.rowNum);
                                else next.add(row.rowNum);
                                return next;
                              });
                            }}
                            className={`p-2.5 rounded-lg border flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                              !row.isValid
                                ? 'bg-rose-50/70 border-rose-200 text-rose-900 cursor-not-allowed opacity-80'
                                : isChecked
                                ? 'bg-blue-50/60 border-blue-300 text-slate-900'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                disabled={!row.isValid}
                                checked={isChecked}
                                onChange={e => {
                                  e.stopPropagation();
                                  if (!row.isValid) return;
                                  setSelectedRowNums(prev => {
                                    const next = new Set(prev);
                                    if (next.has(row.rowNum)) next.delete(row.rowNum);
                                    else next.add(row.rowNum);
                                    return next;
                                  });
                                }}
                                className="w-4 h-4 rounded text-[#1F5FBF] focus:ring-[#1F5FBF] shrink-0"
                              />
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 truncate">
                                  Dòng {row.rowNum}: {row.full_name}{' '}
                                  <span className="font-normal text-slate-500 text-[11px]">({row.unit_name})</span>
                                </p>
                                <p className="text-[11px] text-slate-500 truncate">
                                  {row.birth_date} • {row.current_position === 'secretary' ? 'Bí thư' : row.current_position === 'deputy_secretary' ? 'Phó Bí thư' : 'Đoàn viên'}
                                  {row.specialization ? ` • ${row.specialization}` : ''}
                                  {row.is_party_member ? ' • Đảng viên' : ''}
                                </p>
                                {row.error && <p className="font-bold text-[10px] text-rose-600 mt-0.5">{row.error}</p>}
                              </div>
                            </div>

                            <div className="shrink-0">
                              {!row.isValid ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-200 text-rose-800">
                                  Lỗi
                                </span>
                              ) : row.isDuplicate ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-800">
                                  Đã có
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-200 text-emerald-800">
                                  Hợp lệ
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {importStep === 4 && importResult && (
                <div className="text-center space-y-4 py-4">
                  <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-900">Sẵn sàng nhập dữ liệu</h4>
                  <p className="text-slate-600 max-w-md mx-auto">
                    Hệ thống sẽ nhập <b>{selectedRowNums.size} đoàn viên đã chọn</b> vào danh sách và tự động gán vào đúng chi đoàn tương ứng.
                  </p>
                  {importResult.newUnitsToCreate.length > 0 && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 max-w-md mx-auto text-left">
                      <span className="font-bold block">Tự động khởi tạo {importResult.newUnitsToCreate.length} Chi đoàn:</span>
                      <span className="text-[11px] block mt-0.5">{importResult.newUnitsToCreate.join(', ')}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between">
              {importStep > 1 && (
                <button title="Quay lại"
                  type="button"
                  onClick={() => setImportStep((importStep - 1) as any)}
                  className="px-3 py-1.5 font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg"
                >
                  Quay lại
                </button>
              )}
              <div className="ml-auto">
                {importStep < 4 ? (
                  <button title="Tiếp theo"
                    type="button"
                    onClick={() => setImportStep((importStep + 1) as any)}
                    className="px-4 py-2 font-bold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded-lg"
                  >
                    Tiếp theo
                  </button>
                ) : (
                  <button title="Đang xử lý"
                    type="button"
                    onClick={handleConfirmImport}
                    disabled={importing || selectedRowNums.size === 0}
                    className="inline-flex items-center gap-1.5 px-4 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {importing && <Loader2 className="w-4 h-4 animate-spin" />}
                    {importing ? 'Đang nhập dữ liệu…' : 'Xác nhận nhập vào hệ thống'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: TỪ CHỐI ĐOÀN VIÊN ĐĂNG KÝ (BẮT BUỘC NÊU LÝ DO) */}
      {rejectingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-rose-700 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" /> Từ chối hồ sơ đăng ký
              </h3>
              <button title="Đóng" type="button" onClick={() => setRejectingMember(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Đoàn viên: <strong>{rejectingMember.full_name}</strong> (Chi đoàn {getUnitById(rejectingMember.unit_id)?.name})
            </p>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Lý do từ chối (Bắt buộc để ghi nhật ký hệ thống): <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Ví dụ: Không phải đoàn viên đang sinh hoạt tại ấp 1 / Sai thông tin chi đoàn…"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-rose-500 resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button title="Hủy"
                type="button"
                onClick={() => setRejectingMember(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Hủy
              </button>
              <button title="Xác nhận từ chối & Xóa"
                type="button"
                disabled={!rejectReason.trim() || isReviewingReg}
                onClick={async () => {
                  setIsReviewingReg(true);
                  try {
                    const res = await reviewMemberRegistration({
                      memberId: rejectingMember.id,
                      action: 'reject',
                      rejectionReason: rejectReason.trim(),
                    });
                    if (res.success) {
                      showToast({ title: 'Đã từ chối và ghi nhật ký lý do', type: 'info' });
                      setRejectingMember(null);
                    } else {
                      showToast({ title: 'Có lỗi xảy ra', description: res.message, type: 'error' });
                    }
                  } finally {
                    setIsReviewingReg(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-60"
              >
                {isReviewingReg && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Xác nhận từ chối & Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BỔ NHIỆM VÀO BAN CHẤP HÀNH */}
      {appointMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Bổ nhiệm vào Ban Chấp hành</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {appointMember.full_name} · {getUnitById(appointMember.unit_id)?.name}
                </p>
              </div>
              <button title="Đóng" type="button" onClick={() => setAppointMember(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-800 block mb-1">Bổ nhiệm vào cấp bộ Đoàn:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button title="Chi đoàn"
                    type="button"
                    onClick={() => setAppointScope('unit')}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      appointScope === 'unit'
                        ? 'bg-blue-50 border-[#1F5FBF] text-[#1F5FBF] font-bold'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-[11px] block">Chi đoàn</span>
                    <span className="text-[10px] font-normal text-slate-500 block truncate">
                      {getUnitById(appointMember.unit_id)?.name || '—'}
                    </span>
                  </button>
                  <button title="BCH Đoàn xã Cấp cơ sở"
                    type="button"
                    onClick={() => setAppointScope('commune')}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      appointScope === 'commune'
                        ? 'bg-blue-50 border-[#1F5FBF] text-[#1F5FBF] font-bold'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-[11px] block">BCH Đoàn xã</span>
                    <span className="text-[10px] font-normal text-slate-500 block">Cấp cơ sở</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">Chức vụ trong BCH:</label>
                <select
                  value={appointPosition}
                  onChange={e => {
                    const p = e.target.value as 'secretary' | 'deputy_secretary' | 'committee_member';
                    setAppointPosition(p);
                    if (p !== 'committee_member') setAppointIsStanding(true);
                  }}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#1F5FBF]"
                >
                  <option value="committee_member">Ủy viên Ban Chấp hành</option>
                  <option value="deputy_secretary">Phó Bí thư</option>
                  <option value="secretary">Bí thư</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Mỗi chi đoàn chỉ có <b>01 Bí thư</b> đang giữ chức. Nếu đã có Bí thư, hãy kết thúc nhiệm kỳ người đó trước.
                </p>
              </div>

              <label className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={appointIsStanding}
                  disabled={appointPosition !== 'committee_member'}
                  onChange={e => setAppointIsStanding(e.target.checked)}
                  className="w-4 h-4 rounded text-[#1F5FBF]"
                />
                <span className="font-semibold text-slate-800">Là thành viên <b>Ban Thường vụ</b></span>
              </label>

              <div>
                <label className="font-bold text-slate-800 block mb-1">Ngày bắt đầu nhiệm kỳ:</label>
                <input
                  type="date"
                  value={appointTermStart}
                  onChange={e => setAppointTermStart(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#1F5FBF]"
                />
              </div>

              {appointError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-800">
                  {appointError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button title="Hủy"
                type="button"
                onClick={() => setAppointMember(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Hủy
              </button>
              <button title="Xác nhận bổ nhiệm"
                type="button"
                disabled={isAppointing}
                onClick={async () => {
                  setIsAppointing(true);
                  setAppointError('');
                  try {
                    const res = await addCommitteeMember(
                      appointMember.id,
                      appointScope === 'commune' ? null : appointMember.unit_id,
                      appointPosition,
                      appointIsStanding,
                      appointTermStart
                    );
                    if (res.success) {
                      showToast({ title: 'Đã bổ nhiệm vào Ban Chấp hành', type: 'success' });
                      setAppointMember(null);
                    } else {
                      setAppointError(res.message || 'Không bổ nhiệm được');
                    }
                  } finally {
                    setIsAppointing(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded-lg disabled:opacity-60"
              >
                {isAppointing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Xác nhận bổ nhiệm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
