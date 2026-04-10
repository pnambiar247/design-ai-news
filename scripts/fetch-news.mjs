// GitHub Actions script — fetches design AI news from Google News RSS
// Runs every 3h, writes data/articles.json for GitHub Pages frontend

import { writeFileSync, mkdirSync } from 'fs'
import { createHash } from 'crypto'

const BEATS = [
  { label: 'Figma AI',              query: 'Figma AI features design' },
  { label: 'Adobe Firefly',         query: 'Adobe Firefly AI Photoshop Illustrator' },
  { label: 'AI UX Design',          query: 'AI UX design user experience tools' },
  { label: 'Canva AI',              query: 'Canva AI Magic design' },
  { label: 'Framer AI',             query: 'Framer AI website builder design' },
  { label: 'Midjourney Design',     query: 'Midjourney design creative AI image' },
  { label: 'AI Design Systems',     query: 'AI design system component automation' },
  { label: 'AI Prototyping',        query: 'AI prototyping wireframe mockup tool' },
  { label: 'AI Motion Design',      query: 'AI animation motion design Runway' },
  { label: 'AI Typography',         query: 'AI typography font design generation' },
  { label: 'AI Branding',           query: 'AI branding logo identity design' },
  { label: 'AI Web Design',         query: 'AI website design builder generator' },
  { label: 'Generative Design',     query: 'generative design AI creative tool 2025' },
  { label: 'AI Accessibility',      query: 'AI accessibility inclusive design' },
  { label: 'Design + AI Tools',     query: 'AI design tools launch product 2025' },
  { label: 'Creative AI',           query: 'creative AI art design professionals' },
  { label: 'Stable Diffusion',      query: 'Stable Diffusion creative design art UI' },
  { label: 'Microsoft Designer',    query: 'Microsoft Designer AI Copilot design' },
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

  mkdirSync('data', { recursive: true })
  writeFileSync('data/articles.json', JSON.stringify(output, null, 2))
  console.log(`Done — ${deduped.length} articles written to data/articles.json (${Math.round((Date.now()-start)/1000)}s)`)
}

main().catch(err => { console.error(err); process.exit(1) })
