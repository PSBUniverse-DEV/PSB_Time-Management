<!DOCTYPE html><html lang="en" style=""><head>
<meta charset="utf-8">
<meta content="width=device-width, initial-scale=1.0" name="viewport">
<title>Time Tracker - Workday Activity</title>
<!-- Tailwind CSS v3 with Forms & Container Queries -->
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<!-- Tailwind Custom Configuration -->
<script data-purpose="tailwind-config">
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            spruce: {
              50: '#f0f6f6',
              100: '#dcebec',
              200: '#bcd7d9',
              300: '#91bcc0',
              400: '#5e9ba1',
              500: '#3d7e85',
              600: '#2c646b',
              700: '#235056',
              800: '#1c444d', /* Primary deep spruce */
              900: '#16383e', /* Darkest tone from reference */
              950: '#0e2327',
            },
            forest: {
              600: '#1e6052',
              700: '#174e42',
              800: '#123d34',
            },
            appbg: '#f3f7f7',
            cardbg: '#ffffff',
          },
          fontFamily: {
            sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
            mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
          },
          boxShadow: {
            'subtle': '0 1px 3px 0 rgba(22, 56, 62, 0.05), 0 1px 2px 0 rgba(22, 56, 62, 0.03)',
            'card': '0 4px 16px -2px rgba(28, 68, 77, 0.08), 0 2px 6px -1px rgba(28, 68, 77, 0.04)',
            'modal': '0 20px 25px -5px rgba(22, 56, 62, 0.18), 0 10px 10px -5px rgba(22, 56, 62, 0.08)',
          }
        }
      }
    };
  </script>
<!-- Google Fonts -->
<link href="https://fonts.googleapis.com" rel="preconnect">
<link crossorigin="" href="https://fonts.gstatic.com" rel="preconnect">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;family=JetBrains+Mono:wght@500;600;700&amp;display=swap" rel="stylesheet">
<!-- Core Component Styles -->
<style data-purpose="base-styling">
    body {
      font-family: 'Inter', sans-serif;
      background-color: #f3f7f7;
      color: #1a2e33;
      -webkit-font-smoothing: antialiased;
    }
    .font-mono-num {
      font-family: 'JetBrains Mono', monospace;
      font-feature-settings: "tnum" 1;
    }
  </style>
<style data-purpose="interactive-micro-animations">
    .transition-smooth {
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .pulse-dot {
      animation: softPulse 2s infinite cubic-bezier(0.4, 0, 0.6, 1);
    }
    @keyframes softPulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.9); }
    }
    /* Subtle custom scrollbar */
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    ::-webkit-scrollbar-track {
      background: #eef3f4;
    }
    ::-webkit-scrollbar-thumb {
      background: #c3d5d7;
      border-radius: 9999px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: #9dbbc0;
    }
  </style>
</head>
<body class="min-h-screen w-full grid grid-cols-1 xl:grid-cols-[280px_1fr_340px] antialiased selection:bg-spruce-100 selection:text-spruce-900 bg-white" style="display: grid; grid-template-columns: 260px minmax(0px, 1fr) 340px; grid-template-rows: repeat(1, 1fr); gap: 0px;">
<!-- BEGIN: Column 1 - AsideNavigation -->
<aside aria-label="Sidebar Navigation" class="col-span-1 w-full bg-white border-r border-[#e1ebec] flex flex-col xl:h-screen xl:sticky xl:top-0 z-30 shadow-subtle overflow-y-auto">
<!-- Brand / Monogram Header -->
<div class="p-5 border-b border-[#e9f0f1]">
<div class="flex items-center gap-3">
<div class="w-10 h-10 rounded-xl bg-spruce-800 flex items-center justify-center text-white font-bold tracking-tight shadow-sm text-sm border border-spruce-700/40 shrink-0" data-purpose="brand-monogram">
        TT
      </div>
