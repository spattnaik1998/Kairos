"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  Zap,
  Shield,
  Clock,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/",          label: "Dashboard",        icon: LayoutDashboard, color: "text-blue-400" },
  { href: "/forecast",  label: "Asset Forecast",   icon: TrendingUp,      color: "text-amber-400" },
  { href: "/signals",   label: "Signal Engine",    icon: Zap,             color: "text-green-400" },
  { href: "/portfolio", label: "Portfolio Risk",   icon: Shield,          color: "text-purple-400" },
  { href: "/patterns",  label: "Pattern Library",  icon: Clock,           color: "text-rose-400" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-kairos-surface border-r border-kairos-border flex flex-col z-50">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-kairos-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
            <span className="text-black font-bold text-sm">K</span>
          </div>
          <div>
            <p className="font-bold text-kairos-text tracking-tight">Kairos</p>
            <p className="text-[10px] text-kairos-subtle uppercase tracking-widest">
              Portfolio Intelligence
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ href, label, icon: Icon, color }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group",
                active
                  ? "bg-kairos-muted text-kairos-text"
                  : "text-kairos-subtle hover:bg-kairos-border hover:text-kairos-text"
              )}
            >
              <Icon className={cn("w-4 h-4", active ? color : "text-kairos-subtle group-hover:" + color)} />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="w-3 h-3 text-kairos-subtle" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-kairos-border">
        <p className="text-[10px] text-kairos-subtle">
          Powered by{" "}
          <span className="text-amber-400 font-medium">TimesFM 2.5</span>
        </p>
        <p className="text-[10px] text-kairos-subtle mt-0.5">
          Google Research · 200M Parameters
        </p>
      </div>
    </aside>
  );
}
