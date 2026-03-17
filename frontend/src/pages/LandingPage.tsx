import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Layers,
  ArrowRight,
  Sparkles,
  GitBranch,
  ShieldAlert,
  KanbanSquare,
  FileText,
  Activity,
  RefreshCw,
} from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.6,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  }),
};

const features = [
  {
    icon: FileText,
    title: "AI-Generated Requirements",
    desc: "Describe your product vision and watch as intelligence drafts a full specs document in seconds.",
  },
  {
    icon: KanbanSquare,
    title: "Smart Workflows",
    desc: "Tasks auto-populate and adapt. As agents detect activity, your boards update seamlessly.",
  },
  {
    icon: Activity,
    title: "Real-Time Monitoring",
    desc: "GitHub, Slack, and Jira activity tracked continuously to keep everyone aligned without the noise.",
  },
  {
    icon: ShieldAlert,
    title: "Predictive Risk Detection",
    desc: "Orchestrate gracefully. AI flags blockers and delays before they impact your delivery dates.",
  },
  {
    icon: RefreshCw,
    title: "Intelligent Auto-Replanning",
    desc: "When reality changes, your plans change. Timelines and task allocations adjust automatically.",
  },
  {
    icon: GitBranch,
    title: "Deep Integrations",
    desc: "Connect your entire toolchain. Works out of the box with GitHub, Slack, Notion, and Discord.",
  },
];

const agents = [
  { name: "Requirement Orchestrator", desc: "Drafts comprehensive PRDs", color: "from-indigo-500/10 to-indigo-600/5 text-indigo-600" },
  { name: "Planning Engine", desc: "Constructs adaptive roadmaps", color: "from-cyan-500/10 to-cyan-600/5 text-cyan-600" },
  { name: "Activity Monitor", desc: "Tracks cross-platform events", color: "from-teal-500/10 to-teal-600/5 text-teal-600" },
  { name: "Risk Sentinel", desc: "Identifies hidden blockers", color: "from-amber-500/10 to-amber-600/5 text-amber-600" },
  { name: "Replanning Core", desc: "Rebalances workloads dynamically", color: "from-blue-500/10 to-blue-600/5 text-blue-600" },
];

const sectionClass = "mx-auto max-w-7xl px-6 lg:px-8";
const sectionPadding = "py-24 lg:py-32";

