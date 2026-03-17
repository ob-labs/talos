import type { Metadata } from "next";
import "./globals.css";
import { ErrorProvider, ServerStatusProvider, InitBanner, QueryClientProvider } from "@/components/providers";
import { LayoutProvider } from "@/lib/ui/state";

export const metadata: Metadata = {
  title: "Talos - AI 辅助开发工作流管理系统",
  description: "Talos - AI 辅助开发工作流管理系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="bg-[#0d1117] text-[#e6edf3] overflow-hidden" suppressHydrationWarning>
        <QueryClientProvider>
          <ErrorProvider>
            <ServerStatusProvider>
              <LayoutProvider>
                <InitBanner />
                {children}
              </LayoutProvider>
            </ServerStatusProvider>
          </ErrorProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}
