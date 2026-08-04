/**
 * audit-history.js - SEO Audit History Module
 * Complete history management for performance audit reports
 */

import { FB } from './firebase.js';
import { getUser, isAdmin } from './auth.js';
import { safeStr, formatDate } from './utils.js';
import { showToast, openModal, closeModal } from './ui.js';

let _cache = [];
let _comparisonSelection = [];

// ── SAVE REPORT TO FIRESTORE ──────────────────────────────────
export async function saveReport(auditData, aiAnalysis) {
  const user = getUser();
  if (!user) throw new Error('User not authenticated.');
  
  const reportData = {
    userId: user.uid,
    websiteUrl: auditData.url,
    pageTitle: _extractPageTitle(auditData.url),
    strategy: auditData.strategy,
    analysisDate: new Date().toISOString().split('T')[0],
    analysisTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
    
    // Main Scores
    performanceScore: auditData.scores.performance,
    accessibilityScore: auditData.scores.accessibility,
    bestPracticesScore: auditData.scores.bestPractices,
    seoScore: auditData.scores.seo,
    
    // Core Web Vitals
    coreWebVitals: {
      lcp: auditData.coreWebVitals.lcp,
      fcp: auditData.coreWebVitals.fcp,
      cls: auditData.coreWebVitals.cls,
      ttfb: auditData.coreWebVitals.ttfb,
      speedIndex: auditData.coreWebVitals.speedIndex,
      inp: auditData.coreWebVitals.inp
    },
    
    // Performance Data
    opportunities: auditData.opportunities.map(o => ({
      id: o.id,
      title: o.title,
      description: o.description,
      displayValue: o.displayValue,
      score: o.score
    })),
    diagnostics: auditData.diagnostics.map(d => ({
      id: d.id,
      title: d.title,
      description: d.description,
      displayValue: d.displayValue,
      score: d.score
    })),
    passedAuditsCount: auditData.passed.length,
    
    // AI Analysis (if available)
    aiAnalysis: aiAnalysis ? {
      executiveSummary: aiAnalysis.executiveSummary,
      criticalIssues: aiAnalysis.criticalIssues || [],
      highPriorityFixes: aiAnalysis.highPriorityFixes || [],
      mediumPriorityFixes: aiAnalysis.mediumPriorityFixes || [],
      lowPriorityFixes: aiAnalysis.lowPriorityFixes || [],
      quickWins: aiAnalysis.quickWins || [],
      performanceRoadmap: aiAnalysis.performanceRoadmap || null
    } : null,
    
    timestamp: Date.now(),
    createdAt: FB.serverTimestamp(),
    createdBy: user.email || ''
  };
  
  try {
    const docRef = await FB.addDoc(FB.col('seo_audit_history'), reportData);
    showToast('Performance audit report saved!');
    return docRef.id;
  } catch (error) {
    console.error('[AuditHistory] Save error:', error);
    throw new Error('Failed to save report: ' + error.message);
  }
}

// ── GET LATEST REPORT FOR A PRODUCT ─────────────────────────
export async function getLatestReportForProduct(product) {
  try {
    // Fetch recent reports for the current user
    const user = getUser();
    if (!user) return null;

    const q = FB.query(
      FB.col('seo_audit_history'),
      FB.where('userId', '==', user.uid),
      FB.orderBy('timestamp', 'desc'),
      FB.limit(100)
    );

    const snap = await FB.getDocs(q);
    const reports = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const slug = (product.seo_slug || '').toLowerCase();
    const name = (product.productName || '').toLowerCase();

    // Try to find by slug first, then by name, then by exact URL match
    for (const r of reports) {
      const url = (r.websiteUrl || '').toLowerCase();
      if (slug && url.includes(slug)) return r;
    }
    for (const r of reports) {
      const url = (r.websiteUrl || '').toLowerCase();
      if (name && url.includes(name)) return r;
    }
    return null;
  } catch (e) {
    console.error('[AuditHistory] getLatestReportForProduct error:', e);
    return null;
  }
}

// ── OPEN COMPARISON MODAL FOR TWO REPORT OBJECTS ─────────────
export function openComparisonModalForReports(reportA, reportB) {
  try {
    const modalTitle = document.getElementById('comparison-modal-title');
    const modalBody = document.getElementById('comparison-modal-body');
    if (!modalTitle || !modalBody) return;
    modalTitle.textContent = 'Product Performance Comparison';
    modalBody.innerHTML = _renderComparison(reportA, reportB);
    openModal('comparison-modal');
  } catch (e) {
    console.error('[AuditHistory] openComparisonModalForReports error:', e);
  }
}

