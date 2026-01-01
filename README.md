# NvLabs API's Services

NvLabs API's Services is a free RESTful API and easy to integrations with your projects

## How to run it?

```bash
# Clone repository
git clone https://github.com/ShinWolf-Subject/Open-NvLabs.git

# Masuk ke direktori project
cd Open-NvLabs

# Install dependencies
npm Install

# Jalankan development
npm run dev

# Jalankan production
npm start

# Jalankan tes dengan Jest
npm run test

# Jika tidak bisa dijalankan lihat apakah ada yang error
npm run lint
```

---

## How to deploy it?
```bash
# Install Vercel CLI for global
npm i -g vercel

# Login to your account
vercel login

# Lets deploy it 
vercel --prod
```

---

## How to use OpenAPI?
```bash
GET '/adm/nvrapi'
```

---

## Endpoints:
 - `/nv/**/**`

---

## Structure
```
 Open-NvLabs
├──  api
│   ├──  ai
│   │   ├──  gpt.js
│   │   ├──  webpilot.js
│   │   └──  write-cream.js
│   ├──  canvas
│   │   ├──  attp.js
│   │   ├──  fakecall.js
│   │   ├──  font
│   │   │   ├──  Inter-Regular.ttf
│   │   │   └──  LEMONMILK-Bold.otf
│   │   ├──  memegen.js
│   │   ├──  ttp2.js
│   │   └──  ustadz.js
│   ├──  downld
│   │   ├──  gdrive.js
│   │   ├──  pin.js
│   │   ├──  webmusic.js
│   │   └──  x.js
│   ├──  random
│   │   ├──  anime.js
│   │   ├──  animequotes.js
│   │   └──  wf.js
│   └──  tools
│       ├──  htmlgetter.js
│       ├──  nglsender.js
│       ├──  nvsu.js
│       └──  whatanime.js
├──  data
│   └──  banned-ips.json
├──  Dockerfile
├──  files
├──  index.js
├──  LICENSE
├──  logs
│   └──  requests.log
├──  package.json
├──  public
│   ├──  errorPage
│   │   ├──  403.html
│   │   ├──  404.html
│   │   └──  500.html
│   ├──  favicon.ico
│   ├──  index.html
│   ├──  index.html.bak
│   ├──  kit.font-awesome.js
│   ├──  nvrapis.css
│   └──  tailwindcss.js
├── 󰂺 README.md
├── 󰣞 src
│   ├──  app
│   │   ├──  index.js
│   │   └──  responseFormatter.js
│   ├──  middleware
│   │   ├──  index.js
│   │   └──  rateLimiter.js
│   ├──  services
│   │   ├──  ai
│   │   │   └──  gptService.js
│   │   ├──  canvas
│   │   │   ├──  font
│   │   │   │   ├──  Inter-Regular.ttf
│   │   │   │   └──  LEMONMILK-Bold.otf
│   │   │   └──  ustadz.png
│   │   └──  class
│   │       ├──  webmusicscraper.js
│   │       └──  ytdl.js
│   └──  utils
│       ├──  color.js
│       ├──  loader.js
│       ├──  logApiRequest.js
│       └──  logger.js
└──  vercel.json
```

### © 2025 - 2026 NvLabs
### Thanks synshin9 for the boilerplate