<div class="min-w-0">
<div class="flex items-center gap-2">
<span class="text-base font-bold tracking-tight text-spruce-900 leading-tight truncate">Time Tracker</span>
<span class="px-1.5 py-0.5 text-[10px] font-semibold bg-spruce-50 text-spruce-700 rounded border border-spruce-200 shrink-0">v2.4</span>
</div>
<p class="text-[10px] font-semibold tracking-wider text-spruce-600/80 uppercase truncate">Workday Activity</p>
</div>
</div>
</div>
<div class="p-4 space-y-4 flex-1">
<!-- Live Monospace Clock Card -->
<div class="flex items-center gap-3 px-3.5 py-2.5 bg-spruce-50/90 rounded-xl border border-spruce-100" data-purpose="live-clock-card">
<div class="relative flex items-center justify-center shrink-0">
<span class="w-2.5 h-2.5 rounded-full bg-emerald-500 pulse-dot"></span>
<span class="w-2.5 h-2.5 rounded-full bg-emerald-400 absolute animate-ping opacity-60"></span>
</div>
<div class="min-w-0">
<div class="flex items-baseline gap-1.5">
<span class="font-mono-num text-sm font-bold text-spruce-900 tracking-tight" id="digital-clock">01:28:31</span>
<span class="font-mono text-xs font-semibold text-spruce-700" id="digital-ampm">AM</span>
</div>
<div class="text-[10px] font-semibold text-spruce-600 uppercase tracking-wide truncate" id="digital-date">
          Wednesday, Sep 16, 2026
        </div>
</div>
</div>
<!-- Clock-in Status & Primary Action Card -->
<div class="p-3.5 bg-slate-50/80 border border-slate-200/80 rounded-2xl space-y-3">
<div class="flex items-center justify-between">
<div class="inline-flex items-center gap-2 px-2.5 py-1 bg-white border border-slate-200/80 rounded-full">
<span class="w-2 h-2 rounded-full bg-slate-400"></span>
<span class="text-xs font-semibold text-slate-600">Not Clocked In</span>
</div>
<span class="text-[10px] text-slate-400 font-medium">Not clocked in yet</span>
</div>
<button class="w-full inline-flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl bg-forest-600 hover:bg-forest-700 active:scale-95 text-white font-semibold text-sm shadow-sm hover:shadow transition-all duration-150 group" id="clock-btn" type="button">
<svg class="w-4 h-4 text-emerald-200 transition-transform group-hover:rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2"></path>
</svg>
<span class="">Clock In</span>
</button>
</div>
<!-- Navigation Links -->
<nav aria-label="Primary Navigation" class="space-y-1 pt-1">
<div class="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">Navigation</div>
<a aria-current="page" class="flex items-center gap-3 px-3.5 py-2.5 text-xs font-bold rounded-xl bg-spruce-800 text-white shadow-sm transition-all" href="#">
<svg class="w-4 h-4 text-spruce-200 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
</svg>
<span class="">Logs</span>
</a>
<a class="flex items-center gap-3 px-3.5 py-2.5 text-xs font-semibold text-slate-600 hover:text-spruce-800 hover:bg-slate-100/70 rounded-xl transition-all" href="#">
<svg class="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
</svg>
<span class="">Timesheet</span>
</a>
<a class="flex items-center gap-3 px-3.5 py-2.5 text-xs font-semibold text-slate-600 hover:text-spruce-800 hover:bg-slate-100/70 rounded-xl transition-all" href="#">
<svg class="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
</svg>
<span class="">Approvals</span>
</a>
</nav>
</div>
<!-- Bottom / Footer of aside nav -->

</aside>
<!-- END: Column 1 - AsideNavigation -->
<!-- BEGIN: Column 2 - MainContent Area -->
<main class="col-span-1 min-w-0 overflow-y-auto bg-white flex flex-col">
<!-- BEGIN: TimesheetTableContainer -->
<section aria-label="Timesheet Data" class="bg-white overflow-hidden w-full flex-1 flex flex-col">
<!-- Table Header Bar with Date Navigation and Export Action -->
<div class="p-5 sm:px-7 sm:py-5 border-b border-[#e9f0f1] bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
<!-- Left: Week Navigation Controls -->
<div class="flex items-center gap-2 sm:gap-3">
<div class="inline-flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
<!-- Prev Week Button -->
<button aria-label="Previous Week" class="p-1.5 rounded-lg text-slate-500 hover:text-spruce-900 hover:bg-slate-100 transition" type="button">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path d="M15 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"></path>
</svg>
</button>
<div class="h-4 w-px bg-slate-200 mx-1"></div>
<!-- Next Week Button -->
<button aria-label="Next Week" class="p-1.5 rounded-lg text-slate-500 hover:text-spruce-900 hover:bg-slate-100 transition" type="button">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path d="M9 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"></path>
</svg>
</button>
</div>
<!-- Active Period Label -->
<h2 class="text-sm sm:text-base font-semibold text-slate-800 tracking-tight flex items-center gap-1.5"><span class="text-slate-500 font-normal">Time Log for</span><span class="font-semibold text-spruce-900">Sep 14, 2026 – Sep 20, 2026</span></h2>
</div>
<!-- Right: Filter Tag & Export Action -->
<div class="flex items-center gap-2.5">
<!-- "This Week" Badge -->
<button class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-spruce-50 text-spruce-800 border border-spruce-200 hover:bg-spruce-100 transition" type="button">
            This Week
          </button>
