import React, { useState } from "react";
import {
  Loader2,
  CheckCircle2,
  SlidersHorizontal,
  Smartphone,
  AlertTriangle,
  FileSpreadsheet,
  Sparkles,
  Mail,
  Briefcase,
  Building2,
  Wand2,
  MessageSquare,
  Phone,
  Send,
  Plus,
  Trash2,
  Edit3,
  Save,
  FileText,
  X,
  Code
} from "lucide-react";
import { useLeadFinder } from "../context/LeadFinderContext";
import { PitchStrategy, CustomTemplateItem } from "../types";

export const SettingsView: React.FC = () => {
  const {
    settingsSubView,
    setSettingsSubView,
    pitchTemplates,
    setPitchTemplates,
    selectedTemplateTab,
    setSelectedTemplateTab,
    handleSaveTemplates,
    isSavingTemplates,
    handleResetTemplates,
    getTemplateField,
    updateTemplateField,
    insertVariableTag,
    interpolateVariables,
    handleSetGoal,
    handleSetStrategy,
    handleSetJobSubGoal,
    whatsappStatus,
    handleInitializeWhatsApp,
    handleDisconnectWhatsApp,
    isDisconnectingWa,
    handleSendTestMessage,
    isSendingTestMsg,
    smtpHost,
    setSmtpHost,
    smtpPort,
    setSmtpPort,
    smtpUser,
    setSmtpUser,
    smtpPass,
    setSmtpPass,
    smtpFrom,
    setSmtpFrom,
    isSavingSmtp,
    smtpSuccess,
    handleSaveSmtp,
    webhookConfigured,
    isTestingWebhook,
    handleTestWebhook,
    copiedScript,
    setCopiedScript,
  } = useLeadFinder();

  // Custom templates management inside Settings
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customSubject, setCustomSubject] = useState("");
  const [customBody, setCustomBody] = useState("");
  const [customWhatsapp, setCustomWhatsapp] = useState("");
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);

  const handleCreateCustom = async () => {
    if (!customName.trim()) {
      alert("Please enter a name for the new template.");
      return;
    }
    const newId = "custom_" + Date.now();
    const newItem: CustomTemplateItem = {
      id: newId,
      name: customName.trim(),
      emailSubject: customSubject.trim() || `Inquiry for {businessName}`,
      emailBody: customBody.trim() || `Hi {businessName},\n\nI wanted to reach out regarding your business.\n\nBest,\n{senderName}`,
      whatsappMessage: customWhatsapp.trim() || `Hi {businessName}! 👋 I came across your profile and would love to connect.`
    };
    const updatedCustoms = [...(pitchTemplates.customTemplates || []), newItem];
    const updatedConfig = {
      ...pitchTemplates,
      customTemplates: updatedCustoms
    };
    await handleSaveTemplates(updatedConfig);
    setSelectedTemplateTab(newId);
    setIsAddingCustom(false);
    setCustomName("");
    setCustomSubject("");
    setCustomBody("");
    setCustomWhatsapp("");
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 3000);
  };

  const handleDeleteCustom = async (templateId: string) => {
    if (!confirm("Are you sure you want to delete this custom template from templates.json?")) return;
    const filtered = (pitchTemplates.customTemplates || []).filter(t => t.id !== templateId);
    const updatedConfig = {
      ...pitchTemplates,
      customTemplates: filtered
    };
    await handleSaveTemplates(updatedConfig);
    setSelectedTemplateTab("hasWebsite");
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl animate-fadeIn">
      {settingsSubView === "templates" ? (
        /* DEDICATED FULL SUB-PAGE: MESSAGE TEMPLATES & CANDIDATE SETUP */
        <div className="space-y-5">
          {/* Top Bar Navigation */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#1e293b]/60">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSettingsSubView("overview")}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-[#1e293b] text-xs font-mono rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                ← Back to Integrations
              </button>
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                Template Setup & Profiles
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetTemplates}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-[11px] font-mono rounded-lg transition-all cursor-pointer"
              >
                Reset Defaults
              </button>
              <button
                type="button"
                onClick={() => handleSaveTemplates()}
                disabled={isSavingTemplates}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold font-mono text-[11px] rounded-lg cursor-pointer transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSavingTemplates ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Save Templates
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="bg-[#090d16] border border-[#1e293b] rounded-2xl p-6 space-y-5">
            {/* Campaign Goal Switcher & Target Engagement Model */}
            <div className="p-4 bg-[#030712] border border-[#1e293b] rounded-xl space-y-4 font-mono text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5 text-indigo-400" />
                    1. Campaign Purpose / Goal
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleSetGoal("business")}
                      className={`px-3 py-2.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center justify-center gap-1.5 border cursor-pointer ${
                        pitchTemplates.campaignGoal === "business"
                          ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20"
                          : "bg-[#090d16] border-[#1e293b] text-slate-400 hover:text-white"
                      }`}
                    >
                      <Building2 className="h-3.5 w-3.5" />
                      Business Pitch
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetGoal("job")}
                      className={`px-3 py-2.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center justify-center gap-1.5 border cursor-pointer ${
                        pitchTemplates.campaignGoal === "job"
                          ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20"
                          : "bg-[#090d16] border-[#1e293b] text-slate-400 hover:text-white"
                      }`}
                    >
                      <Briefcase className="h-3.5 w-3.5" />
                      Job / Freelance
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                    <Wand2 className="h-3.5 w-3.5 text-indigo-400" />
                    2. Default Strategy Mode
                  </label>
                  <select
                    value={pitchTemplates.selectedStrategy}
                    onChange={(e) => handleSetStrategy(e.target.value as PitchStrategy)}
                    className="w-full text-xs bg-[#090d16] border border-[#1e293b] rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-indigo-500 font-mono cursor-pointer"
                  >
                    {pitchTemplates.campaignGoal === "business" ? (
                      <>
                        <option value="ai">⚡ NVIDIA AI Auto Pitch (Dynamic per lead)</option>
                        <option value="noWebsite">🌐 Demo Website Pitch (For Missing Sites)</option>
                        <option value="hasWebsite">📱 Social Media & Booking Pitch</option>
                        <option value="custom">✏️ Custom Saved Template</option>
                      </>
                    ) : (
                      <>
                        <option value="ai">
                          ⚡ NVIDIA AI Auto Pitch (
                          {pitchTemplates.jobSubGoal === "jobOnly"
                            ? "Job Application Focus"
                            : pitchTemplates.jobSubGoal === "freelanceOnly"
                              ? "Freelance Services Focus"
                              : "Job + Freelance Flexible"}
                          )
                        </option>
                        <option value="jobOnly">💼 Full-Time Job Application Template</option>
                        <option value="freelanceOnly">⚡ Freelance Services Pitch Template</option>
                        <option value="both">🤝 Flexible (Job + Freelance) Template</option>
                        <option value="custom">✏️ Custom Saved Template</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Target Engagement Model (Job Mode only) */}
              {pitchTemplates.campaignGoal === "job" && (
                <div className="pt-3 border-t border-[#1e293b]/60 flex flex-col md:flex-row md:items-center justify-between gap-2 animate-fadeIn">
                  <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">
                    Target Engagement Model:
                  </span>
                  <div className="grid grid-cols-3 gap-2 flex-grow max-w-md">
                    <button
                      type="button"
                      onClick={() => handleSetJobSubGoal("jobOnly")}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold transition-all border cursor-pointer text-center ${
                        (pitchTemplates.jobSubGoal || "both") === "jobOnly"
                          ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/20"
                          : "bg-[#090d16] border-[#1e293b] text-slate-400 hover:text-white"
                      }`}
                    >
                      💼 Job Only
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetJobSubGoal("freelanceOnly")}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold transition-all border cursor-pointer text-center ${
                        pitchTemplates.jobSubGoal === "freelanceOnly"
                          ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/20"
                          : "bg-[#090d16] border-[#1e293b] text-slate-400 hover:text-white"
                      }`}
                    >
                      ⚡ Freelance
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetJobSubGoal("both")}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold transition-all border cursor-pointer text-center ${
                        (pitchTemplates.jobSubGoal || "both") === "both"
                          ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/20"
                          : "bg-[#090d16] border-[#1e293b] text-slate-400 hover:text-white"
                      }`}
                    >
                      🤝 Both (Flexible)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Identification Profile (Adaptive: Candidate vs Agency) */}
            <div className="p-4 bg-[#030712] border border-[#1e293b] rounded-xl space-y-3 font-mono text-xs">
              <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                {pitchTemplates.campaignGoal === "job" ? "Candidate Profile & Links" : "Agency & Sender Identification"}
              </div>

              {pitchTemplates.campaignGoal === "job" ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                        Your Full Name (<span className="text-indigo-400">{`{senderName}`}</span>)
                      </label>
                      <input
                        type="text"
                        value={pitchTemplates.senderName}
                        onChange={(e) => setPitchTemplates({ ...pitchTemplates, senderName: e.target.value })}
                        placeholder="e.g. Dhananjay Shahane"
                        className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                        Role Title / Specialization (<span className="text-indigo-400">{`{roleTitle}`}</span>)
                      </label>
                      <input
                        type="text"
                        value={pitchTemplates.roleTitle}
                        onChange={(e) => setPitchTemplates({ ...pitchTemplates, roleTitle: e.target.value })}
                        placeholder="e.g. Full Stack Developer & AI Specialist"
                        className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                        Skills & Tech Stack (<span className="text-indigo-400">{`{skills}`}</span>)
                      </label>
                      <input
                        type="text"
                        value={pitchTemplates.skills}
                        onChange={(e) => setPitchTemplates({ ...pitchTemplates, skills: e.target.value })}
                        placeholder="e.g. React, Node.js, AI Automation, TypeScript"
                        className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                        Portfolio / GitHub URL (<span className="text-indigo-400">{`{portfolioUrl}`}</span>)
                      </label>
                      <input
                        type="text"
                        value={pitchTemplates.portfolioUrl}
                        onChange={(e) => setPitchTemplates({ ...pitchTemplates, portfolioUrl: e.target.value })}
                        placeholder="e.g. https://github.com/dhananjayshahane"
                        className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                      Your Name (<span className="text-indigo-400">{`{senderName}`}</span>)
                    </label>
                    <input
                      type="text"
                      value={pitchTemplates.senderName}
                      onChange={(e) => setPitchTemplates({ ...pitchTemplates, senderName: e.target.value })}
                      placeholder="e.g. Dhananjay Shahane"
                      className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                      Agency / Company Name (<span className="text-indigo-400">{`{senderCompany}`}</span>)
                    </label>
                    <input
                      type="text"
                      value={pitchTemplates.senderCompany}
                      onChange={(e) => setPitchTemplates({ ...pitchTemplates, senderCompany: e.target.value })}
                      placeholder="e.g. Digital Growth Studio"
                      className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Scenario & Template Tabs */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  Select Template Scenario to Edit:
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-indigo-400 font-mono font-bold">
                    Active: <strong className="text-white">
                      {pitchTemplates.customTemplates?.find(t => t.id === selectedTemplateTab)?.name || selectedTemplateTab}
                    </strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddingCustom(!isAddingCustom)}
                    className="px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-mono font-bold flex items-center gap-1 cursor-pointer transition-all"
                  >
                    <Plus className="h-3 w-3" />
                    <span>{isAddingCustom ? "Cancel" : "Add Template"}</span>
                  </button>
                </div>
              </div>

              {/* Add Custom Template Inline Form */}
              {isAddingCustom && (
                <div className="p-4 bg-[#030712] border border-indigo-500/40 rounded-xl space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
                    <span className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                      <Plus className="h-3.5 w-3.5 text-indigo-400" />
                      Create New Custom Template
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAddingCustom(false)}
                      className="text-slate-400 hover:text-white p-1"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Template Name</label>
                      <input
                        type="text"
                        placeholder="e.g., Local Dental Outreach Pitch"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Email Subject Line</label>
                      <input
                        type="text"
                        placeholder="e.g., Quick question for {businessName}"
                        value={customSubject}
                        onChange={(e) => setCustomSubject(e.target.value)}
                        className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1 text-xs font-mono">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Email Body</label>
                    <textarea
                      rows={3}
                      placeholder="Write email template with placeholders like {businessName}, {senderName}..."
                      value={customBody}
                      onChange={(e) => setCustomBody(e.target.value)}
                      className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg p-2.5 text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  <div className="space-y-1 text-xs font-mono">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">WhatsApp Message</label>
                    <textarea
                      rows={2}
                      placeholder="Write WhatsApp message text..."
                      value={customWhatsapp}
                      onChange={(e) => setCustomWhatsapp(e.target.value)}
                      className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg p-2.5 text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1e293b]">
                    <button
                      type="button"
                      onClick={() => setIsAddingCustom(false)}
                      className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs font-mono cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateCustom}
                      disabled={!customName.trim()}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/30"
                    >
                      <Save className="h-3 w-3" />
                      Save Template (JSON)
                    </button>
                  </div>
                </div>
              )}

              {/* Template Tab Buttons */}
              <div className="flex flex-wrap gap-2 border-b border-[#1e293b]/60 pb-3">
                {pitchTemplates.campaignGoal === "business" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setSelectedTemplateTab("noWebsite")}
                      className={`px-3 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border text-center ${
                        selectedTemplateTab === "noWebsite"
                          ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30 scale-[1.02]"
                          : "bg-slate-900/90 border-[#1e293b] text-slate-400 hover:text-white hover:border-slate-700"
                      }`}
                    >
                      🌐 Missing Website
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTemplateTab("hasWebsite")}
                      className={`px-3 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border text-center ${
                        selectedTemplateTab === "hasWebsite"
                          ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30 scale-[1.02]"
                          : "bg-slate-900/90 border-[#1e293b] text-slate-400 hover:text-white hover:border-slate-700"
                      }`}
                    >
                      📱 Existing Website
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTemplateTab("custom")}
                      className={`px-3 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border text-center ${
                        selectedTemplateTab === "custom"
                          ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30 scale-[1.02]"
                          : "bg-slate-900/90 border-[#1e293b] text-slate-400 hover:text-white hover:border-slate-700"
                      }`}
                    >
                      ✏️ Custom Pitch
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setSelectedTemplateTab("jobOnly")}
                      className={`px-3 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border text-center ${
                        selectedTemplateTab === "jobOnly"
                          ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30 scale-[1.02]"
                          : "bg-slate-900/90 border-[#1e293b] text-slate-400 hover:text-white hover:border-slate-700"
                      }`}
                    >
                      💼 Full-Time Job
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTemplateTab("freelanceOnly")}
                      className={`px-3 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border text-center ${
                        selectedTemplateTab === "freelanceOnly"
                          ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30 scale-[1.02]"
                          : "bg-slate-900/90 border-[#1e293b] text-slate-400 hover:text-white hover:border-slate-700"
                      }`}
                    >
                      ⚡ Freelance Services
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTemplateTab("jobAndFreelance")}
                      className={`px-3 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border text-center ${
                        selectedTemplateTab === "jobAndFreelance"
                          ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30 scale-[1.02]"
                          : "bg-slate-900/90 border-[#1e293b] text-slate-400 hover:text-white hover:border-slate-700"
                      }`}
                    >
                      🤝 Both (Flexible)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTemplateTab("custom")}
                      className={`px-3 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border text-center ${
                        selectedTemplateTab === "custom"
                          ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30 scale-[1.02]"
                          : "bg-slate-900/90 border-[#1e293b] text-slate-400 hover:text-white hover:border-slate-700"
                      }`}
                    >
                      ✏️ Custom Candidate
                    </button>
                  </>
                )}

                {/* Custom Templates Tabs */}
                {pitchTemplates.customTemplates?.map((customT) => {
                  const isActive = selectedTemplateTab === customT.id;
                  return (
                    <div
                      key={customT.id}
                      className={`flex items-center rounded-xl border transition-all ${
                        isActive
                          ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30 scale-[1.02]"
                          : "bg-slate-900/90 border-[#1e293b] text-slate-300 hover:text-white hover:border-slate-700"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedTemplateTab(customT.id)}
                        className="px-3 py-2 text-xs font-mono font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <FileText className="h-3 w-3" />
                        <span>{customT.name}</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCustom(customT.id);
                        }}
                        className={`p-1.5 rounded-r-xl transition-colors cursor-pointer ${
                          isActive
                            ? "hover:bg-indigo-700 text-indigo-200"
                            : "hover:bg-slate-800 text-slate-500 hover:text-indigo-400"
                        }`}
                        title="Delete template"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tag Insertion Buttons */}
            <div className="p-3 bg-[#030712]/80 rounded-xl border border-[#1e293b] space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase font-mono">
                <span>Quick Insert Dynamic Tags:</span>
                <span className="text-slate-500 text-[9px] font-mono">Appends to active template fields</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                {(pitchTemplates.campaignGoal === "job"
                  ? ["{businessName}", "{roleTitle}", "{skills}", "{portfolioUrl}", "{senderName}", "{rating}", "{reviews}", "{address}"]
                  : ["{businessName}", "{category}", "{rating}", "{reviews}", "{address}", "{website}", "{senderName}", "{senderCompany}"]
                ).map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => insertVariableTag("whatsappMessage", tag)}
                    className="px-2.5 py-1 bg-indigo-950/50 hover:bg-indigo-900/80 text-indigo-300 hover:text-white border border-indigo-500/30 rounded-lg text-[10px] font-mono transition-all cursor-pointer shadow-sm"
                    title={`Click to append ${tag}`}
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Template Editors */}
            <div className="space-y-4">
              {/* If Custom Template is selected, allow renaming or deleting it */}
              {(() => {
                const activeCustom = pitchTemplates.customTemplates?.find(t => t.id === selectedTemplateTab);
                if (!activeCustom) return null;
                return (
                  <div className="p-4 bg-[#030712] border border-indigo-500/30 rounded-xl flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
                    <div className="flex-grow max-w-md space-y-1">
                      <label className="text-[10px] text-slate-400 font-bold uppercase">Custom Template Name</label>
                      <input
                        type="text"
                        value={activeCustom.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPitchTemplates(prev => ({
                            ...prev,
                            customTemplates: (prev.customTemplates || []).map(t =>
                              t.id === activeCustom.id ? { ...t, name: val } : t
                            )
                          }));
                        }}
                        className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500 font-mono text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-3">
                      <button
                        type="button"
                        onClick={() => handleDeleteCustom(activeCustom.id)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-indigo-400" />
                        <span>Delete Template</span>
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* WhatsApp message editor */}
              <div className="p-4 bg-[#030712] border border-[#1e293b] rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-emerald-400 font-mono flex items-center gap-1.5">
                    <Smartphone className="h-3.5 w-3.5" />
                    WhatsApp Message Template
                  </label>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {getTemplateField("whatsappMessage").length} chars
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={getTemplateField("whatsappMessage")}
                  onChange={(e) => updateTemplateField("whatsappMessage", e.target.value)}
                  className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg p-3 text-xs font-mono text-white focus:outline-none focus:border-indigo-500 leading-relaxed resize-y"
                  placeholder="Enter WhatsApp pitch message..."
                />
              </div>

              {/* Email Subject & Body */}
              <div className="p-4 bg-[#030712] border border-[#1e293b] rounded-xl space-y-3">
                <label className="text-xs font-bold text-indigo-400 font-mono flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  Email Subject Line
                </label>
                <input
                  type="text"
                  value={getTemplateField("emailSubject")}
                  onChange={(e) => updateTemplateField("emailSubject", e.target.value)}
                  className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                  placeholder="Enter email subject line..."
                />

                <div className="pt-2">
                  <label className="text-xs font-bold text-indigo-300 font-mono block mb-1.5">
                    Email Message Body
                  </label>
                  <textarea
                    rows={6}
                    value={getTemplateField("emailBody")}
                    onChange={(e) => updateTemplateField("emailBody", e.target.value)}
                    className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg p-3 text-xs font-mono text-white focus:outline-none focus:border-indigo-500 leading-relaxed resize-y"
                    placeholder="Enter email pitch body..."
                  />
                </div>
              </div>

              {/* Live Preview of active scenario */}
              <div className="p-4 bg-indigo-950/10 border border-indigo-500/20 rounded-xl space-y-2 font-mono text-xs">
                <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Live Render Preview (Sample Target: "Apex Dental Care")
                </div>
                <div className="bg-[#030712] p-3.5 rounded-lg border border-[#1e293b] space-y-2.5 text-slate-300 whitespace-pre-wrap text-[11px] leading-relaxed">
                  <div className="text-emerald-400 font-bold flex items-center gap-1">
                    <Smartphone className="h-3 w-3" /> WhatsApp Output:
                  </div>
                  <div className="bg-[#090d16] p-2.5 rounded border border-[#1e293b]/60 text-slate-200">
                    {interpolateVariables(
                      getTemplateField("whatsappMessage"),
                      {
                        businessName: "Apex Dental Care",
                        category: "Dental Clinic",
                        rating: 4.9,
                        reviews: 120,
                        address: "Baner Road, Pune",
                        website: selectedTemplateTab === "noWebsite" ? "" : "https://apexdental.in",
                      } as any,
                      pitchTemplates
                    )}
                  </div>
                  <div className="border-t border-[#1e293b] pt-2 text-indigo-400 font-bold flex items-center gap-1">
                    <Mail className="h-3 w-3" /> Email Output:
                  </div>
                  <div className="bg-[#090d16] p-2.5 rounded border border-[#1e293b]/60 space-y-1.5">
                    <div>
                      <strong className="text-slate-400">Subject:</strong>{" "}
                      <span className="text-white">
                        {interpolateVariables(
                          getTemplateField("emailSubject"),
                          {
                            businessName: "Apex Dental Care",
                            category: "Dental Clinic",
                            rating: 4.9,
                            reviews: 120,
                            address: "Baner Road, Pune",
                            website: selectedTemplateTab === "noWebsite" ? "" : "https://apexdental.in",
                          } as any,
                          pitchTemplates
                        )}
                      </span>
                    </div>
                    <div className="text-slate-300">
                      {interpolateVariables(
                        getTemplateField("emailBody"),
                        {
                          businessName: "Apex Dental Care",
                          category: "Dental Clinic",
                          rating: 4.9,
                          reviews: 120,
                          address: "Baner Road, Pune",
                          website: selectedTemplateTab === "noWebsite" ? "" : "https://apexdental.in",
                        } as any,
                        pitchTemplates
                      )}
                    </div>
                  </div>
                </div>
              {/* Save & Feedback Action */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#030712] border border-[#1e293b] rounded-xl font-mono text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Save template changes directly to</span>
                  <code className="text-indigo-400 font-bold bg-[#090d16] px-2 py-0.5 rounded border border-[#1e293b]">templates.json</code>
                  {saveSuccessNotice && (
                    <span className="text-emerald-400 font-bold flex items-center gap-1 animate-in fade-in ml-2">
                      <CheckCircle2 className="h-4 w-4" /> Saved!
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await handleSaveTemplates();
                    setSaveSuccessNotice(true);
                    setTimeout(() => setSaveSuccessNotice(false), 3000);
                  }}
                  disabled={isSavingTemplates}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold font-mono text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/20 disabled:opacity-50"
                >
                  {isSavingTemplates ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5" /> Save to templates.json
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Navigation */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setSettingsSubView("overview")}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-[#1e293b] text-xs font-mono rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              ← Back to Integrations Overview
            </button>
            <button
              type="button"
              onClick={() => {
                handleSaveTemplates();
                setSettingsSubView("overview");
              }}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold font-mono text-xs rounded-xl transition-all cursor-pointer shadow-md shadow-indigo-600/20"
            >
              Save & Return
            </button>
          </div>
        </div>
        </div>
      ) : (
        /* INTEGRATIONS OVERVIEW PAGE */
        <div className="space-y-6">
          {/* Row 1: Message Templates & Candidate / Agency Outreach Setup Card */}
          <div className="bg-[#090d16] border border-[#1e293b] rounded-2xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#1e293b]/60 gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-indigo-600/10 border border-indigo-500/20 rounded-xl text-indigo-400">
                  <SlidersHorizontal className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white font-mono uppercase tracking-widest flex items-center gap-2">
                    Outreach Message Templates & Profiles
                  </h3>
                  <p className="text-xs text-slate-400 font-sans mt-0.5">
                    Customize pitch copy for WhatsApp & Email, engagement models (Job / Freelance / Business), and candidate/agency profiles.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSettingsSubView("templates")}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-mono font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md shadow-indigo-600/20 flex items-center gap-2 shrink-0"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Manage & Setup Templates →
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs pt-1">
              <div className="bg-[#030712] border border-[#1e293b] p-3 rounded-xl space-y-1">
                <div className="text-[10px] text-slate-500 uppercase font-bold">Campaign Goal</div>
                <div className="text-white font-bold flex items-center gap-1.5 text-[11px]">
                  {pitchTemplates.campaignGoal === "business" ? "🏢 Business Client Pitch" : "💼 Job / Freelance Outreach"}
                </div>
              </div>
              <div className="bg-[#030712] border border-[#1e293b] p-3 rounded-xl space-y-1">
                <div className="text-[10px] text-slate-500 uppercase font-bold">
                  {pitchTemplates.campaignGoal === "business" ? "Active Agency" : "Candidate Profile"}
                </div>
                <div className="text-white font-bold truncate text-[11px]">
                  {pitchTemplates.senderName || "Dhananjay Shahane"}
                </div>
              </div>
              <div className="bg-[#030712] border border-[#1e293b] p-3 rounded-xl space-y-1">
                <div className="text-[10px] text-slate-500 uppercase font-bold">Selected Strategy</div>
                <div className="text-indigo-400 font-bold text-[11px]">
                  {pitchTemplates.selectedStrategy === "ai" ? "⚡ NVIDIA AI Auto Pitch" : pitchTemplates.selectedStrategy}
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: WhatsApp scan settings */}
          <div className="bg-[#090d16] border border-[#1e293b] rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1e293b]/60">
              <div className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-indigo-400" />
                <h3 className="text-xs font-bold text-white font-mono uppercase tracking-widest">WhatsApp Device Gateway</h3>
              </div>

              {whatsappStatus.status === "CONNECTED" && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSendTestMessage}
                    disabled={isSendingTestMsg}
                    className="px-3 py-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/25 font-bold font-mono text-[10px] rounded-lg cursor-pointer transition-all disabled:opacity-50"
                  >
                    {isSendingTestMsg ? "Sending Test..." : "Send Test Message"}
                  </button>
                  <button
                    onClick={handleDisconnectWhatsApp}
                    disabled={isDisconnectingWa}
                    className="px-3 py-1.5 bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/25 font-bold font-mono text-[10px] rounded-lg cursor-pointer transition-all disabled:opacity-50"
                  >
                    {isDisconnectingWa ? "Disconnecting..." : "Disconnect WhatsApp"}
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-col md:flex-row items-center gap-8 py-2">
              <div className="flex-1 space-y-3">
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  Connect your phone via WhatsApp Web. Once authenticated, the outreach agent runs automated campaigns and delivers customized pitches to business lines directly.
                </p>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-slate-400">Connection status:</span>
                    <span
                      className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                        whatsappStatus.status === "CONNECTED"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : whatsappStatus.status === "CONNECTING"
                            ? "bg-indigo-500/10 text-indigo-400 animate-pulse"
                            : whatsappStatus.status === "QR_READY"
                              ? "bg-amber-500/10 text-amber-400"
                              : "bg-slate-500/10 text-slate-400"
                      }`}
                    >
                      {whatsappStatus.status === "CONNECTED" ? "ACTIVE" : whatsappStatus.status}
                    </span>
                  </div>
                </div>

                {whatsappStatus.status === "DISCONNECTED" && (
                  <button
                    onClick={handleInitializeWhatsApp}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold rounded-lg cursor-pointer transition-all shadow-md shadow-indigo-600/10"
                  >
                    Generate QR Link Code
                  </button>
                )}

                {whatsappStatus.status === "QR_READY" && (
                  <button
                    onClick={handleInitializeWhatsApp}
                    className="px-4 py-2 bg-amber-600/10 hover:bg-amber-600/20 text-amber-400 border border-amber-500/20 text-xs font-mono font-bold rounded-lg cursor-pointer transition-all"
                  >
                    Regenerate / Reload QR Code
                  </button>
                )}
              </div>

              {/* QR Image View */}
              {whatsappStatus.status !== "CONNECTED" && (
                <div className="shrink-0 flex items-center justify-center p-4 bg-white rounded-xl border border-slate-200 w-48 h-48 shadow-lg relative">
                  {whatsappStatus.qr ? (
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(whatsappStatus.qr)}`}
                      alt="WhatsApp Scan QR"
                      className="w-40 h-40"
                    />
                  ) : (
                    <div className="text-slate-400 text-center font-mono text-[10px]">
                      {whatsappStatus.status === "CONNECTING" ? (
                        <div className="space-y-2 flex flex-col items-center">
                          <Loader2 className="h-6 w-6 text-indigo-600 animate-spin" />
                          <span>{isDisconnectingWa ? "Re-initializing session..." : "Booting headless client..."}</span>
                        </div>
                      ) : (
                        "Click 'Generate QR Link' to prompt scan connection."
                      )}
                    </div>
                  )}
                </div>
              )}

              {whatsappStatus.status === "CONNECTED" && (
                <div className="shrink-0 flex flex-col items-center justify-center p-6 bg-slate-900/50 border border-emerald-500/20 rounded-xl w-48 h-48 text-emerald-400 font-mono text-xs">
                  <CheckCircle2 className="h-12 w-12 text-emerald-400 mb-2 animate-bounce" />
                  <span className="font-bold text-center">Session Verified</span>
                  <span className="text-[10px] text-slate-500 mt-1">Active Gateway</span>
                </div>
              )}
            </div>
          </div>

          {/* Row 3: SMTP configs */}
          <div className="bg-[#090d16] border border-[#1e293b] rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#1e293b]/60">
              <Mail className="h-5 w-5 text-indigo-400" />
              <h3 className="text-xs font-bold text-white font-mono uppercase tracking-widest">SMTP Mail configuration</h3>
            </div>

            <form onSubmit={handleSaveSmtp} className="space-y-4 font-mono text-xs max-w-2xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 tracking-wider uppercase mb-1">SMTP Server Host</label>
                  <input
                    type="text"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="e.g. smtp.gmail.com"
                    className="w-full bg-[#030712] border border-[#1e293b] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 tracking-wider uppercase mb-1">SMTP Port</label>
                  <input
                    type="number"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    placeholder="e.g. 587"
                    className="w-full bg-[#030712] border border-[#1e293b] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 tracking-wider uppercase mb-1">Authorized SMTP User</label>
                  <input
                    type="email"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    placeholder="user@gmail.com"
                    className="w-full bg-[#030712] border border-[#1e293b] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 tracking-wider uppercase mb-1">SMTP User Password</label>
                  <input
                    type="password"
                    value={smtpPass}
                    onChange={(e) => setSmtpPass(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#030712] border border-[#1e293b] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-400 tracking-wider uppercase mb-1">Display Sender Name (From Header)</label>
                <input
                  type="text"
                  value={smtpFrom}
                  onChange={(e) => setSmtpFrom(e.target.value)}
                  placeholder="e.g. Digital Branding Team"
                  className="w-full bg-[#030712] border border-[#1e293b] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Gmail Advisory warning */}
              <div className="p-3.5 bg-amber-500/5 border border-amber-500/20 rounded-xl flex items-start gap-2.5 text-amber-400/90 font-sans leading-relaxed">
                <AlertTriangle className="h-4.5 w-4.5 shrink-0 mt-0.5 text-amber-500" />
                <div>
                  <span className="font-bold block text-amber-400 mb-1">Using Gmail SMTP?</span>
                  To avoid Google authentication blocks, do NOT use your standard account password. You MUST set up a 16-character <strong className="text-white">Google App Password</strong> under your Account settings page (2-Step Verification) and paste it here.
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSavingSmtp}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg cursor-pointer transition-all disabled:opacity-50"
                >
                  {isSavingSmtp ? "Saving Configurations..." : smtpSuccess ? "SMTP Verified ✅" : "Save SMTP credentials"}
                </button>
              </div>
            </form>
          </div>

          {/* Row 4: Sheet webhook setups */}
          <div className="bg-[#090d16] border border-[#1e293b] rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#1e293b]/60">
              <FileSpreadsheet className="h-5 w-5 text-indigo-400" />
              <h3 className="text-xs font-bold text-white font-mono uppercase tracking-widest">Google Sheet Webhook Sync</h3>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Synchronize your lead harvests live into your Google Sheets document. Deploy the Apps Script below in your spreadsheet and paste the Web App URL into your local <code className="text-indigo-400">.env</code> configuration file (<code className="text-indigo-400">GOOGLE_SHEET_WEBHOOK_URL</code>).
            </p>

            <div className="space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Spreadsheet Webhook Connection:</span>
                <span
                  className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                    webhookConfigured ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                  }`}
                >
                  {webhookConfigured ? "Sync Configured" : "Sync Disabled"}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleTestWebhook}
                  disabled={isTestingWebhook}
                  className="px-4 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/25 font-bold rounded-lg cursor-pointer transition-all disabled:opacity-50"
                >
                  {isTestingWebhook ? "Ping Verification..." : "Test Webhook Connection"}
                </button>

                <button
                  onClick={() => {
                    const code = `// ============================================
