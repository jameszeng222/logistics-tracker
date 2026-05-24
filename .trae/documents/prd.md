## 1. 产品概述

跨境电商物流订单轨迹追踪系统——面向跨境电商业态的一站式物流履约分析平台。通过对接17track API自动拉取物流轨迹，结合ERP履约单数据导入，实现妥投分析、时效统计、异常预警的闭环管理。

- 目标用户：跨境电商运营团队、物流主管、供应链管理人员
- 核心价值：自动追踪物流轨迹 → 实时妥投分析 → 时效SLA监控 → 异常预警处理
- 部署方案：Cloudflare Pages + D1 + Workers（零服务器费用）

## 2. 系统架构

```
┌─────────────┐     ┌──────────────────────┐     ┌─────────────┐
│   React SPA  │────▶│  Pages Functions API  │────▶│  D1 数据库   │
│  (前端渲染)   │◀────│  (服务端SQL聚合)       │◀────│  (订单存储)  │
└──────┬───────┘     └──────────┬───────────┘     └─────────────┘
       │                        │
       │ 17track代理            │
       ▼                        ▼
┌─────────────┐     ┌──────────────────────┐
│  17track API │     │  Cron Worker          │
│  (轨迹数据)   │◀────│  (定时刷新未妥投订单)  │
└─────────────┘     └──────────────────────┘
```

- **前端**：React 18 + TypeScript + Vite + TailwindCSS + Recharts
- **后端API**：Cloudflare Pages Functions（8个统计端点 + CRUD + 17track代理）
- **数据库**：Cloudflare D1（SQLite，服务端SQL聚合，前端不分页加载全量数据）
- **定时任务**：Cloudflare Worker Cron Trigger（每4小时自动刷新未妥投订单轨迹）
- **CI/CD**：GitHub Actions → test分支→测试环境，main分支→生产环境

## 3. 核心功能模块

### 3.1 数据总览（Dashboard）

| 模块 | 功能 | 数据来源 |
|------|------|----------|
| KPI卡片 | 总订单数、妥投率、平均时效、异常件数、SLA达标率 | `/api/orders/stats/kpi` |
| 状态分布 | 9种主状态饼图 + 子状态列表 | `/api/orders/stats/status-distribution` |
| 承运商统计 | 按承运商的妥投率、时效、SLA | `/api/orders/stats/by-carrier` |
| 目的地统计 | 按国家的妥投率、时效、SLA | `/api/orders/stats/by-country` |

默认查看全部国家，支持按国家/承运商/仓库/时间范围筛选。

### 3.2 轨迹追踪（Tracking）

| 模块 | 功能 |
|------|------|
| 订单列表 | 分页展示，支持状态/承运商/目的地/仓库/时间筛选 |
| 轨迹时间线 | 垂直时间线，8个阶段：收到信息→揽收→出境→清关→中转→到港→派送→签收 |
| 详情面板 | 侧边栏展示订单详情，字段统一（承运商、目的地、仓库等） |
| 17track拉取 | 输入追踪号批量从17track获取最新轨迹 |
| CSV导出 | 导出筛选后的订单数据 |

字段合并规则：
- 目的地：只显示 `destinationCountry`
- 仓库：只显示 `warehouse`（ERP发货仓库）
- 承运商：17track承运商名自动映射为C端物流商名

### 3.3 妥投分析（DeliveryDashboard）

| 模块 | 功能 | 数据来源 |
|------|------|----------|
| P90时效矩阵 | 承运商×目的地的P90时效热力图 | `/api/orders/stats/p90-matrix` |
| 时效分布 | 按目的地的时效分段统计（≤2天/3天/4-5天/6-7天/8-10天/>10天） | `/api/orders/stats/transit-distribution` |
| SLA趋势 | 按月的SLA达标率趋势 | `/api/orders/stats/sla-trend` |
| 承运商P90 | 各承运商的P90/平均时效/SLA达标率 | `/api/orders/stats/carrier-p90` |

