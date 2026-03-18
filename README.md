# 🧒 MemoriaKids

**「月500円で、かわいい子供の写真をたくさん届けたい」**

MemoriaKids は、保育園向けの総合デジタルプラットフォームです。
登降園管理・成長記録・連絡帳・写真サブスクリプションを一つのサービスに統合し、
保育士と家庭をつなぎます。

---

## 🌟 サービス概要

| 機能 | 説明 |
|------|------|
| **登降園管理** | QR コード / NFC による登降園打刻。リアルタイム通知 |
| **成長記録** | 身長・体重・発達マイルストーンのトラッキングとグラフ表示 |
| **連絡帳** | 保育士 ⇔ 家庭の双方向デジタル連絡帳 |
| **写真サブスク** | 月額 500 円の定額制。AI 顔認識で自動ピックアップ |
| **分散ストレージ** | 特許取得の暗号化分散バックアップ（3 拠点以上） |

## 🏗️ アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│                      クライアント                         │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────────┐  │
│  │  Web (PWA)  │  │   iOS App   │  │  Android App   │  │
│  │  Next.js 15 │  │ React Native│  │ React Native   │  │
│  └──────┬──────┘  └──────┬──────┘  └───────┬────────┘  │
│         └────────────────┼─────────────────┘            │
└──────────────────────────┼──────────────────────────────┘
                           │ HTTPS / WebSocket
┌──────────────────────────┼──────────────────────────────┐
│                    API Gateway                           │
│                    (Hono on Node.js)                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │ 認証/認可 │ │登降園 API│ │連絡帳 API│ │成長記録API│  │
│  │ (Auth)   │ │(Attend)  │ │(Contact) │ │ (Growth)  │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
│  ┌──────────────┐  ┌─────────────────────────────────┐  │
│  │ 写真管理 API  │  │  サブスクリプション / 決済 API   │  │
│  │  (Photo)     │  │        (Subscription)           │  │
│  └──────┬───────┘  └────────────────────────────────┘   │
└─────────┼───────────────────────────────────────────────┘
          │
┌─────────┼───────────────────────────────────────────────┐
│         ▼         AI / ML マイクロサービス                │
│  ┌──────────────────────────────────────────────────┐   │
│  │  顔認識エンジン (Python / ONNX Runtime + GPU)    │   │
│  │  ・園児ごとの顔ベクトル登録                        │   │
│  │  ・写真から自動で園児をタグ付け                     │   │
│  │  ・GPU 処理の計算リソースをマイニング方式で還元     │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
          │
┌─────────┼───────────────────────────────────────────────┐
│         ▼         データレイヤー                         │
│  ┌────────────┐  ┌────────────┐  ┌───────────────────┐  │
│  │ PostgreSQL │  │   Redis    │  │  MinIO (S3 互換)  │  │
│  │  (Master)  │  │  (Cache)   │  │  オブジェクト     │  │
│  │  Drizzle   │  │  Session   │  │  ストレージ       │  │
│  └────────────┘  └────────────┘  └───────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │  📡 分散バックアップ (特許取得)                    │   │
│  │  ・AES-256 暗号化 → 3 拠点以上に分散保存          │   │
│  │  ・各保育園のデスクトップ PC がノードとして参加    │   │
│  │  ・データ健全性ダッシュボードで可視化              │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## 📂 プロジェクト構成

```
MemoriaKids/
├── frontend/                    # フロントエンド (Next.js 15)
│   ├── app/                     # App Router
│   │   ├── (auth)/              # 認証ページ群
│   │   ├── (dashboard)/         # ダッシュボード
│   │   ├── attendance/          # 登降園管理
│   │   ├── contact-book/        # 連絡帳
│   │   ├── growth/              # 成長記録
│   │   ├── photos/              # 写真閲覧・サブスク
│   │   └── layout.tsx
│   ├── components/              # 共通コンポーネント (shadcn/ui)
│   ├── lib/                     # ユーティリティ
│   ├── package.json
│   ├── tailwind.config.ts
│   └── tsconfig.json
│
├── backend/                     # バックエンド API (Hono)
│   ├── src/
│   │   ├── routes/              # API ルート
│   │   │   ├── auth.ts
│   │   │   ├── attendance.ts
│   │   │   ├── contact-book.ts
│   │   │   ├── growth.ts
│   │   │   ├── photos.ts
│   │   │   └── subscription.ts
│   │   ├── middleware/           # 認証・バリデーション
│   │   ├── db/                  # Drizzle ORM スキーマ・マイグレーション
│   │   │   ├── schema.ts
│   │   │   └── migrations/
│   │   ├── services/            # ビジネスロジック
│   │   ├── lib/                 # 共通ユーティリティ
│   │   └── index.ts             # エントリーポイント
│   ├── package.json
│   └── tsconfig.json
│
├── ai-service/                  # 顔認識マイクロサービス (Python)
│   ├── app/
│   │   ├── main.py              # FastAPI エントリーポイント
│   │   ├── face_recognition.py  # 顔認識エンジン
│   │   ├── models/              # ONNX モデル
│   │   └── workers/             # GPU ワーカー
│   ├── requirements.txt
│   └── Dockerfile
│
├── infra/                       # インフラ構成
│   ├── docker-compose.yml       # ローカル開発環境
│   ├── docker-compose.prod.yml  # 本番環境
│   └── nginx/                   # リバースプロキシ設定
│
├── packages/                    # 共有パッケージ (モノレポ)
│   └── shared-types/            # フロント・バック共有型定義
│       ├── src/
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── .github/
│   └── workflows/               # CI/CD
│       ├── ci.yml
│       └── deploy.yml
│
├── package.json                 # ワークスペースルート (pnpm)
├── pnpm-workspace.yaml
├── turbo.json                   # Turborepo 設定
├── .gitignore
└── README.md
```

