import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import type { Session } from '@supabase/supabase-js'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function signIn() {
    setLoading(true)
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    setSent(true)
    setLoading(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  if (session) {
    return (
      <div>
        <h1>Let's Plan</h1>
        <p>Signed in as {session.user.email}</p>
        <button onClick={signOut}>Sign out</button>
      </div>
    )
  }

  if (sent) {
    return (
      <div>
        <h1>Let's Plan</h1>
        <p>Check your email for a sign-in link.</p>
      </div>
    )
  }

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

export default App
