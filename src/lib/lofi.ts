// A small lofi-beat generator built on Web Audio: electric-piano chords, bass,
// drums, the odd melody note, vinyl crackle and optional rain. Everything is
// synthesised live, so there are no audio files or third-party requests.
//
// Notes are scheduled ahead on the audio clock (the "lookahead" pattern) from a
// main-thread timer. The lookahead is generous so ordinary main-thread pauses
// (GC, layout, busy tabs) don't make notes late, and if the timer ever does
// fall behind, the sequencer skips forward instead of cramming late notes in.

export type VibeId = 'night' | 'coffee' | 'rainy';

interface Chord {
	bass: number; // MIDI root
	keys: number[]; // MIDI voicing
}

/** A keys hit: on `step`, with `chance`, `upper` plays only the top notes, `length` is in bars. */
interface KeysHit {
	step: number;
	chance: number;
	upper?: boolean;
	length: number;
	velocity: number;
}

/** A bass note: on `step`, with `chance`, `interval` semitones above the root, `length` in bars. */
interface BassHit {
	step: number;
	chance: number;
	interval: number;
	length: number;
}

interface Vibe {
	label: string;
	bpm: number;
	swing: number; // how late off-beat 8ths land, as a fraction of a 16th
	tone: number; // lowpass cutoff in Hz: lower = darker, more muffled
	keys: {
		partials: [ratio: number, level: number][]; // more/louder upper partials = brighter
		attack: number; // seconds; slow attacks turn the piano into a soft pad
		hits: KeysHit[];
	};
	bass: BassHit[];
	drums: {
		kick: number[];
		ghostKick: number[]; // played 35% of the time
		snare: number[];
		snareStyle: 'snare' | 'rim';
		hats: number[];
		hatLevel: number;
	};
	melodyChance: number;
	chords: Chord[];
}

export const VIBES: Record<VibeId, Vibe> = {
	// Classic boom-bap: jazzy ii-V-I in C, warm keys, lazy swing.
	night: {
		label: 'Late night',
		bpm: 74,
		swing: 0.3,
		tone: 2300,
		keys: {
			partials: [
				[1, 1],
				[2, 0.18],
				[3.01, 0.05],
			],
			attack: 0.015,
			hits: [
				{ step: 0, chance: 1, length: 0.62, velocity: 0.11 },
				{ step: 11, chance: 0.45, upper: true, length: 0.3, velocity: 0.07 },
			],
		},
		bass: [
			{ step: 0, chance: 1, interval: 0, length: 0.55 },
			{ step: 10, chance: 0.6, interval: 7, length: 0.3 },
		],
		drums: { kick: [0, 10], ghostKick: [7], snare: [4, 12], snareStyle: 'snare', hats: [0, 2, 4, 6, 8, 10, 12, 14], hatLevel: 0.04 },
		melodyChance: 0.12,
		chords: [
			{ bass: 38, keys: [53, 57, 60, 64] }, // Dm9
			{ bass: 43, keys: [53, 59, 64, 69] }, // G13
			{ bass: 36, keys: [52, 55, 59, 62] }, // Cmaj9
			{ bass: 45, keys: [55, 60, 64, 71] }, // Am9
		],
	},
	// Upbeat and bright: faster, busier 16th hats, choppy comping, walking bass, in E flat.
	coffee: {
		label: 'Coffee shop',
		bpm: 90,
		swing: 0.18,
		tone: 4200,
		keys: {
			partials: [
				[1, 1],
				[2, 0.35],
				[3.01, 0.12],
				[4.02, 0.05],
			],
			attack: 0.008,
			hits: [
				{ step: 0, chance: 1, length: 0.2, velocity: 0.1 },
				{ step: 6, chance: 0.8, upper: true, length: 0.12, velocity: 0.08 },
				{ step: 10, chance: 0.7, length: 0.15, velocity: 0.08 },
				{ step: 14, chance: 0.35, upper: true, length: 0.1, velocity: 0.06 },
			],
		},
		bass: [
			{ step: 0, chance: 1, interval: 0, length: 0.22 },
			{ step: 4, chance: 0.85, interval: 7, length: 0.2 },
			{ step: 8, chance: 0.9, interval: 12, length: 0.2 },
			{ step: 12, chance: 0.85, interval: 7, length: 0.2 },
		],
		drums: {
			kick: [0, 7, 10],
			ghostKick: [3, 14],
			snare: [4, 12],
			snareStyle: 'snare',
			hats: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
			hatLevel: 0.03,
		},
		melodyChance: 0.22,
		chords: [
			{ bass: 39, keys: [55, 58, 62, 65] }, // Ebmaj9
			{ bass: 41, keys: [56, 60, 63, 67] }, // Fm9
			{ bass: 43, keys: [53, 58, 62, 65] }, // Gm7
			{ bass: 44, keys: [55, 60, 63, 67] }, // Abmaj7
		],
	},
	// Slow, muffled and sad: half-time rim clicks, soft pad-like chords, A minor.
	rainy: {
		label: 'Rainy day',
		bpm: 62,
		swing: 0.12,
		tone: 1400,
		keys: {
			partials: [
				[1, 1],
				[2, 0.08],
			],
			attack: 0.35,
			hits: [{ step: 0, chance: 1, length: 0.92, velocity: 0.1 }],
		},
		bass: [{ step: 0, chance: 1, interval: 0, length: 0.9 }],
		drums: { kick: [0], ghostKick: [11], snare: [8], snareStyle: 'rim', hats: [4, 12], hatLevel: 0.02 },
		melodyChance: 0.07,
		chords: [
			{ bass: 45, keys: [55, 60, 64, 71] }, // Am9
			{ bass: 41, keys: [53, 57, 60, 64] }, // Fmaj7
			{ bass: 38, keys: [53, 57, 60, 64] }, // Dm9
			{ bass: 40, keys: [56, 59, 62, 65] }, // E7b9
		],
	},
};

