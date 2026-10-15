# Job Finder · باحث الوظائف

مستشار توظيف ذكي لقطر: يجمع الوظائف الجديدة من أهم المنصات، يختار الأنسب لك، ويجهّز لكل وظيفة **سيرة ذاتية وخطاب تقديم مخصّصين** — ثم يرسل لك إشعاراً لتراجع وتضغط «إرسال» عبر البريد أو واتساب أو موقع الشركة.

An AI recruiter for Qatar: it collects new jobs from the main platforms, ranks them against your profile, writes a tailored CV + cover letter for each strong match, and notifies you to review and send with one tap (email, WhatsApp or the employer's website). Android app (Capacitor) + web build deployable on Vercel. Arabic/English, light/dark.

## كيف يعمل / How it works

1. **الاستبيان الأول (Onboarding)** — لغة التطبيق والمظهر، الدولة (قطر حالياً)، رفع السيرة الحالية (يقرؤها الذكاء الاصطناعي ويملأ الملف)، المسميات والمهارات، نوع الدوام (كامل/جزئي/عقد/مؤقت/تدريب/حر)، مكان العمل (مقر/هجين/عن بُعد)، لغة الوظائف ولغة السيرة، المسافة من السكن، الإقامة/الكفالة، موعد البدء، الراتب الأدنى.
2. **البحث** — يفحص المصادر بالتوازي، يحذف المكرر، يستبعد الوظائف خارج قطر وغير ذات الصلة.
3. **الترتيب** — نسبة توافق محلية (المسمى، المهارات، نوع الدوام، المسافة بين مدن قطر، اللغة، سنوات الخبرة، قيود الإقامة)، ثم تحليل عميق بـ Claude لأفضل المرشحين مع أسباب وثغرات واضحة.
4. **التجهيز** — لكل وظيفة فوق الحد الأدنى: سيرة مخصّصة لاجتياز ATS، خطاب تقديم، رسالة بريد، رسالة واتساب، وإجابات أسئلة الفرز. تُصدَّر كـ PDF أنيق بالعربية أو الإنجليزية.
5. **المراجعة والإرسال** — إشعار «جاهزة للمراجعة» ← تفتح الوظيفة، تعدّل ما تريد، تضغط «موافقة وإرسال»:
   - **البريد**: يفتح Gmail والمستلم والموضوع والنص والمرفقات (السيرة + الخطاب) جاهزة.
   - **واتساب**: يفتح المحادثة مع الرقم والرسالة والسيرة مرفقة.
   - **الموقع**: يُنسخ الخطاب ويُحفظ ملف السيرة ويُفتح نموذج التقديم.
6. **المتابعة** — قائمة طلباتي: تم التقديم ← مقابلة ← عرض/رفض.
7. **في الخلفية (أندرويد)** — فحص كل ساعة تقريباً والتطبيق مغلق، مع إشعار بالوظائف الجديدة.

## مصادر الوظائف / Job sources

| Source | Notes |
|---|---|
| LinkedIn | public guest search + full description (no login) |
| Tanqeeb | Qatar board that also aggregates Bayt and others; often includes HR email/phone |
| Workable | Qatar-wide job search API |
| SmartRecruiters | employer boards with Qatar openings (e.g. talabat / Delivery Hero) |
| Google Jobs (SerpApi key) | widest coverage: Bayt, GulfTalent, NaukriGulf, Indeed, company sites |
| Jooble (free key) | aggregator of thousands of boards |
| Himalayas, Remotive | remote jobs open to Qatar/MENA (only if you accept remote) |
| Explore links | Bayt, GulfTalent, NaukriGulf, Indeed, LinkedIn, Qatar Living, Glassdoor, Dr.Job — opened with your search pre-filled |

Adding a source = one file in `src/core/sources/` implementing `JobSource`.

## الذكاء الاصطناعي / AI

- Claude via the official `@anthropic-ai/sdk` with structured outputs (Zod schemas) — `src/ai/claude.ts`.
- Default model `claude-opus-5-5`; Sonnet 5.5 / Haiku 5.5 selectable in Settings for lower cost.
- The API key is entered in the app and stored only on the device. Without a key the app still works with local matching and bilingual templates.
- Prompts forbid inventing experience, employers, degrees or skills — the AI only reorders and rephrases what is in your profile.

## البنية / Structure

```
src/core/        pure TS shared by the app and the background runner (sources, matching, Qatar geo, templates)
src/ai/          Claude calls: analyze job, generate application package, parse CV
src/lib/         pipeline, HTTP (native vs /api/proxy), PDF (jsPDF + IBM Plex Sans Arabic), send, notifications
src/runner/      Capacitor Background Runner script (periodic checks while closed)
src/pages, ui/   React screens and design system (Tailwind v4 + Motion)
api/proxy.ts     Vercel Edge function so the web build can reach job boards (host allow-list)
android/         Capacitor Android project (+ ComposerPlugin.java for email/WhatsApp with attachments)
```

## التطوير / Development

```bash
npm install
npm run dev            # web at http://localhost:5173 (dev proxy included)
npm run build          # type-check + production web build
npm run android:apk    # build + sync + debug APK (needs Android SDK, JDK 21)
npm run icons          # regenerate launcher icons / splash from assets/*.svg
```

APK output: `android/app/build/outputs/apk/debug/app-debug.apk`.

### Vercel

Import the repo in Vercel — `vercel.json` sets the Vite build and SPA rewrites, and `api/proxy.ts` is deployed as an Edge function. Some boards block cloud IPs, so the Android app (which calls them from the phone) finds more jobs than the web build.

## الخصوصية / Privacy

Profile, jobs and keys stay in local storage on the device. Network calls go only to the job sources above and, if configured, the Claude API.
