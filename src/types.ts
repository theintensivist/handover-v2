/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ISBARData {
  identify: string;   // I: Identity, age, bed, ward, consultant
  situation: string;  // S: Chief complaint, acute changes, stability
  background: string; // B: Co-morbidities, previous surgeries, history
  assessment: string; // A: Recent lab values, scans, current support
  recommendation: string; // R: Active questions, discharge goals, plan
}

export interface SystemCNS {
  status: "Alert" | "Sedated" | "Comatose" | "Delirious" | "Agitated";
  comments: string;
  gcs?: string;
  four?: string;
  rass?: string;
  delirium?: string;
  satSbtSync?: string;
  pupils?: string;
  brainstemReflexes?: string;
  motor?: string;
  icp?: string;
  cpp?: string;
  evd?: string;
}

export interface SystemCVS {
  status: "Stable" | "Shock / Hypotension" | "Vasopressor Support" | "Arrhythmia";
  comments: string;
  hr: string;
  bp: string;
  map: string;
  rhythm?: string;
  cvp?: string;
  crt?: string;
  mottling?: string;
  lactate?: string;
  scvo2?: string;
  pco2Gap?: string;
  svvPpv?: string;
  vexus?: string;
  ecmoSupport?: string;
  iabpImpella?: string;
}

export interface SystemRS {
  status: "Room Air" | "Oxygen Mask / NC" | "HFNC" | "NIV (CPAP/BiPAP)" | "Invasive Vent";
  comments: string;
  mode: string;
  rr: string;
  fio2: string;
  peep: string;
  spo2: string;
  wob?: string;
  secretionScore?: string;
  cuffPressure?: string;
  pPlat?: string;
  drivingPressure?: string;
  roxIndex?: string;
  rsbi?: string;
}

export interface SystemGIT {
  status: "Normal Diet" | "NPO" | "Enteral (NG / NJ)" | "TPN";
  comments: string;
  diet: string;
  abdominalExam?: string;
  bowelMovement?: string;
  nutritionGoal?: string;
  iap?: string;
  liverProfile?: string;
}

export interface SystemRenal {
  status: "Stable" | "AKI / Oliguria" | "Anuria" | "CRRT / HD";
  comments: string;
  uo: string;     // Urine output ml/hr or ml/24h
  urea: string;
  creatinine: string;
  kdigo?: string;
  fluidPhase?: string;
  fluidOverload?: string;
  crrtEffluent?: string;
  crrtPressures?: string;
  rcaCalcium?: string;
}

export interface SystemHeme {
  status: "Normal" | "Anemic" | "Thrombocytopenic" | "Leukocytosis / Sepsis";
  comments: string;
  hb: string;
  wbc: string;
  plt: string;
  temp: string;
  restrictiveTransfusion?: string;
  leukocyteDynamics?: string;
  coagulopathyTEG?: string;
  thromboprophylaxisDetails?: string;
}

export interface SystemEndo {
  status: "Stable" | "Diabetic Control / Insulin" | "Electrolyte Imbalance" | "Adrenal/Other";
  comments: string;
  bg: string; // Blood glucose mg/dL
}

export interface AntibioticRecord {
  id: string;
  name: string;
  dose: string;
  frequency: string;
  type: "Empirical" | "Prophylactic" | "Targeted";
  startedDate: string;
  isCustom?: boolean;
}

export interface CultureRecord {
  id: string;
  site: string;
  date: string;
  organism: string;
  isCustomSite?: boolean;
  isCustomOrganism?: boolean;
  sensitiveAntibiotics: string[];
}

export interface TimelineRecord {
  id: string;
  timestamp: string;
  updatedBy: string;
  role: string;
  notes: string;
  systemChanges?: Record<string, string>;
  level?: "Info" | "Warning" | "Critical";
}

export interface DailyProgressNotes {
  cns: string;
  cvs: string;
  rs: string;
  renal: string;
  git: string;
  heme: string;
  idStewardship: string;
  other: string;
  lastUpdated?: string;
}

export interface SystemIDStewardship {
  status: "No Infection" | "Sepsis" | "Severe Shock" | "Resolving";
  comments: string;
  tempMinMax?: string;
  biomarkers?: string;
  cultures?: string;
  stewardshipTDM?: string;
  lineSites?: string;
  deviceHoliday?: string;
  antibioticsList?: AntibioticRecord[];
  culturesList?: CultureRecord[];
}

export interface SystemIntegumentaryMusculoskeletal {
  status: "Intact" | "Pressure Injury / Wound" | "ICUAW Weakness" | "Contracture Risk";
  comments: string;
  skinPressureInjury?: string;
  woundDrains?: string;
  mrcScore?: string;
  mobilityTier?: string;
}

export interface SystemPharmacologyToxicology {
  status: "Stable" | "Renal/Hepatic Adjustment Needed" | "Potential Interaction" | "SUP Indicated";
  comments: string;
  renalHepaticClearance?: string;
  drugInteractions?: string;
  stressUlcerProphylaxis?: string;
}

export interface SystemHumanitarianPalliative {
  status: "Comfort / Full Care" | "Comfort Care Only" | "Goal Alignment Needed";
  comments: string;
  sleepWakeBundle?: string;
  communicationAids?: string;
  familyUpdates?: string;
  goalsOfCare?: string;
  spiritualSocial?: string;
}

