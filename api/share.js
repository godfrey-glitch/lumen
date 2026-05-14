// ─── Share API ────────────────────────────────────────────────────────────────
// POST /api/share  → { decisionId, uid }  → creates share record, returns shareId
// GET  /api/share?id=xxx → returns public share data
// ─────────────────────────────────────────────────────────────────────────────

// We use Firebase REST API (no SDK needed in serverless)
const FIREBASE_PROJECT = process.env.FIREBASE_PROJECT_ID;
const FIREBASE_KEY     = process.env.FIREBASE_WEB_API_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'GET') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing share id' });
    return getShare(id, res);
  }

  if (req.method === 'POST') {
    const { decision, summary, framework, emotion, uid, name } = req.body;
    if (!decision || !summary || !uid) return res.status(400).json({ error: 'Missing required fields' });
    return createShare({ decision, summary, framework, emotion, uid, name }, res);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

async function createShare(data, res) {
  const shareId = generateId();
  const record = {
    fields: {
      shareId:   { stringValue: shareId },
      decision:  { stringValue: data.decision },
      summary:   { stringValue: data.summary },
      framework: { stringValue: data.framework || '' },
      emotion:   { stringValue: data.emotion || '' },
      sharedBy:  { stringValue: data.name || 'Someone' },
      uid:       { stringValue: data.uid },
      createdAt: { timestampValue: new Date().toISOString() },
      views:     { integerValue: 0 }
    }
  };

  try {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/shares?documentId=${shareId}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': FIREBASE_KEY },
      body: JSON.stringify(record)
    });
    if (!r.ok) throw new Error(await r.text());
    return res.status(200).json({ shareId, shareUrl: `https://uselumen.com/share.html?id=${shareId}` });
  } catch (err) {
    console.error('[Share] Create error:', err);
    return res.status(500).json({ error: 'Could not create share link' });
  }
}

async function getShare(shareId, res) {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/shares/${shareId}?key=${FIREBASE_KEY}`;
    const r = await fetch(url);
    if (r.status === 404) return res.status(404).json({ error: 'Share not found or expired' });
    if (!r.ok) throw new Error(await r.text());
    const doc = await r.json();
    const f = doc.fields;
    return res.status(200).json({
      shareId:   f.shareId?.stringValue,
      decision:  f.decision?.stringValue,
      summary:   f.summary?.stringValue,
      framework: f.framework?.stringValue,
      emotion:   f.emotion?.stringValue,
      sharedBy:  f.sharedBy?.stringValue,
      createdAt: f.createdAt?.timestampValue
    });
  } catch (err) {
    console.error('[Share] Get error:', err);
    return res.status(500).json({ error: 'Could not load share' });
  }
}

function generateId() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}
