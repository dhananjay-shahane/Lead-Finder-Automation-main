import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from "react";
import {
  Lead,
  CampaignType,
  ColumnDef,
  ALL_LEAD_COLUMNS,
  DEFAULT_VISIBLE_COLUMN_IDS,
  MAP_TILE_CONFIGS,
  parseCSV,
  autoDetectMapping,
  DataFolder,
  FolderDateFilter,
  FolderSortOption
} from "../types";
import {
  PitchTemplateConfig,
  DEFAULT_PITCH_TEMPLATES,
  CampaignGoal,
  PitchStrategy,
  generateOutreachCopy
} from "../outreachCopy";

export interface LeadFinderContextType {
  // Navigation
  activeTab: "dashboard" | "finder" | "leads" | "outreach" | "settings";
  setActiveTab: (tab: "dashboard" | "finder" | "leads" | "outreach" | "settings") => void;
  settingsSubView: "overview" | "templates";
  setSettingsSubView: (view: "overview" | "templates") => void;

  // Scraper Config
  businessType: string;
  setBusinessType: (val: string) => void;
  location: string;
  setLocation: (val: string) => void;
  maxResults: number;
  setMaxResults: (val: number) => void;
  enableSimulation: boolean;
  setEnableSimulation: (val: boolean) => void;
  headless: boolean;
  setHeadless: (val: boolean) => void;
  scrapeWebsite: boolean;
  setScrapeWebsite: (val: boolean) => void;
  scrapeSocialMedia: boolean;
  setScrapeSocialMedia: (val: boolean) => void;
  finderMode: "all" | "noWebsite" | "outdatedWebsite";
  setFinderMode: (val: "all" | "noWebsite" | "outdatedWebsite") => void;
  isSavingConfig: boolean;
  configSuccess: boolean;
  handleSaveConfig: (e?: React.FormEvent) => Promise<void>;

  // Geocoding & Map Coordinates
  lat: number | null;
  setLat: (val: number | null) => void;
  lng: number | null;
  setLng: (val: number | null) => void;
  radius: number;
  setRadius: (val: number) => void;
  mapSearchText: string;
  setMapSearchText: (val: string) => void;
  isGeocoding: boolean;
  reverseGeocode: (latitude: number, longitude: number) => Promise<void>;
  handleSearchAreaGeocode: (e: React.FormEvent) => Promise<void>;
  mapLayer: "satellite" | "dark" | "street";
  setMapLayer: (layer: "satellite" | "dark" | "street") => void;
  overviewMapLayer: "satellite" | "dark" | "street";
  setOverviewMapLayer: (layer: "satellite" | "dark" | "street") => void;
  finderMapInstance: React.MutableRefObject<any>;
  finderMarker: React.MutableRefObject<any>;
  finderCircle: React.MutableRefObject<any>;
  finderTileLayer: React.MutableRefObject<any>;
  overviewMapInstance: React.MutableRefObject<any>;
  overviewMarkers: React.MutableRefObject<any[]>;
  overviewTileLayer: React.MutableRefObject<any>;
  switchTileLayer: (layerKey: "satellite" | "dark" | "street") => void;
  switchOverviewTileLayer: (layerKey: "satellite" | "dark" | "street") => void;

  // Scraper Status & Logs
  isRunning: boolean;
  setIsRunning: React.Dispatch<React.SetStateAction<boolean>>;
  isStopping: boolean;
  webhookConfigured: boolean;
  lastResult: any;
  terminalLogs: string;
  setTerminalLogs: React.Dispatch<React.SetStateAction<string>>;
  autoScrollLogs: boolean;
  setAutoScrollLogs: (val: boolean | ((prev: boolean) => boolean)) => void;
  terminalContainerRef: React.RefObject<HTMLDivElement | null>;
  handleStartScraper: () => Promise<void>;
  handleStopScraper: () => Promise<void>;
  handleResetData: () => Promise<void>;
  fetchStatusAndLogs: () => Promise<void>;

  // Leads Data & Table View
  processedLeads: Lead[];
  setProcessedLeads: React.Dispatch<React.SetStateAction<Lead[]>>;
  failedLeads: Lead[];
  setFailedLeads: React.Dispatch<React.SetStateAction<Lead[]>>;
  activeDataView: "logs" | "processed" | "failed" | "webhook";
  setActiveDataView: (view: "logs" | "processed" | "failed" | "webhook") => void;
  isRetryingFailed: boolean;
  isClearing: boolean;
  isTestingWebhook: boolean;
  copiedScript: boolean;
  setCopiedScript: (val: boolean) => void;
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  priorityFilter: string;
  setPriorityFilter: (val: string) => void;
  filteredLeads: Lead[];
  selectedLeadKeys: Set<string>;
  setSelectedLeadKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
  visibleColumns: string[];
  setVisibleColumns: React.Dispatch<React.SetStateAction<string[]>>;
  toggleColumn: (colId: string) => void;
  handleShowAllColumns: () => void;
  handleResetColumns: () => void;
  handleDeleteLead: (lead: Lead) => Promise<void>;
  handleBulkDelete: () => Promise<void>;
  toggleLeadSelection: (leadKey: string) => void;
  toggleSelectAll: () => void;
  downloadCSV: () => void;
  handleLoadSampleLeads: () => Promise<void>;
  isLoadingSampleLeads: boolean;
  handleSyncGoogleSheet: () => Promise<void>;
  isSyncingSheet: boolean;
  leadOpFeedback: string | null;
  handleRetryFailed: () => Promise<void>;
  handleTestWebhook: () => Promise<void>;
  fetchData: () => Promise<void>;

  // Pagination
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  pageSize: number;
  setPageSize: React.Dispatch<React.SetStateAction<number>>;

  // Data Folders Drawer & Filtering
  isFolderDrawerOpen: boolean;
  setIsFolderDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectedFolderId: string | null;
  setSelectedFolderId: React.Dispatch<React.SetStateAction<string | null>>;
  folderSearchTerm: string;
  setFolderSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  folderDateFilter: FolderDateFilter;
  setFolderDateFilter: React.Dispatch<React.SetStateAction<FolderDateFilter>>;
  folderSortBy: FolderSortOption;
  setFolderSortBy: React.Dispatch<React.SetStateAction<FolderSortOption>>;
  availableFolders: DataFolder[];
  isLoadingFolders: boolean;
  fetchFolders: () => Promise<void>;
  csvLeads: Lead[] | null;
  isLoadingCsvData: boolean;
  handleUploadCsvFile: (file: File) => Promise<boolean>;
  handleSelectCsvFile: (filename: string | null) => void;

  // WhatsApp & SMTP Config
  whatsappStatus: { status: string; qr: string };
  setWhatsappStatus: React.Dispatch<React.SetStateAction<{ status: string; qr: string }>>;
  smtpHost: string;
  setSmtpHost: (val: string) => void;
  smtpPort: string;
  setSmtpPort: (val: string) => void;
  smtpUser: string;
  setSmtpUser: (val: string) => void;
  smtpPass: string;
  setSmtpPass: (val: string) => void;
  smtpFrom: string;
  setSmtpFrom: (val: string) => void;
  isSavingSmtp: boolean;
  smtpSuccess: boolean;
  isDisconnectingWa: boolean;
  isSendingTestMsg: boolean;
  handleSaveSmtp: (e: React.FormEvent) => Promise<void>;
  handleInitializeWhatsApp: () => Promise<void>;
  handleDisconnectWhatsApp: () => Promise<void>;
  handleSendTestMessage: () => Promise<void>;

  // Pitch Templates
  pitchTemplates: PitchTemplateConfig;
  setPitchTemplates: React.Dispatch<React.SetStateAction<PitchTemplateConfig>>;
  selectedTemplateTab: string;
  setSelectedTemplateTab: (tab: string) => void;
  isSavingTemplates: boolean;
  templateSuccess: boolean;
  handleSaveTemplates: (updatedConfig?: PitchTemplateConfig) => Promise<void>;
  handleSetGoal: (goal: CampaignGoal) => void;
  handleSetJobSubGoal: (subGoal: "jobOnly" | "freelanceOnly" | "both") => void;
  handleSetStrategy: (strategy: PitchStrategy) => void;
  handleResetTemplates: () => void;
  getTemplateField: (field: "whatsappMessage" | "emailSubject" | "emailBody", tab?: any) => string;
  updateTemplateField: (field: "whatsappMessage" | "emailSubject" | "emailBody", value: string, tab?: any) => void;
  insertVariableTag: (field: "emailSubject" | "emailBody" | "whatsappMessage", tag: string) => void;

  // Campaign Hub
  activeCampaignType: CampaignType;
  setActiveCampaignType: (val: CampaignType) => void;
  isCampaignDrawerOpen: boolean;
  setIsCampaignDrawerOpen: (val: boolean) => void;
  campaignDelay: number;
  setCampaignDelay: (val: number) => void;
  campaignEnableEmail: boolean;
  setCampaignEnableEmail: (val: boolean) => void;
  campaignEnableWhatsapp: boolean;
  setCampaignEnableWhatsapp: (val: boolean) => void;
  campaignDryRun: boolean;
  setCampaignDryRun: (val: boolean) => void;
  campaignSheets: string[];
  selectedCampaignSheet: string;
  setSelectedCampaignSheet: (val: string) => void;
  isLoadingSheets: boolean;
  previewLead: Lead | null;
  setPreviewLead: (lead: Lead | null) => void;
  previewCopy: { emailSubject: string; emailBody: string; whatsappMessage: string } | null;
  isLoadingPreviewCopy: boolean;
  fetchCampaignSheets: () => Promise<void>;
  handleSelectPreviewLead: (lead: Lead, configOverride?: PitchTemplateConfig) => Promise<void>;
  campaignRunning: boolean;
  setCampaignRunning: (running: boolean) => void;
  campaignPaused: boolean;
  activeCampaignData: any;
  campaignHistory: any[];
  scheduledCampaigns: any[];
  campaignProgress: { current: number; total: number; status: string; secondsRemaining: number; emailsSent?: number; emailsFailed?: number; whatsappSent?: number; whatsappFailed?: number; skipped?: number };
  isStartingCampaign: boolean;
  isStoppingCampaign: boolean;
  isPausingCampaign: boolean;
  isResumingCampaign: boolean;
  handleStartCampaign: () => Promise<void>;
  handleStopCampaign: () => Promise<void>;
  handlePauseCampaign: () => Promise<void>;
  handleResumeCampaign: () => Promise<void>;
  fetchCampaignHistory: () => Promise<void>;
  fetchScheduledCampaigns: () => Promise<void>;
  handleScheduleCampaign: (name: string, scheduledAt: string, type: "sheet" | "local", payload: any) => Promise<boolean>;
  handleDeleteSchedule: (id: string) => Promise<void>;
  handleRunScheduledNow: (id: string) => Promise<void>;
  handleClearCampaignHistory: () => Promise<void>;
  handleDeleteCampaignHistoryItem: (id: string) => Promise<void>;
  campaignLogs: string;
  handleClearCampaignLogs: () => Promise<void>;

