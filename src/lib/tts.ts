// Clean TTS implementation: Piper (optional) + Web Speech API fallback
export type TTSVoice = {
	id: string
	label: string
	lang?: string
	quality?: 'high' | 'medium' | 'low'
	piperModel?: string
}

export const TTS_VOICES: TTSVoice[] = [
	{ id: 'en_US-amy-medium', label: 'Amy (US)', lang: 'en-US', quality: 'high', piperModel: 'en_US-amy-medium' },
	{ id: 'en_US-lessac-medium', label: 'Lessac (US)', lang: 'en-US', quality: 'high', piperModel: 'en_US-lessac-medium' },
	{ id: 'en_US-ryan-medium', label: 'Ryan (US)', lang: 'en-US', quality: 'high', piperModel: 'en_US-ryan-medium' },
	{ id: 'en_GB-alba-medium', label: 'Alba (UK)', lang: 'en-GB', quality: 'high', piperModel: 'en_GB-alba-medium' },
	{ id: 'browser-default', label: 'Browser voice', lang: 'en-US', quality: 'low' },
]

export type TTSState = 'idle' | 'loading' | 'speaking' | 'paused' | 'error'

type StateListener = (state: TTSState, progress?: number) => void

class TTSEngine {
	private piperEngine: any = null
	private currentVoice: string = 'browser-default'
	private utterance: SpeechSynthesisUtterance | null = null
	private audioCtx: AudioContext | null = null
	private currentSource: AudioBufferSourceNode | null = null
	private state: TTSState = 'idle'
	private listeners: StateListener[] = []
	private rate: number = 1.0

	onStateChange(fn: StateListener) {
		this.listeners.push(fn)
		return () => { this.listeners = this.listeners.filter(l => l !== fn) }
	}

	private setState(s: TTSState, progress?: number) {
		this.state = s
		this.listeners.forEach(l => l(s, progress))
	}

	getState() { return this.state }

	setVoice(voiceId: string) { this.currentVoice = voiceId }

	setRate(r: number) { this.rate = Math.max(0.5, Math.min(2.0, r)) }

	async speak(text: string, onProgress?: (charIndex: number) => void): Promise<void> {
		this.stop()
		if (!text || !text.trim()) return
		this.setState('speaking')

		const voice = TTS_VOICES.find(v => v.id === this.currentVoice)
		if (voice?.piperModel) {
			try {
				if (!this.piperEngine) {
					const mod: any = await (new Function('return import("piper-tts-web")'))().catch(() => null)
					if (mod) {
						const PiperTTS = mod.default || mod.PiperTTS
						this.piperEngine = new PiperTTS()
						if (this.piperEngine.loadVoice) await this.piperEngine.loadVoice(voice.piperModel)
					}
				}
				if (this.piperEngine && this.piperEngine.synthesize) {
					const audioBuffer = await this.piperEngine.synthesize(text)
					if (!this.audioCtx) this.audioCtx = new AudioContext()
					if (this.audioCtx.state === 'suspended') await this.audioCtx.resume()
					await new Promise<void>((resolve) => {
						const src = this.audioCtx!.createBufferSource()
						src.buffer = audioBuffer
						src.playbackRate.value = this.rate
						src.connect(this.audioCtx!.destination)
						this.currentSource = src
						src.onended = () => { this.currentSource = null; this.setState('idle'); resolve() }
						src.start()
					})
					return
				}
			} catch (e) {
				console.warn('Piper synth failed, falling back', e)
				this.piperEngine = null
			}
		}

		return this.speakBrowser(text, onProgress)
	}

	private speakBrowser(text: string, onProgress?: (charIndex: number) => void): Promise<void> {
		return new Promise<void>((resolve) => {
			if (typeof window === 'undefined' || !('speechSynthesis' in window)) { this.setState('error'); resolve(); return }
			window.speechSynthesis.cancel()
			const utt = new SpeechSynthesisUtterance(text)
			utt.rate = this.rate
			utt.lang = TTS_VOICES.find(v => v.id === this.currentVoice)?.lang ?? 'en-US'
			const voices = window.speechSynthesis.getVoices()
			const match = voices.find((v: any) => v.lang && v.lang.startsWith((utt.lang || '').slice(0,5)))
			if (match) utt.voice = match
			// boundary events provide charIndex for progress highlighting
			;(utt as any).onboundary = (ev: any) => {
				try { if (typeof ev.charIndex === 'number') onProgress?.(ev.charIndex) } catch {}
			}
			utt.onend = () => { this.utterance = null; this.setState('idle'); resolve() }
			utt.onerror = () => { this.utterance = null; this.setState('error'); resolve() }
			this.utterance = utt
			window.speechSynthesis.speak(utt)
		})
	}

	pause() {
		if (this.audioCtx?.state === 'running') { this.audioCtx.suspend(); this.setState('paused') }
		else if (typeof window !== 'undefined' && (window.speechSynthesis as any)?.speaking) { window.speechSynthesis.pause(); this.setState('paused') }
	}

	resume() {
		if (this.audioCtx?.state === 'suspended') { this.audioCtx.resume(); this.setState('speaking') }
		else if (typeof window !== 'undefined' && (window.speechSynthesis as any)?.paused) { window.speechSynthesis.resume(); this.setState('speaking') }
	}

	stop() {
		if (this.currentSource) { try { this.currentSource.stop() } catch {} this.currentSource = null }
		if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
		this.utterance = null
		this.setState('idle')
	}

	async speakSequence(chunks: string[], onChunkStart?: (idx: number) => void, signal?: AbortSignal) {
		for (let i = 0; i < chunks.length; i++) {
			if (signal?.aborted) break
			onChunkStart?.(i)
			await this.speak(chunks[i])
			if (signal?.aborted) break
		}
	}
}

export const ttsEngine = new TTSEngine()

export default ttsEngine
