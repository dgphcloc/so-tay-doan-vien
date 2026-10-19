# Kịch bản kiểm thử — Nộp minh chứng cá nhân + duyệt 2 cấp (Giai đoạn 3)

Tài liệu này để chạy tay trên bản build mới nhất. Mỗi case ghi rõ **tiền đề → từng bước → kết quả mong đợi (kể cả chữ hiện trên màn hình)**.

Tổng: **48 case** trong 7 nhóm.

---

## 0. Chuẩn bị

### Tài khoản cần có

| Ký hiệu | Vai trò | Ghi chú |
|---|---|---|
| **A** | `super_admin` hoặc `admin` (bí thư xã) | ví dụ `admin@example.com`. `admin` **không** thấy menu "Tài khoản & quyền" và "Nhật ký"; `super_admin` thấy hết |
| **S** | `unit_secretary` (bí thư chi đoàn) | cần biết S thuộc chi đoàn nào (gọi là **CĐ-S**) |
| **S2** | `unit_secretary` của chi đoàn khác | chỉ cần cho case D9, D10 |
| **M** | `member` (đoàn viên), thuộc **CĐ-S** | ví dụ `dv1@example.com` / `123456` |
| **M2** | `member` thuộc chi đoàn **KHÁC** CĐ-S | bắt buộc cho nhóm A. Nếu chưa có, tạo bằng `scripts/create-accounts.mjs` |

### Dữ liệu cần chuẩn bị trước

- **CĐ-S phải có ít nhất 3 đoàn viên đang hoạt động**, để case D4 kiểm tra "ai chưa nộp".
- Có ít nhất 1 nhiệm vụ đã phát động cho CĐ-S (tạo trong nhóm A).
- Bật sẵn quyền vị trí (GPS) cho trình duyệt ở `localhost` nếu muốn test ảnh có GPS thật.

### Mẹo đọc kết quả

- Sau mỗi thao tác ghi dữ liệu, **luôn bấm F5** rồi kiểm tra lại. Đây là điểm hay lỗi nhất.
- Thông báo nổi (toast) hiện ở góc trên bên phải; màu xanh là thành công, đỏ là lỗi.

---

## Nhóm 0 — Migration (2 case)

### Case 0.1 — Chạy migration
**Bước:**
1. Mở Supabase → SQL Editor.
2. Dán toàn bộ nội dung `supabase/migrations/phase3_member_submissions.sql`.
3. Bấm Run.

**Kết quả mong đợi:**
- Chạy xong không báo lỗi.
- Dòng cuối hiện kết quả `select count(*) as so_bai_nop_ca_nhan from public.member_submissions;` → giá trị `0`.
- Bảng `member_submissions` xuất hiện trong Table Editor.

### Case 0.2 — Chạy lại migration lần hai (idempotent)
**Bước:** Chạy lại y nguyên file SQL lần nữa.

**Kết quả mong đợi:**
- Không lỗi. Không bị nhân đôi cột/ràng buộc. `so_bai_nop_ca_nhan` vẫn là `0` (hoặc số cũ, không tăng).

> Nếu case 0.1 lỗi ở dòng `alter table public.evidences ... evidences_one_target`, nghĩa là tên ràng buộc trong DB khác. Báo tôi tên thật để sửa.

---

## Nhóm A — Phạm vi nộp nhiệm vụ (10 case)

### Case A1 — Tạo nhiệm vụ phạm vi "chỉ đoàn viên được giao"
**Tiền đề:** đăng nhập **A**.
**Bước:**
1. Menu **Công việc → Nhiệm vụ**.
2. Bấm nút **Tạo nhiệm vụ mới**.
3. Bước 1/4 "Thông tin chung": nhập **Tên nhiệm vụ** = `TEST-A1 Ra quân vệ sinh`, chọn **Hạn chót hoàn thành** = hôm nay +7 ngày.
4. Ở ô **Phạm vi nộp minh chứng cá nhân**, chọn **"Chỉ đoàn viên thuộc chi đoàn được giao"**.
5. Bấm **Tiếp tục** → Bước 2/4 chọn chi đoàn **CĐ-S** → **Tiếp tục** → Bước 3/4 (bỏ qua, không gắn tiêu chí) → **Tiếp tục** → Bước 4/4.
6. Bấm **Phát động ngay**.

**Kết quả mong đợi:**
- Hộp thoại tạo nhiệm vụ đóng lại.
- Danh sách tự chuyển sang tab **Đã đăng**, nhiệm vụ `TEST-A1 Ra quân vệ sinh` nằm đầu danh sách.
- **F5**: nhiệm vụ vẫn còn trong tab **Đã đăng**.
- Bấm vào nhiệm vụ → tab **Tổng quan** → có ô màu vàng ghi **"Phạm vi nộp minh chứng cá nhân:"** và nội dung **"Chỉ đoàn viên thuộc chi đoàn được giao"**.

