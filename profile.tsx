// FIX: Switched to Firebase v8 compatibility imports.
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { PlayerProfile, getPlayerProfile, savePlayerProfile, TITLES_DATA, getXpForLevel } from './profile-data';

// This file now only contains the logic for the PROFILE MODAL on the MENU screen.
// Shared data logic is in profile-data.tsx

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


// --- DOM ELEMENTS ---
const profileOverlay = document.getElementById('profile-overlay');
const profileCloseBtn = document.getElementById('profile-close-btn');

const profileAvatar = document.getElementById('profile-avatar') as HTMLDivElement;
const levelBadge = document.getElementById('profile-level-badge');
const displayNameEl = document.getElementById('profile-display-name');
const xpFill = document.getElementById('profile-xp-fill');
const xpText = document.getElementById('profile-xp-text');
const coinsEl = document.getElementById('profile-coins');
const coralEl = document.getElementById('profile-coral');
const equippedTitleEl = document.getElementById('profile-equipped-title');

const titlesView = document.getElementById('titles-view');

const guestWarning = document.getElementById('guest-warning');

// --- UI RENDERING ---
const statIcons: Record<string, string> = {
    totalCollected: '🌊',
    totalSortedCorrect: '♻️',
    bestScore: '🏆',
    streakLoginDays: '🗓️',
    weeklyCollected: '📈',
    totalCoralContributed: '🪸'
};
const statLabels: Record<string, string> = {
    totalCollected: 'ขยะที่เก็บทั้งหมด',
    totalSortedCorrect: 'คัดแยกถูกต้อง',
    bestScore: 'คะแนนสูงสุด',
    streakLoginDays: 'ล็อกอินต่อเนื่อง',
    weeklyCollected: 'เก็บประจำสัปดาห์',
    totalCoralContributed: 'บริจาคปะการัง'
};

function renderProfile(profile: PlayerProfile, isGuest: boolean) {
    if (!profileAvatar || !levelBadge || !displayNameEl || !xpFill || !xpText || !coinsEl || !coralEl || !titlesView || !guestWarning || !equippedTitleEl) return;

    // Header
    profileAvatar.textContent = profile.avatarId;
    levelBadge.textContent = `LV ${profile.level}`;
    displayNameEl.textContent = profile.displayName;
    coinsEl.textContent = `💰 ${profile.coins.toLocaleString()}`;
    coralEl.textContent = `🌊 ${profile.coral.toLocaleString()}`;

    const equippedTitleData = TITLES_DATA.find(t => t.id === profile.equippedTitle);
    if (equippedTitleEl && equippedTitleData) {
        equippedTitleEl.textContent = `ฉายา: ${equippedTitleData.name}`;
    } else if (equippedTitleEl) {
        equippedTitleEl.textContent = '';
    }

    // XP Bar
    const currentLevelXp = getXpForLevel(profile.level);
    const nextLevelXp = getXpForLevel(profile.level + 1);
    const xpInLevel = profile.xp - currentLevelXp;
    const xpForNext = nextLevelXp - currentLevelXp;
    const xpPercent = Math.min((xpInLevel / xpForNext) * 100, 100);
    (xpFill as HTMLElement).style.width = `${xpPercent}%`;
    xpText.textContent = `${xpInLevel.toLocaleString()} / ${xpForNext.toLocaleString()} XP`;

    // Clear main view
    titlesView.innerHTML = '';

    // Create and append stats grid
    const statsContainer = document.createElement('div');
    statsContainer.id = 'stats-view'; // Re-use ID to keep grid styling from profile.css
    Object.entries(profile.stats).forEach(([key, value]) => {
        const statCard = document.createElement('div');
        statCard.className = 'stat-card';
        statCard.innerHTML = `
            <div class="stat-icon">${statIcons[key] || '📊'}</div>
            <div class="stat-value">${(value as number).toLocaleString()}</div>
            <div class="stat-label">${statLabels[key] || key}</div>
        `;
        statsContainer.appendChild(statCard);
    });
    titlesView.appendChild(statsContainer);

    // Create and append titles list
    const titlesListContainer = document.createElement('div');
    titlesListContainer.className = 'titles-list'; // For styling
    TITLES_DATA.forEach(titleData => {
        const isUnlocked = profile.unlockedTitles.includes(titleData.id);
        const isEquipped = profile.equippedTitle === titleData.id;
        
        const card = document.createElement('div');
        card.className = 'title-card';
        if (isEquipped) card.classList.add('equipped');
        if (!isUnlocked) card.classList.add('locked');

        let buttonOrLockHTML = '';
        if (isUnlocked) {
            buttonOrLockHTML = `
                <button class="equip-btn" data-title-id="${titleData.id}" ${isEquipped ? 'disabled' : ''}>
                    ${isEquipped ? 'ติดตั้งแล้ว' : 'ติดตั้ง'}
                </button>
            `;
        } else {
            let unlockText = '';
            switch(titleData.unlock.type) {
                case 'level': unlockText = `ต้องการ LV ${titleData.unlock.value}`; break;
                case 'stat': 
                    const target = titleData.unlock.target!;
                    if (titleData.unlock.value === 'totalCollected') unlockText = `เก็บขยะ ${target.toLocaleString()} ชิ้น`;
                    else if (titleData.unlock.value === 'totalCoralContributed') unlockText = `บริจาคปะการัง ${target.toLocaleString()} ชิ้น`;
                    break;
            }
            buttonOrLockHTML = `<div class="unlock-info">🔒 ${unlockText}</div>`;
        }
        
        card.innerHTML = `
            <div class="title-name">${titleData.name}</div>
            <div class="title-description">${titleData.description}</div>
            ${buttonOrLockHTML}
        `;
        titlesListContainer.appendChild(card);
    });
    titlesView.appendChild(titlesListContainer);


    // Guest Warning
    guestWarning.classList.toggle('hidden', !isGuest);
}

// --- EVENT HANDLERS ---
export function openProfileModal() {
    const user = auth.currentUser;
    if (!user || !profileOverlay) return;

    const profile = getPlayerProfile(user);
    renderProfile(profile, user.isAnonymous);

    profileOverlay.classList.remove('hidden');
}

function closeProfileModal() {
    profileOverlay?.classList.add('hidden');
}

function handleEquipTitle(e: Event) {
    const target = e.target as HTMLElement;
    if (!target.matches('.equip-btn')) return;

    const user = auth.currentUser;
    if (!user) return;
    
    const profile = getPlayerProfile(user);
    const titleId = target.dataset.titleId;

    if (titleId && profile.equippedTitle !== titleId) {
        profile.equippedTitle = titleId;
        savePlayerProfile(profile);
        renderProfile(profile, user.isAnonymous); 
        // Also update main menu widget
        const userTitleEl = document.getElementById('user-title');
        if(userTitleEl){
            const equippedTitleData = TITLES_DATA.find(t => t.id === profile.equippedTitle);
            userTitleEl.textContent = equippedTitleData ? equippedTitleData.name : '';
        }
    }
}

// --- INITIALIZATION ---
function initProfile() {
    // This function is now defensive and will not throw an error if the elements don't exist.
    if (!profileOverlay || !profileCloseBtn || !titlesView) {
        // The console warning helps in development if the menu HTML is changed.
        console.warn("Profile UI elements not found. This is expected on the game page.");
        return;
    }
    
    profileCloseBtn.addEventListener('click', closeProfileModal);
    profileOverlay.addEventListener('click', (e) => {
        if (e.target === profileOverlay) closeProfileModal();
    });

    titlesView.addEventListener('click', handleEquipTitle);
}

initProfile();