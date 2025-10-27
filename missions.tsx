// --- TYPE DEFINITIONS ---
interface Reward {
    coins?: number;
    xp?: number;
    coral?: number;
    coralFragments?: number;
    title?: string;
}

interface QuestTemplate {
    id: string;
    type: string;
    icon: string;
    description: (target: number) => string;
    target: () => number;
    rewards: Reward;
    fact: string;
}

interface ActiveQuest {
    templateId: string;
    target: number;
    progress: number;
    claimed: boolean;
}

interface ContractTemplate {
    id: string;
    icon: string;
    title: string;
    description: string;
    target: number;
    rewards: Reward;
    fact: string;
}

// FIX: Added 'target' property to align with ActiveQuest for consistent data handling.
interface ActiveContract {
    templateId: string;
    target: number;
    progress: number;
    claimed: boolean;
}

interface PlayerMissionProgress {
    daily: {
        lastReset: string;
        quests: ActiveQuest[];
        refreshesUsed: number;
    };
    weekly: {
        lastReset: string;
        contracts: ActiveContract[];
    };
}

// --- DATA DEFINITIONS ---
const STORAGE_KEY_MISSIONS = 'cleanwater_quest_missions';

const QUEST_ICONS: { [key: string]: string } = {
    sort: '♻️',
    collect: '🌊',
    score: '💪',
    fast: '⏱️',
    combo: '🎯',
    upgrade: '🚢',
    donate: '🪸',
    learn: '💬',
    restore: '🌱',
    play: '🏆'
};

const DAILY_QUEST_POOL: QuestTemplate[] = [
    { id: 'sort_20', type: 'sort', icon: QUEST_ICONS.sort, description: (t) => `คัดแยกให้ถูกต้อง ${t} ชิ้น`, target: () => 20, rewards: { xp: 150 }, fact: "การแยกขยะช่วยลดภาระหลุมฝังกลบ" },
    { id: 'collect_50', type: 'collect', icon: QUEST_ICONS.collect, description: (t) => `เก็บขยะรวม ${t} ชิ้น`, target: () => 50, rewards: { coins: 80 }, fact: "ขยะ 1 กก. ที่ไม่ลงทะเลช่วยชีวิตเต่าได้ 1 ตัว" },
    { id: 'score_500', type: 'score', icon: QUEST_ICONS.score, description: (t) => `ทำคะแนนให้ถึง ${t}`, target: () => 500, rewards: { xp: 100 }, fact: "ขยะพลาสติกใช้เวลา 450 ปีในการย่อยสลาย" },
    { id: 'fast_30', type: 'fast', icon: QUEST_ICONS.fast, description: (t) => `เก็บขยะ ${t} ชิ้นใน 60 วิ`, target: () => 30, rewards: { xp: 120 }, fact: "ขวดน้ำ 1 ใบใช้ซ้ำได้หลายร้อยครั้ง" },
    { id: 'combo_10', type: 'combo', icon: QUEST_ICONS.combo, description: (t) => `คัดแยกถูกต้องติดกัน ${t} ครั้ง`, target: () => 10, rewards: { xp: 200 }, fact: "การทำอย่างต่อเนื่องสร้างนิสัยที่ดี" },
    { id: 'upgrade_1', type: 'upgrade', icon: QUEST_ICONS.upgrade, description: () => `อัปเกรดระบบใดก็ได้ 1 ครั้ง`, target: () => 1, rewards: { coral: 3 }, fact: "เรือดี = เก็บขยะได้มากขึ้น!" },
    { id: 'donate_5', type: 'donate', icon: QUEST_ICONS.donate, description: (t) => `ส่งชิ้นส่วนปะการัง ${t} ชิ้น`, target: () => 5, rewards: { xp: 100 }, fact: "แนวปะการังคือบ้านของปลาและเต่าทะเล" },
    { id: 'learn_1', type: 'learn', icon: QUEST_ICONS.learn, description: () => `เปิดดูศูนย์ความรู้ 1 ครั้ง`, target: () => 1, rewards: { xp: 50 }, fact: "การรู้ทันสิ่งแวดล้อมคือจุดเริ่มต้น" },
    { id: 'restore_1', type: 'restore', icon: QUEST_ICONS.restore, description: () => `ทำภารกิจปะการังสำเร็จ`, target: () => 1, rewards: { coral: 5 }, fact: "ปะการัง 1 กอช่วยสัตว์น้ำกว่า 150 ชนิด" },
    { id: 'play_3', type: 'play', icon: QUEST_ICONS.play, description: (t) => `เล่นเกมให้ครบ ${t} รอบ`, target: () => 3, rewards: { xp: 300, coins: 150 }, fact: "ขยะทุกชิ้นที่คุณเก็บคือการช่วยโลกจริง ๆ" },
];

