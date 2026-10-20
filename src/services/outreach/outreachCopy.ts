/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Lead } from "../../types";

export interface OutreachTemplate {
  emailSubject: string;
  emailBody: string;
  whatsappMessage: string;
  smsMessage?: string;
}

export type CampaignGoal = "business" | "job";
export type JobSubGoal = "jobOnly" | "freelanceOnly" | "both";
export type PitchStrategy = 
  | "ai" 
  | "noWebsite" 
  | "hasWebsite" 
  | "jobOnly" 
  | "freelanceOnly" 
  | "both" 
  | "jobPitch" 
  | "custom";

export interface CustomTemplateItem {
  id: string;
  name: string;
  emailSubject: string;
  emailBody: string;
  whatsappMessage: string;
}

export interface PitchTemplateConfig {
  campaignGoal: CampaignGoal;
  jobSubGoal?: JobSubGoal;
  selectedStrategy: PitchStrategy;
  senderName: string;
  senderCompany: string;
  roleTitle: string;
  skills: string;
  portfolioUrl: string;
  noWebsite: OutreachTemplate;
  hasWebsite: OutreachTemplate;
  jobOnly: OutreachTemplate;
  freelanceOnly: OutreachTemplate;
  jobAndFreelance: OutreachTemplate;
  jobPitch?: OutreachTemplate; // for backwards compatibility
  custom: OutreachTemplate;
  localCampaign?: OutreachTemplate;
  customTemplates?: CustomTemplateItem[];
}

