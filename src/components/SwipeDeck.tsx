import { useState } from 'react'
import { useSprings, animated, to } from '@react-spring/web'
import { useDrag } from '@use-gesture/react'

interface Card {
  id: string
  name: string
  blurb: string | null
  tally?: { voted: number; total: number }
}

interface Props {
  cards: Card[]
  onVote: (cardId: string, vote: 'yes' | 'pass') => void
}

const SWIPE_THRESHOLD = 100
const ROTATION_FACTOR = 0.1

function cardStyles(i: number, total: number) {
  const isTop = i === total - 1
  const offset = (total - 1 - i) * 6
  return {
    x: 0,
    y: -offset,
    scale: isTop ? 1 : 0.95 - (total - 1 - i) * 0.02,
    rotate: 0,
    opacity: i < total - 3 ? 0 : 1,
  }
}

export function SwipeDeck({ cards, onVote }: Props) {
  const [gone, setGone] = useState<Set<string>>(new Set())
  const [dragX, setDragX] = useState(0)

  const remaining = cards.filter(c => !gone.has(c.id))

  const [springs, api] = useSprings(remaining.length, i => ({
    ...cardStyles(i, remaining.length),
    config: { friction: 50, tension: 500 },
  }))

  const bind = useDrag(({ args: [cardId], active, movement: [mx], velocity: [vx], direction: [dx] }) => {
    setDragX(active ? mx : 0)

    const trigger = Math.abs(mx) > SWIPE_THRESHOLD || (Math.abs(vx) > 0.5 && !active)

    if (!active && trigger) {
      const vote = mx > 0 ? 'yes' : 'pass'
      const flyX = (200 + window.innerWidth) * dx

      api.start(i => {
        if (remaining[i]?.id !== cardId) return
        return {
          x: flyX,
          rotate: mx * ROTATION_FACTOR,
          scale: 1,
          config: { friction: 50, tension: 200 },
        }
      })

      setTimeout(() => {
        setGone(prev => new Set(prev).add(cardId))
        onVote(cardId, vote)
        setDragX(0)
        api.start(i => cardStyles(i, remaining.length - 1))
      }, 200)
      return
    }

    api.start(i => {
      if (remaining[i]?.id !== cardId) return
      return {
        x: active ? mx : 0,
        rotate: active ? mx * ROTATION_FACTOR : 0,
        scale: 1,
        immediate: (key) => key === 'x' || key === 'rotate',
      }
    })
  })

  if (remaining.length === 0) {
    return (
      <div style={styles.empty}>
        <p>You've voted on all suggestions.</p>
        <p>Waiting for others…</p>
      </div>
    )
  }

  const topCard = remaining[remaining.length - 1]
  const yesOpacity = Math.max(0, Math.min(1, dragX / SWIPE_THRESHOLD))
  const passOpacity = Math.max(0, Math.min(1, -dragX / SWIPE_THRESHOLD))

  return (
    <div style={styles.deck}>
      {/* hint labels */}
      <div style={{ ...styles.hint, ...styles.hintYes, opacity: yesOpacity }}>YES ✓</div>
      <div style={{ ...styles.hint, ...styles.hintPass, opacity: passOpacity }}>PASS ✕</div>

      {springs.map((spring, i) => {
        const card = remaining[i]
        if (!card) return null
        return (
          <animated.div
            key={card.id}
            {...bind(card.id)}
            style={{
              ...styles.card,
              transform: to(
                [spring.x, spring.y, spring.rotate, spring.scale],
                (x, y, r, s) => `translate(${x}px, ${y}px) rotate(${r}deg) scale(${s})`
              ),
              opacity: spring.opacity,
              zIndex: i,
              touchAction: 'none',
            }}
          >
            <h2 style={styles.cardName}>{card.name}</h2>
            {card.blurb && <p style={styles.cardBlurb}>{card.blurb}</p>}
            {card.tally && (
              <p style={styles.tally}>
                {card.tally.voted} of {card.tally.total} voted
              </p>
            )}
          </animated.div>
        )
      })}

      {/* accessible button fallback */}
      <div style={styles.buttons}>
        <button style={styles.btnPass} onClick={() => {
          onVote(topCard.id, 'pass')
          setGone(prev => new Set(prev).add(topCard.id))
        }}>
          ✕ Pass
        </button>
        <button style={styles.btnYes} onClick={() => {
          onVote(topCard.id, 'yes')
          setGone(prev => new Set(prev).add(topCard.id))
        }}>
          ✓ Yes
        </button>
      </div>

      <p style={styles.swipeHint}>← Pass &nbsp;&nbsp; Swipe &nbsp;&nbsp; Yes →</p>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  deck: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    minHeight: 420,
    userSelect: 'none',
  },
  card: {
    position: 'absolute',
    top: 20,
    width: 300,
    minHeight: 200,
    background: '#fff',
    borderRadius: 16,
    boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
    padding: '32px 24px',
    cursor: 'grab',
    willChange: 'transform',
    boxSizing: 'border-box',
  },
  cardName: {
    margin: '0 0 12px',
    fontSize: 22,
    fontWeight: 700,
    color: '#111',
  },
  cardBlurb: {
    margin: 0,
    fontSize: 15,
    color: '#555',
    lineHeight: 1.5,
  },
  hint: {
    position: 'absolute',
    top: 36,
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: 2,
    pointerEvents: 'none',
    zIndex: 100,
    transition: 'opacity 0.05s',
  },
  hintYes: {
    right: 'calc(50% - 160px)',
    color: '#22c55e',
    border: '3px solid #22c55e',
    borderRadius: 8,
    padding: '4px 10px',
    transform: 'rotate(-20deg)',
  },
  hintPass: {
    left: 'calc(50% - 160px)',
    color: '#ef4444',
    border: '3px solid #ef4444',
    borderRadius: 8,
    padding: '4px 10px',
    transform: 'rotate(20deg)',
  },
  buttons: {
    position: 'absolute',
    bottom: 48,
    display: 'flex',
    gap: 32,
    zIndex: 10,
  },
  btnYes: {
    background: '#22c55e',
    color: '#fff',
    border: 'none',
    borderRadius: 50,
    width: 64,
    height: 64,
    fontSize: 18,
    cursor: 'pointer',
    fontWeight: 700,
  },
  btnPass: {
    background: '#ef4444',
    color: '#fff',
    border: 'none',
    borderRadius: 50,
    width: 64,
    height: 64,
    fontSize: 18,
    cursor: 'pointer',
    fontWeight: 700,
  },
  tally: {
    margin: '12px 0 0',
    fontSize: 13,
    color: '#888',
  },
  swipeHint: {
    position: 'absolute',
    bottom: 16,
    fontSize: 12,
    color: '#aaa',
    letterSpacing: 1,
  },
  empty: {
    textAlign: 'center',
    padding: 40,
    color: '#555',
  },
}
