export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mono text-xs tracking-[0.25em] uppercase text-[#8a7a5c] mb-2">
          The Daily Ledger
        </div>
        <h1 className="text-3xl mb-4" style={{ fontWeight: 500 }}>
          This is a private tracker.
        </h1>
        <p className="italic text-[#5c4f3d]">
          Navigate to your personal URL to log today.
        </p>
      </div>
    </main>
  );
}
