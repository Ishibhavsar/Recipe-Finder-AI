import { GoogleGenAI } from '@google/genai';
import { config } from '../config/env';

const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
const MODEL_NAME = 'gemini-2.5-flash';

// Language names mapping
const LANGUAGE_NAMES: { [key: string]: string } = {
  en: 'English',
  hi: 'Hindi',
  ja: 'Japanese',
  es: 'Spanish',
  th: 'Thai',
};

// Translation cache to reduce API calls
const translationCache = new Map<string, any>();

/**
 * Generates a cache key for translation
 */
function getCacheKey(text: string, sourceLang: string, targetLang: string): string {
  return `${sourceLang}-${targetLang}-${text.substring(0, 50)}`;
}

/**
 * Translates text from source language to target language using Gemini AI
 */
export async function translateText(
  text: string,
  targetLang: string,
  sourceLang: string = 'auto'
): Promise<string> {
  // If target is English or same as source, return original
  if (targetLang === 'en' || targetLang === sourceLang) {
    return text;
  }

  // Check cache first
  const cacheKey = getCacheKey(text, sourceLang, targetLang);
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  if (!ai) {
    console.error('Translation API not available');
    return text;
  }

  try {
    const targetLanguageName = LANGUAGE_NAMES[targetLang] || targetLang;
    const prompt = `Translate the following text to ${targetLanguageName}. Only return the translated text, nothing else:\n\n${text}`;

    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });

    const translated = result.text?.trim() || text;

    // Cache the result
    translationCache.set(cacheKey, translated);

    return translated;
  } catch (error) {
    console.error('Translation error:', error);
    return text; // Fallback to original text
  }
}

/**
 * Translates recipe content (structured data) to target language
 */
export async function translateRecipeContent(content: any, targetLang: string): Promise<any> {
  if (targetLang === 'en' || !content) {
    return content;
  }

  // Check cache for full recipe
  const cacheKey = getCacheKey(JSON.stringify(content).substring(0, 100), 'en', targetLang);
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  if (!ai) {
    return content;
  }

  try {
    const targetLanguageName = LANGUAGE_NAMES[targetLang] || targetLang;
    const prompt = `Translate the following recipe data to ${targetLanguageName}. Keep the JSON structure exactly the same, only translate the text values (name, description, ingredients, instructions, tips, etc.). Return valid JSON only without any markdown formatting:\n\n${JSON.stringify(content, null, 2)}`;

    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });

    let responseText = result.text || '';

    // Clean markdown code blocks if present
    responseText = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const translated = JSON.parse(responseText);

    // Cache the result
    translationCache.set(cacheKey, translated);

    return translated;
  } catch (error) {
    console.error('Recipe translation error:', error);
    return content; // Fallback to original content
  }
}

/**
 * Translates search query from user's language to English for internal processing
 */
export async function translateSearchQuery(query: string, sourceLang: string): Promise<string> {
  // If already in English, return as is
  if (sourceLang === 'en') {
    return query;
  }

  // Check cache
  const cacheKey = getCacheKey(query, sourceLang, 'en');
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  if (!ai) {
    return query;
  }

  try {
    const prompt = `Translate this food/recipe search query to English. Only return the English translation, nothing else:\n\n${query}`;

    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });

    const translated = result.text?.trim() || query;

    // Cache the result
    translationCache.set(cacheKey, translated);

    return translated;
  } catch (error) {
    console.error('Query translation error:', error);
    return query; // Fallback to original query
  }
}

/**
 * Detects if text is in a specific language (simple heuristic)
 */
export function detectLanguage(text: string): string {
  // Hindi (Devanagari script)
  if (/[\u0900-\u097F]/.test(text)) return 'hi';

  // Japanese (Hiragana, Katakana, Kanji)
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)) return 'ja';

  // Thai script
  if (/[\u0E00-\u0E7F]/.test(text)) return 'th';

  // Spanish (checking for accented characters common in Spanish)
  if (/[áéíóúñü]/i.test(text)) return 'es';

  // Default to English
  return 'en';
}

/**
 * Clears the translation cache
 */
export function clearTranslationCache(): void {
  translationCache.clear();
}

/**
 * Gets cache statistics
 */
export function getTranslationCacheStats(): { size: number; keys: string[] } {
  return {
    size: translationCache.size,
    keys: Array.from(translationCache.keys()),
  };
}
