import React, { useState } from "react";
import { TimelineRecord } from "../types";
import { Activity, Wind, Save, Check, RefreshCw, Info, AlertTriangle } from "lucide-react";

interface PatientABGAnalyzerProps {
  timeline: TimelineRecord[];
  onSaveTimeline: (newTimeline: TimelineRecord[]) => void;
  showToast: (msg: string, type: "success" | "error" | "info") => void;
}

export default function PatientABGAnalyzer({ timeline, onSaveTimeline, showToast }: PatientABGAnalyzerProps) {
  const [ph, setPh] = useState("");
  const [pco2, setPco2] = useState("");
  const [hco3, setHco3] = useState("");
  const [po2, setPo2] = useState("");
  const [fio2, setFio2] = useState("21"); // default room air
  const [na, setNa] = useState("");
  const [cl, setCl] = useState("");
  const [alb, setAlb] = useState("4.0"); // default albumin
  const [age, setAge] = useState("65"); // default age for Aa gradient
  
  const [respiratoryCourse, setRespiratoryCourse] = useState<"auto" | "acute" | "chronic">("auto");

  const handleReset = () => {
    setPh("");
    setPco2("");
    setHco3("");
    setPo2("");
    setFio2("21");
    setNa("");
    setCl("");
    setAlb("4.0");
    setRespiratoryCourse("auto");
  };

  const performAnalysis = () => {
    const pHVal = parseFloat(ph);
    const pCO2Val = parseFloat(pco2);
    const hco3Val = parseFloat(hco3);
    const pO2Val = parseFloat(po2);
    const fiO2Val = parseFloat(fio2) / 100;
    const naVal = parseFloat(na);
    const clVal = parseFloat(cl);
    const albVal = parseFloat(alb);
    const ageVal = parseFloat(age);

    if (isNaN(pHVal) || isNaN(pCO2Val) || isNaN(hco3Val)) {
      return { status: "incomplete", text: "Please enter pH, pCO2, and HCO3 for analysis.", compensationText: "", oxygenationText: "", gapText: "", logText: "", level: "Info" as const };
    }

    let level: "Info" | "Warning" | "Critical" = "Info";
    let primaryDisorder = "";
    let compensationAnalysis = "";
    let gapAnalysis = "";
    let oxygenationAnalysis = "";
    
    // --- 1. Acid-Base Status ---
    const isAcidosis = pHVal < 7.35;
    const isAlkalosis = pHVal > 7.45;
    const isNormalPH = !isAcidosis && !isAlkalosis;

    if (pHVal < 7.20 || pHVal > 7.60) level = "Critical";
    else if (isAcidosis || isAlkalosis) level = "Warning";

    // Primary processes
    let respAcid = pCO2Val > 45;
    let metAcid = hco3Val < 22;
    let respAlk = pCO2Val < 35;
    let metAlk = hco3Val > 26;

    if (isAcidosis) {
      if (respAcid && metAcid) {
        primaryDisorder = "Mixed Respiratory and Metabolic Acidosis";
      } else if (respAcid) {
        primaryDisorder = "Primary Respiratory Acidosis";
      } else if (metAcid) {
        primaryDisorder = "Primary Metabolic Acidosis";
      } else {
        primaryDisorder = "Incongruent Acidosis (possible laboratory error)";
      }
    } else if (isAlkalosis) {
      if (respAlk && metAlk) {
        primaryDisorder = "Mixed Respiratory and Metabolic Alkalosis";
      } else if (respAlk) {
        primaryDisorder = "Primary Respiratory Alkalosis";
      } else if (metAlk) {
        primaryDisorder = "Primary Metabolic Alkalosis";
      } else {
        primaryDisorder = "Incongruent Alkalosis (possible laboratory error)";
      }
    } else {
      // Normal pH: 7.35 - 7.45
      if (respAcid && metAlk) {
        primaryDisorder = pHVal <= 7.40 
          ? "Fully Compensated Respiratory Acidosis (or Mixed Metabolic Alkalosis)" 
          : "Fully Compensated Metabolic Alkalosis (or Mixed Respiratory Acidosis)";
      } else if (respAlk && metAcid) {
        primaryDisorder = pHVal <= 7.40 
          ? "Fully Compensated Metabolic Acidosis (or Mixed Respiratory Alkalosis)" 
          : "Fully Compensated Respiratory Alkalosis (or Mixed Metabolic Acidosis)";
      } else if (pCO2Val !== 40 || hco3Val !== 24) {
        primaryDisorder = "Compensated Mild Acid-Base Imbalance";
      } else {
        primaryDisorder = "Normal Acid-Base Profile";
      }
    }

    // --- 2. Deduce Respiratory Course and Calculations ---
    let deducedChronic = false;
    let deductionExplanation = "";
    let ratioText = "";

    if (respAcid || respAlk) {
      if (respAcid) {
        const dP = pCO2Val - 40;
        if (dP > 0) {
          const dH = hco3Val - 24;
          const ratio = (dH / dP) * 10;
          ratioText = `ΔHCO3/ΔpCO2 ratio = ${ratio.toFixed(2)} (Acute expects ~1.0, Chronic expects ~3.5)`;
          if (ratio <= 2.25) {
            deducedChronic = false;
            deductionExplanation = `[Deduceed Course: Acute (${ratioText} ≤ 2.25, indicating acute respiratory acidosis before renal bicarbonate retention has occurred)]`;
          } else {
            deducedChronic = true;
            deductionExplanation = `[Deduceed Course: Chronic (${ratioText} > 2.25, indicating chronic hypoventilation with active metabolic bicarbonate retention by kidneys)]`;
          }
        }
      } else if (respAlk) {
        const dP = 40 - pCO2Val;
        if (dP > 0) {
          const dH = 24 - hco3Val;
          const ratio = (dH / dP) * 10;
          ratioText = `ΔHCO3/ΔpCO2 ratio = ${ratio.toFixed(2)} (Acute expects ~2.0, Chronic expects ~5.0)`;
          if (ratio <= 3.5) {
            deducedChronic = false;
            deductionExplanation = `[Deduceed Course: Acute (${ratioText} ≤ 3.5, indicating acute respiratory alkalosis hyperventilation without complete renal compensation)]`;
          } else {
            deducedChronic = true;
            deductionExplanation = `[Deduceed Course: Chronic (${ratioText} > 3.5, indicating sustained chronic respiratory alkalosis with active renal bicarbonate excretion)]`;
          }
        }
      }
    }

    const chronicEffective = respiratoryCourse === "auto" ? deducedChronic : (respiratoryCourse === "chronic");

    if (primaryDisorder.includes("Metabolic Acidosis")) {
      // Winter's Formula: Expected pCO2 = (1.5 * HCO3) + 8 +/- 2
      const expectedPCO2Min = (1.5 * hco3Val) + 8 - 2;
      const expectedPCO2Max = (1.5 * hco3Val) + 8 + 2;
      
      if (pCO2Val > expectedPCO2Max) {
        compensationAnalysis = `Winter's Formula: Expected pCO2 is ${expectedPCO2Min.toFixed(1)} - ${expectedPCO2Max.toFixed(1)} mmHg. Measured pCO2 (${pCO2Val}) is elevated, indicating a secondary Co-existing Respiratory Acidosis (ventilatory failure).`;
        level = "Critical";
      } else if (pCO2Val < expectedPCO2Min) {
        compensationAnalysis = `Winter's Formula: Expected pCO2 is ${expectedPCO2Min.toFixed(1)} - ${expectedPCO2Max.toFixed(1)} mmHg. Measured pCO2 (${pCO2Val}) is low, indicating a secondary Co-existing Respiratory Alkalosis (hyperventilation).`;
      } else {
        compensationAnalysis = `Winter's Formula: Expected pCO2 is ${expectedPCO2Min.toFixed(1)} - ${expectedPCO2Max.toFixed(1)} mmHg. Measured pCO2 is appropriate, indicating Adequate Respiratory Compensation.`;
      }
    } else if (primaryDisorder.includes("Metabolic Alkalosis")) {
      // Expected pCO2 = (0.7 * HCO3) + 21 +/- 2
      const expMin = (0.7 * hco3Val) + 21 - 2;
      const expMax = (0.7 * hco3Val) + 21 + 2;
      if (pCO2Val > expMax) {
        compensationAnalysis = `Expected pCO2: ${expMin.toFixed(1)} - ${expMax.toFixed(1)} mmHg. Measured pCO2 (${pCO2Val}) is elevated, suggesting a Co-existing Respiratory Acidosis.`;
      } else if (pCO2Val < expMin) {
        compensationAnalysis = `Expected pCO2: ${expMin.toFixed(1)} - ${expMax.toFixed(1)} mmHg. Measured pCO2 (${pCO2Val}) is low, suggesting a Co-existing Respiratory Alkalosis.`;
      } else {
        compensationAnalysis = `Adequate Respiratory Compensation.`;
      }
    } else if (primaryDisorder.includes("Respiratory Acidosis")) {
      // Acute vs Chronic
      const methodLabel = respiratoryCourse === "auto" ? "Auto-Deduceed" : "Manual Force";
      if (!chronicEffective) {
        // Acute: HCO3 increases by 1 for every 10 rise in pCO2
        const expHCO3 = 24 + ((pCO2Val - 40) / 10) * 1;
        compensationAnalysis = `${methodLabel} Acute Compensation: Expected HCO3 is ~${expHCO3.toFixed(1)} mEq/L. Measured HCO3 is ${hco3Val} mEq/L. ${deductionExplanation}`;
      } else {
        // Chronic: HCO3 increases by 3.5 for every 10 rise in pCO2
        const expHCO3 = 24 + ((pCO2Val - 40) / 10) * 3.5;
        compensationAnalysis = `${methodLabel} Chronic Compensation: Expected HCO3 is ~${expHCO3.toFixed(1)} mEq/L. Measured HCO3 is ${hco3Val} mEq/L. ${deductionExplanation}`;
      }
    } else if (primaryDisorder.includes("Respiratory Alkalosis")) {
      const methodLabel = respiratoryCourse === "auto" ? "Auto-Deduceed" : "Manual Force";
      if (!chronicEffective) {
        // Acute: HCO3 decreases by 2 for every 10 decrease in pCO2
        const expHCO3 = 24 - ((40 - pCO2Val) / 10) * 2;
        compensationAnalysis = `${methodLabel} Acute Compensation: Expected HCO3 is ~${expHCO3.toFixed(1)} mEq/L. Measured HCO3 is ${hco3Val} mEq/L. ${deductionExplanation}`;
      } else {
        // Chronic: HCO3 decreases by 5 for every 10 decrease in pCO2
        const expHCO3 = 24 - ((40 - pCO2Val) / 10) * 5;
        compensationAnalysis = `${methodLabel} Chronic Compensation: Expected HCO3 is ~${expHCO3.toFixed(1)} mEq/L. Measured HCO3 is ${hco3Val} mEq/L. ${deductionExplanation}`;
      }
    }

    // --- 3. Anion Gap and Delta-Delta (if Na and Cl are provided) ---
    if (!isNaN(naVal) && !isNaN(clVal)) {
      const baseGap = naVal - (clVal + hco3Val);
      // Adjusted AG for Albumin (normal albumin is 4.0 g/dL)
      const albAdjVal = isNaN(albVal) ? 4.0 : albVal;
      const adjustedGap = baseGap + 2.5 * (4.0 - albAdjVal);
      
      const normalGap = 12;
      let gapType = "Normal Anion Gap (NAGMA / hyperchloremic)";
      
      if (adjustedGap > normalGap + 3) {
        gapType = "High Anion Gap Metabolic Acidosis (HAGMA)";
        level = "Warning";
        
        // Delta-Delta Ratio = (AG - 12) / (24 - HCO3)
        const deltaGap = adjustedGap - 12;
        const deltaHCO3 = 24 - hco3Val;
        
        if (deltaHCO3 > 0) {
          const deltaRatio = deltaGap / deltaHCO3;
          let deltaInterp = "";
          if (deltaRatio < 0.4) {
            deltaInterp = "Mixed HAGMA and NAGMA (Non-Gap Metabolic Acidosis)";
          } else if (deltaRatio >= 0.4 && deltaRatio < 1.0) {
            deltaInterp = "Mixed HAGMA and NAGMA";
          } else if (deltaRatio >= 1.0 && deltaRatio <= 2.0) {
            deltaInterp = "Pure High Anion Gap Metabolic Acidosis (HAGMA)";
          } else {
            deltaInterp = "Mixed HAGMA and Co-existing Metabolic Alkalosis";
          }
          gapAnalysis = `Anion Gap: ${adjustedGap.toFixed(1)} mEq/L (Albumin-adjusted). Classified as: ${gapType}.\nDelta-Delta Ratio: ${deltaRatio.toFixed(2)} (${deltaInterp}).`;
        } else {
          gapAnalysis = `Anion Gap: ${adjustedGap.toFixed(1)} mEq/L (Albumin-adjusted). Classified as: ${gapType}.`;
        }
      } else {
        gapAnalysis = `Anion Gap: ${adjustedGap.toFixed(1)} mEq/L (Albumin-adjusted). Anion gap is normal.`;
      }
    }

    // --- 4. Oxygenation (if pO2 and FiO2 are provided) ---
    if (!isNaN(pO2Val) && !isNaN(fiO2Val) && fiO2Val > 0) {
      const pfRatio = Math.round(pO2Val / fiO2Val);
      
      // Alveolar Gas Equation: PAO2 = PiO2 - (PaCO2 / R)
      // PiO2 = FiO2 * (Barometric - Water Vapor) = FiO2 * (760 - 47)
      // Normal R = 0.8
      const paCO2Val = isNaN(pCO2Val) ? 40 : pCO2Val;
      const pao2_alveolar = (fiO2Val * (760 - 47)) - (paCO2Val / 0.8);
      const aaGradient = pao2_alveolar - pO2Val;
      
      const normalAa = (isNaN(ageVal) ? 65 : ageVal) / 4 + 4;
      let gradientComment = "";
      if (aaGradient > normalAa + 5) {
        gradientComment = `A-a Gradient is elevated (${aaGradient.toFixed(1)} mmHg; Normal: < ${Math.round(normalAa)} mmHg). Suggests V/Q mismatch, shunt, or diffusion barrier.`;
      } else {
        gradientComment = `A-a Gradient is normal (${aaGradient.toFixed(1)} mmHg; Normal: < ${Math.round(normalAa)} mmHg). Suggests hypoventilation or high altitude as cause of hypoxemia.`;
      }

      oxygenationAnalysis = `P/F Ratio: ${pfRatio} mmHg (pO2/FiO2 ratio).\n${gradientComment}`;
    }

    // Build the consolidated log text
    let logText = `### ARTERIAL BLOOD GAS (ABG) ANALYTICAL REPORT\n`;
    logText += `**Input Parameters:**\n`;
    logText += `• pH: ${pHVal} | pCO2: ${pCO2Val} mmHg | HCO3: ${hco3Val} mEq/L\n`;
    if (!isNaN(pO2Val)) logText += `• pO2: ${pO2Val} mmHg | FiO2: ${fio2}%\n`;
    if (!isNaN(naVal)) logText += `• Na: ${naVal} | Cl: ${clVal} | Albumin: ${albVal} g/dL\n`;
    logText += `\n**Diagnostic Findings:**\n`;
    logText += `• **Primary Disturbance:** ${primaryDisorder}\n`;
    if (compensationAnalysis) logText += `• **Compensation:** ${compensationAnalysis}\n`;
    if (gapAnalysis) logText += `• **Anion Gap:** ${gapAnalysis}\n`;
    if (oxygenationAnalysis) logText += `• **Oxygenation:** ${oxygenationAnalysis}\n`;

    return {
      status: "success",
      text: primaryDisorder,
      compensationText: compensationAnalysis,
      gapText: gapAnalysis,
      oxygenationText: oxygenationAnalysis,
      logText,
      level
    };
  };

  const handleLogToTimeline = () => {
    const analysis = performAnalysis();
    if (analysis.status !== "success") {
      showToast("Cannot log empty or incomplete parameters.", "error");
      return;
    }

    const newLog: TimelineRecord = {
      id: "abg_" + Date.now(),
      timestamp: new Date().toISOString(),
      updatedBy: "ABG Analyzer Engine",
      role: "System",
      notes: analysis.logText,
      level: analysis.level
    };

    onSaveTimeline([newLog, ...timeline]);
    showToast("Arterial Blood Gas report successfully synchronized with Daily Logs!", "success");
    handleReset();
  };

  const results = performAnalysis();

  return (
    <div className="bg-[#111111] border border-[#222222] p-5 rounded space-y-4">
      <div className="border-b border-[#222222] pb-2 flex justify-between items-center">
        <span className="text-xs uppercase tracking-wider text-sky-400 font-bold flex items-center gap-1.5 font-sans">
          <Wind className="w-4 h-4" />
          Clinical ABG Analyzer & Compensation Engine
        </span>
        <button 
          onClick={handleReset}
          className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 uppercase transition-colors"
        >
          <RefreshCw className="w-3 h-3" /> Reset
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 font-sans">
        {/* INPUT PANEL */}
        <div className="space-y-3.5">
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="block text-[10px] text-zinc-400 font-bold uppercase">pH</label>
              <input 
                type="number" step="0.01" placeholder="e.g. 7.31" 
                value={ph} onChange={(e) => setPh(e.target.value)}
                className="w-full bg-[#161616] border border-[#222222] rounded p-1.5 text-xs text-zinc-100 focus:outline-none focus:border-sky-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] text-zinc-400 font-bold uppercase">pCO2 (mmHg)</label>
              <input 
                type="number" placeholder="e.g. 52" 
                value={pco2} onChange={(e) => setPco2(e.target.value)}
                className="w-full bg-[#161616] border border-[#222222] rounded p-1.5 text-xs text-zinc-100 focus:outline-none focus:border-sky-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] text-zinc-400 font-bold uppercase">HCO3 (mEq/L)</label>
              <input 
                type="number" placeholder="e.g. 26" 
                value={hco3} onChange={(e) => setHco3(e.target.value)}
                className="w-full bg-[#161616] border border-[#222222] rounded p-1.5 text-xs text-zinc-100 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1 col-span-1">
              <label className="block text-[10px] text-zinc-400 font-bold uppercase">pO2 (mmHg)</label>
              <input 
                type="number" placeholder="e.g. 85" 
                value={po2} onChange={(e) => setPo2(e.target.value)}
                className="w-full bg-[#161616] border border-[#222222] rounded p-1.5 text-xs text-zinc-100 focus:outline-none focus:border-sky-500"
              />
            </div>
            <div className="space-y-1 col-span-1">
              <label className="block text-[10px] text-zinc-400 font-bold uppercase">FiO2 (%)</label>
              <input 
                type="number" placeholder="21" 
                value={fio2} onChange={(e) => setFio2(e.target.value)}
                className="w-full bg-[#161616] border border-[#222222] rounded p-1.5 text-xs text-zinc-100 focus:outline-none focus:border-sky-500"
              />
            </div>
            <div className="space-y-1 col-span-1">
              <label className="block text-[10px] text-zinc-400 font-bold uppercase">Resp Course</label>
              <select
                value={respiratoryCourse}
                onChange={(e) => setRespiratoryCourse(e.target.value as any)}
                className="w-full bg-[#161616] border border-[#222222] focus:border-sky-500 rounded p-1.5 text-xs text-zinc-100 focus:outline-none h-8 font-sans cursor-pointer"
              >
                <option value="auto">🤖 Auto-Deduce</option>
                <option value="acute">⚡ Force Acute</option>
                <option value="chronic">⏳ Force Chronic</option>
              </select>
            </div>
          </div>

          {/* Anion Gap Fields */}
          <div className="space-y-1.5 border-t border-[#222222]/80 pt-2.5">
            <span className="block text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Advanced Metrics (Optional for Anion Gap / Aa Gradient)</span>
            <div className="grid grid-cols-4 gap-2">
              <div className="space-y-1">
                <label className="block text-[9px] text-zinc-400 uppercase">Sodium</label>
                <input 
                  type="number" placeholder="Na" value={na} onChange={(e) => setNa(e.target.value)}
                  className="w-full bg-[#161616] border border-[#222222] rounded p-1 text-[11px] text-zinc-100 focus:outline-none focus:border-sky-500"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[9px] text-zinc-400 uppercase">Chloride</label>
                <input 
                  type="number" placeholder="Cl" value={cl} onChange={(e) => setCl(e.target.value)}
                  className="w-full bg-[#161616] border border-[#222222] rounded p-1 text-[11px] text-zinc-100 focus:outline-none focus:border-sky-500"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[9px] text-zinc-400 uppercase">Albumin</label>
                <input 
                  type="number" step="0.1" placeholder="4.0" value={alb} onChange={(e) => setAlb(e.target.value)}
                  className="w-full bg-[#161616] border border-[#222222] rounded p-1 text-[11px] text-zinc-100 focus:outline-none focus:border-sky-500"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[9px] text-zinc-400 uppercase">Age (yrs)</label>
                <input 
                  type="number" placeholder="65" value={age} onChange={(e) => setAge(e.target.value)}
                  className="w-full bg-[#161616] border border-[#222222] rounded p-1 text-[11px] text-zinc-100 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* RESULTS PANEL */}
        <div className="bg-[#161616]/75 border border-zinc-850 rounded p-4 flex flex-col justify-between">
          <div className="space-y-3.5">
            {results.status === "incomplete" ? (
              <div className="flex flex-col justify-center items-center text-center p-6 text-zinc-550 h-full">
                <Activity className="w-8 h-8 text-zinc-700 mb-2 animate-pulse" />
                <span className="text-xs italic leading-normal">{results.text}</span>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="space-y-0.5">
                  <span className="text-[9px] text-zinc-500 uppercase font-black tracking-wider">Identified Primary Disturbance</span>
                  <p className={`text-xs font-black uppercase ${
                    results.level === "Critical" ? "text-red-400" : (results.level === "Warning" ? "text-amber-400" : "text-sky-400")
                  }`}>
                    {results.text}
                  </p>
                </div>

                {results.compensationText && (
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-zinc-500 uppercase font-black tracking-wider">Secondary Compensation / Ventilation</span>
                    <p className="text-[11px] text-zinc-300 leading-normal">{results.compensationText}</p>
                  </div>
                )}

                {results.gapText && (
                  <div className="space-y-0.5 border-t border-[#222222]/60 pt-2">
                    <span className="text-[9px] text-zinc-500 uppercase font-black tracking-wider">Anion Gap & Delta Ratios</span>
                    <p className="text-[11px] text-zinc-300 leading-normal">{results.gapText}</p>
                  </div>
                )}

                {results.oxygenationText && (
                  <div className="space-y-0.5 border-t border-[#222222]/60 pt-2">
                    <span className="text-[9px] text-zinc-500 uppercase font-black tracking-wider">Oxygenation & Aa Gradient</span>
                    <p className="text-[11px] text-zinc-300 leading-normal">{results.oxygenationText}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {results.status === "success" && (
            <button
              onClick={handleLogToTimeline}
              className="mt-4 w-full bg-sky-600 hover:bg-sky-500 text-zinc-950 font-bold uppercase tracking-wider py-1.5 rounded text-[10px] transition-colors flex items-center justify-center gap-1 shadow cursor-pointer font-sans"
            >
              <Save className="w-3.5 h-3.5 text-zinc-950" /> Log ABG Diagnostic Report
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
