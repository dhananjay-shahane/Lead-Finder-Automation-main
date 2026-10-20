import React from "react";
import { Send, X, Smartphone, Mail, Shield } from "lucide-react";
import { useLeadFinder } from "../../context/LeadFinderContext";
import AttachmentWidget from "./AttachmentWidget";

export default function LeadOutreachModal() {
  const {
    selectedLeadForOutreach,
    setSelectedLeadForOutreach,
    outreachWhatsappMsg,
    setOutreachWhatsappMsg,
    handleSendWhatsapp,
    isSendingWhatsapp,
    whatsappStatus,
    attachmentFile,
    outreachEmailSubject,
    setOutreachEmailSubject,
    outreachEmailBody,
    setOutreachEmailBody,
    handleSendEmail,
    isSendingEmail,
    smtpHost,
    smtpUser,
  } = useLeadFinder();

  const [activeChannel, setActiveChannel] = React.useState<"whatsapp" | "email">("whatsapp");

  if (!selectedLeadForOutreach) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#090d16] border border-[#1e293b] rounded-2xl w-full max-w-3xl shadow-2xl relative flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#1e293b]/60 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Send className="h-5 w-5 text-indigo-400" /> Lead Outreach Console
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Drafting outreach pitches for <strong className="text-white">{selectedLeadForOutreach.businessName}</strong>
            </p>
          </div>
          <button
            onClick={() => setSelectedLeadForOutreach(null)}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Channel Tab Selector */}
        <div className="px-6 pt-4 pb-2 border-b border-[#1e293b]/40 flex items-center gap-2 bg-[#060a12]">
          <button
            type="button"
            onClick={() => setActiveChannel("whatsapp")}
            className={`px-3.5 py-1.5 rounded-xl font-mono text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeChannel === "whatsapp"
                ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 shadow-sm"
                : "bg-slate-900/60 text-slate-400 border border-[#1e293b] hover:text-white"
            }`}
          >
            <Smartphone className="h-4 w-4" />
            <span>WhatsApp</span>
            <span
              className={`text-[9px] px-1.5 py-0.2 rounded ${
                selectedLeadForOutreach.whatsappStatus === "SENT"
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {selectedLeadForOutreach.whatsappStatus || "PENDING"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveChannel("email")}
            className={`px-3.5 py-1.5 rounded-xl font-mono text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeChannel === "email"
                ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/40 shadow-sm"
                : "bg-slate-900/60 text-slate-400 border border-[#1e293b] hover:text-white"
            }`}
          >
            <Mail className="h-4 w-4" />
            <span>Email</span>
            <span
              className={`text-[9px] px-1.5 py-0.2 rounded ${
                selectedLeadForOutreach.emailStatus === "SENT"
                  ? "bg-indigo-500/20 text-indigo-300"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {selectedLeadForOutreach.emailStatus || "PENDING"}
            </span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto">
          {/* WhatsApp Channel */}
          {activeChannel === "whatsapp" && (
            <div className="space-y-4 flex flex-col h-full">
              <div className="flex items-center justify-between pb-2 border-b border-[#1e293b]/40">
                <span className="text-xs font-bold font-mono text-emerald-400 flex items-center gap-1.5">
                  <Smartphone className="h-4 w-4" /> WhatsApp Message Pitch
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {outreachWhatsappMsg.length} chars
                </span>
              </div>

              <textarea
                value={outreachWhatsappMsg}
                onChange={(e) => setOutreachWhatsappMsg(e.target.value)}
                className="w-full min-h-[260px] bg-[#030712] border border-[#1e293b] rounded-xl p-4 text-xs font-mono text-slate-200 leading-relaxed focus:outline-none focus:border-emerald-500 resize-y"
                placeholder="Customized WhatsApp outreach text..."
              />

              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-slate-500 font-mono">
                  Recipient: <strong className="text-white">{selectedLeadForOutreach.phone || "No phone number"}</strong>
                </span>

                <button
                  onClick={handleSendWhatsapp}
                  disabled={isSendingWhatsapp || !selectedLeadForOutreach.phone || whatsappStatus.status !== "CONNECTED"}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-mono font-bold rounded-lg cursor-pointer transition-all shadow-md shadow-emerald-600/10"
                >
                  {isSendingWhatsapp
                    ? "Delivering message..."
                    : "Send WhatsApp message"}
                </button>
              </div>
            </div>
          )}

          {/* Email Channel */}
          {activeChannel === "email" && (
            <div className="space-y-4 flex flex-col h-full">
              <div className="flex items-center justify-between pb-2 border-b border-[#1e293b]/40">
                <span className="text-xs font-bold font-mono text-indigo-400 flex items-center gap-1.5">
                  <Mail className="h-4 w-4" /> Email Pitch Details
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  SMTP Delivery
                </span>
              </div>

              <div className="space-y-3 flex-grow flex flex-col">
                <div>
                  <label className="block text-[9px] font-bold font-mono text-slate-500 mb-1">Subject Header</label>
                  <input
                    type="text"
                    value={outreachEmailSubject}
                    onChange={(e) => setOutreachEmailSubject(e.target.value)}
                    className="w-full bg-[#030712] border border-[#1e293b] rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                    placeholder="Email subject..."
                  />
                </div>

                <div className="flex-grow flex flex-col">
                  <label className="block text-[9px] font-bold font-mono text-slate-500 mb-1">Message Body</label>
                  <textarea
                    value={outreachEmailBody}
                    onChange={(e) => setOutreachEmailBody(e.target.value)}
                    className="w-full min-h-[220px] bg-[#030712] border border-[#1e293b] rounded-xl p-4 text-xs font-mono text-slate-200 leading-relaxed focus:outline-none focus:border-indigo-500 resize-y"
                    placeholder="Customized B2B pitch email body..."
                  />
                </div>
              </div>

              {/* Email Attachment */}
              <AttachmentWidget
                isCampaign={false}
                title="Email Document Attachment"
                subtitle="PDF, DOC, DOCX, PPT, PPTX, JPG, PNG · max 20 MB · attached to outgoing email"
              />

              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-slate-500 font-mono truncate max-w-[240px]">
                  To:{" "}
                  <strong className="text-white">
                    {selectedLeadForOutreach.emails && selectedLeadForOutreach.emails.length > 0
                      ? selectedLeadForOutreach.emails[0]
                      : "No email detected"}
                  </strong>
                </span>

                <button
                  onClick={handleSendEmail}
                  disabled={
                    isSendingEmail ||
                    !selectedLeadForOutreach.emails ||
                    selectedLeadForOutreach.emails.length === 0 ||
                    !smtpHost ||
                    !smtpUser
                  }
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-mono font-bold rounded-lg cursor-pointer transition-all shadow-md shadow-indigo-600/10"
                >
                  {isSendingEmail
                    ? "Transmitting..."
                    : attachmentFile
                    ? "Send Email with Attachment"
                    : "Send Outreach Email"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer warning */}
        <div className="px-6 py-3 border-t border-[#1e293b]/60 flex items-center justify-between bg-slate-950/40 font-mono text-[9px] text-slate-500">
          <span className="flex items-center gap-1">
            <Shield className="h-3.5 w-3.5 text-indigo-400" /> Multi-Channel Outreach Safeguard Active
          </span>
          <span>Individual messages dispatch immediately. Campaign mode spaces deliveries to prevent carrier limits.</span>
        </div>
      </div>
    </div>
  );
}
