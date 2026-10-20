/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from "fs";
import path from "path";
import { Lead } from "../../types";
import { logger } from "../../utils/logger";

const dataDir = path.join(process.cwd(), "data");
const dataJsonPath = path.join(dataDir, "leads.json");
const dataCsvPath = path.join(dataDir, "leads.csv");
const legacyJsonPath = path.join(process.cwd(), "processed-leads.json");

function ensureDataDir(): void {
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  } catch (err) {
    logger.error("Failed to ensure data/ directory", err);
  }
}

/**
 * Converts lead objects into CSV format with full metadata
 */
export function convertLeadsToCsv(leads: Lead[]): string {
  const headers = [
    "Business Name",
    "Category",
    "Phone",
    "Address",
    "Website",
    "Website Status",
    "Rating",
    "Reviews",
    "Lead Score",
    "Lead Priority",
    "Outdated Reason",
    "AI Insight",
    "Emails",
    "Instagram",
    "Facebook",
    "LinkedIn",
    "Twitter",
    "WhatsApp Status",
    "Email Status",
    "Google Maps URL",
    "Place ID",
    "Latitude",
    "Longitude",
    "Sheet Name",
    "Date Added"
  ];

  const escapeCsv = (val: any): string => {
    if (val === null || val === undefined) return "";
    let str = Array.isArray(val) ? val.join("; ") : String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      str = `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = leads.map(l => [
    escapeCsv(l.businessName),
    escapeCsv(l.category || ""),
    escapeCsv(l.phone || ""),
    escapeCsv(l.address || ""),
    escapeCsv(l.website || ""),
    escapeCsv(l.websiteStatus || ""),
    escapeCsv(l.rating ?? ""),
    escapeCsv(l.reviews ?? ""),
    escapeCsv(l.leadScore ?? ""),
    escapeCsv(l.leadPriority || ""),
    escapeCsv(l.outdatedReason || ""),
    escapeCsv(l.aiInsight || ""),
    escapeCsv(l.emails || []),
    escapeCsv(l.instagramUrl || ""),
    escapeCsv(l.facebookUrl || ""),
    escapeCsv(l.linkedinUrl || ""),
    escapeCsv((l as any).twitterUrl || ""),
    escapeCsv(l.whatsappStatus || ""),
    escapeCsv(l.emailStatus || ""),
    escapeCsv(l.mapsUrl || ""),
    escapeCsv((l as any).placeId || ""),
    escapeCsv(l.lat ?? ""),
    escapeCsv(l.lng ?? ""),
    escapeCsv(l.sheetName || ""),
    escapeCsv(l.dateAdded || "")
  ].join(","));

  return [headers.join(","), ...rows].join("\n");
}

/**
 * Normalizes a string by lowercasing and removing non-alphanumeric chars for robust lookup
 */
function createKey(name: string, address: string): string {
  const cleanName = (name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const cleanAddress = (address || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${cleanName}_${cleanAddress}`;
}

export const duplicateChecker = {
  /**
   * Loads all leads from project data folder (data/leads.json, fallback to processed-leads.json)
   */
  loadLeads: (): Lead[] => {
    ensureDataDir();
    try {
      // 1. Primary: data/leads.json
      if (fs.existsSync(dataJsonPath)) {
        const content = fs.readFileSync(dataJsonPath, "utf8");
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) return parsed as Lead[];
      }
      
      // 2. Fallback / migration: processed-leads.json
      if (fs.existsSync(legacyJsonPath)) {
        const content = fs.readFileSync(legacyJsonPath, "utf8");
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          // Sync to data/ folder
          duplicateChecker.saveAll(parsed as Lead[]);
          return parsed as Lead[];
        }
      }
    } catch (error) {
      logger.error("Failed to read leads data, starting fresh", error);
    }
    return [];
  },

  /**
   * Checks if a lead has already been processed based on Name + Address key
   */
  isDuplicate: (name: string, address: string): boolean => {
    const leads = duplicateChecker.loadLeads();
    const targetKey = createKey(name, address);
    return leads.some(lead => createKey(lead.businessName, lead.address) === targetKey);
  },

  /**
   * Saves an entire array of leads to both data/leads.json, data/leads.csv, and processed-leads.json
   */
  saveAll: (leads: Lead[]): void => {
    ensureDataDir();
    try {
      const jsonContent = JSON.stringify(leads, null, 2);
      fs.writeFileSync(dataJsonPath, jsonContent, "utf8");
      fs.writeFileSync(legacyJsonPath, jsonContent, "utf8");
      
      const csvContent = convertLeadsToCsv(leads);
      fs.writeFileSync(dataCsvPath, csvContent, "utf8");
    } catch (error) {
      logger.error("Failed to persist leads into data/ directory", error);
    }
  },

  /**
   * Adds and saves a new processed lead to data/leads.json & data/leads.csv
   */
  saveLead: (lead: Lead): void => {
    const leads = duplicateChecker.loadLeads();
    const leadKey = createKey(lead.businessName, lead.address);
    const exists = leads.some(l => createKey(l.businessName, l.address) === leadKey);

    if (!exists) {
      leads.push(lead);
      duplicateChecker.saveAll(leads);
      logger.info(`Lead saved to data/leads.json & data/leads.csv: ${lead.businessName}`);
    }
  },

  /**
   * Saves a dedicated scrape batch CSV file into data/<batchName>.csv
   */
  saveBatchCsv: (batchName: string, batchLeads: Lead[]): string => {
    ensureDataDir();
    try {
      const cleanName = batchName.replace(/[^a-zA-Z0-9_-]/g, "_");
      const filename = cleanName.toLowerCase().endsWith(".csv") ? cleanName : `${cleanName}.csv`;
      const filePath = path.join(dataDir, filename);
      const csvContent = convertLeadsToCsv(batchLeads);
      fs.writeFileSync(filePath, csvContent, "utf8");
      logger.success(`Batch scrape leads saved to data/${filename} (${batchLeads.length} leads)`);
      return filename;
    } catch (err) {
      logger.error(`Failed to save batch CSV ${batchName}`, err);
      return "";
    }
  },

  /**
   * Deletes a lead by businessName and optional address/mapsUrl
   */
  deleteLead: (businessName: string, address?: string, mapsUrl?: string): Lead[] => {
    const leads = duplicateChecker.loadLeads();
    const targetKey = address ? createKey(businessName, address) : null;
    
    const filtered = leads.filter(lead => {
      if (mapsUrl && lead.mapsUrl && lead.mapsUrl === mapsUrl) return false;
      if (targetKey && createKey(lead.businessName, lead.address) === targetKey) return false;
      if (!address && lead.businessName.toLowerCase().trim() === businessName.toLowerCase().trim()) return false;
      return true;
    });

    duplicateChecker.saveAll(filtered);
    logger.info(`Lead deleted: ${businessName}. Remaining leads: ${filtered.length}`);
    return filtered;
  },

  /**
   * Bulk deletes multiple leads
   */
  deleteLeads: (items: Array<{ businessName: string; address?: string; mapsUrl?: string }>): Lead[] => {
    const leads = duplicateChecker.loadLeads();
    const removeKeys = new Set(items.map(it => createKey(it.businessName, it.address || "")));
    const removeUrls = new Set(items.map(it => it.mapsUrl).filter(Boolean));

    const filtered = leads.filter(lead => {
      if (lead.mapsUrl && removeUrls.has(lead.mapsUrl)) return false;
      if (removeKeys.has(createKey(lead.businessName, lead.address))) return false;
      return true;
    });

    duplicateChecker.saveAll(filtered);
    logger.info(`Bulk deleted ${leads.length - filtered.length} leads. Remaining: ${filtered.length}`);
    return filtered;
  }
};
