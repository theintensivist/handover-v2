/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PatientData } from "../types";

export function buildPatientMarkdown(p: PatientData): string {
  const notes = p.dailyNotes || { cns: "", cvs: "", rs: "", renal: "", git: "", heme: "", idStewardship: "", other: "" };
  const fh = p.fasthugbid;

  let md = `# ICU CLINICAL HANDOVER ARCHIVE: ${p.name || "UNNAMED PATIENT"}
**Confidential ICU Clinical Worksheet**  
*Generated on:* ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}  
*Patient Reference ID:* ${Math.random().toString(36).substr(2, 9).toUpperCase()}

---

## 1. DEMOGRAPHIC & BASELINE DATA
| Metric | Detail |
| :--- | :--- |
| **Patient Name** | ${p.name || "N/A"} |
| **Bed Number** | Bed ${p.bed || "TBD"} |
| **MRN (Medical Record Number)** | ${p.mrn || "N/A"} |
| **Age / Gender** | ${p.age || "--"} years / ${p.gender || "Other"} |
| **Admission Date** | ${p.admissionDate || "N/A"} |
| **Primary ICU Diagnosis** | ${p.diagnosis || "No primary diagnosis recorded."} |

---

## 2. CLINICAL HANDOVER (ISBAR FRAMEWORK)
### [I] IDENTIFY
${p.isbar?.identify || "No identification info recorded."}

### [S] SITUATION
${p.isbar?.situation || "No situation info recorded."}

### [B] BACKGROUND
${p.isbar?.background || "No clinical background info recorded."}

### [A] ASSESSMENT
${p.isbar?.assessment || "No active assessment recorded."}

### [R] RECOMMENDATIONS
${p.isbar?.recommendation || "No recommendation or shift tasks recorded."}

---

## 3. FASTHUG-BID SAFETY CHECKLIST
| Parameter | Status | Clinician Notes & Plan |
| :--- | :--- | :--- |
| **[F] Feeding / Nutrition** | ${fh?.feeding ? "✅ Active" : "❌ Not Active"} | ${fh?.feedingNotes || "N/A"} |
| **[A] Analgesia** | ${fh?.analgesia ? "✅ Active" : "❌ Not Active"} | ${fh?.analgesiaNotes || "N/A"} |
| **[S] Sedation** | ${fh?.sedation ? "✅ Active" : "❌ Not Active"} | ${fh?.sedationNotes || "N/A"} |
| **[T] Thromboembolism Prophylaxis** | ${fh?.thrombo ? "✅ Active" : "❌ Not Active"} | ${fh?.thromboNotes || "N/A"} |
| **[H] Head Up 30-45°** | ${fh?.headUp ? "✅ Active" : "❌ Not Active"} | ${fh?.headUpNotes || "N/A"} |
| **[U] Ulcer Prophylaxis** | ${fh?.ulcer ? "✅ Active" : "❌ Not Active"} | ${fh?.ulcerNotes || "N/A"} |
| **[G] Glycemic Control** | ${fh?.glycemic ? "✅ Active" : "❌ Not Active"} | ${fh?.glycemicNotes || "N/A"} |
| **[B] Bowel Care** | ${fh?.bowel ? "✅ Active" : "❌ Not Active"} | ${fh?.bowelNotes || "N/A"} |
| **[I] Indwelling Catheters** | ${fh?.indwelling ? "✅ Active" : "❌ Not Active"} | ${fh?.indwellingNotes || "N/A"} |
| **[D] De-escalation Plan** | ${fh?.deescalation ? "✅ Active" : "❌ Not Active"} | ${fh?.deescalationNotes || "N/A"} |

---

## 4. SYSTEM-WISE DETAILS & DAILY NOTES

### 🧠 NEUROLOGY (CNS)
* **Status:** ${p.systems?.cns?.status || "Stable"}
* **GCS:** ${p.systems?.cns?.gcs || "15/15"}
* **Sedation Target (RASS):** ${p.systems?.cns?.rass || "0"}
* **Pupil Reflexes:** ${p.systems?.cns?.pupils || "N/A"}
* **ICP (mmHg):** ${p.systems?.cns?.icp || "N/A"}
* **Daily CNS Note:**  
  ${notes.cns || "*No progress note added.*"}

### ❤️ CARDIOVASCULAR (CVS)
* **Status:** ${p.systems?.cvs?.status || "Stable"}
* **HR (bpm):** ${p.systems?.cvs?.hr || "N/A"}
* **BP (mmHg):** ${p.systems?.cvs?.bp || "N/A"}
* **MAP (mmHg):** ${p.systems?.cvs?.map || "N/A"}
* **Rhythm / Lactate:** ${p.systems?.cvs?.rhythm || "N/A"} / ${p.systems?.cvs?.lactate || "N/A"}
* **Daily CVS Note:**  
  ${notes.cvs || "*No progress note added.*"}

### 🫁 RESPIRATORY SYSTEM (RS)
* **Status:** ${p.systems?.rs?.status || "Stable"}
* **Ventilation Mode:** ${p.systems?.rs?.mode || "Spontaneous"}
* **PEEP / FiO2:** ${p.systems?.rs?.peep || "N/A"} cmH2O / ${p.systems?.rs?.fio2 || "N/A"}%
* **RR (bpm) / SpO2:** ${p.systems?.rs?.rr || "N/A"} / ${p.systems?.rs?.spo2 || "N/A"}%
* **Daily RS Note:**  
  ${notes.rs || "*No progress note added.*"}

### 🧪 RENAL & ELECTROLYTES
* **Status:** ${p.systems?.renal?.status || "Stable"}
* **Urine Output:** ${p.systems?.renal?.uo || "N/A"}
* **Creatinine (mg/dL):** ${p.systems?.renal?.creatinine || "N/A"}
* **Daily Renal Note:**  
  ${notes.renal || "*No progress note added.*"}

### 消化 GASTROINTESTINAL (GIT) & NUTRITION
* **Status:** ${p.systems?.git?.status || "Stable"}
* **Diet / Nutrition Goal:** ${p.systems?.git?.diet || "N/A"} / ${p.systems?.git?.nutritionGoal || "N/A"}
* **Last Bowel Movement:** ${p.systems?.git?.bowelMovement || "N/A"}
* **Abdominal Assessment:** ${p.systems?.git?.abdominalExam || "N/A"}
* **Daily GIT Note:**  
  ${notes.git || "*No progress note added.*"}

### 🩸 HEMATOLOGY & TRANSFUSION
* **Status:** ${p.systems?.heme?.status || "Stable"}
* **Hemoglobin (g/dL):** ${p.systems?.heme?.hb || "N/A"}
* **Platelets (x10^3/uL):** ${p.systems?.heme?.plt || "N/A"}
* **Coagulation Profile (TEG):** ${p.systems?.heme?.coagulopathyTEG || "N/A"}
* **Daily Heme Note:**  
  ${notes.heme || "*No progress note added.*"}

### 🦠 ID STEWARDSHIP & MICROBIOLOGY
* **Daily ID Note:**  
  ${notes.idStewardship || "*No progress note added.*"}

#### Active Antimicrobial Regimens
${
  p.systems?.idStewardship?.antibioticsList && p.systems.idStewardship.antibioticsList.length > 0
    ? "| Antimicrobial | Dose | Frequency | Type | Started Date |\n| :--- | :--- | :--- | :--- | :--- |\n" +
      p.systems.idStewardship.antibioticsList
        .map(
          (ab) =>
            `| **${ab.name}** | ${ab.dose} | ${ab.frequency} | ${ab.type} | ${ab.startedDate} |`
        )
        .join("\n")
    : "*No active antimicrobial therapies.*"
}

#### Cultures & Microbiology Surveillance
${
  p.systems?.idStewardship?.culturesList && p.systems.idStewardship.culturesList.length > 0
    ? "| Specimen Site | Culture Date | Isolated Organism | Active Susceptibility |\n| :--- | :--- | :--- | :--- |\n" +
      p.systems.idStewardship.culturesList
        .map(
          (c) =>
            `| **${c.site}** | ${c.date} | *${c.organism}* | ${
              c.sensitiveAntibiotics && c.sensitiveAntibiotics.length > 0
                ? c.sensitiveAntibiotics.join(", ")
                : "None"
            } |`
        )
        .join("\n")
    : "*No active culture reports found.*"
}

---

## 5. RECENT PROCEDURES DONE
${
  p.procedures && p.procedures.length > 0
    ? "| Procedure | Date | Clinician / Operator | Critical Findings / Notes |\n| :--- | :--- | :--- | :--- |\n" +
      p.procedures
        .map(
          (proc) =>
            `| **${proc.name === "Other" ? (proc.customName || "Other") : proc.name}** | ${
              proc.date
            } | ${proc.operator || "N/A"} | ${proc.findings || "None"} |`
        )
        .join("\n")
    : "*No major procedures registered.*"
}

---

## 6. CLINICAL INFUSION DRUGS
${
  p.infusions && p.infusions.length > 0
    ? "| Medication | Amount | Diluent Volume | Rate (mL/hr) | Calculated Patient Dose |\n| :--- | :--- | :--- | :--- | :--- |\n" +
      p.infusions
        .map(
          (inf) =>
            `| **${inf.name}** | ${inf.amount} | ${inf.volume} mL | ${inf.rate} | ${inf.calculatedDose} |`
        )
        .join("\n")
    : "*No active vasoactive or sedative infusions mapped.*"
}

---

## 7. CRITICAL CARE EVENTS LOG
${
  p.criticalEvents && p.criticalEvents.length > 0
    ? "| Timestamp | Event Description | Action Taken | Clinical Outcome |\n| :--- | :--- | :--- | :--- |\n" +
      p.criticalEvents
        .map(
          (ev) =>
            `| *${ev.timestamp}* | **${ev.description}** | ${ev.actionTaken || "N/A"} | ${
              ev.outcome || "N/A"
            } |`
        )
        .join("\n")
    : "*No acute critical events reported during this admission.*"
}

---

## 8. SPECIALTY REFERRALS & CONSULTATIONS
${
  p.referrals && p.referrals.length > 0
    ? p.referrals
        .map(
          (ref) =>
            `### Specialty: **${ref.specialty}**  
*Status:* \`${ref.status}\` | *Requested Date:* ${ref.dateRequested}  
**Reason for Consultation:**  
${ref.reasonForConsult}  
${
  ref.reviews && ref.reviews.length > 0
    ? "**Reviews & Recommendations:**\n" +
      ref.reviews
        .map((rev) => `- *[${rev.reviewerRole}]:* ${rev.notes} (${rev.timestamp})`)
        .join("\n")
    : "*Pending Consultant input.*"
}`
        )
        .join("\n\n---\n\n")
    : "*No active specialty consults on file.*"
}

---

## 9. DISCHARGE PLANNING SUMMARY
* **Discharge Clinical Advices:**  
  ${p.dischargeSummary?.dischargeAdvices || "*No advices on file.*"}
* **Consults Requested on Discharge:**  
  ${p.dischargeSummary?.consults || "*No consults on file.*"}
* **Planned Follow-up Plan:**  
  ${p.dischargeSummary?.followup || "*No follow-up registered.*"}

---

**DISCLAIMER:** This is an automatically compiled clinical archive from CritiSync ICU Handover & Safety Workspace. 
The clinician remains fully responsible for verifying clinical details.
`;

  return md;
}
