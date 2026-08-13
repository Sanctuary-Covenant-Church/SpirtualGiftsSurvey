/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Users, 
  BookOpen, 
  HeartHandshake, 
  Send, 
  Gift, 
  ArrowRight, 
  ExternalLink,
  Sparkles
} from 'lucide-react';

import { trackEvent } from '../utils/analytics';

interface Sanctuary5HeroProps {
  onStartSurvey: () => void;
}

const SANCTUARY_FIVE = [
  {
    num: 1,
    title: 'Connect',
    tagline: 'We are a community',
    scripture: 'Romans 12',
    icon: Users,
    isFocus: false,
  },
  {
    num: 2,
    title: 'Grow',
    tagline: 'We are life long disciples',
    scripture: 'Ephesians 4:11-16',
    icon: BookOpen,
    isFocus: false,
  },
  {
    num: 3,
    title: 'Serve',
    tagline: 'We are good neighbors',
    scripture: 'Luke 4:14-21',
    icon: HeartHandshake,
    isFocus: true, // Focus of this survey
  },
  {
    num: 4,
    title: 'Invite',
    tagline: 'We are missional',
    scripture: 'Matthew 28:19-20',
    icon: Send,
    isFocus: false,
  },
  {
    num: 5,
    title: 'Give',
    tagline: 'We are generous people',
    scripture: '2 Corinthians 9:6-15',
    icon: Gift,
    isFocus: false,
  },
];

export default function Sanctuary5Hero({ onStartSurvey }: Sanctuary5HeroProps) {
  return (
    <div className="max-w-5xl mx-auto px-6 py-12 sm:py-20">
      {/* Top Eyebrow */}
      <div className="text-center mb-6">
        <span className="inline-flex items-center gap-2 px-4.5 py-1.5 rounded-full bg-brand-red/10 text-brand-red text-[11px] font-bold uppercase tracking-[0.25em] border border-brand-red/20 shadow-xs">
          <Sparkles className="w-3.5 h-3.5" />
          Soul Discovery • The Sanctuary 5: SERVE
        </span>
      </div>

      {/* Main Title */}
      <div className="text-center max-w-3xl mx-auto mb-10">
        <h1 className="text-4xl sm:text-6xl font-serif italic text-brand-text mb-6 leading-[1.15]">
          Discover How God Wired You <br className="hidden sm:inline" />
          <span className="text-brand-red">To Serve</span>
        </h1>
        <p className="text-base sm:text-lg text-brand-muted font-light leading-relaxed mb-4">
          <strong className="font-semibold text-brand-red">SERVE: We are good neighbors</strong>{' '}
          <span className="font-serif italic text-brand-muted opacity-90">(Luke 4:14-21)</span>
        </p>
        <p className="text-base sm:text-lg text-brand-muted font-light leading-relaxed">
          God has uniquely gifted you to make a difference. Discover your spiritual gifts and explore how you can use them to strengthen our church family, love and serve our neighbors, and join in what God is doing in North Minneapolis and beyond.
        </p>
      </div>

      {/* Call to Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
        <button
          onClick={onStartSurvey}
          className="w-full sm:w-auto px-10 py-4.5 bg-brand-red text-white rounded-full text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-brand-red-hover transition-all shadow-lg shadow-brand-red/20 flex items-center justify-center gap-2 group cursor-pointer"
        >
          <span>Begin Spiritual Gifts Survey</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
        <a
          href="https://sanctuarycov.org/join-a-team/"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent('cta_click', { target: 'join_a_team', source: 'hero' })}
          className="w-full sm:w-auto px-8 py-4.5 bg-white border border-brand-border text-brand-text rounded-full text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-brand-surface transition-all flex items-center justify-center gap-2"
        >
          <span>Join a Team (sanctuarycov.org)</span>
          <ExternalLink className="w-3.5 h-3.5 opacity-60" />
        </a>
      </div>

      {/* The Sanctuary 5 Tenets Grid */}
      <div className="mb-14">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xs font-bold uppercase tracking-[0.22em] text-brand-muted">
            The Sanctuary 5
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {SANCTUARY_FIVE.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.num}
                className={`rounded-2xl p-5 transition-all flex flex-col justify-between border ${
                  item.isFocus
                    ? 'bg-white border-brand-red shadow-md ring-2 ring-brand-red/20 scale-[1.02]'
                    : 'bg-white/80 border-brand-border hover:border-brand-muted/40 hover:bg-white'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
                        item.isFocus
                          ? 'bg-brand-red text-white'
                          : 'bg-brand-surface text-brand-muted'
                      }`}
                    >
                      0{item.num}
                    </span>
                    <Icon
                      className={`w-4 h-4 ${
                        item.isFocus ? 'text-brand-red' : 'text-brand-muted/60'
                      }`}
                    />
                  </div>
                  <h4
                    className={`text-base font-bold mb-1 ${
                      item.isFocus ? 'text-brand-red' : 'text-brand-text'
                    }`}
                  >
                    {item.title}
                  </h4>
                  <p className="text-xs text-brand-muted font-light leading-snug mb-3">
                    "{item.tagline}"
                  </p>
                </div>
                <div className="pt-2 border-t border-brand-border/50 text-[10px] font-mono text-brand-muted/80">
                  {item.scripture}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
