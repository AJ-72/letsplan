import { supabase } from './supabase'

/** The round was already settled by someone else. First record wins (D8). */
export class AlreadySettledError extends Error {
  constructor() {
    super('Someone else recorded this first.')
    this.name = 'AlreadySettledError'
  }
}

/**
 * Record what the group went with after a tie.
 *
 * There is no correction path in v1, so callers must confirm with the user
 * before calling this.
 *
 * The database enforces first-record-wins two ways (0006): the RLS policy
 * matches no row once settlement is set, and the trigger raises on a second
 * attempt. Both surface here as AlreadySettledError.
 */
export async function settleRound(roundId: string, suggestionId: string) {
  const { data: auth } = await supabase.auth.getUser()
  const userId = auth.user?.id
  if (!userId) throw new Error('Not signed in.')

  const { data, error } = await supabase
    .from('suggestion_rounds')
    .update({ settled_suggestion_id: suggestionId, settled_by: userId })
    .eq('id', roundId)
    .select('id')

  // 23514 = check_violation, raised by round_settlement_write_once
  if (error) {
    if (error.code === '23514') throw new AlreadySettledError()
    throw error
  }

  // RLS filtered the row out: it stopped being tie-and-unsettled underneath us
  if (!data || data.length === 0) throw new AlreadySettledError()
}
