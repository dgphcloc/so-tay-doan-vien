import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Avatar } from '../components/common/Avatar';
import {
  UserCheck,
  Shield,
  Phone,
  Calendar,
  Award,
  Plus,
  Building2,
  Filter,
  CheckCircle2,
  Clock,
  X,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  Download,
  Upload,
  FileSpreadsheet,
  Loader2,
  Edit2,
} from 'lucide-react';
import { CommitteePosition, UnitCommittee } from '../types';
import { formatDateVN } from '../mock/data';
import {
  exportCommitteeExcel,
  downloadCommitteeTemplate,
  parseCommitteeWorkbook,
  type CommitteeParseResult,
  type ParsedCommitteeRow,
} from '../utils/committeeExcel';

export const CommitteePage: React.FC = () => {
  const {
    unitCommittees,
    units,
    members,
    currentRole,
    addCommitteeMember,
    updateCommitteeMember,
    endCommitteeTerm,
    getUnitById,
    getMemberById,
    showToast,
  } = useApp();

  // Excel State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importResult, setImportResult] = useState<CommitteeParseResult | null>(null);
  const [importFileName, setImportFileName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bộ chọn đầu trang: "BCH Đoàn xã" (null) hoặc 1 Chi đoàn (unitId)
  const [selectedUnitScope, setSelectedUnitScope] = useState<string>('commune'); // 'commune' or unit.id

  // Bộ chọn nhiệm kỳ: "active" (đang giữ chức) hoặc "ended" (đã kết thúc) hoặc "all"
  const [termStatusFilter, setTermStatusFilter] = useState<'active' | 'ended' | 'all'>('active');

  // Modal "Thêm thành viên"
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalMemberId, setModalMemberId] = useState<string>('');
  const [modalPosition, setModalPosition] = useState<CommitteePosition>('member');
  const [modalIsStanding, setModalIsStanding] = useState<boolean>(false);
  const [modalTermStart, setModalTermStart] = useState<string>(new Date().toISOString().split('T')[0]);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Modal "Sửa chức vụ / tư cách thường vụ"
  const [editingCommittee, setEditingCommittee] = useState<UnitCommittee | null>(null);
  const [editPosition, setEditPosition] = useState<CommitteePosition>('committee_member');
  const [editIsStanding, setEditIsStanding] = useState(false);
  const [editError, setEditError] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const isStaff = currentRole === 'staff';

  const handleExport = () => {
    const scopeLabel = selectedUnitScope === 'commune' ? 'BCH Đoàn xã' : (currentUnit?.name || 'Chi đoàn');
    exportCommitteeExcel(filteredCommittees, members, units, scopeLabel);
    showToast({ title: 'Đã xuất file Excel Ban Chấp hành', type: 'success' });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const res = await parseCommitteeWorkbook(buf, members, units);
      setImportResult(res);
      setImportFileName(file.name);
      setIsImportModalOpen(true);
    } catch (err) {
      showToast({ title: 'Không đọc được file Excel', description: err instanceof Error ? err.message : '', type: 'error' });
    }
    e.target.value = '';
  };

  const handleConfirmImport = async () => {
    if (!importResult) return;
    const validRows = importResult.rows.filter(r => r.isValid && r.matchedMemberId);
    if (validRows.length === 0) {
      showToast({ title: 'Không có dòng hợp lệ để nạp', type: 'error' });
      return;
    }

    setIsImporting(true);
    let successCount = 0;
    try {
      for (const row of validRows) {
        if (!row.matchedMemberId) continue;
        const res = await addCommitteeMember(
          row.matchedMemberId,
          row.matchedUnitId || null,
          row.position,
          row.isStanding,
          row.termStart
        );
        if (res.success) successCount++;
      }
      showToast({
        title: 'Nạp danh sách BCH thành công!',
        description: `Đã bổ nhiệm thành công ${successCount} nhân sự Ban Chấp hành.`,
        type: 'success',
      });
      setIsImportModalOpen(false);
      setImportResult(null);
    } catch (err) {
      showToast({ title: 'Có lỗi trong quá trình bổ nhiệm', description: err instanceof Error ? err.message : '', type: 'error' });
    } finally {
      setIsImporting(false);
    }
  };

  const maskPhone = (phone: string) => {
    if (isStaff && phone.length >= 7) {
      return phone.substring(0, 3) + '******' + phone.substring(phone.length - 3);
    }
    return phone;
  };

  // Unit currently in view
  const currentUnit = useMemo(() => {
    if (selectedUnitScope === 'commune') return null;
    return units.find(u => u.id === selectedUnitScope) || null;
  }, [units, selectedUnitScope]);

  // Số đoàn viên thực tế đang hoạt động của từng chi đoàn
  const activeMemberCountByUnit = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of members) {
      if (!m.is_active) continue;
      map.set(m.unit_id, (map.get(m.unit_id) || 0) + 1);
    }
    return map;
  }, [members]);

  // Candidates for add member dropdown
  const candidateMembers = useMemo(() => {
    if (selectedUnitScope === 'commune') {
      return members.filter(m => m.is_active);
    }
    return members.filter(m => m.unit_id === selectedUnitScope && m.is_active);
  }, [members, selectedUnitScope]);

  // Set default candidate when candidate list updates
  React.useEffect(() => {
    if (candidateMembers.length > 0 && !modalMemberId) {
      setModalMemberId(candidateMembers[0].id);
    }
  }, [candidateMembers, modalMemberId]);

  // Automatically check standing committee for secretary / deputy_secretary
  React.useEffect(() => {
    if (modalPosition === 'secretary' || modalPosition === 'deputy_secretary') {
      setModalIsStanding(true);
    }
  }, [modalPosition]);

  // Filtered committees according to scope and term status
  const filteredCommittees = useMemo(() => {
    const targetUnitId = selectedUnitScope === 'commune' ? null : selectedUnitScope;

    return unitCommittees.filter(comm => {
      // Scope filter
      if (targetUnitId === null) {
        if (comm.unit_id !== null) return false;
      } else {
        if (comm.unit_id !== targetUnitId) return false;
      }

      // Term status filter
      if (termStatusFilter === 'active' && comm.term_end) return false;
      if (termStatusFilter === 'ended' && !comm.term_end) return false;

      return true;
    });
  }, [unitCommittees, selectedUnitScope, termStatusFilter]);

  // Sorted hierarchically: Bí thư -> Phó Bí thư -> Uỷ viên Thường vụ -> Uỷ viên BCH
  const sortedCommittees = useMemo(() => {
    const rankWeight = (c: UnitCommittee) => {
      if (c.position === 'secretary') return 1;
      if (c.position === 'deputy_secretary') return 2;
      if (c.is_standing) return 3;
      return 4;
    };

    return [...filteredCommittees].sort((a, b) => {
      const weightA = rankWeight(a);
      const weightB = rankWeight(b);
      if (weightA !== weightB) return weightA - weightB;
      return new Date(b.term_start).getTime() - new Date(a.term_start).getTime();
    });
  }, [filteredCommittees]);

  // Handle Add Member
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!modalMemberId) {
      setErrorMessage('Vui lòng chọn đoàn viên.');
      return;
    }

    const unitId = selectedUnitScope === 'commune' ? null : selectedUnitScope;
    const isStanding = modalPosition === 'secretary' || modalPosition === 'deputy_secretary' ? true : modalIsStanding;

    const res = await addCommitteeMember(modalMemberId, unitId, modalPosition, isStanding, modalTermStart);
    if (!res.success) {
      setErrorMessage(res.message || 'Không thể bổ nhiệm thành viên.');
      return;
    }

    setIsAddModalOpen(false);
    setModalPosition('member');
    setModalIsStanding(false);
  };

  // Handle End Term
  const handleEndTerm = (committeeId: string, memberName: string) => {
    if (confirm(`Bạn có chắc chắn muốn kết thúc nhiệm kỳ của đồng chí ${memberName}?`)) {
      endCommitteeTerm(committeeId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <UserCheck className="w-6 h-6 text-[#1F5FBF]" />
            Ban Chấp hành Đoàn – Nhiệm kỳ & Nhân sự
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            Quản trị nhân sự Ban Chấp hành Đoàn xã và cấp ủy các Chi đoàn trực thuộc
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button title="Xuất Excel"
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-500" /> Xuất Excel
          </button>

          {!isStaff && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={handleFileChange}
              />
              <button title="Nhập từ Excel"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs transition-all cursor-pointer"
              >
                <Upload className="w-4 h-4 text-[#1F5FBF]" /> Nhập từ Excel
              </button>

              <button title="Thêm thành viên BCH"
                type="button"
                onClick={() => {
                  setErrorMessage('');
                  setIsAddModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded-lg shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Thêm thành viên BCH
              </button>
            </>
          )}
        </div>
      </div>

      {/* BỘ CHỌN ĐẦU TRANG: BCH ĐOÀN XÃ HOẶC CHI ĐOÀN & NHIỆM KỲ */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Chọn đơn vị */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <label className="text-xs font-bold text-slate-700 whitespace-nowrap flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-[#1F5FBF]" /> Đơn vị quản lý:
          </label>
          <select
            value={selectedUnitScope}
            onChange={e => setSelectedUnitScope(e.target.value)}
            className="p-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#1F5FBF]"
          >
            <option value="commune">★ Ban Chấp hành Đoàn xã Hòa Bình (Cấp cơ sở)</option>
            <optgroup label="31 Chi đoàn trực thuộc">
              {units.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({activeMemberCountByUnit.get(u.id) || 0} đoàn viên)
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        {/* Chọn nhiệm kỳ: Đang giữ chức vs Đã kết thúc */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold self-start md:self-auto">
          <button title="Đang giữ chức"
            type="button"
            onClick={() => setTermStatusFilter('active')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              termStatusFilter === 'active'
                ? 'bg-white text-emerald-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Đang giữ chức
          </button>
          <button title="Đã kết thúc"
            type="button"
            onClick={() => setTermStatusFilter('ended')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              termStatusFilter === 'ended'
                ? 'bg-white text-slate-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Đã kết thúc
          </button>
          <button title="Tất cả"
            type="button"
            onClick={() => setTermStatusFilter('all')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              termStatusFilter === 'all'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tất cả
          </button>
        </div>
      </div>

      {/* THÔNG TIN TỔNG QUAN VỀ ĐƠN VỊ ĐANG CHỌN */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-800">
            {selectedUnitScope === 'commune' ? 'BCH Đoàn xã Hòa Bình' : currentUnit?.name}:
          </span>
          <span className="text-xs text-slate-500 font-medium">
            {sortedCommittees.length} đồng chí ({termStatusFilter === 'active' ? 'đang công tác' : 'trong danh sách'})
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600" /> Bí thư
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> Phó Bí thư
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Thường vụ
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> Ủy viên BCH
          </span>
        </div>
      </div>

      {/* HIỂN THỊ DẠNG THẺ THEO THỨ BẬC */}
      {sortedCommittees.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
          <UserCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700">Chưa có thành viên trong danh mục này</h3>
          <p className="text-xs text-slate-400 mt-1">
            Không tìm thấy thành viên nào phù hợp với phạm vi đơn vị và trạng thái nhiệm kỳ đã chọn.
          </p>
          <button title="+ Bổ nhiệm thành viên mới"
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="mt-4 px-4 py-2 text-xs font-bold text-[#1F5FBF] bg-blue-50 hover:bg-blue-100 rounded-lg cursor-pointer"
          >
            + Bổ nhiệm thành viên mới
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {sortedCommittees.map(comm => {
            const member = getMemberById(comm.member_id) || members.find(m => String(m.id) === String(comm.member_id));
            if (!member) return null;

            const isSec = comm.position === 'secretary';
            const isDeputy = comm.position === 'deputy_secretary';
            const isStanding = comm.is_standing;
            const isEnded = !!comm.term_end;

            // Border & badge style based on hierarchy
            const cardBadge = isSec
              ? { label: selectedUnitScope === 'commune' ? 'Bí thư Đoàn xã' : 'Bí thư Chi đoàn', color: 'bg-blue-100 text-[#1F5FBF] border-blue-200' }
              : isDeputy
              ? { label: selectedUnitScope === 'commune' ? 'Phó Bí thư Đoàn xã' : 'Phó Bí thư Chi đoàn', color: 'bg-sky-100 text-sky-800 border-sky-200' }
              : isStanding
              ? { label: 'Ủy viên Thường vụ', color: 'bg-amber-100 text-amber-800 border-amber-200' }
              : { label: 'Ủy viên Ban Chấp hành', color: 'bg-slate-100 text-slate-700 border-slate-200' };

            return (
              <div
                key={comm.id}
                className={`bg-white rounded-xl border p-5 shadow-xs flex flex-col items-center text-center space-y-3 relative overflow-hidden transition-all hover:shadow-md ${
                  isSec
                    ? 'border-blue-400 ring-1 ring-blue-200'
                    : isDeputy
                    ? 'border-sky-300'
                    : 'border-slate-200/90'
                } ${isEnded ? 'opacity-70 bg-slate-50/50' : ''}`}
              >
                {/* Status / Standing Badge */}
                <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
                  {isEnded ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-600">
                      Đã kết thúc
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      Đang giữ chức
                    </span>
                  )}
                </div>

                <div className="relative mt-1">
                  <Avatar
                    src={member.avatar_url}
                    name={member.full_name}
                    seed={member.id}
                    size={64}
                    className={`shadow-xs ${
                      isSec ? 'ring-2 ring-blue-600' : isDeputy ? 'ring-2 ring-sky-500' : 'ring-2 ring-slate-300'
                    }`}
                  />
                  {isStanding && (
                    <span
                      className="absolute -bottom-1 -right-1 p-1 bg-amber-500 text-white rounded-full shadow-xs"
                      title="Uỷ viên Thường vụ"
                    >
                      <Award className="w-3 h-3" />
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900">{member.full_name}</h3>
                  <span
                    className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${cardBadge.color}`}
                  >
                    {cardBadge.label}
                  </span>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{member.note || member.current_job}</p>
                </div>

                <div className="w-full pt-3 border-t border-slate-100 text-xs space-y-1.5 text-left text-slate-600">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Nhiệm kỳ:</span>
                    <span className="font-mono font-medium text-slate-800 text-[11px]">
                      {formatDateVN(comm.term_start)} → {comm.term_end ? formatDateVN(comm.term_end) : 'Nay'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Điện thoại:</span>
                    <span className="font-mono font-medium text-slate-800">{maskPhone(member.phone)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Đảng viên:</span>
                    <span className="font-semibold text-slate-800">
                      {member.is_party_member ? 'Đảng viên' : 'Chưa'}
                    </span>
                  </div>
                </div>

                {/* Nút Sửa chức vụ + Kết thúc nhiệm kỳ */}
                {!isEnded && (
                  <div className="w-full pt-2 flex gap-1.5">
                    <button title="Sửa"
                      type="button"
                      onClick={() => {
                        setEditingCommittee(comm);
                        setEditPosition(comm.position);
                        setEditIsStanding(comm.is_standing);
                        setEditError('');
                      }}
                      className="flex-1 py-1.5 text-xs font-semibold text-[#1F5FBF] hover:bg-blue-50 rounded-lg border border-blue-200 transition-colors cursor-pointer inline-flex items-center justify-center gap-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Sửa
                    </button>
                    <button title="Kết thúc nhiệm kỳ"
                      type="button"
                      onClick={() => handleEndTerm(comm.id, member.full_name)}
                      className="flex-1 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                    >
                      Kết thúc nhiệm kỳ
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* IMPORT EXCEL MODAL */}
      {isImportModalOpen && importResult && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden text-xs">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                  Đối soát danh sách Ban Chấp hành ({importFileName})
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Tổng: <b>{importResult.totalRows}</b> nhân sự • <span className="text-emerald-700 font-bold">{importResult.validCount} hợp lệ</span> • <span className="text-rose-600 font-bold">{importResult.invalidCount} lỗi / chưa có hồ sơ</span>
                </p>
              </div>
              <button title="Đóng"
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-blue-50/70 border-b border-blue-100 flex items-center justify-between gap-2">
              <span className="text-blue-900 text-[11px]">
                Lưu ý: Nhân sự bổ nhiệm vào BCH bắt buộc phải đã có hồ sơ trong danh sách đoàn viên.
              </span>
              <button title="Tải file mẫu chuẩn"
                type="button"
                onClick={() => downloadCommitteeTemplate(units)}
                className="px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md shrink-0 flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5 text-[#1F5FBF]" /> Tải file mẫu chuẩn
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[55vh]">
              {importResult.rows.map((row: ParsedCommitteeRow) => (
                <div
                  key={row.rowNum}
                  className={`p-2.5 rounded-lg border flex items-center justify-between gap-3 ${
                    !row.isValid ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50/50 border-emerald-200'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">
                      Dòng {row.rowNum}: {row.memberName}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Cấp bộ: <b>{row.scopeUnitName}</b> • Chức vụ: <b>{row.positionLabel}</b> {row.isStanding ? '(BTV)' : ''} • Bắt đầu: {row.termStart}
                    </p>
                    {row.error && <p className="text-[10px] font-bold text-rose-600 mt-0.5">{row.error}</p>}
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                    !row.isValid ? 'bg-rose-200 text-rose-800' : 'bg-emerald-200 text-emerald-800'
                  }`}>
                    {!row.isValid ? 'Chưa hợp lệ' : 'Sẵn sàng bổ nhiệm'}
                  </span>
                </div>
              ))}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-slate-500 text-[11px]">
                Sẵn sàng nạp {importResult.validCount} nhân sự hợp lệ
              </span>
              <div className="flex items-center gap-2">
                <button title="Hủy"
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-3 py-1.5 font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg"
                >
                  Hủy
                </button>
                <button title="Đang xử lý"
                  type="button"
                  disabled={isImporting || importResult.validCount === 0}
                  onClick={handleConfirmImport}
                  className="px-4 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isImporting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isImporting ? 'Đang nạp…' : 'Xác nhận bổ nhiệm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: THÊM THÀNH VIÊN BAN CHẤP HÀNH */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#1F5FBF]" />
                Bổ nhiệm Thành viên Ban Chấp hành
              </h3>
              <button title="Đóng"
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Thông báo lỗi ràng buộc nếu có */}
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="font-medium">{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-3.5">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Cơ quan / Đơn vị tiếp nhận:</label>
                <input
                  type="text"
                  disabled
                  value={selectedUnitScope === 'commune' ? 'Ban Chấp hành Đoàn xã Hòa Bình' : currentUnit?.name || ''}
                  className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-lg font-semibold text-slate-700 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Chọn Đoàn viên bổ nhiệm (*):</label>
                <select
                  value={modalMemberId}
                  onChange={e => setModalMemberId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-[#1F5FBF]"
                >
                  {candidateMembers.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.full_name} – SĐT: {m.phone} ({m.is_party_member ? 'Đảng viên' : 'Đoàn viên'})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Chỉ hiển thị các đoàn viên đang hoạt động thuộc thẩm quyền quản lý của đơn vị.
                </p>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Chức vụ bổ nhiệm (*):</label>
                <select
                  value={modalPosition}
                  onChange={e => setModalPosition(e.target.value as CommitteePosition)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-[#1F5FBF] focus:outline-none focus:border-[#1F5FBF]"
                >
                  <option value="secretary">Bí thư</option>
                  <option value="deputy_secretary">Phó Bí thư</option>
                  <option value="member">Ủy viên Ban Chấp hành</option>
                </select>
              </div>

              {/* Tích Thường vụ */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="standingCheck"
                    checked={modalPosition === 'secretary' || modalPosition === 'deputy_secretary' ? true : modalIsStanding}
                    disabled={modalPosition === 'secretary' || modalPosition === 'deputy_secretary'}
                    onChange={e => setModalIsStanding(e.target.checked)}
                    className="w-4 h-4 text-[#1F5FBF] rounded"
                  />
                  <label htmlFor="standingCheck" className="font-bold text-slate-800 cursor-pointer">
                    Ủy viên Ban Thường vụ
                  </label>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 ml-6">
                  {modalPosition === 'secretary' || modalPosition === 'deputy_secretary'
                    ? 'Bí thư và Phó Bí thư tự động tham gia Ban Thường vụ theo quy chế Đoàn.'
                    : 'Tích chọn nếu đồng chí được bầu bổ sung vào Ban Thường vụ.'}
                </p>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Ngày bắt đầu nhiệm kỳ (*):</label>
                <input
                  type="date"
                  value={modalTermStart}
                  onChange={e => setModalTermStart(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#1F5FBF]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button title="Hủy"
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Hủy
                </button>
                <button title="Xác nhận bổ nhiệm"
                  type="submit"
                  className="px-5 py-2 font-bold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded-lg cursor-pointer shadow-xs"
                >
                  Xác nhận bổ nhiệm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SỬA CHỨC VỤ / TƯ CÁCH THƯỜNG VỤ */}
      {editingCommittee && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-slate-200 text-xs">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Sửa chức vụ Ban Chấp hành</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {getMemberById(editingCommittee.member_id)?.full_name} ·{' '}
                  {editingCommittee.unit_id ? getUnitById(editingCommittee.unit_id)?.name : 'BCH Đoàn xã'}
                </p>
              </div>
              <button title="Đóng" type="button" onClick={() => setEditingCommittee(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="font-bold text-slate-800 block mb-1">Chức vụ:</label>
                <select
                  value={editPosition}
                  onChange={e => {
                    const p = e.target.value as CommitteePosition;
                    setEditPosition(p);
                    if (p === 'secretary' || p === 'deputy_secretary') setEditIsStanding(true);
                  }}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#1F5FBF]"
                >
                  <option value="secretary">Bí thư</option>
                  <option value="deputy_secretary">Phó Bí thư</option>
                  <option value="committee_member">Ủy viên Ban Chấp hành</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Mỗi chi đoàn chỉ được có <b>01 Bí thư</b> đang giữ chức; Phó Bí thư và Ủy viên thì không giới hạn.
                </p>
              </div>

              <label className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={editIsStanding}
                  disabled={editPosition === 'secretary' || editPosition === 'deputy_secretary'}
                  onChange={e => setEditIsStanding(e.target.checked)}
                  className="w-4 h-4 rounded text-[#1F5FBF]"
                />
                <span className="font-semibold text-slate-800">
                  Là thành viên <b>Ban Thường vụ</b>
                </span>
                {(editPosition === 'secretary' || editPosition === 'deputy_secretary') && (
                  <span className="text-[10px] text-slate-500 ml-auto">(Bí thư/Phó Bí thư mặc định thuộc BTV)</span>
                )}
              </label>

              {editError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-800">
                  {editError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button title="Hủy"
                type="button"
                onClick={() => setEditingCommittee(null)}
                className="px-4 py-2 font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Hủy
              </button>
              <button title="Lưu thay đổi"
                type="button"
                disabled={isSavingEdit}
                onClick={async () => {
                  setIsSavingEdit(true);
                  setEditError('');
                  try {
                    const res = await updateCommitteeMember({
                      committeeId: editingCommittee.id,
                      position: editPosition,
                      isStanding: editIsStanding,
                    });
                    if (res.success) {
                      showToast({ title: 'Đã cập nhật chức vụ', type: 'success' });
                      setEditingCommittee(null);
                    } else {
                      setEditError(res.message || 'Không lưu được');
                    }
                  } finally {
                    setIsSavingEdit(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 font-bold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded-lg disabled:opacity-60"
              >
                {isSavingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
