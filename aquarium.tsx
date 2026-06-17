import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { getPlayerProfile, savePlayerProfile, PlayerProfile } from './profile-data';
import audio from './audio';

export interface FishAsset {
    id: string;
    name: string;
    description: string;
    price: number;
    image: string;
}

export const FISH_DATA: FishAsset[] = [
    { id: 'fish1', name: 'ปลาสวยงาม 1', description: 'ปลาสีสันสดใส', price: 100, image: 'Fish/Layer 1 copy.png' },
    { id: 'fish2', name: 'ปลาสวยงาม 2', description: 'ปลาสีสันสดใส', price: 200, image: 'Fish/Layer 1 copy 2.png' },
    { id: 'fish3', name: 'ปลาสวยงาม 3', description: 'ปลาสีสันสดใส', price: 300, image: 'Fish/Layer 1 copy 3.png' },
    { id: 'fish4', name: 'ปลาสวยงาม 4', description: 'ปลาสีสันสดใส', price: 400, image: 'Fish/Layer 1 copy 4.png' },
    { id: 'fish5', name: 'ปลาสวยงาม 5', description: 'ปลาสีสันสดใส', price: 500, image: 'Fish/Layer 1 copy 5.png' },
    { id: 'fish6', name: 'ปลาสวยงาม 6', description: 'ปลาสีสันสดใส', price: 600, image: 'Fish/Layer 1 copy 6.png' },
    { id: 'fish7', name: 'ปลาสวยงาม 7', description: 'ปลาสีสันสดใส', price: 700, image: 'Fish/Layer 1 copy 7.png' },
    { id: 'fish8', name: 'ปลาสวยงาม 8', description: 'ปลาสีสันสดใส', price: 800, image: 'Fish/Layer 1 copy 8.png' },
    { id: 'fish9', name: 'ปลาสวยงาม 9', description: 'ปลาสีสันสดใส', price: 900, image: 'Fish/Layer 1 copy 9.png' },
    { id: 'fish10', name: 'ปลาสวยงาม 10', description: 'ปลาสีสันสดใส', price: 1000, image: 'Fish/Layer 1 copy 10.png' },
    { id: 'fish11', name: 'ปลาสวยงาม 11', description: 'ปลาสีสันสดใส', price: 1100, image: 'Fish/Layer 1 copy 11.png' },
    { id: 'fish12', name: 'ปลาสวยงาม 12', description: 'ปลาสีสันสดใส', price: 1200, image: 'Fish/Layer 1 copy 12.png' },
    { id: 'fish13', name: 'ปลาสวยงาม 13', description: 'ปลาสีสันสดใส', price: 1300, image: 'Fish/Layer 1 copy 13.png' },
    { id: 'fish14', name: 'ปลาสวยงาม 14', description: 'ปลาสีสันสดใส', price: 1400, image: 'Fish/Layer 1 copy 14.png' },
    { id: 'fish15', name: 'ปลาสวยงาม 15', description: 'ปลาสีสันสดใส', price: 1500, image: 'Fish/Layer 1 copy 15.png' },
    { id: 'fish16', name: 'ปลาสวยงาม 16', description: 'ปลาสีสันสดใส', price: 1600, image: 'Fish/Layer 1 copy 16.png' },
    { id: 'fish17', name: 'ปลาสวยงาม 17', description: 'ปลาสีสันสดใส', price: 1700, image: 'Fish/Layer 1 copy 17.png' },
    { id: 'fish18', name: 'ปลาสวยงาม 18', description: 'ปลาสีสันสดใส', price: 1800, image: 'Fish/Layer 1 copy 18.png' },
    { id: 'fish19', name: 'ปลาสวยงาม 19', description: 'ปลาสีสันสดใส', price: 1900, image: 'Fish/Layer 1 copy 19.png' },
    { id: 'fish20', name: 'ปลาสวยงาม 20', description: 'ปลาสีสันสดใส', price: 2000, image: 'Fish/Layer 1 copy 20.png' },
    { id: 'fish21', name: 'ปลาสวยงาม 21', description: 'ปลาสีสันสดใส', price: 2100, image: 'Fish/Layer 1 copy 21.png' },
    { id: 'fish22', name: 'ปลาสวยงาม 22', description: 'ปลาสีสันสดใส', price: 2200, image: 'Fish/Layer 1 copy 22.png' },
    { id: 'fish23', name: 'ปลาสวยงาม 23', description: 'ปลาสีสันสดใส', price: 2300, image: 'Fish/Layer 1 copy 23.png' },
    { id: 'fish24', name: 'ปลาสวยงาม 24', description: 'ปลาสีสันสดใส', price: 2400, image: 'Fish/Layer 1 copy 24.png' },
    { id: 'fish25', name: 'ปลาสวยงาม 25', description: 'ปลาสีสันสดใส', price: 2500, image: 'Fish/Layer 1 copy 25.png' },
    { id: 'fish26', name: 'ปลาสวยงาม 26', description: 'ปลาสีสันสดใส', price: 2600, image: 'Fish/Layer 1 copy 26.png' },
    { id: 'fish27', name: 'ปลาสวยงาม 27', description: 'ปลาสีสันสดใส', price: 2700, image: 'Fish/Layer 1 copy 27.png' },
    { id: 'fish28', name: 'ปลาสวยงาม 28', description: 'ปลาสีสันสดใส', price: 2800, image: 'Fish/Layer 1 copy 28.png' },
    { id: 'fish29', name: 'ปลาสวยงาม 29', description: 'ปลาสีสันสดใส', price: 2900, image: 'Fish/Layer 1 copy 29.png' },
    { id: 'fish30', name: 'ปลาสวยงาม 30', description: 'ปลาสีสันสดใส', price: 3000, image: 'Fish/Layer 1 copy 30.png' },
];

