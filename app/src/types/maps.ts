export type MapFamily = 'network' | 'airport-express' | 'rapid-metro';
export type MapFormat = 'image' | 'pdf' | 'any';
export type MapAssetType = 'image' | 'pdf';

export interface MapAsset {
  id: string;
  family: MapFamily;
  file_type: MapAssetType;
  display_name: string;
  source_path: string;
  url: string;
  content_type: string | null;
  content_length: number | null;
}

export interface MapAssetListResponse {
  assets: MapAsset[];
}

export interface MapAssetByFormatResponse {
  family: MapFamily;
  image: MapAsset | null;
  pdf: MapAsset | null;
}
