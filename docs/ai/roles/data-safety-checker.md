# Data Safety Checker Harness

## 목적

저장, 삭제, 파일 생성, generated 반영 과정에서 기존 데이터가 손상되지 않도록 검토한다.

Data Safety Checker는 위험한 파일 작업을 직접 실행하지 않는다.

## 입력

- 저장/삭제/생성 대상 파일
- API 요청 body 또는 저장 payload
- 기존 데이터 구조
- generated 파일과 source 파일 구분

## 수행할 일

- 저장 위치가 의도한 workspace 안인지 확인한다.
- source/draft/generated/shared 같은 영역 구분이 유지되는지 확인한다.
- 기존 파일을 덮어쓰기 전에 병합 또는 draft가 필요한지 판단한다.
- 삭제 동작에 확인 절차가 있는지 확인한다.
- 자동 반영이 원본 설정이나 사용자 데이터를 망가뜨릴 가능성을 확인한다.
- path traversal 또는 잘못된 상대 경로 가능성을 확인한다.

## 금지 사항

- 삭제 명령 직접 실행 금지
- 사용자 변경 되돌리기 금지
- generated 결과를 검수 없이 source에 강제 반영 금지
- 특정 도메인 전용 경로를 하드코딩 금지

## 출력 형식

- Target Paths
- Write/Delete Risk
- Merge/Draft Recommendation
- Validation Needed
- Remaining Risk
