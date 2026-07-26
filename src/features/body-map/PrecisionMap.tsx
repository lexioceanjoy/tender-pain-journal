import { canUsePrecisionArea, findPrecisionArea, hasRefinableRegion, precisionAreas } from './precisionAreas';

type Props = {
  selectedRegions: string[];
  selectedPrecisionAreas: string[];
  onSelectionChange: (ids: string[]) => void;
};

export function PrecisionMap({ selectedRegions, selectedPrecisionAreas, onSelectionChange }: Props) {
  if (!hasRefinableRegion(selectedRegions)) return null;

  function toggleArea(id: string) {
    onSelectionChange(selectedPrecisionAreas.includes(id)
      ? selectedPrecisionAreas.filter((areaId) => areaId !== id)
      : [...selectedPrecisionAreas, id]);
  }

  return (
    <details className="precision-panel">
      <summary>
        <span>Refine lower back, hip or glute</span>
        <span>Optional</span>
      </summary>
      <div className="precision-content">
        <p>Tap an approximate surface area. This adds detail without replacing your broader CHOIR selection.</p>
        <div className="precision-canvas">
          <span className="precision-side precision-left">Your left</span>
          <span className="precision-side precision-right">Your right</span>
          <svg viewBox="0 0 300 285" role="group" aria-label="Detailed back of pelvis, glutes and upper legs">
            <path className="precision-underlay" d="M95 20 Q150 7 205 20 L218 65 Q246 79 254 119 L246 176 Q232 211 205 224 L200 280 164 280 158 224 150 213 142 224 136 280 100 280 95 224 Q68 211 54 176 L46 119 Q54 79 82 65Z" />
            <path className="precision-guide" d="M95 20 Q150 42 205 20 M82 65 Q150 91 218 65 M150 45 L150 213 M95 224 Q118 235 142 224 M158 224 Q182 235 205 224" />
            {precisionAreas.map((area) => {
              const enabled = canUsePrecisionArea(area.id, selectedRegions);
              return (
                <path
                  key={area.id}
                  d={area.path}
                  className={`precision-region ${selectedPrecisionAreas.includes(area.id) ? 'selected' : ''} ${enabled ? '' : 'disabled'}`}
                  tabIndex={enabled ? 0 : -1}
                  role="button"
                  aria-label={`${area.label}${selectedPrecisionAreas.includes(area.id) ? ', selected' : ''}`}
                  aria-pressed={selectedPrecisionAreas.includes(area.id)}
                  aria-disabled={!enabled}
                  onClick={() => { if (enabled) toggleArea(area.id); }}
                  onKeyDown={(event) => {
                    if (enabled && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault();
                      toggleArea(area.id);
                    }
                  }}
                />
              );
            })}
          </svg>
        </div>
        <div className="precision-selections" aria-live="polite">
          {selectedPrecisionAreas.length === 0
            ? <span>No refined locations selected.</span>
            : selectedPrecisionAreas.map((id) => <span key={id}>{findPrecisionArea(id)?.label ?? id}</span>)}
        </div>
        <p className="precision-note">Tender detail areas are approximate and have not been clinically validated.</p>
      </div>
    </details>
  );
}
