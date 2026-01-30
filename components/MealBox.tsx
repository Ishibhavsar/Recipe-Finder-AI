import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RecipeSummary } from '../types';
import { useRecipeImage } from '../hooks/useRecipeImage';
import { Clock, Flame, ArrowRight } from 'lucide-react';

interface MealBoxProps {
  meal: RecipeSummary;
}

const MealBox: React.FC<MealBoxProps> = ({ meal }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Fetch image using English recipe name
  const { imageUrl, isLoading: imageLoading } = useRecipeImage(meal.name, 600, 400);

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-lg border border-gray-100 hover:shadow-2xl transition-all duration-300 flex flex-col h-full group">
      <div className="relative h-48 overflow-hidden bg-gray-200">
        {imageLoading ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <img
            src={imageUrl}
            alt={meal.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
            loading="lazy"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"></div>
        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-primary shadow-sm uppercase tracking-wide">
          {meal.category}
        </div>
      </div>

      <div className="p-6 flex flex-col flex-grow">
        <h3 className="text-xl font-serif font-bold text-gray-900 mb-2 line-clamp-1 group-hover:text-primary transition-colors">
          {meal.name}
        </h3>
        <p className="text-gray-500 text-sm mb-4 line-clamp-2 flex-grow">{meal.shortDescription}</p>

        <div className="flex items-center justify-between text-sm text-gray-500 mb-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-1">
            <Clock size={16} className="text-primary" />
            <span>{meal.prepTime}</span>
          </div>
          <div className="flex items-center gap-1">
            <Flame size={16} className="text-primary" />
            <span>{meal.calories}</span>
          </div>
        </div>

        <button
          onClick={() => navigate(`/recipe/${encodeURIComponent(meal.name)}`)}
          className="w-full mt-auto bg-gray-50 hover:bg-primary text-gray-900 hover:text-white font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2 group-hover:shadow-lg"
        >
          {t('recipes.viewRecipe')} <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};

export default MealBox;
