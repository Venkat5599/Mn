import type { Metadata } from "next";
import { Suspense } from "react";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import s from "./shell.module.css";

export const metadata: Metadata = { title: "HYPERHEDGE · App" };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={s.shell}>
      <Sidebar />
      <div className={s.content}>
        <Suspense>
          <TopBar />
        </Suspense>
        {children}
      </div>
    </div>
  );
}
