import { FUNCTION_OPTIONS } from '../shared/product-taxonomy.js';
import { isPublicAddress, looksLikeFeed, NEWS_TOPICS, newsTopics, parseFeed, plainText, safeLink } from './news-feed.js';

describe('industry news feeds (REQ-016 part 3)', () => {
  const now = new Date('2026-11-11T00:00:00Z');

  it('reads RSS items with CDATA, escaped HTML and tracking parameters', () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>Feed</title>
      <item><title><![CDATA[Probiotics &amp; gut health in 2026]]></title>
        <link>https://example.com/a?id=1&amp;utm_source=RSS&amp;utm_medium=RSS</link>
        <description>&lt;p&gt;New &lt;b&gt;data&lt;/b&gt; on &amp;quot;microbiome&amp;quot;&lt;/p&gt;</description>
        <pubDate>Mon, 10 Nov 2026 09:00:00 GMT</pubDate></item>
      <item><title>No link</title></item>
      <item><title>Old story</title><link>https://example.com/old</link><pubDate>Mon, 01 Jun 2026 09:00:00 GMT</pubDate></item>
      <item><title>Script link</title><link>javascript:alert(1)</link></item>
      <item><title>Guid only</title><guid isPermaLink="true">https://example.com/guid</guid></item>
    </channel></rss>`;
    expect(looksLikeFeed(xml)).toBe(true);
    expect(parseFeed(xml, now)).toEqual([
      { title: 'Probiotics & gut health in 2026', summary: 'New data on "microbiome"', link: 'https://example.com/a?id=1', publishedAt: new Date('2026-11-10T09:00:00Z') },
      { title: 'Guid only', summary: null, link: 'https://example.com/guid', publishedAt: null },
    ]);
  });

  it('reads Atom entries and their alternate link', () => {
    const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title type="html">Collagen &amp;amp; skin</title>
      <link rel="self" href="https://example.com/self"/><link rel="alternate" href="https://example.com/post"/>
      <published>2026-11-09T01:02:03Z</published><summary>Beauty from within</summary></entry></feed>`;
    expect(parseFeed(xml, now)).toEqual([{ title: 'Collagen & skin', summary: 'Beauty from within', link: 'https://example.com/post', publishedAt: new Date('2026-11-09T01:02:03Z') }]);
  });

  it('keeps one entry per link and clips long text', () => {
    const long = 'x'.repeat(900);
    const xml = `<rss><item><title>A</title><link>https://e.com/1?utm_campaign=a</link><description>${long}</description></item>
      <item><title>A again</title><link>https://e.com/1?utm_campaign=b</link></item></rss>`;
    const entries = parseFeed(xml, now);
    expect(entries).toHaveLength(1);
    expect(entries[0].summary).toHaveLength(600);
    expect(entries[0].summary!.endsWith('…')).toBe(true);
  });

  it('turns feed markup into plain text without scripts', () => {
    expect(plainText('<![CDATA[<p>Hi<script>alert(1)</script> there&nbsp;&#8217;s &#x4e2d;</p>]]>')).toBe('Hi there ’s 中');
    expect(safeLink('ftp://e.com/x')).toBeNull();
    expect(safeLink('not a url')).toBeNull();
  });

  it('refuses internal addresses', () => {
    for (const address of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.5', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:192.168.0.1']) {
      expect(isPublicAddress(address)).toBe(false);
    }
    for (const address of ['8.8.8.8', '151.101.1.1', '2606:4700::1111']) expect(isPublicAddress(address)).toBe(true);
    expect(isPublicAddress('example.com')).toBe(false);
  });

  it('tags articles with store topics and ignores everyday business words', () => {
    const labels = (text: string) => newsTopics(text).map((topic) => topic.label);
    expect(labels('New probiotic strain improves gut health in children')).toEqual(['益生菌', '儿童成长']);
    expect(labels('Manuka honey exports to China rise')).toEqual(['蜂蜜', '跨境与中国市场']);
    expect(labels('TGA recall of fish oil capsules')).toEqual(['鱼油与 Omega-3', '监管与召回']);
    expect(labels('Revenue growth and a new vision as sales rose sharply')).toEqual([]);
  });

  it('uses the function names of the product taxonomy so topics match products in stock', () => {
    const functions = new Set(FUNCTION_OPTIONS.map((option) => `${option.group}/${option.label}`));
    for (const topic of NEWS_TOPICS.filter((item) => item.kind === 'function')) expect(functions.has(topic.key)).toBe(true);
    expect(new Set(NEWS_TOPICS.map((topic) => topic.key)).size).toBe(NEWS_TOPICS.length);
  });
});
