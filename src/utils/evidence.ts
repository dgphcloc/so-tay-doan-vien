/**
 * Tiện ích cho minh chứng: băm SHA-256, lấy toạ độ GPS, chọn/chụp ảnh.
 * Chạy trong trình duyệt (Web Crypto API + navigator.geolocation).
 */

/** Băm file thành chuỗi SHA-256 hex (64 ký tự) — khớp ràng buộc DB. */
export async function sha256Hex(file: Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Băm một chuỗi văn bản (dùng cho link / ghi chú) thành SHA-256 hex. */
export async function sha256HexOfString(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface GpsPosition {
  lat: number;
  lng: number;
  accuracy?: number;
}

/** Lấy toạ độ hiện tại từ trình duyệt. Ném lỗi có thông báo tiếng Việt. */
export function getGpsPosition(timeoutMs = 15000): Promise<GpsPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Thiết bị/trình duyệt không hỗ trợ định vị GPS.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? 'Bạn đã từ chối quyền truy cập vị trí. Hãy bật lại trong cài đặt trình duyệt.'
            : err.code === err.POSITION_UNAVAILABLE
            ? 'Không xác định được vị trí hiện tại.'
            : 'Hết thời gian lấy vị trí GPS.';
        reject(new Error(msg));
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
    );
  });
}

/** Mở hộp chọn file ảnh, trả file người dùng chọn (hoặc null). */
export function pickImageFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

/** Mở hộp chọn file bất kỳ (PDF, Word, Excel...). */
export function pickAnyFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,application/pdf';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

/**
 * Mở camera trước/sau để chụp ảnh trực tiếp (getUserMedia).
 * Trả file ảnh JPEG (hoặc null nếu người dùng huỷ / không có camera).
 */
export async function captureFromCamera(): Promise<File | null> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Thiết bị/trình duyệt không hỗ trợ chụp ảnh trực tiếp.');
  }
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });

  return new Promise<File | null>((resolve, reject) => {
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.85);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:16px';
    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.style.cssText = 'max-width:90vw;max-height:70vh;border-radius:12px;background:#000';

    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;gap:10px';
    const shoot = document.createElement('button');
    shoot.textContent = 'Chụp';
    shoot.style.cssText = 'padding:10px 20px;font-weight:700;border-radius:10px;border:0;background:#1F5FBF;color:#fff;cursor:pointer';
    const cancel = document.createElement('button');
    cancel.textContent = 'Huỷ';
    cancel.style.cssText = 'padding:10px 20px;font-weight:700;border-radius:10px;border:1px solid #64748b;background:#fff;color:#334155;cursor:pointer';
    bar.append(shoot, cancel);
    overlay.append(video, bar);
    document.body.appendChild(overlay);

    const cleanup = () => {
      stream.getTracks().forEach((t) => t.stop());
      overlay.remove();
    };

    video.srcObject = stream;

    shoot.onclick = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')?.drawImage(video, 0, 0);
      canvas.toBlob(
        (blob) => {
          cleanup();
          resolve(blob ? new File([blob], `chup_${Date.now()}.jpg`, { type: 'image/jpeg' }) : null);
        },
        'image/jpeg',
        0.9
      );
    };
    cancel.onclick = () => {
      cleanup();
      resolve(null);
    };
  }).catch((e) => {
    stream.getTracks().forEach((t) => t.stop());
    throw e;
  });
}
