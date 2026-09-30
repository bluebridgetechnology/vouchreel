var Vouchreel=(()=>{var L=Object.defineProperty;var V=Object.getOwnPropertyDescriptor;var $=Object.getOwnPropertyNames;var z=Object.prototype.hasOwnProperty;var U=(r,e)=>{for(var t in e)L(r,t,{get:e[t],enumerable:!0})},j=(r,e,t,i)=>{if(e&&typeof e=="object"||typeof e=="function")for(let n of $(e))!z.call(r,n)&&n!==t&&L(r,n,{get:()=>e[n],enumerable:!(i=V(e,n))||i.enumerable});return r};var q=r=>j(L({},"__esModule",{value:!0}),r);var Z={};U(Z,{AnalyticsTracker:()=>y,VouchreelWidget:()=>b,createVideoPlayer:()=>C,filterTestimonials:()=>E,initLoader:()=>I,isPageAllowed:()=>w,matchPattern:()=>g,matchTags:()=>P,setupTrigger:()=>T,startWidget:()=>A});function x(r){if(!r)return"/";let e=r.split("?")[0].split("#")[0].trim();return e.length>1&&e.endsWith("/")&&(e=e.slice(0,-1)),e.startsWith("/")||(e="/"+e),e}function O(r){let e=x(r);if(e==="/*"||e==="/**")return/^.*$/;let t="",i=0;for(;i<e.length;){let n=e[i];n==="*"&&e[i+1]==="*"?(t+=".*",i+=2):n==="*"?(t+="[^/]+",i+=1):["\\",".","^","$","+","?","(",")","[","]","{","}","|"].includes(n)?(t+="\\"+n,i+=1):(t+=n,i+=1)}return new RegExp(`^${t}(?:/)?$`,"i")}function g(r,e){if(!r)return!1;let t=r.trim();if(t==="*"||t==="/*"||t==="/**")return!0;let i=x(e);return O(t).test(i)}function P(r,e){if(!r||r.length===0)return!0;if(!e||e.length===0)return!1;let t=e.map(i=>i.trim().toLowerCase());return r.some(i=>t.includes(i.trim().toLowerCase()))}function D(){if(typeof document>"u")return[];let r=document.body?.getAttribute("data-vouchreel-tags");if(r)return r.split(",").map(t=>t.trim()).filter(Boolean);let e=document.querySelector('meta[name="vouchreel-tags"]');if(e){let t=e.getAttribute("content");if(t)return t.split(",").map(i=>i.trim()).filter(Boolean)}return[]}function w(r,e="/"){if(!r)return!0;let t=x(e);if(r.pagesExcluded&&r.pagesExcluded.length>0){for(let i of r.pagesExcluded)if(i&&g(i,t))return!1}return r.pagesIncluded&&r.pagesIncluded.length>0?r.pagesIncluded.some(n=>n==="*"||n==="/*"||n==="/**")?!0:r.pagesIncluded.some(n=>g(n,t)):!0}function E(r,e={pathname:"/"},t=D()){if(!Array.isArray(r)||r.length===0)return[];let i=x(e.pathname);return r.filter(n=>{let o=n.matchRules;if(!o||!o.mode||o.mode==="all")return!0;if(o.mode==="specific"){let a=!1;Array.isArray(o.urlPatterns)&&o.urlPatterns.length>0?a=o.urlPatterns.some(d=>g(d,i)):a=!0;let m=P(o.tags,t);return a&&m}return!0})}function k(r){if(typeof window>"u"||!window.sessionStorage)return!1;try{return window.sessionStorage.getItem(`vouchreel_dismissed_${r}`)==="true"}catch{return!1}}function R(r){if(!(typeof window>"u"||!window.sessionStorage))try{window.sessionStorage.setItem(`vouchreel_dismissed_${r}`,"true")}catch{}}function Y(){return typeof window>"u"||typeof navigator>"u"?!1:navigator.maxTouchPoints>0||/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)}function T({type:r,value:e,embedKey:t,onTrigger:i}){if(k(t))return{cancel:()=>{}};let n=!1,o=()=>{n||k(t)||(n=!0,c(),i())},a=null,m=null,d=null,f=[],c=()=>{a!==null&&(clearTimeout(a),a=null),m&&(m.disconnect(),m=null),d&&d.parentNode&&(d.parentNode.removeChild(d),d=null);for(let u of f)try{u()}catch{}f=[]};switch(r){case"delay":{let u=e&&typeof e.seconds=="number"&&e.seconds>0?e.seconds:3;a=setTimeout(o,u*1e3);break}case"exit-intent":{if(typeof window>"u"||typeof document>"u")break;if(Y()){let p=window.scrollY||window.pageYOffset,s=Date.now(),v=()=>{let l=window.scrollY||window.pageYOffset,h=Date.now(),M=l-p,N=h-s;l>150&&M<-40&&N>0&&N<200&&o(),p=l,s=h};window.addEventListener("scroll",v,{passive:!0}),f.push(()=>window.removeEventListener("scroll",v))}else{let p=s=>{(s.clientY<=0||!s.relatedTarget)&&o()};document.addEventListener("mouseleave",p),f.push(()=>document.removeEventListener("mouseleave",p))}break}case"scroll-depth":{if(typeof window>"u"||typeof document>"u")break;let u=e&&typeof e.percentage=="number"&&e.percentage>0?Math.min(Math.max(e.percentage,1),100):50;if(typeof IntersectionObserver<"u"&&document.body)try{d=document.createElement("div"),d.className="vouchreel-scroll-sentinel",d.style.position="absolute",d.style.top=`${u}%`,d.style.left="0",d.style.width="1px",d.style.height="1px",d.style.pointerEvents="none",d.style.opacity="0",d.style.zIndex="-1",document.body.appendChild(d),m=new IntersectionObserver(s=>{for(let v of s)if(v.isIntersecting){o();break}}),m.observe(d)}catch{}let p=()=>{let s=window.scrollY||document.documentElement.scrollTop||document.body.scrollTop||0,v=document.documentElement.scrollHeight||document.body.scrollHeight||1,l=window.innerHeight||document.documentElement.clientHeight||1,h=v-l;if(h<=0){a=setTimeout(o,1500);return}s/h*100>=u&&o()};window.addEventListener("scroll",p,{passive:!0}),f.push(()=>window.removeEventListener("scroll",p)),p();break}case"pageview-count":{if(typeof window>"u"||!window.sessionStorage){o();break}let u=e&&typeof e.count=="number"&&e.count>0?e.count:2,p=1;try{let s=window.sessionStorage.getItem("vouchreel_pv_count");p=s?parseInt(s,10)+1:1,window.sessionStorage.setItem("vouchreel_pv_count",p.toString())}catch{}p>=u&&(a=setTimeout(o,800));break}case"returning-visitor":{if(typeof window>"u"||!window.localStorage){o();break}try{window.localStorage.getItem("vouchreel_visited")==="true"?a=setTimeout(o,1e3):window.localStorage.setItem("vouchreel_visited","true")}catch{a=setTimeout(o,2e3)}break}default:{a=setTimeout(o,3e3);break}}return{cancel:c}}function S(){if(typeof crypto<"u"&&typeof crypto.randomUUID=="function")try{return crypto.randomUUID()}catch{}return"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,r=>{let e=Math.random()*16|0;return(r==="x"?e:e&3|8).toString(16)})}function F(){if(typeof window>"u"||!window.sessionStorage)return S();let r="vouchreel_session_id";try{let e=window.sessionStorage.getItem(r);if(e&&e.length>=10)return e;let t=S();return window.sessionStorage.setItem(r,t),t}catch{return S()}}var y=class{spaceId;apiBase;sessionId;conversionGoals;queue=[];flushTimer=null;flushIntervalMs;isDestroyed=!1;constructor(e){this.spaceId=e.spaceId,this.apiBase=e.apiBase?e.apiBase.replace(/\/+$/,""):"",this.sessionId=F(),this.conversionGoals=e.conversionGoals||[],this.flushIntervalMs=e.flushIntervalMs??5e3,this.bindLifecycleListeners(),this.checkConversionGoals()}track(e,t,i){if(this.isDestroyed||!this.spaceId)return;let n=typeof window<"u"&&window.location?window.location.href.split("#")[0]:"",o={spaceId:this.spaceId,testimonialId:t||null,sessionId:this.sessionId,eventType:e,pageUrl:n,timestamp:new Date().toISOString(),metadata:i||null};if(this.queue.push(o),e==="impression"||e==="play")try{window.sessionStorage.setItem("vouchreel_engaged","true")}catch{}this.scheduleFlush()}checkConversionGoals(){if(typeof window>"u"||!window.location||!this.conversionGoals||this.conversionGoals.length===0)return;let e=window.location.pathname;for(let t of this.conversionGoals)if(t.goalType==="url-match"&&t.goalValue&&g(t.goalValue,e)){let i=`vouchreel_converted_${t.id}`;try{if(window.sessionStorage.getItem(i)==="true")continue;window.sessionStorage.setItem(i,"true")}catch{}this.track("convert",null,{goalId:t.id,goalValue:t.goalValue})}}flush(){if(this.queue.length===0)return;this.flushTimer!==null&&(clearTimeout(this.flushTimer),this.flushTimer=null);let e=[...this.queue];this.queue=[];let t=`${this.apiBase}/api/events`,i=JSON.stringify({events:e});if(typeof navigator<"u"&&typeof navigator.sendBeacon=="function")try{let n=new Blob([i],{type:"application/json"});if(navigator.sendBeacon(t,n))return}catch{}if(typeof fetch=="function")try{fetch(t,{method:"POST",headers:{"Content-Type":"application/json"},body:i,keepalive:!0}).catch(()=>{})}catch{}}scheduleFlush(){this.flushTimer===null&&(this.flushTimer=setTimeout(()=>{this.flushTimer=null,this.flush()},this.flushIntervalMs))}bindLifecycleListeners(){if(typeof document>"u"||typeof window>"u")return;let e=()=>{document.visibilityState==="hidden"&&this.flush()},t=()=>{this.flush()};document.addEventListener("visibilitychange",e),window.addEventListener("pagehide",t),window.addEventListener("beforeunload",t)}destroy(){this.isDestroyed=!0,this.flush()}};var W=`:host {
  all: initial;
  position: fixed;
  z-index: 2147483647;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
  font-size: 14px;
  line-height: 1.4;
  color: var(--vr-text, #111827);
  box-sizing: border-box;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

:host * {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* Base theme custom properties */
.vr-theme-root {
  --vr-primary: #4f46e5;
  --vr-accent: #ffffff;
  --vr-radius: 12px;
  --vr-bg: #ffffff;
  --vr-text: #111827;
  --vr-text-muted: #6b7280;
  --vr-border: rgba(0, 0, 0, 0.08);
  --vr-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  --vr-sheet-bg: #ffffff;
}

.vr-theme-root.vr-dark {
  --vr-bg: #18181b;
  --vr-text: #f4f4f5;
  --vr-text-muted: #a1a1aa;
  --vr-border: rgba(255, 255, 255, 0.12);
  --vr-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
  --vr-sheet-bg: #18181b;
}

/* Position variants */
.vr-pos-bottom-right {
  position: fixed;
  bottom: 20px;
  right: 20px;
}

.vr-pos-bottom-left {
  position: fixed;
  bottom: 20px;
  left: 20px;
}

.vr-pos-bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100vw;
}

.vr-pos-story-strip {
  position: fixed;
  bottom: 20px;
}

/* Centered without \`transform\`: a transformed ancestor becomes the containing
   block for fixed-position descendants, which would misplace the backdrop/modal. */
.vr-theme-root.vr-pos-story-strip {
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  pointer-events: none;
}

.vr-theme-root.vr-pos-story-strip > * {
  pointer-events: auto;
}

/* Animation utilities */
.vr-animate-enter {
  animation: vr-slide-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.vr-animate-leave {
  animation: vr-slide-out 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes vr-slide-in {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.96);
  }
  to {
    opacity: 1;
    /* \`none\`, not an identity transform: with \`forwards\` fill an identity
       matrix would keep the wrapper a containing block for fixed descendants. */
    transform: none;
  }
}

@keyframes vr-slide-out {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(20px) scale(0.96);
  }
}

/* Collapsed Bubble / Card */
.vr-collapsed-card {
  display: flex;
  align-items: center;
  background-color: var(--vr-bg);
  border: 1px solid var(--vr-border);
  border-radius: var(--vr-radius);
  box-shadow: var(--vr-shadow);
  padding: 8px;
  gap: 12px;
  cursor: pointer;
  max-width: 320px;
  min-height: 64px;
  user-select: none;
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease;
  position: relative;
}

.vr-collapsed-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 28px -4px rgba(0, 0, 0, 0.18);
}

/* Full-card open control (keyboard accessible) */
.vr-open-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.vr-thumb-wrapper {
  position: relative;
  width: 52px;
  height: 52px;
  border-radius: calc(var(--vr-radius) - 4px);
  overflow: hidden;
  background-color: #000000;
  flex-shrink: 0;
}

.vr-thumb-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.vr-play-badge {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 24px;
  height: 24px;
  background-color: var(--vr-primary);
  color: var(--vr-accent);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.vr-play-badge svg {
  width: 12px;
  height: 12px;
  margin-left: 1px;
}

.vr-card-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  padding-right: 28px;
}

.vr-card-name {
  font-weight: 600;
  font-size: 13px;
  color: var(--vr-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.vr-card-quote {
  font-size: 11px;
  color: var(--vr-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

.vr-close-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--vr-text-muted);
  cursor: pointer;
  border-radius: 50%;
  transition: color 0.15s, background-color 0.15s;
}

.vr-close-btn:hover {
  color: var(--vr-text);
  background-color: rgba(0, 0, 0, 0.05);
}

.vr-dark .vr-close-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.vr-close-btn svg {
  width: 16px;
  height: 16px;
}

/* Bottom Bar Position Styles */
.vr-pos-bottom-bar .vr-collapsed-card {
  max-width: 100%;
  border-radius: 0;
  border-left: none;
  border-right: none;
  border-bottom: none;
  justify-content: center;
  padding: 10px 24px;
}

.vr-pos-bottom-bar .vr-card-info {
  flex: initial;
  max-width: 500px;
}

.vr-pos-bottom-bar .vr-open-btn {
  justify-content: center;
}

/* Story Strip Position Styles */
.vr-pos-story-strip .vr-strip-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
  background-color: var(--vr-bg);
  border: 1px solid var(--vr-border);
  border-radius: 50px;
  padding: 6px 14px;
  box-shadow: var(--vr-shadow);
}

.vr-story-item {
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 2px solid var(--vr-primary);
  padding: 2px;
  cursor: pointer;
  overflow: hidden;
  transition: transform 0.2s;
  background: transparent;
  font: inherit;
}

.vr-story-item:hover {
  transform: scale(1.08);
}

.vr-story-item img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  display: block;
}

/* Expanded Modal & Backdrop */
.vr-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  z-index: 2147483646;
  opacity: 0;
  animation: vr-fade-in 0.25s forwards;
}

