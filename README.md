# GlobalSub-v1.3.1

AI 영상 제작자를 위한 브라우저 기반 SRT 번역·검수 스튜디오. **v1.2.3을 기반으로 Google Gemini 연결만 추가한 업데이트**입니다.

## v1.3.1 변경 사항
- Gemini 또는 OpenAI 키를 등록하거나 잠금 해제하면 해당 AI를 자동 선택하도록 수정했습니다.
- 키가 미등록/잠김/등록됨 상태를 실제 연결 성공으로 오인하지 않도록 구분했습니다.
- 기존 번역 어댑터, 결과 파서, SRT 처리 및 브라우저 전용 구조는 변경하지 않았습니다.

## v1.3.0 변경 사항
- `src/gemini.js`: Gemini REST `generateContent` 호출. 외부 프록시·자체 서버 없이 브라우저에서 Google API에 직접 연결합니다.
- `API · 설정`: 번역 제공자(OpenAI 또는 Gemini)를 선택할 수 있습니다. 기본 제공자는 기존 OpenAI입니다.
- Gemini 경제형 `gemini-3.5-flash-lite`, 정밀형 `gemini-3.8-flash` 기본 모델을 제공하며, 각 제공자의 모델 설정을 별도로 보관합니다.
- Gemini 키는 탭 메모리에 보관하고, 사용자가 원할 때만 암호화 저장할 수 있습니다. OpenAI 암호화 저장본과 독립적입니다.
- 기존 자막 파서·타임코드·자막 검수·수동 교환·SRT/ZIP·영상 미리보기·OG 이미지·프로젝트 백업과 로컬 저장은 유지합니다.
- CSP에 `https://generativelanguage.googleapis.com`을 추가했습니다.

**기준 소스 안내:** 로컬 `GlobalSub-v1.2.3-Vercel-ready.zip`과 연결된 GitHub `paran-coder/globalsub`의 README를 확인했을 때, 이전 버전의 API 호출은 `src/api.js`의 OpenAI 연결만 존재했습니다. 제공된 코드에서 Claude 연결은 확인되지 않았으므로 이번 릴리스는 기존에 없는 Claude 연동을 추가했다고 주장하지 않습니다.

## 실행
정적 파일을 로컬 웹서버에서 열 수 있습니다.

```bash
python3 -m http.server 8080
```

브라우저에서 `http://localhost:8080`에 접속합니다.

## GitHub → Vercel 배포
1. 이 ZIP의 압축을 푼 뒤 **파일들 전체를 GitHub 저장소 최상위**에 업로드합니다. 폴더째 한 단계 안에 넣지 마세요.
2. Vercel에서 해당 저장소를 Import합니다. Framework Preset `Other`, Root Directory `./`를 유지합니다.
3. `vercel.json`이 `node scripts/build.mjs` 빌드와 `dist` 출력 폴더를 지정합니다. 별도의 백엔드 서버는 없습니다.
4. `og-image.png`는 기존 이미지 그대로 제공하며, Vercel 프로덕션 도메인이 있을 때 빌드 스크립트가 절대 URL을 구성합니다.
5. 배포 후 Gemini 설정·실제 번역을 **자신의 API 키로** 확인하세요. 실제 Google API 접근과 CORS·할당량은 실행 환경에 따라 달라질 수 있습니다.

## 사용 방법
1. `API · 설정`에서 Gemini API 키를 입력하고 **현재 탭에서 사용**을 누릅니다.
2. 번역 엔진이 `Google Gemini`로 자동 선택되었는지 확인합니다.
3. 경제형/정밀형 Gemini 모델을 확인하고 **번역 설정 저장**을 누릅니다.
4. 자막 스튜디오에서 SRT를 불러오고 번역 언어를 선택하여 번역을 실행합니다.
5. ID·누락 검수를 거친 번역 결과를 편집하고 언어별 SRT/ZIP을 내려받습니다.
6. OpenAI로 돌아가려면 제공자 선택을 `OpenAI GPT`로 바꿉니다.

## 보안과 한계
- 서버나 GitHub/Vercel 환경변수에 사용자의 API 키를 저장하지 않습니다. **하지만 번역 호출 시 브라우저가 해당 AI 제공사로 키와 자막 텍스트를 직접 전송합니다.**
- 공개 웹페이지에서 개인 API 키로 직접 호출하는 방식에는 브라우저/확장 프로그램/악성 스크립트에 의한 노출 위험이 있습니다. 가능한 한 사용량 제한을 둔 별도 키를 사용하세요.
- 암호화 저장은 선택 사항이며 암호를 잊으면 복구할 수 없습니다. 프로젝트 백업 JSON에는 API 키나 영상 파일이 포함되지 않습니다.
- 브라우저 CORS, 계정 권한, 모델 접근, 비용·쿼터 문제는 실제 계정으로 확인해야 합니다. 네트워크 제한을 서버로 우회하지 않습니다.
- 번역 결과가 누락·중복·알 수 없는 ID를 포함하면 해당 배치가 적용되지 않습니다.
- Gemini `generateContent` 참고: https://ai.google.dev/api/generate-content
- Google Gemini 모델 목록: https://ai.google.dev/gemini-api/docs/models

## 검증
- Node 자동 테스트 25개 통과 (기존 19개 + Gemini 모의 API 5개 + 키 분리 암호화 1개).
- Playwright: 기존 기능·반응형 테스트, Gemini 선택·모의 번역·키 비노출/백업·OpenAI 복귀 테스트 통과.
- 정적 빌드와 CSP 정책, Gemini 모듈 포함 여부 확인.
- **실제 유효한 Gemini/OpenAI API 키를 사용한 통합 호출 및 Vercel 실배포는 이 릴리스에서 검증하지 않았습니다.**

## 프로젝트 구조
- `index.html`, `styles.css`, `styles-polish.css`, `app.js`: 웹 UI 및 흐름
- `src/api.js`: 기존 OpenAI 연결 (변경 없음)
- `src/gemini.js`: 신규 Gemini REST 연결
- `src/secure.js`: 기존 암호화 저장을 유지하며 Gemini용 별도 저장 키 추가
- `src/core.js`: SRT·검수·ZIP 처리 (변경 없음)
- `scripts/build.mjs`, `vercel.json`: Vercel 정적 빌드/CSP
- `assets/`: 예제 자막
- `tests/`: Node/Chromium 회귀 테스트
- `context-notes.md`, `checklist.md`, `User manual.md`, `DESIGN-REVIEW.md`: 프로젝트 문서
