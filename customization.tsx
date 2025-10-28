// Clean rebuild: Customization modal logic (UTF-8 safe)
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import { PlayerProfile, getPlayerProfile, savePlayerProfile } from './profile-data';

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
const db = firebase.firestore();

// Types
type UnlockType = 'free' | 'level' | 'coins' | 'stat' | 'contract' | 'comingsoon';
type StatKey = keyof PlayerProfile['stats'];

interface CustomizationItem {
  id: string;
  name: string;
  type: 'color' | 'flag' | 'decal' | 'trail';
  preview: string; // hex color for color/flag; text/icon for others
  unlock: { type: UnlockType; value: number | string; cost?: number };
}

// Data: extended palette + usable color flags
const COLORS: CustomizationItem[] = [
  ['Seafoam', '#34d399', 'free', 0],
  ['Sky Blue', '#38bdf8', 'coins', 100],
  ['Coral Pink', '#fb7185', 'coins', 150],
  ['Ocean Deep', '#3730a3', 'level', 10],
  ['Mint', '#10b981', 'coins', 120],
  ['Lavender', '#a78bfa', 'coins', 180],
  ['Sunset', '#f97316', 'level', 8],
  ['Teal', '#14b8a6', 'coins', 120],
  ['Cyan', '#22d3ee', 'coins', 140],
  ['Emerald', '#059669', 'level', 6],
  ['Lime', '#84cc16', 'coins', 160],
  ['Amber', '#f59e0b', 'coins', 160],
  ['Rose', '#f43f5e', 'coins', 200],
  ['Purple', '#7c3aed', 'level', 12],
  ['Slate', '#475569', 'coins', 110],
  ['Black Pearl', '#0f172a', 'coins', 190],
].map(([name, hex, t, v], i) => ({ id: `color_${i}`, name, type: 'color' as const, preview: hex as string, unlock: { type: t as UnlockType, value: v as number } }));

const FLAGS: CustomizationItem[] = [
  ['Default', '#f0f8ff', 'free', 0],
  ['Teal', '#14b8a6', 'coins', 150],
  ['Cyan', '#22d3ee', 'coins', 150],
  ['Gold', '#fbbf24', 'level', 7],
  ['Pink', '#fb7185', 'coins', 150],
  ['Purple', '#8b5cf6', 'coins', 150],
  ['Wave', '#38bdf8', 'coins', 180],
  ['Reef', '#34d399', 'contract', 'weekly_donate_30'],
].map(([name, hex, t, v], i) => ({ id: `flag_${i}`, name, type: 'flag' as const, preview: hex as string, unlock: { type: t as UnlockType, value: v as any } }));

const DECALS: CustomizationItem[] = [
  { id: 'decal_none', name: 'None', type: 'decal', preview: '-', unlock: { type: 'free', value: 0 } },
  { id: 'decal_wave', name: 'Wave', type: 'decal', preview: '~', unlock: { type: 'comingsoon', value: 0 } },
  { id: 'decal_reef', name: 'Reef', type: 'decal', preview: '~', unlock: { type: 'comingsoon', value: 0 } },
];

const TRAILS: CustomizationItem[] = [
  { id: 'trail_none', name: 'None', type: 'trail', preview: '~', unlock: { type: 'free', value: 0 } },
  { id: 'trail_bubbles', name: 'Bubbles', type: 'trail', preview: '~', unlock: { type: 'comingsoon', value: 0 } },
  { id: 'trail_glow', name: 'Glow', type: 'trail', preview: '~', unlock: { type: 'comingsoon', value: 0 } },
];

const DATA: CustomizationItem[] = [...COLORS, ...FLAGS, ...DECALS, ...TRAILS];

// DOM
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

// State
let currentPlayer: firebase.User | null = null;
let currentProfile: PlayerProfile | null = null;
let temporaryCustomization: PlayerProfile['customization'];
let initialCustomization: PlayerProfile['customization'];

function isUnlocked(item: CustomizationItem, profile: PlayerProfile): boolean {
  switch (item.unlock.type) {
    case 'free': return true;
    case 'level': return profile.level >= (item.unlock.value as number);
    case 'coins': return true; // purchasable with coins – always visible
    case 'stat': {
      const key = item.unlock.value as StatKey;
      const req = item.unlock.cost || 0;
      return (profile.stats[key] as any) >= req;
    }
    case 'contract': return false; // treat as locked until implemented
    case 'comingsoon': return false;
    default: return false;
  }
}

function getUnlockConditionText(item: CustomizationItem): string {
  switch (item.unlock.type) {
    case 'level': return `ต้องการ LV ${item.unlock.value}`;
    case 'coins': return `เหรียญ ${item.unlock.value}`;
    case 'stat': {
      const key = item.unlock.value as string;
      const cost = item.unlock.cost || 0;
      const label = key === 'bestScore' ? 'ค่าคะแนนสูงสุด' : key === 'totalSortedCorrect' ? 'แยกถูกต้อง' : key;
      return `${label} ${cost}`;
    }
    case 'contract': return 'ภารกิจพิเศษเร็วๆ นี้';
    case 'comingsoon': return 'รออัปเดต';
    default: return '';
  }
}

