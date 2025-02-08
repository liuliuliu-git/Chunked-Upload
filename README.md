该项目演示了如何使用前后端分离的方式实现大文件分片上传，支持断点续传和秒传功能。前端使用 Vue 3（配合 TypeScript）实现文件分片、hash 计算和并发上传，后端使用 Node.js 与 Express 实现接收文件切片、校验、合并文件切片等功能。

项目功能
文件分片上传
将大文件拆分成若干小块（切片），便于上传和断点续传。

文件 Hash 计算
使用 SparkMD5 对部分文件内容进行 hash 计算，生成唯一标识（fileHash），用于判断文件是否已上传过（秒传）或需要续传。

断点续传 / 秒传
在上传前，通过 /verify 接口校验服务器上是否已存在该文件或部分切片，避免重复上传。

并发上传
利用并发请求（最多 10 个并发任务）提升上传效率。

后端切片合并
上传完成后，调用 /merge 接口，将所有文件切片按照顺序合并成完整文件，并删除临时切片数据。

项目结构
go
复制
编辑
├── client                 // 前端代码（Vue 3）
│   ├── src
│   │   ├── components    // 组件目录
│   │   ├── utils         // 工具函数（如分片、常量定义等）
│   │   └── App.vue       // 入口组件，包含上传逻辑
│   └── package.json      // 前端依赖及启动配置
│
└── server                 // 后端代码（Node.js + Express）
    ├── index.js         // 入口文件，定义了 /upload、/merge、/verify 接口
    └── package.json     // 后端依赖及启动配置
安装与启动
前端
进入 client 目录：
bash
复制
编辑
cd client
使用 pnpm 安装依赖：
bash
复制
编辑
pnpm i
启动开发服务：
bash
复制
编辑
pnpm run dev
启动后，浏览器访问开发服务地址（一般为 http://localhost:3000 或其他端口，根据实际配置）。
后端
进入 server 目录：
bash
复制
编辑
cd server
使用 pnpm 安装依赖：
bash
复制
编辑
pnpm i
启动服务器（推荐使用 nodemon 实时监控代码变动）：
bash
复制
编辑
nodemon index.js
服务器默认监听 8090 端口，可通过日志确认服务已启动。
后端接口说明
上传接口：POST /upload
接收单个文件切片，解析请求中的 fileHash、chunkHash 等信息，将切片保存到对应的临时文件夹中。

合并接口：POST /merge
接收完整文件的 fileHash、fileName 与切片大小 size 参数，将对应文件夹内的所有切片按照顺序读取并合并成最终文件，合并后删除临时切片文件夹。

校验接口：POST /verify
接收文件的 fileHash 和 fileName，检查服务器上是否已经存在该文件或部分切片，返回相应的提示信息。

若文件已存在，则直接返回不需要上传（秒传）。
若文件不存在，则返回已存在的切片信息，供断点续传使用。
前端主要实现逻辑
文件选择与分片
用户通过文件输入框选择多个文件，前端利用 getChunkList 函数将每个文件拆分为若干切片。

Hash 计算
调用 calculateHash 方法对文件切片进行部分数据的 hash 计算，生成唯一的 fileHash 标识。这样做既能保证文件的唯一性，也能减少计算量（只取关键部分数据）。

上传前校验
通过调用 /verify 接口，判断服务器上是否已存在该文件或部分切片：

若返回 showUpload: false，则表示文件已存在，触发秒传逻辑；
若返回 showUpload: true，则继续上传缺失的切片。
分片上传
使用 uploadChunks 方法对每个切片逐个构造 FormData 并发送到后端 /upload 接口，同时支持并发上传（最大并发数 10）。

切片合并
所有切片上传完成后，调用 mergeRequest 方法向后端 /merge 接口发送请求，通知服务器合并切片生成完整文件。

项目原理解析
前端部分
主要使用 Vue 3 的 <script setup lang="ts"> 语法编写。通过 SparkMD5 库计算文件 hash，从而实现文件去重与秒传。分片上传逻辑中，通过维护请求池控制并发数，并利用 Promise.all 与 Promise.race 实现任务调度。

后端部分
使用 Express 框架搭建简单服务器，通过 multiparty 解析 multipart/form-data 请求，将上传的切片文件存储到以 fileHash 命名的文件夹内。合并时根据切片名称中包含的序号进行排序，保证切片顺序正确。合并完成后清理临时文件，保证服务器存储空间的有效利用。

注意事项
断点续传
在上传之前的 /verify 请求中，后端会返回已上传的切片列表。实际开发中可根据返回结果只上传缺失的切片，进一步优化上传体验。



性能优化
文件切片大小（通过 CHUNK_SIZE 定义）以及并发请求数可以根据实际场景进行调整，以达到更好的上传效率和服务器负载均衡。

