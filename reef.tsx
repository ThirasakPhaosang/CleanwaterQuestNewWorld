// FIX: Switched to Firebase v8 compatibility imports.
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import { PlayerProfile, getPlayerProfile, savePlayerProfile } from './profile-data';

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
const db = firebase.firestore();

// --- TYPE DEFINITIONS ---
interface GlobalReefState {
    season: number;
    progress: number; // Stored as a raw number of fragments
    target: number;
    contributors: number;
    lastCheckedMilestone: number;
    updatedAt: number;
}

// --- CONSTANTS ---
const GLOBAL_REEF_STORAGE_KEY = 'cleanwater_quest_global_reef';
const ECO_FACTS = [
    "ปะการัง 1 กอสามารถสร้างที่อยู่อาศัยให้สัตว์น้ำกว่า 150 ชนิด",
    "แนวปะการังคือ 'ป่าฝนใต้ทะเล' ที่มีความหลากหลายทางชีวภาพสูงมาก",
    "นักวิทยาศาสตร์พบว่าแนวปะการังช่วยดูดซับคาร์บอนไดออกไซด์ได้จริง",
    "การปลูกปะการังใหม่ต้องใช้น้ำทะเลอุณหภูมิ 26-28°C เพื่อการฟื้นตัวที่ดี",
    "สาหร่ายในตัวปะการัง (Zooxanthellae) เป็นผู้ผลิตอาหารหลักผ่านการสังเคราะห์แสง",
];

// --- DOM ELEMENTS ---
const overlay = document.getElementById('reef-overlay');
const closeBtn = document.getElementById('reef-close-btn');
const progressBarFill = document.getElementById('reef-progress-bar-fill');
const progressPercentage = document.getElementById('reef-progress-percentage');
const reefVisualization = document.getElementById('reef-visualization');
const playerFragmentsCount = document.getElementById('player-fragments-count');
const playerTotalContribution = document.getElementById('player-total-contribution');
const donationButtonsContainer = document.getElementById('donation-buttons');
const factText = document.getElementById('reef-fact-text');

// --- STATE ---
// FIX: Use firebase.User to match the compatibility SDK's user type.
let currentPlayer: firebase.User | null = null;

// --- DATA MANAGEMENT ---
function getGlobalReefState(): GlobalReefState {
    const saved = localStorage.getItem(GLOBAL_REEF_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
    return { season: 1, progress: 0, target: 100000, contributors: 0, lastCheckedMilestone: 0, updatedAt: Date.now() };
}

function saveGlobalReefState(state: GlobalReefState) {
    state.updatedAt = Date.now();
    localStorage.setItem(GLOBAL_REEF_STORAGE_KEY, JSON.stringify(state));
}

// --- UI RENDERING ---
function renderReefUI() {
    if (!currentPlayer) return;

    const profile = getPlayerProfile(currentPlayer);
    const reefState = getGlobalReefState();

    // Update global progress bar
    const percent = Math.min((reefState.progress / reefState.target) * 100, 100);
    if (progressBarFill) (progressBarFill as HTMLElement).style.width = `${percent}%`;
    if (progressPercentage) progressPercentage.textContent = `${percent.toFixed(2)}%`;

    // Update reef visualization
    if (reefVisualization) {
        (reefVisualization as HTMLElement).style.setProperty('--health-percent', `${percent}%`);
    }

    // Update player contribution info
    if (playerFragmentsCount) playerFragmentsCount.textContent = `🐚 ${profile.coralFragments.toLocaleString()}`;
    if (playerTotalContribution) playerTotalContribution.textContent = `🪸 ${profile.stats.totalCoralContributed.toLocaleString()}`;

    // Update donation buttons state
    const buttons = donationButtonsContainer?.querySelectorAll('.donate-btn') as NodeListOf<HTMLButtonElement>;
    buttons?.forEach(btn => {
        const amount = btn.dataset.amount;
        if (amount === 'all') {
            btn.disabled = profile.coralFragments <= 0;
        } else {
            btn.disabled = profile.coralFragments < Number(amount);
        }
    });
}

function updateEcoFact() {
    if (!factText) return;
    const randomFact = ECO_FACTS[Math.floor(Math.random() * ECO_FACTS.length)];
    factText.textContent = randomFact;
}

// --- CORE LOGIC ---
async function handleDonation(amount: number) {
    if (!currentPlayer) return;

    const profile = getPlayerProfile(currentPlayer);
    const reefState = getGlobalReefState();

    if (profile.coralFragments < amount) {
        console.warn("Not enough fragments to donate.");
        return;
    }

    // Update player profile
    profile.coralFragments -= amount;
    profile.stats.totalCoralContributed += amount;
    savePlayerProfile(profile);

    // Update global reef in Firestore (transaction); fallback to local if fails
    try {
        await db.runTransaction(async (tx) => {
            const ref = db.collection('public').doc('reef');
            const snap = await tx.get(ref);
            const cur = snap.exists ? (snap.data() as any) : { progress: 0, target: 100000, contributors: 0 };
            tx.set(ref, {
                progress: (cur.progress || 0) + amount,
                target: cur.target || 100000,
                contributors: (cur.contributors || 0) + 1,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        });
    } catch (e) {
        console.warn('Global reef update failed, using local state', e);
        reefState.progress += amount;
        reefState.contributors++;
        saveGlobalReefState(reefState);
    }
    
    // Animate and re-render
    // TODO: Add a nice particle animation here
    console.log(`Donated ${amount} fragments!`);
    
    updateEcoFact();
    renderReefUI();
}

// --- EVENT HANDLERS ---
export function openReefModal() {
    currentPlayer = auth.currentUser;
    if (!currentPlayer || !overlay) return;

    if (currentPlayer.isAnonymous) {
        alert("จำเป็นต้องเข้าสู่ระบบเพื่อเข้าถึงฟีเจอร์นี้!");
        return;
    }

    // Subscribe to global reef doc for live updates
    try {
        db.collection('public').doc('reef').onSnapshot((doc) => {
            if (doc.exists) {
                const data = doc.data() as any;
                const local = getGlobalReefState();
                const merged: GlobalReefState = {
                    season: local.season,
                    progress: data.progress || 0,
                    target: data.target || local.target,
                    contributors: data.contributors || 0,
                    lastCheckedMilestone: local.lastCheckedMilestone || 0,
                    updatedAt: Date.now(),
                };
                saveGlobalReefState(merged);
                renderReefUI();
            }
        });
    } catch {}

    renderReefUI();
    updateEcoFact();
    overlay.classList.remove('hidden');
    try { audio.uiOpen(); } catch {}
}

function closeModal() {
    overlay?.classList.add('hidden');
    try { audio.uiClose(); } catch {}
}

// --- INITIALIZATION ---
function initReefSystem() {
    if (!overlay || !closeBtn || !donationButtonsContainer) {
        console.error("Reef UI elements not found.");
        return;
    }

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });

    donationButtonsContainer.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.matches('.donate-btn')) {
            try { audio.uiClick(); } catch {}
            if (!currentPlayer) return;
            const profile = getPlayerProfile(currentPlayer);
            const amountStr = target.dataset.amount;
            
            let amount = 0;
            if (amountStr === 'all') {
                amount = profile.coralFragments;
            } else {
                amount = Number(amountStr);
            }

            if (amount > 0) {
                handleDonation(amount);
            }
        }
    });
}

initReefSystem();