// ── EXTRACT PAGE TITLE FROM URL ───────────────────────────────
function _extractPageTitle(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace('www.', '');
    const pathname = urlObj.pathname;
    if (pathname === '/' || pathname === '') {
      return hostname;
    }
    // Extract meaningful title from path
    const parts = pathname.split('/').filter(Boolean);
    const lastPart = parts[parts.length - 1];
    return lastPart
      .replace(/\.(html|php|asp|jsp)$/i, '')
      .replace(/[-_]/g, ' ')
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
      .substring(0, 60);
  } catch {
    return url.substring(0, 60);
  }
}

// ── RENDER HISTORY PAGE ───────────────────────────────────────
export async function render() {
  const container = document.getElementById('audit-history-container') || document.getElementById('audit-history-list');
  if (!container) return;
  
  container.innerHTML = '<p class="empty-msg" style="text-align:center;padding:2rem">Loading reports from Firebase...</p>';
  
  const reports = await _fetchAllReports();
  console.log('[AuditHistory] render: fetched reports count =', reports?.length || 0);
  _cache = reports;
  
  if (!reports.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:3rem">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="1.5" style="margin-bottom:1rem">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p style="color:var(--text2);font-size:.95rem;margin-bottom:1rem">No saved SEO Audit reports yet</p>
        <button class="btn btn-accent" onclick="window.App.go('audit')">Analyze Website</button>
      </div>
    `;
    return;
  }
  
  _renderReportsList(reports);
}

// ── RENDER REPORTS LIST ───────────────────────────────────────
function _renderReportsList(reports) {
  const container = document.getElementById('audit-history-container') || document.getElementById('audit-history-list');
  
  const reportsHtml = reports.map((report, idx) => {
    const avgScore = Math.round(
      (report.performanceScore + report.accessibilityScore + report.bestPracticesScore + report.seoScore) / 4
    );
    
    const priorityClass = report.aiAnalysis?.executiveSummary?.priorityLevel?.toLowerCase() || 'medium';
    const priorityBadge = report.aiAnalysis?.executiveSummary?.priorityLevel || 'N/A';
    const projectedScore = report.aiAnalysis?.executiveSummary?.projectedScore || null;
    const isSelected = _comparisonSelection.some(r => r.id === report.id);
    
    return `
      <div class="audit-history-item ${isSelected ? 'selected' : ''}" onclick="window.AuditHistory.openReport(${idx})">
        <div class="comparison-checkbox" onclick="event.stopPropagation();window.AuditHistory.selectForComparison(${idx})">
          <input type="checkbox" ${isSelected ? 'checked' : ''} />
          <label>Compare</label>
        </div>
        <div class="audit-history-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <div class="audit-history-info">
          <h4>${safeStr(report.pageTitle)}</h4>
          <p class="audit-history-url">${safeStr(report.websiteUrl)}</p>
          <div class="audit-history-meta">
            <span>${report.analysisDate}</span>
            <span>•</span>
            <span>${report.analysisTime}</span>
            <span>•</span>
            <span class="strategy-badge-small">${report.strategy === 'mobile' ? '📱 Mobile' : '💻 Desktop'}</span>
          </div>
        </div>
        <div class="audit-history-scores">
          <div class="mini-score-grid">
            <div class="mini-score ${_getScoreClass(report.performanceScore)}">
              <div class="mini-score-label">Performance</div>
              <div class="mini-score-value">${report.performanceScore}</div>
            </div>
            <div class="mini-score ${_getScoreClass(report.accessibilityScore)}">
              <div class="mini-score-label">Accessibility</div>
              <div class="mini-score-value">${report.accessibilityScore}</div>
            </div>
            <div class="mini-score ${_getScoreClass(report.bestPracticesScore)}">
              <div class="mini-score-label">Best Practices</div>
              <div class="mini-score-value">${report.bestPracticesScore}</div>
            </div>
            <div class="mini-score ${_getScoreClass(report.seoScore)}">
              <div class="mini-score-label">SEO</div>
              <div class="mini-score-value">${report.seoScore}</div>
            </div>
          </div>
        </div>
        <div class="audit-history-badges">
          ${report.aiAnalysis ? '<span class="ai-badge">🤖 AI Generated</span>' : ''}
          <span class="priority-badge priority-${priorityClass}">Priority: ${priorityBadge}</span>
          ${projectedScore ? `<span class="projected-badge">Projected: ${projectedScore}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
  
  container.innerHTML = `
    <div class="audit-history-toolbar">
      <input type="text" id="audit-hist-search" placeholder="Search by URL or title..." oninput="window.AuditHistory.applyFilters()"/>
      <select id="audit-hist-strategy" onchange="window.AuditHistory.applyFilters()">
        <option value="">All Strategies</option>
        <option value="mobile">Mobile</option>
        <option value="desktop">Desktop</option>
      </select>
      <select id="audit-hist-sort" onchange="window.AuditHistory.applyFilters()">
        <option value="latest">Latest First</option>
        <option value="oldest">Oldest First</option>
        <option value="highest">Highest Performance</option>
        <option value="lowest">Lowest Performance</option>
      </select>
      <select id="audit-hist-priority" onchange="window.AuditHistory.applyFilters()">
        <option value="">All Priorities</option>
        <option value="critical">Critical</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
      <button class="btn btn-outline btn-sm" onclick="window.AuditHistory.exportAllJSON()">Export All</button>
      ${isAdmin() ? '<button class="btn btn-danger btn-sm" onclick="window.AuditHistory.clearAllReports()">Clear All</button>' : ''}
    </div>
    <div class="audit-history-list">${reportsHtml}</div>
  `;
}

// ── GET SCORE CLASS ───────────────────────────────────────────
function _getScoreClass(score) {
  if (score >= 90) return 'score-good';
  if (score >= 50) return 'score-medium';
  return 'score-poor';
}

// ── APPLY FILTERS ─────────────────────────────────────────────
export function applyFilters() {
  const search = (document.getElementById('audit-hist-search')?.value || '').toLowerCase();
  const strategyFilter = document.getElementById('audit-hist-strategy')?.value || '';
  const sortBy = document.getElementById('audit-hist-sort')?.value || 'latest';
  const priorityFilter = document.getElementById('audit-hist-priority')?.value || '';
  
  let filtered = [..._cache];
  
  // Apply search filter
  if (search) {
    filtered = filtered.filter(r => 
      safeStr(r.websiteUrl).toLowerCase().includes(search) ||
      safeStr(r.pageTitle).toLowerCase().includes(search)
    );
  }
  
  // Apply strategy filter
  if (strategyFilter) {
    filtered = filtered.filter(r => r.strategy === strategyFilter);
  }
  
  // Apply priority filter
  if (priorityFilter) {
    filtered = filtered.filter(r => 
      r.aiAnalysis?.executiveSummary?.priorityLevel?.toLowerCase() === priorityFilter
    );
  }
  
  // Apply sorting
  filtered.sort((a, b) => {
    switch (sortBy) {
      case 'oldest':
        return (a.timestamp || 0) - (b.timestamp || 0);
      case 'highest':
        return b.performanceScore - a.performanceScore;
      case 'lowest':
        return a.performanceScore - b.performanceScore;
      case 'latest':
      default:
        return (b.timestamp || 0) - (a.timestamp || 0);
    }
  });
  
  _renderReportsList(filtered);
}

// ── OPEN REPORT DETAIL MODAL ──────────────────────────────────
export function openReport(idx) {
  const report = _cache[idx];
  if (!report) return;
  
  const modalTitle = document.getElementById('audit-report-modal-title');
  const modalBody = document.getElementById('audit-report-modal-body');
  
  if (!modalTitle || !modalBody) {
    console.error('[AuditHistory] Modal elements not found');
    return;
  }
  
  modalTitle.textContent = safeStr(report.pageTitle);
  modalBody.innerHTML = _renderReportDetail(report);
  
  openModal('audit-report-modal');
}

// ── RENDER REPORT DETAIL ──────────────────────────────────────
function _renderReportDetail(report) {
  const getScoreColor = (score) => {
    if (score >= 90) return '#10b981';
    if (score >= 50) return '#f59e0b';
    return '#ef4444';
  };
  
  // Header Section
  const headerHtml = `
    <div class="report-header">
      <div class="report-header-info">
        <h3>${safeStr(report.websiteUrl)}</h3>
        <div class="report-header-meta">
          <span>${report.analysisDate} • ${report.analysisTime}</span>
          <span class="strategy-badge">${report.strategy === 'mobile' ? '📱 Mobile' : '💻 Desktop'}</span>
        </div>
      </div>
      <div class="report-header-actions">
        <button class="btn btn-outline btn-sm" onclick="window.AuditHistory.exportReportPDF(${_cache.indexOf(report)})">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          PDF
        </button>
        <button class="btn btn-outline btn-sm" onclick="window.AuditHistory.exportReportJSON(${_cache.indexOf(report)})">JSON</button>
        ${isAdmin() ? `<button class="btn btn-danger btn-sm" onclick="window.AuditHistory.deleteReport('${report.id}')">Delete</button>` : ''}
      </div>
    </div>
  `;
  
  // Performance Scores Section
  const scoresHtml = `
    <div class="report-section">
      <h4>Performance Scores</h4>
      <div class="report-scores-grid">
        <div class="report-score-card" style="border-left-color: ${getScoreColor(report.performanceScore)}">
          <div class="report-score-label">Performance</div>
          <div class="report-score-value" style="color: ${getScoreColor(report.performanceScore)}">${report.performanceScore}</div>
        </div>
        <div class="report-score-card" style="border-left-color: ${getScoreColor(report.accessibilityScore)}">
          <div class="report-score-label">Accessibility</div>
          <div class="report-score-value" style="color: ${getScoreColor(report.accessibilityScore)}">${report.accessibilityScore}</div>
        </div>
        <div class="report-score-card" style="border-left-color: ${getScoreColor(report.bestPracticesScore)}">
          <div class="report-score-label">Best Practices</div>
          <div class="report-score-value" style="color: ${getScoreColor(report.bestPracticesScore)}">${report.bestPracticesScore}</div>
        </div>
        <div class="report-score-card" style="border-left-color: ${getScoreColor(report.seoScore)}">
          <div class="report-score-label">SEO</div>
          <div class="report-score-value" style="color: ${getScoreColor(report.seoScore)}">${report.seoScore}</div>
        </div>
      </div>
    </div>
  `;
  
  // AI Summary Section
  let aiSummaryHtml = '';
  if (report.aiAnalysis && report.aiAnalysis.executiveSummary) {
    const summary = report.aiAnalysis.executiveSummary;
    aiSummaryHtml = `
      <div class="report-section ai-section">
        <h4>🤖 AI Performance Summary</h4>
        <div class="ai-executive-summary">
          <div class="ai-summary-scores">
            <div class="ai-summary-score-box">
              <div class="ai-summary-label">Current Score</div>
              <div class="ai-summary-value">${summary.currentScore}</div>
            </div>
            <div class="ai-summary-arrow">→</div>
            <div class="ai-summary-score-box projected">
              <div class="ai-summary-label">Projected Score</div>
              <div class="ai-summary-value">${summary.projectedScore}</div>
            </div>
          </div>
          <div class="ai-summary-meta">
            <div><strong>Priority:</strong> <span class="priority-badge priority-${summary.priorityLevel?.toLowerCase()}">${summary.priorityLevel}</span></div>
            <div><strong>Estimated Time:</strong> ${summary.estimatedTimeToFix}</div>
          </div>
          ${summary.keyIssues?.length ? `
            <div class="ai-summary-issues">
              <strong>Key Issues:</strong>
              <ul>${summary.keyIssues.map(issue => `<li>${issue}</li>`).join('')}</ul>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }
  
  // Core Web Vitals Section
  const cwvHtml = `
    <div class="report-section">
      <h4>Core Web Vitals</h4>
      <div class="report-cwv-grid">
        ${Object.entries(report.coreWebVitals).map(([key, metric]) => {
          const color = metric.score >= 0.9 ? '#10b981' : metric.score >= 0.5 ? '#f59e0b' : '#ef4444';
          return `
            <div class="report-cwv-item" style="border-left-color: ${color}">
              <div class="report-cwv-title">${metric.title}</div>
              <div class="report-cwv-value" style="color: ${color}">${metric.displayValue}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
  
  // Critical Issues Section
  let criticalIssuesHtml = '';
  if (report.aiAnalysis && report.aiAnalysis.criticalIssues?.length > 0) {
    criticalIssuesHtml = `
      <div class="report-section">
        <h4>🚨 Critical Issues</h4>
        ${report.aiAnalysis.criticalIssues.map(issue => `
          <div class="report-issue critical">
            <div class="report-issue-header">
              <h5>${issue.title}</h5>
              <div class="report-issue-badges">
                <span class="difficulty-badge ${issue.difficulty?.toLowerCase()}">${issue.difficulty}</span>
                <span class="time-badge">${issue.timeRequired}</span>
                <span class="improvement-badge">${issue.expectedImprovement}</span>
              </div>
            </div>
            <div class="report-issue-body">
              <p><strong>Issue:</strong> ${issue.description}</p>
              <p><strong>Impact:</strong> ${issue.impact}</p>
              <p><strong>Root Cause:</strong> ${issue.rootCause}</p>
              <p><strong>Solution:</strong> ${issue.solution}</p>
              ${issue.codeExample ? `<pre class="code-example"><code>${escapeHtml(issue.codeExample)}</code></pre>` : ''}
              ${issue.affectedMetrics?.length ? `<div class="affected-metrics"><strong>Affects:</strong> ${issue.affectedMetrics.join(', ')}</div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
  
  // Quick Wins Section
  let quickWinsHtml = '';
  if (report.aiAnalysis && report.aiAnalysis.quickWins?.length > 0) {
    quickWinsHtml = `
      <div class="report-section">
        <h4>⚡ Quick Wins (<30 min)</h4>
        ${report.aiAnalysis.quickWins.map(win => `
          <div class="report-quick-win">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <div>
              <div class="report-qw-title">${win.title}</div>
              <div class="report-qw-desc">${win.description}</div>
              <div class="report-qw-meta">${win.timeRequired} • ${win.expectedImprovement}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
  
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
  
  return headerHtml + scoresHtml + aiSummaryHtml + cwvHtml + criticalIssuesHtml + quickWinsHtml;
}

// ── EXPORT FUNCTIONS ──────────────────────────────────────────
export async function exportReportJSON(idx) {
  const report = _cache[idx];
  if (!report) return;
  
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `audit-report-${report.analysisDate}-${Date.now()}.json`;
  a.click();
  showToast('Report exported as JSON');
}

export async function exportReportPDF(idx) {
  const report = _cache[idx];
  if (!report) return;
  
  const win = window.open('', '_blank');
  win.document.write(_generatePDFHTML(report));
  win.document.close();
  setTimeout(() => win.print(), 500);
}

function _generatePDFHTML(report) {
  const avgScore = Math.round(
    (report.performanceScore + report.accessibilityScore + report.bestPracticesScore + report.seoScore) / 4
  );
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Performance Audit Report - ${report.pageTitle}</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; color: #0f172a; }
        h1 { font-size: 24px; margin-bottom: 10px; }
        h2 { font-size: 18px; margin-top: 30px; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px; }
        h3 { font-size: 16px; margin-top: 20px; }
        .header { margin-bottom: 30px; }
        .meta { color: #64748b; font-size: 14px; }
        .scores { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
        .score-card { text-align: center; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px; }
        .score-label { font-size: 12px; color: #64748b; margin-bottom: 5px; }
        .score-value { font-size: 32px; font-weight: bold; }
        .good { color: #10b981; }
        .medium { color: #f59e0b; }
        .poor { color: #ef4444; }
        .issue { margin: 15px 0; padding: 15px; border-left: 4px solid #ef4444; background: #fef2f2; }
        .issue h4 { margin-top: 0; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th { background: #f1f5f9; padding: 8px; text-align: left; font-size: 14px; }
        td { padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
        @media print { @page { margin: 20mm; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Performance Audit Report</h1>
        <div class="meta">
          <strong>Website:</strong> ${report.websiteUrl}<br/>
          <strong>Date:</strong> ${report.analysisDate} ${report.analysisTime}<br/>
          <strong>Strategy:</strong> ${report.strategy}<br/>
          <strong>Generated by:</strong> Abra Zylo AI SEO Portal
        </div>
      </div>
      
      <h2>Performance Scores</h2>
      <div class="scores">
        <div class="score-card">
          <div class="score-label">Performance</div>
          <div class="score-value ${report.performanceScore >= 90 ? 'good' : report.performanceScore >= 50 ? 'medium' : 'poor'}">
            ${report.performanceScore}
          </div>
        </div>
        <div class="score-card">
          <div class="score-label">Accessibility</div>
          <div class="score-value ${report.accessibilityScore >= 90 ? 'good' : report.accessibilityScore >= 50 ? 'medium' : 'poor'}">
            ${report.accessibilityScore}
          </div>
        </div>
        <div class="score-card">
          <div class="score-label">Best Practices</div>
          <div class="score-value ${report.bestPracticesScore >= 90 ? 'good' : report.bestPracticesScore >= 50 ? 'medium' : 'poor'}">
            ${report.bestPracticesScore}
          </div>
        </div>
        <div class="score-card">
          <div class="score-label">SEO</div>
          <div class="score-value ${report.seoScore >= 90 ? 'good' : report.seoScore >= 50 ? 'medium' : 'poor'}">
            ${report.seoScore}
          </div>
        </div>
      </div>
      
      ${report.aiAnalysis && report.aiAnalysis.criticalIssues?.length ? `
        <h2>Critical Issues</h2>
        ${report.aiAnalysis.criticalIssues.map(issue => `
          <div class="issue">
            <h4>${issue.title}</h4>
            <p><strong>Issue:</strong> ${issue.description}</p>
            <p><strong>Impact:</strong> ${issue.impact}</p>
            <p><strong>Solution:</strong> ${issue.solution}</p>
            <p><strong>Difficulty:</strong> ${issue.difficulty} | <strong>Time:</strong> ${issue.timeRequired} | <strong>Improvement:</strong> ${issue.expectedImprovement}</p>
          </div>
        `).join('')}
      ` : ''}
      
      <p style="font-size: 12px; color: #94a3b8; margin-top: 40px;">
        Generated by Abra Zylo AI SEO Portal • ${new Date().toISOString()}
      </p>
      
      <script>window.print();</script>
    </body>
    </html>
  `;
}

export function exportAllJSON() {
  const blob = new Blob(
    [JSON.stringify({ exported: new Date().toISOString(), count: _cache.length, reports: _cache }, null, 2)],
    { type: 'application/json' }
  );
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `audit-history-${Date.now()}.json`;
  a.click();
  showToast('All reports exported');
}

// ── DELETE FUNCTIONS ──────────────────────────────────────────
export async function deleteReport(reportId) {
  if (!isAdmin()) {
    showToast('Only administrators can delete reports.');
    return;
  }
  
  if (!confirm('Delete this performance audit report? This cannot be undone.')) return;
  
  try {
    await FB.deleteDoc(FB.docRef('seo_audit_history', reportId));
    closeModal('audit-report-modal');
    showToast('Report deleted');
    render();
  } catch (error) {
    showToast('Delete failed: ' + error.message);
  }
}

export async function clearAllReports() {
  if (!isAdmin()) return;
  if (!confirm('Delete ALL performance audit reports? This CANNOT be undone.')) return;
  
  try {
    const user = getUser();
    const q = FB.query(FB.col('seo_audit_history'), FB.where('userId', '==', user.uid));
    const snap = await FB.getDocs(q);
    await Promise.all(snap.docs.map(d => FB.deleteDoc(FB.docRef('seo_audit_history', d.id))));
    showToast('All reports cleared');
    render();
  } catch (error) {
    showToast('Error: ' + error.message);
  }
}

// ── FETCH REPORTS FROM FIRESTORE ──────────────────────────────
async function _fetchAllReports() {
  const user = getUser();
  if (!user) return [];
  
  try {
    const q = FB.query(
      FB.col('seo_audit_history'),
      FB.where('userId', '==', user.uid),
      FB.orderBy('timestamp', 'desc')
    );
    const snap = await FB.getDocs(q);
    const reports = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log('[AuditHistory] _fetchAllReports: user=', user?.email || user?.uid, 'count=', reports.length, 'ids=', reports.map(r => r.id));
    return reports;
  } catch (error) {
    console.error('[AuditHistory] Fetch error:', error);
    return [];
  }
}

// ── COMPARISON FEATURE ─────────────────────────────────────────
export function selectForComparison(idx) {
  const report = _cache[idx];
  if (!report) return;
  
  // Toggle selection
  const existingIdx = _comparisonSelection.findIndex(r => r.id === report.id);
  if (existingIdx > -1) {
    _comparisonSelection.splice(existingIdx, 1);
    showToast('Removed from comparison');
  } else {
    if (_comparisonSelection.length >= 2) {
      showToast('Maximum 2 reports can be compared. Please deselect one first.');
      return;
    }
    _comparisonSelection.push(report);
    showToast(`Selected for comparison (${_comparisonSelection.length}/2)`);
  }
  
  // Update UI to show selection state
  _renderReportsList(_cache);
  
  // If 2 selected, show compare button
  if (_comparisonSelection.length === 2) {
    _showCompareButton();
  }
}

function _showCompareButton() {
  const toolbar = document.querySelector('.audit-history-toolbar');
  if (!toolbar) return;
  
  // Remove existing compare button if any
  const existingBtn = document.getElementById('compare-btn');
  if (existingBtn) existingBtn.remove();
  
  // Add compare button
  const compareBtn = document.createElement('button');
  compareBtn.id = 'compare-btn';
  compareBtn.className = 'btn btn-accent btn-sm';
  compareBtn.textContent = 'Compare Selected';
  compareBtn.onclick = () => window.AuditHistory.compareReports();
  toolbar.appendChild(compareBtn);
}

export function compareReports() {
  if (_comparisonSelection.length !== 2) {
    showToast('Please select exactly 2 reports to compare.');
    return;
  }
  
  const [oldReport, newReport] = _comparisonSelection;
  
  // Determine which is older
  const isOldFirst = (oldReport.timestamp || 0) < (newReport.timestamp || 0);
  const older = isOldFirst ? oldReport : newReport;
  const newer = isOldFirst ? newReport : oldReport;
  
  const modalTitle = document.getElementById('comparison-modal-title');
  const modalBody = document.getElementById('comparison-modal-body');
  
  if (!modalTitle || !modalBody) {
    console.error('[AuditHistory] Comparison modal elements not found');
    return;
  }
  
  modalTitle.textContent = 'Performance Report Comparison';
  modalBody.innerHTML = _renderComparison(older, newer);
  
  openModal('comparison-modal');
}

function _renderComparison(oldReport, newReport) {
  const getScoreChange = (oldScore, newScore) => {
    const diff = newScore - oldScore;
    if (diff > 0) return `<span style="color:#10b981">+${diff}</span>`;
    if (diff < 0) return `<span style="color:#ef4444">${diff}</span>`;
    return '<span style="color:var(--text3)">±0</span>';
  };
  
  const getScoreColor = (score) => {
    if (score >= 90) return '#10b981';
    if (score >= 50) return '#f59e0b';
    return '#ef4444';
  };
  
  // Header
  const headerHtml = `
    <div class="comparison-header">
      <div class="comparison-report-card">
        <div class="comparison-report-label">Old Report</div>
        <div class="comparison-report-title">${safeStr(oldReport.pageTitle)}</div>
        <div class="comparison-report-date">${oldReport.analysisDate} ${oldReport.analysisTime}</div>
      </div>
      <div class="comparison-arrow">→</div>
      <div class="comparison-report-card new">
        <div class="comparison-report-label">New Report</div>
        <div class="comparison-report-title">${safeStr(newReport.pageTitle)}</div>
        <div class="comparison-report-date">${newReport.analysisDate} ${newReport.analysisTime}</div>
      </div>
    </div>
  `;
  
  // Score Comparison
  const scoresHtml = `
    <div class="comparison-section">
      <h4>Performance Scores</h4>
      <div class="comparison-scores-grid">
        <div class="comparison-score-row">
          <div class="comparison-score-label">Performance</div>
          <div class="comparison-score-old" style="color:${getScoreColor(oldReport.performanceScore)}">${oldReport.performanceScore}</div>
          <div class="comparison-score-arrow">→</div>
          <div class="comparison-score-new" style="color:${getScoreColor(newReport.performanceScore)}">${newReport.performanceScore}</div>
          <div class="comparison-score-change">${getScoreChange(oldReport.performanceScore, newReport.performanceScore)}</div>
        </div>
        <div class="comparison-score-row">
          <div class="comparison-score-label">Accessibility</div>
          <div class="comparison-score-old" style="color:${getScoreColor(oldReport.accessibilityScore)}">${oldReport.accessibilityScore}</div>
          <div class="comparison-score-arrow">→</div>
          <div class="comparison-score-new" style="color:${getScoreColor(newReport.accessibilityScore)}">${newReport.accessibilityScore}</div>
          <div class="comparison-score-change">${getScoreChange(oldReport.accessibilityScore, newReport.accessibilityScore)}</div>
        </div>
        <div class="comparison-score-row">
          <div class="comparison-score-label">Best Practices</div>
          <div class="comparison-score-old" style="color:${getScoreColor(oldReport.bestPracticesScore)}">${oldReport.bestPracticesScore}</div>
          <div class="comparison-score-arrow">→</div>
          <div class="comparison-score-new" style="color:${getScoreColor(newReport.bestPracticesScore)}">${newReport.bestPracticesScore}</div>
          <div class="comparison-score-change">${getScoreChange(oldReport.bestPracticesScore, newReport.bestPracticesScore)}</div>
        </div>
        <div class="comparison-score-row">
          <div class="comparison-score-label">SEO</div>
          <div class="comparison-score-old" style="color:${getScoreColor(oldReport.seoScore)}">${oldReport.seoScore}</div>
          <div class="comparison-score-arrow">→</div>
          <div class="comparison-score-new" style="color:${getScoreColor(newReport.seoScore)}">${newReport.seoScore}</div>
          <div class="comparison-score-change">${getScoreChange(oldReport.seoScore, newReport.seoScore)}</div>
        </div>
      </div>
    </div>
  `;
  
  // AI Summary (if both have AI analysis)
  let aiSummaryHtml = '';
  if (oldReport.aiAnalysis && newReport.aiAnalysis) {
    const oldScore = oldReport.performanceScore;
    const newScore = newReport.performanceScore;
    const improvement = newScore - oldScore;
    
    // Generate AI comparison summary
    const summaryText = _generateComparisonSummary(oldReport, newReport, improvement);
    
    aiSummaryHtml = `
      <div class="comparison-section ai-comparison">
        <h4>🤖 AI Improvement Analysis</h4>
        <div class="ai-comparison-summary">
          <div class="ai-comparison-score-change">
            <span class="old-score">${oldScore}</span>
            <span class="arrow">→</span>
            <span class="new-score ${improvement > 0 ? 'improved' : improvement < 0 ? 'declined' : 'neutral'}">${newScore}</span>
            <span class="change-badge ${improvement > 0 ? 'positive' : improvement < 0 ? 'negative' : 'neutral'}">
              ${improvement > 0 ? '+' : ''}${improvement} points
            </span>
          </div>
          <div class="ai-comparison-text">${summaryText}</div>
        </div>
      </div>
    `;
  }
  
  // Core Web Vitals Comparison
  const cwvHtml = `
    <div class="comparison-section">
      <h4>Core Web Vitals</h4>
      <div class="comparison-cwv-grid">
        ${Object.keys(oldReport.coreWebVitals).map(key => {
          const oldMetric = oldReport.coreWebVitals[key];
          const newMetric = newReport.coreWebVitals[key];
          const oldColor = oldMetric.score >= 0.9 ? '#10b981' : oldMetric.score >= 0.5 ? '#f59e0b' : '#ef4444';
          const newColor = newMetric.score >= 0.9 ? '#10b981' : newMetric.score >= 0.5 ? '#f59e0b' : '#ef4444';
          
          return `
            <div class="comparison-cwv-row">
              <div class="comparison-cwv-label">${oldMetric.title}</div>
              <div class="comparison-cwv-old" style="color:${oldColor}">${oldMetric.displayValue}</div>
              <div class="comparison-cwv-arrow">→</div>
              <div class="comparison-cwv-new" style="color:${newColor}">${newMetric.displayValue}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
  
  return headerHtml + scoresHtml + aiSummaryHtml + cwvHtml;
}

function _generateComparisonSummary(oldReport, newReport, improvement) {
  const improved = improvement > 0;
  const declined = improvement < 0;
  const unchanged = improvement === 0;
  
  if (unchanged) {
    return 'Performance scores remained stable between the two audits. No significant changes detected.';
  }
  
  // Identify key improvements or declines
  const changes = [];
  
  // Check score changes
  if (newReport.performanceScore > oldReport.performanceScore) {
    changes.push('performance improved');
  } else if (newReport.performanceScore < oldReport.performanceScore) {
    changes.push('performance declined');
  }
  
  if (newReport.accessibilityScore > oldReport.accessibilityScore) {
    changes.push('accessibility improved');
  } else if (newReport.accessibilityScore < oldReport.accessibilityScore) {
    changes.push('accessibility declined');
  }
  
  // Check if critical issues were resolved
  const oldCriticalCount = oldReport.aiAnalysis?.criticalIssues?.length || 0;
  const newCriticalCount = newReport.aiAnalysis?.criticalIssues?.length || 0;
  
  if (newCriticalCount < oldCriticalCount) {
    changes.push(`${oldCriticalCount - newCriticalCount} critical issue${oldCriticalCount - newCriticalCount > 1 ? 's' : ''} resolved`);
  }
  
  // Check priority level changes
  const oldPriority = oldReport.aiAnalysis?.executiveSummary?.priorityLevel?.toLowerCase() || 'medium';
  const newPriority = newReport.aiAnalysis?.executiveSummary?.priorityLevel?.toLowerCase() || 'medium';
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  
  if (priorityOrder[newPriority] > priorityOrder[oldPriority]) {
    changes.push('priority level reduced');
  }
  
  if (improved) {
    const verb = changes.length > 0 ? 'after' : 'with';
    const changesText = changes.length > 0 ? ` ${verb} ${changes.join(', ')}` : '';
    return `Performance improved from ${oldReport.performanceScore} to ${newReport.performanceScore}${changesText}. ${Math.abs(improvement)} point${Math.abs(improvement) > 1 ? 's' : ''} gained overall.`;
  } else {
    const changesText = changes.length > 0 ? ` due to ${changes.join(', ')}` : '';
    return `Performance declined from ${oldReport.performanceScore} to ${newReport.performanceScore}${changesText}. ${Math.abs(improvement)} point${Math.abs(improvement) > 1 ? 's' : ''} lost overall.`;
  }
}

export function clearComparisonSelection() {
  _comparisonSelection = [];
  const compareBtn = document.getElementById('compare-btn');
  if (compareBtn) compareBtn.remove();
  _renderReportsList(_cache);
  showToast('Comparison selection cleared');
}
