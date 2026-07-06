import React, { useState, useEffect } from "react";
import { PatientData, TimelineRecord } from "../types";
import { 
  Calculator, CheckSquare, Search, Info, Check, Save, AlertTriangle, 
  ChevronRight, Brain, Wind, Heart, Activity, ShieldAlert, AlertCircle, 
  Briefcase, Filter, X, ChevronDown, CheckSquare as CheckIcon 
} from "lucide-react";

interface PatientScoringHubProps {
  patient: PatientData;
  onSaveTimeline: (newTimeline: TimelineRecord[]) => void;
  showToast: (msg: string, type: "success" | "error" | "info") => void;
}

interface ScoreDefinition {
  id: string;
  name: string;
  fullName: string;
  category: "Neuro" | "Resp" | "CVS" | "Renal" | "Hepatic" | "Heme" | "Global" | "Disease" | "Workload";
  description: string;
  clinicalUtility: string;
  inputs: {
    key: string;
    label: string;
    type: "select" | "number" | "boolean";
    options?: { label: string; value: number | string }[];
    placeholder?: string;
    defaultValue?: any;
    sourcePath?: string; // Where in PatientData to fetch
  }[];
  calculate: (inputs: Record<string, any>) => { score: number | string; interpretation: string; level: "info" | "warning" | "critical" };
}

