export const teamAccents = {
  red: { light: '#a61d31', dark: '#ff9da7' },
  claret: { light: '#731b44', dark: '#efa4c9' },
  purple: { light: '#63329a', dark: '#d5aff7' },
  navy: { light: '#183c71', dark: '#a8c8ff' },
  blue: { light: '#1854a1', dark: '#a5c9ff' },
  sky: { light: '#146282', dark: '#8ad8f5' },
  green: { light: '#226844', dark: '#8cdea9' },
  amber: { light: '#805100', dark: '#ffce6d' },
  orange: { light: '#913c0a', dark: '#ffbd8c' },
  neutral: { light: '#344154', dark: '#d3deed' },
} as const

const colorNames = [
  [/\b(claret|maroon|burgundy|wine)\b/i, 'claret'],
  [/\b(purple|violet)\b/i, 'purple'],
  [/\b(navy|dark blue|midnight)\b/i, 'navy'],
  [/\b(sky blue|light blue|pale blue|celeste|cyan)\b/i, 'sky'],
  [/\b(red|scarlet|crimson)\b/i, 'red'],
  [/\b(blue|azure)\b/i, 'blue'],
  [/\b(green|emerald)\b/i, 'green'],
  [/\b(yellow|gold|amber)\b/i, 'amber'],
  [/\b(orange|tangerine)\b/i, 'orange'],
] as const

export type TeamTheme = { name: string; accent: keyof typeof teamAccents }

export function pickTeamAccent(colors?: string | null): TeamTheme['accent'] | null {
  if (!colors) return null
  const firstClubColor = colors.split(/\/|,|\s+and\s+|\s*&\s*/i)
    .map((value) => colorNames.find(([pattern]) => pattern.test(value))?.[1])
    .find((key) => key !== undefined)
  if (firstClubColor) return firstClubColor
  return /\b(black|white|grey|gray)\b/i.test(colors) ? 'neutral' : null
}
