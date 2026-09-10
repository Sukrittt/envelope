import Link from 'next/link'
import { HeroPhone, Playground } from '../components/landing/Playground'
import { Faq, LaunchFilm, Tour } from '../components/landing/LandingClient'
import '../landing.css'

const PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.sukrit04.envelope'
const GITHUB = 'https://github.com/Sukrittt/envelope-mobile'

const MARQUEE = ['🏠 Rent', '🍅 Groceries', '🛵 Travel', '📺 Subscriptions', '💇 Haircut', '⚽ Football', '🛍️ Shopping', '⚡ Electricity', '🎡 Outings', '👨‍🍳 Cook', '🧺 Laundry', '📈 Investments', '🪑 Furniture']

const STEPS = [
  { n: '01', color: '#F4501A', title: 'Pour income into envelopes', body: "Rent, groceries, that football habit. Every rupee gets a job the day it lands. Ready to assign hits ₹0, and that's the win." },
  { n: '02', color: '#2BD97C', title: 'Log it in seconds', body: 'Big keypad, one note, done. No receipt scanning ritual, no bank OTP, no waiting for a sync that never comes.' },
  { n: '03', color: '#22C9E8', title: 'Move money when life happens', body: 'Blew the Outings envelope? Drag from Shopping. No shame spiral, no starting over next month.' },
]

const FEATURES = [
  { icon: '🎁', tint: '#f4501a', title: 'Expense Wrapped', body: 'Your month, wrapped. Yes, it will call you out about the food delivery.' },
  { icon: '🧠', tint: '#f4501a', title: 'Money Brain', body: '"How much on Swiggy since June?" Ask in plain words, get a straight number.' },
  { icon: '📈', tint: '#2bd97c', title: 'Investments', body: 'Portfolio at a glance, sitting next to the spending it competes with.' },
  { icon: '🧾', tint: '#2bd97c', title: 'Scan a bill', body: 'Point at a receipt, split the cart across envelopes line by line.' },
  { icon: '🔁', tint: '#e96ae0', title: 'Recurring expenses', body: 'Rent, cook, gym. Planned before the month starts, not discovered after.' },
  { icon: '📺', tint: '#e96ae0', title: 'Subscriptions', body: 'What renews and when, with a nudge before it silently charges you.' },
  { icon: '📊', tint: '#22c9e8', title: 'Insights', body: 'Trends, breakdowns, and the month-on-month number you keep avoiding.' },
  { icon: '🗄️', tint: '#22c9e8', title: 'Archive', body: "Deleted something at 1am? It's still there. Restore it." },
]

const COMPARE = [
  { label: 'Setup', sheet: 'Build it yourself', apps: 'Link accounts first', aviary: 'Pick your envelopes' },
  { label: 'Logging an expense', sheet: 'Alt-tab, scroll, type', apps: 'Forms and dropdowns', aviary: 'Keypad, note, done' },
  { label: 'Bank login needed', sheet: 'No', apps: 'Usually yes', aviary: 'Never' },
  { label: 'Rupee-native', sheet: 'If you build it', apps: 'Sort of', aviary: 'Always' },
  { label: 'Cost', sheet: 'Free', apps: 'Often paid', aviary: '₹0' },
  { label: 'Open source', sheet: 'No', apps: 'No', aviary: 'Yes' },
]

const FAQS = [
  { q: 'Is it actually free?', a: "Yes. Free forever, open source, and there's no paid tier waiting to appear. The code is public, so fork it if you want to." },
  { q: 'Do I have to connect my bank?', a: "No, and you can't. Aviary never touches your bank. You log what you spend, which is also why nothing goes uncategorised for three weeks." },
  { q: "Isn't logging manually exhausting?", a: "It takes seconds, and that's the point. The tiny friction is what makes you notice the spend. Recurring expenses and bill scanning cover the boring stuff." },
  { q: "What's the difference between the app and the web version?", a: 'Feature for feature they match. Mobile also gets notifications, a home-screen widget, and a keypad built for one thumb, so start there.' },
  { q: 'Does it work outside India?', a: "It works anywhere, but it's built rupee-first: ₹ formatting, Indian number grouping, and categories that match how people here actually spend." },
  { q: 'What happens to my data?', a: "It's yours. Export any time, delete any time, and because the project is open source you can read exactly what's stored." },
]

