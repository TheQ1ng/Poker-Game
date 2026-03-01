# 欢乐积分王训练系统 nodejs 版本

居家隔离，线上好友交流用。  
PC 界面，利于操作。可本地化部署，无需持久化存储。

## 运行

```
npm i
npm run build
pm2 start dist/src/server/app-server.js
```

## 开发

```
npm i
npm run start:web		# start react app
npm run watch-server	# start server
```

## 部署

### 一键部署

使用项目根目录下的 `deploy.sh` 脚本进行一键部署：

```bash
# 基本用法
./deploy.sh <服务器IP> [服务器密码] [SSH端口]

# 示例
./deploy.sh 123.45.67.89
./deploy.sh 123.45.67.89 password123
./deploy.sh 123.45.67.89 password123 22
```

### 部署流程

1. **本地检查**：检查本地环境，构建生产版本
2. **服务器环境**：检查并安装必要的依赖（Node.js、PM2、sshpass）
3. **上传项目**：将项目文件同步到服务器
4. **服务器部署**：安装依赖、构建服务器项目、重启服务
5. **防火墙配置**：开放应用端口
6. **显示结果**：显示部署成功信息和访问地址

### 常用命令

- 查看日志：`pm2 logs poker`
- 重启服务：`pm2 restart poker`
- 停止服务：`pm2 stop poker`

## 说明

核心算法：`src/server/utils/game-engine.ts`
