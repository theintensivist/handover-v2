import React, { useState } from "react";
import { ReferralRecord, ReferralReview, TimelineRecord } from "../types";
import { PlusCircle, Stethoscope, ChevronDown, ChevronUp, Save, Clock, Trash2, CheckCircle2, MessageSquare, ClipboardList, Send } from "lucide-react";

interface PatientReferralTrackerProps {
  referrals: ReferralRecord[];
  timeline: TimelineRecord[];
  onSaveReferrals: (updatedReferrals: ReferralRecord[]) => void;
  onSaveTimeline: (newTimeline: TimelineRecord[]) => void;
  showToast: (msg: string, type: "success" | "error" | "info") => void;
}

export default function PatientReferralTracker({ referrals = [], timeline, onSaveReferrals, onSaveTimeline, showToast }: PatientReferralTrackerProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // New Referral State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSpecialty, setNewSpecialty] = useState("Cardiology");
  const [customSpecialty, setCustomSpecialty] = useState("");
  const [newReason, setNewReason] = useState("");
  const [newInitialInput, setNewInitialInput] = useState("");

  // New Review State (per referral)
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [reviewRole, setReviewRole] = useState<Record<string, string>>({});

  const specialtyOptions = [
    "Cardiology", "Pulmonology", "Nephrology", "Neurology", "Infectious Diseases", 
    "Gastroenterology", "Hematology", "Endocrinology", "General Surgery", 
    "Neurosurgery", "Cardiothoracic Surgery", "Orthopedics", "Palliative Care", 
    "Clinical Nutrition", "Clinical Pharmacology", "Other"
  ];

  const handleCreateReferral = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReason.trim()) {
      showToast("Reason for consultation is required.", "error");
      return;
    }

    const specialtyName = newSpecialty === "Other" && customSpecialty.trim() 
      ? customSpecialty.trim() 
      : newSpecialty;

    const newReferral: ReferralRecord = {
      id: "ref_" + Date.now(),
      specialty: specialtyName,
      status: "Pending Consultation",
      dateRequested: new Date().toISOString(),
      reasonForConsult: newReason,
      initialInput: newInitialInput ? newInitialInput : undefined,
      reviews: []
    };

    const updated = [newReferral, ...referrals];
    onSaveReferrals(updated);
    showToast(`Referral requested for ${specialtyName}.`, "success");

    // Also post to timeline
    const timelineEvent: TimelineRecord = {
      id: "ref_log_" + Date.now(),
      timestamp: new Date().toISOString(),
      updatedBy: "Referral Dashboard",
      role: "System",
      notes: `Specialty Referral Requested:\n• Specialty: ${specialtyName}\n• Clinical Question: ${newReason}`,
      level: "Info"
    };
    onSaveTimeline([timelineEvent, ...timeline]);

    // Reset Form
    setShowAddForm(false);
    setNewReason("");
    setNewInitialInput("");
    setCustomSpecialty("");
  };

  const handleUpdateStatus = (id: string, newStatus: ReferralRecord["status"]) => {
    const updated = referrals.map(ref => {
      if (ref.id === id) {
        return { ...ref, status: newStatus };
      }
      return ref;
    });
    onSaveReferrals(updated);
    showToast(`Referral status updated to: ${newStatus}`, "info");

    // Timeline event
    const ref = referrals.find(r => r.id === id);
    if (ref) {
      const timelineEvent: TimelineRecord = {
        id: "ref_status_" + Date.now(),
        timestamp: new Date().toISOString(),
        updatedBy: "Referral Dashboard",
        role: "System",
        notes: `Specialty Consultation Update:\n• Specialty: ${ref.specialty}\n• Status Changed to: ${newStatus}`,
        level: "Info"
      };
      onSaveTimeline([timelineEvent, ...timeline]);
    }
  };

  const handleAddReview = (refId: string) => {
    const note = reviewNotes[refId] || "";
    const role = reviewRole[refId] || "Consultant";
    
    if (!note.trim()) {
      showToast("Review note cannot be empty.", "error");
      return;
    }

    const ref = referrals.find(r => r.id === refId);
    if (!ref) return;

    const newReview: ReferralReview = {
      id: "rev_" + Date.now(),
      timestamp: new Date().toISOString(),
      reviewerRole: role,
      notes: note
    };

    const updatedReviews = [...(ref.reviews || []), newReview];
    
    const updated = referrals.map(r => {
      if (r.id === refId) {
        // Automatically upgrade status if it was pending
        const currentStatus = r.status === "Pending Consultation" ? "Recommendations Active" : r.status;
        return { ...r, reviews: updatedReviews, status: currentStatus };
      }
      return r;
    });

    onSaveReferrals(updated);
    showToast("Follow-up review recorded.", "success");

    // Clear state
    setReviewNotes(prev => ({ ...prev, [refId]: "" }));

    // Automatically append to central progress timeline
    const timelineEvent: TimelineRecord = {
      id: "ref_review_" + Date.now(),
      timestamp: new Date().toISOString(),
      updatedBy: role,
      role: "Consultant",
      notes: `Specialty Review Added (${ref.specialty}):\n${note}`,
      level: "Info"
    };
    onSaveTimeline([timelineEvent, ...timeline]);
  };

  const handleDeleteReferral = (id: string) => {
    const ref = referrals.find(r => r.id === id);
    if (!ref) return;
    if (!window.confirm(`Are you sure you want to remove the ${ref.specialty} referral records?`)) return;

    const updated = referrals.filter(r => r.id !== id);
    onSaveReferrals(updated);
    showToast(`Referral records for ${ref.specialty} deleted.`, "info");
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  return (
    <div className="bg-[#111111] border border-[#222222] p-5 rounded space-y-4">
      <div className="border-b border-[#222222] pb-3 flex justify-between items-center">
        <div>
          <span className="text-xs uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1.5 font-sans">
            <Stethoscope className="w-4 h-4 text-emerald-400" />
            Specialty Referrals & Consultation Tracking ({referrals.length})
          </span>
          <p className="text-[10px] text-zinc-550 mt-0.5 font-sans leading-normal">
            Consult interdisciplinary specialists, enter bedside recommendations, log follow-up reviews, and auto-sync with shift timelines.
          </p>
        </div>
        
        <button
          onClick={() => setShowAddForm(prev => !prev)}
          className="bg-emerald-950/40 border border-emerald-500/20 hover:border-emerald-500 hover:text-emerald-400 text-zinc-400 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded transition-all flex items-center gap-1 cursor-pointer font-sans"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          {showAddForm ? "Cancel Consult" : "New Consult Request"}
        </button>
      </div>

      {/* CREATE NEW REFERRAL FORM */}
      {showAddForm && (
        <form onSubmit={handleCreateReferral} className="p-4 bg-zinc-950/50 border border-zinc-900 rounded space-y-3 animate-fade-in font-sans text-xs text-zinc-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-[10px] text-zinc-400 font-bold uppercase">Select Specialty</label>
              <select
                value={newSpecialty}
                onChange={(e) => setNewSpecialty(e.target.value)}
                className="w-full bg-[#111111] border border-[#222222] rounded p-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
              >
                {specialtyOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            {newSpecialty === "Other" && (
              <div className="space-y-1">
                <label className="block text-[10px] text-zinc-400 font-bold uppercase">Custom Specialty Name</label>
                <input
                  type="text"
                  placeholder="e.g., Rheumatology"
                  value={customSpecialty}
                  onChange={(e) => setCustomSpecialty(e.target.value)}
                  className="w-full bg-[#111111] border border-[#222222] rounded p-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] text-zinc-400 font-bold uppercase">Clinical Question / Reason for Consultation</label>
            <textarea
              rows={2}
              placeholder="e.g., Please evaluate patient for progressive severe acute respiratory distress syndrome with suspected pulmonary hypertension. Specific question: Recommend vasoactive preferences?"
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              className="w-full bg-[#111111] border border-[#222222] focus:border-emerald-500/60 rounded p-2 text-xs leading-relaxed focus:outline-none text-zinc-100 placeholder:text-zinc-650"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] text-zinc-400 font-bold uppercase">Initial Input / Bedside Recommendations (Optional)</label>
            <textarea
              rows={2}
              placeholder="e.g., Advised by Cardiology Fellow on phone: Check troponins q6h, hold beta blockers, cleared for CVC."
              value={newInitialInput}
              onChange={(e) => setNewInitialInput(e.target.value)}
              className="w-full bg-[#111111] border border-[#222222] focus:border-emerald-500/60 rounded p-2 text-xs leading-relaxed focus:outline-none text-zinc-100 placeholder:text-zinc-650"
            />
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold uppercase tracking-wider py-1.5 px-4 rounded text-[10px] transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5 text-zinc-950" /> Dispatch Referral Request
            </button>
          </div>
        </form>
      )}

      {/* REFERRAL CARDS LIST */}
      {referrals.length === 0 ? (
        <div className="p-8 border border-dashed border-[#222222] rounded text-center text-zinc-550 text-xs font-sans">
          No specialty consults requested for this patient. Click "New Consult Request" to begin.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 font-sans">
          {referrals.map((ref) => {
            const isExpanded = expandedId === ref.id;
            const reviewCount = ref.reviews?.length || 0;
            
            // Status Badge Colors
            const badgeColor = 
              ref.status === "Pending Consultation" ? "text-amber-400 bg-amber-950/20 border-amber-900/30" :
              ref.status === "Recommendations Active" ? "text-emerald-400 bg-emerald-950/20 border-emerald-900/30" :
              "text-zinc-500 bg-zinc-900/40 border-zinc-850";

            return (
              <div 
                key={ref.id}
                className={`border rounded overflow-hidden transition-all duration-200 ${
                  isExpanded ? "bg-zinc-950/30 border-zinc-700/80" : "bg-[#141414]/80 border-[#222222] hover:border-zinc-800"
                }`}
              >
                {/* Header Row */}
                <div 
                  onClick={() => toggleExpand(ref.id)}
                  className="p-3.5 flex items-center justify-between gap-4 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded bg-zinc-900 border border-zinc-800 shrink-0 text-emerald-400">
                      <Stethoscope className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="font-bold text-zinc-100 text-xs tracking-wide">{ref.specialty}</span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          Requested: {new Date(ref.dateRequested).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5 leading-normal">
                        Question: {ref.reasonForConsult}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-widest ${badgeColor}`}>
                      {ref.status}
                    </span>
                    {reviewCount > 0 && (
                      <span className="text-[9px] bg-zinc-800/80 border border-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded font-mono font-bold shrink-0 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3 text-emerald-500" />
                        {reviewCount} {reviewCount === 1 ? "REVIEW" : "REVIEWS"}
                      </span>
                    )}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
                  </div>
                </div>

                {/* Expanded Details Body */}
                {isExpanded && (
                  <div className="border-t border-[#222222] p-4 bg-zinc-950/20 space-y-4 animate-fade-in text-xs text-zinc-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Reason & Initial Notes */}
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <span className="text-[9px] text-zinc-500 uppercase font-black tracking-wider block">Clinical Query</span>
                          <div className="p-3 bg-zinc-900/60 border border-zinc-850 rounded text-xs leading-relaxed text-zinc-300">
                            {ref.reasonForConsult}
                          </div>
                        </div>

                        {ref.initialInput && (
                          <div className="space-y-1">
                            <span className="text-[9px] text-zinc-500 uppercase font-black tracking-wider block">Bedside Recommendations / Initial Consultation note</span>
                            <div className="p-3 bg-emerald-950/5 border border-emerald-950 rounded text-xs leading-relaxed text-zinc-300">
                              {ref.initialInput}
                            </div>
                          </div>
                        )}

                        {/* Status controls */}
                        <div className="space-y-1 pt-1">
                          <span className="text-[9px] text-zinc-500 uppercase font-black tracking-wider block">Cycle Status</span>
                          <div className="flex gap-1.5">
                            {(["Pending Consultation", "Recommendations Active", "Completed / Closed"] as const).map(st => (
                              <button
                                key={st}
                                type="button"
                                onClick={() => handleUpdateStatus(ref.id, st)}
                                className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all border ${
                                  ref.status === st 
                                    ? "bg-emerald-950 border-emerald-600/30 text-emerald-400 font-black" 
                                    : "bg-zinc-900 border-zinc-850 text-zinc-500 hover:text-zinc-300"
                                }`}
                              >
                                {st.replace(" Consultation", "").replace(" Active", "")}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Continuous reviews history & review submit form */}
                      <div className="space-y-3.5 border-l border-[#222222] pl-4">
                        <div className="flex items-center justify-between border-b border-zinc-850 pb-1">
                          <span className="text-[9px] text-zinc-400 uppercase font-black tracking-wider block flex items-center gap-1">
                            <ClipboardList className="w-3.5 h-3.5 text-sky-400" />
                            Consultation Reviews & Daily Rounds History
                          </span>
                          <button
                            onClick={() => handleDeleteReferral(ref.id)}
                            className="text-zinc-650 hover:text-red-400 p-1 rounded transition-colors"
                            title="Delete Referral Records"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* History */}
                        {(!ref.reviews || ref.reviews.length === 0) ? (
                          <p className="text-[11px] text-zinc-550 italic font-sans py-2">
                            No follow-up reviews entered yet. Enter rounds recommendations below to track ongoing care plans.
                          </p>
                        ) : (
                          <div className="space-y-3 max-h-[180px] overflow-y-auto pr-1">
                            {ref.reviews
                              .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                              .map((rev) => (
                                <div key={rev.id} className="p-2.5 bg-zinc-950/40 border border-zinc-900 rounded space-y-1">
                                  <div className="flex justify-between items-center text-[10px] font-mono">
                                    <span className="text-sky-400 font-bold bg-sky-950/20 border border-sky-900/35 px-1.5 py-0.2 rounded uppercase">
                                      {rev.reviewerRole}
                                    </span>
                                    <span className="text-zinc-550 flex items-center gap-1">
                                      <Clock className="w-2.5 h-2.5" />
                                      {new Date(rev.timestamp).toLocaleDateString()} {new Date(rev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-zinc-300 leading-relaxed font-sans">{rev.notes}</p>
                                </div>
                              ))}
                          </div>
                        )}

                        {/* Input form to add another review */}
                        <div className="space-y-2 border-t border-[#222222] pt-3">
                          <span className="text-[9px] text-zinc-500 uppercase font-black tracking-wider block">Add Follow-up / Review Note</span>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="col-span-1">
                              <select
                                value={reviewRole[ref.id] || "Consultant"}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setReviewRole(prev => ({ ...prev, [ref.id]: val }));
                                }}
                                className="w-full bg-[#111111] border border-[#222222] rounded p-1.5 text-[10px] text-zinc-300 focus:outline-none focus:border-emerald-500"
                              >
                                <option value="Consultant">Consultant</option>
                                <option value="Consultant Attending">Attending</option>
                                <option value="Consultant Fellow">Fellow</option>
                                <option value="Specialist Nurse">Specialist Nurse</option>
                                <option value="ICU Team">ICU Team Note</option>
                              </select>
                            </div>
                            <div className="col-span-2 relative">
                              <input
                                type="text"
                                placeholder="Add review details or rounds changes..."
                                value={reviewNotes[ref.id] || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setReviewNotes(prev => ({ ...prev, [ref.id]: val }));
                                }}
                                className="w-full bg-[#111111] border border-[#222222] rounded pl-2 pr-8 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 placeholder:text-zinc-600"
                              />
                              <button
                                type="button"
                                onClick={() => handleAddReview(ref.id)}
                                className="absolute right-2 top-2 text-emerald-500 hover:text-emerald-400 cursor-pointer"
                                title="Submit Review"
                              >
                                <Send className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
