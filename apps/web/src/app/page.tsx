import { HomeEntry } from "@/components/HomeEntry";

export default function Home() {
  return (
    <main className="mx-auto grid min-h-full w-full max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-2 lg:px-10">
      <section className="max-w-lg">
        <h1 className="font-display text-6xl leading-[0.95] tracking-tight text-acid md:text-8xl">
          Soneo
        </h1>
        <p className="mt-6 max-w-sm text-base leading-relaxed text-mist">
          Üyelik yok. Kodunu paylaş; aynı odada yazış, konuş, görün.
        </p>
      </section>

      <section className="w-full max-w-md justify-self-start lg:justify-self-end">
        <div className="rounded-[28px] border border-line bg-panel/80 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur">
          <HomeEntry />
        </div>
      </section>
    </main>
  );
}
