export interface DynamoItemChangedEvent {
  after: { [key: string]: any };
  attributesChanged: string[];
  before: { [key: string]: any };
  presignedUrl?: string; // S3 URL to Old and New Images if too large
  newImage?: { [key: string]: any };
  oldImage?: { [key: string]: any };
  operation: string; // 'INSERT' | 'MODIFY' | 'REMOVE'
  pk: string;
  sk: string;
}
