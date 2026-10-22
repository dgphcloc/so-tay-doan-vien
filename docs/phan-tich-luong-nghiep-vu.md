# Phân tích luồng nghiệp vụ — Sổ tay Đoàn viên

Đối chiếu: code hiện tại ↔ `DATA_CONTRACT.md` ↔ `security_spec.md` (bản Firebase gốc) ↔ các migration.

Mục tiêu: trước khi viết test, chốt xem hệ thống **thực sự** đang làm gì, và chỗ nào lệch với điều đã thiết kế.

---

## 1. Bản đồ luồng nghiệp vụ hiện tại

```
① Tạo nhiệm vụ (admin / bí thư CĐ)
      │  draft ──publish──> published ──close──> closed
      │  submit_scope: assigned | open
      │  giao chi đoàn: task_units
      ▼
② Bảng tin (đoàn viên)
      │  task_registrations  (tham gia / từ chối — chỉ để ước lượng)
      ▼
③ Nộp minh chứng CÁ NHÂN
      │  member_submissions  (ảnh + GPS + ghi chú), UNIQUE(task, member)
      ▼
④ Bí thư chi đoàn duyệt bài cá nhân
      │  member_submissions.status: pending → approved | rejected
      ▼
⑤ Bí thư chi đoàn nộp bài TỔNG HỢP
      │  task_results, UNIQUE(task, unit)
      ▼
⑥ Bí thư xã duyệt bài chi đoàn
      │  task_results.status: pending → approved | rejected
      ▼
⑦ Điểm thi đua = chỉ điểm tiêu chí
         criterion_submissions (approved_score)
```

Luồng ②–④ là mới (giai đoạn 3). ⑤–⑦ là cũ, vẫn chạy song song.

---

## 2. Vòng đời nhiệm vụ

**File:** `src/pages/TasksPage.tsx`, `src/data/supabaseRepository.ts` (`createTask`, `publishTask`, `closeTask`, `cloneTask`, `deleteTask`).

| Trạng thái | Chuyển bằng | Ghi chú |
|---|---|---|
| `draft` | Tạo → **Lưu nháp** | Không hiện cho đoàn viên. Chỉ xóa được ở trạng thái này |
| `published` | **Phát động ngay** | Đoàn viên thấy ở bảng tin và trang nộp |
| `closed` | **Đóng nhiệm vụ** | `closed_by`, `closed_at` được ghi |

Quy tắc đã có trong code:
- `createTask` ghi `submit_scope`, `task_units`, `task_sub_criteria`, và gửi thông báo cho bí thư các chi đoàn nếu phát động ngay.
- `cloneTask` sao chép nhiệm vụ + `task_units` + `task_sub_criteria`, đặt về `draft`, hạn +14 ngày.
- Bí thư chi đoàn chỉ giao được cho chi đoàn mình (UI giới hạn; xem mục 5 về chỗ chưa chặn thật).

**Phát hiện 1 — `updateTask` không ghi DB.** `AppContext.tsx:470` lấy snapshot, `Object.assign` vào object rồi `refreshData()`. Không có hàm `updateTask` nào trong `Repository`, `mockRepository`, `supabaseRepository`. Hiện UI chưa có nút sửa nhiệm vụ nên chưa lộ, nhưng đây là hàm "sửa xong mất". **Nên xóa hoặc làm thật trước khi có người dùng.**

**Phát hiện 2 — lỗi tạo nhiệm vụ bị nuốt.** `TasksPage.tsx:248` gọi `createTask(...)` không `await`, cũng không `.catch`. Hàm này `async` và `createTask` trong repository `throw` khi DB từ chối (ví dụ `max_score = 0`, vi phạm ràng buộc, RLS chặn). Kết quả: modal đóng, chuyển tab, **không có thông báo lỗi**, nhiệm vụ không được tạo. Người dùng tưởng thành công. Đây là lỗi nên sửa trước khi test nhóm A.

---

## 3. Luồng nộp minh chứng 2 cấp

### 3.1 Bốn bảng, bốn mục đích

| Bảng | Ai tạo | Duyệt bởi | UNIQUE | Ghi chú |
|---|---|---|---|---|
| `task_registrations` | đoàn viên | không duyệt | (task, member) | Chỉ ước lượng tham gia, không chặn nộp |
| `member_submissions` | đoàn viên | bí thư CĐ | (task, member) | Mới, giai đoạn 3 |
| `task_results` | bí thư CĐ | bí thư xã | (task, unit) | Bài tổng hợp của chi đoàn |
| `criterion_submissions` | bí thư CĐ | bí thư xã | (sub_criterion, unit) | Bài tự chấm tiêu chí |

### 3.2 Quy tắc phạm vi nộp — **đang viết hai lần**

Đây là điểm rủi ro nhất của hệ thống.

**Bản TypeScript** — `supabaseRepository.ts`, `assertSubmitScope`:
```ts
if (status !== 'published') chặn
if (submit_scope === 'open') cho qua
ngược lại: phải có dòng task_units(task, unit)
```

**Bản SQL** — `phase3_member_submissions.sql:66-84`, policy `member_submissions_insert`: kiểm tra đúng ba điều kiện trên, cộng `member_id = my_member_id()`, `unit_id = my_unit_id()`, `status = 'pending'`.

Hai bản này hiện **khớp nhau**, nhưng không có gì bảo đảm chúng tiếp tục khớp. Sửa một bên là lệch. Đây chính là lý do nên tách thành một hàm thuần dùng chung, và có test cho nó.

### 3.3 Chưa có bước "nộp đủ"

Đặc tả chốt: "đoàn viên nộp đủ → bí thư CĐ duyệt → gửi bài tổng hợp". Trong code:
- `listTaskParticipants(taskId, unitId)` đã có, trả về ai đã tham gia / đã nộp / chưa nộp.
- **Nhưng không nơi nào gọi nó.** Không có giao diện hiển thị tiến độ, và `submitTaskResult` (nộp tổng hợp) không kiểm tra điều kiện gì.

Nghĩa là hiện tại bí thư chi đoàn nộp tổng hợp được **bất kể** đoàn viên nộp hay chưa. Đây là thiếu sót nghiệp vụ, không phải lỗi kỹ thuật — cần bạn quyết định quy tắc "nộp đủ" (bao nhiêu %, bắt buộc mọi đoàn viên, hay chỉ cần ≥1 bài đã duyệt).

