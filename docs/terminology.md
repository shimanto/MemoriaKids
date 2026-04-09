# MemoriaKids 用語辞書（Terminology Dictionary）

> 仕様書・設計・コード間の用語を統一管理するための公式ドキュメント。
> 新機能追加時はこのファイルを更新すること。

---

## 1. 出欠管理（Attendance）

### 基本用語

| 正式名称 | 英語 | DBテーブル | APIパス | UIフック | UI表記 |
|----------|------|-----------|---------|---------|--------|
| 出欠管理 | Attendance | `attendance_records` | `/api/attendance` | `useAttendance` | 出欠管理 |
| 登園（チェックイン） | Check-in | `.check_in_time` | `POST /check-in` | `useCheckIn` | 登園 |
| 降園（チェックアウト） | Check-out | `.check_out_time` | `POST /check-out` | `useCheckOut` | 降園 |
| 出欠設定 | Attendance Settings | `nursery_attendance_settings` | `GET/PUT /settings` | `useAttendanceSettings` | — |
| 監査ログ | Audit Log | `attendance_audit_log` | — | — | — |

### ステータス (`attendance_status`)

| enum値 | 日本語 | UI色 |
|--------|--------|------|
| `checked_in` | 登園済み | 緑 `text-green-600` |
| `checked_out` | 降園済み | 青 `text-blue-600` |
| `absent` | 欠席 | 赤 `text-red-600` |
| — (UI only) `not_yet` | 未登園 | 灰 `text-gray-500` |

### 認証方式 (`checkin_method`)

| enum値 | 日本語 | DBテーブル | APIパス | UIアイコン |
|--------|--------|-----------|---------|-----------|
| `manual` | 手入力 | — | `POST /check-in` | ✏️ |
| `qr_code` | QRコード | `qr_tokens` | `POST /check-in/qr` | 📱 |
| `beacon` | BLEビーコン | `ble_beacons` | `POST /check-in/beacon` | 📡 |
| `iot_device` | IoTデバイス | `iot_devices` | `POST /check-in/iot` | 🏷️ |
| `face_recognition` | 顔認証 | — | `POST /check-in/face` | 🤖 |

### 認証デバイス管理

| 機能 | DBテーブル | APIパス（CRUD） | 主要カラム |
|------|-----------|----------------|-----------|
| QRトークン | `qr_tokens` | `/api/attendance/qr-tokens` | token, hmacSignature, expiresAt, isRevoked |
| BLEビーコン | `ble_beacons` | `/api/attendance/beacons` | uuid, major, minor, label, isActive |
| IoTデバイス | `iot_devices` | `/api/attendance/iot-devices` | deviceIdentifier, deviceType, label, isActive |

### 兄弟一括登園

| 用語 | 英語 | DBテーブル | APIパス | UIフック | UIコンポーネント |
|------|------|-----------|---------|---------|----------------|
| 家族グループ | Family Group | `family_groups` | `/api/family-groups` | `useFamilyGroups` | — |
| グループメンバー | Group Member | `family_group_members` | （family-groupsに含む） | — | — |
| 兄弟候補 | Siblings | — | `GET /siblings/:childId` | `useSiblings` | — |
| 一括登園 | Batch Check-in | — | `POST /check-in/batch` | `useBatchCheckIn` | `SiblingBatchDialog` |

---

## 2. 連絡帳（Contact Book）

| 正式名称 | 英語 | DBテーブル | APIパス | UIフック | UI表記 |
|----------|------|-----------|---------|---------|--------|
| 連絡帳 | Contact Book | `contact_book_entries` | `/api/contact-book` | `useContactBook` | 連絡帳 / デジタル連絡帳 |
| 連絡帳エントリ | Entry | `.id` | `GET /:id` | `useContactBookEntry` | — |
| 連絡帳作成 | Create Entry | — | `POST /` | `useCreateContactBookEntry` | — |

### 連絡帳カラム

