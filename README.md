# oblite

按 profile 检测图片中的参考点，并在原图上展示位置。初版只做点位，不包含曲线、比例计算或资料库。

## 不用 API 的会话观察

默认使用「会话观察」。启动网页后，选择图片和 profile，点击「准备会话观察」，再回到当前 Codex 聊天发送 **处理当前图片**。助手在会话中看图、估计点位并写回结果，网页会自动读取。网页不会自行唤起助手；等待期间也没有模型在后台检测。这个流程不需要 API 密钥或本地视觉模型。

任务与结果保存在本机 `.observations/`，已被 Git 忽略；公开仓库不包含个人图片或会话结果。同一图片内容、尺寸与完整 profile 对应同一份缓存，改变图片或方案不会套用旧坐标。刷新后重新选择同一图片并准备任务，即可复用结果。停止等待只停止页面读取，不删除本地任务。

助手的操作入口：读取 `.observations/current.json` 和对应 `request.json`，用看图工具查看其中的图片；按 profile 输出 `{"points":[{"id":"...","status":"found","x":0,"y":0,"reason":"..."}]}`。坐标为完整画面的 0–1000，遮挡点用 `not_visible` 和空坐标，不确定点用 `uncertain`。保存临时 JSON 后执行：

```sh
node scripts/complete-observation.mjs <任务完整 ID> <点位 JSON 文件>
```

写回脚本复用相同的点位校验和归一化逻辑。结果来源明确为 `assistant-observation`，属于本次会话的看图估计，不用于宣称自动检测精度。

## 运行

需要 Node.js 22.15 或更新版本。没有第三方运行依赖，无需安装或构建。

```sh
npm start
```

打开 <http://127.0.0.1:4399>。导入 JPEG / PNG / WebP，或选择内置的狗、树真实照片；选择观察方案后点击「准备会话观察」；配置 API 后也可切换为自动检测。点击列表或图中点位可相互高亮，并可导出 JSON。

### 配置真实检测

把 `.env.example` 复制为 `.env`，填写：

```dotenv
VISION_BASE_URL=https://api.openai.com/v1
VISION_API_KEY=your-local-secret
VISION_MODEL=your-image-capable-model-id
```

这里不预设模型名称：填写你账户实际可用、支持图片和结构化输出的模型。服务使用 OpenAI 兼容的 `POST /chat/completions` 接口；默认请求 `json_schema`。兼容服务如仅支持 JSON 模式，可设 `VISION_RESPONSE_FORMAT=json_object`。两种模式都执行相同的本地结果校验。修改配置后重启服务。官方 OpenAI 也可使用已有的 `OPENAI_API_KEY` 环境变量。

没有 API 配置时可使用会话观察；API 自动检测按钮禁用。**不会把会话观察、缓存结果或测试替身伪装为网页自动检测**。本地配置完整只代表配置就绪，不代表已验证模型连通性。

浏览器导入时不上传图片；会话观察会在点击准备后将图片和结果保存在本机，供当前助手处理。API 模式点击检测后，本机服务将图片发送到你指定的视觉服务；API 模式的图片与结果只保留在内存中，服务不落盘。密钥只在服务端使用。JSON 下载由用户主动触发。服务仅监听本机回环地址。

## 范围与数据

- 狗 profile：鼻尖、狗自身左／右眼、尾根、尾尖。
- 树 profile：主干基部、中点和分叉；选定同一条二级枝的起点、中点和末端。这里只有独立点位，不拟合曲线。
- 自定义 profile：观察对象加点位定义，每行 `名称 | 定位规则`，最多 24 点。
- 每次请求附带完整 profile 快照。点位身份与展示名称分开；图片或 profile 改变会清除旧结果、取消旧请求。
- 坐标以原图左上角为原点，输出归一化到 0–1。JSON 同时给出原图尺寸及像素索引（0 到 width−1 / height−1）。
- `found` 为已定位，`uncertain` 为待确认；`not_visible` 和缺失结果保留空坐标。未知点、重复 ID、越界坐标和“不可见却有坐标”的结果会报错。
- 浏览器按完整画面等比缩到最长边 1600 px 后检测；没有裁剪。坐标映射回原图，页面缩放适配不会改写原始结果。

通用视觉模型的定位是估计，不保证像素级准确；遮挡、细小部位、分支归属尤其需要对照原图判断。初版用于探索“profile → 检测 → 点位展示”，还不能据此证明通用识别精度。模型服务遵循 [OpenAI 图片输入格式](https://developers.openai.com/api/docs/guides/images-vision)和[结构化输出格式](https://developers.openai.com/api/docs/guides/structured-outputs)。

## 验证

```sh
npm test
npm run test:live
```

`npm test` 覆盖模型请求与响应边界、缺失点、坐标映射、HTTP 接口、错误反馈、跨源请求和密钥不外泄等行为，使用明确的测试替身，不能代表真实视觉精度。

`npm run test:live` 需要先配置真实服务；会把两张随项目附带的公开照片发送给配置的服务，结果写入被 Git 忽略的 `.verification/`。返回坐标仍须对照照片检查，不能把“接口成功”记作识别准确。

仅供界面验证的隔离服务：

```sh
node test/fixtures/browser-server.mjs
```

打开 <http://127.0.0.1:4398>。模型栏和每条说明明确标示 TEST FIXTURE；它不识别图片，不接入正常启动路径。

## 结构

- `public/`：原生网页、profile、坐标模型与有出处的示例照片。
- `src/detector.mjs`：请求验证、视觉模型适配、结果验证。
- `src/observations.mjs`：本机会话交接与按图片／profile 匹配结果。
- `server.mjs`：本机静态服务与检测接口。
- `test/`：自动检查与隔离界面夹具。

界面优先留出完整图片空间；右侧依次是观察方案、检测动作和结果。窄屏时结果移到图片下方。点位用玫红与白色描边保持可见，待确认用空心区分，同时保留文字状态；选择点位只改变高亮，不修改检测结果。

## 图片来源

两张照片均来自 Wikimedia Commons，随仓库存放的是原始文件，没有裁剪或重绘。页面保留作者与许可链接；显示缩放和模型输入缩放不改变随附原文件。

| 文件 | 作者 | 来源 | 许可 |
|---|---|---|---|
| `public/assets/dog.jpg` | Edward | [Golden Retriever standing Tucker](https://commons.wikimedia.org/wiki/File:Golden_Retriever_standing_Tucker.jpg) | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) |
| `public/assets/tree.jpg` | Tiia Monto | [Leafless tree](https://commons.wikimedia.org/wiki/File:Leafless_tree.jpg) | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |

完整元数据见 `public/assets/sources.json`。照片许可独立于项目代码；公开仓库本身不授予额外代码许可。
