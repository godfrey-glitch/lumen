// ─── Admin API ────────────────────────────────────────────────────────────────
// All endpoints require X-Admin-UID header matching ADMIN_UIDS env var
// GET  /api/admin?action=stats
// GET  /api/admin?action=users&page=0
// GET  /api/admin?action=decisions&page=0
// POST /api/admin  { action:'broadcast', subject, message }
// POST /api/admin  { action:'deleteUser', uid }
// POST /api/admin  { action:'banUser', uid }
// ─────────────────────────────────────────────────────────────────────────────

const PROJECT = process.env.FIREBASE_PROJECT_ID;
const FB_KEY  = process.env.FIREBASE_WEB_API_KEY;
const ADMIN_UIDS = (process.env.ADMIN_UIDS || '').split(',').map(s => s.trim()).filter(Boolean);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-UID');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── AUTH CHECK ─────────────────────────────────────────────
  const callerUID = req.headers['x-admin-uid'];
  if (!callerUID || !ADMIN_UIDS.includes(callerUID)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (req.method === 'GET') {
    const { action, page = 0 } = req.query;
    if (action === 'stats')     return getStats(res);
    if (action === 'users')     return getUsers(parseInt(page), res);
    if (action === 'decisions') return getDecisions(parseInt(page), res);
    return res.status(400).json({ error: 'Unknown action' });
  }

  if (req.method === 'POST') {
    const { action, ...data } = req.body;
    if (action === 'broadcast') return broadcastEmail(data, res);
    if (action === 'deleteDecision') return deleteDocument('decisions', data.docId, res);
    return res.status(400).json({ error: 'Unknown action' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// ── STATS ──────────────────────────────────────────────────
async function getStats(res) {
  try {
    const [decisionsSnap, sharesSnap] = await Promise.all([
      firestoreQuery('decisions', [], 1000),
      firestoreQuery('shares', [], 500)
    ]);

    const decisions = decisionsSnap.documents || [];
    const shares = sharesSnap.documents || [];

    // Unique users
    const uids = new Set(decisions.map(d => d.fields?.uid?.stringValue).filter(Boolean));

    // Framework breakdown
    const fwCount = {};
    const emCount = {};
    const dayCount = {};

    decisions.forEach(d => {
      const fw = d.fields?.framework?.stringValue;
      const em = d.fields?.emotion?.stringValue;
      const ts = d.fields?.createdAt?.timestampValue;
      if (fw) fwCount[fw] = (fwCount[fw]||0)+1;
      if (em) emCount[em] = (emCount[em]||0)+1;
      if (ts) {
        const day = ts.substring(0,10);
        dayCount[day] = (dayCount[day]||0)+1;
      }
    });

    // Last 14 days
    const timeline = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate()-i);
      const key = d.toISOString().substring(0,10);
      timeline.push({ date: key, count: dayCount[key]||0 });
    }

    // Ratings
    const ratings = { 1:0, 2:0, 3:0 };
    decisions.forEach(d => {
      const r = d.fields?.rating?.integerValue;
      if (r) ratings[r] = (ratings[r]||0)+1;
    });

    return res.status(200).json({
      totalDecisions: decisions.length,
      totalUsers: uids.size,
      totalShares: shares.length,
      avgDecisionsPerUser: uids.size ? (decisions.length / uids.size).toFixed(1) : 0,
      frameworkBreakdown: fwCount,
      emotionBreakdown: emCount,
      timeline,
      ratings
    });
  } catch(err) {
    console.error('[Admin] Stats error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// ── USERS (from decisions — no Firebase Admin SDK needed) ──
async function getUsers(page, res) {
  try {
    const snap = await firestoreQuery('decisions', [], 1000);
    const decisions = snap.documents || [];

    const userMap = {};
    decisions.forEach(d => {
      const uid = d.fields?.uid?.stringValue;
      if (!uid) return;
      if (!userMap[uid]) {
        userMap[uid] = { uid, decisions: 0, lastActive: null, frameworks: {}, emotions: {} };
      }
      userMap[uid].decisions++;
      const ts = d.fields?.createdAt?.timestampValue;
      if (ts && (!userMap[uid].lastActive || ts > userMap[uid].lastActive)) userMap[uid].lastActive = ts;
      const fw = d.fields?.framework?.stringValue;
      const em = d.fields?.emotion?.stringValue;
      if (fw) userMap[uid].frameworks[fw] = (userMap[uid].frameworks[fw]||0)+1;
      if (em) userMap[uid].emotions[em] = (userMap[uid].emotions[em]||0)+1;
    });

    const users = Object.values(userMap)
      .sort((a,b) => b.decisions - a.decisions)
      .slice(page * 20, (page+1) * 20);

    return res.status(200).json({ users, total: Object.keys(userMap).length, page });
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}

// ── DECISIONS ─────────────────────────────────────────────
async function getDecisions(page, res) {
  try {
    const snap = await firestoreQuery('decisions', [], 1000);
    const all = (snap.documents || [])
      .map(d => ({
        id: d.name?.split('/').pop(),
        decision: d.fields?.decision?.stringValue?.substring(0,120),
        emotion:  d.fields?.emotion?.stringValue,
        framework:d.fields?.framework?.stringValue,
        uid:      d.fields?.uid?.stringValue,
        createdAt:d.fields?.createdAt?.timestampValue,
        hasRating: !!d.fields?.rating?.integerValue,
        hasShare:  !!d.fields?.shareId?.stringValue
      }))
      .sort((a,b) => (b.createdAt||'') > (a.createdAt||'') ? 1 : -1);

    return res.status(200).json({
      decisions: all.slice(page*20, (page+1)*20),
      total: all.length, page
    });
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}

// ── BROADCAST EMAIL ────────────────────────────────────────
async function broadcastEmail(data, res) {
  const { emails, subject, message } = data;
  if (!emails?.length || !subject || !message) return res.status(400).json({ error: 'Missing fields' });

  const key = process.env.RESEND_API_KEY;
  if (!key) return res.status(500).json({ error: 'Email not configured' });

  const html = `
    <div style="font-family:Georgia,serif;background:#0a1628;color:#ede8df;padding:40px 20px;">
      <div style="max-width:560px;margin:0 auto;">
        <div style="text-align:center;margin-bottom:32px;font-size:28px;color:#e8a44a">Lumen.</div>
        <div style="background:#0f1c2e;border:1px solid rgba(255,255,255,0.07);border-radius:20px;padding:36px;">
          <h2 style="font-size:24px;font-weight:400;margin:0 0 16px;color:#ede8df">${subject}</h2>
          <div style="font-size:15px;color:#b0a898;line-height:1.75;white-space:pre-wrap">${message}</div>
        </div>
        <p style="text-align:center;font-size:12px;color:#5e7285;margin-top:24px">© 2026 Lumen · <a href="https://uselumen.com" style="color:#e8a44a">uselumen.com</a></p>
      </div>
    </div>`;

  let sent = 0, failed = 0;
  for (const email of emails) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${key}` },
        body: JSON.stringify({ from:'Lumen <hello@uselumen.com>', to:[email], subject, html })
      });
      if (r.ok) sent++; else failed++;
    } catch { failed++; }
  }

  return res.status(200).json({ sent, failed });
}

// ── DELETE DOCUMENT ───────────────────────────────────────
async function deleteDocument(collection, docId, res) {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${collection}/${docId}?key=${FB_KEY}`;
    await fetch(url, { method: 'DELETE' });
    return res.status(200).json({ success: true });
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}

// ── FIRESTORE QUERY ───────────────────────────────────────
async function firestoreQuery(col, filters, limit = 100) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${col}?pageSize=${limit}&key=${FB_KEY}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Firestore error ${r.status}`);
  return r.json();
}
