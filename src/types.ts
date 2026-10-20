/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Lead {
  businessName: string;
  phone: string;
  address: string;
  rating: number;
  reviews: number;
  website: string;
  mapsUrl: string;
  category: string;
  websiteMissing: boolean;
  leadScore: number;
  dateAdded: string;
  sheetName?: string;

  // Digital Presence fields
  websiteStatus: "MISSING" | "WORKING" | "BROKEN" | "OUTDATED";
  outdatedReason?: string;
  redesignOpportunity?: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  instagramUrl: string;
  instagramStatus: "NOT_FOUND" | "ACTIVE" | "INACTIVE";
  instagramLastPost: string;
  facebookUrl: string;
  facebookStatus: "NOT_FOUND" | "ACTIVE" | "INACTIVE";
  facebookLastPost: string;
  whatsappPresent: boolean;
  appointmentSystem: boolean;
  leadPriority: "HOT" | "WARM" | "COLD";
  aiInsight: string;

  // Expanded Auditing fields
  emails: string[];
  linkedinUrl: string;
  linkedinStatus: "NOT_FOUND" | "ACTIVE";
  googleAnalyticsPresent: boolean;
  metaPixelPresent: boolean;

  // Outreach tracking fields
  emailStatus?: "PENDING" | "SENT" | "FAILED";
  whatsappStatus?: "PENDING" | "SENT" | "FAILED";
  emailSentDate?: string;
  whatsappSentDate?: string;
  lat?: number;
  lng?: number;
}

export interface Config {
  businessType: string;
  location: string;
  maxResults: number;
  enableSimulation: boolean;
  headless: boolean;
  lat?: number;
  lng?: number;
  radius?: number;
  // Scraper filter flags
  scrapeWebsite?: boolean;        // visit website to extract emails and technical indicators
  scrapeSocialMedia: boolean;     // run Instagram / Facebook / LinkedIn analyzers
  finderMode?: "all" | "noWebsite" | "outdatedWebsite";  // lead finder search mode
}

// ─── Campaign Hub Types ────────────────────────────────────────────────────────
export type { CampaignGoal, PitchStrategy } from "./outreachCopy";
export type CampaignType = "localData" | "outreach" | "job" | "business";

export interface TemplateVariable {
  key: string;
  label: string;
}

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  { key: "{businessName}", label: "Business Name" },
  { key: "{phone}", label: "Phone Number" },
  { key: "{email}", label: "Email Address" },
  { key: "{address}", label: "Address" },
  { key: "{rating}", label: "Rating" },
  { key: "{reviews}", label: "Review Count" },
  { key: "{website}", label: "Website URL" },
  { key: "{category}", label: "Category / Industry" },
  { key: "{senderName}", label: "Sender Name (override)" },
  { key: "{roleTitle}", label: "Role / Title" },
  { key: "{skills}", label: "Skills" },
  { key: "{portfolioUrl}", label: "Portfolio / Link" },
  { key: "(ignore)", label: "— Ignore this column —" },
];

export const AUTO_DETECT_MAP: Record<string, string> = {
  name: "{businessName}",
  business: "{businessName}",
  company: "{businessName}",
  phone: "{phone}",
  mobile: "{phone}",
  contact: "{phone}",
  email: "{email}",
  mail: "{email}",
  address: "{address}",
  location: "{address}",
  city: "{address}",
  rating: "{rating}",
  star: "{rating}",
  review: "{reviews}",
  site: "{website}",
  web: "{website}",
  url: "{website}",
  category: "{category}",
  industry: "{category}",
  type: "{category}",
  skill: "{skills}",
  role: "{roleTitle}",
  title: "{roleTitle}",
  portfolio: "{portfolioUrl}",
};

export function autoDetectMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  headers.forEach(h => {
    const lower = h.toLowerCase();
    const match = Object.entries(AUTO_DETECT_MAP).find(([key]) => lower.includes(key));
    mapping[h] = match ? match[1] : "(ignore)";
  });
  return mapping;
}

