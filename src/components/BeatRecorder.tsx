"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "./ui/button";

interface BeatRecorderProps {
  scriptId: string;
  beatIndex: number;
  initiallyRecorded: boolean;
  onChange?: () => void;
}

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

export function BeatRecorder({ scriptId, beatIndex, initiallyRecorded, onChange }: BeatRecorderProps) {
  const [hasRecording, setHasRecording] = useState(initiallyRecorded);
  const [isRecording, setIsRecording] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Synchronous guard for the gap between calling recorder.stop() and its
  // "stop" event actually firing (queued as a task per the MediaRecorder
  // spec, not synchronous). Without this, startRecording could fire in that
  // window and reset the shared chunksRef before the first recorder's
  // pending onstop handler reads it, corrupting the upload with the wrong
  // take's audio. This ref is read synchronously by startRecording, so it
  // closes the race without waiting on a re-render; isStopping (state) only
  // mirrors it for the UI.
  const stoppingRef = useRef(false);

  const recordingUrl = `/api/scripts/${scriptId}/beats/${beatIndex}/recording?v=${version}`;

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Belt-and-suspenders cleanup: if the component unmounts mid-recording
  // (e.g. client-side navigation away from the page), stop the active
  // recorder so its onstop handler fires and releases the mic, and directly
  // stop the tracked stream in case the recorder is in some other state.
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // best-effort on unmount
        }
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      stopTimer();
    };
  }, []);

  const startRecording = useCallback(async () => {
    if (stoppingRef.current) return;
    setError(null);
    const mimeType = pickMimeType();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" });
        setIsSaving(true);
        try {
          const res = await fetch(`/api/scripts/${scriptId}/beats/${beatIndex}/recording`, {
            method: "PUT",
            headers: { "Content-Type": blob.type },
            body: blob,
          });
          if (!res.ok) throw new Error("upload failed");
          setHasRecording(true);
          setVersion((v) => v + 1);
          onChange?.();
        } catch {
          setError("No se pudo guardar la grabación.");
        } finally {
          setIsSaving(false);
          stoppingRef.current = false;
          setIsStopping(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    } catch {
      setError("No se pudo acceder al micrófono.");
    }
  }, [scriptId, beatIndex, onChange]);

  const stopRecording = useCallback(() => {
    stoppingRef.current = true;
    setIsStopping(true);
    try {
      mediaRecorderRef.current?.stop();
    } catch {
      setError("No se pudo detener la grabación.");
      stoppingRef.current = false;
      setIsStopping(false);
    }
    setIsRecording(false);
    stopTimer();
  }, []);

  const deleteRecording = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/scripts/${scriptId}/beats/${beatIndex}/recording`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      setHasRecording(false);
      onChange?.();
    } catch {
      setError("No se pudo borrar la grabación.");
    }
  }, [scriptId, beatIndex, onChange]);

  return (
    <div className="flex flex-wrap items-center gap-2 pl-6">
      {isRecording ? (
        <Button type="button" variant="destructive" size="sm" onClick={stopRecording}>
          <Square className="h-3.5 w-3.5" /> Detener ({elapsedSeconds}s)
        </Button>
      ) : isSaving || isStopping ? (
        <span className="text-xs text-muted-foreground">Guardando…</span>
      ) : hasRecording ? (
        <>
          <audio key={version} controls src={recordingUrl} className="h-8" />
          <Button type="button" variant="outline" size="sm" onClick={startRecording}>
            <RotateCcw className="h-3.5 w-3.5" /> Rehacer
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={deleteRecording}>
            <Sparkles className="h-3.5 w-3.5" /> Usar voz IA
          </Button>
        </>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={startRecording}>
          <Mic className="h-3.5 w-3.5" /> Grabar mi voz
        </Button>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
