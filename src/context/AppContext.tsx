import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import {
  RoleId,
  DbTaskResult as TaskResult,
  DbMemberSubmission as MemberSubmission,
  DbJournalEntry as JournalEntry,
  DbCriterionSubmission as CriterionSubmission,
  DbEvidence as Evidence,
  DbNotification as Notification,
  DbWarning as Warning,
  DbAuditLog as AuditLog,
  DbUnit as Unit,
  DbMember as Member,
  DbTask as Task,
  DbSubCriterion as SubCriterion,
  DbYearlySettings as YearlySettings,
  DbCriterion as Criterion,
  DbCriteriaSection as CriteriaSection,
  DbCriteriaSet as CriteriaSet,
  DbTaskUnit as TaskUnit,
  DbTaskRegistration as TaskRegistration,
  DbTaskSubCriterion as TaskSubCriterion,
  DbUnitCommittee as UnitCommittee,
  UnitTypeId,
  DbUnitType as UnitType,
  DbEthnicity as Ethnicity,
  DbProfile as Profile,
  DbReport as Report,
  ReportType,
  CommitteePosition,
  UnitScoreCalculation,
} from '../data/types';
import { repository } from '../data';
import type { EvidenceInput } from '../data/repository';
import { formatDateVN, formatDateTimeVN, keyMemberIds } from '../mock/data';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type: 'success' | 'error' | 'info';
  canUndo?: boolean;
  onUndo?: () => void;
  durationMs?: number;
}

interface AppContextType {
  // Phân quyền & Năm
  currentRole: RoleId;
  setCurrentRole: (role: RoleId) => void;
  selectedYear: number;
  setSelectedYear: (year: number) => void;

  // Người dùng đang đăng nhập (null ở chế độ mock)
  currentUser: {
    profileId: string;
    email: string | null;
    role: RoleId;
    memberId: string | null;
    isActive: boolean;
  } | null;
  /** Thành viên (đoàn viên) gắn với tài khoản đang đăng nhập. */
  currentMember: Member | null;

  // Đăng ký tự phục vụ (đăng nhập Google lần đầu)
  getSignupOptions: () => ReturnType<typeof repository.getSignupOptions>;

  // Sổ tay cá nhân (riêng tư tuyệt đối)
  journalEntries: JournalEntry[];
  refreshJournal: () => Promise<void>;
  saveJournalEntry: (input: Parameters<typeof repository.saveJournalEntry>[0]) => ReturnType<typeof repository.saveJournalEntry>;
  deleteJournalEntry: (id: string) => ReturnType<typeof repository.deleteJournalEntry>;
  uploadJournalImage: (file: File) => ReturnType<typeof repository.uploadJournalImage>;
  selfRegisterMember: (input: Parameters<typeof repository.selfRegisterMember>[0]) =>
    ReturnType<typeof repository.selfRegisterMember>;

  // Nộp minh chứng (phía chi đoàn)
  listMyTodo: (unitId: string) => ReturnType<typeof repository.listMyTodo>;
  uploadEvidence: (file: File, unitId: string) => Promise<{ url: string; storagePath: string }>;
  submitTaskResult: (input: {
    taskId: string; unitId: string; participantCount: number; note?: string;
    lat: number | null; lng: number | null; isOverdue: boolean;
    evidences: EvidenceInput[];
  }) => Promise<{ success: boolean; message?: string; resultId?: string }>;
  submitCriterionSubmission: (input: {
    subCriterionId: string; unitId: string; selfScore: number; note?: string;
    evidences: EvidenceInput[];
  }) => Promise<{ success: boolean; message?: string; submissionId?: string }>;

  // Tự phục vụ: sửa hồ sơ cá nhân + bảng tin nhiệm vụ
  updateMyProfile: (updates: Partial<Member>) => Promise<{ success: boolean; message?: string }>;
  uploadMyAvatar: (file: File) => ReturnType<typeof repository.uploadMyAvatar>;
  listMyFeed: () => ReturnType<typeof repository.listMyFeed>;
  setTaskRegistration: (taskId: string, isJoining: boolean) => Promise<{ success: boolean; message?: string }>;

  // Nộp minh chứng cá nhân (đoàn viên) + duyệt cấp chi đoàn
  submitMemberResult: (input: {
    taskId: string; note?: string; lat: number | null; lng: number | null;
    evidences: EvidenceInput[];
  }) => Promise<{ success: boolean; message?: string; submissionId?: string }>;
  reviewMemberSubmission: (id: string, approve: boolean, note?: string) => Promise<{ success: boolean; message?: string }>;
  listMemberSubmissionEvidences: (submissionId: string) => Promise<Evidence[]>;
  listTaskParticipants: (taskId: string, unitId: string) => ReturnType<typeof repository.listTaskParticipants>;
  listTaskParticipantsAll: (taskId: string) => ReturnType<typeof repository.listTaskParticipantsAll>;

