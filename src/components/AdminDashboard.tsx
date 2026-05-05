/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
  Info
} from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { Gift, Question } from '../types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function AdminDashboard({ onExit }: { onExit: () => void }) {
  const [activeTab, setActiveTab] = useState<'gifts' | 'questions' | 'analytics'>('gifts');
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Form states
  const [editingGift, setEditingGift] = useState<Partial<Gift> | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<Partial<Question> | null>(null);

  useEffect(() => {
    const unsubGifts = onSnapshot(collection(db, 'gifts'), (snapshot) => {
      setGifts(snapshot.docs.map(doc => doc.data() as Gift));
      setIsLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'gifts'));

    const unsubQuestions = onSnapshot(query(collection(db, 'questions'), orderBy('id', 'asc')), (snapshot) => {
      setQuestions(snapshot.docs.map(doc => doc.data() as Question));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'questions'));

    return () => {
      unsubGifts();
      unsubQuestions();
    };
  }, []);

  const saveGift = async (gift: Partial<Gift>) => {
    if (!gift.id) return;
    try {
      await setDoc(doc(db, 'gifts', gift.id), gift);
      setEditingGift(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `gifts/${gift.id}`);
    }
  };

  const deleteGift = async (id: string) => {
    if (!confirm('Are you sure? This will not delete questions mapped to this gift.')) return;
    try {
      await deleteDoc(doc(db, 'gifts', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `gifts/${id}`);
    }
  };

  const saveQuestion = async (q: Partial<Question>) => {
    const id = q.id || Date.now().toString();
    try {
      await setDoc(doc(db, 'questions', id), { ...q, id });
      setEditingQuestion(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `questions/${id}`);
    }
  };

  const deleteQuestion = async (id: string) => {
    if (!confirm('Delete this question?')) return;
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
        </nav>
        <div className="p-4 border-t border-brand-border">
          <button 
            onClick={onExit}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest text-red-500 hover:bg-red-50 transition-all"
          >
            <LogOut className="w-4 h-4" /> Exit Admin
          </button>
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
            </h1>
          </div>
          {activeTab !== 'analytics' && (
            <button 
              onClick={() => {
                if (activeTab === 'gifts') setEditingGift({ id: '', name: '', description: '', serviceTeams: [] });
                else setEditingQuestion({ text: '', giftId: gifts[0]?.id || '' });
              }}
              className="px-6 py-3 bg-brand-text text-white rounded-full text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2 hover:bg-black"
            >
              <Plus className="w-4 h-4" /> New {activeTab === 'gifts' ? 'Gift' : 'Question'}
            </button>
          )}
        </header>

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
          <div className="bg-white border border-brand-border rounded-[2rem] overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-brand-surface border-b border-brand-border">
                  <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-brand-muted">ID</th>
                  <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-brand-muted">Question Prompt</th>
                  <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-brand-muted">Mapped Gift</th>
                  <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-brand-muted text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {questions.map(q => (
                  <tr key={q.id} className="hover:bg-brand-bg transition-colors">
                    <td className="px-8 py-5 text-[10px] font-mono text-brand-muted">{q.id}</td>
                    <td className="px-8 py-5 text-sm font-medium">{q.text}</td>
                    <td className="px-8 py-5">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-brand-accent-sage">
                        {gifts.find(g => g.id === q.giftId)?.name || q.giftId}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex justify-end gap-2 text-brand-muted">
                        <button onClick={() => setEditingQuestion(q)} className="hover:text-brand-text"><Edit3 className="w-4 h-4" /></button>
                        <button onClick={() => deleteQuestion(q.id)} className="hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
