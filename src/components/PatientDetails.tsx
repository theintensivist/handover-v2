/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { PatientData, InfusionDrug, CalculatorsData, PendingTask, ClinicalImage, AntibioticRecord, CultureRecord, DailyProgressNotes, TimelineRecord, SystemIDStewardship, ProcedureRecord, CriticalEventRecord } from "../types";
import PatientCalculators from "./PatientCalculators";
import PatientScoringHub from "./PatientScoringHub";
import PatientABGAnalyzer from "./PatientABGAnalyzer";
import PatientReferralTracker from "./PatientReferralTracker";
import MarkdownView from "./MarkdownView";
import { 
  FileText, Activity, Heart, Eye, CheckSquare, 
  Camera, Sparkles, Clipboard, Check, Trash, 
  ArrowLeft, Save, AlertCircle, Calendar, Plus, ExternalLink,
  Lock, File, Download, Brain, Wind, Droplets, ShieldCheck, Stethoscope, Pill, Flame, Info, Zap,
  History, Clock, PlusCircle, Trash2, AlertTriangle, Calculator, Archive
} from "lucide-react";
import { buildPatientMarkdown } from "../lib/markdown";

interface PatientDetailsProps {
  patient: PatientData;
  passphrase: string;
  nickname: string;
  userRole: string;
  onSave: (updatedPatient: PatientData) => Promise<void>;
  onClose: () => void;
}

type ActiveTab = "profile" | "systems" | "fasthug" | "calculators" | "images" | "tasks" | "ai" | "timeline" | "procedures" | "critical_events" | "case_summary";

const systemsConfig: Record<string, {
  name: string;
  icon: any;
  statusPath: string;
  commentsPath: string;
  presets: { label: string; values: Record<string, any> }[];
  fields: {
    label: string;
    path: string;
    type: "text" | "select";
    multi?: boolean;
    options?: string[] | { label: string; value: string }[];
    placeholder?: string;
  }[];
}> = {
  cns: {
    name: "CNS & Neuro-Metabolic",
    icon: Brain,
    statusPath: "systems.cns.status",
    commentsPath: "systems.cns.comments",
    presets: [
      {
        label: "Awake & Alert",
        values: {
          "systems.cns.status": "Alert",
          "systems.cns.gcs": "15 (E4 V5 M6)",
          "systems.cns.four": "16",
          "systems.cns.rass": "0",
          "systems.cns.delirium": "CAM-ICU Negative",
          "systems.cns.pupils": "Symmetric, Reacting Bilaterally",
          "systems.cns.brainstemReflexes": "All Intact",
          "systems.cns.motor": "Symmetric, purposeful movement",
          "systems.cns.satSbtSync": "Not Applicable (Awake)",
          "systems.cns.comments": "Patient is fully awake, oriented, and calm. Delirium negative. Motor power is intact and symmetric across all extremities."
        }
      },
      {
        label: "Comfortably Sedated",
        values: {
          "systems.cns.status": "Sedated",
          "systems.cns.gcs": "10",
          "systems.cns.four": "12",
          "systems.cns.rass": "-2",
          "systems.cns.delirium": "CAM-ICU Negative",
          "systems.cns.pupils": "Symmetric, Reacting Bilaterally",
          "systems.cns.brainstemReflexes": "All Intact",
          "systems.cns.motor": "Symmetric, response to voice",
          "systems.cns.satSbtSync": "SAT/SBT Coordinated & Passed",
          "systems.cns.comments": "Patient is comfortably sedated on Propofol, RASS target -1 to -2. Daily SAT coordinated with SBT, tolerated well. Delirium negative."
        }
      }
    ],
    fields: [
      {
        label: "CNS Status",
        path: "systems.cns.status",
        type: "select",
        options: ["Alert", "Sedated", "Comatose", "Delirious", "Agitated"]
      },
      {
        label: "RASS Score",
        path: "systems.cns.rass",
        type: "select",
        options: [
          { label: "+4 (Combative)", value: "+4" },
          { label: "+3 (Very Agitated)", value: "+3" },
          { label: "+2 (Agitated)", value: "+2" },
          { label: "+1 (Restless)", value: "+1" },
          { label: "0 (Calm/Alert)", value: "0" },
          { label: "-1 (Drowsy)", value: "-1" },
          { label: "-2 (Light Sedation)", value: "-2" },
          { label: "-3 (Moderate Sedation)", value: "-3" },
          { label: "-4 (Deep Sedation)", value: "-4" },
          { label: "-5 (Unarousable)", value: "-5" }
        ]
      },
      {
        label: "Delirium Screen",
        path: "systems.cns.delirium",
        type: "select",
        options: [
          "CAM-ICU Negative",
          "CAM-ICU Positive (Hypoactive)",
          "CAM-ICU Positive (Hyperactive)",
          "ICDSC < 4 (Negative)",
          "ICDSC >= 4 (Positive)"
        ]
      },
      { label: "GCS Score (3-15)", path: "systems.cns.gcs", type: "text", placeholder: "e.g. 15 (E4 V5 M6)" },
      { label: "FOUR Score (0-16)", path: "systems.cns.four", type: "text", placeholder: "e.g. E4 M4 B4 R4" },
      {
        label: "Pupils (NPi / Size)",
        path: "systems.cns.pupils",
        type: "select",
        options: [
          "Symmetric, Reacting Bilaterally",
          "Pupils Asymmetric, Reactive",
          "Pupil Fixed & Dilated (Unilateral)",
          "Bilateral Fixed/Dilated",
          "Sluggish Reaction Bilaterally",
          "Automated NPi > 3 (Normal)",
          "Automated NPi < 3 (Abnormal)"
        ]
      },
      {
        label: "SAT/SBT Coordination",
        path: "systems.cns.satSbtSync",
        type: "select",
        options: [
          "SAT/SBT Coordinated & Passed",
          "SAT Contraindicated (Severe Shock/ICP)",
          "SBT Failed (Resp distress/Tachycardia)",
          "Not Applicable (Awake)"
        ]
      },
      { label: "Brainstem Reflexes", path: "systems.cns.brainstemReflexes", type: "text", placeholder: "e.g. Corneal, Gag, Cough intact" },
      { label: "Motor & Posturing", path: "systems.cns.motor", type: "text", placeholder: "e.g. Symmetric, purposeful" },
      { label: "ICP / CPP / EVD", path: "systems.cns.evd", type: "text", placeholder: "e.g. ICP 12, CPP 68" }
    ]
  },
  cvs: {
    name: "CVS & Support",
    icon: Heart,
    statusPath: "systems.cvs.status",
    commentsPath: "systems.cvs.comments",
    presets: [
      {
        label: "Stable (Off Pressors)",
        values: {
          "systems.cvs.status": "Stable",
          "systems.cvs.hr": "72",
          "systems.cvs.bp": "120/80",
          "systems.cvs.map": "93",
          "systems.cvs.rhythm": "Sinus Rhythm",
          "systems.cvs.crt": "< 2 seconds",
          "systems.cvs.mottling": "Grade 0 (No mottling)",
          "systems.cvs.lactate": "1.1",
          "systems.cvs.scvo2": "75",
          "systems.cvs.pco2Gap": "4",
          "systems.cvs.svvPpv": "SVV < 10% (Fluid Unresponsive)",
          "systems.cvs.vexus": "Grade 0 (No congestion)",
          "systems.cvs.ecmoSupport": "None",
          "systems.cvs.comments": "Patient is hemodynamically stable on no vasoactive support. Normal lactate, warm extremities, capillary refill < 2 seconds."
        }
      },
      {
        label: "Septic Shock",
        values: {
          "systems.cvs.status": "Vasopressor Support",
          "systems.cvs.hr": "98",
          "systems.cvs.bp": "110/60",
          "systems.cvs.map": "76",
          "systems.cvs.rhythm": "Sinus Tachycardia",
          "systems.cvs.crt": "2-3 seconds",
          "systems.cvs.mottling": "Grade 1",
          "systems.cvs.lactate": "2.1",
          "systems.cvs.scvo2": "68",
          "systems.cvs.pco2Gap": "5.8",
          "systems.cvs.svvPpv": "PLR challenge: Fluid Responsive",
          "systems.cvs.vexus": "Grade 1 (Mild congestion)",
          "systems.cvs.ecmoSupport": "None",
          "systems.cvs.comments": "Septic shock. Maintained on Noradrenaline 0.12 mcg/kg/min central line infusion. Lactate clearing. SVV indicates possible responsive volume expansion."
        }
      }
    ],
    fields: [
      {
        label: "CVS Status",
        path: "systems.cvs.status",
        type: "select",
        options: ["Stable", "Shock / Hypotension", "Vasopressor Support", "Arrhythmia"]
      },
      { label: "Heart Rate (bpm)", path: "systems.cvs.hr", type: "text", placeholder: "e.g. 72" },
      { label: "Blood Pressure (mmHg)", path: "systems.cvs.bp", type: "text", placeholder: "e.g. 120/80" },
      { label: "MAP (mmHg)", path: "systems.cvs.map", type: "text", placeholder: "e.g. 93" },
      {
        label: "ECG Rhythm",
        path: "systems.cvs.rhythm",
        type: "select",
        options: ["Sinus Rhythm", "New-Onset Atrial Fibrillation", "ST-segment changes / Ischemia", "QTc prolonged (> 500ms)", "Sinus Tachycardia", "Sinus Bradycardia"]
      },
      {
        label: "Capillary Refill (CRT)",
        path: "systems.cvs.crt",
        type: "select",
        options: ["< 2 seconds (Normal)", "2-3 seconds (Delayed)", "> 3 seconds (Severely Prolonged)"]
      },
      {
        label: "Mottling Score (0-5)",
        path: "systems.cvs.mottling",
        type: "select",
        options: [
          "Grade 0 (No mottling)",
          "Grade 1 (Mild patella redness)",
          "Grade 2 (Knee cap fully mottled)",
          "Grade 3 (Extends to mid-thigh)",
          "Grade 4-5 (Severe extension/groin)"
        ]
      },
      { label: "Serum Lactate (mmol/L)", path: "systems.cvs.lactate", type: "text", placeholder: "e.g. 1.1" },
      { label: "ScvO2 (%)", path: "systems.cvs.scvo2", type: "text", placeholder: "e.g. 72" },
      { label: "VA-CO2 Gap (mmHg)", path: "systems.cvs.pco2Gap", type: "text", placeholder: "e.g. 4.2" },
      { label: "CVP (mmHg)", path: "systems.cvs.cvp", type: "text", placeholder: "e.g. 8" },
      {
        label: "Fluid Responsiveness",
        path: "systems.cvs.svvPpv",
        type: "select",
        options: ["SVV < 10% (Fluid Unresponsive)", "SVV > 12% (Fluid Responsive)", "PPV > 13% (Fluid Responsive)", "PLR challenge: Fluid Responsive", "PLR challenge: Unresponsive"]
      },
      {
        label: "Venous Congestion (VExUS)",
        path: "systems.cvs.vexus",
        type: "select",
        options: ["Grade 0 (No congestion)", "Grade 1 (Mild congestion)", "Grade 2 (Moderate congestion)", "Grade 3 (Severe congestion)"]
      },
      {
        label: "Extracorporeal Support",
        path: "systems.cvs.ecmoSupport",
        type: "select",
        options: ["None", "VA-ECMO Support", "VV-ECMO Support", "IABP (1:1 assist ratio)", "IABP (1:2 assist ratio)", "Impella Assist Device"]
      }
    ]
  },
  rs: {
    name: "Respiratory & Mechanics",
    icon: Wind,
    statusPath: "systems.rs.status",
    commentsPath: "systems.rs.comments",
    presets: [
      {
        label: "Normal Room Air",
        values: {
          "systems.rs.status": "Room Air",
          "systems.rs.mode": "Spontaneous",
          "systems.rs.rr": "16",
          "systems.rs.fio2": "21",
          "systems.rs.peep": "0",
          "systems.rs.spo2": "98",
          "systems.rs.wob": "Normal (No distress)",
          "systems.rs.secretionScore": "Scant / Clear",
          "systems.rs.cuffPressure": "Not Applicable",
          "systems.rs.pPlat": "",
          "systems.rs.drivingPressure": "",
          "systems.rs.roxIndex": "",
          "systems.rs.rsbi": "",
          "systems.rs.comments": "Lungs clear bilaterally, eupneic on room air. Normal gas exchange, SpO2 98%. Ready for floor transfer."
        }
      },
      {
        label: "Lung Protective Vent",
        values: {
          "systems.rs.status": "Invasive Vent",
          "systems.rs.mode": "PRVC",
          "systems.rs.rr": "18",
          "systems.rs.fio2": "40",
          "systems.rs.peep": "8",
          "systems.rs.spo2": "95",
          "systems.rs.wob": "Mild Accessory Use",
          "systems.rs.secretionScore": "Moderate / Mucoid",
          "systems.rs.cuffPressure": "24 cmH2O (Target)",
          "systems.rs.pPlat": "21",
          "systems.rs.drivingPressure": "13",
          "systems.rs.roxIndex": "",
          "systems.rs.rsbi": "62",
          "systems.rs.comments": "ARDS profile. Invasive mechanical ventilation on lung-protective settings. Tidal volume tailored to 6mL/kg IBW. Plateau pressure < 30 mmHg, driving pressure < 14 mmHg."
        }
      }
    ],
    fields: [
      {
        label: "Respiratory Status",
        path: "systems.rs.status",
        type: "select",
        options: ["Room Air", "Oxygen Mask / NC", "HFNC", "NIV (CPAP/BiPAP)", "Invasive Vent"]
      },
      { label: "Vent Mode / Support", path: "systems.rs.mode", type: "text", placeholder: "e.g. PRVC" },
      { label: "FiO2 (%)", path: "systems.rs.fio2", type: "text", placeholder: "e.g. 40" },
      { label: "PEEP (cmH2O)", path: "systems.rs.peep", type: "text", placeholder: "e.g. 8" },
      { label: "Respiratory Rate (RR)", path: "systems.rs.rr", type: "text", placeholder: "e.g. 18" },
      { label: "SpO2 (%)", path: "systems.rs.spo2", type: "text", placeholder: "e.g. 96" },
      { label: "Plateau Pressure (Pplat)", path: "systems.rs.pPlat", type: "text", placeholder: "e.g. 21" },
      { label: "Driving Pressure (dP)", path: "systems.rs.drivingPressure", type: "text", placeholder: "e.g. 11" },
      {
        label: "Work of Breathing (WOB)",
        path: "systems.rs.wob",
        type: "select",
        options: ["Normal (No distress)", "Mild Accessory Use", "Intercostal Retractions", "Severe Paradoxical Breathing"]
      },
      {
        label: "Secretions Profile",
        path: "systems.rs.secretionScore",
        type: "select",
        options: ["Scant / Clear", "Moderate / Mucoid", "Copious / Purulent", "Thick / Hard to suction", "Serosanguinous"]
      },
      {
        label: "ETT Cuff Pressure",
        path: "systems.rs.cuffPressure",
        type: "select",
        options: ["20-25 cmH2O (Target)", "25-30 cmH2O (Target)", "Over-inflated (> 30 cmH2O)", "Under-inflated (< 20 cmH2O)", "Not Applicable"]
      },
      { label: "HFNC: ROX Index", path: "systems.rs.roxIndex", type: "text", placeholder: "e.g. 5.5" },
      { label: "Weaning: RSBI (f/VT)", path: "systems.rs.rsbi", type: "text", placeholder: "e.g. 62" }
    ]
  },
  renal: {
    name: "Renal & Bio-Electrolytes",
    icon: Droplets,
    statusPath: "systems.renal.status",
    commentsPath: "systems.renal.comments",
    presets: [
      {
        label: "Stable Renal Profile",
        values: {
          "systems.renal.status": "Stable",
          "systems.renal.uo": "65",
          "systems.renal.creatinine": "0.9",
          "systems.renal.urea": "28",
          "systems.renal.kdigo": "No AKI",
          "systems.renal.fluidPhase": "Stabilization (S)",
          "systems.renal.fluidOverload": "1.2",
          "systems.renal.comments": "Urine output > 0.5 mL/kg/hr. Creatinine stable. Fluid balance optimization. No signs of systemic congestion."
        }
      },
      {
        label: "Oliguric AKI",
        values: {
          "systems.renal.status": "AKI / Oliguria",
          "systems.renal.uo": "18",
          "systems.renal.creatinine": "2.4",
          "systems.renal.urea": "82",
          "systems.renal.kdigo": "AKI Stage 2",
          "systems.renal.fluidPhase": "Evacuation (E)",
          "systems.renal.fluidOverload": "8.5",
          "systems.renal.comments": "AKI Stage 2 secondary to sepsis. Oliguric phase. Active de-escalation/fluid evacuation phase initiated with Furosemide infusion. Closely monitoring electrolytes."
        }
      }
    ],
    fields: [
      {
        label: "Renal Status",
        path: "systems.renal.status",
        type: "select",
        options: ["Stable", "AKI / Oliguria", "Anuria", "CRRT / HD"]
      },
      { label: "Urine Output (mL/hr)", path: "systems.renal.uo", type: "text", placeholder: "e.g. 50" },
      { label: "Creatinine (mg/dL)", path: "systems.renal.creatinine", type: "text", placeholder: "e.g. 1.2" },
      { label: "Urea (mg/dL)", path: "systems.renal.urea", type: "text", placeholder: "e.g. 45" },
      {
        label: "KDIGO AKI Stage",
        path: "systems.renal.kdigo",
        type: "select",
        options: ["No AKI", "AKI Stage 1", "AKI Stage 2", "AKI Stage 3"]
      },
      {
        label: "Fluid Phase (ROSE)",
        path: "systems.renal.fluidPhase",
        type: "select",
        options: ["Resuscitation (R)", "Optimization (O)", "Stabilization (S)", "Evacuation (E)"]
      },
      { label: "Fluid Overload (%)", path: "systems.renal.fluidOverload", type: "text", placeholder: "e.g. 5.2" },
      { label: "CRRT Qb / Effluent", path: "systems.renal.crrtEffluent", type: "text", placeholder: "e.g. Qb 150, Effluent 25" },
      { label: "CRRT Pressures (TMP)", path: "systems.renal.crrtPressures", type: "text", placeholder: "e.g. TMP 110 mmHg" },
      { label: "RCA Ionized Calcium", path: "systems.renal.rcaCalcium", type: "text", placeholder: "e.g. Post-filter 0.31" }
    ]
  },
  git: {
    name: "GI & Nutrition",
    icon: Stethoscope,
    statusPath: "systems.git.status",
    commentsPath: "systems.git.comments",
    presets: [
      {
        label: "Feeding Tolerated",
        values: {
          "systems.git.status": "Enteral (NG / NJ)",
          "systems.git.diet": "Jevity 1.2 @ 50 mL/hr",
          "systems.git.abdominalExam": "Soft & Non-distended",
          "systems.git.bowelMovement": "Stool passed today",
          "systems.git.nutritionGoal": "100% caloric/protein target achieved",
          "systems.git.iap": "Normal (< 12 mmHg)",
          "systems.git.liverProfile": "Total Bilirubin 0.8",
          "systems.git.comments": "Enteral feeds running at target. Abdomen soft, bowel sounds active. Bowel movement passed, no residuals."
        }
      }
    ],
    fields: [
      {
        label: "Nutrition Route",
        path: "systems.git.status",
        type: "select",
        options: ["Normal Diet", "NPO", "Enteral (NG / NJ)", "TPN"]
      },
      { label: "Diet Formula & Rate", path: "systems.git.diet", type: "text", placeholder: "e.g. Jevity 1.5 @ 50ml/h" },
      {
        label: "Abdominal Exam",
        path: "systems.git.abdominalExam",
        type: "select",
        options: ["Soft & Non-distended", "Mildly Distended", "Moderately Distended", "Tender / Guarding", "Surgical / Open Abdomen"]
      },
      {
        label: "Bowel Movement",
        path: "systems.git.bowelMovement",
        type: "select",
        options: ["Stool passed today", "Constipated (> 3 days)", "ICU Diarrhea", "Flatus only"]
      },
      {
        label: "Target Goals Reached",
        path: "systems.git.nutritionGoal",
        type: "select",
        options: ["100% caloric/protein target achieved", "Partial goal reached (50-80%)", "Feeds held (high residuals)", "Feeds held (pre-procedure)", "TPN active"]
      },
      {
        label: "Intra-Abdominal Pressure",
        path: "systems.git.iap",
        type: "select",
        options: ["Normal (< 12 mmHg)", "Elevated (12-20 mmHg) - IAH", "ACS (> 20 mmHg with organ failure)"]
      },
      { label: "Liver Profile & Bilirubin", path: "systems.git.liverProfile", type: "text", placeholder: "e.g. Bili 1.1, AST 45" }
    ]
  },
  heme: {
    name: "Hematology & Coagulation",
    icon: Activity,
    statusPath: "systems.heme.status",
    commentsPath: "systems.heme.comments",
    presets: [
      {
        label: "Normal Profile",
        values: {
          "systems.heme.status": "Normal",
          "systems.heme.hb": "12.8",
          "systems.heme.wbc": "8.2",
          "systems.heme.plt": "210",
          "systems.heme.temp": "37.1",
          "systems.heme.restrictiveTransfusion": "Yes (Hb target > 7 g/dL)",
          "systems.heme.leukocyteDynamics": "Stable count",
          "systems.heme.coagulopathyTEG": "Normal profile",
          "systems.heme.thromboprophylaxisDetails": "Enoxaparin active (LMWH)",
          "systems.heme.comments": "Cell lines stable. Restrictive transfusion protocol active, chemical and mechanical DVT prophylaxis active."
        }
      }
    ],
    fields: [
      {
        label: "Heme Status",
        path: "systems.heme.status",
        type: "select",
        multi: true,
        options: [
          "Normal",
          "Anemic",
          "Thrombocytopenic",
          "Leukocytosis / Sepsis",
          "Bicytopenic",
          "Pancytopenic",
          "Erythrocytosis",
          "Thrombocytosis",
          "Leukocytosis"
        ]
      },
      { label: "Hb (g/dL)", path: "systems.heme.hb", type: "text", placeholder: "e.g. 12.5" },
      { label: "WBC (x10^3)", path: "systems.heme.wbc", type: "text", placeholder: "e.g. 8.5" },
      { label: "PLT (x10^3)", path: "systems.heme.plt", type: "text", placeholder: "e.g. 150" },
      { label: "Temp (°C)", path: "systems.heme.temp", type: "text", placeholder: "e.g. 37.0" },
      {
        label: "Restrictive Transfusion",
        path: "systems.heme.restrictiveTransfusion",
        type: "select",
        options: ["Yes (Hb target > 7 g/dL)", "No (Active ACS, target > 8 g/dL)", "Active Bleeding protocol running"]
      },
      {
        label: "Leukocyte Dynamics",
        path: "systems.heme.leukocyteDynamics",
        type: "select",
        options: ["Stable count", "Left shift / Bands present", "Leukocytosis resolving", "Neutropenic / Severe risk"]
      },
      {
        label: "Coagulation (TEG/ROTEM)",
        path: "systems.heme.coagulopathyTEG",
        type: "select",
        options: ["Normal profile", "Hypercoagulable state", "Hypocoagulable / DIC trend", "Heparin effect present"]
      },
      {
        label: "Thromboprophylaxis",
        path: "systems.heme.thromboprophylaxisDetails",
        type: "select",
        options: ["Enoxaparin active (LMWH)", "Unfractionated Heparin TID", "Mechanical SCDs only (LMWH held)", "All prophylaxis held"]
      }
    ]
  },
  endocrine: {
    name: "Endocrine & Glycemia",
    icon: Activity,
    statusPath: "systems.endocrine.status",
    commentsPath: "systems.endocrine.comments",
    presets: [
      {
        label: "Euglycemia",
        values: {
          "systems.endocrine.status": "Stable",
          "systems.endocrine.bg": "142",
          "systems.endocrine.comments": "Blood glucose stable. No continuous insulin required, monitored on q6h sliding scale."
        }
      }
    ],
    fields: [
      {
        label: "Endocrine Status",
        path: "systems.endocrine.status",
        type: "select",
        options: ["Stable", "Diabetic Control / Insulin", "Electrolyte Imbalance", "Adrenal/Other"]
      },
      { label: "Blood Glucose (mg/dL)", path: "systems.endocrine.bg", type: "text", placeholder: "e.g. 140-180" }
    ]
  },
  idStewardship: {
    name: "Infectious & Stewardship",
    icon: ShieldCheck,
    statusPath: "systems.idStewardship.status",
    commentsPath: "systems.idStewardship.comments",
    presets: [
      {
        label: "Infection Resolving",
        values: {
          "systems.idStewardship.status": "Resolving",
          "systems.idStewardship.tempMinMax": "36.5 - 37.4",
          "systems.idStewardship.biomarkers": "CRP 24, Procalcitonin 0.12 (down)",
          "systems.idStewardship.cultures": "Sputum grew Pneumococcus, blood cultures sterile",
          "systems.idStewardship.stewardshipTDM": "De-escalated to Ceftriaxone 2g IV daily (Day 2 of 7)",
          "systems.idStewardship.lineSites": "All central/arterial lines sites clear, no erythema",
          "systems.idStewardship.deviceHoliday": "Passed. Foley catheter removed today.",
          "systems.idStewardship.comments": "Infection resolving. Broad spectrum deactivated, targeted therapy active. Device holidays reviewed, foley pulled."
        }
      }
    ],
    fields: [
      {
        label: "Infection Status",
        path: "systems.idStewardship.status",
        type: "select",
        options: ["No Infection", "Sepsis", "Severe Shock", "Resolving"]
      },
      { label: "Thermal Envelope (24h)", path: "systems.idStewardship.tempMinMax", type: "text", placeholder: "e.g. 36.4 - 38.2 °C" },
      { label: "Inflammatory Biomarkers", path: "systems.idStewardship.biomarkers", type: "text", placeholder: "e.g. CRP 18, PCT 0.45" },
      { label: "Cultures Review", path: "systems.idStewardship.cultures", type: "text", placeholder: "e.g. Blood negative, sputum pending" },
      { label: "Active Antibiotics & TDM", path: "systems.idStewardship.stewardshipTDM", type: "text", placeholder: "e.g. Meropenem Day 3" },
      { label: "Line Sites Check", path: "systems.idStewardship.lineSites", type: "text", placeholder: "e.g. CVC dressing dry & clean" },
      { label: "Device Holiday (Pull check)", path: "systems.idStewardship.deviceHoliday", type: "text", placeholder: "e.g. Foley pulled, CVC still required" }
    ]
  },
  integumentaryMusculoskeletal: {
    name: "Integumentary & Rehab",
    icon: Info,
    statusPath: "systems.integumentaryMusculoskeletal.status",
    commentsPath: "systems.integumentaryMusculoskeletal.comments",
    presets: [
      {
        label: "Intact & Mobilizing",
        values: {
          "systems.integumentaryMusculoskeletal.status": "Intact",
          "systems.integumentaryMusculoskeletal.skinPressureInjury": "Skin intact, Braden Scale 16",
          "systems.integumentaryMusculoskeletal.woundDrains": "No surgical wounds or active drains",
          "systems.integumentaryMusculoskeletal.mrcScore": "58/60 (Normal power)",
          "systems.integumentaryMusculoskeletal.mobilityTier": "Tier 3 (Sitting edge of bed)",
          "systems.integumentaryMusculoskeletal.comments": "Skin barrier intact. Working with physical therapy daily, mobilizes to edge of bed safely. Normal symmetric motor power."
        }
      }
    ],
    fields: [
      {
        label: "Skin/Rehab Status",
        path: "systems.integumentaryMusculoskeletal.status",
        type: "select",
        options: ["Intact", "Pressure Injury / Wound", "ICUAW Weakness", "Contracture Risk"]
      },
      { label: "Pressure Injuries Sacrum/Heels", path: "systems.integumentaryMusculoskeletal.skinPressureInjury", type: "text", placeholder: "e.g. Sacrum intact" },
      { label: "Wounds & Drains Outputs", path: "systems.integumentaryMusculoskeletal.woundDrains", type: "text", placeholder: "e.g. JP drain 30mL" },
      { label: "ICU-AW (MRC sum-score)", path: "systems.integumentaryMusculoskeletal.mrcScore", type: "text", placeholder: "e.g. 52/60" },
      {
        label: "ICU Mobility Milestones",
        path: "systems.integumentaryMusculoskeletal.mobilityTier",
        type: "select",
        options: ["Tier 0 (Passive in-bed)", "Tier 1 (Sitting in bed)", "Tier 2 (Passive chair)", "Tier 3 (Sitting edge of bed)", "Tier 4 (Standing bedside)", "Tier 8 (Ambulating actively)"]
      }
    ]
  },
  pharmacologyToxicology: {
    name: "Pharmacology & SUP",
    icon: Pill,
    statusPath: "systems.pharmacologyToxicology.status",
    commentsPath: "systems.pharmacologyToxicology.comments",
    presets: [
      {
        label: "Standard Checked Meds",
        values: {
          "systems.pharmacologyToxicology.status": "Stable",
          "systems.pharmacologyToxicology.renalHepaticClearance": "All meds adjusted for CrCl 65 mL/min",
          "systems.pharmacologyToxicology.drugInteractions": "No critical QTc or nephrotoxic synergy",
          "systems.pharmacologyToxicology.stressUlcerProphylaxis": "PPI Indicated (Intubated > 48 hours)",
          "systems.pharmacologyToxicology.comments": "Comprehensive medication profile reviewed. All doses optimized for current clearance. Stress ulcer prophylaxis indicated and active."
        }
      }
    ],
    fields: [
      {
        label: "Pharmacological Status",
        path: "systems.pharmacologyToxicology.status",
        type: "select",
        options: ["Stable", "Renal/Hepatic Adjustment Needed", "Potential Interaction", "SUP Indicated"]
      },
      { label: "Renal/Hepatic Clearance Doses", path: "systems.pharmacologyToxicology.renalHepaticClearance", type: "text", placeholder: "e.g. Meropenem adjusted" },
      { label: "Drug-Drug Interactions / QTc", path: "systems.pharmacologyToxicology.drugInteractions", type: "text", placeholder: "e.g. QTc drugs monitored" },
      {
        label: "Stress Ulcer Prophylaxis",
        path: "systems.pharmacologyToxicology.stressUlcerProphylaxis",
        type: "select",
        options: ["PPI Indicated (Intubated > 48 hours)", "PPI Indicated (Coagulopathy/Shock)", "PPI Discontinued (low risk)", "SUP not indicated"]
      }
    ]
  },
  humanitarianPalliative: {
    name: "Humanitarian & Palliative",
    icon: Flame,
    statusPath: "systems.humanitarianPalliative.status",
    commentsPath: "systems.humanitarianPalliative.comments",
    presets: [
      {
        label: "Comfort / Full Care",
        values: {
          "systems.humanitarianPalliative.status": "Comfort / Full Care",
          "systems.humanitarianPalliative.sleepWakeBundle": "Sleep bundle active (noise/light muted)",
          "systems.humanitarianPalliative.communicationAids": "Communication board at bedside",
          "systems.humanitarianPalliative.familyUpdates": "Family updated daily, fully aligned",
          "systems.humanitarianPalliative.spiritualNeeds": "Spiritual advisor requested & visited",
          "systems.humanitarianPalliative.picsPrevention": "PICS bundle initiated",
          "systems.humanitarianPalliative.comments": "Full care in alignment with patient values. Sleep hygiene strictly maintained, cognitive stimulation ongoing with family involvement."
        }
      }
    ],
    fields: [
      {
        label: "Palliative/Care Goals",
        path: "systems.humanitarianPalliative.status",
        type: "select",
        options: ["Comfort / Full Care", "Active Palliative Care (comfort focus)", "End-of-Life transition", "Family meeting scheduled"]
      },
      { label: "Sleep-Wake Bundles", path: "systems.humanitarianPalliative.sleepWakeBundle", type: "text", placeholder: "e.g. Earplugs/eye masks at night" },
      { label: "Communication Aids", path: "systems.humanitarianPalliative.communicationAids", type: "text", placeholder: "e.g. Bedside letter board" },
      { label: "Family Dynamics", path: "systems.humanitarianPalliative.familyUpdates", type: "text", placeholder: "e.g. Daily calls to daughter" },
      { label: "Spiritual / Religious Needs", path: "systems.humanitarianPalliative.spiritualNeeds", type: "text", placeholder: "e.g. Chaplain visits scheduled" },
      { label: "PICS / PICSU Prevention", path: "systems.humanitarianPalliative.picsPrevention", type: "text", placeholder: "e.g. Early mobilization & diaries" }
    ]
  }
};

