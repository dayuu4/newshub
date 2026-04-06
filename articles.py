"""
NewsHub Cloud — Netlify Function  /.netlify/functions/articles
(accessible as /api/articles via the redirect in netlify.toml)

Fetches all RSS/Atom feeds server-side and returns a sorted JSON array.
Response is CDN-cached for 30 minutes with stale-while-revalidate so
users always get an instant response after the first visit.

All Python 3 stdlib only — no pip install required.
"""

import json, ssl, re, urllib.request, urllib.error
import xml.etree.ElementTree as ET
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed, TimeoutError

# ── Feed list ────────────────────────────────────────────────
# Broken feeds replaced:
#   TLDR AI (404)        → The Batch by DeepLearning.AI
#   Scientific Am (SSL)  → New Scientist
#   Investopedia (404)   → Yahoo Finance

DEFAULT_FEEDS = [
    # ── AI & ML
    {'id':'one-useful-thing','name':'One Useful Thing',   'url':'https://www.oneusefulthing.org/feed',                              'cat':'ai'},
    {'id':'simon-willison',  'name':'Simon Willison',     'url':'https://simonwillison.net/atom/everything/',                       'cat':'ai'},
    {'id':'hf',              'name':'Hugging Face',       'url':'https://huggingface.co/blog/feed.xml',                             'cat':'ai'},
    {'id':'the-batch',       'name':'The Batch (DL.AI)',  'url':'https://www.deeplearning.ai/the-batch/feed/',                      'cat':'ai'},
    {'id':'ai-news',         'name':'AI News',            'url':'https://www.artificialintelligence-news.com/feed/',                 'cat':'ai'},
    {'id':'mit-ai',          'name':'MIT AI News',        'url':'https://news.mit.edu/rss/topic/artificial-intelligence2',          'cat':'ai'},
    {'id':'openai',          'name':'OpenAI Blog',        'url':'https://openai.com/news/rss.xml',                                  'cat':'ai'},
    {'id':'deepmind',        'name':'Google DeepMind',    'url':'https://deepmind.google/blog/rss.xml',                             'cat':'ai'},
    {'id':'import-ai',       'name':'Import AI',          'url':'https://jack-clark.net/feed/',                                     'cat':'ai'},
    # ── Tech
    {'id':'hn',              'name':'Hacker News',        'url':'https://hnrss.org/frontpage',                                      'cat':'tech'},
    {'id':'tc',              'name':'TechCrunch',         'url':'https://techcrunch.com/feed/',                                     'cat':'tech'},
    {'id':'verge',           'name':'The Verge',          'url':'https://www.theverge.com/rss/index.xml',                           'cat':'tech'},
    {'id':'ars',             'name':'Ars Technica',       'url':'https://feeds.arstechnica.com/arstechnica/index',                  'cat':'tech'},
    {'id':'engadget',        'name':'Engadget',           'url':'https://www.engadget.com/rss.xml',                                 'cat':'tech'},
    {'id':'zdnet',           'name':'ZDNet',              'url':'https://www.zdnet.com/news/rss.xml',                               'cat':'tech'},
    {'id':'tldr-tech',       'name':'TLDR Tech',          'url':'https://tldr.tech/rss',                                            'cat':'tech'},
    # ── Finance
    {'id':'cnbc',            'name':'CNBC Markets',       'url':'https://www.cnbc.com/id/100003114/device/rss/rss.html',            'cat':'finance'},
    {'id':'mwatch',          'name':'MarketWatch',        'url':'https://feeds.marketwatch.com/marketwatch/topstories/',            'cat':'finance'},
    {'id':'coindesk',        'name':'CoinDesk',           'url':'https://www.coindesk.com/arc/outboundfeeds/rss/',                  'cat':'finance'},
    {'id':'yahoo-finance',   'name':'Yahoo Finance',      'url':'https://finance.yahoo.com/news/rssindex',                         'cat':'finance'},
    {'id':'fool',            'name':'Motley Fool',        'url':'https://www.fool.com/feeds/index.aspx',                            'cat':'finance'},
    # ── General
    {'id':'bbc',             'name':'BBC News',           'url':'https://feeds.bbci.co.uk/news/rss.xml',                            'cat':'general'},
    {'id':'guardian',        'name':'The Guardian Tech',  'url':'https://www.theguardian.com/technology/rss',                       'cat':'general'},
    {'id':'mit-rev',         'name':'MIT Tech Review',    'url':'https://www.technologyreview.com/feed/',                           'cat':'general'},
    {'id':'nyt-tech',        'name':'NYT Technology',     'url':'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml',      'cat':'general'},
    {'id':'new-scientist',   'name':'New Scientist',      'url':'https://www.newscientist.com/feed/home/',                          'cat':'general'},
]

HEADERS = {
    'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 NewsHub/3.0',
    'Accept':          'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control':   'no-cache',
}