### 3.4 Nộp lại khi bị từ chối

Đã đúng cho cả ba bảng: tìm bản ghi cũ theo khóa UNIQUE, `update` thay vì `insert`, xóa minh chứng cũ rồi ghi bộ mới.

Riêng `member_submissions` còn chặn sửa khi `status = 'approved'` — đúng ý.

### 3.5 Lỗ hổng: minh chứng cá nhân không có RLS

`evidences` **không bật RLS** ở bất kỳ migration nào. Kiểm tra lại: chỉ `task_sub_criteria` và `member_submissions` được bật RLS; `evidences` chỉ có policy cho Storage bucket, không có policy cho bảng.

Hệ quả: mọi tài khoản đã đăng nhập đọc được **toàn bộ** dòng `evidences`, kể cả ảnh cá nhân của đoàn viên chi đoàn khác. Điều này vi phạm trực tiếp nguyên tắc trong `security_spec.md` của bản gốc:

> "Administrators CANNOT read the personal evidence files or notes of members. This is an explicit core product invariant (ví cá nhân là ví riêng)."

Đây là điểm cần bạn quyết định, vì nó mâu thuẫn với yêu cầu mới: bí thư chi đoàn **phải** xem được ảnh để duyệt. Hai nguyên tắc này không thể cùng đúng. Đề xuất: giữ mô hình mới (bí thư CĐ xem được ảnh của chi đoàn mình), bỏ nguyên tắc "admin không đọc được", nhưng **giới hạn theo chi đoàn** thay vì để mở hoàn toàn.

---

## 4. Tính điểm thi đua

**File:** `supabaseRepository.ts` `calculateUnitScores`, `mockRepository.ts` cùng tên.

Công thức hiện tại (sau khi sửa ở giai đoạn 3):

```
criteriaScore   = Σ approved_score của criterion_submissions (status = approved)
activityCount   = số task_results approved của chi đoàn
participantCount = số member_submissions approved của chi đoàn
totalScore      = criteriaScore
maxPossible     = 100
completionRate  = round(totalScore / 100 * 100)
```

**Lệch với đặc tả gốc** (`DATA_CONTRACT.md` mục 4.6): đặc tả ghi `totalScore = criteriaScore + taskScore`, `maxPossible = 150`. Code mới bỏ `taskScore`. Đây là thay đổi **có chủ đích** theo yêu cầu của bạn ("nhiệm vụ KHÔNG cộng điểm"), nhưng `DATA_CONTRACT.md` chưa được cập nhật. Nên sửa tài liệu, nếu không lần sau ai đọc cũng hiểu sai.

**Phát hiện 3 — `task_sub_criteria.contribution_score` thành mồ côi.** Bảng này vẫn được ghi khi tạo nhiệm vụ, và UI vẫn hiện "Tiêu chí con tự động cộng điểm khi duyệt: +N điểm". Nhưng từ khi bỏ `taskScore`, **không còn chỗ nào đọc `contribution_score` để cộng điểm**. Đặc tả cũ (mục 1, dòng Nhiệm vụ) cũng ghi rõ điểm nhiệm vụ đến từ `tasks.max_score`, không phải `contribution_score` — nên trước đây nó có lẽ cũng chưa từng được dùng.

Kết luận: UI đang hứa một điều không xảy ra. Hoặc xóa phần "gắn tiêu chí thi đua" khỏi form tạo nhiệm vụ, hoặc làm cho nó cộng điểm thật. Cần bạn chọn.

**Phát hiện 4 — `getDashboard` trả số cứng 0.** `supabaseRepository.ts:433-434`:
```ts
overdueUnitsCount: 0,    // giai đoạn 2: cần dữ liệu nhiệm vụ / tiêu chí
dueSoon7DaysCount: 0,    // giai đoạn 2
```
Dashboard luôn hiện 0 chi đoàn trễ hạn và 0 nhiệm vụ sắp hết hạn, dù thực tế có. Đặc tả mục 4.2 và 4.3 mô tả công thức đầy đủ nhưng chưa làm. Đây là hiển thị sai, không phải thiếu tính năng.

---

## 5. Phân quyền — ba tầng, chỉ một tầng chặn thật

| Tầng | File | Có chặn thật? |
|---|---|---|
| Ẩn/hiện menu | `Sidebar.tsx` `canSee()`, `BottomNav.tsx` | Không — chỉ là giao diện |
| Route guard | `RequireRole.tsx` + `ROUTE_ACCESS` | **Có**, khi gõ URL trực tiếp |
| RLS database | migrations | **Chỉ 2 bảng** (`task_sub_criteria`, `member_submissions`) |

`canReview` (`permissions.ts:35`) áp dụng đúng cho **bài chi đoàn**: bí thư CĐ chỉ duyệt bài chi đoàn mình **và** nhiệm vụ do chính mình giao. Bài tiêu chí chỉ admin duyệt.

Nhưng **duyệt bài cá nhân thì không đi qua `canReview`**. `MemberSubmissionsPanel` lọc danh sách theo `currentMember.unit_id` ở phía client, rồi gọi `reviewMemberSubmission`, hàm này không kiểm tra gì ngoài việc lấy `requireMemberId()`. Việc chặn thật dựa hoàn toàn vào RLS `member_submissions_update` — may là policy này đúng.

**Phát hiện 5 — bảng tin và trang nộp phụ thuộc vào quyền đọc `members`.** `listMyFeed` đọc `members` để lấy `unit_id` của chính mình; `submitMemberResult` cũng vậy. Theo ghi chú trong bộ nhớ dự án, `unit_secretary` đọc bảng `members` gốc bị RLS chặn và phải dùng view `members_limited`. **Đoàn viên (`member`) có đọc được dòng `members` của chính mình không thì chưa xác nhận được từ code** — schema không có policy `members` nào được định nghĩa trong repo, nghĩa là policy nằm ngoài (chạy tay trên Supabase). Nếu đoàn viên không đọc được, bảng tin sẽ trả rỗng và trang nộp sẽ báo "không tìm thấy hồ sơ". Đây là điều **phải test đầu tiên** khi chạy migration.

