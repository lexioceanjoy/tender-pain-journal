// Preserved only so check-ins created with Tender's prototype map remain readable.
export type BodyView = 'back' | 'front';
export type BodyFocus = 'full' | 'upper' | 'lower';

export type BodyRegion = {
  id: string;
  label: string;
  path: string;
};

export const focusViewBoxes: Record<BodyFocus, string> = {
  full: '30 0 180 520',
  upper: '35 0 170 285',
  lower: '45 220 150 300'
};

const sharedRegions: BodyRegion[] = [
  { id: 'head-left', label: 'Left side of head', path: 'M120 10 A22 22 0 0 0 120 54Z' },
  { id: 'head-right', label: 'Right side of head', path: 'M120 10 A22 22 0 0 1 120 54Z' },
  { id: 'neck-left', label: 'Left side of neck', path: 'M107 53 L120 57 120 77 103 74Z' },
  { id: 'neck-right', label: 'Right side of neck', path: 'M120 57 L133 53 137 74 120 77Z' },
  { id: 'shoulder-left', label: 'Left shoulder', path: 'M103 72 L78 75 57 88 68 106 90 96 106 91Z' },
  { id: 'shoulder-right', label: 'Right shoulder', path: 'M137 72 L162 75 183 88 172 106 150 96 134 91Z' },
  { id: 'upper-arm-left', label: 'Left upper arm', path: 'M57 90 L69 106 63 164 48 160 43 111Z' },
  { id: 'upper-arm-right', label: 'Right upper arm', path: 'M183 90 L171 106 177 164 192 160 197 111Z' },
  { id: 'elbow-left', label: 'Left elbow', path: 'M48 160 L63 164 61 185 46 184Z' },
  { id: 'elbow-right', label: 'Right elbow', path: 'M177 164 L192 160 194 184 179 185Z' },
  { id: 'forearm-left', label: 'Left forearm', path: 'M46 185 L61 186 57 238 40 238Z' },
  { id: 'forearm-right', label: 'Right forearm', path: 'M179 186 L194 185 200 238 183 238Z' },
  { id: 'hand-left', label: 'Left hand', path: 'M40 239 L57 239 56 270 47 280 39 268Z' },
  { id: 'hand-right', label: 'Right hand', path: 'M183 239 L200 239 201 268 193 280 184 270Z' },
  { id: 'knee-left', label: 'Left knee', path: 'M85 364 L116 364 115 397 86 397Z' },
  { id: 'knee-right', label: 'Right knee', path: 'M124 364 L155 364 154 397 125 397Z' },
  { id: 'lower-leg-left', label: 'Left lower leg', path: 'M86 399 L115 399 110 468 90 468Z' },
  { id: 'lower-leg-right', label: 'Right lower leg', path: 'M125 399 L154 399 150 468 130 468Z' },
  { id: 'ankle-left', label: 'Left ankle', path: 'M90 469 L110 469 109 488 90 488Z' },
  { id: 'ankle-right', label: 'Right ankle', path: 'M130 469 L150 469 150 488 131 488Z' },
  { id: 'foot-left', label: 'Left foot', path: 'M90 489 L109 489 114 507 107 514 79 514 80 503Z' },
  { id: 'foot-right', label: 'Right foot', path: 'M131 489 L150 489 160 503 161 514 133 514 126 507Z' }
];