<!-- "Export All Logs" Outline Pill matching prompt reference -->
<button aria-label="Export All Logs" class="p-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-spruce-800 transition shadow-xs group" title="Export All Logs" type="button"><svg class="w-4 h-4 transition-transform group-hover:-translate-y-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path></svg></button>
<!-- Add Manual Time Entry Trigger -->
<button class="p-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-spruce-800 transition" title="Add manual entry" type="button">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path d="M12 4v16m8-8H4" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
</svg>
</button>
</div>
</div>
<!-- Main Responsive Table -->
<div class="overflow-x-auto flex-1">
<table class="w-full text-left border-collapse" id="weekly-timesheet-table">
<thead>
<tr class="border-b border-[#e6eeef] bg-[#fbfdfd] text-[11px] font-bold uppercase tracking-wider text-slate-500">
<th class="py-3.5 px-6 font-bold w-44" scope="col">DAY</th>
<th class="py-3.5 px-6 font-bold" scope="col">CLOCKED IN</th>
<th class="py-3.5 px-6 font-bold" scope="col">CLOCKED OUT</th>
<th class="py-3.5 px-6 font-bold text-center" scope="col">TOTAL HOURS</th>
<th class="py-3.5 px-6 font-bold text-right" scope="col">ACTION</th>
</tr>
</thead>
<tbody class="divide-y divide-[#edf3f4] text-xs">
<!-- Monday Row: Completed Day -->
<tr class="hover:bg-slate-50/70 transition-colors group">
<td class="py-4 px-6 font-bold text-spruce-900">
<div class="flex items-center gap-2">
<span class="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-spruce-600 transition-colors"></span>
<span class="">Monday</span>
</div>
<span class="text-[11px] font-normal text-slate-400 pl-3.5 block">Sep 14</span>
</td>
<td class="py-4 px-6">

<div class="font-semibold text-spruce-900">Sep 14, 2026</div>
<div class="font-mono-num text-slate-600 font-medium text-[11px]">08:30 AM</div>
</td>
<td class="py-4 px-6">

<div class="font-semibold text-spruce-900">Sep 14, 2026</div>
<div class="font-mono-num text-slate-600 font-medium text-[11px]">05:00 PM</div>
</td>
<td class="py-4 px-6 text-center">
<span class="inline-flex items-center justify-center font-mono-num font-bold text-sm text-spruce-900 px-3 py-1 bg-slate-100 rounded-lg">
                  8.00
                </span>
</td>
<td class="py-4 px-6 text-right">
<button aria-label="Edit entry for Monday" class="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-spruce-900 hover:border-spruce-400 hover:bg-spruce-50 transition shadow-xs" type="button">
<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
</svg>
</button>
</td>
</tr>
<!-- Tuesday Row: Completed Day -->
<tr class="hover:bg-slate-50/70 transition-colors group">
<td class="py-4 px-6 font-bold text-spruce-900">
<div class="flex items-center gap-2">
<span class="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-spruce-600 transition-colors"></span>
<span class="">Tuesday</span>
</div>
<span class="text-[11px] font-normal text-slate-400 pl-3.5 block">Sep 15</span>
</td>
<td class="py-4 px-6">

<div class="font-semibold text-spruce-900">Sep 15, 2026</div>
<div class="font-mono-num text-slate-600 font-medium text-[11px]">08:45 AM</div>
</td>
<td class="py-4 px-6">

<div class="font-semibold text-spruce-900">Sep 15, 2026</div>
<div class="font-mono-num text-slate-600 font-medium text-[11px]">05:30 PM</div>
</td>
<td class="py-4 px-6 text-center">
<span class="inline-flex items-center justify-center font-mono-num font-bold text-sm text-spruce-900 px-3 py-1 bg-slate-100 rounded-lg">
                  8.00
                </span>
