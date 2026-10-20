import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion, useMotionValue, useTransform } from 'motion/react'
import type { PanInfo } from 'motion/react'
import { WORDS } from './words'
import { countdownBeep, goBeep, initAudio, vibrate } from './feedback'

const UNIQUE_WORDS = Array.from(new Set(WORDS))
const COLORS = ['#FF90E8', '#A6FAFF', '#B8FF9F', '#FFA07A', '#C4A1FF', '#FFFFFF']

const STACK = 6 // cards visible in the pile
const OFFSET = 12 // px each card peeks out below the one above
const SWIPE_DISTANCE = 90
const SWIPE_VELOCITY = 500
const FLY_X = 900

const INTRO_STEPS = [
  { text: 'Ready', color: '#FF90E8' },
  { text: 'Set', color: '#A6FAFF' },
  { text: 'Go!', color: '#B8FF9F' },
]
const INTRO_STEP_MS = 750

type Dir = -1 | 1

const spring = { type: 'spring', stiffness: 280, damping: 26 } as const

function shuffle<T>(items: T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export default function App() {
  const [phase, setPhase] = useState<'intro' | 'play'>('intro')
  const [deck, setDeck] = useState(() => shuffle(UNIQUE_WORDS))
  const [index, setIndex] = useState(0)
  const [exitDir, setExitDir] = useState<Dir>(1)
  // Which way each card flew off, so "prev" brings it back from the same side.
  const [exitDirs, setExitDirs] = useState<Record<number, Dir>>({})
  // Card that should fly back in (set by "prev"), null after "next".
  const [reentry, setReentry] = useState<{ index: number; dir: Dir } | null>(null)

  const startGame = useCallback(() => setPhase('play'), [])

  const next = useCallback(
    (dir: Dir = 1) => {
      setExitDir(dir)
      setExitDirs((d) => ({ ...d, [index]: dir }))
      setReentry(null)
      if (index + STACK + 1 >= deck.length) setDeck((d) => [...d, ...shuffle(UNIQUE_WORDS)])
      setIndex(index + 1)
    },
    [index, deck.length],
  )

  const prev = useCallback(() => {
    if (index === 0) return
    setReentry({ index: index - 1, dir: exitDirs[index - 1] ?? 1 })
    setIndex(index - 1)
  }, [index, exitDirs])

  useEffect(() => {
    if (phase !== 'play') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        next(1)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prev()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, next, prev])

  const pile = Array.from({ length: STACK }, (_, p) => index + p).filter((i) => i < deck.length)

  return (
    <div
      className="flex min-h-dvh flex-col items-center font-sans select-none bg-[radial-gradient(rgba(0,0,0,0.16)_1.5px,transparent_1.5px)] [background-size:22px_22px]"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
      }}
    >
      <AnimatePresence>{phase === 'intro' && <Intro onDone={startGame} />}</AnimatePresence>

      <header className="flex w-full max-w-sm items-center justify-between">
        <h1 className="font-display text-2xl tracking-tight sm:text-3xl">
          SING<span className="text-[#FF90E8] [-webkit-text-stroke:2px_black]">4</span>ME
        </h1>
        <span className="border-3 border-black bg-white px-3 py-1 text-sm font-bold shadow-brutal-xs">
          ROUND {index + 1}
        </span>
      </header>

      <main className="flex w-full flex-1 flex-col items-center justify-center py-6">
        <div
          className="relative aspect-[4/5]"
          style={{ width: 'min(24rem, 100%, 46dvh)', marginBottom: (STACK - 1) * OFFSET }}
        >
          <AnimatePresence custom={exitDir}>
            {phase === 'play' &&
              pile
                .slice()
                .reverse()
                .map((i) => {
                  const position = i - index
                  const enterFrom = reentry?.index === i ? reentry.dir : null
                  return (
                    <Card
                      key={i}
                      number={i + 1}
                      word={deck[i]}
                      color={COLORS[i % COLORS.length]}
                      position={position}
                      enterFrom={enterFrom}
                      onSwipe={next}
                    />
                  )
                })}
          </AnimatePresence>
        </div>
        <motion.p
          className="mt-6 text-xs font-bold uppercase tracking-[0.3em] opacity-60"
          initial={{ opacity: 0 }}
          animate={{ opacity: phase === 'play' ? 0.6 : 0 }}
          transition={{ delay: 0.4 }}
        >
          ← swipe →
        </motion.p>
      </main>

      <footer className="flex w-full max-w-sm justify-center">
        <button
          type="button"
          onClick={prev}
          disabled={index === 0}
          aria-label="Previous word"
          className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-black bg-white shadow-brutal-sm transition-[transform,box-shadow] duration-75 touch-manipulation active:translate-x-1 active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-40 disabled:active:translate-0 disabled:active:shadow-brutal-sm"
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden="true">
            <path d="M11 6v12L2 12l9-6zm11 0v12l-9-6 9-6z" />
          </svg>
        </button>
      </footer>
    </div>
  )
}

