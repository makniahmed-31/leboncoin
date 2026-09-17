/**
 * The notification tone, synthesised rather than shipped as a file.
 *
 * A two-note blip is a few oscillator nodes and no network request, no binary in the repository,
 * no decode step and nothing to 404 on a cold cache. An asset would also have to be licensed,
 * normalised and served, all to produce two sine tones. The sound is deliberately short, quiet
 * and low-contrast: this fires while the member is reading, and anything more assertive would be
 * the first thing they turn off.
 *
 * Everything here fails silently. A browser with no Web Audio, a context the autoplay policy
 * refuses to start, a device with no output — none of them are worth an error path, because the
 * consequence is precisely that the member does not hear a sound.
 */

let context: AudioContext | null = null
let unlocked = false

type AudioContextConstructor = new () => AudioContext

function audioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === 'undefined') return null
  // webkitAudioContext for older iOS Safari, which is exactly the platform most likely to be
  // holding this app one-handed.
  const candidate =
    window.AudioContext ??
    (window as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext
  return candidate ?? null
}

function getContext(): AudioContext | null {
  if (context) return context

  const Constructor = audioContextConstructor()
  if (!Constructor) return null

  try {
    context = new Constructor()
    return context
  } catch {
    return null
  }
}

/**
 * Opens the audio context on the member's first interaction with the page.
 *
 * Browsers start a context created without a user gesture in `suspended`, and `resume()` called
 * later from a network callback — which is exactly what an arriving message is — is refused. So
 * the context is unlocked on the first click or key the member presses for any reason, long
 * before the first message arrives. Without this, the sound is silent until the member happens to
 * interact after a message rather than before one, which presents as "it works sometimes".
 *
 * Listeners are `once` and passive, and removing them is handled by `once` itself.
 */
export function primeNotificationSound(): void {
  if (unlocked || typeof window === 'undefined') return
  unlocked = true

  const unlock = () => {
    const ctx = getContext()
    if (!ctx) return
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
  }

  for (const event of ['pointerdown', 'keydown', 'touchstart'] as const) {
    window.addEventListener(event, unlock, { once: true, passive: true })
  }
}

/** Peak gain of the blip. Low on purpose; this plays over whatever else the member is doing. */
const VOLUME = 0.12

/** The two notes, as [frequency in Hz, offset in seconds]. A rising pair reads as "arrived". */
const NOTES: [number, number][] = [
  [880, 0],
  [1174.66, 0.085],
]

const NOTE_DURATION = 0.13

export function playNotificationSound(): void {
  const ctx = getContext()
  if (!ctx) return

  if (ctx.state === 'running') {
    emit(ctx)
    return
  }

  /*
   * Suspended, or `interrupted` on iOS after a call or an alarm. Resuming is asynchronous, so the
   * blip is emitted from the continuation rather than below — the state cannot have changed by
   * the next statement, and checking it there would be reading a value that is still stale.
   *
   * A rejection means the autoplay policy refused, which is the expected outcome before the
   * member has interacted with the page and is not a failure worth surfacing. The delay this adds
   * is a few milliseconds and only on the first sound after a suspension.
   */
  void ctx
    .resume()
    .then(() => emit(ctx))
    .catch(() => {})
}

/** Builds and schedules the two notes. Assumes a running context. */
function emit(ctx: AudioContext): void {
  try {
    const now = ctx.currentTime
    const master = ctx.createGain()
    master.gain.value = VOLUME
    master.connect(ctx.destination)

    for (const [frequency, offset] of NOTES) {
      const oscillator = ctx.createOscillator()
      const envelope = ctx.createGain()

      oscillator.type = 'sine'
      oscillator.frequency.value = frequency

      const start = now + offset
      const end = start + NOTE_DURATION

      /*
       * The envelope is not decoration. An oscillator switched on and off at full amplitude
       * produces a discontinuity in the waveform, which is audible as a click at each end and is
       * louder and nastier than the note itself. A short ramp in and an exponential decay out is
       * the cheapest thing that removes both.
       *
       * Exponential rather than linear on the way down because loudness is perceived
       * logarithmically: a linear fade sounds like it stops abruptly at the end.
       */
      envelope.gain.setValueAtTime(0.0001, start)
      envelope.gain.linearRampToValueAtTime(1, start + 0.012)
      envelope.gain.exponentialRampToValueAtTime(0.0001, end)

      oscillator.connect(envelope)
      envelope.connect(master)

      oscillator.start(start)
      // Stopped slightly after the envelope reaches zero, so the node is released rather than
      // left running for the life of the page.
      oscillator.stop(end + 0.02)
    }
  } catch {
    // An exhausted or closed context. Nothing to recover and nothing worth reporting.
  }
}
