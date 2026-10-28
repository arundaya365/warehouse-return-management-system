import React from 'react';

/**
 * Calm Teal Enterprise Background
 * Subtle ambient teal blooms & clean neutral backdrop ensuring maximum text legibility and low visual fatigue.
 */
export const BackgroundFloating3D: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* 1. Calm Neutral Slate Base */}
      <div className="absolute inset-0 bg-[#F8FAFC]" />

      {/* 2. Soft Ambient Calm Teal Radial Blooms */}
      <div className="absolute -top-32 -left-32 w-[600px] h-[600px] bg-teal-500/5 rounded-full blur-[140px]" />
      <div className="absolute top-1/3 -right-24 w-[550px] h-[550px] bg-teal-600/4 rounded-full blur-[150px]" />
      <div className="absolute -bottom-32 left-1/3 w-[650px] h-[650px] bg-slate-400/5 rounded-full blur-[160px]" />

      {/* 3. Subtle Clean Geometric Waves */}
      <svg
        className="absolute inset-0 w-full h-full opacity-20 motion-safe:animate-wave-flow"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="tealFlow1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0F766E" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#14B8A6" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#94A3B8" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="tealFlow2" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#115E59" stopOpacity="0.3" />
            <stop offset="60%" stopColor="#2DD4BF" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#CBD5E1" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        <path
          d="M -100 250 C 300 120, 600 420, 1100 180 C 1300 90, 1500 280, 1600 210"
          fill="none"
          stroke="url(#tealFlow1)"
          strokeWidth="2"
        />
        <path
          d="M -50 490 C 350 340, 750 670, 1200 390 C 1400 280, 1550 470, 1650 440"
          fill="none"
          stroke="url(#tealFlow2)"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
};
