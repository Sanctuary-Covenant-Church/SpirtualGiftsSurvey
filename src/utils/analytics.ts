/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AnalyticsEvent } from "../types";

export const trackEvent = async (type: AnalyticsEvent['type'], metadata?: Record<string, any>) => {
  const event: Record<string, any> = {
    type,
    timestamp: new Date().toISOString(),
  };

  if (metadata && Object.keys(metadata).length > 0) {
    event.metadata = metadata;
  }

  console.log(`[Track] ${type}`, metadata);

  try {
    // Write to Firestore for the admin dashboard to consume
    await addDoc(collection(db, 'analytics'), event);
  } catch (error) {
    console.warn('Failed to track event to Firestore', error);
  }

  // Optional backend endpoint call if an Express API server URL is explicitly configured
  const apiBase = import.meta.env.VITE_API_URL || '';
  if (apiBase) {
    try {
      await fetch(`${apiBase}/api/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      }).catch(() => {});
    } catch {
      // Silently ignore backend API errors on static hosts
    }
  }
};