### Case A2 — Tạo nhiệm vụ phạm vi "ai cũng tham gia"
**Bước:** lặp lại A1, nhưng tên `TEST-A2 Dọn nghĩa trang` và ở bước 1 chọn **"Ai cũng tham gia được"**.

**Kết quả mong đợi:**
- Tạo được. Tab **Tổng quan** hiện ô vàng với nội dung **"Ai cũng tham gia được"**.
- **F5** vẫn giữ đúng phạm vi này (không tự quay về "chỉ đoàn viên được giao").

### Case A3 — Nhân bản giữ nguyên phạm vi
**Bước:**
1. Trong tab **Đã đăng**, ở dòng nhiệm vụ `TEST-A2`, bấm icon **Nhân bản** (biểu tượng hai tờ giấy) ở cột cuối.
2. Chuyển sang tab **Bản nháp**, mở nhiệm vụ `TEST-A2 Dọn nghĩa trang (Bản sao)`.

**Kết quả mong đợi:**
- Bản sao nằm trong tab **Bản nháp**.
- Tab **Tổng quan** của bản sao hiện phạm vi **"Ai cũng tham gia được"** (giống bản gốc).

### Case A4 — Nhiệm vụ nháp không hiện cho đoàn viên
**Bước:**
1. Tạo nhiệm vụ mới, tên `TEST-A4 Nhiệm vụ nháp`, ở bước 4/4 bấm **Lưu nháp**.
2. Sang tab **Bản nháp**, mở nhiệm vụ đó, ghi lại id trên thanh địa chỉ của trang (không cần, chỉ để đối chiếu).
3. Đăng nhập **M**, mở **Nộp cá nhân**, và mở **Bảng tin**.

**Kết quả mong đợi:**
- `TEST-A4 Nhiệm vụ nháp` **không** xuất hiện ở **Nộp cá nhân** lẫn **Bảng tin**.
- Nếu gõ tay URL `.../#/nop-ca-nhan?task=<id nhiệm vụ nháp>`: hiện **"Không tìm thấy nhiệm vụ này trong danh sách của bạn..."** kèm link **"Về danh sách nhiệm vụ"**, không có form nộp.
- Nút **Tạo QR** không hiện ở chi tiết nhiệm vụ nháp (nên không lấy được link từ UI).

### Case A5 — Đoàn viên cùng chi đoàn được giao: nộp được
**Tiền đề:** đăng nhập **M** (thuộc CĐ-S).
**Bước:**
1. Menu **Nộp cá nhân**.
2. Tìm thẻ nhiệm vụ `TEST-A1 Ra quân vệ sinh`.

**Kết quả mong đợi:**
- Thẻ nhiệm vụ hiện: tên, mô tả, **Hạn: dd/mm/yyyy**, chip xám **"Theo chi đoàn được giao"**, chip trạng thái **"Chưa nộp"**, nút xanh **"Nộp"**.

### Case A6 — Đoàn viên chi đoàn KHÁC bị chặn với nhiệm vụ "assigned"
**Tiền đề:** đăng nhập **M2** (chi đoàn khác CĐ-S).
**Bước:** mở link `.../#/nop-ca-nhan?task=<id của TEST-A1>`.

**Kết quả mong đợi:**
- Hiện **"Không tìm thấy nhiệm vụ này trong danh sách của bạn..."**.
- Nhiệm vụ `TEST-A1` **không** xuất hiện trong danh sách ở `/nop-ca-nhan`.
- Kể cả gọi thẳng API cũng phải bị chặn (xem case A10).

### Case A7 — Đoàn viên chi đoàn KHÁC nộp được nhiệm vụ "open"
**Tiền đề:** vẫn đăng nhập **M2**.
**Bước:** mở link `.../#/nop-ca-nhan?task=<id của TEST-A2>`.

**Kết quả mong đợi:**
- Thẻ nhiệm vụ `TEST-A2` hiện chip xám **"Ai cũng tham gia"**.
- Mở được form nộp đầy đủ (không bị chặn).

### Case A8 — Bí thư chi đoàn chỉ giao được cho chi đoàn mình
**Tiền đề:** đăng nhập **S**.
**Bước:**
1. **Nhiệm vụ → Tạo nhiệm vụ mới** → điền tên `TEST-A8`, **Tiếp tục**.
2. Ở bước 2/4, quan sát danh sách chi đoàn.

**Kết quả mong đợi:**
- Chỉ hiện **CĐ-S** (không hiện các chi đoàn khác để chọn).
- Nếu cố bỏ chọn hết rồi bấm **Tiếp tục**, hiện toast đỏ **"Chặn thao tác"** / **"Vui lòng chọn ít nhất một chi đoàn được giao!"**.

### Case A9 — Bộ lọc nhiệm vụ của bí thư chi đoàn
**Tiền đề:** đăng nhập **S**, vào **Nhiệm vụ**.
**Bước:** bấm lần lượt các nút lọc **Tất cả**, **Do tôi tạo**, **Chi đoàn tôi**.

