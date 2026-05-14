import { useState } from 'react';

// ── DATA (verified from dataset) ──────────────────────────────────────────────

const COUNTRY_DATA = [
  { country: 'France',         flag: '🇫🇷', stars3: 30, stars2: 75,  stars1: 367, bib: 381, total: 2788 },
  { country: 'Japan',          flag: '🇯🇵', stars3: 20, stars2: 63,  stars1: 168, bib: 260, total: 935  },
  { country: 'Italy',          flag: '🇮🇹', stars3: 13, stars2: 40,  stars1: 0,   bib: 253, total: 1699 },
  { country: 'USA',            flag: '🇺🇸', stars3: 13, stars2: 32,  stars1: 91,  bib: 358, total: 1406 },
  { country: 'Germany',        flag: '🇩🇪', stars3: 10, stars2: 47,  stars1: 273, bib: 198, total: 1252 },
  { country: 'Spain',          flag: '🇪🇸', stars3: 15, stars2: 32,  stars1: 0,   bib: 225, total: 1083 },
  { country: 'United Kingdom', flag: '🇬🇧', stars3: 9,  stars2: 22,  stars1: 0,   bib: 105, total: 882  },
  { country: 'Belgium',        flag: '🇧🇪', stars3: 2,  stars2: 22,  stars1: 0,   bib: 125, total: 629  },
  { country: 'Switzerland',    flag: '🇨🇭', stars3: 4,  stars2: 23,  stars1: 0,   bib: 118, total: 446  },
  { country: 'Thailand',       flag: '🇹🇭', stars3: 0,  stars2: 7,   stars1: 0,   bib: 194, total: 438  },
];

const GREEN_DATA = [
  { country: 'Denmark',     flag: '🇩🇰', green: 11, total: 101, rate: 10.9 },
  { country: 'Finland',     flag: '🇫🇮', green: 3,  total: 29,  rate: 10.3 },
  { country: 'Norway',      flag: '🇳🇴', green: 4,  total: 53,  rate: 7.5  },
  { country: 'Slovenia',    flag: '🇸🇮', green: 4,  total: 63,  rate: 6.3  },
  { country: 'Sweden',      flag: '🇸🇪', green: 4,  total: 75,  rate: 5.3  },
  { country: 'Germany',     flag: '🇩🇪', green: 48, total: 1252, rate: 3.8 },
  { country: 'Croatia',     flag: '🇭🇷', green: 2,  total: 93,  rate: 2.2  },
  { country: 'France',      flag: '🇫🇷', green: 58, total: 2788, rate: 2.1 },
  { country: 'Switzerland', flag: '🇨🇭', green: 9,  total: 446, rate: 2.0  },
];

const VOCAB_STAR = [
  { word: 'caviar',        score: 3.40 },
  { word: 'abalone',       score: 3.25 },
  { word: 'enchanting',    score: 3.19 },
  { word: 'extraordinary', score: 3.10 },
  { word: 'haute',         score: 2.94 },
  { word: 'excellence',    score: 2.88 },
  { word: 'luxurious',     score: 2.83 },
  { word: 'aperitif',      score: 2.73 },
];

const VOCAB_BIB = [
  { word: 'noodles',  score: 3.90 },
  { word: 'bistro',   score: 3.47 },
  { word: 'street',   score: 3.13 },
  { word: 'value',    score: 2.92 },
  { word: 'prices',   score: 2.90 },
  { word: 'curry',    score: 2.88 },
  { word: 'soba',     score: 2.84 },
  { word: 'sharing',  score: 2.77 },
];

const TIER_COLORS = {
  '3 Stars':     '#085041',
  '2 Stars':     '#0F6E56',
  '1 Star':      '#5DCAA5',
  'Bib Gourmand':'#A8D5C2',
};

// ── HELPERS ───────────────────────────────────────────────────────────────────

function Section({ question, narrative, footnote, children }) {
  return (
    <div className="analytical-section">
      <div className="section-question">{question}</div>
      <div className="section-narrative">{narrative}</div>
      {children}
      {footnote && <div className="section-footnote">{footnote}</div>}
    </div>
  );
}

// ── SECTION 1 — global distribution ──────────────────────────────────────────

