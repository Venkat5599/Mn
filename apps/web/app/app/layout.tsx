import type { Metadata } from "next";
import { Sidebar } from "@/components/Sidebar";
import s from "./shell.module.css";

export const metadata: Metadata = { title: "HYPERHEDGE · Markets" };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={s.shell}>
      <Sidebar />
      <div className={s.content}>{children}</div>
    </div>
  );
}
