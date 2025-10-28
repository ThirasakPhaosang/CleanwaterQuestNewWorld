import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, FC, DragEvent, TouchEvent as ReactTouchEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { gsap } from 'gsap';
import audio from './audio';
// FIX: Switched to Firebase v8 compatibility imports.
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { getPlayerProfile, savePlayerProfile, PlayerProfile, getXpForLevel } from './profile-data';
import { recordGameSession } from './firestore';
// Helpers to keep strings safe in non-UTF8 files
const ud = (s: string) => decodeURIComponent(s);
const cp = (n: number) => String.fromCodePoint(n);
// Haptic helper for mobile; safe no-op on desktop
const vibrate = (ms: number) => {
  try {
    if (typeof navigator !== 'undefined' && (navigator as any).vibrate) {
      (navigator as any).vibrate(ms);
    }
  } catch {}
};

// --- Firebase Configuration ---
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
type GamePhase = 'loading' | 'collection' | 'sorting' | 'results';
type TrashType = 'recyclable' | 'organic' | 'general' | 'hazardous';
type TrashId = 'bottle' | 'can' | 'newspaper' | 'apple' | 'shoe' | 'cup' | 'battery' | 'banana' | 'bag' | 'boot' | 'champagne' | 'treasure' | 'sunken_treasure';
interface TrashData { name: string; icon: string; type: TrashType; points: number; weight: number; ecoFact: string; }
interface CollectedTrash { id: TrashId; uid: number; name: string; icon: string; type: TrashType; }
interface GameObject {
  id: string | TrashId;
  uid: number;
  el: HTMLDivElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vRot: number;
  caught: boolean;
  type: 'trash' | 'fish' | 'bubble';
  baseY?: number; 
  sway?: number; 
  targetX?: number;
}

// --- GAME CONSTANTS ---
const WORLD_WIDTH = 4000;
const WATER_LEVEL_VH = 35;
const HOOK_MAX_LENGTH_OFFSET = 50;
// Slow hook a bit for better control on mobile
const BASE_HOOK_SPEED = 420;
const TRASH_DATA: Record<TrashId, TrashData> = {
  bottle: { name: ud('item_bottle=%E0%B8%82%E0%B8%A7%E0%B8%94%E0%B8%9E%E0%B8%A5%E0%B8%B2%E0%B8%AA%E0%B8%95%E0%B8%B4%E0%B8%81'.split('=')[1]), icon: cp(0x1F9F4), type: 'recyclable', points: 10, weight: 1.2, ecoFact: ud('fact_bottle=%E0%B8%82%E0%B8%A7%E0%B8%94%E0%B8%9E%E0%B8%A5%E0%B8%B2%E0%B8%AA%E0%B8%95%E0%B8%B4%E0%B8%81%201%20%E0%B8%82%E0%B8%A7%E0%B8%94%E0%B9%83%E0%B8%8A%E0%B9%89%E0%B9%80%E0%B8%A7%E0%B8%A5%E0%B8%B2%E0%B8%A2%E0%B9%88%E0%B8%AD%E0%B8%A2%E0%B8%AA%E0%B8%A5%E0%B8%B2%E0%B8%A2%E0%B8%A3%E0%B8%B2%E0%B8%A7%20450%20%E0%B8%9B%E0%B8%B5'.split('=')[1]) },
  can: { name: ud('item_can=%E0%B8%81%E0%B8%A3%E0%B8%B0%E0%B8%9B%E0%B9%8B%E0%B8%AD%E0%B8%87%E0%B8%AD%E0%B8%A5%E0%B8%B9%E0%B8%A1%E0%B8%B4%E0%B9%80%E0%B8%99%E0%B8%B5%E0%B8%A2%E0%B8%A1'.split('=')[1]), icon: cp(0x1F96B), type: 'recyclable', points: 15, weight: 1.5, ecoFact: ud('fact_can=%E0%B8%A3%E0%B8%B5%E0%B9%84%E0%B8%8B%E0%B9%80%E0%B8%84%E0%B8%B4%E0%B8%A5%E0%B8%AD%E0%B8%A5%E0%B8%B9%E0%B8%A1%E0%B8%B4%E0%B9%80%E0%B8%99%E0%B8%B5%E0%B8%A2%E0%B8%A1%E0%B8%8A%E0%B9%88%E0%B8%A7%E0%B8%A2%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B8%AB%E0%B8%A2%E0%B8%B1%E0%B8%94%E0%B8%9E%E0%B8%A5%E0%B8%B1%E0%B8%87%E0%B8%87%E0%B8%B2%E0%B8%99%E0%B9%84%E0%B8%94%E0%B9%89%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B8%A1%E0%B8%B2%E0%B8%93%2095%25'.split('=')[1]) },
  newspaper: { name: ud('item_newspaper=%E0%B8%AB%E0%B8%99%E0%B8%B1%E0%B8%87%E0%B8%AA%E0%B8%B7%E0%B8%AD%E0%B8%9E%E0%B8%B4%E0%B8%A1%E0%B8%9E%E0%B9%8C'.split('=')[1]), icon: cp(0x1F4F0), type: 'recyclable', points: 5, weight: 1.1, ecoFact: ud('fact_paper=%E0%B8%81%E0%B8%A3%E0%B8%B0%E0%B8%94%E0%B8%B2%E0%B8%A9%E0%B8%A3%E0%B8%B5%E0%B9%84%E0%B8%8B%E0%B9%80%E0%B8%84%E0%B8%B4%E0%B8%A5%E0%B9%84%E0%B8%94%E0%B9%89%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B8%A1%E0%B8%B2%E0%B8%93%205%E2%80%937%20%E0%B8%84%E0%B8%A3%E0%B8%B1%E0%B9%89%E0%B8%87%E0%B8%81%E0%B9%88%E0%B8%AD%E0%B8%99%E0%B9%80%E0%B8%AA%E0%B9%89%E0%B8%99%E0%B9%83%E0%B8%A2%E0%B8%AA%E0%B8%B1%E0%B9%89%E0%B8%99%E0%B9%80%E0%B8%81%E0%B8%B4%E0%B8%99%E0%B9%84%E0%B8%9B'.split('=')[1]) },
  apple: { name: ud('item_apple=%E0%B9%80%E0%B8%A8%E0%B8%A9%E0%B9%81%E0%B8%AD%E0%B8%9B%E0%B9%80%E0%B8%9B%E0%B8%B4%E0%B8%A5'.split('=')[1]), icon: cp(0x1F34E), type: 'organic', points: 5, weight: 1.0, ecoFact: ud('fact_food=%E0%B9%80%E0%B8%A8%E0%B8%A9%E0%B8%AD%E0%B8%B2%E0%B8%AB%E0%B8%B2%E0%B8%A3%E0%B8%97%E0%B8%B3%E0%B8%9B%E0%B8%B8%E0%B9%8B%E0%B8%A2%E0%B9%84%E0%B8%94%E0%B9%89%20%E0%B8%A5%E0%B8%94%E0%B8%81%E0%B9%8A%E0%B8%B2%E0%B8%8B%E0%B8%A1%E0%B8%B5%E0%B9%80%E0%B8%97%E0%B8%99%E0%B8%88%E0%B8%B2%E0%B8%81%E0%B8%AB%E0%B8%A5%E0%B8%B8%E0%B8%A1%E0%B8%9D%E0%B8%B1%E0%B8%87%E0%B8%81%E0%B8%A5%E0%B8%9A'.split('=')[1]) },
  shoe: { name: ud('item_shoe=%E0%B8%A3%E0%B8%AD%E0%B8%87%E0%B9%80%E0%B8%97%E0%B9%89%E0%B8%B2%E0%B9%80%E0%B8%81%E0%B9%88%E0%B8%B2'.split('=')[1]), icon: cp(0x1F45F), type: 'general', points: 2, weight: 2.0, ecoFact: ud('fact_shoe=%E0%B8%A3%E0%B8%AD%E0%B8%87%E0%B9%80%E0%B8%97%E0%B9%89%E0%B8%B2%E0%B8%9A%E0%B8%B2%E0%B8%87%E0%B8%8A%E0%B8%99%E0%B8%B4%E0%B8%94%E0%B8%A3%E0%B8%B5%E0%B9%84%E0%B8%8B%E0%B9%80%E0%B8%84%E0%B8%B4%E0%B8%A5%E0%B9%84%E0%B8%94%E0%B9%89%E0%B8%A2%E0%B8%B2%E0%B8%81%20%E0%B8%84%E0%B8%A7%E0%B8%A3%E0%B9%83%E0%B8%8A%E0%B9%89%E0%B8%99%E0%B8%B2%E0%B8%99%E0%B9%81%E0%B8%A5%E0%B8%B0%E0%B8%8B%E0%B9%88%E0%B8%AD%E0%B8%A1%E0%B9%81%E0%B8%8B%E0%B8%A1'.split('=')[1]) },
  cup: { name: ud('item_cup=%E0%B9%81%E0%B8%81%E0%B9%89%E0%B8%A7%E0%B8%9E%E0%B8%A5%E0%B8%B2%E0%B8%AA%E0%B8%95%E0%B8%B4%E0%B8%81'.split('=')[1]), icon: cp(0x1F964), type: 'general', points: 8, weight: 1.3, ecoFact: ud('fact_cup=%E0%B9%83%E0%B8%8A%E0%B9%89%E0%B9%81%E0%B8%81%E0%B9%89%E0%B8%A7%E0%B8%AA%E0%B9%88%E0%B8%A7%E0%B8%99%E0%B8%95%E0%B8%B1%E0%B8%A7%E0%B8%8A%E0%B9%88%E0%B8%A7%E0%B8%A2%E0%B8%A5%E0%B8%94%E0%B8%9E%E0%B8%A5%E0%B8%B2%E0%B8%AA%E0%B8%95%E0%B8%B4%E0%B8%81%E0%B9%83%E0%B8%8A%E0%B9%89%E0%B8%84%E0%B8%A3%E0%B8%B1%E0%B9%89%E0%B8%87%E0%B9%80%E0%B8%94%E0%B8%B5%E0%B8%A2%E0%B8%A7%E0%B8%97%E0%B8%B4%E0%B9%89%E0%B8%87'.split('=')[1]) },
  battery: { name: ud('item_battery=%E0%B9%81%E0%B8%9A%E0%B8%95%E0%B9%80%E0%B8%95%E0%B8%AD%E0%B8%A3%E0%B8%B5%E0%B9%88'.split('=')[1]), icon: cp(0x1F50B), type: 'hazardous', points: 25, weight: 2.5, ecoFact: ud('fact_battery=%E0%B9%81%E0%B8%9A%E0%B8%95%E0%B9%80%E0%B8%95%E0%B8%AD%E0%B8%A3%E0%B8%B5%E0%B9%88%E0%B8%A1%E0%B8%B5%E0%B8%AA%E0%B8%B2%E0%B8%A3%E0%B8%9E%E0%B8%B4%E0%B8%A9%20%E0%B8%95%E0%B9%89%E0%B8%AD%E0%B8%87%E0%B8%97%E0%B8%B4%E0%B9%89%E0%B8%87%E0%B8%88%E0%B8%B8%E0%B8%94%E0%B8%A3%E0%B8%B1%E0%B8%9A%E0%B8%82%E0%B8%A2%E0%B8%B0%E0%B8%AD%E0%B8%B1%E0%B8%99%E0%B8%95%E0%B8%A3%E0%B8%B2%E0%B8%A2%E0%B9%80%E0%B8%97%E0%B9%88%E0%B8%B2%E0%B8%99%E0%B8%B1%E0%B9%89%E0%B8%99'.split('=')[1]) },
  banana: { name: ud('item_banana=%E0%B9%80%E0%B8%9B%E0%B8%A5%E0%B8%B7%E0%B8%AD%E0%B8%81%E0%B8%81%E0%B8%A5%E0%B9%89%E0%B8%A7%E0%B8%A2'.split('=')[1]), icon: cp(0x1F34C), type: 'organic', points: 4, weight: 1.0, ecoFact: ud('fact_banana=%E0%B9%80%E0%B8%9B%E0%B8%A5%E0%B8%B7%E0%B8%AD%E0%B8%81%E0%B8%9C%E0%B8%A5%E0%B9%84%E0%B8%A1%E0%B9%89%E0%B8%A2%E0%B9%88%E0%B8%AD%E0%B8%A2%E0%B8%AA%E0%B8%A5%E0%B8%B2%E0%B8%A2%E0%B9%84%E0%B8%94%E0%B9%89%20%E0%B9%80%E0%B8%AB%E0%B8%A1%E0%B8%B2%E0%B8%B0%E0%B8%81%E0%B8%B1%E0%B8%9A%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%97%E0%B8%B3%E0%B8%9B%E0%B8%B8%E0%B9%8B%E0%B8%A2'.split('=')[1]) },
  bag: { name: ud('item_bag=%E0%B8%96%E0%B8%B8%E0%B8%87%E0%B8%9E%E0%B8%A5%E0%B8%B2%E0%B8%AA%E0%B8%95%E0%B8%B4%E0%B8%81'.split('=')[1]), icon: cp(0x1F6CD), type: 'general', points: 7, weight: 1.2, ecoFact: ud('fact_bag=%E0%B9%83%E0%B8%8A%E0%B9%89%E0%B8%96%E0%B8%B8%E0%B8%87%E0%B8%9C%E0%B9%89%E0%B8%B2%E0%B9%81%E0%B8%97%E0%B8%99%E0%B9%80%E0%B8%9E%E0%B8%B7%E0%B9%88%E0%B8%AD%E0%B8%A5%E0%B8%94%E0%B8%82%E0%B8%A2%E0%B8%B0%E0%B8%9E%E0%B8%A5%E0%B8%B2%E0%B8%AA%E0%B8%95%E0%B8%B4%E0%B8%81%E0%B9%83%E0%B8%99%E0%B8%97%E0%B8%B0%E0%B9%80%E0%B8%A5'.split('=')[1]) },
  boot: { name: ud('item_boot=%E0%B8%A3%E0%B8%AD%E0%B8%87%E0%B9%80%E0%B8%97%E0%B9%89%E0%B8%B2%E0%B8%9A%E0%B8%B9%E0%B8%97'.split('=')[1]), icon: cp(0x1F97E), type: 'general', points: 3, weight: 2.2, ecoFact: ud('fact_boot=%E0%B8%A3%E0%B8%AD%E0%B8%87%E0%B9%80%E0%B8%97%E0%B9%89%E0%B8%B2%E0%B8%9A%E0%B8%B9%E0%B8%97%E0%B8%A1%E0%B8%B1%E0%B8%81%E0%B8%97%E0%B8%B3%E0%B8%88%E0%B8%B2%E0%B8%81%E0%B8%A2%E0%B8%B2%E0%B8%87%2F%E0%B8%AB%E0%B8%99%E0%B8%B1%E0%B8%87%20%E0%B8%A2%E0%B9%88%E0%B8%AD%E0%B8%A2%E0%B8%AA%E0%B8%A5%E0%B8%B2%E0%B8%A2%E0%B8%A2%E0%B8%B2%E0%B8%81'.split('=')[1]) },
  champagne: { name: ud('item_champagne=%E0%B8%82%E0%B8%A7%E0%B8%94%E0%B9%81%E0%B8%81%E0%B9%89%E0%B8%A7'.split('=')[1]), icon: cp(0x1F37E), type: 'recyclable', points: 12, weight: 1.8, ecoFact: ud('fact_glass=%E0%B9%81%E0%B8%81%E0%B9%89%E0%B8%A7%E0%B8%A3%E0%B8%B5%E0%B9%84%E0%B8%8B%E0%B9%80%E0%B8%84%E0%B8%B4%E0%B8%A5%E0%B9%84%E0%B8%94%E0%B9%89%20100%25%20%E0%B9%82%E0%B8%94%E0%B8%A2%E0%B9%84%E0%B8%A1%E0%B9%88%E0%B8%AA%E0%B8%B9%E0%B8%8D%E0%B9%80%E0%B8%AA%E0%B8%B5%E0%B8%A2%E0%B8%84%E0%B8%B8%E0%B8%93%E0%B8%A0%E0%B8%B2%E0%B8%9E'.split('=')[1]) },
  treasure: { name: ud('item_treasure=%E0%B8%AB%E0%B8%B5%E0%B8%9A%E0%B8%AA%E0%B8%A1%E0%B8%9A%E0%B8%B1%E0%B8%95%E0%B8%B4'.split('=')[1]), icon: cp(0x1F4B0), type: 'recyclable', points: 500, weight: 3.0, ecoFact: ud('fact_treasure=%E0%B8%9E%E0%B8%9A%E0%B8%AA%E0%B8%A1%E0%B8%9A%E0%B8%B1%E0%B8%95%E0%B8%B4%E0%B9%83%E0%B8%95%E0%B9%89%E0%B8%97%E0%B8%B0%E0%B9%80%E0%B8%A5%20%E0%B8%84%E0%B8%A7%E0%B8%A3%E0%B9%80%E0%B8%99%E0%B9%89%E0%B8%99%E0%B8%99%E0%B8%B3%E0%B9%84%E0%B8%9B%E0%B8%AA%E0%B9%88%E0%B8%98%E0%B8%B2%E0%B8%99%E0%B8%B5'.split('=')[1]) },
  sunken_treasure: { name: ud('item_sunken=%E0%B8%AA%E0%B8%A1%E0%B8%9A%E0%B8%B1%E0%B8%95%E0%B8%B4%E0%B9%83%E0%B8%95%E0%B9%89%E0%B8%97%E0%B8%B0%E0%B9%80%E0%B8%A5'.split('=')[1]), icon: cp(0x1F48E), type: 'recyclable', points: 1000, weight: 5.0, ecoFact: ud('fact_sunken=%E0%B8%AA%E0%B8%A1%E0%B8%9A%E0%B8%B1%E0%B8%95%E0%B8%B4%E0%B9%83%E0%B8%95%E0%B9%89%E0%B8%97%E0%B8%B0%E0%B9%80%E0%B8%A5%E0%B8%9A%E0%B8%AD%E0%B8%81%E0%B9%80%E0%B8%A3%E0%B8%B2%E0%B9%80%E0%B8%96%E0%B8%B4%E0%B8%99%E0%B8%81%E0%B8%B1%E0%B8%9A%E0%B8%9E%E0%B8%A7%E0%B8%81%E0%B9%80%E0%B8%AB%E0%B8%A5%E0%B9%88%E0%B8%B2'.split('=')[1]) },
};
const DAY_CYCLE_DURATION_S = 240;

