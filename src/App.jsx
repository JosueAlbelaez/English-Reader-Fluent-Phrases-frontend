import React from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { BookProvider } from './context/BookContext';
import Layout from './components/Layout';
import './styles/index.css';

function App() {
  return (
    <ThemeProvider>
      <BookProvider>
        <Layout />
      </BookProvider>
    </ThemeProvider>
  );
}

export default App;