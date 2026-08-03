"use client";

import { useCallback, useRef, useState } from "react";
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
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const recordingUrl = `/api/scripts/${scriptId}/beats/${beatIndex}/recording?v=${version}`;

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startRecording = useCallback(async () => {
    setError(null);
    const mimeType = pickMimeType();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" });
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
    mediaRecorderRef.current?.stop();
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
      ) : hasRecording ? (
        <>
          <audio controls src={recordingUrl} className="h-8" />
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
