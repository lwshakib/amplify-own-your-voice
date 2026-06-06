# Contributing to Amplify

First off, thank you for considering contributing to Amplify! Your support helps make Amplify a premier platform for voice and communication mastery.

## Code of Conduct

By participating in this project, you are expected to uphold our [Code of Conduct](CODE_OF_CONDUCT.md).

## Getting Started

### 1) Fork, Clone, and Configure Upstream

1. Fork this repository from GitHub to your own account.
2. Clone your fork locally:

   ```bash
   git clone https://github.com/<your-username>/amplify-own-your-voice.git
   cd amplify-own-your-voice
   ```

3. Add the original repository as `upstream` so you can sync latest changes:

   ```bash
   git remote add upstream https://github.com/lwshakib/amplify-own-your-voice.git
   git remote -v
   ```

### 2) Install Dependencies

We use [pnpm](https://pnpm.io) for package management.

```bash
pnpm install
```

### 3) Environment Variables

1. Copy the example file:

   ```bash
   cp .env.example .env
   ```

2. Fill in the required values in `.env`:
   - `NEXT_PUBLIC_BASE_URL`
   - `DATABASE_URL`
   - `BETTER_AUTH_SECRET`
   - `BETTER_AUTH_URL`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `AWS_REGION`
   - `AWS_ENDPOINT`
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_S3_BUCKET_NAME`
   - `GEMINI_API_KEY`
   - `RESEND_API_KEY`

### 4) Database Initialization

```bash
pnpm prisma generate
pnpm prisma db push
```

### 5) Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## How Can I Contribute?

### Reporting Bugs

- **Search for existing issues.**
- **Open a new issue.** Include a clear title, descriptive steps to reproduce, and environment details.

### Suggesting Enhancements

- **Open a new issue.** Explain the proposed feature and its benefit to users.

### Pull Requests

1. Sync latest `main` from upstream:

   ```bash
   git checkout main
   git fetch upstream
   git merge upstream/main
   git push origin main
   ```

2. Create a new branch from `main`:

   ```bash
   git checkout -b feat/short-description
   ```

3. Make your changes and test locally.

4. Stage and commit:

   ```bash
   git add .
   git commit -m "Add: short summary of your change"
   ```

5. Push your branch to your fork:

   ```bash
   git push -u origin feat/short-description
   ```

6. Open a Pull Request from your branch to `lwshakib/amplify-own-your-voice:main`.

7. In your PR description, include:
   - What changed
   - Why it changed
   - Screenshots or recordings (if UI changed)
   - Any setup or migration notes

8. Address review feedback and push follow-up commits to the same branch.

### Keep Your Branch Updated

If `main` moves while your PR is open:

```bash
git checkout main
git fetch upstream
git merge upstream/main
git checkout feat/short-description
git merge main
git push
```

## Style Guide

- **Package Manager**: Always use `pnpm`.
- **Typing**: Use strict TypeScript typing; avoid `any`.
- **UI**: Follow the design system using Tailwind CSS and Shadcn UI.
- **State Management**: Prefer React Hooks and Context; use Zustand for complex global state.
- **Commits**: Use descriptive, imperative-mood commit messages (e.g., "Implement debate scoring logic").

## Questions?

Reach out to the project owner at [lwshakib](https://github.com/lwshakib) or via email at [l.w.shakib@gmail.com].
