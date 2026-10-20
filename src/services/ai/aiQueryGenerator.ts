/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import axios from "axios";
import { GoogleGenAI } from "@google/genai";
import { logger } from "../../utils/logger";

/**
 * Generates 10 diverse, targeted Google Maps search queries using AI (NVIDIA AI or Gemini).
 * No hardcoded/heuristic fallback data.
 */
export async function generateSearchQueriesWithAI(businessType: string, location: string, count: number = 10): Promise<string[]> {
  const cleanType = (businessType || "").trim();
  const cleanLoc = (location || "").trim();

  if (!cleanType) return [`businesses in ${cleanLoc || "area"}`];
  if (!cleanLoc) return [cleanType];

  const targetCount = Math.max(5, Math.min(count, 25));

  const prompt = `Generate exactly ${targetCount} diverse, high-intent Google Maps search queries to find all "${cleanType}" in and around "${cleanLoc}".
Include variations covering:
1. Exact keyword with city name
2. Sub-niches, specific specialties, services, or sub-categories
3. Major business districts, commercial hubs, tech parks, or key neighborhoods in and around ${cleanLoc}
4. Enterprise / consulting / agency / top-rated variations

Return ONLY a valid JSON array of ${targetCount} query strings. Do not include markdown, explanations, or backticks. Example:
["query 1", "query 2", "query 3"]`;

  // 1. Try NVIDIA AI
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  if (nvidiaKey && nvidiaKey.trim() !== "" && !nvidiaKey.includes("YOUR_NVIDIA")) {
    try {
      const model = process.env.NVIDIA_MODEL || "meta/llama-3.2-11b-vision-instruct";
      logger.info(`Generating ${targetCount} search queries via NVIDIA AI (${model}) for: '${cleanType}' in '${cleanLoc}'`);
      const response = await axios.post(
        "https://integrate.api.nvidia.com/v1/chat/completions",
        {
          model: model,
          messages: [
            {
              role: "system",
              content: `You are an expert lead generation and Google Maps search researcher. Always output a pure JSON array of ${targetCount} query strings.`
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.4,
          max_tokens: 600
        },
        {
          headers: {
            "Authorization": `Bearer ${nvidiaKey}`,
            "Content-Type": "application/json"
          },
          timeout: 20000
        }
      );

      const content = response.data?.choices?.[0]?.message?.content?.trim();
      if (content) {
        const cleaned = content.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/, "").trim();
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const queries = parsed.map(q => String(q).trim()).filter(Boolean).slice(0, targetCount);
          logger.success(`NVIDIA AI generated ${queries.length} search queries.`);
          return queries;
        }
      }
    } catch (e: any) {
      const errMsg = e.response?.data?.message || e.message || e;
      logger.error(`NVIDIA AI query generation failed: ${errMsg}`);
    }
  }

  // 2. Try Gemini AI
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && geminiKey.trim() !== "" && geminiKey !== "MY_GEMINI_API_KEY") {
    try {
      logger.info(`Generating ${targetCount} search queries via Gemini for: '${cleanType}' in '${cleanLoc}'`);
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const text = response.text ? response.text.trim() : "";
      if (text) {
        const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/, "").trim();
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const queries = parsed.map(q => String(q).trim()).filter(Boolean).slice(0, targetCount);
          logger.success(`Gemini AI generated ${queries.length} search queries.`);
          return queries;
        }
      }
    } catch (e: any) {
      logger.error(`Gemini AI query generation failed: ${e.message || e}`);
    }
  }

  return [`${cleanType} in ${cleanLoc}`];
}
