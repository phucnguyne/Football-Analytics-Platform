import type { FavType } from './enums'

export interface Favorite {
  id: string
  userId: string
  type: FavType
  entityId: string
}

export interface User {
  id: string
  email: string
  name?: string
  favorites?: Favorite[]
}
