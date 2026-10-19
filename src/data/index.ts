/**
 * ĐIỂM GHÉP TẦNG DỮ LIỆU
 *
 * Ứng dụng luôn nói chuyện với một đối tượng kiểu `Repository` duy nhất.
 * File này quyết định đối tượng đó là ai:
 *
 *   - Chưa cấu hình Supabase  -> dùng toàn bộ bản mock (chạy được ngay, không cần mạng).
 *   - Đã cấu hình Supabase     -> Giai đoạn 1 (đoàn viên, chi đoàn, BCH, báo cáo, cấu hình
 *     năm, tài khoản, nhật ký, dashboard) chạy thật; Giai đoạn 2 (nhiệm vụ, tiêu chí, duyệt,
 *     nhắc nhở, minh chứng) vẫn lấy từ bản mock cho tới khi được làm thật.
 *
 * Bật chế độ thật: đặt VITE_DATA_SOURCE=supabase trong .env.local (kèm URL + anon key).
 */
import type { Repository } from './repository';
import { mockRepository } from './mockRepository';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import {
  SupabaseGd1Repository, createSupabaseGd1Methods, fetchAll,
  toCriteriaSet, toCriteriaSection, toCriterion, toSubCriterion, toCriterionSubmission,
  toTask, toTaskUnit, toTaskRegistration, toTaskSubCriterion, toTaskResult, toEvidence,
  toMemberSubmission,
  toNotification, toWarning,
} from './supabaseRepository';

export type DataSource = 'mock' | 'supabase';

/** Nguồn dữ liệu đang dùng, suy ra từ biến môi trường. */
export const dataSource: DataSource =
  import.meta.env.VITE_DATA_SOURCE === 'supabase' && isSupabaseConfigured() ? 'supabase' : 'mock';

let gd1: SupabaseGd1Repository | null = null;
function gd1Repo(): SupabaseGd1Repository {
  if (!gd1) gd1 = createSupabaseGd1Methods(supabase!);
  return gd1;
}

/**
 * Snapshot lai cho AppContext: các mảng giai đoạn 1 lấy thật từ Supabase,
 * các mảng giai đoạn 2 vẫn lấy từ mock.
 */
