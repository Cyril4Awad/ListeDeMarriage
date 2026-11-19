import React from 'react';

/* The wax seal. `initials` is ['M', 'K'] for a monogram, or one mark (e.g. '&') for the sign-in page. */
export function Seal({ initials, label, className = '' }) {
    const id = React.useMemo(() => `ldm-wax-${Math.random().toString(36).slice(2, 8)}`, []);
    return (
        <svg className={`ldm-seal ${className}`} viewBox="0 0 120 120" role="img" aria-label={label}>
            <defs>
                <radialGradient id={id} cx="38%" cy="32%" r="75%">
                    <stop offset="0%" stopColor="var(--ldm-wax-lit)" />
                    <stop offset="60%" stopColor="var(--ldm-wax)" />
                    <stop offset="100%" stopColor="var(--ldm-wax-deep)" />
                </radialGradient>
            </defs>
            <path
                fill={`url(#${id})`}
                d="M60 4c8 0 11 5 18 7s13 0 18 6 2 12 6 18 10 9 10 17-6 11-7 18 3 13-2 19-12 4-18 8-8 11-16 12-12-4-19-4-12 6-19 3-6-10-11-15-12-6-14-13 3-12 1-19-7-11-3-18 11-7 15-12 3-12 9-16 12 0 19-3 8-8 15-8z"
            />
            <circle cx="60" cy="60" r="34" fill="none" stroke="var(--ldm-wax-line)" strokeWidth="1" />
            <circle cx="60" cy="60" r="30" fill="none" stroke="var(--ldm-wax-line)" strokeWidth="0.6" strokeDasharray="1 3" />
            {initials.length === 2 ? (
                <text x="60" y="68" textAnchor="middle" className="ldm-seal-text">
                    {initials[0]}
                    <tspan className="ldm-seal-amp" dx="2" dy="-2">&amp;</tspan>
                    <tspan dx="2" dy="2">{initials[1]}</tspan>
                </text>
            ) : (
                <text x="60" y="75" textAnchor="middle" className="ldm-seal-text ldm-seal-mark">{initials[0]}</text>
            )}
        </svg>
    );
}

export const Flourish = ({ className = '' }) => (
    <svg className={`ldm-flourish ${className}`} viewBox="0 0 240 16" aria-hidden="true">
        <path d="M2 8h96" />
        <path d="M142 8h96" />
        <path d="M104 8c4-6 10-6 16 0s12 6 16 0" />
        <path d="M104 8c4 6 10 6 16 0s12-6 16 0" />
        <circle cx="120" cy="8" r="1.6" />
    </svg>
);