export interface SystemWiseDetails {
  cns: SystemCNS;
  cvs: SystemCVS;
  rs: SystemRS;
  git: SystemGIT;
  renal: SystemRenal;
  heme: SystemHeme;
  endocrine: SystemEndo;
  idStewardship?: SystemIDStewardship;
  integumentaryMusculoskeletal?: SystemIntegumentaryMusculoskeletal;
  pharmacologyToxicology?: SystemPharmacologyToxicology;
  humanitarianPalliative?: SystemHumanitarianPalliative;
}

export interface FASTHUGBIDChecklist {
  feeding: boolean;
  feedingNotes: string;
  analgesia: boolean;
  analgesiaNotes: string;
  sedation: boolean;
  sedationNotes: string;
  thrombo: boolean;
  thromboNotes: string;
  headUp: boolean;
  headUpNotes: string;
  ulcer: boolean;
  ulcerNotes: string;
  glycemic: boolean;
  glycemicNotes: string;
  bowel: boolean;
  bowelNotes: string;
  indwelling: boolean;
  indwellingNotes: string;
  deescalation: boolean;
  deescalationNotes: string;
  labs?: boolean;
  labsNotes?: string;
  integumentary?: boolean;
  integumentaryNotes?: string;
  neuro?: boolean;
  neuroNotes?: string;
  extracorporeal?: boolean;
  extracorporealNotes?: string;
  social?: boolean;
  socialNotes?: string;
}

export interface ClinicalNotes {
  planGoal: string;
  recentEvents: string;
  proceduresDone: string;
}

export interface PendingTask {
  id: string;
  description: string;
  priority: "High" | "Medium" | "Low";
  status: "Pending" | "Done";
}

export interface InfusionDrug {
  id: string;
  name: "Noradrenaline" | "Adrenaline" | "Vasopressin" | "Dobutamine" | "Dopamine" | "Milrinone" | "Sodium Nitroprusside" | "Nitroglycerin (GTN)" | "Labetalol" | "Nicardipine" | "Esmolol" | "Diltiazem";
  amount: string; // mg or Units (for Vasopressin)
  volume: string; // mL
  rate: string;   // mL/hr
  calculatedDose: string; // mcg/kg/min or Units/min
}

export interface ClinicalImage {
  id: string;
  title: string;
  base64: string;
  timestamp: string;
  fileType?: string;
  fileSize?: string;
}

export interface SOFACalculator {
  pao2: string; // mmHg
  fio2Percent: string; // e.g., 40
  platelets: string; // x10^3/uL
  bilirubin: string; // mg/dL
  gcs: string; // Glasgow Coma Scale (3-15)
  map: string; // mmHg
  vasopressor: "None" | "Dopamine <= 5 or any Dobutamine" | "Dopamine > 5 or Norad/Adrad <= 0.1" | "Dopamine > 15 or Norad/Adrad > 0.1";
  creatinine: string; // mg/dL
  score: string; // Calculated SOFA score (0-24)
}

export interface CalculatorsData {
  weight: string; // kg
  height: string; // cm
  bmi: string; // kg/m^2 (calculated)
  
  age: string;
  creatinine: string; // mg/dL
  crcl: string; // mL/min (calculated)
  gender: "Male" | "Female";
  
  calcium: string; // mg/dL
  albumin: string; // g/dL
  correctedCalcium: string; // mg/dL (calculated)
  
  sofa: SOFACalculator;
}

export interface ProcedureRecord {
  id: string;
  name: "CVC Insertion" | "Arterial Line Insertion" | "Tracheostomy" | "ICD Insertion" | "POCUS" | "Other";
  customName?: string;
  date: string;
  findings?: string;
  operator?: string;
}

export interface CriticalEventRecord {
  id: string;
  timestamp: string;
  description: string;
  actionTaken?: string;
  outcome?: string;
}

export interface ReferralReview {
  id: string;
  timestamp: string;
  reviewerRole: string;
  notes: string;
}

export interface ReferralRecord {
  id: string;
  specialty: string;
  status: "Pending Consultation" | "Recommendations Active" | "Completed / Closed";
  dateRequested: string;
  reasonForConsult: string;
  initialInput?: string;
  reviews?: ReferralReview[];
}

export interface DischargeSummaryDetails {
  dischargeAdvices: string;
  consults: string;
  followup: string;
}

// Full Decrypted Patient Object
export interface PatientData {
  name: string;
  age: string;
  gender: "Male" | "Female" | "Other";
  bed: string;
  mrn: string;
  admissionDate: string;
  diagnosis: string;
  isbar: ISBARData;
  systems: SystemWiseDetails;
  fasthugbid: FASTHUGBIDChecklist;
  clinicalNotes: ClinicalNotes;
  tasks: PendingTask[];
  calculators: CalculatorsData;
  infusions: InfusionDrug[];
  images: ClinicalImage[];
  timeline?: TimelineRecord[];
  dailyNotes?: DailyProgressNotes;
  procedures?: ProcedureRecord[];
  criticalEvents?: CriticalEventRecord[];
  referrals?: ReferralRecord[];
  dischargeSummary?: DischargeSummaryDetails;
}

// Encrypted patient record stored in Firestore
export interface EncryptedPatientRecord {
  id: string;
  encryptedBlob: string; // encrypted patient JSON string
  updatedAt: string;
  updatedBy: string;
}

// Encrypted message stored in Firestore
export interface EncryptedChatMessage {
  id: string;
  sender: string;
  encryptedText: string;
  createdAt: string;
}

// Decrypted Chat Message for UI
export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  createdAt: string;
}
