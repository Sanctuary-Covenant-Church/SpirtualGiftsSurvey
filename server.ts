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

// Helper to ensure data directory exists
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
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
  return ["cdonyi@gmail.com", "leadership@sanctuarycov.org"];
}

// Save recipient emails
function saveStoredRecipients(recipients: string[]) {
  ensureDataDir();
  const clean = Array.from(new Set(recipients.map(e => e.trim().toLowerCase()))).filter(Boolean);
  fs.writeFileSync(RECIPIENTS_FILE, JSON.stringify({ recipients: clean, lastUpdated: new Date().toISOString() }, null, 2));
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
    const recipients = getStoredRecipients();
    const hasSmtp = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
    const hasResend = Boolean(process.env.RESEND_API_KEY);
    const hasSendGrid = Boolean(process.env.SENDGRID_API_KEY);

    let provider = "Demo / Local Log Mode";
    if (hasSmtp) provider = `SMTP (${process.env.SMTP_HOST})`;
    else if (hasResend) provider = "Resend API";
    else if (hasSendGrid) provider = "SendGrid API";

    res.json({
      configured: hasSmtp || hasResend || hasSendGrid,
      provider,
      from: process.env.EMAIL_FROM || "Sanctuary Covenant Church <no-reply@sanctuarycov.org>",
      recipients
    });
  });

  // POST /api/email-config
  app.post("/api/email-config", (req, res) => {
    const { recipients } = req.body;
    if (!Array.isArray(recipients)) {
      return res.status(400).json({ error: "Recipients must be an array of email strings." });
    }
    const updated = saveStoredRecipients(recipients);
    res.json({ success: true, recipients: updated });
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
      const fromAddr = process.env.EMAIL_FROM || "Sanctuary Covenant Church <no-reply@sanctuarycov.org>";

      const transportObj = createTransporter();

      if (process.env.RESEND_API_KEY) {
        console.log(`[EMAIL RESEND API] Sending results to ${allRecipients.join(", ")}...`);
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
          throw new Error(`Resend API Error: ${errText}`);
        }

        return res.json({
          success: true,
          mode: "live_resend",
          message: `Survey results emailed via Resend API to participant (${email}) and ${adminRecipients.length} configured recipient(s).`,
          recipients: allRecipients
        });
      }

      if (transportObj && transportObj.type === "smtp") {
        console.log(`[EMAIL SMTP] Sending results to ${allRecipients.join(", ")}...`);
        await transportObj.transporter.sendMail({
          from: fromAddr,
          to: allRecipients,
          subject,
          html: htmlContent
        });

        return res.json({
          success: true,
          mode: "live_smtp",
          message: `Survey results emailed to participant (${email}) and ${adminRecipients.length} configured recipient(s).`,
          recipients: allRecipients
        });
      }

      // Demo / Local Mode logger when no SMTP keys are configured
      console.log("==========================================");
      console.log(`[AUTOMATED EMAIL SIMULATION]`);
      console.log(`TO: ${allRecipients.join(", ")}`);
      console.log(`FROM: ${fromAddr}`);
      console.log(`SUBJECT: ${subject}`);
      console.log(`PARTICIPANT: ${payload.name} <${payload.email}>`);
      console.log(`TOP 5 GIFTS:`, payload.topGifts.map(g => `${g.name} (${g.score}pts)`));
      console.log(`TOP 5 MINISTRIES:`, payload.topMinistryMatches.map(m => m.teamName));
      console.log("==========================================");

      return res.json({
        success: true,
        mode: "simulated",
        message: `Results processed for ${email} and sent to configured notification list.`,
        recipients: allRecipients,
        htmlPreview: htmlContent
      });

    } catch (err: any) {
      console.error("Error sending survey result email:", err);
      res.status(500).json({ error: err.message || "Failed to send results email." });
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
        const fromAddr = process.env.EMAIL_FROM || "Sanctuary Covenant Church <no-reply@sanctuarycov.org>";
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
          throw new Error(`Resend API Error: ${errText}`);
        }

        return res.json({ success: true, mode: "live_resend", message: `Test email sent via Resend API to ${target}` });
      }

      if (transportObj && transportObj.type === "smtp") {
        await transportObj.transporter.sendMail({
          from: process.env.EMAIL_FROM || "Sanctuary Covenant Church <no-reply@sanctuarycov.org>",
          to: target,
          subject: "[TEST] Soul Discovery Email Notification System",
          html: htmlContent
        });
        return res.json({ success: true, mode: "live_smtp", message: `Test email sent to ${target}` });
      }

      return res.json({
        success: true,
        mode: "simulated",
        message: `Simulated test email generated for ${target}`,
        htmlPreview: htmlContent
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to send test email." });
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
