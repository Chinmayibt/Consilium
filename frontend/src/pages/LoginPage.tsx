import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { ArrowRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { login } from "@/api/auth";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

type LoginFormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: LoginFormValues) => {
    try {
      setLoading(true);
      const res = await login(values.email, values.password);
      setAuth(res.user, res.access_token);
      toast.success("Signed in successfully");
      navigate("/workspaces");
    } catch (err: any) {
      const message =
        err?.response?.data?.detail ??
        "Unable to sign in. Please check your credentials.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      brandTitle="AI agents that manage your project lifecycle"
      brandDescription="From requirements to deployment — five intelligent agents handle planning, monitoring, risk detection, and replanning automatically."
    >
      <div className="space-y-8">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Welcome back
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in to continue to your workspace
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-[13px] font-medium">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              className="h-11"
              autoComplete="email"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-destructive mt-1">
                {errors.email.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-[13px] font-medium">
                Password
              </Label>
              <a
                href="#"
                className="text-xs text-primary hover:underline focus-visible:underline focus-visible:outline-none"
              >
                Forgot password?
              </a>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              className="h-11"
              autoComplete="current-password"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-destructive mt-1">
                {errors.password.message}
              </p>
            )}
          </div>
          <Button className="w-full h-11" size="lg" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            to="/signup"
            className="font-medium text-primary hover:underline focus-visible:underline focus-visible:outline-none"
          >
            Create account
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
