import audio from './audio';

const overlay = document.getElementById('settings-overlay');
const closeBtn = document.getElementById('settings-close-btn');

const musicRange = document.getElementById('settings-vol-music') as HTMLInputElement | null;
const sfxRange = document.getElementById('settings-vol-sfx') as HTMLInputElement | null;
const uiRange = document.getElementById('settings-vol-ui') as HTMLInputElement | null;
const vm = document.getElementById('settings-vm');
const vs = document.getElementById('settings-vs');
const vu = document.getElementById('settings-vu');

function sync() {
  if (!musicRange || !sfxRange || !uiRange || !vm || !vs || !vu) return;
  musicRange.value = String(audio.getVolume('music'));
  sfxRange.value = String(audio.getVolume('sfx'));
  uiRange.value = String(audio.getVolume('ui'));
  vm.textContent = String(Math.round(audio.getVolume('music') * 100));
  vs.textContent = String(Math.round(audio.getVolume('sfx') * 100));
  vu.textContent = String(Math.round(audio.getVolume('ui') * 100));
}

function wire() {
  if (!overlay) return;
  if (closeBtn) closeBtn.addEventListener('click', closeSettingsModal);
  (overlay as HTMLElement).addEventListener('click', (e) => { if (e.target === overlay) closeSettingsModal(); });
  if (musicRange) musicRange.addEventListener('input', (e)=>{ audio.setVolume('music', Number((e.target as HTMLInputElement).value)); sync(); });
  if (sfxRange) sfxRange.addEventListener('input', (e)=>{ audio.setVolume('sfx', Number((e.target as HTMLInputElement).value)); sync(); });
  if (uiRange) uiRange.addEventListener('input', (e)=>{ audio.setVolume('ui', Number((e.target as HTMLInputElement).value)); sync(); });
}

export function openSettingsModal() {
  if (!overlay) return;
  sync();
  overlay.classList.remove('hidden');
}

export function closeSettingsModal() {
  overlay?.classList.add('hidden');
}

// ensure DOM wiring
wire();

