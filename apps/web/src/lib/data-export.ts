export type ExportCell = string | number | null | undefined

function csvCell(value: ExportCell) {
  // Preserve numbers as numbers and neutralize spreadsheet formulas in text fields.
  const text = typeof value === 'string' && /^[\s\uFEFF]*[=+\-@]|^[\t\r\n]/.test(value)
    ? `'${value}`
    : String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

export function toCsv(columns: string[], rows: ExportCell[][]) {
  return [columns, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
}
