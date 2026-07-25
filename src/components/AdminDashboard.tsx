/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  getDocs, 
  setDoc, 
  doc, 
  deleteDoc, 
  onSnapshot,
  query,
  orderBy,
  updateDoc
} from 'firebase/firestore';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  X, 
  Settings, 
  Database, 
  BarChart3, 
  LogOut,
  ChevronRight,
  Info,
  ArrowUp,
  ArrowDown,
  ListOrdered,
  Mail,
  Send,
  Check,
  AtSign
} from 'lucide-react';
import { db, auth, isFirebaseConfigured, firebaseProjectId, firebaseDatabaseId } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { Gift, Question, EmailServerStatus } from '../types';
import { INITIAL_GIFTS, INITIAL_QUESTIONS } from '../constants';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export default function AdminDashboard({ onExit }: { onExit: () => void }) {
  const [activeTab, setActiveTab] = useState<'gifts' | 'questions' | 'analytics' | 'emails'>('gifts');
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Email settings states
  const [emailRecipients, setEmailRecipients] = useState<string[]>(['cdonyi@gmail.com', 'leadership@sanctuarycov.org']);
  const [newEmailInput, setNewEmailInput] = useState('');
  const [emailServerStatus, setEmailServerStatus] = useState<EmailServerStatus | null>(null);
  const [isSavingEmails, setIsSavingEmails] = useState(false);
  const [emailSaveSuccess, setEmailSaveSuccess] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<string | null>(null);

  // Form states
  const [editingGift, setEditingGift] = useState<Partial<Gift> | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<Partial<Question> | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isReordering, setIsReordering] = useState(false);

  // Load email configuration from server
  const loadEmailConfig = async () => {
    try {
      const res = await fetch('/api/email-config');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.recipients)) {
          setEmailRecipients(data.recipients);
        }
        setEmailServerStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch email config:', err);
    }
  };

  useEffect(() => {
    loadEmailConfig();
  }, []);

  const handleAddRecipient = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newEmailInput.trim().toLowerCase();
    if (!clean || !clean.includes('@')) {
      alert('Please enter a valid email address.');
      return;
    }
    if (emailRecipients.includes(clean)) {
      alert('Email address is already in the recipient list.');
      return;
    }
    setEmailRecipients([...emailRecipients, clean]);
    setNewEmailInput('');
  };

  const handleRemoveRecipient = (emailToRemove: string) => {
    setEmailRecipients(emailRecipients.filter(e => e !== emailToRemove));
  };

  const handleSaveRecipients = async () => {
    setIsSavingEmails(true);
    setEmailSaveSuccess(false);
    try {
      const res = await fetch('/api/email-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients: emailRecipients })
      });
      if (res.ok) {
        setEmailSaveSuccess(true);
        setTimeout(() => setEmailSaveSuccess(false), 4000);
      }
    } catch (err) {
      alert('Failed to save email recipient list.');
    } finally {
      setIsSavingEmails(false);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = testEmailAddress.trim() || emailRecipients[0] || 'cdonyi@gmail.com';
    setIsTestingEmail(true);
    setTestEmailResult(null);
    try {
      const res = await fetch('/api/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetEmail: target })
      });
      const data = await res.json();
      if (res.ok) {
        setTestEmailResult(`Success (${data.mode}): ${data.message}`);
      } else {
        setTestEmailResult(`Error: ${data.error || 'Failed to send test email.'}`);
      }
    } catch (err: any) {
      setTestEmailResult(`Error: ${err.message || 'Connection failed'}`);
    } finally {
      setIsTestingEmail(false);
    }
  };

  // Compute questions sorted numerically by order or fallback to numeric ID
  const sortedQuestions = useMemo(() => {
    return [...questions].sort((a, b) => {
      const orderA = typeof a.order === 'number' ? a.order : (parseInt(a.id, 10) || 0);
      const orderB = typeof b.order === 'number' ? b.order : (parseInt(b.id, 10) || 0);
      return orderA - orderB;
    });
  }, [questions]);

  function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errInfo = {
      error: errMsg,
      authInfo: {
        userId: auth?.currentUser?.uid || 'demo-user',
        email: auth?.currentUser?.email || 'cdonyi@gmail.com',
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    
    let userFriendly = errMsg;
    if (errMsg.includes('permission-denied') || errMsg.toLowerCase().includes('permission')) {
      userFriendly = 'Permission Denied: Your custom Firestore security rules do not allow this operation. Please make sure to configure your Firestore Rules to allow read & write access (either via console.firebase.google.com in "Rules" or in test mode), and that your authenticated user email is authorized.';
    } else if (errMsg.includes('not-found') || errMsg.toLowerCase().includes('not found')) {
      userFriendly = `Resource not found: Could not load data from collection '${path}'.`;
    } else if (errMsg.toLowerCase().includes('index')) {
      userFriendly = `Index Required: This query requires an index. Follow the link printed in your browser developer console (F12) to create it.`;
    }
    
    setError(userFriendly);
    setIsLoading(false);
  }

  const seedDatabase = async () => {
    setIsSeeding(true);
    try {
      if (!isFirebaseConfigured) {
        localStorage.setItem('sanctuary_gifts', JSON.stringify(INITIAL_GIFTS));
        localStorage.setItem('sanctuary_questions', JSON.stringify(INITIAL_QUESTIONS));
        setGifts(INITIAL_GIFTS);
        setQuestions(INITIAL_QUESTIONS);
        alert('Local database successfully initialized with standard spiritual gifts and questions!');
        return;
      }
      // Seed gifts
      for (const gift of INITIAL_GIFTS) {
        await setDoc(doc(db, 'gifts', gift.id), gift);
      }
      // Seed questions
      for (const q of INITIAL_QUESTIONS) {
        await setDoc(doc(db, 'questions', q.id), q);
      }
      alert('Live Firestore database successfully initialized with standard spiritual gifts and questions!');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'seed_data');
    } finally {
      setIsSeeding(false);
    }
  };

  useEffect(() => {
    if (!isFirebaseConfigured) {
      const localGifts = localStorage.getItem('sanctuary_gifts');
      const localQuestions = localStorage.getItem('sanctuary_questions');
      
      if (localGifts) {
        setGifts(JSON.parse(localGifts));
      } else {
        setGifts(INITIAL_GIFTS);
        localStorage.setItem('sanctuary_gifts', JSON.stringify(INITIAL_GIFTS));
      }
      
      if (localQuestions) {
        try {
          const parsed = JSON.parse(localQuestions) as Question[];
          parsed.sort((a, b) => {
            const orderA = typeof a.order === 'number' ? a.order : (parseInt(a.id, 10) || 0);
            const orderB = typeof b.order === 'number' ? b.order : (parseInt(b.id, 10) || 0);
            return orderA - orderB;
          });
          setQuestions(parsed);
        } catch (e) {
          console.error(e);
          setQuestions(INITIAL_QUESTIONS);
        }
      } else {
        setQuestions(INITIAL_QUESTIONS);
        localStorage.setItem('sanctuary_questions', JSON.stringify(INITIAL_QUESTIONS));
      }
      setIsLoading(false);
      return;
    }

    const unsubGifts = onSnapshot(collection(db, 'gifts'), (snapshot) => {
      setGifts(snapshot.docs.map(doc => doc.data() as Gift));
      setIsLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'gifts'));

    const unsubQuestions = onSnapshot(collection(db, 'questions'), (snapshot) => {
      const loaded = snapshot.docs.map(doc => doc.data() as Question);
      loaded.sort((a, b) => {
        const orderA = typeof a.order === 'number' ? a.order : (parseInt(a.id, 10) || 0);
        const orderB = typeof b.order === 'number' ? b.order : (parseInt(b.id, 10) || 0);
        return orderA - orderB;
      });
      setQuestions(loaded);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'questions'));

    return () => {
      unsubGifts();
      unsubQuestions();
    };
  }, []);

  const moveQuestion = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sortedQuestions.length) return;

    const listCopy = [...sortedQuestions];
    const temp = listCopy[index];
    listCopy[index] = listCopy[targetIndex];
    listCopy[targetIndex] = temp;

    const updated = listCopy.map((q, i) => ({ ...q, order: i + 1 }));

    setQuestions(updated);

    if (!isFirebaseConfigured) {
      localStorage.setItem('sanctuary_questions', JSON.stringify(updated));
      return;
    }

    setIsReordering(true);
    try {
      for (const q of updated) {
        await setDoc(doc(db, 'questions', q.id), q);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'questions');
    } finally {
      setIsReordering(false);
    }
  };

  const renumberQuestionsSequentially = async () => {
    const updated = sortedQuestions.map((q, i) => ({ ...q, order: i + 1 }));
    setQuestions(updated);
    if (!isFirebaseConfigured) {
      localStorage.setItem('sanctuary_questions', JSON.stringify(updated));
      alert(`Successfully renumbered all ${updated.length} questions sequentially!`);
      return;
    }
    setIsReordering(true);
    try {
      for (const q of updated) {
        await setDoc(doc(db, 'questions', q.id), q);
      }
      alert(`Successfully renumbered and saved all ${updated.length} questions to database!`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'questions');
    } finally {
      setIsReordering(false);
    }
  };

  const saveGift = async (gift: Partial<Gift>) => {
    if (!gift.id) return;
    if (!isFirebaseConfigured) {
      const updatedGifts = gifts.map(g => g.id === gift.id ? { ...g, ...gift } as Gift : g);
      if (!gifts.some(g => g.id === gift.id)) {
        updatedGifts.push(gift as Gift);
      }
      setGifts(updatedGifts);
      localStorage.setItem('sanctuary_gifts', JSON.stringify(updatedGifts));
      setEditingGift(null);
      return;
    }
    try {
      await setDoc(doc(db, 'gifts', gift.id), gift);
      setEditingGift(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `gifts/${gift.id}`);
    }
  };

  const deleteGift = async (id: string) => {
    if (!confirm('Are you sure? This will not delete questions mapped to this gift.')) return;
    if (!isFirebaseConfigured) {
      const updatedGifts = gifts.filter(g => g.id !== id);
      setGifts(updatedGifts);
      localStorage.setItem('sanctuary_gifts', JSON.stringify(updatedGifts));
      return;
    }
    try {
      await deleteDoc(doc(db, 'gifts', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `gifts/${id}`);
    }
  };

  const saveQuestion = async (q: Partial<Question>) => {
    const id = q.id || Date.now().toString();
    const existingIndex = sortedQuestions.findIndex(qu => qu.id === id);
    let targetOrder = q.order;
    if (typeof targetOrder !== 'number' || isNaN(targetOrder)) {
      targetOrder = existingIndex >= 0 
        ? (sortedQuestions[existingIndex].order ?? (existingIndex + 1)) 
        : (sortedQuestions.length + 1);
    }

    const questionToSave: Question = {
      id,
      text: q.text || '',
      giftId: q.giftId || gifts[0]?.id || '',
      order: targetOrder
    };

    if (!isFirebaseConfigured) {
      let updatedQuestions = questions.map(qu => qu.id === id ? questionToSave : qu);
      if (!questions.some(qu => qu.id === id)) {
        updatedQuestions.push(questionToSave);
      }
      updatedQuestions.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setQuestions(updatedQuestions);
      localStorage.setItem('sanctuary_questions', JSON.stringify(updatedQuestions));
      setEditingQuestion(null);
      return;
    }
    try {
      await setDoc(doc(db, 'questions', id), questionToSave);
      setEditingQuestion(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `questions/${id}`);
    }
  };

  const deleteQuestion = async (id: string) => {
    if (!confirm('Delete this question?')) return;
    if (!isFirebaseConfigured) {
      const updatedQuestions = questions.filter(qu => qu.id !== id);
      setQuestions(updatedQuestions);
      localStorage.setItem('sanctuary_questions', JSON.stringify(updatedQuestions));
      return;
    }
    try {
      await deleteDoc(doc(db, 'questions', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `questions/${id}`);
    }
  };

  return (
    <div className="flex h-screen bg-brand-bg overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-brand-border bg-white flex flex-col">
        <div className="p-8 border-b border-brand-border">
          <h2 className="text-sm font-bold uppercase tracking-[0.2em]">Curator Panel</h2>
          <p className="text-[10px] text-brand-muted uppercase font-medium mt-1">Management Console</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setActiveTab('gifts')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all ${activeTab === 'gifts' ? 'bg-brand-surface text-brand-text' : 'text-brand-muted hover:bg-brand-bg'}`}
          >
            <Database className="w-4 h-4" /> Spiritual Gifts
          </button>
          <button 
            onClick={() => setActiveTab('questions')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all ${activeTab === 'questions' ? 'bg-brand-surface text-brand-text' : 'text-brand-muted hover:bg-brand-bg'}`}
          >
            <Settings className="w-4 h-4" /> Survey Questions
          </button>
          <button 
            onClick={() => setActiveTab('analytics')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all ${activeTab === 'analytics' ? 'bg-brand-surface text-brand-text' : 'text-brand-muted hover:bg-brand-bg'}`}
          >
            <BarChart3 className="w-4 h-4" /> Analytics
          </button>
          <button 
            onClick={() => setActiveTab('emails')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all ${activeTab === 'emails' ? 'bg-brand-surface text-brand-text font-bold text-brand-red' : 'text-brand-muted hover:bg-brand-bg'}`}
          >
            <Mail className="w-4 h-4" /> Email Notifications
          </button>
        </nav>
        <div className="p-4 border-t border-brand-border bg-brand-surface/20">
          <div className="px-3 py-2.5 rounded-xl border border-brand-border bg-white text-[9px] leading-relaxed mb-3">
            <span className="font-bold text-brand-muted uppercase block mb-1">Firebase Sync Status</span>
            <div className="space-y-0.5 font-mono text-brand-text/80">
              <div className="truncate">Project: <span className="font-bold text-brand-accent-sage">{firebaseProjectId}</span></div>
              {firebaseDatabaseId !== '(default)' && (
                <div className="truncate">Database: <span className="font-bold">{firebaseDatabaseId}</span></div>
              )}
              <div>Mode: <span className={`font-bold ${isFirebaseConfigured ? 'text-brand-accent-sage' : 'text-amber-600'}`}>{isFirebaseConfigured ? 'Live Database' : 'Offline Mock'}</span></div>
              {auth?.currentUser?.email && (
                <div className="truncate border-t border-brand-border/60 mt-1 pt-1">
                  User: <span className="font-bold text-brand-text">{auth.currentUser.email}</span>
                </div>
              )}
            </div>
            {!isFirebaseConfigured && (
              <p className="mt-1.5 text-amber-700 leading-normal text-[8px]">
                Running in Local Mock mode. Set API keys in Settings & click Compile to connect live.
              </p>
            )}
          </div>
          <div className="space-y-1">
            <button 
              onClick={onExit}
              className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest text-brand-text hover:bg-brand-surface transition-all"
            >
              <ChevronRight className="w-4 h-4 text-brand-muted" /> Exit Dashboard
            </button>
            <button 
              onClick={async () => {
                try {
                  if (auth) {
                    await signOut(auth);
                  }
                  onExit();
                } catch (err) {
                  console.error("Sign out failed", err);
                }
              }}
              className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest text-red-600 hover:bg-red-50 transition-all"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-12">
        <header className="mb-12 flex justify-between items-end">
          <div>
            <span className="text-[11px] font-bold text-brand-accent-gold uppercase tracking-[0.3em] mb-2 block">System Configuration</span>
            <h1 className="text-4xl font-serif italic">
              {activeTab === 'gifts' && 'Spiritual Gifts Library'}
              {activeTab === 'questions' && 'Survey Question Pool'}
              {activeTab === 'analytics' && 'Operational Insights'}
              {activeTab === 'emails' && 'Email Notifications & Recipients'}
            </h1>
          </div>
          {activeTab === 'questions' && (
            <div className="flex items-center gap-3">
              <button 
                onClick={renumberQuestionsSequentially}
                disabled={isReordering || sortedQuestions.length === 0}
                title="Normalize order numbers sequentially from 1 to N"
                className="px-5 py-3 bg-white border border-brand-border text-brand-text rounded-full text-[10px] font-bold uppercase tracking-[0.18em] flex items-center gap-2 hover:bg-brand-surface disabled:opacity-50 transition-all"
              >
                <ListOrdered className="w-4 h-4 text-brand-accent-sage" />
                Renumber 1..{sortedQuestions.length}
              </button>
              <button 
                onClick={() => {
                  setEditingQuestion({ text: '', giftId: gifts[0]?.id || '', order: sortedQuestions.length + 1 });
                }}
                className="px-6 py-3 bg-brand-text text-white rounded-full text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2 hover:bg-black transition-all"
              >
                <Plus className="w-4 h-4" /> New Question
              </button>
            </div>
          )}
          {activeTab === 'gifts' && (
            <button 
              onClick={() => {
                setEditingGift({ id: '', name: '', description: '', serviceTeams: [] });
              }}
              className="px-6 py-3 bg-brand-text text-white rounded-full text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2 hover:bg-black transition-all"
            >
              <Plus className="w-4 h-4" /> New Gift
            </button>
          )}
        </header>

        {error && (
          <div className="mb-12 p-8 bg-red-50 border border-red-200 rounded-[2rem] flex items-start gap-4 shadow-sm animate-fade-in">
            <Info className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <h3 className="text-red-800 font-bold text-xs uppercase tracking-wider mb-1">Database Sync Error</h3>
              <p className="text-xs text-red-700 leading-relaxed font-mono whitespace-pre-wrap">{error}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button 
                  onClick={() => { setError(null); setIsLoading(true); window.location.reload(); }}
                  className="px-4 py-2 bg-red-800 hover:bg-red-900 text-white rounded-full text-[9px] font-bold uppercase tracking-wider transition-all"
                >
                  Retry Connection
                </button>
                <button 
                  onClick={() => {
                    setError(null);
                    localStorage.setItem('sanctuary_gifts', JSON.stringify(INITIAL_GIFTS));
                    localStorage.setItem('sanctuary_questions', JSON.stringify(INITIAL_QUESTIONS));
                    setGifts(INITIAL_GIFTS);
                    setQuestions(INITIAL_QUESTIONS);
                    setIsLoading(false);
                  }}
                  className="px-4 py-2 bg-white border border-red-200 hover:bg-red-100 text-red-800 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all"
                >
                  Load Mock Offline Data
                </button>
              </div>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 text-xs font-bold">Dismiss</button>
          </div>
        )}

        {isLoading && !error && (
          <div className="flex flex-col items-center justify-center py-20 bg-white border border-brand-border rounded-[2rem] mb-12">
            <div className="w-6 h-6 border-2 border-brand-accent-sage border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-xs text-brand-muted uppercase tracking-widest font-medium">Synchronizing with Live Database...</p>
          </div>
        )}

        {gifts.length === 0 && questions.length === 0 && !isLoading && (
          <div className="mb-12 p-8 bg-brand-surface border border-brand-border rounded-[2rem] flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-start gap-4">
              <Info className="w-6 h-6 text-brand-accent-gold mt-1 shrink-0" />
              <div>
                <h3 className="font-serif italic text-lg mb-1 text-brand-text">New Database Detected</h3>
                <p className="text-xs text-brand-muted max-w-xl leading-relaxed">
                  Your migrated Firestore database is currently empty. You can instantly seed it with the default Sanctuary Covenant Church spiritual gifts and questions to get started.
                </p>
              </div>
            </div>
            <button
              onClick={seedDatabase}
              disabled={isSeeding}
              className="px-6 py-3 bg-brand-accent-sage text-white rounded-full text-[10px] font-bold uppercase tracking-[0.2em] whitespace-nowrap hover:bg-opacity-90 transition-all disabled:opacity-50"
            >
              {isSeeding ? 'Seeding...' : 'Seed Database'}
            </button>
          </div>
        )}

        {activeTab === 'gifts' && (
          <div className="grid gap-6">
            {gifts.map(gift => (
              <div key={gift.id} className="bg-white border border-brand-border p-8 rounded-[2rem] flex justify-between items-start group hover:border-brand-accent-sage transition-all">
                <div className="max-w-2xl">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-serif italic">{gift.name}</h3>
                    <span className="px-2 py-0.5 bg-brand-surface text-[10px] uppercase font-bold tracking-tighter text-brand-muted border border-brand-border rounded">ID: {gift.id}</span>
                  </div>
                  <p className="text-xs text-brand-muted leading-relaxed mb-4">{gift.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {gift.serviceTeams?.map(team => (
                      <span key={team} className="text-[9px] font-bold uppercase tracking-widest text-brand-accent-gold px-2 py-1 bg-brand-bg rounded-md">
                        {team}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setEditingGift(gift)}
                    className="p-2 text-brand-muted hover:text-brand-text transition-colors"
                  >
                    <Edit3 className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => deleteGift(gift.id)}
                    className="p-2 text-brand-muted hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'questions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-4 py-3 bg-brand-surface border border-brand-border rounded-xl text-xs text-brand-muted">
              <span>Use the <strong className="text-brand-text">Up (↑)</strong> and <strong className="text-brand-text">Down (↓)</strong> buttons to easily reorder questions. Survey takers will encounter questions in this exact order.</span>
              <span className="font-mono text-[10px] font-bold text-brand-accent-sage uppercase">{sortedQuestions.length} Questions Configured</span>
            </div>
            <div className="bg-white border border-brand-border rounded-[2rem] overflow-hidden shadow-sm">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-brand-surface border-b border-brand-border">
                    <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-brand-muted w-20">Order</th>
                    <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-brand-muted">Question Prompt</th>
                    <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-brand-muted">Mapped Gift</th>
                    <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-brand-muted text-center w-36">Move / Sequence</th>
                    <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-brand-muted text-right w-28">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border">
                  {sortedQuestions.map((q, idx) => (
                    <tr key={q.id} className="hover:bg-brand-bg transition-colors group">
                      <td className="px-6 py-5">
                        <span className="inline-flex items-center justify-center text-xs font-mono font-bold text-brand-text bg-brand-surface border border-brand-border px-2.5 py-1 rounded-lg min-w-[36px]">
                          #{q.order ?? (idx + 1)}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-sm font-medium">
                        <p className="text-brand-text leading-snug">{q.text}</p>
                        <span className="text-[10px] font-mono text-brand-muted/70 block mt-1">ID: {q.id}</span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-brand-accent-sage bg-brand-accent-sage/10 px-3 py-1 rounded-full border border-brand-accent-sage/20 whitespace-nowrap">
                          {gifts.find(g => g.id === q.giftId)?.name || q.giftId}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => moveQuestion(idx, 'up')}
                            disabled={idx === 0 || isReordering}
                            title="Move Question Up"
                            className="p-2 rounded-xl border border-brand-border bg-white text-brand-text hover:bg-brand-surface hover:text-brand-accent-sage disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-brand-text transition-all shadow-sm active:scale-95"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => moveQuestion(idx, 'down')}
                            disabled={idx === sortedQuestions.length - 1 || isReordering}
                            title="Move Question Down"
                            className="p-2 rounded-xl border border-brand-border bg-white text-brand-text hover:bg-brand-surface hover:text-brand-accent-sage disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-brand-text transition-all shadow-sm active:scale-95"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex justify-end gap-1.5 text-brand-muted">
                          <button 
                            onClick={() => setEditingQuestion(q)} 
                            className="p-2 hover:text-brand-text hover:bg-brand-surface rounded-xl transition-all"
                            title="Edit Question"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => deleteQuestion(q.id)} 
                            className="p-2 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                            title="Delete Question"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="p-20 text-center bg-white border border-brand-border rounded-[3rem]">
            <Info className="w-12 h-12 text-brand-accent-gold mx-auto mb-6 opacity-30" />
            <h3 className="text-2xl font-serif italic mb-4">Analytics Engine Active</h3>
            <p className="text-sm text-brand-muted max-w-sm mx-auto leading-relaxed">
              Real-time conversion data and gift distribution patterns are being collected. Full visualization suite coming to next iteration.
            </p>
          </div>
        )}

        {activeTab === 'emails' && (
          <div className="space-y-10 max-w-5xl">
            {/* Status Card */}
            <div className="bg-white border border-brand-border rounded-[2.5rem] p-8 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-brand-border/60">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-brand-red inline-block animate-pulse"></span>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-red">Automated Delivery System</span>
                  </div>
                  <h3 className="text-2xl font-serif italic text-brand-text">Survey Results Routing</h3>
                  <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                    Whenever a participant completes the Soul Discovery survey, a full report (Top 5 Gifts & Top 5 Ministry Matches) is emailed to the participant and all notification addresses below.
                  </p>
                </div>
                <div className="p-4 bg-brand-surface rounded-2xl border border-brand-border shrink-0 min-w-[200px]">
                  <div className="text-[9px] uppercase tracking-wider font-bold text-brand-muted mb-1">Delivery Provider</div>
                  <div className="text-sm font-bold text-brand-text">{emailServerStatus?.provider || 'Demo / Simulated Mode'}</div>
                  <div className="text-[10px] text-brand-accent-sage mt-1 font-medium">From: {emailServerStatus?.from || 'Sanctuary Covenant Church'}</div>
                </div>
              </div>

              {/* Recipient Management */}
              <div className="pt-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-wider text-brand-text">Configured Recipient Email Addresses</h4>
                    <p className="text-xs text-brand-muted mt-0.5">These staff / ministry leader addresses receive a copy of every completed survey.</p>
                  </div>
                  <button
                    onClick={handleSaveRecipients}
                    disabled={isSavingEmails}
                    className="px-6 py-3 bg-brand-red text-white text-[10px] font-bold uppercase tracking-[0.2em] rounded-full hover:bg-brand-red-hover transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
                  >
                    {emailSaveSuccess ? (
                      <>
                        <Check className="w-4 h-4" /> Saved!
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" /> Save Email List
                      </>
                    )}
                  </button>
                </div>

                {/* Add New Recipient Form */}
                <form onSubmit={handleAddRecipient} className="flex gap-3 mb-6">
                  <div className="relative flex-1">
                    <AtSign className="w-4 h-4 text-brand-muted absolute left-4 top-3.5" />
                    <input
                      type="email"
                      value={newEmailInput}
                      onChange={e => setNewEmailInput(e.target.value)}
                      placeholder="Add leader email (e.g. pastor@sanctuarycov.org)"
                      className="w-full pl-11 pr-4 py-3 bg-brand-surface/50 border border-brand-border rounded-xl text-xs outline-none focus:border-brand-text"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-6 py-3 bg-brand-text text-white text-[10px] font-bold uppercase tracking-[0.18em] rounded-xl hover:bg-black transition-all flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Add Email
                  </button>
                </form>

                {/* List of Recipients */}
                <div className="space-y-3">
                  {emailRecipients.map(email => (
                    <div key={email} className="flex items-center justify-between p-4 bg-brand-surface/40 border border-brand-border/60 rounded-2xl group hover:bg-white hover:border-brand-border transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-red/10 text-brand-red flex items-center justify-center text-xs font-bold">
                          <Mail className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-brand-text font-mono">{email}</span>
                          <span className="block text-[9px] uppercase tracking-wider text-brand-muted font-bold">Notification Recipient</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveRecipient(email)}
                        className="p-2 text-brand-muted hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                        title="Remove Recipient"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {emailRecipients.length === 0 && (
                    <div className="p-8 text-center bg-brand-surface/20 rounded-2xl border border-dashed border-brand-border text-xs text-brand-muted">
                      No notification email addresses configured. Click "Add Email" above to add leadership contacts.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Test Email Delivery Section */}
            <div className="bg-white border border-brand-border rounded-[2.5rem] p-8 shadow-xs">
              <h3 className="text-xl font-serif italic text-brand-text mb-2">Test Email Generator</h3>
              <p className="text-xs text-brand-muted mb-6 leading-relaxed">
                Send a sample Top 5 Gifts & Top 5 Ministry Matches report to verify email delivery.
              </p>
              <form onSubmit={handleSendTestEmail} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  value={testEmailAddress}
                  onChange={e => setTestEmailAddress(e.target.value)}
                  placeholder={`Send test email to (default: ${emailRecipients[0] || 'your email'})`}
                  className="flex-1 px-4 py-3 bg-brand-surface/50 border border-brand-border rounded-xl text-xs outline-none focus:border-brand-text"
                />
                <button
                  type="submit"
                  disabled={isTestingEmail}
                  className="px-8 py-3 bg-brand-text text-white text-[10px] font-bold uppercase tracking-[0.2em] rounded-xl hover:bg-black transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {isTestingEmail ? 'Sending...' : 'Send Sample Report'}
                </button>
              </form>
              {testEmailResult && (
                <div className="mt-4 p-4 bg-brand-surface rounded-xl border border-brand-border font-mono text-xs text-brand-text leading-relaxed">
                  {testEmailResult}
                </div>
              )}
            </div>

            {/* Setup & Integration Instructions */}
            <div className="bg-brand-surface rounded-[2.5rem] p-8 border border-brand-border">
              <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-brand-accent-gold mb-3">Sending Real Emails Automatically</h4>
              <p className="text-xs text-brand-muted leading-relaxed mb-4">
                This applet uses an Express backend API route (<code>/api/send-results</code>) with Nodemailer. You can automatically dispatch emails through any SMTP server or API service by setting environment variables in your deployment environment:
              </p>

              <div className="grid md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-white rounded-2xl border border-brand-border">
                  <span className="font-bold text-brand-text block mb-1">Option 1: Standard SMTP (Gmail, Microsoft 365, Amazon SES)</span>
                  <pre className="text-[10px] font-mono text-brand-muted bg-brand-surface p-3 rounded-xl overflow-x-auto">
{`SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="pastor@sanctuarycov.org"
SMTP_PASS="app-password-here"
EMAIL_FROM="Sanctuary Covenant Church <no-reply@sanctuarycov.org>"`}
                  </pre>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-brand-border">
                  <span className="font-bold text-brand-text block mb-1">Option 2: Modern Email APIs (Resend / SendGrid)</span>
                  <pre className="text-[10px] font-mono text-brand-muted bg-brand-surface p-3 rounded-xl overflow-x-auto">
{`RESEND_API_KEY="re_123456789..."
# OR
SENDGRID_API_KEY="SG.123456789..."
EMAIL_FROM="Sanctuary Covenant Church <no-reply@sanctuarycov.org>"`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Gift Modal */}
      {editingGift && (
        <div className="fixed inset-0 z-[200] bg-brand-text/40 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-brand-bg rounded-[2.5rem] p-10 max-w-xl w-full border border-brand-border shadow-2xl">
            <h3 className="text-2xl font-serif italic mb-8">{editingGift.name ? 'Edit Gift' : 'Define New Gift'}</h3>
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-muted mb-2">Internal ID</label>
                <input 
                  value={editingGift.id} 
                  onChange={e => setEditingGift({...editingGift, id: e.target.value.toLowerCase().replace(/\s+/g, '_')})}
                  className="w-full px-4 py-3 rounded-xl border border-brand-border focus:border-brand-text outline-none text-sm font-mono"
                  placeholder="e.g. mercy_and_compassion"
                  disabled={!!gifts.find(g => g.id === editingGift.id)}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-muted mb-2">Display Name</label>
                <input 
                  value={editingGift.name} 
                  onChange={e => setEditingGift({...editingGift, name: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-brand-border focus:border-brand-text outline-none text-sm"
                  placeholder="The name users will see"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-muted mb-2">Description</label>
                <textarea 
                  rows={4}
                  value={editingGift.description} 
                  onChange={e => setEditingGift({...editingGift, description: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-brand-border focus:border-brand-text outline-none text-sm resize-none"
                  placeholder="The spiritual significance of this gift"
                />
              </div>
            </div>
            <div className="mt-10 flex gap-4">
              <button 
                onClick={() => saveGift(editingGift)}
                className="flex-1 py-4 bg-brand-text text-white rounded-full text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-black"
              >
                Save Changes
              </button>
              <button 
                onClick={() => setEditingGift(null)}
                className="flex-1 py-4 border border-brand-border text-brand-muted rounded-full text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-brand-surface"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Question Modal */}
      {editingQuestion && (
        <div className="fixed inset-0 z-[200] bg-brand-text/40 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-brand-bg rounded-[2.5rem] p-10 max-w-xl w-full border border-brand-border shadow-2xl">
            <h3 className="text-2xl font-serif italic mb-8">Configure Question</h3>
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-muted mb-2">Question Prompt</label>
                <textarea 
                  rows={3}
                  value={editingQuestion.text} 
                  onChange={e => setEditingQuestion({...editingQuestion, text: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-brand-border focus:border-brand-text outline-none text-sm resize-none italic font-serif"
                  placeholder="e.g. I feel energized when I'm helping others solve practical problems."
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-muted mb-2">Maps to Gift</label>
                <select 
                  value={editingQuestion.giftId} 
                  onChange={e => setEditingQuestion({...editingQuestion, giftId: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-brand-border focus:border-brand-text outline-none text-sm bg-white"
                >
                  {gifts.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-muted mb-2">Display Order Position</label>
                <input 
                  type="number"
                  min={1}
                  max={sortedQuestions.length + 1}
                  value={editingQuestion.order ?? (sortedQuestions.findIndex(q => q.id === editingQuestion.id) + 1 || sortedQuestions.length + 1)}
                  onChange={e => setEditingQuestion({...editingQuestion, order: parseInt(e.target.value) || 1})}
                  className="w-full px-4 py-3 rounded-xl border border-brand-border focus:border-brand-text outline-none text-sm font-mono bg-white"
                  placeholder="Sequence position (e.g. 1)"
                />
                <p className="text-[10px] text-brand-muted mt-1">Controls the sequence of questions in the survey (1 = first question).</p>
              </div>
            </div>
            <div className="mt-10 flex gap-4">
              <button 
                onClick={() => saveQuestion(editingQuestion)}
                className="flex-1 py-4 bg-brand-text text-white rounded-full text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-black"
              >
                Confirm Question
              </button>
              <button 
                onClick={() => setEditingQuestion(null)}
                className="flex-1 py-4 border border-brand-border text-brand-muted rounded-full text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-brand-surface"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
