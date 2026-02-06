import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trading Simulator Dashboard",
  description: "Multi-agent market simulator dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