// Start capacity increased to 10 items as requested
const getCapacityForLevel = (level: number) => 10 + 3 * (level - 1);
const getHookSpeedMultiplier = (level: number) => 1 + (level - 1) * 0.15;


// --- React App ---
const Game: FC = () => {
    const [phase, setPhase] = useState<GamePhase>('loading');
    const [profile, setProfile] = useState<PlayerProfile | null>(null);
    const [collectedForSorting, setCollectedForSorting] = useState<CollectedTrash[]>([]);
    const [gameStats, setGameStats] = useState({ score: 0, collected: 0, sortedCorrectly: 0, incorrect: 0 });
    const [liveScore, setLiveScore] = useState(0);
    const [gameGains, setGameGains] = useState({ xp: 0, coins: 0, coralFragments: 0 });
    const [showResults, setShowResults] = useState(false);

    useEffect(() => {
        // FIX: Switched to Firebase v8 compatibility auth state change handler.
        const unsubscribe = auth.onAuthStateChanged(user => {
            if (user) {
                const playerProfile = getPlayerProfile(user);
                setProfile(playerProfile);
                setTimeout(() => setPhase('collection'), 500);
            } else {
                window.location.href = 'index.html';
            }
        });
        return () => unsubscribe();
    }, []);

    // Audio: start background music for game after first gesture
    useEffect(() => {
        const startAudio = async () => { try { await audio.init(); audio.setVolume('music', 0.5); await audio.startMusic('game'); } catch {} };
        const handler = () => { startAudio(); window.removeEventListener('pointerdown', handler as any); };
        window.addEventListener('pointerdown', handler as any, { once: true } as any);
        return () => { window.removeEventListener('pointerdown', handler as any); };
    }, []);

    const handleCollectionComplete = useCallback((collected: CollectedTrash[]) => {
        // Only transition if we are in the collection phase. This prevents the "bounce back" bug.
        setPhase(currentPhase => {
            if (currentPhase === 'collection') {
                setCollectedForSorting(collected);
                return 'sorting';
            }
            return currentPhase;
        });
    }, []);

    const handleSortingComplete = async (finalScore: number, sortedCorrectly: number) => {
        if (!profile) return;
        
        const incorrect = collectedForSorting.length - sortedCorrectly;
        const finalStats = { score: finalScore, collected: collectedForSorting.length, sortedCorrectly, incorrect };
        setGameStats(finalStats);

        const xpGained = finalScore + (sortedCorrectly * 10);
        const coinsGained = Math.floor(finalScore / 10);
        const coralFragmentsGained = Math.floor(sortedCorrectly / 5);

        setGameGains({ xp: xpGained, coins: coinsGained, coralFragments: coralFragmentsGained });

        const newProfile = { ...profile };
        newProfile.xp += xpGained;
        newProfile.coins += coinsGained;
        newProfile.coralFragments += coralFragmentsGained;
        newProfile.stats.totalCollected += finalStats.collected;
        newProfile.stats.totalSortedCorrect += finalStats.sortedCorrectly;
        if (finalScore > newProfile.stats.bestScore) newProfile.stats.bestScore = finalScore;

        let nextLevelXp = getXpForLevel(newProfile.level + 1);
        while (newProfile.xp >= nextLevelXp) {
            newProfile.level++;
            newProfile.coins += 100 * newProfile.level;
            newProfile.coral += 5;
            nextLevelXp = getXpForLevel(newProfile.level + 1);
        }
        
        savePlayerProfile(newProfile);
        try {
            await recordGameSession(newProfile.uid, {
                score: finalScore,
                collected: finalStats.collected,
                sortedCorrect: finalStats.sortedCorrectly,
                incorrect: finalStats.incorrect,
                xpGained,
                coinsGained,
                coralFragmentsGained,
                items: collectedForSorting.map(t => ({ id: t.id, type: t.type }))
            });
        } catch {}
        setProfile(newProfile);
        setPhase('results');
        audio.sfx.result();
        setTimeout(() => setShowResults(true), 100);
    };
    
    if (phase === 'loading' || !profile) {
        return <div className="loading-screen">{ud('loading=%E0%B8%81%E0%B8%B3%E0%B8%A5%E0%B8%B1%E0%B8%87%E0%B9%82%E0%B8%AB%E0%B8%A5%E0%B8%94...'.split('=')[1])}</div>;
    }

    const mainClasses = phase === 'sorting' ? 'is-sorting' : '';

    return (
        <main className={mainClasses}>
            <CollectionGame 
                profile={profile} 
                onCollectionComplete={handleCollectionComplete} 
                isPaused={phase !== 'collection'} 
                onScore={(pts)=> setLiveScore(prev=>prev + pts)} 
            />
            {phase === 'sorting' && (
                <div className="sorting-overlay">
                    <SortingGame 
                        collected={collectedForSorting} 
                        onComplete={handleSortingComplete} 
                    />
                </div>
            )}
            {phase === 'results' && (
                <ResultsScreen 
                    stats={gameStats} 
                    gains={gameGains} 
                    isVisible={showResults} 
                />
            )}
        </main>
    );
};

// --- Sorting Tutorial Component ---
const SortingTutorial: FC<{ onStart: () => void }> = ({ onStart }) => {
    const bins = [
        { name: ud('bin_recycle=%E0%B8%82%E0%B8%A2%E0%B8%B0%E0%B8%A3%E0%B8%B5%E0%B9%84%E0%B8%8B%E0%B9%80%E0%B8%84%E0%B8%B4%E0%B8%A5'.split('=')[1]), icon: cp(0x267B), desc: ud('desc_recycle=%E0%B8%9E%E0%B8%A5%E0%B8%B2%E0%B8%AA%E0%B8%95%E0%B8%B4%E0%B8%81%20%E0%B9%81%E0%B8%81%E0%B9%89%E0%B8%A7%20%E0%B8%81%E0%B8%A3%E0%B8%B0%E0%B8%94%E0%B8%B2%E0%B8%A9%20%E0%B9%82%E0%B8%A5%E0%B8%AB%E0%B8%B0'.split('=')[1]) },
        { name: ud('bin_organic=%E0%B8%82%E0%B8%A2%E0%B8%B0%E0%B9%80%E0%B8%9B%E0%B8%B5%E0%B8%A2%E0%B8%81'.split('=')[1]), icon: cp(0x1F33F), desc: ud('desc_organic=%E0%B9%80%E0%B8%A8%E0%B8%A9%E0%B8%AD%E0%B8%B2%E0%B8%AB%E0%B8%B2%E0%B8%A3%20%E0%B9%80%E0%B8%9B%E0%B8%A5%E0%B8%B7%E0%B8%AD%E0%B8%81%E0%B8%9C%E0%B8%A5%E0%B9%84%E0%B8%A1%E0%B9%89%20%E0%B9%83%E0%B8%9A%E0%B9%84%E0%B8%A1%E0%B9%89'.split('=')[1]) },
        { name: ud('bin_general=%E0%B8%82%E0%B8%A2%E0%B8%B0%E0%B8%97%E0%B8%B1%E0%B9%88%E0%B8%A7%E0%B9%84%E0%B8%9B'.split('=')[1]), icon: cp(0x1F5D1), desc: ud('desc_general=%E0%B9%82%E0%B8%9F%E0%B8%A1%20%E0%B9%80%E0%B8%A8%E0%B8%A9%E0%B8%9C%E0%B9%89%E0%B8%B2%20%E0%B8%82%E0%B8%AD%E0%B8%87%E0%B9%81%E0%B8%95%E0%B8%81%E0%B8%AB%E0%B8%B1%E0%B8%81'.split('=')[1]) },
        { name: ud('bin_hazard=%E0%B8%82%E0%B8%A2%E0%B8%B0%E0%B8%AD%E0%B8%B1%E0%B8%99%E0%B8%95%E0%B8%A3%E0%B8%B2%E0%B8%A2'.split('=')[1]), icon: cp(0x2623), desc: ud('desc_hazard=%E0%B9%81%E0%B8%9A%E0%B8%95%E0%B9%80%E0%B8%95%E0%B8%AD%E0%B8%A3%E0%B8%B5%E0%B9%88%20%E0%B8%AA%E0%B9%80%E0%B8%9B%E0%B8%A3%E0%B8%A2%E0%B9%8C%20%E0%B8%AB%E0%B8%A5%E0%B8%AD%E0%B8%94%E0%B9%84%E0%B8%9F'.split('=')[1]) },
    ];

    return (
        <div className="sorting-tutorial-overlay">
            <div className="tutorial-content">
                <h2>{ud('tut_title=%E0%B8%A1%E0%B8%B2%E0%B9%80%E0%B8%A3%E0%B8%B4%E0%B9%88%E0%B8%A1%E0%B9%81%E0%B8%A2%E0%B8%81%E0%B8%82%E0%B8%A2%E0%B8%B0%E0%B8%81%E0%B8%B1%E0%B8%99!'.split('=')[1])}</h2>
                <p>{ud('tut_para=%E0%B8%A5%E0%B8%B2%E0%B8%81%E0%B9%84%E0%B8%AD%E0%B8%84%E0%B8%AD%E0%B8%99%E0%B8%82%E0%B8%A2%E0%B8%B0%E0%B9%84%E0%B8%9B%E0%B8%A2%E0%B8%B1%E0%B8%87%E0%B8%96%E0%B8%B1%E0%B8%87%E0%B8%97%E0%B8%B5%E0%B9%88%E0%B8%96%E0%B8%B9%E0%B8%81%E0%B8%95%E0%B9%89%E0%B8%AD%E0%B8%87%E0%B8%95%E0%B8%B2%E0%B8%A1%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B9%80%E0%B8%A0%E0%B8%97%20%E0%B9%80%E0%B8%9E%E0%B8%B7%E0%B9%88%E0%B8%AD%E0%B9%80%E0%B8%81%E0%B9%87%E0%B8%9A%E0%B8%84%E0%B8%B0%E0%B9%81%E0%B8%99%E0%B8%99%E0%B9%83%E0%B8%AB%E0%B9%89%E0%B9%84%E0%B8%94%E0%B9%89%E0%B8%A1%E0%B8%B2%E0%B8%81%E0%B8%97%E0%B8%B5%E0%B9%88%E0%B8%AA%E0%B8%B8%E0%B8%94!'.split('=')[1])}</p>
                <div className="tutorial-bins">
                    {bins.map(bin => (
                        <div key={bin.name} className="tutorial-bin-info">
                            <h3><span>{bin.icon}</span> {bin.name}</h3>
                            <p>{bin.desc}</p>
                        </div>
                    ))}
                </div>
                <button onClick={onStart} className="tutorial-start-btn">{ud('tut_start=%E0%B9%80%E0%B8%A3%E0%B8%B4%E0%B9%88%E0%B8%A1%E0%B9%81%E0%B8%A2%E0%B8%81%E0%B8%82%E0%B8%A2%E0%B8%B0'.split('=')[1])}</button>
            </div>
        </div>
    );
};

