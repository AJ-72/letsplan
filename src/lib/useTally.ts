import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export interface SuggestionTally {
  voted: number
  yes: number
  total: number
}

interface Tally {
  [suggestionId: string]: SuggestionTally
}

export function useTally(roundId: string | null, groupId: string | null) {
  const [tally, setTally] = useState<Tally>({})

  useEffect(() => {
    if (!roundId || !groupId) return

    async function fetchAll() {
      const { data: suggestions } = await supabase
        .from('suggestions')
        .select('id')
        .eq('round_id', roundId)

      const ids = suggestions?.map(s => s.id) ?? []
      if (ids.length === 0) { setTally({}); return }

      const [{ data: votes }, { data: members }] = await Promise.all([
        // votes_visible, never the base table -- see D7
        supabase.from('votes_visible').select('suggestion_id, value').in('suggestion_id', ids),
        supabase.from('group_members').select('user_id').eq('group_id', groupId),
      ])

      const total = members?.length ?? 0
      const counts: Tally = {}
      for (const id of ids) counts[id] = { voted: 0, yes: 0, total }

      for (const v of votes ?? []) {
        const row = counts[v.suggestion_id]
        if (!row) continue
        row.voted++
        if (v.value === 'yes') row.yes++
      }

      setTally(counts)
    }

    fetchAll()

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