</td>
<td class="py-4 px-6 text-right">
<button aria-label="Edit entry for Tuesday" class="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-spruce-900 hover:border-spruce-400 hover:bg-spruce-50 transition shadow-xs" type="button">
<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
</svg>
</button>
</td>
</tr>
<!-- Wednesday Row (Key Match from Reference: Sep 16, 2026, 12:14 AM timestamp highlighted as today) -->
<tr class="bg-spruce-50/50 border-l-4 border-l-spruce-700 hover:bg-spruce-50/80 transition-colors group">
<td class="py-4 px-6 font-bold text-spruce-900">
<div class="flex items-center gap-2">
<span class="w-2 h-2 rounded-full bg-spruce-700"></span>
<span class="text-spruce-900">Wednesday</span>
<span class="ml-1 px-1.5 py-0.2 text-[10px] font-bold uppercase rounded bg-spruce-200/70 text-spruce-900">Today</span>
</div>
<span class="text-[11px] font-semibold text-spruce-700 pl-4 block">Sep 16</span>
</td>
<td class="py-4 px-6">

<div class="font-bold text-spruce-900">Sep 16, 2026</div>
<div class="font-mono-num font-bold text-spruce-800 text-xs">12:14 AM</div>
</td>
<td class="py-4 px-6">

<div class="font-bold text-spruce-900">Sep 16, 2026</div>
<div class="font-mono-num font-bold text-spruce-800 text-xs">12:14 AM</div>
</td>
<td class="py-4 px-6 text-center">
<!-- Matches reference displaying 0 hours -->
<span class="inline-flex items-center justify-center font-mono-num font-bold text-sm text-spruce-900 px-3.5 py-1 bg-white border border-spruce-200 rounded-lg shadow-xs">
                  0
                </span>
</td>
<td class="py-4 px-6 text-right">
<button aria-label="Edit entry for Wednesday" class="p-2 rounded-lg border border-spruce-300 text-spruce-800 bg-white hover:bg-spruce-100 transition shadow-xs" type="button">
<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
</svg>
</button>
</td>
</tr>
<!-- Thursday Row (Upcoming / Not logged yet per original empty dashes) -->
<tr class="hover:bg-slate-50/50 transition-colors text-slate-400 group">
<td class="py-4 px-6 font-bold text-slate-700">
<div class="flex items-center gap-2">
<span class="w-1.5 h-1.5 rounded-full bg-slate-200"></span>
<span class="">Thursday</span>
</div>
<span class="text-[11px] font-normal text-slate-400 pl-3.5 block">Sep 17</span>
</td>
<td class="py-4 px-6">

<div class="font-mono text-slate-400">--</div>
<div class="font-mono text-[11px] text-slate-400">--</div>
</td>
<td class="py-4 px-6">

<div class="font-mono text-slate-400">--</div>
<div class="font-mono text-[11px] text-slate-400">--</div>
</td>
<td class="py-4 px-6 text-center">
<span class="font-mono-num text-slate-400 font-medium">--</span>
</td>
<td class="py-4 px-6 text-right">
<button aria-label="Edit entry for Thursday" class="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-spruce-900 hover:border-slate-300 hover:bg-slate-50 transition" type="button">
<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
</svg>
</button>
</td>
</tr>
<!-- Friday Row -->
<tr class="hover:bg-slate-50/50 transition-colors text-slate-400 group">
<td class="py-4 px-6 font-bold text-slate-700">
<div class="flex items-center gap-2">
<span class="w-1.5 h-1.5 rounded-full bg-slate-200"></span>
<span class="">Friday</span>
</div>
<span class="text-[11px] font-normal text-slate-400 pl-3.5 block">Sep 18</span>
</td>
<td class="py-4 px-6">

<div class="font-mono text-slate-400">--</div>
<div class="font-mono text-[11px] text-slate-400">--</div>
</td>
<td class="py-4 px-6">

