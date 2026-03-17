"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import type { ModelConfig, ModelProvider } from "@/types";

export interface ModelFormData {
  id: string;
  provider: ModelProvider;
  apiKey: string;
  endpoint: string;
  model: string;
  enabled: boolean;
}

interface ModelFormProps {
  mode: "create" | "edit";
  initialData?: ModelConfig;
  onSubmit: (data: ModelFormData) => Promise<void>;
}

const PROVIDER_OPTIONS: Array<{ value: ModelProvider; label: string }> = [
  { value: "claude", label: "Claude (Anthropic)" },
  { value: "openai", label: "OpenAI" },
  { value: "glm", label: "GLM (Zhipu AI)" },
  { value: "qwen", label: "Qwen (Alibaba)" },
];

// Model name suggestions for each provider
const MODEL_SUGGESTIONS: Record<ModelProvider, string[]> = {
  claude: [
    "claude-sonnet-4-20250514",
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
    "claude-3-opus-20240229",
  ],
  openai: [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "gpt-3.5-turbo",
  ],
  glm: [
    "glm-4",
    "glm-4-0520",
    "glm-3-turbo",
    "chatglm3-6b",
  ],
  qwen: [
    "qwen-max",
    "qwen-plus",
    "qwen-turbo",
    "qwen-long",
  ],
};

/**
 * 用于创建和Edit AI 模型提供商的模型配置表单
 *
 * 功能：
 * - 提供商选择（Claude、OpenAI、GLM、Qwen）
 * - API 密钥输入（密码类型）
 * - 端点输入，带有提供商的默认值
 * - 基于提供商的模型名称建议
 * - 测试连接按钮
 * - 启用/禁用切换
 * - 表单验证
 * - 成功/Error提示
 */