const WEEKLY_CONTRACT_POOL: ContractTemplate[] = [
    { id: 'weekly_donate_30', icon: '🪸', title: 'พันธะฟื้นฟูแนวปะการัง', description: 'บริจาคปะการังรวม 30 ชิ้นในสัปดาห์นี้', target: 30, rewards: { coral: 10, xp: 500, coins: 200 }, fact: "ทะเลกำลังกลับมามีชีวิตเพราะคุณ!" },
    { id: 'weekly_sort_200', icon: '♻️', title: 'นักแยกขยะมือโปร', description: 'คัดแยกถูกต้องรวม 200 ชิ้นในสัปดาห์', target: 200, rewards: { xp: 800, coins: 300 }, fact: "การคัดแยกของคุณช่วยโลกได้จริง!" },
    { id: 'weekly_collect_500', icon: '🐢', title: 'ผู้ช่วยชีวิตสัตว์น้ำ', description: 'เก็บขยะรวม 500 ชิ้น', target: 500, rewards: { xp: 1000, coins: 400 }, fact: "ขยะที่คุณเก็บคือชีวิตที่คุณช่วยไว้!" },
    { id: 'weekly_hero', icon: '🌍', title: 'ฮีโร่แห่งมหาสมุทร', description: 'ทำภารกิจรายวันครบ 7 วันติด', target: 7, rewards: { title: "ผู้พิทักษ์ทะเล", coral: 15 }, fact: "คุณคือแรงบันดาลใจให้โลกสะอาดขึ้น!" }
];

// --- DOM ELEMENTS ---
const missionsButton = document.querySelector('[data-menu="missions"]');
const missionsOverlay = document.getElementById('missions-overlay');
const missionsCloseBtn = document.getElementById('missions-close-btn');
const dailyTab = document.getElementById('daily-quests-tab');
const weeklyTab = document.getElementById('weekly-contracts-tab');
const dailyView = document.getElementById('daily-quests-view');
const weeklyView = document.getElementById('weekly-contracts-view');
const refreshBtn = document.getElementById('refresh-quests-btn') as HTMLButtonElement;
const resetTimerEl = document.getElementById('reset-timer');
// FIX: Add a variable to hold the timer interval ID to prevent memory leaks.
let timerIntervalId: number | null = null;


// --- STATE MANAGEMENT ---
function getTodaysDateString() {
    return new Date().toISOString().split('T')[0];
}

function getWeekId() {
    const now = new Date();
    const firstDay = new Date(now.setDate(now.getDate() - now.getDay()));
    return firstDay.toISOString().split('T')[0];
}

function getInitialProgress(): PlayerMissionProgress {
    return {
        daily: { lastReset: '', quests: [], refreshesUsed: 0 },
        weekly: { lastReset: '', contracts: [] }
    };
}

function getPlayerProgress(): PlayerMissionProgress {
    const saved = localStorage.getItem(STORAGE_KEY_MISSIONS);
    return saved ? JSON.parse(saved) : getInitialProgress();
}

function savePlayerProgress(progress: PlayerMissionProgress) {
    localStorage.setItem(STORAGE_KEY_MISSIONS, JSON.stringify(progress));
}


