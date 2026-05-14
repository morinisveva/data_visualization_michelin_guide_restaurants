import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const TIER_HUE = {
  '3':        { h:0,   s:90 },
  '2':        { h:18,  s:88 },
  '1':        { h:38,  s:92 },
  'bib':      { h:300, s:55 },
  'selected': { h:0,   s:0  },
};

const getTierKey = award => {
  const r = String(award||'').toLowerCase().trim();
  if (r.startsWith('3')) return '3';
  if (r.startsWith('2')) return '2';
  if (r.startsWith('1')) return '1';
  if (r.includes('bib')) return 'bib';
  return 'selected';
};

// Tier badge color for pills inside popup (matches map legend)
const TIER_BADGE_COLOR = {
  '3':        '#B30000',
  '2':        '#D24A1A',
  '1':        '#D88815',
  'bib':      '#8E3A8E',
  'selected': '#666666',
};

const matchToLightness = ratio => Math.round(75 - ratio * 50);

const PIN_PATH = 'M12 0C7.032 0 3 4.032 3 9c0 6.75 9 15 9 15s9-8.25 9-15c0-4.968-4.032-9-9-9z';

const createPinIcon = (award, ratio, isGreen, hasActiveFilters, greenStarPref, isTop3, mode, travelMode) => {
  const tier = getTierKey(award);
  const { h, s } = TIER_HUE[tier];

  let fill;
  if (travelMode) {
    fill = `hsl(30,60%,45%)`;
  } else {
    const l = hasActiveFilters ? matchToLightness(ratio) : (tier==='selected'?62:42);
    fill = tier==='selected'
      ? `hsl(0,0%,${hasActiveFilters ? Math.round(54+ratio*18) : 60}%)`
      : `hsl(${h},${s}%,${l}%)`;
  }

  let ringColor = null;
  if (isTop3 && hasActiveFilters) {
    ringColor = mode==='couple' ? '#FF69B4' : '#FFD700';
  } else if (isGreen && greenStarPref) {
    ringColor = '#39FF14';
  } else if (isGreen) {
    ringColor = '#2E7D32';
  }

  const size = hasActiveFilters
    ? (isTop3 ? 28 : Math.round(18 + ratio * 6))
    : (tier==='selected' ? 16 : 22);

  const rSize = size + 8;

  const ringSvg = ringColor ? `
    <div style="position:absolute;top:0;left:0;width:${rSize}px;height:${rSize}px;">
      <svg viewBox="0 0 24 24" width="${rSize}" height="${rSize}" xmlns="http://www.w3.org/2000/svg">
        <path d="${PIN_PATH}" fill="${ringColor}"/>
      </svg>
    </div>` : '';

  const offset = ringColor ? 4 : 0;
  const pinSvg = `
    <div style="position:absolute;top:${offset}px;left:${offset}px;width:${size}px;height:${size}px;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.35))">
      <svg viewBox="0 0 24 24" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <path d="${PIN_PATH}" fill="${fill}"/>
        <circle cx="12" cy="9" r="3.5" fill="white" opacity="0.3"/>
      </svg>
    </div>`;

  const totalW = ringColor ? rSize : size;
  const totalH = ringColor ? rSize : size;

  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:${totalW}px;height:${totalH}px">${ringSvg}${pinSvg}</div>`,
    iconSize:   [totalW, totalH],
    iconAnchor: [totalW/2, totalH],
  });
};

