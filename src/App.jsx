import { useEffect, useState, useMemo } from 'react';
import Papa from 'papaparse';
import './App.css';
import 'leaflet/dist/leaflet.css';
import MapDisplay from './MapDisplay';
import AnalyticalPanel from './components/AnalyticalPanel';

const OCCASION_VIBES = {
  Special:   ['enchanting','elegant','exclusive','luxury','exquisite','intimate','romantic'],
  Romantic:  ['romantic','intimate','candlelit','cozy','quiet','charming','elegant'],
  Casual:    ['bistro','street','noodle','ramen','value','local','simple','relaxed'],
  Business:  ['refined','sophisticated','service','prestigious','quiet','formal'],
};
const TOP_CUISINES = ['Modern Cuisine','Japanese','French','Italian','Seafood','Creative','Contemporary','Street Food'];

// Shared encoding maps — single source of truth
const STAR_MAP   = { '★':1, '★★':2, '★★★':3 };
const BUDGET_MAP = { '$':1, '$$':2, '$$$':3, '$$$$':4 };

// Award parser: returns 1 | 2 | 3 | 'bib' | 'selected'
const parseAward = (rawAward) => {
  const s = String(rawAward || '').toLowerCase().trim();
  if (s.startsWith('3')) return 3;
  if (s.startsWith('2')) return 2;
  if (s.startsWith('1')) return 1;
  if (s.includes('bib')) return 'bib';
  return 'selected';
};

// Price tier: count currency symbols (works for $, €, ¥, ₩ — anything non-alphanumeric)
const parsePriceTier = (rawPrice) => {
  return String(rawPrice || '').replace(/[\w\s]/g, '').length;
};

// Does a restaurant satisfy a single star/bib pill selection?
const matchesStarPill = (parsedAward, pill) => {
  if (pill === 'Bib') return parsedAward === 'bib';
  const target = STAR_MAP[pill];
  return target !== undefined && parsedAward === target;
};