## 🛠️ 技術スタック

### フロントエンド
| 技術 | 用途 |
|------|------|
| **Next.js 15** (App Router) | Web フレームワーク (RSC + Server Actions) |
| **TypeScript 5** | 型安全 |
| **Tailwind CSS 4** | スタイリング |
| **shadcn/ui** | UI コンポーネントライブラリ |
| **React Native** | iOS / Android モバイルアプリ |
| **TanStack Query** | サーバーステート管理 |
| **Zustand** | クライアントステート管理 |

### バックエンド
| 技術 | 用途 |
|------|------|
| **Hono** | 超軽量 Web フレームワーク (Edge 対応) |
| **Node.js 22+** | ランタイム |
| **TypeScript 5** | 型安全 |
| **Drizzle ORM** | タイプセーフ ORM |
| **PostgreSQL 16** | メイン DB |
| **Redis** | キャッシュ・セッション・リアルタイム通知 |
| **MinIO** | S3 互換オブジェクトストレージ (写真保存) |
| **Zod** | バリデーション |

### AI / ML サービス
| 技術 | 用途 |
|------|------|
| **Python 3.12** | AI サービスランタイム |
| **FastAPI** | API フレームワーク |
| **ONNX Runtime** (GPU) | 顔認識推論エンジン |
| **InsightFace** | 顔検出・特徴量抽出 |
| **CUDA / cuDNN** | GPU アクセラレーション |

### インフラ / DevOps
| 技術 | 用途 |
|------|------|
| **Docker** | コンテナ化 |
| **Turborepo** | モノレポビルドシステム |
| **pnpm** | パッケージマネージャ |
| **GitHub Actions** | CI/CD |
| **Nginx** | リバースプロキシ |

## 💰 ビジネスモデル

```
保護者 (月額500円サブスク)
    │
    ├──→ 写真無制限閲覧 + ダウンロード
    │
    └──→ 売上の一部を保育園に還元
              │
              ├──→ デスクトップ PC の購入・維持費
              │    (写真ストレージノード)
              │
              └──→ GPU 計算リソースの提供報酬
                   (顔認識処理 = マイニング方式の還元)
```

### 分散ストレージ & GPU 還元の仕組み

1. **各保育園にデスクトップ PC を設置** — 写真データのプライマリストレージ
2. **写真は AES-256 で暗号化** → 3 拠点以上に分散バックアップ
3. **顔認識処理は GPU で実行** — 仮想通貨マイニングのように計算貢献を定量化し報酬を還元
4. **データ健全性ダッシュボード** — 全国の保育園のノード稼働率・暗号化ステータス・バックアップ状況をリアルタイム可視化

## 🚀 クイックスタート

### 前提条件

- Node.js 22+
- pnpm 9+
- Docker & Docker Compose
- Python 3.12+ (AI サービス用)

### セットアップ

```bash
# リポジトリをクローン
git clone https://github.com/shimanto/MemoriaKids.git
cd MemoriaKids

# 依存関係のインストール
pnpm install

# 環境変数の設定
cp .env.example .env

# Docker でインフラを起動 (PostgreSQL, Redis, MinIO)
docker compose up -d

# DB マイグレーション
pnpm --filter backend db:migrate

# 開発サーバー起動 (フロント + バック同時)
pnpm dev
```

### 各サービスのポート

| サービス | URL |
|----------|-----|
| フロントエンド | http://localhost:3000 |
| バックエンド API | http://localhost:8787 |
| AI サービス | http://localhost:8000 |
| MinIO Console | http://localhost:9001 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

## 🔒 セキュリティ

- **写真データ**: AES-256-GCM で暗号化し、3 拠点以上に分散保存（特許取得済）
- **通信**: 全通信 TLS 1.3
- **認証**: パスキー + TOTP 二要素認証対応
- **認可**: RBAC (保育士 / 管理者 / 保護者 の 3 ロール)
- **データ健全性**: ブロックチェーンベースの整合性検証ログ
- **監査**: 全操作の監査ログ記録

## 🤝 コントリビューション

MemoriaKids はオープンソースプロジェクトです。
エンジニアのお父さん・お母さんたちの手によって支えられています。

1. このリポジトリを Fork
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチに Push (`git push origin feature/amazing-feature`)
5. Pull Request を作成

### 開発ガイドライン

- TypeScript strict mode 必須
- テストカバレッジ 80% 以上を維持
- コミットメッセージは [Conventional Commits](https://www.conventionalcommits.org/) に準拠
- PR は必ず 1 人以上のレビューを経てマージ

## 📜 ライセンス

MIT License — 詳細は [LICENSE](./LICENSE) を参照

## 📧 お問い合わせ

- GitHub Issues: [shimanto/MemoriaKids](https://github.com/shimanto/MemoriaKids/issues)

---

> **入園から卒園までの 6 年間、子どもたちの成長を見守り続けるプラットフォーム。**
> **IT の力で、保育をもっと豊かに。**
