// Netlify Serverless Function for Email Dispatch
// Automatically handles POST /api/send-results when deployed on Netlify

import { generateResultsEmailHtml } from "../../src/lib/emailTemplate.js";

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
