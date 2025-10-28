// Leaderboard (rebuild) — realtime + Thai-safe labels
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

// Safe Thai text using percent-decoding to avoid mojibake in some toolchains
const ud = (s: string) => decodeURIComponent(s);

const L_CORRECT = ud('%E0%B8%96%E0%B8%B9%E0%B8%81%E0%B8%95%E0%B9%89%E0%B8%AD%E0%B8%87');
const L_BEST = ud('%E0%B8%94%E0%B8%B5%E0%B8%97%E0%B8%B5%E0%B9%88%E0%B8%AA%E0%B8%B8%E0%B8%94');
const L_NO_RANK = ud('%E0%B8%A2%E0%B8%B1%E0%B8%87%E0%B9%84%E0%B8%A1%E0%B9%88%E0%B8%A1%E0%B8%B5%E0%B8%82%E0%B9%89%E0%B8%AD%E0%B8%A1%E0%B8%B9%E0%B8%A5%E0%B8%88%E0%B8%B1%E0%B8%94%E0%B8%AD%E0%B8%B1%E0%B8%99%E0%B8%94%E0%B8%B1%E0%B8%9A');
const L_REEF_SUB = ud('%E0%B8%A2%E0%B8%AD%E0%B8%94%E0%B8%AA%E0%B8%A1%E0%B8%97%E0%B8%9A%E0%B9%81%E0%B8%99%E0%B8%A7%E0%B8%9B%E0%B8%B0%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%B1%E0%B8%87%E0%B8%A3%E0%B8%A7%E0%B8%A1');

const firebaseConfig = {
  apiKey: 'AIzaSyAAXqmfSy_q_Suh4td5PeLz-ZsuICf-KwI',
  authDomain: 'cleanwater-quest.firebaseapp.com',
  projectId: 'cleanwater-quest',
  storageBucket: 'cleanwater-quest.firebasestorage.app',
  messagingSenderId: '331042617564',
  appId: '1:331042617564:web:b00eeaf03d228ae4569c19',
  measurementId: 'G-3CZGPRNZH8',
};

const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

type LeaderboardTab = 'weekly' | 'all-time' | 'reef';
interface LeaderboardEntry {
  uid: string;
  displayName: string;
  avatarId?: string;
  score: number; // weekly/all-time
  sortCorrect: number;
  bestRun: number;
  contributed: number; // reef
  updatedAt: number;
}

// Elements
const overlay = document.getElementById('leaderboard-overlay');
const closeBtn = document.getElementById('leaderboard-close-btn');
const tabsContainer = document.getElementById('leaderboard-tabs');
const listEl = document.getElementById('leaderboard-list');
const myRankEl = document.getElementById('leaderboard-my-rank');

// State
let currentTab: LeaderboardTab = 'weekly';
let currentPlayer: firebase.User | null = null;
let unsubscribeLeaderboard: (() => void) | null = null;

function formatScore(score: number): string {
  return score > 1000 ? `${(score / 1000).toFixed(1)}k` : score.toLocaleString();
}

function createEntryElement(entry: LeaderboardEntry, rank: number, isPlayer: boolean): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'leaderboard-entry';
  if (isPlayer) li.classList.add('is-player');

  const rankDisplay = rank <= 3 ? '' : `#${rank}`;
  const mainScore = currentTab === 'reef' ? entry.contributed : entry.score;
  const subStats = currentTab === 'reef'
    ? L_REEF_SUB
    : `${L_CORRECT} ${entry.sortCorrect} | ${L_BEST} ${formatScore(entry.bestRun)}`;

  li.innerHTML = `
    <div class="entry-rank" data-rank="${rank}">${rankDisplay}</div>
    <div class="entry-avatar" style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:22px;">${entry.avatarId || '&#128578;'}</div>
    <div class="entry-info">
      <div class="entry-name">${entry.displayName}</div>
      <div class="entry-sub-stats">${subStats}</div>
    </div>
    <div class="entry-score">${formatScore(mainScore)}</div>
  `;
  return li;
}

function renderEntries(source: LeaderboardEntry[]) {
  if (!listEl || !myRankEl) return;
  // Tie-breakers
  source.sort((a, b) => {
    if (currentTab === 'reef') return b.contributed - a.contributed;
    if (b.score !== a.score) return b.score - a.score;
    if (b.sortCorrect !== a.sortCorrect) return b.sortCorrect - a.sortCorrect;
    if (b.bestRun !== a.bestRun) return b.bestRun - a.bestRun;
    return a.updatedAt - b.updatedAt;
  });

  listEl.innerHTML = '';
  source.slice(0, 50).forEach((e, i) => listEl.appendChild(createEntryElement(e, i + 1, e.uid === currentPlayer?.uid)));

  const idx = source.findIndex(e => e.uid === currentPlayer?.uid);
  if (idx !== -1) {
    myRankEl.innerHTML = '';
    myRankEl.appendChild(createEntryElement(source[idx], idx + 1, true));
  } else {
    myRankEl.innerHTML = `<div class="leaderboard-entry is-player"><div class="entry-info">${L_NO_RANK}</div></div>`;
  }
}

function subscribeLeaderboard() {
  if (unsubscribeLeaderboard) { unsubscribeLeaderboard(); unsubscribeLeaderboard = null; }
  try {
    const db = firebase.firestore();
    let field: string = 'stats.totalScore';
    if (currentTab === 'weekly') field = 'stats.weeklyScore';
    if (currentTab === 'reef') field = 'stats.totalCoralContributed';

    unsubscribeLeaderboard = db
      .collection('players')
      .orderBy(field, 'desc')
      .limit(50)
      .onSnapshot((snap) => {
        const list: LeaderboardEntry[] = snap.docs.map(d => {
          const u: any = d.data();
          return {
            uid: d.id,
            displayName: u.displayName || 'Player',
            avatarId: u.avatarId,
            score: currentTab === 'reef' ? 0 : (currentTab === 'weekly' ? (u.stats?.weeklyScore || 0) : (u.stats?.totalScore || 0)),
            sortCorrect: u.stats?.totalSortedCorrect || 0,
            bestRun: u.stats?.bestScore || 0,
            contributed: u.stats?.totalCoralContributed || 0,
            updatedAt: (u.updatedAt && (u.updatedAt.seconds ? u.updatedAt.seconds * 1000 : u.updatedAt)) || Date.now(),
          };
        });
        renderEntries(list);
      });
  } catch {}
}

function handleTabClick(e: Event) {
  const target = e.currentTarget as HTMLElement;
  const tab = target.dataset.tab as LeaderboardTab;
  if (!tab || tab === currentTab) return;
  currentTab = tab;
  tabsContainer?.querySelector('.active')?.classList.remove('active');
  target.classList.add('active');
  subscribeLeaderboard();
}

function closeModal() {
  overlay?.classList.add('hidden');
  if (unsubscribeLeaderboard) { unsubscribeLeaderboard(); unsubscribeLeaderboard = null; }
}

function initLeaderboard() {
  if (!overlay || !closeBtn || !tabsContainer || !listEl || !myRankEl) return;
  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  tabsContainer.querySelectorAll('.leaderboard-tab').forEach(tab => tab.addEventListener('click', handleTabClick));
}

initLeaderboard();

export function openLeaderboardModal() {
  currentPlayer = auth.currentUser;
  if (!currentPlayer || !overlay) return;
  overlay.classList.remove('hidden');
  subscribeLeaderboard();
}

