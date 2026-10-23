// A small lofi-beat generator built on Web Audio: jazzy electric-piano chords,
// bass, a swung boom-bap kit, the odd melody note, vinyl crackle and optional
// rain. Everything is synthesised live, so there are no audio files or
// third-party requests. Notes are scheduled slightly ahead on the audio clock
// (the "lookahead" pattern) so timing stays tight even if the main thread stalls.

export type VibeId = 'night' | 'coffee' | 'rainy';

interface Vibe {
	label: string;
	bpm: number;
	/** One chord per bar: bass root plus electric-piano voicing, as MIDI notes. */
	chords: { bass: number; keys: number[] }[];
}

export const VIBES: Record<VibeId, Vibe> = {
	// ii-V-I-vi in C: Dm9, G13, Cmaj9, Am9
	night: {
		label: 'Late night',
		bpm: 72,
		chords: [
			{ bass: 38, keys: [53, 57, 60, 64] },
			{ bass: 43, keys: [53, 59, 64, 69] },
			{ bass: 36, keys: [52, 55, 59, 62] },
			{ bass: 45, keys: [55, 60, 64, 71] },
		],
	},
	// Descending Fmaj9, Em7, Dm9, Cmaj7
	coffee: {
		label: 'Coffee shop',
		bpm: 80,
		chords: [
			{ bass: 41, keys: [57, 60, 64, 67] },
			{ bass: 40, keys: [55, 59, 62, 64] },
			{ bass: 38, keys: [53, 57, 60, 64] },
			{ bass: 36, keys: [52, 55, 59, 62] },
		],
	},
	// Minor and slow: Am9, Fmaj7, Cmaj9, Em7
	rainy: {
		label: 'Rainy day',
		bpm: 66,
		chords: [
			{ bass: 45, keys: [60, 64, 67, 71] },
			{ bass: 41, keys: [53, 57, 60, 64] },
			{ bass: 36, keys: [52, 55, 59, 62] },
			{ bass: 40, keys: [55, 59, 62, 64] },
		],
	},
};

const STEPS_PER_BAR = 16;
const SWING = 0.3; // fraction of a 16th that off-beat 8ths are pushed late

const midiToHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export class LofiPlayer {
	private ctx: AudioContext;
	private output: GainNode; // volume
	private fader: GainNode; // start/stop fades
	private music: GainNode; // everything that goes through the "lofi" filter
	private crackleBus: GainNode;
	private rainBus: GainNode;
	private wow: OscillatorNode; // slow pitch wobble, like a worn tape
	private wowDepth: GainNode;
	private noise: AudioBuffer;

	private vibe: Vibe = VIBES.night;
	private step = 0;
	private bar = 0;
	private nextStepTime = 0;
	private timer: number | undefined;
	private stopTimeout: number | undefined;
	playing = false;

	constructor(ctx: AudioContext) {
		this.ctx = ctx;

		this.output = ctx.createGain();
		this.output.gain.value = 0.7;
		this.fader = ctx.createGain();
		this.fader.gain.value = 0;
		this.fader.connect(this.output).connect(ctx.destination);

		// Warm, dull top end and gentle glue are most of the "lofi" sound.
		const lowpass = ctx.createBiquadFilter();
		lowpass.type = 'lowpass';
		lowpass.frequency.value = 2600;
		lowpass.Q.value = 0.4;
		const compressor = ctx.createDynamicsCompressor();
		compressor.threshold.value = -20;
		compressor.ratio.value = 3;
		this.music = ctx.createGain();
		this.music.gain.value = 0.9;
		this.music.connect(lowpass).connect(compressor).connect(this.fader);

		this.wow = ctx.createOscillator();
		this.wow.frequency.value = 0.4;
		this.wowDepth = ctx.createGain();
		this.wowDepth.gain.value = 9; // cents
		this.wow.connect(this.wowDepth);
		this.wow.start();

		this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
		const data = this.noise.getChannelData(0);
		for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

		this.crackleBus = this.makeCrackleBed();
		this.rainBus = this.makeRain();
	}

	setVolume(value: number) {
		this.output.gain.setTargetAtTime(value, this.ctx.currentTime, 0.05);
	}

	setVibe(id: VibeId) {
		this.vibe = VIBES[id];
	}

	setCrackle(on: boolean) {
		this.crackleBus.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.2);
	}

	setRain(on: boolean) {
		this.rainBus.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.4);
	}

	start() {
		if (this.playing) return;
		this.playing = true;
		window.clearTimeout(this.stopTimeout);
		if (this.ctx.state === 'suspended') void this.ctx.resume();
		const now = this.ctx.currentTime;
		this.fader.gain.cancelScheduledValues(now);
		this.fader.gain.setTargetAtTime(1, now, 0.4);
		if (!this.timer) {
			this.step = 0;
			this.nextStepTime = now + 0.1;
			this.timer = window.setInterval(() => this.schedule(), 25);
		}
	}

	stop() {
		if (!this.playing) return;
		this.playing = false;
		const now = this.ctx.currentTime;
		this.fader.gain.cancelScheduledValues(now);
		this.fader.gain.setTargetAtTime(0, now, 0.25);
		// Keep scheduling until the fade is done, then go quiet; the next start begins a fresh bar.
		this.stopTimeout = window.setTimeout(() => {
			window.clearInterval(this.timer);
			this.timer = undefined;
		}, 1500);
	}

	private schedule() {
		// Background tabs may run timers late, so look further ahead while hidden.
		const lookahead = document.hidden ? 1.5 : 0.15;
		const stepDuration = 60 / this.vibe.bpm / 4;
		while (this.nextStepTime < this.ctx.currentTime + lookahead) {
			const swing = this.step % 4 === 2 ? SWING * stepDuration : 0;
			this.playStep(this.step, this.nextStepTime + swing, stepDuration);
			this.nextStepTime += stepDuration;
			this.step = (this.step + 1) % STEPS_PER_BAR;
			if (this.step === 0) this.bar++;
		}
	}

	private playStep(step: number, t: number, stepDuration: number) {
		const chord = this.vibe.chords[this.bar % this.vibe.chords.length];
		const barLength = stepDuration * STEPS_PER_BAR;

		// Drums: kick on 1 and the "and" of 3, snare on 2 and 4, soft 8th-note hats.
		if (step === 0 || step === 10 || (step === 7 && Math.random() < 0.3)) this.kick(t);
		if (step === 4 || step === 12) this.snare(t);
		if (step % 2 === 0 && Math.random() > 0.1) this.hat(t, step % 4 === 0 ? 0.05 : 0.03);

		// Keys: full chord on the downbeat (lightly strummed), sometimes a syncopated re-hit.
		if (step === 0) {
			chord.keys.forEach((note, i) => this.keys(note, t + i * 0.025, barLength * 0.62, 0.11));
		}
		if (step === 11 && Math.random() < 0.45) {
			chord.keys.slice(1).forEach((note, i) => this.keys(note, t + i * 0.02, barLength * 0.3, 0.07));
		}

		// Bass: root on the downbeat, a pickup root or fifth later in the bar.
		if (step === 0) this.bass(chord.bass, t, barLength * 0.55);
		if (step === 10 && Math.random() < 0.6) this.bass(chord.bass + (Math.random() < 0.5 ? 7 : 0), t, barLength * 0.3);

		// Sparse melody: a chord tone an octave up, now and then.
		if (step % 2 === 0 && step !== 0 && Math.random() < 0.12) {
			const note = chord.keys[Math.floor(Math.random() * chord.keys.length)] + 12;
			this.bell(note, t);
		}

		// Vinyl pops.
		if (Math.random() < 0.35) this.pop(t + Math.random() * stepDuration);
	}

	private keys(midi: number, t: number, length: number, velocity: number) {
		const { ctx } = this;
		const gain = ctx.createGain();
		gain.gain.setValueAtTime(0, t);
		gain.gain.linearRampToValueAtTime(velocity, t + 0.015);
		gain.gain.setTargetAtTime(velocity * 0.45, t + 0.02, 0.35);
		gain.gain.setTargetAtTime(0, t + length, 0.25);
		// Electric-piano-ish: a sine fundamental plus a quiet bell-like partial.
		for (const [ratio, level] of [
			[1, 1],
			[2, 0.18],
			[3.01, 0.05],
		]) {
			const osc = ctx.createOscillator();
			osc.frequency.value = midiToHz(midi) * ratio;
			osc.detune.value = (Math.random() - 0.5) * 6;
			this.wowDepth.connect(osc.detune);
			const partial = ctx.createGain();
			partial.gain.value = level;
			osc.connect(partial).connect(gain);
			osc.start(t);
			osc.stop(t + length + 1.5);
			osc.onended = () => this.wowDepth.disconnect(osc.detune);
		}
		gain.connect(this.music);
	}

	private bass(midi: number, t: number, length: number) {
		const { ctx } = this;
		const osc = ctx.createOscillator();
		osc.type = 'sine';
		osc.frequency.value = midiToHz(midi);
		const gain = ctx.createGain();
		gain.gain.setValueAtTime(0, t);
		gain.gain.linearRampToValueAtTime(0.32, t + 0.02);
		gain.gain.setTargetAtTime(0.2, t + 0.03, 0.2);
		gain.gain.setTargetAtTime(0, t + length, 0.08);
		osc.connect(gain).connect(this.music);
		osc.start(t);
		osc.stop(t + length + 0.6);
	}

	private bell(midi: number, t: number) {
		const { ctx } = this;
		const osc = ctx.createOscillator();
		osc.type = 'triangle';
		osc.frequency.value = midiToHz(midi);
		this.wowDepth.connect(osc.detune);
		const gain = ctx.createGain();
		gain.gain.setValueAtTime(0, t);
		gain.gain.linearRampToValueAtTime(0.05, t + 0.01);
		gain.gain.exponentialRampToValueAtTime(0.0005, t + 1.2);
		osc.connect(gain).connect(this.music);
		osc.start(t);
		osc.stop(t + 1.3);
		osc.onended = () => this.wowDepth.disconnect(osc.detune);
	}

	private kick(t: number) {
		const { ctx } = this;
		const osc = ctx.createOscillator();
		osc.frequency.setValueAtTime(110, t);
		osc.frequency.exponentialRampToValueAtTime(42, t + 0.12);
		const gain = ctx.createGain();
		gain.gain.setValueAtTime(0.75, t);
		gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
		osc.connect(gain).connect(this.music);
		osc.start(t);
		osc.stop(t + 0.45);
	}

	private snare(t: number) {
		const noise = this.noiseSource(t, 0.25);
		const band = this.ctx.createBiquadFilter();
		band.type = 'bandpass';
		band.frequency.value = 1700;
		band.Q.value = 0.7;
		const gain = this.ctx.createGain();
		gain.gain.setValueAtTime(0.28, t);
		gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
		noise.connect(band).connect(gain).connect(this.music);
	}

	private hat(t: number, level: number) {
		const noise = this.noiseSource(t, 0.08);
		const high = this.ctx.createBiquadFilter();
		high.type = 'highpass';
		high.frequency.value = 6500;
		const gain = this.ctx.createGain();
		gain.gain.setValueAtTime(level, t);
		gain.gain.exponentialRampToValueAtTime(0.0005, t + 0.06);
		noise.connect(high).connect(gain).connect(this.music);
	}

	private pop(t: number) {
		const noise = this.noiseSource(t, 0.01);
		const high = this.ctx.createBiquadFilter();
		high.type = 'highpass';
		high.frequency.value = 1800;
		const gain = this.ctx.createGain();
		gain.gain.setValueAtTime(0.03 + Math.random() * 0.1, t);
		gain.gain.exponentialRampToValueAtTime(0.0005, t + 0.008);
		noise.connect(high).connect(gain).connect(this.crackleBus);
	}

	private noiseSource(t: number, length: number) {
		const source = this.ctx.createBufferSource();
		source.buffer = this.noise;
		source.start(t, Math.random() * 1.5, length);
		return source;
	}

	private loopNoise() {
		const source = this.ctx.createBufferSource();
		source.buffer = this.noise;
		source.loop = true;
		source.start();
		return source;
	}

	/** Constant soft hiss under the pops; returns the bus the pops also feed. */
	private makeCrackleBed() {
		const bus = this.ctx.createGain();
		const band = this.ctx.createBiquadFilter();
		band.type = 'bandpass';
		band.frequency.value = 4000;
		band.Q.value = 0.5;
		const hiss = this.ctx.createGain();
		hiss.gain.value = 0.012;
		this.loopNoise().connect(band).connect(hiss).connect(bus);
		bus.connect(this.fader);
		return bus;
	}

	/** Filtered noise with a slow swell, which reads as steady rain. */
	private makeRain() {
		const bus = this.ctx.createGain();
		bus.gain.value = 0;
		const low = this.ctx.createBiquadFilter();
		low.type = 'lowpass';
		low.frequency.value = 1400;
		const high = this.ctx.createBiquadFilter();
		high.type = 'highpass';
		high.frequency.value = 350;
		const level = this.ctx.createGain();
		level.gain.value = 0.16;
		const swell = this.ctx.createOscillator();
		swell.frequency.value = 0.07;
		const swellDepth = this.ctx.createGain();
		swellDepth.gain.value = 0.04;
		swell.connect(swellDepth).connect(level.gain);
		swell.start();
		this.loopNoise().connect(low).connect(high).connect(level).connect(bus);
		bus.connect(this.fader);
		return bus;
	}
}