// --- CORE LOGIC ---
function generateNewDailyQuests(): ActiveQuest[] {
    const shuffled = [...DAILY_QUEST_POOL].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 3).map(template => ({
        templateId: template.id,
        target: template.target(),
        // For demonstration, quests start with random progress
        progress: Math.floor(Math.random() * (template.target() + 1)),
        claimed: false
    }));
}
function generateNewWeeklyContracts(): ActiveContract[] {
    const shuffled = [...WEEKLY_CONTRACT_POOL].sort(() => 0.5 - Math.random());
     return shuffled.slice(0, 3).map(template => ({
        templateId: template.id,
        // FIX: Added target to the active contract object to resolve 'undefined' issue.
        target: template.target,
        // For demonstration, contracts start with random progress
        progress: Math.floor(Math.random() * (template.target + 1)),
        claimed: false
    }));
}

function checkAndResetMissions() {
    const progress = getPlayerProgress();
    const today = getTodaysDateString();
    const week = getWeekId();
    let updated = false;

    if (progress.daily.lastReset !== today) {
        progress.daily.lastReset = today;
        progress.daily.quests = generateNewDailyQuests();
        progress.daily.refreshesUsed = 0;
        updated = true;
    }
    if (progress.weekly.lastReset !== week) {
        progress.weekly.lastReset = week;
        progress.weekly.contracts = generateNewWeeklyContracts();
        updated = true;
    }

    if (updated) {
        savePlayerProgress(progress);
    }
}

// --- UI RENDERING ---
function formatRewards(rewards: Reward): string {
    return Object.entries(rewards)
        .map(([key, value]) => {
            if (key === 'coins') return `💰 ${value}`;
            if (key === 'xp') return `🧭 ${value}`;
            if (key === 'coral') return `🌊 ${value}`;
            if (key === 'coralFragments') return `🐚 ${value}`;
            if (key === 'title') return `✨ "${value}"`;
            return '';
        }).join(', ');
}

function createQuestCard(quest: ActiveQuest, isWeekly: boolean = false) {
    const template = (isWeekly ? WEEKLY_CONTRACT_POOL.find(t => t.id === quest.templateId) : DAILY_QUEST_POOL.find(t => t.id === quest.templateId)) as QuestTemplate | ContractTemplate;
    if (!template) return '';

    const isComplete = quest.progress >= quest.target;
    const progressPercent = Math.min((quest.progress / quest.target) * 100, 100);

    let buttonText = 'รับรางวัล';
    let buttonClass = 'claimable';
    if (quest.claimed) {
        buttonText = 'รับแล้ว';
        buttonClass = 'claimed';
    } else if (!isComplete) {
        buttonText = 'ดำเนินการ';
        buttonClass = '';
    }
    
    const card = document.createElement('div');
    card.className = 'quest-card';
    if(isComplete && !quest.claimed) card.classList.add('completed');
    
    // Type assertion for weekly contracts
    const weeklyTemplate = isWeekly ? (template as ContractTemplate) : null;

    card.innerHTML = `
        <div class="quest-icon">${template.icon}</div>
        <div class="quest-title">${isWeekly ? weeklyTemplate!.title : (template as QuestTemplate).description(quest.target)}</div>
        ${isWeekly ? `<div class="quest-description">${weeklyTemplate!.description}</div>` : ''}
        <div class="quest-rewards">${formatRewards(template.rewards)}</div>
        <div class="quest-progress-container">
            <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${progressPercent}%"></div>
            </div>
            <span class="progress-text">${quest.progress}/${quest.target}</span>
        </div>
        <div class="quest-fact">${template.fact}</div>
        <button class="claim-quest-btn ${buttonClass}" ${!isComplete || quest.claimed ? 'disabled' : ''}>${buttonText}</button>
    `;

    card.querySelector('.claim-quest-btn')?.addEventListener('click', () => {
        if(isComplete && !quest.claimed){
            claimReward(quest, isWeekly);
        }
    });

    return card;
}


function renderMissions() {
    if (!dailyView || !weeklyView) return;
    
    const progress = getPlayerProgress();
    
    // Daily quests
    dailyView.innerHTML = '';
    progress.daily.quests.forEach(q => {
        const card = createQuestCard(q, false);
        if(card) dailyView.appendChild(card);
    });

    // Weekly contracts
    weeklyView.innerHTML = '';
     progress.weekly.contracts.forEach(c => {
        const card = createQuestCard(c as ActiveQuest, true); // Cast for compatibility
        if(card) weeklyView.appendChild(card);
    });

    // Footer
    refreshBtn.disabled = progress.daily.refreshesUsed >= 1;
    refreshBtn.textContent = `🔄 รีเฟรชภารกิจ (${1 - progress.daily.refreshesUsed}/1)`;
}

