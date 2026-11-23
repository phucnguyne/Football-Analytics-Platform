export type SourceKind = 'real' | 'generated' | 'mixed' | 'model' | 'unavailable'

export function dataSourceFor(sources: readonly (string | null | undefined)[]): SourceKind {
  if (!sources.length || sources.some((source) => source !== 'REAL' && source !== 'GENERATED')) {
    return 'unavailable'
  }
  const real = sources.includes('REAL')
  const generated = sources.includes('GENERATED')
  return real && generated ? 'mixed' : real ? 'real' : 'generated'
}
