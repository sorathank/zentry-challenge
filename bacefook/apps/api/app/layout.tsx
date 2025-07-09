import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bacefook API",
  description: "Network relationships API server",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
