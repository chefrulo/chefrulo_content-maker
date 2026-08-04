"use client";

import { useState, useCallback, useRef } from "react";
import { Loader2, CheckCircle2, XCircle, Circle } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

interface StepState {
  label: string;
  status: "pending" | "running" | "done" | "failed";
}

interface PipelineRunnerProps {
  url: string;
  method?: "POST";
  body?: Record<string, unknown>;
  triggerLabel: string;
  runningLabel?: string;
  variant?: "default" | "accent" | "destructive";
  initialSteps: string[];
  onSuccess?: () => void;
  disabled?: boolean;
  confirmMessage?: string;
}

export function PipelineRunner({
  url,
  body,
  triggerLabel,
  runningLabel = "Running…",
  variant = "accent",
  initialSteps,
  onSuccess,
  disabled,
  confirmMessage,
}: PipelineRunnerProps) {
  const [steps, setSteps] = useState<StepState[]>(
    initialSteps.map((label) => ({ label, status: "pending" }))
  );
  const [logs, setLogs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const run = useCallback(async () => {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setIsRunning(true);
    setErrorMsg(null);
    setLogs([]);
    setSteps(initialSteps.map((label) => ({ label, status: "pending" })));

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Request failed (${response.status})`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");
      const decoder = new TextDecoder();
      let buffer = "";
      let ok = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));
            if (currentEvent === "step") {
              setSteps((prev) =>
                prev.map((s) => (s.label === data.label ? { ...s, status: data.status } : s))
              );
            } else if (currentEvent === "log") {
              setLogs((prev) => [...prev, data.text]);
              requestAnimationFrame(() => {
                logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
              });
            } else if (currentEvent === "done") {
              ok = data.ok;
            }
          }
        }
      }

      if (ok) {
        onSuccess?.();
      } else {
        setErrorMsg("Un paso falló. Mirá el log abajo.");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsRunning(false);
    }
  }, [url, body, initialSteps, onSuccess, confirmMessage]);

  return (
    <div className="space-y-3">
      <Button variant={variant} onClick={run} disabled={isRunning || disabled}>
        {isRunning ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> {runningLabel}
          </>
        ) : (
          triggerLabel
        )}
      </Button>

      {(isRunning || steps.some((s) => s.status !== "pending")) && (
        <div className="rounded-lg border border-border bg-surface p-3 space-y-2">
          <div className="flex flex-wrap gap-3">
            {steps.map((step) => (
              <div key={step.label} className="flex items-center gap-1.5 text-xs">
                {step.status === "done" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                {step.status === "failed" && <XCircle className="h-3.5 w-3.5 text-destructive" />}
                {step.status === "running" && <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />}
                {step.status === "pending" && <Circle className="h-3.5 w-3.5 text-muted-foreground" />}
                <span
                  className={cn(
                    step.status === "pending" && "text-muted-foreground",
                    step.status === "failed" && "text-destructive"
                  )}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>
          {logs.length > 0 && (
            <div
              ref={logRef}
              className="max-h-40 overflow-y-auto rounded-md bg-muted p-2 font-mono text-[10px] leading-relaxed text-muted-foreground whitespace-pre-wrap"
            >
              {logs.join("")}
            </div>
          )}
        </div>
      )}

      {errorMsg && <p className="text-xs text-destructive">{errorMsg}</p>}
    </div>
  );
}
