import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Inter, through Next's built-in font loader (part of Next, not an extra
// library): the font files are downloaded at build time and served from our
// own server -- no request to Google from the browser, no layout jump while
// it loads (display: swap + size-matched fallback). It's exposed as a CSS
// variable that globals.css maps to Tailwind's `font-sans`.
//
// "latin-ext" is needed for the rupee sign: ₹ (U+20B9) is not in the basic
// "latin" set, so without it every amount would mix Inter digits with a ₹
// from a different fallback font.
const inter = Inter({
    subsets: ["latin", "latin-ext"],
    display: "swap",
    variable: "--font-inter",
});

// No AuthProvider / ServicesProvider wrapping everything, unlike the old app.
// Those existed to fetch the logged-in user and the services list in the
// browser after page load. Server Components now read both on the server
// before the page is sent, so there is nothing for a client-side provider to
// do. Fewer providers = less JavaScript shipped and no loading spinner while
// "who am I?" resolves.
export const metadata: Metadata = {
    title: "Janapriya Admin",
    description: "Janapriya Admin panel",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className={inter.variable}>
            <body className="font-sans antialiased">{children}</body>
        </html>
    );
}
