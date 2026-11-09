// =====================================================================
// SUPABASE EDGE FUNCTION: TẠO LINK THANH TOÁN PAYOS & KIỂM TRA TRẠNG THÁI
// Deploy: supabase functions deploy payos-create-payment --no-verify-jwt --yes
// Secrets: supabase secrets set PAYOS_CLIENT_ID=... PAYOS_API_KEY=... PAYOS_CHECKSUM_KEY=...
// =====================================================================

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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-client-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PAYOS_API = 'https://api-merchant.payos.vn/v2';

// @ts-ignore - Deno runtime
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body.action || 'create';

    // @ts-ignore - Deno runtime
    const clientId = Deno.env.get('PAYOS_CLIENT_ID') ?? '';
    // @ts-ignore - Deno runtime
    const apiKey = Deno.env.get('PAYOS_API_KEY') ?? '';
    // @ts-ignore - Deno runtime
    const checksumKey = Deno.env.get('PAYOS_CHECKSUM_KEY') ?? '';

    if (!clientId || !apiKey || !checksumKey) {
      return new Response(
        JSON.stringify({
          success: false,
          message:
            'Chưa cấu hình PAYOS_CLIENT_ID / PAYOS_API_KEY / PAYOS_CHECKSUM_KEY trên Supabase secrets',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ---------- ACTION: TẠO ĐƠN HÀNG ----------
    if (action === 'create') {
      const { orderCode, amount, description, buyerName, buyerPhone, expiresInMinutes } = body;

      if (!orderCode || !amount || amount <= 0) {
        return new Response(
          JSON.stringify({ success: false, message: 'Thiếu orderCode hoặc amount hợp lệ' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // Nội dung chuyển khoản: bỏ dấu, chỉ chữ/số/khoảng trắng, tối đa 25 ký tự (giới hạn payOS)
      const cleanDesc = String(description || `DP ${orderCode}`)
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .replace(/[^a-zA-Z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 25);

      const expiredAt = Math.floor(Date.now() / 1000) + (expiresInMinutes || 15) * 60;

      const cancelUrl = body.cancelUrl || 'https://example.com/cancel';
      const returnUrl = body.returnUrl || 'https://example.com/success';

      // Chữ ký tạo đơn theo tài liệu payOS: amount|cancelUrl|description|orderCode|returnUrl
      const signatureDataOfficial = [
        `amount=${amount}`,
        `cancelUrl=${cancelUrl}`,
        `description=${cleanDesc}`,
        `orderCode=${orderCode}`,
        `returnUrl=${returnUrl}`,
      ].join('&');

      const signature = await sign(signatureDataOfficial, checksumKey);

      const payload = {
        orderCode: Number(orderCode),
        amount: Number(amount),
        description: cleanDesc,
        buyerName: buyerName || undefined,
        buyerPhone: buyerPhone || undefined,
        items: body.items || [{ name: cleanDesc, quantity: 1, price: Number(amount) }],
        cancelUrl,
        returnUrl,
        signature,
        expiredAt,
      };

      const res = await fetch(`${PAYOS_API}/payment-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': clientId,
          'x-api-key': apiKey,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || data.code !== '00') {
        return new Response(
          JSON.stringify({
            success: false,
            message: data.desc || data.message || 'payOS từ chối tạo đơn',
            payos_response: data,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const info = data.data;

      return new Response(
        JSON.stringify({
          success: true,
          paymentLinkId: info.paymentLinkId,
          checkoutUrl: info.checkoutUrl,
          qrCode: info.qrCode,
          bin: info.bin,
          accountNumber: info.accountNumber,
          accountName: info.accountName,
          amount: info.amount,
          description: info.description,
          orderCode: info.orderCode,
          expiredAt: info.expiredAt,
          status: info.status,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ---------- ACTION: KIỂM TRA TRẠNG THÁI ĐƠN ----------
    if (action === 'status') {
      const { orderCode } = body;
      if (!orderCode) {
        return new Response(
          JSON.stringify({ success: false, message: 'Thiếu orderCode' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const res = await fetch(`${PAYOS_API}/payment-requests/${orderCode}`, {
        method: 'GET',
        headers: {
          'x-client-id': clientId,
          'x-api-key': apiKey,
        },
      });

      const data = await res.json();
      if (!res.ok || data.code !== '00') {
        return new Response(
          JSON.stringify({
            success: false,
            message: data.desc || 'Không lấy được trạng thái',
            payos_response: data,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const info = data.data;
      return new Response(
        JSON.stringify({
          success: true,
          status: info.status,
          amount: info.amount,
          amountPaid: info.amountPaid,
          amountRemaining: info.amountRemaining,
          transactions: info.transactions || [],
          orderCode: info.orderCode,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ success: false, message: `Action không hợp lệ: ${action}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        message: err instanceof Error ? err.message : 'Lỗi không xác định',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});