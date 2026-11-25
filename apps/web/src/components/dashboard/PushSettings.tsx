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

type PushProblem = 'pushDenied' | 'pushError' | null
type PushState = {
  publicKey: string
  available: boolean
  registration: ServiceWorkerRegistration | null
  enabled: boolean
  problem: PushProblem
}

async function readPushState(publicKey: string): Promise<PushState> {
  const state: PushState = { publicKey, available: false, registration: null, enabled: false, problem: null }
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return state
  }

  state.available = true
  try {
    const worker = await navigator.serviceWorker.register('/sw.js')
    state.registration = worker.active ? worker : await navigator.serviceWorker.ready
    const subscription = await state.registration.pushManager.getSubscription()
    if (subscription) {
      const current = await updateSubscription('POST', { endpoint: subscription.endpoint })
      state.enabled = current.enabled
    }
    if (Notification.permission === 'denied') state.problem = 'pushDenied'
  } catch {
    state.problem = 'pushError'
  }
  return state
}

export function PushSettings({ publicKey }: { publicKey: string | null }) {
  const t = useTranslations('Dashboard')
  const locale = useLocale()
  const [state, setState] = useState<PushState | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const current = state?.publicKey === publicKey ? state : null

  useEffect(() => {
    if (!publicKey) return
    let active = true
    void readPushState(publicKey).then((result) => {
      if (active) setState(result)
    })
    return () => { active = false }
  }, [publicKey])

  async function toggle() {
    const registration = current?.registration
    if (!registration || !publicKey) return
    const update = (changes: Partial<Pick<PushState, 'enabled' | 'problem'>>) => {
      setState((previous) => previous?.publicKey === publicKey ? { ...previous, ...changes } : previous)
    }
    setBusyKey(publicKey)
    update({ problem: null })
    try {
      if (current.enabled) {
        const subscription = await registration.pushManager.getSubscription()
        if (subscription) {
          await updateSubscription('DELETE', { endpoint: subscription.endpoint })
          await subscription.unsubscribe()
        }
        update({ enabled: false })
      } else {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          if (permission === 'denied') update({ problem: 'pushDenied' })
          return
        }
        const existing = await registration.pushManager.getSubscription()
        const subscription = existing ?? await registration.pushManager.subscribe({
          userVisibleOnly: true, applicationServerKey: publicKey,
        })
        await updateSubscription('PUT', { ...subscription.toJSON(), locale })
        update({ enabled: true })
      }
    } catch {
      update({ problem: 'pushError' })
    } finally {
      setBusyKey((key) => key === publicKey ? null : key)
    }
  }

  return (
    <div className="space-y-2 border-t pt-3">
      <p className="text-sm text-muted-foreground">{t('pushDescription')}</p>
      {current?.available ? (
        <Button size="sm" type="button" variant="outline" disabled={busyKey === publicKey || !current.registration} onClick={toggle}>
          {t(current.enabled ? 'disablePush' : 'enablePush')}
        </Button>
      ) : (!publicKey || current?.available === false) && <p className="text-xs text-muted-foreground">{t('pushUnavailable')}</p>}
      {current?.problem && <p role="status" className="text-xs text-muted-foreground">{t(current.problem)}</p>}
    </div>
  )
}
