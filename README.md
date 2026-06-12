# APAC BD — Channel ToF Alignment & Dashboard

BD 팀원들이 채널별 월간 ToF 계획(MQL/SQL, TICP, Touch Level, 매출형 ARPU)을 입력하면
첨부 양식과 동일한 구조의 시트에 자동 취합되고, 매니저별 **Target vs Actual** 을 실시간 추적하는
대시보드까지 연결되는 도구 세트입니다. 화면(설문·대시보드)은 전부 영어입니다.

## 구성 파일
- `index.html` — 설문 화면 (GitHub Pages에 업로드)
- `dashboard.html` — 매니저별 Target vs Actual 대시보드 + 50K ICP 추적
- `apps-script/Code.gs` — 응답을 구글 시트(= 엑셀)로 자동 적재 + 대시보드 데이터 제공 백엔드
- `Acquisition_ToF_Planning_master.xlsx` — 첨부 양식 + 10명 전원 + 신규 컬럼 반영 참고용

---

## 이번 버전에서 바뀐 점 (요청사항 반영)
1. **가독성/간격** — 입력칸·카드·섹션 간격을 넓히고 글자를 키웠으며, 모바일(좁은 화면)에서 1열로
   접히고 버튼·체크박스 터치 영역을 키웠습니다.
2. **ICP-fit account → `TICP #`** 로 변경. 50K ICP 목표에 합산되는 항목으로 연결했습니다.
3. **Score A = MQL? SQL?** — 마켓마다 다를 수 있어, Score A 채널에 **MQL/SQL 선택 토글**을 넣었습니다.
   선택값은 시트 D열(MQL? SQL?)에 그대로 들어갑니다.
4. **Capacity 정합성** — Section 02의 "Leads you can handle / month"(월 총량)가 Section 03
   채널별 **MQL 합계**와 같아야 한다는 점을, 실시간 일치/불일치 배지로 표시합니다("Set capacity to
   channel total →" 버튼으로 자동 일치도 가능). 모든 수치는 **월간** 기준으로 통일했습니다.
5. **ARPU = Revenue 기준** — 딜당 매출(기본값 **$400**, 수정 가능)로 바꿨습니다.
   채널별 **Plan Revenue = SQL × ARPU**, 하단에 월간 합계(MQL/SQL/TICP/Revenue)를 자동 표시합니다.
6. **대시보드** — 매니저별로 리드(MQL)가 제대로 공급되는지, SQL이 나오는지, TICP(ICP)가 실제로
   나오는지 Plan 대비 Actual을 막대로 보여주고, 상단에 팀 합계와 **50K ICP 추적기**가 있습니다.

---

## 동작 방식
```
BD가 설문 입력 ─▶ Apps Script ─▶ Google Sheet (Plan 컬럼 자동 기록)
                                      │
        Chris가 Actual(L,M,N) 수동 업데이트 ─┤
                                      ▼
                          dashboard.html (Plan vs Actual 실시간)
   언제든  파일 → 다운로드 → Microsoft Excel  로 첨부 양식과 동일한 .xlsx 확보
```
> GitHub Pages는 정적 호스팅이라 PC 파일을 직접 못 씁니다. 그래서 무료 백엔드(Apps Script→구글 시트)를
> 한 번 연결하면 10명 응답이 한 시트에 자동 누적되고, 대시보드가 그 시트를 읽어 실시간으로 보여줍니다.

### 시트 컬럼 구조
A 이름 · B Lead Channel · C Sub-channel · D MQL?SQL? · **E Plan MQL · F Plan SQL** · G Touch ·
H Conversion(=F/E) · I ARPU($) · J TICP# · K Plan Revenue(=F*I) · **L Actual MQL · M Actual SQL · N Actual TICP**
> **L·M·N(주황 헤더)** 가 Chris님이 주기적으로 채우는 실제값입니다. 나머지는 설문에서 자동으로 들어갑니다.

---

## A. 백엔드 연결 — 약 5분, 1회
1. 새 **Google Sheet** 생성 → **확장 프로그램 → Apps Script**.
2. 기본 코드를 지우고 `apps-script/Code.gs` 전체를 붙여넣고 **저장**.
3. 함수에서 **setup** 선택 → **실행** → 권한 허용. ("ToF Planning" 시트에 10명 블록 생성)
4. **배포 → 새 배포 → 웹 앱**: 실행=나(Me), 액세스=**모든 사용자(Anyone)** → **배포** → **웹 앱 URL 복사**.
5. 복사한 URL을 **`index.html`과 `dashboard.html` 두 파일 모두**의 `ENDPOINT_URL`에 붙여넣기:
   ```js
   const ENDPOINT_URL = "https://script.google.com/macros/s/............/exec";
   ```

## B. GitHub Pages 업로드 — 약 3분
1. 새 저장소 생성(예: `tof-survey`, **Public**) → `index.html`, `dashboard.html` 업로드(Commit).
2. **Settings → Pages** → Source: *Deploy from a branch* → Branch **main / (root)** → Save.
3. 1~2분 뒤 주소 활성화:
   - 설문: `https://<아이디>.github.io/tof-survey/`
   - 대시보드: `https://<아이디>.github.io/tof-survey/dashboard.html`

> 팁: A를 먼저 끝내고 URL을 넣은 두 파일을 올리면 설문 자동취합 + 대시보드가 바로 동작합니다.
> 백엔드 없이 미리 보기: `ENDPOINT_URL`을 ""로 두면 설문은 응답을 .xlsx로 내려받는 폴백,
> 대시보드는 샘플 데이터로 화면을 보여줍니다.

---

## 운영 — Actual 추적 루틴
- 리드 수가 업데이트될 때마다 구글 시트의 **L(Actual MQL) · M(Actual SQL) · N(Actual TICP)** 에 입력만 하면,
  대시보드가 자동으로(기본 60초 간격, 또는 Refresh 버튼) Plan 대비 달성률을 다시 그립니다.
- 대시보드 색상: **녹색 ≥90% · 주황 60~89% · 빨강 <60%** (계획 없음=회색).
- 상단 **50K ICP 추적기** = 모든 매니저의 Actual TICP 합계 ÷ 50,000. 목표치는 `Code.gs`와 `dashboard.html`의
  `ORG_ICP_TARGET`에서 조정합니다.
- 매니저 카드를 클릭하면 채널별 Actual/Plan 상세가 펼쳐집니다.

## 메모
- **대상 10명**: Jay Gye, Casa Hoang, Kunsuk Kim, Wayne Nguyen, Patrick Simeon, Natalie Fong,
  Trang Nguyen, Mizuki Toku, Jaejun Lee, Son Le. (원본엔 앞 8명만 있어 뒤 2명 추가)
- **마케팅 에이전시**: Jaejun·Son은 기본 Growth Automation. 다르면 `index.html`·`Code.gs`의 `ROSTER`에서
  해당 BD `agency`만 수정.
- **명단/순서 변경 시** `index.html`과 `Code.gs`의 `ROSTER`를 동일하게 유지.

ARPU 단위(딜당 vs 월), TICP 정의, 50K 목표 분배 등 더 손볼 부분 있으면 말씀 주세요.
