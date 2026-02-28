"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (!response.ok) {
        console.error("Logout error");
      }

      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("Unexpected logout error:", err);
      router.push("/login");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isLoading}
      className="flex h-10 items-center justify-center rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
    >
      {isLoading ? "登出中..." : "登出"}
    </button>
  );
}