const getDistance = (lat1,lon1,lat2,lon2) => {
  const R=6371e3, φ1=lat1*Math.PI/180, φ2=lat2*Math.PI/180;
  const dφ=(lat2-lat1)*Math.PI/180, dλ=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(dφ/2)**2+Math.cos(φ1)*Math.cos(φ2)*Math.sin(dλ/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
};

const fmtDist  = d => d>1000?`${(d/1000).toFixed(1)}km`:`${Math.round(d)}m`;
const fmtStars = a => {const r=String(a||'').toLowerCase().trim();return r.startsWith('3')?'★★★':r.startsWith('2')?'★★':r.startsWith('1')?'★':r.includes('bib')?'Bib Gourmand':r.includes('selected')?'Selected':'·';};
const fmtPrice = p => '$'.repeat(String(p||'').replace(/[^$]/g,'').length||0)||'';
// Price tier from raw string (works for any currency: $, €, ¥, ₩)
const priceTierFromRaw = p => String(p||'').replace(/[\w\s]/g,'').length;

function ChangeView({ center }) {
  const map = useMap();
  useEffect(()=>{ if(center&&!isNaN(center[0])) map.setView(center,13); },[center,map]);
  return null;
}

function RestaurantPopup({ res, ratio, hasActiveFilters, isTop3, mode, travelMode }) {
  const facilities = (res.facilitiesandservices||'').split(',').map(f=>f.trim()).filter(Boolean);
  const phone   = res.phonenumber||'';
  const name    = res.name||res.Name||'';
  const isGreen = res.greenstar==='1';
  const accentColor = travelMode ? '#8B5E3C' : '#C00';

  const tier      = getTierKey(res.award);
  const tierColor = TIER_BADGE_COLOR[tier];
  const tierLabel = fmtStars(res.award);
  const priceN    = priceTierFromRaw(res.price_usd);
  const priceLabel = priceN > 0 ? '$'.repeat(priceN) : null;

  return (
    <div style={{fontFamily:'inherit',padding:'4px 0',minWidth:260}}>
      {isTop3 && hasActiveFilters && (
        <div style={{
          fontSize:11,fontWeight:700,marginBottom:6,padding:'2px 8px',
          borderRadius:10,display:'inline-block',
          background:mode==='couple'?'#FFE4EE':'#FFF8DC',
          color:mode==='couple'?'#C0356A':'#8B6914',
          border:`1px solid ${mode==='couple'?'#FF69B4':'#FFD700'}`
        }}>
          {mode==='couple'?'💕 Top date pick':'⭐ Top pick'}
        </div>
      )}
      {travelMode && <div style={{fontSize:11,fontWeight:700,marginBottom:6,color:'#8B5E3C'}}>🎒 Budget pick nearby</div>}
      <div style={{fontWeight:700,fontSize:15,marginBottom:8}}>{name}{isGreen&&<span style={{color:'#2E7D32'}}> 🌿</span>}</div>

      {/* Pill row: tier + price + cuisine */}
      <div className="popup-pills">
        {tierLabel && tierLabel !== '·' && (
          <span className="popup-pill" style={{background:tierColor,color:'#fff'}}>{tierLabel}</span>
        )}
        {priceLabel && (
          <span className="popup-pill popup-pill-price">{priceLabel}</span>
        )}
        {res.cuisine && (
          <span className="popup-pill popup-pill-cuisine">{res.cuisine}</span>
        )}
      </div>

      {hasActiveFilters&&!travelMode&&(
        <div style={{fontSize:12,background:'#FFF0F0',borderRadius:6,padding:'3px 10px',marginBottom:8,color:'#A00',fontWeight:700,display:'inline-block'}}>
          {Math.round(ratio*100)}% match
        </div>
      )}
      {res.description&&(
        <div style={{fontSize:12,color:'#555',lineHeight:1.6,borderLeft:`3px solid ${accentColor}`,paddingLeft:10,maxHeight:90,overflowY:'auto',marginBottom:10}}>
          {res.description}
        </div>
      )}
      {facilities.length>0&&(
        <div style={{marginBottom:8}}>
          <div style={{fontSize:10,fontWeight:700,color:'#999',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4}}>Features</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
            {facilities.slice(0,6).map(f=>(
              <span key={f} style={{fontSize:11,padding:'2px 7px',background:'#f5f4f0',borderRadius:10,color:'#555'}}>{f}</span>
            ))}
          </div>
        </div>
      )}
      {phone&&(
        <div style={{fontSize:12,marginBottom:6}}>
          <span style={{color:'#999',marginRight:6}}>📞</span>
          <a href={`tel:${phone}`} style={{color:accentColor,fontWeight:600,textDecoration:'none'}}>{phone}</a>
        </div>
      )}
      <div style={{fontSize:11,color:'#bbb',marginTop:4}}>{res.location||''}</div>
    </div>
  );
}

function BestList({ restaurants, userLocation, computeMatchScore, hasActiveFilters, markerRefs, map, mode, travelMode }) {
  const [radius, setRadius] = useState(travelMode ? 1 : 10);

  useEffect(()=>{ if(travelMode) setRadius(1); },[travelMode]);

  const ranked = useMemo(() => {
    return restaurants
      .map((res,idx) => {
        const lat=parseFloat(res.latitude), lng=parseFloat(res.longitude);
        const dist = userLocation&&!isNaN(lat)&&!isNaN(lng)
          ? getDistance(userLocation.lat,userLocation.lng,lat,lng) : null;
        return { ...res, idx, dist, score:computeMatchScore(res), lat, lng };
      })
      .filter(r=>!isNaN(r.lat)&&!isNaN(r.lng))
      .filter(r=>r.dist===null||r.dist<=radius*1000)
      .sort((a,b)=>Math.abs(a.score-b.score)>0.001 ? b.score-a.score : (a.dist||0)-(b.dist||0))
      .slice(0,10);
  },[restaurants,userLocation,computeMatchScore,radius]);

  const handleClick = (res) => {
    if (!map) return;
    map.flyTo([res.lat,res.lng],16,{duration:1.2});
    setTimeout(()=>{ markerRefs.current[res.idx]?.openPopup(); }, 1300);
  };

  const accentColor = travelMode ? '#8B5E3C' : (mode==='couple'?'#FF69B4':'#FFD700');
  const titleColor  = travelMode ? '#8B5E3C' : '#E60000';

  return (
    <div className="best-list" style={travelMode?{borderTop:'3px solid #8B5E3C'}:{}}>
      <div className="best-list-header">
        <span className="best-list-title" style={{color:titleColor}}>
          {travelMode ? '🎒 Budget picks nearby' : hasActiveFilters ? 'Best matches' : 'Nearby restaurants'}
        </span>
        <div className="radius-control">
          <span className="radius-label">within {radius}km</span>
          <input type="range" min={1} max={travelMode?5:50} value={radius}
            onChange={e=>setRadius(Number(e.target.value))}
            className="radius-slider"
            style={travelMode?{'--thumb-color':'#8B5E3C'}:{}}/>
        </div>
      </div>
      <div className="best-list-scroll">
        {ranked.length===0
          ? <div className="best-empty">No restaurants within {radius}km</div>
          : ranked.map((res,i)=>(
            <div key={i} className="best-item"
              style={hasActiveFilters||travelMode ? {borderLeft:`3px solid ${i<3?accentColor:'transparent'}`,background:i===0?(travelMode?'#FDF6F0':''):''} : {}}
              onClick={()=>handleClick(res)}>
              <div className="best-rank" style={i<3?{color:accentColor,fontWeight:800}:{}}>{i+1}</div>
              <div className="best-info">
                <div className="best-name">{res.name||res.Name}{res.greenstar==='1'?' 🌿':''}</div>
                <div className="best-meta">
                  <span className="best-stars" style={{color:travelMode?'#8B5E3C':'#C00'}}>{fmtStars(res.award)}</span>
                  {fmtPrice(res.price_usd)&&<span style={{color:'#888'}}>{fmtPrice(res.price_usd)}</span>}
                  <span>{res.cuisine||''}</span>
                  {res.dist!=null&&<span className="best-dist" style={{color:travelMode?'#8B5E3C':'#E60000'}}>{fmtDist(res.dist)}</span>}
                </div>
              </div>
              {(hasActiveFilters&&!travelMode)&&<div className="best-score" style={{color:accentColor}}>{Math.round(res.score*100)}%</div>}
            </div>
          ))
        }
      </div>
    </div>
  );
}

function MapInner({ restaurants, computeMatchScore, hasActiveFilters, greenStarPref, userLocation, markerRefs, mode, travelMode }) {
  const map = useMap();

  // Top 3: score-first, distance-tiebreak. BUT if user has a location,
  // prefer top 3 that are geographically near the user (within 100km of viewport)
  // so the pink/gold ring is actually visible on screen.
  const top3Indices = useMemo(() => {
    if (!hasActiveFilters && !travelMode) return new Set();

    const enriched = restaurants
      .map((res,idx) => {
        const lat=parseFloat(res.latitude), lng=parseFloat(res.longitude);
        const dist = userLocation&&!isNaN(lat)&&!isNaN(lng)
          ? getDistance(userLocation.lat,userLocation.lng,lat,lng) : Infinity;
        return { idx, score:computeMatchScore(res), dist };
      })
      .filter(r => isFinite(r.score));

    // Prefer top 3 within 100km of user (so ring is visible in default viewport).
    // If not enough nearby, fall back to global top 3.
    const NEARBY_RADIUS_M = 100 * 1000;
    const nearby = enriched
      .filter(r => r.dist <= NEARBY_RADIUS_M)
      .sort((a,b) => Math.abs(a.score-b.score)>0.001 ? b.score-a.score : a.dist-b.dist)
      .slice(0,3);

    const pool = nearby.length >= 3
      ? nearby
      : enriched
          .sort((a,b) => Math.abs(a.score-b.score)>0.001 ? b.score-a.score : a.dist-b.dist)
          .slice(0,3);

    return new Set(pool.map(r => r.idx));
  },[restaurants,computeMatchScore,hasActiveFilters,userLocation,travelMode]);

  return (
    <>
      <BestList
        restaurants={restaurants}
        userLocation={userLocation}
        computeMatchScore={computeMatchScore}
        hasActiveFilters={hasActiveFilters}
        markerRefs={markerRefs}
        map={map}
        mode={mode}
        travelMode={travelMode}
      />
      <MarkerClusterGroup chunkedLoading maxClusterRadius={50}
        iconCreateFunction={cluster=>L.divIcon({
          html:`<div class="cluster-icon" style="${travelMode?'background:#8B5E3C':''}">${cluster.getChildCount()}</div>`,
          className:'',iconSize:[32,32],
        })}
      >
        {restaurants.map((res,idx)=>{
          const lat=parseFloat(String(res.latitude||'').replace(/[^0-9.-]/g,''));
          const lng=parseFloat(String(res.longitude||'').replace(/[^0-9.-]/g,''));
          if(isNaN(lat)||isNaN(lng)) return null;
          const ratio   = computeMatchScore(res);
          const isGreen = res.greenstar==='1';
          const isTop3  = top3Indices.has(idx);
          return (
            <Marker
              key={`m-${idx}`}
              ref={el=>markerRefs.current[idx]=el}
              position={[lat,lng]}
              icon={createPinIcon(res.award,ratio,isGreen,hasActiveFilters,greenStarPref,isTop3,mode,travelMode)}
            >
              <Tooltip direction="top" offset={[0,-4]} opacity={0.95}>
                <div style={{textAlign:'center',padding:'2px 4px'}}>
                  <div style={{fontWeight:700,fontSize:13}}>{res.name||res.Name}{isGreen?' 🌿':''}</div>
                  <div style={{fontSize:11,color:'#C00',marginTop:2}}>{fmtStars(res.award)}{fmtPrice(res.price_usd)&&` · ${fmtPrice(res.price_usd)}`}</div>
                  {hasActiveFilters&&<div style={{fontSize:11,color:'#888',marginTop:2}}>{Math.round(ratio*100)}% match{isTop3?' · 🏆':''}</div>}
                </div>
              </Tooltip>
              <Popup minWidth={280} maxWidth={320}>
                <RestaurantPopup res={res} ratio={ratio} hasActiveFilters={hasActiveFilters} isTop3={isTop3} mode={mode} travelMode={travelMode}/>
              </Popup>
            </Marker>
          );
        })}
      </MarkerClusterGroup>
    </>
  );
}

export default function MapDisplay({ restaurants, center, computeMatchScore, hasActiveFilters, greenStarPref, mode, travelMode }) {
  const [userLocation, setUserLocation] = useState(null);
  const markerRefs = useRef({});

  // Geolocation with fallback to map center (Seoul default).
  useEffect(()=>{
    navigator.geolocation?.getCurrentPosition(
      p => setUserLocation({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {
        if (center && !isNaN(center[0]) && !isNaN(center[1])) {
          setUserLocation({ lat: center[0], lng: center[1] });
        }
      }
    );
  },[]);

  useEffect(()=>{
    if (!userLocation && center && !isNaN(center[0]) && !isNaN(center[1])) {
      setUserLocation({ lat: center[0], lng: center[1] });
    }
  },[center, userLocation]);

  const topColor = travelMode ? '#8B5E3C' : (mode==='couple'?'#FF69B4':'#FFD700');

  return (
    <div style={{height:'100%',width:'100%',position:'relative'}}>
      <MapContainer center={center} zoom={13} style={{height:'100%',width:'100%'}}>
        <ChangeView center={center}/>
        <TileLayer url={travelMode
          ? "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"}
        />
        <MapInner
          restaurants={restaurants}
          computeMatchScore={computeMatchScore}
          hasActiveFilters={hasActiveFilters}
          greenStarPref={greenStarPref}
          userLocation={userLocation}
          markerRefs={markerRefs}
          mode={mode}
          travelMode={travelMode}
        />
      </MapContainer>

      <div className="map-legend" style={travelMode?{borderTop:'3px solid #8B5E3C'}:{}}>
        <div className="legend-title">Award tier</div>
        {[
          {color:'hsl(0,90%,32%)',   label:'★★★ 3 Stars'},
          {color:'hsl(18,88%,38%)',  label:'★★ 2 Stars'},
          {color:'hsl(38,92%,40%)',  label:'★ 1 Star'},
          {color:'hsl(300,55%,45%)', label:'Bib Gourmand'},
          {color:'hsl(0,0%,58%)',    label:'Selected'},
        ].map(({color,label})=>(
          <div className="legend-row" key={label}>
            <div className="legend-dot" style={{background:color}}/><span>{label}</span>
          </div>
        ))}
        {(hasActiveFilters||travelMode)&&<>
          <div className="legend-title" style={{marginTop:10}}>Top 3 ring</div>
          <div className="legend-row">
            <div className="legend-dot" style={{background:'#aaa',border:`2.5px solid ${topColor}`}}/>
            <span>{travelMode?'Budget top pick':mode==='couple'?'Top date pick':'Top pick'}</span>
          </div>
        </>}
        <div className="legend-title" style={{marginTop:8}}>Green star</div>
        <div className="legend-row"><div className="legend-dot" style={{background:'#aaa',border:'2px solid #2E7D32'}}/><span>Has green star</span></div>
        <div className="legend-row"><div className="legend-dot" style={{background:'#aaa',border:'2.5px solid #39FF14'}}/><span>Pref. active</span></div>
      </div>
    </div>
  );
}
