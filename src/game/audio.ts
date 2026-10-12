// Paper Tide - Procedural Audio Engine
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;
  private volume = 0.5;
  private initialized = false;
  private ambienceNode: OscillatorNode | null = null;
  private ambienceGain: GainNode | null = null;

  init() {
    if (this.initialized) return;
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
    } catch {
      console.warn('Web Audio not available');
    }
  }

  resume() {
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.masterGain) {
      this.masterGain.gain.value = muted ? 0 : this.volume;
    }
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.masterGain && !this.muted) {
      this.masterGain.gain.value = v;
    }
  }

  // Paper crinkle sound
  playCrinkle(intensity: number = 0.5) {
    if (!this.ctx || !this.masterGain) return;
    const duration = 0.08 + intensity * 0.12;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      const envelope = Math.exp(-t * 8) * (1 - Math.exp(-t * 50));
      data[i] = (Math.random() * 2 - 1) * envelope * intensity;
    }
    
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2000 + intensity * 3000;
    filter.Q.value = 0.5;
    
    const gain = this.ctx.createGain();
    gain.gain.value = 0.15;
    
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start();
  }

  // Paper fold snap
  playSnap() {
    if (!this.ctx || !this.masterGain) return;
    const duration = 0.15;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      const envelope = Math.exp(-t * 15) * Math.sin(t * 200);
      data[i] = envelope * 0.5;
    }
    
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    
    const gain = this.ctx.createGain();
    gain.gain.value = 0.2;
    
    source.connect(gain);
    gain.connect(this.masterGain);
    source.start();
  }

  // Soft splash for release
  playSplash() {
    if (!this.ctx || !this.masterGain) return;
    const duration = 0.4;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      const envelope = Math.exp(-t * 4) * (1 - Math.exp(-t * 30));
      data[i] = (Math.random() * 2 - 1) * envelope;
    }
    
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    
    const gain = this.ctx.createGain();
    gain.gain.value = 0.12;
    
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start();
  }

  // Bell sound for reset
  playBell() {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 880;
    
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 1320;
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.5);
    
    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start();
    osc2.start();
    osc.stop(this.ctx.currentTime + 1.5);
    osc2.stop(this.ctx.currentTime + 1.5);
  }

  // Creature flutter
  playFlutter() {
    if (!this.ctx || !this.masterGain) return;
    const duration = 0.2;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      const envelope = Math.sin(t * Math.PI) * Math.exp(-t * 3);
      data[i] = Math.sin(t * 800 + Math.sin(t * 40) * 5) * envelope;
    }
    
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    
    const gain = this.ctx.createGain();
    gain.gain.value = 0.08;
    
    source.connect(gain);
    gain.connect(this.masterGain);
    source.start();
  }

  // Hop sound
  playHop() {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.08);
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  // Fish plip
  playPlip() {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.1);
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }

  // Start ambient pad
  startAmbience() {
    if (!this.ctx || !this.masterGain || this.ambienceNode) return;
    
    this.ambienceGain = this.ctx.createGain();
    this.ambienceGain.gain.value = 0.03;
    this.ambienceGain.connect(this.masterGain);
    
    // Soft pad with detuned oscillators
    const ctx = this.ctx;
    const freqs = [130.81, 196, 261.63]; // C3, G3, C4
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq + (i - 1) * 0.5; // slight detune
      
      const oscGain = ctx.createGain();
      oscGain.gain.value = 0.3;
      
      osc.connect(oscGain);
      oscGain.connect(this.ambienceGain!);
      osc.start();
    });
  }

  stopAmbience() {
    if (this.ambienceGain) {
      this.ambienceGain.gain.exponentialRampToValueAtTime(0.001, (this.ctx?.currentTime || 0) + 1);
      setTimeout(() => {
        this.ambienceGain = null;
        this.ambienceNode = null;
      }, 1100);
    }
  }

  // Rain sound
  playRainLoop(intensity: number): (() => void) | null {
    if (!this.ctx || !this.masterGain) return null;
    
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.3;
    }
    
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3000;
    filter.Q.value = 0.3;
    
    const gain = this.ctx.createGain();
    gain.gain.value = intensity * 0.08;
    
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start();
    
    return () => {
      const ct = this.ctx ? this.ctx.currentTime : 0;
      gain.gain.exponentialRampToValueAtTime(0.001, ct + 0.5);
      setTimeout(() => { try { source.stop(); } catch {} }, 600);
    };
  }
}

export const audio = new AudioEngine();
