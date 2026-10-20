/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from "fs";
import path from "path";
import { PitchTemplateConfig, DEFAULT_PITCH_TEMPLATES } from "./outreachCopy";

const templatesFilePath = path.join(process.cwd(), "templates.json");

/**
 * Server-only: Loads persistent pitch templates from templates.json
 */
export function loadPitchTemplates(): PitchTemplateConfig {
  try {
    if (fs.existsSync(templatesFilePath)) {
      const data = JSON.parse(fs.readFileSync(templatesFilePath, "utf8"));
      return {
        campaignGoal: data.campaignGoal || DEFAULT_PITCH_TEMPLATES.campaignGoal,
        jobSubGoal: data.jobSubGoal || DEFAULT_PITCH_TEMPLATES.jobSubGoal,
        selectedStrategy: data.selectedStrategy || DEFAULT_PITCH_TEMPLATES.selectedStrategy,
        senderName: data.senderName || DEFAULT_PITCH_TEMPLATES.senderName,
        senderCompany: data.senderCompany || DEFAULT_PITCH_TEMPLATES.senderCompany,
        roleTitle: data.roleTitle || DEFAULT_PITCH_TEMPLATES.roleTitle,
        skills: data.skills || DEFAULT_PITCH_TEMPLATES.skills,
        portfolioUrl: data.portfolioUrl || DEFAULT_PITCH_TEMPLATES.portfolioUrl,
        noWebsite: {
          emailSubject: data.noWebsite?.emailSubject || DEFAULT_PITCH_TEMPLATES.noWebsite.emailSubject,
          emailBody: data.noWebsite?.emailBody || DEFAULT_PITCH_TEMPLATES.noWebsite.emailBody,
          whatsappMessage: data.noWebsite?.whatsappMessage || DEFAULT_PITCH_TEMPLATES.noWebsite.whatsappMessage,
        },
        hasWebsite: {
          emailSubject: data.hasWebsite?.emailSubject || DEFAULT_PITCH_TEMPLATES.hasWebsite.emailSubject,
          emailBody: data.hasWebsite?.emailBody || DEFAULT_PITCH_TEMPLATES.hasWebsite.emailBody,
          whatsappMessage: data.hasWebsite?.whatsappMessage || DEFAULT_PITCH_TEMPLATES.hasWebsite.whatsappMessage,
        },
        jobOnly: {
          emailSubject: data.jobOnly?.emailSubject || DEFAULT_PITCH_TEMPLATES.jobOnly.emailSubject,
          emailBody: data.jobOnly?.emailBody || DEFAULT_PITCH_TEMPLATES.jobOnly.emailBody,
          whatsappMessage: data.jobOnly?.whatsappMessage || DEFAULT_PITCH_TEMPLATES.jobOnly.whatsappMessage,
        },
        freelanceOnly: {
          emailSubject: data.freelanceOnly?.emailSubject || DEFAULT_PITCH_TEMPLATES.freelanceOnly.emailSubject,
          emailBody: data.freelanceOnly?.emailBody || DEFAULT_PITCH_TEMPLATES.freelanceOnly.emailBody,
          whatsappMessage: data.freelanceOnly?.whatsappMessage || DEFAULT_PITCH_TEMPLATES.freelanceOnly.whatsappMessage,
        },
        jobAndFreelance: {
          emailSubject: data.jobAndFreelance?.emailSubject || data.jobPitch?.emailSubject || DEFAULT_PITCH_TEMPLATES.jobAndFreelance.emailSubject,
          emailBody: data.jobAndFreelance?.emailBody || data.jobPitch?.emailBody || DEFAULT_PITCH_TEMPLATES.jobAndFreelance.emailBody,
          whatsappMessage: data.jobAndFreelance?.whatsappMessage || data.jobPitch?.whatsappMessage || DEFAULT_PITCH_TEMPLATES.jobAndFreelance.whatsappMessage,
        },
        jobPitch: {
          emailSubject: data.jobPitch?.emailSubject || data.jobAndFreelance?.emailSubject || DEFAULT_PITCH_TEMPLATES.jobAndFreelance.emailSubject,
          emailBody: data.jobPitch?.emailBody || data.jobAndFreelance?.emailBody || DEFAULT_PITCH_TEMPLATES.jobAndFreelance.emailBody,
          whatsappMessage: data.jobPitch?.whatsappMessage || data.jobAndFreelance?.whatsappMessage || DEFAULT_PITCH_TEMPLATES.jobAndFreelance.whatsappMessage,
        },
        custom: {
          emailSubject: data.custom?.emailSubject || DEFAULT_PITCH_TEMPLATES.custom.emailSubject,
          emailBody: data.custom?.emailBody || DEFAULT_PITCH_TEMPLATES.custom.emailBody,
          whatsappMessage: data.custom?.whatsappMessage || DEFAULT_PITCH_TEMPLATES.custom.whatsappMessage,
          smsMessage: data.custom?.smsMessage || DEFAULT_PITCH_TEMPLATES.custom.smsMessage,
        },
        localCampaign: {
          emailSubject: data.localCampaign?.emailSubject || DEFAULT_PITCH_TEMPLATES.localCampaign?.emailSubject || "",
          emailBody: data.localCampaign?.emailBody || DEFAULT_PITCH_TEMPLATES.localCampaign?.emailBody || "",
          whatsappMessage: data.localCampaign?.whatsappMessage || DEFAULT_PITCH_TEMPLATES.localCampaign?.whatsappMessage || "",
          smsMessage: data.localCampaign?.smsMessage || DEFAULT_PITCH_TEMPLATES.localCampaign?.smsMessage || "",
        },
        customTemplates: Array.isArray(data.customTemplates) ? data.customTemplates : []
      };
    }
  } catch (error) {
    console.error("Failed to load templates.json, using defaults:", error);
  }
  return DEFAULT_PITCH_TEMPLATES;
}

/**
 * Server-only: Saves pitch templates to templates.json
 */
export function savePitchTemplates(config: Partial<PitchTemplateConfig>): void {
  try {
    let existing: any = {};
    if (fs.existsSync(templatesFilePath)) {
      try {
        existing = JSON.parse(fs.readFileSync(templatesFilePath, "utf8"));
      } catch {
        existing = {};
      }
    }
    const toSave = {
      ...existing,
      ...config,
      customTemplates: config.customTemplates !== undefined ? config.customTemplates : (existing.customTemplates || []),
      ...(config.localCampaign
        ? { localCampaign: { ...(existing.localCampaign || {}), ...config.localCampaign } }
        : {}),
      jobPitch: config.jobAndFreelance || config.jobPitch || existing.jobPitch || DEFAULT_PITCH_TEMPLATES.jobAndFreelance
    };
    fs.writeFileSync(templatesFilePath, JSON.stringify(toSave, null, 2), "utf8");
  } catch (error) {
    console.error("Failed to save templates.json:", error);
    throw error;
  }
}
