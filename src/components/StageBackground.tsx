export function StageBackground() {
  return (
    <svg className="stage-background" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="stage-radial" cx="48%" cy="45%" r="63%">
          <stop offset="0" stopColor="#12345c" stopOpacity=".48" />
          <stop offset=".52" stopColor="#071326" stopOpacity=".45" />
          <stop offset="1" stopColor="#02040a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="stage-line" x1="0" x2="1">
          <stop stopColor="#69d2ff" stopOpacity="0" />
          <stop offset=".5" stopColor="#69d2ff" stopOpacity=".42" />
          <stop offset="1" stopColor="#69d2ff" stopOpacity="0" />
        </linearGradient>
        <pattern id="micro-grid" width="64" height="64" patternUnits="userSpaceOnUse">
          <path d="M64 0H0V64" fill="none" stroke="#80cfff" strokeOpacity=".045" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="1920" height="1080" fill="url(#stage-radial)" />
      <rect width="1920" height="1080" fill="url(#micro-grid)" />
      <g className="ambient-rings" fill="none" stroke="#65cfff">
        <circle cx="900" cy="535" r="368" strokeOpacity=".08" />
        <circle cx="900" cy="535" r="294" strokeOpacity=".11" strokeDasharray="5 18" />
        <circle cx="900" cy="535" r="222" strokeOpacity=".07" />
        <path d="M398 535h1004M900 34v1002" strokeOpacity=".06" />
        <path d="M530 165l740 740M1270 165L530 905" strokeOpacity=".035" />
      </g>
      <g fill="#9bdeff">
        <circle cx="190" cy="170" r="2" opacity=".28" />
        <circle cx="430" cy="910" r="2" opacity=".22" />
        <circle cx="1480" cy="160" r="2" opacity=".3" />
        <circle cx="1640" cy="780" r="2" opacity=".22" />
        <circle cx="1240" cy="945" r="1.5" opacity=".26" />
      </g>
      <path d="M0 114h540l74 42h692l74-42h540" fill="none" stroke="url(#stage-line)" />
      <path d="M0 966h540l74-42h692l74 42h540" fill="none" stroke="url(#stage-line)" opacity=".55" />
    </svg>
  );
}
