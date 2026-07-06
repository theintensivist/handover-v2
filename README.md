# ICU Handover System — Vercel Deployment Guide

This application is fully prepared and optimized for direct deployment to **Vercel** as a full-stack application (Vite Frontend + Serverless API Functions). 

By utilizing the Vercel CLI, you can deploy this applet directly from your local machine/workspace **without needing to configure GitHub repositories, OAuth pipelines, or custom Git integrations**.

---

## 🚀 Step-by-Step Direct Vercel Deployment

Follow these simple steps to deploy the application directly using the Vercel CLI:

### 1. Install the Vercel CLI
If you do not have the Vercel CLI installed, install it globally on your system:
```bash
npm install -g vercel
```

### 2. Log In to Vercel
Authenticate the CLI with your Vercel account:
```bash
vercel login
```

### 3. Initialize and Deploy (Development/Preview)
Run the `vercel` command from the root directory of the project. This command will walk you through a quick configuration wizard:
```bash
vercel
```
During the wizard:
1. **Set up and deploy?** Yes (`y`)
2. **Which scope?** (Select your Vercel personal account or team)
3. **Link to existing project?** No (`n`)
4. **What's your project's name?** `icu-handover-system` (or your preferred name)
5. **In which directory is your code located?** `./` (Press Enter)
6. **Auto-detected framework settings?** The CLI will automatically detect **Vite**. When asked if you want to modify settings, answer No (`n`).

*Vercel will build the project and deploy a Preview deployment.*

### 4. Configure Environment Secrets
This application utilizes Gemini AI to summarize patient handover reports. You need to configure your **Gemini API Key** in your Vercel dashboard:
```bash
vercel env add GEMINI_API_KEY
```
*When prompted, enter your secret Google Gemini API key.*

### 5. Deploy to Production
To make your deployment public and finalize your URL, trigger a production build:
```bash
vercel --prod
```

---

## 🛠️ How Vercel Deployment Works Under the Hood

The repository has been configured with native Vercel-compatible routing and build specifications:

1. **Static Frontend Compilation**: Vercel automatically runs the `"build"` command in `package.json` to compile the Vite application into static files under the `dist/` directory.
2. **Serverless API Layer**: The serverless handler located inside `/api/summarize.ts` is automatically compiled and hosted as a secure, stateless Vercel Serverless Function under the `/api/summarize` route.
3. **SPA Router Handshake (`vercel.json`)**:
   - Requests targeting `/api/*` are securely routed directly to the backend serverless functions.
   - All other routes are elegantly rewritten to `/index.html` to allow the client-side router to manage page transitions seamlessly.
4. **Environment Variables**: The backend reads `process.env.GEMINI_API_KEY` securely from Vercel's encrypted environment variables store, keeping your API secrets completely safe from client browsers.
