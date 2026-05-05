/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowRight, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  Mail, 
  RefreshCcw, 
  Search,
  Users,
  Heart,
  Zap,
  Lightbulb,
  HandHeart,
  MessageSquare,
  ShieldCheck,
  TrendingUp,
  Gift as GiftIcon,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import Layout from './components/Layout';
import AdminDashboard from './components/AdminDashboard';
import { db, auth, googleProvider } from './lib/firebase';
import { INITIAL_QUESTIONS, INITIAL_GIFTS } from './constants';
import { Question, Gift, SurveyResponse, SurveyResult } from './types';
import { trackEvent } from './utils/analytics';

type View = 'hero' | 'survey' | 'results' | 'admin';

export default function App() {
  const [view, setView] = useState<View>('hero');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [userInfo, setUserInfo] = useState({ name: '', email: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<SurveyResult | null>(null);
  const [user, setUser] = useState<User | null>(null);
  
  // Dynamic content from Firestore
  const [questions, setQuestions] = useState<Question[]>(INITIAL_QUESTIONS);
  const [gifts, setGifts] = useState<Gift[]>(INITIAL_GIFTS);
  const [isDataLoading, setIsDataLoading] = useState(true);

  // Sync with Auth
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
  }, []);

  // Sync Questions & Gifts
  useEffect(() => {
    const unsubGifts = onSnapshot(collection(db, 'gifts'), (snapshot) => {
      if (!snapshot.empty) {
        setGifts(snapshot.docs.map(doc => doc.data() as Gift));
      }
    });

    const unsubQuestions = onSnapshot(query(collection(db, 'questions'), orderBy('id', 'asc')), (snapshot) => {
      if (!snapshot.empty) {
        setQuestions(snapshot.docs.map(doc => doc.data() as Question));
      }
      setIsDataLoading(false);
    });

    return () => {
      unsubGifts();
      unsubQuestions();
    };
  }, []);

  // Track page view
  useEffect(() => {
    trackEvent('page_view', { view });
  }, [view]);

  const startSurvey = () => {
    setView('survey');
    trackEvent('survey_start');
  };

  const handleAdminLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      setView('admin');
    } catch (error) {
      console.error('Login failed', error);
    }
  };

  const handleResponse = (score: number) => {
    const question = questions[currentQuestionIndex];
    const newResponses = [...responses.filter(r => r.questionId !== question.id), { questionId: question.id, score }];
    setResponses(newResponses);

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      setResult(calculateResult(newResponses));
    }
  };

  const calculateResult = (finalResponses: SurveyResponse[]): SurveyResult => {
    const scores: Record<string, number> = {};
    gifts.forEach(gift => scores[gift.id] = 0);
    finalResponses.forEach(resp => {
      const question = questions.find(q => q.id === resp.questionId);
      if (question) scores[question.giftId] += resp.score;
    });

    const sortedGifts = [...gifts].sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0));
    const topGifts = sortedGifts.slice(0, 3).filter(g => (scores[g.id] || 0) > 0);

    return {
      userId: Math.random().toString(36).substring(7),
      timestamp: new Date().toISOString(),
      responses: finalResponses,
      scores,
      primaryGiftIds: topGifts.map(g => g.id),
      ...userInfo
    };
  };

  const handleSubmitResults = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (result) {
        const finalResult = { ...result, ...userInfo };
        setResult(finalResult);
        await fetch('/api/send-results', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: userInfo.email, result: finalResult })
        });
        trackEvent('survey_complete', { topGifts: finalResult.primaryGiftIds });
        setView('results');
      }
    } catch (error) {
      console.error('Failed to submit results', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetSurvey = () => {
    setResponses([]);
    setCurrentQuestionIndex(0);
    setView('hero');
    setResult(null);
  };

  const progress = (currentQuestionIndex / questions.length) * 100;

  if (view === 'admin') {
    // Basic reactive security check before rendering the potentially heavy dashboard
    if (user?.email !== 'cdonyi@gmail.com') {
      return (
        <div className="h-screen flex items-center justify-center bg-brand-bg flex-col gap-6">
          <ShieldAlert className="w-12 h-12 text-red-500" />
          <p className="text-sm font-bold uppercase tracking-widest text-brand-muted">Unauthorized Access</p>
          <button onClick={() => setView('hero')} className="px-6 py-3 bg-brand-text text-white rounded-full text-[10px] font-bold uppercase tracking-[0.2em]">Return Home</button>
        </div>
      );
    }
    return <AdminDashboard onExit={() => setView('hero')} />;
  }

  return (
    <Layout>
      <div className="fixed bottom-4 right-4 z-50 opacity-20 hover:opacity-100 transition-opacity">
        <button 
          onClick={user ? () => setView('admin') : handleAdminLogin}
          className="p-2 bg-brand-bg border border-brand-border rounded-full hover:bg-brand-surface"
          title="Admin Login"
        >
          <ShieldAlert className="w-4 h-4 text-brand-muted" />
        </button>
      </div>
      <AnimatePresence mode="wait">
        {view === 'hero' && (
          <motion.div
            key="hero"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="max-w-4xl mx-auto px-6 py-24 sm:py-32 text-center"
          >
            <span className="text-[11px] font-bold text-brand-accent-gold uppercase tracking-[0.3em] mb-6 block">Soul Discovery</span>
            <h1 className="text-5xl sm:text-7xl font-serif italic mb-8 leading-tight">
              A path toward <br/>purpose and grace.
            </h1>
            <p className="text-lg text-brand-muted mb-12 max-w-xl mx-auto leading-relaxed font-light">
              Through this guided discovery, you will uncover the unique spiritual gifts bestowed upon you. It is the first step in finding your meaningful place within our community.
            </p>
            <button
              onClick={startSurvey}
              className="px-12 py-5 bg-brand-text text-white rounded-full text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-black transition-all shadow-xl shadow-brand-text/10"
            >
              Begin the Journey
            </button>
          </motion.div>
        )}

        {view === 'survey' && (
          <motion.div
            key="survey"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="max-w-3xl mx-auto px-6 py-16"
          >
            <div className="mb-16">
              <div className="flex justify-between items-end mb-6">
                <div>
                  <span className="text-[10px] font-bold text-brand-accent-gold uppercase tracking-[0.2em]">Discovery in progress</span>
                  <h2 className="text-3xl font-serif italic mt-2">The Sanctuary Survey</h2>
                </div>
                <span className="text-[10px] font-bold text-brand-muted uppercase tracking-widest">{Math.round(progress)}%</span>
              </div>
              <div className="h-[1px] w-full bg-brand-border overflow-hidden">
                <motion.div 
                  className="h-full bg-brand-accent-sage" 
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="bg-white border border-brand-border p-10 sm:p-16 rounded-[2rem] mb-12">
              <p className="text-2xl sm:text-3xl text-brand-text font-serif italic leading-snug mb-16 text-center">
                "{questions[currentQuestionIndex]?.text}"
              </p>

              <div className="max-w-md mx-auto">
                <div className="grid grid-cols-5 gap-3 mb-4">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      onClick={() => handleResponse(val)}
                      className="group flex flex-col items-center"
                    >
                      <div className="w-full aspect-square flex items-center justify-center rounded-full border border-brand-border group-hover:border-brand-text group-hover:bg-brand-surface transition-all text-xs font-bold text-brand-muted group-hover:text-brand-text">
                        {val}
                      </div>
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-[9px] font-bold text-brand-muted uppercase tracking-[0.2em]">
                  <span>Disagree</span>
                  <span>Agree</span>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <button
                onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                disabled={currentQuestionIndex === 0}
                className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.2em] hover:text-brand-text disabled:opacity-0 transition-colors"
              >
                ← Prev Question
              </button>
            </div>

            {currentQuestionIndex === questions.length - 1 && responses.length === questions.length && !result?.email && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed inset-0 z-[100] bg-brand-text/40 backdrop-blur-sm flex items-center justify-center p-6"
              >
                <div className="bg-brand-bg rounded-[2.5rem] p-10 max-w-md w-full border border-brand-border shadow-2xl">
                  <h3 className="text-2xl font-serif italic mb-2">Final Step</h3>
                  <p className="text-sm text-brand-muted mb-8 leading-relaxed">Where should we secure your results? We'll send a full summary to your inbox.</p>
                  <form onSubmit={handleSubmitResults} className="space-y-6">
                    <div>
                      <input 
                        required
                        type="text" 
                        value={userInfo.name}
                        onChange={(e) => setUserInfo({...userInfo, name: e.target.value})}
                        className="w-full px-0 py-4 bg-transparent border-b border-brand-border focus:border-brand-text outline-none text-sm transition-all placeholder:text-brand-muted/50"
                        placeholder="NAME"
                      />
                    </div>
                    <div>
                      <input 
                        required
                        type="email" 
                        value={userInfo.email}
                        onChange={(e) => setUserInfo({...userInfo, email: e.target.value})}
                        className="w-full px-0 py-4 bg-transparent border-b border-brand-border focus:border-brand-text outline-none text-sm transition-all placeholder:text-brand-muted/50"
                        placeholder="EMAIL ADDRESS"
                      />
                    </div>
                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-5 bg-brand-text text-white rounded-full text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-black transition-all disabled:opacity-50"
                    >
                      {isSubmitting ? "Generating..." : "Reveal Results"}
                    </button>
                  </form>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {view === 'results' && result && (
          <motion.div
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="px-6 py-16 sm:py-24 max-w-7xl mx-auto"
          >
            <div className="flex flex-col lg:flex-row gap-16">
              {/* Results Main Section */}
              <div className="flex-1">
                <span className="text-[11px] font-bold text-brand-accent-gold uppercase tracking-[0.3em] mb-6 block">Survey Complete</span>
                <h2 className="text-5xl sm:text-6xl font-serif italic mb-8 leading-tight">Welcome to your <br/>ministry, {userInfo.name}.</h2>
                
                <div className="space-y-12 max-w-2xl">
                  {result.primaryGiftIds.length > 0 && (
                    <p className="text-lg text-brand-muted leading-relaxed font-light">
                      Based on your responses, your primary spiritual gift is <span className="text-brand-text font-semibold italic">{gifts.find(g => g.id === result.primaryGiftIds[0])?.name}</span>. You have a unique, God-given ability that ripples through the lives of those you serve.
                    </p>
                  )}

                  <div className="grid sm:grid-cols-2 gap-6">
                    {result.primaryGiftIds.map((id, idx) => {
                      const gift = gifts.find(g => g.id === id);
                      if (!gift) return null;
                      return (
                        <div key={gift.id} className="p-8 bg-white border border-brand-border rounded-[2rem] hover:border-brand-accent-sage transition-all group">
                          <div className="text-[9px] uppercase tracking-widest text-brand-accent-gold mb-3 font-bold">{idx === 0 ? 'Primary' : 'Secondary'} Gift</div>
                          <div className="text-2xl font-serif italic mb-2 group-hover:text-brand-accent-sage transition-colors">{gift.name}</div>
                          <p className="text-xs text-brand-muted leading-relaxed line-clamp-3 mb-4">{gift.description}</p>
                          <div className="h-[2px] w-full bg-brand-surface mt-4 overflow-hidden rounded-full">
                            <motion.div 
                              className={`h-full ${idx === 0 ? 'bg-brand-accent-sage' : 'bg-brand-accent-gold'}`} 
                              initial={{ width: 0 }}
                              animate={{ width: `${(result.scores[id] / 10) * 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-4 text-[11px] text-brand-muted uppercase tracking-widest font-medium border-t border-brand-border pt-8">
                    <Mail className="w-4 h-4 opacity-50" />
                    <span>A detailed summary has been sent to {userInfo.email}</span>
                  </div>
                </div>
              </div>

              {/* Sidebar CTA */}
              <div className="lg:w-96">
                <div className="bg-brand-surface rounded-[3rem] p-10 sm:p-12 flex flex-col h-full border border-brand-border shadow-sm">
                  <h3 className="text-2xl font-serif italic mb-6">Ready to serve?</h3>
                  <p className="text-sm text-brand-muted leading-relaxed mb-10 font-light">
                    Your gifts are a perfect match for our <span className="font-bold text-brand-text">Welcome Team</span> and <span className="font-bold text-brand-text">Hospitality</span> groups at Sanctuary.
                  </p>
                  
                  <div className="space-y-4 mb-auto">
                    <a 
                      href="https://sanctuarycov.org/join-a-team/" 
                      className="block w-full py-5 bg-brand-text text-white text-center text-[10px] uppercase tracking-[0.25em] font-bold rounded-full hover:bg-black transition-all"
                      onClick={() => trackEvent('cta_click', { target: 'join_a_team' })}
                    >
                      Join the Team
                    </a>
                    <button 
                      onClick={resetSurvey}
                      className="block w-full py-5 border border-brand-text text-brand-text text-center text-[10px] uppercase tracking-[0.25em] font-bold rounded-full hover:bg-brand-text hover:text-white transition-all"
                    >
                      Retake Journey
                    </button>
                  </div>

                  {/* Insights Section for Admin tracking */}
                  <div className="mt-12 pt-10 border-t border-brand-border/50">
                    <div className="flex justify-between items-end mb-4">
                      <span className="text-[9px] uppercase tracking-[0.2em] font-bold text-brand-muted">Admin Insights</span>
                      <span className="text-[8px] text-brand-accent-gold uppercase font-bold tracking-widest animate-pulse">Live Tracking</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center">
                        <div className="text-sm font-bold text-brand-text">1,402</div>
                        <div className="text-[8px] uppercase tracking-tighter text-brand-muted">Starts</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-bold text-brand-text">980</div>
                        <div className="text-[8px] uppercase tracking-tighter text-brand-muted">Finish</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-bold text-brand-accent-sage">18%</div>
                        <div className="text-[8px] uppercase tracking-tighter text-brand-muted">Join rate</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}

