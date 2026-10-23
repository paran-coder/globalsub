# GlobalSub-v1.3.0 Context Notes

## 기준
- v1.2.3 Vercel-ready 배포본에서 시작합니다.
- 사용자 요청: Gemini 연결 모듈만 추가. 기존 자막 로직/영상/OG/UI 리디자인은 변경하지 않습니다.
- 기존 원본 소스에는 OpenAI 연결만 존재하며 Claude 연결은 확인되지 않습니다. Claude 구현을 만들어냈다고 가정하지 않습니다.

## 아키텍처
- 앱 서버 없이 브라우저에서 Gemini REST generateContent API 직접 요청.
- OpenAI 요청 구현 유지, Gemini 연결 모듈 `src/gemini.js` 추가.
- 사용자가 설정에서 제공자를 OpenAI / Gemini 중 선택, 선택된 제공자의 키와 모델로 기존 번역 파이프라인 호출.
- Gemini 기본 모델: 경제형 `gemini-3.5-flash-lite`, 정밀형 `gemini-3.8-flash` (Google 공식 모델 문서 확인).
- API 키 영구 저장 기본 비활성, 사용자가 선택하는 암호화 저장은 제공자별로 분리. 키와 영상은 프로젝트 백업에 미포함.
- CORS/직접 호출 문제와 공개 브라우저 키 유출 위험은 별도로 안내.

## 점검 기준
- 기존 OpenAI 경로 불변, SRT 타임코드 불변, 성공한 배치만 반영.
- Gemini JSON 스키마 응답에서 ID 정확히 1회씩 반환할 때만 번역 적용.
- 키별 보관/해제/삭제 독립성 및 Vercel CSP 업데이트.