| カラム | 日本語 | 型 | 値の例 |
|--------|--------|-----|--------|
| `mood` | 機嫌 | varchar | — |
| `meals` | 食事 | jsonb | `{ breakfast, lunch, snack }` |
| `nap` | お昼寝 | jsonb | `{ startTime, endTime, quality }` |
| `activities` | 活動内容 | text | 自由記述 |
| `notes` | メモ・連絡事項 | text | 自由記述 |
| `source` | ソース | enum | 下記参照 |

### 機嫌 (mood)

| UI値 | 日本語 |
|------|--------|
| `happy` | 元気 |
| `neutral` | ふつう |
| `sad` | 元気なし |
| `tired` | 疲れ気味 |
| `excited` | はりきり |

### 食事 (meals: breakfast / lunch / snack)

| 値 | 日本語 |
|----|--------|
| `all` | 完食 |
| `most` | ほぼ完食 |
| `some` | 少し残した |
| `none` | 食べなかった |

### お昼寝の質 (nap.quality)

| 値 | 日本語 |
|----|--------|
| `good` | よく眠れた |
| `fair` | ふつう |
| `poor` | あまり眠れなかった |

### 連絡帳ソース (`contact_book_source`)

| enum値 | 日本語 | 説明 |
|--------|--------|------|
| `manual` | 手動入力 | スタッフが直接記入 |
| `ai_generated` | AI自動生成 | 音声AIから全自動で生成 |
| `ai_assisted` | AI補助 | AIドラフトをスタッフが編集 |

---

## 3. ケアノート（Care Notes）

| 正式名称 | 英語 | DBテーブル | APIパス | UI表記 |
|----------|------|-----------|---------|--------|
| ケアノート | Care Note | `care_notes` | `/api/care-notes` | ケアノート / 配慮事項 |

### カテゴリ (`care_note_category`)

| enum値 | 日本語 | 用途 |
|--------|--------|------|
| `health` | 健康 | 持病・体質 |
| `allergy` | アレルギー | 食物・環境アレルギー |
| `behavior` | 行動 | 行動特性・対応方法 |
| `development` | 発達 | 発達段階の記録 |
| `family` | 家族 | 家庭状況の共有事項 |
| `dietary` | 食事療法 | 食事制限・宗教対応 |
| `medication` | 投薬 | 服薬情報 |
| `milestone_filter` | マイルストーンフィルター | AI連絡帳から「初めて○○」を除外する設定 |
| `communication_style` | コミュニケーションスタイル | AI文面生成時のトーン指示 |
| `other` | その他 | 上記に該当しないもの |

### 優先度 (priority)

| 値 | 日本語 |
|----|--------|
| `0` | 低 |
| `1` | 中 |
| `2` | 高 |

---

## 4. 成長記録（Growth Records）

| 正式名称 | 英語 | DBテーブル | APIパス | UIフック | UI表記 |
|----------|------|-----------|---------|---------|--------|
| 成長記録 | Growth Record | `growth_records` | `/api/growth/:childId` | `useGrowthRecords` | 成長記録 |
| 計測追加 | Add Record | — | `POST /:childId` | `useAddGrowthRecord` | 計測記録を追加 |

### 計測項目

| カラム | 日本語 | 単位 |
|--------|--------|------|
| `height_cm` | 身長 | cm |
| `weight_kg` | 体重 | kg |
| `head_circumference_cm` | 頭囲 | cm |

---

## 5. 写真（Photos）

| 正式名称 | 英語 | DBテーブル | APIパス | UIフック | UI表記 |
|----------|------|-----------|---------|---------|--------|
| 写真ギャラリー | Photo Gallery | `photos` | `/api/photos` | `usePhotos` | 写真ギャラリー |
| 写真アップロード | Upload | — | `POST /upload` | `useUploadPhoto` | 写真をアップロード |
| 閲覧画像 | View Image | — | `GET /:id/view` | — | — |
| ダウンロード | Download | `photo_downloads` | `GET /:id/download` | `usePhotoDownload` | ダウンロード |
| DL状況 | Download Status | — | `GET /download-status` | `useDownloadStatus` | 今月のDL |
| AI顔認識 | Face Recognition | `face_vectors` | `GET /face-match/:childId` | `useFaceMatchPhotos` | AI顔認識 / AI分類済み |

