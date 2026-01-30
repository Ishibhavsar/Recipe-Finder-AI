import { config } from '../config/env';

// Simple image cache - no complex eviction logic
const imageCache = new Map<string, string>();

const UNSPLASH_ACCESS_KEY = config.unsplashAccessKey;
const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836';

/**
 * Fetch image from Unsplash (with simple caching)
 */
export const fetchRecipeImage = async (
  recipeName: string,
  width: number = 800,
  height: number = 600
): Promise<string> => {
  const cacheKey = `${recipeName.toLowerCase()}:${width}x${height}`;

  // Return cached if exists
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey)!;
  }

  // No API key? Return default
  if (!UNSPLASH_ACCESS_KEY) {
    const fallback = `${DEFAULT_IMAGE}?w=${width}&h=${height}&fit=crop&q=80`;
    imageCache.set(cacheKey, fallback);
    return fallback;
  }

  try {
    const query = `${recipeName} food dish`;
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` } }
    );

    if (response.ok) {
      const data = await response.json();
      if (data.results?.[0]) {
        const url = `${data.results[0].urls.raw}&w=${width}&h=${height}&fit=crop&q=80`;
        imageCache.set(cacheKey, url);
        return url;
      }
    }
  } catch (error) {
    console.error('[Image] Fetch failed:', error);
  }

  // Fallback
  const fallback = `${DEFAULT_IMAGE}?w=${width}&h=${height}&fit=crop&q=80`;
  imageCache.set(cacheKey, fallback);
  return fallback;
};