**Kết quả mong đợi:**
- **Tất cả**: chỉ thấy nhiệm vụ giao cho CĐ-S hoặc do S tạo (không thấy nhiệm vụ của chi đoàn khác).
- **Do tôi tạo**: chỉ nhiệm vụ `assigned_by` = S.
- **Chi đoàn tôi**: chỉ nhiệm vụ giao cho CĐ-S.

### Case A10 — Không nộp vượt phạm vi ở tầng dữ liệu (RLS)
**Tiền đề:** đăng nhập **M2** (chi đoàn khác CĐ-S).
**Bước:**
1. Mở Supabase → Table Editor → `member_submissions` → ghi lại số dòng hiện có.
2. Đăng nhập **M2**, mở link `.../#/nop-ca-nhan?task=<id của TEST-A1>` (nhiệm vụ `assigned` của CĐ-S).
3. Cố nộp nếu form hiện ra (bình thường sẽ không hiện form, xem A6).
4. Quay lại Supabase, bấm Refresh bảng `member_submissions`.

**Kết quả mong đợi:**
- Số dòng **không tăng**; không có dòng nào mang `member_id` của M2 và `task_id` của TEST-A1.
- Mọi dòng `member_submissions` của M2 đều có `unit_id` = chi đoàn của M2.

**Kiểm tra thêm (tùy chọn):** trong Table Editor, thử sửa một dòng bất kỳ do đoàn viên khác tạo — Supabase sẽ từ chối nếu RLS đang bật đúng. Cách này chỉ để xác nhận RLS đang bật, không phải luồng người dùng thật.

---

## Nhóm B — Nộp minh chứng cá nhân (14 case)

### Case B1 — Nộp ảnh có GPS + ghi chú
**Tiền đề:** đăng nhập **M**.
**Bước:**
1. **Nộp cá nhân** → mở `TEST-A1 Ra quân vệ sinh`.
2. Ở ô **Ghi chú (tuỳ chọn)**, nhập `Đã hoàn thành, 5 đoàn viên tham gia`.
3. Bấm **Chọn ảnh**, chọn 1 ảnh.
4. Cho phép trình duyệt truy cập vị trí khi được hỏi.
5. Bấm **Nộp minh chứng**.

**Kết quả mong đợi:**
- Toast xanh: **"Đã gửi bài nộp"** / **"Chờ bí thư chi đoàn xác nhận."**
- Ảnh hiện trong lưới với dòng chữ xanh **"9.xxxxx, 105.xxxxx"** (toạ độ).
- Sau khi nộp, đầu trang hiện dải vàng **"Bài nộp đang chờ bí thư chi đoàn xác nhận."**
- Nút dưới cùng đổi thành **"Nộp lại"**.
- **F5**: bài nộp vẫn còn, ảnh và ghi chú vẫn hiện.

### Case B2 — Nhập toạ độ bằng tay khi trình duyệt chặn định vị
**Bước:**
1. Vào lại bài nộp của `TEST-A2` (nhiệm vụ open, M nộp được).
2. Trong trình duyệt, **chặn quyền vị trí** cho trang (biểu tượng ổ khoá → Location → Block).
3. Bấm **Chọn ảnh**, chọn ảnh.
4. Khi có toast vàng **"Không lấy được GPS"**, bấm OK.
5. Ở ô **Toạ độ GPS (nhập tay...)**, nhập Vĩ độ `9.18240`, Kinh độ `105.15280`.
6. Bấm **Gán toạ độ**.
7. Bấm **Nộp minh chứng**.

**Kết quả mong đợi:**
- Toast xanh **"Đã gán toạ độ cho ảnh thiếu GPS"**.
- Ảnh hết nhãn vàng **"Thiếu GPS"**, đổi thành toạ độ màu xanh.
- Nộp thành công (không bị chặn).

### Case B3 — Nhập toạ độ sai định dạng
**Bước:** ở ô nhập tay, nhập Vĩ độ `abc`, Kinh độ `999`, rồi bấm **Gán toạ độ**.

**Kết quả mong đợi:**
- Toast đỏ **"Toạ độ chưa hợp lệ"** / **"Nhập vĩ độ (-90..90) và kinh độ (-180..180)."**
- Ảnh vẫn giữ nhãn **"Thiếu GPS"**.

### Case B4 — Ảnh thiếu GPS bị chặn khi cấu hình bắt buộc GPS
**Tiền đề:** đăng nhập **A** → **Cấu hình** → bật **Bắt buộc ảnh có toạ độ GPS** (nếu đang tắt) → Lưu.
**Bước:**
1. Đăng nhập **M**, mở một nhiệm vụ chưa nộp.
2. Chặn quyền vị trí, thêm ảnh (không nhập toạ độ tay).
3. Bấm **Nộp minh chứng**.

