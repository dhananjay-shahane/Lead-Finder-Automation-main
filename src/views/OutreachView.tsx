import React, { useState, useMemo, useEffect } from "react";
import {
  Target,
  Send,
  Building2,
  CheckCircle2,
  Edit3,
  Mail,
  Zap,
  Loader2,
  X,
  BarChart2,
  Play,
  Pause,
  Square,
  Clock,
  Calendar,
  History,
  Terminal as TerminalIcon,
  Users,
  Sparkles,
  ExternalLink,
  RefreshCw,
  Wand2,
  Download,
  Trash2,
  Plus,
  FileSpreadsheet,
  HardDrive,
  Check,
  Flame,
  Layers,
  Phone,
  Upload,
  Copy,
  Eye,
  Save,
  MessageSquare,
  ChevronDown,
  Code,
  FileText,
  AlertTriangle,
  ArrowRight
} from "lucide-react";
import { useLeadFinder } from "../context/LeadFinderContext";
import AttachmentWidget from "../components/shared/AttachmentWidget";
import { PitchStrategy, PitchTemplateConfig, CustomTemplateItem } from "../types";

// Helper to derive clean, handsome campaign title from a CSV file name
function deriveCampaignNameFromFilename(filename?: string): string {
  if (!filename) return "Outreach Campaign";
  let s = String(filename).trim();
  s = s.replace(/\.[a-zA-Z0-9]+$/i, "");
  s = s.replace(/^local\s*file:\s*/i, "");
  // Remove date patterns like 2026-09-30_18-35 or 2026-09-30
  s = s.replace(/[\-_]?\d{4}[\-_]\d{2}[\-_]\d{2}(?:[\-_]\d{2}[\-_]\d{2}(?:[\-_]\d{2})?)?[\-_]?/gi, " ");
  // Remove trailing or isolated email / leads / enails tokens
  s = s.replace(/\b(emails?|enails?|leads?|data)\b/gi, " ");
  s = s.replace(/[\-_]+/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return "Outreach Campaign";
  const words = s.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  return `${words.join(" ")} Campaign`;
}

// Helper to format campaign display name, ensuring it NEVER displays raw 'Local File: ...' or '.csv'
function formatDisplayCampaignTitle(name?: string, source?: string): string {
  const raw = String(name || "").replace(/^Local File:\s*/i, "").trim();
  if (raw && !raw.toLowerCase().endsWith(".csv") && !raw.toLowerCase().includes(".csv")) {
    return raw;
  }
  return deriveCampaignNameFromFilename(raw || source);
}

// Helper to format file age nicely
function formatAge(dateStr?: string): string {
  if (!dateStr) return "Just now";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDays = Math.floor(diffHour / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  return `${Math.floor(diffMonths / 12)}y ago`;
}

export const OutreachView: React.FC = () => {
  const {
    campaignRunning,
    campaignPaused,
    campaignProgress,
    campaignDelay,
    setCampaignDelay,
    campaignEnableEmail,
    setCampaignEnableEmail,
    campaignEnableWhatsapp,
    setCampaignEnableWhatsapp,
    campaignDryRun,
    setCampaignDryRun,
    campaignSheets,
    selectedCampaignSheet,
    setSelectedCampaignSheet,
    isLoadingSheets,
    fetchCampaignSheets,
    handleStartCampaign,
    handleStopCampaign,
    isStartingCampaign,
    isStoppingCampaign,
    pitchTemplates,
    setPitchTemplates,
    handleSaveTemplates,
    handleSetStrategy,
    handleSetGoal,
    setActiveTab,
    setSettingsSubView,
    campaignLogs,
    handleClearCampaignLogs,
    campaignAttachmentFile,
    campaignAttachmentFilename,
    availableFolders,
    isLoadingFolders,
    fetchFolders,
    selectedFolderId,
    setSelectedFolderId,
    handleUploadCsvFile,
    campaignHistory,
    scheduledCampaigns,
    isPausingCampaign,
    isResumingCampaign,
    handlePauseCampaign,
    handleResumeCampaign,
    fetchCampaignHistory,
    fetchScheduledCampaigns,
    handleScheduleCampaign,
    handleDeleteSchedule,
    handleRunScheduledNow,
    handleClearCampaignHistory,
    handleDeleteCampaignHistoryItem,
    whatsappStatus,
    setCampaignRunning,
    activeCampaignData
  } = useLeadFinder();

  const [outreachNavTab, setOutreachNavTab] = useState<"hub" | "create" | "running" | "scheduled" | "history">("create");
  const [campaignName, setCampaignName] = useState(
    `Campaign ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
  );
  const [dataSourceTab, setDataSourceTab] = useState<"upload" | "existing" | "sheet">("upload");
  const [selectedCsvFile, setSelectedCsvFile] = useState<string | null>(null);
  const [campaignRunMode, setCampaignRunMode] = useState<"background_now" | "schedule">("background_now");
  const [campaignScheduleTime, setCampaignScheduleTime] = useState("");
  const [isLaunchingCampaign, setIsLaunchingCampaign] = useState(false);

  // 1-second live ticker for real-time duration updates
  const [, setNowTicker] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTicker(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // CSV local upload states
  const [isUploadingCsv, setIsUploadingCsv] = useState(false);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<string | null>(null);

  // Safely parse campaignLogs strictly for campaign console
  const formattedLogs = useMemo(() => {
    if (Array.isArray(campaignLogs)) return campaignLogs;
    if (typeof campaignLogs === "string") {
      const lines = campaignLogs.split("\n").map(l => l.trim()).filter(Boolean);
      return lines.slice(-40).map((line, idx) => {
        let type: "info" | "success" | "warning" | "error" = "info";
        if (line.includes("ERROR") || line.toLowerCase().includes("failed") || line.toLowerCase().includes("crash")) {
          type = "error";
        } else if (line.includes("SUCCESS") || line.toLowerCase().includes("success") || line.toLowerCase().includes("sent successfully") || line.toLowerCase().includes("finished")) {
          type = "success";
        } else if (line.includes("WARN") || line.toLowerCase().includes("warning") || line.toLowerCase().includes("skip") || line.toLowerCase().includes("delay")) {
          type = "warning";
        }
        return {
          id: idx,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          message: line,
          type
        };
      });
    }
    return [];
  }, [campaignLogs]);

  // Template Management states
  const standardTemplates = [
    { id: "hasWebsite", name: "Social Media & Branding Outreach" },
    { id: "noWebsite", name: "Website Demo Outreach" },
    { id: "localCampaign", name: "Full Stack & AI Dev Pitch" },
    { id: "custom", name: "Custom Cold Outreach" },
    { id: "jobAndFreelance", name: "Job & Freelance Proposal" }
  ];

  const allTemplatesList = useMemo(() => {
    const customs = (pitchTemplates.customTemplates || []).map(t => ({
      id: t.id,
      name: `${t.name} (Custom)`
    }));
    return [...standardTemplates, ...customs];
  }, [pitchTemplates.customTemplates]);

  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>("hasWebsite");
  const [currentEmailSubject, setCurrentEmailSubject] = useState("");
  const [currentEmailBody, setCurrentEmailBody] = useState("");
  const [currentWhatsappMessage, setCurrentWhatsappMessage] = useState("");
  const [activeEditorTab, setActiveEditorTab] = useState<"email" | "whatsapp">("email");

  // JSON viewer modal
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  // New template modal state
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateSubject, setNewTemplateSubject] = useState("");
  const [newTemplateBody, setNewTemplateBody] = useState("");
  const [newTemplateWhatsapp, setNewTemplateWhatsapp] = useState("");

  // Schedule modal state
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [scheduleName, setScheduleName] = useState("");
  const [scheduleDateTime, setScheduleDateTime] = useState("");
  const [scheduleType, setScheduleType] = useState<"sheet" | "local">("sheet");
  const [scheduleDelay, setScheduleDelay] = useState(30);
  const [scheduleEmail, setScheduleEmail] = useState(true);
  const [scheduleWhatsapp, setScheduleWhatsapp] = useState(true);
  const [scheduleSheetName, setScheduleSheetName] = useState("");
  const [scheduleDryRun, setScheduleDryRun] = useState(false);
  const [isSubmittingSchedule, setIsSubmittingSchedule] = useState(false);

  // History detail & reschedule modal state
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any | null>(null);
  const [rescheduleDateTime, setRescheduleDateTime] = useState("");
  const [isRescheduling, setIsRescheduling] = useState(false);

  const handleSelectCsvFile = (filename: string | null) => {
    setSelectedCsvFile(filename);
    if (filename && (!campaignName || campaignName.startsWith("Campaign "))) {
      setCampaignName(deriveCampaignNameFromFilename(filename));
    }
  };

  // Only sync if user explicitly came from LeadsView with selectedFolderId
  useEffect(() => {
    if (selectedFolderId) {
      handleSelectCsvFile(selectedFolderId);
    }
  }, [selectedFolderId]);

  // Sync template values when selectedTemplateKey or pitchTemplates changes
  useEffect(() => {
    const custom = pitchTemplates.customTemplates?.find(t => t.id === selectedTemplateKey);
    if (custom) {
      setCurrentEmailSubject(custom.emailSubject || "");
      setCurrentEmailBody(custom.emailBody || "");
      setCurrentWhatsappMessage(custom.whatsappMessage || "");
      return;
    }
    const std = (pitchTemplates as any)[selectedTemplateKey];
    if (std) {
      setCurrentEmailSubject(std.emailSubject || "");
      setCurrentEmailBody(std.emailBody || "");
      setCurrentWhatsappMessage(std.whatsappMessage || "");
      return;
    }
    if (pitchTemplates.hasWebsite) {
      setCurrentEmailSubject(pitchTemplates.hasWebsite.emailSubject || "");
      setCurrentEmailBody(pitchTemplates.hasWebsite.emailBody || "");
      setCurrentWhatsappMessage(pitchTemplates.hasWebsite.whatsappMessage || "");
    }
  }, [selectedTemplateKey, pitchTemplates]);

  // If campaign starts, switch to running view
  useEffect(() => {
    if (campaignRunning) {
      setOutreachNavTab("running");
    }
  }, [campaignRunning]);

  // Fetch campaigns and history on initial mount
  useEffect(() => {
    fetchScheduledCampaigns();
    fetchCampaignHistory();
  }, []);

  const formatTimestamp = (isoStr?: string) => {
    if (!isoStr) return "—";
    try {
      const d = new Date(isoStr);
      return d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
    } catch {
      return isoStr;
    }
  };

  const calculateDuration = (startIso?: string, endIso?: string) => {
    if (!startIso) return "—";
    try {
      const start = new Date(startIso).getTime();
      if (isNaN(start)) return "—";
      const end = endIso ? new Date(endIso).getTime() : Date.now();
      const diffMs = Math.max(0, end - start);
      const totalSec = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSec / 3600);
      const min = Math.floor((totalSec % 3600) / 60);
      const sec = totalSec % 60;
      if (hours > 0) return `${hours}h ${min}m ${sec}s`;
      if (min > 0) return `${min}m ${sec}s`;
      return `${sec}s`;
    } catch {
      return "—";
    }
  };

  // Upload local CSV file handler
  const handleCsvFileUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      alert("Please upload a valid CSV file (.csv).");
      return;
    }
    setIsUploadingCsv(true);
    try {
      const success = await handleUploadCsvFile(file);
      if (success) {
        handleSelectCsvFile(file.name);
        setUploadSuccessMessage(`Successfully uploaded "${file.name}"!`);
        setTimeout(() => setUploadSuccessMessage(null), 5000);
      } else {
        alert("Failed to upload CSV file.");
      }
    } catch (err: any) {
      alert(`Error uploading CSV: ${err?.message || err}`);
    } finally {
      setIsUploadingCsv(false);
    }
  };

  // JSON representation of currently selected template
  const currentTemplateJsonString = useMemo(() => {
    const selectedTemplateObj = {
      templateId: selectedTemplateKey,
      templateName: allTemplatesList.find(t => t.id === selectedTemplateKey)?.name || selectedTemplateKey,
      emailSubject: currentEmailSubject,
      emailBody: currentEmailBody,
      whatsappMessage: currentWhatsappMessage,
      senderIdentity: {
        senderName: pitchTemplates.senderName,
        senderCompany: pitchTemplates.senderCompany,
        roleTitle: pitchTemplates.roleTitle,
        portfolioUrl: pitchTemplates.portfolioUrl,
        skills: pitchTemplates.skills
      }
    };
    return JSON.stringify(selectedTemplateObj, null, 2);
  }, [selectedTemplateKey, allTemplatesList, currentEmailSubject, currentEmailBody, currentWhatsappMessage, pitchTemplates]);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(currentTemplateJsonString);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2500);
  };

  const handleDownloadJson = () => {
    const blob = new Blob([currentTemplateJsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `template-${selectedTemplateKey}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveNewTemplate = async () => {
    if (!newTemplateName.trim()) {
      alert("Please enter a name for the new template.");
      return;
    }
    const newId = "custom_" + Date.now();
    const newItem: CustomTemplateItem = {
      id: newId,
      name: newTemplateName.trim(),
      emailSubject: newTemplateSubject.trim() || `Inquiry for {businessName}`,
      emailBody: newTemplateBody.trim() || `Hi {businessName},\n\nI wanted to reach out regarding your business.\n\nBest,\n{senderName}`,
      whatsappMessage: newTemplateWhatsapp.trim() || `Hi {businessName}! 👋 I came across your profile and would love to connect.`
    };
    const updatedCustoms = [...(pitchTemplates.customTemplates || []), newItem];
    const updatedConfig: PitchTemplateConfig = {
      ...pitchTemplates,
      customTemplates: updatedCustoms
    };
    await handleSaveTemplates(updatedConfig);
    setSelectedTemplateKey(newId);
    setIsCreatingTemplate(false);
    setNewTemplateName("");
    setNewTemplateSubject("");
    setNewTemplateBody("");
    setNewTemplateWhatsapp("");
  };

  // Helper to insert a variable tag into a field
  const insertPlaceholderTag = (target: "subject" | "body" | "whatsapp", tag: string) => {
    if (target === "subject") {
      setCurrentEmailSubject((prev) => `${prev} ${tag}`);
    } else if (target === "body") {
      setCurrentEmailBody((prev) => `${prev} ${tag}`);
    } else {
      setCurrentWhatsappMessage((prev) => `${prev} ${tag}`);
    }
  };

  // Master Launch & Schedule Handler for the Create Campaign Page
  const handleLaunchCampaign = async () => {
    const finalName = campaignName.trim() || `Campaign ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

    if (dataSourceTab !== "sheet" && !selectedCsvFile) {
      alert("Please upload or choose a CSV file for your campaign.");
      return;
    }

    if (campaignEnableWhatsapp && whatsappStatus.status !== "CONNECTED") {
      alert("WhatsApp is not connected. Please scan QR in Settings or disable WhatsApp channel.");
      return;
    }

    if (!campaignEnableEmail && !campaignEnableWhatsapp) {
      alert("Please enable at least one channel (Email or WhatsApp).");
      return;
    }

    setIsLaunchingCampaign(true);

    try {
      if (campaignRunMode === "schedule") {
        if (!campaignScheduleTime) {
          alert("Please select a date and time to schedule this campaign.");
          setIsLaunchingCampaign(false);
          return;
        }

        const payload = dataSourceTab === "sheet" ? {
          sheetName: selectedCampaignSheet,
          delaySeconds: campaignDelay,
          enableEmail: campaignEnableEmail,
          enableWhatsapp: campaignEnableWhatsapp,
          dryRun: campaignDryRun,
          templateKey: selectedTemplateKey,
          emailSubject: currentEmailSubject,
          emailBody: currentEmailBody,
          whatsappMessage: currentWhatsappMessage,
          attachmentFilename: campaignAttachmentFilename || undefined,
        } : {
          fileName: selectedCsvFile,
          campaignGoal: "business",
          delaySeconds: campaignDelay,
          enableEmail: campaignEnableEmail,
          enableWhatsapp: campaignEnableWhatsapp,
          dryRun: campaignDryRun,
          templateKey: selectedTemplateKey,
          emailSubject: currentEmailSubject,
          emailBody: currentEmailBody,
          whatsappMessage: currentWhatsappMessage,
          attachmentFilename: campaignAttachmentFilename || undefined,
        };

        const scheduled = await handleScheduleCampaign(
          finalName,
          campaignScheduleTime,
          dataSourceTab === "sheet" ? "sheet" : "local",
          payload
        );

        if (scheduled) {
          setOutreachNavTab("scheduled");
          fetchScheduledCampaigns();
          alert(`Campaign '${finalName}' successfully scheduled for background execution!`);
        }
      } else {
        // Run immediately in background
        if (dataSourceTab === "sheet") {
          await handleStartCampaign();
          setCampaignRunning(true);
          setOutreachNavTab("running");
        } else {
          const dataRes = await fetch(`/api/csv-data/${encodeURIComponent(selectedCsvFile!)}`);
          const dataJson = await dataRes.json();
          if (!dataJson.success || !Array.isArray(dataJson.leads) || dataJson.leads.length === 0) {
            alert("The selected CSV file has no records to send.");
            setIsLaunchingCampaign(false);
            return;
          }

          const launchRes = await fetch("/api/campaign/local-data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              rows: dataJson.leads,
              mapping: {
                businessName: "{businessName}",
                phone: "{phone}",
                emails: "{email}",
                website: "{website}",
                address: "{address}",
                category: "{category}",
                rating: "{rating}",
                reviews: "{reviews}"
              },
              fileName: selectedCsvFile,
              campaignName: finalName,
              emailSubject: currentEmailSubject,
              emailBody: currentEmailBody,
              whatsappMessage: currentWhatsappMessage,
              campaignGoal: "business",
              delaySeconds: campaignDelay,
              enableEmail: campaignEnableEmail,
              enableWhatsapp: campaignEnableWhatsapp,
              dryRun: campaignDryRun,
              skipAlreadySent: true,
              senderName: pitchTemplates.senderName,
              senderCompany: pitchTemplates.senderCompany,
              roleTitle: pitchTemplates.roleTitle,
              skills: pitchTemplates.skills,
              portfolioUrl: pitchTemplates.portfolioUrl,
              attachmentFilename: campaignAttachmentFilename || undefined,
              emailAttachmentFilename: campaignAttachmentFilename || undefined
            })
          });

          if (launchRes.ok) {
            setCampaignRunning(true);
            setOutreachNavTab("running");
          } else {
            const err = await launchRes.json().catch(() => ({}));
            alert(`Failed to start campaign: ${err.error || "Unknown error"}`);
          }
        }
      }
    } catch (e: any) {
      alert(`Error launching campaign: ${e?.message || e}`);
    } finally {
      setIsLaunchingCampaign(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ─── TOP NAVIGATION TABS & CREATE CAMPAIGN BUTTON ──────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#090d16] border border-[#1e293b] rounded-2xl p-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => {
              setOutreachNavTab("hub");
              fetchScheduledCampaigns();
              fetchCampaignHistory();
            }}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-2 ${outreachNavTab === "hub"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
              : "text-slate-400 hover:text-white hover:bg-slate-800/40"
              }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Campaigns Hub</span>
          </button>

          <button
            onClick={() => setOutreachNavTab("create")}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-2 ${outreachNavTab === "create"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
              : "text-slate-400 hover:text-white hover:bg-slate-800/40"
              }`}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create Campaign</span>
          </button>

          <button
            onClick={() => setOutreachNavTab("running")}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-2 ${outreachNavTab === "running"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
              : "text-slate-400 hover:text-white hover:bg-slate-800/40"
              }`}
          >
            <Zap className="h-3.5 w-3.5" />
            <span>Active Run</span>
            {(campaignRunning || campaignPaused) && (
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
            )}
          </button>

          <button
            onClick={() => {
              setOutreachNavTab("scheduled");
              fetchScheduledCampaigns();
            }}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-2 ${outreachNavTab === "scheduled"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
              : "text-slate-400 hover:text-white hover:bg-slate-800/40"
              }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Scheduled</span>
            {scheduledCampaigns.length > 0 && (
              <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded-full border border-slate-700">
                {scheduledCampaigns.length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setOutreachNavTab("history");
              fetchCampaignHistory();
            }}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-2 ${outreachNavTab === "history"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
              : "text-slate-400 hover:text-white hover:bg-slate-800/40"
              }`}
          >
            <History className="h-3.5 w-3.5" />
            <span>History</span>
            {campaignHistory.length > 0 && (
              <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded-full border border-slate-700">
                {campaignHistory.length}
              </span>
            )}
          </button>
        </div>

        {/* Right Action Bar: Active Loop Indicator (No duplicate Create Campaign button) */}
        <div className="flex flex-wrap items-center gap-2.5">
          {(campaignRunning || campaignPaused) && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs font-mono text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              <span>
                Loop Active: {campaignProgress.current}/{campaignProgress.total}
              </span>
              <button
                onClick={handleStopCampaign}
                disabled={isStoppingCampaign}
                className="text-slate-300 hover:text-white hover:underline font-bold ml-1.5 cursor-pointer"
              >
                Stop
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── TAB 0: CAMPAIGNS HUB (Multi-Campaign Overview & Background Runner) ── */}
      {outreachNavTab === "hub" && (
        <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-200">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-[#090d16] via-[#111322] to-[#090d16] border border-[#1e293b] rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white font-mono uppercase tracking-wider">
                    Outreach Campaigns Hub
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5 font-sans">
                    Create, schedule, and monitor multiple outreach campaigns running in the background.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 font-mono text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Background Worker Online
              </span>

              <button
                onClick={() => {
                  setCampaignName(`Campaign ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`);
                  setOutreachNavTab("create");
                }}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-indigo-600/20"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Campaign</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
            <div className="bg-[#090d16] border border-[#1e293b] rounded-xl p-4">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Total Campaigns</div>
              <div className="text-xl font-bold text-white mt-1">
                {(campaignRunning ? 1 : 0) + scheduledCampaigns.length + campaignHistory.length}
              </div>
            </div>

            <div className="bg-[#090d16] border border-emerald-500/30 rounded-xl p-4">
              <div className="text-[10px] text-emerald-400 uppercase tracking-wider">Running In Background</div>
              <div className="text-xl font-bold text-emerald-400 mt-1 flex items-center gap-2">
                {campaignRunning ? "1 Active" : "Idle"}
                {campaignRunning && <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />}
              </div>
            </div>

            <div className="bg-[#090d16] border border-[#1e293b] rounded-xl p-4">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Scheduled Queue</div>
              <div className="text-xl font-bold text-indigo-400 mt-1">
                {scheduledCampaigns.length}
              </div>
            </div>

            <div className="bg-[#090d16] border border-[#1e293b] rounded-xl p-4">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Completed Campaigns</div>
              <div className="text-xl font-bold text-slate-300 mt-1">
                {campaignHistory.length}
              </div>
            </div>
          </div>

          {/* Active Campaign Running in Background */}
          {(campaignRunning || campaignPaused) && (
            <div className="bg-[#090d16] border border-emerald-500/40 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1e293b]">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Zap className="h-5 w-5 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white font-mono">
                        {activeCampaignData?.name || "Active Background Campaign Loop"}
                      </h3>
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 ${campaignPaused
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse"
                        }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${campaignPaused ? "bg-amber-400" : "bg-emerald-400 animate-ping"}`} />
                        {campaignPaused ? "PAUSED" : "RUNNING IN BACKGROUND"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono mt-1">
                      <span>Source: <strong className="text-slate-200">{activeCampaignData?.source || "Target CSV"}</strong></span>
                      <span>•</span>
                      <span>Status: <span className="text-slate-200">{campaignProgress.status || "Dispatching..."}</span></span>
                    </div>
                  </div>
                </div>

                {/* Control Actions: Stop, Pause, Resume, View Stream */}
                <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                  {campaignPaused ? (
                    <button
                      onClick={handleResumeCampaign}
                      disabled={isResumingCampaign}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-emerald-600/20"
                      title="Resume Outreach Loop"
                    >
                      {isResumingCampaign ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-white" />}
                      <span>Resume</span>
                    </button>
                  ) : (
                    <button
                      onClick={handlePauseCampaign}
                      disabled={isPausingCampaign}
                      className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-amber-600/20"
                      title="Pause Outreach Loop"
                    >
                      {isPausingCampaign ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pause className="h-3.5 w-3.5 fill-white" />}
                      <span>Pause</span>
                    </button>
                  )}

                  <button
                    onClick={handleStopCampaign}
                    disabled={isStoppingCampaign}
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-rose-600/20"
                    title="Stop & Finalize Campaign"
                  >
                    {isStoppingCampaign ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5 fill-white" />}
                    <span>Stop</span>
                  </button>

                  <button
                    onClick={() => setOutreachNavTab("running")}
                    className="px-3.5 py-1.5 bg-[#030712] hover:bg-slate-800 text-slate-300 border border-[#1e293b] rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <TerminalIcon className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Live Console</span>
                  </button>
                </div>
              </div>

              {/* Progress Bar & Real-time Metrics Counters */}
              <div className="space-y-3 font-mono">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">
                    Progress: <strong className="text-white">{campaignProgress.current}</strong> of {campaignProgress.total} records
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">
                      Remaining: <strong className="text-amber-300">{Math.max(0, campaignProgress.total - campaignProgress.current)}</strong>
                    </span>
                    <span className="text-emerald-400 font-bold">
                      {campaignProgress.total > 0
                        ? Math.round((campaignProgress.current / campaignProgress.total) * 100)
                        : 0}% Complete
                    </span>
                  </div>
                </div>

                <div className="w-full bg-[#030712] rounded-full h-3 overflow-hidden border border-[#1e293b]">
                  <div
                    className={`h-3 rounded-full transition-all duration-300 ${campaignPaused ? "bg-amber-500" : "bg-gradient-to-r from-emerald-500 via-indigo-500 to-emerald-400"
                      }`}
                    style={{
                      width: `${campaignProgress.total > 0
                        ? Math.min(100, Math.round((campaignProgress.current / campaignProgress.total) * 100))
                        : 0
                        }%`
                    }}
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1 text-xs">
                  <div className="bg-[#030712] border border-[#1e293b] rounded-xl p-3">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Emails Sent</span>
                    <span className="text-lg font-bold text-emerald-400 mt-0.5 block">{campaignProgress.emailsSent || 0}</span>
                    <span className="text-[10px] text-slate-500">{(campaignProgress.emailsFailed || 0)} failed</span>
                  </div>

                  <div className="bg-[#030712] border border-[#1e293b] rounded-xl p-3">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">WhatsApp Sent</span>
                    <span className="text-lg font-bold text-emerald-400 mt-0.5 block">{campaignProgress.whatsappSent || 0}</span>
                    <span className="text-[10px] text-slate-500">{(campaignProgress.whatsappFailed || 0)} failed</span>
                  </div>

                  <div className="bg-[#030712] border border-[#1e293b] rounded-xl p-3">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Remaining Leads</span>
                    <span className="text-lg font-bold text-amber-300 mt-0.5 block">
                      {Math.max(0, campaignProgress.total - campaignProgress.current)}
                    </span>
                    <span className="text-[10px] text-slate-500">in queue</span>
                  </div>

                  <div className="bg-[#030712] border border-[#1e293b] rounded-xl p-3">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Skipped</span>
                    <span className="text-lg font-bold text-slate-300 mt-0.5 block">{campaignProgress.skipped || 0}</span>
                    <span className="text-[10px] text-slate-500">already sent/empty</span>
                  </div>

                  <div className="bg-[#030712] border border-[#1e293b] rounded-xl p-3">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Next Dispatch In</span>
                    <span className="text-lg font-bold text-indigo-300 mt-0.5 block">{campaignProgress.secondsRemaining || 0}s</span>
                    <span className="text-[10px] text-slate-500">spacing interval</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Multiple Campaigns: Scheduled & Background Queue */}
          <div className="bg-[#090d16] border border-[#1e293b] rounded-2xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1e293b]">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                  Campaigns Queue & Scheduled Runs ({scheduledCampaigns.length})
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchScheduledCampaigns()}
                  className="p-1.5 bg-[#030712] hover:bg-slate-800 border border-[#1e293b] rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Refresh Queue"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {scheduledCampaigns.length === 0 ? (
              <div className="bg-[#070b14] border border-[#1e293b] rounded-xl p-8 text-center space-y-2">
                <Calendar className="h-7 w-7 text-slate-600 mx-auto" />
                <h4 className="text-xs font-mono font-bold text-slate-300">No Scheduled Campaigns in Queue</h4>
                <p className="text-[11px] font-mono text-slate-500 max-w-md mx-auto">
                  Scheduled campaigns will appear here and run autonomously on their configured timeline.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {scheduledCampaigns.map((sch) => {
                  const p = sch.payload || {};
                  const isLocal = sch.type === "local";

                  return (
                    <div
                      key={sch.id}
                      className="bg-[#0d1424] border border-[#1e293b] hover:border-indigo-500/40 rounded-xl p-4 space-y-3 shadow-md flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-bold text-white font-mono line-clamp-1" title={sch.name}>
                            {sch.name}
                          </h4>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold shrink-0 ${sch.status === "RUNNING"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                            }`}>
                            {sch.status || "SCHEDULED"}
                          </span>
                        </div>

                        <div className="text-[11px] font-mono text-slate-400 space-y-1">
                          <div className="flex items-center gap-1.5">
                            <HardDrive className="h-3 w-3 text-slate-500" />
                            <span>Target: <strong className="text-slate-200">{isLocal ? p.fileName : (p.sheetName || "Sheet")}</strong></span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3 text-slate-500" />
                            <span>Run: <strong className="text-slate-200">{new Date(sch.scheduledAt).toLocaleString()}</strong></span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-1 text-[10px] font-mono">
                          {p.enableEmail !== false && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                              <Mail className="h-2.5 w-2.5" /> Email
                            </span>
                          )}
                          {p.enableWhatsapp !== false && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                              <Phone className="h-2.5 w-2.5" /> WhatsApp
                            </span>
                          )}
                          <span className="text-slate-500">• {p.delaySeconds || 30}s delay</span>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-[#1e293b] flex items-center justify-between gap-2">
                        <button
                          onClick={() => handleRunScheduledNow(sch.id)}
                          disabled={campaignRunning}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Play className="h-3 w-3" /> Run Now
                        </button>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setEditingScheduleId(sch.id);
                              setScheduleName(sch.name || "");
                              setScheduleDateTime(sch.scheduledAt ? new Date(sch.scheduledAt).toISOString().slice(0, 16) : "");
                              setScheduleType(sch.type || "sheet");
                              setScheduleDelay(p.delaySeconds || 30);
                              setScheduleEmail(p.enableEmail !== false);
                              setScheduleWhatsapp(p.enableWhatsapp !== false);
                              setScheduleSheetName(p.sheetName || "");
                              setScheduleDryRun(Boolean(p.dryRun));
                              setIsScheduleModalOpen(true);
                            }}
                            className="px-2.5 py-1.5 bg-[#030712] hover:bg-slate-800 text-indigo-300 border border-[#1e293b] rounded-lg text-xs font-mono flex items-center gap-1 cursor-pointer transition-colors"
                            title="Edit or Reschedule"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            <span>Edit</span>
                          </button>

                          <button
                            onClick={() => handleDeleteSchedule(sch.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                            title="Delete Campaign"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ─── TAB 1: CREATE CAMPAIGN FULL PAGE (NO MODAL) ────────────────────── */}
      {outreachNavTab === "create" && (
        <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-200">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-[#090d16] via-[#111322] to-[#090d16] border border-[#1e293b] rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white font-mono uppercase tracking-wider">
                    Create Outreach Campaign
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5 font-sans">
                    Upload your CSV or select saved leads, customize email & WhatsApp copy, and run in background.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Autonomous Background Loop
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-[#030712] border border-[#1e293b] text-slate-300">
                Direct Dispatch
              </span>
            </div>
          </div>

          {/* Section 1: Campaign Identity (Campaign Name) */}
          <div className="bg-[#090d16] border border-[#1e293b] rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#1e293b]/60">
              <Building2 className="h-5 w-5 text-indigo-400" />
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                1. Campaign Identity
              </h3>
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-2 font-bold">
                Campaign Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="e.g. Q4 Real Estate Outreach - Austin, TX"
                className="w-full text-sm bg-[#030712] border border-[#1e293b] rounded-xl px-4 py-3 text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <p className="text-[11px] text-slate-500 font-mono mt-1.5">
                Give your campaign a descriptive name so you can track its logs, statistics, and history.
              </p>
            </div>
          </div>

          {/* Section 2: Data Source Selection (Upload CSV | Choose Existing CSV | Google Sheet) */}
          <div className="bg-[#090d16] border border-[#1e293b] rounded-2xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#1e293b]/60">
              <div className="flex items-center gap-2">
                <HardDrive className="h-5 w-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                  2. Select Target Leads Source
                </h3>
              </div>

              {/* Segmented Source Tabs */}
              <div className="flex items-center bg-[#030712] border border-[#1e293b] rounded-xl p-1 gap-1">
                <button
                  type="button"
                  onClick={() => setDataSourceTab("upload")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${dataSourceTab === "upload"
                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                    : "text-slate-400 hover:text-white"
                    }`}
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Upload CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDataSourceTab("existing")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${dataSourceTab === "existing"
                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                    : "text-slate-400 hover:text-white"
                    }`}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>Choose Existing CSV</span>
                  <span className="text-[10px] bg-black/40 px-1.5 py-0.2 rounded-full text-indigo-300">
                    {availableFolders.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDataSourceTab("sheet");
                    if (campaignSheets.length === 0) fetchCampaignSheets();
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${dataSourceTab === "sheet"
                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                    : "text-slate-400 hover:text-white"
                    }`}
                >
                  <Target className="h-3.5 w-3.5" />
                  <span>Google Sheet</span>
                </button>
              </div>
            </div>

            {/* TAB: Upload CSV File */}
            {dataSourceTab === "upload" && (
              <div className="space-y-4 animate-in fade-in">
                <div className="bg-[#030712] border-2 border-dashed border-[#1e293b] hover:border-indigo-500/50 rounded-2xl p-8 text-center space-y-4 transition-colors">
                  <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-400">
                    <Upload className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-white font-mono">Upload Your Own CSV File</h4>
                    <p className="text-xs text-slate-400 max-w-md mx-auto font-sans">
                      Select or drop any CSV file from your device. Columns like Business Name, Phone, and Email are auto-mapped.
                    </p>
                  </div>

                  <div className="flex justify-center pt-2">
                    <label className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-mono font-bold text-xs rounded-xl cursor-pointer shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02]">
                      {isUploadingCsv ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Uploading CSV File...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          <span>Upload CSV File</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept=".csv"
                        className="hidden"
                        disabled={isUploadingCsv}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleCsvFileUpload(file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                </div>

                {uploadSuccessMessage && (
                  <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-mono flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>{uploadSuccessMessage}</span>
                  </div>
                )}
              </div>
            )}

            {/* TAB: Choose Existing CSV */}
            {dataSourceTab === "existing" && (
              <div className="space-y-4 animate-in fade-in">
                {/* Dropdown selector */}
                <div className="bg-[#030712] border border-[#1e293b] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <label className="text-slate-300 font-bold flex items-center gap-1.5">
                      <FileSpreadsheet className="h-4 w-4 text-indigo-400" />
                      <span>Choose from Saved CSV Files (data/)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => fetchFolders()}
                      disabled={isLoadingFolders}
                      className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer text-[11px]"
                    >
                      <RefreshCw className={`h-3 w-3 ${isLoadingFolders ? "animate-spin" : ""}`} /> Refresh
                    </button>
                  </div>

                  <select
                    value={selectedCsvFile || ""}
                    onChange={(e) => handleSelectCsvFile(e.target.value || null)}
                    className="w-full text-xs bg-[#090d16] border border-[#1e293b] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-indigo-500 font-mono cursor-pointer"
                  >
                    <option value="">-- Choose a CSV file from data/ --</option>
                    {availableFolders.map((file) => (
                      <option key={file.id} value={file.filename}>
                        {file.filename} ({file.leadCount} leads{file.emailCount > 0 ? `, ${file.emailCount} emails` : ""})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Scannable Cards of Available CSV files */}
                {availableFolders.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[11px] font-mono text-slate-400 uppercase font-bold tracking-wider px-1">
                      Available CSV Files ({availableFolders.length})
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                      {availableFolders.map((f) => {
                        const isSelected = selectedCsvFile === f.filename || selectedCsvFile === f.id;
                        return (
                          <div
                            key={f.id}
                            onClick={() => handleSelectCsvFile(f.filename)}
                            className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-wrap items-center justify-between gap-3 ${isSelected
                              ? "bg-indigo-950/30 border-indigo-500/50 shadow-sm shadow-indigo-500/10"
                              : "bg-[#030712] border-[#1e293b] hover:border-slate-700"
                              }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${isSelected
                                ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                                : "bg-slate-800 text-slate-400"
                                }`}>
                                <FileSpreadsheet className="h-4 w-4" />
                              </div>
                              <div>
                                <div className="text-xs font-mono font-bold text-white flex items-center gap-2">
                                  <span>{f.filename}</span>
                                  {isSelected && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                      Selected
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                                  <span>{f.leadCount} leads</span>
                                  <span>•</span>
                                  <span className="text-emerald-400 font-bold">{f.emailCount} emails</span>
                                  <span>•</span>
                                  <span>{f.fileSizeFormatted}</span>
                                  <span>•</span>
                                  <span>{formatAge(f.updatedAt || f.createdAt)}</span>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectCsvFile(f.filename);
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold cursor-pointer transition-all ${isSelected
                                ? "bg-indigo-600 text-white"
                                : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                                }`}
                            >
                              {isSelected ? "Selected" : "Choose File"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: Google Sheet */}
            {dataSourceTab === "sheet" && (
              <div className="space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span>Target sheet tab in your configured Google Sheet:</span>
                  <button
                    onClick={fetchCampaignSheets}
                    disabled={isLoadingSheets}
                    className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className={`h-3 w-3 ${isLoadingSheets ? "animate-spin" : ""}`} /> Refresh Sheets
                  </button>
                </div>

                <div className="flex gap-2.5 max-w-md">
                  <select
                    value={selectedCampaignSheet}
                    onChange={(e) => setSelectedCampaignSheet(e.target.value)}
                    disabled={isLoadingSheets}
                    className="flex-grow text-xs bg-[#030712] border border-[#1e293b] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-indigo-500 font-mono cursor-pointer"
                  >
                    <option value="">All Sheets (or Default)</option>
                    {campaignSheets.map((s, i) => (
                      <option key={i} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Active Selected Source Display */}
            {dataSourceTab !== "sheet" && (
              selectedCsvFile ? (
                <div className="bg-[#030712] border border-indigo-500/30 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                      <FileSpreadsheet className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white font-mono flex items-center gap-2">
                        <span>{selectedCsvFile}</span>
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px]">
                          Ready for Campaign
                        </span>
                      </div>
                      {(() => {
                        const fileInfo = availableFolders.find(
                          f => f.filename === selectedCsvFile || f.id === selectedCsvFile
                        );
                        if (!fileInfo) return null;
                        return (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                            <span>{fileInfo.fileSizeFormatted}</span>
                            <span>•</span>
                            <span>{fileInfo.leadCount} total leads</span>
                            <span>•</span>
                            <span className="text-emerald-400 font-bold">{fileInfo.emailCount} emails</span>
                            <span>•</span>
                            <span>{formatAge(fileInfo.updatedAt || fileInfo.createdAt)}</span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-emerald-400">
                      ✓ File Loaded
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedCsvFile(null)}
                      className="px-2 py-1 text-[10px] font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer transition-colors"
                      title="Clear file selection"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-[#030712] border border-dashed border-[#1e293b] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-slate-800/60 border border-slate-700/50 flex items-center justify-center text-slate-400">
                      <FileSpreadsheet className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-300 font-mono">
                        No CSV File Selected (Optional)
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        Upload your own CSV above or choose from saved CSV files in data/
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700">
                    Awaiting File Selection
                  </span>
                </div>
              )
            )}
          </div>

          {/* Section 3: Email & WhatsApp Templates (Directly Editable - Pitch Strategy Completely Removed) */}
          <div className="bg-[#090d16] border border-[#1e293b] rounded-2xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#1e293b]/60">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                  3. Email & WhatsApp Message Templates
                </h3>
              </div>

              {/* Template Presets Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-slate-400">Load Preset:</span>
                <select
                  value={selectedTemplateKey}
                  onChange={(e) => setSelectedTemplateKey(e.target.value)}
                  className="text-xs bg-[#030712] border border-[#1e293b] rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500 font-mono cursor-pointer"
                >
                  <optgroup label="Standard Templates">
                    {standardTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </optgroup>
                  {(pitchTemplates.customTemplates || []).length > 0 && (
                    <optgroup label="Custom Saved Templates">
                      {pitchTemplates.customTemplates?.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            </div>

            {/* Variable Placeholder Chips */}
            <div className="bg-[#030712] border border-[#1e293b] rounded-xl p-3.5 space-y-2">
              <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                <span>Click Variable Tag to Insert into Template:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "{businessName}",
                  "{email}",
                  "{phone}",
                  "{website}",
                  "{category}",
                  "{senderName}",
                  "{city}",
                  "{portfolioUrl}"
                ].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => insertPlaceholderTag(activeEditorTab === "email" ? "body" : "whatsapp", tag)}
                    className="px-2 py-1 rounded-lg bg-indigo-950/40 border border-indigo-500/30 hover:border-indigo-400 text-indigo-300 font-mono text-[11px] cursor-pointer hover:bg-indigo-900/50 transition-colors"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Editor Channel Selector (Email vs WhatsApp) */}
            <div className="flex items-center gap-2 border-b border-[#1e293b] pb-3">
              <button
                type="button"
                onClick={() => setActiveEditorTab("email")}
                className={`px-4 py-2 rounded-xl text-xs font-mono font-bold cursor-pointer transition-all flex items-center gap-2 ${activeEditorTab === "email"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "bg-[#030712] text-slate-400 hover:text-white border border-[#1e293b]"
                  }`}
              >
                <Mail className="h-4 w-4" />
                <span>Email Template</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveEditorTab("whatsapp")}
                className={`px-4 py-2 rounded-xl text-xs font-mono font-bold cursor-pointer transition-all flex items-center gap-2 ${activeEditorTab === "whatsapp"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                  : "bg-[#030712] text-slate-400 hover:text-white border border-[#1e293b]"
                  }`}
              >
                <Phone className="h-4 w-4" />
                <span>WhatsApp Template</span>
              </button>
            </div>

            {/* Direct Email Template Editor */}
            {activeEditorTab === "email" && (
              <div className="space-y-4 animate-in fade-in">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-mono text-slate-300 font-bold">
                      Email Subject Line:
                    </label>
                    <button
                      type="button"
                      onClick={() => insertPlaceholderTag("subject", "{businessName}")}
                      className="text-[10px] font-mono text-indigo-400 hover:underline cursor-pointer"
                    >
                      + Insert {"{businessName}"}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={currentEmailSubject}
                    onChange={(e) => setCurrentEmailSubject(e.target.value)}
                    placeholder="e.g. Quick question regarding {businessName} website"
                    className="w-full text-xs font-mono bg-[#030712] border border-[#1e293b] rounded-xl px-4 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 font-bold mb-1.5">
                    Email Body Copy:
                  </label>
                  <textarea
                    rows={10}
                    value={currentEmailBody}
                    onChange={(e) => setCurrentEmailBody(e.target.value)}
                    placeholder="Hi {businessName} team,&#10;&#10;I noticed your listing in {category}..."
                    className="w-full text-xs font-mono bg-[#030712] border border-[#1e293b] rounded-xl p-4 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 leading-relaxed font-mono"
                  />
                </div>
              </div>
            )}

            {/* Direct WhatsApp Template Editor */}
            {activeEditorTab === "whatsapp" && (
              <div className="space-y-4 animate-in fade-in">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-mono text-slate-300 font-bold flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-emerald-400" />
                      <span>WhatsApp Outgoing Message:</span>
                    </label>
                    <span className="text-[10px] font-mono text-slate-500">
                      Supports *bold*, _italics_, and line breaks
                    </span>
                  </div>
                  <textarea
                    rows={8}
                    value={currentWhatsappMessage}
                    onChange={(e) => setCurrentWhatsappMessage(e.target.value)}
                    placeholder="Hey {businessName}! Noticed your business..."
                    className="w-full text-xs font-mono bg-[#030712] border border-[#1e293b] rounded-xl p-4 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 leading-relaxed font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Dispatch Settings & Channels */}
          <div className="bg-[#090d16] border border-[#1e293b] rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-[#1e293b]/60">
              <Zap className="h-5 w-5 text-indigo-400" />
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                4. Dispatch Settings & Channels
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Spacing Slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Dispatch Interval</span>
                  <span className="text-indigo-400 font-bold">{campaignDelay}s between leads</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="120"
                  step="5"
                  value={campaignDelay}
                  onChange={(e) => setCampaignDelay(parseInt(e.target.value, 10))}
                  className="w-full accent-indigo-500 h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer border border-slate-800"
                />
                <p className="text-[11px] text-slate-500 font-mono">
                  Safe spacing prevents SMTP rate limits and spam filters.
                </p>
              </div>

              {/* Channels & Dry Run */}
              <div className="bg-[#030712] border border-[#1e293b] rounded-xl p-4 space-y-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono block">
                  Active Channels
                </span>
                <label className="flex items-center gap-2.5 text-slate-300 hover:text-white cursor-pointer select-none text-xs font-mono">
                  <input
                    type="checkbox"
                    checked={campaignEnableEmail}
                    onChange={(e) => setCampaignEnableEmail(e.target.checked)}
                    className="rounded border-[#1e293b] text-indigo-500 bg-[#030712] h-4 w-4"
                  />
                  <span>Email (Direct SMTP)</span>
                </label>
                <label className="flex items-center gap-2.5 text-slate-300 hover:text-white cursor-pointer select-none text-xs font-mono">
                  <input
                    type="checkbox"
                    checked={campaignEnableWhatsapp}
                    onChange={(e) => setCampaignEnableWhatsapp(e.target.checked)}
                    className="rounded border-[#1e293b] text-emerald-500 bg-[#030712] h-4 w-4"
                  />
                  <span>WhatsApp (Direct Session)</span>
                </label>
                <label className="flex items-center gap-2.5 text-amber-300 hover:text-amber-200 cursor-pointer select-none text-xs font-mono pt-1 border-t border-[#1e293b]">
                  <input
                    type="checkbox"
                    checked={campaignDryRun}
                    onChange={(e) => setCampaignDryRun(e.target.checked)}
                    className="rounded border-[#1e293b] text-amber-500 bg-[#030712] h-4 w-4"
                  />
                  <span>Dry Run (Simulate dispatch without sending real messages)</span>
                </label>
              </div>
            </div>

            {/* Proposal Document Attachment */}
            <AttachmentWidget
              isCampaign={true}
              title="Proposal Document Attachment (Email)"
              subtitle="Attach proposal or deck directly to outgoing emails"
            />
          </div>

          {/* Section 5: Execution Mode & Launch Controls */}
          <div className="bg-[#090d16] border border-[#1e293b] rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-[#1e293b]/60">
              <Play className="h-5 w-5 text-indigo-400" />
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                5. Execution Controls
              </h3>
            </div>

            {/* Run in Background Now vs Schedule for Later */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                onClick={() => setCampaignRunMode("background_now")}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${campaignRunMode === "background_now"
                  ? "bg-indigo-950/30 border-indigo-500 text-white shadow-md shadow-indigo-500/10"
                  : "bg-[#030712] border-[#1e293b] text-slate-400 hover:border-slate-700"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="runMode"
                    checked={campaignRunMode === "background_now"}
                    onChange={() => setCampaignRunMode("background_now")}
                    className="text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                  <div>
                    <h4 className="text-xs font-mono font-bold text-white">Run in Background Now</h4>
                    <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                      Starts autonomous server task immediately. You can close your browser or navigate to other tabs.
                    </p>
                  </div>
                </div>
              </div>

              <div
                onClick={() => setCampaignRunMode("schedule")}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${campaignRunMode === "schedule"
                  ? "bg-indigo-950/30 border-indigo-500 text-white shadow-md shadow-indigo-500/10"
                  : "bg-[#030712] border-[#1e293b] text-slate-400 hover:border-slate-700"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="runMode"
                    checked={campaignRunMode === "schedule"}
                    onChange={() => setCampaignRunMode("schedule")}
                    className="text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                  <div>
                    <h4 className="text-xs font-mono font-bold text-white">Schedule for Later</h4>
                    <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                      Queue the campaign to execute at an optimal future time.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Date time picker if scheduling */}
            {campaignRunMode === "schedule" && (
              <div className="bg-[#030712] border border-[#1e293b] rounded-xl p-4 space-y-2 animate-in fade-in">
                <label className="block text-xs font-mono text-slate-300 font-bold">
                  Select Date & Time for Execution:
                </label>
                <input
                  type="datetime-local"
                  value={campaignScheduleTime}
                  onChange={(e) => setCampaignScheduleTime(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full sm:w-auto text-xs font-mono bg-[#090d16] border border-[#1e293b] rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}

            {/* Launch Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#1e293b]/70">
              <div className="text-xs font-mono text-slate-400">
                Target:{" "}
                <strong className="text-white">
                  {dataSourceTab === "sheet" ? selectedCampaignSheet || "Google Sheet" : selectedCsvFile || "None selected"}
                </strong>
                {" • "}
                Campaign: <strong className="text-indigo-300">{campaignName || "Untitled"}</strong>
              </div>

              <button
                type="button"
                onClick={handleLaunchCampaign}
                disabled={isLaunchingCampaign || campaignRunning}
                className="px-7 py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-40 text-white text-xs font-black font-mono rounded-xl cursor-pointer transition-all flex items-center gap-2.5 shadow-xl shadow-indigo-600/30 hover:scale-[1.01]"
              >
                {isLaunchingCampaign ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Launching Campaign...</span>
                  </>
                ) : campaignRunMode === "schedule" ? (
                  <>
                    <Calendar className="h-4 w-4" />
                    <span>Schedule Campaign</span>
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 fill-white" />
                    <span>Launch Campaign in Background Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: ACTIVE RUNNING CAMPAIGN VIEW ───────────────────────────── */}
      {outreachNavTab === "running" && (
        <div className="space-y-6 max-w-5xl mx-auto">
          <div className="bg-[#090d16] border border-[#1e293b] rounded-2xl p-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#1e293b]">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-black text-white font-mono uppercase tracking-wider">
                    {campaignRunning || campaignPaused
                      ? formatDisplayCampaignTitle(activeCampaignData?.name, activeCampaignData?.source)
                      : "No Active Campaign"}
                  </h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-widest ${campaignPaused
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : campaignRunning
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse"
                        : "bg-slate-800 text-slate-400 border border-slate-700"
                      }`}
                  >
                    {campaignPaused ? "Paused" : campaignRunning ? "Running in Background" : "Idle"}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-1 font-sans flex flex-wrap items-center gap-2">
                  {campaignRunning || campaignPaused ? (
                    <>
                      {activeCampaignData?.source && (
                        <span className="font-mono text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60 flex items-center gap-1">
                          <FileSpreadsheet className="h-3 w-3 text-indigo-400" />
                          <span>Source:</span> {activeCampaignData.source}
                        </span>
                      )}
                      <span className="font-mono text-emerald-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Duration: <strong>{calculateDuration(activeCampaignData?.startTime, undefined)} elapsed</strong>
                      </span>
                      <span>•</span>
                      <span>Spacing: {campaignDelay || activeCampaignData?.delaySeconds || 30}s between dispatches</span>
                    </>
                  ) : (
                    "Start an outreach campaign to monitor background execution in real-time."
                  )}
                </div>
              </div>

              {(campaignRunning || campaignPaused) && (
                <div className="flex items-center gap-2">
                  {campaignPaused ? (
                    <button
                      onClick={handleResumeCampaign}
                      disabled={isResumingCampaign}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                    >
                      {isResumingCampaign ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-white" />}
                      Resume
                    </button>
                  ) : (
                    <button
                      onClick={handlePauseCampaign}
                      disabled={isPausingCampaign}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-amber-600/30 transition-all cursor-pointer"
                    >
                      {isPausingCampaign ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4 fill-white" />}
                      Pause
                    </button>
                  )}

                  <button
                    onClick={handleStopCampaign}
                    disabled={isStoppingCampaign}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
                  >
                    {isStoppingCampaign ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4 fill-white" />}
                    Stop
                  </button>
                </div>
              )}
            </div>

            {campaignRunning || campaignPaused ? (
              <div className="mt-5 space-y-4">
                <div>
                  <div className="flex items-center justify-between text-xs font-mono mb-2">
                    <span className="text-slate-300">
                      Processing Lead: <strong className="text-white">{campaignProgress.current}</strong> of {campaignProgress.total}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400">
                        Remaining: <strong className="text-amber-300">{Math.max(0, campaignProgress.total - campaignProgress.current)}</strong>
                      </span>
                      <span className="text-rose-400 font-bold">
                        {campaignProgress.total > 0 ? Math.round((campaignProgress.current / campaignProgress.total) * 100) : 0}% Complete
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-[#1e293b] rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${campaignPaused ? "bg-amber-500" : "bg-gradient-to-r from-rose-500 via-purple-500 to-emerald-400"
                        }`}
                      style={{
                        width: `${campaignProgress.total > 0 ? (campaignProgress.current / campaignProgress.total) * 100 : 0}%`
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-[#030712] border border-[#1e293b] rounded-xl p-3">
                    <div className="text-[10px] text-slate-400 font-mono uppercase">Emails Sent</div>
                    <div className="text-lg font-black font-mono text-emerald-400 mt-1">
                      {campaignProgress.emailsSent || 0}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      {campaignProgress.emailsFailed || 0} failed
                    </div>
                  </div>
                  <div className="bg-[#030712] border border-[#1e293b] rounded-xl p-3">
                    <div className="text-[10px] text-slate-400 font-mono uppercase">WhatsApp Sent</div>
                    <div className="text-lg font-black font-mono text-emerald-400 mt-1">
                      {campaignProgress.whatsappSent || 0}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      {campaignProgress.whatsappFailed || 0} failed
                    </div>
                  </div>
                  <div className="bg-[#030712] border border-[#1e293b] rounded-xl p-3">
                    <div className="text-[10px] text-slate-400 font-mono uppercase">Skipped</div>
                    <div className="text-lg font-black font-mono text-amber-400 mt-1">
                      {campaignProgress.skipped || 0}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">already sent or no contact</div>
                  </div>
                  <div className="bg-[#030712] border border-[#1e293b] rounded-xl p-3">
                    <div className="text-[10px] text-slate-400 font-mono uppercase">Remaining Queue</div>
                    <div className="text-lg font-black font-mono text-indigo-400 mt-1">
                      {Math.max(0, campaignProgress.total - campaignProgress.current)}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">in queue to process</div>
                  </div>
                </div>

                <div className="bg-[#030712] border border-[#1e293b] rounded-xl p-3.5 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <div className={`h-2.5 w-2.5 rounded-full ${campaignPaused ? "bg-amber-400" : "bg-emerald-400 animate-ping"}`} />
                    <span className="text-slate-300 font-sans">
                      Status: <strong className="text-white font-mono">{campaignProgress.status}</strong>
                    </span>
                  </div>
                  {campaignProgress.secondsRemaining > 0 && (
                    <span className="px-2 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-mono font-bold animate-pulse">
                      Delay: {campaignProgress.secondsRemaining}s
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center space-y-3">
                <div className="h-12 w-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-400">
                  <Target className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-bold text-white font-mono uppercase">No Campaign Currently Active</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Launch a new Business Campaign to see background execution and metrics here.
                </p>
                <button
                  onClick={() => setOutreachNavTab("create")}
                  className="mt-3 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer"
                >
                  Create Campaign
                </button>
              </div>
            )}
          </div>

          {/* Queued / Scheduled Campaigns in Background */}
          {scheduledCampaigns.length > 0 && (
            <div className="bg-[#090d16] border border-[#1e293b] rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-white uppercase tracking-wider">
                  <Calendar className="h-4 w-4 text-indigo-400" />
                  Queued & Scheduled Campaigns ({scheduledCampaigns.length})
                </div>
                <button
                  onClick={() => setOutreachNavTab("scheduled")}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 font-mono flex items-center gap-1 cursor-pointer"
                >
                  Manage Schedules <ArrowRight className="h-3 w-3" />
                </button>
              </div>
              <div className="space-y-2">
                {scheduledCampaigns.map((sch) => (
                  <div
                    key={sch.id}
                    className="p-3 bg-[#030712] border border-[#1e293b] rounded-xl flex items-center justify-between gap-3 text-xs font-mono"
                  >
                    <div>
                      <div className="font-bold text-white flex items-center gap-2">
                        <span>{sch.name}</span>
                        <span className="text-[9px] px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-500/30">
                          {sch.status || "UPCOMING"}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>Scheduled: {formatTimestamp(sch.scheduledAt)}</span>
                        <span>•</span>
                        <span>Source: {sch.payload?.fileName || sch.payload?.sheetName || "CSV"}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRunScheduledNow(sch.id)}
                      className="px-2.5 py-1 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-lg text-[10px] font-mono cursor-pointer transition-all"
                    >
                      Run Now
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Live Activity Stream */}
          <div className="bg-[#090d16] border border-[#1e293b] rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-white uppercase tracking-wider">
                <TerminalIcon className="h-4 w-4 text-emerald-400" />
                Live Campaign Logs
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Last 10 events</span>
            </div>
            <div className="font-mono text-xs space-y-1.5 max-h-60 overflow-y-auto pr-2">
              {formattedLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-2 py-1 border-b border-[#1e293b]/30 last:border-0">
                  <span className="text-slate-600 shrink-0 text-[10px]">{log.timestamp}</span>
                  <span
                    className={`text-[11px] leading-relaxed ${log.type === "error"
                      ? "text-rose-400"
                      : log.type === "success"
                        ? "text-emerald-400"
                        : log.type === "warning"
                          ? "text-amber-400"
                          : "text-slate-300"
                      }`}
                  >
                    {log.message}
                  </span>
                </div>
              ))}
              {formattedLogs.length === 0 && (
                <div className="text-center py-6 text-slate-600 text-xs font-mono">No recent activity logs.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: UPCOMING / SCHEDULED CAMPAIGNS ──────────────────────── */}
      {outreachNavTab === "scheduled" && (
        <div className="space-y-6 max-w-5xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-white font-mono uppercase tracking-wider flex items-center gap-2.5">
                <Calendar className="h-5 w-5 text-indigo-400" />
                Upcoming Scheduled Campaigns
              </h3>
              <p className="text-xs text-slate-400 mt-1 font-sans">
                Campaigns scheduled to automatically launch in the background.
              </p>
            </div>
            <button
              onClick={() => setIsScheduleModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Schedule Campaign
            </button>
          </div>

          {scheduledCampaigns.length === 0 ? (
            <div className="bg-[#090d16] border border-[#1e293b] rounded-2xl p-12 text-center space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-400">
                <Calendar className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-bold text-white font-mono uppercase">No Upcoming Campaigns</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Schedule your outreach campaigns to run automatically at a convenient date and time in the background.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {scheduledCampaigns.map((sch) => (
                <div
                  key={sch.id}
                  className="bg-[#090d16] border border-[#1e293b] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-bold text-white font-mono">{sch.name}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {sch.type === "local" ? "CSV Campaign" : "Google Sheet"}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 font-mono flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-slate-500" />
                      <span>Scheduled for: {formatTimestamp(sch.scheduledTime)}</span>
                      <span>•</span>
                      <span>Channels: {[sch.enableEmail && "Email", sch.enableWhatsapp && "WhatsApp"].filter(Boolean).join(", ")}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRunScheduledNow(sch.id)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Play className="h-3 w-3 fill-white" /> Run Now
                    </button>
                    <button
                      onClick={() => {
                        setEditingScheduleId(sch.id);
                        setScheduleName(sch.name || "");
                        setScheduleDateTime(sch.scheduledAt || sch.scheduledTime ? new Date(sch.scheduledAt || sch.scheduledTime).toISOString().slice(0, 16) : "");
                        setScheduleType(sch.type || "sheet");
                        setScheduleDelay(sch.payload?.delaySeconds || 30);
                        setScheduleEmail(sch.payload?.enableEmail !== false);
                        setScheduleWhatsapp(sch.payload?.enableWhatsapp !== false);
                        setScheduleSheetName(sch.payload?.sheetName || "");
                        setScheduleDryRun(Boolean(sch.payload?.dryRun));
                        setIsScheduleModalOpen(true);
                      }}
                      className="px-2.5 py-1.5 bg-[#030712] hover:bg-slate-800 text-indigo-300 border border-[#1e293b] rounded-lg text-xs font-mono flex items-center gap-1 cursor-pointer transition-colors"
                      title="Edit or Reschedule"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleDeleteSchedule(sch.id)}
                      className="p-1.5 hover:bg-rose-950/40 text-slate-500 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                      title="Delete Schedule"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 4: CAMPAIGN HISTORY ───────────────────────────────────────── */}
      {outreachNavTab === "history" && (
        <div className="space-y-6 max-w-5xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-white font-mono uppercase tracking-wider flex items-center gap-2.5">
                <History className="h-5 w-5 text-indigo-400" />
                Campaign Execution History
              </h3>
              <p className="text-xs text-slate-400 mt-1 font-sans">
                Review past outreach runs, metrics, and timestamps.
              </p>
            </div>
            {campaignHistory.length > 0 && (
              <button
                onClick={handleClearCampaignHistory}
                className="px-3.5 py-1.5 bg-rose-950/30 text-rose-400 hover:bg-rose-900/40 border border-rose-500/20 rounded-xl text-xs font-mono transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" /> Clear History
              </button>
            )}
          </div>

          {/* Active Running Campaign Card in History View */}
          {(campaignRunning || campaignPaused) && (
            <div className="bg-[#090d16] border border-emerald-500/40 rounded-2xl p-6 shadow-xl shadow-emerald-950/20 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[#1e293b]">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold uppercase text-emerald-400 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                      Live Active Campaign
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                        campaignPaused
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse"
                      }`}
                    >
                      {campaignPaused ? "PAUSED" : "RUNNING"}
                    </span>
                  </div>
                  <h4 className="text-base font-black text-white font-mono flex items-center gap-2">
                    <Send className="h-4 w-4 text-emerald-400" />
                    {formatDisplayCampaignTitle(activeCampaignData?.name, activeCampaignData?.source)}
                  </h4>
                  {activeCampaignData?.source && (
                    <p className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
                      <FileSpreadsheet className="h-3.5 w-3.5 text-slate-500" />
                      <span>Source:</span> <strong className="text-slate-300">{activeCampaignData.source}</strong>
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {campaignPaused ? (
                    <button
                      onClick={handleResumeCampaign}
                      disabled={isResumingCampaign}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
                    >
                      {isResumingCampaign ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-white" />}
                      Resume
                    </button>
                  ) : (
                    <button
                      onClick={handlePauseCampaign}
                      disabled={isPausingCampaign}
                      className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-amber-600/30 transition-all cursor-pointer"
                    >
                      {isPausingCampaign ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pause className="h-3.5 w-3.5 fill-white" />}
                      Pause
                    </button>
                  )}
                  <button
                    onClick={handleStopCampaign}
                    disabled={isStoppingCampaign}
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-rose-600/30 transition-all cursor-pointer"
                  >
                    {isStoppingCampaign ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5 fill-white" />}
                    Stop
                  </button>
                  <button
                    onClick={() => setOutreachNavTab("running")}
                    className="px-3.5 py-1.5 bg-[#030712] hover:bg-slate-800 text-slate-300 border border-[#1e293b] rounded-xl text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <TerminalIcon className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Active Run Panel</span>
                  </button>
                </div>
              </div>

              {/* Live Duration and Progress */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-300">
                      Processing: <strong className="text-white">{campaignProgress.current}</strong> of {campaignProgress.total} records
                    </span>
                    <span className="text-slate-500">•</span>
                    <span className="flex items-center gap-1 text-emerald-400">
                      <Clock className="h-3.5 w-3.5" />
                      Duration: <strong>{calculateDuration(activeCampaignData?.startTime, undefined)} elapsed</strong>
                    </span>
                  </div>
                  <span className="text-emerald-400 font-bold">
                    {campaignProgress.total > 0 ? Math.round((campaignProgress.current / campaignProgress.total) * 100) : 0}% Complete
                  </span>
                </div>
                <div className="w-full bg-[#1e293b] rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${campaignPaused ? "bg-amber-500" : "bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500"}`}
                    style={{ width: `${campaignProgress.total > 0 ? (campaignProgress.current / campaignProgress.total) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#030712] border border-[#1e293b] rounded-xl p-3">
                  <div className="text-[10px] text-slate-400 font-mono uppercase">Emails Sent</div>
                  <div className="text-lg font-black font-mono text-emerald-400 mt-0.5">{campaignProgress.emailsSent || 0}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{campaignProgress.emailsFailed || 0} failed</div>
                </div>
                <div className="bg-[#030712] border border-[#1e293b] rounded-xl p-3">
                  <div className="text-[10px] text-slate-400 font-mono uppercase">WhatsApp Sent</div>
                  <div className="text-lg font-black font-mono text-emerald-400 mt-0.5">{campaignProgress.whatsappSent || 0}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{campaignProgress.whatsappFailed || 0} failed</div>
                </div>
                <div className="bg-[#030712] border border-[#1e293b] rounded-xl p-3">
                  <div className="text-[10px] text-slate-400 font-mono uppercase">Skipped</div>
                  <div className="text-lg font-black font-mono text-amber-400 mt-0.5">{campaignProgress.skipped || 0}</div>
                  <div className="text-[10px] text-slate-500 font-mono">already sent / empty</div>
                </div>
                <div className="bg-[#030712] border border-[#1e293b] rounded-xl p-3">
                  <div className="text-[10px] text-slate-400 font-mono uppercase">Remaining Queue</div>
                  <div className="text-lg font-black font-mono text-indigo-400 mt-0.5">
                    {Math.max(0, campaignProgress.total - campaignProgress.current)}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">in progress</div>
                </div>
              </div>
            </div>
          )}

          {campaignHistory.length === 0 ? (
            <div className="bg-[#090d16] border border-[#1e293b] rounded-2xl p-12 text-center space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-400">
                <History className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-bold text-white font-mono uppercase">No Past Campaigns</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Completed campaigns will record here with total dispatches, failure rates, and execution runtimes.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {campaignHistory.map((item) => {
                const startTime = item.startTime || item.startedAt;
                const endTime = item.endTime || item.finishedAt;
                const stats = item.stats || {};
                const emailsSent = stats.emailsSent !== undefined ? stats.emailsSent : (item.emailsSent || 0);
                const emailsFailed = stats.emailsFailed !== undefined ? stats.emailsFailed : (item.emailsFailed || 0);
                const waSent = stats.whatsappSent !== undefined ? stats.whatsappSent : (item.whatsappSent || 0);
                const waFailed = stats.whatsappFailed !== undefined ? stats.whatsappFailed : (item.whatsappFailed || 0);
                const skipped = stats.skipped !== undefined ? stats.skipped : (item.skipped || 0);
                const total = stats.total !== undefined ? stats.total : (item.total || 0);
                const totalSent = emailsSent + waSent;
                const isErr = item.status === "Error" || item.status === "Failed";

                const cleanCampaignTitle = formatDisplayCampaignTitle(item.name, item.source);

                return (
                  <div
                    key={item.id}
                    className="bg-[#090d16] border border-[#1e293b] hover:border-indigo-500/30 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-sm font-bold text-white font-mono flex items-center gap-2">
                          <Send className="h-4 w-4 text-indigo-400" />
                          {cleanCampaignTitle}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider ${isErr
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          : item.status === "Cancelled"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          }`}>
                          {item.status || "COMPLETED"}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {item.source && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-300 border border-slate-700/60 flex items-center gap-1.5" title="Data Source CSV">
                            <FileSpreadsheet className="h-3 w-3 text-indigo-400" />
                            <span className="text-slate-500">Source:</span> {item.source}
                          </span>
                        )}
                        {item.type && (
                          <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-indigo-950/50 text-indigo-300 border border-indigo-500/30">
                            {item.type}
                          </span>
                        )}
                        {item.channels && (
                          <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-slate-800/60 text-slate-400 border border-slate-700/60 flex items-center gap-1">
                            {item.channels.email && "📧 Email"}
                            {item.channels.email && item.channels.whatsapp && " • "}
                            {item.channels.whatsapp && "💬 WhatsApp"}
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-400 font-mono flex flex-wrap items-center gap-3 pt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-slate-500" />
                          <span>Started: <strong className="text-slate-200">{formatTimestamp(startTime)}</strong></span>
                        </span>
                        {endTime && (
                          <>
                            <span>•</span>
                            <span>Ended: <strong className="text-slate-200">{formatTimestamp(endTime)}</strong></span>
                          </>
                        )}
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-slate-500" />
                          <span>Total Duration: <strong className="text-indigo-300 font-bold">{calculateDuration(startTime, endTime)}</strong></span>
                        </span>
                        {total > 0 && (
                          <>
                            <span>•</span>
                            <span>Total Leads: <strong className="text-slate-200">{total}</strong></span>
                          </>
                        )}
                      </div>

                      {item.error && (
                        <div className="text-[11px] font-mono text-rose-300 bg-rose-950/30 border border-rose-500/30 rounded-xl px-3 py-2 mt-1.5 flex items-start gap-2">
                          <AlertTriangle className="h-3.5 w-3.5 text-rose-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-rose-200">Execution Error: </span>
                            <span>{item.error}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs font-mono justify-between md:justify-end">
                      <div className="text-left md:text-right">
                        <div className="flex items-center md:justify-end gap-2">
                          <span className="text-emerald-400 font-bold text-sm bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-500/20">
                            {totalSent} Sent
                          </span>
                          {emailsFailed + waFailed > 0 && (
                            <span className="text-rose-400 font-bold text-xs bg-rose-500/10 px-2 py-0.5 rounded-lg border border-rose-500/20">
                              {emailsFailed + waFailed} Failed
                            </span>
                          )}
                        </div>
                        <div className="text-slate-400 text-[10px] mt-1 flex items-center md:justify-end gap-1.5">
                          <span>{emailsSent} email</span>
                          <span>•</span>
                          <span>{waSent} WA</span>
                          {skipped > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-amber-400/90">{skipped} skipped</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedHistoryItem(item);
                            setRescheduleDateTime(new Date(Date.now() + 10 * 60 * 1000).toISOString().slice(0, 16));
                          }}
                          className="px-3 py-1.5 bg-[#030712] hover:bg-slate-800 text-indigo-300 border border-[#1e293b] rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="View Details & Reschedule"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Details</span>
                        </button>

                        <button
                          onClick={() => handleDeleteCampaignHistoryItem(item.id)}
                          className="p-1.5 hover:bg-rose-950/40 text-slate-500 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                          title="Delete Record"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── CREATE NEW TEMPLATE MODAL ─────────────────────────────────────── */}
      {isCreatingTemplate && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#090d16] border border-[#1e293b] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[#1e293b]">
              <div className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-rose-400" />
                <h3 className="text-sm font-black text-white font-mono uppercase tracking-wider">
                  Create New Template
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreatingTemplate(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs font-mono">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Template Name</label>
                <input
                  type="text"
                  placeholder="e.g. Local Retail Outreach Pitch"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  className="w-full bg-[#030712] border border-[#1e293b] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-rose-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Email Subject Line</label>
                <input
                  type="text"
                  placeholder="e.g. Quick question for {businessName}"
                  value={newTemplateSubject}
                  onChange={(e) => setNewTemplateSubject(e.target.value)}
                  className="w-full bg-[#030712] border border-[#1e293b] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-rose-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Email Body Content</label>
                <textarea
                  rows={5}
                  placeholder="Write your email pitch with variables like {businessName}, {rating}, {senderName}..."
                  value={newTemplateBody}
                  onChange={(e) => setNewTemplateBody(e.target.value)}
                  className="w-full bg-[#030712] border border-[#1e293b] rounded-xl p-3 text-white focus:outline-none focus:border-rose-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">WhatsApp Message</label>
                <textarea
                  rows={4}
                  placeholder="Write WhatsApp message text..."
                  value={newTemplateWhatsapp}
                  onChange={(e) => setNewTemplateWhatsapp(e.target.value)}
                  className="w-full bg-[#030712] border border-[#1e293b] rounded-xl p-3 text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1e293b]">
              <button
                type="button"
                onClick={() => setIsCreatingTemplate(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-mono cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNewTemplate}
                disabled={!newTemplateName.trim()}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-rose-600/30"
              >
                <Save className="h-3.5 w-3.5" />
                <span>Save Template (JSON)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── VIEW JSON FORMAT MODAL ────────────────────────────────────────── */}
      {showJsonModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#090d16] border border-[#1e293b] rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[#1e293b]">
              <div className="flex items-center gap-2">
                <Code className="h-5 w-5 text-indigo-400" />
                <h3 className="text-sm font-black text-white font-mono uppercase tracking-wider">
                  Template JSON Format
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowJsonModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 font-sans">
              This is the exact JSON structure saved in <code className="text-rose-400 font-mono font-bold">templates.json</code>. You can copy or download it.
            </p>

            <pre className="bg-[#030712] border border-[#1e293b] rounded-xl p-4 text-[11px] font-mono text-emerald-300 max-h-96 overflow-y-auto overflow-x-auto whitespace-pre leading-relaxed select-all">
              {currentTemplateJsonString}
            </pre>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#1e293b]">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  {copiedJson ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy JSON</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadJson}
                  className="px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download .json</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowJsonModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-mono cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── SCHEDULE CAMPAIGN MODAL ────────────────────────────────────────── */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#090d16] border border-[#1e293b] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#1e293b]">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-indigo-400" />
                <h3 className="text-sm font-black text-white font-mono uppercase tracking-wider">
                  Schedule Outreach Campaign
                </h3>
              </div>
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">Campaign Name</label>
                <input
                  type="text"
                  placeholder="e.g., Weekly Prospect Outreach"
                  value={scheduleName}
                  onChange={(e) => setScheduleName(e.target.value)}
                  className="w-full bg-[#030712] border border-[#1e293b] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">Scheduled Date & Time (Local)</label>
                <input
                  type="datetime-local"
                  value={scheduleDateTime}
                  onChange={(e) => setScheduleDateTime(e.target.value)}
                  className="w-full bg-[#030712] border border-[#1e293b] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 [color-scheme:dark] font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">Data Source</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setScheduleType("sheet")}
                    className={`p-3 rounded-xl border text-xs font-mono font-bold text-left transition-all cursor-pointer ${scheduleType === "sheet"
                      ? "bg-indigo-600/20 border-indigo-500 text-white"
                      : "bg-[#030712] border-[#1e293b] text-slate-400"
                      }`}
                  >
                    Google Sheet
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleType("local")}
                    className={`p-3 rounded-xl border text-xs font-mono font-bold text-left transition-all cursor-pointer ${scheduleType === "local"
                      ? "bg-indigo-600/20 border-indigo-500 text-white"
                      : "bg-[#030712] border-[#1e293b] text-slate-400"
                      }`}
                  >
                    CSV File (data/)
                  </button>
                </div>
              </div>

              {scheduleType === "sheet" && campaignSheets.length > 0 && (
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Target Sheet Tab</label>
                  <select
                    value={scheduleSheetName}
                    onChange={(e) => setScheduleSheetName(e.target.value)}
                    className="w-full bg-[#030712] border border-[#1e293b] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono cursor-pointer"
                  >
                    <option value="">Default Active Sheet</option>
                    {campaignSheets.map((sh) => (
                      <option key={sh} value={sh}>{sh}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-2">Delivery Channels</label>
                <div className="flex items-center gap-4 text-xs font-mono text-slate-300">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={scheduleEmail}
                      onChange={(e) => setScheduleEmail(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0"
                    />
                    Email
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={scheduleWhatsapp}
                      onChange={(e) => setScheduleWhatsapp(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0"
                    />
                    WhatsApp
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">
                  Dispatch Interval: <strong className="text-indigo-400">{scheduleDelay}s</strong>
                </label>
                <input
                  type="range"
                  min="10"
                  max="120"
                  step="5"
                  value={scheduleDelay}
                  onChange={(e) => setScheduleDelay(Number(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-mono text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={scheduleDryRun}
                  onChange={(e) => setScheduleDryRun(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0"
                />
                Dry Run Simulation (test log only, no actual sending)
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1e293b]">
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-mono transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingSchedule || !scheduleName.trim() || !scheduleDateTime}
                onClick={async () => {
                  setIsSubmittingSchedule(true);
                  try {
                    if (editingScheduleId) {
                      // Update existing scheduled campaign via PUT
                      const editRes = await fetch(`/api/campaign/schedule/${encodeURIComponent(editingScheduleId)}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          name: scheduleName.trim(),
                          scheduledAt: new Date(scheduleDateTime).toISOString(),
                          delaySeconds: scheduleDelay,
                          enableEmail: scheduleEmail,
                          enableWhatsapp: scheduleWhatsapp
                        })
                      });
                      if (editRes.ok) {
                        await fetchScheduledCampaigns();
                        setIsScheduleModalOpen(false);
                        setEditingScheduleId(null);
                        setScheduleName("");
                        setScheduleDateTime("");
                      } else {
                        const err = await editRes.json().catch(() => ({}));
                        alert(`Failed to update schedule: ${err.error || "Unknown error"}`);
                      }
                    } else {
                      await handleScheduleCampaign({
                        name: scheduleName.trim(),
                        scheduledTime: new Date(scheduleDateTime).toISOString(),
                        type: scheduleType,
                        sheetName: scheduleSheetName || undefined,
                        delaySeconds: scheduleDelay,
                        enableEmail: scheduleEmail,
                        enableWhatsapp: scheduleWhatsapp,
                        dryRun: scheduleDryRun
                      });
                      setIsScheduleModalOpen(false);
                      setScheduleName("");
                      setScheduleDateTime("");
                    }
                  } finally {
                    setIsSubmittingSchedule(false);
                  }
                }}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                {isSubmittingSchedule ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Calendar className="h-3.5 w-3.5" />}
                {editingScheduleId ? "Update Schedule" : "Save Schedule"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── CAMPAIGN HISTORY DETAILS & RESCHEDULE MODAL ─────────────────────── */}
      {selectedHistoryItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#090d16] border border-[#1e293b] rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[#1e293b]">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <BarChart2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white font-mono">
                    Campaign Details & Statistics
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5 line-clamp-1">
                    {formatDisplayCampaignTitle(selectedHistoryItem.name, selectedHistoryItem.source)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHistoryItem(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Campaign Meta Overview */}
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="bg-[#030712] border border-[#1e293b] rounded-xl p-3 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase">Target Source</span>
                <span className="text-white font-bold block truncate" title={selectedHistoryItem.source}>
                  {selectedHistoryItem.source || "CSV File"}
                </span>
                <span className="text-[10px] text-slate-400">{selectedHistoryItem.type || "Local CSV"}</span>
              </div>

              <div className="bg-[#030712] border border-[#1e293b] rounded-xl p-3 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase">Final Status</span>
                <span className={`font-bold block ${selectedHistoryItem.status === "Error" || selectedHistoryItem.status === "Failed"
                  ? "text-rose-400"
                  : selectedHistoryItem.status === "Cancelled"
                    ? "text-amber-400"
                    : "text-emerald-400"
                  }`}>
                  {selectedHistoryItem.status || "COMPLETED"}
                </span>
                <span className="text-[10px] text-slate-400">
                  Duration: {calculateDuration(selectedHistoryItem.startTime || selectedHistoryItem.startedAt, selectedHistoryItem.endTime || selectedHistoryItem.finishedAt)}
                </span>
              </div>
            </div>

            {/* Detailed Dispatch Metrics */}
            <div className="space-y-2 font-mono">
              <div className="text-[11px] text-slate-400 uppercase tracking-wider font-bold">
                Performance Breakdown
              </div>
              <div className="grid grid-cols-3 gap-2.5 text-xs">
                <div className="bg-[#030712] border border-[#1e293b] rounded-xl p-3 text-center">
                  <span className="text-[10px] text-slate-400 uppercase block">Total Leads</span>
                  <span className="text-lg font-bold text-white mt-1 block">
                    {selectedHistoryItem.stats?.total || selectedHistoryItem.total || 0}
                  </span>
                </div>

                <div className="bg-[#030712] border border-[#1e293b] rounded-xl p-3 text-center">
                  <span className="text-[10px] text-emerald-400 uppercase block">Emails Sent</span>
                  <span className="text-lg font-bold text-emerald-400 mt-1 block">
                    {selectedHistoryItem.stats?.emailsSent !== undefined ? selectedHistoryItem.stats.emailsSent : (selectedHistoryItem.emailsSent || 0)}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {selectedHistoryItem.stats?.emailsFailed || selectedHistoryItem.emailsFailed || 0} failed
                  </span>
                </div>

                <div className="bg-[#030712] border border-[#1e293b] rounded-xl p-3 text-center">
                  <span className="text-[10px] text-emerald-400 uppercase block">WhatsApp Sent</span>
                  <span className="text-lg font-bold text-emerald-400 mt-1 block">
                    {selectedHistoryItem.stats?.whatsappSent !== undefined ? selectedHistoryItem.stats.whatsappSent : (selectedHistoryItem.whatsappSent || 0)}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {selectedHistoryItem.stats?.whatsappFailed || selectedHistoryItem.whatsappFailed || 0} failed
                  </span>
                </div>
              </div>
            </div>

            {/* Timestamps */}
            <div className="bg-[#030712] border border-[#1e293b] rounded-xl p-3 space-y-1.5 text-xs font-mono text-slate-400">
              <div className="flex justify-between">
                <span>Created / Started:</span>
                <span className="text-slate-200">{formatTimestamp(selectedHistoryItem.startTime || selectedHistoryItem.startedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span>Completed / Ended:</span>
                <span className="text-slate-200">{formatTimestamp(selectedHistoryItem.endTime || selectedHistoryItem.finishedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span>Spacing Interval:</span>
                <span className="text-slate-200">{selectedHistoryItem.delaySeconds || 30} seconds</span>
              </div>
              {selectedHistoryItem.error && (
                <div className="pt-1.5 border-t border-[#1e293b] text-rose-400 text-[11px]">
                  <strong>Root Cause:</strong> {selectedHistoryItem.error}
                </div>
              )}
            </div>

            {/* Reschedule Section */}
            <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-xl p-3.5 space-y-3 font-mono text-xs">
              <div className="flex items-center gap-2 font-bold text-indigo-300">
                <Clock className="h-4 w-4" />
                <span>Reschedule / Re-run This Campaign</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <input
                  type="datetime-local"
                  value={rescheduleDateTime}
                  onChange={(e) => setRescheduleDateTime(e.target.value)}
                  className="flex-1 bg-[#030712] border border-[#1e293b] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500 text-xs"
                />
                <button
                  type="button"
                  disabled={isRescheduling || !rescheduleDateTime}
                  onClick={async () => {
                    setIsRescheduling(true);
                    try {
                      const res = await fetch(`/api/campaign/history/${encodeURIComponent(selectedHistoryItem.id)}/reschedule`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          scheduledAt: new Date(rescheduleDateTime).toISOString(),
                          name: `Rerun: ${selectedHistoryItem.name}`
                        })
                      });
                      if (res.ok) {
                        alert(`Campaign successfully scheduled for ${new Date(rescheduleDateTime).toLocaleString()}!`);
                        await fetchScheduledCampaigns();
                        setSelectedHistoryItem(null);
                        setOutreachNavTab("scheduled");
                      } else {
                        const err = await res.json().catch(() => ({}));
                        alert(`Failed to reschedule: ${err.error || "Unknown error"}`);
                      }
                    } finally {
                      setIsRescheduling(false);
                    }
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  {isRescheduling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Calendar className="h-3.5 w-3.5" />}
                  <span>Reschedule</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-[#1e293b]">
              <button
                type="button"
                onClick={() => setSelectedHistoryItem(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-mono transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutreachView;

