"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(getErrorMessage(data.error));
        setIsLoading(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("登录时发生错误，请稍后重试");
      setIsLoading(false);
    }
  };

  const getErrorMessage = (message: string): string => {
    switch (message) {
      case "Invalid email or password":
        return "邮箱或密码错误";
      case "Account is deactivated":
        return "账号已被停用";
      case "Email and password are required":
        return "请输入邮箱和密码";
      default:
        return message || "登录失败，请重试";
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-gray-700"
        >
          邮箱
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder="请输入邮箱"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-gray-700"
        >
          密码
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder="请输入密码"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className={cn(
          "w-full rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm",
          isLoading
            ? "cursor-not-allowed bg-indigo-400"
            : "bg-indigo-600 hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        )}
      >
        {isLoading ? "登录中..." : "登录"}
      </button>

      <p className="text-center text-sm text-gray-600">
        还没有账号？{" "}
        <Link
          href="/register"
          className="font-medium text-indigo-600 hover:text-indigo-500"
        >
          立即注册
        </Link>
      </p>
    </form>
  );
}
