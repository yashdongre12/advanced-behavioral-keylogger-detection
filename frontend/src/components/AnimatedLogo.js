// components/AnimatedLogo.js
// Animated shield + key + circuit board SVG logo for Login / Register pages
import React from 'react';

export default function AnimatedLogo({ size = 120 }) {
  return (
    <div style={{ width: size, height: size, position: 'relative', margin: '0 auto' }}>
      <style>{`
        @keyframes shieldPulse {
          0%, 100% { filter: drop-shadow(0 0 8px #c8ff0066) drop-shadow(0 0 20px #c8ff0033); }
          50%       { filter: drop-shadow(0 0 18px #c8ff0099) drop-shadow(0 0 40px #c8ff0055); }
        }
        @keyframes keyFloat {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-3px); }
        }
        @keyframes circuitDraw {
          0%   { stroke-dashoffset: 120; opacity: 0.3; }
          50%  { stroke-dashoffset: 0;   opacity: 1; }
          100% { stroke-dashoffset: 120; opacity: 0.3; }
        }
        @keyframes dotPulse {
          0%, 100% { opacity: 0.4; r: 2.5; }
          50%       { opacity: 1;   r: 3.5; }
        }
        @keyframes shieldSpin {
          0%   { transform: rotate(0deg) scale(1); }
          50%  { transform: rotate(0deg) scale(1.04); }
          100% { transform: rotate(0deg) scale(1); }
        }
        @keyframes ringRotate {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .shield-group { animation: shieldPulse 2.5s ease-in-out infinite, shieldSpin 3s ease-in-out infinite; }
        .key-group    { animation: keyFloat 3s ease-in-out infinite; transform-origin: center; }
        .circuit-l    { stroke-dasharray: 120; animation: circuitDraw 3s ease-in-out infinite; }
        .circuit-r    { stroke-dasharray: 120; animation: circuitDraw 3s ease-in-out infinite 0.4s; }
        .dot-l        { animation: dotPulse 3s ease-in-out infinite; }
        .dot-r        { animation: dotPulse 3s ease-in-out infinite 0.2s; }
      `}</style>

      <svg
        viewBox="0 0 120 120"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Defs: gradients + glow filter */}
        <defs>
          <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#c8ff00" stopOpacity="0.9"/>
            <stop offset="100%" stopColor="#00d4ff" stopOpacity="0.7"/>
          </linearGradient>
          <linearGradient id="keyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#c8ff00"/>
            <stop offset="100%" stopColor="#00d4ff" stopOpacity="0.8"/>
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* ── Circuit lines LEFT ───────────────────────────── */}
        <g stroke="url(#shieldGrad)" strokeWidth="1.2" fill="none" filter="url(#glow)">
          {/* top-left branch */}
          <polyline className="circuit-l" points="32,45 18,45 10,37"/>
          {/* mid-left branch */}
          <polyline className="circuit-l" points="28,60 14,60 6,60"/>
          {/* bottom-left branch */}
          <polyline className="circuit-l" points="32,75 18,75 10,83"/>
          {/* secondary top-left */}
          <polyline className="circuit-l" points="28,50 22,50 16,44"/>
          {/* secondary bottom-left */}
          <polyline className="circuit-l" points="28,70 22,70 16,76"/>
        </g>

        {/* ── Circuit dot endpoints LEFT ───────────────────── */}
        <g fill="#c8ff00" filter="url(#glow)">
          <circle className="dot-l" cx="10" cy="37" r="2.5"/>
          <circle className="dot-l" cx="6"  cy="60" r="2.5"/>
          <circle className="dot-l" cx="10" cy="83" r="2.5"/>
          <circle className="dot-l" cx="16" cy="44" r="2"/>
          <circle className="dot-l" cx="16" cy="76" r="2"/>
        </g>

        {/* ── Circuit lines RIGHT ──────────────────────────── */}
        <g stroke="url(#shieldGrad)" strokeWidth="1.2" fill="none" filter="url(#glow)">
          <polyline className="circuit-r" points="88,45 102,45 110,37"/>
          <polyline className="circuit-r" points="92,60 106,60 114,60"/>
          <polyline className="circuit-r" points="88,75 102,75 110,83"/>
          <polyline className="circuit-r" points="92,50 98,50 104,44"/>
          <polyline className="circuit-r" points="92,70 98,70 104,76"/>
        </g>

        {/* ── Circuit dot endpoints RIGHT ─────────────────── */}
        <g fill="#00d4ff" filter="url(#glow)">
          <circle className="dot-r" cx="110" cy="37" r="2.5"/>
          <circle className="dot-r" cx="114" cy="60" r="2.5"/>
          <circle className="dot-r" cx="110" cy="83" r="2.5"/>
          <circle className="dot-r" cx="104" cy="44" r="2"/>
          <circle className="dot-r" cx="104" cy="76" r="2"/>
        </g>

        {/* ── Shield ──────────────────────────────────────── */}
        <g className="shield-group" style={{ transformOrigin: '60px 60px' }}>
          {/* Outer shield */}
          <path
            d="M60 10 L88 22 L88 55 C88 77 74 92 60 100 C46 92 32 77 32 55 L32 22 Z"
            fill="rgba(200,255,0,0.06)"
            stroke="url(#shieldGrad)"
            strokeWidth="2"
            filter="url(#glow)"
          />
          {/* Inner shield cut */}
          <path
            d="M60 20 L82 30 L82 55 C82 72 70 85 60 92 C50 85 38 72 38 55 L38 30 Z"
            fill="rgba(0,212,255,0.04)"
            stroke="rgba(200,255,0,0.3)"
            strokeWidth="1"
          />
        </g>

        {/* ── Key ─────────────────────────────────────────── */}
        <g className="key-group" style={{ transformOrigin: '60px 60px' }} filter="url(#glow)">
          {/* Key ring (circle) */}
          <circle cx="60" cy="45" r="10" fill="none" stroke="url(#keyGrad)" strokeWidth="2.5"/>
          {/* Key hole */}
          <circle cx="60" cy="45" r="3.5" fill="rgba(0,0,0,0.8)" stroke="url(#keyGrad)" strokeWidth="1"/>
          {/* Key stem */}
          <line x1="60" y1="55" x2="60" y2="78" stroke="url(#keyGrad)" strokeWidth="2.5" strokeLinecap="round"/>
          {/* Key teeth */}
          <line x1="60" y1="63" x2="65" y2="63" stroke="url(#keyGrad)" strokeWidth="2" strokeLinecap="round"/>
          <line x1="60" y1="70" x2="67" y2="70" stroke="url(#keyGrad)" strokeWidth="2" strokeLinecap="round"/>
          <line x1="60" y1="76" x2="64" y2="76" stroke="url(#keyGrad)" strokeWidth="2" strokeLinecap="round"/>
        </g>

        {/* ── Rotating outer ring ─────────────────────────── */}
        <circle
          cx="60" cy="60" r="26"
          fill="none"
          stroke="rgba(200,255,0,0.12)"
          strokeWidth="1"
          strokeDasharray="6 4"
          style={{ animation: 'ringRotate 12s linear infinite', transformOrigin: '60px 60px' }}
        />
      </svg>
    </div>
  );
}
