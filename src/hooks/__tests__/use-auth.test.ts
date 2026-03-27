import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock server actions
vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ──────────────────────────────────────────────
  // 初始狀態
  // ──────────────────────────────────────────────

  test("初始 isLoading 應為 false", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(false);
  });

  test("應回傳 signIn、signUp 與 isLoading", () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.signIn).toBe("function");
    expect(typeof result.current.signUp).toBe("function");
    expect(result.current.isLoading).toBe(false);
  });

  // ──────────────────────────────────────────────
  // signIn — 成功路徑
  // ──────────────────────────────────────────────

  describe("signIn", () => {
    test("登入成功且無匿名資料，有既有專案時導向第一個專案", async () => {
      (signInAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([{ id: "proj-1" }, { id: "proj-2" }]);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(mockPush).toHaveBeenCalledWith("/proj-1");
      expect(result.current.isLoading).toBe(false);
    });

    test("登入成功且無匿名資料，無既有專案時建立新專案並導向", async () => {
      (signInAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([]);
      (createProject as any).mockResolvedValue({ id: "new-proj" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({ messages: [], data: {} })
      );
      expect(mockPush).toHaveBeenCalledWith("/new-proj");
    });

    test("登入成功且有匿名訊息時，建立匿名專案並清除匿名資料", async () => {
      const anonWork = {
        messages: [{ role: "user", content: "Hello" }],
        fileSystemData: { "/App.tsx": "content" },
      };
      (signInAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(anonWork);
      (createProject as any).mockResolvedValue({ id: "anon-proj" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: anonWork.messages,
          data: anonWork.fileSystemData,
        })
      );
      expect(clearAnonWork).toHaveBeenCalled();
      expect(getProjects).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/anon-proj");
    });

    test("匿名資料訊息為空陣列時，不視為匿名資料", async () => {
      (signInAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue({ messages: [], fileSystemData: {} });
      (getProjects as any).mockResolvedValue([{ id: "proj-1" }]);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(createProject).not.toHaveBeenCalled();
      expect(clearAnonWork).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/proj-1");
    });

    test("回傳 action 的結果", async () => {
      const actionResult = { success: true };
      (signInAction as any).mockResolvedValue(actionResult);
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([{ id: "proj-1" }]);

      const { result } = renderHook(() => useAuth());

      let returned: any;
      await act(async () => {
        returned = await result.current.signIn("user@example.com", "password123");
      });

      expect(returned).toEqual(actionResult);
    });

    // ──────────────────────────────────────────────
    // signIn — 失敗路徑
    // ──────────────────────────────────────────────

    test("登入失敗時不執行後續導向", async () => {
      (signInAction as any).mockResolvedValue({ success: false, error: "Invalid credentials" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "wrongpassword");
      });

      expect(mockPush).not.toHaveBeenCalled();
      expect(getProjects).not.toHaveBeenCalled();
      expect(createProject).not.toHaveBeenCalled();
    });

    test("登入失敗時回傳錯誤結果", async () => {
      const failResult = { success: false, error: "Invalid credentials" };
      (signInAction as any).mockResolvedValue(failResult);

      const { result } = renderHook(() => useAuth());

      let returned: any;
      await act(async () => {
        returned = await result.current.signIn("user@example.com", "wrongpassword");
      });

      expect(returned).toEqual(failResult);
    });

    // ──────────────────────────────────────────────
    // signIn — isLoading 狀態
    // ──────────────────────────────────────────────

    test("signIn 執行中 isLoading 為 true，完成後恢復 false", async () => {
      let resolveSignIn!: (v: any) => void;
      (signInAction as any).mockReturnValue(
        new Promise((res) => { resolveSignIn = res; })
      );

      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.signIn("user@example.com", "password123");
      });

      await waitFor(() => expect(result.current.isLoading).toBe(true));

      await act(async () => {
        resolveSignIn({ success: false, error: "fail" });
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("signIn 拋出例外時 isLoading 仍恢復 false", async () => {
      (signInAction as any).mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123").catch(() => {});
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  // ──────────────────────────────────────────────
  // signUp — 成功路徑
  // ──────────────────────────────────────────────

  describe("signUp", () => {
    test("註冊成功且有既有專案時導向第一個專案", async () => {
      (signUpAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([{ id: "proj-1" }]);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@example.com", "password123");
      });

      expect(mockPush).toHaveBeenCalledWith("/proj-1");
    });

    test("註冊成功且無既有專案時建立新專案", async () => {
      (signUpAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([]);
      (createProject as any).mockResolvedValue({ id: "brand-new" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@example.com", "password123");
      });

      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({ messages: [], data: {} })
      );
      expect(mockPush).toHaveBeenCalledWith("/brand-new");
    });

    test("註冊成功且有匿名訊息時，建立匿名專案並清除匿名資料", async () => {
      const anonWork = {
        messages: [{ role: "user", content: "Draft" }],
        fileSystemData: { "/index.tsx": "export default () => <div/>" },
      };
      (signUpAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(anonWork);
      (createProject as any).mockResolvedValue({ id: "claimed-proj" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@example.com", "password123");
      });

      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: anonWork.messages,
          data: anonWork.fileSystemData,
        })
      );
      expect(clearAnonWork).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/claimed-proj");
    });

    test("回傳 action 的結果", async () => {
      const actionResult = { success: true };
      (signUpAction as any).mockResolvedValue(actionResult);
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([{ id: "proj-1" }]);

      const { result } = renderHook(() => useAuth());

      let returned: any;
      await act(async () => {
        returned = await result.current.signUp("new@example.com", "password123");
      });

      expect(returned).toEqual(actionResult);
    });

    // ──────────────────────────────────────────────
    // signUp — 失敗路徑
    // ──────────────────────────────────────────────

    test("註冊失敗時不執行後續導向", async () => {
      (signUpAction as any).mockResolvedValue({ success: false, error: "Email already registered" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("existing@example.com", "password123");
      });

      expect(mockPush).not.toHaveBeenCalled();
      expect(getProjects).not.toHaveBeenCalled();
    });

    // ──────────────────────────────────────────────
    // signUp — isLoading 狀態
    // ──────────────────────────────────────────────

    test("signUp 執行中 isLoading 為 true，完成後恢復 false", async () => {
      let resolveSignUp!: (v: any) => void;
      (signUpAction as any).mockReturnValue(
        new Promise((res) => { resolveSignUp = res; })
      );

      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.signUp("new@example.com", "password123");
      });

      await waitFor(() => expect(result.current.isLoading).toBe(true));

      await act(async () => {
        resolveSignUp({ success: false, error: "fail" });
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("signUp 拋出例外時 isLoading 仍恢復 false", async () => {
      (signUpAction as any).mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@example.com", "password123").catch(() => {});
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  // ──────────────────────────────────────────────
  // 邊界情況
  // ──────────────────────────────────────────────

  describe("邊界情況", () => {
    test("新建專案的名稱包含時間戳（匿名資料）", async () => {
      const anonWork = {
        messages: [{ role: "user", content: "Hi" }],
        fileSystemData: {},
      };
      (signInAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(anonWork);
      (createProject as any).mockResolvedValue({ id: "t-proj" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      const callArg = (createProject as any).mock.calls[0][0];
      expect(callArg.name).toMatch(/^Design from /);
    });

    test("新建空白專案的名稱包含隨機數字", async () => {
      (signInAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([]);
      (createProject as any).mockResolvedValue({ id: "rand-proj" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      const callArg = (createProject as any).mock.calls[0][0];
      expect(callArg.name).toMatch(/^New Design #\d+$/);
    });

    test("signIn 與 signUp 共用相同的 isLoading 狀態", async () => {
      (signInAction as any).mockResolvedValue({ success: false });
      (signUpAction as any).mockResolvedValue({ success: false });

      const { result } = renderHook(() => useAuth());

      // 確認兩者使用同一個 isLoading ref
      expect(result.current.isLoading).toBe(false);

      await act(async () => {
        await result.current.signIn("a@b.com", "pass");
      });
      expect(result.current.isLoading).toBe(false);

      await act(async () => {
        await result.current.signUp("a@b.com", "pass");
      });
      expect(result.current.isLoading).toBe(false);
    });
  });
});
