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
  {id:'google-ai',name:'Google AI Blog',url:'https://blog.google/technology/ai/rss/',cat:'ai'},
  {id:'nvidia-dev',name:'Nvidia AI Blog',url:'https://developer.nvidia.com/blog/feed/',cat:'ai'},
  {id:'arxiv-ai',name:'ArXiv CS.AI',url:'https://rss.arxiv.org/rss/cs.AI',cat:'ai'},
  {id:'lesswrong',name:'LessWrong',url:'https://www.lesswrong.com/feed.xml',cat:'ai'},
  {id:'the-gradient',name:'The Gradient',url:'https://thegradient.pub/rss/',cat:'ai'},
  {id:'towards-ds',name:'Towards Data Science',url:'https://towardsdatascience.com/feed',cat:'ai'},
  {id:'towards-ai',name:'Towards AI',url:'https://pub.towardsai.net/feed',cat:'ai'},
  {id:'anthropic',name:'Anthropic',url:'https://news.google.com/rss/search?q=site:anthropic.com&hl=en-US&gl=US&ceid=US:en',cat:'ai'},
  {id:'meta-ai',name:'Meta AI',url:'https://news.google.com/rss/search?q=site:ai.meta.com&hl=en-US&gl=US&ceid=US:en',cat:'ai'},
  {id:'mistral',name:'Mistral AI',url:'https://news.google.com/rss/search?q=site:mistral.ai&hl=en-US&gl=US&ceid=US:en',cat:'ai'},
  {id:'a16z-ai',name:'a16z AI',url:'https://news.google.com/rss/search?q=site:a16z.com+AI&hl=en-US&gl=US&ceid=US:en',cat:'ai'},
  {id:'perplexity',name:'Perplexity AI',url:'https://news.google.com/rss/search?q=site:perplexity.ai&hl=en-US&gl=US&ceid=US:en',cat:'ai'},
  {id:'superhuman-ai',name:'Superhuman AI',url:'https://news.google.com/rss/search?q=superhuman+AI+newsletter&hl=en-US&gl=US&ceid=US:en',cat:'ai'},
  {id:'venturebeat-ai',name:'VentureBeat AI',url:'https://news.google.com/rss/search?q=site:venturebeat.com+AI&hl=en-US&gl=US&ceid=US:en',cat:'ai'},
  {id:'investopedia',name:'Investopedia',url:'https://news.google.com/rss/search?q=site:investopedia.com&hl=en-US&gl=US&ceid=US:en',cat:'finance'},
  {id:'barrons',name:"Barron's",url:'https://news.google.com/rss/search?q=site:barrons.com&hl=en-US&gl=US&ceid=US:en',cat:'finance'},
  {id:'rundown-ai',name:'The Rundown AI',url:'https://therundown.substack.com/feed',cat:'ai'},
  {id:'bens-bites',name:"Ben's Bites",url:'https://www.bensbites.com/feed',cat:'ai'},
  {id:'tldr-ai',name:'TLDR AI',url:'https://tldr.tech/api/rss/ai',cat:'ai'},
  {id:'hn',name:'Hacker News',url:'https://hnrss.org/frontpage',cat:'tech'},
  {id:'tc',name:'TechCrunch',url:'https://techcrunch.com/feed/',cat:'tech'},
  {id:'verge',name:'The Verge',url:'https://www.theverge.com/rss/index.xml',cat:'tech'},
  {id:'ars',name:'Ars Technica',url:'https://feeds.arstechnica.com/arstechnica/index',cat:'tech'},
  {id:'engadget',name:'Engadget',url:'https://www.engadget.com/rss.xml',cat:'tech'},
  {id:'zdnet',name:'ZDNet',url:'https://www.zdnet.com/news/rss.xml',cat:'tech'},
  {id:'tldr-tech',name:'TLDR Tech',url:'https://tldr.tech/rss',cat:'tech'},
  {id:'wired',name:'Wired',url:'https://www.wired.com/feed/rss',cat:'tech'},
  {id:'ieee',name:'IEEE Spectrum',url:'https://spectrum.ieee.org/feeds/feed.rss',cat:'tech'},
  {id:'9to5mac',name:'9to5Mac',url:'https://9to5mac.com/feed/',cat:'tech'},
  {id:'fast-company',name:'Fast Company',url:'https://www.fastcompany.com/latest/rss',cat:'tech'},
  {id:'the-information',name:'The Information',url:'https://www.theinformation.com/feed',cat:'tech'},
  {id:'wsj-tech',name:'WSJ Tech',url:'https://feeds.a.dj.com/rss/RSSWSJD.xml',cat:'tech'},
  {id:'cnbc',name:'CNBC Markets',url:'https://www.cnbc.com/id/100003114/device/rss/rss.html',cat:'finance'},
  {id:'mwatch',name:'MarketWatch',url:'https://feeds.marketwatch.com/marketwatch/topstories/',cat:'finance'},
  {id:'coindesk',name:'CoinDesk',url:'https://www.coindesk.com/arc/outboundfeeds/rss/',cat:'finance'},
  {id:'yahoo-finance',name:'Yahoo Finance',url:'https://finance.yahoo.com/news/rssindex',cat:'finance'},
  {id:'fool',name:'Motley Fool',url:'https://www.fool.com/feeds/index.aspx',cat:'finance'},
  {id:'bloomberg-tech',name:'Bloomberg Tech',url:'https://feeds.bloomberg.com/technology/news.rss',cat:'finance'},
  {id:'bloomberg-mkts',name:'Bloomberg Markets',url:'https://feeds.bloomberg.com/markets/news.rss',cat:'finance'},
  {id:'wsj-markets',name:'WSJ Markets',url:'https://feeds.a.dj.com/rss/RSSMarketsMain.xml',cat:'finance'},
  {id:'ft',name:'Financial Times',url:'https://www.ft.com/rss/home/uk',cat:'finance'},
  {id:'seeking-alpha',name:'Seeking Alpha',url:'https://seekingalpha.com/feed.xml',cat:'finance'},
  {id:'economist',name:'The Economist',url:'https://www.economist.com/finance-and-economics/rss.xml',cat:'finance'},
  {id:'bbc',name:'BBC News',url:'https://feeds.bbci.co.uk/news/rss.xml',cat:'general'},
  {id:'guardian',name:'The Guardian Tech',url:'https://www.theguardian.com/technology/rss',cat:'general'},
  {id:'mit-rev',name:'MIT Tech Review',url:'https://www.technologyreview.com/feed/',cat:'general'},
  {id:'nyt-tech',name:'NYT Technology',url:'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml',cat:'general'},
  {id:'new-scientist',name:'New Scientist',url:'https://www.newscientist.com/feed/home/',cat:'general'},
  {id:'npr',name:'NPR News',url:'https://feeds.npr.org/1001/rss.xml',cat:'breaking'},
  {id:'al-jazeera',name:'Al Jazeera',url:'https://www.aljazeera.com/xml/rss/all.xml',cat:'breaking'},
  {id:'guardian-world',name:'Guardian World',url:'https://www.theguardian.com/world/rss',cat:'breaking'},
  {id:'reuters',name:'Reuters',url:'https://news.google.com/rss/search?q=site:reuters.com&hl=en-US&gl=US&ceid=US:en',cat:'breaking'},
  {id:'sky-news',name:'Sky News',url:'https://feeds.skynews.com/feeds/rss/world.xml',cat:'breaking'},
  // Sports
  {id:'espn',name:'ESPN Top Stories',url:'https://www.espn.com/espn/rss/news',cat:'sports'},
  {id:'espn-nba',name:'ESPN NBA',url:'https://www.espn.com/espn/rss/nba/news',cat:'sports'},
  {id:'espn-nfl',name:'ESPN NFL',url:'https://www.espn.com/espn/rss/nfl/news',cat:'sports'},
  {id:'espn-soccer',name:'ESPN Soccer',url:'https://www.espn.com/espn/rss/soccer/news',cat:'sports'},
  {id:'bbc-sport',name:'BBC Sport',url:'https://feeds.bbci.co.uk/sport/rss.xml',cat:'sports'},
  {id:'bbc-football',name:'BBC Sport Football',url:'https://feeds.bbci.co.uk/sport/football/rss.xml',cat:'sports'},
  {id:'sky-sports',name:'Sky Sports',url:'https://www.skysports.com/rss/12040',cat:'sports'},
  {id:'fotmob',name:'FotMob',url:'https://news.google.com/rss/search?q=fotmob+football+news',cat:'sports'},
  {id:'athletic',name:'The Athletic',url:'https://news.google.com/rss/search?q=site:theathletic.com',cat:'sports'},
  {id:'bleacher-report',name:'Bleacher Report',url:'https://news.google.com/rss/search?q=site:bleacherreport.com',cat:'sports'},
  {id:'sports-illustrated',name:'Sports Illustrated',url:'https://news.google.com/rss/search?q=site:si.com',cat:'sports'},
  {id:'nba-official',name:'NBA.com News',url:'https://news.google.com/rss/search?q=site:nba.com',cat:'sports'},
  {id:'nfl-official',name:'NFL.com News',url:'https://news.google.com/rss/search?q=site:nfl.com',cat:'sports'},
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
