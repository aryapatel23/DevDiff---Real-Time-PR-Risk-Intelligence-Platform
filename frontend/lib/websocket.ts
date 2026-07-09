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

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_MS = 2000;

export function connectWS(
  jobId: string,
  onMessage: (msg: WSMessage) => void,
  onDone: () => void
): WebSocket {
  const wsUrl = (process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000');
  let attempts = 0;
  let ws: WebSocket;
  let reconnectTimeout: NodeJS.Timeout;

  function createConnection() {
    ws = new WebSocket(`${wsUrl}/ws/findings/${jobId}`);

    ws.onmessage = (ev) => {
      try {
        const msg: WSMessage = JSON.parse(ev.data as string);
        onMessage(msg);
        if (msg.event === 'complete' || msg.event === 'error') {
          clearTimeout(reconnectTimeout);
          onDone();
        }
      } catch { /* ignore malformed message */ }
    };

    ws.onerror = () => {
      if (attempts < MAX_RECONNECT_ATTEMPTS) {
        attempts++;
        reconnectTimeout = setTimeout(createConnection, RECONNECT_DELAY_MS * attempts);
      } else {
        onDone();
      }
    };

    ws.onclose = (ev) => {
      if (ev.code === 1000) {
        onDone();
      } else if (attempts < MAX_RECONNECT_ATTEMPTS) {
        attempts++;
        reconnectTimeout = setTimeout(createConnection, RECONNECT_DELAY_MS * attempts);
      } else {
        onDone();
      }
    };

    return ws;
  }

  ws = createConnection();

  const originalClose = ws.close.bind(ws);
  ws.close = () => {
    clearTimeout(reconnectTimeout);
    attempts = MAX_RECONNECT_ATTEMPTS;
    originalClose();
  };

  return ws;
}
