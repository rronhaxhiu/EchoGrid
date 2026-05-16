function App() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-16">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">
          EcoGrid
        </p>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
          React, Vite, and Tailwind are ready.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
          Start building the frontend from <code className="rounded bg-zinc-800 px-2 py-1 text-sm">src/App.jsx</code>.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <a
            className="rounded-md bg-emerald-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300"
            href="https://vite.dev"
            target="_blank"
            rel="noreferrer"
          >
            Vite docs
          </a>
          <a
            className="rounded-md border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900"
            href="https://tailwindcss.com"
            target="_blank"
            rel="noreferrer"
          >
            Tailwind docs
          </a>
        </div>
      </section>
    </main>
  );
}

export default App;
