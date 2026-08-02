import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { castVote } from './lib/votes'
import { useTally } from './lib/useTally'
import { useRound } from './lib/useRound'
import { SwipeDeck } from './components/SwipeDeck'
import { TieSettlement } from './components/TieSettlement'
import type { Session } from '@supabase/supabase-js'

interface Place {
  id: string
  name: string
  blurb: string | null
}

interface Suggestion {
  id: string
  place: Place
}

function SignedIn({ session }: { session: Session }) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [roundId, setRoundId] = useState<string | null>(null)
  const [groupId, setGroupId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const tally = useTally(roundId, groupId)
  const round = useRound(roundId)

  useEffect(() => {
    async function load() {
      const { data: member } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', session.user.id)
        .limit(1)
        .single()

      if (!member) { setLoading(false); return }
      setGroupId(member.group_id)

      const { data: round } = await supabase
        .from('suggestion_rounds')
        .select('id')
        .eq('group_id', member.group_id)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .single()

      if (!round) { setLoading(false); return }
      setRoundId(round.id)

      const { data } = await supabase
        .from('suggestions')
        .select('id, place:places(id, name, blurb)')
        .eq('round_id', round.id)

      setSuggestions((data as unknown as Suggestion[]) ?? [])
      setLoading(false)
    }
    load()
  }, [session.user.id])

  function renderContent() {
    if (!round || round.status === 'open') {
      return (
        <SwipeDeck
          cards={suggestions.map(s => ({
            id: s.id,
            name: s.place.name,
            blurb: s.place.blurb,
            tally: tally[s.id],
          }))}
          onVote={(id, vote) => castVote(id, vote).catch(console.error)}
        />
      )
    }

    if (round.status === 'resolved') {
      const winner = suggestions.find(s => s.id === round.winner_suggestion_id)
      return (
        <div>
          <h2>We're going to…</h2>
          <h3>{winner?.place.name ?? 'Unknown'}</h3>
          <p>{winner?.place.blurb}</p>
        </div>
      )
    }

    if (round.status === 'tie') {
      return (
        <TieSettlement
          roundId={round.id}
          suggestions={suggestions.map(s => ({
            id: s.id,
            name: s.place.name,
            blurb: s.place.blurb,
          }))}
          tally={tally}
          settledSuggestionId={round.settled_suggestion_id}
        />
      )
    }

    // no_result
    return (
      <div>
        <h2>No result</h2>
        <p>Not enough people voted before the round closed.</p>
      </div>
    )
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <div>
      <h1>Let's Plan</h1>
      <p>Signed in as {session.user.email}</p>
      {loading ? <p>Loading…</p> : renderContent()}
      <button onClick={signOut}>Sign out</button>
    </div>
  )
}

function SignIn() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function signIn() {
    setLoading(true)
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    setSent(true)
    setLoading(false)
  }

  if (sent) return (
    <div>
      <h1>Let's Plan</h1>
      <p>Check your email for a sign-in link.</p>
    </div>
  )

  return (
    <div>
      <h1>Let's Plan</h1>
      <input
        type="email"
        placeholder="your@email.com"
        value={email}
        onChange={e => setEmail(e.target.value)}
      />
      <button onClick={signIn} disabled={loading || !email}>
        {loading ? 'Sending…' : 'Send magic link'}
      </button>
    </div>
  )
}

function App() {
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  return session ? <SignedIn session={session} /> : <SignIn />
}

export default App
