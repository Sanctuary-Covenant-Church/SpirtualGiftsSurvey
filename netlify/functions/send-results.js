// Netlify Serverless Function for Email Dispatch
// Automatically handles POST /api/send-results when deployed on Netlify

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

export const handler = async (event, context) => {
  // Always handle OPTIONS preflight for CORS
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Method Not Allowed. Use POST." })
    };
  }

  try {
    let payload = {};
    try {
      payload = JSON.parse(event.body || "{}");
    } catch (parseErr) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Invalid JSON request body." })
      };
    }

    const { name, email, topGifts, topMinistryMatches, timestamp } = payload;

    if (!email || !email.trim()) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "User email address is required." })
      };
    }

    const resendApiKey = (process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY || "").trim();
    if (!resendApiKey) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: "RESEND_API_KEY environment variable is not configured in Netlify. Please add RESEND_API_KEY in Netlify Site Settings > Environment Variables."
        })
      };
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || process.env.VITE_RESEND_FROM_EMAIL || "Sanctuary Covenant Church <onboarding@resend.dev>";
    
    // Fetch recipient list directly from Firestore settings/email document
    const firestoreRecipients = await fetchFirestoreRecipients();
    const envRecipientsStr = process.env.NOTIFICATION_EMAILS || "";
    const envRecipients = envRecipientsStr.split(",").map(e => e.trim().toLowerCase()).filter(Boolean);

    // Combine participant email, Firestore recipients, and env recipients (deduplicated)
    const adminRecipients = Array.from(new Set([
      ...firestoreRecipients,
      ...envRecipients,
      "cdonyi@gmail.com"
    ])).map(e => e.trim().toLowerCase()).filter(Boolean);

    const allRecipients = Array.from(new Set([
      email.trim().toLowerCase(),
      ...adminRecipients
    ])).filter(Boolean);

    const htmlContent = generateResultsEmailHtml({
      name: name || "Anonymous Participant",
      email: email.trim(),
      timestamp: timestamp || new Date().toISOString(),
      topGifts: topGifts || [],
      topMinistryMatches: topMinistryMatches || []
    });

    const subject = `Soul Discovery Results: ${name || 'Participant'} (${email})`;

    // 1. Primary Batch Email Attempt (to all recipients)
    let resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: fromEmail,
        to: allRecipients,
        subject,
        html: htmlContent
      })
    });

    let resendData = await resendResponse.json().catch(() => ({}));

    // If primary batch attempt succeeded, return 200
    if (resendResponse.ok) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: true,
          mode: "netlify_function_resend",
          message: `Results successfully emailed to participant (${email}) and ${adminRecipients.length} configured recipient(s)!`,
          recipients: allRecipients,
          data: resendData
        })
      };
    }

    console.warn(`[Resend Primary Batch Attempt Failed] Status: ${resendResponse.status}`, resendData);

    // 2. Individual Delivery Fallback (loop through each recipient individually)
    // This overcomes free tier restrictions (e.g. onboarding@resend.dev) and domain verification rules per address
    const successfulRecipients = [];
    const failedRecipients = [];

    for (const recipient of allRecipients) {
      try {
        const indResp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [recipient],
            subject,
            html: htmlContent
          })
        });

        if (indResp.ok) {
          successfulRecipients.push(recipient);
        } else {
          // If custom domain fromEmail failed for this address, try default onboarding@resend.dev
          if (!fromEmail.includes('onboarding@resend.dev')) {
            const fallbackFrom = "Sanctuary Covenant Church <onboarding@resend.dev>";
            const retryInd = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${resendApiKey}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                from: fallbackFrom,
                to: [recipient],
                subject,
                html: htmlContent
              })
            });
            if (retryInd.ok) {
              successfulRecipients.push(recipient);
              continue;
            }
          }
          const errText = await indResp.text();
          failedRecipients.push({ email: recipient, error: errText });
        }
      } catch (indErr) {
        failedRecipients.push({ email: recipient, error: indErr.message || String(indErr) });
      }
    }

    if (successfulRecipients.length > 0) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: true,
          mode: "netlify_function_resend_individual",
          message: `Results emailed to ${successfulRecipients.length} of ${allRecipients.length} configured address(es).`,
          recipients: successfulRecipients,
          failedRecipients
        })
      };
    }

    // 4. If all attempts fail, extract clear, actionable error message from Resend
    let resendMessage = resendData.message || resendData.error || `Resend API returned HTTP ${resendResponse.status}`;
    if (typeof resendMessage !== 'string') {
      resendMessage = JSON.stringify(resendMessage);
    }

    let userFacingNotice = resendMessage;
    if (resendMessage.includes('testing emails') || resendMessage.includes('own email address')) {
      userFacingNotice = `Resend Testing Limit: Free Resend domain (onboarding@resend.dev) can only send to your account email (${adminRecipients.join(', ')}). To send emails to all participant addresses, add and verify your custom domain (e.g. sanctuarycov.org) in the Resend Dashboard.`;
    } else if (resendMessage.includes('not verified') || resendMessage.includes('domain')) {
      userFacingNotice = `Resend Domain Notice: ${resendMessage}. Please verify your domain in Resend Dashboard or set RESEND_FROM_EMAIL to a verified address in Netlify Site Settings.`;
    }

    return {
      statusCode: resendResponse.status || 422,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: userFacingNotice,
        rawError: resendData
      })
    };
  } catch (err) {
    console.error(`[Send-Results Exception]`, err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message || "Failed to execute email dispatch function" })
    };
  }
};

