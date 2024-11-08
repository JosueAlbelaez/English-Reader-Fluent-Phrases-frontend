import React from 'react';

const ProgressBar = ({ progress, onSeek }) => {
  const handleClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    if (onSeek) {
      onSeek(Math.min(100, Math.max(0, percentage)));
    }
  };

  return (
    <div
      className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full cursor-pointer"
      onClick={handleClick}
    >
      <div
        className="absolute h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-150"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};

export default ProgressBar;