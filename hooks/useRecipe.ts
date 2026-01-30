import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { RecipeDetail, LoadingState } from '../types';
import { fetchRecipeDetails } from '../services/geminiService';

/**
 * Custom hook for fetching and managing recipe data with caching
 * Prevents unnecessary re-fetches and optimizes performance
 */
export const useRecipe = (recipeName: string | undefined) => {
  const { i18n } = useTranslation();
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [status, setStatus] = useState<LoadingState>(LoadingState.IDLE);

  // Prevent double fetches
  const fetchInProgressRef = useRef(false);
  const lastFetchKeyRef = useRef<string>('');

  const loadRecipe = useCallback(async () => {
    if (!recipeName) {
      setStatus(LoadingState.IDLE);
      setRecipe(null);
      fetchInProgressRef.current = false;
      lastFetchKeyRef.current = '';
      return;
    }

    // Create unique key for this fetch (recipe name + language)
    const fetchKey = `${recipeName}:${i18n.language}`;

    // Skip if already fetching the exact same recipe in the same language
    if (fetchInProgressRef.current && lastFetchKeyRef.current === fetchKey) {
      return;
    }

    // Mark as in progress BEFORE any async work
    fetchInProgressRef.current = true;
    lastFetchKeyRef.current = fetchKey;
    setStatus(LoadingState.LOADING);

    try {
      const data = await fetchRecipeDetails(recipeName, i18n.language);

      // Critical: Check if this fetch is still relevant
      // (user might have switched recipe/language while we were fetching)
      const currentFetchKey = `${recipeName}:${i18n.language}`;
      if (currentFetchKey !== fetchKey) {
        // Stale fetch, ignore result
        return;
      }

      if (data) {
        setRecipe(data);
        setStatus(LoadingState.SUCCESS);
      } else {
        setRecipe(null);
        setStatus(LoadingState.ERROR);
      }
    } catch (error) {
      console.error('[useRecipe] Error loading recipe:', error);
      setRecipe(null);
      setStatus(LoadingState.ERROR);
    } finally {
      fetchInProgressRef.current = false;
    }
  }, [recipeName, i18n.language]);

  useEffect(() => {
    loadRecipe();
  }, [loadRecipe]);

  return {
    recipe,
    status,
    isLoading: status === LoadingState.LOADING,
    isError: status === LoadingState.ERROR,
    isSuccess: status === LoadingState.SUCCESS,
    refetch: loadRecipe,
  };
};
