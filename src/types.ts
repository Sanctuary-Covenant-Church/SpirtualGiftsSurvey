/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Question {
  id: string;
  text: string;
  giftId: string;
  order?: number;
}

export interface Gift {
  id: string;
  name: string;
  description: string;
  scripture?: string;
  serviceTeams?: string[];
}

export interface SurveyConfig {
  questions: Question[];
  gifts: Gift[];
}

export interface SurveyResponse {
  questionId: string;
  score: number; // 1-5
}

export interface GiftMatch {
  giftId: string;
  name: string;
  score: number;
  maxScore: number;
  description: string;
  scripture?: string;
  serviceTeams?: string[];
}

export interface MinistryMatch {
  teamName: string;
  giftId: string;
  giftName: string;
}

export interface SurveyResult {
  userId: string;
  timestamp: string;
  responses: SurveyResponse[];
  scores: Record<string, number>;
  primaryGiftIds: string[];
  topGifts?: GiftMatch[];
  topMinistryMatches?: MinistryMatch[];
  email?: string;
  name?: string;
  consentGiven?: boolean;
  sharingConsented?: boolean;
  consentTimestamp?: string;
  consentTextVersion?: string;
  optedOutByAdmin?: boolean;
  optOutTimestamp?: string;
}

export interface EmailRecipientConfig {
  recipients: string[];
  lastUpdated?: string;
}

export interface EmailServerStatus {
  configured: boolean;
  provider: string;
  from: string;
  smtpHost?: string;
  activeRecipients: string[];
}

export interface AnalyticsEvent {
  type: 'survey_start' | 'survey_complete' | 'cta_click' | 'page_view';
  timestamp: string;
  metadata?: Record<string, any>;
}
