import { supabase } from './supabase'

export async function castVote(suggestionId: string, value: 'yes' | 'pass') {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('not authenticated')

  const { error } = await supabase
    .from('votes')
    .upsert(
      { suggestion_id: suggestionId, voter_id: user.id, value },
      { onConflict: 'suggestion_id,voter_id' }
    )

  if (error) throw error
}
