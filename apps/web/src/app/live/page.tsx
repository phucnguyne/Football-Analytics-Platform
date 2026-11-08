import { Container } from '@/components/ui/grid'
import { LiveScoreboard } from '@/components/matches/LiveScoreboard'

export default function LiveMatchesPage() {
  return (
    <Container size="2xl" className="py-10">
      <LiveScoreboard />
    </Container>
  )
}