---

## 6. Nhắc nhở / cảnh báo / thông báo

| Thành phần | Ai tạo | Cơ chế |
|---|---|---|
| `notifications` | `sendNotification`, `notifySecretaries` | Gửi thủ công khi tạo nhiệm vụ, khi bấm nhắc |
| `warnings` | **không ai tạo** | Chỉ đọc và `resolveWarning` |

**Phát hiện 6 — bảng `warnings` không bao giờ có dữ liệu mới.** Không có lệnh `insert` nào vào `warnings` trong toàn bộ `src/`. Trang **Nhắc nhở** đọc bảng này, nên phần cảnh báo quá hạn/sắp hạn sẽ luôn rỗng. Đặc tả (mục 1, dòng Nhắc nhở) giả định hệ thống tự sinh cảnh báo. Hiện chỉ có nhắc **thủ công** hoạt động.

**Phát hiện 7 — gửi nhắc theo lịch không chạy.** `RemindersPage` lưu lịch hẹn vào state; không có cron/edge function nào. Chỉ "Gửi ngay" mới thật.

**Điểm tốt:** `notifySecretaries` quy đổi chi đoàn → bí thư đúng (ưu tiên `unit_committees`, dự phòng `members.current_position`), vì `notifications.recipient_id` trỏ `members(id)` chứ không phải `units(id)`.

---

## 7. Tiêu chí

**Chốt bộ tiêu chí:** `yearly_settings.criteria_set_id`. `isFinalizedForYear` = bộ đang chọn trùng `criteria_set_id` của năm. `isValid100` = tổng điểm đúng 100 và không có tiêu chí con mồ côi — **chỉ để hiển thị**, không chặn chốt (theo quyết định trước đây của bạn).

**Phân công chi đoàn:** `criteriaAssignment.ts` — `unit_ids` không rỗng thì chỉ các CĐ đó; `unit_type_ids` rỗng thì tất cả; còn lại là các CĐ thuộc loại đã chọn. Logic này **thuần và đã có test được**, là ứng viên tốt nhất cho bộ test đầu tiên.

**Phát hiện 8 — ràng buộc "chỉ chấm được tiêu chí áp dụng cho chi đoàn mình".** `listMyTodo` lọc tiêu chí theo bộ đang chốt và dùng `isSubCriterionApplicableToUnit`. Nhưng `submitCriterionSubmission` **không kiểm tra lại** phạm vi. Nếu ai đó gọi thẳng, có thể nộp bài tiêu chí cho chi đoàn không được giao. Mức nghiêm trọng thấp (không ai có động cơ), nhưng cùng loại lỗi với phạm vi nộp.

---

## 8. Tổng hợp: việc nên làm trước khi test

Xếp theo mức ảnh hưởng tới kết quả test:

| # | Vấn đề | Loại | Ảnh hưởng |
|---|---|---|---|
| 1 | `createTask` không `await`/`.catch` | Lỗi | Test nhóm A sẽ "pass" giả khi tạo thất bại |
| 2 | `evidences` không có RLS | Bảo mật | Ảnh cá nhân lộ toàn hệ thống |
| 3 | Quyền đọc `members` của đoàn viên chưa xác nhận | Rủi ro | Nếu sai, toàn bộ luồng ③–④ không chạy |
| 4 | `updateTask` sửa trong bộ nhớ, không ghi DB | Lỗi tiềm ẩn | Chưa lộ vì UI chưa dùng |
| 5 | `warnings` không có dữ liệu | Thiếu tính năng | Trang Nhắc nhở luôn rỗng |
| 6 | Dashboard trả 0 cứng | Hiển thị sai | Số liệu trông "đẹp" nhưng sai |
| 7 | `contribution_score` mồ côi | Mâu thuẫn UI | UI hứa cộng điểm, không có gì cộng |
| 8 | Chưa có bước "nộp đủ" | Thiếu nghiệp vụ | Bí thư CĐ nộp tổng hợp bất kể |
| 9 | Phạm vi nộp viết hai lần (TS + SQL) | Rủi ro dài hạn | Lệch nhau là lỗi bảo mật |
| 10 | `DATA_CONTRACT.md` lỗi thời (150 điểm, taskScore) | Tài liệu | Gây hiểu sai về sau |

---

## 9. Đề xuất thứ tự làm

1. **Xác nhận #3** bằng một câu truy vấn trên Supabase — nhanh, và nó chặn toàn bộ việc test.
2. **Sửa #1** — 5 dòng code, nhưng nếu không sửa thì mọi test tạo nhiệm vụ đều không đáng tin.
3. **Quyết định #8** — quy tắc "nộp đủ" là gì. Đây là quyết định nghiệp vụ của bạn, tôi không tự chọn.
4. **Quyết định #2 và #7** — hai chỗ mâu thuẫn giữa đặc tả cũ và yêu cầu mới.
5. Rồi mới tách logic thuần (`scoring`, `submitScope`) và viết test — lúc đó test mới phản ánh đúng nghiệp vụ đã chốt.

Việc 1–2 tôi làm được ngay khi bạn đồng ý. Việc 3–4 cần bạn chốt.

---

## 10. Cập nhật sau khi đối chiếu RLS (2026-10-18)

### Đã xác nhận

Chạy `select policyname, cmd, qual from pg_policies where tablename = 'members';` cho kết quả:

| policy | cmd | điều kiện |
|---|---|---|
| `members_select` | SELECT | `is_admin() OR id = my_member_id()` |
| `members_write` | ALL | `is_admin()` |

Kết luận:
- **Rủi ro #3 được loại bỏ.** Đoàn viên đọc được đúng dòng `members` của chính mình, nên `listMyFeed` và `submitMemberResult` lấy được `unit_id` và chạy đúng.
- Đoàn viên **không** đọc được dòng của người khác (trừ khi là chính mình). Vì vậy `listMyFeed` chỉ lấy được tên mình, còn `joinedNames` (danh sách tên đoàn viên đã tham gia) sẽ **rỗng** với đoàn viên thường — chỉ bí thư chi đoàn / admin đọc được nhiều dòng. Đây là hành vi chấp nhận được: bảng tin chỉ cần `joinedCount`.
- Ghi vào `members` chỉ admin làm được — đúng, và là lý do `updateMyProfile` phải đi qua RPC `member_self_update` chứ không update trực tiếp.