### プラン別写真制限

| プラン | 閲覧画質 | DL画質 | 月間DL上限 |
|--------|---------|--------|-----------|
| `free` | 480px | 800px | 10枚 |
| `basic` | 1920px | 1920px | 100枚 |
| `premium` | 3840px | 3840px | 無制限 |
| `enterprise` | 原画 | 8K原画 | 無制限 |

---

## 6. 音声AI（Audio Processing）

| 正式名称 | 英語 | DBテーブル | APIパス | UI表記 |
|----------|------|-----------|---------|--------|
| 音声録音 | Audio Recording | `audio_recordings` | `/api/audio` | 音声AI |
| 文字起こし | Transcript | `audio_transcripts` | `GET /:id` | 文字起こし |
| 園児別抽出 | Child Extract | `.child_extracts` (jsonb) | `GET /:id/drafts` | — |
| 連絡帳ドラフト承認 | Approve Draft | — | `POST /:id/approve` | — |
| 再処理 | Reprocess | — | `POST /:id/reprocess` | — |

### 処理ステータス (`audio_processing_status`)

| enum値 | 日本語 | 説明 |
|--------|--------|------|
| `uploading` | アップロード中 | ファイル受信中 |
| `transcribing` | 文字起こし中 | Whisper等で音声→テキスト |
| `extracting` | 園児別抽出中 | AIが園児ごとに情報を分離 |
| `generating` | 連絡帳生成中 | ドラフト文面の生成 |
| `review_pending` | レビュー待ち | スタッフの確認待ち |
| `completed` | 完了 | 処理完了 |
| `failed` | 失敗 | エラー発生 |

### 録音種別 (type)

| 値 | 日本語 |
|----|--------|
| `meeting` | お昼の連絡会 |
| `handover` | 勤務引継ぎ |
| `other` | その他 |

---

## 7. 認証・ユーザー（Auth & Users）

| 正式名称 | 英語 | DBテーブル | APIパス | UI表記 |
|----------|------|-----------|---------|--------|
| ユーザー | User | `users` | `/api/auth` | — |
| SSO連携 | Auth Account | `auth_accounts` | `/api/auth/sso/*` | — |
| ログイン | Login | — | `POST /login` | ログイン |
| 新規登録 | Register | — | `POST /register` | — |
| ログアウト | Logout | — | `POST /logout` | ログアウト |

### ユーザーロール (`user_role`)

| enum値 | 日本語 | 権限概要 |
|--------|--------|---------|
| `parent` | 保護者 | 自分の子どものデータのみ閲覧 |
| `nursery_staff` | 保育士 | 園のデータ全般の閲覧・記入 |
| `nursery_admin` | 園管理者 | スタッフ管理・設定・課金 |
| `super_admin` | システム管理者 | 全園の管理 |

### SSO方式 (`auth_provider`)

| enum値 | 日本語 | UIボタン色 |
|--------|--------|-----------|
| `email` | メール/パスワード | — |
| `line` | LINE | 緑 `#06C755` |
| `apple` | Apple | 黒 |
| `google` | Google | 白（枠線付き） |

---

## 8. サブスクリプション（Subscription）

| 正式名称 | 英語 | DBテーブル | APIパス | UI表記 |
|----------|------|-----------|---------|--------|
| サブスクリプション | Subscription | `subscriptions` | `/api/subscription` | — |
| プラン一覧 | Plans | — | `GET /plans` | — |
| 契約変更 | Subscribe | — | `POST /subscribe` | — |
| 契約状況 | Status | — | `GET /status` | — |

### プラン (`subscription_plan`)

| enum値 | 日本語 | 月額(税別) | 園児上限 | スタッフ上限 | ストレージ |
|--------|--------|-----------|---------|------------|-----------|
| `free` | フリー | ¥0 | 5名 | 2名 | 500MB |
| `basic` | ベーシック | ¥4,980 | 20名 | 5名 | 5GB |
| `premium` | プレミアム | ¥9,980 | 50名 | 15名 | 50GB |
| `enterprise` | エンタープライズ | ¥29,800 | 無制限 | 無制限 | 無制限 |