export default function LandingPage() {
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 500], [0, 150]);
  const heroOpacity = useTransform(scrollY, [0, 300], [1, 0]);
  const dashY = useTransform(scrollY, [0, 800], [0, -100]);

  return (
    <div className="min-h-screen bg-background font-sans selection:bg-primary/20 selection:text-foreground overflow-hidden">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className={`${sectionClass} flex h-16 items-center justify-between`}>
          <Link
            to="/"
            className="flex items-center group focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg outline-none"
          >
            <span className="text-xl font-bold tracking-tight text-foreground">Consilium</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <a
              href="#features"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Features
            </a>
            <a
              href="#agents"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Intelligence
            </a>
            <a
              href="#how"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Workflow
            </a>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="hidden sm:flex text-muted-foreground hover:text-foreground font-medium" asChild>
              <Link to="/login">Log in</Link>
            </Button>
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20 font-medium" asChild>
              <Link to="/signup">
                Get Started
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_100%_100%_at_50%_-20%,rgba(79,70,229,0.1),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_100%_100%_at_50%_-20%,rgba(79,70,229,0.15),rgba(0,0,0,0))]" />
        <div className={`${sectionClass}`}>
          <motion.div
            style={{ y: heroY, opacity: heroOpacity }}
            className="mx-auto max-w-4xl text-center"
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
          >
            <motion.div variants={fadeUp} custom={0} className="flex justify-center mb-8">
              <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-white/50 dark:bg-black/50 backdrop-blur-sm px-4 py-1.5 text-xs font-semibold text-primary shadow-sm hover:border-primary/30 transition-colors">
                <Sparkles className="h-3.5 w-3.5" />
                Evolution of Project Management
              </span>
            </motion.div>
            <motion.h1
              variants={fadeUp}
              custom={1}
              className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl leading-[1.05]"
            >
              Orchestrating work <br className="hidden sm:block" />
              with <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">intelligence.</span>
            </motion.h1>
            <motion.p
              variants={fadeUp}
              custom={2}
              className="mt-8 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
            >
              Consilium seamlessly blends human creativity with artificial intelligence, handling the overhead of planning, monitoring, and adapting, so you can focus on executing your vision.
            </motion.p>
            <motion.div
              variants={fadeUp}
              custom={3}
              className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Button size="lg" className="w-full sm:w-auto h-12 px-8 text-base shadow-lg shadow-primary/25 transition-transform hover:scale-105" asChild>
                <Link to="/signup">
                  Start Orchestrating
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="w-full sm:w-auto h-12 px-8 text-base border-border/80 hover:bg-muted/50" asChild>
                <a href="#features">Explore Features</a>
              </Button>
            </motion.div>
          </motion.div>

          {/* Interactive UI Preview mock */}
          <motion.div
            style={{ y: dashY }}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8, ease: "easeOut" }}
            className="mt-20 mx-auto max-w-5xl"
          >
            <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl shadow-2xl overflow-hidden ring-1 ring-white/10 dark:ring-white/5">
              <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3 bg-muted/40">
                <div className="flex gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-400/80" />
                  <div className="h-3 w-3 rounded-full bg-amber-400/80" />
                  <div className="h-3 w-3 rounded-full bg-emerald-400/80" />
                </div>
                <div className="flex-1 text-center font-medium">
                  <span className="text-xs text-muted-foreground/80 flex items-center justify-center gap-1.5">
                    <Layers className="h-3 w-3" /> consilium.app
                  </span>
                </div>
              </div>
              <div className="flex h-[400px]">
                {/* Sidebar Mock */}
                <div className="hidden sm:flex flex-col w-64 border-r border-border/50 bg-background/50 p-4 space-y-2">
                  <div className="h-8 w-3/4 rounded-md bg-muted/80 mb-6" />
                  {["Overview", "Planning", "Roadmap", "Active Sprint", "Insights"].map((n, i) => (
                    <div
                      key={n}
                      className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                        i === 3
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      {n}
                    </div>
                  ))}
                </div>
                {/* Content Mock */}
                <div className="flex-1 p-6 sm:p-8 space-y-6 bg-gradient-to-br from-background/40 to-muted/20">
                  <div className="flex justify-between items-center mb-4">
                    <div className="h-8 w-48 rounded-md bg-muted/60" />
                    <div className="flex gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary/20" />
                      <div className="h-8 w-8 rounded-full bg-accent/20" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
                    {["To Do", "In Progress", "Review"].map((col, i) => (
                      <div key={col} className="flex-1 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-foreground/80">{col}</span>
                          <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{3 - i}</span>
                        </div>
                        {[...Array(3 - i)].map((_, j) => (
                          <motion.div
                            whileHover={{ y: -2, scale: 1.01 }}
                            key={j}
                            className="rounded-xl border border-border/60 bg-card p-4 space-y-3 shadow-sm hover:border-primary/30 transition-all cursor-pointer"
                          >
                            <div className="flex justify-between items-start">
                              <div className="h-2 w-12 rounded bg-primary/40" />
                              <div className="h-4 w-4 rounded-full bg-muted" />
                            </div>
                            <div className="h-2.5 w-full rounded bg-muted/80" />
                            <div className="h-2.5 w-2/3 rounded bg-muted/60" />
                            <div className="pt-2 flex justify-between items-center">
                              <div className="h-5 w-5 rounded-full bg-accent/30" />
                              <div className="h-1.5 w-8 rounded-full bg-muted" />
                            </div>
                          </motion.div>
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
      <section id="features" className="relative border-t border-border/40 bg-zinc-50/50 dark:bg-zinc-900/10">
        <div className={`${sectionClass} ${sectionPadding}`}>
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-sm font-semibold text-primary tracking-wide uppercase mb-3">Core Capabilities</h2>
            <h3 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl mb-6">
              A workspace that thinks with you.
            </h3>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Consilium doesn't just store tasks; it actively manages them. Say goodbye to manual updates and hello to autonomous workflow orchestration.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="group relative rounded-2xl border border-border/60 bg-card p-8 shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-primary/30 overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-10 transition-opacity duration-300 transform translate-x-4 -translate-y-4">
                  <f.icon className="w-32 h-32 text-primary" />
                </div>
                <div className="relative z-10">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-6 transition-transform duration-300 group-hover:scale-110">
                    <f.icon className="h-6 w-6" />
                  </div>
                  <h4 className="text-xl font-semibold text-foreground mb-3">{f.title}</h4>
                  <p className="text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Agents / Intelligence */}
      <section id="agents" className="relative border-t border-border/40">
        <div className={`${sectionClass} ${sectionPadding}`}>
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-sm font-semibold text-accent tracking-wide uppercase mb-3">The Intelligence Layer</h2>
            <h3 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl mb-6">
              Your autonomous teammates.
            </h3>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Consilium uses five distinct agents that continuously collaborate to analyze, plan, and guide your project to success.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {agents.map((a, i) => (
              <motion.div
                key={a.name}
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
                className={`relative rounded-2xl border border-border/50 bg-gradient-to-br ${a.color} p-6 overflow-hidden group hover:shadow-md transition-all`}
              >
                <div className="absolute inset-0 bg-white/40 dark:bg-black/20 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10 flex flex-col h-full">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background border border-border/40 shadow-sm mb-4">
                    <Sparkles className="h-5 w-5 currentColor" />
                  </div>
                  <h4 className="text-base font-bold text-foreground mb-2 mt-auto">{a.name}</h4>
                  <p className="text-sm font-medium opacity-80">{a.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow Preview */}
      <section id="how" className="relative border-t border-border/40 bg-zinc-50/50 dark:bg-zinc-900/10">
        <div className={`${sectionClass} ${sectionPadding}`}>
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              From concept to delivery, orchestrated.
            </h2>
          </div>
          <div className="relative max-w-5xl mx-auto">
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-border/50 -translate-y-1/2 hidden md:block" />
            <div className="grid md:grid-cols-4 gap-8">
              {[
                 { num: "1", title: "Initialize", desc: "Define your vision naturally. Consilium builds the structure." },
                 { num: "2", title: "Plan", desc: "Agents map out the optimal roadmap and assign tasks." },
                 { num: "3", title: "Execute", desc: "Integrations automatically sync your team's real-world progress." },
                 { num: "4", title: "Adapt", desc: "When blockers arise, Consilium instantly suggests course corrections." },
              ].map((s, i) => (
                <motion.div
                  key={s.num}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                  className="relative group text-center md:text-left"
                >
                  <div className="mx-auto md:mx-0 flex h-14 w-14 items-center justify-center rounded-2xl bg-background border-2 border-primary text-primary text-xl font-bold mb-6 shadow-sm group-hover:bg-primary group-hover:text-primary-foreground transition-all z-10 relative">
                    {s.num}
                  </div>
                  <h4 className="text-lg font-bold text-foreground mb-2">{s.title}</h4>
                  <p className="text-muted-foreground leading-relaxed">{s.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative border-t border-border/40 overflow-hidden">
        <div className="absolute inset-0 bg-primary/5 dark:bg-primary/10" />
        <div className={`${sectionClass} ${sectionPadding} relative text-center`}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="max-w-2xl mx-auto"
          >
            <h2 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl mb-6">
              Ready to elevate your workflow?
            </h2>
            <p className="text-xl text-muted-foreground mb-10 leading-relaxed">
              Join the future of intelligent project management. Stop managing tasks, start orchestrating work.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button size="lg" className="h-14 px-10 text-lg font-medium shadow-xl shadow-primary/20" asChild>
                <Link to="/signup">
                  Get Started for Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-background pt-16 pb-8">
        <div className={`${sectionClass}`}>
          <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8">
            <Link to="/" className="flex items-center group outline-none w-fit">
              <span className="text-xl font-bold tracking-tight text-foreground">Consilium</span>
            </Link>
            <div className="flex gap-6 text-sm font-medium text-muted-foreground">
              <Link to="/login" className="hover:text-foreground transition-colors">Login</Link>
              <Link to="/signup" className="hover:text-foreground transition-colors">Sign up</Link>
              <a href="#features" className="hover:text-foreground transition-colors">Features</a>
              <a href="#" className="hover:text-foreground transition-colors">Twitter</a>
            </div>
          </div>
          <div className="border-t border-border/40 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} Consilium. All rights reserved.</p>
            <p>Orchestrating work with intelligence.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