  // Local Data Campaign State & Handlers
  csvFile: File | null;
  csvHeaders: string[];
  csvRows: Record<string, string>[];
  csvMapping: Record<string, string>;
  setCsvMapping: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  csvParseError: string;
  csvStep: "upload" | "map" | "template" | "launch";
  setCsvStep: (step: "upload" | "map" | "template" | "launch") => void;
  localCampaignGoal: CampaignGoal;
  setLocalCampaignGoal: (goal: CampaignGoal) => void;
  localCampaignDelay: number;
  setLocalCampaignDelay: (val: number) => void;
  localEnableEmail: boolean;
  setLocalEnableEmail: (val: boolean) => void;
  localEnableWhatsapp: boolean;
  setLocalEnableWhatsapp: (val: boolean) => void;
  localDryRun: boolean;
  setLocalDryRun: (val: boolean) => void;
  localEmailSubject: string;
  setLocalEmailSubject: (val: string) => void;
  localEmailBody: string;
  setLocalEmailBody: (val: string) => void;
  localWhatsappMsg: string;
  setLocalWhatsappMsg: (val: string) => void;
  isSavingLocalTemplates: boolean;
  localTemplatesSaved: boolean;
  handleSaveLocalTemplates: (custom?: {
    emailSubject?: string;
    emailBody?: string;
    whatsappMessage?: string;
  }) => Promise<void>;
  handleDownloadUpdatedCsv: () => void;
  isLaunchingLocalCampaign: boolean;
  localSkipAlreadySent: boolean;
  setLocalSkipAlreadySent: (skip: boolean) => void;
  localCampaignResult: { success: boolean; message: string } | null;
  csvInputRef: React.RefObject<HTMLInputElement | null>;
  handleCsvFileChange: (file: File | null) => void;
  handleLaunchLocalCampaign: () => Promise<void>;
  handleResetCsv: () => void;

  // Single-Lead Outreach Modal
  selectedLeadForOutreach: Lead | null;
  setSelectedLeadForOutreach: (lead: Lead | null) => void;
  outreachEmailSubject: string;
  setOutreachEmailSubject: (val: string) => void;
  outreachEmailBody: string;
  setOutreachEmailBody: (val: string) => void;
  outreachWhatsappMsg: string;
  setOutreachWhatsappMsg: (val: string) => void;
  isSendingEmail: boolean;
  isSendingWhatsapp: boolean;
  handleOpenOutreach: (lead: Lead) => Promise<void>;
  handleSendEmail: () => Promise<void>;
  handleSendWhatsapp: () => Promise<void>;

  // Lead Details Modal
  selectedLeadDetails: Lead | null;
  setSelectedLeadDetails: (lead: Lead | null) => void;

  // Column Customizer Modal
  showColumnModal: boolean;
  setShowColumnModal: (show: boolean) => void;

  // Attachments
  attachmentFile: File | null;
  setAttachmentFile: (file: File | null) => void;
  attachmentFilename: string;
  isUploadingAttachment: boolean;
  attachmentUploadError: string;
  attachmentInputRef: React.RefObject<HTMLInputElement | null>;
  campaignAttachmentFile: File | null;
  setCampaignAttachmentFile: (file: File | null) => void;
  campaignAttachmentFilename: string;
  isUploadingCampaignAttachment: boolean;
  campaignAttachmentError: string;
  campaignAttachmentInputRef: React.RefObject<HTMLInputElement | null>;
  handleUploadAttachment: (file: File, isCampaign?: boolean) => Promise<void>;
  handleClearAttachment: (isCampaign?: boolean) => Promise<void>;

  // Calculated Stats
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
  totalProcessed: number;
  scorePoor: number;
  scoreNeedsWork: number;
  scoreGood: number;
  scoreExcellent: number;
  maxScoreCount: number;
}

const LeadFinderContext = createContext<LeadFinderContextType | null>(null);