export function LandingPage() {
  return (
    <div className="lp">
      <div className="lp-glow" aria-hidden="true" />

      <header className="lp-header">
        <div className="lp-header-inner">
          <a href="#top" className="lp-logo">
            Aviary
          </a>
          <nav className="lp-nav">
            <a href="#play">Try it</a>
            <a href="#features">Features</a>
            <a href="#web">Web app</a>
            <a href="#faq">FAQ</a>
          </nav>
          <Link href="/expense" className="lp-btn-sm lp-btn-sm--ghost">
            Open web app
          </Link>
          <a href="#get" className="lp-btn-sm">
            Download
          </a>
        </div>
      </header>

      <section id="top" className="lp-hero">
        <div className="lp-hero-copy">
          <div className="lp-badge">
            <span className="lp-badge-dot" />
            Built in India, for rupees
          </div>
          <h1 className="lp-h1">
            Less guessing,
            <br />
            <span className="lp-accent">more living.</span>
          </h1>
          <p className="lp-lede">
            Envelope budgeting built for rupees. Give every rupee a job before you spend it, then get on with your life.{' '}
            <strong>Free, forever, and open source.</strong>
          </p>
          <div className="lp-cta-row">
            <a href="#get" className="lp-btn lp-btn--accent">
              Get the app <span style={{ fontSize: 15 }}>↓</span>
            </a>
            <a href="#play" className="lp-btn lp-btn--ghost">
              Play with it first
            </a>
          </div>
          <div className="lp-trust">
            <span>🔓 No bank login</span>
            <span>🕒 Logged in seconds</span>
            <span>🧾 ₹ native, always</span>
          </div>
        </div>

        <div className="lp-hero-art">
          <div className="lp-float" style={{ top: '6%', left: '-2%', fontSize: 30, animationDuration: '5s' }}>🏠</div>
          <div className="lp-float" style={{ top: '36%', right: '-1%', fontSize: 26, animationDuration: '6.4s', animationDelay: '.6s' }}>🛵</div>
          <div className="lp-float" style={{ bottom: '9%', left: '2%', fontSize: 26, animationDuration: '5.8s', animationDelay: '1.1s' }}>🍅</div>
          <HeroPhone />
        </div>
      </section>

      <div className="lp-marquee" aria-hidden="true">
        <div className="lp-marquee-track">
          {[0, 1].map((copy) => (
            <div key={copy} className="lp-marquee-set">
              {MARQUEE.map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <section className="lp-section" style={{ paddingTop: 88 }}>
        <div className="lp-eyebrow">HOW IT WORKS</div>
        <h2 className="lp-h2">Three steps. Then it&apos;s just tapping.</h2>
        <div className="lp-grid lp-grid--steps">
          {STEPS.map((s) => (
            <div key={s.n} className="lp-card lp-card--lift">
              <div className="lp-display" style={{ fontWeight: 700, fontSize: 40, color: s.color, lineHeight: 1 }}>
                {s.n}
              </div>
              <div className="lp-card-title" style={{ fontSize: 21, marginTop: 14 }}>
                {s.title}
              </div>
              <p className="lp-card-body">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <Playground />

      <section id="features" className="lp-section">
        <div className="lp-eyebrow">EVERYTHING ELSE</div>
        <h2 className="lp-h2">The stuff you&apos;ll find once you&apos;re in.</h2>
        <div className="lp-grid lp-grid--features">
          {FEATURES.map((f) => (
            <div key={f.title} className="lp-card lp-feature" style={{ ['--tint' as string]: f.tint }}>
              <div className="lp-feature-icon">{f.icon}</div>
              <div className="lp-card-title" style={{ fontSize: 19, marginTop: 14 }}>
                {f.title}
              </div>
              <p className="lp-card-body" style={{ fontSize: 14, marginTop: 6 }}>
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-film-card">
          <div style={{ padding: '34px 34px 0' }}>
            <div className="lp-eyebrow">THE LAUNCH FILM</div>
            <h2 className="lp-h2" style={{ fontSize: 'clamp(28px,3.2vw,38px)', margin: '10px 0 6px' }}>
              Ninety seconds, sound on. 🔊
            </h2>
            <p className="lp-sub" style={{ margin: '0 0 22px', maxWidth: 560, fontSize: 16 }}>
              Why we built another budgeting app, and why this one has a keypad the size of your thumb.
            </p>
          </div>
          <LaunchFilm />
        </div>
      </section>

      <Tour />

      <section id="web" className="lp-section">
        <div className="lp-split">
          <div style={{ minWidth: 0 }}>
            <div className="lp-eyebrow" style={{ color: '#22C9E8' }}>
              ALSO ON THE WEB
            </div>
            <h2 className="lp-h2" style={{ fontSize: 'clamp(28px,3.4vw,40px)' }}>
              Same envelopes, bigger screen.
            </h2>
            <p className="lp-sub" style={{ lineHeight: 1.6, marginTop: 12 }}>
              Every feature, feature for feature, in the browser. Great for the Sunday-evening budget sit-down on a laptop.
            </p>
            <div className="lp-card lp-web-note">
              <div className="lp-row lp-display" style={{ gap: 9, fontWeight: 600, fontSize: 17 }}>
                <span>📱</span>But get the app anyway
              </div>
              <p className="lp-card-body" style={{ marginTop: 8 }}>
                The phone is where the money actually leaves your hands. Only mobile gets:
              </p>
              <div className="lp-web-list">
                <span>🔔 Nudges when an envelope is nearly empty</span>
                <span>🧩 Home-screen widget, log without opening the app</span>
                <span>👆 One-thumb keypad built for standing in a queue</span>
              </div>
            </div>
            <div className="lp-row" style={{ gap: 22, marginTop: 20, flexWrap: 'wrap' }}>
              <Link href="/expense" className="lp-link">
                Open the web app →
              </Link>
              <a href="#get" className="lp-link">
                Get the mobile app →
              </a>
            </div>
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="lp-browser">
              <div className="lp-browser-bar">
                <span style={{ background: '#ff5f57' }} />
                <span style={{ background: '#febc2e' }} />
                <span style={{ background: '#28c840' }} />
                <em>aviary.app/expense</em>
              </div>
              <div className="lp-browser-body">
                <div className="lp-browser-side">
                  <div className="lp-display" style={{ fontWeight: 700, fontSize: 16 }}>Aviary</div>
                  <div className="lp-browser-links">
                    <div className="is-on">Dashboard</div>
                    <div>Transactions</div>
                    <div>Envelopes</div>
                    <div>Insights</div>
                  </div>
                </div>
                <div className="lp-browser-main">
                  <div className="lp-mini-card">
                    <div className="lp-mock-label">READY TO ASSIGN</div>
                    <div className="lp-display lp-mint" style={{ fontWeight: 700, fontSize: 28, marginTop: 3 }}>₹0</div>
                    <div className="lp-bar" style={{ height: 6, marginTop: 10 }}>
                      <div className="lp-bar-fill" style={{ width: '100%', background: '#F4501A' }} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="lp-mini-card">
                      <div className="lp-mock-label">SPENT</div>
                      <div className="lp-display" style={{ fontWeight: 700, fontSize: 19, marginTop: 2 }}>₹63,415</div>
                    </div>
                    <div className="lp-mini-card">
                      <div className="lp-mock-label">ENVELOPES</div>
                      <div className="lp-display" style={{ fontWeight: 700, fontSize: 19, marginTop: 2 }}>16</div>
                    </div>
                  </div>
                  <div className="lp-mini-card" style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 12 }}>Spending trend</div>
                    <div className="lp-trend">
                      {[34, 52, 28, 66, 45, 100].map((h, i) => (
                        <div key={i} style={{ height: `${h}%`, background: i === 5 ? '#F4501A' : '#2c2c32' }} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-eyebrow">HONEST COMPARISON</div>
        <h2 className="lp-h2">You&apos;ve already tried the other two.</h2>
        <div className="lp-compare">
          <div className="lp-compare-row lp-compare-head">
            <div />
            <div>SPREADSHEET</div>
            <div>BIG BUDGET APPS</div>
            <div className="lp-accent">AVIARY</div>
          </div>
          {COMPARE.map((r) => (
            <div key={r.label} className="lp-compare-row">
              <div className="lp-compare-label">{r.label}</div>
              <div>{r.sheet}</div>
              <div>{r.apps}</div>
              <div className="lp-compare-win">{r.aviary}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="faq" className="lp-section" style={{ maxWidth: 820 }}>
        <h2 className="lp-h2" style={{ margin: 0, textAlign: 'center' }}>
          Fair questions.
        </h2>
        <Faq items={FAQS} />
      </section>

      <section id="get" className="lp-section" style={{ paddingBottom: 40 }}>
        <div className="lp-get">
          <div className="lp-float" style={{ top: 8, left: 14, fontSize: 34, opacity: 0.4, animationDuration: '6s' }}>🏠</div>
          <div className="lp-float" style={{ bottom: 10, right: 16, fontSize: 32, opacity: 0.4, animationDuration: '7s', animationDelay: '.8s' }}>🛵</div>
          <div className="lp-float" style={{ bottom: 12, left: 18, fontSize: 26, opacity: 0.32, animationDuration: '5.4s', animationDelay: '.4s' }}>🍅</div>
          <h2 className="lp-h2" style={{ fontSize: 'clamp(32px,4.4vw,54px)', margin: 0, position: 'relative' }}>
            Give your next rupee a job.
          </h2>
          <p className="lp-get-sub">Free forever. Open source. No card, no bank login, no upsell three screens in.</p>
          <div className="lp-stores">
            <a href={PLAY_STORE} target="_blank" rel="noreferrer" className="lp-store">
              <span>GET IT ON</span>Google Play
            </a>
            <Link href="/expense" className="lp-store lp-store--glass">
              <span>OR USE THE</span>Web app
            </Link>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div>
            <div className="lp-display" style={{ fontWeight: 700, fontSize: 21 }}>Aviary</div>
            <div style={{ fontSize: 13, color: '#6a6a72', marginTop: 4 }}>Envelope budgeting for rupees. Free and open source.</div>
          </div>
          <div className="lp-footer-links">
            <a href="#play">Try it</a>
            <a href="#features">Features</a>
            <Link href="/legal/privacy">Privacy</Link>
            <Link href="/legal/terms">Terms</Link>
            <a href="#faq">FAQ</a>
            <a href={GITHUB} target="_blank" rel="noreferrer">
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
