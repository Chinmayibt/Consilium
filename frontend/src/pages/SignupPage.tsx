import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Users, Shield, ArrowRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { signup } from "@/api/auth";
import { toast } from "sonner";

const schema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email(),
  password: z.string().min(6),
  roleDesignation: z.string().optional(),
  github: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  skills: z.string().optional(),
});

type SignupFormValues = z.infer<typeof schema>;

export default function SignupPage() {
  const [userType, setUserType] = useState<"manager" | "member">("manager");
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: SignupFormValues) => {
    const name = `${values.firstName} ${values.lastName}`.trim();
    const skillsArray =
      values.skills
        ?.split(",")
        .map((s) => s.trim())
        .filter(Boolean) ?? [];

    try {
      await signup({
        name,
        email: values.email,
        password: values.password,
        role: userType,
        github_link: values.github || undefined,
        skills: skillsArray,
      });
      toast.success("Account created. You can now sign in.");
      navigate("/login");
    } catch (err: any) {
      const message =
        err?.response?.data?.detail ?? "Unable to create account. Please try again.";
      toast.error(message);
    }
  };

  return (
    <AuthLayout
      brandTitle="Start managing projects with AI in minutes"
      brandDescription="Create a workspace, invite your team, and let five AI agents handle requirements, planning, monitoring, and risk detection."
    >
      <div className="space-y-6 max-w-md">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Create your account
          </h1>
          <p className="text-sm text-muted-foreground">
            Get started with Consilium
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setUserType("manager")}
            className={cn(
              "rounded-xl border bg-card p-4 flex flex-col items-center gap-2 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              userType === "manager"
                ? "ring-2 ring-primary border-primary shadow-sm bg-primary/5"
                : "border-border hover:border-primary/40 hover:bg-muted/50"
            )}
          >
            <Shield className="h-5 w-5 text-primary shrink-0" />
            <span className="text-sm font-semibold text-foreground">Manager</span>
            <span className="text-xs text-muted-foreground">Create & manage projects</span>
          </button>
          <button
            type="button"
            onClick={() => setUserType("member")}
            className={cn(
              "rounded-xl border bg-card p-4 flex flex-col items-center gap-2 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              userType === "member"
                ? "ring-2 ring-primary border-primary shadow-sm bg-primary/5"
                : "border-border hover:border-primary/40 hover:bg-muted/50"
            )}
          >
            <Users className="h-5 w-5 text-primary shrink-0" />
            <span className="text-sm font-semibold text-foreground">Team Member</span>
            <span className="text-xs text-muted-foreground">Join & contribute</span>
          </button>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
          {/* Row 1: First and Last Name */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label className="text-sm font-medium">First name</Label>
              <Input placeholder="Jane" className="h-11 bg-background" {...register("firstName")} />
              {errors.firstName && (
                <p className="text-xs text-destructive mt-1">
                  {errors.firstName.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Last name</Label>
              <Input placeholder="Doe" className="h-11 bg-background" {...register("lastName")} />
              {errors.lastName && (
                <p className="text-xs text-destructive mt-1">
                  {errors.lastName.message}
                </p>
              )}
            </div>
          </div>

          {/* Row 2: Email */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Email</Label>
            <Input
              type="email"
              placeholder="you@company.com"
              className="h-11 bg-background"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-destructive mt-1">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Row 3: Password */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-medium">Password</Label>
              <span className="text-xs text-muted-foreground">Min 6 characters</span>
            </div>
            <Input
              type="password"
              placeholder="••••••••"
              className="h-11 bg-background"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-destructive mt-1">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Row 4: Role / Designation */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Role / Designation</Label>
            <Input
              placeholder="e.g. Frontend Engineer, Product Manager"
              className="h-11 bg-background"
              {...register("roleDesignation")}
            />
          </div>

          {/* Row 5: Skills */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Skills</Label>
            <Textarea
              placeholder="e.g. React, UX Design, Python (comma separated)"
              rows={2}
              className="resize-none rounded-xl bg-background text-sm leading-relaxed"
              {...register("skills")}
            />
          </div>
          <Button className="w-full h-11" size="lg">
            {isSubmitting ? "Creating account..." : "Create account"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-medium text-primary hover:underline focus-visible:underline focus-visible:outline-none"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
