import type { PrismaClient } from '@prisma/client'
import { sendNotification } from 'web-push'

export async function deliverMatchPush(prisma: PrismaClient) {
  const subject = process.env.VAPID_SUBJECT
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!subject || !publicKey || !privateKey) return 0

  const now = new Date()
  const fresh = new Date(now.getTime() - 10 * 60_000)
  const expired = new Date(now.getTime() - 7 * 24 * 60 * 60_000)
  await prisma.pushDelivery.deleteMany({ where: { createdAt: { lt: expired } } })
  const rows = await prisma.pushDelivery.findMany({
    where: { sentAt: null, availableAt: { lte: now }, createdAt: { gte: fresh } },
    include: { subscription: true },
    orderBy: { createdAt: 'asc' },
    take: 100,
  })

  const lease = new Date(now.getTime() + 120_000)
  let sent = 0

  for (let offset = 0; offset < rows.length; offset += 20) {
    await Promise.all(rows.slice(offset, offset + 20).map(async (row) => {
      const { subscriptionId, eventKey, subscription, matchId } = row
      const key = { subscriptionId, eventKey }
      const claimed = await prisma.pushDelivery.updateMany({
        where: { ...key, sentAt: null, availableAt: row.availableAt },
        data: { availableAt: lease, attempts: { increment: 1 } },
      })
      if (!claimed.count) return

      const goal = row.kind === 'GOAL'
      const title = subscription.locale === 'vi'
        ? goal ? 'Bàn thắng' : 'Kết quả chung cuộc'
        : goal ? 'Goal' : 'Full time'
      try {
        await sendNotification({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        }, JSON.stringify({
          title,
          body: `${row.homeTeam} ${row.homeScore}–${row.awayScore} ${row.awayTeam}`,
          matchId,
          tag: eventKey,
        }), { TTL: 300, timeout: 5_000, vapidDetails: { subject, publicKey, privateKey } })
      } catch (error) {
        const status = (error as { statusCode?: number } | null)?.statusCode
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.deleteMany({ where: { id: subscriptionId } })
        } else {
          const retryAfter = new Date(Date.now() + 60_000 * Math.min(2 ** row.attempts, 8))
          await prisma.pushDelivery.updateMany({ where: key, data: { availableAt: retryAfter } })
          console.warn('Match push delivery failed', { matchId, status })
        }
        return
      }

      await prisma.pushDelivery.updateMany({ where: key, data: { sentAt: new Date() } })
      sent++
    }))
  }

  return sent
}
