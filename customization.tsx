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
type UnlockType = 'free' | 'level' | 'coins' | 'stat' | 'contract';
type StatKey = keyof PlayerProfile['stats'];

interface CustomizationItem {
  id: string;
  name: string;
  type: 'color' | 'flag' | 'decal' | 'trail';
  preview: string; // hex code for color, emoji or icon for others
  unlock: {
    type: UnlockType;
    value: number | string; // e.g., 10 (level), 500 (coins), 'totalSortedCorrect' (stat), 'weekly_hero' (contract)
    cost?: number; // for coin purchases
  };
}

// --- DATA DEFINITIONS ---
const CUSTOMIZATION_DATA: CustomizationItem[] = [
  // Colors
  { id: 'color_default', name: 'Seafoam', type: 'color', preview: '#34d399', unlock: { type: 'free', value: 0 } },
  { id: 'color_sky', name: 'Sky Blue', type: 'color', preview: '#38bdf8', unlock: { type: 'coins', value: 100 } },
  { id: 'color_coral', name: 'Coral Pink', type: 'color', preview: '#fb7185', unlock: { type: 'coins', value: 150 } },
  { id: 'color_deep', name: 'Ocean Deep', type: 'color', preview: '#3730a3', unlock: { type: 'level', value: 10 } },
  { id: 'color_gold', name: 'Gold', type: 'color', preview: '#f59e0b', unlock: { type: 'stat', value: 'bestScore', cost: 10000 } },
  
  // Flags
  { id: 'flag_default', name: 'Default', type: 'flag', preview: '🏳️', unlock: { type: 'free', value: 0 } },
  { id: 'flag_wave', name: 'Wave', type: 'flag', preview: '🌊', unlock: { type: 'coins', value: 300 } },
  { id: 'flag_reef', name: 'Reef', type: 'flag', preview: '🐠', unlock: { type: 'contract', value: 'weekly_donate_30' } },
  { id: 'flag_recycle', name: 'Recycle', type: 'flag', preview: '♻️', unlock: { type: 'stat', value: 'totalSortedCorrect', cost: 500 } },

  // Decals
  { id: 'decal_none', name: 'None', type: 'decal', preview: '🚫', unlock: { type: 'free', value: 0 } },
  { id: 'decal_wave', name: 'Wave', type: 'decal', preview: '〰️', unlock: { type: 'stat', value: 'totalCollected', cost: 1000 } },
  { id: 'decal_reef', name: 'Reef', type: 'decal', preview: '🪸', unlock: { type: 'level', value: 15 } },

  // Trails
  { id: 'trail_none', name: 'None', type: 'trail', preview: '🚫', unlock: { type: 'free', value: 0 } },
  { id: 'trail_bubbles', name: 'Bubbles', type: 'trail', preview: '🫧', unlock: { type: 'coins', value: 500 } },
  { id: 'trail_glow', name: 'Glow', type: 'trail', preview: '✨', unlock: { type: 'stat', value: 'streakLoginDays', cost: 14 } },
];

// --- DOM ELEMENTS ---
const overlay = document.getElementById('customization-overlay');
const closeBtn = document.getElementById('customization-close-btn');
const tabs = document.querySelectorAll('.customization-tab');
const views = document.querySelectorAll('.customization-view');
const shipPreviewSVG = document.getElementById('ship-preview-svg') as HTMLElement | null;
const hull = document.getElementById('ship-hull');
const flagCanvas = document.getElementById('flag-canvas');
const decalLayer = document.getElementById('ship-decal-layer');
const wakeTrail = document.getElementById('ship-wake-trail');
const confirmBtn = document.getElementById('customization-confirm-btn');
const resetBtn = document.getElementById('customization-reset-btn');

// --- STATE ---
// FIX: Use firebase.User to match the compatibility SDK's user type.
let currentPlayer: firebase.User | null = null;
let currentProfile: PlayerProfile | null = null;
let temporaryCustomization: PlayerProfile['customization'];
let initialCustomization: PlayerProfile['customization'];


// --- CORE LOGIC ---
function isUnlocked(item: CustomizationItem, profile: PlayerProfile): boolean {
    switch (item.unlock.type) {
        case 'free': return true;
        case 'level': return profile.level >= (item.unlock.value as number);
        case 'coins': return true; // Purchasable items are always "unlocked" to be bought
        case 'stat': 
            const statKey = item.unlock.value as StatKey;
            return profile.stats[statKey] >= (item.unlock.cost as number);
        case 'contract':
            // This is a placeholder. A real implementation would check completed contracts.
            // For now, let's unlock it if the player has a high score.
            return profile.stats.bestScore > 5000;
        default: return false;
    }
}

function getUnlockConditionText(item: CustomizationItem): string {
    switch (item.unlock.type) {
        case 'level': return `ต้องการ LV ${item.unlock.value}`;
        case 'coins': return `💰 ${item.unlock.value}`;
        case 'stat':
            const statKey = item.unlock.value as StatKey;
            const cost = item.unlock.cost as number;
            if (statKey === 'bestScore') return `คะแนนสูงสุด ${cost.toLocaleString()}`;
            if (statKey === 'totalCollected') return `เก็บขยะ ${cost.toLocaleString()} ชิ้น`;
            if (statKey === 'totalSortedCorrect') return `คัดแยกถูกต้อง ${cost.toLocaleString()} ครั้ง`;
            if (statKey === 'streakLoginDays') return `ล็อกอิน ${cost} วัน`;
            return 'ปลดล็อกด้วยสถิติ';
        case 'contract': return 'ทำสัญญาพิเศษสำเร็จ';
        default: return '';
    }
}

// --- UI RENDERING ---

