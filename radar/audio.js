// ═══════════════════════════════════════════════════════════════
//  AgroMetrix Radar — Sistema de Áudio
// ═══════════════════════════════════════════════════════════════

class AudioManager {
  constructor() {
    this.sounds = {};
    this.enabled = true;
    this.initialized = false;
    this.audioCtx = null;
  }

  async init() {
    if (this.initialized) return;
    
    this.createSynthetizedSounds();
    this.initialized = true;
  }

  createSynthetizedSounds() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      console.warn('Web Audio API não suportada');
      return;
    }

    this.audioCtx = new AudioContext();
    
    // Som de chamado (similar ao Uber)
    this.sounds.request = () => {
      this.playBeepSequence([523.25, 659.25, 783.99], [0.2, 0.2, 0.3]);
    };
    
    // Som de SOS (urgente)
    this.sounds.sos = () => {
      this.playBeepSequence([880, 880, 880, 440, 440, 440], [0.15, 0.15, 0.15, 0.15, 0.15, 0.3]);
    };
    
    // Som de aceite
    this.sounds.accept = () => {
      this.playBeepSequence([523.25, 659.25, 783.99, 1046.50], [0.1, 0.1, 0.1, 0.4]);
    };
    
    // Som de operação iniciada
    this.sounds.startOperation = () => {
      this.playBeepSequence([261.63, 329.63, 392.00], [0.2, 0.2, 0.5]);
    };
    
    // Som de mensagem
    this.sounds.message = () => {
      this.playBeepSequence([440, 440], [0.05, 0.05]);
    };
    
    // Som de notificação
    this.sounds.notification = () => {
      this.playBeepSequence([523.25, 523.25], [0.1, 0.1]);
    };
  }

  playBeepSequence(frequencies, durations) {
    if (!this.enabled || !this.audioCtx) return;
    
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    
    let time = this.audioCtx.currentTime;
    
    for (let i = 0; i < frequencies.length; i++) {
      const oscillator = this.audioCtx.createOscillator();
      const gainNode = this.audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioCtx.destination);
      
      oscillator.frequency.value = frequencies[i];
      gainNode.gain.value = 0.3;
      
      oscillator.start(time);
      gainNode.gain.exponentialRampToValueAtTime(0.00001, time + (durations[i] || 0.2));
      oscillator.stop(time + (durations[i] || 0.2));
      
      time += (durations[i] || 0.2);
    }
  }

  play(soundName) {
    if (this.sounds[soundName]) {
      this.sounds[soundName]();
    }
  }

  enable() { 
    this.enabled = true; 
  }
  
  disable() { 
    this.enabled = false; 
  }
}

export const audio = new AudioManager();
