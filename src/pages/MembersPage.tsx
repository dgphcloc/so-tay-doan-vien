import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
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
} from 'lucide-react';
import { Member, Gender, CurrentPosition, PoliticalTheoryLevel } from '../types';
import { formatDateVN } from '../mock/data';
import { removeVietnameseTones, calculateAge, isMemberMatured } from '../utils/vietnamese';
import { exportExcel } from '../utils/exportExcel';

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
    createMember,
    updateMember,
    deleteMember,
    bulkImportMembers,
    getUnitById,
    getTaskById,
    showToast,
  } = useApp();

  // Search & Filter
  const [search, setSearch] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('all');
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');
  const [positionFilter, setPositionFilter] = useState<'all' | 'secretary' | 'deputy_secretary' | 'member'>('all');
  const [partyFilter, setPartyFilter] = useState<'all' | 'party' | 'non_party'>('all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [maturedFilter, setMaturedFilter] = useState<'all' | 'matured' | 'unmatured'>('all');
  const [ageMin, setAgeMin] = useState<string>('');
  const [ageMax, setAgeMax] = useState<string>('');

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
  const [formEducation, setFormEducation] = useState('12/12');
  const [formSpecialization, setFormSpecialization] = useState('Nông nghiệp sạch');
  const [formTheory, setFormTheory] = useState<PoliticalTheoryLevel>('other');
  const [formReligion, setFormReligion] = useState('Không');
  const [formIsParty, setFormIsParty] = useState(false);
  const [formEthnicityId, setFormEthnicityId] = useState('kinh');
  const [formJob, setFormJob] = useState('Lao động tự do');

  // Excel Import Wizard 4 Steps
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importStep, setImportStep] = useState<1 | 2 | 3 | 4>(1);
  const [parsedRows, setParsedRows] = useState<Array<{
    rowNum: number; full_name: string; birth_date: string; phone: string;
    joined_date: string; unit_name: string; gender: 'male' | 'female' | 'other';
    isValid: boolean; isDuplicate: boolean; error: string;
  }>>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  const isStaff = currentRole === 'staff';

  // Đọc file Excel đoàn viên -> parsedRows
  const handleImportFile = async (file: File) => {
    try {
      const { parseMembersWorkbook } = await import('../utils/membersImport');
      const buf = await file.arrayBuffer();
      const rows = await parseMembersWorkbook(buf, units, members);
      setParsedRows(rows);
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
    setFormEducation('12/12');
    setFormSpecialization('Trồng trọt công nghệ cao');
    setFormTheory('other');
    setFormReligion('Không');
    setFormIsParty(false);
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
    setFormEducation(member.education_grade);
    setFormSpecialization(member.specialization || '');
    setFormTheory(member.political_theory_level);
    setFormReligion(member.religion);
    setFormIsParty(member.is_party_member);
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

    if (editingMemberId) {
      await updateMember(editingMemberId, {
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
        religion: formReligion,
        is_party_member: formIsParty,
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
        ethnicity_id: formEthnicityId,
        avatar_url: `https://i.pravatar.cc/80?u=mem_${Date.now()}`,
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
    const validRows = parsedRows.filter(r => r.isValid && !r.isDuplicate);
    const newMembersToImport = validRows.map(r => ({
      full_name: r.full_name,
      birth_date: r.birth_date,
      gender: r.gender,
      phone: r.phone,
      joined_date: r.joined_date,
      unit_id: units.find(u => u.name === r.unit_name)?.id ?? units[0].id,
      current_position: 'member' as const,
      education_grade: '12/12',
      political_theory_level: 'other' as const,
      is_active: true,
      religion: 'Không',
      is_party_member: false,
      ethnicity_id: 'kinh',
      avatar_url: `https://i.pravatar.cc/80?u=import_${Math.random()}`,
      current_job: 'Thanh niên nông thôn',
      central_member_code: '',
    }));

    if (newMembersToImport.length === 0) {
      showToast({ title: 'Không có dòng hợp lệ để nhập', type: 'error' });
      return;
    }
    setImporting(true);
    const count = await bulkImportMembers(newMembersToImport);
    setImporting(false);
    showToast({ title: `Đã nhập ${count} đoàn viên`, type: 'success' });
    setIsImportModalOpen(false);
    setImportStep(1);
    setParsedRows([]);
    setImportFileName('');
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
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-500" /> Xuất Excel ({filteredMembers.length})
          </button>

          <button
            type="button"
            onClick={() => {
              setImportStep(1);
              setIsImportModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#1F5FBF] bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4" /> Nhập từ Excel
          </button>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded-lg shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Thêm đoàn viên
          </button>
        </div>
      </div>

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
                filteredMembers.slice(0, 30).map(member => {
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
                          <img src={member.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                          <div>
                            <span className="hover:text-[#1F5FBF] transition-colors">{member.full_name}</span>
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
                            onClick={() => deleteMember(member.id)}
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
      </div>

      {/* HỒ SƠ ĐOÀN VIÊN CHI TIẾT (DRAWER TRƯỢT TỪ PHẢI) */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-xl h-full bg-white shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-start justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <img
                  src={selectedMember.avatar_url}
                  alt=""
                  className="w-12 h-12 rounded-full object-cover border-2 border-blue-400 shadow-xs"
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

              <button
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
                </div>
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
              <button
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

              <div className="flex items-center gap-2 p-3 bg-red-50/50 rounded-lg border border-red-100">
                <input
                  type="checkbox"
                  id="chkParty"
                  checked={formIsParty}
                  onChange={e => setFormIsParty(e.target.checked)}
                  className="rounded text-red-600 focus:ring-red-500"
                />
                <label htmlFor="chkParty" className="font-bold text-red-800 cursor-pointer">
                  Đã kết nạp Đảng viên Đảng Cộng sản Việt Nam
                </label>
              </div>

              <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsMemberModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
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
              <button
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
                    <p className="text-slate-500 max-w-sm mx-auto mt-1">
                      File có các cột: Họ tên, Ngày sinh, Giới tính, SĐT, Ngày vào Đoàn, Chi đoàn.
                      Cột có thể theo tên tiêu đề (không phân biệt dấu) hoặc theo đúng thứ tự này.
                    </p>
                  </div>
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
                  <button
                    type="button"
                    onClick={() => importFileRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 font-bold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded-lg cursor-pointer"
                  >
                    <Upload className="w-4 h-4" /> Chọn file Excel (.xlsx)
                  </button>
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

              {importStep === 3 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="font-bold text-slate-900">
                      Xem trước kết quả đối soát: <span className="text-emerald-600 font-bold">2 hợp lệ</span>,{' '}
                      <span className="text-amber-600 font-bold">1 trùng</span>,{' '}
                      <span className="text-rose-600 font-bold">2 lỗi</span>
                    </span>
                  </div>

                  <div className="space-y-2">
                    {parsedRows.map(row => (
                      <div
                        key={row.rowNum}
                        className={`p-2.5 rounded-lg border flex items-center justify-between ${
                          !row.isValid
                            ? 'bg-rose-50 border-rose-200 text-rose-900'
                            : row.isDuplicate
                            ? 'bg-amber-50 border-amber-200 text-amber-900'
                            : 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                        }`}
                      >
                        <div>
                          <span className="font-bold">
                            Dòng {row.rowNum}: {row.full_name}
                          </span>
                          <span className="text-[11px] block text-slate-500">
                            {row.birth_date} • {row.phone} • {row.unit_name}
                          </span>
                          {row.error && <span className="font-bold text-[10px] block mt-0.5">{row.error}</span>}
                        </div>

                        <div>
                          {!row.isValid ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-200 text-rose-800">
                              Lỗi cú pháp
                            </span>
                          ) : row.isDuplicate ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-800">
                              Trùng SĐT
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-200 text-emerald-800">
                              Hợp lệ
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {importStep === 4 && (
                <div className="text-center space-y-4 py-4">
                  <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-900">Sẵn sàng nhập dữ liệu</h4>
                  <p className="text-slate-600 max-w-sm mx-auto">
                    Hệ thống sẽ nhập <b>2 đoàn viên hợp lệ</b> vào danh sách và bỏ qua các dòng lỗi / dòng trùng.
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between">
              {importStep > 1 && (
                <button
                  type="button"
                  onClick={() => setImportStep((importStep - 1) as any)}
                  className="px-3 py-1.5 font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg"
                >
                  Quay lại
                </button>
              )}
              <div className="ml-auto">
                {importStep < 4 ? (
                  <button
                    type="button"
                    onClick={() => setImportStep((importStep + 1) as any)}
                    className="px-4 py-2 font-bold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded-lg"
                  >
                    Tiếp theo
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    className="px-4 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                  >
                    Xác nhận nhập vào hệ thống
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
