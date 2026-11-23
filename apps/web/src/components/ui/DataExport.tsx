'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { toCsv, type ExportCell } from '@/lib/data-export'

export function DataExport({ filename, title, columns, rows, landscape = false }: {
  filename: string
  title: string
  columns: string[]
  rows: ExportCell[][]
  landscape?: boolean
}) {
  const t = useTranslations('Export')
  const [working, setWorking] = useState(false)
  const [failed, setFailed] = useState(false)

  function downloadCsv() {
    setFailed(false)
    const csv = new Blob(['\uFEFF', toCsv(columns, rows)], { type: 'text/csv;charset=utf-8' })
    const objectUrl = URL.createObjectURL(csv)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = `${filename}.csv`
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000)
  }

  async function downloadPdf() {
    setWorking(true)
    setFailed(false)
    try {
      const [{ default: pdfMake }, { default: fonts }] = await Promise.all([
        import('pdfmake/build/pdfmake'),
        import('pdfmake/build/vfs_fonts'),
      ])
      pdfMake.addVirtualFileSystem(fonts)
      await pdfMake.createPdf({
        pageOrientation: landscape ? 'landscape' : 'portrait',
        info: { title },
        defaultStyle: { fontSize: 10 },
        content: [
          { text: title, fontSize: 18, bold: true, margin: [0, 0, 0, 14] },
          {
            layout: 'lightHorizontalLines',
            table: {
              headerRows: 1,
              widths: columns.map((_, index) => landscape && index !== 1 ? 'auto' : '*'),
              body: [
                columns.map((text) => ({ text, bold: true })),
                ...rows.map((row) => row.map((cell) => String(cell ?? ''))),
              ],
            },
          },
        ],
      }).download(`${filename}.pdf`)
    } catch {
      setFailed(true)
    } finally {
      setWorking(false)
    }
  }

  if (!rows.length) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" type="button" onClick={downloadCsv}>{t('csv')}</Button>
      <Button variant="outline" size="sm" type="button" disabled={working} onClick={downloadPdf}>{t('pdf')}</Button>
      {failed && <p role="alert" className="text-sm text-destructive">{t('error')}</p>}
    </div>
  )
}
