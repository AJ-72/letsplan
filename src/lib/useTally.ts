import { useEffect, useState } from 'react'
import { supabase } from './supabase'

interface Tally {
  [suggestionId: string]: { voted: number; total: number }
}

export function useTally(roundId: string | null, groupId: string | null) {
  const [tally, setTally] = useState<Tally>({})

  useEffect(() => {
    if (!roundId || !groupId) return

    let total = 0

    async function fetchAll() {
      const [{ data: suggestions }, { data: votes }, { data: members }] = await Promise.all([
        supabase.from('suggestions').select('id').eq('round_id', roundId),
        supabase.from('votes_visible').select('suggestion_id').in(
          'suggestion_id',
          (await supabase.from('suggestions').select('id').eq('round_id', roundId)).data?.map(s => s.id) ?? []
        ),
        supabase.from('group_members').select('user_id').eq('group_id', groupId),
      ])

      total = members?.length ?? 0
      const suggestionIds = new Set(suggestions?.map(s => s.id) ?? [])
      const counts: Tally = {}

      for (const id of suggestionIds) {
        counts[id] = { voted: 0, total }
      }
      for (const v of votes ?? []) {
        if (counts[v.suggestion_id]) counts[v.suggestion_id].voted++
      }
      setTally(counts)
    }

    fetchAll()

    // realtime: re-fetch tally on any vote insert/update for this round
    const channel = supabase
      .channel(`votes:round:${roundId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'votes' },
        () => { fetchAll() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [roundId, groupId])

  return tally
}