// Google Apps Script for LeadFinder AI Web App
// PASTE THIS ENTIRE CODE IN YOUR APPS SCRIPT
// Then: Deploy → New deployment → Web app
// ============================================

// Column header mapping (JSON key → Sheet column name)
var HEADER_MAP = {
  "businessName": "Business Name",
  "phone": "Phone Number",
  "address": "Address",
  "rating": "Rating",
  "reviews": "Reviews",
  "website": "Website",
  "websiteStatus": "Website Status",
  "instagramUrl": "Instagram URL",
  "instagramStatus": "Instagram Status",
  "instagramLastPost": "Instagram Last Post",
  "facebookUrl": "Facebook URL",
  "facebookStatus": "Facebook Status",
  "facebookLastPost": "Facebook Last Post",
  "linkedinUrl": "LinkedIn URL",
  "linkedinStatus": "LinkedIn Status",
  "emails": "Emails",
  "googleAnalyticsPresent": "Google Analytics",
  "metaPixelPresent": "Meta Pixel",
  "whatsappPresent": "WhatsApp Present",
  "appointmentSystem": "Appointment System",
  "mapsUrl": "Google Maps URL",
  "leadScore": "Lead Score",
  "leadPriority": "Lead Priority",
  "dateAdded": "Date Added",
  "aiInsight": "AI Insight",
  "category": "Category",
  "websiteMissing": "Website Missing",
  "emailStatus": "Email Status",
  "emailSentDate": "Email Sent Date",
  "whatsappStatus": "WhatsApp Status",
  "whatsappSentDate": "WhatsApp Sent Date"
};

