import { useState } from 'react'
import { settleRound, AlreadySettledError } from '../lib/settle'
import type { SuggestionTally } from '../lib/useTally'

interface Option {
  id: string
  name: string
  blurb: string | null
}

interface Props {
  roundId: string
  suggestions: Option[]
  tally: Record<string, SuggestionTally>
  settledSuggestionId: string | null
}

/**
 * T12b / D8. A tie is not broken for the group -- they settle it between
 * themselves and record what they chose. Anyone in the group may record it and
 * the first record wins, so a confirmation step stands between a tap and a
 * permanent write.
 */
export function TieSettlement({ roundId, suggestions, tally, settledSuggestionId }: Props) {
  const [pending, setPending] = useState<Option | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Derived, not stored: the tied options are the ones sharing the top yes
  // count. Same data, same answer on every device.
  const maxYes = Math.max(0, ...suggestions.map(s => tally[s.id]?.yes ?? 0))
  const tied = suggestions.filter(s => (tally[s.id]?.yes ?? 0) === maxYes)

  if (settledSuggestionId) {
    const chosen = suggestions.find(s => s.id === settledSuggestionId)
    return (
      <div style={styles.wrap}>
        <p style={styles.eyebrow}>The group went with</p>
        <h2 style={styles.headline}>{chosen?.name ?? 'Unknown'}</h2>
        {chosen?.blurb && <p style={styles.blurb}>{chosen.blurb}</p>}
      </div>
    )
  }

  async function confirm() {
    if (!pending) return
    setSaving(true)
    setError(null)
    try {
      await settleRound(roundId, pending.id)
      // The realtime update on suggestion_rounds swaps this view for the
      // recorded outcome, on this device and everyone else's.
    } catch (e) {
      setError(
        e instanceof AlreadySettledError
          ? e.message
          : 'Could not record that. Try again.'
      )
      setSaving(false)
      setPending(null)
    }
  }

  if (pending) {
    return (
      <div style={styles.wrap}>
        <h2 style={styles.headline}>Record {pending.name} as what the group went with?</h2>
        <p style={styles.warn}>This can't be undone.</p>
        <div style={styles.row}>
          <button style={styles.secondary} onClick={() => setPending(null)} disabled={saving}>
            Cancel
          </button>
          <button style={styles.primary} onClick={confirm} disabled={saving}>
            {saving ? 'Recording…' : 'Yes, record it'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.wrap}>
      <p style={styles.eyebrow}>It's a tie</p>
      <h2 style={styles.headline}>
        {tied.length} options tied on {maxYes} {maxYes === 1 ? 'yes' : 'yeses'}
      </h2>
      <p style={styles.blurb}>
        Settle it between yourselves, then record what you went with. Anyone can record it,
        and the first one counts.
      </p>

      {error && <p style={styles.error}>{error}</p>}

      <div style={styles.options}>
        {tied.map(s => (
          <button key={s.id} style={styles.option} onClick={() => setPending(s)}>
            <span style={styles.optionName}>{s.name}</span>
            {s.blurb && <span style={styles.optionBlurb}>{s.blurb}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { padding: '24px 20px', maxWidth: 340, margin: '0 auto', textAlign: 'center' },
  eyebrow: { margin: 0, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', color: '#888' },
  headline: { margin: '8px 0 12px', fontSize: 22, lineHeight: 1.3, color: '#111' },
  blurb: { margin: '0 0 20px', fontSize: 15, color: '#555', lineHeight: 1.5 },
  warn: { margin: '0 0 20px', fontSize: 14, color: '#b45309' },
  error: { margin: '0 0 16px', fontSize: 14, color: '#b91c1c' },
  options: { display: 'flex', flexDirection: 'column', gap: 12 },
  option: {
    display: 'flex', flexDirection: 'column', gap: 4,
    padding: '16px 18px', background: '#fff', border: '1px solid #e5e5e5',
    borderRadius: 12, cursor: 'pointer', textAlign: 'left', font: 'inherit',
  },
  optionName: { fontSize: 17, fontWeight: 700, color: '#111' },
  optionBlurb: { fontSize: 14, color: '#666', lineHeight: 1.4 },
  row: { display: 'flex', gap: 12, justifyContent: 'center' },
  primary: {
    background: '#111', color: '#fff', border: 'none', borderRadius: 10,
    padding: '12px 20px', fontSize: 15, fontWeight: 600, cursor: 'pointer',
  },
  secondary: {
    background: '#fff', color: '#111', border: '1px solid #d4d4d4', borderRadius: 10,
    padding: '12px 20px', fontSize: 15, cursor: 'pointer',
  },
}
