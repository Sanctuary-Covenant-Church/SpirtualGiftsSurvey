/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../lib/firebase';

export interface SurveyVersionInfo {
  major: number;
  minor: number;
  versionStr: string; // e.g., 'v1.0'
  updatedAt: string;
  lastChangeType?: 'question_structural' | 'question_content' | 'gift' | 'initial';
  v1ResetDone?: boolean;
}

export const DEFAULT_SURVEY_VERSION: SurveyVersionInfo = {
  major: 1,
  minor: 0,
  versionStr: 'v1.0',
  updatedAt: new Date().toISOString(),
  lastChangeType: 'initial',
  v1ResetDone: true
};

const LOCAL_STORAGE_KEY = 'sanctuary_survey_version';

export function parseVersionString(verStr: string): { major: number; minor: number } {
  if (!verStr) return { major: 1, minor: 0 };
  const clean = verStr.replace(/^v/i, '').trim();
  const parts = clean.split('.');
  const major = parseInt(parts[0], 10);
  const minor = parseInt(parts[1], 10);
  return {
    major: isNaN(major) ? 1 : major,
    minor: isNaN(minor) ? 0 : minor
  };
}

export function formatVersionString(major: number, minor: number): string {
  return `v${major}.${minor}`;
}

export function getLocalSurveyVersion(): SurveyVersionInfo {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.major === 'number' && typeof parsed.minor === 'number') {
        if (!parsed.v1ResetDone || parsed.major >= 5) {
          saveLocalSurveyVersion(DEFAULT_SURVEY_VERSION);
          return DEFAULT_SURVEY_VERSION;
        }
        return {
          major: parsed.major,
          minor: parsed.minor,
          versionStr: parsed.versionStr || formatVersionString(parsed.major, parsed.minor),
          updatedAt: parsed.updatedAt || new Date().toISOString(),
          lastChangeType: parsed.lastChangeType || 'initial',
          v1ResetDone: true
        };
      }
    }
  } catch (err) {
    console.warn('Failed to parse local survey version:', err);
  }
  return DEFAULT_SURVEY_VERSION;
}

export function saveLocalSurveyVersion(info: SurveyVersionInfo) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(info));
  } catch (err) {
    console.warn('Failed to save local survey version:', err);
  }
}

export async function fetchCurrentSurveyVersion(): Promise<SurveyVersionInfo> {
  if (isFirebaseConfigured) {
    try {
      const surveyDocRef = doc(db, 'settings', 'survey');
      const docSnap = await getDoc(surveyDocRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (!data.v1ResetDone || data.major >= 5) {
          // Reset to v1.0 baseline for fresh start
          await setDoc(surveyDocRef, DEFAULT_SURVEY_VERSION);
          saveLocalSurveyVersion(DEFAULT_SURVEY_VERSION);
          return DEFAULT_SURVEY_VERSION;
        }

        let major = data.major;
        let minor = data.minor;
        if (typeof major !== 'number' || typeof minor !== 'number') {
          const parsed = parseVersionString(data.versionStr || data.surveyVersion || 'v1.0');
          major = parsed.major;
          minor = parsed.minor;
        }
        const versionInfo: SurveyVersionInfo = {
          major,
          minor,
          versionStr: formatVersionString(major, minor),
          updatedAt: data.updatedAt || new Date().toISOString(),
          lastChangeType: data.lastChangeType || 'initial',
          v1ResetDone: true
        };
        saveLocalSurveyVersion(versionInfo);
        return versionInfo;
      } else {
        await setDoc(surveyDocRef, DEFAULT_SURVEY_VERSION);
        saveLocalSurveyVersion(DEFAULT_SURVEY_VERSION);
        return DEFAULT_SURVEY_VERSION;
      }
    } catch (err) {
      console.warn('Failed to fetch survey version from Firestore, using local fallback:', err);
    }
  }
  return getLocalSurveyVersion();
}

/**
 * Option 4 - Structural Change (Add/Delete Questions): Increments Major version (vX.Y -> v(X+1).0)
 */
export async function incrementMajorVersionStructuralChange(): Promise<SurveyVersionInfo> {
  const current = await fetchCurrentSurveyVersion();
  const newMajor = current.major + 1;
  const newMinor = 0;
  const updatedInfo: SurveyVersionInfo = {
    major: newMajor,
    minor: newMinor,
    versionStr: formatVersionString(newMajor, newMinor),
    updatedAt: new Date().toISOString(),
    lastChangeType: 'question_structural',
    v1ResetDone: true
  };

  saveLocalSurveyVersion(updatedInfo);

  if (isFirebaseConfigured) {
    try {
      await setDoc(doc(db, 'settings', 'survey'), updatedInfo);
    } catch (err) {
      console.error('Failed to update major survey version in Firestore:', err);
    }
  }

  return updatedInfo;
}

/**
 * Option 4 - Minor Content Change (Edit question text, reorder questions, or update gifts): Increments Minor version (vX.Y -> vX.(Y+1))
 */
export async function incrementMinorVersionContentChange(): Promise<SurveyVersionInfo> {
  const current = await fetchCurrentSurveyVersion();
  const newMajor = current.major;
  const newMinor = current.minor + 1;
  const updatedInfo: SurveyVersionInfo = {
    major: newMajor,
    minor: newMinor,
    versionStr: formatVersionString(newMajor, newMinor),
    updatedAt: new Date().toISOString(),
    lastChangeType: 'question_content',
    v1ResetDone: true
  };

  saveLocalSurveyVersion(updatedInfo);

  if (isFirebaseConfigured) {
    try {
      await setDoc(doc(db, 'settings', 'survey'), updatedInfo);
    } catch (err) {
      console.error('Failed to update minor survey version in Firestore:', err);
    }
  }

  return updatedInfo;
}

// Aliases for backward compatibility
export const incrementMajorVersionQuestionChange = incrementMajorVersionStructuralChange;
export const incrementMinorVersionGiftChange = incrementMinorVersionContentChange;

export function subscribeSurveyVersion(callback: (info: SurveyVersionInfo) => void) {
  callback(getLocalSurveyVersion());

  if (!isFirebaseConfigured) {
    return () => {};
  }

  const unsub = onSnapshot(doc(db, 'settings', 'survey'), (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      if (!data.v1ResetDone || data.major >= 5) {
        setDoc(doc(db, 'settings', 'survey'), DEFAULT_SURVEY_VERSION).catch(() => {});
        callback(DEFAULT_SURVEY_VERSION);
        return;
      }
      let major = data.major;
      let minor = data.minor;
      if (typeof major !== 'number' || typeof minor !== 'number') {
        const parsed = parseVersionString(data.versionStr || data.surveyVersion || 'v1.0');
        major = parsed.major;
        minor = parsed.minor;
      }
      const versionInfo: SurveyVersionInfo = {
        major,
        minor,
        versionStr: formatVersionString(major, minor),
        updatedAt: data.updatedAt || new Date().toISOString(),
        lastChangeType: data.lastChangeType || 'initial',
        v1ResetDone: true
      };
      saveLocalSurveyVersion(versionInfo);
      callback(versionInfo);
    } else {
      setDoc(doc(db, 'settings', 'survey'), DEFAULT_SURVEY_VERSION).catch(() => {});
      callback(DEFAULT_SURVEY_VERSION);
    }
  }, (err) => {
    console.warn('Survey version subscription error:', err);
  });

  return unsub;
}