  // Dữ liệu đọc từ Repository
  units: Unit[];
  unitTypes: UnitType[];
  ethnicities: Ethnicity[];
  members: Member[];
  profiles: Profile[];
  tasks: Task[];
  taskUnits: TaskUnit[];
  taskRegistrations: TaskRegistration[];
  taskSubCriteria: TaskSubCriterion[];
  subCriteria: SubCriterion[];
  criteria: Criterion[];
  criteriaSections: CriteriaSection[];
  criteriaSet: CriteriaSet;
  criteriaSets: CriteriaSet[];
  taskResults: TaskResult[];
  memberSubmissions: MemberSubmission[];
  criterionSubmissions: CriterionSubmission[];
  evidences: Evidence[];
  notifications: Notification[];
  warnings: Warning[];
  auditLogs: AuditLog[];
  unitCommittees: UnitCommittee[];
  reports: Report[];
  yearlySettings: YearlySettings;

  // Tìm kiếm toàn cục
  globalSearch: string;
  setGlobalSearch: (q: string) => void;

  // Thống kê tính toán sẵn từ Repository
  pendingCount: number;
  taskPendingCount: number;
  criteriaPendingCount: number;
  overdueUnitsCount: number;
  dueSoon7DaysCount: number;
  newMembersCount: number;
  totalMembers: number;

  // Thao tác duyệt qua Repository
  approveTaskResult: (resultId: string, reviewNote?: string) => Promise<{ success: boolean; message?: string }>;
  rejectTaskResult: (resultId: string, reviewNote: string) => Promise<{ success: boolean; message?: string }>;
  approveCriterionSubmission: (submissionId: string, approvedScore: number, reviewNote?: string) => Promise<{ success: boolean; message?: string }>;
  rejectCriterionSubmission: (submissionId: string, reviewNote: string) => Promise<{ success: boolean; message?: string }>;

  // Quản lý Nhiệm vụ qua Repository
  createTask: (
    taskData: Omit<Task, 'id' | 'assigned_by' | 'assigned_at' | 'closed_by' | 'closed_at'>,
    unitIds: string[],
    subCriteriaContributions: Array<{ sub_criterion_id: string; contribution_score: number }>
  ) => Promise<Task>;
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  closeTask: (taskId: string) => Promise<{ success: boolean; message?: string }>;
  deleteTask: (taskId: string) => Promise<{ success: boolean; message?: string }>;
  cloneTask: (taskId: string) => Promise<Task | null>;
  remindAllUnsubmitted: (taskId: string) => Promise<number>;
  saveTaskSubCriteria: (taskId: string, items: Array<{ sub_criterion_id: string; contribution_score: number }>) => Promise<{ success: boolean; message?: string }>;
  countUnitsWithoutResult: (taskId: string) => ReturnType<typeof repository.countUnitsWithoutResult>;
  approveAllMemberSubmissions: (taskId: string) => ReturnType<typeof repository.approveAllMemberSubmissions>;
  remindUnit: (taskId: string, unitId: string) => Promise<void>;

  // Quản lý Tiêu chí qua Repository
  createCriteriaSection: (name: string) => Promise<void>;
  updateCriteriaSection: (sectionId: string, name: string) => Promise<void>;
  deleteCriteriaSection: (sectionId: string) => Promise<{ success: boolean; message?: string }>;
  createCriterion: (sectionId: string, name: string) => Promise<void>;
  updateCriterion: (criterionId: string, name: string) => Promise<void>;
  deleteCriterion: (criterionId: string) => Promise<{ success: boolean; message?: string }>;
  createSubCriterion: (subCriterionData: Omit<SubCriterion, 'id'>) => Promise<void>;
  updateSubCriterion: (subCriterionId: string, updates: Partial<SubCriterion>) => Promise<void>;
  deleteSubCriterion: (subCriterionId: string) => Promise<{ success: boolean; message?: string }>;
  reorderSections: (startIndex: number, endIndex: number) => Promise<void>;
  reorderCriteria: (sectionId: string, startIndex: number, endIndex: number) => Promise<void>;
  reorderSubCriteria: (criterionId: string, startIndex: number, endIndex: number) => Promise<void>;
  cloneCriteriaSetFromPreviousYear: () => Promise<void>;
  deleteCriteriaSet: (criteriaSetId: string) => Promise<{ success: boolean; message?: string }>;
  restoreCriteriaSet: (criteriaSetId: string) => Promise<{ success: boolean; message?: string }>;
  getCriteriaSetImpact: (criteriaSetId: string) => ReturnType<typeof repository.getCriteriaSetImpact>;
  purgeCriteriaSet: (criteriaSetId: string) => Promise<{
    success: boolean; message?: string;
    deletedSubmissions?: number; deletedEvidences?: number; deletedFiles?: number;
  }>;
  setActiveCriteriaSet: (id: string) => void;
  importCriteriaTree: (payload: {
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
  }) => Promise<{ success: boolean; message?: string; criteriaSetId?: string }>;

  // Quản lý Nhắc nhở qua Repository
  resolveWarning: (warningId: string) => Promise<void>;
  syncWarnings: () => Promise<{ created: number }>;
  sendManualReminder: (payload: {
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
  }) => Promise<{ count: number; recipients: string[] }>;

