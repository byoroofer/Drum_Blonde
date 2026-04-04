import "./globals.css";

export const metadata = {
  title: "Brooke's Official Hub | Drum Blonde",
  description:
    "A high-energy link hub for Brooke's drumming content, streams, and merch."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

