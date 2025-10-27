// FIX: Switched to Firebase v8 compatibility imports.
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import { fetchLeaderboardTop } from './firestore';
import { getPlayerProfile, PlayerProfile } from './profile-data';

const firebaseConfig = {
  apiKey: "AIzaSyAAXqmfSy_q_Suh4td5PeLz-ZsuICf-KwI",
  authDomain: "cleanwater-quest.firebaseapp.com",
  projectId: "cleanwater-quest",
  storageBucket: "cleanwater-quest.firebasestorage.app",
  messagingSenderId: "331042617564",
  appId: "1:331042617564:web:b00eeaf03d228ae4569c19",
  measurementId: "G-3CZGPRNZH8"
};

// FIX: Switched to Firebase v8 compatibility initialization.
const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// --- TYPE DEFINITIONS ---
interface LeaderboardEntry {
    uid: string;
    displayName: string;
    avatarId?: string;
    score: number;
    sortCorrect: number;
    bestRun: number;
    contributed: number;
    updatedAt: number;
}

type LeaderboardTab = 'weekly' | 'all-time' | 'reef';

// --- DOM ELEMENTS ---
const overlay = document.getElementById('leaderboard-overlay');
const closeBtn = document.getElementById('leaderboard-close-btn');
const tabsContainer = document.getElementById('leaderboard-tabs');
const listEl = document.getElementById('leaderboard-list');
const myRankEl = document.getElementById('leaderboard-my-rank');

// --- STATE ---
let currentTab: LeaderboardTab = 'weekly';
// FIX: Use firebase.User to match the compatibility SDK's user type.
let currentPlayer: firebase.User | null = null;
const MOCK_PLAYER_COUNT = 100;
const LEADERBOARD_STORAGE_KEY = 'cleanwater_quest_leaderboard_data';

// --- DATA SIMULATION ---

// Gets the date string for the start of the current week (Monday)
function getWeekId(): string {
    const now = new Date();
    const day = now.getDay() || 7; // Make Sunday 7
    if (day !== 1) now.setHours(-24 * (day - 1));
    return now.toISOString().split('T')[0];
}

// Gets the ID for the current "season" (month)
function getSeasonId(): string {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth()}`;
}

function generateMockData(playerProfile: PlayerProfile): LeaderboardEntry[] {
    const mockData: LeaderboardEntry[] = [];
    const names = ["Aqua", "Reef", "Wave", "Coral", "Fin", "Splash", "Tide", "Ocean", "Eco", "Stream"];
    
    for (let i = 0; i < MOCK_PLAYER_COUNT -1; i++) {
        const score = Math.floor(Math.random() * 20000) + 1000;
        mockData.push({
            uid: `mock_user_${i}`,
            displayName: `${names[i % names.length]}Hero${Math.floor(Math.random() * 100)}`,
            score: score,
            sortCorrect: Math.floor(score / 30) + Math.floor(Math.random() * 50),
            bestRun: Math.floor(score * (0.2 + Math.random() * 0.2)),
            contributed: Math.floor(Math.random() * 200),
            updatedAt: Date.now() - Math.floor(Math.random() * 1000 * 60 * 60)
        });
    }

    // Add current player's data
    mockData.push({
        uid: playerProfile.uid,
        displayName: playerProfile.displayName,
        score: playerProfile.stats.weeklyCollected, // Using this stat for weekly score
        sortCorrect: playerProfile.stats.totalSortedCorrect, // A placeholder
        bestRun: playerProfile.stats.bestScore,
        contributed: playerProfile.stats.totalCoralContributed,
        updatedAt: playerProfile.updatedAt
    });

    return mockData;
}

async function getLeaderboardData(playerProfile: PlayerProfile, tab: LeaderboardTab) {
    try {
        const cloud = await fetchLeaderboardTop(tab, 50);
        if (cloud && cloud.length) {
            const mapped = cloud.map((u: any) => ({
                uid: u.uid,
                displayName: u.displayName || 'Player',
                avatarId: u.avatarId || '🙂',
                score: (tab === 'reef') ? (u.stats?.totalCoralContributed || 0) : (tab === 'weekly' ? (u.stats?.weeklyScore || 0) : (u.stats?.totalScore || 0)),
                sortCorrect: u.stats?.totalSortedCorrect || 0,
                bestRun: u.stats?.bestScore || 0,
                contributed: u.stats?.totalCoralContributed || 0,
                updatedAt: (u.updatedAt && (u.updatedAt.seconds ? u.updatedAt.seconds*1000 : u.updatedAt)) || Date.now()
            }));
            if (tab === 'weekly') return { weekly: mapped } as any;
            if (tab === 'reef') return { reef: mapped } as any;
            return { ['all-time']: mapped } as any;
        }
    } catch {}
    // Fallback: ไม่มี Firestore หรือยังไม่มีข้อมูล -> แสดงเฉพาะผู้เล่นปัจจุบัน
    const single: LeaderboardEntry = {
        uid: playerProfile.uid,
        displayName: playerProfile.displayName,
        avatarId: (playerProfile as any).avatarId || '🙂',
        score: (tab === 'reef') ? (playerProfile.stats.totalCoralContributed || 0) : (tab === 'weekly' ? (playerProfile.stats.weeklyCollected || 0) : (playerProfile.stats.bestScore || 0)),
        sortCorrect: playerProfile.stats.totalSortedCorrect,
        bestRun: playerProfile.stats.bestScore,
        contributed: playerProfile.stats.totalCoralContributed || 0,
        updatedAt: playerProfile.updatedAt
    };
    if (tab === 'weekly') return { weekly: [single] } as any;
    if (tab === 'reef') return { reef: [single] } as any;
    return { ['all-time']: [single] } as any;
}

// --- UI RENDERING ---

function formatScore(score: number): string {
    if (score > 1000) {
        return `${(score/1000).toFixed(1)}k`;
    }
    return score.toLocaleString();
}

function createEntryElement(entry: LeaderboardEntry, rank: number, isPlayer: boolean): HTMLLIElement {
    const li = document.createElement('li');
    li.className = 'leaderboard-entry';
    if (isPlayer) {
        li.classList.add('is-player');
    }

    const rankDisplay = rank <= 3 ? '' : `#${rank}`;

    let mainScore = 0;
    let subStats = '';

    if (currentTab === 'weekly') {
        mainScore = entry.score;
        subStats = `♻️ ${entry.sortCorrect} | 🏆 ${formatScore(entry.bestRun)}`;
    } else if (currentTab === 'all-time') {
        mainScore = entry.score * 5 + entry.sortCorrect * 10; // Mock all-time score
        subStats = `♻️ ${entry.sortCorrect} | 🏆 ${formatScore(entry.bestRun)}`;
    } else if (currentTab === 'reef') {
        mainScore = entry.contributed;
        subStats = `🌊 Συνεισφορά`;
    }

    // Normalize scores for each tab with real values from Firestore
    if (currentTab === 'weekly') {
        mainScore = entry.score;
        subStats = `คะแนนจัดแยกรวม ${entry.sortCorrect} | ดีที่สุด ${formatScore(entry.bestRun)}`;
    } else if (currentTab === 'all-time') {
        mainScore = entry.score;
        subStats = `คะแนนจัดแยกรวม ${entry.sortCorrect} | ดีที่สุด ${formatScore(entry.bestRun)}`;
    } else if (currentTab === 'reef') {
        mainScore = entry.contributed;
        subStats = `รวมการสมทบปะการัง`;
    }

    li.innerHTML = `
        <div class="entry-rank" data-rank="${rank}">${rankDisplay}</div>
        <div class="entry-avatar" style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:22px;">${entry.avatarId || '🙂'}</div>
        <div class="entry-info">
            <div class="entry-name">${entry.displayName}</div>
            <div class="entry-sub-stats">${subStats}</div>
        </div>
        <div class="entry-score">${formatScore(mainScore)}</div>
    `;
    return li;
}


