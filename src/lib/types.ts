export interface Moment {
  id: string;
  type: 'photo' | 'voice';
  from: string;
  caption?: string;
  fileName: string;
  mimeType?: string;
  createdAt: string;
}