function updatePreview() {
    if (!hull || !flagCanvas || !decalLayer || !wakeTrail) return;

    // Color
    hull.setAttribute('fill', temporaryCustomization.boatColor);
    
    // Flag
    const flagItem = CUSTOMIZATION_DATA.find(item => item.id === temporaryCustomization.flagId);
    if(flagItem && flagItem.preview.includes('#')){ // is color
        flagCanvas.setAttribute('fill', flagItem.preview);
    } else {
        // Fallback for emoji or other non-color previews if needed
        flagCanvas.setAttribute('fill', '#f0f8ff'); // default white
    }
    
    // Decal
    if (temporaryCustomization.decalId !== 'decal_none') {
        decalLayer.setAttribute('fill', `url(#${temporaryCustomization.decalId.replace('decal_', '')})`);
    } else {
        decalLayer.setAttribute('fill', 'transparent');
    }

    // Trail
    wakeTrail.style.opacity = temporaryCustomization.trailId === 'trail_none' ? '0' : '1';
}

function renderOptions() {
    if (!currentProfile) return;

    views.forEach(view => {
        view.innerHTML = '';
        const type = view.id.replace('-view', '') as CustomizationItem['type'];
        const items = CUSTOMIZATION_DATA.filter(item => item.type === type);

        items.forEach(item => {
            const unlocked = isUnlocked(item, currentProfile!);
            const isSelected = temporaryCustomization[type === 'color' ? 'boatColor' : `${type}Id`] === item.id;

            const chip = document.createElement('div');
            chip.className = 'option-chip';
            chip.dataset.id = item.id;
            chip.dataset.type = item.type;
            if (isSelected) chip.classList.add('selected');

            let contentHTML = '';
            if (type === 'color') {
                contentHTML = `<div class="color-swatch" style="background-color: ${item.preview}"></div>`;
            } else {
                contentHTML = `<div class="${type}-preview">${item.preview}</div>`;
            }
            contentHTML += `<span class="option-name">${item.name}</span>`;
            
            if (!unlocked) {
                chip.classList.add('locked');
                contentHTML += `
                    <div class="locked-overlay">
                        <div class="lock-icon">🔒</div>
                        <div class="unlock-condition">${getUnlockConditionText(item)}</div>
                    </div>`;
            }

            chip.innerHTML = contentHTML;
            view.appendChild(chip);
        });
    });
}

// --- EVENT HANDLERS ---
export function openCustomizationModal() {
    currentPlayer = auth.currentUser;
    if (!currentPlayer || !overlay) return;
    
    // Guest check
    if(currentPlayer.isAnonymous){
        alert("จำเป็นต้องเข้าสู่ระบบเพื่อเข้าถึงฟีเจอร์เหล่านี้!");
        return;
    }

    currentProfile = getPlayerProfile(currentPlayer);
    // Deep copy for temporary state
    temporaryCustomization = JSON.parse(JSON.stringify(currentProfile.customization));
    initialCustomization = JSON.parse(JSON.stringify(currentProfile.customization));


    renderOptions();
    updatePreview();
    overlay.classList.remove('hidden');
}

function closeModal() {
    overlay?.classList.add('hidden');
}

function switchTab(e: Event) {
    const targetTab = e.currentTarget as HTMLElement;
    if (targetTab.classList.contains('active')) return;

    const tabName = targetTab.dataset.tab;
    tabs.forEach(tab => tab.classList.remove('active'));
    targetTab.classList.add('active');

    views.forEach(view => {
        view.classList.toggle('active', view.id === `${tabName}-view`);
    });
}

function handleOptionClick(e: Event) {
    const chip = (e.target as HTMLElement).closest('.option-chip');
    if (!chip || chip.classList.contains('locked') || !currentProfile) return;

    // FIX: Cast the chip to HTMLElement to access its dataset property.
    const id = (chip as HTMLElement).dataset.id!;
    // FIX: Cast the chip to HTMLElement to access its dataset property.
    const type = (chip as HTMLElement).dataset.type! as CustomizationItem['type'];

    // Update temporary state
    if (type === 'color') {
        const colorItem = CUSTOMIZATION_DATA.find(i => i.id === id);
        if (colorItem) temporaryCustomization.boatColor = colorItem.preview; // use hex color, not id
    }
    else if (type === 'flag') temporaryCustomization.flagId = id;
    else if (type === 'decal') temporaryCustomization.decalId = id;
    else if (type === 'trail') temporaryCustomization.trailId = id;

    // Update UI
    document.querySelectorAll(`.customization-view[id^="${type}"] .option-chip`).forEach(c => c.classList.remove('selected'));
    chip.classList.add('selected');
    updatePreview();
}

function handleConfirm() {
    if(!currentProfile) return;
    currentProfile.customization = temporaryCustomization;
    savePlayerProfile(currentProfile);
    try {
        // Mirror to Firestore subdocument for easier cross-device sync/history
        db.collection('players').doc(currentProfile.uid).collection('customization').doc('current').set({
            ...currentProfile.customization,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    } catch {}
    closeModal();
}

function handleReset() {
    temporaryCustomization = JSON.parse(JSON.stringify(initialCustomization));
    renderOptions();
    updatePreview();
}


// --- INITIALIZATION ---
function initCustomization() {
    if (!overlay || !closeBtn) {
        console.error("Customization UI elements not found.");
        return;
    }

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });

    tabs.forEach(tab => tab.addEventListener('click', switchTab));
    
    document.getElementById('customization-content')?.addEventListener('click', handleOptionClick);

    confirmBtn?.addEventListener('click', handleConfirm);
    resetBtn?.addEventListener('click', handleReset);
}

initCustomization();
