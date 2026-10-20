// Sound + haptic feedback. Tiny synth for UI beeps; Browsers only allow audio after a user gesture,
// so call initAudio() from a click/tap handler before the first beep.

let ctx: AudioContext | null = null

export function initAudio(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

type BeepOptions = {
  freq?: number
  duration?: number // seconds
  volume?: number // 0..1
  type?: OscillatorType
}

export function beep({ freq = 880, duration = 0.12, volume = 0.12, type = 'square' }: BeepOptions = {}) {
  const c = initAudio()
  if (!c) return
  const t = c.currentTime
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(volume, t + 0.01)
  gain.gain.setValueAtTime(volume, t + duration - 0.03)
  gain.gain.linearRampToValueAtTime(0, t + duration)
  osc.connect(gain).connect(c.destination)
  osc.start(t)
  osc.stop(t + duration)
}

export const countdownBeep = () => beep({ freq: 880, duration: 0.15 })
export const goBeep = () => beep({ freq: 1320, duration: 0.7 })

// Haptics: Android Chrome only. iOS Safari has no Vibration API, so this is a no-op there.
export function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // ignore: unsupported or blocked without user activation
  }
}
