import React from "react";
import {
  FileSpreadsheet,
  X,
  CheckCircle2,
  Loader2,
  Upload,
  AlertCircle
} from "lucide-react";
import { useLeadFinder } from "../../context/LeadFinderContext";

interface AttachmentWidgetProps {
  isCampaign?: boolean;
  accentColor?: string;
  title?: string;
  subtitle?: string;
}

export default function AttachmentWidget({
  isCampaign = false,
  title,
  subtitle,
}: AttachmentWidgetProps) {
  const {
    campaignAttachmentFile,
    attachmentFile,
    isUploadingCampaignAttachment,
    isUploadingAttachment,
    campaignAttachmentError,
    attachmentUploadError,
    campaignAttachmentInputRef,
    attachmentInputRef,
    handleUploadAttachment,
    handleClearAttachment
  } = useLeadFinder();

  const file = isCampaign ? campaignAttachmentFile : attachmentFile;
  const isUpl = isCampaign ? isUploadingCampaignAttachment : isUploadingAttachment;
  const err = isCampaign ? campaignAttachmentError : attachmentUploadError;
  const inputRef = isCampaign ? campaignAttachmentInputRef : attachmentInputRef;

  const displayTitle = title || "Email Document Attachment";

  return (
    <div className="space-y-2 p-3 border border-[#1e293b] rounded-xl bg-[#030712]">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
          <FileSpreadsheet className="h-3.5 w-3.5 text-indigo-400" />
          {displayTitle}
          <span className="text-slate-600 font-normal normal-case tracking-normal ml-1">(optional)</span>
        </span>
        {file && (
          <button
            type="button"
            onClick={() => handleClearAttachment(isCampaign)}
            className="text-[9px] text-rose-400 hover:text-rose-300 font-mono cursor-pointer bg-transparent border-0 p-0 flex items-center gap-1"
          >
            <X className="h-3 w-3" /> Remove
          </button>
        )}
      </div>
      {file ? (
        <div className="flex items-center gap-2 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{file.name}</span>
          <span className="text-slate-500 whitespace-nowrap ml-auto">({(file.size / 1024).toFixed(0)} KB)</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUpl}
          className="w-full flex items-center justify-center gap-2 text-[10px] font-mono text-slate-400 hover:text-white border border-dashed border-[#1e293b] hover:border-indigo-500/40 rounded-lg py-2.5 cursor-pointer transition-all bg-transparent disabled:opacity-50"
        >
          {isUpl ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading...
            </>
          ) : (
            <>
              <Upload className="h-3.5 w-3.5" /> Click to attach PDF, DOC, PPT or image
            </>
          )}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleUploadAttachment(f, isCampaign);
        }}
      />
      {err && (
        <p className="text-[9px] text-rose-400 font-mono flex items-center gap-1">
          <AlertCircle className="h-3 w-3 shrink-0" /> {err}
        </p>
      )}
      <p className="text-[9px] text-slate-600 font-sans">
        {subtitle || "PDF, DOC, DOCX, PPT, PPTX, JPG, PNG · max 20 MB · attaches directly to outgoing emails"}
      </p>
    </div>
  );
}
