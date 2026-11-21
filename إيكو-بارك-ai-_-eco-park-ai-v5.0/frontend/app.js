// Eco-Park AI v5.0 Standalone Web Audio Industrial Siren & Voice Safety Fallback
const bessRange = document.getElementById('bessRange');
const bessVal = document.getElementById('bessVal');
const testAlarmBtn = document.getElementById('testAlarmBtn');

function playStandaloneIndustrialSiren() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
  const now = ctx.currentTime;
  for (let i = 0; i < 3; i++) {
    const t0 = now + i * 0.72;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(760, t0);
    osc.frequency.exponentialRampToValueAtTime(500, t0 + 0.56);
    gain.gain.setValueAtTime(0.001, t0);
    gain.gain.linearRampToValueAtTime(0.22, t0 + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.58);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.6);
  }
}

function triggerBessCheck(level) {
  if (bessVal) bessVal.textContent = `${level}%`;
  if (level < 20) {
    playStandaloneIndustrialSiren();
    if ('speechSynthesis' in window) {
      const msg = new SpeechSynthesisUtterance(
        `تحذير أمان حرج: انخفض شحن بطاريات BESS إلى ${level} بالمئة.`
      );
      msg.lang = 'ar-SA';
      setTimeout(() => window.speechSynthesis.speak(msg), 1400);
    }
  }
}

if (bessRange) {
  bessRange.addEventListener('input', (e) => triggerBessCheck(Number(e.target.value)));
}
if (testAlarmBtn) {
  testAlarmBtn.addEventListener('click', () => {
    if (bessRange) bessRange.value = '16';
    triggerBessCheck(16);
  });
}