### Đã quyết định

**Đoàn viên tiếp tục đọc bảng `members` gốc** (không chuyển sang `members_limited`). Hệ quả đã biết và chấp nhận: với policy hiện tại, đoàn viên chỉ đọc được dòng của mình nên không lộ dữ liệu người khác. Tuy nhiên **nếu sau này nới `members_select`** (ví dụ cho đoàn viên xem danh sách chi đoàn), phải nhớ chuyển `memberSource()` sang `members_limited`, nếu không SĐT/tôn giáo/Đảng viên sẽ lộ.

### Đã sửa

**Rủi ro #1 — đã sửa.** `handleSaveTask` trong `TasksPage.tsx` giờ `await createTask(...)` trong `try/catch`:
- Thành công: toast "Đã phát động nhiệm vụ" / "Đã lưu nhiệm vụ nháp", đóng modal, chuyển tab.
- Thất bại: toast đỏ "Không tạo được nhiệm vụ" kèm thông điệp lỗi, **giữ nguyên modal và dữ liệu đã nhập** để sửa và thử lại.
- Nút bị khoá khi đang lưu, nhãn đổi thành "Đang lưu…" / "Đang phát động…" để tránh bấm hai lần sinh hai nhiệm vụ.

Lưu ý cho test nhóm A: trước bản sửa này, case A1/A2 có thể "pass" giả (modal đóng nhưng nhiệm vụ không được tạo). Nay nếu tạo thất bại sẽ thấy toast đỏ ngay.

---

## 11. Nhóm 1 — lỗi từ test thủ công (đã sửa 2026-10-18)

Nguồn: người dùng test tay và báo 12 lỗi. Nhóm 1 là 6 lỗi rõ ràng, không cần chốt quy tắc nghiệp vụ.

| # | Lỗi | Cách sửa |
|---|---|---|
| 1 | Bí thư chi đoàn đóng được nhiệm vụ (sai nghiệp vụ) | Nút Đóng (cả trong bảng lẫn chi tiết) chỉ hiện khi `canManageTasks` = admin/super_admin. Bí thư CĐ không còn thấy nút |
| 2 | Đóng nhiệm vụ không cần xác nhận | Modal bắt gõ chính xác chữ **`dong`**; nút "Đồng ý đóng" bị khoá tới khi đúng. Nút đổi nhãn "Đang đóng…" khi đang gửi |
| 3 | Không có nút quét QR bằng camera | `QrScanModal` dùng `BarcodeDetector` có sẵn của Chrome/Edge, không thêm thư viện. Có ô dán link dự phòng; báo rõ khi trình duyệt không hỗ trợ |
| 4 | Duyệt xong không báo thành công, nút duyệt vẫn hiện | Toast xanh "Đã duyệt hồ sơ" / đỏ kèm lý do. Không tự nhảy sang bài khác. Hồ sơ đã xử lý hiện nhãn "Hồ sơ đã được xử lý" thay cho nút duyệt. Nút khoá khi đang gửi |
| 5 | Bảng tin thiếu bộ lọc | Thêm 5 chip trạng thái (Tất cả / Chưa nộp / Chờ duyệt / Đã duyệt / Bị từ chối) có số đếm, và ô tìm theo tên nhiệm vụ |
| 9 | Chi đoàn có bí thư nhưng vẫn gắn "Khuyết Bí thư" | `UnitsPage` chỉ lấy bí thư từ `unit_committees`; nay dự phòng theo `members.current_position === 'secretary'` giống `listUnits` trong repository |

Kèm theo (cùng nhóm, phát hiện khi sửa):
- `closeTask`, `approve*`, `reject*` trong `AppContext` trước đây trả `Promise<void>` nên nuốt mất `{success, message}` từ repository. Nay trả kết quả thật để UI báo đúng.
- Nút **Nhắc tất cả chưa nộp** cũng chuyển sang chỉ admin thấy, cùng lý do với nút Đóng.

**Chưa làm (nhóm 2 và 3):**
- #6 bài nộp cá nhân 3–4 phút mới hiện (cần đo cache)
- #7 phạm vi xem điểm thi đua (cần chốt quy tắc)
- #8 đếm số đoàn viên sai với tài khoản `member` (gốc RLS `members_select`)
- #10 email đoàn viên (cần RPC)
- #11 số liệu tiêu chí cũ 14–28 (nghi state cache)
- #12 quy tắc chọn bộ mặc định / khoá sửa-xóa tiêu chí (cần chốt)

---

## 12. Nhóm 2 — lỗi từ test thủ công (đã sửa 2026-10-18)

| # | Lỗi | Nguyên nhân thật | Cách sửa |
|---|---|---|---|
| 6 | Bài nộp cá nhân 3–4 phút mới hiện với bí thư | `hybridSnapshot` chạy **4 nhóm truy vấn nối tiếp** (9 + 5 + 9 truy vấn), mỗi lần refresh phải chờ hết nhóm trước. `evidences` còn đọc toàn bộ bảng mỗi lần | Gộp cả 3 nhóm vào một `Promise.all` — tất cả truy vấn chạy song song |
| 8 | Nhãn đếm đoàn viên: bí thư thấy 40, đoàn viên thấy 1 | Sidebar hiện `members.length`. RLS `members_select = is_admin() OR id = my_member_id()` khiến `member` chỉ đọc được đúng 1 dòng | Thêm RPC `stats_overview()` (SECURITY DEFINER, chỉ trả số đếm) và `totalMembers` vào AppContext; Sidebar dùng số đó |
| 10 | Bí thư xã chưa thấy email đoàn viên | `list_profiles_admin` **chưa từng tồn tại** trong repo; code có nhánh dự phòng đọc bảng `profiles` (không có cột email) | Thêm RPC `list_profiles_admin` + `member_emails` (join `auth.users`, chỉ admin gọi được). Thêm cột Email ở trang Đoàn viên và file Excel, chỉ admin thấy |
| 11 | Số tiêu chí hiện 14–28 dù đã xóa hết | `CriteriaPage.tsx:278-281` hard-code `: 14` và `: 28` cho mọi bộ không phải bộ đang chọn | Tính thật từ `criteriaSets`/`criteriaSections`/`criteria`/`subCriteria` cho từng bộ |

