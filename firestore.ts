import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

// Shared Firestore helpers used across the app

export type SessionPayload = {
  score: number;
  collected: number;
  sortedCorrect: number;
  incorrect: number;
  xpGained: number;
  coinsGained: number;
  coralFragmentsGained: number;
  items?: Array<{ id: string; type: string }>;
};

export const getDb = () => {
  // Assumes Firebase app has been initialized elsewhere (index/menu/game)
  const app = firebase.apps.length ? firebase.app() : undefined;
  if (!app) throw new Error('Firebase app is not initialized');
  return firebase.firestore();
};

export const ensurePlayerProfile = async (uid: string, base: any) => {
  const db = getDb();
  const ref = db.collection('players').doc(uid);
  await ref.set(
    {
      level: 1,
      xp: 0,
      coins: 0,
      coral: 0,
      coralFragments: 0,
      stats: {
        bestScore: 0,
        totalScore: 0,
        totalCollected: 0,
        totalSortedCorrect: 0,
        sessions: 0,
        weeklyScore: 0,
        weekId: getWeekId(),
        totalCoralContributed: 0,
      },
      privacy: { showOnLeaderboard: true },
      ...base,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
};

export const subscribePlayerProfile = (
  uid: string,
  cb: (doc: any | null) => void
) => {
  const db = getDb();
  return db.collection('players').doc(uid).onSnapshot((s) => cb(s.exists ? s.data() : null));
};

const getWeekId = () => {
  const now = new Date();
  const day = now.getDay() || 7; // Make Sunday 7
  if (day !== 1) now.setHours(-24 * (day - 1));
  return now.toISOString().split('T')[0];
};

export const recordGameSession = async (uid: string, payload: SessionPayload) => {
  const db = getDb();
  const userRef = db.collection('players').doc(uid);
  const sessionsRef = userRef.collection('sessions');

  await sessionsRef.add({
    ...payload,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    const cur: any = snap.exists
      ? snap.data()
      : {
          level: 1,
          xp: 0,
          coins: 0,
          coral: 0,
          coralFragments: 0,
          stats: { bestScore: 0, totalScore: 0, totalCollected: 0, totalSortedCorrect: 0, sessions: 0, weeklyScore: 0, weekId: getWeekId(), totalCoralContributed: 0 },
        };

    const newBest = Math.max(cur?.stats?.bestScore || 0, payload.score || 0);
    const weekId = getWeekId();
    const needResetWeek = (cur?.stats?.weekId || '') !== weekId;

    tx.set(
      userRef,
      {
        coins: firebase.firestore.FieldValue.increment(payload.coinsGained || 0),
        coralFragments: firebase.firestore.FieldValue.increment(payload.coralFragmentsGained || 0),
        stats: {
          bestScore: newBest,
          totalScore: firebase.firestore.FieldValue.increment(payload.score || 0),
          totalCollected: firebase.firestore.FieldValue.increment(payload.collected || 0),
          totalSortedCorrect: firebase.firestore.FieldValue.increment(payload.sortedCorrect || 0),
          sessions: firebase.firestore.FieldValue.increment(1),
          weekId: weekId,
          weeklyScore: (needResetWeek ? 0 : cur?.stats?.weeklyScore || 0) + (payload.score || 0),
        },
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
};

export const fetchLeaderboardTop = async (board: 'weekly'|'all-time'|'reef', limit = 50) => {
  const db = getDb();
  let field = 'stats.totalScore';
  if (board === 'weekly') field = 'stats.weeklyScore';
  if (board === 'reef') field = 'stats.totalCoralContributed';
  // Filter to only documents that are allowed by rules when performing a collection query
  // so the query does not fail due to other users with privacy disabled.
  const snap = await db
    .collection('players')
    .orderBy(field, 'desc')
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({ uid: d.id, ...(d.data() as any) }));
};