export default function App() {
  const [data, setData]               = useState([]);
  const [activePanel, setActivePanel] = useState('explore');
  const [mapCenter, setMapCenter]     = useState([37.5665, 126.9780]);
  const [wizardStep, setWizardStep]   = useState(0);
  const [mode, setMode]               = useState(null);
  const [travelMode, setTravelMode]   = useState(false);

  const [plannerPrefs, setPlannerPrefs] = useState({ occasion:[], budget:[], cuisine:[], stars:[], greenStar:false });
  const [partnerPrefs, setPartnerPrefs] = useState({ cuisine:[], vibe:[] });

  // Geolocation
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      p => setMapCenter([p.coords.latitude, p.coords.longitude]),
      () => {}
    );
  }, []);

  // Load CSV
  useEffect(() => {
    fetch('/michelin_guide_restaurant_data.csv')
      .then(r => r.text())
      .then(csv => {
        Papa.parse(csv, {
          header: true, skipEmptyLines: true,
          complete: ({ data: rows }) => {
            const clean = rows
              .map(row => { const r={}; Object.keys(row).forEach(k=>{r[k.trim()]=row[k];}); return r; })
              .filter(r => r.name || r.Name);
            setData(clean);
          }
        });
      });
  }, []);

  // ─────────────────────────────────────────────────────────────────────
  //  SOFT SCORE — used for ranking, top-3 ring, pin luminance, % match
  //  Returns [0,1]. Does NOT decide inclusion (hard filter does).
  // ─────────────────────────────────────────────────────────────────────
  const computeScore = (res) => {
    const parsed  = parseAward(res.award);
    const priceN  = parsePriceTier(res.price_usd);
    const cuisine = String(res.cuisine || '').toLowerCase();
    const isGreen = res.greenstar === '1';
    const desc    = String(res.description || '').toLowerCase();
    let score = 0, total = 0;

    if (plannerPrefs.stars.length) {
      total += 30;
      if (plannerPrefs.stars.some(s => matchesStarPill(parsed, s))) score += 30;
    }
    if (plannerPrefs.occasion.length) {
      total += 25;
      const vibes = plannerPrefs.occasion.flatMap(o => OCCASION_VIBES[o] || []);
      const hits  = vibes.filter(v => desc.includes(v)).length;
      score += 25 * Math.min(hits / Math.max(vibes.length * 0.3, 1), 1);
    }
    if (plannerPrefs.budget.length) {
      total += 20;
      const maxB = Math.max(...plannerPrefs.budget.map(b => BUDGET_MAP[b] || 0));
      if (priceN === 0) score += 10;
      else if (priceN <= maxB) score += 20;
      else if (priceN === maxB + 1) score += 5;
    }
    if (plannerPrefs.cuisine.length) {
      total += 15;
      if (plannerPrefs.cuisine.some(c => cuisine.includes(c.toLowerCase()))) score += 15;
    }
    if (mode === 'couple' && partnerPrefs.cuisine.length) {
      total += 7;
      if (partnerPrefs.cuisine.some(c => cuisine.includes(c.toLowerCase()))) score += 7;
    }
    if (mode === 'couple' && partnerPrefs.vibe.length) {
      total += 5;
      const hits = partnerPrefs.vibe.filter(v => desc.includes(v.toLowerCase())).length;
      score += 5 * (hits / partnerPrefs.vibe.length);
    }
    if (plannerPrefs.greenStar) { total += 8; if (isGreen) score += 8; }

    return total === 0 ? 1 : Math.min(score / total, 1);
  };

  const hasFilters =
    plannerPrefs.occasion.length > 0 ||
    plannerPrefs.budget.length > 0 ||
    plannerPrefs.cuisine.length > 0 ||
    plannerPrefs.stars.length > 0 ||
    plannerPrefs.greenStar ||
    (mode === 'couple' && (partnerPrefs.cuisine.length > 0 || partnerPrefs.vibe.length > 0));

  // ─────────────────────────────────────────────────────────────────────
  //  HARD FILTER — only binary constraints exclude restaurants.
  //
  //  Hard:  stars/bib, budget, planner cuisine, greenStar
  //  Soft:  occasion, partner cuisine, partner vibe
  //
  //  Rationale: the planner's explicit choices are constraints they own.
  //  The partner's tastes are signals/hints — they should bias ranking,
  //  not exclude restaurants the planner already accepted.
  // ─────────────────────────────────────────────────────────────────────
  const filteredData = useMemo(() => {
    if (!hasFilters) return data;

    return data.filter(r => {
      // Hard: stars/bib
      if (plannerPrefs.stars.length > 0) {
        const parsed = parseAward(r.award);
        if (!plannerPrefs.stars.some(s => matchesStarPill(parsed, s))) return false;
      }

      // Hard: budget (priceN===0 = unknown → kept, to avoid silently dropping data)
      if (plannerPrefs.budget.length > 0) {
        const priceN = parsePriceTier(r.price_usd);
        const maxB   = Math.max(...plannerPrefs.budget.map(b => BUDGET_MAP[b] || 0));
        if (priceN > 0 && priceN > maxB) return false;
      }

      // Hard: planner cuisine (OR across selected — at least one must match)
      if (plannerPrefs.cuisine.length > 0) {
        const cuisine = String(r.cuisine || '').toLowerCase();
        if (!plannerPrefs.cuisine.some(c => cuisine.includes(c.toLowerCase()))) return false;
      }

      // Hard: green star pref
      if (plannerPrefs.greenStar && r.greenstar !== '1') return false;

      return true;
    });
  }, [data, plannerPrefs, partnerPrefs, mode, hasFilters]);

  // Travel mode: separate filter (bib or cheap), independent of wizard prefs
  const travelData = useMemo(() => {
    return data.filter(r => {
      const parsed = parseAward(r.award);
      const priceN = parsePriceTier(r.price_usd);
      return parsed === 'bib' || (priceN > 0 && priceN <= 1);
    });
  }, [data]);

  const matchCount  = (hasFilters && wizardStep === 3) ? filteredData.length : data.length;
  const displayData = travelMode ? travelData : filteredData;
  const noMatches   = hasFilters && wizardStep === 3 && filteredData.length === 0;

  const toggleP    = (g,v) => setPlannerPrefs(p => ({...p, [g]: p[g].includes(v) ? p[g].filter(x=>x!==v) : [...p[g], v]}));
  const togglePart = (g,v) => setPartnerPrefs(p => ({...p, [g]: p[g].includes(v) ? p[g].filter(x=>x!==v) : [...p[g], v]}));

  const reset = () => {
    setWizardStep(0); setMode(null);
    setPlannerPrefs({ occasion:[], budget:[], cuisine:[], stars:[], greenStar:false });
    setPartnerPrefs({ cuisine:[], vibe:[] });
  };

  const SOLO_OCCASIONS   = ['Special','Casual','Business'];
  const COUPLE_OCCASIONS = ['Special','Romantic','Casual'];
  const occasions   = mode === 'couple' ? COUPLE_OCCASIONS : SOLO_OCCASIONS;
  const steps       = mode === 'couple'
    ? ['Mode','Your preferences','Their tastes','Results']
    : ['Mode','Your preferences','Results'];
  const currentStep = Math.min(wizardStep, steps.length - 1);

  return (
    <div className="app-container">

      <header className="app-header">
        <div className="header-brand">
          <span className="brand-icon">✦</span>
          <span className="brand-name">Michelin Guide</span>
        </div>
        <div className="panel-tabs">
          <button className={`panel-tab ${activePanel==='explore'?'active':''}`} onClick={()=>setActivePanel('explore')}>Explore</button>
          <button className={`panel-tab ${activePanel==='analytical'?'active':''}`} onClick={()=>setActivePanel('analytical')}>Analytical</button>
        </div>
        <button className={`travel-btn ${travelMode?'travel-active':''}`} onClick={()=>setTravelMode(t=>!t)}>
          {travelMode ? '🎒 Exit travel mode' : '🎒 Budget travel'}
        </button>
      </header>

      {activePanel==='explore' && (
        <div className={`explore-layout ${travelMode?'travel-mode-active':''}`}>

          <div className="wizard-bar">
            <div className="wizard-steps">
              {steps.map((label,i)=>(
                <div key={label} className={`wizard-step-dot ${i<currentStep?'done':i===currentStep?'active':''}`}
                  onClick={()=>i<currentStep&&setWizardStep(i)}>
                  <div className="dot-circle">{i<currentStep?'✓':i+1}</div>
                  <div className="dot-label">{label}</div>
                </div>
              ))}
            </div>

            <div className="wizard-sep"/>

            {wizardStep===0 && (
              <div className="wizard-content">
                <span className="wizard-q">Who are you dining with?</span>
                <div className="mode-buttons">
                  <button className={`mode-btn alone ${mode==='alone'?'selected':''}`} onClick={()=>{setMode('alone');setWizardStep(1);}}>
                    <span className="mode-icon">🍽️</span><span>Solo / Friends</span>
                  </button>
                  <button className={`mode-btn couple ${mode==='couple'?'selected':''}`} onClick={()=>{setMode('couple');setWizardStep(1);}}>
                    <span className="mode-icon">🌹</span><span>Planning a date</span>
                  </button>
                </div>
              </div>
            )}

            {wizardStep===1 && (
              <div className="wizard-content">
                <span className="wizard-q">{mode==='couple'?'Your preferences (as the planner)':'Your preferences'}</span>
                <div className="pref-groups">
                  <div className="pref-group">
                    <span className="pref-label">Occasion</span>
                    <div className="pill-row">
                      {occasions.map(o=>(
                        <button key={o} className={`pill ${plannerPrefs.occasion.includes(o)?'pill-on':''}`} onClick={()=>toggleP('occasion',o)}>{o}</button>
                      ))}
                    </div>
                  </div>
                  <div className="pref-group">
                    <span className="pref-label">Award</span>
                    <div className="pill-row">
                      {['★★★','★★','★','Bib'].map(s=>(
                        <button key={s} className={`pill ${plannerPrefs.stars.includes(s)?'pill-on':''}`} onClick={()=>toggleP('stars',s)}>{s}</button>
                      ))}
                    </div>
                  </div>
                  <div className="pref-group">
                    <span className="pref-label">Budget</span>
                    <div className="pill-row">
                      {['$','$$','$$$','$$$$'].map(b=>(
                        <button key={b} className={`pill ${plannerPrefs.budget.includes(b)?'pill-on':''}`} onClick={()=>toggleP('budget',b)}>{b}</button>
                      ))}
                    </div>
                  </div>
                  <div className="pref-group">
                    <span className="pref-label">Cuisine</span>
                    <div className="pill-row">
                      {TOP_CUISINES.slice(0,5).map(c=>(
                        <button key={c} className={`pill ${plannerPrefs.cuisine.includes(c)?'pill-on':''}`} onClick={()=>toggleP('cuisine',c)}>{c}</button>
                      ))}
                    </div>
                  </div>
                  <div className="pref-group">
                    <button className={`pill pill-green-toggle ${plannerPrefs.greenStar?'pill-on-green':''}`}
                      onClick={()=>setPlannerPrefs(p=>({...p,greenStar:!p.greenStar}))}>🌿 Green Star</button>
                  </div>
                </div>
                <button className="wizard-next" onClick={()=>setWizardStep(mode==='couple'?2:3)}>
                  {mode==='couple'?'Next: Their tastes →':'See results →'}
                </button>
              </div>
            )}

            {wizardStep===2 && mode==='couple' && (
              <div className="wizard-content couple-step">
                <span className="wizard-q">💝 What do you know about their tastes?</span>
                <div className="pref-groups">
                  <div className="pref-group">
                    <span className="pref-label">Cuisine they might like</span>
                    <div className="pill-row">
                      {TOP_CUISINES.map(c=>(
                        <button key={c} className={`pill pill-pink ${partnerPrefs.cuisine.includes(c)?'pill-on-pink':''}`} onClick={()=>togglePart('cuisine',c)}>{c}</button>
                      ))}
                    </div>
                  </div>
                  <div className="pref-group">
                    <span className="pref-label">Vibe they enjoy</span>
                    <div className="pill-row">
                      {['Romantic','Cozy','Sophisticated','Lively','Quiet'].map(v=>(
                        <button key={v} className={`pill pill-pink ${partnerPrefs.vibe.includes(v)?'pill-on-pink':''}`} onClick={()=>togglePart('vibe',v)}>{v}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{display:'flex',gap:8,marginTop:12}}>
                  <button className="wizard-back" onClick={()=>setWizardStep(1)}>← Back</button>
                  <button className="wizard-next" onClick={()=>setWizardStep(3)}>See results →</button>
                </div>
              </div>
            )}

            {wizardStep===3 && (
              <div className="wizard-content results-step">
                <div className="match-summary">
                  <span className="match-num" style={noMatches?{color:'#999'}:{}}>{matchCount.toLocaleString()}</span>
                  <span className="match-label">restaurants match</span>
                  {mode==='couple'&&!noMatches&&<span className="couple-badge">🌹 For both of you</span>}
                </div>
                {noMatches && (
                  <div className="no-match-msg">
                    No restaurants fit all your hard constraints. Try removing a filter — your selection may be too narrow.
                  </div>
                )}
                <div className="active-filters">
                  {plannerPrefs.stars.map(s=><span key={s} className="filter-tag">{s}</span>)}
                  {plannerPrefs.occasion.map(o=><span key={o} className="filter-tag">{o}</span>)}
                  {plannerPrefs.budget.map(b=><span key={b} className="filter-tag">{b}</span>)}
                  {plannerPrefs.cuisine.map(c=><span key={c} className="filter-tag">{c}</span>)}
                  {plannerPrefs.greenStar&&<span className="filter-tag green-tag">🌿 Green</span>}
                  {partnerPrefs.cuisine.map(c=><span key={c} className="filter-tag pink-tag">💝 {c}</span>)}
                  {partnerPrefs.vibe.map(v=><span key={v} className="filter-tag pink-tag">💝 {v}</span>)}
                </div>
                <div style={{display:'flex',gap:8,marginTop:8}}>
                  <button className="wizard-back" onClick={()=>setWizardStep(mode==='couple'?2:1)}>← Edit</button>
                  <button className="wizard-reset" onClick={reset}>Start over</button>
                </div>
              </div>
            )}
          </div>

          <main className="map-container">
            {data.length>0 ? (
              <MapDisplay
                restaurants={displayData}
                center={mapCenter}
                computeMatchScore={computeScore}
                hasActiveFilters={hasFilters && wizardStep===3}
                greenStarPref={plannerPrefs.greenStar}
                mode={mode}
                travelMode={travelMode}
              />
            ) : (
              <div className="loading">Loading restaurant data…</div>
            )}
          </main>
        </div>
      )}

      {activePanel === 'analytical' && <AnalyticalPanel />}
    </div>
  );
}
