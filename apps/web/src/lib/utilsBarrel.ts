export { cn, formatDate, formatTime, formatRelativeDate } from './utils'

export {
  getTeams, getTeam,
  getPlayers, getPlayer,
  getTeamRecentMatches, getLeagueMatches,
  getLiveMatches, getStandings,
} from './api'


/** "+5" / "0" / "-3" */
export function formatGD(gd: number): string {
  return gd > 0 ? `+${gd}` : String(gd)
}

export function isMatchLive(status: string): boolean {
  return status === 'IN_PLAY' || status === 'PAUSED'
}

export function truncate(str: string, maxLength: number): string {
  return str.length > maxLength ? str.slice(0, maxLength - 1) + '…' : str
}