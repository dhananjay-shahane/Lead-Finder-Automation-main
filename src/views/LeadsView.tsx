import React, { useMemo, useState, useEffect } from "react";
import {
  Search,
  Eye,
  Columns,
  ChevronDown,
  Loader2,
  RefreshCw,
  FileSpreadsheet,
  Trash2,
  ExternalLink,
  Send,
  Sparkles,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  Mail,
  Phone,
  Layers,
  Clock,
  ArrowLeft,
  ArrowUp,
  Flame,
  Check,
  Folder,
  FolderOpen,
  Monitor,
  HardDrive,
  LayoutGrid,
  List,
  BarChart2,
  ChevronRight as ChevronRightIcon,
  SlidersHorizontal,
  Info,
  MoreVertical
} from "lucide-react";
import { useLeadFinder } from "../context/LeadFinderContext";
import { ALL_LEAD_COLUMNS, FolderDateFilter, FolderSortOption, Lead, DataFolder } from "../types";
import ColumnCustomizerModal from "../components/shared/ColumnCustomizerModal";
import LeadDetailCard from "../components/shared/LeadDetailCard";

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

// Date Filter Pills definitions
const dateFilterTabs: { id: FolderDateFilter; label: string }[] = [
  { id: "ALL", label: "All Time" },
  { id: "TODAY", label: "Today" },
  { id: "THIS_WEEK", label: "This Week" },
  { id: "THIS_MONTH", label: "This Month" },
  { id: "OLDER", label: "Older" }
];

type VirtualFolderType = "ALL" | "ENRICHED" | "MAPS_SCRAPES" | "CAMPAIGNS";

