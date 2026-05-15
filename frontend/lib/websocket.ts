export type WSMessage =
  | { event: 'pr_meta'; data: any }
  | { event: 'new_user'; data: { author: string; message: string } }
  | { event: 'code_loaded'; data: { files: any[] } }
  | { event: 'intent_warning'; data: { message: string } }
  | { event: 'finding'; data: any }
  | { event: 'logic_review_start'; data: { chunks: number } }
  | { event: 'logic_finding'; data: any }
  | { event: 'logic_review_complete'; data: { count: number } }
  | { event: 'complete'; data: { prId: number; totalFindings: number; riskScore: number; author: string } }
  | { event: 'error'; data: { message: string } };

export function connectWS(
  jobId: string,
  onMessage: (msg: WSMessage) => void,
  onDone: () => void
): WebSocket {
  const wsUrl = (process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000');
  const ws    = new WebSocket(`${wsUrl}/ws/findings/${jobId}`);

  ws.onmessage = (ev) => {
    try {
      const msg: WSMessage = JSON.parse(ev.data as string);
      onMessage(msg);
      if (msg.event === 'complete' || msg.event === 'error') onDone();
    } catch { /* ignore malformed message */ }
  };

  ws.onerror = () => onDone();
  ws.onclose = () => onDone();
  return ws;
}
