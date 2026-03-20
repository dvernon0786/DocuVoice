export type TTSVoice = {
  id: string
  label: string
  lang: string
  quality: 'high' | 'medium' | 'low'
  piperModel?: string
}

export const TTS_VOICES: TTSVoice[] = [
  { id: 'en_US-amy-medium',    label: 'Amy (US)',    lang: 'en-US', quality: 'high',   piperModel: 'en_US-amy-medium' },
  { id: 'en_US-lessac-medium', label: 'Lessac (US)', lang: 'en-US', quality: 'high',   piperModel: 'en_US-lessac-medium' },
  { id: 'en_US-ryan-medium',   label: 'Ryan (US)',   lang: 'en-US', quality: 'high',   piperModel: 'en_US-ryan-medium' },
  { id: 'en_GB-alba-medium',   label: 'Alba (UK)',   lang: 'en-GB', quality: 'high',   piperModel: 'en_GB-alba-medium' },
  { id: 'en_IN-indic-medium',  label: 'Indic (IN)',  lang: 'en-IN', quality: 'medium', piperModel: 'en_IN-indic_tts-medium' },
  { id: 'browser-default',     label: 'Browser voice', lang: 'en-US', quality: 'low' },
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

  setVoice(voiceId: string) {
    this.currentVoice = voiceId
    this.stop()
  }

  setRate(r: number) {
    this.rate = Math.max(0.5, Math.min(2.0, r))
  }

  getRate() { return this.rate }

  async loadPiper(voiceId: string): Promise<boolean> {
    try {
      // piper-tts-web is external — expected on window.__piper__ if loaded via CDN script tag
      // @ts-ignore
      const PiperTTS = (window as any).__piper__?.PiperTTS ?? (window as any).__piper__?.default
      if (!PiperTTS) return false
      this.setState('loading')
      this.piperEngine = new PiperTTS()
      await this.piperEngine.loadVoice(voiceId)
      return true
    } catch (e) {
      console.warn('Piper TTS load failed, using browser fallback', e)
      return false
    }
  }

  // BUG FIX: Returns a Promise that resolves when speech is actually DONE
  speak(text: string, onWordIndex?: (charIndex: number) => void): Promise<void> {
    this.stop()
    if (!text.trim()) return Promise.resolve()
    this.setState('speaking')

    const voice = TTS_VOICES.find(v => v.id === this.currentVoice) ?? TTS_VOICES[TTS_VOICES.length - 1]

    if (voice.piperModel) {
      return this.speakPiper(voice.piperModel, text)
    }
    return this.speakBrowser(text, onWordIndex)
  }

  private async speakPiper(voiceModel: string, text: string): Promise<void> {
    try {
      if (!this.piperEngine) {
        const loaded = await this.loadPiper(voiceModel)
        if (!loaded) return this.speakBrowser(text)
      }
      const audioBuffer = await this.piperEngine.synthesize(text)
      if (!this.audioCtx) this.audioCtx = new AudioContext()
      if (this.audioCtx.state === 'suspended') await this.audioCtx.resume()

      return new Promise<void>((resolve) => {
        const source = this.audioCtx!.createBufferSource()
        source.buffer = audioBuffer
        source.playbackRate.value = this.rate
        source.connect(this.audioCtx!.destination)
        this.currentSource = source
        source.onended = () => {
          this.currentSource = null
          this.setState('idle')
          resolve()
        }
        source.start()
      })
    } catch (e) {
      console.warn('Piper synthesis failed, falling back', e)
      this.piperEngine = null
      return this.speakBrowser(text)
    }
  }

  private speakBrowser(text: string, onWordIndex?: (charIndex: number) => void): Promise<void> {
    return new Promise<void>((resolve) => {
      if (!('speechSynthesis' in window)) {
        this.setState('error')
        resolve()
        return
      }
      window.speechSynthesis.cancel()
      const utt = new SpeechSynthesisUtterance(text)
      utt.rate = this.rate
      utt.lang = TTS_VOICES.find(v => v.id === this.currentVoice)?.lang ?? 'en-US'

      const voices = window.speechSynthesis.getVoices()
      const match = voices.find(v => v.lang.startsWith(utt.lang.slice(0, 5)))
      if (match) utt.voice = match

      if (onWordIndex) {
        utt.onboundary = (e: any) => { if (e.name === 'word') onWordIndex(e.charIndex) }
      }
      utt.onend = () => { this.utterance = null; this.setState('idle'); resolve() }
      utt.onerror = () => { this.utterance = null; this.setState('error'); resolve() }

      this.utterance = utt
      window.speechSynthesis.speak(utt)
    })
  }

  pause() {
    if (this.audioCtx?.state === 'running') {
      this.audioCtx.suspend()
      this.setState('paused')
    } else if (window.speechSynthesis?.speaking) {
      window.speechSynthesis.pause()
      this.setState('paused')
    }
  }

  resume() {
    if (this.audioCtx?.state === 'suspended') {
      this.audioCtx.resume()
      this.setState('speaking')
    } else if (window.speechSynthesis?.paused) {
      window.speechSynthesis.resume()
      this.setState('speaking')
    }
  }

  stop() {
    if (this.currentSource) {
      try { this.currentSource.stop() } catch {}
      this.currentSource = null
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    this.utterance = null
    if (this.state !== 'idle') this.setState('idle')
  }

  // BUG FIX: speakSequence now correctly awaits each speak() Promise
  async speakSequence(
    chunks: string[],
    onChunkStart?: (idx: number) => void,
    signal?: AbortSignal
  ): Promise<void> {
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
// TTS Engine — Piper (offline neural) with Web Speech API fallback
// Piper via piper-tts-web (WASM + ONNX), graceful fallback to browser speechSynthesis

export type TTSVoice = {
  id: string
  label: string
  lang: string
  quality: 'high' | 'medium' | 'low'
  piperModel?: string
}

export const TTS_VOICES: TTSVoice[] = [
  { id: 'en_US-amy-medium',     label: 'Amy (US)',       lang: 'en-US', quality: 'high',   piperModel: 'en_US-amy-medium' },
  { id: 'en_US-lessac-medium',  label: 'Lessac (US)',    lang: 'en-US', quality: 'high',   piperModel: 'en_US-lessac-medium' },
  { id: 'en_US-ryan-medium',    label: 'Ryan (US)',      lang: 'en-US', quality: 'high',   piperModel: 'en_US-ryan-medium' },
  { id: 'en_GB-alba-medium',    label: 'Alba (UK)',      lang: 'en-GB', quality: 'high',   piperModel: 'en_GB-alba-medium' },
  { id: 'en_IN-indic-medium',   label: 'Indic (IN)',     lang: 'en-IN', quality: 'medium', piperModel: 'en_IN-indic_tts-medium' },
  { id: 'browser-default',      label: 'Browser voice',  lang: 'en-US', quality: 'low' },
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

  setVoice(voiceId: string) {
    this.currentVoice = voiceId
    this.stop()
  }

  setRate(r: number) {
    this.rate = Math.max(0.5, Math.min(2.0, r))
  }

  getRate() { return this.rate }

  async loadPiper(voiceId: string): Promise<boolean> {
    try {
      // Try to dynamically import piper-tts-web at runtime without static analysis
      // so the bundler doesn't try to resolve it during build.
      // @ts-ignore
      let mod: any = null
      try {
        // Use Function wrapper to avoid static import detection by bundlers
        // eslint-disable-next-line no-new-func
        mod = await (new Function('return import("piper-tts-web")'))().catch(() => null)
      } catch {
        mod = null
      }
      if (!mod) return false

      this.setState('loading')
      const PiperTTS = mod.default || mod.PiperTTS
      this.piperEngine = new PiperTTS()
      await this.piperEngine.loadVoice(voiceId)
      return true
    } catch (e) {
      console.warn('Piper TTS load failed, using browser fallback', e)
      return false
    }
  }

  async speak(text: string, onWordIndex?: (charIndex: number) => void): Promise<void> {
    if (!text.trim()) return
    this.stop()
    this.setState('speaking')

    const voice = TTS_VOICES.find(v => v.id === this.currentVoice) ?? TTS_VOICES[TTS_VOICES.length - 1]

    // Try Piper first
    if (voice.piperModel) {
      try {
        if (!this.piperEngine) {
          const loaded = await this.loadPiper(voice.piperModel)
          if (!loaded) throw new Error('Piper unavailable')
        }
        const audioBuffer = await this.piperEngine.synthesize(text)
        if (!this.audioCtx) this.audioCtx = new AudioContext()
        if (this.audioCtx.state === 'suspended') await this.audioCtx.resume()

        const source = this.audioCtx.createBufferSource()
        source.buffer = audioBuffer
        source.playbackRate.value = this.rate
        source.connect(this.audioCtx.destination)
        this.currentSource = source

        source.start()
        source.onended = () => {
          this.currentSource = null
          this.setState('idle')
        }
        return
      } catch (e) {
        console.warn('Piper synthesis failed, falling back to browser TTS', e)
        this.piperEngine = null
      }
    }

    // Web Speech API fallback
    this.speakBrowser(text, onWordIndex)
  }

  private speakBrowser(text: string, onWordIndex?: (charIndex: number) => void) {
    if (!('speechSynthesis' in window)) {
      this.setState('error')
      return
    }
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    utt.rate = this.rate
    utt.lang = TTS_VOICES.find(v => v.id === this.currentVoice)?.lang ?? 'en-US'

    // Pick matching voice if available
    const voices = window.speechSynthesis.getVoices()
    const match = voices.find(v => v.lang.startsWith(utt.lang.slice(0, 5)))
    if (match) utt.voice = match

    if (onWordIndex) {
      utt.onboundary = (e: any) => {
        if (e.name === 'word') onWordIndex(e.charIndex)
      }
    }
    utt.onend = () => { this.utterance = null; this.setState('idle') }
    utt.onerror = () => { this.utterance = null; this.setState('error') }

    this.utterance = utt
    window.speechSynthesis.speak(utt)
  }

  pause() {
    if (this.currentSource) {
      this.audioCtx?.suspend()
      this.setState('paused')
    } else if (this.utterance) {
      window.speechSynthesis.pause()
      this.setState('paused')
    }
  }

  resume() {
    if (this.audioCtx?.state === 'suspended') {
      this.audioCtx.resume()
      this.setState('speaking')
    } else if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume()
      this.setState('speaking')
    }
  }

  stop() {
    if (this.currentSource) {
      try { this.currentSource.stop() } catch {}
      this.currentSource = null
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    if (this.utterance) this.utterance = null
    this.setState('idle')
  }

  // Read an array of text chunks sequentially (for PDF read-aloud)
  async speakSequence(
    chunks: string[],
    onChunkStart?: (idx: number) => void,
    signal?: AbortSignal
  ): Promise<void> {
    for (let i = 0; i < chunks.length; i++) {
      if (signal?.aborted) break
      onChunkStart?.(i)
      await new Promise<void>((resolve) => {
        this.speak(chunks[i]).then(() => {
          // wait for state to go back to idle
          const unsub = this.onStateChange((s) => {
            if (s === 'idle' || s === 'error') {
              unsub()
              resolve()
            }
          })
        })
      })
      if (signal?.aborted) break
    }
  }
}

// Singleton
export const ttsEngine = new TTSEngine()
