// --- DATA ---
const dailyRewardsData = [
  { day: 1, rewards: { coins: 50 }, ecoFact: "ถุงพลาสติกใช้เวลา 500 ปีในการย่อยสลาย" },
  { day: 2, rewards: { coralFragments: 2 }, ecoFact: "แนวปะการังคือบ้านของสิ่งมีชีวิตกว่า 25% ของทะเล" },
  { day: 3, rewards: { xp: 100 }, ecoFact: "รีไซเคิลขวดน้ำ 1 ใบ ช่วยลด CO₂ ได้ 20 กรัม" },
  { day: 4, rewards: { coins: 70 }, ecoFact: "ขยะ 80% ในทะเลมาจากกิจกรรมบนบก" },
  { day: 5, rewards: { coralFragments: 3 }, ecoFact: "ปะการัง 1 กอช่วยสัตว์น้ำกว่า 150 ชนิด" },
  { day: 6, rewards: { xp: 150 }, ecoFact: "ขวดพลาสติกใช้เวลา 450 ปีในการย่อยสลาย" },
  { day: 7, rewards: { coins: 150, coral: 5 }, ecoFact: "ช่วยทะเลสะอาดขึ้น 1% แล้ววันนี้!", isMilestone: true },
  { day: 8, rewards: { coins: 80 }, ecoFact: "การลดพลาสติกใช้ครั้งเดียวช่วยโลกได้มาก" },
  { day: 9, rewards: { xp: 150 }, ecoFact: "โลมาอาจคิดว่าถุงพลาสติกคือปลาหมึก" },
  { day: 10, rewards: { coral: 3 }, ecoFact: "การปลูกปะการังช่วยลดคลื่นซัดฝั่งได้ 97%" },
  { day: 11, rewards: { coins: 100 }, ecoFact: "ขยะเล็ก ๆ รวมกันก็ทำลายระบบนิเวศได้" },
  { day: 12, rewards: { xp: 200 }, ecoFact: "ขยะอันตรายต้องแยกจากขยะทั่วไป" },
  { day: 13, rewards: { coral: 5 }, ecoFact: "ทุกคนช่วยโลกได้ด้วยการแยกขยะถูกประเภท", isMilestone: true },
  { day: 14, rewards: { coins: 120 }, ecoFact: "รีไซเคิลกระป๋อง = ประหยัดพลังงานเปิดหลอดไฟ 3 ชม." },
  { day: 15, rewards: { xp: 250 }, ecoFact: "ขยะพลาสติกในทะเลมากกว่าจำนวนปลา!" },
  { day: 16, rewards: { coral: 4 }, ecoFact: "แนวปะการังช่วยดูดซับคาร์บอนไดออกไซด์ในน้ำทะเล" },
  { day: 17, rewards: { coins: 130 }, ecoFact: "ลดขยะวันละชิ้น = ลดขยะปีละ 365 ชิ้น" },
  { day: 18, rewards: { coral: 5, xp: 205 }, ecoFact: "ทะเลสะอาด = โลกหายใจได้ดีขึ้น", isMilestone: true },
  { day: 19, rewards: { coins: 140 }, ecoFact: "ขยะอิเล็กทรอนิกส์เป็นอันตรายต่อสัตว์น้ำ" },
  { day: 20, rewards: { xp: 200 }, ecoFact: "ขยะ 1 กก. ที่ไม่ลงทะเลช่วยชีวิตเต่าได้ 1 ตัว" },
  { day: 21, rewards: { coral: 6 }, ecoFact: "แนวปะการังคือ ‘ป่าฝนใต้ทะเล’" },
  { day: 22, rewards: { coins: 160 }, ecoFact: "ใช้ขวดน้ำซ้ำได้ = ลดพลาสติกกว่า 1,000 ชิ้นต่อปี" },
  { day: 23, rewards: { xp: 250 }, ecoFact: "สัตว์น้ำกินพลาสติกเพราะเข้าใจว่าเป็นอาหาร" },
  { day: 24, rewards: { coins: 200, coral: 5 }, ecoFact: "คุณช่วยฟื้นฟูปะการังเพิ่มอีก 5 กอวันนี้!", isMilestone: true },
  { day: 25, rewards: { coins: 180 }, ecoFact: "ทะเลสะอาดคือแหล่งอาหารยั่งยืนของโลก" },
  { day: 26, rewards: { xp: 250 }, ecoFact: "การรีไซเคิลช่วยลดก๊าซเรือนกระจกได้จริง" },
  { day: 27, rewards: { coral: 7 }, ecoFact: "สาหร่ายทะเลดูดซับคาร์บอนได้มากกว่าไม้หลายเท่า" },
  { day: 28, rewards: { coins: 200 }, ecoFact: "ขยะเล็ก ๆ คือภัยใหญ่ต่อชีวิตใต้ทะเล" },
  { day: 29, rewards: { xp: 300 }, ecoFact: "ทุกคนมีส่วนทำให้โลกสะอาดได้" },
  { day: 30, rewards: { coins: 300, coral: 10 }, ecoFact: "ขอบคุณที่ช่วยทะเลมา 30 วัน — คุณคือฮีโร่แห่งคลื่น!", isMilestone: true },
];

