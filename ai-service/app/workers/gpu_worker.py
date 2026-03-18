"""
MemoriaKids GPU Worker
Redisキューから顔認識ジョブを取得し、GPUで処理するワーカー。
処理量に応じたマイニング報酬トラッキング機能付き。
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any

import numpy as np
import redis.asyncio as redis

from app.face_recognition import FaceRecognitionEngine

logger = logging.getLogger(__name__)

# ジョブキュー名
QUEUE_NAME = "face_recognition_jobs"
RESULT_PREFIX = "job_result:"
COMPUTE_STATS_KEY = "compute_stats:{worker_id}"

# マイニング報酬の設定
REWARD_PER_FACE_DETECTED = 1.0        # 顔検出1件あたりの基本報酬
REWARD_PER_MATCH = 2.5                 # 顔照合成功1件あたりの報酬
REWARD_PER_REGISTRATION = 5.0          # 顔登録1件あたりの報酬
GPU_UTILIZATION_BONUS_MULTIPLIER = 1.5  # GPU使用率が高い場合のボーナス倍率


@dataclass
class ComputeStats:
    """GPU計算量の統計情報（マイニング報酬トラッキング用）"""
    worker_id: str
    total_jobs_processed: int = 0
    total_faces_detected: int = 0
    total_matches_found: int = 0
    total_registrations: int = 0
    total_compute_time_ms: float = 0.0
    total_rewards: float = 0.0
    session_start: float = field(default_factory=time.time)

    def add_detection_reward(self, faces_detected: int, matches_found: int, compute_time_ms: float) -> float:
        """顔検出ジョブの報酬を計算・加算する"""
        reward = (
            faces_detected * REWARD_PER_FACE_DETECTED
            + matches_found * REWARD_PER_MATCH
        )

        # GPU高稼働ボーナス（処理時間が長い＝より多くのGPU計算を実行）
        if compute_time_ms > 100:
            reward *= GPU_UTILIZATION_BONUS_MULTIPLIER

        self.total_jobs_processed += 1
        self.total_faces_detected += faces_detected
        self.total_matches_found += matches_found
        self.total_compute_time_ms += compute_time_ms
        self.total_rewards += reward

        return reward

    def add_registration_reward(self) -> float:
        """顔登録ジョブの報酬を加算する"""
        reward = REWARD_PER_REGISTRATION
        self.total_registrations += 1
        self.total_rewards += reward
        return reward

    def to_dict(self) -> dict[str, Any]:
        """統計情報を辞書形式で返す"""
        uptime = time.time() - self.session_start
        return {
            "worker_id": self.worker_id,
            "total_jobs_processed": self.total_jobs_processed,
            "total_faces_detected": self.total_faces_detected,
            "total_matches_found": self.total_matches_found,
            "total_registrations": self.total_registrations,
            "total_compute_time_ms": round(self.total_compute_time_ms, 2),
            "total_rewards": round(self.total_rewards, 4),
            "uptime_seconds": round(uptime, 2),
            "avg_processing_time_ms": round(
                self.total_compute_time_ms / max(self.total_jobs_processed, 1), 2
            ),
        }


class GPUWorker:
    """
    GPU顔認識ワーカー

    Redisのブロッキングキューからジョブを取得し、
    顔認識エンジンで処理して結果を返す。
    処理量に応じたマイニング報酬をトラッキングする。
    """

    def __init__(self, worker_id: str | None = None):
        self.worker_id = worker_id or f"gpu-worker-{os.getpid()}"
        self.engine: FaceRecognitionEngine | None = None
        self.redis_client: redis.Redis | None = None
        self.stats = ComputeStats(worker_id=self.worker_id)
        self._running = False

    async def initialize(self) -> None:
        """ワーカーの初期化（モデルロード・Redis接続）"""
        # 顔認識エンジン初期化
        self.engine = FaceRecognitionEngine()
        await self.engine.initialize()

        if not self.engine.is_loaded:
            raise RuntimeError("顔認識エンジンの初期化に失敗しました")

        # Redis接続
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        self.redis_client = redis.from_url(redis_url, decode_responses=False)
        await self.redis_client.ping()

        logger.info(f"GPUワーカー {self.worker_id} の初期化が完了しました")

    async def run(self) -> None:
        """
        メインループ: Redisキューからジョブを取得して処理する
        BLPOPを使用してブロッキングでジョブを待機する
        """
        if self.redis_client is None or self.engine is None:
            raise RuntimeError("ワーカーが初期化されていません。先にinitialize()を呼び出してください")

        self._running = True
        logger.info(f"GPUワーカー {self.worker_id} を開始します。キュー: {QUEUE_NAME}")

        while self._running:
            try:
                # ブロッキングでジョブを取得（タイムアウト5秒）
                result = await self.redis_client.blpop(QUEUE_NAME, timeout=5)

                if result is None:
                    # タイムアウト: 統計情報を更新して待機を続ける
                    await self._update_stats_in_redis()
                    continue

                _, job_data = result
                job = json.loads(job_data)

                logger.info(f"ジョブを受信: {job.get('job_id', 'unknown')} (タイプ: {job.get('type', 'unknown')})")

                # ジョブの処理
                job_result = await self._process_job(job)

                # 結果をRedisに保存（ジョブIDをキーとして30分間保持）
                job_id = job.get("job_id", "unknown")
                result_key = f"{RESULT_PREFIX}{job_id}"
                await self.redis_client.set(
                    result_key,
                    json.dumps(job_result),
                    ex=1800,  # 30分でTTL
                )

                # 統計情報を更新
                await self._update_stats_in_redis()

            except redis.ConnectionError as e:
                logger.error(f"Redis接続エラー: {e}。5秒後にリトライします...")
                await asyncio.sleep(5)

            except Exception as e:
                logger.error(f"ジョブ処理中にエラー: {e}", exc_info=True)
                await asyncio.sleep(1)

    async def _process_job(self, job: dict[str, Any]) -> dict[str, Any]:
        """
        ジョブを処理して結果を返す

        サポートするジョブタイプ:
        - "recognize": 画像から顔を認識
        - "register": 顔ベクトルを登録
        """
        job_type = job.get("type", "recognize")
        start_time = time.time()

        try:
            if job_type == "recognize":
                result = await self._process_recognition_job(job)
            elif job_type == "register":
                result = await self._process_registration_job(job)
            else:
                result = {"error": f"未対応のジョブタイプ: {job_type}"}

            compute_time_ms = (time.time() - start_time) * 1000
            result["compute_time_ms"] = round(compute_time_ms, 2)
            result["worker_id"] = self.worker_id

            return result

        except Exception as e:
            logger.error(f"ジョブ処理エラー: {e}")
            return {
                "error": str(e),
                "worker_id": self.worker_id,
                "compute_time_ms": round((time.time() - start_time) * 1000, 2),
            }

    async def _process_recognition_job(self, job: dict[str, Any]) -> dict[str, Any]:
        """顔認識ジョブの処理"""
        assert self.engine is not None
        assert self.redis_client is not None

        # 画像データの復元（Base64 -> numpy配列）
        import base64
        from io import BytesIO
        from PIL import Image

        image_b64 = job.get("image_data", "")
        image_bytes = base64.b64decode(image_b64)
        pil_image = Image.open(BytesIO(image_bytes)).convert("RGB")
        img_array = np.array(pil_image)

        nursery_id = job.get("nursery_id", "")
        threshold = job.get("threshold", 0.6)

        # 顔検出と特徴抽出
        detections = self.engine.detect_and_extract(img_array)

        # 登録済みベクトルの読み込み
        stored_vectors = await self._load_vectors(nursery_id)

        # 照合
        matches = []
        for det in detections:
            best = self.engine.find_best_match(det["embedding"], stored_vectors, threshold)
            if best:
                matches.append(best)

        # 報酬を計算
        compute_time_ms = 0.0  # 呼び出し元で設定される
        reward = self.stats.add_detection_reward(
            faces_detected=len(detections),
            matches_found=len(matches),
            compute_time_ms=compute_time_ms,
        )

        return {
            "status": "completed",
            "faces_detected": len(detections),
            "matches": matches,
            "reward_earned": round(reward, 4),
        }

    async def _process_registration_job(self, job: dict[str, Any]) -> dict[str, Any]:
        """顔登録ジョブの処理"""
        assert self.engine is not None
        assert self.redis_client is not None

        import base64
        from io import BytesIO
        from PIL import Image

        image_b64 = job.get("image_data", "")
        image_bytes = base64.b64decode(image_b64)
        pil_image = Image.open(BytesIO(image_bytes)).convert("RGB")
        img_array = np.array(pil_image)

        child_id = job.get("child_id", "")
        nursery_id = job.get("nursery_id", "")

        # 顔検出
        detections = self.engine.detect_and_extract(img_array)
        if len(detections) != 1:
            return {
                "status": "error",
                "error": f"顔が{len(detections)}件検出されました（1件である必要があります）",
            }

        # ベクトルをRedisに保存
        embedding = detections[0]["embedding"]
        key = f"face_vector:{nursery_id}:{child_id}"
        await self.redis_client.set(key, embedding.astype(np.float32).tobytes())

        reward = self.stats.add_registration_reward()

        return {
            "status": "completed",
            "child_id": child_id,
            "quality_score": detections[0].get("quality_score", 0.0),
            "reward_earned": round(reward, 4),
        }

    async def _load_vectors(self, nursery_id: str) -> list[dict[str, Any]]:
        """Redisから登録済み顔ベクトルを読み込む"""
        assert self.redis_client is not None
        vectors: list[dict[str, Any]] = []

        pattern = f"face_vector:{nursery_id}:*"
        async for key in self.redis_client.scan_iter(match=pattern, count=100):
            key_str = key.decode("utf-8") if isinstance(key, bytes) else key
            child_id = key_str.split(":")[-1]
            raw = await self.redis_client.get(key)
            if raw:
                embedding = np.frombuffer(raw, dtype=np.float32)
                vectors.append({"child_id": child_id, "embedding": embedding})

        return vectors

    async def _update_stats_in_redis(self) -> None:
        """計算統計情報をRedisに保存する"""
        if self.redis_client is None:
            return

        try:
            stats_key = COMPUTE_STATS_KEY.format(worker_id=self.worker_id)
            await self.redis_client.set(
                stats_key,
                json.dumps(self.stats.to_dict()),
                ex=3600,  # 1時間TTL
            )
        except Exception as e:
            logger.warning(f"統計情報の更新に失敗: {e}")

    async def stop(self) -> None:
        """ワーカーを停止する"""
        self._running = False
        logger.info(f"GPUワーカー {self.worker_id} を停止します")

        # 最終統計情報をログ出力
        stats = self.stats.to_dict()
        logger.info(f"最終統計: {json.dumps(stats, ensure_ascii=False)}")

        if self.redis_client:
            await self._update_stats_in_redis()
            await self.redis_client.aclose()


async def main() -> None:
    """ワーカーのエントリーポイント"""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    )

    worker = GPUWorker()
    await worker.initialize()

    try:
        await worker.run()
    except KeyboardInterrupt:
        logger.info("キーボード割り込みを受信しました")
    finally:
        await worker.stop()


if __name__ == "__main__":
    asyncio.run(main())
