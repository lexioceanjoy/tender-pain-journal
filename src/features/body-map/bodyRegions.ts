import {
  choirRegions,
  type ChoirOutline,
  type ChoirRegion,
  type ChoirView
} from './choirRegions.generated';
import { findBodyRegion as findLegacyBodyRegion } from './legacyBodyRegions';

export type BodyView = ChoirView;
export type BodyFocus = 'full' | 'upper' | 'lower';
export type BodyOutline = ChoirOutline;
export type BodyRegion = ChoirRegion;

export const bodyOutlines: Array<{ id: BodyOutline; label: string }> = [
  { id: 'female', label: 'Outline 1' },
  { id: 'male', label: 'Outline 2' }
];

export const bodyMapImages: Record<BodyOutline, { width: number; height: number }> = {
  female: { width: 518, height: 580 },
  male: { width: 553, height: 580 }
};

export const focusViewBoxes: Record<BodyOutline, Record<BodyView, Record<BodyFocus, string>>> = {
  female: {
    front: {
      full: '0 0 259 580',
      upper: '0 0 259 335',
      lower: '35 245 190 335'
    },
    back: {
      full: '259 0 259 580',
      upper: '259 0 259 335',
      lower: '294 245 190 335'
    }
  },
  male: {
    front: {
      full: '0 0 276.5 580',
      upper: '0 0 276.5 335',
      lower: '43 245 190 335'
    },
    back: {
      full: '276.5 0 276.5 580',
      upper: '276.5 0 276.5 335',
      lower: '320 245 190 335'
    }
  }
};

export function getBodyRegions(outline: BodyOutline, view: BodyView) {
  return choirRegions[outline][view];
}

export function findBodyRegion(id: string) {
  const choirRegion = [...choirRegions.female.front, ...choirRegions.female.back]
    .find((region) => region.id === id);
  return choirRegion ?? findLegacyBodyRegion(id);
}
