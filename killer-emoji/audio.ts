
export class AudioManager {
    private audioContext: AudioContext | null = null;
    private volume: number = 1.0;

    setVolume(newVolume: number) { // Expects a value between 0.0 and 1.0
        this.volume = Math.max(0, Math.min(1, newVolume));
    }

    // Initialize the AudioContext. Must be called after a user interaction.
    init() {
        if (!this.audioContext || this.audioContext.state === 'closed') {
            try {
                this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            } catch (e) {
                console.error("Web Audio API is not supported in this browser");
            }
        }
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    private play(
        type: OscillatorType, 
        frequency: number, 
        duration: number, 
        volume: number = 0.5,
        startTimeOffset: number = 0
    ) {
        if (!this.audioContext || this.volume === 0) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        const startTime = this.audioContext.currentTime + startTimeOffset;

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, startTime);
        
        gainNode.gain.setValueAtTime(volume * this.volume, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
    }

    private playNoise(duration: number, volume: number = 0.5) {
        if (!this.audioContext || this.volume === 0) return;

        const bufferSize = this.audioContext.sampleRate * duration;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const output = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        const noiseSource = this.audioContext.createBufferSource();
        noiseSource.buffer = buffer;
        
        const gainNode = this.audioContext.createGain();
        gainNode.gain.setValueAtTime(volume * this.volume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, this.audioContext.currentTime + duration);

        noiseSource.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        noiseSource.start();
    }

    playSpawnSound() {
        // A high-pitched, short blip
        this.play('triangle', 880, 0.1, 0.15);
    }

    playCollisionSound() {
        // A short burst of noise and a low thud
        this.playNoise(0.3, 0.4);
        this.play('square', 100, 0.2, 0.5);
    }

    playStartSound() {
        // A quick ascending arpeggio
        this.play('sine', 261.63, 0.1, 0.3, 0);      // C4
        this.play('sine', 329.63, 0.1, 0.3, 0.1);    // E4
        this.play('sine', 392.00, 0.1, 0.3, 0.2);    // G4
    }
}