签收时效3种计算公式：
1. 创建→签收：`erpCreatedAt` → `deliveryDate`
2. 出库→签收：`erpShippedAt` → `deliveryDate`
3. 上网→签收：`InTransit_PickedUp`事件时间 → `deliveryDate`

妥投率计算排除 `not_found` 状态。

### 3.4 异常处理（Exceptions）

| 模块 | 功能 |
|------|------|
| 状态卡片 | 9种主状态分2排显示，5种颜色（蓝/绿/黄/红/紫） |
| 子状态列表 | 点击主状态卡片查看该状态下的订单列表 |
| 退件专区 | 退件中/退件签收单独列出 |
| 订单详情 | 共享OrderDetailModal弹窗，字段统一 |

5种状态颜色：
- 🔵 运输中（InTransit/OutForDelivery/AvailableForPickup）
- 🟢 正常（Delivered/InfoReceived）
- 🟡 警告（Expired）
- 🔴 异常（Exception/DeliveryFailure）
- 🟣 退件（Exception_Returning/Exception_Returned）

### 3.5 履约监控（FulfillmentMonitor）

| 模块 | 功能 | 数据来源 |
|------|------|----------|
| 监控规则 | 6条默认规则：超时未出库/未上网/未妥投 + 扣留/退回/损坏关键字 | localStorage |
| 告警列表 | 触发规则的订单列表，按告警类型分类计数 | `/api/orders/stats/monitoring-alerts` |
| 订单详情 | 共享OrderDetailModal弹窗 | - |

监控规则类型：
- `not_shipped`：超时未出库（默认48h，基于createdAt）
- `not_online`：超时未上网（默认120h，基于shippedAt）
- `not_delivered`：超时未妥投（默认720h，基于shippedAt）
- `keyword`：关键字匹配（扣留/退回/损坏等）

### 3.6 设置（Settings）

| 子页面 | 功能 |
|--------|------|
| 运输商管理 | C端物流商↔17track承运商映射配置，14条默认映射 |
| API管理 | 17track API密钥配置与连接测试 |
| 数据源管理 | 履约单XLSX导入（13个字段） |
| SLA配置 | 按目的地+渠道配置SLA天数 |
| 其他管理 | 清空数据、数据去重 |

## 4. 数据流

### 4.1 履约单导入

```
XLSX文件 → SheetJS解析 → 前端字段映射 → POST /api/orders/import
→ D1 INSERT ON CONFLICT upsert → db.batch()批量执行（50条/批）
→ ID格式：TN-{trackingNumber}
```

导入字段（13个）：履约单号、追踪号、承运商代码、创建时间、出库时间、发货仓库、发货团队、仓库代码、平台、发货数量、付款时间、打包时间、结算时间、物流服务商、物流服务商显示名、当前渠道

### 4.2 轨迹自动刷新

```
Cron Worker（每4小时）→ 查询D1未妥投订单 → 分批调17track gettrackinfo
→ 解析状态/子状态/轨迹事件 → 批量UPDATE D1
→ 妥投订单自动停刷
```

也支持手动触发：`POST https://logistics-tracker-cron.<subdomain>.workers.dev/refresh`

### 4.3 前端轨迹拉取

```
用户输入追踪号 → POST /api/17track/gettrackinfo（代理转发）
→ 17track返回轨迹数据 → 前端trackMapper解析
→ 状态映射（9种17track状态→9种内部状态）
→ 承运商映射（17track承运商名→C端物流商名）
→ 上网时间判断（优先17track子状态InTransit_PickedUp，回退关键字匹配）
→ upsert到D1
```

## 5. 状态映射

### 5.1 17track → 内部状态

