import { z } from 'zod'

const entityId = z.string().regex(/^[a-z0-9_-]{1,64}$/i)
export const matchPayload = z.object({ matchId: entityId })
export const playerPayload = matchPayload.extend({ playerId: entityId })
