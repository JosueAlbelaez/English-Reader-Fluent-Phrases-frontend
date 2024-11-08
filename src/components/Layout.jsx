import React from 'react';
import { useBook } from '../context/BookContext';
import Navbar from './Navbar';
import BookList from './BookList';
import BookReader from './BookReader';
import logo from '../assets/logo.png';
import { FaLinkedin, FaGithub } from 'react-icons/fa'; // Importar íconos de react-icons
//import SearchBar from './SearchBar';

const Layout = () => {
  const { currentBook } = useBook();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
       {/* Header con el logo */}
       <header className="flex justify-center py-1 mb-3">
      <img src={logo} alt="Logo" className="w-20 h-20"/>
      </header>
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
      <footer className="mt-6 text-center text-green-700 py-4">
  <div className="inline-flex px-4 flex-col  md:flex-row bg-black/90 rounded py-2 justify-center items-center space-x-0 md:space-x-4">
    <p >
      Creado por{' '}
      <a
        href="https://josuealbelaez.netlify.app/"
        target="_blank"
        rel="noopener noreferrer"
        className="text-green-700 font-bold hover:text-white shadow hover:shadow-green-900/60 transition duration-300"
      >
        JOSUÉ ALBELÁEZ
      </a>
    </p>
    <div className="flex justify-center space-x-4 mt-4 md:mt-0">
      <a
        href="https://www.linkedin.com/in/juanjosuealbelaez/"
        target="_blank"
        rel="noopener noreferrer"
        className="text-green-700 hover:text-white shadow hover:shadow-green-900/60 transition duration-300"
      >
        <FaLinkedin size={24} />
      </a>
      <a
        href="https://github.com/JosueAlbelaez"
        target="_blank"
        rel="noopener noreferrer"
       className="text-green-700 hover:text-white shadow hover:shadow-green-900/60 transition duration-300"
      >
        <FaGithub size={24} />
      </a>
    </div>
  </div>
</footer>

    </div>
  );
};

export default Layout;