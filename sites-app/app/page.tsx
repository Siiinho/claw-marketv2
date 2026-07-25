export default function Home() {
  return (
    <main className="app-shell">
      <iframe
        className="app-frame"
        src="/app/index.html"
        title="ClawMarket — Supermercado Bengala"
        allow="camera; microphone; clipboard-read; clipboard-write"
      />
    </main>
  );
}
