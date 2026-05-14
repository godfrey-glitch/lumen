// ─── Auth verification endpoint ───────────────────────────────────────────────
// Verifies Firebase ID token and returns user info
// ─────────────────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ error: 'Missing idToken' });

  try {
    // Verify with Firebase REST API
    const firebaseRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.FIREBASE_WEB_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      }
    );

    if (!firebaseRes.ok) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const data = await firebaseRes.json();
    const user = data.users?.[0];

    if (!user) return res.status(401).json({ error: 'User not found' });

    return res.status(200).json({
      uid: user.localId,
      email: user.email,
      displayName: user.displayName || null,
      photoUrl: user.photoUrl || null,
      verified: user.emailVerified
    });

  } catch (err) {
    console.error('[Auth] Error:', err);
    return res.status(500).json({ error: 'Auth verification failed' });
  }
}
