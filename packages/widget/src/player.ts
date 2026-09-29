export interface VideoPlayerOptions {
  container: HTMLElement;
  videoUrl: string;
  platform?: "youtube" | "vimeo" | "mp4" | string;
  thumbnailUrl?: string | null;
  autoplayPreview?: boolean;
  onPlay?: () => void;
  onEnded?: () => void;
}

export interface VideoPlayerController {
  play: () => void;
  pause: () => void;
  destroy: () => void;
}

/**
 * Extracts YouTube video ID from various YouTube URL formats.
 */
export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();

  // youtube.com/watch?v=ID
  const watchMatch = trimmed.match(/[?&]v=([^&#]+)/);
  if (watchMatch) return watchMatch[1];

  // youtu.be/ID
  const shortMatch = trimmed.match(/youtu\.be\/([^?&#]+)/);
  if (shortMatch) return shortMatch[1];

  // youtube.com/embed/ID or youtube-nocookie.com/embed/ID
  const embedMatch = trimmed.match(/youtube(?:-nocookie)?\.com\/embed\/([^?&#]+)/);
  if (embedMatch) return embedMatch[1];

  // youtube.com/shorts/ID
  const shortsMatch = trimmed.match(/youtube\.com\/shorts\/([^?&#]+)/);
  if (shortsMatch) return shortsMatch[1];

  return null;
}

/**
 * Extracts Vimeo video ID from Vimeo URL formats.
 */
export function extractVimeoId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();

  // vimeo.com/123456789 or player.vimeo.com/video/123456789
  const match = trimmed.match(/vimeo(?:\.com|\.com\/video)?\/(\d+)/);
  if (match) return match[1];

  return null;
}

/**
 * Detects the platform type from the URL if not explicitly provided.
 */
export function detectPlatform(url: string): "youtube" | "vimeo" | "mp4" {
  if (!url) return "mp4";
  const lower = url.toLowerCase();
  if (lower.includes("youtube.com") || lower.includes("youtu.be")) {
    return "youtube";
  }
  if (lower.includes("vimeo.com")) {
    return "vimeo";
  }
  return "mp4";
}

/**
 * Gets the best thumbnail URL for a video.
 */
export function getThumbnailUrl(
  videoUrl: string,
  platform?: string,
  providedThumbnail?: string | null
): string {
  if (providedThumbnail && providedThumbnail.trim().length > 0) {
    return providedThumbnail.trim();
  }

  const effectivePlatform = platform || detectPlatform(videoUrl);
  if (effectivePlatform === "youtube") {
    const ytId = extractYouTubeId(videoUrl);
    if (ytId) {
      return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    }
  }

  return "";
}

/**
 * Creates and renders the video player into the specified container.
 * Enforces privacy-preserving lazy loading:
 * - Initially renders static thumbnail with play overlay.
 * - Iframes are ONLY loaded into the DOM when play() is triggered.
 * - Uses youtube-nocookie.com for YouTube.
 */
export function createVideoPlayer(options: VideoPlayerOptions): VideoPlayerController {
  const {
    container,
    videoUrl,
    thumbnailUrl,
    autoplayPreview = false,
    onPlay,
    onEnded,
  } = options;

  const platform = options.platform || detectPlatform(videoUrl);
  const effectiveThumbnail = getThumbnailUrl(videoUrl, platform, thumbnailUrl);

  let isPlaying = false;
  let activeElement: HTMLIFrameElement | HTMLVideoElement | null = null;

  // Clear container
  container.innerHTML = "";
  container.className = "vr-player-container";

  // Thumbnail overlay wrapper
  const thumbWrap = document.createElement("div");
  thumbWrap.className = "vr-player-thumb-wrap";

  if (effectiveThumbnail) {
    const img = document.createElement("img");
    img.src = effectiveThumbnail;
    img.alt = "Video thumbnail";
    img.className = "vr-player-thumb-img";
    img.loading = "lazy";
    thumbWrap.appendChild(img);
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "vr-player-placeholder";
    thumbWrap.appendChild(placeholder);
  }

  // Play button overlay
  const playBtn = document.createElement("button");
  playBtn.type = "button";
  playBtn.className = "vr-player-play-btn";
  playBtn.setAttribute("aria-label", "Play testimonial video");
  playBtn.innerHTML = `
    <svg class="vr-player-play-icon" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z"/>
    </svg>
  `;
  thumbWrap.appendChild(playBtn);

  // Autoplay preview for MP4 videos if enabled
  let previewVideo: HTMLVideoElement | null = null;
  if (autoplayPreview && platform === "mp4") {
    previewVideo = document.createElement("video");
    previewVideo.src = videoUrl;
    previewVideo.muted = true;
    previewVideo.autoplay = true;
    previewVideo.loop = true;
    previewVideo.playsInline = true;
    previewVideo.className = "vr-player-preview-video";
    thumbWrap.appendChild(previewVideo);
  }

  container.appendChild(thumbWrap);

  const mountActivePlayer = () => {
    if (isPlaying) return;
    isPlaying = true;

    if (previewVideo) {
      previewVideo.pause();
      previewVideo.remove();
      previewVideo = null;
    }

    thumbWrap.style.display = "none";

    if (platform === "youtube") {
      const ytId = extractYouTubeId(videoUrl);
      const iframe = document.createElement("iframe");
      iframe.src = `https://www.youtube-nocookie.com/embed/${ytId || ""}?autoplay=1&rel=0&playsinline=1&enablejsapi=1`;
      iframe.title = "YouTube testimonial video";
      iframe.className = "vr-player-iframe";
      iframe.setAttribute("frameborder", "0");
      iframe.setAttribute(
        "allow",
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      );
      iframe.setAttribute("allowfullscreen", "true");
      container.appendChild(iframe);
      activeElement = iframe;
    } else if (platform === "vimeo") {
      const vimeoId = extractVimeoId(videoUrl);
      const iframe = document.createElement("iframe");
      iframe.src = `https://player.vimeo.com/video/${vimeoId || ""}?autoplay=1&badge=0&autopause=0&player_id=0&app_id=58479`;
      iframe.title = "Vimeo testimonial video";
      iframe.className = "vr-player-iframe";
      iframe.setAttribute("frameborder", "0");
      iframe.setAttribute("allow", "autoplay; fullscreen; picture-in-picture");
      iframe.setAttribute("allowfullscreen", "true");
      container.appendChild(iframe);
      activeElement = iframe;
    } else {
      // Native MP4 video
      const video = document.createElement("video");
      video.src = videoUrl;
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;
      video.className = "vr-player-video";
      if (effectiveThumbnail) {
        video.poster = effectiveThumbnail;
      }

      video.addEventListener("ended", () => {
        if (onEnded) onEnded();
      });

      container.appendChild(video);
      activeElement = video;
      video.play().catch(() => {
        // Handle browser autoplay restriction
      });
    }

    if (onPlay) {
      onPlay();
    }
  };

  playBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    mountActivePlayer();
  });

  thumbWrap.addEventListener("click", () => {
    mountActivePlayer();
  });

  return {
    play: mountActivePlayer,
    pause: () => {
      if (activeElement instanceof HTMLVideoElement) {
        activeElement.pause();
      }
    },
    destroy: () => {
      if (previewVideo) {
        previewVideo.pause();
        previewVideo.src = "";
        previewVideo.remove();
        previewVideo = null;
      }
      if (activeElement) {
        if (activeElement instanceof HTMLVideoElement) {
          activeElement.pause();
          activeElement.src = "";
        }
        activeElement.remove();
        activeElement = null;
      }
      container.innerHTML = "";
    },
  };
}