export function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuote = !inQuote; }
      } else if (ch === "," && !inQuote) {
        result.push(cur.trim()); cur = "";
      } else {
        cur += ch;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(line => {
    const vals = parseRow(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
    return obj;
  }).filter(row => Object.values(row).some(v => v !== ""));

  return { headers, rows };
}

export function serializeCSV(headers: string[], rows: Record<string, any>[]): string {
  const escapeVal = (v: any) => {
    if (v === null || v === undefined) return "";
    const str = String(v);
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.map(escapeVal).join(",");
  const dataLines = rows.map(row => headers.map(h => escapeVal(row[h] ?? "")).join(","));
  return [headerLine, ...dataLines].join("\n");
}

export interface ColumnDef {
  id: string;
  label: string;
  defaultVisible: boolean;
  minWidth?: string;
  align?: "left" | "center" | "right";
  category?: string;
}

export const ALL_LEAD_COLUMNS: ColumnDef[] = [
  { id: "businessName", label: "Lead Name", defaultVisible: true, minWidth: "220px", align: "left", category: "Core" },
  { id: "phone", label: "Phone Number", defaultVisible: true, minWidth: "145px", align: "left", category: "Contact" },
  { id: "leadScore", label: "Score", defaultVisible: true, minWidth: "75px", align: "center", category: "Qualification" },
  { id: "leadPriority", label: "Priority", defaultVisible: true, minWidth: "85px", align: "center", category: "Qualification" },
  { id: "websiteStatus", label: "Website Status", defaultVisible: true, minWidth: "155px", align: "left", category: "Audit" },
  { id: "website", label: "Website URL", defaultVisible: false, minWidth: "160px", align: "left", category: "Audit" },
  { id: "category", label: "Category / Niche", defaultVisible: false, minWidth: "140px", align: "left", category: "Core" },
  { id: "emails", label: "Emails", defaultVisible: true, minWidth: "185px", align: "left", category: "Contact" },
  { id: "rating", label: "Rating & Reviews", defaultVisible: false, minWidth: "135px", align: "left", category: "Core" },
  { id: "outdatedReason", label: "AI Audit Reason", defaultVisible: false, minWidth: "220px", align: "left", category: "Audit" },
  { id: "redesignOpportunity", label: "Redesign Opp", defaultVisible: false, minWidth: "115px", align: "center", category: "Audit" },
  { id: "socials", label: "Socials (IG/FB/LN)", defaultVisible: true, minWidth: "120px", align: "center", category: "Social" },
  { id: "whatsappPresent", label: "WhatsApp", defaultVisible: false, minWidth: "90px", align: "center", category: "Contact" },
  { id: "appointmentSystem", label: "Booking System", defaultVisible: false, minWidth: "110px", align: "center", category: "Audit" },
  { id: "analytics", label: "GA4 / Pixel", defaultVisible: false, minWidth: "100px", align: "center", category: "Audit" },
  { id: "aiInsight", label: "AI Sales Insight", defaultVisible: false, minWidth: "240px", align: "left", category: "AI" },
  { id: "address", label: "Full Address", defaultVisible: false, minWidth: "200px", align: "left", category: "Core" },
  { id: "dateAdded", label: "Date Added", defaultVisible: false, minWidth: "100px", align: "left", category: "Core" },
  { id: "actions", label: "Actions", defaultVisible: true, minWidth: "175px", align: "right", category: "Action" },
];

export const DEFAULT_VISIBLE_COLUMN_IDS = ALL_LEAD_COLUMNS.filter(c => c.defaultVisible).map(c => c.id);

export const MAP_TILE_CONFIGS = {
  satellite: {
    url: "https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
    options: {
      subdomains: ["0", "1", "2", "3"],
      attribution: "&copy; Google Satellite Imagery (India)",
      maxZoom: 20
    }
  },
  dark: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    options: {
      attribution: "&copy; Esri &mdash; Esri, DeLorme, NAVTEQ",
      maxZoom: 19,
      maxNativeZoom: 16
    }
  },
  street: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    options: {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19
    }
  }
};

// ─── Data Folders & Batches Types ──────────────────────────────────────────────
export interface DataFolder {
  id: string;
  name: string;
  filename: string;
  filepath?: string;
  fileSizeBytes?: number;
  fileSizeFormatted?: string;
  type: "csv" | "master" | "sheet" | "batch" | "category";
  leadCount: number;
  phoneCount: number;
  emailCount: number;
  hotCount: number;
  createdAt: string; // ISO date string or formatted string
  updatedAt: string; // ISO date string or formatted string
  description?: string;
  sheetName?: string;
  category?: string;
  location?: string;
}

export type FolderDateFilter = "ALL" | "TODAY" | "THIS_WEEK" | "THIS_MONTH" | "OLDER";
export type FolderSortOption = "LATEST" | "OLDEST" | "MOST_LEADS" | "ALPHABETICAL" | "NAME";

export * from "./services/outreach/outreachCopy";

