import { describe, it, expect } from 'vitest';
import { generateResultsEmailHtml, SurveyEmailPayload } from '../lib/emailTemplate';

describe('Email Template Generation', () => {
  it('generates email HTML with correct section headers and top 5 gifts', () => {
    const payload: SurveyEmailPayload = {
      name: 'Jane Doe',
      email: 'jane@example.com',
      timestamp: '2026-08-15T12:00:00Z',
      topGifts: [
        {
          name: 'Administration',
          score: 25,
          maxScore: 25,
          scripture: '1 Corinthians 12:28',
          description: 'The ability to organize and direct activities.',
          serviceTeams: ['Operations Team', 'Finance Committee'],
        },
        {
          name: 'Encouragement',
          score: 20,
          maxScore: 25,
          scripture: 'Romans 12:8',
          description: 'The ability to counsel and comfort.',
          serviceTeams: ['Care Ministry'],
        },
      ],
      topMinistryMatches: [
        { teamName: 'Operations Team', giftName: 'Administration' },
        { teamName: 'Care Ministry', giftName: 'Encouragement' },
      ],
    };

    const html = generateResultsEmailHtml(payload);

    // Header validations
    expect(html).toContain('Top 5 Spiritual Gifts');
    expect(html).toContain('Top 5 Ministry Team Matches');
    expect(html).toContain('Jane Doe');
    expect(html).toContain('jane@example.com');

    // Gift validation
    expect(html).toContain('Administration');
    expect(html).toContain('Recommended Ministry Option:</strong> Operations Team');
    expect(html).not.toContain('Finance Committee'); // Only 1st recommended option is rendered per gift

    // Ministry match validation
    expect(html).toContain('Operations Team');
    expect(html).toContain('Care Ministry');
  });

  it('handles missing or empty arrays gracefully', () => {
    const payload: SurveyEmailPayload = {
      name: 'John Smith',
      email: 'john@example.com',
      topGifts: [],
      topMinistryMatches: [],
    };

    const html = generateResultsEmailHtml(payload);
    expect(html).toContain('Top 5 Spiritual Gifts');
    expect(html).toContain('Top 5 Ministry Team Matches');
    expect(html).toContain('John Smith');
  });
});
