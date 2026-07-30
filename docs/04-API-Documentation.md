# 04 — API Documentation

项目：Sunshine Inventory Management System  
版本：Draft v0.1  
状态：设计稿，接口尚未实现  
更新日期：2026-07-30

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
  "expiryDate": "2027-08-01"
}
```

同一商品和日期已存在时返回现有记录，不重复创建。

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
  "earlyWarningMonths": 7,
  "warningMonths": 6,
  "urgentMonths": 3,
  "labels": {
    "earlyWarning": "提前关注",
    "warning": "临期预警",
    "urgent": "紧急处理",
    "expired": "已到期"
  }
}
```

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

本文件为 API 契约初稿。当前没有对应 NestJS controller、service、数据库 migration 或自动测试，不得标记为已上线接口。