  // Quản lý Chi đoàn qua Repository
  updateUnit: (unitId: string, updates: Partial<Unit>) => Promise<void>;
  deactivateUnit: (unitId: string) => Promise<{ success: boolean; message?: string }>;
  createUnit: (input: {
    name: string;
    unit_type_id: UnitTypeId;
    note?: string;
    union_member_count?: number;
    youth_count?: number;
  }) => Promise<{ success: boolean; message?: string; unit?: Unit }>;
  deleteUnit: (unitId: string) => Promise<{ success: boolean; message?: string }>;

  // Quản lý Đoàn viên qua Repository
  createMember: (memberData: Omit<Member, 'id'>) => Promise<{ success: boolean; message?: string; member?: Member }>;
  updateMember: (memberId: string, updates: Partial<Member>) => Promise<{ success: boolean; message?: string }>;
  deleteMember: (memberId: string) => Promise<void>;
  bulkImportMembers: (newMembers: Array<Omit<Member, 'id'>>) => Promise<number>;

  // Quản lý Ban chấp hành qua Repository
  addCommitteeMember: (
    memberId: string,
    unitId: string | null,
    position: CommitteePosition,
    isStanding: boolean,
    termStart: string
  ) => Promise<{ success: boolean; message?: string }>;
  endCommitteeTerm: (committeeId: string) => Promise<void>;

  // Quản lý Báo cáo qua Repository
  createReportSnapshot: (
    type: ReportType,
    periodStart: string,
    periodEnd: string,
    unitId: string | null,
    data: Record<string, unknown>
  ) => Promise<Report>;

  // Cấu hình & Hệ thống qua Repository
  updateYearlySettings: (updates: Partial<YearlySettings>) => Promise<void>;
  createUnitType: (name: string) => Promise<void>;
  updateUnitType: (id: UnitTypeId, name: string) => Promise<void>;
  deleteUnitType: (id: UnitTypeId) => Promise<{ success: boolean; message?: string }>;
  updateProfileRole: (profileId: string, newRole: RoleId) => Promise<void>;
  toggleProfileActive: (profileId: string) => Promise<void>;
  linkProfileMember: (profileId: string, memberId: string) => Promise<void>;

  // Quản lý thông báo & làm mới
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  lastUpdated: string;
  refreshData: () => Promise<void>;

  // Toast
  toasts: ToastMessage[];
  showToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;