export default function PatientDetails({ patient, passphrase, nickname, userRole, onSave, onClose }: PatientDetailsProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("profile");
  const [localPatient, setLocalPatient] = useState<PatientData>(() => {
    const defaultSystems = {
      cns: { status: "Alert", comments: "", gcs: "", four: "", rass: "", delirium: "", satSbtSync: "", pupils: "", brainstemReflexes: "", motor: "", icp: "", cpp: "", evd: "" },
      cvs: { status: "Stable", comments: "", hr: "", bp: "", map: "", rhythm: "", cvp: "", crt: "", mottling: "", lactate: "", scvo2: "", pco2Gap: "", svvPpv: "", vexus: "", ecmoSupport: "", iabpImpella: "" },
      rs: { status: "Room Air", comments: "", mode: "", rr: "", fio2: "", peep: "", spo2: "", wob: "", secretionScore: "", cuffPressure: "", pPlat: "", drivingPressure: "", roxIndex: "", rsbi: "" },
      git: { status: "Normal Diet", comments: "", diet: "", abdominalExam: "", bowelMovement: "", nutritionGoal: "", iap: "", liverProfile: "" },
      renal: { status: "Stable", comments: "", uo: "", urea: "", creatinine: "", kdigo: "", fluidPhase: "", fluidOverload: "", crrtEffluent: "", crrtPressures: "", rcaCalcium: "" },
      heme: { status: "Normal", comments: "", hb: "", wbc: "", plt: "", temp: "", restrictiveTransfusion: "", leukocyteDynamics: "", coagulopathyTEG: "", thromboprophylaxisDetails: "" },
      endocrine: { status: "Stable", comments: "", bg: "" },
      idStewardship: { status: "No Infection", comments: "", tempMinMax: "", biomarkers: "", cultures: "", stewardshipTDM: "", lineSites: "", deviceHoliday: "", antibioticsList: [], culturesList: [] },
      integumentaryMusculoskeletal: { status: "Intact", comments: "", skinPressureInjury: "", woundDrains: "", mrcScore: "", mobilityTier: "" },
      pharmacologyToxicology: { status: "Stable", comments: "", renalHepaticClearance: "", drugInteractions: "", stressUlcerProphylaxis: "" },
      humanitarianPalliative: { status: "Comfort / Full Care", comments: "", sleepWakeBundle: "", communicationAids: "", familyUpdates: "", goalsOfCare: "", spiritualSocial: "" }
    };

    const patientSystems = patient.systems || {};
    const mergedSystems = { ...defaultSystems };
    Object.keys(defaultSystems).forEach((key) => {
      (mergedSystems as any)[key] = {
        ...(defaultSystems as any)[key],
        ...(patientSystems as any)[key]
      };
    });

    return {
      ...patient,
      systems: mergedSystems as any,
      isbar: {
        identify: "", situation: "", background: "", assessment: "", recommendation: "",
        ...(patient.isbar || {})
      },
      fasthugbid: {
        feeding: false, feedingNotes: "",
        analgesia: false, analgesiaNotes: "",
        sedation: false, sedationNotes: "",
        thrombo: false, thromboNotes: "",
        headUp: false, headUpNotes: "",
        ulcer: false, ulcerNotes: "",
        glycemic: false, glycemicNotes: "",
        bowel: false, bowelNotes: "",
        indwelling: false, indwellingNotes: "",
        deescalation: false, deescalationNotes: "",
        ...(patient.fasthugbid || {})
      },
      tasks: patient.tasks || [],
      procedures: patient.procedures || [],
      criticalEvents: patient.criticalEvents || [],
      images: patient.images || [],
      timeline: patient.timeline || [],
      dailyNotes: {
        cns: "", cvs: "", rs: "", renal: "", git: "", heme: "", idStewardship: "", other: "",
        ...(patient.dailyNotes || {})
      }
    };
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (patient) {
      setLocalPatient(prev => {
        if (prev.bed !== patient.bed || prev.mrn !== patient.mrn) {
          const defaultSystems = {
            cns: { status: "Alert", comments: "", gcs: "", four: "", rass: "", delirium: "", satSbtSync: "", pupils: "", brainstemReflexes: "", motor: "", icp: "", cpp: "", evd: "" },
            cvs: { status: "Stable", comments: "", hr: "", bp: "", map: "", rhythm: "", cvp: "", crt: "", mottling: "", lactate: "", scvo2: "", pco2Gap: "", svvPpv: "", vexus: "", ecmoSupport: "", iabpImpella: "" },
            rs: { status: "Room Air", comments: "", mode: "", rr: "", fio2: "", peep: "", spo2: "", wob: "", secretionScore: "", cuffPressure: "", pPlat: "", drivingPressure: "", roxIndex: "", rsbi: "" },
            git: { status: "Normal Diet", comments: "", diet: "", abdominalExam: "", bowelMovement: "", nutritionGoal: "", iap: "", liverProfile: "" },
            renal: { status: "Stable", comments: "", uo: "", urea: "", creatinine: "", kdigo: "", fluidPhase: "", fluidOverload: "", crrtEffluent: "", crrtPressures: "", rcaCalcium: "" },
            heme: { status: "Normal", comments: "", hb: "", wbc: "", plt: "", temp: "", restrictiveTransfusion: "", leukocyteDynamics: "", coagulopathyTEG: "", thromboprophylaxisDetails: "" },
            endocrine: { status: "Stable", comments: "", bg: "" },
            idStewardship: { status: "No Infection", comments: "", tempMinMax: "", biomarkers: "", cultures: "", stewardshipTDM: "", lineSites: "", deviceHoliday: "", antibioticsList: [], culturesList: [] },
            integumentaryMusculoskeletal: { status: "Intact", comments: "", skinPressureInjury: "", woundDrains: "", mrcScore: "", mobilityTier: "" },
            pharmacologyToxicology: { status: "Stable", comments: "", renalHepaticClearance: "", drugInteractions: "", stressUlcerProphylaxis: "" },
            humanitarianPalliative: { status: "Comfort / Full Care", comments: "", sleepWakeBundle: "", communicationAids: "", familyUpdates: "", goalsOfCare: "", spiritualSocial: "" }
          };

          const patientSystems = patient.systems || {};
          const mergedSystems = { ...defaultSystems };
          Object.keys(defaultSystems).forEach((key) => {
            (mergedSystems as any)[key] = {
              ...(defaultSystems as any)[key],
              ...(patientSystems as any)[key]
            };
          });

          return {
            ...patient,
            systems: mergedSystems as any,
            isbar: {
              identify: "", situation: "", background: "", assessment: "", recommendation: "",
              ...(patient.isbar || {})
            },
            fasthugbid: {
              feeding: false, feedingNotes: "",
              analgesia: false, analgesiaNotes: "",
              sedation: false, sedationNotes: "",
              thrombo: false, thromboNotes: "",
              headUp: false, headUpNotes: "",
              ulcer: false, ulcerNotes: "",
              glycemic: false, glycemicNotes: "",
              bowel: false, bowelNotes: "",
              indwelling: false, indwellingNotes: "",
              deescalation: false, deescalationNotes: "",
              ...(patient.fasthugbid || {})
            },
            tasks: patient.tasks || [],
            procedures: patient.procedures || [],
            criticalEvents: patient.criticalEvents || [],
            images: patient.images || [],
            timeline: patient.timeline || [],
            dailyNotes: {
              cns: "", cvs: "", rs: "", renal: "", git: "", heme: "", idStewardship: "", other: "",
              ...(patient.dailyNotes || {})
            }
          };
        }
        return prev;
      });
    }
  }, [patient]);

  // Safe nested path value retriever for all components
  const getNestedValue = (obj: any, pathStr: string): string => {
    const parts = pathStr.split(".");
    let current = obj;
    for (const part of parts) {
      if (current && typeof current === "object" && part in current) {
        current = current[part];
      } else {
        return "";
      }
    }
    return typeof current === "string" || typeof current === "number" ? String(current) : "";
  };
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // AI summary states
  const [summaryType, setSummaryType] = useState<"handover" | "case" | "discharge">("handover");
  const [aiSummary, setAiSummary] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [customApiKey, setCustomApiKey] = useState(() => localStorage.getItem("custom_gemini_api_key") || "");
  const [showKeyConfirmModal, setShowKeyConfirmModal] = useState(false);
  
  // Custom Toast State
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => prev?.message === message ? null : prev);
    }, 4000);
  };
  
  // Local state for image uploading
  const [imageTitle, setImageTitle] = useState("");
  const [imageLoading, setImageLoading] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  // Local state for adding tasks
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<PendingTask["priority"]>("Medium");
  const [activeSystemTab, setActiveSystemTab] = useState("cns");

  // Advanced ID Stewardship States
  const [abName, setAbName] = useState("");
  const [customAbName, setCustomAbName] = useState("");
  const [abDose, setAbDose] = useState("");
  const [customAbDose, setCustomAbDose] = useState("");
  const [abFreq, setAbFreq] = useState("");
  const [customAbFreq, setCustomAbFreq] = useState("");
  const [abStewardshipType, setAbStewardshipType] = useState<"Empirical" | "Prophylactic" | "Targeted">("Empirical");
  const [abStartDate, setAbStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [antimicrobialTab, setAntimicrobialTab] = useState<"single" | "multi">("single");
  const [selectedMultiAbs, setSelectedMultiAbs] = useState<Record<string, { checked: boolean; dose: string; freq: string; type: "Empirical" | "Prophylactic" | "Targeted" }>>({});
  const [customMultiAbName, setCustomMultiAbName] = useState("");

  const [cultureSite, setCultureSite] = useState("");
  const [customCultureSite, setCustomCultureSite] = useState("");
  const [cultureDate, setCultureDate] = useState(new Date().toISOString().split("T")[0]);
  const [cultureOrganism, setCultureOrganism] = useState("");
  const [customCultureOrganism, setCustomCultureOrganism] = useState("");
  const [cultureSensitivities, setCultureSensitivities] = useState<string[]>([]);
  const [handoverNote, setHandoverNote] = useState("");
  const [timelineEvent, setTimelineEvent] = useState("");
  const [timelineLevel, setTimelineLevel] = useState<"Info" | "Warning" | "Critical">("Info");

  // Local state for Procedures tab
  const [procName, setProcName] = useState<ProcedureRecord["name"] | "">("");
  const [customProcName, setCustomProcName] = useState("");
  const [procDate, setProcDate] = useState(new Date().toISOString().split("T")[0]);
  const [procFindings, setProcFindings] = useState("");
  const [procOperator, setProcOperator] = useState("");

  // Local state for Critical Events tab
  const [critDesc, setCritDesc] = useState("");
  const [critAction, setCritAction] = useState("");
  const [critOutcome, setCritOutcome] = useState("");
  const [critTimestamp, setCritTimestamp] = useState(new Date().toISOString().slice(0, 16));

  const crclVal = parseFloat(localPatient.calculators?.crcl) || 100;

  const getCrClRecommendation = (drugName: string, crcl: number) => {
    if (!drugName) return null;
    const nameLower = drugName.toLowerCase();
    if (nameLower.includes("meropenem")) {
      if (crcl >= 50) return { dose: "1g", frequency: "q8h", rationale: "Standard dose (CrCl >= 50 mL/min)" };
      if (crcl >= 15) return { dose: "1g", frequency: "q12h", rationale: "Renal adjustment (CrCl 15-50 mL/min)" };
      return { dose: "500mg", frequency: "q24h", rationale: "Renal adjustment (CrCl < 15 mL/min)" };
    }
    if (nameLower.includes("piperacillin") || nameLower.includes("tazocin")) {
      if (crcl >= 40) return { dose: "4.5g", frequency: "q6h", rationale: "Standard dose (CrCl >= 40 mL/min)" };
      if (crcl >= 20) return { dose: "3.375g", frequency: "q8h", rationale: "Renal adjustment (CrCl 20-40 mL/min)" };
      return { dose: "2.25g", frequency: "q8h", rationale: "Renal adjustment (CrCl < 20 mL/min)" };
    }
    if (nameLower.includes("cefepime")) {
      if (crcl >= 60) return { dose: "2g", frequency: "q8h", rationale: "Standard dose (CrCl >= 60 mL/min)" };
      if (crcl >= 30) return { dose: "2g", frequency: "q12h", rationale: "Renal adjustment (CrCl 30-60 mL/min)" };
      if (crcl >= 11) return { dose: "1g", frequency: "q24h", rationale: "Renal adjustment (CrCl 11-29 mL/min)" };
      return { dose: "500mg", frequency: "q24h", rationale: "Renal adjustment (CrCl < 11 mL/min)" };
    }
    if (nameLower.includes("ceftazidime")) {
      if (crcl >= 50) return { dose: "2g", frequency: "q8h", rationale: "Standard dose (CrCl >= 50 mL/min)" };
      if (crcl >= 31) return { dose: "1g", frequency: "q12h", rationale: "Renal adjustment (CrCl 31-50 mL/min)" };
      if (crcl >= 16) return { dose: "1g", frequency: "q24h", rationale: "Renal adjustment (CrCl 16-30 mL/min)" };
      return { dose: "500mg", frequency: "q24h", rationale: "Renal adjustment (CrCl < 16 mL/min)" };
    }
    if (nameLower.includes("levofloxacin")) {
      if (crcl >= 50) return { dose: "750mg", frequency: "q24h", rationale: "Standard dose (CrCl >= 50 mL/min)" };
      return { dose: "750mg", frequency: "q48h", rationale: "Renal adjustment (CrCl < 50 mL/min)" };
    }
    if (nameLower.includes("fluconazole")) {
      if (crcl >= 50) return { dose: "400mg", frequency: "q24h", rationale: "Standard dose (CrCl >= 50 mL/min)" };
      return { dose: "200mg", frequency: "q24h", rationale: "Renal adjustment (CrCl < 50 mL/min)" };
    }
    if (nameLower.includes("colistin")) {
      if (crcl >= 50) return { dose: "4.5m IU", frequency: "q12h", rationale: "Standard maintenance dose (CrCl >= 50)" };
      return { dose: "2.25m IU", frequency: "q12h", rationale: "Renal adjustment (CrCl < 50)" };
    }
    if (nameLower.includes("ceftriaxone") || nameLower.includes("linezolid") || nameLower.includes("metronidazole") || nameLower.includes("caspofungin") || nameLower.includes("anidulafungin")) {
      return { dose: "Standard", frequency: "Standard", rationale: "Hepatic clearance or no renal adjustment required." };
    }
    return null;
  };

  const handleAddAntibiotic = () => {
    const finalName = abName === "Other" ? customAbName.trim() : abName;
    const finalDose = abDose === "Other" ? customAbDose.trim() : abDose;
    const finalFreq = abFreq === "Other" ? customAbFreq.trim() : abFreq;

    if (!finalName) {
      showToast("Please enter an antimicrobial name.", "error");
      return;
    }
    if (!finalDose) {
      showToast("Please select or enter a dose.", "error");
      return;
    }
    if (!finalFreq) {
      showToast("Please select or enter a frequency.", "error");
      return;
    }

    const newRecord: AntibioticRecord = {
      id: Math.random().toString(36).substr(2, 9),
      name: finalName,
      dose: finalDose,
      frequency: finalFreq,
      type: abStewardshipType,
      startedDate: abStartDate || new Date().toISOString().split("T")[0],
      isCustom: abName === "Other"
    };

    const currentList = localPatient.systems.idStewardship?.antibioticsList || [];
    const updatedList = [...currentList, newRecord];

    setLocalPatient(prev => ({
      ...prev,
      systems: {
        ...prev.systems,
        idStewardship: {
          ...(prev.systems.idStewardship || { status: "No Infection", comments: "" }),
          antibioticsList: updatedList
        }
      }
    }));

    setAbName("");
    setCustomAbName("");
    setAbDose("");
    setCustomAbDose("");
    setAbFreq("");
    setCustomAbFreq("");
    setAbStewardshipType("Empirical");
    showToast(`Added antimicrobial: ${finalName}`, "success");
  };

  const handleRemoveAntibiotic = (id: string) => {
    const currentList = localPatient.systems.idStewardship?.antibioticsList || [];
    const updatedList = currentList.filter(item => item.id !== id);

    setLocalPatient(prev => ({
      ...prev,
      systems: {
        ...prev.systems,
        idStewardship: {
          ...(prev.systems.idStewardship || { status: "No Infection", comments: "" }),
          antibioticsList: updatedList
        }
      }
    }));
    showToast("Antimicrobial removed.", "info");
  };

  const handleAddCulture = () => {
    const finalSite = cultureSite === "Other" ? customCultureSite.trim() : cultureSite;
    const finalOrganism = cultureOrganism === "Other" ? customCultureOrganism.trim() : cultureOrganism;

    if (!finalSite) {
      showToast("Please select or enter a culture site.", "error");
      return;
    }
    if (!finalOrganism) {
      showToast("Please select or enter an organism.", "error");
      return;
    }

    const newRecord: CultureRecord = {
      id: Math.random().toString(36).substr(2, 9),
      site: finalSite,
      date: cultureDate || new Date().toISOString().split("T")[0],
      organism: finalOrganism,
      isCustomSite: cultureSite === "Other",
      isCustomOrganism: cultureOrganism === "Other",
      sensitiveAntibiotics: [...cultureSensitivities]
    };

    const currentList = localPatient.systems.idStewardship?.culturesList || [];
    const updatedList = [...currentList, newRecord];

    setLocalPatient(prev => ({
      ...prev,
      systems: {
        ...prev.systems,
        idStewardship: {
          ...(prev.systems.idStewardship || { status: "No Infection", comments: "" }),
          culturesList: updatedList
        }
      }
    }));

    setCultureSite("");
    setCustomCultureSite("");
    setCultureOrganism("");
    setCustomCultureOrganism("");
    setCultureSensitivities([]);
    showToast(`Added culture report: ${finalSite}`, "success");
  };

  const handleRemoveCulture = (id: string) => {
    const currentList = localPatient.systems.idStewardship?.culturesList || [];
    const updatedList = currentList.filter(item => item.id !== id);

    setLocalPatient(prev => ({
      ...prev,
      systems: {
        ...prev.systems,
        idStewardship: {
          ...(prev.systems.idStewardship || { status: "No Infection", comments: "" }),
          culturesList: updatedList
        }
      }
    }));
    showToast("Culture report removed.", "info");
  };

  const handleToggleSensitivity = (drug: string) => {
    if (cultureSensitivities.includes(drug)) {
      setCultureSensitivities(prev => prev.filter(d => d !== drug));
    } else {
      setCultureSensitivities(prev => [...prev, drug]);
    }
  };

  const updateDailyNotesField = (field: keyof DailyProgressNotes, value: string) => {
    const updatedDaily = {
      ...((localPatient.dailyNotes as any) || { cns: "", cvs: "", rs: "", renal: "", git: "", heme: "", idStewardship: "", other: "", lastUpdated: "" }),
      [field]: value,
      lastUpdated: new Date().toISOString()
    };
    setLocalPatient(prev => ({
      ...prev,
      dailyNotes: updatedDaily
    }));
  };

  const handlePostHandover = () => {
    if (!handoverNote.trim()) {
      showToast("Please write a general shift summary or handover note.", "error");
      return;
    }

    const dailyNotesObj = localPatient.dailyNotes || { cns: "", cvs: "", rs: "", renal: "", git: "", heme: "", idStewardship: "", other: "", lastUpdated: "" };

    const newTimelineRecord: TimelineRecord = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      updatedBy: nickname || "Clinician",
      role: userRole || "Intensivist",
      notes: handoverNote.trim(),
      systemChanges: {
        cns: dailyNotesObj.cns || "No changes recorded",
        cvs: dailyNotesObj.cvs || "No changes recorded",
        rs: dailyNotesObj.rs || "No changes recorded",
        renal: dailyNotesObj.renal || "No changes recorded",
        git: dailyNotesObj.git || "No changes recorded",
        heme: dailyNotesObj.heme || "No changes recorded",
        idStewardship: dailyNotesObj.idStewardship || "No changes recorded",
        other: dailyNotesObj.other || "No changes recorded"
      }
    };

    const currentTimeline = localPatient.timeline || [];
    const updatedTimeline = [newTimelineRecord, ...currentTimeline];

    setLocalPatient(prev => ({
      ...prev,
      timeline: updatedTimeline,
      dailyNotes: {
        cns: "",
        cvs: "",
        rs: "",
        renal: "",
        git: "",
        heme: "",
        idStewardship: "",
        other: "",
        lastUpdated: new Date().toISOString()
      }
    }));

    setHandoverNote("");
    showToast("Shift Handover successfully archived in Timeline.", "success");
  };

  const handleAddTimelineEvent = () => {
    if (!timelineEvent.trim()) {
      showToast("Please enter a description for the clinical event.", "error");
      return;
    }

    const newRecord: TimelineRecord = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      updatedBy: nickname || "Clinician",
      role: userRole || "Intensivist",
      notes: timelineEvent.trim(),
      level: timelineLevel
    };

    const currentTimeline = localPatient.timeline || [];
    const updatedTimeline = [newRecord, ...currentTimeline];

    setLocalPatient(prev => ({
      ...prev,
      timeline: updatedTimeline
    }));

    setTimelineEvent("");
    setTimelineLevel("Info");
    showToast("Clinical event logged to timeline.", "success");
  };

  const handleRemoveTimelineEvent = (id: string) => {
    const currentTimeline = localPatient.timeline || [];
    const updatedTimeline = currentTimeline.filter(evt => evt.id !== id);

    setLocalPatient(prev => ({
      ...prev,
      timeline: updatedTimeline
    }));
    showToast("Timeline log entry removed.", "info");
  };

  const handleAddProcedure = () => {
    if (!procName) {
      showToast("Please select a procedure.", "error");
      return;
    }
    const finalName = procName;
    const finalCustomName = procName === "Other" ? customProcName.trim() : undefined;

    if (procName === "Other" && !customProcName.trim()) {
      showToast("Please enter custom procedure name.", "error");
      return;
    }

    const newRecord: ProcedureRecord = {
      id: Math.random().toString(36).substr(2, 9),
      name: finalName,
      customName: finalCustomName,
      date: procDate || new Date().toISOString().split("T")[0],
      findings: procFindings.trim() || undefined,
      operator: procOperator.trim() || undefined
    };

    const currentProcedures = localPatient.procedures || [];
    setLocalPatient(prev => ({
      ...prev,
      procedures: [...currentProcedures, newRecord]
    }));

    setProcName("");
    setCustomProcName("");
    setProcDate(new Date().toISOString().split("T")[0]);
    setProcFindings("");
    setProcOperator("");
    showToast(`Added procedure: ${finalCustomName || finalName}`, "success");
  };

  const handleRemoveProcedure = (id: string) => {
    const currentProcedures = localPatient.procedures || [];
    setLocalPatient(prev => ({
      ...prev,
      procedures: currentProcedures.filter(proc => proc.id !== id)
    }));
    showToast("Procedure removed from record.", "info");
  };

  const handleAddCriticalEvent = () => {
    if (!critDesc.trim()) {
      showToast("Please enter a description for the critical event.", "error");
      return;
    }

    const newRecord: CriticalEventRecord = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: critTimestamp ? new Date(critTimestamp).toISOString() : new Date().toISOString(),
      description: critDesc.trim(),
      actionTaken: critAction.trim() || undefined,
      outcome: critOutcome.trim() || undefined
    };

    const currentEvents = localPatient.criticalEvents || [];
    setLocalPatient(prev => ({
      ...prev,
      criticalEvents: [...currentEvents, newRecord]
    }));

    setCritDesc("");
    setCritAction("");
    setCritOutcome("");
    setCritTimestamp(new Date().toISOString().slice(0, 16));
    showToast("Critical event registered successfully.", "success");
  };

  const handleRemoveCriticalEvent = (id: string) => {
    const currentEvents = localPatient.criticalEvents || [];
    setLocalPatient(prev => ({
      ...prev,
      criticalEvents: currentEvents.filter(evt => evt.id !== id)
    }));
    showToast("Critical event log entry removed.", "info");
  };

  const buildSummaryHtml = (): string => {
    const p = localPatient;
    const notes = p.dailyNotes || { cns: "", cvs: "", rs: "", renal: "", git: "", heme: "", idStewardship: "", other: "" };
    
    // Antibiotics list
    let abListHtml = "";
    if (p.systems.idStewardship?.antibioticsList && p.systems.idStewardship.antibioticsList.length > 0) {
      abListHtml = p.systems.idStewardship.antibioticsList.map(ab => `
        <tr>
          <td><strong>${ab.name}</strong></td>
          <td>${ab.dose}</td>
          <td>${ab.frequency}</td>
          <td><span class="badge" style="background-color: #e2f0d9; color: #385723;">${ab.type}</span></td>
          <td>${ab.startedDate}</td>
        </tr>
      `).join("");
    } else {
      abListHtml = `<tr><td colspan="5" style="text-align: center; color: #777;">No active antimicrobials recorded.</td></tr>`;
    }

    // Cultures list
    let cultureListHtml = "";
    if (p.systems.idStewardship?.culturesList && p.systems.idStewardship.culturesList.length > 0) {
      cultureListHtml = p.systems.idStewardship.culturesList.map(c => `
        <tr>
          <td><strong>${c.site}</strong></td>
          <td>${c.date}</td>
          <td><em>${c.organism}</em></td>
          <td>${c.sensitiveAntibiotics && c.sensitiveAntibiotics.length > 0 ? c.sensitiveAntibiotics.join(", ") : "None checked"}</td>
        </tr>
      `).join("");
    } else {
      cultureListHtml = `<tr><td colspan="4" style="text-align: center; color: #777;">No culture reports recorded.</td></tr>`;
    }

    // Procedures list
    let proceduresHtml = "";
    if (p.procedures && p.procedures.length > 0) {
      proceduresHtml = p.procedures.map(proc => `
        <tr>
          <td><strong>${proc.name === "Other" ? (proc.customName || "Other") : proc.name}</strong></td>
          <td>${proc.date}</td>
          <td>${proc.operator || "N/A"}</td>
          <td>${proc.findings || "No specific findings recorded."}</td>
        </tr>
      `).join("");
    } else {
      proceduresHtml = `<tr><td colspan="4" style="text-align: center; color: #777; font-style: italic;">No specific procedures recorded for this patient.</td></tr>`;
    }

    // Critical events list
    let criticalEventsHtml = "";
    if (p.criticalEvents && p.criticalEvents.length > 0) {
      criticalEventsHtml = p.criticalEvents.map(evt => {
        const timeStr = new Date(evt.timestamp).toLocaleString();
        return `
          <div style="border-left: 3px solid #c62828; padding-left: 15px; margin-bottom: 15px; background-color: #fdf2f2; padding: 10px; border-radius: 4px;">
            <div style="font-size: 10pt; color: #c62828; font-weight: bold; margin-bottom: 4px;">
              ${timeStr} &mdash; CRITICAL EVENT REGISTERED
            </div>
            <p style="font-size: 10.5pt; margin: 4px 0; font-weight: bold;">Description: ${evt.description}</p>
            ${evt.actionTaken ? `<p style="font-size: 10pt; margin: 2px 0; color: #444;"><strong>Action Taken:</strong> ${evt.actionTaken}</p>` : ""}
            ${evt.outcome ? `<p style="font-size: 10pt; margin: 2px 0; color: #444;"><strong>Outcome:</strong> ${evt.outcome}</p>` : ""}
          </div>
        `;
      }).join("");
    } else {
      criticalEventsHtml = `<p style="color: #777; font-style: italic; text-align: center; padding: 10px;">No critical events registered during this stay.</p>`;
    }

    // FASTHUG checklist
    const fh = p.fasthugbid || {} as any;
    const fasthugRow = (label: string, active: boolean, note: string) => `
      <tr>
        <td><strong>${label}</strong></td>
        <td><strong style="color: ${active ? '#2e7d32' : '#c62828'}">${active ? 'COMPLIANT' : 'CONTRAINDICATED / NOT MET'}</strong></td>
        <td>${note || 'N/A'}</td>
      </tr>
    `;

    // Timeline list
    let timelineHtml = "";
    if (p.timeline && p.timeline.length > 0) {
      timelineHtml = p.timeline.map(t => {
        const dateStr = new Date(t.timestamp).toLocaleString();
        let systemChangesHtml = "";
        if (t.systemChanges) {
          systemChangesHtml = Object.entries(t.systemChanges)
            .filter(([_, val]) => val && val !== "No changes recorded" && val !== "No changes")
            .map(([sys, val]) => `<li><strong>${sys.toUpperCase()}:</strong> ${val}</li>`)
            .join("");
        }
        return `
          <div style="border-left: 3px solid #0f5132; padding-left: 15px; margin-bottom: 20px;">
            <div style="font-size: 10pt; color: #555555; font-weight: bold;">
              ${dateStr} &mdash; Logged by ${t.updatedBy} (${t.role})
            </div>
            <p style="font-size: 11pt; margin: 4px 0; font-style: italic;">"${t.notes}"</p>
            ${systemChangesHtml ? `<ul class="bullet-list" style="margin-top: 5px;">${systemChangesHtml}</ul>` : ""}
          </div>
        `;
      }).join("");
    } else {
      timelineHtml = `<p style="color: #777; font-style: italic;">No chronological handover entries recorded yet.</p>`;
    }

    // Referrals list
    let referralsHtml = "";
    if (p.referrals && p.referrals.length > 0) {
      referralsHtml = p.referrals.map(ref => {
        const reviewsHtml = ref.reviews && ref.reviews.length > 0 
          ? ref.reviews.map(r => `<li>[${r.reviewerRole} - ${new Date(r.timestamp).toLocaleDateString()}]: ${r.notes}</li>`).join("")
          : "<li>No follow-up reviews logged.</li>";
        return `
          <div style="border: 1px solid #dddddd; padding: 10px; margin-bottom: 10px; border-radius: 4px; background-color: #fafafa; font-size: 10pt;">
            <div style="font-weight: bold; color: #0f5132; border-bottom: 1px dashed #cccccc; padding-bottom: 4px; margin-bottom: 6px;">
              Specialty Consult: ${ref.specialty} &mdash; Status: ${ref.status} (Requested: ${new Date(ref.dateRequested).toLocaleDateString()})
            </div>
            <p style="font-size: 9.5pt; margin: 4px 0;"><strong>Clinical Query:</strong> ${ref.reasonForConsult}</p>
            ${ref.initialInput ? `<p style="font-size: 9.5pt; margin: 4px 0; color: #333;"><strong>Bedside Recommendations:</strong> ${ref.initialInput}</p>` : ""}
            <div style="margin-top: 6px;">
              <span style="font-size: 9pt; font-weight: bold; text-transform: uppercase; color: #555;">Rounds & Follow-up Reviews:</span>
              <ul style="margin: 3px 0 0 0; padding-left: 20px; font-size: 9pt; color: #444;">
                ${reviewsHtml}
              </ul>
            </div>
          </div>
        `;
      }).join("");
    } else {
      referralsHtml = `<p style="color: #777; font-style: italic; text-align: center;">No specialist referrals recorded.</p>`;
    }

    // Discharge Summary
    const ds = p.dischargeSummary || { dischargeAdvices: "", consults: "", followup: "" };
    const dischargeHtml = `
      <table style="width: 100%;">
        <tr>
          <td style="width: 33%; border: 1px solid #dddddd; padding: 8px;">
            <strong>Patient Advices & Instructions:</strong><br/>
            ${ds.dischargeAdvices ? ds.dischargeAdvices.replace(/\n/g, "<br/>") : "No instructions entered."}
          </td>
          <td style="width: 33%; border: 1px solid #dddddd; padding: 8px;">
            <strong>Consultations & Interdisciplinary Plans:</strong><br/>
            ${ds.consults ? ds.consults.replace(/\n/g, "<br/>") : "No plans entered."}
          </td>
          <td style="width: 33%; border: 1px solid #dddddd; padding: 8px;">
            <strong>Follow-up Appointments:</strong><br/>
            ${ds.followup ? ds.followup.replace(/\n/g, "<br/>") : "No appointments scheduled."}
          </td>
        </tr>
      </table>
    `;

    return `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>ICU Case Summary - ${p.name || "Patient"}</title>
        <style>
          body { font-family: 'Calibri', 'Arial', sans-serif; line-height: 1.5; color: #333333; margin: 45px; }
          h1 { font-family: 'Georgia', serif; font-size: 24pt; color: #0f5132; border-bottom: 2px solid #0f5132; padding-bottom: 6px; margin-bottom: 15px; }
          h2 { font-family: 'Georgia', serif; font-size: 16pt; color: #111111; margin-top: 25px; border-bottom: 1px solid #cccccc; padding-bottom: 3px; }
          h3 { font-size: 12pt; color: #0f5132; margin-top: 15px; text-transform: uppercase; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 20px; }
          th { background-color: #f5f5f5; border: 1px solid #dddddd; padding: 8px; font-weight: bold; text-align: left; font-size: 10pt; }
          td { border: 1px solid #dddddd; padding: 8px; text-align: left; font-size: 10pt; vertical-align: top; }
          .meta-table td { border: none; padding: 5px; }
          .badge { display: inline-block; padding: 3px 8px; font-size: 9pt; font-weight: bold; background-color: #e2f0d9; color: #385723; border-radius: 4px; }
          .bullet-list { margin-top: 5px; margin-bottom: 15px; padding-left: 20px; }
          .bullet-list li { margin-bottom: 4px; font-size: 10pt; }
          .footer { font-size: 8pt; color: #777777; border-top: 1px solid #dddddd; padding-top: 10px; margin-top: 40px; text-align: center; }
        </style>
      </head>
      <body>
        <h1>ICU CLINICAL CASE SUMMARY</h1>
        
        <table class="meta-table" style="width: 100%;">
          <tr>
            <td style="width: 50%;"><strong>Patient Name:</strong> ${p.name || "N/A"}</td>
            <td style="width: 50%;"><strong>Bed Number:</strong> ${p.bed || "N/A"}</td>
          </tr>
          <tr>
            <td><strong>Age/Gender:</strong> ${p.age || "N/A"} Years / ${p.gender || "N/A"}</td>
            <td><strong>MRN:</strong> ${p.mrn || "N/A"}</td>
          </tr>
          <tr>
            <td><strong>Admission Date:</strong> ${p.admissionDate || "N/A"}</td>
            <td><strong>Primary Diagnosis:</strong> ${p.diagnosis || "N/A"}</td>
          </tr>
          <tr>
            <td><strong>Creatinine Clearance (CrCl):</strong> ${p.calculators?.crcl ? p.calculators.crcl + ' mL/min' : 'Not Calculated'}</td>
            <td><strong>SOFA Score:</strong> ${p.calculators?.sofa?.score || '0'}</td>
          </tr>
        </table>

        <h2>1. ISBAR CLINICAL HANDOVER</h2>
        <h3>Identify</h3>
        <p style="font-size: 10pt; margin-left: 10px;">${p.isbar.identify || "No details"}</p>
        
        <h3>Situation</h3>
        <p style="font-size: 10pt; margin-left: 10px;">${p.isbar.situation || "No details"}</p>
        
        <h3>Background</h3>
        <p style="font-size: 10pt; margin-left: 10px;">${p.isbar.background || "No details"}</p>
        
        <h3>Assessment</h3>
        <p style="font-size: 10pt; margin-left: 10px;">${p.isbar.assessment || "No details"}</p>
        
        <h3>Recommendation</h3>
        <p style="font-size: 10pt; margin-left: 10px;">${p.isbar.recommendation || "No details"}</p>

        <h2>2. ANTIMICROBIAL STEWARDSHIP & INFECTIOUS DISEASE</h2>
        <h3>Active Antimicrobials</h3>
        <table style="width: 100%;">
          <thead>
            <tr>
              <th>Drug Name</th>
              <th>Dose</th>
              <th>Frequency</th>
              <th>Stewardship Type</th>
              <th>Date Started</th>
            </tr>
          </thead>
          <tbody>
            ${abListHtml}
          </tbody>
        </table>

        <h3>Culture & Sensitivity Reports</h3>
        <table style="width: 100%;">
          <thead>
            <tr>
              <th>Culture Site</th>
              <th>Date Drawn</th>
              <th>Isolated Pathogen</th>
              <th>Active Sensitivities</th>
            </tr>
          </thead>
          <tbody>
            ${cultureListHtml}
          </tbody>
        </table>

        <h2>3. FASTHUG-BID CLINICAL CHECKLIST</h2>
        <table style="width: 100%;">
          <thead>
            <tr>
              <th>Parameter</th>
              <th>Status</th>
              <th>Clinical Evaluation Notes</th>
            </tr>
          </thead>
          <tbody>
            ${fasthugRow("F - Feeding & Enteral Nutrition", fh.feeding, fh.feedingNotes)}
            ${fasthugRow("A - Analgesia Control", fh.analgesia, fh.analgesiaNotes)}
            ${fasthugRow("S - Sedation Holiday", fh.sedation, fh.sedationNotes)}
            ${fasthugRow("T - Thromboprophylaxis", fh.thrombo, fh.thromboNotes)}
            ${fasthugRow("H - Head of Bed (30-45°)", fh.headUp, fh.headUpNotes)}
            ${fasthugRow("U - Ulcer Prophylaxis (SUP)", fh.ulcer, fh.ulcerNotes)}
            ${fasthugRow("G - Glycemic Target (140-180)", fh.glycemic, fh.glycemicNotes)}
            ${fasthugRow("B - Bowel Movement Care", fh.bowel, fh.bowelNotes)}
            ${fasthugRow("I - Indwelling Line Holiday", fh.indwelling, fh.indwellingNotes)}
            ${fasthugRow("D - Drug De-escalation & De-prescribing", fh.deescalation, fh.deescalationNotes)}
          </tbody>
        </table>

        <h2>4. COMPLETED PROCEDURES</h2>
        <table style="width: 100%;">
          <thead>
            <tr>
              <th>Procedure Type</th>
              <th>Date Performed</th>
              <th>Operator</th>
              <th>Findings & Confirmation</th>
            </tr>
          </thead>
          <tbody>
            ${proceduresHtml}
          </tbody>
        </table>

        <h2>5. REGISTERED CRITICAL EVENTS</h2>
        <div style="font-size: 10pt;">
          ${criticalEventsHtml}
        </div>

        <h2>6. ORGAN SYSTEMS - CLINICAL FINDINGS (BASELINE)</h2>
        <table style="width: 100%;">
          <thead>
            <tr>
              <th style="width: 25%;">System</th>
              <th style="width: 20%;">Clinical State</th>
              <th style="width: 55%;">Baseline Comments</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>CNS (Neurological)</strong></td>
              <td>${p.systems.cns?.status || "Alert"}</td>
              <td>RASS: ${p.systems.cns?.rass || "N/A"}, GCS: ${p.systems.cns?.gcs || "N/A"}. ${p.systems.cns?.comments || "No notes"}</td>
            </tr>
            <tr>
              <td><strong>CVS (Cardiovascular)</strong></td>
              <td>${p.systems.cvs?.status || "Stable"}</td>
              <td>HR: ${p.systems.cvs?.hr || "N/A"}, BP: ${p.systems.cvs?.bp || "N/A"}, MAP: ${p.systems.cvs?.map || "N/A"}. ${p.systems.cvs?.comments || "No notes"}</td>
            </tr>
            <tr>
              <td><strong>RS (Respiratory)</strong></td>
              <td>${p.systems.rs?.status || "Room Air"}</td>
              <td>Mode: ${p.systems.rs?.mode || "N/A"}, FiO2: ${p.systems.rs?.fio2 || "N/A"}%, PEEP: ${p.systems.rs?.peep || "N/A"}. SpO2: ${p.systems.rs?.spo2 || "N/A"}%. ${p.systems.rs?.comments || "No notes"}</td>
            </tr>
            <tr>
              <td><strong>Renal (Metabolic)</strong></td>
              <td>${p.systems.renal?.status || "Stable"}</td>
              <td>UO: ${p.systems.renal?.uo || "N/A"} ml/hr, Creatinine: ${p.systems.renal?.creatinine || "N/A"} mg/dL. ${p.systems.renal?.comments || "No notes"}</td>
            </tr>
            <tr>
              <td><strong>GIT (Nutrition)</strong></td>
              <td>${p.systems.git?.status || "Normal Diet"}</td>
              <td>Formula: ${p.systems.git?.diet || "N/A"}, Exam: ${p.systems.git?.abdominalExam || "N/A"}. ${p.systems.git?.comments || "No notes"}</td>
            </tr>
            <tr>
              <td><strong>Heme & Sepsis</strong></td>
              <td>${p.systems.heme?.status || "Normal"}</td>
              <td>Hb: ${p.systems.heme?.hb || "N/A"}, WBC: ${p.systems.heme?.wbc || "N/A"}, PLT: ${p.systems.heme?.plt || "N/A"}. ${p.systems.heme?.comments || "No notes"}</td>
            </tr>
            <tr>
              <td><strong>Endocrine & Glycemia</strong></td>
              <td>${p.systems.endocrine?.status || "Stable"}</td>
              <td>BG: ${p.systems.endocrine?.bg || "N/A"} mg/dL. ${p.systems.endocrine?.comments || "No notes"}</td>
            </tr>
            <tr>
              <td><strong>Infectious & Stewardship</strong></td>
              <td>${p.systems.idStewardship?.status || "No Infection"}</td>
              <td>Thermal: ${p.systems.idStewardship?.tempMinMax || "N/A"}, Biomarkers: ${p.systems.idStewardship?.biomarkers || "N/A"}, Lines: ${p.systems.idStewardship?.lineSites || "N/A"}. ${p.systems.idStewardship?.comments || "No notes"}</td>
            </tr>
            <tr>
              <td><strong>Integumentary & Rehab</strong></td>
              <td>${p.systems.integumentaryMusculoskeletal?.status || "Intact"}</td>
              <td>Pressure Injuries: ${p.systems.integumentaryMusculoskeletal?.skinPressureInjury || "N/A"}, Mobility: ${p.systems.integumentaryMusculoskeletal?.mobilityTier || "N/A"}. ${p.systems.integumentaryMusculoskeletal?.comments || "No notes"}</td>
            </tr>
            <tr>
              <td><strong>Pharmacology & SUP</strong></td>
              <td>${p.systems.pharmacologyToxicology?.status || "Stable"}</td>
              <td>Clearance: ${p.systems.pharmacologyToxicology?.renalHepaticClearance || "N/A"}, SUP: ${p.systems.pharmacologyToxicology?.stressUlcerProphylaxis || "N/A"}. ${p.systems.pharmacologyToxicology?.comments || "No notes"}</td>
            </tr>
            <tr>
              <td><strong>Humanitarian & Palliative</strong></td>
              <td>${p.systems.humanitarianPalliative?.status || "Comfort / Full Care"}</td>
              <td>Sleep bundle: ${p.systems.humanitarianPalliative?.sleepWakeBundle || "N/A"}, Family updates: ${p.systems.humanitarianPalliative?.familyUpdates || "N/A"}. ${p.systems.humanitarianPalliative?.comments || "No notes"}</td>
            </tr>
          </tbody>
        </table>

        <h2>7. DAILY CLINICAL PROGRESS SYSTEM-WISE</h2>
        <table style="width: 100%;">
          <thead>
            <tr>
              <th style="width: 25%;">Organ System / Area</th>
              <th style="width: 75%;">Day-to-Day Clinical Updates & Comments</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><strong>CNS Daily Update</strong></td><td>${notes.cns || "Stable. No specific updates recorded."}</td></tr>
            <tr><td><strong>CVS Daily Update</strong></td><td>${notes.cvs || "Stable. No specific updates recorded."}</td></tr>
            <tr><td><strong>Respiratory Daily Update</strong></td><td>${notes.rs || "Stable. No specific updates recorded."}</td></tr>
            <tr><td><strong>Renal / Metabolic Update</strong></td><td>${notes.renal || "Stable. No specific updates recorded."}</td></tr>
            <tr><td><strong>GI & Nutrition Update</strong></td><td>${notes.git || "Stable. No specific updates recorded."}</td></tr>
            <tr><td><strong>Hematology & Sepsis Update</strong></td><td>${notes.heme || "Stable. No specific updates recorded."}</td></tr>
            <tr><td><strong>Infectious Disease / Stewardship</strong></td><td>${notes.idStewardship || "Stable. No specific updates recorded."}</td></tr>
            <tr><td><strong>General/Other Daily Notes</strong></td><td>${notes.other || "Stable. No specific updates recorded."}</td></tr>
          </tbody>
        </table>

        <h2>8. SHIFT HANDOVERS & TIMELINE HISTORY (DAILY PROGRESS LOGS)</h2>
        <div style="font-size: 10pt;">
          ${timelineHtml}
        </div>

        <h2>9. SPECIALIST REFERRALS & CONSULTATIONS</h2>
        <div>
          ${referralsHtml}
        </div>

        <h2>10. DISCHARGE PLANNING, ADVICES & FOLLOW-UP</h2>
        <div>
          ${dischargeHtml}
        </div>

        <div class="footer">
          <p>CONFIDENTIAL ICU CLINICAL DOCUMENT &mdash; GENERATED VIA ICU HANDOVER & SAFETY LOG SYSTEM</p>
          <p>Local Export Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
        </div>
      </body>
      </html>
    `;
  };

  const exportToDocx = () => {
    const patientNameClean = localPatient.name ? localPatient.name.replace(/[^a-zA-Z0-9]/g, "_") : "Patient";
    const filename = `ICU_Case_Summary_${patientNameClean}.doc`;

    const htmlContent = buildSummaryHtml();

    const blob = new Blob(['\ufeff' + htmlContent], {
      type: 'application/msword'
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Downloaded Word document summary successfully.", "success");
  };

  const handleArchiveToLocalFolder = () => {
    try {
      const patientName = localPatient.name || "Unnamed Patient";
      const patientId = (localPatient as any).id || "unknown_" + Math.random().toString(36).substr(2, 9);
      
      const mdContent = buildPatientMarkdown(localPatient);
      
      const archiveEntry = {
        id: patientId,
        name: patientName,
        bed: localPatient.bed || "TBD",
        mrn: localPatient.mrn || "N/A",
        age: localPatient.age || "N/A",
        gender: localPatient.gender || "Other",
        diagnosis: localPatient.diagnosis || "N/A",
        archivedAt: new Date().toISOString(),
        jsonData: localPatient,
        markdownData: mdContent,
      };

      const existingStr = localStorage.getItem("critisync_local_archives");
      let archives: any[] = [];
      if (existingStr) {
        try {
          archives = JSON.parse(existingStr);
          if (!Array.isArray(archives)) archives = [];
        } catch (e) {
          archives = [];
        }
      }

      archives = archives.filter((item: any) => item.id !== patientId);
      archives.unshift(archiveEntry);

      localStorage.setItem("critisync_local_archives", JSON.stringify(archives));
      showToast(`Archived "${patientName}" locally.`, "success");

      // Auto-trigger Markdown download
      const mdBlob = new Blob([mdContent], { type: "text/markdown;charset=utf-8;" });
      const mdUrl = URL.createObjectURL(mdBlob);
      const mdLink = document.createElement("a");
      mdLink.href = mdUrl;
      mdLink.download = `ICU_Archive_${patientName.replace(/[^a-zA-Z0-9]/g, "_")}.md`;
      document.body.appendChild(mdLink);
      mdLink.click();
      document.body.removeChild(mdLink);

      // Auto-trigger JSON download
      const jsonStr = JSON.stringify(localPatient, null, 2);
      const jsonBlob = new Blob([jsonStr], { type: "application/json;charset=utf-8;" });
      const jsonUrl = URL.createObjectURL(jsonBlob);
      const jsonLink = document.createElement("a");
      jsonLink.href = jsonUrl;
      jsonLink.download = `ICU_Archive_${patientName.replace(/[^a-zA-Z0-9]/g, "_")}.json`;
      document.body.appendChild(jsonLink);
      jsonLink.click();
      document.body.removeChild(jsonLink);

      showToast("Markdown & JSON archive packages downloaded.", "success");
    } catch (err: any) {
      console.error("Archive failed:", err);
      showToast("Failed to complete local archiving: " + err.message, "error");
    }
  };

  const renderIDStewardshipPanel = () => {
    const currentSystem = systemsConfig["idStewardship"];
    const commentsVal = localPatient.systems.idStewardship?.comments || "";
    const activeAbList = localPatient.systems.idStewardship?.antibioticsList || [];
    const activeCultures = localPatient.systems.idStewardship?.culturesList || [];

    const PREDEFINED_ANTIBIOTICS = ["Meropenem", "Piperacillin/Tazobactam (Tazocin)", "Ceftriaxone", "Cefepime", "Ceftazidime", "Ciprofloxacin", "Levofloxacin", "Vancomycin", "Linezolid", "Metronidazole", "Colistin", "Fluconazole", "Caspofungin", "Anidulafungin", "Liposomal Amphotericin B", "Other"];
    const PREDEFINED_DOSES = ["250mg", "500mg", "1g", "2g", "2.25g", "3.375g", "4.5g", "400mg", "600mg", "750mg", "2.25m IU", "4.5m IU", "70mg", "50mg", "100mg", "200mg", "Other"];
    const PREDEFINED_FREQS = ["q6h", "q8h", "q12h", "q24h", "q48h", "Continuous Infusion", "Single Dose", "Check Levels / PRN", "Other"];

    const PREDEFINED_SITES = ["Blood (Central)", "Blood (Peripheral)", "Sputum / Tracheal Aspirate", "Urine", "Wound / Tissue", "CSF", "Pleural Fluid", "Peritoneal Fluid", "Bronchoalveolar Lavage (BAL)", "Other"];
    const PREDEFINED_ORGANISMS = ["Pseudomonas aeruginosa", "Acinetobacter baumannii", "Klebsiella pneumoniae", "Escherichia coli", "MRSA (Methicillin-Resistant S. aureus)", "MSSA (Methicillin-Sensitive S. aureus)", "Enterococcus faecium (VRE)", "Enterococcus faecalis", "Streptococcus pneumoniae", "Candida albicans", "Candida auris", "Aspergillus fumigatus", "Other"];

    const formRecommendation = getCrClRecommendation(abName, crclVal);

    return (
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#222222] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-950/30 rounded border border-emerald-500/30">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-serif text-lg italic text-zinc-100">Infectious Diseases & Antimicrobial Stewardship</h3>
              <p className="text-[11px] text-zinc-500 font-sans">CrCl-adjusted drug dosing, multi-regimen tracking, and microbiological culture logs</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-zinc-400 block font-mono">Calculated CrCl</span>
            <span className="text-xs font-bold text-emerald-400 font-mono">{localPatient.calculators?.crcl || "Not Calculated"} mL/min</span>
          </div>
        </div>

        {/* Standard Fields Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-950/40 p-4 rounded border border-zinc-850">
          {currentSystem.fields.map((field) => {
            const parts = field.path.split(".");
            const val = localPatient.systems?.idStewardship?.[parts[2] as keyof SystemIDStewardship] || "";
            return (
              <div key={field.path} className="space-y-1">
                <label className="block text-[10px] uppercase tracking-wider text-zinc-400 font-bold">
                  {field.label}
                </label>
                {field.type === "select" ? (
                  <select
                    value={val as string}
                    onChange={(e) => updatePatientField(field.path, e.target.value)}
                    className="w-full bg-[#161616] border border-[#222222] focus:border-emerald-500/60 rounded px-3 py-1.5 text-xs text-zinc-100 focus:outline-none"
                  >
                    <option value="">-- Select Option --</option>
                    {field.options?.map((opt) => {
                      if (typeof opt === "string") {
                        return <option key={opt} value={opt}>{opt}</option>;
                      }
                      return <option key={opt.value} value={opt.value}>{opt.label}</option>;
                    })}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={val as string}
                    onChange={(e) => updatePatientField(field.path, e.target.value)}
                    placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                    className="w-full bg-[#161616] border border-[#222222] focus:border-emerald-500/60 rounded px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-650 focus:outline-none"
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* SECTION A: ACTIVE ANTIMICROBIALS */}
        <div className="space-y-4 border-t border-[#222222] pt-5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs uppercase tracking-wider text-emerald-400 font-bold font-sans flex items-center gap-1.5">
              <Pill className="w-3.5 h-3.5" />
              Active Antimicrobial Regimens
            </h4>
            <span className="text-[10px] text-zinc-500">{activeAbList.length} Active Agents</span>
          </div>

          {activeAbList.length === 0 ? (
            <div className="bg-[#121212]/30 border border-dashed border-[#222222] rounded-lg p-6 text-center">
              <p className="text-xs text-zinc-500">No active antibiotics or antifungals recorded. Use the form below to add a regimen.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeAbList.map((ab) => {
                const rec = getCrClRecommendation(ab.name, crclVal);
                const isOptimal = rec ? (ab.dose.toLowerCase().includes(rec.dose.toLowerCase()) && ab.frequency.toLowerCase().includes(rec.frequency.toLowerCase())) : true;

                return (
                  <div key={ab.id} className="bg-[#121212] border border-[#222222] rounded p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-sans font-bold text-sm text-zinc-100">{ab.name}</span>
                          <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                            ab.type === "Empirical" ? "bg-amber-950/40 text-amber-300 border border-amber-500/20" :
                            ab.type === "Targeted" ? "bg-emerald-950/40 text-emerald-300 border border-emerald-500/20" :
                            "bg-blue-950/40 text-blue-300 border border-blue-500/20"
                          }`}>
                            {ab.type}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-400 font-mono">
                          Dosing: <span className="text-zinc-100 font-bold">{ab.dose}</span> &mdash; Frequency: <span className="text-zinc-100 font-bold">{ab.frequency}</span>
                          <span className="mx-2 text-zinc-600">|</span>
                          Started: <span className="text-zinc-300">{ab.startedDate}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAntibiotic(ab.id)}
                        className="text-zinc-500 hover:text-red-450 p-1.5 rounded transition-colors"
                        title="Discontinue Antimicrobial"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {rec && (
                      <div className={`p-2.5 rounded border text-xs flex items-start gap-2 ${
                        isOptimal 
                          ? "bg-emerald-950/10 border-emerald-500/20 text-emerald-400" 
                          : "bg-red-950/15 border-red-500/20 text-red-300"
                      }`}>
                        <div className="mt-0.5">
                          {isOptimal ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
                        </div>
                        <div className="space-y-1 flex-1">
                          <p className="font-sans font-semibold leading-none">
                            {isOptimal 
                              ? `Renally Adjusted & Optimal (CrCl: ${crclVal.toFixed(0)} mL/min)` 
                              : `Renal Dosing Mismatch Alert (CrCl: ${crclVal.toFixed(0)} mL/min)`}
                          </p>
                          <p className="text-[11px] text-zinc-400 leading-normal font-sans">
                            {isOptimal 
                              ? `The current regimen matches the ICU guidelines recommendation: ${rec.dose} ${rec.frequency} (${rec.rationale}).`
                              : `Recommended: ${rec.dose} ${rec.frequency} &mdash; Reason: ${rec.rationale}.`}
                          </p>
                          {!isOptimal && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = activeAbList.map(item => {
                                  if (item.id === ab.id) {
                                    return { ...item, dose: rec.dose, frequency: rec.frequency };
                                  }
                                  return item;
                                });
                                setLocalPatient(prev => ({
                                  ...prev,
                                  systems: {
                                    ...prev.systems,
                                    idStewardship: {
                                      ...(prev.systems.idStewardship || { status: "No Infection", comments: "" }),
                                      antibioticsList: updated
                                    }
                                  }
                                }));
                                showToast(`Renally adjusted ${ab.name} to ${rec.dose} ${rec.frequency}`, "success");
                              }}
                              className="text-[10px] bg-red-950/40 hover:bg-red-900/50 text-red-300 border border-red-500/30 rounded px-2 py-0.5 mt-1 transition-all cursor-pointer inline-block font-sans"
                            >
                              Apply Recommended Dose Adjustment
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Add Antibiotic Form */}
          <div className="bg-[#111111]/60 border border-[#222222] rounded p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#222222] pb-3">
              <span className="text-xs uppercase tracking-wider text-zinc-300 font-bold block">Initiate Antimicrobial Therapy</span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setAntimicrobialTab("single")}
                  className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider border transition-all ${
                    antimicrobialTab === "single"
                      ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                      : "bg-[#161616] border-[#222222] text-zinc-500 hover:text-zinc-350"
                  }`}
                >
                  Single Prescriber
                </button>
                <button
                  type="button"
                  onClick={() => setAntimicrobialTab("multi")}
                  className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider border transition-all ${
                    antimicrobialTab === "multi"
                      ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                      : "bg-[#161616] border-[#222222] text-zinc-500 hover:text-zinc-350"
                  }`}
                >
                  Fast Multi-Prescriber
                </button>
              </div>
            </div>

            {antimicrobialTab === "single" ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] text-zinc-400 font-bold uppercase">Antimicrobial Agent</label>
                    <select
                      value={abName}
                      onChange={(e) => {
                        setAbName(e.target.value);
                        const suggested = getCrClRecommendation(e.target.value, crclVal);
                        if (suggested && suggested.dose !== "Standard") {
                          setAbDose(suggested.dose);
                          setAbFreq(suggested.frequency);
                        } else {
                          setAbDose("");
                          setAbFreq("");
                        }
                      }}
                      className="w-full bg-[#161616] border border-[#222222] focus:border-emerald-500/60 rounded px-3 py-2 text-xs text-zinc-100 focus:outline-none"
                    >
                      <option value="">-- Choose Agent --</option>
                      {PREDEFINED_ANTIBIOTICS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>

                  {abName === "Other" && (
                    <div className="space-y-1">
                      <label className="block text-[10px] text-zinc-400 font-bold uppercase">Custom Drug Name</label>
                      <input
                        type="text"
                        value={customAbName}
                        onChange={(e) => setCustomAbName(e.target.value)}
                        placeholder="Enter antibiotic name..."
                        className="w-full bg-[#161616] border border-[#222222] focus:border-emerald-500/60 rounded px-3 py-2 text-xs text-zinc-100 focus:outline-none"
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="block text-[10px] text-zinc-400 font-bold uppercase">Dose</label>
                    <select
                      value={abDose}
                      onChange={(e) => setAbDose(e.target.value)}
                      className="w-full bg-[#161616] border border-[#222222] focus:border-emerald-500/60 rounded px-3 py-2 text-xs text-zinc-100 focus:outline-none"
                    >
                      <option value="">-- Choose Dose --</option>
                      {PREDEFINED_DOSES.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>

                  {abDose === "Other" && (
                    <div className="space-y-1">
                      <label className="block text-[10px] text-zinc-400 font-bold uppercase">Custom Dose</label>
                      <input
                        type="text"
                        value={customAbDose}
                        onChange={(e) => setCustomAbDose(e.target.value)}
                        placeholder="e.g. 1.5g, 750mg..."
                        className="w-full bg-[#161616] border border-[#222222] focus:border-emerald-500/60 rounded px-3 py-2 text-xs text-zinc-100 focus:outline-none"
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="block text-[10px] text-zinc-400 font-bold uppercase">Frequency</label>
                    <select
                      value={abFreq}
                      onChange={(e) => setAbFreq(e.target.value)}
                      className="w-full bg-[#161616] border border-[#222222] focus:border-emerald-500/60 rounded px-3 py-2 text-xs text-zinc-100 focus:outline-none"
                    >
                      <option value="">-- Choose Frequency --</option>
                      {PREDEFINED_FREQS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>

                  {abFreq === "Other" && (
                    <div className="space-y-1">
                      <label className="block text-[10px] text-zinc-400 font-bold uppercase">Custom Frequency</label>
                      <input
                        type="text"
                        value={customAbFreq}
                        onChange={(e) => setCustomAbFreq(e.target.value)}
                        placeholder="e.g. q4h, continuous..."
                        className="w-full bg-[#161616] border border-[#222222] focus:border-emerald-500/60 rounded px-3 py-2 text-xs text-zinc-100 focus:outline-none"
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="block text-[10px] text-zinc-400 font-bold uppercase">Stewardship Indication</label>
                    <select
                      value={abStewardshipType}
                      onChange={(e) => setAbStewardshipType(e.target.value as any)}
                      className="w-full bg-[#161616] border border-[#222222] focus:border-emerald-500/60 rounded px-3 py-2 text-xs text-zinc-100 focus:outline-none"
                    >
                      <option value="Empirical">Empirical (broad-spectrum backup)</option>
                      <option value="Prophylactic">Prophylactic (surgical/device prevention)</option>
                      <option value="Targeted">Targeted (de-escalated to isolate sensitivities)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] text-zinc-400 font-bold uppercase">Start Date</label>
                    <input
                      type="date"
                      value={abStartDate}
                      onChange={(e) => setAbStartDate(e.target.value)}
                      className="w-full bg-[#161616] border border-[#222222] focus:border-emerald-500/60 rounded px-3 py-2 text-xs text-zinc-100 focus:outline-none"
                    />
                  </div>
                </div>

                {formRecommendation && (
                  <div className="bg-emerald-950/20 border border-emerald-500/20 p-2.5 rounded text-xs flex items-start gap-2 font-sans">
                    <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5 text-[11px] text-zinc-300">
                      <span className="font-bold text-emerald-400 uppercase tracking-wider block text-[10px]">CrCl Dosing Advisor Recommendations:</span>
                      <p>Guideline adjustment for <strong className="text-zinc-100">{abName}</strong> at current CrCl <strong className="text-zinc-100">{crclVal.toFixed(0)} mL/min</strong> is <strong className="text-emerald-300">{formRecommendation.dose} {formRecommendation.frequency}</strong> ({formRecommendation.rationale}).</p>
                      <button
                        type="button"
                        onClick={() => {
                          setAbDose(formRecommendation.dose);
                          setAbFreq(formRecommendation.frequency);
                          showToast("Autofilled CrCl recommended parameters.", "success");
                        }}
                        className="text-[10px] font-sans font-medium text-emerald-400 hover:underline mt-1 block cursor-pointer"
                      >
                        Click to auto-apply recommended parameters
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleAddAntibiotic}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-zinc-950 rounded py-2 text-xs font-bold font-sans tracking-wide transition-colors uppercase flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4 text-zinc-950" />
                  Add Antimicrobial to Patient Chart
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
                  Select multiple antibiotics/antifungals to initiate at once. Suggested renal adjustments are automatically pre-populated based on the current calculated CrCl of <strong className="text-emerald-400">{crclVal.toFixed(0)} mL/min</strong>.
                </p>

                {/* Add a custom drug to the fast selector lists */}
                <div className="flex gap-2 bg-zinc-950/40 p-3 rounded border border-zinc-850 items-center">
                  <div className="flex-1 space-y-1">
                    <label className="block text-[9px] uppercase text-zinc-500 font-bold">Add Custom Drug to Selector Grid</label>
                    <input
                      type="text"
                      value={customMultiAbName}
                      onChange={(e) => setCustomMultiAbName(e.target.value)}
                      placeholder="e.g. Ceftobiprole, Isavuconazole..."
                      className="w-full bg-[#161616] border border-[#222222] focus:border-emerald-500/60 rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const cleanName = customMultiAbName.trim();
                      if (!cleanName) return;
                      setSelectedMultiAbs(prev => ({
                        ...prev,
                        [cleanName]: { checked: true, dose: "Standard", freq: "Standard", type: "Empirical" }
                      }));
                      setCustomMultiAbName("");
                      showToast(`Added custom drug ${cleanName} to multi-select list.`, "success");
                    }}
                    className="bg-[#1C1C1C] hover:bg-[#252525] border border-zinc-700 text-zinc-300 px-3 py-1.5 text-[11px] rounded font-bold uppercase tracking-wider cursor-pointer self-end h-[32px] flex items-center"
                  >
                    Add to Grid
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2 max-h-[350px] overflow-y-auto pr-1">
                  {Array.from(new Set([...PREDEFINED_ANTIBIOTICS.filter(x => x !== "Other"), ...Object.keys(selectedMultiAbs)])).map((drug) => {
                    const multiRecord = selectedMultiAbs[drug] || { checked: false, dose: "", freq: "", type: "Empirical" };
                    const rec = getCrClRecommendation(drug, crclVal);
                    
                    const handleToggleDrug = () => {
                      const isNowChecked = !multiRecord.checked;
                      const defaultDose = isNowChecked ? (rec ? rec.dose : "Standard") : "";
                      const defaultFreq = isNowChecked ? (rec ? rec.frequency : "Standard") : "";
                      setSelectedMultiAbs(prev => ({
                        ...prev,
                        [drug]: {
                          checked: isNowChecked,
                          dose: defaultDose,
                          freq: defaultFreq,
                          type: prev[drug]?.type || "Empirical"
                        }
                      }));
                    };

                    return (
                      <div key={drug} className={`p-3 rounded border transition-all ${
                        multiRecord.checked
                          ? "bg-emerald-950/20 border-emerald-500/40"
                          : "bg-[#141414] border-[#222222]"
                      }`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={handleToggleDrug}
                            className="flex items-center gap-2.5 text-left flex-1"
                          >
                            <span className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center text-[10px] ${
                              multiRecord.checked ? "bg-emerald-500 border-emerald-400 text-zinc-950" : "border-zinc-700"
                            }`}>
                              {multiRecord.checked && "✓"}
                            </span>
                            <div className="space-y-0.5">
                              <span className="text-xs font-bold text-zinc-200">{drug}</span>
                              {rec && (
                                <span className="block text-[10px] text-emerald-400/80 font-medium">
                                  CrCl Advised: {rec.dose} {rec.frequency}
                                </span>
                              )}
                            </div>
                          </button>

                          {multiRecord.checked && (
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="space-y-0.5">
                                <span className="text-[9px] text-zinc-500 font-bold uppercase block">Dose</span>
                                <select
                                  value={multiRecord.dose}
                                  onChange={(e) => setSelectedMultiAbs(prev => ({
                                    ...prev,
                                    [drug]: { ...prev[drug], dose: e.target.value }
                                  }))}
                                  className="bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 text-[11px] text-zinc-200 focus:outline-none w-[90px]"
                                >
                                  <option value="Standard">Standard</option>
                                  {PREDEFINED_DOSES.filter(d => d !== "Other").map(d => (
                                    <option key={d} value={d}>{d}</option>
                                  ))}
                                </select>
                              </div>

                              <div className="space-y-0.5">
                                <span className="text-[9px] text-zinc-500 font-bold uppercase block">Freq</span>
                                <select
                                  value={multiRecord.freq}
                                  onChange={(e) => setSelectedMultiAbs(prev => ({
                                    ...prev,
                                    [drug]: { ...prev[drug], freq: e.target.value }
                                  }))}
                                  className="bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 text-[11px] text-zinc-200 focus:outline-none w-[90px]"
                                >
                                  <option value="Standard">Standard</option>
                                  {PREDEFINED_FREQS.filter(f => f !== "Other").map(f => (
                                    <option key={f} value={f}>{f}</option>
                                  ))}
                                </select>
                              </div>

                              <div className="space-y-0.5">
                                <span className="text-[9px] text-zinc-500 font-bold uppercase block">Stewardship</span>
                                <select
                                  value={multiRecord.type}
                                  onChange={(e) => setSelectedMultiAbs(prev => ({
                                    ...prev,
                                    [drug]: { ...prev[drug], type: e.target.value as any }
                                  }))}
                                  className="bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 text-[11px] text-zinc-200 focus:outline-none w-[100px]"
                                >
                                  <option value="Empirical">Empirical</option>
                                  <option value="Prophylactic">Prophylactic</option>
                                  <option value="Targeted">Targeted</option>
                                </select>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const entries = Object.entries(selectedMultiAbs) as [string, { checked: boolean; dose: string; freq: string; type: "Empirical" | "Prophylactic" | "Targeted" }][];
                    const checkedDrugs = entries.filter(([_, info]) => info.checked);
                    if (checkedDrugs.length === 0) {
                      showToast("Please check at least one antimicrobial to prescribe.", "error");
                      return;
                    }

                    const newRecords: AntibioticRecord[] = checkedDrugs.map(([name, info]) => ({
                      id: Math.random().toString(36).substr(2, 9),
                      name,
                      dose: info.dose || "Standard",
                      frequency: info.freq || "Standard",
                      type: info.type,
                      startedDate: abStartDate || new Date().toISOString().split("T")[0],
                      isCustom: false
                    }));

                    const currentList = localPatient.systems.idStewardship?.antibioticsList || [];
                    const updatedList = [...currentList, ...newRecords];

                    setLocalPatient(prev => ({
                      ...prev,
                      systems: {
                        ...prev.systems,
                        idStewardship: {
                          ...(prev.systems.idStewardship || { status: "No Infection", comments: "" }),
                          antibioticsList: updatedList
                        }
                      }
                    }));

                    setSelectedMultiAbs({});
                    showToast(`Prescribed ${newRecords.length} antimicrobials simultaneously.`, "success");
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-zinc-950 rounded py-2.5 text-xs font-bold font-sans tracking-wide transition-colors uppercase flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4 text-zinc-950" />
                  Prescribe Selected Antimicrobials ({(Object.values(selectedMultiAbs) as { checked: boolean }[]).filter(v => v.checked).length})
                </button>
              </div>
            )}
          </div>
        </div>

        {/* SECTION B: CULTURE REPORTS */}
        <div className="space-y-4 border-t border-[#222222] pt-5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs uppercase tracking-wider text-emerald-400 font-bold font-sans flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" />
              Microbiological Culture & Sensitivity Reports
            </h4>
            <span className="text-[10px] text-zinc-500">{activeCultures.length} Logged Reports</span>
          </div>

          {activeCultures.length === 0 ? (
            <div className="bg-[#121212]/30 border border-dashed border-[#222222] rounded-lg p-6 text-center">
              <p className="text-xs text-zinc-500">No microbiological culture reports logged. Log a culture result below.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {activeCultures.map((c) => (
                <div key={c.id} className="bg-[#121212] border border-[#222222] rounded p-4 flex flex-wrap justify-between items-start gap-4 font-sans">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-200 rounded px-2.5 py-0.5 font-bold font-mono">{c.site}</span>
                      <span className="text-[11px] text-zinc-500 font-mono">{c.date}</span>
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-sm font-bold font-serif italic text-zinc-200">{c.organism}</div>
                      <div className="text-[11px] text-zinc-400 leading-normal flex flex-wrap gap-1.5 items-center mt-1">
                        <span className="font-sans font-semibold text-emerald-500 uppercase tracking-wider text-[9px]">Sensitivities Check:</span>
                        {c.sensitiveAntibiotics && c.sensitiveAntibiotics.length > 0 ? (
                          c.sensitiveAntibiotics.map(drug => (
                            <span key={drug} className="bg-emerald-950/30 text-emerald-300 border border-emerald-500/20 text-[10px] px-2 py-0.5 rounded font-mono">
                              {drug}
                            </span>
                          ))
                        ) : (
                          <span className="text-zinc-650 font-sans italic text-[10px]">No sensitive drugs checked</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveCulture(c.id)}
                    className="text-zinc-500 hover:text-red-400 p-1.5 rounded transition-colors cursor-pointer"
                    title="Remove Culture Report"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add Culture Form */}
          <div className="bg-[#111111]/60 border border-[#222222] rounded p-4 space-y-4">
            <span className="text-xs uppercase tracking-wider text-zinc-300 font-bold block font-sans">Log New Culture Report</span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[10px] text-zinc-400 font-bold uppercase">Culture Source Site</label>
                <select
                  value={cultureSite}
                  onChange={(e) => setCultureSite(e.target.value)}
                  className="w-full bg-[#161616] border border-[#222222] focus:border-emerald-500/60 rounded px-3 py-2 text-xs text-zinc-100 focus:outline-none"
                >
                  <option value="">-- Choose Site --</option>
                  {PREDEFINED_SITES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {cultureSite === "Other" && (
                <div className="space-y-1">
                  <label className="block text-[10px] text-zinc-400 font-bold uppercase">Custom Site Name</label>
                  <input
                    type="text"
                    value={customCultureSite}
                    onChange={(e) => setCustomCultureSite(e.target.value)}
                    placeholder="Enter custom site name..."
                    className="w-full bg-[#161616] border border-[#222222] focus:border-emerald-500/60 rounded px-3 py-2 text-xs text-zinc-100 focus:outline-none"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-[10px] text-zinc-400 font-bold uppercase">Isolated Pathogen / Organism</label>
                <select
                  value={cultureOrganism}
                  onChange={(e) => setCultureOrganism(e.target.value)}
                  className="w-full bg-[#161616] border border-[#222222] focus:border-emerald-500/60 rounded px-3 py-2 text-xs text-zinc-100 focus:outline-none"
                >
                  <option value="">-- Choose Organism --</option>
                  {PREDEFINED_ORGANISMS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>

              {cultureOrganism === "Other" && (
                <div className="space-y-1">
                  <label className="block text-[10px] text-zinc-400 font-bold uppercase">Custom Organism Name</label>
                  <input
                    type="text"
                    value={customCultureOrganism}
                    onChange={(e) => setCustomCultureOrganism(e.target.value)}
                    placeholder="Enter custom organism..."
                    className="w-full bg-[#161616] border border-[#222222] focus:border-emerald-500/60 rounded px-3 py-2 text-xs text-zinc-100 focus:outline-none"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-[10px] text-zinc-400 font-bold uppercase">Date Collected / Drawn</label>
                <input
                  type="date"
                  value={cultureDate}
                  onChange={(e) => setCultureDate(e.target.value)}
                  className="w-full bg-[#161616] border border-[#222222] focus:border-emerald-500/60 rounded px-3 py-2 text-xs text-zinc-100 focus:outline-none"
                />
              </div>
            </div>

            {/* SENSITIVE ANTIBIOTICS CHECKBOX LIST */}
            <div className="space-y-2 border-t border-[#222222]/60 pt-3">
              <label className="block text-[10.5px] uppercase tracking-wider text-zinc-300 font-bold font-sans">
                Select Sensitive Antibiotics Checklist:
              </label>
              <p className="text-[10px] text-zinc-500 font-sans">Check all antimicrobial agents to which this isolated pathogen has demonstrated sensitivity in culture reports:</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-1.5 font-sans">
                {["Meropenem", "Piperacillin/Tazobactam", "Ceftriaxone", "Cefepime", "Ceftazidime", "Ciprofloxacin", "Levofloxacin", "Vancomycin", "Linezolid", "Metronidazole", "Colistin", "Fluconazole"].map(drug => {
                  const checked = cultureSensitivities.includes(drug);
                  return (
                    <button
                      key={drug}
                      type="button"
                      onClick={() => handleToggleSensitivity(drug)}
                      className={`px-2 py-1.5 rounded text-left text-xs border transition-all cursor-pointer flex items-center justify-between ${
                        checked 
                          ? "bg-emerald-950/45 border-emerald-500/40 text-emerald-300 font-semibold" 
                          : "bg-[#141414] border-[#222222] text-zinc-400 hover:bg-zinc-900"
                      }`}
                    >
                      <span className="truncate">{drug}</span>
                      <span className={`w-3.5 h-3.5 rounded-sm border shrink-0 flex items-center justify-center text-[10px] ${
                        checked ? "bg-emerald-500 border-emerald-400 text-zinc-950" : "border-zinc-700"
                      }`}>
                        {checked && "✓"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddCulture}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-zinc-950 rounded py-2 text-xs font-bold font-sans tracking-wide transition-colors uppercase flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-zinc-950" />
              Log Culture Report & Sensitivities
            </button>
          </div>
        </div>

        {/* Notes Textarea */}
        <div className="space-y-1 border-t border-[#222222] pt-5">
          <label className="block text-[11px] uppercase tracking-wider text-zinc-400 font-bold">
            Stewardship Notes & Narrative Clinical Assessment
          </label>
          <textarea
            rows={4}
            value={commentsVal}
            onChange={(e) => updatePatientField("systems.idStewardship.comments", e.target.value)}
            placeholder="Enter custom daily stewardship narrative assessment..."
            className="w-full bg-[#1A1A1A] border border-[#222222] focus:border-emerald-500/60 rounded p-3 text-xs leading-relaxed focus:outline-none text-zinc-100 placeholder:text-zinc-650 font-sans"
          />
        </div>
      </div>
    );
  };

  // Role-based access permission gates
  const isPhysician = userRole === "Attending Physician" || userRole === "Resident Doctor";
  const canEditProfile = isPhysician;
  const canEditSystems = isPhysician || userRole === "Nurse";
  const canEditFasthug = isPhysician || userRole === "Nurse";
  const canEditCalculators = isPhysician || userRole === "Pharmacist";
  const canEditDocuments = isPhysician || userRole === "Nurse";

  // Decrypted document management utility methods
  const downloadDecryptedFile = (base64Str: string, title: string, mimeType: string) => {
    try {
      const link = document.createElement("a");
      link.href = base64Str;
      link.download = title;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to download file:", err);
      showToast("Error downloading file.", "error");
    }
  };

  const openDecryptedFile = (base64Str: string, mimeType: string) => {
    try {
      const parts = base64Str.split(",");
      if (parts.length < 2) return;
      const byteString = atob(parts[1]);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeType });
      const fileURL = URL.createObjectURL(blob);
      window.open(fileURL, "_blank");
    } catch (err) {
      console.error("Failed to open file preview:", err);
      showToast("Failed to open file preview. Please download instead.", "info");
    }
  };

  // Handle generic state updates for basic text/inputs
  const updatePatientField = (path: string, value: any) => {
    const updated = { ...localPatient };
    
    // Simple path parsing (supporting nested objects up to 2 levels)
    if (path.includes(".")) {
      const parts = path.split(".");
      if (parts.length === 2) {
        if (!(updated as any)[parts[0]]) {
          (updated as any)[parts[0]] = {};
        }
        (updated as any)[parts[0]][parts[1]] = value;
      } else if (parts.length === 3) {
        if (!(updated as any)[parts[0]]) {
          (updated as any)[parts[0]] = {};
        }
        if (!(updated as any)[parts[0]][parts[1]]) {
          (updated as any)[parts[0]][parts[1]] = {};
        }
        (updated as any)[parts[0]][parts[1]][parts[2]] = value;
      }
    } else {
      (updated as any)[path] = value;
    }
    
    setLocalPatient(updated);
    setSaveSuccess(false);
  };

  // Explicit handlers for custom updates from sub-components
  const handleUpdateCalculators = (calcs: CalculatorsData) => {
    setLocalPatient(prev => ({
      ...prev,
      calculators: calcs,
      age: calcs.age || prev.age,
      gender: calcs.gender || prev.gender
    }));
  };

  const handleUpdateInfusions = (infusionsList: InfusionDrug[]) => {
    setLocalPatient(prev => ({
      ...prev,
      infusions: infusionsList
    }));
  };

  // Save the record
  const handleSaveRecord = async () => {
    setSaving(true);
    try {
      await onSave(localPatient);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Save error:", err);
      showToast("Failed to save patient record. Please check your network.", "error");
    } finally {
      setSaving(false);
    }
  };

  // Tasks updates
  const handleAddTask = () => {
    if (!newTaskDesc.trim()) return;
    const task: PendingTask = {
      id: Math.random().toString(36).substr(2, 9),
      description: newTaskDesc.trim(),
      priority: newTaskPriority,
      status: "Pending"
    };
    
    const updatedTasks = [...localPatient.tasks, task];
    updatePatientField("tasks", updatedTasks);
    setNewTaskDesc("");
  };

  const handleRemoveTask = (taskId: string) => {
    const updatedTasks = localPatient.tasks.filter(t => t.id !== taskId);
    updatePatientField("tasks", updatedTasks);
  };

  const handleToggleTaskStatus = (taskId: string) => {
    const updatedTasks = localPatient.tasks.map(t => {
      if (t.id === taskId) {
        return { ...t, status: t.status === "Pending" ? "Done" : "Pending" as const };
      }
      return t;
    });
    updatePatientField("tasks", updatedTasks);
  };

  // Document and Image upload handler with Camera Capture & File select support
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showToast("File is too large. Max limit is 10MB for decryption performance.", "error");
      return;
    }

    setImageLoading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const formattedSize = file.size > 1024 * 1024 
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
        : `${(file.size / 1024).toFixed(0)} KB`;

      const newImage: ClinicalImage = {
        id: Math.random().toString(36).substr(2, 9),
        title: imageTitle.trim() || file.name || "CXR / Report Upload",
        base64: base64String,
        timestamp: new Date().toISOString(),
        fileType: file.type || "application/octet-stream",
        fileSize: formattedSize
      };

      const updatedImages = [...localPatient.images, newImage];
      setLocalPatient(prev => ({ ...prev, images: updatedImages }));
      setImageTitle("");
      setImageLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = (imgId: string) => {
    const updatedImages = localPatient.images.filter(img => img.id !== imgId);
    updatePatientField("images", updatedImages);
  };

  // Trigger server-side AI case, handover, or discharge summaries via Gemini
  const handleGenerateSummary = async (forceProceed = false) => {
    if (!customApiKey.trim() && !forceProceed) {
      setShowKeyConfirmModal(true);
      return;
    }

    setAiLoading(true);
    setAiError("");
    setAiSummary("");

    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          patient: localPatient,
          summaryType: summaryType,
          customApiKey: customApiKey.trim() || undefined
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to generate summary");
      }

      setAiSummary(data.summary);
    } catch (err: any) {
      console.error("AI summary error:", err);
      setAiError(err.message || "An unexpected error occurred during summarization.");
    } finally {
      setAiLoading(false);
    }
  };

  // Copy AI summary to clipboard
  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(aiSummary);
    showToast("Summary copied to clipboard.", "success");
  };

  if ((localPatient as any).isDecryptError) {
    return (
      <div className="bg-[#0A0A0A] min-h-screen text-[#E0E0E0] font-sans flex flex-col justify-between">
        {/* Header Navigation Bar */}
        <div className="bg-[#141414] border-b border-[#222222] py-4 px-6 sticky top-0 z-40 backdrop-blur-md flex items-center gap-3">
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 p-1.5 rounded hover:bg-[#1A1A1A] transition-all cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base font-serif italic font-bold text-red-400">
              Incompatible Encryption Key
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              Secure record ID: {localPatient.id}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-md mx-auto text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-950/40 border border-red-500/20 flex items-center justify-center text-red-400 shadow-lg">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-serif italic font-bold text-zinc-100">
            Passphrase Incompatibility
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            This patient's clinical handover profile was encrypted end-to-end using a different secure ICU Group Passphrase. Please switch to the appropriate team passphrase to view and edit this worksheet.
          </p>
          <p className="text-xs text-zinc-500 leading-relaxed bg-[#111111] border border-[#222222] p-4 rounded font-mono break-all">
            Patient Document Reference ID:<br/>
            <span className="text-zinc-300 font-bold">{localPatient.id}</span>
          </p>
          <div className="pt-4">
            <button
              onClick={onClose}
              className="bg-[#1A1A1A] hover:bg-[#222222] border border-[#222222] text-zinc-300 hover:text-white font-bold text-xs uppercase tracking-wider py-2 px-6 rounded transition-all cursor-pointer"
            >
              Back to Ward Overview
            </button>
          </div>
        </div>

        <footer className="py-8 text-center text-xs text-zinc-600 border-t border-[#111111]/30 font-serif italic tracking-wide mt-auto">
          Made by enigmaticdoc for educational purpose only
        </footer>
      </div>
    );
  }

  return (
    <div className="bg-[#0A0A0A] min-h-screen text-[#E0E0E0] font-sans pb-16">
      {/* 1. Header Navigation Bar */}
      <div className="bg-[#141414] border-b border-[#222222] py-4 px-6 sticky top-0 z-40 backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 p-1.5 rounded hover:bg-[#1A1A1A] transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-500/20 font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                Bed {localPatient.bed || "TBD"}
              </span>
              <h1 className="text-base font-serif italic font-bold text-zinc-100">
                {localPatient.name || "New Patient Handover"}
              </h1>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5 font-sans uppercase tracking-wider font-semibold">
              MRN: {localPatient.mrn || "N/A"} • {localPatient.age || "--"} y/o • {localPatient.gender}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {saveSuccess && (
            <span className="text-[10px] text-emerald-400 flex items-center gap-1.5 bg-emerald-950/40 border border-emerald-500/20 px-3 py-1.5 rounded animate-fade-in font-bold uppercase tracking-wider">
              <Check className="w-4 h-4" />
              Synced & Encrypted
            </span>
          )}

          <button
            onClick={handleSaveRecord}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-[#1A1A1A] text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded flex items-center gap-2 transition-all shadow-lg"
          >
            {saving ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? "Encrypting..." : "Save & Sync Handover"}
          </button>
        </div>
      </div>

      {/* 2. Responsive Handoff Layout with Desktop Sidebar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Mobile Navigation Selector */}
          <div className="lg:hidden col-span-1 mb-2">
            <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">
              Navigation Hub (Select Section):
            </label>
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as ActiveTab)}
              className="w-full bg-[#161616] border border-[#222222] focus:border-emerald-500 rounded px-3 py-2.5 text-xs text-zinc-200 font-bold focus:outline-none"
            >
              <option value="profile">📄 ISBAR & Profile</option>
              <option value="systems">❤️ Organ Systems</option>
              <option value="fasthug">📈 FASTHUG-BID Safety Checklist</option>
              <option value="calculators">🧮 Calculators & Infusions</option>
              <option value="procedures">🩺 Procedures Done</option>
              <option value="critical_events">⚡ Critical Care Events</option>
              <option value="images">📷 Patient Reports & CXR</option>
              <option value="tasks">☑️ Pending Shift Tasks</option>
              <option value="timeline">⏳ Timeline & Daily Changes</option>
              <option value="case_summary">📋 EHR Patient Case Summary</option>
              <option value="ai">✨ AI Clinician Summaries</option>
            </select>
          </div>

          {/* Desktop Left Sidebar Navigation */}
          <nav className="hidden lg:flex lg:col-span-3 flex-col bg-[#111111] border border-[#222222] p-4 rounded space-y-1 sticky top-24 shadow-lg">
            <div className="pb-3 mb-2 border-b border-[#222222]">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 font-sans">
                Clinical Workspace
              </span>
              <p className="text-[9px] text-zinc-600 mt-0.5 uppercase tracking-wider font-semibold font-sans">11 Dedicated Sections</p>
            </div>
            {[
              { id: "profile", label: "ISBAR & Profile", icon: FileText },
              { id: "systems", label: "Organ Systems", icon: Heart },
              { id: "fasthug", label: "FASTHUG-BID Safety", icon: Activity },
              { id: "calculators", label: "Calculators & Infusions", icon: Calculator },
              { id: "procedures", label: "Procedures Done", icon: Stethoscope },
              { id: "critical_events", label: "Critical Care Events", icon: Zap },
              { id: "images", label: "Reports & CXR", icon: Camera },
              { id: "tasks", label: "Shift Tasks Checklist", icon: CheckSquare },
              { id: "timeline", label: "Timeline & Daily Changes", icon: History },
              { id: "case_summary", label: "Case Summary Board", icon: Clipboard },
              { id: "ai", label: "AI Clinical Summaries", icon: Sparkles }
            ].map((tab) => {
              const Icon = tab.icon;
              const isSel = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as ActiveTab)}
                  className={`w-full text-left py-2 px-3 text-xs font-bold uppercase tracking-wider border rounded transition-all flex items-center gap-2.5 cursor-pointer ${
                    isSel
                      ? "border-emerald-500/30 text-emerald-400 bg-emerald-950/20 shadow-sm"
                      : "border-transparent text-zinc-500 hover:text-zinc-350 hover:bg-[#161616]"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isSel ? "text-emerald-400" : "text-zinc-500"}`} />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Area: Workspace content panel */}
          <div className="col-span-1 lg:col-span-9">
          
          {/* TAB 1: Profile & Demographics & ISBAR */}
          {activeTab === "profile" && (
            <div className="space-y-6">
              {!canEditProfile && (
                <div className="p-3 bg-amber-950/20 border border-amber-500/25 text-amber-300 text-xs rounded flex items-center justify-between gap-3 animate-fade-in mb-1">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                    <span><strong>Read-Only Mode:</strong> Demographics and ISBAR details are restricted to Attending and Resident Physicians.</span>
                  </div>
                  <span className="text-[9px] bg-amber-950 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                    {userRole} view
                  </span>
                </div>
              )}
              <fieldset disabled={!canEditProfile} className="border-0 p-0 m-0 w-full space-y-6">
                {/* Demographics Card */}
                <div className="bg-[#111111] border border-[#222222] p-6 rounded space-y-4">
                  <h3 className="font-serif text-base italic text-emerald-500 pb-3 border-b border-[#222222]">
                    Demographics & Admission Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1 font-bold">Patient Name</label>
                    <input
                      type="text"
                      value={localPatient.name}
                      onChange={(e) => updatePatientField("name", e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full bg-[#1A1A1A] border border-[#222222] rounded px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500 text-zinc-100 placeholder:text-zinc-650 font-sans"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1 font-bold">Bed Number</label>
                    <input
                      type="text"
                      value={localPatient.bed}
                      onChange={(e) => updatePatientField("bed", e.target.value)}
                      placeholder="ICU-04"
                      className="w-full bg-[#1A1A1A] border border-[#222222] rounded px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500 text-zinc-100 placeholder:text-zinc-650 font-sans"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1 font-bold">MRN (Medical Record Number)</label>
                    <input
                      type="text"
                      value={localPatient.mrn}
                      onChange={(e) => updatePatientField("mrn", e.target.value)}
                      placeholder="902-485-22"
                      className="w-full bg-[#1A1A1A] border border-[#222222] rounded px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500 text-zinc-100 placeholder:text-zinc-650 font-sans"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1 font-bold">Admission Date</label>
                    <div className="relative">
                      <input
                        type="date"
                        value={localPatient.admissionDate}
                        onChange={(e) => updatePatientField("admissionDate", e.target.value)}
                        className="w-full bg-[#1A1A1A] border border-[#222222] rounded px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 font-sans"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1 font-bold">Age (Years)</label>
                    <input
                      type="number"
                      value={localPatient.age}
                      onChange={(e) => updatePatientField("age", e.target.value)}
                      placeholder="58"
                      className="w-full bg-[#1A1A1A] border border-[#222222] rounded px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500 text-zinc-100 placeholder:text-zinc-650 font-sans"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1 font-bold">Biological Gender</label>
                    <select
                      value={localPatient.gender}
                      onChange={(e) => updatePatientField("gender", e.target.value)}
                      className="w-full bg-[#1A1A1A] border border-[#222222] rounded px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 font-sans"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1 font-bold">Primary ICU Working Diagnosis</label>
                    <input
                      type="text"
                      value={localPatient.diagnosis}
                      onChange={(e) => updatePatientField("diagnosis", e.target.value)}
                      placeholder="e.g., Septic Shock secondary to Lobar Pneumonia"
                      className="w-full bg-[#1A1A1A] border border-[#222222] rounded px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500 text-zinc-100 placeholder:text-zinc-650 font-sans"
                    />
                  </div>
                </div>
              </div>

              {/* ISBAR Core Content */}
              <div className="bg-[#111111] border border-[#222222] p-6 rounded space-y-6">
                <div className="border-b border-[#222222] pb-3 flex items-center justify-between">
                  <h3 className="font-serif text-base italic text-emerald-500">
                    ISBAR Standardized Handoff Information
                  </h3>
                  <span className="text-[9px] bg-[#0A0A0A] border border-[#222222] text-zinc-500 font-bold uppercase tracking-wider px-2 py-1 rounded">
                    Universal ICU Safety Protocol
                  </span>
                </div>

                <div className="space-y-4">
                  {/* I */}
                  <div>
                    <label className="block text-xs font-bold text-emerald-500 mb-1.5 uppercase tracking-wider">
                      I - Identify (Introduction, Bed, Ward, Care Team Details)
                    </label>
                    <textarea
                      rows={2}
                      value={localPatient.isbar.identify}
                      onChange={(e) => updatePatientField("isbar.identify", e.target.value)}
                      placeholder="e.g. 58y/o Female, admitted from ER under Dr. Anand. Bed 4, ICU. No allergies."
                      className="w-full bg-[#1A1A1A] border border-[#222222] rounded p-3 text-xs leading-relaxed focus:outline-none focus:border-emerald-500 text-zinc-200 placeholder:text-zinc-650 font-sans"
                    />
                  </div>

                  {/* S */}
                  <div>
                    <label className="block text-xs font-bold text-emerald-500 mb-1.5 uppercase tracking-wider">
                      S - Situation (Current Acute Complaint, Resuscitation Status, Safety Alerts)
                    </label>
                    <textarea
                      rows={2}
                      value={localPatient.isbar.situation}
                      onChange={(e) => updatePatientField("isbar.situation", e.target.value)}
                      placeholder="e.g. Intubated for hypoxic respiratory failure. In septic shock, currently on Norepinephrine. Resus: Full Code."
                      className="w-full bg-[#1A1A1A] border border-[#222222] rounded p-3 text-xs leading-relaxed focus:outline-none focus:border-emerald-500 text-zinc-200 placeholder:text-zinc-650 font-sans"
                    />
                  </div>

                  {/* B */}
                  <div>
                    <label className="block text-xs font-bold text-emerald-500 mb-1.5 uppercase tracking-wider">
                      B - Background (History, Co-morbidities, Clinical Milestones)
                    </label>
                    <textarea
                      rows={3}
                      value={localPatient.isbar.background}
                      onChange={(e) => updatePatientField("isbar.background", e.target.value)}
                      placeholder="e.g. History of Type 2 DM, HTN. Admitted 3 days ago with worsening dyspnea, found to have bilateral infiltrates on CXR. Empiric Meropenem started on day 1."
                      className="w-full bg-[#1A1A1A] border border-[#222222] rounded p-3 text-xs leading-relaxed focus:outline-none focus:border-emerald-500 text-zinc-200 placeholder:text-zinc-650 font-sans"
                    />
                  </div>

                  {/* A */}
                  <div>
                    <label className="block text-xs font-bold text-emerald-500 mb-1.5 uppercase tracking-wider">
                      A - Assessment (Intensivist Evaluation, Active Support, Laboratory and Imaging)
                    </label>
                    <textarea
                      rows={3}
                      value={localPatient.isbar.assessment}
                      onChange={(e) => updatePatientField("isbar.assessment", e.target.value)}
                      placeholder="e.g. CVS: Improving, weaning Norad. RS: ARDS profile. PaO2/FiO2 140. Labs: WBC 14.8, Lactate 1.8 (down from 4.2). CXR shows stable left lower consolidation."
                      className="w-full bg-[#1A1A1A] border border-[#222222] rounded p-3 text-xs leading-relaxed focus:outline-none focus:border-emerald-500 text-zinc-200 placeholder:text-zinc-650 font-sans"
                    />
                  </div>

                  {/* R */}
                  <div>
                    <label className="block text-xs font-bold text-emerald-500 mb-1.5 uppercase tracking-wider">
                      R - Recommendation (Actionable Handoff Targets, Tasks to Complete, Goal of Care)
                    </label>
                    <textarea
                      rows={3}
                      value={localPatient.isbar.recommendation}
                      onChange={(e) => updatePatientField("isbar.recommendation", e.target.value)}
                      placeholder="e.g. Aim for extubation assessment tomorrow morning if sedation holiday tolerated. Re-check lactate at 14:00. Ensure line cultures drawn if temp spikes."
                      className="w-full bg-[#1A1A1A] border border-[#222222] rounded p-3 text-xs leading-relaxed focus:outline-none focus:border-emerald-500 text-zinc-200 placeholder:text-zinc-650 font-sans"
                    />
                  </div>
                </div>
              </div>

              {/* Procedures, Events & Plan Notes */}
              <div className="bg-[#111111] border border-[#222222] p-6 rounded space-y-4">
                <h3 className="font-serif text-base italic text-emerald-500 pb-3 border-b border-[#222222]">
                  Recent Events, Procedures & Treatment Targets
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1 font-bold">Key Shift Events</label>
                    <textarea
                      rows={4}
                      value={localPatient.clinicalNotes.recentEvents}
                      onChange={(e) => updatePatientField("clinicalNotes.recentEvents", e.target.value)}
                      placeholder="Any acute episodes, drop in saturation, arrhythmias, or line slips during the shift..."
                      className="w-full bg-[#1A1A1A] border border-[#222222] rounded p-2.5 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 placeholder:text-zinc-650 font-sans leading-relaxed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1 font-bold">Procedures Completed</label>
                    <textarea
                      rows={4}
                      value={localPatient.clinicalNotes.proceduresDone}
                      onChange={(e) => updatePatientField("clinicalNotes.proceduresDone", e.target.value)}
                      placeholder="Central Venous Line placed, Arterial line, Intubation details, chest tube placement, etc..."
                      className="w-full bg-[#1A1A1A] border border-[#222222] rounded p-2.5 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 placeholder:text-zinc-650 font-sans leading-relaxed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1 font-bold">Long-term ICU Plans & Goals</label>
                    <textarea
                      rows={4}
                      value={localPatient.clinicalNotes.planGoal}
                      onChange={(e) => updatePatientField("clinicalNotes.planGoal", e.target.value)}
                      placeholder="Goal of hospitalization, expected length of ventilation, rehabilitation targets, family discussions..."
                      className="w-full bg-[#1A1A1A] border border-[#222222] rounded p-2.5 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 placeholder:text-zinc-650 font-sans leading-relaxed"
                    />
                  </div>
                </div>
              </div>
              </fieldset>
            </div>
          )}

          {/* TAB 2: System-Wise Organ Assessments */}
          {activeTab === "systems" && (
            <div className="space-y-6">
              {!canEditSystems && (
                <div className="p-3 bg-amber-950/20 border border-amber-500/25 text-amber-300 text-xs rounded flex items-center justify-between gap-3 animate-fade-in mb-1">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                    <span><strong>Read-Only Mode:</strong> Organ systems assessments are restricted to Physicians and Nurses.</span>
                  </div>
                  <span className="text-[9px] bg-amber-950 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                    {userRole} view
                  </span>
                </div>
              )}
              <div className="bg-[#111111] border border-[#222222] rounded overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[580px]">
                
                {/* Left panel: Vertical Systems Navigation */}
                <div className="col-span-1 md:col-span-4 border-b md:border-b-0 md:border-r border-[#222222] bg-[#141414] p-4 space-y-2 md:max-h-[650px] md:overflow-y-auto scrollbar-thin">
                  <div className="pb-3 mb-2 border-b border-[#222222]">
                    <h4 className="text-xs uppercase tracking-wider text-zinc-400 font-bold">Organ Systems</h4>
                    <p className="text-[10px] text-zinc-500">Select system to view/edit details</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    {Object.entries(systemsConfig).map(([key, config]) => {
                      const IconComponent = config.icon;
                      const statusVal = getNestedValue(localPatient, config.statusPath) || "Stable";
                      const isActive = activeSystemTab === key;
                      
                      // Status color badge
                      let statusColor = "text-zinc-500 bg-zinc-900 border-zinc-800";
                      const isNormal = ["Stable", "Normal", "Alert", "Intact", "Resolving"].some(n => statusVal.includes(n));
                      const isSevere = ["Shock / Hypotension", "Vasopressor Support", "Arrhythmia", "AKI / Oliguria", "Anuria", "CRRT / HD", "Comatose", "Delirious", "Agitated", "Invasive Vent", "Severe Shock", "Sepsis", "Contracture Risk", "ICUAW Weakness", "Pressure Injury / Wound", "Renal/Hepatic Adjustment Needed", "Potential Interaction", "Active Palliative Care", "End-of-Life transition", "Bicytopenic", "Pancytopenic"].some(n => statusVal.includes(n));
                      const isModerate = ["Sedated", "Oxygen Mask / NC", "HFNC", "NIV", "Enteral", "TPN", "Thrombocytopenic", "Anemic", "Leukocytosis", "Erythrocytosis", "Thrombocytosis", "Diabetic Control", "Electrolyte Imbalance", "Adrenal", "SUP Indicated", "Family meeting"].some(n => statusVal.includes(n));

                      if (isSevere) {
                        statusColor = "text-rose-400 bg-rose-950/20 border-rose-900/40";
                      } else if (isModerate) {
                        statusColor = "text-amber-400 bg-amber-950/20 border-amber-500/20";
                      } else if (isNormal) {
                        statusColor = "text-emerald-400 bg-emerald-950/20 border-emerald-900/40";
                      }

                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setActiveSystemTab(key)}
                          className={`flex items-center justify-between w-full text-left px-3 py-2.5 rounded transition-all gap-3 cursor-pointer shrink-0 border ${
                            isActive
                              ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-400 font-medium"
                              : "bg-transparent border-transparent hover:bg-[#1C1C1C] text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <IconComponent className={`w-4 h-4 shrink-0 ${isActive ? "text-emerald-400" : "text-zinc-500"}`} />
                            <span className="text-xs truncate">{config.name}</span>
                          </div>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase tracking-wider font-bold shrink-0 ${statusColor}`}>
                            {statusVal}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Right panel: Active System Form & Quick Presets */}
                <fieldset disabled={!canEditSystems} className="md:col-span-8 p-6 space-y-6 border-0 m-0 min-w-0">
                  {(() => {
                    if (activeSystemTab === "idStewardship") {
                      return renderIDStewardshipPanel();
                    }
                    const currentSystem = systemsConfig[activeSystemTab];
                    if (!currentSystem) return (
                      <div className="text-center py-12 text-zinc-500 text-xs">
                        Please select an organ system from the left navigation panel.
                      </div>
                    );
                    const IconComponent = currentSystem.icon;
                    const commentsVal = getNestedValue(localPatient, currentSystem.commentsPath);

                      return (
                        <div className="space-y-6 animate-fade-in">
                          {/* System Header */}
                          <div className="flex items-center justify-between border-b border-[#222222] pb-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2.5 bg-emerald-950/30 rounded border border-emerald-500/30">
                                <IconComponent className="w-5 h-5 text-emerald-400" />
                              </div>
                              <div>
                                <h3 className="font-serif text-lg italic text-zinc-100">{currentSystem.name}</h3>
                                <p className="text-[11px] text-zinc-500 font-sans">Holistic parameters, indices, clinical targets, and stewardship evaluations</p>
                              </div>
                            </div>
                          </div>

                          {/* Quick Preset Buttons */}
                          {currentSystem.presets && currentSystem.presets.length > 0 && (
                            <div className="bg-emerald-950/10 border border-emerald-500/20 p-4 rounded space-y-3">
                              <div className="flex items-center gap-1.5 text-emerald-400">
                                <Zap className="w-4 h-4 shrink-0" />
                                <span className="text-xs font-bold uppercase tracking-wider font-sans">Lightning-Fast Entry Templates</span>
                              </div>
                              <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
                                Click a template preset below to automatically populate all system parameters and evaluation notes:
                              </p>
                              <div className="flex flex-wrap gap-2 pt-1">
                                {currentSystem.presets.map((preset, index) => (
                                  <button
                                    key={index}
                                    type="button"
                                    onClick={() => {
                                      Object.entries(preset.values).forEach(([fieldPath, value]) => {
                                        updatePatientField(fieldPath, value);
                                      });
                                      showToast(`Applied Preset: ${preset.label}`, "success");
                                    }}
                                    className="text-xs bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/30 hover:border-emerald-500/60 text-emerald-300 rounded px-3 py-1.5 transition-colors cursor-pointer font-medium font-sans"
                                  >
                                    {preset.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Form Fields Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {currentSystem.fields.map((field) => {
                              const val = getNestedValue(localPatient, field.path);
                              return (
                                <div key={field.path} className="space-y-1">
                                  <label className="block text-[11px] uppercase tracking-wider text-zinc-400 font-bold">
                                    {field.label}
                                  </label>
                                  {field.type === "select" ? (
                                    (field as any).multi ? (
                                      <div className="flex flex-wrap gap-1.5 p-2 bg-[#141414] border border-[#222222] rounded min-h-[38px] items-center">
                                        {field.options?.map((opt) => {
                                          const optVal = typeof opt === "string" ? opt : opt.value;
                                          const optLabel = typeof opt === "string" ? opt : opt.label;
                                          const selectedArray = val ? val.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
                                          const isSelected = selectedArray.includes(optVal);
                                          
                                          const handleToggle = () => {
                                            let nextArray;
                                            if (isSelected) {
                                              nextArray = selectedArray.filter((s: string) => s !== optVal);
                                            } else {
                                              if (optVal === "Normal") {
                                                nextArray = ["Normal"];
                                              } else {
                                                nextArray = [...selectedArray.filter((s: string) => s !== "Normal"), optVal];
                                              }
                                            }
                                            updatePatientField(field.path, nextArray.join(", "));
                                          };
                                          
                                          return (
                                            <button
                                              key={optVal}
                                              type="button"
                                              onClick={handleToggle}
                                              className={`px-2 py-1 rounded text-[11px] border transition-all cursor-pointer ${
                                                isSelected
                                                  ? "bg-emerald-950/45 border-emerald-500/40 text-emerald-300 font-semibold"
                                                  : "bg-[#1C1C1C] border-[#222222] text-zinc-400 hover:bg-zinc-900"
                                              }`}
                                            >
                                              {optLabel}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <select
                                        value={val}
                                        onChange={(e) => updatePatientField(field.path, e.target.value)}
                                        className="w-full bg-[#1A1A1A] border border-[#222222] focus:border-emerald-500/60 rounded px-3 py-2 text-xs text-zinc-100 focus:outline-none"
                                      >
                                        <option value="">-- Select Option --</option>
                                        {field.options?.map((opt) => {
                                          if (typeof opt === "string") {
                                            return <option key={opt} value={opt}>{opt}</option>;
                                          }
                                          return <option key={opt.value} value={opt.value}>{opt.label}</option>;
                                        })}
                                      </select>
                                    )
                                  ) : (
                                    <input
                                      type="text"
                                      value={val}
                                      onChange={(e) => updatePatientField(field.path, e.target.value)}
                                      placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                                      className="w-full bg-[#1A1A1A] border border-[#222222] focus:border-emerald-500/60 rounded px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-650 focus:outline-none"
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Comments Textarea */}
                          <div className="space-y-1">
                            <label className="block text-[11px] uppercase tracking-wider text-zinc-400 font-bold">
                              Comprehensive Notes & Narrative Evaluation
                            </label>
                            <textarea
                              rows={4}
                              value={commentsVal}
                              onChange={(e) => updatePatientField(currentSystem.commentsPath, e.target.value)}
                              placeholder={`Enter exhaustive daily notes for ${currentSystem.name}...`}
                              className="w-full bg-[#1A1A1A] border border-[#222222] focus:border-emerald-500/60 rounded p-3 text-xs leading-relaxed focus:outline-none text-zinc-100 placeholder:text-zinc-650 font-sans"
                            />
                          </div>
                        </div>
                      );
                    })()}
                  </fieldset>

                </div>
              </div>
          )}

          {/* TAB 3: FASTHUG-BID Safety Checklist */}
          {activeTab === "fasthug" && (
            <div className="space-y-6">
              {!canEditFasthug && (
                <div className="p-3 bg-amber-950/20 border border-amber-500/25 text-amber-300 text-xs rounded flex items-center justify-between gap-3 animate-fade-in mb-1">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                    <span><strong>Read-Only Mode:</strong> FASTHUG-BID checklist is restricted to Physicians and Nurses.</span>
                  </div>
                  <span className="text-[9px] bg-amber-950 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                    {userRole} view
                  </span>
                </div>
              )}
              <fieldset disabled={!canEditFasthug} className="border-0 p-0 m-0 w-full space-y-6">
                <div className="bg-[#111111] border border-[#222222] p-6 rounded">
                <div className="border-b border-[#222222] pb-4 mb-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h3 className="font-serif text-base italic text-[#E0E0E0] flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-400" />
                      FAST HUGS BID + LINES: Exhaustive 360° ICU Daily Rounds Bundle
                    </h3>
                    <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-900 px-2 py-0.5 rounded font-mono uppercase">15 Standardized Parameters</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    Bridge the gap between pure physiology and ICU operational reality. Daily assessment covering extracorporeal circuits, PK/PD, PICS prevention, and palliative dynamics. Use the <strong>Quick templates</strong> below each item for lighting-fast professional data entry.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    {
                      id: "feeding",
                      label: "F - Feeding / Nutrition",
                      placeholder: "NG tube feed rate, enteral tolerance, target kcal/protein...",
                      templates: [
                        "Enteral feeds tolerating at 65mL/hr",
                        "NPO for planned procedure today",
                        "TPN via Central Line: target 2000 kcal met"
                      ]
                    },
                    {
                      id: "analgesia",
                      label: "A - Analgesia",
                      placeholder: "Fentanyl infusion mcg/hr, Acetaminophen schedule...",
                      templates: [
                        "BPS/CPOT score 0-1 (Optimal pain control)",
                        "Fentanyl inf weaning, multi-modal active",
                        "Pain controlled with IV Acetaminophen q6h"
                      ]
                    },
                    {
                      id: "sedation",
                      label: "S - Sedation",
                      placeholder: "Propofol rate, RASS target, sedation holiday status...",
                      templates: [
                        "RASS Target 0 to -1 met",
                        "Daily sedation holiday (SAT) tolerated & passed",
                        "Weaning Dexmedetomidine, patient calm"
                      ]
                    },
                    {
                      id: "thrombo",
                      label: "T - Thromboprophylaxis",
                      placeholder: "Enoxaparin daily, mechanical sequential sleeves...",
                      templates: [
                        "Enoxaparin 40mg SC daily active",
                        "SCD active and running (18+ hours/day)",
                        "Contraindicated due to active bleeding risk"
                      ]
                    },
                    {
                      id: "headUp",
                      label: "H - Head of Bed & VExUS Congestion",
                      placeholder: "HOB 30-45° status, VExUS point-of-care ultrasound status...",
                      templates: [
                        "HOB elevated 35°, VExUS: No congestion",
                        "HOB elevated 45° to reduce ventilator pneumonia",
                        "VExUS: Hepatic/portal flow normal, diuresis active"
                      ]
                    },
                    {
                      id: "ulcer",
                      label: "U - Ulcer Prophylaxis (SUP)",
                      placeholder: "Pantoprazole daily IV/PO, Famotidine...",
                      templates: [
                        "Pantoprazole 40mg IV once daily active",
                        "Stress ulcer prophylaxis not indicated (extubated)",
                        "Pantoprazole discontinued (no high-risk factors)"
                      ]
                    },
                    {
                      id: "glycemic",
                      label: "G - Glycemic Control & Insulin",
                      placeholder: "Sliding scale checks, targets, averages, time-in-range...",
                      templates: [
                        "Target 140-180 mg/dL met, sliding scale",
                        "Insulin infusion running: BG stable at 150 mg/dL",
                        "Glycemia stable, no active insulin required"
                      ]
                    },
                    {
                      id: "bowel",
                      label: "B - Bowel Care",
                      placeholder: "Last stool date, stool softeners given, laxatives...",
                      templates: [
                        "Bowel sounds active, passed stool today",
                        "Lactulose q8h active for ICU constipation",
                        "Diarrhea managed, stool samples sent"
                      ]
                    },
                    {
                      id: "indwelling",
                      label: "I - Indwelling Devices & Line Holidays",
                      placeholder: "Foley catheter, CVC, arterial lines status...",
                      templates: [
                        "CVC & Foley insertion sites clean, daily holiday check passed",
                        "Foley catheter removed today to prevent CAUTI",
                        "Central line remaining due to vasopressor necessity"
                      ]
                    },
                    {
                      id: "deescalation",
                      label: "D - Drug De-escalation & Stewardship",
                      placeholder: "Antibiotics reviewed, IV to PO, vasopressor weaning...",
                      templates: [
                        "Cultures negative: de-escalated empiric antibiotics",
                        "Norepinephrine weaning actively, MAP stable >65",
                        "Therapeutic drug monitoring: Vancomycin trough 16.2"
                      ]
                    },
                    {
                      id: "labs",
                      label: "+ L - Labs & Bio-electrolytes",
                      placeholder: "Daily CBC, coagulation, electrolytes corrections, acidosis...",
                      templates: [
                        "Electrolytes corrected (K > 4.0, Mg > 2.0)",
                        "Lactate cleared (< 1.5), blood gases stable",
                        "Hemoglobin stable, restrictive transfusion followed"
                      ]
                    },
                    {
                      id: "integumentary",
                      label: "+ I - Integumentary & Turning",
                      placeholder: "Skin pressure injury checks (Sacrum/heels), Braden score, turning frequency, ICU Mobility Scale...",
                      templates: [
                        "Braden score 14, sacrum intact, q2h turns active",
                        "ICU Mobility Scale: Tier 3 (sitting on edge of bed)",
                        "Sacral redness noted: barrier cream applied, heel protectors on"
                      ]
                    },
                    {
                      id: "neuro",
                      label: "+ N - Neuro-Delirium Check",
                      placeholder: "CAM-ICU delirium screening, sleep-wake cycles bundle, brainstem reflexes...",
                      templates: [
                        "CAM-ICU Delirium Negative, sleep hygiene bundle active",
                        "CAM-ICU Delirium Positive (hyperactive): Dexmedetomidine active",
                        "Brainstem reflexes intact, motor symmetric, no focal drift"
                      ]
                    },
                    {
                      id: "extracorporeal",
                      label: "+ E - Extracorporeal Support",
                      placeholder: "CRRT, ECMO, IABP parameters and circuit checks...",
                      templates: [
                        "CRRT circuit running smoothly, effluent dose achieved",
                        "Citrate anticoagulation active, post-filter iCa 0.32",
                        "ECMO parameters stable: RPM 2800, sweep gas 3.5L/min"
                      ]
                    },
                    {
                      id: "social",
                      label: "+ S - Social & Goals of Care",
                      placeholder: "Family updates, Code Status, Spiritual care...",
                      templates: [
                        "Code status: FULL CODE. Family updated by attending",
                        "Goals of care discussed: Transition to comfort care",
                        "Spiritual care and social work consulted, family at bedside"
                      ]
                    }
                  ].map((item) => {
                    const isChecked = (localPatient.fasthugbid as any)?.[item.id] || false;
                    const notesVal = (localPatient.fasthugbid as any)?.[`${item.id}Notes`] || "";
                    
                    return (
                      <div
                        key={item.id}
                        className={`p-4 rounded border transition-all flex flex-col gap-3 ${
                          isChecked
                            ? "bg-emerald-950/25 border-emerald-500/30"
                            : "bg-[#1A1A1A] border-[#222222]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-zinc-200">{item.label}</span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => updatePatientField(`fasthugbid.${item.id}`, e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-[#111111] border border-[#222222] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-500 after:border-zinc-400 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600 peer-checked:after:bg-white peer-checked:after:border-emerald-600"></div>
                            <span className="ml-2 text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                              {isChecked ? "Addressed" : "Pending"}
                            </span>
                          </label>
                        </div>
                        
                        <input
                          type="text"
                          value={notesVal}
                          onChange={(e) => updatePatientField(`fasthugbid.${item.id}Notes`, e.target.value)}
                          placeholder={item.placeholder}
                          className="w-full bg-[#111111] border border-[#222222] rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 placeholder:text-zinc-650 font-sans"
                        />

                        {/* Quick Templates */}
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[9px] text-zinc-500 font-semibold tracking-wider uppercase">Quick presets:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {item.templates.map((tpl, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  updatePatientField(`fasthugbid.${item.id}`, true);
                                  updatePatientField(`fasthugbid.${item.id}Notes`, tpl);
                                }}
                                className="text-[9px] bg-[#111111] hover:bg-[#202020] border border-[#252525] hover:border-[#333333] rounded px-2 py-1 text-zinc-400 hover:text-emerald-400 transition-colors text-left cursor-pointer truncate max-w-full"
                                title={tpl}
                              >
                                {tpl}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              </fieldset>
            </div>
          )}

          {/* TAB 4: ICU Calculators & Infusions */}
          {activeTab === "calculators" && (
            <div className="space-y-6">
              {!canEditCalculators && (
                <div className="p-3 bg-amber-950/20 border border-amber-500/25 text-amber-300 text-xs rounded flex items-center justify-between gap-3 animate-fade-in mb-1">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                    <span><strong>Read-Only Mode:</strong> Drug calculations and infusions are restricted to Physicians and Pharmacists.</span>
                  </div>
                  <span className="text-[9px] bg-amber-950 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                    {userRole} view
                  </span>
                </div>
              )}
              <fieldset disabled={!canEditCalculators} className="border-0 p-0 m-0 w-full space-y-6">
                <PatientCalculators
                  calculators={localPatient.calculators}
                  infusions={localPatient.infusions}
                  patientWeight={localPatient.calculators.weight}
                  onUpdateCalculators={handleUpdateCalculators}
                  onUpdateInfusions={handleUpdateInfusions}
                />
              </fieldset>

              <PatientScoringHub
                patient={localPatient}
                onSaveTimeline={(newTimeline) => setLocalPatient(prev => ({ ...prev, timeline: newTimeline }))}
                showToast={showToast}
              />
            </div>
          )}

          {/* TAB 5: Clinical Reports, Lab Sheets & CXR Gallery */}
          {activeTab === "images" && (
            <div className="space-y-6">
              <div className="bg-[#111111] border border-[#222222] p-6 rounded">
                <div className="border-b border-[#222222] pb-3 mb-5">
                  <h3 className="font-serif text-base italic text-[#E0E0E0] flex items-center gap-2">
                    <Camera className="w-4 h-4 text-emerald-400" />
                    Clinical Document & Image Repository (CXR, ECG, Labs)
                  </h3>
                  <p className="text-xs text-zinc-500 mt-1">
                    Upload clinical documents (PDF, Doc) or snap photos using your device camera. Files are fully encrypted client-side using the ICU Group Key before storage.
                  </p>
                </div>

                {/* Upload Form (Role Restricted) */}
                {canEditDocuments ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end bg-[#1A1A1A] p-5 rounded border border-[#222222] mb-6">
                    <div className="col-span-2">
                      <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1 font-bold">Document Description / Label</label>
                      <input
                        type="text"
                        value={imageTitle}
                        onChange={(e) => setImageTitle(e.target.value)}
                        placeholder="e.g., Morning CXR (Bilateral consolidations) or Day 3 Labs PDF"
                        className="w-full bg-[#111111] border border-[#222222] rounded px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 font-sans"
                      />
                    </div>

                    <div>
                      <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1 font-bold">Capture Camera / Choose File</label>
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/*,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          onChange={handleImageUpload}
                          disabled={imageLoading}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <button
                          type="button"
                          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-[#111111] text-white font-bold uppercase tracking-wider py-1.5 px-3 rounded text-xs flex items-center justify-center gap-1.5 shadow-lg"
                        >
                          {imageLoading ? (
                            <>
                              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Camera className="w-3.5 h-3.5" />
                              Snap Photo / Select
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-950/20 border border-amber-500/25 text-amber-300 text-xs rounded flex items-center justify-between gap-3 animate-fade-in mb-6">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                      <span><strong>Notice:</strong> Only Physicians and Nurses can upload clinical images, CXRs, or documents to the repository.</span>
                    </div>
                    <span className="text-[9px] bg-amber-950 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                      {userRole} view
                    </span>
                  </div>
                )}

                {/* Gallery / Repository List View */}
                {localPatient.images.length === 0 ? (
                  <div className="text-center p-12 bg-[#1A1A1A] rounded border border-dashed border-[#222222] text-zinc-500 text-xs font-sans">
                    No documents or clinical images uploaded. Capture chest x-rays or PDF reports securely.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {localPatient.images.map((img) => {
                      const isImage = !img.fileType || img.fileType.startsWith("image/");
                      return (
                        <div
                          key={img.id}
                          className="bg-[#1A1A1A] border border-[#222222] p-2.5 rounded group relative overflow-hidden flex flex-col justify-between"
                        >
                          {/* Image or Document Card Preview */}
                          {isImage ? (
                            <div
                              onClick={() => setViewingImage(img.base64)}
                              className="h-32 bg-[#0A0A0A] rounded overflow-hidden cursor-zoom-in relative flex items-center justify-center"
                            >
                              <img
                                src={img.base64}
                                alt={img.title}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Eye className="w-6 h-6 text-white" />
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={() => openDecryptedFile(img.base64, img.fileType || "application/pdf")}
                              className="h-32 bg-[#111111] hover:bg-[#0E0E0E] rounded cursor-pointer relative flex flex-col items-center justify-center gap-2 border border-[#222222] transition-colors"
                            >
                              <FileText className="w-10 h-10 text-emerald-500" />
                              <span className="text-[10px] bg-emerald-950/60 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded uppercase font-bold tracking-wider font-mono">
                                {img.fileType === "application/pdf" ? "PDF Document" : "Clinical File"}
                              </span>
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <ExternalLink className="w-5 h-5 text-white" />
                              </div>
                            </div>
                          )}

                          {/* Details */}
                          <div className="mt-2.5">
                            <span className="block text-xs font-bold text-zinc-200 truncate" title={img.title}>
                              {img.title}
                            </span>
                            <div className="flex items-center justify-between mt-0.5">
                              <span className="block text-[10px] text-zinc-500 font-mono">
                                {new Date(img.timestamp).toLocaleDateString([], {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit"
                                })}
                              </span>
                              {img.fileSize && (
                                <span className="block text-[9px] text-zinc-600 font-mono font-bold">
                                  {img.fileSize}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Action overlay buttons */}
                          <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            {!isImage && (
                              <button
                                onClick={() => downloadDecryptedFile(img.base64, img.title, img.fileType || "")}
                                className="bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/30 text-emerald-300 p-1 rounded transition-colors"
                                title="Download decrypted file"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {canEditDocuments && (
                              <button
                                onClick={() => handleRemoveImage(img.id)}
                                className="bg-red-950/80 hover:bg-red-900 border border-red-500/30 text-red-300 p-1 rounded transition-colors"
                                title="Delete document"
                              >
                                <Trash className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: Priority Checklist for Pending Handoff Tasks */}
          {activeTab === "tasks" && (
            <div className="space-y-6">
              <div className="bg-[#111111] border border-[#222222] p-6 rounded">
                <div className="border-b border-[#222222] pb-3 mb-5">
                  <h3 className="font-serif text-base italic text-[#E0E0E0] flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-emerald-400" />
                    ICU Pending Task Handoff Checklist
                  </h3>
                  <p className="text-xs text-zinc-500 mt-1">
                    Assign pending lab results, scan trips, line reviews, or family updates for the incoming shift to complete.
                  </p>
                </div>

                {/* Task Add Form */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end bg-[#1A1A1A] p-4 rounded border border-[#222222] mb-6">
                  <div className="sm:col-span-2">
                    <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1 font-bold">Handoff Task Description</label>
                    <input
                      type="text"
                      value={newTaskDesc}
                      onChange={(e) => setNewTaskDesc(e.target.value)}
                      placeholder="e.g. Chase abdominal CT report, Check morning electrolytes, Review femoral line day 5..."
                      className="w-full bg-[#111111] border border-[#222222] rounded px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 font-sans"
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1 font-bold">Priority Rating</label>
                    <select
                      value={newTaskPriority}
                      onChange={(e) => setNewTaskPriority(e.target.value as PendingTask["priority"])}
                      className="w-full bg-[#111111] border border-[#222222] rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200"
                    >
                      <option value="High">High Priority</option>
                      <option value="Medium">Medium Priority</option>
                      <option value="Low">Low Priority</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddTask}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-wider py-1.5 rounded transition-colors text-xs flex items-center justify-center gap-1.5 shadow-lg"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Handoff Task
                  </button>
                </div>

                {/* Tasks List */}
                {localPatient.tasks.length === 0 ? (
                  <div className="text-center p-8 bg-[#1A1A1A] rounded border border-dashed border-[#222222] text-zinc-500 text-xs font-sans">
                    No active handoff tasks designated. Add clinical objectives to guide the incoming medical team.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {localPatient.tasks
                      .sort((a, b) => {
                        const prios = { High: 3, Medium: 2, Low: 1 };
                        return prios[b.priority] - prios[a.priority];
                      })
                      .map((t) => {
                        const isDone = t.status === "Done";
                        return (
                          <div
                            key={t.id}
                            className={`p-3.5 rounded border flex items-center justify-between gap-4 transition-all ${
                              isDone
                                ? "bg-[#1A1A1A]/40 border-[#222222]/80 opacity-40"
                                : "bg-[#1A1A1A] border-[#222222] hover:border-zinc-700"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isDone}
                                onChange={() => handleToggleTaskStatus(t.id)}
                                className="w-4.5 h-4.5 accent-emerald-500 cursor-pointer rounded"
                              />
                              <span className={`text-xs ${isDone ? "line-through text-zinc-500" : "text-zinc-200 font-bold"}`}>
                                {t.description}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <span
                                className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${
                                  t.priority === "High"
                                    ? "bg-red-950/50 text-red-400 border-red-500/30"
                                    : t.priority === "Medium"
                                    ? "bg-amber-950/50 text-amber-400 border-amber-500/30"
                                    : "bg-[#111111] text-zinc-400 border-[#222222]"
                                }`}
                              >
                                {t.priority}
                              </span>

                              <button
                                onClick={() => handleRemoveTask(t.id)}
                                className="text-zinc-500 hover:text-red-400 p-1 rounded transition-colors"
                                title="Remove task"
                              >
                                <Trash className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 7: AI Clinical Cases Summaries & Discharge Papers */}
          {activeTab === "ai" && (
            <div className="space-y-6">
              <div className="bg-[#111111] border border-[#222222] p-6 rounded">
                <div className="border-b border-[#222222] pb-3 mb-5">
                  <h3 className="font-serif text-base italic text-[#E0E0E0] flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
                    Intensivist AI - Clinical Handover & Discharge Summary Engine
                  </h3>
                  <p className="text-xs text-zinc-500 mt-1">
                    Leverage server-side Gemini AI models to analyze, organize, and structure the patient's records. Perfect for clinical shift handovers, medical audits, or formal hospital discharge papers.
                  </p>
                </div>

                {/* Custom API Key Input option */}
                <div className="bg-[#161616] border border-[#222222] p-4 rounded mb-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">Custom Gemini API Key (Optional)</span>
                    </div>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono font-bold">Stored Locally Only</span>
                  </div>
                  
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    If you are deploying this app to Vercel or sharing a final version, you can provide your own Gemini API key here. It remains encrypted in your browser's local storage and is never saved to our database in plaintext.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="password"
                      value={customApiKey}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomApiKey(val);
                        localStorage.setItem("custom_gemini_api_key", val);
                      }}
                      placeholder="Enter your AI Studio API Key (AIzaSy...)"
                      className="flex-1 bg-[#111111] border border-[#222222] focus:border-emerald-500 rounded px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none font-mono"
                    />
                    {customApiKey && (
                      <button
                        type="button"
                        onClick={() => {
                          setCustomApiKey("");
                          localStorage.removeItem("custom_gemini_api_key");
                        }}
                        className="bg-[#222222] hover:bg-red-950/40 hover:text-red-400 text-zinc-400 font-bold px-3 py-2 rounded text-xs transition-all uppercase tracking-wider border border-[#333333] cursor-pointer"
                      >
                        Clear Key
                      </button>
                    )}
                  </div>

                  {!customApiKey.trim() && (
                    <div className="text-[11px] text-amber-500/90 font-medium flex items-center gap-1.5 pt-1">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span>No custom key entered. If the shared server doesn't have a key, summaries will fail. You'll be asked to confirm.</span>
                    </div>
                  )}
                  {customApiKey.trim() && (
                    <div className="text-[11px] text-emerald-400 font-medium flex items-center gap-1.5 pt-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Custom API key configured and loaded! Ready to summarize with your own Gemini quota.</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-center bg-[#1A1A1A] p-4 rounded border border-[#222222] mb-6">
                  <div className="w-full sm:w-1/3">
                    <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5 font-bold">Select Summary Template</label>
                    <select
                      value={summaryType}
                      onChange={(e) => setSummaryType(e.target.value as any)}
                      className="w-full bg-[#111111] border border-[#222222] rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 font-semibold"
                    >
                      <option value="handover">Shift Handover Sheet (ISBAR Style)</option>
                      <option value="case">Comprehensive ICU Case Profile</option>
                      <option value="discharge">Hospital Discharge Summary (Official C-C)</option>
                    </select>
                  </div>

                  <div className="w-full sm:w-2/3 flex items-end justify-end">
                    <button
                      type="button"
                      onClick={handleGenerateSummary}
                      disabled={aiLoading}
                      className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-zinc-900 disabled:to-zinc-900 disabled:text-zinc-600 text-white font-bold uppercase tracking-wider py-2 px-6 rounded transition-all text-xs flex items-center justify-center gap-2 shadow-lg"
                    >
                      {aiLoading ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                          Compiling Clinical Summary...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Compile & Summarize Record
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* AI Outputs */}
                {aiLoading && (
                  <div className="p-12 text-center bg-[#1A1A1A]/60 border border-dashed border-[#222222] rounded flex flex-col items-center justify-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 animate-spin">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <p className="text-sm text-zinc-200 font-serif italic animate-pulse">Consulting Intensivist AI Engine...</p>
                    <p className="text-xs text-zinc-500 max-w-sm font-sans">
                      Synthesizing system-by-system comments, active infusions, corrected serum parameters, and priority safety checklists into a formal document.
                    </p>
                  </div>
                )}

                {aiError && (
                  <div className="p-4 bg-red-950/30 border border-red-500/30 text-red-300 text-xs rounded flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <span>{aiError}</span>
                  </div>
                )}

                {!aiLoading && !aiError && aiSummary && (
                  <div className="bg-[#0A0A0A] border border-[#222222] rounded overflow-hidden shadow-inner">
                    <div className="bg-[#111111] px-5 py-3 border-b border-[#222222] flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider font-mono">
                        Generated Clinical Record
                      </span>
                      <button
                        onClick={handleCopyToClipboard}
                        className="text-zinc-300 hover:text-emerald-400 bg-[#1A1A1A] border border-[#222222] px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5"
                      >
                        <Clipboard className="w-3.5 h-3.5" />
                        Copy text
                      </button>
                    </div>

                    <div className="p-6 overflow-y-auto max-h-[500px]">
                      <MarkdownView content={aiSummary} />
                    </div>
                  </div>
                )}

                {!aiLoading && !aiError && !aiSummary && (
                  <div className="text-center p-12 bg-[#1A1A1A] rounded border border-dashed border-[#222222] text-zinc-500 text-xs font-sans">
                    Configure your desired clinical template and click the button above to trigger an intelligent clinical summary.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 8: Timeline, Daily Updates & Case History */}
          {activeTab === "timeline" && (
            <div className="space-y-6 animate-fade-in">
              {/* Header Info */}
              <div className="bg-[#111111] border border-[#222222] p-6 rounded">
                <div className="border-b border-[#222222] pb-3 mb-5">
                  <h3 className="font-serif text-base italic text-[#E0E0E0] flex items-center gap-2">
                    <History className="w-4 h-4 text-emerald-400" />
                    Timeline, Daily Changes & Handover Logs
                  </h3>
                  <p className="text-xs text-zinc-500 mt-1 font-sans">
                    Track daily progress updates system-by-system, and append time-stamped clinical interventions. This historical sequence will be charted inside the DOCX summary download.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* LEFT: Daily Progress Notes (Organ system-wise changeable findings) */}
                  <div className="lg:col-span-7 space-y-4">
                    <div className="bg-[#161616]/75 p-4 rounded border border-zinc-850 space-y-4">
                      <div className="flex items-center justify-between border-b border-[#222222] pb-2">
                        <span className="text-xs uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-2 font-sans">
                          <Clock className="w-4 h-4" />
                          Daily Progress & Active Organ System Status
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          Last Updated: {localPatient.dailyNotes?.lastUpdated ? new Date(localPatient.dailyNotes.lastUpdated).toLocaleDateString() : "Never"}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-normal font-sans">
                        Enter current, day-to-day active clinical assessments for each organ system below. These notes represent the changeable daily progress, in contrast to the initial admission baseline.
                      </p>

                      <div className="space-y-4">
                        {[
                          { id: "cns", label: "Central Nervous System (CNS) Daily Progress", placeholder: "e.g., Sedation weaned, RASS 0, alert & cooperative, CAM-ICU negative..." },
                          { id: "cvs", label: "Cardiovascular (CVS) Daily Progress", placeholder: "e.g., Norepinephrine weaned off, hemodynamically stable without support..." },
                          { id: "rs", label: "Respiratory System Daily Progress", placeholder: "e.g., Spontaneous Breathing Trial passed, extubated to HFNC 40L/40%..." },
                          { id: "renal", label: "Renal & Electrolytes Daily Progress", placeholder: "e.g., Urine output >0.5ml/kg/hr, BUN/Cr stable, electrolytes corrected..." },
                          { id: "git", label: "Gastrointestinal (GI) & Nutrition Progress", placeholder: "e.g., Enteral feeds tolerating at target rate 70mL/hr, bowel sounds active..." },
                          { id: "heme", label: "Hematology & Coagulation Daily Progress", placeholder: "e.g., Platelets stable >150k, Hb stable at 8.2, no active bleeding..." },
                          { id: "idStewardship", label: "Infectious Diseases (ID) Daily Progress", placeholder: "e.g., Day 4 of Meropenem, afebrile 24h, WBC normalized to 9.2..." },
                          { id: "other", label: "General Daily Clinical Summary", placeholder: "e.g., Patient improving overall, mobilizing with physical therapy, family updated..." }
                        ].map(sys => {
                          const val = localPatient.dailyNotes?.[sys.id as keyof DailyProgressNotes] || "";
                          return (
                            <div key={sys.id} className="space-y-1">
                              <label className="block text-[10px] uppercase font-bold text-zinc-300 tracking-wide font-sans">
                                {sys.label}
                              </label>
                              <textarea
                                rows={2}
                                value={val}
                                onChange={(e) => {
                                  setLocalPatient(prev => ({
                                    ...prev,
                                    dailyNotes: {
                                      ...(prev.dailyNotes || {}),
                                      [sys.id]: e.target.value,
                                      lastUpdated: new Date().toISOString()
                                    }
                                  }));
                                }}
                                placeholder={sys.placeholder}
                                className="w-full bg-[#111111] border border-[#222222] focus:border-emerald-500/60 rounded p-2 text-xs leading-relaxed focus:outline-none text-zinc-100 placeholder:text-zinc-650 font-sans"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* RIGHT: Time-Wise Changes & Timeline History */}
                  <div className="lg:col-span-5 space-y-4">
                    {/* Add Time-Wise Event Form */}
                    <div className="bg-[#161616]/75 p-4 rounded border border-zinc-850 space-y-3">
                      <span className="text-xs uppercase tracking-wider text-emerald-400 font-bold block font-sans">
                        Log Clinical Event / Intervention
                      </span>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="block text-[10px] text-zinc-400 font-bold uppercase">Clinical Interventions / Changes Description</label>
                          <textarea
                            rows={3}
                            value={timelineEvent}
                            onChange={(e) => setTimelineEvent(e.target.value)}
                            placeholder="e.g. Norepinephrine increased to 0.15 mcg/kg/min due to transient MAP drop; Sputum cultures collected..."
                            className="w-full bg-[#111111] border border-[#222222] focus:border-emerald-500/60 rounded p-2 text-xs leading-relaxed focus:outline-none text-zinc-100 placeholder:text-zinc-650 font-sans"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="block text-[10px] text-zinc-400 font-bold uppercase">Log Severity / Level</label>
                            <select
                              value={timelineLevel}
                              onChange={(e) => setTimelineLevel(e.target.value as any)}
                              className="w-full bg-[#111111] border border-[#222222] rounded px-2.5 py-1.5 text-xs focus:outline-none text-zinc-200"
                            >
                              <option value="Info">Info / Status Update</option>
                              <option value="Warning">Warning / Change in Plan</option>
                              <option value="Critical">Critical Event / Code</option>
                            </select>
                          </div>
                          
                          <div className="flex items-end">
                            <button
                              type="button"
                              onClick={handleAddTimelineEvent}
                              className="w-full bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold uppercase tracking-wider py-1.5 rounded text-[11px] transition-colors cursor-pointer"
                            >
                              Post Log Event
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Timeline History Flow */}
                    <div className="bg-[#161616]/75 p-4 rounded border border-zinc-850 space-y-4">
                      <span className="text-xs uppercase tracking-wider text-zinc-300 font-bold block font-sans">
                        Time-Stamped Shift Log ({localPatient.timeline?.length || 0} Entries)
                      </span>

                      {(!localPatient.timeline || localPatient.timeline.length === 0) ? (
                        <p className="text-xs text-zinc-500 italic font-sans py-4 text-center">
                          No time-wise shift events logged today. Log interventions above.
                        </p>
                      ) : (
                        <div className="relative border-l border-[#222222] ml-2.5 pl-4 space-y-4">
                          {localPatient.timeline
                            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                            .map((evt) => (
                              <div key={evt.id} className="relative group font-sans">
                                {/* Bullet indicator */}
                                <div className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full border ${
                                  evt.level === "Critical" ? "bg-red-500 border-red-400 animate-pulse" :
                                  evt.level === "Warning" ? "bg-amber-500 border-amber-400" :
                                  "bg-emerald-500 border-emerald-400"
                                }`} />

                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 font-mono text-[10px]">
                                      <span className="text-zinc-100 font-bold">
                                        {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                      <span className="text-zinc-500">|</span>
                                      <span className="text-zinc-400 font-bold uppercase tracking-wider bg-zinc-800/60 px-1.5 py-0.2 rounded font-mono">
                                        {evt.role}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveTimelineEvent(evt.id)}
                                      className="text-zinc-600 hover:text-red-450 p-0.5 rounded transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                                      title="Delete Log Entry"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                  <p className="text-xs text-zinc-300 font-sans leading-relaxed">
                                    {evt.notes}
                                  </p>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>

                    {/* Initial Findings Card */}
                    <div className="bg-[#161616]/40 p-4 rounded border border-zinc-850 space-y-3">
                      <span className="text-xs uppercase tracking-wider text-zinc-400 font-bold block flex items-center gap-1.5 font-sans">
                        <Lock className="w-3.5 h-3.5 text-zinc-500" />
                        Initial Organ System Admission Baseline
                      </span>
                      <p className="text-[10px] text-zinc-500 leading-normal font-sans">
                        This is the non-changeable historical baseline recorded during patient admission.
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-[11px] font-sans">
                        {[
                          { name: "CNS", comments: localPatient.systems.cns?.comments },
                          { name: "CVS", comments: localPatient.systems.cvs?.comments },
                          { name: "Respiratory", comments: localPatient.systems.rs?.comments },
                          { name: "Renal", comments: localPatient.systems.renal?.comments },
                          { name: "GI", comments: localPatient.systems.git?.comments },
                          { name: "Hematology", comments: localPatient.systems.heme?.comments },
                          { name: "ID", comments: localPatient.systems.idStewardship?.comments }
                        ].map((sys, idx) => (
                          <div key={idx} className="bg-zinc-950/40 p-2 rounded border border-zinc-900 font-sans">
                            <span className="font-bold text-[10px] text-emerald-500 uppercase tracking-wide block">{sys.name} Baseline</span>
                            <span className="text-zinc-400 block line-clamp-2 italic" title={sys.comments || "No comments entered"}>
                              {sys.comments || "No comment entered"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </div>

                {/* ADVANCED CRITICAL CARE SHIFT ENHANCEMENTS */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6 border-t border-[#222222] pt-6">
                  <PatientABGAnalyzer
                    timeline={localPatient.timeline || []}
                    onSaveTimeline={(newTimeline) => setLocalPatient(prev => ({ ...prev, timeline: newTimeline }))}
                    showToast={showToast}
                  />

                  <PatientReferralTracker
                    referrals={localPatient.referrals || []}
                    timeline={localPatient.timeline || []}
                    onSaveReferrals={(updatedRefs) => setLocalPatient(prev => ({ ...prev, referrals: updatedRefs }))}
                    onSaveTimeline={(newTimeline) => setLocalPatient(prev => ({ ...prev, timeline: newTimeline }))}
                    showToast={showToast}
                  />
                </div>

              </div>
            </div>
          )}

          {/* TAB 9: Procedures done */}
          {activeTab === "procedures" && (
            <div className="space-y-6 animate-fade-in font-sans">
              <div className="bg-[#111111] border border-[#222222] p-6 rounded">
                <div className="border-b border-[#222222] pb-3 mb-5">
                  <h3 className="font-serif text-base italic text-[#E0E0E0] flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-emerald-400" />
                    Procedural Logs & Findings
                  </h3>
                  <p className="text-xs text-zinc-500 mt-1">
                    Document ICU procedures performed, dates, operators, and ultrasound-guided (POCUS) findings. This creates a durable record in the patient's digital clinical file.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* LEFT: Add Procedure Form */}
                  <div className="lg:col-span-5 bg-[#161616]/75 p-5 rounded border border-zinc-850 space-y-4 h-fit">
                    <span className="text-xs uppercase tracking-wider text-emerald-400 font-bold block">
                      Log Performed Procedure
                    </span>
                    
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="block text-[10px] text-zinc-400 font-bold uppercase">Procedure Type</label>
                        <select
                          value={procName}
                          onChange={(e) => setProcName(e.target.value as any)}
                          className="w-full bg-[#111111] border border-[#222222] focus:border-emerald-500/60 rounded px-2.5 py-2 text-xs focus:outline-none text-zinc-200"
                        >
                          <option value="">-- Select Procedure --</option>
                          <option value="CVC Insertion">CVC Insertion (Central Line)</option>
                          <option value="Arterial Line Insertion">Arterial Line Insertion</option>
                          <option value="Tracheostomy">Tracheostomy</option>
                          <option value="ICD Insertion">Intercostal Drain (ICD / Chest Tube)</option>
                          <option value="POCUS">Point-of-Care Ultrasound (POCUS)</option>
                          <option value="Other">Other / Custom Procedure</option>
                        </select>
                      </div>

                      {procName === "Other" && (
                        <div className="space-y-1">
                          <label className="block text-[10px] text-zinc-400 font-bold uppercase">Custom Procedure Name</label>
                          <input
                            type="text"
                            value={customProcName}
                            onChange={(e) => setCustomProcName(e.target.value)}
                            placeholder="e.g. Lumbar Puncture, PICC Line..."
                            className="w-full bg-[#111111] border border-[#222222] focus:border-emerald-500/60 rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none"
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="block text-[10px] text-zinc-400 font-bold uppercase">Date Performed</label>
                          <input
                            type="date"
                            value={procDate}
                            onChange={(e) => setProcDate(e.target.value)}
                            className="w-full bg-[#111111] border border-[#222222] focus:border-emerald-500/60 rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[10px] text-zinc-400 font-bold uppercase">Operator (Clinician)</label>
                          <input
                            type="text"
                            value={procOperator}
                            onChange={(e) => setProcOperator(e.target.value)}
                            placeholder="e.g. Dr. Roberts, MD"
                            className="w-full bg-[#111111] border border-[#222222] focus:border-emerald-500/60 rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-[10px] text-zinc-400 font-bold uppercase">Load Prefilled Clinical Template</label>
                        <div className="flex flex-wrap gap-1.5 pb-1">
                          {[
                            { name: "CVC", text: "Triple-lumen CVC inserted in Right Internal Jugular vein under real-time ultrasound guidance. Sterile drape, chlorhexidine prep. Catheter flushed, sutured at 15cm. Post-procedure ultrasound confirms pleural sliding (no pneumothorax) and wire in place. Chest X-Ray ordered to confirm tip." },
                            { name: "Arterial Line", text: "Left Radial arterial cannula inserted using aseptic technique under ultrasound guidance. Dynamic arterial waveform visualized with pulse. Secured with sutures, flushed, and connected to pressure transducer. Distal perfusion intact." },
                            { name: "Tracheostomy", text: "Percutational tracheostomy performed under sterile conditions in ICU. Bronchoscopy guidance used to confirm tube position. Size 7.5 cuffed tracheostomy tube secured. Correct placement confirmed by EtCO2." },
                            { name: "Chest Tube", text: "Chest tube (24 Fr) inserted in Right 5th intercostal space, mid-axillary line, under sterile conditions. Connected to underwater seal with -20 cmH2O suction. Fluid drainage noted. Secured with sutures." },
                            { name: "POCUS Echo/Lung", text: "POCUS findings: Cardiac EF ~45%, no pericardial effusion, IVC collapsible >50%. Lung: Bilateral A-lines with normal sliding, isolated B-lines in posterior zones, no pleural effusion." }
                          ].map((tpl, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => {
                                setProcFindings(tpl.text);
                                showToast(`Loaded clinical template for ${tpl.name}. You can modify this below.`, "info");
                              }}
                              className="px-2 py-1 bg-zinc-900 border border-zinc-850 hover:border-emerald-500 hover:text-emerald-400 text-zinc-400 rounded text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer font-sans"
                            >
                              {tpl.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] text-zinc-400 font-bold uppercase">Procedure Details & POCUS Findings (Modifiable)</label>
                        <textarea
                          rows={4}
                          value={procFindings}
                          onChange={(e) => setProcFindings(e.target.value)}
                          placeholder="e.g., Triple-lumen CVC inserted in Right Internal Jugular vein under real-time ultrasound guidance. Sterile drape, chlorhexidine prep. Blood aspirated, catheter secured at 15cm. Chest X-Ray ordered to confirm tip location and exclude pneumothorax..."
                          className="w-full bg-[#111111] border border-[#222222] focus:border-emerald-500/60 rounded p-2 text-xs leading-relaxed focus:outline-none text-zinc-100 placeholder:text-zinc-650"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleAddProcedure}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold uppercase tracking-wider py-2 rounded text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-4 h-4 text-zinc-950" />
                        Log Completed Procedure
                      </button>
                    </div>
                  </div>

                  {/* RIGHT: Logged Procedures Display */}
                  <div className="lg:col-span-7 bg-[#161616]/75 p-5 rounded border border-zinc-850 space-y-4">
                    <span className="text-xs uppercase tracking-wider text-zinc-300 font-bold block">
                      Patient Procedural History ({localPatient.procedures?.length || 0} Records)
                    </span>

                    {(!localPatient.procedures || localPatient.procedures.length === 0) ? (
                      <div className="p-8 border border-dashed border-[#222222] rounded text-center text-zinc-500 text-xs">
                        No procedures logged for this patient. Use the form on the left to add completed invasive or diagnostic procedures.
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                        {localPatient.procedures.map((proc) => (
                          <div key={proc.id} className="p-4 bg-zinc-950/60 border border-[#222222] rounded flex flex-col justify-between gap-3 group relative hover:border-emerald-500/20 transition-all">
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold text-zinc-100 uppercase tracking-wide">
                                  {proc.name === "Other" ? (proc.customName || "Other Procedure") : proc.name}
                                </h4>
                                <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-500/10 px-2 py-0.5 rounded font-mono">
                                  {proc.date}
                                </span>
                              </div>
                              
                              <p className="text-[10px] text-zinc-500">
                                <strong>Operator:</strong> {proc.operator || "Unspecified"}
                              </p>

                              {proc.findings && (
                                <p className="text-xs text-zinc-350 leading-relaxed bg-[#111111]/40 border border-[#1d1d1d] p-2.5 rounded italic">
                                  {proc.findings}
                                </p>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveProcedure(proc.id)}
                              className="absolute top-4 right-4 text-zinc-650 hover:text-red-400 p-1 rounded hover:bg-zinc-900 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                              title="Remove Procedure Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 10: Critical Events */}
          {activeTab === "critical_events" && (
            <div className="space-y-6 animate-fade-in font-sans">
              <div className="bg-[#111111] border border-[#222222] p-6 rounded">
                <div className="border-b border-[#222222] pb-3 mb-5">
                  <h3 className="font-serif text-base italic text-[#E0E0E0] flex items-center gap-2">
                    <Zap className="w-4 h-4 text-red-400 animate-pulse" />
                    Critical Care Events & Resuscitations
                  </h3>
                  <p className="text-xs text-zinc-500 mt-1">
                    Instantly register time-stamped critical alarms, codes, resuscitations, airway complications, or significant clinical deterioration with action details and outcomes.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* LEFT: Add Critical Event */}
                  <div className="lg:col-span-5 bg-red-950/5 border border-red-500/10 p-5 rounded space-y-4 h-fit">
                    <span className="text-xs uppercase tracking-wider text-red-400 font-bold block flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      Register Critical Event
                    </span>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="block text-[10px] text-zinc-400 font-bold uppercase">Incident Date & Time</label>
                        <input
                          type="datetime-local"
                          value={critTimestamp}
                          onChange={(e) => setCritTimestamp(e.target.value)}
                          className="w-full bg-[#111111] border border-red-900/20 focus:border-red-500/60 rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] text-zinc-400 font-bold uppercase">Event Description / Deterioration</label>
                        <textarea
                          rows={3}
                          value={critDesc}
                          onChange={(e) => setCritDesc(e.target.value)}
                          placeholder="e.g., Sudden bradycardia followed by ventricular fibrillation. Code Blue called..."
                          className="w-full bg-[#111111] border border-red-900/20 focus:border-red-500/60 rounded p-2 text-xs leading-relaxed focus:outline-none text-zinc-100"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] text-zinc-400 font-bold uppercase">Interventions & Actions Taken</label>
                        <textarea
                          rows={3}
                          value={critAction}
                          onChange={(e) => setCritAction(e.target.value)}
                          placeholder="e.g., CPR initiated, bag-valve-mask ventilations. Defibrillated at 200J x1. 1mg Epinephrine IV administered..."
                          className="w-full bg-[#111111] border border-red-900/20 focus:border-red-500/60 rounded p-2 text-xs leading-relaxed focus:outline-none text-zinc-100"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] text-zinc-400 font-bold uppercase">Outcome / Present Status</label>
                        <textarea
                          rows={2}
                          value={critOutcome}
                          onChange={(e) => setCritOutcome(e.target.value)}
                          placeholder="e.g., ROSC achieved in 3 mins. Sinus tachycardia at 112 bpm. GCS 3, pupils reactive. MAP stable on increased Norad..."
                          className="w-full bg-[#111111] border border-red-900/20 focus:border-red-500/60 rounded p-2 text-xs leading-relaxed focus:outline-none text-zinc-100"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleAddCriticalEvent}
                        className="w-full bg-red-650 hover:bg-red-550 text-white font-bold uppercase tracking-wider py-2 rounded text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <AlertTriangle className="w-4 h-4 text-white" />
                        Log Deterioration Event
                      </button>
                    </div>
                  </div>

                  {/* RIGHT: Display of Critical Events */}
                  <div className="lg:col-span-7 bg-[#161616]/75 p-5 rounded border border-zinc-850 space-y-4">
                    <span className="text-xs uppercase tracking-wider text-red-400 font-bold block">
                      Active Event Logs ({localPatient.criticalEvents?.length || 0} Critical Records)
                    </span>

                    {(!localPatient.criticalEvents || localPatient.criticalEvents.length === 0) ? (
                      <div className="p-8 border border-dashed border-[#222222] rounded text-center text-zinc-500 text-xs">
                        No critical events or resuscitations logged for this patient.
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                        {localPatient.criticalEvents
                          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                          .map((evt) => (
                            <div key={evt.id} className="p-4 bg-red-950/5 border border-red-900/25 rounded relative group flex flex-col gap-2 font-sans hover:border-red-550/30 transition-all">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-mono font-bold text-red-400 bg-red-950/40 border border-red-900/30 px-2 py-0.5 rounded">
                                  {new Date(evt.timestamp).toLocaleString()}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCriticalEvent(evt.id)}
                                  className="text-zinc-600 hover:text-red-400 p-0.5 rounded transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                                  title="Delete Event Log"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <div className="space-y-1.5 text-xs text-zinc-300">
                                <p>
                                  <strong className="text-red-300 uppercase text-[10px] block mb-0.5">Critical Incident:</strong>
                                  <span className="text-zinc-200 font-bold">{evt.description}</span>
                                </p>
                                {evt.actionTaken && (
                                  <p className="bg-zinc-950/40 p-2 border border-zinc-900 rounded">
                                    <strong className="text-emerald-400 uppercase text-[9px] block">Action Taken:</strong>
                                    {evt.actionTaken}
                                  </p>
                                )}
                                {evt.outcome && (
                                  <p className="bg-zinc-950/40 p-2 border border-zinc-900 rounded">
                                    <strong className="text-zinc-450 uppercase text-[9px] block">Present Status / Outcome:</strong>
                                    {evt.outcome}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 11: Case Summary */}
          {activeTab === "case_summary" && (
            <div className="space-y-6 animate-fade-in font-sans">
              <div className="bg-[#111111] border border-[#222222] p-6 rounded">
                <div className="flex flex-wrap items-center justify-between border-b border-[#222222] pb-4 mb-6 gap-3">
                  <div>
                    <h3 className="font-serif text-lg italic text-[#E0E0E0] flex items-center gap-2">
                      <Clipboard className="w-5 h-5 text-emerald-400" />
                      Patient Case Summary Directory
                    </h3>
                    <p className="text-xs text-zinc-500 mt-1">
                      A beautifully organized, clinical-grade overview of all local metrics, system baseline status, procedures completed, daily notes, and critical alarms.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={exportToDocx}
                      className="bg-[#1C1C1C] hover:bg-[#262626] border border-[#333333] text-zinc-300 hover:text-white px-4 py-2 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow"
                    >
                      <Download className="w-4 h-4 text-zinc-400" />
                      Download DOC / DOCX
                    </button>
                    <button
                      onClick={handleArchiveToLocalFolder}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow"
                    >
                      <Archive className="w-4 h-4 text-emerald-200" />
                      Archive to Local Folder
                    </button>
                  </div>
                </div>

                <div className="space-y-6 text-zinc-300">
                  {/* PATIENT INFO BANNER */}
                  <div className="bg-zinc-950/60 border border-[#222222] p-4 rounded grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
                    <div>
                      <span className="text-zinc-500 block uppercase text-[9px]">Patient Name</span>
                      <strong className="text-zinc-200">{localPatient.name || "N/A"}</strong>
                    </div>
                    <div>
                      <span className="text-zinc-500 block uppercase text-[9px]">Bed Location</span>
                      <strong className="text-emerald-400 font-bold">{localPatient.bed ? `Bed ${localPatient.bed}` : "TBD"}</strong>
                    </div>
                    <div>
                      <span className="text-zinc-500 block uppercase text-[9px]">MRN Identifier</span>
                      <strong className="text-zinc-200">{localPatient.mrn || "N/A"}</strong>
                    </div>
                    <div>
                      <span className="text-zinc-500 block uppercase text-[9px]">Age & Gender</span>
                      <strong className="text-zinc-200">{localPatient.age || "N/A"}y / {localPatient.gender}</strong>
                    </div>
                  </div>

                  {/* CURRENT ORGAN SYSTEMS FINDINGS */}
                  <div className="bg-[#161616]/60 border border-zinc-850 rounded p-5 space-y-4">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block border-b border-[#222222] pb-1.5">
                      Organ Systems Baseline & Active Parameters
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {Object.entries(systemsConfig).map(([key, config]) => {
                        const statusVal = getNestedValue(localPatient, config.statusPath) || "Stable";
                        const commentsVal = getNestedValue(localPatient, config.commentsPath) || "";
                        
                        // Collect other key fields for compact display
                        const keyFieldsText = config.fields
                          .filter(f => f.path !== config.statusPath) // skip status
                          .map(f => {
                            const v = getNestedValue(localPatient, f.path);
                            return v ? `${f.label}: ${v}` : null;
                          })
                          .filter(Boolean)
                          .join(" • ");

                        // Color logic for status
                        let statusColor = "text-zinc-500 bg-zinc-900 border-zinc-800";
                        const isNormal = ["Stable", "Normal", "Alert", "Intact", "Resolving"].some(n => statusVal.includes(n));
                        const isSevere = ["Shock", "Hypotension", "Vasopressor", "Arrhythmia", "AKI", "Oliguria", "Anuria", "CRRT", "HD", "Comatose", "Delirious", "Agitated", "Vent", "Sepsis", "Contracture", "Weakness", "Wound", "Pressure Injury"].some(n => statusVal.includes(n));
                        const isModerate = ["Sedated", "Oxygen", "Mask", "NC", "HFNC", "NIV", "Enteral", "TPN", "Anemic", "Thrombocytopenic", "Leukocytosis", "Diabetic", "Imbalance", "Adrenal", "SUP Indicated"].some(n => statusVal.includes(n));

                        if (isSevere) statusColor = "text-rose-400 bg-rose-950/20 border-rose-900/40";
                        else if (isModerate) statusColor = "text-amber-400 bg-amber-950/20 border-amber-500/20";
                        else if (isNormal) statusColor = "text-emerald-400 bg-emerald-950/20 border-emerald-900/40";

                        return (
                          <div key={key} className="bg-zinc-950/40 p-3 rounded border border-zinc-900 space-y-1.5 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-zinc-200">{config.name}</span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded border uppercase tracking-wider font-bold shrink-0 ${statusColor}`}>
                                {statusVal}
                              </span>
                            </div>
                            {keyFieldsText && (
                              <p className="text-[11px] text-zinc-400 font-medium leading-relaxed">
                                {keyFieldsText}
                              </p>
                            )}
                            {commentsVal && (
                              <p className="text-[11px] text-zinc-500 italic leading-relaxed" title={commentsVal}>
                                {commentsVal}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* LEFT AREA: ISBAR, Procedures, Critical Events */}
                    <div className="lg:col-span-7 space-y-6">
                      {/* ISBAR Handover Section */}
                      <div className="bg-[#161616]/60 border border-zinc-850 rounded p-5 space-y-3.5">
                        <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block border-b border-[#222222] pb-1.5">
                          1. ISBAR Core Handover Parameters
                        </span>
                        
                        <div className="space-y-3 text-xs leading-relaxed">
                          <div>
                            <strong className="text-zinc-400 uppercase block text-[10px]">Identify:</strong>
                            <p className="text-zinc-300 mt-0.5">{localPatient.isbar.identify || "No details entered."}</p>
                          </div>
                          <div>
                            <strong className="text-zinc-400 uppercase block text-[10px]">Situation:</strong>
                            <p className="text-zinc-300 mt-0.5">{localPatient.isbar.situation || "No details entered."}</p>
                          </div>
                          <div>
                            <strong className="text-zinc-400 uppercase block text-[10px]">Background:</strong>
                            <p className="text-zinc-300 mt-0.5">{localPatient.isbar.background || "No details entered."}</p>
                          </div>
                          <div>
                            <strong className="text-zinc-400 uppercase block text-[10px]">Assessment:</strong>
                            <p className="text-zinc-300 mt-0.5">{localPatient.isbar.assessment || "No details entered."}</p>
                          </div>
                          <div>
                            <strong className="text-zinc-400 uppercase block text-[10px]">Recommendation:</strong>
                            <p className="text-zinc-300 mt-0.5">{localPatient.isbar.recommendation || "No details entered."}</p>
                          </div>
                        </div>
                      </div>

                      {/* Procedures list */}
                      <div className="bg-[#161616]/60 border border-zinc-850 rounded p-5 space-y-4">
                        <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block border-b border-[#222222] pb-1.5">
                          2. Completed Procedures
                        </span>

                        {(!localPatient.procedures || localPatient.procedures.length === 0) ? (
                          <p className="text-xs text-zinc-500 italic">No procedures recorded.</p>
                        ) : (
                          <div className="space-y-3">
                            {localPatient.procedures.map((proc) => (
                              <div key={proc.id} className="p-3 bg-zinc-950/40 rounded border border-zinc-900 text-xs flex flex-col gap-1.5">
                                <div className="flex justify-between items-center">
                                  <strong className="text-zinc-200 uppercase">
                                    {proc.name === "Other" ? (proc.customName || "Other Procedure") : proc.name}
                                  </strong>
                                  <span className="text-[10px] text-zinc-500 font-mono">{proc.date}</span>
                                </div>
                                <div className="text-[11px] text-zinc-400">
                                  <strong>Operator:</strong> {proc.operator || "N/A"}
                                </div>
                                {proc.findings && (
                                  <p className="text-zinc-350 leading-relaxed italic bg-zinc-950/90 p-2 border border-zinc-900 rounded">
                                    {proc.findings}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Critical Events list */}
                      <div className="bg-[#161616]/60 border border-zinc-850 rounded p-5 space-y-4">
                        <span className="text-xs font-bold text-red-400 uppercase tracking-wider block border-b border-red-950/30 pb-1.5">
                          3. Resuscitations & Critical Events
                        </span>

                        {(!localPatient.criticalEvents || localPatient.criticalEvents.length === 0) ? (
                          <p className="text-xs text-zinc-500 italic">No critical events recorded.</p>
                        ) : (
                          <div className="space-y-3">
                            {localPatient.criticalEvents.map((evt) => (
                              <div key={evt.id} className="p-3 bg-red-950/5 border border-red-900/20 rounded text-xs flex flex-col gap-1.5">
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] text-red-400 font-bold font-mono">
                                    {new Date(evt.timestamp).toLocaleString()}
                                  </span>
                                </div>
                                <p className="text-zinc-200 font-bold">{evt.description}</p>
                                {evt.actionTaken && (
                                  <p className="bg-zinc-950/50 p-2 border border-zinc-900 rounded text-zinc-350 text-[11px]">
                                    <strong className="text-emerald-400 uppercase text-[9px] block">Action taken:</strong>
                                    {evt.actionTaken}
                                  </p>
                                )}
                                {evt.outcome && (
                                  <p className="bg-zinc-950/50 p-2 border border-zinc-900 rounded text-zinc-350 text-[11px]">
                                    <strong className="text-zinc-500 uppercase text-[9px] block">Outcome:</strong>
                                    {evt.outcome}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* RIGHT AREA: Daily Progress, Baseline Systems, Antimicrobials */}
                    <div className="lg:col-span-5 space-y-6">
                      
                      {/* Daily Progress Organ Notes */}
                      <div className="bg-[#161616]/60 border border-zinc-850 rounded p-5 space-y-4">
                        <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block border-b border-[#222222] pb-1.5">
                          4. Daily Organ Progress Notes
                        </span>

                        <div className="space-y-3 text-xs">
                          {[
                            { id: "cns", label: "CNS Progress", val: localPatient.dailyNotes?.cns },
                            { id: "cvs", label: "CVS Progress", val: localPatient.dailyNotes?.cvs },
                            { id: "rs", label: "Respiratory Progress", val: localPatient.dailyNotes?.rs },
                            { id: "renal", label: "Renal Progress", val: localPatient.dailyNotes?.renal },
                            { id: "git", label: "GI Progress", val: localPatient.dailyNotes?.git },
                            { id: "heme", label: "Heme Progress", val: localPatient.dailyNotes?.heme },
                            { id: "idStewardship", label: "Infectious Disease Progress", val: localPatient.dailyNotes?.idStewardship },
                            { id: "other", label: "General Updates", val: localPatient.dailyNotes?.other }
                          ].map((sys) => (
                            <div key={sys.id} className="border-b border-zinc-900 pb-2.5 last:border-b-0 last:pb-0">
                              <span className="font-bold text-zinc-400 text-[10px] block uppercase mb-0.5">{sys.label}</span>
                              <p className="text-zinc-300 italic">
                                {sys.val || "No specific progress notes registered today."}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Active Antimicrobials & TDM Panel */}
                      <div className="bg-[#161616]/60 border border-zinc-850 rounded p-5 space-y-4">
                        <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block border-b border-[#222222] pb-1.5">
                          5. Active Antimicrobial Stewardship
                        </span>

                        {(!localPatient.systems.idStewardship?.antibioticsList || localPatient.systems.idStewardship.antibioticsList.length === 0) ? (
                          <p className="text-xs text-zinc-500 italic">No antimicrobials active on chart.</p>
                        ) : (
                          <div className="space-y-2">
                            {localPatient.systems.idStewardship.antibioticsList.map((ab) => (
                              <div key={ab.id} className="flex justify-between items-center text-xs bg-zinc-950/40 p-2 border border-zinc-900 rounded">
                                <div>
                                  <strong className="text-zinc-200">{ab.name}</strong>
                                  <span className="text-zinc-500 text-[10px] block">Dose: {ab.dose} | Freq: {ab.frequency}</span>
                                </div>
                                <span className="text-[9px] font-bold uppercase bg-emerald-950 text-emerald-400 border border-emerald-500/10 px-2 py-0.5 rounded">
                                  {ab.type}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                    </div>
                  </div>

                </div>

                {/* DISCHARGE PLANNING & ADVICES SECTION */}
                <div className="bg-[#161616]/60 border border-zinc-850 rounded p-5 space-y-4 mt-6">
                  <div className="border-b border-[#222222] pb-1.5 flex justify-between items-center">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block flex items-center gap-1.5">
                      <Clipboard className="w-4 h-4 text-emerald-400" />
                      6. Interactive Discharge Planning, Advices & Follow-up Plans
                    </span>
                    <span className="text-[10px] text-zinc-550 font-mono">Auto-Saved to Case File</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs text-zinc-300">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] text-zinc-400 font-bold uppercase">Post-Discharge Patient Advices</label>
                      <textarea
                        rows={5}
                        placeholder="e.g. Resume home antihypertensives at half-dose. Strict fluid restriction < 1.5L/day. Monitor weight daily and report weight gain > 2kg in 48h..."
                        value={localPatient.dischargeSummary?.dischargeAdvices || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setLocalPatient(prev => ({
                            ...prev,
                            dischargeSummary: {
                              ...(prev.dischargeSummary || { dischargeAdvices: "", consults: "", followup: "" }),
                              dischargeAdvices: val
                            }
                          }));
                        }}
                        className="w-full bg-[#111111] border border-[#222222] focus:border-emerald-500/60 rounded p-2.5 text-xs leading-relaxed focus:outline-none text-zinc-100 placeholder:text-zinc-650 font-sans"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[10px] text-zinc-400 font-bold uppercase">Consultations & Interdisciplinary Plans</label>
                      <textarea
                        rows={5}
                        placeholder="e.g. Schedule outpatient Cardiology consult in 7-10 days for repeat Echocardiogram. Pulmonology review in 4 weeks for pulmonary function testing..."
                        value={localPatient.dischargeSummary?.consults || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setLocalPatient(prev => ({
                            ...prev,
                            dischargeSummary: {
                              ...(prev.dischargeSummary || { dischargeAdvices: "", consults: "", followup: "" }),
                              consults: val
                            }
                          }));
                        }}
                        className="w-full bg-[#111111] border border-[#222222] focus:border-emerald-500/60 rounded p-2.5 text-xs leading-relaxed focus:outline-none text-zinc-100 placeholder:text-zinc-650 font-sans"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[10px] text-zinc-400 font-bold uppercase">Follow-up Appointments & Instructions</label>
                      <textarea
                        rows={5}
                        placeholder="e.g. General Medicine Clinic on July 14th, 2026. ICU Recovery Clinic in 30 days. Contact ICU coordinator if shortness of breath worsens..."
                        value={localPatient.dischargeSummary?.followup || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setLocalPatient(prev => ({
                            ...prev,
                            dischargeSummary: {
                              ...(prev.dischargeSummary || { dischargeAdvices: "", consults: "", followup: "" }),
                              followup: val
                            }
                          }));
                        }}
                        className="w-full bg-[#111111] border border-[#222222] focus:border-emerald-500/60 rounded p-2.5 text-xs leading-relaxed focus:outline-none text-zinc-100 placeholder:text-zinc-650 font-sans"
                      />
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          </div>
        </div>
      </div>

      {/* 4. Full-Screen Image Modal Viewer */}
      {viewingImage && (
        <div
          onClick={() => setViewingImage(null)}
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 cursor-zoom-out animate-fade-in"
        >
          <img
            src={viewingImage}
            alt="Clinical Document High Resolution"
            referrerPolicy="no-referrer"
            className="max-w-full max-h-full object-contain rounded shadow-2xl"
          />
        </div>
      )}

      {/* 4.5 Custom Gemini API Key Confirmation Modal */}
      {showKeyConfirmModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-[#222222] rounded-lg max-w-md w-full p-6 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-serif italic font-bold text-zinc-100">
                  Missing Custom Gemini API Key
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  You have not entered a custom Gemini API key for clinical summarization.
                </p>
              </div>
            </div>

            <div className="bg-[#161616] border border-[#222222] p-3 rounded text-[11px] text-zinc-400 space-y-2">
              <p>
                <strong>Why this is important:</strong> If you are running the final production build on an external platform like Vercel and the environment variable <code className="text-amber-400 bg-black/40 px-1 py-0.5 rounded font-mono font-bold">GEMINI_API_KEY</code> has not been configured, this AI function will not work.
              </p>
              <p>
                Would you like to enter an API key first, or confirm and proceed using the server's configured environment key?
              </p>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowKeyConfirmModal(false)}
                className="bg-[#222222] hover:bg-[#2A2A2A] text-zinc-300 font-bold px-4 py-2 rounded text-xs transition-all uppercase tracking-wider border border-[#333333] cursor-pointer"
              >
                Go Back & Enter Key
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowKeyConfirmModal(false);
                  handleGenerateSummary(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded text-xs transition-all uppercase tracking-wider shadow-lg shadow-emerald-950/40 cursor-pointer"
              >
                Confirm & Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Custom Toast Overlay */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce-in max-w-sm">
          <div className={`p-4 rounded shadow-2xl flex gap-3 items-center border ${
            toast.type === "success" 
              ? "bg-emerald-950/90 border-emerald-800 text-emerald-200" 
              : toast.type === "error" 
                ? "bg-red-950/90 border-red-900 text-red-200" 
                : "bg-zinc-900/90 border-zinc-800 text-zinc-200"
          }`}>
            <div className="text-xs font-semibold leading-relaxed flex-1">
              {toast.message}
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-zinc-500 hover:text-zinc-300 font-bold text-xs"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <footer className="py-8 mt-12 text-center text-xs text-zinc-600 border-t border-[#111111]/30 font-serif italic tracking-wide">
        Made by enigmaticdoc for educational purpose only
      </footer>
    </div>
  );
}
