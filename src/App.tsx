/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { collection, onSnapshot, doc, setDoc, deleteDoc, getDocs } from "firebase/firestore";
import { db } from "./lib/firebase";
import { encryptData, decryptData } from "./lib/crypto";
import { PatientData } from "./types";
import { buildPatientMarkdown } from "./lib/markdown";
import LockScreen from "./components/LockScreen";
import Chatroom from "./components/Chatroom";
import PatientDetails from "./components/PatientDetails";
import { 
  Users, Activity, ShieldCheck, LogOut, 
  Search, Plus, LayoutGrid, MessageSquare, 
  Trash, Lock, AlertTriangle, ShieldAlert, Archive, FolderOpen, Download, RefreshCw,
  Folder, ChevronDown, ChevronRight
} from "lucide-react";

// Default empty patient template
const createEmptyPatient = (bed: string): PatientData => ({
  name: "",
  age: "",
  gender: "Male",
  bed: bed,
  mrn: "",
  admissionDate: new Date().toISOString().split("T")[0],
  diagnosis: "",
  isbar: {
    identify: "",
    situation: "",
    background: "",
    assessment: "",
    recommendation: ""
  },
  systems: {
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
    labs: false, labsNotes: "",
    integumentary: false, integumentaryNotes: "",
    neuro: false, neuroNotes: "",
    extracorporeal: false, extracorporealNotes: "",
    social: false, socialNotes: ""
  },
  clinicalNotes: {
    planGoal: "",
    recentEvents: "",
    proceduresDone: ""
  },
  tasks: [],
  calculators: {
    weight: "",
    height: "",
    bmi: "",
    age: "",
    creatinine: "",
    crcl: "",
    gender: "Male",
    calcium: "",
    albumin: "",
    correctedCalcium: "",
    sofa: {
      pao2: "",
      fio2Percent: "",
      platelets: "",
      bilirubin: "",
      gcs: "15",
      map: "",
      vasopressor: "None",
      creatinine: "",
      score: "0"
    }
  },
  infusions: [],
  images: [],
  timeline: [],
  dailyNotes: {
    cns: "",
    cvs: "",
    rs: "",
    renal: "",
    git: "",
    heme: "",
    idStewardship: "",
    other: "",
    lastUpdated: ""
  },
  procedures: [],
  criticalEvents: []
});

