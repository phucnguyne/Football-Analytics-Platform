import { Container, Grid } from '@/components/ui/grid'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Activity, TrendingUp, Users, Shield, ArrowRight } from 'lucide-react'

export default function Home() {
  return (
    <div className="flex flex-col gap-16 pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-24 lg:pt-32">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:32px_32px] dark:bg-grid-black/[0.02]" />
        <Container className="relative z-10 flex flex-col items-center text-center">
          <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary mb-8 animate-fade-in">
            <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse" />
            Live Data Feed Active
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl mb-6 max-w-4xl animate-slide-in">
            Unleash the Power of <br className="hidden sm:block" />
            <span className="text-gradient">Football Analytics</span>
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground sm:text-xl mb-10 animate-slide-in [animation-delay:150ms]">
            Advanced tactical insights, player performance tracking, and predictive modeling for the modern football professional.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 animate-slide-in [animation-delay:300ms]">
            <Button size="lg" className="h-12 px-8 text-base shadow-lg shadow-primary/20 transition-transform hover:scale-105">
              Start Analysis <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Dialog>
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
                  <Button type="submit">Submit Request</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </Container>
      </section>

      {/* Decorative line */}
      <div className="w-full flex justify-center overflow-hidden">
        <div className="w-full max-w-7xl h-px line-t opacity-50" />
      </div>

      {/* Stats Section */}
      <Container>
        <div className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight mb-2">Platform Overview</h2>
          <p className="text-muted-foreground">Real-time metrics powering the next generation of football.</p>
        </div>
        <Grid cols={4} gap="lg">
          <Card className="group hover:border-primary/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Matches Analyzed</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">14,231</div>
              <p className="text-xs text-muted-foreground mt-1">
                +20% from last month
              </p>
            </CardContent>
          </Card>
          <Card className="group hover:border-primary/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Player Profiles</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">89,402</div>
              <p className="text-xs text-muted-foreground mt-1">
                Across 150+ leagues
              </p>
            </CardContent>
          </Card>
          <Card className="group hover:border-primary/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Predictive Accuracy</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">84.2%</div>
              <p className="text-xs text-muted-foreground mt-1">
                xG and Match outcomes
              </p>
            </CardContent>
          </Card>
          <Card className="group hover:border-primary/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Data Integrity</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">99.9%</div>
              <p className="text-xs text-muted-foreground mt-1">
                Verified through API
              </p>
            </CardContent>
          </Card>
        </Grid>
      </Container>
    </div>
  )
}
