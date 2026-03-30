# Product Requirements Document: System Status Dashboard Widget

**Project:** [TEST] E2E-65 — Multi-stage webapp pipeline full
**Author:** Alan (automated)
**Date:** 2026-03-30
**Status:** Draft

---

## 1. Problem Statement

Operations and development teams currently lack a lightweight, at-a-glance view of critical system health metrics. Checking uptime, memory usage, and disk space requires SSH access or navigating multiple monitoring tools. This creates friction for quick health checks and delays incident detection for small-to-medium deployments where a full observability stack (Datadog, Grafana) is overkill.

A single-page dashboard widget that surfaces the three most critical system metrics — uptime, memory, and disk — with colour-coded status indicators will reduce time-to-awareness from minutes to seconds and eliminate the need for terminal access for routine health checks.

## 2. Target User

- **Primary:** DevOps engineers and system administrators responsible for server health on small-to-medium deployments.
- **Secondary:** Developers running local or staging environments who want a quick visual check without opening a terminal.
- **Tertiary:** Team leads or project managers who need a non-technical health snapshot during standups or incident triage.

## 3. Core Features (MVP)

### 3.1 Display System Uptime
Show how long the system has been running since last boot, displayed in a human-readable format (e.g., "4d 12h 33m").

### 3.2 Display Memory Usage
Show current memory consumption as used/total with a percentage bar (e.g., "6.2 GB / 16.0 GB — 39%").

### 3.3 Display Disk Space
Show current disk usage for the root partition as used/total with a percentage bar (e.g., "42.1 GB / 100.0 GB — 42%").

### 3.4 Single-Page React Component
The entire dashboard renders as a single React page/component tree. No routing required. Embeddable in a larger app or served standalone.

### 3.5 Auto-Refresh Every 30 Seconds
The dashboard polls the backend API every 30 seconds and updates all displayed metrics without a full page reload. A visible countdown timer shows seconds until next refresh.

### 3.6 Green/Amber/Red Status Indicator
Each metric card displays a colour-coded indicator based on configurable thresholds:

| Metric | Green | Amber | Red |
|--------|-------|-------|-----|
| Uptime | ≥ 24h | 1h–24h | < 1h |
| Memory | < 70% | 70%–90% | > 90% |
| Disk | < 75% | 75%–90% | > 90% |

An overall status indicator reflects the worst status across all metrics.

## 4. Data Model

The backend API returns a single JSON payload:

```json
{
  "timestamp": "2026-03-30T18:00:00Z",
  "uptime": {
    "seconds": 389400,
    "display": "4d 12h 10m",
    "status": "green"
  },
  "memory": {
    "used_bytes": 6652166144,
    "total_bytes": 17179869184,
    "percent": 38.7,
    "display": "6.2 GB / 16.0 GB",
    "status": "green"
  },
  "disk": {
    "used_bytes": 45208182784,
    "total_bytes": 107374182400,
    "percent": 42.1,
    "display": "42.1 GB / 100.0 GB",
    "status": "green"
  },
  "overall_status": "green"
}
```

**Field definitions:**

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | ISO 8601 string | Server time when metrics were collected |
| `uptime.seconds` | integer | Seconds since last boot |
| `uptime.display` | string | Human-readable uptime |
| `uptime.status` | enum: green/amber/red | Threshold-based status |
| `memory.used_bytes` | integer | Bytes of memory in use |
| `memory.total_bytes` | integer | Total system memory in bytes |
| `memory.percent` | float | Usage percentage (0–100) |
| `memory.display` | string | Human-readable "used / total" |
| `memory.status` | enum: green/amber/red | Threshold-based status |
| `disk.used_bytes` | integer | Bytes of disk in use |
| `disk.total_bytes` | integer | Total disk capacity in bytes |
| `disk.percent` | float | Usage percentage (0–100) |
| `disk.display` | string | Human-readable "used / total" |
| `disk.status` | enum: green/amber/red | Threshold-based status |
| `overall_status` | enum: green/amber/red | Worst status across all metrics |

## 5. Page/Component Breakdown

```
StatusDashboard
├── RefreshTimer
├── StatusCard (uptime)
│   └── StatusIndicator
├── StatusCard (memory)
│   └── StatusIndicator
└── StatusCard (disk)
    └── StatusIndicator
```

