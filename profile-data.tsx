import firebase from "firebase/compat/app";
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

// --- TYPE DEFINITIONS ---
interface Title {
    id: string;
    name: string;
    description: string;
    unlock: {
        type: 'free' | 'level' | 'stat';
        value: number | keyof PlayerProfile['stats'];
        target?: number;
    };
}

export interface PlayerProfile {
  uid: string;
  displayName: string;
  avatarId: string; // Now stores an emoji
  level: number;
  xp: number;
  coins: number;
  coral: number;
  coralFragments: number; // For reef system
  unlockedTitles: string[]; // Stores title IDs
  equippedTitle: string; // Stores the equipped title ID
  stats: {
    totalCollected: number;
    totalSortedCorrect: number;
    bestScore: number;
    streakLoginDays: number;
    weeklyCollected: number;
    totalCoralContributed: number; // For reef system
  };
  upgrades: {
    capacity: { level: number };
    hook: { level: number };
  };
  customization: {
    boatColor: string;
    flagId: string;
    decalId: string; // Added decal
    trailId: string;
  };
  privacy: {
    showOnLeaderboard: boolean;
  };
  updatedAt: number;
}


// --- DATA ---
const PROFILE_STORAGE_PREFIX = 'cleanwater_quest_profile_';
const AVATAR_EMOJIS = ['😀', '🤖', '🐙', '🐬', '🐢', '🐡', '🦀', '🐳', '👩‍🚀', '🧑‍🔬'];
export const TITLES_DATA: Title[] = [
    { id: 'new_explorer', name: 'นักสำรวจมือใหม่', description: 'เริ่มต้นการเดินทางสู่ทะเลที่สะอาดขึ้น', unlock: { type: 'free', value: 0 } },
    { id: 'coin_collector', name: 'นักสะสมเหรียญ', description: 'ได้รับเหรียญเพิ่มขึ้น 5% จากทุกรอบ', unlock: { type: 'stat', value: 'totalCollected', target: 5000 } },
    { id: 'reef_builder', name: 'ผู้สร้างแนวปะการัง', description: 'มีโอกาส 10% ที่จะได้รับชิ้นส่วนปะการังสองเท่า', unlock: { type: 'stat', value: 'totalCoralContributed', target: 100 } },
    { id: 'eco_warrior', name: 'นักรบสิ่งแวดล้อม', description: 'ได้รับ XP เพิ่มขึ้น 10% จากการคัดแยกขยะ', unlock: { type: 'level', value: 5 } },
];

// --- DATA MANAGEMENT ---
export function getXpForLevel(level: number): number {
    if (level === 1) return 0;
    return Math.floor(500 * Math.pow(level - 1, 1.5));
}

function createDefaultProfile(user: firebase.User): PlayerProfile {
    return {
        uid: user.uid,
        displayName: user.displayName || "SeaHero",
        avatarId: AVATAR_EMOJIS[Math.floor(Math.random() * AVATAR_EMOJIS.length)],
        level: 1,
        xp: 0,
        coins: 3000,
        coral: 15,
        coralFragments: 10,
        unlockedTitles: ["new_explorer"],
        equippedTitle: "new_explorer",
        stats: {
            totalCollected: 0,
            totalSortedCorrect: 0,
            bestScore: 0,
            streakLoginDays: 1,
            weeklyCollected: 0,
            totalCoralContributed: 0,
        },
        upgrades: {
            capacity: { level: 1 },
            hook: { level: 1 }
        },
        customization: { 
            boatColor: "#34d399", 
            flagId: "flag_default", 
            decalId: "none",
            trailId: "none" 
        },
        privacy: { showOnLeaderboard: true },
        updatedAt: Date.now()
    };
}

function checkAndUnlockTitles(profile: PlayerProfile): { profile: PlayerProfile, newUnlocks: boolean } {
    let newUnlocks = false;
    TITLES_DATA.forEach(title => {
        if (!profile.unlockedTitles.includes(title.id)) {
            let conditionMet = false;
            switch(title.unlock.type) {
                case 'level':
                    if (profile.level >= (title.unlock.value as number)) {
                        conditionMet = true;
                    }
                    break;
                case 'stat':
                    const statKey = title.unlock.value as keyof PlayerProfile['stats'];
                    if (profile.stats[statKey] >= title.unlock.target!) {
                        conditionMet = true;
                    }
                    break;
            }
            if (conditionMet) {
                profile.unlockedTitles.push(title.id);
                newUnlocks = true;
            }
        }
    });
    return { profile, newUnlocks };
}

export function getPlayerProfile(user: firebase.User): PlayerProfile {
    const key = `${PROFILE_STORAGE_PREFIX}${user.uid}`;
    const saved = localStorage.getItem(key);
    if (saved) {
        let profile = JSON.parse(saved) as any; // Use 'any' for easier patching
        let needsSave = false;
        
        if (!profile.upgrades) {
            profile.upgrades = createDefaultProfile(user).upgrades;
            needsSave = true;
        }
        if (profile.coralFragments === undefined) {
            profile.coralFragments = 10;
            needsSave = true;
        }
        if (!profile.stats.totalCoralContributed) {
            profile.stats.totalCoralContributed = 0;
            needsSave = true;
        }
        if (profile.coins < 1000) {
            profile.coins = 3000;
            needsSave = true;
        }
        if (profile.coral < 10) {
            profile.coral = 15;
            needsSave = true;
        }
        // Patch for emoji avatars and titles
        if (!AVATAR_EMOJIS.includes(profile.avatarId)) {
            profile.avatarId = AVATAR_EMOJIS[Math.floor(Math.random() * AVATAR_EMOJIS.length)];
            needsSave = true;
        }
        if (profile.titles) {
            profile.unlockedTitles = profile.titles;
            delete profile.titles;
            needsSave = true;
        }
        if (!profile.unlockedTitles) {
            profile.unlockedTitles = ["new_explorer"];
            needsSave = true;
        }
        if (!profile.equippedTitle) {
            profile.equippedTitle = 'new_explorer';
            needsSave = true;
        }

        const unlockResult = checkAndUnlockTitles(profile);
        profile = unlockResult.profile;
        if (unlockResult.newUnlocks) {
            needsSave = true;
        }

        if(needsSave) {
            savePlayerProfile(profile);
        }

        // Fire-and-forget: sync from Firestore if it exists
        try {
            const db = firebase.firestore();
            db.collection('players').doc(user.uid).get().then(doc => {
                if (doc.exists) {
                    const cloud = doc.data() as any;
                    // Prefer cloud stats/level if newer
                    if (cloud?.updatedAt) {
                        localStorage.setItem(key, JSON.stringify({ ...profile, ...cloud, uid: user.uid }));
                        window.dispatchEvent(new CustomEvent('profile-updated'));
                    }
                } else {
                    // create cloud doc lazily
                    db.collection('players').doc(user.uid).set({ ...profile, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
                }
            });
        } catch {}

        return profile;
    }
    const newProfile = createDefaultProfile(user);
    savePlayerProfile(newProfile);
    return newProfile;
}

export function savePlayerProfile(profile: PlayerProfile) {
    profile.updatedAt = Date.now();
    const key = `${PROFILE_STORAGE_PREFIX}${profile.uid}`;
    localStorage.setItem(key, JSON.stringify(profile));
    // Firestore mirror (best effort)
    try {
        const db = firebase.firestore();
        db.collection('players').doc(profile.uid).set(
            { ...profile, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
            { merge: true }
        );
    } catch {}
}
