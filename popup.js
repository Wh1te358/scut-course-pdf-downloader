const urlInput = document.getElementById('urlInput');
const detectBtn = document.getElementById('detectBtn');
const downloadBtn = document.getElementById('downloadBtn');
const statusEl = document.getElementById('status');
const { buildPdfName, classifyLink } = LinkUtils;

function setStatus(text, type = '') {
  statusEl.textContent = text;
  statusEl.className = `status ${type}`.trim();
}

function samePageUrl(left, right) {
  try {
    const leftUrl = new URL(left);
    const rightUrl = new URL(right);
    leftUrl.hash = '';
    rightUrl.hash = '';
    return leftUrl.href === rightUrl.href;
  } catch {
    return false;
  }
}

function downloadWithChrome(options) {
  return new Promise((resolve, reject) => {
    chrome.downloads.download(options, (downloadId) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(downloadId);
    });
  });
}

async function exportLoadedPdfJsDocument(link) {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.id || !samePageUrl(activeTab.url, link.sourceUrl.href)) {
    throw new Error('请先在当前标签页打开这个 PDF 预览链接，再点击扩展下载。');
  }

  const [{ result } = {}] = await chrome.scripting.executeScript({
    target: { tabId: activeTab.id },
    world: 'MAIN',
    args: [buildPdfName(link.fileUrl)],
    func: async (filename) => {
      try {
        const app = globalThis.PDFViewerApplication;
        if (!app?.pdfDocument) {
          return { ok: false, error: 'PDF 还没有加载完成，请稍后重试。' };
        }

        const bytes = await app.pdfDocument.getData();
        const blobUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
        const anchor = document.createElement('a');
        anchor.href = blobUrl;
        anchor.download = filename;
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);

        return { ok: true, bytes: bytes.byteLength, pages: app.pagesCount || null };
      } catch (error) {
        return { ok: false, error: String(error?.message || error) };
      }
    }
  });

  if (!result?.ok) {
    throw new Error(result?.error || '无法从 PDF.js 预览器读取文件。');
  }

  return result;
}

detectBtn.addEventListener('click', () => {
  const link = classifyLink(urlInput.value);

  if (link.kind === 'invalid') {
    setStatus('链接格式错误，请输入完整的 HTTP 或 HTTPS URL。', 'error');
    downloadBtn.disabled = true;
    return;
  }

  if (link.kind === 'unsupported') {
    setStatus('没有识别出 PDF 文件或 PDF.js 预览链接。', 'error');
    downloadBtn.disabled = true;
    return;
  }

  setStatus(
    link.isPreview
      ? '识别成功：保持当前 PDF 预览页打开，然后下载。'
      : '识别成功：将直接下载 PDF。',
    'ok'
  );
  downloadBtn.disabled = false;
});

urlInput.addEventListener('input', () => {
  downloadBtn.disabled = true;
  setStatus('链接已改变，请重新识别。');
});

downloadBtn.addEventListener('click', async () => {
  const link = classifyLink(urlInput.value);
  if (link.kind !== 'pdf') {
    setStatus('请先识别有效的 PDF 链接。', 'error');
    downloadBtn.disabled = true;
    return;
  }

  downloadBtn.disabled = true;

  try {
    if (link.isPreview) {
      setStatus('正在从当前 PDF.js 预览器导出原文件...', '');
      const result = await exportLoadedPdfJsDocument(link);
      const details = [result.pages ? `${result.pages} 页` : '', `${result.bytes} 字节`]
        .filter(Boolean)
        .join('，');
      setStatus(`PDF 已开始下载（${details}）。`, 'ok');
    } else {
      setStatus('正在启动 PDF 下载...', '');
      await downloadWithChrome({
        url: link.fileUrl.href,
        filename: buildPdfName(link.fileUrl),
        saveAs: true
      });
      setStatus('PDF 已开始下载。', 'ok');
    }
  } catch (error) {
    setStatus(`下载失败：${error.message}`, 'error');
  } finally {
    downloadBtn.disabled = false;
  }
});
