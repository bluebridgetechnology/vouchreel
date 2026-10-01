"use client";

import { FormEvent, use, useEffect, useRef, useState } from "react";

const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_DURATION_SECONDS = 5 * 60;

type CollectionForm = {
  title: string;
  promptText: string;
  incentiveType: "none" | "discount" | "custom";
  incentiveValue: string | null;
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
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load form."))
      .finally(() => setLoading(false));
    return () => cleanupRecording();
  }, [slug]);

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
      const mediaRecorder = new MediaRecorder(cameraStream);
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mediaRecorder.mimeType || "video/webm" });
        setPreview(new File([blob], "testimonial.webm", { type: blob.type }));
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
    } catch {
      setError("Camera access was blocked. You can upload a video instead.");
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
      payload.set("video", video);
      payload.set("durationSeconds", String(recordingSeconds || 0));
    } else {
      payload.set("text", text.trim());
    }

    try {
      const request = new XMLHttpRequest();
      const result = await new Promise<{ ok: boolean; message?: string }>((resolve) => {
        request.open("POST", `/api/collect/${slug}/submissions`);
        request.upload.onprogress = (progressEvent) => {
          if (progressEvent.lengthComputable) {
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

  if (loading) return <main className="mx-auto flex min-h-screen max-w-xl items-center justify-center p-6 text-sm text-muted-foreground">Loading collection form…</main>;
  if (!form) return <main className="mx-auto flex min-h-screen max-w-xl items-center justify-center p-6 text-sm text-muted-foreground">{error || "Collection form not found."}</main>;

  const accent = form.branding.accentColor || "#7c3aed";
  if (complete) return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center justify-center p-6">
      <section className="w-full rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-xl text-emerald-700">✓</div>
        <h1 className="text-2xl font-bold">Thank you for sharing!</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your testimonial has been sent for review.</p>
        {form.incentiveType !== "none" && form.incentiveValue && <p className="mt-5 rounded-lg bg-muted p-3 text-sm font-medium">{form.incentiveValue}</p>}
      </section>
    </main>
  );

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-10 sm:py-16">
      <section className="mx-auto max-w-xl rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        {form.branding.logoUrl && <img className="mb-5 h-10 max-w-48 object-contain" src={form.branding.logoUrl} alt="" />}
        <h1 className="text-2xl font-bold tracking-tight">{form.title}</h1>
        <p className="mt-3 whitespace-pre-wrap text-muted-foreground">{form.promptText}</p>
        {error && <p role="alert" className="mt-5 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        <form onSubmit={submit} className="mt-7 space-y-5">
          <div className="grid grid-cols-2 rounded-lg border p-1">
            {(["video", "text"] as const).map((value) => <button key={value} type="button" onClick={() => { setMode(value); setError(null); }} className={`rounded-md py-2 text-sm font-medium ${mode === value ? "text-white shadow-sm" : "text-muted-foreground"}`} style={mode === value ? { backgroundColor: accent } : undefined}>{value === "video" ? "Video" : "Written"}</button>)}
          </div>
          {mode === "video" ? <div className="space-y-3 rounded-xl border border-dashed p-4">
            {previewUrl ? <><video className="aspect-video w-full rounded-lg bg-black" controls src={previewUrl} onLoadedMetadata={(event) => { if (event.currentTarget.duration > MAX_DURATION_SECONDS) { setVideo(null); setPreviewUrl(null); setError("Videos must be five minutes or less."); } }} /><button type="button" onClick={() => { setVideo(null); setPreviewUrl(null); }} className="text-sm font-medium" style={{ color: accent }}>Choose another video</button></> : <>
              <p className="text-sm text-muted-foreground">Record up to 5 minutes, or upload an MP4, WebM, MOV, or AVI under 100 MB.</p>
              <div className="flex flex-wrap gap-3"><button type="button" onClick={recording ? stopRecording : startRecording} className="rounded-md px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: accent }}>{recording ? `Stop recording (${Math.floor(recordingSeconds / 60)}:${String(recordingSeconds % 60).padStart(2, "0")})` : "Record with camera"}</button><label className="cursor-pointer rounded-md border px-4 py-2 text-sm font-semibold">Upload video<input className="sr-only" type="file" accept="video/mp4,video/webm,video/quicktime,video/x-msvideo" onChange={(event) => event.target.files?.[0] && setPreview(event.target.files[0])} /></label></div>
            </>}
          </div> : <textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={5000} rows={7} placeholder="Write your testimonial…" className="w-full rounded-md border bg-background p-3 text-sm outline-none focus:ring-2" style={{ "--tw-ring-color": accent } as React.CSSProperties} />}
          <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1 text-sm font-medium">Your name<input required value={name} onChange={(event) => setName(event.target.value)} maxLength={100} className="w-full rounded-md border bg-background px-3 py-2 text-sm" /></label><label className="space-y-1 text-sm font-medium">Email address<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={200} className="w-full rounded-md border bg-background px-3 py-2 text-sm" /></label></div>
          {progress !== null && <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full transition-all" style={{ width: `${progress}%`, backgroundColor: accent }} /></div>}
          <button disabled={submitting} className="w-full rounded-md px-4 py-3 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: accent }}>{submitting ? (progress !== null ? `Uploading ${progress}%…` : "Submitting…") : "Submit testimonial"}</button>
        </form>
        {!form.branding?.removeBranding && (
          <div className="mt-8 text-center text-xs text-muted-foreground">
            Powered by{" "}
            <a
              href="https://vouchreel.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline hover:text-foreground"
            >
              Vouchreel
            </a>
          </div>
        )}
      </section>
    </main>
  );
}
