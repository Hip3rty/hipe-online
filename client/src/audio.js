// Áudio 100% sintetizado (WebAudio): efeitos sonoros e música ambiente chiptune por região.
// Nada de arquivos de áudio: leve para celulares e original.
let ac = null, master = null, sfxGain = null, musicGain = null;
const settings = { music: localStorage.getItem('hipe.music') !== '0', sfx: localStorage.getItem('hipe.sfx') !== '0' };

export function audioSettings() {
  return settings;
}

export function unlockAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  ac = new Ctx();
  master = ac.createGain(); master.gain.value = 0.8; master.connect(ac.destination);
  sfxGain = ac.createGain(); sfxGain.gain.value = settings.sfx ? 0.55 : 0; sfxGain.connect(master);
  musicGain = ac.createGain(); musicGain.gain.value = settings.music ? 0.18 : 0; musicGain.connect(master);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) ac.suspend(); else ac.resume();
  });
}

export function setMusic(on) {
  settings.music = on;
  localStorage.setItem('hipe.music', on ? '1' : '0');
  if (musicGain) musicGain.gain.value = on ? 0.18 : 0;
}
export function setSfx(on) {
  settings.sfx = on;
  localStorage.setItem('hipe.sfx', on ? '1' : '0');
  if (sfxGain) sfxGain.gain.value = on ? 0.55 : 0;
}

function tone(freq, dur, type = 'square', vol = 0.3, slide = 0, delay = 0, dest = sfxGain) {
  if (!ac) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + dur + 0.02);
}

let noiseBuf = null;
function noise(dur, vol = 0.3, filterFreq = 2000, type = 'lowpass', delay = 0) {
  if (!ac) return;
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = ac.currentTime + delay;
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = filterFreq;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g); g.connect(sfxGain);
  src.start(t); src.stop(t + dur);
}

const last = {};
export function sfx(name) {
  if (!ac || !settings.sfx) return;
  const now = performance.now();
  if (last[name] && now - last[name] < 40) return; // evita empilhar o mesmo som
  last[name] = now;
  switch (name) {
    case 'melee': noise(0.12, 0.35, 1800, 'bandpass'); tone(160, 0.08, 'square', 0.12, -60); break;
    case 'distance': case 'arrow': noise(0.15, 0.25, 4000, 'highpass'); tone(900, 0.1, 'triangle', 0.08, -500); break;
    case 'magic': case 'bolt': tone(400, 0.25, 'sine', 0.2, 600); tone(800, 0.2, 'triangle', 0.08, 400, 0.03); break;
    case 'fire': case 'fireball': noise(0.4, 0.35, 900); tone(120, 0.3, 'sawtooth', 0.1, -60); break;
    case 'whirl': noise(0.3, 0.3, 1200, 'bandpass'); tone(300, 0.3, 'triangle', 0.1, 300); break;
    case 'pierce': noise(0.1, 0.3, 5000, 'highpass'); tone(1200, 0.15, 'square', 0.08, -800); break;
    case 'rain': for (let i = 0; i < 5; i++) noise(0.08, 0.15, 5000, 'highpass', i * 0.06); break;
    case 'heal': [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'sine', 0.12, 0, i * 0.06)); break;
    case 'warcry': tone(110, 0.5, 'sawtooth', 0.2, 80); noise(0.4, 0.15, 700); break;
    case 'hit': noise(0.08, 0.3, 1500); tone(110, 0.08, 'square', 0.15, -40); break;
    case 'hurt': tone(220, 0.18, 'square', 0.18, -140); break;
    case 'crit': noise(0.15, 0.4, 2500); tone(80, 0.2, 'square', 0.2, -30); break;
    case 'die': tone(300, 0.5, 'square', 0.15, -260); break;
    case 'coin': tone(988, 0.08, 'square', 0.12); tone(1319, 0.18, 'square', 0.12, 0, 0.07); break;
    case 'pickup': tone(660, 0.07, 'square', 0.1); tone(990, 0.1, 'square', 0.1, 0, 0.05); break;
    case 'potion': for (let i = 0; i < 4; i++) tone(500 + Math.random() * 500, 0.06, 'sine', 0.12, 200, i * 0.05); break;
    case 'equip': tone(1400, 0.05, 'square', 0.08); noise(0.08, 0.2, 6000, 'highpass', 0.02); break;
    case 'click': tone(1100, 0.03, 'square', 0.06); break;
    case 'error': tone(180, 0.12, 'square', 0.12); tone(140, 0.15, 'square', 0.12, 0, 0.1); break;
    case 'levelup': [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.3, 'square', 0.12, 0, i * 0.09)); break;
    case 'quest': [784, 988, 1175].forEach((f, i) => tone(f, 0.2, 'triangle', 0.15, 0, i * 0.1)); break;
    case 'chat': tone(1500, 0.04, 'sine', 0.06); break;
    // vozes de monstros
    case 'squish': tone(200, 0.15, 'sine', 0.2, 180); break;
    case 'growl': tone(90, 0.3, 'sawtooth', 0.15, -20); noise(0.25, 0.1, 400); break;
    case 'hiss': noise(0.3, 0.2, 3500, 'highpass'); break;
    case 'goblin': tone(700, 0.06, 'square', 0.1, 200); tone(900, 0.06, 'square', 0.1, -200, 0.07); break;
    case 'rattle': for (let i = 0; i < 4; i++) noise(0.03, 0.25, 3000, 'bandpass', i * 0.05); break;
    case 'groan': tone(110, 0.5, 'sawtooth', 0.12, -40); break;
    case 'roar': tone(70, 0.7, 'sawtooth', 0.2, -30); noise(0.6, 0.2, 600); break;
    case 'cackle': for (let i = 0; i < 4; i++) tone(600 + i * 80, 0.05, 'square', 0.08, 0, i * 0.06); break;
  }
}

