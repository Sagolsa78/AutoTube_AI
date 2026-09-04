from pytrends.request import TrendReq
import logging

log = logging.getLogger(__name__)

def fetch_trending_topics(keywords: list[str]) -> list[str]:
    """
    Fetch related trending topics using pytrends for the given keywords.
    """
    try:
        pytrends = TrendReq(hl='en-US', tz=360)
        # Pytrends only allows 5 keywords max per payload
        kw_list = keywords[:5] if keywords else ["technology"]
        pytrends.build_payload(kw_list, cat=0, timeframe='now 7-d', geo='', gprop='')
        
        related_queries = pytrends.related_queries()
        trending_topics = []
        
        for kw in kw_list:
            if kw in related_queries and related_queries[kw]['rising'] is not None:
                # get top 3 rising queries per keyword
                rising = related_queries[kw]['rising'].head(3)
                trending_topics.extend(rising['query'].tolist())
        
        return list(set(trending_topics))
    except Exception as e:
        log.error("Failed to fetch Google Trends: %s", e)
        return []
