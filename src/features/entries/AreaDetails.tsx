import { findBodyRegion } from '../body-map/bodyRegions';
import { sensationOptions, type Sensation } from '../../shared/data/painEntry';

export type AreaOverride = {
  intensity?: number;
  sensations?: Sensation[];
};

export type AreaOverrides = Record<string, AreaOverride>;

type Props = {
  selectedRegions: string[];
  defaultIntensity: number;
  defaultSensations: Sensation[];
  value: AreaOverrides;
  onChange: (value: AreaOverrides) => void;
};

export function AreaDetails({
  selectedRegions,
  defaultIntensity,
  defaultSensations,
  value,
  onChange
}: Props) {
  if (selectedRegions.length < 2) return null;

  function update(regionId: string, override: AreaOverride) {
    onChange({ ...value, [regionId]: override });
  }

  function useOverall(regionId: string) {
    const next = { ...value };
    delete next[regionId];
    onChange(next);
  }

  function toggleSensation(regionId: string, option: Sensation) {
    const current = value[regionId];
    const sensations = current?.sensations ?? defaultSensations;
    update(regionId, {
      ...current,
      sensations: sensations.includes(option)
        ? sensations.filter((item) => item !== option)
        : [...sensations, option]
    });
  }

  return (
    <details className="area-details-panel">
      <summary>
        <span>Do any areas feel different?</span>
        <span>Optional</span>
      </summary>
      <div className="area-details-content">
        <p>Every area uses the overall intensity and sensation unless you change it here.</p>
        {selectedRegions.map((regionId) => {
          const override = value[regionId];
          const intensity = override?.intensity ?? defaultIntensity;
          const sensations = override?.sensations ?? defaultSensations;
          const regionLabel = findBodyRegion(regionId)?.label ?? regionId;
          return (
            <details className="area-override" key={regionId}>
              <summary>
                <strong>{regionLabel}</strong>
                <span>{override ? `${intensity}/10 · customized` : `${intensity}/10 · overall`}</span>
              </summary>
              <div className="area-override-fields">
                <label htmlFor={`area-intensity-${regionId}`}>
                  Intensity <strong>{intensity}</strong><span>/10</span>
                </label>
                <input
                  id={`area-intensity-${regionId}`}
                  type="range"
                  min="0"
                  max="10"
                  value={intensity}
                  aria-label={`Intensity for ${regionLabel}`}
                  aria-valuetext={`${intensity} out of 10`}
                  onChange={(event) => update(regionId, { ...override, intensity: Number(event.target.value) })}
                />
                <fieldset>
                  <legend>Sensation in this area</legend>
                  <div className="chip-group">
                    {sensationOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={sensations.includes(option) ? 'chip selected' : 'chip'}
                        aria-pressed={sensations.includes(option)}
                        aria-label={`${capitalize(option)} for ${regionLabel}`}
                        onClick={() => toggleSensation(regionId, option)}
                      >
                        {capitalize(option)}
                      </button>
                    ))}
                  </div>
                </fieldset>
                {override && <button className="use-overall-button" type="button" onClick={() => useOverall(regionId)}>Use overall settings</button>}
              </div>
            </details>
          );
        })}
      </div>
    </details>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
