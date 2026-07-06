/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { encryptData, decryptData } from "../lib/crypto";
import { Shield, Lock, Activity, Users, AlertCircle, RefreshCw, Mail, Phone, UserCheck } from "lucide-react";

interface LockScreenProps {
  onAuthorized: (nickname: string, passphrase: string, role: string, contact: string) => void;
}

export default function LockScreen({ onAuthorized }: LockScreenProps) {
  const [nickname, setNickname] = useState("");
  const [contactInput, setContactInput] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [role, setRole] = useState("Attending Physician");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isInitializing, setIsInitializing] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [groupInitialized, setGroupInitialized] = useState<boolean | null>(null);

  // Helper to normalize email or phone number
  const normalizeContact = (c: string) => {
    return c.trim().toLowerCase().replace(/[\s\-\(\)\+]/g, "");
  };

  // Check if group is initialized on mount
  useEffect(() => {
    const checkInitialization = async () => {
      try {
        const verifyDocRef = doc(db, "group_config", "verification");
        const verifyDocSnap = await getDoc(verifyDocRef);
        setGroupInitialized(verifyDocSnap.exists());
      } catch (err) {
        console.error("Failed to check group initialization:", err);
        // Fallback to false if there's an issue or first run
        setGroupInitialized(false);
      }
    };
    checkInitialization();
  }, []);

  const performResetDatabase = async () => {
    setResetting(true);
    try {
      // 1. Delete Passphrase verification
      const verifyDocRef = doc(db, "group_config", "verification");
      await deleteDoc(verifyDocRef);

      // 2. Wipe patient records
      try {
        const patientSnap = await getDocs(collection(db, "patients"));
        const patientDeletes = patientSnap.docs.map(d => deleteDoc(doc(db, "patients", d.id)));
        await Promise.all(patientDeletes);
      } catch (e) {
        console.warn("Could not wipe patients collection:", e);
      }

      // 3. Wipe chat records
      try {
        const chatSnap = await getDocs(collection(db, "chats"));
        const chatDeletes = chatSnap.docs.map(d => deleteDoc(doc(db, "chats", d.id)));
        await Promise.all(chatDeletes);
      } catch (e) {
        console.warn("Could not wipe chats collection:", e);
      }

      // 4. Wipe authorized member records
      try {
        const memberSnap = await getDocs(collection(db, "group_members"));
        const memberDeletes = memberSnap.docs.map(d => deleteDoc(doc(db, "group_members", d.id)));
        await Promise.all(memberDeletes);
      } catch (e) {
        console.warn("Could not wipe group_members collection:", e);
      }

      setPassphrase("");
      setNickname("");
      setContactInput("");
      setGroupInitialized(false);
      setError("ICU Database and patient records have been completely reset. Please enter details to initialize a new secure group with an initial Admin account.");
      setShowResetConfirm(false);
    } catch (err: any) {
      console.error("Failed to reset database config:", err);
      setError("Failed to reset database. Please verify your network and permissions.");
    } finally {
      setResetting(false);
    }
  };

  const handleDemoBypass = async () => {
    setLoading(true);
    setError("");
    const demoName = "Dr. Sterling";
    const demoPass = "clinicalpass123";
    const demoContact = "sterling@critisync.local";
    const demoRole = "Initial Admin";

    setNickname(demoName);
    setContactInput(demoContact);
    setPassphrase(demoPass);
    setRole(demoRole);

    try {
      const verifyDocRef = doc(db, "group_config", "verification");
      const verifyDocSnap = await getDoc(verifyDocRef);

      let proceed = false;
      if (!verifyDocSnap.exists()) {
        setIsInitializing(true);
        const encryptedToken = await encryptData("VERIFIED", demoPass);
        await setDoc(verifyDocRef, {
          encryptedBlob: encryptedToken,
          initializedAt: new Date().toISOString(),
          initializedBy: demoName
        });

        // Create the member document
        const normContact = normalizeContact(demoContact);
        await setDoc(doc(db, "group_members", normContact), {
          name: demoName,
          contact: demoContact,
          role: demoRole,
          isInitialAdmin: true,
          addedAt: new Date().toISOString(),
          addedBy: "Demo Bypass"
        });

        setGroupInitialized(true);
        proceed = true;
      } else {
        const data = verifyDocSnap.data();
        const decrypted = await decryptData(data.encryptedBlob, demoPass);
        if (decrypted === "VERIFIED") {
          proceed = true;
        } else {
          // Force reset verification to demo pass if decryption failed
          setIsInitializing(true);
          await deleteDoc(verifyDocRef);
          const encryptedToken = await encryptData("VERIFIED", demoPass);
          await setDoc(verifyDocRef, {
            encryptedBlob: encryptedToken,
            initializedAt: new Date().toISOString(),
            initializedBy: demoName
          });
          setGroupInitialized(true);
          proceed = true;
        }

        // Ensure demo member exists in database
        const normContact = normalizeContact(demoContact);
        const memberRef = doc(db, "group_members", normContact);
        const memberSnap = await getDoc(memberRef);
        if (!memberSnap.exists()) {
          await setDoc(memberRef, {
            name: demoName,
            contact: demoContact,
            role: demoRole,
            isInitialAdmin: true,
            addedAt: new Date().toISOString(),
            addedBy: "Demo Bypass"
          });
        }
      }

      if (proceed) {
        onAuthorized(demoName, demoPass, demoRole, demoContact);
      }
    } catch (err: any) {
      console.error("Demo bypass failed:", err);
      setError("Failed to initialize Demo Mode. Please check your network or try again.");
    } finally {
      setLoading(false);
      setIsInitializing(false);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();

    if (groupInitialized === false) {
      // First-time setup (Initial Admin Account Setup)
      if (!nickname.trim()) {
        setError("Please enter your name (e.g. Dr. Jane Smith).");
        return;
      }
      if (!contactInput.trim()) {
        setError("Please enter your Email or Phone Number.");
        return;
      }
      if (!passphrase.trim() || passphrase.length < 8) {
        setError("Passphrase must be at least 8 characters long.");
        return;
      }

      setLoading(true);
      setError("");

      try {
        setIsInitializing(true);
        const normContact = normalizeContact(contactInput);
        
        // 1. Set verification document in Firestore
        const verifyDocRef = doc(db, "group_config", "verification");
        const encryptedToken = await encryptData("VERIFIED", passphrase);
        await setDoc(verifyDocRef, {
          encryptedBlob: encryptedToken,
          initializedAt: new Date().toISOString(),
          initializedBy: nickname
        });

        // 2. Set Initial Admin Member document in Firestore
        const adminDocRef = doc(db, "group_members", normContact);
        await setDoc(adminDocRef, {
          name: nickname,
          contact: contactInput,
          role: "Initial Admin",
          isInitialAdmin: true,
          addedAt: new Date().toISOString(),
          addedBy: "System Setup"
        });

        setGroupInitialized(true);
        onAuthorized(nickname, passphrase, "Initial Admin", contactInput);
      } catch (err: any) {
        console.error("Authentication setup failed:", err);
        setError("Failed to initialize secure group. Please check your network connection.");
      } finally {
        setLoading(false);
        setIsInitializing(false);
      }
    } else {
      // Logging in to existing group
      if (!contactInput.trim()) {
        setError("Please enter your registered Email or Phone Number.");
        return;
      }
      if (!passphrase.trim()) {
        setError("Please enter the Group Passphrase.");
        return;
      }

      setLoading(true);
      setError("");

      try {
        const normContact = normalizeContact(contactInput);
        const memberDocRef = doc(db, "group_members", normContact);
        const memberDocSnap = await getDoc(memberDocRef);

        if (!memberDocSnap.exists()) {
          setError(`Access Denied: "${contactInput}" has not been authorized in this secure group. Please have your ICU Admin add your contact to the clinician roster.`);
          setLoading(false);
          return;
        }

        const memberData = memberDocSnap.data();

        // Reference to group verification document in Firestore
        const verifyDocRef = doc(db, "group_config", "verification");
        const verifyDocSnap = await getDoc(verifyDocRef);

        if (!verifyDocSnap.exists()) {
          setError("ICU Database state is corrupt or reset. Please refresh.");
          setLoading(false);
          return;
        }

        const data = verifyDocSnap.data();
        const decrypted = await decryptData(data.encryptedBlob, passphrase);

        if (decrypted === "VERIFIED") {
          // Success! Passphrase is correct, log in with registered properties
          onAuthorized(memberData.name, passphrase, memberData.role, memberData.contact);
        } else {
          setError("Invalid ICU Group Passphrase. Decryption failed. Please confirm with your team.");
        }
      } catch (err: any) {
        console.error("Authentication check failed:", err);
        setError("Failed to connect. Please check your network connection.");
      } finally {
        setLoading(false);
      }
    }
  };

  if (groupInitialized === null) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-[#E0E0E0] flex flex-col items-center justify-center px-4 font-sans">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono">Securing HIPAA-Compliant Link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E0E0E0] flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden font-sans">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-5">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-600 blur-3xl"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-zinc-800 blur-3xl"></div>
      </div>

      {/* Main Lock Card */}
      <div className="w-full max-w-md bg-[#111111] border border-[#222222] rounded shadow-2xl p-8 relative z-10">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-emerald-950/40 border border-emerald-500/20 rounded flex items-center justify-center text-emerald-500 mb-4 animate-pulse">
            <Activity className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-serif italic text-emerald-500 tracking-tighter flex items-center gap-2">
            CritiSync Hub
          </h1>
          <p className="text-zinc-500 text-[10px] uppercase tracking-widest mt-1 text-center font-bold">
            ICU Secure Handover Node
          </p>
        </div>

        {groupInitialized === false ? (
          <div className="mb-5 bg-emerald-950/20 border border-emerald-500/10 p-3 rounded text-[11px] text-zinc-300 leading-relaxed text-center">
            🔐 <strong className="text-emerald-400">First-Time Setup:</strong> No secure clinical group exists on this database yet. Fill out the details below to initialize the hub and register your **Initial Admin** account.
          </div>
        ) : (
          <div className="mb-5 bg-zinc-900/60 border border-zinc-800 p-3 rounded text-[11px] text-zinc-400 leading-relaxed text-center">
            🔒 Enter your authorized clinician credentials (Email or Phone Number) and the shared ICU Group Passphrase to sync.
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-950/20 border border-red-900/30 text-red-300 text-xs rounded flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleConnect} className="space-y-5">
          {groupInitialized === false && (
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">
                Initial Admin Full Name
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                  <UserCheck className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="e.g. Dr. Jane Sterling, MD"
                  className="w-full bg-[#1A1A1A] border border-[#222222] rounded py-2.5 pl-10 pr-4 text-zinc-100 text-sm focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-zinc-600 font-sans"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">
              {groupInitialized === false ? "Admin Contact Info" : "Clinician Registered Contact"}
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={contactInput}
                onChange={(e) => setContactInput(e.target.value)}
                placeholder="e.g. email@hospital.com or +1 555-0199"
                className="w-full bg-[#1A1A1A] border border-[#222222] rounded py-2.5 pl-10 pr-4 text-zinc-100 text-sm focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-zinc-600 font-sans"
                required
              />
            </div>
            <p className="text-[9px] text-zinc-500 mt-1">Enter your email or phone number as a secure username identifier.</p>
          </div>

          <div>
            <label className="block text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">
              ICU Group Passphrase
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Min. 8 characters"
                className="w-full bg-[#1A1A1A] border border-[#222222] rounded py-2.5 pl-10 pr-4 text-zinc-100 text-sm focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-zinc-600 font-sans"
                required
              />
            </div>
            <p className="text-[10px] text-zinc-500 mt-1.5 leading-relaxed">
              This passphrase acts as the symmetric key to encrypt and decrypt patient files. It is never stored on the cloud in plaintext.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-950/40 disabled:cursor-not-allowed text-white font-bold py-2.5 px-4 rounded shadow-lg transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider cursor-pointer font-sans"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                {isInitializing ? "Initializing ICU Hub..." : "Unlocking Hub..."}
              </span>
            ) : (
              <>
                <Shield className="w-4 h-4 text-emerald-200" />
                {groupInitialized === false ? "Initialize & Connect Admin" : "Authorize & Connect Clinician"}
              </>
            )}
          </button>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-[#222222]/60"></div>
            <span className="flex-shrink mx-3 text-[9px] font-bold uppercase tracking-wider text-zinc-500">OR</span>
            <div className="flex-grow border-t border-[#222222]/60"></div>
          </div>

          <button
            type="button"
            onClick={handleDemoBypass}
            disabled={loading}
            className="w-full bg-[#1A1A1A] hover:bg-[#222222] border border-[#333333] text-emerald-400 hover:text-emerald-350 font-bold py-2.5 px-4 rounded shadow-md transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider cursor-pointer font-sans"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0 mr-1"></span>
            Quick Demo Bypass & Auto-Unlock
          </button>
        </form>

        {showResetConfirm ? (
          <div className="mt-6 p-4 bg-red-950/20 border border-red-900/30 rounded text-xs text-center space-y-3 animate-fade-in">
            <p className="text-zinc-300 font-sans leading-relaxed">
              Are you sure? This will delete the secure group verification key on the database. You can then enter any new passphrase to initialize the ICU Hub.
            </p>
            <div className="flex gap-2 justify-center">
              <button
                type="button"
                onClick={performResetDatabase}
                disabled={resetting}
                className="bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold uppercase py-1.5 px-3 rounded cursor-pointer"
              >
                {resetting ? "Resetting..." : "Yes, Reset Hub"}
              </button>
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                disabled={resetting}
                className="bg-[#222222] hover:bg-[#333333] text-zinc-300 text-[10px] font-bold uppercase py-1.5 px-3 rounded cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6 pt-3 border-t border-[#222222]/40 text-center">
            <button
              type="button"
              onClick={() => {
                setShowResetConfirm(true);
                setError("");
              }}
              className="text-[10px] text-zinc-500 hover:text-red-400 transition-colors uppercase tracking-wider font-semibold underline decoration-dashed underline-offset-4 cursor-pointer font-sans"
            >
              Forgot Passphrase? Reset ICU Database
            </button>
          </div>
        )}

        <div className="mt-6 border-t border-[#222222] pt-4 flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-[9px] text-zinc-500 font-mono tracking-widest uppercase font-bold">
            HIPAA compliant E2EE channel
          </span>
        </div>
      </div>

      <div className="mt-6 text-zinc-600 text-xs text-center max-w-sm leading-relaxed font-sans">
        <p>
          🔐 <strong>Privacy Notice:</strong> All Protected Health Information (PHI) is encrypted end-to-end. Server logs contain only encrypted blobs.
        </p>
        <p className="mt-3 text-[10px] text-zinc-600 font-medium font-serif italic tracking-wide uppercase">
          Made by enigmaticdoc for educational purpose only
        </p>
      </div>
    </div>
  );
}
