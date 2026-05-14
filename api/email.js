// ─── Email Notifications via Resend ──────────────────────────────────────────
// POST /api/email
// Body: { type, to, name, data }
// Types: 'welcome' | 'weekly_digest' | 'share_summary'
// ─────────────────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { type, to, name, data } = req.body;
  if (!type || !to) return res.status(400).json({ error: 'Missing type or email' });

  const key = process.env.RESEND_API_KEY;
  if (!key) return res.status(500).json({ error: 'Email service not configured' });

  let subject, html;

  switch (type) {

    case 'welcome':
      subject = 'Welcome to Lumen — think clearer, decide better';
      html = welcomeEmail(name || 'there');
      break;

    case 'weekly_digest':
      subject = `Your Lumen week in review — ${data?.count || 0} decision${data?.count !== 1 ? 's' : ''}`;
      html = weeklyDigestEmail(name || 'there', data);
      break;

    case 'share_summary':
      subject = `${name || 'Someone'} shared a decision summary with you`;
      html = shareSummaryEmail(name, data);
      break;

    default:
      return res.status(400).json({ error: 'Unknown email type' });
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        from: 'Lumen <hello@uselumen.com>',
        to: [to],
        subject,
        html
      })
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('[Email] Resend error:', err);
      return res.status(response.status).json({ error: err.message || 'Email failed' });
    }

    const result = await response.json();
    return res.status(200).json({ success: true, id: result.id });

  } catch (err) {
    console.error('[Email] Send error:', err);
    return res.status(500).json({ error: 'Failed to send email' });
  }
}

// ─── EMAIL TEMPLATES ──────────────────────────────────────────────────────────

const baseStyle = `
  font-family: 'Georgia', serif;
  background: #0a1628;
  color: #ede8df;
  margin: 0; padding: 0;
`;

