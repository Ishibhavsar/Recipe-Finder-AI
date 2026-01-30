import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Category } from '../types';
import { useRecipeImage } from '../hooks/useRecipeImage';
import { ArrowRight } from 'lucide-react';

interface FoodBoxProps {
  category: Category;
}

const FoodBox: React.FC<FoodBoxProps> = ({ category }) => {
  const navigate = useNavigate();

  // Use hook to fetch image dynamically
  const { imageUrl, isLoading: imageLoading } = useRecipeImage(category.name, 600, 400);

  return (
    <div
      onClick={() => navigate(`/search/${category.name}`)}      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(`/search/${category.name}`);
        }
      }}
      role="button"
      tabIndex={0}      className="group relative h-64 rounded-2xl overflow-hidden cursor-pointer shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
    >
      {imageLoading ? (
        <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <img
          src={imageUrl}
          alt={category.name}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
          onError={(e) => {
            // Fallback if image fails to load
            e.currentTarget.src =
              'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=400&fit=crop&q=80';
          }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"></div>

      <div className="absolute bottom-0 left-0 p-6 w-full translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
        <h3 className="text-2xl font-serif font-bold text-white mb-2">{category.name}</h3>
        <p className="text-gray-300 text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 line-clamp-2">
          {category.description}
        </p>
        <div className="mt-4 flex items-center text-primary font-medium text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">
          Explore {category.name} <ArrowRight size={16} className="ml-1" />
        </div>
      </div>
    </div>
  );
};

export default FoodBox;
