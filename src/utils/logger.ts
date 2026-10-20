/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from "fs";
import path from "path";

const scraperLogPath = path.join(process.cwd(), "scraper-log.txt");
const campaignLogPath = path.join(process.cwd(), "campaign-log.txt");

try {
  if (!fs.existsSync(scraperLogPath)) {
    fs.writeFileSync(scraperLogPath, `[${new Date().toISOString()}] Scraper Logger Initialized\n`);
  }
  if (!fs.existsSync(campaignLogPath)) {
    fs.writeFileSync(campaignLogPath, `[${new Date().toISOString()}] Campaign Outreach Logger Initialized\n`);
  }
} catch (e) {}

function createLoggerInstance(filePath: string, prefix: string) {
  return {
    log: (message: string) => {
      const formatted = `[${new Date().toLocaleTimeString()}] ${message}`;
      console.log(formatted);
      try {
        fs.appendFileSync(filePath, formatted + "\n");
      } catch (e) {}
    },
    info: (message: string) => {
      const formatted = `[${new Date().toLocaleTimeString()}] INFO: ${message}`;
      console.log(formatted);
      try {
        fs.appendFileSync(filePath, formatted + "\n");
      } catch (e) {}
    },
    success: (message: string) => {
      const formatted = `[${new Date().toLocaleTimeString()}] SUCCESS: ${message}`;
      console.log(formatted);
      try {
        fs.appendFileSync(filePath, formatted + "\n");
      } catch (e) {}
    },
    warn: (message: string) => {
      const formatted = `[${new Date().toLocaleTimeString()}] WARN: ${message}`;
      console.warn(formatted);
      try {
        fs.appendFileSync(filePath, formatted + "\n");
      } catch (e) {}
    },
    error: (message: string, error?: any) => {
      const errMessage = error ? ` - ${error.message || String(error)}` : "";
      const formatted = `[${new Date().toLocaleTimeString()}] ERROR: ${message}${errMessage}`;
      console.error(formatted);
      try {
        fs.appendFileSync(filePath, formatted + "\n");
      } catch (e) {}
    },
    clear: () => {
      try {
        fs.writeFileSync(filePath, "");
      } catch (e) {}
    },
    getLogFilePath: () => filePath,
    readLogs: (): string => {
      try {
        if (fs.existsSync(filePath)) {
          return fs.readFileSync(filePath, "utf8");
        }
      } catch (e) {}
      return `No ${prefix} logs generated yet.`;
    }
  };
}

export const logger = createLoggerInstance(scraperLogPath, "scraper");
export const campaignLogger = createLoggerInstance(campaignLogPath, "campaign");

