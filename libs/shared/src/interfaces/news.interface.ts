/** Notícia shown on the PWA home page once published, as returned by the dashboard API. */
export interface News {
  id: string;
  title: string;
  body: string;
  publishedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  sendPush: boolean;
  pushSentAt: string | null;
}
