import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

export default function SettingsPage() {
  return (
    <div className="page-container animate-fade-in">
      <div>
        <h1>Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Workspace configuration</p>
      </div>

      <div className="max-w-2xl space-y-6">
        <div className="card-base space-y-4">
          <h3>Project Information</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Project Name</Label>
              <Input defaultValue="Consilium Dashboard" />
            </div>
            <div className="space-y-2">
              <Label>Repository URL</Label>
              <Input defaultValue="https://github.com/org/project-ai" />
            </div>
          </div>
        </div>

        <div className="card-base space-y-4">
          <h3>Notifications</h3>
          <div className="space-y-4">
            {[
              { label: "Risk alerts", desc: "Get notified when new risks are detected" },
              { label: "Task updates", desc: "Notifications for task status changes" },
              { label: "Agent insights", desc: "AI-generated recommendations" },
              { label: "Team activity", desc: "New members and role changes" },
            ].map((n) => (
              <div key={n.label} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{n.label}</p>
                  <p className="caption">{n.desc}</p>
                </div>
                <Switch defaultChecked />
              </div>
            ))}
          </div>
        </div>

        <div className="card-base space-y-4">
          <h3>Danger Zone</h3>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Delete Workspace</p>
              <p className="caption">This action cannot be undone</p>
            </div>
            <Button variant="destructive" size="sm">Delete</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
