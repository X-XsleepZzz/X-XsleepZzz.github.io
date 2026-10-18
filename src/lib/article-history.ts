import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, relative } from 'node:path';
import { parseFrontmatter } from 'astro/markdown';
import { articleTimestamp } from './dates.ts';

type ArticleData = Record<string, unknown>;
type Revision = { timestamp: string; source: string };

function japaneseDay(timestamp: string | Date): string {
  return new Date(new Date(timestamp).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// Date fields and draft switches alone are not changes to the published article.
function articleVersion(source: string) {
  const { frontmatter, content } = parseFrontmatter(source);
  const metadata = Object.fromEntries(Object.entries(frontmatter)
    .filter(([key]) => !['publishedAt', 'updatedAt', 'draft'].includes(key))
    .sort(([left], [right]) => left.localeCompare(right)));
  return { draft: frontmatter.draft === true, fingerprint: JSON.stringify(metadata) + content };
}

export function datesFromRevisions(revisions: Revision[]) {
  let first: Revision | undefined;
  let latest: Revision | undefined;
  let previousVersion: string | undefined;
  for (const revision of revisions) {
    const version = articleVersion(revision.source);
    if (version.draft) continue;
    first ??= revision;
    if (version.fingerprint !== previousVersion) latest = revision;
    previousVersion = version.fingerprint;
  }
  if (!first || !latest) return undefined;
  return {
    publishedAt: japaneseDay(first.timestamp),
    ...(latest !== first ? {
      updatedAt: japaneseDay(new Date(Math.max(Date.parse(first.timestamp), Date.parse(latest.timestamp)))),
    } : {}),
    fingerprint: previousVersion,
  };
}

/** Build dates from version history, never the checkout time or the build clock. */
export function resolveArticleDates(filePath: string, data: ArticleData, preview = false) {
  filePath = realpathSync(filePath);
  const git = (...args: string[]) => execFileSync('git', args, {
    cwd: dirname(filePath), encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const root = git('rev-parse', '--show-toplevel').trim();
  if (git('rev-parse', '--is-shallow-repository').trim() === 'true') {
    throw new Error('記事の日付にはGitの全履歴が必要です。git fetch --unshallow を実行してください。');
  }
  const articlePath = relative(root, filePath).replaceAll('\\', '/');
  // -z keeps spaces and Japanese filenames intact; --follow also handles renames.
  const fields = git('-C', root, 'log', '--first-parent', '--follow', '--diff-filter=AMR', '--format=%H%x00%cI', '--name-only', '-z', '--', articlePath).split('\0');
  const revisions: Revision[] = [];
  for (let index = 0; index + 2 < fields.length; index += 3) {
    const [commit, timestamp, name] = fields.slice(index, index + 3);
    if (!/^[a-f0-9]{40,64}$/.test(commit) || !name.startsWith('\n')) {
      throw new Error(`記事のGit履歴を読み取れません: ${articlePath}`);
    }
    revisions.push({ timestamp, source: git('-C', root, 'show', `${commit}:${name.slice(1)}`) });
  }
  const history = datesFromRevisions(revisions.reverse());
  const currentVersion = articleVersion(readFileSync(filePath, 'utf8'));
  // Uncommitted writing is only a local preview. Its final date is fixed on commit.
  const needsPreviewDate = preview && !currentVersion.draft && currentVersion.fingerprint !== history?.fingerprint;
  const localDay = () => japaneseDay(statSync(filePath).mtime);
  const publishedAt = data.publishedAt ?? history?.publishedAt
    ?? ((preview || data.draft === true) ? localDay() : undefined);
  if (!publishedAt) {
    throw new Error(`公開日を自動設定するには記事をGitにコミットしてください: ${articlePath}`);
  }
  let updatedAt = data.updatedAt ?? (needsPreviewDate && history ? localDay() : history?.updatedAt);
  if (typeof updatedAt === 'string' && typeof publishedAt === 'string'
      && data.updatedAt === undefined && articleTimestamp(updatedAt) < articleTimestamp(publishedAt)) {
    updatedAt = undefined;
  }
  return { publishedAt, ...(updatedAt !== undefined ? { updatedAt } : {}) };
}
