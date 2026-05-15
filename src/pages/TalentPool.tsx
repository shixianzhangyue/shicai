import PageLayout from "@/components/layout/PageLayout";
import { Users, UserPlus } from "lucide-react";

function TalentPool() {
  return (
    <PageLayout
      title="人才库"
      description="管理所有候选人信息，支持搜索、筛选和导入"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3b82f6] text-white text-sm font-medium hover:bg-[#2563eb] transition-colors">
            <UserPlus className="w-4 h-4" />
            添加候选人
          </button>
        </div>
      </div>
      <div className="p-8 rounded-xl bg-[#1a1d24] border border-[#2a2d35] text-center">
        <Users className="w-12 h-12 mx-auto mb-4 text-[#3b82f6]" />
        <h2 className="text-lg font-medium text-[#e2e8f0] mb-2">
          人才库开发中
        </h2>
        <p className="text-sm text-[#94a3b8]">
          此页面将在后续步骤中实现候选人列表、详情查看、人才池管理、Excel 导入等功能。
        </p>
      </div>
    </PageLayout>
  );
}

export default TalentPool;