function generateResultsEmailHtml(data) {
  const { name, email, timestamp, topGifts, topMinistryMatches } = data;
  const formattedDate = timestamp 
    ? new Date(timestamp).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' })
    : new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' });

  const giftsHtml = (topGifts || []).slice(0, 5).map((gift, idx) => `
    <tr style="border-bottom: 1px solid #EAE7E1;">
      <td style="padding: 14px 16px; vertical-align: top; width: 40px; font-weight: bold; color: #8C232C; font-size: 16px;">
        #${idx + 1}
      </td>
      <td style="padding: 14px 16px; vertical-align: top;">
        <div style="font-size: 16px; font-weight: bold; color: #1C1B1A; font-family: Georgia, serif;">
          ${gift.name || gift.giftName}
        </div>
        ${gift.scripture ? `<div style="font-size: 12px; color: #8C232C; font-style: italic; margin-top: 2px;">${gift.scripture}</div>` : ''}
        <div style="font-size: 13px; color: #555350; margin-top: 6px; line-height: 1.5;">
          ${gift.description || ''}
        </div>
        ${gift.serviceTeams && gift.serviceTeams.length > 0 ? `
          <div style="font-size: 12px; color: #6E6B66; margin-top: 8px;">
            <strong style="color: #8C232C;">Recommended Ministry Option:</strong> ${gift.serviceTeams[0]}
          </div>
        ` : ''}
      </td>
      <td style="padding: 14px 16px; vertical-align: top; text-align: right; width: 80px;">
        <span style="display: inline-block; background-color: #F6F4F0; color: #1C1B1A; font-weight: bold; font-size: 13px; padding: 4px 10px; border-radius: 12px; border: 1px solid #DDD9D0;">
          ${gift.score || 0} pts
        </span>
      </td>
    </tr>
  `).join('');

  const ministryHtml = (topMinistryMatches || []).slice(0, 5).map((match, idx) => `
    <div style="background-color: #FFFFFF; border: 1px solid #EAE7E1; border-radius: 12px; padding: 14px 18px; margin-bottom: 10px;">
      <span style="display: inline-block; font-size: 11px; font-weight: bold; color: #8C232C; text-transform: uppercase; letter-spacing: 0.1em;">
        Match #${idx + 1}
      </span>
      <div style="font-size: 15px; font-weight: bold; color: #1C1B1A; font-family: Georgia, serif; margin-top: 2px;">
        ${match.teamName}
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
              <h2 style="font-family: Georgia, serif; font-size: 20px; font-style: italic; color: #1C1B1A; margin-top: 0; margin-bottom: 16px; border-bottom: 2px solid #8C232C; padding-bottom: 8px; display: inline-block;">
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
              <h2 style="font-family: Georgia, serif; font-size: 20px; font-style: italic; color: #1C1B1A; margin-top: 0; margin-bottom: 16px; border-bottom: 2px solid #D4AF37; padding-bottom: 8px; display: inline-block;">
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

async function fetchFirestoreRecipients() {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || "ais-dev-bun6aislalbji7kh7as6y6";
  const apiKey = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY;
  const databaseId = process.env.FIREBASE_DATABASE_ID || process.env.VITE_FIREBASE_DATABASE_ID || "(default)";

  if (!projectId) return [];

  try {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/settings/email${apiKey ? `?key=${apiKey}` : ''}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    if (data && data.fields && data.fields.recipients && data.fields.recipients.arrayValue && Array.isArray(data.fields.recipients.arrayValue.values)) {
      return data.fields.recipients.arrayValue.values
        .map(v => (v.stringValue || (typeof v === 'string' ? v : '')).trim().toLowerCase())
        .filter(Boolean);
    }
  } catch (err) {
    console.warn('[Firestore Recipients Fetch Error]', err);
  }
  return [];
}