async function hybridSnapshot(): Promise<Awaited<ReturnType<Repository['getRawSnapshot']>>> {
  const mockSnap = await mockRepository.getRawSnapshot();
  if (dataSource === 'mock') return mockSnap;

  try {
    const sb = supabase!;
    const safe = <T,>(p: Promise<T[]>): Promise<T[]> => p.catch(() => [] as T[]);
    // Mọi nhóm truy vấn chạy SONG SONG. Trước đây 3 nhóm chạy nối tiếp nhau
    // nên mỗi lần refresh phải chờ hết nhóm này mới tới nhóm khác.
    const [
      [units, unitTypes, ethnicities, members, profiles, unitCommittees, reports, yearlySettings, auditLogs],
      [criteriaSetsRaw, criteriaSectionsRaw, criteriaRaw, subCriteriaRaw, criterionSubmissionsRaw],
      [tasksRaw, taskUnitsRaw, taskRegRaw, taskSubRaw, taskResultsRaw, memberSubsRaw, evidencesRaw, notificationsRaw, warningsRaw],
    ] = await Promise.all([
      Promise.all([
        gd1Repo().listUnits({ isActive: undefined }).then((rs) => rs.map((r) => r.unit)),
        gd1Repo().listUnitTypes(),
        gd1Repo().listEthnicities(),
        gd1Repo().listMembers().then((rs) => rs.map((r) => r.member)),
        gd1Repo().listProfiles().then((rs) => rs.map((r) => r.profile)),
        sb.from('unit_committees').select('*').then(({ data }) => (data ?? []) as never),
        gd1Repo().listReports(),
        gd1Repo().getYearlySettings(new Date().getFullYear()),
        gd1Repo().listAuditLogs().then((rs) => rs.map((r) => r.log)),
      ]),
      // Giai đoạn 2 — tiêu chí: đọc thật, KHÔNG fallback mock
      Promise.all([
        fetchAll((f, t) => sb.from('criteria_sets').select('*').order('year', { ascending: false }).range(f, t)),
        fetchAll((f, t) => sb.from('criteria_sections').select('*').order('stt').range(f, t)),
        fetchAll((f, t) => sb.from('criteria').select('*').order('stt').range(f, t)),
        fetchAll((f, t) => sb.from('sub_criteria').select('*').order('id').range(f, t)),
        fetchAll((f, t) => sb.from('criterion_submissions').select('*').range(f, t)),
      ]),
      // Giai đoạn 2 — nhiệm vụ / duyệt / minh chứng / nhắc nhở: đọc thật.
      // Dùng bản "an toàn": bảng nào chưa tồn tại (chưa chạy migration) thì coi như rỗng.
      Promise.all([
        safe(fetchAll((f, t) => sb.from('tasks').select('*').order('created_at', { ascending: false }).range(f, t))),
        safe(fetchAll((f, t) => sb.from('task_units').select('*').range(f, t))),
        safe(fetchAll((f, t) => sb.from('task_registrations').select('*').range(f, t))),
        safe(fetchAll((f, t) => sb.from('task_sub_criteria').select('*').range(f, t))),
        safe(fetchAll((f, t) => sb.from('task_results').select('*').range(f, t))),
        safe(fetchAll((f, t) => sb.from('member_submissions').select('*').range(f, t))),
        safe(fetchAll((f, t) => sb.from('evidences').select('*').range(f, t))),
        safe(fetchAll((f, t) => sb.from('notifications').select('*').order('created_at', { ascending: false }).range(f, t))),
        safe(fetchAll((f, t) => sb.from('warnings').select('*').range(f, t))),
      ]),
    ]);

    return {
      ...mockSnap,          // các mảng chưa làm thật vẫn tạm từ mock
      units,
      unitTypes,
      ethnicities,
      members,
      profiles,
      unitCommittees: unitCommittees as never,
      reports,
      yearlySettings,
      auditLogs,
      criteriaSets: criteriaSetsRaw.map(toCriteriaSet),
      criteriaSections: criteriaSectionsRaw.map(toCriteriaSection),
      criteria: criteriaRaw.map(toCriterion),
      subCriteria: subCriteriaRaw.map(toSubCriterion),
      criterionSubmissions: criterionSubmissionsRaw.map(toCriterionSubmission),
      tasks: tasksRaw.map(toTask),
      taskUnits: taskUnitsRaw.map(toTaskUnit),
      taskRegistrations: taskRegRaw.map(toTaskRegistration),
      taskSubCriteria: taskSubRaw.map(toTaskSubCriterion),
      taskResults: taskResultsRaw.map(toTaskResult),
      memberSubmissions: memberSubsRaw.map(toMemberSubmission),
      evidences: evidencesRaw.map(toEvidence),
      notifications: notificationsRaw.map(toNotification),
      warnings: warningsRaw.map(toWarning),
    };
  } catch (err) {
    // Chưa đăng nhập / thiếu quyền / mất mạng: không làm trắng giao diện,
    // tạm dùng dữ liệu mock và ghi rõ lý do để dễ chẩn đoán.
    console.warn('[data] Không đọc được dữ liệu Supabase, tạm dùng mock:', err);
    return mockSnap;
  }
}

/**
 * Repository đang hoạt động. Giai đoạn 2 ủy quyền cho bản mock; giai đoạn 1 (nếu bật
 * Supabase) lấy từ SupabaseGd1Repository.
 */
function buildRepository(): Repository {
  if (dataSource === 'mock') return mockRepository;

  const real = gd1Repo();
  const mock = mockRepository as unknown as Record<string, unknown>;
  // Bọc: mọi hàm giai đoạn 1 lấy từ Supabase, phần còn lại rơi về mock.
  return new Proxy(mockRepository as Repository, {
    get(target, prop) {
      if (typeof prop === 'string') {
        // Snapshot lai: AppContext nạp dữ liệu qua đây
        if (prop === 'getRawSnapshot') return hybridSnapshot;
        // Hàm giai đoạn 1 -> Supabase
        const realFn = (real as unknown as Record<string, unknown>)[prop];
        if (typeof realFn === 'function') return (realFn as (...a: unknown[]) => unknown).bind(real);
        // Còn lại -> mock, bind đúng `this` để private field truy cập được
        const mockFn = mock[prop];
        if (typeof mockFn === 'function') return (mockFn as (...a: unknown[]) => unknown).bind(mockRepository);
      }
      return Reflect.get(target, prop);
    },
  });
}

export const repository: Repository = buildRepository();

/** Xóa cache người dùng đăng nhập (gọi khi auth state đổi). */
export function clearAuthCache(): void {
  gd1?.clearCache();
}

// Tiện ích cho tầng xác thực / giao diện
export { supabase, isSupabaseConfigured };
export { SupabaseGd1Repository } from './supabaseRepository';
export type { CurrentUser, SaveMemberResult, ImportMembersResult } from './supabaseRepository';
