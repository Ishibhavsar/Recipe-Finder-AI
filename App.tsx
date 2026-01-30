import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './components/Home';
import SearchResults from './components/SearchResults';
import RecipeDetail from './components/RecipeDetail';
import { ErrorBoundary } from './components/ErrorBoundary';

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <Router>
        <div className="min-h-screen flex flex-col bg-gray-50 font-sans">
          <Navbar />
          <main className="flex-grow">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/search/:query" element={<SearchResults />} />
              <Route path="/recipe/:name" element={<RecipeDetail />} />
            </Routes>
          </main>
          <footer className="bg-dark text-white py-6 border-t border-gray-800">
            <div className="max-w-7xl mx-auto px-4 text-center">
              <p className="text-sm text-gray-400">
                © {new Date().getFullYear()} RecipeFinder AI. Powered by Google Gemini.
              </p>
            </div>
          </footer>
        </div>
      </Router>
    </ErrorBoundary>
  );
};

export default App;
