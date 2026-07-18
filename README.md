# 샌드위치 빵 근무표

## 서비스 연결 정보

| 구분 | 이름 / 위치 | 용도 |
| --- | --- | --- |
| 앱 | 샌드위치 빵 근무표 | 근무표, 생산일정, 근태 수정 요청 관리 |
| GitHub 저장소 | [dudtlr2106-ux/sandwich-bread-work](https://github.com/dudtlr2106-ux/sandwich-bread-work) | 소스 코드와 변경 이력 |
| Supabase 운영 프로젝트 | [sandwich-bread-work-prod](https://supabase.com/dashboard/project/eydwovgqmkzlnagmdkca) | 데이터베이스, 로그인, 권한, 웹 푸시 알림 |
| Supabase 프로젝트 ID | `eydwovgqmkzlnagmdkca` | Supabase 프로젝트 식별용 |
| Lovable | GitHub 저장소와 연결 | 화면 편집 및 배포 관리 |

### 명명 규칙

- 운영 환경: `sandwich-bread-work-prod`
- 테스트 환경을 만들 경우: `sandwich-bread-work-dev`
- GitHub 기본 브랜치: `main`

> Supabase URL, 공개 키, VAPID 키, 비밀번호 등 실제 인증 정보는 README에 기록하지 않습니다. 로컬에서는 `.env` 파일로 관리합니다.

## Google 로그인 설정

Google 로그인을 사용하려면 위 운영 Supabase 프로젝트에서 **Authentication → Providers → Google**을 활성화해야 합니다. Firebase 설정값은 이 앱에서 사용하지 않습니다.

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
