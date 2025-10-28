// FIX: Switched to Firebase v8 compatibility imports.
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { getPlayerProfile, PlayerProfile, savePlayerProfile } from './profile-data';

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
interface RewardCost {
    coins?: number;
    coral?: number;
}
interface RewardItem {
    id: string;
    name: string;
    category: 'ของสะสม' | 'คูปอง' | 'การบริจาค';
    cost: RewardCost;
    stock: number | null; // null for infinite
    delivery: 'shipping' | 'qr' | 'certificate';
    emoji: string;
}
interface RedemptionHistoryEntry {
    rewardId: string;
    date: string;
    cost: RewardCost;
}

// --- DATA SIMULATION ---
const REWARDS_DATA: RewardItem[] = [
    { id: 'eco_bottle', name: 'ขวดน้ำรักษ์โลก', category: 'ของสะสม', cost: { coins: 5000, coral: 5 }, stock: 100, delivery: 'shipping', emoji: '💧' },
    { id: 'sticker_set', name: 'ชุดสติกเกอร์ผู้พิทักษ์', category: 'ของสะสม', cost: { coins: 1500 }, stock: 250, delivery: 'shipping', emoji: '✨' },
    { id: 'cafe_coupon', name: 'ส่วนลด Eco Cafe 15%', category: 'คูปอง', cost: { coins: 2000, coral: 3 }, stock: null, delivery: 'qr', emoji: '☕' },
    { id: 'plant_tree', name: 'ปลูกต้นไม้ 1 ต้น', category: 'การบริจาค', cost: { coins: 1000, coral: 5 }, stock: null, delivery: 'certificate', emoji: '🌳' },
    { id: 'release_turtle', name: 'ปล่อยเต่าทะเล 1 ตัว', category: 'การบริจาค', cost: { coins: 3000, coral: 10 }, stock: null, delivery: 'certificate', emoji: '🐢' },
    { id: 'premium_tshirt', name: 'เสื้อยืด Limited Edition', category: 'ของสะสม', cost: { coins: 8000 }, stock: 50, delivery: 'shipping', emoji: '👕' },
];
const REWARD_STOCK_KEY = 'cleanwater_quest_reward_stock';
const REDEEM_HISTORY_KEY_PREFIX = 'cleanwater_quest_redeem_history_';

// --- DOM ELEMENTS ---
import audio from './audio';
const overlay = document.getElementById('redeem-overlay');
const closeBtn = document.getElementById('redeem-close-btn');
const tabsContainer = document.getElementById('redeem-tabs');
const contentEl = document.getElementById('redeem-content');
const currencyDisplayEl = document.getElementById('player-currency-display');
const dialogOverlay = document.getElementById('redeem-dialog-overlay');
const dialogEl = document.getElementById('redeem-dialog');

// --- STATE ---
// FIX: Use firebase.User to match the compatibility SDK's user type.
let currentPlayer: firebase.User | null = null;
let currentProfile: PlayerProfile | null = null;
let activeTab: 'all' | 'donation' | 'history' = 'all';
let rewardStock: { [key: string]: number } = {};

// --- DATA MANAGEMENT ---
function loadStock() {
    const savedStock = localStorage.getItem(REWARD_STOCK_KEY);
    if (savedStock) {
        rewardStock = JSON.parse(savedStock);
    } else {
        // Initialize stock from data
        REWARDS_DATA.forEach(item => {
            if (item.stock !== null) {
                rewardStock[item.id] = item.stock;
            }
        });
        saveStock();
    }
}
function saveStock() {
    localStorage.setItem(REWARD_STOCK_KEY, JSON.stringify(rewardStock));
}

function getHistory(): RedemptionHistoryEntry[] {
    if (!currentPlayer) return [];
    const key = `${REDEEM_HISTORY_KEY_PREFIX}${currentPlayer.uid}`;
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : [];
}
function saveHistory(history: RedemptionHistoryEntry[]) {
    if (!currentPlayer) return;
    const key = `${REDEEM_HISTORY_KEY_PREFIX}${currentPlayer.uid}`;
    localStorage.setItem(key, JSON.stringify(history));
}

// --- UI RENDERING ---
function formatCost(cost: RewardCost): string {
    const parts: string[] = [];
    if (cost.coins) parts.push(`💰 ${cost.coins.toLocaleString()}`);
    if (cost.coral) parts.push(`🌊 ${cost.coral.toLocaleString()}`);
    return parts.join(' + ');
}

