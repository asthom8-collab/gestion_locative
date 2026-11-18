export function Badge({ ok, on, off }: { ok: boolean; on: string; off: string }) {
  return (
    <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full font-medium ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
      {ok ? on : off}
    </span>
  )
}
