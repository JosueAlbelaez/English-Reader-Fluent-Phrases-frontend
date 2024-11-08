import React from 'react';
import { Play, Pause, FastForward, Rewind } from 'lucide-react';
import ProgressBar from './ProgressBar';

const AudioControls = ({ isPlaying, onPlayPause, onForward, onRewind, progress, onSeek }) => {
  return (
    <div className="flex items-center space-x-4">
      <button
        onClick={onRewind}
        className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        <Rewind className="w-5 h-5" />
      </button>

      <button
        onClick={onPlayPause}
        className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        {isPlaying ? (
          <Pause className="w-6 h-6" />
        ) : (
          <Play className="w-6 h-6" />
        )}
      </button>

      <button
        onClick={onForward}
        className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        <FastForward className="w-5 h-5" />
      </button>

      <div className="flex-1 mx-4">
        <ProgressBar progress={progress} onSeek={onSeek} />
      </div>
    </div>
  );
};

export default AudioControls;