**Kết quả mong đợi:**
- Toast đỏ **"Thiếu toạ độ GPS"** / **"Ảnh minh chứng bắt buộc có toạ độ GPS. Bật quyền vị trí, hoặc nhập toạ độ bằng tay rồi bấm "Gán toạ độ"."**
- Không tạo bài nộp.

### Case B5 — Nộp đủ loại minh chứng (ảnh + tệp + link + ghi chú)
**Bước:**
1. Mở nhiệm vụ chưa nộp, thêm: 1 ảnh, 1 tệp (PDF/Word) qua **Chọn tệp**, dán 2 link vào ô **Link minh chứng** cách nhau dấu phẩy, nhập ô **Ghi chú minh chứng**.
2. Bấm **Nộp minh chứng**.
3. **F5**.

**Kết quả mong đợi:**
- Toast xanh **"Đã gửi bài nộp"**.
- Sau F5, mở lại bài nộp: còn 1 ảnh, 1 tệp, 2 link (cách nhau dấu phẩy), 1 ghi chú.
- Không bị lỗi ràng buộc "chỉ được 1 trong 3 đích minh chứng".

### Case B6 — Giới hạn số lượng minh chứng
**Bước:** thêm ảnh cho tới khi vượt `max_photos` trong **Cấu hình**.

**Kết quả mong đợi:**
- Nút **Chọn ảnh** / **Chụp ảnh** bị mờ (disabled) khi đã đủ số.
- Nếu cố thêm, toast đỏ **"Tối đa N ảnh"**.

### Case B7 — Nộp lại khi đang chờ duyệt
**Tiền đề:** bài nộp của M ở trạng thái chờ duyệt.
**Bước:**
1. Mở lại bài nộp, đổi **Ghi chú** thành `Bản sửa lần 2`, bấm **Nộp lại**.

**Kết quả mong đợi:**
- Toast xanh **"Đã gửi bài nộp"**.
- **F5**: ghi chú là `Bản sửa lần 2`. Không sinh thêm bản ghi thứ hai (vẫn 1 bài trong tab **Bài đoàn viên** của bí thư).
- Trạng thái vẫn là chờ duyệt.

### Case B8 — Bị từ chối rồi nộp lại
**Tiền đề:** S đã từ chối bài của M (làm ở case D5 trước).
**Bước:** M mở lại bài nộp.

**Kết quả mong đợi:**
- Dải đỏ hiện **"Bài nộp bị từ chối: <lý do>. Bạn nộp lại được."**
- Nút **Nộp lại** hoạt động. Nộp xong trạng thái quay về chờ duyệt.

### Case B9 — Bài đã duyệt thì không sửa được
**Tiền đề:** S đã xác nhận bài của M (case D4).
**Bước:** M mở lại bài nộp đó.

**Kết quả mong đợi:**
- Dải xanh **"Bài nộp đã được bí thư chi đoàn xác nhận."**
- Khối form biến mất, thay bằng thông báo **"Bài nộp đã được duyệt nên không sửa được nữa. Nếu cần điều chỉnh, liên hệ bí thư chi đoàn."**

### Case B10 — Bảng tin hiện trạng thái nộp
**Tiền đề:** đăng nhập **M**.
**Bước:** mở **Bảng tin**, quan sát thẻ nhiệm vụ vừa nộp.

**Kết quả mong đợi:**
- Thẻ hiện chip trạng thái đúng: **"Chờ bí thư chi đoàn duyệt"** (vàng) / **"Đã được duyệt"** (xanh) / **"Bị từ chối: ..."** (đỏ).
- Nút đổi từ **"Nộp minh chứng"** thành **"Xem / nộp lại"**.
- Không còn hiện **"Chưa nộp minh chứng"** cho nhiệm vụ đã nộp.

### Case B11 — Nút tham gia/từ chối vẫn độc lập với nộp
**Bước:** trên bảng tin, bấm **Từ chối** một nhiệm vụ, rồi bấm **Nộp minh chứng** cho chính nhiệm vụ đó.

**Kết quả mong đợi:**
- Nút **Từ chối** chuyển thành **"Đã từ chối"**.
- Vẫn nộp minh chứng được bình thường (không bắt buộc phải bấm tham gia trước).
- Bí thư vẫn thấy số **"X đoàn viên đã xác nhận tham gia"** tăng/giảm theo nút tham gia.

### Case B12 — Đoàn viên không vào được trang nộp của chi đoàn
**Bước:** đăng nhập **M**, gõ thẳng URL `.../#/nop-minh-chung`.

**Kết quả mong đợi:**
- Bị chuyển hướng về `/nop-ca-nhan` (trang mặc định của `member`).
- Nếu vì lý do nào đó vẫn vào được, phải thấy thông báo **"Trang này dành cho bí thư chi đoàn nộp bài tổng hợp. Đoàn viên vui lòng nộp minh chứng cá nhân tại mục "Nộp cá nhân"."**

