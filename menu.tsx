// FIX: Switched to Firebase v8 compatibility imports.
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import { openProfileModal } from './profile';
import { getPlayerProfile, TITLES_DATA } from './profile-data';
import { subscribePlayerProfile } from './firestore';
import { openCustomizationModal } from './customization';
import { openUpgradesModal } from './upgrades';
import { openReefModal } from './reef';
import { openLeaderboardModal } from './leaderboard';
import { openRedeemModal } from './redeem';

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


// --- Page Reveal Animation ---
function revealMenu() {
  const transitionEl = document.getElementById('page-transition');
  if (transitionEl) {
    // Add a small delay to ensure the page is fully rendered before animating
    setTimeout(() => {
      transitionEl.classList.add('is-revealing');
    }, 100); // 100ms delay
  }
}

// --- Auth Management ---
// FIX: Switched to Firebase v8 compatibility auth state change handler.
auth.onAuthStateChanged((user) => {
  if (!user) { window.location.href = 'index.html'; return; }
  // Local bootstrap for instant UI
  const local = getPlayerProfile(user);
  const userNameEl = document.getElementById('user-name');
  const userAvatarEl = document.getElementById('user-avatar') as HTMLDivElement;
  const userLevelBadgeEl = document.getElementById('user-level-badge');
  const userTitleEl = document.getElementById('user-title');

  const render = (p: any) => {
    if (!p) return;
    if (userNameEl) userNameEl.textContent = p.displayName;
    if (userAvatarEl) userAvatarEl.textContent = p.avatarId;
    if (userLevelBadgeEl) userLevelBadgeEl.textContent = `LV ${p.level}`;
    if (userTitleEl) {
      const equippedTitleData = TITLES_DATA.find(t => t.id === p.equippedTitle);
      userTitleEl.textContent = equippedTitleData ? equippedTitleData.name : '';
    }
  };
  render(local);
  // Realtime cloud updates
  try { subscribePlayerProfile(user.uid, (p) => p && render(p)); } catch {}
});

function setupMenuActions() {
    const loginOverlay = document.getElementById('login-required-overlay');
    const loginGoBtn = document.getElementById('login-go-btn');
    const loginCancelBtn = document.getElementById('login-cancel-btn');
    const logoutOverlay = document.getElementById('logout-confirm-overlay');
    const logoutConfirmBtn = document.getElementById('logout-confirm-btn');
    const logoutCancelBtn = document.getElementById('logout-cancel-btn');

    // Ensure only one overlay is visible at a time
    const hideAllOverlays = () => {
        loginOverlay?.classList.add('hidden');
        logoutOverlay?.classList.add('hidden');
    };

    const ensureSignedIn = (next: () => void) => {
        const u = auth.currentUser;
        if (!u) { window.location.href = 'index.html'; return; }
        if (u.isAnonymous) {
            // Show login only, hide any others first
            hideAllOverlays();
            if (loginOverlay) loginOverlay.classList.remove('hidden');
            if (loginGoBtn) loginGoBtn.onclick = () => { window.location.href = 'index.html'; };
            if (loginCancelBtn) loginCancelBtn.onclick = () => { if (loginOverlay) loginOverlay.classList.add('hidden'); };
            return;
        }
        next();
    };
    const logoutHandler = async () => {
        // Show logout confirm only, hide any others first
        hideAllOverlays();
        if (logoutOverlay) logoutOverlay.classList.remove('hidden');
        if (logoutConfirmBtn) logoutConfirmBtn.onclick = async () => {
            try { await auth.signOut(); } catch (e) { console.error(e); }
        };
        if (logoutCancelBtn) logoutCancelBtn.onclick = () => { if (logoutOverlay) logoutOverlay.classList.add('hidden'); };
    };
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', logoutHandler);

    const profileWidget = document.getElementById('user-profile');
    if (profileWidget) {
        profileWidget.addEventListener('click', openProfileModal);
    }

    const customizeBtn = document.querySelector('[data-menu="customize"]');
    if (customizeBtn) { customizeBtn.addEventListener('click', () => ensureSignedIn(openCustomizationModal)); }

    const upgradesBtn = document.querySelector('[data-menu="upgrades"]');
    if (upgradesBtn) { upgradesBtn.addEventListener('click', () => ensureSignedIn(openUpgradesModal)); }

    const reefBtn = document.querySelector('[data-menu="reef"]');
    if (reefBtn) { reefBtn.addEventListener('click', () => ensureSignedIn(openReefModal)); }

    const leaderboardBtn = document.querySelector('[data-menu="leaderboard"]');
    if (leaderboardBtn) { leaderboardBtn.addEventListener('click', () => ensureSignedIn(openLeaderboardModal)); }

    // Close overlays when clicking on the dim background
    loginOverlay?.addEventListener('click', (e) => { if (e.target === loginOverlay) loginOverlay.classList.add('hidden'); });
    logoutOverlay?.addEventListener('click', (e) => { if (e.target === logoutOverlay) logoutOverlay.classList.add('hidden'); });

    const redeemBtn = document.querySelector('[data-menu="redeem"]');
    if (redeemBtn) { redeemBtn.addEventListener('click', () => ensureSignedIn(openRedeemModal)); }

    // DEPART BUTTON LOGIC
    const departBtn = document.getElementById('depart-btn');
    const departOverlay = document.getElementById('depart-overlay');
    const departCloseBtn = document.getElementById('depart-close-btn');
    const confirmDepartBtn = document.getElementById('confirm-depart-btn');

    if (departBtn && departOverlay) {
        departBtn.addEventListener('click', () => {
            departOverlay.classList.remove('hidden');
        });
    }

    const closeDepartModal = () => {
        departOverlay?.classList.add('hidden');
    }

    if(departCloseBtn) {
        departCloseBtn.addEventListener('click', closeDepartModal);
    }
    if(departOverlay) {
        departOverlay.addEventListener('click', (e) => {
            if (e.target === departOverlay) {
                closeDepartModal();
            }
        });
    }

    if(confirmDepartBtn) {
        confirmDepartBtn.addEventListener('click', () => {
            window.location.href = 'game.html';
        });
    }
}


