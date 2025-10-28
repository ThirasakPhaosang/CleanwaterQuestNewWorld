// FIX: Switched to Firebase v8 compatibility imports.
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { PlayerProfile, getPlayerProfile, savePlayerProfile } from './profile-data';
import audio from './audio';

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

// --- CONSTANTS ---
const MAX_LEVEL = 10;

const UPGRADE_DATA = {
    capacity: {
        name: 'ความจุเรือ',
        icon: '📦',
        description: 'เก็บขยะได้มากขึ้นในแต่ละรอบ',
        unit: 'ชิ้น',
        getValue: (level: number) => 5 + 3 * (level - 1),
    },
    hook: {
        name: 'ความเร็วตะขอ',
        icon: '⚙️',
        description: 'ลดเวลาในการดึงตะขอแต่ละครั้ง',
        unit: 'วินาที',
        getValue: (level: number) => +(1.00 * Math.pow(0.95, level - 1)).toFixed(2),
    }
};
type UpgradeKey = keyof typeof UPGRADE_DATA;

const ECO_TIPS = [
    "เรือที่ใหญ่ขึ้นหมายถึงขยะพลาสติกที่ถูกนำออกจากทะเลมากขึ้น!",
    "ตะขอที่เร็วขึ้นช่วยให้คุณเก็บขยะได้ทันก่อนที่มันจะจมลงสู่ก้นทะเล",
    "การอัปเกรดทุกครั้งคือการลงทุนเพื่อมหาสมุทรที่สะอาดขึ้น",
    "ประสิทธิภาพที่เพิ่มขึ้นช่วยลดการใช้พลังงานในการทำความสะอาดทะเล",
];

// --- DOM ELEMENTS ---
const overlay = document.getElementById('upgrades-overlay');
const closeBtn = document.getElementById('upgrades-close-btn');
const contentEl = document.getElementById('upgrades-content');
const ecoTipEl = document.getElementById('upgrade-eco-tip');
const playerCurrencyEl = document.getElementById('upgrades-player-currency');

// --- STATE ---
// FIX: Use firebase.User to match the compatibility SDK's user type.
let currentPlayer: firebase.User | null = null;
let currentProfile: PlayerProfile | null = null;

// --- LOGIC ---
function getUpgradeCost(level: number): number | null {
    if (level >= MAX_LEVEL) return null;
    if (level === 1) return 150;
    return Math.round(150 * Math.pow(1.6, level - 1));
}

function renderUI() {
    if (!contentEl || !currentProfile || !playerCurrencyEl) return;

    playerCurrencyEl.textContent = `💰 ${currentProfile.coins.toLocaleString()}`;
    contentEl.innerHTML = ''; // Clear previous content

    Object.entries(UPGRADE_DATA).forEach(([key, data]) => {
        const upgradeKey = key as UpgradeKey;
        const currentLevel = currentProfile!.upgrades[upgradeKey].level;
        const cost = getUpgradeCost(currentLevel);
        const canAfford = cost !== null && currentProfile!.coins >= cost;
        const isMaxLevel = currentLevel >= MAX_LEVEL;

        const card = document.createElement('div');
        card.className = 'upgrade-card';
        card.id = `upgrade-card-${upgradeKey}`;

        let levelDotsHTML = '';
        for (let i = 1; i <= MAX_LEVEL; i++) {
            levelDotsHTML += `<div class="level-dot ${i <= currentLevel ? 'active' : ''}"></div>`;
        }

        const currentValue = data.getValue(currentLevel);
        const nextValue = isMaxLevel ? '' : ` <span class="arrow">→</span> <span class="next-value">${data.getValue(currentLevel + 1)} ${data.unit}</span>`;

        let buttonText = '';
        if (isMaxLevel) {
            buttonText = 'เลเวลสูงสุด';
        } else if (cost) {
            buttonText = `อัปเกรด (💰 ${cost.toLocaleString()})`;
        }

        card.innerHTML = `
            <div class="upgrade-card-header">
                <div class="upgrade-icon">${data.icon}</div>
                <div class="upgrade-title-group">
                    <h3 class="upgrade-title">${data.name}</h3>
                    <p class="upgrade-description">${data.description}</p>
                </div>
            </div>
            <div class="upgrade-level-bar">${levelDotsHTML}</div>
            <div class="upgrade-details">
                <span>LV ${currentLevel}</span>
                <span class="upgrade-value-change">
                    ${currentValue} ${data.unit}
                    ${nextValue}
                </span>
            </div>
            <button class="upgrade-button" data-key="${upgradeKey}" ${isMaxLevel || !canAfford ? 'disabled' : ''}>
                ${buttonText}
            </button>
        `;

        contentEl.appendChild(card);
    });
}

async function handleUpgrade(key: UpgradeKey) {
    if (!currentProfile) return;

    const currentLevel = currentProfile.upgrades[key].level;
    if (currentLevel >= MAX_LEVEL) return;

    const cost = getUpgradeCost(currentLevel);
    if (cost === null || currentProfile.coins < cost) {
        // Optionally show a "not enough coins" message
        console.log("Not enough coins");
        return;
    }

    // Update profile
    currentProfile.coins -= cost;
    currentProfile.upgrades[key].level += 1;
    currentProfile.xp += 50 * currentProfile.upgrades[key].level; // Add XP bonus

    savePlayerProfile(currentProfile);
    try { audio.sfx.correct(); } catch {}

    // UI Feedback
    const card = document.getElementById(`upgrade-card-${key}`);
    card?.classList.add('is-animating');
    card?.addEventListener('animationend', () => {
        card.classList.remove('is-animating');
    }, { once: true });
    
    updateEcoTip();
    renderUI(); // Re-render to update values and button states
}

function updateEcoTip() {
    if (!ecoTipEl) return;
    const randomTip = ECO_TIPS[Math.floor(Math.random() * ECO_TIPS.length)];
    ecoTipEl.innerHTML = `<p>🌱 <strong>Eco Tip:</strong> ${randomTip}</p>`;
}

// --- EVENT HANDLERS ---
export function openUpgradesModal() {
    currentPlayer = auth.currentUser;
    if (!currentPlayer || !overlay) return;

    if (currentPlayer.isAnonymous) {
        alert("จำเป็นต้องเข้าสู่ระบบเพื่อเข้าถึงฟีเจอร์นี้!");
        return;
    }

    currentProfile = getPlayerProfile(currentPlayer);
    renderUI();
    updateEcoTip();
    overlay.classList.remove('hidden');
    try { audio.uiOpen(); } catch {}
}

function closeModal() {
    overlay?.classList.add('hidden');
    try { audio.uiClose(); } catch {}
}

// --- INITIALIZATION ---
function initUpgrades() {
    if (!overlay || !closeBtn || !contentEl) {
        console.error("Upgrades UI elements not found.");
        return;
    }

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });

    contentEl.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.matches('.upgrade-button')) {
            const key = target.dataset.key as UpgradeKey;
            if (key) {
                try { audio.uiClick(); } catch {}
                handleUpgrade(key);
            }
        }
    });
}

initUpgrades();
