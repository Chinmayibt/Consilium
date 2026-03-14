import { Link } from "react-router-dom";
import { Brain } from "lucide-react";

interface AuthLayoutProps {
  children: React.ReactNode;
  /** Content for the left brand panel (desktop) */
  brandTitle: string;
  brandDescription: string;
}

export function AuthLayout({ children, brandTitle, brandDescription }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen">
      {/* Left panel – brand */}
      <div className="hidden lg:flex lg:w-[48%] bg-sidebar relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_20%_90%,hsl(221_83%_53%/0.12),transparent_50%)]" />
        <div className="relative flex flex-col justify-between p-10 xl:p-14 text-sidebar-foreground">
          <Link
            to="/"
            className="flex items-center gap-2.5 text-sidebar-accent-foreground hover:opacity-90 transition-opacity focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar rounded-lg outline-none"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
              <Brain className="h-5 w-5 text-sidebar-primary-foreground" />
            </div>
            <span className="text-base font-semibold tracking-tight">ProjectAI</span>
          </Link>
          <div className="max-w-sm space-y-4">
            <h2 className="text-xl font-semibold text-sidebar-accent-foreground leading-snug tracking-tight">
              {brandTitle}
            </h2>
            <p className="text-sm text-sidebar-foreground/80 leading-relaxed">
              {brandDescription}
            </p>
          </div>
          <p className="text-xs text-sidebar-foreground/50">
            &copy; {new Date().getFullYear()} ProjectAI
          </p>
        </div>
      </div>

      {/* Right panel – form */}
      <div className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-8 lg:px-12">
        <div className="lg:hidden flex items-center gap-2.5 mb-8">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Brain className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-base font-semibold">ProjectAI</span>
          </Link>
        </div>
        <div className="w-full max-w-[400px] mx-auto animate-fade-in">
          {children}
        </div>
      </div>
    </div>
  );
}
