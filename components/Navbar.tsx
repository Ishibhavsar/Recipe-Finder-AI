import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UtensilsCrossed, Home, Menu } from 'lucide-react';
import LanguageSwitcher from './LanguageSwitcher';

const Navbar: React.FC = () => {
  const { t } = useTranslation();

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md shadow-sm border-b border-orange-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="bg-primary p-2 rounded-lg text-white group-hover:bg-orange-600 transition-colors">
              <UtensilsCrossed size={24} />
            </div>
            <span className="text-2xl font-serif font-bold text-gray-800 tracking-tight">
              Recipe<span className="text-primary">Finder</span>
            </span>
          </Link>

          <div className="flex items-center space-x-4">
            <Link
              to="/"
              className="flex items-center gap-2 text-gray-600 hover:text-primary font-medium transition-colors"
            >
              <Home size={18} />
              <span className="hidden sm:inline">{t('nav.home')}</span>
            </Link>
            <Link
              to="/"
              onClick={() =>
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
              }
              className="flex items-center gap-2 text-gray-600 hover:text-primary font-medium transition-colors"
            >
              <Menu size={18} />
              <span className="hidden sm:inline">{t('nav.categories')}</span>
            </Link>
            <LanguageSwitcher />
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
