// GitHub Actions script — fetches design AI news from Google News RSS
// Runs every 3h, writes docs/data/articles.json for GitHub Pages frontend

import { writeFileSync, mkdirSync } from 'fs'
import { createHash } from 'crypto'

const BEATS = [
  // ── Core Design Tools ───────────────────────────────────────────────────────
  { label: 'Figma AI',              query: 'Figma AI features design 2025' },
  { label: 'Figma Make',            query: 'Figma Make AI component generation' },
  { label: 'Adobe Firefly',         query: 'Adobe Firefly AI Photoshop Illustrator' },
  { label: 'Adobe Stitch',          query: 'Adobe Stitch AI design tool' },
  { label: 'Canva AI',              query: 'Canva AI Magic design generator' },
  { label: 'Framer AI',             query: 'Framer AI website builder design' },
  { label: 'Microsoft Designer',    query: 'Microsoft Designer AI Copilot design' },
  { label: 'Sketch AI',             query: 'Sketch app AI design features plugin' },
  { label: 'Webflow AI',            query: 'Webflow AI website design builder' },
  { label: 'Wix AI',                query: 'Wix AI website design creator' },

  // ── AI Image & Creative ─────────────────────────────────────────────────────
  { label: 'Midjourney Design',     query: 'Midjourney design creative AI image generation' },
  { label: 'DALL-E Design',         query: 'DALL-E OpenAI image design creative' },
  { label: 'Stable Diffusion',      query: 'Stable Diffusion creative design art UI' },
  { label: 'Runway ML',             query: 'Runway ML AI video design creative' },
  { label: 'Ideogram AI',           query: 'Ideogram AI text image design generation' },
  { label: 'Recraft AI',            query: 'Recraft AI vector icon design tool' },

  // ── UX / Research ───────────────────────────────────────────────────────────
  { label: 'AI UX Design',          query: 'AI UX design user experience tools 2025' },
  { label: 'AI UX Research',        query: 'AI user research testing UX insights' },
  { label: 'AI Accessibility',      query: 'AI accessibility inclusive design WCAG' },
  { label: 'AI Wireframing',        query: 'AI wireframe mockup prototype tool' },
  { label: 'AI User Testing',       query: 'AI user testing usability design' },

  // ── Design Systems & Components ─────────────────────────────────────────────
  { label: 'AI Design Systems',     query: 'AI design system component token automation' },
  { label: 'Design Tokens AI',      query: 'design tokens AI variable automation Figma' },
  { label: 'AI Component Gen',      query: 'AI UI component generation React code design' },
  { label: 'AI Style Guide',        query: 'AI style guide brand design system' },

  // ── Motion & 3D ─────────────────────────────────────────────────────────────
  { label: 'AI Motion Design',      query: 'AI animation motion design after effects' },
  { label: 'Spline 3D AI',          query: 'Spline 3D AI web design interactive' },
  { label: 'Pika Labs',             query: 'Pika Labs AI animation video design' },
  { label: 'Lottie AI',             query: 'Lottie animation AI design motion' },
  { label: 'AI Video Design',       query: 'AI video design creative production tool' },

  // ── Typography & Visual ──────────────────────────────────────────────────────
  { label: 'AI Typography',         query: 'AI typography font design generation tool' },
  { label: 'AI Color Design',       query: 'AI color palette generator design tool' },
  { label: 'AI Icon Design',        query: 'AI icon design generation SVG vector' },
  { label: 'AI Illustration',       query: 'AI illustration art digital design' },
  { label: 'AI Logo Design',        query: 'AI logo branding identity design generator' },

  // ── Branding & Marketing ────────────────────────────────────────────────────
  { label: 'AI Branding',           query: 'AI branding logo identity design tool' },
  { label: 'AI Marketing Design',   query: 'AI marketing design banner ad creative' },
  { label: 'AI Presentation',       query: 'Gamma Beautiful.ai Tome AI presentation design' },
  { label: 'AI Data Viz',           query: 'AI data visualization chart design infographic' },

  // ── Web & Code ──────────────────────────────────────────────────────────────
  { label: 'AI Web Design',         query: 'AI website design builder generator tool' },
  { label: 'Claude AI Design',      query: 'Claude AI UI design code frontend' },
  { label: 'ChatGPT Design',        query: 'ChatGPT UI design code frontend CSS' },
  { label: 'Cursor AI Design',      query: 'Cursor AI frontend design code CSS' },
  { label: 'AI CSS Generation',     query: 'AI CSS code generation web design tool' },
  { label: 'v0 Design',             query: 'v0 Vercel AI UI component design generation' },

  // ── Platforms & Workflow ────────────────────────────────────────────────────
  { label: 'Generative Design',     query: 'generative design AI creative product 2025' },
  { label: 'Design + AI Tools',     query: 'AI design tools new launch product 2025' },
  { label: 'Creative AI',           query: 'creative AI professionals design workflow' },
  { label: 'Notion AI Design',      query: 'Notion AI design document workflow' },
  { label: 'AI Design Feedback',    query: 'AI design review feedback critique tool' },
  { label: 'AI Prototyping',        query: 'AI prototyping interactive design tool' },
]

