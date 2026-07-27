import { useEffect, useState } from 'react'
import { supabase } from './supabase'

interface Tally {
  [suggestionId: string]: { voted: number; total: number }
}

export function useTally(roundId: string | null, groupId: string | null) {
  const [tally, setTally] = useState<Tally>({})

  useEffect(() => {
    if (!roundId || !groupId) return

    async function fetch() {
      const [{ data: votes }, { data: members }] = await Promise.all([
        supabase
          .from('votes_visible')
          .select('suggestion_id')
          .in(
            'suggestion_id',
            (await supabase.from('suggestions').select('id').eq('round_id', roundId)).data?.map(s => s.id) ?? []
          ),
        supabase
          .from('group_members')
          .select('user_id')
          .eq('group_id', groupId),
      ])

      const total = members?.length ?? 0
      const counts: Tally = {}
      for (const v of votes ?? []) {
        counts[v.suggestion_id] ??= { voted: 0, total }
        counts[v.suggestion_id].voted++
      }
      setTally(counts)
    }

    fetch()
  }, [roundId, groupId])

  return tally
}
