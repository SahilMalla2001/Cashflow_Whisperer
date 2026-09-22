"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Landmark,
  CreditCard,
  Bot,
  Upload,
  LogOut,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { createClient } from "@/utils/supabase/client";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/savings", label: "Savings", icon: Landmark },
  { href: "/credit", label: "Credit Cards", icon: CreditCard },
  { href: "/ai", label: "AI Advisor", icon: Bot },
  { href: "/upload", label: "Upload PDF", icon: Upload },
];

export function Sidebar() {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const signOut = async () => {
    await createClient().auth.signOut();
    window.location.assign("/login");
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-text">Cashflow Whisperer</div>
        <div className="sidebar-logo-sub">10-year financial advisor</div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={isActive ? "active" : ""}
            >
              <Icon size={15} className="sidebar-nav-icon" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <button className="theme-toggle" onClick={signOut}>
          <LogOut size={14} />
          <span>Sign out</span>
        </button>
        <button className="theme-toggle" onClick={toggle} aria-label="Toggle theme">
          {theme === "light" ? <Moon size={14} /> : <Sun size={14} />}
          <span>{theme === "light" ? "Dark mode" : "Light mode"}</span>
        </button>
      </div>
    </aside>
  );
}