@keyframes vr-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.vr-expanded-modal {
  position: fixed;
  z-index: 2147483647;
  background-color: var(--vr-sheet-bg);
  border-radius: var(--vr-radius);
  box-shadow: var(--vr-shadow);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--vr-border);
}

/* Desktop expanded position */
@media (min-width: 641px) {
  .vr-expanded-modal {
    bottom: 24px;
    right: 24px;
    width: 380px;
    max-height: 85vh;
    animation: vr-modal-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  .vr-expanded-modal.vr-pos-bottom-left {
    right: auto;
    left: 24px;
  }

  @keyframes vr-modal-in {
    from {
      opacity: 0;
      transform: translateY(24px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
}

/* Mobile Bottom-Sheet Layout (< 640px) */
@media (max-width: 640px) {
  .vr-expanded-modal {
    bottom: 0;
    left: 0;
    right: 0;
    width: 100vw;
    max-height: 88vh;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    border-left: none;
    border-right: none;
    border-bottom: none;
    animation: vr-sheet-up 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  .vr-sheet-grabber {
    width: 36px;
    height: 4px;
    background-color: var(--vr-text-muted);
    opacity: 0.4;
    border-radius: 2px;
    margin: 8px auto 4px auto;
  }

  @keyframes vr-sheet-up {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }
}

/* Video Player in Expanded View */
.vr-player-container {
  position: relative;
  width: 100%;
  padding-top: 56.25%; /* 16:9 Aspect Ratio */
  background-color: #000000;
  overflow: hidden;
}

.vr-player-thumb-wrap {
  position: absolute;
  inset: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.vr-player-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.vr-player-play-btn {
  position: absolute;
  width: 56px;
  height: 56px;
  background-color: var(--vr-primary);
  color: var(--vr-accent);
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  transition: transform 0.2s ease;
}

.vr-player-play-btn:hover {
  transform: scale(1.08);
}

.vr-player-play-icon {
  width: 24px;
  height: 24px;
  margin-left: 2px;
}

.vr-player-preview-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}

.vr-player-iframe,
.vr-player-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: none;
}

/* Expanded View Content Body */
.vr-modal-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
}

.vr-modal-quote {
  font-size: 13px;
  line-height: 1.5;
  color: var(--vr-text);
  font-style: italic;
}

.vr-modal-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
}

.vr-modal-author {
  font-weight: 600;
  font-size: 13px;
  color: var(--vr-text);
}

.vr-modal-company {
  font-size: 12px;
  color: var(--vr-text-muted);
}

.vr-carousel-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.vr-nav-btn {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: transparent;
  border: 1px solid var(--vr-border);
  border-radius: 50%;
  color: var(--vr-text);
  cursor: pointer;
  transition: background-color 0.15s;
}

.vr-nav-btn:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.vr-nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.vr-modal-close-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  border: none;
  border-radius: 50%;
  color: #ffffff;
  cursor: pointer;
  z-index: 10;
  transition: background-color 0.15s;
}

.vr-modal-close-btn:hover {
  background: rgba(0, 0, 0, 0.7);
}

.vr-modal-close-btn svg {
  width: 18px;
  height: 18px;
}

.vr-powered-by {
  font-size: 10px;
  text-align: center;
  color: var(--vr-text-muted);
  padding-bottom: 8px;
  opacity: 0.8;
}

/* Visually hidden but exposed to screen readers */
.vr-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

/* Visible keyboard focus for all interactive controls */
.vr-open-btn:focus-visible,
.vr-close-btn:focus-visible,
.vr-modal-close-btn:focus-visible,
.vr-nav-btn:focus-visible,
.vr-player-play-btn:focus-visible,
.vr-story-item:focus-visible {
  outline: 2px solid var(--vr-primary);
  outline-offset: 2px;
}

/* Programmatic focus target for the dialog \u2014 no visible ring needed */
.vr-expanded-modal:focus {
  outline: none;
}

/* Reduced Motion Support */
@media (prefers-reduced-motion: reduce) {
  :host *,
  .vr-animate-enter,
  .vr-animate-leave,
  .vr-expanded-modal,
  .vr-backdrop {
    animation: none !important;
    transition: none !important;
  }
}
`;function H(r){if(!r)return null;let e=r.trim(),t=e.match(/[?&]v=([^&#]+)/);if(t)return t[1];let i=e.match(/youtu\.be\/([^?&#]+)/);if(i)return i[1];let n=e.match(/youtube(?:-nocookie)?\.com\/embed\/([^?&#]+)/);if(n)return n[1];let o=e.match(/youtube\.com\/shorts\/([^?&#]+)/);return o?o[1]:null}function K(r){if(!r)return null;let t=r.trim().match(/vimeo(?:\.com|\.com\/video)?\/(\d+)/);return t?t[1]:null}function B(r){if(!r)return"mp4";let e=r.toLowerCase();return e.includes("youtube.com")||e.includes("youtu.be")?"youtube":e.includes("vimeo.com")?"vimeo":"mp4"}function _(r,e,t){if(t&&t.trim().length>0)return t.trim();if((e||B(r))==="youtube"){let n=H(r);if(n)return`https://img.youtube.com/vi/${n}/hqdefault.jpg`}return""}function C(r){let{container:e,videoUrl:t,thumbnailUrl:i,autoplayPreview:n=!1,onPlay:o,onEnded:a}=r,m=r.platform||B(t),d=_(t,m,i),f=!1,c=null;e.innerHTML="",e.className="vr-player-container";let u=document.createElement("div");if(u.className="vr-player-thumb-wrap",d){let l=document.createElement("img");l.src=d,l.alt="Video thumbnail",l.className="vr-player-thumb-img",l.loading="lazy",u.appendChild(l)}else{let l=document.createElement("div");l.className="vr-player-placeholder",u.appendChild(l)}let p=document.createElement("button");p.type="button",p.className="vr-player-play-btn",p.setAttribute("aria-label","Play testimonial video"),p.innerHTML=`
    <svg class="vr-player-play-icon" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z"/>
    </svg>
  `,u.appendChild(p);let s=null;n&&m==="mp4"&&(s=document.createElement("video"),s.src=t,s.muted=!0,s.autoplay=!0,s.loop=!0,s.playsInline=!0,s.className="vr-player-preview-video",u.appendChild(s)),e.appendChild(u);let v=()=>{if(!f){if(f=!0,s&&(s.pause(),s.remove(),s=null),u.style.display="none",m==="youtube"){let l=H(t),h=document.createElement("iframe");h.src=`https://www.youtube-nocookie.com/embed/${l||""}?autoplay=1&rel=0&playsinline=1&enablejsapi=1`,h.title="YouTube testimonial video",h.className="vr-player-iframe",h.setAttribute("frameborder","0"),h.setAttribute("allow","accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"),h.setAttribute("allowfullscreen","true"),e.appendChild(h),c=h}else if(m==="vimeo"){let l=K(t),h=document.createElement("iframe");h.src=`https://player.vimeo.com/video/${l||""}?autoplay=1&badge=0&autopause=0&player_id=0&app_id=58479`,h.title="Vimeo testimonial video",h.className="vr-player-iframe",h.setAttribute("frameborder","0"),h.setAttribute("allow","autoplay; fullscreen; picture-in-picture"),h.setAttribute("allowfullscreen","true"),e.appendChild(h),c=h}else{let l=document.createElement("video");l.src=t,l.controls=!0,l.autoplay=!0,l.playsInline=!0,l.className="vr-player-video",d&&(l.poster=d),l.addEventListener("ended",()=>{a&&a()}),e.appendChild(l),c=l,l.play().catch(()=>{})}o&&o()}};return p.addEventListener("click",l=>{l.stopPropagation(),v()}),u.addEventListener("click",()=>{v()}),{play:v,pause:()=>{c instanceof HTMLVideoElement&&c.pause()},destroy:()=>{s&&(s.pause(),s.src="",s.remove(),s=null),c&&(c instanceof HTMLVideoElement&&(c.pause(),c.src=""),c.remove(),c=null),e.innerHTML=""}}}var b=class{embedKey;config;testimonials;analytics;hostElement=null;shadowRoot=null;rootWrapper=null;activePlayer=null;currentIndex=0;isExpanded=!1;isMounted=!1;keydownListener=null;liveRegion=null;previouslyFocusedEl=null;restoreFocusOnRender=!1;constructor(e){this.embedKey=e.embedKey,this.config=e.config||{},this.testimonials=e.testimonials||[],this.analytics=e.analytics}mount(){if(this.isMounted||typeof document>"u"||!this.testimonials||this.testimonials.length===0)return;this.hostElement=document.createElement("div"),this.hostElement.id=`vouchreel-widget-${this.embedKey}`,this.hostElement.className="vouchreel-host-container",this.hostElement.setAttribute("role","region"),this.hostElement.setAttribute("aria-label","Customer video testimonials"),this.shadowRoot=this.hostElement.attachShadow({mode:"open"});let e=document.createElement("style");if(e.textContent=W,this.shadowRoot.appendChild(e),this.rootWrapper=document.createElement("div"),this.rootWrapper.className=`vr-theme-root vr-pos-${this.config.position||"bottom-right"} vr-animate-enter`,this.config.theme?.mode==="dark"&&this.rootWrapper.classList.add("vr-dark"),this.config.theme?.primaryColor&&this.rootWrapper.style.setProperty("--vr-primary",this.config.theme.primaryColor),this.config.theme?.accentColor&&this.rootWrapper.style.setProperty("--vr-accent",this.config.theme.accentColor),typeof this.config.theme?.borderRadius=="number"&&this.rootWrapper.style.setProperty("--vr-radius",`${this.config.theme.borderRadius}px`),this.shadowRoot.appendChild(this.rootWrapper),this.rootWrapper.addEventListener("animationend",t=>{t.target===this.rootWrapper&&this.rootWrapper&&this.rootWrapper.classList.remove("vr-animate-enter")}),this.liveRegion=document.createElement("div"),this.liveRegion.className="vr-sr-only",this.liveRegion.setAttribute("role","status"),this.shadowRoot.appendChild(this.liveRegion),document.body.appendChild(this.hostElement),this.isMounted=!0,this.analytics){let t=this.testimonials[this.currentIndex];this.analytics.track("impression",t?.id)}this.renderCollapsed(),this.announce("Video testimonial widget is now available."),this.keydownListener=t=>{t.key==="Escape"?this.isExpanded?this.collapse():this.dismiss():t.key==="Tab"&&this.isExpanded&&this.trapFocus(t)},document.addEventListener("keydown",this.keydownListener)}announce(e){this.liveRegion&&(this.liveRegion.textContent="",setTimeout(()=>{this.liveRegion&&(this.liveRegion.textContent=e)},100))}trapFocus(e){if(!this.shadowRoot)return;let t=Array.from(this.shadowRoot.querySelectorAll('button, a[href], iframe, video[controls], [tabindex]:not([tabindex="-1"])')).filter(a=>!a.hasAttribute("disabled")&&a.getClientRects().length>0);if(t.length===0)return;let i=t[0],n=t[t.length-1],o=this.shadowRoot.activeElement;o?e.shiftKey&&o===i?(e.preventDefault(),n.focus()):!e.shiftKey&&o===n&&(e.preventDefault(),i.focus()):(e.preventDefault(),i.focus())}renderCollapsed(){if(!this.rootWrapper)return;this.rootWrapper.innerHTML="",this.isExpanded=!1,this.activePlayer&&(this.activePlayer.destroy(),this.activePlayer=null);let e=this.testimonials[this.currentIndex]||this.testimonials[0];if((this.config.position||"bottom-right")==="story-strip"&&this.testimonials.length>1){this.renderStoryStrip();return}let i=document.createElement("div");i.className="vr-collapsed-card";let n=document.createElement("button");n.type="button",n.className="vr-open-btn",n.setAttribute("aria-label",`Play video testimonial${e.customerName?` from ${e.customerName}`:""}`);let o=document.createElement("div");if(o.className="vr-thumb-wrapper",e.thumbnailUrl){let c=document.createElement("img");c.src=e.thumbnailUrl,c.alt=e.customerName||"Testimonial",o.appendChild(c)}let a=document.createElement("div");a.className="vr-play-badge",a.setAttribute("aria-hidden","true"),a.innerHTML=`
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5v14l11-7z"/>
      </svg>
    `,o.appendChild(a),n.appendChild(o);let m=document.createElement("div");m.className="vr-card-info";let d=document.createElement("div");if(d.className="vr-card-name",d.textContent=e.customerName||e.title||"Video Testimonial",m.appendChild(d),e.quote){let c=document.createElement("div");c.className="vr-card-quote",c.textContent=`"${e.quote}"`,m.appendChild(c)}n.appendChild(m),n.addEventListener("click",()=>{this.analytics&&this.analytics.track("click",e.id),this.expand(this.currentIndex)}),i.appendChild(n);let f=document.createElement("button");f.type="button",f.className="vr-close-btn",f.setAttribute("aria-label","Dismiss testimonial widget"),f.innerHTML=`
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `,f.addEventListener("click",c=>{c.stopPropagation(),this.dismiss()}),i.appendChild(f),this.rootWrapper.appendChild(i),this.maybeRestoreFocus()}maybeRestoreFocus(){if(!this.restoreFocusOnRender||!this.rootWrapper)return;this.restoreFocusOnRender=!1;let e=this.rootWrapper.querySelector(".vr-open-btn, .vr-story-item");e?e.focus():this.previouslyFocusedEl&&this.previouslyFocusedEl.focus(),this.previouslyFocusedEl=null}renderStoryStrip(){if(!this.rootWrapper)return;let e=document.createElement("div");e.className="vr-strip-wrapper",this.testimonials.slice(0,5).forEach((i,n)=>{let o=document.createElement("button");if(o.type="button",o.className="vr-story-item",o.setAttribute("aria-label",`Play video testimonial${i.customerName?` from ${i.customerName}`:""}`),o.setAttribute("title",i.customerName||i.title||"Testimonial"),i.thumbnailUrl){let a=document.createElement("img");a.src=i.thumbnailUrl,a.alt=i.customerName||"Testimonial",o.appendChild(a)}o.addEventListener("click",()=>{this.analytics&&this.analytics.track("click",i.id),this.expand(n)}),e.appendChild(o)});let t=document.createElement("button");t.type="button",t.className="vr-close-btn",t.style.position="static",t.setAttribute("aria-label","Dismiss widget"),t.innerHTML=`
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `,t.addEventListener("click",i=>{i.stopPropagation(),this.dismiss()}),e.appendChild(t),this.rootWrapper.appendChild(e),this.maybeRestoreFocus()}expand(e=0){if(!this.rootWrapper)return;!this.isExpanded&&this.shadowRoot&&(this.previouslyFocusedEl=this.shadowRoot.activeElement),this.isExpanded=!0,this.currentIndex=e;let t=this.testimonials[this.currentIndex];if(!t)return;this.rootWrapper.innerHTML="";let i=document.createElement("div");i.className="vr-backdrop",i.setAttribute("aria-hidden","true"),i.addEventListener("click",()=>this.collapse()),this.rootWrapper.appendChild(i);let n=document.createElement("div");n.className=`vr-expanded-modal vr-pos-${this.config.position||"bottom-right"}`,n.setAttribute("role","dialog"),n.setAttribute("aria-modal","true"),n.setAttribute("aria-label",t.customerName?`Video testimonial from ${t.customerName}`:"Video testimonial player"),n.tabIndex=-1;let o=document.createElement("div");o.className="vr-sheet-grabber",o.setAttribute("aria-hidden","true"),n.appendChild(o);let a=document.createElement("button");a.type="button",a.className="vr-modal-close-btn",a.setAttribute("aria-label","Close player"),a.innerHTML=`
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `,a.addEventListener("click",()=>this.collapse()),n.appendChild(a);let m=document.createElement("div");m.className="vr-player-container",n.appendChild(m),this.activePlayer=C({container:m,videoUrl:t.videoUrl,platform:t.platform,thumbnailUrl:t.thumbnailUrl,autoplayPreview:this.config.autoplayPreview,onPlay:()=>{this.analytics&&this.analytics.track("play",t.id)},onEnded:()=>{this.next()}});let d=document.createElement("div");if(d.className="vr-modal-body",t.quote){let s=document.createElement("p");s.className="vr-modal-quote",s.textContent=`"${t.quote}"`,d.appendChild(s)}let f=document.createElement("div");f.className="vr-modal-meta";let c=document.createElement("div"),u=document.createElement("div");if(u.className="vr-modal-author",u.textContent=t.customerName||t.title||"",c.appendChild(u),t.customerCompany){let s=document.createElement("div");s.className="vr-modal-company",s.textContent=t.customerCompany,c.appendChild(s)}if(f.appendChild(c),this.testimonials.length>1){let s=document.createElement("div");s.className="vr-carousel-controls";let v=document.createElement("button");v.type="button",v.className="vr-nav-btn",v.setAttribute("aria-label","Previous testimonial"),v.innerHTML=`
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      `,v.addEventListener("click",()=>this.prev());let l=document.createElement("button");l.type="button",l.className="vr-nav-btn",l.setAttribute("aria-label","Next testimonial"),l.innerHTML=`
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      `,l.addEventListener("click",()=>this.next()),s.appendChild(v),s.appendChild(l),f.appendChild(s)}d.appendChild(f),n.appendChild(d);let p=document.createElement("div");p.className="vr-powered-by",p.textContent="Verified by Vouchreel",n.appendChild(p),this.rootWrapper.appendChild(n),n.focus()}next(){this.testimonials.length<=1||(this.currentIndex=(this.currentIndex+1)%this.testimonials.length,this.expand(this.currentIndex))}prev(){this.testimonials.length<=1||(this.currentIndex=(this.currentIndex-1+this.testimonials.length)%this.testimonials.length,this.expand(this.currentIndex))}collapse(){this.isExpanded&&(this.restoreFocusOnRender=!0,this.renderCollapsed())}dismiss(){R(this.embedKey),this.activePlayer&&(this.activePlayer.destroy(),this.activePlayer=null),this.keydownListener&&(document.removeEventListener("keydown",this.keydownListener),this.keydownListener=null),this.rootWrapper&&(this.rootWrapper.classList.remove("vr-animate-enter"),this.rootWrapper.classList.add("vr-animate-leave"),setTimeout(()=>{this.hostElement&&this.hostElement.parentNode&&this.hostElement.parentNode.removeChild(this.hostElement),this.isMounted=!1},250))}};function J(){return typeof document>"u"?null:document.currentScript instanceof HTMLScriptElement?document.currentScript:document.querySelector("script[data-key]")||document.querySelector("script[src*='vouchreel']")||document.querySelector("script[src*='widget']")||null}function Q(r){if(!r)return null;let e=r.getAttribute("data-key");if(e&&e.trim().length>0)return e.trim();let t=r.getAttribute("src")||r.src;if(t)try{let i=new URL(t,window.location.href),o=i.pathname.match(/\/widget\/([^/.]+)(?:\.js)?$/);if(o&&o[1]&&o[1]!=="vouchreel-widget")return o[1];let a=i.searchParams.get("key")||i.searchParams.get("embedKey")||i.searchParams.get("k");if(a)return a.trim()}catch{}return null}function X(r){if(r){let e=r.getAttribute("data-api");if(e&&e.trim().length>0)return e.trim().replace(/\/+$/,"");let t=r.getAttribute("src")||r.src;if(t)try{let i=new URL(t,window.location.href);if(i.origin&&i.origin!=="null")return i.origin}catch{}}return typeof window<"u"&&window.location?window.location.origin:""}async function I(){try{let r=J(),e=Q(r);if(!e||k(e))return;let t=X(r),i=`${t}/api/widget/${encodeURIComponent(e)}`,n=await fetch(i,{method:"GET",headers:{Accept:"application/json"}});if(!n.ok)return;let o=await n.json();if(!o||!o.config||!Array.isArray(o.testimonials))return;let a=typeof window<"u"&&window.location?window.location.pathname:"/";if(!w(o.config,a))return;let m=E(o.testimonials,typeof window<"u"?window.location:{pathname:"/"});if(m.length===0)return;let d=new y({spaceId:o.spaceId,apiBase:t,conversionGoals:o.conversionGoals});typeof window<"u"&&(window.vouchreelConvert=p=>{d.track("convert",null,{goalId:p,source:"pixel"})});let f=new b({embedKey:e,config:o.config,testimonials:m,analytics:d}),c=o.config.trigger?.type||"delay",u=o.config.trigger?.value||null;T({type:c,value:u,embedKey:e,onTrigger:()=>{f.mount()}})}catch{}}function A(){typeof document>"u"||(document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{I()}):setTimeout(()=>{I()},10))}A();return q(Z);})();