export const DEFAULT_PITCH_TEMPLATES: PitchTemplateConfig = {
  campaignGoal: "job",
  jobSubGoal: "both",
  selectedStrategy: "both",
  senderName: "Dhananjay Shahane",
  senderCompany: "Digital Growth Studio",
  roleTitle: "Full Stack Developer (Web, Android & AI Apps)",
  skills: "Next.js, Flutter, React, Android (Java/Kotlin), Node.js, TypeScript, AI Web & Mobile Apps",
  portfolioUrl: "https://dhananjay-shahane.vercel.app",
  customTemplates: [],
  noWebsite: {
    emailSubject: "Quick question about {businessName}",
    emailBody: "Hi there,\n\nI came across {businessName} on Google Maps ({rating}★ with {reviews} reviews) and noticed you don't currently have a website listed.\n\nI actually went ahead and built a quick, free demo website for your business to show you how you can easily get more patient/client bookings online. It is completely ready for you to check out.\n\nWould it be okay if I sent you the link to look at? (No cost or catch at all!)\n\nBest regards,\n{senderName}",
    whatsappMessage: "Hi there! 👋\n\nI was looking at *{businessName}* on Google Maps and noticed you don't have a website listed.\n\nTo help out, I went ahead and created a quick, free demo website for your business. It takes less than 30 seconds to look at, and it's completely ready.\n\nCan I send you the link to check it out? (No cost or catch at all!)",
    smsMessage: "Hi, noticed {businessName} has no website on Google Maps. Built a quick free demo to show how you can get more clients: {portfolioUrl} - {senderName}"
  },
  hasWebsite: {
    emailSubject: "Quick design & branding idea for {businessName}",
    emailBody: "Hi there,\n\nI came across {businessName} on Google Maps ({rating}★) and noticed your online presence could attract significantly more local clients with active social media branding and automated booking.\n\nI put together a quick, free branding roadmap and some sample post designs specifically for your business.\n\nWould you be open to checking out the sample designs? I can send them over right away.\n\nBest regards,\n{senderName}",
    whatsappMessage: "Hi! 👋\n\nI was looking at *{businessName}* on Google Maps ({rating}★) and noticed your social media branding could be automated to get more local reach.\n\nI put together a free digital branding roadmap and some sample templates specifically for your business to show you how to attract more local clients.\n\nCan I send over the sample designs to check out? (No cost or catch at all!)",
    smsMessage: "Hi {businessName}, loved your {rating}★ rating on Maps! Put together a free digital roadmap to help scale client bookings: {portfolioUrl} - {senderName}"
  },
  jobOnly: {
    emailSubject: "Application for Full Stack / Web & Android Developer at {businessName}",
    emailBody: "Dear Hiring Team at {businessName},\n\nI hope this email finds you well. I've been following {businessName} and have great respect for your work ({rating}★ on Google Maps in {address}).\n\nI am {senderName}, a {roleTitle} with hands-on expertise in {skills}.\n\nI am actively seeking full-time developer opportunities and would love to contribute to your engineering team across Web Development, Android Application Development, and modern AI Applications. You can explore my live projects, code, and portfolio here:\n{portfolioUrl}\n\nCould we arrange a brief 5-minute introductory call or resume review this week?\n\nSincerely,\n{senderName}",
    whatsappMessage: "Hi {businessName} team! 👋\n\nI'm {senderName}, a {roleTitle} specializing in Web Development, Android Apps (Flutter), and AI Applications ({skills}).\n\nI'm reaching out to inquire if you have any open full-time tech or developer positions available.\n\nYou can review my live work and portfolio here: {portfolioUrl}\n\nWould love to connect if you're hiring! Thank you!",
    smsMessage: "Hi {businessName}, I'm {senderName}, a Full Stack & Android Developer ({skills}). Inquiring about open dev roles: {portfolioUrl}"
  },
  freelanceOnly: {
    emailSubject: "Freelance Web, Android & AI App Development for {businessName}",
    emailBody: "Hi {businessName} Team,\n\nI came across {businessName} ({rating}★ in {address}) and wanted to reach out regarding professional Web Development, Android Application Development, and AI Application solutions.\n\nI help businesses design and build responsive websites, feature-rich Android/mobile apps (Flutter / React Native / Android), and modern AI applications with {skills}.\n\nWhether you need a brand-new web/mobile product, feature upgrades, UI improvements, or maintenance, I offer fast project turnaround with flexible freelance/contract terms.\n\nCheck out my recent work and portfolio: {portfolioUrl}\n\nDo you have any current or upcoming web, Android, or AI app projects where I could help?\n\nBest regards,\n{senderName}",
    whatsappMessage: "Hi there! 👋\n\nI'm {senderName}, specializing in Web Development, Android App Development (Flutter), and modern AI Applications ({skills}).\n\nI help businesses like *{businessName}* build custom websites, Android apps, and AI solutions on a flexible freelance/contract basis.\n\nYou can view my portfolio & projects here: {portfolioUrl}\n\nLet me know if you need any web, Android, or AI app development support!",
    smsMessage: "Hi {businessName}, I build modern web, Android & AI apps on flexible contract. Recent portfolio: {portfolioUrl} - {senderName}"
  },
  jobAndFreelance: {
    emailSubject: "{roleTitle} — Full-time or Contract / Freelance Inquiry for {businessName}",
    emailBody: "Dear Team at {businessName},\n\nI hope you're having a productive week. I've been following {businessName} ({rating}★ in {address}) and wanted to reach out directly.\n\nI am {senderName}, a {roleTitle} specializing in Web Development, Android Application Development, and AI Applications with {skills}.\n\nI am actively available for both full-time developer positions and contract / freelance project development. Whether your team is expanding its permanent engineering department or needs fast development support on custom Web, Android/mobile, or AI applications, I would be thrilled to contribute.\n\nMy portfolio and technical demos: {portfolioUrl}\n\nWould you be open to a quick chat to discuss how I can help?\n\nWarm regards,\n{senderName}",
    whatsappMessage: "Hi {businessName} team! 👋\n\nI'm {senderName}, a {roleTitle} specializing in Web Development, Android App Development (Flutter), and AI Applications ({skills}).\n\nI'm reaching out to check if you have any open full-time developer positions or need freelance development/contract support on upcoming projects.\n\nPortfolio & work: {portfolioUrl}\n\nWould love to connect if there's an opportunity to collaborate!",
    smsMessage: "Hi {businessName}, I'm {senderName}, Full Stack & Mobile Developer ({skills}). Available for full-time & contract projects: {portfolioUrl}"
  },
  jobPitch: {
    emailSubject: "{roleTitle} — Full-time or Contract / Freelance Inquiry for {businessName}",
    emailBody: "Dear Team at {businessName},\n\nI hope you're having a productive week. I've been following {businessName} ({rating}★ in {address}) and wanted to reach out directly.\n\nI am {senderName}, a {roleTitle} specializing in Web Development, Android Application Development, and AI Applications with {skills}.\n\nI am actively available for both full-time developer positions and contract / freelance project development. Whether your team is expanding its permanent engineering department or needs fast development support on custom Web, Android/mobile, or AI applications, I would be thrilled to contribute.\n\nMy portfolio and technical demos: {portfolioUrl}\n\nWould you be open to a quick chat to discuss how I can help?\n\nWarm regards,\n{senderName}",
    whatsappMessage: "Hi {businessName} team! 👋\n\nI'm {senderName}, a {roleTitle} specializing in Web Development, Android App Development (Flutter), and AI Applications ({skills}).\n\nI'm reaching out to check if you have any open full-time developer positions or need freelance development/contract support on upcoming projects.\n\nPortfolio & work: {portfolioUrl}\n\nWould love to connect if there's an opportunity to collaborate!",
    smsMessage: "Hi {businessName}, I'm {senderName}, Full Stack & Mobile Developer ({skills}). Available for full-time & contract projects: {portfolioUrl}"
  },
  custom: {
    emailSubject: "Partnership inquiry for {businessName}",
    emailBody: "Hi there,\n\nI am reaching out regarding {businessName} ({rating}★ in {address}).\n\nWe specialize in helping {category} businesses grow through custom Web Development, Android Apps, and modern AI Applications.\n\nWould love to share some quick ideas tailored for your team.\n\nBest regards,\n{senderName}",
    whatsappMessage: "Hi there! 👋 Reaching out regarding *{businessName}*. We build custom web, Android, and AI application solutions for businesses in your area. Can I share a quick 1-minute breakdown with you?",
    smsMessage: "Hi {businessName}, we build custom web, Android & AI apps for local businesses. Would love to share ideas: {portfolioUrl} - {senderName}"
  },
  localCampaign: {
    emailSubject: "Full Stack & AI Developer Opportunities — Dhananjay Shahane",
    emailBody: "Hello Sir/Ma’am,\nI’m Dhananjay Shahane, a Full Stack & AI Developer with 3+ years of experience in Next.js, React, Node.js, Flutter, LLMs, RAG, and AI Agents.\nI came across your company through Google Business Profile and wanted to check if you have any full-time, freelance, or contract developer opportunities.\nPortfolio: https://dhananjay-shahane.vercel.app\nI’d be happy to discuss how I can contribute to your team or projects.\nThank you for your time.\nBest regards,\nDhananjay Shahane",
    whatsappMessage: "Hello Sir/Ma’am,\n\nI’m Dhananjay Shahane, a Full Stack & AI Developer with 3+ years of experience in Next.js, React, Node.js, Flutter, LLM, RAG, AI Agents, Claude Code & Kiro.\n\nI came across your company through Google Business Profile and wanted to check if you have any full-time, freelance, or contract developer opportunities.\n\nPortfolio: https://dhananjay-shahane.vercel.app\n\nThank you!",
    smsMessage: "Hello Sir/Ma’am, I’m Dhananjay Shahane, a Full Stack & AI Developer with 3+ years of experience in Next.js, React, Node.js, Flutter & AI/LLMs.\nI wanted to check if you have any full-time, freelance, or contract opportunities.\nPortfolio: https://dhananjay-shahane.vercel.app\nThank you!"
  }
};