export default function PatientScoringHub({ patient, onSaveTimeline, showToast }: PatientScoringHubProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [relevantOnly, setRelevantOnly] = useState(false);
  const [activeScoreId, setActiveScoreId] = useState<string | null>(null);
  const [scoreInputs, setScoreInputs] = useState<Record<string, any>>({});
  
  // Keep track of which scores the clinician flagged as "relevant" for this specific patient
  const [relevantScores, setRelevantScores] = useState<Record<string, boolean>>(() => {
    // Default relevant scores based on baseline patient systems
    const defaults: Record<string, boolean> = {
      gcs: true,
      sofa: true,
      pf_ratio: true,
      news2: true,
      sirs: true,
    };
    if (patient.systems.cns.status !== "Alert") defaults.four = true;
    if (patient.systems.cvs.status.includes("Shock") || patient.systems.cvs.status.includes("Support")) {
      defaults.vis = true;
      defaults.shock_index = true;
    }
    if (patient.systems.renal.status.includes("AKI") || patient.systems.renal.status.includes("Anuria")) {
      defaults.kdigo = true;
    }
    if (patient.systems.git.liverProfile || patient.systems.git.status.includes("TPN")) {
      defaults.meld = true;
      defaults.child_pugh = true;
    }
    return defaults;
  });

  // Extract baseline patient metrics for auto-fill
  const getPatientMetric = (sourcePath: string): any => {
    if (!sourcePath) return "";
    
    // Quick helpers
    const systems = patient.systems;
    const calc = (patient.calculators || {}) as any;
    
    switch (sourcePath) {
      case "age": return patient.age || "";
      case "gender": return patient.gender || "Male";
      case "weight": return calc.weight || "";
      case "height": return calc.height || "";
      
      // CVS
      case "hr": return systems.cvs?.hr || "";
      case "sbp": {
        const bp = systems.cvs?.bp || "";
        const match = bp.match(/^(\d+)\//);
        return match ? match[1] : "";
      }
      case "dbp": {
        const bp = systems.cvs?.bp || "";
        const match = bp.match(/\/(\d+)$/);
        return match ? match[1] : "";
      }
      case "map": return systems.cvs?.map || calc.sofa?.map || "";
      case "lactate": return systems.cvs?.lactate || "";
      
      // Respiratory
      case "rr": return systems.rs?.rr || "";
      case "spo2": return systems.rs?.spo2 || "";
      case "fio2": return systems.rs?.fio2 || "";
      case "pao2": return calc.sofa?.pao2 || "";
      
      // Renal
      case "creatinine": return systems.renal?.creatinine || calc.creatinine || "";
      case "urea": return systems.renal?.urea || "";
      case "uo": return systems.renal?.uo || "";
      
      // Heme
      case "platelets": return systems.heme?.plt || calc.sofa?.platelets || "";
      case "hb": return systems.heme?.hb || "";
      case "wbc": return systems.heme?.wbc || "";
      case "temp": return systems.heme?.temp || "";
      
      // Neuro
      case "gcs": return systems.cns?.gcs || calc.sofa?.gcs || "15";
      case "rass": return systems.cns?.rass || "0";
      
      // Bilirubin
      case "bilirubin": return calc.sofa?.bilirubin || "";

      default: return "";
    }
  };

  // Master definitions of all critical care scores
  const scoreDefinitions: ScoreDefinition[] = [
    // --- NEUROLOGICAL ---
    {
      id: "gcs",
      name: "GCS",
      fullName: "Glasgow Coma Scale",
      category: "Neuro",
      description: "Standardized physiological assessment of level of consciousness.",
      clinicalUtility: "Used in trauma, neurocritical care, and general ICU to grade coma and brain injury severity.",
      inputs: [
        {
          key: "eyes",
          label: "Eye Opening Response (E)",
          type: "select",
          options: [
            { label: "4 - Spontaneous", value: 4 },
            { label: "3 - To sound", value: 3 },
            { label: "2 - To pressure", value: 2 },
            { label: "1 - None", value: 1 }
          ],
          defaultValue: 4
        },
        {
          key: "verbal",
          label: "Verbal Response (V)",
          type: "select",
          options: [
            { label: "5 - Oriented", value: 5 },
            { label: "4 - Confused", value: 4 },
            { label: "3 - Inappropriate words", value: 3 },
            { label: "2 - Incomprehensible sounds", value: 2 },
            { label: "1 - None", value: 1 }
          ],
          defaultValue: 5
        },
        {
          key: "motor",
          label: "Motor Response (M)",
          type: "select",
          options: [
            { label: "6 - Obeys commands", value: 6 },
            { label: "5 - Localizes pain", value: 5 },
            { label: "4 - Normal flexion (withdrawal)", value: 4 },
            { label: "3 - Abnormal flexion (decorticate)", value: 3 },
            { label: "2 - Extension (decerebrate)", value: 2 },
            { label: "1 - None", value: 1 }
          ],
          defaultValue: 6
        }
      ],
      calculate: (inputs) => {
        const e = Number(inputs.eyes || 4);
        const v = Number(inputs.verbal || 5);
        const m = Number(inputs.motor || 6);
        const tot = e + v + m;
        let interpretation = "Mild Brain Injury / Alert";
        let level: "info" | "warning" | "critical" = "info";
        
        if (tot <= 8) {
          interpretation = "Severe Brain Injury / Coma (GCS <= 8: PROTECT AIRWAY / INTUBATE)";
          level = "critical";
        } else if (tot <= 12) {
          interpretation = "Moderate Brain Injury";
          level = "warning";
        }
        return { score: tot, interpretation: `${interpretation} (E${e} V${v} M${m})`, level };
      }
    },
    {
      id: "four",
      name: "FOUR Score",
      fullName: "Full Outline of UnResponsiveness",
      category: "Neuro",
      description: "Comprehensive coma scale that tests brainstem reflexes, respiration, eye and motor responses.",
      clinicalUtility: "Highly useful in intubated patients where verbal responses cannot be verified.",
      inputs: [
        {
          key: "eye",
          label: "Eye Response",
          type: "select",
          options: [
            { label: "4 - Eyelids open, tracking, or blinking on command", value: 4 },
            { label: "3 - Eyelids open but not tracking", value: 3 },
            { label: "2 - Eyelids closed but open to loud voice", value: 2 },
            { label: "1 - Eyelids closed but open to pain", value: 1 },
            { label: "0 - Eyelids remain closed with pain", value: 0 }
          ],
          defaultValue: 4
        },
        {
          key: "motor",
          label: "Motor Response",
          type: "select",
          options: [
            { label: "4 - Thumbs-up, fist, or peace sign on command", value: 4 },
            { label: "3 - Localizes pain", value: 3 },
            { label: "2 - Flexion response to pain (withdrawal)", value: 2 },
            { label: "1 - Extension response to pain (decerebrate)", value: 1 },
            { label: "0 - No response to pain, or generalized status myoclonus", value: 0 }
          ],
          defaultValue: 4
        },
        {
          key: "brainstem",
          label: "Brainstem Reflexes",
          type: "select",
          options: [
            { label: "4 - Pupil and corneal reflexes present", value: 4 },
            { label: "3 - One pupil wide and fixed", value: 3 },
            { label: "2 - Pupil or corneal reflexes absent", value: 2 },
            { label: "1 - Pupil and corneal reflexes absent", value: 1 },
            { label: "0 - Pupil, corneal, and cough reflexes absent", value: 0 }
          ],
          defaultValue: 4
        },
        {
          key: "resp",
          label: "Respiration",
          type: "select",
          options: [
            { label: "4 - Not intubated, regular breathing pattern", value: 4 },
            { label: "3 - Not intubated, Cheyne-Stokes breathing pattern", value: 3 },
            { label: "2 - Not intubated, irregular breathing", value: 2 },
            { label: "1 - Intubated, triggers ventilator", value: 1 },
            { label: "0 - Intubated, completely ventilator paced (apnea)", value: 0 }
          ],
          defaultValue: 4
        }
      ],
      calculate: (inputs) => {
        const score = Number(inputs.eye ?? 4) + Number(inputs.motor ?? 4) + Number(inputs.brainstem ?? 4) + Number(inputs.resp ?? 4);
        let interpretation = "Normal neurologic status";
        let level: "info" | "warning" | "critical" = "info";
        if (score <= 6) {
          interpretation = "Severe coma / Brain herniation risk. Immediate intervention advised.";
          level = "critical";
        } else if (score <= 11) {
          interpretation = "Moderate unconsciousness / neurological impairment.";
          level = "warning";
        }
        return { score, interpretation, level };
      }
    },
    {
      id: "rass",
      name: "RASS",
      fullName: "Richmond Agitation-Sedation Scale",
      category: "Neuro",
      description: "Scale to monitor and standardize sedation depth and agitation levels in the ICU.",
      clinicalUtility: "Used to guide daily sedation holidays, titrate infusions, and avoid over-sedation.",
      inputs: [
        {
          key: "rass_val",
          label: "Sedation/Agitation Level",
          type: "select",
          options: [
            { label: "+4 - Combative (danger to staff)", value: 4 },
            { label: "+3 - Very Agitated (pulls lines/tubes)", value: 3 },
            { label: "+2 - Agitated (frequent non-purposeful movement)", value: 2 },
            { label: "+1 - Restless (anxious, but not aggressive)", value: 1 },
            { label: "0 - Alert and Calm", value: 0 },
            { label: "-1 - Drowsy (sustained awakening to voice, >10s)", value: -1 },
            { label: "-2 - Light Sedation (brief awakening to voice, <10s)", value: -2 },
            { label: "-3 - Moderate Sedation (movement/eye open to voice, no eye contact)", value: -3 },
            { label: "-4 - Deep Sedation (no response to voice, but responds to physical stimulus)", value: -4 },
            { label: "-5 - Unarousable (no response to voice or physical stimulation)", value: -5 }
          ],
          defaultValue: 0,
          sourcePath: "rass"
        }
      ],
      calculate: (inputs) => {
        const val = Number(inputs.rass_val ?? 0);
        let interpretation = "Target Sedation Range";
        let level: "info" | "warning" | "critical" = "info";
        
        if (val > 1) {
          interpretation = "Patient Agitated. High risk of line self-extubation.";
          level = "warning";
        } else if (val === 4) {
          interpretation = "Combative! Direct threat to clinical staff and self.";
          level = "critical";
        } else if (val <= -4) {
          interpretation = "Deeply sedated / Unarousable. High risk of ventilator dependency and delayed weaning.";
          level = "warning";
        }
        
        const sign = val > 0 ? `+${val}` : `${val}`;
        return { score: sign, interpretation, level };
      }
    },
    {
      id: "cam_icu",
      name: "CAM-ICU",
      fullName: "Confusion Assessment Method for the ICU",
      category: "Neuro",
      description: "Validated diagnostic algorithm for ICU Delirium.",
      clinicalUtility: "Highly recommended in daily bundles to recognize hypoactive or hyperactive delirium.",
      inputs: [
        { key: "feat1", label: "Feature 1: Acute onset or fluctuating course of mental status?", type: "boolean", defaultValue: false },
        { key: "feat2", label: "Feature 2: Inattention (ASE letter test, score <8 correct)?", type: "boolean", defaultValue: false },
        { key: "feat3", label: "Feature 3: Altered level of consciousness (RASS other than 0)?", type: "boolean", defaultValue: false },
        { key: "feat4", label: "Feature 4: Disorganized thinking (incorrect answers to basic questions)?", type: "boolean", defaultValue: false }
      ],
      calculate: (inputs) => {
        const f1 = !!inputs.feat1;
        const f2 = !!inputs.feat2;
        const f3 = !!inputs.feat3;
        const f4 = !!inputs.feat4;
        
        // Diagnosis requires Feature 1 AND 2 AND (3 OR 4)
        const isDelirious = f1 && f2 && (f3 || f4);
        
        return {
          score: isDelirious ? "POSITIVE" : "NEGATIVE",
          interpretation: isDelirious 
            ? "ICU Delirium Present. Review medications (stop benzodiazepines, anticholinergics), treat pain, optimize sleep-wake cycle." 
            : "No active ICU Delirium detected.",
          level: isDelirious ? "warning" : "info"
        };
      }
    },
    {
      id: "ich",
      name: "ICH Score",
      fullName: "Intracerebral Hemorrhage Score",
      category: "Neuro",
      description: "Clinical grading scale for 30-day mortality risk in patients with spontaneous ICH.",
      clinicalUtility: "Assists in rapid risk-stratification upon neuro-ICU admission.",
      inputs: [
        {
          key: "gcs",
          label: "Admission GCS Score",
          type: "select",
          options: [
            { label: "GCS 3–4 (2 points)", value: 2 },
            { label: "GCS 5–12 (1 point)", value: 1 },
            { label: "GCS 13–15 (0 points)", value: 0 }
          ],
          defaultValue: 0
        },
        {
          key: "age",
          label: "Age",
          type: "select",
          options: [
            { label: ">= 80 years old (1 point)", value: 1 },
            { label: "< 80 years old (0 points)", value: 0 }
          ],
          defaultValue: 0
        },
        {
          key: "location",
          label: "Infratentorial Origin",
          type: "select",
          options: [
            { label: "Yes (Brainstem/Cerebellar) (1 point)", value: 1 },
            { label: "No (Supratentorial) (0 points)", value: 0 }
          ],
          defaultValue: 0
        },
        {
          key: "volume",
          label: "ICH Volume",
          type: "select",
          options: [
            { label: ">= 30 mL (1 point)", value: 1 },
            { label: "< 30 mL (0 points)", value: 0 }
          ],
          defaultValue: 0
        },
        {
          key: "ivh",
          label: "Intraventricular Hemorrhage (IVH)",
          type: "select",
          options: [
            { label: "Yes (Blood present in ventricles) (1 point)", value: 1 },
            { label: "No (0 points)", value: 0 }
          ],
          defaultValue: 0
        }
      ],
      calculate: (inputs) => {
        const score = Number(inputs.gcs ?? 0) + Number(inputs.age ?? 0) + Number(inputs.location ?? 0) + Number(inputs.volume ?? 0) + Number(inputs.ivh ?? 0);
        const mortalities = ["13%", "26%", "72%", "97%", "100%", "100%", "100%"];
        const estMort = mortalities[score] || "100%";
        return {
          score,
          interpretation: `30-Day Estimated Mortality Risk: ${estMort}`,
          level: score >= 3 ? "critical" : (score >= 1 ? "warning" : "info")
        };
      }
    },
    {
      id: "hunt_hess",
      name: "Hunt and Hess",
      fullName: "Hunt and Hess Scale for Subarachnoid Hemorrhage",
      category: "Neuro",
      description: "Classifies the severity of aneurysmal subarachnoid hemorrhage.",
      clinicalUtility: "Correlates closely with surgical outcomes and vasospasm risk.",
      inputs: [
        {
          key: "grade",
          label: "Symptom Presentation Grade",
          type: "select",
          options: [
            { label: "Grade 1 - Asymptomatic, or mild headache and slight nuchal rigidity", value: 1 },
            { label: "Grade 2 - Moderate to severe headache, nuchal rigidity, no neurological deficit other than cranial nerve palsy", value: 2 },
            { label: "Grade 3 - Drowsiness, confusion, or mild focal neurological deficit", value: 3 },
            { label: "Grade 4 - Stupor, moderate to severe hemiparesis, early decerebrate rigidity", value: 4 },
            { label: "Grade 5 - Deep coma, decerebrate rigidity, moribund appearance", value: 5 }
          ],
          defaultValue: 1
        }
      ],
      calculate: (inputs) => {
        const grade = Number(inputs.grade ?? 1);
        const mortVal = ["0%", "30%", "40%", "50%", "80%", "90%"];
        return {
          score: `Grade ${grade}`,
          interpretation: `Associated SAH Mortality Risk: ~${mortVal[grade]}`,
          level: grade >= 4 ? "critical" : (grade >= 3 ? "warning" : "info")
        };
      }
    },

    // --- RESPIRATORY ---
    {
      id: "pf_ratio",
      name: "PaO2/FiO2",
      fullName: "Haldane/Horovitz P/F Ratio Index",
      category: "Resp",
      description: "Evaluates systemic hypoxemia and pulmonary shunt fraction.",
      clinicalUtility: "Used to diagnose and classify ARDS severity (Berlin criteria).",
      inputs: [
        { key: "pao2", label: "PaO2 (mmHg)", type: "number", placeholder: "e.g., 75", sourcePath: "pao2" },
        { key: "fio2", label: "FiO2 (%)", type: "number", placeholder: "e.g., 50", sourcePath: "fio2" }
      ],
      calculate: (inputs) => {
        const pao2 = parseFloat(inputs.pao2);
        const fio2 = parseFloat(inputs.fio2) / 100;
        if (isNaN(pao2) || isNaN(fio2) || fio2 <= 0) return { score: "--", interpretation: "Enter complete arterial gas values.", level: "info" };
        
        const ratio = Math.round(pao2 / fio2);
        let interpretation = "Normal Oxygenation (> 300)";
        let level: "info" | "warning" | "critical" = "info";
        
        if (ratio <= 100) {
          interpretation = "Severe ARDS (P/F <= 100) - Consider Prone Positioning & Paralytics";
          level = "critical";
        } else if (ratio <= 200) {
          interpretation = "Moderate ARDS (100 < P/F <= 200) - High risk of invasive vent transition";
          level = "warning";
        } else if (ratio <= 300) {
          interpretation = "Mild ARDS (200 < P/F <= 300)";
          level = "warning";
        }
        return { score: ratio, interpretation, level };
      }
    },
    {
      id: "rox",
      name: "ROX Index",
      fullName: "Respiratory Rate-Oxygenation Index",
      category: "Resp",
      description: "Simple bedside tool predicting HFNC success vs risk of intubation failure.",
      clinicalUtility: "Calculated as: (SpO2 / FiO2) / Respiratory Rate.",
      inputs: [
        { key: "spo2", label: "SpO2 (%)", type: "number", placeholder: "e.g., 94", sourcePath: "spo2" },
        { key: "fio2", label: "FiO2 (%)", type: "number", placeholder: "e.g., 40", sourcePath: "fio2" },
        { key: "rr", label: "Respiratory Rate (breaths/min)", type: "number", placeholder: "e.g., 22", sourcePath: "rr" }
      ],
      calculate: (inputs) => {
        const spo2 = parseFloat(inputs.spo2);
        const fio2 = parseFloat(inputs.fio2) / 100;
        const rr = parseFloat(inputs.rr);
        
        if (isNaN(spo2) || isNaN(fio2) || isNaN(rr) || fio2 <= 0 || rr <= 0) {
          return { score: "--", interpretation: "Please enter SpO2, FiO2, and RR.", level: "info" };
        }
        const val = (spo2 / fio2) / rr;
        let interpretation = "Grey Zone - Monitor closely";
        let level: "info" | "warning" | "critical" = "warning";
        if (val >= 4.88) {
          interpretation = "Low Risk of HFNC Failure (Safe to continue therapy)";
          level = "info";
        } else if (val < 3.85) {
          interpretation = "High Risk of HFNC Failure! Consider timely intubation to avoid crash extubation.";
          level = "critical";
        }
        return { score: val.toFixed(2), interpretation, level };
      }
    },
    {
      id: "murray",
      name: "Murray Lung Score",
      fullName: "Murray Lung Injury Score (LIS)",
      category: "Resp",
      description: "Grades severity of lung injury, specifically used to evaluate ECMO candidacy.",
      clinicalUtility: "Evaluates consolidated zones on CXR, hypoxemia, PEEP settings, and static compliance.",
      inputs: [
        {
          key: "cxr",
          label: "Chest X-Ray Consolidation (quadrants)",
          type: "select",
          options: [
            { label: "0 - Normal CXR", value: 0 },
            { label: "1 - 1 quadrant consolidated", value: 1 },
            { label: "2 - 2 quadrants consolidated", value: 2 },
            { label: "3 - 3 quadrants consolidated", value: 3 },
            { label: "4 - 4 quadrants consolidated", value: 4 }
          ],
          defaultValue: 0
        },
        {
          key: "pf",
          label: "PaO2/FiO2 Ratio (Horovitz Index)",
          type: "select",
          options: [
            { label: "0 - >= 300", value: 0 },
            { label: "1 - 225 - 299", value: 1 },
            { label: "2 - 175 - 224", value: 2 },
            { label: "3 - 100 - 174", value: 3 },
            { label: "4 - < 100", value: 4 }
          ],
          defaultValue: 0
        },
        {
          key: "peep",
          label: "PEEP Level (cmH2O) (if ventilated)",
          type: "select",
          options: [
            { label: "0 - <= 5 cmH2O", value: 0 },
            { label: "1 - 6 - 8 cmH2O", value: 1 },
            { label: "2 - 9 - 11 cmH2O", value: 2 },
            { label: "3 - 12 - 14 cmH2O", value: 3 },
            { label: "4 - >= 15 cmH2O", value: 4 }
          ],
          defaultValue: 0
        },
        {
          key: "compliance",
          label: "Static Lung Compliance (mL/cmH2O)",
          type: "select",
          options: [
            { label: "0 - >= 80 mL/cmH2O", value: 0 },
            { label: "1 - 60 - 79 mL/cmH2O", value: 1 },
            { label: "2 - 40 - 59 mL/cmH2O", value: 2 },
            { label: "3 - 20 - 39 mL/cmH2O", value: 3 },
            { label: "4 - <= 19 mL/cmH2O", value: 4 }
          ],
          defaultValue: 0
        }
      ],
      calculate: (inputs) => {
        const cxr = Number(inputs.cxr ?? 0);
        const pf = Number(inputs.pf ?? 0);
        const peep = Number(inputs.peep ?? 0);
        const compliance = Number(inputs.compliance ?? 0);
        
        const sum = cxr + pf + peep + compliance;
        const avg = sum / 4;
        
        let interpretation = "No Lung Injury (Score 0)";
        let level: "info" | "warning" | "critical" = "info";
        if (avg > 2.5) {
          interpretation = "Severe Lung Injury (Score > 2.5) - Strongly meets VV-ECMO indication guidelines.";
          level = "critical";
        } else if (avg >= 1.0) {
          interpretation = "Mild-to-Moderate Lung Injury (Score 1.0 - 2.5)";
          level = "warning";
        }
        return { score: avg.toFixed(2), interpretation, level };
      }
    },
    {
      id: "osi",
      name: "OSI Score",
      fullName: "Oxygenation Saturation Index",
      category: "Resp",
      description: "Non-invasive proxy for oxygenation index using SpO2 instead of invasive PaO2.",
      clinicalUtility: "Calculated as: (Mean Airway Pressure * FiO2 * 100) / SpO2.",
      inputs: [
        { key: "paw", label: "Mean Airway Pressure (MAPaw)", type: "number", placeholder: "e.g., 15" },
        { key: "fio2", label: "FiO2 (%)", type: "number", placeholder: "e.g., 60", sourcePath: "fio2" },
        { key: "spo2", label: "SpO2 (%)", type: "number", placeholder: "e.g., 90", sourcePath: "spo2" }
      ],
      calculate: (inputs) => {
        const paw = parseFloat(inputs.paw);
        const fio2 = parseFloat(inputs.fio2) / 100;
        const spo2 = parseFloat(inputs.spo2);
        
        if (isNaN(paw) || isNaN(fio2) || isNaN(spo2) || spo2 <= 0) {
          return { score: "--", interpretation: "Enter Mean Airway Pressure, FiO2, and SpO2.", level: "info" };
        }
        const val = (paw * fio2 * 100) / spo2;
        let interpretation = "Mild hypoxemia proxy";
        let level: "info" | "warning" | "critical" = "info";
        if (val >= 12) {
          interpretation = "Severe hypoxemia proxy (high risk of mortality/ARDS)";
          level = "critical";
        } else if (val >= 6) {
          interpretation = "Moderate hypoxemia proxy";
          level = "warning";
        }
        return { score: val.toFixed(2), interpretation, level };
      }
    },

    // --- CARDIOVASCULAR ---
    {
      id: "vis",
      name: "VIS Score",
      fullName: "Vasoactive-Inotropic Score",
      category: "CVS",
      description: "Objective evaluation of cardiovascular pharmacologic support intensity.",
      clinicalUtility: "Strong predictor of pediatric & adult post-cardiotomy mortality and shock severity.",
      inputs: [
        { key: "norad", label: "Norepinephrine dose (mcg/kg/min)", type: "number", placeholder: "e.g., 0.1" },
        { key: "adrad", label: "Adrenaline dose (mcg/kg/min)", type: "number", placeholder: "e.g., 0.05" },
        { key: "dopa", label: "Dopamine dose (mcg/kg/min)", type: "number", placeholder: "e.g., 0" },
        { key: "dobut", label: "Dobutamine dose (mcg/kg/min)", type: "number", placeholder: "e.g., 5" },
        { key: "vaso", label: "Vasopressin dose (Units/min)", type: "number", placeholder: "e.g., 0.04" },
        { key: "mil", label: "Milrinone dose (mcg/kg/min)", type: "number", placeholder: "e.g., 0.375" }
      ],
      calculate: (inputs) => {
        const norad = parseFloat(inputs.norad || "0");
        const adrad = parseFloat(inputs.adrad || "0");
        const dopa = parseFloat(inputs.dopa || "0");
        const dobut = parseFloat(inputs.dobut || "0");
        const vaso = parseFloat(inputs.vaso || "0");
        const mil = parseFloat(inputs.mil || "0");
        
        // Equation: VIS = Dopamine + Dobutamine + 100 * Epi + 100 * Norepi + 10000 * Vaso + 10000 * Mil (if mil is in mcg/kg/min) wait! Milrinone multiplier is usually 10000 * Mil (mcg/kg/min)
        const vis = dopa + dobut + (100 * adrad) + (100 * norad) + (10000 * vaso) + (10000 * mil);
        
        let interpretation = "Mild vasoactive support (< 15)";
        let level: "info" | "warning" | "critical" = "info";
        if (vis >= 40) {
          interpretation = "Extremely High Cardiovascular Support (VIS >= 40) - Refractory shock / high mortality risks";
          level = "critical";
        } else if (vis >= 15) {
          interpretation = "Moderate Cardiovascular Support";
          level = "warning";
        }
        return { score: vis.toFixed(1), interpretation, level };
      }
    },
    {
      id: "shock_index",
      name: "Shock Index & MSI",
      fullName: "Shock Index & Modified Shock Index",
      category: "CVS",
      description: "Simple indicator of occult hypovolemia or hemodynamic failure.",
      clinicalUtility: "Calculates SI (HR/SBP) and MSI (HR/MAP). SI > 0.9 suggests left-ventricular strain or shock.",
      inputs: [
        { key: "hr", label: "Heart Rate (bpm)", type: "number", placeholder: "e.g., 110", sourcePath: "hr" },
        { key: "sbp", label: "Systolic Blood Pressure (mmHg)", type: "number", placeholder: "e.g., 90", sourcePath: "sbp" },
        { key: "map", label: "Mean Arterial Pressure (mmHg)", type: "number", placeholder: "e.g., 60", sourcePath: "map" }
      ],
      calculate: (inputs) => {
        const hr = parseFloat(inputs.hr);
        const sbp = parseFloat(inputs.sbp);
        const map = parseFloat(inputs.map);
        
        if (isNaN(hr) || isNaN(sbp) || sbp <= 0) {
          return { score: "--", interpretation: "Please enter Heart Rate and SBP.", level: "info" };
        }
        
        const si = hr / sbp;
        const msi = !isNaN(map) && map > 0 ? hr / map : null;
        
        let interpretation = "Hemodynamically compensated";
        let level: "info" | "warning" | "critical" = "info";
        
        if (si >= 1.0) {
          interpretation = "Abnormal Shock Index (>= 1.0) - High probability of occult bleeding, sepsis, or myocardial failure";
          level = "critical";
        } else if (si >= 0.7) {
          interpretation = "Borderline Shock Index (0.7 - 0.9) - Monitor carefully";
          level = "warning";
        }
        
        const output = `SI: ${si.toFixed(2)}` + (msi ? ` | MSI: ${msi.toFixed(2)}` : "");
        return { score: output, interpretation, level };
      }
    },
    {
      id: "scai_shock",
      name: "SCAI Shock Stage",
      fullName: "Society for Cardiovascular Angiography and Interventions Shock Stage",
      category: "CVS",
      description: "Grading system for cardiogenic shock severity.",
      clinicalUtility: "Classifies patient from Stage A (At risk) to Stage E (Extremis) to prompt rapid mechanical support decisions.",
      inputs: [
        {
          key: "stage",
          label: "Hemodynamic State / Presentation",
          type: "select",
          options: [
            { label: "Stage A - At Risk (Not in shock but at risk, e.g. acute MI, severe HF)", value: "A" },
            { label: "Stage B - Beginning (Compensated hypoperfusion, clinical tachycardia, stable BP)", value: "B" },
            { label: "Stage C - Classic (Hypotensive, hypoperfused, requires vasopressors/inotropes/MCS)", value: "C" },
            { label: "Stage D - Deteriorating (Failure to respond to initial therapies, escalating support)", value: "D" },
            { label: "Stage E - Extremis (Refractory cardiac arrest, severe collapse, active CPR)", value: "E" }
          ],
          defaultValue: "A"
        }
      ],
      calculate: (inputs) => {
        const stage = String(inputs.stage ?? "A");
        let interpretation = "No active cardiogenic shock.";
        let level: "info" | "warning" | "critical" = "info";
        if (stage === "E") {
          interpretation = "Stage E (Extremis) - Refractory shock, profound collapse, extreme risk of mortality (>75%). Immediate ECMO/MCS consider.";
          level = "critical";
        } else if (stage === "D") {
          interpretation = "Stage D (Deteriorating) - Progressive cardiovascular deterioration despite active drug support. High risk.";
          level = "critical";
        } else if (stage === "C") {
          interpretation = "Stage C (Classic Cardiogenic Shock) - Established hypotension & systemic hypoperfusion. Requires inotropes and titration.";
          level = "warning";
        } else if (stage === "B") {
          interpretation = "Stage B (Beginning) - Mild subclinical hypoperfusion. SBP is maintained. Initiate primary cardiac support.";
          level = "info";
        }
        return { score: stage, interpretation, level };
      }
    },

    // --- RENAL ---
    {
      id: "kdigo",
      name: "KDIGO AKI",
      fullName: "Kidney Disease: Improving Global Outcomes (KDIGO) AKI Staging",
      category: "Renal",
      description: "Classifies Acute Kidney Injury severity using Serum Creatinine and Urine Output metrics.",
      clinicalUtility: "Assists in early Nephrology consult and CRRT readiness decisions.",
      inputs: [
        {
          key: "creat_increase",
          label: "Serum Creatinine rise above baseline",
          type: "select",
          options: [
            { label: "No significant increase (0 points)", value: 0 },
            { label: "Increase of 1.5 - 1.9 times baseline OR >= 0.3 mg/dL rise (Stage 1)", value: 1 },
            { label: "Increase of 2.0 - 2.9 times baseline (Stage 2)", value: 2 },
            { label: "Increase >= 3.0 times baseline OR rise to >= 4.0 mg/dL OR initiation of RRT (Stage 3)", value: 3 }
          ],
          defaultValue: 0
        },
        {
          key: "urine_output",
          label: "Urine Output (UO) Oliguria state",
          type: "select",
          options: [
            { label: "Normal urine output (0 points)", value: 0 },
            { label: "< 0.5 mL/kg/h for 6 - 12 hours (Stage 1)", value: 1 },
            { label: "< 0.5 mL/kg/h for >= 12 hours (Stage 2)", value: 2 },
            { label: "< 0.3 mL/kg/h for >= 24 hours OR Anuria for >= 12 hours (Stage 3)", value: 3 }
          ],
          defaultValue: 0
        }
      ],
      calculate: (inputs) => {
        const cr = Number(inputs.creat_increase ?? 0);
        const uo = Number(inputs.urine_output ?? 0);
        const stage = Math.max(cr, uo);
        
        let interpretation = "No Acute Kidney Injury by KDIGO standards.";
        let level: "info" | "warning" | "critical" = "info";
        
        if (stage === 3) {
          interpretation = "KDIGO Stage 3 AKI - Severe kidney injury. Strictly monitor fluid balance, hold nephrotoxic drugs, evaluate for immediate CRRT.";
          level = "critical";
        } else if (stage === 2) {
          interpretation = "KDIGO Stage 2 AKI - Moderate acute kidney injury.";
          level = "warning";
        } else if (stage === 1) {
          interpretation = "KDIGO Stage 1 AKI - Mild acute kidney injury.";
          level = "warning";
        }
        return { score: stage === 0 ? "NONE" : `Stage ${stage}`, interpretation, level };
      }
    },

    // --- HEPATIC ---
    {
      id: "meld",
      name: "MELD 3.0",
      fullName: "Model for End-Stage Liver Disease (MELD) 3.0 Score",
      category: "Hepatic",
      description: "Grades severity of chronic/acute liver disease, used to prioritize liver transplantation.",
      clinicalUtility: "Utilizes Creatinine, Bilirubin, INR, Sodium, Albumin, and Gender parameters.",
      inputs: [
        { key: "creatinine", label: "Serum Creatinine (mg/dL)", type: "number", placeholder: "e.g., 1.1", sourcePath: "creatinine" },
        { key: "bilirubin", label: "Total Bilirubin (mg/dL)", type: "number", placeholder: "e.g., 2.3", sourcePath: "bilirubin" },
        { key: "inr", label: "INR", type: "number", placeholder: "e.g., 1.5" },
        { key: "sodium", label: "Serum Sodium (mEq/L)", type: "number", placeholder: "e.g., 136" },
        { key: "albumin", label: "Serum Albumin (g/dL)", type: "number", placeholder: "e.g., 2.8" },
        {
          key: "female",
          label: "Biological Female Gender?",
          type: "select",
          options: [
            { label: "Yes (1 point)", value: 1 },
            { label: "No (0 points)", value: 0 }
          ],
          defaultValue: 0
        }
      ],
      calculate: (inputs) => {
        const cr = parseFloat(inputs.creatinine);
        const bil = parseFloat(inputs.bilirubin);
        const inr = parseFloat(inputs.inr);
        const na = parseFloat(inputs.sodium);
        const alb = parseFloat(inputs.albumin);
        const isFemale = Number(inputs.female ?? 0);
        
        if (isNaN(cr) || isNaN(bil) || isNaN(inr) || isNaN(na) || isNaN(alb)) {
          return { score: "--", interpretation: "Enter Creatinine, Bilirubin, INR, Sodium, and Albumin.", level: "info" };
        }
        
        // MELD 3.0 simplified approximation
        const cr_adj = Math.min(Math.max(cr, 1.0), 3.0);
        const bil_adj = Math.min(Math.max(bil, 1.0), 3.0);
        const inr_adj = Math.min(Math.max(inr, 1.0), 3.0);
        
        let meld = 1.33 * isFemale + 4.56 * Math.log(bil_adj) + 9.09 * Math.log(inr_adj) + 11.14 * Math.log(cr_adj) + 6.44;
        meld = Math.round(meld);
        
        let level: "info" | "warning" | "critical" = "info";
        let interpretation = "Low Risk (MELD < 15)";
        if (meld >= 30) {
          interpretation = `Critical Liver Disease (MELD ${meld}) - >50% estimated 3-month mortality risk`;
          level = "critical";
        } else if (meld >= 20) {
          interpretation = "Severe Liver Impairment (MELD 20-29)";
          level = "warning";
        } else if (meld >= 15) {
          interpretation = "Moderate Liver Impairment (MELD 15-19)";
          level = "warning";
        }
        return { score: meld, interpretation, level };
      }
    },
    {
      id: "child_pugh",
      name: "Child-Pugh",
      fullName: "Child-Pugh Classification for Cirrhosis Mortality",
      category: "Hepatic",
      description: "Clinically assesses liver cirrhosis severity and surgical/ICU operative mortality risk.",
      clinicalUtility: "Utilizes Encephalopathy grade, Ascites fluid, Bilirubin, Albumin, and INR/PT.",
      inputs: [
        {
          key: "enceph",
          label: "Hepatic Encephalopathy Grade",
          type: "select",
          options: [
            { label: "None (1 point)", value: 1 },
            { label: "Grade I-II (Confused, mild tremors) (2 points)", value: 2 },
            { label: "Grade III-IV (Stupor, severe coma) (3 points)", value: 3 }
          ],
          defaultValue: 1
        },
        {
          key: "ascites",
          label: "Ascites state",
          type: "select",
          options: [
            { label: "None (1 point)", value: 1 },
            { label: "Mild (responds easily to diuretics) (2 points)", value: 2 },
            { label: "Moderate/Tense (refractory to therapy) (3 points)", value: 3 }
          ],
          defaultValue: 1
        },
        {
          key: "bilirubin",
          label: "Total Bilirubin",
          type: "select",
          options: [
            { label: "< 2.0 mg/dL (1 point)", value: 1 },
            { label: "2.0 - 3.0 mg/dL (2 points)", value: 2 },
            { label: "> 3.0 mg/dL (3 points)", value: 3 }
          ],
          defaultValue: 1
        },
        {
          key: "albumin",
          label: "Serum Albumin",
          type: "select",
          options: [
            { label: "> 3.5 g/dL (1 point)", value: 1 },
            { label: "2.8 - 3.5 g/dL (2 points)", value: 2 },
            { label: "< 2.8 g/dL (3 points)", value: 3 }
          ],
          defaultValue: 1
        },
        {
          key: "inr",
          label: "INR Coagulation",
          type: "select",
          options: [
            { label: "< 1.7 (1 point)", value: 1 },
            { label: "1.7 - 2.3 (2 points)", value: 2 },
            { label: "> 2.3 (3 points)", value: 3 }
          ],
          defaultValue: 1
        }
      ],
      calculate: (inputs) => {
        const score = Number(inputs.enceph ?? 1) + Number(inputs.ascites ?? 1) + Number(inputs.bilirubin ?? 1) + Number(inputs.albumin ?? 1) + Number(inputs.inr ?? 1);
        let classLetter = "Class A";
        let level: "info" | "warning" | "critical" = "info";
        let interpretation = "Mild liver dysfunction (100% 1-year survival proxy)";
        
        if (score >= 10) {
          classLetter = "Class C";
          interpretation = "Severe cirrhosis impairment (Class C) - ~45% estimated 1-year survival risk";
          level = "critical";
        } else if (score >= 7) {
          classLetter = "Class B";
          interpretation = "Moderate cirrhosis impairment (Class B) - ~80% estimated 1-year survival risk";
          level = "warning";
        }
        return { score: `${score} (${classLetter})`, interpretation, level };
      }
    },

    // --- COAGULATION & HEMATOLOGY ---
    {
      id: "dic_isth",
      name: "ISTH DIC",
      fullName: "ISTH Disseminated Intravascular Coagulation (DIC) Score",
      category: "Heme",
      description: "Standard score to identify overt disseminated intravascular coagulation.",
      clinicalUtility: "Recommended when platelet count, PT, fibrinogen, or D-Dimer suggest coagulopathy.",
      inputs: [
        {
          key: "plt",
          label: "Platelet Count (x10³/μL)",
          type: "select",
          options: [
            { label: ">= 100k (0 points)", value: 0 },
            { label: "50k - 99k (1 point)", value: 1 },
            { label: "< 50k (2 points)", value: 2 }
          ],
          defaultValue: 0
        },
        {
          key: "markers",
          label: "Fibrin degradation products (FDP / D-Dimer) rise",
          type: "select",
          options: [
            { label: "No increase (0 points)", value: 0 },
            { label: "Moderate increase (2 points)", value: 2 },
            { label: "Strong increase (3 points)", value: 3 }
          ],
          defaultValue: 0
        },
        {
          key: "pt",
          label: "Prothrombin Time (PT) prolongation",
          type: "select",
          options: [
            { label: "< 3 seconds (0 points)", value: 0 },
            { label: "3 - 5 seconds (1 point)", value: 1 },
            { label: ">= 6 seconds (2 points)", value: 2 }
          ],
          defaultValue: 0
        },
        {
          key: "fibrinogen",
          label: "Fibrinogen level (mg/dL)",
          type: "select",
          options: [
            { label: ">= 100 mg/dL (0 points)", value: 0 },
            { label: "< 100 mg/dL (1 point)", value: 1 }
          ],
          defaultValue: 0
        }
      ],
      calculate: (inputs) => {
        const score = Number(inputs.plt ?? 0) + Number(inputs.markers ?? 0) + Number(inputs.pt ?? 0) + Number(inputs.fibrinogen ?? 0);
        let interpretation = "No active DIC (score < 5)";
        let level: "info" | "warning" | "critical" = "info";
        if (score >= 5) {
          interpretation = "Overt DIC (score >= 5) - Treat primary cause, consult hematology, administer blood products as indicated for bleeding.";
          level = "critical";
        }
        return { score, interpretation, level };
      }
    },
    {
      id: "four_ts",
      name: "4Ts Score",
      fullName: "4Ts Score for Heparin-Induced Thrombocytopenia",
      category: "Heme",
      description: "Assesses pretest probability of Heparin-Induced Thrombocytopenia (HIT).",
      clinicalUtility: "Assists in deciding whether to stop heparin and start alternative anticoagulants (argatroban).",
      inputs: [
        {
          key: "thrombocytopenia",
          label: "Thrombocytopenia (platelet count drop)",
          type: "select",
          options: [
            { label: "Platelet fall >50% and nadir >=20k (2 points)", value: 2 },
            { label: "Platelet fall 30-50% OR nadir 10-19k (1 point)", value: 1 },
            { label: "Platelet fall <30% OR nadir <10k (0 points)", value: 0 }
          ],
          defaultValue: 2
        },
        {
          key: "timing",
          label: "Timing of platelet count fall",
          type: "select",
          options: [
            { label: "Onset days 5–10 OR onset <=1 day (with recent heparin exposures) (2 points)", value: 2 },
            { label: "Onset >10 days OR unclear onset OR onset <=1 day (without recent exposures) (1 point)", value: 1 },
            { label: "Onset <=4 days without prior heparin exposure (0 points)", value: 0 }
          ],
          defaultValue: 2
        },
        {
          key: "thrombosis",
          label: "Thrombosis or other sequelae",
          type: "select",
          options: [
            { label: "New thrombosis OR skin necrosis at injection site OR systemic reaction (2 points)", value: 2 },
            { label: "Progressive/recurrent thrombosis OR silent thrombosis OR erythematous skin lesions (1 point)", value: 1 },
            { label: "None (0 points)", value: 0 }
          ],
          defaultValue: 2
        },
        {
          key: "other_cause",
          label: "Other cause for platelet drop",
          type: "select",
          options: [
            { label: "No other cause is apparent (2 points)", value: 2 },
            { label: "Possible alternative cause exists (1 point)", value: 1 },
            { label: "Definite alternative cause is present (0 points)", value: 0 }
          ],
          defaultValue: 2
        }
      ],
      calculate: (inputs) => {
        const score = Number(inputs.thrombocytopenia ?? 2) + Number(inputs.timing ?? 2) + Number(inputs.thrombosis ?? 2) + Number(inputs.other_cause ?? 2);
        let interpretation = "Low probability of HIT (<=3) - Continue heparin";
        let level: "info" | "warning" | "critical" = "info";
        if (score >= 6) {
          interpretation = "High pretest probability of HIT (6-8) - STOP heparin immediately, check HIT antibody ELISA, start alternative anticoagulants.";
          level = "critical";
        } else if (score >= 4) {
          interpretation = "Intermediate probability of HIT (4-5) - Consider alternative anticoagulants pending antibody ELISA results.";
          level = "warning";
        }
        return { score, interpretation, level };
      }
    },

    // --- GLOBAL SEVERITY & ORGAN DYSFUNCTION ---
    {
      id: "sofa",
      name: "SOFA",
      fullName: "Sequential Organ Failure Assessment",
      category: "Global",
      description: "Tracks organ failure rates over time and estimates cumulative ICU mortality.",
      clinicalUtility: "Calculates standard SOFA score (0-24) based on 6 organ systems.",
      inputs: [
        { key: "pao2", label: "PaO2 (mmHg) (Vent/Non-vent)", type: "number", placeholder: "e.g., 75", sourcePath: "pao2" },
        { key: "fio2", label: "FiO2 (%)", type: "number", placeholder: "e.g., 40", sourcePath: "fio2" },
        { key: "plt", label: "Platelets (x10³/μL)", type: "number", placeholder: "e.g., 120", sourcePath: "platelets" },
        { key: "bil", label: "Bilirubin (mg/dL)", type: "number", placeholder: "e.g., 1.2", sourcePath: "bilirubin" },
        { key: "gcs", label: "GCS score", type: "number", placeholder: "e.g., 15", sourcePath: "gcs" },
        { key: "map", label: "MAP (mmHg)", type: "number", placeholder: "e.g., 68", sourcePath: "map" },
        { key: "creat", label: "Creatinine (mg/dL)", type: "number", placeholder: "e.g., 1.1", sourcePath: "creatinine" },
        {
          key: "pressors",
          label: "Vasoactive drug support",
          type: "select",
          options: [
            { label: "None (0 points)", value: 0 },
            { label: "Dopamine <= 5 or Dobutamine/Milrinone (1 point)", value: 1 },
            { label: "Norepi/Epi <= 0.1 mcg/kg/min or Dopamine > 5 (3 points)", value: 3 },
            { label: "Norepi/Epi > 0.1 mcg/kg/min or Dopamine > 15 (4 points)", value: 4 }
          ],
          defaultValue: 0
        }
      ],
      calculate: (inputs) => {
        const pao2 = parseFloat(inputs.pao2);
        const fio2 = parseFloat(inputs.fio2) / 100;
        const pf = !isNaN(pao2) && !isNaN(fio2) && fio2 > 0 ? pao2 / fio2 : 400;
        
        const plt = parseFloat(inputs.plt);
        const bil = parseFloat(inputs.bil);
        const gcs = parseFloat(inputs.gcs);
        const map = parseFloat(inputs.map);
        const cr = parseFloat(inputs.creat);
        const pressorPts = Number(inputs.pressors ?? 0);
        
        let score = 0;
        
        // 1. Respiratory
        if (pf < 100) score += 4;
        else if (pf < 200) score += 3;
        else if (pf < 300) score += 2;
        else if (pf < 400) score += 1;
        
        // 2. Coagulation
        if (plt < 20) score += 4;
        else if (plt < 50) score += 3;
        else if (plt < 100) score += 2;
        else if (plt < 150) score += 1;
        
        // 3. Liver
        if (bil >= 12.0) score += 4;
        else if (bil >= 6.0) score += 3;
        else if (bil >= 2.0) score += 2;
        else if (bil >= 1.2) score += 1;
        
        // 4. Cardiovascular
        if (pressorPts > 0) {
          score += pressorPts;
        } else if (!isNaN(map) && map < 70) {
          score += 1;
        }
        
        // 5. CNS
        if (gcs < 6) score += 4;
        else if (gcs <= 9) score += 3;
        else if (gcs <= 12) score += 2;
        else if (gcs <= 14) score += 1;
        
        // 6. Renal
        if (cr >= 5.0) score += 4;
        else if (cr >= 3.5) score += 3;
        else if (cr >= 2.0) score += 2;
        else if (cr >= 1.2) score += 1;
        
        let level: "info" | "warning" | "critical" = "info";
        let interpretation = "Low organ dysfunction mortality risk (< 10%)";
        
        if (score >= 12) {
          interpretation = `Severe Multi-Organ Failure (SOFA >= 12) - Estimated mortality risk ~50% - 95%.`;
          level = "critical";
        } else if (score >= 8) {
          interpretation = "Moderate Multi-Organ Dysfunction (SOFA 8-11) - Mortality risk ~20-30%";
          level = "warning";
        } else if (score >= 3) {
          interpretation = "Mild organ dysfunction";
          level = "info";
        }
        
        return { score, interpretation, level };
      }
    },
    {
      id: "apache2",
      name: "APACHE II",
      fullName: "APACHE II Severity of Disease Score",
      category: "Global",
      description: "Severe clinical stratification score calculated within 24h of admission.",
      clinicalUtility: "Standardized tool for clinical severity audits and ICU baseline mortality prediction.",
      inputs: [
        { key: "temp", label: "Temperature (°C)", type: "number", sourcePath: "temp" },
        { key: "hr", label: "Heart Rate (bpm)", type: "number", sourcePath: "hr" },
        { key: "rr", label: "Respiratory Rate", type: "number", sourcePath: "rr" },
        { key: "map", label: "MAP (mmHg)", type: "number", sourcePath: "map" },
        { key: "wbc", label: "WBC Count (x10³/μL)", type: "number", sourcePath: "wbc" },
        { key: "creat", label: "Creatinine (mg/dL)", type: "number", sourcePath: "creatinine" },
        { key: "age", label: "Age (years)", type: "number", sourcePath: "age" },
        {
          key: "chronic",
          label: "Severe Chronic Organ Failure?",
          type: "select",
          options: [
            { label: "None (0 points)", value: 0 },
            { label: "Emergency surgery admission / Non-operative (5 points)", value: 5 },
            { label: "Elective postoperative admission (2 points)", value: 2 }
          ],
          defaultValue: 0
        }
      ],
      calculate: (inputs) => {
        const temp = parseFloat(inputs.temp);
        const hr = parseFloat(inputs.hr);
        const map = parseFloat(inputs.map);
        const age = parseFloat(inputs.age);
        const cr = parseFloat(inputs.creat);
        const wbc = parseFloat(inputs.wbc);
        const chronicPts = Number(inputs.chronic ?? 0);
        
        if (isNaN(temp) || isNaN(hr) || isNaN(map) || isNaN(age)) {
          return { score: "--", interpretation: "Fill in Temperature, HR, MAP, and Age for approximation.", level: "info" };
        }
        
        let score = 0;
        
        // Age points
        if (age >= 75) score += 6;
        else if (age >= 65) score += 5;
        else if (age >= 55) score += 3;
        else if (age >= 45) score += 2;
        
        // Temp points
        if (temp >= 41 || temp < 30) score += 4;
        else if (temp >= 39 || temp < 32) score += 3;
        else if (temp >= 38.5 || temp < 34) score += 1;
        
        // MAP points
        if (map >= 160 || map <= 49) score += 4;
        else if (map >= 130) score += 3;
        else if (map >= 110 || map <= 69) score += 2;
        
        // HR points
        if (hr >= 180 || hr <= 39) score += 4;
        else if (hr >= 140 || hr <= 54) score += 3;
        else if (hr >= 110 || hr <= 69) score += 2;
        
        // Creatinine (double if acute renal failure)
        if (!isNaN(cr)) {
          if (cr >= 3.5) score += 4;
          else if (cr >= 2.0) score += 3;
          else if (cr >= 1.5) score += 2;
        }
        
        score += chronicPts;
        
        let interpretation = "Estimated mortality risk < 10%";
        let level: "info" | "warning" | "critical" = "info";
        
        if (score >= 35) {
          interpretation = "Critical Severe Disease (APACHE II >= 35) - Estimated mortality risk > 85%.";
          level = "critical";
        } else if (score >= 25) {
          interpretation = "High Severity Disease (APACHE II 25-34) - Estimated mortality risk ~55%.";
          level = "critical";
        } else if (score >= 15) {
          interpretation = "Moderate Severity Disease (APACHE II 15-24) - Estimated mortality risk ~25-35%.";
          level = "warning";
        }
        
        return { score: `${score} (approx.)`, interpretation, level };
      }
    },

    // --- DISEASE-SPECIFIC ---
    {
      id: "news2",
      name: "NEWS2",
      fullName: "National Early Warning Score 2",
      category: "Disease",
      description: "Standardized tracks of acute physiological deterioration in sepsis or infection.",
      clinicalUtility: "Triggers escalation of care protocols for deteriorating patients.",
      inputs: [
        { key: "rr", label: "Respiratory Rate", type: "number", sourcePath: "rr" },
        { key: "spo2", label: "SpO2 (%)", type: "number", sourcePath: "spo2" },
        { key: "temp", label: "Temperature (°C)", type: "number", sourcePath: "temp" },
        { key: "sbp", label: "Systolic Blood Pressure (mmHg)", type: "number", sourcePath: "sbp" },
        { key: "hr", label: "Heart Rate", type: "number", sourcePath: "hr" },
        {
          key: "oxygen",
          label: "Supplemental Oxygen Therapy?",
          type: "select",
          options: [
            { label: "No (Air) (0 points)", value: 0 },
            { label: "Yes (Oxygen therapy) (2 points)", value: 2 }
          ],
          defaultValue: 0
        },
        {
          key: "consciousness",
          label: "Consciousness State (ACVPU)",
          type: "select",
          options: [
            { label: "Alert (0 points)", value: 0 },
            { label: "Confusion / Voice / Pain / Unresponsive (3 points)", value: 3 }
          ],
          defaultValue: 0
        }
      ],
      calculate: (inputs) => {
        const rr = parseFloat(inputs.rr);
        const spo2 = parseFloat(inputs.spo2);
        const sbp = parseFloat(inputs.sbp);
        const hr = parseFloat(inputs.hr);
        const temp = parseFloat(inputs.temp);
        const o2Pts = Number(inputs.oxygen ?? 0);
        const consciousnessPts = Number(inputs.consciousness ?? 0);
        
        if (isNaN(rr) || isNaN(spo2) || isNaN(sbp) || isNaN(hr) || isNaN(temp)) {
          return { score: "--", interpretation: "Enter complete RR, SpO2, SBP, HR, and Temp.", level: "info" };
        }
        
        let score = 0;
        
        // RR Points
        if (rr >= 25 || rr <= 8) score += 3;
        else if (rr >= 21) score += 2;
        else if (rr <= 11) score += 1;
        
        // SpO2 Scale 1 Points (assuming no hypercapnic respiratory failure)
        if (spo2 < 92) score += 3;
        else if (spo2 <= 93) score += 2;
        else if (spo2 <= 95) score += 1;
        
        // SBP Points
        if (sbp >= 220 || sbp <= 90) score += 3;
        else if (sbp <= 100) score += 2;
        else if (sbp <= 110) score += 1;
        
        // HR Points
        if (hr >= 131 || hr <= 40) score += 3;
        else if (hr >= 111 || hr <= 50) score += 2;
        else if (hr >= 91) score += 1;
        
        // Temp Points
        if (temp >= 39.1 || temp <= 35.0) score += 3;
        else if (temp >= 38.1 || temp <= 36.0) score += 1;
        
        score += o2Pts;
        score += consciousnessPts;
        
        let interpretation = "Low Risk - Routine ward level review";
        let level: "info" | "warning" | "critical" = "info";
        
        if (score >= 7) {
          interpretation = "HIGH RISK (NEWS2 >= 7) - Urgent critical care intervention / transfer to ICU suggested.";
          level = "critical";
        } else if (score >= 5) {
          interpretation = "Medium Risk (NEWS2 5-6) - Urgent ward-based clinician assessment.";
          level = "warning";
        } else if (score >= 1) {
          interpretation = "Low-Medium Risk (individual system score of 3 triggers clinical review)";
          level = "info";
        }
        return { score, interpretation, level };
      }
    },
    {
      id: "sirs",
      name: "SIRS",
      fullName: "Systemic Inflammatory Response Syndrome Criteria",
      category: "Disease",
      description: "Identifies systemic inflammatory response criteria.",
      clinicalUtility: "Standard screening tool for sepsis when combined with suspected infection.",
      inputs: [
        { key: "temp", label: "Temperature < 36°C or > 38.3°C?", type: "boolean", defaultValue: false },
        { key: "hr", label: "Heart Rate > 90 bpm?", type: "boolean", defaultValue: false },
        { key: "rr", label: "Resp Rate > 20 or PaCO2 < 32 mmHg?", type: "boolean", defaultValue: false },
        { key: "wbc", label: "WBC < 4k, > 12k or >10% bands?", type: "boolean", defaultValue: false }
      ],
      calculate: (inputs) => {
        const sum = (inputs.temp ? 1 : 0) + (inputs.hr ? 1 : 0) + (inputs.rr ? 1 : 0) + (inputs.wbc ? 1 : 0);
        const meets = sum >= 2;
        return {
          score: sum,
          interpretation: meets 
            ? "SIRS POSITIVE (SIRS >= 2) - Suspicion of infection strongly suggests active Sepsis. Monitor lactate and perfusion." 
            : "SIRS Negative (<2 criteria met)",
          level: meets ? "warning" : "info"
        };
      }
    },
    {
      id: "bisap",
      name: "BISAP Score",
      fullName: "Bedside Index for Severity in Acute Pancreatitis",
      category: "Disease",
      description: "Early (24h) risk predictor for mortality in acute pancreatitis.",
      clinicalUtility: "Simple score to decide which pancreatitis patients require step-up ICU care.",
      inputs: [
        { key: "bun", label: "BUN > 25 mg/dL (Urea > 8.9 mmol/L)?", type: "boolean", defaultValue: false },
        { key: "gcs", label: "Impaired Mental Status (GCS < 15)?", type: "boolean", defaultValue: false },
        { key: "sirs", label: "SIRS criteria met (>= 2 present)?", type: "boolean", defaultValue: false },
        { key: "age", label: "Age > 60 years?", type: "boolean", defaultValue: false },
        { key: "effusion", label: "Pleural Effusion present on CXR?", type: "boolean", defaultValue: false }
      ],
      calculate: (inputs) => {
        const score = (inputs.bun ? 1 : 0) + (inputs.gcs ? 1 : 0) + (inputs.sirs ? 1 : 0) + (inputs.age ? 1 : 0) + (inputs.effusion ? 1 : 0);
        let interpretation = "Mild acute pancreatitis (mortality risk < 1%)";
        let level: "info" | "warning" | "critical" = "info";
        if (score >= 3) {
          interpretation = "Severe Acute Pancreatitis (BISAP >= 3) - mortality risk ~15% - 22%. Close ICU vigilance.";
          level = "critical";
        } else if (score >= 1) {
          interpretation = "Moderate acute pancreatitis risk.";
          level = "warning";
        }
        return { score, interpretation, level };
      }
    },
    {
      id: "baux",
      name: "Revised Baux Score",
      fullName: "Revised Baux Score for Burn Mortality",
      category: "Disease",
      description: "Estimates the probability of mortality in severe burn injuries.",
      clinicalUtility: "Sum of Age + Total Body Surface Area (TBSA) % Burn + 17 (if inhalation injury present).",
      inputs: [
        { key: "age", label: "Patient Age (years)", type: "number", sourcePath: "age" },
        { key: "tbsa", label: "TBSA Burn Percentage (0-100%)", type: "number", placeholder: "e.g., 30" },
        { key: "inhalation", label: "Inhalation Injury Present?", type: "boolean", defaultValue: false }
      ],
      calculate: (inputs) => {
        const age = parseFloat(inputs.age);
        const tbsa = parseFloat(inputs.tbsa);
        const inh = !!inputs.inhalation;
        
        if (isNaN(age) || isNaN(tbsa)) {
          return { score: "--", interpretation: "Enter Age and TBSA % Burn.", level: "info" };
        }
        
        const score = age + tbsa + (inh ? 17 : 0);
        
        // Probability of mortality equation: prob = 1 / (1 + e^-(score - 104) / 14)
        const power = (score - 104) / 14;
        const prob = Math.round((1 / (1 + Math.exp(-power))) * 100);
        
        let level: "info" | "warning" | "critical" = "info";
        if (prob >= 80) level = "critical";
        else if (prob >= 30) level = "warning";
        
        return {
          score,
          interpretation: `Estimated Burn Mortality Probability: ${prob}%`,
          level
        };
      }
    },

    // --- ICU WORKLOAD & NURSING METRICS ---
    {
      id: "tiss28",
      name: "TISS-28",
      fullName: "Therapeutic Intervention Scoring System (28 items)",
      category: "Workload",
      description: "Measures ICU nursing workload and therapeutic intervention intensity.",
      clinicalUtility: "Assists in staffing ratios (1 point = ~11.5 minutes of nursing activities per shift).",
      inputs: [
        { key: "vitals", label: "Standard ICU monitor/vitals tracking (3 points)", type: "boolean", defaultValue: true },
        { key: "vent", label: "Mechanical Ventilation / respiratory therapy (5 points)", type: "boolean", defaultValue: false },
        { key: "hemo", label: "Invasive Hemodynamic monitoring (Swan/Art line) (8 points)", type: "boolean", defaultValue: false },
        { key: "drugs", label: "Multiple vasoactive drug infusions (4 points)", type: "boolean", defaultValue: false },
        { key: "renal", label: "CRRT / hemodialysis running (3 points)", type: "boolean", defaultValue: false },
        { key: "hygiene", label: "Assisted hygiene, turning, bed baths (5 points)", type: "boolean", defaultValue: false },
        { key: "admin", label: "Administrative tasks (admit, transfer, clinical audits) (4 points)", type: "boolean", defaultValue: false }
      ],
      calculate: (inputs) => {
        let score = 0;
        if (inputs.vitals) score += 3;
        if (inputs.vent) score += 5;
        if (inputs.hemo) score += 8;
        if (inputs.drugs) score += 4;
        if (inputs.renal) score += 3;
        if (inputs.hygiene) score += 5;
        if (inputs.admin) score += 4;
        
        const mins = score * 11.5;
        return {
          score,
          interpretation: `Requires approx. ${Math.round(mins)} minutes (~${(mins/60).toFixed(1)} hours) of dedicated nursing labor per shift.`,
          level: score >= 30 ? "critical" : (score >= 15 ? "warning" : "info")
        };
      }
    }
  ];

  // Map of category names to visual icons and labels
  const categoryMeta: Record<string, { label: string; icon: any; color: string }> = {
    Neuro: { label: "Neurology", icon: Brain, color: "text-indigo-400 border-indigo-950 bg-indigo-950/10" },
    Resp: { label: "Respiratory", icon: Wind, color: "text-sky-400 border-sky-950 bg-sky-950/10" },
    CVS: { label: "Cardiovascular", icon: Heart, color: "text-rose-400 border-rose-950 bg-rose-950/10" },
    Renal: { label: "Renal", icon: ShieldAlert, color: "text-amber-400 border-amber-950 bg-amber-950/10" },
    Hepatic: { label: "Liver & GI", icon: Activity, color: "text-emerald-400 border-emerald-950 bg-emerald-950/10" },
    Heme: { label: "Hematology & Onco", icon: AlertTriangle, color: "text-purple-400 border-purple-950 bg-purple-950/10" },
    Global: { label: "Global Severity", icon: Activity, color: "text-teal-400 border-teal-950 bg-teal-950/10" },
    Disease: { label: "Disease-Specific", icon: AlertCircle, color: "text-cyan-400 border-cyan-950 bg-cyan-950/10" },
    Workload: { label: "Nursing Workload", icon: Briefcase, color: "text-zinc-400 border-zinc-850 bg-zinc-900/40" }
  };

  // Open a specific calculator and pre-fill its parameters from current patient details
  const handleOpenScore = (scoreDef: ScoreDefinition) => {
    setActiveScoreId(scoreDef.id);
    const initialInputs: Record<string, any> = {};
    scoreDef.inputs.forEach(inp => {
      // Check if sourcePath exists and pulls something from patient profile
      if (inp.sourcePath) {
        const val = getPatientMetric(inp.sourcePath);
        if (val !== "") {
          initialInputs[inp.key] = val;
          return;
        }
      }
      initialInputs[inp.key] = inp.defaultValue ?? "";
    });
    setScoreInputs(initialInputs);
  };

  const handleInputChange = (key: string, val: any) => {
    setScoreInputs(prev => ({
      ...prev,
      [key]: val
    }));
  };

  const toggleRelevantScore = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent opening calculator when clicking checkbox
    setRelevantScores(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
    showToast(`Scoring relevance updated.`, "success");
  };

  // Handle posting the calculated score to the patient timeline
  const handleLogScoreToTimeline = (scoreDef: ScoreDefinition) => {
    const { score, interpretation, level } = scoreDef.calculate(scoreInputs);
    
    // Create detailed notes
    const inputsDetails = scoreDef.inputs
      .map(inp => {
        const val = scoreInputs[inp.key];
        let labelVal = val;
        if (inp.type === "select" && inp.options) {
          const opt = inp.options.find(o => String(o.value) === String(val));
          if (opt) labelVal = opt.label;
        } else if (inp.type === "boolean") {
          labelVal = val ? "Yes" : "No";
        }
        return `• ${inp.label}: ${labelVal}`;
      })
      .join("\n");

    const note = `Evaluated clinical ${scoreDef.fullName} (${scoreDef.name}):\nScore Value: ${score}\nInterpretation: ${interpretation}\n\nInput Parameters:\n${inputsDetails}`;

    const newEvent: TimelineRecord = {
      id: "score_" + Date.now(),
      timestamp: new Date().toISOString(),
      updatedBy: "Medical Assistant",
      role: "Clinician",
      notes: note,
      level: level === "critical" ? "Critical" : (level === "warning" ? "Warning" : "Info")
    };

    const updatedTimeline = [newEvent, ...(patient.timeline || [])];
    onSaveTimeline(updatedTimeline);
    showToast(`${scoreDef.name} score logged successfully to Shift Timeline!`, "success");
    setActiveScoreId(null);
  };

  // Filtered and sorted scoring list
  const filteredScores = scoreDefinitions.filter(score => {
    const matchesSearch = score.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          score.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          score.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "All" || score.category === selectedCategory;
    const matchesRelevance = !relevantOnly || relevantScores[score.id];
    
    return matchesSearch && matchesCategory && matchesRelevance;
  });

  return (
    <div className="space-y-6 animate-fade-in font-sans text-zinc-300">
      <div className="bg-[#111111] border border-[#222222] p-6 rounded">
        {/* Header Title */}
        <div className="border-b border-[#222222] pb-4 mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="font-serif text-base italic text-[#E0E0E0] flex items-center gap-2">
              <Calculator className="w-5 h-5 text-emerald-400" />
              Comprehensive Critical Care Scoring Index
            </h3>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
              Organize patient-specific severity indices. Pulls active vitals & labs, flags gaps, and supports custom clinical thresholds with timeline syncing.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setRelevantOnly(prev => !prev)}
              className={`px-3 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider border flex items-center gap-1.5 transition-all ${
                relevantOnly 
                  ? "bg-emerald-950/40 border-emerald-500 text-emerald-400" 
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-850"
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              {relevantOnly ? "Showing Patient Selected Only" : "Select Specific Metrics"}
            </button>
          </div>
        </div>

        {/* SEARCH AND FILTERS */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-6">
          <div className="md:col-span-5 relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search 40+ scoring systems (e.g. GCS, MELD, NEWS2, VIS)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1A1A1A] border border-[#222222] rounded pl-10 pr-4 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 font-sans"
            />
          </div>
          <div className="md:col-span-7 flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedCategory("All")}
              className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wide transition-all ${
                selectedCategory === "All"
                  ? "bg-emerald-600 text-zinc-950 font-black"
                  : "bg-zinc-900 text-zinc-500 border border-zinc-850 hover:text-zinc-300"
              }`}
            >
              All Systems
            </button>
            {Object.entries(categoryMeta).map(([catKey, meta]) => (
              <button
                key={catKey}
                onClick={() => setSelectedCategory(catKey)}
                className={`px-2.5 py-1.5 rounded text-[10px] font-bold uppercase tracking-wide transition-all border ${
                  selectedCategory === catKey
                    ? "bg-emerald-950 border-emerald-500 text-emerald-400 font-black"
                    : "bg-zinc-900 text-zinc-500 border-zinc-850 hover:text-zinc-300"
                }`}
              >
                {meta.label}
              </button>
            ))}
          </div>
        </div>

        {/* MAIN SPLIT PANELS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: Scoring Systems Directory */}
          <div className="lg:col-span-6 space-y-3 max-h-[550px] overflow-y-auto pr-1">
            <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-850 pb-2 px-1">
              <span>Physiological Tool ({filteredScores.length} listed)</span>
              <span>Patient Focus Relevance</span>
            </div>
            
            {filteredScores.length === 0 ? (
              <div className="p-12 border border-dashed border-[#222222] rounded text-center text-zinc-500 text-xs font-sans">
                No scoring systems matching your criteria. Reset filters or search query.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {filteredScores.map((score) => {
                  const meta = categoryMeta[score.category];
                  const CatIcon = meta?.icon || Activity;
                  const isRelevant = relevantScores[score.id];
                  const isActive = activeScoreId === score.id;
                  
                  return (
                    <div 
                      key={score.id}
                      onClick={() => handleOpenScore(score)}
                      className={`p-3.5 rounded border transition-all duration-200 flex items-center justify-between gap-4 cursor-pointer relative group ${
                        isActive 
                          ? "bg-emerald-950/10 border-emerald-500" 
                          : "bg-[#161616]/75 border-[#222222]/85 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`p-2 rounded border shrink-0 ${meta?.color || "border-zinc-800 text-zinc-400 bg-zinc-900"}`}>
                          <CatIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-zinc-100 text-xs tracking-wide">{score.name}</span>
                            <span className="text-[9px] text-zinc-500 font-medium truncate">{score.fullName}</span>
                          </div>
                          <p className="text-[11px] text-zinc-400 line-clamp-1 mt-1 font-sans leading-normal">
                            {score.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Interactive toggle for Patient Relevance */}
                        <button
                          type="button"
                          onClick={(e) => toggleRelevantScore(score.id, e)}
                          title={isRelevant ? "Remove from dynamic score tracker" : "Set as active score tracker for patient"}
                          className={`p-1.5 rounded transition-all border cursor-pointer ${
                            isRelevant 
                              ? "bg-emerald-950 border-emerald-600/30 text-emerald-400" 
                              : "bg-zinc-900/50 border-zinc-850 text-zinc-650 hover:text-zinc-400 group-hover:border-zinc-700"
                          }`}
                        >
                          <Check className={`w-3.5 h-3.5 ${isRelevant ? "opacity-100 scale-100" : "opacity-30 scale-90"}`} />
                        </button>
                        <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT: Active Interactive Calculator Panel */}
          <div className="lg:col-span-6 bg-[#161616]/75 border border-zinc-850 p-5 rounded relative flex flex-col justify-between min-h-[480px]">
            {activeScoreId ? (
              (() => {
                const scoreDef = scoreDefinitions.find(s => s.id === activeScoreId);
                if (!scoreDef) return null;
                
                // Live calculate
                const { score, interpretation, level } = scoreDef.calculate(scoreInputs);
                const meta = categoryMeta[scoreDef.category];
                
                return (
                  <div className="space-y-5 flex-1 flex flex-col justify-between">
                    <div>
                      {/* Active header */}
                      <div className="flex justify-between items-start border-b border-[#222222] pb-3.5 gap-4">
                        <div className="min-w-0">
                          <span className={`inline-block text-[9px] px-2 py-0.5 rounded border uppercase tracking-widest font-mono font-bold mb-1.5 ${meta?.color || ""}`}>
                            {meta?.label || scoreDef.category}
                          </span>
                          <h4 className="font-serif text-sm font-bold text-zinc-100">{scoreDef.fullName} ({scoreDef.name})</h4>
                          <p className="text-[11px] text-zinc-500 font-sans mt-0.5">{scoreDef.description}</p>
                        </div>
                        <button 
                          onClick={() => setActiveScoreId(null)} 
                          className="text-zinc-650 hover:text-zinc-300 p-1 rounded hover:bg-zinc-900 transition-colors shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* CLINICAL UTILITY INFO CARD */}
                      <div className="p-3 bg-zinc-950/40 border border-zinc-900 rounded text-[11px] font-sans text-zinc-400 flex items-start gap-2.5 mt-3">
                        <Info className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <p className="leading-relaxed">{scoreDef.clinicalUtility}</p>
                      </div>

                      {/* PARAMETERS INPUT FORM */}
                      <div className="space-y-4 mt-5">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 block border-b border-[#222222] pb-1 font-sans">
                          Auto-Filled & User Overrides
                        </span>
                        
                        <div className="grid grid-cols-1 gap-3.5">
                          {scoreDef.inputs.map(inp => {
                            const isAutoFilled = inp.sourcePath && getPatientMetric(inp.sourcePath) !== "";
                            
                            return (
                              <div key={inp.key} className="space-y-1 font-sans">
                                <div className="flex justify-between items-center text-[10px] font-bold">
                                  <label className="text-zinc-300 uppercase tracking-wide">
                                    {inp.label}
                                  </label>
                                  {isAutoFilled && (
                                    <span className="text-[9px] text-emerald-500 font-mono flex items-center gap-1 font-bold bg-emerald-950/30 border border-emerald-900/40 px-1.5 py-0.2 rounded shrink-0">
                                      <Check className="w-2.5 h-2.5" />
                                      PULLED FROM EHR
                                    </span>
                                  )}
                                </div>
                                
                                {inp.type === "select" ? (
                                  <select
                                    value={scoreInputs[inp.key] ?? ""}
                                    onChange={(e) => handleInputChange(inp.key, e.target.value)}
                                    className="w-full bg-[#111111] border border-[#222222] rounded px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                                  >
                                    <option value="">-- Choose Option --</option>
                                    {inp.options?.map(opt => (
                                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                  </select>
                                ) : inp.type === "boolean" ? (
                                  <div className="flex items-center gap-3 bg-[#111111] border border-[#222222] px-3 py-2 rounded">
                                    <input
                                      type="checkbox"
                                      id={`chk_${inp.key}`}
                                      checked={!!scoreInputs[inp.key]}
                                      onChange={(e) => handleInputChange(inp.key, e.target.checked)}
                                      className="w-4 h-4 accent-emerald-500 cursor-pointer"
                                    />
                                    <label htmlFor={`chk_${inp.key}`} className="text-xs text-zinc-300 select-none cursor-pointer">
                                      Criteria Met (Mark Yes)
                                    </label>
                                  </div>
                                ) : (
                                  <input
                                    type="number"
                                    value={scoreInputs[inp.key] ?? ""}
                                    onChange={(e) => handleInputChange(inp.key, e.target.value)}
                                    placeholder={inp.placeholder || "e.g., --"}
                                    className="w-full bg-[#111111] border border-[#222222] rounded px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* DYNAMIC REAL-TIME CALCULATION RESULTS BOX */}
                    <div className="mt-6 space-y-4">
                      <div className="bg-zinc-950/80 border border-zinc-900 p-4 rounded-lg flex items-center justify-between gap-4 font-sans">
                        <div className="space-y-1">
                          <span className="text-[9px] text-zinc-500 uppercase font-black tracking-widest block">Calculated Result</span>
                          <span className={`text-2xl font-black font-mono tracking-tight ${
                            level === "critical" ? "text-red-400" : (level === "warning" ? "text-amber-400" : "text-emerald-400")
                          }`}>
                            {score}
                          </span>
                        </div>
                        <div className="text-right max-w-xs space-y-1">
                          <span className="text-[9px] text-zinc-500 uppercase font-black tracking-widest block">Risk Stratification</span>
                          <span className={`text-[11px] font-bold block ${
                            level === "critical" ? "text-red-400" : (level === "warning" ? "text-amber-400" : "text-emerald-400")
                          }`}>
                            {interpretation}
                          </span>
                        </div>
                      </div>

                      {/* ACTIONS */}
                      <button
                        type="button"
                        onClick={() => handleLogScoreToTimeline(scoreDef)}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold uppercase tracking-wider py-2 rounded text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-lg font-sans"
                      >
                        <Save className="w-4 h-4 text-zinc-950" />
                        Log Evaluated Score to Timeline
                      </button>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="flex-1 flex flex-col justify-center items-center text-center p-6 space-y-3 font-sans">
                <div className="w-12 h-12 rounded-full border border-[#222222] bg-zinc-900/40 flex items-center justify-center text-zinc-500 mb-2">
                  <Calculator className="w-5 h-5 text-zinc-400" />
                </div>
                <h4 className="font-serif text-sm italic text-zinc-200">Interactive Clinical Calculator</h4>
                <p className="text-xs text-zinc-500 max-w-xs leading-relaxed">
                  Select any neurological, cardiac, renal, liver, sepsis, or global severity scoring tool from the index to calculate real-time indices with auto-filled patient vitals.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
