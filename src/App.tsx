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
  ShieldAlert,
  Info
} from 'lucide-react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import Layout from './components/Layout';
import AdminDashboard from './components/AdminDashboard';
import Sanctuary5Hero from './components/Sanctuary5Hero';
import { db, auth, googleProvider, isFirebaseConfigured } from './lib/firebase';
import { INITIAL_QUESTIONS, INITIAL_GIFTS } from './constants';
import { Question, Gift, SurveyResponse, SurveyResult, GiftMatch, MinistryMatch } from './types';
import { generateResultsEmailHtml } from './lib/emailTemplate';
import { trackEvent } from './utils/analytics';

type View = 'hero' | 'survey' | 'results' | 'admin';

const DEFAULT_ADMIN_EMAILS = [
  'cdonyi@gmail.com',
  'sanctuarycovdeveloper@gmail.com',
  'siona@sanctuarycov.org'
];

export default function App() {
  const [view, setView] = useState<View>('hero');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [userInfo, setUserInfo] = useState({ name: '', email: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEmailSubmitted, setIsEmailSubmitted] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ success: boolean; mode?: string; message: string } | null>(null);
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [result, setResult] = useState<SurveyResult | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [allowedAdminEmails, setAllowedAdminEmails] = useState<string[]>(DEFAULT_ADMIN_EMAILS);

  // Load configured admin emails from server
  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_URL || '';
    if (!apiBase) return;
    fetch(`${apiBase}/api/admin-config`)
      .then(async res => {
        if (!res.ok) return null;
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) return null;
        const text = await res.text();
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      })
      .then(data => {
        if (data && Array.isArray(data.admins) && data.admins.length > 0) {
          setAllowedAdminEmails(data.admins);
        }
      })
      .catch(() => {
        // Silently fallback to default admin emails if server endpoint is unavailable
      });
  }, [view]);
  
  // Dynamic content from Firestore
  const [questions, setQuestions] = useState<Question[]>(INITIAL_QUESTIONS);
  const [gifts, setGifts] = useState<Gift[]>(INITIAL_GIFTS);
  const [isDataLoading, setIsDataLoading] = useState(true);

  // Sync with Auth
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setIsDataLoading(false);
      return;
    }
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
  }, []);

  // Sync Questions & Gifts
  useEffect(() => {
    if (!isFirebaseConfigured) {
      const localQ = localStorage.getItem('sanctuary_questions');
      if (localQ) {
        try {
          const parsed = JSON.parse(localQ) as Question[];
          parsed.sort((a, b) => {
            const orderA = typeof a.order === 'number' ? a.order : (parseInt(a.id, 10) || 0);
            const orderB = typeof b.order === 'number' ? b.order : (parseInt(b.id, 10) || 0);
            return orderA - orderB;
          });
          setQuestions(parsed);
        } catch (e) {
          console.error(e);
        }
      }
      setIsDataLoading(false);
      return;
    }

    const unsubGifts = onSnapshot(
      collection(db, 'gifts'),
      (snapshot) => {
        if (!snapshot.empty) {
          setGifts(snapshot.docs.map(doc => doc.data() as Gift));
        }
      },
      (error) => {
        console.warn('Firestore "gifts" collection listener error (using fallback local data):', error);
      }
    );

    const unsubQuestions = onSnapshot(
      collection(db, 'questions'),
      (snapshot) => {
        if (!snapshot.empty) {
          const loadedQuestions = snapshot.docs.map(doc => doc.data() as Question);
          loadedQuestions.sort((a, b) => {
            const orderA = typeof a.order === 'number' ? a.order : (parseInt(a.id, 10) || 0);
            const orderB = typeof b.order === 'number' ? b.order : (parseInt(b.id, 10) || 0);
            return orderA - orderB;
          });
          setQuestions(loadedQuestions);
        }
        setIsDataLoading(false);
      },
      (error) => {
        console.warn('Firestore "questions" collection listener error (using fallback local data):', error);
        setIsDataLoading(false);
      }
    );

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
    if (!isFirebaseConfigured) {
      // In local demo mode, bypass Google Sign-in to allow easy client testing of the Admin Dashboard
      setUser({
        uid: 'demo-curator-id',
        email: 'cdonyi@gmail.com',
        displayName: 'Demo Curator',
      } as any);
      setView('admin');
      return;
    }
    try {
      setLoginError(null);
      await signInWithPopup(auth, googleProvider);
      setView('admin');
    } catch (error: any) {
      const errMsg = error?.message || String(error);
      const errCode = error?.code || '';

      if (
        errCode === 'auth/popup-closed-by-user' ||
        errCode === 'auth/cancelled-popup-request' ||
        errCode === 'auth/popup-blocked' ||
        errMsg.includes('auth/popup-closed-by-user') ||
        errMsg.includes('auth/cancelled-popup-request') ||
        errMsg.includes('auth/popup-blocked')
      ) {
        // Silently ignore user closing/canceling login popup window
        setLoginError(null);
        return;
      }

      console.error('Login failed', error);

      if (errMsg.includes('auth/configuration-not-found')) {
        setLoginError('Google Sign-in is not enabled or not fully configured in your Firebase Project.\n\nTo resolve this:\n1. Go to the Firebase Console (https://console.firebase.google.com)\n2. Navigate to "Build" -> "Authentication" -> "Sign-in method" tab.\n3. Add and Enable the "Google" provider.\n4. Ensure you save the changes.');
      } else if (errMsg.includes('auth/operation-not-allowed')) {
        setLoginError('Google provider is disabled in your Firebase Console. Please go to Build -> Authentication and enable Google Sign-In.');
      } else if (errMsg.includes('auth/unauthorized-domain')) {
        const currentHost = window.location.hostname;
        setLoginError(`Firebase Auth Error: Unauthorized Domain.\n\nThe domain "${currentHost}" is not authorized in Firebase Project: "${firebaseProjectId}".\n\nTo resolve this:\n1. Go to the Firebase Console (https://console.firebase.google.com)\n2. Select Project: "${firebaseProjectId}"\n3. Navigate to "Build" -> "Authentication" -> "Settings" tab (top right).\n4. Click on "Authorized domains" on the left menu.\n5. Click "Add domain" and add:\n   • ${currentHost}\n6. If you share this app, also add:\n   • ais-pre-bun6aislalbji7kh7as6y6-513878994172.us-east1.run.app`);
      } else {
        setLoginError(`Firebase Auth Error: ${errMsg}`);
      }
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
    
    // Top 5 Gift Matches
    const topGiftsList: GiftMatch[] = sortedGifts.slice(0, 5).map(g => {
      const qCount = questions.filter(q => q.giftId === g.id).length;
      return {
        giftId: g.id,
        name: g.name,
        score: scores[g.id] || 0,
        maxScore: qCount * 5 || 10,
        description: g.description,
        scripture: g.scripture,
        serviceTeams: g.serviceTeams || []
      };
    });

    // Top 5 Ministry Matches derived from top gifts
    const ministryMatches: MinistryMatch[] = [];
    const seenTeams = new Set<string>();

    for (const gMatch of topGiftsList) {
      if (gMatch.serviceTeams) {
        for (const team of gMatch.serviceTeams) {
          if (!seenTeams.has(team)) {
            seenTeams.add(team);
            ministryMatches.push({
              teamName: team,
              giftId: gMatch.giftId,
              giftName: gMatch.name
            });
            if (ministryMatches.length >= 5) break;
          }
        }
      }
      if (ministryMatches.length >= 5) break;
    }

    return {
      userId: Math.random().toString(36).substring(7),
      timestamp: new Date().toISOString(),
      responses: finalResponses,
      scores,
      primaryGiftIds: topGiftsList.map(g => g.giftId),
      topGifts: topGiftsList,
      topMinistryMatches: ministryMatches,
      ...userInfo
    };
  };

  const sendDirectResendEmail = async (payload: { name: string; email: string; topGifts: any[]; topMinistryMatches: any[]; timestamp?: string }) => {
    const resendKey = import.meta.env.VITE_RESEND_API_KEY;
    if (!resendKey) return null;

    const html = generateResultsEmailHtml(payload);
    const fromEmail = import.meta.env.VITE_RESEND_FROM_EMAIL || 'Sanctuary Covenant Church <onboarding@resend.dev>';

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendKey.trim()}`
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [payload.email],
        subject: `Your Soul Discovery Survey Results - ${payload.name || 'Participant'}`,
        html
      })
    });

    const data = await response.json();
    if (response.ok) {
      return { success: true, mode: 'resend_direct', message: `Results report successfully emailed to ${payload.email} via Resend!` };
    } else {
      throw new Error(data.message || data.error || 'Resend API error');
    }
  };

  const handleSubmitResults = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInfo.email || !userInfo.email.trim()) return;

    setIsSubmitting(true);
    setEmailStatus(null);
    try {
      const computedResult = result || calculateResult(responses);
      const finalResult = { ...computedResult, ...userInfo };
      setResult(finalResult);

      const emailPayload = {
        name: userInfo.name,
        email: userInfo.email,
        topGifts: finalResult.topGifts || [],
        topMinistryMatches: finalResult.topMinistryMatches || [],
        timestamp: finalResult.timestamp
      };

      // 1. Try Direct Client-Side Resend if VITE_RESEND_API_KEY is defined
      if (import.meta.env.VITE_RESEND_API_KEY) {
        try {
          const directRes = await sendDirectResendEmail(emailPayload);
          if (directRes) {
            setEmailStatus(directRes);
            setIsEmailSubmitted(true);
            trackEvent('survey_complete', { topGifts: finalResult.primaryGiftIds });
            setView('results');
            return;
          }
        } catch (directErr: any) {
          console.warn('[Direct Resend Error]', directErr);
        }
      }

      // 2. Fallback to API endpoint (/api/send-results)
      const apiBase = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiBase}/api/send-results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailPayload)
      });

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        console.log('[Email Trigger Result]', data);
        setEmailStatus({
          success: true,
          mode: data.mode,
          message: data.message
        });
      } else if (res.status === 404 || !contentType.includes('application/json')) {
        // Static hosting mode
        console.log('[Email Trigger] Backend route /api/send-results unavailable on static deployment host.');
        setEmailStatus({
          success: true,
          mode: 'saved_locally',
          message: 'Survey results completed and saved successfully!'
        });
      } else {
        let errText = 'Server error during email dispatch.';
        if (contentType.includes('application/json')) {
          try {
            const errJson = await res.json();
            if (errJson.error) errText = errJson.error;
          } catch {}
        }
        console.warn('[Email Trigger Error]', errText);
        setEmailStatus({
          success: false,
          message: errText
        });
      }

      setIsEmailSubmitted(true);
      trackEvent('survey_complete', { topGifts: finalResult.primaryGiftIds });
      setView('results');
    } catch (error: any) {
      console.error('Failed to submit results email:', error);
      setEmailStatus({
        success: false,
        message: error?.message || 'Network error sending results email'
      });
      setIsEmailSubmitted(true);
      setView('results');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendEmail = async () => {
    if (!result || !userInfo.email) return;
    setIsResendingEmail(true);
    try {
      const emailPayload = {
        name: userInfo.name,
        email: userInfo.email,
        topGifts: result.topGifts || [],
        topMinistryMatches: result.topMinistryMatches || [],
        timestamp: result.timestamp
      };

      // 1. Try Direct Client-Side Resend if VITE_RESEND_API_KEY is defined
      if (import.meta.env.VITE_RESEND_API_KEY) {
        const directRes = await sendDirectResendEmail(emailPayload);
        if (directRes) {
          setEmailStatus(directRes);
          return;
        }
      }

      // 2. Fallback to API endpoint
      const apiBase = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiBase}/api/send-results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailPayload)
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setEmailStatus({
          success: true,
          mode: data.mode,
          message: data.message
        });
      } else if (res.status === 404 || !contentType.includes('application/json')) {
        setEmailStatus({
          success: false,
          message: 'Backend email service is not connected. Add VITE_RESEND_API_KEY to Netlify environment variables.'
        });
      } else {
        let errText = 'Failed to resend email';
        if (contentType.includes('application/json')) {
          try {
            const errJson = await res.json();
            if (errJson.error) errText = errJson.error;
          } catch {}
        }
        setEmailStatus({ success: false, message: errText });
      }
    } catch (err: any) {
      setEmailStatus({ success: false, message: err?.message || 'Network error' });
    } finally {
      setIsResendingEmail(false);
    }
  };

  const resetSurvey = () => {
    setResponses([]);
    setCurrentQuestionIndex(0);
    setView('hero');
    setResult(null);
    setIsEmailSubmitted(false);
    setEmailStatus(null);
  };

  const progress = (currentQuestionIndex / questions.length) * 100;

  if (view === 'admin') {
    // Check if current user is in authorized admin email list
    const userEmailLower = user?.email?.toLowerCase();
    const isAuthorizedAdmin = userEmailLower && allowedAdminEmails.some(a => a.toLowerCase() === userEmailLower);

    if (!isAuthorizedAdmin) {
      return (
        <div className="h-screen flex items-center justify-center bg-brand-bg flex-col gap-6 p-6 text-center">
          <ShieldAlert className="w-12 h-12 text-red-500" />
          <h2 className="text-2xl font-serif italic text-brand-text">Unauthorized Access</h2>
          <p className="text-xs text-brand-muted max-w-md leading-relaxed">
            You are logged in as <span className="font-bold text-brand-text">{user?.email || 'unknown'}</span>, which is not in the list of authorized administrators.
          </p>
          <p className="text-[11px] text-brand-muted/80 max-w-md leading-relaxed">
            To gain access, please ask an existing administrator to add your email address in the Admin Access settings.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            <button 
              onClick={async () => {
                try {
                  if (auth) {
                    await signOut(auth);
                  }
                  setView('hero');
                } catch (err) {
                  console.error("Failed to sign out", err);
                }
              }} 
              className="px-6 py-3 border border-brand-border hover:bg-brand-surface rounded-full text-[10px] font-bold uppercase tracking-[0.2em] transition-all"
            >
              Sign Out & Switch User
            </button>
            <button 
              onClick={() => setView('hero')} 
              className="px-6 py-3 bg-brand-text text-white rounded-full text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-black transition-all"
            >
              Return Home
            </button>
          </div>
        </div>
      );
    }
    return <AdminDashboard onExit={() => setView('hero')} />;
  }

  return (
    <Layout 
      activeView={view} 
      onSelectView={(v) => setView(v)} 
      onAdminClick={user ? () => setView('admin') : handleAdminLogin}
      isAdminLoggedIn={!!user}
    >
      {!isFirebaseConfigured && (
        <div className="bg-brand-accent-sage/10 border-b border-brand-border py-2.5 px-4 text-center text-xs text-brand-accent-sage flex items-center justify-center gap-2 font-medium z-40 relative">
          <span>✨ Running in Local Demo Mode (Firebase database not connected).</span>
          <button 
            onClick={() => setShowSetupModal(true)} 
            className="underline font-bold hover:text-brand-text transition-colors"
          >
            View Setup Guide
          </button>
        </div>
      )}
      <div className="fixed bottom-4 right-4 z-50 opacity-30 hover:opacity-100 transition-opacity">
        <button 
          onClick={user ? () => setView('admin') : handleAdminLogin}
          className="p-2.5 bg-brand-bg border border-brand-border rounded-full hover:bg-brand-surface shadow-md"
          title="Curator Admin Login"
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
          >
            <Sanctuary5Hero onStartSurvey={startSurvey} />
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

            {currentQuestionIndex === questions.length - 1 && responses.length === questions.length && !isEmailSubmitted && (
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
                      className="w-full py-5 bg-brand-red text-white rounded-full text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-brand-red-hover transition-all disabled:opacity-50 shadow-md shadow-brand-red/20"
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
                <span className="text-[11px] font-bold text-brand-red uppercase tracking-[0.3em] mb-6 block">Survey Complete</span>
                <h2 className="text-5xl sm:text-6xl font-serif italic mb-8 leading-tight">Welcome to your <br/>ministry, {userInfo.name}.</h2>
                
                <div className="space-y-12 max-w-2xl">
                  {result.topGifts && result.topGifts.length > 0 && (
                    <p className="text-lg text-brand-muted leading-relaxed font-light">
                      Based on your responses, your primary spiritual gift is <span className="text-brand-text font-semibold italic">{result.topGifts[0].name}</span>. You have a unique, God-given ability that ripples through the lives of those you serve.
                    </p>
                  )}

                  {/* Top 5 Spiritual Gifts Section */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-[0.22em] text-brand-red mb-6">
                      Top 5 Spiritual Gifts Matches
                    </h3>
                    <div className="space-y-4">
                      {result.topGifts ? result.topGifts.slice(0, 5).map((gMatch, idx) => (
                        <div key={gMatch.giftId} className="p-6 bg-white border border-brand-border rounded-[1.8rem] hover:border-brand-red/40 transition-all group shadow-2xs">
                          <div className="flex items-center justify-between mb-2">
                            <span className={`text-[9px] uppercase tracking-widest font-bold px-3 py-1 rounded-full ${idx === 0 ? 'bg-brand-red text-white' : idx === 1 ? 'bg-brand-accent-gold/20 text-brand-accent-gold border border-brand-accent-gold/30' : 'bg-brand-surface text-brand-muted'}`}>
                              #{idx + 1} {idx === 0 ? 'Primary Gift' : idx === 1 ? 'Secondary Gift' : 'Gift Match'}
                            </span>
                            <span className="text-xs font-mono font-bold text-brand-text bg-brand-surface px-2.5 py-1 rounded-lg">
                              {gMatch.score} / {gMatch.maxScore} pts
                            </span>
                          </div>
                          <div className="text-xl font-serif italic mb-1 text-brand-text group-hover:text-brand-red transition-colors">
                            {gMatch.name}
                          </div>
                          {gMatch.scripture && (
                            <div className="text-[11px] text-brand-red font-serif italic mb-2">
                              {gMatch.scripture}
                            </div>
                          )}
                          <p className="text-xs text-brand-muted leading-relaxed mb-3 font-light">
                            {gMatch.description}
                          </p>
                          <div className="h-[3px] w-full bg-brand-surface overflow-hidden rounded-full">
                            <motion.div 
                              className={`h-full ${idx === 0 ? 'bg-brand-red' : 'bg-brand-accent-gold'}`} 
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, Math.max(10, (gMatch.score / (gMatch.maxScore || 10)) * 100))}%` }}
                              transition={{ duration: 0.8, delay: idx * 0.1 }}
                            />
                          </div>
                        </div>
                      )) : null}
                    </div>
                  </div>

                  {/* Top 5 Ministry Matches Section */}
                  {result.topMinistryMatches && result.topMinistryMatches.length > 0 && (
                    <div className="pt-4 border-t border-brand-border">
                      <h3 className="text-xs font-bold uppercase tracking-[0.22em] text-brand-accent-gold mb-4">
                        Top 5 Recommended Ministry Teams
                      </h3>
                      <p className="text-xs text-brand-muted mb-6 font-light">
                        Based on your top spiritual gifts, here are 5 ministry areas at Sanctuary Covenant Church where you can flourish:
                      </p>
                      <div className="grid gap-3">
                        {result.topMinistryMatches.slice(0, 5).map((mMatch, idx) => (
                          <div key={mMatch.teamName} className="p-4 bg-brand-surface/60 border border-brand-border rounded-2xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="w-6 h-6 rounded-full bg-brand-red/10 text-brand-red flex items-center justify-center text-[10px] font-bold">
                                {idx + 1}
                              </span>
                              <span className="text-sm font-serif italic font-bold text-brand-text">
                                {mMatch.teamName}
                              </span>
                            </div>
                            <span className="text-[10px] font-medium text-brand-muted bg-white px-3 py-1 rounded-full border border-brand-border">
                              Aligned with {mMatch.giftName}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border-t border-brand-border pt-8 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-[11px] text-brand-muted uppercase tracking-widest font-medium">
                      <div className="flex items-center gap-3">
                        <Mail className="w-4 h-4 text-brand-red shrink-0" />
                        <span>
                          {emailStatus?.mode === 'simulated' ? (
                            <>Results report generated for <strong className="text-brand-text font-bold">{userInfo.email || 'participant'}</strong> <span className="normal-case text-[10px] text-brand-accent-sage font-mono">(Simulation Mode)</span></>
                          ) : (
                            <>Results report emailed to <strong className="text-brand-text font-bold">{userInfo.email || 'participant'}</strong> and church leadership.</>
                          )}
                        </span>
                      </div>
                      {userInfo.email && (
                        <button
                          onClick={handleResendEmail}
                          disabled={isResendingEmail}
                          className="px-4 py-2 bg-brand-surface border border-brand-border rounded-full hover:bg-white transition-all text-[9px] font-bold text-brand-text flex items-center justify-center gap-2 self-start sm:self-auto disabled:opacity-50"
                        >
                          <Mail className="w-3.5 h-3.5 text-brand-red" />
                          {isResendingEmail ? 'Sending...' : 'Resend Email Report'}
                        </button>
                      )}
                    </div>
                    {emailStatus?.message && (
                      <div className={`p-3 rounded-xl border text-[10px] font-mono leading-relaxed ${emailStatus.success ? 'bg-emerald-50/60 border-emerald-200 text-emerald-800' : 'bg-amber-50/60 border-amber-200 text-amber-800'}`}>
                        {emailStatus.message}
                      </div>
                    )}
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
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackEvent('cta_click', { target: 'join_a_team' })}
                      className="block w-full py-5 bg-brand-red text-white text-center text-[10px] uppercase tracking-[0.25em] font-bold rounded-full hover:bg-brand-red-hover transition-all shadow-md shadow-brand-red/20"
                    >
                      Join a Team (sanctuarycov.org)
                    </a>
                    <button 
                      onClick={resetSurvey}
                      className="block w-full py-4 border border-brand-border bg-white text-brand-text text-center text-[10px] uppercase tracking-[0.2em] font-bold rounded-full hover:bg-brand-surface transition-all"
                    >
                      Retake Survey
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

      {/* Configuration & Migration Guide Modal */}
      {showSetupModal && (
        <div className="fixed inset-0 z-[200] bg-brand-text/50 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-brand-bg rounded-[2.5rem] p-10 max-w-2xl w-full border border-brand-border shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-2xl font-serif italic text-brand-text">Firebase Migration Guide</h3>
                <p className="text-xs text-brand-muted mt-1">Configure your own Google Account's Firebase Database</p>
              </div>
              <button 
                onClick={() => setShowSetupModal(false)}
                className="text-xs font-bold uppercase tracking-widest text-brand-muted hover:text-brand-text p-2"
              >
                Close
              </button>
            </div>

            <div className="space-y-6 text-sm text-brand-text leading-relaxed">
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-brand-accent-gold mb-2">Step 1: Get Firebase Credentials</h4>
                <p className="text-xs text-brand-muted">
                  Go to the <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="underline font-medium hover:text-brand-text">Firebase Console</a>, create or select your project, go to <strong>Project Settings → General → Your apps</strong>, and create a Web App to get your configuration object.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-brand-accent-gold mb-2">Step 2: Add Environment Variables</h4>
                <p className="text-xs text-brand-muted mb-3">
                  Create a <code>.env</code> file in your local directory (or configure them in your deployment environment) and set the following variables using your project credentials:
                </p>
                <pre className="bg-brand-surface p-4 rounded-xl font-mono text-[10px] text-brand-text overflow-x-auto border border-brand-border">
{`VITE_FIREBASE_API_KEY="your-api-key"
VITE_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="your-project-id"
VITE_FIREBASE_STORAGE_BUCKET="your-project.firebasestorage.app"
VITE_FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
VITE_FIREBASE_APP_ID="your-app-id"
VITE_FIREBASE_DATABASE_ID=""`}
                </pre>
              </div>

              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-brand-accent-gold mb-2">Step 3: Enable Authentication & Firestore</h4>
                <ul className="list-disc pl-5 text-xs text-brand-muted space-y-1">
                  <li>In the Firebase Console, go to <strong>Build → Authentication</strong> and enable the <strong>Google Sign-in</strong> provider.</li>
                  <li>Go to <strong>Build → Firestore Database</strong> and create your database (Start in Test Mode or use the security rules in <code>firestore.rules</code>).</li>
                </ul>
              </div>

              <div className="p-4 bg-brand-accent-sage/10 rounded-2xl border border-brand-accent-sage/20">
                <p className="text-xs text-brand-accent-sage font-medium font-sans">
                  💡 <strong>Seamless Offline Support:</strong> Since you are running in Local Demo Mode, all survey actions, results, and even the Admin Dashboard are completely functional! You can explore the entire app offline using built-in mock configurations.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowSetupModal(false)}
              className="w-full mt-8 py-4 bg-brand-text text-white rounded-full text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-black transition-all"
            >
              Got it, Continue Demo
            </button>
          </div>
        </div>
      )}

      {/* Login Error Modal */}
      {loginError && (
        <div className="fixed inset-0 z-[200] bg-brand-text/50 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-brand-bg rounded-[2.5rem] p-10 max-w-xl w-full border border-brand-border shadow-2xl">
            <div className="flex items-center gap-3 text-red-600 mb-6">
              <Info className="w-6 h-6 shrink-0" />
              <h3 className="text-2xl font-serif italic text-brand-text">Authentication Error</h3>
            </div>
            
            <p className="text-xs text-brand-muted uppercase tracking-wider font-bold mb-2">Details:</p>
            <pre className="bg-brand-surface p-4 rounded-xl font-mono text-[10.5px] text-brand-text overflow-x-auto border border-brand-border leading-relaxed mb-6 whitespace-pre-wrap">
              {loginError}
            </pre>

            <div className="space-y-3">
              <button
                onClick={() => {
                  // Bypass live Google sign in and switch to demo admin mode
                  setUser({
                    uid: 'demo-curator-id',
                    email: 'cdonyi@gmail.com',
                    displayName: 'Demo Curator',
                  } as any);
                  setView('admin');
                  setLoginError(null);
                }}
                className="w-full py-4 bg-brand-accent-sage text-white rounded-full text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-opacity-95 transition-all text-center block"
              >
                Proceed anyway using local Demo Mode
              </button>
              
              <button
                onClick={() => setLoginError(null)}
                className="w-full py-4 bg-transparent border border-brand-border text-brand-text rounded-full text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-brand-surface transition-all text-center block"
              >
                Cancel & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

