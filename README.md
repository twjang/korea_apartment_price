# 한국 아파트 가격 분석 도구
아파트 가격 데이터를 손쉽게 받을 수 있도록 돕는 코드입니다.

## 주요 기능
* 국토교통부 API를 이용해서 지역별 아파트 실거래 가격을 받아옴
* 실거래가격 검색
* KB부동산으로부터 단지 정보 받기
* KB부동산으로부터 매물 목록 받기
* 현재 매물 목록 db에 기록

## 설치
### dependency
mongodb가 액세스 가능해야 합니다. 

### 레포지토리 클론
일단 이 레포지토리를 clone 받으세요. 

## 환경설정 및 API Key 받기
### API Key 받기
(2021년 10월 7일 기준)

* https://www.data.go.kr/ 로 이동합니다.  
* "국토교통부 아파트매매 실거래 상세 자료" API 를 검색해서 선택합니다.
* "오픈API 상세" 페이지에서 "활용신청" 버튼을 클릭합니다.
* 일단 개발계정 활용 신청을 합니다. 연구 목적으로 적당히 기입하세요.
* 운용계정 활용 신청을 해서 운용계정으로 업그레이드 합니다. 마찬가지로 적당히 내용을 채워주면 자동 승인됩니다.

### data/config.json 편집
* data/config.example.json을 data/config.json 에 복사해줍니다.
* 이전 과정에서 받은 API Key를 config.json의 API_KEY 필드에 적어줍니다.
* mongodb connection uri를 "MONGO_URI" 필드에 적어줍니다. 

### scripts/{orderbook, trades}_region_code.csv 편집
* scripts/region_code.tmpl.csv 에는 전국의 구 목록과 법정코드가 나와있습니다.
* scripts/ 내의 스크립트들은 scripts/*_region_code.csv 에 들어있는 법정동 대상으로 크롤링합니다.
* scripts/download_trades.py는 scripts/trades_region_code.csv의 법정동 목록에 대해서만 크롤링합니다. 현재 서울, 경기도, 세종시, 인천시만 들어있는데, 그 외의 지역을 추가할 때에는 해당 지역을 region_code.tmpl.csv 에서 복사해서 추가하면 됩니다.
* scripts/fetch_kb_orderbook.py는 scripts/orderbook_region_code.csv의 법정동 목록에 대해서만 크롤링합니다. 현재 서울만 들어있습니다.
* *_region_code.csv의 헤더는 반드시 "region,code5" 가 되도록 해주세요.

## 분석할 데이터를 db에 받아오기
### 국토 교통부 실거래 정보 다운로드
* ./scripts/download_trades.py를 실행시켜서 다운로드 받으세요. 중간에 연결이 끊어져서 스크립트가 멈추기도 하는데, 이럴 때 스크립트를 다시 실행시켜주면 지금까지 받은 것들에 이어서 받기 시작합니다.
* ./scripts/region_code.csv 에는 ./scripts/download_trades.py 를 통해 다운받을 지역의 법정동코드의 앞 5자리들의 목록이 있습니다. 기본적으로는 서울시, 경기도, 인천시의 코드들이 들어있습니다.
  * 법정동코드 앞 5자리는 국토교통부 실거래 API의 argument로 들어갑니다. 전체 법정동코드는 https://www.code.go.kr/stdcode/regCodeL.do 에서 확인하세요.  
* ./download_trades.py가 실행되면, API를 통해서 받은 내용들이 json 형태로 serialize되어 ./data/trades 폴더에 저장됩니다. 검색을 용이하게 하기 위해 mongodb에도 저장합니다.
* ./data/trades 에서 파일을 지운 뒤 ./scripts/download_trades.py를 실행하면, 지워진 파일에 해당하는 db 레코드도 삭제된 뒤 다시 받아집니다. 가장 최근 월 정보를 새로 받고 싶을 때에는 이 방법으로 실거래 데이터를 추가 다운로드 받을 수 있습니다.

### 건물 주소 및 좌표 다운로드
* ./scripts/download_geocode.py를 실행시켜서 다운로드 받으세요.

### KB 부동산 아파트 목록 다운로드
* ./scripts/download_kb_aprtlst.py를 실행시켜서 다운로드 받으세요.
* KB 부동산에 올라와있는 아파트 단지들의 목록을 받아서 mongodb 에 넣어줍니다.
* 호가를 불러오기 위해서는 필수적으로 필요한 과정입니다.

### KB 부동산 호가 목록 다운로드
* ./scripts/fetch_kb_orderbook.py를 실행시켜서 다운로드 받으세요.
* KB 부동산에 올라와있는 아파트 매물 호가들의 목록을 받아서 mongodb 에 넣어줍니다.

## 사용 예시
kospi_and_housing.ipynb 를 참조해주세요. 이 노트북은 서울 특정 단지 아파트 가격과 코스피 지수를 비교하고, 현재 KB부동산에 올라와있는 매도호가를 차트에 찍어줍니다 (평당가로)