| 17track主状态 | 内部状态 | 含义 |
|--------------|----------|------|
| NotFound | not_found | 查询不到 |
| InfoReceived | info_received | 收到信息（如Shipping Label Created） |
| InTransit | in_transit | 运输途中 |
| Expired | expired | 运输过久 |
| AvailableForPickup | available_for_pickup | 到达待取 |
| OutForDelivery | out_for_delivery | 派送途中 |
| DeliveryFailure | delivery_failure | 投递失败 |
| Delivered | delivered | 成功签收 |
| Exception | exception | 可能异常 |

### 5.2 轨迹阶段（EventPhase）

| 阶段 | 含义 | 对应17track子状态 |
|------|------|------------------|
| info | 收到信息 | InfoReceived |
| pickup | 揽收（上网） | InTransit_PickedUp |
| export | 出境 | InTransit_Departure |
| customs | 清关 | InTransit_CustomsProcessing/Released |
| transit | 中转 | InTransit_Other |
| arrival | 到港 | InTransit_Arrival |
| delivery | 派送 | OutForDelivery_Other |
| delivered | 签收 | Delivered_Other |
| pickup_point | 待取 | AvailableForPickup_Other |

**上网时间判断优先级**：17track子状态 `InTransit_PickedUp` > 关键字匹配（pick up/揽收等）

## 6. 承运商映射

C端物流商↔17track承运商映射（14条默认）：

| C端物流商 | 17track承运商 |
|-----------|--------------|
| 云途物流 | YunExpress |
| 万邑通 | Wanyitong, WYT |
| 递四方 | 4PX, 4PX Express |
| 顺丰速运 | SF Express |
| 联邦快递 | FedEx |
| DHL | DHL |
| UPS | UPS |
| 谷仓 | GOFO |
| 3PE | 3PE EXPRESS |
| 速优宝 | SpeedX |
| OnTrac | OnTrac |
| 亚马逊物流 | Amazon Shipping + Amazon MCF |
| 邮政小包 | Yanwen, SunYou |
| 递四方国际 | 4PX Express |

用户可在设置页面自定义添加/修改/删除映射。

## 7. UI设计

- **风格**：极简白色浅蓝配色，Dribbble风格，大量留白，柔和阴影
- **布局**：左侧固定导航栏 + 右侧内容区
- **图表**：Recharts（饼图、柱状图、面积图、热力矩阵）
- **图标**：Lucide React
- **响应式**：桌面优先，最小宽度1280px

## 8. 部署架构

| 组件 | 服务 | 说明 |
|------|------|------|
| 前端SPA | Cloudflare Pages | React构建产物，自动部署 |
| 后端API | Pages Functions | /functions/api/ 下的服务端函数 |
| 数据库 | Cloudflare D1 | SQLite，服务端SQL聚合 |
| 定时刷新 | Cloudflare Worker | Cron Trigger每4小时刷新轨迹 |
| CI/CD | GitHub Actions | test→预览环境，main→生产环境 |

### 环境变量/Secrets

| 变量 | 位置 | 说明 |
|------|------|------|
| TRACK17_API_KEY | Worker Secret | 17track API密钥（Cron Worker用） |
| CLOUDFLARE_API_TOKEN | GitHub Secret | Cloudflare部署Token |
| CLOUDFLARE_ACCOUNT_ID | GitHub Secret | Cloudflare账号ID |

### D1数据库索引

- tracking_number, status, sub_status, destination_country, carrier
- erp_warehouse, erp_team, erp_shipped_at, erp_created_at
- erp_order_no, erp_logistics_provider, erp_current_channel

## 9. 已知限制与规划

| 项目 | 现状 | 规划 |
|------|------|------|
| ERP字段映射 | 固定13字段顺序 | 字段别名配置页，用户自定义列名映射 |
| 监控关键字匹配 | 后端加载events JSON解析 | 纯SQL关键字匹配优化 |
| 轨迹事件存储 | 每单5-15条事件存events字段 | D1免费5GB约1-2年满，需归档策略 |
| 用户认证 | 无 | 按需添加Cloudflare Access |
| 数据量 | D1免费500万行读/天 | 超限后升级D1付费版 |
