# 04 — API Documentation

项目：Sunshine Inventory Management System  
版本：Foundation v0.1
状态：仅健康检查已实现，业务接口仍为设计稿
更新日期：2026-07-31

## 1. 通用约定

基础路径：

```text
/api/v1
```

认证：

```http
Authorization: Bearer <token>
```

响应：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {}
}
```

所有库存写入请求必须支持：

```http
Idempotency-Key: <uuid>
```

用于防止扫码页面重复提交。

## 2. 权限代码

| 权限 | 说明 |
| --- | --- |
| `product.read` | 查看商品 |
| `product.write` | 新建和修改商品 |
| `barcode.write` | 管理条码 |
| `inventory.read` | 查看库存和日期 |
| `inventory.receive` | 入库 |
| `inventory.issue` | 手工出库 |
| `inventory.transfer` | 调拨 |
| `inventory.count` | 盘点 |
| `inventory.adjust` | 调整和冲销 |
| `expiry.read` | 查看临期 |
| `user.manage` | 管理员工权限 |
| `audit.read` | 查看审计 |

权限还必须限定门店和仓库范围。

## 3. 认证

### `GET /health`

实施状态：已实现。

```json
{
  "code": 200,
  "message": "Inventory API is healthy",
  "data": {
    "service": "sunshine-inventory-api",
    "status": "ok"
  }
}
```

以下认证与业务接口仍未实现。

### `POST /auth/login`

请求：

```json
{
  "username": "employee01",
  "password": "example-only"
}
```

返回用户、角色、门店和仓库权限。正式文档不得保存真实密码。

### `GET /auth/me`

返回当前用户及权限范围。

## 4. 门店和仓库

| 方法 | 路径 | 权限 |
| --- | --- | --- |
| GET | `/stores` | 已登录 |
| POST | `/stores` | 管理员 |
| GET | `/stores/:storeId/warehouses` | 已登录且有门店权限 |
| POST | `/stores/:storeId/warehouses` | 管理员 |

## 5. 商品和条码

### `GET /products/by-barcode/:barcode`

扫码查询核心接口。

返回：

```json
{
  "code": 200,
  "message": "商品查询成功",
  "data": {
    "product": {
      "id": "18",
      "sku": "SKU-000018",
      "name": "Vitamin C",
      "unit": "piece"
    },
    "barcodes": [
      {
        "barcode": "9415007001234",
        "isPrimary": true
      }
    ],
    "inventory": [
      {
        "warehouseId": "1",
        "expiryDate": "2026-10-01",
        "quantity": 10,
        "alertLevel": "URGENT"
      },
      {
        "warehouseId": "1",
        "expiryDate": "2027-08-01",
        "quantity": 15,
        "alertLevel": "NORMAL"
      }
    ]
  }
}
```

找不到返回404，并由前端显示新商品草稿入口。

### 其他商品接口

| 方法 | 路径 | 权限 |
| --- | --- | --- |
| GET | `/products` | `product.read` |
| POST | `/products` | `product.write` |
| GET | `/products/:productId` | `product.read` |
| PATCH | `/products/:productId` | `product.write` |
| POST | `/products/:productId/barcodes` | `barcode.write` |
| PATCH | `/products/:productId/barcodes/:barcodeId` | `barcode.write` |
| DELETE | `/products/:productId/barcodes/:barcodeId` | 管理员，逻辑停用 |

## 6. 到期日期记录

| 方法 | 路径 | 权限 |
| --- | --- | --- |
| GET | `/products/:productId/batches` | `inventory.read` |
| POST | `/products/:productId/batches` | `inventory.receive` 或管理员 |
| PATCH | `/products/:productId/batches/:batchId` | 管理员 |

创建请求：

```json
{
  "expiryMonth": "2027-08",
  "expiryDay": 1
}
```

`expiryDay` 可省略；年份和月份必填。省略时响应日期显示为 `YYYY-MM`，并返回 `expiryPrecision: "MONTH"`。同一商品、日期和日期精度已存在时返回现有记录，不重复创建。

前端应把 `expiryMonth` 与可选的 `expiryDay` 组合显示为一个“到期日期”控件区域；这是视觉合并，API 字段仍分开传输，从而准确表达“日未标明”。

桌面端请求表单按“条码、商品名、到期日期、数量”一行呈现；这只是前端布局约定，不改变 `POST /inventory/scan-receive` 请求结构。

USB HID扫码枪只产生本地键盘输入，扫码就绪状态不调用后端API。扫码文本提交后才调用现有搜索或入库接口。

未来PWA或Tauri管理员小工具复用本文件现有登录、搜索、入库和出库接口。桌面壳不得直接持有数据库凭据或绕过JWT、门店角色及仓库权限。

管理页面不得直接显示 class-validator 的英文属性错误；到期字段校验失败时统一转为简短中文提示。网页与 API DTO 发生版本不一致时，应先重启 API，失败请求不会生成库存流水。

## 7. 当前库存

| 方法 | 路径 | 权限 |
| --- | --- | --- |
| GET | `/inventory` | `inventory.read` |
| GET | `/inventory/products/:productId` | `inventory.read` |
| GET | `/inventory/warehouses/:warehouseId` | 仓库范围内 `inventory.read` |
| GET | `/inventory/reconciliation` | 管理员 |

过滤参数：

```text
storeId
warehouseId
productId
barcode
expiryFrom
expiryTo
alertLevel
page
pageSize
```

## 8. 库存流水

### `POST /stock-movements/receipts`

手工入库：

```json
{
  "warehouseId": "1",
  "productId": "18",
  "expiryDate": "2027-08-01",
  "quantity": 20,
  "reason": "Manual receiving"
}
```

### `POST /stock-movements/issues`

第一阶段手工出库：

```json
{
  "warehouseId": "1",
  "productId": "18",
  "batchId": "31",
  "quantity": 5,
  "issuePurpose": "SHELF_REPLENISHMENT",
  "reason": "Moved from warehouse to untracked shop shelf"
}
```

`issuePurpose` 第一阶段至少支持：

- `SHELF_REPLENISHMENT`：拿到暂未追踪的货架；
- `MANUAL_SALE_ADJUSTMENT`：根据人工记录补录；
- `DAMAGE`：损耗应优先使用专用流水；
- `OTHER`：必须填写原因。

`SHELF_REPLENISHMENT` 只减少受系统管理的仓库库存，不代表 POS 销售完成。

### `POST /stock-movements/stocktake-adjustments`

盘点调整：

```json
{
  "warehouseId": "1",
  "productId": "18",
  "batchId": "31",
  "countedQuantity": 18,
  "reason": "Monthly stocktake"
}
```

后端根据当前数量计算差异，不接受前端直接指定任意 `quantity_delta`。

### `POST /stock-movements/:movementId/reverse`

管理员冲销：

```json
{
  "reason": "Wrong expiry date selected"
}
```

### 查询

```http
GET /stock-movements
```

支持按员工、商品、日期、门店、仓库和流水类型筛选。

## 9. 调拨

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/stock-transfers` | 创建草稿 |
| POST | `/stock-transfers/:id/dispatch` | 发出 |
| POST | `/stock-transfers/:id/receive` | 接收 |
| POST | `/stock-transfers/:id/cancel` | 按状态取消 |
| GET | `/stock-transfers` | 查询 |
| GET | `/stock-transfers/:id` | 详情 |