### Case B13 — Đoàn viên chưa gắn chi đoàn
**Tiền đề:** một tài khoản `member` có `profiles.member_id = null`.
**Bước:** đăng nhập tài khoản đó, mở **Nộp cá nhân**.

**Kết quả mong đợi:**
- Hiện **"Tài khoản chưa gắn với chi đoàn nào. Liên hệ cán bộ Đoàn xã để được gắn hồ sơ đoàn viên."**
- Không có form nộp.

### Case B14 — Bảng tin rỗng khi chi đoàn không có nhiệm vụ
**Tiền đề:** một chi đoàn chưa được giao nhiệm vụ nào và không có nhiệm vụ `open`.
**Bước:** đăng nhập đoàn viên chi đoàn đó, mở **Nộp cá nhân**.

**Kết quả mong đợi:**
- Hiện **"Chưa có nhiệm vụ nào cần nộp."** với icon minh hoạ.
- Không có lỗi trắng trang.

---

## Nhóm C — QR (4 case)

### Case C1 — Tạo QR cho nhiệm vụ đã phát động
**Tiền đề:** đăng nhập **A**.
**Bước:**
1. **Nhiệm vụ** → tab **Đã đăng** → mở `TEST-A1`.
2. Bấm nút xanh **Tạo QR**.

**Kết quả mong đợi:**
- Hộp thoại **"QR nộp minh chứng cá nhân"** hiện ra kèm tên nhiệm vụ.
- Mã QR hiện rõ, quét được.
- Bên dưới có dòng link dạng `http://localhost:5173/#/nop-ca-nhan?task=123` (bôi đen được).
- Hai nút: **Sao chép link**, **Tải ảnh QR**.

### Case C2 — Sao chép và tải ảnh QR
**Bước:** bấm **Sao chép link**, rồi bấm **Tải ảnh QR**.

**Kết quả mong đợi:**
- Toast xanh **"Đã sao chép link"**; dán ra thấy đúng link.
- Tải về file `QR_nop_minh_chung_<id>.png`, mở lên là ảnh QR.

### Case C3 — Tạo QR chỉ có ở nhiệm vụ đã phát động
**Bước:** mở một nhiệm vụ trong tab **Bản nháp**, và một nhiệm vụ trong tab **Đã đóng**.

**Kết quả mong đợi:**
- Nút **Tạo QR** chỉ hiện với nhiệm vụ ở tab **Đã đăng**.
- Không hiện ở nhiệm vụ nháp và nhiệm vụ đã đóng.

### Case C4 — Quét QR khi chưa đăng nhập
**Bước:**
1. Mở cửa sổ ẩn danh (chưa có phiên đăng nhập).
2. Quét QR bằng điện thoại, hoặc dán link vào cửa sổ ẩn danh.

**Kết quả mong đợi:**
- Hiện trang **Đăng nhập** (Email, Mật khẩu, nút **Đăng nhập**).
- Đăng nhập bằng **M** → vào thẳng trang nộp của đúng nhiệm vụ đó (không bị đưa về trang chủ).

---

## Nhóm D — Duyệt 2 cấp (10 case)

### Case D1 — Bí thư chi đoàn chỉ thấy bài chi đoàn mình
**Tiền đề:** đăng nhập **S**, đã có bài nộp của M ở CĐ-S.
**Bước:** mở **Chờ duyệt** → tab **Bài đoàn viên**.

**Kết quả mong đợi:**
- Tab **Bài đoàn viên** có số đếm màu xanh = số bài chờ duyệt của CĐ-S.
- Danh sách chỉ có bài của đoàn viên CĐ-S. **Không** có bài của chi đoàn khác.
- **Không** hiện ô lọc "Tất cả chi đoàn" (chỉ admin mới có).

### Case D2 — Xem chi tiết bài nộp
**Bước:** bấm vào một bài trong danh sách.

**Kết quả mong đợi:**
- Cột phải hiện: tên đoàn viên, tên nhiệm vụ, chi đoàn, **Nộp: dd/mm/yyyy hh:mm**, toạ độ GPS màu xanh (hoặc cảnh báo vàng **"Không có GPS"**).
- Ghi chú của đoàn viên (nếu có) trong khung xám.
- Lưới ảnh có toạ độ từng ảnh; danh sách tệp và link bấm mở được; ghi chú minh chứng.
- Hai nút: **Từ chối**, **Xác nhận bài nộp**.

### Case D3 — Xem ảnh phóng to
**Bước:** bấm vào một ảnh trong lưới.

**Kết quả mong đợi:**
- Ảnh mở lớn trên nền đen, có nút **Đóng**. Bấm ra ngoài cũng đóng.

### Case D4 — Xác nhận bài nộp
**Bước:** bấm **Xác nhận bài nộp**.

