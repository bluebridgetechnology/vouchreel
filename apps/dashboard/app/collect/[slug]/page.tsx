"use client";

import { FormEvent, use, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { inputClass, textareaClass } from "@/components/ui/input";
import { DEFAULT_BRAND_HEX, userAccentStyle } from "@/lib/brand";
import { allowsText, allowsVideo, type CollectMode } from "@/lib/collect/modes";
import { Checkbox } from "@/components/ui/checkbox";
import { AI_VIDEO_CONSENT_TEXT } from "@/lib/ai-video/consent";
import { FormSkeleton, SkeletonRegion } from "@/components/ui/page-skeleton";

const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_DURATION_SECONDS = 5 * 60;
const RECORDER_TYPES = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];

type DirectUpload = { kind: "uploaded"; key: string } | { kind: "unavailable" } | { kind: "error"; message: string };

/** Sends the video straight to storage with a presigned POST. "unavailable" means this deployment uploads through the server instead. */
async function uploadDirect(slugValue: string, file: File, onProgress: (percent: number) => void): Promise<DirectUpload> {
  let prepared: { direct?: boolean; url?: string; fields?: Record<string, string>; key?: string; error?: { message?: string } };
  try {
    const response = await fetch(`/api/collect/${slugValue}/uploads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentType: file.type, size: file.size }),
    });
    prepared = await response.json().catch(() => ({}));
    if (!response.ok) return { kind: "error", message: prepared.error?.message || "Unable to start the upload." };
  } catch {
    return { kind: "error", message: "Network error. Please try again." };
  }
  if (!prepared.direct || !prepared.url || !prepared.fields || !prepared.key) return { kind: "unavailable" };

  const body = new FormData();
  for (const [name, value] of Object.entries(prepared.fields)) body.set(name, value);
  body.set("file", file); // the file goes last: storage ignores fields after it
  return new Promise<DirectUpload>((resolve) => {
    const request = new XMLHttpRequest();
    request.open("POST", prepared.url as string);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () =>
      resolve(request.status >= 200 && request.status < 300 ? { kind: "uploaded", key: prepared.key as string } : { kind: "error", message: "The upload failed. Please try again." });
    request.onerror = () => resolve({ kind: "error", message: "The upload failed. Check your connection and try again." });
    request.send(body);
  });
}

type CollectionForm = {
  title: string;
  promptText: string;
  incentiveType: "none" | "discount" | "custom";
  incentiveValue: string | null;
  collectModes?: CollectMode;
  branding: { accentColor?: string; logoUrl?: string | null; removeBranding?: boolean };
};

export default function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [form, setForm] = useState<CollectionForm | null>(null);
  const [mode, setMode] = useState<"video" | "text">("video");
  const [video, setVideo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [text, setText] = useState("");
  const [aiConsent, setAiConsent] = useState(false);
  const [embedded, setEmbedded] = useState(false);
  const [canRecord, setCanRecord] = useState(true);
  const [blockedInFrame, setBlockedInFrame] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch(`/api/collect/${slug}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("This collection link is unavailable.");
        const data = await response.json();
        setForm(data.collectionForm);
        // A single-option form opens on (and only offers) that option
        if (data.collectionForm.collectModes === "text") setMode("text");
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load form."))
      .finally(() => setLoading(false));
    return () => cleanupRecording();
  }, [slug]);

  useEffect(() => {
    setEmbedded(window.self !== window.top);
    setCanRecord(typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia));
  }, []);

  // Inside an iframe, tell the loader script (public/collect-embed.js) how tall the form is
  useEffect(() => {
    if (!embedded) return;
    const main = document.querySelector("main");
    if (!main) return;
    const report = () => window.parent.postMessage({ type: "vouchreel:collect-resize", height: Math.ceil(main.getBoundingClientRect().height) }, "*");
    const observer = new ResizeObserver(report);
    observer.observe(main);
    report();
    return () => observer.disconnect();
  }, [embedded, loading, complete, mode, previewUrl]);

  function cleanupRecording() {
    if (timer.current) clearInterval(timer.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }

  function setPreview(file: File) {
    if (file.size > MAX_VIDEO_BYTES) {
      setError("Please select a video smaller than 100 MB.");
      return;
    }
    if (!file.type.startsWith("video/")) {
      setError("Please select a video file.");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setVideo(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError(null);
  }

  async function startRecording() {
    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.current = cameraStream;
      // Chrome/Firefox record WebM, Safari records MP4: use whatever this browser supports
      const mimeType = RECORDER_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
      const mediaRecorder = new MediaRecorder(cameraStream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      mediaRecorder.onstop = () => {
        const baseType = (mediaRecorder.mimeType || mimeType || "video/webm").split(";")[0];
        const blob = new Blob(chunks, { type: baseType });
        setPreview(new File([blob], `testimonial.${baseType === "video/mp4" ? "mp4" : "webm"}`, { type: baseType }));
        cleanupRecording();
      };
      recorder.current = mediaRecorder;
      mediaRecorder.start();
      setRecordingSeconds(0);
      setRecording(true);
      timer.current = setInterval(() => {
        setRecordingSeconds((seconds) => {
          if (seconds + 1 >= MAX_DURATION_SECONDS) {
            mediaRecorder.stop();
            setRecording(false);
          }
          return seconds + 1;
        });
      }, 1000);
    } catch (reason) {
      console.warn("[collect] camera unavailable:", reason instanceof DOMException ? reason.name : "unknown");
      cleanupRecording();
      setBlockedInFrame(embedded);
      setError(
        embedded
          ? "Camera access is blocked here. Open the form in a new tab to record, or upload a video instead."
          : "Camera access was blocked. You can upload a video instead."
      );
    }
  }

  function stopRecording() {
    recorder.current?.stop();
    setRecording(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (mode === "video" && !video) return setError("Record or upload a video first.");
    if (mode === "text" && !text.trim()) return setError("Please write your testimonial.");
    setSubmitting(true);
    setProgress(mode === "video" ? 0 : null);
    const payload = new FormData();
    payload.set("customerName", name);
    payload.set("customerEmail", email);
    if (mode === "video" && video) {
      payload.set("durationSeconds", String(recordingSeconds || 0));
    } else {
      payload.set("text", text.trim());
      if (aiConsent) payload.set("aiVideoConsent", "true");
    }

    try {
      if (mode === "video" && video) {
        // Straight to storage when this deployment can (the file never passes through our server); otherwise with the form
        const direct = await uploadDirect(slug, video, (percent) => setProgress(percent));
        if (direct.kind === "error") throw new Error(direct.message);
        if (direct.kind === "uploaded") {
          payload.set("uploadKey", direct.key);
          setProgress(null);
        } else {
          payload.set("video", video);
        }
      }
      const request = new XMLHttpRequest();
      const result = await new Promise<{ ok: boolean; message?: string }>((resolve) => {
        request.open("POST", `/api/collect/${slug}/submissions`);
        request.upload.onprogress = (progressEvent) => {
          if (payload.has("video") && progressEvent.lengthComputable) {
            setProgress(Math.round((progressEvent.loaded / progressEvent.total) * 100));
          }
        };
        request.onload = () => {
          let body: { error?: { message?: string } } = {};
          try { body = JSON.parse(request.responseText); } catch {}
          resolve({ ok: request.status >= 200 && request.status < 300, message: body.error?.message });
        };
        request.onerror = () => resolve({ ok: false, message: "Network error. Please try again." });
        request.send(payload);
      });
      if (!result.ok) throw new Error(result.message || "Unable to submit your testimonial.");
      setComplete(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to submit your testimonial.");
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  }

  if (loading) return <main className="mx-auto min-h-screen max-w-xl p-6 pt-16"><SkeletonRegion label="Loading collection form"><FormSkeleton fields={2} /></SkeletonRegion></main>;
  if (!form) return <main className="mx-auto flex min-h-screen max-w-xl items-center justify-center p-6 text-sm text-text-muted">{error || "Collection form not found."}</main>;

  const accent = form.branding.accentColor || DEFAULT_BRAND_HEX;
  const modes = form.collectModes ?? "both";
  const showTabs = allowsVideo(modes) && allowsText(modes);
  if (complete) return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center justify-center p-6">
      <section className="w-full rounded-card border bg-surface p-5 sm:p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-pill bg-success-soft text-xl text-success-foreground">✓</div>
        <h1 className="text-2xl font-medium">Thank you for sharing!</h1>
        <p className="mt-2 text-sm text-text-muted">Your testimonial has been sent for review.</p>
        {form.incentiveType !== "none" && form.incentiveValue && <p className="mt-5 rounded-card bg-surface-sunken p-3 text-sm font-medium">{form.incentiveValue}</p>}
      </section>
    </main>
  );

  return (
    <main className={cn("bg-surface-sunken px-4 py-10 sm:py-16", !embedded && "min-h-screen")} style={userAccentStyle(accent)}>
      <section className="mx-auto max-w-xl rounded-card border bg-surface p-4 shadow-sm sm:p-8">
        {form.branding.logoUrl && <img className="mb-5 h-10 max-w-48 object-contain" src={form.branding.logoUrl} alt="" />}
        <h1 className="text-2xl font-medium tracking-tight">{form.title}</h1>
        <p className="mt-3 whitespace-pre-wrap text-text-muted">{form.promptText}</p>
        {error && <p role="alert" className="mt-5 rounded-control bg-danger-soft p-3 text-sm text-danger-foreground">{error}{blockedInFrame && <> <a href={typeof window === "undefined" ? "#" : window.location.href} target="_blank" rel="noopener noreferrer" className="font-medium underline">Open in a new tab</a></>}</p>}
        <form onSubmit={submit} className="mt-7 space-y-5">
          {showTabs && <div className="grid grid-cols-2 rounded-card border p-1">
            {(["video", "text"] as const).map((value) => <button key={value} type="button" onClick={() => { setMode(value); setError(null); }} className={cn("rounded-control py-2 text-sm font-medium", mode === value ? "bg-(--user-accent) text-(--user-accent-fg) shadow-sm" : "text-text-muted")}>{value === "video" ? "Video" : "Written"}</button>)}
          </div>}
          {mode === "video" ? <div className="space-y-3 rounded-card border border-dashed p-4">
            {previewUrl ? <><video className="aspect-video w-full rounded-card bg-scrim" controls src={previewUrl} onLoadedMetadata={(event) => { if (event.currentTarget.duration > MAX_DURATION_SECONDS) { setVideo(null); setPreviewUrl(null); setError("Videos must be five minutes or less."); } }} /><button type="button" onClick={() => { setVideo(null); setPreviewUrl(null); }} className="text-sm font-medium text-(--user-accent)">Choose another video</button></> : <>
              <p className="text-sm text-text-muted">Record up to 5 minutes, or upload an MP4, WebM, MOV, or AVI under 100 MB.</p>
              <div className="flex flex-wrap gap-3">{canRecord ? <button type="button" onClick={recording ? stopRecording : startRecording} className={cn(buttonVariants({ size: "md" }), "bg-(--user-accent) text-(--user-accent-fg) hover:bg-(--user-accent) hover:opacity-90")}>{recording ? `Stop recording (${Math.floor(recordingSeconds / 60)}:${String(recordingSeconds % 60).padStart(2, "0")})` : "Record with camera"}</button> : <label className={cn(buttonVariants({ size: "md" }), "cursor-pointer bg-(--user-accent) text-(--user-accent-fg) hover:bg-(--user-accent) hover:opacity-90")}>Record with phone camera<input className="sr-only" type="file" accept="video/*" capture="user" onChange={(event) => event.target.files?.[0] && setPreview(event.target.files[0])} /></label>}<label className={cn(buttonVariants({ variant: "outline", size: "md" }), "cursor-pointer")}>Upload video<input className="sr-only" type="file" accept="video/mp4,video/webm,video/quicktime,video/x-msvideo" onChange={(event) => event.target.files?.[0] && setPreview(event.target.files[0])} /></label></div>
            </>}
          </div> : <textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={5000} rows={7} placeholder="Write your testimonial…" className={cn(textareaClass, "focus-visible:border-(--user-accent) focus-visible:shadow-none focus-visible:ring-2 focus-visible:ring-(--user-accent)")} />}
          {mode === "text" && <label className="flex items-start gap-3 text-sm text-text-muted"><Checkbox checked={aiConsent} onCheckedChange={(value) => setAiConsent(value === true)} className="mt-0.5" /><span><span className="font-medium text-text">Optional:</span> {AI_VIDEO_CONSENT_TEXT}</span></label>}
          <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1 text-sm font-medium">Your name<input required value={name} onChange={(event) => setName(event.target.value)} maxLength={100} className={cn(inputClass, "w-full text-sm")} /></label><label className="space-y-1 text-sm font-medium">Email address<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={200} className={cn(inputClass, "w-full text-sm")} /></label></div>
          {progress !== null && <div className="h-2 overflow-hidden rounded-pill bg-surface-sunken"><div className="h-full bg-(--user-accent) transition-all" style={{ width: `${progress}%` }} /></div>}
          <button disabled={submitting} className={cn(buttonVariants({ size: "lg" }), "w-full bg-(--user-accent) text-(--user-accent-fg) hover:bg-(--user-accent) hover:opacity-90")}>{submitting ? (progress !== null ? `Uploading ${progress}%…` : "Submitting…") : "Submit testimonial"}</button>
        </form>
        {!form.branding?.removeBranding && (
          <div className="mt-8 text-center text-xs text-text-muted">
            Powered by{" "}
            <a
              href="https://vouchreel.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline hover:text-text"
            >
              Vouchreel
            </a>
          </div>
        )}
      </section>
    </main>
  );
}
