import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Copy, Sparkles } from "lucide-react";
import { useState } from "react";

export default function WorkspacePage() {
  const [projectName, setProjectName] = useState("");
  const inviteCode = "PROJ-AI-X7K9M2";

  return (
    <div className="page-container animate-fade-in">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Workspace
        </h1>
        <p className="text-sm text-muted-foreground">
          Create or join an AI-managed project workspace
        </p>
      </div>

      <div className="max-w-2xl space-y-8">
        <section className="card-base space-y-6">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-[15px] font-semibold text-foreground">
              Create Project Workspace
            </h3>
            <Badge variant="secondary" className="text-[11px] font-medium shrink-0">
              Manager only
            </Badge>
          </div>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label className="text-[13px] font-medium">Project Name</Label>
              <Input
                placeholder="My Awesome Project"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] font-medium">Workspace Name</Label>
              <Input
                placeholder="Auto-filled from project name"
                value={projectName || ""}
                onChange={() => {}}
                className="h-11"
              />
              <p className="caption">Auto-filled from project name, but editable</p>
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] font-medium">Description</Label>
              <Textarea
                placeholder="Brief description of the project..."
                rows={3}
                className="min-h-[88px] resize-none"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label className="text-[13px] font-medium">
                  Tech Stack <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input placeholder="React, Node.js, PostgreSQL" className="h-11" />
              </div>
              <div className="space-y-2">
                <Label className="text-[13px] font-medium">Team Size</Label>
                <Input type="number" placeholder="8" className="h-11" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label className="text-[13px] font-medium">Deadline</Label>
                <Input type="date" className="h-11" />
              </div>
              <div className="space-y-2">
                <Label className="text-[13px] font-medium">Priority</Label>
                <Select>
                  <SelectTrigger className="h-11 rounded-lg">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] font-medium">Invite Code</Label>
              <div className="flex gap-2">
                <Input
                  value={inviteCode}
                  readOnly
                  className="h-11 font-mono text-sm bg-muted/60 rounded-lg"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 shrink-0 rounded-lg"
                  type="button"
                  aria-label="Copy invite code"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="caption">Share this code with team members to join</p>
            </div>
          </div>
          <Button size="lg" className="w-full h-11 rounded-lg">
            <Sparkles className="h-4 w-4 mr-2" />
            Create Workspace & Generate PRD
          </Button>
        </section>

        <section className="card-base space-y-4">
          <h3 className="text-[15px] font-semibold text-foreground">
            Join Existing Workspace
          </h3>
          <p className="text-sm text-muted-foreground">
            Have an invite code? Enter it below to join a project.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Enter invite code (e.g. PROJ-AI-X7K9M2)"
              className="h-11 font-mono flex-1 rounded-lg"
            />
            <Button variant="outline" className="h-11 rounded-lg shrink-0 sm:w-auto">
              Join
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
