# GlobalSub-v1.3.1 개발 체크리스트

- [x] 최신 v1.2.3 소스 및 연결된 GitHub 저장소의 README 확인
- [x] context-notes.md, checklist.md, README.md, User manual.md 기록
- [x] Gemini REST `generateContent` 어댑터 신규 구현
- [x] 제공자 선택/개별 Gemini API 키 입력/경제형·정밀형 모델 선택
- [x] 기존 OpenAI 키 암호화 저장 키 호환 유지, Gemini 별도 암호화 저장
- [x] 기존 SRT·ZIP·번역 검수·수동 번역·영상 기능을 건드리지 않음
- [x] Vercel CSP Gemini API 호스트 허용
- [x] 기존 자동 테스트 + 신규 Gemini/키분리 테스트 **25/25 통과**
- [x] 모의 Gemini HTTP 응답으로 브라우저 번역·결과·백업·제공자 전환 검증
- [x] 기존 브라우저 회귀 스모크 및 320~1440px 반응형 테스트 통과
- [x] 정적 빌드·OG 파일·Gemini 스크립트 배포 여부 검증
- [ ] 실제 Gemini API 키로 실통신/CORS/계정 한도 검증 (사용자 환경 필요)
- [ ] 실제 Vercel 운영 도메인에서 번역 검증 (배포 이후)

## 자체 점검
- 기능 범위: Gemini 전용 연결 모듈 + 필수 설정 UI만 추가
- 기존 기능: 테스트상 유지
- 안정성 자체 평가: **9/10점** (실제 운영 API 호출 미검증으로 1점 보류)

## v1.3.1 보정
- [x] Gemini/OpenAI 키 사용·암호화 저장·잠금 해제 시 제공자 자동 선택
- [x] API 키 상태를 미등록·잠김·등록됨/연결 미검증으로 구분
- [ ] 실키 사용 네트워크 요청 확인은 배포된 브라우저에서 검증 필요
