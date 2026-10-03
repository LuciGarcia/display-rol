import type { AssetDefinition } from "./types";

const svg = (w: number, h: number, body: string): string =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`,
  )}`;

const entity = (
  type: string,
  state: string,
  source: string,
): AssetDefinition => ({
  id: `${type}-${state}-2d`,
  category: "entity",
  semanticType: type,
  state,
  representation: "2d",
  kind: "svg",
  source,
});

const role = (roleDefinitionId: string, source: string): AssetDefinition => ({
  id: `${roleDefinitionId}-normal-2d`,
  category: "role",
  semanticType: roleDefinitionId,
  state: "normal",
  representation: "2d",
  kind: "svg",
  source,
});

const PERSON =
  '<circle cx="16" cy="12" r="5" fill="#fff"/><path d="M6 27c2-8 18-8 20 0z" fill="#fff"/>';
const personIcon = (bg: string) =>
  svg(
    32,
    32,
    `<circle cx="16" cy="16" r="15" fill="${bg}" stroke="#2c3e50" stroke-width="2"/>${PERSON}`,
  );

const PALLET =
  '<rect x="2" y="8" width="56" height="26" fill="#c68b4a" stroke="#6b4423"/><path d="M2 16h56M2 25h56" stroke="#6b4423"/>';
const MACHINE =
  '<rect x="2" y="6" width="56" height="30" rx="4" fill="#7f8c8d" stroke="#2c3e50"/><rect x="28" y="14" width="24" height="14" fill="#34495e"/>';

export const defaultAssetDefinitions: readonly AssetDefinition[] = [
  entity("pallet", "normal", svg(60, 40, PALLET)),
  entity(
    "pallet",
    "damaged",
    svg(
      60,
      40,
      `${PALLET}<path d="M10 4l40 34M50 4L10 38" stroke="#c0392b" stroke-width="3"/>`,
    ),
  ),
  entity(
    "machine",
    "normal",
    svg(60, 40, `${MACHINE}<circle cx="14" cy="21" r="6" fill="#2ecc71"/>`),
  ),
  entity(
    "machine",
    "broken",
    svg(
      60,
      40,
      `${MACHINE}<circle cx="14" cy="21" r="6" fill="#e74c3c"/><path d="M28 14l24 14M52 14L28 28" stroke="#f1c40f" stroke-width="3"/>`,
    ),
  ),
  entity(
    "truck",
    "normal",
    svg(
      60,
      40,
      '<rect x="2" y="10" width="36" height="22" fill="#3498db" stroke="#2c3e50"/><rect x="38" y="16" width="20" height="16" fill="#2980b9" stroke="#2c3e50"/><circle cx="14" cy="34" r="5" fill="#2c3e50"/><circle cx="48" cy="34" r="5" fill="#2c3e50"/>',
    ),
  ),
  entity(
    "table",
    "normal",
    svg(
      60,
      40,
      '<rect x="4" y="10" width="52" height="8" fill="#9b59b6" stroke="#4a235a"/><path d="M10 18v16M50 18v16" stroke="#4a235a" stroke-width="3"/>',
    ),
  ),
  entity(
    "box",
    "normal",
    svg(
      60,
      40,
      '<rect x="14" y="8" width="32" height="26" fill="#d35400" stroke="#6e2c00"/><path d="M14 18h32" stroke="#6e2c00"/>',
    ),
  ),
  role("role-director", personIcon("#8e44ad")),
  role("role-op", personIcon("#e67e22")),
];
