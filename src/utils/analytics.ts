/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AnalyticsEvent } from "../types";

export const trackEvent = async (type: AnalyticsEvent['type'], metadata?: Record<string, any>) => {
  const event: AnalyticsEvent = {
    type,
    timestamp: new Date().toISOString(),
    metadata
  };

  console.log(`[Track] ${type}`, metadata);

  try {
    // Write to Firestore for the admin dashboard to consume
    await addDoc(collection(db, 'analytics'), event);
    
    // Also keep the server log if needed, but Firestore is primary for the dashboard
    await fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    });
  } catch (error) {
    console.warn('Failed to track event', error);
  }
};
