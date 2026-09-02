import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import Icon from '../components/Icon';

export default function Dashboard() {
  const [stats, setStats] = useState({ ideas: 0, scripts: 0, videos: 0, rendered: 0 });
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [ideas, scripts, videos, prof] = await Promise.all([
          api.getIdeas(), api.getScripts(), api.getVideos(), api.getProfile(),
        ]);
        const rendered = videos.filter(v => ['ready', 'approved', 'uploaded'].includes(v.status)).length;
        setStats({ ideas: ideas.length, scripts: scripts.length, videos: videos.length, rendered });
        setProfile(prof);
      } catch (e) { console.error(e); }
    })();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{profile ? `Welcome, ${profile.display_name}` : 'Dashboard'}</h1>
          <p>Your content production pipeline at a glance.</p>
        </div>
        <Link to="/ideas" className="btn btn-primary"><Icon name="plus" size={14} /> New Ideas</Link>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Ideas</div>
          <div className="stat-value">{stats.ideas}</div>
          <div className="stat-sub">in pipeline</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Scripts</div>
          <div className="stat-value c-accent">{stats.scripts}</div>
          <div className="stat-sub">generated</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Videos</div>
          <div className="stat-value c-amber">{stats.videos}</div>
          <div className="stat-sub">total</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Completed</div>
          <div className="stat-value c-green">{stats.rendered}</div>
          <div className="stat-sub">ready or uploaded</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header"><h3 className="card-title">Production Pipeline</h3></div>
          <ol style={{ paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: 8, color: 'var(--text-1)', fontSize: 13, lineHeight: 1.7 }}>
            <li><strong>Ideas</strong> — Generate topic batches from your niche config.</li>
            <li><strong>Approve</strong> — Review and green-light ideas before scripting.</li>
            <li><strong>Scripts</strong> — AI writes structured scripts with quality scoring.</li>
            <li><strong>Render</strong> — TTS + stock clips + FFmpeg assembly with your caption style.</li>
            <li><strong>Upload</strong> — Review the video and publish to YouTube.</li>
          </ol>
        </div>

        <div className="card">
          <div className="card-header"><h3 className="card-title">Quick Setup</h3></div>
          <ol style={{ paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: 8, color: 'var(--text-1)', fontSize: 13, lineHeight: 1.7 }}>
            <li>Go to <Link to="/profile" style={{ color: 'var(--accent-strong)', fontWeight: 600 }}>Settings</Link> — set your channel name and upload your logo.</li>
            <li>Choose your default caption style and CTA text.</li>
            <li>Add your Pexels API key in <code className="mono" style={{ color: 'var(--accent-strong)', fontSize: 12 }}>.env</code></li>
            <li>Start generating ideas and producing Shorts!</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
