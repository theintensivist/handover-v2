/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

// Load environment variables in local dev
dotenv.config();

const app = express();
const PORT = 3000;

// Enable JSON parser with high limit for base64 clinical images
app.use(express.json({ limit: "50mb" }));

// Stateless server-side Gemini proxy to ensure patient data remains encrypted in DB
// and is only sent in-memory over SSL to the AI for summarizing.
app.post("/api/summarize", async (req, res) => {
  const { patient, summaryType, customApiKey } = req.body;
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "Gemini API key is missing. Please enter your custom Gemini API key in the UI, or configure your GEMINI_API_KEY on the server."
    });
  }

  if (!patient) {
    return res.status(400).json({ error: "Patient data is required for summarizing." });
  }

  try {
    // Lazy initialization of GoogleGenAI SDK
    const ai = new GoogleGenAI({ apiKey });

    // Format a structured summary prompt based on the requested type
    let promptTypeTitle = "ICU Clinical Case Summary";
    let instructions = "";

    if (summaryType === "discharge") {
      promptTypeTitle = "Formal ICU Hospital Discharge Summary";
      instructions = `
        Create a formal, highly professional medical discharge summary for this ICU patient. 
        It must be structured like an official hospital record.
        Include sections:
        - Patient Identification & Demographics
        - Admission Diagnosis & Primary Reason for ICU Admission
        - ICU Clinical Course (Summarized by organ systems based on the system comments and daily changeable progress notes provided: CNS, CVS, Respiratory, Renal, GIT, Hematology/Infectious, Endocrine, and Antimicrobial Stewardship)
        - Antimicrobial Therapy & Culture History (List active empirical, prophylactic, or targeted antibiotics, culture sites, date of cultures, organisms isolated, and antibiotic sensitivity patterns)
        - FASTHUG-BID Prophylaxis & Care Summary
        - Active Infusions & Dose Calculations
        - Procedures Performed & Shift Events log
        - Calculators Summary (BMI, Creatinine Clearance, Corrected Calcium, SOFA score)
        - Daily Updates & Handovers Timeline (Chronological timeline of shift handovers and critical changes)
        - Discharge Plan & Post-ICU Recommendations (Medication de-escalation, follow-ups, parameters to monitor)
      `;
    } else if (summaryType === "handover") {
      promptTypeTitle = "ICU Shift-to-Shift Handover Sheet (ISBAR)";
      instructions = `
        Create a concise, action-oriented shift handover report tailored for a clinical team.
        Focus heavily on active issues, clinical alerts, and pending handoff tasks.
        Organize using a highly legible, medical ISBAR style:
        - **I (Identify)**: Quick patient demographic summary.
        - **S (Situation)**: High-priority clinical alert, active problems, and current ICU state.
        - **B (Background)**: Brief background, primary diagnosis, and history.
        - **A (Assessment)**: Current system-by-system status (CNS, CVS, Respiratory, Renal, GIT, Heme, Endo, and ID Stewardship) focusing on abnormal values, active infusions, calculators, active antimicrobial list (empirical/targeted/prophylactic), culture site results, and daily changeable progress notes.
        - **R (Recommendation)**: A prioritized bulleted checklist of pending tasks, monitoring plans, and clinical goals for the incoming shift.
        - **Timeline Logs**: Mention the latest shift timeline updates and time-wise handovers recorded.
      `;
    } else {
      promptTypeTitle = "Comprehensive ICU Patient Profile Review";
      instructions = `
        Create an extensive, system-by-system profile review of the patient's current ICU state.
        Organize by organ system, detailing:
        - CNS / Neurological assessment
        - CVS / Cardiovascular (including MAP, HR, BP, and vasoactive drug infusion rates)
        - RS / Respiratory (including ventilator settings, FiO2, PEEP, and oxygenation)
        - Renal / Electrolytes (including creatinine clearance, corrected calcium, and urine output)
        - GIT / Nutrition (diet status and FASTHUG-BID parameters)
        - Hematology / Infectious (temperatures, blood counts)
        - Infectious Diseases Stewardship (Detailed antimicrobial list, empirical/targeted/prophylactic choices, culture sites, date of culture, isolated pathogens, and sensitivity checklist)
        - Daily Changeable Progress Notes & Handovers History (Chronological timeline summary of daily system-wise updates)
        - Active clinical issues, procedures performed, and dynamic calculations (SOFA, BMI).
      `;
    }

    const patientText = JSON.stringify(patient, null, 2);

    const fullPrompt = `
      You are an expert senior ICU intensivist and clinical informaticist.
      Generate a ${promptTypeTitle} based on the decrypted medical record provided below.
      
      CRITICAL GUIDELINES:
      - Maintain a professional, objective, and clinically precise medical tone.
      - Use standard medical abbreviations appropriately (e.g., AKI, HFNC, MAP, RASS, GCS, CrCl).
      - Bold key parameters and abnormal values.
      - If there are active vasoactive drug infusions, highlight their calculated rates and doses.
      - Ensure all content is structured elegantly in clean, highly scannable Markdown (using clear headers, lists, and tables where helpful).
      - Do NOT mention anything about "JSON payload", "encrypted blobs", "decryption", or "database storage". The final document must read like a direct clinical record.

      PATIENT CLINICAL RECORD:
      \`\`\`json
      ${patientText}
      \`\`\`

      GENERATION INSTRUCTIONS:
      ${instructions}
    `;

    // Call Gemini API using the model gemini-2.5-flash as recommended
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: fullPrompt,
    });

    const summaryText = response.text || "Unable to generate summary.";
    return res.json({ summary: summaryText });

  } catch (error: any) {
    console.error("Gemini summary generation failed:", error);
    return res.status(500).json({
      error: `Gemini API call failed: ${error.message || error}`
    });
  }
});

// Setup development dev server or production static serving
async function bootstrapServer() {
  if (process.env.NODE_ENV !== "production") {
    // Import Vite createServer dynamically in development
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[ICU Server] Full-stack engine running on http://0.0.0.0:${PORT}`);
  });
}

bootstrapServer().catch((err) => {
  console.error("Failed to start full-stack server:", err);
});