<div class="font-mono text-slate-400">--</div>
<div class="font-mono text-[11px] text-slate-400">--</div>
</td>
<td class="py-4 px-6 text-center">
<span class="font-mono-num text-slate-400 font-medium">--</span>
</td>
<td class="py-4 px-6 text-right">
<button aria-label="Edit entry for Friday" class="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-spruce-900 hover:border-slate-300 hover:bg-slate-50 transition" type="button">
<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
</svg>
</button>
</td>
</tr>
<!-- Saturday Row -->
<tr class="hover:bg-slate-50/50 transition-colors text-slate-400 group bg-slate-50/20">
<td class="py-4 px-6 font-bold text-slate-600">
<div class="flex items-center gap-2">
<span class="w-1.5 h-1.5 rounded-full bg-slate-200"></span>
<span class="">Saturday</span>
</div>
<span class="text-[11px] font-normal text-slate-400 pl-3.5 block">Sep 19</span>
</td>
<td class="py-4 px-6">

<div class="font-mono text-slate-400">--</div>
<div class="font-mono text-[11px] text-slate-400">--</div>
</td>
<td class="py-4 px-6">

<div class="font-mono text-slate-400">--</div>
<div class="font-mono text-[11px] text-slate-400">--</div>
</td>
<td class="py-4 px-6 text-center">
<span class="font-mono-num text-slate-400 font-medium">--</span>
</td>
<td class="py-4 px-6 text-right">
<button aria-label="Edit entry for Saturday" class="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-spruce-900 hover:border-slate-300 hover:bg-slate-50 transition" type="button">
<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
</svg>
</button>
</td>
</tr>
<!-- Sunday Row -->
<tr class="hover:bg-slate-50/50 transition-colors text-slate-400 group bg-slate-50/20">
<td class="py-4 px-6 font-bold text-slate-600">
<div class="flex items-center gap-2">
<span class="w-1.5 h-1.5 rounded-full bg-slate-200"></span>
<span class="">Sunday</span>
</div>
<span class="text-[11px] font-normal text-slate-400 pl-3.5 block">Sep 20</span>
</td>
<td class="py-4 px-6">

<div class="font-mono text-slate-400">--</div>
<div class="font-mono text-[11px] text-slate-400">--</div>
</td>
<td class="py-4 px-6">

<div class="font-mono text-slate-400">--</div>
<div class="font-mono text-[11px] text-slate-400">--</div>
</td>
<td class="py-4 px-6 text-center">
<span class="font-mono-num text-slate-400 font-medium">--</span>
</td>
<td class="py-4 px-6 text-right">
<button aria-label="Edit entry for Sunday" class="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-spruce-900 hover:border-slate-300 hover:bg-slate-50 transition" type="button">
<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
</svg>
</button>
</td>
</tr>
</tbody>
</table>
</div>
</section>
<!-- END: TimesheetTableContainer -->
</main>
<!-- END: Column 2 - MainContent Area -->
<!-- BEGIN: Column 3 - Right Aside / Timesheet Summary & Submission Panel -->
<aside aria-label="Timesheet Summary and Actions" class="col-span-1 w-full bg-[#fbfdfd] border-t xl:border-t-0 xl:border-l border-[#e1ebec] flex flex-col xl:h-screen xl:sticky xl:top-0 z-20 shadow-subtle overflow-y-auto">
<!-- Panel Header -->
<div class="p-5 border-b border-[#e9f0f1] bg-white">
<div class="flex items-center justify-center gap-3">
<div>
<h3 class="text-base font-bold tracking-tight text-spruce-900">Timesheet Summary</h3>
<p class="text-xs text-slate-500 mt-0.5"><br></p>
</div>
<span class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-200/70 shrink-0"><span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>Not Submitted</span>
</div>
</div>
<div class="p-5 space-y-5 flex-1 bg-white">
<!-- Hours Breakdown Section -->
<div class="space-y-2.5">
<div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Hours Breakdown&nbsp;<br><span style="color: rgb(100, 116, 139); font-size: 12px; font-weight: 400; letter-spacing: normal; text-transform: none;" class="">Period: Sep 14 – Sep 20, 2026<br><br></span></div>
<div class="space-y-2">
<!-- Regular Hours Card -->
<div class="p-3.5 rounded-xl bg-[#f8fbfb] border border-[#e5efef] flex items-center justify-between transition-colors hover:bg-spruce-50/40">
<div class="flex items-center gap-2.5">
<div class="w-8 h-8 rounded-lg bg-spruce-100/70 flex items-center justify-center text-spruce-800">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
</svg>
</div>
<div>
<div class="text-xs font-semibold text-spruce-900">Regular Hours</div>
<div class="text-[10px] text-slate-400">Target: 40.00 hrs</div>
</div>
</div>
<span class="font-mono-num font-bold text-sm text-spruce-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">16.00 hrs</span>
</div>
<!-- Overtime Card -->
<div class="p-3.5 rounded-xl bg-[#f8fbfb] border border-[#e5efef] flex items-center justify-between transition-colors hover:bg-spruce-50/40">
<div class="flex items-center gap-2.5">
<div class="w-8 h-8 rounded-lg bg-emerald-100/60 flex items-center justify-center text-emerald-800">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
</svg>
</div>
<div>
<div class="text-xs font-semibold text-spruce-900">Overtime</div>
<div class="text-[10px] text-slate-400">Approved extra hours</div>
</div>
</div>
<span class="font-mono-num font-bold text-sm text-emerald-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">0.00 hrs</span>
</div>
<!-- Total Logged Highlight Card -->
<div class="p-3.5 rounded-xl bg-spruce-800 text-white shadow-xs flex items-center justify-between">
<div>
<div class="text-xs font-semibold text-spruce-100">Total Logged</div>
<div class="text-[10px] text-spruce-300">2 workdays recorded</div>
</div>
<span class="font-mono-num font-bold text-base text-white">16.00 hrs</span>
</div>
</div>
</div>
<!-- Approval Workflow Section -->
<div class="space-y-2.5 pt-1">
<div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Approval Workflow</div>
<div class="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-3">
<div class="flex items-center justify-between">
<span class="text-xs text-slate-500 font-medium">Submission State:</span>
<span class="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold bg-spruce-100 text-spruce-800 rounded-md">
          Pending Submission
        </span>
