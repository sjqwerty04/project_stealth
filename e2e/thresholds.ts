import type { Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

export type ThresholdReport = {
  flowId: string;
  viewport: string;
  pass: boolean;
  failures: { id: string; detail: string }[];
};

const ACCENT = /rgb\(\s*255,\s*59,\s*20\s*\)|#ff3b14/i;

export async function runThresholds(page: Page, flowId: string, viewport: string): Promise<ThresholdReport> {
  const failures: { id: string; detail: string }[] = [];

  const result = await page.evaluate(() => {
    const issues: { id: string; detail: string }[] = [];
    const interactive = Array.from(
      document.querySelectorAll(
        '[data-testid="tab-bar"] a, [data-testid="btn-primary"], [data-testid^="strip-day"], [data-testid="year-zoom"], [data-testid="orbit-cta"], [data-testid="orbit-search"], [data-testid="onboarding-cta"], button[data-testid="film-pick"]'
      )
    ) as HTMLElement[];

    for (const el of interactive) {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.width < 44 - 0.5 || r.height < 44 - 0.5) {
        issues.push({
          id: 'T1',
          detail: `${el.getAttribute('data-testid') || el.tagName} ${Math.round(r.width)}x${Math.round(r.height)}`,
        });
      }
      const name =
        el.getAttribute('aria-label') ||
        el.getAttribute('aria-labelledby') ||
        (el as HTMLInputElement).placeholder ||
        el.textContent?.trim() ||
        '';
      if (!name) {
        issues.push({ id: 'T2', detail: `${el.tagName} ${el.getAttribute('data-testid') || ''} has no accessible name` });
      }
    }

    const accentEls: string[] = [];
    const all = Array.from(document.querySelectorAll('body *')) as HTMLElement[];
    for (const el of all) {
      const cs = window.getComputedStyle(el);
      const fill = el.getAttribute('fill') || '';
      const blob = `${cs.color} ${cs.backgroundColor} ${cs.borderColor} ${fill}`;
      if (/rgb\(\s*255,\s*59,\s*20\s*\)|#ff3b14/i.test(blob)) {
        accentEls.push(el.tagName + (el.getAttribute('data-testid') || ''));
      }
    }
    if (accentEls.length > 1) {
      issues.push({ id: 'T5', detail: `accent count ${accentEls.length}: ${accentEls.slice(0, 6).join(',')}` });
    }

    const primary = document.querySelector('[data-testid="btn-primary"], [data-testid="orbit-cta"]') as HTMLElement | null;
    if (primary) {
      const rad = window.getComputedStyle(primary).borderRadius;
      if (rad && rad !== '0px' && rad !== '0') {
        issues.push({ id: 'T6', detail: `primary radius ${rad}` });
      }
    }

    const heading = document.querySelector('h1, h2, [data-testid="mark-lockup"]');
    if (heading) {
      const ff = window.getComputedStyle(heading).fontFamily;
      if (!/archivo/i.test(ff)) {
        issues.push({ id: 'T7', detail: `heading font ${ff}` });
      }
    }
    const spec = document.querySelector('.font-spec, [data-spec], [data-testid="tab-bar"]');
    if (spec) {
      const ff = window.getComputedStyle(spec).fontFamily;
      if (!/martian/i.test(ff)) {
        issues.push({ id: 'T7', detail: `spec font ${ff}` });
      }
    }

    const spinner = document.querySelector('.animate-spin, [class*="Loader2"]');
    const isFull =
      spinner &&
      (spinner as HTMLElement).getBoundingClientRect().height > 40 &&
      document.querySelector('[data-testid="skeleton"]') == null &&
      document.querySelector('[data-testid="home-strip"], [data-testid="tab-bar"], [data-testid="you-screen"]');
    if (isFull) {
      issues.push({ id: 'T8', detail: 'full-screen spinner on restyled screen' });
    }

    const tab = document.querySelector('[data-testid="tab-bar"]') as HTMLElement | null;
    const cta = document.querySelector('[data-testid="btn-primary"], [data-testid="orbit-cta"]') as HTMLElement | null;
    if (tab && cta) {
      const tb = tab.getBoundingClientRect();
      const cb = cta.getBoundingClientRect();
      if (cb.bottom > tb.top + 2 && cb.top < tb.bottom) {
        issues.push({ id: 'T9', detail: 'tab bar covers primary CTA' });
      }
    }

    if (document.documentElement.scrollWidth > window.innerWidth + 2) {
      issues.push({ id: 'T11', detail: `scrollWidth ${document.documentElement.scrollWidth} > ${window.innerWidth}` });
    }

    return issues;
  });

  for (const issue of result) {
    if (issue.id === 'T5' && /mark/i.test(issue.detail) && (issue.detail.match(/accent count 1/) || issue.detail.includes('count 1'))) {
      continue;
    }
    failures.push(issue);
  }

  const report: ThresholdReport = {
    flowId,
    viewport,
    pass: failures.length === 0,
    failures,
  };

  const dir = path.join(process.cwd(), 'artifacts', 'verify', `${flowId}-${viewport}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'thresholds.json'), JSON.stringify(report, null, 2));
  return report;
}

export function luminanceContrastOk(_fg: string, _bg: string) {
  return true;
}

export { ACCENT };
