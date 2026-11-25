// A small crying face for "nothing here" moments (the page-not-found screen).
// lucide has no crying face, so it's drawn here: plain SVG in the brand pink,
// rendered on the server -- no image file, no JavaScript. The two tears drip
// with a CSS animation (motion-safe:animate-tear in globals.css), slightly out
// of step so it doesn't look mechanical.
export function CryingFace({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 120 120" className={className} role="img" aria-label="A sad, crying face">
            {/* Face */}
            <circle cx="60" cy="60" r="52" className="fill-pink-50 stroke-primary" strokeWidth="4" />

            <g className="stroke-primary" strokeWidth="4" strokeLinecap="round" fill="none">
                {/* Sad eyebrows: the inner ends raised */}
                <path d="M33 42 L49 36" />
                <path d="M87 42 L71 36" />
                {/* Eyes squeezed shut */}
                <path d="M36 56 Q44 48 52 56" />
                <path d="M68 56 Q76 48 84 56" />
                {/* Frown */}
                <path d="M42 90 Q60 74 78 90" />
            </g>

            {/* Tears: start just under each eye. transform-box makes the
                animation move each drop from its own position. */}
            <path
                d="M44 60 C40 68 40 73 44 75 C48 73 48 68 44 60 Z"
                className="fill-sky-400 motion-safe:animate-tear"
                style={{ transformBox: "fill-box" }}
            />
            <path
                d="M76 60 C72 68 72 73 76 75 C80 73 80 68 76 60 Z"
                className="fill-sky-400 motion-safe:animate-tear"
                style={{ transformBox: "fill-box", animationDelay: "1.2s" }}
            />
        </svg>
    );
}
