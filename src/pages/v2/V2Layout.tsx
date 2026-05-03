import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/v2/Sidebar";
import { useV2Theme } from "@/hooks/useV2Theme";

export default function V2Layout() {
  const [mode, toggle] = useV2Theme();

  return (
    <div data-v2-theme={mode} className="min-h-screen flex w-full">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <Outlet context={{ mode, toggle }} />
      </div>
    </div>
  );
}
