import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Building2,
  Search,
  Filter,
  Users,
  ShieldCheck,
  ShieldAlert,
  ChevronRight,
  X,
  Phone,
  UserCheck,
  AlertTriangle,
  Award,
  CheckSquare,
  AlertCircle,
  Edit2,
  PowerOff,
  Save,
  Check,
  Plus,
  Trash2,
} from 'lucide-react';
import { Unit, UnitTypeId } from '../types';
import { formatDateVN } from '../mock/data';
import { ReviewStatusBadge } from '../components/common/StatusBadge';
import { canManageUnits } from '../utils/permissions';

export const UnitsPage: React.FC = () => {
  const {
    units,
    members,
    unitCommittees,
    warnings,
    tasks,
    taskUnits,
    taskResults,
    subCriteria,
    criterionSubmissions,
    currentRole,
    currentMember,
    updateUnit,
    deactivateUnit,
    createUnit,
    deleteUnit,
    calculateUnitScores,
    showToast,
  } = useApp();

  const isStaff = currentRole === 'staff';
  const isUnitSecretary = currentRole === 'unit_secretary';
  const myUnitId = currentMember?.unit_id ?? null;
  const canManage = canManageUnits(currentRole);
  // Điểm thi đua: bí thư chi đoàn và bí thư xã/staff xem được; đoàn viên không
  const canViewScores = currentRole !== 'member';
  const [showScoreFormula, setShowScoreFormula] = useState(false);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<UnitTypeId | 'all'>('all');
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [detailTab, setDetailTab] = useState<'info' | 'members' | 'committee' | 'tasks' | 'scores'>('info');

  // Deactivate confirm modal
  const [isDeactivateConfirmOpen, setIsDeactivateConfirmOpen] = useState(false);
  // Create unit modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitType, setNewUnitType] = useState<UnitTypeId>('residential');
  const [newUnitNote, setNewUnitNote] = useState('');
  const [newUnitDeclared, setNewUnitDeclared] = useState<number>(0);
  const [newUnitYouth, setNewUnitYouth] = useState<number>(0);
  const [creating, setCreating] = useState(false);
  // Delete confirm modal
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form edit unit info
  const [editName, setEditName] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editDeclaredCount, setEditDeclaredCount] = useState<number>(0);
  const [editYouthCount, setEditYouthCount] = useState<number>(0);

  // Synchronize edit form when selectedUnit changes
  React.useEffect(() => {
    if (selectedUnit) {
      setEditName(selectedUnit.name);
      setEditNote(selectedUnit.note || '');
      setEditDeclaredCount(selectedUnit.union_member_count);
      setEditYouthCount(selectedUnit.youth_count);
      setDetailTab('info');
    }
  }, [selectedUnit]);

  // Compute full table rows
  const unitRows = useMemo(() => {
    return units.map(unit => {
      // Bí thư hiện tại: ưu tiên unit_committees (term_end === null),
      // dự phòng members.current_position === 'secretary' (giống listUnits trong repository)
      const currentSecComm = unitCommittees.find(
        c => c.unit_id === unit.id && c.position === 'secretary' && !c.term_end
      );
      const currentSecMember =
        (currentSecComm ? members.find(m => m.id === currentSecComm.member_id) : null)
        ?? members.find(m => m.unit_id === unit.id && m.current_position === 'secretary' && m.is_active)
        ?? null;

      // Đoàn viên thực tế trong DB
      const actualMembersCount = members.filter(m => m.unit_id === unit.id).length;
      const declaredCount = unit.union_member_count;
      const isMismatch = declaredCount !== actualMembersCount;

      // Số cảnh báo đang mở
      const openWarningCount = warnings.filter(w => w.unit_id === unit.id && !w.resolved_at).length;

      return {
        unit,
        secretary: currentSecMember,
        isVacantSecretary: !currentSecMember,
        declaredCount,
        actualMembersCount,
        isMismatch,
        openWarningCount,
      };
    });
  }, [units, unitCommittees, members, warnings]);

  // Filter unit rows
  const filteredRows = useMemo(() => {
    return unitRows.filter(row => {
      // Bí thư chi đoàn: chỉ thấy chi đoàn của mình
      // Bí thư chi đoàn xem được danh sách và điểm của mọi chi đoàn (yêu cầu nghiệp vụ).
      if (typeFilter !== 'all' && row.unit.unit_type_id !== typeFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          row.unit.name.toLowerCase().includes(q) ||
          (row.unit.note && row.unit.note.toLowerCase().includes(q)) ||
          (row.secretary && row.secretary.full_name.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [unitRows, typeFilter, search, isUnitSecretary, myUnitId]);

  // Selected Unit sub-data
  const actualMembersOfSelected = useMemo(() => {
    if (!selectedUnit) return [];
    return members.filter(m => m.unit_id === selectedUnit.id);
  }, [selectedUnit, members]);

  const committeeOfSelected = useMemo(() => {
    if (!selectedUnit) return [];
    return unitCommittees
      .filter(c => c.unit_id === selectedUnit.id)
      .map(comm => {
        const member = members.find(m => m.id === comm.member_id);
        return { comm, member };
      });
  }, [selectedUnit, unitCommittees, members]);

  const tasksOfSelected = useMemo(() => {
    if (!selectedUnit) return [];
    const assignedTaskIds = taskUnits.filter(tu => tu.unit_id === selectedUnit.id).map(tu => tu.task_id);
    return tasks.filter(t => assignedTaskIds.includes(t.id)).map(task => {
      const result = taskResults.find(r => r.task_id === task.id && r.unit_id === selectedUnit.id);
      return { task, result };
    });
  }, [selectedUnit, taskUnits, tasks, taskResults]);

  const scoresOfSelected = useMemo(() => {
    if (!selectedUnit) return { totalScore: 0, taskCount: 0, taskAssignedCount: 0, participantCount: 0, criteriaScore: 0, completionRate: 0 };
    const allScores = calculateUnitScores();
    const found = allScores.find(s => s.unit.id === selectedUnit.id);
    return {
      totalScore: found?.totalScore || 0,
      taskCount: found?.taskCount || 0,
      taskAssignedCount: found?.taskAssignedCount || 0,
      completionRate: found?.completionRate || 0,
      participantCount: found?.participantCount || 0,
      criteriaScore: found?.criteriaScore || 0,
    };
  }, [selectedUnit, calculateUnitScores]);

  // Handle Save Info
  const handleSaveInfo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnit) return;

    updateUnit(selectedUnit.id, {
      name: editName,
      note: editNote,
      union_member_count: Number(editDeclaredCount),
      youth_count: Number(editYouthCount),
    });

    setSelectedUnit(prev =>
      prev
        ? {
            ...prev,
            name: editName,
            note: editNote,
            union_member_count: Number(editDeclaredCount),
            youth_count: Number(editYouthCount),
          }
        : null
    );
  };

  // Handle Deactivate Unit
  const handleConfirmDeactivate = async () => {
    if (!selectedUnit) return;
    const res = await deactivateUnit(selectedUnit.id);
    setIsDeactivateConfirmOpen(false);
    if (res.success) {
      setSelectedUnit(prev => (prev ? { ...prev, is_active: false } : null));
      showToast({ title: 'Đã ngừng hoạt động chi đoàn', description: selectedUnit.name, type: 'success' });
    } else {
      showToast({ title: 'Không thể ngừng hoạt động', description: res.message || 'Vui lòng thử lại', type: 'error' });
    }
  };

  // Handle Create Unit
  const handleCreateUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnitName.trim()) {
      showToast({ title: 'Vui lòng nhập tên chi đoàn', type: 'error' });
      return;
    }
    setCreating(true);
    const res = await createUnit({
      name: newUnitName.trim(),
      unit_type_id: newUnitType,
      note: newUnitNote.trim() || undefined,
      union_member_count: Number(newUnitDeclared) || 0,
      youth_count: Number(newUnitYouth) || 0,
    });
    setCreating(false);
    if (res.success) {
      showToast({ title: 'Đã thêm chi đoàn', description: newUnitName.trim(), type: 'success' });
      setIsCreateOpen(false);
      setNewUnitName('');
      setNewUnitNote('');
      setNewUnitDeclared(0);
      setNewUnitYouth(0);
      setNewUnitType('residential');
    } else {
      showToast({ title: 'Không thể thêm chi đoàn', description: res.message || 'Vui lòng thử lại', type: 'error' });
    }
  };

  // Handle Delete Unit
  const handleConfirmDelete = async () => {
    if (!selectedUnit) return;
    setDeleting(true);
    const res = await deleteUnit(selectedUnit.id);
    setDeleting(false);
    setIsDeleteConfirmOpen(false);
    if (res.success) {
      showToast({ title: 'Đã xóa chi đoàn', description: selectedUnit.name, type: 'success' });
      setSelectedUnit(null);
    } else {
      showToast({ title: 'Không thể xóa chi đoàn', description: res.message || 'Vui lòng thử lại', type: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Building2 className="w-6 h-6 text-[#1F5FBF]" />
            Quản lý Tổ chức Chi đoàn Cơ sở ({units.length} Chi đoàn)
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            Theo dõi tổ chức bộ máy, quân số đoàn viên thực tế và cảnh báo khuyết nhân sự Bí thư
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs md:text-sm font-bold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded-lg cursor-pointer shadow-xs shrink-0"
          >
            <Plus className="w-4 h-4" /> Thêm chi đoàn
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full md:w-auto">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm theo tên chi đoàn, địa bàn, tên bí thư..."
            className="w-full pl-9 pr-4 py-2 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1F5FBF]"
          />
        </div>

        {!isUnitSecretary && (
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto text-xs">
          {(['all', 'residential', 'school', 'health', 'police'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 font-semibold rounded-lg transition-colors cursor-pointer shrink-0 ${
                typeFilter === t ? 'bg-[#1F5FBF] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t === 'all'
                ? 'Tất cả'
                : t === 'residential'
                ? 'Dân cư (25)'
                : t === 'school'
                ? 'Trường học (3)'
                : t === 'health'
                ? 'Y tế (2)'
                : 'Công an (1)'}
            </button>
          ))}
        </div>
        )}
      </div>

      {/* Danh sách Chi đoàn dạng Bảng */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 uppercase font-bold border-b border-slate-200">
              <tr>
                <th className="p-3.5">Tên Chi đoàn</th>
                {!isUnitSecretary && <th className="p-3.5">Phân loại</th>}
                <th className="p-3.5">Bí thư hiện tại</th>
                <th className="p-3.5 text-center min-w-36">Đoàn viên (Khai báo / Thực tế)</th>
                <th className="p-3.5 text-center">Thanh niên</th>
                <th className="p-3.5 text-center">Trạng thái</th>
                <th className="p-3.5 text-center">Cảnh báo mở</th>
                <th className="p-3.5 text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map(row => {
                return (
                  <tr
                    key={row.unit.id}
                    onClick={() => setSelectedUnit(row.unit)}
                    className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                  >
                    <td className="p-3.5 font-bold text-slate-900 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span>{row.unit.name}</span>
                        {!row.unit.is_active && (
                          <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded">
                            Ngừng HĐ
                          </span>
                        )}
                      </div>
                    </td>

                    {!isUnitSecretary && (
                    <td className="p-3.5 whitespace-nowrap text-slate-600 capitalize">
                      {row.unit.unit_type_id === 'residential'
                        ? 'Dân cư'
                        : row.unit.unit_type_id === 'school'
                        ? 'Trường học'
                        : row.unit.unit_type_id === 'health'
                        ? 'Y tế'
                        : 'Công an'}
                    </td>
                    )}

                    <td className="p-3.5 whitespace-nowrap">
                      {row.secretary ? (
                        <div className="flex items-center gap-2">
                          <img
                            src={row.secretary.avatar_url}
                            alt=""
                            className="w-6 h-6 rounded-full object-cover"
                          />
                          <span className="font-semibold text-slate-800">{row.secretary.full_name}</span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          <ShieldAlert className="w-3 h-3 text-amber-600" />
                          Khuyết Bí thư
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <span className="font-bold text-slate-900">{row.declaredCount}</span>
                        <span className="text-slate-400">/</span>
                        <span className="font-bold text-[#1F5FBF]">{row.actualMembersCount}</span>
                        {row.isMismatch && (
                          <span
                            className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200"
                            title={`Khai báo ${row.declaredCount} nhưng cơ sở dữ liệu có ${row.actualMembersCount} hồ sơ`}
                          >
                            <AlertTriangle className="w-3 h-3 text-amber-600 mr-0.5" /> Lệch
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-3.5 text-center font-bold text-slate-700 whitespace-nowrap">
                      {row.unit.youth_count}
                    </td>

                    <td className="p-3.5 text-center whitespace-nowrap">
                      {row.unit.is_active ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Hoạt động
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                          Ngừng hoạt động
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 text-center whitespace-nowrap">
                      {row.openWarningCount > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700">
                          <AlertCircle className="w-3 h-3" />
                          {row.openWarningCount}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>

                    <td className="p-3.5 text-right whitespace-nowrap text-slate-400">
                      <ChevronRight className="w-4 h-4 inline-block" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* CHI TIẾT CHI ĐOÀN CÓ 5 TAB */}
      {selectedUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-3xl h-full bg-white shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-start justify-between gap-3 shrink-0">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#1F5FBF] bg-blue-100 px-2 py-0.5 rounded">
                  Hồ sơ Chi đoàn Cơ sở
                </span>
                <h2 className="text-base md:text-lg font-bold text-slate-900 mt-1">{selectedUnit.name}</h2>
                <p className="text-xs text-slate-500">{selectedUnit.note || 'Địa bàn xã Hòa Bình'}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedUnit(null)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 5 Tabs: Thông tin | Đoàn viên | Ban chấp hành | Nhiệm vụ & tiêu chí | Điểm */}
            <div className="flex items-center gap-4 px-5 border-b border-slate-200 bg-white text-xs font-bold shrink-0 overflow-x-auto">
              <button
                type="button"
                onClick={() => setDetailTab('info')}
                className={`py-3 border-b-2 transition-colors cursor-pointer shrink-0 ${
                  detailTab === 'info'
                    ? 'border-[#1F5FBF] text-[#1F5FBF]'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                1. Thông tin
              </button>

              <button
                type="button"
                onClick={() => setDetailTab('members')}
                className={`py-3 border-b-2 transition-colors cursor-pointer shrink-0 ${
                  detailTab === 'members'
                    ? 'border-[#1F5FBF] text-[#1F5FBF]'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                2. Đoàn viên ({actualMembersOfSelected.length})
              </button>

              <button
                type="button"
                onClick={() => setDetailTab('committee')}
                className={`py-3 border-b-2 transition-colors cursor-pointer shrink-0 ${
                  detailTab === 'committee'
                    ? 'border-[#1F5FBF] text-[#1F5FBF]'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                3. Ban chấp hành ({committeeOfSelected.length})
              </button>

              <button
                type="button"
                onClick={() => setDetailTab('tasks')}
                className={`py-3 border-b-2 transition-colors cursor-pointer shrink-0 ${
                  detailTab === 'tasks'
                    ? 'border-[#1F5FBF] text-[#1F5FBF]'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                4. Nhiệm vụ ({tasksOfSelected.length})
              </button>

              {canViewScores && (
              <button
                type="button"
                onClick={() => setDetailTab('scores')}
                className={`py-3 border-b-2 transition-colors cursor-pointer shrink-0 ${
                  detailTab === 'scores'
                    ? 'border-[#1F5FBF] text-[#1F5FBF]'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                5. Điểm thi đua ({scoresOfSelected.totalScore}đ)
              </button>
              )}
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-5 text-xs space-y-4">
              {/* TAB 1: THÔNG TIN */}
              {detailTab === 'info' && (
                <form onSubmit={handleSaveInfo} className="space-y-4">
                  <div>
                    <label className="font-bold text-slate-800 block mb-1">Tên Chi đoàn:</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-semibold focus:outline-none focus:border-[#1F5FBF]"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-800 block mb-1">Ghi chú địa bàn / vị trí:</label>
                    <textarea
                      rows={2}
                      value={editNote}
                      onChange={e => setEditNote(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg resize-none focus:outline-none focus:border-[#1F5FBF]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-800 block mb-1">
                        Số đoàn viên khai báo:
                      </label>
                      <input
                        type="number"
                        value={editDeclaredCount}
                        onChange={e => setEditDeclaredCount(Number(e.target.value))}
                        className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-[#1F5FBF]"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-800 block mb-1">Số thanh niên quản lý:</label>
                      <input
                        type="number"
                        value={editYouthCount}
                        onChange={e => setEditYouthCount(Number(e.target.value))}
                        className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                    <div className="flex items-center gap-2">
                      {selectedUnit.is_active ? (
                        <button
                          type="button"
                          onClick={() => setIsDeactivateConfirmOpen(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 cursor-pointer"
                        >
                          <PowerOff className="w-4 h-4 text-rose-600" /> Ngừng hoạt động
                        </button>
                      ) : (
                        <span className="text-slate-400 font-semibold italic">Chi đoàn đã ngừng hoạt động</span>
                      )}

                      {canManage && (
                        <button
                          type="button"
                          onClick={() => setIsDeleteConfirmOpen(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 font-bold text-rose-700 bg-white hover:bg-rose-50 rounded-lg border border-rose-300 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4 text-rose-600" /> Xóa chi đoàn
                        </button>
                      )}
                    </div>

                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 px-4 py-2 font-bold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded-lg cursor-pointer shadow-xs"
                    >
                      <Save className="w-4 h-4" /> Lưu thông tin
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 2: ĐOÀN VIÊN */}
              {detailTab === 'members' && (
                <div className="space-y-3">
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white overflow-hidden">
                    {actualMembersOfSelected.map(m => (
                      <div key={m.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                        <div className="flex items-center gap-2.5">
                          <img src={m.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                          <div>
                            <p className="font-bold text-slate-900">{m.full_name}</p>
                            <p className="text-[11px] text-slate-400">
                              {m.current_position === 'secretary'
                                ? 'Bí thư Chi đoàn'
                                : m.current_position === 'deputy_secretary'
                                ? 'Phó Bí thư'
                                : 'Đoàn viên'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {m.is_party_member && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
                              Đảng viên
                            </span>
                          )}
                          <span className="font-mono text-slate-500 text-[11px]">
                            {isStaff ? m.phone.substring(0, 3) + '******' + m.phone.substring(9) : m.phone}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: BAN CHẤP HÀNH */}
              {detailTab === 'committee' && (
                <div className="space-y-3">
                  {committeeOfSelected.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl">
                      Chi đoàn này hiện đang khuyết nhân sự Ban Chấp hành.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white overflow-hidden">
                      {committeeOfSelected.map(({ comm, member }) => (
                        <div key={comm.id} className="p-3.5 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <img src={member?.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                            <div>
                              <p className="font-bold text-slate-900">{member?.full_name}</p>
                              <p className="text-[11px] text-[#1F5FBF] font-semibold">
                                {comm.position === 'secretary'
                                  ? 'Bí thư Chi đoàn'
                                  : comm.position === 'deputy_secretary'
                                  ? 'Phó Bí thư'
                                  : 'Uỷ viên BCH'}
                              </p>
                            </div>
                          </div>

                          <div className="text-right text-[11px] text-slate-500">
                            <span>Bổ nhiệm: {comm.term_start}</span>
                            {comm.term_end && (
                              <span className="block text-rose-500 font-semibold">Đã miễn nhiệm: {comm.term_end}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: NHIỆM VỤ & TIÊU CHÍ */}
              {detailTab === 'tasks' && (
                <div className="space-y-3">
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white overflow-hidden">
                    {tasksOfSelected.map(({ task, result }) => (
                      <div key={task.id} className="p-3.5 flex items-center justify-between gap-3">
                        <div>
                          <p className="font-bold text-slate-900">{task.title}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">Hạn: {formatDateVN(task.due_date)}</p>
                        </div>
                        <ReviewStatusBadge status={result ? result.status : 'pending'} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 5: ĐIỂM */}
              {detailTab === 'scores' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-blue-50 rounded-xl text-center">
                      <span className="text-slate-500 block">Tổng điểm:</span>
                      <span className="text-2xl font-extrabold text-[#1F5FBF]">
                        {scoresOfSelected.totalScore}đ
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl text-center">
                      <span className="text-slate-500 block">Hoạt động:</span>
                      <span className="text-xl font-bold text-slate-800">Nhiệm vụ: {scoresOfSelected.taskCount}/{scoresOfSelected.taskAssignedCount} • {scoresOfSelected.participantCount} lượt ĐV</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DEACTIVATE MODAL */}
      {isDeactivateConfirmOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 space-y-3 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900">Xác nhận ngừng hoạt động</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Bạn có chắc chắn muốn chuyển Chi đoàn "{selectedUnit?.name}" sang trạng thái Ngừng hoạt động? Chi đoàn sẽ không thể nhận thêm nhiệm vụ mới.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDeactivateConfirmOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDeactivate}
                className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE UNIT MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleCreateUnit}
            className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl"
          >
            <h3 className="text-base font-bold text-slate-900">Thêm chi đoàn mới</h3>

            <div>
              <label className="font-bold text-slate-800 block mb-1 text-xs">Tên chi đoàn *</label>
              <input
                type="text"
                value={newUnitName}
                onChange={e => setNewUnitName(e.target.value)}
                placeholder="VD: Chi đoàn Ấp 7"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#1F5FBF]"
              />
            </div>

            <div>
              <label className="font-bold text-slate-800 block mb-1 text-xs">Phân loại</label>
              <select
                value={newUnitType}
                onChange={e => setNewUnitType(e.target.value as UnitTypeId)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#1F5FBF]"
              >
                <option value="residential">Dân cư</option>
                <option value="school">Trường học</option>
                <option value="health">Y tế</option>
                <option value="police">Công an</option>
                <option value="other">Khác</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-800 block mb-1 text-xs">Ghi chú địa bàn / vị trí</label>
              <textarea
                rows={2}
                value={newUnitNote}
                onChange={e => setNewUnitNote(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm resize-none focus:outline-none focus:border-[#1F5FBF]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-800 block mb-1 text-xs">Số đoàn viên khai báo</label>
                <input
                  type="number"
                  value={newUnitDeclared}
                  onChange={e => setNewUnitDeclared(Number(e.target.value))}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold"
                />
              </div>
              <div>
                <label className="font-bold text-slate-800 block mb-1 text-xs">Số thanh niên quản lý</label>
                <input
                  type="number"
                  value={newUnitYouth}
                  onChange={e => setNewUnitYouth(Number(e.target.value))}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={creating}
                className="px-3 py-1.5 text-xs font-bold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded-lg cursor-pointer disabled:opacity-60"
              >
                {creating ? 'Đang thêm…' : 'Thêm chi đoàn'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DELETE UNIT MODAL */}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 space-y-3 shadow-2xl">
            <h3 className="text-base font-bold text-rose-700">Xóa chi đoàn</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Bạn có chắc chắn muốn xóa vĩnh viễn Chi đoàn "{selectedUnit?.name}"? Thao tác này không thể hoàn tác.
              Chỉ xóa được khi chi đoàn không còn đoàn viên và dữ liệu Ban chấp hành.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer disabled:opacity-60"
              >
                {deleting ? 'Đang xóa…' : 'Xóa vĩnh viễn'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
