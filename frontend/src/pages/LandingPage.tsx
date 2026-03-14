import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Brain,
  ArrowRight,
  Zap,
  GitBranch,
  Shield,
  Columns3,
  FileText,
  Eye,
  RefreshCw,
} from "lucide-react";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.08,
      duration: 0.45,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  }),
};

const features = [
  {
    icon: FileText,
    title: "AI-Generated PRD",
    desc: "Describe your project and let AI create a full requirements document in seconds.",
  },
  {
    icon: Columns3,
    title: "Smart Kanban",
    desc: "Tasks auto-populate from the roadmap. Board updates as agents detect activity.",
  },
  {
    icon: Eye,
    title: "Real-Time Monitoring",
    desc: "GitHub commits, Slack messages, and Jira issues tracked every 30 seconds.",
  },
  {
    icon: Shield,
    title: "Risk Detection",
    desc: "AI flags blockers, delays, and inactive developers before they become problems.",
  },
  {
    icon: RefreshCw,
    title: "Auto-Replanning",
    desc: "When things change, the AI adjusts tasks, deadlines, and workload automatically.",
  },
  {
    icon: GitBranch,
    title: "Deep Integrations",
    desc: "Connect GitHub, Slack, Jira, Notion, and Discord in one click.",
  },
];

const agents = [
  { name: "Requirement Agent", desc: "Generates PRD", color: "from-blue-500/15 to-blue-600/5" },
  { name: "Planning Agent", desc: "Creates roadmap & tasks", color: "from-violet-500/15 to-violet-600/5" },
  { name: "Monitoring Agent", desc: "Tracks activity", color: "from-emerald-500/15 to-emerald-600/5" },
  { name: "Risk Agent", desc: "Detects blockers", color: "from-amber-500/15 to-amber-600/5" },
  { name: "Replanning Agent", desc: "Adjusts plans", color: "from-rose-500/15 to-rose-600/5" },
];