// Reverse map: Sheet column name → JSON key (used by doGet)
var REVERSE_HEADER_MAP = {};
for (var key in HEADER_MAP) {
  REVERSE_HEADER_MAP[HEADER_MAP[key]] = key;
}

// Helper to prevent Google Sheets from interpreting "+" or "=" as formulas
function sanitizeForSheet(val) {
  if (val === null || val === undefined) return "";
  var str = String(val);
  if (str.indexOf('+') === 0 || str.indexOf('=') === 0) {
    return "\\u200B" + str;
  }
  return val;
}

// Helper to sanitize sheet name (limit to 31 chars and remove invalid characters: \\ / ? * : [ ])
function sanitizeSheetName(name) {
  if (!name) return "Leads";
  var clean = name.replace(/[\\\\/\\?\\*:\\[\\]]/g, "");
  // Remove single quotes from beginning or end
  clean = clean.replace(/^'+|'+$/g, "");
  return clean.substring(0, 31).trim();
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    
    // ── Handle outreach status updates (searches all sheets) ──
    if (data.action === "updateOutreach") {
      var sheets = activeSpreadsheet.getSheets();
      var targetRow = -1;
      var targetSheet = null;
      var headers = null;
      
      for (var s = 0; s < sheets.length; s++) {
        var currentSheet = sheets[s];
        if (currentSheet.getLastRow() <= 1) continue;
        
        var currentHeaders = currentSheet.getRange(1, 1, 1, currentSheet.getLastColumn()).getValues()[0];
        var mapsUrlCol = currentHeaders.indexOf("Google Maps URL");
        if (mapsUrlCol === -1) mapsUrlCol = currentHeaders.indexOf("Maps URL");
        var nameCol = currentHeaders.indexOf("Business Name");
        
        if (mapsUrlCol !== -1 || nameCol !== -1) {
          var rows = currentSheet.getDataRange().getValues();
          for (var i = 1; i < rows.length; i++) {
            if (mapsUrlCol !== -1 && data.mapsUrl && rows[i][mapsUrlCol] === data.mapsUrl) {
              targetRow = i + 1;
              targetSheet = currentSheet;
              headers = currentHeaders;
              break;
            }
            if (nameCol !== -1 && rows[i][nameCol] === data.businessName) {
              targetRow = i + 1;
              targetSheet = currentSheet;
              headers = currentHeaders;
              break;
            }
          }
        }
        if (targetRow !== -1) break;
      }
      
      if (targetRow !== -1 && targetSheet !== null) {
        var updates = {
          "Email Status": data.emailStatus,
          "Email Sent Date": data.emailSentDate,
          "WhatsApp Status": data.whatsappStatus,
          "WhatsApp Sent Date": data.whatsappSentDate
        };
        
        for (var hName in updates) {
          var colIdx = headers.indexOf(hName);
          if (colIdx !== -1 && updates[hName] !== undefined) {
            targetSheet.getRange(targetRow, colIdx + 1).setValue(updates[hName]);
          }
        }
        return ContentService.createTextOutput(JSON.stringify({ "status": "success", "message": "Outreach status updated." }))
                             .setMimeType(ContentService.MimeType.JSON);
      } else {
        return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": "Lead not found in sheet." }))
                             .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // ── Append new lead data ──
    var sheet;
    if (data.sheetName) {
      var sheetName = sanitizeSheetName(data.sheetName);
      sheet = activeSpreadsheet.getSheetByName(sheetName);
      if (!sheet) {
        sheet = activeSpreadsheet.insertSheet(sheetName);
      }
    } else {
      sheet = activeSpreadsheet.getActiveSheet();
    }
    
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Business Name", "Phone Number", "Address", "Rating", "Reviews", "Website", "Website Status",
        "Instagram URL", "Instagram Status", "Instagram Last Post", "Facebook URL", "Facebook Status",
        "Facebook Last Post", "LinkedIn URL", "LinkedIn Status", "Emails", "Google Analytics",
        "Meta Pixel", "WhatsApp Present", "Appointment System", "Google Maps URL", "Lead Score", 
        "Lead Priority", "Date Added", "AI Insight", "Category", "Website Missing", "Email Status",
        "Email Sent Date", "WhatsApp Status", "WhatsApp Sent Date"
      ]);
    }
    
    try {
      sheet.getRange(1, 2, sheet.getMaxRows(), 1).setNumberFormat("@");
    } catch (e) {}
    
    sheet.appendRow([
      sanitizeForSheet(data.businessName),
      sanitizeForSheet(data.phone),
      sanitizeForSheet(data.address),
      data.rating,
      data.reviews,
      data.website || "",
      data.websiteStatus || "MISSING",
      data.instagramUrl || "",
      data.instagramStatus || "NOT_FOUND",
      data.instagramLastPost || "",
      data.facebookUrl || "",
      data.facebookStatus || "NOT_FOUND",
      data.facebookLastPost || "",
      data.linkedinUrl || "",
      data.linkedinStatus || "NOT_FOUND",
      data.emails ? data.emails.join(", ") : "",
      data.googleAnalyticsPresent ? "Yes" : "No",
      data.metaPixelPresent ? "Yes" : "No",
      data.whatsappPresent ? "Yes" : "No",
      data.appointmentSystem ? "Yes" : "No",
      data.mapsUrl,
      data.leadScore,
      data.leadPriority || "COLD",
      data.dateAdded,
      data.aiInsight || "",
      data.category || "",
      data.websiteMissing ? "Yes" : "No",
      "", "", "", ""
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({ "status": "success" }))
                         .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": error.toString() }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    var activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    
    // Check if we want to get sheet names
    if (e && e.parameter && e.parameter.action === "getSheets") {
      var sheets = activeSpreadsheet.getSheets();
      var sheetNames = [];
      for (var s = 0; s < sheets.length; s++) {
        var sheet = sheets[s];
        if (sheet.getLastRow() > 1) {
          var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
          if (headers.indexOf("Business Name") !== -1) {
            sheetNames.push(sheet.getName());
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify(sheetNames))
                           .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Otherwise fetch leads
    var targetSheetName = e && e.parameter && e.parameter.sheet;
    var sheets = [];
    if (targetSheetName) {
      var singleSheet = activeSpreadsheet.getSheetByName(targetSheetName);
      if (singleSheet) sheets.push(singleSheet);
    } else {
      sheets = activeSpreadsheet.getSheets();
    }
    
    var leads = [];
    for (var s = 0; s < sheets.length; s++) {
      var sheet = sheets[s];
      if (sheet.getLastRow() <= 1) continue;
      
      var rows = sheet.getDataRange().getValues();
      var headers = rows[0];
      
      var nameColIdx = headers.indexOf("Business Name");
      if (nameColIdx === -1) continue;
      
      for (var i = 1; i < rows.length; i++) {
        var row = rows[i];
        var lead = {};
        
        for (var j = 0; j < headers.length; j++) {
          var headerName = String(headers[j]).trim();
          var key = REVERSE_HEADER_MAP[headerName] || headerName;
          var val = row[j];
          
          if (key === "rating" || key === "reviews" || key === "leadScore") {
            val = parseFloat(val) || 0;
          } else if (key === "googleAnalyticsPresent" || key === "metaPixelPresent" || key === "whatsappPresent" || key === "appointmentSystem" || key === "websiteMissing") {
            val = (val === "Yes" || val === true || val === "true");
          } else if (key === "emails") {
            val = val ? String(val).split(",").map(function(s) { return s.trim(); }).filter(Boolean) : [];
          } else if (key === "phone") {
            val = String(val);
          } else if (typeof val === "string" && val.indexOf("\\u200B") === 0) {
            val = val.substring(1);
          }
          
          lead[key] = val;
        }
        
        if (lead.businessName) {
          leads.push(lead);
        }
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify(leads))
                         .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": error.toString() }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}`;
                    navigator.clipboard.writeText(code);
                    setCopiedScript(true);
                    setTimeout(() => setCopiedScript(false), 2000);
                  }}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg cursor-pointer transition-all"
                >
                  {copiedScript ? "Copy success!" : "Copy Apps Script Code"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default SettingsView;
