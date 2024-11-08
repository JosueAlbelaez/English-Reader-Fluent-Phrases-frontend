import React from 'react';

const categories = [
  'Tecnología',
  'Literatura',
  'Historias Cortas',
  'Humanidades',
  'Ciencias Sociales'
];

const CategorySelector = ({ selectedCategory, onSelectCategory }) => {
  return (
    <div className="mb-8">
      <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
        Categorías
      </h2>
      <div className="flex flex-wrap gap-4">
        <button
          onClick={() => onSelectCategory(null)}
          className={`px-4 py-2 rounded-lg ${
            !selectedCategory
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          } hover:opacity-90 transition-colors`}
        >
          Todas
        </button>
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => onSelectCategory(category)}
            className={`px-4 py-2 rounded-lg ${
              selectedCategory === category
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            } hover:opacity-90 transition-colors`}
          >
            {category}
          </button>
        ))}
      </div>
    </div>
  );
};

export default CategorySelector;