// ---------- música procedural ----------
const THEMES = {
  town: { bpm: 92, scale: [0, 2, 4, 7, 9], root: 60, wave: 'triangle', bass: 'triangle' },
  field: { bpm: 112, scale: [0, 2, 4, 5, 7, 9, 11], root: 62, wave: 'square', bass: 'triangle' },
  desert: { bpm: 100, scale: [0, 1, 4, 5, 7, 8, 10], root: 57, wave: 'square', bass: 'triangle' },
  cave: { bpm: 76, scale: [0, 2, 3, 5, 7, 8, 10], root: 57, wave: 'triangle', bass: 'sine' },
  danger: { bpm: 128, scale: [0, 1, 3, 5, 7, 8, 10], root: 55, wave: 'sawtooth', bass: 'square' },
};
let current = null, timer = null, step = 0, pattern = null;
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

function makePattern(th, seed) {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const mel = [], bass = [];
  const prog = [0, 3, 4, 0, 5, 3, 4, 4].map((d) => th.scale[d % th.scale.length]);
  for (let bar = 0; bar < 8; bar++) {
    for (let i = 0; i < 8; i++) {
      const play = r() < (i % 2 === 0 ? 0.8 : 0.45);
      const deg = Math.floor(r() * th.scale.length);
      mel.push(play ? th.root + 12 + th.scale[deg] + (r() < 0.15 ? 12 : 0) : null);
      bass.push(i % 4 === 0 ? th.root - 12 + prog[bar] : i % 4 === 2 && r() < 0.5 ? th.root - 12 + prog[bar] + 7 : null);
    }
  }
  return { mel, bass };
}

export function playMusic(theme) {
  if (!ac || current === theme) return;
  current = theme;
  const th = THEMES[theme] || THEMES.field;
  pattern = makePattern(th, theme.length * 7919 + 13);
  step = 0;
  clearInterval(timer);
  const stepDur = 60 / th.bpm / 2;
  timer = setInterval(() => {
    if (!settings.music || !ac || ac.state !== 'running') return;
    const i = step % pattern.mel.length;
    if (pattern.mel[i]) tone(midi(pattern.mel[i]), stepDur * 1.6, th.wave, 0.08, 0, 0, musicGain);
    if (pattern.bass[i]) tone(midi(pattern.bass[i]), stepDur * 3, th.bass, 0.16, 0, 0, musicGain);
    if (theme === 'danger' || theme === 'field') if (i % 4 === 0) { /* bumbo suave */ tone(60, 0.12, 'sine', 0.25, -30, 0, musicGain); }
    step++;
  }, stepDur * 1000);
}
