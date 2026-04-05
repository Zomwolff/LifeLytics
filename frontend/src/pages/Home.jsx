
export default function Home({ user, onLogout }) {
  return (
    <div className="min-h-screen bg-[#ececed] px-4 py-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[360px] flex-col">
        <header className="mb-3 flex items-center justify-between">
          <div className="grid h-9 w-9 place-items-center rounded-full border-2 border-black bg-white text-xs">
            <div className="h-3.5 w-3.5 rounded-full border-2 border-black" />
          </div>
          <button
            onClick={onLogout}
            className="grid h-10 min-w-10 place-items-center rounded-full border-2 border-[#4f5052] px-2 text-xs font-bold text-[#4f5052]"
          >
            OUT
          </button>
        </header>

        <p className="mb-2 text-sm font-semibold text-[#4f5052]">
          {user?.name ? `Welcome, ${user.name}` : "Welcome"}
        </p>

        <main className="grid grid-cols-2 gap-3">
          <section className="row-span-2 min-h-[222px] rounded-[1.4rem] bg-[linear-gradient(145deg,#171a22,#2a2c32)] p-4 text-white shadow-[0_8px_18px_rgba(0,0,0,0.28)]">
            <div className="mb-5 h-16 w-full rounded-full border-[7px] border-[#94c4f4] border-r-[#5d8eff] border-b-transparent" />
            <p className="-mt-12 mb-7 text-center text-4xl font-extrabold">36%</p>
            <div className="space-y-1 text-[1.1rem] font-bold leading-tight">
              <p>Height :</p>
              <p>Weight :</p>
              <p>BF% :</p>
            </div>
          </section>

          <section className="min-h-[104px] rounded-[1.2rem] bg-[linear-gradient(145deg,#171a22,#2a2c32)] px-4 py-3 text-white shadow-[0_8px_18px_rgba(0,0,0,0.28)]">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a6 6 0 0 0-3.8 10.7c1 .8 1.8 2 1.8 3.3h4c0-1.3.8-2.5 1.8-3.3A6 6 0 0 0 12 2z" />
              <path d="M9.5 19h5" />
              <path d="M10.4 22h3.2" />
            </svg>
            <p className="text-[2rem] font-extrabold leading-[1.05]">AI</p>
            <p className="text-[2rem] font-extrabold leading-[1.05]">Insights</p>
          </section>

          <section className="min-h-[104px] rounded-[1.2rem] bg-[linear-gradient(145deg,#171a22,#2a2c32)] px-4 py-3 text-white shadow-[0_8px_18px_rgba(0,0,0,0.28)]">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M3 17l6-6 4 4 7-7" />
              <path d="M14 8h6v6" />
            </svg>
            <p className="mt-2 text-[2rem] font-extrabold leading-none">Trends</p>
          </section>

          <section className="col-span-2 min-h-[106px] rounded-[1.3rem] bg-[linear-gradient(145deg,#171a22,#2a2c32)] px-4 py-3 text-white shadow-[0_8px_18px_rgba(0,0,0,0.28)]">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="7" width="18" height="13" rx="2" />
              <path d="M8 7l1.3-2h5.4L16 7" />
              <circle cx="12" cy="13.5" r="3.2" />
            </svg>
            <p className="mt-1 text-[2rem] font-extrabold leading-none">Prescription Insights</p>
          </section>
        </main>

        <div className="mt-auto rounded-sm border-2 border-[#8f8f92] bg-[#ececed] px-3 py-2">
          <div className="flex items-center justify-between text-[#747476]">
            <button className="grid h-8 w-8 place-items-center rounded-md border-2 border-[#575759] text-3xl leading-none text-[#343436]">
              +
            </button>
            <span className="text-3xl">⌕</span>
          </div>
        </div>
      </div>
    </div>
  );
}
