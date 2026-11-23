'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function RequestDemoDialog() {
  const t = useTranslations('Demo')
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" className="h-12 px-8 text-base">
          {t('request')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {t('description')}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">{t('name')}</Label>
            <Input id="name" placeholder="Jurgen Klopp" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="club">{t('club')}</Label>
            <Input id="club" placeholder="Liverpool FC" />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            onClick={() => {
              alert(t('submitted'))
              setOpen(false)
            }}
          >
            {t('submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}