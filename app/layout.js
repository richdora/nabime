import "./globals.css";
import Providers from "./providers";

export const metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || "https://nabime.vercel.app"),
  title: "Nabime",
  description: "나만의 비밀메모 Nabime",
  icons: {
    icon: [
      { url: "/nabime-icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    title: "Nabime",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