**Cần chạy migration:** `supabase/migrations/phase3b_stats_overview.sql` (tạo `stats_overview`, `member_emails`, `list_profiles_admin`).

Lưu ý về #6: phần lớn thời gian chờ đến từ truy vấn nối tiếp. Nếu sau khi sửa vẫn còn chậm, nguyên nhân tiếp theo là `getCurrentUser` cache 30 giây và việc `refreshData` đọc lại **toàn bộ** snapshot sau mỗi thao tác. Hướng tiếp theo là đọc lười `evidences` (chỉ khi mở chi tiết duyệt) thay vì nạp cả bảng.

---

## 13. Nhóm 3 — theo quy tắc người dùng chốt (đã làm 2026-10-18)

Quy tắc chốt:
- **Điểm thi đua**: bí thư xã/staff xem tất cả; bí thư chi đoàn xem được điểm các chi đoàn khác; **đoàn viên không xem** điểm, không thấy chi đoàn trễ hạn.
- **Bộ tiêu chí mặc định**: chọn ở trang **Cấu hình**. Xóa bộ phải gõ đúng tên và hiện cảnh báo hệ quả; **không chặn** vì bộ đang chốt cho năm.

| # | Thay đổi | File |
|---|---|---|
| 7a | Biểu đồ "Điểm chi đoàn" thay bằng thông báo "Chỉ bí thư chi đoàn và bí thư Đoàn xã xem được điểm thi đua" với `member` | `DashboardPage.tsx` |
| 7b | Thẻ "Chi đoàn trễ hạn" ẩn với `member` | `DashboardPage.tsx` |
| 7c | Bỏ lọc chi đoàn ở trang Chi đoàn: bí thư CĐ giờ thấy danh sách và điểm mọi chi đoàn | `UnitsPage.tsx` |
| 7d | Tab "5. Điểm thi đua" ẩn với `member` | `UnitsPage.tsx` |
| 7e | Nút **"Xem cách tính điểm"** trong tab Điểm: giải thích công thức bằng chữ (tổng = điểm tiêu chí; nhiệm vụ và lượt ĐV chỉ thống kê; tỷ lệ trên 100) | `UnitsPage.tsx` |
| 12a | Ô "Bộ Tiêu chí áp dụng" ở Cấu hình đổi từ `input` bị khóa thành `select` chọn từ danh sách bộ; lưu vào `yearly_settings.criteria_set_id`; đồng bộ bộ đang soạn | `SettingsPage.tsx` |
| 12b | Nút xóa bộ tiêu chí trên từng thẻ: modal **bắt gõ đúng tên bộ**, liệt kê hệ quả, nút xóa khoá tới khi khớp | `CriteriaPage.tsx` |
| 12c | `deleteCriteriaSet` mới: xóa con → cha; **từ chối nếu bộ đã có bài chấm tiêu chí** (để không mất điểm/minh chứng); ghi `audit_logs` | `repository.ts`, `supabaseRepository.ts`, `mockRepository.ts`, `AppContext.tsx` |

**Ghi chú thiết kế về 12c:** người dùng nói "không chặn xóa". Tôi vẫn chặn **một trường hợp duy nhất**: bộ đã có `criterion_submissions`. Lý do: xóa lúc đó sẽ làm mất điểm đã duyệt và minh chứng đính kèm, không thể hoàn tác. Nếu bạn muốn xóa được cả trường hợp này, cần quyết định ai được xóa và có lưu trữ trước khi xóa hay không.

**Migration đã có:** `phase3b_stats_overview.sql` (từ nhóm 2). Nhóm 3 không cần migration mới.

---

## 14. Lưu trữ / xóa vĩnh viễn bộ tiêu chí (2026-10-18)

Theo yêu cầu: bộ đã có bài chấm thì **mặc định lưu trữ**, xóa hẳn là thao tác phụ có kiểm soát.

### Lưu trữ (soft delete) — mặc định

| Hành vi | Chi tiết |
|---|---|
| Cột | `criteria_sets.archived_at timestamptz` (+ index) |
| Nút trên thẻ bộ | Biểu tượng **Archive** — mọi admin/super_admin thấy |
| Ẩn khỏi | Danh sách chọn ở trang Tiêu chí, dropdown Cấu hình, và `listCriteriaSets` (dùng cho chi đoàn) |
| Giữ nguyên | Toàn bộ Phần/Tiêu chí/tiêu chí con, điểm đã duyệt, minh chứng |
| Khôi phục | Khu "Bộ đã lưu trữ" ở trang Tiêu chí → nút **Khôi phục** |
| Nhật ký | Ghi `Lưu trữ bộ tiêu chí` / `Khôi phục bộ tiêu chí` |

Bảo vệ thêm: nếu bộ **đang là mặc định của năm** mà bị lưu trữ, `listMyTodo` bỏ qua bộ đó (chi đoàn không thấy tiêu chí), và trang **Cấu hình** hiện cảnh báo đỏ.

### Xóa vĩnh viễn — chỉ admin

| Bước | Chi tiết |
|---|---|
| Hiển thị | Chỉ `super_admin` / `admin` thấy nút thùng rác (cả trên thẻ và trong khu đã lưu trữ) |
| Số liệu | Modal gọi RPC `criteria_set_impact(set_id)` → hiện **"Sẽ xóa X bài chấm • Y minh chứng • của Z chi đoàn • N tiêu chí con"** |
| Xác nhận | Phải gõ **đúng tên bộ**; nút bị khoá tới khi khớp |
| Snapshot | Ghi `audit_logs` với `action = 'Xóa vĩnh viễn bộ tiêu chí'`, `new_value = JSON` chứa `criteria_set`, `sections`, `criteria`, `sub_criteria`, `criterion_submissions`, `evidences` — **trước** khi xóa |
| Thứ tự xóa | `task_sub_criteria` → `sub_criteria` → `criteria` → `criteria_sections` → `criteria_sets` |
| Storage | Xóa file ảnh theo lô 100 đường dẫn (`storage.from('evidences').remove`), tránh file mồ côi |

