// The login page's background: the app gradient (bg-app, same as the inside
// pages) with four large, soft glows in the brand colours. The glass login
// box sits on top; glass only looks like glass when there is colour behind
// it to blur -- that is what these glows are for.
//
// Pure CSS shapes, still (no animation), drawn on the server: no images and
// no JavaScript sent to the browser.
const GLOWS = [
    "-left-24 -top-24 h-96 w-96 bg-brand-pink/70",
    "-right-16 top-1/4 h-80 w-80 bg-brand-purple/60",
    "-bottom-28 left-1/4 h-96 w-96 bg-brand-sky/90",
    "bottom-10 right-1/4 h-64 w-64 bg-brand-coral/50",
];

export function LoginBackdrop() {
    return (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            {GLOWS.map((glow) => (
                <span key={glow} className={`absolute rounded-full blur-3xl ${glow}`} />
            ))}
        </div>
    );
}
