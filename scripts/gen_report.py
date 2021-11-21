#!/usr/bin/env python
from typing import List, Optional, Tuple
import datetime
import io
import os
import sys
import argparse
from plotly.missing_ipywidgets import FigureWidget
from tqdm import tqdm

ROOT=os.path.realpath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(ROOT)

import plotly
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import korea_apartment_price
from korea_apartment_price.db import ApartmentId


def date_serial2date(x:int):
  year = x // 10000
  month = (x // 100) % 100
  date = (x) % 100
  return datetime.datetime(year, month, date)


def render_graph(apt: ApartmentId, date_from=20210101)->Tuple[str, FigureWidget]:
  sizes = set(korea_apartment_price.db.query_trades(apt_ids=[apt], filters=[korea_apartment_price.db.pick_size], date_from=date_from, include_canceled=True))
  if len(sizes) == 0: 
    sizes = set([apt['size']])
  favorite_size = apt['size']
  chosen_size = list(sorted([(abs(s-favorite_size), s) for s in sizes]))[0][1]

  fig = go.Figure()

  title=f'{apt["address"]} {apt["name"]} (전용 {chosen_size}평)'
  fig.update_layout(height = 500, margin=dict(l=10, r=10, b=10, t=10))
  fig.update_yaxes(
    showline=True,
    linecolor='black',
    linewidth=1,
    mirror=True
  )
  fig.update_xaxes(
    tickformat='%Y-%m-%d',
    hoverformat='%Y-%m-%d',
    showline=True,
    linecolor='black',
    linewidth=1,
    mirror=True
  )


  trades = korea_apartment_price.db.query_trades(apt_ids=[apt], size_from=chosen_size-0.9, size_to=chosen_size+0.9, date_from=date_from, include_canceled=True)
  trades_x = [date_serial2date(t['date_serial']) for t in trades if not t['is_canceled']]
  trades_y = [t['price'] / 10000 for t in trades if not t['is_canceled']]
  labels = [f'{t["floor"]}층' for t in trades if not t['is_canceled']]

  canceled_trades_x = [date_serial2date(t['date_serial']) for t in trades if t['is_canceled']]
  canceled_trades_y = [t['price'] / 10000 for t in trades if t['is_canceled']]
  canceled_labels = [f'{t["floor"]}층(취소)' for t in trades if t['is_canceled']]
  el = go.Scatter(x=trades_x, y=trades_y, showlegend = False, marker={'color': 'blue', 'size': 10}, mode='markers', hovertext=labels, name='실거래')
  el_canceled = go.Scatter(x=canceled_trades_x, y=canceled_trades_y, showlegend = False, marker={'color': 'orange', 'size': 10, 'symbol': 'x'}, mode='markers', hovertext=canceled_labels, name='취소')
  fig.add_trace(el)
  fig.add_trace(el_canceled)


  kb_orderbook = sorted(korea_apartment_price.db.query_kb_orderbook(apt, size_from=chosen_size-1, size_to=chosen_size+1, fetched_from=date_from), key=lambda x: x['fetched_at'])
  fetched_date_cnt = {}
  fetched_price_date_cnt = {}
  fetched_price_date_lbls = {}
  for od in kb_orderbook:
    date_end = od['fetched_at']
    if od['detail']['최소매매가'] is not None:
      price = int(od['detail']['최소매매가']) / 10000
    else:
      price = od['price'] / 10000
    fetched_date_cnt[date_end] = fetched_date_cnt.get(date_end, 0) + 1
    fetched_price_date_cnt[(date_end, price)] = fetched_price_date_cnt.get((date_end, price), 0) + 1
    if not (date_end, price) in fetched_price_date_lbls:
      fetched_price_date_lbls[(date_end, price)] = []

    curlbl = ''
    if od['apt_dong'] is not None and len(od['apt_dong']) > 0:
      curlbl += f'{od["apt_dong"]}동'
    if od['apt_ho'] is not None and len(od['apt_ho']) > 0:
      curlbl += f'{od["apt_ho"]}호'
    elif od['floor'] is not None and len(od['floor']) > 0:
      curlbl += f'{od["floor"]}'
    if curlbl == '': curlbl='정보없음'
    fetched_price_date_lbls[(date_end, price)].append(curlbl)

  fetched_dates = sorted(fetched_date_cnt.keys())

  max_cnt = max([1] + list(fetched_price_date_cnt.values()))

  for date_end, cnt in fetched_date_cnt.items():
    fig.add_vline(x=date_end, line_width=0.3, line_dash='dash', line_color='green')

  for (date_end, price), cnt in sorted(fetched_price_date_cnt.items()):
    date_start = None
    for trial_date_start in fetched_dates:
      if trial_date_start < date_end: date_start = trial_date_start
    if date_start is None:
      date_start = date_end - datetime.timedelta(2)

    opacity = min(1.0, 0.1 + 0.9 * cnt / max_cnt)
    fig.add_shape(x0=date_start, x1=date_end, y0=price, y1=price, line={'width':3, 'color':'red'}, opacity=opacity)
    details = fetched_price_date_lbls[(date_end, price)]
    details = '<br>' + '<br>'.join(sorted(details))
    marker = go.Scatter(x=[date_end], y=[price], text=[f'{cnt}개 {details}'], marker={'color':'red', 'size':4}, opacity=opacity, showlegend = False, name='')
    fig.add_trace(marker)

  return title, fig


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
with open(args.output, 'w') as f:
  datestr = datetime.datetime.now().strftime('%Y-%m-%d')
  f.write(f"""<!DOCTYPE html>
<html lang="kr">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="x-ua-compatible" content="ie=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />

    <title>{datestr} 아파트 보고서</title>
    <script type="text/javascript" src="https://cdn.plot.ly/plotly-latest.min.js"></script>
    <script type="text/javascript" id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
  <style>
  div {{ margin:0; padding: 0; }}
  body {{margin:0; padding:0; font-family: Candara, Calibri, Segoe, Segoe UI, Optima, Arial, sans-serif; }}
  .wrap {{ width:calc(100% - 2em); padding: 0.3em; margin:auto; overflow-x: hidden; }}
  </style>
  </head>

  <body>
    <h1 style="text-align: center;">{datestr} 아파트 보고서</h1>
""")

  for apt in tqdm(apts):
    title, fig = render_graph(apt)
    f.write('<div class="wrap">')
    f.write(f'<h2>{title}</h2>')
    f.write(fig.to_html(full_html=False, include_plotlyjs=False, include_mathjax=False))
    f.write('</div>')
  f.write("""
  </div>
  </body>
</html>
""")

print('[+] done')