// --- Sorting Phase ---
const SortingGame: FC<{ collected: CollectedTrash[], onComplete: (score: number, sortedCorrectly: number) => void }> = ({ collected, onComplete }) => {
    const [items, setItems] = useState<CollectedTrash[]>([]);
    const [score, setScore] = useState(0);
    const [sortedCorrectly, setSortedCorrectly] = useState(0);
    const [feedback, setFeedback] = useState<{ type: 'correct' | 'incorrect'; message: string; id: number } | null>(null);
    const isCompletingRef = useRef(false);
    
    // Drag state for both mouse and touch
    const [draggedItem, setDraggedItem] = useState<CollectedTrash | null>(null);
    const [activeBin, setActiveBin] = useState<TrashType | null>(null);
    
    // State specifically for touch drag
    const ghostRef = useRef<HTMLDivElement | null>(null);
    const originalItemRef = useRef<HTMLDivElement | null>(null);
    
    const [isTutorialVisible, setTutorialVisible] = useState(!sessionStorage.getItem('sortingTutorialSeen'));

    const ecoFact = useMemo(() => {
        const allFacts = Object.values(TRASH_DATA).map(d => d.ecoFact);
        return allFacts[Math.floor(Math.random() * allFacts.length)];
    }, []);

    useEffect(() => {
        setItems([...collected]);
    }, [collected]);
    
    // This is a simple effect to handle the edge case where no trash was collected.
    useEffect(() => {
        if (collected.length === 0) {
            onComplete(0, 0);
        }
    }, [collected.length, onComplete]);


    const handleSort = (itemToSort: CollectedTrash, binType: TrashType) => {
        // Prevent sorting if feedback is active or completion has already started
        if (feedback || isCompletingRef.current) return;
        
        const correctType = itemToSort.type;
        const itemData = TRASH_DATA[itemToSort.id];
        let newScore = score;
        let finalSortedCorrectly = sortedCorrectly;
        
        if (binType === correctType) {
            try { audio.sfx.correct(); } catch {}
            // softer feedback: keep visual only (no beep)
            newScore += (itemData?.points || 5) * 1.5; // 50% bonus
            finalSortedCorrectly = sortedCorrectly + 1;
            setSortedCorrectly(finalSortedCorrectly);
            setFeedback({ type: 'correct', message: ud('correct=%E0%B8%96%E0%B8%B9%E0%B8%81%E0%B8%95%E0%B9%89%E0%B8%AD%E0%B8%87!'.split('=')[1]), id: Date.now() });
        } else {
            // no harsh sound on wrong either
            newScore -= (itemData?.points || 5) * 0.25; // 25% penalty
            const correctBinName = bins.find(b => b.type === correctType)?.name || ud('right_bin=%E0%B8%96%E0%B8%B1%E0%B8%87%E0%B8%97%E0%B8%B5%E0%B9%88%E0%B8%96%E0%B8%B9%E0%B8%81%E0%B8%95%E0%B9%89%E0%B8%AD%E0%B8%87'.split('=')[1]);
            setFeedback({ type: 'incorrect', message: ud('should_put=%E0%B8%84%E0%B8%A7%E0%B8%A3%E0%B9%83%E0%B8%AA%E0%B9%88%E0%B8%A5%E0%B8%87%E0%B9%83%E0%B8%99%20%22__BIN__%22'.split('=')[1]).replace('__BIN__', correctBinName), id: Date.now() });
        }
    
        setScore(Math.max(0, newScore));
        setItems(prevItems => prevItems.filter(item => item.uid !== itemToSort.uid));
        setTimeout(() => setFeedback(null), 1200);
        
        // Unify completion check. `items.length` is checked before the state update, so `1` is the last item.
        if (items.length === 1) {
            isCompletingRef.current = true;
            setTimeout(() => {
                // Use the locally tracked values to avoid state lag
                onComplete(Math.round(newScore), finalSortedCorrectly);
            }, 1300); // Wait for the final feedback animation to be visible.
        }
    };
    
    // --- Mouse Drag Handlers ---
    const handleDragStart = (e: DragEvent<HTMLDivElement>, item: CollectedTrash) => {
        setDraggedItem(item);
        e.dataTransfer.effectAllowed = 'move';
        (e.currentTarget as HTMLDivElement).classList.add('dragging');
    };
    const handleDragEnd = (e: DragEvent<HTMLDivElement>) => {
        setDraggedItem(null);
        setActiveBin(null);
        (e.currentTarget as HTMLDivElement).classList.remove('dragging');
    };
    const handleDrop = (e: DragEvent<HTMLDivElement>, binType: TrashType) => {
        e.preventDefault();
        try { audio.sfx.binDrop(); } catch {}
        if (draggedItem) {
            handleSort(draggedItem, binType);
        }
        setActiveBin(null);
    };
    const handleDragOver = (e: DragEvent<HTMLDivElement>, binType: TrashType) => {
        e.preventDefault();
        setActiveBin(binType);
    };
    const handleDragLeave = () => setActiveBin(null);

    // --- Touch Drag Handlers ---
    const handleTouchStart = (e: ReactTouchEvent<HTMLDivElement>, item: CollectedTrash) => {
        if (feedback) return;
        const touch = e.touches[0];
        originalItemRef.current = e.currentTarget;
        setDraggedItem(item);

        const ghost = originalItemRef.current.cloneNode(true) as HTMLDivElement;
        ghost.classList.add('trash-item-ghost');
        document.body.appendChild(ghost);
        ghostRef.current = ghost;

        ghost.style.left = `${touch.clientX}px`;
        ghost.style.top = `${touch.clientY}px`;
        
        originalItemRef.current.classList.add('touch-dragging');
    };

    const handleTouchMove = (e: ReactTouchEvent<HTMLDivElement>) => {
        if (!draggedItem || !ghostRef.current) return;
        const touch = e.touches[0];
        ghostRef.current.style.left = `${touch.clientX}px`;
        ghostRef.current.style.top = `${touch.clientY}px`;
        
        const elementUnder = document.elementFromPoint(touch.clientX, touch.clientY);
        const binElement = elementUnder?.closest('.sorting-bin') as HTMLDivElement | null;
        const nextBin = binElement?.dataset.binType as TrashType | null;
        setActiveBin(nextBin);
    };
    
    const handleTouchEnd = () => {
        if (activeBin && draggedItem) {
            handleSort(draggedItem, activeBin);
        }

        if (ghostRef.current) {
            document.body.removeChild(ghostRef.current);
            ghostRef.current = null;
        }
        if(originalItemRef.current) {
            originalItemRef.current.classList.remove('touch-dragging');
            originalItemRef.current = null;
        }
        setDraggedItem(null);
        setActiveBin(null);
    };

    const startSorting = () => {
        sessionStorage.setItem('sortingTutorialSeen', 'true');
        setTutorialVisible(false);
    };

    if (isTutorialVisible) {
        return <SortingTutorial onStart={startSorting} />;
    }
    
    if (collected.length === 0) {
        return null; 
    }

    const bins: { type: TrashType; name: string; icon: string; desc: string; colorClass: string }[] = [
        { type: 'organic',    name: ud('%E0%B8%82%E0%B8%A2%E0%B8%B0%E0%B9%80%E0%B8%9B%E0%B8%B5%E0%B8%A2%E0%B8%81'),        icon: cp(0x1F33F), desc: ud('%E0%B9%80%E0%B8%A8%E0%B8%A9%E0%B8%AD%E0%B8%B2%E0%B8%AB%E0%B8%B2%E0%B8%A3%20%E0%B9%83%E0%B8%9A%E0%B9%84%E0%B8%A1%E0%B9%89'), colorClass: 'bin-green' },
        { type: 'recyclable', name: ud('%E0%B8%82%E0%B8%A2%E0%B8%B0%E0%B8%A3%E0%B8%B5%E0%B9%84%E0%B8%8B%E0%B9%80%E0%B8%84%E0%B8%B4%E0%B8%A5'), icon: cp(0x267B), desc: ud('%E0%B8%9E%E0%B8%A5%E0%B8%B2%E0%B8%AA%E0%B8%95%E0%B8%B4%E0%B8%81%20%E0%B9%81%E0%B8%81%E0%B9%89%E0%B8%A7%20%E0%B8%81%E0%B8%A3%E0%B8%B0%E0%B8%94%E0%B8%B2%E0%B8%A9'), colorClass: 'bin-yellow' },
        { type: 'general',    name: ud('%E0%B8%82%E0%B8%A2%E0%B8%B0%E0%B8%97%E0%B8%B1%E0%B9%88%E0%B8%A7%E0%B9%84%E0%B8%9B'),          icon: cp(0x1F5D1), desc: ud('%E0%B9%82%E0%B8%9F%E0%B8%A1%20%E0%B8%82%E0%B8%AD%E0%B8%87%E0%B9%81%E0%B8%95%E0%B8%81%E0%B8%AB%E0%B8%B1%E0%B8%81'), colorClass: 'bin-blue' },
        { type: 'hazardous',  name: ud('%E0%B8%82%E0%B8%A2%E0%B8%B0%E0%B8%AD%E0%B8%B1%E0%B8%99%E0%B8%95%E0%B8%A3%E0%B8%B2%E0%B8%A2'),     icon: cp(0x2623), desc: ud('%E0%B9%81%E0%B8%9A%E0%B8%95%E0%B9%80%E0%B8%95%E0%B8%AD%E0%B8%A3%E0%B8%B5%E0%B9%88%20%E0%B8%AA%E0%B9%80%E0%B8%9B%E0%B8%A3%E0%B8%A2%E0%B9%8C'), colorClass: 'bin-red' },
    ];
    const totalItems = collected.length;
    const sortedCount = totalItems - items.length;

    const renderBin = (bin: typeof bins[0]) => (
        <div 
            key={bin.type} 
            data-bin-type={bin.type}
            className={`sorting-bin ${bin.colorClass} ${activeBin === bin.type ? 'drag-over' : ''}`}
            onDrop={(e) => handleDrop(e, bin.type)}
            onDragOver={(e) => handleDragOver(e, bin.type)}
            onDragLeave={handleDragLeave}
        >
            <div className="bin-title">
                <span style={{ fontSize: '1.5em', lineHeight: 1 }}>{bin.icon}</span>
                <span>{bin.name}</span>
            </div>
            <p className="bin-description">{bin.desc}</p>
        </div>
    );

    const renderInventoryItem = (item: CollectedTrash) => (
         <div 
            key={item.uid}
            className="trash-item-inventory"
            draggable={!feedback}
            onDragStart={e => handleDragStart(e, item)}
            onDragEnd={handleDragEnd}
            onTouchStart={e => handleTouchStart(e, item)}
            onTouchEnd={handleTouchEnd}
        >
            <div className="trash-item-icon">{item.icon}</div>
            <div className="trash-item-name">{item.name}</div>
        </div>
    );
    
    return (
        <div className="sorting-game-frame">
            {feedback && (
                <div key={feedback.id} className={`feedback-popup ${feedback.type}`}>
                    <p className="feedback-title">{feedback.type === 'correct' ? ud('great=%E0%B9%80%E0%B8%A2%E0%B8%B5%E0%B9%88%E0%B8%A2%E0%B8%A1%E0%B8%A1%E0%B8%B2%E0%B8%81!'.split('=')[1]) : ud('not_correct=%E0%B8%A2%E0%B8%B1%E0%B8%87%E0%B9%84%E0%B8%A1%E0%B9%88%E0%B8%96%E0%B8%B9%E0%B8%81%E0%B8%95%E0%B9%89%E0%B8%AD%E0%B8%87!'.split('=')[1])}</p>
                    <p className="feedback-message">{feedback.message}</p>
                </div>
            )}
            <div className="sorting-header">
                <div className="sorting-progress-bar">
                    <div className="sorting-progress-bar-fill" style={{ width: `${(sortedCount / totalItems) * 100}%`}}></div>
                    <span className="progress-bar-text">{sortedCount} / {totalItems}</span>
                </div>
                <div className="sorting-score">{ud('score=%E0%B8%84%E0%B8%B0%E0%B9%81%E0%B8%99%E0%B8%99%3A'.split('=')[1])} {Math.round(score)}</div>
            </div>
            
            <div className="eco-fact-box">
                <strong>{ud('did_you_know=%E0%B8%A3%E0%B8%B9%E0%B9%89%E0%B8%AB%E0%B8%A3%E0%B8%B7%E0%B8%AD%E0%B9%84%E0%B8%A1%E0%B9%88'.split('=')[1])}</strong> {ecoFact}
            </div>
            
            <div className="sorting-bins-grid">
                {bins.map(bin => renderBin(bin))}
            </div>


            <div className="inventory-belt" onTouchMove={handleTouchMove}>
                {items.map(item => renderInventoryItem(item))}
            </div>
        </div>
    );
};