  // Helpers
  getUnitById: (id: string | null | undefined) => Unit | undefined;
  getMemberById: (id: string | null | undefined) => Member | undefined;
  getTaskById: (id: string | null | undefined) => Task | undefined;
  getSubCriterionById: (id: string | null | undefined) => SubCriterion | undefined;
  getCriterionById: (id: string | null | undefined) => Criterion | undefined;
  getSectionById: (id: string | null | undefined) => CriteriaSection | undefined;
  getEvidencesByResultId: (resultId: string) => Evidence[];
  getEvidencesBySubmissionId: (submissionId: string) => Evidence[];
  calculateUnitScores: () => UnitScoreCalculation[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Mặc định quyền THẤP NHẤT: trước khi đọc xong profile, đoàn viên không được
  // tạm thấy giao diện quản trị. refreshData() sẽ gán đúng vai trò thật.
  const [currentRole, setCurrentRole] = useState<RoleId>('member');
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toISOString());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Tables cached from repo
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitTypes, setUnitTypes] = useState<UnitType[]>([]);
  const [ethnicities, setEthnicities] = useState<Ethnicity[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskUnits, setTaskUnits] = useState<TaskUnit[]>([]);
  const [taskRegistrations, setTaskRegistrations] = useState<TaskRegistration[]>([]);
  const [taskSubCriteria, setTaskSubCriteria] = useState<TaskSubCriterion[]>([]);
  const [subCriteria, setSubCriteria] = useState<SubCriterion[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [criteriaSections, setCriteriaSections] = useState<CriteriaSection[]>([]);
  const [criteriaSets, setCriteriaSets] = useState<CriteriaSet[]>([]);
  // Ref giữ danh sách bộ mới nhất để setActiveCriteriaSet đọc được ngay sau refreshData
  const criteriaSetsRef = useRef<CriteriaSet[]>([]);
  useEffect(() => {
    criteriaSetsRef.current = criteriaSets;
  }, [criteriaSets]);
  const [criteriaSet, setCriteriaSet] = useState<CriteriaSet>({
    id: 'crit_set_2026',
    year: 2026,
    name: 'Bộ Tiêu chí Đánh giá Chất lượng Hoạt động Đoàn Cơ sở năm 2026',
    issuing_unit: 'Ban Thường vụ Huyện Đoàn & Đoàn xã Hòa Bình',
  });
  const [taskResults, setTaskResults] = useState<TaskResult[]>([]);
  const [memberSubmissions, setMemberSubmissions] = useState<MemberSubmission[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [criterionSubmissions, setCriterionSubmissions] = useState<CriterionSubmission[]>([]);
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [unitCommittees, setUnitCommittees] = useState<UnitCommittee[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [yearlySettings, setYearlySettings] = useState<YearlySettings>({
    year: 2026,
    criteria_set_id: 'crit_set_2026',
    matured_age: 30,
    new_member_target: 40,
    max_photos: 3,
    max_files: 3,
    max_links: 5,
    require_gps: true,
  });

  // Cached calculated stats from repo
  const [stats, setStats] = useState({
    pendingCount: 0,
    taskPendingCount: 0,
    criteriaPendingCount: 0,
    overdueUnitsCount: 0,
    dueSoon7DaysCount: 0,
    newMembersCount: 0,
    totalMembers: 0,
  });

  const [unitScores, setUnitScores] = useState<UnitScoreCalculation[]>([]);

  // Người dùng đang đăng nhập (chế độ Supabase)
  const [currentUser, setCurrentUser] = useState<AppContextType['currentUser']>(null);

  // Function to pull all data fresh from repository
  const refreshData = useCallback(async () => {
    const snap = await repository.getRawSnapshot();
    setRolesData(snap);
    // Người dùng đăng nhập: lấy bản mới (force) để đổi tài khoản là cập nhật ngay
    const user = await repository.getCurrentUser(true);
    setCurrentUser(user);
    if (user) setCurrentRole(user.role);
    const dbStats = await repository.getDashboard(selectedYear);
    setStats({
      pendingCount: dbStats.pendingCount,
      taskPendingCount: dbStats.taskPendingCount,
      criteriaPendingCount: dbStats.criteriaPendingCount,
      overdueUnitsCount: dbStats.overdueUnitsCount,
      dueSoon7DaysCount: dbStats.dueSoon7DaysCount,
      newMembersCount: dbStats.newMembersCount,
      totalMembers: dbStats.totalMembers,
    });
    const scores = await repository.calculateUnitScores(selectedYear);
    setUnitScores(scores);
    setLastUpdated(new Date().toISOString());
  }, [selectedYear]);

  const setRolesData = (snap: any) => {
    setUnits(snap.units);
    setUnitTypes(snap.unitTypes);
    setEthnicities(snap.ethnicities);
    setMembers(snap.members);
    setProfiles(snap.profiles);
    setTasks(snap.tasks);
    setTaskUnits(snap.taskUnits);
    setTaskRegistrations(snap.taskRegistrations);
    setTaskSubCriteria(snap.taskSubCriteria);
    setSubCriteria(snap.subCriteria);
    setCriteria(snap.criteria);
    setCriteriaSections(snap.criteriaSections);
    setCriteriaSets(snap.criteriaSets);
    criteriaSetsRef.current = snap.criteriaSets;
    if (snap.criteriaSets.length > 0) {
      // Giữ bộ đang chọn nếu nó vẫn tồn tại; ngược lại chọn bộ đầu
      setCriteriaSet(prev => snap.criteriaSets.find((s: CriteriaSet) => s.id === prev.id) ?? snap.criteriaSets[0]);
    }
    setTaskResults(snap.taskResults);
    setMemberSubmissions(snap.memberSubmissions ?? []);
    setCriterionSubmissions(snap.criterionSubmissions);
    setEvidences(snap.evidences);
    setNotifications(snap.notifications);
    setWarnings(snap.warnings);
    setUnitCommittees(snap.unitCommittees);
    setReports(snap.reports);
    setYearlySettings(snap.yearlySettings);
    setAuditLogs(snap.auditLogs);
  };

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Toast
  const showToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newToast: ToastMessage = { ...toast, id };
    setToasts(prev => [...prev, newToast]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, toast.durationMs || 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Notifications
  const markNotificationAsRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
    );
  }, []);

  const markAllNotificationsAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  }, []);

  // Reviews
  const approveTaskResult = useCallback(
    async (resultId: string, reviewNote?: string) => {
      const res = await repository.approve('task', resultId, keyMemberIds.phoBiThu1, undefined, reviewNote);
      if (res.success) await refreshData();
      return res;
    },
    [refreshData]
  );

  const rejectTaskResult = useCallback(
    async (resultId: string, reviewNote: string) => {
      const res = await repository.reject('task', resultId, keyMemberIds.phoBiThu1, reviewNote);
      if (res.success) await refreshData();
      return res;
    },
    [refreshData]
  );

  const approveCriterionSubmission = useCallback(
    async (submissionId: string, approvedScore: number, reviewNote?: string) => {
      const res = await repository.approve('criterion', submissionId, keyMemberIds.phoBiThu1, approvedScore, reviewNote);
      if (res.success) await refreshData();
      return res;
    },
    [refreshData]
  );

  const rejectCriterionSubmission = useCallback(
    async (submissionId: string, reviewNote: string) => {
      const res = await repository.reject('criterion', submissionId, keyMemberIds.phoBiThu1, reviewNote);
      if (res.success) await refreshData();
      return res;
    },
    [refreshData]
  );

  // Tasks
  const createTask = useCallback(
    async (
      taskData: Omit<Task, 'id' | 'assigned_by' | 'assigned_at' | 'closed_by' | 'closed_at'>,
      unitIds: string[],
      subCriteriaContributions: Array<{ sub_criterion_id: string; contribution_score: number }>
    ) => {
      const created = await repository.createTask({
        taskData,
        unitIds,
        subCriteriaContributions,
      });
      await refreshData();
      return created;
    },
    [refreshData]
  );

  const updateTask = useCallback(
    async (taskId: string, updates: Partial<Task>) => {
      const snap = await repository.getRawSnapshot();
      const task = snap.tasks.find(t => t.id === taskId);
      if (task) {
        Object.assign(task, updates);
      }
      await refreshData();
    },
    [refreshData]
  );

  const closeTask = useCallback(
    async (taskId: string) => {
      const res = await repository.closeTask(taskId);
      if (res.success) await refreshData();
      return res;
    },
    [refreshData]
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      const res = await repository.deleteTask(taskId);
      if (res.success) {
        await refreshData();
      }
      return res;
    },
    [refreshData]
  );

  const cloneTask = useCallback(
    async (taskId: string) => {
      const res = await repository.cloneTask(taskId);
      await refreshData();
      return res;
    },
    [refreshData]
  );

  const remindAllUnsubmitted = useCallback(
    async (taskId: string) => {
      const res = await repository.remindAllUnsubmitted(taskId);
      await refreshData();
      return res.remindedCount;
    },
    [refreshData]
  );

  const saveTaskSubCriteria = useCallback(
    async (taskId: string, items: Array<{ sub_criterion_id: string; contribution_score: number }>) => {
      const res = await repository.setTaskSubCriteria(taskId, items);
      if (res.success) await refreshData();
      return res;
    },
    [refreshData]
  );

  const countUnitsWithoutResult = useCallback(
    (taskId: string) => repository.countUnitsWithoutResult(taskId),
    []
  );

  const approveAllMemberSubmissions = useCallback(
    async (taskId: string) => {
      const res = await repository.approveAllMemberSubmissions(taskId);
      if (res.success) await refreshData();
      return res;
    },
    [refreshData]
  );

  const remindUnit = useCallback(
    async (taskId: string, unitId: string) => {
      await repository.remindUnit(taskId, unitId);
      await refreshData();
    },
    [refreshData]
  );

  // Criteria
  const createCriteriaSection = useCallback(
    async (name: string) => {
      await repository.saveCriteriaNode('section', 'create', {
        criteria_set_id: criteriaSet.id,
        stt: criteriaSections.length + 1,
        name,
      });
      await refreshData();
    },
    [criteriaSet.id, criteriaSections.length, refreshData]
  );

  const updateCriteriaSection = useCallback(
    async (sectionId: string, name: string) => {
      await repository.saveCriteriaNode('section', 'update', { id: sectionId, name });
      await refreshData();
    },
    [refreshData]
  );

  const deleteCriteriaSection = useCallback(
    async (sectionId: string) => {
      const res = await repository.saveCriteriaNode('section', 'delete', { id: sectionId });
      if (res.success) await refreshData();
      return res;
    },
    [refreshData]
  );

  const createCriterion = useCallback(
    async (sectionId: string, name: string) => {
      await repository.saveCriteriaNode('criterion', 'create', {
        section_id: sectionId,
        stt: criteria.length + 1,
        name,
      });
      await refreshData();
    },
    [criteria.length, refreshData]
  );

  const updateCriterion = useCallback(
    async (criterionId: string, name: string) => {
      await repository.saveCriteriaNode('criterion', 'update', { id: criterionId, name });
      await refreshData();
    },
    [refreshData]
  );

  const deleteCriterion = useCallback(
    async (criterionId: string) => {
      const res = await repository.saveCriteriaNode('criterion', 'delete', { id: criterionId });
      if (res.success) await refreshData();
      return res;
    },
    [refreshData]
  );

  const createSubCriterion = useCallback(
    async (subCriterionData: Omit<SubCriterion, 'id'>) => {
      await repository.saveCriteriaNode('subCriterion', 'create', subCriterionData);
      await refreshData();
    },
    [refreshData]
  );

  const updateSubCriterion = useCallback(
    async (subCriterionId: string, updates: Partial<SubCriterion>) => {
      await repository.saveCriteriaNode('subCriterion', 'update', { id: subCriterionId, ...updates });
      await refreshData();
    },
    [refreshData]
  );

  const deleteSubCriterion = useCallback(
    async (subCriterionId: string) => {
      const res = await repository.saveCriteriaNode('subCriterion', 'delete', { id: subCriterionId });
      if (res.success) await refreshData();
      return res;
    },
    [refreshData]
  );

  const reorderSections = useCallback(
    async (startIndex: number, endIndex: number) => {
      await repository.reorderCriteriaNodes('section', criteriaSet.id, startIndex, endIndex);
      await refreshData();
    },
    [criteriaSet.id, refreshData]
  );

  const reorderCriteria = useCallback(
    async (sectionId: string, startIndex: number, endIndex: number) => {
      await repository.reorderCriteriaNodes('criterion', sectionId, startIndex, endIndex);
      await refreshData();
    },
    [refreshData]
  );

  const reorderSubCriteria = useCallback(
    async (criterionId: string, startIndex: number, endIndex: number) => {
      await repository.reorderCriteriaNodes('subCriterion', criterionId, startIndex, endIndex);
      await refreshData();
    },
    [refreshData]
  );

  const deleteCriteriaSet = useCallback(
    async (criteriaSetId: string) => {
      const res = await repository.deleteCriteriaSet(criteriaSetId);
      if (res.success) {
        // Bộ đang soạn bị xóa -> chọn bộ còn lại (refreshData giữ bộ đang chọn nếu còn tồn tại)
        const remaining = criteriaSetsRef.current.filter(s => s.id !== criteriaSetId);
        if (remaining.length > 0) setCriteriaSet(remaining[0]);
        await refreshData();
      }
      return res;
    },
    [refreshData]
  );

  const restoreCriteriaSet = useCallback(
    async (criteriaSetId: string) => {
      const res = await repository.restoreCriteriaSet(criteriaSetId);
      if (res.success) await refreshData();
      return res;
    },
    [refreshData]
  );

  const getCriteriaSetImpact = useCallback(
    (criteriaSetId: string) => repository.getCriteriaSetImpact(criteriaSetId),
    []
  );

  const purgeCriteriaSet = useCallback(
    async (criteriaSetId: string) => {
      const res = await repository.purgeCriteriaSet(criteriaSetId);
      if (res.success) await refreshData();
      return res;
    },
    [refreshData]
  );

  const cloneCriteriaSetFromPreviousYear = useCallback(async () => {
    await repository.cloneCriteriaSetFromPreviousYear(2027);
    await refreshData();
  }, [refreshData]);

  const setActiveCriteriaSet = useCallback((id: string) => {
    const found = criteriaSetsRef.current.find(s => s.id === id);
    if (found) setCriteriaSet(found);
  }, []);

  const importCriteriaTree = useCallback(
    async (payload: {
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
    }) => {
      const res = await repository.importCriteriaTree(payload);
      if (res.success) await refreshData();
      return res;
    },
    [refreshData]
  );

  // Warnings
  const resolveWarning = useCallback(
    async (warningId: string) => {
      await repository.resolveWarning(warningId);
      await refreshData();
    },
    [refreshData]
  );

  const syncWarnings = useCallback(
    async () => {
      const res = await repository.syncWarnings();
      if (res.created > 0) await refreshData();
      return res;
    },
    [refreshData]
  );

  const sendManualReminder = useCallback(
    async (payload: any) => {
      const res = await repository.sendNotification(payload);
      await refreshData();
      return { count: res.sentCount, recipients: res.recipients };
    },
    [refreshData]
  );

  // Nộp minh chứng
  const listMyTodo = useCallback((unitId: string) => repository.listMyTodo(unitId), []);

  const uploadEvidence = useCallback(
    (file: File, unitId: string) => repository.uploadEvidence(file, unitId),
    []
  );

  const submitTaskResult = useCallback(
    async (input: {
      taskId: string; unitId: string; participantCount: number; note?: string;
      lat: number | null; lng: number | null; isOverdue: boolean;
      evidences: EvidenceInput[];
    }) => {
      const res = await repository.submitTaskResult(input);
      if (res.success) await refreshData();
      return res;
    },
    [refreshData]
  );

  const submitCriterionSubmission = useCallback(
    async (input: {
      subCriterionId: string; unitId: string; selfScore: number; note?: string;
      evidences: EvidenceInput[];
    }) => {
      const res = await repository.submitCriterionSubmission(input);
      if (res.success) await refreshData();
      return res;
    },
    [refreshData]
  );

  // Tự phục vụ
  const updateMyProfile = useCallback(
    async (updates: Partial<Member>) => {
      const res = await repository.updateMyProfile(updates);
      if (res.success) await refreshData();
      return res;
    },
    [refreshData]
  );

  const getSignupOptions = useCallback(() => repository.getSignupOptions(), []);

  // Sổ tay: KHÔNG nằm trong snapshot chung (dữ liệu riêng tư), tải riêng khi mở trang
  const refreshJournal = useCallback(async () => {
    try {
      setJournalEntries(await repository.listJournalEntries());
    } catch {
      setJournalEntries([]);
    }
  }, []);

  const saveJournalEntry = useCallback(
    async (input: Parameters<typeof repository.saveJournalEntry>[0]) => {
      const res = await repository.saveJournalEntry(input);
      if (res.success) await refreshJournal();
      return res;
    },
    [refreshJournal]
  );

  const deleteJournalEntry = useCallback(
    async (id: string) => {
      const res = await repository.deleteJournalEntry(id);
      if (res.success) await refreshJournal();
      return res;
    },
    [refreshJournal]
  );

  const uploadJournalImage = useCallback(
    (file: File) => repository.uploadJournalImage(file),
    []
  );

  const selfRegisterMember = useCallback(
    async (input: Parameters<typeof repository.selfRegisterMember>[0]) => {
      const res = await repository.selfRegisterMember(input);
      if (res.success) await refreshData();
      return res;
    },
    [refreshData]
  );

  const uploadMyAvatar = useCallback(
    (file: File) => repository.uploadMyAvatar(file),
    []
  );

  const listMyFeed = useCallback(() => repository.listMyFeed(), []);

  const submitMemberResult = useCallback(
    async (input: {
      taskId: string; note?: string; lat: number | null; lng: number | null;
      evidences: EvidenceInput[];
    }) => {
      const res = await repository.submitMemberResult(input);
      if (res.success) await refreshData();
      return res;
    },
    [refreshData]
  );

  const reviewMemberSubmission = useCallback(
    async (id: string, approve: boolean, note?: string) => {
      const res = await repository.reviewMemberSubmission(id, approve, note);
      if (res.success) await refreshData();
      return res;
    },
    [refreshData]
  );

  const listMemberSubmissionEvidences = useCallback(
    (submissionId: string) => repository.listMemberSubmissionEvidences(submissionId),
    []
  );

  const listTaskParticipants = useCallback(
    (taskId: string, unitId: string) => repository.listTaskParticipants(taskId, unitId),
    []
  );

  const listTaskParticipantsAll = useCallback(
    (taskId: string) => repository.listTaskParticipantsAll(taskId),
    []
  );

  const setTaskRegistration = useCallback(
    async (taskId: string, isJoining: boolean) => {
      const res = await repository.setTaskRegistration(taskId, isJoining);
      if (res.success) await refreshData();
      return res;
    },
    [refreshData]
  );

  // Units
  const updateUnit = useCallback(
    async (unitId: string, updates: Partial<Unit>) => {
      await repository.saveUnit(unitId, updates);
      await refreshData();
    },
    [refreshData]
  );

  const deactivateUnit = useCallback(
    async (unitId: string) => {
      const res = await repository.deactivateUnit(unitId);
      if (res.success) await refreshData();
      return res;
    },
    [refreshData]
  );

  const createUnit = useCallback(
    async (input: {
      name: string;
      unit_type_id: UnitTypeId;
      note?: string;
      union_member_count?: number;
      youth_count?: number;
    }) => {
      const res = await repository.createUnit(input);
      if (res.success) await refreshData();
      return res;
    },
    [refreshData]
  );

  const deleteUnit = useCallback(
    async (unitId: string) => {
      const res = await repository.deleteUnit(unitId);
      if (res.success) await refreshData();
      return res;
    },
    [refreshData]
  );

  // Members
  const createMember = useCallback(
    async (memberData: Omit<Member, 'id'>) => {
      const res = await repository.saveMember(memberData);
      if (res.success) await refreshData();
      return res;
    },
    [refreshData]
  );

  const updateMember = useCallback(
    async (memberId: string, updates: Partial<Member>) => {
      const res = await repository.saveMember({ ...updates, id: memberId } as any);
      if (res.success) await refreshData();
      return res;
    },
    [refreshData]
  );

  const deleteMember = useCallback(
    async (memberId: string) => {
      await repository.deleteMember(memberId);
      await refreshData();
    },
    [refreshData]
  );

  const bulkImportMembers = useCallback(
    async (newMembers: Array<Omit<Member, 'id'>>) => {
      const res = await repository.importMembers(newMembers);
      await refreshData();
      return res.importedCount;
    },
    [refreshData]
  );

  // BCH
  const addCommitteeMember = useCallback(
    async (
      memberId: string,
      unitId: string | null,
      position: CommitteePosition,
      isStanding: boolean,
      termStart: string
    ) => {
      const res = await repository.addCommitteeMember({
        memberId,
        unitId,
        position,
        isStanding,
        termStart,
      });
      if (res.success) await refreshData();
      return res;
    },
    [refreshData]
  );

  const endCommitteeTerm = useCallback(
    async (committeeId: string) => {
      await repository.endCommitteeTerm(committeeId);
      await refreshData();
    },
    [refreshData]
  );

  // Reports
  const createReportSnapshot = useCallback(
    async (
      type: ReportType,
      periodStart: string,
      periodEnd: string,
      unitId: string | null,
      data: Record<string, unknown>
    ) => {
      const title = `Báo cáo ${type.toUpperCase()} (${periodStart} đến ${periodEnd})`;
      const created = await repository.createReport({
        title,
        type,
        periodStart,
        periodEnd,
        unitId,
        data,
        createdBy: keyMemberIds.biThuXa,
      });
      await refreshData();
      return created;
    },
    [refreshData]
  );

  // Settings
  const updateYearlySettings = useCallback(
    async (updates: Partial<YearlySettings>) => {
      await repository.updateYearlySettings(selectedYear, updates);
      await refreshData();
    },
    [selectedYear, refreshData]
  );

  const createUnitType = useCallback(
    async (name: string) => {
      const id = (name.toLowerCase().trim().replace(/\s+/g, '_') || 'other') as UnitTypeId;
      await repository.saveUnitType(id, name);
      await refreshData();
    },
    [refreshData]
  );

  const updateUnitType = useCallback(
    async (id: UnitTypeId, name: string) => {
      await repository.saveUnitType(id, name);
      await refreshData();
    },
    [refreshData]
  );

  const deleteUnitType = useCallback(
    async (id: UnitTypeId) => {
      const res = await repository.deleteUnitType(id);
      if (res.success) await refreshData();
      return res;
    },
    [refreshData]
  );

  const updateProfileRole = useCallback(
    async (profileId: string, newRole: RoleId) => {
      await repository.setProfileRole(profileId, newRole);
      await refreshData();
    },
    [refreshData]
  );

  const toggleProfileActive = useCallback(
    async (profileId: string) => {
      await repository.toggleProfileActive(profileId);
      await refreshData();
    },
    [refreshData]
  );

  const linkProfileMember = useCallback(
    async (profileId: string, memberId: string) => {
      await repository.linkProfileMember(profileId, memberId);
      await refreshData();
    },
    [refreshData]
  );

  // Helpers
  const getUnitById = useCallback((id: string | null | undefined) => units.find(u => u.id === id), [units]);
  const getMemberById = useCallback((id: string | null | undefined) => members.find(m => m.id === id), [members]);
  // Thành viên gắn với tài khoản đang đăng nhập
  const currentMember = useMemo(
    () => (currentUser?.memberId ? members.find(m => m.id === currentUser.memberId) ?? null : null),
    [currentUser, members]
  );
  const getTaskById = useCallback((id: string | null | undefined) => tasks.find(t => t.id === id), [tasks]);
  const getSubCriterionById = useCallback(
    (id: string | null | undefined) => subCriteria.find(c => c.id === id),
    [subCriteria]
  );
  const getCriterionById = useCallback((id: string | null | undefined) => criteria.find(c => c.id === id), [criteria]);
  const getSectionById = useCallback(
    (id: string | null | undefined) => criteriaSections.find(s => s.id === id),
    [criteriaSections]
  );
  const getEvidencesByResultId = useCallback(
    (resultId: string) => {
      const res = taskResults.find(r => r.id === resultId);
      if (!res) return [];
      return evidences.filter(e => e.task_id === res.task_id && e.unit_id === res.unit_id);
    },
    [taskResults, evidences]
  );
  const getEvidencesBySubmissionId = useCallback(
    (submissionId: string) => evidences.filter(e => e.submission_id === submissionId),
    [evidences]
  );
  const calculateUnitScores = useCallback(() => unitScores, [unitScores]);

  const value: AppContextType = {
    currentRole,
    setCurrentRole,
    selectedYear,
    setSelectedYear,
    currentUser,
    currentMember,
    listMyTodo,
    uploadEvidence,
    submitTaskResult,
    submitCriterionSubmission,
    updateMyProfile,
    uploadMyAvatar,
    getSignupOptions,
    selfRegisterMember,
    journalEntries,
    refreshJournal,
    saveJournalEntry,
    deleteJournalEntry,
    uploadJournalImage,
    listMyFeed,
    setTaskRegistration,
    submitMemberResult,
    reviewMemberSubmission,
    listMemberSubmissionEvidences,
    listTaskParticipants,
    listTaskParticipantsAll,
    memberSubmissions,
    units,
    unitTypes,
    ethnicities,
    members,
    profiles,
    tasks,
    taskUnits,
    taskRegistrations,
    taskSubCriteria,
    subCriteria,
    criteria,
    criteriaSections,
    criteriaSet,
    criteriaSets,
    taskResults,
    criterionSubmissions,
    evidences,
    notifications,
    warnings,
    auditLogs,
    unitCommittees,
    reports,
    yearlySettings,
    globalSearch,
    setGlobalSearch,
    pendingCount: stats.pendingCount,
    taskPendingCount: stats.taskPendingCount,
    criteriaPendingCount: stats.criteriaPendingCount,
    overdueUnitsCount: stats.overdueUnitsCount,
    dueSoon7DaysCount: stats.dueSoon7DaysCount,
    newMembersCount: stats.newMembersCount,
    totalMembers: stats.totalMembers,
    approveTaskResult,
    rejectTaskResult,
    approveCriterionSubmission,
    rejectCriterionSubmission,
    createTask,
    updateTask,
    closeTask,
    deleteTask,
    cloneTask,
    remindAllUnsubmitted,
    saveTaskSubCriteria,
    countUnitsWithoutResult,
    approveAllMemberSubmissions,
    remindUnit,
    createCriteriaSection,
    updateCriteriaSection,
    deleteCriteriaSection,
    createCriterion,
    updateCriterion,
    deleteCriterion,
    createSubCriterion,
    updateSubCriterion,
    deleteSubCriterion,
    reorderSections,
    reorderCriteria,
    reorderSubCriteria,
    cloneCriteriaSetFromPreviousYear,
    deleteCriteriaSet,
    restoreCriteriaSet,
    getCriteriaSetImpact,
    purgeCriteriaSet,
    importCriteriaTree,
    setActiveCriteriaSet,
    resolveWarning,
    syncWarnings,
    sendManualReminder,
    updateUnit,
    deactivateUnit,
    createUnit,
    deleteUnit,
    createMember,
    updateMember,
    deleteMember,
    bulkImportMembers,
    addCommitteeMember,
    endCommitteeTerm,
    createReportSnapshot,
    updateYearlySettings,
    createUnitType,
    updateUnitType,
    deleteUnitType,
    updateProfileRole,
    toggleProfileActive,
    linkProfileMember,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    lastUpdated,
    refreshData,
    toasts,
    showToast,
    removeToast,
    getUnitById,
    getMemberById,
    getTaskById,
    getSubCriterionById,
    getCriterionById,
    getSectionById,
    getEvidencesByResultId,
    getEvidencesBySubmissionId,
    calculateUnitScores,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
