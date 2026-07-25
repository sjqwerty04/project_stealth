import type { VercelRequest, VercelResponse } from '@vercel/node';
import { guard } from './_lib/http';
import { SCRAPE_LIMIT } from './_lib/rateLimit';

export type IMDbTechSpecs = {
  soundMix: string[];
  aspectRatios: string[];
  camera: string[];
  cinematographicProcess: string[];
  isImax: boolean;
  isDolbyAtmos: boolean;
  isDolbyVision: boolean;
  isDolbySurround: boolean;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = await guard(req, res, { methods: ['GET'], rateLimit: SCRAPE_LIMIT });
  if (!auth.ok) return;

  const { imdbId } = req.query;

  if (!imdbId || typeof imdbId !== 'string') {
    return res.status(400).json({ error: 'imdbId query parameter is required' });
  }

  // Validate IMDb ID format (tt followed by digits)
  if (!/^tt\d+$/.test(imdbId)) {
    return res.status(400).json({ error: 'Invalid IMDb ID format. Expected format: tt1234567' });
  }

  try {
    const url = `https://www.imdb.com/title/${imdbId}/technical/`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    if (!response.ok) {
      console.error('IMDb fetch failed:', response.status);
      return res.status(response.status).json({ 
        error: `Failed to fetch IMDb page: ${response.status}` 
      });
    }

    const html = await response.text();
    
    // Parse technical specifications from HTML
    const techSpecs = parseTechSpecs(html);

    // Cache for 24 hours (tech specs don't change often)
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    
    return res.status(200).json(techSpecs);
  } catch (error: any) {
    console.error('IMDb tech specs error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

function parseTechSpecs(html: string): IMDbTechSpecs {
  const result: IMDbTechSpecs = {
    soundMix: [],
    aspectRatios: [],
    camera: [],
    cinematographicProcess: [],
    isImax: false,
    isDolbyAtmos: false,
    isDolbyVision: false,
    isDolbySurround: false,
  };

  // Extract Sound mix section
  const soundMixMatch = html.match(/Sound mix[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i);
  if (soundMixMatch) {
    const soundItems = soundMixMatch[1].match(/<li[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/gi);
    if (soundItems) {
      result.soundMix = soundItems.map(item => {
        const match = item.match(/>([^<]+)<\/a>/);
        return match ? match[1].trim() : '';
      }).filter(Boolean);
    }
  }

  // Alternative parsing for newer IMDb layout
  if (result.soundMix.length === 0) {
    // Look for sound mix in different format
    const soundMatches = html.match(/(?:Sound mix|sound_mixes)[^>]*>([^<]+)/gi);
    if (soundMatches) {
      soundMatches.forEach(match => {
        const text = match.replace(/.*>/, '').trim();
        if (text && !text.includes('Sound mix')) {
          result.soundMix.push(text);
        }
      });
    }
  }

  // Parse for specific audio formats in the entire HTML
  const htmlLower = html.toLowerCase();
  
  // IMAX detection
  result.isImax = 
    htmlLower.includes('imax') || 
    htmlLower.includes('imax 6-track') ||
    htmlLower.includes('imax 5.0') ||
    htmlLower.includes('filmed in imax') ||
    /cinematographic process[\s\S]{0,500}imax/i.test(html);

  // Dolby Atmos detection
  result.isDolbyAtmos = 
    htmlLower.includes('dolby atmos') ||
    htmlLower.includes('atmos');

  // Dolby Vision detection
  result.isDolbyVision = 
    htmlLower.includes('dolby vision');

  // Dolby Surround detection (various formats)
  result.isDolbySurround = 
    htmlLower.includes('dolby surround') ||
    htmlLower.includes('dolby digital') ||
    htmlLower.includes('dolby sr');

  // Extract Aspect ratios
  const aspectMatch = html.match(/Aspect ratio[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i);
  if (aspectMatch) {
    const ratioItems = aspectMatch[1].match(/<li[^>]*>([^<]+)/gi);
    if (ratioItems) {
      result.aspectRatios = ratioItems.map(item => 
        item.replace(/<[^>]+>/g, '').trim()
      ).filter(Boolean);
    }
  }

  // Check aspect ratios for IMAX indicators
  if (!result.isImax) {
    const aspectText = result.aspectRatios.join(' ').toLowerCase();
    if (aspectText.includes('imax') || aspectText.includes('1.43') || aspectText.includes('1.90')) {
      result.isImax = true;
    }
  }

  // Extract Camera information
  const cameraMatch = html.match(/Camera[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i);
  if (cameraMatch) {
    const cameraItems = cameraMatch[1].match(/<li[^>]*>([^<]+)/gi);
    if (cameraItems) {
      result.camera = cameraItems.map(item => 
        item.replace(/<[^>]+>/g, '').trim()
      ).filter(Boolean);
    }
  }

  // Check camera for IMAX
  if (!result.isImax) {
    const cameraText = result.camera.join(' ').toLowerCase();
    if (cameraText.includes('imax')) {
      result.isImax = true;
    }
  }

  // Extract Cinematographic Process
  const cinemaMatch = html.match(/Cinematographic Process[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i);
  if (cinemaMatch) {
    const cinemaItems = cinemaMatch[1].match(/<li[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/gi);
    if (cinemaItems) {
      result.cinematographicProcess = cinemaItems.map(item => {
        const match = item.match(/>([^<]+)<\/a>/);
        return match ? match[1].trim() : '';
      }).filter(Boolean);
    }
  }

  return result;
}
