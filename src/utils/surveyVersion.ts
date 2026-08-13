/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../lib/firebase';

export interface SurveyVersionInfo {
  major: number;
  minor: number;
  versionStr: string; // e.g., 'v5.0'
  updatedAt: string;
  lastChangeType?: 'question' | 'gift' | 'initial';
}

export const DEFAULT_SURVEY_VERSION: SurveyVersionInfo = {
  major: 5,
  minor: 0,
  versionStr: 'v5.0',
  updatedAt: new Date().toISOString(),
  lastChangeType: 'initial'
};

const LOCAL_STORAGE_KEY = 'sanctuary_survey_version';

export function parseVersionString(verStr: string): { major: number; minor: number } {
  if (!verStr) return { major: 5, minor: 0 };
  const clean = verStr.replace(/^v/i, '').trim();
  const parts = clean.split('.');
  const major = parseInt(parts[0], 10);
  const minor = parseInt(parts[1], 10);
  return {
    major: isNaN(major) ? 5 : major,
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
        return {
          major: parsed.major,
          minor: parsed.minor,
          versionStr: parsed.versionStr || formatVersionString(parsed.major, parsed.minor),
          updatedAt: parsed.updatedAt || new Date().toISOString(),
          lastChangeType: parsed.lastChangeType || 'initial'
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
        let major = data.major;
        let minor = data.minor;
        if (typeof major !== 'number' || typeof minor !== 'number') {
          const parsed = parseVersionString(data.versionStr || data.surveyVersion || 'v5.0');
          major = parsed.major;
          minor = parsed.minor;
        }
        const versionInfo: SurveyVersionInfo = {
          major,
          minor,
          versionStr: formatVersionString(major, minor),
          updatedAt: data.updatedAt || new Date().toISOString(),
          lastChangeType: data.lastChangeType || 'initial'
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
 * Automatically increments Major version when Questions change (vX.Y -> v(X+1).0)
 */
export async function incrementMajorVersionQuestionChange(): Promise<SurveyVersionInfo> {
  const current = await fetchCurrentSurveyVersion();
  const newMajor = current.major + 1;
  const newMinor = 0;
  const updatedInfo: SurveyVersionInfo = {
    major: newMajor,
    minor: newMinor,
    versionStr: formatVersionString(newMajor, newMinor),
    updatedAt: new Date().toISOString(),
    lastChangeType: 'question'
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
 * Automatically increments Minor version when Gifts change (vX.Y -> vX.(Y+1))
 */
export async function incrementMinorVersionGiftChange(): Promise<SurveyVersionInfo> {
  const current = await fetchCurrentSurveyVersion();
  const newMajor = current.major;
  const newMinor = current.minor + 1;
  const updatedInfo: SurveyVersionInfo = {
    major: newMajor,
    minor: newMinor,
    versionStr: formatVersionString(newMajor, newMinor),
    updatedAt: new Date().toISOString(),
    lastChangeType: 'gift'
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

export function subscribeSurveyVersion(callback: (info: SurveyVersionInfo) => void) {
  callback(getLocalSurveyVersion());

  if (!isFirebaseConfigured) {
    return () => {};
  }

  const unsub = onSnapshot(doc(db, 'settings', 'survey'), (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      let major = data.major;
      let minor = data.minor;
      if (typeof major !== 'number' || typeof minor !== 'number') {
        const parsed = parseVersionString(data.versionStr || data.surveyVersion || 'v5.0');
        major = parsed.major;
        minor = parsed.minor;
      }
      const versionInfo: SurveyVersionInfo = {
        major,
        minor,
        versionStr: formatVersionString(major, minor),
        updatedAt: data.updatedAt || new Date().toISOString(),
        lastChangeType: data.lastChangeType || 'initial'
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
