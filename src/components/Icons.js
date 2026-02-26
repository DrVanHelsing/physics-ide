/**
 * Icons.js — lightweight inline SVG icon components.
 * No emojis. All icons are simple professional SVGs.
 */
import React from "react";

const s = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };

export const PlayIcon = () => (
  <svg {...s}><polygon points="5 3 19 12 5 21 5 3" fill="currentColor" stroke="none"/></svg>
);

export const DownloadIcon = () => (
  <svg {...s}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
);

export const PackageIcon = () => (
  <svg {...s}><path d="M16.5 9.4l-9-5.19"/><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
);

export const RefreshIcon = () => (
  <svg {...s}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
);

export const BlocksIcon = () => (
  <svg {...s}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
);

export const CodeIcon = () => (
  <svg {...s}><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
);

export const SunIcon = () => (
  <svg {...s}><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
);

export const MoonIcon = () => (
  <svg {...s}><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
);

export const RocketIcon = () => (
  <svg {...s}><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>
);

export const AtomIcon = () => (
  <svg {...s} strokeWidth={1.5}>
    <circle cx="12" cy="12" r="2" fill="currentColor"/>
    <ellipse cx="12" cy="12" rx="10" ry="4"/>
    <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/>
    <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)"/>
  </svg>
);

export const PlusIcon = () => (
  <svg {...s}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
);

export const GlobeIcon = () => (
  <svg {...s}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
);

export const ZapIcon = () => (
  <svg {...s}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor" stroke="none"/></svg>
);

export const SpringIcon = () => (
  <svg {...s} strokeWidth={1.5}><path d="M4 4c2 0 2 4 4 4s2-4 4-4 2 4 4 4 2-4 4-4" transform="translate(0 8)"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/></svg>
);

export const StopIcon = () => (
  <svg {...s}><rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" stroke="none"/></svg>
);

export const HomeIcon = ({ size } = {}) => (
  <svg {...s} width={size || 16} height={size || 16}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
);

export const FileTextIcon = ({ size } = {}) => (
  <svg {...s} width={size || 16} height={size || 16}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
);

export const SeparatorDot = () => (
  <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--border-hl)', margin: '0 2px', flexShrink: 0 }} />
);

export const HelpIcon = ({ size } = {}) => (
  <svg {...s} width={size || 16} height={size || 16}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
);

export const BookOpenIcon = ({ size } = {}) => (
  <svg {...s} width={size || 16} height={size || 16}><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>
);

export const ChevronRightIcon = ({ size } = {}) => (
  <svg {...s} width={size || 16} height={size || 16}><polyline points="9 18 15 12 9 6"/></svg>
);

export const ZapOffIcon = ({ size } = {}) => (
  <svg {...s} width={size || 16} height={size || 16}><polyline points="12.41 6.75 13 2 10.57 4.92"/><polyline points="18.57 12.91 21 10 15.66 10"/><polyline points="8 8 3 14 12 14 11 22 16 16"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
);

export const FileCodeIcon = ({ size } = {}) => (
  <svg {...s} width={size || 16} height={size || 16}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="10 15 8 12 10 9"/><polyline points="14 9 16 12 14 15"/></svg>
);

export const FileBlocksIcon = ({ size } = {}) => (
  <svg {...s} width={size || 16} height={size || 16}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><rect x="8" y="11" width="3.5" height="3.5" rx="0.5"/><rect x="12.5" y="11" width="3.5" height="3.5" rx="0.5"/><rect x="8" y="15.5" width="3.5" height="3.5" rx="0.5"/><rect x="12.5" y="15.5" width="3.5" height="3.5" rx="0.5"/></svg>
);

export const LayersIcon = ({ size } = {}) => (
  <svg {...s} width={size || 16} height={size || 16}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
);

export const EditIcon = ({ size } = {}) => (
  <svg {...s} width={size || 16} height={size || 16}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
);

export const UsersIcon = ({ size } = {}) => (
  <svg {...s} width={size || 16} height={size || 16}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
);

export const SettingsIcon = ({ size } = {}) => (
  <svg {...s} width={size || 16} height={size || 16}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
);

export const FolderIcon = ({ size } = {}) => (
  <svg {...s} width={size || 16} height={size || 16}><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
);

export const SearchIcon = ({ size } = {}) => (
  <svg {...s} width={size || 16} height={size || 16}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
);

export const TerminalIcon = ({ size } = {}) => (
  <svg {...s} width={size || 16} height={size || 16}><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
);

export const GitBranchIcon = ({ size } = {}) => (
  <svg {...s} width={size || 16} height={size || 16}><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 01-9 9"/></svg>
);

export const ChevronDownIcon = ({ size } = {}) => (
  <svg {...s} width={size || 16} height={size || 16}><polyline points="6 9 12 15 18 9"/></svg>
);

export const XIcon = ({ size } = {}) => (
  <svg {...s} width={size || 16} height={size || 16}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
);

export const MaximizeIcon = ({ size } = {}) => (
  <svg {...s} width={size || 16} height={size || 16}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
);

export const MinimizeIcon = ({ size } = {}) => (
  <svg {...s} width={size || 16} height={size || 16}><line x1="5" y1="12" x2="19" y2="12"/></svg>
);


