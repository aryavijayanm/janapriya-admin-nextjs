import type { Metadata } from "next";
import "./globals.css";

// No AuthProvider / ServicesProvider wrapping everything, unlike the old app.
// Those existed to fetch the logged-in user and the services list in the
// browser after page load. Server Components now read both on the server
// before the page is sent, so there is nothing for a client-side provider to
// do. Fewer providers = less JavaScript shipped and no loading spinner while
// "who am I?" resolves.
//
// No next/font either: globals.css sets `body { font-family: Arial }`, which
// is the font the old app actually rendered in. Loading Geist would only
// download a font that never shows.
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
        <html lang="en">
            <body className="antialiased">{children}</body>
        </html>
    );
}