const sectionClass = "mx-auto max-w-6xl px-6";
const sectionPadding = "py-20 lg:py-28";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border/80 bg-background/95 backdrop-blur-md">
        <div className={`${sectionClass} flex h-16 items-center justify-between`}>
          <Link
            to="/"
            className="flex items-center gap-2.5 text-foreground hover:opacity-90 transition-opacity focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg outline-none"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Brain className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-base font-semibold tracking-tight">ProjectAI</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <a
              href="#features"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:text-foreground focus-visible:outline-none"
            >
              Features
            </a>
            <a
              href="#agents"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:text-foreground focus-visible:outline-none"
            >
              Agents
            </a>
            <a
              href="#how"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:text-foreground focus-visible:outline-none"
            >
              How it works
            </a>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/signup">
                Get started
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(221_83%_50%/0.06),transparent)]" />
        <div className={`${sectionClass} ${sectionPadding} pt-20 lg:pt-24 relative`}>
          <motion.div
            className="mx-auto max-w-3xl text-center"
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
          >
            <motion.div variants={fadeUp} custom={0}>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
                <Zap className="h-3.5 w-3.5 text-primary" />
                AI-Powered Project Management
              </span>
            </motion.div>
            <motion.h1
              variants={fadeUp}
              custom={1}
              className="mt-6 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl leading-[1.1]"
            >
              Ship faster with{" "}
              <span className="bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent">
                AI agents
              </span>{" "}
              managing your project
            </motion.h1>
            <motion.p
              variants={fadeUp}
              custom={2}
              className="mt-5 text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed"
            >
              Five intelligent agents handle requirements, planning, monitoring, risk detection, and
              replanning — so your team can focus on building.
            </motion.p>
            <motion.div
              variants={fadeUp}
              custom={3}
              className="mt-10 flex flex-wrap items-center justify-center gap-3"
            >
              <Button size="lg" className="h-11 px-6" asChild>
                <Link to="/signup">
                  Start for free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="h-11 px-6" asChild>
                <a href="#features">See features</a>
              </Button>
            </motion.div>
          </motion.div>

          {/* Dashboard preview */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="mt-16 mx-auto max-w-4xl"
          >
            <div className="rounded-xl border border-border/80 bg-card shadow-xl shadow-primary/[0.03] overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border px-4 py-3 bg-muted/30">
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
                </div>
                <div className="flex-1 text-center">
                  <span className="text-[11px] text-muted-foreground font-mono">
                    projectai.app/dashboard
                  </span>
                </div>
              </div>
              <div className="flex">
                <div className="hidden sm:block w-44 border-r border-border bg-muted/20 p-3 space-y-1">
                  {["Workspace", "PRD", "Roadmap", "Kanban", "Activity"].map((n) => (
                    <div
                      key={n}
                      className={`rounded-lg px-3 py-2 text-xs ${
                        n === "Kanban"
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground"
                      }`}
                    >
                      {n}
                    </div>
                  ))}
                </div>
                <div className="flex-1 p-4 space-y-4">
                  <div className="flex gap-4">
                    {["To Do", "In Progress", "Done"].map((col) => (
                      <div key={col} className="flex-1 space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">{col}</div>
                        {[1, 2].map((j) => (
                          <div
                            key={j}
                            className="rounded-lg border border-border/80 bg-background p-3 space-y-2"
                          >
                            <div className="h-2 w-3/4 rounded bg-muted" />
                            <div className="h-2 w-1/2 rounded bg-muted/80" />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border/80 bg-muted/20">
        <div className={`${sectionClass} ${sectionPadding}`}>
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Everything your team needs
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              From idea to launch, AI agents handle the busywork while you build what matters.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06, duration: 0.35 }}
                className="group rounded-xl border border-border/80 bg-card p-6 shadow-sm transition-all duration-200 hover:shadow-md hover:border-primary/15"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4 transition-colors duration-200 group-hover:bg-primary group-hover:text-primary-foreground">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="text-[15px] font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Agents */}
      <section id="agents" className="border-t border-border/80">
        <div className={`${sectionClass} ${sectionPadding}`}>
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              5 agents, one mission
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Each agent specializes in a part of the project lifecycle, working together seamlessly.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            {agents.map((a, i) => (
              <motion.div
                key={a.name}
                initial={{ opacity: 0, scale: 0.96 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className={`rounded-xl border border-border/80 bg-gradient-to-br ${a.color} p-6 w-full sm:w-52 text-center`}
              >
                <div className="flex h-9 w-9 mx-auto items-center justify-center rounded-full bg-card border border-border/80 mb-3">
                  <Brain className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground">{a.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{a.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-border/80 bg-muted/20">
        <div className={`${sectionClass} ${sectionPadding}`}>
          <div className="text-center mb-14">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              How it works
            </h2>
          </div>
          <div className="grid md:grid-cols-4 gap-10 max-w-4xl mx-auto">
            {[
              { step: "01", title: "Create workspace", desc: "Describe your project and invite your team." },
              { step: "02", title: "AI generates PRD", desc: "Requirement Agent creates a full product spec." },
              { step: "03", title: "Roadmap & tasks", desc: "Planning Agent builds phases and assigns work." },
              { step: "04", title: "Ship & monitor", desc: "Agents track progress, detect risks, and replan." },
            ].map((s, i) => (
              <motion.div
                key={s.step}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold mb-4">
                  {s.step}
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1">{s.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/80">
        <div className={`${sectionClass} ${sectionPadding} text-center`}>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Ready to let AI manage your project?
          </h2>
          <p className="mt-4 text-muted-foreground max-w-md mx-auto">
            Join teams shipping faster with intelligent project management.
          </p>
          <div className="mt-10">
            <Button size="lg" className="h-11 px-6" asChild>
              <Link to="/signup">
                Get started free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/80 bg-card">
        <div className={`${sectionClass} py-8 flex flex-col sm:flex-row items-center justify-between gap-4`}>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <Brain className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold text-foreground">ProjectAI</span>
          </div>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} ProjectAI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
