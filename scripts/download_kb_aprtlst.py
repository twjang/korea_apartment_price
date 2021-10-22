#!/usr/bin/env python3
import os
import sys

ROOT=os.path.realpath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(ROOT)

from korea_apartment_price.kb_liiv import KBCity, KBLiivCrawler


crawler = KBLiivCrawler()
cities = crawler.list_city(KBCity.SEOUL)
gus = crawler.list_gu(KBCity.SEOUL, cities[0]['시군구명'])
apts = crawler.list_apts(gus[1]['법정동코드'])

apt = apts[10]
print(apt)
#data = crawler.orderbook(apt['단지기본일련번호'], apt['단지명'])
data = crawler.orderbook(22269, '펜트라우스')
print (data)