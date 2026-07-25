# Sanctuary Spiritual Gifts Discovery - Deployment & Domain Strategy

This document provides a complete step-by-step deployment guide for hosting the **Sanctuary Spiritual Gifts Discovery** app on Netlify, configuring the custom subdomain `app.sanctuarycov.org` on GoDaddy, and setting up Resend for automated email notifications.

---

## 📋 Strategy Overview

- **Frontend & App Host**: Netlify (`sccspiritualgiftssurvey.netlify.app`)
- **Custom Subdomain**: `app.sanctuarycov.org`
- **DNS Registrar / Provider**: GoDaddy (`sanctuarycov.org`)
- **Email Delivery API**: Resend (`resend.com`)
- **From Address**: `Sanctuary Covenant Church <no-reply@app.sanctuarycov.org>`

---

## 🌐 Part 1: GoDaddy Subdomain Creation & CNAME Mapping

Map `app.sanctuarycov.org` to your Netlify app (`sccspiritualgiftssurvey.netlify.app`).

### Step 1.1: Log into GoDaddy DNS Management
1. Go to [godaddy.com](https://www.godaddy.com) and log into the church account.
2. Navigate to **My Products** → locate **sanctuarycov.org**.
3. Click **DNS** or **Manage DNS** next to `sanctuarycov.org`.

### Step 1.2: Add the CNAME Record for the Subdomain
1. In the **DNS Records** table, click **Add New Record**.
2. Set the field values as follows:
   - **Type**: `CNAME`
   - **Name**: `app`
   - **Value / Target**: `sccspiritualgiftssurvey.netlify.app`
   - **TTL**: `1 Hour` (or `Default`)
3. Click **Save** (or **Save All Changes**).

---

## 🚀 Part 2: Netlify Custom Domain & SSL Setup

### Step 2.1: Add Domain to Netlify
1. Log into your [Netlify Dashboard](https://app.netlify.app).
2. Select the site `sccspiritualgiftssurvey`.
3. Go to **Site Configuration** → **Domain Management**.
4. Click **Add custom domain**.
5. Enter `app.sanctuarycov.org` and click **Verify**.
6. When asked if you are the owner of `sanctuarycov.org`, click **Yes, add domain**.

### Step 2.2: HTTPS / SSL Provisioning
1. Netlify will automatically detect the CNAME record from GoDaddy and request a free Let's Encrypt SSL certificate.
2. Under **HTTPS**, verify that SSL is marked as **Active**. (If it shows pending, wait a few minutes and click *Verify DNS Configuration*).

---

## 📧 Part 3: Adding `app.sanctuarycov.org` to Resend for Email Sending

Set up domain authentication in Resend so emails sent to survey takers and church leadership deliver reliably without being flagged as spam.

### Step 3.1: Add Domain in Resend
1. Log into [resend.com](https://resend.com).
2. Click **Domains** in the sidebar → click **Add Domain**.
3. Enter `app.sanctuarycov.org` in the domain field.
4. Select your preferred region (e.g. `us-east-1` United States) and click **Add**.

### Step 3.2: Copy Resend DNS Verification Records
Resend will generate 3 DNS records for domain verification and DKIM signing:
1. **DKIM Record**: Type `TXT` or `CNAME` (e.g. Name: `resend._domainkey.app`, Value: `p=MIGfMA0GCS...`)
2. **SPF / Return-Path Record**: Type `MX` or `CNAME` (e.g. Name: `bounces.app`, Value: `feedback-smtp.us-east-1.amazonses.com`)
3. **Verification Record**: Type `TXT` (e.g. Name: `app`, Value: `resend-verification=...`)

### Step 3.3: Add Resend Verification Records to GoDaddy
1. Return to your GoDaddy **DNS Management** page for `sanctuarycov.org`.
2. Click **Add New Record** for each record provided by Resend:
   - **DKIM TXT/CNAME**: 
     - *Type*: `TXT` (or `CNAME` as specified by Resend)
     - *Name*: `resend._domainkey.app`
     - *Value*: *(Paste exact value from Resend)*
   - **SPF/Return-Path**:
     - *Type*: `MX` or `CNAME`
     - *Name*: `bounces.app`
     - *Value*: *(Paste exact value from Resend)*
   - **TXT Verification**:
     - *Type*: `TXT`
     - *Name*: `app`
     - *Value*: *(Paste exact value from Resend)*
3. Click **Save** for each record.

### Step 3.4: Verify Domain in Resend
1. Go back to the Resend **Domains** page.
2. Click **Verify Domain**.
3. Once all records show a green **Verified** status, domain setup is complete.

---

## 🔑 Part 4: Netlify Environment Variable Configuration

To enable automated email sending on your live app, configure the environment variables in Netlify:

1. In Netlify, go to **Site Configuration** → **Environment Variables**.
2. Click **Add a variable** and add:
   - `RESEND_API_KEY`: *(Your live API key starting with `re_...` from Resend)*
   - `EMAIL_FROM`: `Sanctuary Covenant Church <no-reply@app.sanctuarycov.org>`
3. Save the variables and trigger a redeploy of your Netlify site.

---

## 🧪 Part 5: Verification & Testing

1. **Web App Check**: Visit `https://app.sanctuarycov.org` in your browser. Verify it loads with a secure HTTPS lock icon.
2. **Email Test**:
   - Access the Admin Dashboard at `https://app.sanctuarycov.org` (Shield icon in bottom right).
   - Go to **Email Notifications** tab.
   - Click **Send Sample Report** under Test Email Generator.
   - Confirm receipt of the formatted Top 5 Gifts & Top 5 Ministry Matches report.
