// FIX: The error "Module has no exported member 'initializeApp'" suggests an older Firebase version is in use.
// Switching to the v8 compatibility syntax to resolve this.
// FIX: Switched to Firebase v8 compatibility imports.
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import { ensurePlayerProfile } from './firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAAXqmfSy_q_Suh4td5PeLz-ZsuICf-KwI",
  authDomain: "cleanwater-quest.firebaseapp.com",
  projectId: "cleanwater-quest",
  storageBucket: "cleanwater-quest.firebasestorage.app",
  messagingSenderId: "331042617564",
  appId: "1:331042617564:web:b00eeaf03d228ae4569c19",
  measurementId: "G-3CZGPRNZH8"
};

// Initialize Firebase
// FIX: Switched to Firebase v8 compatibility initialization.
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();

const googleLoginBtn = document.getElementById('google-login');
const guestLoginBtn = document.getElementById('guest-login');

// --- Page Transition Logic ---
function transitionToMenu() {
  const transitionEl = document.getElementById('page-transition');
  const appContainer = document.getElementById('app-container');

  if (transitionEl && appContainer) {
    // Start the wave animation
    transitionEl.classList.add('is-active');
    
    // The new SVG animation is 1.8s long
    setTimeout(() => {
      window.location.href = 'menu.html';
    }, 1800); 
  } else {
    // Fallback if elements aren't found
    window.location.href = 'menu.html';
  }
}

// --- Firebase Authentication ---
async function initializeAuth() {
  try {
    // FIX: Switched to Firebase v8 compatibility persistence syntax.
    await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
  } catch (error) {
    console.error("Firebase: Could not set auth persistence.", error);
  }

  if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', async () => {
      try {
        // FIX: Switched to Firebase v8 compatibility sign-in syntax.
        await auth.signInWithPopup(googleProvider);
        const user = auth.currentUser;
        if (user) await ensurePlayerProfile(user.uid, { displayName: user.displayName || 'SeaHero' });
        // On success, trigger transition instead of immediate redirect
        transitionToMenu();
      } catch (error) {
        console.error('Error during Google sign-in:', error);
        alert('Failed to sign in with Google. Please try again.');
      }
    });
  }
  
  if (guestLoginBtn) {
    guestLoginBtn.addEventListener('click', async () => {
      try {
        // FIX: Switched to Firebase v8 compatibility sign-in syntax.
        await auth.signInAnonymously();
        const user = auth.currentUser;
        if (user) await ensurePlayerProfile(user.uid, { displayName: 'Guest' });
        // On success, trigger transition instead of immediate redirect
        transitionToMenu();
      } catch (error) {
        console.error('Error during anonymous sign-in:', error);
        alert('Failed to sign in as a guest. Please try again.');
      }
    });
  }
}


// --- Holographic & Interactive Title (Now with Word Wrapping) ---
const gameTitle = document.querySelector('.game-title');
if (gameTitle && gameTitle.textContent) {
  const words = gameTitle.textContent.trim().split(' ');
  gameTitle.innerHTML = '';
  let letterIndex = 0;

  words.forEach(wordStr => {
    const wordSpan = document.createElement('span');
    wordSpan.className = 'word';

    wordStr.split('').forEach((char) => {
      const span = document.createElement('span');
      span.textContent = char;
      
      span.style.setProperty('--reveal-delay', `${letterIndex * 0.05}s`);
      span.style.setProperty('--undulate-delay', `${letterIndex * 0.1}s`);

      // "Glowing Touch" hover effect
      span.addEventListener('mouseenter', () => {
        span.classList.add('hover');
      });
      span.addEventListener('animationend', () => {
          span.classList.remove('hover');
      });

      wordSpan.appendChild(span);
      letterIndex++;
    });

    gameTitle.appendChild(wordSpan);
  });
}


