import { describe, it, expect } from 'vitest';
import { INITIAL_GIFTS, INITIAL_QUESTIONS } from '../constants';
import { SurveyResponse, GiftMatch, MinistryMatch, Gift } from '../types';

// Extracted core scoring logic to test functional accuracy
function calculateResultHelper(
  finalResponses: SurveyResponse[],
  gifts: Gift[] = INITIAL_GIFTS,
  questions = INITIAL_QUESTIONS
) {
  const scores: Record<string, number> = {};
  gifts.forEach(gift => (scores[gift.id] = 0));

  finalResponses.forEach(resp => {
    const question = questions.find(q => q.id === resp.questionId);
    if (question) {
      scores[question.giftId] = (scores[question.giftId] || 0) + resp.score;
    }
  });

  const sortedGifts = [...gifts].sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0));

  // Top 5 Gift Matches
  const topGiftsList: GiftMatch[] = sortedGifts.slice(0, 5).map(g => {
    const qCount = questions.filter(q => q.giftId === g.id).length;
    return {
      giftId: g.id,
      name: g.name,
      score: scores[g.id] || 0,
      maxScore: qCount * 5 || 10,
      description: g.description,
      scripture: g.scripture,
      serviceTeams: g.serviceTeams || [],
    };
  });

  // Top 5 Ministry Matches derived from top gifts
  const ministryMatches: MinistryMatch[] = [];
  const seenTeams = new Set<string>();

  for (const gMatch of topGiftsList) {
    if (gMatch.serviceTeams) {
      for (const team of gMatch.serviceTeams) {
        if (!seenTeams.has(team)) {
          seenTeams.add(team);
          ministryMatches.push({
            teamName: team,
            giftId: gMatch.giftId,
            giftName: gMatch.name,
          });
          if (ministryMatches.length >= 5) break;
        }
      }
    }
    if (ministryMatches.length >= 5) break;
  }

  return {
    scores,
    primaryGiftIds: topGiftsList.map(g => g.giftId),
    topGifts: topGiftsList,
    topMinistryMatches: ministryMatches,
  };
}

describe('Core Journey - Assessment Scoring & Logic', () => {
  it('contains valid initial gifts and questions dataset', () => {
    expect(INITIAL_GIFTS.length).toBeGreaterThanOrEqual(10);
    expect(INITIAL_QUESTIONS.length).toBeGreaterThan(0);

    // Ensure every question references a valid gift in INITIAL_GIFTS
    const giftIds = new Set(INITIAL_GIFTS.map(g => g.id));
    INITIAL_QUESTIONS.forEach(q => {
      expect(giftIds.has(q.giftId)).toBe(true);
    });
  });

  it('correctly totals scores for specific spiritual gifts', () => {
    // Select administration questions and answer with max score (5)
    const adminQuestions = INITIAL_QUESTIONS.filter(q => q.giftId === 'administration');
    const responses: SurveyResponse[] = adminQuestions.map(q => ({
      questionId: q.id,
      score: 5,
    }));

    const result = calculateResultHelper(responses);

    expect(result.scores['administration']).toBe(adminQuestions.length * 5);
    expect(result.primaryGiftIds[0]).toBe('administration');
    expect(result.topGifts[0].giftId).toBe('administration');
    expect(result.topGifts[0].score).toBe(adminQuestions.length * 5);
  });

  it('ranks top 5 gifts in strictly descending order of score', () => {
    const responses: SurveyResponse[] = [
      { questionId: '1', score: 5 }, // Administration (Q1)
      { questionId: '2', score: 5 }, // Administration (Q2)
      { questionId: '3', score: 4 }, // Discernment (Q3)
      { questionId: '4', score: 3 }, // Discernment (Q4)
      { questionId: '5', score: 2 }, // Encouragement (Q5)
    ];

    const result = calculateResultHelper(responses);

    expect(result.topGifts.length).toBe(5);
    for (let i = 0; i < result.topGifts.length - 1; i++) {
      expect(result.topGifts[i].score).toBeGreaterThanOrEqual(result.topGifts[i + 1].score);
    }
  });

  it('derives unique ministry matches from top scoring gifts', () => {
    const adminQuestions = INITIAL_QUESTIONS.filter(q => q.giftId === 'administration');
    const responses: SurveyResponse[] = adminQuestions.map(q => ({
      questionId: q.id,
      score: 5,
    }));

    const result = calculateResultHelper(responses);

    expect(result.topMinistryMatches.length).toBeGreaterThan(0);
    expect(result.topMinistryMatches.length).toBeLessThanOrEqual(5);

    // Verify team names in ministry matches are unique
    const teamNames = result.topMinistryMatches.map(m => m.teamName);
    const uniqueTeamNames = new Set(teamNames);
    expect(teamNames.length).toBe(uniqueTeamNames.size);
  });
});