const STEPS_PER_BAR = 16;
const LOOKAHEAD = 0.4; // seconds scheduled ahead while visible
const LOOKAHEAD_HIDDEN = 2; // background tabs may run timers late
const TIMER_MS = 50;

const midiToHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export class LofiPlayer {
	private ctx: AudioContext;
	private output: GainNode; // volume
	private fader: GainNode; // start/stop fades
	private ducker: GainNode; // dips the music under other sounds, e.g. the timer chime
	private music: GainNode; // everything that goes through the "lofi" filter
	private toneFilter: BiquadFilterNode;
	private crackleBus: GainNode;
	private rainBus: GainNode;
	private wowDepth: GainNode; // slow pitch wobble, like a worn tape
	private noise: AudioBuffer;
	// Shared drum filters, so each hit only creates a source and a gain.
	private snareFilter: BiquadFilterNode;
	private rimFilter: BiquadFilterNode;
	private hatFilter: BiquadFilterNode;
	private popFilter: BiquadFilterNode;

	private vibe: Vibe = VIBES.night;
	private pendingVibe: Vibe | null = null;
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
		this.ducker = ctx.createGain();
		this.fader.connect(this.ducker).connect(this.output).connect(ctx.destination);

		// Warm, dull top end and gentle glue are most of the "lofi" sound.
		this.toneFilter = ctx.createBiquadFilter();
		this.toneFilter.type = 'lowpass';
		this.toneFilter.frequency.value = this.vibe.tone;
		this.toneFilter.Q.value = 0.4;
		const compressor = ctx.createDynamicsCompressor();
		compressor.threshold.value = -20;
		compressor.ratio.value = 3;
		this.music = ctx.createGain();
		this.music.gain.value = 0.9;
		this.music.connect(this.toneFilter).connect(compressor).connect(this.fader);

		const wow = ctx.createOscillator();
		wow.frequency.value = 0.4;
		this.wowDepth = ctx.createGain();
		this.wowDepth.gain.value = 8; // cents
		wow.connect(this.wowDepth);
		wow.start();

		this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
		const data = this.noise.getChannelData(0);
		for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

		this.snareFilter = this.filter('bandpass', 1700, 0.7, this.music);
		this.rimFilter = this.filter('bandpass', 2600, 6, this.music);
		this.hatFilter = this.filter('highpass', 6500, 0.7, this.music);

		this.crackleBus = this.makeCrackleBed();
		this.popFilter = this.filter('bandpass', 2500, 0.8, this.crackleBus);
		this.rainBus = this.makeRain();
	}

	setVolume(value: number) {
		this.output.gain.setTargetAtTime(value, this.ctx.currentTime, 0.05);
	}

	/** Takes effect at the next bar line so the groove never stumbles mid-bar. */
	setVibe(id: VibeId) {
		if (!this.playing) {
			this.applyVibe(VIBES[id]);
			return;
		}
		this.pendingVibe = VIBES[id];
	}

	/** Lower the music for `seconds` (e.g. while a chime rings), then ease it back. */
	duck(seconds: number, level = 0.25) {
		const now = this.ctx.currentTime;
		this.ducker.gain.cancelScheduledValues(now);
		this.ducker.gain.setTargetAtTime(level, now, 0.08);
		this.ducker.gain.setTargetAtTime(1, now + seconds, 0.6);
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
			this.schedule();
			this.timer = window.setInterval(() => this.schedule(), TIMER_MS);
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
			if (this.pendingVibe) this.applyVibe(this.pendingVibe);
		}, 1500);
	}

	private applyVibe(vibe: Vibe) {
		this.vibe = vibe;
		this.pendingVibe = null;
		this.toneFilter.frequency.setTargetAtTime(vibe.tone, this.ctx.currentTime, 0.3);
	}

	private schedule() {
		const now = this.ctx.currentTime;
		// If the timer was starved for longer than the lookahead, skip the missed steps
		// rather than playing them all at once late (which is what a stutter sounds like).
		if (this.nextStepTime < now) {
			const stepDuration = 60 / this.vibe.bpm / 4;
			const missed = Math.ceil((now - this.nextStepTime) / stepDuration);
			this.advance(missed, stepDuration);
		}

		const horizon = now + (document.hidden ? LOOKAHEAD_HIDDEN : LOOKAHEAD);
		while (this.nextStepTime < horizon) {
			if (this.step === 0 && this.pendingVibe) this.applyVibe(this.pendingVibe);
			const stepDuration = 60 / this.vibe.bpm / 4;
			const swing = this.step % 4 === 2 ? this.vibe.swing * stepDuration : 0;
			this.playStep(this.step, this.nextStepTime + swing, stepDuration);
			this.advance(1, stepDuration);
		}
	}

	private advance(steps: number, stepDuration: number) {
		for (let i = 0; i < steps; i++) {
			this.nextStepTime += stepDuration;
			this.step = (this.step + 1) % STEPS_PER_BAR;
			if (this.step === 0) this.bar++;
		}
	}

	private playStep(step: number, t: number, stepDuration: number) {
		const { vibe } = this;
		const chord = vibe.chords[this.bar % vibe.chords.length];
		const barLength = stepDuration * STEPS_PER_BAR;
		const chance = (p: number) => Math.random() < p;

		const { drums } = vibe;
		if (drums.kick.includes(step) || (drums.ghostKick.includes(step) && chance(0.35))) this.kick(t);
		if (drums.snare.includes(step)) {
			if (drums.snareStyle === 'rim') this.rim(t);
			else this.snare(t);
		}
		if (drums.hats.includes(step) && chance(0.92)) {
			const accent = step % 4 === 0 ? 1.4 : step % 2 === 0 ? 1 : 0.6;
			this.hat(t, drums.hatLevel * accent);
		}

		for (const hit of vibe.keys.hits) {
			if (hit.step !== step || !chance(hit.chance)) continue;
			const notes = hit.upper ? chord.keys.slice(1) : chord.keys;
			notes.forEach((note, i) => this.keys(note, t + i * 0.022, hit.length * barLength, hit.velocity));
		}

		for (const hit of vibe.bass) {
			if (hit.step === step && chance(hit.chance)) this.bass(chord.bass + hit.interval, t, hit.length * barLength);
		}

		// Sparse melody: a chord tone an octave up, now and then.
		if (step % 2 === 0 && step !== 0 && chance(vibe.melodyChance)) {
			this.bell(chord.keys[Math.floor(Math.random() * chord.keys.length)] + 12, t);
		}

		// Vinyl pops.
		if (chance(0.25)) this.pop(t + Math.random() * stepDuration);
	}

	private keys(midi: number, t: number, length: number, velocity: number) {
		const { ctx } = this;
		const { attack, partials } = this.vibe.keys;
		const gain = ctx.createGain();
		gain.gain.setValueAtTime(0, t);
		gain.gain.linearRampToValueAtTime(velocity, t + attack);
		gain.gain.setTargetAtTime(velocity * 0.45, t + attack + 0.005, 0.35);
		gain.gain.setTargetAtTime(0, t + Math.max(length, attack + 0.05), 0.25);
		gain.connect(this.music);
		for (const [ratio, level] of partials) {
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
	}

	private bass(midi: number, t: number, length: number) {
		const { ctx } = this;
		const osc = ctx.createOscillator();
		osc.frequency.value = midiToHz(midi);
		const gain = ctx.createGain();
		gain.gain.setValueAtTime(0, t);
		gain.gain.linearRampToValueAtTime(0.32, t + 0.02);
		gain.gain.setTargetAtTime(0.2, t + 0.03, 0.2);
		gain.gain.setTargetAtTime(0, t + length, 0.06);
		osc.connect(gain).connect(this.music);
		osc.start(t);
		osc.stop(t + length + 0.5);
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
		this.noiseHit(t, 0.25, 0.28, 0.2, this.snareFilter);
	}

	private rim(t: number) {
		this.noiseHit(t, 0.06, 0.35, 0.04, this.rimFilter);
	}

	private hat(t: number, level: number) {
		this.noiseHit(t, 0.08, level, 0.06, this.hatFilter);
	}

	private pop(t: number) {
		this.noiseHit(t, 0.01, 0.015 + Math.random() * 0.035, 0.008, this.popFilter);
	}

	/** A burst of noise with a quick decay, fed into one of the shared filters. */
	private noiseHit(t: number, length: number, level: number, decay: number, destination: AudioNode) {
		const source = this.ctx.createBufferSource();
		source.buffer = this.noise;
		const gain = this.ctx.createGain();
		gain.gain.setValueAtTime(level, t);
		gain.gain.exponentialRampToValueAtTime(0.0005, t + decay);
		source.connect(gain).connect(destination);
		source.start(t, Math.random() * 1.5, length);
	}

	private filter(type: BiquadFilterType, frequency: number, q: number, destination: AudioNode) {
		const node = this.ctx.createBiquadFilter();
		node.type = type;
		node.frequency.value = frequency;
		node.Q.value = q;
		node.connect(destination);
		return node;
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
		const hiss = this.ctx.createGain();
		hiss.gain.value = 0.012;
		this.loopNoise().connect(this.filter('bandpass', 4000, 0.5, hiss));
		hiss.connect(bus);
		bus.connect(this.fader);
		return bus;
	}

	/** Filtered noise with a slow swell, which reads as steady rain. */
	private makeRain() {
		const bus = this.ctx.createGain();
		bus.gain.value = 0;
		const level = this.ctx.createGain();
		level.gain.value = 0.16;
		const swell = this.ctx.createOscillator();
		swell.frequency.value = 0.07;
		const swellDepth = this.ctx.createGain();
		swellDepth.gain.value = 0.04;
		swell.connect(swellDepth).connect(level.gain);
		swell.start();
		const high = this.filter('highpass', 350, 0.7, level);
		this.loopNoise().connect(this.filter('lowpass', 1400, 0.7, high));
		level.connect(bus);
		bus.connect(this.fader);
		return bus;
	}
}