// --- Interactive Canvas Background ---
const canvas = document.getElementById('interactive-canvas') as HTMLCanvasElement;
if (canvas) {
    const ctx = canvas.getContext('2d');
    let particles: Particle[] = [];
    let fish: Fish[] = [];
    let orbitalButtons: OrbitalButton[] = [];
    let bubbles: Bubble[] = [];
    let sonarPings: SonarPing[] = [];

    const mouse = { x: -1000, y: -1000, isDown: false, downStartTime: 0 };

    // --- Event Listeners ---
    canvas.addEventListener('mousedown', (e) => {
        mouse.isDown = true;
        mouse.downStartTime = Date.now();
    });
    canvas.addEventListener('mouseup', (e) => {
        mouse.isDown = false;
        const pressDuration = Date.now() - mouse.downStartTime;

        if (pressDuration < 250) { // It's a click
             const rect = canvas.getBoundingClientRect();
             const clickX = e.clientX - rect.left;
             const clickY = e.clientY - rect.top;

             sonarPings.push(new SonarPing(clickX, clickY));
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
    });

    canvas.addEventListener('mouseleave', () => {
        mouse.x = -1000;
        mouse.y = -1000;
        mouse.isDown = false;
    });

    // --- 3D Parallax Effect ---
    function setupParallax() {
        const layers = document.querySelectorAll('.depth-layer') as NodeListOf<HTMLElement>;
        const depthFactors = [0.1, 0.3, 0.6]; // How much each layer moves

        window.addEventListener('mousemove', (e) => {
            const { clientX, clientY } = e;
            const { innerWidth, innerHeight } = window;
        
            const xOffset = (clientX / innerWidth - 0.5) * 2;
            const yOffset = (clientY / innerHeight - 0.5) * 2;
            
            layers.forEach((layer, index) => {
                const factor = depthFactors[index] || 0.1;
                const xTransform = xOffset * -25 * factor;
                const yTransform = yOffset * -15 * factor;
                layer.style.transform = `translate3d(${xTransform}px, ${yTransform}px, 0)`;
            });
        });
    }


    // --- Classes ---
    class SonarPing {
      x: number; y: number; radius: number; maxRadius: number; speed: number; life: number;
      constructor(x: number, y: number) {
        this.x = x; this.y = y; this.radius = 0;
        this.maxRadius = 150; this.speed = 2; this.life = 1;
      }
      update() { this.radius += this.speed; this.life -= 0.02; }
      draw() {
        if (!ctx) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 246, 255, ${this.life})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    class Bubble {
        x: number; y: number; radius: number; speedY: number; opacity: number; sway: number; swaySpeed: number; brightness: number;
        constructor(x?: number) {
            this.x = x ?? Math.random() * canvas.width;
            this.y = canvas.height + Math.random() * 100;
            this.radius = Math.random() * 3 + 1;
            this.speedY = Math.random() * 1.5 + 0.5;
            this.opacity = this.radius / 4 * 0.7;
            this.sway = Math.random() * Math.PI * 2;
            this.swaySpeed = Math.random() * 0.04 - 0.02;
            this.brightness = 1;
        }
        update() {
            this.y -= this.speedY;
            this.sway += this.swaySpeed;
            this.x += Math.sin(this.sway) * 0.5;

            const dx = this.x - mouse.x;
            const dy = this.y - mouse.y;
            const distanceSq = dx * dx + dy * dy;
            const repulsionRadiusSq = 80 * 80;

            if (distanceSq < repulsionRadiusSq) {
              const distance = Math.sqrt(distanceSq);
              const forceDirectionX = dx / distance;
              const forceDirectionY = dy / distance;
              const force = (80 - distance) / 80;
              this.x += forceDirectionX * force * 1.5;
              this.y += forceDirectionY * force * 1.5;
            }

            if (this.brightness > 1) this.brightness -= 0.05;

            if (this.y < -this.radius) {
                this.y = canvas.height + this.radius;
                this.x = Math.random() * canvas.width;
            }
        }
        draw() {
            if (!ctx) return;
            const finalOpacity = Math.min(this.opacity * this.brightness, 1);
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0, 246, 255, ${finalOpacity * 0.5})`;
            ctx.strokeStyle = `rgba(200, 250, 255, ${finalOpacity})`;
            ctx.lineWidth = 1;
            ctx.fill();
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

    class Fish {
      x: number; y: number; size: number; text: string;
      speedX: number; speedY: number;
      targetSpeedX: number; targetSpeedY: number;
      state: 'swimming' | 'lingering' | 'attracted';
      stateTimer: number;
      direction: 'left' | 'right' = 'right';
      brightness: number;

      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = 15 + Math.random() * 10;
        this.text = ['🐠', '🐟', '🐡'][Math.floor(Math.random() * 3)];
        this.speedX = 0;
        this.speedY = 0;
        this.targetSpeedX = 0;
        this.targetSpeedY = 0;
        this.state = 'lingering';
        this.stateTimer = Math.random() * 100;
        this.direction = Math.random() > 0.5 ? 'right' : 'left';
        this.brightness = 1;
      }
      
      setTargetSpeed(tx: number, ty: number){
          this.targetSpeedX = tx;
          this.targetSpeedY = ty;
      }

      updateState() {
          const isLongPress = mouse.isDown && (Date.now() - mouse.downStartTime > 250);

          if (isLongPress) {
              this.state = 'attracted';
              const dx = mouse.x - this.x;
              const dy = mouse.y - this.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist > this.size * 1.5) { 
                  this.setTargetSpeed(dx / dist * 2.5, dy / dist * 2.5);
              } else {
                  this.setTargetSpeed(0, 0); // Linger/nibble when close
              }
              return; 
          }
          
          if (this.state === 'attracted') { // No longer a long press, go back to normal
              this.state = 'lingering';
              this.stateTimer = 50;
          }

          this.stateTimer--;
          if (this.stateTimer <= 0) {
              if (this.state === 'lingering') {
                  this.state = 'swimming';
                  const angle = Math.random() * Math.PI * 2;
                  this.setTargetSpeed(
                      Math.cos(angle) * (0.8 + Math.random() * 0.5),
                      Math.sin(angle) * (0.8 + Math.random() * 0.5)
                  );
                  this.stateTimer = 100 + Math.random() * 200;
              } else {
                  this.state = 'lingering';
                  this.setTargetSpeed(0, 0);
                  this.stateTimer = 50 + Math.random() * 100;
              }
          }
      }

      update() {
          this.updateState();
          if (this.brightness > 1) this.brightness -= 0.05;

          const easing = this.state === 'attracted' ? 0.08 : 0.05;
          this.speedX += (this.targetSpeedX - this.speedX) * easing;
          this.speedY += (this.targetSpeedY - this.speedY) * easing;
          
          if (this.direction === 'right' && this.speedX < -0.01) {
            this.direction = 'left';
          } else if (this.direction === 'left' && this.speedX > 0.01) {
            this.direction = 'right';
          }
          
          this.x += this.speedX;
          this.y += this.speedY;
          
          // Repel from mouse, but only if not being attracted
          const distSqToMouse = (this.x - mouse.x)**2 + (this.y - mouse.y)**2;
          if(this.state !== 'attracted' && distSqToMouse < 100 * 100) { 
                const dist = Math.sqrt(distSqToMouse);
                const force = 1 - dist / 100;
                this.x += (this.x - mouse.x) / dist * force * 1.5;
                this.y += (this.y - mouse.y) / dist * force * 1.5;
          }

          if (this.x < this.size) { this.x = this.size; this.setTargetSpeed(Math.abs(this.targetSpeedX) || 0.5, this.targetSpeedY); }
          if (this.x > canvas.width - this.size) { this.x = canvas.width - this.size; this.setTargetSpeed(-Math.abs(this.targetSpeedX) || -0.5, this.targetSpeedY); }
          if (this.y < this.size) { this.y = this.size; this.setTargetSpeed(this.targetSpeedX, Math.abs(this.targetSpeedY) || 0.5); }
          if (this.y > canvas.height - this.size) { this.y = canvas.height - this.size; this.setTargetSpeed(this.targetSpeedX, -Math.abs(this.targetSpeedY) || -0.5); }
      }

      draw() {
          if (!ctx) return;
          ctx.font = `${this.size}px sans-serif`;
          ctx.save();
          ctx.translate(this.x, this.y);
          
          ctx.shadowColor = 'rgba(127, 255, 255, 0.8)';
          ctx.shadowBlur = this.brightness > 1 ? (this.brightness - 1) * 15 : 0;

          if (this.direction === 'left') {
              ctx.scale(-1, 1);
          }
          ctx.fillText(this.text, -this.size / 2, this.size / 2);
          ctx.restore();
      }
    }

    class OrbitalButton {
        el: HTMLElement;
        tendrilEl: HTMLElement;
        x: number; y: number;
        vx: number; vy: number;
        baseAngle: number;
        radiusX: number;
        radiusY: number;
        isHovered: boolean = false;
        rotationSpeed: number;

        constructor(el: HTMLElement, index: number, total: number, containerWidth: number, containerHeight: number) {
            this.el = el;
            this.tendrilEl = el.querySelector('.tendril') as HTMLElement;
            
            const angleStep = (Math.PI * 2) / total;
            const angleOffset = -Math.PI / 2;
            
            this.baseAngle = angleOffset + (index * angleStep);
            this.rotationSpeed = 0.0003;
            
            const isLandscapeMobile = containerHeight <= 500 && containerWidth > containerHeight;

            if (isLandscapeMobile) {
                // Landscape mobile layout: create a horizontal ellipse
                const orbitalButtonSize = 80; 
                const centerButtonSize = 100;
                // A small visual buffer to keep buttons from touching the edges
                const padding = 15;

                // The horizontal radius is based on the full container width.
                this.radiusX = (containerWidth / 2) - (centerButtonSize / 2) - (orbitalButtonSize / 2) - padding;
                
                // For the vertical radius, we use the full container height and subtract the known
                // heights of the header and footer to get the actual available space.
                const topZoneHeight = 45; // Corresponds to padding-top in CSS
                const bottomZoneHeight = 55; // Corresponds to padding-bottom in CSS
                const availableHeight = containerHeight - topZoneHeight - bottomZoneHeight;
                this.radiusY = (availableHeight / 2) - (orbitalButtonSize / 2) - padding;

            } else {
                // Original logic for portrait/desktop, now using container dimensions
                const safeDimension = Math.min(containerWidth, containerHeight);
                let radius;
                if (containerWidth <= 768) {
                    radius = safeDimension * 0.35;
                } else {
                    radius = safeDimension * 0.28;
                }
                this.radiusX = radius;
                this.radiusY = radius;
            }

            this.x = Math.cos(this.baseAngle) * this.radiusX;
            this.y = Math.sin(this.baseAngle) * this.radiusY;
            this.vx = 0;
            this.vy = 0;

            this.el.addEventListener('mouseenter', () => this.isHovered = true);
            this.el.addEventListener('mouseleave', () => this.isHovered = false);
        }

        update() {
            if (this.isHovered) {
                const tendrilAngle = Math.atan2(this.y, this.x) + Math.PI / 2;
                const tendrilLength = Math.sqrt(this.x * this.x + this.y * this.y);
                this.tendrilEl.style.height = `${tendrilLength}px`;
                this.tendrilEl.style.transform = `rotate(${tendrilAngle}rad)`;
                return; 
            }

            this.baseAngle += this.rotationSpeed;

            const targetX = Math.cos(this.baseAngle) * this.radiusX;
            const targetY = Math.sin(this.baseAngle) * this.radiusY;

            const returnForceX = (targetX - this.x) * 0.01;
            const returnForceY = (targetY - this.y) * 0.01;

            this.vx += returnForceX;
            this.vy += returnForceY;

            const dx = this.x + canvas.width / 2 - mouse.x;
            const dy = this.y + canvas.height / 2 - mouse.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < 150 * 150) {
                const dist = Math.sqrt(distSq);
                const force = (1 - dist / 150) * 0.5;
                this.vx += (dx / dist) * force;
                this.vy += (dy / dist) * force;
            }

            this.vx *= 0.95; // Damping
            this.vy *= 0.95;

            this.x += this.vx;
            this.y += this.vy;

            this.el.style.transform = `translate(-50%, -50%) translate(${this.x}px, ${this.y}px)`;
        }
    }


    function initCanvas() {
        if (!canvas) return;
        const parent = document.getElementById('depth-container') as HTMLElement;
        canvas.width = parent.offsetWidth;
        canvas.height = parent.offsetHeight;

        particles = [];
        const particleCount = canvas.width < 768 ? 50 : 100;
        for (let i = 0; i < particleCount; i++) particles.push(new Particle());

        fish = [];
        const fishCount = canvas.width < 768 ? 7 : 15;
        for (let i = 0; i < fishCount; i++) fish.push(new Fish());

        bubbles = [];
        const bubbleCount = canvas.width < 768 ? 10: 20;
        for (let i = 0; i < bubbleCount; i++) bubbles.push(new Bubble());

        // Measure the main UI container for an accurate viewport size
        const uiContainerEl = document.getElementById('menu-ui') as HTMLElement;
        const containerWidth = uiContainerEl ? uiContainerEl.offsetWidth : canvas.width;
        const containerHeight = uiContainerEl ? uiContainerEl.offsetHeight : canvas.height;

        orbitalButtons = [];
        const orbitalButtonElements = document.querySelectorAll('.orbital-button-wrapper');
        orbitalButtonElements.forEach((el, i) => {
            orbitalButtons.push(new OrbitalButton(el as HTMLElement, i, orbitalButtonElements.length, containerWidth, containerHeight));
        });
    }

    function animate() {
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (let i = sonarPings.length - 1; i >= 0; i--) {
            const ping = sonarPings[i];
            ping.update();
            ping.draw();

            const pingRadiusSq = ping.radius * ping.radius;
            const allEntities = [...particles, ...fish, ...bubbles];
            allEntities.forEach(p => {
              const dx = p.x - ping.x;
              const dy = p.y - ping.y;
              const distanceSq = dx * dx + dy * dy;
              if (Math.abs(distanceSq - pingRadiusSq) < 600) { // Increased tolerance
                p.brightness = 3; 
              }
            });

            if (ping.life <= 0) {
              sonarPings.splice(i, 1);
            }
        }

        // Draw attractor lure if holding mouse down
        if (mouse.isDown && (Date.now() - mouse.downStartTime > 250)) {
            ctx.beginPath();
            const gradient = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 30);
            gradient.addColorStop(0, 'rgba(127, 255, 255, 0.4)');
            gradient.addColorStop(1, 'rgba(127, 255, 255, 0)');
            ctx.fillStyle = gradient;
            ctx.arc(mouse.x, mouse.y, 30, 0, Math.PI * 2);
            ctx.fill();
        }

        particles.forEach(p => { p.update(); p.draw(); });
        bubbles.forEach(b => { b.update(); b.draw(); });
        fish.forEach(f => { f.update(); f.draw(); });
        orbitalButtons.forEach(b => b.update());

        requestAnimationFrame(animate);
    }

    function initialize() {
        initCanvas();
        animate();
        setupMenuActions();
        setupParallax();
        revealMenu(); // Trigger the reveal animation
        window.addEventListener('resize', initCanvas);
    }

    initialize();
}
window.addEventListener('orientationchange', () => window.dispatchEvent(new Event('resize')));
