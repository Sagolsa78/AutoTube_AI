import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import './Landing.css';

export default function Landing() {
  return (
    <div className="landing-page">
      <nav className="landing-nav">
        <div className="brand">
          <Icon name="sparkles" size={24} className="brand-icon" />
          <span className="brand-text">AutoShorts Studio</span>
        </div>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it Works</a>
          <a href="#pricing">Pricing</a>
          <Link to="/app" className="btn btn-primary">Go to Studio</Link>
        </div>
      </nav>

      <main>
        <section className="hero">
          <div className="hero-content">
            <div className="badge-pill">🚀 AutoShorts Studio V2 is Live</div>
            <h1>Automate Your YouTube Shorts Pipeline</h1>
            <p className="hero-subtitle">
              From idea generation to final render, AutoShorts Studio handles the entire faceless video production lifecycle. Focus on strategy while AI does the heavy lifting.
            </p>
            <div className="hero-actions">
              <Link to="/app" className="btn btn-primary btn-lg">Get Started Free</Link>
              <a href="#how-it-works" className="btn btn-secondary btn-lg">See How it Works</a>
            </div>
          </div>
          <div className="hero-visual">
            <div className="glass-panel">
              <img src="/mockup-placeholder.png" alt="AutoShorts Dashboard" className="hero-image" />
              {/* Replace with actual image or a CSS art mockup if desired */}
              <div className="mockup-ui">
                <div className="mock-topbar">
                  <span className="dot red"></span><span className="dot yellow"></span><span className="dot green"></span>
                </div>
                <div className="mock-body">
                  <div className="mock-sidebar"></div>
                  <div className="mock-content">
                    <div className="mock-card"></div>
                    <div className="mock-card"></div>
                    <div className="mock-card"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="features-section">
          <h2>Everything you need for viral Shorts</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon"><Icon name="cpu" size={32} /></div>
              <h3>AI Idea Generation</h3>
              <p>Generate highly engaging, viral ideas based on current trends and proven YouTube retention metrics.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><Icon name="fileText" size={32} /></div>
              <h3>Script Writing</h3>
              <p>Our fine-tuned LLM creates compelling hooks, concise bodies, and strong calls-to-action tailored for short-form content.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><Icon name="mic" size={32} /></div>
              <h3>Dynamic Voiceovers</h3>
              <p>Utilize Edge TTS for highly realistic voiceovers with accurate word-boundary timings for perfect caption sync.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><Icon name="video" size={32} /></div>
              <h3>Smart Footage Assembly</h3>
              <p>Automatically fetches and intelligently stitches relevant, high-quality stock footage to match the audio.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><Icon name="type" size={32} /></div>
              <h3>Karaoke Captions</h3>
              <p>Burn-in dynamic karaoke-style subtitles that highlight word-by-word to maximize viewer retention.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><Icon name="youtube" size={32} /></div>
              <h3>One-Click Upload</h3>
              <p>Seamlessly upload your finished and approved Shorts directly to YouTube using the official YouTube Data API.</p>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="how-it-works-section">
          <h2>Production, Simplified.</h2>
          <div className="steps-container">
            <div className="step">
              <div className="step-number">1</div>
              <div className="step-content">
                <h3>Approve Ideas</h3>
                <p>Review AI-generated topics and approve the ones that fit your niche.</p>
              </div>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <div className="step-content">
                <h3>Generate Scripts</h3>
                <p>One click transforms an idea into a full script with visual cues.</p>
              </div>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <div className="step-content">
                <h3>Review & Render</h3>
                <p>Ensure quality, tweak captions, and let the engine compile the video.</p>
              </div>
            </div>
            <div className="step">
              <div className="step-number">4</div>
              <div className="step-content">
                <h3>Publish</h3>
                <p>Push your final masterpiece to your YouTube channel directly.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="footer-content">
          <div className="brand">
            <Icon name="sparkles" size={20} />
            <span className="brand-text">AutoShorts Studio</span>
          </div>
          <p className="footer-text">&copy; 2026 AutoShorts Studio. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
