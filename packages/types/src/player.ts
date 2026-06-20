import type { Position } from './enums'

export interface Player {
  id: string
  name: string
  position?: Position | string
  nationality?: string
  dateOfBirth?: string
  teamId: string
  photo?: string
  shirtNumber?: number
}
