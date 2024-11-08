import React from 'react';

const AudioProgressBar = ({ progress }) => {
  return (
    <div className="relative flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
      <div
        className="absolute h-full bg-blue-500 rounded-full transition-all duration-75"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};

export default AudioProgressBar;