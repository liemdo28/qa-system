import { QAIssue } from './types';

export interface IssueTemplate {
  whyItMatters: string;
  suggestedFix: string;
  exampleFix?: string;
  filesToCheck: string[];
}

type TemplateKey =
  | 'seo_missing_title'
  | 'seo_missing_description'
  | 'seo_missing_og_title'
  | 'seo_missing_og_description'
  | 'seo_missing_canonical'
  | 'broken_link'
  | 'performance_slow'
  | 'auth_required'
  | 'build_failed'
  | 'console_error'
  | 'default';

const TEMPLATES: Record<TemplateKey, IssueTemplate> = {
  seo_missing_title: {
    whyItMatters: 'The <title> tag is the single most important on-page SEO element. Search engines auto-generate one when it is missing, usually with poor quality. It also appears in browser tabs and bookmarks.',
    suggestedFix: 'Add a unique, descriptive <title> tag in the <head> of every page.',
    exampleFix: '<title>Bakudan Dashboard — Operations & Reports</title>',
    filesToCheck: ['index.html', 'public/index.html', 'src/App.tsx', 'src/pages/Home.tsx'],
  },
  seo_missing_description: {
    whyItMatters: 'Search engines and social media previews use the meta description to summarize the page content. Missing it reduces click-through rates from search results.',
    suggestedFix: 'Add a unique meta description (150–160 characters) in the <head> of each page.',
    exampleFix: '<meta name="description" content="Manage Bakudan Ramen operations, tasks, and reports in one dashboard.">',
    filesToCheck: ['index.html', 'public/index.html', 'src/App.tsx', 'src/pages/Login.tsx'],
  },
  seo_missing_og_title: {
    whyItMatters: 'Open Graph title controls how the page title appears when shared on Facebook, LinkedIn, and messaging apps.',
    suggestedFix: 'Add og:title to the <head> of the page.',
    exampleFix: '<meta property="og:title" content="Bakudan Dashboard">',
    filesToCheck: ['index.html', 'public/index.html', 'src/components/Head.tsx'],
  },
  seo_missing_og_description: {
    whyItMatters: 'Open Graph description is shown in link previews on social platforms. Without it the platform may show nothing or scrape random text.',
    suggestedFix: 'Add og:description to the <head> of the page.',
    exampleFix: '<meta property="og:description" content="Internal operations dashboard for Bakudan Ramen.">',
    filesToCheck: ['index.html', 'public/index.html', 'src/components/Head.tsx'],
  },
  seo_missing_canonical: {
    whyItMatters: 'Without a canonical tag, search engines may index multiple URL variants (http/https, www/non-www, trailing slash), splitting page authority.',
    suggestedFix: 'Add a canonical link element pointing to the preferred version of the URL.',
    exampleFix: '<link rel="canonical" href="https://dashboard.bakudanramen.com/">',
    filesToCheck: ['index.html', 'public/index.html'],
  },
  broken_link: {
    whyItMatters: 'Broken links harm user experience and cause search engines to crawl dead pages, which wastes crawl budget and may signal poor site maintenance.',
    suggestedFix: 'Fix or remove the broken link. Check whether the URL changed, the resource was deleted, or a typo is present.',
    filesToCheck: ['src/components/', 'src/pages/', 'public/', 'src/router/'],
  },
  performance_slow: {
    whyItMatters: 'Slow load times directly increase bounce rates. Google uses Core Web Vitals as a ranking factor. Users on mobile or slow connections are most affected.',
    suggestedFix: 'Run a Lighthouse audit. Common fixes: compress images, lazy-load assets below the fold, reduce JS bundle size with code splitting, enable gzip/brotli compression.',
    filesToCheck: ['vite.config.ts', 'src/main.tsx', 'public/', 'src/assets/'],
  },
  auth_required: {
    whyItMatters: 'QA is testing a login page instead of the actual application content. SEO checks on login pages are meaningless and create false results.',
    suggestedFix: 'Configure the project qa.entry to point to a public page, or set up an authentication bypass for the QA test environment. If this is an internal-only app, mark SEO as not applicable.',
    exampleFix: '{ "qa": { "entry": "/public-landing" } }  // in config/projects.json',
    filesToCheck: ['config/projects.json'],
  },
  build_failed: {
    whyItMatters: 'Build failure means the project cannot be compiled or deployed. No code changes can go to production until this is resolved.',
    suggestedFix: 'Run npm install and npm run build locally. Check for missing dependencies, TypeScript errors, or environment variables that are required at build time.',
    filesToCheck: ['package.json', 'tsconfig.json', 'vite.config.ts', '.env'],
  },
  console_error: {
    whyItMatters: 'JavaScript runtime errors may crash features for users, cause blank screens, or indicate security problems. They appear in the browser console.',
    suggestedFix: 'Open browser DevTools → Console tab. Reproduce the error and trace it to the source file. Common causes: null reference, network failure, missing env variable.',
    filesToCheck: ['src/', 'src/hooks/', 'src/components/', 'src/pages/'],
  },
  default: {
    whyItMatters: 'This issue may affect quality, accessibility, or SEO performance of the page.',
    suggestedFix: 'Review the issue details and address the root cause in the relevant source file.',
    filesToCheck: ['src/', 'public/', 'index.html'],
  },
};

function getTemplateKey(issue: QAIssue): TemplateKey {
  if (issue.type === 'seo_missing') {
    const msg = issue.message.toLowerCase();
    if (msg.includes('<title>') || (msg.includes('title') && !msg.includes('og'))) return 'seo_missing_title';
    if (msg.includes('description') && !msg.includes('og')) return 'seo_missing_description';
    if (msg.includes('og:title'))       return 'seo_missing_og_title';
    if (msg.includes('og:description')) return 'seo_missing_og_description';
    if (msg.includes('canonical'))      return 'seo_missing_canonical';
  }
  if (issue.type === 'broken_link')      return 'broken_link';
  if (issue.type === 'performance_slow') return 'performance_slow';
  if (issue.type === 'build_error')      return 'build_failed';
  if (issue.type === 'console_error')    return 'console_error';
  return 'default';
}

export function enrichIssue(issue: QAIssue): QAIssue {
  const key     = getTemplateKey(issue);
  const tmpl    = TEMPLATES[key];
  return {
    ...issue,
    whyItMatters: tmpl.whyItMatters,
    suggestedFix: tmpl.suggestedFix,
    exampleFix:   tmpl.exampleFix,
    filesToCheck: tmpl.filesToCheck,
  };
}

export function enrichIssues(issues: QAIssue[]): QAIssue[] {
  return issues.map(enrichIssue);
}

export function getAuthTemplate(): IssueTemplate {
  return TEMPLATES.auth_required;
}
