/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Question {
  id: string;
  text: string;
  giftId: string;
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

export interface SurveyResult {
  userId: string;
  timestamp: string;
  responses: SurveyResponse[];
  scores: Record<string, number>;
  primaryGiftIds: string[];
  email?: string;
  name?: string;
}

export interface AnalyticsEvent {
  type: 'survey_start' | 'survey_complete' | 'cta_click' | 'page_view';
  timestamp: string;
  metadata?: Record<string, any>;
}
