import { Repository } from './repository';
import {
  DbRole,
  DbUnitType,
  DbEthnicity,
  DbUnit,
  DbMember,
  DbProfile,
  DbCriteriaSet,
  DbCriteriaSection,
  DbCriterion,
  DbSubCriterion,
  DbCriterionSubmission,
  DbTask,
  DbTaskUnit,
  DbTaskRegistration,
  DbTaskSubCriterion,
  DbTaskResult,
  DbMemberSubmission,
  DbJournalEntry,
  DbEvidence,
  DbNotification,
  DbWarning,
  DbUnitCommittee,
  DbReport,
  DbYearlySettings,
  DbAuditLog,
  DashboardStats,
  UnitScoreCalculation,
  MemberComputed,
  TaskDeadlineStatus,
  EvidenceAuditWarning,
  RoleId,
  UnitTypeId,
  CommitteePosition,
  ReportType,
} from './types';
import {
  mockRoles,
  mockUnitTypes,
  mockEthnicities,
  mockUnits,
  mockMembers,
  mockProfiles,
  mockCriteriaSet,
  mockCriteriaSections,
  mockCriteria,
  mockSubCriteria,
  mockTasks,
  mockTaskUnits,
  mockTaskRegistrations,
  mockTaskSubCriteria,
  mockTaskResults,
  mockCriterionSubmissions,
  mockEvidences,
  mockNotifications,
  mockWarnings,
  mockAuditLogs,
  mockUnitCommittees,
  mockReports,
  mockYearlySettings,
  keyMemberIds,
  getRelativeDate,
} from '../mock/data';

