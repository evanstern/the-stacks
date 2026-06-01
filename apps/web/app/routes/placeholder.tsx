type PlaceholderRouteProps = {
  eyebrow: string;
  title: string;
  body: string;
};

export function PlaceholderRoute({ eyebrow, title, body }: PlaceholderRouteProps) {
  return (
    <section className="grid min-h-[calc(100vh-9rem)] place-items-center rounded-[2rem] border border-border bg-card p-8 text-center shadow-soft">
      <div className="max-w-lg">
        <p className="micro-label text-clay-dark">{eyebrow}</p>
        <h1 className="mt-4 font-serif text-5xl tracking-[-0.06em] text-foreground">{title}</h1>
        <p className="mt-5 text-sm leading-7 text-muted">{body}</p>
      </div>
    </section>
  );
}
