import { useState } from 'react';
import femaleMapUrl from '../../../vendor/choir-body-map/img/choirbodymap_female.png';
import maleMapUrl from '../../../vendor/choir-body-map/img/choirbodymap_male.png';
import {
  bodyMapImages,
  bodyOutlines,
  findBodyRegion,
  focusViewBoxes,
  getBodyRegions,
  type BodyFocus,
  type BodyOutline,
  type BodyView
} from './bodyRegions';
import { PrecisionMap } from './PrecisionMap';

type Props = {
  selectedRegions: string[];
  onSelectionChange: (regions: string[]) => void;
  selectedPrecisionAreas: string[];
  onPrecisionSelectionChange: (ids: string[]) => void;
};

const mapUrls: Record<BodyOutline, string> = {
  female: femaleMapUrl,
  male: maleMapUrl
};

export function BodyMap({
  selectedRegions,
  onSelectionChange,
  selectedPrecisionAreas,
  onPrecisionSelectionChange
}: Props) {
  const [view, setView] = useState<BodyView>('back');
  const [focus, setFocus] = useState<BodyFocus>('full');
  const [outline, setOutline] = useState<BodyOutline>('female');
  const image = bodyMapImages[outline];
  const halfWidth = image.width / 2;
  const clipX = view === 'front' ? 0 : halfWidth;
  const clipId = `choir-map-clip-${outline}-${view}`;

  function toggleRegion(id: string) {
    onSelectionChange(selectedRegions.includes(id)
      ? selectedRegions.filter((region) => region !== id)
      : [...selectedRegions, id]);
  }

  return (
    <section className="body-map-section" aria-labelledby="map-title">
      <div className="view-tabs" role="group" aria-label="Choose front or back body view">
        <button type="button" className={view === 'back' ? 'selected' : ''} aria-pressed={view === 'back'} onClick={() => setView('back')}>Back view</button>
        <button type="button" className={view === 'front' ? 'selected' : ''} aria-pressed={view === 'front'} onClick={() => setView('front')}>Front view</button>
      </div>

      <div className="map-toolbar">
        <p className="map-instruction" id="map-title">Tap every area that hurts.</p>
        <div className="focus-tabs" role="group" aria-label="Body map zoom level">
          {(['full', 'upper', 'lower'] as BodyFocus[]).map((option) => (
            <button key={option} type="button" className={focus === option ? 'selected' : ''} aria-pressed={focus === option} onClick={() => setFocus(option)}>
              {option === 'full' ? 'Full body' : option === 'upper' ? 'Upper body' : 'Lower body'}
            </button>
          ))}
        </div>
      </div>

      <div className="map-canvas choir-map">
        <span className="orientation-badge">Viewing the {view}</span>
        <span className="side-marker side-marker-left">{view === 'front' ? 'Your right' : 'Your left'}</span>
        <span className="side-marker side-marker-right">{view === 'front' ? 'Your left' : 'Your right'}</span>
        <svg viewBox={focusViewBoxes[outline][view][focus]} role="group" aria-label={`${view} body map, ${focus} view`}>
          <defs>
            <clipPath id={clipId}>
              <rect x={clipX} y="0" width={halfWidth} height={image.height} />
            </clipPath>
          </defs>
          <image href={mapUrls[outline]} width={image.width} height={image.height} clipPath={`url(#${clipId})`} aria-hidden="true" />
          <rect className="source-attribution-mask" x="190" y="525" width="150" height="55" aria-hidden="true" />
          {getBodyRegions(outline, view).map((region) => (
            <polygon
              key={region.id}
              className={`body-region ${selectedRegions.includes(region.id) ? 'selected' : ''}`}
              points={region.points}
              tabIndex={0}
              role="button"
              aria-label={`${region.label}${selectedRegions.includes(region.id) ? ', selected' : ''}`}
              aria-pressed={selectedRegions.includes(region.id)}
              onClick={() => toggleRegion(region.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  toggleRegion(region.id);
                }
              }}
            />
          ))}
        </svg>
      </div>

      <div className="selected-regions" aria-live="polite">
        {selectedRegions.length === 0
          ? <span>No locations selected yet</span>
          : selectedRegions.map((id) => <span key={id} className="region-chip">{findBodyRegion(id)?.label ?? id}</span>)}
      </div>

      <PrecisionMap
        selectedRegions={selectedRegions}
        selectedPrecisionAreas={selectedPrecisionAreas}
        onSelectionChange={onPrecisionSelectionChange}
      />

      <details className="outline-options">
        <summary>Body outline <span>{bodyOutlines.find((option) => option.id === outline)?.label}</span></summary>
        <p>Choose whichever outline makes locations easiest to recognize. Both use the same region names.</p>
        <div role="group" aria-label="Choose body outline">
          {bodyOutlines.map((option) => (
            <button
              key={option.id}
              type="button"
              className={outline === option.id ? 'selected' : ''}
              aria-pressed={outline === option.id}
              onClick={() => setOutline(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </details>
      <p className="choir-attribution">
        CHOIR Body Map · Stanford University · <a href="https://doi.org/10.1097/PR9.0000000000000880" target="_blank" rel="noreferrer">Salmasi et al. 2021</a>
      </p>
    </section>
  );
}
