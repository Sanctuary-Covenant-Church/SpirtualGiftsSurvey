# Spiritual Gifts Discovery - Developer Documentation

Welcome to the **Spiritual Gifts Discovery** application. This project is built for Sanctuary Covenant Church to help users identify their spiritual gifts and find meaningful service roles.

## 🚀 Quick Start

1. **Install Dependencies**: `npm install`
2. **Setup Firebase**: Ensure `firebase-applet-config.json` is present in the root.
3. **Run Dev Server**: `npm run dev` (starts the Express + Vite hybrid server on port 3000)
4. **Build for Production**: `npm run build`

## 🏗️ Architecture

The app uses a **Full-Stack (Hybrid)** architecture:
- **Frontend**: React 19 + TypeScript + Vite.
- **Backend**: Express.js server (`server.ts`) which handles:
  - Vite middleware serving the SPA during development.
  - API routes for tracked analytics and mocked email services.
- **Database/Auth**: Firebase (Firestore & Authentication).

## 📂 Codebase Structure

- `/src/App.tsx`: The heart of the application. Manages the survey state machine (Hero -> Survey -> Result) and integrates Firebase listeners for questions and gifts.
- `/src/components/AdminDashboard.tsx`: A secure interface for "Curators" to manage the survey pool, gift definitions, and view operational analytics.
- `/src/lib/firebase.ts`: Centralized Firebase SDK initialization.
- `/src/constants.ts`: Contains the *seed data*. These are used as fallbacks if the Firestore collections are empty.
- `/src/types.ts`: Global TypeScript interfaces for strict typing of Gifts, Questions, and Results.
- `/server.ts`: The entry point for the Node.js environment.

## 🎨 Design System: "Clean Minimalism"

The app follows a bespoke "Clean Minimalism" aesthetic defined in `src/index.css`:
- **Typography**: Uses *Playfair Display* (Serif Italic) for headers and *Inter* (Sans) for UI.
- **Palette**: Organic tones (`#FDFCFB` background, `#2D2926` text, `#5B634E` Sage accent).
- **Styling**: Powered by **Tailwind CSS 4** using CSS-variable-based theming.

## 🗄️ Database & Security

### Firestore Collections
1. `gifts`: Definitions of gifts, descriptions, and mapped service teams.
2. `questions`: The survey question pool, each mapped to a `giftId`.
3. `results`: Immutable records of user completions.
4. `analytics`: Event stream (starts, finishes, CTA clicks).
5. `admins`: A whitelist of UIDs allowed to access the dashboard.

### Security Rules
Found in `firestore.rules`. Access to the `admins` collection and write access to `gifts/questions` is strictly restricted to the administrative email `cdonyi@gmail.com` or UIDs present in the `admins` collection.

## 🛠️ Admin Dashboard
To access the admin dashboard:
1. Click the subtle **Shield Icon** in the bottom-right corner of the landing page.
2. Login with the authorized Google account.
3. You can now add/edit/delete questions and gifts in real-time. Changes are reflected instantly for users via Firestore's `onSnapshot` listeners.

## 📈 Analytics tracking
The application tracks:
- `survey_start`: Triggered when "Begin Journey" is clicked.
- `survey_complete`: Triggered when result is calculated.
- `cta_click`: Tracked when users click to "Join a Team".
- `page_view`: General navigation tracking.

All events are stored in the `analytics` collection for future conversion rate optimization.