function renderUI() {
    if (!contentEl || !currencyDisplayEl || !currentProfile) return;
    contentEl.innerHTML = '';

    currencyDisplayEl.textContent = `คุณมี: 💰 ${currentProfile.coins.toLocaleString()} | 🌊 ${currentProfile.coral.toLocaleString()}`;

    if (activeTab === 'history') {
        renderHistory();
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'reward-grid';
    
    const filteredRewards = REWARDS_DATA.filter(item => {
        if (activeTab === 'all') return true;
        if (activeTab === 'donation') return item.category === 'การบริจาค';
        return false;
    });

    filteredRewards.forEach(item => {
        const stock = item.stock !== null ? rewardStock[item.id] : Infinity;
        const canAfford = (currentProfile!.coins >= (item.cost.coins || 0)) && (currentProfile!.coral >= (item.cost.coral || 0));
        const isOutOfStock = stock <= 0;

        const card = document.createElement('div');
        card.className = 'reward-card';
        if (isOutOfStock) card.classList.add('out-of-stock');

        card.innerHTML = `
            <div class="reward-image-container">
                <div class="reward-emoji">${item.emoji}</div>
                ${item.stock !== null ? `<span class="stock-label">เหลือ ${stock} ชิ้น</span>` : ''}
                ${isOutOfStock ? `<div class="out-of-stock-overlay">หมดแล้ว</div>` : ''}
            </div>
            <div class="reward-info">
                <div class="reward-name">${item.name}</div>
                <div class="reward-category">${item.category}</div>
                <div class="reward-cost">${formatCost(item.cost)}</div>
            </div>
            <button class="redeem-button" data-id="${item.id}" ${!canAfford || isOutOfStock ? 'disabled' : ''}>
                ${!canAfford ? 'แต้มไม่พอ' : 'แลกเลย'}
            </button>
        `;
        grid.appendChild(card);
    });
    contentEl.appendChild(grid);
}

function renderHistory() {
    if (!contentEl) return;
    const history = getHistory();
    const list = document.createElement('div');
    list.className = 'history-list';

    if (history.length === 0) {
        list.innerHTML = `<p>ยังไม่มีประวัติการแลกของ</p>`;
    } else {
        history.reverse().forEach(entry => {
            const item = REWARDS_DATA.find(r => r.id === entry.rewardId);
            if (!item) return;

            const entryEl = document.createElement('div');
            entryEl.className = 'history-entry';
            entryEl.innerHTML = `
                <div class="history-icon">💎</div>
                <div class="history-details">
                    <div class="history-name">${item.name}</div>
                    <div class="history-date">${new Date(entry.date).toLocaleString('th-TH')}</div>
                </div>
                <div class="history-cost">${formatCost(entry.cost)}</div>
            `;
            list.appendChild(entryEl);
        });
    }
    contentEl.appendChild(list);
}

// --- DIALOG LOGIC ---
function closeDialog() {
    dialogOverlay?.classList.add('hidden');
}

function showConfirmationDialog(reward: RewardItem, onConfirm: () => void) {
    if (!dialogEl || !dialogOverlay) return;
    dialogEl.innerHTML = `
        <h3 class="dialog-title">ยืนยันการแลก</h3>
        <p class="dialog-message">คุณต้องการแลก "${reward.name}" โดยใช้ ${formatCost(reward.cost)} ใช่หรือไม่?</p>
        <div class="dialog-buttons">
            <button class="dialog-btn cancel">ยกเลิก</button>
            <button class="dialog-btn confirm">ยืนยัน</button>
        </div>
    `;
    dialogOverlay.classList.remove('hidden');

    dialogEl.querySelector('.confirm')?.addEventListener('click', () => { onConfirm(); closeDialog(); });
    dialogEl.querySelector('.cancel')?.addEventListener('click', closeDialog);
}

function showAddressForm(reward: RewardItem, onConfirm: (address: string) => void) {
    if (!dialogEl || !dialogOverlay) return;
    dialogEl.innerHTML = `
        <h3 class="dialog-title">ที่อยู่สำหรับจัดส่ง</h3>
        <p class="dialog-message">กรุณากรอกที่อยู่สำหรับจัดส่ง "${reward.name}"</p>
        <form class="dialog-form">
            <input type="text" id="redeem-name" placeholder="ชื่อ-นามสกุล" required>
            <textarea id="redeem-address" placeholder="ที่อยู่, รหัสไปรษณีย์" rows="3" required></textarea>
        </form>
        <div class="dialog-buttons">
            <button class="dialog-btn cancel">ยกเลิก</button>
            <button class="dialog-btn confirm">ยืนยัน</button>
        </div>
    `;
    dialogOverlay.classList.remove('hidden');

    const form = dialogEl.querySelector('form');
    dialogEl.querySelector('.confirm')?.addEventListener('click', () => {
        if (form?.checkValidity()) {
            const name = (document.getElementById('redeem-name') as HTMLInputElement).value;
            const address = (document.getElementById('redeem-address') as HTMLTextAreaElement).value;
            onConfirm(`${name}\n${address}`);
            closeDialog();
        } else {
            alert('กรุณากรอกข้อมูลให้ครบถ้วน');
        }
    });
    dialogEl.querySelector('.cancel')?.addEventListener('click', closeDialog);
}

function showResultDialog(title: string, message: string) {
     if (!dialogEl || !dialogOverlay) return;
    dialogEl.innerHTML = `
        <h3 class="dialog-title">${title}</h3>
        <div class="dialog-message">${message}</div>
        <div class="dialog-buttons">
            <button class="dialog-btn confirm">ตกลง</button>
        </div>
    `;
    dialogOverlay.classList.remove('hidden');
    dialogEl.querySelector('.confirm')?.addEventListener('click', closeDialog);
}


// --- CORE LOGIC & EVENT HANDLERS ---
function processRedemption(reward: RewardItem, address?: string) {
    if (!currentProfile) return;

    // 1. Deduct currency
    currentProfile.coins -= (reward.cost.coins || 0);
    currentProfile.coral -= (reward.cost.coral || 0);
    savePlayerProfile(currentProfile);

    // 2. Update stock
    if (reward.stock !== null) {
        rewardStock[reward.id] -= 1;
        saveStock();
    }

    // 3. Add to history
    const history = getHistory();
    history.push({
        rewardId: reward.id,
        date: new Date().toISOString(),
        cost: reward.cost,
    });
    saveHistory(history);

    // 4. Show success & re-render
    console.log(`Redeemed ${reward.name}. Delivery details:`, address || 'Digital delivery');
    
    if(reward.delivery === 'qr') {
       showResultDialog('แลกคูปองสำเร็จ!', `
        <p>โปรดแสดง QR Code นี้ที่ร้านค้า</p>
        <div class="dialog-qr-code">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=COUPON-${reward.id}-${currentPlayer?.uid}" alt="QR Code">
        </div>`);
    } else {
       showResultDialog('แลกรางวัลสำเร็จ!', `
       <p>เราได้รับคำขอแลก "${reward.name}" ของคุณแล้ว!</p>
       ${reward.delivery === 'shipping' ? '<p>จะดำเนินการจัดส่งใน 3-5 วันทำการ</p>' : ''}
       <p>คุณสามารถตรวจสอบสถานะได้ในหน้าประวัติ</p>`);
    }

    renderUI();
}

function handleRedeemClick(e: Event) {
    const target = e.target as HTMLElement;
    if (!target.matches('.redeem-button')) return;

    const rewardId = target.dataset.id;
    if (!rewardId) return;

    const reward = REWARDS_DATA.find(r => r.id === rewardId);
    if (!reward) return;

    showConfirmationDialog(reward, () => {
        if (reward.delivery === 'shipping') {
            showAddressForm(reward, (address) => {
                processRedemption(reward, address);
            });
        } else {
            processRedemption(reward);
        }
    });
}

export function openRedeemModal() {
    currentPlayer = auth.currentUser;
    if (!currentPlayer || !overlay) return;

    if (currentPlayer.isAnonymous) {
        alert("จำเป็นต้องเข้าสู่ระบบเพื่อแลกของรางวัล!");
        return;
    }

    currentProfile = getPlayerProfile(currentPlayer);
    loadStock();
    renderUI();
    overlay.classList.remove('hidden');
    try { audio.uiOpen(); } catch {}
}

function closeModal() {
    overlay?.classList.add('hidden');
    try { audio.uiClose(); } catch {}
}

function switchTab(e: Event) {
    const target = e.currentTarget as HTMLElement;
    const tab = target.dataset.tab as typeof activeTab;
    if (tab === activeTab) return;

    activeTab = tab;
    tabsContainer?.querySelector('.active')?.classList.remove('active');
    target.classList.add('active');
    renderUI();
}

// --- INITIALIZATION ---
function initRedeem() {
    if (!overlay || !closeBtn || !tabsContainer || !contentEl) {
        console.error("Redeem UI elements not found.");
        return;
    }
    
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });
    dialogOverlay?.addEventListener('click', (e) => {
        if(e.target === dialogOverlay) closeDialog();
    });

    tabsContainer.querySelectorAll('.redeem-tab').forEach(tab => {
        tab.addEventListener('click', (e)=>{ switchTab(e); try { audio.uiClick(); } catch {} });
    });
    contentEl.addEventListener('click', handleRedeemClick);
}

initRedeem();
