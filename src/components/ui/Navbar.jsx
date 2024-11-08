import React from 'react';
import { useBook } from '../context/BookContext';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon, ChevronLeft } from 'lucide-react';

const Navbar = () => {
  const { currentBook, setCurrentBook } = useBook();
  const { darkMode, toggleDarkMode } = useTheme();

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            {currentBook && (
              <button
                onClick={() => setCurrentBook(null)}
                className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                <ChevronLeft className="w-5 h-5" />
                <span>Back to Books</span>
              </button>
            )}
            {!currentBook && (
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                English Reader
              </h1>
            )}
          </div>

          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            {darkMode ? (
              <Sun className="w-5 h-5 text-yellow-500" />
            ) : (
              <Moon className="w-5 h-5 text-gray-600" />
            )}
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;