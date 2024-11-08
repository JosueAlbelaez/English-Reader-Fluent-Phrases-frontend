import React from 'react';
import { useBook } from '../context/BookContext';
import Navbar from './Navbar';
import BookList from './BookList';
import BookReader from './BookReader';
//import SearchBar from './SearchBar';

const Layout = () => {
  const { currentBook } = useBook();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        {currentBook ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {currentBook.title}
              </h1>
              
            </div>
            <BookReader />
          </div>
        ) : (
          <BookList />
        )}
      </main>
    </div>
  );
};

export default Layout;