### Migration
`supabase/migrations/phase3c_criteria_archive.sql`:
- thêm cột `archived_at` + index
- RPC `criteria_set_impact(bigint)` — số bài chấm / chi đoàn / minh chứng
- RPC `criteria_set_evidence_paths(bigint)` — danh sách đường dẫn Storage (dự phòng, dùng khi cần kiểm tra trước khi xóa)

### Giới hạn đã biết
- Khôi phục dựng lại bộ bình thường, nhưng **không tự chọn lại làm bộ mặc định** — cần vào Cấu hình chọn lại.
- Snapshot JSON nằm trong `audit_logs.new_value` (kiểu text). Muốn dựng lại phải làm thủ công từ JSON, chưa có nút "phục hồi từ snapshot".
- `criteria_set_evidence_paths` chưa được dùng trong luồng xóa (code lấy đường dẫn trực tiếp từ bảng `evidences` trước khi xóa). Giữ lại làm công cụ kiểm tra.

---

## 15. Danh sách đoàn viên tham gia + minh chứng (2026-10-18)

### Quyết định thiết kế: KHÔNG tách thêm bảng

Hai loại bài nộp đã là hai bảng riêng từ trước, đúng mục đích:

| | Bài của đoàn viên | Bài của bí thư chi đoàn |
|---|---|---|
| Bảng | `member_submissions` | `task_results` |
| Mục đích | Đo kết quả nhiệm vụ (ai tham gia, ai nộp) | Báo cáo hoàn thành, dùng cho báo cáo theo bộ tiêu chí |
| Duyệt | Bí thư chi đoàn | Bí thư xã |
| UNIQUE | (task_id, member_id) | (task_id, unit_id) |

Việc còn thiếu không phải tách bảng, mà là **nối hai bảng lại trong giao diện** để người giao việc thấy được bức tranh đầy đủ.

### Đã làm

| Thành phần | Chi tiết |
|---|---|
| `listTaskParticipantsAll(taskId)` | Danh sách mọi đoàn viên thuộc các chi đoàn được giao, kèm `isJoining` và bài nộp cá nhân. Với nhiệm vụ `open` thì lấy mọi chi đoàn đang hoạt động |
| `TaskParticipantsPanel` | Tab **"Đoàn viên tham gia"** trong chi tiết nhiệm vụ |
| Thống kê nhanh | Tổng ĐV • Đã xác nhận tham gia • Đã nộp minh chứng • Đã được duyệt |
| Bộ lọc | Tìm theo tên/chi đoàn/SĐT; lọc theo chi đoàn; 5 chip trạng thái nộp (Tất cả / Chưa nộp / Chờ duyệt / Đã duyệt / Bị từ chối); 4 chip trạng thái đăng ký |
| Xuất Excel | Đúng danh sách đang lọc: họ tên, chi đoàn, đăng ký, trạng thái nộp, thời điểm nộp, toạ độ GPS, ghi chú |
| Xem chi tiết | Bấm một dòng mở modal: trạng thái, giờ nộp, GPS, ghi chú, ghi chú duyệt, ảnh (bấm phóng to), tệp, link, ghi chú minh chứng |

### Phân quyền

- **Bí thư xã / super_admin**: xem mọi nhiệm vụ.
- **Bí thư chi đoàn**: chỉ xem với nhiệm vụ **do chính mình tạo** (`tasks.assigned_by === currentMember.id`). Với nhiệm vụ của người khác, tab bị ẩn.
- **Đoàn viên**: không thấy tab (không có quyền vào `/nhiem-vu`).

Điều kiện nằm ở `canSeeParticipants` trong `TasksPage.tsx`. Lưu ý: đây là chặn ở giao diện; dữ liệu vẫn được RLS bảo vệ ở tầng DB (`member_submissions_select` chỉ cho bí thư chi đoàn đọc bài chi đoàn mình, admin đọc tất cả).

### Chưa làm
- Chưa nối "số lượt đoàn viên tham gia" vào điểm thi đua theo nhiệm vụ — vẫn giữ nguyên tắc nhiệm vụ không cộng điểm.
- Chưa có nút nhắc riêng những đoàn viên **chưa nộp** trong danh sách này (hiện chỉ nhắc được theo chi đoàn ở trang Nhắc nhở).

---

## 16. Sửa sau khi test duyệt bài cá nhân (2026-10-18)

### Lỗi: bí thư chi đoàn chỉ thấy chính mình trong danh sách tham gia

**Nguyên nhân:** `listTaskParticipantsAll` đọc bảng `members` gốc. RLS `members_select = is_admin() OR id = my_member_id()` khiến bí thư chi đoàn chỉ đọc được đúng dòng của mình, nên danh sách chỉ có 1 người — dù `member_submissions` đã có bài của nhiều đoàn viên (bảng này có policy riêng cho phép bí thư CĐ đọc bài chi đoàn mình).

Đây là lần thứ ba cùng một cái bẫy: **luôn dùng `memberSource()` khi đọc bảng đoàn viên**, không đọc thẳng `members`.

**Đã sửa:** `listTaskParticipantsAll` dùng `this.memberSource()` → bí thư CĐ đọc view `members_limited`, thấy đủ đoàn viên chi đoàn mình.

### Tối ưu luồng duyệt

Trước: mở tab "Bài đoàn viên" là trộn mọi nhiệm vụ vào một danh sách.
Nay: **hai bước**.

1. **Danh sách nhiệm vụ** — mỗi dòng hiện tên nhiệm vụ, số bài nộp, thời điểm nộp gần nhất, số bài đang chờ duyệt. Sắp theo số chờ duyệt giảm dần.
2. **Chọn nhiệm vụ** → mới hiện danh sách đoàn viên đã nộp, có nút quay lại "Danh sách nhiệm vụ".

Trong bước 2 giữ nguyên: 4 tab trạng thái, tìm theo tên đoàn viên / chi đoàn, lọc chi đoàn (admin), xem ảnh, xác nhận / từ chối.

---

## 17. Điểm nhiệm vụ + dọn giao diện chết (2026-10-18)