// Helper bỏ dấu tiếng Việt để tìm kiếm
function removeVietnameseTones(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export class MockRepository implements Repository {
  private roles: DbRole[] = JSON.parse(JSON.stringify(mockRoles));
  private unitTypes: DbUnitType[] = JSON.parse(JSON.stringify(mockUnitTypes));
  private ethnicities: DbEthnicity[] = JSON.parse(JSON.stringify(mockEthnicities));
  private units: DbUnit[] = JSON.parse(JSON.stringify(mockUnits));
  private members: DbMember[] = JSON.parse(JSON.stringify(mockMembers));
  private profiles: DbProfile[] = JSON.parse(JSON.stringify(mockProfiles));
  private criteriaSets: DbCriteriaSet[] = [
    JSON.parse(JSON.stringify(mockCriteriaSet)),
    {
      id: 'set_2025',
      year: 2025,
      name: 'Bộ Tiêu chí Đánh giá Chất lượng Hoạt động Đoàn Cơ sở năm 2025 (Niên độ trước)',
      issuing_unit: 'Huyện Đoàn & Ban Thường vụ Đoàn xã Hòa Bình',
    },
  ];
  private criteriaSections: DbCriteriaSection[] = JSON.parse(JSON.stringify(mockCriteriaSections));
  private criteria: DbCriterion[] = JSON.parse(JSON.stringify(mockCriteria));
  private subCriteria: DbSubCriterion[] = JSON.parse(JSON.stringify(mockSubCriteria));
  private criterionSubmissions: DbCriterionSubmission[] = JSON.parse(JSON.stringify(mockCriterionSubmissions));
  private tasks: DbTask[] = JSON.parse(JSON.stringify(mockTasks));
  private taskUnits: DbTaskUnit[] = JSON.parse(JSON.stringify(mockTaskUnits));
  private taskRegistrations: DbTaskRegistration[] = JSON.parse(JSON.stringify(mockTaskRegistrations));
  private taskSubCriteria: DbTaskSubCriterion[] = JSON.parse(JSON.stringify(mockTaskSubCriteria));
  private taskResults: DbTaskResult[] = JSON.parse(JSON.stringify(mockTaskResults));
  private evidences: DbEvidence[] = JSON.parse(JSON.stringify(mockEvidences));
  private notifications: DbNotification[] = JSON.parse(JSON.stringify(mockNotifications));
  private warnings: DbWarning[] = JSON.parse(JSON.stringify(mockWarnings));
  private memberSubmissions: DbMemberSubmission[] = [];
  private unitCommittees: DbUnitCommittee[] = JSON.parse(JSON.stringify(mockUnitCommittees));
  private reports: DbReport[] = JSON.parse(JSON.stringify(mockReports));
  private yearlySettings: DbYearlySettings = JSON.parse(JSON.stringify(mockYearlySettings));
  private auditLogs: DbAuditLog[] = JSON.parse(JSON.stringify(mockAuditLogs));

  // 0. Người dùng đang đăng nhập — chế độ mock không có phiên thật
  async getCurrentUser(): Promise<{
    profileId: string;
    email: string | null;
    role: RoleId;
    memberId: string | null;
    isActive: boolean;
  } | null> {
    return null;
  }

  // 0b. Nộp minh chứng — chỉ hoạt động ở chế độ Supabase thật
  async listMyTodo(): Promise<never> {
    throw new Error('Chức năng nộp minh chứng chỉ dùng khi kết nối Supabase thật.');
  }
  async uploadEvidence(): Promise<never> {
    throw new Error('Chức năng tải minh chứng chỉ dùng khi kết nối Supabase thật.');
  }
  async submitTaskResult(): Promise<never> {
    throw new Error('Chức năng nộp kết quả nhiệm vụ chỉ dùng khi kết nối Supabase thật.');
  }
  async submitCriterionSubmission(): Promise<never> {
    throw new Error('Chức năng nộp tiêu chí chỉ dùng khi kết nối Supabase thật.');
  }

  // 0c. Tự phục vụ
  async updateMyProfile(): Promise<never> {
    throw new Error('Chức năng sửa hồ sơ cá nhân chỉ dùng khi kết nối Supabase thật.');
  }
  async listMyFeed(): Promise<never> {
    throw new Error('Bảng tin chỉ dùng khi kết nối Supabase thật.');
  }
  async setTaskRegistration(): Promise<never> {
    throw new Error('Chức năng xác nhận tham gia chỉ dùng khi kết nối Supabase thật.');
  }
  async submitMemberResult(): Promise<never> {
    throw new Error('Chức năng nộp minh chứng cá nhân chỉ dùng khi kết nối Supabase thật.');
  }
  async listMemberSubmissions(): Promise<DbMemberSubmission[]> {
    return this.memberSubmissions;
  }
  async reviewMemberSubmission(): Promise<never> {
    throw new Error('Chức năng duyệt bài nộp cá nhân chỉ dùng khi kết nối Supabase thật.');
  }
  async listMemberSubmissionEvidences(): Promise<DbEvidence[]> {
    return [];
  }
  async listTaskParticipantsAll(): Promise<never> {
    throw new Error('Chức năng xem danh sách tham gia chỉ dùng khi kết nối Supabase thật.');
  }
  async listTaskParticipants(): Promise<never> {
    throw new Error('Chức năng xem danh sách tham gia chỉ dùng khi kết nối Supabase thật.');
  }

  async getSignupOptions(): Promise<{
    units: Array<{ id: string; name: string; unit_type_id: UnitTypeId }>;
    ethnicities: Array<{ id: string; name: string }>;
  }> {
    return { units: [], ethnicities: [] };
  }
  async selfRegisterMember(): Promise<never> {
    throw new Error('Đăng ký tài khoản chỉ dùng khi kết nối Supabase thật.');
  }

  private journalEntries: DbJournalEntry[] = [];

  async listJournalEntries(): Promise<DbJournalEntry[]> {
    return this.journalEntries;
  }
  async saveJournalEntry(input: {
    id?: string; title: string; activity_date: string; note?: string;
    images: Array<{ storagePath: string; url: string; fileName?: string }>;
    links: Array<{ url: string; note?: string }>;
  }): Promise<{ success: boolean; message?: string; entryId?: string }> {
    const now = new Date().toISOString();
    const id = input.id ?? `journal_${Date.now()}`;
    const entry: DbJournalEntry = {
      id,
      profile_id: 'mock-profile',
      title: input.title,
      activity_date: input.activity_date,
      note: input.note,
      created_at: now,
      updated_at: now,
      images: input.images.map((i, idx) => ({
        id: `${id}_img_${idx}`, entry_id: id,
        storage_path: i.storagePath, url: i.url, file_name: i.fileName,
      })),
      links: input.links.map((l, idx) => ({
        id: `${id}_link_${idx}`, entry_id: id, url: l.url, note: l.note,
      })),
    };
    const idx = this.journalEntries.findIndex(e => e.id === id);
    if (idx >= 0) this.journalEntries[idx] = entry;
    else this.journalEntries.unshift(entry);
    return { success: true, entryId: id };
  }
  async deleteJournalEntry(id: string): Promise<{ success: boolean; message?: string }> {
    this.journalEntries = this.journalEntries.filter(e => e.id !== id);
    return { success: true };
  }
  async uploadJournalImage(): Promise<never> {
    throw new Error('Tải ảnh sổ tay chỉ dùng khi kết nối Supabase thật.');
  }

  // 1. Dashboard & Thống kê
  async getDashboard(year: number): Promise<DashboardStats> {
    const taskPending = this.taskResults.filter(r => r.status === 'pending').length;
    const critPending = this.criterionSubmissions.filter(s => s.status === 'pending').length;

    const overdueUnitsSet = new Set<string>();
    this.taskResults.forEach(r => {
      if (r.is_overdue || (r.status === 'pending' && new Date().toISOString() > '2026-10-01')) {
        overdueUnitsSet.add(r.unit_id);
      }
    });

    const now = new Date();
    const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const dueSoonTasks = this.tasks.filter(t => {
      const due = new Date(t.due_date);
      return due >= now && due <= next7Days && t.status === 'published';
    }).length;

    const currentYear = year || 2026;
    const newMembers = this.members.filter(m => {
      try {
        return new Date(m.joined_date).getFullYear() === currentYear;
      } catch {
        return false;
      }
    }).length;

    const matured = this.members.filter(m => {
      try {
        const birthYear = new Date(m.birth_date).getFullYear();
        return currentYear - birthYear >= (this.yearlySettings.matured_age || 30);
      } catch {
        return false;
      }
    }).length;

    return {
      pendingCount: taskPending + critPending,
      taskPendingCount: taskPending,
      criteriaPendingCount: critPending,
      overdueUnitsCount: overdueUnitsSet.size,
      dueSoon7DaysCount: dueSoonTasks,
      newMembersCount: newMembers,
      maturedCount: matured,
      totalMembers: this.members.filter(m => m.is_active).length,
      totalUnits: this.units.filter(u => u.is_active).length,
    };
  }

  async calculateUnitScores(): Promise<UnitScoreCalculation[]> {
    return this.units.map(unit => {
      // 1. Điểm tiêu chí
      const approvedSubmissions = this.criterionSubmissions.filter(
        s => s.unit_id === unit.id && s.status === 'approved' && s.approved_score !== null
      );
      const critScore = approvedSubmissions.reduce((sum, s) => sum + (s.approved_score || 0), 0);

      // 2. Nhiệm vụ: chỉ đếm, không cộng điểm. Chỉ tính nhiệm vụ CÓ gắn tiêu chí.
      const tasksWithCriteria = new Set(this.taskSubCriteria.map(tsc => tsc.task_id));
      const taskCount = this.taskResults.filter(
        r => r.unit_id === unit.id && r.status === 'approved' && tasksWithCriteria.has(r.task_id)
      ).length;

      // 3. Tổng nhiệm vụ (có gắn tiêu chí) được giao cho chi đoàn
      const taskAssignedCount = this.taskUnits.filter(
        tu => tu.unit_id === unit.id && tasksWithCriteria.has(tu.task_id)
      ).length;

      const total = critScore;
      const maxPossible = 100;
      const rate = taskAssignedCount > 0
        ? Math.min(100, Math.round((taskCount / taskAssignedCount) * 100))
        : 0;

      return {
        unit,
        totalScore: total,
        maxPossible,
        criteriaScore: critScore,
        taskCount,
        taskAssignedCount,
        participantCount: 0,
        completionRate: rate,
      };
    });
  }

  // 2. Duyệt
  async listPendingReviews(
    tab: 'all' | 'tasks' | 'criteria',
    filters?: { unitId?: string; search?: string }
  ): Promise<{ taskResults: DbTaskResult[]; criterionSubmissions: DbCriterionSubmission[] }> {
    let trs = this.taskResults.filter(r => r.status === 'pending');
    let css = this.criterionSubmissions.filter(s => s.status === 'pending');

    if (filters?.unitId) {
      trs = trs.filter(r => r.unit_id === filters.unitId);
      css = css.filter(s => s.unit_id === filters.unitId);
    }

    if (filters?.search) {
      const q = filters.search.toLowerCase();
      trs = trs.filter(r => {
        const t = this.tasks.find(tk => tk.id === r.task_id);
        const u = this.units.find(un => un.id === r.unit_id);
        return (t?.title.toLowerCase().includes(q) || u?.name.toLowerCase().includes(q));
      });
      css = css.filter(s => {
        const sc = this.subCriteria.find(c => c.id === s.sub_criterion_id);
        const u = this.units.find(un => un.id === s.unit_id);
        return (sc?.condition_text.toLowerCase().includes(q) || u?.name.toLowerCase().includes(q));
      });
    }

    if (tab === 'tasks') {
      return { taskResults: trs, criterionSubmissions: [] };
    }
    if (tab === 'criteria') {
      return { taskResults: [], criterionSubmissions: css };
    }
    return { taskResults: trs, criterionSubmissions: css };
  }

  async getReviewDetail(
    kind: 'task' | 'criterion',
    id: string
  ): Promise<{
    item: DbTaskResult | DbCriterionSubmission | null;
    unit: DbUnit | null;
    task?: DbTask | null;
    subCriterion?: DbSubCriterion | null;
    evidences: DbEvidence[];
    warnings: EvidenceAuditWarning[];
  }> {
    if (kind === 'task') {
      const item = this.taskResults.find(r => r.id === id) || null;
      const unit = item ? this.units.find(u => u.id === item.unit_id) || null : null;
      const task = item ? this.tasks.find(t => t.id === item.task_id) || null : null;
      const evs = item ? this.evidences.filter(e => e.task_id === item.task_id && e.unit_id === item.unit_id) : [];

      const warnings: EvidenceAuditWarning[] = evs.map(e => {
        const missingGps = e.lat === null || e.lng === null;
        const dupHash = this.evidences.filter(other => other.id !== e.id && other.file_hash === e.file_hash).length > 0;
        const capturedLate = task ? new Date(e.captured_at) > new Date(task.due_date) : false;

        let warning_text = '';
        if (missingGps) warning_text += 'Thiếu tọa độ GPS kiểm tra tại thực địa. ';
        if (dupHash) warning_text += 'Phát hiện trùng khớp mã băm (hash) ảnh với minh chứng khác! ';
        if (capturedLate) warning_text += 'Thời điểm chụp ảnh sau hạn chót nộp báo cáo. ';

        return {
          evidence_id: e.id,
          is_missing_gps: missingGps,
          is_duplicate_hash: dupHash,
          is_captured_after_deadline: capturedLate,
          warning_text: warning_text.trim(),
        };
      });

      return { item, unit, task, evidences: evs, warnings };
    } else {
      const item = this.criterionSubmissions.find(s => s.id === id) || null;
      const unit = item ? this.units.find(u => u.id === item.unit_id) || null : null;
      const subCriterion = item ? this.subCriteria.find(c => c.id === item.sub_criterion_id) || null : null;
      const evs = item ? this.evidences.filter(e => e.submission_id === item.id) : [];

      const warnings: EvidenceAuditWarning[] = evs.map(e => {
        const missingGps = e.lat === null || e.lng === null;
        const dupHash = this.evidences.filter(other => other.id !== e.id && other.file_hash === e.file_hash).length > 0;
        const capturedLate = subCriterion ? new Date(e.captured_at) > new Date(subCriterion.deadline) : false;

        return {
          evidence_id: e.id,
          is_missing_gps: missingGps,
          is_duplicate_hash: dupHash,
          is_captured_after_deadline: capturedLate,
          warning_text: (missingGps ? 'Thiếu GPS. ' : '') + (dupHash ? 'Trùng mã băm. ' : '') + (capturedLate ? 'Chụp sau hạn. ' : ''),
        };
      });

      return { item, unit, subCriterion, evidences: evs, warnings };
    }
  }

  async approve(
    kind: 'task' | 'criterion',
    id: string,
    reviewerId: string,
    approvedScore?: number,
    reviewNote?: string
  ): Promise<{ success: boolean; message?: string }> {
    const nowIso = new Date().toISOString();
    if (kind === 'task') {
      const idx = this.taskResults.findIndex(r => r.id === id);
      if (idx !== -1) {
        this.taskResults[idx] = {
          ...this.taskResults[idx],
          status: 'approved',
          reviewed_by: reviewerId,
          reviewed_at: nowIso,
          review_note: reviewNote || 'Đạt yêu cầu',
        };
        this.auditLogs.unshift({
          id: `log_${Date.now()}`,
          actor_id: reviewerId,
          actor_role: 'admin',
          action: 'Duyệt kết quả nhiệm vụ',
          table_name: 'task_results',
          row_id: id,
          old_value: 'status: pending',
          new_value: `status: approved, reviewed_by: ${reviewerId}`,
          created_at: nowIso,
        });
        return { success: true };
      }
    } else {
      const idx = this.criterionSubmissions.findIndex(s => s.id === id);
      if (idx !== -1) {
        const sc = this.subCriteria.find(c => c.id === this.criterionSubmissions[idx].sub_criterion_id);
        const maxScore = sc?.max_score || 5;
        const score = approvedScore !== undefined ? approvedScore : this.criterionSubmissions[idx].self_score;

        this.criterionSubmissions[idx] = {
          ...this.criterionSubmissions[idx],
          status: 'approved',
          approved_score: Math.min(score, maxScore),
          reviewed_by: reviewerId,
          reviewed_at: nowIso,
          review_note: reviewNote || 'Đã kiểm tra minh chứng hợp lệ',
        };
        this.auditLogs.unshift({
          id: `log_${Date.now()}`,
          actor_id: reviewerId,
          actor_role: 'admin',
          action: 'Duyệt minh chứng tiêu chí',
          table_name: 'criterion_submissions',
          row_id: id,
          old_value: 'status: pending',
          new_value: `status: approved, approved_score: ${score}`,
          created_at: nowIso,
        });
        return { success: true };
      }
    }
    return { success: false, message: 'Không tìm thấy bản ghi cần duyệt' };
  }

  async reject(
    kind: 'task' | 'criterion',
    id: string,
    reviewerId: string,
    note: string
  ): Promise<{ success: boolean; message?: string }> {
    const nowIso = new Date().toISOString();
    if (kind === 'task') {
      const idx = this.taskResults.findIndex(r => r.id === id);
      if (idx !== -1) {
        this.taskResults[idx] = {
          ...this.taskResults[idx],
          status: 'rejected',
          reviewed_by: reviewerId,
          reviewed_at: nowIso,
          review_note: note,
        };
        this.auditLogs.unshift({
          id: `log_${Date.now()}`,
          actor_id: reviewerId,
          actor_role: 'admin',
          action: 'Từ chối kết quả nhiệm vụ',
          table_name: 'task_results',
          row_id: id,
          old_value: 'status: pending',
          new_value: `status: rejected, note: ${note}`,
          created_at: nowIso,
        });
        return { success: true };
      }
    } else {
      const idx = this.criterionSubmissions.findIndex(s => s.id === id);
      if (idx !== -1) {
        this.criterionSubmissions[idx] = {
          ...this.criterionSubmissions[idx],
          status: 'rejected',
          approved_score: 0,
          reviewed_by: reviewerId,
          reviewed_at: nowIso,
          review_note: note,
        };
        this.auditLogs.unshift({
          id: `log_${Date.now()}`,
          actor_id: reviewerId,
          actor_role: 'admin',
          action: 'Từ chối tiêu chí',
          table_name: 'criterion_submissions',
          row_id: id,
          old_value: 'status: pending',
          new_value: `status: rejected, note: ${note}`,
          created_at: nowIso,
        });
        return { success: true };
      }
    }
    return { success: false, message: 'Không tìm thấy mục cần từ chối' };
  }

  // 3. Nhiệm vụ
  async listTasks(status?: 'all' | 'draft' | 'published' | 'closed'): Promise<DbTask[]> {
    if (!status || status === 'all') return [...this.tasks];
    return this.tasks.filter(t => t.status === status);
  }

  async getTask(id: string) {
    const task = this.tasks.find(t => t.id === id) || null;
    const taskUnitRows = this.taskUnits.filter(tu => tu.task_id === id);
    const assignedUnits = this.units.filter(u => taskUnitRows.some(tu => tu.unit_id === u.id));
    const registrations = this.taskRegistrations.filter(tr => tr.task_id === id);
    const subCriteriaRows = this.taskSubCriteria.filter(tsc => tsc.task_id === id);
    const mappedSubCriteria = subCriteriaRows
      .map(tsc => {
        const sc = this.subCriteria.find(c => c.id === tsc.sub_criterion_id);
        return sc ? { subCriterion: sc, contribution_score: tsc.contribution_score } : null;
      })
      .filter(Boolean) as Array<{ subCriterion: DbSubCriterion; contribution_score: number }>;

    const results = this.taskResults.filter(r => r.task_id === id);

    // Compute deadline status
    let is_overdue = false;
    let days_remaining = 0;
    let chip_color: 'emerald' | 'amber' | 'rose' = 'emerald';
    let chip_label = 'Đang tiến hành';

    if (task) {
      const now = new Date();
      const due = new Date(task.due_date);
      const diffMs = due.getTime() - now.getTime();
      days_remaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (days_remaining < 0) {
        is_overdue = true;
        chip_color = 'rose';
        chip_label = `Quá hạn ${Math.abs(days_remaining)} ngày`;
      } else if (days_remaining <= 3) {
        chip_color = 'amber';
        chip_label = `Còn ${days_remaining} ngày`;
      } else {
        chip_color = 'emerald';
        chip_label = `Còn ${days_remaining} ngày`;
      }
    }

    return {
      task,
      deadlineStatus: { is_overdue, days_remaining, chip_color, chip_label },
      units: assignedUnits,
      registrations,
      subCriteria: mappedSubCriteria,
      results,
    };
  }

  async createTask(input: {
    taskData: Omit<DbTask, 'id' | 'assigned_by' | 'assigned_at' | 'closed_by' | 'closed_at'>;
    unitIds: string[];
    subCriteriaContributions: Array<{ sub_criterion_id: string; contribution_score: number }>;
  }): Promise<DbTask> {
    const newTask: DbTask = {
      ...input.taskData,
      id: `task_${Date.now()}`,
      assigned_by: keyMemberIds.biThuXa,
      assigned_at: new Date().toISOString(),
      closed_by: null,
      closed_at: null,
    };

    this.tasks.unshift(newTask);

    input.unitIds.forEach(uId => {
      this.taskUnits.push({ task_id: newTask.id, unit_id: uId });
    });

    input.subCriteriaContributions.forEach(sc => {
      this.taskSubCriteria.push({
        task_id: newTask.id,
        sub_criterion_id: sc.sub_criterion_id,
        contribution_score: sc.contribution_score,
      });
    });

    if (newTask.status === 'published') {
      input.unitIds.forEach(uId => {
        this.notifications.unshift({
          id: `notif_${Date.now()}_${uId}`,
          recipient_id: uId,
          type: 'system',
          level: 'yellow',
          title: `Nhiệm vụ mới: ${newTask.title}`,
          body: `BTV Đoàn xã vừa giao nhiệm vụ mới: ${newTask.title}. Hạn hoàn thành: ${newTask.due_date}`,
          task_id: newTask.id,
          sub_criterion_id: null,
          is_read: false,
          created_at: new Date().toISOString(),
        });
      });
    }

    return newTask;
  }

  async publishTask(id: string): Promise<{ success: boolean; message?: string }> {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return { success: false, message: 'Không tìm thấy nhiệm vụ' };

    const assigned = this.taskUnits.filter(tu => tu.task_id === id);
    if (assigned.length === 0) {
      return { success: false, message: 'Chặn đăng: Chưa có chi đoàn nào được gán nhiệm vụ này!' };
    }

    task.status = 'published';
    assigned.forEach(tu => {
      this.notifications.unshift({
        id: `notif_${Date.now()}_${tu.unit_id}`,
        recipient_id: tu.unit_id,
        type: 'system',
        level: 'yellow',
        title: `Phát hành nhiệm vụ: ${task.title}`,
        body: `Nhiệm vụ đã được công bố chính thức. Đề nghị chi đoàn triển khai đúng tiến độ.`,
        task_id: task.id,
        sub_criterion_id: null,
        is_read: false,
        created_at: new Date().toISOString(),
      });
    });

    return { success: true };
  }

  async closeTask(id: string): Promise<{ success: boolean; message?: string }> {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return { success: false, message: 'Không tìm thấy nhiệm vụ' };
    task.status = 'closed';
    task.closed_by = keyMemberIds.biThuXa;
    task.closed_at = new Date().toISOString();
    return { success: true };
  }

  async deleteTask(id: string): Promise<{ success: boolean; message?: string }> {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return { success: false, message: 'Không tìm thấy nhiệm vụ' };
    if (task.status !== 'draft') {
      return { success: false, message: 'Chỉ được xóa nhiệm vụ ở trạng thái Nháp!' };
    }
    this.tasks = this.tasks.filter(t => t.id !== id);
    this.taskUnits = this.taskUnits.filter(tu => tu.task_id !== id);
    this.taskSubCriteria = this.taskSubCriteria.filter(tsc => tsc.task_id !== id);
    return { success: true };
  }

  async cloneTask(id: string): Promise<DbTask | null> {
    const orig = this.tasks.find(t => t.id === id);
    if (!orig) return null;
    const cloned: DbTask = {
      ...orig,
      id: `task_${Date.now()}`,
      title: `${orig.title} (Bản sao)`,
      status: 'draft',
      assigned_at: new Date().toISOString(),
      due_date: getRelativeDate(14),
    };
    this.tasks.unshift(cloned);

    // copy units & subCriteria
    const origUnits = this.taskUnits.filter(tu => tu.task_id === id);
    origUnits.forEach(tu => this.taskUnits.push({ task_id: cloned.id, unit_id: tu.unit_id }));

    const origSubCrits = this.taskSubCriteria.filter(tsc => tsc.task_id === id);
    origSubCrits.forEach(tsc =>
      this.taskSubCriteria.push({
        task_id: cloned.id,
        sub_criterion_id: tsc.sub_criterion_id,
        contribution_score: tsc.contribution_score,
      })
    );

    return cloned;
  }

  async remindUnit(taskId: string, unitId: string): Promise<{ success: boolean }> {
    const task = this.tasks.find(t => t.id === taskId);
    this.notifications.unshift({
      id: `notif_${Date.now()}`,
      recipient_id: unitId,
      type: 'reminder',
      level: 'orange',
      title: `Nhắc nhở tiến độ: ${task?.title || 'Nhiệm vụ'}`,
      body: `BTV Đoàn xã nhắc chi đoàn khẩn trương hoàn thành và nộp minh chứng nhiệm vụ.`,
      task_id: taskId,
      sub_criterion_id: null,
      is_read: false,
      created_at: new Date().toISOString(),
    });
    return { success: true };
  }

  async remindAllUnsubmitted(taskId: string): Promise<{ remindedCount: number }> {
    const assignedUnits = this.taskUnits.filter(tu => tu.task_id === taskId).map(tu => tu.unit_id);
    const submittedUnits = this.taskResults.filter(r => r.task_id === taskId).map(r => r.unit_id);
    const unsubmitted = assignedUnits.filter(uId => !submittedUnits.includes(uId));

    unsubmitted.forEach(uId => {
      this.remindUnit(taskId, uId);
    });

    return { remindedCount: unsubmitted.length };
  }

  // 4. Chi đoàn
  async listUnits(filters?: { unitTypeId?: UnitTypeId; search?: string; isActive?: boolean }) {
    let result = this.units;
    if (filters?.unitTypeId) {
      result = result.filter(u => u.unit_type_id === filters.unitTypeId);
    }
    if (filters?.isActive !== undefined) {
      result = result.filter(u => u.is_active === filters.isActive);
    }
    if (filters?.search) {
      const q = removeVietnameseTones(filters.search);
      result = result.filter(u => removeVietnameseTones(u.name).includes(q));
    }

    return result.map(unit => {
      const secCommittee = this.unitCommittees.find(
        c => c.unit_id === unit.id && c.position === 'secretary' && !c.term_end
      );
      const currentSecretary = secCommittee
        ? this.members.find(m => m.id === secCommittee.member_id) || null
        : null;

      const actualMembers = this.members.filter(m => m.unit_id === unit.id && m.is_active).length;
      const declaredMembers = unit.union_member_count;
      const countMismatch = actualMembers !== declaredMembers;
      const openWarnings = this.warnings.filter(w => w.unit_id === unit.id && !w.resolved_at).length;

      return {
        unit,
        currentSecretary,
        hasMissingSecretary: !currentSecretary,
        actualMemberCount: actualMembers,
        declaredMemberCount: declaredMembers,
        hasCountMismatch: countMismatch,
        openWarningsCount: openWarnings,
      };
    });
  }

  async getUnit(id: string) {
    const unit = this.units.find(u => u.id === id) || null;
    const secCommittee = this.unitCommittees.find(
      c => c.unit_id === id && c.position === 'secretary' && !c.term_end
    );
    const currentSecretary = secCommittee
      ? this.members.find(m => m.id === secCommittee.member_id) || null
      : null;

    const unitMembers = this.members.filter(m => m.unit_id === id);
    const committee = this.unitCommittees.filter(c => c.unit_id === id);
    const taskResults = this.taskResults.filter(r => r.unit_id === id);
    const submissions = this.criterionSubmissions.filter(s => s.unit_id === id);

    const scores = await this.calculateUnitScores();
    const score = scores.find(s => s.unit.id === id) || null;

    return {
      unit,
      currentSecretary,
      members: unitMembers,
      committee,
      taskResults,
      submissions,
      score,
    };
  }

  async saveUnit(id: string, updates: Partial<DbUnit>): Promise<{ success: boolean }> {
    const idx = this.units.findIndex(u => u.id === id);
    if (idx !== -1) {
      this.units[idx] = { ...this.units[idx], ...updates };
      return { success: true };
    }
    return { success: false };
  }

  async deactivateUnit(id: string): Promise<{ success: boolean; message?: string }> {
    const assignedTasks = this.taskUnits.filter(tu => tu.unit_id === id);
    const pendingTasks = assignedTasks.some(tu => {
      const res = this.taskResults.find(r => r.task_id === tu.task_id && r.unit_id === id);
      return !res || res.status === 'pending';
    });

    if (pendingTasks) {
      return {
        success: false,
        message: 'Chặn thao tác: Chi đoàn này vẫn còn nhiệm vụ được giao đang dở dang chưa hoàn thành!',
      };
    }

    const idx = this.units.findIndex(u => u.id === id);
    if (idx !== -1) {
      this.units[idx].is_active = false;
      return { success: true };
    }
    return { success: false, message: 'Không tìm thấy chi đoàn' };
  }

  async createUnit(input: {
    name: string;
    unit_type_id: UnitTypeId;
    note?: string;
    union_member_count?: number;
    youth_count?: number;
  }): Promise<{ success: boolean; message?: string; unit?: DbUnit }> {
    const name = input.name.trim();
    if (!name) return { success: false, message: 'Tên chi đoàn không được để trống' };
    if (this.units.some(u => u.name.toLowerCase() === name.toLowerCase())) {
      return { success: false, message: 'Đã có chi đoàn trùng tên' };
    }
    const unit: DbUnit = {
      id: `unit_${Date.now()}`,
      name,
      note: input.note,
      unit_type_id: input.unit_type_id,
      is_active: true,
      union_member_count: input.union_member_count ?? 0,
      youth_count: input.youth_count ?? 0,
    };
    this.units.push(unit);
    return { success: true, unit };
  }

  async deleteUnit(id: string): Promise<{ success: boolean; message?: string }> {
    const idx = this.units.findIndex(u => u.id === id);
    if (idx === -1) return { success: false, message: 'Không tìm thấy chi đoàn' };
    const memberCount = this.members.filter(m => m.unit_id === id).length;
    if (memberCount > 0) {
      return { success: false, message: `Chi đoàn còn ${memberCount} đoàn viên, hãy chuyển hoặc xóa họ trước` };
    }
    if (this.unitCommittees.some(c => c.unit_id === id)) {
      return { success: false, message: 'Chi đoàn còn dữ liệu Ban chấp hành, không thể xóa' };
    }
    this.units.splice(idx, 1);
    return { success: true };
  }

  // 5. Đoàn viên
  async listMembers(filters?: {
    search?: string;
    unitId?: string;
    gender?: string;
    position?: string;
    isPartyMember?: boolean;
    isActive?: boolean;
    ageMin?: number;
    ageMax?: number;
    isMatured?: boolean;
  }): Promise<MemberComputed[]> {
    const currentYear = 2026;
    const maturedAge = this.yearlySettings.matured_age || 30;

    return this.members
      .filter(m => {
        if (filters?.unitId && m.unit_id !== filters.unitId) return false;
        if (filters?.gender && m.gender !== filters.gender) return false;
        if (filters?.position && m.current_position !== filters.position) return false;
        if (filters?.isPartyMember !== undefined && m.is_party_member !== filters.isPartyMember) return false;
        if (filters?.isActive !== undefined && m.is_active !== filters.isActive) return false;

        const birthYear = new Date(m.birth_date).getFullYear();
        const age = currentYear - birthYear;
        const isMatured = age >= maturedAge;

        if (filters?.ageMin !== undefined && age < filters.ageMin) return false;
        if (filters?.ageMax !== undefined && age > filters.ageMax) return false;
        if (filters?.isMatured !== undefined && isMatured !== filters.isMatured) return false;

        if (filters?.search) {
          const q = removeVietnameseTones(filters.search);
          const nameNorm = removeVietnameseTones(m.full_name);
          const phoneNorm = m.phone;
          const codeNorm = m.central_member_code.toLowerCase();
          if (!nameNorm.includes(q) && !phoneNorm.includes(q) && !codeNorm.includes(q)) {
            return false;
          }
        }

        return true;
      })
      .map(member => {
        const birthYear = new Date(member.birth_date).getFullYear();
        const age = currentYear - birthYear;
        const isMatured = age >= maturedAge;
        const unit = this.units.find(u => u.id === member.unit_id);
        const p = member.phone;
        const phone_masked = p.length >= 7 ? `${p.slice(0, 3)}****${p.slice(-3)}` : p;

        return {
          member,
          age,
          is_matured: isMatured,
          unit_name: unit?.name || 'Chưa rõ',
          phone_masked,
        };
      });
  }

  async getMember(id: string) {
    const member = this.members.find(m => m.id === id) || null;
    const unit = member ? this.units.find(u => u.id === member.unit_id) || null : null;
    const profile = this.profiles.find(p => p.member_id === id) || null;
    const committeeHistory = this.unitCommittees.filter(c => c.member_id === id);
    const taskRegistrations = this.taskRegistrations.filter(tr => tr.member_id === id);

    return {
      member,
      unit,
      profile,
      committeeHistory,
      taskRegistrations,
    };
  }

  async saveMember(
    input: Omit<DbMember, 'id'> & { id?: string }
  ): Promise<{ success: boolean; message?: string; member?: DbMember }> {
    // Validation
    const phoneClean = input.phone.replace(/\D/g, '');
    if (phoneClean.length < 9 || phoneClean.length > 11) {
      return { success: false, message: 'Số điện thoại phải từ 9 đến 11 chữ số' };
    }
    if (new Date(input.joined_date) < new Date(input.birth_date)) {
      return { success: false, message: 'Ngày vào Đoàn không được trước ngày sinh' };
    }

    if (input.current_position === 'secretary') {
      const existingSec = this.unitCommittees.find(
        c => c.unit_id === input.unit_id && c.position === 'secretary' && !c.term_end && c.member_id !== input.id
      );
      if (existingSec) {
        return {
          success: false,
          message: 'Chi đoàn này đã có Bí thư đang giữ chức! Vui lòng kết thúc nhiệm kỳ trước.',
        };
      }
    }

    if (input.id) {
      const idx = this.members.findIndex(m => m.id === input.id);
      if (idx !== -1) {
        this.members[idx] = { ...this.members[idx], ...input } as DbMember;
        return { success: true, member: this.members[idx] };
      }
    } else {
      const newMem: DbMember = {
        ...input,
        id: `mem_${Date.now()}`,
      };
      this.members.unshift(newMem);
      return { success: true, member: newMem };
    }

    return { success: false, message: 'Lỗi lưu đoàn viên' };
  }

  async deleteMember(id: string): Promise<{ success: boolean }> {
    this.members = this.members.filter(m => m.id !== id);
    return { success: true };
  }

  async importMembers(rows: Array<Omit<DbMember, 'id'>>): Promise<{ importedCount: number }> {
    let count = 0;
    rows.forEach(r => {
      this.members.unshift({
        ...r,
        id: `mem_import_${Date.now()}_${count}`,
      });
      count++;
    });
    return { importedCount: count };
  }

  // 6. Ban Chấp hành
  async listCommittees(unitId: string | null, termStatus: 'active' | 'ended' | 'all' = 'active') {
    let list = this.unitCommittees.filter(c => c.unit_id === unitId);
    if (termStatus === 'active') {
      list = list.filter(c => !c.term_end);
    } else if (termStatus === 'ended') {
      list = list.filter(c => !!c.term_end);
    }

    return list
      .map(c => {
        const m = this.members.find(mem => mem.id === c.member_id);
        return m ? { committee: c, member: m } : null;
      })
      .filter(Boolean) as Array<{ committee: DbUnitCommittee; member: DbMember }>;
  }

  async addCommitteeMember(input: {
    memberId: string;
    unitId: string | null;
    position: CommitteePosition;
    isStanding: boolean;
    termStart: string;
  }): Promise<{ success: boolean; message?: string }> {
    // Rule: secretary/deputy_secretary auto isStanding
    const autoStanding = input.position === 'secretary' || input.position === 'deputy_secretary' ? true : input.isStanding;

    // Rule: unique active secretary for this unit
    if (input.position === 'secretary') {
      const existingSec = this.unitCommittees.find(
        c => c.unit_id === input.unitId && c.position === 'secretary' && !c.term_end
      );
      if (existingSec) {
        return {
          success: false,
          message: 'Chi đoàn này đã có bí thư đang giữ chức! Hãy kết thúc nhiệm kỳ trước.',
        };
      }
    }

    const newComm: DbUnitCommittee = {
      id: `comm_${Date.now()}`,
      unit_id: input.unitId,
      member_id: input.memberId,
      position: input.position,
      is_standing: autoStanding,
      term_start: input.termStart,
      term_end: null,
    };
    this.unitCommittees.push(newComm);

    return { success: true };
  }

  async endCommitteeTerm(id: string, endDate?: string): Promise<{ success: boolean }> {
    const comm = this.unitCommittees.find(c => c.id === id);
    if (comm) {
      comm.term_end = endDate || new Date().toISOString().split('T')[0];
      return { success: true };
    }
    return { success: false };
  }

  // 7. Tiêu chí
  async listCriteriaSets(year?: number) {
    const targetYear = year || 2026;
    return this.criteriaSets.map(cs => {
      const subCrits = this.subCriteria;
      const isFinal = cs.id === this.yearlySettings.criteria_set_id && cs.year === targetYear;
      return {
        criteriaSet: cs,
        subCriteriaCount: cs.id === 'crit_set_2026' ? subCrits.length : 14,
        isFinalizedForYear: isFinal,
        scoringProgress: 68,
      };
    });
  }

  async getCriteriaTree(criteriaSetId: string) {
    const sections = this.criteriaSections.filter(s => s.criteria_set_id === criteriaSetId);
    const criteria = this.criteria;
    const subCriteria = this.subCriteria;
    const totalMaxScore = subCriteria.reduce((sum, sc) => sum + (sc.max_score || 0), 0);
    const orphanCount = subCriteria.filter(sc => !criteria.some(c => c.id === sc.criterion_id)).length;

    return {
      sections,
      criteria,
      subCriteria,
      totalMaxScore,
      orphanCount,
      isValid100: totalMaxScore === 100 && orphanCount === 0,
    };
  }

  async saveCriteriaNode(
    type: 'section' | 'criterion' | 'subCriterion',
    action: 'create' | 'update' | 'delete',
    data: any
  ): Promise<{ success: boolean; message?: string }> {
    if (action === 'delete') {
      // Check if any submission exists
      if (type === 'subCriterion') {
        const subsCount = this.criterionSubmissions.filter(s => s.sub_criterion_id === data.id).length;
        if (subsCount > 0) {
          return { success: false, message: `Đã có ${subsCount} chi đoàn chấm, không thể xóa!` };
        }
        this.subCriteria = this.subCriteria.filter(sc => sc.id !== data.id);
      } else if (type === 'criterion') {
        const childSubIds = this.subCriteria.filter(sc => sc.criterion_id === data.id).map(sc => sc.id);
        const subsCount = this.criterionSubmissions.filter(s => childSubIds.includes(s.sub_criterion_id)).length;
        if (subsCount > 0) {
          return { success: false, message: `Đã có ${subsCount} chi đoàn chấm, không thể xóa!` };
        }
        this.criteria = this.criteria.filter(c => c.id !== data.id);
        this.subCriteria = this.subCriteria.filter(sc => sc.criterion_id !== data.id);
      } else if (type === 'section') {
        const childCritIds = this.criteria.filter(c => c.section_id === data.id).map(c => c.id);
        const childSubIds = this.subCriteria.filter(sc => childCritIds.includes(sc.criterion_id)).map(sc => sc.id);
        const subsCount = this.criterionSubmissions.filter(s => childSubIds.includes(s.sub_criterion_id)).length;
        if (subsCount > 0) {
          return { success: false, message: `Đã có ${subsCount} chi đoàn chấm, không thể xóa!` };
        }
        this.criteriaSections = this.criteriaSections.filter(s => s.id !== data.id);
      }
      return { success: true };
    }

    if (action === 'create') {
      if (type === 'section') {
        this.criteriaSections.push({ ...data, id: `sec_${Date.now()}` });
      } else if (type === 'criterion') {
        this.criteria.push({ ...data, id: `crit_${Date.now()}` });
      } else if (type === 'subCriterion') {
        this.subCriteria.push({ ...data, id: `subcrit_${Date.now()}` });
      }
      return { success: true };
    }

    if (action === 'update') {
      if (type === 'section') {
        const idx = this.criteriaSections.findIndex(s => s.id === data.id);
        if (idx !== -1) this.criteriaSections[idx] = { ...this.criteriaSections[idx], ...data };
      } else if (type === 'criterion') {
        const idx = this.criteria.findIndex(c => c.id === data.id);
        if (idx !== -1) this.criteria[idx] = { ...this.criteria[idx], ...data };
      } else if (type === 'subCriterion') {
        const idx = this.subCriteria.findIndex(sc => sc.id === data.id);
        if (idx !== -1) this.subCriteria[idx] = { ...this.subCriteria[idx], ...data };
      }
      return { success: true };
    }

    return { success: false };
  }

  async reorderCriteriaNodes(
    type: 'section' | 'criterion' | 'subCriterion',
    parentId: string,
    startIndex: number,
    endIndex: number
  ): Promise<{ success: boolean }> {
    if (type === 'section') {
      const items = [...this.criteriaSections];
      const [removed] = items.splice(startIndex, 1);
      items.splice(endIndex, 0, removed);
      this.criteriaSections = items.map((it, idx) => ({ ...it, stt: idx + 1 }));
    }
    return { success: true };
  }

  async deleteCriteriaSet(criteriaSetId: string): Promise<{ success: boolean; message?: string }> {
    const set = this.criteriaSets.find(s => s.id === criteriaSetId);
    if (!set) return { success: false, message: 'Không tìm thấy bộ tiêu chí' };
    set.archived_at = new Date().toISOString();
    return { success: true };
  }
  async restoreCriteriaSet(criteriaSetId: string): Promise<{ success: boolean; message?: string }> {
    const set = this.criteriaSets.find(s => s.id === criteriaSetId);
    if (!set) return { success: false, message: 'Không tìm thấy bộ tiêu chí' };
    set.archived_at = null;
    return { success: true };
  }
  async getCriteriaSetImpact(): Promise<{
    submissionCount: number; unitCount: number; evidenceCount: number;
    subCriteriaCount: number; isArchived: boolean;
  }> {
    return { submissionCount: 0, unitCount: 0, evidenceCount: 0, subCriteriaCount: 0, isArchived: false };
  }
  async purgeCriteriaSet(): Promise<never> {
    throw new Error('Xóa vĩnh viễn bộ tiêu chí chỉ dùng khi kết nối Supabase thật.');
  }

  async setTaskSubCriteria(taskId: string, items: Array<{ sub_criterion_id: string; contribution_score: number }>): Promise<{ success: boolean; message?: string }> {
    this.taskSubCriteria = this.taskSubCriteria.filter(t => t.task_id !== taskId);
    for (const i of items) {
      this.taskSubCriteria.push({ task_id: taskId, sub_criterion_id: i.sub_criterion_id, contribution_score: i.contribution_score });
    }
    return { success: true };
  }
  async countUnitsWithoutResult(taskId: string): Promise<{ assigned: number; submitted: number; missing: string[] }> {
    const assigned = this.taskUnits.filter(tu => tu.task_id === taskId).map(tu => tu.unit_id);
    const submitted = new Set(this.taskResults.filter(r => r.task_id === taskId).map(r => r.unit_id));
    const missing = assigned
      .filter(id => !submitted.has(id))
      .map(id => this.units.find(u => u.id === id)?.name ?? id);
    return { assigned: assigned.length, submitted: submitted.size, missing };
  }
  async approveAllMemberSubmissions(taskId: string): Promise<{ success: boolean; approved: number; message?: string }> {
    const pending = this.memberSubmissions.filter(s => s.task_id === taskId && s.status === 'pending');
    for (const s of pending) s.status = 'approved';
    return { success: true, approved: pending.length };
  }

  async cloneCriteriaSetFromPreviousYear(targetYear: number): Promise<{ success: boolean }> {
    const newSet: DbCriteriaSet = {
      id: `crit_set_${targetYear}_cloned`,
      year: targetYear,
      name: `Bộ Tiêu chí Đánh giá Chất lượng Hoạt động Đoàn Cơ sở năm ${targetYear} (Nhân bản)`,
      issuing_unit: 'Ban Thường vụ Đoàn xã Hòa Bình',
    };
    this.criteriaSets.push(newSet);
    return { success: true };
  }

  async importCriteriaTree(payload: {
    set: { name: string; year: number; issuing_unit: string };
    sections: Array<{ id: string; stt: number; name: string }>;
    criteria: Array<{ id: string; section_id: string; stt: number; name: string }>;
    subCriteria: Array<{
      id: string;
      criterion_id: string;
      condition_text: string;
      max_score: number;
      evaluation_method: string;
      evidence_requirement: string;
      scoring_rule: string;
      deadline: string;
      unit_type_id: UnitTypeId | null;
      unit_id: string | null;
      unit_type_ids: UnitTypeId[];
      unit_ids: string[];
      note?: string;
    }>;
  }): Promise<{ success: boolean; message?: string; criteriaSetId?: string }> {
    if (!payload.sections.length) {
      return { success: false, message: 'Bộ tiêu chí rỗng, không có Phần nào để nhập' };
    }
    const setId = `crit_set_${payload.set.year}_import_${this.criteriaSets.length + 1}`;
    this.criteriaSets.push({
      id: setId,
      year: payload.set.year,
      name: payload.set.name,
      issuing_unit: payload.set.issuing_unit,
    });

    // Ghi lại id cũ -> id mới để nối quan hệ cha/con đúng
    const secIdMap = new Map<string, string>();
    payload.sections.forEach((s, i) => {
      const newId = `sec_imp_${setId}_${i + 1}`;
      secIdMap.set(s.id, newId);
      this.criteriaSections.push({ id: newId, criteria_set_id: setId, stt: s.stt, name: s.name });
    });

    const critIdMap = new Map<string, string>();
    payload.criteria.forEach((c, i) => {
      const newId = `crit_imp_${setId}_${i + 1}`;
      critIdMap.set(c.id, newId);
      this.criteria.push({
        id: newId,
        section_id: secIdMap.get(c.section_id) ?? c.section_id,
        stt: c.stt,
        name: c.name,
      });
    });

    payload.subCriteria.forEach((sc, i) => {
      this.subCriteria.push({
        id: `subcrit_imp_${setId}_${i + 1}`,
        criterion_id: critIdMap.get(sc.criterion_id) ?? sc.criterion_id,
        condition_text: sc.condition_text,
        max_score: sc.max_score,
        evaluation_method: sc.evaluation_method,
        evidence_requirement: sc.evidence_requirement,
        scoring_rule: sc.scoring_rule,
        deadline: sc.deadline,
        unit_type_id: sc.unit_type_id,
        unit_id: sc.unit_id,
        unit_type_ids: sc.unit_type_ids ?? [],
        unit_ids: sc.unit_ids ?? [],
        note: sc.note,
      });
    });

    return { success: true, criteriaSetId: setId };
  }

  // 8. Nhắc nhở
  async listWarnings(tab: 'open' | 'resolved') {
    const list = this.warnings.filter(w => (tab === 'open' ? !w.resolved_at : !!w.resolved_at));
    return list.map(w => {
      const unit = this.units.find(u => u.id === w.unit_id) || null;
      const task = w.task_id ? this.tasks.find(t => t.id === w.task_id) || null : null;
      const subCriterion = w.sub_criterion_id ? this.subCriteria.find(c => c.id === w.sub_criterion_id) || null : null;
      return { warning: w, unit, task, subCriterion };
    });
  }

  async resolveWarning(warningId: string): Promise<{ success: boolean }> {
    const w = this.warnings.find(item => item.id === warningId);
    if (w) {
      w.resolved_at = new Date().toISOString();
      return { success: true };
    }
    return { success: false };
  }

  async sendNotification(input: {
    recipientType: 'unit' | 'type' | 'units' | 'member';
    unitId?: string;
    unitIds?: string[];
    memberId?: string;
    unitType?: UnitTypeId;
    title: string;
    content: string;
    level: 'yellow' | 'orange' | 'red';
    taskId?: string;
    subCriterionId?: string;
  }): Promise<{ sentCount: number; recipients: string[] }> {
    const recipientUnits =
      input.recipientType === 'unit' && input.unitId
        ? this.units.filter(u => u.id === input.unitId)
        : input.recipientType === 'units' && input.unitIds
        ? this.units.filter(u => input.unitIds!.includes(u.id))
        : input.recipientType === 'type' && input.unitType
        ? this.units.filter(u => u.unit_type_id === input.unitType && u.is_active)
        : this.units.filter(u => u.is_active);

    recipientUnits.forEach(u => {
      this.notifications.unshift({
        id: `notif_${Date.now()}_${u.id}`,
        recipient_id: u.id,
        type: 'reminder',
        level: input.level,
        title: input.title,
        body: input.content,
        task_id: input.taskId || null,
        sub_criterion_id: input.subCriterionId || null,
        is_read: false,
        created_at: new Date().toISOString(),
      });
    });

    return {
      sentCount: recipientUnits.length,
      recipients: recipientUnits.map(u => u.name),
    };
  }

  // 9. Báo cáo
  async listReports(): Promise<DbReport[]> {
    return [...this.reports];
  }

  async createReport(input: {
    title: string;
    type: ReportType;
    periodStart: string;
    periodEnd: string;
    unitId: string | null;
    data: Record<string, unknown>;
    createdBy: string;
  }): Promise<DbReport> {
    const newRep: DbReport = {
      id: `rep_${Date.now()}`,
      title: input.title,
      report_type: input.type,
      type: input.type,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      unit_id: input.unitId,
      data: JSON.parse(JSON.stringify(input.data)), // Deep clone snapshot
      created_by: input.createdBy,
      created_at: new Date().toISOString(),
    };
    this.reports.unshift(newRep);
    return newRep;
  }

  // 10. Cấu hình
  async getYearlySettings(): Promise<DbYearlySettings> {
    return { ...this.yearlySettings };
  }

  async updateYearlySettings(_year: number, updates: Partial<DbYearlySettings>): Promise<{ success: boolean }> {
    this.yearlySettings = { ...this.yearlySettings, ...updates };
    return { success: true };
  }

  async listUnitTypes(): Promise<DbUnitType[]> {
    return [...this.unitTypes];
  }

  async saveUnitType(id: UnitTypeId, name: string): Promise<{ success: boolean }> {
    const idx = this.unitTypes.findIndex(t => t.id === id);
    if (idx !== -1) {
      this.unitTypes[idx].name = name;
    } else {
      this.unitTypes.push({ id, name });
    }
    return { success: true };
  }

  async deleteUnitType(id: UnitTypeId): Promise<{ success: boolean; message?: string }> {
    const inUse = this.units.some(u => u.unit_type_id === id);
    if (inUse) {
      return { success: false, message: 'Loại chi đoàn này đang được sử dụng, không thể xóa!' };
    }
    this.unitTypes = this.unitTypes.filter(t => t.id !== id);
    return { success: true };
  }

  async listEthnicities(): Promise<DbEthnicity[]> {
    return [...this.ethnicities];
  }

  // 11. Tài khoản & Phân quyền
  async listProfiles() {
    return this.profiles.map(p => {
      const m = this.members.find(mem => mem.id === p.member_id) || null;
      return { profile: p, member: m };
    });
  }

  async setProfileRole(profileId: string, roleId: RoleId): Promise<{ success: boolean }> {
    const prof = this.profiles.find(p => p.id === profileId);
    if (prof) {
      prof.role_id = roleId;
      return { success: true };
    }
    return { success: false };
  }

  async toggleProfileActive(profileId: string): Promise<{ success: boolean }> {
    const prof = this.profiles.find(p => p.id === profileId);
    if (prof) {
      prof.is_active = !prof.is_active;
      return { success: true };
    }
    return { success: false };
  }

  async linkProfileMember(profileId: string, memberId: string): Promise<{ success: boolean }> {
    const prof = this.profiles.find(p => p.id === profileId);
    if (prof) {
      prof.member_id = memberId;
      return { success: true };
    }
    return { success: false };
  }

  // 12. Nhật ký
  async listAuditLogs(filters?: { search?: string; action?: string; actorId?: string }) {
    let result = this.auditLogs;
    if (filters?.actorId && filters.actorId !== 'all') {
      result = result.filter(l => l.actor_id === filters.actorId);
    }
    if (filters?.action && filters.action !== 'all') {
      result = result.filter(l => l.action.toLowerCase().includes(filters.action!.toLowerCase()));
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        l =>
          l.action.toLowerCase().includes(q) ||
          l.table_name.toLowerCase().includes(q) ||
          (l.new_value || '').toLowerCase().includes(q)
      );
    }

    return result.map(log => {
      const actor = this.members.find(m => m.id === log.actor_id) || null;
      return {
        log,
        actor,
        diffSummary: {
          oldValue: log.old_value,
          newValue: log.new_value,
        },
      };
    });
  }

  async getRawSnapshot() {
    return {
      roles: this.roles,
      unitTypes: this.unitTypes,
      ethnicities: this.ethnicities,
      units: this.units,
      members: this.members,
      profiles: this.profiles,
      criteriaSets: this.criteriaSets,
      criteriaSections: this.criteriaSections,
      criteria: this.criteria,
      subCriteria: this.subCriteria,
      criterionSubmissions: this.criterionSubmissions,
      tasks: this.tasks,
      taskUnits: this.taskUnits,
      taskRegistrations: this.taskRegistrations,
      taskSubCriteria: this.taskSubCriteria,
      taskResults: this.taskResults,
      evidences: this.evidences,
      notifications: this.notifications,
      warnings: this.warnings,
      unitCommittees: this.unitCommittees,
      reports: this.reports,
      yearlySettings: this.yearlySettings,
      auditLogs: this.auditLogs,
      memberSubmissions: this.memberSubmissions,
    };
  }
}

// Singleton repository instance
export const mockRepository = new MockRepository();
