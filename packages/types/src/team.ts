export interface Team {
  id: string
  name: string
  shortName?: string
  crest?: string
  founded?: number
  venue?: string
  clubColors?: string
  address?: string
  website?: string
  history?: string
  owner?: string
  sponsor?: string
  coach?: {
    id: string
    name: string
    dateOfBirth?: string
    nationality?: string
  }
}