export const bodyRegions: Record<BodyView, BodyRegion[]> = {
  back: [
    ...sharedRegions,
    { id: 'back-upper-left', label: 'Left upper back', path: 'M91 97 L118 91 118 146 87 151Z' },
    { id: 'back-upper-right', label: 'Right upper back', path: 'M122 91 L149 97 153 151 122 146Z' },
    { id: 'back-mid-left', label: 'Left mid back', path: 'M87 153 L118 148 118 202 88 207Z' },
    { id: 'back-mid-right', label: 'Right mid back', path: 'M122 148 L153 153 152 207 122 202Z' },
    { id: 'back-low-left', label: 'Left low back', path: 'M88 209 L118 204 118 243 91 249Z' },
    { id: 'back-low-right', label: 'Right low back', path: 'M122 204 L152 209 149 249 122 243Z' },
    { id: 'back-si-left', label: 'Left SI joint area', path: 'M91 250 L118 245 116 273 96 267Z' },
    { id: 'back-si-right', label: 'Right SI joint area', path: 'M122 245 L149 250 144 267 124 273Z' },
    { id: 'back-sacrum', label: 'Sacrum and tailbone', path: 'M118 245 L122 245 124 274 120 287 116 274Z' },
    { id: 'back-glute-outer-left', label: 'Left outer glute', path: 'M78 252 L95 269 98 307 79 300 70 277Z' },
    { id: 'back-glute-inner-left', label: 'Left inner glute', path: 'M96 269 L116 275 116 309 99 307Z' },
    { id: 'back-glute-inner-right', label: 'Right inner glute', path: 'M124 275 L144 269 141 307 124 309Z' },
    { id: 'back-glute-outer-right', label: 'Right outer glute', path: 'M145 269 L162 252 170 277 161 300 142 307Z' },
    { id: 'back-outer-thigh-left', label: 'Left outer upper thigh', path: 'M78 302 L91 310 93 363 79 363 72 320Z' },
    { id: 'back-hamstring-left', label: 'Left upper hamstring', path: 'M92 310 L116 311 116 363 95 363Z' },
    { id: 'back-inner-thigh-left', label: 'Left inner upper thigh', path: 'M108 311 L118 310 116 363 107 363Z' },
    { id: 'back-inner-thigh-right', label: 'Right inner upper thigh', path: 'M122 310 L132 311 133 363 124 363Z' },
    { id: 'back-hamstring-right', label: 'Right upper hamstring', path: 'M124 311 L148 310 145 363 124 363Z' },
    { id: 'back-outer-thigh-right', label: 'Right outer upper thigh', path: 'M149 310 L162 302 168 320 161 363 147 363Z' }
  ],
  front: [
    ...sharedRegions,
    { id: 'front-chest-left', label: 'Left chest', path: 'M91 97 L118 91 118 150 87 146Z' },
    { id: 'front-chest-right', label: 'Right chest', path: 'M122 91 L149 97 153 146 122 150Z' },
    { id: 'front-upper-abdomen-left', label: 'Left upper abdomen', path: 'M87 148 L118 152 118 199 88 204Z' },
    { id: 'front-upper-abdomen-right', label: 'Right upper abdomen', path: 'M122 152 L153 148 152 204 122 199Z' },
    { id: 'front-lower-abdomen-left', label: 'Left lower abdomen', path: 'M88 206 L118 201 118 242 91 247Z' },
    { id: 'front-lower-abdomen-right', label: 'Right lower abdomen', path: 'M122 201 L152 206 149 247 122 242Z' },
    { id: 'front-outer-hip-left', label: 'Left outer hip', path: 'M78 242 L92 247 97 278 78 291 69 273Z' },
    { id: 'front-groin-left', label: 'Left groin and hip crease', path: 'M92 249 L118 244 117 281 98 278Z' },
    { id: 'front-groin-right', label: 'Right groin and hip crease', path: 'M122 244 L148 249 142 278 123 281Z' },
    { id: 'front-outer-hip-right', label: 'Right outer hip', path: 'M148 247 L162 242 171 273 162 291 143 278Z' },
    { id: 'front-outer-thigh-left', label: 'Left outer upper thigh', path: 'M78 293 L94 281 95 363 79 363 72 318Z' },
    { id: 'front-thigh-left', label: 'Left front upper thigh', path: 'M95 281 L117 283 116 363 96 363Z' },
    { id: 'front-inner-thigh-left', label: 'Left inner upper thigh', path: 'M108 283 L118 282 116 363 108 363Z' },
    { id: 'front-inner-thigh-right', label: 'Right inner upper thigh', path: 'M122 282 L132 283 132 363 124 363Z' },
    { id: 'front-thigh-right', label: 'Right front upper thigh', path: 'M123 283 L145 281 144 363 124 363Z' },
    { id: 'front-outer-thigh-right', label: 'Right outer upper thigh', path: 'M146 281 L162 293 168 318 161 363 145 363Z' }
  ]
};

export function findBodyRegion(id: string) {
  return [...bodyRegions.back, ...bodyRegions.front].find((region) => region.id === id);
}
