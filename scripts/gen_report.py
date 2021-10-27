#!/usr/bin/env python
from typing import List
import datetime
import os
import sys
import argparse
from tqdm import tqdm

ROOT=os.path.realpath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(ROOT)

import plotly.graph_objects as go
from plotly.subplots import make_subplots
import korea_apartment_price
from korea_apartment_price.db import ApartmentId

def date_serial2date(x:int):
  year = x // 10000
  month = (x // 100) % 100
  date = (x) % 100
  return datetime.datetime(year, month, date)


def draw_graph(apts: List[ApartmentId]):
  fig = make_subplots(rows=len(apts), cols=1, shared_xaxes=True, vertical_spacing=0, subplot_titles=["plot" for _ in range(len(apts))])
  fig.update_layout(
    height=len(apts)* 500, 
    title={
      'text':f"{datetime.datetime.now().strftime('%Y-%m-%d 아파트 보고서')}",
      'xanchor': 'center',
      'yanchor': 'top',
      'x': 0.5,
      'y': 1.0 - 0.1/len(apts),
      'font': {
        'size': 30,
      },
    }
  )

  subplot_titles = []
  for aptidx, apt in tqdm(enumerate(apts), total=len(apts)):
    cur_rowidx = aptidx + 1 
    cur_colidx = 1

    sizes = set(korea_apartment_price.db.query_trades(apt_ids=[apt], filters=[korea_apartment_price.db.pick_size]))
    favorite_size = apt['size']
    chosen_size = list(sorted([(abs(s-favorite_size), s) for s in sizes]))[0][1]
    trades = korea_apartment_price.db.query_trades(apt_ids=[apt], size_from=chosen_size-0.9, size_to=chosen_size+0.9,date_from=20210101)
    subplot_title=f'{apt["address"]} {apt["name"]} (전용 {chosen_size}평)'
    subplot_titles.append(subplot_title)

    kb_orderbook = sorted(korea_apartment_price.db.query_kb_orderbook(apt, size_from=chosen_size-1, size_to=chosen_size+1), key=lambda x: x['fetched_at'])
    fetched_date_cnt = {}
    fetched_price_date_cnt = {}
    for od in kb_orderbook:
      date = od['fetched_at']
      price = od['price'] / 10000
      fetched_date_cnt[date] = fetched_date_cnt.get(date, 0) + 1
      fetched_price_date_cnt[(price, date)] = fetched_price_date_cnt.get((price, date), 0) + 1
    fetched_dates = sorted(fetched_date_cnt.keys())
    trades_x = [date_serial2date(t['date_serial']) for t in trades]
    trades_y = [t['price'] / 10000 for t in trades]

    el = go.Scatter(x=trades_x, y=trades_y, showlegend = False, marker={'color': 'blue', 'size': 10}, mode='markers', name='실거래가')
    fig.add_trace(el, row=cur_rowidx, col=cur_colidx)
    fig.update_yaxes(title='가격(억)', row=cur_rowidx, col=cur_colidx)

    fetched_date_idx = -1

    for od in kb_orderbook:
      date_diff = (od['fetched_at'] - od['confirmed_at']).days
      date_end = od['fetched_at']
      if date_end > fetched_dates[fetched_date_idx+1]:
        fetched_date_idx += 1

      if fetched_date_idx >= 0:
        date_start = fetched_dates[fetched_date_idx]
      else:
        date_start = date_end - datetime.timedelta(2)
      price = od['price'] / 10000
      
      opacity = (1.0 / fetched_date_cnt[date_end]) * 0.5 + 0.2
      el = go.Scatter(x=[date_start, date_end], y=[price, price], marker={'color': 'red', 'size': 0.1}, line={'width':5}, opacity=opacity, showlegend=False, name='')
      fig.add_trace(el, row=cur_rowidx, col=cur_colidx)

    for (price, date), cnt in fetched_price_date_cnt.items():
      fig.add_vline(x=date, line_width=0.1, line_dash='dash', line_color='green', row=cur_rowidx, col=cur_colidx)
      ann = go.Scatter(x=[date], y=[price], text=[f'{price}억:({cnt})'], marker={'color':'red', 'size':0.3}, showlegend = False, name='')
      fig.add_trace(ann, row=cur_rowidx, col=cur_colidx)

  for ax in fig['layout']:
    if ax.startswith('xaxis'):
      fig['layout'][ax]['tickformat']="%Y-%m-%d"
      fig['layout'][ax]['hoverformat']="%Y-%m-%d"
      fig['layout'][ax]['showline']=True
      fig['layout'][ax]['linecolor']='black'
      fig['layout'][ax]['linewidth']=1
      fig['layout'][ax]['mirror']=True
    if ax.startswith('yaxis'):
      fig['layout'][ax]['showline']=True
      fig['layout'][ax]['linecolor']='black'
      fig['layout'][ax]['linewidth']=1
      fig['layout'][ax]['mirror']=True
    if ax == f'xaxis{len(apts)}':
      fig['layout'][ax]['title']="날짜"
  
  for sidx, subplot_title in enumerate(subplot_titles):
    fig.layout.annotations[sidx].update(text=subplot_title, x=0.025, xanchor='left', y=1.0 - sidx / len(subplot_titles), yanchor='top')

  return fig


parser = argparse.ArgumentParser()
parser.add_argument('aptlst', help='a csv file that contains gu and the apartment name')
parser.add_argument('output', help='output html report path')
args = parser.parse_args()


apts = []

print('[+] reading apartment list')
with open(args.aptlst, 'r') as f:
  for line in tqdm(f.readlines()):
    line = line.strip()
    line = line.split(',', 2)
    if len(line) not in [2, 3]:
      print (f'Warning: ignoring line "{line}"')
      continue
    if len(line) == 2:
      addr, name = [s.strip() for s in line]
      size = 18
    else:
      addr, name, size = [s.strip() for s in line]
      size = int(size)
    selected=korea_apartment_price.shortcuts.search(addr, name)
    for apt in selected:
      apt['size'] = size
    apts += selected


uniq_apts = {}
for apt in apts:
  uniq_apts[(apt['address'], apt['name'], apt['size'])] = apt

apts = [uniq_apts[k] for k in sorted(uniq_apts.keys())]

print('[+] generating report')
fig = draw_graph(apts)
fig.write_html(args.output)

print('[+] done')