创建：

```json
{
  "fromWarehouseId": "1",
  "toWarehouseId": "2",
  "items": [
    {
      "productId": "18",
      "batchId": "31",
      "quantity": 5
    }
  ],
  "reason": "Transfer to second store"
}
```

## 10. 临期提醒

| 方法 | 路径 | 权限 |
| --- | --- | --- |
| GET | `/expiry-alerts` | `expiry.read` |
| GET | `/expiry-settings` | 管理员 |
| PUT | `/expiry-settings` | 管理员 |

默认配置：

```json
{
  "earlyWarningMonths": 6,
  "warningMonths": 3,
  "urgentMonths": 2,
  "labels": {
    "earlyWarning": "提前关注",
    "warning": "临期预警",
    "urgent": "紧急临期",
    "expired": "已过期"
  }
}
```

已实现的查询接口为 `GET /api/v1/inventory/expiry-alerts`，支持：

- `q`：可选，按商品名称部分关键词或条码查询；
- `level`：可选，值为 `EXPIRED`、`URGENT`、`WARNING` 或 `EARLY`；
- 仓库范围由登录员工的 JWT 和仓库查看权限确定，客户端不能指定其他仓库；
- 响应包含企业时区当天日期、2/3/6个月阈值、各等级汇总及商品、条码、到期日期、剩余天数和库存数量；
- 等级筛选只过滤明细，顶部汇总仍保留当前关键词范围内的完整等级分布。