let currentProfile: PlayerProfile | null = null;

// แก้ไขให้ Export ฟังก์ชันที่ขาดไปแล้ว
export function initAquariumBackground() {
    console.log("Aquarium background initialized");
}

export function openAquariumModal() {
    const user = firebase.auth().currentUser;
    if (!user) return;
    
    currentProfile = getPlayerProfile(user);
    renderAquariumShop();
    
    const overlay = document.getElementById('aquarium-overlay');
    if (overlay) overlay.classList.remove('hidden');
    audio.uiClick();
}

// ... (โค้ดส่วนที่เหลือเหมือนเดิม) ...
function closeAquariumModal() {
    const overlay = document.getElementById('aquarium-overlay');
    if (overlay) overlay.classList.add('hidden');
    audio.uiClick();
}

function renderAquariumShop() {
    if (!currentProfile) return;
    
    const currencyDisplay = document.getElementById('aquarium-player-currency');
    if (currencyDisplay) {
        const slotsUsed = currentProfile.aquariumFish.length;
        const slotsTotal = currentProfile.fishSlots;
        const slotCost = 1000;
        const canBuySlot = currentProfile.coins >= slotCost;
        
        currencyDisplay.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px;">
                <span>🐟 ${slotsUsed}/${slotsTotal}</span>
                <button id="buy-slot-btn" class="menu-button" style="padding: 4px 8px; font-size: 0.9rem;" ${canBuySlot ? '' : 'disabled'}>
                    เพิ่มช่อง (💰 ${slotCost})
                </button>
                <span>💰 ${currentProfile.coins}</span>
            </div>
        `;

        const buySlotBtn = document.getElementById('buy-slot-btn');
        if (buySlotBtn) {
            buySlotBtn.addEventListener('click', () => {
                if (currentProfile && currentProfile.coins >= slotCost) {
                    currentProfile.coins -= slotCost;
                    currentProfile.fishSlots += 1;
                    savePlayerProfile(currentProfile);
                    audio.uiClick();
                    renderAquariumShop();
                }
            });
        }
    }
    
    const content = document.getElementById('aquarium-content');
    if (!content) return;
    
    content.innerHTML = '';
    
    FISH_DATA.forEach(fish => {
        const canAfford = currentProfile!.coins >= fish.price;
        const hasSlot = currentProfile!.aquariumFish.length < currentProfile!.fishSlots;
        const canBuy = canAfford && hasSlot;
        
        const card = document.createElement('div');
        card.className = `fish-card`;
        
        card.innerHTML = `
            <div class="fish-image-container">
                <img src="${fish.image}" alt="${fish.name}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 100 100\\'><text y=\\'50\\' font-size=\\'40\\'>🐟</text></svg>'">
            </div>
            <div class="fish-name">${fish.name}</div>
            <div class="fish-desc">${fish.description}</div>
            <button class="fish-buy-btn" ${canBuy ? '' : 'disabled'} data-id="${fish.id}">
                ${!hasSlot ? 'ช่องเต็ม' : `💰 ${fish.price}`}
            </button>
        `;
        
        content.appendChild(card);
    });
    
    const buyBtns = content.querySelectorAll('.fish-buy-btn:not(:disabled)');
    buyBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const fishId = (e.currentTarget as HTMLButtonElement).getAttribute('data-id');
            if (fishId) buyFish(fishId);
        });
    });
}

function buyFish(fishId: string) {
    if (!currentProfile) return;
    
    const fish = FISH_DATA.find(f => f.id === fishId);
    if (!fish) return;
    
    if (currentProfile.coins >= fish.price && currentProfile.aquariumFish.length < currentProfile.fishSlots) {
        currentProfile.coins -= fish.price;
        currentProfile.aquariumFish.push(fishId);
        savePlayerProfile(currentProfile);
        
        audio.uiClick();
        renderAquariumShop();
        window.dispatchEvent(new CustomEvent('aquarium-updated'));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('aquarium-close-btn');
    const overlay = document.getElementById('aquarium-overlay');
    
    if (closeBtn) closeBtn.addEventListener('click', closeAquariumModal);
    if (overlay) overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeAquariumModal();
    });
    
    const aquariumBtn = document.querySelector('[data-menu="aquarium"]');
    if (aquariumBtn) {
        aquariumBtn.addEventListener('click', () => {
            const user = firebase.auth().currentUser;
            if (user) {
                if (user.isAnonymous) {
                    const loginOverlay = document.getElementById('login-required-overlay');
                    if (loginOverlay) loginOverlay.classList.remove('hidden');
                } else {
                    openAquariumModal();
                }
            }
        });
    }
});
