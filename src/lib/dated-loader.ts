import { glob, type Loader } from 'astro/loaders';
import { resolveArticleDates } from './article-history';

export function datedWritingLoader(preview: boolean): Loader {
  const markdown = glob({ pattern: '**/*.md', base: './src/content/writing' });
  return {
    name: 'writing-with-git-dates',
    async load(context) {
      // An identical file can acquire its first committed date between builds.
      // Re-parse it instead of reusing a preview date from the content cache.
      context.store.clear();
      await markdown.load({
        ...context,
        parseData: async (entry) => {
          if (!entry.filePath) throw new Error('記事のファイルパスがありません。');
          return context.parseData({
            ...entry,
            data: { ...entry.data, ...resolveArticleDates(entry.filePath, entry.data, preview) },
          });
        },
      });
    },
  };
}