### Giao diện chết đã bỏ
- **Ô tìm kiếm trên Navbar**: `globalSearch` được lưu state nhưng **không trang nào đọc** — gõ không lọc gì. Đã xóa khỏi Navbar (mỗi trang đã có ô tìm riêng).
- **Ô chọn năm trên Navbar**: đã xóa. Trang **Cấu hình** vẫn còn ô chọn năm, và đó là nơi duy nhất thay đổi được.

### Cách tính điểm mới

`UnitScoreCalculation` đổi cấu trúc:

| Trường | Ý nghĩa |
|---|---|
| `criteriaScore` | Tổng `approved_score` của bài tiêu chí đã duyệt (thang 100) |
| `taskCount` | Số nhiệm vụ đã nộp **và được duyệt**, chỉ đếm nhiệm vụ **có gắn tiêu chí** (`task_sub_criteria`) |
| `taskAssignedCount` | Tổng nhiệm vụ **có gắn tiêu chí** được giao cho chi đoàn |
| `completionRate` | `taskCount / taskAssignedCount × 100` — **không liên quan điểm** |
| `participantCount` | Lượt đoàn viên tham gia (bài cá nhân đã duyệt) |

Bỏ `activityCount` (đổi tên thành `taskCount` và lọc theo tiêu chí).

**Điểm thi đua vẫn = `criteriaScore`.** Nhiệm vụ không cộng điểm — chỉ đếm để theo dõi tiến độ.

### Bảng xếp loại (trang Báo cáo)
- **Hai cột riêng**: "Điểm tiêu chí" (/100) và "Số nhiệm vụ" (đã duyệt / được giao). Không cộng hai cột.
- **Bấm tiêu đề cột** để đổi cách xếp hạng.
- **Bộ lọc "Đếm nhiệm vụ"**: Có gắn tiêu chí (mặc định) / Tất cả.
- Thanh tỷ lệ hoàn thành giờ dùng `completionRate` thật (trước đây vẽ theo `totalScore`).
- Xuất Excel và PDF cập nhật theo hai cột mới.

### Trang Chi đoàn, tab Điểm
Hiện **"Nhiệm vụ: X/Y • Z lượt ĐV"** thay cho số hoạt động cũ.

### Lưu ý nghiệp vụ
Tỷ lệ hoàn thành chỉ đếm nhiệm vụ **có gắn tiêu chí**, trong khi bài tổng hợp lại bắt buộc với **mọi** nhiệm vụ. Chi đoàn có thể phải nộp bài tổng hợp cho 10 nhiệm vụ nhưng tỷ lệ chỉ tính 3 nhiệm vụ có gắn tiêu chí. Đây là lựa chọn có chủ đích của người dùng.

---

## 18. Hoàn tất 7 mục còn lại (2026-10-19)

| # | Mục | Đã làm |
|---|---|---|
| 5 | Gắn tiêu chí cho nhiệm vụ đã tạo | `TaskCriteriaModal`: chọn tiêu chí con của bộ đang chốt, có ô tìm, đặt điểm đóng góp. Nút "Gắn tiêu chí" / "Sửa tiêu chí" ở tab Tổng quan nhiệm vụ. Lưu qua `setTaskSubCriteria` (xóa cũ + ghi mới) |
| 6 | Trang Nộp của bí thư chi đoàn | Khung tiến độ **X/Y đã nộp • Z đã duyệt** + **tên người chưa nộp**. Ô "Số người tham gia" **chỉ đọc**, tự bằng số bài đã duyệt. Chưa duyệt ai → chặn nộp bài tổng hợp |
| 7 | Duyệt tất cả | Nút trong tab Bài đoàn viên, chỉ duyệt bài **đang chờ** (`status = 'pending'`), ghi audit |
| 8 | Tab Kết quả nhiệm vụ | `TaskResultsPanel` — drill-down **5 cấp**: Bộ tiêu chí → Tiêu chí → Chi đoàn → Nhiệm vụ → Tiến độ. Có nhánh riêng "Nhiệm vụ chưa gắn tiêu chí" |
| 9 | Cảnh báo khi đóng | Modal đóng gọi `countUnitsWithoutResult`, hiện đỏ **"Còn N/M chi đoàn chưa nộp: <tên>"**, vẫn cho đóng sau khi gõ `dong` |
| 10 | Báo cáo nhiệm vụ | Bảng "Tổng hợp theo nhiệm vụ" ở trang Báo cáo: tiêu chí (Có/Không), được giao, đã nộp, đã duyệt, lượt ĐV |

### Repository mới
- `setTaskSubCriteria(taskId, items)` — thay toàn bộ tiêu chí đóng góp
- `countUnitsWithoutResult(taskId)` — chi đoàn được giao nhưng chưa nộp
- `approveAllMemberSubmissions(taskId)` — duyệt hàng loạt bài đang chờ

### Lưu ý
- Panel Kết quả nhiệm vụ dùng `listTaskParticipants` (theo từng chi đoàn) ở cấp cuối, nên tiến độ đoàn viên chính xác theo chi đoàn.
- Nhiệm vụ chưa gắn tiêu chí vẫn nộp bài tổng hợp bình thường, nhưng **không** được đếm vào cột "Số nhiệm vụ" ở bảng xếp loại.
- Thanh công cụ lọc/tìm kiếm cũ của tab Kết quả nhiệm vụ vẫn còn hiển thị nhưng không còn tác dụng với panel mới — cần dọn ở lần sau nếu thấy vướng.

---

## 19. Sổ tay cá nhân + bỏ tự chấm tiêu chí (2026-10-19)

### Sổ tay cá nhân — `/so-tay`

| Đặc điểm | Chi tiết |
|---|---|
| Bảng | `journal_entries`, `journal_images`, `journal_links` |
| Riêng tư | RLS chỉ `profile_id = auth.uid()`. **Không có nhánh `is_admin()`** — kể cả super_admin cũng không đọc được |
| Vai trò | Mọi vai trò đều có sổ tay riêng |
| Ảnh | Tối đa 10/hoạt động, lưu bucket `evidences` tại `journal_<uid>/...`; bấm ảnh xem lớn + nút Tải ảnh |
| Link | Nhiều link, mỗi link có ghi chú riêng; nút sao chép |
| Khác | Tên hoạt động, ngày tự chọn (mặc định hôm nay), ghi chú, sửa/xóa |
| Không vào snapshot | `journalEntries` tải riêng qua `refreshJournal()` khi mở trang, không nằm trong `getRawSnapshot` |

