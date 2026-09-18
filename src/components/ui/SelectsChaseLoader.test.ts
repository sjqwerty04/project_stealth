import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import SelectsChaseLoader from './SelectsChaseLoader';

describe('SelectsChaseLoader', () => {
  it('renders 5 chase bars with aria role and attributes', () => {
    const html = renderToString(React.createElement(SelectsChaseLoader, { size: 'md' }));
    expect(html).toContain('role="status"');
    expect(html).toContain('selects-chase-mark');
    // Count bars rendered
    const barMatches = html.match(/selects-chase-bar/g) || [];
    expect(barMatches.length).toBe(5);
  });

  it('renders custom label when provided', () => {
    const html = renderToString(
      React.createElement(SelectsChaseLoader, { label: 'Finding next film...' })
    );
    expect(html).toContain('Finding next film...');
    expect(html).toContain('data-testid="selects-chase-label"');
  });

  it('renders different size configurations', () => {
    const htmlSm = renderToString(React.createElement(SelectsChaseLoader, { size: 'sm' }));
    const htmlLg = renderToString(React.createElement(SelectsChaseLoader, { size: 'lg' }));
    expect(htmlSm).toContain('height:14px');
    expect(htmlLg).toContain('height:28px');
  });

  it('applies center wrapper when center=true', () => {
    const html = renderToString(React.createElement(SelectsChaseLoader, { center: true }));
    expect(html).toContain('flex items-center justify-center');
  });
});