/**
 * Interpolates variables in a template string ({businessName}, {roleTitle}, {portfolioUrl}, etc.)
 * Browser-safe and pure.
 */
export function interpolateVariables(template: string, lead: Lead, config?: PitchTemplateConfig): string {
  if (!template) return "";
  const currentConfig = config || DEFAULT_PITCH_TEMPLATES;
  
  return template
    .replace(/\{businessName\}/g, lead.businessName || "your business")
    .replace(/\{category\}/g, lead.category || "business")
    .replace(/\{rating\}/g, lead.rating ? String(lead.rating) : "5.0")
    .replace(/\{reviews\}/g, lead.reviews ? String(lead.reviews) : "50+")
    .replace(/\{address\}/g, lead.address || "")
    .replace(/\{website\}/g, lead.website || "")
    .replace(/\{senderName\}/g, currentConfig.senderName || "Dhananjay Shahane")
    .replace(/\{senderCompany\}/g, currentConfig.senderCompany || "Growth Studio")
    .replace(/\{roleTitle\}/g, currentConfig.roleTitle || "Software Engineer")
    .replace(/\{skills\}/g, currentConfig.skills || "Web & AI Development")
    .replace(/\{portfolioUrl\}/g, currentConfig.portfolioUrl || "https://github.com");
}

