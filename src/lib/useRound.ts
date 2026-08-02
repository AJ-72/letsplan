import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export interface Round {
  id: string
  status: 'open' | 'resolved' | 'tie' | 'no_result'
  winner_suggestion_id: string | null
  settled_suggestion_id: string | null
  settled_by: string | null
  settled_at: string | null
  closes_at: string
}

const COLUMNS =
  'id, status, winner_suggestion_id, settled_suggestion_id, settled_by, settled_at, closes_at'

export function useRound(roundId: string | null) {
  const [round, setRound] = useState<Round | null>(null)

  useEffect(() => {
    if (!roundId) return

    async function fetch() {
      const { data } = await supabase
        .from('suggestion_rounds')
        .select(COLUMNS)
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
        payload => setRound(payload.new as Round)
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [roundId])

  return round
}