</div>
<div class="flex items-start gap-2.5 pt-1 border-t border-slate-200/60">
<div class="w-7 h-7 rounded-full bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
          AM
        </div>
<div class="min-w-0 flex-1">
<div class="text-[11px] text-slate-500">Assigned Approver:</div>
<div class="text-xs font-semibold text-spruce-900 truncate">Alex Morgan</div>
<div class="text-[10px] text-slate-400">Engineering Lead</div>
</div>
</div>
</div>
</div>
<!-- Remarks / Notes Section -->
<div class="space-y-2 pt-1">
<label class="block text-[11px] font-bold uppercase tracking-wider text-slate-400" for="submission-remarks">Remarks / Notes</label>
<textarea class="w-full text-xs rounded-xl border-slate-200 focus:border-spruce-600 focus:ring-spruce-600 p-3 placeholder-slate-400 bg-slate-50/50 resize-none" id="submission-remarks" placeholder="e.g., Worked on sprint onboarding and core API integration." rows="3"></textarea>
<p class="text-[10px] text-slate-400 leading-tight">Optional notes for your manager before final submission.</p>
</div>
</div>
<!-- Panel Action Buttons -->
<div class="p-5 border-t border-[#e9f0f1] bg-[#fbfdfd] space-y-2.5">
<button class="w-full px-5 py-2.5 text-xs font-bold rounded-xl bg-spruce-800 hover:bg-spruce-900 text-white shadow-sm transition active:scale-98 flex items-center justify-center gap-2" type="button">
<svg class="w-4 h-4 text-spruce-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
</svg>
<span class="">Submit Timesheet for Approval</span>
</button>

