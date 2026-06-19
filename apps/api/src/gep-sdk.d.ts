declare module '@evomap/gep-sdk' {
  export const SCHEMA_VERSION: string;
  export function canonicalize(asset: unknown): string;
  export function computeAssetId(asset: unknown): string;
  export function verifyAssetId(asset: unknown): boolean;
}
