'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { db } from '@/lib/firebase'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'

// ── Helpers ──────────────────────────────────────────────────────────────────
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const genCode = (n = 6) => Array.from({ length: n }, () => CHARS[Math.random() * CHARS.length | 0]).join('')
const isValidUrl = u => { try { const x = new URL(u); return x.protocol === 'http:' || x.protocol === 'https:' } catch { return false } }
const isValidAlias = a => /^[a-zA-Z0-9\-]{3,30}$/.test(a)
const buildShortUrl = code => `${window.location.origin}/go/${code}`

const getDeviceId = () => {
  let id = localStorage.getItem('ciweb_did')
  if (!id) { id = 'd_' + genCode(16); localStorage.setItem('ciweb_did', id) }
  return id
}

const Cache = {
  key: 'ciweb_links',
  get() { try { return JSON.parse(localStorage.getItem(this.key) || '[]') } catch { return [] } },
  add(l) { try { const a = this.get().filter(x => x.code !== l.code); localStorage.setItem(this.key, JSON.stringify([l, ...a].slice(0, 20))) } catch {} },
}

const RateLimit = {
  check() {
    const d = JSON.parse(localStorage.getItem('ciweb_rl') || '{"n":0,"r":0}')
    if (Date.now() > d.r) { localStorage.setItem('ciweb_rl', JSON.stringify({ n: 1, r: Date.now() + 3600000 })); return true }
    if (d.n >= 20) return false
    d.n++; localStorage.setItem('ciweb_rl', JSON.stringify(d)); return true
  }
}

const FEATURES = [
  ['⚡', 'Instant & Free', 'No sign-up required. Short link in seconds.'],
  ['📊', 'Click Analytics', 'Track clicks, devices, browsers & referrers.'],
  ['📱', 'QR Code', 'Scan-ready QR code for every short link.'],
  ['⏱', 'Expiry Controls', 'Set links to expire by date or after X clicks.'],
  ['✏️', 'Custom Aliases', 'Create branded links like /go/course'],
  ['🔒', 'Secure', 'URL validation, Firestore rules, rate limiting.'],
]

