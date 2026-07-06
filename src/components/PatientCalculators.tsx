/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { CalculatorsData, InfusionDrug } from "../types";
import { Calculator, ShieldAlert, Check, Plus, Trash, Info } from "lucide-react";

interface PatientCalculatorsProps {
  calculators: CalculatorsData;
  infusions: InfusionDrug[];
  patientWeight: string;
  onUpdateCalculators: (updatedCalcs: CalculatorsData) => void;
  onUpdateInfusions: (updatedInfusions: InfusionDrug[]) => void;
}

// 1. Math Helper Functions
export function calculateBMI(weight: string, height: string): string {
  const w = parseFloat(weight);
  const h = parseFloat(height) / 100; // cm to m
  if (isNaN(w) || isNaN(h) || h <= 0) return "";
  return (w / (h * h)).toFixed(1);
}

export function calculateCrCl(age: string, weight: string, creatinine: string, gender: "Male" | "Female"): string {
  const a = parseFloat(age);
  const w = parseFloat(weight);
  const cr = parseFloat(creatinine);
  if (isNaN(a) || isNaN(w) || isNaN(cr) || cr <= 0) return "";
  
  // Cockcroft-Gault Equation
  let crcl = ((140 - a) * w) / (72 * cr);
  if (gender === "Female") {
    crcl *= 0.85;
  }
  return crcl.toFixed(1);
}

export function calculateCorrectedCalcium(calcium: string, albumin: string): string {
  const ca = parseFloat(calcium);
  const alb = parseFloat(albumin);
  if (isNaN(ca) || isNaN(alb)) return "";
  // Corrected Calcium = Measured Calcium + 0.8 * (4.0 - Albumin)
  const corrected = ca + 0.8 * (4.0 - alb);
  return corrected.toFixed(2);
}

export function calculateSOFAScore(sofa: CalculatorsData["sofa"]): string {
  let score = 0;

  // 1. Respiration: PaO2/FiO2 ratio
  const pao2 = parseFloat(sofa.pao2);
  const fio2 = parseFloat(sofa.fio2Percent) / 100;
  if (!isNaN(pao2) && !isNaN(fio2) && fio2 > 0) {
    const ratio = pao2 / fio2;
    if (ratio < 100) score += 4;
    else if (ratio < 200) score += 3;
    else if (ratio < 300) score += 2;
    else if (ratio < 400) score += 1;
  }

  // 2. Coagulation: Platelets
  const plt = parseFloat(sofa.platelets);
  if (!isNaN(plt)) {
    if (plt < 20) score += 4;
    else if (plt < 50) score += 3;
    else if (plt < 100) score += 2;
    else if (plt < 150) score += 1;
  }

  // 3. Liver: Bilirubin
  const bil = parseFloat(sofa.bilirubin);
  if (!isNaN(bil)) {
    if (bil >= 12.0) score += 4;
    else if (bil >= 6.0) score += 3;
    else if (bil >= 2.0) score += 2;
    else if (bil >= 1.2) score += 1;
  }

  // 4. Cardiovascular: MAP and Vasopressors
  if (sofa.vasopressor === "Dopamine > 15 or Norad/Adrad > 0.1") {
    score += 4;
  } else if (sofa.vasopressor === "Dopamine > 5 or Norad/Adrad <= 0.1") {
    score += 3;
  } else if (sofa.vasopressor === "Dopamine <= 5 or any Dobutamine") {
    score += 2;
  } else {
    // Check if MAP < 70
    const mapVal = parseFloat(sofa.map);
    if (!isNaN(mapVal) && mapVal < 70) {
      score += 1;
    }
  }

  // 5. CNS: Glasgow Coma Scale
  const gcsVal = parseInt(sofa.gcs);
  if (!isNaN(gcsVal)) {
    if (gcsVal < 6) score += 4;
    else if (gcsVal >= 6 && gcsVal <= 9) score += 3;
    else if (gcsVal >= 10 && gcsVal <= 12) score += 2;
    else if (gcsVal >= 13 && gcsVal <= 14) score += 1;
  }

  // 6. Renal: Creatinine
  const crVal = parseFloat(sofa.creatinine);
  if (!isNaN(crVal)) {
    if (crVal >= 5.0) score += 4;
    else if (crVal >= 3.5 && crVal < 5.0) score += 3;
    else if (crVal >= 2.0 && crVal < 3.5) score += 2;
    else if (crVal >= 1.2 && crVal < 2.0) score += 1;
  }

  return score.toString();
}

/**
 * Calculates infusion dosage in mcg/kg/min (or units/min for vasopressin).
 */
export function calculateInfusionDoseValue(
  name: string,
  amount: string,
  volume: string,
  rate: string,
  weight: string
): string {
  const amt = parseFloat(amount);
  const vol = parseFloat(volume);
  const rt = parseFloat(rate);
  const wt = parseFloat(weight);

  if (isNaN(amt) || isNaN(vol) || isNaN(rt) || vol <= 0 || rt <= 0) return "";

  if (name === "Vasopressin") {
    // Vasopressin is usually dosed in units/min (not weight-based)
    // Rate in mL/hr * Amount in units / (Volume in mL * 60)
    const uMin = (rt * amt) / (vol * 60);
    return `${uMin.toFixed(3)} units/min`;
  } else if (name === "Labetalol" || name === "Nicardipine" || name === "Diltiazem") {
    // Usually dosed in mg/hr (or mg/min)
    const mgHr = (rt * amt) / vol;
    const mgMin = mgHr / 60;
    return `${mgHr.toFixed(1)} mg/hr (${mgMin.toFixed(2)} mg/min)`;
  } else if (name === "Esmolol" || name === "Sodium Nitroprusside") {
    // Dosed in mcg/kg/min
    if (isNaN(wt) || wt <= 0) return "[Set Patient Weight]";
    const mcgKgMin = (rt * amt * 1000) / (vol * 60 * wt);
    return `${mcgKgMin.toFixed(1)} mcg/kg/min`;
  } else if (name === "Nitroglycerin (GTN)") {
    // Dosed in mcg/min (non-weight based) or weight-based mcg/kg/min
    const mcgMin = (rt * amt * 1000) / (vol * 60);
    if (!isNaN(wt) && wt > 0) {
      const mcgKgMin = mcgMin / wt;
      return `${mcgMin.toFixed(0)} mcg/min (${mcgKgMin.toFixed(2)} mcg/kg/min)`;
    }
    return `${mcgMin.toFixed(0)} mcg/min`;
  } else {
    // Norepinephrine, Adrenaline, Dobutamine, Dopamine, Milrinone in mcg/kg/min
    if (isNaN(wt) || wt <= 0) return "[Set Patient Weight]";
    const mcgKgMin = (rt * amt * 1000) / (vol * 60 * wt);
    return `${mcgKgMin.toFixed(3)} mcg/kg/min`;
  }
}

