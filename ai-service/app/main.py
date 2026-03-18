"""
MemoriaKids AI Service - 顔認識APIサーバー
保育園の園児を顔認識で識別し、出欠管理や写真の自動タグ付けを行う
"""

from __future__ import annotations

import io
import logging
import time
from contextlib import asynccontextmanager
from typing import Any

import numpy as np
import redis.asyncio as redis
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel

from app.face_recognition import FaceRecognitionEngine

logger = logging.getLogger(__name__)

# グローバルインスタンス
engine: FaceRecognitionEngine | None = None
redis_client: redis.Redis | None = None


class FaceMatch(BaseModel):
    """顔認識の一致結果"""
    child_id: str
    confidence: float
    bbox: list[float]  # [x1, y1, x2, y2]


class RecognitionResponse(BaseModel):
    """顔認識レスポンス"""
    faces_detected: int
    matches: list[FaceMatch]
    processing_time_ms: float


class RegisterFaceRequest(BaseModel):
    """顔登録リクエスト用メタデータ"""
    child_id: str
    nursery_id: str


class RegisterFaceResponse(BaseModel):
    """顔登録レスポンス"""
    child_id: str
    embedding_stored: bool
    face_quality_score: float
    message: str


class HealthResponse(BaseModel):
    """ヘルスチェックレスポンス"""
    status: str
    model_loaded: bool
    redis_connected: bool
    uptime_seconds: float


# 起動時刻の記録
_start_time: float = 0.0


@asynccontextmanager
async def lifespan(app: FastAPI):
    """アプリケーションのライフサイクル管理"""
    global engine, redis_client, _start_time

    _start_time = time.time()

    # 顔認識エンジンの初期化
    logger.info("顔認識エンジンを初期化中...")
    engine = FaceRecognitionEngine()
    await engine.initialize()
    logger.info("顔認識エンジンの初期化完了")

    # Redis接続
    try:
        import os
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        redis_client = redis.from_url(redis_url, decode_responses=False)
        await redis_client.ping()
        logger.info("Redis接続成功")
    except Exception as e:
        logger.warning(f"Redis接続失敗（スタンドアロンモードで続行）: {e}")
        redis_client = None

    yield

    # シャットダウン処理
    if redis_client:
        await redis_client.aclose()
    logger.info("AIサービスをシャットダウンしました")


