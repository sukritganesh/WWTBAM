interface BrandMarkProps {
  compact?: boolean;
}

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <div className={`brand-mark ${compact ? 'brand-mark--compact' : ''}`} aria-label="One Million">
      <svg viewBox="0 0 160 160" aria-hidden="true" className="brand-mark__orb">
        <defs>
          <linearGradient id="brand-edge" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#eefbff" />
            <stop offset="0.5" stopColor="#62cfff" />
            <stop offset="1" stopColor="#1c61b3" />
          </linearGradient>
        </defs>
        <circle cx="80" cy="80" r="66" fill="none" stroke="currentColor" opacity=".18" />
        <circle cx="80" cy="80" r="50" fill="none" stroke="url(#brand-edge)" strokeWidth="2" />
        <circle cx="80" cy="80" r="59" fill="none" stroke="currentColor" strokeDasharray="2 8" opacity=".5" />
        <path d="M80 8v28M80 124v28M8 80h28M124 80h28" stroke="currentColor" strokeWidth="2" />
        <path d="M52 105V55h14l14 13 14-13h14v50H92V78L80 89 68 78v27z" fill="url(#brand-edge)" />
      </svg>
      <div className="brand-mark__copy">
        <span className="brand-mark__eyebrow">The Knowledge Ascent</span>
        <strong>ONE MILLION</strong>
      </div>
    </div>
  );
}
