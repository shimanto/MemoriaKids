/**
 * MemoriaKids 共有型定義
 * フロントエンドとバックエンドで共通して使用する型を定義する
 */

// ============================================================
// ユーザー・認証関連
// ============================================================

/** ユーザーの役割 */
export type UserRole = "admin" | "nursery_admin" | "teacher" | "parent";

/** ユーザー情報 */
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl: string | null;
  nurseryId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 認証トークンペア */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** ログインリクエスト */
export interface LoginRequest {
  email: string;
  password: string;
}

/** ログインレスポンス */
export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

// ============================================================
// 保育園関連
// ============================================================

/** 保育園情報 */
export interface Nursery {
  id: string;
  name: string;
  address: string;
  phoneNumber: string;
  email: string;
  logoUrl: string | null;
  /** 定員数 */
  capacity: number;
  /** サブスクリプションプランID */
  subscriptionId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** クラス（組）情報 */
export interface NurseryClass {
  id: string;
  nurseryId: string;
  name: string;
  /** 対象年齢（歳） */
  ageGroup: number;
  /** 担任の先生ID一覧 */
  teacherIds: string[];
  schoolYear: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// 園児関連
// ============================================================

/** 性別 */
export type Gender = "male" | "female" | "other";

/** アレルギー情報 */
export interface AllergyInfo {
  allergen: string;
  severity: "mild" | "moderate" | "severe";
  notes: string;
}

/** 園児情報 */
export interface Child {
  id: string;
  nurseryId: string;
  classId: string | null;
  firstName: string;
  lastName: string;
  /** 名前の読み仮名 */
  firstNameKana: string;
  lastNameKana: string;
  dateOfBirth: string;
  gender: Gender;
  bloodType: string | null;
  allergies: AllergyInfo[];
  /** 保護者のユーザーID一覧 */
  parentIds: string[];
  profilePhotoUrl: string | null;
  /** 顔認識ベクトルが登録済みかどうか */
  hasFaceVector: boolean;
  notes: string;
  isActive: boolean;
  enrolledAt: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// 出欠管理
// ============================================================

/** 出欠ステータス */
export type AttendanceStatus =
  | "present"
  | "absent"
  | "late"
  | "early_leave"
  | "sick_leave"
  | "planned_absence";

/** 出欠記録 */
export interface AttendanceRecord {
  id: string;
  childId: string;
  nurseryId: string;
  date: string;
  status: AttendanceStatus;
  /** 登園時刻 */
  checkInTime: string | null;
  /** 降園時刻 */
  checkOutTime: string | null;
  /** 登園時の体温 */
  temperature: number | null;
  /** 顔認識による自動チェックインかどうか */
  autoCheckedIn: boolean;
  /** 顔認識の信頼度 */
  faceRecognitionConfidence: number | null;
  notes: string;
  /** 記録者（先生）のID */
  recordedBy: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// 連絡帳
// ============================================================

/** 連絡帳の気分 */
export type MoodType = "great" | "good" | "normal" | "poor" | "bad";

/** 食事の摂取量 */
export type MealAmount = "all" | "most" | "half" | "little" | "none";

/** 連絡帳エントリー */
export interface ContactBookEntry {
  id: string;
  childId: string;
  nurseryId: string;
  date: string;
  /** 保育園からの報告 */
  nurseryReport: {
    /** 園での様子 */
    activities: string;
    mood: MoodType;
    /** 昼食の摂取量 */
    lunchAmount: MealAmount;
    /** おやつの摂取量 */
    snackAmount: MealAmount;
    /** 午睡の時間（分） */
    napDurationMinutes: number | null;
    /** 排泄回数 */
    bathroomCount: number;
    /** 体温 */
    temperature: number | null;
    /** 特記事項 */
    notes: string;
    /** 添付写真URL */
    photoUrls: string[];
  } | null;
  /** 保護者からの連絡 */
  parentReport: {
    /** 家庭での様子 */
    homeCondition: string;
    /** 朝食の摂取量 */
    breakfastAmount: MealAmount;
    /** 就寝時刻 */
    bedTime: string | null;
    /** 起床時刻 */
    wakeTime: string | null;
    /** 体温 */
    temperature: number | null;
    /** 連絡事項 */
    notes: string;
  } | null;
  /** 記録者ID */
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// 成長記録
// ============================================================

/** 成長記録の種別 */
export type GrowthRecordType =
  | "height_weight"
  | "milestone"
  | "health_check"
  | "vaccination";

/** 成長記録 */
export interface GrowthRecord {
  id: string;
  childId: string;
  type: GrowthRecordType;
  date: string;
  /** 身長 (cm) */
  height: number | null;
  /** 体重 (kg) */
  weight: number | null;
  /** 頭囲 (cm) */
  headCircumference: number | null;
  /** マイルストーンの内容 */
  milestone: string | null;
  /** 健康診断・予防接種の詳細 */
  details: string;
  recordedBy: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// 写真・メディア
// ============================================================

/** 写真情報 */
export interface Photo {
  id: string;
  nurseryId: string;
  /** アップロードした先生のID */
  uploadedBy: string;
  /** MinIOのオブジェクトキー */
  objectKey: string;
  /** サムネイルのオブジェクトキー */
  thumbnailKey: string | null;
  /** 元のファイル名 */
  originalFilename: string;
  /** MIMEタイプ */
  mimeType: string;
  /** ファイルサイズ（バイト） */
  fileSize: number;
  /** 撮影日時 */
  takenAt: string | null;
  /** 顔認識によりタグ付けされた園児ID一覧 */
  taggedChildIds: string[];
  /** 手動でタグ付けされた園児ID一覧 */
  manualTaggedChildIds: string[];
  /** アルバムID */
  albumId: string | null;
  /** 保護者に公開済みかどうか */
  isPublished: boolean;
  /** 購入可能かどうか */
  isPurchasable: boolean;
  /** 写真の価格（円） */
  price: number | null;
  createdAt: string;
  updatedAt: string;
}

/** アルバム情報 */
export interface Album {
  id: string;
  nurseryId: string;
  title: string;
  description: string;
  coverPhotoId: string | null;
  photoCount: number;
  eventDate: string | null;
  isPublished: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// 顔認識関連
// ============================================================

/** 顔ベクトル情報 */
export interface FaceVector {
  id: string;
  childId: string;
  nurseryId: string;
  /** ベクトルの次元数（通常512） */
  dimensions: number;
  /** 登録時の品質スコア */
  qualityScore: number;
  /** 登録元の写真ID */
  sourcePhotoId: string | null;
  /** このベクトルが有効かどうか */
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 顔認識結果 */
export interface FaceRecognitionResult {
  facesDetected: number;
  matches: FaceMatch[];
  processingTimeMs: number;
}

/** 顔の一致情報 */
export interface FaceMatch {
  childId: string;
  confidence: number;
  bbox: [number, number, number, number];
}

// ============================================================
// サブスクリプション・課金
// ============================================================

/** サブスクリプションプラン */
export type PlanType = "free" | "basic" | "standard" | "premium";

/** サブスクリプション状態 */
export type SubscriptionStatus =
  | "active"
  | "past_due"
  | "canceled"
  | "trialing";

/** サブスクリプション情報 */
export interface Subscription {
  id: string;
  nurseryId: string;
  plan: PlanType;
  status: SubscriptionStatus;
  /** 月額料金（円） */
  monthlyPrice: number;
  /** 園児上限数 */
  maxChildren: number;
  /** ストレージ上限 (GB) */
  maxStorageGb: number;
  /** 顔認識が利用可能か */
  faceRecognitionEnabled: boolean;
  /** 現在の請求期間の開始日 */
  currentPeriodStart: string;
  /** 現在の請求期間の終了日 */
  currentPeriodEnd: string;
  /** トライアル終了日 */
  trialEndDate: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// API レスポンス型
// ============================================================

/** 成功レスポンス */
export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: ResponseMeta;
}

/** エラーレスポンス */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/** ページネーション付きレスポンスのメタ情報 */
export interface ResponseMeta {
  /** 現在のページ番号 */
  page: number;
  /** 1ページあたりの件数 */
  perPage: number;
  /** 全件数 */
  total: number;
  /** 全ページ数 */
  totalPages: number;
}

/** ページネーション付きリストレスポンス */
export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  meta: ResponseMeta;
}

/** ページネーションクエリパラメータ */
export interface PaginationParams {
  page?: number;
  perPage?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

/** 検索クエリパラメータ */
export interface SearchParams extends PaginationParams {
  query?: string;
  filters?: Record<string, string | number | boolean>;
}
