# GlobalSub v1.2.1

**AI 영상 제작자를 위한 개인 API 기반 글로벌 SRT 자막 제작·검수 도구.**

## UI 구성 (1.1.0 기반)
- ui-polish 기준으로 작업 구조를 먼저 정돈하고 텍스트 위계·명도 대비·버튼 우선순위를 재검토했습니다.
- Binance 토큰의 노란색 `#FCD535`, 잉크 `#181A20`, 다크 캔버스 `#0B0E11`, 회색 헤어라인을 GlobalSub에 맞게 적용했습니다.
- 자막 편집 화면은 밝은 업무용 서피스를 유지하고, 네비게이션만 다크로 분리했습니다.
- 상용 BinanceNova/BinancePlex 폰트는 포함하지 않으며 한국어 시스템 폰트를 사용합니다.
- JS·자막 데이터·API 통신 로직은 1.0.0 버전에서 변경하지 않았습니다. 사용자 프로젝트 저장 키도 그대로 유지합니다.

## 시작
압축을 풀고 프로젝트 폴더에서 다음 명령어를 실행합니다.

```bash
python3 -m http.server 8080
```

그다음 브라우저에서 `http://localhost:8080`에 접속합니다. 또는 HTTPS 정적 호스팅(GitHub Pages 등)에 배포합니다. 로컬 개발 서버는 별도 빌드 없이 사용 가능합니다. Vercel 배포에서는 OG 메타 태그의 절대 URL 생성을 위해 Node 빌드 스크립트를 사용하며, 서버 런타임이나 DB는 필요 없습니다.

## GitHub → Vercel 배포 (권장)
1. `GlobalSub-v1.2.0-Vercel-ready.zip` 파일을 압축 해제하고 **폴더 안의 파일들**을 새 GitHub 저장소 최상위에 업로드합니다. `index.html`, `app.js`, `styles.css`, `styles-polish.css`, `src/`, `vercel.json`이 같은 루트에 있어야 합니다. 저장소에 `GlobalSub-v1.2.0/` 폴더째 올렸다면 Vercel Root Directory를 `GlobalSub-v1.2.0`으로 지정해야 합니다.
2. Vercel의 **Add New → Project**에서 해당 GitHub 저장소를 Import합니다.
3. **Framework Preset: Other**, **Root Directory: `./`(루트에 업로드한 경우)**. `vercel.json`의 빌드 설정(`node scripts/build.mjs`, 출력 `dist`)이 적용되도록 배포합니다. 으로 선택해 Deploy합니다. npm 패키지 설치와 API 서버는 필요하지 않습니다. Vercel 빌드 시 `VERCEL_PROJECT_PRODUCTION_URL` 또는 `VERCEL_URL`을 사용해 OG 주소를 자동 생성합니다. 시스템 환경변수 자동 공개가 꺼져 있다면 켜거나 `OG_SITE_URL`에 HTTPS 실제 도메인을 지정하세요.
4. 배포 후 첫 페이지, SRT 업로드·편집, 자막 ZIP 다운로드, 브라우저 저장 기능을 확인합니다. API 키 테스트는 실제 사용자가 본인의 키로 수행하되, 브라우저에서 OpenAI로의 직접 요청은 CORS 정책 등에 의해 실패할 수 있습니다.
5. `vercel.json`은 보안 응답 헤더(CSP 등)를 설정합니다. `.vercelignore`는 배포 시 테스트와 문서를 제외합니다. `og-image.png`는 제외하지 않습니다. 두 파일을 지우지 마세요.

**키 관련 주의:** 사용자의 OpenAI API 키를 GitHub 저장소·Vercel 환경변수·코드에 넣지 마세요. 이 앱의 키는 브라우저 UI에서 각 사용자가 입력하도록 설계했습니다. 이 설계는 중계 서버를 사용하지 않지만, 브라우저에 노출되는 키에 대한 보안 위험이 남습니다.

## 사용 흐름
1. 빈 프로젝트에서 SRT 원본 파일을 선택하거나, 필요할 때만 예제 체험을 엽니다.
2. 원본 언어를 확인하고 번역 언어를 선택합니다.
3. 설정 화면에서 사용자의 OpenAI API 키를 입력합니다.
4. 자동 번역을 실행하거나, 네트워크 정책에 막히는 경우 수동 번역 JSON을 가져옵니다.
5. 품질 경고를 검수하고 필요하면 선택 구간만 고품질 모델로 재번역합니다.
6. `.srt` 또는 `.zip`을 내려받고 프로젝트 `.json`을 백업합니다.