FEED_TIMEOUT = 7   # seconds per feed — leaves headroom within Netlify's 10s limit

# ── Helpers ──────────────────────────────────────────────────
def strip_tags(html):
    if not html: return ''
    s = re.sub(r'<[^>]+>', ' ', str(html))
    for code, char in [('&amp;','&'),('&lt;','<'),('&gt;','>'),
                       ('&quot;','"'),('&apos;',"'"),('&#039;',"'"),('&nbsp;',' ')]:
        s = s.replace(code, char)
    return re.sub(r'\s+', ' ', s).strip()


def parse_date(s):
    if not s: return None
    s = s.strip()
    try:
        from email.utils import parsedate_to_datetime
        return parsedate_to_datetime(s).isoformat()
    except Exception: pass
    try:
        return datetime.fromisoformat(re.sub(r'Z$', '+00:00', s)).isoformat()
    except Exception: pass
    return None


def get_text(element, tag):
    """Get text from an XML element — explicit is-None check avoids DeprecationWarning."""
    el = element.find(tag)
    if el is None:
        el = element.find(f'{{http://www.w3.org/2005/Atom}}{tag}')
    return el.text if el is not None else None


def parse_feed(raw_bytes, feed):
    text = raw_bytes.decode('utf-8', errors='replace')
    text = re.sub(r'\sxmlns(?::[^=]+)?="[^"]*"', '', text)
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
    try:
        root = ET.fromstring(text)
    except ET.ParseError:
        return []

    is_atom = 'feed' in root.tag.lower()
    articles = []

    if is_atom:
        entries = (root.findall('entry') or
                   root.findall('{http://www.w3.org/2005/Atom}entry'))
        for e in entries[:40]:
            title = strip_tags(get_text(e, 'title')) or 'Untitled'
            link = ''
            for lel in (e.findall('link') + e.findall('{http://www.w3.org/2005/Atom}link')):
                rel  = lel.get('rel', 'alternate')
                href = lel.get('href', '') or (lel.text or '').strip()
                if rel == 'alternate' or (not link and href):
                    link = href.strip(); break
            date = parse_date(get_text(e, 'published') or get_text(e, 'updated'))
            desc = strip_tags(get_text(e, 'summary') or get_text(e, 'content'))[:280]
            if link:
                articles.append({'title':title,'link':link,'date':date,'desc':desc,
                                  'source':feed['name'],'cat':feed['cat'],'feedId':feed['id']})
    else:
        for it in root.findall('.//item')[:40]:
            title = strip_tags(get_text(it, 'title')) or 'Untitled'
            link  = (get_text(it, 'link') or get_text(it, 'guid') or '').strip()
            date  = parse_date(get_text(it, 'pubDate') or get_text(it, 'date') or get_text(it, 'updated'))
            desc  = strip_tags(
                get_text(it, 'description') or get_text(it, 'summary') or
                get_text(it, '{http://purl.org/rss/1.0/modules/content/}encoded') or '')[:280]
            if link:
                articles.append({'title':title,'link':link,'date':date,'desc':desc,
                                  'source':feed['name'],'cat':feed['cat'],'feedId':feed['id']})
    return articles


def fetch_one(feed):
    """Fetch a single feed. Returns list of articles (empty on any failure)."""
    try:
        req = urllib.request.Request(feed['url'], headers=HEADERS)
        try:
            with urllib.request.urlopen(req, timeout=FEED_TIMEOUT) as resp:
                raw = resp.read()
        except ssl.SSLError:
            # SSL fallback — retries without certificate verification
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            with urllib.request.urlopen(req, timeout=FEED_TIMEOUT, context=ctx) as resp:
                raw = resp.read()
        return parse_feed(raw, feed)
    except Exception:
        return []


# ── Netlify handler ──────────────────────────────────────────
def handler(event, context):
    # Handle CORS preflight
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
            'body': '',
        }

    articles = []

    # All feeds start simultaneously — collect results up to 9 seconds
    with ThreadPoolExecutor(max_workers=len(DEFAULT_FEEDS)) as ex:
        futures = {ex.submit(fetch_one, f): f for f in DEFAULT_FEEDS}
        try:
            for fut in as_completed(futures, timeout=9):
                articles.extend(fut.result())
        except TimeoutError:
            # Return whatever completed before the cutoff
            for fut in futures:
                if fut.done():
                    try: articles.extend(fut.result())
                    except Exception: pass

    articles.sort(key=lambda a: a.get('date') or '', reverse=True)

    return {
        'statusCode': 200,
        'headers': {
            'Content-Type':                'application/json; charset=utf-8',
            # Fresh 30 min; serve stale while revalidating for up to 24 h
            'Cache-Control':               'public, s-maxage=1800, stale-while-revalidate=86400',
            'Access-Control-Allow-Origin': '*',
        },
        'body': json.dumps(articles, ensure_ascii=False),
    }