</div>
</aside>
<!-- END: Column 3 - Right Aside / Timesheet Summary & Submission Panel -->
<!-- BEGIN: ModalEntryDrawer -->
<!-- Edit Time Entry Modal (hidden by default, toggled by edit icons) -->
<div class="fixed inset-0 z-50 hidden bg-spruce-950/40 backdrop-blur-xs flex items-center justify-center p-4" id="edit-modal">
<div class="bg-white rounded-2xl shadow-modal max-w-md w-full border border-slate-200 overflow-hidden transform transition-all">
<div class="p-6 border-b border-slate-100 flex items-center justify-between">
<div>
<h3 class="text-base font-bold text-spruce-900">Edit Time Entry</h3>
<p class="text-xs text-slate-500">Wednesday, Sep 16, 2026</p>
</div>
<button class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition" id="close-modal-btn" type="button">
<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
</svg>
</button>
</div>
<div class="p-6 space-y-4">
<div class="grid grid-cols-2 gap-4">
<div>
<label class="block text-xs font-semibold text-spruce-800 mb-1.5">Clock In</label>
<input class="w-full text-xs rounded-xl border-slate-200 focus:border-spruce-600 focus:ring-spruce-600" type="time" value="00:14">
</div>
<div>
<label class="block text-xs font-semibold text-spruce-800 mb-1.5">Clock Out</label>
<input class="w-full text-xs rounded-xl border-slate-200 focus:border-spruce-600 focus:ring-spruce-600" type="time" value="00:14">
</div>
</div>
<div>
<label class="block text-xs font-semibold text-spruce-800 mb-1.5">Reason for Edit</label>
<select class="w-full text-xs rounded-xl border-slate-200 focus:border-spruce-600 focus:ring-spruce-600">
<option>Forgot to clock out</option>
<option>System correction</option>
<option>Meal break adjustment</option>
<option>Manager override</option>
</select>
</div>
<div>
<label class="block text-xs font-semibold text-spruce-800 mb-1.5">Notes / Memo</label>
<textarea class="w-full text-xs rounded-xl border-slate-200 focus:border-spruce-600 focus:ring-spruce-600" placeholder="Optional clarification..." rows="2"></textarea>
</div>
</div>
<div class="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
<button class="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition" id="cancel-modal-btn" type="button">
          Cancel
        </button>
<button class="px-4 py-2 text-xs font-bold bg-spruce-800 text-white rounded-xl hover:bg-spruce-900 transition" id="save-modal-btn" type="button">
          Save Changes
        </button>
</div>
</div>
</div>
<!-- END: ModalEntryDrawer -->
<!-- BEGIN: InteractiveScripts -->
<!-- Live Clock and Interactive Functionalities -->
<script data-purpose="live-clock-handler">
    function updateClock() {
      const now = new Date();
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // 0 hour is 12 AM
      const strHours = String(hours).padStart(2, '0');

      const clockEl = document.getElementById('digital-clock');
      const ampmEl = document.getElementById('digital-ampm');
      
      if (clockEl) {
        clockEl.textContent = `${strHours}:${minutes}:${seconds}`;
      }
      if (ampmEl) {
        ampmEl.textContent = ampm;
      }
    }

    // Initialize clock
    setInterval(updateClock, 1000);
  </script>
<script data-purpose="ui-interactions">
    document.addEventListener('DOMContentLoaded', () => {
      const clockBtn = document.getElementById('clock-btn');
      let isClockedIn = false;

      // Quick toggle behavior for Clock in / Clock out button
      if (clockBtn) {
        clockBtn.addEventListener('click', () => {
          isClockedIn = !isClockedIn;
          if (isClockedIn) {
            clockBtn.innerHTML = `
              <svg class="w-4 h-4 text-amber-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span>Clock Out</span>
            `;
            clockBtn.className = 'w-full inline-flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 active:scale-95 text-white font-semibold text-sm shadow-sm hover:shadow transition-all duration-150 group';
          } else {
            clockBtn.innerHTML = `
              <svg class="w-4 h-4 text-emerald-200 transition-transform group-hover:rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span>Clock In</span>
            `;
            clockBtn.className = 'w-full inline-flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl bg-forest-600 hover:bg-forest-700 active:scale-95 text-white font-semibold text-sm shadow-sm hover:shadow transition-all duration-150 group';
          }
        });
      }

      // Simple Edit Modal toggle handlers
      const modal = document.getElementById('edit-modal');
      const closeModalBtn = document.getElementById('close-modal-btn');
      const cancelModalBtn = document.getElementById('cancel-modal-btn');
      const saveModalBtn = document.getElementById('save-modal-btn');
      const editButtons = document.querySelectorAll('button[aria-label^="Edit entry"]');

      const openModal = () => {
        if (modal) modal.classList.remove('hidden');
      };

      const closeModal = () => {
        if (modal) modal.classList.add('hidden');
      };

      editButtons.forEach(btn => btn.addEventListener('click', openModal));
      if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
      if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);
      if (saveModalBtn) saveModalBtn.addEventListener('click', closeModal);

      // Close modal on background click
      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) closeModal();
        });
      }
    });
  </script>
<!-- END: InteractiveScripts -->


</body></html>