/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  getDocs, 
  getDoc,
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
  AtSign,
  ShieldCheck,
  UserCheck,
  Shield,
  AlertTriangle,
  RefreshCw,
  BookOpen,
  Users,
  Tag,
  Grid,
  Layers,
  Menu
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
  const [activeTab, setActiveTab] = useState<'gifts' | 'questions' | 'analytics' | 'emails' | 'admins' | 'logs'>('gifts');
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Error log state
  const [errorLogs, setErrorLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  const fetchErrorLogs = async () => {
    setIsLoadingLogs(true);

    // 1. First try client Firestore SDK if configured
    if (isFirebaseConfigured) {
      try {
        const q = query(collection(db, 'error_logs'), orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);
        const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setErrorLogs(logs);
        setIsLoadingLogs(false);
        return;
      } catch (err) {
        // Fallback to API or local storage if permission denied
      }
    }

    // 2. Try server endpoint only if VITE_API_URL is specified
    const apiBase = import.meta.env.VITE_API_URL || '';
    if (apiBase) {
      try {
        const res = await fetch(`${apiBase}/api/error-logs`);
        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = await res.json();
            if (Array.isArray(data.logs)) {
              setErrorLogs(data.logs);
              setIsLoadingLogs(false);
              return;
            }
          }
        }
      } catch (apiErr) {
        // Ignore API fetch error
      }
    }

    // 3. Fallback cleanly to local storage
    const localLogs = localStorage.getItem('sanctuary_error_logs');
    if (localLogs) {
      try {
        setErrorLogs(JSON.parse(localLogs));
      } catch {
        setErrorLogs([]);
      }
    } else {
      setErrorLogs([]);
    }
    setIsLoadingLogs(false);
  };

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchErrorLogs();
    }
  }, [activeTab]);
  
  // Email settings states
  const [emailRecipients, setEmailRecipients] = useState<string[]>(['cdonyi@gmail.com', 'siona@sanctuarycov.org']);
  const [newEmailInput, setNewEmailInput] = useState('');
  const [emailServerStatus, setEmailServerStatus] = useState<EmailServerStatus | null>(null);
  const [isSavingEmails, setIsSavingEmails] = useState(false);
  const [emailSaveSuccess, setEmailSaveSuccess] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<string | null>(null);

  // Admin users configuration states
  const [adminEmails, setAdminEmails] = useState<string[]>(['cdonyi@gmail.com', 'sanctuarycovdeveloper@gmail.com', 'siona@sanctuarycov.org']);
  const [newAdminInput, setNewAdminInput] = useState('');
  const [isSavingAdmins, setIsSavingAdmins] = useState(false);
  const [adminSaveSuccess, setAdminSaveSuccess] = useState(false);

  // Form states
  const [editingGift, setEditingGift] = useState<Partial<Gift> | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<Partial<Question> | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isReordering, setIsReordering] = useState(false);

  // Mobile drawer state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Sub-view toggle for Spiritual Gifts & Service Teams
  const [giftSubTab, setGiftSubTab] = useState<'gifts' | 'matrix'>('gifts');
  const [editingGiftTeamInput, setEditingGiftTeamInput] = useState('');
  const [inlineNewTeamInput, setInlineNewTeamInput] = useState<Record<string, string>>({});
  const [newMatrixTeamName, setNewMatrixTeamName] = useState('');
  const [newMatrixTargetGiftId, setNewMatrixTargetGiftId] = useState('');
  const [editingTeamNameOld, setEditingTeamNameOld] = useState<string | null>(null);
  const [editingTeamNameNew, setEditingTeamNameNew] = useState('');

  // Load email configuration from Firestore or server
  const loadEmailConfig = async () => {
    if (isFirebaseConfigured) {
      try {
        const snap = await getDoc(doc(db, 'settings', 'email'));
        if (snap.exists() && Array.isArray(snap.data().recipients) && snap.data().recipients.length > 0) {
          const recs = snap.data().recipients;
          setEmailRecipients(recs);
          localStorage.setItem('sanctuary_recipients', JSON.stringify(recs));
          setEmailServerStatus({
            configured: true,
            provider: 'Firestore Direct Sync',
            from: 'Sanctuary Covenant Church <no-reply@app.sanctuarycov.org>',
            recipients: recs
          });
        }
      } catch (err) {}
    }

    const apiBase = import.meta.env.VITE_API_URL || '';
    if (apiBase) {
      try {
        const res = await fetch(`${apiBase}/api/email-config`);
        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = await res.json();
            if (Array.isArray(data.recipients) && data.recipients.length > 0) {
              setEmailRecipients(data.recipients);
              localStorage.setItem('sanctuary_recipients', JSON.stringify(data.recipients));
              setEmailServerStatus(data);
              return;
            }
          }
        }
      } catch (err) {}
    }

    const local = localStorage.getItem('sanctuary_recipients');
    if (local) {
      try {
        setEmailRecipients(JSON.parse(local));
      } catch {}
    }
  };

  // Load admin configuration from Firestore or server
  const loadAdminConfig = async () => {
    if (isFirebaseConfigured) {
      try {
        const snap = await getDoc(doc(db, 'settings', 'admins'));
        if (snap.exists() && Array.isArray(snap.data().admins) && snap.data().admins.length > 0) {
          const adminsList = snap.data().admins;
          setAdminEmails(adminsList);
          localStorage.setItem('sanctuary_admins', JSON.stringify(adminsList));
        }
      } catch (err) {}
    }

    const apiBase = import.meta.env.VITE_API_URL || '';
    if (apiBase) {
      try {
        const res = await fetch(`${apiBase}/api/admin-config`);
        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = await res.json();
            if (Array.isArray(data.admins) && data.admins.length > 0) {
              setAdminEmails(data.admins);
              localStorage.setItem('sanctuary_admins', JSON.stringify(data.admins));
              return;
            }
          }
        }
      } catch (err) {}
    }

    const local = localStorage.getItem('sanctuary_admins');
    if (local) {
      try {
        setAdminEmails(JSON.parse(local));
      } catch {}
    }
  };

  useEffect(() => {
    loadEmailConfig();
    loadAdminConfig();
  }, []);

  const saveAdminEmails = async (updatedList: string[]) => {
    setIsSavingAdmins(true);
    setAdminSaveSuccess(false);
    localStorage.setItem('sanctuary_admins', JSON.stringify(updatedList));

    if (isFirebaseConfigured) {
      try {
        await setDoc(doc(db, 'settings', 'admins'), {
          admins: updatedList,
          lastUpdated: new Date().toISOString()
        });
        setAdminSaveSuccess(true);
        setTimeout(() => setAdminSaveSuccess(false), 3000);
      } catch (err) {
        console.warn('Could not save admin list to Firestore:', err);
      }
    }

    const apiBase = import.meta.env.VITE_API_URL || '';
    if (apiBase) {
      try {
        const res = await fetch(`${apiBase}/api/admin-config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ admins: updatedList })
        });
        if (res.ok) {
          setAdminSaveSuccess(true);
          setTimeout(() => setAdminSaveSuccess(false), 3000);
        }
      } catch (err) {
        console.warn('Could not sync admin list to backend endpoint:', err);
      }
    }

    setIsSavingAdmins(false);
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newAdminInput.trim().toLowerCase();
    if (!clean || !clean.includes('@')) {
      alert('Please enter a valid email address.');
      return;
    }
    if (adminEmails.map(a => a.toLowerCase()).includes(clean)) {
      alert('Email address is already in the administrator list.');
      return;
    }
    const updated = [...adminEmails, clean];
    setAdminEmails(updated);
    setNewAdminInput('');
    await saveAdminEmails(updated);
  };

  const handleRemoveAdmin = async (emailToRemove: string) => {
    if (adminEmails.length <= 1) {
      alert('Cannot remove the last administrator. At least one admin email address must remain.');
      return;
    }
    const updated = adminEmails.filter(e => e.toLowerCase() !== emailToRemove.toLowerCase());
    setAdminEmails(updated);
    await saveAdminEmails(updated);
  };

  const handleSaveAdmins = async () => {
    await saveAdminEmails(adminEmails);
  };

  const saveEmailRecipients = async (updatedList: string[]) => {
    setIsSavingEmails(true);
    setEmailSaveSuccess(false);
    localStorage.setItem('sanctuary_recipients', JSON.stringify(updatedList));

    if (isFirebaseConfigured) {
      try {
        await setDoc(doc(db, 'settings', 'email'), {
          recipients: updatedList,
          lastUpdated: new Date().toISOString()
        });
        setEmailSaveSuccess(true);
        setTimeout(() => setEmailSaveSuccess(false), 3000);
      } catch (err) {
        console.warn('Could not save recipient list to Firestore:', err);
      }
    }

    const apiBase = import.meta.env.VITE_API_URL || '';
    if (apiBase) {
      try {
        const res = await fetch(`${apiBase}/api/email-config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipients: updatedList })
        });
        if (res.ok) {
          setEmailSaveSuccess(true);
          setTimeout(() => setEmailSaveSuccess(false), 3000);
        }
      } catch (err) {
        console.warn('Could not sync recipient list to backend endpoint:', err);
      }
    }

    setIsSavingEmails(false);
  };

  const handleAddRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newEmailInput.trim().toLowerCase();
    if (!clean || !clean.includes('@')) {
      alert('Please enter a valid email address.');
      return;
    }
    if (emailRecipients.map(e => e.toLowerCase()).includes(clean)) {
      alert('Email address is already in the recipient list.');
      return;
    }
    const updated = [...emailRecipients, clean];
    setEmailRecipients(updated);
    setNewEmailInput('');
    await saveEmailRecipients(updated);
  };

  const handleRemoveRecipient = async (emailToRemove: string) => {
    const updated = emailRecipients.filter(e => e.toLowerCase() !== emailToRemove.toLowerCase());
    setEmailRecipients(updated);
    await saveEmailRecipients(updated);
  };

  const handleSaveRecipients = async () => {
    await saveEmailRecipients(emailRecipients);
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = testEmailAddress.trim() || emailRecipients[0] || 'cdonyi@gmail.com';
    setIsTestingEmail(true);
    setTestEmailResult(null);
    const apiBase = import.meta.env.VITE_API_URL || '';
    try {
      const res = await fetch(`${apiBase}/api/test-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetEmail: target })
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (res.ok) {
          setTestEmailResult(`Success (${data.mode}): ${data.message}`);
        } else {
          setTestEmailResult(`Error: ${data.error || 'Failed to send test email.'}`);
        }
      } else {
        setTestEmailResult(`404 Not Found: Netlify is running in static frontend mode. To enable backend email sending, deploy server.ts (e.g. to Cloud Run) and set VITE_API_URL or a Netlify proxy rule.`);
      }
    } catch (err: any) {
      setTestEmailResult(`Error: ${err.message || 'Connection failed'}`);
    } finally {
      setIsTestingEmail(false);
    }
  };

  const handleTriggerTestLog = async () => {
    if (isFirebaseConfigured) {
      try {
        const testId = 'test-log-' + Date.now();
        await setDoc(doc(db, 'error_logs', testId), {
          context: 'Admin Dashboard Test Verification',
          message: 'Test log created from Admin Dashboard to initialize and verify the error_logs collection in Firestore.',
          details: JSON.stringify({ triggeredBy: auth?.currentUser?.email || 'Admin User', mode: 'Direct Firestore Client' }),
          timestamp: new Date().toISOString()
        });
        alert('Successfully written test entry to Firestore error_logs collection!');
        fetchErrorLogs();
        return;
      } catch (err: any) {
        console.warn('Client Firestore write error:', err);
      }
    }

    const apiBase = import.meta.env.VITE_API_URL || '';
    if (apiBase) {
      try {
        const res = await fetch(`${apiBase}/api/trigger-test-error-log`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context: 'Admin Dashboard Test Verification',
            triggeredBy: auth?.currentUser?.email || 'Admin User',
            message: 'Test log created from Admin Dashboard to initialize and verify the error_logs collection in Firestore.'
          })
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          alert('Successfully written test entry to Firestore error_logs collection!');
          fetchErrorLogs();
          return;
        }
      } catch (err: any) {
        alert(`Error triggering test log: ${err.message}`);
        return;
      }
    }

    alert('Log saved to local browser diagnostic cache.');
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
    
    // Log error to backend error_logs pipeline
    const apiBase = import.meta.env.VITE_API_URL || '';
    fetch(`${apiBase}/api/log-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: `Firestore Operation (${operationType} on ${path || 'unknown'})`,
        message: errMsg,
        details: errInfo
      })
    }).catch(() => {});

    // Save locally
    try {
      const existing = JSON.parse(localStorage.getItem('sanctuary_error_logs') || '[]');
      existing.unshift({
        id: 'local-' + Date.now(),
        context: `Firestore Error (${operationType} on ${path || 'unknown'})`,
        message: errMsg,
        details: JSON.stringify(errInfo),
        timestamp: new Date().toISOString()
      });
      localStorage.setItem('sanctuary_error_logs', JSON.stringify(existing.slice(0, 50)));
    } catch {}

    let userFriendly = errMsg;
    if (errMsg.includes('permission-denied') || errMsg.toLowerCase().includes('permission')) {
      userFriendly = 'Permission Denied: Your custom Firestore security rules do not allow this operation. Please make sure your authenticated user email is listed as an authorized administrator.';
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

  const allUniqueServiceTeams = useMemo(() => {
    const set = new Set<string>();
    gifts.forEach(g => {
      g.serviceTeams?.forEach(t => {
        if (t && t.trim()) set.add(t.trim());
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [gifts]);

  const addServiceTeamToGift = async (giftId: string, teamName: string) => {
    const cleanTeam = teamName.trim();
    if (!cleanTeam) return;
    const targetGift = gifts.find(g => g.id === giftId);
    if (!targetGift) return;
    const currentTeams = targetGift.serviceTeams || [];
    if (currentTeams.includes(cleanTeam)) return;
    const updated = { ...targetGift, serviceTeams: [...currentTeams, cleanTeam] };
    await saveGift(updated);
  };

  const removeServiceTeamFromGift = async (giftId: string, teamName: string) => {
    const targetGift = gifts.find(g => g.id === giftId);
    if (!targetGift) return;
    const updated = {
      ...targetGift,
      serviceTeams: (targetGift.serviceTeams || []).filter(t => t !== teamName)
    };
    await saveGift(updated);
  };

  const renameServiceTeamGlobally = async (oldName: string, newName: string) => {
    const cleanNew = newName.trim();
    if (!cleanNew || cleanNew === oldName) {
      setEditingTeamNameOld(null);
      return;
    }
    const affectedGifts = gifts.filter(g => g.serviceTeams?.includes(oldName));
    for (const g of affectedGifts) {
      const newTeams = (g.serviceTeams || []).map(t => t === oldName ? cleanNew : t);
      const uniqueTeams = Array.from(new Set(newTeams));
      await saveGift({ ...g, serviceTeams: uniqueTeams });
    }
    setEditingTeamNameOld(null);
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
    <div className="flex h-screen bg-brand-bg overflow-hidden relative">
      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-brand-text/50 z-40 md:hidden backdrop-blur-xs transition-opacity"
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-white flex flex-col border-r border-brand-border transform transition-transform duration-300 ease-in-out md:static md:w-64 md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-brand-border flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.2em]">Curator Panel</h2>
            <p className="text-[10px] text-brand-muted uppercase font-medium mt-1">Management Console</p>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden p-1.5 text-brand-muted hover:text-brand-text rounded-lg hover:bg-brand-surface"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button 
            onClick={() => { setActiveTab('gifts'); setMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all ${activeTab === 'gifts' ? 'bg-brand-surface text-brand-text' : 'text-brand-muted hover:bg-brand-bg'}`}
          >
            <Database className="w-4 h-4" /> Spiritual Gifts
          </button>
          <button 
            onClick={() => { setActiveTab('questions'); setMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all ${activeTab === 'questions' ? 'bg-brand-surface text-brand-text' : 'text-brand-muted hover:bg-brand-bg'}`}
          >
            <Settings className="w-4 h-4" /> Survey Questions
          </button>
          <button 
            onClick={() => { setActiveTab('analytics'); setMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all ${activeTab === 'analytics' ? 'bg-brand-surface text-brand-text' : 'text-brand-muted hover:bg-brand-bg'}`}
          >
            <BarChart3 className="w-4 h-4" /> Analytics
          </button>
          <button 
            onClick={() => { setActiveTab('emails'); setMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all ${activeTab === 'emails' ? 'bg-brand-surface text-brand-text font-bold text-brand-red' : 'text-brand-muted hover:bg-brand-bg'}`}
          >
            <Mail className="w-4 h-4" /> Email Notifications
          </button>
          <button 
            onClick={() => { setActiveTab('logs'); setMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all ${activeTab === 'logs' ? 'bg-brand-surface text-brand-text font-bold text-amber-700' : 'text-brand-muted hover:bg-brand-bg'}`}
          >
            <AlertTriangle className="w-4 h-4" /> System Error Logs
          </button>
          <button 
            onClick={() => { setActiveTab('admins'); setMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all ${activeTab === 'admins' ? 'bg-brand-surface text-brand-text font-bold text-brand-accent-gold' : 'text-brand-muted hover:bg-brand-bg'}`}
          >
            <ShieldCheck className="w-4 h-4" /> Admin Access
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
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-12">
        {/* Mobile Top Bar */}
        <div className="md:hidden flex items-center justify-between p-3.5 mb-6 bg-white border border-brand-border rounded-2xl shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 text-brand-text hover:bg-brand-surface rounded-xl border border-brand-border bg-brand-bg transition-colors shrink-0"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-xs font-bold uppercase tracking-wider text-brand-text truncate">
              {activeTab === 'gifts' && 'Spiritual Gifts'}
              {activeTab === 'questions' && 'Survey Questions'}
              {activeTab === 'analytics' && 'Analytics'}
              {activeTab === 'emails' && 'Email Config'}
              {activeTab === 'logs' && 'Error Logs'}
              {activeTab === 'admins' && 'Admin Access'}
            </span>
          </div>
          <button
            onClick={onExit}
            className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-muted hover:text-brand-text bg-brand-surface rounded-xl border border-brand-border shrink-0"
          >
            Exit
          </button>
        </div>

        <header className="mb-6 sm:mb-12 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <span className="text-[11px] font-bold text-brand-accent-gold uppercase tracking-[0.3em] mb-1 sm:mb-2 block">System Configuration</span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-brand-text">
              {activeTab === 'gifts' && 'Spiritual Gifts Library'}
              {activeTab === 'questions' && 'Survey Question Pool'}
              {activeTab === 'analytics' && 'Operational Insights'}
              {activeTab === 'emails' && 'Email Notifications'}
              {activeTab === 'logs' && 'System Error Logs'}
              {activeTab === 'admins' && 'Admin Access Control'}
            </h1>
          </div>
          {activeTab === 'questions' && (
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <button 
                onClick={renumberQuestionsSequentially}
                disabled={isReordering || sortedQuestions.length === 0}
                title="Normalize order numbers sequentially from 1 to N"
                className="flex-1 sm:flex-none px-4 sm:px-5 py-2.5 sm:py-3 bg-white border border-brand-border text-brand-text rounded-full text-[10px] font-bold uppercase tracking-[0.18em] flex items-center justify-center gap-2 hover:bg-brand-surface disabled:opacity-50 transition-all"
              >
                <ListOrdered className="w-4 h-4 text-brand-accent-sage" />
                Renumber 1..{sortedQuestions.length}
              </button>
              <button 
                onClick={() => {
                  setEditingQuestion({ text: '', giftId: gifts[0]?.id || '', order: sortedQuestions.length + 1 });
                }}
                className="flex-1 sm:flex-none px-5 sm:px-6 py-2.5 sm:py-3 bg-brand-text text-white rounded-full text-[10px] font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-black transition-all"
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
              className="w-full sm:w-auto px-6 py-2.5 sm:py-3 bg-brand-text text-white rounded-full text-[10px] font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-black transition-all"
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
                <h3 className="font-semibold text-base mb-1 text-brand-text">New Database Detected</h3>
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
          <div className="space-y-6 sm:space-y-8">
            {/* View Mode Sub-Header Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white border border-brand-border p-3 rounded-2xl shadow-xs">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => setGiftSubTab('gifts')}
                  className={`px-4 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                    giftSubTab === 'gifts'
                      ? 'bg-brand-text text-white shadow-xs'
                      : 'text-brand-muted hover:bg-brand-surface'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  Spiritual Gifts Library ({gifts.length})
                </button>
                <button
                  onClick={() => setGiftSubTab('matrix')}
                  className={`px-4 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                    giftSubTab === 'matrix'
                      ? 'bg-brand-text text-white shadow-xs'
                      : 'text-brand-muted hover:bg-brand-surface'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Service Teams Matrix ({allUniqueServiceTeams.length} Teams)
                </button>
              </div>
              <div className="text-[10px] text-brand-muted font-medium px-3 py-1 bg-brand-surface border border-brand-border rounded-lg self-end sm:self-auto">
                Client-Side Firestore Sync Active
              </div>
            </div>

            {/* Sub-tab 1: Spiritual Gifts Library View */}
            {giftSubTab === 'gifts' && (
              <div className="grid gap-4 sm:gap-6">
                {gifts.map(gift => (
                  <div key={gift.id} className="bg-white border border-brand-border p-5 sm:p-8 rounded-2xl sm:rounded-[2rem] flex flex-col md:flex-row justify-between items-start gap-4 sm:gap-6 group hover:border-brand-accent-sage transition-all shadow-xs">
                    <div className="flex-1 max-w-3xl w-full">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                        <h3 className="text-base sm:text-lg font-bold text-brand-text">{gift.name}</h3>
                        <span className="px-2 py-0.5 bg-brand-surface text-[9px] sm:text-[10px] uppercase font-bold tracking-tighter text-brand-muted border border-brand-border rounded-md font-mono">
                          ID: {gift.id}
                        </span>
                        {gift.scripture && (
                          <span className="px-2.5 py-0.5 bg-brand-accent-gold/10 text-brand-accent-gold text-[9px] sm:text-[10px] font-semibold rounded-full border border-brand-accent-gold/20 flex items-center gap-1">
                            <BookOpen className="w-3 h-3" />
                            {gift.scripture}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-brand-muted leading-relaxed mb-4 sm:mb-5">{gift.description}</p>
                      
                      {/* Service Teams Tag Manager */}
                      <div className="pt-4 border-t border-brand-border/60">
                        <div className="flex items-center gap-2 mb-3">
                          <Users className="w-3.5 h-3.5 text-brand-accent-gold" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-text">
                            Mapped Service Teams / Ministries ({gift.serviceTeams?.length || 0})
                          </span>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-2">
                          {gift.serviceTeams?.map(team => (
                            <span 
                              key={team} 
                              className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-brand-accent-gold bg-brand-bg px-3 py-1.5 rounded-lg border border-brand-accent-gold/20 group/tag hover:border-brand-accent-gold transition-all"
                            >
                              <span>{team}</span>
                              <button
                                onClick={() => removeServiceTeamFromGift(gift.id, team)}
                                title={`Remove ${team} from ${gift.name}`}
                                className="text-brand-muted hover:text-red-600 transition-colors p-0.5 rounded"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                          
                          {/* Inline Quick Add Team Input */}
                          <div className="inline-flex items-center gap-1 w-full sm:w-auto">
                            <input
                              type="text"
                              placeholder="+ Add service team..."
                              value={inlineNewTeamInput[gift.id] || ''}
                              onChange={e => setInlineNewTeamInput({ ...inlineNewTeamInput, [gift.id]: e.target.value })}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  if (inlineNewTeamInput[gift.id]) {
                                    addServiceTeamToGift(gift.id, inlineNewTeamInput[gift.id]);
                                    setInlineNewTeamInput({ ...inlineNewTeamInput, [gift.id]: '' });
                                  }
                                }
                              }}
                              className="px-3 py-1 rounded-lg border border-dashed border-brand-border text-[10px] bg-white outline-none focus:border-brand-accent-sage focus:border-solid w-full sm:w-40 font-medium"
                            />
                            {inlineNewTeamInput[gift.id]?.trim() && (
                              <button
                                onClick={() => {
                                  addServiceTeamToGift(gift.id, inlineNewTeamInput[gift.id]);
                                  setInlineNewTeamInput({ ...inlineNewTeamInput, [gift.id]: '' });
                                }}
                                className="px-2.5 py-1 bg-brand-accent-sage text-white text-[9px] font-bold rounded-lg hover:bg-opacity-90 transition-all uppercase tracking-wider shrink-0"
                              >
                                Add
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 shrink-0 w-full md:w-auto justify-end border-t md:border-t-0 border-brand-border/60 pt-3 md:pt-0">
                      <button 
                        onClick={() => {
                          setEditingGift(gift);
                          setEditingGiftTeamInput('');
                        }}
                        className="px-4 py-2 text-xs font-bold text-brand-text bg-brand-surface border border-brand-border rounded-xl hover:bg-brand-bg transition-all flex items-center gap-2"
                      >
                        <Edit3 className="w-4 h-4" /> Edit
                      </button>
                      <button 
                        onClick={() => deleteGift(gift.id)}
                        className="p-2 text-brand-muted hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                        title="Delete Gift"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Sub-tab 2: Service Teams & Ministry Matrix View */}
            {giftSubTab === 'matrix' && (
              <div className="space-y-6 sm:space-y-8">
                {/* Create & Map New Service Team Card */}
                <div className="bg-white border border-brand-border p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] shadow-xs">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-brand-text mb-1 flex items-center gap-2">
                    <Plus className="w-4 h-4 text-brand-accent-gold" />
                    Create New Service Team / Ministry
                  </h3>
                  <p className="text-xs text-brand-muted mb-4">
                    Add a new church service team (e.g. <em>Media & Tech</em>, <em>Youth Ministry</em>) and map it to a spiritual gift.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      placeholder="Service Team Name (e.g. Sound & AV Team)"
                      value={newMatrixTeamName}
                      onChange={e => setNewMatrixTeamName(e.target.value)}
                      className="px-4 py-2.5 border border-brand-border rounded-xl text-xs font-medium outline-none focus:border-brand-text flex-1"
                    />
                    <select
                      value={newMatrixTargetGiftId}
                      onChange={e => setNewMatrixTargetGiftId(e.target.value)}
                      className="px-4 py-2.5 border border-brand-border rounded-xl text-xs bg-white outline-none focus:border-brand-text font-medium"
                    >
                      <option value="">-- Select Mapped Spiritual Gift --</option>
                      {gifts.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={async () => {
                        if (!newMatrixTeamName.trim() || !newMatrixTargetGiftId) return;
                        await addServiceTeamToGift(newMatrixTargetGiftId, newMatrixTeamName);
                        setNewMatrixTeamName('');
                        setNewMatrixTargetGiftId('');
                      }}
                      disabled={!newMatrixTeamName.trim() || !newMatrixTargetGiftId}
                      className="px-6 py-2.5 bg-brand-text text-white text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-black transition-all disabled:opacity-40"
                    >
                      Add & Link Team
                    </button>
                  </div>
                </div>

                {/* Service Teams Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  {allUniqueServiceTeams.map(teamName => {
                    const mappedGifts = gifts.filter(g => g.serviceTeams?.includes(teamName));
                    const unmappedGifts = gifts.filter(g => !g.serviceTeams?.includes(teamName));
                    const isRenaming = editingTeamNameOld === teamName;

                    return (
                      <div key={teamName} className="bg-white border border-brand-border rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
                        <div>
                          <div className="flex items-center justify-between pb-3 border-b border-brand-border/60">
                            {isRenaming ? (
                              <div className="flex flex-wrap items-center gap-2 flex-1">
                                <input
                                  type="text"
                                  value={editingTeamNameNew}
                                  onChange={e => setEditingTeamNameNew(e.target.value)}
                                  className="px-3 py-1 border border-brand-text text-xs font-bold rounded-lg w-full outline-none"
                                />
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => renameServiceTeamGlobally(teamName, editingTeamNameNew)}
                                    className="px-3 py-1 bg-brand-accent-sage text-white text-[9px] font-bold rounded-lg uppercase"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingTeamNameOld(null)}
                                    className="px-2 py-1 text-xs text-brand-muted"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-2">
                                  <Users className="w-4 h-4 text-brand-accent-gold shrink-0" />
                                  <h4 className="font-bold text-sm text-brand-text">{teamName}</h4>
                                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-brand-surface rounded border border-brand-border text-brand-muted">
                                    {mappedGifts.length} {mappedGifts.length === 1 ? 'gift' : 'gifts'}
                                  </span>
                                </div>
                                <button
                                  onClick={() => {
                                    setEditingTeamNameOld(teamName);
                                    setEditingTeamNameNew(teamName);
                                  }}
                                  className="text-brand-muted hover:text-brand-text p-1 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
                                >
                                  <Edit3 className="w-3.5 h-3.5" /> Rename
                                </button>
                              </>
                            )}
                          </div>

                          <div className="mt-4">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-muted block mb-2">
                              Connected Spiritual Gifts
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {mappedGifts.map(g => (
                                <span
                                  key={g.id}
                                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-accent-sage/10 text-brand-accent-sage rounded-full border border-brand-accent-sage/20 text-[10px] font-bold uppercase tracking-wider"
                                >
                                  <span>{g.name}</span>
                                  <button
                                    onClick={() => removeServiceTeamFromGift(g.id, teamName)}
                                    title={`Unlink ${g.name} from ${teamName}`}
                                    className="hover:text-red-600 transition-colors"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Quick Attach Dropdown */}
                        {unmappedGifts.length > 0 && (
                          <div className="pt-3 border-t border-brand-border/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
                            <span className="text-[10px] font-semibold text-brand-muted whitespace-nowrap">+ Link Gift:</span>
                            <select
                              defaultValue=""
                              onChange={async e => {
                                if (e.target.value) {
                                  await addServiceTeamToGift(e.target.value, teamName);
                                  e.target.value = '';
                                }
                              }}
                              className="px-3 py-1.5 border border-brand-border rounded-xl text-[10px] font-medium bg-brand-surface outline-none focus:border-brand-text w-full sm:flex-1"
                            >
                              <option value="" disabled>Select gift to map...</option>
                              {unmappedGifts.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'questions' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-4 py-3 bg-brand-surface border border-brand-border rounded-xl text-xs text-brand-muted">
              <span>Use the <strong className="text-brand-text">Up (↑)</strong> and <strong className="text-brand-text">Down (↓)</strong> buttons to easily reorder questions. Survey takers will encounter questions in this exact order.</span>
              <span className="font-mono text-[10px] font-bold text-brand-accent-sage uppercase shrink-0">{sortedQuestions.length} Questions Configured</span>
            </div>
            <div className="bg-white border border-brand-border rounded-2xl sm:rounded-[2rem] overflow-x-auto shadow-sm">
              <table className="w-full text-left min-w-[640px]">
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
            <h3 className="text-xl font-bold text-brand-text mb-4">Analytics Engine Active</h3>
            <p className="text-sm text-brand-muted max-w-sm mx-auto leading-relaxed">
              Real-time conversion data and gift distribution patterns are being collected. Full visualization suite coming to next iteration.
            </p>
          </div>
        )}

        {activeTab === 'emails' && (
          <div className="space-y-6 sm:space-y-10 max-w-5xl">
            {/* Status Card */}
            <div className="bg-white border border-brand-border rounded-2xl sm:rounded-[2.5rem] p-5 sm:p-8 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 pb-6 border-b border-brand-border/60">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-brand-red inline-block animate-pulse"></span>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-red">Automated Delivery System</span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-brand-text">Survey Results Routing</h3>
                  <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                    Whenever a participant completes the Soul Discovery survey, a full report (Top 5 Gifts & Top 5 Ministry Matches) is emailed to the participant and all notification addresses below.
                  </p>
                </div>
                <div className="p-4 bg-brand-surface rounded-2xl border border-brand-border shrink-0 w-full sm:w-auto min-w-0 sm:min-w-[200px]">
                  <div className="text-[9px] uppercase tracking-wider font-bold text-brand-muted mb-1">Delivery Provider</div>
                  <div className="text-sm font-bold text-brand-text truncate">{emailServerStatus?.provider || 'Demo / Simulated Mode'}</div>
                  <div className="text-[10px] text-brand-accent-sage mt-1 font-medium truncate">From: {emailServerStatus?.from || 'Sanctuary Covenant Church'}</div>
                </div>
              </div>

              {/* Recipient Management */}
              <div className="pt-6 sm:pt-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-brand-text">Configured Recipient Email Addresses</h4>
                    <p className="text-xs text-brand-muted mt-0.5">These staff / ministry leader addresses receive a copy of every completed survey.</p>
                  </div>
                  <button
                    onClick={handleSaveRecipients}
                    disabled={isSavingEmails}
                    className="w-full sm:w-auto px-6 py-3 bg-brand-red text-white text-[10px] font-bold uppercase tracking-[0.2em] rounded-full hover:bg-brand-red-hover transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
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
                <form onSubmit={handleAddRecipient} className="flex flex-col sm:flex-row gap-3 mb-6">
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
                    className="px-6 py-3 bg-brand-text text-white text-[10px] font-bold uppercase tracking-[0.18em] rounded-xl hover:bg-black transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Add Email
                  </button>
                </form>

                {/* List of Recipients */}
                <div className="space-y-3">
                  {emailRecipients.map(email => (
                    <div key={email} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-brand-surface/40 border border-brand-border/60 rounded-2xl group hover:bg-white hover:border-brand-border transition-all">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-brand-red/10 text-brand-red flex items-center justify-center text-xs font-bold shrink-0">
                          <Mail className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-xs sm:text-sm font-semibold text-brand-text font-mono block truncate">{email}</span>
                          <span className="block text-[9px] uppercase tracking-wider text-brand-muted font-bold">Notification Recipient</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveRecipient(email)}
                        className="p-2 text-brand-muted hover:text-red-600 hover:bg-red-50 rounded-xl transition-all self-end sm:self-auto"
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
            <div className="bg-white border border-brand-border rounded-2xl sm:rounded-[2.5rem] p-5 sm:p-8 shadow-xs">
              <h3 className="text-base sm:text-lg font-bold text-brand-text mb-2">Test Email Generator</h3>
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
                <div className="mt-4 p-4 bg-brand-surface rounded-xl border border-brand-border font-mono text-xs text-brand-text leading-relaxed overflow-x-auto">
                  {testEmailResult}
                </div>
              )}
            </div>

            {/* Setup & Integration Instructions */}
            <div className="bg-brand-surface rounded-2xl sm:rounded-[2.5rem] p-5 sm:p-8 border border-brand-border space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-brand-accent-gold">Sending Real Emails Automatically</h4>
              <p className="text-xs text-brand-muted leading-relaxed">
                This applet includes an Express backend server (<code>server.ts</code>) with Nodemailer route <code>/api/send-results</code>.
              </p>

              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 leading-relaxed space-y-2">
                <span className="font-bold flex items-center gap-1.5 text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                  Deploying on Static Hosts like Netlify:
                </span>
                <p>
                  Netlify serves the frontend as a static site. To route <code>/api/*</code> requests to an active backend Express server, set your backend server URL in the <code>VITE_API_URL</code> environment variable on Netlify (e.g. <code>VITE_API_URL=https://your-backend.run.app</code>) or add a redirect proxy rule in your Netlify configuration (<code>public/_redirects</code>):
                </p>
                <pre className="text-[10px] font-mono bg-white p-3 rounded-xl border border-amber-200 text-amber-950 overflow-x-auto">
{`/api/*   https://your-backend-express-service.run.app/api/:splat   200!`}
                </pre>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2">
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

        {/* ADMIN ACCESS MANAGEMENT TAB */}
        {activeTab === 'admins' && (
          <div className="space-y-6 sm:space-y-8 max-w-4xl">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="p-2 bg-brand-accent-gold/10 text-brand-accent-gold rounded-xl">
                  <ShieldCheck className="w-5 h-5" />
                </span>
                <h3 className="text-lg sm:text-xl font-bold text-brand-text">Admin Users & Access Control</h3>
              </div>
              <p className="text-xs text-brand-muted leading-relaxed font-light">
                Configure which Google accounts are authorized to access this Curator Admin Dashboard. Anyone attempting to log in with Google Authentication whose email address is not in this list will be blocked.
              </p>
            </div>

            {/* Admin Emails List & Form Card */}
            <div className="bg-white border border-brand-border rounded-2xl sm:rounded-[2.5rem] p-5 sm:p-8 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-brand-border">
                <div>
                  <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-brand-text">Authorized Administrator Email Addresses</h4>
                  <p className="text-xs text-brand-muted mt-0.5">Users signing in with Google accounts matching these email addresses gain access to this dashboard.</p>
                </div>
                <button
                  onClick={handleSaveAdmins}
                  disabled={isSavingAdmins}
                  className="w-full sm:w-auto px-6 py-3 bg-brand-accent-gold text-brand-text font-bold text-[10px] uppercase tracking-[0.2em] rounded-full hover:bg-opacity-90 transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {adminSaveSuccess ? (
                    <>
                      <Check className="w-4 h-4" /> Admin List Saved!
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" /> Save Admin List
                    </>
                  )}
                </button>
              </div>

              {/* Add New Admin Form */}
              <form onSubmit={handleAddAdmin} className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                  <AtSign className="w-4 h-4 text-brand-muted absolute left-4 top-3.5" />
                  <input
                    type="email"
                    value={newAdminInput}
                    onChange={e => setNewAdminInput(e.target.value)}
                    placeholder="Add new admin email (e.g. pastor@sanctuarycov.org)"
                    className="w-full pl-11 pr-4 py-3 bg-brand-surface/50 border border-brand-border rounded-xl text-xs outline-none focus:border-brand-text font-mono"
                  />
                </div>
                <button
                  type="submit"
                  className="px-6 py-3 bg-brand-text text-white text-[10px] font-bold uppercase tracking-[0.18em] rounded-xl hover:bg-black transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Add Admin
                </button>
              </form>

              {/* List of Admins */}
              <div className="space-y-3">
                {adminEmails.map(adminEmail => {
                  const isCurrentUser = auth?.currentUser?.email?.toLowerCase() === adminEmail.toLowerCase();
                  return (
                    <div key={adminEmail} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-brand-surface/40 border border-brand-border/60 rounded-2xl group hover:bg-white hover:border-brand-border transition-all">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-brand-accent-gold/10 text-brand-accent-gold flex items-center justify-center text-xs font-bold shrink-0">
                          <UserCheck className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs sm:text-sm font-semibold text-brand-text font-mono truncate">{adminEmail}</span>
                            {isCurrentUser && (
                              <span className="px-2 py-0.5 bg-brand-accent-sage/20 text-brand-accent-sage text-[9px] font-bold uppercase tracking-wider rounded-full border border-brand-accent-sage/30">
                                Current Session
                              </span>
                            )}
                          </div>
                          <span className="block text-[9px] uppercase tracking-wider text-brand-muted font-bold">Curator Administrator</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveAdmin(adminEmail)}
                        className="p-2 text-brand-muted hover:text-red-600 hover:bg-red-50 rounded-xl transition-all self-end sm:self-auto"
                        title="Remove Administrator"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
                {adminEmails.length === 0 && (
                  <div className="p-8 text-center bg-brand-surface/20 rounded-2xl border border-dashed border-brand-border text-xs text-brand-muted">
                    No administrator email addresses configured. Click "Add Admin" above to add access.
                  </div>
                )}
              </div>
            </div>

            {/* Explanation Card */}
            <div className="bg-brand-surface rounded-2xl sm:rounded-[2.5rem] p-5 sm:p-8 border border-brand-border">
              <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-brand-accent-gold mb-3">How Admin Access Authorization Works</h4>
              <div className="space-y-3 text-xs text-brand-muted leading-relaxed">
                <p>
                  • <strong>Google Authentication Check:</strong> When a user clicks "Curator Admin Login", they sign in with their Google account.
                </p>
                <p>
                  • <strong>Dynamic Access Control:</strong> The app checks their authenticated Google email against this exact configured list. If matched, access is granted to manage spiritual gifts, questions, email settings, and administrators.
                </p>
                <p>
                  • <strong>Persistence:</strong> Changes made here are saved to the server configuration (<code>data/admins.json</code>) so updated administrator privileges persist across sessions and deployments.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* SYSTEM ERROR LOGS TAB */}
        {activeTab === 'logs' && (
          <div className="space-y-6 sm:space-y-8 max-w-4xl">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h3 className="text-lg sm:text-xl font-bold text-brand-text">System Error Logs</h3>
              </div>
              <p className="text-xs text-brand-muted leading-relaxed">
                Centralized, sanitized error logging. Internal service exceptions and API failures are stripped of sensitive key details before sending generic messages to users, while full diagnostic context is recorded directly in Firestore's <code>error_logs</code> collection.
              </p>
            </div>

            {/* Error Log Controls & Trigger Card */}
            <div className="bg-brand-surface rounded-2xl sm:rounded-[2.5rem] p-5 sm:p-8 border border-brand-border space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-brand-border">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-brand-text">Firestore Diagnostics Pipeline</h4>
                  <p className="text-[11px] text-brand-muted mt-1">
                    Click below to generate a test error log entry to verify Firestore collection creation and rules.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <button
                    onClick={fetchErrorLogs}
                    disabled={isLoadingLogs}
                    className="flex-1 sm:flex-none px-4 py-2.5 bg-white border border-brand-border text-brand-text text-[10px] font-bold uppercase tracking-wider rounded-xl hover:bg-brand-surface transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                    Refresh Logs
                  </button>
                  <button
                    onClick={handleTriggerTestLog}
                    className="flex-1 sm:flex-none px-5 py-2.5 bg-brand-text text-white text-[10px] font-bold uppercase tracking-wider rounded-xl hover:bg-black transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Database className="w-3.5 h-3.5 text-brand-accent-gold" />
                    Write Test Log
                  </button>
                </div>
              </div>

              {/* Log List View */}
              <div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
                  <h5 className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-muted">Recorded Error Events ({errorLogs.length})</h5>
                  {isFirebaseConfigured && (
                    <span className="text-[10px] font-mono text-brand-accent-sage font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-brand-accent-sage animate-pulse"></span>
                      Firestore Collection: error_logs
                    </span>
                  )}
                </div>

                {isLoadingLogs ? (
                  <div className="p-8 text-center bg-white rounded-2xl border border-brand-border">
                    <p className="text-xs text-brand-muted animate-pulse font-mono">Loading error logs from Firestore...</p>
                  </div>
                ) : errorLogs.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-2xl border border-brand-border space-y-3">
                    <AlertTriangle className="w-8 h-8 text-brand-muted mx-auto opacity-50" />
                    <p className="text-xs font-medium text-brand-text">No error logs recorded yet.</p>
                    <p className="text-[11px] text-brand-muted max-w-md mx-auto">
                      API or server execution errors will automatically appear here. You can click <strong>"Write Test Log"</strong> above to dispatch a test entry now.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {errorLogs.map((log, idx) => (
                      <div key={log.id || idx} className="p-4 sm:p-5 bg-white rounded-2xl border border-brand-border font-mono text-xs space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-brand-border/60">
                          <span className="font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200/60 text-[10px] self-start sm:self-auto">
                            {log.context || 'System Error'}
                          </span>
                          <span className="text-[10px] text-brand-muted">
                            {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Just now'}
                          </span>
                        </div>
                        <p className="text-brand-text font-sans text-xs font-semibold pt-1">
                          {log.message || 'No message string'}
                        </p>
                        {log.details && log.details !== '{}' && (
                          <pre className="text-[10px] text-brand-muted bg-brand-surface p-3 rounded-xl overflow-x-auto whitespace-pre-wrap leading-relaxed mt-2 border border-brand-border/40">
                            {log.details}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Architecture Explanatory Card */}
            <div className="bg-brand-surface rounded-2xl sm:rounded-[2.5rem] p-5 sm:p-8 border border-brand-border space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-brand-accent-gold">Security & Error Handling Architecture</h4>
              <div className="text-xs text-brand-muted leading-relaxed space-y-2">
                <p>
                  • <strong>Public Response Sanitization:</strong> All Express API endpoints return generic client-facing messages (e.g. <em>"Failed to send survey results email. Please try again later or contact support."</em>) to prevent leaking endpoints, stack traces, hostnames, or API keys.
                </p>
                <p>
                  • <strong>Firestore Append-Only Log Pipeline:</strong> Raw exceptions, provider status codes, and environment details are logged asynchronously to the <code>error_logs</code> collection in Firestore.
                </p>
                <p>
                  • <strong>Access Control Rules:</strong> Security rules in <code>firestore.rules</code> restrict reading and deleting error logs exclusively to authenticated Curator Administrators.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Gift Modal */}
      {editingGift && (
        <div className="fixed inset-0 z-[200] bg-brand-text/40 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-brand-bg rounded-2xl sm:rounded-[2.5rem] p-5 sm:p-10 max-w-xl w-full border border-brand-border shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg sm:text-xl font-bold tracking-tight text-brand-text mb-6 sm:mb-8">{editingGift.name ? 'Edit Gift' : 'Define New Gift'}</h3>
            <div className="space-y-4 sm:space-y-6">
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
                <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-muted mb-2">Scripture Reference</label>
                <input 
                  value={editingGift.scripture || ''} 
                  onChange={e => setEditingGift({...editingGift, scripture: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-brand-border focus:border-brand-text outline-none text-sm"
                  placeholder="e.g. 1 Corinthians 12:28"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-muted mb-2">Description</label>
                <textarea 
                  rows={3}
                  value={editingGift.description || ''} 
                  onChange={e => setEditingGift({...editingGift, description: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-brand-border focus:border-brand-text outline-none text-sm resize-none"
                  placeholder="The spiritual significance of this gift"
                />
              </div>

              {/* Service Teams & Ministry Mapping Tag Editor */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-muted mb-2">
                  Mapped Service Teams / Ministries ({editingGift.serviceTeams?.length || 0})
                </label>
                
                {/* Active Tags list */}
                <div className="flex flex-wrap gap-2 mb-3 min-h-[40px] p-3 bg-white border border-brand-border rounded-xl">
                  {(!editingGift.serviceTeams || editingGift.serviceTeams.length === 0) ? (
                    <span className="text-xs text-brand-muted italic">No service teams assigned yet</span>
                  ) : (
                    editingGift.serviceTeams.map(team => (
                      <span 
                        key={team} 
                        className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-brand-accent-gold bg-brand-bg px-3 py-1.5 rounded-lg border border-brand-accent-gold/20"
                      >
                        <span>{team}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = (editingGift.serviceTeams || []).filter(t => t !== team);
                            setEditingGift({ ...editingGift, serviceTeams: updated });
                          }}
                          className="text-brand-muted hover:text-red-600 transition-colors p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>

                {/* Add New Team Input */}
                <div className="flex flex-col sm:flex-row gap-2 mb-3">
                  <input
                    type="text"
                    placeholder="Type team name (e.g. Event Setup)"
                    value={editingGiftTeamInput}
                    onChange={e => setEditingGiftTeamInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const clean = editingGiftTeamInput.trim();
                        if (clean) {
                          const current = editingGift.serviceTeams || [];
                          if (!current.includes(clean)) {
                            setEditingGift({ ...editingGift, serviceTeams: [...current, clean] });
                          }
                          setEditingGiftTeamInput('');
                        }
                      }
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-brand-border text-xs outline-none focus:border-brand-text font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const clean = editingGiftTeamInput.trim();
                      if (clean) {
                        const current = editingGift.serviceTeams || [];
                        if (!current.includes(clean)) {
                          setEditingGift({ ...editingGift, serviceTeams: [...current, clean] });
                        }
                        setEditingGiftTeamInput('');
                      }
                    }}
                    className="px-4 py-2.5 bg-brand-accent-sage text-white text-[10px] font-bold uppercase tracking-wider rounded-xl hover:bg-opacity-90 shrink-0"
                  >
                    + Add Tag
                  </button>
                </div>

                {/* Quick Add Pill Cloud from Existing Teams */}
                {allUniqueServiceTeams.filter(t => !editingGift.serviceTeams?.includes(t)).length > 0 && (
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-brand-muted block mb-1.5">
                      Quick Add Existing Ministry Teams:
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1">
                      {allUniqueServiceTeams
                        .filter(t => !editingGift.serviceTeams?.includes(t))
                        .map(team => (
                          <button
                            key={team}
                            type="button"
                            onClick={() => {
                              const current = editingGift.serviceTeams || [];
                              setEditingGift({ ...editingGift, serviceTeams: [...current, team] });
                            }}
                            className="text-[9px] font-semibold text-brand-muted bg-brand-surface hover:bg-brand-accent-gold/10 hover:text-brand-accent-gold hover:border-brand-accent-gold/40 border border-brand-border px-2.5 py-1 rounded-lg transition-all"
                          >
                            + {team}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button 
                onClick={() => saveGift(editingGift)}
                className="flex-1 py-3.5 bg-brand-text text-white rounded-full text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-black"
              >
                Save Changes
              </button>
              <button 
                onClick={() => setEditingGift(null)}
                className="flex-1 py-3.5 border border-brand-border text-brand-muted rounded-full text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-brand-surface"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Question Modal */}
      {editingQuestion && (
        <div className="fixed inset-0 z-[200] bg-brand-text/40 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-brand-bg rounded-2xl sm:rounded-[2.5rem] p-5 sm:p-10 max-w-xl w-full border border-brand-border shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg sm:text-xl font-bold tracking-tight text-brand-text mb-6 sm:mb-8">Configure Question</h3>
            <div className="space-y-4 sm:space-y-6">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-muted mb-2">Question Prompt</label>
                <textarea 
                  rows={3}
                  value={editingQuestion.text} 
                  onChange={e => setEditingQuestion({...editingQuestion, text: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-brand-border focus:border-brand-text outline-none text-sm resize-none font-sans"
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
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button 
                onClick={() => saveQuestion(editingQuestion)}
                className="flex-1 py-3.5 bg-brand-text text-white rounded-full text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-black"
              >
                Confirm Question
              </button>
              <button 
                onClick={() => setEditingQuestion(null)}
                className="flex-1 py-3.5 border border-brand-border text-brand-muted rounded-full text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-brand-surface"
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
