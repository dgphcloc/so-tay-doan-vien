// =====================================================================
// SUPABASE EDGE FUNCTION: NHẬN WEBHOOK TỪ PAYOS (TỰ ĐỘNG GẠCH NỢ)
// Deploy: supabase functions deploy payos-webhook --no-verify-jwt --yes
// URL cắm vào PayOS Dashboard: https://<project-ref>.supabase.co/functions/v1/payos-webhook
// =====================================================================

// @ts-ignore - Deno runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.3';

/** Ký HMAC-SHA256 bằng Web Crypto API (native Deno, không cần import) */
async function sign(data: string, key: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// @ts-ignore - Deno runtime
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }

  try {
    const body = await req.json();
    console.log('[payos-webhook] received:', JSON.stringify(body));

    // @ts-ignore - Deno runtime
    const checksumKey = Deno.env.get('PAYOS_CHECKSUM_KEY') ?? '';
    if (!checksumKey) {
      return new Response(
        JSON.stringify({ success: false, message: 'Chưa cấu hình PAYOS_CHECKSUM_KEY' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const data = body.data;
    const receivedSignature = body.signature;

    if (!data || !receivedSignature) {
      return new Response(
        JSON.stringify({ success: false, message: 'Payload không hợp lệ' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Chuỗi ký: sắp xếp key theo alphabet, bỏ qua giá trị null/undefined
    const signatureData = Object.keys(data)
      .filter((k) => data[k] !== null && data[k] !== undefined)
      .sort()
      .map((k) => {
        const v = data[k];
        if (typeof v === 'object') {
          // Mảng/đối tượng: JSON.stringify như payOS quy định
          return `${k}=${JSON.stringify(v)}`;
        }
        return `${k}=${v}`;
      })
      .join('&');

    const expectedSignature = await sign(signatureData, checksumKey);
    const isValid = expectedSignature.toLowerCase() === String(receivedSignature).toLowerCase();

    if (!isValid) {
      console.warn(
        '[payos-webhook] Chu ky KHONG hop le. expected=',
        expectedSignature,
        'received=',
        receivedSignature,
      );
      return new Response(
        JSON.stringify({ success: false, message: 'Chữ ký không hợp lệ' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const orderCode = data.orderCode;
    const amount = data.amount;
    const desc = String(data.desc || data.description || '').toUpperCase();

    // @ts-ignore - Deno runtime
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    // @ts-ignore - Deno runtime
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const sb = createClient(supabaseUrl, serviceKey);

    const isSuccess =
      body.code === '00' ||
      desc.includes('THANH CONG') ||
      desc.includes('SUCCESS');

    if (!isSuccess) {
      console.log('[payos-webhook] Giao dich khong thanh cong, bo qua:', desc);
      return new Response(
        JSON.stringify({ success: true, message: 'Bỏ qua giao dịch không thành công' }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (!orderCode) {
      return new Response(
        JSON.stringify({ success: false, message: 'Thiếu orderCode' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const { data: rpcData, error: rpcError } = await sb.rpc('payos_confirm_payment', {
      p_order_code: orderCode,
      p_amount: amount,
    });

    if (rpcError) {
      console.error('[payos-webhook] RPC loi:', rpcError);
      // Vẫn trả 200 để payOS không retry vô hạn
      return new Response(
        JSON.stringify({ success: true, message: 'Đã nhận, ghi nhận nội bộ lỗi: ' + rpcError.message }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    }

    console.log('[payos-webhook] Gach no thanh cong:', rpcData);

    return new Response(
      JSON.stringify({ success: true, data: rpcData }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[payos-webhook] Loi:', err);
    return new Response(
      JSON.stringify({
        success: false,
        message: err instanceof Error ? err.message : 'Lỗi không xác định',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});