// --- Collection Phase ---
const CollectionGame: FC<{ profile: PlayerProfile, onCollectionComplete: (c: CollectedTrash[]) => void, isPaused: boolean, onScore?: (points:number)=>void }> = ({ profile, onCollectionComplete, isPaused, onScore }) => {
    const gameContainerRef = useRef<HTMLDivElement>(null);
    const gameWorldRef = useRef<HTMLDivElement>(null);
    const lineRef = useRef<SVGPathElement>(null);
    const hookRef = useRef<HTMLDivElement>(null);
    const boatRef = useRef<SVGSVGElement>(null);
    const cursorDotRef = useRef<HTMLDivElement>(null);
    const cursorRingRef = useRef<HTMLDivElement>(null);
    // Environment canvases
    const skyCanvasRef = useRef<HTMLCanvasElement>(null);
    const underCanvasRef = useRef<HTMLCanvasElement>(null);
    const wavesCanvasRef = useRef<HTMLCanvasElement>(null);
    const ropeStateRef = useRef<{ sag:number; sagVel:number; side:number; sideVel:number }>({ sag: 0, sagVel: 0, side: 0, sideVel: 0 });
    // Sky/time and ambient refs
    const timeOfDayProgress = useRef(0.5); // Start at noon
    const treasureEventTimerRef = useRef(60 + Math.random() * 30); // Sunken Treasure Event Timer
    const birdsRef = useRef<Array<{ x:number; y:number; speed:number; scale:number; phase:number }>>([]);
    const planktonRef = useRef<Array<{ x:number; y:number; phase:number; amp:number }>>([]);
    const farBoatsRef = useRef<Array<{ x:number; speed:number; phase:number }>>([]);
    const mammalsRef = useRef<Array<{ x:number; y:number; dir:number; kind:'whale'|'dolphin'; t:number; life:number }>>([]);
    const seabedFeaturesRef = useRef<Array<{ type: 'rock'|'coral'|'weed'|'star'|'soft_coral'; x:number; scale:number; phase: number; }>>([]);
    const underDustRef = useRef<Array<{ x:number; y:number; vx:number; vy:number; alpha:number; size:number }>>([]);
    const sandDunesRef = useRef<Array<{ x:number; w:number; h:number; a:number }>>([]);
    const ventsRef = useRef<Array<{ x:number; y:number; speed:number }>>([]);
    const twinklesRef = useRef<Array<{ x:number; y:number; s:number; a:number }>>([]);
    const wakeRef = useRef<Array<{ x:number; y:number; r:number; life:number }>>([]);
    const ripplesRef = useRef<Array<{ x:number; y:number; r:number; life:number }>>([]);
    const starsRef = useRef<Array<{ x:number; y:number; s:number; phase:number }>>([]);
    const skyStateRef = useRef<{ sunX:number; sunY:number; sunVis:number; moonX:number; moonY:number; moonVis:number }>({ sunX:0, sunY:0, sunVis:0, moonX:0, moonY:0, moonVis:0 });
    const sprayRef = useRef<Array<{ x:number; y:number; vx:number; vy:number; life:number }>>([]);
    const foamRef = useRef<Array<{ x:number; y:number; vx:number; vy:number; life:number }>>([]);
    const bubblesRef = useRef<Array<{ x:number; y:number; vy:number; r:number; life:number }>>([]);
    const fishSchoolRef = useRef<Array<{ id: number; schoolId: number; x: number; y: number; vx: number; vy: number; phase: number; scale: number; color: string; type: 'school' | 'loner'; targetY: number; }>>([]);
    const jellyfishRef = useRef<Array<{ x:number; y:number; phase:number; scale:number; color:string }>>([]);
    const turtlesRef = useRef<Array<{x:number, y:number, vx:number, vy:number, phase: number, scale: number, rot: number}>>([]);
    const octopusRef = useRef<{x:number, y:number, state: 'idle' | 'grabbing', grabTime: number, phase: number} | null>(null);
    const prevBoatXRef = useRef<number>(window.innerWidth/2);
    // Wind model
    const windRef = useRef<{ dir:number; speed:number }>({ dir: 0, speed: 0.6 }); // dir radians; 0 => blowing to the right
    const windTargetRef = useRef<{ dir:number; speed:number }>({ dir: 0, speed: 0.6 });
    const windTimerRef = useRef<number>(0);
    
    // FIX: Declare refs for game state management to resolve 'cannot find name' errors.
    const gameObjectsRef = useRef<GameObject[]>([]);
    const boatPos = useRef({ x: window.innerWidth / 2, y: 0, rot: 0, targetX: window.innerWidth / 2 });

    interface HookState {
        status: 'idle' | 'lowering' | 'raising';
        y: number;
        targetX: number;
        targetY: number;
        caught: GameObject | null;
        weight: number;
    }
    const hookState = useRef<HookState>({
        status: 'idle',
        y: 0,
        targetX: 0,
        targetY: 0,
        caught: null,
        weight: 1.0,
    });

    const [isTouching, setIsTouching] = useState(false);
    const showHint = !isTouching;
    const [collected, setCollected] = useState<CollectedTrash[]>([]);
    // Fullscreen state
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
    const [liveScore, setLiveScore] = useState(0);
    const collectedRef = useRef(collected);
    useEffect(() => { collectedRef.current = collected; }, [collected]);
    const maxCapacity = useMemo(() => getCapacityForLevel(profile.upgrades.capacity.level), [profile.upgrades.capacity.level]);

    // --- Fullscreen helpers ---
    const getIsFullscreen = useCallback(() => {
        const d: any = document as any;
        return !!(document.fullscreenElement || d.webkitFullscreenElement || d.msFullscreenElement);
    }, []);

    const toggleFullscreen = useCallback(() => {
        const d: any = document as any;
        const el: any = document.documentElement as any;
        if (getIsFullscreen()) {
            const exit = d.exitFullscreen || d.webkitExitFullscreen || d.msExitFullscreen;
            if (exit) exit.call(document);
        } else {
            const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
            if (req) req.call(el);
        }
    }, [getIsFullscreen]);

    useEffect(() => {
        const onChange = () => setIsFullscreen(getIsFullscreen());
        document.addEventListener('fullscreenchange', onChange);
        document.addEventListener('webkitfullscreenchange', onChange as any);
        document.addEventListener('msfullscreenchange', onChange as any);
        onChange();
        return () => {
            document.removeEventListener('fullscreenchange', onChange);
            document.removeEventListener('webkitfullscreenchange', onChange as any);
            document.removeEventListener('msfullscreenchange', onChange as any);
        };
    }, [getIsFullscreen]);

    // Mobile: ???????????????????? ???????
    
    useEffect(() => {
        if (collected.length >= maxCapacity) {
            const timer = setTimeout(() => {
                onCollectionComplete(collected);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [collected, maxCapacity, onCollectionComplete]);
    
    const getWaveHeightAndSlope = useCallback((x: number, time: number) => {
        // Slightly more realistic (choppy) multi-wave model
        const waveParams = [
          { amp: 28, freq: 0.0048, speed: 0.22, phase: 0.4 },
          { amp: 14, freq: 0.0095, speed: 0.45, phase: 1.6 },
          { amp: 6,  freq: 0.018,  speed: -0.35, phase: 2.1 },
        ];
        const waterLine = window.innerHeight * (WATER_LEVEL_VH / 100);
        let height = waterLine;
        let slope = 0;
        const t = time / 1000;
        const wind = windRef.current;
        const dir = Math.cos(wind.dir); // x-component
        const windAmpMul = 0.8 + wind.speed * 0.6;
        for (const w of waveParams) {
          const a = x * w.freq * Math.max(0.2, Math.abs(dir)) + t * (w.speed + wind.speed*0.2*dir) + w.phase;
          // Choppy waves: add second harmonic
          const s = Math.sin(a) + 0.35*Math.sin(2*a);
          const c = Math.cos(a) + 0.7*Math.cos(2*a);
          height += (w.amp * windAmpMul) * s;
          slope += (w.amp * windAmpMul) * w.freq * c * Math.max(0.3, Math.abs(dir));
        }
        return { height, slope };
    }, []);

    const spawnObject = useCallback((type: GameObject['type']) => {
        const el = document.createElement('div');
        const waterLine = window.innerHeight * (WATER_LEVEL_VH / 100);
        let obj: Partial<GameObject> = { el, uid: Math.random(), caught: false, type };

        if (type === 'trash') {
            const isTreasure = Math.random() < 0.01; // Made rarer
            const trashTypes = Object.keys(TRASH_DATA).filter(k => k !== 'treasure' && k !== 'sunken_treasure') as TrashId[];
            const id = isTreasure ? 'treasure' : trashTypes[Math.floor(Math.random() * trashTypes.length)];
            el.className = isTreasure ? 'world-object collectible-trash collectible-treasure-rare' : 'world-object collectible-trash';
            el.textContent = TRASH_DATA[id].icon;
            const depth = 80 + Math.random() * (window.innerHeight * 0.6);
            obj = { ...obj, id, x: Math.random() * (WORLD_WIDTH - 200) + 100, y: waterLine + depth, baseY: depth, sway: 6 + Math.random() * 10, vx: (Math.random() - 0.5) * 4, vy: 0, rot: Math.random() * 360, vRot: (Math.random() - 0.5) * 10 };
        }
        
        const parent = gameWorldRef.current;
        if(parent) parent.appendChild(el);
        return obj as GameObject;
    }, []);

    useEffect(() => {
        if (isPaused) return;

        const DAY_CYCLE_KEYFRAMES = {
            top:    [[0, '#020617'], [0.22, '#020617'], [0.28, '#1e293b'], [0.35, '#38bdf8'], [0.72, '#38bdf8'], [0.78, '#0b1d3a'], [0.85, '#020617'], [1, '#020617']],
            bottom: [[0, '#0b1d3a'], [0.22, '#0b1d3a'], [0.28, '#60a5fa'], [0.35, '#bfe4ff'], [0.72, '#bfe4ff'], [0.78, '#1e293b'], [0.85, '#0b1d3a'], [1, '#0b1d3a']],
            sun:    [[0, 0], [0.24, 0], [0.28, 1], [0.72, 1], [0.76, 0], [1, 0]],
            moon:   [[0, 1], [0.24, 1], [0.28, 0], [0.72, 0], [0.76, 1], [1, 1]],
        };

        const getInterpolatedValue = (progress: number, keyframes: Array<[number, number]>) => {
            for (let i = 0; i < keyframes.length - 1; i++) {
                const start = keyframes[i];
                const end = keyframes[i+1];
                if (progress >= start[0] && progress <= end[0]) {
                    const t = (progress - start[0]) / (end[0] - start[0]);
                    return start[1] + (end[1] - start[1]) * t;
                }
            }
            return keyframes[0][1]; // default
        };

        const getInterpolatedColor = (progress: number, keyframes: Array<[number, string]>) => {
            for (let i = 0; i < keyframes.length - 1; i++) {
                const start = keyframes[i];
                const end = keyframes[i+1];
                if (progress >= start[0] && progress <= end[0]) {
                    const t = (progress - start[0]) / (end[0] - start[0]);
                    return lerpColor(start[1], end[1], t);
                }
            }
            return keyframes[0][1]; // default
        };

        const lerp = (a:number,b:number,m:number)=>a+(b-a)*m;
        const lerpColor = (colorA: string, colorB: string, amount: number): string => {
            const [rA, gA, bA] = colorA.match(/\w\w/g)!.map((c) => parseInt(c, 16));
            const [rB, gB, bB] = colorB.match(/\w\w/g)!.map((c) => parseInt(c, 16));
            const r = Math.round(lerp(rA, rB, amount)).toString(16).padStart(2, '0');
            const g = Math.round(lerp(gA, gB, amount)).toString(16).padStart(2, '0');
            const b = Math.round(lerp(bA, bB, amount)).toString(16).padStart(2, '0');
            return `#${r}${g}${b}`;
        };

        // --- Canvas sizing helpers ---
        const resizeCanvas = (c: HTMLCanvasElement | null) => {
            if (!c) return;
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            // Set internal pixel buffer
            c.width = Math.floor(window.innerWidth * dpr);
            c.height = Math.floor(window.innerHeight * dpr);
            // Ensure CSS size matches viewport exactly
            c.style.width = `${window.innerWidth}px`;
            c.style.height = `${window.innerHeight}px`;
            const ctx = c.getContext('2d');
            if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        resizeCanvas(skyCanvasRef.current);
        resizeCanvas(underCanvasRef.current);
        resizeCanvas(wavesCanvasRef.current);
        const onResize = () => {
            resizeCanvas(skyCanvasRef.current);
            resizeCanvas(underCanvasRef.current);
            resizeCanvas(wavesCanvasRef.current);
        };
        window.addEventListener('resize', onResize);
        window.addEventListener('orientationchange', onResize);
        const objects: GameObject[] = [];
        for (let i = 0; i < 40; i++) objects.push(spawnObject('trash'));
        gameObjectsRef.current = objects;
        
        // Long-press threshold for mobile to drop hook (avoid dropping while dragging boat)
        let dropTimer: number | null = null;
        let touchStartX = 0, touchStartY = 0;
        let inSteerZone = false;
        const startLowering = (clientX:number, clientY:number) => {
            if (hookState.current.status !== 'idle' || isPaused || collectedRef.current.length >= maxCapacity) return;
            const worldScrollX = gsap.getProperty(gameWorldRef.current, "x") as number;
            const worldX = clientX - worldScrollX;
            hookState.current.status = 'lowering';
            hookState.current.targetY = clientY;
            hookState.current.targetX = worldX;
            gameContainerRef.current?.classList.add('is-hook-active');
            const waterLine = window.innerHeight * (WATER_LEVEL_VH / 100);
            ripplesRef.current.push({ x: clientX, y: waterLine-2, r: 4, life: 1 });
            audio.sfx.hookDrop();
        };

        const handleInteractionStart = (e: MouseEvent | TouchEvent) => {
            if (isPaused || collectedRef.current.length >= maxCapacity) return;
            // Ignore taps on HUD (e.g., ?????? button) so clicks work on mobile
            const tgt = e.target as HTMLElement;
            if (tgt && tgt.closest && tgt.closest('#game-hud')) return;
            e.preventDefault();
            setIsTouching(true);
            if ('touches' in e) {
                const t = e.touches[0];
                touchStartX = t.clientX; touchStartY = t.clientY;
                // Bottom screen area reserved for steering only (no drop)
                inSteerZone = t.clientY > window.innerHeight * 0.82;
                if (!inSteerZone) {
                    dropTimer = window.setTimeout(() => { startLowering(t.clientX, t.clientY); dropTimer = null; }, 300);
                }
            } else {
                startLowering((e as MouseEvent).clientX, (e as MouseEvent).clientY);
            }
        };
        const handleInteractionEnd = () => { 
            if (hookState.current.status === 'lowering') { hookState.current.status = 'raising'; audio.sfx.hookRaise(); }
            setIsTouching(false);
            if (dropTimer) { clearTimeout(dropTimer); dropTimer = null; }
            gameContainerRef.current?.classList.remove('is-hook-active');
        };
        const handleMove = (e: MouseEvent | TouchEvent) => {
            if (isPaused) return;
            // Ignore drags originating from on-screen mobile controls to avoid jumps
            const tgt = e.target as HTMLElement;
            if (tgt && tgt.closest && (tgt.closest('.mobile-controls') || tgt.closest('#game-hud'))) return;
            const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
            // If user moved finger before long-press fired, cancel dropping
            if ('touches' in e && dropTimer) {
                const dx = clientX - touchStartX, dy = clientY - touchStartY;
                if (dx*dx + dy*dy > 18*18) { clearTimeout(dropTimer); dropTimer = null; }
            }
            // Lock steering while hook is active for easier play on mobile
            if (hookState.current.status !== 'idle') { return; }
            // Steering zone: never drop, only move boat target
            if ('touches' in e && inSteerZone) {
                boatPos.current.targetX = clientX;
                return;
            }
            boatPos.current.targetX = clientX;
            gsap.to([cursorDotRef.current, cursorRingRef.current], {
                duration: 0.3,
                x: clientX,
                y: clientY,
                ease: "power2.out"
            });
        };
        
        // --- Simple seabed + feature helpers ---
        const getSeabedY = (x: number) => {
            const h = window.innerHeight;
            // Push the seabed deeper to reduce the cramped feel
            const base = h * 0.92;
            return base + Math.sin(x * 0.003) * 12 + Math.cos(x * 0.007) * 8;
        };
        if (seabedFeaturesRef.current.length === 0) {
            // Blue-noise distribution along X to avoid clustering and keep pleasant spacing
            const addWithGap = (arr: number[], gap: number) => {
                let x=0, tries=0;
                while (tries < 10000 && arr.length < Math.floor(WORLD_WIDTH / gap)) {
                    x = Math.random()*WORLD_WIDTH;
                    if (arr.every(v => Math.abs(v - x) >= gap)) arr.push(x);
                    tries++;
                }
                return arr.sort((a,b)=>a-b);
            };
            const rockXs = addWithGap([], 150);
            const weedXs = addWithGap([], 80);
            const starXs = addWithGap([], 200);
            const coralXs = addWithGap([], 120);
            const softCoralXs = addWithGap([], 100);
            const feats: Array<{ type:'rock'|'coral'|'weed'|'star'|'soft_coral'; x:number; scale:number; phase: number; }> = [];
            for (const x of rockXs) feats.push({ type:'rock', x, scale: 0.8 + Math.random()*1.3, phase: Math.random() * Math.PI * 2 });
            for (const x of weedXs) feats.push({ type:'weed', x, scale: 0.7 + Math.random()*1.2, phase: Math.random() * Math.PI * 2 });
            for (const x of starXs) feats.push({ type:'star', x, scale: 0.5 + Math.random()*1.0, phase: Math.random() * Math.PI * 2 });
            for (const x of coralXs) feats.push({ type:'coral', x, scale: 0.6 + Math.random()*1.0, phase: Math.random() * Math.PI * 2 });
            for (const x of softCoralXs) feats.push({ type:'soft_coral', x, scale: 0.7 + Math.random()*1.1, phase: Math.random() * Math.PI * 2 });
            
            seabedFeaturesRef.current = feats.sort((a,b) => a.x - b.x);

            const octopusX = Math.random() * WORLD_WIDTH;
            octopusRef.current = { x: octopusX, y: getSeabedY(octopusX) - 20, state: 'idle', grabTime: 0, phase: Math.random() * Math.PI * 2 };
        }
        if (ventsRef.current.length === 0) {
            for (let i=0;i<12;i++) {
                const x = Math.random()*WORLD_WIDTH;
                ventsRef.current.push({ x, y: getSeabedY(x)-8, speed: 35 + Math.random()*25 });
            }
        }
        if (twinklesRef.current.length === 0) {
            for (let i=0;i<120;i++) twinklesRef.current.push({ x: Math.random()*window.innerWidth, y: window.innerHeight*0.45 + Math.random()*window.innerHeight*0.5, s: 0.8 + Math.random()*1.5, a: Math.random()*Math.PI*2 });
        }
        if (sandDunesRef.current.length === 0) {
            // Precompute soft dune blobs along the seabed for shading (lighter to avoid heaviness)
            for (let i=0;i<40;i++) sandDunesRef.current.push({ x: Math.random()*WORLD_WIDTH, w: 140 + Math.random()*180, h: 26 + Math.random()*28, a: 0.03 + Math.random()*0.06 });
        }

        if (fishSchoolRef.current.length === 0) {
            const schoolColors = ['#ff8c00', '#4682b4', '#32cd32', '#ff69b4', '#6a5acd'];
            let fishId = 0;
            for (let i = 0; i < 5; i++) { // 5 schools
                const schoolSize = 15 + Math.floor(Math.random() * 10);
                const schoolX = Math.random() * WORLD_WIDTH;
                const schoolY = window.innerHeight * (WATER_LEVEL_VH / 100) + 100 + Math.random() * (window.innerHeight * 0.5);
                const schoolColor = schoolColors[i % schoolColors.length];
                const schoolVx = (Math.random() - 0.5) * 40;
                for (let j = 0; j < schoolSize; j++) {
                    fishSchoolRef.current.push({
                        id: fishId++,
                        schoolId: i,
                        x: schoolX + (Math.random() - 0.5) * 150,
                        y: schoolY + (Math.random() - 0.5) * 150,
                        vx: schoolVx,
                        vy: 0,
                        phase: Math.random() * Math.PI * 2,
                        scale: 0.5 + Math.random() * 0.4,
                        color: schoolColor,
                        type: 'school',
                        targetY: schoolY,
                    });
                }
            }
             for (let i = 0; i < 15; i++) { // 15 loner fish
                const waterLine = window.innerHeight * (WATER_LEVEL_VH / 100);
                const seabedY = getSeabedY(Math.random() * WORLD_WIDTH);
                fishSchoolRef.current.push({
                    id: fishId++,
                    schoolId: -1,
                    x: Math.random() * WORLD_WIDTH,
                    y: waterLine + 100 + Math.random() * (seabedY - waterLine - 150),
                    vx: (Math.random() - 0.5) * 50,
                    vy: 0,
                    phase: Math.random() * Math.PI * 2,
                    scale: 0.8 + Math.random() * 0.8,
                    color: `hsl(${Math.random() * 360}, 70%, 60%)`,
                    type: 'loner',
                    targetY: 0, // will be set dynamically
                });
            }
        }

        if (turtlesRef.current.length === 0) {
            const waterLine = window.innerHeight * (WATER_LEVEL_VH / 100);
            for (let i = 0; i < 5; i++) {
                const seabedY = getSeabedY(Math.random() * WORLD_WIDTH);
                turtlesRef.current.push({
                    x: Math.random() * WORLD_WIDTH,
                    y: waterLine + 150 + Math.random() * (seabedY - waterLine - 250),
                    vx: 15 + Math.random() * 10,
                    vy: 0,
                    phase: Math.random() * Math.PI * 2,
                    scale: 1.0 + Math.random() * 0.5,
                    rot: 0,
                });
            }
        }

        if (jellyfishRef.current.length === 0) {
            const waterLine = window.innerHeight * (WATER_LEVEL_VH / 100);
            for (let i = 0; i < 25; i++) {
                jellyfishRef.current.push({
                    x: Math.random() * WORLD_WIDTH,
                    y: waterLine + 80 + Math.random() * (window.innerHeight * 0.4),
                    phase: Math.random() * Math.PI * 2,
                    scale: 0.4 + Math.random() * 0.6,
                    color: `hsla(${180 + Math.random()*60}, 100%, 80%, 0.5)`
                });
            }
        }

        const drawSky = (tMs: number, scheme: { top: string; bottom: string; sun: number; moon: number; }, progress: number) => {
            const canvas = skyCanvasRef.current; if (!canvas) return; const ctx = canvas.getContext('2d'); if (!ctx) return;
            const _dpr = Math.min(2, window.devicePixelRatio||1);
            const w = canvas.width / _dpr; const h = canvas.height / _dpr;
            
            const g = ctx.createLinearGradient(0,0,0,h);
            g.addColorStop(0, scheme.top);
            g.addColorStop(1, scheme.bottom);
            ctx.clearRect(0,0,w,h);
            ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
            
            const waterLine = window.innerHeight * (WATER_LEVEL_VH / 100);
            const haze = ctx.createLinearGradient(0, waterLine-80, 0, waterLine+20);
            haze.addColorStop(0, 'rgba(255,255,255,0.05)');
            haze.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = haze; ctx.fillRect(0, waterLine-80, w, 100);

            const angle = progress * Math.PI*2;
            const sunAngle = angle - Math.PI/2;
            const moonAngle = angle + Math.PI/2;

            const cx = w/2 + Math.cos(sunAngle) * w * 0.4;
            const cy = h*0.6 - Math.sin(sunAngle) * h * 0.5;
            const mx = w/2 + Math.cos(moonAngle) * w * 0.4;
            const my = h*0.6 - Math.sin(moonAngle) * h * 0.5;

            if (scheme.sun > 0) {
                const sunRadius = 35;
                const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, sunRadius * 6);
                bloom.addColorStop(0, `rgba(255, 230, 200, ${0.4 * scheme.sun})`);
                bloom.addColorStop(0.2, `rgba(255, 200, 100, ${0.2 * scheme.sun})`);
                bloom.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = bloom; ctx.fillRect(cx - sunRadius*6, cy - sunRadius*6, sunRadius*12, sunRadius*12);

                ctx.beginPath(); ctx.arc(cx, cy, sunRadius, 0, Math.PI*2);
                ctx.fillStyle = `rgba(255, 245, 220, ${0.9 * scheme.sun})`; ctx.fill();
            }

            if (scheme.moon > 0) {
                const moonRadius = 22;
                const bloom = ctx.createRadialGradient(mx, my, 0, mx, my, moonRadius * 4);
                bloom.addColorStop(0, `rgba(200, 220, 255, ${0.3 * scheme.moon})`);
                bloom.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = bloom; ctx.fillRect(mx - moonRadius*4, my - moonRadius*4, moonRadius*8, moonRadius*8);

                ctx.save();
                ctx.beginPath(); ctx.arc(mx, my, moonRadius, 0, Math.PI*2);
                ctx.fillStyle = `rgba(240,245,255,${0.9 * scheme.moon})`; ctx.fill();
                ctx.globalCompositeOperation = 'destination-out';
                ctx.beginPath(); ctx.arc(mx-8, my-5, moonRadius, 0, Math.PI*2); ctx.fill();
                ctx.restore();
            }

            skyStateRef.current = { sunX: cx, sunY: cy, sunVis: scheme.sun, moonX: mx, moonY: my, moonVis: scheme.moon };

            if (starsRef.current.length === 0) {
                for (let i=0;i<200;i++) starsRef.current.push({ x: Math.random()*w, y: Math.random()*h*0.5, s: 0.5+Math.random()*1.5, phase: Math.random()*Math.PI*2 });
            }
            if (scheme.moon > 0.1) {
                for (const s of starsRef.current) {
                    s.phase += 0.01;
                    const a = 0.5 + 0.5*Math.abs(Math.sin(s.phase));
                    ctx.globalAlpha = a * scheme.moon;
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(s.x, s.y, s.s, s.s);
                }
                ctx.globalAlpha = 1;
            }

            if (birdsRef.current.length < 6 && scheme.sun > 0.2) {
                birdsRef.current.push({ x: Math.random()*w, y: h*0.15 + Math.random()*h*0.15, speed: 20+Math.random()*30, scale: 0.6+Math.random()*0.8, phase: Math.random()*Math.PI*2 });
            }
            for (const b of birdsRef.current) {
                b.x += b.speed * 0.016;
                b.phase += 0.1;
                if (b.x > w+40) { b.x = -40; b.y = h*0.15 + Math.random()*h*0.2; }
                ctx.strokeStyle = `rgba(0,0,0,${0.5 * (scheme.sun + scheme.moon * 0.5)})`; ctx.lineWidth = 2*b.scale; ctx.lineCap='round';
                ctx.beginPath();
                ctx.moveTo(b.x-8*b.scale, b.y);
                ctx.quadraticCurveTo(b.x, b.y+2*Math.sin(b.phase)*b.scale, b.x+8*b.scale, b.y);
                ctx.stroke();
            }
        };

        const drawUnderwater = (tMs: number, worldScrollX: number, waterLine: number, scheme: { sun: number; moon: number; }) => {
            const canvas = underCanvasRef.current; if (!canvas) return; const ctx = canvas.getContext('2d'); if (!ctx) return;
            const _dpr2 = Math.min(2, window.devicePixelRatio||1);
            const w = canvas.width / _dpr2; const h = canvas.height / _dpr2;
            ctx.clearRect(0,0,w,h);

            const waterColors = {
                day: {top: '#59d3ff', mid: '#1a9de6', deep: '#0b5e9a', bottom: '#073a66'},
                dusk: {top: '#4a87c3', mid: '#2c5a8e', deep: '#1a3657', bottom: '#0f2038'},
                night: {top: '#0f2038', mid: '#0b172b', deep: '#060e1a', bottom: '#020610'}
            };

            const sunAmount = scheme.sun;
            const nightAmount = scheme.moon;

            let topColor = lerpColor(waterColors.dusk.top, waterColors.day.top, sunAmount);
            let midColor = lerpColor(waterColors.dusk.mid, waterColors.day.mid, sunAmount);
            let deepColor = lerpColor(waterColors.dusk.deep, waterColors.day.deep, sunAmount);
            let bottomColor = lerpColor(waterColors.dusk.bottom, waterColors.day.bottom, sunAmount);

            topColor = lerpColor(topColor, waterColors.night.top, nightAmount * 0.8);
            midColor = lerpColor(midColor, waterColors.night.mid, nightAmount);
            deepColor = lerpColor(deepColor, waterColors.night.deep, nightAmount);
            bottomColor = lerpColor(bottomColor, waterColors.night.bottom, nightAmount);

            const topPath = new Path2D();
            let h0 = getWaveHeightAndSlope(0 - worldScrollX, tMs).height;
            topPath.moveTo(0, h0);
            for (let x=2; x<=w; x+=2) {
                const { height: hh } = getWaveHeightAndSlope(x - worldScrollX, tMs);
                topPath.lineTo(x, hh);
            }
            topPath.lineTo(w, h); topPath.lineTo(0, h); topPath.closePath();

            const g = ctx.createLinearGradient(0, waterLine-40, 0, h);
            g.addColorStop(0, topColor);
            g.addColorStop(0.3, midColor);
            g.addColorStop(0.7, deepColor);
            g.addColorStop(1, bottomColor);
            ctx.fillStyle = g; ctx.fill(topPath);

            const t = tMs/1000;

            // --- God Rays (disabled) ---
            /*
            const sunPos = skyStateRef.current.sunVis > 0.1 ? skyStateRef.current.sunX : skyStateRef.current.moonX;
            const sunStrength = Math.max(skyStateRef.current.sunVis, skyStateRef.current.moonVis * 0.6);
            if (sunStrength > 0.2) {
                ctx.save();
                ctx.globalCompositeOperation = 'overlay';
                const rayCount = 12;
                for (let i = 0; i < rayCount; i++) {
                    const rayX = sunPos + (i - rayCount / 2) * 150 + Math.sin(t * 0.1 + i) * 100;
                    const rayW = 40 + Math.sin(t * 0.2 + i * 2) * 20;
                    const rayAngle = (rayX - w/2) * 0.0005;

                    const grd = ctx.createLinearGradient(rayX, waterLine, rayX + Math.sin(rayAngle)*h, waterLine + h);
                    const alpha = (0.04 + Math.pow(Math.sin(t * 0.3 + i * 1.5) * 0.5 + 0.5, 4) * 0.08) * sunStrength;
                    grd.addColorStop(0, `rgba(255, 255, 220, ${alpha})`);
                    grd.addColorStop(0.8, `rgba(180, 220, 255, 0)`);

                    ctx.fillStyle = grd;
                    ctx.beginPath();
                    ctx.moveTo(rayX - rayW, waterLine);
                    ctx.lineTo(rayX + rayW, waterLine);
                    ctx.lineTo(rayX + rayW + Math.sin(rayAngle) * h, h);
                    ctx.lineTo(rayX - rayW + Math.sin(rayAngle) * h, h);
                    ctx.closePath();
                    ctx.fill();
                }
                ctx.restore();
            }
            */

            const glaze = ctx.createLinearGradient(0, waterLine-8, 0, waterLine+36);
            glaze.addColorStop(0, `rgba(255,255,255,${0.18 * sunAmount})`);
            glaze.addColorStop(0.5, `rgba(255,255,255,${0.10 * sunAmount})`);
            glaze.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = glaze; ctx.fillRect(0, waterLine-8, w, 44);

            const strata = [
                { color: `rgba(24,120,200,${0.14 * (sunAmount * 0.5 + 0.5)})`, amp: 18, step: 6, parallax: 0.55, offset: 0 },
                { color: `rgba(18,100,180,${0.12 * (sunAmount * 0.5 + 0.5)})`, amp: 26, step: 8, parallax: 0.65, offset: 500 },
                { color: `rgba(12,80,160,${0.10 * (sunAmount * 0.5 + 0.5)})`, amp: 34, step: 10, parallax: 0.75, offset: 900 },
            ];
            for (const L of strata) {
                ctx.beginPath();
                let first = true;
                for (let x=0; x<=w; x+=L.step) {
                    const hx = getWaveHeightAndSlope(x - worldScrollX*L.parallax, tMs + L.offset).height;
                    const y = hx + 50 + L.amp * Math.sin((x + tMs*0.04 + L.offset)*0.01);
                    if (first) { ctx.moveTo(x, y); first=false; } else { ctx.lineTo(x, y); }
                }
                ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
                ctx.fillStyle = L.color; ctx.fill();
            }

            ctx.globalAlpha = 0.07 * sunAmount;
            for (let y = waterLine+10; y < h; y += 40) {
                for (let x = 0; x < w; x += 40) {
                    const v = Math.sin((x*0.08)+(t*2)) * Math.cos((y*0.06)-(t*1.6));
                    const a = Math.max(0, v);
                    if (a > 0.01) {
                        const r = 18 * a;
                        const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
                        grd.addColorStop(0, 'rgba(255,255,255,0.6)');
                        grd.addColorStop(1, 'rgba(255,255,255,0)');
                        ctx.fillStyle = grd;
                        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
                    }
                }
            }
            ctx.globalAlpha = 1;

            const night = Math.min(1, skyStateRef.current.moonVis + (1 - skyStateRef.current.sunVis));
            if (night > 0.2) {
                ctx.globalCompositeOperation = 'screen';
                for (const tw of twinklesRef.current) {
                    tw.a += 0.05; const amp = (0.3 + 0.7*Math.abs(Math.sin(tw.a))) * night;
                    ctx.fillStyle = `rgba(120,220,255,${0.35*amp})`;
                    ctx.beginPath(); ctx.arc(tw.x % w, Math.max(waterLine+8, tw.y % h), tw.s, 0, Math.PI*2); ctx.fill();
                }
                ctx.globalCompositeOperation = 'source-over';
            }

            ctx.beginPath();
            ctx.moveTo(-60, h+20);
            for (let x=-60; x<=w+60; x+=10) {
                const realX = x + worldScrollX*0.6;
                const y = getSeabedY(realX);
                ctx.lineTo(x, y);
            }
            ctx.lineTo(w+60, h+20); ctx.closePath();

            const sandBase = ctx.createLinearGradient(0, h*0.7, 0, h);
            sandBase.addColorStop(0, 'rgba(206, 194, 150, 0.60)');
            sandBase.addColorStop(1, 'rgba(170, 155, 120, 0.70)');
            ctx.fillStyle = sandBase;
            ctx.fill();

            ctx.save();
            for (const d of sandDunesRef.current) {
                const sx = d.x + worldScrollX*0.6; if (sx < -200 || sx > w+200) continue;
                const y = getSeabedY(d.x);
                const grd = ctx.createRadialGradient(sx, y-6, 0, sx, y-6, d.w*0.6);
                grd.addColorStop(0, `rgba(0,0,0,${d.a * (0.5 + sunAmount*0.5)})`);
                grd.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = grd; ctx.beginPath(); ctx.ellipse(sx, y-8, d.w, d.h, -0.2, 0, Math.PI*2); ctx.fill();
            }
            ctx.restore();

            // Draw Turtles
            ctx.save();
            for (const turtle of turtlesRef.current) {
                const screenX = turtle.x - worldScrollX * 0.7; // Slower parallax
                if (screenX < -100 || screenX > w + 100) continue;

                ctx.save();
                ctx.translate(screenX, turtle.y);
                ctx.rotate(turtle.rot);
                ctx.scale(turtle.scale, turtle.scale);
                
                const flipperSway = Math.sin(turtle.phase) * 0.4;
                
                // Back flippers
                ctx.fillStyle = '#5a8265';
                ctx.beginPath();
                ctx.ellipse(-18, 12, 12, 5, -0.5 + flipperSway, 0, Math.PI * 2);
                ctx.ellipse(-18, -12, 12, 5, 0.5 - flipperSway, 0, Math.PI * 2);
                ctx.fill();

                // Body
                ctx.fillStyle = '#6b9c78';
                ctx.beginPath();
                ctx.ellipse(0, 0, 25, 20, 0, 0, Math.PI * 2);
                ctx.fill();
                
                // Shell
                ctx.fillStyle = '#8a6e4b';
                ctx.beginPath();
                ctx.ellipse(0, 0, 22, 18, 0, 0, Math.PI * 2);
                ctx.fill();
                
                // Head
                ctx.fillStyle = '#5a8265';
                ctx.beginPath();
                ctx.ellipse(26, 0, 8, 6, 0, 0, Math.PI * 2);
                ctx.fill();

                // Front flippers
                ctx.beginPath();
                ctx.ellipse(5, 20, 15, 7, 0.8 - flipperSway, 0, Math.PI * 2);
                ctx.ellipse(5, -20, 15, 7, -0.8 + flipperSway, 0, Math.PI * 2);
                ctx.fill();

                ctx.restore();
            }
            ctx.restore();

            // Draw Fish
            ctx.save();
            for (const f of fishSchoolRef.current) {
                const screenX = f.x - worldScrollX * 0.85; // Apply parallax
                if (screenX < -50 || screenX > w + 50) continue;

                ctx.fillStyle = f.color;
                ctx.globalAlpha = 0.85 * (0.5 + sunAmount*0.5);
                
                const bodyLength = 15 * f.scale;
                const bodyHeight = 8 * f.scale;
                const dir = f.vx >= 0 ? 1 : -1;
                const tailSway = Math.sin(f.phase);

                ctx.save();
                ctx.translate(screenX, f.y);
                ctx.rotate(f.vy * 0.015); // Tilt with vertical movement
                ctx.scale(dir, 1); // Flip horizontally based on direction

                // Body
                ctx.beginPath();
                ctx.moveTo(-bodyLength / 1.5, 0); // Start from back of body
                ctx.quadraticCurveTo(0, -bodyHeight, bodyLength / 2, 0); // Top curve
                ctx.quadraticCurveTo(0, bodyHeight, -bodyLength / 1.5, 0); // Bottom curve
                ctx.closePath();
                ctx.fill();

                // Tail
                ctx.beginPath();
                ctx.moveTo(-bodyLength / 1.5, 0);
                ctx.lineTo(-bodyLength, tailSway * bodyHeight * 0.7);
                ctx.lineTo(-bodyLength * 0.9, -tailSway * bodyHeight * 0.7);
                ctx.closePath();
                ctx.fill();

                ctx.restore();
            }
            ctx.restore();

            ctx.save();
            for (const f of seabedFeaturesRef.current) {
                const sx = f.x + worldScrollX*0.6; if (sx < -60 || sx > w+60) continue; // FIX: Corrected parallax calculation
                const y = getSeabedY(f.x) + 2; const s = f.scale;
                f.phase += 0.02;
                ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(sx, y-6*s, 16*s, 6*s, 0, 0, Math.PI*2); ctx.fill();
                if (f.type === 'rock') {
                    const rg = ctx.createRadialGradient(sx-6*s, y-16*s, 2*s, sx, y-12*s, 24*s);
                    rg.addColorStop(0, 'rgba(220,230,245,0.35)');
                    rg.addColorStop(1, 'rgba(46,56,86,0.65)');
                    ctx.fillStyle = rg;
                    ctx.beginPath(); ctx.ellipse(sx, y-12*s, 22*s, 14*s, -0.2, 0, Math.PI*2); ctx.fill();
                    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(sx-2*s, y-15*s, 18*s, 10*s, -0.4, 0, Math.PI*2); ctx.stroke();
                } else if (f.type === 'coral') {
                    ctx.strokeStyle = 'rgba(255, 120, 170, 0.55)'; ctx.lineWidth = Math.max(2.2, 2.6*s); ctx.lineCap = 'round';
                    ctx.shadowColor = 'rgba(255,120,170,0.28)'; ctx.shadowBlur = 5;
                    const baseY = y-6*s; const baseX = sx;
                    ctx.beginPath(); ctx.moveTo(baseX, baseY);
                    ctx.bezierCurveTo(baseX-6*s, baseY-20*s, baseX-10*s, baseY-30*s, baseX-6*s, baseY-44*s);
                    ctx.moveTo(baseX, baseY);
                    ctx.bezierCurveTo(baseX+6*s, baseY-18*s, baseX+10*s, baseY-28*s, baseX+8*s, baseY-40*s);
                    ctx.moveTo(baseX-4*s, baseY-24*s);
                    ctx.bezierCurveTo(baseX-10*s, baseY-30*s, baseX-14*s, baseY-38*s, baseX-12*s, baseY-46*s);
                    ctx.stroke();
                    ctx.shadowBlur = 0;
                } else if (f.type === 'weed') {
                    ctx.strokeStyle = 'rgba(34,197,94,0.35)'; ctx.lineWidth = 2*s; ctx.lineCap='round';
                    const sway = Math.sin(f.phase) * 8 * s;
                    for (let k=0;k<3;k++) { ctx.beginPath(); const bx = sx - 6*s + k*6*s; const by = y; ctx.moveTo(bx, by); ctx.bezierCurveTo(bx-4*s + sway, by-10*s, bx+2*s + sway, by-22*s, bx-2*s + sway, by-38*s); ctx.stroke(); }
                } else if (f.type === 'star') {
                    const r = 6*s; const cx = sx, cy = y-10*s; ctx.fillStyle = 'rgba(255,179,71,0.45)'; ctx.beginPath();
                    for (let i=0;i<5;i++){ const a = i*2*Math.PI/5 - Math.PI/2; const ax = cx + Math.cos(a)*r; const ay = cy + Math.sin(a)*r; const b = a + Math.PI/5; const bx = cx + Math.cos(b)*(r*0.45); const by = cy + Math.sin(b)*(r*0.45); if(i===0) ctx.moveTo(ax,ay); else ctx.lineTo(ax,ay); ctx.lineTo(bx,by);} ctx.closePath(); ctx.fill();
                } else if (f.type === 'soft_coral') {
                    ctx.fillStyle = `rgba(255, 105, 180, ${0.4 + 0.2*Math.sin(f.phase)})`;
                    ctx.beginPath();
                    for(let i=0; i<5; i++) {
                        const ang = i * Math.PI * 2 / 5 + f.phase * 0.2;
                        const r1 = 15 * s * (0.8 + 0.2 * Math.sin(f.phase * 1.5 + i));
                        const r2 = 8 * s;
                        ctx.ellipse(sx + Math.cos(ang) * r2, y - 15*s + Math.sin(ang) * r2, r1, r2, ang, 0, Math.PI*2);
                    }
                    ctx.fill();
                }
            }
            ctx.restore();

            if(octopusRef.current) {
                const octo = octopusRef.current;
                const sx = octo.x - worldScrollX*0.6;
                ctx.save();
                ctx.translate(sx, octo.y);
                ctx.font = '40px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                // Draw octopus emoji instead of placeholder
                try { ctx.fillText(cp(0x1F419), 0, 0); } catch { ctx.fillText('🐙', 0, 0); }
                if (octo.state === 'grabbing') {
                    octo.phase += 0.1;
                    ctx.strokeStyle = '#333';
                    ctx.lineWidth = 4;
                    for(let i=0; i<3; i++) {
                        const ang = i*Math.PI*0.1 - 0.1 + Math.sin(octo.phase*2)*0.1;
                        ctx.beginPath();
                        ctx.moveTo(0,0);
                        ctx.quadraticCurveTo(Math.cos(ang)*30, -30, hookRef.current!.offsetLeft - sx, hookRef.current!.offsetTop - octo.y);
                        ctx.stroke();
                    }
                }
                ctx.restore();
            }

            if (underDustRef.current.length === 0) {
                const n = 60; for (let i=0;i<n;i++) underDustRef.current.push({ x: Math.random()*w, y: waterLine + Math.random()*(h-waterLine-20), vx: -5 + Math.random()*10, vy: -5 + Math.random()*10, alpha: 0.05 + Math.random()*0.08, size: 0.7 + Math.random()*1.2 });
            }
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            for (const p of underDustRef.current) {
                p.x += p.vx * 0.016; p.y += p.vy * 0.016; if (p.x<-10) p.x=w+10; if (p.x>w+10) p.x=-10; if (p.y<waterLine) p.y = waterLine+5; if (p.y>h) p.y=h-10; ctx.globalAlpha = p.alpha * (0.5 + sunAmount*0.5); ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
            }
            ctx.globalAlpha = 1;

            ctx.fillStyle = 'rgba(255,255,255,0.65)';
            for (const vent of ventsRef.current) {
                const baseX = vent.x + worldScrollX*0.6; if (baseX < -40 || baseX > w+40) continue;
                const heightCol = Math.max(40, h - vent.y - 20);
                for (let j=0;j<4;j++) {
                    const phase = ((t*vent.speed) + j*0.6) % 1;
                    const bx = baseX + Math.sin((t+j)*1.3) * 6;
                    const by = vent.y + (1-phase)*heightCol;
                    if (by > waterLine+6 && by < h-10) { ctx.globalAlpha = 0.25 + 0.5*phase; ctx.beginPath(); ctx.arc(bx, by, 1.2+phase*1.5, 0, Math.PI*2); ctx.fill(); }
                }
            }
            ctx.globalAlpha = 1;

            if (bubblesRef.current.length < 30 && Math.random() < 0.2) {
                bubblesRef.current.push({ x: Math.random()*w, y: h-20, vy: -20 - Math.random()*20, r: 1 + Math.random()*1.5, life: 1 });
            }
            for (const b of bubblesRef.current) { b.y += b.vy * 0.016; b.life -= 0.004; if (b.y < waterLine+10) b.life = 0; }
            bubblesRef.current = bubblesRef.current.filter(b => b.life>0);
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            for (const b of bubblesRef.current) { ctx.globalAlpha = b.life; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2); ctx.fill(); }
            ctx.globalAlpha = 1;
        };

        const drawWaves = (time: number, waterLine: number, boatScreenX: number, worldScrollX: number) => {
            const canvas = wavesCanvasRef.current; if (!canvas) return; const ctx = canvas.getContext('2d'); if (!ctx) return;
            const _dpr3 = Math.min(2, window.devicePixelRatio||1);
            const w = canvas.width / _dpr3; const h = canvas.height / _dpr3;
            ctx.clearRect(0,0,w,h);
            ctx.lineWidth = 2;
            let prevH = waterLine; let prevX = 0; let prevSlope = 0;
            for (let x=0; x<=w; x+=2) {
                const { height: hgt, slope } = getWaveHeightAndSlope(x - worldScrollX, time);
                ctx.strokeStyle = 'rgba(255,255,255,0.15)';
                ctx.beginPath(); ctx.moveTo(prevX, prevH-1); ctx.lineTo(x, hgt-1); ctx.stroke();
                if (Math.sign(prevSlope) !== Math.sign(slope) && Math.abs(prevSlope) < 0.25) {
                    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
                    ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x-6, hgt-2); ctx.lineTo(x+6, hgt-2); ctx.stroke();
                    ctx.lineWidth = 2;
                }
                prevX = x; prevH = hgt; prevSlope = slope;
            }

            const layers = [
                { amp: 20, color: 'rgba(255,255,255,0.10)', offset: 4,  parallax: 0.45 },
                { amp: 16, color: 'rgba(255,255,255,0.12)', offset: 9,  parallax: 0.55 },
                { amp: 12, color: 'rgba(255,255,255,0.12)', offset: 12, parallax: 0.65 },
                { amp: 8,  color: 'rgba(255,255,255,0.08)', offset: 18, parallax: 0.75 },
                { amp: 5,  color: 'rgba(255,255,255,0.05)', offset: 26, parallax: 0.85 },
            ];
            for (const L of layers) {
                ctx.beginPath();
                for (let x=0; x<=w; x+=3) {
                    const { height } = getWaveHeightAndSlope(x - worldScrollX*L.parallax, time + L.offset);
                    const y = height + Math.sin((x+time*0.06)*0.05 + L.offset*0.1) * L.amp;
                    if (x===0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                }
                ctx.strokeStyle = L.color; ctx.lineWidth = 1; ctx.stroke();
            }

            const boatSurfY = getWaveHeightAndSlope(boatScreenX - worldScrollX, time).height;
            wakeRef.current.push({ x: boatScreenX-30, y: boatSurfY-4, r: 6, life: 1 });
            for (const wv of wakeRef.current) { wv.r += 20*0.016; wv.life -= 0.02; }
            wakeRef.current = wakeRef.current.filter(wv => wv.life>0);
            for (const wv of wakeRef.current) { ctx.beginPath(); ctx.arc(wv.x, wv.y, wv.r, 0, Math.PI*2); ctx.strokeStyle = `rgba(255,255,255,${0.25*wv.life})`; ctx.lineWidth = 1.5; ctx.stroke(); }

            for (const rp of ripplesRef.current) { rp.r += 28*0.016; rp.life -= 0.03; }
            ripplesRef.current = ripplesRef.current.filter(rp => rp.life>0);
            for (const rp of ripplesRef.current) { ctx.beginPath(); ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI*2); ctx.strokeStyle = `rgba(255,255,255,${0.35*rp.life})`; ctx.lineWidth = 1; ctx.stroke(); }

            for (const sp of sprayRef.current) { ctx.globalAlpha = sp.life; ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(sp.x, sp.y, 1.5, 0, Math.PI*2); ctx.fill(); }
            ctx.globalAlpha = 1;

            for (const f of foamRef.current) { ctx.globalAlpha = 0.6 * f.life; ctx.fillStyle = '#ffffff'; ctx.fillRect(f.x, f.y, 2, 1); }
            ctx.globalAlpha = 1;

            const reflectX = skyStateRef.current.sunVis > 0.2 ? skyStateRef.current.sunX : (skyStateRef.current.moonVis > 0.2 ? skyStateRef.current.moonX : -9999);
            if (reflectX > -1000) {
                const strength = Math.max(skyStateRef.current.sunVis, skyStateRef.current.moonVis);
                const grad = ctx.createLinearGradient(reflectX-60, waterLine, reflectX+60, waterLine);
                grad.addColorStop(0, 'rgba(255,255,255,0)');
                grad.addColorStop(0.5, `rgba(255,255,255,${0.25*strength})`);
                grad.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = grad;
                for (let i=0;i<8;i++) { ctx.fillRect(reflectX-60, waterLine + i*3, 120, 2); }
            }

            const sunInt = Math.max(0.1, skyStateRef.current.sunVis);
            if (sunInt > 0.05) {
                for (let x=0; x<=w; x+=12) {
                    const p0 = getWaveHeightAndSlope(x-6 - worldScrollX, time);
                    const p1 = getWaveHeightAndSlope(x - worldScrollX, time);
                    const p2 = getWaveHeightAndSlope(x+6 - worldScrollX, time);
                    const curvature = (p2.height - 2*p1.height + p0.height);
                    if (Math.abs(p1.slope) < 0.02 && curvature < -0.6) {
                        const s = 0.6 + 0.8*Math.random();
                        ctx.globalAlpha = 0.15 + 0.35*sunInt;
                        ctx.fillStyle = "rgba(255,255,255,0.95)";
                        ctx.beginPath(); ctx.arc(x, p1.height-2, 1.2*s, 0, Math.PI*2); ctx.fill();
                    }
                }
                ctx.globalAlpha = 1;
            }
        };

        const gameLoop = (time: number, deltaTime: number) => {
            if (!gameContainerRef.current || isPaused) return;
            
            const deltaSeconds = Math.min(deltaTime / 1000, 0.032);
        
            const boatEl = boatRef.current;
            const hookEl = hookRef.current;
            if (!boatEl || !hookEl || !lineRef.current || !gameWorldRef.current) return;

            timeOfDayProgress.current = (timeOfDayProgress.current + deltaSeconds / DAY_CYCLE_DURATION_S) % 1;
            const progress = timeOfDayProgress.current;

            const skyScheme = {
                top: getInterpolatedColor(progress, DAY_CYCLE_KEYFRAMES.top),
                bottom: getInterpolatedColor(progress, DAY_CYCLE_KEYFRAMES.bottom),
                sun: getInterpolatedValue(progress, DAY_CYCLE_KEYFRAMES.sun),
                moon: getInterpolatedValue(progress, DAY_CYCLE_KEYFRAMES.moon),
            };
        
            const hookActive = hookState.current.status !== 'idle';
            const targetX = hookActive ? boatPos.current.x : Math.max(100, Math.min(window.innerWidth - 100, boatPos.current.targetX));
            // Slow down boat movement further for easier mobile control
            const follow = (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) ? 0.015 : 0.04;
            boatPos.current.x += (targetX - boatPos.current.x) * follow;
            const boatScreenX = boatPos.current.x;
            const scrollRatio = boatScreenX / window.innerWidth;
            const worldScrollX = -scrollRatio * (WORLD_WIDTH - window.innerWidth);
            const { height, slope } = getWaveHeightAndSlope(boatScreenX - worldScrollX, time);
            boatPos.current.y = height;
            boatPos.current.rot = slope * (180 / Math.PI) * 0.2;
            gsap.set(boatEl, { x: boatScreenX - 100, y: boatPos.current.y - 100, rotation: boatPos.current.rot });
            gsap.set(gameWorldRef.current, { x: worldScrollX });

            const waterLine = window.innerHeight * (WATER_LEVEL_VH / 100);
            windTimerRef.current -= deltaSeconds;
            if (windTimerRef.current <= 0) {
                windTargetRef.current.dir = (Math.random()-0.5) * Math.PI * 0.5;
                windTargetRef.current.speed = 0.25 + Math.random()*0.9;
                windTimerRef.current = 8 + Math.random()*12;
            }
            windRef.current.dir += (windTargetRef.current.dir - windRef.current.dir) * 0.02;
            windRef.current.speed += (windTargetRef.current.speed - windRef.current.speed) * 0.02;
            drawSky(time, skyScheme, progress);
            drawUnderwater(time, worldScrollX, waterLine, skyScheme);
            drawWaves(time, waterLine, boatScreenX, worldScrollX);

            // --- Sunken Treasure Event ---
            treasureEventTimerRef.current -= deltaSeconds;
            if (treasureEventTimerRef.current <= 0) {
                const el = document.createElement('div');
                const boatWorldX = boatPos.current.x - worldScrollX;
                const spawnX = boatWorldX + (Math.random() - 0.5) * (window.innerWidth * 0.7);
                const seabedY = getSeabedY(spawnX);

                const obj: GameObject = {
                    el,
                    uid: Math.random(),
                    caught: false,
                    type: 'trash',
                    id: 'sunken_treasure',
                    x: Math.max(100, Math.min(WORLD_WIDTH - 100, spawnX)),
                    y: seabedY - 40,
                    baseY: seabedY - 40,
                    sway: 2,
                    vx: 0, vy: 0, rot: (Math.random() - 0.5) * 15, vRot: (Math.random() - 0.5) * 2,
                };

                el.className = 'world-object collectible-trash collectible-treasure-event';
                el.textContent = TRASH_DATA.sunken_treasure.icon;
                
                const parent = gameWorldRef.current;
                if(parent) parent.appendChild(el);
                gameObjectsRef.current.push(obj);

                // TODO: Add a sparkle/notification effect here

                treasureEventTimerRef.current = 90 + Math.random() * 60; // Reset for 1.5-2.5 minutes
            }

            const boatSpeed = (boatScreenX - prevBoatXRef.current) / (deltaSeconds || 1/60);
            prevBoatXRef.current = boatScreenX;
            const speedAbs = Math.abs(boatSpeed);
            if (speedAbs > 120) {
                const count = Math.min(12, Math.floor(speedAbs / 80));
                for (let i=0;i<count;i++) {
                    const ang = -Math.sign(boatSpeed) * 0.4 + (Math.random()-0.5)*0.3;
                    const v = 120 + Math.random()*80;
                    sprayRef.current.push({ x: boatScreenX-30, y: boatPos.current.y-8, vx: v*Math.cos(ang), vy: -60*Math.sin(ang) - 40*Math.random(), life: 1 });
                }
            }

            const windVX = Math.cos(windRef.current.dir) * 20 * windRef.current.speed;
            const windVY = Math.sin(windRef.current.dir) * 4 * windRef.current.speed;
            for (const p of sprayRef.current) { p.x += (p.vx + windVX) * deltaSeconds; p.y += (p.vy + windVY) * deltaSeconds; p.vy += 60*deltaSeconds; p.life -= 0.04; }
            sprayRef.current = sprayRef.current.filter(p => p.life>0 && p.y < boatPos.current.y-2);

            if (Math.random() < 0.8) foamRef.current.push({ x: boatScreenX-40 + (Math.random()*20-10), y: boatPos.current.y-1, vx: windVX*0.2 + (Math.random()-0.5)*10, vy: 0, life: 1 });
            for (const f of foamRef.current) { f.x += f.vx * deltaSeconds; f.y += f.vy * deltaSeconds; f.life -= 0.01; }
            foamRef.current = foamRef.current.filter(f => f.life>0.1);

            // Boids fish simulation - ENHANCED FOR LIVELIER BEHAVIOR
            const allFish = fishSchoolRef.current;
            const hookWorldXForFish = hookRef.current ? hookRef.current.offsetLeft : -1000;
            const hookWorldYForFish = hookRef.current ? hookRef.current.offsetTop : -1000;
            const hookIsActive = hookState.current.status !== 'idle';

            // Boid parameters - Tuned for more dynamic movement
            const separationDist = 50;
            const alignmentDist = 100;
            const cohesionDist = 120;
            const separationForce = 0.09; // Increased
            const alignmentForce = 0.07;  // Increased
            const cohesionForce = 0.003; // Increased
            const hookAvoidanceDist = 130;
            const hookAvoidanceForce = 0.25;

            allFish.forEach(fish => {
                // --- Boids Flocking Logic (for school fish) ---
                if (fish.type === 'school') {
                    let avgVx = 0, avgVy = 0, avgX = 0, avgY = 0;
                    let alignCount = 0, cohesionCount = 0;
                    let sepVx = 0, sepVy = 0;

                    allFish.forEach(other => {
                        if (fish.id === other.id || other.schoolId !== fish.schoolId) return;
                        const d = Math.hypot(fish.x - other.x, fish.y - other.y);
                        if (d > 0 && d < separationDist) {
                            sepVx += (fish.x - other.x) / d;
                            sepVy += (fish.y - other.y) / d;
                        }
                        if (d < alignmentDist) {
                            avgVx += other.vx;
                            avgVy += other.vy;
                            alignCount++;
                        }
                        if (d < cohesionDist) {
                            avgX += other.x;
                            avgY += other.y;
                            cohesionCount++;
                        }
                    });

                    if (alignCount > 0) {
                        avgVx /= alignCount;
                        avgVy /= alignCount;
                        fish.vx += (avgVx - fish.vx) * alignmentForce;
                        fish.vy += (avgVy - fish.vy) * alignmentForce;
                    }
                    if (cohesionCount > 0) {
                        avgX /= cohesionCount;
                        avgY /= cohesionCount;
                        fish.vx += (avgX - fish.x) * cohesionForce;
                        fish.vy += (avgY - fish.y) * cohesionForce;
                    }
                    fish.vx += sepVx * separationForce;
                    fish.vy += sepVy * separationForce;
                }

                // --- General Fish AI (applies to all fish) ---

                // Flee from the hook
                if (hookIsActive) {
                    const dHook = Math.hypot(fish.x - hookWorldXForFish, fish.y - hookWorldYForFish);
                    if (dHook > 0 && dHook < hookAvoidanceDist) {
                        const fleeVx = (fish.x - hookWorldXForFish) / dHook;
                        const fleeVy = (fish.y - hookWorldYForFish) / dHook;
                        fish.vx += fleeVx * hookAvoidanceForce * (180 / (dHook + 1)); // Stronger when closer
                        fish.vy += fleeVy * hookAvoidanceForce * (180 / (dHook + 1));
                    }
                }

                // More lively random movement
                if (Math.random() < 0.12) { // Increased frequency
                    fish.vx += (Math.random() - 0.5) * 30; // Increased magnitude
                    fish.vy += (Math.random() - 0.5) * 30;
                }
                // Occasional "darting" motion
                if (Math.random() < 0.02) { // Increased frequency
                    fish.vx += (Math.random() - 0.5) * 150; // Increased magnitude
                    fish.vy += (Math.random() - 0.5) * 75;
                }

                // Speed limit
                const speed = Math.hypot(fish.vx, fish.vy);
                const maxSpeed = 180; // Increased max speed
                if (speed > maxSpeed) {
                    fish.vx = (fish.vx / speed) * maxSpeed;
                    fish.vy = (fish.vy / speed) * maxSpeed;
                }

                // Update position and tail flap animation
                fish.x += fish.vx * deltaSeconds;
                fish.y += fish.vy * deltaSeconds;
                fish.phase += (6 + speed / 10) * 0.5; // Faster tail flap

                // --- Boundary Checks ---
                const seabedY = getSeabedY(fish.x);
                // Stronger boundary repulsion to prevent getting stuck
                if (fish.y > seabedY - 20) {
                    fish.vy -= 20; // Push up from seabed
                    fish.y = seabedY - 20;
                }
                if (fish.y < waterLine + 20) {
                    fish.vy += 20; // Push down from surface
                    fish.y = waterLine + 20;
                }
                if (fish.x < 10) {
                    fish.vx += 20; // Push right from edge
                    fish.x = 10;
                }
                if (fish.x > WORLD_WIDTH - 10) {
                    fish.vx -= 20; // Push left from edge
                    fish.x = WORLD_WIDTH - 10;
                }
            });

            // --- Turtle Simulation ---
            turtlesRef.current.forEach(turtle => {
                turtle.x += turtle.vx * deltaSeconds;
                turtle.phase += 0.1;
                turtle.rot = turtle.vy * 0.02;

                // Gentle vertical bobbing
                turtle.vy += (0 - turtle.vy) * 0.01; // Drift towards neutral vertical speed
                if (Math.random() < 0.05) {
                    turtle.vy += (Math.random() - 0.5) * 10;
                }

                turtle.y += turtle.vy * deltaSeconds;

                // Boundary checks for turtles
                const seabedY = getSeabedY(turtle.x);
                if (turtle.y > seabedY - 50) { turtle.vy -= 5; turtle.y = seabedY - 50; }
                if (turtle.y < waterLine + 50) { turtle.vy += 5; turtle.y = waterLine + 50; }
                if (turtle.x > WORLD_WIDTH + 100) { turtle.x = -100; }
                if (turtle.x < -100) { turtle.x = WORLD_WIDTH + 100; }
            });
            
            const lineAnchorY = boatPos.current.y - 20;
            let hookSpeed = (BASE_HOOK_SPEED * getHookSpeedMultiplier(profile.upgrades.hook.level) * deltaSeconds) / hookState.current.weight;
            const boatWorldX = boatScreenX - worldScrollX;

            if (octopusRef.current && octopusRef.current.state === 'grabbing') {
                hookSpeed = 0; // Octopus holds the hook
                octopusRef.current.grabTime -= deltaSeconds;
                if (octopusRef.current.grabTime <= 0) {
                    octopusRef.current.state = 'idle';
                }
            }

            if (hookState.current.status === 'lowering') {
                hookState.current.y += hookSpeed;
                if (hookState.current.y >= hookState.current.targetY || hookState.current.y >= window.innerHeight - HOOK_MAX_LENGTH_OFFSET) {
                    hookState.current.status = 'raising';
                }
            } else if (hookState.current.status === 'raising') {
                hookState.current.y -= hookSpeed;
                if (hookState.current.y <= 0) {
                    hookState.current.y = 0;
                    hookState.current.status = 'idle';
                    
                    const caughtItem = hookState.current.caught;
                    if (caughtItem) {
                        const currentCollected = collectedRef.current;
                        if (currentCollected.length < maxCapacity) {
                            const trashData = TRASH_DATA[caughtItem.id as TrashId];
                            if(trashData){
                                // Live score & floating number at deposit
                                if (onScore) { try { onScore(trashData.points || 0); } catch {} }
                                try {
                                    const fx = (caughtItem.x + (gsap.getProperty(gameWorldRef.current!, 'x') as number));
                                    const fy = caughtItem.y;
                                    const el = document.createElement('div');
                                    el.className = 'floating-score';
                                    el.textContent = `+${trashData.points}`;
                                    document.body.appendChild(el);
                                    el.style.left = `${fx}px`;
                                    el.style.top = `${fy}px`;
                                    gsap.fromTo(el, { y: 0, opacity: 1, scale: 1 }, { y: -36, opacity: 0, scale: 1.1, duration: 0.9, ease: 'power1.out', onComplete: () => el.remove() });
                                } catch {}
                                setCollected(prev => [...prev, {
                                    id: caughtItem.id as TrashId,
                                    uid: caughtItem.uid,
                                    name: trashData.name,
                                    icon: trashData.icon,
                                    type: trashData.type,
                                }]);
                                gameObjectsRef.current = gameObjectsRef.current.filter(o => o.uid !== caughtItem.uid);
                                caughtItem.el.remove();
                            }
                        } else {
                            caughtItem.caught = false;
                        }
                    }
                    hookState.current.caught = null;
                    hookState.current.weight = 1.0;
                }
            }
            
            const hookInterpolation = hookState.current.y > 0 && hookState.current.targetY > 0 ? (hookState.current.y / hookState.current.targetY) : 0;
            const hookWorldX = boatWorldX + (hookState.current.targetX - boatWorldX) * hookInterpolation;
            const hookWorldY = lineAnchorY + hookState.current.y;
            gsap.set(hookEl, { x: hookWorldX, y: hookWorldY });
        
            const hookScreenX = hookWorldX + worldScrollX;
            const dx = hookScreenX - boatScreenX; const dy = hookWorldY - lineAnchorY;
            const dist = Math.hypot(dx, dy);
            const ropeLen = Math.max(60, hookState.current.y + 40);
            const slack = Math.max(0, ropeLen - dist);
            const status = hookState.current.status;
            const baseSagTarget = Math.min(160, (slack * 0.75 + 12) * (status === 'raising' ? 0.35 : status === 'lowering' ? 0.6 : 0.45) * hookState.current.weight);

            const rs = ropeStateRef.current;
            const k = 0.18, dmp = 0.12;
            rs.sagVel += (baseSagTarget - rs.sag) * k; rs.sagVel *= (1 - dmp); rs.sag += rs.sagVel;

            const boatVel = (boatScreenX - prevBoatXRef.current) / (deltaSeconds || 1/60);
            const sideTarget = Math.max(-30, Math.min(30, boatVel * 0.06));
            rs.sideVel += (sideTarget - rs.side) * 0.15; rs.sideVel *= 0.8; rs.side += rs.sideVel;
            const waveJitter = Math.sin(time/300 + boatScreenX*0.01) * 4;
            const c1x = boatScreenX + dx * 0.35 + rs.side * 0.5;
            const c1y = lineAnchorY + dy * 0.35 + rs.sag*0.5 + waveJitter;
            const c2x = boatScreenX + dx * 0.7 + rs.side;
            const c2y = lineAnchorY + dy * 0.7 + rs.sag + waveJitter*0.5;
            const dPath = `M ${boatScreenX} ${lineAnchorY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${hookScreenX} ${hookWorldY}`;
            if (lineRef.current) lineRef.current.setAttribute('d', dPath);
            
            gameObjectsRef.current.forEach(obj => {
                if (obj.caught) {
                    gsap.set(obj.el, { x: hookWorldX, y: hookWorldY });
                    return;
                }
                
                if (obj.type === 'trash') {
                    const { height: surf, slope } = getWaveHeightAndSlope(obj.x, time);
                    const seabedY = getSeabedY(obj.x);
                    const phase = (time/900) + obj.uid*2.1;
                    let targetY = surf + (obj.baseY ?? 140) + Math.sin(phase) * (obj.sway ?? 9);
                    targetY = Math.max(surf + 60, Math.min(seabedY - 40, targetY));
                    obj.y += (targetY - obj.y) * 0.18;

                    const windVX = Math.cos(windRef.current.dir) * (15 * windRef.current.speed);
                    const currentVX = Math.sin(obj.y*0.015 + time*0.001 + obj.uid) * 30 + Math.cos(obj.x*0.003 + time*0.0006)*20;
                    const stokes = slope * 18;
                    const desiredVX = windVX*0.3 + currentVX + stokes;
                    obj.vx += (desiredVX - obj.vx) * 0.02;

                    obj.rot += ((slope * (180/Math.PI) * 0.6 + Math.sin(phase)*8) - obj.rot) * 0.08;
                    obj.vy *= 0.85;
                    obj.y += Math.sin(time / 500 + obj.uid) * 0.25;

                    (obj.el.style as any).opacity = '';
                    obj.el.style.filter = '';
                }

                obj.x += obj.vx * deltaSeconds;
                obj.y += obj.vy * deltaSeconds;
                obj.rot += obj.vRot * deltaSeconds;
                gsap.set(obj.el, { x: obj.x, y: obj.y, rotation: obj.rot });
            });
        
            if (hookState.current.status === 'lowering' && !hookState.current.caught) {
                if (octopusRef.current && octopusRef.current.state === 'idle') {
                    const octo = octopusRef.current;
                    const dx = hookWorldX - octo.x;
                    const dy = hookWorldY - octo.y;
                    if (dx*dx + dy*dy < 100*100) {
                        octo.state = 'grabbing';
                        octo.grabTime = 3; // 3 seconds
                    }
                }

                for (const trash of gameObjectsRef.current) {
                    if (trash.type === 'trash' && !trash.caught) {
                        const dx = hookWorldX - trash.x;
                        const dy = hookWorldY - trash.y;
                        if (dx * dx + dy * dy < 52 * 52) {
                            hookState.current.caught = trash;
                            trash.caught = true;
                            hookState.current.status = 'raising';
                            hookState.current.weight = TRASH_DATA[trash.id as TrashId].weight;
                            vibrate(100);
                            audio.sfx.collect();
                            if (trash.id === 'treasure' || (trash.id as any) === 'sunken_treasure') { try { audio.sfx.treasure(); } catch {} }
                            break;
                        }
                    }
                }
            }
        };

        const ticker = gsap.ticker;
        ticker.add(gameLoop);
        
        const container = gameContainerRef.current!;
        container.addEventListener('mousedown', handleInteractionStart);
        container.addEventListener('mouseup', handleInteractionEnd);
        container.addEventListener('touchstart', handleInteractionStart, { passive: false });
        container.addEventListener('touchend', handleInteractionEnd);
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('touchmove', handleMove, { passive: false });
        
        return () => {
            ticker.remove(gameLoop);
            window.removeEventListener('resize', onResize);
            window.removeEventListener('orientationchange', onResize);
            container.removeEventListener('mousedown', handleInteractionStart);
            container.removeEventListener('mouseup', handleInteractionEnd);
            container.removeEventListener('touchstart', handleInteractionStart);
            container.removeEventListener('touchend', handleInteractionEnd);
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('touchmove', handleMove);
            if (gameWorldRef.current) gameWorldRef.current.innerHTML = '';
            // Cancel any pending mobile movement animation frame to avoid leaks or stray motion
            if (mobileMove.current && mobileMove.current.raf) {
                cancelAnimationFrame(mobileMove.current.raf as number);
                mobileMove.current.raf = 0;
                mobileMove.current.dir = 0;
                mobileMove.current.vx = 0;
            }
        };
    }, [isPaused, profile, maxCapacity, getWaveHeightAndSlope, spawnObject, onCollectionComplete]);
    
    const isMobile = (typeof window !== 'undefined') && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
        // Mobile move with soft acceleration/deceleration
    const clampX = (x:number) => Math.max(100, Math.min(window.innerWidth - 100, x));
    const mobileMove = useRef<{ dir: -1|0|1; vx: number; raf: number|0 }>({ dir: 0, vx: 0, raf: 0 });
    const mobileStep = () => {
        const st = mobileMove.current; const accel = 0.28; const damping = 0.88;
        const maxV = Math.max(2.2, window.innerWidth * 0.0035);
        if (st.dir !== 0) st.vx = Math.max(-maxV, Math.min(maxV, st.vx + st.dir * accel));
        else st.vx *= damping;
        if (Math.abs(st.vx) < 0.05 && st.dir === 0) { st.vx = 0; st.raf = 0; return; }
        boatPos.current.targetX = clampX(boatPos.current.targetX + st.vx);
        st.raf = requestAnimationFrame(mobileStep);
    };
    const startMove = (dir: -1 | 1) => { const st = mobileMove.current; st.dir = dir; if (!st.raf) st.raf = requestAnimationFrame(mobileStep); audio.uiClick(); };
    const stopMove = (dir: -1 | 1) => { if (mobileMove.current.dir === dir) mobileMove.current.dir = 0; };
const tapDrop = () => {
        if (isPaused) return;
        // Drop
        if (hookState.current.status === 'idle' && collectedRef.current.length < maxCapacity) {
            const worldScrollX = gsap.getProperty(gameWorldRef.current, 'x') as number;
            const worldX = boatPos.current.x - (worldScrollX as number);
            hookState.current.status = 'lowering';
            hookState.current.targetX = worldX;
            hookState.current.targetY = Math.min(window.innerHeight * 0.78, window.innerHeight - HOOK_MAX_LENGTH_OFFSET);
            gameContainerRef.current?.classList.add('is-hook-active');
            // ripple visual
            const waterLine = window.innerHeight * (WATER_LEVEL_VH / 100);
            ripplesRef.current.push({ x: boatPos.current.x, y: waterLine - 2, r: 4, life: 1 });
        } else if (hookState.current.status !== 'idle') {
            // Raise immediately
            hookState.current.status = 'raising';
            hookState.current.targetY = 0;
            gameContainerRef.current?.classList.remove('is-hook-active');
        }
    };

    return (
        <div ref={gameContainerRef} className="game-container collection-game-container">
            {/* Background/Environment layers */}
            <canvas ref={skyCanvasRef} className="waves-canvas" style={{ zIndex: 5 }} />
            <canvas ref={underCanvasRef} className="waves-canvas" style={{ zIndex: 9 }} />
            <canvas ref={wavesCanvasRef} className="waves-canvas" style={{ zIndex: 15 }} />
            <div ref={cursorDotRef} className="cursor-dot"></div>
            <div ref={cursorRingRef} className="cursor-ring"></div>
            <div ref={gameWorldRef} id="game-world" className="game-world" style={{ width: `${WORLD_WIDTH}px` }}>
                <div ref={hookRef} className="hook">{cp(0x1FA9D)}</div>
            </div>
            <svg className="line-svg"><path ref={lineRef} stroke="#2b2b2b" strokeWidth="2.5" fill="none" strokeLinecap="round" /></svg>
            <BoatSVG ref={boatRef} customization={profile.customization} />
            <HUD 
              collected={collected.length} 
              maxCapacity={maxCapacity} 
              onSortNow={() => { if (collectedRef.current.length > 0) onCollectionComplete(collectedRef.current); }} 
              canSortNow={collected.length > 0}
            />
            {isMobile && (
              <div className="mobile-controls" aria-hidden="false">
                <div className="mc-row">
                  <button className="mc-btn" onTouchStart={() => startMove(-1)} onTouchEnd={() => stopMove(-1)} onMouseDown={() => startMove(-1)} onMouseUp={() => stopMove(-1)} aria-label="Left">{cp(0x25C0)}</button>
                  <button className="mc-btn primary" onClick={tapDrop} onTouchStart={(e)=>{ e.preventDefault(); tapDrop(); }} onMouseDown={(e)=>{ e.preventDefault(); tapDrop(); }} aria-label="Drop Hook">{cp(0x1FA9D)}</button>
                  <button className="mc-btn" onTouchStart={() => startMove(1)} onTouchEnd={() => stopMove(1)} onMouseDown={() => startMove(1)} onMouseUp={() => stopMove(1)} aria-label="Right">{cp(0x25B6)}</button>
                </div>
              </div>
            )}
            {/* ?????????? ???????????? ?????????????? ??????????????? */}
            {showHint && (
                <div className="tutorial-tooltip">
                    {ud('mobile_hint=%E0%B9%81%E0%B8%95%E0%B8%B0%E0%B8%84%E0%B9%89%E0%B8%B2%E0%B8%87%E0%B8%97%E0%B8%B5%E0%B9%88%E0%B9%83%E0%B8%94%E0%B9%81%E0%B8%9A%E0%B8%9A%E0%B8%88%E0%B8%AD%E0%B8%AA%E0%B8%B1%E0%B8%A1%E0%B8%9C%E0%B8%B1%E0%B8%AA%20%E0%B8%A5%E0%B8%B2%E0%B8%81%E0%B9%80%E0%B8%9E%E0%B8%B7%E0%B9%88%E0%B8%AD%E0%B9%80%E0%B8%A5%E0%B8%B7%E0%B9%88%E0%B8%AD%E0%B8%99%E0%B9%80%E0%B8%A3%E0%B8%B7%E0%B8%AD'.split('=')[1])}
                </div>
            )}
        </div>
    );
};

const BoatSVG = React.forwardRef<SVGSVGElement, { customization: PlayerProfile['customization'] }>(({ customization }, ref) => (
    <svg ref={ref} className="boat-svg" viewBox="0 0 200 150">
        <g id="ship-body">
            <path id="ship-hull" d="M 20 100 C 20 120, 180 120, 180 100 L 150 70 L 50 70 Z" fill={customization.boatColor} />
            <path id="ship-cabin" d="M 60 70 L 140 70 L 130 40 L 70 40 Z" fill="#a0b0c0" />
        </g>
        <g id="ship-flag">
            <line x1="140" y1="70" x2="140" y2="20" stroke="#506070" strokeWidth="3" />
            <path id="flag-canvas" d="M 140 20 C 155 15, 170 25, 185 20 L 185 40 C 170 45, 155 35, 140 40 Z" fill={customization.flagId.includes('wave') ? '#38bdf8' : '#f0f8ff'}/>
        </g>
    </svg>
));

const HUD: FC<{ collected: number, maxCapacity: number, onSortNow?: () => void, canSortNow?: boolean }> = ({ collected, maxCapacity, onSortNow, canSortNow }) => (
  <div id="game-hud">
    <div className="hud-element-wrapper">
      <div className="hud-element capacity-bar">
        <span>{ud('hud_collected=%E0%B9%80%E0%B8%81%E0%B9%87%E0%B8%9A%E0%B9%81%E0%B8%A5%E0%B9%89%E0%B8%A7%3A'.split('=')[1])} {collected}/{maxCapacity}</span>
        <div className="capacity-bar-bg"><div className="capacity-bar-fill" style={{ width: `${(collected / maxCapacity) * 100}%` }}></div></div>
      </div>
    </div>
    <div className="hud-center">
      <div className="hud-element-wrapper hud-sort-wrap">
      <button
        className="hud-sort-btn hud-element"
        title={ud('sort_trash=%E0%B9%81%E0%B8%A2%E0%B8%81%E0%B8%82%E0%B8%A2%E0%B8%B0'.split('=')[1])}
        onClick={onSortNow}
        disabled={!canSortNow}
        aria-label={ud('sort_trash=%E0%B9%81%E0%B8%A2%E0%B8%81%E0%B8%82%E0%B8%A2%E0%B8%B0'.split('=')[1])}
        onTouchStart={(e)=>{ e.preventDefault(); e.stopPropagation(); audio.uiClick(); if (canSortNow && onSortNow) onSortNow(); }}
        onMouseDown={(e)=>{ e.preventDefault(); e.stopPropagation(); audio.uiClick(); if (canSortNow && onSortNow) onSortNow(); }}
      >
        <span className="icon">{cp(0x267B)}</span>
        <span className="label">{ud('sort_trash=%E0%B9%81%E0%B8%A2%E0%B8%81%E0%B8%82%E0%B8%A2%E0%B8%B0'.split('=')[1])}</span>
      </button>
      </div>
    </div>
  </div>
);
const ResultsScreen: FC<ResultsScreenProps> = ({ stats, gains, isVisible }) => (
    <div className={`game-overlay ${isVisible ? 'visible' : ''}`}>
        <div className="popup-dialog">
            <h2>{ud('mission_done=%E0%B8%A0%E0%B8%B2%E0%B8%A3%E0%B8%81%E0%B8%B4%E0%B8%88%E0%B9%80%E0%B8%AA%E0%B8%A3%E0%B9%87%E0%B8%88%E0%B8%AA%E0%B8%B4%E0%B9%89%E0%B8%99!'.split('=')[1])}</h2>
            <div className="results-summary">
                <div className="summary-item">
                    <span className="label">{cp(0x2B50)} {ud('total_score=%E0%B8%84%E0%B8%B0%E0%B9%81%E0%B8%99%E0%B8%99%E0%B8%A3%E0%B8%A7%E0%B8%A1'.split('=')[1])}</span>
                    <span className="value">{Math.round(stats.score)}</span>
                </div>
                <div className="summary-item">
                    <span className="label">{cp(0x1F5D1)} {ud('total_collected=%E0%B9%80%E0%B8%81%E0%B9%87%E0%B8%9A%E0%B9%84%E0%B8%94%E0%B9%89%E0%B8%97%E0%B8%B1%E0%B9%89%E0%B8%87%E0%B8%AB%E0%B8%A1%E0%B8%94'.split('=')[1])}</span>
                    <span className="value">{stats.collected}</span>
                </div>
                <div className="summary-item">
                    <span className="label">{cp(0x2705)} {ud('sorted_ok=%E0%B9%81%E0%B8%A2%E0%B8%81%E0%B8%96%E0%B8%B9%E0%B8%81%E0%B8%95%E0%B9%89%E0%B8%AD%E0%B8%87'.split('=')[1])}</span>
                    <span className="value">{stats.sortedCorrectly}</span>
                </div>
                <div className="summary-item">
                    <span className="label">{cp(0x274C)} {ud('sorted_ng=%E0%B9%81%E0%B8%A2%E0%B8%81%E0%B8%9C%E0%B8%B4%E0%B8%94'.split('=')[1])}</span>
                    <span className="value">{stats.incorrect}</span>
                </div>
            </div>
            
            <h3>{ud('rewards=%E0%B8%A3%E0%B8%B2%E0%B8%87%E0%B8%A7%E0%B8%B1%E0%B8%A5%E0%B8%97%E0%B8%B5%E0%B9%88%E0%B9%84%E0%B8%94%E0%B9%89%E0%B8%A3%E0%B8%B1%E0%B8%9A'.split('=')[1])}</h3>
            <div className="results-gains">
                <div className="gains-item">
                    <span className="gains-label">{cp(0x26A1)} XP</span>
                    <span className="gains-value">+{gains.xp}</span>
                </div>
                <div className="gains-item">
                    <span className="gains-label">{cp(0x1FA99)} {ud('coins=%E0%B9%80%E0%B8%AB%E0%B8%A3%E0%B8%B5%E0%B8%A2%E0%B8%8D'.split('=')[1])}</span>
                    <span className="gains-value">+{gains.coins}</span>
                </div>
                <div className="gains-item">
                    <span className="gains-label">{cp(0x1FAA8)} {ud('coral=%E0%B9%80%E0%B8%A8%E0%B8%A9%E0%B8%9B%E0%B8%B0%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%B1%E0%B8%87'.split('=')[1])}</span>
                    <span className="gains-value">+{gains.coralFragments}</span>
                </div>
            </div>

            <div className="popup-buttons">
                <button className="btn-secondary" onClick={() => window.location.reload()}>{ud('play_again=%E0%B9%80%E0%B8%A5%E0%B9%88%E0%B8%99%E0%B8%AD%E0%B8%B5%E0%B8%81%E0%B8%84%E0%B8%A3%E0%B8%B1%E0%B9%89%E0%B8%87'.split('=')[1])}</button>
                <button className="btn-primary" onClick={() => window.location.href = 'menu.html'}>{ud('back_menu=%E0%B8%81%E0%B8%A5%E0%B8%B1%E0%B8%9A%E0%B8%AA%E0%B8%B9%E0%B9%88%E0%B9%80%E0%B8%A1%E0%B8%99%E0%B8%B9'.split('=')[1])}</button>
            </div>
        </div>
    </div>
);

const root = createRoot(document.getElementById('root')!);
root.render(<Game />);





















