# TalentVault 开发脚本测试指南

## 📋 脚本概述

### start-dev.bat - 启动开发服务器
**功能**：
1. 自动清理残留进程（talent-vault.exe、端口1420占用）
2. 验证依赖项（node_modules、pnpm、cargo）
3. 启动开发服务器（`pnpm tauri dev`）
4. 退出后自动清理

### stop-dev.bat - 停止开发服务器
**功能**：
1. 精确终止talent-vault.exe进程
2. 按端口1420查找并终止Vite开发服务器进程
3. 清理Rust编译器进程（cargo.exe、rustc.exe）
4. 验证清理结果并显示统计

## 🧪 手动测试步骤

### 测试1：基础功能测试
1. **双击启动脚本**：`start-dev.bat`
   - ✅ 应该看到启动banner和配置信息
   - ✅ 应该自动检查依赖并启动开发服务器
   - ✅ 浏览器应自动打开 http://localhost:1420

2. **测试停止脚本**：`stop-dev.bat`
   - ✅ 应该看到停止banner
   - ✅ 应该显示终止的进程数量
   - ✅ 所有TalentVault相关进程应该被终止

### 测试2：残留进程清理测试
1. 启动开发服务器后，手动打开任务管理器
2. 找到`talent-vault.exe`进程，记录PID
3. 运行`stop-dev.bat`
4. ✅ 该进程应该被终止

### 测试3：端口占用测试
1. 启动开发服务器后，运行`netstat -ano | findstr :1420`
2. 记录占用端口的PID
3. 运行`stop-dev.bat`
4. ✅ 该PID应该被终止

### 测试4：并发启动测试
1. 运行`start-dev.bat`
2. 再次运行`start-dev.bat`
3. ✅ 第二个实例应该自动清理第一个实例的残留进程

### 测试5：异常退出测试
1. 运行`start-dev.bat`
2. 按`Ctrl+C`强制停止
3. ✅ 应该看到"清理完成"提示
4. ✅ 所有进程应该被终止

## 🔍 验证要点

### 安全性验证
- [ ] `stop-dev.bat`中**没有**`taskkill /F /IM node.exe`（避免杀掉系统Node进程）
- [ ] 使用端口1420精确查找进程，而不是按名称全局查找
- [ ] 仅终止与TalentVault项目相关的Rust编译器进程

### 功能性验证
- [ ] `start-dev.bat`能自动检查依赖（node_modules、pnpm、cargo）
- [ ] `stop-dev.bat`能显示终止的进程数量
- [ ] `dev-tools.html`中的链接指向正确的相对路径
- [ ] 所有脚本在中文Windows系统上正常显示

### 错误处理验证
- [ ] 端口1420被占用时，脚本能自动清理
- [ ] 依赖缺失时，脚本能给出明确提示
- [ ] 进程无法终止时，脚本能提示管理员权限

## 🐛 常见问题排查

### 问题1：脚本无法启动
**症状**：双击.bat文件无反应或窗口立即关闭
**解决**：
1. 检查文件是否被安全软件拦截
2. 尝试右键"以管理员身份运行"
3. 检查Windows Defender是否阻止了批处理文件

### 问题2：端口1420仍被占用
**症状**：启动脚本报错"Port 1420 still in use"
**解决**：
1. 运行`stop-dev.bat`先清理残留
2. 手动检查`netstat -ano | findstr :1420`
3. 使用`taskkill /F /PID <PID>`手动终止

### 问题3：cargo.exe未终止
**症状**：Rust编译器进程仍在运行
**解决**：
1. 确保`stop-dev.bat`中的`findstr "cargo.exe"`语法正确
2. 手动检查`tasklist /FI "IMAGENAME eq cargo.exe"`
3. 使用管理员权限运行停止脚本

## 📊 预期输出示例

### start-dev.bat 预期输出
```
╔══════════════════════════════════════════════╗
║   TalentVault v1.1 - Development Launcher   ║
╚══════════════════════════════════════════════╝

 [1/5] Cleaning stale processes...
       No stale talent-vault.exe found.
       Done.
 [2/5] Checking prerequisites...
       pnpm: v8.15.0
       cargo: 1.77.0
 [3/5] Checking port 1420...
       Port 1420 is ready.
 [4/5] Configuration:
       Frontend:  http://localhost:1420
       Command:   pnpm tauri dev
       Hot reload: enabled

 [5/5] Starting TalentVault...
```

### stop-dev.bat 预期输出
```
╔══════════════════════════════════════════════╗
║   Stopping TalentVault Development Server    ║
╚══════════════════════════════════════════════╝

 [1/4] Stopping TalentVault app...
       talent-vault.exe terminated.
 [2/4] Stopping processes on port 1420...
       PID 12345 is node.exe - terminating...
       Port 1420 cleared.
 [3/4] Checking for Rust compiler processes...
       No Rust compiler processes found.
 [4/4] Verifying cleanup...

 ══════════════════════════════════════════════
   All TalentVault services stopped. (2 process(es) killed)
 ══════════════════════════════════════════════
```

## ✅ 测试完成标准

当所有以下条件都满足时，测试通过：

1. **启动测试**：开发服务器能正常启动，浏览器能访问 http://localhost:1420
2. **停止测试**：所有TalentVault进程能被正确终止
3. **清理测试**：残留进程能被自动清理
4. **安全性测试**：不会误杀系统Node进程
5. **错误处理测试**：异常情况下能给出明确提示

## 📝 测试记录

| 测试项目 | 预期结果 | 实际结果 | 状态 |
|---------|---------|---------|------|
| 启动脚本语法 | 无语法错误 | - | ⏳ |
| 停止脚本语法 | 无语法错误 | - | ⏳ |
| 端口清理功能 | 能终止占用端口的进程 | - | ⏳ |
| 进程清理功能 | 能终止talent-vault.exe | - | ⏳ |
| 依赖检查功能 | 能检查node_modules/pnpm/cargo | - | ⏳ |
| HTML工具页面 | 链接指向正确路径 | - | ⏳ |

**测试日期**：____年____月____日
**测试人员**：________________