### StatusDashboard
- Root container component
- Manages API polling lifecycle (fetch on mount, then every 30s)
- Holds all metric state
- Displays overall status indicator in the header
- Renders three `StatusCard` children and one `RefreshTimer`

### StatusCard
- Reusable card component accepting a metric object as props
- Displays: metric label, value (human-readable), percentage bar (for memory/disk), and a `StatusIndicator`
- Props: `title: string`, `value: string`, `percent?: number`, `status: 'green' | 'amber' | 'red'`

### StatusIndicator
- Small visual component rendering a coloured dot/badge
- Props: `status: 'green' | 'amber' | 'red'`
- Renders with appropriate ARIA label for accessibility (e.g., `aria-label="Status: green"`)

### RefreshTimer
- Displays a countdown in seconds until the next API poll
- Props: `intervalSeconds: number`, `onRefresh: () => void`
- Resets to `intervalSeconds` after each refresh cycle

## 6. Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend framework | React 18+ | Functional components, hooks |
| Styling | Tailwind CSS | Utility-first; minimal custom CSS |
| Build tool | Vite | Fast dev server and production builds |
| Backend runtime | Node.js 18+ | |
| Backend framework | Express.js | Single `/api/status` endpoint |
| System metrics | `os` module (Node.js) + `check-disk-space` | Cross-platform where possible |
| Testing (frontend) | Vitest + React Testing Library | Component and integration tests |
| Testing (backend) | Vitest or Jest | API endpoint tests |
| Linting | ESLint + Prettier | Standard config |

## 7. Acceptance Criteria per Feature

### 7.1 Display System Uptime
- [ ] Uptime value is displayed on the dashboard in human-readable format (days, hours, minutes)
- [ ] Uptime updates on each 30-second refresh cycle
- [ ] Uptime of 0 seconds displays as "0m"

### 7.2 Display Memory Usage
- [ ] Memory card shows used and total memory in GB (1 decimal place)
- [ ] Memory card shows a percentage value
- [ ] A visual progress/percentage bar reflects the current percentage
- [ ] Values match the backend API response

### 7.3 Display Disk Space
- [ ] Disk card shows used and total disk space in GB (1 decimal place)
- [ ] Disk card shows a percentage value
- [ ] A visual progress/percentage bar reflects the current percentage
- [ ] Values match the backend API response

### 7.4 Single-Page React Component
- [ ] The dashboard renders as a single page without routing
- [ ] All three metric cards are visible without scrolling on a 1280×720 viewport
- [ ] The component can be imported and rendered inside another React app

### 7.5 Auto-Refresh Every 30 Seconds
- [ ] Dashboard fetches `/api/status` on initial mount
- [ ] Dashboard re-fetches every 30 seconds automatically
- [ ] A visible countdown timer shows seconds remaining until next refresh
- [ ] Timer resets to 30 after each successful fetch
- [ ] If the API call fails, the previous data remains displayed and an error indicator appears

### 7.6 Green/Amber/Red Status Indicator
- [ ] Each metric card displays a coloured status dot: green, amber, or red
- [ ] Colours match the threshold table defined in section 3.6
- [ ] An overall status indicator in the dashboard header shows the worst status
- [ ] Status indicators have appropriate ARIA labels for screen readers
- [ ] Colour rendering is distinguishable (not reliant solely on colour — includes text label or icon)

## 8. Out of Scope

The following are explicitly **not** included in the MVP:

- **Authentication / authorization** — The dashboard is unauthenticated; securing it is a deployment concern
- **Multi-server monitoring** — Only the local host is monitored; no agent/collector model
- **Historical data / time-series** — No data persistence; only current-moment metrics
- **Alerting / notifications** — No email, Slack, PagerDuty, or webhook alerts
- **Mobile-native app** — Web-only; responsive design is a nice-to-have but not required for MVP
- **Custom threshold configuration UI** — Thresholds are hardcoded; configuration via environment variables may be added post-MVP
- **CPU usage** — Not included in MVP metrics (candidate for v2)
- **Network I/O metrics** — Not included in MVP
- **Docker / container metrics** — Host-level only
- **Dark mode / theming** — Single theme for MVP
