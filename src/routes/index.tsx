import { createFileRoute, Link } from "@tanstack/react-router";
import { Pill, Search, MapPin, QrCode, ShieldCheck, BellRing, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SiteHeader } from "@/components/site-header";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MediVerify — Find, reserve & verify medicines" },
      { name: "description", content: "Search nearby pharmacies, reserve medicines, and verify authenticity with QR codes." },
    ],
  }),
  component: Home,
});

const features = [
  {
    icon: Search,
    title: "Search medicines",
    desc: "Find any prescription or OTC medicine in seconds.",
    link: "/search",
  },
  {
    icon: MapPin,
    title: "Nearby pharmacies",
    desc: "See real-time availability at pharmacies around you.",
    link: "/pharmacy",
  },
  {
    icon: QrCode,
    title: "QR authenticity",
    desc: "Scan the pack QR to verify the batch is genuine.",
    link: "/verify",
  },
  {
    icon: BellRing,
    title: "Reserve & alerts",
    desc: "Reserve stock before you arrive and get low-stock alerts.",
    link: "/search",
  },
];

function Home() {
  return (
    <div className="min-h-screen bg-soft">
      <SiteHeader />

      <section className="relative overflow-hidden">
        <div className="container mx-auto grid gap-12 px-4 py-20 lg:grid-cols-2 lg:py-28">
          <div className="flex flex-col justify-center">
            <span className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-card">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Trusted healthcare network
            </span>
            <h1 className="text-balance text-5xl font-bold tracking-tight text-foreground lg:text-6xl">
              Find real medicine.<br />
              <span className="bg-hero bg-clip-text text-transparent">Verified, nearby, fast.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              MediVerify connects patients with verified pharmacies — search availability,
              reserve in one tap, and confirm every pack is authentic with a QR scan.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg"><Link to="/search">Search medicines <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
              <Button asChild variant="outline" size="lg"><Link to="/verify"><QrCode className="mr-2 h-4 w-4" />Verify a pack</Link></Button>
            </div>
            <div className="mt-10 grid max-w-md grid-cols-3 gap-6">
              {[["98%","Auth rate"],["2.1k+","Pharmacies"],["24/7","Verification"]].map(([n,l]) => (
                <div key={l}>
                  <div className="text-2xl font-bold text-foreground">{n}</div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">{l}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-hero opacity-20 blur-3xl" />
            <Card className="relative overflow-hidden border-0 bg-card p-8 shadow-elegant">
              <div className="mb-6 flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-hero text-primary-foreground"><Pill className="h-6 w-6" /></div>
                <div>
                  <div className="font-semibold">Paracetamol 500mg</div>
                  <div className="text-xs text-muted-foreground">Generic · Tablet · 20s</div>
                </div>
                <span className="ml-auto rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium text-success">In stock</span>
              </div>
              <div className="space-y-3">
                {[
                  ["HealthFirst Pharmacy","0.4 km · 18 units","$3.20"],
                  ["CityCare Drugs","1.1 km · 42 units","$2.95"],
                  ["MediPlus Center","2.0 km · 7 units","$3.50"],
                ].map(([n,m,p]) => (
                  <div key={n} className="flex items-center justify-between rounded-lg border bg-background/60 p-3">
                    <div>
                      <div className="text-sm font-medium">{n}</div>
                      <div className="text-xs text-muted-foreground">{m}</div>
                    </div>
                    <div className="text-sm font-semibold text-primary">{p}</div>
                  </div>
                ))}
              </div>
              <Button asChild className="mt-6 w-full"><Link to="/search">Open full search</Link></Button>
            </Card>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 pb-24">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">Everything patients and pharmacies need</h2>
          <p className="mt-3 text-muted-foreground">A modern stack built around safety, speed, and trust.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <Link to={f.link} key={f.title}>
            <Card className="group cursor-pointer border bg-card p-6 transition-all hover:shadow-elegant">
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-lg bg-accent text-accent-foreground transition-transform group-hover:scale-110">
                <f.icon className="h-5 w-5" />
              </div>
          
              <h3 className="font-semibold">{f.title}</h3>
          
              <p className="mt-1.5 text-sm text-muted-foreground">
                {f.desc}
              </p>
            </Card>
          </Link>
          ))}
        </div>
      </section>

      <footer className="border-t bg-card/50">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2">
            <Pill className="h-4 w-4 text-primary" />
            <span>© {new Date().getFullYear()} MediVerify — Healthcare you can trust.</span>
          </div>
          <div className="flex gap-4">
            <Link to="/search">Search</Link>
            <Link to="/verify">Verify</Link>
            <Link to="/login">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
