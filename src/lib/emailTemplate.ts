/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface GiftMatchData {
  name: string;
  score: number;
  maxScore?: number;
  scripture?: string;
  description: string;
}

export interface MinistryMatchData {
  teamName: string;
  giftName: string;
}

export interface SurveyEmailPayload {
  name: string;
  email: string;
  timestamp?: string;
  topGifts: GiftMatchData[];
  topMinistryMatches: MinistryMatchData[];
}

export function generateResultsEmailHtml(data: SurveyEmailPayload): string {
  const { name, email, timestamp, topGifts, topMinistryMatches } = data;
  const formattedDate = timestamp 
    ? new Date(timestamp).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const giftsHtml = topGifts.slice(0, 5).map((gift, idx) => `
    <tr style="border-bottom: 1px solid #EAE7E1;">
      <td style="padding: 14px 16px; vertical-align: top; width: 40px; font-weight: bold; color: #8C232C; font-size: 16px;">
        #${idx + 1}
      </td>
      <td style="padding: 14px 16px; vertical-align: top;">
        <div style="font-size: 16px; font-weight: bold; color: #1C1B1A; font-family: Georgia, serif;">
          ${gift.name}
        </div>
        ${gift.scripture ? `<div style="font-size: 12px; color: #8C232C; font-style: italic; margin-top: 2px;">${gift.scripture}</div>` : ''}
        <div style="font-size: 13px; color: #555350; margin-top: 6px; line-height: 1.5;">
          ${gift.description}
        </div>
      </td>
      <td style="padding: 14px 16px; vertical-align: top; text-align: right; width: 80px;">
        <span style="display: inline-block; background-color: #F6F4F0; color: #1C1B1A; font-weight: bold; font-size: 13px; padding: 4px 10px; rounded: 12px; border: 1px solid #DDD9D0;">
          ${gift.score} pts
        </span>
      </td>
    </tr>
  `).join('');

  const ministryHtml = topMinistryMatches.slice(0, 5).map((match, idx) => `
    <div style="background-color: #FFFFFF; border: 1px solid #EAE7E1; border-radius: 12px; padding: 14px 18px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <span style="display: inline-block; font-size: 11px; font-weight: bold; color: #8C232C; text-transform: uppercase; tracking: 0.1em;">
          Match #${idx + 1}
        </span>
        <div style="font-size: 15px; font-weight: bold; color: #1C1B1A; font-family: Georgia, serif; margin-top: 2px;">
          ${match.teamName}
        </div>
      </div>
      <div style="text-align: right;">
        <span style="font-size: 11px; color: #6E6B66; background-color: #F6F4F0; padding: 4px 10px; border-radius: 20px; font-weight: 500;">
          Aligned with ${match.giftName}
        </span>
      </div>
    </div>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Soul Discovery Results - Sanctuary Covenant Church</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F6F4F0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1C1B1A;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F6F4F0; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" maxWidth="620" cellpadding="0" cellspacing="0" style="max-width: 620px; background-color: #FFFFFF; border-radius: 24px; border: 1px solid #EAE7E1; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.04);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #8C232C; padding: 36px 32px; text-align: center;">
              <div style="color: #F5E8D0; font-size: 11px; font-weight: bold; letter-spacing: 0.25em; text-transform: uppercase; margin-bottom: 8px;">
                Sanctuary Covenant Church
              </div>
              <h1 style="color: #FFFFFF; font-family: Georgia, serif; font-size: 26px; font-style: italic; margin: 0; font-weight: normal;">
                Soul Discovery • Spiritual Gifts Survey
              </h1>
            </td>
          </tr>

          <!-- Participant Info -->
          <tr>
            <td style="padding: 32px 32px 20px 32px; background-color: #FAF8F5; border-bottom: 1px solid #EAE7E1;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-size: 11px; font-weight: bold; color: #8C232C; text-transform: uppercase; letter-spacing: 0.15em;">
                      Survey Participant
                    </div>
                    <div style="font-size: 20px; font-weight: bold; color: #1C1B1A; margin-top: 4px; font-family: Georgia, serif;">
                      ${name || 'Anonymous Participant'}
                    </div>
                    <div style="font-size: 14px; color: #555350; margin-top: 2px;">
                      ${email}
                    </div>
                  </td>
                  <td align="right" style="vertical-align: top;">
                    <span style="font-size: 12px; color: #8C8880;">${formattedDate}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Top 5 Spiritual Gifts -->
          <tr>
            <td style="padding: 32px 32px 24px 32px;">
              <h2 style="font-family: Georgia, serif; font-size: 20px; italic: true; color: #1C1B1A; margin-top: 0; margin-bottom: 16px; border-bottom: 2px solid #8C232C; padding-bottom: 8px; display: inline-block;">
                Top 5 Spiritual Gifts
              </h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; background-color: #FFFFFF;">
                ${giftsHtml}
              </table>
            </td>
          </tr>

          <!-- Top 5 Ministry Matches -->
          <tr>
            <td style="padding: 0 32px 32px 32px;">
              <h2 style="font-family: Georgia, serif; font-size: 20px; italic: true; color: #1C1B1A; margin-top: 0; margin-bottom: 16px; border-bottom: 2px solid #D4AF37; padding-bottom: 8px; display: inline-block;">
                Top 5 Ministry Team Matches
              </h2>
              <p style="font-size: 13px; color: #555350; margin-top: 0; margin-bottom: 16px; line-height: 1.5;">
                Based on these spiritual gifts, here are the top 5 service teams at Sanctuary Covenant Church where ${name || 'they'} can flourish:
              </p>
              ${ministryHtml}
            </td>
          </tr>

          <!-- Footer & Call to Action -->
          <tr>
            <td style="background-color: #1C1B1A; padding: 28px 32px; text-align: center; color: #FFFFFF;">
              <div style="font-size: 14px; font-weight: bold; font-family: Georgia, serif; margin-bottom: 8px;">
                Sanctuary Covenant Church
              </div>
              <div style="font-size: 12px; color: #A09D98; margin-bottom: 16px;">
                710 W 31st St, Minneapolis, MN 55408 • Sundays @ 9:00 AM & 11:00 AM
              </div>
              <a href="https://sanctuarycov.org/join-a-team/" target="_blank" style="display: inline-block; background-color: #8C232C; color: #FFFFFF; text-decoration: none; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.15em; padding: 12px 24px; border-radius: 30px;">
                Join a Ministry Team
              </a>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}
