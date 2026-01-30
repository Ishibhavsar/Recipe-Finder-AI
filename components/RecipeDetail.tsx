import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Clock, Flame, ChefHat, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useRecipe } from '../hooks/useRecipe';
import { useRecipeImage } from '../hooks/useRecipeImage';

const RecipeDetail: React.FC = () => {
  const { t } = useTranslation();
  const { name } = useParams<{ name: string }>();

  // Use custom hook for optimized recipe fetching
  const { recipe, isLoading, isError } = useRecipe(name);

  // Fetch image using English recipe name (always, regardless of UI language)
  const { imageUrl, isLoading: imageLoading } = useRecipeImage(recipe?.name, 1200, 600);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-500 text-lg font-medium animate-pulse">
          {t('recipeDetail.loading')}
        </p>
      </div>
    );
  }

  if (isError || !recipe) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">{t('recipeDetail.notFound')}</h2>
        <p className="text-gray-600 mb-8">{t('recipeDetail.notFoundMessage')}</p>
        <Link to="/" className="text-primary hover:underline font-medium">
          {t('nav.home')}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in">
      <Link
        to="/"
        className="inline-flex items-center text-gray-500 hover:text-primary mb-6 transition-colors"
      >
        <ArrowLeft size={20} className="mr-2" /> {t('recipeDetail.backToRecipes')}
      </Link>

      <div className="bg-white rounded-3xl overflow-hidden shadow-xl border border-gray-100">
        <div className="relative h-64 sm:h-96 overflow-hidden bg-gray-200">
          {imageLoading ? (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
              <div className="text-center">
                <div className="w-12 h-12 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-gray-500 text-sm">Loading image...</p>
              </div>
            </div>
          ) : (
            <>
              <img
                src={imageUrl}
                alt={recipe.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback if image fails to load
                  e.currentTarget.src =
                    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&h=600&fit=crop&q=80';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
            </>
          )}
          {!imageLoading && (
            <div className="absolute bottom-0 left-0 p-8">
              <span className="inline-block px-3 py-1 bg-primary text-white text-xs font-bold rounded-full mb-3 uppercase tracking-wider">
                {recipe.category}
              </span>
              <h1 className="text-3xl sm:text-5xl font-serif font-bold text-white mb-2">
                {recipe.name}
              </h1>
              <p className="text-gray-200 text-lg max-w-2xl">{recipe.shortDescription}</p>
            </div>
          )}
        </div>

        <div className="p-8">
          <div className="flex flex-wrap gap-6 mb-8 p-6 bg-orange-50 rounded-2xl border border-orange-100">
            <div className="flex items-center gap-3">
              <div className="bg-white p-2 rounded-full text-primary shadow-sm">
                <Clock size={24} />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase">
                  {t('recipes.prepTime')}
                </p>
                <p className="text-gray-900 font-medium">{recipe.prepTime}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-white p-2 rounded-full text-primary shadow-sm">
                <Flame size={24} />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase">
                  {t('recipes.calories')}
                </p>
                <p className="text-gray-900 font-medium">{recipe.calories}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-white p-2 rounded-full text-primary shadow-sm">
                <ChefHat size={24} />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase">Difficulty</p>
                <p className="text-gray-900 font-medium">Medium</p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            <div className="md:col-span-1">
              <h3 className="text-2xl font-serif font-bold text-gray-900 mb-6 pb-2 border-b border-gray-200">
                {t('recipeDetail.ingredients')}
              </h3>
              <ul className="space-y-3">
                {recipe.ingredients.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-gray-700">
                    <CheckCircle2 size={18} className="text-green-500 flex-shrink-0 mt-1" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="md:col-span-2">
              <h3 className="text-2xl font-serif font-bold text-gray-900 mb-6 pb-2 border-b border-gray-200">
                {t('recipeDetail.instructions')}
              </h3>
              <div className="space-y-8">
                {recipe.instructions.map((step, idx) => (
                  <div key={idx} className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="text-gray-700 leading-relaxed text-lg">{step}</p>
                    </div>
                  </div>
                ))}
              </div>

              {recipe.tips && recipe.tips.length > 0 && (
                <div className="mt-10 p-6 bg-yellow-50 rounded-2xl border border-yellow-200">
                  <h4 className="font-bold text-yellow-800 mb-3 flex items-center gap-2">
                    <span className="text-xl">💡</span> {t('recipeDetail.tips')}
                  </h4>
                  <ul className="list-disc list-inside space-y-2 text-yellow-900/80">
                    {recipe.tips.map((tip, idx) => (
                      <li key={idx}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecipeDetail;
