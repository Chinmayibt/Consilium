import { Link } from "react-router-dom";
import { Layers } from "lucide-react";

interface AuthLayoutProps {
  children: React.ReactNode;
  /** Content for the left brand panel (desktop) */
  brandTitle: string;
  brandDescription: string;
}

export function AuthLayout({ children, brandTitle, brandDescription }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen font-sans selection:bg-primary/20 selection:text-foreground">
      {/* Left panel – brand */}
      <div className="hidden lg:flex lg:w-[48%] bg-sidebar relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_20%_90%,rgba(79,70,229,0.12),transparent_50%)]" />
        <div className="relative flex flex-col justify-between p-10 xl:p-14 text-sidebar-foreground w-full h-full">
          <Link
            to="/"
            className="flex items-center text-sidebar-accent-foreground hover:opacity-90 transition-opacity focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar rounded-lg outline-none w-fit"
          >
            <span className="text-xl font-bold tracking-tight">Consilium</span>
          </Link>
          <div className="max-w-md space-y-4">
            <h2 className="text-2xl font-bold text-sidebar-accent-foreground leading-snug tracking-tight">
              {brandTitle}
            </h2>
            <p className="text-[15px] text-sidebar-foreground/80 leading-relaxed">
              {brandDescription}
            </p>
          </div>
          <p className="text-xs text-sidebar-foreground/50 font-medium">
            &copy; {new Date().getFullYear()} Consilium
          </p>
        </div>
      </div>

      {/* Right panel – form */}
      <div className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-8 lg:px-12 bg-background/50">
        <div className="lg:hidden flex items-center justify-center mb-10">
          <Link to="/" className="flex items-center group outline-none">
            <span className="text-2xl font-bold text-foreground tracking-tight">Consilium</span>
          </Link>
        </div>
        <div className="w-full max-w-[420px] mx-auto animate-fade-in shadow-xl shadow-primary/5 sm:border sm:border-border/40 sm:p-8 sm:rounded-2xl sm:bg-card">
          {children}
        </div>
      </div>
    </div>
  );
}
