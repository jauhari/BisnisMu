import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppProviders } from "./providers";

export const metadata: Metadata = { title: "AkuntansiMu", description: "Premium ERP and POS accounting platform" };

export default function RootLayout({ children }: { children: ReactNode }) { return <html lang="id" suppressHydrationWarning><body suppressHydrationWarning><AppProviders>{children}</AppProviders></body></html>; }