export default function App() {
  // Authorization credentials
  const [nickname, setNickname] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userContact, setUserContact] = useState<string | null>(null);

  // Group members list
  const [members, setMembers] = useState<any[]>([]);
  const [successInvite, setSuccessInvite] = useState<{ name: string; contact: string; passphrase: string } | null>(null);

  // Patient states
  const [patients, setPatients] = useState<PatientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<PatientData | null>(null);

  // Search/Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [mainView, setMainView] = useState<"patients" | "chat" | "team" | "archives">("patients");
  const [expandedMonths, setExpandedMonths] = useState<{ [key: string]: boolean }>({});

  // Custom Modal States (to replace native alert/prompt/confirm inside iframe)
  const [showAdmitModal, setShowAdmitModal] = useState(false);
  const [admitBedValue, setAdmitBedValue] = useState("");
  const [admitError, setAdmitError] = useState("");

  const [showDischargeModal, setShowDischargeModal] = useState<string | null>(null);
  const [dischargePatientName, setDischargePatientName] = useState("");
  const [uiError, setUiError] = useState<string | null>(null);

  // Load authorization credentials from sessionStorage for smooth refreshes
  useEffect(() => {
    const savedName = sessionStorage.getItem("icu_doctor_name");
    const savedKey = sessionStorage.getItem("icu_group_passphrase");
    const savedRole = sessionStorage.getItem("icu_user_role");
    const savedContact = sessionStorage.getItem("icu_user_contact");
    if (savedName && savedKey && savedRole) {
      setNickname(savedName);
      setPassphrase(savedKey);
      setUserRole(savedRole);
      setUserContact(savedContact);
    }
  }, []);

  const handleAuthorized = (docName: string, docPass: string, docRole: string, docContact: string) => {
    sessionStorage.setItem("icu_doctor_name", docName);
    sessionStorage.setItem("icu_group_passphrase", docPass);
    sessionStorage.setItem("icu_user_role", docRole);
    sessionStorage.setItem("icu_user_contact", docContact);
    setNickname(docName);
    setPassphrase(docPass);
    setUserRole(docRole);
    setUserContact(docContact);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("icu_doctor_name");
    sessionStorage.removeItem("icu_group_passphrase");
    sessionStorage.removeItem("icu_user_role");
    sessionStorage.removeItem("icu_user_contact");
    setNickname(null);
    setPassphrase(null);
    setUserRole(null);
    setUserContact(null);
    setPatients([]);
  };

  const [isResetting, setIsResetting] = useState(false);

  const handleFullSystemReset = async (wipeAll: boolean) => {
    const confirmMsg = wipeAll 
      ? "CRITICAL WARNING: This will completely delete the ICU Passphrase, ALL patient records, ALL authorized clinician profiles, and ALL chatroom logs. This is 100% irreversible. Are you absolutely sure?"
      : "WARNING: This will reset the ICU Passphrase configuration only. Existing encrypted patients and member records will remain in Firestore but will be unreadable unless a matching passphrase is used. Proceed?";
      
    if (!confirm(confirmMsg)) return;

    setIsResetting(true);
    try {
      // 1. Delete Passphrase verification
      await deleteDoc(doc(db, "group_config", "verification"));

      if (wipeAll) {
        // 2. Wipe patients
        const patientSnap = await getDocs(collection(db, "patients"));
        const patientDeletes = patientSnap.docs.map(d => deleteDoc(doc(db, "patients", d.id)));
        await Promise.all(patientDeletes);

        // 3. Wipe chats
        const chatSnap = await getDocs(collection(db, "chats"));
        const chatDeletes = chatSnap.docs.map(d => deleteDoc(doc(db, "chats", d.id)));
        await Promise.all(chatDeletes);

        // 4. Wipe group_members
        const memberSnap = await getDocs(collection(db, "group_members"));
        const memberDeletes = memberSnap.docs.map(d => deleteDoc(doc(db, "group_members", d.id)));
        await Promise.all(memberDeletes);
      }

      alert("System Reset Completed Successfully! You will now be redirected to initialize a new secure ICU Hub.");
      // Clear sessionStorage and lock
      sessionStorage.clear();
      window.location.reload();
    } catch (err: any) {
      console.error("Reset failed:", err);
      alert("Failed to reset database: " + err.message);
    } finally {
      setIsResetting(false);
    }
  };

  // Real-time synchronization of the clinician roster (members)
  useEffect(() => {
    if (!passphrase) return;

    const q = collection(db, "group_members");
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setMembers(list);
    }, (error) => {
      console.error("Failed to sync members roster:", error);
    });

    return () => unsubscribe();
  }, [passphrase]);

  // Real-time decryption subscription of patient records
  useEffect(() => {
    if (!passphrase) return;

    setLoading(true);
    const q = collection(db, "patients");
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const records: any[] = [];
      snapshot.forEach((doc) => {
        records.push({ id: doc.id, ...doc.data() });
      });

      // Decrypt all records client-side asynchronously
      const decrypted = await Promise.all(
        records.map(async (rec) => {
          try {
            const decStr = await decryptData(rec.encryptedBlob, passphrase);
            if (!decStr || decStr.startsWith("[Incorrect")) {
              throw new Error("Incorrect secure key");
            }
            const parsed = JSON.parse(decStr);
            return { id: rec.id, ...parsed } as PatientData & { id: string };
          } catch (err) {
            console.warn(`Record ${rec.id} could not be decrypted under current passphrase:`, err instanceof Error ? err.message : err);
            // Return placeholder for records that can't be decrypted
            return {
              id: rec.id,
              name: "[Decryption Error - Incompatible Key]",
              bed: "?",
              mrn: "N/A",
              diagnosis: "Decrypt failure",
              isDecryptError: true
            } as any;
          }
        })
      );

      setPatients(decrypted);
      setLoading(false);
    }, (error) => {
      console.error("Patients snapshot error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [passphrase]);

  // Track the actively selected patient for real-time detail syncing
  useEffect(() => {
    if (selectedPatientId) {
      const active = patients.find(p => (p as any).id === selectedPatientId);
      if (active) {
        setSelectedPatient(active);
      }
    } else {
      setSelectedPatient(null);
    }
  }, [patients, selectedPatientId]);

  // Save/Create patient record in Firestore
  const handleSavePatient = async (updatedPatient: PatientData) => {
    if (!passphrase || !nickname) return;
    
    // Determine the ID (if selecting existing, or create new)
    const id = selectedPatientId || Math.random().toString(36).substr(2, 9);
    
    const plainTextJson = JSON.stringify(updatedPatient);
    const encryptedBlob = await encryptData(plainTextJson, passphrase);

    const docRef = doc(db, "patients", id);
    await setDoc(docRef, {
      encryptedBlob: encryptedBlob,
      updatedAt: new Date().toISOString(),
      updatedBy: nickname
    });

    if (!selectedPatientId) {
      setSelectedPatientId(id);
    }
  };

  const handleOpenAdmitModal = () => {
    setAdmitBedValue("");
    setAdmitError("");
    setShowAdmitModal(true);
  };

  const handleConfirmAdmission = async (e: React.FormEvent) => {
    e.preventDefault();
    const bedClean = admitBedValue.trim();
    if (!bedClean) {
      setAdmitError("Please enter a bed number.");
      return;
    }

    const exists = patients.some(p => p.bed.toLowerCase() === bedClean.toLowerCase());
    if (exists) {
      setAdmitError(`Bed ${bedClean} is already occupied. Please release the bed or edit the patient.`);
      return;
    }

    try {
      const tempPatient = createEmptyPatient(bedClean);
      const id = Math.random().toString(36).substr(2, 9);
      const plainTextJson = JSON.stringify(tempPatient);
      const encryptedBlob = await encryptData(plainTextJson, passphrase!);

      const docRef = doc(db, "patients", id);
      await setDoc(docRef, {
        encryptedBlob: encryptedBlob,
        updatedAt: new Date().toISOString(),
        updatedBy: nickname!
      });

      setSelectedPatientId(id);
      setShowAdmitModal(false);
    } catch (err: any) {
      console.error("Failed to admit patient:", err);
      setAdmitError(`Database error: ${err.message || err}`);
    }
  };

  const handleOpenDischargeModal = (id: string, name: string) => {
    setShowDischargeModal(id);
    setDischargePatientName(name || "Unnamed Patient");
  };

  const handleConfirmDischarge = async () => {
    if (!showDischargeModal) return;
    try {
      const p = patients.find(pat => pat.id === showDischargeModal);
      if (p && !(p as any).isDecryptError) {
        // Automatically archive the patient clinical file before discharging (deleting)
        const patientName = p.name || "Unnamed Patient";
        const patientId = p.id;
        const mdContent = buildPatientMarkdown(p);
        
        const archiveEntry = {
          id: patientId,
          name: patientName,
          bed: p.bed || "TBD",
          mrn: p.mrn || "N/A",
          age: p.age || "N/A",
          gender: p.gender || "Other",
          diagnosis: p.diagnosis || "N/A",
          archivedAt: new Date().toISOString(),
          jsonData: p,
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

        // Filter out duplicate if it existed, and prepend the new one
        archives = archives.filter((item: any) => item.id !== patientId);
        archives.unshift(archiveEntry);

        localStorage.setItem("critisync_local_archives", JSON.stringify(archives));
      }

      await deleteDoc(doc(db, "patients", showDischargeModal));
      if (selectedPatientId === showDischargeModal) {
        setSelectedPatientId(null);
      }
      setShowDischargeModal(null);
    } catch (err: any) {
      console.error("Discharge error:", err);
      setUiError("Failed to discharge patient: " + (err.message || err));
    }
  };

  // Filter patients based on bed number or name
  const filteredPatients = patients.filter((p) => {
    const term = searchTerm.toLowerCase();
    return (
      p.bed.toLowerCase().includes(term) ||
      p.name.toLowerCase().includes(term) ||
      p.diagnosis.toLowerCase().includes(term)
    );
  });

  // Render the Lock Screen if not authorized
  if (!nickname || !passphrase) {
    return <LockScreen onAuthorized={handleAuthorized} />;
  }

  // Render the Active Patient Detail Handoff Workspace
  if (selectedPatient) {
    return (
      <PatientDetails
        patient={selectedPatient}
        passphrase={passphrase}
        nickname={nickname}
        userRole={userRole || "Nurse"}
        onSave={handleSavePatient}
        onClose={() => setSelectedPatientId(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E0E0E0] font-sans pb-12 flex flex-col">
      {/* Header Bar */}
      <header className="bg-[#141414] border-b border-[#222222] py-4 px-6 sticky top-0 z-30 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-950/40 border border-emerald-500/20 rounded flex items-center justify-center text-emerald-500">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="font-serif text-lg italic text-emerald-500 tracking-tighter">CritiSync v2.4</h1>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <span className="text-[10px] text-zinc-400">Active Duty: <strong className="text-zinc-200 font-sans">{nickname}</strong></span>
              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-950/45 text-emerald-400 border border-emerald-500/30">
                {userRole}
              </span>
              <span className="w-1 h-1 rounded-full bg-[#222222]"></span>
              <span className="text-[9px] text-emerald-500 flex items-center gap-0.5 font-bold uppercase tracking-widest">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                E2EE Secure
              </span>
            </div>
          </div>
        </div>

        {/* Navigation toggles */}
        <div className="flex items-center gap-2 bg-[#0A0A0A] p-1 rounded border border-[#222222]">
          <button
            onClick={() => setMainView("patients")}
            className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition-colors flex items-center gap-1.5 ${
              mainView === "patients" ? "bg-emerald-600 text-white" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Patient Ward
          </button>
          <button
            onClick={() => setMainView("chat")}
            className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition-colors flex items-center gap-1.5 ${
              mainView === "chat" ? "bg-emerald-600 text-white" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            ICU Chatroom
          </button>
          {userRole && (userRole === "Initial Admin" || userRole.toLowerCase().includes("admin")) && (
            <button
              onClick={() => setMainView("team")}
              className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition-colors flex items-center gap-1.5 ${
                mainView === "team" ? "bg-emerald-600 text-white" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Manage Team
            </button>
          )}
          <button
            onClick={() => setMainView("archives")}
            className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition-colors flex items-center gap-1.5 ${
              mainView === "archives" ? "bg-emerald-600 text-white" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            Local Archives
          </button>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="bg-[#1A1A1A] hover:bg-[#222222] border border-[#222222] text-zinc-300 hover:text-white p-2 px-3 rounded transition-colors flex items-center gap-1.5 text-xs font-bold"
          title="Lock System"
        >
          <LogOut className="w-4 h-4 text-red-500" />
          Lock Hub
        </button>
      </header>

      {/* Main Board Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 mt-8">
        
        {/* VIEW 1: Patient Ward Board */}
        {mainView === "patients" && (
          <div className="space-y-6">
            
            {/* Filter and Add Board Controls */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-[#111111] border border-[#222222] p-4 rounded">
              <div className="w-full sm:max-w-md relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-600">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter patients by Bed number, name, or diagnosis..."
                  className="w-full bg-[#1A1A1A] border border-[#222222] rounded py-2 pl-10 pr-4 text-xs focus:outline-none focus:border-emerald-500 text-zinc-100 placeholder:text-zinc-600 font-sans"
                />
              </div>

              {userRole === "Attending Physician" || userRole === "Resident Doctor" ? (
                <button
                  onClick={handleOpenAdmitModal}
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider py-2 px-4 rounded flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Admit New ICU Patient
                </button>
              ) : (
                <button
                  disabled
                  title="Admission is restricted to Attending Physicians and Resident Doctors."
                  className="w-full sm:w-auto bg-zinc-900 border border-[#222222] text-zinc-500 font-bold text-xs uppercase tracking-wider py-2 px-4 rounded flex items-center justify-center gap-2 cursor-not-allowed opacity-60"
                >
                  <Lock className="w-3.5 h-3.5 text-zinc-400" />
                  Admission Restricted
                </button>
              )}
            </div>

            {/* Patients List Grid */}
            {loading ? (
              <div className="text-center p-16 bg-[#111111] border border-[#222222] rounded flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
                <p className="text-xs text-zinc-500">Retrieving secure records and decrypting on snapshot...</p>
              </div>
            ) : filteredPatients.length === 0 ? (
              <div className="text-center p-16 bg-[#111111] border border-dashed border-[#222222] text-zinc-500 text-xs rounded">
                {searchTerm ? "No clinical profiles match your filter settings." : "No patients currently registered in this ICU ward."}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPatients.map((p) => {
                  const id = (p as any).id;
                  
                  // Compute FASTHUG-BID completed parameters
                  let fasthugChecked = 0;
                  if (p.fasthugbid) {
                    const keys = ["feeding", "analgesia", "sedation", "thrombo", "headUp", "ulcer", "glycemic", "bowel", "indwelling", "deescalation"];
                    keys.forEach((key) => {
                      if ((p.fasthugbid as any)[key]) fasthugChecked++;
                    });
                  }

                  // Compute active high/med/low tasks
                  const pendingHigh = p.tasks?.filter((t) => t.status === "Pending" && t.priority === "High").length || 0;
                  const pendingTotal = p.tasks?.filter((t) => t.status === "Pending").length || 0;

                  const hasDecryptError = (p as any).isDecryptError;

                  return (
                    <div
                      key={id}
                      className={`bg-[#111111] border transition-all rounded p-5 flex flex-col justify-between relative group ${
                        hasDecryptError
                          ? "border-red-950 bg-red-950/10"
                          : "border-[#222222] hover:border-zinc-700 shadow-lg hover:shadow-black/50"
                      }`}
                    >
                      {/* Bed / Ward Tag */}
                      <div className="flex items-center justify-between mb-3.5">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-[#0A0A0A] border border-[#222222] rounded text-emerald-500 font-mono tracking-wider">
                          Bed {p.bed}
                        </span>
                        
                        {!hasDecryptError && (
                          <div className="flex gap-1.5 items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-[8px] text-zinc-500 font-mono font-bold uppercase tracking-widest">Real-time sync</span>
                          </div>
                        )}
                      </div>

                      {/* Decryption Error Block */}
                      {hasDecryptError ? (
                        <div className="my-3 space-y-2">
                          <div className="flex items-center gap-2 text-red-400">
                            <ShieldAlert className="w-5 h-5" />
                            <span className="text-xs font-bold">Incompatible Encryption Key</span>
                          </div>
                          <p className="text-[11px] text-zinc-500 leading-relaxed">
                            This patient record was encrypted with a different group passphrase. Change your passphrase to view this patient.
                          </p>
                        </div>
                      ) : (
                        /* Patient Info Block */
                        <div>
                          <h2 className="text-xl font-serif italic text-zinc-100 group-hover:text-emerald-500 transition-colors">
                            {p.name || "Unnamed Patient"}
                          </h2>
                          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mt-1 font-semibold">
                            MRN: {p.mrn || "Pending"} • {p.age || "--"}y/o • {p.gender}
                          </p>

                          <div className="mt-3 text-xs bg-[#1A1A1A] border border-[#222222] p-3 rounded text-zinc-300 leading-relaxed min-h-[46px]">
                            <strong className="text-zinc-400 font-semibold uppercase text-[9px] tracking-wider block mb-1">Diagnosis / Admitting Details</strong>
                            {p.diagnosis || "No primary diagnosis recorded."}
                          </div>

                          {/* Stats Metrics Grid */}
                          <div className="grid grid-cols-2 gap-2 mt-4">
                            {/* FASTHUG status */}
                            <div className="bg-[#1A1A1A] border border-[#222222] p-2 rounded text-center">
                              <span className="block text-[8px] text-zinc-500 font-bold uppercase tracking-widest">FASTHUG-BID</span>
                              <span className="block text-sm font-bold text-emerald-500 mt-0.5">
                                {fasthugChecked} / 10
                              </span>
                            </div>

                            {/* Active Tasks status */}
                            <div className="bg-[#1A1A1A] border border-[#222222] p-2 rounded text-center">
                              <span className="block text-[8px] text-zinc-500 font-bold uppercase tracking-widest">Handoff Tasks</span>
                              <span className="block text-sm font-bold text-zinc-300 mt-0.5">
                                {pendingTotal > 0 ? (
                                  <>
                                    {pendingTotal}{" "}
                                    {pendingHigh > 0 && (
                                      <span className="text-[9px] bg-red-950 text-red-400 border border-red-900/30 px-1.5 rounded-full font-bold ml-1 inline-block shrink-0">
                                        {pendingHigh} High
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  "0 Pending"
                                )}
                              </span>
                            </div>
                          </div>

                          {/* Active infusions summary if available */}
                          {p.infusions && p.infusions.length > 0 && (
                            <div className="mt-3.5 pt-3 border-t border-[#222222] flex flex-wrap gap-1.5 items-center">
                              <span className="text-[8px] text-zinc-500 uppercase font-bold tracking-widest mr-1">Vasoactives:</span>
                              {p.infusions.map((inf) => (
                                <span key={inf.id} className="text-[9px] bg-emerald-950/40 text-emerald-400 border border-emerald-500/20 font-bold px-2 py-0.5 rounded-full font-mono">
                                  {inf.name} ({inf.rate}ml/h)
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Card Bottom Actions */}
                      <div className="mt-5 pt-4 border-t border-[#222222] flex items-center justify-between gap-3">
                        <button
                          onClick={() => setSelectedPatientId(id)}
                          className="flex-1 bg-[#1A1A1A] hover:bg-[#222222] border border-[#222222] text-zinc-200 hover:text-white font-bold text-xs uppercase tracking-wider py-1.5 px-3 rounded transition-all text-center"
                        >
                          {hasDecryptError ? "View RAW ID" : "Open Handover Worksheet"}
                        </button>
                        
                        {userRole === "Attending Physician" ? (
                          <button
                            onClick={() => handleOpenDischargeModal(id, p.name)}
                            className="text-zinc-600 hover:text-red-500 p-1.5 rounded transition-colors shrink-0 cursor-pointer"
                            title="Discharge Patient"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            disabled
                            className="text-zinc-800 p-1.5 rounded cursor-not-allowed shrink-0"
                            title="Discharge is restricted to Attending Physicians."
                          >
                            <Lock className="w-3.5 h-3.5 text-zinc-700" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

        {/* VIEW 2: Chatroom panel */}
        {mainView === "chat" && (
          <Chatroom nickname={nickname} passphrase={passphrase} />
        )}

        {/* VIEW 3: Team Management */}
        {mainView === "team" && (
          <div className="space-y-6">
            <div className="bg-[#111111] border border-[#222222] p-6 rounded relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>
              <h2 className="text-xl font-serif italic text-emerald-400 flex items-center gap-2">
                <Users className="w-5 h-5" />
                ICU Authorized Clinician Roster
              </h2>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed max-w-2xl">
                As the ICU Group Admin, you can authorize other clinicians to join your CritiSync secure cluster. 
                Enter their Email or Phone number to register them. **Since all data is end-to-end encrypted client-side, you must share the secure ICU Group Passphrase with them securely.**
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Add New Member Form */}
              <div className="bg-[#111111] border border-[#222222] p-5 rounded space-y-4">
                <h3 className="text-xs uppercase tracking-wider text-zinc-400 font-bold border-b border-[#222222] pb-2 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-emerald-400" />
                  Authorize New Clinician
                </h3>

                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const target = e.target as any;
                  const name = target.elements.memberName.value.trim();
                  const contact = target.elements.memberContact.value.trim();
                  const role = target.elements.memberRole.value;

                  if (!name || !contact) {
                    setUiError("Name and Contact (Email/Phone) are required.");
                    return;
                  }

                  try {
                    const normContact = contact.toLowerCase().trim().replace(/[\s\-\(\)\+]/g, "");
                    const docRef = doc(db, "group_members", normContact);
                    await setDoc(docRef, {
                      name,
                      contact,
                      role,
                      isInitialAdmin: false,
                      addedAt: new Date().toISOString(),
                      addedBy: nickname
                    });

                    target.reset();
                    setSuccessInvite({ name, contact, passphrase: passphrase || "" });
                  } catch (err: any) {
                    setUiError("Failed to add team member: " + err.message);
                  }
                }} className="space-y-4 text-xs text-zinc-300">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] text-zinc-400 font-bold uppercase">Clinician Full Name</label>
                    <input
                      name="memberName"
                      type="text"
                      placeholder="e.g. Dr. Olivia Bennett"
                      className="w-full bg-[#161616] border border-[#222222] focus:border-emerald-500 rounded p-2 text-xs focus:outline-none text-zinc-100 placeholder:text-zinc-650 font-sans"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] text-zinc-400 font-bold uppercase">Contact (Email or Phone Number)</label>
                    <input
                      name="memberContact"
                      type="text"
                      placeholder="e.g. olivia@hospital.com or +1 555-0199"
                      className="w-full bg-[#161616] border border-[#222222] focus:border-emerald-500 rounded p-2 text-xs focus:outline-none text-zinc-100 placeholder:text-zinc-650 font-sans"
                      required
                    />
                    <p className="text-[10px] text-zinc-500">Must exactly match the contact they type on the Lock Screen.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] text-zinc-400 font-bold uppercase">Clinician Role / Access Level</label>
                    <select
                      name="memberRole"
                      className="w-full bg-[#161616] border border-[#222222] focus:border-emerald-500 rounded p-2 text-xs focus:outline-none text-zinc-200 font-sans cursor-pointer"
                    >
                      <option value="Attending Physician">Attending Physician (Full Access)</option>
                      <option value="Resident Doctor">Resident Doctor (High Access)</option>
                      <option value="Nurse">Nurse (Clinical & Care Safety)</option>
                      <option value="Pharmacist">Pharmacist (Medications & Calculators)</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <ShieldCheck className="w-4 h-4 text-emerald-200" />
                    Authorize Clinician Account
                  </button>
                </form>
              </div>

              {/* Members List Table */}
              <div className="bg-[#111111] border border-[#222222] p-5 rounded lg:col-span-2 space-y-4">
                <h3 className="text-xs uppercase tracking-wider text-zinc-400 font-bold border-b border-[#222222] pb-2 flex justify-between items-center">
                  <span>Clinician Access Registry ({members.length})</span>
                  <span className="text-[10px] text-emerald-500 font-mono tracking-widest uppercase">E2EE Authenticated</span>
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left text-zinc-300">
                    <thead className="text-[10px] text-zinc-500 uppercase tracking-wider border-b border-[#222222]/60 font-sans font-bold">
                      <tr>
                        <th className="py-2.5 px-3">Name</th>
                        <th className="py-2.5 px-3">Contact</th>
                        <th className="py-2.5 px-3">Role</th>
                        <th className="py-2.5 px-3">Added By</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#222222]/40 font-sans">
                      {members.map((m) => (
                        <tr key={m.id} className="hover:bg-[#161616]/40 transition-colors">
                          <td className="py-3 px-3 font-semibold text-zinc-150 flex items-center gap-2">
                            {m.isInitialAdmin ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Initial Setup Admin"></span>
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-zinc-600"></span>
                            )}
                            {m.name}
                          </td>
                          <td className="py-3 px-3 font-mono text-zinc-400">{m.contact}</td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              m.role === "Initial Admin" ? "bg-emerald-950/40 text-emerald-400 border border-emerald-500/20" : "bg-zinc-900 text-zinc-400 border border-zinc-800"
                            }`}>
                              {m.role}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-zinc-500 text-[11px]">{m.addedBy || "Setup"}</td>
                          <td className="py-3 px-3 text-right">
                            {m.isInitialAdmin ? (
                              <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-500/60 font-mono">Immutable</span>
                            ) : (
                              <button
                                onClick={async () => {
                                  if (confirm(`Are you sure you want to revoke authorized access for ${m.name}? They will immediately be locked out of clinical synchronization.`)) {
                                    try {
                                      await deleteDoc(doc(db, "group_members", m.id));
                                    } catch (err: any) {
                                      setUiError("Failed to revoke access: " + err.message);
                                    }
                                  }
                                }}
                                className="text-[10px] text-zinc-500 hover:text-red-400 uppercase tracking-wider font-semibold hover:underline cursor-pointer"
                              >
                                Revoke Access
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ADMIN RESET DANGER ZONE */}
            {userRole && (userRole === "Initial Admin" || userRole.toLowerCase().includes("admin")) && (
              <div className="mt-8 bg-red-950/10 border border-red-900/30 rounded p-6 space-y-4">
                <div className="flex items-center gap-2 text-red-500 border-b border-red-900/20 pb-2">
                  <ShieldAlert className="w-5 h-5 animate-pulse" />
                  <h3 className="text-sm font-bold uppercase tracking-wider font-sans">
                    Admin Security Danger Zone
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-zinc-400">
                  <div className="space-y-2">
                    <h4 className="font-bold text-zinc-200 uppercase text-[10px] tracking-wider">
                      Option A: Reset ICU Passphrase Verification Key
                    </h4>
                    <p className="leading-relaxed">
                      This deletes the security handshake verification document in Firestore. The next time the Lock Screen reloads, the system will prompt the user to configure a new secure group passphrase. All database records (patients, clinicians) will remain intact, but will be unreadable unless a matching passphrase is configured.
                    </p>
                    <button
                      onClick={() => handleFullSystemReset(false)}
                      disabled={isResetting}
                      className="mt-2 bg-zinc-900 hover:bg-zinc-800 text-red-400 border border-red-900/40 font-bold py-2 px-4 rounded text-[10px] uppercase tracking-wider transition-all cursor-pointer"
                    >
                      Reset Passphrase Verification Only
                    </button>
                  </div>

                  <div className="space-y-2 border-t md:border-t-0 md:border-l border-red-900/10 pt-4 md:pt-0 md:pl-6">
                    <h4 className="font-bold text-red-400 uppercase text-[10px] tracking-wider">
                      Option B: Hard Factory Reset (Wipe All Records)
                    </h4>
                    <p className="leading-relaxed">
                      Recommended when deploying a new secure ICU team passphrase. This will delete the security handshake verification, and <strong>WIPE all patient records, authorized clinician registry profiles, and ICU chatroom logs</strong> from the Firestore database permanently.
                    </p>
                    <button
                      onClick={() => handleFullSystemReset(true)}
                      disabled={isResetting}
                      className="mt-2 bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded text-[10px] uppercase tracking-wider transition-all cursor-pointer shadow-md"
                    >
                      {isResetting ? "Performing Full Wipe..." : "Factory Reset & Wipe All Database Records"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 4: Local Archive Folder */}
        {mainView === "archives" && (
          <div className="space-y-6">
            <div className="bg-[#111111] border border-[#222222] p-6 rounded relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>
              <h2 className="text-xl font-serif italic text-emerald-400 flex items-center gap-2">
                <FolderOpen className="w-5 h-5" />
                Patient Archives Directory
              </h2>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed max-w-2xl">
                This local directory stores clinical handover records in offline, app-readable (JSON) and report-ready (Markdown) formats. 
                These files are stored persistently in your browser's local sandbox, separate from the cloud.
              </p>
            </div>

            {/* List of Archived Patients */}
            <div className="bg-[#111111] border border-[#222222] p-5 rounded space-y-4">
              <div className="flex justify-between items-center border-b border-[#222222] pb-3">
                <h3 className="text-xs uppercase tracking-wider text-zinc-400 font-bold flex items-center gap-2">
                  <span>Archived Worksheets</span>
                  <span className="bg-zinc-800 text-zinc-400 text-[10px] font-mono px-2 py-0.5 rounded-full">
                    {(() => {
                      const str = localStorage.getItem("critisync_local_archives");
                      if (!str) return 0;
                      try {
                        const arr = JSON.parse(str);
                        return Array.isArray(arr) ? arr.length : 0;
                      } catch (e) {
                        return 0;
                      }
                    })()}
                  </span>
                </h3>
                
                <button
                  onClick={() => {
                    if (confirm("Are you sure you want to completely clear the local archive directory? This will wipe all offline patient backups from this browser context. This is irreversible.")) {
                      localStorage.removeItem("critisync_local_archives");
                      window.location.reload();
                    }
                  }}
                  className="text-[10px] text-zinc-500 hover:text-red-400 font-semibold uppercase tracking-wider hover:underline flex items-center gap-1 cursor-pointer"
                >
                  Wipe Local Folder
                </button>
              </div>

              {(() => {
                const str = localStorage.getItem("critisync_local_archives");
                let archives: any[] = [];
                if (str) {
                  try {
                    archives = JSON.parse(str);
                  } catch (e) {
                    archives = [];
                  }
                }

                if (!Array.isArray(archives) || archives.length === 0) {
                  return (
                    <div className="text-center py-12 text-zinc-500 space-y-2">
                      <Archive className="w-12 h-12 mx-auto opacity-20" />
                      <p className="text-xs">No worksheets are currently archived in this local directory.</p>
                      <p className="text-[10px] text-zinc-600">To archive a patient, open their handover worksheet and navigate to the "EHR Patient Case Summary" tab.</p>
                    </div>
                  );
                }

                // Group archives by month and year
                const groups: { [key: string]: any[] } = {};
                archives.forEach((item: any) => {
                  const date = new Date(item.archivedAt || new Date());
                  const monthYear = date.toLocaleString("default", { month: "long", year: "numeric" });
                  if (!groups[monthYear]) {
                    groups[monthYear] = [];
                  }
                  groups[monthYear].push(item);
                });

                // Sort keys so that newer months appear first
                const sortedKeys = Object.keys(groups).sort((a, b) => {
                  const dateA = new Date(a);
                  const dateB = new Date(b);
                  return dateB.getTime() - dateA.getTime();
                });

                return (
                  <div className="space-y-4">
                    {sortedKeys.map((monthYear) => {
                      const monthItems = groups[monthYear];
                      const isExpanded = expandedMonths[monthYear] !== false; // True by default
                      return (
                        <div key={monthYear} className="border border-[#222222] rounded bg-[#131313]/50 overflow-hidden">
                          {/* Folder Header */}
                          <button
                            onClick={() => {
                              setExpandedMonths(prev => ({
                                ...prev,
                                [monthYear]: !isExpanded
                              }));
                            }}
                            className="w-full flex items-center justify-between p-4 bg-[#181818]/80 hover:bg-[#1E1E1E] transition-all border-b border-[#222222] cursor-pointer text-left"
                          >
                            <div className="flex items-center gap-3">
                              {isExpanded ? (
                                <FolderOpen className="w-5 h-5 text-amber-400 fill-amber-400/20" />
                              ) : (
                                <Folder className="w-5 h-5 text-amber-500 fill-amber-500/10" />
                              )}
                              <div>
                                <span className="font-serif text-sm font-bold text-zinc-150 italic">
                                  {monthYear} Archives Folder
                                </span>
                                <span className="ml-2.5 text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-750 px-2 py-0.5 rounded-full font-mono">
                                  {monthItems.length} {monthItems.length === 1 ? "file" : "files"}
                                </span>
                              </div>
                            </div>
                            <div className="text-zinc-500 hover:text-zinc-300">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </div>
                          </button>

                          {/* Folder Contents (Patient Cards) */}
                          {isExpanded && (
                            <div className="p-4 bg-[#0D0D0D]/40">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                                {monthItems.map((item: any) => {
                                  const formattedDate = new Date(item.archivedAt).toLocaleDateString() + " " + new Date(item.archivedAt).toLocaleTimeString();
                                  return (
                                    <div key={item.id} className="bg-[#161616] border border-[#222222] p-4 rounded flex flex-col justify-between space-y-4 hover:border-emerald-500/20 transition-all">
                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                          <span className="text-[10px] font-mono bg-zinc-800 text-zinc-400 border border-zinc-750 px-2 py-0.5 rounded font-bold">
                                            Bed {item.bed || "N/A"}
                                          </span>
                                          <span className="text-[9px] text-zinc-500 font-sans">
                                            Archived: {formattedDate}
                                          </span>
                                        </div>
                                        
                                        <div>
                                          <h4 className="text-sm font-bold text-zinc-200">{item.name}</h4>
                                          <p className="text-[11px] text-zinc-400 mt-0.5 font-mono">
                                            MRN: {item.mrn || "N/A"} • {item.age}y / {item.gender}
                                          </p>
                                          <p className="text-xs text-zinc-500 mt-2 line-clamp-2">
                                            <strong>Diagnosis:</strong> {item.diagnosis || "N/A"}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="pt-3 border-t border-[#222222]/55 flex flex-wrap gap-2 items-center justify-between">
                                        <div className="flex gap-1.5">
                                          <button
                                            onClick={() => {
                                              const blob = new Blob([item.markdownData], { type: "text/markdown;charset=utf-8;" });
                                              const url = URL.createObjectURL(blob);
                                              const link = document.createElement("a");
                                              link.href = url;
                                              link.download = `ICU_Archive_${item.name.replace(/[^a-zA-Z0-9]/g, "_")}.md`;
                                              document.body.appendChild(link);
                                              link.click();
                                              document.body.removeChild(link);
                                            }}
                                            className="bg-[#222222] hover:bg-[#2A2A2A] text-zinc-300 hover:text-white border border-[#333333] px-2.5 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                                            title="Download report-ready clinical Markdown format"
                                          >
                                            <Download className="w-3.5 h-3.5 text-emerald-400" />
                                            Markdown
                                          </button>
                                          <button
                                            onClick={() => {
                                              const jsonStr = JSON.stringify(item.jsonData, null, 2);
                                              const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8;" });
                                              const url = URL.createObjectURL(blob);
                                              const link = document.createElement("a");
                                              link.href = url;
                                              link.download = `ICU_Archive_${item.name.replace(/[^a-zA-Z0-9]/g, "_")}.json`;
                                              document.body.appendChild(link);
                                              link.click();
                                              document.body.removeChild(link);
                                            }}
                                            className="bg-[#222222] hover:bg-[#2A2A2A] text-zinc-300 hover:text-white border border-[#333333] px-2.5 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                                            title="Download app-readable JSON file format"
                                          >
                                            <Download className="w-3.5 h-3.5 text-amber-400" />
                                            JSON
                                          </button>
                                        </div>

                                        <div className="flex gap-2">
                                          <button
                                            onClick={async () => {
                                              if (confirm(`Do you want to restore "${item.name}" back to the active Patient Ward in the cloud?`)) {
                                                try {
                                                  const plainTextJson = JSON.stringify(item.jsonData);
                                                  const encryptedBlob = await encryptData(plainTextJson, passphrase!);
                                                  const docRef = doc(db, "patients", item.id);
                                                  await setDoc(docRef, {
                                                    encryptedBlob: encryptedBlob,
                                                    updatedAt: new Date().toISOString(),
                                                    updatedBy: nickname || "System Restore"
                                                  });
                                                  alert(`"${item.name}" restored successfully. Check the Patient Ward!`);
                                                  setMainView("patients");
                                                } catch (err: any) {
                                                  alert("Restoration failed: " + err.message);
                                                }
                                              }
                                            }}
                                            className="text-[10px] text-emerald-500 hover:text-emerald-400 font-bold uppercase tracking-widest cursor-pointer flex items-center gap-1"
                                            title="Restore patient record to live Cloud database"
                                          >
                                            <RefreshCw className="w-3 h-3 text-emerald-500" />
                                            Restore
                                          </button>

                                          <button
                                            onClick={() => {
                                              if (confirm(`Are you sure you want to delete the local archive for ${item.name}?`)) {
                                                const updated = archives.filter((a: any) => a.id !== item.id);
                                                localStorage.setItem("critisync_local_archives", JSON.stringify(updated));
                                                window.location.reload();
                                              }
                                            }}
                                            className="text-[10px] text-red-500 hover:text-red-400 font-bold uppercase tracking-widest cursor-pointer"
                                            title="Delete local backup permanently"
                                          >
                                            Delete
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

      </main>

      {/* 1. Custom Admission Modal Overlay */}
      {showAdmitModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-[#222222] rounded w-full max-w-md p-6 shadow-2xl space-y-4 animate-fade-in">
            <div className="flex items-center gap-3 border-b border-[#222222] pb-3 text-emerald-500">
              <Plus className="w-5 h-5" />
              <h3 className="font-serif text-lg italic">Admit New ICU Patient</h3>
            </div>
            
            {admitError && (
              <div className="p-3 bg-red-950/20 border border-red-900/30 text-red-400 text-xs rounded">
                {admitError}
              </div>
            )}

            <form onSubmit={handleConfirmAdmission} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-widest text-zinc-500 mb-1.5">
                  Enter Bed Number
                </label>
                <input
                  type="text"
                  value={admitBedValue}
                  onChange={(e) => setAdmitBedValue(e.target.value)}
                  placeholder="e.g. Bed-06, ICU-04"
                  className="w-full bg-[#1A1A1A] border border-[#222222] rounded px-3 py-2 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500 placeholder:text-zinc-700"
                  required
                  autoFocus
                />
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-[#222222]/50">
                <button
                  type="button"
                  onClick={() => setShowAdmitModal(false)}
                  className="bg-[#1A1A1A] hover:bg-[#222222] border border-[#222222] text-zinc-400 font-bold text-xs uppercase tracking-wider py-2 px-4 rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider py-2 px-4 rounded transition-colors"
                >
                  Confirm Admission
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Custom Discharge Confirmation Modal Overlay */}
      {showDischargeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-[#222222] rounded w-full max-w-md p-6 shadow-2xl space-y-4 animate-fade-in">
            <div className="flex items-center gap-3 border-b border-red-900/30 pb-3 text-red-500">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
              <h3 className="font-serif text-lg italic">Confirm Patient Discharge</h3>
            </div>
            
            <p className="text-xs text-zinc-400 leading-relaxed">
              Are you sure you want to <strong className="text-red-400">DISCHARGE</strong> patient <strong className="text-zinc-200">{dischargePatientName}</strong> and permanently delete their clinical records from the real-time cloud database?
            </p>
            
            <div className="p-3 bg-red-950/10 border border-red-900/25 rounded text-[10px] text-zinc-500 leading-relaxed uppercase tracking-wider font-semibold">
              ⚠️ Warning: This action is irreversible. Ensure you have exported and copied any necessary Discharge Summaries first.
            </div>

            <div className="flex gap-3 justify-end pt-2 border-t border-[#222222]/50">
              <button
                type="button"
                onClick={() => setShowDischargeModal(null)}
                className="bg-[#1A1A1A] hover:bg-[#222222] border border-[#222222] text-zinc-400 font-bold text-xs uppercase tracking-wider py-2 px-4 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDischarge}
                className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider py-2 px-4 rounded transition-colors"
              >
                Discharge Patient
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Global Notification Overlay (for database errors) */}
      {uiError && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce-in max-w-sm font-sans">
          <div className="bg-red-950/90 backdrop-blur-md border border-red-900 text-red-200 p-4 rounded shadow-2xl flex gap-3 items-start">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
            <div className="flex-1">
              <span className="block text-xs font-bold uppercase tracking-wider mb-1">System Error</span>
              <p className="text-[11px] text-zinc-300 leading-relaxed">{uiError}</p>
            </div>
            <button
              onClick={() => setUiError(null)}
              className="text-zinc-500 hover:text-zinc-300 font-bold text-xs"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 4. Success Invitation Instructions Modal Overlay */}
      {successInvite && (
        <div className="fixed inset-0 bg-[#000000]/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
          <div className="bg-[#111111] border border-[#222222] rounded shadow-2xl w-full max-w-md p-6 relative">
            <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-400 mb-3 flex items-center gap-1.5">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Clinician Authorized Successfully!
            </h3>
            
            <p className="text-xs text-zinc-300 leading-relaxed mb-4">
              <strong>{successInvite.name}</strong> is now registered in the CritiSync secure cluster.
              To sync their device, share these credentials with them securely (e.g., in person or via secure messaging):
            </p>

            <div className="bg-[#161616] border border-[#222222] p-3.5 rounded space-y-3 mb-5 font-mono text-[11px]">
              <div>
                <span className="block text-[9px] font-bold text-zinc-500 uppercase">Registered Contact</span>
                <span className="text-zinc-100 font-bold">{successInvite.contact}</span>
              </div>
              <div>
                <span className="block text-[9px] font-bold text-zinc-500 uppercase">ICU Group Passphrase (Symmetric Key)</span>
                <span className="text-amber-400 font-bold select-all">{successInvite.passphrase}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  const text = `Welcome to CritiSync ICU Roster!\n\nYou have been authorized to join our CritiSync Secure Hub.\n\nType this exactly on the Lock Screen:\n• Registered Contact: ${successInvite.contact}\n• ICU Group Passphrase: ${successInvite.passphrase}\n\nAll handovers are end-to-end encrypted client-side.`;
                  navigator.clipboard.writeText(text);
                  alert("Invitation text copied to clipboard!");
                }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Copy Invite Text
              </button>
              <button
                onClick={() => setSuccessInvite(null)}
                className="bg-[#222222] hover:bg-[#333333] text-zinc-300 font-bold py-2 px-4 rounded text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="mt-auto py-8 text-center text-xs text-zinc-600 border-t border-[#111111]/30 font-serif italic tracking-wide">
        Made by enigmaticdoc for educational purpose only
      </footer>
    </div>
  );
}
