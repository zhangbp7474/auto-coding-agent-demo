import { CreateProjectForm } from "@/components/project/CreateProjectForm";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CreatePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="flex flex-1 flex-col px-4 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            创建新项目
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            输入您的故事，选择风格，AI 将为您生成精美的视频
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <CreateProjectForm />
        </div>
      </div>
    </main>
  );
}
