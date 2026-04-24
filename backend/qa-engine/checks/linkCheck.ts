import axios from 'axios';
import { CheckStatus, QAIssue } from '../types';

export interface LinkCheckResult {
  status: CheckStatus;
  linksChecked: number;
  brokenLinksCount: number;
  issues: QAIssue[];
}

const MAX_LINKS = 40;
const REQUEST_TIMEOUT = 8000;

function extractLinks(html: string, baseUrl: string): string[] {
  const seen = new Set<string>();
  const links: string[] = [];
  const hrefRegex = /href=["']([^"'#?]+)["']/g;

  let match: RegExpExecArray | null;
  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1];
    if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) continue;

    let url: string;
    try {
      url = href.startsWith('http') ? href : new URL(href, baseUrl).toString();
    } catch {
      continue;
    }

    // Only check links on the same domain + relative
    const base = new URL(baseUrl);
    const target = new URL(url);
    if (target.hostname !== base.hostname) continue;

    if (!seen.has(url)) {
      seen.add(url);
      links.push(url);
    }

    if (links.length >= MAX_LINKS) break;
  }

  return links;
}

async function checkLink(url: string): Promise<{ url: string; ok: boolean; statusCode: number }> {
  try {
    const res = await axios.head(url, {
      timeout: REQUEST_TIMEOUT,
      maxRedirects: 5,
      validateStatus: () => true,
      headers: { 'User-Agent': 'QA-Control-Center/1.0' },
    });
    return { url, ok: res.status < 400, statusCode: res.status };
  } catch {
    return { url, ok: false, statusCode: 0 };
  }
}

export async function runLinkCheck(
  url: string,
  emit: (level: string, msg: string) => void
): Promise<LinkCheckResult> {
  const issues: QAIssue[] = [];

  emit('info', `Fetching page: ${url}`);
  let html: string;
  try {
    const res = await axios.get(url, {
      timeout: 15000,
      headers: { 'User-Agent': 'QA-Control-Center/1.0' },
      responseType: 'text',
    });
    html = res.data as string;
  } catch (e) {
    emit('error', `Cannot fetch page: ${String(e)}`);
    return { status: 'fail', linksChecked: 0, brokenLinksCount: 0, issues: [{ type: 'broken_link', url, message: `Page unreachable: ${String(e)}`, severity: 'critical' }] };
  }

  const links = extractLinks(html, url);
  emit('info', `Found ${links.length} links to check`);

  const BATCH = 8;
  const broken: { url: string; statusCode: number }[] = [];

  for (let i = 0; i < links.length; i += BATCH) {
    const batch = links.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(checkLink));
    for (const r of results) {
      if (!r.ok) {
        broken.push({ url: r.url, statusCode: r.statusCode });
        emit('warn', `Broken link [${r.statusCode || 'ERR'}]: ${r.url}`);
        issues.push({
          type: 'broken_link',
          url: r.url,
          message: `${r.statusCode || 'Network error'} — ${r.url}`,
          severity: r.statusCode === 404 ? 'high' : 'medium',
        });
      }
    }
  }

  emit(broken.length ? 'warn' : 'success', `Link check: ${broken.length} broken / ${links.length} checked`);

  let status: CheckStatus = 'pass';
  if (broken.length > 0) status = broken.some((b) => b.statusCode === 404) ? 'fail' : 'warning';

  return { status, linksChecked: links.length, brokenLinksCount: broken.length, issues };
}
