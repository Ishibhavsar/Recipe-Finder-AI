import { useState, useEffect } from 'react';
import { fetchRecipeImage } from '../services/imageService';

/**
 * Hook to fetch recipe images with loading state
 */
export const useRecipeImage = (
  recipeName: string | undefined,
  width: number = 800,
  height: number = 600
) => {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!recipeName) return;

    let cancelled = false;

    setIsLoading(true);
    fetchRecipeImage(recipeName, width, height)
      .then((url) => {
        if (!cancelled) {
          setImageUrl(url);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setImageUrl('');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [recipeName, width, height]);

  return { imageUrl, isLoading };
};