async function renderLeaderboard() {
    if (!currentPlayer || !listEl || !myRankEl) return;
    const playerProfile = getPlayerProfile(currentPlayer);
    const data = await getLeaderboardData(playerProfile, currentTab);
    
    let sourceData: LeaderboardEntry[] = data[currentTab] || [];

    // Sort data based on tab and tie-breaker rules
    sourceData.sort((a, b) => {
        if (currentTab === 'reef') {
            return b.contributed - a.contributed;
        }
        // Weekly & All-time sorting use same score field now
        if (b.score !== a.score) return b.score - a.score;
        if (b.sortCorrect !== a.sortCorrect) return b.sortCorrect - a.sortCorrect;
        if (b.bestRun !== a.bestRun) return b.bestRun - a.bestRun;
        return a.updatedAt - b.updatedAt;
    });

    listEl.innerHTML = ''; // Clear previous list
    const top50 = sourceData.slice(0, 50);
    top50.forEach((entry, index) => {
        const rank = index + 1;
        const isPlayer = entry.uid === currentPlayer?.uid;
        listEl.appendChild(createEntryElement(entry, rank, isPlayer));
    });

    // Render "My Rank"
    const myRankIndex = sourceData.findIndex(e => e.uid === currentPlayer?.uid);
    if (myRankIndex !== -1) {
        const myRank = myRankIndex + 1;
        const myData = sourceData[myRankIndex];
        myRankEl.innerHTML = ''; // Clear previous
        myRankEl.appendChild(createEntryElement(myData, myRank, true));
    } else {
        myRankEl.innerHTML = `<div class="leaderboard-entry is-player"><div class="entry-info">Δεν έχετε κατάταξη ακόμα!</div></div>`;
    }
}


// --- EVENT HANDLERS ---

// openLeaderboardModal defined later with auto refresh

function closeModal() {
    overlay?.classList.add('hidden');
}

let refreshTimer: number | null = null;

function startAutoRefresh() {
    stopAutoRefresh();
    // Refresh every 4 seconds while overlay is open
    refreshTimer = window.setInterval(() => {
        if (!overlay || overlay.classList.contains('hidden')) { stopAutoRefresh(); return; }
        renderLeaderboard();
    }, 4000);
}
function stopAutoRefresh() { if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; } }

function handleTabClick(e: Event) {
    const target = e.currentTarget as HTMLElement;
    const tab = target.dataset.tab as LeaderboardTab;
    if (!tab || tab === currentTab) return;

    currentTab = tab;

    tabsContainer?.querySelector('.active')?.classList.remove('active');
    target.classList.add('active');

    renderLeaderboard();
}

// --- INITIALIZATION ---
function initLeaderboard() {
    if (!overlay || !closeBtn || !tabsContainer) {
        console.error("Leaderboard UI elements not found.");
        return;
    }

    closeBtn.addEventListener('click', () => { stopAutoRefresh(); closeModal(); });
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });

    tabsContainer.querySelectorAll('.leaderboard-tab').forEach(tab => {
        tab.addEventListener('click', handleTabClick);
    });
}

initLeaderboard();
// When modal is opened, start auto refresh
export function openLeaderboardModal() {
    currentPlayer = auth.currentUser;
    if (!currentPlayer || !overlay) return;
    renderLeaderboard();
    overlay.classList.remove('hidden');
    startAutoRefresh();
}