**Migration:** `supabase/migrations/phase5_journal.sql` — tạo 3 bảng, bật RLS chỉ chủ sở hữu, thêm policy Storage cho thư mục `journal_<uid>/`.

### Bỏ tự chấm tiêu chí

| Chỗ | Thay đổi |
|---|---|
| `SubmitPage` | Xóa tab "Tiêu chí". Chỉ còn nộp bài tổng hợp nhiệm vụ (giữ nguyên tiến độ + số người tự điền) |
| `ReviewPage` | Xóa tab "Điểm tự chấm". Thanh lọc chỉ hiện ở tab "Bài đoàn viên" |
| `DashboardPage` | Lưới Chi đoàn × Việc bỏ cột tiêu chí; danh sách hoạt động gần đây bỏ mục tự chấm |
| `RemindersPage` | Bỏ quét tiêu chí, chỉ nhắc nhiệm vụ |
| `UnitsPage` | Tab Điểm bỏ ô "Tiêu chí" |
| `ReportsPage` | Bảng xếp loại bỏ cột Điểm tiêu chí và Danh hiệu; **xếp hạng theo số nhiệm vụ tuyệt đối**, kèm cột tỷ lệ để đối chiếu. Biểu đồ phân bố đổi sang mức hoàn thành nhiệm vụ |
| `criterion_submissions` | **Giữ nguyên trong DB**, chỉ ẩn khỏi giao diện — dữ liệu cũ không mất |

### Bộ tiêu chí đổi vai trò
Từ "bảng chấm điểm" → **"danh mục phân loại nhiệm vụ"**. Mỗi nhiệm vụ gắn tiêu chí để biết thuộc lĩnh vực nào; dùng cho drill-down Kết quả nhiệm vụ và cột "Số nhiệm vụ".

### Lưu ý
- Vẫn còn mã liên quan tự chấm ở tầng repository (`submitCriterionSubmission`, `approve('criterion', ...)`) — giữ để không phá dữ liệu cũ, nhưng không còn đường vào từ giao diện.
- Thanh lọc ở trang Duyệt giờ chỉ hiện ở tab "Bài đoàn viên", đúng như yêu cầu.

---

## 20. Module thống kê + sửa số liệu sai (2026-10-19)

### #1. Tab "Thống kê Nhân sự" (mới)

4 thẻ tổng quan + 4 khối chi tiết:

| Khối | Nội dung |
|---|---|
| Tổng quan | Tổng ĐV • Chi đoàn hoạt động • Sắp trưởng thành 12 tháng • Chi đoàn thiếu bí thư |
| Phân bố độ tuổi | Biểu đồ cột 4 nhóm (<18, 18–25, 26–30, >30) |
| Kết nạp theo tháng | Biểu đồ đường 12 tháng gần nhất |
| **Sắp trưởng thành** | Bảng chi tiết + chip màu theo số tháng còn lại + xuất Excel |
| Chi đoàn thiếu bí thư | Danh sách chi đoàn không có `current_position = 'secretary'` |
| Chênh lệch quân số | Top 10 chi đoàn lệch nhiều nhất giữa khai báo và thực tế |

Tính trong `personnelStats` (dùng `members`, `units`, `yearlySettings.matured_age`).

### #2. Sửa `overdueUnitsCount` / `dueSoon7DaysCount` trả cứng 0

`supabaseRepository.getDashboard` nay tính thật:
- **Chi đoàn trễ hạn** = số chi đoàn được giao nhiệm vụ đã quá hạn mà chưa có `task_results` (hoặc bị từ chối)
- **Sắp hết hạn 7 ngày** = nhiệm vụ `published` có `due_date` trong khoảng hôm nay → +7 ngày

### #3. Bảng `warnings` — thêm `syncWarnings()`

Trước đây bảng luôn rỗng vì không có lệnh insert nào. Nay `syncWarnings()`:
- Quét nhiệm vụ `published` quá hạn hoặc còn ≤3 ngày
- Với mỗi chi đoàn chưa nộp → tạo cảnh báo `OVERDUE` (đỏ) hoặc `DUE_SOON` (vàng/cam)
- **Idempotent**: mỗi cặp (chi đoàn, nhiệm vụ, mã) chỉ có tối đa một cảnh báo đang mở
- Gọi tự động khi mở trang **Nhắc nhở**, báo toast nếu có cảnh báo mới

### #4. Tab "Mức độ Tham gia" (mới)

| Khối | Nội dung |
|---|---|
| Tổng quan | Lượt bấm tham gia • Lượt nộp bài • **Tham gia nhưng không nộp** • Chưa từng tham gia |
| Cảnh báo khoảng cách ý định–hành động | Hiện khi số bấm tham gia > số nộp thật |
| Bảng theo chi đoàn | Tỷ lệ đoàn viên có tham gia, số lượt bấm/nộp/duyệt, thanh tỷ lệ màu; xuất Excel |
| Top đoàn viên tích cực | Top 10 theo số bài được duyệt |
| Chưa từng tham gia | Danh sách + xuất Excel để đôn đốc |

### #5. Báo cáo định kỳ — số liệu thật

`handlePublishReport` nay đóng gói số liệu **trong kỳ** (`period_start` → `period_end`):
- Số nhiệm vụ trong kỳ, bài nộp/duyệt/chờ/từ chối, bài cá nhân, lượt tham gia, đoàn viên mới, tỷ lệ duyệt
- `byUnit`: bảng chi tiết từng chi đoàn (nộp/duyệt/lượt ĐV)
- `personnel`: nhóm tuổi, số sắp trưởng thành, chi đoàn thiếu bí thư
- `participation`: tổng hợp tham gia

Modal chi tiết báo cáo hiển thị thật các số này (trước đây là câu cứng "31 chi đoàn").

### Còn chưa làm
- `updateTask` vẫn không ghi DB (chưa có nút sửa nhiệm vụ trên UI)
- Gửi nhắc theo lịch hẹn vẫn chỉ lưu state, không có cron
- Xuất Word (.docx) chưa hỗ trợ
