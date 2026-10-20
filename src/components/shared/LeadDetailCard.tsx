import React from "react";
import { X, Sparkles, ExternalLink, Send, Trash2 } from "lucide-react";
import { useLeadFinder } from "../../context/LeadFinderContext";

export default function LeadDetailCard() {
  const {
    selectedLeadDetails,
    setSelectedLeadDetails,
    handleOpenOutreach,
    setActiveTab,
    handleDeleteLead
  } = useLeadFinder();

  if (!selectedLeadDetails) return null;

  return (
    <div className="lg:col-span-4 bg-[#090d16] border border-[#1e293b] rounded-2xl p-6 space-y-5 relative animate-in fade-in duration-200">
      <button
        onClick={() => setSelectedLeadDetails(null)}
        className="absolute top-4 right-4 p-1 rounded hover:bg-slate-800 text-slate-400 cursor-pointer"
        title="Close Details"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="border-b border-[#1e293b]/60 pb-3">
        <h3 className="font-bold text-sm text-white font-sans pr-6 leading-tight">
          {selectedLeadDetails.businessName}
        </h3>
        <span className="text-[10px] font-mono text-slate-400 mt-1 block">{selectedLeadDetails.category}</span>
      </div>

      <div className="space-y-4 text-xs font-mono">
        {/* AI Hooks */}
        <div className="bg-[#6366f1]/5 border border-[#6366f1]/25 p-3.5 rounded-xl">
          <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1.5">Sales Insight hook</h4>
          <p className="text-[11px] text-slate-200 font-sans leading-relaxed">
            "{selectedLeadDetails.aiInsight || "No specific gaps recorded."}"
          </p>
        </div>

        {/* Technical audit checklist */}
        <div className="space-y-2 border-b border-[#1e293b]/60 pb-4">
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Technical Indicators</h4>

          <div className="flex items-center justify-between">
            <span>Google Rating:</span>
            <span className="text-white font-sans">
              {selectedLeadDetails.rating} ⭐ ({selectedLeadDetails.reviews} revs)
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Website Status:</span>
            <span
              className={`text-[10px] font-bold uppercase ${
                selectedLeadDetails.websiteStatus === "WORKING"
                  ? "text-emerald-400"
                  : selectedLeadDetails.websiteStatus === "OUTDATED"
                  ? "text-amber-400"
                  : "text-rose-400"
              }`}
            >
              {selectedLeadDetails.websiteStatus}
            </span>
          </div>
          {selectedLeadDetails.outdatedReason && (
            <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-500/30 text-[10px] text-amber-200/90 leading-relaxed font-mono">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-amber-300 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-amber-400" />
                  AI Website Audit
                </span>
                {selectedLeadDetails.redesignOpportunity && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-amber-500/20 text-amber-300">
                    {selectedLeadDetails.redesignOpportunity} REDESIGN OPP
                  </span>
                )}
              </div>
              <span>{selectedLeadDetails.outdatedReason}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span>Emails Discovered:</span>
            <span className="text-white font-sans truncate max-w-[180px]">
              {selectedLeadDetails.emails && selectedLeadDetails.emails.length > 0
                ? selectedLeadDetails.emails[0]
                : "None"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Google Analytics:</span>
            <span className={selectedLeadDetails.googleAnalyticsPresent ? "text-emerald-400" : "text-slate-500"}>
              {selectedLeadDetails.googleAnalyticsPresent ? "Active" : "Missing"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Meta Retargeting Pixel:</span>
            <span className={selectedLeadDetails.metaPixelPresent ? "text-emerald-400" : "text-slate-500"}>
              {selectedLeadDetails.metaPixelPresent ? "Active" : "Missing"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Direct Booking System:</span>
            <span className={selectedLeadDetails.appointmentSystem ? "text-emerald-400" : "text-slate-500"}>
              {selectedLeadDetails.appointmentSystem ? "Detected" : "Missing"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>WhatsApp Widget:</span>
            <span className={selectedLeadDetails.whatsappPresent ? "text-emerald-400" : "text-slate-500"}>
              {selectedLeadDetails.whatsappPresent ? "Present" : "Missing"}
            </span>
          </div>
        </div>

        {/* Social Presence check */}
        <div className="space-y-2 pb-1">
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Social Channels Presence</h4>

          <div className="flex items-center justify-between">
            <span>Instagram status:</span>
            <span
              className={`text-[10px] font-bold ${
                selectedLeadDetails.instagramStatus === "ACTIVE" ? "text-emerald-400" : "text-slate-500"
              }`}
            >
              {selectedLeadDetails.instagramStatus}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Facebook status:</span>
            <span
              className={`text-[10px] font-bold ${
                selectedLeadDetails.facebookStatus === "ACTIVE" ? "text-emerald-400" : "text-slate-500"
              }`}
            >
              {selectedLeadDetails.facebookStatus}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>LinkedIn status:</span>
            <span
              className={`text-[10px] font-bold ${
                selectedLeadDetails.linkedinStatus === "ACTIVE" ? "text-emerald-400" : "text-slate-500"
              }`}
            >
              {selectedLeadDetails.linkedinStatus}
            </span>
          </div>
        </div>

        <div className="pt-2 flex flex-col gap-2">
          <div className="flex gap-2">
            <a
              href={selectedLeadDetails.mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 py-2 px-3 border border-[#1e293b] hover:bg-slate-800/40 text-slate-300 rounded-lg text-center flex items-center justify-center gap-1.5 select-none text-xs"
            >
              <ExternalLink className="h-3.5 w-3.5" /> View on Maps
            </a>
            <button
              type="button"
              onClick={() => {
                handleOpenOutreach(selectedLeadDetails);
                setActiveTab("outreach");
              }}
              className="flex-1 py-2 px-3 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-center flex items-center justify-center gap-1.5 select-none text-xs font-semibold cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" /> Pitch Lead
            </button>
          </div>
          <button
            type="button"
            onClick={async () => {
              if (
                confirm(
                  `Are you sure you want to delete "${selectedLeadDetails.businessName}"? This will permanently remove it from data/leads.json and CSV.`
                )
              ) {
                await handleDeleteLead(selectedLeadDetails);
                setSelectedLeadDetails(null);
              }
            }}
            className="w-full py-2 px-3 bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 border border-rose-500/25 hover:border-rose-500/40 rounded-lg text-center flex items-center justify-center gap-1.5 select-none text-xs font-medium cursor-pointer transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete Lead Permanently
          </button>
        </div>
      </div>
    </div>
  );
}
