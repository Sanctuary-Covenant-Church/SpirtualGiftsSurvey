/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Proxy for sending emails (mocked)
  app.post("/api/send-results", async (req, res) => {
    const { email, result } = req.body;
    console.log(`[EMAIL MOCK] Sending spiritual gift results to ${email}:`, result);
    
    // In a real app, you would integrate with SendGrid, Mailgun, or AWS SES here.
    // Example: sendgrid.send({...})
    
    res.json({ success: true, message: "Results sent successfully." });
  });

  // Track event (mocked analytics)
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
