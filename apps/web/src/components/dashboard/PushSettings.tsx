'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'

const url = '/api/push/subscription'

async function updateSubscription(method: 'POST' | 'PUT' | 'DELETE', body: object) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('Push subscription request failed')
  return res.json() as Promise<{ enabled: boolean }>
}

export function PushSettings({ publicKey }: { publicKey: string | null }) {
  const t = useTranslations('Dashboard')
  const locale = useLocale()
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const [available, setAvailable] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(true)
  const [problem, setProblem] = useState<'pushDenied' | 'pushError' | null>(null)

  useEffect(() => {
    if (!publicKey || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setAvailable(false)
      setBusy(false)
      return
    }

    let active = true
    setAvailable(true)
    async function readSubscription() {
      try {
        const worker = await navigator.serviceWorker.register('/sw.js')
        const ready = worker.active ? worker : await navigator.serviceWorker.ready
        if (active) setRegistration(ready)
        const subscription = await ready.pushManager.getSubscription()
        const current = subscription
          ? await updateSubscription('POST', { endpoint: subscription.endpoint })
          : { enabled: false }
        if (active) {
          setEnabled(current.enabled)
          if (Notification.permission === 'denied') setProblem('pushDenied')
        }
      } catch {
        if (active) setProblem('pushError')
      } finally {
        if (active) setBusy(false)
      }
    }
    void readSubscription()
    return () => { active = false }
  }, [publicKey])

  async function toggle() {
    if (!registration || !publicKey) return
    setBusy(true)
    setProblem(null)
    try {
      if (enabled) {
        const subscription = await registration.pushManager.getSubscription()
        if (subscription) {
          await updateSubscription('DELETE', { endpoint: subscription.endpoint })
          await subscription.unsubscribe()
        }
        setEnabled(false)
      } else {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          if (permission === 'denied') setProblem('pushDenied')
          return
        }
        const existing = await registration.pushManager.getSubscription()
        const subscription = existing ?? await registration.pushManager.subscribe({
          userVisibleOnly: true, applicationServerKey: publicKey,
        })
        await updateSubscription('PUT', { ...subscription.toJSON(), locale })
        setEnabled(true)
      }
    } catch {
      setProblem('pushError')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2 border-t pt-3">
      <p className="text-sm text-muted-foreground">{t('pushDescription')}</p>
      {available ? (
        <Button size="sm" type="button" variant="outline" disabled={busy || !registration} onClick={toggle}>
          {t(enabled ? 'disablePush' : 'enablePush')}
        </Button>
      ) : !busy && <p className="text-xs text-muted-foreground">{t('pushUnavailable')}</p>}
      {problem && <p role="status" className="text-xs text-muted-foreground">{t(problem)}</p>}
    </div>
  )
}