**Kết quả mong đợi:**
- Toast xanh **"Đã xác nhận bài nộp"**.
- Bài chuyển sang tab **Đã xác nhận**; số đếm **Chờ duyệt** giảm 1.
- **F5**: trạng thái vẫn là đã xác nhận (không quay lại chờ duyệt).
- Phía đoàn viên M: bảng tin và trang nộp hiện **"Đã được duyệt"** / dải xanh.
- Ở trang **Chi đoàn** → chi tiết CĐ-S → tab **Điểm**: dòng **"Hoạt động"** hiện số **lượt ĐV** tăng lên 1.

### Case D5 — Từ chối phải nhập lý do
**Bước:**
1. Mở một bài chờ duyệt, bấm **Từ chối**.
2. Để trống ô lý do, quan sát nút **Xác nhận từ chối**.
3. Nhập lý do `Ảnh mờ, thiếu toạ độ GPS`, bấm **Xác nhận từ chối**.

**Kết quả mong đợi:**
- Khi để trống: nút **Xác nhận từ chối** bị mờ, không bấm được.
- Sau khi nhập và xác nhận: toast xanh **"Đã từ chối bài nộp"**.
- Bài sang tab **Bị từ chối**. Khung ghi chú duyệt hiện đỏ với lý do vừa nhập.
- Phía M: bảng tin hiện chip đỏ **"Bị từ chối: Ảnh mờ, thiếu toạ độ GPS"**.

### Case D6 — Nút Huỷ trong luồng từ chối
**Bước:** bấm **Từ chối**, nhập lý do, rồi bấm **Huỷ**.

**Kết quả mong đợi:**
- Quay lại hai nút **Từ chối** / **Xác nhận bài nộp**.
- Ô lý do được xoá trắng.
- Bài **không** đổi trạng thái.

### Case D7 — Bốn tab lọc trạng thái
**Bước:** bấm lần lượt **Chờ duyệt**, **Đã xác nhận**, **Bị từ chối**, **Tất cả**.

**Kết quả mong đợi:**
- Mỗi tab chỉ hiện đúng nhóm trạng thái đó; **Tất cả** hiện hết.
- Số trong ngoặc của 4 tab cộng lại khớp với **Tất cả**.

### Case D8 — Tìm kiếm bài nộp
**Bước:** gõ tên đoàn viên M vào ô **"Tìm theo tên đoàn viên, nhiệm vụ, chi đoàn..."**.

**Kết quả mong đợi:**
- Danh sách lọc còn đúng bài của M.
- Gõ tên nhiệm vụ cũng lọc được. Xoá ô tìm kiếm thì hiện lại đủ.

### Case D9 — Bí thư xã thấy tất cả và lọc theo chi đoàn
**Tiền đề:** đăng nhập **A**, có bài nộp từ ≥2 chi đoàn.
**Bước:** mở **Chờ duyệt** → tab **Bài đoàn viên**.

**Kết quả mong đợi:**
- Thấy bài của nhiều chi đoàn khác nhau.
- Có dropdown **"Tất cả chi đoàn"**; chọn CĐ-S thì chỉ còn bài của CĐ-S.
- Ô tìm kiếm gõ tên chi đoàn cũng lọc đúng.

### Case D10 — Cô lập giữa hai bí thư chi đoàn
**Tiền đề:** đăng nhập **S2** (chi đoàn khác), có bài nộp ở chi đoàn của S2.
**Bước:** mở **Chờ duyệt** → tab **Bài đoàn viên**.

**Kết quả mong đợi:**
- S2 **không** thấy bài của CĐ-S; S cũng **không** thấy bài của chi đoàn S2.
- Nếu S cố duyệt bài của chi đoàn khác bằng cách gọi thẳng API → bị RLS từ chối.

---

## Nhóm E — Điểm và xếp loại (6 case)

### Case E1 — Nhiệm vụ không cộng điểm thi đua
**Tiền đề:** ghi lại điểm của CĐ-S trước khi duyệt (ở **Báo cáo** → bảng xếp loại).
**Bước:**
1. Đăng nhập **A**, duyệt xong 1 bài nộp cá nhân và 1 bài nộp tổng hợp của CĐ-S.
2. Mở **Báo cáo**, xem lại điểm CĐ-S.

**Kết quả mong đợi:**
- Điểm thi đua của CĐ-S **không tăng** vì nhiệm vụ.
- Chỉ tăng khi duyệt bài **tiêu chí** (làm ở case E3).

### Case E2 — Trang Chi đoàn, tab Điểm
**Bước:** **Chi đoàn** → mở CĐ-S → tab **5. Điểm**.

**Kết quả mong đợi:**
- Ba ô: **Tổng điểm: Xđ**, **Hoạt động: N nhiệm vụ • M lượt ĐV**, **Tiêu chí: Yđ**.
- **Tổng điểm = Tiêu chí** (bằng nhau).
- **Không** còn hiện số cứng `24` và `22` như trước.
- Số **nhiệm vụ** khớp số bài tổng hợp đã duyệt; số **lượt ĐV** khớp số bài cá nhân đã duyệt.

