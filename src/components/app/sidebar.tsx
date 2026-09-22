"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Box,
  CalendarDays,
  Home,
  Images,
  Link2,
  LogOut,
  Megaphone,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/app/login/actions";
import { Logo } from "./logo";

const primary = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/library", label: "Library", icon: Images },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

const secondary = [
  { href: "/products", label: "Products", icon: Box },
  { href: "/connections", label: "Connections", icon: Link2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  const item = ({ href, label, icon: Icon }: (typeof primary)[number]) => {
    const active = pathname.startsWith(href);
    return (
      <Link
        key={href}
        href={href}
        className={cn(
          "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
          active
            ? "bg-sidebar-accent text-foreground"
            : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
        )}
      >
        <Icon className={cn("size-4", active && "text-primary")} />
        {label}
      </Link>
    );
  };

  return (
    <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-4">
      <div className="px-2.5 pb-6">
        <Logo />
      </div>
      <nav className="space-y-0.5">{primary.map(item)}</nav>
      <div className="my-4 border-t border-sidebar-border" />
      <nav className="space-y-0.5">{secondary.map(item)}</nav>
      <form action={logout} className="mt-auto">
        <button className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground hover:text-foreground">
          <LogOut className="size-4" />
          Sign out
        </button>
      </form>
    </aside>
  );
}
