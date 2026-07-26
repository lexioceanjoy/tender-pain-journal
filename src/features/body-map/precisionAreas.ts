export type PrecisionArea = {
  id: string;
  label: string;
  path: string;
  parentIds: string[];
};

export const refinableParentIds = new Set([
  'choir-b18', 'choir-b19',
  'choir-b22', 'choir-b23', 'choir-b24', 'choir-b25',
  'choir-b28', 'choir-b29'
]);

export const precisionAreas: PrecisionArea[] = [
  { id: 'tender-detail-pelvic-rim-left', label: 'Left upper pelvic rim', path: 'M66 91 Q87 63 119 55 L146 69 145 91 111 88 83 103Z', parentIds: ['choir-b18', 'choir-b22', 'choir-b23'] },
  { id: 'tender-detail-pelvic-rim-right', label: 'Right upper pelvic rim', path: 'M154 69 181 55 Q213 63 234 91 L217 103 189 88 155 91Z', parentIds: ['choir-b19', 'choir-b24', 'choir-b25'] },
  { id: 'tender-detail-si-left', label: 'Left SI-joint area', path: 'M116 88 145 92 143 140 122 134 111 112Z', parentIds: ['choir-b18', 'choir-b22', 'choir-b23'] },
  { id: 'tender-detail-si-right', label: 'Right SI-joint area', path: 'M155 92 184 88 189 112 178 134 157 140Z', parentIds: ['choir-b19', 'choir-b24', 'choir-b25'] },
  { id: 'tender-detail-sacrum', label: 'Central sacrum area', path: 'M146 91 154 91 158 141 150 165 142 141Z', parentIds: ['choir-b18', 'choir-b19', 'choir-b22', 'choir-b23', 'choir-b24', 'choir-b25'] },
  { id: 'tender-detail-tailbone', label: 'Tailbone area', path: 'M142 142 150 165 158 142 157 174 150 190 143 174Z', parentIds: ['choir-b18', 'choir-b19', 'choir-b22', 'choir-b23', 'choir-b24', 'choir-b25'] },
  { id: 'tender-detail-outer-hip-left', label: 'Left outer hip', path: 'M66 92 83 104 101 130 96 163 64 170 50 143Z', parentIds: ['choir-b22', 'choir-b23'] },
  { id: 'tender-detail-outer-hip-right', label: 'Right outer hip', path: 'M234 92 217 104 199 130 204 163 236 170 250 143Z', parentIds: ['choir-b24', 'choir-b25'] },
  { id: 'tender-detail-upper-glute-left', label: 'Left upper glute', path: 'M84 104 111 89 121 135 101 156 96 163 101 130Z', parentIds: ['choir-b23'] },
  { id: 'tender-detail-upper-glute-right', label: 'Right upper glute', path: 'M216 104 189 89 179 135 199 156 204 163 199 130Z', parentIds: ['choir-b24'] },
  { id: 'tender-detail-middle-glute-left', label: 'Left middle glute', path: 'M64 171 96 164 121 136 142 142 140 194 101 199 68 187Z', parentIds: ['choir-b23'] },
  { id: 'tender-detail-middle-glute-right', label: 'Right middle glute', path: 'M236 171 204 164 179 136 158 142 160 194 199 199 232 187Z', parentIds: ['choir-b24'] },
  { id: 'tender-detail-lower-glute-left', label: 'Left lower glute', path: 'M69 188 101 200 140 195 136 224 101 222 78 211Z', parentIds: ['choir-b23'] },
  { id: 'tender-detail-lower-glute-right', label: 'Right lower glute', path: 'M231 188 199 200 160 195 164 224 199 222 222 211Z', parentIds: ['choir-b24'] },
  { id: 'tender-detail-upper-hamstring-left', label: 'Left upper hamstring area', path: 'M101 223 136 225 132 274 103 274Z', parentIds: ['choir-b23', 'choir-b28'] },
  { id: 'tender-detail-upper-hamstring-right', label: 'Right upper hamstring area', path: 'M164 225 199 223 197 274 168 274Z', parentIds: ['choir-b24', 'choir-b29'] }
];

export function findPrecisionArea(id: string) {
  return precisionAreas.find((area) => area.id === id);
}

export function hasRefinableRegion(regionIds: string[]) {
  return regionIds.some((id) => refinableParentIds.has(id));
}

export function canUsePrecisionArea(areaId: string, regionIds: string[]) {
  const area = findPrecisionArea(areaId);
  return Boolean(area?.parentIds.some((parentId) => regionIds.includes(parentId)));
}
