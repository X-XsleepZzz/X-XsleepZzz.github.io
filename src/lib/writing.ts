import { getCollection } from 'astro:content';
import { articleTimestamp } from './dates';

export async function getPublishedWriting() {
  return (await getCollection('writing', ({ data }) => !data.draft))
    .sort((a, b) => articleTimestamp(b.data.publishedAt) - articleTimestamp(a.data.publishedAt) || a.id.localeCompare(b.id));
}