### 契約ステータス (`subscription_status`)

| enum値 | 日本語 |
|--------|--------|
| `active` | 有効 |
| `cancelled` | 解約済み |
| `past_due` | 支払い遅延 |
| `trialing` | トライアル中 |

---

## 9. クラス管理（Class Management）

| 正式名称 | 英語 | DBテーブル | APIパス | UIフック | UI表記 |
|----------|------|-----------|---------|---------|--------|
| クラス | Class | `nursery_classes` | `/api/classes` | `useClasses` | クラス |
| クラス担任 | Class Teacher | `class_teachers` | `POST /:id/teachers` | — | 担任 |
| 園児クラス配置 | Assign Child | `children.classId` | `POST /assign` | `useAssignChildToClass` | — |
| 年度更新（進級） | Promote | — | `POST /promote` | `usePromoteClasses` | 進級 |

### 年齢区分 (ageGroup)

| 値 | 日本語 | 対象年齢 |
|----|--------|---------|
| `0` | 0歳児 | 0〜1歳 |
| `1` | 1歳児 | 1〜2歳 |
| `2` | 2歳児 | 2〜3歳 |
| `3` | 3歳児（年少） | 3〜4歳 |
| `4` | 4歳児（年中） | 4〜5歳 |
| `5` | 5歳児（年長） | 5〜6歳 |
| `6` | 6歳児 | 卒園年 |

### 担任役割 (`class_teacher_role`)

| enum値 | 日本語 | 説明 |
|--------|--------|------|
| `lead` | 担任 | クラスの主担当（兼任可） |
| `sub` | 副担任 | サブ担当 |
| `support` | 補助 | ヘルプ・パート補助 |

---

## 10. スタッフ管理（Staff Management）

| 正式名称 | 英語 | DBテーブル | APIパス | UIフック | UI表記 |
|----------|------|-----------|---------|---------|--------|
| スタッフ一覧 | Staff List | `staff_profiles` + `users` | `/api/staff` | `useStaff` | スタッフ管理 |
| スタッフ詳細 | Staff Detail | — | `GET /:id` | `useStaffDetail` | — |
| プロフィール更新 | Update Profile | `staff_profiles` | `PUT /:id/profile` | `useUpdateStaffProfile` | — |
| スタッフ無効化 | Deactivate | — | `DELETE /:id` | `useDeactivateStaff` | — |
| スタッフ招待 | Invite | `staff_invitations` | `POST /invite` | `useInviteStaff` | スタッフを招待 |
| 招待一覧 | Invitations | — | `GET /invitations/list` | `useStaffInvitations` | 招待中 |
| 招待受諾 | Accept Invite | — | `POST /invite/accept` | `useAcceptInvitation` | — |
| 担当クラス | My Classes | — | `GET /classes/my-classes` | — | — |

### 雇用形態 (`employment_type`)

| enum値 | 日本語 |
|--------|--------|
| `full_time` | 正社員 |
| `part_time` | パート |
| `temporary` | 臨時 |
| `contract` | 契約 |

### 招待ステータス (`invitation_status`)

| enum値 | 日本語 |
|--------|--------|
| `pending` | 招待中 |
| `accepted` | 承認済み |
| `expired` | 期限切れ |
| `cancelled` | キャンセル |

### 権限スコープ (`staff_scope`)

| enum値 | 日本語 | 説明 |
|--------|--------|------|
| `nursery_wide` | 園全体 | 全クラスのデータを閲覧可 |
| `class_only` | 担当クラスのみ | 配置されたクラスのデータのみ |

---

## 11. 組織・人物（Organization & People）

| 正式名称 | 英語 | DBテーブル | 主要カラム |
|----------|------|-----------|-----------|
| 保育園 | Nursery | `nurseries` | name, address, phone, email, capacity |
| 園児 | Child | `children` | name, dateOfBirth, parentId, nurseryId, classId, allergies |
| 保護者 | Parent | `users` (role=parent) | parentId → children |
| 保育士 | Staff | `users` (role=nursery_staff) + `staff_profiles` | nurseryId, employmentType, scope |
| 園管理者 | Admin | `users` (role=nursery_admin) | nurseryId |