export default function LeadsView() {
  const {
    leadOpFeedback,
    setLeadOpFeedback,
    searchTerm,
    setSearchTerm,
    priorityFilter,
    setPriorityFilter,
    handleShowAllColumns,
    visibleColumns,
    showColumnModal,
    setShowColumnModal,
    downloadCSV,
    filteredLeads,
    selectedLeadKeys,
    setSelectedLeadKeys,
    handleBulkDelete,
    selectedLeadDetails,
    setSelectedLeadDetails,
    toggleSelectAll,
    toggleLeadSelection,
    handleOpenOutreach,
    handleDeleteLead,
    setActiveTab,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    selectedFolderId,
    setSelectedFolderId,
    availableFolders,
    isLoadingFolders,
    fetchFolders,
    isLoadingCsvData
  } = useLeadFinder();

  // Windows File Explorer State
  const [activeVirtualFolder, setActiveVirtualFolder] = useState<VirtualFolderType | null>(null);
  const [explorerViewMode, setExplorerViewMode] = useState<"grid" | "details">("grid");
  const [folderSearch, setFolderSearch] = useState("");
  const [folderDateFilter, setFolderDateFilter] = useState<FolderDateFilter>("ALL");
  const [folderSortBy, setFolderSortBy] = useState<FolderSortOption>("LATEST");
  const [selectedFileForInfo, setSelectedFileForInfo] = useState<string | null>(null);

  // Preview Mode State - Toggle Statistics (User requirement: toggle view file statistics instead of side by side)
  const [showFileStats, setShowFileStats] = useState(false);
  const [emailOnlyFilter, setEmailOnlyFilter] = useState(false);

  // Context Menu State for Folders and Files
  interface ContextMenuState {
    visible: boolean;
    x: number;
    y: number;
    type: "folder" | "file";
    folderType?: VirtualFolderType | null;
    folderName?: string;
    file?: DataFolder;
  }

  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    type: "file"
  });

  useEffect(() => {
    const handleGlobalClick = () => {
      setContextMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    };
    window.addEventListener("click", handleGlobalClick);
    window.addEventListener("contextmenu", handleGlobalClick);
    return () => {
      window.removeEventListener("click", handleGlobalClick);
      window.removeEventListener("contextmenu", handleGlobalClick);
    };
  }, []);

  const handleOpenContextMenu = (
    e: React.MouseEvent,
    itemType: "folder" | "file",
    folderType?: VirtualFolderType | null,
    folderName?: string,
    file?: DataFolder
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      type: itemType,
      folderType,
      folderName,
      file
    });
  };

  const handleDeleteCsvFile = async (file: DataFolder) => {
    const filename = file.filename || file.name;
    if (!window.confirm(`Are you sure you want to delete "${filename}"? This action cannot be undone.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/csv-data/${encodeURIComponent(filename)}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setLeadOpFeedback(`Successfully deleted file: ${filename}`);
        if (selectedFolderId === filename) {
          setSelectedFolderId(null);
        }
        await fetchFolders();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to delete file");
      }
    } catch (e: any) {
      alert(`Error deleting file: ${e?.message || e}`);
    }
  };

  const handleDeleteFolder = async (folderType?: VirtualFolderType | null, folderName?: string) => {
    let filesToDelete: DataFolder[] = [];
    if (folderType === "ENRICHED") filesToDelete = enrichedFiles;
    else if (folderType === "MAPS_SCRAPES") filesToDelete = mapsScrapesFiles;
    else if (folderType === "CAMPAIGNS") filesToDelete = campaignFiles;
    else filesToDelete = displayedFiles;

    if (filesToDelete.length === 0) {
      alert(`No files found in directory "${folderName || 'Selected folder'}" to delete.`);
      return;
    }

    if (!window.confirm(`Are you sure you want to delete directory "${folderName || 'folder'}" and remove all ${filesToDelete.length} files inside it? This cannot be undone.`)) {
      return;
    }

    try {
      for (const f of filesToDelete) {
        await fetch(`/api/csv-data/${encodeURIComponent(f.filename || f.name)}`, {
          method: "DELETE"
        });
      }
      setLeadOpFeedback(`Successfully deleted all files in "${folderName || 'folder'}"`);
      setActiveVirtualFolder(null);
      await fetchFolders();
    } catch (e: any) {
      alert(`Error deleting folder: ${e?.message || e}`);
    }
  };

  // Active selected folder object
  const selectedFolder = useMemo(() => {
    if (!selectedFolderId) return null;
    return availableFolders.find((f) => f.filename === selectedFolderId || f.id === selectedFolderId) || null;
  }, [availableFolders, selectedFolderId]);

  // Aggregate stats across all CSV files
  const totalFiles = availableFolders.length;
  const totalLeadsInFiles = useMemo(() => availableFolders.reduce((acc, f) => acc + (f.leadCount || 0), 0), [availableFolders]);
  const totalEmailsInFiles = useMemo(() => availableFolders.reduce((acc, f) => acc + (f.emailCount || 0), 0), [availableFolders]);

  // Virtual Folders categorization
  const enrichedFiles = useMemo(() => {
    return availableFolders.filter(f => f.filename.endsWith("_emails.csv") || (f.emailCount && f.emailCount > 0));
  }, [availableFolders]);

  const mapsScrapesFiles = useMemo(() => {
    return availableFolders.filter(f => !f.filename.endsWith("_emails.csv") && !f.filename.includes("campaign"));
  }, [availableFolders]);

  const campaignFiles = useMemo(() => {
    return availableFolders.filter(f => f.filename.includes("campaign") || f.category?.toLowerCase().includes("campaign"));
  }, [availableFolders]);

  // Filtered files depending on virtual folder navigation
  const displayedFiles = useMemo(() => {
    let list = [...availableFolders];

    if (activeVirtualFolder === "ENRICHED") {
      list = enrichedFiles;
    } else if (activeVirtualFolder === "MAPS_SCRAPES") {
      list = mapsScrapesFiles;
    } else if (activeVirtualFolder === "CAMPAIGNS") {
      list = campaignFiles;
    }

    if (folderSearch.trim()) {
      const q = folderSearch.toLowerCase();
      list = list.filter(
        f =>
          f.name.toLowerCase().includes(q) ||
          f.filename.toLowerCase().includes(q) ||
          f.description?.toLowerCase().includes(q) ||
          f.category?.toLowerCase().includes(q)
      );
    }

    if (folderDateFilter !== "ALL") {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const sevenDaysAgo = startOfDay - 7 * 24 * 60 * 60 * 1000;
      const thirtyDaysAgo = startOfDay - 30 * 24 * 60 * 60 * 1000;

      list = list.filter(f => {
        const itemTime = new Date(f.updatedAt || f.createdAt).getTime();
        if (folderDateFilter === "TODAY") return itemTime >= startOfDay;
        if (folderDateFilter === "THIS_WEEK") return itemTime >= sevenDaysAgo;
        if (folderDateFilter === "THIS_MONTH") return itemTime >= thirtyDaysAgo;
        if (folderDateFilter === "OLDER") return itemTime < thirtyDaysAgo;
        return true;
      });
    }

    list.sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt).getTime();

      switch (folderSortBy) {
        case "LATEST":
          return timeB - timeA;
        case "OLDEST":
          return timeA - timeB;
        case "MOST_LEADS":
          return b.leadCount - a.leadCount;
        case "ALPHABETICAL":
        case "NAME":
          return a.name.localeCompare(b.name);
        default:
          return timeB - timeA;
      }
    });

    return list;
  }, [availableFolders, activeVirtualFolder, enrichedFiles, mapsScrapesFiles, campaignFiles, folderSearch, folderDateFilter, folderSortBy]);

  // In Preview Mode: filter leads by emailOnlyFilter if toggled
  const previewLeads = useMemo(() => {
    if (!emailOnlyFilter) return filteredLeads;
    return filteredLeads.filter(l => l.emails && l.emails.length > 0);
  }, [filteredLeads, emailOnlyFilter]);

  // Preview Pagination calculation
  const totalFiltered = previewLeads.length;
  const totalPages = pageSize === -1 ? 1 : Math.ceil(totalFiltered / pageSize) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * (pageSize === -1 ? totalFiltered : pageSize);
  const endIndex = pageSize === -1 ? totalFiltered : Math.min(startIndex + (pageSize === -1 ? totalFiltered : pageSize), totalFiltered);
  const paginatedLeads = useMemo(() => {
    if (pageSize === -1) return previewLeads;
    return previewLeads.slice(startIndex, endIndex);
  }, [previewLeads, startIndex, endIndex, pageSize]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Operation Feedback toast */}
      {leadOpFeedback && (
        <div className="bg-indigo-950/60 border border-indigo-500/40 text-indigo-200 text-xs font-mono px-4 py-2.5 rounded-xl flex items-center justify-between gap-2 shadow-lg">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-400 flex-shrink-0 animate-pulse" />
            <span>{leadOpFeedback}</span>
          </div>
          <button onClick={() => setLeadOpFeedback(null)} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* =========================================================================
          VIEW 1: WINDOWS FILE EXPLORER (When no file is selected)
         ========================================================================= */}
      {!selectedFolderId ? (
        <div className="bg-[#090d16] border border-[#1e293b] rounded-2xl overflow-hidden shadow-2xl flex flex-col min-h-[620px]">
          {/* Native Leads Database Console Header */}
          <div className="bg-[#0b1120] px-5 py-3.5 border-b border-[#1e293b] flex flex-wrap items-center justify-between gap-3 select-none">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <FolderOpen className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                  <span>Leads Database Explorer</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-normal">data/</span>
                </h3>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                  Right-click any folder or file for options (view, export, delete).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
              <span className="px-2.5 py-1 rounded-lg bg-[#030712] border border-[#1e293b] text-slate-300 font-bold">{totalFiles} files</span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">{totalEmailsInFiles.toLocaleString()} emails</span>
              <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-bold">{totalLeadsInFiles.toLocaleString()} leads</span>
            </div>
          </div>

          {/* Directory Navigation & Explorer Controls */}
          <div className="bg-[#080d19] p-3 border-b border-[#1e293b] flex flex-wrap items-center justify-between gap-3">
            {/* Back, Up, Refresh & Breadcrumb */}
            <div className="flex items-center gap-2 flex-grow max-w-2xl min-w-[280px]">
              <div className="flex items-center gap-1 text-slate-400">
                <button
                  onClick={() => setActiveVirtualFolder(null)}
                  disabled={!activeVirtualFolder}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                  title="Back to All Files (data/)"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setActiveVirtualFolder(null)}
                  disabled={!activeVirtualFolder}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                  title="Up one level"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  onClick={() => fetchFolders()}
                  disabled={isLoadingFolders}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Refresh Files"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoadingFolders ? "animate-spin text-emerald-400" : ""}`} />
                </button>
              </div>

              {/* Clean Breadcrumb Bar */}
              <div className="flex-grow flex items-center bg-[#030712] border border-[#1e293b] rounded-xl px-3 py-1.5 text-xs font-mono text-slate-300 gap-1.5 overflow-x-auto shadow-inner">
                <Folder className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <button
                  onClick={() => setActiveVirtualFolder(null)}
                  className="hover:text-white hover:underline cursor-pointer flex items-center gap-1"
                >
                  data <ChevronRightIcon className="h-3 w-3 text-slate-600" />
                </button>
                {activeVirtualFolder ? (
                  <span className="text-amber-400 font-bold flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                    {activeVirtualFolder === "ENRICHED" && "Enriched Email Lists"}
                    {activeVirtualFolder === "MAPS_SCRAPES" && "Google Maps Scrapes"}
                    {activeVirtualFolder === "CAMPAIGNS" && "Campaign Exports"}
                    {activeVirtualFolder === "ALL" && "All Lead Files"}
                  </span>
                ) : (
                  <span className="text-slate-400">All Files</span>
                )}
              </div>
            </div>

            {/* Right: Search in folder & View Mode Toggles */}
            <div className="flex items-center gap-3">
              {/* Explorer Search */}
              <div className="relative w-48 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search in folder..."
                  value={folderSearch}
                  onChange={(e) => setFolderSearch(e.target.value)}
                  className="w-full pl-8 pr-7 py-1.5 bg-[#030712] border border-[#1e293b] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                />
                {folderSearch && (
                  <button
                    onClick={() => setFolderSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* View Switcher (Grid vs Details) */}
              <div className="flex items-center bg-[#030712] border border-[#1e293b] rounded-xl p-0.5">
                <button
                  onClick={() => setExplorerViewMode("grid")}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    explorerViewMode === "grid"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title="Large Icons / Tiles View"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setExplorerViewMode("details")}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    explorerViewMode === "details"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title="Details Table View"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Windows Explorer Workspace: Left Sidebar + Right Content */}
          <div className="flex-1 flex flex-col md:flex-row">
            {/* Left Windows Explorer Navigation Pane */}
            <div className="w-full md:w-56 bg-[#070b14] border-r border-[#1e293b] p-3 space-y-4 select-none shrink-0">
              <div>
                <div className="text-[10px] font-mono font-bold text-slate-500 uppercase px-2 mb-1.5 flex items-center gap-1.5">
                  <Monitor className="h-3 w-3 text-slate-500" /> Quick Access
                </div>
                <div className="space-y-1">
                  <button
                    onClick={() => setActiveVirtualFolder(null)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors flex items-center justify-between cursor-pointer ${
                      activeVirtualFolder === null
                        ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-bold"
                        : "text-slate-300 hover:bg-slate-800/50"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <FolderOpen className="h-3.5 w-3.5 text-amber-400" />
                      <span>data/ (All Files)</span>
                    </span>
                    <span className="text-[10px] bg-[#1e293b] text-slate-400 px-1.5 py-0.2 rounded">
                      {totalFiles}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveVirtualFolder("ENRICHED")}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors flex items-center justify-between cursor-pointer ${
                      activeVirtualFolder === "ENRICHED"
                        ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 font-bold"
                        : "text-slate-300 hover:bg-slate-800/50"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Folder className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Enriched Lists</span>
                    </span>
                    <span className="text-[10px] bg-[#1e293b] text-emerald-400 px-1.5 py-0.2 rounded font-bold">
                      {enrichedFiles.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveVirtualFolder("MAPS_SCRAPES")}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors flex items-center justify-between cursor-pointer ${
                      activeVirtualFolder === "MAPS_SCRAPES"
                        ? "bg-sky-600/20 text-sky-300 border border-sky-500/30 font-bold"
                        : "text-slate-300 hover:bg-slate-800/50"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Folder className="h-3.5 w-3.5 text-sky-400" />
                      <span>Maps Scrapes</span>
                    </span>
                    <span className="text-[10px] bg-[#1e293b] text-slate-400 px-1.5 py-0.2 rounded">
                      {mapsScrapesFiles.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveVirtualFolder("CAMPAIGNS")}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors flex items-center justify-between cursor-pointer ${
                      activeVirtualFolder === "CAMPAIGNS"
                        ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-bold"
                        : "text-slate-300 hover:bg-slate-800/50"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Folder className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Campaign Data</span>
                    </span>
                    <span className="text-[10px] bg-[#1e293b] text-slate-400 px-1.5 py-0.2 rounded">
                      {campaignFiles.length}
                    </span>
                  </button>
                </div>
              </div>

              {/* Date Filter & Sorting in Sidebar */}
              <div className="pt-3 border-t border-[#1e293b] space-y-3">
                <div className="text-[10px] font-mono font-bold text-slate-500 uppercase px-2 flex items-center gap-1.5">
                  <SlidersHorizontal className="h-3 w-3 text-slate-500" /> Filter by Date
                </div>
                <div className="space-y-1">
                  {dateFilterTabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setFolderDateFilter(tab.id)}
                      className={`w-full text-left px-2.5 py-1 rounded-md text-[11px] font-mono transition-all cursor-pointer ${
                        folderDateFilter === tab.id
                          ? "bg-slate-800 text-white font-bold"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="pt-2">
                  <label className="text-[10px] text-slate-500 uppercase font-mono block mb-1 px-2">Sort by</label>
                  <select
                    value={folderSortBy}
                    onChange={(e) => setFolderSortBy(e.target.value as FolderSortOption)}
                    className="w-full bg-[#030712] border border-[#1e293b] rounded-lg text-xs text-slate-300 py-1.5 px-2 focus:outline-none focus:border-indigo-500 font-mono cursor-pointer"
                  >
                    <option value="LATEST">Date: Latest First</option>
                    <option value="OLDEST">Date: Oldest First</option>
                    <option value="MOST_LEADS">Count: Most Leads</option>
                    <option value="ALPHABETICAL">Name (A-Z)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Right Main Folder/File Explorer Area */}
            <div className="flex-1 p-5 overflow-y-auto space-y-6">
              {/* SECTION A: FOLDERS (Only displayed when at Root level) */}
              {!activeVirtualFolder && (
                <div>
                  <div className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Folder className="h-4 w-4 text-amber-400" /> Directories & Categories
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {/* Folder 1: Enriched Email Lists */}
                    <div
                      onClick={() => setActiveVirtualFolder("ENRICHED")}
                      onContextMenu={(e) => handleOpenContextMenu(e, "folder", "ENRICHED", "Enriched Email Lists")}
                      className="bg-[#0f172a]/70 hover:bg-[#1e293b]/70 border border-[#1e293b] hover:border-emerald-500/50 rounded-xl p-3.5 transition-all cursor-pointer flex items-center justify-between group shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                          <Folder className="h-5 w-5 fill-emerald-500/20" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white font-mono group-hover:text-emerald-300 transition-colors">
                            Enriched Email Lists
                          </h4>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {enrichedFiles.length} CSV files with emails
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenContextMenu(e, "folder", "ENRICHED", "Enriched Email Lists");
                          }}
                          className="p-1 rounded-lg hover:bg-slate-700/60 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          title="Folder options"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        <ChevronRightIcon className="h-4 w-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                      </div>
                    </div>

                    {/* Folder 2: Google Maps Scrapes */}
                    <div
                      onClick={() => setActiveVirtualFolder("MAPS_SCRAPES")}
                      onContextMenu={(e) => handleOpenContextMenu(e, "folder", "MAPS_SCRAPES", "Google Maps Scrapes")}
                      className="bg-[#0f172a]/70 hover:bg-[#1e293b]/70 border border-[#1e293b] hover:border-sky-500/50 rounded-xl p-3.5 transition-all cursor-pointer flex items-center justify-between group shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 group-hover:scale-105 transition-transform">
                          <Folder className="h-5 w-5 fill-sky-500/20" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white font-mono group-hover:text-sky-300 transition-colors">
                            Google Maps Scrapes
                          </h4>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {mapsScrapesFiles.length} raw scraped lead lists
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenContextMenu(e, "folder", "MAPS_SCRAPES", "Google Maps Scrapes");
                          }}
                          className="p-1 rounded-lg hover:bg-slate-700/60 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          title="Folder options"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        <ChevronRightIcon className="h-4 w-4 text-slate-500 group-hover:text-sky-400 transition-colors" />
                      </div>
                    </div>

                    {/* Folder 3: Campaign Exports */}
                    <div
                      onClick={() => setActiveVirtualFolder("CAMPAIGNS")}
                      onContextMenu={(e) => handleOpenContextMenu(e, "folder", "CAMPAIGNS", "Campaign Exports")}
                      className="bg-[#0f172a]/70 hover:bg-[#1e293b]/70 border border-[#1e293b] hover:border-indigo-500/50 rounded-xl p-3.5 transition-all cursor-pointer flex items-center justify-between group shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform">
                          <Folder className="h-5 w-5 fill-indigo-500/20" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white font-mono group-hover:text-indigo-300 transition-colors">
                            Campaign Exports
                          </h4>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {campaignFiles.length} campaign CSV files
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenContextMenu(e, "folder", "CAMPAIGNS", "Campaign Exports");
                          }}
                          className="p-1 rounded-lg hover:bg-slate-700/60 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          title="Folder options"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        <ChevronRightIcon className="h-4 w-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION B: FILES (Inside Folder or Root) */}
              <div>
                <div className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                    {activeVirtualFolder ? "Files in Directory" : "Recent Files in data/"} ({displayedFiles.length})
                  </span>

                  {activeVirtualFolder && (
                    <button
                      onClick={() => setActiveVirtualFolder(null)}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 underline font-mono cursor-pointer"
                    >
                      ← Back to All Folders
                    </button>
                  )}
                </div>

                {displayedFiles.length === 0 ? (
                  <div className="bg-[#070b14] border border-[#1e293b] rounded-xl p-12 text-center space-y-3">
                    <FileSpreadsheet className="h-8 w-8 text-slate-600 mx-auto" />
                    <h4 className="text-xs font-mono font-bold text-slate-300">No CSV Files in this Directory</h4>
                    <p className="text-[11px] font-mono text-slate-500 max-w-sm mx-auto">
                      No files matched your search or folder filters.
                    </p>
                    <button
                      onClick={() => {
                        setFolderSearch("");
                        setFolderDateFilter("ALL");
                        setActiveVirtualFolder(null);
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono rounded-lg transition-colors cursor-pointer"
                    >
                      Reset Directory View
                    </button>
                  </div>
                ) : explorerViewMode === "grid" ? (
                  /* ─── GRID / LARGE ICONS VIEW (Windows Explorer Style) ─── */
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {displayedFiles.map((file) => {
                      const isEnriched = file.filename.endsWith("_emails.csv") || file.emailCount > 0;

                      return (
                        <div
                          key={file.id}
                          onClick={() => setSelectedFolderId(file.filename || file.id)}
                          onContextMenu={(e) => handleOpenContextMenu(e, "file", undefined, undefined, file)}
                          className="bg-[#0d1424] hover:bg-[#131d33] border border-[#1e293b] hover:border-emerald-500/50 rounded-xl p-4 transition-all cursor-pointer group flex flex-col justify-between shadow-md relative"
                        >
                          <div>
                            {/* File Icon & Header */}
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 min-w-0">
                                <div
                                  className={`h-11 w-11 rounded-xl flex items-center justify-center border shrink-0 group-hover:scale-105 transition-transform ${
                                    isEnriched
                                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                      : "bg-indigo-500/10 text-indigo-400 border-indigo-500/30"
                                  }`}
                                >
                                  <FileSpreadsheet className="h-5 w-5" />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <h4
                                    className="text-xs font-bold text-white font-mono truncate group-hover:text-emerald-300 transition-colors"
                                    title={file.filename || file.name}
                                  >
                                    {file.filename || file.name}
                                  </h4>
                                  <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-slate-400">
                                    <span className="px-1 py-0.2 rounded bg-[#1e293b] text-slate-300 font-bold uppercase">
                                      CSV
                                    </span>
                                    <span>{file.fileSizeFormatted || "Unknown size"}</span>
                                    <span>•</span>
                                    <span>{formatAge(file.updatedAt || file.createdAt)}</span>
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenContextMenu(e, "file", undefined, undefined, file);
                                }}
                                className="p-1 rounded-lg hover:bg-slate-700/60 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
                                title="File options"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </div>

                            {/* Enriched Pill & Tags */}
                            <div className="flex items-center gap-1.5 mt-3">
                              {isEnriched ? (
                                <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
                                  <Mail className="h-2.5 w-2.5" /> Enriched ({file.emailCount} emails)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
                                  Raw Scrape
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Footer: Leads count & Click to preview */}
                          <div className="mt-4 pt-3 border-t border-[#1e293b]/60 flex items-center justify-between text-xs font-mono">
                            <span className="text-slate-300 flex items-center gap-1">
                              <Layers className="h-3.5 w-3.5 text-indigo-400" />
                              <strong className="text-white">{file.leadCount}</strong> leads
                            </span>

                            <span className="text-[11px] text-emerald-400 group-hover:translate-x-0.5 transition-transform font-bold flex items-center gap-1">
                              Open File →
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* ─── DETAILS TABLE VIEW (Windows Explorer Details Style) ─── */
                  <div className="overflow-x-auto rounded-xl border border-[#1e293b] bg-[#070b14]">
                    <table className="w-full text-left font-mono text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-[#1e293b] text-[10px] text-slate-400 uppercase tracking-wider bg-[#0f172a]/60">
                          <th className="py-2.5 px-3">Name</th>
                          <th className="py-2.5 px-3">Date Modified</th>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3">Size</th>
                          <th className="py-2.5 px-3">Leads</th>
                          <th className="py-2.5 px-3">Emails</th>
                          <th className="py-2.5 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1e293b]/50 text-slate-300">
                        {displayedFiles.map((file) => {
                          const isEnriched = file.filename.endsWith("_emails.csv") || file.emailCount > 0;
                          return (
                            <tr
                              key={file.id}
                              onClick={() => setSelectedFolderId(file.filename || file.id)}
                              onContextMenu={(e) => handleOpenContextMenu(e, "file", undefined, undefined, file)}
                              className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                            >
                              <td className="py-2 px-3 font-bold text-white flex items-center gap-2 max-w-[260px] truncate">
                                <FileSpreadsheet className={`h-4 w-4 shrink-0 ${isEnriched ? "text-emerald-400" : "text-indigo-400"}`} />
                                <span className="truncate group-hover:text-emerald-300">{file.filename || file.name}</span>
                              </td>
                              <td className="py-2 px-3 text-slate-400 whitespace-nowrap text-[11px]">
                                {formatAge(file.updatedAt || file.createdAt)}
                              </td>
                              <td className="py-2 px-3 text-[11px] text-slate-400">
                                {isEnriched ? "Enriched Leads CSV" : "Scraped Leads CSV"}
                              </td>
                              <td className="py-2 px-3 text-[11px] text-slate-400 whitespace-nowrap">
                                {file.fileSizeFormatted || "-"}
                              </td>
                              <td className="py-2 px-3 font-bold text-white whitespace-nowrap">
                                {file.leadCount}
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap">
                                <span className={file.emailCount > 0 ? "text-emerald-400 font-bold" : "text-slate-500"}>
                                  {file.emailCount}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-1.5">
                                  <span className="text-[11px] text-indigo-400 group-hover:text-emerald-300 font-bold">
                                    Preview →
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenContextMenu(e, "file", undefined, undefined, file);
                                    }}
                                    className="p-1 rounded-lg hover:bg-slate-700/60 text-slate-400 hover:text-white transition-colors cursor-pointer"
                                    title="File options"
                                  >
                                    <MoreVertical className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* =========================================================================
            VIEW 2: FILE PREVIEW PANEL (When a CSV file is selected)
            Features: Full width table + Toggle File Statistics
           ========================================================================= */
        <div className="space-y-4">
          {/* Top Bar: Back Button, File Heading, View Stats Toggle, Export & Outreach */}
          <div className="bg-[#090d16] border border-[#1e293b] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedFolderId(null)}
                className="px-3 py-2 rounded-xl bg-[#030712] hover:bg-slate-800/60 border border-[#1e293b] text-slate-300 hover:text-white text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5 text-emerald-400" /> Back to File Explorer
              </button>

              <div className="h-6 w-px bg-[#1e293b] hidden sm:block" />

              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <FileSpreadsheet className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2 truncate">
                    <span className="truncate">{selectedFolder?.filename || selectedFolderId}</span>
                    {selectedFolder?.filename.endsWith("_emails.csv") && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase font-mono shrink-0">
                        Enriched
                      </span>
                    )}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                    <span>{selectedFolder?.fileSizeFormatted || "CSV Data"}</span>
                    <span>•</span>
                    <span>{previewLeads.length} leads loaded</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions Toolbar */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* TOGGLE FILE STATISTICS BUTTON */}
              <button
                onClick={() => setShowFileStats(!showFileStats)}
                className={`px-3 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                  showFileStats
                    ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20"
                    : "bg-[#030712] hover:bg-slate-800/40 text-slate-300 border-[#1e293b]"
                }`}
              >
                <BarChart2 className="h-3.5 w-3.5 text-indigo-400" />
                <span>{showFileStats ? "Hide Statistics" : "View File Statistics"}</span>
              </button>

              <button
                onClick={downloadCSV}
                disabled={previewLeads.length === 0}
                className="px-3 py-2 bg-[#030712] hover:bg-slate-800/40 text-slate-300 border border-[#1e293b] text-xs font-mono rounded-xl cursor-pointer flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" /> Export CSV
              </button>

              <button
                onClick={() => {
                  if (selectedFolder) handleDeleteCsvFile(selectedFolder);
                  else if (selectedFolderId) handleDeleteCsvFile({ filename: selectedFolderId, name: selectedFolderId } as any);
                }}
                className="px-3 py-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 text-xs font-mono rounded-xl cursor-pointer flex items-center gap-1.5 transition-all"
                title="Delete this CSV file"
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-400" /> Delete File
              </button>

              <button
                onClick={() => setActiveTab("outreach")}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold rounded-xl cursor-pointer flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20"
              >
                <Send className="h-3.5 w-3.5" /> Launch Outreach
              </button>
            </div>
          </div>

          {/* TOGGLEABLE FILE STATISTICS PANEL (Collapsible Banner above table) */}
          {showFileStats && (
            <div className="bg-[#090d16] border border-indigo-500/30 rounded-2xl p-5 shadow-xl space-y-4 animate-in fade-in slide-in-from-top-3">
              <div className="flex items-center justify-between pb-3 border-b border-[#1e293b]">
                <div className="flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-indigo-400" />
                  <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                    File Statistics & Quick Filters
                  </h4>
                </div>
                <button
                  onClick={() => setShowFileStats(false)}
                  className="text-slate-400 hover:text-white text-xs font-mono flex items-center gap-1 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" /> Close
                </button>
              </div>

              {/* Stats Metrics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#030712] border border-[#1e293b] rounded-xl p-3">
                  <span className="text-[10px] text-slate-400 uppercase font-mono flex items-center gap-1 mb-1">
                    <Layers className="h-3 w-3 text-indigo-400" /> Total Leads
                  </span>
                  <span className="text-lg font-bold font-mono text-white">
                    {selectedFolder?.leadCount || previewLeads.length}
                  </span>
                </div>

                <div className="bg-[#030712] border border-emerald-500/30 rounded-xl p-3">
                  <span className="text-[10px] text-emerald-400 uppercase font-mono flex items-center gap-1 mb-1">
                    <Mail className="h-3 w-3 text-emerald-400" /> Emails Found
                  </span>
                  <span className="text-lg font-bold font-mono text-emerald-300">
                    {selectedFolder?.emailCount !== undefined ? selectedFolder.emailCount : previewLeads.filter(l => l.emails?.length).length}
                  </span>
                </div>

                <div className="bg-[#030712] border border-sky-500/30 rounded-xl p-3">
                  <span className="text-[10px] text-sky-400 uppercase font-mono flex items-center gap-1 mb-1">
                    <Phone className="h-3 w-3 text-sky-400" /> Phone Numbers
                  </span>
                  <span className="text-lg font-bold font-mono text-sky-300">
                    {selectedFolder?.phoneCount !== undefined ? selectedFolder.phoneCount : previewLeads.filter(l => l.phone).length}
                  </span>
                </div>

                <div className="bg-[#030712] border border-rose-500/30 rounded-xl p-3">
                  <span className="text-[10px] text-rose-400 uppercase font-mono flex items-center gap-1 mb-1">
                    <Flame className="h-3 w-3 text-rose-400" /> Hot Leads
                  </span>
                  <span className="text-lg font-bold font-mono text-rose-300">
                    {selectedFolder?.hotCount !== undefined ? selectedFolder.hotCount : previewLeads.filter(l => l.leadPriority === "HOT").length}
                  </span>
                </div>
              </div>

              {/* In-File Filters */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={() => setEmailOnlyFilter(!emailOnlyFilter)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
                    emailOnlyFilter
                      ? "bg-emerald-600/20 text-emerald-300 border-emerald-500/50 font-bold"
                      : "bg-[#030712] text-slate-400 border-[#1e293b] hover:text-white"
                  }`}
                >
                  <Mail className="h-3.5 w-3.5 text-emerald-400" /> Has Email Only
                  {emailOnlyFilter && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 uppercase font-mono">Priority:</span>
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="text-xs bg-[#030712] border border-[#1e293b] rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500 font-mono cursor-pointer"
                  >
                    <option value="ALL">All Priorities</option>
                    <option value="HOT">HOT Priority</option>
                    <option value="WARM">WARM Priority</option>
                    <option value="COLD">COLD Priority</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Bulk Action Bar (when rows are selected) */}
          {selectedLeadKeys.size > 0 && (
            <div className="bg-indigo-950/40 border border-indigo-500/40 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2 text-xs font-mono text-indigo-200">
                <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse"></span>
                <span>
                  <strong>{selectedLeadKeys.size}</strong> of {previewLeads.length} leads selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBulkDelete}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold rounded-lg cursor-pointer flex items-center gap-1.5 transition-all shadow-md shadow-rose-600/20"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete Selected ({selectedLeadKeys.size})
                </button>
                <button
                  onClick={() => setSelectedLeadKeys(new Set())}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono rounded-lg cursor-pointer transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* FULL WIDTH PAGINATED LEADS TABLE (No permanent side clutter!) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className={`space-y-4 ${selectedLeadDetails ? "lg:col-span-8" : "lg:col-span-12"}`}>
              <div className="bg-[#090d16] border border-[#1e293b] rounded-2xl p-5 space-y-4 shadow-xl">
                {/* Table Toolbar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="relative flex-grow max-w-sm">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search within this CSV..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full text-xs bg-[#030712] border border-[#1e293b] rounded-xl pl-9 pr-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleShowAllColumns}
                      className={`px-3 py-1.5 text-xs font-mono rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer ${
                        visibleColumns.length === ALL_LEAD_COLUMNS.length
                          ? "bg-indigo-600/20 text-indigo-300 border-indigo-500/40 font-bold"
                          : "bg-[#030712] text-slate-300 border-[#1e293b] hover:bg-slate-800/40"
                      }`}
                    >
                      <Eye className="h-3.5 w-3.5 text-indigo-400" />
                      <span>{visibleColumns.length === ALL_LEAD_COLUMNS.length ? "Default Cols" : "All Cols"}</span>
                    </button>

                    <div className="relative">
                      <button
                        onClick={() => setShowColumnModal(!showColumnModal)}
                        className={`px-3 py-1.5 text-xs font-mono rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer ${
                          showColumnModal
                            ? "bg-indigo-600 text-white border-indigo-500 font-bold"
                            : "bg-[#030712] text-slate-300 border-[#1e293b] hover:bg-slate-800/40"
                        }`}
                      >
                        <Columns className="h-3.5 w-3.5 text-indigo-400" />
                        <span>Columns</span>
                        <ChevronDown className={`h-3 w-3 transition-transform ${showColumnModal ? "rotate-180" : ""}`} />
                      </button>
                      <ColumnCustomizerModal />
                    </div>
                  </div>
                </div>

                {/* Table */}
                {isLoadingCsvData ? (
                  <div className="py-20 text-center space-y-3">
                    <Loader2 className="h-8 w-8 text-emerald-400 animate-spin mx-auto" />
                    <p className="text-xs font-mono text-slate-400">Loading records from CSV...</p>
                  </div>
                ) : paginatedLeads.length === 0 ? (
                  <div className="py-16 text-center text-slate-500 text-xs font-mono">
                    No leads match your current search or filter.
                  </div>
                ) : (
                  <div className="overflow-x-auto overflow-y-auto max-h-[580px] min-w-full rounded-xl border border-[#1e293b]/60 relative scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900/40">
                    <table className="w-full text-left font-mono border-collapse min-w-max text-xs">
                      <thead className="sticky top-0 z-10 bg-[#090d16] shadow-sm backdrop-blur-md">
                        <tr className="border-b border-[#1e293b] text-[10px] text-slate-400 uppercase tracking-wider bg-[#090d16]">
                          <th className="py-3 px-2.5 w-8 bg-[#090d16]">
                            <input
                              type="checkbox"
                              checked={previewLeads.length > 0 && selectedLeadKeys.size === previewLeads.length}
                              onChange={toggleSelectAll}
                              className="rounded border-[#1e293b] bg-[#030712] text-indigo-600 focus:ring-indigo-500/20 h-3.5 w-3.5 cursor-pointer"
                              title="Select all leads"
                            />
                          </th>
                          {ALL_LEAD_COLUMNS.filter((col) => visibleColumns.includes(col.id)).map((col) => (
                            <th key={col.id} className="py-3 px-3 font-semibold bg-[#090d16]">
                              {col.label}
                            </th>
                          ))}
                          <th className="py-3 px-3 text-right bg-[#090d16]">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1e293b]/60 text-slate-300">
                        {paginatedLeads.map((lead) => {
                          const leadKey = `${lead.businessName}_${lead.address}`;
                          const isSelected = selectedLeadKeys.has(leadKey);

                          return (
                            <tr
                              key={leadKey}
                              onClick={() => setSelectedLeadDetails(lead)}
                              className={`hover:bg-slate-800/30 transition-colors cursor-pointer group ${
                                isSelected ? "bg-indigo-950/20" : ""
                              }`}
                            >
                              <td className="py-2.5 px-2.5" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleLeadSelection(leadKey)}
                                  className="rounded border-[#1e293b] bg-[#030712] text-indigo-600 focus:ring-indigo-500/20 h-3.5 w-3.5 cursor-pointer"
                                />
                              </td>

                              {visibleColumns.includes("priority") && (
                                <td className="py-2.5 px-3">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      lead.leadPriority === "HOT"
                                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                        : lead.leadPriority === "WARM"
                                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                        : "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                                    }`}
                                  >
                                    {lead.leadPriority}
                                  </span>
                                </td>
                              )}

                              {visibleColumns.includes("businessName") && (
                                <td className="py-2.5 px-3 font-bold text-white max-w-[200px] truncate" title={lead.businessName}>
                                  {lead.businessName}
                                </td>
                              )}

                              {visibleColumns.includes("rating") && (
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  {lead.rating ? (
                                    <span className="text-amber-400 font-sans">
                                      ⭐ {lead.rating} <span className="text-slate-500 text-[10px]">({lead.reviews || 0})</span>
                                    </span>
                                  ) : (
                                    <span className="text-slate-600">-</span>
                                  )}
                                </td>
                              )}

                              {visibleColumns.includes("phone") && (
                                <td className="py-2.5 px-3 whitespace-nowrap text-slate-300">
                                  {lead.phone || <span className="text-slate-600">-</span>}
                                </td>
                              )}

                              {visibleColumns.includes("emails") && (
                                <td className="py-2.5 px-3 max-w-[220px] truncate">
                                  {lead.emails && lead.emails.length > 0 ? (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" title={lead.emails.join(", ")}>
                                      {lead.emails[0]}
                                      {lead.emails.length > 1 && ` (+${lead.emails.length - 1})`}
                                    </span>
                                  ) : (
                                    <span className="text-slate-600">-</span>
                                  )}
                                </td>
                              )}

                              {visibleColumns.includes("website") && (
                                <td className="py-2.5 px-3 max-w-[160px] truncate">
                                  {lead.website ? (
                                    <a
                                      href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-sky-400 hover:underline flex items-center gap-1"
                                    >
                                      <span className="truncate">{lead.website.replace(/^https?:\/\//, "")}</span>
                                      <ExternalLink className="h-3 w-3 shrink-0" />
                                    </a>
                                  ) : (
                                    <span className="text-slate-600">-</span>
                                  )}
                                </td>
                              )}

                              {visibleColumns.includes("address") && (
                                <td className="py-2.5 px-3 max-w-[180px] truncate text-slate-400" title={lead.address}>
                                  {lead.address || "-"}
                                </td>
                              )}

                              {visibleColumns.includes("category") && (
                                <td className="py-2.5 px-3 max-w-[140px] truncate text-slate-400">
                                  {lead.category || "-"}
                                </td>
                              )}

                              {visibleColumns.includes("leadScore") && (
                                <td className="py-2.5 px-3">
                                  <span className="text-xs font-bold text-indigo-400">{lead.leadScore}</span>
                                </td>
                              )}

                              {/* Outreach & Actions */}
                              <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleOpenOutreach(lead)}
                                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                    title="Open Outreach Modal"
                                  >
                                    <Send className="h-2.5 w-2.5" /> Pitch
                                  </button>
                                  <button
                                    onClick={() => handleDeleteLead(lead)}
                                    className="p-1 hover:bg-rose-950/40 text-slate-500 hover:text-rose-400 rounded transition-colors cursor-pointer"
                                    title="Delete Lead"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pagination Controls */}
                {totalFiltered > 0 && (
                  <div className="pt-3 border-t border-[#1e293b] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-slate-400">
                    <div className="flex items-center gap-2">
                      <span>Showing {startIndex + 1} to {endIndex} of {totalFiltered} leads</span>
                      <span className="text-slate-600">•</span>
                      <span>Page {safeCurrentPage} of {totalPages}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={pageSize}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                        className="bg-[#030712] border border-[#1e293b] rounded-lg px-2 py-1 text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
                      >
                        <option value={10}>10 per page</option>
                        <option value={25}>25 per page</option>
                        <option value={50}>50 per page</option>
                        <option value={100}>100 per page</option>
                        <option value={-1}>All ({totalFiltered})</option>
                      </select>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setCurrentPage(1)}
                          disabled={safeCurrentPage <= 1}
                          className="p-1 rounded-lg border border-[#1e293b] bg-[#030712] text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                        >
                          <ChevronsLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={safeCurrentPage <= 1}
                          className="p-1 rounded-lg border border-[#1e293b] bg-[#030712] text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <span className="px-2 py-1 text-xs text-white font-bold bg-[#030712] border border-[#1e293b] rounded-lg">
                          {safeCurrentPage}
                        </span>
                        <button
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={safeCurrentPage >= totalPages}
                          className="p-1 rounded-lg border border-[#1e293b] bg-[#030712] text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setCurrentPage(totalPages)}
                          disabled={safeCurrentPage >= totalPages}
                          className="p-1 rounded-lg border border-[#1e293b] bg-[#030712] text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                        >
                          <ChevronsRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Lead Detail Panel (if row clicked) */}
            {selectedLeadDetails && (
              <div className="lg:col-span-4">
                <LeadDetailCard />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sleek Native Context Menu for Folders and Files */}
      {contextMenu.visible && (
        <div
          style={{
            top: Math.min(contextMenu.y, typeof window !== "undefined" ? window.innerHeight - 180 : contextMenu.y),
            left: Math.min(contextMenu.x, typeof window !== "undefined" ? window.innerWidth - 230 : contextMenu.x)
          }}
          className="fixed z-50 w-56 bg-[#090d16]/95 backdrop-blur-md border border-[#1e293b] rounded-xl shadow-2xl py-1 font-mono text-xs text-slate-200 animate-in fade-in zoom-in-95 duration-100 divide-y divide-[#1e293b]/60"
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === "folder" ? (
            <>
              <div className="px-3 py-2 text-[10px] uppercase font-bold text-slate-400 flex items-center gap-2 truncate">
                <Folder className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span className="truncate">{contextMenu.folderName || "Folder"}</span>
              </div>
              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveVirtualFolder(contextMenu.folderType || null);
                    setContextMenu((prev) => ({ ...prev, visible: false }));
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-800 text-slate-200 hover:text-white flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <FolderOpen className="h-3.5 w-3.5 text-amber-400" />
                  <span>View / Open Folder</span>
                </button>
              </div>
              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    setContextMenu((prev) => ({ ...prev, visible: false }));
                    handleDeleteFolder(contextMenu.folderType, contextMenu.folderName);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-rose-950/60 text-rose-400 hover:text-rose-300 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                  <span>Delete Folder</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="px-3 py-2 text-[10px] uppercase font-bold text-slate-400 flex items-center gap-2 truncate">
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">{contextMenu.file?.filename || contextMenu.file?.name}</span>
              </div>
              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    if (contextMenu.file) setSelectedFolderId(contextMenu.file.filename || contextMenu.file.id);
                    setContextMenu((prev) => ({ ...prev, visible: false }));
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-800 text-slate-200 hover:text-white flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Eye className="h-3.5 w-3.5 text-indigo-400" />
                  <span>View / Open File</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (contextMenu.file) {
                      setSelectedFolderId(contextMenu.file.filename || contextMenu.file.id);
                      setActiveTab("outreach");
                    }
                    setContextMenu((prev) => ({ ...prev, visible: false }));
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-800 text-slate-200 hover:text-white flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Send className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Launch Outreach</span>
                </button>
              </div>
              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    setContextMenu((prev) => ({ ...prev, visible: false }));
                    if (contextMenu.file) handleDeleteCsvFile(contextMenu.file);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-rose-950/60 text-rose-400 hover:text-rose-300 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                  <span>Delete File</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