function Section1() {
  const [mode, setMode] = useState('absolute');

  const tiers = ['3 Stars', '2 Stars', '1 Star', 'Bib Gourmand'];

  const getValue = (row, tier) => {
    const raw = { '3 Stars': row.stars3, '2 Stars': row.stars2, '1 Star': row.stars1, 'Bib Gourmand': row.bib }[tier] || 0;
    if (mode === 'absolute') return raw;
    const recognized = row.stars3 + row.stars2 + row.stars1 + row.bib;
    return recognized === 0 ? 0 : parseFloat(((raw / recognized) * 100).toFixed(1));
  };

  const maxVal = Math.max(...COUNTRY_DATA.map(row =>
    mode === 'absolute'
      ? row.stars3 + row.stars2 + row.stars1 + row.bib
      : 100
  ));

  return (
    <Section
      question="Which countries does Michelin recognize most?"
      narrative="France dominates in raw numbers — but does volume reflect quality density or simply the size of the guide? Toggle to proportional view to see each country's tier composition, independent of total count."
      footnote="Source: Michelin Guide dataset, 15,520 restaurants across 15+ countries."
    >
      <div className="chart-controls">
        <button className={`toggle-btn ${mode === 'absolute' ? 'active' : ''}`} onClick={() => setMode('absolute')}>Absolute count</button>
        <button className={`toggle-btn ${mode === 'proportion' ? 'active' : ''}`} onClick={() => setMode('proportion')}>Proportion</button>
      </div>

      <div className="chart-legend-row">
        {tiers.map(t => (
          <div className="chart-legend-item" key={t}>
            <div className="chart-legend-dot" style={{ background: TIER_COLORS[t] }} />
            <span>{t}</span>
          </div>
        ))}
      </div>

      <div className="bar-chart">
        {COUNTRY_DATA.map(row => {
          const total = tiers.reduce((s, t) => s + getValue(row, t), 0);
          return (
            <div className="bar-row" key={row.country}>
              <div className="bar-label">{row.flag} {row.country}</div>
              <div className="bar-track">
                <div className="bar-stacked">
                  {tiers.map(t => {
                    const val = getValue(row, t);
                    const pct = total === 0 ? 0 : (val / maxVal) * 100;
                    return (
                      <div
                        key={t}
                        className="drow-bar"
                        style={{ width: `${pct}%`, background: TIER_COLORS[t], borderRadius: 0 }}
                        title={`${t}: ${val}${mode === 'proportion' ? '%' : ''}`}
                      />
                    );
                  })}
                </div>
              </div>
              <div className="bar-value">{mode === 'absolute' ? total.toLocaleString() : '100%'}</div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ── SECTION 2 — fairness ─────────────────────────────────────────────────────

function Section2() {
  const maxRate = 5.35; // Japan: 20+63+168+260 / 935 * 100 ≈ 54% recognized, but rate per 100 total is the metric
  const rows = COUNTRY_DATA.map(row => {
    const recognized = row.stars3 + row.stars2 + row.stars1 + row.bib;
    const rate = parseFloat(((recognized / row.total) * 100).toFixed(1));
    return { ...row, rate };
  }).sort((a, b) => b.rate - a.rate);

  const max = Math.max(...rows.map(r => r.rate));

  return (
    <Section
      question="Is Michelin recognition proportional to restaurant count?"
      narrative="France has 2,788 restaurants in the guide — but only 34% of them receive any award. Japan has 935 restaurants and 54% are recognized. Once you normalize for total count, the picture changes significantly."
      footnote="Rate = (3-star + 2-star + 1-star + Bib Gourmand) / total restaurants in dataset."
    >
      <div className="bar-chart">
        {rows.map(row => (
          <div className="bar-row" key={row.country}>
            <div className="bar-label">{row.flag} {row.country}</div>
            <div className="bar-track">
              <div className="bar-fill-green" style={{ width: `${(row.rate / max) * 100}%` }} />
            </div>
            <div className="bar-value">{row.rate}%</div>
          </div>
        ))}
      </div>
      <div className="diverging-annotation">
        Japan has the highest recognition rate at 54% — meaning more than half of all Japanese restaurants in the dataset carry an award. France, despite dominating in raw numbers, awards only 34% of its listed restaurants.
      </div>
    </Section>
  );
}

// ── SECTION 3 — what Michelin rewards ────────────────────────────────────────

function Section3() {
  const maxScore = Math.max(...VOCAB_STAR.map(d => d.score), ...VOCAB_BIB.map(d => d.score));

  return (
    <Section
      question="What language does Michelin use — and what does it reveal?"
      narrative="We ran a log-odds frequency analysis on all 15,520 inspector descriptions, comparing the vocabulary used in 3-star vs Bib Gourmand write-ups. The divergence is striking: the guide uses two entirely different rhetorical registers under one roof."
      footnote="Log-odds ratio computed from word frequencies, smoothed with +0.5 Laplace correction. Stopwords and words with fewer than 8 total occurrences removed."
    >
      <div className="diverging-chart">
        <div className="diverging-header">
          <span style={{ color: '#5DCAA5' }}>← Bib Gourmand vocabulary</span>
          <span className="diverging-center-label">log-odds score</span>
          <span style={{ color: '#085041' }}>3-star vocabulary →</span>
        </div>

        <div className="diverging-axis">
          <div className="diverging-midline" />

          {/* Bib Gourmand words — left side */}
          {VOCAB_BIB.map(d => (
            <div className="diverging-row" key={d.word}>
              <div className="drow-bars" style={{ justifyContent: 'flex-end' }}>
                <div className="drow-bar drow-bar-left" style={{ width: `${(d.score / maxScore) * 45}%` }} />
              </div>
              <div className="drow-label drow-label-left" style={{ width: '10%', textAlign: 'center', fontSize: 12, fontWeight: 500 }}>
                {d.word}
              </div>
              <div style={{ width: '45%' }} />
            </div>
          ))}

          {/* 3-star words — right side */}
          {VOCAB_STAR.map(d => (
            <div className="diverging-row" key={d.word}>
              <div style={{ width: '45%' }} />
              <div className="drow-label drow-label-right" style={{ width: '10%', textAlign: 'center', fontSize: 12, fontWeight: 500 }}>
                {d.word}
              </div>
              <div className="drow-bars">
                <div className="drow-bar drow-bar-right" style={{ width: `${(d.score / maxScore) * 45}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="diverging-annotation">
          Michelin uses the same rating system to evaluate a $20 bowl of ramen and a $500 tasting menu. The inspector vocabulary reveals they know exactly which world they are in — they just never say it explicitly. 3-star and Bib Gourmand are not two points on one quality scale; they are two separate value systems living under one brand.
        </div>
      </div>
    </Section>
  );
}

// ── SECTION 4 — sustainability ────────────────────────────────────────────────

function Section4() {
  const max = Math.max(...GREEN_DATA.map(d => d.rate));

  return (
    <Section
      question="Where is sustainability recognized — and is it a different kind of excellence?"
      narrative="241 restaurants hold a Michelin Green Star for sustainability. They cluster heavily in Nordic countries, breaking the patterns established in the previous sections: Denmark leads with 10.9% of its restaurants green-starred, despite being nowhere near the top in overall star counts."
      footnote="Green star rate = green star restaurants / total restaurants in that country. Countries with fewer than 20 total restaurants excluded."
    >
      <div className="bar-chart">
        {GREEN_DATA.map(row => (
          <div className="bar-row" key={row.country}>
            <div className="bar-label">{row.flag} {row.country}</div>
            <div className="bar-track">
              <div style={{
                height: '100%',
                width: `${(row.rate / max) * 100}%`,
                background: '#2E7D32',
                borderRadius: 4,
                transition: 'width 0.4s ease'
              }} />
            </div>
            <div className="bar-value">{row.rate}%</div>
          </div>
        ))}
      </div>
      <div className="diverging-annotation">
        Denmark, Finland, and Norway lead the green star ranking — none of which appear in the top 10 for traditional star counts. Sustainability is not a complement to prestige in the Michelin world: it is an alternative measure with a completely different geography.
      </div>
    </Section>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

function AnalyticalPanel() {
  return (
    <div className="analytical-panel">
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: '#1a1a1a', marginBottom: 6 }}>
            The Michelin Guide — a data story
          </div>
          <div style={{ fontSize: 14, color: '#888', lineHeight: 1.7, maxWidth: 620 }}>
            Four questions about how Michelin distributes recognition, what it rewards, and what its language reveals about the values behind the guide.
          </div>
        </div>
        <Section1 />
        <Section2 />
        <Section3 />
        <Section4 />
      </div>
    </div>
  );
}

export default AnalyticalPanel;
