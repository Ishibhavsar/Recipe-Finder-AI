import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Hero from './Hero';
import FoodBox from './FoodBox';
import { Category } from '../types';
import { fetchCategories } from '../services/geminiService';
import { Loader2 } from 'lucide-react';

const Home: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCategories = async () => {
      const data = await fetchCategories();
      setCategories(data);
      setLoading(false);
    };
    loadCategories();
  }, [i18n.language]); // Reload when language changes

  return (
    <>
      <Hero />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-serif font-bold text-gray-900 mb-4">
            {t('categories.title')}
          </h2>
          <p className="text-gray-500 max-w-2xl mx-auto">{t('categories.subtitle')}</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {categories.map((cat) => (
              <FoodBox key={cat.id} category={cat} />
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default Home;
