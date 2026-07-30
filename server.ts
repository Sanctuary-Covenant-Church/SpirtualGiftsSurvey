/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import nodemailer from "nodemailer";
import { generateResultsEmailHtml, SurveyEmailPayload } from "./src/lib/emailTemplate.js";

const DATA_DIR = path.join(process.cwd(), "data");
const RECIPIENTS_FILE = path.join(DATA_DIR, "recipients.json");
const ADMINS_FILE = path.join(DATA_DIR, "admins.json");

// Helper to ensure data directory exists
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Helper to log detailed errors to Firebase Firestore and server console
async function logErrorToFirebase(context: string, err: any, metadata: Record<string, any> = {}) {
  const errorMessage = err?.message || String(err);
  const errorDetails = {
    context,
    message: errorMessage,
    stack: err?.stack || null,
    metadata,
    timestamp: new Date().toISOString()
  };

  // Always log full detailed error to server console for container log visibility
  console.error(`[SERVER ERROR LOG] [${context}]`, JSON.stringify(errorDetails, null, 2));

  // Attempt writing to Firestore error_logs collection
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  const apiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY;
  const databaseId = process.env.VITE_FIREBASE_DATABASE_ID || "(default)";

  if (projectId) {
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/error_logs${apiKey ? `?key=${apiKey}` : ''}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: {
            context: { stringValue: context },
            message: { stringValue: errorMessage },
            details: { stringValue: JSON.stringify(metadata) },
            timestamp: { stringValue: new Date().toISOString() }
          }
        })
      });
      if (response.ok) {
        console.log(`[FIREBASE ERROR LOG] Successfully logged error to Firestore error_logs collection.`);
      } else {
        const respText = await response.text();
        console.warn(`[FIREBASE ERROR LOG NOTICE] Firestore write status ${response.status}: ${respText}`);
      }
    } catch (fbErr) {
      console.error(`[FIREBASE ERROR LOG FAILED] Could not write error log to Firestore:`, fbErr);
    }
  }
}

// Load recipient emails
function getStoredRecipients(): string[] {
  try {
    ensureDataDir();
    if (fs.existsSync(RECIPIENTS_FILE)) {
      const raw = fs.readFileSync(RECIPIENTS_FILE, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.recipients)) {
        return parsed.recipients;
      }
    }
  } catch (err) {
    console.error("Failed to load recipients file:", err);
  }
  // Default fallback list
  return ["cdonyi@gmail.com", "siona@sanctuarycov.org"];
}

// Save recipient emails
function saveStoredRecipients(recipients: string[]) {
  ensureDataDir();
  const clean = Array.from(new Set(recipients.map(e => e.trim().toLowerCase()))).filter(Boolean);
  fs.writeFileSync(RECIPIENTS_FILE, JSON.stringify({ recipients: clean, lastUpdated: new Date().toISOString() }, null, 2));
  return clean;
}

// Load authorized admin emails
function getStoredAdmins(): string[] {
  try {
    ensureDataDir();
    if (fs.existsSync(ADMINS_FILE)) {
      const raw = fs.readFileSync(ADMINS_FILE, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.admins) && parsed.admins.length > 0) {
        return parsed.admins;
      }
    }
  } catch (err) {
    console.error("Failed to load admins file:", err);
  }
  // Default fallback list
  return ["cdonyi@gmail.com", "sanctuarycovdeveloper@gmail.com", "siona@sanctuarycov.org"];
}

// Save authorized admin emails
function saveStoredAdmins(admins: string[]) {
  ensureDataDir();
  const clean = Array.from(new Set(admins.map(e => e.trim().toLowerCase()))).filter(Boolean);
  fs.writeFileSync(ADMINS_FILE, JSON.stringify({ admins: clean, lastUpdated: new Date().toISOString() }, null, 2));
  return clean;
}

