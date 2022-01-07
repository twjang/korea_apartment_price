#!/usr/bin/env python
from typing import List, Optional, Tuple
import datetime
import re
import io
import base64
import os
import sys
import argparse
from plotly.missing_ipywidgets import FigureWidget
from tqdm import tqdm
import minify_html


ROOT=os.path.realpath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(ROOT)

import plotly
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import korea_apartment_price
from korea_apartment_price.db import ApartmentId, EntryNotFound


def date_serial2date(x:int):
  year = x // 10000
  month = (x // 100) % 100
  date = (x) % 100
  return datetime.datetime(year, month, date)


def render_graph(apts: List[ApartmentId], date_from=20210101)->Tuple[str, FigureWidget]:
  sizes = set(korea_apartment_price.db.query_trades(apt_ids=apts, filters=[korea_apartment_price.db.pick_size], date_from=date_from, include_canceled=True))
  if len(sizes) == 0: 
    sizes = set([apt['size'] for apt in apts])
  favorite_size = apts[0]['size']
  chosen_size = list(sorted([(abs(s-favorite_size), s) for s in sizes]))[0][1]

  fig = go.Figure()

  aptname = re.sub(r'[0-9]+[ ]*단지[ ]*$', '', apts[0]["name"])

  title=f'{apts[0]["address"]} {aptname} (전용 {chosen_size}평)'
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


  trades = korea_apartment_price.db.query_trades(apt_ids=apts, size_from=chosen_size-0.9, size_to=chosen_size+0.9, date_from=date_from, include_canceled=True)
  trades_x = [date_serial2date(t['date_serial']) for t in trades if not t['is_canceled']]
  trades_y = [t['price'] / 10000 for t in trades if not t['is_canceled']]
  labels = [f'{t["floor"]}층' for t in trades if not t['is_canceled']]

  canceled_trades_x = [date_serial2date(t['date_serial']) for t in trades if t['is_canceled']]
  canceled_trades_y = [t['price'] / 10000 for t in trades if t['is_canceled']]
  canceled_labels = [f'{t["floor"]}층(취소)' for t in trades if t['is_canceled']]
  el = go.Scattergl(x=trades_x, y=trades_y, showlegend = False, marker={'color': 'blue', 'size': 10}, mode='markers', hovertext=labels, name='실거래')
  el_canceled = go.Scattergl(x=canceled_trades_x, y=canceled_trades_y, showlegend = False, marker={'color': 'orange', 'size': 10, 'symbol': 'x'}, mode='markers', hovertext=canceled_labels, name='취소')
  fig.add_trace(el)
  fig.add_trace(el_canceled)

  for apt in apts:
    try:
      kb_orderbook = sorted(korea_apartment_price.db.query_kb_orderbook(apt, size_from=chosen_size-1, size_to=chosen_size+1, fetched_from=date_from), key=lambda x: x['fetched_at'])
      break
    except EntryNotFound: 
      pass

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
      fetched_price_date_lbls[(date_end, price)] = set()

    curlbl = ''
    if od['apt_dong'] is not None and len(od['apt_dong']) > 0:
      curlbl += f'{od["apt_dong"]}동'
    if od['apt_ho'] is not None and len(od['apt_ho']) > 0:
      curlbl += f'{od["apt_ho"]}호'
    elif od['floor'] is not None and len(od['floor']) > 0:
      curlbl += f'{od["floor"]}'
    if curlbl == '': curlbl='정보없음'
    fetched_price_date_lbls[(date_end, price)].add(curlbl)

  fetched_dates = sorted(fetched_date_cnt.keys())

  max_cnt = max([1] + list(fetched_price_date_cnt.values()))

  for (date_end, price), cnt in sorted(fetched_price_date_cnt.items()):
    date_start = None
    for trial_date_start in fetched_dates:
      if trial_date_start < date_end: date_start = trial_date_start
    if date_start is None:
      date_start = date_end - datetime.timedelta(2)

    opacity = min(1.0, 0.1 + 0.9 * cnt / max_cnt)
    fig.add_trace(go.Scattergl(x=[date_start, date_end], y=[price, price], line={'width':2, 'color':'red'}, marker=None, opacity=opacity, showlegend = False, name='', hoverinfo='skip', mode='lines'))
    details = sorted(list(fetched_price_date_lbls[(date_end, price)]))
    details = '<br>' + '<br>'.join(sorted(details))
    marker = go.Scattergl(x=[date_end], y=[price], text=[f'{cnt}개 {details}'], line=None, marker={'color':'red', 'size': 3}, opacity=opacity, showlegend = False, name='', mode='markers')
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

uniq_apts = {}
for apt in apts:
  aptname = re.sub(r'[0-9]+[ ]*단지[ ]*$', '', apt["name"])
  key = apt['address'], aptname, apt['size']
  if not key in uniq_apts: uniq_apts[key] = []
  uniq_apts[key].append(apt)
apt_keys = sorted(uniq_apts.keys())

print('[+] generating report')
with open(args.output, 'w') as f:
  datestr = datetime.datetime.now().strftime('%Y-%m-%d')
  f.write("""<!DOCTYPE html>
<html lang="kr">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="x-ua-compatible" content="ie=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
""")
  f.write(f"<title>{datestr} 아파트 보고서</title>")
  f.write("""
    <script type="text/javascript" src="https://cdn.plot.ly/plotly-latest.min.js"></script>
    <script type="text/javascript" id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
    <link rel="stylesheet" href="//code.jquery.com/ui/1.13.0/themes/base/jquery-ui.css">
    <script src="https://code.jquery.com/jquery-3.6.0.js"></script>
    <script src="https://code.jquery.com/ui/1.13.0/jquery-ui.js"></script>
  <style>
  div { margin:0; padding: 0; }
  body { margin:0; padding:0; font-family: Candara, Calibri, Segoe, Segoe UI, Optima, Arial, sans-serif; }
  #accordion { width:calc(100% - 2em); padding: 0.3em; margin:auto; overflow-x: hidden; }
  .grpwrap { width:calc(100% - 2em); padding: 0em; margin:0; overflow-x: hidden; }
  </style>
  </head>
""")
  for apt_addr, apt_name, apt_size in apt_keys:
    print(f'{apt_addr} {apt_name} [전용 {apt_size}평]')

  titles = []
  grps = []

  for aptidx, apt_key in enumerate(tqdm(apt_keys)):
    apts = uniq_apts[apt_key]
    title, fig = render_graph(apts)
    titles.append(title)
    grp_html = fig.to_html(full_html=False, include_plotlyjs=False, include_mathjax=False)
    grp_html = minify_html.minify(grp_html)
    grp_base64 = base64.b64encode(grp_html.encode('utf-8')).decode('utf-8')
    grps.append(grp_base64)

  f.write("""<script>
  let grpdata=[];
  let prevActive=false;
  $(function() { 
    let menu = $("#accordion");
    menu.accordion({
      active: false,
      collapsible: true, 
      heightStyle: 'content',
      activate: function (e, ui) {
        let active = menu.accordion("option", "active");
        if (prevActive !== false) {
          $("#grp"+prevActive).html('');
        }

        if (active === false) { 
          $(".grpwrap").html('');
        } else {
          let curgrp = atob(grpdata[active]);
          $("#grp"+active).html(curgrp);
        }
        prevActive = active;
      }
    }); 
  }); 
  """)
  for aptidx, grpdata in enumerate(tqdm(grps)):
    f.write(f'grpdata.push("{grpdata}");\n')
  f.write('</script>')

  f.write(f"""
  <body>
    <h1 style="text-align: center;">{datestr} 아파트 보고서</h1>
    <div id="accordion">
    """)
  for aptidx, title in enumerate(tqdm(titles)):
    f.write(f'<h2>{title}</h2>')
    f.write(f'<div class="grpwrap" id="grp{aptidx}">')
    f.write('</div>')

  f.write("""
  </div>
  </body>
</html>
""")

print('[+] done')


