"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import { navigation } from "@/presentation/navigation/navigation";
import { GlassCommandPalette } from "../glass/glass-primitives";
import { Menu, X } from "lucide-react";

export function AppShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(var(--accent)/0.10),transparent_32rem),hsl(var(--background))]">
    {/* Mobile overlay */}
    {sidebarOpen && (
      <div
        className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        onClick={() => setSidebarOpen(false)}
      />
    )}

    {/* Sidebar */}
    <aside className={`fixed inset-y-0 left-0 z-50 w-72 border-r border-border/70 bg-white/55 p-4 backdrop-blur-glass transition-transform duration-200 dark:bg-white/6 lg:z-0 lg:translate-x-0 ${
      sidebarOpen ? "translate-x-0" : "-translate-x-full"
    } lg:block lg:translate-x-0`}>
      <div className="px-3 py-2 text-lg font-semibold">AkuntansiMu</div>
      <nav className="mt-5 grid gap-1" aria-label="Primary navigation">{navigation.map((item) => <Link key={item.href} href={item.href} className="rounded-md px-3 py-2 text-sm text-muted transition hover:bg-white/70 hover:text-foreground dark:hover:bg-white/10" onClick={() => setSidebarOpen(false)}>{item.title}</Link>)}</nav>
    </aside>

    <div className="lg:pl-72">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/70 bg-background/70 px-4 backdrop-blur-glass lg:px-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden"
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <div><p className="text-sm text-muted">Current business</p><p className="font-medium">Demo UMKM</p></div>
        </div>
        <div className="hidden md:block"><GlassCommandPalette className="w-80 px-4 py-2 text-sm text-muted">Command palette / search</GlassCommandPalette></div>
      </header>
      <main className="mx-auto max-w-[1600px] p-4 lg:p-8">{children}</main>
    </div>
  </div>;
}