export function ModelForm({ mode, initialData, onSubmit }: ModelFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const [formData, setFormData] = useState<ModelFormData>({
    id: initialData?.id || "",
    provider: initialData?.provider || "claude",
    apiKey: initialData?.apiKey || "",
    endpoint: initialData?.endpoint || "",
    model: initialData?.model || "",
    enabled: initialData?.enabled ?? true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // ID validation (only for create mode)
    if (mode === "create") {
      if (!formData.id.trim()) {
        newErrors.id = "模型 ID 是必填项";
      } else if (!/^[a-z0-9-]+$/.test(formData.id)) {
        newErrors.id = "模型 ID 只能包含小写字母、数字和连字符";
      }
    }

    // Provider validation
    if (!formData.provider) {
      newErrors.provider = "提供商是必填项";
    }

    // API key validation
    if (!formData.apiKey.trim()) {
      newErrors.apiKey = "API 密钥是必填项";
    } else if (formData.apiKey.length < 10) {
      newErrors.apiKey = "API 密钥似乎无效（太短）";
    }

    // Model name validation
    if (!formData.model.trim()) {
      newErrors.model = "模型名称是必填项";
    }

    // Endpoint validation (if provided)
    if (formData.endpoint && formData.endpoint.trim()) {
      try {
        new URL(formData.endpoint);
      } catch {
        newErrors.endpoint = "端点必须是有效的 URL";
      }
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
    setTestResult(null);

    try {
      await onSubmit(formData);
      alert(
        mode === "create"
          ? "模型创建成功！"
          : "模型更新成功！"
      );
      router.push("/models");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Save模型失败";
      alert(`Error：${message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    // Validate required fields before testing
    const validationErrors: Record<string, string> = {};

    if (!formData.provider) {
      validationErrors.provider = "提供商是必填项";
    }

    if (!formData.apiKey.trim()) {
      validationErrors.apiKey = "API 密钥是必填项";
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const response = await fetch("/api/models/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: formData.provider,
          endpoint: formData.endpoint || undefined,
          apiKey: formData.apiKey,
          model: formData.model || undefined,
        }),
      });

      const result = await response.json();
      setTestResult({
        success: result.success,
        message: result.message || (result.success ? "连接成功" : "连接失败"),
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : "测试连接失败",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleProviderChange = (provider: ModelProvider) => {
    setFormData({
      ...formData,
      provider,
      endpoint: "", // Reset endpoint when provider changes
      model: MODEL_SUGGESTIONS[provider][0], // Set default model
    });
    setTestResult(null); // Clear test result
  };

  // Get default endpoint for current provider
  const getDefaultEndpoint = () => {
    const endpoints: Record<ModelProvider, string> = {
      claude: "https://api.anthropic.com",
      openai: "https://api.openai.com/v1",
      glm: "https://open.bigmodel.cn/api/paas/v4",
      qwen: "https://dashscope.aliyuncs.com/api/v1",
    };
    return endpoints[formData.provider];
  };

  const currentModelSuggestions = MODEL_SUGGESTIONS[formData.provider];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
          基本配置
        </h2>
        <div className="space-y-4">
          {/* ID (only for create mode) */}
          {mode === "create" && (
            <Input
              label="模型 ID"
              value={formData.id}
              onChange={(e) =>
                setFormData({ ...formData, id: e.target.value })
              }
              error={errors.id}
              helperText="此模型配置的唯一标识符（仅限小写字母、数字和连字符）"
              placeholder="例如：claude-sonnet-production"
              required
            />
          )}

          {/* Provider */}
          <Select
            label="提供商"
            options={PROVIDER_OPTIONS}
            value={formData.provider}
            onChange={(e) => handleProviderChange(e.target.value as ModelProvider)}
            error={errors.provider}
            helperText="选择 AI 模型提供商"
            required
          />

          {/* Model Name */}
          <div>
            <label
              htmlFor="model"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              模型名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="model"
              list="model-suggestions"
              value={formData.model}
              onChange={(e) =>
                setFormData({ ...formData, model: e.target.value })
              }
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${
                errors.model
                  ? "border-red-500 focus:border-red-500"
                  : "border-gray-300 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400"
              }`}
              placeholder="e.g., claude-sonnet-4-20250514"
              required
            />
            <datalist id="model-suggestions">
              {currentModelSuggestions.map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>
            {errors.model && (
              <p className="mt-1 text-sm text-red-600">{errors.model}</p>
            )}
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {formData.provider} 的常用模型：{currentModelSuggestions.join(", ")}
            </p>
          </div>

          {/* API Key */}
          <Input
            label="API 密钥"
            type="password"
            value={formData.apiKey}
            onChange={(e) =>
              setFormData({ ...formData, apiKey: e.target.value })
            }
            error={errors.apiKey}
            helperText="输入您在此提供商的 API 密钥"
            placeholder="sk-ant-..."
            required
            autoComplete="off"
          />

          {/* Endpoint */}
          <Input
            label="自定义端点（可选）"
            type="url"
            value={formData.endpoint}
            onChange={(e) =>
              setFormData({ ...formData, endpoint: e.target.value })
            }
            error={errors.endpoint}
            helperText={`留空以使用默认端点：${getDefaultEndpoint()}`}
            placeholder="https://api.example.com"
          />

          {/* Enabled Toggle */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="enabled"
              checked={formData.enabled}
              onChange={(e) =>
                setFormData({ ...formData, enabled: e.target.checked })
              }
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label
              htmlFor="enabled"
              className="ml-2 text-sm text-gray-700 dark:text-gray-300"
            >
              启用此模型
            </label>
          </div>

          {/* Test Connection */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              type="button"
              onClick={handleTestConnection}
              disabled={testing}
              variant="ghost"
              className="w-full"
            >
              {testing ? "测试中..." : "测试连接"}
            </Button>

            {testResult && (
              <div className="mt-3">
                <Badge variant={testResult.success ? "green" : "red"}>
                  {testResult.success ? "✓" : "✗"} {testResult.message}
                </Badge>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex gap-4">
        <Button
          type="submit"
          variant="primary"
          disabled={loading}
          className="flex-1"
        >
          {loading ? "Save中..." : mode === "create" ? "创建模型" : "Save更改"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/models")}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
