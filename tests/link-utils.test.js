const assert = require('node:assert/strict');
const test = require('node:test');

require('../link-utils.js');

test('recognizes direct PDF links', () => {
  const result = LinkUtils.classifyLink('https://example.com/course/demo.pdf?token=1');
  assert.equal(result.kind, 'pdf');
  assert.equal(result.isPreview, false);
  assert.equal(result.fileUrl.href, 'https://example.com/course/demo.pdf?token=1');
  assert.equal(LinkUtils.buildPdfName(result.fileUrl), 'demo.pdf');
});

test('extracts an encoded PDF URL from an SCUT-style PDF.js viewer', () => {
  const fileUrl = 'https://ecourse.scut.edu.cn/webData/example/resource/example.pdf';
  const viewerUrl =
    'https://ecourse.scut.edu.cn/web/jsPlugin/pdfjs/web/viewer.html?file=' +
    encodeURIComponent(fileUrl);
  const result = LinkUtils.classifyLink(viewerUrl);

  assert.equal(result.kind, 'pdf');
  assert.equal(result.isPreview, true);
  assert.equal(result.fileUrl.href, fileUrl);
});

test('rejects course homepages and PPT/PPTX links', () => {
  assert.equal(
    LinkUtils.classifyLink('https://ecourse.scut.edu.cn/web/gt/1/index.html?wangZhanID=12345').kind,
    'unsupported'
  );
  assert.equal(LinkUtils.classifyLink('https://example.com/slides.pptx').kind, 'unsupported');
});

test('rejects non-HTTP schemes', () => {
  assert.equal(LinkUtils.classifyLink('javascript:alert(1)').kind, 'invalid');
  assert.equal(LinkUtils.classifyLink('file:///C:/private.pdf').kind, 'invalid');
});
