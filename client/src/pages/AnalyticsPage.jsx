import { useAnalytics } from '../hooks/useAnalytics.js';
import Navbar from '../components/Navbar.jsx';
import Spinner from '../components/Spinner.jsx';
import './AnalyticsPage.css';

function formatHours(h) {
  if (!h || h === 0) return '—';
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STATUS_COLORS = { new: '#3b82f6', open: '#f59e0b', pending: '#8b5cf6', resolved: '#10b981', closed: '#6b7280' };
const PRIORITY_COLORS = { low: '#6b7280', medium: '#3b82f6', high: '#f59e0b', urgent: '#ef4444' };
const CATEGORY_COLORS = { refund: '#ef4444', replacement: '#f59e0b', returns: '#8b5cf6', damage: '#ec4899', delivery: '#3b82f6', general: '#6b7280' };
const ACTIVITY_LABELS = { created: 'Created', status_changed: 'Status changed', assigned: 'Assigned', note: 'Note added', replied: 'Replied' };

function StatCard({ label, value, sub, icon, color = '#1e3a5f' }) {
  return (
    <div className="analytics-stat-card">
      <div className="stat-icon" style={{ background: `${color}18`, color }}>{icon}</div>
      <div className="stat-content">
        <span className="stat-value">{value}</span>
        <span className="stat-label">{label}</span>
        {sub && <span className="stat-sub">{sub}</span>}
      </div>
    </div>
  );
}

function MiniBarChart({ data, colorMap, labelKey = '_id', valueKey = 'count' }) {
  if (!data || data.length === 0) return <div className="chart-empty">No data yet</div>;
  const max = Math.max(...data.map(d => d[valueKey] || d.count));
  return (
    <div className="mini-bar-chart">
      {data.map((d, i) => {
        const label = d[labelKey] || d.category || 'unknown';
        const val = d[valueKey] || d.count;
        const pct = max > 0 ? (val / max) * 100 : 0;
        const color = colorMap?.[label] || '#3b82f6';
        return (
          <div className="bar-row" key={i}>
            <span className="bar-label">{label}</span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
            </div>
            <span className="bar-value">{val}</span>
          </div>
        );
      })}
    </div>
  );
}

function VolumeChart({ data }) {
  if (!data || data.length === 0) return <div className="chart-empty">No data in the last 30 days</div>;
  const max = Math.max(...data.map(d => d.count), 1);
  const chartHeight = 120;
  return (
    <div className="volume-chart">
      <div className="volume-bars">
        {data.map((d, i) => {
          const h = (d.count / max) * chartHeight;
          const dayLabel = new Date(d.date + 'T00:00').toLocaleDateString('en', { day: 'numeric', month: 'short' });
          return (
            <div className="volume-bar-wrap" key={i} title={`${dayLabel}: ${d.count} tickets`}>
              <div className="volume-bar" style={{ height: `${h}px` }} />
              {(i === 0 || i === data.length - 1 || i % 7 === 0) && (
                <span className="volume-date">{dayLabel}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DonutChart({ data, colorMap }) {
  if (!data || Object.keys(data).length === 0) return <div className="chart-empty">No data</div>;
  const entries = Object.entries(data).filter(([, v]) => v > 0);
  const sum = entries.reduce((a, [, v]) => a + v, 0);
  if (sum === 0) return <div className="chart-empty">No tickets yet</div>;
  let cumulative = 0;
  const size = 120, radius = 48, cx = size / 2, cy = size / 2;
  return (
    <div className="donut-chart">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {entries.map(([key, val], i) => {
          const pct = val / sum;
          const startAngle = cumulative * 2 * Math.PI - Math.PI / 2;
          cumulative += pct;
          const endAngle = cumulative * 2 * Math.PI - Math.PI / 2;
          const largeArc = pct > 0.5 ? 1 : 0;
          const x1 = cx + radius * Math.cos(startAngle), y1 = cy + radius * Math.sin(startAngle);
          const x2 = cx + radius * Math.cos(endAngle), y2 = cy + radius * Math.sin(endAngle);
          return (
            <path key={i} d={`M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`} fill={colorMap?.[key] || '#6b7280'} stroke="white" strokeWidth="2" />
          );
        })}
        <circle cx={cx} cy={cy} r="30" fill="white" />
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="18" fontWeight="700" fill="#1e293b">{sum}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fill="#94a3b8">total</text>
      </svg>
      <div className="donut-legend">
        {entries.map(([key, val]) => (
          <div className="donut-legend-item" key={key}>
            <span className="donut-dot" style={{ background: colorMap?.[key] || '#6b7280' }} />
            <span className="donut-key">{key}</span>
            <span className="donut-val">{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgentTable({ agents }) {
  if (!agents || agents.length === 0) return <div className="chart-empty">No agent data yet</div>;
  return (
    <table className="agent-table">
      <thead><tr><th>Agent</th><th>Assigned</th><th>Resolved</th><th>Open</th><th>Resolution %</th></tr></thead>
      <tbody>
        {agents.map((a, i) => (
          <tr key={i}>
            <td className="agent-cell">
              {a.agent?.picture ? <img src={a.agent.picture} alt="" className="agent-avatar" referrerPolicy="no-referrer" /> : <div className="agent-avatar-fb">{(a.agent?.name || '?')[0]}</div>}
              <div><div className="agent-name">{a.agent?.name || 'Unknown'}</div><div className="agent-email">{a.agent?.email || ''}</div></div>
            </td>
            <td>{a.total}</td>
            <td className="resolved-cell">{a.resolved}</td>
            <td className="open-cell">{a.open}</td>
            <td><div className="rate-bar-wrap"><div className="rate-bar" style={{ width: `${a.resolutionRate}%` }} /><span>{a.resolutionRate}%</span></div></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ActivityFeed({ activities }) {
  if (!activities || activities.length === 0) return <div className="chart-empty">No recent activity</div>;
  return (
    <div className="activity-feed">
      {activities.slice(0, 12).map((a, i) => (
        <div className="activity-item" key={i}>
          <div className="activity-dot" />
          <div className="activity-body">
            <span className="activity-type">{ACTIVITY_LABELS[a.type] || a.type}</span>
            {a.type === 'status_changed' && <span className="activity-detail">{a.from} &rarr; {a.to}</span>}
            {a.type === 'note' && a.note && <span className="activity-detail">{a.note.slice(0, 60)}{a.note.length > 60 ? '…' : ''}</span>}
            <span className="activity-ticket">{a.ticketNumber}</span>
          </div>
          <span className="activity-time">{timeAgo(a.at)}</span>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage({ auth, navigate, notifs }) {
  const { data, loading, error, refetch } = useAnalytics();
  return (
    <div className="analytics-page">
      <Navbar user={auth.user} onLogout={auth.logout} onSwitch={auth.switchAccount} onRefresh={refetch} loading={loading} page="analytics" navigate={navigate} notifs={notifs} />
      <div className="analytics-content">
        {loading && !data ? (
          <div className="analytics-loading"><Spinner size={28} /><span>Loading analytics…</span></div>
        ) : error ? (
          <div className="analytics-error"><p>Failed to load analytics: {error}</p><button onClick={refetch}>Retry</button></div>
        ) : data ? (
          <>
            <div className="stat-grid">
              <StatCard label="Total Tickets" value={data.summary.totalTickets} sub={`${data.summary.todayTickets} today`} color="#1e3a5f" icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>} />
              <StatCard label="Open" value={data.summary.openTickets} sub="need attention" color="#f59e0b" icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>} />
              <StatCard label="Resolved" value={data.summary.resolvedTickets} sub={`${data.summary.resolutionRate}% rate`} color="#10b981" icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>} />
              <StatCard label="Avg Resolution" value={formatHours(data.resolution.avgHours)} sub={`${data.resolution.resolvedCount} resolved`} color="#8b5cf6" icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>} />
              <StatCard label="This Week" value={data.summary.weekTickets} sub="new tickets" color="#3b82f6" icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>} />
              <StatCard label="Emails Handled" value={data.summary.emailsDone} sub={`${data.summary.emailsPending} pending`} color="#f97316" icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg>} />
            </div>
            <div className="chart-grid">
              <div className="chart-card chart-card--wide"><h3>Ticket Volume — Last 30 Days</h3><VolumeChart data={data.dailyVolume} /></div>
              <div className="chart-card"><h3>Status Breakdown</h3><DonutChart data={data.statusBreakdown} colorMap={STATUS_COLORS} /></div>
            </div>
            <div className="chart-grid">
              <div className="chart-card"><h3>By Category</h3><MiniBarChart data={data.categoryBreakdown} colorMap={CATEGORY_COLORS} labelKey="category" valueKey="count" /></div>
              <div className="chart-card"><h3>By Priority</h3><DonutChart data={data.priorityBreakdown} colorMap={PRIORITY_COLORS} /></div>
              <div className="chart-card"><h3>Resolution Time</h3>
                <div className="resolution-stats">
                  <div className="res-stat"><span className="res-val">{formatHours(data.resolution.avgHours)}</span><span className="res-label">Average</span></div>
                  <div className="res-stat"><span className="res-val">{formatHours(data.resolution.minHours)}</span><span className="res-label">Fastest</span></div>
                  <div className="res-stat"><span className="res-val">{formatHours(data.resolution.maxHours)}</span><span className="res-label">Slowest</span></div>
                  <div className="res-stat"><span className="res-val res-val--accent">{data.summary.resolutionRate}%</span><span className="res-label">Resolution Rate</span></div>
                </div>
              </div>
            </div>
            <div className="chart-grid">
              <div className="chart-card chart-card--wide"><h3>Agent Performance</h3><AgentTable agents={data.agentPerformance} /></div>
              <div className="chart-card"><h3>Recent Activity</h3><ActivityFeed activities={data.recentActivity} /></div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
