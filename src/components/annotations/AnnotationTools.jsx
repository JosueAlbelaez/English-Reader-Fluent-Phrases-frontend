import React, { useState } from 'react';
import { Highlighter, StickyNote, X } from 'lucide-react';
import { usePDF } from '../../context/PDFContext';
import { usePDFReader } from '../../hooks/usePDFReader';

const AnnotationTools = () => {
  const [activeMode, setActiveMode] = useState(null);
  const [noteText, setNoteText] = useState('');
  const { pdfData, annotations, setAnnotations } = usePDF();
  const { addAnnotation } = usePDFReader();

  const handleAddAnnotation = async (type, content = '') => {
    if (!pdfData) return;

    const selection = window.getSelection();
    if (!selection.toString() && type === 'highlight') return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    const newAnnotation = {
      type,
      content: type === 'highlight' ? selection.toString() : content,
      position: {
        pageIndex: 1, // Actualizar según la página actual
        boundingRect: {
          x1: rect.left,
          y1: rect.top,
          x2: rect.right,
          y2: rect.bottom,
        }
      }
    };

    try {
      await addAnnotation(pdfData._id, newAnnotation);
      setAnnotations([...annotations, newAnnotation]);
      if (type === 'highlight') {
        selection.removeAllRanges();
      }
    } catch (error) {
      console.error('Error adding annotation:', error);
    }
  };

  return (
    <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-2 rounded-lg shadow">
      <button
        onClick={() => setActiveMode(activeMode === 'highlight' ? null : 'highlight')}
        className={`p-2 rounded ${
          activeMode === 'highlight' 
            ? 'bg-primary-100 dark:bg-primary-900 text-primary-600' 
            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
        }`}
      >
        <Highlighter className="w-5 h-5" />
      </button>
      <button
        onClick={() => setActiveMode(activeMode === 'note' ? null : 'note')}
        className={`p-2 rounded ${
          activeMode === 'note' 
            ? 'bg-primary-100 dark:bg-primary-900 text-primary-600' 
            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
        }`}
      >
        <StickyNote className="w-5 h-5" />
      </button>

      {activeMode === 'note' && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add note..."
            className="px-3 py-1 border rounded dark:bg-gray-700 dark:border-gray-600"
          />
          <button
            onClick={() => {
              if (noteText.trim()) {
                handleAddAnnotation('note', noteText);
                setNoteText('');
                setActiveMode(null);
              }
            }}
            className="p-2 rounded bg-primary-600 text-white hover:bg-primary-700"
          >
            Add
          </button>
          <button
            onClick={() => setActiveMode(null)}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default AnnotationTools;