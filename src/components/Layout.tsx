/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Menu } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-brand-bg">
      <header className="px-6 sm:px-12 py-8 flex justify-between items-center border-b border-brand-border bg-brand-bg/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-accent-sage rounded-full flex items-center justify-center text-white font-serif text-xl italic pt-0.5">
            S
          </div>
          <div>
            <h1 className="text-sm font-bold uppercase tracking-[0.2em] leading-none mb-0.5 italic-none">Sanctuary</h1>
            <p className="text-[10px] text-brand-muted uppercase tracking-tighter font-medium">Covenant Church</p>
          </div>
        </div>
        <nav className="hidden md:flex gap-8 text-[11px] font-bold uppercase tracking-[0.2em] text-brand-muted">
          <a href="https://sanctuarycov.org/" className="hover:text-brand-text transition-colors">The Website</a>
          <a href="https://sanctuarycov.org/join-a-team/" className="hover:text-brand-text transition-colors">Join a team</a>
          <a href="#" className="text-brand-text border-b border-brand-text pb-0.5">The Survey</a>
        </nav>
        <div className="md:hidden">
          <Menu className="w-5 h-5 text-brand-muted" />
        </div>
      </header>

      <main className="flex-grow">
        {children}
      </main>

      <footer className="px-6 sm:px-12 py-10 bg-white border-t border-brand-border flex flex-col sm:flex-row justify-between items-center gap-6 text-[10px] text-brand-muted uppercase tracking-[0.15em] font-medium">
        <div className="flex flex-col sm:flex-row gap-6 sm:gap-12 items-center">
          <span className="flex gap-2">
            Sanctuary <span className="text-brand-text">Covenant Church</span>
          </span>
          <span className="hidden sm:inline opacity-30">|</span>
          <span>© {new Date().getFullYear()} Sanctuary</span>
        </div>
        <div className="flex gap-8">
          <a href="https://sanctuarycov.org/join-a-team/" className="hover:text-brand-text transition-colors">Service Roles</a>
          <a href="https://sanctuarycov.org/" className="hover:text-brand-text transition-colors">Legal & Privacy</a>
        </div>
      </footer>
    </div>
  );
}