const wrap = (content) => `
<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lumen</title></head>
<body style="${baseStyle}">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a1628; padding: 40px 20px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
      <!-- Logo -->
      <tr><td style="padding-bottom:32px; text-align:center;">
        <span style="font-family:Georgia,serif; font-size:28px; color:#e8a44a; letter-spacing:0.06em;">Lumen<em style="color:#ede8df">.</em></span>
      </td></tr>
      <!-- Card -->
      <tr><td style="background:#0f1c2e; border:1px solid rgba(255,255,255,0.07); border-radius:20px; padding:40px 36px;">
        ${content}
      </td></tr>
      <!-- Footer -->
      <tr><td style="padding-top:28px; text-align:center; font-size:12px; color:#5e7285; font-family:sans-serif; line-height:1.6;">
        Lumen — Think clearer. Decide better.<br>
        <a href="https://uselumen.com" style="color:#e8a44a; text-decoration:none;">uselumen.com</a> &nbsp;·&nbsp;
        <a href="https://uselumen.com/unsubscribe" style="color:#5e7285; text-decoration:none;">Unsubscribe</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

function welcomeEmail(name) {
  return wrap(`
    <h1 style="font-family:Georgia,serif; font-size:32px; font-weight:400; color:#ede8df; margin:0 0 8px; line-height:1.2;">
      Welcome, ${name}.
    </h1>
    <p style="font-family:Georgia,serif; font-size:18px; font-style:italic; color:#e8a44a; margin:0 0 28px;">
      Your calm voice when emotions are loud.
    </p>
    <p style="font-family:sans-serif; font-size:15px; color:#b0a898; line-height:1.7; margin:0 0 24px;">
      Lumen is your AI thinking partner — here to help you work through any life decision using structured frameworks, without judgment and without unsolicited advice.
    </p>
    <p style="font-family:sans-serif; font-size:14px; color:#b0a898; line-height:1.7; margin:0 0 32px;">
      Here's how to get started:
    </p>
    <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:32px;">
      ${['Describe your decision honestly — no structure needed.', 'Choose a thinking framework that fits how you feel.', 'Let Lumen guide you with one focused question at a time.', 'Receive your clarity summary and save it for later.'].map((step, i) => `
        <tr>
          <td style="padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
            <span style="font-family:Georgia,serif; font-size:20px; color:rgba(232,164,74,0.3); margin-right:14px;">${i+1}.</span>
            <span style="font-family:sans-serif; font-size:14px; color:#b0a898;">${step}</span>
          </td>
        </tr>`).join('')}
    </table>
    <div style="text-align:center;">
      <a href="https://uselumen.com/app.html" style="display:inline-block; background:#e8a44a; color:#0a1628; font-family:sans-serif; font-size:15px; font-weight:600; padding:14px 36px; border-radius:100px; text-decoration:none;">
        Begin your first decision →
      </a>
    </div>
  `);
}

function weeklyDigestEmail(name, data) {
  const decisions = data?.decisions || [];
  const decisionRows = decisions.slice(0, 3).map(d => `
    <tr>
      <td style="padding:12px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
        <div style="font-family:sans-serif; font-size:13px; color:#ede8df; margin-bottom:4px;">${d.decision?.substring(0,80)}${d.decision?.length > 80 ? '...' : ''}</div>
        <div style="font-family:sans-serif; font-size:11px; color:#5e7285;">${d.framework || ''} · ${d.date || ''}</div>
      </td>
    </tr>`).join('');

  return wrap(`
    <h1 style="font-family:Georgia,serif; font-size:28px; font-weight:400; color:#ede8df; margin:0 0 6px;">
      Your week in review, ${name}.
    </h1>
    <p style="font-family:sans-serif; font-size:14px; color:#5e7285; margin:0 0 28px;">
      You made ${data?.count || 0} decision${data?.count !== 1 ? 's' : ''} this week.
    </p>
    ${decisions.length ? `
    <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:28px;">${decisionRows}</table>` : `
    <p style="font-family:sans-serif; font-size:14px; color:#5e7285; margin:0 0 28px; font-style:italic;">
      No decisions this week — that's okay. Come back when you need clarity.
    </p>`}
    <p style="font-family:Georgia,serif; font-size:17px; font-style:italic; color:#e8a44a; margin:0 0 24px;">
      "${data?.insight || 'Every decision you make is practice for the next one.'}"
    </p>
    <div style="text-align:center;">
      <a href="https://uselumen.com/dashboard.html" style="display:inline-block; background:#e8a44a; color:#0a1628; font-family:sans-serif; font-size:14px; font-weight:600; padding:12px 28px; border-radius:100px; text-decoration:none;">
        View your dashboard →
      </a>
    </div>
  `);
}

function shareSummaryEmail(senderName, data) {
  return wrap(`
    <p style="font-family:sans-serif; font-size:13px; color:#5e7285; text-transform:uppercase; letter-spacing:0.1em; margin:0 0 16px;">
      ✦ Shared with you by ${senderName}
    </p>
    <h1 style="font-family:Georgia,serif; font-size:26px; font-weight:400; color:#ede8df; margin:0 0 24px; line-height:1.3;">
      A decision clarity summary
    </h1>
    <div style="background:rgba(232,164,74,0.06); border:1px solid rgba(232,164,74,0.2); border-radius:14px; padding:24px; margin-bottom:24px;">
      <p style="font-family:sans-serif; font-size:12px; text-transform:uppercase; letter-spacing:0.1em; color:#e8a44a; margin:0 0 10px;">The decision</p>
      <p style="font-family:sans-serif; font-size:14px; color:#b0a898; margin:0 0 20px; line-height:1.6;">${data?.decision || ''}</p>
      <p style="font-family:sans-serif; font-size:12px; text-transform:uppercase; letter-spacing:0.1em; color:#e8a44a; margin:0 0 10px;">Clarity summary</p>
      <p style="font-family:Georgia,serif; font-size:16px; font-style:italic; color:#ede8df; line-height:1.65; margin:0;">${data?.summary || ''}</p>
    </div>
    <div style="text-align:center;">
      <a href="${data?.shareUrl || 'https://uselumen.com'}" style="display:inline-block; background:#e8a44a; color:#0a1628; font-family:sans-serif; font-size:14px; font-weight:600; padding:12px 28px; border-radius:100px; text-decoration:none; margin-right:12px;">
        View full summary →
      </a>
      <a href="https://uselumen.com/login.html" style="display:inline-block; border:1px solid rgba(255,255,255,0.1); color:#b0a898; font-family:sans-serif; font-size:14px; padding:12px 24px; border-radius:100px; text-decoration:none;">
        Try Lumen free
      </a>
    </div>
  `);
}
