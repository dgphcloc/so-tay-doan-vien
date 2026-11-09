# HƯỚNG DẪN KẾT NỐI payOS THẬT (TỰ ĐỘNG GẠCH NỢ)

Tài liệu này hướng dẫn cấu hình để **tiền chuyển vào là payOS ghi nhận ngay** và **hệ thống tự động gạch nợ đoàn phí** không cần bấm duyệt tay.

---

## Yêu cầu trước khi bắt đầu

- Đã có tài khoản payOS đã xác thực (bạn đã có: `DUONG PHUOC LOC`).
- Đã cài **Supabase CLI** trên máy.
- Đã có `project-ref` của Supabase (ví dụ `vnpqpetyfrqjuxmbpnpk`).

---

## BƯỚC 1 — Cài Supabase CLI và đăng nhập

```bash
npm install -g supabase
supabase login
```

---

## BƯỚC 2 — Liên kết project

Chạy tại thư mục gốc dự án `C:\Users\Admin\Downloads\so_tay`:

```bash
supabase link --project-ref vnpqpetyfrqjuxmbpnpk
```

---

## BƯỚC 3 — Nạp 3 khóa payOS vào Supabase Secrets

> Các khóa này **chỉ lưu trên server Supabase**, không bao giờ lộ ra trình duyệt.

```bash
supabase secrets set PAYOS_CLIENT_ID=8ee9d939-9f65-4c50-a6bd-d0268ce14dfd
supabase secrets set PAYOS_API_KEY=4e07a201-0bab-43ad-89aa-d2bcf6ca9e96
supabase secrets set PAYOS_CHECKSUM_KEY=5e51534bea3712dc6d4fc59e44418e3172d2a5369675e846c2ced044b2d41363
```

Kiểm tra lại:

```bash
supabase secrets list
```

---

## BƯỚC 4 — Deploy 2 Edge Function

```bash
supabase functions deploy payos-create-payment --no-verify-jwt
supabase functions deploy payos-webhook --no-verify-jwt
```

Sau khi deploy thành công, bạn sẽ có 2 URL:

- `https://vnpqpetyfrqjuxmbpnpk.supabase.co/functions/v1/payos-create-payment`
- `https://vnpqpetyfrqjuxmbpnpk.supabase.co/functions/v1/payos-webhook`

---

## BƯỚC 5 — Cắm Webhook URL vào payOS Dashboard

1. Truy cập **https://my.payos.vn**
2. Vào **Kênh thanh toán** → chọn kênh MB Bank của bạn → **Cài đặt Webhook**
3. Dán URL webhook:

```
https://vnpqpetyfrqjuxmbpnpk.supabase.co/functions/v1/payos-webhook
```

4. Bấm **Lưu** / **Kiểm tra** — payOS sẽ gửi 1 request test, Edge Function sẽ trả `{ success: true }`.

---

## BƯỚC 6 — Kiểm thử

1. Mở hệ thống → menu **Đoàn phí** → tab **Đoàn phí của tôi** (đăng nhập bằng tài khoản đoàn viên).
2. Bấm **Quét VietQR nộp đoàn phí** → chọn các tháng → modal sẽ hiện:
   - Nhãn xanh **"Đơn payOS đã tạo (mã #...)"**
   - Mã QR **chính thức của payOS** (có logo payOS)
   - Link **"Mở trang thanh toán payOS"**
3. Quét QR bằng app ngân hàng MB Bank → chuyển tiền.
4. Trong 1-2 giây, trang payOS sẽ hiện **1 đơn hàng hoàn thành**, và hệ thống của bạn sẽ **tự động gạch nợ + bắn thông báo chuông**.

Ngoài ra, đoàn viên có thể bấm nút **"Kiểm tra đã thanh toán"** để hệ thống gọi thẳng API payOS đối chiếu trạng thái ngay lập tức (hữu ích khi webhook bị chậm).

---

## Xử lý sự cố

| Hiện tượng | Nguyên nhân | Cách khắc phục |
|---|---|---|
| Modal hiện "⚠️ Không tạo được đơn payOS" | Chưa nạp secrets hoặc deploy function | Chạy lại Bước 3 + Bước 4, xem log bằng `supabase functions logs payos-create-payment` |
| Đơn payOS tạo được nhưng webhook không bắn | URL webhook chưa cắm đúng hoặc function chưa deploy | Kiểm tra lại Bước 5, test lại bằng `curl` |
| Webhook báo "Chữ ký không hợp lệ" | `PAYOS_CHECKSUM_KEY` sai | Chạy lại lệnh `supabase secrets set PAYOS_CHECKSUM_KEY=...` |
| Tiền vào tài khoản nhưng đơn payOS vẫn PENDING | Nội dung chuyển khoản không khớp | Đoàn viên phải giữ nguyên cú pháp `DP ...` do hệ thống sinh ra |

Xem log trực tiếp:

```bash
supabase functions logs payos-create-payment --tail
supabase functions logs payos-webhook --tail
```

---

## Ghi chú quan trọng về bảo mật

- **KHÔNG BAO GIỜ** đưa `PAYOS_CHECKSUM_KEY` hoặc `PAYOS_API_KEY` vào mã frontend (`.tsx`) hay commit lên GitHub.
- Chỉ lưu trong **Supabase Secrets** (đã mã hóa).
- Cấu hình trong UI `/doan-phi` tab **Cấu hình Ngân hàng & payOS** chỉ để hiển thị / lưu backup — khi gọi thật, Edge Function luôn ưu tiên secrets.