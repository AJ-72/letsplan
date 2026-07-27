import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

function App() {
  const [status, setStatus] = useState<'checking' | 'ok' | 'error'>('checking')

  useEffect(() => {
    supabase.from('app_users').select('count').then(({ error }) => {
      // table doesn't exist yet — that's expected at T3
      // a 42P01 error means we reached Supabase successfully
      if (error?.code === 'PGRST205' || !error) {
        setStatus('ok')
      } else {
        setStatus('error')
      }
    })
  }, [])

  return (
    <div>
      <h1>Let's Plan</h1>
      <p>Supabase: {status}</p>
    </div>
  )
}

export default App