app = FastAPI(
    title="MemoriaKids AI Service",
    description="保育園向け顔認識・園児識別API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """ヘルスチェックエンドポイント"""
    redis_connected = False
    if redis_client:
        try:
            await redis_client.ping()
            redis_connected = True
        except Exception:
            pass

    return HealthResponse(
        status="ok",
        model_loaded=engine is not None and engine.is_loaded,
        redis_connected=redis_connected,
        uptime_seconds=round(time.time() - _start_time, 2),
    )


@app.post("/recognize", response_model=RecognitionResponse)
async def recognize_faces(
    image: UploadFile = File(..., description="認識対象の画像ファイル"),
    nursery_id: str = Form(..., description="保育園ID（検索範囲の絞り込み）"),
    threshold: float = Form(0.6, description="一致判定の閾値 (0.0-1.0)"),
) -> RecognitionResponse:
    """
    画像から顔を検出し、登録済みの園児と照合する

    - 画像内の全ての顔を検出
    - 各顔の特徴ベクトルを抽出
    - 指定された保育園に登録済みの園児データと比較
    - 閾値以上の一致度がある場合、マッチ結果を返す
    """
    if engine is None or not engine.is_loaded:
        raise HTTPException(status_code=503, detail="顔認識エンジンが初期化されていません")

    start_time = time.time()

    # 画像の読み込みと検証
    try:
        contents = await image.read()
        pil_image = Image.open(io.BytesIO(contents)).convert("RGB")
        img_array = np.array(pil_image)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"画像の読み込みに失敗しました: {e}")

    # 登録済み顔ベクトルの取得
    stored_vectors = await _load_stored_vectors(nursery_id)

    # 顔検出と照合
    detections = engine.detect_and_extract(img_array)
    matches: list[FaceMatch] = []

    for detection in detections:
        embedding = detection["embedding"]
        bbox = detection["bbox"]

        # 登録済みベクトルとの比較
        best_match = engine.find_best_match(embedding, stored_vectors, threshold)
        if best_match:
            matches.append(
                FaceMatch(
                    child_id=best_match["child_id"],
                    confidence=round(best_match["confidence"], 4),
                    bbox=[round(v, 1) for v in bbox],
                )
            )

    processing_time = (time.time() - start_time) * 1000

    return RecognitionResponse(
        faces_detected=len(detections),
        matches=matches,
        processing_time_ms=round(processing_time, 2),
    )


@app.post("/register-face", response_model=RegisterFaceResponse)
async def register_face(
    image: UploadFile = File(..., description="園児の顔写真"),
    child_id: str = Form(..., description="園児ID"),
    nursery_id: str = Form(..., description="保育園ID"),
) -> RegisterFaceResponse:
    """
    園児の顔を登録する

    - 画像から顔を1つ検出（複数検出時はエラー）
    - 顔の品質スコアを算出
    - 特徴ベクトルを抽出してRedisに保存
    """
    if engine is None or not engine.is_loaded:
        raise HTTPException(status_code=503, detail="顔認識エンジンが初期化されていません")

    # 画像の読み込み
    try:
        contents = await image.read()
        pil_image = Image.open(io.BytesIO(contents)).convert("RGB")
        img_array = np.array(pil_image)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"画像の読み込みに失敗しました: {e}")

    # 顔検出
    detections = engine.detect_and_extract(img_array)

    if len(detections) == 0:
        raise HTTPException(status_code=400, detail="画像から顔が検出されませんでした")

    if len(detections) > 1:
        raise HTTPException(
            status_code=400,
            detail=f"複数の顔が検出されました ({len(detections)}件)。1人だけが写った写真を使用してください",
        )

    detection = detections[0]
    embedding = detection["embedding"]
    quality_score = detection.get("quality_score", 0.0)

    # 品質チェック（低品質の場合は警告）
    if quality_score < 0.3:
        raise HTTPException(
            status_code=400,
            detail="顔画像の品質が低すぎます。正面を向いた明るい写真を使用してください",
        )

    # Redisに顔ベクトルを保存
    stored = await _store_face_vector(nursery_id, child_id, embedding)

    return RegisterFaceResponse(
        child_id=child_id,
        embedding_stored=stored,
        face_quality_score=round(quality_score, 3),
        message="顔の登録が完了しました" if stored else "顔の登録に失敗しました（Redis未接続）",
    )


async def _load_stored_vectors(nursery_id: str) -> list[dict[str, Any]]:
    """
    Redisから保育園に登録済みの顔ベクトルを読み込む
    """
    vectors: list[dict[str, Any]] = []

    if redis_client is None:
        logger.warning("Redis未接続のため、登録済みベクトルを取得できません")
        return vectors

    try:
        # キーパターン: face_vector:{nursery_id}:{child_id}
        pattern = f"face_vector:{nursery_id}:*"
        async for key in redis_client.scan_iter(match=pattern, count=100):
            key_str = key.decode("utf-8") if isinstance(key, bytes) else key
            child_id = key_str.split(":")[-1]

            raw_data = await redis_client.get(key)
            if raw_data:
                embedding = np.frombuffer(raw_data, dtype=np.float32)
                vectors.append({
                    "child_id": child_id,
                    "embedding": embedding,
                })
    except Exception as e:
        logger.error(f"顔ベクトルの読み込みに失敗: {e}")

    return vectors


async def _store_face_vector(
    nursery_id: str, child_id: str, embedding: np.ndarray
) -> bool:
    """
    顔ベクトルをRedisに保存する
    """
    if redis_client is None:
        logger.warning("Redis未接続のため、顔ベクトルを保存できません")
        return False

    try:
        key = f"face_vector:{nursery_id}:{child_id}"
        embedding_bytes = embedding.astype(np.float32).tobytes()
        await redis_client.set(key, embedding_bytes)
        logger.info(f"顔ベクトルを保存: {key}")
        return True
    except Exception as e:
        logger.error(f"顔ベクトルの保存に失敗: {e}")
        return False