// --- DOM ELEMENTS ---
const rewardsButton = document.querySelector('[data-menu="rewards"]') as HTMLButtonElement;
const overlay = document.getElementById('daily-rewards-overlay');
const closeButton = document.getElementById('daily-rewards-close-btn');
const rewardsGrid = document.getElementById('rewards-grid');
const progressBar = document.getElementById('progress-bar');
const progressDayIndicator = document.getElementById('progress-day-indicator');
const ecoFactText = document.getElementById('eco-fact-text');
const claimButton = document.getElementById('claim-reward-btn') as HTMLButtonElement;

// --- STATE MANAGEMENT ---
const STORAGE_KEYS = {
    PROGRESS: 'cleanwater_quest_daily_rewards_progress'
};

interface UserProgress {
    streak: number;
    lastClaimedDate: string | null;
}

function getUserProgress(): UserProgress {
    const saved = localStorage.getItem(STORAGE_KEYS.PROGRESS);
    if (saved) {
        return JSON.parse(saved);
    }
    return { streak: 0, lastClaimedDate: null };
}

function saveUserProgress(progress: UserProgress) {
    localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(progress));
}

// --- LOGIC ---
function getTodayDateString(): string {
    return new Date().toDateString();
}

function canClaimReward(progress: UserProgress): boolean {
    if (!progress.lastClaimedDate) {
        return true; // First time playing
    }
    return progress.lastClaimedDate !== getTodayDateString();
}

function checkStreak(progress: UserProgress): UserProgress {
    if (!progress.lastClaimedDate) {
        return { streak: 0, lastClaimedDate: null };
    }
    
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const lastClaimed = new Date(progress.lastClaimedDate);

    // If last claim wasn't yesterday or today, streak is broken
    if (lastClaimed.toDateString() !== yesterday.toDateString() && lastClaimed.toDateString() !== today.toDateString()) {
        return { streak: 0, lastClaimedDate: progress.lastClaimedDate };
    }
    
    // If streak is over 30, reset
    if (progress.streak >= 30) {
        return { streak: 0, lastClaimedDate: progress.lastClaimedDate };
    }

    return progress;
}

// --- UI RENDERING ---
function formatRewardIcons(rewards: Record<string, number>): string {
    const iconMap: { [key: string]: string } = {
        coins: '💰',
        xp: '🧭',
        coral: '🌊',
        coralFragments: '🐚',
    };

    let content = '';
    for (const key in rewards) {
        if (iconMap[key]) {
            content += `
                <div class="reward-unit">
                    <span class="reward-icon">${iconMap[key]}</span>
                    <span class="reward-amount">x${rewards[key]}</span>
                </div>
            `;
        }
    }
    return content;
}

