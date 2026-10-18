import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { articleTimestamp, isValidArticleDate } from './lib/dates';

const articleDate = z.string().refine(isValidArticleDate, {
  message: '日付は "YYYY-MM-DD"、日時は "YYYY-MM-DDTHH:mm:ss+09:00" のように引用符とタイムゾーンを指定してください。',
});
const qa = process.env.NOTES_QA === '1' && import.meta.env.MODE === 'qa';

const writing = defineCollection({
  loader: glob({ pattern: '**/*.md', base: qa ? './tests/fixtures' : './src/content/writing' }),
  schema: z.object({
    title: z.string().trim().min(1),
    description: z.string().trim().optional(),
    publishedAt: articleDate,
    updatedAt: articleDate.optional(),
    category: z.enum(['Learning', 'Essays', 'Notes']).optional(),
    draft: z.boolean().default(false),
    language: z.enum(['ja', 'en']).default('ja'),
  }).refine(article => !article.updatedAt || articleTimestamp(article.updatedAt) >= articleTimestamp(article.publishedAt), {
    message: 'updatedAt は publishedAt より前にできません。', path: ['updatedAt'],
  }),
});

export const collections = { writing };
