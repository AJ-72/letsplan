import { useEffect, useState } from 'react'
import { supabase } from './supabase'

interface Round {
  id: string
  status: 'open' | 'resolved' | 'tie' | 'no_result'
  winner_suggestion_id: string | null
  closes_at: string
}

export function useRound(roundId: string | null) {
  const [round, setRound] = useState<Round | null>(null)

  useEffect(() => {
    if (!roundId) return

    async function fetch() {
      const { data } = await supabase
        .from('suggestion_rounds')
        .select('id, status, winner_suggestion_id, closes_at')
        .eq('id', roundId)
        .single()
      if (data) setRound(data as Round)
    }

    fetch()

    const channel = supabase
      .channel(`round:${roundId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'suggestion_rounds', filter: `id=eq.${roundId}` },
        (payload) => setRound(payload.new as Round)
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [roundId])

  return round
}
