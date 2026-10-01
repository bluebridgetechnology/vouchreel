var Vouchreel=(()=>{var I=Object.defineProperty;var z=Object.getOwnPropertyDescriptor;var U=Object.getOwnPropertyNames;var j=Object.prototype.hasOwnProperty;var D=(n,e)=>{for(var t in e)I(n,t,{get:e[t],enumerable:!0})},q=(n,e,t,r)=>{if(e&&typeof e=="object"||typeof e=="function")for(let o of U(e))!j.call(n,o)&&o!==t&&I(n,o,{get:()=>e[o],enumerable:!(r=z(e,o))||r.enumerable});return n};var O=n=>q(I({},"__esModule",{value:!0}),n);var ee={};D(ee,{AnalyticsTracker:()=>b,VouchreelWidget:()=>y,createVideoPlayer:()=>L,filterTestimonials:()=>C,initLoader:()=>N,isPageAllowed:()=>E,matchPattern:()=>g,matchTags:()=>w,setupTrigger:()=>T,startWidget:()=>A});function x(n){if(!n)return"/";let e=n.split("?")[0].split("#")[0].trim();return e.length>1&&e.endsWith("/")&&(e=e.slice(0,-1)),e.startsWith("/")||(e="/"+e),e}function F(n){let e=x(n);if(e==="/*"||e==="/**")return/^.*$/;let t="",r=0;for(;r<e.length;){let o=e[r];o==="*"&&e[r+1]==="*"?(t+=".*",r+=2):o==="*"?(t+="[^/]+",r+=1):["\\",".","^","$","+","?","(",")","[","]","{","}","|"].includes(o)?(t+="\\"+o,r+=1):(t+=o,r+=1)}return new RegExp(`^${t}(?:/)?$`,"i")}function g(n,e){if(!n)return!1;let t=n.trim();if(t==="*"||t==="/*"||t==="/**")return!0;let r=x(e);return F(t).test(r)}function w(n,e){if(!n||n.length===0)return!0;if(!e||e.length===0)return!1;let t=e.map(r=>r.trim().toLowerCase());return n.some(r=>t.includes(r.trim().toLowerCase()))}function S(){if(typeof document>"u")return[];let n=document.body?.getAttribute("data-vouchreel-tags");if(n)return n.split(",").map(t=>t.trim()).filter(Boolean);let e=document.querySelector('meta[name="vouchreel-tags"]');if(e){let t=e.getAttribute("content");if(t)return t.split(",").map(r=>r.trim()).filter(Boolean)}return[]}function E(n,e="/"){if(!n)return!0;let t=x(e);if(n.pagesExcluded&&n.pagesExcluded.length>0){for(let r of n.pagesExcluded)if(r&&g(r,t))return!1}return n.pagesIncluded&&n.pagesIncluded.length>0?n.pagesIncluded.some(o=>o==="*"||o==="/*"||o==="/**")?!0:n.pagesIncluded.some(o=>g(o,t)):!0}function C(n,e={pathname:"/"},t=S()){if(!Array.isArray(n)||n.length===0)return[];let r=x(e.pathname);return n.filter(o=>{let i=o.matchRules;if(!i||!i.mode||i.mode==="all")return!0;if(i.mode==="specific"){let s=!1;Array.isArray(i.urlPatterns)&&i.urlPatterns.length>0?s=i.urlPatterns.some(c=>g(c,r)):s=!0;let m=w(i.tags,t);return s&&m}return!0})}function W(n,e={pathname:"/"},t=S()){if(!Array.isArray(n)||n.length===0)return[];let r=x(e.pathname);return n.filter(o=>{let i=o.matchRules;if(!i||!i.mode||i.mode==="all")return!0;if(i.mode==="specific"){let s=!1;Array.isArray(i.urlPatterns)&&i.urlPatterns.length>0?s=i.urlPatterns.some(c=>g(c,r)):s=!0;let m=w(i.tags,t);return s&&m}return!0})}function k(n){if(typeof window>"u"||!window.sessionStorage)return!1;try{return window.sessionStorage.getItem(`vouchreel_dismissed_${n}`)==="true"}catch{return!1}}function H(n){if(!(typeof window>"u"||!window.sessionStorage))try{window.sessionStorage.setItem(`vouchreel_dismissed_${n}`,"true")}catch{}}function G(){return typeof window>"u"||typeof navigator>"u"?!1:navigator.maxTouchPoints>0||/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)}function T({type:n,value:e,embedKey:t,onTrigger:r}){if(k(t))return{cancel:()=>{}};let o=!1,i=()=>{o||k(t)||(o=!0,h(),r())},s=null,m=null,c=null,l=[],h=()=>{s!==null&&(clearTimeout(s),s=null),m&&(m.disconnect(),m=null),c&&c.parentNode&&(c.parentNode.removeChild(c),c=null);for(let d of l)try{d()}catch{}l=[]};switch(n){case"delay":{let d=e&&typeof e.seconds=="number"&&e.seconds>0?e.seconds:3;s=setTimeout(i,d*1e3);break}case"exit-intent":{if(typeof window>"u"||typeof document>"u")break;if(G()){let u=window.scrollY||window.pageYOffset,a=Date.now(),v=()=>{let p=window.scrollY||window.pageYOffset,f=Date.now(),M=p-u,P=f-a;p>150&&M<-40&&P>0&&P<200&&i(),u=p,a=f};window.addEventListener("scroll",v,{passive:!0}),l.push(()=>window.removeEventListener("scroll",v))}else{let u=a=>{(a.clientY<=0||!a.relatedTarget)&&i()};document.addEventListener("mouseleave",u),l.push(()=>document.removeEventListener("mouseleave",u))}break}case"scroll-depth":{if(typeof window>"u"||typeof document>"u")break;let d=e&&typeof e.percentage=="number"&&e.percentage>0?Math.min(Math.max(e.percentage,1),100):50;if(typeof IntersectionObserver<"u"&&document.body)try{c=document.createElement("div"),c.className="vouchreel-scroll-sentinel",c.style.position="absolute",c.style.top=`${d}%`,c.style.left="0",c.style.width="1px",c.style.height="1px",c.style.pointerEvents="none",c.style.opacity="0",c.style.zIndex="-1",document.body.appendChild(c),m=new IntersectionObserver(a=>{for(let v of a)if(v.isIntersecting){i();break}}),m.observe(c)}catch{}let u=()=>{let a=window.scrollY||document.documentElement.scrollTop||document.body.scrollTop||0,v=document.documentElement.scrollHeight||document.body.scrollHeight||1,p=window.innerHeight||document.documentElement.clientHeight||1,f=v-p;if(f<=0){s=setTimeout(i,1500);return}a/f*100>=d&&i()};window.addEventListener("scroll",u,{passive:!0}),l.push(()=>window.removeEventListener("scroll",u)),u();break}case"pageview-count":{if(typeof window>"u"||!window.sessionStorage){i();break}let d=e&&typeof e.count=="number"&&e.count>0?e.count:2,u=1;try{let a=window.sessionStorage.getItem("vouchreel_pv_count");u=a?parseInt(a,10)+1:1,window.sessionStorage.setItem("vouchreel_pv_count",u.toString())}catch{}u>=d&&(s=setTimeout(i,800));break}case"returning-visitor":{if(typeof window>"u"||!window.localStorage){i();break}try{window.localStorage.getItem("vouchreel_visited")==="true"?s=setTimeout(i,1e3):window.localStorage.setItem("vouchreel_visited","true")}catch{s=setTimeout(i,2e3)}break}default:{s=setTimeout(i,3e3);break}}return{cancel:h}}function R(){if(typeof crypto<"u"&&typeof crypto.randomUUID=="function")try{return crypto.randomUUID()}catch{}return"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,n=>{let e=Math.random()*16|0;return(n==="x"?e:e&3|8).toString(16)})}function Y(){if(typeof window>"u"||!window.sessionStorage)return R();let n="vouchreel_session_id";try{let e=window.sessionStorage.getItem(n);if(e&&e.length>=10)return e;let t=R();return window.sessionStorage.setItem(n,t),t}catch{return R()}}var b=class{spaceId;apiBase;sessionId;conversionGoals;queue=[];flushTimer=null;flushIntervalMs;isDestroyed=!1;constructor(e){this.spaceId=e.spaceId,this.apiBase=e.apiBase?e.apiBase.replace(/\/+$/,""):"",this.sessionId=Y(),this.conversionGoals=e.conversionGoals||[],this.flushIntervalMs=e.flushIntervalMs??5e3,this.bindLifecycleListeners(),this.checkConversionGoals()}track(e,t,r){if(this.isDestroyed||!this.spaceId)return;let o=typeof window<"u"&&window.location?window.location.href.split("#")[0]:"",i={spaceId:this.spaceId,testimonialId:t||null,sessionId:this.sessionId,eventType:e,pageUrl:o,timestamp:new Date().toISOString(),metadata:r||null};if(this.queue.push(i),e==="impression"||e==="play")try{window.sessionStorage.setItem("vouchreel_engaged","true")}catch{}this.scheduleFlush()}checkConversionGoals(){if(typeof window>"u"||!window.location||!this.conversionGoals||this.conversionGoals.length===0)return;let e=window.location.pathname;for(let t of this.conversionGoals)if(t.goalType==="url-match"&&t.goalValue&&g(t.goalValue,e)){let r=`vouchreel_converted_${t.id}`;try{if(window.sessionStorage.getItem(r)==="true")continue;window.sessionStorage.setItem(r,"true")}catch{}this.track("convert",null,{goalId:t.id,goalValue:t.goalValue})}}flush(){if(this.queue.length===0)return;this.flushTimer!==null&&(clearTimeout(this.flushTimer),this.flushTimer=null);let e=[...this.queue];this.queue=[];let t=`${this.apiBase}/api/events`,r=JSON.stringify({events:e});if(typeof navigator<"u"&&typeof navigator.sendBeacon=="function")try{let o=new Blob([r],{type:"application/json"});if(navigator.sendBeacon(t,o))return}catch{}if(typeof fetch=="function")try{fetch(t,{method:"POST",headers:{"Content-Type":"application/json"},body:r,keepalive:!0}).catch(()=>{})}catch{}}scheduleFlush(){this.flushTimer===null&&(this.flushTimer=setTimeout(()=>{this.flushTimer=null,this.flush()},this.flushIntervalMs))}bindLifecycleListeners(){if(typeof document>"u"||typeof window>"u")return;let e=()=>{document.visibilityState==="hidden"&&this.flush()},t=()=>{this.flush()};document.addEventListener("visibilitychange",e),window.addEventListener("pagehide",t),window.addEventListener("beforeunload",t)}destroy(){this.isDestroyed=!0,this.flush()}};var $=`:host {
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

/* \u2500\u2500\u2500 Curated Display Templates Styles \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

.vr-card {
  background-color: var(--vr-bg);
  border: 1px solid var(--vr-border);
  border-radius: var(--vr-radius);
  box-shadow: var(--vr-shadow);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  cursor: pointer;
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease;
  user-select: none;
  position: relative;
  text-align: left;
  color: var(--vr-text);
  font: inherit;
  width: 100%;
  box-sizing: border-box;
}

.vr-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 16px 32px -4px rgba(0, 0, 0, 0.16);
}

.vr-card-video-thumb {
  position: relative;
  width: 100%;
  padding-top: 56.25%;
  border-radius: calc(var(--vr-radius) - 4px);
  overflow: hidden;
  background-color: #000;
}

.vr-card-video-thumb img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.vr-card-duration {
  position: absolute;
  bottom: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
}

.vr-provider-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 12px;
}

.vr-badge-google {
  background-color: #e8f0fe;
  color: #1a73e8;
  border: 1px solid #dadce0;
}

.vr-dark .vr-badge-google {
  background-color: rgba(26, 115, 232, 0.2);
  color: #8ab4f8;
  border-color: rgba(26, 115, 232, 0.4);
}

.vr-badge-trustpilot {
  background-color: #e6f7f0;
  color: #008554;
  border: 1px solid #b8ebd8;
}

.vr-dark .vr-badge-trustpilot {
  background-color: rgba(0, 182, 122, 0.2);
  color: #00b67a;
  border-color: rgba(0, 182, 122, 0.4);
}

.vr-badge-video {
  background-color: rgba(79, 70, 229, 0.1);
  color: var(--vr-primary);
  border: 1px solid rgba(79, 70, 229, 0.2);
}

.vr-stars {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: #f59e0b;
  font-size: 14px;
}

.vr-card-quote-text {
  font-size: 13px;
  line-height: 1.5;
  color: var(--vr-text);
  word-break: break-word;
}

.vr-card-author-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px solid var(--vr-border);
}

.vr-card-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  background-color: var(--vr-primary);
  color: var(--vr-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 12px;
  flex-shrink: 0;
}

.vr-card-author-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--vr-text);
}

.vr-card-author-sub {
  font-size: 11px;
  color: var(--vr-text-muted);
}

/* 1. Wall of Love Template */
.vr-wall-wrapper {
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  padding: 16px;
  box-sizing: border-box;
}

.vr-wall-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

/* 2. Carousel Template */
.vr-carousel-container {
  position: relative;
  width: 100%;
  max-width: 1000px;
  margin: 0 auto;
  padding: 16px 44px;
  box-sizing: border-box;
}

.vr-carousel-track {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  scroll-behavior: smooth;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding: 4px;
}

.vr-carousel-track::-webkit-scrollbar {
  display: none;
}

.vr-carousel-track .vr-card {
  flex: 0 0 290px;
  scroll-snap-align: start;
}

.vr-carousel-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background-color: var(--vr-bg);
  border: 1px solid var(--vr-border);
  color: var(--vr-text);
  box-shadow: var(--vr-shadow);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 2;
  transition: transform 0.15s, background-color 0.15s;
}

.vr-carousel-arrow:hover {
  background-color: var(--vr-primary);
  color: var(--vr-accent);
}

.vr-carousel-prev {
  left: 4px;
}

.vr-carousel-next {
  right: 4px;
}

/* 3. Masonry Grid Template */
.vr-masonry-wrapper {
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  padding: 16px;
  column-count: 3;
  column-gap: 16px;
  box-sizing: border-box;
}

@media (max-width: 800px) {
  .vr-masonry-wrapper {
    column-count: 2;
  }
}

@media (max-width: 500px) {
  .vr-masonry-wrapper {
    column-count: 1;
  }
}

.vr-masonry-wrapper .vr-card {
  break-inside: avoid;
  margin-bottom: 16px;
}

/* Story Strip Reviews Avatar Ring */
.vr-story-review-google {
  border-color: #1a73e8 !important;
}

.vr-story-review-trustpilot {
  border-color: #00b67a !important;
}

.vr-story-badge {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #f59e0b;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  border: 1.5px solid var(--vr-bg);
}

/* Review Detail Modal */
.vr-review-modal-body {
  padding: 20px;
  overflow-y: auto;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.vr-review-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.vr-review-modal-text {
  font-size: 14px;
  line-height: 1.6;
  color: var(--vr-text);
  white-space: pre-line;
}

`;function V(n){if(!n)return null;let e=n.trim(),t=e.match(/[?&]v=([^&#]+)/);if(t)return t[1];let r=e.match(/youtu\.be\/([^?&#]+)/);if(r)return r[1];let o=e.match(/youtube(?:-nocookie)?\.com\/embed\/([^?&#]+)/);if(o)return o[1];let i=e.match(/youtube\.com\/shorts\/([^?&#]+)/);return i?i[1]:null}function K(n){if(!n)return null;let t=n.trim().match(/vimeo(?:\.com|\.com\/video)?\/(\d+)/);return t?t[1]:null}function B(n){if(!n)return"mp4";let e=n.toLowerCase();return e.includes("youtube.com")||e.includes("youtu.be")?"youtube":e.includes("vimeo.com")?"vimeo":"mp4"}function J(n,e,t){if(t&&t.trim().length>0)return t.trim();if((e||B(n))==="youtube"){let o=V(n);if(o)return`https://img.youtube.com/vi/${o}/hqdefault.jpg`}return""}function L(n){let{container:e,videoUrl:t,thumbnailUrl:r,autoplayPreview:o=!1,onPlay:i,onEnded:s}=n,m=n.platform||B(t),c=J(t,m,r),l=!1,h=null;e.innerHTML="",e.className="vr-player-container";let d=document.createElement("div");if(d.className="vr-player-thumb-wrap",c){let p=document.createElement("img");p.src=c,p.alt="Video thumbnail",p.className="vr-player-thumb-img",p.loading="lazy",d.appendChild(p)}else{let p=document.createElement("div");p.className="vr-player-placeholder",d.appendChild(p)}let u=document.createElement("button");u.type="button",u.className="vr-player-play-btn",u.setAttribute("aria-label","Play testimonial video"),u.innerHTML=`
    <svg class="vr-player-play-icon" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z"/>
    </svg>
  `,d.appendChild(u);let a=null;o&&m==="mp4"&&(a=document.createElement("video"),a.src=t,a.muted=!0,a.autoplay=!0,a.loop=!0,a.playsInline=!0,a.className="vr-player-preview-video",d.appendChild(a)),e.appendChild(d);let v=()=>{if(!l){if(l=!0,a&&(a.pause(),a.remove(),a=null),d.style.display="none",m==="youtube"){let p=V(t),f=document.createElement("iframe");f.src=`https://www.youtube-nocookie.com/embed/${p||""}?autoplay=1&rel=0&playsinline=1&enablejsapi=1`,f.title="YouTube testimonial video",f.className="vr-player-iframe",f.setAttribute("frameborder","0"),f.setAttribute("allow","accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"),f.setAttribute("allowfullscreen","true"),e.appendChild(f),h=f}else if(m==="vimeo"){let p=K(t),f=document.createElement("iframe");f.src=`https://player.vimeo.com/video/${p||""}?autoplay=1&badge=0&autopause=0&player_id=0&app_id=58479`,f.title="Vimeo testimonial video",f.className="vr-player-iframe",f.setAttribute("frameborder","0"),f.setAttribute("allow","autoplay; fullscreen; picture-in-picture"),f.setAttribute("allowfullscreen","true"),e.appendChild(f),h=f}else{let p=document.createElement("video");p.src=t,p.controls=!0,p.autoplay=!0,p.playsInline=!0,p.className="vr-player-video",c&&(p.poster=c),p.addEventListener("ended",()=>{s&&s()}),e.appendChild(p),h=p,p.play().catch(()=>{})}i&&i()}};return u.addEventListener("click",p=>{p.stopPropagation(),v()}),d.addEventListener("click",()=>{v()}),{play:v,pause:()=>{h instanceof HTMLVideoElement&&h.pause()},destroy:()=>{a&&(a.pause(),a.src="",a.remove(),a=null),h&&(h instanceof HTMLVideoElement&&(h.pause(),h.src=""),h.remove(),h=null),e.innerHTML=""}}}var y=class{embedKey;config;testimonials;reviews;analytics;hostElement=null;shadowRoot=null;rootWrapper=null;activePlayer=null;currentIndex=0;isExpanded=!1;isMounted=!1;keydownListener=null;liveRegion=null;previouslyFocusedEl=null;restoreFocusOnRender=!1;constructor(e){this.embedKey=e.embedKey,this.config=e.config||{},this.testimonials=e.testimonials||[],this.reviews=e.reviews||[],this.analytics=e.analytics}mount(){if(this.isMounted||typeof document>"u"||this.testimonials.length===0&&this.reviews.length===0)return;let e=document.querySelector("[data-vouchreel-embed]")||document.getElementById("vouchreel-embed");this.hostElement=document.createElement("div"),this.hostElement.id=`vouchreel-widget-${this.embedKey}`,this.hostElement.className="vouchreel-host-container",this.hostElement.setAttribute("role","region"),this.hostElement.setAttribute("aria-label","Customer testimonials and reviews"),this.shadowRoot=this.hostElement.attachShadow({mode:"open"});let t=document.createElement("style");t.textContent=$,this.shadowRoot.appendChild(t);let r=this.config.template||"floating-card",o=!!e||r==="wall-of-love"||r==="masonry"||r==="carousel";if(this.rootWrapper=document.createElement("div"),this.rootWrapper.className=`vr-theme-root vr-template-${r}`,o?(this.rootWrapper.style.width="100%",this.rootWrapper.style.position="relative"):this.rootWrapper.classList.add(`vr-pos-${this.config.position||"bottom-right"}`,"vr-animate-enter"),this.config.theme?.mode==="dark"&&this.rootWrapper.classList.add("vr-dark"),this.config.theme?.primaryColor&&this.rootWrapper.style.setProperty("--vr-primary",this.config.theme.primaryColor),this.config.theme?.accentColor&&this.rootWrapper.style.setProperty("--vr-accent",this.config.theme.accentColor),typeof this.config.theme?.borderRadius=="number"&&this.rootWrapper.style.setProperty("--vr-radius",`${this.config.theme.borderRadius}px`),this.shadowRoot.appendChild(this.rootWrapper),this.rootWrapper.addEventListener("animationend",i=>{i.target===this.rootWrapper&&this.rootWrapper&&this.rootWrapper.classList.remove("vr-animate-enter")}),this.liveRegion=document.createElement("div"),this.liveRegion.className="vr-sr-only",this.liveRegion.setAttribute("role","status"),this.shadowRoot.appendChild(this.liveRegion),e?e.appendChild(this.hostElement):document.body.appendChild(this.hostElement),this.isMounted=!0,this.analytics){let i=this.testimonials[0];this.analytics.track("impression",i?.id)}this.renderTemplate(),this.announce("Testimonials and reviews widget is now available."),this.keydownListener=i=>{i.key==="Escape"?this.isExpanded?this.collapse():o||this.dismiss():i.key==="Tab"&&this.isExpanded&&this.trapFocus(i)},document.addEventListener("keydown",this.keydownListener)}announce(e){this.liveRegion&&(this.liveRegion.textContent="",setTimeout(()=>{this.liveRegion&&(this.liveRegion.textContent=e)},100))}trapFocus(e){if(!this.shadowRoot)return;let t=Array.from(this.shadowRoot.querySelectorAll('button, a[href], iframe, video[controls], [tabindex]:not([tabindex="-1"])')).filter(s=>!s.hasAttribute("disabled")&&s.getClientRects().length>0);if(t.length===0)return;let r=t[0],o=t[t.length-1],i=this.shadowRoot.activeElement;i?e.shiftKey&&i===r?(e.preventDefault(),o.focus()):!e.shiftKey&&i===o&&(e.preventDefault(),r.focus()):(e.preventDefault(),r.focus())}renderTemplate(){switch(this.config.template||"floating-card"){case"wall-of-love":this.renderWallOfLove();break;case"carousel":this.renderCarousel();break;case"masonry":this.renderMasonry();break;case"story-strip":this.renderStoryStrip();break;default:this.renderCollapsed();break}}createVideoCard(e,t){let r=document.createElement("button");r.type="button",r.className="vr-card vr-blend-video-card",r.setAttribute("aria-label",`Play video testimonial from ${e.customerName||"customer"}`);let o=document.createElement("div");if(o.className="vr-card-video-thumb",e.thumbnailUrl){let d=document.createElement("img");d.src=e.thumbnailUrl,d.alt=e.customerName||"Video testimonial thumbnail",o.appendChild(d)}let i=document.createElement("div");if(i.className="vr-play-badge",i.setAttribute("aria-hidden","true"),i.innerHTML='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',o.appendChild(i),e.durationSeconds){let d=document.createElement("span");d.className="vr-card-duration";let u=Math.floor(e.durationSeconds/60),a=String(e.durationSeconds%60).padStart(2,"0");d.textContent=`${u}:${a}`,o.appendChild(d)}r.appendChild(o);let s=document.createElement("div");if(s.innerHTML='<span class="vr-provider-badge vr-badge-video">\u{1F4F9} Video Testimonial</span>',r.appendChild(s),e.quote||e.title){let d=document.createElement("p");d.className="vr-card-quote-text",d.textContent=`"${e.quote||e.title}"`,r.appendChild(d)}let m=document.createElement("div");m.className="vr-card-author-row";let c=(e.customerName||"C").charAt(0).toUpperCase(),l=document.createElement("div");l.className="vr-card-avatar",l.textContent=c,m.appendChild(l);let h=document.createElement("div");return h.innerHTML=`
      <div class="vr-card-author-name">${e.customerName||"Customer"}</div>
      ${e.customerCompany?`<div class="vr-card-author-sub">${e.customerCompany}</div>`:""}
    `,m.appendChild(h),r.appendChild(m),r.addEventListener("click",()=>{this.analytics&&this.analytics.track("click",e.id),this.expandVideo(t)}),r}createReviewCard(e){let t=document.createElement("button");t.type="button",t.className="vr-card vr-blend-review-card",t.setAttribute("aria-label",`View review from ${e.authorName} on ${e.provider}`);let r=document.createElement("div");r.style.display="flex",r.style.alignItems="center",r.style.justifyContent="space-between",r.style.gap="8px";let o=document.createElement("span");o.className=`vr-provider-badge ${e.provider==="google"?"vr-badge-google":"vr-badge-trustpilot"}`,o.textContent=e.provider==="google"?"Google":"Trustpilot",r.appendChild(o);let i=document.createElement("div");if(i.className="vr-stars",i.innerHTML=Array.from({length:5}).map((l,h)=>h<e.rating?"\u2605":"\u2606").join(""),r.appendChild(i),t.appendChild(r),e.text){let l=document.createElement("p");l.className="vr-card-quote-text",l.textContent=`"${e.text}"`,t.appendChild(l)}let s=document.createElement("div");if(s.className="vr-card-author-row",e.authorPhotoUrl){let l=document.createElement("img");l.src=e.authorPhotoUrl,l.alt=e.authorName,l.className="vr-card-avatar",s.appendChild(l)}else{let l=(e.authorName||"A").charAt(0).toUpperCase(),h=document.createElement("div");h.className="vr-card-avatar",h.textContent=l,s.appendChild(h)}let m=document.createElement("div"),c=e.reviewDate?new Date(e.reviewDate).toLocaleDateString():"";return m.innerHTML=`
      <div class="vr-card-author-name">${e.authorName}</div>
      ${c?`<div class="vr-card-author-sub">${c}</div>`:""}
    `,s.appendChild(m),t.appendChild(s),t.addEventListener("click",()=>{this.expandReview(e)}),t}renderWallOfLove(){if(!this.rootWrapper)return;this.rootWrapper.innerHTML="",this.isExpanded=!1;let e=document.createElement("div");e.className="vr-wall-wrapper";let t=document.createElement("div");t.className="vr-wall-grid";let r=Math.max(this.testimonials.length,this.reviews.length);for(let o=0;o<r;o++)o<this.testimonials.length&&t.appendChild(this.createVideoCard(this.testimonials[o],o)),o<this.reviews.length&&t.appendChild(this.createReviewCard(this.reviews[o]));e.appendChild(t),this.rootWrapper.appendChild(e),this.maybeRestoreFocus()}renderCarousel(){if(!this.rootWrapper)return;this.rootWrapper.innerHTML="",this.isExpanded=!1;let e=document.createElement("div");e.className="vr-carousel-container";let t=document.createElement("button");t.type="button",t.className="vr-carousel-arrow vr-carousel-prev",t.setAttribute("aria-label","Previous items"),t.innerHTML=`
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="15 18 9 12 15 6"></polyline>
      </svg>
    `;let r=document.createElement("button");r.type="button",r.className="vr-carousel-arrow vr-carousel-next",r.setAttribute("aria-label","Next items"),r.innerHTML=`
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    `;let o=document.createElement("div");o.className="vr-carousel-track";let i=Math.max(this.testimonials.length,this.reviews.length);for(let s=0;s<i;s++)s<this.testimonials.length&&o.appendChild(this.createVideoCard(this.testimonials[s],s)),s<this.reviews.length&&o.appendChild(this.createReviewCard(this.reviews[s]));t.addEventListener("click",()=>{o.scrollBy({left:-310,behavior:"smooth"})}),r.addEventListener("click",()=>{o.scrollBy({left:310,behavior:"smooth"})}),e.appendChild(t),e.appendChild(o),e.appendChild(r),this.rootWrapper.appendChild(e),this.maybeRestoreFocus()}renderStoryStrip(){if(!this.rootWrapper)return;this.rootWrapper.innerHTML="",this.isExpanded=!1;let e=document.createElement("div");e.className="vr-strip-wrapper",this.testimonials.slice(0,4).forEach((t,r)=>{let o=document.createElement("button");if(o.type="button",o.className="vr-story-item",o.setAttribute("aria-label",`Play video testimonial from ${t.customerName||"Customer"}`),o.setAttribute("title",t.customerName||"Video testimonial"),t.thumbnailUrl){let i=document.createElement("img");i.src=t.thumbnailUrl,i.alt=t.customerName||"Testimonial",o.appendChild(i)}else{let i=(t.customerName||"V").charAt(0).toUpperCase();o.textContent=i}o.addEventListener("click",()=>{this.analytics&&this.analytics.track("click",t.id),this.expandVideo(r)}),e.appendChild(o)}),this.reviews.slice(0,3).forEach(t=>{let r=document.createElement("button");if(r.type="button",r.className=`vr-story-item ${t.provider==="google"?"vr-story-review-google":"vr-story-review-trustpilot"}`,r.setAttribute("aria-label",`View review from ${t.authorName} on ${t.provider}`),r.setAttribute("title",`${t.authorName} (${t.provider})`),t.authorPhotoUrl){let i=document.createElement("img");i.src=t.authorPhotoUrl,i.alt=t.authorName,r.appendChild(i)}else{let i=(t.authorName||"R").charAt(0).toUpperCase();r.textContent=i}let o=document.createElement("span");o.className="vr-story-badge",o.textContent="\u2605",r.appendChild(o),r.addEventListener("click",()=>{this.expandReview(t)}),e.appendChild(r)}),this.rootWrapper.appendChild(e),this.maybeRestoreFocus()}renderCollapsed(){if(!this.rootWrapper)return;this.rootWrapper.innerHTML="",this.isExpanded=!1,this.activePlayer&&(this.activePlayer.destroy(),this.activePlayer=null);let e=this.testimonials[this.currentIndex]||this.testimonials[0];if(!e&&this.reviews.length>0){let l=this.reviews[0],h=document.createElement("div");h.className="vr-collapsed-card";let d=document.createElement("button");d.type="button",d.className="vr-open-btn",d.setAttribute("aria-label",`View review from ${l.authorName} on ${l.provider}`);let u=document.createElement("div");if(u.className="vr-thumb-wrapper",l.authorPhotoUrl){let p=document.createElement("img");p.src=l.authorPhotoUrl,p.alt=l.authorName,u.appendChild(p)}else u.style.display="flex",u.style.alignItems="center",u.style.justifyContent="center",u.style.backgroundColor="var(--vr-primary)",u.style.color="var(--vr-accent)",u.style.fontWeight="bold",u.textContent=(l.authorName||"R").charAt(0).toUpperCase();d.appendChild(u);let a=document.createElement("div");a.className="vr-card-info",a.innerHTML=`
        <div class="vr-card-name">${l.authorName}</div>
        <div class="vr-card-quote">\u2605 ${l.rating}.0 on ${l.provider}</div>
      `,d.appendChild(a),d.addEventListener("click",()=>this.expandReview(l)),h.appendChild(d);let v=document.createElement("button");v.type="button",v.className="vr-close-btn",v.setAttribute("aria-label","Dismiss widget"),v.innerHTML=`
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      `,v.addEventListener("click",p=>{p.stopPropagation(),this.dismiss()}),h.appendChild(v),this.rootWrapper.appendChild(h),this.maybeRestoreFocus();return}if(!e)return;let t=document.createElement("div");t.className="vr-collapsed-card";let r=document.createElement("button");r.type="button",r.className="vr-open-btn",r.setAttribute("aria-label",`Play video testimonial${e.customerName?` from ${e.customerName}`:""}`);let o=document.createElement("div");if(o.className="vr-thumb-wrapper",e.thumbnailUrl){let l=document.createElement("img");l.src=e.thumbnailUrl,l.alt=e.customerName||"Testimonial",o.appendChild(l)}let i=document.createElement("div");i.className="vr-play-badge",i.setAttribute("aria-hidden","true"),i.innerHTML=`
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5v14l11-7z"/>
      </svg>
    `,o.appendChild(i),r.appendChild(o);let s=document.createElement("div");s.className="vr-card-info";let m=document.createElement("div");if(m.className="vr-card-name",m.textContent=e.customerName||e.title||"Video Testimonial",s.appendChild(m),e.quote){let l=document.createElement("div");l.className="vr-card-quote",l.textContent=`"${e.quote}"`,s.appendChild(l)}r.appendChild(s),r.addEventListener("click",()=>{this.analytics&&this.analytics.track("click",e.id),this.expandVideo(this.currentIndex)}),t.appendChild(r);let c=document.createElement("button");c.type="button",c.className="vr-close-btn",c.setAttribute("aria-label","Dismiss testimonial widget"),c.innerHTML=`
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `,c.addEventListener("click",l=>{l.stopPropagation(),this.dismiss()}),t.appendChild(c),this.rootWrapper.appendChild(t),this.maybeRestoreFocus()}renderMasonry(){if(!this.rootWrapper)return;this.rootWrapper.innerHTML="",this.isExpanded=!1;let e=document.createElement("div");e.className="vr-masonry-wrapper";let t=Math.max(this.testimonials.length,this.reviews.length);for(let r=0;r<t;r++)r<this.testimonials.length&&e.appendChild(this.createVideoCard(this.testimonials[r],r)),r<this.reviews.length&&e.appendChild(this.createReviewCard(this.reviews[r]));this.rootWrapper.appendChild(e),this.maybeRestoreFocus()}expandVideo(e=0){if(!this.rootWrapper)return;!this.isExpanded&&this.shadowRoot&&(this.previouslyFocusedEl=this.shadowRoot.activeElement),this.isExpanded=!0,this.currentIndex=e;let t=this.testimonials[this.currentIndex];if(!t)return;this.rootWrapper.innerHTML="";let r=document.createElement("div");r.className="vr-backdrop",r.setAttribute("aria-hidden","true"),r.addEventListener("click",()=>this.collapse()),this.rootWrapper.appendChild(r);let o=document.createElement("div");o.className=`vr-expanded-modal vr-pos-${this.config.position||"bottom-right"}`,o.setAttribute("role","dialog"),o.setAttribute("aria-modal","true"),o.setAttribute("aria-label",t.customerName?`Video testimonial from ${t.customerName}`:"Video testimonial player"),o.tabIndex=-1;let i=document.createElement("div");i.className="vr-sheet-grabber",i.setAttribute("aria-hidden","true"),o.appendChild(i);let s=document.createElement("button");s.type="button",s.className="vr-modal-close-btn",s.setAttribute("aria-label","Close player"),s.innerHTML=`
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `,s.addEventListener("click",()=>this.collapse()),o.appendChild(s);let m=document.createElement("div");m.className="vr-player-container",o.appendChild(m),this.activePlayer=L({container:m,videoUrl:t.videoUrl,platform:t.platform,thumbnailUrl:t.thumbnailUrl,autoplayPreview:this.config.autoplayPreview,onPlay:()=>{this.analytics&&this.analytics.track("play",t.id)},onEnded:()=>{this.next()}});let c=document.createElement("div");if(c.className="vr-modal-body",t.quote){let a=document.createElement("p");a.className="vr-modal-quote",a.textContent=`"${t.quote}"`,c.appendChild(a)}let l=document.createElement("div");l.className="vr-modal-meta";let h=document.createElement("div"),d=document.createElement("div");if(d.className="vr-modal-author",d.textContent=t.customerName||t.title||"",h.appendChild(d),t.customerCompany){let a=document.createElement("div");a.className="vr-modal-company",a.textContent=t.customerCompany,h.appendChild(a)}if(l.appendChild(h),this.testimonials.length>1){let a=document.createElement("div");a.className="vr-carousel-controls";let v=document.createElement("button");v.type="button",v.className="vr-nav-btn",v.setAttribute("aria-label","Previous testimonial"),v.innerHTML=`
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      `,v.addEventListener("click",()=>this.prev());let p=document.createElement("button");p.type="button",p.className="vr-nav-btn",p.setAttribute("aria-label","Next testimonial"),p.innerHTML=`
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      `,p.addEventListener("click",()=>this.next()),a.appendChild(v),a.appendChild(p),l.appendChild(a)}c.appendChild(l),o.appendChild(c);let u=document.createElement("div");u.className="vr-powered-by",u.textContent="Verified by Vouchreel",o.appendChild(u),this.rootWrapper.appendChild(o),o.focus()}expandReview(e){if(!this.rootWrapper)return;!this.isExpanded&&this.shadowRoot&&(this.previouslyFocusedEl=this.shadowRoot.activeElement),this.isExpanded=!0,this.rootWrapper.innerHTML="";let t=document.createElement("div");t.className="vr-backdrop",t.setAttribute("aria-hidden","true"),t.addEventListener("click",()=>this.collapse()),this.rootWrapper.appendChild(t);let r=document.createElement("div");r.className=`vr-expanded-modal vr-pos-${this.config.position||"bottom-right"}`,r.setAttribute("role","dialog"),r.setAttribute("aria-modal","true"),r.setAttribute("aria-label",`Review from ${e.authorName}`),r.tabIndex=-1;let o=document.createElement("button");o.type="button",o.className="vr-modal-close-btn",o.setAttribute("aria-label","Close review"),o.innerHTML=`
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `,o.addEventListener("click",()=>this.collapse()),r.appendChild(o);let i=document.createElement("div");i.className="vr-review-modal-body";let s=document.createElement("div");s.className="vr-review-modal-header";let m=document.createElement("div");if(m.style.display="flex",m.style.alignItems="center",m.style.gap="10px",e.authorPhotoUrl){let a=document.createElement("img");a.src=e.authorPhotoUrl,a.alt=e.authorName,a.className="vr-card-avatar",m.appendChild(a)}else{let a=(e.authorName||"A").charAt(0).toUpperCase(),v=document.createElement("div");v.className="vr-card-avatar",v.textContent=a,m.appendChild(v)}let c=document.createElement("div"),l=e.reviewDate?new Date(e.reviewDate).toLocaleDateString():"";c.innerHTML=`
      <div style="font-weight: 600; font-size: 13px;">${e.authorName}</div>
      ${l?`<div style="font-size: 11px; color: var(--vr-text-muted);">${l}</div>`:""}
    `,m.appendChild(c),s.appendChild(m);let h=document.createElement("span");h.className=`vr-provider-badge ${e.provider==="google"?"vr-badge-google":"vr-badge-trustpilot"}`,h.textContent=e.provider==="google"?"Google Reviews":"Trustpilot Verified",s.appendChild(h),i.appendChild(s);let d=document.createElement("div");if(d.className="vr-stars",d.style.fontSize="18px",d.innerHTML=Array.from({length:5}).map((a,v)=>v<e.rating?"\u2605":"\u2606").join(""),i.appendChild(d),e.text){let a=document.createElement("div");a.className="vr-review-modal-text",a.textContent=e.text,i.appendChild(a)}r.appendChild(i);let u=document.createElement("div");u.className="vr-powered-by",u.textContent="Verified customer review",r.appendChild(u),this.rootWrapper.appendChild(r),r.focus()}expand(e=0){this.expandVideo(e)}next(){this.testimonials.length<=1||(this.currentIndex=(this.currentIndex+1)%this.testimonials.length,this.expandVideo(this.currentIndex))}prev(){this.testimonials.length<=1||(this.currentIndex=(this.currentIndex-1+this.testimonials.length)%this.testimonials.length,this.expandVideo(this.currentIndex))}collapse(){this.isExpanded&&(this.restoreFocusOnRender=!0,this.renderTemplate())}maybeRestoreFocus(){if(!this.restoreFocusOnRender||!this.rootWrapper)return;this.restoreFocusOnRender=!1;let e=this.rootWrapper.querySelector(".vr-open-btn, .vr-story-item, .vr-card");e?e.focus():this.previouslyFocusedEl&&this.previouslyFocusedEl.focus(),this.previouslyFocusedEl=null}dismiss(){H(this.embedKey),this.activePlayer&&(this.activePlayer.destroy(),this.activePlayer=null),this.keydownListener&&(document.removeEventListener("keydown",this.keydownListener),this.keydownListener=null),this.rootWrapper&&(this.rootWrapper.classList.remove("vr-animate-enter"),this.rootWrapper.classList.add("vr-animate-leave"),setTimeout(()=>{this.hostElement&&this.hostElement.parentNode&&this.hostElement.parentNode.removeChild(this.hostElement),this.isMounted=!1},250))}};function Q(){return typeof document>"u"?null:document.currentScript instanceof HTMLScriptElement?document.currentScript:document.querySelector("script[data-key]")||document.querySelector("script[src*='vouchreel']")||document.querySelector("script[src*='widget']")||null}function X(n){if(!n)return null;let e=n.getAttribute("data-key");if(e&&e.trim().length>0)return e.trim();let t=n.getAttribute("src")||n.src;if(t)try{let r=new URL(t,window.location.href),i=r.pathname.match(/\/widget\/([^/.]+)(?:\.js)?$/);if(i&&i[1]&&i[1]!=="vouchreel-widget")return i[1];let s=r.searchParams.get("key")||r.searchParams.get("embedKey")||r.searchParams.get("k");if(s)return s.trim()}catch{}return null}function Z(n){if(n){let e=n.getAttribute("data-api");if(e&&e.trim().length>0)return e.trim().replace(/\/+$/,"");let t=n.getAttribute("src")||n.src;if(t)try{let r=new URL(t,window.location.href);if(r.origin&&r.origin!=="null")return r.origin}catch{}}return typeof window<"u"&&window.location?window.location.origin:""}async function N(){try{let n=Q(),e=X(n);if(!e||k(e))return;let t=Z(n),r=`${t}/api/widget/${encodeURIComponent(e)}`,o=await fetch(r,{method:"GET",headers:{Accept:"application/json"}});if(!o.ok)return;let i=await o.json();if(!i||!i.config||!Array.isArray(i.testimonials))return;let s=typeof window<"u"&&window.location?window.location.pathname:"/";if(!E(i.config,s))return;let m=typeof window<"u"?window.location:{pathname:"/"},c=C(i.testimonials||[],m),l=Array.isArray(i.reviews)?i.reviews:[],h=W(l,m);if(c.length===0&&h.length===0)return;let d=new b({spaceId:i.spaceId,apiBase:t,conversionGoals:i.conversionGoals});typeof window<"u"&&(window.vouchreelConvert=p=>{d.track("convert",null,{goalId:p,source:"pixel"})});let u=new y({embedKey:e,config:i.config,testimonials:c,reviews:h,analytics:d}),a=i.config.trigger?.type||"delay",v=i.config.trigger?.value||null;T({type:a,value:v,embedKey:e,onTrigger:()=>{u.mount()}})}catch{}}function A(){typeof document>"u"||(document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{N()}):setTimeout(()=>{N()},10))}A();return O(ee);})();
