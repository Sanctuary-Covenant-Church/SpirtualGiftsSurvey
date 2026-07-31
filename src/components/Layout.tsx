/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Menu, X, ExternalLink, ShieldAlert, Heart, Compass, Users } from 'lucide-react';
import SanctuaryOfficialLogo from './SanctuaryOfficialLogo';

interface LayoutProps {
  children: React.ReactNode;
  activeView?: 'hero' | 'survey' | 'results' | 'admin';
  onSelectView?: (view: 'hero' | 'survey' | 'results' | 'admin') => void;
  onAdminClick?: () => void;
  isAdminLoggedIn?: boolean;
}

export default function Layout({ 
  children, 
  activeView = 'hero', 
  onSelectView, 
  onAdminClick,
  isAdminLoggedIn = false 
}: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNav = (view: 'hero' | 'survey' | 'results' | 'admin') => {
    if (onSelectView) {
      onSelectView(view);
    }
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-brand-bg text-brand-text">
      {/* Top Sanctuary Church Bar */}
      <div className="bg-[#1C1B1A] text-white/90 py-2 px-6 text-[10.5px] uppercase tracking-[0.2em] font-medium flex justify-between items-center border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-brand-red inline-block animate-pulse"></span>
          <span>Sanctuary Covenant Church • Sundays @ 9:00 AM & 11:00 AM • Minneapolis, MN</span>
        </div>
        <div className="hidden sm:flex gap-6 items-center">
          <a 
            href="https://sanctuarycov.org/" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="hover:text-white transition-colors flex items-center gap-1 opacity-80 hover:opacity-100"
          >
            <span>sanctuarycov.org</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
          <a 
            href="https://sanctuarycov.org/join-a-team/" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-brand-red font-bold hover:underline transition-colors"
          >
            Join a Team
          </a>
        </div>
      </div>

      {/* Main Header Bar */}
      <header className="px-6 sm:px-12 py-5 flex justify-between items-center border-b border-brand-border bg-brand-bg/90 backdrop-blur-md sticky top-0 z-50 shadow-xs">
        {/* Sanctuary Logo & Brand Mark */}
        <button 
          onClick={() => handleNav('hero')} 
          className="text-left group focus:outline-none flex items-center"
        >
          <SanctuaryOfficialLogo variant="full" className="h-10 sm:h-11 transition-transform group-hover:scale-[1.02]" theme="light" />
        </button>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-[11px] font-bold uppercase tracking-[0.2em]">
          <button
            onClick={() => handleNav('hero')}
            className={`transition-colors pb-1 border-b-2 ${
              activeView === 'hero' 
                ? 'text-brand-red border-brand-red' 
                : 'text-brand-muted hover:text-brand-text border-transparent'
            }`}
          >
            Discovery Home
          </button>

          <button
            onClick={() => handleNav('survey')}
            className={`transition-colors pb-1 border-b-2 ${
              activeView === 'survey' || activeView === 'results'
                ? 'text-brand-red border-brand-red' 
                : 'text-brand-muted hover:text-brand-text border-transparent'
            }`}
          >
            Spiritual Gifts Survey
          </button>

          <a
            href="https://sanctuarycov.org/join-a-team/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-muted hover:text-brand-text border-b-2 border-transparent pb-1 flex items-center gap-1 transition-colors"
          >
            <span>Join a Team</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>

          {activeView === 'admin' && (
            <button
              onClick={() => handleNav('admin')}
              className="text-brand-red border-b-2 border-brand-red pb-1 font-bold"
            >
              Curator Dashboard
            </button>
          )}
        </nav>

        {/* CTA & Mobile Toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleNav('survey')}
            className="hidden lg:inline-flex px-6 py-2.5 bg-brand-red text-white text-[10px] font-bold uppercase tracking-[0.2em] rounded-full hover:bg-brand-red-hover transition-all shadow-md shadow-brand-red/20"
          >
            Begin Survey
          </button>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-brand-muted hover:text-brand-text rounded-lg hover:bg-brand-surface"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-brand-bg border-b border-brand-border px-6 py-6 space-y-4 text-xs font-bold uppercase tracking-[0.2em] animate-fadeIn z-40">
          <button
            onClick={() => handleNav('hero')}
            className={`block w-full text-left py-2.5 ${activeView === 'hero' ? 'text-brand-red' : 'text-brand-text'}`}
          >
            Discovery Home
          </button>

          <button
            onClick={() => handleNav('survey')}
            className={`block w-full text-left py-2.5 ${activeView === 'survey' ? 'text-brand-red' : 'text-brand-text'}`}
          >
            Spiritual Gifts Survey
          </button>

          <a
            href="https://sanctuarycov.org/join-a-team/"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-left py-2.5 text-brand-muted hover:text-brand-text flex items-center justify-between"
          >
            <span>sanctuarycov.org/join-a-team</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {/* Main App Content Area */}
      <main className="flex-grow">
        {children}
      </main>

      {/* Sanctuary Covenant Church Dark Footer */}
      <footer className="bg-[#1C1B1A] text-white/80 border-t border-brand-red/30">
        <div className="max-w-7xl mx-auto px-6 sm:px-12 py-16 grid grid-cols-1 md:grid-cols-3 gap-12 text-[12px]">
          {/* Col 1: Brand & Location */}
          <div className="space-y-4">
            <div className="flex items-center">
              <SanctuaryOfficialLogo variant="full" className="h-10 sm:h-11" theme="dark" />
            </div>
            <p className="text-xs text-white/60 font-light leading-relaxed max-w-sm">
              Loving God, loving our neighbors, and actively serving the city of Minneapolis together.
            </p>
            <div className="pt-2 text-xs text-white/70 space-y-1">
              <p className="font-semibold text-white">710 W 31st St, Minneapolis, MN 55408</p>
              <p className="text-brand-red font-medium">Sunday Worship Services @ 9:00 AM & 11:00 AM</p>
            </div>
          </div>

          {/* Col 2: Navigation Links */}
          <div className="space-y-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-red">
              Quick Links
            </div>
            <ul className="space-y-2.5 font-medium tracking-wider text-[11px] uppercase">
              <li>
                <button onClick={() => handleNav('hero')} className="hover:text-white transition-colors">
                  Discovery Home
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('survey')} className="hover:text-white transition-colors">
                  Spiritual Gifts Survey
                </button>
              </li>
              <li>
                <a 
                  href="https://sanctuarycov.org/join-a-team/" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-white/90 hover:text-brand-red transition-colors flex items-center gap-1.5"
                >
                  <span>Join a Team (sanctuarycov.org)</span>
                  <ExternalLink className="w-3 h-3 text-brand-red" />
                </a>
              </li>
              <li>
                <a 
                  href="https://sanctuarycov.org/" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="hover:text-white transition-colors"
                >
                  Sanctuary Main Site
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: CTA Box */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-red block mb-2">Get Connected</span>
              <h4 className="text-base font-semibold text-white mb-2">Serve With Sanctuary</h4>
              <p className="text-xs text-white/60 font-light leading-relaxed mb-6">
                Ready to take the next step in serving our community? Visit our official teams page to get plugged in.
              </p>
            </div>
            <a
              href="https://sanctuarycov.org/join-a-team/"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 bg-brand-red text-white text-[10px] font-bold uppercase tracking-[0.2em] rounded-full hover:bg-brand-red-hover transition-all text-center block shadow-md"
            >
              Join a Team
            </a>
          </div>
        </div>

        {/* Sub-footer Copyright */}
        <div className="border-t border-white/10 py-6 px-6 sm:px-12 text-center sm:text-left">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] font-medium uppercase tracking-[0.18em] text-white/50">
            <div>
              © {new Date().getFullYear()} Sanctuary Covenant Church. All rights reserved.
            </div>
            <div className="flex items-center gap-4">
              <span>Minneapolis, MN</span>
              <span>•</span>
              <a href="https://sanctuarycov.org/" target="_blank" rel="noopener noreferrer" className="hover:text-white underline">
                sanctuarycov.org
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
