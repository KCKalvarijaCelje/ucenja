/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * KCK Učenja - Resend Email Broadcast Service Module
 */

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

export interface EmailSendResponse {
  success: boolean;
  data?: any;
  error?: string;
}

const DEFAULT_SENDER = 'KCK Učenja & Pridige <ucenja@kalvarija.si>';

/**
 * Generates an email template when a new sermon/teaching is published
 */
export function buildNewTeachingEmailHtml(options: {
  title: string;
  teacherName: string;
  dateStr?: string;
  biblePassage?: string;
  description?: string;
  listenUrl: string;
  audioUrl?: string;
  videoUrl?: string;
}): string {
  const { title, teacherName, dateStr, biblePassage, description, listenUrl, videoUrl } = options;

  return `
<!DOCTYPE html>
<html lang="sl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Novo učenje: ${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; }
    .container { max-width: 600px; margin: 24px auto; background: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #93032E 0%, #4a0217 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
    .badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 12px; color: #ffffff; }
    .title { margin: 0; font-size: 23px; font-weight: 900; line-height: 1.25; }
    .content { padding: 32px 28px; font-size: 15px; line-height: 1.65; color: #334155; }
    .card { background-color: #f1f5f9; border-radius: 16px; padding: 20px; margin: 20px 0; border: 1px solid #e2e8f0; }
    .card-item { margin-bottom: 10px; font-size: 14px; }
    .card-item:last-child { margin-bottom: 0; }
    .card-label { font-weight: bold; color: #64748b; font-size: 11px; text-transform: uppercase; }
    .card-val { color: #0f172a; font-weight: 600; }
    .btn { display: inline-block; background-color: #93032E; color: #ffffff !important; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 14px; margin: 20px 0; text-align: center; }
    .footer { background-color: #f8fafc; padding: 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
    .footer a { color: #93032E; text-decoration: underline; }
  </style>
</head>
<body>
  <div style="display:none;font-size:1px;color:#333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">Novo učenje na voljo: ${title} (${teacherName})</div>
  <div class="container">
    <div class="header">
      <div class="badge">📖 NOVO UČENJE & PRIDIGA • KC KALVARIJA</div>
      <h1 class="title">${title}</h1>
    </div>
    <div class="content">
      <p>Dragi bratje in sestre,</p>
      <p>Z veseljem vas obveščamo, da je v cerkvenem arhivu na voljo novo posneto učenje / pridiga.</p>

      <div class="card">
        <div class="card-item">
          <div class="card-label">Govornik / Učitelj</div>
          <div class="card-val">👤 ${teacherName}</div>
        </div>
        ${dateStr ? `
        <div class="card-item">
          <div class="card-label">Datum pridige</div>
          <div class="card-val">📅 ${dateStr}</div>
        </div>
        ` : ''}
        ${biblePassage ? `
        <div class="card-item">
          <div class="card-label">Svetopisemski odlomek</div>
          <div class="card-val">📜 ${biblePassage}</div>
        </div>
        ` : ''}
        ${description ? `
        <div class="card-item" style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed #cbd5e1;">
          <div class="card-label">Povzetek nagovora</div>
          <div style="font-size: 13px; color: #475569; margin-top: 4px;">${description}</div>
        </div>
        ` : ''}
      </div>

      <div style="text-align: center; margin: 24px 0;">
        <a href="${listenUrl}" class="btn" target="_blank">▶️ Poslušaj / Oglej si učenje &rarr;</a>
      </div>

      ${videoUrl ? `
        <p style="text-align: center; font-size: 13px; color: #64748b;">
          Video posnetek je na voljo tudi na <a href="${videoUrl}" target="_blank" style="color:#93032E;font-weight:bold;">YouTube kanalu KC Kalvarija</a>.
        </p>
      ` : ''}
    </div>
    <div class="footer">
      <p style="margin: 0 0 8px 0; font-weight: bold; color: #1e293b;">KC Kalvarija • Arhiv Učenj & Pridig</p>
      <p style="margin: 0 0 12px 0;">Bežigrajska cesta 7, 3000 Celje • <a href="https://kalvarija.si">kalvarija.si</a></p>
      <p style="margin: 12px 0 0 0; font-size: 10px; color: #94a3b8;">Če teh obvestil ne želite več prejemati, nam pišite na <a href="mailto:info@kalvarija.si">info@kalvarija.si</a>.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Dispatches an email using Resend API with serverless endpoint fallback
 */
export async function sendResendEmail(options: SendEmailOptions): Promise<EmailSendResponse> {
  const apiKey = (import.meta as any).env?.VITE_RESEND_API_KEY || (typeof process !== 'undefined' ? process.env?.RESEND_API_KEY : '');
  const toRecipients = Array.isArray(options.to) ? options.to : [options.to];
  const validRecipients = toRecipients.filter(e => e && e.includes('@')).map(e => e.trim());

  if (validRecipients.length === 0) {
    return { success: false, error: 'Ni veljavnih e-poštnih naslovov prejemnika.' };
  }

  const payload = {
    from: options.from || DEFAULT_SENDER,
    to: validRecipients,
    subject: options.subject,
    html: options.html || `<p>${options.text || options.subject}</p>`,
    text: options.text,
    reply_to: options.replyTo || 'info@kalvarija.si',
  };

  // 1. Attempt Vercel serverless /api/send-email first
  try {
    const apiRes = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (apiRes.ok) {
      const data = await apiRes.json();
      return { success: true, data };
    }
  } catch (apiErr) {
    // Fallback to direct client fetch
  }

  // 2. Direct Resend API fetch
  if (!apiKey) {
    return { success: false, error: 'VITE_RESEND_API_KEY ni nastavljen v okolju.' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (res.ok) {
      return { success: true, data };
    } else {
      return { success: false, error: data.message || data.name || 'Resend API napaka' };
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Napaka pri povezavi z Resend poštnim strežnikom.',
    };
  }
}