## 기술·보안 제약
- 완전 정적 웹앱이며 서버 중계 없음. OpenAI API를 사용하면 브라우저에서 OpenAI로 키와 번역할 자막 텍스트를 직접 전송합니다.
- 브라우저 기반 개인 API 키 직접 노출 방식은 보안상 권장되지 않습니다. 안전한 환경에서만 사용하고 낮은 사용 한도·분리된 키를 권장합니다.
- OpenAI API의 CORS 정책/브라우저 보안 설정으로 직접 호출이 실패할 수 있습니다. 서비스 측에서 보장할 수 없습니다. 그럴 때 수동 번역 교환 모드를 사용할 수 있습니다.
- 기본 키 보관은 탭 메모리입니다. 옵션 저장은 비밀번호 기반 암호화된 `localStorage`에 저장되며, 암호 해제 중에는 메모리에 존재합니다. 비밀번호를 잊으면 복구할 수 없습니다.
- 일반 프로젝트는 브라우저 `localStorage`에 자동 저장됩니다. 데이터 삭제 시 사라지므로 `.json`으로 백업하세요. 대용량 SRT는 브라우저 저장 한도를 초과할 수 있습니다.
- 영상은 로컬 미리보기용이며 서버로 보내지 않거나 백업하지 않습니다.
- OpenAI Chat Completions API의 모델 접근/요금은 사용자의 계정에 따릅니다. 문서 참고: https://platform.openai.com/docs/api-reference/chat/create

## 정적 배포 시 주의
- CSP에서 필요한 네트워크는 `https://api.openai.com`만 허용합니다.
- API 키를 클라이언트 코드에 하드코딩하거나 저장소에 커밋하지 마세요.
- 공개 사이트에 악성 스크립트가 주입되면 복호화된 키가 노출될 수 있습니다.

## 릴리스 검증 상태
- Node 로직·암호화·API 모의 테스트: 19개 통과.
- 격리된 Chromium UI 테스트: SRT/수동 JSON/편집/ZIP/프로젝트 복원/모바일 너비 검증.
- **실제 OpenAI API 키를 통한 직접 호출 및 CORS 통과는 검증하지 않았습니다.** OpenAI의 브라우저 정책이나 사이트 호스팅 설정에 따라 자동 번역이 차단될 수 있으며, 그 경우 수동 번역 교환을 사용해야 합니다.
- 정적 웹사이트를 공개 배포할 경우 `Content-Security-Policy`를 HTTP 응답 헤더로도 설정하세요(HTML 메타 태그가 지원하지 않는 정책 일부가 있음).

## 테스트

```bash
node --test tests/*.test.cjs
```

선택적으로 Playwright/Chromium을 설치했다면 UI 모의 환경 스모크 테스트를 실행할 수 있습니다.

```bash
python3 tests/ui_smoke.py
```

이 스모크 테스트는 브라우저 UI 상호작용을 검증하지만 실제 웹 호스팅 네트워크/CORS를 검증하지 않습니다.

## 파일 구성
- `index.html`, `styles.css`, `styles-polish.css`, `app.js`: UI와 상호작용
- `src/core.js`: SRT/검수/ZIP/번역 응답 로직(브라우저/Node 공용)
- `src/api.js`: OpenAI 브라우저 API 통신
- `src/secure.js`: 키 암호화·복호화
- `tests/`: 코어 단위테스트
- `context-notes.md`, `checklist.md`, `User manual.md`: 기획·검수·설명

## v1.2.0 변경 내용 (구현 완료)
- [설정 → 프로젝트 관리]의 백업/복원 버튼 높이 44px 통일. 파일 입력은 버튼 클릭으로 연결해 CSS label 기본 margin 충돌을 제거했습니다.
- 신규 접속은 빈 프로젝트로 시작. ‘미드나잇 시그널’은 [예제 체험]에서만 열리며 실제 작업과 구분됩니다. v1.1.0의 수정되지 않은 기본 예제만 초기 화면에서 제거하고 편집된 프로젝트는 보존합니다. v1.2.0에서 사용자가 명시적으로 연 예제는 새로고침 후에도 유지합니다.
- 언어 탭은 완료·일부·미번역 표시와 건수를 보여줍니다. 미번역 자막에는 API 키 설정/수동 번역 교환 바로가기를 제공합니다.
- 사이드바의 [이용 가이드] 및 상단 [? 이용 방법]에서 6단계 설명과 FAQ를 확인할 수 있습니다. 모바일에서도 제공합니다.
- 19개 Node 테스트 통과, Playwright에서 백업·복원 버튼 정렬, 빈 화면, 샘플 마이그레이션/편집 내용 유지, 가이드, 수동 번역·파일 내보내기, 320–1440px 반응형 확인.
- **미검증:** 사용자 개인 API 키로 실제 OpenAI 요청 성공 및 Vercel 배포 실환경.

## v1.2.1 OG 이미지 및 소셜 공유
- 사용자 선택 **1번 이미지**를 `og-image.png`(1200×630)로 루트에 포함했습니다.
- `index.html`에 Open Graph 및 Twitter Card 메타 태그를 삽입했습니다.
- Vercel 배포 시 `scripts/build.mjs`가 `VERCEL_PROJECT_PRODUCTION_URL`을 기준으로 `og:image`/`twitter:image`를 절대 URL로 바꾼 정적 `dist/index.html`을 생성합니다. 백엔드는 사용하지 않습니다.
- 로컬에서 `node scripts/build.mjs`로 테스트할 때 도메인 변수가 없다면 이미지는 상대 경로를 유지합니다. 예: `OG_SITE_URL=https://yourdomain.com node scripts/build.mjs`.
- 공개 배포 후 미리보기 캐시가 남을 수 있으므로 공유 서비스에서 URL을 새로 검사해 보세요.
