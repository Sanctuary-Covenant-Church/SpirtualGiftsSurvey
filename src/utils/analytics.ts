/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AnalyticsEvent } from "../types";

export const trackEvent = async (type: AnalyticsEvent['type'], metadata?: Record<string, any>) => {
  const event: AnalyticsEvent = {
    type,
    timestamp: new Date().toISOString(),
    metadata
  };

  console.log(`[Track] ${type}`, metadata);

  try {
    await fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    });
  } catch (error) {
    console.warn('Failed to track event', error);
  }
};