## 11. 初始库存导入

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/inventory-imports` | 上传文件并创建草稿 |
| GET | `/inventory-imports/:id/preview` | 查看校验结果 |
| POST | `/inventory-imports/:id/confirm` | 确认并生成流水 |
| POST | `/inventory-imports/:id/cancel` | 取消 |

导入不能直接写入库存。确认前必须显示：

- 有效行；
- 重复条码；
- 缺失商品名称；
- 无效日期；
- 非整数数量；
- 未识别仓库；
- 将要创建的商品、日期和库存流水。

## 12. 审计日志

```http
GET /audit-logs
```

仅管理员或 `audit.read` 权限可访问。

## 13. 错误码草案

| HTTP | Code | 说明 |
| ---: | --- | --- |
| 400 | `VALIDATION_ERROR` | 参数错误 |
| 401 | `UNAUTHENTICATED` | 未登录 |
| 403 | `FORBIDDEN` | 无权限或超出仓库范围 |
| 404 | `PRODUCT_NOT_FOUND` | 条码未绑定商品 |
| 409 | `BARCODE_ALREADY_BOUND` | 条码已绑定其他商品 |
| 409 | `INSUFFICIENT_STOCK` | 库存不足 |
| 409 | `DUPLICATE_REQUEST` | 重复提交 |
| 409 | `TRANSFER_STATE_CONFLICT` | 调拨状态冲突 |
| 422 | `IMPORT_VALIDATION_FAILED` | 导入校验失败 |

## 14. 实施状态

NestJS API 骨架、`GET /api/v1/health`、Prisma Schema、初始 migration、Prisma 数据库连接服务和自动测试已经实现。API 应用启动时建立数据库连接，关闭时释放连接；当前健康接口仍只表示 API 进程健康，不等同于完整业务就绪检查。

已实现：

| 方法 | 路径 | 状态 |
| --- | --- | --- |
| POST | `/auth/login` | 已实现，返回JWT与员工资料 |
| GET | `/inventory/barcode/:barcode` | 已实现，要求查看权限 |
| GET | `/inventory/search?q=` | 已实现，按关键词或条码返回商品聚合库存 |
| POST | `/inventory/scan-receive` | 已实现，要求入库权限 |
| POST | `/inventory/manual-issue` | 已实现，按日期出库上货架 |
| GET | `/inventory/receipts?date=YYYY-MM-DD` | 已实现，查询当天入库单与明细 |
| POST | `/inventory/receipts/current/complete` | 已实现，完成当前员工最新入库单 |
| GET | `/inventory/inventory-report` | 已实现，查询当前仓库总库存表 |

`POST /inventory/scan-receive`：

```json
{
  "barcode": "0942999999001",
  "productName": "扫码测试商品",
  "expiryMonth": "2027-07",
  "expiryDay": 31,
  "quantity": 6
}
```

成功响应增加 `receivedAt`（ISO 8601），来源为本次不可变入库流水的 `created_at`。该时间由服务器生成，不接受客户端传入或修改。

登录接口允许既有密码进入凭据验证，不在登录DTO重复执行密码强度规则；正式密码强度应在管理员创建员工或修改密码时检查。登录资料中的 `roles[].storeName` 用于页面显示门店，实际库存权限仍以后端仓库授权为准。

完整商品维护、调拨、临期设置维护、导入和审计查询接口仍是契约草案；临期库存查询、盘点调整和库存流水查询已上线。当前登录尚未实现员工自行修改临时密码。

扫码入库请求可选传入已有 `productId`，用于把未知新条码绑定到已有商品。服务端会验证商品属于当前企业。

入库页面通过同一个 `GET /inventory/search?q=` 支持条码和商品名称部分关键词查询。完全相同的商品名称复用已有商品主档并绑定新条码；关键词命中多个不同名称时仍由员工选择。查询响应按商品主档聚合全部条码、日期库存和 `totalQuantity`。

`GET /inventory/search?q=bepur` 返回：

```json
{
  "products": [
    {
      "productId": "1",
      "productName": "bepur镁",
      "barcodes": ["9421907983356", "9421907983357"],
      "batches": [
        { "batchId": "1", "expiryDate": "2026-11", "expiryPrecision": "MONTH", "quantity": 7 },
        { "batchId": "2", "expiryDate": "2027-01-03", "expiryPrecision": "DATE", "quantity": 250 }
      ],
      "totalQuantity": 257
    }
  ]
}
```

管理页面在一次 `POST /inventory/scan-receive` 成功后会暂存本次条码；员工切换到“库存查询”时，页面自动调用 `GET /inventory/search?q=<刚入库条码>` 核对最新余额。该行为只是页面自动查询，不新增接口，也不会再次写入库存。

管理页面必须把响应中每个 `batches[].expiryDate` 明确标为“到期日期”，并与同一批次的 `batches[].quantity` 成对显示；`totalQuantity` 只作为该商品全部到期日期的库存合计，不能代替批次日期信息。

`POST /inventory/manual-issue`：

```json
{
  "batchId": "1",
  "quantity": 2,
  "reason": "上货架"
}
```

当前已实现扫码入库、搜索查询、手工出库上货架、入库/总库存报表、临期库存列表、盘点调整和库存流水查询。调拨、临期设置维护、导入和审计查询接口仍是契约草案。

## 14. 已实现的盘点与库存流水接口

### `GET /api/v1/inventory/movements?q=`

- 权限：当前仓库 `can_view`；
- `q` 可按商品名称、条码或流水号部分匹配；
- 最多返回当前仓库最近100条流水；
- 返回流水类型、商品、多条码、到期日期、数量变化、原因、操作账号和时间。

### `POST /api/v1/inventory/stocktake-adjustment`

权限：当前仓库 `can_count`。

```json
{
  "batchId": "31",
  "actualQuantity": 18,
  "reason": "现场盘点"
}
```

- `actualQuantity` 必须是0或正整数；
- 实际数量与系统数量相同返回400；
- 盘盈/盘亏余额、流水和审计日志在同一事务写入；
- 余额版本已变化返回409，客户端必须重新查询；
- 盘点不能直接修改或删除历史流水。

扫码入库成功响应增加 `receiptId` 和 `receiptNo`；流水使用 `referenceType=STOCK_RECEIPT` 与入库单关联。入库记录返回每日入库单汇总及逐条商品明细，总库存接口按商品主档返回多条码、各到期日期数量和总数量。三个报表接口都从JWT仓库权限解析仓库，不接受客户端指定仓库范围。
