
import { GoogleGenAI } from "@google/genai";

// Initialize Gemini
// Note: process.env.API_KEY is assumed to be injected by the environment
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function translateBatch(texts: string[], targetLang: 'hi' | 'pa'): Promise<Record<string, string>> {
  if (!texts || texts.length === 0) return {};
  
  // Deduplicate inputs to save tokens
  const uniqueTexts = Array.from(new Set(texts.filter(t => t && t.trim().length > 0)));
  if (uniqueTexts.length === 0) return {};

  const langName = targetLang === 'hi' ? 'Hindi' : 'Punjabi';

  const prompt = `
    You are a professional translator for a financial accounting app. 
    Translate the following array of text strings into ${langName}.
    
    Rules:
    1. Return ONLY a JSON object where the key is the original string and the value is the translation.
    2. Transliterate names (e.g., "Rahul" -> "राहुल").
    3. Translate descriptions (e.g., "Sold Wheat" -> "गेहूं बेचा").
    4. Keep numbers as numbers.
    5. Do not include markdown formatting, just raw JSON.

    Input Array:
    ${JSON.stringify(uniqueTexts)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', // Using flash for speed/cost efficiency
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });
    
    const jsonText = response.text;
    if (!jsonText) return {};
    
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Translation failed", error);
    // Return empty object on failure so app doesn't crash
    return {};
  }
}
