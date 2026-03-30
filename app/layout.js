import "./globals.css";

export const metadata = {
  title: "Brooke Creator Distribution System",
  description: "A legitimate creator workflow control center for Brooke's drum and music content."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