function parseGoogleTitle(raw) {
  const lastDash = raw.lastIndexOf(' - ')
  if (lastDash > 0 && lastDash < raw.length - 3) {
    return { title: raw.slice(0, lastDash).trim(), publisher: raw.slice(lastDash + 3).trim() }
  }
  return { title: raw.trim(), publisher: null }
}

function stripHtml(html) {
  return (html || '').replace(/<[^>]*>/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'")
    .replace(/\s+/g, ' ').trim()
}

function inferCategory(text) {
  const t = text.toLowerCase()
  if (/figma|sketch|framer|canva|adobe|plugin|prototype|wireframe|design system/.test(t)) return 'tools'
  if (/ux|user experience|usability|research|accessibility|journey|inclusive/.test(t)) return 'ux'
  if (/\bui\b|interface|component|layout|visual design|color|icon|token|responsive/.test(t)) return 'ui'
  if (/animation|motion|transition|micro.interaction|lottie|spring|gsap/.test(t)) return 'motion'
  if (/brand|identity|logo|typography|creative direction/.test(t)) return 'branding'
  if (/\bcss\b|\bhtml\b|frontend|web design|browser/.test(t)) return 'web'
  if (/ai|artificial intelligence|machine learning|generative|diffusion|midjourney|firefly/.test(t)) return 'ai-tools'
  return 'design'
}

async function fetchBeat(label, query) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Design-AI-News/1.0 (GitHub Actions RSS Reader)' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) { console.warn(`[${label}] HTTP ${res.status}`); return [] }
    const xml = await res.text()

    const items = []
    const itemRegex = /<item>([\s\S]*?)<\/item>/g
    let match
    while ((match = itemRegex.exec(xml)) !== null) {
      const itemXml = match[1]
      const get = (tag) => {
        const m = itemXml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))
        return m ? (m[1] || m[2] || '').trim() : ''
      }
      const rawTitle = get('title')
      if (!rawTitle) continue

      // Google News RSS link is in the <link> tag (text node after <link/>)
      const linkMatch = itemXml.match(/<link>(https?:\/\/[^<]+)<\/link>/) ||
                        itemXml.match(/(https?:\/\/news\.google\.com\/[^\s<"]+)/) ||
                        itemXml.match(/(https?:\/\/[^\s<"]+)/)
      const articleUrl = linkMatch ? linkMatch[1].trim() : ''
      if (!articleUrl) continue

      const { title, publisher } = parseGoogleTitle(rawTitle)
      const description = stripHtml(get('description')).slice(0, 280)
      const pubDate = get('pubDate')

      let publishedDate = null
      try { publishedDate = pubDate ? new Date(pubDate).toISOString() : null } catch {}

      items.push({
        id: createHash('sha256').update(articleUrl).digest('hex').slice(0, 16),
        title,
        url: articleUrl,
        summary: description || null,
        source: publisher || label,
        beat: label,
        publishedDate,
        category: inferCategory(title + ' ' + description + ' ' + query),
      })
    }
    console.log(`[${label}] ${items.length} articles`)
    return items
  } catch (err) {
    console.warn(`[${label}] failed: ${err.message}`)
    return []
  }
}

async function main() {
  console.log(`Fetching ${BEATS.length} design AI beats from Google News RSS...`)
  const start = Date.now()

  // Fetch all beats in parallel
  const results = await Promise.allSettled(BEATS.map(({ label, query }) => fetchBeat(label, query)))
  const allArticles = results.flatMap(r => r.status === 'fulfilled' ? r.value : [])

  // Deduplicate by URL
  const seen = new Set()
  const deduped = allArticles.filter(a => {
    const key = a.url.split('?')[0]
    if (seen.has(key)) return false
    seen.add(key); return true
  })

  // Sort newest first
  deduped.sort((a, b) => {
    if (!a.publishedDate && !b.publishedDate) return 0
    if (!a.publishedDate) return 1
    if (!b.publishedDate) return -1
    return new Date(b.publishedDate) - new Date(a.publishedDate)
  })

  const output = {
    articles: deduped,
    total: deduped.length,
    beats: BEATS.length,
    fetchedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
  }

  if (deduped.length === 0) {
    console.warn('WARNING: No articles fetched — all beats may have been blocked or timed out')
  }

  mkdirSync('docs/data', { recursive: true })
  writeFileSync('docs/data/articles.json', JSON.stringify(output, null, 2))
  console.log(`Done — ${deduped.length} articles written to docs/data/articles.json (${Math.round((Date.now()-start)/1000)}s)`)
}

main().catch(err => { console.error(err); process.exit(1) })
