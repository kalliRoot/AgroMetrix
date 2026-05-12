// ═══════════════════════════════════════════════════════════════
//  AgroMetrix Radar — audio.js v2
//  Sons sintetizados via Web Audio API + vibração mobile
// ═══════════════════════════════════════════════════════════════

class AudioManager {
  constructor() {
    this.audioCtx = null;
    this.enabled = true;
    this.initialized = false;
    this._loopInterval = null;
  }

  // Inicializa após interação do usuário (obrigatório no mobile)
  async init() {
    if (this.initialized) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) { console.warn('[Audio] Web Audio API não suportada'); return; }
      this.audioCtx = new Ctx();
      // Resume se suspenso (política de autoplay)
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }
      this.initialized = true;
      console.log('[Audio] Inicializado ✅');
    } catch(e) {
      console.warn('[Audio] Falha ao inicializar:', e);
    }
  }

  // Garante contexto ativo
  async _ensureCtx() {
    if (!this.audioCtx) await this.init();
    if (!this.audioCtx) return false;
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
    return this.audioCtx.state === 'running';
  }

  // Toca sequência de tons
  async _playSequence(freqs, durs, gain = 0.35) {
    if (!this.enabled) return;
    if (!await this._ensureCtx()) return;

    const ctx = this.audioCtx;
    let t = ctx.currentTime + 0.05;

    freqs.forEach((freq, i) => {
      const dur = durs[i] || 0.2;
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.connect(g);
      g.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);

      osc.start(t);
      osc.stop(t + dur);
      t += dur;
    });

    // Vibração no mobile
    if (navigator.vibrate) {
      navigator.vibrate(freqs.map(() => 80));
    }
  }

  // Sons definidos
  async play(name) {
    if (!this.enabled) return;

    const sounds = {
      // Novo pedido/chamado (3 beeps ascendentes)
      request: () => this._playSequence(
        [523, 659, 784],
        [0.18, 0.18, 0.28]
      ),
      // SOS (urgente - 6 beeps alternados)
      sos: () => this._playSequence(
        [880, 660, 880, 660, 880, 440],
        [0.12, 0.08, 0.12, 0.08, 0.12, 0.25],
        0.45
      ),
      // Aceito (acorde positivo)
      accept: () => this._playSequence(
        [523, 659, 784, 1047],
        [0.1, 0.1, 0.1, 0.35],
        0.3
      ),
      // Mensagem recebida (2 tons suaves)
      message: () => this._playSequence(
        [880, 1100],
        [0.08, 0.12],
        0.25
      ),
      // Operação iniciada
      startOperation: () => this._playSequence(
        [262, 330, 392, 523],
        [0.15, 0.15, 0.15, 0.35],
        0.3
      ),
      // Notificação genérica
      notification: () => this._playSequence(
        [659, 880],
        [0.1, 0.2],
        0.25
      ),
    };

    if (sounds[name]) {
      await sounds[name]();
    } else {
      console.warn('[Audio] Som desconhecido:', name);
    }
  }

  // Loop de alerta até stopLoop() ou timeout
  startLoop(name, intervalMs = 3000, maxDurationMs = 30000) {
    this.stopLoop();
    this.play(name);
    this._loopInterval = setInterval(() => this.play(name), intervalMs);
    if (maxDurationMs > 0) {
      setTimeout(() => this.stopLoop(), maxDurationMs);
    }
  }

  stopLoop() {
    if (this._loopInterval) {
      clearInterval(this._loopInterval);
      this._loopInterval = null;
    }
  }

  enable()  { this.enabled = true;  }
  disable() { this.enabled = false; }
  toggle()  { this.enabled = !this.enabled; }
}

export const audio = new AudioManager();

// Auto-init na primeira interação (mobile-safe)
if (typeof document !== 'undefined') {
  const tryInit = async () => {
    await audio.init();
    document.removeEventListener('touchstart', tryInit);
    document.removeEventListener('click', tryInit);
  };
  document.addEventListener('touchstart', tryInit, { once: true });
  document.addEventListener('click', tryInit, { once: true });
}