// ── Component ─────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [url,      setUrl]      = useState('')
  const [alias,    setAlias]    = useState('')
  const [useAlias, setUseAlias] = useState(false)
  const [expiry,   setExpiry]   = useState('never')
  const [expDate,  setExpDate]  = useState('')
  const [expClicks,setExpClicks]= useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [result,   setResult]   = useState(null)
  const [copied,   setCopied]   = useState(false)
  const [recent,   setRecent]   = useState([])

  useEffect(() => { setRecent(Cache.get()) }, [])

  const submit = async e => {
    e.preventDefault()
    setError('')
    if (!url.trim())         return setError('Please enter a URL.')
    if (!isValidUrl(url))    return setError('Enter a valid URL starting with http:// or https://')
    if (!RateLimit.check())  return setError('Rate limit reached (20/hour). Please wait.')

    setLoading(true)
    try {
      let code = useAlias ? alias.trim().toLowerCase() : ''

      if (code) {
        if (!isValidAlias(code)) throw new Error('Alias must be 3–30 chars: letters, numbers, hyphens only.')
        if ((await getDoc(doc(db, 'urls', code))).exists()) throw new Error('This alias is already taken.')
      } else {
        for (let i = 0; i < 5; i++) {
          code = genCode(i < 4 ? 6 : 8)
          if (!(await getDoc(doc(db, 'urls', code))).exists()) break
        }
      }

      let expiresAt = null, expiryClicks = null
      if (expiry === 'date'   && expDate)    expiresAt    = new Date(expDate)
      if (expiry === 'clicks' && expClicks)  expiryClicks = parseInt(expClicks)

      await setDoc(doc(db, 'urls', code), {
        shortCode:    code,
        originalUrl:  url.trim(),
        clicks:       0,
        createdAt:    serverTimestamp(),
        expiresAt:    expiresAt || null,
        expiryClicks: expiryClicks || null,
        deviceId:     getDeviceId(),
        active:       true,
      })

      const short = buildShortUrl(code)
      setResult({ code, short, originalUrl: url.trim() })
      Cache.add({ code, short, originalUrl: url.trim() })
      setRecent(Cache.get())
      // Reset
      setUrl(''); setAlias(''); setUseAlias(false); setExpiry('never'); setExpDate(''); setExpClicks('')
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const copy = async () => {
    await navigator.clipboard.writeText(result.short).catch(() => {})
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ minHeight: '100vh' }}>

      {/* ── Navbar ── */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, padding: '12px 16px' }}>
        <div className="card" style={{ maxWidth: 900, margin: '0 auto', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 16 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#06b6d4,#3b82f6)', display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 12, color: '#fff' }}>CI</div>
            <span style={{ fontWeight: 800, fontSize: 15 }}><span className="glow">CIWEB</span><span style={{ color: 'rgba(255,255,255,.55)' }}> Links</span></span>
          </Link>
          <div style={{ display: 'flex', gap: 4 }}>
            <Link href="/"          style={{ padding: '7px 14px', borderRadius: 10, background: 'rgba(6,182,212,.12)', color: '#22d3ee', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>🔗 Shorten</Link>
            <Link href="/dashboard" style={{ padding: '7px 14px', borderRadius: 10, color: 'rgba(255,255,255,.65)', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>📊 My Links</Link>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '100px 16px 60px' }}>

        {/* ── Hero ── */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 18px', borderRadius: 99, background: 'rgba(6,182,212,.1)', border: '1px solid rgba(6,182,212,.3)', color: '#22d3ee', fontSize: 12, fontWeight: 500, marginBottom: 20 }}>
            ✨ Free URL Shortener — No Sign-Up Required
          </div>
          <h1 style={{ fontSize: 'clamp(2rem,5.5vw,3.5rem)', fontWeight: 900, color: '#fff', lineHeight: 1.12, marginBottom: 14 }}>
            Short Links,<br /><span className="glow">Big Impact</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,.55)', fontSize: 17, maxWidth: 460, margin: '0 auto 32px', lineHeight: 1.65 }}>
            Create powerful short links with analytics, QR codes &amp; expiry — completely free.
          </p>
        </div>

        {/* ── Shortener Form ── */}
        <div style={{ maxWidth: 680, margin: '0 auto 32px' }}>
          <div className="card" style={{ padding: '28px 30px' }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Shorten a URL</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.5)' }}>No sign-up needed. Paste your link and go.</div>
            </div>

            <form onSubmit={submit}>
              {/* URL Input */}
              <div style={{ position: 'relative', marginBottom: 14 }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 15 }}>🔗</span>
                <input className="inp" type="url" value={url} onChange={e => setUrl(e.target.value)}
                  placeholder="https://your-very-long-url.com/paste/here"
                  style={{ paddingLeft: 42 }} disabled={loading} />
              </div>

              {/* Options Row */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14, alignItems: 'center' }}>
                <button type="button" onClick={() => setUseAlias(v => !v)}
                  style={{ padding: '8px 14px', borderRadius: 12, border: `1px solid ${useAlias ? 'rgba(6,182,212,.45)' : 'rgba(255,255,255,.12)'}`, background: useAlias ? 'rgba(6,182,212,.1)' : 'rgba(255,255,255,.05)', color: useAlias ? '#22d3ee' : 'rgba(255,255,255,.6)', fontSize: 13, cursor: 'pointer', transition: '.2s' }}>
                  ✏️ Custom alias
                </button>
                <select className="inp" value={expiry} onChange={e => setExpiry(e.target.value)}
                  style={{ flex: 1, minWidth: 170, padding: '9px 14px', fontSize: 13, appearance: 'none', cursor: 'pointer' }}>
                  <option value="never">♾️ Never expire</option>
                  <option value="date">📅 Expire on date</option>
                  <option value="clicks">👆 Expire after clicks</option>
                </select>
              </div>

              {/* Custom Alias */}
              {useAlias && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,.38)', fontSize: 13, fontFamily: 'monospace' }}>/go/</span>
                    <input className="inp" type="text" value={alias}
                      onChange={e => setAlias(e.target.value.toLowerCase().replace(/[^a-z0-9\-]/g, ''))}
                      placeholder="my-custom-link" style={{ paddingLeft: 50, fontFamily: 'monospace' }} />
                  </div>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginTop: 5 }}>Letters, numbers, hyphens • 3–30 chars</p>
                </div>
              )}

              {/* Date Expiry */}
              {expiry === 'date' && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 13, color: 'rgba(255,255,255,.55)', display: 'block', marginBottom: 6 }}>Expiry date &amp; time</label>
                  <input className="inp" type="datetime-local" value={expDate} onChange={e => setExpDate(e.target.value)} style={{ colorScheme: 'dark' }} />
                </div>
              )}

              {/* Click Expiry */}
              {expiry === 'clicks' && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 13, color: 'rgba(255,255,255,.55)', display: 'block', marginBottom: 6 }}>Expire after how many clicks?</label>
                  <input className="inp" type="number" value={expClicks} onChange={e => setExpClicks(e.target.value)} placeholder="e.g. 100" min="1" />
                </div>
              )}

              {/* Error */}
              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 16px', marginBottom: 14, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.22)', borderRadius: 12, color: '#f87171', fontSize: 13 }}>
                  ⚠️ {error}
                </div>
              )}

              {/* Submit */}
              <button type="submit" className="btn-primary" disabled={loading || !url.trim()}>
                {loading ? <><span className="spin" /> Shortening…</> : '⚡ Shorten URL'}
              </button>
            </form>

            {/* Result */}
            {result && (
              <div style={{ marginTop: 20, padding: 20, borderRadius: 16, border: '1px solid rgba(6,182,212,.28)', background: 'rgba(6,182,212,.05)' }}>
                <div style={{ fontWeight: 600, color: '#fff', fontSize: 14, marginBottom: 12 }}>✅ Link created!</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, padding: '10px 14px' }}>
                  <span style={{ flex: 1, fontFamily: 'monospace', color: '#22d3ee', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{result.short}</span>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button className="btn-ghost" onClick={copy}>{copied ? '✅ Copied!' : '📋 Copy'}</button>
                    <a className="btn-ghost" href={result.short} target="_blank" rel="noopener">↗ Open</a>
                  </div>
                </div>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginTop: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>→ {result.originalUrl}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Recent Links ── */}
        {recent.length > 0 && (
          <div style={{ maxWidth: 680, margin: '0 auto 44px' }}>
            <div className="card" style={{ padding: '22px 28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.45)' }}>🕐 Recent Links</span>
                <Link href="/dashboard" className="btn-ghost" style={{ textDecoration: 'none' }}>View all →</Link>
              </div>
              {recent.slice(0, 5).map(l => (
                <div key={l.code} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <a href={l.short} target="_blank" rel="noopener" style={{ fontFamily: 'monospace', color: '#22d3ee', fontSize: 13, textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.short}</a>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.originalUrl}</div>
                  </div>
                  <CopyBtn url={l.short} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Features ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 14, marginBottom: 60 }}>
          {FEATURES.map(([icon, title, desc]) => (
            <div key={title} className="card" style={{ padding: 22, transition: 'all .3s' }}
              onMouseEnter={e => Object.assign(e.currentTarget.style, { background: 'rgba(255,255,255,.08)', borderColor: 'rgba(6,182,212,.3)', transform: 'translateY(-2px)' })}
              onMouseLeave={e => Object.assign(e.currentTarget.style, { background: 'rgba(255,255,255,.05)', borderColor: 'rgba(255,255,255,.1)', transform: 'translateY(0)' })}>
              <div style={{ fontSize: 26, marginBottom: 12 }}>{icon}</div>
              <div style={{ fontWeight: 700, color: '#fff', fontSize: 15, marginBottom: 7 }}>{title}</div>
              <div style={{ color: 'rgba(255,255,255,.48)', fontSize: 13, lineHeight: 1.65 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,.05)', padding: '20px 16px', textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,.2)' }}>Built with ❤️ by <span style={{ color: 'rgba(6,182,212,.6)' }}>CIWEB</span></p>
      </div>
    </div>
  )
}

function CopyBtn({ url }) {
  const [done, setDone] = useState(false)
  return (
    <button className="btn-ghost" style={{ flexShrink: 0 }}
      onClick={async () => { await navigator.clipboard.writeText(url).catch(() => {}); setDone(true); setTimeout(() => setDone(false), 2000) }}>
      {done ? '✅' : '📋'}
    </button>
  )
}