function updatePreview() {
  if (!hull || !flagCanvas || !decalLayer || !wakeTrail) return;
  // Boat color is stored as hex
  hull.setAttribute('fill', temporaryCustomization.boatColor);
  // Flag: our FLAGS use hex previews; fill directly
  const flagItem = DATA.find((i) => i.id === temporaryCustomization.flagId);
  const flagColor = flagItem && /^#/.test(flagItem.preview) ? flagItem.preview : '#f0f8ff';
  flagCanvas.setAttribute('fill', flagColor);
  // Decal
  if (temporaryCustomization.decalId && temporaryCustomization.decalId !== 'decal_none') {
    decalLayer.setAttribute('fill', `url(#${temporaryCustomization.decalId.replace('decal_', '')})`);
  } else {
    decalLayer.setAttribute('fill', 'transparent');
  }
  // Trail visibility
  wakeTrail.style.opacity = temporaryCustomization.trailId === 'trail_none' ? '0' : '1';
}

function renderOptions() {
  if (!currentProfile) return;
  views.forEach((view) => {
    const type = view.id.replace('-view', '') as CustomizationItem['type'];
    const items = DATA.filter((i) => i.type === type);
    view.innerHTML = '';
    items.forEach((item) => {
      const unlocked = isUnlocked(item, currentProfile!);
      const selected = (type === 'color')
        ? temporaryCustomization.boatColor === item.preview
        : (temporaryCustomization as any)[`${type}Id`] === item.id;

      const chip = document.createElement('div');
      chip.className = 'option-chip';
      chip.dataset.id = item.id;
      chip.dataset.type = item.type;
      if (selected) chip.classList.add('selected');
      if (!unlocked) chip.classList.add('locked');

      let inner = '';
      if (item.type === 'color' || item.type === 'flag') {
        inner = `<div class="color-swatch" style="background-color:${item.preview}"></div>`;
      } else {
        inner = `<div class="${item.type}-preview">${item.preview}</div>`;
      }
      inner += `<span class="option-name">${item.name}</span>`;
      if (!unlocked) {
        inner += `<div class="locked-overlay"><div class="lock-icon">🔒</div><div class="unlock-condition">${getUnlockConditionText(item)}</div></div>`;
      }
      chip.innerHTML = inner;
      view.appendChild(chip);
    });
  });
}

function switchTab(e: Event) {
  const target = e.currentTarget as HTMLElement;
  if (target.classList.contains('active')) return;
  const tabName = target.dataset.tab;
  tabs.forEach((t) => t.classList.remove('active'));
  target.classList.add('active');
  views.forEach((v) => v.classList.toggle('active', v.id === `${tabName}-view`));
}

function onOptionClick(e: Event) {
  const chip = (e.target as HTMLElement).closest('.option-chip') as HTMLElement | null;
  if (!chip || chip.classList.contains('locked')) return;
  const id = chip.dataset.id!;
  const type = chip.dataset.type as CustomizationItem['type'];
  if (type === 'color') {
    const color = DATA.find((i) => i.id === id)?.preview || '#34d399';
    temporaryCustomization.boatColor = color;
  } else if (type === 'flag') {
    temporaryCustomization.flagId = id;
  } else if (type === 'decal') {
    temporaryCustomization.decalId = id;
  } else if (type === 'trail') {
    temporaryCustomization.trailId = id;
  }
  document.querySelectorAll(`.customization-view[id^="${type}"] .option-chip`).forEach((el) => el.classList.remove('selected'));
  chip.classList.add('selected');
  updatePreview();
}

function handleConfirm() {
  if (!currentProfile) return;
  currentProfile.customization = temporaryCustomization;
  savePlayerProfile(currentProfile);
  try {
    db.collection('players').doc(currentProfile.uid).collection('customization').doc('current').set({
      ...currentProfile.customization,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  } catch {}
  overlay?.classList.add('hidden');
}

function handleReset() {
  if (!currentProfile) return;
  temporaryCustomization = JSON.parse(JSON.stringify(initialCustomization));
  renderOptions();
  updatePreview();
}

export function openCustomizationModal() {
  currentPlayer = auth.currentUser;
  if (!currentPlayer || !overlay) return;
  if (currentPlayer.isAnonymous) { alert('ฟีเจอร์นี้ต้องใช้บัญชีผู้เล่น'); return; }
  currentProfile = getPlayerProfile(currentPlayer);
  temporaryCustomization = JSON.parse(JSON.stringify(currentProfile.customization));
  initialCustomization = JSON.parse(JSON.stringify(currentProfile.customization));
  renderOptions();
  updatePreview();
  overlay.classList.remove('hidden');
}

function closeModal() { overlay?.classList.add('hidden'); }

function init() {
  if (!overlay || !closeBtn) return;
  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  tabs.forEach((t) => t.addEventListener('click', switchTab));
  document.getElementById('customization-content')?.addEventListener('click', onOptionClick);
  confirmBtn?.addEventListener('click', handleConfirm);
  resetBtn?.addEventListener('click', handleReset);
}

init();

