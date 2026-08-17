/** Published news article, as exposed by GET /me/news and GET /me/news/:id. */
export interface MeNewsItem {
  id: string;
  title: string;
  publishedAt: string;
  body: string;
}
