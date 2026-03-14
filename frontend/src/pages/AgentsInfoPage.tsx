import { Brain, Lightbulb, Zap, RefreshCw, Eye, Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const agents = [
  {
    name: "Requirements Agent",
    icon: Brain,
    status: "active" as const,
    description:
      "Analyzes project input and generates a structured Product Requirements Document (PRD) with goals, features, user stories, and technical specs.",
  },
  {
    name: "Planning Agent",
    icon: Lightbulb,
    status: "active" as const,
    description:
      "Processes the PRD to create project roadmap phases, assigns tasks to team members, and populates the Kanban board automatically.",
  },
  {
    name: "Monitoring Agent",
    icon: Eye,
    status: "active" as const,
    description:
      "Monitors GitHub commits and pull requests, updates task status (e.g. PR merged → done, PR closed → blocked), and detects project completion.",
  },
  {
    name: "Risk Agent",
    icon: Zap,
    status: "active" as const,
    description:
      "Analyzes blockers and blocked tasks via LLM; reports severity, impact, and recommended mitigation; adds in-app notifications.",
  },
  {
    name: "Replanning Agent",
    icon: RefreshCw,
    status: "active" as const,
    description:
      "Reassigns blocked tasks to other team members and resets status to todo when replanning is triggered after risks.",
  },
  {
    name: "Notification Agent",
    icon: Bell,
    status: "active" as const,
    description:
      "Emits in-app notifications for project completed, blockers detected, and risk alerts. Email can be added later.",
  },
];

const statusColors: Record<string, string> = {
  active: "bg-success/10 text-success",
  running: "bg-primary/10 text-primary",
  idle: "bg-muted text-muted-foreground",
};

export default function AgentsInfoPage() {
  return (
    <div className="page-container animate-fade-in">
      <div>
        <h1>Agents Info</h1>
        <p className="text-sm text-muted-foreground mt-1">
          AI agents powering your project lifecycle
        </p>
      </div>

      <div className="max-w-3xl space-y-4">
        {agents.map((agent) => (
          <div key={agent.name} className="card-base space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <agent.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3>{agent.name}</h3>
                  <Badge
                    className={`text-[10px] ${statusColors[agent.status] ?? statusColors.idle}`}
                    variant="secondary"
                  >
                    {agent.status}
                  </Badge>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{agent.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