/**
 * Renders an outreach template for a lead based on configured strategy and templates
 */
export function renderOutreachTemplate(lead: Lead, customConfig?: PitchTemplateConfig): OutreachTemplate {
  const config = customConfig || DEFAULT_PITCH_TEMPLATES;
  const isJob = config.campaignGoal === "job";
  const subGoal = config.jobSubGoal || "both";
  
  let targetTemplate: OutreachTemplate;

  if (isJob) {
    if (config.selectedStrategy === "jobOnly" || subGoal === "jobOnly") {
      targetTemplate = config.jobOnly || DEFAULT_PITCH_TEMPLATES.jobOnly;
    } else if (config.selectedStrategy === "freelanceOnly" || subGoal === "freelanceOnly") {
      targetTemplate = config.freelanceOnly || DEFAULT_PITCH_TEMPLATES.freelanceOnly;
    } else if (config.selectedStrategy === "custom") {
      targetTemplate = config.custom || DEFAULT_PITCH_TEMPLATES.custom;
    } else {
      targetTemplate = config.jobAndFreelance || DEFAULT_PITCH_TEMPLATES.jobAndFreelance;
    }
  } else {
    if (config.selectedStrategy === "noWebsite") {
      targetTemplate = config.noWebsite || DEFAULT_PITCH_TEMPLATES.noWebsite;
    } else if (config.selectedStrategy === "hasWebsite") {
      targetTemplate = config.hasWebsite || DEFAULT_PITCH_TEMPLATES.hasWebsite;
    } else if (config.selectedStrategy === "custom") {
      targetTemplate = config.custom || DEFAULT_PITCH_TEMPLATES.custom;
    } else {
      // Dynamic fallback for business
      const hasWeb = lead.website && lead.website.trim() !== "";
      targetTemplate = hasWeb ? (config.hasWebsite || DEFAULT_PITCH_TEMPLATES.hasWebsite) : (config.noWebsite || DEFAULT_PITCH_TEMPLATES.noWebsite);
    }
  }

  const defaultSmsFallback = `Hi ${lead.businessName || "there"}, reaching out regarding your business. Check out our work: ${config.portfolioUrl} - ${config.senderName}`;
  const rawSms = targetTemplate.smsMessage || defaultSmsFallback;

  return {
    emailSubject: interpolateVariables(targetTemplate.emailSubject, lead, config),
    emailBody: interpolateVariables(targetTemplate.emailBody, lead, config),
    whatsappMessage: interpolateVariables(targetTemplate.whatsappMessage, lead, config),
    smsMessage: interpolateVariables(rawSms, lead, config)
  };
}

/**
 * Fallback static generator (Browser and Server safe)
 */
export function generateOutreachCopy(lead: Lead, customConfig?: PitchTemplateConfig): OutreachTemplate {
  return renderOutreachTemplate(lead, customConfig);
}