### Case E3 — Duyệt tiêu chí mới cộng điểm
**Bước:** **Chờ duyệt** → tab **Điểm tự chấm** → duyệt một bài với điểm cụ thể → xem lại **Chi đoàn → Điểm**.

**Kết quả mong đợi:**
- **Tiêu chí** và **Tổng điểm** tăng đúng bằng điểm vừa duyệt.
- **Hoạt động** không đổi.

### Case E4 — Bảng xếp loại thi đua
**Bước:** **Báo cáo**, xem bảng xếp loại.

**Kết quả mong đợi:**
- Xếp hạng theo **Tổng điểm** = điểm tiêu chí.
- Tỷ lệ hoàn thành tính trên mốc 100 điểm (không còn mốc 150).

### Case E5 — Dashboard không đếm nhiệm vụ vào điểm
**Bước:** mở **Tổng quan** bằng **A** và bằng **S**.

**Kết quả mong đợi:**
- Biểu đồ/thẻ điểm khớp với điểm tiêu chí.
- Với **S**: chỉ hiện dữ liệu chi đoàn mình, có thẻ **"Việc trễ hạn của chi đoàn"**.

### Case E6 — Điểm không âm và không vượt trần
**Bước:** duyệt một bài tiêu chí với điểm tối đa, xem lại **Chi đoàn → Điểm**.

**Kết quả mong đợi:**
- **Tỷ lệ hoàn thành** không vượt quá 100%.
- Điểm không âm.

---

## Nhóm F — Hồi quy chức năng cũ (12 case)

> Mục đích: chắc chắn các thay đổi giai đoạn 3 không làm hỏng thứ đã chạy được.

### Case F1 — Xuất Excel danh sách đoàn viên
**Bước:** **Đoàn viên** → bấm **Xuất Excel (N)**.

**Kết quả mong đợi:**
- Tải file `Danh_sach_doan_vien_<yyyy-mm-dd>.xlsx`.
- Toast xanh **"Đã xuất file Excel"** / **"N đoàn viên theo bộ lọc hiện tại."**
- Mở file: có tiêu đề **DANH SÁCH ĐOÀN VIÊN**, đúng số dòng theo bộ lọc, cột SĐT **bị che** nếu đang đăng nhập bằng `staff`.

### Case F2 — Xuất Excel bảng xếp loại
**Bước:** **Báo cáo** → bấm **Xuất Excel**.

**Kết quả mong đợi:**
- Tải file `Bang_xep_loai_thi_dua_<năm>.xlsx` với các cột hạng, tên chi đoàn, số đoàn viên, tổng điểm, điểm tối đa, tỷ lệ.

### Case F3 — PDF/Word báo "chưa hỗ trợ"
**Bước:** **Báo cáo** → bấm **Xuất PDF/Word** hoặc **Tải PDF**.

**Kết quả mong đợi:**
- Toast **"Hiện chỉ hỗ trợ xuất Excel. Định dạng PDF sẽ được bổ sung sau."**
- **Không** tải file giả, không báo thành công sai.

### Case F4 — Xuất nhật ký
**Tiền đề:** đăng nhập `super_admin`.
**Bước:** **Nhật ký** → bấm **Xuất nhật ký (Excel)**.

**Kết quả mong đợi:**
- Tải file Excel với thời gian, người thao tác, vai trò, hành động, bảng, chi tiết.
- Có dòng **"Duyệt bài nộp cá nhân"** / **"Từ chối bài nộp cá nhân"** từ case D4/D5.

### Case F5 — Nhật ký ghi thao tác duyệt bài cá nhân
**Bước:** sau khi duyệt ở D4, mở **Nhật ký**, tìm `member_submissions`.

**Kết quả mong đợi:**
- Có bản ghi hành động **Duyệt bài nộp cá nhân** (hoặc **Từ chối bài nộp cá nhân**), bảng `member_submissions`, có giá trị cũ `pending` và mới `approved`/`rejected`.

### Case F6 — Gửi nhắc tất cả hôm nay
**Tiền đề:** đăng nhập **A**, có nhiệm vụ sắp tới hạn mà chi đoàn chưa nộp.
**Bước:** **Nhắc nhở** → bấm **Gửi tất cả hôm nay (N Chi đoàn)**.

**Kết quả mong đợi:**
- Toast xanh **"Đã gửi thông báo hàng loạt"**.
- Bí thư các chi đoàn chưa nộp nhận được thông báo.
- Nếu không có gì để gửi: toast **"Không có thông báo cần gửi"**.

### Case F7 — Tạo nhắc nhở tùy biến
**Bước:** **Nhắc nhở** → **Tạo nhắc nhở tùy biến** → chọn đối tượng nhận (chi đoàn hoặc đoàn viên cụ thể) → nhập nội dung → **Gửi thông báo ngay**.

