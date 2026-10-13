import { NextRequest, NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { generatePlayerForm } from '@/lib/player-analytics'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  const { playerId } = await params
  const id = parseInt(playerId)

  if (isNaN(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 })

  try {
    const player = await prisma.player.findUnique({
      where: { id },
      include: {
        stats: true,
      },
    })

    if (!player) {
      return NextResponse.json({ error: 'player not found' }, { status: 404 })
    }

    const form = generatePlayerForm(player.id, player.stats)
    return NextResponse.json(form)
  } catch (error) {
    console.error('Error fetching player form:', error)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

