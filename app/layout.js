import "./globals.css";
import Providers from "./providers";

export const metadata = {
  title: "Nabime",
  description: "Location-gated memo service",
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
