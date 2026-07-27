import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { SwipeDeck } from './components/SwipeDeck'
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      // find the open round for a group this user belongs to
      const { data: member } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', session.user.id)
        .limit(1)
        .single()

      if (!member) { setLoading(false); return }

      const { data: round } = await supabase
        .from('suggestion_rounds')
        .select('id')
        .eq('group_id', member.group_id)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .single()

      if (!round) { setLoading(false); return }

      const { data } = await supabase
        .from('suggestions')
        .select('id, place:places(id, name, blurb)')
        .eq('round_id', round.id)

      setSuggestions((data as unknown as Suggestion[]) ?? [])
      setLoading(false)
    }
    load()
  }, [session.user.id])

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <div>
      <h1>Let's Plan</h1>
      <p>Signed in as {session.user.email}</p>
      {loading ? <p>Loading…</p> : (
        <SwipeDeck
          cards={suggestions.map(s => ({ id: s.id, name: s.place.name, blurb: s.place.blurb }))}
          onVote={(id, vote) => console.log('vote', id, vote)}
        />
      )}
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
