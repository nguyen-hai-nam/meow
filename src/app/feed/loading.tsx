export default function FeedLoading() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-soft-bg">
      <div className="glass border-b border-pink-100 safe-top">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 animate-pulse rounded-full bg-pink-100" />
            <div className="space-y-1.5">
              <div className="h-4 w-16 animate-pulse rounded-full bg-pink-100" />
              <div className="h-2.5 w-24 animate-pulse rounded-full bg-pink-50" />
            </div>
          </div>
          <div className="h-8 w-36 animate-pulse rounded-full bg-pink-50" />
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 pb-24">
        <div className="aspect-[3/4] w-[min(78vw,40.5vh,360px)] animate-pulse
          rounded-[28px] bg-white/80 shadow-xl" />
      </div>
    </div>
  );
}