function Intro({ onDone }: { onDone: () => void }) {
  // -1 = waiting for a tap: browsers only allow audio after a user gesture.
  const [step, setStep] = useState(-1)

  useEffect(() => {
    if (step < 0) return
    const t = setTimeout(() => {
      const nextStep = step + 1
      if (nextStep < INTRO_STEPS.length) {
        setStep(nextStep)
        if (nextStep === INTRO_STEPS.length - 1) goBeep()
        else countdownBeep()
      } else {
        onDone()
      }
    }, INTRO_STEP_MS)
    return () => clearTimeout(t)
  }, [step, onDone])

  const start = () => {
    initAudio()
    countdownBeep()
    setStep(0)
  }

  const current = step < 0 ? null : INTRO_STEPS[step]

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-[#FFDE59] bg-[radial-gradient(rgba(0,0,0,0.16)_1.5px,transparent_1.5px)] [background-size:22px_22px]"
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
      onClick={step < 0 ? start : onDone}
    >
      <AnimatePresence mode="wait">
        {current ? (
          <motion.div
            key={step}
            className="rounded-3xl border-4 border-black px-8 py-4 font-display text-[clamp(3rem,18vw,8rem)] leading-none uppercase"
            style={{ backgroundColor: current.color }}
            initial={{ scale: 0.3, opacity: 0, rotate: -8 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 1.4, opacity: 0, transition: { duration: 0.18, ease: 'easeIn' } }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
          >
            {current.text}
          </motion.div>
        ) : (
          <motion.div
            key="tap"
            className="flex flex-col items-center gap-4"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.2, opacity: 0, transition: { duration: 0.15 } }}
          >
            <motion.div
              className="rounded-3xl border-4 border-black bg-white px-8 py-5 font-display text-[clamp(2rem,10vw,4rem)] leading-none uppercase shadow-brutal"
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            >
              Tap to start
            </motion.div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] opacity-60">sound on 🔊</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

type CardProps = {
  number: number
  word: string
  color: string
  position: number
  enterFrom: Dir | null
  onSwipe: (dir: Dir) => void
}

function Card({ number, word, color, position, enterFrom, onSwipe }: CardProps) {
  const isTop = position === 0
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-300, 300], [-18, 18])
  const stampOpacity = useTransform(x, [-140, -50, 50, 140], [1, 0, 0, 1])
  const stampRotate = useTransform(x, [-140, 140], [12, -12])

  // Archivo Black uppercase glyphs are ~0.8em wide; fit the longest token to the card.
  const longest = Math.max(...word.split(' ').map((w) => w.length))
  const wordStyle = { fontSize: `min(5rem, calc(100cqw / ${(longest * 0.8).toFixed(2)}))` }

  const rest = {
    x: 0,
    y: position * OFFSET,
    scale: 1 - position * 0.04,
    rotate: position === 0 ? 0 : number % 2 ? 2 : -2,
    opacity: 1,
  }

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const swiped =
      Math.abs(info.offset.x) > SWIPE_DISTANCE || Math.abs(info.velocity.x) > SWIPE_VELOCITY
    if (swiped) {
      vibrate(25)
      onSwipe(info.offset.x > 0 ? 1 : -1)
    }
  }

  return (
    <motion.div
      className="absolute inset-0"
      style={{ zIndex: STACK - position }}
      initial={
        enterFrom
          ? { x: enterFrom * FLY_X, y: 0, scale: 1, rotate: enterFrom * 20, opacity: 0 }
          : { x: 0, y: (position + 1) * OFFSET, scale: 1 - (position + 1) * 0.04, rotate: 0, opacity: 0 }
      }
      animate={rest}
      variants={{
        exit: (dir: Dir) => ({
          x: dir * FLY_X,
          rotate: dir * 20,
          opacity: 0,
          transition: { duration: 0.35, ease: 'easeIn' },
        }),
      }}
      exit="exit"
      transition={spring}
    >
      <motion.div
        className={`@container relative flex h-full w-full items-center justify-center rounded-3xl border-4 border-black p-5 sm:p-6 ${
          isTop ? 'cursor-grab active:cursor-grabbing' : ''
        }`}
        style={{ x, rotate, backgroundColor: color }}
        drag={isTop ? 'x' : false}
        dragSnapToOrigin
        dragElastic={0.9}
        onDragEnd={onDragEnd}
        whileTap={isTop ? { scale: 1.02 } : undefined}
      >
        <span className="absolute top-5 right-5 font-display text-xl leading-none sm:top-6 sm:right-6">
          ♪
        </span>

        <p className="text-center font-display leading-none uppercase" style={wordStyle}>
          {word}
        </p>

        {isTop && (
          <motion.div
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            style={{ opacity: stampOpacity, rotate: stampRotate }}
          >
            <span className="border-4 border-black bg-[#FFDE59] px-4 py-2 font-display text-3xl uppercase shadow-brutal-sm">
              Next!
            </span>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  )
}
