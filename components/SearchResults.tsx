import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import MealBox from './MealBox';
import { RecipeSummary } from '../types';
import { searchRecipes } from '../services/geminiService';
import { Loader2, ArrowLeft, SearchX } from 'lucide-react';

const SearchResults: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { query } = useParams<{ query: string }>();
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadRecipes = async () => {
      if (!query) return;
      setLoading(true);
      try {
        const data = await searchRecipes(query);
        if (!cancelled) {
          setRecipes(data);
          setLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          setRecipes([]);
          setLoading(false);
        }
      }
    };

    loadRecipes();

    return () => {
      cancelled = true;
    };
  }, [query, i18n.language]); // Reload when language changes

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Link
        to="/"
        className="inline-flex items-center text-gray-500 hover:text-primary mb-8 transition-colors"
      >
        <ArrowLeft size={20} className="mr-2" /> {t('recipeDetail.backToRecipes')}
      </Link>

      <div className="mb-10">
        <h2 className="text-3xl font-serif font-bold text-gray-900">
          {t('search.results')} &quot;{query}&quot;
        </h2>
        <p className="text-gray-500 mt-2">
          {t('search.found')} {recipes.length} {t('search.possibilities')}
        </p>
      </div>

      {loading ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
          <p className="text-gray-500 font-medium">{t('search.loading')}</p>
        </div>
      ) : recipes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {recipes.map((recipe) => (
            <MealBox key={recipe.id} meal={recipe} />
          ))}
        </div>
      ) : (
        <div className="min-h-[40vh] flex flex-col items-center justify-center text-gray-400">
          <SearchX size={64} className="mb-4 opacity-50" />
          <h3 className="text-xl font-medium text-gray-600">{t('search.noResults')}</h3>
          <p>{t('search.tryDifferent')}</p>
        </div>
      )}
    </div>
  );
};

export default SearchResults;
