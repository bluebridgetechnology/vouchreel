var Vouchreel=(()=>{var L=Object.defineProperty;var R=Object.getOwnPropertyDescriptor;var z=Object.getOwnPropertyNames;var U=Object.prototype.hasOwnProperty;var $=(r,e)=>{for(var t in e)L(r,t,{get:e[t],enumerable:!0})},j=(r,e,t,i)=>{if(e&&typeof e=="object"||typeof e=="function")for(let o of z(e))!U.call(r,o)&&o!==t&&L(r,o,{get:()=>e[o],enumerable:!(i=R(e,o))||i.enumerable});return r};var q=r=>j(L({},"__esModule",{value:!0}),r);var Z={};$(Z,{AnalyticsTracker:()=>y,VouchreelWidget:()=>b,createVideoPlayer:()=>C,filterTestimonials:()=>E,initLoader:()=>I,isPageAllowed:()=>w,matchPattern:()=>g,matchTags:()=>P,setupTrigger:()=>T,startWidget:()=>M});function x(r){if(!r)return"/";let e=r.split("?")[0].split("#")[0].trim();return e.length>1&&e.endsWith("/")&&(e=e.slice(0,-1)),e.startsWith("/")||(e="/"+e),e}function Y(r){let e=x(r);if(e==="/*"||e==="/**")return/^.*$/;let t="",i=0;for(;i<e.length;){let o=e[i];o==="*"&&e[i+1]==="*"?(t+=".*",i+=2):o==="*"?(t+="[^/]+",i+=1):["\\",".","^","$","+","?","(",")","[","]","{","}","|"].includes(o)?(t+="\\"+o,i+=1):(t+=o,i+=1)}return new RegExp(`^${t}(?:/)?$`,"i")}function g(r,e){if(!r)return!1;let t=r.trim();if(t==="*"||t==="/*"||t==="/**")return!0;let i=x(e);return Y(t).test(i)}function P(r,e){if(!r||r.length===0)return!0;if(!e||e.length===0)return!1;let t=e.map(i=>i.trim().toLowerCase());return r.some(i=>t.includes(i.trim().toLowerCase()))}function O(){if(typeof document>"u")return[];let r=document.body?.getAttribute("data-vouchreel-tags");if(r)return r.split(",").map(t=>t.trim()).filter(Boolean);let e=document.querySelector('meta[name="vouchreel-tags"]');if(e){let t=e.getAttribute("content");if(t)return t.split(",").map(i=>i.trim()).filter(Boolean)}return[]}function w(r,e="/"){if(!r)return!0;let t=x(e);if(r.pagesExcluded&&r.pagesExcluded.length>0){for(let i of r.pagesExcluded)if(i&&g(i,t))return!1}return r.pagesIncluded&&r.pagesIncluded.length>0?r.pagesIncluded.some(o=>o==="*"||o==="/*"||o==="/**")?!0:r.pagesIncluded.some(o=>g(o,t)):!0}function E(r,e={pathname:"/"},t=O()){if(!Array.isArray(r)||r.length===0)return[];let i=x(e.pathname);return r.filter(o=>{let n=o.matchRules;if(!n||!n.mode||n.mode==="all")return!0;if(n.mode==="specific"){let d=!1;Array.isArray(n.urlPatterns)&&n.urlPatterns.length>0?d=n.urlPatterns.some(a=>g(a,i)):d=!0;let m=P(n.tags,t);return d&&m}return!0})}function k(r){if(typeof window>"u"||!window.sessionStorage)return!1;try{return window.sessionStorage.getItem(`vouchreel_dismissed_${r}`)==="true"}catch{return!1}}function W(r){if(!(typeof window>"u"||!window.sessionStorage))try{window.sessionStorage.setItem(`vouchreel_dismissed_${r}`,"true")}catch{}}function G(){return typeof window>"u"||typeof navigator>"u"?!1:navigator.maxTouchPoints>0||/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)}function T({type:r,value:e,embedKey:t,onTrigger:i}){if(k(t))return{cancel:()=>{}};let o=!1,n=()=>{o||k(t)||(o=!0,f(),i())},d=null,m=null,a=null,p=[],f=()=>{d!==null&&(clearTimeout(d),d=null),m&&(m.disconnect(),m=null),a&&a.parentNode&&(a.parentNode.removeChild(a),a=null);for(let u of p)try{u()}catch{}p=[]};switch(r){case"delay":{let u=e&&typeof e.seconds=="number"&&e.seconds>0?e.seconds:3;d=setTimeout(n,u*1e3);break}case"exit-intent":{if(typeof window>"u"||typeof document>"u")break;if(G()){let c=window.scrollY||window.pageYOffset,s=Date.now(),v=()=>{let l=window.scrollY||window.pageYOffset,h=Date.now(),A=l-c,N=h-s;l>150&&A<-40&&N>0&&N<200&&n(),c=l,s=h};window.addEventListener("scroll",v,{passive:!0}),p.push(()=>window.removeEventListener("scroll",v))}else{let c=s=>{(s.clientY<=0||!s.relatedTarget)&&n()};document.addEventListener("mouseleave",c),p.push(()=>document.removeEventListener("mouseleave",c))}break}case"scroll-depth":{if(typeof window>"u"||typeof document>"u")break;let u=e&&typeof e.percentage=="number"&&e.percentage>0?Math.min(Math.max(e.percentage,1),100):50;if(typeof IntersectionObserver<"u"&&document.body)try{a=document.createElement("div"),a.className="vouchreel-scroll-sentinel",a.style.position="absolute",a.style.top=`${u}%`,a.style.left="0",a.style.width="1px",a.style.height="1px",a.style.pointerEvents="none",a.style.opacity="0",a.style.zIndex="-1",document.body.appendChild(a),m=new IntersectionObserver(s=>{for(let v of s)if(v.isIntersecting){n();break}}),m.observe(a)}catch{}let c=()=>{let s=window.scrollY||document.documentElement.scrollTop||document.body.scrollTop||0,v=document.documentElement.scrollHeight||document.body.scrollHeight||1,l=window.innerHeight||document.documentElement.clientHeight||1,h=v-l;if(h<=0){d=setTimeout(n,1500);return}s/h*100>=u&&n()};window.addEventListener("scroll",c,{passive:!0}),p.push(()=>window.removeEventListener("scroll",c)),c();break}case"pageview-count":{if(typeof window>"u"||!window.sessionStorage){n();break}let u=e&&typeof e.count=="number"&&e.count>0?e.count:2,c=1;try{let s=window.sessionStorage.getItem("vouchreel_pv_count");c=s?parseInt(s,10)+1:1,window.sessionStorage.setItem("vouchreel_pv_count",c.toString())}catch{}c>=u&&(d=setTimeout(n,800));break}case"returning-visitor":{if(typeof window>"u"||!window.localStorage){n();break}try{window.localStorage.getItem("vouchreel_visited")==="true"?d=setTimeout(n,1e3):window.localStorage.setItem("vouchreel_visited","true")}catch{d=setTimeout(n,2e3)}break}default:{d=setTimeout(n,3e3);break}}return{cancel:f}}function S(){if(typeof crypto<"u"&&typeof crypto.randomUUID=="function")try{return crypto.randomUUID()}catch{}return"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,r=>{let e=Math.random()*16|0;return(r==="x"?e:e&3|8).toString(16)})}function D(){if(typeof window>"u"||!window.sessionStorage)return S();let r="vouchreel_session_id";try{let e=window.sessionStorage.getItem(r);if(e&&e.length>=10)return e;let t=S();return window.sessionStorage.setItem(r,t),t}catch{return S()}}var y=class{spaceId;apiBase;sessionId;conversionGoals;queue=[];flushTimer=null;flushIntervalMs;isDestroyed=!1;constructor(e){this.spaceId=e.spaceId,this.apiBase=e.apiBase?e.apiBase.replace(/\/+$/,""):"",this.sessionId=D(),this.conversionGoals=e.conversionGoals||[],this.flushIntervalMs=e.flushIntervalMs??5e3,this.bindLifecycleListeners(),this.checkConversionGoals()}track(e,t,i){if(this.isDestroyed||!this.spaceId)return;let o=typeof window<"u"&&window.location?window.location.href.split("#")[0]:"",n={spaceId:this.spaceId,testimonialId:t||null,sessionId:this.sessionId,eventType:e,pageUrl:o,timestamp:new Date().toISOString(),metadata:i||null};if(this.queue.push(n),e==="impression"||e==="play")try{window.sessionStorage.setItem("vouchreel_engaged","true")}catch{}this.scheduleFlush()}checkConversionGoals(){if(typeof window>"u"||!window.location||!this.conversionGoals||this.conversionGoals.length===0)return;let e=window.location.pathname;for(let t of this.conversionGoals)if(t.goalType==="url-match"&&t.goalValue&&g(t.goalValue,e)){let i=`vouchreel_converted_${t.id}`;try{if(window.sessionStorage.getItem(i)==="true")continue;window.sessionStorage.setItem(i,"true")}catch{}this.track("convert",null,{goalId:t.id,goalValue:t.goalValue})}}flush(){if(this.queue.length===0)return;this.flushTimer!==null&&(clearTimeout(this.flushTimer),this.flushTimer=null);let e=[...this.queue];this.queue=[];let t=`${this.apiBase}/api/events`,i=JSON.stringify({events:e});if(typeof navigator<"u"&&typeof navigator.sendBeacon=="function")try{let o=new Blob([i],{type:"application/json"});if(navigator.sendBeacon(t,o))return}catch{}if(typeof fetch=="function")try{fetch(t,{method:"POST",headers:{"Content-Type":"application/json"},body:i,keepalive:!0}).catch(()=>{})}catch{}}scheduleFlush(){this.flushTimer===null&&(this.flushTimer=setTimeout(()=>{this.flushTimer=null,this.flush()},this.flushIntervalMs))}bindLifecycleListeners(){if(typeof document>"u"||typeof window>"u")return;let e=()=>{document.visibilityState==="hidden"&&this.flush()},t=()=>{this.flush()};document.addEventListener("visibilitychange",e),window.addEventListener("pagehide",t),window.addEventListener("beforeunload",t)}destroy(){this.isDestroyed=!0,this.flush()}};var B=`:host {
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
  --vr-primary: #6366f1;
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
  left: 50%;
  transform: translateX(-50%);
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
    transform: translateY(0) scale(1);
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
`;function H(r){if(!r)return null;let e=r.trim(),t=e.match(/[?&]v=([^&#]+)/);if(t)return t[1];let i=e.match(/youtu\.be\/([^?&#]+)/);if(i)return i[1];let o=e.match(/youtube(?:-nocookie)?\.com\/embed\/([^?&#]+)/);if(o)return o[1];let n=e.match(/youtube\.com\/shorts\/([^?&#]+)/);return n?n[1]:null}function K(r){if(!r)return null;let t=r.trim().match(/vimeo(?:\.com|\.com\/video)?\/(\d+)/);return t?t[1]:null}function V(r){if(!r)return"mp4";let e=r.toLowerCase();return e.includes("youtube.com")||e.includes("youtu.be")?"youtube":e.includes("vimeo.com")?"vimeo":"mp4"}function F(r,e,t){if(t&&t.trim().length>0)return t.trim();if((e||V(r))==="youtube"){let o=H(r);if(o)return`https://img.youtube.com/vi/${o}/hqdefault.jpg`}return""}function C(r){let{container:e,videoUrl:t,thumbnailUrl:i,autoplayPreview:o=!1,onPlay:n,onEnded:d}=r,m=r.platform||V(t),a=F(t,m,i),p=!1,f=null;e.innerHTML="",e.className="vr-player-container";let u=document.createElement("div");if(u.className="vr-player-thumb-wrap",a){let l=document.createElement("img");l.src=a,l.alt="Video thumbnail",l.className="vr-player-thumb-img",l.loading="lazy",u.appendChild(l)}else{let l=document.createElement("div");l.className="vr-player-placeholder",u.appendChild(l)}let c=document.createElement("button");c.type="button",c.className="vr-player-play-btn",c.setAttribute("aria-label","Play testimonial video"),c.innerHTML=`
    <svg class="vr-player-play-icon" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z"/>
    </svg>
  `,u.appendChild(c);let s=null;o&&m==="mp4"&&(s=document.createElement("video"),s.src=t,s.muted=!0,s.autoplay=!0,s.loop=!0,s.playsInline=!0,s.className="vr-player-preview-video",u.appendChild(s)),e.appendChild(u);let v=()=>{if(!p){if(p=!0,s&&(s.pause(),s.remove(),s=null),u.style.display="none",m==="youtube"){let l=H(t),h=document.createElement("iframe");h.src=`https://www.youtube-nocookie.com/embed/${l||""}?autoplay=1&rel=0&playsinline=1&enablejsapi=1`,h.title="YouTube testimonial video",h.className="vr-player-iframe",h.setAttribute("frameborder","0"),h.setAttribute("allow","accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"),h.setAttribute("allowfullscreen","true"),e.appendChild(h),f=h}else if(m==="vimeo"){let l=K(t),h=document.createElement("iframe");h.src=`https://player.vimeo.com/video/${l||""}?autoplay=1&badge=0&autopause=0&player_id=0&app_id=58479`,h.title="Vimeo testimonial video",h.className="vr-player-iframe",h.setAttribute("frameborder","0"),h.setAttribute("allow","autoplay; fullscreen; picture-in-picture"),h.setAttribute("allowfullscreen","true"),e.appendChild(h),f=h}else{let l=document.createElement("video");l.src=t,l.controls=!0,l.autoplay=!0,l.playsInline=!0,l.className="vr-player-video",a&&(l.poster=a),l.addEventListener("ended",()=>{d&&d()}),e.appendChild(l),f=l,l.play().catch(()=>{})}n&&n()}};return c.addEventListener("click",l=>{l.stopPropagation(),v()}),u.addEventListener("click",()=>{v()}),{play:v,pause:()=>{f instanceof HTMLVideoElement&&f.pause()},destroy:()=>{s&&(s.pause(),s.src="",s.remove(),s=null),f&&(f instanceof HTMLVideoElement&&(f.pause(),f.src=""),f.remove(),f=null),e.innerHTML=""}}}var b=class{embedKey;config;testimonials;analytics;hostElement=null;shadowRoot=null;rootWrapper=null;activePlayer=null;currentIndex=0;isExpanded=!1;isMounted=!1;keydownListener=null;constructor(e){this.embedKey=e.embedKey,this.config=e.config||{},this.testimonials=e.testimonials||[],this.analytics=e.analytics}mount(){if(this.isMounted||typeof document>"u"||!this.testimonials||this.testimonials.length===0)return;this.hostElement=document.createElement("div"),this.hostElement.id=`vouchreel-widget-${this.embedKey}`,this.hostElement.className="vouchreel-host-container",this.shadowRoot=this.hostElement.attachShadow({mode:"open"});let e=document.createElement("style");if(e.textContent=B,this.shadowRoot.appendChild(e),this.rootWrapper=document.createElement("div"),this.rootWrapper.className=`vr-theme-root vr-pos-${this.config.position||"bottom-right"} vr-animate-enter`,this.config.theme?.mode==="dark"&&this.rootWrapper.classList.add("vr-dark"),this.config.theme?.primaryColor&&this.rootWrapper.style.setProperty("--vr-primary",this.config.theme.primaryColor),this.config.theme?.accentColor&&this.rootWrapper.style.setProperty("--vr-accent",this.config.theme.accentColor),typeof this.config.theme?.borderRadius=="number"&&this.rootWrapper.style.setProperty("--vr-radius",`${this.config.theme.borderRadius}px`),this.shadowRoot.appendChild(this.rootWrapper),document.body.appendChild(this.hostElement),this.isMounted=!0,this.analytics){let t=this.testimonials[this.currentIndex];this.analytics.track("impression",t?.id)}this.renderCollapsed(),this.keydownListener=t=>{t.key==="Escape"&&(this.isExpanded?this.collapse():this.dismiss())},document.addEventListener("keydown",this.keydownListener)}renderCollapsed(){if(!this.rootWrapper)return;this.rootWrapper.innerHTML="",this.isExpanded=!1,this.activePlayer&&(this.activePlayer.destroy(),this.activePlayer=null);let e=this.testimonials[this.currentIndex]||this.testimonials[0];if((this.config.position||"bottom-right")==="story-strip"&&this.testimonials.length>1){this.renderStoryStrip();return}let i=document.createElement("div");i.className="vr-collapsed-card";let o=document.createElement("div");if(o.className="vr-thumb-wrapper",e.thumbnailUrl){let p=document.createElement("img");p.src=e.thumbnailUrl,p.alt=e.customerName||"Testimonial",o.appendChild(p)}let n=document.createElement("div");n.className="vr-play-badge",n.innerHTML=`
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5v14l11-7z"/>
      </svg>
    `,o.appendChild(n),i.appendChild(o);let d=document.createElement("div");d.className="vr-card-info";let m=document.createElement("div");if(m.className="vr-card-name",m.textContent=e.customerName||e.title||"Video Testimonial",d.appendChild(m),e.quote){let p=document.createElement("div");p.className="vr-card-quote",p.textContent=`"${e.quote}"`,d.appendChild(p)}i.appendChild(d);let a=document.createElement("button");a.type="button",a.className="vr-close-btn",a.setAttribute("aria-label","Dismiss testimonial widget"),a.innerHTML=`
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `,a.addEventListener("click",p=>{p.stopPropagation(),this.dismiss()}),i.appendChild(a),i.addEventListener("click",()=>{this.analytics&&this.analytics.track("click",e.id),this.expand(this.currentIndex)}),this.rootWrapper.appendChild(i)}renderStoryStrip(){if(!this.rootWrapper)return;let e=document.createElement("div");e.className="vr-strip-wrapper",this.testimonials.slice(0,5).forEach((i,o)=>{let n=document.createElement("div");if(n.className="vr-story-item",n.setAttribute("title",i.customerName||i.title||"Testimonial"),i.thumbnailUrl){let d=document.createElement("img");d.src=i.thumbnailUrl,d.alt=i.customerName||"Testimonial",n.appendChild(d)}n.addEventListener("click",()=>{this.analytics&&this.analytics.track("click",i.id),this.expand(o)}),e.appendChild(n)});let t=document.createElement("button");t.type="button",t.className="vr-close-btn",t.style.position="static",t.setAttribute("aria-label","Dismiss widget"),t.innerHTML=`
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `,t.addEventListener("click",i=>{i.stopPropagation(),this.dismiss()}),e.appendChild(t),this.rootWrapper.appendChild(e)}expand(e=0){if(!this.rootWrapper)return;this.isExpanded=!0,this.currentIndex=e;let t=this.testimonials[this.currentIndex];if(!t)return;this.rootWrapper.innerHTML="";let i=document.createElement("div");i.className="vr-backdrop",i.addEventListener("click",()=>this.collapse()),this.rootWrapper.appendChild(i);let o=document.createElement("div");o.className=`vr-expanded-modal vr-pos-${this.config.position||"bottom-right"}`;let n=document.createElement("div");n.className="vr-sheet-grabber",o.appendChild(n);let d=document.createElement("button");d.type="button",d.className="vr-modal-close-btn",d.setAttribute("aria-label","Close player"),d.innerHTML=`
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `,d.addEventListener("click",()=>this.collapse()),o.appendChild(d);let m=document.createElement("div");m.className="vr-player-container",o.appendChild(m),this.activePlayer=C({container:m,videoUrl:t.videoUrl,platform:t.platform,thumbnailUrl:t.thumbnailUrl,autoplayPreview:this.config.autoplayPreview,onPlay:()=>{this.analytics&&this.analytics.track("play",t.id)},onEnded:()=>{this.next()}});let a=document.createElement("div");if(a.className="vr-modal-body",t.quote){let s=document.createElement("p");s.className="vr-modal-quote",s.textContent=`"${t.quote}"`,a.appendChild(s)}let p=document.createElement("div");p.className="vr-modal-meta";let f=document.createElement("div"),u=document.createElement("div");if(u.className="vr-modal-author",u.textContent=t.customerName||t.title||"",f.appendChild(u),t.customerCompany){let s=document.createElement("div");s.className="vr-modal-company",s.textContent=t.customerCompany,f.appendChild(s)}if(p.appendChild(f),this.testimonials.length>1){let s=document.createElement("div");s.className="vr-carousel-controls";let v=document.createElement("button");v.type="button",v.className="vr-nav-btn",v.setAttribute("aria-label","Previous testimonial"),v.innerHTML=`
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      `,v.addEventListener("click",()=>this.prev());let l=document.createElement("button");l.type="button",l.className="vr-nav-btn",l.setAttribute("aria-label","Next testimonial"),l.innerHTML=`
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      `,l.addEventListener("click",()=>this.next()),s.appendChild(v),s.appendChild(l),p.appendChild(s)}a.appendChild(p),o.appendChild(a);let c=document.createElement("div");c.className="vr-powered-by",c.textContent="Verified by Vouchreel",o.appendChild(c),this.rootWrapper.appendChild(o)}next(){this.testimonials.length<=1||(this.currentIndex=(this.currentIndex+1)%this.testimonials.length,this.expand(this.currentIndex))}prev(){this.testimonials.length<=1||(this.currentIndex=(this.currentIndex-1+this.testimonials.length)%this.testimonials.length,this.expand(this.currentIndex))}collapse(){this.isExpanded&&this.renderCollapsed()}dismiss(){W(this.embedKey),this.activePlayer&&(this.activePlayer.destroy(),this.activePlayer=null),this.keydownListener&&(document.removeEventListener("keydown",this.keydownListener),this.keydownListener=null),this.rootWrapper&&(this.rootWrapper.classList.remove("vr-animate-enter"),this.rootWrapper.classList.add("vr-animate-leave"),setTimeout(()=>{this.hostElement&&this.hostElement.parentNode&&this.hostElement.parentNode.removeChild(this.hostElement),this.isMounted=!1},250))}};function J(){return typeof document>"u"?null:document.currentScript instanceof HTMLScriptElement?document.currentScript:document.querySelector("script[data-key]")||document.querySelector("script[src*='vouchreel']")||document.querySelector("script[src*='widget']")||null}function X(r){if(!r)return null;let e=r.getAttribute("data-key");if(e&&e.trim().length>0)return e.trim();let t=r.getAttribute("src")||r.src;if(t)try{let i=new URL(t,window.location.href),n=i.pathname.match(/\/widget\/([^/.]+)(?:\.js)?$/);if(n&&n[1]&&n[1]!=="vouchreel-widget")return n[1];let d=i.searchParams.get("key")||i.searchParams.get("embedKey")||i.searchParams.get("k");if(d)return d.trim()}catch{}return null}function Q(r){if(r){let e=r.getAttribute("data-api");if(e&&e.trim().length>0)return e.trim().replace(/\/+$/,"");let t=r.getAttribute("src")||r.src;if(t)try{let i=new URL(t,window.location.href);if(i.origin&&i.origin!=="null")return i.origin}catch{}}return typeof window<"u"&&window.location?window.location.origin:""}async function I(){try{let r=J(),e=X(r);if(!e||k(e))return;let t=Q(r),i=`${t}/api/widget/${encodeURIComponent(e)}`,o=await fetch(i,{method:"GET",headers:{Accept:"application/json"}});if(!o.ok)return;let n=await o.json();if(!n||!n.config||!Array.isArray(n.testimonials))return;let d=typeof window<"u"&&window.location?window.location.pathname:"/";if(!w(n.config,d))return;let m=E(n.testimonials,typeof window<"u"?window.location:{pathname:"/"});if(m.length===0)return;let a=new y({spaceId:n.spaceId,apiBase:t,conversionGoals:n.conversionGoals});typeof window<"u"&&(window.vouchreelConvert=c=>{a.track("convert",null,{goalId:c,source:"pixel"})});let p=new b({embedKey:e,config:n.config,testimonials:m,analytics:a}),f=n.config.trigger?.type||"delay",u=n.config.trigger?.value||null;T({type:f,value:u,embedKey:e,onTrigger:()=>{p.mount()}})}catch{}}function M(){typeof document>"u"||(document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{I()}):setTimeout(()=>{I()},10))}M();return q(Z);})();
