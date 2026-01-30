import React, { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Hero: React.FC = () => {
  const [query, setQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setIsSubmitting(true);
      // Simulate a small delay for better UX feel before navigating
      setTimeout(() => {
        navigate(`/search/${encodeURIComponent(query)}`);
        setIsSubmitting(false);
      }, 300);
    }
  };

  return (
    <div className="relative bg-dark text-white py-24 sm:py-32 overflow-hidden">
      {/* Background with overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1543353071-873f17a7a088?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80" 
          alt="Cooking Background" 
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-dark via-dark/80 to-transparent"></div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
        <h1 className="text-4xl sm:text-6xl font-serif font-bold mb-6 tracking-tight">
          Find Your Next <span className="text-primary">Masterpiece</span>
        </h1>
        <p className="text-lg sm:text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
          Discover thousands of recipes, from quick weeknight meals to gourmet delights. 
          Powered by Gemini AI to tailor suggestions just for you.
        </p>

        <form onSubmit={handleSubmit} className="relative max-w-2xl mx-auto group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            {isSubmitting ? (
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
            ) : (
              <Search className="h-6 w-6 text-gray-400 group-focus-within:text-primary transition-colors" />
            )}
          </div>
          <input
            type="text"
            className="block w-full pl-12 pr-4 py-4 rounded-full border-2 border-transparent bg-white/10 backdrop-blur-sm text-white placeholder-gray-400 focus:bg-white focus:text-gray-900 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/20 transition-all shadow-xl text-lg"
            placeholder="Search recipes (e.g., 'Spicy Chicken', 'Vegan Pasta')..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button 
            type="submit"
            className="absolute right-2 top-2 bottom-2 px-6 bg-primary hover:bg-orange-600 text-white font-medium rounded-full transition-colors flex items-center justify-center disabled:opacity-70"
            disabled={isSubmitting}
          >
            Search
          </button>
        </form>

        <div className="mt-8 flex justify-center gap-3 text-sm text-gray-400">
          <span>Popular:</span>
          <button
            onClick={() => navigate('/search/Healthy')}
            className="hover:text-primary underline decoration-dotted"
          >
            Healthy
          </button>
          <button
            onClick={() => navigate('/search/Italian')}
            className="hover:text-primary underline decoration-dotted"
          >
            Italian
          </button>
          <button
            onClick={() => navigate('/search/Breakfast')}
            className="hover:text-primary underline decoration-dotted"
          >
            Breakfast
          </button>
        </div>
      </div>
    </div>
  );
};

export default Hero;
