"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@/components/ui";
import { Select } from "@/components/ui/select";
import type { Role, MCPServer, Skill } from "@/types";

export interface RoleFormData {
  id: string;
  name: string;
  description: string;
  model: string;
  isDefault: boolean;
  mcpServers: MCPServer[];
  skills: Skill[];
}

interface RoleFormProps {
  mode: "create" | "edit";
  initialData?: Role;
  onSubmit: (data: RoleFormData) => Promise<void>;
}

const MODEL_OPTIONS = [
  { value: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5" },
  { value: "claude-opus-4-6", label: "Claude Opus 4.6" },
  { value: "claude-haiku-4-20250929", label: "Claude Haiku 4" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "glm-4", label: "GLM-4" },
  { value: "qwen-max", label: "Qwen Max" },
];

/**
 * 用于创建和Edit角色的角色表单组件
 *
 * 功能：
 * - 必填字段的表单验证
 * - 模型提供商选择
 * - MCP 服务器配置
 * - 技能配置
 * - 成功/Error提示
 */
export function RoleForm({ mode, initialData, onSubmit }: RoleFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState<RoleFormData>({
    id: initialData?.id || "",
    name: initialData?.name || "",
    description: initialData?.description || "",
    model: initialData?.model || "",
    isDefault: initialData?.isDefault || false,
    mcpServers: initialData?.mcpServers || [],
    skills: initialData?.skills || [],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // ID validation (only for create mode)
    if (mode === "create") {
      if (!formData.id.trim()) {
        newErrors.id = "角色 ID 是必填项";
      } else if (!/^[a-z0-9-]+$/.test(formData.id)) {
        newErrors.id = "角色 ID 只能包含小写字母、数字和连字符";
      }
    }

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = "角色名称是必填项";
    }

    // Model validation
    if (!formData.model.trim()) {
      newErrors.model = "模型是必填项";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      await onSubmit(formData);
      // Show success toast
      alert(
        mode === "create"
          ? "角色创建成功！"
          : "角色更新成功！"
      );
      router.push("/roles");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Save角色失败";
      alert(`Error：${message}`);
    } finally {
      setLoading(false);
    }
  };

  const addMCPServer = () => {
    setFormData({
      ...formData,
      mcpServers: [
        ...formData.mcpServers,
        { name: "", command: "", args: [], env: {} },
      ],
    });
  };

  const updateMCPServer = (index: number, server: MCPServer) => {
    const newServers = [...formData.mcpServers];
    newServers[index] = server;
    setFormData({ ...formData, mcpServers: newServers });
  };

  const removeMCPServer = (index: number) => {
    setFormData({
      ...formData,
      mcpServers: formData.mcpServers.filter((_, i) => i !== index),
    });
  };

  const addSkill = () => {
    setFormData({
      ...formData,
      skills: [...formData.skills, { name: "", path: "", triggerWords: [] }],
    });
  };

  const updateSkill = (index: number, skill: Skill) => {
    const newSkills = [...formData.skills];
    newSkills[index] = skill;
    setFormData({ ...formData, skills: newSkills });
  };

  const removeSkill = (index: number) => {
    setFormData({
      ...formData,
      skills: formData.skills.filter((_, i) => i !== index),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
          基本信息
        </h2>
        <div className="space-y-4">
          {/* ID (only for create mode) */}
          {mode === "create" && (
            <Input
              label="角色 ID"
              value={formData.id}
              onChange={(e) =>
                setFormData({ ...formData, id: e.target.value })
              }
              error={errors.id}
              helperText="角色的唯一标识符（仅限小写字母、数字和连字符）"
              placeholder="例如：frontend-developer"
              required
            />
          )}

          {/* Name */}
          <Input
            label="角色名称"
            value={formData.name}
            onChange={(e) =>
              setFormData({ ...formData, name: e.target.value })
            }
            error={errors.name}
            placeholder="例如：前端开发工程师"
            required
          />

          {/* Description */}
          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              描述
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="简要描述此角色的用途..."
            />
          </div>

          {/* Model */}
          <Select
            label="模型"
            options={MODEL_OPTIONS}
            value={formData.model}
            onChange={(e) =>
              setFormData({ ...formData, model: e.target.value })
            }
            error={errors.model}
            helperText="选择此角色使用的 AI 模型"
            required
          />

          {/* Is Default */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="isDefault"
              checked={formData.isDefault}
              onChange={(e) =>
                setFormData({ ...formData, isDefault: e.target.checked })
              }
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label
              htmlFor="isDefault"
              className="ml-2 text-sm text-gray-700 dark:text-gray-300"
            >
              设为默认角色
            </label>
          </div>
        </div>
      </Card>

      {/* MCP Servers */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            MCP 服务器
          </h2>
          <Button type="button" onClick={addMCPServer} variant="ghost">
            <span className="mr-2">➕</span>
            添加 MCP 服务器
          </Button>
        </div>

        {formData.mcpServers.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            尚未配置 MCP 服务器。添加服务器以启用额外功能。
          </p>
        ) : (
          <div className="space-y-4">
            {formData.mcpServers.map((server, index) => (
              <div
                key={index}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-md space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    MCP 服务器 {index + 1}
                  </h3>
                  <Button
                    type="button"
                    onClick={() => removeMCPServer(index)}
                    variant="danger"
                    className="text-sm px-3 py-1"
                  >
                    移除
                  </Button>
                </div>

                <Input
                  label="服务器名称"
                  value={server.name}
                  placeholder="例如：filesystem"
                  onChange={(e) =>
                    updateMCPServer(index, { ...server, name: e.target.value })
                  }
                />

                <Input
                  label="命令"
                  value={server.command}
                  placeholder="例如：npx"
                  onChange={(e) =>
                    updateMCPServer(index, {
                      ...server,
                      command: e.target.value,
                    })
                  }
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    参数（每行一个）
                  </label>
                  <textarea
                    value={server.args.join("\n")}
                    onChange={(e) =>
                      updateMCPServer(index, {
                        ...server,
                        args: e.target.value.split("\n").filter(Boolean),
                      })
                    }
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm font-mono"
                    placeholder="-y&#10;@modelcontextprotocol/server-filesystem"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Skills */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            技能
          </h2>
          <Button type="button" onClick={addSkill} variant="ghost">
            <span className="mr-2">➕</span>
            添加技能
          </Button>
        </div>

        {formData.skills.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            尚未配置技能。添加技能以启用自定义触发器。
          </p>
        ) : (
          <div className="space-y-4">
            {formData.skills.map((skill, index) => (
              <div
                key={index}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-md space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    技能 {index + 1}
                  </h3>
                  <Button
                    type="button"
                    onClick={() => removeSkill(index)}
                    variant="danger"
                    className="text-sm px-3 py-1"
                  >
                    移除
                  </Button>
                </div>

                <Input
                  label="技能名称"
                  value={skill.name}
                  placeholder="例如：commit"
                  onChange={(e) =>
                    updateSkill(index, { ...skill, name: e.target.value })
                  }
                />

                <Input
                  label="路径"
                  value={skill.path}
                  placeholder="例如：.skills/commit.md"
                  onChange={(e) =>
                    updateSkill(index, { ...skill, path: e.target.value })
                  }
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    触发词（逗号分隔）
                  </label>
                  <textarea
                    value={skill.triggerWords.join(", ")}
                    onChange={(e) =>
                      updateSkill(index, {
                        ...skill,
                        triggerWords: e.target.value
                          .split(",")
                          .map((w) => w.trim())
                          .filter(Boolean),
                      })
                    }
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm font-mono"
                    placeholder="commit, git, save"
                  />
                </div>

                <Input
                  label="描述"
                  value={skill.description || ""}
                  placeholder="简要描述此技能的作用"
                  onChange={(e) =>
                    updateSkill(index, {
                      ...skill,
                      description: e.target.value,
                    })
                  }
                />
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Actions */}
      <div className="flex gap-4">
        <Button
          type="submit"
          variant="primary"
          disabled={loading}
          className="flex-1"
        >
          {loading ? "Save中..." : mode === "create" ? "创建角色" : "Save更改"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/roles")}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
