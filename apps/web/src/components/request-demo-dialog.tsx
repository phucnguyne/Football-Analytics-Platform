'use client'

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
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" className="h-12 px-8 text-base">
          Request Demo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request a Personalized Demo</DialogTitle>
          <DialogDescription>
            Fill out the form below and our analytics experts will reach out to schedule your demo.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="Jurgen Klopp" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="club">Club / Organization</Label>
            <Input id="club" placeholder="Liverpool FC" />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            onClick={() => {
              alert('Demo request submitted!')
              setOpen(false)
            }}
          >
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}