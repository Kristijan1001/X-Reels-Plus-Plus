// ==UserScript==
// @name         X Reels ++ Enhanced
// @namespace    http://tampermonkey.net/
// @version      31.4.0
// @description  TikTok-style X.com viewer. v31.4.0: zoom toned down (contain + 130%, bars OK) and pan now actually works via layout offset. v31.2 fit modes.
// @author       Kristijan1001 (enhanced)
// @match        https://twitter.com/*
// @match        https://x.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=x.com
// @grant        none
// @license      MIT
// @downloadURL https://update.greasyfork.org/scripts/539679/X%20Reels%20%2B%2B%20Enhanced.user.js
// @updateURL https://update.greasyfork.org/scripts/539679/X%20Reels%20%2B%2B%20Enhanced.meta.js
// ==/UserScript==

(function () {
    'use strict';

    // Bump this together with @version so the running build is verifiable on-screen.
    const XR_VERSION = '31.4.0';
    // Zoom-mode oversize factor. Must match `width/height` in .xr-fit-zoom CSS
    // (130%). Used by _setPan to convert the 0..100 pan value into a px offset.
    const XR_ZOOM = 1.30;

    /* ─────────────────────────────────────────────
       GLOBAL STYLES
    ───────────────────────────────────────────── */
    const GLOBAL_CSS = `
        /* (DM Sans @import removed — X's CSP blocks external stylesheets; the
            --xr-font stack falls back to the system UI font cleanly.) */

        :root {
            --xr-accent: #FF2D55;
            --xr-accent2: #FF6B35;
            --xr-blue: #1D9BF0;
            --xr-gold: #FFD700;
            --xr-green: #00C853;
            --xr-glass: rgba(12, 12, 18, 0.82);
            --xr-glass-border: rgba(255,255,255,0.08);
            --xr-glass-hover: rgba(255,255,255,0.06);
            --xr-text: #F0F0F5;
            --xr-text-dim: rgba(240,240,245,0.55);
            --xr-radius: 18px;
            --xr-radius-sm: 10px;
            --xr-font: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            --xr-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3);
            --xr-shadow-accent: 0 8px 32px rgba(255,45,85,0.3);
        }

        #xr-container * { box-sizing: border-box; font-family: var(--xr-font); }

        /* ── SCROLLBAR ── */
        #xr-container ::-webkit-scrollbar { width: 4px; }
        #xr-container ::-webkit-scrollbar-track { background: transparent; }
        #xr-container ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }

        /* ── TOAST ── */
        @keyframes xr-toast-in  { from { opacity:0; transform:translateX(30px) scale(0.9); } to { opacity:1; transform:translateX(0) scale(1); } }
        @keyframes xr-toast-out { from { opacity:1; transform:translateX(0); } to { opacity:0; transform:translateX(30px); } }
        @keyframes xr-slide-up  { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes xr-slide-down{ from { opacity:1; transform:translateY(0); } to { opacity:0; transform:translateY(12px); } }
        @keyframes xr-fade-in   { from { opacity:0; } to { opacity:1; } }
        @keyframes xr-scale-in  { from { opacity:0; transform:scale(0.85); } to { opacity:1; transform:scale(1); } }
        @keyframes xr-heart-pop { 0%,100%{transform:scale(1)} 40%{transform:scale(1.4)} 70%{transform:scale(0.9)} }
        @keyframes xr-pulse     { 0%,100%{opacity:0.6} 50%{opacity:1} }
        @keyframes xr-spin      { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes xr-dot-bounce{ 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
        @keyframes xr-progress-shimmer { from{background-position:-200% 0} to{background-position:200% 0} }
        @keyframes xr-ripple    { 0%{transform:scale(0);opacity:0.6} 100%{transform:scale(4);opacity:0} }
        @keyframes xr-scrub-fade{ 0%{opacity:1;transform:translateY(0) scale(1)} 70%{opacity:1;transform:translateY(-6px) scale(1.05)} 100%{opacity:0;transform:translateY(-16px) scale(0.95)} }

        /* ── ACTION BUTTONS (v30.5: 44px, was 52px) ── */
        .xr-btn {
            all: unset;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            border-radius: 50%;
            width: 44px;
            height: 44px;
            background: rgba(14, 14, 22, 0.75);
            border: 1px solid rgba(255,255,255,0.10);
            color: var(--xr-text);
            backdrop-filter: blur(24px) saturate(160%);
            box-shadow: 0 4px 20px rgba(0,0,0,0.4), 0 0 0 0 rgba(255,255,255,0);
            transition: transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1),
                        box-shadow 0.28s ease,
                        border-color 0.28s ease,
                        background 0.28s ease;
            position: relative;
            overflow: visible;
            flex-shrink: 0;
        }
        .xr-btn::before {
            content: '';
            position: absolute;
            inset: 0;
            border-radius: 50%;
            background: inherit;
            z-index: -1;
        }
        .xr-btn svg { pointer-events: none; overflow: visible; }
        .xr-btn:active { transform: scale(0.90) !important; transition-duration: 0.08s; }

        /* ── PER-BUTTON GLOW COLOURS ── */
        #xr-like {
            border-color: rgba(255,45,85,0.35);
            box-shadow: 0 4px 20px rgba(0,0,0,0.4),
                        0 0 14px rgba(255,45,85,0.20),
                        0 0 0 0 rgba(255,45,85,0);
        }
        html:not(.xr-touch) #xr-like:hover {
            transform: scale(1.15) translateY(-3px);
            background: rgba(255,45,85,0.18) !important;
            border-color: rgba(255,45,85,0.75) !important;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5),
                        0 0 28px rgba(255,45,85,0.55),
                        0 0 60px rgba(255,45,85,0.18) !important;
        }
        html:not(.xr-touch) #xr-like:hover svg { animation: xr-like-wiggle 0.45s cubic-bezier(0.34,1.56,0.64,1); }

        #xr-follow {
            border-color: rgba(29,155,240,0.35);
            box-shadow: 0 4px 20px rgba(0,0,0,0.4),
                        0 0 14px rgba(29,155,240,0.20);
        }
        html:not(.xr-touch) #xr-follow:hover {
            transform: scale(1.15) translateY(-3px);
            background: rgba(29,155,240,0.18) !important;
            border-color: rgba(29,155,240,0.75) !important;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5),
                        0 0 28px rgba(29,155,240,0.55),
                        0 0 60px rgba(29,155,240,0.18) !important;
        }
        html:not(.xr-touch) #xr-follow:hover svg { animation: xr-follow-pop 0.5s cubic-bezier(0.34,1.56,0.64,1); }

        #xr-bookmark {
            border-color: rgba(255,215,0,0.30);
            box-shadow: 0 4px 20px rgba(0,0,0,0.4),
                        0 0 14px rgba(255,215,0,0.15);
        }
        html:not(.xr-touch) #xr-bookmark:hover {
            transform: scale(1.15) translateY(-3px);
            background: rgba(255,215,0,0.14) !important;
            border-color: rgba(255,215,0,0.70) !important;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5),
                        0 0 28px rgba(255,215,0,0.45),
                        0 0 60px rgba(255,215,0,0.14) !important;
        }
        html:not(.xr-touch) #xr-bookmark:hover svg { animation: xr-bm-drop 0.45s cubic-bezier(0.34,1.56,0.64,1); }

        #xr-share {
            border-color: rgba(52,211,153,0.30);
            box-shadow: 0 4px 20px rgba(0,0,0,0.4),
                        0 0 14px rgba(52,211,153,0.15);
        }
        html:not(.xr-touch) #xr-share:hover {
            transform: scale(1.15) translateY(-3px);
            background: rgba(52,211,153,0.14) !important;
            border-color: rgba(52,211,153,0.70) !important;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5),
                        0 0 28px rgba(52,211,153,0.45),
                        0 0 60px rgba(52,211,153,0.14) !important;
        }
        html:not(.xr-touch) #xr-share:hover svg { animation: xr-share-fly 0.5s cubic-bezier(0.34,1.56,0.64,1); }

        #xr-up, #xr-down {
            border-color: rgba(160,130,255,0.28);
            box-shadow: 0 4px 20px rgba(0,0,0,0.4),
                        0 0 12px rgba(160,130,255,0.15);
        }
        html:not(.xr-touch) #xr-up:hover, html:not(.xr-touch) #xr-down:hover {
            transform: scale(1.12) translateY(-3px);
            background: rgba(160,130,255,0.14) !important;
            border-color: rgba(160,130,255,0.65) !important;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5),
                        0 0 24px rgba(160,130,255,0.45),
                        0 0 50px rgba(160,130,255,0.14) !important;
        }

        html:not(.xr-touch) #xr-up:hover svg   { animation: xr-arrow-down 0.4s cubic-bezier(0.34,1.56,0.64,1); }
        html:not(.xr-touch) #xr-down:hover svg { animation: xr-arrow-up   0.4s cubic-bezier(0.34,1.56,0.64,1); }

        #xr-fit {
            border-color: rgba(255,180,80,0.30);
            box-shadow: 0 4px 20px rgba(0,0,0,0.4),
                        0 0 12px rgba(255,180,80,0.15);
        }
        html:not(.xr-touch) #xr-fit:hover {
            transform: scale(1.15) translateY(-3px);
            background: rgba(255,180,80,0.16) !important;
            border-color: rgba(255,180,80,0.70) !important;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5),
                        0 0 26px rgba(255,180,80,0.50),
                        0 0 56px rgba(255,180,80,0.16) !important;
        }
        html:not(.xr-touch) #xr-fit:hover svg { animation: xr-fit-pop 0.45s cubic-bezier(0.34,1.56,0.64,1); }
        @keyframes xr-fit-pop {
            0%   { transform: scale(1) rotate(0deg); }
            40%  { transform: scale(1.28) rotate(-6deg); }
            70%  { transform: scale(0.94) rotate(4deg); }
            100% { transform: scale(1) rotate(0deg); }
        }


        /* Video fit modes — class on the media wrapper. NO CSS transform on the
           <video>: it breaks hardware-video compositing in Android WebView
           (black screen). Zoom is done by oversizing the element instead, which
           the wrapper's overflow:hidden then clips. */
        .xr-fit-contain video { object-fit: contain !important; }
        /* Fill: cover the screen, centred, no panning. */
        .xr-fit-cover   video { object-fit: cover !important; object-position: 50% 50% !important; }
        /* Zoom: whole video (black bars are fine), oversized a moderate amount so
           it's bigger than Fit, and pannable by shifting the element via 'left'
           (a layout offset — WebView-safe, no transform, and it actually pans for
           any aspect ratio because the oversized element overflows the viewport,
           unlike object-position which can't move a portrait video sideways). */
        .xr-fit-zoom    video {
            object-fit: contain !important;
            width: 130% !important; height: 130% !important;
            max-width: none !important; flex-shrink: 0 !important;
            position: relative !important;
            left: var(--xr-pan-x-px, 0px) !important;
        }

        /* ── ACTIVE / STATE CLASSES ── */
        .xr-btn--liked {
            background: rgba(255,45,85,0.22) !important;
            border-color: rgba(255,45,85,0.80) !important;
            box-shadow: 0 4px 20px rgba(0,0,0,0.4), 0 0 22px rgba(255,45,85,0.50) !important;
        }
        .xr-btn--liked svg .heart-path { fill: #FF2D55 !important; stroke: #FF2D55 !important; }
        .xr-btn--heart-anim svg .heart-path { animation: xr-heart-pop 0.55s cubic-bezier(0.34,1.56,0.64,1) both; transform-origin: center; }
        .xr-btn--following {
            background: rgba(29,155,240,0.22) !important;
            border-color: rgba(29,155,240,0.80) !important;
            box-shadow: 0 4px 20px rgba(0,0,0,0.4), 0 0 22px rgba(29,155,240,0.50) !important;
        }
        .xr-btn--bookmarked {
            background: rgba(255,215,0,0.18) !important;
            border-color: rgba(255,215,0,0.75) !important;
            box-shadow: 0 4px 20px rgba(0,0,0,0.4), 0 0 20px rgba(255,215,0,0.40) !important;
        }

        /* ── PER-BUTTON HOVER ANIMATIONS ── */
        @keyframes xr-like-wiggle {
            0%   { transform: scale(1) rotate(0deg); }
            25%  { transform: scale(1.3) rotate(-12deg); }
            55%  { transform: scale(1.2) rotate(10deg); }
            80%  { transform: scale(1.1) rotate(-5deg); }
            100% { transform: scale(1) rotate(0deg); }
        }
        @keyframes xr-follow-pop {
            0%   { transform: scale(1); }
            40%  { transform: scale(1.35); }
            70%  { transform: scale(0.92); }
            100% { transform: scale(1); }
        }
        @keyframes xr-bm-drop {
            0%   { transform: translateY(0) scale(1); }
            35%  { transform: translateY(-5px) scale(1.15); }
            65%  { transform: translateY(2px) scale(0.95); }
            100% { transform: translateY(0) scale(1); }
        }
        @keyframes xr-share-fly {
            0%   { transform: translate(0,0) scale(1); }
            40%  { transform: translate(4px,-4px) scale(1.2); }
            70%  { transform: translate(-1px,1px) scale(0.95); }
            100% { transform: translate(0,0) scale(1); }
        }
        @keyframes xr-arrow-up {
            0%   { transform: translateY(0); }
            35%  { transform: translateY(-7px); }
            65%  { transform: translateY(2px); }
            100% { transform: translateY(0); }
        }
        @keyframes xr-arrow-down {
            0%   { transform: translateY(0); }
            35%  { transform: translateY(7px); }
            65%  { transform: translateY(-2px); }
            100% { transform: translateY(0); }
        }

        /* ── RIPPLE ── */
        .xr-ripple-effect {
            position: absolute;
            border-radius: 50%;
            width: 100%;
            aspect-ratio: 1;
            background: rgba(255,255,255,0.22);
            animation: xr-ripple 0.55s ease-out forwards;
            pointer-events: none;
        }

        /* ── PROGRESS BAR ── */
        .xr-progress-track {
            width: 100%;
            height: 3px;
            background: rgba(255,255,255,0.15);
            border-radius: 3px;
            cursor: pointer;
            position: relative;
        }
        .xr-progress-track::before {
            content:'';
            position: absolute;
            inset: -6px 0;
        }
        .xr-progress-fill {
            height: 100%;
            background: linear-gradient(90deg, var(--xr-accent), var(--xr-accent2));
            border-radius: 3px;
            position: relative;
            transition: width 0.1s linear;
            will-change: width;
        }
        .xr-progress-thumb {
            position: absolute;
            right: -5px;
            top: 50%;
            transform: translateY(-50%) scale(0);
            width: 12px;
            height: 12px;
            background: white;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
            transition: transform 0.2s ease;
        }
        .xr-progress-track:hover .xr-progress-thumb { transform: translateY(-50%) scale(1); }

        /* ── VOLUME ── */
        .xr-vol-slider {
            -webkit-appearance: none;
            appearance: none;
            width: 72px;
            height: 3px;
            border-radius: 3px;
            outline: none;
            cursor: pointer;
            background: linear-gradient(to right, var(--xr-accent) var(--vol-pct, 70%), rgba(255,255,255,0.2) var(--vol-pct, 70%));
        }
        .xr-vol-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 12px; height: 12px;
            border-radius: 50%;
            background: white;
            cursor: pointer;
            box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        }
        .xr-vol-slider::-moz-range-thumb {
            width: 12px; height: 12px;
            border-radius: 50%;
            background: white;
            border: none;
            cursor: pointer;
        }

        /* ── GALLERY DOTS ── */
        .xr-dots { display:flex; gap:6px; align-items:center; justify-content:center; }
        .xr-dot {
            width: 6px; height: 6px;
            border-radius: 3px;
            background: rgba(255,255,255,0.35);
            transition: all 0.25s ease;
            flex-shrink: 0;
        }
        .xr-dot.active {
            background: var(--xr-accent);
            width: 18px;
            box-shadow: 0 0 8px rgba(255,45,85,0.6);
        }

        /* ── LOADING SKELETON ── */
        .xr-skeleton {
            background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.04) 75%);
            background-size: 200% 100%;
            animation: xr-progress-shimmer 1.4s infinite;
            border-radius: 8px;
        }

        /* ── LOADING DOTS ── */
        .xr-loading-dots span {
            display: inline-block;
            width: 4px; height: 4px;
            border-radius: 50%;
            background: var(--xr-accent);
            margin: 0 1.5px;
            animation: xr-dot-bounce 1.2s ease infinite;
        }
        .xr-loading-dots span:nth-child(2) { animation-delay: 0.15s; }
        .xr-loading-dots span:nth-child(3) { animation-delay: 0.30s; }

        /* ── SCRUB FLASH ── */
        .xr-scrub-flash {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%,-50%);
            background: rgba(0,0,0,0.7);
            color: white;
            padding: 10px 18px;
            border-radius: 12px;
            font-size: 15px;
            font-weight: 700;
            backdrop-filter: blur(12px);
            pointer-events: none;
            animation: xr-scrub-fade 0.8s ease forwards;
            z-index: 9999;
            white-space: nowrap;
        }

        /* ── INFO PANEL ── */
        .xr-info-panel {
            position: absolute;
            bottom: 80px;
            left: 16px;
            right: 84px;
            pointer-events: none;
            animation: xr-slide-up 0.3s ease;
        }
        .xr-author-row {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 8px;
        }
        .xr-avatar {
            width: 38px; height: 38px;
            border-radius: 50%;
            border: 2px solid rgba(255,255,255,0.2);
            object-fit: cover;
            background: rgba(255,255,255,0.1);
            flex-shrink: 0;
        }
        .xr-author-name {
            font-size: 15px;
            font-weight: 700;
            color: var(--xr-text);
            cursor: pointer;
            pointer-events: auto;
        }
        .xr-author-name:hover { text-decoration: underline; }
        .xr-author-handle { font-size: 12px; color: var(--xr-text-dim); }
        .xr-tweet-text {
            font-size: 13px;
            color: rgba(240,240,245,0.85);
            line-height: 1.5;
            max-height: 60px;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            text-shadow: 0 1px 8px rgba(0,0,0,0.8);
        }

        /* ── MEDIA TRANSITION ──
           NOTE: no 'both'/'forwards' fill — a transform left applied on a <video>
           ancestor after the animation black-screens hardware video in Android
           WebView. With default fill the transform clears once the 0.28s anim ends
           (end frame == base state, so no visual snap). */
        .xr-media-enter { animation: xr-scale-in 0.28s cubic-bezier(0.34,1.2,0.64,1); }
        .xr-media-exit  { animation: xr-slide-down 0.18s ease forwards; }

        /* ── TRIGGER BUTTON ── */
        #xr-trigger {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000000;
            display: flex;
            align-items: center;
            gap: 14px;
            padding: 10px 22px 10px 10px;
            background: rgba(10, 10, 18, 0.90);
            border: 1px solid rgba(255,45,85,0.30);
            border-radius: 22px;
            cursor: grab;
            user-select: none;
            touch-action: none;
            backdrop-filter: blur(32px) saturate(200%);
            box-shadow:
                0 8px 40px rgba(0,0,0,0.65),
                0 0 0 1px rgba(255,255,255,0.04) inset,
                0 0 24px rgba(255,45,85,0.12);
            color: var(--xr-text);
            font-family: var(--xr-font);
            animation: xr-trigger-enter 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both,
                       xr-trigger-breathe 3s ease-in-out 0.7s infinite;
            transition:
                transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
                box-shadow 0.35s ease,
                border-color 0.35s ease,
                background 0.35s ease;
        }
        @keyframes xr-trigger-enter {
            from { opacity: 0; transform: translateY(-24px) scale(0.85); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes xr-trigger-breathe {
            0%,100% { box-shadow: 0 8px 40px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 0 18px rgba(255,45,85,0.10); }
            50%     { box-shadow: 0 8px 40px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 0 36px rgba(255,45,85,0.25); }
        }
        #xr-trigger:hover {
            transform: translateY(-5px) scale(1.04) !important;
            background: rgba(18, 10, 22, 0.96) !important;
            border-color: rgba(255,45,85,0.70) !important;
            box-shadow:
                0 20px 60px rgba(0,0,0,0.75),
                0 0 0 1px rgba(255,255,255,0.07) inset,
                0 0 55px rgba(255,45,85,0.38),
                0 0 110px rgba(255,45,85,0.14) !important;
            animation: none !important;
        }
        #xr-trigger:active { transform: translateY(-2px) scale(0.97) !important; transition-duration: 0.08s !important; animation: none !important; }

        /* ── NEW LOGO MARK ── */
        .xr-logo-mark {
            width: 44px;
            height: 44px;
            position: relative;
            flex-shrink: 0;
        }

        @keyframes xr-arc-spin {
            from { transform: rotate(0deg); }
            to   { transform: rotate(360deg); }
        }
        @keyframes xr-play-beat {
            0%,100% { transform: scale(1); }
            50%     { transform: scale(1.12); }
        }

        .xr-logo-arc-group {
            animation: xr-arc-spin 4s linear infinite;
            transform-origin: 22px 22px;
        }
        #xr-trigger:hover .xr-logo-arc-group {
            animation-duration: 1.2s !important;
        }
        .xr-logo-play-icon {
            animation: xr-play-beat 1.8s ease-in-out infinite;
            transform-origin: 22px 22px;
        }
        #xr-trigger:hover .xr-logo-play-icon {
            animation-duration: 0.5s !important;
        }

        .xr-trigger-text { display: flex; flex-direction: column; gap: 2px; }
        .xr-trigger-title {
            font-size: 14px; font-weight: 800; letter-spacing: 0.5px;
            background: linear-gradient(100deg, #ffffff 0%, rgba(255,100,120,0.95) 100%);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .xr-trigger-sub { font-size: 11px; color: rgba(240,240,245,0.40); font-weight: 500; letter-spacing: 0.2px; }
        #xr-trigger.dragging { cursor: grabbing !important; transition: none !important; animation: none !important; }

        /* ── SPEED BADGE ── */
        .xr-speed-btn {
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.15);
            color: white;
            font-size: 11px;
            font-weight: 700;
            padding: 4px 9px;
            border-radius: 10px;
            cursor: pointer;
            transition: all 0.2s ease;
            backdrop-filter: blur(10px);
            white-space: nowrap;
            flex-shrink: 0;
        }
        .xr-speed-btn:hover { background: rgba(255,255,255,0.2); }

        /* ── PIP/FULLSCREEN ── */
        .xr-icon-btn {
            all: unset;
            cursor: pointer;
            color: rgba(255,255,255,0.7);
            padding: 4px;
            border-radius: 6px;
            transition: color 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .xr-icon-btn:hover { color: white; }

        /* ── SHORTCUTS PANEL ── */
        .xr-shortcuts {
            background: rgba(18,18,26,0.42);
            border: 1px solid rgba(255,255,255,0.10);
            backdrop-filter: blur(30px) saturate(190%);
            -webkit-backdrop-filter: blur(30px) saturate(190%);
            border-radius: var(--xr-radius);
            padding: 12px 16px;
            font-size: 12px;
            color: var(--xr-text-dim);
            min-width: 200px;
            box-shadow: var(--xr-shadow);
        }
        .xr-shortcuts-title {
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 1px;
            text-transform: uppercase;
            color: var(--xr-accent);
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .xr-shortcut-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 16px;
            padding: 4px 0;
            border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .xr-shortcut-row:last-child { border-bottom: none; }
        .xr-key {
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 5px;
            padding: 2px 7px;
            font-size: 10px;
            font-weight: 600;
            color: var(--xr-text);
            white-space: nowrap;
            font-family: monospace;
        }

        /* ── LIVE TWEET STATS ── */
        /* Shared glass card — identical look + width for shortcuts pill & stats */
        .xr-card {
            box-sizing: border-box;
            width: 160px;
            background: var(--xr-glass);
            border: 1px solid var(--xr-glass-border);
            backdrop-filter: blur(22px) saturate(180%);
            -webkit-backdrop-filter: blur(22px) saturate(180%);
            box-shadow: var(--xr-shadow);
            border-radius: 14px;
        }
        .xr-stats {
            margin-top: 8px;
            display: flex; flex-direction: column; gap: 1px;
            padding: 6px 8px;
            opacity: 0; transition: opacity 0.25s ease;   /* fade only, no transform */
        }
        .xr-stats.shown { opacity: 1; }
        .xr-stat {
            display: flex; align-items: center; gap: 8px;
            padding: 2px 0;
            font-size: 13px; font-weight: 800;
            color: #fff;
            white-space: nowrap;
            text-shadow: 0 1px 4px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.7);
        }
        .xr-stat svg { width: 15px; height: 15px; flex-shrink: 0; filter: drop-shadow(0 1px 3px rgba(0,0,0,0.85)); }
        .xr-stat-v {
            font-variant-numeric: tabular-nums;
            letter-spacing: 0.2px;
        }
        .xr-stat-v.bump { animation: xr-stat-bump 0.4s cubic-bezier(0.34,1.56,0.64,1); }
        @keyframes xr-stat-bump {
            0% { transform: scale(1); }
            45% { transform: scale(1.22); }
            100% { transform: scale(1); }
        }
        /* per-metric accent colours */
        .xr-stat[data-k="views"]   svg { color: var(--xr-blue);   }
        .xr-stat[data-k="likes"]   svg { color: var(--xr-accent); }
        .xr-stat[data-k="reposts"] svg { color: var(--xr-green);  }
        .xr-stat[data-k="replies"] svg { color: #B49CFF;          }

        /* ── COUNTER BADGE ── */
        .xr-counter {
            background: var(--xr-glass);
            border: 1px solid var(--xr-glass-border);
            backdrop-filter: blur(20px);
            border-radius: 20px;
            padding: 5px 12px;
            font-size: 12px;
            font-weight: 600;
            color: var(--xr-text-dim);
        }
        .xr-counter span { color: var(--xr-text); }

        /* ── AUTOSCROLL ── */
        .xr-autoscroll-pill {
            background: var(--xr-glass);
            border: 1px solid var(--xr-glass-border);
            backdrop-filter: blur(22px) saturate(180%);
            -webkit-backdrop-filter: blur(22px) saturate(180%);
            box-shadow: var(--xr-shadow);
            border-radius: 14px;
            padding: 8px 13px;
            font-size: 12px;
            font-weight: 600;
            color: var(--xr-text-dim);
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.2s ease;
        }
        .xr-autoscroll-pill:hover { border-color: rgba(255,45,85,0.3); }
        .xr-autoscroll-val { color: var(--xr-accent); }

        .xr-dropdown {
            background: var(--xr-glass);
            border: 1px solid var(--xr-glass-border);
            backdrop-filter: blur(22px) saturate(180%);
            -webkit-backdrop-filter: blur(22px) saturate(180%);
            border-radius: 14px;
            padding: 6px;
            box-shadow: var(--xr-shadow);
            min-width: 160px;
            animation: xr-scale-in 0.15s ease;
        }
        .xr-dropdown-item {
            padding: 8px 14px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 13px;
            color: var(--xr-text-dim);
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: all 0.15s ease;
        }
        .xr-dropdown-item:hover { background: var(--xr-glass-hover); color: var(--xr-text); }
        .xr-dropdown-item.active { color: var(--xr-accent); }
        .xr-dropdown-item.active::after { content:'✓'; color: var(--xr-accent); }

        /* ── EXIT BTN ── */
        .xr-exit-btn {
            all: unset;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            background: rgba(239,68,68,0.18);
            border: 1px solid rgba(239,68,68,0.4);
            border-radius: 14px;
            padding: 8px 16px;
            color: white;
            font-size: 13px;
            font-weight: 700;
            backdrop-filter: blur(20px);
            box-shadow: 0 8px 24px rgba(239,68,68,0.2);
            transition: all 0.3s cubic-bezier(0.34,1.56,0.64,1);
        }
        .xr-exit-btn:hover { background: rgba(239,68,68,0.35); border-color: rgba(239,68,68,0.7); transform: translateY(-2px); box-shadow: 0 12px 32px rgba(239,68,68,0.4); }
        .xr-exit-btn:active { transform: scale(0.97); }

        /* ── NSFW BADGE ── */
        .xr-nsfw-badge {
            position: absolute;
            top: 12px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(255,45,85,0.85);
            border: 1px solid rgba(255,45,85,0.9);
            backdrop-filter: blur(12px);
            border-radius: 20px;
            padding: 4px 12px;
            font-size: 11px;
            font-weight: 700;
            color: white;
            letter-spacing: 0.5px;
            pointer-events: none;
            z-index: 10;
            animation: xr-fade-in 0.3s ease;
        }
    `;

    /* ─────────────────────────────────────────────
       TOAST SYSTEM
    ───────────────────────────────────────────── */
    class ToastSystem {
        constructor() {
            this.container = null;
        }
        mount() {
            if (this.container) return;
            this.container = document.createElement('div');
            this.container.style.cssText = `position:fixed;top:80px;right:20px;z-index:2147483647;display:flex;flex-direction:column;gap:8px;pointer-events:none;`;
            document.body.appendChild(this.container);
        }
        unmount() {
            if (this.container) { this.container.remove(); this.container = null; }
        }
        show(msg, type = 'info', duration = 2000) {
            if (!this.container) return;
            const colors = {
                info:     ['rgba(29,155,240,0.9)',   '#1D9BF0'],
                success:  ['rgba(0,200,83,0.9)',      '#00C853'],
                error:    ['rgba(239,68,68,0.9)',     '#EF4444'],
                like:     ['rgba(255,45,85,0.9)',     '#FF2D55'],
                follow:   ['rgba(29,155,240,0.9)',    '#1D9BF0'],
                bookmark: ['rgba(255,215,0,0.8)',     '#FFD700'],
            };
            const [bg, border] = colors[type] || colors.info;
            const toast = document.createElement('div');
            toast.style.cssText = `
                background: ${bg};
                border: 1px solid ${border};
                color: white;
                padding: 8px 14px;
                border-radius: 12px;
                font-size: 13px;
                font-weight: 600;
                font-family: var(--xr-font);
                backdrop-filter: blur(20px);
                box-shadow: 0 8px 24px rgba(0,0,0,0.4);
                animation: xr-toast-in 0.3s cubic-bezier(0.34,1.56,0.64,1) both;
                white-space: nowrap;
                pointer-events: none;
            `;
            toast.textContent = msg;
            this.container.appendChild(toast);
            setTimeout(() => {
                toast.style.animation = 'xr-toast-out 0.25s ease forwards';
                setTimeout(() => toast.remove(), 300);
            }, duration);
        }
    }

    /* ─────────────────────────────────────────────
       MAIN CLASS
    ───────────────────────────────────────────── */
    class XReels {
        constructor() {
            this.isActive       = false;
            this.isNavigating   = false;
            this.lastWheelTime  = 0;
            this.wheelCooldown  = 250;
            this.container      = null;
            this.mediaWrapper   = null;
            this.post = { id: null, element: null, mediaItems: [], currentMediaIndex: 0 };
            this.displayedEl    = null;
            this.btnLike = this.btnFollow = this.btnBookmark = this.btnShare = null;
            this.btnUp   = this.btnDown   = null;
            this.volume       = parseFloat(localStorage.getItem('xr_volume')  ?? '0.7');
            this.muted        = localStorage.getItem('xr_muted')     === 'true';
            this.playbackRate = parseFloat(localStorage.getItem('xr_speed')   ?? '1');
            this.autoDelay    = parseInt(  localStorage.getItem('xr_auto')    ?? '0', 10);
            this.theme        = localStorage.getItem('xr_theme') ?? 'dark';
            // Video sizing: 'contain' (fit) | 'zoom' (~middle) | 'cover' (fill)
            this.videoFit     = localStorage.getItem('xr_fit') ?? 'contain';
            this.autoTimerId        = null;
            this.videoEndedCb       = null;
            this.hideCtrlsTimerId   = null;
            this.scrubFlashTimerId  = null;
            this.followCache  = {};
            this._followBusy  = false;
            this._preloadCache = new Map();
            this._onWheel    = this._handleWheel.bind(this);
            this._onKeydown  = this._handleKeydown.bind(this);
            this._touchStartY = 0;
            this._touchStartX = 0;
            // NSFW fix: track the mute-guard observer
            this._muteGuardObserver = null;
            this._muteGuardVideo    = null;
            this.toast = new ToastSystem();
        }

        /* ══════════════════════════════════════
           INIT
        ══════════════════════════════════════ */
        init() {
            this._injectStyles();
            // Tag the page as touch so hover effects can be disabled reliably.
            // WebViews often misreport @media(hover) — JS detection is solid.
            try {
                const touch = (window.matchMedia && matchMedia('(pointer: coarse)').matches)
                    || ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
                if (touch) document.documentElement.classList.add('xr-touch');
            } catch {}
            if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
            this._setupGlobalListeners();
            setTimeout(() => this._addTrigger(), 800);
        }

        _injectStyles() {
            if (document.getElementById('xr-styles')) return;
            const s = document.createElement('style');
            s.id = 'xr-styles';
            s.textContent = GLOBAL_CSS;
            document.head.appendChild(s);
        }

        _addTrigger() {
            if (window.self !== window.top) return;
            document.getElementById('xr-trigger')?.remove();
            const t = document.createElement('div');
            t.id = 'xr-trigger';
            t.innerHTML = `
                <div class="xr-logo-mark">
                    <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <linearGradient id="xr-bg-grad" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stop-color="#2A0A14"/>
                                <stop offset="100%" stop-color="#1A0820"/>
                            </linearGradient>
                            <linearGradient id="xr-play-grad" x1="16" y1="13" x2="32" y2="31" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stop-color="#FF5F7E"/>
                                <stop offset="100%" stop-color="#FF2D55"/>
                            </linearGradient>
                            <linearGradient id="xr-arc-grad" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stop-color="#FF2D55" stop-opacity="1"/>
                                <stop offset="50%" stop-color="#FF6B35" stop-opacity="0.8"/>
                                <stop offset="100%" stop-color="#FF2D55" stop-opacity="0.2"/>
                            </linearGradient>
                        </defs>
                        <circle cx="22" cy="22" r="20" fill="url(#xr-bg-grad)"/>
                        <circle cx="22" cy="22" r="19" stroke="rgba(255,45,85,0.15)" stroke-width="0.5" fill="none"/>
                        <g class="xr-logo-arc-group">
                            <path d="M 22 3 A 19 19 0 0 1 39.5 28" fill="none" stroke="url(#xr-arc-grad)" stroke-width="2.5" stroke-linecap="round"/>
                            <path d="M 22 41 A 19 19 0 0 1 4.5 16" fill="none" stroke="url(#xr-arc-grad)" stroke-width="2.5" stroke-linecap="round"/>
                        </g>
                        <g class="xr-logo-play-icon">
                            <path d="M17 13.5L33 22L17 30.5V13.5Z" fill="url(#xr-play-grad)"/>
                        </g>
                    </svg>
                </div>
                <div class="xr-trigger-text">
                    <div class="xr-trigger-title">X Reels</div>
                    <div class="xr-trigger-sub">Tap to start · v${XR_VERSION}</div>
                </div>`;
            t.addEventListener('click', () => this.start());
            document.body.appendChild(t);
            this._makeTriggerDraggable(t);
        }

        /* v30.5: Drag the trigger anywhere; on release it snaps to the nearest
           screen edge (left or right) at whatever vertical position you dropped
           it. Position is persisted in localStorage so it survives reloads. */
        _makeTriggerDraggable(t) {
            // Restore last position
            try {
                const saved = JSON.parse(localStorage.getItem('xr_trigger_pos') || 'null');
                if (saved && typeof saved.top === 'number') {
                    t.style.top = Math.max(8, Math.min(window.innerHeight - 70, saved.top)) + 'px';
                    if (saved.side === 'left') { t.style.left = '12px'; t.style.right = 'auto'; }
                    else                        { t.style.right = '20px'; t.style.left = 'auto'; }
                }
            } catch {}

            let startX = 0, startY = 0, startLeft = 0, startTop = 0;
            let dragging = false, moved = false;
            const DRAG_THRESHOLD = 6; // px before we suppress the click

            const getPoint = (e) => e.touches?.[0] || e.changedTouches?.[0] || e;
            const onDown = (e) => {
                const p = getPoint(e);
                dragging = true; moved = false;
                const r = t.getBoundingClientRect();
                startLeft = r.left; startTop = r.top;
                startX = p.clientX; startY = p.clientY;
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup',   onUp);
                document.addEventListener('touchmove', onMove, { passive: false });
                document.addEventListener('touchend',  onUp);
            };
            const onMove = (e) => {
                if (!dragging) return;
                const p = getPoint(e);
                const dx = p.clientX - startX, dy = p.clientY - startY;
                if (!moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
                    moved = true;
                    t.classList.add('dragging');
                }
                if (moved) {
                    e.preventDefault?.();
                    const nx = Math.max(4, Math.min(window.innerWidth  - t.offsetWidth  - 4, startLeft + dx));
                    const ny = Math.max(4, Math.min(window.innerHeight - t.offsetHeight - 4, startTop  + dy));
                    t.style.left  = nx + 'px';
                    t.style.right = 'auto';
                    t.style.top   = ny + 'px';
                }
            };
            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup',   onUp);
                document.removeEventListener('touchmove', onMove);
                document.removeEventListener('touchend',  onUp);
                if (!dragging) return;
                dragging = false;
                if (!moved) return;  // pure click — let the click handler run
                t.classList.remove('dragging');

                // Snap to nearest horizontal edge
                const r = t.getBoundingClientRect();
                const centerX = r.left + r.width / 2;
                const side = centerX < window.innerWidth / 2 ? 'left' : 'right';
                if (side === 'left') { t.style.left = '12px';  t.style.right = 'auto'; }
                else                  { t.style.right = '20px'; t.style.left = 'auto'; }
                localStorage.setItem('xr_trigger_pos', JSON.stringify({ side, top: r.top }));

                // Swallow the click event that follows a drag
                const swallow = (ev) => {
                    ev.stopPropagation(); ev.preventDefault();
                    t.removeEventListener('click', swallow, true);
                };
                t.addEventListener('click', swallow, true);
                setTimeout(() => t.removeEventListener('click', swallow, true), 350);
            };
            t.addEventListener('mousedown',  onDown);
            t.addEventListener('touchstart', onDown, { passive: true });
        }

        /* ══════════════════════════════════════
           START / EXIT
        ══════════════════════════════════════ */
        start() {
            if (this.isActive) return;
            document.querySelectorAll('video').forEach(v => { v.pause(); v.muted = true; });
            const first = this._findCentralArticle();
            if (!first) { this.toast.show('No media found on screen', 'error'); return; }
            this.isActive = true;
            this._buildContainer();
            this.toast.mount();   // mount AFTER container so toasts stack above it
            this._navigateTo(first);
            document.getElementById('xr-trigger')?.style.setProperty('display', 'none');
            this.toast.show('X Reels v' + XR_VERSION, 'info', 1600);
        }

        exit() {
            if (!this.isActive) return;
            this.isActive = false;
            this._stopAuto();
            clearTimeout(this.hideCtrlsTimerId);
            this._detachPauseGuardian();
            this._detachMuteGuard();
            this._closeMenu();
            this._restoreMedia();
            this.container?.remove();
            this.container = null;
            this.toast.unmount();
            document.getElementById('xr-trigger')?.style.removeProperty('display');
            this.post = { id: null, element: null, mediaItems: [], currentMediaIndex: 0 };
            this.displayedEl = null;
        }

        /* ══════════════════════════════════════
           CONTAINER
        ══════════════════════════════════════ */
        _buildContainer() {
            this.container?.remove();
            const bg = this.theme === 'amoled' ? '#000' : 'rgba(0,0,0,0.88)';

            this.container = document.createElement('div');
            this.container.id = 'xr-container';
            this.container.style.cssText = `
                position:fixed;top:0;left:0;width:100vw;height:100vh;
                background:${bg};z-index:2147483647;overflow:hidden;
            `;

            this.container.innerHTML = `
                <div class="xr-media-wrapper" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;overflow:hidden;"></div>

                <div class="xr-tl" style="position:absolute;top:16px;left:16px;z-index:10;pointer-events:auto;">
                    <div class="xr-shortcuts-toggle" style="cursor:pointer;display:flex;align-items:center;gap:8px;">
                        <div class="xr-card" id="xr-shortcuts-trigger" style="width:fit-content;box-sizing:border-box;background:var(--xr-glass);border:1px solid var(--xr-glass-border);backdrop-filter:blur(22px) saturate(180%);-webkit-backdrop-filter:blur(22px) saturate(180%);box-shadow:var(--xr-shadow);border-radius:14px;padding:8px 14px;font-size:12px;font-weight:600;color:var(--xr-text-dim);display:inline-flex;align-items:center;gap:8px;white-space:nowrap;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="3" stroke="currentColor" stroke-width="1.8"/><path d="M6 9h1M9 9h1M12 9h1M15 9h1M18 9h1M6 12h2M10 12h2M14 12h2M17 12h5M6 15h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                            Shortcuts
                        </div>
                    </div>
                    <div id="xr-shortcuts-panel" style="display:none;margin-top:8px;">
                        <div class="xr-shortcuts">
                            <div class="xr-shortcuts-title">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--xr-accent)"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                                Keyboard
                            </div>
                            <div class="xr-shortcut-row"><span>Toggle feed</span><span class="xr-key">X</span></div>
                            <div class="xr-shortcut-row"><span>Exit</span><span class="xr-key">Q</span></div>
                            <div class="xr-shortcut-row"><span>Next / Prev post</span><span class="xr-key">↑ ↓</span></div>
                            <div class="xr-shortcut-row"><span>Gallery item</span><span class="xr-key">← →</span></div>
                            <div class="xr-shortcut-row"><span>Play / Pause</span><span class="xr-key">Space</span></div>
                            <div class="xr-shortcut-row"><span>Scrub ±5s</span><span class="xr-key">&lt; &gt;</span></div>
                            <div class="xr-shortcut-row"><span>Like</span><span class="xr-key">L</span></div>
                            <div class="xr-shortcut-row"><span>Follow</span><span class="xr-key">F</span></div>
                            <div class="xr-shortcut-row"><span>Bookmark</span><span class="xr-key">B</span></div>
                            <div class="xr-shortcut-row"><span>Mute toggle</span><span class="xr-key">M</span></div>
                            <div class="xr-shortcut-row"><span>PiP</span><span class="xr-key">P</span></div>
                        </div>
                    </div>

                    <!-- Live tweet stats — no card/pill, just floating numbers -->
                    <div id="xr-stats" style="display:none;width:fit-content;margin-top:10px;flex-direction:column;gap:2px;padding:0 2px;">
                        <div class="xr-stat" data-k="views">
                            <svg viewBox="0 0 24 24" fill="none"><path d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7z" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="2.6" stroke="currentColor" stroke-width="1.8"/></svg>
                            <span class="xr-stat-v">–</span>
                        </div>
                        <div class="xr-stat" data-k="likes">
                            <svg viewBox="0 0 24 24" fill="none"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
                            <span class="xr-stat-v">–</span>
                        </div>
                        <div class="xr-stat" data-k="reposts">
                            <svg viewBox="0 0 24 24" fill="none"><path d="M7 7h11l-2.5-2.5M17 17H6l2.5 2.5M18 7v6M6 17v-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                            <span class="xr-stat-v">–</span>
                        </div>
                        <div class="xr-stat" data-k="replies">
                            <svg viewBox="0 0 24 24" fill="none"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 8.5-8.5 8.38 8.38 0 0 1 8.5 8.5z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
                            <span class="xr-stat-v">–</span>
                        </div>
                    </div>
                </div>

                <div class="xr-tr" style="position:absolute;top:16px;right:16px;z-index:10;display:flex;flex-direction:column;align-items:flex-end;gap:8px;pointer-events:auto;">
                    <button class="xr-exit-btn" id="xr-exit">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="white" stroke-width="2.5" stroke-linecap="round"/></svg>
                        Exit
                    </button>
                    <div class="xr-autoscroll-pill" id="xr-auto-trigger">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 2v20M2 12l10 10 10-10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                        Auto: <span class="xr-autoscroll-val" id="xr-auto-label">Off</span>
                    </div>
                    <div id="xr-auto-menu" style="display:none;position:absolute;top:90px;right:0;" class="xr-dropdown"></div>
                </div>

                <div style="position:absolute;top:16px;left:50%;transform:translateX(-50%);z-index:10;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none;">
                    <div class="xr-dots" id="xr-dots"></div>
                    <div class="xr-counter" id="xr-counter" style="display:none;">Post <span id="xr-post-num">-</span></div>
                </div>

                <div class="xr-info-panel" id="xr-info"></div>

                <div style="position:absolute;right:14px;bottom:84px;display:flex;flex-direction:column;gap:10px;z-index:10;pointer-events:auto;" id="xr-actions">
                    <button class="xr-btn" id="xr-like" title="Like (L)">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path class="heart-path" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" stroke="rgba(255,100,130,0.9)" stroke-width="1.8" fill="none" stroke-linejoin="round"/></svg>
                    </button>
                    <button class="xr-btn" id="xr-follow" title="Follow (F)">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="8" r="4" stroke="rgba(80,180,255,0.9)" stroke-width="1.8" fill="none"/>
                            <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" stroke="rgba(80,180,255,0.9)" stroke-width="1.8" stroke-linecap="round"/>
                            <line x1="19" y1="7" x2="19" y2="13" stroke="rgba(80,180,255,0.9)" stroke-width="2" stroke-linecap="round" class="fol-v"/>
                            <line x1="16" y1="10" x2="22" y2="10" stroke="rgba(80,180,255,0.9)" stroke-width="2" stroke-linecap="round" class="fol-h"/>
                            <path class="fol-check" d="M15 8l-4 4-2-2" stroke="rgba(80,180,255,0.9)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0;transform:scale(0);transform-origin:center;transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1)"/>
                        </svg>
                    </button>
                    <button class="xr-btn" id="xr-bookmark" title="Bookmark (B)">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path class="bm-path" d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" stroke="rgba(255,215,0,0.85)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
                    </button>
                    <button class="xr-btn" id="xr-share" title="Open tweet">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" stroke="rgba(52,211,153,0.9)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>
                    <button class="xr-btn" id="xr-fit" title="Fit / Zoom / Fill"></button>
                    <button class="xr-btn" id="xr-up" title="Previous (↑)">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M12 19V5M5 12l7-7 7 7" stroke="rgba(180,160,255,0.9)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>
                    <button class="xr-btn" id="xr-down" title="Next (↓)">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12l7 7 7-7" stroke="rgba(180,160,255,0.9)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>
                </div>

                <div id="xr-loading" style="display:none;position:absolute;bottom:20px;left:50%;transform:translateX(-50%);background:var(--xr-glass);border:1px solid var(--xr-glass-border);backdrop-filter:blur(20px);padding:6px 12px;border-radius:14px;z-index:20;">
                    <div class="xr-loading-dots"><span></span><span></span><span></span></div>
                </div>
            `;

            document.body.appendChild(this.container);
            this.mediaWrapper = this.container.querySelector('.xr-media-wrapper');

            this.btnLike     = this.container.querySelector('#xr-like');
            this.btnFollow   = this.container.querySelector('#xr-follow');
            this.btnBookmark = this.container.querySelector('#xr-bookmark');
            this.btnShare    = this.container.querySelector('#xr-share');
            this.btnFit      = this.container.querySelector('#xr-fit');
            this.btnUp       = this.container.querySelector('#xr-up');
            this.btnDown     = this.container.querySelector('#xr-down');

            this.btnLike.addEventListener('click', () => { this._ripple(this.btnLike); this.toggleLike(); });
            this.btnFollow.addEventListener('click', () => { this._ripple(this.btnFollow); this.toggleFollow(); });
            this.btnBookmark.addEventListener('click', () => { this._ripple(this.btnBookmark); this.toggleBookmark(); });
            this.btnShare.addEventListener('click', () => this._openTweet());
            this.btnFit.addEventListener('click', () => { this._ripple(this.btnFit); this.toggleFit(); });
            this.btnFit.innerHTML = this._fitIcon(this.videoFit);
            this.btnUp.addEventListener('click', () => { if (!this._navMedia('prev')) this._navPost('prev'); });
            this.btnDown.addEventListener('click', () => { if (!this._navMedia('next')) this._navPost('next'); });

            this.container.querySelector('#xr-exit').addEventListener('click', () => this.exit());

            const shortcutsTrigger = this.container.querySelector('#xr-shortcuts-trigger');
            const shortcutsPanel   = this.container.querySelector('#xr-shortcuts-panel');
            let shortcutsOpen = false;
            shortcutsTrigger.addEventListener('click', () => {
                shortcutsOpen = !shortcutsOpen;
                shortcutsPanel.style.display = shortcutsOpen ? 'block' : 'none';
            });
            document.addEventListener('click', (e) => {
                if (shortcutsOpen && !shortcutsTrigger.contains(e.target) && !shortcutsPanel.contains(e.target)) {
                    shortcutsOpen = false;
                    shortcutsPanel.style.display = 'none';
                }
            });

            this.container.addEventListener('touchstart', e => {
                this._touchStartY = e.touches[0].clientY;
                this._touchStartX = e.touches[0].clientX;
                this._panStartX   = this._panX ?? 50;
                this._didPan      = false;
                // Panning is ONLY available in zoom mode.
                this._panMode     = (this.videoFit === 'zoom');
            }, { passive: true });
            // CRITICAL (esp. in the Android WebView): stop the finger swipe from
            // scrolling the underlying x.com timeline. Without this a fast flick
            // scrolls the real page by thousands of posts and desyncs everything.
            this.container.addEventListener('touchmove', e => {
                if (e.cancelable) e.preventDefault();
                if (!this._panMode || e.touches.length !== 1) return;
                const dx = e.touches[0].clientX - this._touchStartX;
                const dy = e.touches[0].clientY - this._touchStartY;
                // Horizontal-dominant drag → pan the zoomed video.
                if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
                    this._didPan = true;
                    this._setPan(this._panStartX - dx * (100 / (window.innerWidth || 400)));
                }
            }, { passive: false });
            this.container.addEventListener('touchend', e => {
                if (this._didPan) { this._didPan = false; return; }  // was panning → no nav
                const dy = this._touchStartY - e.changedTouches[0].clientY;
                const dx = this._touchStartX - e.changedTouches[0].clientX;
                if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 50) {
                    if (dy > 0) { if (!this._navMedia('next')) this._navPost('next'); }
                    else        { if (!this._navMedia('prev')) this._navPost('prev'); }
                } else if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40 && !this._panMode) {
                    // Horizontal swipe = gallery nav (Fit/Fill only; zoom pans).
                    if (dx > 0) this._navMedia('next');
                    else        this._navMedia('prev');
                }
            }, { passive: true });

            // ── Desktop mouse drag-to-pan (zoom mode only) ──
            let mDown = false, mStartX = 0, mPanStart = 50, mMoved = false;
            this.container.addEventListener('mousedown', e => {
                if (this.videoFit !== 'zoom' || e.button !== 0) return;
                if (e.target.closest('.xr-btn, .xr-exit-btn, .xr-autoscroll-pill, .xr-dropdown, #xr-shortcuts-trigger, .xr-icon-btn, input')) return;
                mDown = true; mMoved = false;
                mStartX = e.clientX; mPanStart = this._panX ?? 50;
                e.preventDefault();
            });
            window.addEventListener('mousemove', e => {
                if (!mDown) return;
                const dx = e.clientX - mStartX;
                if (Math.abs(dx) > 3) mMoved = true;
                this._setPan(mPanStart - dx * (100 / (window.innerWidth || 800)));
            });
            window.addEventListener('mouseup', () => {
                if (!mDown) return;
                mDown = false;
                // If we actually panned, swallow the click so it doesn't toggle play.
                if (mMoved) {
                    const swallow = ev => { ev.stopPropagation(); ev.preventDefault();
                                            this.container.removeEventListener('click', swallow, true); };
                    this.container.addEventListener('click', swallow, true);
                    setTimeout(() => this.container.removeEventListener('click', swallow, true), 60);
                }
            });

            this._buildAutoMenu();
        }

        _buildAutoMenu() {
            const menu    = this.container.querySelector('#xr-auto-menu');
            const trigger = this.container.querySelector('#xr-auto-trigger');
            const label   = this.container.querySelector('#xr-auto-label');
            const opts = [
                { v: 0,     l: 'Off' },
                { v: -1,    l: 'Smart (video end)' },
                { v: 1000,  l: '1 second' },
                { v: 2000,  l: '2 seconds' },
                { v: 3000,  l: '3 seconds' },
                { v: 5000,  l: '5 seconds' },
                { v: 8000,  l: '8 seconds' },
                { v: 30000, l: '30 seconds' },
                { v: 60000, l: '60 seconds' },
            ];
            const labelMap = {};
            opts.forEach(o => labelMap[o.v] = o.l);
            label.textContent = labelMap[this.autoDelay] ?? 'Off';

            menu.innerHTML = opts.map(o =>
                `<div class="xr-dropdown-item ${o.v === this.autoDelay ? 'active' : ''}" data-v="${o.v}">${o.l}</div>`
            ).join('');

            trigger.addEventListener('click', e => {
                e.stopPropagation();
                menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
            });
            menu.addEventListener('click', e => {
                const item = e.target.closest('.xr-dropdown-item');
                if (!item) return;
                e.stopPropagation();
                const v = parseInt(item.dataset.v, 10);
                this.autoDelay = v;
                localStorage.setItem('xr_auto', v);
                label.textContent = labelMap[v] ?? 'Off';
                menu.querySelectorAll('.xr-dropdown-item').forEach(i => i.classList.toggle('active', parseInt(i.dataset.v,10) === v));
                menu.style.display = 'none';
                if (this.isActive) { this._stopAuto(); if (v !== 0) this._startAuto(); }
            });
            document.addEventListener('click', () => { if (menu) menu.style.display = 'none'; });
        }

        /* ══════════════════════════════════════
           NAVIGATION
        ══════════════════════════════════════ */
        _navigateTo(articleEl) {
            if (!articleEl || this.isNavigating) return;
            this.isNavigating = true;
            this._stopAuto();
            this._restoreMedia();
            this._showLoading();

            const tweetId = this._tweetId(articleEl);
            const items   = this._extractMedia(articleEl);

            if (!items.length) {
                this.isNavigating = false;
                // Skip the media-less article — but DEFER (setTimeout) so we don't
                // recurse on the call stack, and cap consecutive skips so a run of
                // empty articles can't loop forever (was: stack-overflow → frozen).
                this._emptySkips = (this._emptySkips || 0) + 1;
                if (this._emptySkips > 15) {
                    this._emptySkips = 0;
                    this._hideLoading();
                    this.toast.show('No more media found', 'info');
                    return;
                }
                const fromEl = articleEl;
                setTimeout(() => {
                    const next = this._findNextArticle(fromEl, false);
                    if (next && next !== fromEl) this._navigateTo(next);
                    else { this._hideLoading(); this._emptySkips = 0; }
                }, 0);
                return;
            }
            this._emptySkips = 0;   // reset on a successful post

            this.post = { id: tweetId, element: articleEl, mediaItems: items, currentMediaIndex: 0 };
            this._inferFollowState(articleEl, tweetId);
            articleEl.scrollIntoView({ behavior: 'auto', block: 'center' });

            setTimeout(() => {
                this._displayMedia();
                this._hideLoading();
                this.isNavigating = false;
                this._preloadNext();
            }, 400);
        }

        _navPost(dir) {
            if (this.isNavigating) return;
            const next = this._findNextArticle(this.post.element, dir === 'prev');
            if (next) { this._navigateTo(next); return; }
            if (dir === 'prev') { window.scrollTo({ top: 0, behavior: 'auto' }); return; }
            // At the end of currently-loaded posts → drive X's infinite loader.
            this._loadMoreAndAdvance();
        }

        // Poll-scroll to the bottom so X's lazy loader appends more posts, then
        // jump to the first new one. Robust against X virtualising the DOM.
        _loadMoreAndAdvance() {
            if (this._loadingMore) return;
            this._loadingMore = true;
            this._showLoading();
            const scroller = document.scrollingElement || document.documentElement;
            let tries = 0;
            const MAX = 24; // ~7s
            const tick = () => {
                if (!this.isActive) { this._loadingMore = false; this._hideLoading(); return; }
                // Nudge the real page to the very bottom to wake the loader
                window.scrollTo({ top: scroller.scrollHeight, behavior: 'auto' });
                const next = this._findNextArticle(this.post.element, false);
                if (next) {
                    this._loadingMore = false;
                    this._hideLoading();
                    this._navigateTo(next);
                    return;
                }
                if (++tries >= MAX) {
                    this._loadingMore = false;
                    this._hideLoading();
                    this.toast.show('No more posts to load', 'info');
                    return;
                }
                setTimeout(tick, 300);
            };
            tick();
        }

        _navMedia(dir) {
            const items = this.post.mediaItems;
            if (!items || items.length <= 1) return false;
            const idx = this.post.currentMediaIndex;
            if (dir === 'next' && idx < items.length - 1) { this.post.currentMediaIndex++; this._displayMedia(); return true; }
            if (dir === 'prev' && idx > 0)                { this.post.currentMediaIndex--; this._displayMedia(); return true; }
            return false;
        }

        /* ══════════════════════════════════════
           MEDIA EXTRACTION
        ══════════════════════════════════════ */
        _extractMedia(article) {
            const items = [];
            const seen  = new Set();

            const getMeta = (el) => {
                let ctx = el.parentElement;
                while (ctx && ctx !== article) {
                    if (ctx.getAttribute('role') === 'link' && ctx.querySelector('[data-testid="User-Name"]')) break;
                    ctx = ctx.parentElement;
                }
                if (!ctx || ctx === article) ctx = article;
                const nameEl   = ctx.querySelector('[data-testid="User-Name"] [dir="ltr"]') || article.querySelector('[data-testid="User-Name"] [dir="ltr"]');
                const linkEl   = ctx.querySelector('[data-testid="User-Name"] a')            || article.querySelector('[data-testid="User-Name"] a');
                const textEl   = ctx.querySelector('[data-testid="tweetText"]')               || article.querySelector('[data-testid="tweetText"]');
                const avatarEl = article.querySelector('img[src*="profile_images"]');
                let handle = linkEl?.getAttribute('href') ?? '';
                if (handle.startsWith('/')) handle = handle.slice(1);
                return {
                    author: nameEl?.textContent ?? 'Unknown',
                    handle,
                    text:   textEl?.textContent ?? '',
                    avatar: avatarEl?.src ?? '',
                };
            };

            article.querySelectorAll('div[data-testid="videoPlayer"] video').forEach(v => {
                if (seen.has(v) || !this._validMedia(v)) return;
                seen.add(v);
                items.push({ type: 'video', originalElement: v, placeholder: null, ...getMeta(v) });
            });
            article.querySelectorAll('div[data-testid="tweetPhoto"] img').forEach(img => {
                if (seen.has(img) || !this._validMedia(img)) return;
                seen.add(img);
                items.push({ type: 'image', originalElement: img, src: this._fullImageUrl(img), placeholder: null, ...getMeta(img) });
            });
            // Fallback: if the data-testid selectors found nothing but the article
            // DID pass _articleHasMedia (broader selectors), grab raw video/img so
            // _navigateTo never gets an empty list (which caused an infinite
            // _navPost → _navigateTo recursion / stack overflow).
            if (!items.length) {
                article.querySelectorAll('video').forEach(v => {
                    if (seen.has(v) || !this._validMedia(v)) return;
                    seen.add(v);
                    items.push({ type: 'video', originalElement: v, placeholder: null, ...getMeta(v) });
                });
                article.querySelectorAll('img[src*="pbs.twimg.com/media/"]').forEach(img => {
                    if (seen.has(img) || !this._validMedia(img)) return;
                    seen.add(img);
                    items.push({ type: 'image', originalElement: img, src: this._fullImageUrl(img), placeholder: null, ...getMeta(img) });
                });
            }
            return items;
        }

        /* ══════════════════════════════════════
           DISPLAY
        ══════════════════════════════════════ */
        _displayMedia() {
            this._restoreMedia();
            const item = this.post.mediaItems[this.post.currentMediaIndex];
            if (!item) return;
            this._updateUI();
            if (item.type === 'video') this._showVideo(item);
            else                       this._showImage(item);
            this._startAuto();
        }

        _showVideo(item) {
            const video = item.originalElement;

            if (!item.placeholder) {
                const ph = document.createElement('div');
                const r  = video.getBoundingClientRect();
                ph.style.cssText = `width:${r.width}px;height:${r.height}px;display:inline-block;`;
                item.placeholder = ph;
                video.parentNode?.replaceChild(ph, video);
            }

            this.displayedEl = video;

            const wrap = document.createElement('div');
            wrap.className = 'xr-media-enter xr-fit-' + this.videoFit;
            wrap.style.cssText = `position:relative;width:100%;height:100%;background:#000;display:flex;align-items:center;justify-content:center;`;
            // Pan state — reset to centre (0px offset) for each new video.
            this._wrap = wrap;
            this._panX = 50;
            wrap.style.setProperty('--xr-pan-x-px', '0px');

            video.style.cssText = `width:100%;height:100%;object-fit:contain;display:block;background:#000;`;
            video.loop     = false;
            video.controls = false;
            video.muted    = true; // always start muted to satisfy autoplay policy
            video.volume   = this.volume;
            video.playbackRate = this.playbackRate;

            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position:absolute;bottom:0;left:0;right:0;
                background:linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%);
                padding:16px 16px 14px;
                opacity:0;transition:opacity 0.25s ease;
                z-index:5;pointer-events:all;
            `;

            const progressWrap = document.createElement('div');
            progressWrap.style.cssText = `margin-bottom:12px;`;
            const track = document.createElement('div');
            track.className = 'xr-progress-track';
            const fill  = document.createElement('div');
            fill.className = 'xr-progress-fill';
            const thumb = document.createElement('div');
            thumb.className = 'xr-progress-thumb';
            fill.appendChild(thumb);
            track.appendChild(fill);
            progressWrap.appendChild(track);

            const row = document.createElement('div');
            row.style.cssText = `display:flex;align-items:center;gap:10px;`;

            const mkIconBtn = (svg, title) => {
                const b = document.createElement('button');
                b.className = 'xr-icon-btn';
                b.innerHTML = svg;
                b.title = title;
                return b;
            };

            const playBtn = mkIconBtn(`
                <svg class="ico-play" width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
                <svg class="ico-pause" style="display:none" width="18" height="18" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
            `, 'Play/Pause (Space)');
            playBtn.style.cssText += 'padding:0;';

            const timeEl = document.createElement('div');
            timeEl.style.cssText = `color:rgba(255,255,255,0.8);font-size:11px;font-weight:600;min-width:80px;`;

            const speedBtn = document.createElement('button');
            speedBtn.className = 'xr-speed-btn';
            speedBtn.textContent = this.playbackRate.toFixed(2) + 'x';

            const muteBtn = mkIconBtn(this.muted ? '🔇' : '🔊', 'Mute (M)');

            const volSlider = document.createElement('input');
            volSlider.type = 'range'; volSlider.min = '0'; volSlider.max = '100'; volSlider.step = '1';
            volSlider.value = String(this.muted ? 0 : Math.round(this.volume * 100));
            volSlider.className = 'xr-vol-slider';
            volSlider.style.setProperty('--vol-pct', volSlider.value + '%');

            const spacer = document.createElement('div');
            spacer.style.flex = '1';

            const pipBtn  = mkIconBtn(`<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" stroke-width="1.8"/><rect x="12" y="11" width="8" height="7" rx="1" fill="currentColor"/></svg>`, 'Picture in Picture (P)');
            const fsBtn   = mkIconBtn(`<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`, 'Fullscreen');

            [playBtn, timeEl, speedBtn, muteBtn, volSlider, spacer, pipBtn, fsBtn].forEach(el => row.appendChild(el));
            overlay.appendChild(progressWrap);
            overlay.appendChild(row);

            wrap.appendChild(video);
            wrap.appendChild(overlay);
            this.mediaWrapper.innerHTML = '';
            this.mediaWrapper.appendChild(wrap);

            const fmtTime = s => { const m = Math.floor(s/60); return `${m}:${String(Math.floor(s%60)).padStart(2,'0')}`; };
            const syncPlayPause = () => {
                wrap.querySelector('.ico-play').style.display  = video.paused ? 'block' : 'none';
                wrap.querySelector('.ico-pause').style.display = video.paused ? 'none'  : 'block';
            };
            const syncVol = () => {
                muteBtn.textContent = video.muted ? '🔇' : '🔊';
                const pct = video.muted ? 0 : Math.round(video.volume * 100);
                volSlider.value = String(pct);
                volSlider.style.setProperty('--vol-pct', pct + '%');
            };
            const syncTime = () => {
                fill.style.width = video.duration ? ((video.currentTime / video.duration) * 100) + '%' : '0%';
                timeEl.textContent = `${fmtTime(video.currentTime || 0)} / ${fmtTime(video.duration || 0)}`;
            };

            const togglePlay = () => {
                if (video.paused) {
                    this._userPaused = false;
                    video.muted = true;
                    video.play().then(() => {
                        video.muted = this.muted;
                        video.volume = this.volume;
                        video.playbackRate = this.playbackRate;
                    }).catch(() => {});
                } else {
                    this._userPaused = true;
                    video.pause();
                }
            };
            // v30.5: single tap on video → only show controls (no pause).
            // Double-tap → toggle play/pause via the browser's native dblclick,
            // which is more reliable than counting clicks ourselves.
            video.addEventListener('click', e => {
                // Show controls; cancel if a dblclick is about to fire (we let
                // dblclick handle play/pause separately).
                overlay.style.opacity = '1';
                clearTimeout(this.hideCtrlsTimerId);
                this.hideCtrlsTimerId = setTimeout(() => { overlay.style.opacity = '0'; }, 2500);
            });
            playBtn.addEventListener('click', e => { e.stopPropagation(); togglePlay(); });
            video.addEventListener('play',    syncPlayPause);
            video.addEventListener('pause',   syncPlayPause);
            video.addEventListener('timeupdate', syncTime);
            video.addEventListener('loadedmetadata', syncTime);
            video.addEventListener('volumechange',   syncVol);

            const keepRate = () => { if (Math.abs(video.playbackRate - this.playbackRate) > 0.01) video.playbackRate = this.playbackRate; };
            video.addEventListener('ratechange', keepRate);
            video.addEventListener('playing',    keepRate);
            video.addEventListener('play',       keepRate);

            const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];
            speedBtn.addEventListener('click', e => {
                e.stopPropagation();
                const ci = SPEEDS.indexOf(this.playbackRate);
                this.playbackRate = SPEEDS[(ci + 1) % SPEEDS.length];
                video.playbackRate = this.playbackRate;
                speedBtn.textContent = this.playbackRate.toFixed(2) + 'x';
                localStorage.setItem('xr_speed', this.playbackRate);
            });

            const toggleMute = () => {
                this.muted = !this.muted;
                video.muted = this.muted;
                localStorage.setItem('xr_muted', this.muted);
                if (!this.muted && video.volume === 0) { video.volume = 0.5; this.volume = 0.5; }
            };
            muteBtn.addEventListener('click', e => { e.stopPropagation(); toggleMute(); });
            // v30.5: double-click/double-tap toggles play/pause (was: toggle mute).
            // Mute is still available via the speaker button in the controls bar.
            video.addEventListener('dblclick', e => { e.preventDefault(); e.stopPropagation(); togglePlay(); });

            volSlider.addEventListener('input', e => {
                e.stopPropagation();
                const v = parseFloat(e.target.value) / 100;
                video.volume = v; this.volume = v;
                video.muted  = v === 0; this.muted = v === 0;
                localStorage.setItem('xr_volume', v);
                localStorage.setItem('xr_muted', this.muted);
                volSlider.style.setProperty('--vol-pct', e.target.value + '%');
            });

            let dragging = false;
            const seekTo = ev => {
                const r = track.getBoundingClientRect();
                const p = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
                if (video.duration) video.currentTime = p * video.duration;
            };
            track.addEventListener('mousedown', e => { e.stopPropagation(); dragging = true; seekTo(e); });
            document.addEventListener('mousemove', e => { if (dragging) seekTo(e); });
            document.addEventListener('mouseup',   () => { dragging = false; });

            pipBtn.addEventListener('click', async e => {
                e.stopPropagation();
                if (document.pictureInPictureElement) { await document.exitPictureInPicture().catch(()=>{}); }
                else { video.requestPictureInPicture().catch(()=>{}); }
            });
            fsBtn.addEventListener('click', e => {
                e.stopPropagation();
                if (!document.fullscreenElement) wrap.requestFullscreen?.().catch(()=>{});
                else document.exitFullscreen?.().catch(()=>{});
            });

            wrap.addEventListener('mousemove', e => {
                const r = wrap.getBoundingClientRect();
                if (r.bottom - e.clientY < 160) overlay.style.opacity = '1';
                else overlay.style.opacity = '0';
            });
            wrap.addEventListener('mouseleave', () => { if (!dragging) overlay.style.opacity = '0'; });

            video.muted  = true; // start muted; _tryPlay will unmute
            video.volume = this.volume;
            syncVol();
            syncPlayPause();
            this._tryPlay(video);
        }

        _showImage(item) {
            const img = document.createElement('img');
            img.src = item.src;
            img.className = 'xr-media-enter';
            img.style.cssText = `width:100%;height:100%;object-fit:contain;display:block;background:#000;`;
            this.mediaWrapper.innerHTML = '';
            this.mediaWrapper.appendChild(img);
            this.displayedEl = img;
        }

        /* ══════════════════════════════════════
           NSFW UNMUTE — simple interval approach

           X re-mutes NSFW videos asynchronously
           after play() resolves. The fix is just
           to keep setting video.muted = false on a
           short interval for ~1.5 s after play,
           same as simple autoplay scripts do.
           No property hijacking needed.
        ══════════════════════════════════════ */
        _startUnmuteInterval(video) {
            this._stopUnmuteInterval();
            if (this.muted) return; // user wants muted, do nothing
            let ticks = 0;
            this._unmuteIntervalId = setInterval(() => {
                ticks++;
                // Stop if navigated away, user muted, or 1.5 s elapsed (~15 ticks × 100 ms)
                if (!this.isActive || this.displayedEl !== video || this.muted || ticks > 15) {
                    this._stopUnmuteInterval();
                    return;
                }
                if (video.muted) {
                    video.muted  = false;
                    video.volume = this.volume;
                }
            }, 100);
        }

        _stopUnmuteInterval() {
            if (this._unmuteIntervalId) {
                clearInterval(this._unmuteIntervalId);
                this._unmuteIntervalId = null;
            }
        }

        // Keep _detachMuteGuard as a no-op so existing call sites don't break
        _attachMuteGuard()  {}
        _detachMuteGuard()  { this._stopUnmuteInterval(); }
        _forceMuteState(muted) {
            const video = this.displayedEl;
            if (video?.tagName === 'VIDEO') { video.muted = muted; if (!muted) video.volume = this.volume; }
        }

        /* ══════════════════════════════════════
           VIDEO PLAYBACK — pause guardian

        /* ══════════════════════════════════════
           VIDEO PLAYBACK — pause guardian

           Debounced: waits 180 ms after a pause
           event before acting, so transient pauses
           from X's own player init / buffering /
           NSFW overlay dismissal don't trigger a
           premature play() that then races with
           X's internal state machine.
        ══════════════════════════════════════ */
        _attachPauseGuardian(video) {
            this._detachPauseGuardian();
            this._guardedVideo   = video;
            this._userPaused     = false;
            this._guardianActive = true;
            this._guardDebounce  = null;

            this._pauseGuardianCb = () => {
                if (!this._guardianActive || this.displayedEl !== video) return;
                if (this._userPaused) return;

                // Debounce: only react if still paused after 180 ms
                clearTimeout(this._guardDebounce);
                this._guardDebounce = setTimeout(() => {
                    if (!this._guardianActive || this.displayedEl !== video) return;
                    if (this._userPaused || !video.paused) return; // recovered on its own
                    video.muted = true;
                    video.play().then(() => {
                        video.muted        = this.muted;
                        video.volume       = this.volume;
                        video.playbackRate = this.playbackRate;
                    }).catch(() => {});
                }, 180);
            };

            video.addEventListener('pause', this._pauseGuardianCb);
        }

        _detachPauseGuardian() {
            clearTimeout(this._guardDebounce);
            this._guardDebounce = null;
            if (this._guardedVideo && this._pauseGuardianCb) {
                this._guardedVideo.removeEventListener('pause', this._pauseGuardianCb);
            }
            this._guardedVideo    = null;
            this._pauseGuardianCb = null;
            this._guardianActive  = false;
            this._userPaused      = false;
        }

        /**
         * Wait until the video element has enough data to play
         * (readyState >= HAVE_FUTURE_DATA = 3), up to `ms` milliseconds.
         */
        _waitForReady(video, ms = 3000) {
            if (video.readyState >= 3) return Promise.resolve();
            return new Promise(resolve => {
                const done = () => { clearTimeout(timer); resolve(); };
                const timer = setTimeout(done, ms);
                video.addEventListener('canplay', done, { once: true });
            });
        }

        async _tryPlay(video) {
            const maxAttempts = 15;

            await this._waitForReady(video, 4000);
            if (!this.isActive || this.displayedEl !== video) { video.pause(); return; }

            for (let i = 0; i < maxAttempts; i++) {
                if (!this.isActive || this.displayedEl !== video) { video.pause(); return; }

                if (!video.paused) {
                    // Already playing — just unmute and guard
                    video.muted  = this.muted;
                    video.volume = this.volume;
                    video.playbackRate = this.playbackRate;
                    // Start interval to fight any delayed NSFW re-mute
                    this._startUnmuteInterval(video);
                    this._attachPauseGuardian(video);
                    return;
                }

                try {
                    video.muted = true; // muted required for autoplay policy
                    await video.play();

                    // Small settle window
                    await new Promise(r => setTimeout(r, 100));
                    if (!this.isActive || this.displayedEl !== video) { video.pause(); return; }

                    if (video.paused) {
                        await new Promise(r => setTimeout(r, 300));
                        continue;
                    }

                    // Playing — unmute then start the interval to fight NSFW re-mutes
                    video.muted  = this.muted;
                    video.volume = this.volume;
                    video.playbackRate = this.playbackRate;
                    this._startUnmuteInterval(video);
                    this._attachPauseGuardian(video);
                    return;
                } catch (err) {
                    await new Promise(r => setTimeout(r, err?.name === 'AbortError' ? 400 : 300));
                }
            }

            // Fallback: native controls
            video.controls = true;
            video.muted    = this.muted;
            video.volume   = this.volume;
        }

        /* ══════════════════════════════════════
           UI UPDATE
        ══════════════════════════════════════ */
        _updateUI() {
            if (!this.container || !this.post.element) return;
            const item = this.post.mediaItems[this.post.currentMediaIndex];
            if (!item) return;

            const info = this.container.querySelector('#xr-info');
            info.innerHTML = `
                <div class="xr-author-row">
                    ${item.avatar ? `<img class="xr-avatar" src="${item.avatar}" alt="">` : ''}
                    <div>
                        <div class="xr-author-name" data-handle="${item.handle}">${item.author}</div>
                        ${item.handle ? `<div class="xr-author-handle">@${item.handle}</div>` : ''}
                    </div>
                </div>
                ${item.text ? `<div class="xr-tweet-text">${item.text.replace(/</g,'&lt;')}</div>` : ''}
            `;
            info.querySelector('.xr-author-name')?.addEventListener('click', () => {
                if (item.handle) window.open(`https://x.com/${item.handle}`, '_blank');
            });

            this._renderStats();

            const dotsEl = this.container.querySelector('#xr-dots');
            const n = this.post.mediaItems.length;
            if (n > 1) {
                dotsEl.innerHTML = this.post.mediaItems.map((_, i) =>
                    `<div class="xr-dot ${i === this.post.currentMediaIndex ? 'active' : ''}"></div>`
                ).join('');
                dotsEl.style.display = 'flex';
            } else {
                dotsEl.style.display = 'none';
            }

            const likedEl = this.post.element.querySelector('[data-testid="unlike"]');
            if (likedEl) this.btnLike.classList.add('xr-btn--liked');
            else         this.btnLike.classList.remove('xr-btn--liked');

            // Follow state is resolved live in _inferFollowState() (API lookup);
            // don't override it here or it flashes the wrong icon.

            const bmedEl = this.post.element.querySelector('[data-testid="removeBookmark"]');
            const bmPath = this.btnBookmark?.querySelector('.bm-path');
            if (bmedEl) {
                this.btnBookmark?.classList.add('xr-btn--bookmarked');
                if (bmPath) bmPath.setAttribute('fill', '#FFD700');
            } else {
                this.btnBookmark?.classList.remove('xr-btn--bookmarked');
                if (bmPath) { bmPath.setAttribute('fill', 'none'); bmPath.setAttribute('stroke', 'rgba(255,215,0,0.8)'); }
            }
        }

        /* ══════════════════════════════════════
           LIVE TWEET STATS (read from the post's own DOM)
        ══════════════════════════════════════ */
        _grabStat(...testids) {
            for (const t of testids) {
                const el = this.post.element?.querySelector(`[data-testid="${t}"]`);
                if (!el) continue;
                const span = el.querySelector('[data-testid="app-text-transition-container"]');
                let txt = span ? span.textContent.trim() : '';
                if (!txt) {
                    const m = (el.getAttribute('aria-label') || '').match(/[\d.,]+\s*[KMB]?/i);
                    txt = m ? m[0].replace(/\s/g, '') : '';
                }
                return txt || '0';
            }
            return null;
        }
        _grabViews() {
            const el = this.post.element?.querySelector('a[href$="/analytics"], [data-testid="app-text-transition-container"][aria-hidden]');
            const a  = this.post.element?.querySelector('a[href$="/analytics"]');
            if (a) {
                const span = a.querySelector('[data-testid="app-text-transition-container"]');
                if (span && span.textContent.trim()) return span.textContent.trim();
                const m = (a.getAttribute('aria-label') || '').match(/[\d.,]+\s*[KMB]?/i);
                if (m) return m[0].replace(/\s/g, '');
            }
            return null;
        }
        _renderStats() {
            const wrap = this.container?.querySelector('#xr-stats');
            if (!wrap || !this.post.element) return;
            const vals = {
                views:   this._grabViews(),
                likes:   this._grabStat('like', 'unlike'),
                reposts: this._grabStat('retweet', 'unretweet'),
                replies: this._grabStat('reply'),
            };
            for (const k of Object.keys(vals)) {
                const span = wrap.querySelector(`.xr-stat[data-k="${k}"] .xr-stat-v`);
                if (!span) continue;
                const nv = (vals[k] == null || vals[k] === '') ? '–' : vals[k];
                if (span.textContent !== nv) {
                    span.textContent = nv;
                    span.classList.remove('bump'); void span.offsetWidth; span.classList.add('bump');
                }
            }
            wrap.style.display = 'flex';
        }

        /* ══════════════════════════════════════
           FOLLOW  (X internal web API — no menu puppetry)

           Uses the same private endpoints x.com calls itself, authed by the
           logged-in user's own cookies. Nothing secret is stored in this file:
           - auth_token attaches automatically (credentials:'include', same origin)
           - ct0 (csrf) is read live from document.cookie
           - the Bearer is X's PUBLIC web token (identical for every visitor)
        ══════════════════════════════════════ */
        // Public web bearer (not account-specific, safe to ship). Falls back to
        // a scraped one if X ever rotates it.
        _xBearer() {
            return this._bearerOverride ||
                'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';
        }
        _xCsrf() {
            return (document.cookie.match(/(?:^|;\s*)ct0=([^;]+)/) || [])[1] || '';
        }
        _xHeaders(extra = {}) {
            return Object.assign({
                'authorization':          'Bearer ' + this._xBearer(),
                'x-csrf-token':           this._xCsrf(),
                'x-twitter-auth-type':    'OAuth2Session',
                'x-twitter-active-user':  'yes',
            }, extra);
        }
        /** Live follow state for a handle → true/false, or null on failure. */
        async _apiFollowState(handle) {
            if (!handle) return null;
            try {
                const r = await fetch(
                    'https://x.com/i/api/1.1/friendships/lookup.json?screen_name=' + encodeURIComponent(handle),
                    { method: 'GET', credentials: 'include', headers: this._xHeaders() });
                if (!r.ok) return null;
                const d = await r.json();
                const conns = (Array.isArray(d) && d[0]?.connections) || [];
                return conns.includes('following');
            } catch { return null; }
        }
        /** Follow / unfollow via the create|destroy endpoints. → true on success. */
        async _apiSetFollow(handle, follow) {
            if (!handle) return false;
            const ep = follow ? 'create' : 'destroy';
            try {
                const r = await fetch(
                    'https://x.com/i/api/1.1/friendships/' + ep + '.json',
                    { method: 'POST', credentials: 'include',
                      headers: this._xHeaders({ 'content-type': 'application/x-www-form-urlencoded' }),
                      body: 'screen_name=' + encodeURIComponent(handle) });
                return r.ok;
            } catch { return false; }
        }

        _inferFollowState(article, tweetId) {
            const handle = this._currentHandle();
            // Don't flash a wrong state: leave the button as-is until the live
            // lookup returns (~100ms). Sequence token avoids races on fast scroll.
            const seq = (this._followSeq = (this._followSeq || 0) + 1);
            if (!handle) { this._applyFollowUI(false); return; }
            this._apiFollowState(handle).then(state => {
                if (seq !== this._followSeq) return;              // navigated away
                if (state === null) { this._peekFollowState(article, tweetId); return; } // API failed → fallback
                this._applyFollowUI(state);
            });
        }

        _currentHandle() {
            const h = this.post.mediaItems[this.post.currentMediaIndex]?.handle
                   || this.post.mediaItems[0]?.handle || '';
            return h.split('/')[0].replace(/^@/, '');
        }

        /* Fallback only — used if the API call fails (e.g. X changed something) */
        async _peekFollowState(article, tweetId) {
            if (this._followBusy) return;
            const caret = article.querySelector('[data-testid="caret"]');
            if (!caret) return;
            try {
                caret.click();
                await new Promise(r => setTimeout(r, 350));
                if (this.post.id !== tweetId) { this._closeMenu(); return; }
                let isFollowing = false, found = false;
                for (const el of document.querySelectorAll('[role="menuitem"]')) {
                    const txt = (el.textContent ?? '').trim();
                    if (/unfollow/i.test(txt))                                              { isFollowing = true;  found = true; break; }
                    if (/^follow/i.test(txt) && !/muted/i.test(txt) && !/list/i.test(txt)) { isFollowing = false; found = true; break; }
                }
                this._closeMenu();
                if (!found || this.post.id !== tweetId) return;
                this._applyFollowUI(isFollowing);
            } catch {
                try { this._closeMenu(); } catch {}
            }
        }

        _applyFollowUI(following) {
            if (!this.btnFollow) return;
            const folV   = this.btnFollow.querySelector('.fol-v');
            const folH   = this.btnFollow.querySelector('.fol-h');
            const check  = this.btnFollow.querySelector('.fol-check');
            if (following) {
                this.btnFollow.classList.add('xr-btn--following');
                if (folV)  { folV.style.opacity = '0'; folV.style.transform = 'scale(0)'; }
                if (folH)  { folH.style.opacity = '0'; folH.style.transform = 'scale(0)'; }
                if (check) { check.style.opacity = '1'; check.style.transform = 'scale(1)'; }
            } else {
                this.btnFollow.classList.remove('xr-btn--following');
                if (folV)  { folV.style.opacity = '1'; folV.style.transform = 'scale(1)'; }
                if (folH)  { folH.style.opacity = '1'; folH.style.transform = 'scale(1)'; }
                if (check) { check.style.opacity = '0'; check.style.transform = 'scale(0)'; }
            }
        }

        /* ══════════════════════════════════════
           ACTIONS
        ══════════════════════════════════════ */
        async toggleLike() {
            if (!this.post.element) return;
            const btn = this.post.element.querySelector('[data-testid="like"], [data-testid="unlike"]');
            if (!btn) return;
            btn.click();
            await new Promise(r => setTimeout(r, 200));
            const nowLiked = !!this.post.element.querySelector('[data-testid="unlike"]');
            this.btnLike.classList.remove('xr-btn--heart-anim');
            void this.btnLike.offsetWidth;
            this.btnLike.classList.add('xr-btn--heart-anim');
            if (nowLiked) {
                this.btnLike.classList.add('xr-btn--liked');
                this.toast.show('❤️  Liked!', 'like');
            } else {
                this.btnLike.classList.remove('xr-btn--liked');
                this.toast.show('Like removed', 'info');
            }
            setTimeout(() => this.btnLike.classList.remove('xr-btn--heart-anim'), 600);
        }

        async toggleFollow() {
            if (!this.post.element || this._followBusy) return;
            const handle = this._currentHandle();
            if (!handle) { this.toast.show('No author found', 'error'); return; }

            const wasFollowing = this.btnFollow?.classList.contains('xr-btn--following');
            const willFollow   = !wasFollowing;

            // Optimistic: flip the icon instantly, fire API in background.
            this._applyFollowUI(willFollow);
            this._followBusy = true;
            try {
                const ok = await this._apiSetFollow(handle, willFollow);
                if (ok) {
                    this.toast.show(willFollow ? '✅ Following!' : 'Unfollowed',
                                    willFollow ? 'follow' : 'info');
                } else {
                    // API failed → revert + fall back to the old menu method
                    this._applyFollowUI(wasFollowing);
                    this._followBusy = false;
                    return this._toggleFollowViaMenu();
                }
            } finally {
                this._followBusy = false;
            }
        }

        /* Fallback toggle via the caret menu (only if the API errors out) */
        async _toggleFollowViaMenu() {
            if (!this.post.element || this._followBusy) return;
            this._followBusy = true;
            try {
                const caret = this.post.element.querySelector('[data-testid="caret"]');
                if (!caret) { this.toast.show('Follow failed', 'error'); return; }
                caret.click();
                await new Promise(r => setTimeout(r, 400));
                let menuItem = null;
                for (const el of document.querySelectorAll('[role="menuitem"]')) {
                    if (/follow/i.test(el.textContent)) { menuItem = el; break; }
                }
                if (!menuItem) { this._closeMenu(); return; }
                const wasFollowing = /unfollow/i.test(menuItem.textContent);
                menuItem.click();
                await new Promise(r => setTimeout(r, 300));
                const confirm = document.querySelector('[data-testid="confirmationSheetConfirm"]');
                if (confirm) { confirm.click(); await new Promise(r => setTimeout(r, 250)); }
                const nowFollowing = !wasFollowing;
                this._applyFollowUI(nowFollowing);
                this.toast.show(nowFollowing ? '✅ Following!' : 'Unfollowed', nowFollowing ? 'follow' : 'info');
            } finally {
                this._followBusy = false;
            }
        }

        async toggleBookmark() {
            if (!this.post.element) return;
            const btn = this.post.element.querySelector('[data-testid="bookmark"], [data-testid="removeBookmark"]');
            if (!btn) return;
            btn.click();
            await new Promise(r => setTimeout(r, 200));
            const nowBookmarked = !!this.post.element.querySelector('[data-testid="removeBookmark"]');
            const bmPath = this.btnBookmark?.querySelector('.bm-path');
            if (nowBookmarked) {
                this.btnBookmark?.classList.add('xr-btn--bookmarked');
                if (bmPath) { bmPath.setAttribute('fill', '#FFD700'); bmPath.setAttribute('stroke', '#FFD700'); }
                this.toast.show('🔖 Bookmarked!', 'bookmark');
            } else {
                this.btnBookmark?.classList.remove('xr-btn--bookmarked');
                if (bmPath) { bmPath.setAttribute('fill', 'none'); bmPath.setAttribute('stroke', 'rgba(255,215,0,0.8)'); }
                this.toast.show('Bookmark removed', 'info');
            }
        }

        _openTweet() {
            if (!this.post.id) return;
            const handle = this.post.mediaItems[this.post.currentMediaIndex]?.handle;
            if (handle) window.open(`https://x.com/${handle}/status/${this.post.id}`, '_blank');
        }

        /* ══════════════════════════════════════
           VIDEO FIT — contain (fit) / zoom / cover (fill)
        ══════════════════════════════════════ */
        _fitIcon(mode) {
            const c = 'rgba(220,220,230,0.92)';
            const open = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">`;
            if (mode === 'cover')  // FILL — four arrows expanding to the corners
                return `${open}<path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>`;
            if (mode === 'zoom')   // ZOOM — magnifying glass with a plus
                return `${open}<circle cx="10.5" cy="10.5" r="6.5"/><line x1="20" y1="20" x2="15.5" y2="15.5"/><line x1="10.5" y1="7.8" x2="10.5" y2="13.2"/><line x1="7.8" y1="10.5" x2="13.2" y2="10.5"/></svg>`;
            // FIT — a screen with letterbox bars top & bottom
            return `${open}<rect x="3" y="6" width="18" height="12" rx="2"/><line x1="3" y1="9.6" x2="21" y2="9.6"/><line x1="3" y1="14.4" x2="21" y2="14.4"/></svg>`;
        }
        // Apply the current fit mode by setting a class on the media wrapper.
        // CSS (with !important) drives object-fit/transform so X's player can't
        // wipe it on play/unpause.
        _applyFit() {
            const wrap = this.mediaWrapper?.querySelector('.xr-media-enter') || this.mediaWrapper?.firstElementChild;
            if (!wrap) return;
            this._wrap = wrap;
            wrap.classList.remove('xr-fit-contain', 'xr-fit-zoom', 'xr-fit-cover');
            wrap.classList.add('xr-fit-' + this.videoFit);
        }
        // Pan helper. _panX stays a 0..100 value (50 = centred) so the drag
        // handlers don't need to know the geometry, but we translate it into a
        // pixel `left` offset for the oversized zoom element. The element is
        // XR_ZOOM× wide, so it overflows the viewport by (XR_ZOOM-1)·width total;
        // half of that is pannable on each side.
        _setPan(p) {
            p = Math.max(0, Math.min(100, p));
            this._panX = p;
            const overflow = (XR_ZOOM - 1) * (window.innerWidth || 400) / 2;
            const px = (50 - p) / 50 * overflow;
            if (this._wrap) this._wrap.style.setProperty('--xr-pan-x-px', px.toFixed(1) + 'px');
        }
        toggleFit() {
            const next = { contain: 'zoom', zoom: 'cover', cover: 'contain' };
            this.videoFit = next[this.videoFit] || 'contain';
            localStorage.setItem('xr_fit', this.videoFit);
            if (this.btnFit) this.btnFit.innerHTML = this._fitIcon(this.videoFit);
            this._applyFit();
            const label = { contain: 'Fit screen', zoom: 'Zoom', cover: 'Fill screen' };
            this.toast.show(label[this.videoFit], 'info', 1000);
        }

        /* ══════════════════════════════════════
           AUTO SCROLL
        ══════════════════════════════════════ */
        _startAuto() {
            this._stopAuto();
            if (!this.isActive || this.autoDelay === 0) return;

            if (this.autoDelay === -1) {
                const video = this.displayedEl;
                if (video?.tagName === 'VIDEO') {
                    this.videoEndedCb = () => {
                        if (!this.isActive) return;
                        if (!this._navMedia('next')) this._navPost('next');
                    };
                    video.addEventListener('ended', this.videoEndedCb);
                } else {
                    this.autoTimerId = setTimeout(() => { if (!this._navMedia('next')) this._navPost('next'); }, 3000);
                }
            } else {
                this.autoTimerId = setTimeout(() => { if (!this._navMedia('next')) this._navPost('next'); }, this.autoDelay);
            }
        }

        _stopAuto() {
            clearTimeout(this.autoTimerId); this.autoTimerId = null;
            if (this.videoEndedCb && this.displayedEl) {
                this.displayedEl.removeEventListener('ended', this.videoEndedCb);
                this.videoEndedCb = null;
            }
        }

        /* ══════════════════════════════════════
           PRELOAD
        ══════════════════════════════════════ */
        _preloadNext() {
            const next = this._findNextArticle(this.post.element, false);
            if (!next) return;
            const id = this._tweetId(next);
            if (!id || this._preloadCache.has(id)) return;
            const items = this._extractMedia(next);
            this._preloadCache.set(id, items);
            items.filter(i => i.type === 'image').forEach(i => { const img = new Image(); img.src = i.src; });
        }

        /* ══════════════════════════════════════
           RESTORE / CLEANUP
        ══════════════════════════════════════ */
        _restoreMedia() {
            this._detachPauseGuardian();
            this._stopUnmuteInterval();
            if (!this.displayedEl) return;
            const el = this.displayedEl;
            if (el.tagName === 'VIDEO') {
                el.pause();
                const mediaObj = this.post.mediaItems?.find(i => i.originalElement === el);
                if (mediaObj?.placeholder?.parentNode) {
                    mediaObj.placeholder.parentNode.replaceChild(el, mediaObj.placeholder);
                } else if (el.parentNode) {
                    el.remove();
                }
                el.style.cssText = '';
            }
            this.displayedEl = null;
        }

        /* ══════════════════════════════════════
           SCRUB FLASH
        ══════════════════════════════════════ */
        _showScrubFlash(msg) {
            clearTimeout(this.scrubFlashTimerId);
            document.querySelectorAll('.xr-scrub-flash').forEach(e => e.remove());
            if (!this.mediaWrapper) return;
            const el = document.createElement('div');
            el.className = 'xr-scrub-flash';
            el.textContent = msg;
            this.mediaWrapper.appendChild(el);
            this.scrubFlashTimerId = setTimeout(() => el.remove(), 900);
        }

        /* ══════════════════════════════════════
           ARTICLE FINDERS
        ══════════════════════════════════════ */
        _findCentralArticle() {
            const arts = Array.from(document.querySelectorAll('article[role="article"]'));
            const cy   = window.innerHeight / 2;
            let best = null, bestD = Infinity;
            for (const a of arts) {
                if (!this._articleHasMedia(a)) continue;
                const r = a.getBoundingClientRect();
                if (r.bottom < 0 || r.top > window.innerHeight) continue;
                const d = Math.abs(cy - (r.top + r.height / 2));
                if (d < bestD) { bestD = d; best = a; }
            }
            return best;
        }

        _findNextArticle(current, prev = false) {
            const arts = Array.from(document.querySelectorAll('article[role="article"]'));
            let ci = current ? arts.indexOf(current) : -1;
            // X virtualises the timeline: the current article may have been
            // unmounted. Relocate it by tweet id …
            if (ci === -1 && this.post.id) {
                ci = arts.findIndex(a => this._tweetId(a) === this.post.id);
            }
            // … or, failing that, by whichever article is nearest viewport centre.
            if (ci === -1) {
                const cy = window.innerHeight / 2;
                let bd = Infinity;
                arts.forEach((a, i) => {
                    const r = a.getBoundingClientRect();
                    const d = Math.abs(cy - (r.top + r.height / 2));
                    if (d < bd) { bd = d; ci = i; }
                });
            }
            const step = prev ? -1 : 1;
            for (let i = ci + step; prev ? i >= 0 : i < arts.length; i += step) {
                if (this._articleHasMedia(arts[i])) return arts[i];
            }
            return null;
        }

        _articleHasMedia(article) {
            // v30.5: try several selector variants so X tweaking one data-testid
            // doesn't silently break detection.
            const sels = [
                'div[data-testid="videoPlayer"] video',
                'div[data-testid="tweetPhoto"] img',
                'div[aria-label="Embedded video"] video',
                'video[poster*="ext_tw_video_thumb"]',
                'img[src*="pbs.twimg.com/media/"]',
            ];
            for (const sel of sels) {
                for (const el of article.querySelectorAll(sel)) {
                    if (this._validMedia(el)) return true;
                }
            }
            return false;
        }

        /* ══════════════════════════════════════
           HELPERS
        ══════════════════════════════════════ */
        _validMedia(el) {
            if (!el) return false;
            if (el.tagName === 'VIDEO') return !!el.closest('[data-testid="videoPlayer"]') && el.readyState >= 0;
            if (el.tagName === 'IMG')  return el.src?.includes('pbs.twimg.com/media/') && !el.src.includes('video_thumb');
            return false;
        }

        _fullImageUrl(img) {
            if (!img?.src) return '';
            try {
                const u = new URL(img.src);
                u.searchParams.set('name', 'orig');
                return u.href;
            } catch { return img.src; }
        }

        _tweetId(article) {
            const link = article?.querySelector('a[href*="/status/"]');
            return link?.href.match(/\/status\/(\d+)/)?.[1] ?? null;
        }

        _closeMenu() {
            const caret = this.post.element?.querySelector('[data-testid="caret"]');
            if (caret?.getAttribute('aria-expanded') === 'true') { caret.click(); return; }
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        }

        _ripple(btn) {
            const r = document.createElement('div');
            r.className = 'xr-ripple-effect';
            btn.appendChild(r);
            setTimeout(() => r.remove(), 700);
        }

        _showLoading() { const el = this.container?.querySelector('#xr-loading'); if (el) el.style.display = 'block'; }
        _hideLoading() { const el = this.container?.querySelector('#xr-loading'); if (el) el.style.display = 'none'; }

        /* ══════════════════════════════════════
           GLOBAL EVENTS
        ══════════════════════════════════════ */
        _setupGlobalListeners() {
            document.addEventListener('wheel',   this._onWheel,   { passive: false, capture: true });
            document.addEventListener('keydown', this._onKeydown, { capture: true });
        }

        _handleWheel(e) {
            if (!this.isActive) return;
            e.preventDefault();
            e.stopPropagation();
            const now = Date.now();
            if (now - this.lastWheelTime < this.wheelCooldown) return;
            this.lastWheelTime = now;
            if (e.deltaY > 0) { if (!this._navMedia('next')) this._navPost('next'); }
            else              { if (!this._navMedia('prev')) this._navPost('prev'); }
        }

        _handleKeydown(e) {
            const key = e.key.toLowerCase();

            if (key === 'x') {
                e.preventDefault(); e.stopImmediatePropagation();
                this.isActive ? this.exit() : this.start();
                return;
            }
            if (!this.isActive) return;

            const inInput = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA';
            if (inInput) { if (key === 'q') this.exit(); return; }

            e.preventDefault(); e.stopImmediatePropagation();

            const video = this.displayedEl?.tagName === 'VIDEO' ? this.displayedEl : null;

            const map = {
                'q':          () => this.exit(),
                'arrowup':    () => this._navPost('prev'),
                'arrowdown':  () => this._navPost('next'),
                'arrowleft':  () => this._navMedia('prev'),
                'arrowright': () => this._navMedia('next'),
                ' ':          () => {
                    if (!video) return;
                    if (video.paused) {
                        this._userPaused = false;
                        video.muted = true;
                        video.play().then(() => { video.muted = this.muted; video.volume = this.volume; video.playbackRate = this.playbackRate; }).catch(() => {});
                    } else {
                        this._userPaused = true;
                        video.pause();
                    }
                },
                ',':          () => { if (video) { video.currentTime = Math.max(0, video.currentTime - 5); this._showScrubFlash('⏪ -5s'); } },
                '<':          () => { if (video) { video.currentTime = Math.max(0, video.currentTime - 5); this._showScrubFlash('⏪ -5s'); } },
                '.':          () => { if (video) { video.currentTime = Math.min(video.duration||0, video.currentTime + 5); this._showScrubFlash('⏩ +5s'); } },
                '>':          () => { if (video) { video.currentTime = Math.min(video.duration||0, video.currentTime + 5); this._showScrubFlash('⏩ +5s'); } },
                'l':          () => this.toggleLike(),
                'f':          () => this.toggleFollow(),
                'b':          () => this.toggleBookmark(),
                'm':          () => {
                    if (video) {
                        this.muted = !this.muted;
                        video.muted = this.muted;
                        localStorage.setItem('xr_muted', this.muted);
                        this.toast.show(this.muted ? '🔇 Muted' : '🔊 Unmuted', 'info', 1000);
                    }
                },
                'p':          () => {
                    if (!video) return;
                    if (document.pictureInPictureElement) document.exitPictureInPicture().catch(()=>{});
                    else video.requestPictureInPicture().catch(()=>{});
                },
            };

            const handler = map[key] ?? map[e.key];
            if (handler) handler();
        }
    }

    /* ─────────────────────────────────────────────
       BOOT
    ───────────────────────────────────────────── */
    function boot() {
        if (window._xReelsInstance) {
            try {
                const old = window._xReelsInstance;
                document.removeEventListener('wheel',   old._onWheel,   { capture: true });
                document.removeEventListener('keydown', old._onKeydown, { capture: true });
                if (old.isActive) old.exit();
            } catch {}
            window._xReelsInstance = null;
        }

        const instance = new XReels();
        window._xReelsInstance = instance;
        instance.init();
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        boot();
    } else {
        document.addEventListener('DOMContentLoaded', boot);
    }
})();