function renderUI() {
    if (!rewardsGrid || !progressBar || !progressDayIndicator || !ecoFactText || !claimButton) return;

    let progress = getUserProgress();
    progress = checkStreak(progress);
    const canClaim = canClaimReward(progress);
    const currentDay = progress.streak >= 30 ? 30 : progress.streak + 1;

    // Render Grid
    rewardsGrid.innerHTML = '';
    dailyRewardsData.forEach(reward => {
        const item = document.createElement('li');
        item.classList.add('reward-item');
        
        let state = 'locked';
        if (reward.day < currentDay) state = 'claimed';
        if (reward.day === currentDay && canClaim) state = 'claimable';
        
        item.classList.add(state);
        if (reward.isMilestone) item.classList.add('milestone');
        
        const rewardsCount = Object.keys(reward.rewards).length;

        let itemHTML = `
            <span class="day-label">Day ${reward.day}</span>
            <div class="reward-icons-container" data-count="${rewardsCount}">${formatRewardIcons(reward.rewards)}</div>
        `;
        
        // FIX: Instead of an overlay, add a checkmark icon directly. The dimming is handled by CSS.
        if (state === 'claimed') {
            itemHTML += `<span class="claimed-checkmark-icon">✅</span>`;
        }

        item.innerHTML = itemHTML;
        rewardsGrid.appendChild(item);
    });
    
    // Update Progress Bar & Indicator
    const progressPercent = (progress.streak / 30) * 100;
    const isLandscape = window.innerHeight < window.innerWidth && window.innerHeight <= 520;
    
    if (isLandscape) {
      progressBar.style.width = `${progressPercent}%`;
      progressBar.style.height = '100%';
      progressDayIndicator.style.left = `${progressPercent}%`;
      progressDayIndicator.style.bottom = 'auto'; 
    } else {
      progressBar.style.height = `${progressPercent}%`;
      progressBar.style.width = '100%';
      progressDayIndicator.style.bottom = `${progressPercent}%`;
      progressDayIndicator.style.left = '50%';
    }
    progressDayIndicator.textContent = `Day ${progress.streak}`;


    // Update Footer
    const rewardForToday = dailyRewardsData.find(r => r.day === currentDay);
    ecoFactText.textContent = rewardForToday ? rewardForToday.ecoFact : 'Come back tomorrow for more rewards!';

    claimButton.disabled = !canClaim;
    claimButton.textContent = canClaim ? 'รับรางวัลวันนี้' : 'รับไปแล้ว!';
}


function updateNotificationDot() {
    if (!rewardsButton) return;
    const progress = checkStreak(getUserProgress());
    if (canClaimReward(progress)) {
        rewardsButton.classList.add('has-notification');
    } else {
        rewardsButton.classList.remove('has-notification');
    }
}

// --- EVENT HANDLERS ---
function handleClaim() {
    let progress = getUserProgress();
    progress = checkStreak(progress);

    if (canClaimReward(progress)) {
        // Prevent re-clicking while animation happens
        claimButton.disabled = true;

        progress.streak++;
        progress.lastClaimedDate = getTodayDateString();
        saveUserProgress(progress);
        
        // Add animation/feedback here later
        console.log(`Claimed reward for day ${progress.streak}`);
        
        // Re-render UI to show claimed state and update notification
        renderUI();
        updateNotificationDot();
    }
}

function openModal() {
    if (!overlay) return;
    renderUI(); // Ensure UI is up-to-date before showing
    overlay.classList.remove('hidden');
    rewardsButton?.classList.remove('has-notification'); // Hide dot once opened

    // Scroll to the current day
    const claimableItem = rewardsGrid?.querySelector('.claimable') as HTMLElement;
    const firstLockedItem = rewardsGrid?.querySelector('.locked') as HTMLElement;
    
    const targetItem = claimableItem || firstLockedItem;
    if (targetItem) {
        // Use a timeout to ensure the modal is visible before scrolling
        setTimeout(() => {
          targetItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    }
}

function closeModal() {
    if (!overlay) return;
    overlay.classList.add('hidden');
}

// --- INITIALIZATION ---
function initDailyRewards() {
    if (rewardsButton && overlay && closeButton && claimButton) {
        rewardsButton.addEventListener('click', openModal);
        closeButton.addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeModal();
            }
        });
        claimButton.addEventListener('click', handleClaim);
        window.addEventListener('resize', renderUI); // Re-render on resize for landscape/portrait changes

        updateNotificationDot(); // Check for notification on load
    } else {
        console.error('Daily rewards UI elements not found.');
    }
}

initDailyRewards();