export default function PatientCalculators({
  calculators,
  infusions,
  patientWeight,
  onUpdateCalculators,
  onUpdateInfusions
}: PatientCalculatorsProps) {
  
  // 2. Local active states for New Infusion creation
  const [newInfName, setNewInfName] = useState<InfusionDrug["name"]>("Noradrenaline");
  const [newInfAmt, setNewInfAmt] = useState("4"); // mg (default for norad)
  const [newInfVol, setNewInfVol] = useState("50"); // ml (default for norad)
  const [newInfRate, setNewInfRate] = useState("5"); // ml/hr

  // New Systemwise ICU Calculator States
  const [calcSubTab, setCalcSubTab] = useState<"gcs" | "pf" | "severity" | "child_pugh" | "free_water">("gcs");

  // 1. GCS State
  const [gcsEyes, setGcsEyes] = useState<number>(4);
  const [gcsVerbal, setGcsVerbal] = useState<number>(5);
  const [gcsMotor, setGcsMotor] = useState<number>(6);

  // 2. Respiratory (ROX & P/F)
  const [respSpo2, setRespSpo2] = useState<string>("98");
  const [respFio2, setRespFio2] = useState<string>("40");
  const [respRr, setRespRr] = useState<string>("20");
  const [respPao2, setRespPao2] = useState<string>("85");

  // 3. Severity (qSOFA & CURB-65)
  const [qSbp, setQSbp] = useState<string>("100");
  const [qRr, setQRr] = useState<string>("22");
  const [qAltered, setQAltered] = useState<boolean>(false);

  const [curbC, setCurbC] = useState<boolean>(false);
  const [curbU, setCurbU] = useState<boolean>(false);
  const [curbR, setCurbR] = useState<boolean>(false);
  const [curbB, setCurbB] = useState<boolean>(false);
  const [curb65, setCurb65] = useState<boolean>(false);

  // 4. Child-Pugh
  const [cpBilirubin, setCpBilirubin] = useState<number>(1);
  const [cpAlbumin, setCpAlbumin] = useState<number>(1);
  const [cpInr, setCpInr] = useState<number>(1);
  const [cpAscites, setCpAscites] = useState<number>(1);
  const [cpEnceph, setCpEnceph] = useState<number>(1);

  // 5. Free Water Deficit
  const [fwWeight, setFwWeight] = useState<string>(calculators.weight || patientWeight || "70");
  const [fwSodium, setFwSodium] = useState<string>("155");
  const [fwTargetNa, setFwTargetNa] = useState<string>("140");
  const [fwGender, setFwGender] = useState<"Male" | "Female">(calculators.gender || "Male");

  // Auto-calculate outputs whenever calculators inputs change
  const handleChange = (field: string, value: string) => {
    const updated = { ...calculators };
    
    if (field.startsWith("sofa.")) {
      const sofaField = field.split(".")[1] as keyof CalculatorsData["sofa"];
      updated.sofa = { ...updated.sofa, [sofaField]: value };
      updated.sofa.score = calculateSOFAScore(updated.sofa);
    } else {
      const key = field as keyof Omit<CalculatorsData, "sofa">;
      if (key === "gender") {
        updated.gender = value as "Male" | "Female";
      } else {
        updated[key] = value;
      }
    }

    // Auto-update standard parameters
    updated.bmi = calculateBMI(updated.weight, updated.height);
    updated.crcl = calculateCrCl(updated.age, updated.weight, updated.creatinine, updated.gender);
    updated.correctedCalcium = calculateCorrectedCalcium(updated.calcium, updated.albumin);
    
    onUpdateCalculators(updated);
  };

  // Add a new active infusion
  const handleAddInfusion = () => {
    const calculated = calculateInfusionDoseValue(newInfName, newInfAmt, newInfVol, newInfRate, patientWeight || calculators.weight);
    const item: InfusionDrug = {
      id: Math.random().toString(36).substr(2, 9),
      name: newInfName,
      amount: newInfAmt,
      volume: newInfVol,
      rate: newInfRate,
      calculatedDose: calculated
    };
    onUpdateInfusions([...infusions, item]);
    
    // Reset defaults depending on selected drug
    setNewInfRate("5");
  };

  const handleRemoveInfusion = (id: string) => {
    onUpdateInfusions(infusions.filter(inf => inf.id !== id));
  };

  // Pre-load common dilutions for ease of selection
  useEffect(() => {
    if (newInfName === "Noradrenaline") {
      setNewInfAmt("4");
      setNewInfVol("50");
    } else if (newInfName === "Adrenaline") {
      setNewInfAmt("4");
      setNewInfVol("50");
    } else if (newInfName === "Vasopressin") {
      setNewInfAmt("40"); // 40 Units
      setNewInfVol("40"); // 40 mL
    } else if (newInfName === "Dobutamine") {
      setNewInfAmt("250");
      setNewInfVol("50");
    } else if (newInfName === "Dopamine") {
      setNewInfAmt("200");
      setNewInfVol("50");
    } else if (newInfName === "Milrinone") {
      setNewInfAmt("10");
      setNewInfVol("50");
    } else if (newInfName === "Sodium Nitroprusside") {
      setNewInfAmt("50");
      setNewInfVol("250");
    } else if (newInfName === "Nitroglycerin (GTN)") {
      setNewInfAmt("50");
      setNewInfVol("250");
    } else if (newInfName === "Labetalol") {
      setNewInfAmt("200");
      setNewInfVol("200");
    } else if (newInfName === "Nicardipine") {
      setNewInfAmt("25");
      setNewInfVol("240");
    } else if (newInfName === "Esmolol") {
      setNewInfAmt("2500");
      setNewInfVol("250");
    } else if (newInfName === "Diltiazem") {
      setNewInfAmt("125");
      setNewInfVol("125");
    }
  }, [newInfName]);

  // Recalculate all infusions if patient weight changes
  useEffect(() => {
    const updatedInfusions = infusions.map((inf) => {
      const calculated = calculateInfusionDoseValue(inf.name, inf.amount, inf.volume, inf.rate, patientWeight || calculators.weight);
      return { ...inf, calculatedDose: calculated };
    });
    // Check if anything actually changed to prevent infinite loops
    if (JSON.stringify(updatedInfusions) !== JSON.stringify(infusions)) {
      onUpdateInfusions(updatedInfusions);
    }
  }, [patientWeight, calculators.weight]);

  // Calculate drug dosing recommendations based on CrCl and Weight
  const crclVal = parseFloat(calculators.crcl);
  const wtVal = parseFloat(calculators.weight || patientWeight);

  const getGentamicinDose = () => {
    if (isNaN(wtVal) || wtVal <= 0) return "Provide patient weight to calculate dose.";
    if (isNaN(crclVal) || crclVal <= 0) return "Provide renal parameters (Creatinine) to calculate dose.";
    if (crclVal > 60) return `${(wtVal * 5).toFixed(0)} mg IV once daily (5 mg/kg)`;
    if (crclVal >= 30) return `${(wtVal * 3).toFixed(0)} mg IV once daily (3 mg/kg)`;
    return `${(wtVal * 2).toFixed(0)} mg IV every 24-48 hours (2 mg/kg, check troughs)`;
  };

  const getVancomycinDose = () => {
    if (isNaN(wtVal) || wtVal <= 0) return "Provide patient weight.";
    if (isNaN(crclVal) || crclVal <= 0) return "Provide renal parameters.";
    const standardDose = (wtVal * 15).toFixed(0);
    if (crclVal > 60) return `${standardDose} mg IV q12h (15 mg/kg)`;
    if (crclVal >= 30) return `${standardDose} mg IV q24h (15 mg/kg)`;
    return `${standardDose} mg IV once, then pulse dose based on therapeutic drug monitoring (CrCl < 30)`;
  };

  const getMeropenemDose = () => {
    if (isNaN(crclVal) || crclVal <= 0) return "Provide renal parameters.";
    if (crclVal > 50) return "1g IV q8h (Standard dose)";
    if (crclVal >= 25) return "1g IV q12h";
    if (crclVal >= 10) return "500mg IV q12h";
    return "500mg IV q24h";
  };

  const getPipTazoDose = () => {
    if (isNaN(crclVal) || crclVal <= 0) return "Provide renal parameters.";
    if (crclVal > 40) return "4.5g IV q6h (Standard dose over 4 hours)";
    if (crclVal >= 20) return "3.375g IV q6h";
    return "2.25g IV q6h";
  };

  const getEnoxaparinDose = () => {
    if (isNaN(wtVal) || wtVal <= 0) return "Provide patient weight.";
    if (isNaN(crclVal) || crclVal <= 0) return "Provide renal parameters.";
    const therapeutic = crclVal > 30 ? `Therapeutic: ${(wtVal * 1).toFixed(0)} mg SC q12h` : `Therapeutic: ${(wtVal * 1).toFixed(0)} mg SC q24h (Adjusted)`;
    const prophylaxis = crclVal > 30 ? "Prophylaxis: 40mg SC once daily" : "Prophylaxis: 30mg SC once daily";
    return `${prophylaxis} | ${therapeutic}`;
  };

  const getCefepimeDose = () => {
    if (isNaN(crclVal) || crclVal <= 0) return "Provide renal parameters.";
    if (crclVal > 50) return "2g IV q8h (Standard dose)";
    if (crclVal >= 30) return "2g IV q12h";
    if (crclVal >= 11) return "1g IV q12h";
    return "1g IV q24h";
  };

  const getCeftazidimeDose = () => {
    if (isNaN(crclVal) || crclVal <= 0) return "Provide renal parameters.";
    if (crclVal > 50) return "2g IV q8h (Standard dose)";
    if (crclVal >= 31) return "1g IV q12h";
    if (crclVal >= 16) return "1g IV q24h";
    if (crclVal >= 6) return "500mg IV q24h";
    return "250mg IV q24h";
  };

  const getFluconazoleDose = () => {
    if (isNaN(crclVal) || crclVal <= 0) return "Provide renal parameters.";
    if (crclVal > 50) return "400mg IV/PO loading, then 200-400mg daily";
    return "400mg loading, then 100-200mg daily (50% reduction)";
  };

  const getCiprofloxacinDose = () => {
    if (isNaN(crclVal) || crclVal <= 0) return "Provide renal parameters.";
    if (crclVal > 50) return "400mg IV q8-12h or 500-750mg PO q12h";
    if (crclVal >= 30) return "400mg IV q12h or 250-500mg PO q12h";
    return "400mg IV q18-24h or 250-500mg PO q24h";
  };

  const getColistinDose = () => {
    if (isNaN(wtVal) || wtVal <= 0) return "Provide patient weight.";
    if (isNaN(crclVal) || crclVal <= 0) return "Provide renal parameters.";
    if (crclVal > 50) return "9 MIU Loading, then 4.5 MIU IV q12h";
    if (crclVal >= 30) return "9 MIU Loading, then 3 MIU IV q12h";
    if (crclVal >= 10) return "9 MIU Loading, then 2-3 MIU IV q24h";
    return "9 MIU Loading, then 1-1.5 MIU IV q24h (check levels)";
  };

  const getLinezolidDose = () => {
    return "600mg IV/PO q12h [No renal adjustment required]";
  };

  const getCeftriaxoneDose = () => {
    return "1-2g IV q12-24h [No renal adjustment required]";
  };

  return (
    <div className="space-y-8">
      {/* SECTION 1: Integrated ICU Calculators */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Parameters Card */}
        <div className="bg-[#111111] border border-[#222222] p-6 rounded">
          <h3 className="font-serif text-base italic text-[#E0E0E0] flex items-center gap-2 border-b border-[#222222] pb-3 mb-4">
            <Calculator className="w-4 h-4 text-emerald-400" />
            Clinical Calculator Inputs
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1">Weight (kg)</label>
              <div className="flex gap-1.5 items-center">
                <input
                  type="number"
                  value={calculators.weight}
                  onChange={(e) => handleChange("weight", e.target.value)}
                  placeholder="e.g. 70"
                  className="flex-1 min-w-0 bg-[#1A1A1A] border border-[#222222] rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 font-sans"
                />
                <select
                  onChange={(e) => { if (e.target.value) handleChange("weight", e.target.value); }}
                  className="bg-[#111111] border border-[#222222] rounded px-1.5 py-1.5 text-[10px] text-zinc-400 focus:outline-none focus:border-emerald-500 w-14"
                  value=""
                >
                  <option value="">Fast</option>
                  {["50", "60", "70", "80", "90", "100", "110", "120"].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1">Height (cm)</label>
              <div className="flex gap-1.5 items-center">
                <input
                  type="number"
                  value={calculators.height}
                  onChange={(e) => handleChange("height", e.target.value)}
                  placeholder="e.g. 175"
                  className="flex-1 min-w-0 bg-[#1A1A1A] border border-[#222222] rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 font-sans"
                />
                <select
                  onChange={(e) => { if (e.target.value) handleChange("height", e.target.value); }}
                  className="bg-[#111111] border border-[#222222] rounded px-1.5 py-1.5 text-[10px] text-zinc-400 focus:outline-none focus:border-emerald-500 w-14"
                  value=""
                >
                  <option value="">Fast</option>
                  {["150", "160", "170", "180", "190"].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1">Age (Years)</label>
              <div className="flex gap-1.5 items-center">
                <input
                  type="number"
                  value={calculators.age}
                  onChange={(e) => handleChange("age", e.target.value)}
                  placeholder="e.g. 55"
                  className="flex-1 min-w-0 bg-[#1A1A1A] border border-[#222222] rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 font-sans"
                />
                <select
                  onChange={(e) => { if (e.target.value) handleChange("age", e.target.value); }}
                  className="bg-[#111111] border border-[#222222] rounded px-1.5 py-1.5 text-[10px] text-zinc-400 focus:outline-none focus:border-emerald-500 w-14"
                  value=""
                >
                  <option value="">Fast</option>
                  {["20", "30", "40", "50", "60", "70", "80", "90"].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1">Biological Gender</label>
              <select
                value={calculators.gender}
                onChange={(e) => handleChange("gender", e.target.value)}
                className="w-full bg-[#1A1A1A] border border-[#222222] rounded px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 h-[30px]"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1">Serum Creatinine (mg/dL)</label>
              <div className="flex gap-1.5 items-center">
                <input
                  type="number"
                  step="0.01"
                  value={calculators.creatinine}
                  onChange={(e) => handleChange("creatinine", e.target.value)}
                  placeholder="e.g. 1.1"
                  className="flex-1 min-w-0 bg-[#1A1A1A] border border-[#222222] rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 font-sans"
                />
                <select
                  onChange={(e) => { if (e.target.value) handleChange("creatinine", e.target.value); }}
                  className="bg-[#111111] border border-[#222222] rounded px-1.5 py-1.5 text-[10px] text-zinc-400 focus:outline-none focus:border-emerald-500 w-14"
                  value=""
                >
                  <option value="">Fast</option>
                  {["0.6", "0.8", "1.0", "1.2", "1.5", "2.0", "3.0", "4.0", "5.0"].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1">Serum Calcium (mg/dL)</label>
              <div className="flex gap-1.5 items-center">
                <input
                  type="number"
                  step="0.1"
                  value={calculators.calcium}
                  onChange={(e) => handleChange("calcium", e.target.value)}
                  placeholder="e.g. 8.2"
                  className="flex-1 min-w-0 bg-[#1A1A1A] border border-[#222222] rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 font-sans"
                />
                <select
                  onChange={(e) => { if (e.target.value) handleChange("calcium", e.target.value); }}
                  className="bg-[#111111] border border-[#222222] rounded px-1.5 py-1.5 text-[10px] text-zinc-400 focus:outline-none focus:border-emerald-500 w-14"
                  value=""
                >
                  <option value="">Fast</option>
                  {["7.0", "7.5", "8.0", "8.5", "9.0", "9.5", "10.0"].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1">Serum Albumin (g/dL)</label>
              <div className="flex gap-1.5 items-center">
                <input
                  type="number"
                  step="0.1"
                  value={calculators.albumin}
                  onChange={(e) => handleChange("albumin", e.target.value)}
                  placeholder="e.g. 3.0"
                  className="flex-1 min-w-0 bg-[#1A1A1A] border border-[#222222] rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 font-sans"
                />
                <select
                  onChange={(e) => { if (e.target.value) handleChange("albumin", e.target.value); }}
                  className="bg-[#111111] border border-[#222222] rounded px-1.5 py-1.5 text-[10px] text-zinc-400 focus:outline-none focus:border-emerald-500 w-14"
                  value=""
                >
                  <option value="">Fast</option>
                  {["1.5", "2.0", "2.5", "3.0", "3.5", "4.0", "4.5"].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Calculated Results Card */}
        <div className="bg-[#111111] border border-[#222222] p-6 rounded flex flex-col justify-between">
          <div>
            <h3 className="font-serif text-base italic text-[#E0E0E0] flex items-center gap-2 border-b border-[#222222] pb-3 mb-4">
              <Check className="w-4 h-4 text-emerald-400" />
              Auto-Calculated Output Parameters
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* BMI */}
              <div className="bg-[#1A1A1A] p-4 rounded border border-[#222222] text-center">
                <span className="block text-[10px] text-zinc-500 uppercase font-bold tracking-wider">BMI</span>
                <span className="block text-2xl font-bold text-emerald-500 mt-1">
                  {calculators.bmi ? `${calculators.bmi}` : "--"}
                </span>
                <span className="block text-[10px] text-zinc-650 mt-1">kg/m²</span>
              </div>

              {/* Creatinine Clearance */}
              <div className="bg-[#1A1A1A] p-4 rounded border border-[#222222] text-center">
                <span className="block text-[10px] text-zinc-500 uppercase font-bold tracking-wider">CrCl (CG)</span>
                <span className="block text-2xl font-bold text-emerald-500 mt-1">
                  {calculators.crcl ? `${calculators.crcl}` : "--"}
                </span>
                <span className="block text-[10px] text-zinc-650 mt-1">mL/min</span>
              </div>

              {/* Corrected Calcium */}
              <div className="bg-[#1A1A1A] p-4 rounded border border-[#222222] text-center">
                <span className="block text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Corr. Calcium</span>
                <span className="block text-2xl font-bold text-emerald-500 mt-1">
                  {calculators.correctedCalcium ? `${calculators.correctedCalcium}` : "--"}
                </span>
                <span className="block text-[10px] text-zinc-650 mt-1">mg/dL</span>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3.5 bg-[#1A1A1A] border border-[#222222] rounded text-xs text-zinc-400 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <p className="leading-relaxed font-sans">
              Creatinine Clearance is calculated using the <strong>Cockcroft-Gault Equation</strong>, adjusted for biological gender. Corrected Calcium adjusts measured calcium for hypoalbuminemia (assuming target albumin of 4.0 g/dL).
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 2: Dynamic Vasopressor, Inotropes, and Antihypertensive Infusion Calculator */}
      <div className="bg-[#111111] border border-[#222222] p-6 rounded">
        <div className="border-b border-[#222222] pb-3 mb-5">
          <h3 className="font-serif text-base italic text-[#E0E0E0] flex items-center gap-2">
            <Calculator className="w-4 h-4 text-emerald-400" />
            Vasopressor, Inotrope & Antihypertensive Infusion Dosage Calculator
          </h3>
          <p className="text-xs text-zinc-500 mt-1">
            Calculate accurate weight-based or rate-based infusion dosages in real time
          </p>
        </div>

        {/* Input Add Form */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 items-end bg-[#1A1A1A] p-4 rounded border border-[#222222] mb-6">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1">Drug Name</label>
            <select
              value={newInfName}
              onChange={(e) => setNewInfName(e.target.value as InfusionDrug["name"])}
              className="w-full bg-[#111111] border border-[#222222] rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
            >
              <optgroup label="Vasopressors & Inotropes">
                <option value="Noradrenaline">Noradrenaline</option>
                <option value="Adrenaline">Adrenaline</option>
                <option value="Vasopressin">Vasopressin</option>
                <option value="Dobutamine">Dobutamine</option>
                <option value="Dopamine">Dopamine</option>
                <option value="Milrinone">Milrinone</option>
              </optgroup>
              <optgroup label="Antihypertensives & Vasodilators">
                <option value="Sodium Nitroprusside">Sodium Nitroprusside</option>
                <option value="Nitroglycerin (GTN)">Nitroglycerin (GTN)</option>
                <option value="Labetalol">Labetalol</option>
                <option value="Nicardipine">Nicardipine</option>
                <option value="Esmolol">Esmolol</option>
                <option value="Diltiazem">Diltiazem</option>
              </optgroup>
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1">
              Amount ({newInfName === "Vasopressin" ? "Units" : "mg"})
            </label>
            <input
              type="number"
              value={newInfAmt}
              onChange={(e) => setNewInfAmt(e.target.value)}
              placeholder="4"
              className="w-full bg-[#111111] border border-[#222222] rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 font-sans"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1">Diluent Vol (mL)</label>
            <input
              type="number"
              value={newInfVol}
              onChange={(e) => setNewInfVol(e.target.value)}
              placeholder="50"
              className="w-full bg-[#111111] border border-[#222222] rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 font-sans"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1">Rate (mL/hr)</label>
            <input
              type="number"
              value={newInfRate}
              onChange={(e) => setNewInfRate(e.target.value)}
              placeholder="5"
              className="w-full bg-[#111111] border border-[#222222] rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 font-sans"
            />
          </div>

          <button
            type="button"
            onClick={handleAddInfusion}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-wider py-1.5 rounded transition-colors text-xs flex items-center justify-center gap-1.5 shadow-lg"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Infusion
          </button>
        </div>

        {/* Active Infusions List */}
        {infusions.length === 0 ? (
          <div className="text-center p-6 bg-[#1A1A1A] rounded border border-dashed border-[#222222] text-zinc-500 text-xs font-sans">
            No active vasopressor or inotrope infusions currently registered for this patient.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#222222] text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Active Drug</th>
                  <th className="py-2.5 px-3">Dilution Mix</th>
                  <th className="py-2.5 px-3">Infusion Rate</th>
                  <th className="py-2.5 px-3">Calculated Dosage</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222222]/60">
                {infusions.map((inf) => (
                  <tr key={inf.id} className="hover:bg-[#1A1A1A]/30 text-zinc-200">
                    <td className="py-3 px-3 font-bold text-emerald-500">{inf.name}</td>
                    <td className="py-3 px-3">
                      {inf.amount} {inf.name === "Vasopressin" ? "Units" : "mg"} in {inf.volume} mL
                    </td>
                    <td className="py-3 px-3 font-mono">{inf.rate} mL/hr</td>
                    <td className="py-3 px-3">
                      <span className="bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono px-2 py-1 rounded">
                        {inf.calculatedDose}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => handleRemoveInfusion(inf.id)}
                        className="text-red-400 hover:text-red-300 p-1.5 transition-colors"
                        title="Remove infusion"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 3: Weight and Renal Adjusted Drug Dosage Advisor */}
      <div className="bg-[#111111] border border-[#222222] p-6 rounded">
        <div className="border-b border-[#222222] pb-3 mb-5">
          <h3 className="font-serif text-base italic text-[#E0E0E0] flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-emerald-400" />
            Renal & Weight Adjusted Drug Dosage Advisor (ICU Clinical Guide)
          </h3>
          <p className="text-xs text-zinc-500 mt-1">
            Calculated recommendations for high-risk ICU medications adjusted according to current patient weight ({patientWeight || calculators.weight || "--"} kg) and Cockcroft-Gault Creatinine Clearance ({calculators.crcl || "--"} mL/min).
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Gentamicin */}
          <div className="bg-[#1A1A1A] border border-[#222222] p-4 rounded flex flex-col justify-between gap-2.5">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-zinc-200">Gentamicin</span>
                <span className="text-[9px] bg-indigo-950 text-indigo-400 border border-indigo-900 px-2 py-0.5 rounded font-mono uppercase">Aminoglycoside</span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-1 font-sans leading-relaxed">Adjusted Daily Dosing based on once-daily extended interval guidelines.</p>
            </div>
            <div className="bg-[#111111] border border-[#222222]/80 rounded p-2 text-xs font-mono text-emerald-400 text-center">
              {getGentamicinDose()}
            </div>
          </div>

          {/* Vancomycin */}
          <div className="bg-[#1A1A1A] border border-[#222222] p-4 rounded flex flex-col justify-between gap-2.5">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-zinc-200">Vancomycin</span>
                <span className="text-[9px] bg-red-950 text-red-400 border border-red-900 px-2 py-0.5 rounded font-mono uppercase">Glycopeptide</span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-1 font-sans leading-relaxed">Trough-guided or AUC/MIC dosing guide, adjusted for clearance.</p>
            </div>
            <div className="bg-[#111111] border border-[#222222]/80 rounded p-2 text-xs font-mono text-emerald-400 text-center">
              {getVancomycinDose()}
            </div>
          </div>

          {/* Meropenem */}
          <div className="bg-[#1A1A1A] border border-[#222222] p-4 rounded flex flex-col justify-between gap-2.5">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-zinc-200">Meropenem</span>
                <span className="text-[9px] bg-amber-950 text-amber-400 border border-amber-900 px-2 py-0.5 rounded font-mono uppercase">Carbapenem</span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-1 font-sans leading-relaxed">Critically adjusted for GFR/CrCl values to prevent neurological toxicity.</p>
            </div>
            <div className="bg-[#111111] border border-[#222222]/80 rounded p-2 text-xs font-mono text-emerald-400 text-center">
              {getMeropenemDose()}
            </div>
          </div>

          {/* Piperacillin/Tazobactam */}
          <div className="bg-[#1A1A1A] border border-[#222222] p-4 rounded flex flex-col justify-between gap-2.5">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-zinc-200">Piperacillin / Tazobactam</span>
                <span className="text-[9px] bg-cyan-950 text-cyan-400 border border-cyan-900 px-2 py-0.5 rounded font-mono uppercase">Penicillin + Inhibitor</span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-1 font-sans leading-relaxed">Broad-spectrum dosing adjusted to prevent accumulation & bone marrow issues.</p>
            </div>
            <div className="bg-[#111111] border border-[#222222]/80 rounded p-2 text-xs font-mono text-emerald-400 text-center">
              {getPipTazoDose()}
            </div>
          </div>

          {/* Cefepime */}
          <div className="bg-[#1A1A1A] border border-[#222222] p-4 rounded flex flex-col justify-between gap-2.5">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-zinc-200">Cefepime</span>
                <span className="text-[9px] bg-purple-950 text-purple-400 border border-purple-900 px-2 py-0.5 rounded font-mono uppercase">4th-Gen Cephalosporin</span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-1 font-sans leading-relaxed">Anti-pseudomonal coverage. Requires strict adjustment to prevent neurotoxicity/seizures.</p>
            </div>
            <div className="bg-[#111111] border border-[#222222]/80 rounded p-2 text-xs font-mono text-emerald-400 text-center">
              {getCefepimeDose()}
            </div>
          </div>

          {/* Ceftazidime */}
          <div className="bg-[#1A1A1A] border border-[#222222] p-4 rounded flex flex-col justify-between gap-2.5">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-zinc-200">Ceftazidime</span>
                <span className="text-[9px] bg-purple-950 text-purple-400 border border-purple-900 px-2 py-0.5 rounded font-mono uppercase">3rd-Gen Cephalosporin</span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-1 font-sans leading-relaxed">Anti-pseudomonal. Dosage adjusted step-by-step for kidney clearance.</p>
            </div>
            <div className="bg-[#111111] border border-[#222222]/80 rounded p-2 text-xs font-mono text-emerald-400 text-center">
              {getCeftazidimeDose()}
            </div>
          </div>

          {/* Ciprofloxacin */}
          <div className="bg-[#1A1A1A] border border-[#222222] p-4 rounded flex flex-col justify-between gap-2.5">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-zinc-200">Ciprofloxacin</span>
                <span className="text-[9px] bg-orange-950 text-orange-400 border border-orange-900 px-2 py-0.5 rounded font-mono uppercase">Fluoroquinolone</span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-1 font-sans leading-relaxed">Commonly adjusted for high urinary excretion and systemic safety.</p>
            </div>
            <div className="bg-[#111111] border border-[#222222]/80 rounded p-2 text-xs font-mono text-emerald-400 text-center">
              {getCiprofloxacinDose()}
            </div>
          </div>

          {/* Colistin */}
          <div className="bg-[#1A1A1A] border border-[#222222] p-4 rounded flex flex-col justify-between gap-2.5">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-zinc-200">Colistin (CMS)</span>
                <span className="text-[9px] bg-rose-950 text-rose-400 border border-rose-900 px-2 py-0.5 rounded font-mono uppercase">Polymyxin</span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-1 font-sans leading-relaxed">High-risk MDR coverage. Needs careful adjustment to avoid acute tubular necrosis.</p>
            </div>
            <div className="bg-[#111111] border border-[#222222]/80 rounded p-2 text-xs font-mono text-emerald-400 text-center">
              {getColistinDose()}
            </div>
          </div>

          {/* Fluconazole */}
          <div className="bg-[#1A1A1A] border border-[#222222] p-4 rounded flex flex-col justify-between gap-2.5">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-zinc-200">Fluconazole</span>
                <span className="text-[9px] bg-pink-950 text-pink-400 border border-pink-900 px-2 py-0.5 rounded font-mono uppercase">Antifungal</span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-1 font-sans leading-relaxed">Reduce maintenance dose by 50% for CrCl &le; 50 mL/min.</p>
            </div>
            <div className="bg-[#111111] border border-[#222222]/80 rounded p-2 text-xs font-mono text-emerald-400 text-center">
              {getFluconazoleDose()}
            </div>
          </div>

          {/* Enoxaparin */}
          <div className="bg-[#1A1A1A] border border-[#222222] p-4 rounded flex flex-col justify-between gap-2.5">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-zinc-200">Enoxaparin (LMWH)</span>
                <span className="text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-900 px-2 py-0.5 rounded font-mono uppercase">Anticoagulant</span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-1 font-sans leading-relaxed">Subcutaneous prophylaxis & therapeutic dosing clearance guide.</p>
            </div>
            <div className="bg-[#111111] border border-[#222222]/80 rounded p-2 text-xs font-mono text-emerald-400 text-center">
              {getEnoxaparinDose()}
            </div>
          </div>

          {/* Ceftriaxone */}
          <div className="bg-[#1A1A1A] border border-[#222222] p-4 rounded flex flex-col justify-between gap-2.5">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-zinc-200">Ceftriaxone</span>
                <span className="text-[9px] bg-zinc-800 text-zinc-300 border border-zinc-700 px-2 py-0.5 rounded font-mono uppercase">3rd-Gen Cephalosporin</span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-1 font-sans leading-relaxed">Dual elimination (renal & biliary). Perfect for septic patients with AKI.</p>
            </div>
            <div className="bg-emerald-950/20 border border-emerald-900/40 rounded p-2 text-xs font-mono text-emerald-400 text-center">
              {getCeftriaxoneDose()}
            </div>
          </div>

          {/* Linezolid */}
          <div className="bg-[#1A1A1A] border border-[#222222] p-4 rounded flex flex-col justify-between gap-2.5">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-zinc-200">Linezolid</span>
                <span className="text-[9px] bg-zinc-800 text-zinc-300 border border-zinc-700 px-2 py-0.5 rounded font-mono uppercase">Oxazolidinone</span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-1 font-sans leading-relaxed">Non-renal metabolism. Highly effective against MRSA/VRE in renal failure.</p>
            </div>
            <div className="bg-emerald-950/20 border border-emerald-900/40 rounded p-2 text-xs font-mono text-emerald-400 text-center">
              {getLinezolidDose()}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 4: Interactive SOFA Score Calculator */}
      <div className="bg-[#111111] border border-[#222222] p-6 rounded">
        <div className="border-b border-[#222222] pb-3 mb-5 flex justify-between items-center">
          <div>
            <h3 className="font-serif text-base italic text-[#E0E0E0] flex items-center gap-2">
              <Calculator className="w-4 h-4 text-emerald-400" />
              Interactive Sequential Organ Failure Assessment (SOFA) Score
            </h3>
            <p className="text-xs text-zinc-500 mt-1">
              Provides an assessment of the patient's severity of organ dysfunction (Score: 0 to 24)
            </p>
          </div>
          <div className="bg-emerald-950/20 border border-emerald-500/30 text-emerald-500 px-4 py-2 rounded text-center shadow-lg">
            <span className="block text-[9px] text-zinc-500 uppercase tracking-widest font-bold">SOFA Score</span>
            <span className="text-3xl font-black">{calculators.sofa?.score || "0"}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Respiratory */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1">PaO2 (mmHg)</label>
            <div className="flex gap-1.5 items-center">
              <input
                type="number"
                value={calculators.sofa?.pao2 || ""}
                onChange={(e) => handleChange("sofa.pao2", e.target.value)}
                placeholder="e.g. 85"
                className="flex-1 min-w-0 bg-[#111111] border border-[#222222] rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 font-sans"
              />
              <select
                onChange={(e) => { if (e.target.value) handleChange("sofa.pao2", e.target.value); }}
                className="bg-[#111111] border border-[#222222] rounded px-1.5 py-1.5 text-[10px] text-zinc-400 focus:outline-none focus:border-emerald-500 w-14"
                value=""
              >
                <option value="">Fast</option>
                {["50", "60", "70", "80", "90", "100", "150", "200"].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider mt-3 mb-1">FiO2 (%)</label>
            <div className="flex gap-1.5 items-center">
              <input
                type="number"
                value={calculators.sofa?.fio2Percent || ""}
                onChange={(e) => handleChange("sofa.fio2Percent", e.target.value)}
                placeholder="e.g. 40"
                className="flex-1 min-w-0 bg-[#111111] border border-[#222222] rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 font-sans"
              />
              <select
                onChange={(e) => { if (e.target.value) handleChange("sofa.fio2Percent", e.target.value); }}
                className="bg-[#111111] border border-[#222222] rounded px-1.5 py-1.5 text-[10px] text-zinc-400 focus:outline-none focus:border-emerald-500 w-14"
                value=""
              >
                <option value="">Fast</option>
                {["21", "30", "40", "50", "60", "70", "80", "100"].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>

          {/* Heme & Liver */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1">Platelets (x10³/μL)</label>
            <div className="flex gap-1.5 items-center">
              <input
                type="number"
                value={calculators.sofa?.platelets || ""}
                onChange={(e) => handleChange("sofa.platelets", e.target.value)}
                placeholder="e.g. 120"
                className="flex-1 min-w-0 bg-[#111111] border border-[#222222] rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 font-sans"
              />
              <select
                onChange={(e) => { if (e.target.value) handleChange("sofa.platelets", e.target.value); }}
                className="bg-[#111111] border border-[#222222] rounded px-1.5 py-1.5 text-[10px] text-zinc-400 focus:outline-none focus:border-emerald-500 w-14"
                value=""
              >
                <option value="">Fast</option>
                {["15", "45", "85", "125", "175", "250", "350"].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider mt-3 mb-1">Bilirubin (mg/dL)</label>
            <div className="flex gap-1.5 items-center">
              <input
                type="number"
                step="0.1"
                value={calculators.sofa?.bilirubin || ""}
                onChange={(e) => handleChange("sofa.bilirubin", e.target.value)}
                placeholder="e.g. 1.0"
                className="flex-1 min-w-0 bg-[#111111] border border-[#222222] rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 font-sans"
              />
              <select
                onChange={(e) => { if (e.target.value) handleChange("sofa.bilirubin", e.target.value); }}
                className="bg-[#111111] border border-[#222222] rounded px-1.5 py-1.5 text-[10px] text-zinc-400 focus:outline-none focus:border-emerald-500 w-14"
                value=""
              >
                <option value="">Fast</option>
                {["0.5", "1.0", "1.5", "2.5", "5.0", "8.0", "15.0"].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>

          {/* Neuro & Renal */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1">Glasgow Coma Scale (GCS)</label>
            <select
              value={calculators.sofa?.gcs || "15"}
              onChange={(e) => handleChange("sofa.gcs", e.target.value)}
              className="w-full bg-[#111111] border border-[#222222] rounded px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 font-sans h-[30px]"
            >
              {[15,14,13,12,11,10,9,8,7,6,5,4,3].map(v => (
                <option key={v} value={v}>{v} / 15</option>
              ))}
            </select>

            <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider mt-3 mb-1">Mean Arterial Pres (MAP)</label>
            <div className="flex gap-1.5 items-center">
              <input
                type="number"
                value={calculators.sofa?.map || ""}
                onChange={(e) => handleChange("sofa.map", e.target.value)}
                placeholder="e.g. 68"
                className="flex-1 min-w-0 bg-[#111111] border border-[#222222] rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 font-sans"
              />
              <select
                onChange={(e) => { if (e.target.value) handleChange("sofa.map", e.target.value); }}
                className="bg-[#111111] border border-[#222222] rounded px-1.5 py-1.5 text-[10px] text-zinc-400 focus:outline-none focus:border-emerald-500 w-14"
                value=""
              >
                <option value="">Fast</option>
                {["55", "60", "65", "70", "75", "80", "90", "100"].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>

          {/* Vasopressor state (Crucial for SOFA cardiovas) */}
          <div className="col-span-1 md:col-span-3">
            <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1.5">Cardiovascular Handoff Vasopressor Dose</label>
            <select
              value={calculators.sofa?.vasopressor || "None"}
              onChange={(e) => handleChange("sofa.vasopressor", e.target.value)}
              className="w-full bg-[#111111] border border-[#222222] rounded px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 font-sans"
            >
              <option value="None">None (Stable MAP &gt;= 70 mmHg)</option>
              <option value="Dopamine <= 5 or any Dobutamine">Dopamine &lt;= 5 mcg/kg/min or ANY dose of Dobutamine / Milrinone</option>
              <option value="Dopamine > 5 or Norad/Adrad <= 0.1">Dopamine &gt; 5 or Noradrenaline / Adrenaline &lt;= 0.1 mcg/kg/min</option>
              <option value="Dopamine > 15 or Norad/Adrad > 0.1">Dopamine &gt; 15 or Noradrenaline / Adrenaline &gt; 0.1 mcg/kg/min</option>
            </select>
          </div>
        </div>
      </div>

      {/* SECTION 5: System-wise Critical Care Calculators Grid */}
      <div className="bg-[#111111] border border-[#222222] p-6 rounded space-y-6">
        <div className="border-b border-[#222222] pb-3">
          <h3 className="font-serif text-base italic text-[#E0E0E0] flex items-center gap-2">
            <Calculator className="w-4 h-4 text-emerald-400" />
            Systemwise Critical Care Calculators
          </h3>
          <p className="text-xs text-zinc-500 mt-1">
            Access targeted calculators for neurology, respiratory, clinical severity, hepatobiliary, and fluid balance
          </p>
        </div>

        {/* Sub-tabs Navigation */}
        <div className="flex border-b border-[#222222] overflow-x-auto pb-px gap-2 scrollbar-none">
          {[
            { id: "gcs", label: "Neurology (GCS)" },
            { id: "pf", label: "Respiratory (P/F & ROX)" },
            { id: "severity", label: "Severity (qSOFA / CURB)" },
            { id: "child_pugh", label: "Liver (Child-Pugh)" },
            { id: "free_water", label: "Fluids (Free Water Deficit)" }
          ].map((subTab) => {
            const isSel = calcSubTab === subTab.id;
            return (
              <button
                key={subTab.id}
                type="button"
                onClick={() => setCalcSubTab(subTab.id as any)}
                className={`py-2 px-3 text-[11px] font-bold uppercase tracking-wider border-b-2 whitespace-nowrap transition-all ${
                  isSel
                    ? "border-emerald-500 text-emerald-400 bg-emerald-950/15"
                    : "border-transparent text-zinc-500 hover:text-zinc-350 hover:bg-[#161616]"
                }`}
              >
                {subTab.label}
              </button>
            );
          })}
        </div>

        {/* Sub-tab Contents */}
        <div className="pt-2">
          {/* Sub-tab 1: GCS */}
          {calcSubTab === "gcs" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-4 md:col-span-2">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-2">Eye Opening Response (E)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    {[
                      { val: 4, label: "4 - Spontaneous" },
                      { val: 3, label: "3 - To sound" },
                      { val: 2, label: "2 - To pressure" },
                      { val: 1, label: "1 - None" }
                    ].map(item => (
                      <button
                        key={item.val}
                        type="button"
                        onClick={() => setGcsEyes(item.val)}
                        className={`p-2 rounded text-xs text-left border transition-all ${
                          gcsEyes === item.val
                            ? "bg-emerald-950/40 border-emerald-500 text-emerald-300"
                            : "bg-[#161616] border-[#222222] text-zinc-400 hover:bg-zinc-900"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-2">Verbal Response (V)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                    {[
                      { val: 5, label: "5 - Oriented" },
                      { val: 4, label: "4 - Confused" },
                      { val: 3, label: "3 - Inappropriate" },
                      { val: 2, label: "2 - Incomprehensible" },
                      { val: 1, label: "1 - None" }
                    ].map(item => (
                      <button
                        key={item.val}
                        type="button"
                        onClick={() => setGcsVerbal(item.val)}
                        className={`p-2 rounded text-xs text-left border transition-all ${
                          gcsVerbal === item.val
                            ? "bg-emerald-950/40 border-emerald-500 text-emerald-300"
                            : "bg-[#161616] border-[#222222] text-zinc-400 hover:bg-zinc-900"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-2">Motor Response (M)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { val: 6, label: "6 - Obeys commands" },
                      { val: 5, label: "5 - Localizes pain" },
                      { val: 4, label: "4 - Normal flexion (withdrawal)" },
                      { val: 3, label: "3 - Abnormal flexion (decorticate)" },
                      { val: 2, label: "2 - Extension (decerebrate)" },
                      { val: 1, label: "1 - None" }
                    ].map(item => (
                      <button
                        key={item.val}
                        type="button"
                        onClick={() => setGcsMotor(item.val)}
                        className={`p-2 rounded text-xs text-left border transition-all ${
                          gcsMotor === item.val
                            ? "bg-emerald-950/40 border-emerald-500 text-emerald-300"
                            : "bg-[#161616] border-[#222222] text-zinc-400 hover:bg-zinc-900"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-[#161616] border border-[#222222] p-5 rounded flex flex-col justify-between">
                <div className="text-center space-y-2">
                  <span className="block text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Glasgow Coma Scale</span>
                  <div className="text-4xl font-black text-emerald-400 font-mono">
                    {gcsEyes + gcsVerbal + gcsMotor} <span className="text-xs text-zinc-500">/ 15</span>
                  </div>
                  <div className="text-[10px] font-mono text-zinc-400 mt-1">
                    E{gcsEyes} V{gcsVerbal} M{gcsMotor}
                  </div>
                  <span className={`inline-block px-3 py-1 rounded text-xs font-bold uppercase tracking-wider mt-2 ${
                    (gcsEyes + gcsVerbal + gcsMotor) >= 13
                      ? "bg-emerald-950/30 border border-emerald-900 text-emerald-400"
                      : (gcsEyes + gcsVerbal + gcsMotor) >= 9
                      ? "bg-amber-950/30 border border-amber-900 text-amber-400"
                      : "bg-rose-950/30 border border-rose-900 text-rose-400"
                  }`}>
                    {(gcsEyes + gcsVerbal + gcsMotor) >= 13 ? "Mild Brain Injury" : (gcsEyes + gcsVerbal + gcsMotor) >= 9 ? "Moderate Brain Injury" : "Severe Injury (GCS < 9: INTUBATE)"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleChange("sofa.gcs", (gcsEyes + gcsVerbal + gcsMotor).toString());
                    alert(`GCS score of ${gcsEyes + gcsVerbal + gcsMotor} synchronized to Patient's SOFA calculator inputs!`);
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold uppercase text-[10px] py-2 rounded transition-colors tracking-wide mt-4 cursor-pointer"
                >
                  Apply to Patient's SOFA GCS
                </button>
              </div>
            </div>
          )}

          {/* Sub-tab 2: Respiratory (P/F & ROX) */}
          {calcSubTab === "pf" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* P/F Ratio Calculator */}
              <div className="bg-[#161616] border border-[#222222] p-5 rounded space-y-4 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs uppercase font-bold text-emerald-500 tracking-wider border-b border-[#222222] pb-1.5 mb-3">PaO2 / FiO2 Ratio</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] uppercase font-bold text-zinc-500 tracking-wider mb-1">PaO2 (mmHg)</label>
                      <input
                        type="number"
                        value={respPao2}
                        onChange={(e) => setRespPao2(e.target.value)}
                        className="w-full bg-[#111111] border border-[#222222] rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase font-bold text-zinc-500 tracking-wider mb-1">FiO2 (21-100%)</label>
                      <input
                        type="number"
                        value={respFio2}
                        onChange={(e) => setRespFio2(e.target.value)}
                        className="w-full bg-[#111111] border border-[#222222] rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
                
                {(() => {
                  const po = parseFloat(respPao2);
                  const fi = parseFloat(respFio2) / 100;
                  const ratio = !isNaN(po) && !isNaN(fi) && fi > 0 ? po / fi : null;
                  let classification = "Incomplete Inputs";
                  let classColor = "text-zinc-500";
                  if (ratio !== null) {
                    if (ratio < 100) { classification = "Severe ARDS"; classColor = "text-rose-400"; }
                    else if (ratio < 200) { classification = "Moderate ARDS"; classColor = "text-rose-300"; }
                    else if (ratio < 300) { classification = "Mild ARDS"; classColor = "text-amber-400"; }
                    else { classification = "Normal / No ARDS"; classColor = "text-emerald-400"; }
                  }
                  return (
                    <div className="pt-4 border-t border-[#222222]/80 flex items-center justify-between">
                      <div>
                        <span className="block text-[10px] text-zinc-500 uppercase tracking-wider font-bold">P/F Ratio</span>
                        <span className="text-2xl font-black text-zinc-100 font-mono">
                          {ratio !== null ? ratio.toFixed(0) : "--"}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="block text-[10px] text-zinc-500 uppercase tracking-wider font-bold">ARDS Class</span>
                        <span className={`text-xs font-bold uppercase tracking-wider ${classColor}`}>
                          {classification}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* ROX Index Calculator */}
              <div className="bg-[#161616] border border-[#222222] p-5 rounded space-y-4 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs uppercase font-bold text-emerald-500 tracking-wider border-b border-[#222222] pb-1.5 mb-3">ROX Index (HFNC Success Estimator)</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[9px] uppercase font-bold text-zinc-500 tracking-wider mb-1">SpO2 (%)</label>
                      <input
                        type="number"
                        value={respSpo2}
                        onChange={(e) => setRespSpo2(e.target.value)}
                        className="w-full bg-[#111111] border border-[#222222] rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase font-bold text-zinc-500 tracking-wider mb-1">FiO2 (21-100%)</label>
                      <input
                        type="number"
                        value={respFio2}
                        onChange={(e) => setRespFio2(e.target.value)}
                        className="w-full bg-[#111111] border border-[#222222] rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase font-bold text-zinc-500 tracking-wider mb-1">Resp Rate (RR)</label>
                      <input
                        type="number"
                        value={respRr}
                        onChange={(e) => setRespRr(e.target.value)}
                        className="w-full bg-[#111111] border border-[#222222] rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {(() => {
                  const sp = parseFloat(respSpo2);
                  const fi = parseFloat(respFio2) / 100;
                  const rr = parseFloat(respRr);
                  const rox = !isNaN(sp) && !isNaN(fi) && !isNaN(rr) && fi > 0 && rr > 0 ? (sp / fi) / rr : null;
                  let interpretation = "Incomplete Inputs";
                  let color = "text-zinc-500";
                  if (rox !== null) {
                    if (rox >= 4.88) { interpretation = "Low Risk of HFNC Failure"; color = "text-emerald-400"; }
                    else if (rox < 3.85) { interpretation = "High Failure Risk! Consider Intubating"; color = "text-rose-400"; }
                    else { interpretation = "Grey Zone (Monitor very closely)"; color = "text-amber-400"; }
                  }
                  return (
                    <div className="pt-4 border-t border-[#222222]/80 flex items-center justify-between">
                      <div>
                        <span className="block text-[10px] text-zinc-500 uppercase tracking-wider font-bold">ROX Index</span>
                        <span className="text-2xl font-black text-zinc-100 font-mono">
                          {rox !== null ? rox.toFixed(2) : "--"}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="block text-[10px] text-zinc-500 uppercase tracking-wider font-bold">HFNC Prognosis</span>
                        <span className={`text-xs font-bold uppercase tracking-wider ${color}`}>
                          {interpretation}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Sub-tab 3: Severity (qSOFA & CURB-65) */}
          {calcSubTab === "severity" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* qSOFA Score */}
              <div className="bg-[#161616] border border-[#222222] p-5 rounded space-y-4 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs uppercase font-bold text-emerald-500 tracking-wider border-b border-[#222222] pb-1.5 mb-3">Quick SOFA (qSOFA)</h4>
                  <div className="space-y-2">
                    {[
                      { state: parseFloat(qRr) >= 22, label: "Tachypnea (Respiratory Rate >= 22/min)", desc: "Calculated from RR: " + qRr },
                      { state: parseFloat(qSbp) <= 100, label: "Hypotension (Systolic BP <= 100 mmHg)", desc: "Calculated from BP: " + qSbp },
                      { state: qAltered, toggle: () => setQAltered(!qAltered), label: "Altered Mentation (GCS < 15)", desc: "Click to toggle" }
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded bg-[#111111] border border-[#222222]/80">
                        <div>
                          <span className="block text-xs text-zinc-200">{item.label}</span>
                          <span className="text-[9px] text-zinc-500">{item.desc}</span>
                        </div>
                        {item.toggle ? (
                          <input
                            type="checkbox"
                            checked={item.state}
                            onChange={item.toggle}
                            className="w-4 h-4 text-emerald-500 bg-[#1A1A1A] border-[#222222] rounded focus:ring-emerald-500 cursor-pointer"
                          />
                        ) : (
                          <span className={`text-xs font-mono font-bold ${item.state ? "text-amber-400" : "text-zinc-600"}`}>
                            {item.state ? "+1 Point" : "0 Points"}
                          </span>
                        )}
                      </div>
                    ))}
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <input
                        type="number"
                        placeholder="Sys BP"
                        value={qSbp}
                        onChange={(e) => setQSbp(e.target.value)}
                        className="bg-[#111111] border border-[#222222] rounded p-1 text-center text-xs text-[#E0E0E0] placeholder:text-zinc-700"
                      />
                      <input
                        type="number"
                        placeholder="Resp Rate"
                        value={qRr}
                        onChange={(e) => setQRr(e.target.value)}
                        className="bg-[#111111] border border-[#222222] rounded p-1 text-center text-xs text-[#E0E0E0] placeholder:text-zinc-700"
                      />
                    </div>
                  </div>
                </div>

                {(() => {
                  const ptSbp = parseFloat(qSbp) <= 100 ? 1 : 0;
                  const ptRr = parseFloat(qRr) >= 22 ? 1 : 0;
                  const ptAlt = qAltered ? 1 : 0;
                  const total = ptSbp + ptRr + ptAlt;
                  return (
                    <div className="pt-4 border-t border-[#222222]/80 flex items-center justify-between">
                      <div>
                        <span className="block text-[10px] text-zinc-500 uppercase tracking-wider font-bold">qSOFA Score</span>
                        <span className="text-2xl font-black text-zinc-100 font-mono">
                          {total} <span className="text-xs text-zinc-500">/ 3</span>
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="block text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Mortality Risk</span>
                        <span className={`text-xs font-bold uppercase tracking-wider ${total >= 2 ? "text-rose-400" : "text-emerald-400"}`}>
                          {total >= 2 ? "High Risk (In-hospital mortality >= 10%)" : "Lower Risk"}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* CURB-65 Score */}
              <div className="bg-[#161616] border border-[#222222] p-5 rounded space-y-4 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs uppercase font-bold text-emerald-500 tracking-wider border-b border-[#222222] pb-1.5 mb-3">CURB-65 Pneumonia Severity</h4>
                  <div className="space-y-2">
                    {[
                      { state: curbC, setter: setCurbC, label: "C - Confusion", desc: "Altered orientation to person, place, or time" },
                      { state: curbU, setter: setCurbU, label: "U - Urea > 19 mg/dL (>7 mmol/L)", desc: "Elevated blood urea nitrogen" },
                      { state: curbR, setter: setCurbR, label: "R - Respiratory Rate >= 30/min", desc: "Significant tachypnea" },
                      { state: curbB, setter: setCurbB, label: "B - Blood Pressure (Sys < 90 or Dia <= 60)", desc: "Hemodynamic hypotension" },
                      { state: curb65, setter: setCurb65, label: "65 - Age >= 65 Years", desc: "Elderly age factor" }
                    ].map((item, idx) => (
                      <label key={idx} className="flex items-center justify-between p-1.5 rounded bg-[#111111] border border-[#222222]/80 cursor-pointer">
                        <div>
                          <span className="block text-xs text-zinc-200">{item.label}</span>
                          <span className="text-[9px] text-zinc-500">{item.desc}</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={item.state}
                          onChange={(e) => item.setter(e.target.checked)}
                          className="w-4 h-4 text-emerald-500 bg-[#1A1A1A] border-[#222222] rounded focus:ring-emerald-500 cursor-pointer"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                {(() => {
                  const total = (curbC ? 1 : 0) + (curbU ? 1 : 0) + (curbR ? 1 : 0) + (curbB ? 1 : 0) + (curb65 ? 1 : 0);
                  let risk = "Low Risk (0.6% mortality)";
                  let color = "text-emerald-400";
                  if (total >= 3) { risk = "Severe Risk (15-22% mortality - ICU!)"; color = "text-rose-400"; }
                  else if (total === 2) { risk = "Moderate Risk (9.2% mortality - Hospitalize)"; color = "text-amber-400"; }
                  return (
                    <div className="pt-4 border-t border-[#222222]/80 flex items-center justify-between">
                      <div>
                        <span className="block text-[10px] text-zinc-500 uppercase tracking-wider font-bold">CURB-65 Score</span>
                        <span className="text-2xl font-black text-zinc-100 font-mono">
                          {total} <span className="text-xs text-zinc-500">/ 5</span>
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="block text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Pneumonia Guidance</span>
                        <span className={`text-xs font-bold uppercase tracking-wider ${color}`}>
                          {risk}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Sub-tab 4: Child-Pugh Score */}
          {calcSubTab === "child_pugh" && (
            <div className="bg-[#161616] border border-[#222222] p-5 rounded space-y-4">
              <h4 className="text-xs uppercase font-bold text-emerald-500 tracking-wider border-b border-[#222222] pb-1.5 mb-3">Child-Pugh Classification for Cirrhotic Mortality</h4>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {/* Bilirubin */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1.5">Total Bilirubin</label>
                  <select
                    value={cpBilirubin}
                    onChange={(e) => setCpBilirubin(parseInt(e.target.value))}
                    className="w-full bg-[#111111] border border-[#222222] rounded p-1.5 text-xs text-zinc-200"
                  >
                    <option value={1}>&lt; 2 mg/dL (1 pt)</option>
                    <option value={2}>2 - 3 mg/dL (2 pts)</option>
                    <option value={3}>&gt; 3 mg/dL (3 pts)</option>
                  </select>
                </div>

                {/* Albumin */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1.5">Serum Albumin</label>
                  <select
                    value={cpAlbumin}
                    onChange={(e) => setCpAlbumin(parseInt(e.target.value))}
                    className="w-full bg-[#111111] border border-[#222222] rounded p-1.5 text-xs text-zinc-200"
                  >
                    <option value={1}>&gt; 3.5 g/dL (1 pt)</option>
                    <option value={2}>2.8 - 3.5 g/dL (2 pts)</option>
                    <option value={3}>&lt; 2.8 g/dL (3 pts)</option>
                  </select>
                </div>

                {/* PT INR */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1.5">PT / INR</label>
                  <select
                    value={cpInr}
                    onChange={(e) => setCpInr(parseInt(e.target.value))}
                    className="w-full bg-[#111111] border border-[#222222] rounded p-1.5 text-xs text-zinc-200"
                  >
                    <option value={1}>INR &lt; 1.7 (1 pt)</option>
                    <option value={2}>INR 1.7 - 2.3 (2 pts)</option>
                    <option value={3}>INR &gt; 2.3 (3 pts)</option>
                  </select>
                </div>

                {/* Ascites */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1.5">Ascites Status</label>
                  <select
                    value={cpAscites}
                    onChange={(e) => setCpAscites(parseInt(e.target.value))}
                    className="w-full bg-[#111111] border border-[#222222] rounded p-1.5 text-xs text-zinc-200"
                  >
                    <option value={1}>None (1 pt)</option>
                    <option value={2}>Mild / Controlled (2 pts)</option>
                    <option value={3}>Mod / Uncontrolled (3 pts)</option>
                  </select>
                </div>

                {/* Encephalopathy */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1.5">Hepatic Enceph.</label>
                  <select
                    value={cpEnceph}
                    onChange={(e) => setCpEnceph(parseInt(e.target.value))}
                    className="w-full bg-[#111111] border border-[#222222] rounded p-1.5 text-xs text-zinc-200"
                  >
                    <option value={1}>None (1 pt)</option>
                    <option value={2}>Grade 1 - 2 (2 pts)</option>
                    <option value={3}>Grade 3 - 4 (3 pts)</option>
                  </select>
                </div>
              </div>

              {(() => {
                const total = cpBilirubin + cpAlbumin + cpInr + cpAscites + cpEnceph;
                let cpClass = "Class A";
                let cpSurvival = "100% 1-Year Survival | 85% 2-Year Survival";
                let cpColor = "text-emerald-400";
                if (total >= 10) {
                  cpClass = "Class C";
                  cpSurvival = "45% 1-Year Survival | 35% 2-Year Survival (Severe)";
                  cpColor = "text-rose-400";
                } else if (total >= 7) {
                  cpClass = "Class B";
                  cpSurvival = "80% 1-Year Survival | 60% 2-Year Survival (Moderate)";
                  cpColor = "text-amber-400";
                }
                return (
                  <div className="pt-4 border-t border-[#222222]/80 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <span className="block text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Total Child-Pugh Score</span>
                      <span className="text-2xl font-black text-zinc-100 font-mono">
                        {total} <span className="text-xs text-zinc-500">/ 15</span>
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="block text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Hepatic Class & Prognosis</span>
                      <span className={`text-sm font-bold uppercase tracking-wider block ${cpColor}`}>
                        {cpClass} ({cpSurvival})
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Sub-tab 5: Free Water Deficit */}
          {calcSubTab === "free_water" && (
            <div className="bg-[#161616] border border-[#222222] p-5 rounded space-y-4">
              <h4 className="text-xs uppercase font-bold text-emerald-500 tracking-wider border-b border-[#222222] pb-1.5 mb-3">Hypernatremia Free Water Deficit</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1.5">Patient Weight (kg)</label>
                  <input
                    type="number"
                    value={fwWeight}
                    onChange={(e) => setFwWeight(e.target.value)}
                    className="w-full bg-[#111111] border border-[#222222] rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1.5">Current Na+ (mEq/L)</label>
                  <input
                    type="number"
                    value={fwSodium}
                    onChange={(e) => setFwSodium(e.target.value)}
                    className="w-full bg-[#111111] border border-[#222222] rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1.5">Target Na+ (mEq/L)</label>
                  <input
                    type="number"
                    value={fwTargetNa}
                    onChange={(e) => setFwTargetNa(e.target.value)}
                    className="w-full bg-[#111111] border border-[#222222] rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1.5">Total Body Water (TBW) factor</label>
                  <select
                    value={fwGender}
                    onChange={(e) => setFwGender(e.target.value as any)}
                    className="w-full bg-[#111111] border border-[#222222] rounded px-2.5 py-1.5 text-xs text-zinc-205 focus:outline-none h-[30px]"
                  >
                    <option value="Male">Male Factor (0.6 * Weight)</option>
                    <option value="Female">Female Factor (0.5 * Weight)</option>
                  </select>
                </div>
              </div>

              {(() => {
                const wt = parseFloat(fwWeight);
                const curNa = parseFloat(fwSodium);
                const tarNa = parseFloat(fwTargetNa);
                const factor = fwGender === "Male" ? 0.6 : 0.5;
                const deficit = !isNaN(wt) && !isNaN(curNa) && !isNaN(tarNa) && tarNa > 0 ? factor * wt * ((curNa / tarNa) - 1) : null;
                return (
                  <div className="pt-4 border-t border-[#222222]/80 flex items-center justify-between">
                    <div>
                      <span className="block text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Free Water Deficit</span>
                      <span className="text-2xl font-black text-zinc-100 font-mono">
                        {deficit !== null && deficit > 0 ? `${deficit.toFixed(2)} Liters` : deficit !== null && deficit <= 0 ? "0.00 Liters (No Deficit)" : "--"}
                      </span>
                    </div>
                    <div className="text-right text-[11px] text-zinc-500 leading-relaxed max-w-md font-sans">
                      To safely correct hypernatremia, avoid infusing faster than 10-12 mEq/L in 24 hours to prevent cerebral edema. Deficit does not account for ongoing water losses.
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