---

## 12. UIコンポーネント一覧

| ファイル | エクスポート名 | 用途 |
|---------|--------------|------|
| `components/header.tsx` | `Header` | 共通ヘッダー・ナビゲーション |
| `components/ui/button.tsx` | `Button` | 汎用ボタン |
| `components/ui/card.tsx` | `Card`, `CardContent`, `CardHeader`, `CardTitle` | 汎用カード |
| `components/ui/input.tsx` | `Input` | 汎用入力フィールド |
| `components/attendance/qr-scanner.tsx` | `QrScanner` | QRコードスキャンモーダル |
| `components/attendance/sibling-batch-dialog.tsx` | `SiblingBatchDialog` | 兄弟一括登園ダイアログ |

---

## 11. サービス層一覧

| クラス | ファイル | シングルトン | メソッド数 |
|--------|---------|------------|-----------|
| `AttendanceService` | `services/attendance.service.ts` | `attendanceService` | 11 (public 8 / private 3) |
| `PhotoService` | `services/photo.service.ts` | `photoService` | 12 (public 8 / private 4) |

---

## 12. 命名規約

| レイヤー | 規約 | 例 |
|---------|------|-----|
| DB テーブル名 | snake_case | `attendance_records` |
| DB カラム名 | snake_case | `check_in_time` |
| DB enum値 | snake_case | `checked_in`, `qr_code` |
| API パス | kebab-case | `/api/attendance/check-in` |
| API パラメータ | camelCase | `childId`, `nurseryId` |
| React Hook | camelCase + `use` prefix | `useCheckIn` |
| React Component | PascalCase | `SiblingBatchDialog` |
| Service Class | PascalCase + `Service` | `AttendanceService` |
| TS 型 / Interface | PascalCase | `CheckInInput`, `AttendanceFilter` |
| フロントエンド型 | PascalCase | `AttendanceRecord`, `SiblingInfo` |

---

## 13. 未実装機能（用語のみ定義）

この一覧で確認できる「穴」＝今後の実装候補：

| 機能 | 状態 | 備考 |
|------|------|------|
| 一括ダウンロード（ZIP） | 未実装 | APIパス・フック未定義 |
| 自動アルバム生成 | 未実装 | 「うちの子だけ」アルバム |
| 共有リンク（祖父母向け） | 未実装 | 期限付き閲覧URL |
| 写真の公開承認フロー | 未実装 | 先生→園長→保護者 |
| 顔ぼかし自動処理 | 未実装 | 他児の顔を自動ぼかし |
| プリント注文連携 | 未実装 | しまうまプリント等 |
| マジックリンク認証 | 未実装 | パスワード不要ログイン |
| スタッフ向けMFA | 未実装 | TOTP/SMS二段階認証 |
| ストレージ追加購入 | 未実装 | GB単位の課金 |
| 年間フォトブック | 未実装 | AI自動選別・PDF生成 |
| 園児マスタCRUD | 未実装 | `/api/children` が未整備 |
| 保護者マスタ管理 | 未実装 | 保護者の一覧・招待フロー |
| ~~園スタッフ管理~~ | **実装済み** | `/api/staff` + 招待・プロフィール・担任管理 |
| ~~クラス管理~~ | **実装済み** | `/api/classes` + 担任配置・年度更新 |
| ~~タッチパネル登降園~~ | **実装済み** | `/attendance/touchpanel` |
| 通知・プッシュ | 未実装 | 連絡帳更新・登園通知 |
| 保護者向けモバイルアプリ | 未実装 | BLEビーコン受信にはネイティブアプリが必要 |
| スタッフ勤怠管理 | 未実装 | 先生のシフト・出退勤 |
| クラス別権限フィルタリング | 未実装 | scope=class_onlyのAPIレベル制御 |

---

*最終更新: 2026-03-19*