// --- Interactive Spotlight Button Effect ---
const loginButtons = document.querySelectorAll('.login-button');
loginButtons.forEach(button => {
  button.addEventListener('mousemove', (e: MouseEvent) => {
    const rect = (button as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    (button as HTMLElement).style.setProperty('--mouse-x', `${x}px`);
    (button as HTMLElement).style.setProperty('--mouse-y', `${y}px`);
  });
});

// --- Bioluminescent Particle & Sonar Ping Effect ---
const canvas = document.getElementById('bioluminescent-canvas') as HTMLCanvasElement;
if (canvas) {
    const ctx = canvas.getContext('2d');
    let particles: Particle[] = [];
    let sonarPings: SonarPing[] = [];
    const mouse = {
        x: undefined as number | undefined,
        y: undefined as number | undefined,
    };

    // --- Event Listeners ---
    canvas.addEventListener('mousemove', (event) => {
        const rect = canvas.getBoundingClientRect();
        mouse.x = event.clientX - rect.left;
        mouse.y = event.clientY - rect.top;
    });

    canvas.addEventListener('mouseleave', () => {
        mouse.x = undefined;
        mouse.y = undefined;
    });

    canvas.addEventListener('click', (event) => {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        sonarPings.push(new SonarPing(x, y));
    });

    // --- Classes ---
    class SonarPing {
      x: number;
      y: number;
      radius: number;
      maxRadius: number;
      speed: number;
      life: number;

      constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
        this.radius = 0;
        this.maxRadius = 150;
        this.speed = 2;
        this.life = 1;
      }

      update() {
        this.radius += this.speed;
        this.life -= 0.02;
      }

      draw() {
        if (!ctx) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 246, 255, ${this.life})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    class Particle {
      x: number;
      y: number;
      radius: number;
      speed: number;
      opacity: number;
      opacityDirection: number;
      sway: number;
      swaySpeed: number;
      brightness: number;

      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.radius = Math.random() * 2 + 0.5;
        this.speed = Math.random() * 0.5 + 0.2;
        this.opacity = Math.random() * 0.5;
        this.opacityDirection = 1;
        this.sway = Math.random() * Math.PI * 2;
        this.swaySpeed = Math.random() * 0.01 + 0.005;
        this.brightness = 1;
      }

      update() {
        this.y -= this.speed;
        this.sway += this.swaySpeed;
        this.x += Math.sin(this.sway) * 0.2;

        if (mouse.x !== undefined && mouse.y !== undefined) {
          const dx = this.x - mouse.x;
          const dy = this.y - mouse.y;
          const distanceSq = dx * dx + dy * dy;
          const repulsionRadiusSq = 100 * 100;

          if (distanceSq < repulsionRadiusSq) {
            const distance = Math.sqrt(distanceSq);
            const forceDirectionX = dx / distance;
            const forceDirectionY = dy / distance;
            const force = (100 - distance) / 100;
            const maxRepulsion = 3;
            this.x += forceDirectionX * force * maxRepulsion;
            this.y += forceDirectionY * force * maxRepulsion;
          }
        }

        if (this.brightness > 1) {
          this.brightness -= 0.05;
        } else {
          this.brightness = 1;
        }

        if (this.y < -this.radius) {
          this.y = canvas.height + this.radius;
          this.x = Math.random() * canvas.width;
        }
        
        if (this.opacity > 0.7 || this.opacity < 0.1) {
          this.opacityDirection *= -1;
        }
        this.opacity += 0.005 * this.opacityDirection;
      }

      draw() {
        if (!ctx) return;
        const finalOpacity = Math.min(this.opacity * this.brightness, 1);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 246, 255, ${finalOpacity})`;
        ctx.fill();
      }
    }

    function initCanvas() {
        if(!canvas) return;
      const parent = canvas.parentElement as HTMLElement;
      canvas.width = parent.offsetWidth;
      canvas.height = parent.offsetHeight;
      particles = [];
      
      const particleCount = canvas.width < 768 ? 75 : 150;
      for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
      }
    }

    function animate() {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      for (let i = sonarPings.length - 1; i >= 0; i--) {
        const ping = sonarPings[i];
        ping.update();
        ping.draw();

        const pingRadiusSq = ping.radius * ping.radius;
        particles.forEach(p => {
          const dx = p.x - ping.x;
          const dy = p.y - ping.y;
          const distanceSq = dx * dx + dy * dy;
          if (Math.abs(distanceSq - pingRadiusSq) < 500) {
            p.brightness = 3; 
          }
        });

        if (ping.life <= 0) {
          sonarPings.splice(i, 1);
        }
      }

      particles.forEach(p => {
        p.update();
        p.draw();
      });
      
      requestAnimationFrame(animate);
    }

    initCanvas();
    animate();
    window.addEventListener('resize', initCanvas);
}

// --- Parallax Effect for Desktop ---
const underwaterBg = document.querySelector('.underwater-bg') as HTMLElement;
if (underwaterBg) {
  const isMobile = window.innerWidth <= 1024;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!isMobile && !prefersReducedMotion) {
    document.addEventListener('mousemove', (e) => {
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;
  
      const xOffset = (clientX / innerWidth - 0.5) * 2;
      const yOffset = (clientY / innerHeight - 0.5) * 2;
      
      const xTransform = xOffset * -20;
      const yTransform = yOffset * -10;
  
      requestAnimationFrame(() => {
          underwaterBg.style.transform = `translate(${xTransform}px, ${yTransform}px)`;
      });
    });
  }
}

// Initialize authentication
initializeAuth();
window.addEventListener('orientationchange', () => window.dispatchEvent(new Event('resize')));