function updateResetTimer() {
    if (!resetTimerEl) return;
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const diff = midnight.getTime() - now.getTime();

    const hours = Math.floor(diff / (1000 * 60 * 60)).toString().padStart(2, '0');
    const minutes = Math.floor((diff / (1000 * 60)) % 60).toString().padStart(2, '0');
    const seconds = Math.floor((diff / 1000) % 60).toString().padStart(2, '0');
    
    resetTimerEl.textContent = `รีเซ็ตใน ${hours}:${minutes}:${seconds}`;
}

// --- EVENT HANDLERS ---
function openMissionsModal() {
    checkAndResetMissions();
    renderMissions();
    missionsOverlay?.classList.remove('hidden');
    
    // Clear any previous timer and start a new one
    if (timerIntervalId) clearInterval(timerIntervalId);
    updateResetTimer();
    timerIntervalId = window.setInterval(updateResetTimer, 1000);

    // FIX: Add a wrapper for landscape layout if it doesn't exist
    if (window.innerHeight < window.innerWidth && window.innerHeight <= 520) {
        if (!missionsOverlay?.querySelector('.missions-main-content')) {
            const mainContentWrapper = document.createElement('div');
            mainContentWrapper.className = 'missions-main-content';
            const content = document.getElementById('missions-content');
            const footer = document.getElementById('missions-footer');
            if (content && footer) {
                mainContentWrapper.appendChild(content);
                mainContentWrapper.appendChild(footer);
                document.getElementById('missions-modal')?.appendChild(mainContentWrapper);
            }
        }
    }
}

function closeMissionsModal() {
    missionsOverlay?.classList.add('hidden');
    // FIX: Clear the interval when the modal is closed to prevent memory leaks.
    if (timerIntervalId) clearInterval(timerIntervalId);
    timerIntervalId = null;
}

function switchTab(view: 'daily' | 'weekly') {
    if (view === 'daily') {
        dailyTab?.classList.add('active');
        weeklyTab?.classList.remove('active');
        dailyView?.classList.add('active');
        weeklyView?.classList.remove('active');
        refreshBtn.style.display = 'block';
    } else {
        dailyTab?.classList.remove('active');
        weeklyTab?.classList.add('active');
        dailyView?.classList.remove('active');
        weeklyView?.classList.add('active');
        refreshBtn.style.display = 'none';
    }
}

function claimReward(quest: ActiveQuest, isWeekly: boolean) {
    const progress = getPlayerProgress();
    const questList = isWeekly ? progress.weekly.contracts : progress.daily.quests;
    const questToUpdate = questList.find(q => q.templateId === quest.templateId);
    
    if (questToUpdate && !questToUpdate.claimed) {
        questToUpdate.claimed = true;
        console.log(`Claimed reward for ${questToUpdate.templateId}`);
        savePlayerProgress(progress);
        renderMissions(); // Re-render to show the claimed state
    }
}

function handleRefresh() {
    const progress = getPlayerProgress();
    if(progress.daily.refreshesUsed < 1){
        progress.daily.refreshesUsed++;
        progress.daily.quests = generateNewDailyQuests();
        savePlayerProgress(progress);
        renderMissions();
    }
}

// --- INITIALIZATION ---
function initMissions() {
    if (!missionsButton || !missionsOverlay || !missionsCloseBtn || !dailyTab || !weeklyTab) {
        console.error("Missions UI elements not found.");
        return;
    }

    missionsButton.addEventListener('click', openMissionsModal);
    missionsCloseBtn.addEventListener('click', closeMissionsModal);
    missionsOverlay.addEventListener('click', (e) => {
        if (e.target === missionsOverlay) closeMissionsModal();
    });

    dailyTab.addEventListener('click', () => switchTab('daily'));
    weeklyTab.addEventListener('click', () => switchTab('weekly'));
    refreshBtn.addEventListener('click', handleRefresh);

    // Set initial view
    switchTab('daily');
}

initMissions();
