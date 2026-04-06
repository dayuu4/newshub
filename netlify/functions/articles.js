const https = require('https');
const http = require('http');
const { URL } = require('url');

const DEFAULT_FEEDS = [
  {id:'one-useful-thing',name:'One Useful Thing',url:'https://www.oneusefulthing.org/feed',cat:'ai'},
  {id:'simon-willison',name:'Simon Willison',url:'https://simonwillison.net/atom/everything/',cat:'ai'},
  {id:'hf',name:'Hugging Face',url:'https://huggingface.co/blog/feed.xml',cat:'ai'},
  {id:'the-batch',name:'The Batch (DL.AI)',url:'https://www.deeplearning.ai/the-batch/feed/',cat:'ai'},
  {id:'ai-news',name:'AI News',url:'https://www.artificialintelligence-news.com/feed/',cat:'ai'},
  {id:'mit-ai',name:'MIT AI News',url:'https://news.mit.edu/rss/topic/artificial-intelligence2',cat:'ai'},
  {id:'openai',name:'OpenAI Blog',url:'https://openai.com/news/rss.xml',cat:'ai'},
  {id:'deepmind',name:'Google DeepMind',url:'https://deepmind.google/blog/rss.xml',cat:'ai'},
  {id:'import-ai',name:'Import AI',url:'https://jack-clark.net/feed/',cat:'ai'},
  {id:'hn',name:'Hacker News',url:'https://hnrss.org/frontpage',cat:'tech'},
  {id:'tc',name:'TechCrunch',url:'https://techcrunch.com/feed/',cat:'tech'},
  {id:'verge',name:'The Verge',url:'https://www.theverge.com/rss/index.xml',cat:'tech'},
  {id:'ars',name:'Ars Technica',url:'https://feeds.arstechnica.com/arstechnica/index',cat:'tech'},
  {id:'engadget',name:'Engadget',url:'https://www.engadget.com/rss.xml',cat:'tech'},
  {id:'zdnet',name:'ZDNet',url:'https://www.zdnet.com/news/rss.xml',cat:'tech'},
  {id:'tldr-tech',name:'TLDR Tech',url:'https://tldr.tech/rss',cat:'tech'},
  {id:'cnbc',name:'CNBC Markets',url:'https://www.cnbc.com/id/100003114/device/rss/rss.html',cat:'finance'},
  {id:'mwatch',name:'MarketWatch',url:'https://feeds.marketwatch.com/marketwatch/topstories/',cat:'finance'},
  {id:'coindesk',name:'CoinDesk',url:'https://www.coindesk.com/arc/outboundfeeds/rss/',cat:'finance'},
  {id:'yahoo-finance',name:'Yahoo Finance',url:'https://finance.yahoo.com/news/rssindex',cat:'finance'},
  {id:'fool',name:'Motley Fool',url:'https://www.fool.com/feeds/index.aspx',cat:'finance'},
  {id:'bbc',name:'BBC News',url:'https://feeds.bbci.co.uk/news/rss.xml',cat:'general'},
  {id:'guardian',name:'The Guardian Tech',url:'https://www.theguardian.com/technology/rss',cat:'general'},
  {id:'mit-rev',name:'MIT Tech Review',url:'https://www.technologyreview.com/feed/',cat:'general'},
  {id:'nyt-tech',name:'NYT Technology',url:'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml',cat:'general'},
  {id:'new-scientist',name:'New Scientist',url:'https://www.newscientist.com/feed/home/',cat:'general'},
];

function stripTags(html) {
  if (!html) return '';
  return String(html)
    .replace(/<[^>]+>/g,' ')
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&nbsp;/g,' ')
    .replace(/\s+/g,' ').trim();
}

function parseDate(s) {
  if (!s) return null;
  try { const d = new Date(s); return isNaN(d) ? null : d.toISOString(); } catch { return null; }
}

function getTag(xml, tag) {
  const patterns = [
    new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)<\/' + tag + '>', 'i'),
    new RegExp('<[a-z]+:' + tag + '[^>]*>([\\s\\S]*?)</[a-z]+:' + tag + '>', 'i'),
  ];
  for (const p of patterns) {
    const m = xml.match(p);
    if (m) return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
  }
  return '';
}

function parseFeed(text, feed) {
  const articles = [];
  const isAtom = /<feed[\s>]/i.test(text);
  if (isAtom) {
    const entries = text.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
    for (const e of entries.slice(0, 40)) {
      const title = stripTags(getTag(e, 'title')) || 'Untitled';
      const lm = e.match(/<link[^>]+href="([^"]+)"/i);
      const link = lm ? lm[1] : '';
      const date = parseDate(getTag(e,'published') || getTag(e,'updated'));
      const desc = stripTags(getTag(e,'summary') || getTag(e,'content')).slice(0,280);
      if (link) articles.push({title,link,date,desc,source:feed.name,cat:feed.cat,feedId:feed.id});
    }
  } else {
    const items = text.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
    for (const it of items.slice(0, 40)) {
      const title = stripTags(getTag(it,'title')) || 'Untitled';
      const link = (getTag(it,'link') || getTag(it,'guid') || '').trim();
      const date = parseDate(getTag(it,'pubDate') || getTag(it,'date'));
      const desc = stripTags(getTag(it,'description') || getTag(it,'summary')).slice(0,280);
      if (link) articles.push({title,link,date,desc,source:feed.name,cat:feed.cat,feedId:feed.id});
    }
  }
  return articles;
}

function fetchFeed(feed, redirects = 0) {
  return new Promise((resolve) => {
    if (redirects > 3) return resolve([]);
    try {
      const u = new URL(feed.url);
      const lib = u.protocol === 'https:' ? https : http;
      const req = lib.request({
        hostname: u.hostname, path: u.pathname + u.search, port: u.port || undefined,
        headers: {'User-Agent':'Mozilla/5.0 NewsHub/3.0','Accept':'application/rss+xml,application/atom+xml,*/*'},
        timeout: 7000,
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchFeed({...feed, url: new URL(res.headers.location, feed.url).href}, redirects+1).then(resolve);
        }
        let data = '';
        res.setEncoding('utf8');
        res.on('data', c => data += c);
        res.on('end', () => { try { resolve(parseFeed(data, feed)); } catch { resolve([]); }});
        res.on('error', () => resolve([]));
      });
      req.on('timeout', () => { req.destroy(); resolve([]); });
      req.on('error', () => resolve([]));
      req.end();
    } catch { resolve([]); }
  });
}

const CORS = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,OPTIONS','Access-Control-Allow-Headers':'Content-Type'};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return {statusCode:200, headers:CORS, body:''};
  const timeout = (ms) => new Promise(r => setTimeout(() => r([]), ms));
  const results = await Promise.allSettled(
    DEFAULT_FEEDS.map(f => Promise.race([fetchFeed(f), timeout(8500)]))
  );
  const articles = results.flatMap(r => r.status === 'fulfilled' ? (r.value || []) : []);
  articles.sort((a,b) => (b.date||'') > (a.date||'') ? 1 : -1);
  return {
    statusCode: 200,
    headers: {...CORS, 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'public, s-maxage=1800, stale-while-revalidate=86400'},
    body: JSON.stringify(articles),
  };
};
