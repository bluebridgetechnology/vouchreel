var Vouchreel=(()=>{var W=Object.defineProperty;var G=Object.getOwnPropertyDescriptor;var Y=Object.getOwnPropertyNames;var _=Object.prototype.hasOwnProperty;var K=(o,e)=>{for(var t in e)W(o,t,{get:e[t],enumerable:!0})},Q=(o,e,t,r)=>{if(e&&typeof e=="object"||typeof e=="function")for(let n of Y(e))!_.call(o,n)&&n!==t&&W(o,n,{get:()=>e[n],enumerable:!(r=G(e,n))||r.enumerable});return o};var J=o=>Q(W({},"__esModule",{value:!0}),o);var ce={};K(ce,{AnalyticsTracker:()=>C,VouchreelWidget:()=>k,createVideoPlayer:()=>P,filterTestimonials:()=>A,initLoader:()=>S,isPageAllowed:()=>N,matchPattern:()=>x,matchTags:()=>I,setupTrigger:()=>R,startWidget:()=>$});function U(){if(typeof document<"u"&&document.documentElement?.lang){let o=document.documentElement.lang.trim().slice(0,2).toLowerCase();if(o)return o}return typeof navigator<"u"&&navigator.language?navigator.language.slice(0,2).toLowerCase():"en"}function V(o,e){if(!o||!o.translations)return null;let t=e.trim().toLowerCase();if(Array.isArray(o.translations))return o.translations.find(n=>n.language?.trim().toLowerCase()===t)||null;if(typeof o.translations=="object"){let r=o.translations[t];if(r)return{language:t,quote:r.quote??null,transcript:r.transcript??null}}return null}function L(o){if(!o)return"/";let e=o.split("?")[0].split("#")[0].trim();return e.length>1&&e.endsWith("/")&&(e=e.slice(0,-1)),e.startsWith("/")||(e="/"+e),e}function X(o){let e=L(o);if(e==="/*"||e==="/**")return/^.*$/;let t="",r=0;for(;r<e.length;){let n=e[r];n==="*"&&e[r+1]==="*"?(t+=".*",r+=2):n==="*"?(t+="[^/]+",r+=1):["\\",".","^","$","+","?","(",")","[","]","{","}","|"].includes(n)?(t+="\\"+n,r+=1):(t+=n,r+=1)}return new RegExp(`^${t}(?:/)?$`,"i")}function x(o,e){if(!o)return!1;let t=o.trim();if(t==="*"||t==="/*"||t==="/**")return!0;let r=L(e);return X(t).test(r)}function I(o,e){if(!o||o.length===0)return!0;if(!e||e.length===0)return!1;let t=e.map(r=>r.trim().toLowerCase());return o.some(r=>t.includes(r.trim().toLowerCase()))}function z(){if(typeof document>"u")return[];let o=document.body?.getAttribute("data-vouchreel-tags");if(o)return o.split(",").map(t=>t.trim()).filter(Boolean);let e=document.querySelector('meta[name="vouchreel-tags"]');if(e){let t=e.getAttribute("content");if(t)return t.split(",").map(r=>r.trim()).filter(Boolean)}return[]}function N(o,e="/"){if(!o)return!0;let t=L(e);if(o.pagesExcluded&&o.pagesExcluded.length>0){for(let r of o.pagesExcluded)if(r&&x(r,t))return!1}return o.pagesIncluded&&o.pagesIncluded.length>0?o.pagesIncluded.some(n=>n==="*"||n==="/*"||n==="/**")?!0:o.pagesIncluded.some(n=>x(n,t)):!0}function A(o,e={pathname:"/"},t=z()){if(!Array.isArray(o)||o.length===0)return[];let r=L(e.pathname);return o.filter(n=>{let i=n.matchRules;if(!i||!i.mode||i.mode==="all")return!0;if(i.mode==="specific"){let a=!1;Array.isArray(i.urlPatterns)&&i.urlPatterns.length>0?a=i.urlPatterns.some(p=>x(p,r)):a=!0;let d=I(i.tags,t);return a&&d}return!0})}function D(o,e={pathname:"/"},t=z()){if(!Array.isArray(o)||o.length===0)return[];let r=L(e.pathname);return o.filter(n=>{let i=n.matchRules;if(!i||!i.mode||i.mode==="all")return!0;if(i.mode==="specific"){let a=!1;Array.isArray(i.urlPatterns)&&i.urlPatterns.length>0?a=i.urlPatterns.some(p=>x(p,r)):a=!0;let d=I(i.tags,t);return a&&d}return!0})}function M(o){if(typeof window>"u"||!window.sessionStorage)return!1;try{return window.sessionStorage.getItem(`vouchreel_dismissed_${o}`)==="true"}catch{return!1}}function j(o){if(!(typeof window>"u"||!window.sessionStorage))try{window.sessionStorage.setItem(`vouchreel_dismissed_${o}`,"true")}catch{}}function Z(){return typeof window>"u"||typeof navigator>"u"?!1:navigator.maxTouchPoints>0||/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)}function R({type:o,value:e,embedKey:t,onTrigger:r}){if(M(t))return{cancel:()=>{}};let n=!1,i=()=>{n||M(t)||(n=!0,s(),r())},a=null,d=null,p=null,h=[],s=()=>{a!==null&&(clearTimeout(a),a=null),d&&(d.disconnect(),d=null),p&&p.parentNode&&(p.parentNode.removeChild(p),p=null);for(let v of h)try{v()}catch{}h=[]};switch(o){case"delay":{let v=e&&typeof e.seconds=="number"&&e.seconds>0?e.seconds:3;a=setTimeout(i,v*1e3);break}case"exit-intent":{if(typeof window>"u"||typeof document>"u")break;if(Z()){let l=window.scrollY||window.pageYOffset,c=Date.now(),f=()=>{let m=window.scrollY||window.pageYOffset,g=Date.now(),u=m-l,E=g-c;m>150&&u<-40&&E>0&&E<200&&i(),l=m,c=g};window.addEventListener("scroll",f,{passive:!0}),h.push(()=>window.removeEventListener("scroll",f))}else{let l=c=>{(c.clientY<=0||!c.relatedTarget)&&i()};document.addEventListener("mouseleave",l),h.push(()=>document.removeEventListener("mouseleave",l))}break}case"scroll-depth":{if(typeof window>"u"||typeof document>"u")break;let v=e&&typeof e.percentage=="number"&&e.percentage>0?Math.min(Math.max(e.percentage,1),100):50;if(typeof IntersectionObserver<"u"&&document.body)try{p=document.createElement("div"),p.className="vouchreel-scroll-sentinel",p.style.position="absolute",p.style.top=`${v}%`,p.style.left="0",p.style.width="1px",p.style.height="1px",p.style.pointerEvents="none",p.style.opacity="0",p.style.zIndex="-1",document.body.appendChild(p),d=new IntersectionObserver(c=>{for(let f of c)if(f.isIntersecting){i();break}}),d.observe(p)}catch{}let l=()=>{let c=window.scrollY||document.documentElement.scrollTop||document.body.scrollTop||0,f=document.documentElement.scrollHeight||document.body.scrollHeight||1,m=window.innerHeight||document.documentElement.clientHeight||1,g=f-m;if(g<=0){a=setTimeout(i,1500);return}c/g*100>=v&&i()};window.addEventListener("scroll",l,{passive:!0}),h.push(()=>window.removeEventListener("scroll",l)),l();break}case"pageview-count":{if(typeof window>"u"||!window.sessionStorage){i();break}let v=e&&typeof e.count=="number"&&e.count>0?e.count:2,l=1;try{let c=window.sessionStorage.getItem("vouchreel_pv_count");l=c?parseInt(c,10)+1:1,window.sessionStorage.setItem("vouchreel_pv_count",l.toString())}catch{}l>=v&&(a=setTimeout(i,800));break}case"returning-visitor":{if(typeof window>"u"||!window.localStorage){i();break}try{window.localStorage.getItem("vouchreel_visited")==="true"?a=setTimeout(i,1e3):window.localStorage.setItem("vouchreel_visited","true")}catch{a=setTimeout(i,2e3)}break}default:{a=setTimeout(i,3e3);break}}return{cancel:s}}function H(){if(typeof crypto<"u"&&typeof crypto.randomUUID=="function")try{return crypto.randomUUID()}catch{}return"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,o=>{let e=Math.random()*16|0;return(o==="x"?e:e&3|8).toString(16)})}function B(){if(typeof window>"u"||!window.sessionStorage)return H();let o="vouchreel_session_id";try{let e=window.sessionStorage.getItem(o);if(e&&e.length>=10)return e;let t=H();return window.sessionStorage.setItem(o,t),t}catch{return H()}}var C=class{spaceId;apiBase;sessionId;conversionGoals;queue=[];flushTimer=null;flushIntervalMs;isDestroyed=!1;experimentId=null;variantIndex=null;constructor(e){this.spaceId=e.spaceId,this.apiBase=e.apiBase?e.apiBase.replace(/\/+$/,""):"",this.sessionId=B(),this.conversionGoals=e.conversionGoals||[],this.flushIntervalMs=e.flushIntervalMs??5e3,this.experimentId=e.experimentId??null,this.variantIndex=e.variantIndex??null,this.bindLifecycleListeners(),this.checkConversionGoals()}setExperiment(e,t){this.experimentId=e,this.variantIndex=t}track(e,t,r){if(this.isDestroyed||!this.spaceId)return;let n=typeof window<"u"&&window.location?window.location.href.split("#")[0]:"",i=typeof window<"u"&&(window.matchMedia?.("(max-width: 768px)").matches||/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(typeof navigator<"u"?navigator.userAgent:""))?"mobile":"desktop",a="direct";if(typeof document<"u"&&document.referrer)try{a=new URL(document.referrer).hostname||"direct"}catch{a="direct"}let d={deviceType:i,referrer:a,...this.experimentId?{experimentId:this.experimentId}:{},...this.variantIndex!==null&&this.variantIndex!==void 0?{variantIndex:this.variantIndex}:{},...r},p={spaceId:this.spaceId,testimonialId:t||null,sessionId:this.sessionId,eventType:e,pageUrl:n,timestamp:new Date().toISOString(),metadata:d};if(this.queue.push(p),e==="impression"||e==="play")try{window.sessionStorage.setItem("vouchreel_engaged","true")}catch{}this.scheduleFlush()}checkConversionGoals(){if(typeof window>"u"||!window.location||!this.conversionGoals||this.conversionGoals.length===0)return;let e=window.location.pathname;for(let t of this.conversionGoals)if(t.goalType==="url-match"&&t.goalValue&&x(t.goalValue,e)){let r=`vouchreel_converted_${t.id}`;try{if(window.sessionStorage.getItem(r)==="true")continue;window.sessionStorage.setItem(r,"true")}catch{}this.track("convert",null,{goalId:t.id,goalValue:t.goalValue})}}flush(){if(this.queue.length===0)return;this.flushTimer!==null&&(clearTimeout(this.flushTimer),this.flushTimer=null);let e=[...this.queue];this.queue=[];let t=`${this.apiBase}/api/events`,r=JSON.stringify({events:e});if(typeof navigator<"u"&&typeof navigator.sendBeacon=="function")try{let n=new Blob([r],{type:"application/json"});if(navigator.sendBeacon(t,n))return}catch{}if(typeof fetch=="function")try{fetch(t,{method:"POST",headers:{"Content-Type":"application/json"},body:r,keepalive:!0}).catch(()=>{})}catch{}}scheduleFlush(){this.flushTimer===null&&(this.flushTimer=setTimeout(()=>{this.flushTimer=null,this.flush()},this.flushIntervalMs))}bindLifecycleListeners(){if(typeof document>"u"||typeof window>"u")return;let e=()=>{document.visibilityState==="hidden"&&this.flush()},t=()=>{this.flush()};document.addEventListener("visibilitychange",e),window.addEventListener("pagehide",t),window.addEventListener("beforeunload",t)}destroy(){this.isDestroyed=!0,this.flush()}};var O=`:host {
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

/* Multi-language Captions & Subtitles */
.vr-player-subtitles {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  max-width: 85%;
  background: rgba(0, 0, 0, 0.78);
  color: #ffffff;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.35;
  text-align: center;
  pointer-events: none;
  z-index: 10;
  backdrop-filter: blur(4px);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  transition: opacity 0.15s ease;
}

.vr-lang-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background-color: var(--vr-primary);
  color: var(--vr-accent);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-right: 6px;
}


`;function q(o){if(!o)return null;let e=o.trim(),t=e.match(/[?&]v=([^&#]+)/);if(t)return t[1];let r=e.match(/youtu\.be\/([^?&#]+)/);if(r)return r[1];let n=e.match(/youtube(?:-nocookie)?\.com\/embed\/([^?&#]+)/);if(n)return n[1];let i=e.match(/youtube\.com\/shorts\/([^?&#]+)/);return i?i[1]:null}function te(o){if(!o)return null;let t=o.trim().match(/vimeo(?:\.com|\.com\/video)?\/(\d+)/);return t?t[1]:null}function F(o){if(!o)return"mp4";let e=o.toLowerCase();return e.includes("youtube.com")||e.includes("youtu.be")?"youtube":e.includes("vimeo.com")?"vimeo":"mp4"}function re(o,e,t){if(t&&t.trim().length>0)return t.trim();if((e||F(o))==="youtube"){let n=q(o);if(n)return`https://img.youtube.com/vi/${n}/hqdefault.jpg`}return""}function P(o){let{container:e,videoUrl:t,thumbnailUrl:r,autoplayPreview:n=!1,onPlay:i,onEnded:a}=o,d=o.platform||F(t),p=re(t,d,r),h=!1,s=null,v=o.subtitles||[],l=null,c=null,f=0;e.innerHTML="",e.className="vr-player-container";let m=document.createElement("div");if(m.className="vr-player-thumb-wrap",p){let b=document.createElement("img");b.src=p,b.alt="Video thumbnail",b.className="vr-player-thumb-img",b.loading="lazy",m.appendChild(b)}else{let b=document.createElement("div");b.className="vr-player-placeholder",m.appendChild(b)}let g=document.createElement("button");g.type="button",g.className="vr-player-play-btn",g.setAttribute("aria-label","Play testimonial video"),g.innerHTML=`
    <svg class="vr-player-play-icon" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z"/>
    </svg>
  `,m.appendChild(g);let u=null;n&&d==="mp4"&&(u=document.createElement("video"),u.src=t,u.muted=!0,u.autoplay=!0,u.loop=!0,u.playsInline=!0,u.className="vr-player-preview-video",m.appendChild(u)),e.appendChild(m);let E=()=>{if(!h){if(h=!0,u&&(u.pause(),u.remove(),u=null),m.style.display="none",d==="youtube"){let b=q(t),y=document.createElement("iframe");y.src=`https://www.youtube-nocookie.com/embed/${b||""}?autoplay=1&rel=0&playsinline=1&enablejsapi=1`,y.title="YouTube testimonial video",y.className="vr-player-iframe",y.setAttribute("frameborder","0"),y.setAttribute("allow","accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"),y.setAttribute("allowfullscreen","true"),e.appendChild(y),s=y}else if(d==="vimeo"){let b=te(t),y=document.createElement("iframe");y.src=`https://player.vimeo.com/video/${b||""}?autoplay=1&badge=0&autopause=0&player_id=0&app_id=58479`,y.title="Vimeo testimonial video",y.className="vr-player-iframe",y.setAttribute("frameborder","0"),y.setAttribute("allow","autoplay; fullscreen; picture-in-picture"),y.setAttribute("allowfullscreen","true"),e.appendChild(y),s=y}else{let b=document.createElement("video");b.src=t,b.controls=!0,b.autoplay=!0,b.playsInline=!0,b.className="vr-player-video",p&&(b.poster=p),b.addEventListener("ended",()=>{a&&a()}),e.appendChild(b),s=b,b.play().catch(()=>{})}v.length>0&&(l=document.createElement("div"),l.className="vr-player-subtitles",l.setAttribute("aria-live","polite"),l.style.display="none",e.appendChild(l),typeof HTMLVideoElement<"u"&&s instanceof HTMLVideoElement||s&&s.tagName==="VIDEO"?s.addEventListener("timeupdate",()=>{let y=s.currentTime||0,w=v.find(T=>y>=T.start&&y<=T.end);w&&w.text?(l.textContent=w.text,l.style.display="block"):l.style.display="none"}):(f=Date.now(),c=setInterval(()=>{let y=(Date.now()-f)/1e3,w=v.find(T=>y>=T.start&&y<=T.end);w&&w.text?(l.textContent=w.text,l.style.display="block"):l.style.display="none"},250))),i&&i()}};return g.addEventListener("click",b=>{b.stopPropagation(),E()}),m.addEventListener("click",()=>{E()}),{play:E,pause:()=>{(typeof HTMLVideoElement<"u"&&s instanceof HTMLVideoElement||s&&s.tagName==="VIDEO")&&s.pause()},destroy:()=>{c&&(clearInterval(c),c=null),l&&(l.remove(),l=null),u&&(u.pause(),u.src="",u.remove(),u=null),s&&((typeof HTMLVideoElement<"u"&&s instanceof HTMLVideoElement||s&&s.tagName==="VIDEO")&&(s.pause(),s.src=""),s.remove(),s=null),e.innerHTML=""}}}var k=class{embedKey;config;testimonials;reviews;analytics;whiteLabel;hostElement=null;shadowRoot=null;rootWrapper=null;activePlayer=null;currentIndex=0;isExpanded=!1;isMounted=!1;keydownListener=null;liveRegion=null;previouslyFocusedEl=null;restoreFocusOnRender=!1;constructor(e){this.embedKey=e.embedKey,this.config=e.config||{},this.testimonials=e.testimonials||[],this.reviews=e.reviews||[],this.analytics=e.analytics,this.whiteLabel=e.whiteLabel||e.config?.whiteLabel}getVisitorLocale(){return U()}getEffectiveQuote(e){let t=this.getVisitorLocale(),r=V(e,t);return r?.quote?{text:r.quote,isTranslated:!0,lang:r.language}:{text:e.quote||e.title||null,isTranslated:!1}}getEffectiveCues(e){let t=this.getVisitorLocale(),r=V(e,t);return r?.transcript&&Array.isArray(r.transcript)&&r.transcript.length>0?r.transcript:null}mount(){if(this.isMounted||typeof document>"u"||this.testimonials.length===0&&this.reviews.length===0)return;let e=document.querySelector("[data-vouchreel-embed]")||document.getElementById("vouchreel-embed");this.hostElement=document.createElement("div"),this.hostElement.id=`vouchreel-widget-${this.embedKey}`,this.hostElement.className="vouchreel-host-container",this.hostElement.setAttribute("role","region"),this.hostElement.setAttribute("aria-label","Customer testimonials and reviews"),this.shadowRoot=this.hostElement.attachShadow({mode:"open"});let t=document.createElement("style");t.textContent=O,this.shadowRoot.appendChild(t);let r=this.config.template||"floating-card",n=!!e||r==="wall-of-love"||r==="masonry"||r==="carousel";if(this.rootWrapper=document.createElement("div"),this.rootWrapper.className=`vr-theme-root vr-template-${r}`,n?(this.rootWrapper.style.width="100%",this.rootWrapper.style.position="relative"):this.rootWrapper.classList.add(`vr-pos-${this.config.position||"bottom-right"}`,"vr-animate-enter"),this.config.theme?.mode==="dark"&&this.rootWrapper.classList.add("vr-dark"),this.config.theme?.primaryColor&&this.rootWrapper.style.setProperty("--vr-primary",this.config.theme.primaryColor),this.config.theme?.accentColor&&this.rootWrapper.style.setProperty("--vr-accent",this.config.theme.accentColor),typeof this.config.theme?.borderRadius=="number"&&this.rootWrapper.style.setProperty("--vr-radius",`${this.config.theme.borderRadius}px`),this.shadowRoot.appendChild(this.rootWrapper),this.rootWrapper.addEventListener("animationend",i=>{i.target===this.rootWrapper&&this.rootWrapper&&this.rootWrapper.classList.remove("vr-animate-enter")}),this.liveRegion=document.createElement("div"),this.liveRegion.className="vr-sr-only",this.liveRegion.setAttribute("role","status"),this.shadowRoot.appendChild(this.liveRegion),e?e.appendChild(this.hostElement):document.body.appendChild(this.hostElement),this.isMounted=!0,this.analytics){let i=this.testimonials[0];this.analytics.track("impression",i?.id)}this.renderTemplate(),this.announce("Testimonials and reviews widget is now available."),this.keydownListener=i=>{i.key==="Escape"?this.isExpanded?this.collapse():n||this.dismiss():i.key==="Tab"&&this.isExpanded&&this.trapFocus(i)},document.addEventListener("keydown",this.keydownListener)}announce(e){this.liveRegion&&(this.liveRegion.textContent="",setTimeout(()=>{this.liveRegion&&(this.liveRegion.textContent=e)},100))}trapFocus(e){if(!this.shadowRoot)return;let t=Array.from(this.shadowRoot.querySelectorAll('button, a[href], iframe, video[controls], [tabindex]:not([tabindex="-1"])')).filter(a=>!a.hasAttribute("disabled")&&a.getClientRects().length>0);if(t.length===0)return;let r=t[0],n=t[t.length-1],i=this.shadowRoot.activeElement;i?e.shiftKey&&i===r?(e.preventDefault(),n.focus()):!e.shiftKey&&i===n&&(e.preventDefault(),r.focus()):(e.preventDefault(),r.focus())}renderTemplate(){switch(this.config.template||"floating-card"){case"wall-of-love":this.renderWallOfLove();break;case"carousel":this.renderCarousel();break;case"masonry":this.renderMasonry();break;case"story-strip":this.renderStoryStrip();break;default:this.renderCollapsed();break}}createVideoCard(e,t){let r=document.createElement("button");r.type="button",r.className="vr-card vr-blend-video-card",r.setAttribute("aria-label",`Play video testimonial from ${e.customerName||"customer"}`);let n=document.createElement("div");if(n.className="vr-card-video-thumb",e.thumbnailUrl){let l=document.createElement("img");l.src=e.thumbnailUrl,l.alt=e.customerName||"Video testimonial thumbnail",n.appendChild(l)}let i=document.createElement("div");if(i.className="vr-play-badge",i.setAttribute("aria-hidden","true"),i.innerHTML='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',n.appendChild(i),e.durationSeconds){let l=document.createElement("span");l.className="vr-card-duration";let c=Math.floor(e.durationSeconds/60),f=String(e.durationSeconds%60).padStart(2,"0");l.textContent=`${c}:${f}`,n.appendChild(l)}r.appendChild(n);let a=document.createElement("div");a.innerHTML='<span class="vr-provider-badge vr-badge-video">\u{1F4F9} Video Testimonial</span>',r.appendChild(a);let d=this.getEffectiveQuote(e);if(d.text){let l=document.createElement("p");l.className="vr-card-quote-text",l.textContent=`"${d.text}"`,d.isTranslated&&l.setAttribute("data-translated-lang",d.lang||""),r.appendChild(l)}let p=document.createElement("div");p.className="vr-card-author-row";let h=(e.customerName||"C").charAt(0).toUpperCase(),s=document.createElement("div");s.className="vr-card-avatar",s.textContent=h,p.appendChild(s);let v=document.createElement("div");return v.innerHTML=`
      <div class="vr-card-author-name">${e.customerName||"Customer"}</div>
      ${e.customerCompany?`<div class="vr-card-author-sub">${e.customerCompany}</div>`:""}
    `,p.appendChild(v),r.appendChild(p),r.addEventListener("click",()=>{this.analytics&&this.analytics.track("click",e.id),this.expandVideo(t)}),r}createReviewCard(e){let t=document.createElement("button");t.type="button",t.className="vr-card vr-blend-review-card",t.setAttribute("aria-label",`View review from ${e.authorName} on ${e.provider}`);let r=document.createElement("div");r.style.display="flex",r.style.alignItems="center",r.style.justifyContent="space-between",r.style.gap="8px";let n=document.createElement("span");n.className=`vr-provider-badge ${e.provider==="google"?"vr-badge-google":"vr-badge-trustpilot"}`,n.textContent=e.provider==="google"?"Google":"Trustpilot",r.appendChild(n);let i=document.createElement("div");if(i.className="vr-stars",i.innerHTML=Array.from({length:5}).map((h,s)=>s<e.rating?"\u2605":"\u2606").join(""),r.appendChild(i),t.appendChild(r),e.text){let h=document.createElement("p");h.className="vr-card-quote-text",h.textContent=`"${e.text}"`,t.appendChild(h)}let a=document.createElement("div");if(a.className="vr-card-author-row",e.authorPhotoUrl){let h=document.createElement("img");h.src=e.authorPhotoUrl,h.alt=e.authorName,h.className="vr-card-avatar",a.appendChild(h)}else{let h=(e.authorName||"A").charAt(0).toUpperCase(),s=document.createElement("div");s.className="vr-card-avatar",s.textContent=h,a.appendChild(s)}let d=document.createElement("div"),p=e.reviewDate?new Date(e.reviewDate).toLocaleDateString():"";return d.innerHTML=`
      <div class="vr-card-author-name">${e.authorName}</div>
      ${p?`<div class="vr-card-author-sub">${p}</div>`:""}
    `,a.appendChild(d),t.appendChild(a),t.addEventListener("click",()=>{this.expandReview(e)}),t}renderWallOfLove(){if(!this.rootWrapper)return;this.rootWrapper.innerHTML="",this.isExpanded=!1;let e=document.createElement("div");e.className="vr-wall-wrapper";let t=document.createElement("div");t.className="vr-wall-grid";let r=Math.max(this.testimonials.length,this.reviews.length);for(let n=0;n<r;n++)n<this.testimonials.length&&t.appendChild(this.createVideoCard(this.testimonials[n],n)),n<this.reviews.length&&t.appendChild(this.createReviewCard(this.reviews[n]));e.appendChild(t),this.rootWrapper.appendChild(e),this.maybeRestoreFocus()}renderCarousel(){if(!this.rootWrapper)return;this.rootWrapper.innerHTML="",this.isExpanded=!1;let e=document.createElement("div");e.className="vr-carousel-container";let t=document.createElement("button");t.type="button",t.className="vr-carousel-arrow vr-carousel-prev",t.setAttribute("aria-label","Previous items"),t.innerHTML=`
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="15 18 9 12 15 6"></polyline>
      </svg>
    `;let r=document.createElement("button");r.type="button",r.className="vr-carousel-arrow vr-carousel-next",r.setAttribute("aria-label","Next items"),r.innerHTML=`
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    `;let n=document.createElement("div");n.className="vr-carousel-track";let i=Math.max(this.testimonials.length,this.reviews.length);for(let a=0;a<i;a++)a<this.testimonials.length&&n.appendChild(this.createVideoCard(this.testimonials[a],a)),a<this.reviews.length&&n.appendChild(this.createReviewCard(this.reviews[a]));t.addEventListener("click",()=>{n.scrollBy({left:-310,behavior:"smooth"})}),r.addEventListener("click",()=>{n.scrollBy({left:310,behavior:"smooth"})}),e.appendChild(t),e.appendChild(n),e.appendChild(r),this.rootWrapper.appendChild(e),this.maybeRestoreFocus()}renderStoryStrip(){if(!this.rootWrapper)return;this.rootWrapper.innerHTML="",this.isExpanded=!1;let e=document.createElement("div");e.className="vr-strip-wrapper",this.testimonials.slice(0,4).forEach((t,r)=>{let n=document.createElement("button");if(n.type="button",n.className="vr-story-item",n.setAttribute("aria-label",`Play video testimonial from ${t.customerName||"Customer"}`),n.setAttribute("title",t.customerName||"Video testimonial"),t.thumbnailUrl){let i=document.createElement("img");i.src=t.thumbnailUrl,i.alt=t.customerName||"Testimonial",n.appendChild(i)}else{let i=(t.customerName||"V").charAt(0).toUpperCase();n.textContent=i}n.addEventListener("click",()=>{this.analytics&&this.analytics.track("click",t.id),this.expandVideo(r)}),e.appendChild(n)}),this.reviews.slice(0,3).forEach(t=>{let r=document.createElement("button");if(r.type="button",r.className=`vr-story-item ${t.provider==="google"?"vr-story-review-google":"vr-story-review-trustpilot"}`,r.setAttribute("aria-label",`View review from ${t.authorName} on ${t.provider}`),r.setAttribute("title",`${t.authorName} (${t.provider})`),t.authorPhotoUrl){let i=document.createElement("img");i.src=t.authorPhotoUrl,i.alt=t.authorName,r.appendChild(i)}else{let i=(t.authorName||"R").charAt(0).toUpperCase();r.textContent=i}let n=document.createElement("span");n.className="vr-story-badge",n.textContent="\u2605",r.appendChild(n),r.addEventListener("click",()=>{this.expandReview(t)}),e.appendChild(r)}),this.rootWrapper.appendChild(e),this.maybeRestoreFocus()}renderCollapsed(){if(!this.rootWrapper)return;this.rootWrapper.innerHTML="",this.isExpanded=!1,this.activePlayer&&(this.activePlayer.destroy(),this.activePlayer=null);let e=this.testimonials[this.currentIndex]||this.testimonials[0];if(!e&&this.reviews.length>0){let s=this.reviews[0],v=document.createElement("div");v.className="vr-collapsed-card";let l=document.createElement("button");l.type="button",l.className="vr-open-btn",l.setAttribute("aria-label",`View review from ${s.authorName} on ${s.provider}`);let c=document.createElement("div");if(c.className="vr-thumb-wrapper",s.authorPhotoUrl){let g=document.createElement("img");g.src=s.authorPhotoUrl,g.alt=s.authorName,c.appendChild(g)}else c.style.display="flex",c.style.alignItems="center",c.style.justifyContent="center",c.style.backgroundColor="var(--vr-primary)",c.style.color="var(--vr-accent)",c.style.fontWeight="bold",c.textContent=(s.authorName||"R").charAt(0).toUpperCase();l.appendChild(c);let f=document.createElement("div");f.className="vr-card-info",f.innerHTML=`
        <div class="vr-card-name">${s.authorName}</div>
        <div class="vr-card-quote">\u2605 ${s.rating}.0 on ${s.provider}</div>
      `,l.appendChild(f),l.addEventListener("click",()=>this.expandReview(s)),v.appendChild(l);let m=document.createElement("button");m.type="button",m.className="vr-close-btn",m.setAttribute("aria-label","Dismiss widget"),m.innerHTML=`
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      `,m.addEventListener("click",g=>{g.stopPropagation(),this.dismiss()}),v.appendChild(m),this.rootWrapper.appendChild(v),this.maybeRestoreFocus();return}if(!e)return;let t=document.createElement("div");t.className="vr-collapsed-card";let r=document.createElement("button");r.type="button",r.className="vr-open-btn",r.setAttribute("aria-label",`Play video testimonial${e.customerName?` from ${e.customerName}`:""}`);let n=document.createElement("div");if(n.className="vr-thumb-wrapper",e.thumbnailUrl){let s=document.createElement("img");s.src=e.thumbnailUrl,s.alt=e.customerName||"Testimonial",n.appendChild(s)}let i=document.createElement("div");i.className="vr-play-badge",i.setAttribute("aria-hidden","true"),i.innerHTML=`
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5v14l11-7z"/>
      </svg>
    `,n.appendChild(i),r.appendChild(n);let a=document.createElement("div");a.className="vr-card-info";let d=document.createElement("div");d.className="vr-card-name",d.textContent=e.customerName||e.title||"Video Testimonial",a.appendChild(d);let p=this.getEffectiveQuote(e);if(p.text){let s=document.createElement("div");s.className="vr-card-quote",s.textContent=`"${p.text}"`,p.isTranslated&&s.setAttribute("data-translated-lang",p.lang||""),a.appendChild(s)}r.appendChild(a),r.addEventListener("click",()=>{this.analytics&&this.analytics.track("click",e.id),this.expandVideo(this.currentIndex)}),t.appendChild(r);let h=document.createElement("button");h.type="button",h.className="vr-close-btn",h.setAttribute("aria-label","Dismiss testimonial widget"),h.innerHTML=`
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `,h.addEventListener("click",s=>{s.stopPropagation(),this.dismiss()}),t.appendChild(h),this.rootWrapper.appendChild(t),this.maybeRestoreFocus()}renderMasonry(){if(!this.rootWrapper)return;this.rootWrapper.innerHTML="",this.isExpanded=!1;let e=document.createElement("div");e.className="vr-masonry-wrapper";let t=Math.max(this.testimonials.length,this.reviews.length);for(let r=0;r<t;r++)r<this.testimonials.length&&e.appendChild(this.createVideoCard(this.testimonials[r],r)),r<this.reviews.length&&e.appendChild(this.createReviewCard(this.reviews[r]));this.rootWrapper.appendChild(e),this.maybeRestoreFocus()}expandVideo(e=0){if(!this.rootWrapper)return;!this.isExpanded&&this.shadowRoot&&(this.previouslyFocusedEl=this.shadowRoot.activeElement),this.isExpanded=!0,this.currentIndex=e;let t=this.testimonials[this.currentIndex];if(!t)return;this.rootWrapper.innerHTML="";let r=document.createElement("div");r.className="vr-backdrop",r.setAttribute("aria-hidden","true"),r.addEventListener("click",()=>this.collapse()),this.rootWrapper.appendChild(r);let n=document.createElement("div");n.className=`vr-expanded-modal vr-pos-${this.config.position||"bottom-right"}`,n.setAttribute("role","dialog"),n.setAttribute("aria-modal","true"),n.setAttribute("aria-label",t.customerName?`Video testimonial from ${t.customerName}`:"Video testimonial player"),n.tabIndex=-1;let i=document.createElement("div");i.className="vr-sheet-grabber",i.setAttribute("aria-hidden","true"),n.appendChild(i);let a=document.createElement("button");a.type="button",a.className="vr-modal-close-btn",a.setAttribute("aria-label","Close player"),a.innerHTML=`
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `,a.addEventListener("click",()=>this.collapse()),n.appendChild(a);let d=document.createElement("div");d.className="vr-player-container",n.appendChild(d);let p=this.getEffectiveCues(t),h=this.getVisitorLocale();this.activePlayer=P({container:d,videoUrl:t.videoUrl,platform:t.platform,thumbnailUrl:t.thumbnailUrl,autoplayPreview:this.config.autoplayPreview,subtitles:p,subtitleLanguage:h,onPlay:()=>{this.analytics&&this.analytics.track("play",t.id)},onEnded:()=>{this.next()}});let s=document.createElement("div");s.className="vr-modal-body";let v=this.getEffectiveQuote(t);if(v.text){let m=document.createElement("p");if(m.className="vr-modal-quote",v.isTranslated){let u=document.createElement("span");u.className="vr-lang-badge",u.textContent=(v.lang||h).toUpperCase(),m.appendChild(u)}let g=document.createTextNode(`"${v.text}"`);m.appendChild(g),s.appendChild(m)}let l=document.createElement("div");l.className="vr-modal-meta";let c=document.createElement("div"),f=document.createElement("div");if(f.className="vr-modal-author",f.textContent=t.customerName||t.title||"",c.appendChild(f),t.customerCompany){let m=document.createElement("div");m.className="vr-modal-company",m.textContent=t.customerCompany,c.appendChild(m)}if(l.appendChild(c),this.testimonials.length>1){let m=document.createElement("div");m.className="vr-carousel-controls";let g=document.createElement("button");g.type="button",g.className="vr-nav-btn",g.setAttribute("aria-label","Previous testimonial"),g.innerHTML=`
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      `,g.addEventListener("click",()=>this.prev());let u=document.createElement("button");u.type="button",u.className="vr-nav-btn",u.setAttribute("aria-label","Next testimonial"),u.innerHTML=`
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      `,u.addEventListener("click",()=>this.next()),m.appendChild(g),m.appendChild(u),l.appendChild(m)}if(s.appendChild(l),n.appendChild(s),!this.whiteLabel?.removeBranding){let m=document.createElement("div");if(m.className="vr-powered-by",this.whiteLabel?.logoUrl){let u=document.createElement("img");u.src=this.whiteLabel.logoUrl,u.alt="Brand Logo",u.className="vr-powered-by-logo",u.style.maxHeight="14px",u.style.marginRight="6px",u.style.verticalAlign="middle",m.appendChild(u)}let g=document.createTextNode(this.whiteLabel?.logoUrl?"Powered by our community":"Verified by Vouchreel");m.appendChild(g),n.appendChild(m)}this.rootWrapper.appendChild(n),n.focus()}expandReview(e){if(!this.rootWrapper)return;!this.isExpanded&&this.shadowRoot&&(this.previouslyFocusedEl=this.shadowRoot.activeElement),this.isExpanded=!0,this.rootWrapper.innerHTML="";let t=document.createElement("div");t.className="vr-backdrop",t.setAttribute("aria-hidden","true"),t.addEventListener("click",()=>this.collapse()),this.rootWrapper.appendChild(t);let r=document.createElement("div");r.className=`vr-expanded-modal vr-pos-${this.config.position||"bottom-right"}`,r.setAttribute("role","dialog"),r.setAttribute("aria-modal","true"),r.setAttribute("aria-label",`Review from ${e.authorName}`),r.tabIndex=-1;let n=document.createElement("button");n.type="button",n.className="vr-modal-close-btn",n.setAttribute("aria-label","Close review"),n.innerHTML=`
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `,n.addEventListener("click",()=>this.collapse()),r.appendChild(n);let i=document.createElement("div");i.className="vr-review-modal-body";let a=document.createElement("div");a.className="vr-review-modal-header";let d=document.createElement("div");if(d.style.display="flex",d.style.alignItems="center",d.style.gap="10px",e.authorPhotoUrl){let c=document.createElement("img");c.src=e.authorPhotoUrl,c.alt=e.authorName,c.className="vr-card-avatar",d.appendChild(c)}else{let c=(e.authorName||"A").charAt(0).toUpperCase(),f=document.createElement("div");f.className="vr-card-avatar",f.textContent=c,d.appendChild(f)}let p=document.createElement("div"),h=e.reviewDate?new Date(e.reviewDate).toLocaleDateString():"";p.innerHTML=`
      <div style="font-weight: 600; font-size: 13px;">${e.authorName}</div>
      ${h?`<div style="font-size: 11px; color: var(--vr-text-muted);">${h}</div>`:""}
    `,d.appendChild(p),a.appendChild(d);let s=document.createElement("span");s.className=`vr-provider-badge ${e.provider==="google"?"vr-badge-google":"vr-badge-trustpilot"}`,s.textContent=e.provider==="google"?"Google Reviews":"Trustpilot Verified",a.appendChild(s),i.appendChild(a);let v=document.createElement("div");if(v.className="vr-stars",v.style.fontSize="18px",v.innerHTML=Array.from({length:5}).map((c,f)=>f<e.rating?"\u2605":"\u2606").join(""),i.appendChild(v),e.text){let c=document.createElement("div");c.className="vr-review-modal-text",c.textContent=e.text,i.appendChild(c)}r.appendChild(i);let l=document.createElement("div");l.className="vr-powered-by",l.textContent="Verified customer review",r.appendChild(l),this.rootWrapper.appendChild(r),r.focus()}expand(e=0){this.expandVideo(e)}next(){this.testimonials.length<=1||(this.currentIndex=(this.currentIndex+1)%this.testimonials.length,this.expandVideo(this.currentIndex))}prev(){this.testimonials.length<=1||(this.currentIndex=(this.currentIndex-1+this.testimonials.length)%this.testimonials.length,this.expandVideo(this.currentIndex))}collapse(){this.isExpanded&&(this.restoreFocusOnRender=!0,this.renderTemplate())}maybeRestoreFocus(){if(!this.restoreFocusOnRender||!this.rootWrapper)return;this.restoreFocusOnRender=!1;let e=this.rootWrapper.querySelector(".vr-open-btn, .vr-story-item, .vr-card");e?e.focus():this.previouslyFocusedEl&&this.previouslyFocusedEl.focus(),this.previouslyFocusedEl=null}dismiss(){j(this.embedKey),this.activePlayer&&(this.activePlayer.destroy(),this.activePlayer=null),this.keydownListener&&(document.removeEventListener("keydown",this.keydownListener),this.keydownListener=null),this.rootWrapper&&(this.rootWrapper.classList.remove("vr-animate-enter"),this.rootWrapper.classList.add("vr-animate-leave"),setTimeout(()=>{this.hostElement&&this.hostElement.parentNode&&this.hostElement.parentNode.removeChild(this.hostElement),this.isMounted=!1},250))}};function ne(){return typeof document>"u"?null:document.currentScript instanceof HTMLScriptElement?document.currentScript:document.querySelector("script[data-key]")||document.querySelector("script[src*='vouchreel']")||document.querySelector("script[src*='widget']")||null}function ie(o){if(!o)return null;let e=o.getAttribute("data-key");if(e&&e.trim().length>0)return e.trim();let t=o.getAttribute("src")||o.src;if(t)try{let r=new URL(t,window.location.href),i=r.pathname.match(/\/widget\/([^/.]+)(?:\.js)?$/);if(i&&i[1]&&i[1]!=="vouchreel-widget")return i[1];let a=r.searchParams.get("key")||r.searchParams.get("embedKey")||r.searchParams.get("k");if(a)return a.trim()}catch{}return null}function oe(o){if(o){let e=o.getAttribute("data-api");if(e&&e.trim().length>0)return e.trim().replace(/\/+$/,"");let t=o.getAttribute("src")||o.src;if(t)try{let r=new URL(t,window.location.href);if(r.origin&&r.origin!=="null")return r.origin}catch{}}return typeof window<"u"&&window.location?window.location.origin:""}function ae(o,e){let t=`${o}:${e}`,r=2166136261;for(let n=0;n<t.length;n++)r^=t.charCodeAt(n),r=Math.imul(r,16777619);return r>>>0}function se(o,e,t,r){if(!t||t.length===0||r<=0)return 0;let i=ae(o,e)%100,a=0;for(let d=0;d<t.length;d++)if(a+=t[d],i<a)return d<r?d:0;return Math.min(t.length-1,r-1)}function le(o,e){let t=`vr_exp_${e.id}`;if(typeof window<"u"&&window.sessionStorage)try{let n=window.sessionStorage.getItem(t);if(n!=null){let i=parseInt(n,10);if(!isNaN(i)&&i>=0&&i<e.variants.length)return i}}catch{}let r=se(o,e.id,e.trafficSplit,e.variants.length);if(typeof window<"u"&&window.sessionStorage)try{window.sessionStorage.setItem(t,String(r))}catch{}return r}function de(o,e,t){let r=e.variants[t];if(!r||!r.config)return;let n=r.config;if(e.type==="trigger")n.trigger&&typeof n.trigger=="object"?o.trigger=n.trigger:n.type||n.triggerType?o.trigger={type:n.type||n.triggerType,value:n.value||n.triggerValue||{}}:o.trigger=n;else if(e.type==="position"){let i=n.position??n.value??(typeof n=="string"?n:null);i&&(o.position=i)}else if(e.type==="template"){let i=n.template??n.value??(typeof n=="string"?n:null);i&&(o.template=i)}else Object.assign(o,n)}async function S(){try{let o=ne(),e=ie(o);if(!e||M(e))return;let t=oe(o),r=`${t}/api/widget/${encodeURIComponent(e)}`,n=await fetch(r,{method:"GET",headers:{Accept:"application/json"}});if(!n.ok)return;let i=await n.json();if(!i||!i.config||!Array.isArray(i.testimonials))return;let a=null,d=null;if(i.activeExperiment&&Array.isArray(i.activeExperiment.variants)&&i.activeExperiment.variants.length>0){let u=B();a=i.activeExperiment.id,d=le(u,i.activeExperiment),de(i.config,i.activeExperiment,d)}let p=typeof window<"u"&&window.location?window.location.pathname:"/";if(!N(i.config,p))return;let h=typeof window<"u"?window.location:{pathname:"/"},s=A(i.testimonials||[],h),v=Array.isArray(i.reviews)?i.reviews:[],l=D(v,h);if(s.length===0&&l.length===0)return;let c=new C({spaceId:i.spaceId,apiBase:t,conversionGoals:i.conversionGoals,experimentId:a,variantIndex:d});typeof window<"u"&&(window.vouchreelConvert=u=>{c.track("convert",null,{goalId:u,source:"pixel"})});let f=new k({embedKey:e,config:i.config,testimonials:s,reviews:l,analytics:c,whiteLabel:i.whiteLabel}),m=i.config.trigger?.type||"delay",g=i.config.trigger?.value||null;R({type:m,value:g,embedKey:e,onTrigger:()=>{f.mount()}})}catch{}}function $(){typeof document>"u"||(document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{S()}):setTimeout(()=>{S()},10))}$();return J(ce);})();