// Email Transporter Builder
function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    return {
      type: "smtp",
      transporter: nodemailer.createTransport({
        host,
        port,
        secure: process.env.SMTP_SECURE === "true" || port === 465,
        auth: { user, pass }
      })
    };
  }
  return null;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // GET /api/email-config
  app.get("/api/email-config", (req, res) => {
    try {
      const recipients = getStoredRecipients();
      const hasSmtp = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
      const hasResend = Boolean(process.env.RESEND_API_KEY);
      const hasSendGrid = Boolean(process.env.SENDGRID_API_KEY);

      let provider = "Demo / Local Log Mode";
      if (hasSmtp) provider = "SMTP Mail Server";
      else if (hasResend) provider = "Resend API";
      else if (hasSendGrid) provider = "SendGrid API";

      res.json({
        configured: hasSmtp || hasResend || hasSendGrid,
        provider,
        from: process.env.EMAIL_FROM || "Sanctuary Covenant Church <no-reply@app.sanctuarycov.org>",
        recipients
      });
    } catch (err: any) {
      logErrorToFirebase("GET /api/email-config", err);
      res.status(500).json({ error: "Failed to load email configuration." });
    }
  });

  // POST /api/email-config
  app.post("/api/email-config", async (req, res) => {
    try {
      const { recipients } = req.body;
      if (!Array.isArray(recipients)) {
        return res.status(400).json({ error: "Recipients must be an array of email strings." });
      }
      const updated = saveStoredRecipients(recipients);
      res.json({ success: true, recipients: updated });
    } catch (err: any) {
      await logErrorToFirebase("POST /api/email-config", err);
      res.status(500).json({ error: "Failed to update email recipient list." });
    }
  });

  // GET /api/admin-config
  app.get("/api/admin-config", (req, res) => {
    try {
      const admins = getStoredAdmins();
      res.json({ admins });
    } catch (err: any) {
      logErrorToFirebase("GET /api/admin-config", err);
      res.status(500).json({ error: "Failed to load administrator list." });
    }
  });

  // POST /api/admin-config
  app.post("/api/admin-config", async (req, res) => {
    try {
      const { admins } = req.body;
      if (!Array.isArray(admins)) {
        return res.status(400).json({ error: "Admins must be an array of email strings." });
      }
      if (admins.length === 0) {
        return res.status(400).json({ error: "Admin list cannot be empty. At least one administrator email is required." });
      }
      const updated = saveStoredAdmins(admins);
      res.json({ success: true, admins: updated });
    } catch (err: any) {
      await logErrorToFirebase("POST /api/admin-config", err);
      res.status(500).json({ error: "Failed to update administrator list." });
    }
  });

  // POST /api/send-results
  app.post("/api/send-results", async (req, res) => {
    try {
      const { name, email, topGifts, topMinistryMatches, timestamp } = req.body;

      if (!email) {
        return res.status(400).json({ error: "User email address is required." });
      }

      // Configured admin notification recipient list
      const adminRecipients = getStoredRecipients();
      
      // Combine user email and admin recipients (deduplicated)
      const allRecipients = Array.from(new Set([
        email.trim().toLowerCase(),
        ...adminRecipients
      ])).filter(Boolean);

      const payload: SurveyEmailPayload = {
        name: name || "Anonymous",
        email,
        timestamp: timestamp || new Date().toISOString(),
        topGifts: topGifts || [],
        topMinistryMatches: topMinistryMatches || []
      };

      const htmlContent = generateResultsEmailHtml(payload);
      const subject = `Soul Discovery Results: ${payload.name} (${payload.email})`;
      const fromAddr = process.env.EMAIL_FROM || "Sanctuary Covenant Church <no-reply@app.sanctuarycov.org>";

      const transportObj = createTransporter();

      if (process.env.RESEND_API_KEY) {
        console.log(`[EMAIL RESEND API] Dispatching results to ${allRecipients.join(", ")}...`);
        const resendResp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: fromAddr,
            to: allRecipients,
            subject,
            html: htmlContent
          })
        });

        if (!resendResp.ok) {
          const errText = await resendResp.text();
          await logErrorToFirebase("Email Dispatch (Resend API)", new Error(`Resend HTTP ${resendResp.status}: ${errText}`), {
            statusCode: resendResp.status,
            recipients: allRecipients,
            from: fromAddr
          });
          return res.status(500).json({
            error: "Unable to send survey results email at this time. The issue has been logged for system administrators. Please try again later."
          });
        }

        const resendJson = await resendResp.json().catch(() => ({}));
        console.log(`[EMAIL RESEND API SUCCESS]`, resendJson);

        return res.json({
          success: true,
          mode: "live_resend",
          message: `Survey results emailed to participant (${email}) and ${adminRecipients.length} configured recipient(s).`,
          recipients: allRecipients
        });
      }

      if (process.env.SENDGRID_API_KEY) {
        console.log(`[EMAIL SENDGRID API] Dispatching results to ${allRecipients.join(", ")}...`);
        const sgResp = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.SENDGRID_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            personalizations: [{ to: allRecipients.map(e => ({ email: e })) }],
            from: { email: fromAddr.includes("<") ? fromAddr.split("<")[1].replace(">", "").trim() : fromAddr },
            subject,
            content: [{ type: "text/html", value: htmlContent }]
          })
        });

        if (!sgResp.ok) {
          const errText = await sgResp.text();
          await logErrorToFirebase("Email Dispatch (SendGrid API)", new Error(`SendGrid HTTP ${sgResp.status}: ${errText}`), {
            statusCode: sgResp.status,
            recipients: allRecipients,
            from: fromAddr
          });
          return res.status(500).json({
            error: "Unable to send survey results email at this time. The issue has been logged for system administrators. Please try again later."
          });
        }

        console.log(`[EMAIL SENDGRID API SUCCESS] Sent to ${allRecipients.join(", ")}`);

        return res.json({
          success: true,
          mode: "live_sendgrid",
          message: `Survey results emailed to participant (${email}) and ${adminRecipients.length} configured recipient(s).`,
          recipients: allRecipients
        });
      }

      if (transportObj && transportObj.type === "smtp") {
        console.log(`[EMAIL SMTP] Dispatching results to ${allRecipients.join(", ")}...`);
        try {
          await transportObj.transporter.sendMail({
            from: fromAddr,
            to: allRecipients,
            subject,
            html: htmlContent
          });

          console.log(`[EMAIL SMTP SUCCESS] Sent to ${allRecipients.join(", ")}`);

          return res.json({
            success: true,
            mode: "live_smtp",
            message: `Survey results emailed to participant (${email}) and ${adminRecipients.length} configured recipient(s).`,
            recipients: allRecipients
          });
        } catch (smtpErr) {
          await logErrorToFirebase("Email Dispatch (SMTP)", smtpErr, {
            recipients: allRecipients,
            from: fromAddr
          });
          return res.status(500).json({
            error: "Unable to send survey results email via SMTP. The issue has been logged for system administrators. Please try again later."
          });
        }
      }

      // Demo / Local Mode logger when no SMTP or Email API keys are configured
      console.log("==========================================");
      console.log(`[AUTOMATED EMAIL SIMULATION MODE]`);
      console.log(`TO: ${allRecipients.join(", ")}`);
      console.log(`FROM: ${fromAddr}`);
      console.log(`SUBJECT: ${subject}`);
      console.log(`PARTICIPANT: ${payload.name} <${payload.email}>`);
      console.log(`TOP 5 GIFTS:`, payload.topGifts.map((g: any) => `${g.name} (${g.score}pts)`));
      console.log(`TOP 5 MINISTRIES:`, payload.topMinistryMatches.map((m: any) => m.teamName));
      console.log("==========================================");

      return res.json({
        success: true,
        mode: "simulated",
        message: `Results processed for ${email}. Email dispatch was simulated locally because no RESEND_API_KEY, SENDGRID_API_KEY, or SMTP environment variables are configured.`,
        recipients: allRecipients,
        htmlPreview: htmlContent
      });

    } catch (err: any) {
      await logErrorToFirebase("POST /api/send-results", err, { email: req.body?.email });
      res.status(500).json({ error: "Failed to send survey results email. Please try again later or contact support." });
    }
  });

  // POST /api/test-email
  app.post("/api/test-email", async (req, res) => {
    try {
      const { targetEmail } = req.body;
      const target = targetEmail || getStoredRecipients()[0] || "test@example.com";

      const samplePayload: SurveyEmailPayload = {
        name: "Test Participant",
        email: target,
        timestamp: new Date().toISOString(),
        topGifts: [
          { name: "Leadership", score: 10, scripture: "Romans 12:8", description: "The gift of setting goals and inspiring others." },
          { name: "Encouragement", score: 9, scripture: "Romans 12:8", description: "The gift of motivating and comforting others." },
          { name: "Teaching", score: 8, scripture: "Romans 12:7", description: "The ability to explain and apply God's Word." },
          { name: "Discernment", score: 8, scripture: "1 Corinthians 12:10", description: "The ability to distinguish truth." },
          { name: "Hospitality", score: 7, scripture: "1 Peter 4:9", description: "Making guests feel welcome." }
        ],
        topMinistryMatches: [
          { teamName: "Board of Elders", giftName: "Leadership" },
          { teamName: "Small Group Leader", giftName: "Encouragement" },
          { teamName: "Sunday School", giftName: "Teaching" },
          { teamName: "Prayer Team", giftName: "Discernment" },
          { teamName: "Greeters", giftName: "Hospitality" }
        ]
      };

      const htmlContent = generateResultsEmailHtml(samplePayload);
      const transportObj = createTransporter();

      if (process.env.RESEND_API_KEY) {
        const fromAddr = process.env.EMAIL_FROM || "Sanctuary Covenant Church <no-reply@app.sanctuarycov.org>";
        const resendResp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: fromAddr,
            to: [target],
            subject: "[TEST] Soul Discovery Email Notification System",
            html: htmlContent
          })
        });

        if (!resendResp.ok) {
          const errText = await resendResp.text();
          await logErrorToFirebase("Test Email Dispatch (Resend API)", new Error(`Resend HTTP ${resendResp.status}: ${errText}`), {
            statusCode: resendResp.status,
            targetEmail: target
          });
          return res.status(500).json({
            error: "Failed to send test email. Specific provider error details have been logged to Firebase."
          });
        }

        return res.json({ success: true, mode: "live_resend", message: `Test email sent via Resend API to ${target}` });
      }

      if (process.env.SENDGRID_API_KEY) {
        const fromAddr = process.env.EMAIL_FROM || "Sanctuary Covenant Church <no-reply@app.sanctuarycov.org>";
        const sgResp = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.SENDGRID_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: target }] }],
            from: { email: fromAddr.includes("<") ? fromAddr.split("<")[1].replace(">", "").trim() : fromAddr },
            subject: "[TEST] Soul Discovery Email Notification System",
            content: [{ type: "text/html", value: htmlContent }]
          })
        });

        if (!sgResp.ok) {
          const errText = await sgResp.text();
          await logErrorToFirebase("Test Email Dispatch (SendGrid API)", new Error(`SendGrid HTTP ${sgResp.status}: ${errText}`), {
            statusCode: sgResp.status,
            targetEmail: target
          });
          return res.status(500).json({
            error: "Failed to send test email. Specific provider error details have been logged to Firebase."
          });
        }

        return res.json({ success: true, mode: "live_sendgrid", message: `Test email sent via SendGrid API to ${target}` });
      }

      if (transportObj && transportObj.type === "smtp") {
        try {
          await transportObj.transporter.sendMail({
            from: process.env.EMAIL_FROM || "Sanctuary Covenant Church <no-reply@app.sanctuarycov.org>",
            to: target,
            subject: "[TEST] Soul Discovery Email Notification System",
            html: htmlContent
          });
          return res.json({ success: true, mode: "live_smtp", message: `Test email sent to ${target}` });
        } catch (smtpErr) {
          await logErrorToFirebase("Test Email Dispatch (SMTP)", smtpErr, { targetEmail: target });
          return res.status(500).json({
            error: "Failed to send test email via SMTP. Specific error details have been logged to Firebase."
          });
        }
      }

      return res.json({
        success: true,
        mode: "simulated",
        message: `Simulated test email generated for ${target}`,
        htmlPreview: htmlContent
      });
    } catch (err: any) {
      await logErrorToFirebase("POST /api/test-email", err, { targetEmail: req.body?.targetEmail });
      res.status(500).json({ error: "Failed to send test email. Error details have been logged to Firebase." });
    }
  });

  // Track event
  app.post("/api/track", (req, res) => {
    const event = req.body;
    console.log(`[ANALYTICS] Event tracked:`, event);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