export function LeadFinderProvider({ children }: { children: ReactNode }) {
  // Navigation
  const [activeTab, setActiveTab] = useState<"dashboard" | "finder" | "leads" | "outreach" | "settings">("dashboard");

  // Config state
  const [businessType, setBusinessType] = useState("Dental Clinic");
  const [location, setLocation] = useState("Baner Pune");
  const [maxResults, setMaxResults] = useState(10);
  const [enableSimulation, setEnableSimulation] = useState(false);
  const [headless, setHeadless] = useState(false);
  const [scrapeWebsite, setScrapeWebsite] = useState(false);
  const [scrapeSocialMedia, setScrapeSocialMedia] = useState(true);
  const [finderMode, setFinderMode] = useState<"all" | "noWebsite" | "outdatedWebsite">("all");
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configSuccess, setConfigSuccess] = useState(false);

  // Geocoding Coordinates and radius
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [radius, setRadius] = useState<number>(5);
  const [mapSearchText, setMapSearchText] = useState("");
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Scraper status
  const [isRunning, setIsRunning] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [webhookConfigured, setWebhookConfigured] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  // Data logs & results
  const [terminalLogs, setTerminalLogs] = useState("Initializing LeadFinder AI Terminal...\nReady.");
  const [processedLeads, setProcessedLeads] = useState<Lead[]>([]);
  const [failedLeads, setFailedLeads] = useState<Lead[]>([]);

  // UI preferences (Persisted)
  const [activeDataView, setActiveDataView] = useState<"logs" | "processed" | "failed" | "webhook">(() => {
    const saved = localStorage.getItem("leadfinder_activeDataView");
    return (saved as any) || "logs";
  });
  const [isRetryingFailed, setIsRetryingFailed] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [selectedLeadDetails, setSelectedLeadDetails] = useState<Lead | null>(null);
  const [selectedLeadKeys, setSelectedLeadKeys] = useState<Set<string>>(new Set());
  const [overviewMapLayer, setOverviewMapLayer] = useState<"satellite" | "dark" | "street">("satellite");
  const overviewTileLayer = useRef<any>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Folder Drawer & Filter State
  const [isFolderDrawerOpen, setIsFolderDrawerOpen] = useState<boolean>(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [folderSearchTerm, setFolderSearchTerm] = useState<string>("");
  const [folderDateFilter, setFolderDateFilter] = useState<FolderDateFilter>("ALL");
  const [folderSortBy, setFolderSortBy] = useState<FolderSortOption>("LATEST");
  const [availableFolders, setAvailableFolders] = useState<DataFolder[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState<boolean>(false);

  // WhatsApp & SMTP Configurations
  const [whatsappStatus, setWhatsappStatus] = useState({ status: "DISCONNECTED", qr: "" });
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("");
  const [isSavingSmtp, setIsSavingSmtp] = useState(false);
  const [smtpSuccess, setSmtpSuccess] = useState(false);
  const [isDisconnectingWa, setIsDisconnectingWa] = useState(false);
  const [isSendingTestMsg, setIsSendingTestMsg] = useState(false);

  // Outreach Campaign parameters
  const [campaignDelay, setCampaignDelay] = useState(30);
  const [campaignEnableEmail, setCampaignEnableEmail] = useState(true);
  const [campaignEnableWhatsapp, setCampaignEnableWhatsapp] = useState(true);
  const [campaignDryRun, setCampaignDryRun] = useState(false);
  const [campaignSheets, setCampaignSheets] = useState<string[]>([]);
  const [selectedCampaignSheet, setSelectedCampaignSheet] = useState<string>("");
  const [isLoadingSheets, setIsLoadingSheets] = useState(false);
  const [previewLead, setPreviewLead] = useState<Lead | null>(null);
  const [previewCopy, setPreviewCopy] = useState<{ emailSubject: string; emailBody: string; whatsappMessage: string } | null>(null);
  const [isLoadingPreviewCopy, setIsLoadingPreviewCopy] = useState(false);

  // Pitch Templates & Customization State
  const [pitchTemplates, setPitchTemplates] = useState<PitchTemplateConfig>(DEFAULT_PITCH_TEMPLATES);
  const [selectedTemplateTab, setSelectedTemplateTab] = useState<string>("noWebsite");
  const [settingsSubView, setSettingsSubView] = useState<"overview" | "templates">("overview");
  const [isSavingTemplates, setIsSavingTemplates] = useState(false);
  const [templateSuccess, setTemplateSuccess] = useState(false);

  // Outreach Modal
  const [selectedLeadForOutreach, setSelectedLeadForOutreach] = useState<Lead | null>(null);
  const [outreachEmailSubject, setOutreachEmailSubject] = useState("");
  const [outreachEmailBody, setOutreachEmailBody] = useState("");
  const [outreachWhatsappMsg, setOutreachWhatsappMsg] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isSendingWhatsapp, setIsSendingWhatsapp] = useState(false);

  // WhatsApp attachment state
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentFilename, setAttachmentFilename] = useState<string>("");
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [attachmentUploadError, setAttachmentUploadError] = useState("");
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  // Campaign-specific attachment
  const [campaignAttachmentFile, setCampaignAttachmentFile] = useState<File | null>(null);
  const [campaignAttachmentFilename, setCampaignAttachmentFilename] = useState<string>("");
  const [isUploadingCampaignAttachment, setIsUploadingCampaignAttachment] = useState(false);
  const [campaignAttachmentError, setCampaignAttachmentError] = useState("");
  const campaignAttachmentInputRef = useRef<HTMLInputElement>(null);

  // Campaign Hub State
  const [activeCampaignType, setActiveCampaignType] = useState<CampaignType>("outreach");
  const [isCampaignDrawerOpen, setIsCampaignDrawerOpen] = useState(false);

  // Local Data Campaign state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [csvMapping, setCsvMapping] = useState<Record<string, string>>({});
  const [csvParseError, setCsvParseError] = useState("");
  const [csvStep, setCsvStep] = useState<"upload" | "map" | "template" | "launch">("upload");
  const [localCampaignGoal, setLocalCampaignGoal] = useState<CampaignGoal>("business");
  const [localCampaignDelay, setLocalCampaignDelay] = useState(30);
  const [localEnableEmail, setLocalEnableEmail] = useState(true);
  const [localEnableWhatsapp, setLocalEnableWhatsapp] = useState(true);
  const [localDryRun, setLocalDryRun] = useState(false);
  const [localEmailSubject, setLocalEmailSubject] = useState<string>(() => {
    const saved = localStorage.getItem("leadfinder_local_email_subject");
    if (!saved || saved === "Quick question about {businessName}" || saved.startsWith("Test for")) {
      return DEFAULT_PITCH_TEMPLATES.localCampaign?.emailSubject || "";
    }
    return saved;
  });
  const [localEmailBody, setLocalEmailBody] = useState<string>(() => {
    const saved = localStorage.getItem("leadfinder_local_email_body");
    if (!saved || saved.includes("I came across {businessName} and wanted to reach out") || saved.startsWith("Hello {businessName}, testing!")) {
      return DEFAULT_PITCH_TEMPLATES.localCampaign?.emailBody || "";
    }
    return saved;
  });
  const [localWhatsappMsg, setLocalWhatsappMsg] = useState<string>(() => {
    const saved = localStorage.getItem("leadfinder_local_wa_msg");
    if (!saved || saved.includes("I wanted to reach out to you. Can we connect?") || saved.startsWith("Hi {businessName}, WA test!")) {
      return DEFAULT_PITCH_TEMPLATES.localCampaign?.whatsappMessage || "";
    }
    return saved;
  });
  const [isSavingLocalTemplates, setIsSavingLocalTemplates] = useState(false);
  const [localTemplatesSaved, setLocalTemplatesSaved] = useState(false);
  const autoSaveTimerRef = useRef<any>(null);
  const [isLaunchingLocalCampaign, setIsLaunchingLocalCampaign] = useState(false);
  const [localSkipAlreadySent, setLocalSkipAlreadySent] = useState<boolean>(() => {
    const saved = localStorage.getItem("leadfinder_local_skip_already_sent");
    return saved !== null ? saved === "true" : true;
  });

  useEffect(() => {
    localStorage.setItem("leadfinder_local_skip_already_sent", String(localSkipAlreadySent));
  }, [localSkipAlreadySent]);

  const [localCampaignResult, setLocalCampaignResult] = useState<{ success: boolean; message: string } | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Campaign Running State
  const [campaignRunning, setCampaignRunning] = useState(false);
  const [campaignPaused, setCampaignPaused] = useState(false);
  const [activeCampaignData, setActiveCampaignData] = useState<any>(null);
  const [campaignHistory, setCampaignHistory] = useState<any[]>([]);
  const [scheduledCampaigns, setScheduledCampaigns] = useState<any[]>([]);
  const [campaignProgress, setCampaignProgress] = useState<any>({
    current: 0,
    total: 0,
    status: "Idle",
    secondsRemaining: 0
  });
  const [isStartingCampaign, setIsStartingCampaign] = useState(false);
  const [isStoppingCampaign, setIsStoppingCampaign] = useState(false);
  const [isPausingCampaign, setIsPausingCampaign] = useState(false);
  const [isResumingCampaign, setIsResumingCampaign] = useState(false);
  const [campaignLogs, setCampaignLogs] = useState("Initializing Outreach Campaign Console...\nReady.");

  const handleClearCampaignLogs = async () => {
    try {
      await fetch("/api/campaign/logs/clear", { method: "POST" });
      setCampaignLogs("");
    } catch (e) {
      setCampaignLogs("");
    }
  };
  const [autoScrollLogs, setAutoScrollLogs] = useState<boolean>(() => {
    const saved = localStorage.getItem("leadfinder_autoScrollLogs");
    return saved === null ? true : saved === "true";
  });

  // Map refs & layer state
  const finderMapInstance = useRef<any>(null);
  const finderMarker = useRef<any>(null);
  const finderCircle = useRef<any>(null);
  const finderTileLayer = useRef<any>(null);
  const [mapLayer, setMapLayer] = useState<"satellite" | "dark" | "street">(() => {
    return (localStorage.getItem("leadfinder_map_layer") as any) || "satellite";
  });
  const overviewMapInstance = useRef<any>(null);
  const overviewMarkers = useRef<any[]>([]);
  const terminalContainerRef = useRef<HTMLDivElement>(null);

  // Column customization state
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("leadfinder_visible_columns");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) { }
    return DEFAULT_VISIBLE_COLUMN_IDS;
  });
  const [showColumnModal, setShowColumnModal] = useState(false);

  // Lead operation state
  const [isLoadingSampleLeads, setIsLoadingSampleLeads] = useState(false);
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [leadOpFeedback, setLeadOpFeedback] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem("leadfinder_visible_columns", JSON.stringify(visibleColumns));
    } catch (e) { }
  }, [visibleColumns]);

  const toggleColumn = (colId: string) => {
    setVisibleColumns(prev => {
      if (prev.includes(colId)) {
        if (prev.length <= 1) return prev;
        return prev.filter(id => id !== colId);
      } else {
        return [...prev, colId];
      }
    });
  };

  const handleShowAllColumns = () => {
    if (visibleColumns.length === ALL_LEAD_COLUMNS.length) {
      setVisibleColumns(DEFAULT_VISIBLE_COLUMN_IDS);
    } else {
      setVisibleColumns(ALL_LEAD_COLUMNS.map(c => c.id));
    }
  };

  const handleResetColumns = () => {
    setVisibleColumns(DEFAULT_VISIBLE_COLUMN_IDS);
  };

  const handleLoadSampleLeads = async () => {
    setIsLoadingSampleLeads(true);
    setLeadOpFeedback(null);
    try {
      const res = await fetch("/api/load-sample-leads", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setProcessedLeads(data.leads || []);
        setLeadOpFeedback(`✅ Loaded ${data.leads?.length || 5} sample business leads!`);
        setTimeout(() => setLeadOpFeedback(null), 5000);
      } else {
        setLeadOpFeedback("❌ Failed to load sample leads from server.");
      }
    } catch (err: any) {
      setLeadOpFeedback(`❌ Error: ${err.message || "Could not load samples"}`);
    } finally {
      setIsLoadingSampleLeads(false);
    }
  };

  const handleSyncGoogleSheet = async () => {
    setIsSyncingSheet(true);
    setLeadOpFeedback(null);
    try {
      const res = await fetch("/api/sync-google-sheet", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          const processedRes = await fetch("/api/processed");
          if (processedRes.ok) {
            const leads = await processedRes.json();
            setProcessedLeads(leads);
          }
          setLeadOpFeedback(`✅ ${data.message || "Synced leads from Google Sheet!"}`);
          setTimeout(() => setLeadOpFeedback(null), 5000);
        } else {
          setLeadOpFeedback(`⚠️ ${data.message || "No leads found in sheet."}`);
        }
      } else {
        setLeadOpFeedback("❌ Sheet sync failed. Check Google Sheet Webhook URL.");
      }
    } catch (err: any) {
      setLeadOpFeedback(`❌ Sync error: ${err.message || "Network error"}`);
    } finally {
      setIsSyncingSheet(false);
    }
  };

  const switchTileLayer = useCallback((layerKey: "satellite" | "dark" | "street") => {
    const L = (window as any).L;
    if (!L || !finderMapInstance.current) return;

    if (finderTileLayer.current) {
      finderMapInstance.current.removeLayer(finderTileLayer.current);
      finderTileLayer.current = null;
    }

    const cfg = MAP_TILE_CONFIGS[layerKey] || MAP_TILE_CONFIGS.satellite;
    const newLayer = L.tileLayer(cfg.url, cfg.options).addTo(finderMapInstance.current);
    finderTileLayer.current = newLayer;
    setMapLayer(layerKey);
    localStorage.setItem("leadfinder_map_layer", layerKey);
  }, []);

  const switchOverviewTileLayer = useCallback((layerKey: "satellite" | "dark" | "street") => {
    const L = (window as any).L;
    if (!L || !overviewMapInstance.current) return;

    if (overviewTileLayer.current) {
      overviewMapInstance.current.removeLayer(overviewTileLayer.current);
      overviewTileLayer.current = null;
    }

    const cfg = MAP_TILE_CONFIGS[layerKey] || MAP_TILE_CONFIGS.satellite;
    const newLayer = L.tileLayer(cfg.url, cfg.options).addTo(overviewMapInstance.current);
    overviewTileLayer.current = newLayer;
    setOverviewMapLayer(layerKey);
  }, []);

  const handleDeleteLead = async (lead: Lead) => {
    if (!window.confirm(`Delete "${lead.businessName}" from the project database?`)) return;
    try {
      const res = await fetch("/api/leads/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName: lead.businessName, address: lead.address, mapsUrl: lead.mapsUrl })
      });
      if (res.ok) {
        const data = await res.json();
        setProcessedLeads(data.leads || []);
        if (selectedLeadDetails?.businessName === lead.businessName) {
          setSelectedLeadDetails(null);
        }
        setSelectedLeadKeys(prev => {
          const next = new Set(prev);
          next.delete(`${lead.businessName}_${lead.address}`);
          return next;
        });
      } else {
        alert("Failed to delete lead from database.");
      }
    } catch (e) {
      console.error("Failed to delete lead", e);
      alert("Network error while deleting lead.");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedLeadKeys.size === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedLeadKeys.size} selected lead(s) from the project data folder?`)) return;
    const items = processedLeads
      .filter(l => selectedLeadKeys.has(`${l.businessName}_${l.address}`))
      .map(l => ({ businessName: l.businessName, address: l.address, mapsUrl: l.mapsUrl }));
    try {
      const res = await fetch("/api/leads/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items })
      });
      if (res.ok) {
        const data = await res.json();
        setProcessedLeads(data.leads || []);
        setSelectedLeadKeys(new Set());
        if (selectedLeadDetails && selectedLeadKeys.has(`${selectedLeadDetails.businessName}_${selectedLeadDetails.address}`)) {
          setSelectedLeadDetails(null);
        }
      } else {
        alert("Failed to bulk delete leads.");
      }
    } catch (e) {
      console.error("Failed to bulk delete leads", e);
      alert("Network error while bulk deleting leads.");
    }
  };

  const toggleLeadSelection = (leadKey: string) => {
    setSelectedLeadKeys(prev => {
      const next = new Set(prev);
      if (next.has(leadKey)) next.delete(leadKey);
      else next.add(leadKey);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedLeadKeys.size === filteredLeads.length && filteredLeads.length > 0) {
      setSelectedLeadKeys(new Set());
    } else {
      const allKeys = new Set(filteredLeads.map(l => `${l.businessName}_${l.address}`));
      setSelectedLeadKeys(allKeys);
    }
  };

  // Reset pagination to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, priorityFilter, selectedFolderId, pageSize]);

  // CSV Data Files state & loading
  const [csvLeads, setCsvLeads] = useState<Lead[] | null>(null);
  const [isLoadingCsvData, setIsLoadingCsvData] = useState<boolean>(false);

  useEffect(() => {
    if (!selectedFolderId || selectedFolderId === "all") {
      setCsvLeads(null);
      return;
    }

    let isMounted = true;
    setIsLoadingCsvData(true);

    fetch(`/api/csv-data/${encodeURIComponent(selectedFolderId)}`)
      .then(res => res.json())
      .then(data => {
        if (isMounted && data.success && Array.isArray(data.leads)) {
          setCsvLeads(data.leads);
        }
      })
      .catch(err => {
        console.error("Failed to load CSV leads:", err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingCsvData(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedFolderId]);

  const handleSelectCsvFile = (filename: string | null) => {
    setSelectedFolderId(filename);
  };

  const handleUploadCsvFile = async (file: File): Promise<boolean> => {
    try {
      const text = await file.text();
      const res = await fetch("/api/csv-data/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, content: text })
      });
      if (res.ok) {
        const data = await res.json();
        await fetchFolders();
        setSelectedFolderId(data.filename);
        return true;
      }
      return false;
    } catch (err) {
      console.error("Failed to upload CSV file:", err);
      return false;
    }
  };

  // Determine current active leads source: selected CSV file vs master processed leads
  const sourceLeads = csvLeads !== null ? csvLeads : processedLeads;

  const filteredLeads = sourceLeads.filter(lead => {
    const matchesSearch =
      lead.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.category && lead.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (lead.aiInsight && lead.aiInsight.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (lead.emails && lead.emails.some(e => e.toLowerCase().includes(searchTerm.toLowerCase())));

    const matchesPriority = priorityFilter === "ALL" || lead.leadPriority === priorityFilter;

    return matchesSearch && matchesPriority;
  });

  const downloadCSV = () => {
    if (filteredLeads.length === 0) return;

    const headers = [
      "Business Name", "Phone Number", "Address", "Rating", "Reviews", "Website", "Website Status",
      "Instagram URL", "Instagram Status", "Instagram Last Post", "Facebook URL", "Facebook Status",
      "Facebook Last Post", "LinkedIn URL", "LinkedIn Status", "Emails", "Google Analytics Present",
      "Meta Pixel Present", "WhatsApp Present", "Appointment System", "Google Maps URL", "Lead Score",
      "Lead Priority", "Date Added", "AI Insight"
    ];

    const rows = filteredLeads.map(lead => [
      lead.businessName, lead.phone, lead.address, lead.rating, lead.reviews, lead.website, lead.websiteStatus,
      lead.instagramUrl, lead.instagramStatus, lead.instagramLastPost, lead.facebookUrl, lead.facebookStatus,
      lead.facebookLastPost, lead.linkedinUrl, lead.linkedinStatus, lead.emails ? lead.emails.join("; ") : "",
      lead.googleAnalyticsPresent ? "Yes" : "No", lead.metaPixelPresent ? "Yes" : "No", lead.whatsappPresent ? "Yes" : "No",
      lead.appointmentSystem ? "Yes" : "No", lead.mapsUrl, lead.leadScore, lead.leadPriority, lead.dateAdded, lead.aiInsight
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(val => {
        const str = String(val === null || val === undefined ? "" : val);
        if (str.includes(",") || str.includes("\"") || str.includes("\n") || str.includes(";")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `leadfinder_leads_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Fetch all states from the server
  const fetchData = async () => {
    try {
      const configRes = await fetch("/api/config");
      if (configRes.ok) {
        const config = await configRes.json();
        setBusinessType(config.businessType || "Dental Clinic");
        setLocation(config.location || "Baner Pune");
        setMaxResults(config.maxResults || 10);
        setEnableSimulation(config.enableSimulation || false);
        setHeadless(config.headless || false);
        setLat(config.lat || 19.9975);
        setLng(config.lng || 73.7898);
        setRadius(config.radius || 5);
        setScrapeWebsite(Boolean(config.scrapeWebsite));
        setScrapeSocialMedia(config.scrapeSocialMedia !== false);
        setFinderMode(config.finderMode || "all");
      }

      const statusRes = await fetch("/api/status");
      if (statusRes.ok) {
        const status = await statusRes.json();
        setIsRunning(status.isRunning);
        setWebhookConfigured(status.webhookUrlConfigured);
        setLastResult(status.lastResult);
      }

      const logsRes = await fetch("/api/logs");
      if (logsRes.ok) {
        const data = await logsRes.json();
        setTerminalLogs(data.logs);
      }

      const processedRes = await fetch("/api/processed");
      if (processedRes.ok) {
        const data = await processedRes.json();
        setProcessedLeads(data);
      }

      const failedRes = await fetch("/api/failed");
      if (failedRes.ok) {
        const data = await failedRes.json();
        setFailedLeads(data);
      }

      const smtpRes = await fetch("/api/config/smtp");
      if (smtpRes.ok) {
        const smtp = await smtpRes.json();
        setSmtpHost(smtp.host || "");
        setSmtpPort(smtp.port || "587");
        setSmtpUser(smtp.user || "");
        setSmtpFrom(smtp.from || "");
        if (smtp.hasPassword) {
          setSmtpPass("••••••••");
        }
      }

      const waRes = await fetch("/api/whatsapp/status");
      if (waRes.ok) {
        const wa = await waRes.json();
        setWhatsappStatus(wa);
      }

      const campaignRes = await fetch("/api/campaign/status");
      if (campaignRes.ok) {
        const campaign = await campaignRes.json();
        setCampaignRunning(campaign.isRunning);
        setCampaignPaused(Boolean(campaign.isPaused));
        setActiveCampaignData(campaign.activeCampaign || null);
        setCampaignProgress(campaign.progress);
        if (campaign.progress?.updatedRows && Array.isArray(campaign.progress.updatedRows) && campaign.progress.updatedRows.length > 0) {
          setCsvRows(campaign.progress.updatedRows);
          if (campaign.progress.updatedHeaders && Array.isArray(campaign.progress.updatedHeaders) && campaign.progress.updatedHeaders.length > 0) {
            setCsvHeaders(campaign.progress.updatedHeaders);
          }
        }
      }

      try {
        const campaignLogsRes = await fetch("/api/campaign/logs");
        if (campaignLogsRes.ok) {
          const cdata = await campaignLogsRes.json();
          if (cdata.logs !== undefined) setCampaignLogs(cdata.logs);
        }
      } catch (e) {}

      const templatesRes = await fetch("/api/config/templates");
      if (templatesRes.ok) {
        const tpls = await templatesRes.json();
        setPitchTemplates(tpls);
        if (tpls.localCampaign) {
          if (tpls.localCampaign.emailSubject) {
            setLocalEmailSubject(tpls.localCampaign.emailSubject);
            localStorage.setItem("leadfinder_local_email_subject", tpls.localCampaign.emailSubject);
          }
          if (tpls.localCampaign.emailBody) {
            setLocalEmailBody(tpls.localCampaign.emailBody);
            localStorage.setItem("leadfinder_local_email_body", tpls.localCampaign.emailBody);
          }
          if (tpls.localCampaign.whatsappMessage) {
            setLocalWhatsappMsg(tpls.localCampaign.whatsappMessage);
            localStorage.setItem("leadfinder_local_wa_msg", tpls.localCampaign.whatsappMessage);
          }
        }
      }

      await fetchFolders();
    } catch (e) {
      console.error("Failed to connect to the Express background server.", e);
    }
  };

  const fetchFolders = async () => {
    setIsLoadingFolders(true);
    try {
      const res = await fetch("/api/folders");
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.folders || []);
        setAvailableFolders(list);
      }
    } catch (err) {
      console.error("Failed to fetch data folders:", err);
    } finally {
      setIsLoadingFolders(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchStatusAndLogs();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchCampaignSheets = async () => {
    setIsLoadingSheets(true);
    try {
      const res = await fetch("/api/campaign/sheets");
      if (res.ok) {
        const data = await res.json();
        setCampaignSheets(data);
      }
    } catch (e) {
      console.error("Error loading sheets", e);
    } finally {
      setIsLoadingSheets(false);
    }
  };

  useEffect(() => {
    if (activeTab === "outreach") {
      fetchCampaignSheets();
      fetchCampaignHistory();
      fetchScheduledCampaigns();
    }
  }, [activeTab]);

  const fetchStatusAndLogs = async () => {
    try {
      const statusRes = await fetch("/api/status");
      if (statusRes.ok) {
        const status = await statusRes.json();
        setIsRunning(status.isRunning);
        setWebhookConfigured(status.webhookUrlConfigured);
        setLastResult(status.lastResult);
      }

      const logsRes = await fetch("/api/logs");
      if (logsRes.ok) {
        const data = await logsRes.json();
        setTerminalLogs(data.logs);
      }

      const waRes = await fetch("/api/whatsapp/status");
      if (waRes.ok) {
        const wa = await waRes.json();
        setWhatsappStatus(wa);
      }

      const campaignRes = await fetch("/api/campaign/status");
      if (campaignRes.ok) {
        const campaign = await campaignRes.json();
        setCampaignRunning(Boolean(campaign.isRunning));
        setCampaignPaused(Boolean(campaign.isPaused));
        if (campaign.activeCampaign) {
          setActiveCampaignData(campaign.activeCampaign);
        }
        if (campaign.progress) {
          setCampaignProgress(campaign.progress);
        }
      }

      try {
        const campaignLogsRes = await fetch("/api/campaign/logs");
        if (campaignLogsRes.ok) {
          const cdata = await campaignLogsRes.json();
          if (cdata.logs !== undefined) setCampaignLogs(cdata.logs);
        }
      } catch (e) {}
    } catch (e) { }
  };

  const reverseGeocode = async (latitude: number, longitude: number) => {
    try {
      const res = await fetch(`/api/geocode/reverse?lat=${latitude}&lon=${longitude}`);
      if (res.ok) {
        const data = await res.json();
        const addr = data.address;
        const sub = addr.suburb || addr.neighbourhood || addr.village || addr.quarter || addr.residential || addr.road || "";
        const city = addr.city || addr.town || addr.municipality || "";
        const formatted = sub && city ? `${sub}, ${city}` : data.display_name ? data.display_name.split(",").slice(0, 3).join(",").trim() : `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        setLocation(formatted);
      }
    } catch (e) {
      console.error("Reverse geocoding error:", e);
    }
  };

  const handleSearchAreaGeocode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapSearchText.trim()) return;
    setIsGeocoding(true);
    try {
      const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(mapSearchText)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          const item = data[0];
          const newLat = parseFloat(item.lat);
          const newLng = parseFloat(item.lon);
          setLat(newLat);
          setLng(newLng);
          setLocation(mapSearchText);

          if (finderMapInstance.current) {
            finderMapInstance.current.setView([newLat, newLng], 12);
          }
          if (finderMarker.current) {
            finderMarker.current.setLatLng([newLat, newLng]);
          }
          if (finderCircle.current) {
            finderCircle.current.setLatLng([newLat, newLng]);
          }
        } else {
          alert("Location not found. Try adding a city name (e.g. Gangapur Road, Nashik).");
        }
      }
    } catch (err) {
      alert("Error finding location.");
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleSaveConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingConfig(true);
    setConfigSuccess(false);

    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessType, location, maxResults, enableSimulation, headless, lat, lng, radius, scrapeWebsite, scrapeSocialMedia, finderMode }),
      });

      if (res.ok) {
        setConfigSuccess(true);
        setTimeout(() => setConfigSuccess(false), 3000);
        fetchData();
      }
    } catch (e) {
      alert("Error saving configuration.");
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleStartScraper = async () => {
    if (isRunning) return;
    try {
      setTerminalLogs(prev => prev + "\n[SYSTEM] Synchronizing search area parameters... saving config...\n");

      const saveRes = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessType, location, maxResults, enableSimulation, headless, lat, lng, radius, scrapeWebsite, scrapeSocialMedia, finderMode }),
      });

      if (!saveRes.ok) {
        setTerminalLogs(prev => prev + "[WARN] Parameter autosave failed. Proceeding with existing server settings...\n");
      } else {
        setTerminalLogs(prev => prev + "[SYSTEM] Search parameters synchronized successfully.\n");
      }

      setTerminalLogs(prev => prev + "[SYSTEM] Localizing Chromium Driver... Launching scraper environment thread...\n");
      const res = await fetch("/api/run-scraper", { method: "POST" });
      if (res.ok) {
        setIsRunning(true);
        setActiveDataView("logs");
      } else {
        const errorData = await res.json();
        setTerminalLogs(prev => prev + `[ERROR] Failed to start scraper: ${errorData.error || "Unknown error"}\n`);
      }
    } catch (e) {
      alert("Error triggering scraper agent.");
    }
  };

  const handleStopScraper = async () => {
    if (!isRunning) return;
    setIsStopping(true);
    try {
      setTerminalLogs(prev => prev + "\n[SYSTEM] Stop request initiated by user. Aborting scraping loop...\n");
      const res = await fetch("/api/stop-scraper", { method: "POST" });
      if (res.ok) {
        setTerminalLogs(prev => prev + "[SYSTEM] Stopping scraping operations...\n");
      } else {
        const errorData = await res.json();
        setTerminalLogs(prev => prev + `[ERROR] Failed to stop scraper: ${errorData.error || "Unknown error"}\n`);
      }
    } catch (e) {
      alert("Error requesting stop scraper.");
    } finally {
      setIsStopping(false);
    }
  };

  const handleRetryFailed = async () => {
    if (isRetryingFailed) return;
    setIsRetryingFailed(true);
    try {
      const res = await fetch("/api/retry-failed", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        alert(`Finished Retrying! Succeeded: ${data.succeeded}, Failed: ${data.failed}`);
        fetchData();
      }
    } catch (e) {
      alert("Error executing retry script.");
    } finally {
      setIsRetryingFailed(false);
    }
  };

  const handleResetData = async () => {
    if (!window.confirm("CAUTION: This will permanently wipe all harvested leads, reset scraper logs, and stop active campaigns. Proceed?")) {
      return;
    }
    setIsClearing(true);
    try {
      const res = await fetch("/api/reset-data", { method: "POST" });
      if (res.ok) {
        alert("Lead database and logs completely wiped!");
        setSelectedLeadDetails(null);
        fetchData();
      } else {
        alert("Server failed to wipe database.");
      }
    } catch (e) {
      alert("Error calling reset API.");
    } finally {
      setIsClearing(false);
    }
  };

  const handleTestWebhook = async () => {
    if (isTestingWebhook) return;
    setIsTestingWebhook(true);
    try {
      const res = await fetch("/api/test-webhook", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        alert("🎉 Connection Success!\n\nYour Google Sheets Webhook is verified and active! A mock lead has been successfully dispatched and appended to your spreadsheet.");
      } else {
        alert(`❌ Connection Failed:\n\n${data.error || "Google Apps Script rejected the request."}\n\nREMEDY CHECKLIST:\n1. Open your Google Sheets document.\n2. Click "Extensions" > "Apps Script".\n3. Click the blue "Deploy" button at the top-right > "Manage deployments".\n4. Locate your active Web App deployment and click the Edit (pencil) icon.\n5. Under "Configuration", ensure:\n   - "Execute as": "Me" (your email)\n   - "Who has access": "Anyone" (Anonymous/public access is mandatory)\n6. IMPORTANT: Select "New version" from the version dropdown. (Google will NOT update permissions on your old link without a new version release!)\n7. Click "Deploy", copy the new Web App URL, paste it in your .env, and try again!`);
      }
      fetchData();
    } catch (e) {
      alert("Error trying to trigger the webhook test API.");
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSmtp(true);
    setSmtpSuccess(false);
    try {
      const res = await fetch("/api/config/smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: smtpHost,
          port: smtpPort,
          user: smtpUser,
          pass: smtpPass === "••••••••" ? "" : smtpPass,
          from: smtpFrom
        })
      });
      if (res.ok) {
        setSmtpSuccess(true);
        setTimeout(() => setSmtpSuccess(false), 3000);
        fetchData();
      } else {
        alert("Failed to save SMTP configuration.");
      }
    } catch (err) {
      alert("Error saving SMTP configuration.");
    } finally {
      setIsSavingSmtp(false);
    }
  };



  const handleInitializeWhatsApp = async () => {
    try {
      const res = await fetch("/api/whatsapp/initialize", { method: "POST" });
      if (res.ok) {
        setWhatsappStatus(prev => ({ ...prev, status: "CONNECTING" }));
      }
    } catch (err) {
      alert("Error initializing WhatsApp.");
    }
  };

  const handleDisconnectWhatsApp = async () => {
    if (!window.confirm("Disconnect WhatsApp session? This will log out the client and terminate active scans.")) return;
    setIsDisconnectingWa(true);
    setWhatsappStatus({ status: "CONNECTING", qr: "" });
    try {
      const res = await fetch("/api/whatsapp/disconnect", { method: "POST" });
      if (res.ok) {
        fetchData();
      } else {
        alert("Failed to disconnect WhatsApp.");
        fetchData();
      }
    } catch (err) {
      alert("Error disconnecting WhatsApp session.");
      fetchData();
    } finally {
      setIsDisconnectingWa(false);
    }
  };

  const handleSendTestMessage = async () => {
    const phone = window.prompt("Enter phone number with country code (e.g. 919876543210) to send a test message, or leave blank to send to yourself:");
    if (phone === null) return;

    setIsSendingTestMsg(true);
    try {
      const res = await fetch("/api/whatsapp/send-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() })
      });
      if (res.ok) {
        alert("Test message sent successfully!");
      } else {
        const data = await res.json();
        alert("Failed to send test message: " + (data.error || "Unknown error"));
      }
    } catch (e) {
      alert("Error sending test message.");
    } finally {
      setIsSendingTestMsg(false);
    }
  };

  const handleSelectPreviewLead = async (lead: Lead, configOverride?: PitchTemplateConfig) => {
    setPreviewLead(lead);
    setPreviewCopy(null);
    setIsLoadingPreviewCopy(true);
    const activeConfig = configOverride || pitchTemplates;
    try {
      const res = await fetch("/api/generate-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead, config: activeConfig })
      });
      if (res.ok) {
        const copy = await res.json();
        setPreviewCopy(copy);
      } else {
        setPreviewCopy(generateOutreachCopy(lead, activeConfig));
      }
    } catch (e) {
      setPreviewCopy(generateOutreachCopy(lead, activeConfig));
    } finally {
      setIsLoadingPreviewCopy(false);
    }
  };

  const handleSaveTemplates = async (updatedConfig?: PitchTemplateConfig) => {
    const configToSave = updatedConfig || pitchTemplates;
    setIsSavingTemplates(true);
    try {
      const res = await fetch("/api/config/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(configToSave)
      });
      if (res.ok) {
        setPitchTemplates(configToSave);
        setTemplateSuccess(true);
        setTimeout(() => setTemplateSuccess(false), 3000);
        if (previewLead) {
          handleSelectPreviewLead(previewLead, configToSave);
        }
      } else {
        alert("Failed to save pitch message templates.");
      }
    } catch (err) {
      console.error("Error saving templates:", err);
      alert("Network error while saving templates.");
    } finally {
      setIsSavingTemplates(false);
    }
  };

  const handleSetGoal = (goal: CampaignGoal) => {
    const updated: PitchTemplateConfig = {
      ...pitchTemplates,
      campaignGoal: goal,
      selectedStrategy: "ai"
    };
    setPitchTemplates(updated);
    handleSaveTemplates(updated);
    if (goal === "job") {
      const sub = pitchTemplates.jobSubGoal || "both";
      if (sub === "jobOnly") setSelectedTemplateTab("jobOnly");
      else if (sub === "freelanceOnly") setSelectedTemplateTab("freelanceOnly");
      else setSelectedTemplateTab("jobAndFreelance");
    } else {
      setSelectedTemplateTab("noWebsite");
    }
  };

  const handleSetJobSubGoal = (subGoal: "jobOnly" | "freelanceOnly" | "both") => {
    const updated: PitchTemplateConfig = {
      ...pitchTemplates,
      campaignGoal: "job",
      jobSubGoal: subGoal,
      selectedStrategy: pitchTemplates.selectedStrategy === "ai" ? "ai" : (subGoal as any)
    };
    setPitchTemplates(updated);
    handleSaveTemplates(updated);
    if (subGoal === "jobOnly") setSelectedTemplateTab("jobOnly");
    else if (subGoal === "freelanceOnly") setSelectedTemplateTab("freelanceOnly");
    else setSelectedTemplateTab("jobAndFreelance");
  };

  const handleSetStrategy = (strategy: PitchStrategy) => {
    const updated: PitchTemplateConfig = {
      ...pitchTemplates,
      selectedStrategy: strategy
    };
    setPitchTemplates(updated);
    handleSaveTemplates(updated);
  };

  const handleResetTemplates = () => {
    if (confirm("Reset pitch templates back to default system templates?")) {
      setPitchTemplates(DEFAULT_PITCH_TEMPLATES);
      handleSaveTemplates(DEFAULT_PITCH_TEMPLATES);
    }
  };

  const getTemplateField = (field: "whatsappMessage" | "emailSubject" | "emailBody", tab = selectedTemplateTab): string => {
    const custom = pitchTemplates.customTemplates?.find(t => t.id === tab);
    if (custom && typeof (custom as any)[field] === "string") {
      return (custom as any)[field];
    }
    const current = (pitchTemplates as any)?.[tab]?.[field];
    if (typeof current === "string" && current.trim() !== "") return current;
    const def = (DEFAULT_PITCH_TEMPLATES as any)?.[tab]?.[field];
    return typeof def === "string" ? def : "";
  };

  const updateTemplateField = (field: "whatsappMessage" | "emailSubject" | "emailBody", value: string, tab = selectedTemplateTab) => {
    const isCustom = pitchTemplates.customTemplates?.some(t => t.id === tab);
    if (isCustom) {
      const updatedCustoms = (pitchTemplates.customTemplates || []).map(t => {
        if (t.id === tab) {
          return { ...t, [field]: value };
        }
        return t;
      });
      setPitchTemplates({
        ...pitchTemplates,
        customTemplates: updatedCustoms
      });
      return;
    }
    const currentTabObj = (pitchTemplates as any)?.[tab] || (DEFAULT_PITCH_TEMPLATES as any)?.[tab] || {};
    setPitchTemplates({
      ...pitchTemplates,
      [tab]: {
        ...currentTabObj,
        [field]: value
      }
    });
  };

  const insertVariableTag = (field: "emailSubject" | "emailBody" | "whatsappMessage", tag: string) => {
    const activeSection = selectedTemplateTab;
    const currentVal = getTemplateField(field, activeSection);
    updateTemplateField(field, currentVal + (currentVal.endsWith(" ") || currentVal === "" ? "" : " ") + tag, activeSection);
  };

  const handleOpenOutreach = async (lead: Lead) => {
    setSelectedLeadForOutreach(lead);
    setOutreachEmailSubject("Generating customized pitch...");
    setOutreachEmailBody("Drafting outreach campaign pitch...\n\nPlease wait a moment.");
    setOutreachWhatsappMsg("Drafting message...");

    try {
      const res = await fetch("/api/generate-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead, config: pitchTemplates })
      });
      if (res.ok) {
        const copy = await res.json();
        setOutreachEmailSubject(copy.emailSubject);
        setOutreachEmailBody(copy.emailBody);
        setOutreachWhatsappMsg(copy.whatsappMessage);
      } else {
        const copy = generateOutreachCopy(lead, pitchTemplates);
        setOutreachEmailSubject(copy.emailSubject);
        setOutreachEmailBody(copy.emailBody);
        setOutreachWhatsappMsg(copy.whatsappMessage);
      }
    } catch (e) {
      const copy = generateOutreachCopy(lead, pitchTemplates);
      setOutreachEmailSubject(copy.emailSubject);
      setOutreachEmailBody(copy.emailBody);
      setOutreachWhatsappMsg(copy.whatsappMessage);
    }
  };

  const handleSendEmail = async () => {
    if (!selectedLeadForOutreach) return;
    setIsSendingEmail(true);
    try {
      const recipient = selectedLeadForOutreach.emails && selectedLeadForOutreach.emails.length > 0
        ? selectedLeadForOutreach.emails[0]
        : "";
      if (!recipient) {
        alert("This lead does not have any emails detected. Please enter or verify recipient email.");
        setIsSendingEmail(false);
        return;
      }

      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: selectedLeadForOutreach.businessName,
          to: recipient,
          subject: outreachEmailSubject,
          body: outreachEmailBody,
          attachmentFilename: attachmentFilename || undefined
        })
      });
      if (res.ok) {
        alert("Email sent successfully!");
        setProcessedLeads(prev => prev.map(lead => {
          if (lead.businessName === selectedLeadForOutreach.businessName) {
            return {
              ...lead,
              emailStatus: "SENT",
              emailSentDate: new Date().toISOString().split("T")[0]
            };
          }
          return lead;
        }));
        setSelectedLeadForOutreach(prev => prev ? { ...prev, emailStatus: "SENT" } : null);
      } else {
        const errorData = await res.json();
        alert(`Failed to send email: ${errorData.error || "Unknown error"}`);
      }
    } catch (err) {
      alert("Error sending email.");
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Attachment upload helpers
  const handleUploadAttachment = async (file: File, isCampaign = false) => {
    const setUploading = isCampaign ? setIsUploadingCampaignAttachment : setIsUploadingAttachment;
    const setFilename = isCampaign ? setCampaignAttachmentFilename : setAttachmentFilename;
    const setFileObj = isCampaign ? setCampaignAttachmentFile : setAttachmentFile;
    const setError = isCampaign ? setCampaignAttachmentError : setAttachmentUploadError;

    setUploading(true);
    setError("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload-attachment", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setFilename(data.filename);
        setFileObj(file);
      } else {
        const err = await res.json();
        setError(err.error || "Upload failed.");
      }
    } catch (e) {
      setError("Network error uploading file.");
    } finally {
      setUploading(false);
    }
  };

  const handleClearAttachment = async (isCampaign = false) => {
    const filename = isCampaign ? campaignAttachmentFilename : attachmentFilename;
    const setFilename = isCampaign ? setCampaignAttachmentFilename : setAttachmentFilename;
    const setFileObj = isCampaign ? setCampaignAttachmentFile : setAttachmentFile;
    const setError = isCampaign ? setCampaignAttachmentError : setAttachmentUploadError;

    if (filename) {
      try {
        await fetch(`/api/delete-attachment/${encodeURIComponent(filename)}`, { method: "DELETE" });
      } catch (e) { }
    }
    setFilename("");
    setFileObj(null);
    setError("");
    if (isCampaign && campaignAttachmentInputRef.current) campaignAttachmentInputRef.current.value = "";
    if (!isCampaign && attachmentInputRef.current) attachmentInputRef.current.value = "";
  };

  const handleSendWhatsapp = async () => {
    if (!selectedLeadForOutreach) return;
    setIsSendingWhatsapp(true);
    try {
      const phone = selectedLeadForOutreach.phone;
      if (!phone) {
        alert("This lead does not have a phone number.");
        setIsSendingWhatsapp(false);
        return;
      }

      const res = await fetch("/api/send-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: selectedLeadForOutreach.businessName,
          phone: phone,
          message: outreachWhatsappMsg,
        })
      });
      if (res.ok) {
        alert("WhatsApp message sent successfully!");
        setProcessedLeads(prev => prev.map(lead => {
          if (lead.businessName === selectedLeadForOutreach.businessName) {
            return {
              ...lead,
              whatsappStatus: "SENT",
              whatsappSentDate: new Date().toISOString().split("T")[0]
            };
          }
          return lead;
        }));
        setSelectedLeadForOutreach(prev => prev ? { ...prev, whatsappStatus: "SENT" } : null);
      } else {
        const errorData = await res.json();
        alert(`Failed to send WhatsApp message: ${errorData.error || "Unknown error"}`);
      }
    } catch (err) {
      alert("Error sending WhatsApp message.");
    } finally {
      setIsSendingWhatsapp(false);
    }
  };

  const handleStartCampaign = async () => {
    setIsStartingCampaign(true);
    try {
      const res = await fetch("/api/campaign/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          delaySeconds: campaignDelay,
          enableEmail: campaignEnableEmail,
          enableWhatsapp: campaignEnableWhatsapp,
          dryRun: campaignDryRun,
          sheetName: selectedCampaignSheet,
          attachmentFilename: campaignAttachmentFilename || undefined,
          emailAttachmentFilename: campaignAttachmentFilename || undefined,
        })
      });
      if (res.ok) {
        setCampaignRunning(true);
      } else {
        const err = await res.json();
        alert(`Failed to start campaign: ${err.error || "Unknown error"}`);
      }
    } catch (e) {
      alert("Error starting campaign.");
    } finally {
      setIsStartingCampaign(false);
    }
  };

  const handleStopCampaign = async () => {
    setIsStoppingCampaign(true);
    try {
      const res = await fetch("/api/campaign/stop", { method: "POST" });
      if (res.ok) {
        alert("Campaign abort request successfully received.");
        await fetchCampaignHistory();
      } else {
        const err = await res.json();
        alert(`Failed to stop campaign: ${err.error || "Unknown error"}`);
      }
    } catch (e) {
      alert("Error stopping campaign.");
    } finally {
      setIsStoppingCampaign(false);
    }
  };

  const handlePauseCampaign = async () => {
    setIsPausingCampaign(true);
    try {
      const res = await fetch("/api/campaign/pause", { method: "POST" });
      if (res.ok) {
        setCampaignPaused(true);
      } else {
        const err = await res.json();
        alert(`Failed to pause: ${err.error || "Unknown error"}`);
      }
    } catch {
      alert("Error pausing campaign.");
    } finally {
      setIsPausingCampaign(false);
    }
  };

  const handleResumeCampaign = async () => {
    setIsResumingCampaign(true);
    try {
      const res = await fetch("/api/campaign/resume", { method: "POST" });
      if (res.ok) {
        setCampaignPaused(false);
      } else {
        const err = await res.json();
        alert(`Failed to resume: ${err.error || "Unknown error"}`);
      }
    } catch {
      alert("Error resuming campaign.");
    } finally {
      setIsResumingCampaign(false);
    }
  };

  const fetchCampaignHistory = async () => {
    try {
      const res = await fetch("/api/campaign/history");
      if (res.ok) {
        const data = await res.json();
        setCampaignHistory(Array.isArray(data) ? data : []);
      }
    } catch {}
  };

  const fetchScheduledCampaigns = async () => {
    try {
      const res = await fetch("/api/campaign/schedules");
      if (res.ok) {
        const data = await res.json();
        setScheduledCampaigns(Array.isArray(data) ? data : []);
      }
    } catch {}
  };

  const handleScheduleCampaign = async (nameOrObj: any, scheduledAt?: string, type?: "sheet" | "local", payload?: any): Promise<boolean> => {
    try {
      let finalName = "";
      let finalScheduledAt = "";
      let finalType: "sheet" | "local" = "sheet";
      let finalPayload: any = {};

      if (typeof nameOrObj === "object" && nameOrObj !== null) {
        finalName = nameOrObj.name || "Scheduled Campaign";
        finalScheduledAt = nameOrObj.scheduledAt || nameOrObj.scheduledTime || "";
        finalType = nameOrObj.type || "sheet";
        finalPayload = nameOrObj.payload || nameOrObj;
      } else {
        finalName = nameOrObj || "Scheduled Campaign";
        finalScheduledAt = scheduledAt || "";
        finalType = type || "sheet";
        finalPayload = payload || {};
      }

      const res = await fetch("/api/campaign/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: finalName, scheduledAt: finalScheduledAt, type: finalType, payload: finalPayload })
      });
      if (res.ok) {
        await fetchScheduledCampaigns();
        return true;
      } else {
        const err = await res.json();
        alert(`Failed to schedule campaign: ${err.error || "Unknown error"}`);
        return false;
      }
    } catch {
      alert("Error scheduling campaign.");
      return false;
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    try {
      const res = await fetch(`/api/campaign/schedule/${id}`, { method: "DELETE" });
      if (res.ok) {
        await fetchScheduledCampaigns();
      }
    } catch {}
  };

  const handleRunScheduledNow = async (id: string) => {
    try {
      const res = await fetch(`/api/campaign/schedule/${id}/run`, { method: "POST" });
      if (res.ok) {
        setCampaignRunning(true);
        await fetchScheduledCampaigns();
      } else {
        const err = await res.json();
        alert(`Failed to run scheduled campaign: ${err.error || "Unknown error"}`);
      }
    } catch {
      alert("Error running scheduled campaign.");
    }
  };

  const handleClearCampaignHistory = async () => {
    if (!window.confirm("Are you sure you want to permanently clear campaign history?")) return;
    try {
      const res = await fetch("/api/campaign/history/clear", { method: "POST" });
      if (res.ok) {
        setCampaignHistory([]);
      }
    } catch {}
  };

  const handleDeleteCampaignHistoryItem = async (id: string) => {
    try {
      const res = await fetch(`/api/campaign/history/${id}`, { method: "DELETE" });
      if (res.ok) {
        setCampaignHistory(prev => prev.filter(h => h.id !== id));
      }
    } catch {}
  };

  const handleCsvFileChange = (file: File | null) => {
    setCsvFile(file);
    setCsvParseError("");
    setLocalCampaignResult(null);
    if (!file) {
      setCsvHeaders([]);
      setCsvRows([]);
      setCsvMapping({});
      setCsvStep("upload");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers, rows } = parseCSV(text);
      if (headers.length === 0) {
        setCsvParseError("Could not parse CSV. Make sure the file has headers in the first row.");
        return;
      }
      setCsvHeaders(headers);
      setCsvRows(rows);
      setCsvMapping(autoDetectMapping(headers));
      setCsvStep("map");
    };
    reader.readAsText(file);
  };

  const handleSaveLocalTemplates = async (custom?: {
    emailSubject?: string;
    emailBody?: string;
    whatsappMessage?: string;
  }) => {
    const emailSub = custom?.emailSubject !== undefined ? custom.emailSubject : localEmailSubject;
    const emailBdy = custom?.emailBody !== undefined ? custom.emailBody : localEmailBody;
    const waMsg    = custom?.whatsappMessage !== undefined ? custom.whatsappMessage : localWhatsappMsg;

    setIsSavingLocalTemplates(true);
    try {
      const configToSave: PitchTemplateConfig = {
        ...pitchTemplates,
        localCampaign: {
          emailSubject: emailSub,
          emailBody: emailBdy,
          whatsappMessage: waMsg,
        }
      };
      const res = await fetch("/api/config/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(configToSave)
      });
      if (res.ok) {
        setPitchTemplates(configToSave);
        setLocalTemplatesSaved(true);
        setTimeout(() => setLocalTemplatesSaved(false), 2500);
      }
    } catch (e) {
      console.error("Failed to save local campaign templates to JSON:", e);
    } finally {
      setIsSavingLocalTemplates(false);
    }
  };

  const handleDownloadUpdatedCsv = () => {
    window.open("/api/campaign/local-data/csv", "_blank");
  };

  const handleLaunchLocalCampaign = async () => {
    setIsLaunchingLocalCampaign(true);
    // Prevent campaign launch if WhatsApp is enabled but not connected
    if (localEnableWhatsapp && !localDryRun && whatsappStatus.status !== "CONNECTED") {
      setLocalCampaignResult({
        success: false,
        message: "WhatsApp is not connected. Please scan the QR code below or in Settings to link WhatsApp before launching."
      });
      setIsLaunchingLocalCampaign(false);
      return;
    }

    // Ensure templates are saved to templates.json on launch
    handleSaveLocalTemplates();

    try {
      const res = await fetch("/api/campaign/local-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: csvRows,
          mapping: csvMapping,
          headers: csvHeaders,
          fileName: csvFile?.name,
          campaignName: csvFile?.name ? csvFile.name.replace(/\.csv$/i, "").replace(/_\d{4}-\d{2}-\d{2}[_\d-]*/g, "").replace(/[_-]emails?$/i, "").replace(/[_-]+/g, " ").trim() + " Campaign" : "Local CSV Campaign",
          emailSubject: localEmailSubject,
          emailBody: localEmailBody,
          whatsappMessage: localWhatsappMsg,
          campaignGoal: localCampaignGoal,
          delaySeconds: localCampaignDelay,
          enableEmail: localEnableEmail,
          enableWhatsapp: localEnableWhatsapp,
          dryRun: localDryRun,
          skipAlreadySent: localSkipAlreadySent,
          senderName: pitchTemplates.senderName,
          senderCompany: pitchTemplates.senderCompany,
          roleTitle: pitchTemplates.roleTitle,
          skills: pitchTemplates.skills,
          portfolioUrl: pitchTemplates.portfolioUrl,
          attachmentFilename: campaignAttachmentFilename || undefined,
          emailAttachmentFilename: campaignAttachmentFilename || undefined,
        })
      });
      if (res.ok) {
        setLocalCampaignResult({ success: true, message: `Local Data Campaign launched for ${csvRows.length} records!` });
        setCampaignRunning(true);
      } else {
        const err = await res.json();
        setLocalCampaignResult({ success: false, message: err.error || "Failed to launch campaign." });
      }
    } catch (e) {
      setLocalCampaignResult({ success: false, message: "Network error launching campaign." });
    } finally {
      setIsLaunchingLocalCampaign(false);
    }
  };

  const handleResetCsv = () => {
    setCsvFile(null);
    setCsvHeaders([]);
    setCsvRows([]);
    setCsvMapping({});
    setCsvParseError("");
    setCsvStep("upload");
    setLocalCampaignResult(null);
    if (csvInputRef.current) csvInputRef.current.value = "";
  };

  // Helper stats for dashboard
  const hotLeads = processedLeads.filter(l => (l.leadPriority || "").toUpperCase() === "HOT" || (l.leadScore && l.leadScore >= 120)).length;
  const warmLeads = processedLeads.filter(l => (l.leadPriority || "").toUpperCase() === "WARM" || (l.leadScore && l.leadScore >= 70 && l.leadScore < 120)).length;
  const coldLeads = processedLeads.filter(l => (l.leadPriority || "").toUpperCase() === "COLD" || (l.leadScore !== undefined && l.leadScore < 70)).length;
  const totalFolderRows = availableFolders.reduce((acc, f) => acc + (f.totalRows || 0), 0);
  const totalProcessed = processedLeads.length > 0 ? processedLeads.length : totalFolderRows;

  const scorePoor = processedLeads.filter(l => (l.leadScore || 0) <= 50).length;
  const scoreNeedsWork = processedLeads.filter(l => (l.leadScore || 0) > 50 && (l.leadScore || 0) <= 100).length;
  const scoreGood = processedLeads.filter(l => (l.leadScore || 0) > 100 && (l.leadScore || 0) <= 150).length;
  const scoreExcellent = processedLeads.filter(l => (l.leadScore || 0) > 150).length;

  const maxScoreCount = Math.max(scorePoor, scoreNeedsWork, scoreGood, scoreExcellent, 1);

  const value: LeadFinderContextType = {
    activeTab,
    setActiveTab,
    settingsSubView,
    setSettingsSubView,
    businessType,
    setBusinessType,
    location,
    setLocation,
    maxResults,
    setMaxResults,
    enableSimulation,
    setEnableSimulation,
    headless,
    setHeadless,
    scrapeWebsite,
    setScrapeWebsite,
    scrapeSocialMedia,
    setScrapeSocialMedia,
    finderMode,
    setFinderMode,
    isSavingConfig,
    configSuccess,
    handleSaveConfig,
    lat,
    setLat,
    lng,
    setLng,
    radius,
    setRadius,
    mapSearchText,
    setMapSearchText,
    isGeocoding,
    reverseGeocode,
    handleSearchAreaGeocode,
    mapLayer,
    setMapLayer,
    overviewMapLayer,
    setOverviewMapLayer,
    finderMapInstance,
    finderMarker,
    finderCircle,
    finderTileLayer,
    overviewMapInstance,
    overviewMarkers,
    overviewTileLayer,
    switchTileLayer,
    switchOverviewTileLayer,
    isRunning,
    setIsRunning,
    isStopping,
    webhookConfigured,
    lastResult,
    terminalLogs,
    setTerminalLogs,
    autoScrollLogs,
    setAutoScrollLogs,
    terminalContainerRef,
    handleStartScraper,
    handleStopScraper,
    handleResetData,
    fetchStatusAndLogs,
    processedLeads,
    setProcessedLeads,
    failedLeads,
    setFailedLeads,
    activeDataView,
    setActiveDataView,
    isRetryingFailed,
    isClearing,
    isTestingWebhook,
    copiedScript,
    setCopiedScript,
    searchTerm,
    setSearchTerm,
    priorityFilter,
    setPriorityFilter,
    filteredLeads,
    selectedLeadKeys,
    setSelectedLeadKeys,
    visibleColumns,
    setVisibleColumns,
    toggleColumn,
    handleShowAllColumns,
    handleResetColumns,
    handleDeleteLead,
    handleBulkDelete,
    toggleLeadSelection,
    toggleSelectAll,
    downloadCSV,
    handleLoadSampleLeads,
    isLoadingSampleLeads,
    handleSyncGoogleSheet,
    isSyncingSheet,
    leadOpFeedback,
    handleRetryFailed,
    handleTestWebhook,
    fetchData,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    isFolderDrawerOpen,
    setIsFolderDrawerOpen,
    selectedFolderId,
    setSelectedFolderId,
    folderSearchTerm,
    setFolderSearchTerm,
    folderDateFilter,
    setFolderDateFilter,
    folderSortBy,
    setFolderSortBy,
    availableFolders,
    isLoadingFolders,
    fetchFolders,
    csvLeads,
    isLoadingCsvData,
    handleUploadCsvFile,
    handleSelectCsvFile,
    whatsappStatus,
    setWhatsappStatus,
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
    isDisconnectingWa,
    isSendingTestMsg,
    handleSaveSmtp,
    handleInitializeWhatsApp,
    handleDisconnectWhatsApp,
    handleSendTestMessage,
    pitchTemplates,
    setPitchTemplates,
    selectedTemplateTab,
    setSelectedTemplateTab,
    isSavingTemplates,
    templateSuccess,
    handleSaveTemplates,
    handleSetGoal,
    handleSetJobSubGoal,
    handleSetStrategy,
    handleResetTemplates,
    getTemplateField,
    updateTemplateField,
    insertVariableTag,
    activeCampaignType,
    setActiveCampaignType,
    isCampaignDrawerOpen,
    setIsCampaignDrawerOpen,
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
    previewLead,
    setPreviewLead,
    previewCopy,
    isLoadingPreviewCopy,
    fetchCampaignSheets,
    handleSelectPreviewLead,
    campaignRunning,
    setCampaignRunning,
    campaignPaused,
    activeCampaignData,
    campaignHistory,
    scheduledCampaigns,
    campaignProgress,
    isStartingCampaign,
    isStoppingCampaign,
    isPausingCampaign,
    isResumingCampaign,
    handleStartCampaign,
    handleStopCampaign,
    handlePauseCampaign,
    handleResumeCampaign,
    fetchCampaignHistory,
    fetchScheduledCampaigns,
    handleScheduleCampaign,
    handleDeleteSchedule,
    handleRunScheduledNow,
    handleClearCampaignHistory,
    handleDeleteCampaignHistoryItem,
    campaignLogs,
    handleClearCampaignLogs,
    csvFile,
    csvHeaders,
    csvRows,
    csvMapping,
    setCsvMapping,
    csvParseError,
    csvStep,
    setCsvStep,
    localCampaignGoal,
    setLocalCampaignGoal,
    localCampaignDelay,
    setLocalCampaignDelay,
    localEnableEmail,
    setLocalEnableEmail,
    localEnableWhatsapp,
    setLocalEnableWhatsapp,
    localDryRun,
    setLocalDryRun,
    localEmailSubject,
    setLocalEmailSubject,
    localEmailBody,
    setLocalEmailBody,
    localWhatsappMsg,
    setLocalWhatsappMsg,
    isSavingLocalTemplates,
    localTemplatesSaved,
    handleSaveLocalTemplates,
    handleDownloadUpdatedCsv,
    isLaunchingLocalCampaign,
    localSkipAlreadySent,
    setLocalSkipAlreadySent,
    localCampaignResult,
    csvInputRef,
    handleCsvFileChange,
    handleLaunchLocalCampaign,
    handleResetCsv,
    selectedLeadForOutreach,
    setSelectedLeadForOutreach,
    outreachEmailSubject,
    setOutreachEmailSubject,
    outreachEmailBody,
    setOutreachEmailBody,
    outreachWhatsappMsg,
    setOutreachWhatsappMsg,
    isSendingEmail,
    isSendingWhatsapp,
    handleOpenOutreach,
    handleSendEmail,
    handleSendWhatsapp,
    selectedLeadDetails,
    setSelectedLeadDetails,
    showColumnModal,
    setShowColumnModal,
    attachmentFile,
    setAttachmentFile,
    attachmentFilename,
    isUploadingAttachment,
    attachmentUploadError,
    attachmentInputRef,
    campaignAttachmentFile,
    setCampaignAttachmentFile,
    campaignAttachmentFilename,
    isUploadingCampaignAttachment,
    campaignAttachmentError,
    campaignAttachmentInputRef,
    handleUploadAttachment,
    handleClearAttachment,
    hotLeads,
    warmLeads,
    coldLeads,
    totalProcessed,
    scorePoor,
    scoreNeedsWork,
    scoreGood,
    scoreExcellent,
    maxScoreCount,
  };

  return <LeadFinderContext.Provider value={value}>{children}</LeadFinderContext.Provider>;
}

export function useLeadFinder() {
  const context = useContext(LeadFinderContext);
  if (!context) {
    throw new Error("useLeadFinder must be used within a LeadFinderProvider");
  }
  return context;
}
