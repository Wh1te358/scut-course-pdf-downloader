(function attachLinkUtils(root) {
  'use strict';

  const EMBEDDED_URL_PARAMS = ['file', 'url', 'src'];

  function parseHttpUrl(raw, baseUrl) {
    let value = String(raw || '').trim();

    for (let attempt = 0; attempt < 3 && value; attempt += 1) {
      try {
        const parsed = new URL(value, baseUrl);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          return parsed;
        }
        return null;
      } catch {
        try {
          const decoded = decodeURIComponent(value);
          if (decoded === value) return null;
          value = decoded;
        } catch {
          return null;
        }
      }
    }

    return null;
  }

  function decodedPathname(urlObj) {
    try {
      return decodeURIComponent(urlObj.pathname).toLowerCase();
    } catch {
      return urlObj.pathname.toLowerCase();
    }
  }

  function isPdfUrl(urlObj) {
    return decodedPathname(urlObj).endsWith('.pdf');
  }

  function embeddedPdfUrl(wrapperUrl) {
    for (const param of EMBEDDED_URL_PARAMS) {
      const rawCandidate = wrapperUrl.searchParams.get(param);
      if (!rawCandidate) continue;

      const candidate = parseHttpUrl(rawCandidate, wrapperUrl.href);
      if (candidate && isPdfUrl(candidate)) return candidate;
    }

    return null;
  }

  function classifyLink(raw) {
    const sourceUrl = parseHttpUrl(raw);
    if (!sourceUrl) return { kind: 'invalid' };

    if (isPdfUrl(sourceUrl)) {
      return { kind: 'pdf', sourceUrl, fileUrl: sourceUrl, isPreview: false };
    }

    const fileUrl = embeddedPdfUrl(sourceUrl);
    if (fileUrl) {
      return { kind: 'pdf', sourceUrl, fileUrl, isPreview: true };
    }

    return { kind: 'unsupported', sourceUrl };
  }

  function safeFilename(name) {
    return name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');
  }

  function buildPdfName(fileUrl) {
    let sourceName = fileUrl.pathname.split('/').pop() || 'document.pdf';
    try {
      sourceName = decodeURIComponent(sourceName);
    } catch {
      // Keep malformed percent escapes encoded.
    }

    if (!sourceName.toLowerCase().endsWith('.pdf')) {
      sourceName = `${sourceName}.pdf`;
    }

    return safeFilename(sourceName) || 'document.pdf';
  }

  root.LinkUtils = { buildPdfName, classifyLink };
})(globalThis);
