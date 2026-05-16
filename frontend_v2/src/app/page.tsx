import Link from "next/link";
import { ArrowRight, Globe, Activity, Settings, Zap, Shield, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-hidden">
      {/* Hero section */}
      <section className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center px-6">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-violet-500/10 dark:bg-violet-500/15 blur-[120px]" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-teal-400/8 dark:bg-teal-400/10 blur-[80px]" />
          <div className="absolute top-0 left-0 w-[300px] h-[300px] rounded-full bg-pink-400/8 dark:bg-pink-400/10 blur-[80px]" />

          {/* Decorative hex grid */}
          <svg
            className="absolute inset-0 w-full h-full opacity-[0.035] dark:opacity-[0.05]"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern id="hex" x="0" y="0" width="50" height="57.74" patternUnits="userSpaceOnUse">
                <polygon
                  points="25,0 50,14.43 50,43.30 25,57.74 0,43.30 0,14.43"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hex)" />
          </svg>
        </div>

        {/* Content */}
        <div className="relative z-10 text-center max-w-4xl mx-auto space-y-8">
          {/* Badge */}
          <div className="flex justify-center animate-fade-in">
            <Badge className="px-4 py-1.5 text-sm rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800">
              <Zap className="w-3.5 h-3.5 mr-1.5" />
              Deterministic World Simulation
            </Badge>
          </div>

          {/* Headline */}
          <div className="space-y-4 animate-fade-in">
            <h1 className="text-6xl sm:text-7xl font-bold tracking-tight">
              <span className="text-foreground">Simulate</span>
              <br />
              <span className="bg-gradient-to-r from-violet-600 via-purple-500 to-pink-500 dark:from-violet-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
                living worlds
              </span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Build and run hexagonal world simulations. Watch health, economy,
              environment, and mobility evolve across thousands of interconnected tiles.
            </p>
          </div>

          {/* CTAs */}
          <div className="flex items-center justify-center gap-4 animate-fade-in">
            <Button asChild size="xl" className="shadow-xl shadow-violet-500/25">
              <Link href="/world">
                Launch World
                <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="xl">
              <Link href="/runs">
                View Runs
              </Link>
            </Button>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-center gap-8 pt-4 animate-fade-in">
            {[
              { label: "Max tiles", value: "3,193" },
              { label: "Variables", value: "4+" },
              { label: "Deterministic", value: "100%" },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <div className="text-2xl font-bold text-foreground">{value}</div>
                <div className="text-sm text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-4xl font-bold tracking-tight">
              Everything you need
            </h2>
            <p className="text-muted-foreground text-lg">
              A complete simulation platform from world creation to analysis.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                href: "/world",
                icon: Globe,
                color: "violet",
                title: "World",
                description:
                  "Interactive 3D hex globe with real-time tile visualization. Watch your simulation evolve with smooth, live updates.",
                cta: "Open World →",
              },
              {
                href: "/runs",
                icon: Activity,
                color: "teal",
                title: "Runs",
                description:
                  "Browse simulation history. Each run is deterministic and fully replayable from its seed and event log.",
                cta: "View Runs →",
              },
              {
                href: "/settings",
                icon: Settings,
                color: "pink",
                title: "Settings",
                description:
                  "Configure the influence matrix — how variables affect each other across ticks and neighboring tiles.",
                cta: "Configure →",
              },
            ].map(({ href, icon: Icon, color, title, description, cta }) => (
              <Link key={href} href={href} className="group">
                <div className="h-full rounded-2xl border border-border bg-card p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-violet-200 dark:hover:border-violet-800">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 bg-${color}-100 dark:bg-${color}-900/30`}
                  >
                    <Icon
                      className={`w-6 h-6 text-${color}-600 dark:text-${color}-400`}
                    />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                    {description}
                  </p>
                  <span className="text-sm font-medium text-violet-600 dark:text-violet-400 group-hover:underline">
                    {cta}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-4xl font-bold tracking-tight">How it works</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                icon: Layers,
                title: "Configure",
                description:
                  "Set hex radius, seed, spatial decay, and initial variable values. A radius of 5 creates 91 tiles.",
              },
              {
                step: "02",
                icon: Zap,
                title: "Simulate",
                description:
                  "Each tick advances the world: the influence matrix propagates effects, events fire, and neighbors are updated.",
              },
              {
                step: "03",
                icon: Shield,
                title: "Analyze",
                description:
                  "Inspect global trends, individual tile states, and LLM-generated narrative interpretations of your world.",
              },
            ].map(({ step, icon: Icon, title, description }) => (
              <div key={step} className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                      <Icon className="w-7 h-7 text-violet-600 dark:text-violet-400" />
                    </div>
                    <span className="absolute -top-2 -right-2 text-xs font-bold text-muted-foreground bg-muted rounded-full w-6 h-6 flex items-center justify-center border border-border">
                      {step}
                    </span>
                  </div>
                </div>
                <h3 className="font-semibold text-lg">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="text-4xl font-bold">Ready to simulate?</h2>
          <p className="text-muted-foreground text-lg">
            Start your first world in under 30 seconds.
          </p>
          <Button asChild size="xl" className="shadow-xl shadow-violet-500/25">
            <Link href="/world">
              <Globe className="w-5 h-5" />
              Start Simulating
              <ArrowRight className="w-5 h-5" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