**Kết quả mong đợi:**
- Gửi thành công, thông báo tới đúng người nhận.
- Để trống nội dung: toast đỏ **"Vui lòng nhập nội dung nhắc nhở"**.
- Chọn chế độ **Lên lịch gửi**: **không** gửi thật (chưa hỗ trợ tự động), chỉ lưu vào danh sách.

### Case F8 — Đoàn viên tự sửa hồ sơ
**Bước:** đăng nhập **M** → **Hồ sơ của tôi** → sửa **Số điện thoại**, **Nghề nghiệp hiện tại** → Lưu.

**Kết quả mong đợi:**
- Toast xanh **"Đã lưu hồ sơ"**.
- **F5** dữ liệu vẫn còn.
- Các trường nhạy cảm (họ tên, ngày sinh, chi đoàn, chức vụ) **không** sửa được (chỉ hiển thị).

### Case F9 — Nhập đoàn viên từ Excel
**Bước:** **Đoàn viên** → **Nhập từ Excel** → chọn file mẫu → làm theo wizard.

**Kết quả mong đợi:**
- Đọc được file, xem trước số dòng hợp lệ, nhập xong toast **"Đã nhập N đoàn viên"**.
- **F5**: danh sách tăng đúng N.

### Case F10 — Bí thư chi đoàn vẫn nộp bài tổng hợp
**Tiền đề:** đăng nhập **S**.
**Bước:** **Nộp minh chứng** (`/nop-minh-chung`) → chọn một nhiệm vụ → thêm ảnh → **Nộp minh chứng**.

**Kết quả mong đợi:**
- Nộp được bình thường (luồng cũ không bị chặn).
- Bài vào **Chờ duyệt** ở tab **Kết quả nhiệm vụ** của bí thư xã.
- **F5** vẫn còn.

### Case F11 — Ma trận tiêu chí và nhập tiêu chí từ Excel
**Bước:** đăng nhập **A** → **Tiêu chí** → chọn bộ tiêu chí → mở cây và ma trận; thử nhập một bộ từ Excel.

**Kết quả mong đợi:**
- Cây hiện đúng số Phần / Tiêu chí / tiêu chí con của bộ đang chọn.
- Nhãn **"Giao: ..."** hiện đúng chi đoàn; ô không giao hiện **"Không áp dụng"**.
- Nhập Excel xong tự chuyển sang bộ vừa tạo, hiện nhãn **"Đang soạn"**.

### Case F12 — Phân quyền khi gõ URL trực tiếp
**Bước:** lần lượt đăng nhập **M**, **S**, **staff**, **admin**, rồi gõ thẳng từng URL: `/duyet`, `/nhiem-vu`, `/tieu-chi`, `/nhac-nho`, `/chi-doan`, `/doan-vien`, `/ban-chap-hanh`, `/bao-cao`, `/cau-hinh`, `/tai-khoan`, `/nhat-ky`, `/nop-minh-chung`, `/nop-ca-nhan`.

**Kết quả mong đợi:**
- **M**: chỉ vào được `/`, `/nop-ca-nhan`, `/bang-tin`, `/ho-so`. Các URL khác bị đẩy về `/nop-ca-nhan`.
- **S**: vào được `/`, `/nop-minh-chung`, `/nop-ca-nhan`, `/bang-tin`, `/ho-so`, `/duyet`, `/nhiem-vu`, `/chi-doan`. Bị đẩy về `/nop-minh-chung` với các URL khác.
- **staff**: chỉ Tổng quan, Nhiệm vụ, Tiêu chí, Chi đoàn, Đoàn viên, Ban chấp hành, Báo cáo.
- **admin**: tất cả trừ `/tai-khoan`, `/nhat-ky` (bị đẩy về `/`).
- **super_admin**: vào hết.

---

## Nhóm G — Chưa hỗ trợ, ĐỪNG test (3 mục)

Các mục này tôi chưa làm. Test sẽ "fail" là đúng, không phải lỗi.

1. **Chặn nộp bài tổng hợp khi đoàn viên chưa nộp đủ** — chưa có quy tắc "nộp đủ", nên bí thư chi đoàn vẫn nộp tổng hợp được bất kể đoàn viên nộp hay chưa. `listTaskParticipants` đã sẵn nhưng chưa nối vào giao diện.
2. **Tự động gửi nhắc theo lịch hẹn** — chỉ gửi ngay được; hẹn lịch chỉ lưu trong phiên.
3. **Xuất PDF/Word** — chỉ báo "chưa hỗ trợ".

---

## Ghi chú khi báo lỗi

Khi một case sai, gửi tôi: **số case**, ảnh chụp màn hình, và nếu có thì thông báo trong Console (F12). Với lỗi ghi dữ liệu, kèm cả mã lỗi Supabase (dạng `PGRST...` hoặc `23505`).
